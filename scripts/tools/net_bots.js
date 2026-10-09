#!/usr/bin/env node
// Giả lập nhiều người chơi đi lại trên máy chủ chơi nhiều người (server/, docs/multiplayer.md) để đo tải:
//   • số tin / giây: tin client gửi lên (máy chủ NHẬN — Cloudflare tính 20 tin = 1 request) và tin máy chủ phát đi (miễn phí)
//   • ước tính số "request" Cloudflare cho 1 giờ chơi của N người, so với hạn gói Free 100.000 request / ngày
//   • (tuỳ chọn --fps) FPS phía người chơi: mở game trong Chromium (Playwright), đo khi chưa có bot và khi có N bot quanh mình
// Chỉ dùng thư viện chuẩn của Node 22+ (WebSocket có sẵn); --fps cần thêm Playwright.
//
//   node scripts/tools/net_bots.js --url ws://127.0.0.1:8787/ws --bots 20 --seconds 60
//   node scripts/tools/net_bots.js --url ws://127.0.0.1:8787/ws --bots 20 --seconds 60 --fps http://localhost:5180/
//       (--fps: game chạy bằng `npm --prefix game run dev` — chỉ bản dev nhận ?net=<url>; tuỳ chọn --playwright <đường dẫn
//        module playwright>, --chromium <file chrome>, --size 960x540)
// Tuỳ chọn khác: --zone zone_00 · --around x,y,z (tâm chỗ bot đi, mặc định = SPAWN zone_00; --fps: quanh người chơi)
//   · --radius 8 (m) · --walk 0.6 (tỉ lệ thời gian đi, còn lại đứng nghỉ) · --chat 45 (giây giữa 2 emote / câu chat mỗi bot)
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const NET = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "net.json"), "utf-8"));
const FREE_REQ_PER_DAY = 100000;
const IN_PER_REQUEST = 20;            // Durable Objects: 20 tin WebSocket nhận vào = 1 request; tin gửi đi không tính

function args() {
  const a = { url: "ws://127.0.0.1:8787/ws", bots: 20, seconds: 60, zone: "zone_00", around: "26.5,0.15,-3.2", radius: 8, walk: 0.6, chat: 45,
    fps: null, playwright: null, chromium: null, size: "960x540" };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    const k = v[i].replace(/^--/, "");
    if (!(k in a)) { console.error(`tuỳ chọn lạ: ${v[i]}`); process.exit(2); }
    a[k] = typeof a[k] === "number" ? Number(v[++i]) : v[++i];
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- 1 bot ----------
class Bot {
  constructor(i, o, counter) {
    this.i = i; this.o = o; this.c = counter;
    this.name = `Bot ${String(i + 1).padStart(2, "0")}`;
    this.pos = [o.center[0] + rnd(-o.radius, o.radius), o.center[1], o.center[2] + rnd(-o.radius, o.radius)];
    this.yaw = rnd(-Math.PI, Math.PI);
    this.target = null;
    this.restLeft = rnd(0, 3);
    this.lastSent = 0; this.lastAny = 0; this.sent = null;
    this.nextChat = Date.now() + rnd(5, o.chat) * 1000;
    this.open = false;
  }
  connect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(this.o.url);
      this.ws = ws;
      ws.onopen = () => {
        this.open = true;
        this.send({ t: "join", name: this.name, model: this.i % 2 ? "intern_nu" : "intern_nam", outfit: Math.floor(this.i / 2) % 2 ? "ao_cam" : "", zone: this.o.zone });
        resolve(true);
      };
      ws.onmessage = (e) => { this.c.out++; if (String(e.data).includes('"t":"error"')) this.c.errors.push(String(e.data)); };
      ws.onerror = () => {};
      ws.onclose = (e) => { this.open = false; if (!this.closing) this.c.closed.push(`${this.name}: ${e.code} ${e.reason}`); resolve(false); };
    });
  }
  send(m) {
    if (!this.open) return;
    const s = typeof m === "string" ? m : JSON.stringify(m);
    this.ws.send(s);
    this.c.in++;
    if (s.includes('"t":"ping"')) this.c.pings++;
    this.lastAny = Date.now();
  }
  // đi tới điểm ngẫu nhiên quanh tâm (đi bộ 1,4 m/s), tới nơi thì đứng nghỉ — tỉ lệ đi / nghỉ theo --walk
  step(dt) {
    const o = this.o;
    if (!this.target) {
      this.restLeft -= dt;
      if (this.restLeft > 0) return "idle";
      this.target = [o.center[0] + rnd(-o.radius, o.radius), o.center[2] + rnd(-o.radius, o.radius)];
    }
    const dx = this.target[0] - this.pos[0], dz = this.target[1] - this.pos[2], d = Math.hypot(dx, dz);
    const sp = 1.4;
    if (d < sp * dt) {
      this.pos[0] = this.target[0]; this.pos[2] = this.target[1]; this.target = null;
      const walkTime = (2 * o.radius / 1.4) * 0.52;            // quãng đi trung bình ≈ 0,52 × đường chéo vùng
      this.restLeft = walkTime * (1 - o.walk) / Math.max(o.walk, 0.05) * rnd(0.5, 1.5);
      return "idle";
    }
    this.pos[0] += dx / d * sp * dt; this.pos[2] += dz / d * sp * dt;
    this.yaw = Math.atan2(dx, dz);
    return "walk";
  }
  tick(dt) {
    if (!this.open) return;
    const anim = this.step(dt), now = Date.now();
    const s = { zone: this.o.zone, pos: this.pos.map((v) => +v.toFixed(2)), yaw: +this.yaw.toFixed(2), anim };
    const changed = !this.sent || this.sent.anim !== s.anim || Math.hypot(s.pos[0] - this.sent.pos[0], s.pos[2] - this.sent.pos[2]) > 0.02;
    if (changed && now - this.lastSent >= 1000 / (NET.send_hz ?? 5)) { this.send({ t: "state", ...s }); this.sent = s; this.lastSent = now; }
    if (now >= this.nextChat) {
      this.nextChat = now + rnd(0.5, 1.5) * this.o.chat * 1000;
      const list = Math.random() < 0.5 ? NET.emotes : NET.phrases;
      const pick = list[Math.floor(Math.random() * list.length)];
      this.send({ t: list === NET.emotes ? "emote" : "phrase", id: pick.id });
    }
    if (now - this.lastAny >= (NET.heartbeat_s ?? 20) * 1000) this.send('{"t":"ping"}');
  }
  close() { this.closing = true; try { this.send({ t: "leave" }); this.ws.close(1000); } catch { /* đã đóng */ } }
}

async function runBots(o, seconds, onSecond) {
  const c = { in: 0, out: 0, pings: 0, closed: [], errors: [] };
  const bots = Array.from({ length: o.bots }, (_, i) => new Bot(i, o, c));
  const ok = await Promise.all(bots.map((b, i) => sleep(i * 40).then(() => b.connect())));
  const t0 = Date.now();
  let last = t0, mark = { t: t0, in: 0, out: 0 };
  const series = [];
  while (Date.now() - t0 < seconds * 1000) {
    await sleep(50);
    const now = Date.now(), dt = (now - last) / 1000;
    last = now;
    for (const b of bots) b.tick(dt);
    if (now - mark.t >= 1000) {
      series.push({ in: (c.in - mark.in) / ((now - mark.t) / 1000), out: (c.out - mark.out) / ((now - mark.t) / 1000) });
      mark = { t: now, in: c.in, out: c.out };
      onSecond?.(series[series.length - 1]);
    }
  }
  const dur = (Date.now() - t0) / 1000;
  return { bots, c, dur, connected: ok.filter(Boolean).length, stop: () => bots.forEach((b) => b.close()), series };
}

function report(o, r, extra = {}) {
  const inRate = r.c.in / r.dur, outRate = r.c.out / r.dur, n = o.bots + (extra.players || 0);
  const perPlayerIn = inRate / o.bots;
  const inHour = perPlayerIn * n * 3600;
  const reqHour = inHour / IN_PER_REQUEST + n * 2;            // + mỗi người 1 lần kết nối / giờ: 1 request Worker + 1 request DO
  const worstHour = (NET.send_hz ?? 5) * n * 3600 / IN_PER_REQUEST + n * 2;
  console.log(`\n=== ${o.bots} bot · ${r.dur.toFixed(0)} s · zone ${o.zone} · tỉ lệ đi ${Math.round(o.walk * 100)}% ===`);
  console.log(`kết nối được: ${r.connected}/${o.bots}${r.c.closed.length ? ` · bị đóng: ${r.c.closed.slice(0, 3).join("; ")}` : ""}${r.c.errors.length ? ` · lỗi: ${r.c.errors[0]}` : ""}`);
  console.log(`tin máy chủ NHẬN (client gửi lên): ${inRate.toFixed(1)}/s (mỗi người ${perPlayerIn.toFixed(2)}/s, ping ${(r.c.pings / r.dur).toFixed(2)}/s)`);
  console.log(`tin máy chủ PHÁT (tới các bot):     ${outRate.toFixed(1)}/s (miễn phí)`);
  console.log(`ước tính 1 giờ, ${n} người như vậy: ${Math.round(inHour).toLocaleString("en")} tin nhận → ${Math.round(reqHour).toLocaleString("en")} request`
    + ` → hạn ${FREE_REQ_PER_DAY.toLocaleString("en")}/ngày đủ ${(FREE_REQ_PER_DAY / reqHour).toFixed(1)} giờ`);
  console.log(`trường hợp xấu nhất (cả ${n} người đi liên tục, ${NET.send_hz ?? 5} tin/s): ${Math.round(worstHour).toLocaleString("en")} request/giờ`
    + ` → đủ ${(FREE_REQ_PER_DAY / worstHour).toFixed(1)} giờ/ngày`);
  return { inRate, outRate, perPlayerIn, reqHour, worstHour };
}

// ---------- FPS phía người chơi (Playwright) ----------
async function fpsRun(o) {
  let pw;
  try { pw = require(o.playwright || "playwright"); } catch {
    console.error("Cần Playwright cho --fps (npm i -g playwright, hoặc --playwright <đường dẫn module>). Không có thì mở game bằng"
      + " `npm --prefix game run dev`, thêm ?debug&net=<url> vào địa chỉ, chạy script này không có --fps và đọc FPS ở góc trái dưới.");
    process.exit(2);
  }
  const [w, h] = o.size.split("x").map(Number);
  const browser = await pw.chromium.launch({ executablePath: o.chromium || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = o.fps.replace(/\/?$/, "/");
  await page.goto(`${base}?debug&net=${encodeURIComponent(o.url)}`, { waitUntil: "load" });
  await page.waitForSelector("#creator input[name=name]", { timeout: 120000 });
  await page.fill("#creator input[name=name]", "Player");
  await page.press("#creator input[name=name]", "Enter");
  await page.waitForFunction(() => window.__game && window.__game.state.phase === "playing", null, { timeout: 240000 });
  await page.evaluate(async () => {   // đóng tin nhắn đầu game
    for (let i = 0; i < 600 && (window.__game.dialogue || window.__game._game.mode === "dialogue"); i++) { if (window.__game.dialogue) window.__game.advance(); await new Promise((r) => setTimeout(r, 30)); }
  });
  const measure = async (label) => {
    const samples = [];
    for (let i = 0; i < 10; i++) { await sleep(1000); samples.push(await page.evaluate(() => window.__game.state.fps)); }
    const bench = await page.evaluate(() => window.__game.benchmark(60));
    const net = await page.evaluate(() => window.__game.net);
    const fps = samples.reduce((a, b) => a + b, 0) / samples.length;
    console.log(`${label}: ${fps.toFixed(1)} FPS (vòng chơi thật, trung bình 10 s) · benchmark ${bench.ms} ms/khung (${bench.fps} FPS)`
      + ` · đang hiện ${net.remotes?.filter((r) => r.visible).length ?? 0}/${net.remotes?.length ?? 0} người khác · "${net.hud}"`);
    return { fps, bench };
  };
  await sleep(3000);
  const before = await measure("chưa có bot");
  const me = await page.evaluate(() => window.__game.player.pos);
  const zone = await page.evaluate(() => window.__game.zone);
  const bo = { ...o, zone, center: me };
  let botsRun;
  const running = runBots(bo, o.seconds).then((r) => (botsRun = r));
  await sleep(5000);
  const after = await measure(`có ${o.bots} bot quanh người chơi`);
  await running;
  const pnet = await page.evaluate(() => window.__game.net.stats);
  report(bo, botsRun, { players: 1 });
  console.log(`người chơi: gửi ${pnet.sent} tin, nhận ${pnet.recv} tin trong lúc chạy`);
  console.log(`FPS: ${before.fps.toFixed(1)} → ${after.fps.toFixed(1)} (${((after.fps / before.fps - 1) * 100).toFixed(0)}%) · benchmark ${before.bench.ms} → ${after.bench.ms} ms/khung`);
  if (errors.length) console.log("lỗi trang:", errors.slice(0, 3).join(" | "));
  botsRun.stop();
  await sleep(500);
  await browser.close();
}

(async () => {
  const o = args();
  o.center = o.around.split(",").map(Number);
  if (o.fps) return fpsRun(o);
  const r = await runBots(o, o.seconds, (s) => process.stdout.write(`\rnhận ${s.in.toFixed(0)}/s · phát ${s.out.toFixed(0)}/s   `));
  report(o, r);
  r.stop();
  await sleep(500);
  process.exit(0);
})();
