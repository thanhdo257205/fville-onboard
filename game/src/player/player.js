// Người chơi: capsule (va chạm) + model + đi/chạy theo hướng camera. Tốc độ lấy từ characters.json (khớp animation).
// Ngồi ghế (bàn làm việc zone 5, hành động hội thoại "sit:<SPAWN_>"): như NPC ngồi (game/src/characters/npc.js) — điểm
// đứng = chỗ ghế − models.<id>.seat.offset_xz_m (animation đưa mông lùi về ghế), sit_down rồi sit_type, nâng dần cho mông
// chạm mặt ghế thật (chair_height_m − seat.height_m); đang ngồi thì không đi lại được, stand_up để đứng dậy.
// Đứng dậy: điểm ngồi nằm lọt giữa bàn và ghế (capsule lồng vào COL_ bàn / ghế → đi đâu cũng kẹt — lỗi cũ) → trong lúc stand_up
// trượt dần ra chỗ trống gần nhất, ưu tiên trên đường về chỗ đứng trước khi ngồi (exitSpot).
import * as THREE from "three";
import { CapsuleBody, penetration } from "../world/collision.js";

const ACCEL = 10;          // m/s² — tăng/giảm tốc mượt
// chờ animation ngồi / đứng tối đa chừng này (giây) — khung trình duyệt ẩn thì mixer không chạy, vẫn không treo hội thoại
const SIT_WAIT_S = 4;
const FREE_PEN = 0.02;     // capsule lồng vào COL_ dưới chừng này (m) = chỗ trống (đứng trên sàn cũng chạm sàn ~0)

export class Player {
  constructor(character) {
    this.character = character;
    this.body = new CapsuleBody({ radius: character.model.collision?.radius_m ?? 0.3, height: character.model.height_m });
    this.velocity = new THREE.Vector3();      // vận tốc ngang hiện tại
    this.speed = 0;
    character.enableLocomotion();
  }
  get position() { return this.body.position; }

  // đổi model (vd đổi mức đồ hoạ: bản 6k ↔ 15k), giữ vị trí và hướng
  setCharacter(character) {
    this.leaveSeat();
    const rot = this.character.root.rotation.y;
    this.character.dispose();
    this.character = character;
    character.enableLocomotion();
    character.root.rotation.y = rot;
    this.sync();
  }

  spawn(pos, yawDeg) {
    this.leaveSeat();
    this.body.teleport(pos.clone().add(new THREE.Vector3(0, 0.05, 0)));
    this.safe = pos.clone();          // chỗ đứng vững gần nhất (rơi khỏi bản đồ → về đây)
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.character.setSpeed(0);
    this.character.root.rotation.y = THREE.MathUtils.degToRad(yawDeg) + Math.PI;
    this.sync();
  }

  // capsule để nhân vật khác (Tú) tránh
  capsule() { const p = this.body.position; return { x: p.x, z: p.z, y: p.y, height: this.body.height, radius: this.body.radius }; }

  // ---------- ngồi ghế ----------
  // chair: chỗ ghế (thế giới, y = sàn); yaw: hướng nhìn (root.rotation.y, model nhìn +Z); chairHeight: mặt ghế thật (m);
  // pose: clip khi đã ngồi — "sit_type" (gõ phím, bàn có máy tính) | "sit_idle" (ngồi yên, tay trên đùi; model thiếu → sit_type).
  // → Promise khi đã ngồi xong
  async sit(chair, yaw, chairHeight = null, pose = "sit_type") {
    if (this.seated) return;
    const ch = this.character, seat = ch.model.seat || {};
    const from = this.body.position.clone();          // chỗ đứng trước khi ngồi (đi tới được) → đứng dậy thì lùi về phía này
    const root = chair.clone();
    if (seat.offset_xz_m) {
      const [ox, oz] = seat.offset_xz_m, c = Math.cos(yaw), s = Math.sin(yaw);
      root.x -= ox * c + oz * s;
      root.z -= -ox * s + oz * c;
    }
    this.body.teleport(root);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    ch.root.rotation.y = yaw;
    const lift = chairHeight != null && seat.height_m != null ? chairHeight - seat.height_m : 0;
    const s = (this.seated = { baseY: root.y, lift, state: "sitting_down", from, seat: root.clone(), exit: null });
    this.sits = (this.sits || 0) + 1;
    this.sync();
    await waitMax(ch.playOnce("sit_down"));
    if (this.seated !== s) return;                     // đã đứng dậy / đổi zone trong lúc ngồi xuống
    ch.play(ch.actions[ch.model.animations?.[pose] ?? pose] ? pose : "sit_type", { fade: 0.2 });
    s.state = "seated";
  }
  async standUp() {
    const s = this.seated;
    if (!s || s.state === "standing_up") return;
    s.state = "standing_up";
    s.exit = this.exitSpot(s);
    await waitMax(this.character.playOnce("stand_up"));
    if (this.seated === s) this.leaveSeat();
  }
  // chỗ đứng dậy: điểm ngồi nếu trống; không thì điểm trống đầu tiên trên đường về chỗ đứng trước khi ngồi, rồi vòng quanh
  // điểm ngồi (0,3 … 1,5 m, 16 hướng); không có collider / không tìm được → về chỗ đứng trước khi ngồi
  exitSpot(s) {
    const col = this.collider, r = this.body.radius, h = this.body.height;
    if (!col) return s.from.clone();
    const free = (p) => penetration(col, p, r, h) < FREE_PEN;
    if (free(s.seat)) return s.seat.clone();
    const p = new THREE.Vector3();
    for (let t = 0.05; t <= 1.0001; t += 0.05) if (free(p.lerpVectors(s.seat, s.from, t))) return p.clone();
    for (let d = 0.3; d <= 1.5001; d += 0.1) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      p.set(s.seat.x + Math.sin(a) * d, s.seat.y, s.seat.z + Math.cos(a) * d);
      if (free(p)) return p.clone();
    }
    return s.from.clone();
  }
  // thôi ngồi ngay (không animation) — đổi zone, cảnh chuyển đặt lại người chơi
  leaveSeat() {
    if (!this.seated) return;
    const exit = this.seated.exit;
    this.seated = null;
    if (exit) { this.body.teleport(exit); this.body.onGround = true; }
    this.character.enableLocomotion(0.2);
    this.character.setSpeed(0);
    this.sync();
  }
  // mức "đang ngồi" 0..1 (nâng nhân vật lên mặt ghế, như Npc.seatedness)
  seatedness() {
    const s = this.seated, a = this.character.current;
    if (!s) return 0;
    const k = a ? Math.min(1, a.time / a.getClip().duration) : 1;
    return s.state === "seated" ? 1 : s.state === "standing_up" ? 1 - k : k;
  }

  update(dt, input, cam, collider, obstacles = null) {
    this.collider = collider;
    if (this.dancing) { this.character.update(dt); this.sync(); return; }
    if (this.seated) { this.character.update(dt); this.sync(); return; }      // đang ngồi: không đi lại, không trọng lực
    const { walk, run } = this.character.model.speed_mps;
    const want = new THREE.Vector3()
      .addScaledVector(cam.forward(), input.y)
      .addScaledVector(cam.right(), input.x);
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(input.run ? run : walk);
    // tiến dần tới vận tốc mong muốn
    const diff = want.clone().sub(this.velocity);
    const maxStep = ACCEL * (input.run ? 1.6 : 1) * dt;
    if (diff.length() > maxStep) diff.setLength(maxStep);
    this.velocity.add(diff);
    const before = this.body.position.clone();
    this.body.lastPush = 0;
    this.body.step(dt, this.velocity, collider, obstacles);
    // tốc độ thật (sau va chạm) điều khiển animation → chạm tường thì đứng lại, không chạy tại chỗ
    const moved = Math.hypot(this.body.position.x - before.x, this.body.position.z - before.z) / Math.max(dt, 1e-4);
    this.speed = THREE.MathUtils.lerp(this.speed, Math.min(moved, this.velocity.length()), Math.min(1, dt * 12));
    if (want.lengthSq() > 1e-4) this.character.faceDir(want, dt);
    this.character.setSpeed(this.speed);
    this.character.update(dt);
    // rơi khỏi bản đồ (lỗi va chạm) → về chỗ đứng vững gần nhất. Trước đây về "vị trí khung trước + 1 m" — đã ở dưới sàn
    // từ lâu (y ≈ −9) nên rơi mãi quanh y −9 … −10, không lên lại được
    if (this.body.onGround) (this.safe ??= new THREE.Vector3()).copy(this.body.position);
    else if (this.body.position.y < -10) {
      this.body.teleport(this.safe ? this.safe.clone().add(new THREE.Vector3(0, 0.05, 0)) : before.setY(before.y + 1));
      this.velocity.set(0, 0, 0);
      this.fellOut = (this.fellOut || 0) + 1;
    }
    this.sync();
  }

  sync() {
    this.character.root.position.copy(this.body.position);
    const s = this.seated;
    if (s?.lift) this.character.root.position.y = s.baseY + s.lift * THREE.MathUtils.smoothstep(this.seatedness(), 0, 1);
    // đang đứng dậy: trượt dần từ điểm ngồi ra chỗ trống
    if (s?.exit && s.state === "standing_up") {
      const k = THREE.MathUtils.smoothstep(1 - this.seatedness(), 0, 1);
      this.character.root.position.x = THREE.MathUtils.lerp(s.seat.x, s.exit.x, k);
      this.character.root.position.z = THREE.MathUtils.lerp(s.seat.z, s.exit.z, k);
    }
  }
}

const waitMax = (p) => Promise.race([p, new Promise((r) => setTimeout(r, SIT_WAIT_S * 1000))]);
