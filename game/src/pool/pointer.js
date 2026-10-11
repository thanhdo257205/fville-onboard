// Con trỏ / ngón tay trên mặt bàn bi-a: đổi toạ độ màn hình → điểm trên mặt bàn (toạ độ cục bộ của bàn, mặt phẳng tâm bi)
// rồi báo cho bàn (./table.js) qua 3 callback:
//   move(pt, e)  di chuyển (chưa bấm hoặc đang giữ) · down(pt, e)  bấm nút chính / chạm · up(pt, e)  thả / nhấc / huỷ
// pt = { x, z } hoặc null (tia không cắt mặt bàn, vd chỉ lên trên đường chân trời).
// Hiện chỉ nhận chuột (types = ["mouse"]). Cảm ứng sau này: thêm "touch" / "pen" vào types — cùng một luồng (chạm = down, kéo
// = move, nhấc = up; giữ pointer capture để kéo ra ngoài khung vẫn nhận move / up), bàn chỉ cần quyết cử chỉ nào ngắm / nạp lực.
// Khi con trỏ đang khoá (Pointer Lock) trình duyệt vẫn gửi pointerdown / up vào canvas nhưng clientX đứng yên — bàn tự bỏ
// qua điểm chiếu lúc đó (xoay cơ theo movementX như cũ, core/input.js).
import * as THREE from "three";

export class TablePointer {
  // canvas: khung vẽ game · camera: camera đang vẽ · root: node pool_table (toạ độ cục bộ của bàn) · y: độ cao tâm bi (cục bộ)
  constructor({ canvas, camera, root, y, onMove, onDown, onUp, types = ["mouse"] }) {
    Object.assign(this, { canvas, camera, root, y, onMove, onDown, onUp, types });
    this.lastType = null;     // loại con trỏ vừa dùng ("mouse" / "touch"…) — bàn phân biệt kéo chuột với kéo ngón tay
    this.down = false;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane();
    this.hit = new THREE.Vector3();
    const wrap = (fn, kind) => (e) => {
      if (!this.types.includes(e.pointerType)) return;
      this.lastType = e.pointerType;
      if (kind === "down") {
        if (e.button !== 0) return;
        this.down = true;
        if (e.pointerType !== "mouse") this.canvas.setPointerCapture?.(e.pointerId);
      } else if (kind === "up") {
        if (!this.down) return;
        this.down = false;
      }
      fn?.(this.point(e.clientX, e.clientY), e);
    };
    this.handlers = [
      [canvas, "pointermove", wrap((pt, e) => this.onMove?.(pt, e), "move")],
      [canvas, "pointerdown", wrap((pt, e) => this.onDown?.(pt, e), "down")],
      [window, "pointerup", wrap((pt, e) => this.onUp?.(pt, e), "up")],          // thả ngoài khung vẫn nhận
      [window, "pointercancel", wrap((pt, e) => this.onUp?.(pt, e), "up")],
    ];
  }
  attach() { for (const [el, type, fn] of this.handlers) el.addEventListener(type, fn); return this; }
  detach() { for (const [el, type, fn] of this.handlers) el.removeEventListener(type, fn); this.down = false; }

  // toạ độ màn hình (clientX / Y) → điểm trên mặt phẳng tâm bi, toạ độ cục bộ của bàn; null nếu tia không cắt mặt phẳng
  point(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(this.ndc, this.camera);
    this.root.updateWorldMatrix(true, false);
    const normal = new THREE.Vector3(0, 1, 0).transformDirection(this.root.matrixWorld);
    const onPlane = this.root.localToWorld(new THREE.Vector3(0, this.y, 0));
    this.plane.setFromNormalAndCoplanarPoint(normal, onPlane);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return null;
    const p = this.root.worldToLocal(this.hit.clone());
    return { x: p.x, z: p.z };
  }
  // ngược lại: điểm cục bộ (x, z) trên mặt bàn → toạ độ màn hình (kiểm thử: di chuột tới đúng chỗ)
  screen(x, z) {
    const r = this.canvas.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    const v = this.root.localToWorld(new THREE.Vector3(x, this.y, z)).project(this.camera);
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, visible: v.z > -1 && v.z < 1 };
  }
}
