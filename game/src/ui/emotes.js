// Bảng emote + câu chat soạn sẵn (chơi nhiều người, data/net.json): phím T mở / đóng, phím 1–9 hoặc bấm chuột để chọn.
// Không chặn điều khiển (vẫn đi lại được khi bảng đang mở); chọn xong tự đóng. KHÔNG có chat tự do.
import { tx } from "../content/content.js";
import { t } from "../i18n.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export class EmotePanel {
  constructor(net) {
    this.net = net;
    this.items = [...net.emotes.map((e) => ({ kind: "emote", id: e.id, text: `${e.icon || ""} ${tx(e.label)}`.trim() })),
      ...net.phrases.map((p) => ({ kind: "phrase", id: p.id, text: tx(p.text) }))].slice(0, 9);
    const el = document.createElement("div");
    el.id = "emotes";
    el.hidden = true;
    el.innerHTML = `<b>${esc(t("net.panel_title"))} <kbd>T</kbd></b>
      <ol>${this.items.map((x, i) => `<li data-i="${i}" class="${x.kind}"><kbd>${i + 1}</kbd>${esc(x.text)}</li>`).join("")}</ol>
      <small>${esc(t("net.panel_help"))}</small>`;
    document.getElementById("hud").appendChild(el);
    el.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) this.pick(+li.dataset.i); });
    this.el = el;
  }
  get open() { return !this.el.hidden; }
  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.el.hidden = false; }
  hide() { this.el.hidden = true; }
  // → true nếu đã gửi (đang chờ giữa 2 lần thì giữ bảng mở)
  pick(i) {
    const x = this.items[i];
    if (!x) return false;
    const ok = x.kind === "emote" ? this.net.emote(x.id) : this.net.phrase(x.id);
    if (ok) this.hide();
    return ok;
  }
}
