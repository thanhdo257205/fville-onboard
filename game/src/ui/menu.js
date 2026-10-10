// Menu Esc: tạm dừng, chọn mức đồ hoạ (Tự động / Thấp / Cao), độ nét (Auto / Sharper / Faster), bật / tắt dấu chỉ
// đường, hiện / ẩn người chơi khác (chỉ khi bật mạng, data/net.json), xem FPS, xem lại màn tổng kết (khi đã xong game),
// Chơi lại.
import { t } from "../i18n.js";

export class Menu {
  constructor({ onTier, onDetail, onGuide, onPlayers, onSummary, onClose, onPlayAgain, info }) {
    this.el = document.getElementById("menu");
    Object.assign(this, { onTier, onDetail, onGuide, onPlayers, onSummary, onClose, onPlayAgain, info });
    this.open = false;
  }
  toggle() { this.open ? this.hide() : this.show(); }
  show() {
    this.open = true;
    this.el.hidden = false;
    this.draw();
    this._tick = setInterval(() => this.tick(), 500);   // chỉ cập nhật chữ (vẽ lại cả bảng thì nút bị thay giữa lúc bấm)
  }
  // silent: không gọi onClose (vd View summary: chuyển thẳng sang màn tổng kết, không qua chế độ chơi / khoá con trỏ)
  hide(silent = false) {
    this.open = false;
    this.el.hidden = true;
    clearInterval(this._tick);
    if (!silent) this.onClose?.();
  }
  draw() {
    const i = this.info();   // { setting, tier, gpu, fps, guide, detail, detailLevel, net, players, complete }
    const btn = (v) => `<button data-tier="${v}" class="${i.setting === v ? "on" : ""}">${t(`menu.${v}`)}</button>`;
    const dbtn = (v) => `<button data-detail="${v}" class="${i.detail === v ? "on" : ""}">${t(`menu.detail_${v}`)}</button>`;
    const gbtn = (on) => `<button data-guide="${on ? 1 : 0}" class="${i.guide === on ? "on" : ""}">${t(on ? "menu.on" : "menu.off")}</button>`;
    const pbtn = (on) => `<button data-players="${on ? 1 : 0}" class="${i.players === on ? "on" : ""}">${t(on ? "menu.on" : "menu.off")}</button>`;
    this.el.innerHTML = `
      <div class="panel">
        <h2>${t("menu.title")}</h2>
        <div class="row"><span>${t("menu.graphics")}</span><div class="seg">${btn("auto")}${btn("low")}${btn("high")}</div></div>
        <p class="muted current">${t("menu.current", { tier: t(`tiers.${i.tier}`), gpu: i.gpu })}</p>
        <p class="muted fps">${t("menu.fps", { fps: Math.round(i.fps) })}</p>
        <div class="row"><span>${t("menu.detail")}</span><div class="seg">${dbtn("auto")}${dbtn("sharper")}${dbtn("faster")}</div></div>
        <p class="muted detail">${t("menu.detail_now", { level: t(`menu.detail_level_${i.detailLevel}`) })}</p>
        <div class="row"><span>${t("menu.guide")}</span><div class="seg">${gbtn(true)}${gbtn(false)}</div></div>
        <p class="muted">${t("menu.guide_note")}</p>
        ${i.net ? `<div class="row"><span>${t("menu.players")}</span><div class="seg">${pbtn(true)}${pbtn(false)}</div></div>` : ""}
        <button class="primary" data-act="resume">${t("menu.resume")}</button>
        ${i.complete ? `<button class="ghost wide" data-act="summary">🏆 ${t("menu.view_summary")}</button>` : ""}
        <button class="ghost wide" data-act="again">${t("menu.play_again")}</button>
      </div>`;
    this.el.querySelectorAll("[data-tier]").forEach((b) => b.addEventListener("click", () => this.onTier(b.dataset.tier)));
    this.el.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => this.onDetail?.(b.dataset.detail)));
    this.el.querySelectorAll("[data-guide]").forEach((b) => b.addEventListener("click", () => this.onGuide?.(b.dataset.guide === "1")));
    this.el.querySelectorAll("[data-players]").forEach((b) => b.addEventListener("click", () => this.onPlayers?.(b.dataset.players === "1")));
    this.el.querySelector("[data-act=resume]").addEventListener("click", () => this.hide());
    this.el.querySelector("[data-act=summary]")?.addEventListener("click", () => { clearInterval(this._tick); this.onSummary?.(); });
    this.el.querySelector("[data-act=again]").addEventListener("click", () => { clearInterval(this._tick); this.onPlayAgain?.(); });
  }
  tick() {
    const i = this.info();
    this.el.querySelector(".current").textContent = t("menu.current", { tier: t(`tiers.${i.tier}`), gpu: i.gpu });
    this.el.querySelector(".fps").textContent = t("menu.fps", { fps: Math.round(i.fps) });
    this.el.querySelector(".detail").textContent = t("menu.detail_now", { level: t(`menu.detail_level_${i.detailLevel}`) });
  }
}
