// Menu Esc: tạm dừng, chọn mức đồ hoạ (Tự động / Thấp / Cao), độ nét (Auto / Sharper / Faster), bật / tắt dấu chỉ
// đường, hiện / ẩn người chơi khác (chỉ khi bật mạng, data/net.json), đội / bỏ phụ kiện đã mở khoá (vd mũ lưỡi trai sau khi
// xong game — chưa có tab Wardrobe), ngôn ngữ (English / Tiếng Việt — đổi ngay, không mất tiến trình), âm thanh (bật / tắt,
// âm lượng hiệu ứng + tiếng nền — core/sound.js, lưu settings.sound), xem FPS, xem lại màn tổng kết (khi đã xong game), Chơi lại.
import { t, lang, LANGS } from "../i18n.js";
import { TIERS } from "../core/quality.js";
import { sound } from "../core/sound.js";

export class Menu {
  constructor({ onTier, onDetail, onGuide, onPlayers, onAccessory, onLang, onSound, onSummary, onClose, onPlayAgain, info }) {
    this.el = document.getElementById("menu");
    Object.assign(this, { onTier, onDetail, onGuide, onPlayers, onAccessory, onLang, onSound, onSummary, onClose, onPlayAgain, info });
    this.open = false;
    // tiếng bấm nút (nút Resume: tiếng đóng menu)
    this.el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && b.dataset.act !== "resume") sound.play("tap"); });
  }
  toggle() { this.open ? this.hide() : this.show(); }
  show() {
    this.open = true;
    this.el.hidden = false;
    sound.play("menu_open");
    this.draw();
    this._tick = setInterval(() => this.tick(), 500);   // chỉ cập nhật chữ (vẽ lại cả bảng thì nút bị thay giữa lúc bấm)
  }
  // silent: không gọi onClose (vd View summary: chuyển thẳng sang màn tổng kết, không qua chế độ chơi / khoá con trỏ)
  hide(silent = false) {
    this.open = false;
    this.el.hidden = true;
    clearInterval(this._tick);
    if (!silent) { sound.play("menu_close"); this.onClose?.(); }
  }
  draw() {
    const i = this.info();   // { setting, tier, gpu, fps, guide, detail, detailLevel, net, players, complete, sound: { on, sfx, amb } }
    const btn = (v) => `<button data-tier="${v}" class="${i.setting === v ? "on" : ""}">${t(`menu.${v}`)}</button>`;
    const dbtn = (v) => `<button data-detail="${v}" class="${i.detail === v ? "on" : ""}">${t(`menu.detail_${v}`)}</button>`;
    const gbtn = (on) => `<button data-guide="${on ? 1 : 0}" class="${i.guide === on ? "on" : ""}">${t(on ? "menu.on" : "menu.off")}</button>`;
    const sbtn = (on) => `<button data-sound="${on ? 1 : 0}" class="${i.sound.on === on ? "on" : ""}">${t(on ? "menu.on" : "menu.off")}</button>`;
    const vol = (k) => `<input type="range" min="0" max="100" step="5" data-vol="${k}" value="${Math.round(i.sound[k] * 100)}" aria-label="${t(`menu.${k}_volume`)}"${i.sound.on ? "" : " disabled"}>`;
    const pbtn = (on) => `<button data-players="${on ? 1 : 0}" class="${i.players === on ? "on" : ""}">${t(on ? "menu.on" : "menu.off")}</button>`;
    // phụ kiện đã mở khoá (vd mũ lưỡi trai sau khi xong game): [{ id, label, on }]
    const abtn = (a, on) => `<button data-acc="${a.id}" data-on="${on ? 1 : 0}" class="${a.on === on ? "on" : ""}">${t(on ? "menu.on" : "menu.off")}</button>`;
    // tên ngôn ngữ viết bằng chính ngôn ngữ đó (lang.en = English, lang.vi = Tiếng Việt ở cả 2 file chữ)
    const lbtn = (l) => `<button data-lang="${l}" lang="${l}" class="${lang === l ? "on" : ""}">${t(`lang.${l}`)}</button>`;
    const accRows = (i.accessories || []).map((a) => `<div class="row"><span>${a.label}</span><div class="seg">${abtn(a, true)}${abtn(a, false)}</div></div>`).join("");
    this.el.innerHTML = `
      <div class="panel">
        <h2>${t("menu.title")}</h2>
        <div class="row"><span>${t("menu.language")}</span><div class="seg">${LANGS.map(lbtn).join("")}</div></div>
        <div class="row"><span>${t("menu.sound")}</span><div class="seg">${sbtn(true)}${sbtn(false)}</div></div>
        <div class="row vol"><span>${t("menu.sfx_volume")}</span>${vol("sfx")}</div>
        <div class="row vol"><span>${t("menu.amb_volume")}</span>${vol("amb")}</div>
        <p class="muted">${t("menu.sound_note")}</p>
        <div class="row"><span>${t("menu.graphics")}</span><div class="seg">${btn("auto")}${btn("low")}${TIERS.includes("high") ? btn("high") : ""}</div></div>
        <p class="muted current">${t("menu.current", { tier: t(`tiers.${i.tier}`), gpu: i.gpu })}</p>
        <p class="muted fps">${t("menu.fps", { fps: Math.round(i.fps) })}</p>
        <div class="row"><span>${t("menu.detail")}</span><div class="seg">${dbtn("auto")}${dbtn("sharper")}${dbtn("faster")}</div></div>
        <p class="muted detail">${t("menu.detail_now", { level: t(`menu.detail_level_${i.detailLevel}`) })}</p>
        <div class="row"><span>${t("menu.guide")}</span><div class="seg">${gbtn(true)}${gbtn(false)}</div></div>
        <p class="muted">${t("menu.guide_note")}</p>
        ${i.net ? `<div class="row"><span>${t("menu.players")}</span><div class="seg">${pbtn(true)}${pbtn(false)}</div></div>` : ""}
        ${accRows ? `${accRows}<p class="muted">${t("menu.accessories_note")}</p>` : ""}
        <button class="primary" data-act="resume">${t("menu.resume")}</button>
        ${i.complete ? `<button class="ghost wide" data-act="summary">🏆 ${t("menu.view_summary")}</button>` : ""}
        <button class="ghost wide" data-act="again">${t("menu.play_again")}</button>
      </div>`;
    this.el.querySelectorAll("[data-tier]").forEach((b) => b.addEventListener("click", () => this.onTier(b.dataset.tier)));
    this.el.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => this.onDetail?.(b.dataset.detail)));
    this.el.querySelectorAll("[data-guide]").forEach((b) => b.addEventListener("click", () => this.onGuide?.(b.dataset.guide === "1")));
    this.el.querySelectorAll("[data-players]").forEach((b) => b.addEventListener("click", () => this.onPlayers?.(b.dataset.players === "1")));
    this.el.querySelectorAll("[data-sound]").forEach((b) => b.addEventListener("click", () => this.onSound?.({ on: b.dataset.sound === "1" }, { redraw: true })));
    // kéo thanh âm lượng: đổi ngay (không vẽ lại bảng — thanh đang kéo bị thay); thả tay: lưu + nghe thử
    this.el.querySelectorAll("[data-vol]").forEach((r) => {
      r.addEventListener("input", () => this.onSound?.({ [r.dataset.vol]: r.value / 100 }, { store: false }));
      r.addEventListener("change", () => { this.onSound?.({ [r.dataset.vol]: r.value / 100 }); if (r.dataset.vol === "sfx") sound.play("tap"); });
    });
    this.el.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.lang !== lang) this.onLang?.(b.dataset.lang); }));
    this.el.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", () => this.onAccessory?.(b.dataset.acc, b.dataset.on === "1")));
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
