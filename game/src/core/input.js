// Bàn phím + chuột. Đang chơi: khoá con trỏ (Pointer Lock) → di chuột để xoay camera, con trỏ ẩn; mở hội thoại /
// app / mini-game / menu thì nhả khoá để bấm được. Không khoá được (vd cảm ứng) → kéo để xoay như cũ.
// `override` cho phép __game giả lập phím khi tự kiểm tra.
const LOCK_SCALE = 0.5;    // độ nhạy chuột khi khoá so với kéo (camera nhân 0,005 rad/px)
const MAX_MOVE = 200;      // bỏ cú nhảy movementX/Y bất thường (Chrome trên Windows thỉnh thoảng gửi)
const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.drag = { dx: 0, dy: 0, wheel: 0 };
    this.override = null;
    this.enabled = true;
    this.handlers = {};          // phím đơn: Escape, Tab, E…  → callback
    this.lookActive = false;     // game đang ở chế độ chơi → muốn khoá con trỏ
    this.lockSupported = "requestPointerLock" in canvas;
    this.onUnlock = null;        // người chơi tự thoát khoá (Esc, chuyển cửa sổ) → main mở menu
    this.unlockedAt = -Infinity;
    this._releasing = false;     // nhả khoá do game (đổi chế độ), không phải người chơi
    addEventListener("keydown", (e) => {
      if (typing(e)) return;               // đang gõ vào ô chữ (vd mật khẩu ở mini-game Đăng nhập): không điều khiển game
      if (e.code === "Tab" || e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
      if (!e.repeat && this.handlers[e.code]) this.handlers[e.code](e);
      this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());

    document.addEventListener("pointerlockchange", () => {
      if (this.locked) return;
      if (this._releasing) { this._releasing = false; return; }
      this.unlockedAt = performance.now();
      this.onUnlock?.();
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const c = (v) => Math.max(-MAX_MOVE, Math.min(MAX_MOVE, v));
      this.drag.dx += c(e.movementX) * LOCK_SCALE;
      this.drag.dy += c(e.movementY) * LOCK_SCALE;
    });

    let dragging = false, lx = 0, ly = 0;
    canvas.addEventListener("pointerdown", (e) => {
      if (this.lockSupported && e.pointerType === "mouse") { if (this.lookActive) this.lock(); return; }
      dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", (e) => { if (!dragging) return; dragging = false; canvas.releasePointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      this.drag.dx += e.clientX - lx; this.drag.dy += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener("wheel", (e) => { this.drag.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }
  on(code, fn) { this.handlers[code] = fn; }

  get locked() { return document.pointerLockElement === this.canvas; }
  // trình duyệt chỉ cho khoá sau thao tác của người chơi (click, phím); không được thì gợi ý "Click…" hiện ra
  lock() {
    if (!this.lockSupported || this.locked) return;
    try { this.canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* chưa được phép */ }
  }
  // game gọi khi đổi chế độ: chơi → khoá, còn lại → nhả để hiện con trỏ
  setLook(active) {
    this.lookActive = active;
    if (active) this.lock();
    else if (this.locked) { this._releasing = true; document.exitPointerLock(); }
  }

  // hướng di chuyển theo phím: x = phải, y = tới; run = Shift
  move() {
    if (this.override) return this.override;
    if (!this.enabled) return { x: 0, y: 0, run: false };
    const k = (...c) => c.some((x) => this.keys.has(x));
    return {
      x: (k("KeyD", "ArrowRight") ? 1 : 0) - (k("KeyA", "ArrowLeft") ? 1 : 0),
      y: (k("KeyW", "ArrowUp") ? 1 : 0) - (k("KeyS", "ArrowDown") ? 1 : 0),
      run: k("ShiftLeft", "ShiftRight"),
    };
  }
  consumeDrag() { const d = { ...this.drag }; this.drag.dx = this.drag.dy = this.drag.wheel = 0; return this.enabled ? d : { dx: 0, dy: 0, wheel: 0 }; }
}
