// Màn tiêu đề: hiện mỗi lần mở game (người mới lẫn người chơi cũ) trên nền zone đầu do game vẽ (Game.showcase: camera trôi
// chậm, nghiêng theo chuột). Chữ: data/i18n → title.* (+ hud.welcome_back, menu.language, lang.*); nút ngôn ngữ như màn tạo
// nhân vật (onLang → main.js setLanguage, chữ đổi tại chỗ). Nút chính: Start (người mới → màn tạo nhân vật) / Continue (có
// bản lưu) — Enter / Space cũng được; có bản lưu thêm Start over (onStartOver: hỏi rồi xoá bản lưu). Nền chưa dựng xong:
// trời bình minh vẽ bằng CSS + dòng "The city is waking up…"; live() → trời mờ đi, lộ cảnh 3D. ?title=off (dev / ?debug):
// main.js không mở màn này. Tab / Shift+Tab chuyển nút (core/input.js chặn Tab mặc định). window.__title: cho smoke test.
import { t, lang, LANGS } from "../i18n.js";
import { BUILD_ID } from "../core/fetch.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LEAVE_MS = 450;   // = transition của #title.leaving (style.css)

export function titleScreen({ name = null, onLang = null, onStartOver = null, onParallax = null } = {}) {
  const back = !!name;
  const el = document.createElement("div");
  el.id = "title";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", "title-h");
  el.innerHTML = `
    <div class="sky" aria-hidden="true"></div>
    <div class="shade" aria-hidden="true"></div>
    <div class="lang-switch" role="group" data-t-aria="menu.language" aria-label="${esc(t("menu.language"))}">
      ${LANGS.map((l) => `<button type="button" data-lang="${l}" lang="${l}">${esc(t(`lang.${l}`))}</button>`).join("")}
    </div>
    <div class="hero">
      <div class="kicker"><i class="mark" aria-hidden="true"></i><p class="eyebrow" data-t="title.eyebrow"></p></div>
      <h1 id="title-h"><span class="top" data-t="title.top"></span><span class="main" data-t="title.main"></span></h1>
      <p class="tagline" data-t="title.tagline"></p>
      ${back ? `<p class="welcome"></p>` : ""}
      <div class="actions">
        <button type="button" class="primary start" data-t="${back ? "title.continue" : "title.start"}"></button>
        ${back ? `<button type="button" class="ghost over" data-t="title.start_over"></button>` : ""}
      </div>
      <p class="status" data-t="title.loading"></p>
    </div>
    ${BUILD_ID ? `<p class="build" aria-hidden="true">${esc(BUILD_ID)}</p>` : ""}`;
  el.querySelectorAll(".hero > *").forEach((n, i) => n.style.setProperty("--i", i));   // hiện dần lần lượt
  const welcome = el.querySelector(".welcome");
  const retext = () => {   // lần đầu + đổi ngôn ngữ: viết chữ tại chỗ
    for (const n of el.querySelectorAll("[data-t]")) n.textContent = t(n.dataset.t);
    // dòng trên tiêu đề: từng đoạn (FPT Software · Làng phần mềm F-Ville 1 · Hòa Lạc) không ngắt giữa chừng trên màn hẹp
    const eb = el.querySelector(".eyebrow");
    eb.innerHTML = eb.textContent.split(" · ").map((x) => `<span>${esc(x)}</span>`).join(" · ");
    for (const n of el.querySelectorAll("[data-t-aria]")) n.setAttribute("aria-label", t(n.dataset.tAria));
    if (welcome) welcome.textContent = t("hud.welcome_back", { name });
    for (const b of el.querySelectorAll("[data-lang]")) { b.classList.toggle("on", b.dataset.lang === lang); b.setAttribute("aria-pressed", String(b.dataset.lang === lang)); }
  };
  retext();
  document.body.appendChild(el);
  const dbg = window.__title = { open: true, live: false, back, get lang() { return lang; } };
  let done;
  const promise = new Promise((r) => { done = r; });
  const startBtn = el.querySelector(".start");
  const buttons = () => [...el.querySelectorAll("button")];

  // chuột → chữ dịch nhẹ ngược chiều (CSS --px / --py), camera nền nghiêng theo (onParallax)
  const onMove = (e) => {
    const x = (e.clientX / innerWidth) * 2 - 1, y = (e.clientY / innerHeight) * 2 - 1;
    el.style.setProperty("--px", x.toFixed(3));
    el.style.setProperty("--py", y.toFixed(3));
    onParallax?.(x, y);
  };
  // Enter / Space ngoài nút (hoặc trên nút chính) = nút chính; Tab chuyển nút (Input chặn Tab / Space mặc định của trình duyệt)
  const onKey = (e) => {
    if (!dbg.open) return;
    const b = e.target instanceof HTMLButtonElement && el.contains(e.target) ? e.target : null;
    if (e.code === "Tab") {
      const list = buttons(), i = list.indexOf(b);
      list[(i < 0 ? 0 : i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus({ preventScroll: true });
      e.preventDefault();
    } else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
      if (b && b !== startBtn) return;   // nút khác (ngôn ngữ, Start over): trình duyệt tự bấm
      e.preventDefault();
      close();
    }
  };
  const close = () => {
    if (!dbg.open) return;
    dbg.open = false;
    removeEventListener("pointermove", onMove);
    removeEventListener("keydown", onKey);
    onParallax?.(0, 0);
    el.classList.add("leaving");
    setTimeout(() => el.remove(), LEAVE_MS);
    done();
  };
  addEventListener("pointermove", onMove);
  addEventListener("keydown", onKey);
  startBtn.addEventListener("click", close);
  el.querySelector(".over")?.addEventListener("click", () => onStartOver?.());
  for (const b of el.querySelectorAll("[data-lang]")) b.addEventListener("click", async () => { if (b.dataset.lang !== lang) { await onLang?.(b.dataset.lang); retext(); } });
  requestAnimationFrame(() => startBtn.focus({ preventScroll: true }));

  return {
    done: promise,                    // bấm Start / Continue
    get open() { return dbg.open; },
    // nền 3D (Game.showcase) đã dựng xong → trời CSS mờ đi, lộ cảnh; dòng trạng thái ẩn
    live() { dbg.live = true; el.classList.add("live"); },
  };
}
