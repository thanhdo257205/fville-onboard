// HUD: màn mờ chuyển zone, thẻ tên zone, dòng mục tiêu, gợi ý phím E, gợi ý điều khiển, thông báo (xếp hàng), màn tải,
// tin nhắn điện thoại ngắn + thẻ gợi ý phím H (game/guide.js).
import { t } from "../i18n.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// ô HUD tạo khi cần (trong #hud: bị ẩn theo cảnh chuyển như phần HUD khác)
const slot = (id) => $(`#${id}`) || Object.assign(document.getElementById("hud").appendChild(document.createElement("div")), { id });

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
  // thẻ chữ lớn giữa màn hình (tên zone, "First card tap!", tiêu đề Act, thành tựu) xếp hàng — mỗi lúc một thẻ, không đè
  // nhau (vd quẹt thẻ lần đầu xong Act 2: "First card tap!" rồi mới tới "ACT 3"). Không chặn điều khiển.
  cards: [],
  _queueCard(kind, show, ms) {
    this.cards.push({ kind, show, ms });
    if (!this._cardBusy) this._nextCard();
  },
  _nextCard() {
    const c = this.cards.shift();
    if (!c) { this._cardBusy = false; return; }
    this._cardBusy = true;
    this.lastCards = [...(this.lastCards || []).slice(-9), c.kind];
    c.show();
    setTimeout(() => this._nextCard(), c.ms);
  },
  _replay(el) { el.classList.remove("show"); void el.offsetWidth; el.classList.add("show"); },
  zoneCard(zoneId) {
    $("#clock").textContent = t(`zones.${zoneId}.time`);
    this._queueCard(`zone:${zoneId}`, () => {
      const el = $("#title-card");
      el.querySelector(".time").textContent = t(`zones.${zoneId}.time`);
      el.querySelector(".name").textContent = t(`zones.${zoneId}.title`);
      this._replay(el);
    }, 3000);
  },
  // chữ lớn giữa màn hình như thẻ tên zone (vd "First card tap!"), không đổi đồng hồ
  banner(text, sub = "") {
    this._queueCard(`banner:${text}`, () => {
      const el = $("#title-card");
      el.querySelector(".time").textContent = sub;
      el.querySelector(".name").textContent = text;
      this._replay(el);
    }, 3000);
  },
  // thẻ tiêu đề Act (data/acts.json): "ACT 1" + tên Act, khoảng 2 s
  actCard(n, title, seconds = 2.2) {
    this._queueCard(`act:${n}`, () => {
      const el = slot("act-card");
      el.innerHTML = `<div class="num">${esc(t("acts.label", { n }))}</div><div class="title">${esc(title)}</div>`;
      el.style.setProperty("--dur", `${seconds}s`);
      this._replay(el);
    }, seconds * 1000 + 250);
  },
  // thành tựu (vd hoàn thành game): "ACHIEVEMENT UNLOCKED" + tên thành tựu
  achievement(label, title, seconds = 3.6) {
    this._queueCard(`achievement:${title}`, () => {
      const el = slot("ach-card");
      el.innerHTML = `<div class="label">🏆 ${esc(label)}</div><div class="title">${esc(title)}</div>`;
      el.style.setProperty("--dur", `${seconds}s`);
      this._replay(el);
    }, seconds * 1000 + 250);
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
    this._hintLeft = seconds * 1000;
    this._hintRun();
  },
  _hintRun() {
    clearTimeout(this._hint);
    if (this._covered || !this._hintLeft) return;
    this._hintStart = performance.now();
    this._hint = setTimeout(() => { this._hintLeft = 0; $("#hint").classList.remove("show"); }, this._hintLeft);
  },
  // Hộp thoại / mini-game / app My FPT đang mở: ẩn dòng hướng dẫn điều khiển (cùng chỗ cuối màn hình, bị hộp thoại đè)
  // và dừng đếm giờ; đóng lại thì hiện nốt phần thời gian còn lại (vd tin nhắn HR mở ngay đầu game).
  cover(on) {
    if (on === !!this._covered) return;
    this._covered = on;
    document.body.classList.toggle("overlay-open", on);
    if (on) {
      clearTimeout(this._hint);
      if (this._hintLeft && this._hintStart != null) this._hintLeft = Math.max(0, this._hintLeft - (performance.now() - this._hintStart));
      this._hintStart = null;
    } else this._hintRun();
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
  // tin nhắn điện thoại ngắn (game/guide.js: nhắc khi đứng yên, không có Tú đi cùng) — không dừng game, tự ẩn
  phone({ name, portrait, label, text }, seconds = 7) {
    const el = slot("phone-msg");
    el.innerHTML = `${portrait ? `<img src="${portrait}" alt="">` : ""}<div><small>${esc(label)} · <b>${esc(name)}</b></small><p>${esc(text)}</p></div>`;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    clearTimeout(this._phone);
    this._phone = setTimeout(() => el.classList.remove("show"), seconds * 1000);
    this.lastPhone = { name, text };
  },
  // thẻ gợi ý (phím H): bấm lại khi đang hiện thì ẩn; help(null) = ẩn (vd đổi mục tiêu, sang zone khác)
  help(title, lines, seconds = 8) {
    const el = slot("helpcard");
    if (!lines) { clearTimeout(this._help); el.classList.remove("show"); el.dataset.text = ""; return false; }
    const key = lines.join("\n");
    clearTimeout(this._help);
    if (el.classList.contains("show") && el.dataset.text === key) { el.classList.remove("show"); return false; }
    el.dataset.text = key;
    el.innerHTML = `<b>${esc(title)} <kbd>H</kbd></b>${lines.map((l) => `<p>${esc(l)}</p>`).join("")}`;
    el.classList.add("show");
    this._help = setTimeout(() => el.classList.remove("show"), seconds * 1000);
    this.lastHelp = lines;
    return true;
  },
  debug(text) { const el = $("#debug"); el.hidden = !text; el.textContent = text || ""; },
  error(message) { this.loading(t("app.error", { message })); },
};
