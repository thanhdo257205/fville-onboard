// Camera hội thoại: nói chuyện với NPC / Tú → camera chuyển êm (0,4 s) sang góc qua vai người chơi, nhìn vào mặt người
// đối thoại: người đối thoại cao khoảng 1/3 khung hình, đứng ở 1/3 khung bên kia (vai người chơi ở mép khung phía trước),
// mặt ở đường 1/3 trên, chân nằm trên hộp thoại. Camera nằm trên đường thẳng từ mặt người đối thoại qua điểm cạnh vai
// người chơi (cách 0,6 m) → tia nhìn đi bên cạnh người chơi, người chơi không che. Không xuyên tường / quầy: lùi dọc
// đường đó, chạm COL_ (BVH va chạm sẵn có) thì dừng trước chỗ chạm (thu gần lại). Vai trái / phải: bên nào lùi được xa
// hơn, không bị Tú / NPC khác che; gần bằng nhau thì giữ bên camera đang đứng (đỡ quay nhiều).
// Camera không thấp hơn tầm mắt người chơi (vd bác tài đứng trên bậc xe cao 1 m: đường thẳng qua vai đổ dốc xuống, thân
// xe che mất). Chọn góc: 2 vai × 2 độ cao, chấm điểm theo khoảng lùi được, mặt / ngực người đối thoại có bị bối cảnh
// (mesh hiển thị có BVH, trừ cây vì cây tự mờ) hay Tú / NPC khác che không.
// Vật cản khi đặt camera: COL_, mesh hiển thị (mái hiên, biển hiệu… không có COL_) và tán cây / chậu cây của seeThrough —
// không đặt camera bên trong hay sát (< 0,15 m) bề mặt nào, không lùi qua chúng (thu gần lại). Góc hợp lệ: thấy mặt, điểm
// qua vai và camera không nằm trong vật / tán cây, camera lùi được ít nhất 0,3 m. Không góc nào hợp lệ → giữ camera chơi.
// Đóng hội thoại → chuyển êm về camera chơi (yaw / pitch / khoảng cách giữ nguyên như trước khi mở).
import * as THREE from "three";
import { blocked } from "../world/collision.js";

const BLEND_S = 0.4;          // thời gian chuyển
const FRAME_FRAC = 1 / 3;     // chiều cao người đối thoại / chiều cao khung hình
const FACE_AT = [1 / 3, 1 / 3];   // mặt người đối thoại trên màn hình: [cách mép bên (phía không có người chơi), cách mép trên]
const SHOULDER = 0.6;         // điểm qua vai: lệch ngang so với đầu người chơi (m)
const EYE = 0.9;              // độ cao điểm qua vai / chiều cao người chơi
const MIN_BACK = 0.8;         // camera lùi sau điểm qua vai ít nhất (m) khi không bị chắn
const MAX_DIST = 6;           // camera cách mặt người đối thoại tối đa (m)
const PAD = 0.2;              // dừng trước tường / quầy
const LIFTS = [0, 0.5];       // phương án độ cao camera (m, cộng thêm): người đối thoại đứng cao / sau cửa xe → thử nâng
const CLEAR = 0.15;           // camera / điểm qua vai cách bề mặt gần nhất ít nhất (m)
const MIN_FREE = 0.3;         // camera lùi sau điểm qua vai ít nhất (m) khi bị chắn — ít hơn thì góc đó không dùng

const UP = new THREE.Vector3(0, 1, 0);
const _ray = new THREE.Ray();
const _v = new THREE.Vector3();

// các BVH vật cản của zone: COL_, lưới mesh hiển thị (zone.view), tán cây (seeThrough)
const bvhs = (env) => [env.collider?.geometry.boundsTree, env.view?.geometry.boundsTree, env.see?.bvh].filter(Boolean);

// khoảng trống (m) từ a theo hướng tới b trước khi chạm vật cản (không có giới hạn tối thiểu như clampCamera)
function freeAlong(env, a, b, all = true) {
  const d = _v.subVectors(b, a), L = d.length();
  if (L < 1e-4) return 0;
  _ray.set(a, d.divideScalar(L));
  let near = L + PAD;
  for (const bvh of all ? bvhs(env) : [env.collider.geometry.boundsTree]) {
    const hit = bvh.raycastFirst(_ray, THREE.DoubleSide, 0, L);
    if (hit) near = Math.min(near, hit.distance);
  }
  return Math.max(0, Math.min(L, near - PAD));
}

// khoảng cách từ p tới bề mặt vật cản gần nhất (≤ 1 m)
function clearance(env, p) {
  let best = Infinity;
  for (const bvh of bvhs(env)) { const h = bvh.closestPointToPoint(p, {}, 0, 1); if (h) best = Math.min(best, h.distance); }
  return best;
}

// khoảng cách ngắn nhất giữa đoạn p→q và trục đứng của capsule c ({x, z, y, height})
function segToCapsule(p, q, c) {
  const a = new THREE.Vector3(c.x, c.y + 0.3, c.z), b = new THREE.Vector3(c.x, c.y + c.height - 0.15, c.z);
  const s1 = new THREE.Line3(p, q), s2 = new THREE.Line3(a, b);
  let best = Infinity;
  for (let i = 0; i <= 16; i++) {            // lấy mẫu đủ chính xác cho việc chọn vai
    const pt = s1.at(i / 16, new THREE.Vector3());
    best = Math.min(best, s2.closestPointToPoint(pt, true, new THREE.Vector3()).distanceTo(pt));
  }
  return best;
}

const ease = (t) => t * t * (3 - 2 * t);

export class TalkCamera {
  constructor(camera) {
    this.camera = camera;
    this.partner = null;      // { character } — NPC hoặc Tú
    this.side = 1;            // +1 qua vai phải người chơi, −1 vai trái
    this.lift = 0;            // nâng camera thêm (m)
    this.goal = 0;            // 0 = camera chơi, 1 = camera hội thoại
    this.from = null;         // tư thế lúc bắt đầu chuyển { pos, look, w }
    this.t = 1;               // tiến độ chuyển 0..1
    this.cur = { pos: new THREE.Vector3(), look: new THREE.Vector3(), w: 0 };   // tư thế đang hiện (w = tỉ lệ hội thoại)
    this.info = null;
  }

  get active() { return !!this.partner && (this.goal === 1 || this.t < 1); }

  // ctx: { player (Player), env: { collider, view, see }, obstacles: capsule NPC khác / Tú }
  engage(partner, ctx) {
    if (this.goal === 1 && this.partner === partner) return;
    const prev = this.partner;
    this.partner = partner;
    if (!this.pick(ctx)) { this.partner = prev; return; }   // không góc nào thấy mặt → giữ camera
    this.goal = 1;
    this.from = { pos: this.cur.pos.clone(), look: this.cur.look.clone(), w: this.cur.w };
    this.t = 0;
  }

  release() {
    if (this.goal === 0) return;
    this.goal = 0;
    this.from = { pos: this.cur.pos.clone(), look: this.cur.look.clone(), w: this.cur.w };
    this.t = 0;
  }

  // chuyển zone: bỏ ngay (nhân vật cũ đã bị dọn)
  reset() { this.partner = null; this.goal = 0; this.t = 1; this.from = null; this.env = null; }

  // camera riêng của mini-game (chụp ảnh) vừa điều khiển → chuyển tiếp từ chỗ camera đang đứng
  overridden() { this._overridden = true; }

  // tư thế hội thoại cho vai `side`, nâng `lift` → { pos, look, shoulder, face, free, want }
  pose(side, lift, player, env) {
    const ch = this.partner.character, q = ch.root.position, H = ch.model.height_m;
    const P = player.position, ph = player.character.model.height_m;
    const f = new THREE.Vector3(q.x - P.x, 0, q.z - P.z);
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    const right = new THREE.Vector3().crossVectors(f, UP);
    const face = new THREE.Vector3(q.x, q.y + H * 0.93, q.z);
    const shoulder = new THREE.Vector3(P.x, P.y + ph * EYE, P.z).addScaledVector(right, side * SHOULDER);
    const dir = shoulder.clone().sub(face);
    const toShoulder = dir.length();
    dir.divideScalar(toShoulder);
    const fovY = THREE.MathUtils.degToRad(this.camera.fov);
    let want = H / (FRAME_FRAC * 2 * Math.tan(fovY / 2));          // khoảng cách để cao 1/3 khung
    want = THREE.MathUtils.clamp(want, toShoulder + MIN_BACK, Math.max(MAX_DIST, toShoulder + MIN_BACK));
    const desired = face.clone().addScaledVector(dir, want);
    desired.y = Math.max(desired.y, shoulder.y) + lift;               // không nhìn từ dưới tầm mắt lên
    const back = desired.clone().sub(shoulder), full = back.length();
    const free = freeAlong(env, shoulder, desired);                   // bị chắn (tường, mái hiên, tán cây) → thu gần lại
    const pos = shoulder.clone().addScaledVector(back.divideScalar(full), free);
    const look = this.aim(pos, face, side);
    return { pos, look, shoulder, face, free, want: full };
  }

  // hướng nhìn để mặt nằm ở FACE_AT (phía không có người chơi): tính theo góc, chỉnh lại 1 lần bằng phép chiếu thật
  aim(pos, face, side) {
    const cam = this.camera, tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), tanX = tanY * cam.aspect;
    const ndcX = side * (1 - 2 * FACE_AT[0]), ndcY = 1 - 2 * FACE_AT[1];   // vai phải → người đối thoại lệch phải
    const d = face.clone().sub(pos).normalize();
    let az = Math.atan2(d.x, d.z) + Math.atan(ndcX * tanX), el = Math.asin(d.y) - Math.atan(ndcY * tanY);
    const look = new THREE.Vector3();
    const set = () => look.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).add(pos);
    set();
    const saved = { p: cam.position.clone(), q: cam.quaternion.clone() };
    cam.position.copy(pos); cam.lookAt(look); cam.updateMatrixWorld();
    const s = face.clone().project(cam);
    az += Math.atan((ndcX - s.x) * tanX) * 0.9;
    el -= Math.atan((ndcY - s.y) * tanY) * 0.9;
    set();
    cam.position.copy(saved.p); cam.quaternion.copy(saved.q); cam.updateMatrixWorld();
    return look;
  }

  // chọn vai + độ cao → true nếu có góc hợp lệ (thấy mặt, không nằm trong vật / tán cây)
  pick({ player, env, obstacles = [] }) {
    this.env = env;
    const view = env.view;
    const t0 = performance.now();
    const cur = this.camera.position, P = player.position;
    const ch = this.partner.character, q = ch.root.position, H = ch.model.height_m;
    const f = new THREE.Vector3(q.x - P.x, 0, q.z - P.z).normalize(), right = new THREE.Vector3().crossVectors(f, UP);
    const camSide = Math.sign(right.dot(new THREE.Vector3(cur.x - P.x, 0, cur.z - P.z))) || 1;
    const head = new THREE.Vector3(P.x, P.y + player.character.model.height_m * EYE, P.z);
    // điểm trên người đối thoại bị bối cảnh che (blocked: bỏ 0,3 m sát người — quầy ngay trước mặt không tính)
    const at = (y) => new THREE.Vector3(q.x, q.y + H * y, q.z);
    const hidden = (from, y) => !!view && blocked(view, from, at(y));
    const score = (side, lift) => {
      const p = this.pose(side, lift, player, env);
      let s = Math.min(1, p.free / Math.max(p.want, 1e-3));                   // lùi được bao nhiêu so với mong muốn
      // góc không dùng được: điểm qua vai sau vật / trong tán, camera sát bề mặt / trong tán, lùi chưa được 0,3 m, không thấy mặt
      const why = [];
      if (freeAlong(env, head, p.shoulder) + PAD < p.shoulder.distanceTo(head) - 1e-3 || clearance(env, p.shoulder) < CLEAR / 2 || env.see?.containing(p.shoulder)) why.push("vai");
      if (clearance(env, p.pos) < CLEAR || env.see?.containing(p.pos)) why.push("sát vật");
      if (p.free < MIN_FREE) why.push("không lùi được");
      const faceHidden = hidden(p.pos, 0.93);
      if (faceHidden) { s -= 1.5; why.push("không thấy mặt"); }              // mặt bị che
      if (hidden(p.pos, 0.7)) s -= 0.5;                                       // ngực bị che
      for (const o of obstacles) {                                            // Tú / NPC khác che mặt / ngực
        if (!o) continue;
        if (segToCapsule(p.pos, p.face, o) < o.radius + 0.08) s -= 1;
        if (segToCapsule(p.pos, at(0.7), o) < o.radius + 0.05) s -= 0.5;
      }
      if (side === camSide) s += 0.15;
      if (side === 1) s += 0.05;
      if (lift === 0) s += 0.1;
      return { s, why };
    };
    let best = null;
    const all = {};
    for (const side of [1, -1]) for (const lift of LIFTS) {
      const { s, why } = score(side, lift);
      all[`${side > 0 ? "R" : "L"}${lift}`] = why.length ? why.join("+") : +s.toFixed(2);
      if (!why.length && (!best || s > best.s)) best = { s, side, lift };
    }
    this.info = { ...all, camSide, ok: !!best, ms: +(performance.now() - t0).toFixed(1) };
    if (!best) return false;
    this.side = best.side;
    this.lift = best.lift;
    return true;
  }

  // gọi mỗi khung sau khi camera chơi đã cập nhật (camera đang ở tư thế chơi, nhìn vào `gameLook`)
  apply(dt, gameLook, { player, env }) {
    const cam = this.camera;
    if (this._overridden) {        // mini-game vừa đặt camera riêng → chuyển tiếp từ đó
      this._overridden = false;
      const fwd = cam.getWorldDirection(new THREE.Vector3());
      this.cur.pos.copy(cam.position); this.cur.look.copy(cam.position).addScaledVector(fwd, 3);
      if (this.active) { this.from = { pos: this.cur.pos.clone(), look: this.cur.look.clone(), w: this.cur.w }; this.t = 0; }
    }
    if (!this.active) {
      this.cur.pos.copy(cam.position); this.cur.look.copy(gameLook); this.cur.w = 0;
      return;
    }
    this.t = Math.min(1, this.t + dt / BLEND_S);
    const e = ease(this.t);
    let pos, look, w;
    const talk = this.partner && this.env ? this.pose(this.side, this.lift, player, this.env) : null;
    const shoulder = talk?.shoulder;
    if (this.goal === 1) ({ pos, look } = talk);
    else { pos = cam.position.clone(); look = gameLook.clone(); }
    if (this.t < 1) {
      pos = this.from.pos.clone().lerp(pos, e);
      look = this.from.look.clone().lerp(look, e);
      w = THREE.MathUtils.lerp(this.from.w, this.goal, e);
      // giữa chừng cũng không xuyên tường: kéo vào theo đoạn từ điểm nhìn trung gian (đầu người chơi ↔ điểm qua vai)
      const P = player.position;
      const head = new THREE.Vector3(P.x, P.y + player.character.model.height_m * EYE, P.z);
      const pivot = shoulder ? head.lerp(shoulder, w) : head;
      const free = freeAlong(env, pivot, pos, false), L = pivot.distanceTo(pos);   // chỉ COL_ như camera chơi (2 đầu khớp)
      if (free < L) pos = pivot.clone().add(pos.clone().sub(pivot).multiplyScalar(free / L));
    } else w = this.goal;
    cam.position.copy(pos);
    cam.lookAt(look);
    this.cur.pos.copy(pos); this.cur.look.copy(look); this.cur.w = w;
    if (this.goal === 0 && this.t >= 1) this.partner = null;
  }
}
