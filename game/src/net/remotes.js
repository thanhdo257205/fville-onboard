// Người chơi khác (chơi nhiều người mức "thấy nhau"): model + bộ đồ họ gửi lên (model không có trong characters.json →
// dùng model của người chơi), bảng tên, animation theo state (idle / walk / run / sit), emote, bong bóng câu chat.
// Vị trí nội suy giữa các bản tin, vẽ trễ interp_ms (≈120 ms) cho mượt. Chỉ hiện max_visible người gần nhất cùng zone;
// không va chạm, không nằm trong danh sách NPC → dấu "!", gợi ý E, camera hội thoại không bị ảnh hưởng. Đang mini-game: ẩn
// hết (vd ảnh check-in); đang hội thoại / cảnh chuyển: ẩn người đứng sát người chơi, người đối thoại hoặc camera.
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { Character } from "../characters/characters.js";
import { applyTint, setTint } from "../characters/tint.js";
import { loadGLTF, url } from "../core/assets.js";
import { blocked } from "../world/collision.js";

const SEND_GAP_MS = 200;        // khoảng giữa 2 bản tin khi đang đi (5 lần/giây)
const SNAP_M = 6;               // 2 bản tin cách nhau hơn chừng này → dịch chuyển (không trượt dài)
const NEAR_TALK_M = 2.5;        // đang hội thoại: ẩn người khác đứng gần người chơi / người đối thoại hơn chừng này
const NEAR_CAM_M = 1.6;         // ẩn người khác đứng sát camera (che khung hình)
const OUTLINE_M = 12;           // viền nét (OutlineEffect) chỉ cho người khác trong chừng này mét — vẽ viền tốn gần bằng vẽ người
const _p = new THREE.Vector3(), _q = new THREE.Vector3();

const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

function tag(cls, text, center = null) {
  const el = document.createElement("div");
  el.className = cls;
  if (text != null) el.textContent = text;
  const obj = new CSS2DObject(el);
  if (center) obj.center.set(...center);
  return obj;
}

class Remote {
  constructor(p) {
    this.id = p.id;
    this.buf = [];              // [{t, pos, yaw, anim}] theo giờ nhận
    this.speed = 0;
    this.ch = null;             // Character (tạo khi lần đầu cần hiện)
    this.loading = false;
    this.visible = false;
    this.bubbleLeft = 0;
    this.profile(p);
  }
  profile(p) {
    this.name = p.name || "";
    this.outfit = p.outfit || "";
    if (this.model && p.model !== this.model) { this.rebuild = true; this.failed = false; }   // đổi model → dựng lại
    this.model = p.model || "";
    if (this.nameTag) this.nameTag.element.textContent = this.name;
    if (p.pos) this.push(p.pos, p.yaw, p.anim, true);
  }
  push(pos, yaw, anim, fresh = false) {
    const now = performance.now(), last = this.buf[this.buf.length - 1];
    const v = new THREE.Vector3(...pos);
    if (!last || fresh || last.pos.distanceTo(v) > SNAP_M) this.buf = [];
    // đứng yên một lúc rồi mới đi: đặt lại mốc của bản tin trước ngay trước bản tin này (không trượt chậm suốt quãng đứng yên)
    else if (now - last.t > SEND_GAP_MS * 1.5) this.buf.push({ ...last, t: now - SEND_GAP_MS });
    this.buf.push({ t: now, pos: v, yaw, anim: anim || "idle" });
    if (this.buf.length > 40) this.buf.splice(0, this.buf.length - 40);
  }
  // vị trí / hướng tại thời điểm vẽ (trễ delay ms)
  sample(delay) {
    const b = this.buf, t = performance.now() - delay;
    if (!b.length) return null;
    while (b.length > 2 && b[1].t <= t) b.shift();
    if (b.length === 1 || t <= b[0].t) return { pos: b[0].pos, yaw: b[0].yaw, anim: b[0].anim };
    const [a, c] = b;
    if (t >= c.t) return { pos: c.pos, yaw: c.yaw, anim: c.anim };
    const k = (t - a.t) / (c.t - a.t);
    return { pos: _p.lerpVectors(a.pos, c.pos, k), yaw: lerpAngle(a.yaw, c.yaw, k), anim: k < 0.5 ? a.anim : c.anim };
  }
  get position() { return this.buf[this.buf.length - 1]?.pos ?? null; }
}

export class RemotePlayers {
  constructor({ game, cfg, phrases }) {
    this.g = game;
    this.cfg = cfg;
    this.phrases = phrases;     // id → chữ
    this.list = new Map();      // id → Remote
    this.group = new THREE.Group();
    this.group.name = "remote_players";
    game.scene.add(this.group);
    this.show = true;
    this.pick = 0;              // đếm giờ chọn người gần nhất
    this.tagTimer = 0;
  }

  // ---------- tin từ máy chủ ----------
  reset(players = []) {
    for (const r of this.list.values()) this.dispose(r);
    this.list.clear();
    for (const p of players) this.upsert(p);
  }
  upsert(p) {
    const r = this.list.get(p.id);
    if (r) r.profile(p);
    else this.list.set(p.id, new Remote(p));
  }
  state(m) { this.list.get(m.id)?.push(m.pos, m.yaw, m.anim); }
  remove(id) {
    const r = this.list.get(id);
    if (!r) return;
    this.dispose(r);
    this.list.delete(id);
  }
  emote(id, anim) {
    const r = this.list.get(id);
    if (!r?.ch || !anim) return;
    const ch = r.ch, act = ch.playOnce(anim);
    r.emoting = ch.current;
    act.then(() => { if (r.ch === ch && ch.current === r.emoting) { r.emoting = null; ch.enableLocomotion(); } });
  }
  say(id, text) {
    const r = this.list.get(id);
    if (!r || !text) return;
    r.sayText = text;
    r.bubbleLeft = this.cfg.bubble_s ?? 4;
    if (r.bubble) this.showBubble(r);
  }
  showBubble(r) {
    const el = r.bubble.element;
    el.querySelector("span").textContent = r.sayText;
    r.bubble.visible = true;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }

  // ---------- dựng / bỏ model ----------
  async build(r) {
    r.loading = true;
    r.rebuild = false;
    const chars = this.g.characters, own = chars.role("player")?.model;
    // model lạ hoặc chưa có GLB (vd intern_nam / intern_nu khi còn chờ Mixamo) → model của người chơi
    const id = chars.model(r.model)?.glb ? r.model : own;
    const m = chars.model(id), tier = this.g.state.tier;
    try {
      const gltf = await loadGLTF(url(m.glb[tier] ?? m.glb.high ?? m.glb.low), { cached: true });
      if (!this.list.has(r.id)) return;                        // đã rời trong lúc tải
      if (r.ch) this.dispose(r, true);
      const ch = new Character(SkeletonUtils.clone(gltf.scene), gltf.animations, m, "remote");
      ch.tier = tier;
      const o = chars.role("player")?.outfit;                  // bộ đồ: chưa nhận Áo Cam FPT → áo sơ mi thường (đổi màu)
      applyTint(ch, o?.tint, { dynamic: !!o });
      // người khác ngoài khung nhìn thì không vẽ (Character tắt frustumCulled cho mọi nhân vật): khối cầu bao lấy theo tư thế
      // gốc, nới rộng cho tay chân khi chạy / vẫy
      ch.root.updateMatrixWorld(true);
      ch.root.traverse((x) => { if (x.isSkinnedMesh) { x.computeBoundingSphere(); x.boundingSphere.radius *= 1.3; x.frustumCulled = true; } });
      r.mats = [];                                             // material có viền (vật liệu trong suốt vốn không viền)
      ch.root.traverse((x) => { if (x.isMesh && x.material.userData.outlineParameters?.visible !== false) r.mats.push(x.material); });
      r.outlined = true;
      ch.enableLocomotion();
      ch.root.visible = false;
      r.nameTag = tag("nametag player-tag", r.name, [0.5, 0.5]);
      r.nameTag.position.set(0, m.height_m + (this.g.nametags.above ?? 0.28), 0);
      r.bubble = tag("speech", null, [0.5, 1]);
      r.bubble.element.innerHTML = "<span></span>";
      r.bubble.position.set(0, m.height_m + 0.55, 0);
      r.bubble.visible = false;
      ch.root.add(r.nameTag, r.bubble);
      r.ch = ch;
      r.outfitShown = null;
      this.group.add(ch.root);
      if (r.bubbleLeft > 0) this.showBubble(r);
    } catch {
      if (id !== own) r.model = own;                           // tải lỗi: thử 1 lần với model người chơi, rồi thôi
      else r.failed = true;
    } finally { r.loading = false; }
  }
  dispose(r, keepEntry = false) {
    if (!r.ch) return;
    for (const o of [r.nameTag, r.bubble]) o?.element.remove();
    r.ch.dispose();
    r.ch = null;
    r.nameTag = r.bubble = null;
    r.visible = false;
    if (!keepEntry) r.buf = [];
  }

  // ---------- mỗi khung ----------
  update(dt) {
    const g = this.g;
    const me = g.player?.position, cam = g.camera.position;
    this.pick -= dt;
    if (this.pick <= 0) { this.pick = 0.25; this.choose(me); }
    const talk = g.mode === "dialogue" ? g.talkPartner?.character?.root.position : null;
    this.tagTimer -= dt;
    const checkTags = this.tagTimer <= 0;
    if (checkTags) this.tagTimer = 0.2;
    const delay = this.cfg.interp_ms ?? 120;
    for (const r of this.list.values()) {
      if (r.bubbleLeft > 0) { r.bubbleLeft -= dt; if (r.bubbleLeft <= 0 && r.bubble) r.bubble.visible = false; }
      const s = r.sample(delay);
      if (!r.want || !s) { if (r.ch) r.ch.root.visible = false; r.visible = false; continue; }
      if ((!r.ch || r.rebuild) && !r.loading && !r.failed) { this.build(r); if (!r.ch) continue; }
      if (!r.ch) continue;
      const ch = r.ch, root = ch.root;
      // bộ đồ
      const o = g.characters.role("player")?.outfit;
      if (r.outfitShown !== r.outfit) { r.outfitShown = r.outfit; setTint(ch, o && r.outfit === o.until_reward ? null : o?.tint); }
      // vị trí, hướng, tốc độ (đo từ quãng di chuyển) → animation
      const before = _q.copy(root.position);
      const wasVisible = r.visible;
      root.position.copy(s.pos);
      root.rotation.y = wasVisible ? lerpAngle(root.rotation.y, s.yaw, Math.min(1, dt * 12)) : s.yaw;
      const moved = wasVisible && dt > 0 ? Math.hypot(root.position.x - before.x, root.position.z - before.z) / dt : 0;
      r.speed = THREE.MathUtils.lerp(r.speed, s.anim === "idle" && moved < 0.3 ? 0 : Math.min(moved, 6), Math.min(1, dt * 8));
      if (r.emoting && r.speed > 0.4) { r.emoting = null; ch.enableLocomotion(); }
      if (s.anim === "sit" && !r.emoting) {
        if (!r.sitting) { r.sitting = true; ch.playOnce("sit_down"); }
      } else if (r.sitting) { r.sitting = false; ch.enableLocomotion(); }
      if (!r.emoting && !r.sitting) ch.setSpeed(r.speed);
      // ẩn khi che hội thoại / mini-game / camera
      let hide = g.mode === "minigame";
      if (!hide && root.position.distanceTo(cam) < NEAR_CAM_M) hide = true;
      if (!hide && talk && me && (root.position.distanceTo(me) < NEAR_TALK_M || root.position.distanceTo(talk) < NEAR_TALK_M)) hide = true;
      root.visible = !hide;
      r.visible = !hide;
      const near = root.position.distanceTo(cam) < OUTLINE_M;
      if (r.outlined !== near) { r.outlined = near; for (const m of r.mats) m.userData.outlineParameters = { ...m.userData.outlineParameters, visible: near }; }
      if (!hide) ch.update(dt);
      if (checkTags && r.nameTag) {
        r.nameTag.getWorldPosition(_p);
        const d = _p.distanceTo(cam);
        r.nameTag.visible = d < (this.cfg.tag_distance_m ?? 16) && !(g.zone?.collider && blocked(g.zone.collider, cam, _p));
      }
    }
  }

  setShow(on) { this.show = on; this.pick = 0; }     // menu Esc → Show other players (áp ngay ở khung kế tiếp)

  // max_visible người gần nhất (đã có vị trí) được hiện; tắt "Show other players" → không ai
  choose(me) {
    const all = [...this.list.values()].filter((r) => r.position);
    for (const r of all) r.want = false;
    if (!this.show || !me) return;
    all.sort((a, b) => a.position.distanceToSquared(me) - b.position.distanceToSquared(me));
    for (const r of all.slice(0, this.cfg.max_visible ?? 10)) r.want = true;
  }

  info() {
    return [...this.list.values()].map((r) => ({ id: r.id, name: r.name, model: r.model, outfit: r.outfit, want: !!r.want, visible: r.visible,
      built: !!r.ch, pos: r.ch ? r.ch.root.position.toArray().map((v) => +v.toFixed(2)) : r.position?.toArray(),
      anim: r.buf[r.buf.length - 1]?.anim, speed: +r.speed.toFixed(2), emote: r.emoting ? r.emoting.getClip().name : null,
      bubble: r.bubble?.visible ? r.sayText : null, tag: r.nameTag ? r.nameTag.visible : null }));
  }
}
