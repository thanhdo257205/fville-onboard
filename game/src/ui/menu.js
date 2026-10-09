// Menu Esc: tạm dừng, chọn mức đồ hoạ (Tự động / Thấp / Cao), xem FPS, Chơi lại.
import { t } from "../i18n.js";

export class Menu {
  constructor({ onTier, onClose, onPlayAgain, info }) {
    this.el = document.getElementById("menu");
    Object.assign(this, { onTier, onClose, onPlayAgain, info });
    this.open = false;
  }
  toggle() { this.open ? this.hide() : this.show(); }
  show() {
    this.open = true;
    this.el.hidden = false;
    this.draw();
    this._tick = setInterval(() => this.draw(), 500);
  }
  hide() {
    this.open = false;
    this.el.hidden = true;
    clearInterval(this._tick);
    this.onClose?.();
  }
  draw() {
    const i = this.info();   // { setting, tier, gpu, fps }
    const btn = (v) => `<button data-tier="${v}" class="${i.setting === v ? "on" : ""}">${t(`menu.${v}`)}</button>`;
    this.el.innerHTML = `
      <div class="panel">
        <h2>${t("menu.title")}</h2>
        <div class="row"><span>${t("menu.graphics")}</span><div class="seg">${btn("auto")}${btn("low")}${btn("high")}</div></div>
        <p class="muted">${t("menu.current", { tier: t(`tiers.${i.tier}`), gpu: i.gpu })}</p>
        <p class="muted">${t("menu.fps", { fps: Math.round(i.fps) })}</p>
        <button class="primary" data-act="resume">${t("menu.resume")}</button>
        <button class="ghost wide" data-act="again">${t("menu.play_again")}</button>
      </div>`;
    this.el.querySelectorAll("[data-tier]").forEach((b) => b.addEventListener("click", () => this.onTier(b.dataset.tier)));
    this.el.querySelector("[data-act=resume]").addEventListener("click", () => this.hide());
    this.el.querySelector("[data-act=again]").addEventListener("click", () => { clearInterval(this._tick); this.onPlayAgain?.(); });
  }
}
