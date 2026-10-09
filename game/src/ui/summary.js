// Màn tổng kết (GDD mục Kết thúc và màn tổng kết) — bản dựng sẵn: thành tựu cuối đứng đầu ("ACHIEVEMENT UNLOCKED:
// Welcome to the F-Ville Family"), rồi danh hiệu chính / phụ, ảnh check-in, chỉ số, hạt lúa, 6 ô giá trị, tiến độ 4 Act.
// Mở bằng Game.finishGame() (hiệu ứng "finish": true, hoặc __game.finish() khi thử). Esc / Close: đóng, chơi tiếp.
import { t } from "../i18n.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export class Summary {
  constructor({ onPlayAgain } = {}) {
    this.onPlayAgain = onPlayAgain;
    const el = document.createElement("div");
    el.id = "summary";
    el.hidden = true;
    document.body.appendChild(el);
    this.el = el;
    el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "close") this.hide();
      if (a === "again") this.onPlayAgain?.();
    });
  }
  get open() { return !this.el.hidden; }

  show(d, onClose) {
    this.onClose = onClose;
    this.data = d;
    const stat = (k) => `<div class="stat"><span>${t(`stats.${k}`)}</span><div class="bar"><i style="width:${d.stats[k]}%"></i></div><b>${d.stats[k]}</b></div>`;
    this.el.innerHTML = `<div class="panel">
      ${d.achievement ? `<div class="ach"><div class="label">🏆 ${esc(d.achievement.label)}</div><div class="title">${esc(d.achievement.title)}</div>
        <small>${esc(d.achievement.desc)}</small></div>` : ""}
      <h2>${esc(t("summary.heading", { name: d.name }))}</h2>
      ${d.title ? `<div class="titles"><div class="main"><span>${t("summary.title")}</span><b>${esc(d.title.title)}</b><small>${esc(d.title.desc)}</small></div>
        ${d.subtitles.length ? `<ul>${d.subtitles.map((x) => `<li><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></li>`).join("")}</ul>` : ""}</div>` : ""}
      <div class="row">${d.photo ? `<img class="photo" src="${d.photo}" alt="">` : ""}
        <div class="stats">${stat("hieu_biet")}${stat("ket_noi")}<p>🌾 ${esc(t("summary.grains", { n: d.grains, total: d.grainsTotal }))}</p></div></div>
      <div class="values">${d.values.map((v) => `<span class="${v.lit ? "lit" : ""}">${esc(v.name)}</span>`).join("")}</div>
      <ol class="acts">${d.acts.map((a) => `<li class="${a.done === a.total ? "done" : ""}">${esc(t("acts.label", { n: a.number }))} · ${esc(a.title)}<em>${a.done}/${a.total}</em></li>`).join("")}</ol>
      <footer><button class="ghost" data-a="close">${t("summary.close")} <kbd>Esc</kbd></button>
        <button class="primary" data-a="again">${t("menu.play_again")}</button></footer></div>`;
    this.el.hidden = false;
  }
  hide() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }
}
