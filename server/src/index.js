// Máy chủ chơi nhiều người "thấy nhau" (docs/multiplayer.md): Cloudflare Worker + MỘT Durable Object tên "fville" giữ
// phòng chung. WebSocket Hibernation API: DO được ngủ khi không ai gửi gì, kết nối vẫn mở; ping của client được runtime
// tự trả lời (không đánh thức DO).
// Trạng thái chỉ nằm trong bộ nhớ + "attachment" gắn theo từng WebSocket (để DO ngủ dậy vẫn biết ai ở đâu) — KHÔNG ghi gì
// xuống storage.
// Tin nhắn (JSON gọn):
//   client → máy chủ: join {name, model, outfit, zone} (gửi lại = cập nhật tên / model / bộ đồ) · state {zone, pos, yaw, anim}
//                      · emote {id} · phrase {id} · leave · ping (tự trả lời)
//   máy chủ → client: welcome {id, online} · zone {zone, players, online} (vừa vào zone: ai đang ở đó) · join {p} · state
//                      {id, pos, yaw, anim} · emote {id, e} · phrase {id, p} · leave {id} · online {n} · error {code, msg}
// Chỉ phát tin cho người CÙNG zone (riêng số người online gửi cho cả phòng). Danh sách emote / câu chat và giới hạn lấy từ
// data/net.json (đóng gói lúc wrangler deploy).
import { DurableObject } from "cloudflare:workers";
import net from "../../data/net.json";

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
const COOLDOWN_MS = 800;      // giữa 2 lần emote / câu chat của một người (client tự giữ cooldown_s dài hơn)
const ROOM = "fville";

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
    const room = () => env.ROOM.get(env.ROOM.idFromName(ROOM));
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket upgrade", { status: 426 });
      if (!originOk(req.headers.get("Origin"))) return new Response("Origin not allowed", { status: 403 });
      return room().fetch(req);
    }
    // kiểm tra sau khi lên mạng: số người online, số người từng zone (không có tên)
    if (url.pathname === "/status") {
      const r = await room().fetch(new Request("https://room/status"));
      return new Response(r.body, { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
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
    const [client, server] = Object.values(new WebSocketPair());
    if (this.ctx.getWebSockets().length >= MAX_CONN) {
      // phòng đầy: nhận kết nối chỉ để báo lý do rồi đóng (không đưa vào hibernation)
      server.accept();
      server.send(JSON.stringify({ t: "error", code: "full", msg: `The room is full (${MAX_CONN} players). Please try again later.` }));
      server.close(4001, "room full");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    const a = { id: crypto.randomUUID().slice(0, 8), joined: false, left: false, name: "", model: "", outfit: "", zone: null,
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
    return { online: this.online(), connections: this.ctx.getWebSockets().length, max: MAX_CONN, zones };
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
    a.shown = !!a.pos;
    if (a.shown) this.toZone(a.zone, { t: "join", p: pub(a) }, ws);
  }
  leaveZone(ws, a) {
    if (a.shown) this.toZone(a.zone, { t: "leave", id: a.id }, ws);
    a.shown = false;
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
    if (typeof raw !== "string" || raw.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== "object") return;
    switch (m.t) {
      case "join": return this.onJoin(ws, a, m);
      case "state": return this.onState(ws, a, m);
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
      this.send(ws, { t: "welcome", id: a.id, online: this.online() });
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
