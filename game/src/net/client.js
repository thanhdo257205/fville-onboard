// Kết nối WebSocket tới máy chủ chơi nhiều người (data/net.json → url). Không bao giờ chặn game và không ghi lỗi ra
// console: rớt mạng / máy chủ tắt → tự thử lại (retry_s: 2, 4, 8… giây, cộng ngẫu nhiên); trình duyệt báo mất mạng
// (navigator.onLine) → không thử, chờ sự kiện "online". Đứng yên lâu → ping (máy chủ tự trả "pong"); không nhận được gì
// dead_after_s giây → coi như rớt, kết nối lại. Phòng đầy (mã 4001) → chờ full_retry_s.
export class NetClient {
  constructor(cfg, { onOpen, onMessage, onClose } = {}) {
    this.cfg = cfg;
    Object.assign(this, { onOpen, onMessage, onClose });
    this.ws = null;
    this.status = "idle";        // idle | connecting | open | waiting (chờ thử lại) | offline (trình duyệt mất mạng) | off (url hỏng)
    this.attempt = 0;
    this.stats = { connects: 0, opened: 0, sent: 0, recv: 0, lastClose: null };
    this.lastSent = 0;
    this.lastRecv = 0;
    this.stopped = true;
    addEventListener("online", () => { if (!this.stopped && this.status === "offline") this.connect(); });
    addEventListener("offline", () => { if (!this.stopped) this.ws?.close(4000, "offline"); });
    // tab quay lại sau khi bị ẩn lâu (bộ hẹn giờ bị trình duyệt hãm) → thử lại ngay nếu đang chờ
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !this.stopped && this.status === "waiting" && this.attempt > 2) this.connect();
    });
  }
  get open() { return this.ws?.readyState === 1; }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this._beat = setInterval(() => this.heartbeat(), 5000);
    this.connect();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this._retry);
    clearInterval(this._beat);
    if (this.ws) { try { this.send({ t: "leave" }); this.ws.close(1000, "bye"); } catch { /* đã đóng */ } }
    this.ws = null;
    this.status = "idle";
  }

  connect() {
    clearTimeout(this._retry);
    if (this.stopped || this.ws) return;
    if (!navigator.onLine) { this.status = "offline"; return; }
    let ws;
    try { ws = new WebSocket(this.cfg.url); } catch { this.status = "off"; return; }   // url sai cú pháp: tắt mạng
    this.ws = ws;
    this.status = "connecting";
    this.stats.connects++;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.status = "open";
      this.stats.opened++;
      this.lastRecv = this.lastSent = performance.now();
      this.onOpen?.();
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastRecv = performance.now();
      this.stats.recv++;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m && typeof m === "object" && m.t !== "pong") this.onMessage?.(m);
    };
    ws.onerror = () => {};      // lỗi kết nối luôn kèm onclose → xử lý ở đó
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stats.lastClose = { code: e.code, reason: e.reason };
      this.onClose?.(e);
      if (this.stopped) return;
      if (!navigator.onLine) { this.status = "offline"; return; }
      const r = this.cfg.retry_s || [2, 4, 8, 16, 30, 60];
      const wait = e.code === 4001 ? this.cfg.full_retry_s ?? 90 : r[Math.min(this.attempt, r.length - 1)];
      this.attempt++;
      this.status = "waiting";
      this.retryIn = wait;
      this._retry = setTimeout(() => this.connect(), wait * 1000 * (0.8 + 0.4 * Math.random()));
    };
  }

  // máy chủ đã nhận (welcome) → lần rớt sau thử lại từ 2 s
  ok() { this.attempt = 0; }

  send(msg) {
    if (!this.open) return false;
    this.ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
    this.lastSent = performance.now();
    this.stats.sent++;
    return true;
  }

  heartbeat() {
    if (!this.open) return;
    const now = performance.now();
    if (!document.hidden && now - this.lastRecv > (this.cfg.dead_after_s ?? 50) * 1000) { this.ws.close(4000, "no reply"); return; }
    if (now - this.lastSent >= (this.cfg.heartbeat_s ?? 20) * 1000) this.send('{"t":"ping"}');
  }
}
