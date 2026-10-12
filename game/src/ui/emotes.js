// Action wheel: dances work offline; social emotes / quick phrases use multiplayer.
import { tx } from "../content/content.js";
import { t, lang } from "../i18n.js";
import { device } from "../core/device.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export class EmotePanel {
  constructor(net, dances) {
    this.net = net;
    this.game = net.g;
    this.dances = dances;
    this.tab = "dance";
    this.page = 0;
    this.pageSize = 8;
    const el = document.createElement("div");
    el.id = "emotes";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    document.body.appendChild(el);
    el.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.i != null) this.pick(+b.dataset.i);
      else if (b.dataset.tab) { this.tab = b.dataset.tab; this.page = 0; this.draw(); }
      else if (b.dataset.a === "close") this.hide();
      else if (b.dataset.a === "prev") this.turnPage(-1);
      else if (b.dataset.a === "next") this.turnPage(1);
      else if (b.dataset.a === "stop") { this.dances.stop(); this.hide(); }
    });
    el.addEventListener("keydown", e => {
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault(); this.turnPage(e.code === "ArrowLeft" ? -1 : 1);
      }
      if (e.key === "Tab") {
        const buttons = [...el.querySelectorAll("button:not([disabled])")];
        const i = buttons.indexOf(document.activeElement);
        e.preventDefault(); buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    });
    this.el = el;
    this.btn = Object.assign(document.body.appendChild(document.createElement("button")), { id: "action-btn", type: "button", hidden: true });
    this.btn.addEventListener("click", () => this.toggle());
    addEventListener("resize", () => this.layout());
    window.visualViewport?.addEventListener("resize", () => this.layout());
    this.draw();
  }
  get open() { return !this.el.hidden; }
  get allItems() {
    if (this.tab === "dance") return this.dances.items.map(d => ({ ...d, kind: "dance", text: tx(d.label) }));
    return [...this.net.emotes.filter(e => !e.dance).map(e => ({ ...e, kind: "emote", text: tx(e.label) })),
      ...this.net.phrases.map(p => ({ ...p, kind: "phrase", text: tx(p.text), icon: "💬" }))];
  }
  get pages() { return Math.max(1, Math.ceil(this.allItems.length / this.pageSize)); }
  layout() {
    const size = (window.visualViewport?.height ?? innerHeight) < 340 ? 4 : 8;
    if (size !== this.pageSize) { this.pageSize = size; this.page = Math.min(this.page, this.pages - 1); this.draw(); }
  }
  draw() {
    this.language = lang;
    this.items = this.allItems.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
    this.btn.innerHTML = `🕺 <span>${esc(t("actions.title"))}</span><kbd>T</kbd>`;
    this.btn.setAttribute("aria-label", t("actions.title"));
    this.el.setAttribute("aria-label", t("actions.title"));
    const choices = this.items.map((item, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / this.pageSize;
      const disabled = item.kind !== "dance" && !this.net.connected;
      return `<button class="wheel-choice" data-i="${i}" data-id="${esc(item.id)}" style="left:${50 + 38 * Math.cos(a)}%;top:${50 + 38 * Math.sin(a)}%"
        title="${esc(item.source?.replace(/\.fbx$/i, "") || item.text)}" aria-label="${esc(item.text)}" ${disabled ? "disabled" : ""}>
        <span class="icon" aria-hidden="true">${item.icon || "🕺"}</span><span>${esc(item.text)}</span><kbd>${i + 1}</kbd></button>`;
    }).join("");
    this.el.innerHTML = `<section class="action-panel"><header><b>${esc(t("actions.title"))}</b><button data-a="close" aria-label="${esc(t("actions.close"))}">×</button></header>
      <nav class="action-tabs" aria-label="${esc(t("actions.categories"))}"><button data-tab="dance" aria-pressed="${this.tab === "dance"}">${esc(t("actions.dance"))}</button>
      <button data-tab="social" aria-pressed="${this.tab === "social"}">${esc(t("actions.social"))}</button></nav>
      <div class="action-wheel">${choices}<button class="wheel-stop" data-a="stop">■<small>${esc(t("actions.stop"))}</small></button></div>
      <footer><button data-a="prev" aria-label="${esc(t("actions.prev"))}" ${this.pages === 1 ? "disabled" : ""}>‹</button>
      <span aria-live="polite">${this.page + 1} / ${this.pages} · ${this.allItems.length} ${esc(t("actions.choices"))}</span>
      <button data-a="next" aria-label="${esc(t("actions.next"))}" ${this.pages === 1 ? "disabled" : ""}>›</button></footer></section>`;
  }
  turnPage(delta) {
    this.page = (this.page + delta + this.pages) % this.pages;
    this.draw();
    this.el.querySelector(`[data-a=${delta > 0 ? "next" : "prev"}]`)?.focus();
  }
  toggle() { this.open ? this.hide() : this.show(); }
  show() {
    const g = this.game;
    if (g.mode !== "play" || g.state.phase !== "playing" || g.player?.seated) return;
    this.returnFocus = document.activeElement;
    this.layout(); this.draw();
    this.el.hidden = false;
    g.setMode("actions");
    this.el.querySelector(".wheel-choice:not([disabled])")?.focus();
  }
  hide() {
    this.el.hidden = true;
    if (this.game.mode === "actions") this.game.setMode("play");
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }
  pick(i) {
    const x = this.items[i];
    if (!x) return false;
    if (x.kind === "dance") { this.hide(); void this.dances.play(x.id); return true; }
    if (!this.net.connected) return false;
    this.hide();
    const ok = x.kind === "emote" ? this.net.emote(x.id) : this.net.phrase(x.id);
    if (!ok) this.show();
    return ok;
  }
  update() {
    if (this.language !== lang || this.open && this.tab === "social" && this.connection !== this.net.connected) this.draw();
    this.connection = this.net.connected;
    this.layout();
    const g = this.game;
    this.btn.hidden = device.touch || g.mode !== "play" || g.state.phase !== "playing" || !!g.cutscene || !!g.preview || !!g.timeSkipping;
  }
}
