// Chơi nhiều người mức "thấy nhau" (data/net.json, docs/multiplayer.md): MỘT phòng chung cho mọi người, không mã phòng.
// url trống = tắt mạng (game y như chơi một mình). Kết nối sau khi bấm "Start my first day"; lỗi mạng thì vẫn chơi bình
// thường, tự thử lại. Gửi: join {name, model, outfit, zone} (gửi lại khi đổi bộ đồ), state {zone, pos, yaw, anim} tối đa
// send_hz lần/giây và chỉ khi có thay đổi, emote {id}, phrase {id}. Góc màn hình: "N online · M in this zone".
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
    this.sent = null;           // state đã gửi gần nhất
    this.sentAt = 0;
    this.profileSent = null;
    this.cooldown = 0;
    this.log = [];              // emote / câu chat đã nhận (để __game kiểm tra)
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

  // ---------- gửi ----------
  profile() {
    const g = this.g, chars = g.characters, o = chars.role("player")?.outfit;
    const wearing = o && (g.outfitOverride === o.until_reward || g.progress.hasReward(o.until_reward));
    return { name: g.progress.player.name, model: chars.role("player")?.model || "", outfit: wearing ? o.until_reward : "" };
  }
  sendJoin() {
    const z = this.g.state.zone;
    if (!z) return;
    const p = this.profile();
    this.client.send({ t: "join", ...p, zone: z });
    this.profileSent = JSON.stringify(p);
    this.sent = null;           // gửi lại vị trí ngay
  }
  localState() {
    const g = this.g, pl = g.player;
    if (!pl || g.state.phase !== "playing" || !g.state.zone) return null;
    const p = pl.position, sp = pl.speed, { walk, run } = pl.character.model.speed_mps;
    const anim = sp < 0.25 ? "idle" : sp < (walk + run) / 2 ? "walk" : "run";
    return { zone: g.state.zone, pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], yaw: +pl.character.root.rotation.y.toFixed(2), anim };
  }
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
  sayMine(text) {
    sound.play("nudge");
    const el = this.myBubble.element;
    el.querySelector("span").textContent = text;
    this.myBubble.visible = true;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    this.myBubbleLeft = this.cfg.bubble_s ?? 4;
  }

  // ---------- nhận ----------
  onMessage(m) {
    const r = this.remotes;
    switch (m.t) {
      case "welcome": this.myId = m.id; this.online = m.online; this.joined = true; this.client.ok(); break;
      case "zone": if (m.zone === this.g.state.zone) r.reset(m.players || []); this.online = m.online ?? this.online; break;
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
      case "error": this.lastError = m.code; break;
      default: break;
    }
    if (this.log.length > 30) this.log.splice(0, this.log.length - 30);
  }
  onClose() {
    this.joined = false;
    this.remotes.reset();       // người khác không còn cập nhật → ẩn hết tới khi vào lại
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
      const text = t("net.online", { n: Math.max(1, this.online), m: this.remotes.list.size + 1 });
      if (this.hudEl.textContent !== text) this.hudEl.textContent = text;
    }
  }

  info() {
    if (!this.enabled) return { enabled: false };
    const c = this.client;
    return { enabled: true, status: c.status, connected: this.connected, id: this.myId, online: this.online, inZone: this.remotes.list.size + 1,
      show: this.remotes.show, retryIn: c.retryIn ?? null, attempt: c.attempt, stats: { ...c.stats }, hud: this.hudEl.hidden ? null : this.hudEl.textContent,
      sent: this.sent, myBubble: this.myBubble.visible ? this.myBubble.element.textContent : null, myEmote: this.myEmote ? this.myEmote.getClip().name : null,
      log: [...this.log], remotes: this.remotes.info(), lastError: this.lastError ?? null };
  }
}
