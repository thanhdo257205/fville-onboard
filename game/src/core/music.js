// Nhạc nền: data/sounds.json → music (bài, nguồn CC0, bài mặc định), zones.json → <zone>.audio.music ghi đè (id bài, null = im).
// Mỗi bài 1 thẻ <audio> (tải dần, lặp) nối vào Web Audio: <audio> → gain riêng (volume của bài × lên / xuống êm) → out (bus nhạc
// của sound.js, âm lượng = thanh Nhạc trong menu Esc). Đổi bài: bài cũ nhỏ dần rồi dừng, bài mới to dần. Hội thoại / mini-game /
// app: duck → nhỏ còn music.duck. Tắt tiếng / thanh Nhạc = 0 / tab ẩn → tạm dừng thẻ <audio> (không tải, không giải mã thừa).
// Thiếu file / trình duyệt không phát được → im, 1 cảnh báo console.
import { url } from "./assets.js";

const FADE_IN_S = 2.5;
const FADE_OUT_S = 1.5;

export class Music {
  constructor(ctx, out, cfg) {
    this.ctx = ctx;
    this.out = out;
    this.cfg = cfg || {};
    this.tracks = this.cfg.tracks || {};
    this.duckGain = ctx.createGain();
    this.duckGain.connect(out);
    this.players = new Map();     // id → { el, gain, src, failed }
    this.id = null;               // bài đang phát (hoặc đang chờ được phát)
    this.allowed = true;          // false: tắt tiếng / thanh Nhạc = 0 / tab ẩn → dừng
    this.failed = new Set();
  }
  // bài của zone: audio.music (có khoá này, kể cả null) hoặc music.default
  pick(audio) {
    const id = audio && "music" in audio ? audio.music : this.cfg.default ?? null;
    return id && this.tracks[id] ? id : null;
  }
  set(id) {
    if (id === this.id) { this.resume(); return; }
    const oldId = this.id, old = oldId && this.players.get(oldId);
    if (old) this.fade(old, 0, FADE_OUT_S, () => { if (this.id !== oldId) old.el.pause(); });
    this.id = id;
    if (!id) return;
    const p = this.player(id);
    if (!p) return;
    this.fade(p, this.tracks[id].volume ?? 0.5, FADE_IN_S);
    this.resume();
  }
  player(id) {
    if (this.players.has(id)) return this.players.get(id);
    const el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.src = url(`assets/music/${id}.mp3`);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    let src;
    try { src = this.ctx.createMediaElementSource(el); } catch (e) { console.warn(`[âm thanh] không phát được nhạc ${id}: ${e.message || e}`); return null; }
    src.connect(gain).connect(this.duckGain);
    const p = { el, gain, src, failed: false };
    el.addEventListener("error", () => {
      p.failed = true;
      if (!this.failed.has(id)) { this.failed.add(id); console.warn(`[âm thanh] không tải được nhạc ${id}`); }
    });
    this.players.set(id, p);
    return p;
  }
  fade(p, to, sec, done) {
    const g = p.gain.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + sec);
    clearTimeout(p.timer);
    if (done) p.timer = setTimeout(done, sec * 1000 + 50);
  }
  // được phép phát: bật tiếng, thanh Nhạc > 0, tab đang hiện
  setAllowed(on) {
    this.allowed = on;
    if (on) this.resume();
    else for (const p of this.players.values()) p.el.pause();
  }
  resume() {
    const p = this.id && this.players.get(this.id);
    if (!p || p.failed || !this.allowed || !p.el.paused) return;
    p.el.play().catch(() => {});   // chưa có thao tác của người chơi → trình duyệt chặn; lần bấm sau (sound.unlock) thử lại
  }
  duck(on) { this.duckGain.gain.setTargetAtTime(on ? this.cfg.duck ?? 0.5 : 1, this.ctx.currentTime, 0.3); }
  info() {
    const p = this.id && this.players.get(this.id);
    return { id: this.id, playing: !!p && !p.el.paused, time: p ? +p.el.currentTime.toFixed(1) : 0, failed: [...this.failed],
      gain: p ? +p.gain.gain.value.toFixed(3) : 0, duck: +this.duckGain.gain.value.toFixed(2) };
  }
}
