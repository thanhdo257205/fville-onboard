// Chơi nhiều người mức "thấy nhau" (data/net.json, docs/multiplayer.md): không mã phòng — máy chủ tự xếp phòng (~30 người
// mỗi phòng, welcome.room). url trống = tắt mạng (game y như chơi một mình). Kết nối sau khi bấm "Start my first day"; lỗi
// mạng thì vẫn chơi bình thường, tự thử lại. Gửi: join {name, model, outfit, zone} (gửi lại khi đổi bộ đồ), state {zone,
// pos, yaw, anim} tối đa send_hz lần/giây và chỉ khi có thay đổi, emote {id}, phrase {id}; bi-a (game/src/pool/table.js):
// pool_* khi máy chủ báo features "pool"; nhắn tin tự do chat {ch, to, text} khi máy chủ báo "chat" (data/chat.json — máy chủ
// lọc từ, người gửi nhận lại bản đã lọc; khung chat: ../ui/chat.js). Góc màn hình: "N online · M in this zone" (phòng 2 trở
// đi: "Room 2 · …").
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { NetClient } from "./client.js";
import { RemotePlayers } from "./remotes.js";
import { tx } from "../content/content.js";
import { t } from "../i18n.js";
import { sound } from "../core/sound.js";

export class Net {
  constructor({ game, cfg, settings }) {
    this.g = game;
    this.cfg = cfg || {};
    this.settings = settings;
    this.enabled = typeof this.cfg.url === "string" && /^wss?:\/\//.test(this.cfg.url.trim());
    this.emotes = this.cfg.emotes || [];
    this.phrases = this.cfg.phrases || [];
    this.online = 0;
    this.myId = null;
    this.joined = false;
    this.room = 1;
    this.features = [];         // máy chủ báo trong welcome; máy chủ cũ: [] → bàn bi-a chỉ tập một mình
    this.sent = null;           // state đã gửi gần nhất
    this.sentAt = 0;
    this.profileSent = null;
    this.cooldown = 0;
    this.log = [];              // emote / câu chat đã nhận (để __game kiểm tra)
    // nhắn tin: lịch sử mỗi kênh trong lượt chơi (không vào bản lưu) — zone, all, dm:<id người kia>; người đã mute (id phiên)
    this.chatCfg = this.cfg.chat || {};
    this.chats = new Map();
    this.muted = new Set();
    this.people = new Map();    // id → tên người từng nhắn / đang cùng zone (chọn người nhắn riêng)
    this.chatTokens = this.chatCfg.burst ?? 5;
    this.chatAt = 0;
    this.onChat = null;         // (entry) → khung chat vẽ lại
    this.onChatError = null;    // (code)
    if (!this.enabled) return;
    this.remotes = new RemotePlayers({ game, cfg: this.cfg, phrases: this.phrases });
    this.remotes.show = settings.players !== false;
    this.client = new NetClient({ ...this.cfg, url: this.cfg.url.trim() }, {
      onOpen: () => this.sendJoin(),
      onMessage: (m) => this.onMessage(m),
      onClose: () => this.onClose(),
    });
    // góc màn hình (dưới đồng hồ), ẩn khi chưa kết nối
    this.hudEl = Object.assign(document.getElementById("hud").appendChild(document.createElement("div")), { id: "net-online" });
    this.hudEl.hidden = true;
    // bong bóng câu chat của chính mình (trên đầu người chơi)
    const el = document.createElement("div");
    el.className = "speech";
    el.innerHTML = "<span></span>";
    this.myBubble = new CSS2DObject(el);
    this.myBubble.center.set(0.5, 1);
    this.myBubble.visible = false;
    this.myBubbleLeft = 0;
    game.scene.add(this.myBubble);
  }

  start() { if (this.enabled) this.client.start(); }
  stop() { if (this.enabled) this.client.stop(); }
  get connected() { return this.enabled && this.joined && this.client.open; }
  get poolOn() { return this.connected && this.features.includes("pool"); }
  // cú bi-a có xoáy (máy chủ báo "pool_spin"; bàn còn phải báo tb.spin — mọi người ngồi đều dùng bản hiểu xoáy)
  get poolSpin() { return this.connected && this.features.includes("pool_spin"); }
  // nhắn tin tự do: máy chủ có "chat" + người chơi không tắt chat (menu Esc)
  get chatOn() { return this.connected && this.features.includes("chat") && this.settings.chat !== false; }
  sendPool(msg) { return this.connected ? this.client.send(msg) : false; }

  // ---------- gửi ----------
  profile() {
    const g = this.g, chars = g.characters, o = chars.role("player")?.outfit;
    // bộ đồ chọn trong tủ đồ (Game.playerOutfit): Áo Cam FPT → "ao_cam"; bộ ngày đầu mặc định → ""; bộ khác → id texture
    const pick = g.playerOutfit?.() ?? "";
    const outfit = !o ? "" : pick === o.until_reward ? o.until_reward : pick === o.texture ? "" : pick;
    // model theo giới tính / ngoại hình; acc: phụ kiện đang đội (vd mũ lưỡi trai — máy chủ cũ bỏ qua trường này)
    return { name: g.progress.player.name, model: chars.modelId("player") || "", outfit, acc: g.wornAccessories?.() || [] };
  }
  sendJoin() {
    const z = this.g.state.zone;
    if (!z) return;
    const p = this.profile();
    this.client.send({ t: "join", ...p, zone: z });
    // danh sách người cùng zone máy chủ trả về là của zone này → update() không coi là "vừa đổi zone" mà xoá mất (xảy ra
    // khi tin "zone" về trước khung đầu tiên, vd tab đang ẩn lúc kết nối)
    this.zoneSeen = z;
    this.profileSent = JSON.stringify(p);
    this.sent = null;           // gửi lại vị trí ngay
  }
  localState() {
    const g = this.g, pl = g.player;
    if (!pl || g.state.phase !== "playing" || !g.state.zone) return null;
    // đang ngồi ghế (bàn làm việc zone 5): gửi "sit" + vị trí gốc nhân vật (đã nâng lên mặt ghế)
    const p = pl.seated ? pl.character.root.position : pl.position, sp = pl.speed, { walk, run } = pl.character.model.speed_mps;
    const anim = pl.seated ? "sit" : sp < 0.25 ? "idle" : sp < (walk + run) / 2 ? "walk" : "run";
    // đang ngồi trên xe bus (cảnh chuyển zone 0 → 1, cảnh kết): nhân vật khuất → báo "đang di chuyển" (transit_zone) để
    // người cùng zone thấy mình rời đi, không còn đứng ở cửa xe; máy chủ không cần đổi (zone_NN hợp lệ)
    const riding = !!g.cutscene && !pl.character.root.visible;
    const zone = riding ? this.cfg.transit_zone || "zone_99" : g.state.zone;
    return { zone, pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], yaw: +pl.character.root.rotation.y.toFixed(2), anim };
  }
  get inTransit() { return this.sent?.zone === (this.cfg.transit_zone || "zone_99"); }
  changed(a, b) {
    if (!b || a.zone !== b.zone || a.anim !== b.anim) return true;
    const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
    const dy = Math.abs(Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw)));
    return d > 0.02 || dy > 0.035;
  }

  // emote / câu chat (bảng phím T): diễn / nói ngay ở máy mình, gửi cho người cùng zone
  canAct() { return this.connected && this.g.mode === "play" && this.g.state.phase === "playing" && this.cooldown <= 0; }
  emote(id) {
    const e = this.emotes.find((x) => x.id === id);
    if (!e || !this.canAct()) return false;
    this.cooldown = this.cfg.cooldown_s ?? 1.5;
    const ch = this.g.player.character, act = ch.playOnce(e.anim);
    this.myEmote = ch.current;
    act.then(() => { if (this.g.player.character === ch && ch.current === this.myEmote) { this.myEmote = null; ch.enableLocomotion(); } });
    this.client.send({ t: "emote", id });
    return true;
  }
  phrase(id) {
    const p = this.phrases.find((x) => x.id === id);
    if (!p || !this.canAct()) return false;
    this.cooldown = this.cfg.cooldown_s ?? 1.5;
    this.sayMine(tx(p.text));
    this.client.send({ t: "phrase", id });
    return true;
  }
  // nhắn tin: ch "zone" | "all" | "dm" (to = id người nhận). Kiểm tra trước như máy chủ (độ dài, chống spam) để báo ngay →
  // true | mã lỗi ("off" | "empty" | "long" | "rate" | "nobody"). Tin hiện khi máy chủ gửi lại bản đã lọc
  chat(ch, text, to = null) {
    if (!this.chatOn) return "off";
    const s = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!s) return "empty";
    if ([...s].length > (this.chatCfg.max_len ?? 120)) return "long";
    if (ch === "dm" && (!to || to === this.myId)) return "nobody";
    const now = performance.now(), rate = this.chatCfg.rate_per_s ?? 1, burst = this.chatCfg.burst ?? 5;
    this.chatTokens = Math.min(burst, this.chatTokens + ((now - (this.chatAt || now)) / 1000) * rate);
    this.chatAt = now;
    if (this.chatTokens < 1) return "rate";
    this.chatTokens -= 1;
    this.client.send({ t: "chat", ch, text: s, ...(ch === "dm" ? { to } : {}) });
    return true;
  }
  chatKey(m) { return m.ch === "dm" ? `dm:${m.id === this.myId ? m.to : m.id}` : m.ch; }
  history(key) { return this.chats.get(key) || []; }
  mute(id, on = true) { if (on) this.muted.add(id); else this.muted.delete(id); }
  onChatMessage(m) {
    if (this.settings.chat === false || typeof m.text !== "string" || !["zone", "all", "dm"].includes(m.ch)) return;
    const mine = m.id === this.myId;
    if (!mine && this.muted.has(m.id)) return;
    if (!mine && m.name) this.people.set(m.id, m.name);
    if (m.ch === "dm") this.people.set(mine ? m.to : m.id, mine ? m.toName || this.people.get(m.to) || "?" : m.name);
    const key = this.chatKey(m), list = this.chats.get(key) || [];
    const entry = { key, ch: m.ch, id: m.id, name: m.name || "?", text: m.text, mine, to: m.to ?? null, at: Date.now() };
    list.push(entry);
    const keep = this.chatCfg.history ?? 50;
    if (list.length > keep) list.splice(0, list.length - keep);
    this.chats.set(key, list);
    // tin cùng zone: bong bóng trên đầu người gửi (người khác: ẩn theo "Show other players")
    if (m.ch === "zone" && m.zone === this.g.state.zone && !this.inTransit) {
      if (mine) this.sayMine(m.text, this.chatCfg.bubble_s); else this.remotes.say(m.id, m.text, this.chatCfg.bubble_s);
    }
    if (!mine) sound.play("nudge");
    this.onChat?.(entry);
  }
  sayMine(text, seconds = null) {
    sound.play("nudge");
    const el = this.myBubble.element;
    el.querySelector("span").textContent = text;
    this.myBubble.visible = true;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    this.myBubbleLeft = seconds ?? this.cfg.bubble_s ?? 4;
  }

  // ---------- nhận ----------
  onMessage(m) {
    const r = this.remotes;
    // đang trên xe (transit_zone): bỏ qua người khác (người cùng xe ở zone khác toạ độ) tới khi xuống xe
    if (this.inTransit && ["join", "state", "emote", "phrase"].includes(m.t)) return;
    switch (m.t) {
      case "welcome":
        this.myId = m.id; this.online = m.online; this.joined = true;
        this.room = Number.isInteger(m.room) ? m.room : 1;
        this.features = Array.isArray(m.features) ? m.features : [];
        this.client.ok();
        break;
      // bàn bi-a chung (chỉ gửi cho người ở zone của bàn): bàn đang dựng thì đưa thẳng, chưa có thì giữ lại cho lúc dựng
      case "pool":
      case "pool_shot": if (this.g.pool) this.g.pool.onNet(m); else if (m.tb) this.g.poolShared = { tb: m.tb, state: null }; break;
      case "zone": if (m.zone === this.g.state.zone && !this.inTransit) r.reset(m.players || []); this.online = m.online ?? this.online; break;
      case "join": if (m.p?.id && m.p.id !== this.myId) r.upsert(m.p); break;
      case "state": r.state(m); break;
      case "leave": r.remove(m.id); break;
      case "online": this.online = m.n; break;
      case "emote": {
        const e = this.emotes.find((x) => x.id === m.e);
        if (e) { r.emote(m.id, e.anim); this.log.push({ from: m.id, emote: m.e }); }
        break;
      }
      case "phrase": {
        const p = this.phrases.find((x) => x.id === m.p);
        if (p) { r.say(m.id, tx(p.text)); this.log.push({ from: m.id, phrase: m.p }); }
        break;
      }
      case "chat": this.onChatMessage(m); break;
      case "chat_err": this.chatErrors = (this.chatErrors || 0) + 1; this.onChatError?.(m.code); break;
      case "error": this.lastError = m.code; break;
      default: break;
    }
    if (this.log.length > 30) this.log.splice(0, this.log.length - 30);
  }
  onClose() {
    this.joined = false;
    this.remotes.reset();       // người khác không còn cập nhật → ẩn hết tới khi vào lại
    this.g.pool?.onNetLost();   // đang ở bàn bi-a chung → tập một mình tiếp với bàn đang có
    this.g.poolShared = null;
  }

  setShow(on) { this.remotes?.setShow(on); }

  // ---------- mỗi khung (kể cả lúc mở menu Esc: người khác vẫn đi lại) ----------
  update(dt) {
    if (!this.enabled) return;
    const g = this.g;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // đổi zone ở máy mình: bỏ người của zone cũ (máy chủ gửi danh sách zone mới khi nhận state)
    if (g.state.zone !== this.zoneSeen) { this.zoneSeen = g.state.zone; this.remotes.reset(); }
    if (this.connected) {
      const p = this.profile(), ps = JSON.stringify(p);
      if (ps !== this.profileSent) this.sendJoin();              // vd vừa mặc Áo Cam FPT
      const now = performance.now(), s = this.localState();
      if (s && now - this.sentAt >= 1000 / (this.cfg.send_hz ?? 5) && this.changed(s, this.sent)) {
        if (s.zone !== this.sent?.zone && s.zone === (this.cfg.transit_zone || "zone_99")) this.remotes.reset();
        this.client.send({ t: "state", ...s });
        this.sent = s;
        this.sentAt = now;
      }
    }
    // emote của mình: đi / chạy hoặc bắt đầu hội thoại thì thôi
    const ch = g.player?.character;
    if (this.myEmote && ch && (g.player.speed > 0.4 || g.mode !== "play") && ch.current === this.myEmote) { this.myEmote = null; ch.enableLocomotion(); }
    if (this.myBubbleLeft > 0) {
      this.myBubbleLeft -= dt;
      if (this.myBubbleLeft <= 0) this.myBubble.visible = false;
      else if (ch) this.myBubble.position.copy(ch.root.position).setY(ch.root.position.y + ch.model.height_m + 0.55);
    }
    this.remotes.update(dt);
    // góc màn hình
    const show = this.connected;
    if (this.hudEl.hidden === show) this.hudEl.hidden = !show;
    if (show) {
      const vars = { n: Math.max(1, this.online), m: this.remotes.list.size + 1, r: this.room };
      const text = t(this.room > 1 ? "net.online_room" : "net.online", vars);
      if (this.hudEl.textContent !== text) this.hudEl.textContent = text;
    }
  }

  info() {
    if (!this.enabled) return { enabled: false };
    const c = this.client;
    return { enabled: true, status: c.status, connected: this.connected, id: this.myId, online: this.online, room: this.room, features: [...this.features], inZone: this.remotes.list.size + 1,
      show: this.remotes.show, retryIn: c.retryIn ?? null, attempt: c.attempt, stats: { ...c.stats }, hud: this.hudEl.hidden ? null : this.hudEl.textContent,
      sent: this.sent, myBubble: this.myBubble.visible ? this.myBubble.element.textContent : null, myEmote: this.myEmote ? this.myEmote.getClip().name : null,
      log: [...this.log], remotes: this.remotes.info(), lastError: this.lastError ?? null,
      chat: { on: this.chatOn, muted: [...this.muted], errors: this.chatErrors || 0, people: [...this.people].map(([id, name]) => ({ id, name })),
        channels: Object.fromEntries([...this.chats].map(([k, v]) => [k, v.map((e) => ({ id: e.id, name: e.name, text: e.text, mine: e.mine }))])) } };
  }
}
