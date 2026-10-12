// Thẻ nhân viên 3D (assets/props/id_card/id_card.glb — scripts/blender/props/build_id_card.py: khung nhựa + mặt thẻ trắng
// "card_face", dọc 54 × 86 mm, mặt trước nhìn +Z). Mặt thẻ vẽ bằng code: ảnh thẻ người chơi chụp ở quầy lễ tân (photos.id),
// tên, vị trí — giống thẻ trong app My FPT. Gắn vào xương bàn tay phải (clip "reach": build_reach.py):
//   • give (zone 3, lễ tân — hội thoại le_tan_main): thẻ trong tay lễ tân lúc chị đưa ra → người chơi đưa tay nhận → thẻ
//     sang tay người chơi → cất đi
//   • tap (zone 4, cửa quẹt thẻ — hội thoại card_gate): người chơi quay về đầu đọc, cầm thẻ đưa tay chạm đầu đọc
// Thẻ là vật do code tạo: zone đổi / xong thì gỡ và dọn (clear). __game.idCard: trạng thái cho kiểm thử.
import * as THREE from "three";
import { loadGLTF, url } from "../core/assets.js";
import { tx } from "../content/content.js";

const HAND = "mixamorigRightHand";
// thẻ trong hệ xương bàn tay (m, đã bù tỉ lệ xương): xương Y dọc theo ngón tay — thẻ kẹp giữa ngón cái và các ngón,
// thò ra trước đầu ngón. Góc xoay dò ở cuối clip reach của lễ tân (zone 3): mặt thẻ nhìn thẳng về người nhận, cạnh dài
// đứng thẳng (mặt trước · hướng tới người nhận = 1, trục dọc thẻ · trục Y thế giới = 1)
const HOLD = { pos: [0.0, 0.1, 0.025], rot: [-1.5, -0.15, -0.75] };
const FACE_PX = [432, 688];        // 54 × 86 mm × 8

let template = null;               // Promise<THREE.Object3D>

function loadTemplate() {
  template ??= loadGLTF(url("assets/props/id_card/id_card.glb"), { cached: true }).then((g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.userData.shared = true;       // bản sao dùng chung lưới — disposeTree không dọn
      o.material.userData.shared = true;
      o.material.userData.outlineParameters = { visible: false };
      // vỏ nhựa bọc ngoài (to hơn mặt thẻ): trong suốt, không che mặt thẻ
      if (o.material.name === "card_plastic") Object.assign(o.material, { transparent: true, opacity: 0.15, depthWrite: false });
    });
    return g.scene;
  }).catch((e) => { template = null; throw e; });
  return template;
}

function img(src) {
  return new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

// mặt thẻ: dải cam trên cùng (FPT Software · F-Ville), ảnh thẻ, tên, vị trí · Intern, mã intern
async function drawFace({ photo, name, role }) {
  const [W, H] = FACE_PX;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#f37021"; g.fillRect(0, 0, W, 132);
  g.fillStyle = "#f37021"; g.fillRect(0, H - 34, W, 34);
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "800 46px Nunito, sans-serif"; g.fillText("FPT Software", W / 2, 58);
  g.font = "700 24px Nunito, sans-serif"; g.fillText("F-Ville · Hòa Lạc", W / 2, 104);
  const pw = 220, ph = 270, px = (W - pw) / 2, py = 162;
  const pic = await img(photo);
  g.fillStyle = "#e9edf2"; g.fillRect(px, py, pw, ph);
  if (pic) {
    const s = Math.max(pw / pic.width, ph / pic.height), sw = pw / s, sh = ph / s;
    g.drawImage(pic, (pic.width - sw) / 2, (pic.height - sh) / 2, sw, sh, px, py, pw, ph);
  } else { g.font = "120px sans-serif"; g.fillText("🙂", W / 2, py + ph / 2); }
  g.strokeStyle = "#f37021"; g.lineWidth = 6; g.strokeRect(px, py, pw, ph);
  g.fillStyle = "#1d1f23"; g.font = "800 38px Nunito, sans-serif";
  let n = name || "";
  while (n.length > 1 && g.measureText(n).width > W - 40) n = n.slice(0, -1);
  g.fillText(n === (name || "") ? n : `${n}…`, W / 2, 486);
  g.fillStyle = "#555b66"; g.font = "700 26px Nunito, sans-serif";
  g.fillText(`${role ? `${role} · ` : ""}Intern`, W / 2, 532);
  g.fillStyle = "#f37021"; g.font = "800 28px Nunito, sans-serif"; g.fillText("FV-2026", W / 2, 590);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // UV mặt thẻ của mô hình gốc: v = 0 ở mép DƯỚI ảnh (đã kiểm tra bằng mắt) → giữ flipY mặc định của CanvasTexture
  tex.anisotropy = 4;
  return tex;
}

export class IdCard {
  constructor(game) {
    this.g = game;
    this.card = null;                // THREE.Object3D đang hiện
    this.holder = null;              // "le_tan" | "player"
    this.token = null;
    this.log = [];                   // các bước gần nhất (kiểm thử)
    this.stats = { give: 0, tap: 0, hold_le_tan: 0, hold_player: 0, handover: 0 };   // đếm từ lúc mở game (smoke)
  }

  info() {
    const c = this.card;
    const p = c ? c.getWorldPosition(new THREE.Vector3()) : null;
    return { holder: this.holder, visible: !!c?.parent, pos: p && p.toArray().map((v) => +v.toFixed(3)), log: this.log.slice(-8), stats: { ...this.stats } };
  }

  async make() {
    const g = this.g, s = g.progress;
    const pos = g.characters.cfg.character_creation?.positions?.find((x) => x.id === s.player.position);
    const [tpl, face] = await Promise.all([loadTemplate(), drawFace({ photo: s.photos.id, name: s.player.name, role: tx(pos?.name) || "" })]);
    const card = tpl.clone(true);
    card.name = "id_card";
    card.traverse((o) => {
      if (o.isMesh && o.material.name === "card_face") {
        o.material = new THREE.MeshBasicMaterial({ map: face, color: 0xe8e8e8 });   // thẻ in: không tối theo đèn chỗ quầy
        o.material.userData.outlineParameters = { visible: false };
      }
    });
    return card;
  }

  // gắn thẻ vào bàn tay phải của nhân vật (bù tỉ lệ xương → thẻ đúng cỡ thật)
  hand(character) {
    let bone = null;
    character?.root.traverse((o) => { if (!bone && o.isBone && o.name === HAND) bone = o; });
    return bone;
  }

  // thẻ trong hệ xương bàn tay (bù tỉ lệ xương)
  placeIn(bone) {
    bone.updateWorldMatrix(true, false);
    const s = new THREE.Vector3().setFromMatrixScale(bone.matrixWorld).x || 1;
    this.card.position.set(...HOLD.pos).multiplyScalar(1 / s);
    this.card.rotation.set(...HOLD.rot);
    this.card.scale.setScalar(1 / s);
  }

  hold(character, who) {
    const bone = this.hand(character);
    if (!bone || !this.card) return false;
    this.tween = null;
    this.placeIn(bone);
    bone.add(this.card);
    this.holder = who;
    this.log.push(`hold:${who}`);
    this.stats[`hold_${who}`] = (this.stats[`hold_${who}`] || 0) + 1;
    return true;
  }

  // lễ tân đứng sau quầy (cách người chơi ~2,7 m): thẻ trượt từ tay chị sang tay người chơi trong `ms` (toạ độ thế giới,
  // đích là bàn tay đang chuyển động — tính lại mỗi khung), rồi gắn vào tay người chơi
  flyTo(character, who, ms) {
    const bone = this.hand(character);
    if (!bone || !this.card) return Promise.resolve(false);
    this.g.scene.attach(this.card);
    const c = this.card;
    return new Promise((done) => {
      this.tween = { t: 0, dur: ms / 1000, bone, who, character, done,
        from: { p: c.position.clone(), q: c.quaternion.clone(), s: c.scale.clone() } };
    });
  }

  stepTween(dt) {
    const tw = this.tween;
    if (!tw || !this.card) return;
    tw.t += dt;
    const k = THREE.MathUtils.smoothstep(Math.min(1, tw.t / tw.dur), 0, 1);
    // khung đích: bàn tay × vị trí cầm
    const probe = new THREE.Object3D();
    tw.bone.updateWorldMatrix(true, false);
    const s = new THREE.Vector3().setFromMatrixScale(tw.bone.matrixWorld).x || 1;
    probe.position.set(...HOLD.pos).multiplyScalar(1 / s);
    probe.rotation.set(...HOLD.rot);
    probe.scale.setScalar(1 / s);
    probe.updateMatrix();
    const m = tw.bone.matrixWorld.clone().multiply(probe.matrix);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.decompose(p, q, sc);
    this.card.position.lerpVectors(tw.from.p, p, k);
    this.card.position.y += Math.sin(Math.PI * k) * 0.08;        // vòng cung nhẹ qua mặt quầy
    this.card.quaternion.slerpQuaternions(tw.from.q, q, k);
    this.card.scale.lerpVectors(tw.from.s, sc, k);
    if (k >= 1) { this.tween = null; const ok = this.hold(tw.character, tw.who); tw.done(ok); }
  }

  clear() {
    if (this.tween) { const d = this.tween.done; this.tween = null; d(false); }
    if (this.walk) { const w = this.walk; this.walk = null; w.done(); }
    this.token = null;
    if (!this.card) return;
    const c = this.card;
    this.card = null;
    this.holder = null;
    c.removeFromParent();
    c.traverse((o) => { if (o.isMesh && !o.material.userData.shared) { o.material.map?.dispose(); o.material.dispose(); } });
    this.log.push("clear");
  }

  // mỗi khung: người chơi bước đi khi đang đưa / nhận thẻ (hội thoại đã đóng) → cất thẻ, về đi / đứng ngay (không trượt trong
  // tư thế đưa tay)
  update(dt = 0) {
    this.stepTween(dt);
    this.stepWalk(dt);
    const g = this.g, ch = g.player?.character;
    if (!this.token || this.walk || g.mode !== "play" || !(g.player?.speed > 0.15)) return;
    this.clear();
    if (ch && !ch.loco && ch.current?.getClip().name === (ch.model.animations?.reach ?? "reach")) ch.enableLocomotion();
    this.log.push("walk_away");
  }

  // chờ ms, false nếu đã bị huỷ (đổi zone, lần mới)
  wait(ms, token) { return new Promise((r) => setTimeout(() => r(this.token === token), ms)); }

  // người chơi bước tới đứng trước vật `name` (đầu đọc thẻ gắn tường), cách `dist` m theo pháp tuyến mặt đầu đọc, quay mặt vào —
  // trượt êm trong `ms` (quãng ngắn trong hành lang, không xét va chạm). → toạ độ tâm vật (null: không có trong zone)
  stepTo(name, dist, ms) {
    const g = this.g, obj = name && g.zone?.root.getObjectByName(name);
    if (!obj || !g.player) return Promise.resolve(null);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const p = g.player.position;
    // pháp tuyến mặt đầu đọc: trục mỏng nhất (ngang) của hộp bao, hướng về phía người chơi
    const n = size.x < size.z ? new THREE.Vector3(Math.sign(p.x - c.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(p.z - c.z) || 1);
    // đứng thẳng trước mặt đầu đọc, lệch sang trái 15 cm → bàn tay phải (clip reach: tay cách giữa người ~0,15 m) ngay trước đầu đọc
    const right = new THREE.Vector3().crossVectors(n.clone().negate(), new THREE.Vector3(0, 1, 0));
    const to = new THREE.Vector3(c.x, p.y, c.z).addScaledVector(n, dist).addScaledVector(right, -0.15);
    g.faceTarget = c.clone();
    return new Promise((done) => { this.walk = { t: 0, dur: ms / 1000, from: p.clone(), to, done: () => done(c) }; });
  }

  stepWalk(dt) {
    const w = this.walk, pl = this.g.player;
    if (!w || !pl) return;
    w.t += dt;
    const k = THREE.MathUtils.smoothstep(Math.min(1, w.t / w.dur), 0, 1);
    pl.body.teleport(w.from.clone().lerp(w.to, k));
    pl.sync?.();
    if (k >= 1) { this.walk = null; w.done(); }
  }

  async play(kind, opt = {}) {
    this.clear();
    const token = (this.token = {});
    const g = this.g, zone = g.state.zone;
    const player = g.player?.character;
    try {
      this.card = await this.make();
    } catch (e) { console.warn("[thẻ nhân viên] không tải được mô hình thẻ:", e?.message || e); return; }
    if (this.token !== token || g.state.zone !== zone) { this.clear(); return; }
    this.log.push(kind);
    this.stats[kind] = (this.stats[kind] || 0) + 1;
    const reach = async (ch) => { if (!ch?.actions[ch.model.animations?.reach ?? "reach"]) return; await ch.playOnce("reach", { fade: 0.25 }); };
    if (kind === "give") {
      const n = g.npc("le_tan");
      if (!n || !this.hold(n.character, "le_tan")) return this.clear();
      // lễ tân đưa thẻ (clip reach của chị do hội thoại gọi: speaker le_tan, anim reach — clip của chị dài hơn, tay vươn qua
      // mặt quầy cao 1,12 m) → giữa chừng người chơi đưa tay nhận → cuối clip của chị thẻ trượt sang tay người chơi
      const her = (n.character.model.durations_s?.reach ?? 2.8) * 1000;
      if (!(await this.wait(her * 0.45, token))) return;
      const take = reach(player);
      if (!(await this.wait(her * 0.55, token))) return;
      if (player && await this.flyTo(player, "player", 450)) { this.log.push("handover"); this.stats.handover++; }
      if (this.token !== token) return;
      await take;
      if (!(await this.wait(500, token))) return;
      this.clear();
      if (player && !player.disposed && player.current?.getClip().name === (player.model.animations?.reach ?? "reach")) player.enableLocomotion();
    } else if (kind === "tap") {
      // bước tới trước đầu đọc (data: card.reader, card.stand_m) rồi mới rút thẻ đưa vào
      if (opt.reader) { await this.stepTo(opt.reader, opt.stand_m ?? 0.55, 600); if (this.token !== token) return; }
      if (!player || !this.hold(player, "player")) return this.clear();
      await reach(player);
      if (!(await this.wait(400, token))) return;
      this.clear();
      if (!player.disposed) player.enableLocomotion();
    }
  }
}
