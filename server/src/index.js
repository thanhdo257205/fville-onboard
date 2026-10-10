// Máy chủ chơi nhiều người "thấy nhau" (docs/multiplayer.md): Cloudflare Worker + Durable Object, mỗi DO một phòng.
// Chia phòng: mọi người vào phòng 1 (DO tên "fville"); phòng đủ room_size (~30) kết nối thì người mới được chuyển sang
// phòng 2 ("fville-2"), 3… tới max_rooms (phòng cuối nhận tới max_connections). Người ở phòng khác nhau không thấy nhau.
// WebSocket Hibernation API: DO được ngủ khi không ai gửi gì, kết nối vẫn mở; ping của client được runtime tự trả lời
// (không đánh thức DO).
// Trạng thái chỉ nằm trong bộ nhớ + "attachment" gắn theo từng WebSocket (để DO ngủ dậy vẫn biết ai ở đâu, bàn bi-a ra
// sao) — KHÔNG ghi gì xuống storage.
// Tin nhắn (JSON gọn):
//   client → máy chủ: join {name, model, outfit, zone} (gửi lại = cập nhật tên / model / bộ đồ) · state {zone, pos, yaw, anim}
//                      · emote {id} · phrase {id} · leave · ping (tự trả lời)
//                      · bi-a (chỉ ở zone của bàn, data/pool.json): pool_join · pool_leave · pool_shot {seq, a, p, cue, b, k,
//                        s, d} · pool_rerack · pool_poke (người chờ báo hết giờ lượt)
//   máy chủ → client: welcome {id, online, room, features} · zone {zone, players, online} (vừa vào zone: ai đang ở đó) ·
//                      join {p} · state {id, pos, yaw, anim} · emote {id, e} · phrase {id, p} · leave {id} · online {n} ·
//                      error {code, msg} · pool {tb, err?} (bàn bi-a; vừa vào zone của bàn cũng nhận) · pool_shot {shot, tb}
// Chỉ phát tin cho người CÙNG zone (riêng số người online gửi cho cả phòng). Danh sách emote / câu chat và giới hạn lấy từ
// data/net.json, bàn bi-a từ data/pool.json (đóng gói lúc wrangler deploy).
import { DurableObject } from "cloudflare:workers";
import net from "../../data/net.json";
import poolCfg from "../../data/pool.json";
import { PoolRoom } from "./pool.js";

const S = net.server || {};
const MAX_CONN = S.max_connections ?? 60;
const RATE = S.max_msgs_per_s ?? 10;
const IDLE_MS = (S.idle_kick_s ?? 60) * 1000;
const NAME_MAX = S.name_max ?? 20;
const ORIGINS = S.allowed_origins || [];
const EMOTES = new Set((net.emotes || []).map((e) => e.id));
const PHRASES = new Set((net.phrases || []).map((p) => p.id));
const ANIMS = new Set(["idle", "walk", "run", "sit"]);
const ZONE_RE = /^zone_\d{2}$/;
const ID_RE = /^[a-z0-9_]{0,24}$/;
const MAX_MSG = 512;          // ký tự — tin dài hơn bỏ qua
const MAX_SHOT_MSG = 1200;    // pool_shot mang vị trí 16 bi (~450 ký tự)
const COOLDOWN_MS = 800;      // giữa 2 lần emote / câu chat của một người (client tự giữ cooldown_s dài hơn)
const ROOM_SIZE = S.room_size ?? 30;
const MAX_ROOMS = Math.max(1, S.max_rooms ?? 6);
const TURN_MS = (S.pool_turn_s ?? 60) * 1000;
const POOL_ZONE = poolCfg.zone;
const FEATURES = ["pool"];    // máy khách thấy "pool" mới chơi bi-a 2 người qua máy chủ (máy chủ cũ: bàn chỉ tập một mình)
// phòng 1 giữ tên DO cũ "fville" (không đổi phòng của bản đã chạy)
const roomName = (n) => (n <= 1 ? "fville" : `fville-${n}`);
// request WebSocket kèm số phòng (header) — chuyển nguyên request sang DO khác vẫn giữ nâng cấp WebSocket
function withRoom(req, n, forced) {
  const h = new Headers(req.headers);
  h.set("X-FVille-Room", String(n));
  if (forced) h.set("X-FVille-Forced", "1"); else h.delete("X-FVille-Forced");
  return new Request(req, { headers: h });
}

// tên: tối đa NAME_MAX ký tự; chỉ chữ (mọi ngôn ngữ, có dấu), số, khoảng trắng và . ' _ -
export function cleanName(s) {
  if (typeof s !== "string") return "";
  const t = s.normalize("NFC").replace(/[^\p{L}\p{M}\p{N} .'_-]/gu, "").replace(/\s+/g, " ").trim();
  return [...t].slice(0, NAME_MAX).join("").trim();
}
const fin = (v, lim) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim;
const r2 = (v) => Math.round(v * 100) / 100;
const pub = (a) => ({ id: a.id, name: a.name, model: a.model, outfit: a.outfit, pos: a.pos, yaw: a.yaw, anim: a.anim });

function originOk(origin) {
  if (!origin) return true;                     // không phải trình duyệt (công cụ thử) — giới hạn vẫn áp
  try {
    const h = new URL(origin).hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
  } catch { return false; }
  return ORIGINS.includes(origin);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const room = (n) => env.ROOM.get(env.ROOM.idFromName(roomName(n)));
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket upgrade", { status: 426 });
      if (!originOk(req.headers.get("Origin"))) return new Response("Origin not allowed", { status: 403 });
      // ?room=N: vào thẳng phòng N (thử / kiểm thử); không có thì bắt đầu từ phòng 1, phòng đủ người tự chuyển sang phòng sau
      const want = Number(url.searchParams.get("room"));
      const forced = Number.isInteger(want) && want >= 1 && want <= MAX_ROOMS;
      return room(forced ? want : 1).fetch(withRoom(req, forced ? want : 1, forced));
    }
    // kiểm tra sau khi lên mạng: số người online, số người từng zone, bàn bi-a (không có tên) — cộng mọi phòng
    if (url.pathname === "/status") {
      const all = await Promise.all(Array.from({ length: MAX_ROOMS }, (_, i) =>
        room(i + 1).fetch(new Request("https://room/status")).then((r) => r.json()).then((s) => ({ room: i + 1, ...s }))));
      const zones = {};
      for (const r of all) for (const [z, n] of Object.entries(r.zones || {})) zones[z] = (zones[z] || 0) + n;
      const body = { online: all.reduce((k, r) => k + r.online, 0), connections: all.reduce((k, r) => k + r.connections, 0),
        max: MAX_CONN, room_size: ROOM_SIZE, max_rooms: MAX_ROOMS, zones, rooms: all.filter((r) => r.room === 1 || r.connections) };
      return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/") return new Response("F-Ville net: OK\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    return new Response("Not found", { status: 404 });
  },
};

export class FVilleRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // ping của client: runtime tự trả "pong", không đánh thức DO (thời điểm ping cuối: getWebSocketAutoResponseTimestamp)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    this.mem = new WeakMap();     // ws → trạng thái người chơi (DO ngủ dậy: đọc lại từ attachment)
    this.lastSweep = 0;
  }

  async fetch(req) {
    if (new URL(req.url).pathname === "/status") return Response.json(this.status());
    const room = Math.min(MAX_ROOMS, Math.max(1, Number(req.headers.get("X-FVille-Room")) || 1));
    const n = this.ctx.getWebSockets().length;
    // phòng đã đủ ~room_size người → chuyển nguyên request sang phòng sau (phòng cuối nhận tới MAX_CONN)
    if (n >= ROOM_SIZE && room < MAX_ROOMS && req.headers.get("X-FVille-Forced") !== "1") {
      return this.env.ROOM.get(this.env.ROOM.idFromName(roomName(room + 1))).fetch(withRoom(req, room + 1, false));
    }
    const [client, server] = Object.values(new WebSocketPair());
    if (n >= MAX_CONN) {
      // phòng đầy: nhận kết nối chỉ để báo lý do rồi đóng (không đưa vào hibernation)
      server.accept();
      server.send(JSON.stringify({ t: "error", code: "full", msg: `The room is full (${MAX_CONN} players). Please try again later.` }));
      server.close(4001, "room full");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    const a = { id: crypto.randomUUID().slice(0, 8), room, joined: false, left: false, name: "", model: "", outfit: "", zone: null,
      pos: null, yaw: 0, anim: "idle", shown: false, last: Date.now(), rw: 0, rn: 0, cool: 0 };
    this.save(server, a);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- trạng thái từng kết nối ----------
  info(ws) {
    let a = this.mem.get(ws);
    if (!a) {
      a = ws.deserializeAttachment() || null;
      if (a) { a.rw = 0; a.rn = 0; a.cool = 0; this.mem.set(ws, a); }
    }
    return a;
  }
  save(ws, a) {
    this.mem.set(ws, a);
    const { rw, rn, cool, ...keep } = a;        // bộ đếm tần suất chỉ cần trong bộ nhớ
    try { ws.serializeAttachment(keep); } catch { /* kết nối đã đóng */ }
  }
  players() {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.info(ws);
      if (a?.joined && !a.left) out.push([ws, a]);
    }
    return out;
  }
  online() { return this.players().length; }
  status() {
    const zones = {};
    for (const [, a] of this.players()) zones[a.zone] = (zones[a.zone] || 0) + 1;
    const p = this.pool;
    return { online: this.online(), connections: this.ctx.getWebSockets().length, max: MAX_CONN, zones, pool: { mode: p.m.mode, seated: p.seated, shots: p.seq } };
  }

  // ---------- bàn bi-a (server/src/pool.js) ----------
  // DO vừa thức dậy (hibernation): dựng lại bàn từ attachment mới nhất của người đang ngồi; ghế của người đã đi → giải phóng
  get pool() {
    if (!this._pool) {
      this._pool = new PoolRoom(poolCfg, { turnMs: TURN_MS });
      let best = null;
      const live = new Set();
      for (const [, a] of this.players()) { live.add(a.id); if (a.pool && (!best || a.pool.v > best.v)) best = a.pool; }
      if (best && this._pool.restore(best, live, Date.now())) this.poolChanged();
    }
    return this._pool;
  }
  // bàn đổi → gửi cho cả zone của bàn; cất bản chụp vào attachment của người đang ngồi (bỏ ở người không còn ngồi)
  poolChanged(msg = null) {
    const now = Date.now(), p = this.pool;
    this.toZone(POOL_ZONE, { ...(msg || { t: "pool" }), tb: p.view(now) });
    const snap = p.snapshot();
    for (const [ws, a] of this.players()) {
      if (p.seatOf(a.id) >= 0) { a.pool = snap; this.save(ws, a); }
      else if (a.pool) { delete a.pool; this.save(ws, a); }
    }
  }
  onPool(ws, a, m, now) {
    if (!a.joined || a.zone !== POOL_ZONE) return;
    const p = this.pool;
    switch (m.t) {
      case "pool_shot": {
        const r = p.shot(a.id, m, now);
        if (r.ok) this.poolChanged({ t: "pool_shot", shot: r.shot });
        else this.send(ws, { t: "pool", tb: p.view(now), err: r.err });   // sai lượt / lệch số cú…: gửi lại bàn đúng
        return;
      }
      case "pool_join": {
        const r = p.join(a.id, a.name, now);
        if (r.changed) this.poolChanged();
        else this.send(ws, { t: "pool", tb: p.view(now), ...(r.seated ? {} : { err: "full" }) });
        return;
      }
      case "pool_leave": if (p.leave(a.id, now, "left")) this.poolChanged(); return;
      case "pool_rerack": if (p.rerack(a.id, now)) this.poolChanged(); return;
      default: return;                // pool_poke: chỉ để chạy tick (đầu webSocketMessage)
    }
  }

  // ---------- gửi ----------
  send(ws, msg) { try { ws.send(typeof msg === "string" ? msg : JSON.stringify(msg)); } catch { /* đang đóng */ } }
  toZone(zone, msg, except = null) {
    const s = JSON.stringify(msg);
    for (const [ws, a] of this.players()) if (ws !== except && a.zone === zone) this.send(ws, s);
  }
  toAll(msg) {
    const s = JSON.stringify(msg);
    for (const [ws] of this.players()) this.send(ws, s);
  }
  broadcastOnline() { this.toAll({ t: "online", n: this.online() }); }

  // vào zone: người mới nhận danh sách người cùng zone (đã có vị trí); người cùng zone thấy người mới khi đã có vị trí
  enterZone(ws, a) {
    const players = this.players().filter(([w, b]) => w !== ws && b.zone === a.zone && b.shown).map(([, b]) => pub(b));
    this.send(ws, { t: "zone", zone: a.zone, players, online: this.online() });
    if (a.zone === POOL_ZONE) this.send(ws, { t: "pool", tb: this.pool.view(Date.now()) });
    a.shown = !!a.pos;
    if (a.shown) this.toZone(a.zone, { t: "join", p: pub(a) }, ws);
  }
  leaveZone(ws, a) {
    if (a.shown) this.toZone(a.zone, { t: "leave", id: a.id }, ws);
    a.shown = false;
    // rời zone của bàn / mất kết nối khi đang ngồi → giải phóng ghế
    if (a.zone === POOL_ZONE && this.pool.leave(a.id, Date.now(), "left")) this.poolChanged();
  }

  // ---------- nhận ----------
  async webSocketMessage(ws, raw) {
    const a = this.info(ws);
    if (!a || a.left) return;
    const now = Date.now();
    a.last = now;
    // giới hạn RATE tin / giây mỗi kết nối: quá thì bỏ tin, gấp 3 lần thì ngắt
    if (now - a.rw >= 1000) { a.rw = now; a.rn = 0; }
    a.rn++;
    if (a.rn > RATE * 3) { this.drop(ws, a, 4003, "too many messages"); return; }
    if (a.rn > RATE) return;
    this.sweep(now);
    if (this.pool.tick(now)) this.poolChanged();            // tới lượt mà quá giờ → giải phóng ghế
    if (typeof raw !== "string" || raw.length > (raw.startsWith('{"t":"pool_shot"') ? MAX_SHOT_MSG : MAX_MSG)) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== "object") return;
    switch (m.t) {
      case "join": return this.onJoin(ws, a, m);
      case "state": return this.onState(ws, a, m);
      case "pool_join":
      case "pool_leave":
      case "pool_shot":
      case "pool_rerack":
      case "pool_poke": return this.onPool(ws, a, m, now);
      case "emote":
      case "phrase": {
        if (!a.joined || !a.shown) return;
        const ok = m.t === "emote" ? EMOTES.has(m.id) : PHRASES.has(m.id);
        if (!ok || now - (a.cool || 0) < COOLDOWN_MS) return;
        a.cool = now;
        this.toZone(a.zone, m.t === "emote" ? { t: "emote", id: a.id, e: m.id } : { t: "phrase", id: a.id, p: m.id }, ws);
        return;
      }
      case "leave": this.drop(ws, a, 1000, "bye"); return;
      case "ping": this.send(ws, { t: "pong" }); return;
      default: return;
    }
  }

  onJoin(ws, a, m) {
    const name = cleanName(m.name);
    if (!name || !ZONE_RE.test(m.zone)) { this.send(ws, { t: "error", code: "bad_join", msg: "Invalid name or zone." }); return; }
    a.name = name;
    a.model = typeof m.model === "string" && ID_RE.test(m.model) ? m.model : "";
    a.outfit = typeof m.outfit === "string" && ID_RE.test(m.outfit) ? m.outfit : "";
    if (!a.joined) {
      a.joined = true;
      a.zone = m.zone;
      this.send(ws, { t: "welcome", id: a.id, online: this.online(), room: a.room || 1, features: FEATURES });
      this.enterZone(ws, a);
      this.save(ws, a);
      this.broadcastOnline();
      return;
    }
    // gửi lại join = cập nhật tên / model / bộ đồ (vd vừa mặc Áo Cam FPT); khác zone thì chuyển zone
    if (m.zone !== a.zone) { this.leaveZone(ws, a); a.zone = m.zone; a.pos = null; this.enterZone(ws, a); }
    else if (a.shown) this.toZone(a.zone, { t: "join", p: pub(a) }, ws);
    this.save(ws, a);
  }

  onState(ws, a, m) {
    if (!a.joined || !ZONE_RE.test(m.zone)) return;
    const p = m.pos;
    if (!Array.isArray(p) || p.length !== 3 || !p.every((v) => fin(v, 5000)) || !fin(m.yaw, 1000)) return;
    const anim = ANIMS.has(m.anim) ? m.anim : "idle";
    const pos = p.map(r2), yaw = r2(Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw)));
    if (m.zone !== a.zone) {
      this.leaveZone(ws, a);
      Object.assign(a, { zone: m.zone, pos, yaw, anim });
      this.enterZone(ws, a);
    } else {
      Object.assign(a, { pos, yaw, anim });
      if (!a.shown) { a.shown = true; this.toZone(a.zone, { t: "join", p: pub(a) }, ws); }
      else this.toZone(a.zone, { t: "state", id: a.id, pos, yaw, anim }, ws);
    }
    this.save(ws, a);
  }

  // rời phòng (leave, đóng, lỗi, im lặng quá lâu, gửi quá nhiều): báo người cùng zone + số người online — chỉ 1 lần
  drop(ws, a, code = 1000, reason = "") {
    if (!a || a.left) return;
    const was = a.joined;
    a.left = true;
    this.leaveZone(ws, a);
    this.save(ws, a);
    try { ws.close(code, reason); } catch { /* đã đóng */ }
    if (was) this.broadcastOnline();
  }

  // ngắt kết nối không gửi gì (kể cả ping tự trả lời) quá IDLE_MS — chạy khi có tin tới, tối đa 5 s / lần
  sweep(now) {
    if (now - this.lastSweep < 5000) return;
    this.lastSweep = now;
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.info(ws);
      if (!a || a.left) continue;
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(a.last, pinged) > IDLE_MS) this.drop(ws, a, 4002, "idle");
    }
  }

  async webSocketClose(ws, code, reason) {
    this.drop(ws, this.info(ws), 1000, "closed");
  }
  async webSocketError(ws) {
    this.drop(ws, this.info(ws), 1011, "error");
  }
}
