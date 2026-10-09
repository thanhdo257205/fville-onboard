// Camera góc nhìn thứ ba: di chuột (con trỏ bị khoá) hoặc kéo chuột xoay quanh người chơi, lăn chuột đổi khoảng cách, không xuyên tường (COL_).
import * as THREE from "three";
import { clampCamera } from "../world/collision.js";

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;            // 0 = camera ở sau người chơi khi người chơi nhìn -Z
    this.pitch = 0.32;
    this.distance = 4.2;
    this.current = 4.2;      // khoảng cách thật sau khi tránh tường (mượt)
    this.target = new THREE.Vector3();
    this.height = 1.5;
  }
  // yaw theo hướng nhìn của người chơi (vd lúc xuất hiện)
  behind(yawDeg) { this.yaw = THREE.MathUtils.degToRad(yawDeg); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  dirOf(yaw, pitch = this.pitch) { return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)); }

  // Hướng camera lúc xuất hiện: ưu tiên ngay sau lưng; bị che (vd xe bus ngay sau SPAWN_zone_01_start → camera chỉ còn
  // ~1 m) thì xoay dần sang hai bên (±15°/bước, tối đa ±150°) tới hướng gần nhất mà "ống nhìn" rộng ~1 m tới vị trí
  // camera chuẩn trống hẳn. Xét cả COL_ lẫn mesh hiển thị ở gần (thân xe thật nhô ra ngoài hộp COL_).
  // Không có hướng nào trống hẳn → hướng thoáng nhất. Trả về số độ đã xoay.
  // skip(mesh): mesh không tính là vật che (vd tán cây — seeThrough tự làm mờ khi che người chơi)
  pickStartYaw(playerPos, zone, skip = null) {
    const tgt = new THREE.Vector3(playerPos.x, playerPos.y + this.height, playerPos.z);
    zone.root.updateMatrixWorld(true);
    const box = new THREE.Box3(), near = [];
    zone.root.traverse((o) => {
      if (o.isMesh && o.visible && !o.name.startsWith("COL_") && !skip?.(o) && box.setFromObject(o).distanceToPoint(tgt) < this.distance + 1) near.push(o);
    });
    const rc = new THREE.Raycaster();
    const PROBES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const clear = (yaw) => {            // phần trống nhỏ nhất (0..1) trên 5 tia: giữa, trái, phải, trên, dưới (lệch 0,5 m)
      const dir = this.dirOf(yaw), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      let m = 1;
      for (const [a, b] of PROBES) {
        const off = right.clone().multiplyScalar(a * 0.5).add(new THREE.Vector3(0, b * 0.3, 0));
        const from = tgt.clone().addScaledVector(off, 0.3);
        const to = tgt.clone().addScaledVector(dir, this.distance).add(off);
        const len = from.distanceTo(to);
        m = Math.min(m, clampCamera(zone.collider, from, to, 0) / len);
        rc.set(from, to.clone().sub(from).divideScalar(len));
        rc.far = len;
        const hit = rc.intersectObjects(near, false)[0];
        if (hit) m = Math.min(m, hit.distance / len);
      }
      return m;
    };
    // góc lệch nhỏ nhất mà camera lùi được ≥ OK_CLEAR khoảng cách (gần hơn thì clampCamera kéo vào — vẫn nhìn theo hướng
    // SPAWN_); không góc nào đạt thì lấy góc thoáng nhất
    const OK_CLEAR = 0.6;
    const base = this.yaw;
    let best = { d: 0, c: clear(base) };
    for (let d = 15; best.c < OK_CLEAR && d <= 150; d += 15) {
      for (const s of [-1, 1]) {
        const c = clear(base + THREE.MathUtils.degToRad(s * d));
        if (c > best.c + 0.02) best = { d: s * d, c };
        if (best.c >= OK_CLEAR) break;
      }
    }
    this.yaw = base + THREE.MathUtils.degToRad(best.d);
    this.startInfo = { offsetDeg: best.d, clear: +best.c.toFixed(2), meshes: near.length };
    this.occluders = near;              // mesh hiển thị quanh chỗ xuất hiện (để đặt Tú chỗ camera nhìn thấy)
    return best.d;
  }

  update(dt, playerPos, drag, collider, snap = false) {
    this.yaw -= drag.dx * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + drag.dy * 0.004, -0.25, 1.15);
    this.distance = THREE.MathUtils.clamp(this.distance + drag.wheel * 0.4, 2.2, 7);
    this.target.set(playerPos.x, playerPos.y + this.height, playerPos.z);
    const dir = this.dirOf(this.yaw);
    const want = this.target.clone().addScaledVector(dir, this.distance);
    const free = clampCamera(collider, this.target, want);
    // vào gần ngay khi bị che, lùi ra từ từ
    this.current = snap || free < this.current ? free : THREE.MathUtils.lerp(this.current, free, Math.min(1, dt * 4));
    this.camera.position.copy(this.target).addScaledVector(dir, this.current);
    this.camera.lookAt(this.target);
  }
}
