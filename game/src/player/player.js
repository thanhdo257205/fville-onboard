// Người chơi: capsule (va chạm) + model + đi/chạy theo hướng camera. Tốc độ lấy từ characters.json (khớp animation).
import * as THREE from "three";
import { CapsuleBody } from "../world/collision.js";

const ACCEL = 10;          // m/s² — tăng/giảm tốc mượt

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
    const rot = this.character.root.rotation.y;
    this.character.dispose();
    this.character = character;
    character.enableLocomotion();
    character.root.rotation.y = rot;
    this.sync();
  }

  spawn(pos, yawDeg) {
    this.body.teleport(pos.clone().add(new THREE.Vector3(0, 0.05, 0)));
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.character.setSpeed(0);
    this.character.root.rotation.y = THREE.MathUtils.degToRad(yawDeg) + Math.PI;
    this.sync();
  }

  // capsule để nhân vật khác (Tú) tránh
  capsule() { const p = this.body.position; return { x: p.x, z: p.z, y: p.y, height: this.body.height, radius: this.body.radius }; }

  update(dt, input, cam, collider, obstacles = null) {
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
    // rơi khỏi bản đồ (lỗi va chạm) → về chỗ cũ
    if (this.body.position.y < -10) { this.body.teleport(before.setY(before.y + 1)); this.fellOut = (this.fellOut || 0) + 1; }
    this.sync();
  }

  sync() { this.character.root.position.copy(this.body.position); }
}
