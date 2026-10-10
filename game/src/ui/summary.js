// Màn tổng kết (GDD mục Kết thúc và màn tổng kết) — thẻ đứng: thành tựu cuối đứng đầu ("ACHIEVEMENT UNLOCKED: Welcome to
// the F-Ville Family"), ảnh thẻ (nhân vật mặc áo cam) + huy hiệu đã nhận + ảnh check-in, danh hiệu chính / phụ, Hiểu biết,
// Kết nối, hạt lúa, 6 ô giá trị (ô trống kèm gợi ý ngắn), tiến độ 4 Act, lời nhắn của Prajith (theo La bàn nghề nghiệp).
// Nút: Close (Esc, chơi tiếp), Download card (PNG — vẽ lại thẻ bằng canvas), Play again.
// Mở bằng Game.finishGame() sau cảnh kết (hiệu ứng "finish" ở bàn làm việc zone 5; __game.finish() khi thử).
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
      if (a === "download") this.download();
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
      <div class="hero">
        <div class="idc">${d.idPhoto ? `<img src="${d.idPhoto}" alt="">` : `<div class="nophoto">🙂</div>`}
          <b>${esc(d.name)}</b><span>${esc(t("summary.card_intern", { position: d.position }))}</span></div>
        <div class="side">${d.badges.length ? `<div class="badges">${d.badges.map((b) => `<span title="${esc(b.name)}">${b.icon}</span>`).join("")}</div>` : ""}
          ${d.photo ? `<img class="photo" src="${d.photo}" alt="">` : ""}</div>
      </div>
      ${d.title ? `<div class="titles"><div class="main"><span>${t("summary.title")}</span><b>${esc(d.title.title)}</b><small>${esc(d.title.desc)}</small></div>
        ${d.subtitles.length ? `<ul>${d.subtitles.map((x) => `<li><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></li>`).join("")}</ul>` : ""}</div>` : ""}
      <div class="stats">${stat("hieu_biet")}${stat("ket_noi")}<p>🌾 ${esc(t("summary.grains", { n: d.grains, total: d.grainsTotal }))}</p></div>
      <div class="values">${d.values.map((v) => `<span class="${v.lit ? "lit" : ""}"><b>${esc(v.name)}</b>${v.lit ? "" : `<small>${esc(v.hint)}</small>`}</span>`).join("")}</div>
      ${d.note ? `<div class="note"><b>${t("summary.prajith")}</b><p>${esc(d.note)}</p></div>` : ""}
      <ol class="acts">${d.acts.map((a) => `<li class="${a.done === a.total ? "done" : ""}">${esc(t("acts.label", { n: a.number }))} · ${esc(a.title)}<em>${a.done}/${a.total}</em></li>`).join("")}</ol>
      <footer><button class="ghost" data-a="close">${t("summary.close")} <kbd>Esc</kbd></button>
        <button class="ghost" data-a="download">⬇ ${t("summary.download")}</button>
        <button class="primary" data-a="again">${t("menu.play_again")}</button></footer></div>`;
    this.el.hidden = false;
  }
  hide() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  // "Tải ảnh thẻ": vẽ thẻ đứng 720 × 1080 bằng canvas (chữ Nunito, ảnh thẻ + ảnh check-in đã lưu trong bản lưu)
  async card(d = this.data) {
    const W = 720, H = 1080, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    try { await Promise.all(["800 40px Nunito", "700 22px Nunito"].map((f) => document.fonts.load(f))); } catch { /* font hệ thống */ }
    const img = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const [idImg, checkin] = await Promise.all([img(d.idPhoto), img(d.photo)]);
    const font = (w, s) => `${w} ${s}px Nunito, sans-serif`;
    const round = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
    const wrap = (text, x, y, maxW, lh, maxLines = 6) => {
      const words = String(text).split(/\s+/);
      let line = "", n = 0;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y + n * lh); line = w; if (++n >= maxLines) return y + n * lh; }
        else line = test;
      }
      if (line) { g.fillText(line, x, y + n * lh); n++; }
      return y + n * lh;
    };
    // nền + dải cam
    g.fillStyle = "#fff7ef"; g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#f37021"); grad.addColorStop(1, "#f89a3c");
    g.fillStyle = grad; g.fillRect(0, 0, W, 150);
    g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
    g.font = font(800, 40); g.fillText(t("summary.card_title"), 40, 66);
    if (d.achievement) { g.font = font(700, 20); g.fillText(`🏆 ${d.achievement.label.toUpperCase()} · ${d.achievement.title}`, 40, 110); }
    // ảnh thẻ + tên
    round(40, 185, 180, 240, 16); g.fillStyle = "#e7e1d7"; g.fill();
    if (idImg) { g.save(); round(40, 185, 180, 240, 16); g.clip(); g.drawImage(idImg, 40, 185, 180, 240); g.restore(); }
    g.fillStyle = "#1d1f23"; g.font = font(800, 42); g.fillText(d.name, 250, 235);
    g.font = font(700, 24); g.fillStyle = "#555b66"; g.fillText(t("summary.card_intern", { position: d.position }), 250, 272);
    let y = 320;
    if (d.title) { g.fillStyle = "#c4520f"; g.font = font(800, 30); y = wrap(d.title.title, 250, y, 430, 36, 2); }
    g.font = font(700, 20); g.fillStyle = "#8a5a3c";
    for (const s of d.subtitles.slice(0, 3)) y = wrap(`+ ${s.title}`, 250, y + 4, 430, 26, 1);
    if (d.badges.length) { g.font = font(700, 34); g.fillText(d.badges.map((b) => b.icon).join(" "), 250, Math.max(y + 40, 410)); }
    // chỉ số
    const bar = (label, v, yy) => {
      g.fillStyle = "#1d1f23"; g.font = font(800, 22); g.fillText(label, 40, yy);
      round(220, yy - 18, 380, 20, 10); g.fillStyle = "#e7e1d7"; g.fill();
      round(220, yy - 18, Math.max(20, 3.8 * v), 20, 10); g.fillStyle = "#f37021"; g.fill();
      g.fillStyle = "#1d1f23"; g.fillText(String(v), 620, yy);
    };
    bar(t("stats.hieu_biet"), d.stats.hieu_biet, 485);
    bar(t("stats.ket_noi"), d.stats.ket_noi, 525);
    g.font = font(700, 22); g.fillStyle = "#555b66"; g.fillText(`🌾 ${t("summary.grains", { n: d.grains, total: d.grainsTotal })}`, 40, 568);
    // 6 ô giá trị
    g.font = font(800, 22); g.fillStyle = "#1d1f23"; g.fillText(t("summary.values"), 40, 620);
    d.values.forEach((v, i) => {
      const x = 40 + (i % 3) * 215, yy = 640 + Math.floor(i / 3) * 56;
      round(x, yy, 200, 44, 22); g.fillStyle = v.lit ? "#f37021" : "#e7e1d7"; g.fill();
      g.fillStyle = v.lit ? "#fff" : "#8a8f98"; g.font = font(800, 19); g.textAlign = "center";
      g.fillText(`${v.lit ? "✓ " : ""}${v.name}`, x + 100, yy + 29); g.textAlign = "left";
    });
    // lời nhắn của Prajith
    y = 780;
    if (d.note) {
      round(40, y, 640, 150, 18); g.fillStyle = "#fff"; g.fill();
      g.fillStyle = "#c4520f"; g.font = font(800, 20); g.fillText(t("summary.prajith"), 62, y + 34);
      g.fillStyle = "#1d1f23"; g.font = font(700, 21); wrap(d.note, 62, y + 66, 596, 28, 3);
    }
    // ảnh check-in nhỏ + 4 Act
    y = 960;
    if (checkin) { g.save(); round(40, y, 160, 90, 12); g.clip(); g.drawImage(checkin, 40, y, 160, 90); g.restore(); }
    const ax = checkin ? 220 : 40;
    d.acts.forEach((a, i) => {
      const yy = y + 4 + i * 22;
      g.fillStyle = a.done === a.total ? "#2e9e5b" : "#8a8f98"; g.font = font(800, 16);
      g.fillText(`${a.done === a.total ? "✓" : "·"} ${t("acts.label", { n: a.number })} · ${a.title} — ${a.done}/${a.total}`, ax, yy + 14);
    });
    g.fillStyle = "#b0a596"; g.font = font(700, 16); g.textAlign = "right";
    g.fillText(t("summary.card_date", { date: d.date }), W - 40, H - 14);
    g.textAlign = "left";
    return cv;
  }
  async download() {
    const d = this.data;
    if (!d) return;
    const cv = await this.card(d);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fville-first-day-${String(d.name).normalize("NFD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "intern"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.lastDownload = { name: a.download, bytes: blob.size, width: cv.width, height: cv.height };
  }
}
