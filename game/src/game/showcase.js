// Nền màn tiêu đề (Game.showcase → game/src/ui/title.js): zone đầu đã dựng xong nhưng chưa có người chơi / NPC / trigger —
// camera trôi chậm theo kịch bản SHOTS của zone, đi rồi về (êm ở hai đầu), lặp mãi; chuột nghiêng nhẹ (parallax). Zone
// không có kịch bản (vd ?start=zone_05, đã xong game → bến xe zone_01 hoàng hôn): camera chơi (ThirdPersonCamera, tránh
// tường / trần) quay chậm quanh SPAWN_ đầu zone như có người đứng đó. Start → Game._enterZone dùng lại zone này (không tải
// lại GLB). __game.preview: trạng thái (zone, kịch bản, giây, vị trí camera).
import * as THREE from "three";
import { worldPos } from "../world/zone.js";

// Kịch bản theo zone (toạ độ glTF, m): camera from → to, điểm nhìn look_from → look_to, fov (độ), period = giây một chiều.
// zone_00 06:30: từ góc cao bên đường (thấy cả 3 xe, nhà chờ, phố mờ sương) đẩy xuống thấp dọc hàng xe rồi lùi lại.
export const SHOTS = {
  zone_00: { from: [16, 5.5, 10], to: [11.5, 3.0, 7.5], look_from: [-6, 0.6, 0], look_to: [-22, 1.2, 2], fov: 48, period: 28 },
};
const ORBIT = { distance: 5.5, pitch: 0.26, yaw_rate: 0.025 };   // zone không có kịch bản: quay quanh SPAWN_ (rad/s)
const PARALLAX = { yaw: 0.035, pitch: 0.025 };                    // rad nghiêng tối đa theo chuột
const smooth = (k) => k * k * (3 - 2 * k);

export class Showcase {
  constructor({ zone, camera, cam, spawnName }) {
    Object.assign(this, { zone, camera, cam });
    this.shot = SHOTS[zone.id] || null;
    this.t = 0;
    this.fov0 = camera.fov;
    this.par = new THREE.Vector2();
    this.parTarget = new THREE.Vector2();
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._look = new THREE.Vector3();
    const spawn = zone.spawns.get(spawnName) ?? zone.spawns.values().next().value;
    this.anchor = spawn ? worldPos(spawn) : new THREE.Vector3();
    if (!this.shot) { cam.behind(spawn?.userData.yaw_deg ?? 0); cam.distance = ORBIT.distance; cam.pitch = ORBIT.pitch; }
    this.update(0, true);
  }

  // chuột: x, y trong −1..1 (giữa màn = 0) → camera nghiêng nhẹ về phía đó
  parallax(x, y) { this.parTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)); }

  update(dt, snap = false) {
    this.t += dt;
    this.par.lerp(this.parTarget, snap ? 1 : Math.min(1, dt * 3));
    const s = this.shot;
    if (s) {
      const u = (this.t / s.period) % 2, k = smooth(u <= 1 ? u : 2 - u);
      this.camera.position.fromArray(s.from).lerp(this._a.fromArray(s.to), k);
      this._look.fromArray(s.look_from).lerp(this._b.fromArray(s.look_to), k);
      this.camera.lookAt(this._look);
      if (this.camera.fov !== s.fov) { this.camera.fov = s.fov; this.camera.updateProjectionMatrix(); }
    } else {
      // ThirdPersonCamera: yaw -= dx × 0,005 mỗi lần gọi → dx theo dt để quay đều
      this.cam.update(dt, this.anchor, { dx: (ORBIT.yaw_rate * dt) / 0.005, dy: 0, wheel: 0 }, this.zone.collider, snap, this.zone.view);
    }
    this.camera.rotateY(-this.par.x * PARALLAX.yaw);
    this.camera.rotateX(-this.par.y * PARALLAX.pitch);
  }

  get info() {
    return { zone: this.zone.id, shot: !!this.shot, t: +this.t.toFixed(1), fov: this.camera.fov,
      cam: this.camera.position.toArray().map((v) => +v.toFixed(2)) };
  }

  // trả camera về như trước (fov); zone để lại cho _enterZone dùng tiếp hoặc dọn
  dispose() { this.camera.fov = this.fov0; this.camera.updateProjectionMatrix(); }
}
