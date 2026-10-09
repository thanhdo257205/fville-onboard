// Nhân vật theo data/characters.json: roles.<vai> = { model, place, node?, pose?, offset? } (TẠM: mọi vai = prajith),
// tên hiển thị theo ngôn ngữ (names.<lang>.<vai>), GLB theo mức đồ hoạ (models.<id>.glb.low|high).
// Model nhìn +Z (chuẩn glTF) → hướng d thì rotation.y = atan2(d.x, d.z); với yaw_deg của NPC_/SPAWN_: yaw + 180°.
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { loadGLTF, url } from "../core/assets.js";
import { makeCharacterMaterial } from "../render/renderer.js";
import { applyTint, setTint } from "./tint.js";
import { lang } from "../i18n.js";

export class Characters {
  constructor(cfg) { this.cfg = cfg; this.swap = {}; }
  role(name) { return this.cfg.roles[name]; }
  roles() { return Object.entries(this.cfg.roles).filter(([k]) => !k.startsWith("_")); }
  roleOfNode(nodeName) { return this.roles().find(([, r]) => r.place === "node" && [].concat(r.node).includes(nodeName))?.[0] ?? null; }
  displayName(role) { return this.cfg.names?.[lang]?.[role] ?? this.cfg.names?.en?.[role] ?? role; }
  model(id) { return this.cfg.models[this.swap[id] ?? id]; }
  tagConfig() { return this.cfg.name_tags || {}; }
  // người nói không có vai trong cảnh (vd "hr": tin nhắn điện thoại) → chân dung của vai speaker_as.<người nói>
  portrait(role) { const r = this.role(this.cfg.speaker_as?.[role] ?? role); return r ? this.model(r.model)?.portrait ?? null : null; }

  // model chờ người thật đồng ý (models.<id>.consent_pending): GLB + chân dung chỉ có trên máy làm việc, không có trên
  // repo công khai và bản build → thiếu file thì mọi vai của model đó dùng models.<id>.fallback
  async probe() {
    for (const [id, m] of Object.entries(this.cfg.models)) {
      if (!m.consent_pending || !m.fallback) continue;
      let ok = false;
      try {
        const r = await fetch(url(m.glb.low ?? m.glb.high), { method: "HEAD", cache: "no-store" });
        ok = r.ok && !(r.headers.get("content-type") || "").includes("text/html");   // dev server: thiếu file → index.html
      } catch { ok = false; }
      if (!ok) { this.swap[id] = m.fallback; console.info(`[nhân vật] ${id}: chưa có GLB → dùng ${m.fallback}`); }
    }
  }

  async create(role, tier) {
    const r = this.role(role);
    if (!r) throw new Error(`characters.json: thiếu vai "${role}"`);
    const m = this.model(r.model);
    const glb = m.glb[tier] ?? m.glb.high ?? m.glb.low;
    const gltf = await loadGLTF(url(glb), { cached: true });
    const ch = new Character(SkeletonUtils.clone(gltf.scene), gltf.animations, m, role);
    ch.tier = tier;
    applyTint(ch, r.tint || r.outfit?.tint, { dynamic: !!r.outfit });   // TẠM: màu áo / quần riêng từng vai; outfit: đổi được lúc chơi
    if (r.carry) attachCarry(ch, r.carry);  // đồ cầm tay (vd túi của hành khách)
    return ch;
  }
}

// đồ cầm tay đơn giản gắn vào xương bàn tay phải (không cần model riêng): "bag" = túi xách vải có quai
function attachCarry(ch, kind) {
  if (kind !== "bag") return;
  let hand = null;
  ch.root.traverse((o) => { if (o.isBone && !hand && /RightHand$/.test(o.name)) hand = o; });
  if (!hand) return;
  const mat = makeCharacterMaterial({ color: new THREE.Color(0x7a4e36) });
  const strap = makeCharacterMaterial({ color: new THREE.Color(0x3b2a20) });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.14), mat);
  body.position.y = 0.27;                     // xương tay: +Y hướng ra đầu ngón → túi treo dưới bàn tay
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 4, 10, Math.PI), strap);
  handle.position.y = 0.11;
  handle.rotation.z = Math.PI;
  g.add(body, handle);
  g.name = "carry_bag";
  ch.root.updateMatrixWorld(true);
  const s = hand.getWorldScale(new THREE.Vector3()).x || 1;   // bù tỉ lệ xương (Mixamo có thể theo cm)
  g.scale.setScalar(1 / s);
  hand.add(g);
}

export { setTint };

export class Character {
  constructor(object, clips, model, role) {
    this.root = new THREE.Group();          // gốc = giữa hai bàn chân; xoay quanh trục Y
    this.root.add(object);
    this.model = model;
    this.role = role;
    this.hips = null;                       // xương hông: tâm capsule va chạm của NPC
    object.traverse((o) => {
      if (o.isBone && !this.hips && /Hips$/.test(o.name)) this.hips = o;
      if (!o.isMesh) return;
      o.material = makeCharacterMaterial(o.material);
      o.frustumCulled = false;              // mesh có xương: hộp bao không theo animation
    });
    this.mixer = new THREE.AnimationMixer(object);
    this.actions = {};
    for (const c of clips) this.actions[c.name] = this.mixer.clipAction(c);
    this.loco = false;
    this.current = null;
    this._waiters = new Map();              // action → resolve() khi phát xong (LoopOnce)
    this.mixer.addEventListener("finished", (e) => {
      const done = this._waiters.get(e.action);
      if (done) { this._waiters.delete(e.action); done(); }
    });
    this.group = null;                      // nhóm phát luân phiên (vd talk = talk, talk_2)
  }

  // --- đi/đứng: idle/walk/run chạy song song, trộn trọng số theo tốc độ → chuyển mượt ---
  enableLocomotion(fade = 0.25) {
    const a = this.actions;
    this.group = null;
    if (this.current) { this.current.fadeOut(fade); this.current = null; }
    for (const n of ["idle", "walk", "run"]) { a[n].reset().setLoop(THREE.LoopRepeat, Infinity).play(); a[n].setEffectiveWeight(n === "idle" ? 1 : 0); }
    this.loco = true;
  }

  // speed: tốc độ thật (m/s). Trọng số theo tốc độ CHƠI (speed_mps), tốc độ phát theo tốc độ ANIMATION
  // (anim_speed_mps) → chân không trượt (vd đi 1,4 m/s, animation đo 1,66 m/s → phát walk ×0,84).
  setSpeed(speed) {
    if (!this.loco) return;
    const { walk: ws, run: rs } = this.model.speed_mps;
    const an = this.model.anim_speed_mps || this.model.speed_mps;
    const a = this.actions;
    let wi = 0, ww = 0, wr = 0;
    if (speed <= ws) { ww = THREE.MathUtils.clamp(speed / ws, 0, 1); wi = 1 - ww; }
    else { wr = THREE.MathUtils.clamp((speed - ws) / (rs - ws), 0, 1); ww = 1 - wr; }
    a.idle.setEffectiveWeight(wi);
    a.walk.setEffectiveWeight(ww);
    a.run.setEffectiveWeight(wr);
    a.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(Math.max(speed, ws * 0.6) / an.walk, 0.5, 1.8));
    a.run.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / an.run, 0.6, 1.3));
  }

  // --- 1 animation (NPC) ---
  play(name, { fade = 0.3, randomStart = false } = {}) {
    const entry = this.model.animations[name] ?? name;
    if (Array.isArray(entry)) return this.playGroup(entry, { fade, randomStart });
    this.group = null;
    return this._play(entry, { fade, randomStart, loop: this.model.loop.includes(name) });
  }

  _play(clip, { fade = 0.3, randomStart = false, loop = true } = {}) {
    const act = this.actions[clip];
    if (!act) return null;
    if (this.loco) {                        // rời chế độ đi/đứng
      for (const n of ["idle", "walk", "run"]) this.actions[n].fadeOut(fade);
      this.loco = false;
    }
    act.reset().setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    act.clampWhenFinished = !loop;
    act.enabled = true;
    act.setEffectiveTimeScale(1).setEffectiveWeight(1);
    if (this.current && this.current !== act) { act.play(); this.current.crossFadeTo(act, fade, false); }
    else act.fadeIn(fade).play();
    if (randomStart) act.time = Math.random() * act.getClip().duration;
    this.current = act;
    return act;
  }

  // giữ một tư thế, lặp cả animation vốn phát 1 lần (vd wave) — chụp ảnh
  pose(name, fade = 0.25) { this.group = null; return this._play(this.model.animations[name] ?? name, { fade, loop: true }); }

  // phát 1 lần, trả Promise khi xong (vd stand_up, sit_down)
  playOnce(name, opts = {}) {
    this.group = null;
    const act = this._play(this.model.animations[name] ?? name, { ...opts, loop: false });
    if (!act) return Promise.resolve();
    return new Promise((res) => this._waiters.set(act, res));
  }

  // phát luân phiên các clip (talk, talk_2, ...) cho tới khi đổi animation khác
  playGroup(clips, { fade = 0.3, randomStart = false } = {}) {
    const token = {};
    this.group = token;
    const next = (i, first) => {
      if (this.group !== token) return;
      const act = this._play(clips[i % clips.length], { fade, randomStart: first && randomStart, loop: false });
      if (act) this._waiters.set(act, () => next(i + 1, false));
    };
    next(0, true);
  }

  faceDir(dir, dt, rate = 10) {
    if (dir.lengthSq() < 1e-6) return;
    this.turnToward(Math.atan2(dir.x, dir.z), dt, rate);
  }
  // trả độ lệch còn lại (rad)
  turnToward(angle, dt, rate = 8) {
    let d = angle - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, rate * dt);
    return Math.abs(d);
  }

  update(dt) { this.mixer.update(dt); }

  dispose() { this.mixer.stopAllAction(); this.root.removeFromParent(); }
}
