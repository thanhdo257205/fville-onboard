// Camera hội thoại: nói chuyện với NPC / Tú → camera chuyển êm (0,4 s) sang góc qua vai người chơi, nhìn vào mặt người
// đối thoại: người đối thoại cao khoảng 1/3 khung hình, đứng ở 1/3 khung bên kia (vai người chơi ở mép khung phía trước),
// mặt ở đường 1/3 trên, chân nằm trên hộp thoại. Camera nằm trên đường thẳng từ mặt người đối thoại qua điểm cạnh vai
// người chơi (cách 0,6 m) → tia nhìn đi bên cạnh người chơi, người chơi không che. Không xuyên tường / quầy: lùi dọc
// đường đó, chạm COL_ (BVH va chạm sẵn có) thì dừng trước chỗ chạm (thu gần lại). Vai trái / phải: bên nào lùi được xa
// hơn, không bị Tú / NPC khác che; gần bằng nhau thì giữ bên camera đang đứng (đỡ quay nhiều).
// Camera không thấp hơn tầm mắt người chơi (vd bác tài đứng trên bậc xe cao 1 m: đường thẳng qua vai đổ dốc xuống, thân
// xe che mất). Chọn góc: 2 vai × 2 độ cao, chấm điểm theo khoảng lùi được, mặt / ngực người đối thoại có bị bối cảnh
// (mesh hiển thị có BVH, trừ cây vì cây tự mờ) hay Tú / NPC khác che không. Không góc nào thấy mặt (vd bác tài zone_01
// đứng trong vỏ xe kín) → giữ camera chơi.
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

const UP = new THREE.Vector3(0, 1, 0);
const _ray = new THREE.Ray();
const _v = new THREE.Vector3();

// khoảng trống (m) từ a theo hướng tới b trước khi chạm COL_ (không có giới hạn tối thiểu như clampCamera)
function freeAlong(collider, a, b) {
  const d = _v.subVectors(b, a), L = d.length();
  if (L < 1e-4) return 0;
  _ray.set(a, d.divideScalar(L));
  const hit = collider.geometry.boundsTree.raycastFirst(_ray, THREE.DoubleSide, 0, L);
  return hit ? Math.max(0, hit.distance - PAD) : L;
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

  // ctx: { player (Player), collider, obstacles: capsule NPC khác / Tú, view: lưới bối cảnh có BVH (che tầm nhìn) }
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
  reset() { this.partner = null; this.goal = 0; this.t = 1; this.from = null; }

  // camera riêng của mini-game (chụp ảnh) vừa điều khiển → chuyển tiếp từ chỗ camera đang đứng
  overridden() { this._overridden = true; }

  // tư thế hội thoại cho vai `side`, nâng `lift` → { pos, look, shoulder, face, free, want }
  pose(side, lift, player, collider) {
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
    const free = freeAlong(collider, shoulder, desired);              // bị chắn → thu gần lại
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

  // chọn vai + độ cao → true nếu có góc thấy mặt người đối thoại
  pick({ player, collider, obstacles = [], view = null }) {
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
      const p = this.pose(side, lift, player, collider);
      let s = Math.min(1, p.free / Math.max(p.want, 1e-3));                   // lùi được bao nhiêu so với mong muốn
      if (freeAlong(collider, head, p.shoulder) < p.shoulder.distanceTo(head) - 1e-3) s -= 2;   // điểm qua vai sau tường
      const faceHidden = hidden(p.pos, 0.93);
      if (faceHidden) s -= 1.5;                                               // mặt bị che
      if (hidden(p.pos, 0.7)) s -= 0.5;                                       // ngực bị che
      for (const o of obstacles) {                                            // Tú / NPC khác che mặt / ngực
        if (!o) continue;
        if (segToCapsule(p.pos, p.face, o) < o.radius + 0.08) s -= 1;
        if (segToCapsule(p.pos, at(0.7), o) < o.radius + 0.05) s -= 0.5;
      }
      if (side === camSide) s += 0.15;
      if (side === 1) s += 0.05;
      if (lift === 0) s += 0.1;
      return s;
    };
    let best = null;
    const all = {};
    for (const side of [1, -1]) for (const lift of LIFTS) {
      const s = score(side, lift);
      all[`${side > 0 ? "R" : "L"}${lift}`] = +s.toFixed(2);
      if (!best || s > best.s) best = { s, side, lift, seen: !hidden(this.pose(side, lift, player, collider).pos, 0.93) };
    }
    this.info = { ...all, camSide, seen: best.seen, ms: +(performance.now() - t0).toFixed(1) };
    if (!best.seen) return false;
    this.side = best.side;
    this.lift = best.lift;
    return true;
  }

  // gọi mỗi khung sau khi camera chơi đã cập nhật (camera đang ở tư thế chơi, nhìn vào `gameLook`)
  apply(dt, gameLook, { player, collider }) {
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
    const talk = this.partner ? this.pose(this.side, this.lift, player, collider) : null;
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
      const free = freeAlong(collider, pivot, pos), L = pivot.distanceTo(pos);
      if (free < L) pos = pivot.clone().add(pos.clone().sub(pivot).multiplyScalar(free / L));
    } else w = this.goal;
    cam.position.copy(pos);
    cam.lookAt(look);
    this.cur.pos.copy(pos); this.cur.look.copy(look); this.cur.w = w;
    if (this.goal === 0 && this.t >= 1) this.partner = null;
  }
}
