// Âm thanh (Web Audio API).
// - Hiệu ứng: data/sounds.json → file MP3 trong assets/sfx/ (dựng bằng scripts/blender/audio/build_sfx.py; nguồn + giấy phép
//   từng file: docs/audio_credits.md). play(tên, { pos, gain, rate }): pos (THREE.Vector3, toạ độ thế giới) → nghe theo vị
//   trí so với camera; không có pos → phát thẳng (giao diện, bước chân của người chơi).
// - Tiếng nền theo zone, tiếng máy xe bus, tiếng vang trong nhà: tạo bằng code lúc chạy (core/ambience.js); cấu hình ở
//   data/zones.json → <zone>.audio: { ambience, steps, reverb } (variants[].audio ghi đè, vd zone_01 lúc hoàng hôn).
// - Trình duyệt chặn phát tiếng trước lần bấm / phím đầu tiên → AudioContext tạo ở unlock() (main.js gắn vào pointerdown /
//   keydown). Chưa unlock, tắt tiếng (menu Esc), thiếu file, trình duyệt không có Web Audio → play() bỏ qua, không báo lỗi.
// - Cài đặt (menu Esc, lưu ở settings.sound): on, sfx (hiệu ứng 0..1), amb (tiếng nền 0..1). Tab ẩn → tạm dừng.
// sound.log ghi lại các lần gọi gần nhất (__game.sounds), sound.counts đếm theo tên; sound.info() → trạng thái (__game.audio).
import { url } from "./assets.js";
import { Ambience, Engine, impulse } from "./ambience.js";

export const SOUND_DEFAULTS = { on: true, sfx: 0.8, amb: 0.6 };
const MAX_VOICES = 24;
const REF_M = 3;              // tiếng theo vị trí: to nguyên ở khoảng cách này, xa hơn nhỏ dần
const MAX_M = 60;

export const sound = {
  log: [],
  counts: {},             // tên → số lần gọi play() (cả khi chưa có tiếng) — kiểm thử
  defs: {},
  ctx: null,
  settings: { ...SOUND_DEFAULTS },
  zone: null,             // { id, audio }
  buffers: new Map(),     // file → { buffer, offset } | null (hỏng)
  loading: new Map(),
  voices: new Map(),      // tên → số tiếng đang phát
  total: 0,
  stats: { played: 0, skipped: 0, decoded: 0, failed: 0 },
  last: new Map(),        // tên → bản vừa phát (khỏi lặp lại liền)
  engines: new Set(),

  configure(cfg) { this.defs = cfg?.sounds || {}; },
  files(name) {
    const d = this.defs[name];
    if (!d) return [];
    const n = d.files?.length || 0;
    return Array.from({ length: n }, (_, i) => (n === 1 ? `${name}.mp3` : `${name}_${i + 1}.mp3`));
  },

  // ---------- cài đặt ----------
  apply(s = {}) {
    this.settings = { ...SOUND_DEFAULTS, ...s };
    if (!this.ctx) return;
    const now = this.ctx.currentTime, { on, sfx, amb } = this.settings;
    this.master.gain.setTargetAtTime(on ? 1 : 0, now, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, now, 0.05);
    this.ambBus.gain.setTargetAtTime(amb, now, 0.05);
  },

  // ---------- khởi động (lần bấm / phím đầu tiên) ----------
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended" && !document.hidden) this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try { ctx = new AC({ latencyHint: "interactive" }); } catch { return; }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.ui = ctx.createGain();
    this.ui.connect(this.sfxBus);
    // thế giới: thẳng + qua tiếng vang (độ vang theo zone)
    this.world = ctx.createGain();
    this.world.connect(this.sfxBus);
    this.verb = ctx.createConvolver();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    this.world.connect(this.verb).connect(this.wet).connect(this.sfxBus);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);
    this.ambience = new Ambience(ctx, this.ambBus);
    this.apply(this.settings);
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    });
    this.preload();
    if (this.zone) this.setZone(this.zone.id, this.zone.audio);
  },

  // tải trước: mọi tiếng không gắn zone + tiếng của zone đang ở
  preload() {
    if (!this.ctx) return;
    for (const [name, d] of Object.entries(this.defs)) {
      if (!d.zones || (this.zone && d.zones.includes(this.zone.id))) for (const f of this.files(name)) this.load(f);
    }
  },
  load(file) {
    if (this.buffers.has(file) || this.loading.has(file)) return this.loading.get(file) ?? Promise.resolve();
    const p = fetch(url(`assets/sfx/${file}`))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then((b) => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej)))
      .then((buffer) => {
        // MP3 có vài chục ms im lặng ở đầu (độ trễ bộ mã hoá) → bắt đầu phát từ mẫu đầu tiên có tiếng
        const d = buffer.getChannelData(0), lim = Math.min(d.length, 8192);
        let i = 0;
        while (i < lim && Math.abs(d[i]) < 0.0005) i++;
        this.buffers.set(file, { buffer, offset: i < lim ? Math.max(0, i - 32) / buffer.sampleRate : 0 });
        this.stats.decoded++;
      })
      .catch((e) => { this.buffers.set(file, null); this.stats.failed++; console.warn(`[âm thanh] không tải được ${file}: ${e.message || e}`); })
      .finally(() => this.loading.delete(file));
    this.loading.set(file, p);
    return p;
  },

  // ---------- zone: tiếng nền, tiếng vang, tải trước tiếng của zone ----------
  // audio: data/zones.json → <zone>.audio (đã gộp với variants[].audio)
  setZone(id, audio = {}) {
    this.zone = { id, audio: audio || {} };
    if (!this.ctx) return;
    this.preload();
    this.ambience.set(audio?.ambience ?? null);
    const r = audio?.reverb || 0, now = this.ctx.currentTime;
    if (r > 0) {
      const sec = audio.reverb_s ?? 0.6 + r * 2.4;
      if (this.verbSec !== sec) { this.verb.buffer = impulse(this.ctx, sec, 3); this.verbSec = sec; }
    }
    this.wet.gain.setTargetAtTime(r * 0.6, now, 0.2);
  },
  duck(on) { this.ambience?.duck(on); },

  // ---------- phát ----------
  play(name, { pos = null, gain = 1, rate = 1 } = {}) {
    this.log.push(name);
    if (this.log.length > 200) this.log.shift();
    this.counts[name] = (this.counts[name] || 0) + 1;
    const d = this.defs[name];
    if (!d || !this.ctx || !this.settings.on || this.ctx.state !== "running") return false;
    const files = this.files(name);
    if (!files.length) return false;
    // nhiều bản: chọn ngẫu nhiên, khác bản vừa phát
    let i = Math.floor(Math.random() * files.length);
    if (files.length > 1 && i === this.last.get(name)) i = (i + 1) % files.length;
    this.last.set(name, i);
    const b = this.buffers.get(files[i]);
    if (!b) { if (b === undefined) this.load(files[i]); this.stats.skipped++; return false; }
    const busy = this.voices.get(name) || 0;
    if (busy >= (d.max ?? 3) || this.total >= MAX_VOICES) { this.stats.skipped++; return false; }
    const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b.buffer;
    const jitter = d.pitch ? 1 + (Math.random() * 2 - 1) * d.pitch : 1;
    src.playbackRate.value = (d.rate ?? 1) * rate * jitter;
    g.gain.value = Math.min(2, (d.volume ?? 1) * gain);
    src.connect(g);
    let tail = g;
    if (pos && d.bus === "world") {
      const p = ctx.createPanner();
      p.panningModel = "equalpower";
      p.distanceModel = "inverse";
      p.refDistance = REF_M;
      p.maxDistance = MAX_M;
      p.rolloffFactor = 1;
      setPos(p, pos);
      tail = tail.connect(p);
    }
    tail.connect(d.bus === "world" ? this.world : this.ui);
    this.voices.set(name, busy + 1);
    this.total++;
    src.onended = () => { tail.disconnect(); this.voices.set(name, (this.voices.get(name) || 1) - 1); this.total--; };
    src.start(0, b.offset);
    this.stats.played++;
    return true;
  },

  // tiếng máy xe bus bám theo một node (vị trí + tốc độ tự tính từ quãng đường node đi mỗi khung). inside: đang ngồi trong
  // xe (không theo vị trí, nghe trầm hơn). → { follow(node), inside(on), stop() }
  engine(node, { inside = false } = {}) {
    if (!this.ctx) return null;
    const ctx = this.ctx, panner = ctx.createPanner(), muffle = ctx.createBiquadFilter(), out = ctx.createGain();
    panner.panningModel = "equalpower"; panner.distanceModel = "inverse";
    panner.refDistance = 6; panner.maxDistance = 120; panner.rolloffFactor = 1;
    muffle.type = "lowpass";
    out.gain.value = 0.55;
    out.connect(muffle).connect(this.world);
    const e = { node, inside, eng: new Engine(ctx, out), prev: null, speed: 0, panner, out, muffle };
    e.setInside = (on) => {
      e.inside = on;
      out.disconnect();
      muffle.frequency.setTargetAtTime(on ? 380 : 20000, ctx.currentTime, 0.2);
      out.connect(on ? muffle : panner);
      if (!on) panner.connect(muffle);
    };
    e.setInside(inside);
    e.follow = (n) => { e.node = n; e.prev = null; };
    e.stop = (fade = 1.2) => {
      if (!this.engines.delete(e)) return;
      e.eng.stop(fade);
      setTimeout(() => { muffle.disconnect(); panner.disconnect(); }, fade * 1000 + 300);
    };
    this.engines.add(e);
    return e;
  },

  // ---------- mỗi khung: tai nghe ở camera, tiếng nền, tiếng máy xe ----------
  update(dt, camera) {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (camera) {
      const l = this.ctx.listener, m = camera.matrixWorld.elements;
      setPos(l, { x: m[12], y: m[13], z: m[14] });
      // hướng nhìn = −Z của camera, hướng lên = +Y
      if (l.forwardX) {
        const t = this.ctx.currentTime;
        l.forwardX.setValueAtTime(-m[8], t); l.forwardY.setValueAtTime(-m[9], t); l.forwardZ.setValueAtTime(-m[10], t);
        l.upX.setValueAtTime(m[4], t); l.upY.setValueAtTime(m[5], t); l.upZ.setValueAtTime(m[6], t);
      } else l.setOrientation?.(-m[8], -m[9], -m[10], m[4], m[5], m[6]);
    }
    this.ambience.update();
    for (const e of this.engines) {
      const n = e.node;
      if (!n?.parent) continue;
      n.updateWorldMatrix(true, false);
      const w = n.matrixWorld.elements, p = { x: w[12], y: w[13], z: w[14] };
      if (e.prev && dt > 0) {
        const v = Math.hypot(p.x - e.prev.x, p.z - e.prev.z) / dt;
        e.speed += (Math.min(v, 30) - e.speed) * Math.min(1, dt * 4);
      }
      e.prev = p;
      if (!e.inside) setPos(e.panner, p);
      e.eng.set(e.inside ? Math.max(e.speed, 9) : e.speed);
    }
  },

  info() {
    const c = this.ctx;
    return { state: c ? c.state : "locked", ...this.settings, zone: this.zone?.id ?? null, ambience: this.ambience?.id ?? null,
      reverb: this.zone?.audio?.reverb ?? 0, loaded: [...this.buffers.values()].filter(Boolean).length, voices: this.total,
      engines: this.engines.size, ...this.stats, counts: { ...this.counts } };
  },
};

function setPos(node, p) {
  if (node.positionX) { const t = sound.ctx.currentTime; node.positionX.setValueAtTime(p.x, t); node.positionY.setValueAtTime(p.y, t); node.positionZ.setValueAtTime(p.z, t); }
  else node.setPosition?.(p.x, p.y, p.z);
}
