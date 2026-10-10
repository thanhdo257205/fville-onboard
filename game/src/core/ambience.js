// Âm thanh tạo bằng code lúc chơi (Web Audio), không có file nào (docs/audio_credits.md → "Tạo lúc chơi"):
// - Ambience: tiếng nền theo zone (data/zones.json → <zone>.audio.ambience, variants[].audio ghi đè): lớp nền liên tục
//   (nhiễu lọc, âm lượng lên xuống chậm) + sự kiện ngẫu nhiên (chim, dế, xe máy chạy qua, gõ phím…). Đổi zone → chuyển êm.
// - Engine: tiếng máy xe bus theo tốc độ (cảnh lên / xuống xe, cảnh kết).
// - impulse(): phản hồi xung cho tiếng vang trong nhà (zones.json → <zone>.audio.reverb).
// Thêm kiểu tiếng nền: thêm mục vào PRESETS (beds + events), events.kind là một hàm trong EVENTS.

const rand = (a, b) => a + Math.random() * (b - a);

// nhiễu lặp liền mạch (white / pink / brown), mỗi kiểu tạo 1 lần cho mỗi AudioContext
const noiseCache = new WeakMap();
export function noise(ctx, kind = "white", sec = 4) {
  let m = noiseCache.get(ctx);
  if (!m) noiseCache.set(ctx, (m = new Map()));
  if (m.has(kind)) return m.get(kind);
  const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "pink") {   // bộ lọc Paul Kellet
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    } else if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last; }
    else d[i] = w;
    peak = Math.max(peak, Math.abs(d[i]));
  }
  // chuẩn hoá + nối đuôi vào đầu (50 ms) → lặp không nghe "tách"
  const k = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < n; i++) d[i] /= peak || 1;
  for (let i = 0; i < k; i++) { const a = i / k; d[i] = d[i] * a + d[n - k + i] * (1 - a); }
  const out = ctx.createBuffer(1, n - k, ctx.sampleRate);
  out.getChannelData(0).set(d.subarray(0, n - k));
  m.set(kind, out);
  return out;
}

// phản hồi xung (stereo) cho ConvolverNode: nhiễu tắt dần theo hàm mũ, cao tần tắt nhanh hơn
export function impulse(ctx, sec = 1.2, damp = 3) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * sec)), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, k = 0.35 + 0.6 * (1 - t);   // càng về sau càng tối tiếng
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, damp);
    }
  }
  return buf;
}

// ---------------------------------------------------------------- tiếng nền
// beds: lớp liên tục { noise, filter, freq, q, gain, lfo: [Hz, độ sâu 0..1] }; events: { kind, every: [giây min, max], gain }
const PRESETS = {
  // zone 0 — phố sáng sớm: xe cộ xa, xe máy chạy qua, chim thưa
  street: {
    beds: [{ noise: "brown", filter: "lowpass", freq: 240, gain: 0.55, lfo: [0.06, 0.3] },
      { noise: "pink", filter: "bandpass", freq: 700, q: 0.6, gain: 0.05, lfo: [0.11, 0.5] }],
    events: [{ kind: "moto", every: [5, 12], gain: 0.16 }, { kind: "car", every: [6, 14], gain: 0.22 }, { kind: "bird", every: [3, 8], gain: 0.09 }],
  },
  // zone 1–2 — campus buổi sáng: gió, lá, chim
  campus: {
    beds: [{ noise: "pink", filter: "bandpass", freq: 480, q: 0.5, gain: 0.16, lfo: [0.08, 0.6] },
      { noise: "white", filter: "highpass", freq: 3500, gain: 0.012, lfo: [0.23, 0.8] }],
    events: [{ kind: "bird", every: [0.8, 3.2], gain: 0.13 }, { kind: "bird2", every: [4, 10], gain: 0.1 }],
  },
  // zone 1 lúc hoàng hôn (cảnh kết): gió nhẹ, dế, chim về tổ
  evening: {
    beds: [{ noise: "pink", filter: "bandpass", freq: 420, q: 0.5, gain: 0.1, lfo: [0.07, 0.6] }],
    events: [{ kind: "cricket", every: [0.25, 1.1], gain: 0.05 }, { kind: "bird", every: [6, 14], gain: 0.07 }],
  },
  // zone 3 — sảnh lớn: máy lạnh, tiếng bước chân xa (có vang)
  lobby: {
    beds: [{ noise: "brown", filter: "lowpass", freq: 420, gain: 0.3, lfo: [0.05, 0.15] }],
    events: [{ kind: "steps", every: [5, 11], gain: 0.05 }],
  },
  // zone 4 — hành lang: máy lạnh nhỏ
  corridor: {
    beds: [{ noise: "brown", filter: "lowpass", freq: 360, gain: 0.24, lfo: [0.04, 0.1] }],
    events: [{ kind: "steps", every: [8, 16], gain: 0.04 }],
  },
  // zone 5 — văn phòng: máy lạnh, đồng nghiệp gõ phím, bấm chuột
  office: {
    beds: [{ noise: "brown", filter: "lowpass", freq: 460, gain: 0.28, lfo: [0.05, 0.12] }],
    events: [{ kind: "typing", every: [1.2, 4.5], gain: 0.05 }, { kind: "mouse", every: [3, 9], gain: 0.035 }],
  },
};
export const AMBIENCES = Object.keys(PRESETS);

// một nốt ngắn: oscillator + đường bao âm lượng, qua bộ chỉnh trái / phải
function voice(ctx, out, t0, { type = "sine", freq, to = null, dur, gain, pan = 0, attack = 0.005 }) {
  const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  p.pan.value = pan;
  o.connect(g).connect(p).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  o.onended = () => p.disconnect();
}
// tiếng tách ngắn từ nhiễu (gõ phím, chuột, bước chân xa)
function tick(ctx, out, t0, { freq, q = 1.5, dur = 0.012, gain, pan = 0, type = "bandpass" }) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
  s.buffer = noise(ctx, "white");
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  p.pan.value = pan;
  s.connect(f).connect(g).connect(p).connect(out);
  s.start(t0, Math.random() * 3);
  s.stop(t0 + dur + 0.01);
  s.onended = () => p.disconnect();
}

const EVENTS = {
  // chim hót: 2–6 tiếng ríu ngắn, tần số quét
  bird(ctx, out, t0, gain) {
    const pan = rand(-0.9, 0.9), base = rand(2600, 4800), n = Math.floor(rand(2, 7)), up = Math.random() < 0.5;
    let t = t0;
    for (let i = 0; i < n; i++) {
      const d = rand(0.04, 0.09), f = base * rand(0.9, 1.15);
      voice(ctx, out, t, { freq: up ? f * 0.75 : f * 1.2, to: up ? f * 1.25 : f * 0.7, dur: d, gain: gain * rand(0.6, 1), pan });
      t += d + rand(0.03, 0.09);
    }
  },
  // chim khác: tiếng huýt dài 2 nốt
  bird2(ctx, out, t0, gain) {
    const pan = rand(-0.8, 0.8), f = rand(1800, 2600);
    voice(ctx, out, t0, { freq: f, to: f * 1.06, dur: 0.28, gain, pan, attack: 0.03 });
    voice(ctx, out, t0 + 0.34, { freq: f * 1.33, to: f * 1.2, dur: 0.36, gain: gain * 0.9, pan, attack: 0.03 });
  },
  // dế: 2–3 cụm, mỗi cụm 3–4 xung ngắn ~4,6 kHz
  cricket(ctx, out, t0, gain) {
    const pan = rand(-1, 1), f = rand(4300, 4900);
    let t = t0;
    for (let c = 0, n = Math.floor(rand(2, 4)); c < n; c++) {
      for (let i = 0; i < 4; i++) { voice(ctx, out, t, { freq: f, dur: 0.018, gain: gain * rand(0.7, 1), pan, attack: 0.002 }); t += 0.03; }
      t += rand(0.12, 0.2);
    }
  },
  // xe máy chạy qua: răng cưa ~90 Hz lọc thấp, to dần rồi nhỏ dần, trượt từ bên này sang bên kia (tiếng thấp dần khi đi qua)
  moto(ctx, out, t0, gain) {
    const dur = rand(3, 4.5), dir = Math.random() < 0.5 ? -1 : 1, f = rand(80, 110);
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * 1.05, t0);
    o.frequency.linearRampToValueAtTime(f * 0.92, t0 + dur);
    lp.type = "lowpass"; lp.frequency.value = 700; lp.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    p.pan.setValueAtTime(-0.8 * dir, t0);
    p.pan.linearRampToValueAtTime(0.8 * dir, t0 + dur);
    o.connect(lp).connect(g).connect(p).connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
    o.onended = () => p.disconnect();
  },
  // ô tô chạy qua: nhiễu nâu lọc dải, to dần rồi nhỏ dần
  car(ctx, out, t0, gain) {
    const dur = rand(4, 6), dir = Math.random() < 0.5 ? -1 : 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = noise(ctx, "brown"); s.loop = true;
    f.type = "bandpass"; f.Q.value = 0.7;
    f.frequency.setValueAtTime(380, t0); f.frequency.linearRampToValueAtTime(300, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    p.pan.setValueAtTime(-0.7 * dir, t0); p.pan.linearRampToValueAtTime(0.7 * dir, t0 + dur);
    s.connect(f).connect(g).connect(p).connect(out);
    s.start(t0, Math.random() * 3); s.stop(t0 + dur + 0.05);
    s.onended = () => p.disconnect();
  },
  // đồng nghiệp gõ phím: 6–20 phím, nhịp không đều
  typing(ctx, out, t0, gain) {
    const pan = rand(-0.9, 0.9);
    let t = t0;
    for (let i = 0, n = Math.floor(rand(6, 21)); i < n; i++) {
      tick(ctx, out, t, { freq: rand(2200, 4200), q: 2, dur: rand(0.008, 0.016), gain: gain * rand(0.5, 1), pan });
      t += Math.random() < 0.12 ? rand(0.25, 0.5) : rand(0.07, 0.17);
    }
  },
  mouse(ctx, out, t0, gain) {
    const pan = rand(-0.9, 0.9), f = rand(4500, 6000);
    tick(ctx, out, t0, { freq: f, q: 3, dur: 0.008, gain, pan });
    if (Math.random() < 0.4) tick(ctx, out, t0 + 0.11, { freq: f, q: 3, dur: 0.008, gain, pan });
  },
  // ai đó đi ngang ở xa (sảnh, hành lang)
  steps(ctx, out, t0, gain) {
    const n = Math.floor(rand(4, 9)), dir = Math.random() < 0.5 ? -1 : 1, step = rand(0.45, 0.58);
    for (let i = 0; i < n; i++) {
      tick(ctx, out, t0 + i * step, { freq: rand(500, 800), q: 0.8, dur: 0.05, gain: gain * Math.sin(Math.PI * (i + 0.5) / n), pan: dir * (-0.7 + 1.4 * i / n), type: "lowpass" });
    }
  },
};

export class Ambience {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.connect(out);
    this.cur = null;            // { id, gain, sources, next[] }
    this.id = null;
  }
  // đổi tiếng nền (null = tắt), chuyển êm trong `fade` giây
  set(id, fade = 1.5) {
    if (id === this.id) return;
    const ctx = this.ctx, now = ctx.currentTime, old = this.cur;
    if (old) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => { for (const s of old.sources) { try { s.stop(); } catch { /* đã dừng */ } } old.gain.disconnect(); }, fade * 1000 + 200);
    }
    this.id = id;
    const p = PRESETS[id];
    if (!p) { this.cur = null; return; }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    gain.connect(this.out);
    const sources = [];
    for (const b of p.beds) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise(ctx, b.noise); s.loop = true;
      f.type = b.filter; f.frequency.value = b.freq; if (b.q) f.Q.value = b.q;
      g.gain.value = b.gain;
      s.connect(f).connect(g).connect(gain);
      if (b.lfo) {   // âm lượng lên xuống chậm (gió, xe cộ xa)
        const o = ctx.createOscillator(), d = ctx.createGain();
        o.frequency.value = b.lfo[0] * rand(0.8, 1.25);
        d.gain.value = b.gain * b.lfo[1] * 0.5;
        g.gain.value = b.gain * (1 - b.lfo[1] * 0.5);
        o.connect(d).connect(g.gain);
        o.start(now); sources.push(o);
      }
      s.start(now, Math.random() * 3);
      sources.push(s);
    }
    this.cur = { id, gain, sources, events: p.events.map((e) => ({ ...e, at: now + rand(0.5, e.every[1]) })) };
  }
  // gọi mỗi khung: tới giờ thì phát sự kiện ngẫu nhiên (chim, xe máy…) rồi hẹn lần sau
  update() {
    const c = this.cur;
    if (!c) return;
    const now = this.ctx.currentTime;
    for (const e of c.events) {
      if (now < e.at) continue;
      e.at = now + rand(...e.every);
      EVENTS[e.kind]?.(this.ctx, c.gain, now + 0.05, e.gain);
    }
  }
  // đang hội thoại / mini-game: tiếng nền nhỏ lại
  duck(on) {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(on ? 0.45 : 1, now, 0.25);
  }
}

// ---------------------------------------------------------------- tiếng máy xe bus
// Răng cưa + vuông (nửa tần số) qua lọc thấp, cộng nhiễu ầm; tần số / độ mở lọc / âm lượng theo tốc độ xe (m/s).
// out: nút đã gắn PannerNode (sound.js đặt vị trí theo xe) hoặc thẳng loa (đang ngồi trong xe, màn tối).
export class Engine {
  constructor(ctx, out) {
    this.ctx = ctx;
    const now = ctx.currentTime;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(1, now + 0.6);
    this.gain.connect(out);
    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass"; this.lp.Q.value = 1.1;
    this.lp.connect(this.gain);
    this.a = ctx.createOscillator(); this.a.type = "sawtooth";
    this.b = ctx.createOscillator(); this.b.type = "square";
    const ga = ctx.createGain(), gb = ctx.createGain();
    ga.gain.value = 0.5; gb.gain.value = 0.25;
    this.a.connect(ga).connect(this.lp);
    this.b.connect(gb).connect(this.lp);
    // máy nổ không đều: điều biên nhẹ theo tần số nổ
    this.am = ctx.createOscillator(); this.amDepth = ctx.createGain();
    this.amDepth.gain.value = 0.18;
    this.am.connect(this.amDepth).connect(ga.gain);
    this.rumble = ctx.createBufferSource(); this.rumble.buffer = noise(ctx, "brown"); this.rumble.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = "lowpass"; rf.frequency.value = 160;
    this.rg = ctx.createGain(); this.rg.gain.value = 0.4;
    this.rumble.connect(rf).connect(this.rg).connect(this.gain);
    this.set(0, 0);
    for (const o of [this.a, this.b, this.am]) o.start(now);
    this.rumble.start(now);
  }
  set(speed, load = 0) {
    const now = this.ctx.currentTime, v = Math.max(0, speed);
    const f = 30 + v * 2.6 + load * 6;
    this.a.frequency.setTargetAtTime(f, now, 0.15);
    this.b.frequency.setTargetAtTime(f / 2, now, 0.15);
    this.am.frequency.setTargetAtTime(f / 3, now, 0.15);
    this.lp.frequency.setTargetAtTime(260 + v * 45 + load * 300, now, 0.2);
    this.rg.gain.setTargetAtTime(0.35 + v * 0.03, now, 0.3);
  }
  stop(fade = 1.2) {
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { for (const o of [this.a, this.b, this.am, this.rumble]) { try { o.stop(); } catch { /* đã dừng */ } } this.gain.disconnect(); }, fade * 1000 + 100);
  }
}

