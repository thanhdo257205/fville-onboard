// Khung chat (nhắn tin tự do giữa người chơi — máy chủ báo features "chat", ../net/net.js → chat()). Góc trái dưới.
//   • Đóng: chỉ hiện vài tin mới nhất (mọi kênh, mờ dần sau ~12 s) + số tin chưa đọc. Enter (đang đi lại / ở bàn bi-a) → mở.
//   • Mở: game chuyển chế độ "chat" (nhân vật đứng yên, hiện con trỏ, phím gõ vào ô chữ không điều khiển game); 3 tab Zone
//     (người cùng zone — kèm bong bóng trên đầu người gửi) / All (cả phòng) / Private (nhắn riêng: chọn người trong danh sách,
//     hoặc bấm vào tên trong tin / bảng tên người chơi); Enter gửi, Enter khi ô trống hoặc Esc đóng.
//   • Bấm tên người gửi → nhắn riêng / tắt nhận tin (mute) / bật lại. Lần đầu mở: thẻ quy tắc ứng xử (lưu settings.chat_rules).
//   • Tin bị lọc ở máy chủ (data/chat.json → filter); mọi chữ hiện bằng textContent (không chèn HTML của người khác).
import { t } from "../i18n.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TABS = ["zone", "all", "dm"];
const FADE_MS = 12000;          // đóng: tin mới hiện chừng ấy rồi mờ đi
const PEEK = 5;                 // đóng: số tin mới nhất hiện

export class ChatPanel {
  constructor({ net, game, settings, save }) {
    Object.assign(this, { net, game, settings, save });
    this.tab = "zone";
    this.dmWith = null;         // id người đang nhắn riêng
    this.unread = { zone: 0, all: 0, dm: 0 };
    this.recent = [];           // tin mới (hiện khi đóng)
    this.isOpen = false;
    this.prevMode = "play";
    const el = document.createElement("div");
    el.id = "chat";
    el.hidden = true;
    el.innerHTML = `
      <div class="peek"></div>
      <div class="box">
        <div class="tabs">${TABS.map((k) => `<button type="button" data-tab="${k}">${esc(t(`chat.tab_${k}`))}<i></i></button>`).join("")}</div>
        <div class="dmbar"><span>${esc(t("chat.to"))}</span><select></select></div>
        <div class="rules" hidden><b>${esc(t("chat.rules_title"))}</b><p>${esc(t("chat.rules"))}</p><button type="button" data-a="rules">${esc(t("chat.rules_ok"))}</button></div>
        <div class="log"></div>
        <form><input type="text" autocomplete="off" spellcheck="false" maxlength="${net.chatCfg.max_len ?? 120}"><button type="submit">${esc(t("chat.send"))}</button></form>
        <small class="err"></small>
        <small class="help">${esc(t("chat.help"))}</small>
      </div>
      <div class="who" hidden></div>`;
    document.getElementById("hud").appendChild(el);
    this.el = el;
    this.input = el.querySelector("input");
    this.select = el.querySelector("select");
    el.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); this.send(); });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.close(); }
    });
    el.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-tab]")?.dataset.tab;
      if (tab) { this.setTab(tab); return; }
      if (e.target.closest("[data-a=rules]")) { this.settings.chat_rules = true; this.save?.(); this.draw(); this.input.focus(); return; }
      const who = e.target.closest("[data-who]");
      if (who) { this.whoMenu(who.dataset.who, who.dataset.name, who); return; }
      const act = e.target.closest("[data-act]");
      if (act) { this.whoAction(act.dataset.act, act.dataset.id, act.dataset.name); return; }
      if (!e.target.closest(".who")) this.el.querySelector(".who").hidden = true;
    });
    this.select.addEventListener("change", () => { this.dmWith = this.select.value || null; this.draw(); this.input.focus(); });
    net.onChat = (entry) => this.onMessage(entry);
    net.onChatError = (code) => this.showError(code);
  }

  get available() { return this.net.chatOn; }

  // ---------- mở / đóng ----------
  open(tab = null, dmWith = null) {
    if (!this.available) return false;
    if (tab) this.tab = tab;
    if (dmWith) { this.tab = "dm"; this.dmWith = dmWith; }
    if (!this.isOpen) {
      this.prevMode = this.game.mode === "pool" ? "pool" : "play";
      this.isOpen = true;
      this.game.setMode("chat");
    }
    this.el.classList.add("open");
    document.body.classList.add("chat-open");
    this.unread[this.tab] = 0;
    this.draw();
    setTimeout(() => this.input.focus(), 0);
    return true;
  }
  // restore: trả game về chế độ trước (đi lại / bàn bi-a); false khi game đã tự đổi chế độ (vd hội thoại bắt đầu)
  close(restore = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove("open");
    document.body.classList.remove("chat-open");
    this.el.querySelector(".who").hidden = true;
    this.input.blur();
    this.setError("");
    if (restore && this.game.mode === "chat") this.game.setMode(this.prevMode);
    this.draw();
  }
  setTab(tab) {
    this.tab = tab;
    this.unread[tab] = 0;
    this.draw();
    this.input.focus();
  }

  // ---------- gửi / nhận ----------
  send() {
    const text = this.input.value;
    if (!text.trim()) { this.close(); return; }
    if (this.tab === "dm" && !this.dmWith) { this.showError("pick"); return; }
    const r = this.net.chat(this.tab, text, this.dmWith);
    if (r === true) { this.input.value = ""; this.setError(""); }
    else this.showError(r);
  }
  onMessage(entry) {
    const tab = entry.ch;
    // nhắn riêng tới mình khi chưa chọn ai → mở luôn cuộc trò chuyện đó ở tab Private
    if (tab === "dm" && !this.dmWith && !entry.mine) this.dmWith = entry.id;
    const seen = this.isOpen && this.tab === tab && (tab !== "dm" || entry.key === `dm:${this.dmWith}`);
    if (!seen && !entry.mine) this.unread[tab]++;
    this.recent.push({ ...entry, shownAt: performance.now() });
    if (this.recent.length > PEEK) this.recent.shift();
    this.draw();
  }
  showError(code) { this.setError(t(`chat.err_${code}`)); }
  setError(text) { this.el.querySelector(".err").textContent = text || ""; }

  // ---------- bấm tên: nhắn riêng / mute ----------
  whoMenu(id, name, anchor) {
    const menu = this.el.querySelector(".who");
    if (!id || id === this.net.myId) { menu.hidden = true; return; }
    const muted = this.net.muted.has(id);
    menu.innerHTML = `<b></b><button type="button" data-act="dm" data-id="${esc(id)}">${esc(t("chat.dm"))}</button>
      <button type="button" data-act="${muted ? "unmute" : "mute"}" data-id="${esc(id)}">${esc(t(muted ? "chat.unmute" : "chat.mute"))}</button>`;
    menu.querySelector("b").textContent = name || "?";
    menu.querySelectorAll("[data-act]").forEach((b) => { b.dataset.name = name || ""; });
    const r = anchor.getBoundingClientRect(), box = this.el.getBoundingClientRect();
    menu.style.left = `${Math.max(0, r.left - box.left)}px`;
    menu.style.bottom = `${Math.max(0, box.bottom - r.top + 4)}px`;
    menu.hidden = false;
  }
  whoAction(act, id, name) {
    this.el.querySelector(".who").hidden = true;
    if (act === "dm") { if (name) this.net.people.set(id, name); this.open("dm", id); return; }
    this.net.mute(id, act === "mute");
    this.setError(t(act === "mute" ? "chat.muted" : "chat.unmuted", { name: name || "?" }));
    this.draw();
  }
  // bảng tên người chơi khác (../net/remotes.js) bấm được khi khung chat mở → nhắn riêng
  dmFromTag(id, name) { if (this.available) { if (name) this.net.people.set(id, name); this.open("dm", id); } }

  // ---------- vẽ ----------
  people() {
    const out = new Map(this.net.people);
    for (const [id, r] of this.net.remotes?.list || []) if (r.name) out.set(id, r.name);
    out.delete(this.net.myId);
    return [...out].sort((a, b) => a[1].localeCompare(b[1]));
  }
  line(e, withTab = false) {
    const p = document.createElement("p");
    p.className = `ch-${e.ch}${e.mine ? " mine" : ""}`;
    if (withTab) { const s = document.createElement("small"); s.textContent = `[${t(`chat.tab_${e.ch}`)}] `; p.append(s); }
    const b = document.createElement("b");
    b.textContent = e.ch === "dm" && e.mine ? t("chat.to_name", { name: this.net.people.get(e.to) || "?" }) : e.mine ? t("chat.you") : e.name;
    if (!e.mine) { b.dataset.who = e.id; b.dataset.name = e.name; }
    p.append(b, document.createTextNode(": "), document.createTextNode(e.text));
    return p;
  }
  draw() {
    const on = this.available;
    if (this.el.hidden === on) this.el.hidden = !on;
    if (!on) { if (this.isOpen) this.close(); return; }
    // tab + số chưa đọc
    this.el.querySelectorAll("[data-tab]").forEach((b) => {
      const k = b.dataset.tab;
      b.classList.toggle("on", k === this.tab);
      b.querySelector("i").textContent = this.unread[k] ? String(this.unread[k]) : "";
    });
    this.el.querySelector(".rules").hidden = !!this.settings.chat_rules;
    // nhắn riêng: chọn người
    const bar = this.el.querySelector(".dmbar");
    bar.hidden = this.tab !== "dm";
    if (this.tab === "dm") {
      const list = this.people();
      if (this.dmWith && !list.some(([id]) => id === this.dmWith)) list.unshift([this.dmWith, this.net.people.get(this.dmWith) || "?"]);
      this.select.innerHTML = `<option value="">${esc(t(list.length ? "chat.pick_person" : "chat.no_people"))}</option>`
        + list.map(([id, name]) => `<option value="${esc(id)}"${id === this.dmWith ? " selected" : ""}>${esc(name)}${this.net.muted.has(id) ? " 🔇" : ""}</option>`).join("");
    }
    const log = this.el.querySelector(".log");
    log.replaceChildren();
    if (this.isOpen) {
      const key = this.tab === "dm" ? (this.dmWith ? `dm:${this.dmWith}` : null) : this.tab;
      const list = key ? this.net.history(key) : [];
      if (!list.length) { const p = document.createElement("p"); p.className = "sys"; p.textContent = t(`chat.empty_${this.tab}`); log.append(p); }
      for (const e of list) log.append(this.line(e));
      log.scrollTop = log.scrollHeight;
    }
    // đóng: vài tin mới nhất, mọi kênh
    const peek = this.el.querySelector(".peek");
    peek.replaceChildren();
    if (!this.isOpen) {
      const now = performance.now();
      for (const e of this.recent) if (now - e.shownAt < FADE_MS) peek.append(this.line(e, true));
      const total = this.unread.zone + this.unread.all + this.unread.dm;
      if (total) { const p = document.createElement("p"); p.className = "sys"; p.textContent = t("chat.unread", { n: total }); peek.append(p); }
    }
  }
  // mỗi khung: tin cũ mờ đi khi đóng; game tự đổi chế độ (hội thoại, cảnh chuyển, menu) → đóng khung
  update() {
    if (this.isOpen && this.game.mode !== "chat") this.close(false);
    const on = this.available;
    if (this.el.hidden === on) this.draw();
    if (!this.isOpen && this.recent.length) {
      const now = performance.now(), before = this.recent.length;
      this.recent = this.recent.filter((e) => now - e.shownAt < FADE_MS);
      if (this.recent.length !== before) this.draw();
    }
  }
  info() {
    return { available: this.available, open: this.isOpen, tab: this.tab, dmWith: this.dmWith, unread: { ...this.unread },
      rules: !this.el.querySelector(".rules").hidden && this.isOpen, error: this.el.querySelector(".err").textContent,
      log: [...this.el.querySelectorAll(".log p")].map((p) => p.textContent), peek: [...this.el.querySelectorAll(".peek p")].map((p) => p.textContent) };
  }
}
