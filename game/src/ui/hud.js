// HUD: màn mờ chuyển zone, thẻ tên zone, dòng mục tiêu, gợi ý phím E, gợi ý điều khiển, thông báo (xếp hàng), màn tải.
import { t } from "../i18n.js";

const $ = (s) => document.querySelector(s);

export const hud = {
  fade(on, ms = 350) {
    const el = $("#fade");
    el.style.transitionDuration = `${ms}ms`;
    el.style.opacity = "";
    el.classList.toggle("on", on);
    return new Promise((r) => setTimeout(r, ms));
  },
  loading(text) {
    const el = $("#loading");
    el.hidden = !text;
    if (text) el.querySelector(".text").textContent = text;
  },
  zoneCard(zoneId) {
    const el = $("#title-card");
    el.querySelector(".time").textContent = t(`zones.${zoneId}.time`);
    el.querySelector(".name").textContent = t(`zones.${zoneId}.title`);
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    $("#clock").textContent = t(`zones.${zoneId}.time`);
  },
  objective(text) { $("#objective").textContent = text || ""; },
  // cảnh chuyển: viền điện ảnh trên/dưới, ẩn HUD chơi + bảng tên
  cinematic(on) { document.body.classList.toggle("cinematic", on); },
  // thẻ chữ giữa màn hình (nằm trên màn tối), null = ẩn
  card(text) {
    const el = $("#card");
    el.textContent = text || "";
    el.classList.toggle("show", !!text);
  },
  skip(show, onClick) {
    const el = $("#skip");
    el.hidden = !show;
    el.onclick = show ? onClick : null;
  },
  // tối nhẹ (0..1) — vd lúc bước lên xe
  dim(alpha, ms = 300) {
    const el = $("#fade");
    el.style.transitionDuration = `${ms}ms`;
    el.style.opacity = alpha ? String(alpha) : "";
    return new Promise((r) => setTimeout(r, ms));
  },
  prompt(text) {
    const el = $("#prompt");
    if (el.dataset.text === (text || "")) return;
    el.dataset.text = text || "";
    el.innerHTML = text ? `<kbd>E</kbd> ${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}` : "";
  },
  // "Click để xoay camera bằng chuột": hiện khi đang chơi mà con trỏ chưa bị khoá
  lockHint(text) {
    const el = $("#lockhint");
    if (el.textContent !== (text || "")) el.textContent = text || "";
  },
  hint(text, seconds = 10) {
    const el = $("#hint");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(this._hint);
    this._hint = setTimeout(() => el.classList.remove("show"), seconds * 1000);
  },
  // thông báo lần lượt (mỗi cái ~2,4 s)
  queue: [],
  notify(list) {
    for (const x of [].concat(list || [])) if (x) this.queue.push(x);
    if (!this._busy) this._pump();
  },
  _pump() {
    const el = $("#toast");
    const next = this.queue.shift();
    if (!next) { this._busy = false; el.classList.remove("show"); return; }
    this._busy = true;
    el.textContent = next;
    el.classList.add("show");
    this.last = next;
    setTimeout(() => this._pump(), 2400);
  },
  toast(text) { this.notify([text]); },
  debug(text) { const el = $("#debug"); el.hidden = !text; el.textContent = text || ""; },
  error(message) { this.loading(t("app.error", { message })); },
};
