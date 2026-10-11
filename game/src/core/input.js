// Bàn phím + chuột. Đang chơi: khoá con trỏ (Pointer Lock) → di chuột để xoay camera, con trỏ ẩn; mở hội thoại /
// app / mini-game / menu thì nhả khoá để bấm được. Không khoá được (vd cảm ứng) → kéo để xoay như cũ.
// Cảm ứng (ui/touch.js): điều khiển ảo đặt `stick` = {x, y, run} (thay phím W/A/S/D); vuốt trên khung vẽ xoay camera (độ nhạy
// TOUCH_SCALE); 2 ngón chụm / mở kéo camera xa / gần (như con lăn chuột, PINCH_PX px ≈ 1 nấc lăn).
// `override` cho phép __game giả lập phím khi tự kiểm tra; `fakeLock` giả lập khoá con trỏ (smoke: headless không khoá thật ổn định).
import { device } from "./device.js";

const LOCK_SCALE = 0.5;    // độ nhạy chuột khi khoá so với kéo (camera nhân 0,005 rad/px)
const TOUCH_SCALE = 0.7;   // vuốt ngón tay: 1 px ≈ 0,0035 rad (vuốt ngang nửa màn hình điện thoại ~420 px ≈ 85°)
const PINCH_PX = 40;       // chụm / mở 2 ngón: mỗi chừng ấy px khoảng cách = 1 nấc lăn chuột (camera xa / gần 0,4 m)
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
    this.fakeLock = null;        // kiểm thử: true / false = giả lập đang / chưa khoá (lock() → khoá sau 30 ms như thật); null = thật
    this.skipLock = null;        // (pointerdown) → true: cú bấm này không khoá con trỏ (bàn bi-a: bấm vào lỗ để gọi lỗ bi 8)
    this.stick = null;           // điều khiển ảo (ui/touch.js): { x, y, run } — đang đẩy thì thay phím
    this.onTap = null;           // chạm nhanh trên khung vẽ (không kéo) → ui/touch.js (vd hội thoại: chạm để nói tiếp)
    addEventListener("keydown", (e) => {
      if (typing(e)) return;               // đang gõ vào ô chữ (vd mật khẩu ở mini-game Đăng nhập): không điều khiển game
      if (e.code === "Tab" || e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
      if (!e.repeat && this.handlers[e.code]) this.handlers[e.code](e);
      this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());

    document.addEventListener("pointerlockchange", () => {
      // khoá tới muộn sau khi game đã đổi sang chế độ cần con trỏ (vd menu → View summary) → nhả ngay
      if (this.locked) { if (!this.lookActive) { this._releasing = true; document.exitPointerLock(); } return; }
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

    // kéo (ngón tay / chuột khi không khoá): mỗi con trỏ một vị trí; 1 con trỏ → xoay camera, 2 ngón → chụm / mở thu phóng
    const pts = new Map();
    let pinch = 0;
    const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    canvas.addEventListener("pointerdown", (e) => {
      if (this.lockSupported && e.pointerType === "mouse") { if (this.lookActive && !this.skipLock?.(e)) this.lock(); return; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* con trỏ không còn hoạt động (vd chạm giả lập) */ }
      if (pts.size === 2) pinch = spread();
    });
    const up = (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      pts.delete(e.pointerId);
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (pts.size < 2) pinch = 0;
      // chạm nhanh không kéo (≤ 12 px, ≤ 350 ms), không phải lúc đang chụm 2 ngón
      if (e.type === "pointerup" && e.pointerType !== "mouse" && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) <= 12 && performance.now() - p.t0 <= 350 && !p.multi) this.onTap?.(e);
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const k = e.pointerType === "mouse" ? 1 : TOUCH_SCALE;
      if (pts.size >= 2) {
        for (const q of pts.values()) q.multi = true;
        p.x = e.clientX; p.y = e.clientY;
        const d = spread();
        if (pinch) this.drag.wheel += (pinch - d) / PINCH_PX;           // mở rộng 2 ngón = lại gần (như lăn chuột lên)
        pinch = d;
        return;
      }
      this.drag.dx += (e.clientX - p.x) * k; this.drag.dy += (e.clientY - p.y) * k;
      p.x = e.clientX; p.y = e.clientY;
    });
    canvas.addEventListener("wheel", (e) => { this.drag.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }
  on(code, fn) { this.handlers[code] = fn; }

  get locked() { return this.fakeLock ?? document.pointerLockElement === this.canvas; }
  // trình duyệt chỉ cho khoá sau thao tác của người chơi (click, phím); không được thì gợi ý "Click…" hiện ra
  lock() {
    // giao diện cảm ứng: không khoá (đang khoá thì mọi sự kiện con trỏ — cả ngón tay — báo toạ độ cố định → cần điều khiển hỏng)
    if (!this.lockSupported || this.locked || device.touch) return;
    if (this.fakeLock !== null) { setTimeout(() => { if (this.lookActive && this.fakeLock === false) this.fakeLock = true; }, 30); return; }
    try { this.canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* chưa được phép */ }
  }
  // game gọi khi đổi chế độ: chơi → khoá, còn lại → nhả để hiện con trỏ
  setLook(active) {
    this.lookActive = active;
    if (active) this.lock();
    else if (this.locked) {
      if (this.fakeLock !== null) this.fakeLock = false;
      else { this._releasing = true; document.exitPointerLock(); }
    }
  }

  // hướng di chuyển theo phím: x = phải, y = tới; run = Shift
  move() {
    if (this.override) return this.override;
    if (!this.enabled) return { x: 0, y: 0, run: false };
    if (this.stick) return this.stick;
    const k = (...c) => c.some((x) => this.keys.has(x));
    return {
      x: (k("KeyD", "ArrowRight") ? 1 : 0) - (k("KeyA", "ArrowLeft") ? 1 : 0),
      y: (k("KeyW", "ArrowUp") ? 1 : 0) - (k("KeyS", "ArrowDown") ? 1 : 0),
      run: k("ShiftLeft", "ShiftRight"),
    };
  }
  // all: lấy cả khi input đang tắt — ở bàn bi-a game ở chế độ "pool" (enabled = false: không đi lại) nhưng chuột vẫn phải xoay
  // cơ / lăn chuột thu phóng (trước đây bị bỏ → ở bàn chỉ A/D xoay được cơ)
  consumeDrag(all = false) { const d = { ...this.drag }; this.drag.dx = this.drag.dy = this.drag.wheel = 0; return this.enabled || all ? d : { dx: 0, dy: 0, wheel: 0 }; }
}
