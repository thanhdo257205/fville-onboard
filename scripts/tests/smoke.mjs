// npm run test:smoke (trong game/) — chơi thử tự động zone 0 → 5 tới màn tổng kết, Chromium headless (Playwright), mạng
// tắt (?net=off — không đụng máy chủ thật). Dùng window.__game (game/src/debug.js): step() = tới đích của mục tiêu hiện tại
// (dịch chuyển), bấm E / bước vào vùng, tự giải hội thoại (autoplay.pickChoice), mini-game (debug solve), cảnh chuyển.
// Mỗi zone kiểm tra: việc bắt buộc xong, sang đúng zone, đúng áo (dau_ngay → texture trong GLB sau khi nhận Áo Cam), không
// lỗi / cảnh báo console. Màn chọn nhân vật: ngoại hình thứ 1 chọn trong cảnh 3D bằng phím ←/→, thứ 2 bấm chuột vào nhân
// vật, thứ 3 ở màn hẹp (< 700 px: thẻ chân dung); nút xem trước áo FPT; cảnh 3D được giải phóng khi vào game. Tú: model khác
// giới với người chơi, áo trước / sau cổng (tu_dau_ngay | dau_ngay → Áo Cam), chân dung theo bộ đồ, câu dẫn ra đúng he / she.
// Zone 5 thêm: Esc lúc màn mờ ăn trưa, cờ lunch_done lưu trước khi mờ, mini-game Đăng nhập không
// có form / ô username / autocomplete mật khẩu, tải lại giữa cảnh kết → vẫn ra tổng kết, Close rồi mở lại từ menu Esc,
// tải ảnh thẻ (tên file bỏ dấu).
// Ngôn ngữ: ngoại hình thứ 2 chơi bằng tiếng Việt (bấm "Tiếng Việt" ở màn tạo nhân vật — CI: intern_nu), thử đổi ngôn ngữ giữa
// chừng ở menu Esc, tải lại trang vẫn giữ tiếng Việt (cài đặt); các ngoại hình khác chơi bằng tiếng Anh.
//
//   npm run test:smoke                       3 ngoại hình (roles.player.looks), zone 0 → 5, server Vite dev tự bật
//   npm run test:smoke -- --zone 5           chỉ zone 5 (bản lưu mẫu ?start=zone_05 dựng từ data)
//   npm run test:smoke -- --look intern_nu   1 ngoại hình (CI: --look intern_nam)
//   npm run test:smoke -- --build            chạy trên bản build (game/dist, vite preview) — sau npm run build
//   npm run test:smoke -- --url http://localhost:5180   server đang chạy sẵn
//   --extra off | only: bỏ / chỉ chạy các test thêm — bản lưu cũ lệch data (fixtures/old_save.json); với máy chủ local
//     (server/, wrangler dev; chưa `npm --prefix server ci` thì bỏ qua): vào zone 4 khi có người chơi khác (bot), bi-a 2 người
//     luật chuẩn 8 bi (2 trình duyệt chơi trọn một ván + người xem vào giữa ván), chia phòng ~30 người; rồi máy chủ giả bản cũ
//     (wrangler dev --var POOL_RULES:1): bi-a 2 người luật cũ. Bản lưu cũ + zone 4 đặt sẵn cài đặt cũ tier "high"
//   --lang vi | en: mọi ngoại hình chơi bằng 1 ngôn ngữ (mặc định: ngoại hình thứ 2 tiếng Việt, còn lại tiếng Anh)
//   Lượt điện thoại (Playwright hasTouch + isMobile, khung ngang 844 × 390): giao diện cảm ứng tự bật, đi bằng cần điều khiển
//     ảo, vuốt xoay camera, chụm 2 ngón thu phóng, chạm nút hành động / qua hội thoại / lựa chọn, chơi zone 0 → 2 (--zone N:
//     chỉ zone đó) kể cả mini-game bằng chạm (Cài app, Ảnh check-in); máy chủ local: mở chat bằng nút, gửi 1 tin bằng nút Gửi.
//     --mobile off | only | pool | ui: bỏ / chỉ chạy lượt điện thoại / chỉ bi-a cảm ứng (1 máy + 2 người qua máy chủ local) /
//     lượt điện thoại trừ bi-a cảm ứng (CI chia 2 job song song: ui + pool)
//   --headed: mở cửa sổ trình duyệt · --verbose: in thêm chi tiết từng bước
// In gọn: mỗi bước 1 dòng ✓/✗, cuối cùng 1 dòng tổng kết + thời gian. Ảnh chụp chỉ khi bước hỏng: test-results/ (không commit).
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GAME = join(ROOT, "game");
const OUT = join(ROOT, "test-results");
const t0 = Date.now();

// ---------- tham số ----------
const argv = process.argv.slice(2);
const arg = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i < 0 ? def : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true; };
const chars = JSON.parse(readFileSync(join(ROOT, "data", "characters.json"), "utf8"));
const zonesCfg = JSON.parse(readFileSync(join(ROOT, "data", "zones.json"), "utf8"));
const allLooks = Object.entries(chars.roles.player.looks || {}).flatMap(([g, ids]) => ids.map((id) => ({ id, gender: g })));
const lookArg = arg("look") || arg("looks");
const looks = lookArg ? String(lookArg).split(",").map((id) => allLooks.find((l) => l.id === id) || (() => { throw new Error(`--look ${id}: không có trong roles.player.looks`); })()) : allLooks;
const zoneArg = arg("zone");
const order = zonesCfg.order;
const startZone = zoneArg == null ? order[0] : order.find((z) => z === `zone_0${zoneArg}` || z === zoneArg);
if (!startZone) throw new Error(`--zone ${zoneArg}: không có zone này`);
const onlyZone = zoneArg != null;
const verbose = !!arg("verbose");
const extra = arg("extra");
const mobile = arg("mobile");      // off: bỏ lượt điện thoại · only: chỉ lượt điện thoại (+ nhắn tin, bi-a cảm ứng 2 người nếu có máy chủ local) · pool: chỉ bi-a cảm ứng · ui: chỉ lượt điện thoại trừ bi-a cảm ứng
const mobileOnly = mobile === "only" || mobile === "pool" || mobile === "ui";
const zoneIsLast = (z) => z === order[order.length - 1];
const langArg = arg("lang");
const langOf = (look) => (langArg ? String(langArg) : looks.indexOf(look) === 1 ? "vi" : "en");
const I18N = { en: JSON.parse(readFileSync(join(ROOT, "data", "i18n", "en.json"), "utf8")), vi: JSON.parse(readFileSync(join(ROOT, "data", "i18n", "vi.json"), "utf8")) };
const SCENE_FIXES = JSON.parse(readFileSync(join(ROOT, "data", "scene_fixes.json"), "utf8"));
const OFFICE = JSON.parse(readFileSync(join(ROOT, "data", "office.json"), "utf8"));
const SEATS = JSON.parse(readFileSync(join(ROOT, "data", "seats.json"), "utf8"));
const ACH = JSON.parse(readFileSync(join(ROOT, "data", "achievements.json"), "utf8")).final.title;   // tên thành tựu cuối theo ngôn ngữ
const QUESTS = JSON.parse(readFileSync(join(ROOT, "data", "quests.json"), "utf8")).quests;
// tên có dấu tiếng Việt để thử tên file ảnh thẻ
const NAMES = { intern_nam: ["Đỗ Minh Khôi", "do-minh-khoi"], intern_nam_kinh: ["Trần Đức Anh", "tran-duc-anh"], intern_nu: ["Nguyễn Thị Hà", "nguyen-thi-ha"], intern_nu_buitoc: ["Phạm Thu Trang", "pham-thu-trang"] };
// Tú khác giới với người chơi (roles.tu): model, bộ đồ trước cổng, chân dung theo bộ đồ, câu dẫn trên xe bus (bản tiếng Việt
// gọi thẳng tên Tú, không cần đại từ; {tu_he} = cậu ấy / cô ấy)
const tuOf = (look, lang = "en") => {
  const r = chars.roles.tu, id = r.model_by_gender?.[look.gender] ?? r.model, m = chars.models[id];
  const tex = r.outfit?.texture_by_model?.[id] ?? r.outfit?.texture ?? null;
  const female = m.gender === "female";
  return { id, tex, female, portrait: m.outfit_portraits?.[tex] ?? m.portrait, portraitCam: m.portrait,
    bus: lang === "vi" ? "Tú đặt balo xuống ghế bên cạnh" : `Tú drops ${female ? "her" : "his"} backpack on the seat beside ${female ? "her" : "him"}`,
    he: lang === "vi" ? (female ? "cô ấy" : "cậu ấy") : female ? "she" : "he" };
};
// cách chọn ở màn tạo nhân vật theo thứ tự ngoại hình trong lần chạy: 3D + phím, 3D + bấm chuột, thẻ ảnh (màn hẹp)
const PICK = ["keys", "click", "cards"];

// ---------- playwright (game/node_modules; máy cloud: bản cài sẵn toàn cục) ----------
function loadPlaywright() {
  const req = createRequire(join(GAME, "package.json"));
  for (const id of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return req(id); } catch { /* thử chỗ khác */ } }
  console.error("✗ không có playwright: chạy `npm --prefix game ci` (có trong devDependencies), rồi `npx --prefix game playwright install chromium`");
  process.exit(2);
}
const { chromium } = loadPlaywright();
const chromePath = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(existsSync);   // máy cloud: Chromium cài sẵn

// ---------- server ----------
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
async function startServer() {
  if (arg("url")) return { base: String(arg("url")).replace(/\/$/, ""), stop: () => {} };
  const port = await freePort();
  const build = !!arg("build");
  if (build && !existsSync(join(GAME, "dist", "index.html"))) { console.error("✗ --build: chưa có game/dist — chạy npm run build trước"); process.exit(2); }
  const vite = join(GAME, "node_modules", "vite", "bin", "vite.js");
  const proc = spawn(process.execPath, [vite, ...(build ? ["preview"] : []), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: GAME, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch(base); if (r.ok) return { base, stop: () => proc.kill(), mode: build ? "build" : "dev" }; } catch { /* chưa lên */ }
    if (proc.exitCode != null) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  console.error(`✗ không bật được server Vite:\n${log}`);
  process.exit(2);
}

// ---------- chạy ----------
const results = [];   // { look, ok, name }
let shots = 0;
const line = (ok, text) => { console.log(`${ok ? "✓" : "✗"} ${text}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// lỗi / cảnh báo console, trang lỗi, HTTP ≥ 400, request hỏng → danh sách (bước kiểm tra lấy ra bằng splice)
function watch(page) {
  const problems = [];
  const ignore = [/\[vite\]/, /Download the React DevTools/];
  page.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !ignore.some((r) => r.test(m.text()))) problems.push(`[${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`); });
  // ERR_ABORTED = trình duyệt huỷ request khi chuyển trang (bước tải lại giữa cảnh kết), không phải lỗi game
  page.on("requestfailed", (r) => { const err = r.failure()?.errorText || ""; if (!/favicon/.test(r.url()) && !/ERR_ABORTED/.test(err)) problems.push(`[request failed] ${r.url()} ${err}`); });
  return problems;
}

async function runLook(browser, base, look) {
  const pick = PICK[looks.indexOf(look) % PICK.length];
  // màn chọn 3D cần khung ≥ 700 px; vào game rồi thu về 640 × 360 như trước (nhanh hơn trên swiftshader)
  const ctx = await browser.newContext({ viewport: pick === "cards" ? { width: 640, height: 360 } : { width: 1000, height: 640 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = watch(page);   // lỗi / cảnh báo console chưa báo
  const ev = (fn, a) => page.evaluate(fn, a);
  const [name, slug] = NAMES[look.id] || ["Test Intern", "test-intern"];
  const lang = langOf(look), tag = lang === "en" ? look.id : `${look.id} [${lang}]`;
  let failed = false;
  const check = async (ok, text, extra = "") => {
    results.push({ look: look.id, ok, text });
    line(ok, `${tag} · ${text}${extra && (verbose || !ok) ? ` — ${extra}` : ""}`);
    if (!ok) {
      failed = true;
      mkdirSync(OUT, { recursive: true });
      const f = join(OUT, `${look.id}-${++shots}.png`);
      await page.screenshot({ path: f }).catch(() => {});
      console.log(`    ảnh: ${f.replace(ROOT + "/", "")}`);
    }
    return ok;
  };
  const wait = async (fn, ms, arg) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
  // mở menu Esc khi đang chơi: hội thoại on_enter (tin nhắn HR, 600 ms sau khi vào zone — máy CI bận có thể trễ hơn) mở đúng
  // lúc bấm Esc thì Esc bị bỏ qua (main.js escape: đang hội thoại) → chờ qua mốc đó, giải hết rồi bấm; menu chưa mở thì thử lại
  const openMenu = async () => {
    await wait(() => performance.now() - (__game._game.state.readyAt ?? 0) > 700, 5000);
    for (let i = 0; i < 4; i++) {
      await ev(() => __game.resolve());
      await page.keyboard.press("Escape");
      if (await wait(() => !document.getElementById("menu").hidden, 2000)) return true;
    }
    return false;
  };
  // A real mouse click after checking visibility/hit testing. In short CI
  // windows, compositor-frame stability waits can stall on paused overlays.
  // chờ game vẽ xong 2 khung hình (không giới hạn giờ): vật / chất liệu mới (vd mũ vừa đội, áo vừa đổi) làm lần vẽ đầu biên
  // dịch shader — trên máy CI (SwiftShader) luồng chính bận hàng chục giây, thao tác ngay sau đó dễ quá giờ
  const settle = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const clickShown = async (selector, { hover = false } = {}) => {
    await page.bringToFront();
    // Scrolling/redrawing cards can put the next card under the old pointer.
    // Leave the panel first so the move below produces a fresh pointerover.
    if (hover) await page.mouse.move(0, 0);
    // máy CI vẽ bằng CPU (~10 FPS): luồng chính có thể bận biên dịch shader lâu → nới thời gian chờ
    await page.locator(selector).evaluate((button) => button.scrollIntoView({ block: "center", behavior: "instant" }), null, { timeout: 90000 });
    const point = await page.waitForFunction((selector) => {
      const button = document.querySelector(selector);
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
      const r = button.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return r.width > 0 && r.height > 0 && document.elementFromPoint(x, y)?.closest(selector) === button ? { x, y } : false;
    }, selector, { timeout: 30000, polling: 100 });
    const { x, y } = await point.jsonValue();
    await point.dispose();
    if (hover) await page.mouse.move(x, y);
    else await page.mouse.click(x, y);
  };
  // khoá con trỏ (Pointer Lock) không phải thứ cần thử: headless + đổi chế độ liên tục bằng code → khoá / nhả chồng nhau có
  // thể làm main.js tưởng người chơi bấm Esc (mở menu). Tắt hẳn, Esc đi thẳng vào main.js như khi không khoá
  // Khoá đã xin lúc vào game có thể được cấp SAU lệnh này (luồng chính bận vẽ) rồi bị nhả khi đổi khung nhìn → game tưởng Esc →
  // menu: nhả mọi khoá tới muộn và bỏ onUnlock (mở menu khi mất khoá — không phải thứ cần thử)
  const noLock = () => ev(() => { const i = __game._game.input; i.lockSupported = false; i.onUnlock = null; if (document.pointerLockElement) { i._releasing = true; document.exitPointerLock(); }
    document.addEventListener("pointerlockchange", () => { if (document.pointerLockElement) { i._releasing = true; document.exitPointerLock(); } }); });

  try {
    // không ?look: chọn ngoại hình qua màn tạo nhân vật
    const q = `?debug&net=off${onlyZone ? `&start=${startZone}` : ""}`;
    await page.goto(`${base}/${q}`);
    // màn tiêu đề: nút Start hiện ngay, nền zone đầu dựng xong (live, phase "title") trong lúc chờ; ngoại hình chơi tiếng Việt:
    // đổi ngôn ngữ ở đây (chữ đổi tại chỗ; màn tạo nhân vật bấm lại cũng không đổi gì); Start → màn tạo nhân vật
    await page.waitForSelector("#title .start", { timeout: 90000 });
    const ti = { live: await wait(() => window.__title?.live && window.__game?.state.phase === "title", 90000) };
    if (lang !== "en") { await page.click(`#title [data-lang=${lang}]`); await wait((l) => document.documentElement.lang === l, 10000, lang); }
    Object.assign(ti, await ev(() => ({ lang: document.documentElement.lang, top: document.querySelector("#title h1 .top").textContent, main: document.querySelector("#title h1 .main").textContent,
      start: document.querySelector("#title .start").textContent, back: !!document.querySelector("#title .welcome"), preview: __game.preview, title: document.title })));
    await page.click("#title .start");
    ti.gone = await wait(() => !document.getElementById("title") && !window.__title?.open, 10000);
    await check(ti.live && ti.gone && !ti.back && ti.lang === lang && ti.top === I18N[lang].title.top && ti.main === I18N[lang].title.main && ti.start === I18N[lang].title.start
      && ti.preview?.zone === startZone && ti.title === I18N[lang].app.title,
      `màn tiêu đề: nền ${startZone} (camera ${ti.preview?.shot ? "theo kịch bản" : "quay quanh SPAWN_"}), "${ti.top} ${ti.main}"${lang !== "en" ? ` (${I18N[lang].lang[lang]})` : ""}, Start`, JSON.stringify(ti));
    await page.waitForSelector("#creator input[name=name]", { timeout: 90000 });
    const cr = { mode: await ev(() => window.__creator?.mode) };
    if (pick !== "cards" && cr.mode === "3d") {
      cr.ready = await wait(() => window.__creator?.ready, 90000);
      if (pick === "keys") {
        await page.focus("#creator .stage canvas");
        for (let i = 0; i < allLooks.length + 1 && await ev(() => __creator.selected) !== look.id; i++) await page.keyboard.press("ArrowRight");
      } else {
        const i = await ev((id) => __creator.looks.indexOf(id), look.id);
        const p = await ev((k) => __creator.screen(k), i);
        // bấm rồi chờ chọn xong: luồng chính đang vẽ nền màn tiêu đề (swiftshader) nên sự kiện chuột tới muộn vài trăm ms; chưa chọn → bấm lại 1 lần
        for (let k = 0; p && k < 2 && await ev(() => __creator.selected) !== look.id; k++) { await page.mouse.click(p.x, p.y); await wait((id) => __creator.selected === id, 3000, look.id); }
      }
    } else if (cr.mode === "cards") await page.click(`#creator .card input[value=${look.id}] + span`);
    cr.selected = await ev(() => __creator.selected);
    await page.click("#creator .info .shirt");
    // tên file chân dung (bản build: url có ?v=<mã build> — bỏ trước khi so)
    cr.shirtOn = await ev(() => [__creator.shirt, document.querySelector("#creator .shirt").getAttribute("aria-pressed"), document.querySelector("#creator .info .portrait").src.split("?")[0].split("/").pop()]);
    await page.click("#creator .info .shirt");
    cr.shirtOff = await ev(() => [__creator.shirt, document.querySelector("#creator .info .portrait").src.split("?")[0].split("/").pop()]);
    // ảnh chân dung (thẻ thông tin + thẻ ảnh) tải được thật — server dev trả index.html cho file không cho phép (mã 200)
    cr.imgs = await ev(async () => { const im = [...document.querySelectorAll("#creator img")]; await Promise.all(im.map((i) => i.decode().catch(() => null)));
      return im.filter((i) => !i.naturalWidth).map((i) => i.src.split("/").pop()); });
    // ngôn ngữ: bấm nút ở góc màn → chữ của màn đổi tại chỗ (tiêu đề, nút bắt đầu), nhân vật đang chọn giữ nguyên
    if (lang !== "en") {
      await page.click(`#creator [data-lang=${lang}]`);
      await wait((l) => document.documentElement.lang === l, 10000, lang);
      cr.lang = await ev(() => ({ lang: document.documentElement.lang, title: document.querySelector("#creator h2").textContent,
        start: document.querySelector("#creator .primary").textContent, selected: __creator.selected }));
    }
    await page.fill("#creator input[name=name]", name);
    await page.keyboard.press("Enter");                 // Enter trong ô tên = Start my first day
    const booted = await wait(() => window.__game?.state.phase === "playing", 120000);
    if (booted) await noLock();
    cr.disposed = await ev(() => !!window.__creator?.disposed && !document.getElementById("creator"));
    if (pick !== "cards") await page.setViewportSize({ width: 640, height: 360 });
    const wantMode = pick === "cards" ? "cards" : "3d";
    const crOk = cr.mode === wantMode && (wantMode === "cards" || cr.ready) && cr.selected === look.id && cr.shirtOn[0] && cr.shirtOn[1] === "true"
      && /_portrait\.png$/.test(cr.shirtOn[2]) && !cr.shirtOff[0] && /_portrait_dau_ngay\.png$/.test(cr.shirtOff[1]) && !cr.imgs.length && cr.disposed
      && (lang === "en" || (cr.lang?.lang === lang && cr.lang.title === I18N[lang].creator.title && cr.lang.start === I18N[lang].creator.start && cr.lang.selected === look.id));
    await check(crOk, `màn chọn nhân vật (${wantMode === "3d" ? `3D, ${pick === "keys" ? "phím ←/→" : "bấm chuột"}` : "thẻ ảnh, màn hẹp"}): chọn ${look.id}, xem trước áo FPT, giải phóng cảnh 3D${lang !== "en" ? `, đổi sang ${I18N[lang].lang[lang]} ("${I18N[lang].creator.title}")` : ""}`, JSON.stringify(cr));
    const m = booted ? await ev(() => __game.model) : null;
    if (!await check(booted && m.id === look.id && m.look === look.id && m.gender === look.gender, `${startZone}: vào game "${name}", model ${look.id}${onlyZone ? `, bản lưu mẫu ?start=${startZone}` : ""}`, JSON.stringify(m))) return;
    // máy tính thường (chuột + bàn phím, không màn cảm ứng): không bật giao diện cảm ứng, dòng hướng dẫn vẫn ghi phím
    const nt = await ev(() => { const t = __game.touch, el = document.getElementById("touch");
      return { on: t?.on, phone: t?.phone, body: document.body.classList.contains("touch"), shown: !!el && getComputedStyle(el).display !== "none" && el.offsetParent !== null,
        detail: __game._game.state.detailLevel }; });
    await check(nt.on === false && !nt.phone && !nt.body && !nt.shown && nt.detail === 0, "máy tính thường: không hiện nút cảm ứng, nấc Detail cao", JSON.stringify(nt));
    // đứng vững trên sàn ngay khi vào zone (khung đầu tiên sau lúc tải zone từng có dt âm → rơi xuyên sàn zone 5 khi vào
    // thẳng ?start=zone_05); rơi khỏi bản đồ → về chỗ đứng vững gần nhất (trước đây rơi mãi quanh y −9 … −10)
    const fall = await ev(() => {
      const g = __game._game;
      __game.simulate(0.3, undefined, { render: false });
      const p0 = __game.player;
      g.player.body.teleport(g.player.position.clone().setY(-9.95));
      __game.simulate(0.5, undefined, { render: false });
      const p1 = __game.player;
      g.player.fellOut = 0;
      return { p0, p1 };
    });
    await check(fall.p0.onGround && !fall.p0.fellOut && fall.p1.onGround && fall.p1.fellOut === 1 && Math.abs(fall.p1.pos[1] - fall.p0.pos[1]) < 0.1,
      `${startZone}: đứng vững trên sàn khi vào zone (y ${fall.p0.pos[1]}); rơi xuyên sàn → về chỗ đứng gần nhất`, JSON.stringify(fall));
    // âm thanh (core/sound.js): đã bấm / gõ phím ở màn tạo nhân vật → AudioContext chạy, đã tải tiếng chung + tiếng của zone,
    // không file nào hỏng, tiếng nền đúng zone; đi tới 1,5 giây (đi được ≥ 1 m) → có tiếng bước chân, rồi về chỗ cũ
    await wait(() => __game.audio.loaded >= 30 || __game.audio.state !== "running", 10000);
    const au = await ev(() => {
      const g = __game._game, p0 = g.player.position.clone(), a0 = __game.audio;
      __game.simulate(1.5, { x: 0, y: 1, run: false }, { render: false });
      const moved = Math.hypot(g.player.position.x - p0.x, g.player.position.z - p0.z), a1 = __game.audio;
      g.player.body.teleport(p0.clone().setY(p0.y + 0.05));
      __game.simulate(0.3, undefined, { render: false });
      return { state: a0.state, loaded: a0.loaded, failed: a1.failed, ambience: a0.ambience, want: g.zoneAudio().ambience, moved: +moved.toFixed(2), steps: a1.steps - a0.steps };
    });
    await check(au.state === "running" && au.loaded >= 30 && !au.failed && au.ambience === au.want && (au.moved < 1 || au.steps > 0),
      `${startZone}: âm thanh — AudioContext chạy, ${au.loaded} file đã tải, tiếng nền "${au.ambience}", đi ${au.moved} m → ${au.steps} tiếng bước chân`, JSON.stringify(au));
    // nhạc nền (core/music.js, data/sounds.json → music): bài mặc định đang phát, thời gian chạy; menu Esc: thanh Nhạc, độ nhạy
    // chuột (máy tính: không có thanh cảm ứng) — kéo 200 % → chuột (khoá con trỏ giả lập) xoay gấp đôi, lưu cài đặt; trả về 100 %;
    // thanh Nhạc = 0 → dừng nhạc, kéo lại → phát tiếp
    if (look === looks[0] && startZone === order[0]) {
      await wait(() => __game.audio.music?.playing && __game.audio.music.time > 0.3, 15000);
      const mu = { start: await ev(() => __game.audio.music) };
      await page.waitForTimeout(1200);
      mu.later = await ev(() => __game.audio.music);
      mu.menu = await openMenu();
      const drag = () => ev(() => { const inp = __game._game.input, keep = inp.fakeLock; inp.fakeLock = true; inp.consumeDrag(true);
        document.dispatchEvent(new MouseEvent("mousemove", { movementX: 40, movementY: 0 })); const d = inp.consumeDrag(true).dx; inp.fakeLock = keep; return d; });
      const slide = (sel, v) => ev(([sel, v]) => { const r = document.querySelector(sel); r.value = v; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); return document.querySelector(sel.replace("data-look=", "data-look-out=").replace("input", "output"))?.textContent ?? null; }, [sel, v]);
      // thanh độ nhạy cảm ứng có khi máy có màn cảm ứng (device.touchCapable) — máy CI không có, laptop cảm ứng có
      mu.rows = await ev(() => ({ travel: !!document.querySelector("#menu [data-zone]"), music: !!document.querySelector("#menu [data-vol=music]"), mouse: !!document.querySelector("#menu [data-look=mouse]"), touch: !!document.querySelector("#menu [data-look=touch]"),
        touchCapable: matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 }));
      mu.d1 = await drag();
      mu.label = await slide("#menu [data-look=mouse]", 200);
      mu.d2 = await drag();
      mu.saved = await ev(() => JSON.parse(localStorage.getItem("fville.settings") || "{}").look);
      await slide("#menu [data-look=mouse]", 100);
      await slide("#menu [data-vol=music]", 0);
      mu.off = await wait(() => !__game.audio.music.playing, 3000);
      await slide("#menu [data-vol=music]", 50);
      mu.on = await wait(() => __game.audio.music.playing, 3000);
      await page.keyboard.press("Escape");
      mu.closed = await wait(() => document.getElementById("menu").hidden && __game._game.mode === "play", 5000);
      await check(mu.start?.id === "piano_spiegel" && mu.start.playing && mu.later.time > mu.start.time && !mu.later.failed.length
        && mu.menu && !mu.rows.travel && mu.rows.music && mu.rows.mouse && mu.rows.touch === mu.rows.touchCapable && mu.d1 > 0 && Math.abs(mu.d2 - 2 * mu.d1) < 1e-6 && mu.label === "200%"
        && mu.saved?.mouse === 2 && mu.off && mu.on && mu.closed,
        `nhạc nền "${mu.start?.id}" đang phát (${mu.start?.time} → ${mu.later?.time} s); menu Esc: thanh Nhạc (0 → dừng, kéo lại → phát), độ nhạy chuột 200 % → xoay ×2 (${mu.d1} → ${mu.d2}), lưu cài đặt`,
        JSON.stringify(mu));
    }
    // đổi ngôn ngữ giữa chừng (menu Esc → Language): mục tiêu, tiêu đề menu đổi ngay, tiến trình / vị trí giữ nguyên, đổi lại
    if (lang !== "en" && startZone === order[0]) {
      const q0 = QUESTS.find((q) => q.zone === startZone && q.required)?.title;
      const sw = {};
      const snap = () => ev(() => ({ lang: document.documentElement.lang, objective: __game.objective, menu: document.querySelector("#menu h2")?.textContent,
        quests: __game.progress.quests.length, pos: __game.player.pos, mode: __game._game.mode }));
      // hội thoại on_enter (tin nhắn HR) có thể đang mở hoặc sắp mở → openMenu chờ, giải xong rồi mới bấm Esc
      await page.waitForTimeout(800);
      await ev(() => __game.resolve());
      sw.before = await snap();
      sw.menuOpen = await openMenu();
      if (sw.menuOpen) {
        await page.click("#menu [data-lang=en]", { timeout: 5000 });
        await wait(() => document.documentElement.lang === "en", 10000);
        sw.en = await snap();
        await page.click(`#menu [data-lang=${lang}]`, { timeout: 5000 });
        await wait((l) => document.documentElement.lang === l, 10000, lang);
        sw.back = await snap();
      } else sw.stuck = await snap();
      sw.saved = await ev(() => JSON.parse(localStorage.getItem("fville.settings") || "{}").lang);
      await page.keyboard.press("Escape");
      sw.closed = await wait(() => document.getElementById("menu").hidden && __game._game.mode === "play", 5000);
      await check(sw.before.objective === q0?.[lang] && sw.menuOpen && sw.en?.objective === q0?.en && sw.en?.menu === I18N.en.menu.title
        && sw.back?.objective === q0?.[lang] && sw.back?.menu === I18N[lang].menu.title && sw.saved === lang && sw.closed
        && sw.en?.quests === sw.before.quests && JSON.stringify(sw.en?.pos) === JSON.stringify(sw.before.pos),
        `menu Esc → English → ${I18N[lang].lang[lang]}: mục tiêu "${sw.before.objective}" ↔ "${sw.en?.objective}", tiến trình giữ nguyên, lưu cài đặt`, JSON.stringify(sw));
    }
    // Tú (zone có Tú): đúng model khác giới, áo ngày đầu, chân dung theo bộ đồ, câu dẫn he / she
    const tu = tuOf(look, lang);
    const tuCheck = async (when, cam) => {
      const x = await ev(async () => { const t = __game.tu;
        return { ...t, bus: __game.textOf("tu_bus_ride", "n2"), img: await fetch(t.portrait).then((r) => r.headers.get("content-type"), () => null) }; });
      const ok = x.img?.startsWith("image/png") && x.id === tu.id && x.built === tu.id && x.gender !== chars.models[look.id].gender && x.outfit === (cam ? null : tu.tex)
        && x.portrait === (cam ? tu.portraitCam : tu.portrait) && x.bus?.startsWith(tu.bus) && x.he === tu.he;
      await check(ok, `Tú ${when}: ${tu.id} (${tu.female ? "nữ" : "nam"}), áo ${cam ? "ao_cam" : tu.tex}, chân dung ${(cam ? tu.portraitCam : tu.portrait).split("/").pop()}, "${tu.bus}…"`, JSON.stringify(x));
    };
    if (startZone === order[0]) await tuCheck("trước cổng", false);

    // Offline action wheel: every dance is reachable, playback binds to the
    // existing rig; only the Stop button ends playback and returns to its anchor.
    if (startZone === order[0]) {
      await wait(() => performance.now() - (__game._game.state.readyAt ?? 0) > 1000, 5000);
      await ev(() => __game.resolve());
      await page.keyboard.press("KeyT");
      const opened = await wait(() => __game._game.actionsWheel.open && __game._game.mode === "actions", 5000);
      const visible = async () => ev(() => {
        const buttons = [...document.querySelectorAll("#emotes .wheel-choice")];
        const boxes = buttons.map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, x: r.x, y: r.y, w: r.width, h: r.height }; });
        return { ids: boxes.map(b => b.id), ok: boxes.every(b => b.w >= 43.9 && b.h >= 43.9 && b.x >= 0 && b.y >= 0 && b.x + b.w <= innerWidth && b.y + b.h <= innerHeight),
          overlap: boxes.some((a, i) => boxes.slice(i + 1).some(b => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 1 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 1)) };
      });
      const pages = await ev(() => __game._game.actionsWheel.pages), seen = new Set();
      let fits = true;
      for (let p = 0; opened && p < pages; p++) {
        const v = await visible(); v.ids.forEach(id => seen.add(id)); fits &&= v.ok && !v.overlap;
        if (pages > 1) await clickShown("#emotes [data-a=next]");
        await wait(n => __game._game.actionsWheel.page === n, 3000, (p + 1) % pages);
      }
      mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: join(OUT, `dance-wheel-${look.id}.png`) });
      const id = await ev(() => __game._game.actionsWheel.items[0].id);
      await ev(() => { __game._game.player.character.mixer.timeScale = 0.1; });
      await clickShown("#emotes .wheel-choice[data-i='0']");
      const playing = await wait(id => __game._game.dances.active?.id === id && __game._game.player.character.current?.time > 0, 30000, id);
      const bound = await ev(() => ({ count: Object.keys(__game._game.player.character.actions).filter(k => k.startsWith("dance_")).length,
        loco: __game._game.player.character.loco, connected: __game._game.net.connected }));
      const continuity = await ev(() => {
        const g = __game._game, p = g.player.position.clone(); g.player.character.mixer.timeScale = 1;
        __game.simulate(0.6, { x: 0, y: 1 }, { render: false });
        const inputKept = !!g.dances.active && g.player.position.distanceTo(p) < .01;
        const ch = g.player.character, duration = ch.current.getClip().duration;
        ch.current.time = duration - .05; ch.dancePlayback.elapsed = duration - .05; ch.mixer.update(0);
        const before = g.dances.position.clone(); ch.update(.1);
        const loopGap = g.dances.position.distanceTo(before);
        return { inputKept, loopGap, carried: ch.danceMotion.position.length() > .01, stillActive: !!g.dances.active };
      });
      await page.setViewportSize({ width: 640, height: 230 });
      await page.keyboard.press("KeyT");
      await wait(() => __game._game.actionsWheel.open && __game._game.actionsWheel.pageSize === 4, 5000);
      const short = await visible();
      await page.screenshot({ path: join(OUT, `dance-wheel-short-${look.id}.png`) });
      await page.keyboard.press("Escape");
      const closed = await wait(() => !__game._game.actionsWheel.open && __game._game.mode === "play" && document.getElementById("menu").hidden, 5000);
      const kept = await ev(() => !!__game._game.dances.active);
      await page.keyboard.press("KeyT");
      await clickShown("#emotes [data-a=stop]");
      const stopped = await ev(() => {
        const g = __game._game; __game.simulate(.6, undefined, { render: false });
        return !g.dances.active && !g.player.dancing && g.player.character.loco && g.player.character.danceMotion.position.length() < .001;
      });
      await page.setViewportSize({ width: 640, height: 360 });
      await check(opened && fits && seen.size === 1 && playing && bound.count === 1 && !bound.loco && !bound.connected
        && continuity.inputKept && continuity.loopGap < .3 && continuity.carried && continuity.stillActive && kept && stopped && short.ok && !short.overlap && closed,
        "Hành động T: nhảy liên tục qua vòng lặp, phím đi / mở vòng / Esc không ngắt; bấm Dừng mới về mốc, màn thấp 230 px", JSON.stringify({ opened, fits, seen: seen.size, playing, bound, continuity, kept, stopped, short, closed }));
    }

    const pauses = (st) => zoneIsLast(st.zone) ? [...(st.lunch ? [] : ["time_skip"]), ...(st.login ? [] : ["login"]), ...(st.reloaded || look !== looks[0] ? [] : ["ending:lan"])] : [];
    for (let zi = order.indexOf(startZone); zi < order.length && !failed; zi++) {
      const zone = order[zi], next = order[zi + 1], zt = Date.now();
      const required = await ev((z) => __game._game.content.quests.filter((q) => q.zone === z && q.required).map((q) => q.id), zone);
      const ps = { zone, lunch: false, login: false, reloaded: false };
      // lời dẫn khi bước vào vùng (zones.json → events có area + once_flag): zone_05 hành lang phòng họp, khu bàn làm việc — bước
      // vào hộp → đúng hội thoại lời dẫn mở, giải xong rồi ra vào lại không mở nữa (cờ lưu bản lưu). Xong về chỗ cũ. Chạy đầu tiên trong zone: các
      // bước sau dịch chuyển vào các vùng này (cửa phòng họp, Prajith, ghế…) không bị lời dẫn mở chen ngang
      const areaEvs = (zonesCfg.zones[zone]?.events || []).filter((e) => e.area?.center && e.once_flag);
      if (areaEvs.length && look === looks[0]) {
        const back = await ev(() => __game.player.pos);
        await ev(() => __game.resolve());
        const got = [];
        for (const e of areaEvs) {
          got.push(await ev(async (e) => {
            const g = __game._game, P = g.player, at = (dz) => { P.body.teleport(new P.body.position.constructor(e.area.center[0], 0.05, e.area.center[2] + dz)); P.velocity.set(0, 0, 0); P.sync(); __game.simulate(0.4, undefined, { render: false }); };
            at(0);
            const opened = g.runner.active?.id ?? null, text = document.querySelector("#dialogue")?.textContent?.slice(0, 80) ?? "";
            await __game.resolve();
            P.body.teleport(new P.body.position.constructor(e.area.center[0], 0.05, e.area.center[2] + e.area.size[2] / 2 + 3)); P.sync(); __game.simulate(0.3, undefined, { render: false });
            at(0);
            const again = g.runner.active?.id ?? null;
            await __game.resolve();
            return { want: e.dialogue, opened, again, flag: g.progress.flags.has(e.once_flag), text };
          }, e));
        }
        await ev((p) => { const P = __game._game.player; P.body.teleport(new P.body.position.constructor(p[0], p[1] + 0.05, p[2])); P.sync(); __game.simulate(0.3, undefined, { render: false }); }, back);
        await check(got.every((r) => r.opened === r.want && !r.again && r.flag),
          `${zone}: lời dẫn khi bước vào vùng — ${got.map((r) => r.want).join(", ")}: mở 1 lần, ra vào lại không lặp`, JSON.stringify(got));
      }
      // Rebuilt office: exercise the real capsule solver on both corridor directions
      // and each meeting-room doorway without advancing quests or moving the player.
      if (zone === "zone_05" && look === looks[0]) {
        await ev(() => __game.resolve());
        const office = await ev(() => {
          const g = __game._game, V = g.player.position.constructor;
          const body = new g.player.body.constructor();
          body.teleport(new V(-2, 0.05, 0));
          const legs = [];
          const go = (x, z) => {
            let distance = Infinity;
            for (let i = 0; i < 1600; i++) {
              const d = new V(x - body.position.x, 0, z - body.position.z);
              distance = d.length();
              if (distance < 0.1) break;
              body.step(1 / 60, d.normalize().multiplyScalar(Math.min(4, distance * 60)), g.zone.collider);
            }
            legs.push({ to: [x, z], reached: distance < 0.1, floor: Math.abs(body.position.y) < 0.05 });
          };
          const far = g.zone.nodes.get('SPAWN_phong_phu').getWorldPosition(new V());
          go(far.x - 10, 0); go(-2, 0);
          const names = [], doors = [];
          for (const id of ["phong_hop_mentor", "phong_hop_manager", "phong_hop_3"]) {
            const room = g.zone.nodes.get(`INT_${id}`), p = room?.getWorldPosition(new V());
            if (!p) { legs.push({ reached: false, missing: id }); continue; }
            names.push(room.userData.label);
            go(p.x, 0);
            const approach = body.position.clone();
            go(p.x, -3.65);
            const blockedClosed = !legs.pop().reached;
            body.teleport(approach);
            const d = g.roomDoors.list.find(d => d.cfg.id === id);
            const opened = g.roomDoors.toggle(id);
            for (let k = 0; k < 60; k++) g.roomDoors.update(1 / 60);
            const rotated = d.node.quaternion.angleTo(d.from) > 1.4;
            go(p.x, -3.65); go(p.x, 0);
            const original = g.player.position.clone();
            g.player.body.teleport(new V(p.x, 0.05, -1.5));
            const safe = g.roomDoors.toggle(id) === false && d.target;
            g.player.body.teleport(original);
            const closed = g.roomDoors.toggle(id);
            for (let k = 0; k < 60; k++) g.roomDoors.update(1 / 60);
            const settled = !d.target && !d.moving && d.node.quaternion.angleTo(d.from) < .001;
            doors.push({ opened, rotated, blockedClosed, safe, closed, settled });
          }
          const batches = []; g.zone.root.traverse(o => { if (o.userData.batchGroup === "ENV_ban_phu") batches.push(o.name); });
          return { legs, names, batches, doors };
        });
        await check(office.legs.every(l => l.reached && l.floor) && office.names.length === 3 && office.batches.length > 0
          && office.doors.every(d => Object.values(d).every(Boolean)),
          "zone_05: 3 cửa đóng chặn capsule, mở đi qua, biển xoay theo cánh; không đóng khi có người; hành lang / sàn liên tục", JSON.stringify(office));
        // Exercise the same E callback / live prompt used by the touch action button.
        await ev(() => __game.resolve());
        const doorUi = await ev(() => {
          const g = __game._game, p = g.player.position.clone();
          const door = g.zone.nodes.get('INT_cua_phong_hop_3').getWorldPosition(new p.constructor());
          g.player.body.teleport(new p.constructor(door.x, .05, door.z + 1.1));
          const before = g.interaction.update(g.player.position);
          const current = g.interaction.current?.item.action;
          g.interact(); g.roomDoors.update(1);
          const after = g.interaction.update(g.player.position);
          g.interact(); g.roomDoors.update(1);
          g.player.body.teleport(p);
          return { before, after, current, closed: !g.roomDoors.list[2].target };
        });
        await check(doorUi.current === "door:phong_hop_3" && doorUi.before !== doorUi.after && doorUi.closed,
          "cửa Ước Lễ: tương tác E / nút cảm ứng đổi Mở ↔ Đóng theo trạng thái", JSON.stringify(doorUi));
        const surfaces = await ev(({ rooms, seats }) => {
          const g = __game._game, V = g.player.position.constructor;
          const points = rooms.flatMap(r => {
            const [x0, x1, y0, y1] = r.bounds;
            return [y0 + 1.15, (y0 + y1) / 2 - .4, y1 - .45].map(y => ({ room: r.id, x: x1 - .1, y: 1.37, z: -y, hits: 0 }));
          });
          const gaps = [], seatSupport = [];
          for (const r of rooms) {
            const room = g.zone.nodes.get(`INT_${r.id}`), cx = (r.bounds[0] + r.bounds[1]) / 2, cy = (r.bounds[2] + r.bounds[3]) / 2;
            let nearest = Infinity, tip = -Infinity;
            const roomSeats = seats.filter(s => s.group === r.id).map(s => ({ ...s, hits: 0 }));
            const areaXZ = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
            g.zone.nodes.get(`${r.id}_mesh`).traverse(o => {
              const a = o.geometry?.attributes.position;
              if (!a) return;
              for (let i = 0; i < a.count; i++) {
                const v = new V().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld), y = -v.z;
                if (v.y > .03 && v.y < 1.2 && Math.abs(v.x - cx) < 1.8 && y > r.bounds[2] + .5 && y < cy) nearest = Math.min(nearest, y);
              }
              const index = o.geometry.index;
              for (let i = 0, n = index?.count ?? a.count; i < n; i += 3) {
                const v = [0, 1, 2].map(k => new V().fromBufferAttribute(a, index ? index.getX(i + k) : i + k).applyMatrix4(o.matrixWorld));
                if (Math.abs(areaXZ(...v)) < 1e-8) continue;
                for (const s of roomSeats) {
                  if (!v.every(p => Math.abs(p.y - (s.at[1] + s.h)) < .008)) continue;
                  const p = new V(...s.at), d = [areaXZ(v[0], v[1], p), areaXZ(v[1], v[2], p), areaXZ(v[2], v[0], p)];
                  if (d.every(x => x >= -1e-6) || d.every(x => x <= 1e-6)) s.hits++;
                }
              }
            });
            seatSupport.push(...roomSeats);
            const col = g.zone.nodes.get(`COL_cua_${r.id}_open`);
            col.traverse(o => {
              const a = o.geometry?.attributes.position;
              if (!a) return;
              for (let i = 0; i < a.count; i++) tip = Math.max(tip, -new V().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).z);
            });
            gaps.push({ room: r.id, metres: nearest - tip });
          }
          const area = (a, b, c) => (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
          g.zone.root.traverse(o => {
            if (!o.isMesh) return;
            for (let parent = o; parent; parent = parent.parent) if (/^(COL_|TRIGGER_|PROP_)/.test(parent.name)) return;
            const p = o.geometry.attributes.position, index = o.geometry.index;
            for (let i = 0, n = index?.count ?? p.count; i < n; i += 3) {
              const v = [0, 1, 2].map(k => new V().fromBufferAttribute(p, index ? index.getX(i + k) : i + k).applyMatrix4(o.matrixWorld));
              if (Math.abs(area(...v)) < 1e-8) continue;
              for (const point of points) {
                if (!v.every(a => Math.abs(a.x - point.x) < .004)) continue;
                const d = [area(v[0], v[1], point), area(v[1], v[2], point), area(v[2], v[0], point)];
                if (d.every(a => a >= -1e-6) || d.every(a => a <= 1e-6)) point.hits++;
              }
            }
          });
          return { gaps, points, seatSupport };
        }, { rooms: OFFICE.meeting_rooms, seats: SEATS.zones.zone_05 });
        await check(surfaces.gaps.every(g => Number.isFinite(g.metres) && g.metres >= .85)
          && surfaces.points.every(p => p.hits === 1),
          "phòng họp: cửa mở cách dãy ghế ≥ 85 cm; tường sau sếp / vách chung chỉ một mặt tại 9 điểm (không z-fighting)", JSON.stringify(surfaces));
        await check(surfaces.seatSupport.length === 18 && surfaces.seatSupport.every(s => s.hits > 0),
          "phòng họp: 18 vị trí ngồi tự do nằm trên mặt ghế thật sau khi nới phòng", JSON.stringify(surfaces.seatSupport));
        const boss = await ev(async () => {
          const g = __game._game, npc = g.npcs.find(n => n.role === "manager"), p = g.player.position.clone();
          const initial = { state: npc.state, clip: npc.character.current?.getClip().name };
          const props = g.zone.fixes.props.filter(n => /ceo_office|apple_desktop/.test(n));
          g.checkNpcEntries();
          const stayed = !npc.arrived;
          const room = g.zone.nodes.get('INT_phong_hop_mentor').getWorldPosition(new p.constructor());
          g.player.body.teleport(new p.constructor(room.x, .05, -3));
          g.checkNpcEntries();
          const rising = npc.state === "standing_up";
          // Interacting during stand-up must wait for the greeting before speaking.
          const talk = npc.engage(g.player.position.clone());
          for (let i = 0; i < 600; i++) { npc.update(1 / 60); await Promise.resolve(); }
          const speaking = npc.state === "talking";
          if (speaking) await talk;
          const exit = npc.arrivalExit.distanceTo(npc.character.root.position) < .01;
          npc.release();
          for (let i = 0; i < 260; i++) { npc.update(1 / 60); await Promise.resolve(); }
          g.checkNpcEntries();
          const idle = npc.state === "idle" && npc.pose === "stand" && !npc._arrival;
          g.player.body.teleport(p);
          return { initial, props, stayed, rising, speaking, exit, idle };
        });
        await check(boss.initial.state === "seated" && boss.initial.clip === "sit_type" && boss.props.length === 2
          && boss.stayed && boss.rising && boss.speaking && boss.exit && boss.idle,
          "Prajith: gõ máy tại bàn mới → vào phòng 1 đứng dậy, ra chỗ trống; E chờ đứng xong, nói xong tiếp tục đứng", JSON.stringify(boss));
      }
      // cây / bụi tre mô hình Sketchfab (zone 0–3): bản sao dùng chung lưới đã gộp thành vài mesh (world/zone.js
      // batchInstances), mỗi bản sao = 1 cây riêng để làm mờ (số cây khác nhau, camera giữa tán → cây mờ), lá cắt alpha
      // (alphaTest) không viền nét; zone_00 / zone_01: xe bus mô hình (thân + cánh cửa dùng chung lưới, chất liệu M_bus_tex)
      if (["zone_00", "zone_01", "zone_02", "zone_03"].includes(zone) && look === looks[0]) {
        const v = await ev((z) => {
          const g = __game._game, st = g.seeThrough, root = g.zone.root;
          const merged = [], mats = {};
          root.traverse((o) => { if (o.isMesh && o.geometry.attributes.plantId) merged.push(o.name); });
          root.traverse((o) => { if (o.isMesh) mats[o.userData.srcMaterial?.name ?? o.material.name] = o.material; });
          const leaf = mats.M_tree_leaf;
          const c = new (g.camera.position.constructor)();
          const own = new Set(st.canopies.map((x) => x.id)).size === st.canopies.length && st.canopies.every(({ box }) => st.containing(box.getCenter(c)) > 0);
          const bus = z === "zone_00" ? ["xe_bus_1", "xe_bus_2", "xe_bus_3"] : z === "zone_01" ? ["xe_bus_mesh"] : [];
          const busOk = bus.every((n) => { const o = root.getObjectByName(n), d = root.getObjectByName(z === "zone_00" ? `${n}_cua` : "xe_bus_cua");
            let m = null; o?.traverse((x) => { if (x.isMesh && !m) m = x; }); return o && d && m?.userData.srcMaterial?.name === "M_bus_tex"; });
          return { batched: g.zone.batched, merged, canopies: st.canopies.length, own, busOk,
            leaf: leaf && { alphaTest: leaf.alphaTest, outline: leaf.userData.outlineParameters?.visible !== false } };
        }, zone);
        await check(v.batched > 0 && v.merged.length >= 2 && v.canopies === v.batched && v.own && v.busOk && v.leaf?.alphaTest > 0 && !v.leaf.outline,
          `${zone}: ${v.batched} cây / bụi tre gộp thành ${v.merged.length} mesh, mỗi bản sao 1 cây (làm mờ riêng), lá alphaTest không viền${zone < "zone_02" ? ", xe bus mô hình" : ""}`,
          JSON.stringify(v));
      }
      // bầu trời + phông nền xa (render/sky.js, data/backdrop.json): zone ngoài trời 0–2, đứng ở mọi SPAWN_ nhìn ngang 8 hướng →
      // phần nhìn thấy trời / phông nền ở nửa trên khung không còn là một màu phẳng (màu phổ biến nhất ≤ 80 %; trời phẳng cũ = 100 %);
      // sương màu chân trời; tổng tam giác trong giới hạn
      if (["zone_00", "zone_01", "zone_02"].includes(zone) && look === looks[0]) {
        const sk = await ev(async () => ({ info: __game.sky, views: await __game.skyCheck() }));
        const open = sk.views.filter((v) => v.sky >= 0.15), flat = open.filter((v) => v.share > 0.8);
        const tris = sk.info.core + sk.info.extra + sk.info.clouds + sk.info.ground;
        await check(open.length > 0 && !flat.length && sk.info.fog && tris <= 5000,
          `${zone}: bầu trời chuyển màu + phông nền xa — ${open.length}/${sk.views.length} hướng nhìn thấy trời, màu phổ biến nhất ≤ ${Math.max(...open.map((v) => v.share))} (trời phẳng = 1), sương ${sk.info.fog?.join("–")} m, ${tris} tam giác`,
          JSON.stringify({ info: sk.info, flat, open: open.map((v) => [v.spawn, v.dir, v.share]) }));
      }
      // tiếng bước chân khớp nhịp chân (game/footsteps.js — theo xương cổ chân của animation): zone_02 (đường thoáng), mỗi ngoại
      // hình — đứng yên không có tiếng; đi / chạy: mỗi khoảng giữa 2 tiếng ≈ nửa chu kỳ animation (1 chân chạm đất), không tiếng thừa
      if (zone === "zone_02") {
        const fs = await ev(async () => { if (__game._game.mode !== "play") await __game.resolve({ maxMs: 15000 }); return __game.stepCheck(); });
        const fit = (m) => m.half && m.steps >= Math.floor(3 / m.half) - 1 && m.gaps.every((x) => x > 0.7 * m.half && x < 1.3 * m.half);
        await check(fs.idle.steps === 0 && fit(fs.walk) && fit(fs.run),
          `${zone}: tiếng bước chân khớp nhịp chân — đứng yên 0 tiếng, đi ${fs.walk.steps} tiếng / 3 s (cách ~${fs.walk.gaps[0]} s, nửa chu kỳ ${fs.walk.half} s), chạy ${fs.run.steps} tiếng (cách ~${fs.run.gaps[0]} s, nửa chu kỳ ${fs.run.half} s)`,
          JSON.stringify(fs));
      }
      // zone_05: bàn bi-a (mô hình Sketchfab, node pool_table + 16 bi + cơ, COL): chơi một mình (lời nhắc "Play pool", đánh
      // bằng __game.pool.shoot, bi lăn rồi dừng, rời bàn) và mini-game Một cú bi-a của anh Khang trên bàn thật (thử thách)
      if (zone === "zone_05" && look === looks[0]) {
        const bi = await ev(async () => {
          const g = __game._game, t = g.zone.root.getObjectByName("pool_table");
          const scene = { table: !!t, balls: t ? t.children.filter((c) => /^ball_\d+$/.test(c.name)).length : 0,
            cue: !!t?.getObjectByName("cue"), col: g.zone.colMeshes.some((m) => m.name === "COL_ban_bi_a") };
          // hội thoại on_enter của zone (app báo họp, 600 ms sau khi vào zone) có thể chưa hiện → chờ rồi giải trước khi tới bàn
          await new Promise((r) => setTimeout(r, Math.max(0, (g.state.readyAt ?? 0) + 900 - performance.now())));
          if (g.mode !== "play") await __game.resolve({ maxMs: 20000 });
          const a = await __game.approach("pool_table");
          const prompt = __game.prompt?.text;
          __game.interact();
          const inPool = { mode: g.mode, ...__game.pool };
          // giữ D rồi A (xoay góc cơ, mỗi phím 1 s): người chơi đi vòng quanh bàn, chân vẫn trên sàn (lỗi cũ: +2 cm mỗi khung →
          // bay lên ~1 m/s)
          const turn = { yMax: -Infinity, turned: 0, moved: 0 };
          const a0 = g.pool.angle, p0 = g.player.position.clone();
          for (const key of ["KeyD", "KeyA"]) {
            g.input.keys.add(key);
            for (let i = 0; i < 60; i++) {
              g.update(1 / 60);
              turn.yMax = Math.max(turn.yMax, g.player.position.y);
              turn.turned = Math.max(turn.turned, Math.abs(g.pool.angle - a0));
              turn.moved = Math.max(turn.moved, g.player.position.distanceTo(p0));
            }
            g.input.keys.delete(key);
          }
          for (let i = 0; i < 30; i++) g.update(1 / 60);
          turn.rise = +(turn.yMax - g.player.position.y).toFixed(3);
          turn.turned = +turn.turned.toFixed(2); turn.moved = +turn.moved.toFixed(2);
          const before = __game.pool.cue;
          const shot = __game.pool.shoot(Math.PI / 2 + 0.01, 0.9);
          // camera lúc bi lăn: dưới chao đèn treo, tia camera → tâm bàn không vướng đèn / trần (trước đây camera bị kéo sát chao)
          const cam = { frames: 0, maxY: 0, headroom: null, blocked: 0 };
          for (let i = 0; i < 2000 && g.pool.playback; i++) {
            g.update(1 / 20);
            if (g.pool.phase === "roll" && i >= 10) { const v = g.pool.cameraView(); cam.frames++; cam.maxY = Math.max(cam.maxY, v.y); cam.headroom = v.headroom; if (v.blocked != null) cam.blocked++; }
            if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
          }
          const res = await shot;
          const after = __game.pool;
          // vị trí bi đang vẽ khớp trạng thái cuối, mọi bi trên bàn nằm trong mép băng
          const tb = g.pool.table, st = g.pool.state;
          const drawn = st.balls.every((b, i) => !b.on || (Math.abs(g.pool.balls[i].position.x - b.x) < 1e-6 && Math.abs(g.pool.balls[i].position.z - b.z) < 1e-6));
          const inside = st.balls.every((b) => !b.on || (Math.abs(b.x) <= tb.rx && Math.abs(b.z) <= tb.rz));
          const left = __game.pool.leave();
          const out = { mode: g.mode, cuesBack: !left.cuesHidden };
          // anh Khang: Một cú bi-a trên bàn thật (tự giải = cú tìm được bằng vật lý)
          const k = await __game.approach("NPC_ban_bi_a");
          __game.interact();
          const r = await __game.resolve({ maxMs: 60000 });
          return { scene, ok: a.ok && k.ok, prompt, inPool: { mode: inPool.mode, active: inPool.active, hidden: inPool.cuesHidden }, turn, cam, before, res, after: { phase: after.phase, shots: after.shots, cue: after.cue }, drawn, inside, out,
            khang: { minigames: r.minigames, dialogues: r.dialogues, played: g.progress.flags.has("billiards_played"), potted: g.progress.flags.has("billiards_potted"),
              hit: g.progress.flags.has("billiards_last_hit"), pool: g.pool.active, mode: g.mode } };
        });
        await check(bi.scene.table && bi.scene.balls === 16 && bi.scene.cue && bi.scene.col && bi.ok && bi.prompt === "Play pool" && bi.inPool.mode === "pool" && bi.inPool.active && bi.inPool.hidden
          && bi.turn.turned > 0.5 && bi.turn.moved > 0.3 && bi.turn.rise < 0.01
          && bi.cam.frames > 5 && bi.cam.headroom < 1.7 && bi.cam.maxY <= bi.cam.headroom + 0.01 && bi.cam.blocked === 0
          && bi.res && bi.res.frames > 10 && bi.res.time > 0.3 && bi.after.phase === "aim" && bi.after.shots === 1 && (bi.after.cue.z !== bi.before.z || !bi.after.cue.on) && bi.drawn && bi.inside
          && bi.out.mode === "play" && bi.out.cuesBack,
          `zone_05: bàn bi-a — "Play pool", xoay cơ (đi vòng ${bi.turn.moved} m, chân cách sàn tối đa ${Math.round(bi.turn.rise * 1000)} mm), phá bi (${bi.res?.pocketed?.length ?? 0} bi vào lỗ, ${bi.res?.time ?? "?"} s; camera cao ${bi.cam.maxY} m ≤ ${bi.cam.headroom} m dưới chao đèn, ${bi.cam.blocked}/${bi.cam.frames} khung bị che), bi dừng đúng chỗ, rời bàn`, JSON.stringify(bi));
        await check(bi.khang.minigames.includes("billiards") && bi.khang.played && bi.khang.potted && bi.khang.hit && !bi.khang.pool && bi.khang.mode === "play",
          "zone_05: anh Khang → Một cú bi-a trên bàn thật: bi vào lỗ, billiards_potted + billiards_played (gộp)", JSON.stringify(bi.khang));
        // bi-a: ngắm bằng chuột (sự kiện chuột thật của trình duyệt). Không khoá con trỏ (smoke tắt khoá): cơ hướng tới điểm con
        // trỏ trên mặt bàn, camera đứng yên; rời cửa sổ rồi bấm → chỉ lấy lại chuột; bấm giữ → nạp lực, thả → đánh đúng hướng đó.
        // Khoá con trỏ (giả lập input.fakeLock — headless không khoá thật ổn định): cú bấm đầu chỉ để khoá, di chuột sang phải →
        // cơ quay sang phải màn hình, giữ Shift → chậm ~4 lần, D cũng xoay, bấm giữ → nạp lực, thả → đánh
        const tick = (n) => ev((n) => { for (let i = 0; i < n; i++) __game._game.update(1 / 30); }, n);
        const settle = () => ev(async () => {
          const g = __game._game;
          for (let i = 0; i < 2000 && g.pool.playback; i++) { g.update(1 / 20); if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0)); }
          return { ...__game.pool };
        });
        const aimDir = () => ev(() => {
          const g = __game._game, p = g.pool, V = g.camera.position.constructor;
          const right = new V(1, 0, 0).applyQuaternion(g.camera.quaternion), o = p.root.localToWorld(new V(0, 0, 0));
          const d = p.root.localToWorld(new V(Math.cos(p.angle), 0, Math.sin(p.angle))).sub(o);
          return { angle: p.angle, right: [right.x, right.y, right.z], d: [d.x, d.y, d.z] };
        });
        const turnedRight = (a, b) => (b.d[0] - a.d[0]) * a.right[0] + (b.d[1] - a.d[1]) * a.right[1] + (b.d[2] - a.d[2]) * a.right[2] > 0;
        const ma = {};
        try {
          // camera về ngay chỗ đứng (không trượt dần) — toạ độ màn hình tính trước khi di chuột phải còn đúng lúc chuột tới
          await ev(async () => { await __game.approach("pool_table"); __game.pool.enter(); __game.pool.rerack(); __game._game.pool.snapCamera = true; });
          await tick(3);
          // không khoá: 2 điểm trước bi trắng (bên phải / trái), di chuột tới → góc cơ = hướng bi trắng → điểm đó
          const s0 = await ev(() => { const p = __game._game.pool, c = p.state.balls[0]; return { mode: p.mouseMode, cue: [c.x, c.z], cam: +p.camAngle.toFixed(4) }; });
          // điểm phải nằm trên khung vẽ (khung nhỏ 640 × 360: bảng bi-a góc trên che một phần bàn — con trỏ ở đó không ngắm)
          const pick = (side) => ev(([cx, cz, side]) => {
            for (const [dx, dz] of [[0.2, 0.7], [0.15, 0.5], [0.1, 0.4], [0.08, 0.3]]) {
              const x = cx + side * dx, z = cz + dz, sc = __game.pool.screen(x, z);
              if (sc?.visible && document.elementFromPoint(sc.x, sc.y)?.tagName === "CANVAS") return { x, z, sc };
            }
            return null;
          }, [s0.cue[0], s0.cue[1], side]);
          const aims = [];
          for (const side of [1, -1]) {
            const pt = await pick(side);
            if (!pt) { aims.push({ side, error: "không có điểm trên khung vẽ" }); continue; }
            await page.mouse.move(pt.sc.x, pt.sc.y);
            await tick(2);
            const i = await ev(() => __game.pool);
            aims.push({ want: +Math.atan2(pt.z - s0.cue[1], pt.x - s0.cue[0]).toFixed(4), got: i.angle, cursorAim: i.cursorAim, cam: i.camAngle });
          }
          await ev(() => dispatchEvent(new Event("blur")));            // rời cửa sổ
          await page.mouse.down(); await tick(4);
          const regain = await ev(() => ({ phase: __game.pool.phase, pressing: __game.pool.pressing }));
          await page.mouse.up(); await tick(2);
          const shots0 = (await ev(() => __game.pool)).shots;
          await page.mouse.down(); await tick(8);
          const charging = (await ev(() => __game.pool)).phase;
          await page.mouse.up(); await tick(1);
          const shotAngle = (await ev(() => __game.pool)).angle;
          const fin = await settle();
          ma.free = { mode: s0.mode, aims, camStill: aims.every((a) => a.cam === s0.cam), regain, charging, shotAngle, shots: fin.shots - shots0, phase: fin.phase };
          // khoá được nhưng chưa khoá: cú bấm đầu chỉ để khoá (không nạp lực)
          await ev(() => { const i = __game._game.input; i.lockSupported = true; i.fakeLock = false; });
          const mode0 = (await ev(() => __game.pool)).mouse;
          await page.mouse.down(); await tick(4);
          const first = await ev(() => ({ phase: __game.pool.phase, pressing: __game.pool.pressing }));
          await page.mouse.up();
          await page.waitForTimeout(150); await tick(2);
          const mode1 = (await ev(() => __game.pool)).mouse;
          // đang khoá: di chuột sang phải 40 px (movementX), rồi giữ Shift di thêm 40 px; giữ D 10 khung
          const move = () => ev(() => document.dispatchEvent(new MouseEvent("mousemove", { movementX: 40, movementY: 0 })));
          const d0 = await aimDir(); await move(); await tick(1);
          const d1 = await aimDir();
          await page.keyboard.down("Shift"); await move(); await tick(1); await page.keyboard.up("Shift");
          const d2 = await aimDir();
          await ev(() => __game._game.input.keys.add("KeyD")); await tick(10); await ev(() => __game._game.input.keys.delete("KeyD"));
          const d3 = await aimDir();
          const shots1 = (await ev(() => __game.pool)).shots;
          await page.mouse.down(); await tick(8);
          const charging2 = (await ev(() => __game.pool)).phase;
          await page.mouse.up(); await tick(1);
          const fin2 = await settle();
          ma.lock = { mode0, first, mode1, mouseRight: turnedRight(d0, d1), turn: +(d1.angle - d0.angle).toFixed(4), fine: +(d2.angle - d1.angle).toFixed(4),
            dRight: turnedRight(d2, d3), charging: charging2, shots: fin2.shots - shots1 };
        } catch (e) { ma.error = e.message.split("\n")[0]; }
        finally {
          await ev(() => { __game._game.pool?.leave(); const i = __game._game.input; i.fakeLock = null; i.lockSupported = false; });
        }
        const f = ma.free, l = ma.lock;
        await check(!ma.error && f?.mode === "free" && f.aims.every((a) => Math.abs(a.got - a.want) < 0.01 && a.cursorAim) && f.camStill
          && f.regain.phase === "aim" && !f.regain.pressing && f.charging === "charge" && Math.abs(f.shotAngle - f.aims[1].want) < 0.01 && f.shots === 1
          && l?.mode0 === "wait" && l.first.phase === "aim" && !l.first.pressing && l.mode1 === "lock" && l.mouseRight && l.turn > 0.03
          && Math.abs(l.fine / l.turn - 0.25) < 0.05 && l.dRight && l.charging === "charge" && l.shots === 1,
          `zone_05: bi-a ngắm bằng chuột — không khoá: cơ theo con trỏ (lệch ${f ? Math.max(...f.aims.map((a) => Math.abs(a.got - a.want))).toFixed(4) : "?"} rad, camera đứng yên), bấm sau khi rời cửa sổ không đánh, giữ → đánh; khoá: cú bấm đầu chỉ khoá, chuột phải → cơ quay phải (${l?.turn} rad / 40 px, Shift ${l?.fine}), D xoay, giữ → đánh`,
          JSON.stringify(ma));
        // bi-a: điểm chạm trên bi trắng (xoáy) ở bàn tập — kéo chấm bằng chuột thật (ô góc phải dưới, không phải khung vẽ: góc cơ
        // không đổi, không nạp lực), phím Z / X / F / B 1 nấc, đường gợi ý hướng bi trắng sau chạm; đánh → cú dùng nấc đã chọn
        // rồi chấm về giữa
        const sp = {};
        try {
          await ev(async () => { await __game.approach("pool_table"); __game.pool.enter(); __game.pool.rerack(); __game._game.pool.snapCamera = true; });
          await tick(3);
          const i0 = await ev(() => __game.pool);
          const dot = await ev(() => __game.pool.spinDot());
          sp.start = { on: i0.spin.on, shown: i0.spin.shown, text: i0.spin.text, angle: i0.angle, hit: dot && (await ev(([x, y]) => !!document.elementFromPoint(x, y)?.closest("#pool-spin .ball"), [dot.x, dot.y])) };
          await page.mouse.move(dot.x, dot.y); await page.mouse.down();
          await page.mouse.move(dot.x + dot.r * 0.4, dot.y - dot.r * 0.4); await page.mouse.move(dot.x + dot.r * 0.75, dot.y - dot.r * 0.75);
          await page.mouse.up(); await tick(2);
          const i1 = await ev(() => __game.pool);
          sp.drag = { spin: i1.spin.spin, roll: i1.spin.roll, text: i1.spin.text, angle: i1.angle, phase: i1.phase };
          for (const k of ["KeyZ", "KeyZ", "KeyB"]) await page.keyboard.press(k);
          await tick(2);
          const i2 = await ev(() => __game.pool);
          sp.keys = { spin: i2.spin.spin, roll: i2.spin.roll, text: i2.spin.text, path: !!i2.spin.path };
          await ev(() => { __game.pool.shoot(undefined, 0.5); });
          const fin = await settle();
          sp.after = { last: fin.spin.last, spin: fin.spin.spin, roll: fin.spin.roll, shown: fin.spin.shown, phase: fin.phase };
        } catch (e) { sp.error = e.message.split("\n")[0]; }
        finally { await ev(() => __game._game.pool?.leave()); }
        await check(!sp.error && sp.start.on && sp.start.shown && sp.start.hit && sp.start.text === "Center"
          && sp.drag.spin === 2 && sp.drag.roll === 2 && sp.drag.angle === sp.start.angle && sp.drag.phase === "aim"
          && sp.keys.spin === 0 && sp.keys.roll === 1 && sp.keys.path
          && sp.after.last?.spin === 0 && sp.after.last?.roll === 1 && sp.after.last?.own && sp.after.spin === 0 && sp.after.roll === 0 && sp.after.shown && sp.after.phase === "aim",
          `zone_05: bi-a xoáy — kéo chấm bằng chuột → "${sp.drag?.text}" (góc cơ không đổi, không nạp lực); Z Z B → "${sp.keys?.text}"; cú đánh dùng điểm chạm đã chọn, xong về giữa`,
          JSON.stringify(sp));
        // đi ngược khỏi zone 5 (bàn bi-a đã dựng cây cơ) → zone 4 → zone 5: trước đây rời zone 5 báo "Couldn't open …"
        // (t.map?.dispose is not a function — bản sao cây cơ mang userData chép qua JSON), cả cảnh kết sang bến xe cũng hỏng
        const back = await ev(async () => {
          const r1 = await __game._game.enterZone("zone_04", "SPAWN_zone_04_from_zone_05", { fade: false });
          const z1 = { ok: r1, zone: __game.zone, err: document.getElementById("loading").classList.contains("error") };
          const r2 = await __game._game.enterZone("zone_05", "SPAWN_zone_05_from_zone_04", { fade: false });
          return { z1, z2: { ok: r2, zone: __game.zone, err: document.getElementById("loading").classList.contains("error"), pool: !!__game.pool } };
        });
        const conB = problems.splice(0);
        await check(back.z1.ok && back.z1.zone === "zone_04" && !back.z1.err && back.z2.ok && back.z2.zone === "zone_05" && !back.z2.err && back.z2.pool && !conB.length,
          "zone_05 → zone_04 → zone_05 (sau khi chơi bi-a): rời và vào lại zone 5 được, bàn bi-a dựng lại, console sạch", JSON.stringify({ ...back, console: conB.slice(0, 5) }));
      }
      if (/^zone_0[1234]$/.test(zone) && look === looks[0]) {
        const grass = await ev(() => {
          const g = __game._game, meshes = [];
          g.zone.root.traverse((o) => { if (o.isMesh && o.name.startsWith("GRASS_")) meshes.push(o); });
          const map = meshes[0]?.material.map;
          return { ...g.zone.fixes?.grass, count: meshes.length, width: map?.image?.width, height: map?.image?.height,
            normalsUp: meshes.every((o) => o.geometry.attributes.normal.getY(0) > 0.99),
            noOutline: meshes.every((o) => o.material.userData.outlineParameters?.visible === false),
            surface: meshes.every((o) => o.userData.surface === "grass") };
        });
        await check(grass.count > 0 && grass.count === grass.meshes && grass.after <= grass.before && grass.width === 512 && grass.height === 512 && grass.normalsUp && grass.noOutline && grass.surface,
          `${zone}: nền cỏ WebP 512 px, ${grass.before} → ${grass.after} tam giác, ${grass.count} mesh, không viền`, JSON.stringify(grass));
      }
      // ngồi tự do (data/seats.json, game/src/game/interaction.js + Game.sitFree): mỗi nhóm ghế của zone 1 ghế — đứng
      // cạnh ghế → lời nhắc "Sit down", E → ngồi đúng hướng ghế, nâng lên mặt ghế, nhắc "Stand up"; đứng dậy bằng bước đi / E lần
      // nữa (xen kẽ), chỗ đứng không lồng COL_, đi tiếp được. Xong về chỗ cũ
      if (SEATS.zones?.[zone]?.length && look === looks[0]) {
        // ban_intern: lời nhắc là việc ở bàn intern (INT_ban_lam_viec — có bước kiểm tra riêng ở zone 5)
        const list = SEATS.zones[zone], groups = [...new Set(list.map((x) => x.group))].filter((g) => g !== "ban_intern").slice(0, zone === "zone_05" ? 8 : 6);
        const back = await ev(() => __game.player.pos);
        await ev(() => __game.resolve());
        const tries = [];
        // ghế có việc khác ở gần (vd chào Tú cạnh ghế băng mái chờ) thì việc kia được nhắc trước → thử ghế khác cùng nhóm
        for (const [k, gname] of groups.entries()) {
          let r = null;
          for (const i of list.map((x, j) => (x.group === gname ? j : -1)).filter((j) => j >= 0).slice(-4).reverse()) {
            r = await ev(([i, by]) => __game.trySeat(i, by), [i, k % 2 ? "key" : "move"]);
            if (r.seat != null) break;
          }
          tries.push(r);
        }
        await ev((p) => { const P = __game._game.player; P.body.teleport(new P.body.position.constructor(p[0], p[1] + 0.05, p[2])); P.sync(); __game.simulate(0.3, undefined, { render: false }); }, back);
        const L = I18N[lang].seat, bad = tries.filter((r) => !(r.prompt === L.sit && r.seated === "seated" && r.free && r.yawErr < 5 && r.lift > -0.06 && r.lift < r.h
          && r.standPrompt === L.stand && r.stood && r.pen < 0.05 && r.walked > 0.3));
        await check(!bad.length, `${zone}: ngồi tự do ${tries.length} nhóm ghế (${groups.join(", ")} — ${list.length} ghế): "${L.sit}" → ngồi đúng hướng, nâng ${tries.map((r) => r.lift).join(" / ")} m, "${L.stand}" → đứng dậy (bước đi / E), không kẹt`,
          JSON.stringify(bad.length ? bad : tries));
      }
      // zone trong nhà: kéo chuột ngẩng hết cỡ + lăn chuột lùi xa nhất → camera vẫn dưới trần (trần không có COL_; trước
      // đây camera bay lên tận nóc nhà). Đối chứng: cùng các góc khi camera chỉ tránh COL_ (số lần xuyên trần trước khi sửa)
      if (/^zone_0[345]$/.test(zone) && look === looks[0]) {
        const cc = await ev(() => ({ fixed: __game.cameraCeiling(), old: __game.cameraCeiling({ withView: false }) }));
        await check(cc.fixed.through === 0 && cc.fixed.pitch >= 1.1 && cc.fixed.distance >= 7 && cc.fixed.maxUp < cc.old.maxUp,
          `${zone}: camera ngẩng / lùi hết cỡ không xuyên trần (${cc.fixed.n} góc ở ${cc.fixed.points} điểm, cao nhất ${cc.fixed.maxUp} m trên chân; chỉ tránh COL_: xuyên ${cc.old.through} lần, cao ${cc.old.maxUp} m)`,
          JSON.stringify(cc));
      }
      // zone trong nhà: không có chỗ hở (__game.gaps, game/src/world/gaps.js) — từ mọi chỗ đi tới được, tia chéo xuống ở tầm
      // mắt không lọt ra trời (sàn không áp tường, mặt đất ngoài kính thiếu…). Tia ngang lọt qua cửa mở ra sân là đúng, chỉ in
      // số. GAP_FREE: zone đã build lại sau khi sửa script; zone_03, zone_05 thêm vào khi build lại trên máy có file gốc Sketchfab
      if (/^zone_0[345]$/.test(zone) && look === looks[0]) {
        const GAP_FREE = ["zone_04", "zone_05"];
        // FLAT_FREE: zone không có cửa nào mở ra ngoài trời — tia ngang lọt ra = nhìn qua cửa sang zone khác thấy phông nền
        // (thiếu phòng giả scene_fixes → rooms; zone_05: cửa kính vào văn phòng, trước đây ~260 tia)
        const FLAT_FREE = ["zone_04", "zone_05"];
        const gp = await ev((z) => { const r = __game.gaps({ far: z === "zone_05" ? 100 : 60 }); const n = (k) => r.gaps.filter((g) => g.kind === k).reduce((a, g) => a + g.rays, 0);
          const rooms = []; __game._game.zone.root.traverse((o) => { if (o.userData.fix === "room") rooms.push(o.name); });
          return { spots: r.spots, rays: r.rays, down: n("down"), flat: n("flat"), rooms, top: r.gaps.slice(0, 5) }; }, zone);
        const strict = GAP_FREE.includes(zone), flatFree = FLAT_FREE.includes(zone);
        // Lộ trình học (phòng FSA): không có đúng / sai — xếp ngược thứ tự gợi ý bằng phím vẫn được, không tính lỗi, không dấu ✓;
        // bấm ngày đã xếp → lấy thẻ ra; đủ 3 ngày → câu hỏi mục tiêu riêng; Esc đóng (chưa nhận gì, việc z4 làm sau như thường)
        if (zone === "zone_04") {
          await ev(() => { __game._game.runMinigame("learning_path"); });
          const lp = { open: await wait(() => __game.mg?.id === "learning_path", 5000) };
          const st = () => ev(() => __game.mg);
          const key = async (ci) => { const o = (await st()).state.order; await page.keyboard.press(`Digit${o.indexOf(ci) + 1}`); };
          await key(2);
          lp.first = await st();
          await page.click("#minigame .day.filled", { timeout: 5000 });
          lp.back = await st();
          for (const ci of [2, 1, 0]) await key(ci);
          lp.full = await st();
          await page.keyboard.press("Escape");
          lp.closed = await wait(() => !__game.mg?.id && __game._game.mode === "play", 5000);
          await check(lp.open && lp.first.state.slots[0] === 2 && lp.first.mistakes === 0 && !lp.first.hint.includes("✓")
            && lp.back.state.slots.every((x) => x < 0) && lp.full.state.stage === "goal" && lp.full.state.slots.join() === "2,1,0" && lp.full.mistakes === 0 && lp.closed,
            `${zone}: Lộ trình học — xếp ngược thứ tự gợi ý (${lp.full.state.slots.map((i) => lp.full.state.courses[i]).join(" → ")}) không tính lỗi, không ✓ ("${lp.first.hint}"), bấm ngày → lấy thẻ ra, đủ 3 ngày → hỏi mục tiêu riêng`,
            JSON.stringify(lp));
        }
        // chậu cây thay chậu cọ cũ (scene_fixes → remove_parts + props): mọi hộp gỡ đúng 1 cây (≥ 3 mảnh), đủ số chậu mới
        const fxz = SCENE_FIXES[zone] || {}, zf = await ev(() => __game._game.zone.fixes);
        const parts = (zf.remove_parts || []).flatMap((r) => r.parts_per_box);
        if (fxz.props || fxz.remove_parts) await check((zf.props || []).length === (fxz.props || []).length && parts.length && parts.every((n) => n >= 3),
          `${zone}: ${(zf.props || []).length} chậu cây mới (props), gỡ chậu cũ: ${parts.join(" / ")} mảnh mỗi chậu`, JSON.stringify(zf));
        await check(gp.spots > 50 && (!strict || gp.down === 0) && (!flatFree || gp.flat === 0),
          `${zone}: chỗ hở mô hình — ${gp.spots} chỗ đứng, ${gp.rays} tia: ${gp.down} tia nhìn xuống lọt ra trời, ${gp.flat} tia ngang ra ngoài${strict ? "" : " (chưa build lại, chỉ ghi số)"}${gp.rooms.length ? `; phòng giả sau cửa: ${gp.rooms.join(", ")}` : ""}`,
          JSON.stringify(gp));
      }
      // app My FPT → tab Bản đồ (đã có app từ zone 1): ảnh zone nhìn từ trên tải được, dấu bạn + mục tiêu nằm trong ảnh,
      // đóng app (Tab) → chơi tiếp
      if (/^zone_0[2-5]$/.test(zone) && look === looks[0]) {
        await ev(() => __game._game.toggleApp());
        const opened = await wait(() => !!document.querySelector("#myfpt:not([hidden]) [data-tab=map]"), 5000);
        if (opened) await page.click("#myfpt [data-tab=map]");
        const drawn = opened && await wait(() => !!document.querySelector("#myfpt .map img"), 15000);   // ảnh đọc bất đồng bộ
        const m = await ev(async () => {
          const img = document.querySelector("#myfpt .map img");
          if (img && !img.complete) await new Promise((r) => { img.onload = img.onerror = r; });
          const pos = (sel) => { const el = document.querySelector(`#myfpt .map ${sel}`); return el ? [parseFloat(el.style.left), parseFloat(el.style.top)] : null; };
          const logo = document.querySelector("#myfpt .appbar .app-logo");
          return { logo: !!logo?.complete && logo.naturalWidth > 0 && logo.naturalWidth === logo.naturalHeight,
            img: img ? [img.naturalWidth, img.naturalHeight] : null, me: pos(".mk.me"), goal: pos(".mk.goal"), line: document.querySelector("#myfpt .map-goal span")?.textContent.trim() ?? null, map: __game.map };
        });
        await page.keyboard.press("Tab");
        m.closed = await wait(() => document.getElementById("myfpt").hidden && __game._game.mode === "play", 5000);
        const inside = (p) => p && p.every((v) => v >= 0 && v <= 100);
        await check(opened && drawn && m.logo && m.img?.[0] > 100 && m.img[1] > 100 && inside(m.me) && inside(m.goal) && m.line && m.closed,
          `${zone}: app → tab Bản đồ — ảnh ${m.map?.w}×${m.map?.h} (${m.map?.ms} ms), dấu bạn + mục tiêu "${m.line}" trong ảnh, đóng app`, JSON.stringify(m));
      }
      // zone_05: ngồi vào bàn làm việc rồi đứng dậy (hội thoại desk_main khi còn việc khác chưa xong) → ra chỗ trống, đi được.
      // Lỗi cũ: đứng dậy tại điểm ngồi, lọt giữa bàn và ghế (capsule lồng vào COL_) → đi đâu cũng kẹt
      if (zone === "zone_05" && look === looks[0]) {
        const sd = await ev(async () => {
          const g = __game._game, P = g.player, V = P.position.constructor;
          const tr = g.zone.triggers.find((x) => x.name === "TRIGGER_ban_lam_viec");
          const home = P.position.clone(), yaw = g.cam.yaw;
          P.body.teleport(tr.node.getWorldPosition(new V()).add(new V(0, 0.05, 0))); P.velocity.set(0, 0, 0);
          g.triggersOff = true;
          __game.simulate(0.3, undefined, { render: false });
          await g.sitAt("SPAWN_ban_lam_viec");
          const seated = __game.player.seated, seatPen = __game.player.pen;
          await P.standUp();
          const at = P.position.clone(), pen = __game.player.pen, moved = [];
          for (let k = 0; k < 8; k++) {
            P.body.teleport(at.clone().add(new V(0, 0.05, 0))); P.velocity.set(0, 0, 0);
            __game.simulate(0.3, undefined, { render: false });
            g.cam.yaw = (k / 8) * Math.PI * 2;
            const s0 = P.position.clone();
            __game.simulate(1, { x: 0, y: 1 }, { render: false });
            moved.push(+Math.hypot(P.position.x - s0.x, P.position.z - s0.z).toFixed(2));
          }
          P.body.teleport(home.add(new V(0, 0.05, 0))); P.velocity.set(0, 0, 0); g.cam.yaw = yaw;
          __game.simulate(0.3, undefined, { render: false });
          g.triggersOff = false;
          return { seated, seatPen, pen, stood: !P.seated, moved, free: moved.filter((m) => m > 0.8).length };
        });
        await check(sd.seated === "seated" && sd.stood && sd.pen < 0.02 && sd.free >= 4,
          `zone_05: ngồi vào bàn làm việc rồi đứng dậy → ra chỗ trống (điểm ngồi lồng vào bàn / ghế ${sd.seatPen} m → ${sd.pen} m), đi được ${sd.free}/8 hướng`, JSON.stringify(sd));
      }
      let steps = 0, stepFail = null;
      const marks = [];   // trước mỗi việc bắt buộc / lối ra zone: có dấu "!" hoặc mũi tên chỉ đường (__game.guide → marker / arrow)
      while (steps++ < 40) {
        const g = await ev(() => ({ key: __game._game.guide.current().key, zone: __game.zone }));
        if (g.zone !== zone || g.key === "complete") break;
        if ((required.includes(g.key) || g.key.startsWith("exit:")) && !marks.some((m) => m.goal === g.key)) {
          // chỉ xét lúc đang đi lại tự do (hội thoại / cảnh chuyển đang mở thì dấu ẩn là đúng); chờ vài khung để guide cập nhật
          const free = await wait(() => __game._game.mode === "play" && !__game._game.cutscene && __game.state.phase === "playing", 3000);
          if (free) {
            const shown = await wait(() => !!(__game.guide.marker || __game.guide.arrow), 2500);
            marks.push({ goal: g.key, shown, ...(shown ? {} : { guide: await ev(() => { const x = __game.guide; return { marker: x.marker, arrow: x.arrow, enabled: x.enabled, target: x.target, mode: __game._game.mode }; }) }) });
          }
        }
        const st = Date.now();
        let r = await ev((o) => __game.step(o), { pauseOn: pauses(ps) });
        // zone 5: kiểm tra giữa chừng rồi chạy tiếp
        while (r.paused) {
          if (r.paused === "time_skip") {
            ps.lunch = true;
            const saved = await ev(() => JSON.parse(localStorage.getItem("fville.save.v1") || "{}").flags || []);
            await page.keyboard.press("Escape");
            const x = await ev(() => ({ menu: !document.getElementById("menu").hidden, skipping: !!__game._game.timeSkipping }));
            await check(saved.includes("lunch_done") && !x.menu && x.skipping, "zone_05: màn mờ 12:00 — lunch_done lưu trước khi mờ, Esc không mở menu",
              JSON.stringify({ lunch_done: saved.includes("lunch_done"), ...x }));
          } else if (r.paused === "login") {
            ps.login = true;
            const d = await ev(() => { const b = document.querySelector("#minigame"), i = b.querySelector("input.pw");
              return { form: !!b.querySelector("form"), user: !!b.querySelector("input[autocomplete=username], input[name=username]"), newpw: !!b.querySelector("[autocomplete=new-password]"),
                ac: i?.getAttribute("autocomplete"), type: i?.type, masked: i?.classList.contains("masked") ?? false }; });
            await check(!d.form && !d.user && !d.newpw && d.ac === "off" && (d.type === "text" ? d.masked : d.type === "password"),
              "zone_05: Đăng nhập — không form, không ô username, không gợi ý / lưu mật khẩu", JSON.stringify(d));
            // bàn làm việc: người chơi ngồi vào ghế (sit_type, nâng lên mặt ghế), cách chỗ ghế (SPAWN_ban_lam_viec) ~ offset của model
            const seat = await ev(() => {
              const g = __game._game, s = g.zone.spawns.get("SPAWN_ban_lam_viec").getWorldPosition(new g.player.position.constructor());
              const p = __game.player;
              return { ...p, anim: g.player.character.current?.getClip().name, dist: +Math.hypot(p.pos[0] - s.x, p.pos[2] - s.z).toFixed(2), offset: g.player.character.model.seat?.offset_xz_m };
            });
            await check(seat.seated === "seated" && seat.sits >= 1 && seat.rootY > 0.02 && /sit/.test(seat.anim || "") && Math.abs(seat.dist - Math.hypot(...(seat.offset || [0, 0]))) < 0.05,
              `zone_05: ngồi vào ghế bàn làm việc (${seat.anim}, nâng ${Math.round(seat.rootY * 100)} cm, cách chỗ ghế ${seat.dist} m)`, JSON.stringify(seat));
          } else if (r.paused === "ending:lan") {
            ps.reloaded = true;
            await page.goto(`${base}/?debug&net=off&title=off&look=${look.id}`);   // tải lại, bỏ ?start (không dựng lại bản lưu mẫu)
            const back = await wait(() => window.__game?.state.phase === "playing", 120000);
            if (back) await noLock();
            const sum = back && await wait(() => window.__game?.summary.open, 15000);
            const z = await ev((a) => ({ zone: window.__game?.zone, lang: document.documentElement.lang, ach: !!window.__game?.summary.text?.includes(a) }), ACH[lang]);
            await check(sum && z.zone === "zone_01" && z.ach, "cảnh kết: tải lại giữa chừng → bến xe zone_01, thẻ thành tựu, màn tổng kết", JSON.stringify({ back, sum, ...z }));
            r = { complete: true };
            break;
          }
          r = await ev((o) => __game.resolve(o), { pauseOn: pauses(ps) });
          r.goal ??= g.key;
        }
        if (r.complete) break;
        const after = await ev(() => ({ quests: __game.progress.quests, zone: __game.zone, key: __game._game.guide.current().key }));
        const goal = r.goal ?? g.key;
        const ok = r.ok !== false && !r.timeout && (goal.startsWith("exit:") ? after.zone !== zone : after.quests.includes(goal) || after.key === "complete");
        if (verbose) console.log(`    ${ok ? "·" : "!"} ${goal} ${((Date.now() - st) / 1000).toFixed(1)} s ${JSON.stringify({ d: r.dialogues, c: r.choices, m: r.minigames, cs: r.cutscenes })}`);
        if (!ok) { stepFail = `${goal}: ${r.why || (r.timeout ? "quá giờ" : "chưa xong")} ${JSON.stringify({ dialogues: r.dialogues, choices: r.choices, minigames: r.minigames })}`; break; }
      }
      // 1 dòng cho mỗi zone: việc bắt buộc, áo, chuyển zone, console
      const st = await ev(() => ({ quests: __game.progress.quests, zone: __game.zone, outfit: __game.model.outfit ?? null, morph: __game.model.morph, ao: __game.progress.rewards.includes("ao_cam"), complete: __game._game.complete }));
      const missing = required.filter((q) => !st.quests.includes(q));
      const con = problems.splice(0);
      const bad = [stepFail, missing.length && `chưa xong ${missing.join(", ")}`, st.outfit !== (st.ao ? null : "dau_ngay") && `áo sai (outfit=${st.outfit}, ao_cam=${st.ao})`,
        // bộ đồ khác hình khối (morph ao_cam: áo phông của intern_nu_buitoc) bật đúng theo áo đang mặc
        "ao_cam" in st.morph && st.morph.ao_cam !== (st.ao ? 1 : 0) && `morph áo sai (ao_cam=${st.morph.ao_cam}, có Áo Cam=${st.ao})`,
        next && !st.complete && st.zone !== next && `đang ở ${st.zone}, không sang ${next}`, con.length && `console: ${con.slice(0, 5).join(" | ")}`].filter(Boolean);
      const where = st.complete ? "cảnh kết" : next ? `→ ${next}` : "";
      await check(!bad.length, `${zone}: ${required.length} việc bắt buộc, áo ${st.ao ? "ao_cam" : "dau_ngay"}${"ao_cam" in st.morph ? ` (morph ${st.morph.ao_cam})` : ""}, ${where}, console sạch (${Math.round((Date.now() - zt) / 1000)} s)`, bad.join("; "));
      const noMark = marks.filter((m) => !m.shown);
      await check(marks.length > 0 && !noMark.length, `${zone}: mũi tên trên mục tiêu hoặc ở mép màn hình trước ${marks.length} việc bắt buộc / lối ra (${marks.map((m) => m.goal).join(", ")})`,
        JSON.stringify(noMark.length ? noMark : marks));
      if (zone === "zone_02" && !failed && await ev(() => __game.tu.visible)) await tuCheck("sau cổng", true);
      // âm thanh đã phát qua zone 0 → 4 (trước cảnh kết — ngoại hình đầu tải lại trang giữa cảnh kết, bộ đếm về 0)
      if (zone === "zone_04" && !onlyZone && !failed) {
        const ac = await ev(() => __game.audio);
        const need = ["act", "quest", "reward", "mg_done", "line", "select", "phone", "bus_door", "bus_brake", "card_ok", "door_unlock"];
        const miss = need.filter((k) => !ac.counts[k]), steps = Object.entries(ac.counts).filter(([k]) => k.startsWith("step_")).reduce((a, [, v]) => a + v, 0);
        await check(!miss.length && steps > 0 && !ac.failed && ac.state === "running",
          `zone 0 → 4: âm thanh — ${ac.played} tiếng đã phát (${Object.keys(ac.counts).length} loại, ${steps} bước chân), không file hỏng`, JSON.stringify({ miss, failed: ac.failed, state: ac.state, counts: ac.counts }));
      }
      // thẻ nhân viên cầm tay (characters/idcard.js): lễ tân cầm thẻ đưa (zone 3, câu "đây là thẻ nhân viên"), người chơi rút thẻ
      // quẹt ở cửa kính + cửa văn phòng (zone 4) — smoke bấm qua hội thoại nhanh, đi ngay
      if (zone === "zone_04" && !onlyZone && !failed) {
        const ic = await ev(() => __game.idCard);
        // (smoke dịch chuyển người chơi ngay sau khi quẹt → đoạn bước tới đầu đọc bị huỷ, thẻ cất luôn: walk_cancel)
        await check(ic.stats.give >= 1 && ic.stats.hold_le_tan >= 1 && ic.stats.tap >= 2 && !ic.visible,
          `zone 3 → 4: thẻ nhân viên — lễ tân cầm thẻ đưa (${ic.stats.give}), quẹt thẻ cửa kính + cửa văn phòng (${ic.stats.tap}), đã cất`, JSON.stringify(ic));
      }
      if (failed || onlyZone && !st.complete) break;
      if (st.complete) {
        // ---------- màn tổng kết ----------
        const open = await wait(() => window.__game?.summary.open, 15000);
        const s = await ev(() => ({ text: __game.summary.text || "", zone: __game.zone, seen: !!JSON.parse(localStorage.getItem("fville.save.v1") || "{}").flags?.includes("summary_seen") }));
        let dl;
        try {
          const [d] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click("#summary [data-a=download]")]);
          dl = { name: d.suggestedFilename(), size: statSync(await d.path()).size };
        } catch (e) {
          dl = { error: e.message.split("\n")[0] };
          // trang còn chạy hẹn giờ / khung hình không (hẹn giờ phía Node: luồng chính của trang có thể đang bị chặn). Máy CI
          // từng kẹt ở đây khi canvas thẻ còn vẽ bằng GPU: toBlob chờ GPU (phần mềm) vẽ xong hàng đợi, quá 20 s
          const probe = (fn) => Promise.race([ev(fn), new Promise((r) => setTimeout(() => r("quá 3 s"), 3000))]).catch((x) => String(x));
          dl.page = { vis: await ev(() => [document.visibilityState, document.hasFocus()]),
            timer: await probe(() => new Promise((r) => { const t0 = performance.now(); setTimeout(() => r(Math.round(performance.now() - t0)), 0); })),
            raf: await probe(() => new Promise((r) => { const t0 = performance.now(); requestAnimationFrame(() => r(Math.round(performance.now() - t0))); })) };
        }
        // thời gian từng khâu (phông, ảnh, vẽ, png) — quá hạn thì thấy khâu đang kẹt
        dl.game = await ev(() => __game._game.ui.summary.lastDownload ?? null).catch(() => null);
        const took = dl.game?.ms ? Object.values(dl.game.ms).reduce((a, b) => a + b, 0) : null;
        // chậm (> 2 s): in từng khâu + thời gian 1 khung hình lúc đó (máy CI: lượt 2 từng mất 11,8 s, lượt 1 chỉ 1,7 s)
        let slow = "";
        if (took > 2000) {
          const frame = await ev(() => new Promise((r) => { const t0 = performance.now(); let n = 0; const f = () => (++n < 10 ? requestAnimationFrame(f) : r(Math.round((performance.now() - t0) / 10))); requestAnimationFrame(f); })).catch(() => null);
          slow = `: ${Object.entries(dl.game.ms).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}`).join(" · ")}; khung hình ${frame} ms`;
        }
        const how = took != null ? `${(took / 1000).toFixed(1)} s${slow}` : "";
        await check(open && s.text.includes(ACH[lang]) && s.zone === "zone_01" && s.seen && dl.name === `fville-first-day-${slug}.png` && dl.size > 50000,
          `màn tổng kết: thành tựu, summary_seen, ảnh thẻ ${dl.name || "?"} (${Math.round((dl.size || 0) / 1024)} KB${how ? `, ${how}` : ""})`, JSON.stringify({ open, zone: s.zone, seen: s.seen, dl }));
        await page.click("#summary [data-a=close]");
        await page.keyboard.press("Escape");
        const menu = await wait(() => !document.getElementById("menu").hidden && !!document.querySelector("#menu [data-act=summary]"), 5000);
        if (menu) await page.click("#menu [data-act=summary]");
        const again = await wait(() => window.__game?.summary.open, 5000);
        await page.keyboard.press("Escape");
        const closed = await wait(() => !window.__game?.summary.open, 5000);
        const con2 = problems.splice(0);
        await check(menu && again && closed && !con2.length, "màn tổng kết: Close → menu Esc → View summary mở lại, console sạch", JSON.stringify({ menu, again, closed, console: con2.slice(0, 5) }));
        // tủ đồ (ui/wardrobe.js): phím I (menu Esc không còn nút Tủ đồ) → bảng (camera ra trước mặt) → đội mũ lưỡi trai (xong game mới mở khoá):
        // mũ gắn xương đầu, vòm trên đỉnh đầu (không lún, không bay), vào bản lưu → mặc lại Đồ ngày đầu (texture + morph về 0,
        // bản lưu player.outfit) → phím I đóng, nút 👕 hiện → bấm nút mở lại → phím 2 = Áo Cam FPT → Esc đóng
        const mbtn = await wait(() => window.__game?._game.mode === "play" && document.getElementById("menu").hidden && !document.querySelector("#menu [data-act=wardrobe]"), 5000);
        if (mbtn) await page.keyboard.press("KeyI");
        const wopen = await wait(() => window.__game?.wardrobe.open && window.__game._game.mode === "wardrobe", 5000);
        const capItem = "#wardrobe .item[data-kind=acc][data-id=cap]:not([disabled])";
        if (wopen && await ev((sel) => !!document.querySelector(sel), capItem)) await clickShown(capItem);
        const worn = await wait(() => window.__game?.model.accessories.includes("cap"), 15000);
        if (worn) await settle();
        const cap = worn ? await ev(() => { const i = __game.accessoryInfo("cap"), c = __game._game.player.character;
          const root = c.root.position.y, f = i.fit;
          return { ...i, headTop: +(root + f.top).toFixed(3), saved: JSON.parse(localStorage.getItem("fville.save.v1") || "{}").player?.accessories }; }) : null;
        if (wopen) await clickShown("#wardrobe .item[data-kind=outfit][data-id=dau_ngay]");
        const day1 = await wait(() => window.__game?.model.outfit === "dau_ngay", 15000);
        if (day1) await settle();
        const d1 = await ev(() => ({ morph: __game.model.morph, saved: JSON.parse(localStorage.getItem("fville.save.v1") || "{}").player?.outfit,
          badge: !!document.querySelector("#wardrobe .item.on[data-id=dau_ngay]"), preview: __game.wardrobe.preview,
          thumbs: __game.wardrobe.items.filter((x) => x.kind === "outfit").every((x) => /portrait/.test(x.img || "")) }));
        // rê chuột vào Áo Cam (chưa mặc) → khung xem trước đổi sang chân dung mặc Áo Cam, chưa thay áo
        await clickShown("#wardrobe .item[data-kind=outfit][data-id=ao_cam]", { hover: true });
        const pv = await wait(() => window.__game?.wardrobe.preview?.item === "ao_cam" && window.__game.model.outfit === "dau_ngay", 3000)
          && await ev(() => __game.wardrobe.preview.img);
        await page.keyboard.press("KeyI");
        const shut = await wait(() => !window.__game?.wardrobe.open && window.__game._game.mode === "play", 5000);
        const btn = shut && await wait(() => { window.__game._game.ui.wardrobe.update(); return window.__game.wardrobe.button; }, 5000);
        if (btn) await clickShown("#wardrobe-btn");
        const reopen = await wait(() => window.__game?.wardrobe.open, 5000);
        await page.keyboard.press("Digit2");
        const orange = await wait(() => window.__game?.model.outfit === null && window.__game.wardrobe.outfit === "ao_cam", 5000);
        await page.keyboard.press("Escape");
        const done = await wait(() => !window.__game?.wardrobe.open && window.__game._game.mode === "play", 5000);
        const con3 = problems.splice(0);
        const morphOk = !("ao_cam" in (d1.morph || {})) || d1.morph.ao_cam === 0;
        await check(mbtn && wopen && worn && /Head$/.test(cap?.bone || "") && cap.top > cap.headTop && cap.top < cap.headTop + 0.15 && cap.bottom < cap.headTop - 0.05
          && cap.fit.scale > 0.8 && cap.fit.scale < 2 && cap.saved?.includes("cap") && day1 && morphOk && d1.saved === "dau_ngay" && d1.badge
          && /portrait_dau_ngay/.test(d1.preview?.img || "") && d1.thumbs && /portrait\.png/.test(pv || "") && shut && btn && reopen && orange && done && !con3.length,
          `tủ đồ: phím I → đội mũ (xương ${cap?.bone}, tỉ lệ ${cap?.fit?.scale}, vòm cao hơn đỉnh đầu ${cap ? Math.round((cap.top - cap.headTop) * 100) : "?"} cm), mặc lại Đồ ngày đầu${"ao_cam" in (d1.morph || {}) ? ` (morph ${d1.morph.ao_cam})` : ""}, lưu, ảnh xem trước theo bộ (rê chuột → Áo Cam, chưa thay); I đóng → nút 👕 mở → phím 2 Áo Cam → Esc`,
          JSON.stringify({ mbtn, wopen, worn, cap, day1, d1, pv, shut, btn, reopen, orange, done, console: con3.slice(0, 5) }));
        // đã xong ngày đầu → menu Esc có mục "Đi tới" (6 zone, zone đang đứng khoá nút): bấm zone_02 → sang zone_02, về chế độ
        // chơi, không tự mở hội thoại / cảnh chuyển; rồi __game.travel về zone đã đứng; console sạch
        {
          const from = await ev(() => __game.state.zone);
          await page.keyboard.press("Escape");
          const tv = { menu: await wait(() => !document.getElementById("menu").hidden && !!document.querySelector("#menu [data-zone]"), 5000) };
          tv.list = await ev(() => [...document.querySelectorAll("#menu [data-zone]")].map((b) => [b.dataset.zone, b.disabled]));
          const to = from === "zone_02" ? "zone_03" : "zone_02";
          if (tv.menu) await page.click(`#menu [data-zone=${to}]`);
          tv.arrived = await wait((z) => window.__game?.state.zone === z && __game.state.phase === "playing", 30000, to);
          await page.waitForTimeout(1200);
          tv.after = await ev(() => ({ mode: __game._game.mode, dlg: __game._game.runner.active?.id ?? null, cut: !!__game._game.cutscene, menu: !document.getElementById("menu").hidden }));
          tv.back = await ev((z) => __game.travel(z), from);
          tv.zone = await ev(() => __game.state.zone);
          const con4 = problems.splice(0);
          await check(tv.menu && tv.list.length === order.length && tv.list.filter(([, d]) => d).map(([z]) => z).join() === from && tv.arrived
            && tv.after.mode === "play" && !tv.after.dlg && !tv.after.cut && !tv.after.menu && tv.back && tv.zone === from && !con4.length,
            `xong ngày đầu → menu Esc "Đi tới": ${tv.list.length} zone (đang ở ${from}), bấm ${to} → sang ${to}, chơi tiếp (không hội thoại / cảnh chuyển), về lại ${from}`,
            JSON.stringify({ ...tv, console: con4.slice(0, 5) }));
        }
        // tải lại trang (không ?lang): ngôn ngữ đã chọn ở màn tạo nhân vật nằm trong cài đặt → vẫn tiếng Việt
        if (lang !== "en") {
          await page.goto(`${base}/?debug&net=off&title=off`);
          const back = await wait(() => window.__game?.state.phase === "playing", 120000);
          const r = await ev(() => ({ lang: document.documentElement.lang, title: document.title, objective: window.__game?.objective }));
          await check(back && r.lang === lang && r.title === I18N[lang].app.title && r.objective === I18N[lang].hud.objective_complete && !problems.splice(0).length,
            `tải lại trang → vẫn ${I18N[lang].lang[lang]}: "${r.title}", "${r.objective}"`, JSON.stringify(r));
        }
        break;
      }
    }
  } catch (e) {
    const diagnostic = await ev(() => {
      const g = window.__game?._game;
      return { mode: g?.mode, wardrobeHidden: document.getElementById("wardrobe")?.hidden,
        menuHidden: document.getElementById("menu")?.hidden, input: g?.input && { fakeLock: g.input.fakeLock, lookActive: g.input.lookActive, hasUnlock: !!g.input.onUnlock } };
    }).catch(() => null);
    await check(false, `lỗi script: ${e.message}`, JSON.stringify(diagnostic));
  } finally {
    await ctx.close();
  }
}

// ---------- thêm: lỗi kẹt zone 4 trên trang thật (10/10/2026) ----------
// Trang thật kẹt mãi ở "Heading to Card Gate · FSA Room…", tải lại vẫn kẹt: cài đặt đồ hoạ High (tự chọn trên máy có card
// rời) tải GLB bản Cao cũ thiếu SPAWN_zone_04_from_zone_03 → lỗi bị nuốt, màn tải đứng yên; bản lưu đã ở zone_04 nên lần
// khởi động sau lỗi lại. Hai test dưới đặt sẵn cài đặt cũ tier "high" (bản Cao đã tắt → phải chạy bản Thấp).
const INIT_ONCE = (f) => {   // nạp bản lưu + cài đặt 1 lần cho mỗi tab (tải lại trang giữ bản lưu game đã ghi)
  if (sessionStorage.getItem("smoke.init")) return;
  sessionStorage.setItem("smoke.init", "1");
  localStorage.setItem("fville.settings", JSON.stringify(f.settings));
  localStorage.setItem("fville.save.v1", JSON.stringify(f.save));
};
async function openPage(browser, label, init) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  if (init) await ctx.addInitScript(INIT_ONCE, init);
  const page = await ctx.newPage();
  const problems = watch(page);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = async (fn, ms, a) => { try { await page.waitForFunction(fn, a, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
  const check = async (ok, text, extra = "") => {
    results.push({ look: label, ok, text });
    line(ok, `${label} · ${text}${extra && (verbose || !ok) ? ` — ${extra}` : ""}`);
    if (!ok) {
      mkdirSync(OUT, { recursive: true });
      const f = join(OUT, `${label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\W+/g, "_")}-${++shots}.png`);
      await page.screenshot({ path: f }).catch(() => {});
      console.log(`    ảnh: ${f.replace(ROOT + "/", "")}`);
    }
    return ok;
  };
  return { ctx, page, problems, ev, wait, check };
}
// trạng thái sau khi vào zone: zone, bản đồ hoạ đang chạy, cài đặt, màn lỗi zone (Retry / Back) có hiện không
const zoneState = () => ({ zone: __game.zone, phase: __game.state.phase, tier: __game.state.tier, setting: __game.state.setting,
  zoneError: document.getElementById("loading").classList.contains("error") ? document.querySelector("#loading .zone-error")?.textContent : null });

// (b) bản lưu cũ lệch data (scripts/tests/fixtures/old_save.json, ẩn danh): zone tên cũ, quest / phần thưởng / vật / giá trị /
// hạt lúa / lời khuyên không còn, ngoại hình cũ, giới tính "male", vị trí cũ + cài đặt tier high → sửa 1 lần, vào zone_04;
// tải lại trang → vào thẳng zone_04, không còn gì để sửa
async function runOldSave(browser, base) {
  const fx = JSON.parse(readFileSync(join(ROOT, "scripts", "tests", "fixtures", "old_save.json"), "utf8"));
  const { ctx, page, problems, ev, wait, check } = await openPage(browser, "bản lưu cũ", { settings: fx.settings, save: fx.save });
  const repairs = () => { const i = problems.findIndex((p) => p.includes("[bản lưu] đã sửa")); return i < 0 ? null : problems.splice(i, 1)[0]; };
  try {
    const t1 = Date.now();
    await page.goto(`${base}/?debug&net=off&title=off`);
    const ok1 = await wait(() => window.__game?.state.phase === "playing", 120000);
    const s1 = await ev(zoneState);
    const fixed = repairs();
    const sv = await ev(() => JSON.parse(localStorage.getItem("fville.save.v1") || "{}"));
    const con1 = problems.splice(0);
    await check(ok1 && s1.zone === "zone_04" && s1.tier === "low" && !s1.zoneError && /zone: zone_04_corridor → zone_04/.test(fixed || "")
      && sv.zone === "zone_04" && sv.player?.gender === "nam" && sv.player?.look === null && !sv.quests.includes("z3_viec_cu_da_bo") && !con1.length,
    `nạp bản lưu cũ (tier high, zone_04_corridor, mục cũ) → sửa ${fixed?.match(/sửa (\d+)/)?.[1] ?? "?"} chỗ, vào zone_04 bản Thấp, console sạch (${Math.round((Date.now() - t1) / 1000)} s)`,
    JSON.stringify({ ok1, ...s1, fixed, save: { zone: sv.zone, player: sv.player }, console: con1.slice(0, 5) }));
    const t2 = Date.now();
    await page.reload();
    const ok2 = await wait(() => window.__game?.state.phase === "playing", 120000);
    const s2 = await ev(zoneState);
    const again = repairs(), con2 = problems.splice(0);
    await check(ok2 && s2.zone === "zone_04" && s2.tier === "low" && !s2.zoneError && !again && !con2.length,
      `tải lại trang → vào thẳng zone_04, không còn gì để sửa, console sạch (${Math.round((Date.now() - t2) / 1000)} s)`, JSON.stringify({ ok2, ...s2, again, console: con2.slice(0, 5) }));
    // tải zone lỗi (GLB không có) → bảng lỗi trên màn chờ + console.error, không treo; bấm chuột "Back to …" → về zone_04
    const r3 = await ev(() => __game._game.enterZone("zone_05", "SPAWN_zone_05_from_zone_04", { file: "khong_co_file" }));
    const shown = await ev(() => { const b = document.querySelector("#loading .zone-error"); return b && !document.getElementById("loading").hidden
      ? { title: document.querySelector("#loading .text").textContent, buttons: [...b.querySelectorAll("button")].map((x) => x.textContent) } : null; });
    const logged = problems.some((p) => p.includes("[zone] không vào được zone_05"));
    if (shown) await page.click("#loading .zone-error button[data-a=back]");
    const ok3 = await wait(() => window.__game?.zone === "zone_04" && window.__game.state.phase === "playing" && document.getElementById("loading").hidden, 20000);
    const con3 = problems.splice(0).filter((p) => !/không vào được zone_05|khong_co_file|Failed to load resource/.test(p));
    await check(r3 === false && shown?.buttons.length === 2 && /^Couldn't open/.test(shown.title) && logged && ok3 && !con3.length,
      `zone lỗi (GLB hỏng) → bảng lỗi "${shown?.title}" [${shown?.buttons.join(" | ")}], console.error; bấm Back → zone_04`, JSON.stringify({ r3, shown, logged, ok3, console: con3.slice(0, 5) }));
    // bộ nhớ GPU không tăng dần khi đổi zone: zone_04 ↔ zone_05 (7 nhân vật, bàn bi-a, hạt lúa, bảng tên) 2 vòng, số geometry /
    // texture sau vòng 2 = sau vòng 1 (vòng 1 còn nạp mô hình NPC vào bộ nhớ đệm). Trước đây mỗi vòng đọng thêm: vật do code đặt,
    // đường ngắm bàn bi-a, texture xương của nhân vật
    const mem = await ev(async () => {
      const g = __game._game, r = g.renderer.three, at = () => { g.render(1 / 30); return { geo: r.info.memory.geometries, tex: r.info.memory.textures }; };
      const round = async () => { for (const z of ["zone_05", "zone_04"]) { await __game.goto(z); for (let i = 0; i < 3; i++) g.update(1 / 30); } return at(); };
      const start = at(), a = await round(), b = await round();
      return { start, a, b };
    });
    const con4 = problems.splice(0);
    await check(mem.b.geo === mem.a.geo && mem.b.tex === mem.a.tex && !con4.length,
      `bộ nhớ GPU: zone_04 ↔ zone_05 2 vòng → geometry ${mem.a.geo} → ${mem.b.geo}, texture ${mem.a.tex} → ${mem.b.tex} (không tăng), console sạch`, JSON.stringify({ ...mem, console: con4.slice(0, 5) }));
  } catch (e) {
    await check(false, `lỗi script: ${e.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

// máy chủ chơi nhiều người local (server/, wrangler dev — không cần tài khoản Cloudflare) trên cổng trống
// vars: biến môi trường của Worker (vd { POOL_RULES: "1" } = giả máy chủ bản cũ: luật bi-a rút gọn, không báo "pool_rules2") —
// chạy với kho dữ liệu riêng (--persist-to thư mục tạm), không đụng kho của máy chủ chính
async function startNetServer(vars = null) {
  const wr = join(ROOT, "server", "node_modules", "wrangler", "bin", "wrangler.js");
  if (!existsSync(wr)) return { skip: "chưa cài máy chủ local (npm --prefix server ci)" };
  const port = await freePort(), inspector = await freePort();
  const win = process.platform === "win32";
  const more = vars ? [...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`]), "--persist-to", mkdtempSync(join(tmpdir(), "fville-wr-"))] : [];
  const proc = spawn(process.execPath, [wr, "dev", "--port", String(port), "--ip", "127.0.0.1", "--inspector-port", String(inspector), ...more],
    { cwd: join(ROOT, "server"), env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" }, stdio: ["ignore", "pipe", "pipe"], detached: !win });
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  // wrangler chạy workerd ở tiến trình con → dừng cả cây tiến trình
  const stop = () => { try { if (win) spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(-proc.pid, "SIGTERM"); } catch { /* đã dừng */ } };
  for (let i = 0; i < 450; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/`); if ((await r.text()).includes("F-Ville net: OK")) return { url: `ws://127.0.0.1:${port}/ws`, stop }; } catch { /* chưa lên */ }
    if (proc.exitCode != null) break;
    await sleep(200);
  }
  stop();
  return { error: `không bật được wrangler dev:\n${log.slice(-1500)}` };
}

// 1 người chơi giả (WebSocket có sẵn trong Node 22+) đứng chờ trong zone
function startBot(url, zone) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const bot = { zone, pos: [0, 0, 0] };
    const send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    bot.moveTo = (pos) => { bot.pos = pos; send({ t: "state", zone, pos, yaw: 0, anim: "idle" }); };
    bot.close = () => { clearInterval(bot.timer); send({ t: "leave" }); try { ws.close(1000); } catch { /* đã đóng */ } };
    ws.onopen = () => {
      send({ t: "join", name: "Bot Zone Four", model: "intern_nu", outfit: "ao_cam", acc: ["cap"], zone });
      bot.moveTo(bot.pos);
      bot.timer = setInterval(() => send({ t: "ping" }), 10000);
      resolve(bot);
    };
    ws.onerror = () => reject(new Error(`bot: không kết nối được ${url}`));
  });
}

// (a) vào zone 4 khi có người chơi khác: máy chủ local + bot chờ sẵn ở zone_04; cài đặt cũ tier high. Khởi động thẳng vào
// zone_04 (?start), rồi sang zone_03 và đi qua cổng → zone_04 lần nữa (đúng đường người chơi kẹt). Zone phải vào được
// trong 20 s (đồng hồ của game), người chơi khác hiện sau khi zone xong
async function runNetZone4(browser, base, srv) {
  const label = "mạng + zone 4";
  let bot = null, ctx = null;
  try {
    bot = await startBot(srv.url, "zone_04");
    const save = { v: 1, created: true, player: { name: "Net Test", position: "developer", gender: "nam", look: "intern_nam" } };
    const p = await openPage(browser, label, { settings: { tier: "high", detail: "auto" }, save });
    ctx = p.ctx;
    const { page, problems, ev, wait, check } = p;
    const remote = async (ms) => {
      const pos = await ev(() => __game.player.pos);
      bot.moveTo([pos[0] + 1.5, pos[1], pos[2]]);
      const seen = await wait(() => (__game.net?.remotes || []).some((r) => r.name === "Bot Zone Four" && r.built && r.visible && r.acc?.includes("cap")), ms);
      return { seen, net: await ev(() => { const n = __game.net; return { status: n.status, connected: n.connected, online: n.online, remotes: n.remotes.map((r) => [r.name, r.built, r.visible, r.acc]) }; }) };
    };
    const t1 = Date.now();
    await page.goto(`${base}/?debug&net=${encodeURIComponent(srv.url)}&title=off&start=zone_04`);
    const ok1 = await wait(() => window.__game?.state.phase === "playing", 120000);
    const s1 = await ev(zoneState), sec1 = Math.round((Date.now() - t1) / 1000);
    const conn = await wait(() => window.__game?.net?.connected, 20000);
    const r1 = conn ? await remote(30000) : { seen: false };
    const con1 = problems.splice(0);
    await check(ok1 && s1.zone === "zone_04" && s1.tier === "low" && !s1.zoneError && conn && r1.seen && !con1.length,
      `khởi động vào zone_04 (tier high, máy chủ local, bot chờ sẵn) → bản Thấp, ${sec1} s, thấy bot (đội mũ lưỡi trai), console sạch`, JSON.stringify({ ok1, ...s1, conn, ...r1, console: con1.slice(0, 5) }));
    // sang zone_03 rồi đi qua cổng như người chơi (step: tới vùng chuyển zone)
    await ev(() => __game.goto("zone_03"));
    const g = await ev(() => __game._game.guide.current().key);
    const t2 = Date.now();
    const st = await ev(() => __game.step());
    const ok2 = await wait(() => window.__game?.zone === "zone_04" && window.__game.state.phase === "playing", 25000);
    const s2 = await ev(zoneState), sec2 = Math.round((Date.now() - t2) / 1000);
    const r2 = await remote(30000);
    const con2 = problems.splice(0);
    await check(ok2 && s2.tier === "low" && !s2.zoneError && sec2 <= 20 && r2.seen && !con2.length,
      `zone_03 → cổng (${g}) → zone_04 trong ${sec2} s, thấy lại bot, console sạch`, JSON.stringify({ ok2, ...s2, step: { ok: st.ok, why: st.why, goal: st.goal }, ...r2, console: con2.slice(0, 5) }));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally {
    bot?.close();
    await ctx?.close();
  }
}

// trang bi-a cho test mạng: mở zone_05 với máy chủ url, chờ kết nối + bàn chung; tắt Pointer Lock như runLook (headless: khoá /
// nhả chồng nhau → main.js tưởng người chơi bấm Esc → rời bàn)
async function poolPage(browser, base, url, label, name, look, gender) {
  const save = { v: 1, created: true, player: { name, position: "developer", gender, look } };
  const p = await openPage(browser, `${label} · ${name}`, { settings: { tier: "low", detail: "auto" }, save });
  await p.page.goto(`${base}/?debug&net=${encodeURIComponent(url)}&title=off&start=zone_05`);
  p.ready = await p.wait(() => window.__game?.state.phase === "playing" && window.__game.net?.connected && !!window.__game.pool?.net?.on, 120000);
  await p.ev(() => { const i = __game._game.input; i.lockSupported = false; if (document.pointerLockElement) { i._releasing = true; document.exitPointerLock(); } });
  return p;
}
const poolNet = (p) => p.ev(() => ({ ...__game.pool.net, phase: __game.pool.phase }));
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// mọi trang thấy cú số q xong (bi dừng)
const poolSettle = (list, q, ms = 20000) => Promise.all(list.map((p) => p.wait((x) => __game.pool.net.seq === x && !__game.pool.rolling, ms, q)));
// toast đang hiện + đang chờ (debug.js → toasts)
const toastsOf = (p) => p.ev(() => { const t = __game.toasts; return [t.now, ...t.queued]; });
// máy chủ nhận tối đa 10 tin / giây mỗi kết nối (data/net.json → server.max_msgs_per_s) và bỏ im lặng tin vượt mức. Người chơi
// thật không đánh nhanh vậy, vòng tự đánh thì có: An từng gửi 7 cú + tin vị trí trong 1 giây → CI có lúc vượt 10, pool_shot bị
// bỏ, bàn đứng (đã đo). Giữ mỗi trình duyệt cách nhau ≥ 0,4 s giữa 2 cú (≤ 2,5 cú / giây + tin vị trí ≤ 5 / giây)
const SHOT_GAP_MS = 400;
const shotAt = new WeakMap();
async function poolPace(p) {
  const wait = (shotAt.get(p) || 0) + SHOT_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  shotAt.set(p, Date.now());
}

// (c) bi-a 2 người (bi-a bước 3 + luật chuẩn 8 bi "sọc trơn") trên máy chủ local: An, Bình mở zone_05 ở 2 trình duyệt, máy
// chủ báo features "pool" + "pool_rules2" + "pool_facts" (máy chủ không chạy vật lý). An ngồi → tập một mình, cú của An phát lại (có hoạt cảnh) ở máy Bình; Bình ngồi →
// ván 8 bi, An phá; Bình đánh sai lượt → máy chủ chặn; phím H: thẻ luật, đồng hồ lượt. Luật chuẩn: An phá nhẹ (không hợp lệ)
// → Bình chọn, phím R: xếp lại và tự phá; Bình phá nhẹ → An bấm P: đánh tiếp; An không chạm bi nào → lỗi (toast + dòng lỗi
// nêu lý do), Bình có bi trong tay cả bàn (đặt giữa bàn). Chơi trọn ván bằng cú tự chọn (__game.pool.autoShot, tự gọi lỗ cho
// bi 8; lần đầu đánh bi 8: vòng sáng ở lỗ, C gọi lỗ) — sau mỗi cú bàn của 2 người (và người xem) giống hệt bàn máy chủ, cú
// phát lại khớp từng bit; Cường vào xem giữa ván → thấy đúng bàn, hết ghế thì chỉ xem; hết ván → R: ván mới, người thua
// phá; Bình rớt mạng → ghế được giải phóng, An thắng; máy khách cũ (pool_join không kèm r: 2) và bản web luật chuẩn đầu
// (r: 2, chưa gửi sự kiện cú cf: 1) không được ngồi; Cường ngồi
// vào ghế trống; An phá thẳng bi trắng vào lỗ → Cường có bi trong tay chỉ ở khu đầu bàn; máy chủ cũ (không báo "pool") →
// bàn chỉ tập một mình
async function runPoolNet(browser, base, srv) {
  const label = "bi-a 2 người";
  const L = I18N.en.pool;
  const pages = [];
  const open = async (name, look, gender) => { const p = await poolPage(browser, base, srv.url, label, name, look, gender); pages.push(p); return p; };
  const net = poolNet, same = sameJson;
  try {
    const t1 = Date.now();
    const [A, B] = await Promise.all([open("An", "intern_nam", "nam"), open("Bình", "intern_nu", "nu")]);
    const check = A.check;
    const [a0, b0] = await Promise.all([net(A), net(B)]);
    const f0 = await A.ev(() => __game.net.features);
    await check(A.ready && B.ready && ["pool", "pool_rules2", "pool_facts", "pool_spin"].every((f) => f0.includes(f)) && a0.mode === "idle" && same(a0.server, b0.server) && !A.problems.length && !B.problems.length,
      `2 trình duyệt vào zone_05, máy chủ báo features "pool" + "pool_rules2" + "pool_facts" + "pool_spin", cùng một bàn (${Math.round((Date.now() - t1) / 1000)} s)`,
      JSON.stringify({ ready: [A.ready, B.ready], f0, a0: a0.mode, console: [...A.problems, ...B.problems].slice(0, 5) }));
    // An ngồi → tập một mình; cú của An phát lại ở máy Bình (có hoạt cảnh)
    await A.ev(() => __game.pool.enter());
    const solo = await A.wait(() => { const n = __game.pool.net; return n.seat === 0 && n.mode === "solo" && __game.pool.phase === "aim"; }, 10000);
    const seq0 = (await net(A)).seq;
    await A.ev(() => __game.pool.autoShot());
    const rolled = await B.wait(() => __game.pool.rolling, 10000);
    // máy Bình phát lại theo thời gian thực, mỗi khung tối đa 0,1 s: lần chạy đầu (Vite còn biên dịch) khung hình thấp → cú phá
    // ~8 s có lúc quá 20 s (từng hỏng ngẫu nhiên) → chờ 40 s
    const synced = await poolSettle([A, B], seq0 + 1, 40000);
    const [a1, b1] = await Promise.all([net(A), net(B)]);
    await check(solo && rolled && synced.every(Boolean) && b1.replays === 1 && b1.mismatch === 0 && same(a1.shown, b1.shown)
      && same(b1.shown, b1.server) && b1.seats.join() === "An,",
      "An ngồi → tập một mình; cú của An phát lại ở máy Bình (bi lăn rồi dừng), 2 bàn khớp bàn máy chủ",
      JSON.stringify({ solo, rolled, synced, a1: { seat: a1.seat, mode: a1.mode }, b1: { replays: b1.replays, mismatch: b1.mismatch, seats: b1.seats } }));
    // xoáy ở bàn chung (máy chủ "pool_spin", bàn spin: true): An chọn điểm chạm phải 2 / kéo 1 (X X F… qua setSpin + phím), đánh →
    // tin gửi kèm spin / roll, máy Bình phát lại đúng cú có xoáy, khớp bàn máy chủ; Bình (đang xem) không có ô chọn
    const aSp0 = await A.ev(() => __game.pool.spin);
    const bSp0 = await B.ev(() => __game.pool.spin);
    await A.ev(() => __game.pool.setSpin(2, 0));
    await A.page.keyboard.press("KeyB");
    const aSp1 = await A.ev(() => __game.pool.spin);
    await poolPace(A);
    const seqS = (await net(A)).seq;
    await A.ev(() => __game.pool.shoot(Math.PI / 2 - 0.2, 0.55));
    const syncedS = await poolSettle([A, B], seqS + 1, 40000);
    const [aS1, bS1, bSp1, aSp2] = await Promise.all([net(A), net(B), B.ev(() => __game.pool.spin), A.ev(() => __game.pool.spin)]);
    await check(aSp0.on && aSp0.shown && !bSp0.shown && aS1.spin === true && aSp1.spin === 2 && aSp1.roll === -1 && syncedS.every(Boolean)
      && bS1.replays === 2 && bS1.mismatch === 0 && same(bS1.shown, bS1.server) && same(aS1.shown, bS1.shown)
      && bSp1.last?.spin === 2 && bSp1.last?.roll === -1 && !bSp1.last.own && aSp2.spin === 0 && aSp2.roll === 0,
      `bàn chung có xoáy: An chọn "${aSp1.text}" (ô chọn chỉ hiện ở người tới lượt), cú phát lại ở máy Bình đúng spin / roll, 2 bàn khớp bàn máy chủ; chấm về giữa`,
      JSON.stringify({ aSp0, bSp0: { shown: bSp0.shown }, aSp1, tbSpin: aS1.spin, syncedS, b: { replays: bS1.replays, mismatch: bS1.mismatch, last: bSp1.last }, aSp2 }));
    // Bình ngồi → ván 8 bi (luật chuẩn), An (ngồi trước) phá
    await Promise.all([A, B].map((p) => p.ev(() => __game.pool.setFast(true))));
    await B.ev(() => __game.pool.enter());
    const started = await Promise.all([A, B].map((p) => p.wait(() => { const n = __game.pool.net; return n.mode === "match" && n.turn === 0 && n.seats.join() === "An,Bình" && n.log.some((l) => l.k === "start"); }, 10000)));
    const [aS, bS] = await Promise.all([net(A), net(B)]);
    const rack0 = aS.server;
    await check(started.every(Boolean) && aS.phase === "aim" && bS.phase === "watch" && aS.rules === 2 && aS.rules2 && bS.rules2 && aS.brk,
      "Bình ngồi → ván 8 bi luật chuẩn, xếp lại bi, An (ngồi trước) phá; Bình chờ lượt", JSON.stringify({ started, phases: [aS.phase, bS.phase], rules: [aS.rules, bS.rules] }));
    // Bình đánh khi chưa tới lượt: giao diện không cho; gửi thẳng → máy chủ chặn
    const seqM = aS.seq;
    const ui = await B.ev(() => __game.pool.autoShot());
    await B.ev(() => __game.pool.forceShot(Math.PI / 2, 0.8));
    const blocked = await B.wait(() => __game.pool.net.log.some((l) => l.err === "turn"), 5000);
    // nấc xoáy ngoài giới hạn (đúng lượt): máy chủ bỏ cú (err bad)
    await poolPace(A);
    await A.ev(() => __game.pool.forceShot(Math.PI / 2, 0.8, { spin: 3, roll: 0 }));
    const badSpin = await A.wait(() => __game.pool.net.log.some((l) => l.err === "bad"), 5000);
    const aNow = await net(A);
    await check(ui === null && blocked && badSpin && aNow.seq === seqM && aNow.turn === 0, "chặn cú sai lượt: giao diện không cho đánh, gửi thẳng → máy chủ từ chối, bàn không đổi; nấc xoáy ngoài −2 … +2 → máy chủ bỏ cú",
      JSON.stringify({ ui, blocked, badSpin, seq: [seqM, aNow.seq] }));
    // phím H: thẻ tóm tắt luật (6 dòng), bấm lại thì ẩn; đồng hồ lượt trên bảng
    await A.page.keyboard.press("KeyH");
    const rules = await A.ev(() => ({ open: __game.pool.net.rulesOpen, n: document.querySelectorAll("#pool-hud .rules p").length, text: document.querySelector("#pool-hud .rules")?.textContent || "" }));
    await A.page.keyboard.press("KeyH");
    const rulesOff = await A.ev(() => !__game.pool.net.rulesOpen && !document.querySelector("#pool-hud .rules"));
    const clock = (await net(A)).clock;
    await check(rules.open && rules.n === 7 && rules.text.includes(L.rules_title) && rules.text.includes(L.rules_break) && rules.text.includes(L.rules_spin) && rulesOff && /^⏱ \d+$/.test(clock || ""),
      `phím H: thẻ tóm tắt luật (${rules.n} dòng), bấm lại thì ẩn; đồng hồ lượt trên bảng (${clock})`, JSON.stringify({ rules: { ...rules, text: rules.text.slice(0, 80) }, rulesOff, clock }));
    // cú phá không hợp lệ: An đánh rất nhẹ (không bi vào, < 4 bi chạm băng) → Bình chọn; chưa chọn thì không đánh được; phím R →
    // xếp lại bi, Bình phá
    let q = (await net(A)).seq;
    await A.ev(() => __game.pool.shoot(Math.PI / 2, 0.05, { instant: true }));
    await poolSettle([A, B], q + 1);
    const [aC, bC] = await Promise.all([A, B].map((p) => p.ev(() => ({ ...__game.pool.net, phase: __game.pool.phase,
      btn: [...document.querySelectorAll("#pool-hud [data-a]")].map((b) => b.dataset.a) }))));
    const bToasts = await toastsOf(B);
    const noShot = await B.ev(() => __game.pool.autoShot());
    await B.page.keyboard.press("KeyR");
    const rr = await Promise.all([A, B].map((p) => p.wait((r) => { const n = __game.pool.net; return n.log.some((l) => l.k === "choice" && l.c === "rerack") && n.brk && n.turn === 1 && n.choice === null && JSON.stringify(n.server) === r; }, 10000, JSON.stringify(rack0))));
    const bAim = await B.wait(() => __game.pool.phase === "aim", 5000);
    await check(bC.phase === "choice" && bC.choice === "break" && bC.turn === 1 && bC.status === L.net_status_choice && bC.btn.includes("play") && bC.btn.includes("rerack")
      && aC.phase === "watch" && aC.status === L.net_status_choosing.replace("{name}", "Bình") && [aC, bC].every((x) => x.log.some((l) => l.brk === "illegal"))
      && bToasts.includes(L.net_break_illegal) && noShot === null && rr.every(Boolean) && bAim,
      "phá không hợp lệ → Bình chọn (nút + toast, chưa đánh được); phím R → xếp lại bi, Bình phá",
      JSON.stringify({ b: { phase: bC.phase, choice: bC.choice, status: bC.status, btn: bC.btn }, a: { phase: aC.phase, status: aC.status }, bToasts, noShot, rr, bAim }));
    // Bình phá cũng không hợp lệ → An bấm P: đánh tiếp từ thế bi đó (bàn giữ nguyên, hết cú phá)
    q = (await net(B)).seq;
    await B.ev(() => __game.pool.shoot(Math.PI / 2, 0.05, { instant: true }));
    await poolSettle([A, B], q + 1);
    const kept = JSON.stringify((await net(A)).server);
    const aChoice = await A.wait(() => __game.pool.phase === "choice", 5000);
    await A.page.keyboard.press("KeyP");
    const played = await A.wait((b) => { const n = __game.pool.net; return n.log.some((l) => l.k === "choice" && l.c === "play") && !n.brk && n.choice === null && n.turn === 0 && __game.pool.phase === "aim" && JSON.stringify(n.server) === b; }, 10000, kept);
    await check(aChoice && played, "Bình phá cũng không hợp lệ → An bấm P: đánh tiếp từ thế bi đó (bàn giữ nguyên, hết cú phá)", JSON.stringify({ aChoice, played, a: await net(A) }));
    // lỗi: An đánh nhẹ về phía băng đầu bàn, không chạm bi nào → Bình có bi trong tay cả bàn: đặt giữa bàn được (khu đầu bàn của
    // luật cũ không cho), chồng lên bi thì không; toast + dòng lỗi trên bảng nêu lý do; Bình đánh từ đó, An phát lại khớp
    q = (await net(A)).seq;
    await A.ev(() => __game.pool.shoot(-Math.PI / 2, 0.08, { instant: true }));
    await poolSettle([A, B], q + 1);
    const placeB = await B.wait(() => __game.pool.phase === "place", 5000);
    const bF = await B.ev(() => ({ ...__game.pool.net, foulEl: document.querySelector("#pool-hud .foul")?.textContent || "" }));
    const bT = await toastsOf(B);
    const onBall = await B.ev(() => { const b = __game._game.pool.state.balls.find((x) => x.n !== 0 && x.on); return __game.pool.place(b.x, b.z); });
    const center = await B.ev(() => __game.pool.place(0, 0));
    const cue2 = await B.ev(() => __game.pool.cue);
    q = bF.seq;
    await B.ev(() => __game.pool.autoShot());
    await poolSettle([A, B], q + 1);
    const [aF, bF2] = await Promise.all([A, B].map(net));
    const handMsg = `${L.foul_no_hit} ${L.net_hand_you}`;
    await check(placeB && bF.inHand === "table" && bF.hand === "table" && bF.status === L.net_status_place_table && bF.foul === L.foul_no_hit && bF.foulEl.includes(L.foul_no_hit)
      && bT.includes(handMsg) && aF.log.some((l) => l.foul === "no_hit") && !onBall && center && Math.abs(cue2.x) < 1e-4 && Math.abs(cue2.z) < 1e-4
      && same(aF.shown, bF2.shown) && same(aF.shown, aF.server) && aF.mismatch === 0 && bF2.log.filter((l) => l.err).length === bF.log.filter((l) => l.err).length,
      `lỗi "${L.foul_no_hit}" (toast + bảng) → Bình có bi trong tay cả bàn: đặt giữa bàn được, chồng bi thì không; đánh từ đó, An phát lại khớp`,
      JSON.stringify({ placeB, inHand: bF.inHand, status: bF.status, foul: bF.foul, foulEl: bF.foulEl, bT, onBall, center, cue2, mismatch: aF.mismatch, log: bF2.log.slice(-3) }));
    // chơi trọn ván; Cường vào xem sau cú thứ 3; lần đầu có người đánh bi 8: vòng sáng ở 6 lỗ + dòng nhắc gọi lỗ, C → gọi lỗ
    let C = null, shots = 0, bad = null, cView = null, callUi = null, spunShots = 0;
    for (; shots < 200; shots++) {
      const n = await net(A);
      if (n.mode !== "match") break;
      if (shots === 3 && !C) {
        C = await open("Cường", "intern_nam_kinh", "nam");
        await C.ev(() => __game.pool.setFast(true));
        const cn = await net(C), an = await net(A);
        cView = { ready: C.ready, same: same(cn.shown, an.server) && cn.seq === an.seq, seats: cn.seats, mode: cn.mode };
        await C.ev(() => __game.pool.enter());
        cView.full = await C.wait(() => __game.pool.phase === "watch" && __game.pool.net.seat === -1 && __game.pool.net.log.some((l) => l.err === "full"), 10000);
      }
      const shooter = n.turn === 0 ? A : B;
      if (n.choice) { await shooter.ev(() => __game.pool.choose("play")); await shooter.wait(() => __game.pool.net.choice === null, 10000); continue; }
      if (!callUi) {
        const ci = await poolNet(shooter);
        if (ci.needCall && ci.phase === "aim") {
          // Reproduce a server handoff from watching to aiming in one synchronous
          // task: no rAF can repair stale rings before this assertion.
          const handoff = await shooter.ev(() => {
            const p = __game._game.pool, tb = p.tb;
            p.phase = "watch"; p.drawMarks();
            const before = p.info().net.marks.length;
            p.applyTb(tb);
            return { before, phase: p.phase, needCall: p.needCall, marks: p.info().net.marks };
          });
          const lit = handoff.before === 0 && handoff.phase === "aim" && handoff.needCall && handoff.marks.length === 6
            && new Set(handoff.marks).size === 6;
          const id = await shooter.ev(() => __game.pool.cycleCall());
          const after = await poolNet(shooter);
          callUi = { lit, handoff, call0: ci.call, status0: ci.status, id, name: after.callName, status1: after.status, marks: after.marks.length };
        }
      }
      await poolPace(shooter);
      // mỗi cú thứ 3: có xoáy (nấc theo số cú) — mọi máy phát lại phải khớp bàn máy chủ như cú đánh tâm
      const spinOpt = shots % 3 === 1 ? { spin: (shots % 5) - 2, roll: ((shots * 3) % 5) - 2 } : {};
      if (spinOpt.spin || spinOpt.roll) spunShots++;
      const r = await shooter.ev((o) => __game.pool.autoShot(o), spinOpt);
      const live = [A, B, C].filter(Boolean);
      const ok = await poolSettle(live, n.seq + 1);
      const ns = await Promise.all(live.map(net));
      const ref = JSON.stringify(ns[0].server);
      if (!r || !ok.every(Boolean) || ns.some((x) => JSON.stringify(x.shown) !== ref || JSON.stringify(x.server) !== ref || x.mismatch)) {
        bad = { shot: shots, r, ok, ns: ns.map((x) => ({ seq: x.seq, mode: x.mode, turn: x.turn, mismatch: x.mismatch, same: JSON.stringify(x.shown) === ref, log: x.log.slice(-2) })) };
        break;
      }
    }
    const [aE, bE, cE] = await Promise.all([A, B, C].map((p) => (p ? net(p) : null)));
    await check(!!cView?.ready && cView.same && cView.full && cView.seats.join() === "An,Bình",
      "Cường vào zone_05 giữa ván → thấy đúng bàn đang chơi; bấm Play pool khi hết ghế → đứng xem", JSON.stringify(cView));
    const replays = aE.replays + bE.replays + (cE?.replays ?? 0);
    const fouls = aE.log.filter((l) => l.foul).map((l) => l.foul), calls = aE.log.filter((l) => l.call).length;
    const V2 = ["eight", "eight_early", "eight_scratch", "eight_foul", "eight_pocket", "eight_off"];
    await check(!bad && aE.mode === "over" && V2.includes(aE.reason) && bE.winner === aE.winner && cE?.winner === aE.winner && aE.mismatch + bE.mismatch + (cE?.mismatch ?? 0) === 0,
      `chơi trọn ván (luật chuẩn): ${shots} cú (${spunShots} cú có xoáy), ${aE.seats[aE.winner] ?? "?"} thắng (${aE.reason}); ${fouls.length} lỗi (${[...new Set(fouls)].join(", ")}), gọi lỗ ${calls} lần; sau mỗi cú bàn của 2 người + người xem = bàn máy chủ, ${replays} lần phát lại khớp từng bit`,
      JSON.stringify(bad || { mode: aE.mode, winner: [aE.winner, bE.winner, cE?.winner], groups: aE.groups, log: aE.log.slice(-4) }));
    // tên lỗ theo góc nhìn (lỗ góc xa / gần, trái / phải; lỗ giữa)
    const pocketName = callUi?.name && Object.entries(L).some(([k, v]) => k.startsWith("pocket_") && v === callUi.name) ? callUi.name : null;
    await check(!!callUi && callUi.lit && callUi.call0 === null && callUi.status0 === L.net_status_call && !!callUi.id && !!pocketName
      && callUi.status1 === L.net_status_called.replace("{pocket}", pocketName) && callUi.marks === 6 && calls > 0,
      `đánh bi 8: vòng sáng ở 6 lỗ, dòng nhắc gọi lỗ; C → gọi "${pocketName}"; cú bi 8 gửi kèm lỗ đã gọi`, JSON.stringify({ callUi, calls }));
    // hết ván → R (người thua) → ván mới, người thua phá
    const loserSeat = 1 - aE.winner, loser = loserSeat === 0 ? A : B;
    await loser.ev(() => __game.pool.rerack());
    const re = await A.wait((s) => { const n = __game.pool.net; return n.mode === "match" && n.turn === s && n.log.filter((l) => l.k === "start").length >= 2; }, 10000, loserSeat);
    await check(re, "hết ván → R: ván mới, người thua phá", JSON.stringify(await net(A)));
    // Bình rớt mạng giữa ván → ghế giải phóng, An thắng; máy khách cũ (pool_join không kèm r: 2) xin ghế → máy chủ từ chối
    // ("version"); Cường (đang xem) bấm J → ngồi, ván mới
    pages.splice(pages.indexOf(B), 1);
    await B.ctx.close();
    const freed = await A.wait(() => { const n = __game.pool.net; return n.seats[1] === null && n.mode === "solo" && n.log.some((l) => l.k === "forfeit"); }, 15000);
    const cSeesFree = await C.wait(() => __game.pool.net.seats[1] === null, 10000);
    await C.ev(() => __game._game.net.sendPool({ t: "pool_join" }));
    const oldClient = await C.wait(() => __game.pool.net.log.some((l) => l.err === "version"), 5000);
    // bản web luật chuẩn đầu tiên (r: 2, chưa gửi sự kiện cú — máy chủ cũ tự tính cú) cũng bị từ chối
    await C.ev(() => __game._game.net.sendPool({ t: "pool_join", r: 2 }));
    const v2Client = await C.wait(() => __game.pool.net.log.filter((l) => l.err === "version").length >= 2, 5000);
    const stillFree = (await net(C)).seats[1] === null;
    await C.ev(() => __game.pool.join());
    const cSeat = await C.wait(() => { const n = __game.pool.net; return n.seat === 1 && n.mode === "match"; }, 10000);
    await check(freed && cSeesFree && oldClient && v2Client && stillFree && cSeat,
      "Bình rớt mạng giữa ván → ghế được giải phóng, An thắng; máy khách cũ / luật chuẩn bản đầu xin ghế → bị từ chối (version); Cường bấm J → ngồi, ván mới",
      JSON.stringify({ freed, cSeesFree, oldClient, v2Client, stillFree, cSeat, a: await net(A) }));
    // An phá bằng cú đánh bi trắng thẳng vào lỗ góc đầu bàn → lỗi, Cường có bi trong tay ở khu đầu bàn: đặt bi trắng ở đó rồi
    // đánh; An phát lại đúng cú đó (kể cả chỗ đặt bi trắng)
    const sq = (await net(A)).seq, errs0 = (await net(C)).log.filter((l) => l.err).length;
    const scr = await A.ev(() => {
      const p = __game._game.pool, c = p.state.balls[0], k = p.table.pockets.find((q) => q.id === "head_left");
      return __game.pool.shoot(Math.atan2(k.z - c.z, k.x - c.x), 0.6, { instant: true });
    });
    const inHand = await C.wait((q) => { const n = __game.pool.net; return n.seq === q && n.inHand === "kitchen" && n.turn === 1 && __game.pool.phase === "place"; }, 10000, sq + 1);
    const cK = await net(C);
    const badSpot = await C.ev(() => __game.pool.place(0, 0));                // giữa bàn: ngoài khu đầu bàn → không được
    const spot = await C.ev(() => { const t = __game._game.pool.table; return __game.pool.place(0.3, -t.rz * 0.75); });
    const cue = (await C.ev(() => __game.pool.cue));
    await C.ev(() => __game.pool.autoShot());
    const after = await poolSettle([A, C], sq + 2);
    const [aH, cH] = await Promise.all([A, C].map(net));
    await check(scr?.cueScratch && inHand && cK.foul === L.foul_scratch && cK.status === L.net_status_place && !badSpot && spot && Math.abs(cue.x - 0.3) < 1e-4 && after.every(Boolean) && aH.mismatch === 0
      && JSON.stringify(aH.shown) === JSON.stringify(cH.shown) && cH.log.filter((l) => l.err).length === errs0,
      "bi trắng rơi lúc phá → lỗi, đối thủ có bi trong tay chỉ ở khu đầu bàn, đánh từ chỗ đặt; người kia phát lại khớp",
      JSON.stringify({ scr, inHand, foul: cK.foul, status: cK.status, badSpot, spot, cue, after, aMismatch: aH.mismatch, cLog: cH.log.slice(-3) }));
    // máy chủ cũ (không báo "pool"): bàn chỉ tập một mình, không gửi gì lên máy chủ
    await C.ev(() => __game.pool.leave());
    await A.ev(() => __game.pool.leave());
    const idle = await A.wait(() => __game.pool.net.mode === "idle", 10000);
    const sBefore = (await net(A)).seq;
    const old = await C.ev(async () => {
      __game._game.net.features = [];
      const p = __game.pool;
      p.enter();
      const r = await p.shoot(Math.PI / 2, 0.7, { instant: true });
      const i = __game.pool;
      p.leave();
      return { active: i.net.active, on: i.net.on, shots: i.shots, r: !!r };
    });
    await sleep(500);
    const sAfter = (await net(A)).seq;
    await check(idle && !old.active && !old.on && old.shots === 1 && old.r && sAfter === sBefore, 'máy chủ không có bàn chung (không có features "pool") → bàn chỉ tập một mình, bàn chung không đổi',
      JSON.stringify({ idle, old, seq: [sBefore, sAfter] }));
    const con = pages.flatMap((p) => p.problems.splice(0));
    await check(!con.length, "console sạch (mọi trình duyệt)", JSON.stringify(con.slice(0, 6)));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally {
    for (const p of pages) await p.ctx.close().catch(() => {});
  }
}

// (c2) máy khách mới + máy chủ bản cũ (wrangler dev --var POOL_RULES:1 — báo features "pool", không có "pool_rules2"): luật
// rút gọn cũ, giao diện cũ, máy chủ nhận kết quả máy khách tính. An phá nhẹ → không có lựa chọn, Bình đánh luôn; Bình đánh
// bi trắng vào lỗ → An có bi trong tay chỉ ở khu đầu bàn; chơi trọn ván: không có lỗi kiểu luật chuẩn, bàn 2 bên = bàn máy chủ
async function runPoolOld(browser, base, srv) {
  const label = "bi-a 2 người · máy chủ cũ";
  const L = I18N.en.pool;
  const pages = [];
  const open = async (name, look, gender) => { const p = await poolPage(browser, base, srv.url, label, name, look, gender); pages.push(p); return p; };
  const net = poolNet, same = sameJson;
  try {
    const [A, B] = await Promise.all([open("An", "intern_nam", "nam"), open("Bình", "intern_nu", "nu")]);
    const check = A.check;
    const f0 = await A.ev(() => __game.net.features);
    await Promise.all([A, B].map((p) => p.ev(() => __game.pool.setFast(true))));
    await A.ev(() => __game.pool.enter());
    await A.wait(() => __game.pool.net.mode === "solo", 10000);
    await B.ev(() => __game.pool.enter());
    const started = await Promise.all([A, B].map((p) => p.wait(() => { const n = __game.pool.net; return n.mode === "match" && n.turn === 0 && n.seats.join() === "An,Bình"; }, 10000)));
    const aS = await net(A);
    const noChat = await A.ev(() => !__game.chat.available && document.getElementById("chat").hidden);
    // không có "pool_spin": không có ô chọn điểm chạm, phím X / F không đổi gì
    await A.page.keyboard.press("KeyX"); await A.page.keyboard.press("KeyF");
    const noSpin = await A.ev(() => { const s = __game.pool.spin; return { on: s.on, shown: s.shown, spin: s.spin, roll: s.roll, set: __game.pool.setSpin(2, 2).spin, hidden: document.getElementById("pool-spin")?.hidden }; });
    await check(A.ready && B.ready && same(f0, ["pool"]) && started.every(Boolean) && !aS.rules2 && aS.phase === "aim" && noChat
      && !noSpin.on && !noSpin.shown && noSpin.spin === 0 && noSpin.roll === 0 && noSpin.set === 0 && noSpin.hidden === true,
      'máy chủ cũ: features chỉ "pool" (không "pool_rules2", "pool_spin", "chat") → máy khách mới ngồi được, ván 8 bi luật cũ; không có khung chat, không có chọn xoáy',
      JSON.stringify({ ready: [A.ready, B.ready], f0, started, rules: aS.rules, rules2: aS.rules2, noChat, noSpin }));
    // An phá nhẹ: luật cũ không có lựa chọn — Bình đánh luôn; H: thẻ luật rút gọn (1 dòng)
    let q = aS.seq;
    await A.ev(() => __game.pool.shoot(Math.PI / 2, 0.05, { instant: true }));
    await poolSettle([A, B], q + 1);
    const bAim = await B.wait(() => __game.pool.phase === "aim" && __game.pool.net.turn === 1, 5000);
    const bN = await net(B);
    await B.ev(() => __game.pool.help());
    const legacy = await B.ev(() => document.querySelector("#pool-hud .rules")?.textContent || "");
    await B.ev(() => __game.pool.help());
    // Bình đánh bi trắng thẳng vào lỗ góc đầu bàn → An có bi trong tay ở khu đầu bàn (luật cũ: inHand true)
    q = bN.seq;
    const scr = await B.ev(() => {
      const p = __game._game.pool, c = p.state.balls[0], k = p.table.pockets.find((x) => x.id === "head_left");
      return __game.pool.shoot(Math.atan2(k.z - c.z, k.x - c.x), 0.6, { instant: true });
    });
    const inHand = await A.wait((x) => { const n = __game.pool.net; return n.seq === x && n.inHand === true && n.hand === "kitchen" && __game.pool.phase === "place"; }, 10000, q + 1);
    const badSpot = await A.ev(() => __game.pool.place(0, 0));
    const spot = await A.ev(() => { const t = __game._game.pool.table; return __game.pool.place(-0.3, -t.rz * 0.75); });
    const aT = await net(A);
    await check(bAim && bN.choice === null && !bN.log.some((l) => l.brk) && legacy.includes(L.rules_legacy) && scr?.cueScratch && inHand && !badSpot && spot
      && aT.status === L.net_status_place && !aT.foul,
      "luật cũ: phá nhẹ không có lựa chọn (Bình đánh luôn), H: luật rút gọn; bi trắng rơi → bi trong tay chỉ ở khu đầu bàn, không có dòng lỗi",
      JSON.stringify({ bAim, choice: bN.choice, legacy: legacy.slice(0, 60), scr, inHand, badSpot, spot, status: aT.status, foul: aT.foul }));
    // chơi trọn ván bằng cú tự chọn: bàn 2 bên = bàn máy chủ sau mỗi cú, phát lại khớp từng bit, không có lỗi / lựa chọn / gọi lỗ
    let shots = 0, bad = null;
    for (; shots < 200; shots++) {
      const n = await net(A);
      if (n.mode !== "match") break;
      const shooter = n.turn === 0 ? A : B;
      await poolPace(shooter);
      const r = await shooter.ev(() => __game.pool.autoShot());
      const ok = await poolSettle([A, B], n.seq + 1);
      const ns = await Promise.all([A, B].map(net));
      const ref = JSON.stringify(ns[0].server);
      if (!r || !ok.every(Boolean) || ns.some((x) => JSON.stringify(x.shown) !== ref || JSON.stringify(x.server) !== ref || x.mismatch || x.choice || x.needCall)) {
        bad = { shot: shots, r, ok, ns: ns.map((x) => ({ seq: x.seq, mode: x.mode, turn: x.turn, mismatch: x.mismatch, choice: x.choice, same: JSON.stringify(x.shown) === ref })) };
        break;
      }
    }
    const [aE, bE] = await Promise.all([A, B].map(net));
    await check(!bad && aE.mode === "over" && ["eight", "eight_early", "eight_scratch"].includes(aE.reason) && bE.winner === aE.winner && aE.mismatch + bE.mismatch === 0
      && !aE.log.some((l) => l.foul || l.call || l.k === "choice"),
      `chơi trọn ván (luật cũ): ${shots} cú, ${aE.seats[aE.winner] ?? "?"} thắng (${aE.reason}); bàn 2 bên = bàn máy chủ, ${aE.replays + bE.replays} lần phát lại khớp từng bit`,
      JSON.stringify(bad || { mode: aE.mode, reason: aE.reason, winner: [aE.winner, bE.winner], log: aE.log.slice(-4) }));
    const con = pages.flatMap((p) => p.problems.splice(0));
    await check(!con.length, "console sạch", JSON.stringify(con.slice(0, 6)));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally {
    for (const p of pages) await p.ctx.close().catch(() => {});
  }
}


// người chơi giả cho test nhắn tin (WebSocket của Node): nhận mọi tin chat / chat_err
function chatBot(url, name, zone) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const bot = { id: null, chats: [], errs: [], name };
    bot.send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    bot.close = () => { try { bot.send({ t: "leave" }); ws.close(1000); } catch { /* đã đóng */ } };
    bot.until = async (fn, ms = 5000) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { if (fn()) return true; await sleep(50); } return false; };
    ws.onopen = () => { bot.send({ t: "join", name, model: "intern_nam", outfit: "", zone }); bot.send({ t: "state", zone, pos: [0, 0, 0], yaw: 0, anim: "idle" }); };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "welcome") { bot.id = m.id; bot.features = m.features; resolve(bot); }
      if (m.t === "chat") bot.chats.push(m);
      if (m.t === "chat_err") bot.errs.push(m.code);
    };
    ws.onerror = () => reject(new Error(`bot chat: không kết nối được ${url}`));
  });
}

// (e) nhắn tin tự do + bộ lọc từ: An, Bình (2 trình duyệt, zone_05) + Cường (bot WebSocket, zone_02) trên máy chủ local.
// Enter mở khung chat (thẻ quy tắc lần đầu), gõ + Enter gửi; tin zone tới người cùng zone (kèm bong bóng trên đầu), không tới
// Cường; tin all tới cả phòng; từ thô tục / link bị che ở máy chủ (cả bản người gửi nhận lại); tên tự đặt cũng lọc; nhắn riêng
// chỉ tới đúng người (bấm bảng tên → tab Private); tin quá dài / gửi quá nhanh bị chặn; mute; tắt chat ở menu Esc; máy chủ
// không có "chat" → không có khung chat, không lỗi
async function runChat(browser, base, srv) {
  const label = "nhắn tin";
  const pages = [];
  const bots = [];
  try {
    const [A, B] = await Promise.all([poolPage(browser, base, srv.url, label, "An", "intern_nam", "nam"), poolPage(browser, base, srv.url, label, "Bình", "intern_nu", "nu")]);
    pages.push(A, B);
    const check = A.check;
    const C = await chatBot(srv.url, "Cường", "zone_02");
    bots.push(C);
    const chatOf = (p) => p.ev(() => ({ ...__game.chat, net: __game.net.chat, myId: __game.net.id }));
    // zone_05 có thể tự mở hội thoại sau một lúc → giải xong trước khi bấm phím
    const free = async (p) => {
      await p.ev(() => (__game._game.mode === "play" ? null : __game.resolve({ maxMs: 20000 })));
      return p.wait(() => __game._game.mode === "play" && !__game._game.runner?.active, 20000);
    };
    await Promise.all([free(A), free(B)]);
    // Dance packets must play on the other player's existing rig as well.
    const dancerId = await A.ev(() => __game.net.id), danceId = "dance_breakdance_full";
    const remoteReady = await B.wait(id => !!__game._game.net.remotes.list.get(id)?.ch, 20000, dancerId);
    await A.wait(() => performance.now() - __game._game.state.readyAt > 1200, 5000);
    await free(A);
    const localDance = await A.ev(async id => {
      const g = __game._game; await g.player.standUp(); g.net.cooldown = 99;
      const played = await g.dances.play(id); return { played, mode: g.mode, phase: g.state.phase, seated: !!g.player.seated };
    }, danceId);
    const danceSent = localDance.played;
    const remoteDance = remoteReady && await B.wait(({ who, dance }) => {
      const r = __game._game.net.remotes.list.get(who);
      return r?.emoting?.getClip().name === dance && r.emoting.time > 0 && !r.ch.loco;
    }, 30000, { who: dancerId, dance: danceId });
    await check(danceSent && remoteDance && C.features.includes("dance_state"), "Breakdance đồng bộ trạng thái: người khác tải clip / thấy nhảy cả khi cooldown của câu chat chưa hết", JSON.stringify({ localDance, remoteReady, remoteDance, features: C.features }));
    const late = await B.ev(() => {
      const n = __game._game.net, oldId = n.myId;
      n.client.stop(); n.onClose(); n.client.start(); return oldId;
    });
    const lateDance = await B.wait(({ who, oldId, dance }) => {
      const n = __game._game.net, r = n.remotes.list.get(who);
      return n.connected && n.myId !== oldId && r?.emoting?.getClip().name === dance && r.ch.dancePlayback?.elapsed > .5;
    }, 30000, { who: dancerId, oldId: late, dance: danceId });
    const phaseGap = lateDance && await B.ev(id => {
      const r = __game._game.net.remotes.list.get(id);
      return Math.abs(r.ch.dancePlayback.elapsed - r.dance.time - (performance.now() - r.dance.at) / 1000);
    }, dancerId);
    await check(lateDance && phaseGap < .6, "Vào lại phòng giữa bài nhảy: dựng model sau bản tin, tiếp tục đúng đoạn đang nhảy", JSON.stringify({ lateDance, phaseGap }));
    await A.ev(() => { const g = __game._game; g.dances.stop(); g.player.character.mixer.timeScale = 1; });
    const remoteStopped = remoteReady && await B.wait(id => {
      const r = __game._game.net.remotes.list.get(id); return !r?.emoting && r?.ch?.loco;
    }, 5000, dancerId);
    await check(remoteStopped, "Dừng bài nhảy dài: máy khách khác trở lại đi lại, không chạy tiếp 2 phút", JSON.stringify({ remoteStopped }));
    if (remoteReady) await B.ev(id => { __game._game.net.remotes.list.get(id).ch.mixer.timeScale = 1; }, dancerId);
    const [a0, b0] = await Promise.all([chatOf(A), chatOf(B)]);
    // Enter mở khung chat: thẻ quy tắc lần đầu, game đứng yên ở chế độ "chat"
    // tin nhắn app của zone_05 có thể tự mở hội thoại đúng lúc bấm Enter (Enter khi đó là "nói tiếp") → giải xong rồi thử lại
    let opened = false;
    for (let k = 0; k < 3 && !opened; k++) {
      await free(A);
      await A.page.keyboard.press("Enter");
      opened = await A.wait(() => __game.chat.open && __game._game.mode === "chat" && document.activeElement?.closest?.("#chat"), 3000);
    }
    const rulesShown = (await chatOf(A)).rules;
    await A.ev(() => __game.chat.rulesOk());
    await A.page.keyboard.type("Xin chào cả zone!");
    await A.page.keyboard.press("Enter");
    const bGot = await B.wait(() => (__game.net.chat.channels.zone || []).some((e) => e.text === "Xin chào cả zone!"), 5000);
    const bubble = await B.wait(() => __game.net.remotes.some((r) => r.bubble === "Xin chào cả zone!"), 5000);
    const aEcho = await A.wait(() => (__game.net.chat.channels.zone || []).some((e) => e.mine && e.text === "Xin chào cả zone!"), 5000);
    await check(C.features?.includes("chat") && a0.available && b0.available && opened && rulesShown && bGot && bubble && aEcho && !C.chats.some((m) => m.ch === "zone"),
      `máy chủ báo "chat"; Enter mở khung chat (thẻ quy tắc lần đầu), gõ + Enter gửi → Bình (cùng zone) nhận + bong bóng trên đầu An, Cường (zone khác) không nhận`,
      JSON.stringify({ features: C.features, opened, rulesShown, bGot, bubble, aEcho, cZone: C.chats.filter((m) => m.ch === "zone").length }));
    // kênh All: cả phòng; bộ lọc từ + link (máy chủ che, người gửi nhận lại bản đã che)
    await A.ev(() => __game.chat.chat("all", "Chào cả phòng, đồ lồn fuck, xem www.lua-dao.com nhé"));
    const want = "Chào cả phòng, đồ *** ****, xem [link] nhé";
    const cAll = await C.until(() => C.chats.some((m) => m.ch === "all" && m.text === want));
    const bAll = await B.wait((w) => (__game.net.chat.channels.all || []).some((e) => e.text === w), 5000, want);
    const aAll = await A.wait((w) => (__game.net.chat.channels.all || []).some((e) => e.mine && e.text === w), 5000, want);
    await check(cAll && bAll && aAll && !C.chats.some((m) => /lồn|fuck|lua-dao/i.test(m.text)),
      `kênh All tới cả phòng (cả Cường ở zone khác); từ thô tục + link bị che ở máy chủ: "${want}"`, JSON.stringify({ cAll, bAll, aAll, c: C.chats.map((m) => m.text) }));
    // nhắn riêng: Cường → An; An trả lời ở tab Private (bấm bảng tên không có vì Cường ở zone khác → chọn trong danh sách)
    const aId = (await A.ev(() => __game.net.id)), bId = (await B.ev(() => __game.net.id));
    C.send({ t: "chat", ch: "dm", to: aId, text: "An ơi, chiều nay chơi bi-a không?" });
    const aDm = await A.wait((id) => (__game.net.chat.channels[`dm:${id}`] || []).some((e) => e.text.startsWith("An ơi")), 5000, C.id);
    await A.ev((id) => __game.chat.open("dm", id), C.id);
    await A.ev(() => __game.chat.send("Ok, 3 giờ nhé"));
    const cDm = await C.until(() => C.chats.some((m) => m.ch === "dm" && m.text === "Ok, 3 giờ nhé" && m.id === aId));
    await sleep(300);
    const bDm = await B.ev(() => Object.keys(__game.net.chat.channels).filter((k) => k.startsWith("dm:")).length);
    // bấm bảng tên của Bình (khung chat đang mở) → tab Private với Bình
    // bảng tên chỉ có khi nhân vật của Bình đã dựng xong ở máy An (tải GLB — CI chậm có khi mất vài giây) → chờ rồi mới bấm
    const tagReady = await A.wait((name) => [...document.querySelectorAll(".nametag.player-tag")].some((x) => x.textContent === name), 8000, "Bình");
    const tagClick = tagReady && await A.ev((name) => { const el = [...document.querySelectorAll(".nametag.player-tag")].find((x) => x.textContent === name); el?.click(); return !!el; }, "Bình");
    const remotesA = tagClick ? null : await A.ev(() => __game.net.remotes);
    const aState = await chatOf(A);
    await check(aDm && cDm && bDm === 0 && tagClick && aState.tab === "dm" && aState.dmWith === bId,
      "nhắn riêng chỉ tới đúng người (Cường → An, An trả lời ở tab Private; Bình không nhận); bấm bảng tên Bình → tab Private với Bình",
      JSON.stringify({ aDm, cDm, bDm, tagClick, tab: aState.tab, dmWith: aState.dmWith, bId, remotesA }));
    // tin quá dài / gửi quá nhanh: máy khách báo ngay, máy chủ cũng chặn
    const longLocal = await A.ev(() => __game.chat.chat("zone", "x".repeat(121)));
    C.send({ t: "chat", ch: "all", text: "y".repeat(121) });
    const longSrv = await C.until(() => C.errs.includes("long"));
    const before = C.chats.filter((m) => m.id === C.id).length;
    for (let i = 0; i < 8; i++) C.send({ t: "chat", ch: "all", text: `spam ${i}` });
    const rateSrv = await C.until(() => C.errs.includes("rate"));
    await sleep(300);
    const passed = C.chats.filter((m) => m.id === C.id).length - before;
    await check(longLocal === "long" && longSrv && rateSrv && passed <= 5,
      `chặn tin quá dài (> 120 ký tự) và gửi quá nhanh (8 tin liền → ${passed} tin qua, còn lại "rate")`, JSON.stringify({ longLocal, longSrv, rateSrv, passed, errs: C.errs }));
    // tên tự đặt cũng qua bộ lọc; mute: An tắt nhận tin từ Cường (chờ hồi lượt sau đợt spam: giới hạn tin / giây của kết nối + lượt chat)
    await sleep(2500);
    C.send({ t: "join", name: "fuck boy", model: "intern_nam", outfit: "", zone: "zone_02" });
    await sleep(500);
    const errsBefore = C.errs.length;
    C.send({ t: "chat", ch: "all", text: "tên mới" });
    const masked = await B.wait(() => (__game.net.chat.channels.all || []).some((e) => e.text === "tên mới" && e.name === "**** boy"), 5000);
    if (!masked) console.log("  (tên mới)", JSON.stringify({ errs: C.errs.slice(errsBefore), all: C.chats.filter((m) => m.ch === "all").slice(-3) }));
    await A.ev((id) => __game._game.net.mute(id, true), C.id);
    await sleep(1100);
    C.send({ t: "chat", ch: "all", text: "An có thấy không?" });
    const bSees = await B.wait(() => (__game.net.chat.channels.all || []).some((e) => e.text === "An có thấy không?"), 5000);
    await sleep(300);
    const aSees = await A.ev(() => (__game.net.chat.channels.all || []).some((e) => e.text === "An có thấy không?"));
    await check(masked && bSees && !aSees, 'tên tự đặt cũng lọc ("fuck boy" → "**** boy"); An mute Cường → An không nhận, Bình vẫn nhận', JSON.stringify({ masked, bSees, aSees }));
    // máy khách lọc lại tin + tên nhận được (máy chủ trên mạng có thể chưa wrangler deploy danh sách từ mới): đẩy thẳng 1 tin chưa
    // lọc (tiếng Việt) vào máy khách Bình → khung chat hiện bản đã che
    const local = await B.ev(() => {
      __game._game.net.onChatMessage({ t: "chat", ch: "all", id: "fake_vi", name: "thằng chó", text: "đù má, đồ ngu vl" });
      const e = (__game.net.chat.channels.all || []).find((x) => x.id === "fake_vi");
      return e ? { name: e.name, text: e.text } : null; });
    await check(local?.text === "** **, ** *** **" && local?.name === "***** ***",
      `máy khách lọc lại tin chưa lọc (tiếng Việt): "${local?.name}: ${local?.text}"`, JSON.stringify(local));
    // tắt chat ở menu Esc (Bình): không còn khung chat, không nhận tin, Enter không mở
    await A.ev(() => __game.chat.close());
    await free(B);
    await B.page.keyboard.press("Escape");
    await B.wait(() => !!document.querySelector('#menu [data-chat="0"]'), 3000);
    await B.ev(() => document.querySelector('#menu [data-chat="0"]').click());
    await B.page.keyboard.press("Escape");
    await sleep(1100);
    C.send({ t: "chat", ch: "all", text: "Bình tắt chat rồi" });
    await sleep(800);
    await B.page.keyboard.press("Enter");
    const bOff = await B.ev(() => ({ available: __game.chat.available, open: __game.chat.open, got: (__game.net.chat.channels.all || []).some((e) => e.text === "Bình tắt chat rồi"), hidden: document.getElementById("chat").hidden, saved: JSON.parse(localStorage.getItem("fville.settings") || "{}").chat }));
    // máy chủ không có "chat" (bản cũ): An không có khung chat, Enter không làm gì, không lỗi
    const aOld = await A.ev(() => { const n = __game._game.net; const f = n.features; n.features = f.filter((x) => x !== "chat"); __game._game.chat.update(); const r = { available: __game.chat.available, hidden: document.getElementById("chat").hidden }; return { ...r, f }; });
    await A.page.keyboard.press("Enter");
    const aOldOpen = await A.ev(() => __game.chat.open);
    await A.ev((f) => { __game._game.net.features = f; }, aOld.f);
    await check(!bOff.available && !bOff.open && !bOff.got && bOff.hidden && bOff.saved === false && !aOld.available && aOld.hidden && !aOldOpen,
      "tắt chat ở menu Esc → không khung chat, không nhận tin, Enter không mở, lưu cài đặt; máy chủ không có \"chat\" → không có khung chat",
      JSON.stringify({ bOff, aOld: { available: aOld.available, hidden: aOld.hidden }, aOldOpen }));
    const con = pages.flatMap((p) => p.problems.splice(0));
    await check(!con.length, "console sạch", JSON.stringify(con.slice(0, 6)));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally {
    for (const b of bots) b.close();
    for (const p of pages) await p.ctx.close().catch(() => {});
  }
}

// (d) chia phòng: room_size + 1 kết nối → người cuối sang phòng 2; /status cộng mọi phòng; ?room=3 vào thẳng phòng 3
async function runRooms(srv) {
  const label = "chia phòng";
  const size = JSON.parse(readFileSync(join(ROOT, "data", "net.json"), "utf8")).server?.room_size ?? 30;
  const socks = [];
  const connect = (i, q = "") => new Promise((resolve, reject) => {
    const ws = new WebSocket(srv.url + q);
    socks.push(ws);
    const to = setTimeout(() => reject(new Error(`bot ${i}: không có welcome`)), 15000);
    ws.onopen = () => ws.send(JSON.stringify({ t: "join", name: `Bot ${i}`, model: "intern_nam", outfit: "", zone: "zone_02" }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === "welcome") { clearTimeout(to); resolve(m.room); } };
    ws.onerror = () => { clearTimeout(to); reject(new Error(`bot ${i}: lỗi kết nối`)); };
  });
  try {
    const rooms = [];
    for (let i = 0; i <= size; i++) rooms.push(await connect(i));
    const forced = await connect("x", "?room=3");
    const st = await (await fetch(srv.url.replace(/^ws/, "http").replace(/\/ws$/, "/status"))).json();
    const r1 = rooms.filter((r) => r === 1).length, r2 = rooms.filter((r) => r === 2).length;
    const ok = r1 === size && r2 === 1 && rooms[size] === 2 && forced === 3 && st.online === size + 2
      && st.rooms.find((r) => r.room === 2)?.online === 1 && st.rooms.find((r) => r.room === 3)?.online === 1;
    results.push({ look: label, ok, text: "rooms" });
    line(ok, `${label} · ${size + 1} kết nối → ${r1} ở phòng 1, người thứ ${size + 1} sang phòng 2; ?room=3 vào thẳng phòng 3; /status cộng ${st.online} người`
      + (ok && !verbose ? "" : ` — ${JSON.stringify({ r1, r2, forced, online: st.online, rooms: st.rooms.map((r) => [r.room, r.online]) })}`));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally {
    for (const ws of socks) { try { ws.close(1000); } catch { /* đã đóng */ } }
  }
}

// ---------- (f) điện thoại: cảm ứng ----------
// khung ngang 844 × 390, hasTouch + isMobile (matchMedia "(pointer: coarse)" → giao diện cảm ứng tự bật, không cần ?touch=1).
// Chạm: page.touchscreen.tap; kéo / chụm nhiều ngón: CDP Input.dispatchTouchEvent (trình duyệt sinh pointer events như ngón thật)
const MOBILE_VIEW = { width: 844, height: 390 };
async function mobilePage(browser, base, { query = "", name = "Mai", look = "intern_nu", gender = "nu", label = "điện thoại", view = MOBILE_VIEW, title = false } = {}) {
  const ctx = await browser.newContext({ viewport: view, hasTouch: true, isMobile: true, deviceScaleFactor: 1, acceptDownloads: true });
  await ctx.addInitScript(INIT_ONCE, { settings: { tier: "low", lang: "en" }, save: { v: 1, created: true, player: { name, position: "developer", gender, look } } });
  const page = await ctx.newPage();
  const problems = watch(page);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = async (fn, ms, a) => { try { await page.waitForFunction(fn, a, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
  const cdp = await ctx.newCDPSession(page);
  // ngón tay: fingers = [[x, y], …] lúc đặt, to = [[x, y], …] lúc nhấc (cùng số ngón); đi qua `steps` bước, giữ `holdMs` ở cuối
  const touch = async (fingers, to = fingers, { steps = 8, holdMs = 0 } = {}) => {
    const pts = (k) => fingers.map(([x, y], i) => ({ x: x + (to[i][0] - x) * k, y: y + (to[i][1] - y) * k, id: i + 1 }));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(0) });
    for (let n = 1; n <= steps; n++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(n / steps) }); await sleep(16); }
    for (let tms = 0; tms < holdMs; tms += 100) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(1) }); await sleep(100); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const tap = (x, y) => page.touchscreen.tap(x, y);
  const check = async (ok, text, extra = "") => {
    results.push({ look: label, ok, text });
    line(ok, `${label} · ${text}${extra && (verbose || !ok) ? ` — ${extra}` : ""}`);
    if (!ok) {
      mkdirSync(OUT, { recursive: true });
      const f = join(OUT, `mobile-${++shots}.png`);
      await page.screenshot({ path: f }).catch(() => {});
      console.log(`    ảnh: ${f.replace(ROOT + "/", "")}`);
    }
    return ok;
  };
  await page.goto(`${base}/?debug${title ? "" : "&title=off"}${query}`);
  const ready = await wait((t) => (t ? window.__title?.open : window.__game?.state.phase === "playing"), 120000, title);
  // đường đi nhiều đoạn của 1 ngón: points = [[x, y], …] (chạm ở điểm đầu, kéo qua từng điểm, nhấc ở điểm cuối)
  const path = async (points, { steps = 6, holdMs = 0 } = {}) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: points[0][0], y: points[0][1], id: 1 }] });
    for (let k = 1; k < points.length; k++) {
      const [x0, y0] = points[k - 1], [x1, y1] = points[k];
      for (let n = 1; n <= steps; n++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * n / steps, y: y0 + (y1 - y0) * n / steps, id: 1 }] }); await sleep(16); }
      for (let tms = 0; tms < holdMs; tms += 100) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1, y: y1, id: 1 }] }); await sleep(100); }
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  return { ctx, page, problems, ev, wait, touch, tap, path, check, ready };
}
// tâm của phần tử (selector) trên màn hình, hoặc null khi ẩn
// (nằm ngoài khung nhìn — vd bảng mini-game cao hơn màn điện thoại cầm ngang — thì cuộn tới như người chơi vuốt)
const centerOf = (p, sel) => p.ev((s) => { const el = typeof s === "string" ? document.querySelector(s) : null; if (!el || !el.offsetParent) return null;
  let r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) { el.scrollIntoView({ block: "nearest" }); r = el.getBoundingClientRect(); }
  return r.width && r.top >= 0 && r.bottom <= innerHeight ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null; }, sel);
// giải mọi thứ đang mở bằng chạm: hội thoại (chạm hộp thoại / chạm khung vẽ để nói tiếp; lựa chọn: chạm dòng mà resolve() sẽ
// chọn — autoplay.pickChoice), mini-game (Cài app: chạm đúng thứ tự; Ảnh check-in / thẻ: chạm Chụp rồi Giữ; trò khác: debug
// solve), cảnh chuyển (để resolve chạy nhanh). → số lần chạm theo loại
async function touchThrough(p, stats, maxMs = 60000) {
  const t1 = Date.now();
  let calm = 0;
  while (Date.now() - t1 < maxMs) {
    const st = await p.ev(() => {
      const g = __game._game, d = g.ui.dialogue, a = g.ui.minigame.active;
      return { wait: d.waiting?.kind ?? null, pick: __game.touchPick(), mg: a?.id ?? null, kind: a?.data.kind ?? a?.id ?? null,
        cut: !!g.cutscene || !!g.timeSkipping, busy: g.state.phase !== "playing" || !!g.runner.active || !!g.finishing, mode: g.mode,
        app: a && (a.data.kind || a.id) === "install_app" ? a.ctx.debug.state() : null,
        quiz: a && a.ctx.body.querySelector(".quiz") ? a.ctx.debug.state() : null };
    });
    if (st.cut) { await p.ev(() => __game.resolve({ maxMs: 20000 })); calm = 0; continue; }
    if (st.wait === "next") {
      // xen kẽ: chạm vào hộp thoại / chạm vào khung vẽ phía trên (input.onTap)
      const box = await centerOf(p, "#dialogue .text");
      if (stats.dialogueTaps % 2 === 1 || !box) await p.tap(MOBILE_VIEW.width / 2, 110); else await p.tap(box.x, box.y);
      stats.dialogueTaps++;
      await sleep(120); calm = 0; continue;
    }
    if (st.wait === "choice" && st.pick != null) {
      const li = await p.ev((i) => { const el = document.querySelectorAll("#dialogue .choices li")[i]; if (!el) return null; el.scrollIntoView({ block: "nearest" });
        const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, st.pick);
      if (li) { await p.tap(li.x, li.y); stats.choiceTaps++; }
      await sleep(150); calm = 0; continue;
    }
    if (st.mg) {
      stats.minigames.add(st.mg);
      if (st.app) {
        // Cài app: chạm bước đúng thứ tự (mỗi bước chạy thanh tải ~1,1 s)
        const k = st.app.order.indexOf(st.app.next);
        const li = k >= 0 && await p.ev((k) => { const el = document.querySelectorAll("#minigame .steps li")[k]; const r = el?.getBoundingClientRect(); return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null; }, k);
        if (li) { await p.tap(li.x, li.y); stats.mgTaps++; stats.touchMg.add(st.mg); }
        await sleep(1350); calm = 0; continue;
      }
      if (st.quiz) {
        // Quiz tượng Cuder: chạm "Bắt đầu", chạm đáp án đúng, chạm "Tiếp"
        const btn = (await centerOf(p, "#minigame .quiz .go")) || (await centerOf(p, "#minigame .explain .next"))
          || (st.quiz.answerAt != null && await centerOf(p, `#minigame .opts li[data-k="${st.quiz.answerAt}"]`));
        if (btn) { await p.tap(btn.x, btn.y); stats.mgTaps++; stats.touchMg.add(st.mg); await sleep(250); calm = 0; continue; }
      }
      if (/^photo/.test(st.kind)) {
        const btn = (await centerOf(p, "#minigame .shoot")) || (await centerOf(p, "#minigame .keep"));
        if (btn) { await p.tap(btn.x, btn.y); stats.mgTaps++; stats.touchMg.add(st.mg); await sleep(700); calm = 0; continue; }
      }
      await p.ev(() => __game._game.ui.minigame.active?.ctx.debug.solve?.());
      await sleep(400); calm = 0; continue;
    }
    if (st.busy || st.mode !== "play") { await sleep(120); calm = 0; continue; }
    if (++calm >= 4) return;
    await sleep(120);
  }
  stats.timeouts++;
}

async function runMobile(browser, base) {
  const label = "điện thoại";
  const from = onlyZone ? startZone : order[0], until = onlyZone ? startZone : "zone_02";
  const P = await mobilePage(browser, base, { query: `&net=off${onlyZone ? `&start=${startZone}` : ""}`, label });
  const { page, ev, check } = P;
  const stats = { dialogueTaps: 0, choiceTaps: 0, actTaps: 0, mgTaps: 0, minigames: new Set(), touchMg: new Set(), timeouts: 0, steps: [] };
  try {
    if (!await check(P.ready, `vào game ở ${from} (844 × 390, cảm ứng)`)) return;
    // 1. giao diện cảm ứng tự bật (pointer: coarse), nấc Detail thấp, không gợi ý phím / "Click to look"
    await touchThrough(P, stats, 30000);
    const ui = await ev(() => ({ touch: __game.touch, body: document.body.classList.contains("touch"), detail: __game._game.renderer.detail,
      pr: __game._game.renderer.three.getPixelRatio(), prompt: getComputedStyle(document.getElementById("prompt")).display, lock: document.getElementById("lockhint").textContent,
      hint: document.getElementById("hint").textContent, pinch: navigator.maxTouchPoints, sky: __game.sky }));
    await check(ui.body && ui.touch.on && ui.touch.phone && ui.detail === 2 && ui.pr <= 1 && ui.sky.low && ui.prompt === "none" && !ui.lock && ui.hint === I18N.en.hud.controls_touch
      && ui.touch.buttons.menu && ui.touch.buttons.help && ui.touch.zone.w > 200,
      `giao diện cảm ứng tự bật: cần điều khiển, nút Help / Menu, nấc Detail thấp (pixelRatio ${ui.pr}, tắt mây + dãy nhà xa), dòng hướng dẫn bản cảm ứng, không gợi ý phím E / "Click to look"`,
      JSON.stringify(ui));
    // 2. cần điều khiển: đẩy hết cỡ lên trên 1,2 s → chạy tới; vuốt nửa phải → camera xoay; chụm / mở 2 ngón → camera xa / gần
    // (tin nhắn đầu zone tới sau vài giây → chạm qua hết rồi đợi yên 1,5 s mới thử)
    for (let k = 0; k < 5; k++) {
      await touchThrough(P, stats, 20000);
      await sleep(1500);
      if (await ev(() => __game._game.mode === "play" && !__game._game.ui.dialogue.waiting && !!__game.touch.zone.w)) break;
    }
    const z = (await ev(() => __game.touch)).zone;
    // Real taps: offline wheel, a dance, then its Stop control.
    const tapElement = async selector => {
      const box = await ev(s => { const b = document.querySelector(s), r = b?.getBoundingClientRect(); return r && !b.hidden ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, selector);
      if (!box) return false;
      await P.tap(box.x, box.y); return true;
    };
    await P.wait(() => !document.querySelector('#touch [data-a=emote]').hidden, 5000);
    const wheelTap = await tapElement('#touch [data-a=emote]');
    const wheelOpen = await P.wait(() => __game._game.actionsWheel.open && __game._game.mode === "actions", 5000);
    await ev(() => { __game._game.player.character.mixer.timeScale = 0.1; });
    const danceTap = wheelOpen && await tapElement('#emotes .wheel-choice[data-i="0"]');
    const dancePlaying = danceTap && await P.wait(() => !!__game._game.dances.active && __game._game.player.character.current?.time > 0, 30000);
    await tapElement('#touch [data-a=emote]');
    await P.wait(() => __game._game.actionsWheel.open, 5000);
    const stopTap = await tapElement('#emotes [data-a=stop]');
    const danceStopped = await P.wait(() => !__game._game.dances.active && __game._game.player.character.loco && __game._game.mode === "play", 5000);
    await ev(() => { __game._game.player.character.mixer.timeScale = 1; });
    await check(wheelTap && wheelOpen && danceTap && dancePlaying && stopTap && danceStopped,
      "chạm nút Hành động offline → vòng tròn → chọn nhảy → Dừng, trở lại đi lại", JSON.stringify({ wheelTap, wheelOpen, danceTap, dancePlaying, stopTap, danceStopped }));
    const p0 = await ev(() => __game.player.pos);
    // ghi trong trang (máy kiểm thử vẽ chậm: lệnh hỏi giữa chừng có thể tới sau khi đã thả)
    await ev(() => { window.__stickMax = null; window.__stickRec = setInterval(() => { const s = __game._game.input.stick; if (s && (!__stickMax || s.y > __stickMax.y)) __stickMax = { ...s }; }, 30); });
    await P.touch([[z.x, z.y]], [[z.x, z.y - 80]], { steps: 6, holdMs: 1200 });
    const during = await ev(() => { clearInterval(__stickRec); return __stickMax; });
    await sleep(200);
    const p1 = await ev(() => __game.player.pos), after = await ev(() => __game.touch.stick);
    const moved = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
    const yaw0 = await ev(() => __game._game.cam.yaw);
    await P.touch([[640, 170]], [[440, 170]], { steps: 10 });
    await sleep(150);
    const yaw1 = await ev(() => __game._game.cam.yaw), d0 = await ev(() => __game._game.cam.distance);
    await P.touch([[480, 190], [580, 190]], [[380, 190], [700, 190]], { steps: 10 });
    await sleep(200);
    const d1 = await ev(() => __game._game.cam.distance);
    await check(during?.run && during.y > 0.9 && moved > 0.8 && after === null && Math.abs(yaw1 - yaw0) > 0.3 && d1 < d0 - 0.5,
      `cần điều khiển: đẩy hết cỡ = chạy (đi ${moved.toFixed(1)} m), thả → đứng; vuốt xoay camera ${(Math.abs(yaw1 - yaw0) * 57.3).toFixed(0)}°; mở 2 ngón → camera lại gần ${d0.toFixed(1)} → ${d1.toFixed(1)} m`,
      JSON.stringify({ during, after, moved, yaw: [yaw0, yaw1], dist: [d0, d1] }));
    // 3. chơi các mục tiêu tới hết zone `until`: việc bấm E → dịch chuyển tới gần rồi CHẠM nút hành động (ghi đúng tên việc),
    // hội thoại / lựa chọn / mini-game bằng chạm; vùng / lối ra → __game.step()
    const firstAct = {};
    for (let i = 0; i < 60; i++) {
      const g = await ev(() => { const c = __game._game.guide.current(); return { key: c.key, target: c.target ?? null, zone: __game.zone }; });
      if (g.key === "complete" || order.indexOf(g.zone) > order.indexOf(until)) break;
      const ap = g.target ? await ev((t) => __game.approach(t), g.target) : { ok: false };
      if (ap.ok && ap.kind === "interact") {
        await ev(() => { for (let k = 0; k < 4; k++) __game._game.update(1 / 30); });
        // nút hành động cập nhật mỗi khung vẽ (vòng lặp chính), dòng nhắc "E: …" cập nhật trong update() → chờ hai bên khớp
        const act = await P.wait(() => !!__game.touch?.act && __game.touch.act.text === document.getElementById("prompt").dataset.text, 3000) ? await ev(() => ({ ...__game.touch.act, prompt: __game._game.interaction.current?.label ?? null, want: document.getElementById("prompt").dataset.text })) : null;
        if (act) {
          if (!firstAct.text) Object.assign(firstAct, act);
          await P.tap(act.x, act.y);
          stats.actTaps++;
          await sleep(250);
          await touchThrough(P, stats);
          stats.steps.push(`${g.key}:tap`);
          continue;
        }
      }
      const r = await ev(() => __game.step());
      stats.steps.push(`${g.key}:step${r.ok ? "" : "!"}`);
      await touchThrough(P, stats, 30000);
    }
    const end = await ev(() => ({ zone: __game.zone, done: __game._game.progress.quests.size, mode: __game._game.mode }));
    const reached = onlyZone ? end.zone !== from || (await ev(() => __game._game.guide.current().key)) === "complete" : order.indexOf(end.zone) > order.indexOf(until);
    await check(reached && firstAct.text && firstAct.text === firstAct.want && stats.actTaps >= (onlyZone ? 1 : 3) && stats.dialogueTaps >= (onlyZone ? 1 : 5) && (onlyZone || stats.choiceTaps >= 1) && (onlyZone || stats.touchMg.size >= 1) && !stats.timeouts,
      `chơi ${from}${until !== from ? ` → ${until}` : ""} bằng chạm: ${stats.actTaps} lần nút hành động ("${firstAct.text}"), ${stats.dialogueTaps} lần chạm qua hội thoại, ${stats.choiceTaps} lựa chọn, mini-game bằng chạm: ${[...stats.touchMg].join(", ") || "không"} → ${end.zone}`,
      JSON.stringify({ end, firstAct, stats: { ...stats, minigames: [...stats.minigames], touchMg: [...stats.touchMg] } }));
    // 4. bàn bi-a cần chạm (chưa có): không có ở zone 0–2 → chỉ kiểm tra ở zone 5 (lượt máy tính); cầm dọc → nhắc xoay ngang
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(300);
    const rot = await ev(() => ({ shown: getComputedStyle(document.getElementById("rotate")).display !== "none", text: document.querySelector("#rotate p").textContent }));
    await page.setViewportSize(MOBILE_VIEW);
    await sleep(200);
    const rot2 = await ev(() => getComputedStyle(document.getElementById("rotate")).display === "none");
    const con = P.problems.splice(0);
    await check(rot.shown && rot.text === I18N.en.touch.rotate && rot2 && !con.length, "cầm dọc → nhắc xoay ngang, xoay lại thì ẩn; console sạch", JSON.stringify({ rot, rot2, console: con.slice(0, 6) }));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally { await P.ctx.close().catch(() => {}); }
}

// (f1b) màn thấp: Android Chrome cầm ngang, thanh địa chỉ chiếm ~1/4 → vùng game ~230 px (và khung 390 thường). Hội thoại 3–4
// lựa chọn của Ms. Huyền (zone 0): cả khung (tên, câu hỏi, lựa chọn) nằm trong vùng nhìn hoặc cuộn được về đầu, chạm được mọi
// lựa chọn, kéo cuộn không chọn nhầm (khung 230: thêm chữ cho dài ra rồi vuốt), không 2 bảng tên nào đè nhau, camera hội thoại
// (nếu dựng được) đặt mặt 2 người trên khung; khung 230: menu Esc, mini-game, app My FPT, màn tổng kết, thẻ Act / thành tựu —
// phần tử đầu tiên có top ≥ 0, khung không cao quá vùng nhìn. Mỗi khung 1 ảnh ở test-results/short/ (để người xem; không commit).
const SHORT_VIEWS = [{ width: 844, height: 230 }, { width: 844, height: 390 }];
async function runShort(browser, base) {
  const dir = join(OUT, "short");
  mkdirSync(dir, { recursive: true });
  for (const view of SHORT_VIEWS) {
    const label = `điện thoại ${view.width} × ${view.height}`;
    const P = await mobilePage(browser, base, { query: "&net=off", label, view, look: "intern_nam", gender: "nam", name: "An" });
    const { page, ev, check } = P;
    const snap = (name) => page.screenshot({ path: join(dir, `${name}-${view.height}.png`) }).catch(() => {});
    try {
      if (!await check(P.ready, "vào game zone_00")) continue;
      // tới Ms. Huyền, chạm nút hành động, chạm qua lời chào tới câu "What would you like to know?"
      const stats = { dialogueTaps: 0, choiceTaps: 0, actTaps: 0, mgTaps: 0, minigames: new Set(), touchMg: new Set(), timeouts: 0 };
      await touchThrough(P, stats, 20000);
      for (let i = 0; i < 6 && await ev(() => __game._game.guide.current().key) !== "z0_meet_thao"; i++) { await ev(() => __game.step()); await touchThrough(P, stats, 20000); }
      await ev((t) => __game.approach(t), await ev(() => __game._game.guide.current().target));
      await ev(() => { for (let k = 0; k < 4; k++) __game._game.update(1 / 30); });
      const act = await P.wait(() => !!__game.touch?.act, 4000) && await ev(() => __game.touch.act);
      if (act) await P.tap(act.x, act.y);
      for (let i = 0; i < 40; i++) {
        const w = await ev(() => __game._game.ui.dialogue.waiting?.kind ?? null);
        if (w === "choice" && (await ev(() => __game._game.ui.dialogue.snapshot.choices.length)) >= 3) break;
        if (w === "next") await P.tap(view.width / 2, 20);                 // chạm khung vẽ phía trên = nói tiếp
        else if (w === "choice") { const i2 = await ev(() => __game.touchPick()); const li = await ev((i) => { const e = document.querySelectorAll("#dialogue .choices li[data-i]")[i]; e?.scrollIntoView({ block: "nearest" }); const r = e?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i2); if (li) await P.tap(li.x, li.y); }
        await sleep(300);
      }
      await sleep(900);   // camera hội thoại chuyển xong, khung đo lại
      const d = await ev(() => {
        const el = document.getElementById("dialogue"), R = (e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
        const lis = [...el.querySelectorAll(".choices li[data-i]")];
        // mọi lựa chọn chạm được: cuộn tới (như vuốt) rồi điểm giữa đúng là lựa chọn đó
        const hits = lis.map((li) => { li.scrollIntoView({ block: "nearest" }); const r = li.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("li") === li && r.height >= 38; });
        el.scrollTop = 0;
        const g = __game._game, T = g.talkCam;
        const V = g.camera.position.constructor;
        const face = (c) => { const v = new V(c.root.position.x, c.root.position.y + c.model.height_m * 0.93, c.root.position.z).project(g.camera); return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight) }; };
        return { box: R(el), name: R(el.querySelector(".name")), text: R(el.querySelector(".text")), lis: lis.map(R), hits, n: lis.length,
          scroll: [el.scrollTop, el.scrollHeight, el.clientHeight], more: el.querySelector(".more")?.parentElement.className, tags: __game.tags,
          hidden: ["objective", "clock", "net-online"].map((id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : "none"; }),
          cam: T.active ? { partner: face(T.partner.character), player: face(g.player.character) } : null, wait: g.ui.dialogue.waiting?.kind };
      });
      const inView = d.box.top >= 0 && d.box.bottom <= view.height;
      const fits = d.scroll[1] <= d.scroll[2] + 1;
      const headOk = d.name.top >= d.box.top && d.text.top >= d.box.top;   // đang cuộn về đầu: tên + câu hỏi ở đầu khung
      const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      const tagHit = d.tags.some((a, i) => d.tags.some((b, j) => j > i && overlap(a, b)));
      const camOk = !d.cam || (d.cam.partner.y < d.box.top && d.cam.player.y < d.box.top);
      await snap("dialogue");
      await check(d.wait === "choice" && d.n >= 3 && inView && headOk && (fits || view.height < 300) && d.hits.every(Boolean) && !tagHit && !d.tags.length
        && d.hidden.every((x) => x === "none") && camOk && d.more !== "body",
        `hội thoại Ms. Huyền ${d.n} lựa chọn: khung ${d.box.top}–${d.box.bottom} px trong vùng nhìn${fits ? ", không cần cuộn" : ", cuộn được"}, chạm được mọi lựa chọn, không bảng tên nào hiện / đè, ẩn mục tiêu + đồng hồ${d.cam ? `, mặt 2 người trên khung (y ${d.cam.partner.y}, ${d.cam.player.y})` : " (camera hội thoại không dựng được ở chỗ này — camera chơi)"}`,
        JSON.stringify(d));
      // kéo cuộn không chọn nhầm: thêm chữ cho câu hỏi dài ra → khung phải cuộn; vuốt lên bắt đầu trên 1 lựa chọn
      if (view.height < 300) {
        const sc = await ev(() => { const el = document.getElementById("dialogue"), t = el.querySelector(".text"); t.firstChild.textContent = (t.firstChild.textContent + " ").repeat(16); el.scrollTop = 0;
          const li = el.querySelector(".choices li[data-i]"), r = li.getBoundingClientRect(), b = el.getBoundingClientRect();
          return { over: el.scrollHeight > el.clientHeight + 4, top: Math.round(b.top), x: Math.round(r.left + r.width / 2), y: Math.round(Math.min(r.top + r.height / 2, b.bottom - 12)) }; });
        await P.touch([[sc.x, sc.y]], [[sc.x, sc.y - 70]], { steps: 8 });
        await sleep(400);
        const after = await ev(() => { const el = document.getElementById("dialogue"); return { scrolled: el.scrollTop, wait: __game._game.ui.dialogue.waiting?.kind ?? null, top: Math.round(el.getBoundingClientRect().top) }; });
        await snap("dialogue-scroll");
        await check(sc.over && sc.top >= 0 && after.scrolled > 10 && after.wait === "choice",
          `câu hỏi dài hơn khung: khung vẫn trong vùng nhìn (top ${sc.top}), vuốt trên lựa chọn → cuộn ${after.scrolled} px, không chọn nhầm`, JSON.stringify({ sc, after }));
        await ev(() => { document.getElementById("dialogue").scrollTop = 0; });
      }
      // chạm lựa chọn smoke sẽ chọn → hội thoại đi tiếp; chơi hết hội thoại
      const pick = await ev(() => __game.touchPick());
      const li = await ev((i) => { const e = document.querySelectorAll("#dialogue .choices li[data-i]")[i]; e.scrollIntoView({ block: "nearest" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, pick);
      await P.tap(li.x, li.y);
      const chose = await P.wait(() => __game._game.ui.dialogue.waiting?.kind !== "choice" || __game._game.ui.dialogue.snapshot?.choices.length < 3, 3000);
      await touchThrough(P, stats, 30000);
      // bảng tên ngoài hội thoại cũng không đè nhau (Tú, Ms. Huyền, hành khách, tài xế… quanh bến xe)
      await sleep(600);
      const tags = await ev(() => __game.tags);
      const tagHit2 = tags.some((a, i) => tags.some((b, j) => j > i && overlap(a, b)));
      // né đè: gắn tạm thêm 2 bảng tên đúng chỗ bảng của Ms. Huyền (3 bảng trùng nhau) → phải dời ra, không cái nào đè
      const dodge = await ev(async () => { const g = __game._game, n = g.npc("thao"), h = n.character.model.height_m;
        const extra = ["Test A", "Test B"].map((x) => g.nametags.add(n.character.root, x, h));
        // xếp lại 5 lần / giây theo thời gian game (ui/nametags.js DODGE_HZ) — CI chậm (khung thưa) cần lâu hơn: chờ tới khi hết đè, tối đa 4 s
        const ov = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        let r = __game.tags;
        for (let t0 = performance.now(); performance.now() - t0 < 4000; ) {
          await new Promise((res) => setTimeout(res, 200));
          r = __game.tags;
          if (r.length >= 2 && !r.some((a, i) => r.some((b, j) => j > i && ov(a, b)))) break;
        }
        for (const t of extra) { t.element.remove(); t.parent?.remove(t); g.nametags.tags.splice(g.nametags.tags.indexOf(t), 1); }
        return r; });
      const dodgeHit = dodge.some((a, i) => dodge.some((b, j) => j > i && overlap(a, b)));
      await check(chose && !tagHit2 && !dodgeHit && dodge.length >= 2, `chạm lựa chọn → hội thoại đi tiếp; ngoài hội thoại ${tags.length} bảng tên không đè nhau; 3 bảng tên trùng chỗ → dời ra còn ${dodge.length} bảng, không đè`,
        JSON.stringify({ chose, tags, dodge }));
      if (view.height >= 300) { const con = P.problems.splice(0); await check(!con.length, "console sạch", con.slice(0, 6).join("; ")); continue; }
      // các khung khác ở khung 230: phần tử đầu tiên top ≥ 0, khung không cao quá vùng nhìn (dài thì cuộn)
      const box = (sel) => ev((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(), f = el.firstElementChild?.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), first: f ? Math.round(f.top) : null, scroll: el.scrollHeight > el.clientHeight + 2, ov: getComputedStyle(el).overflowY }; }, sel);
      const fitIn = (b) => b && b.top >= 0 && b.first >= 0 && b.bottom <= view.height + 1 && (!b.scroll || /auto|scroll/.test(b.ov));
      const res = {};
      // menu Esc (nút ☰)
      const mb = await P.wait(() => !!__game.touch?.buttons.menu, 5000) && await ev(() => __game.touch.buttons.menu);
      if (mb) await P.tap(mb.x, mb.y);
      if (await P.wait(() => !document.getElementById("menu").hidden, 3000)) { await sleep(200); res.menu = await box("#menu .panel"); await snap("menu"); }
      // độ nhạy cảm ứng (điện thoại: chỉ thanh cảm ứng, không có thanh chuột): 200 % → vuốt 40 px xoay gấp đôi; trả về 100 %
      const sens = await ev(() => {
        const inp = __game._game.input, c = __game._game.renderer.canvas, r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const swipe = () => { inp.consumeDrag(true);
          const o = { pointerId: 77, pointerType: "touch", isPrimary: true, bubbles: true, clientY: y };
          c.dispatchEvent(new PointerEvent("pointerdown", { ...o, clientX: x })); c.dispatchEvent(new PointerEvent("pointermove", { ...o, clientX: x + 40 }));
          c.dispatchEvent(new PointerEvent("pointercancel", { ...o, clientX: x + 40 })); return +inp.consumeDrag(true).dx.toFixed(3); };
        const slide = (v) => { const el = document.querySelector("#menu [data-look=touch]"); if (!el) return; el.value = v; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); };
        const out = { touch: !!document.querySelector("#menu [data-look=touch]"), mouse: !!document.querySelector("#menu [data-look=mouse]"), music: !!document.querySelector("#menu [data-vol=music]") };
        out.d1 = swipe(); slide(200); out.d2 = swipe(); out.saved = JSON.parse(localStorage.getItem("fville.settings") || "{}").look?.touch; slide(100);
        return out;
      });
      await check(sens.touch && !sens.mouse && sens.music && sens.d1 > 0 && Math.abs(sens.d2 - 2 * sens.d1) < 1e-3 && sens.saved === 2,
        `${view.width} × ${view.height}: menu Esc có thanh Nhạc + độ nhạy cảm ứng (không có độ nhạy chuột) — 200 % → vuốt xoay ×2 (${sens.d1} → ${sens.d2}), lưu cài đặt`, JSON.stringify(sens));
      await ev(() => document.querySelector("#menu [data-act=resume]")?.click());
      await sleep(300);
      // mini-game: quiz tượng Cuder (đoạn chuyện dài nhất)
      await ev(() => { __game._game.runMinigame("cuder_quiz"); });
      if (await P.wait(() => !!__game._game.ui.minigame.active, 5000)) { await sleep(300); res.minigame = await box("#minigame .panel"); await snap("minigame"); }
      await ev(() => __game._game.ui.minigame.close(false));
      await P.wait(() => __game._game.mode === "play", 5000);
      // app My FPT (cho có app như sau zone 1)
      await ev(() => { if (!__game._game.progress.hasReward("app_my_fpt")) __game._game.progress.rewards.push("app_my_fpt"); __game._game.toggleApp(); });
      if (await P.wait(() => __game._game.ui.app.open, 3000)) { await sleep(300); res.app = await box("#myfpt .phone"); await snap("app"); }
      await ev(() => __game._game.ui.app.open && __game._game.toggleApp());
      // màn tổng kết (dữ liệu hiện có)
      await ev(() => __game._game.ui.summary.show(__game._game.summaryData(), () => {}));
      if (await P.wait(() => __game._game.ui.summary.open, 3000)) { await sleep(300); res.summary = await box("#summary .panel"); await snap("summary"); }
      await ev(() => __game._game.ui.summary.hide());
      // thẻ Act, thẻ thành tựu
      await ev(() => __game.showCard("act"));
      await sleep(700);
      res.act = await box("#act-card"); await snap("act-card");
      await sleep(2000);
      await ev(() => __game.showCard("ach"));
      await sleep(900);
      res.ach = await box("#ach-card"); await snap("ach-card");
      const bad = Object.entries(res).filter(([, b]) => !fitIn(b)).map(([k]) => k);
      const miss = ["menu", "minigame", "app", "summary", "act", "ach"].filter((k) => !res[k]);
      const con = P.problems.splice(0);
      await check(!bad.length && !miss.length && !con.length, `menu Esc, mini-game, app My FPT, màn tổng kết, thẻ Act / thành tựu: không tràn mép trên, không cao quá vùng nhìn; console sạch`,
        JSON.stringify({ bad, miss, res, console: con.slice(0, 6) }));
    } catch (e) {
      results.push({ look: label, ok: false, text: e.message });
      line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
    } finally { await P.ctx.close().catch(() => {}); }
  }
}

// (f1c) camera hội thoại trên màn thấp: nói chuyện với lễ tân (zone 3, camera qua vai dựng được) ở khung 844 × 230 → mặt người
// đối thoại và người chơi nằm phía trên mép trên khung thoại (player/talkcam.js đo khung sau khi thu nhỏ)
async function runShortCam(browser, base) {
  const view = { width: 844, height: 230 }, label = "điện thoại 844 × 230 · camera hội thoại";
  const P = await mobilePage(browser, base, { query: "&net=off&start=zone_03", label, view, look: "intern_nam", gender: "nam", name: "An" });
  const { ev, check } = P;
  try {
    if (!await check(P.ready, "vào game zone_03")) return;
    await ev(() => __game.resolve({ maxMs: 20000 }));
    await ev(async () => { const t = __game._game.guide.current().target; await __game.approach(t); __game._game.interact(); });
    await P.wait(() => !!__game._game.ui.dialogue.waiting, 8000);
    await sleep(1500);   // chuyển camera 0,4 s + khung đổi êm
    const c = await ev(() => {
      const g = __game._game, T = g.talkCam, V = g.camera.position.constructor, top = g.ui.dialogue.el.getBoundingClientRect().top;
      const face = (ch) => { const v = new V(ch.root.position.x, ch.root.position.y + ch.model.height_m * 0.93, ch.root.position.z).project(g.camera); return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight), z: +v.z.toFixed(3) }; };
      return { active: T.active, frame: +T.frame.toFixed(3), top: Math.round(top), partner: T.partner && face(T.partner.character), player: face(g.player.character), who: g.ui.dialogue.snapshot?.name };
    });
    mkdirSync(join(OUT, "short"), { recursive: true });
    await P.page.screenshot({ path: join(OUT, "short", "talkcam-230.png") }).catch(() => {});
    const inFrame = (f) => f && f.y >= 0 && f.y < c.top && f.x >= 0 && f.x <= view.width && f.z < 1;
    const con = P.problems.splice(0);
    await check(c.active && c.frame < 0.8 && inFrame(c.partner) && inFrame(c.player) && !con.length,
      `${c.who}: mặt người đối thoại (y ${c.partner?.y}) và người chơi (y ${c.player?.y}) nằm trên khung thoại (top ${c.top} px); console sạch`, JSON.stringify({ ...c, console: con.slice(0, 6) }));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally { await P.ctx.close().catch(() => {}); }
}

// (f1d) toàn màn hình: điện thoại chạm Continue ở màn tiêu đề → vào toàn màn hình (cử chỉ người dùng); thoát → nút ⛶ nhấp nháy;
// manifest web app (display fullscreen, xoay ngang, icon tải được) cho "Thêm vào màn hình chính"
async function runFullscreen(browser, base) {
  const label = "điện thoại · toàn màn hình";
  const P = await mobilePage(browser, base, { query: "&net=off", label, title: true });
  const { ev, check } = P;
  try {
    if (!await check(P.ready, "màn tiêu đề")) return;
    const b = await centerOf(P, "#title .start");
    if (b) await P.tap(b.x, b.y);
    const full = await P.wait(() => !!document.fullscreenElement, 5000);
    const playing = await P.wait(() => __game.state.phase === "playing", 90000);
    await ev(() => document.exitFullscreen());
    const pulse = await P.wait(() => !document.fullscreenElement && document.querySelector("#touch [data-a=full]").classList.contains("pulse"), 3000);
    const man = await ev(async () => { const link = document.querySelector("link[rel=manifest]"); const m = await (await fetch(link.href)).json();
      const icons = await Promise.all(m.icons.map(async (i) => { const r = await fetch(new URL(i.src, link.href)); const im = new Image(); im.src = URL.createObjectURL(await r.blob()); await im.decode(); return r.ok && `${im.naturalWidth}x${im.naturalHeight}` === i.sizes; }));
      return { display: m.display, orientation: m.orientation, icons }; });
    const con = P.problems.splice(0);
    await check(full && playing && pulse && man.display === "fullscreen" && man.orientation === "landscape" && man.icons.length >= 2 && man.icons.every(Boolean) && !con.length,
      "chạm Continue → toàn màn hình; thoát → nút ⛶ nhấp nháy; manifest: fullscreen, xoay ngang, icon 192 + 512 tải được; console sạch", JSON.stringify({ full, playing, pulse, man, console: con.slice(0, 6) }));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally { await P.ctx.close().catch(() => {}); }
}

// (f1e) bi-a bằng cảm ứng (pool/table.js buildTouch), khung 844 × 230 (Android có thanh địa chỉ) và 844 × 390: chạm nút "Play pool"
// → vào bàn; các nút / thanh lực / bảng / ô áp phê không chồng nhau, không che bi trắng + điểm chạm; kéo ngón trên bàn → cơ hướng
// tới ngón tay; chạm nhẹ không đánh; kéo thanh lực xuống rồi thả → có cú (số cú tăng); kéo xuống rồi về đỉnh → huỷ; chụm 2 ngón →
// camera gần lại; kéo chấm áp phê; thế bi dựng sẵn (gọi lỗ) → chạm gần lỗ = gọi lỗ đó; nút ✕ → rời bàn. Mỗi khung 1 ảnh.
const boxHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inBox = (p, b) => p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
function boxProblems(t) {
  const list = Object.entries(t.boxes), bad = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (boxHit(list[i][1], list[j][1])) bad.push(`${list[i][0]}×${list[j][0]}`);
  for (const [k, b] of list) { if (inBox(t.cueScreen, b)) bad.push(`${k} che bi trắng`); if (inBox(t.contactScreen, b)) bad.push(`${k} che điểm chạm`); }
  return bad;
}
async function runPoolTouch(browser, base) {
  mkdirSync(join(OUT, "short"), { recursive: true });
  for (const view of SHORT_VIEWS) {
    const label = `bi-a cảm ứng ${view.width} × ${view.height}`;
    const P = await mobilePage(browser, base, { query: "&net=off&start=zone_05", label, view, look: "intern_nam", gender: "nam", name: "An" });
    const { page, ev, check } = P;
    const pool = () => ev(() => ({ ...__game.pool, camDist: __game._game.pool.camDist, t: __game.pool.touch() }));
    try {
      if (!await check(P.ready, "vào game zone_05")) continue;
      // tin nhắn / hội thoại đầu zone tới sau vài giây → giải hết, chờ yên rồi mới vào bàn
      for (let k = 0; k < 5; k++) {
        await ev(() => __game.resolve({ maxMs: 20000 }));
        await sleep(1500);
        if (await ev(() => __game._game.mode === "play" && !__game._game.ui.dialogue.open)) break;
      }
      // vào bàn bằng nút hành động "Play pool"
      await ev(() => __game.approach("pool_table"));
      await ev(() => { for (let k = 0; k < 4; k++) __game._game.update(1 / 30); });
      const act = await P.wait(() => __game.touch?.act?.text === "Play pool", 5000) && await ev(() => __game.touch.act);
      if (act) await P.tap(act.x, act.y);
      const entered = await P.wait(() => __game.pool.active && __game.pool.phase === "aim", 5000);
      await sleep(700);
      const s0 = await pool();
      const hint = await ev(() => document.getElementById("hint").textContent);
      const bad0 = boxProblems(s0.t);
      await page.screenshot({ path: join(OUT, "short", `pool-touch-${view.height}.png`) }).catch(() => {});
      const need = ["tpower", "aimL", "aimR", "rules", "rerack", "leave", "panel", "spin"].filter((k) => !s0.t.boxes[k]);
      const small = Object.entries(s0.t.boxes).filter(([k, b]) => !["panel", "spin", "tpower", "power"].includes(k) && (b.w < 44 || b.h < 44)).map(([k]) => k);
      await check(entered && !!act && s0.t.on && !need.length && !bad0.length && !small.length && !await ev(() => !!document.querySelector(".pool-note")) && hint === `${I18N.en.pool.hint_touch} · ${I18N.en.pool.hint_spin_touch}`,
        `chạm "Play pool" → vào bàn; ${Object.keys(s0.t.boxes).length} khối (thanh lực, ◀ ▶, Luật / Xếp lại / Rời bàn, bảng, ô áp phê) không chồng nhau, không che bi trắng / điểm chạm, nút ≥ 44 px; dòng hướng dẫn cảm ứng`,
        JSON.stringify({ entered, act: !!act, need, bad0, small, hint, boxes: s0.t.boxes, cue: s0.t.cueScreen, contact: s0.t.contactScreen }));
      // kéo ngón trên bàn → cơ hướng từ bi trắng tới ngón tay; chạm nhẹ không đánh
      const c = s0.t.cueScreen, tx = c.x - Math.min(150, view.width * 0.16), ty = Math.max(30, c.y - 70);
      await P.touch([[c.x - 40, c.y - 30]], [[tx, ty]], { steps: 6 });
      await sleep(200);
      const aim = await ev(([x, y]) => { const p = __game._game.pool, pt = p.pointer.point(x, y), cue = p.state.balls[0];
        const want = Math.atan2(pt.z - cue.z, pt.x - cue.x), d = Math.atan2(Math.sin(p.angle - want), Math.cos(p.angle - want));
        return { angle: p.angle, want, diff: Math.abs(d) }; }, [tx, ty]);
      const shots0 = (await pool()).shots;
      await P.tap(c.x + 60, Math.max(30, c.y - 50));
      await sleep(700);
      const afterTap = await pool();
      await check(aim.diff < 0.02 && Math.abs(aim.angle - s0.angle) > 0.05 && afterTap.shots === shots0 && afterTap.phase === "aim" && !afterTap.rolling,
        `kéo ngón trên bàn → cơ quay ${(Math.abs(aim.angle - s0.angle) * 57.3).toFixed(0)}°, hướng đúng tới ngón tay (lệch ${aim.diff.toFixed(4)} rad); chạm nhẹ không đánh`,
        JSON.stringify({ aim, s0: s0.angle, shots: [shots0, afterTap.shots], phase: afterTap.phase }));
      // thanh lực: kéo xuống giữ rồi thả → cú; kéo xuống rồi về đỉnh → huỷ
      const rec = () => ev(() => { window.__tp = { max: 0, charge: false, cue: 0 }; window.__tpI = setInterval(() => { const p = __game._game.pool;
        if (p.touchPower != null) __tp.max = Math.max(__tp.max, p.touchPower); if (p.phase === "charge") __tp.charge = true; }, 30); });
      const stopRec = () => ev(() => { clearInterval(__tpI); return __tp; });
      const tp = s0.t.boxes.tpower, sx = tp.x + tp.w / 2, sy = tp.y + 34;
      await rec();
      await P.path([[sx, sy], [sx, sy + tp.h * 0.5], [sx, sy]], { steps: 6, holdMs: 200 });
      const cancel = await stopRec();
      await sleep(400);
      const afterCancel = await pool();
      await rec();
      await P.path([[sx, sy], [sx, sy + tp.h * 0.55]], { steps: 6, holdMs: 300 });
      const shot = await stopRec();
      const done = await P.wait((n) => __game.pool.shots === n + 1 && !__game.pool.rolling && __game.pool.phase === "aim", 30000, shots0);
      const afterShot = await pool();
      await check(cancel.charge && cancel.max > 0.3 && afterCancel.shots === shots0 && afterCancel.phase === "aim" && afterCancel.power === 0
        && shot.charge && shot.max > 0.3 && done && afterShot.shots === shots0 + 1,
        `thanh lực: kéo xuống (lực ${cancel.max.toFixed(2)}) rồi về đỉnh, thả → hủy; kéo xuống (lực ${shot.max.toFixed(2)}), thả → đánh, số cú ${shots0} → ${afterShot.shots}`,
        JSON.stringify({ cancel, afterCancel: { shots: afterCancel.shots, phase: afterCancel.phase, power: afterCancel.power }, shot, done, shots: afterShot.shots }));
      // chụm / mở 2 ngón → camera gần / xa; kéo chấm áp phê
      const d0 = (await pool()).camDist, cy = Math.max(40, c.y - 50);
      await P.touch([[c.x - 30, cy], [c.x + 30, cy]], [[c.x - 120, cy], [c.x + 120, cy]], { steps: 8 });
      await sleep(200);
      const d1 = (await pool()).camDist;
      const dot = await ev(() => __game.pool.spinDot());
      if (dot) await P.touch([[dot.x, dot.y]], [[dot.x + dot.r * 0.6, dot.y - dot.r * 0.6]], { steps: 5 });
      const sp = (await pool()).spin;
      await check(d1 < d0 - 0.2 && !!dot && sp.spin > 0 && sp.roll > 0,
        `mở 2 ngón → camera ${d0.toFixed(2)} → ${d1.toFixed(2)} m; kéo chấm áp phê → "${sp.text}"`, JSON.stringify({ d0, d1, dot, sp }));
      // gọi lỗ bi 8 (thế bi dựng sẵn): chạm cách tâm lỗ 12 px vẫn gọi đúng lỗ đó; không đánh
      await ev(() => { const rz = __game._game.pool.table.rz; __game.pool.setState({ 0: [0, -rz * 0.5], 8: [0.05, rz * 0.3] }, { call: true }); });
      await sleep(600);
      const tc = (await pool()).t;
      const boxes = Object.values(tc.boxes), pk = tc.pockets.filter((q) => q.visible && q.x > 20 && q.x < view.width - 20 && q.y > 10 && q.y < view.height - 10
        && !boxes.some((b) => inBox({ x: q.x, y: q.y }, { x: b.x - 16, y: b.y - 16, w: b.w + 32, h: b.h + 32 }))).sort((a, b) => a.y - b.y)[0];
      if (pk) await P.tap(pk.x + 12, pk.y + 4);
      await sleep(300);
      const called = await pool();
      await check(!!pk && called.net.call === pk.id && called.shots === shots0 + 1 && called.phase === "aim",
        `đánh bi 8 (thế bi dựng sẵn): chạm cạnh lỗ ${pk?.id} → gọi lỗ đó ("${called.net.callName}"), không đánh`, JSON.stringify({ pk, call: called.net.call, shots: called.shots }));
      // nút ✕ → rời bàn
      const lv = (await pool()).t.boxes.leave;
      if (lv) await P.tap(lv.x + lv.w / 2, lv.y + lv.h / 2);
      const left = await P.wait(() => !__game.pool.active && __game._game.mode === "play", 4000);
      // thử thách của anh Khang (mini-game "Một cú bi-a"): không ô áp phê / nút Luật / Rời bàn (khung mini-game có nút huỷ), đánh
      // bằng thanh lực → còn ít cú hơn; khung mini-game không đè thanh lực / ◀ ▶
      await ev(() => { __game._game.runMinigame("billiards"); });
      const ch = await P.wait(() => __game.pool.active && __game.pool.challenge && __game.pool.phase === "aim", 8000);
      await sleep(500);
      const c0 = await pool();
      const mgBox = await ev(() => { const r = document.querySelector("#minigame .panel")?.getBoundingClientRect(); return r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null; });
      const cBad = boxProblems({ ...c0.t, contactScreen: null, boxes: { ...c0.t.boxes, ...(mgBox ? { minigame: mgBox } : {}) } });   // bi trắng không bị che
      const ctp = c0.t.boxes.tpower;
      if (ctp) await P.path([[ctp.x + ctp.w / 2, ctp.y + 34], [ctp.x + ctp.w / 2, ctp.y + 34 + ctp.h * 0.4]], { steps: 6, holdMs: 200 });
      const shotC = await P.wait((n) => (__game.pool.left !== n || !__game.pool.active) && !__game.pool.rolling, 20000, c0.left);
      const c1 = await pool();
      await ev(() => __game._game.ui.minigame.active && __game._game.ui.minigame.close(false));
      const con = P.problems.splice(0);
      await check(left && ch && !c0.t.boxes.spin && !c0.t.boxes.rules && !c0.t.boxes.leave && !!ctp && !cBad.length && shotC && (c1.left !== c0.left || !c1.active) && !con.length,
        `nút ✕ → rời bàn; thử thách của anh Khang: không ô áp phê / Luật / Rời bàn, thanh lực đánh được (còn ${c0.left} → ${c1.active ? c1.left : "xong"} cú), khung mini-game không đè nút; console sạch`,
        JSON.stringify({ left, ch, boxes: Object.keys(c0.t.boxes), mgBox, cBad, shotC, lefts: [c0.left, c1.left], console: con.slice(0, 6) }));
    } catch (e) {
      results.push({ look: label, ok: false, text: e.message });
      line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
    } finally { await P.ctx.close().catch(() => {}); }
  }
}

// (f1f) bi-a 2 người: 1 máy cảm ứng (Bình, 844 × 390) + 1 máy tính (An) qua máy chủ local. Bình ngắm bằng ngón tay + thanh lực;
// An không chạm bi → Bình có bi trong tay cả bàn: kéo bi trắng bằng ngón tay (chồng lên bi khác → vòng đỏ), chạm "Đặt bi", đánh
// bằng thanh lực. Sau mỗi cú bàn 2 máy = bàn máy chủ, phát lại khớp từng bit; console sạch
async function runPoolTouchNet(browser, base, srv) {
  const label = "bi-a cảm ứng · 2 người";
  let A = null, B = null;
  try {
    A = await poolPage(browser, base, srv.url, label, "An", "intern_nam", "nam");
    B = await mobilePage(browser, base, { query: `&net=${encodeURIComponent(srv.url)}&start=zone_05`, label, name: "Bình", look: "intern_nu", gender: "nu" });
    const check = B.check;
    const bReady = B.ready && await B.wait(() => window.__game.net?.connected && !!window.__game.pool?.net?.on, 60000);
    if (!await check(A.ready && bReady, "máy tính (An) + điện thoại (Bình) vào zone_05, cùng máy chủ local")) return;
    await A.ev(() => __game.pool.enter());
    await A.wait(() => __game.pool.net.seat === 0, 10000);
    await B.ev(() => __game.resolve({ maxMs: 20000 }));
    await B.ev(() => __game.pool.enter());
    const started = await Promise.all([A, B].map((p) => p.wait(() => { const n = __game.pool.net; return n.mode === "match" && n.seats.join() === "An,Bình"; }, 15000)));
    await A.ev(() => __game.pool.setFast(true));
    const st = { touchShots: 0, deskShots: 0, placed: null, red: false, mismatch: 0, unsynced: 0, log: [] };
    const bNet = () => poolNet(B);
    const synced = async (q) => {
      await poolSettle([A, B], q, 40000);
      const [a, b] = await Promise.all([poolNet(A), bNet()]);
      if (!sameJson(a.shown, a.server) || !sameJson(b.shown, b.server)) st.unsynced++;
      st.mismatch = Math.max(a.mismatch, b.mismatch);
    };
    for (let i = 0; i < 14 && !(st.touchShots >= 2 && st.deskShots >= 2 && st.placed); i++) {
      const n = await bNet();
      if (n.mode !== "match") break;
      const q = n.seq;
      if (n.turn === 0) {
        await poolPace(A);
        // lần 2 của An: không chạm bi (đánh nhẹ về băng đầu bàn) → Bình có bi trong tay cả bàn
        if (!st.placed && st.deskShots >= 1) await A.ev(() => __game.pool.shoot(-Math.PI / 2, 0.08, { instant: true }));
        else if ((await poolNet(A)).phase === "choice") await A.ev(() => __game.pool.choose("play"));
        else await A.ev(() => __game.pool.autoShot());
        st.deskShots++; st.log.push("A");
        await synced(q + 1);
        continue;
      }
      await B.wait(() => ["aim", "place", "choice"].includes(__game.pool.phase), 8000);
      const ph = (await bNet()).phase;
      let t = await B.ev(() => __game.pool.touch());
      if (ph === "choice") {
        const b = t.boxes.play; if (b) await B.tap(b.x + b.w / 2, b.y + b.h / 2);
        st.log.push("B:play"); await B.wait(() => __game.pool.phase !== "choice", 5000); continue;
      }
      if (ph === "place") {
        // kéo bi trắng lên một bi khác (đỏ), rồi tới chỗ trống giữa bàn; chạm "Đặt bi" (chờ camera chuyển xong sang góc nhìn bi trong tay)
        await sleep(1200);
        t = await B.ev(() => __game.pool.touch());
        const cue = t.cueScreen;
        const other = await B.ev(() => { const p = __game._game.pool, b = p.state.balls.find((x) => x.n !== 0 && x.on); const s = p.pointer.screen(b.x, b.z); return { x: s.x, y: s.y }; });
        const spot = await B.ev(() => { const p = __game._game.pool, s = p.state; let best = null;
          for (let x = -0.3; x <= 0.3; x += 0.1) for (let z = -0.6; z <= 0.6; z += 0.15) { if (!p.override || !s.balls.every((b) => !b.on || b.n === 0 || Math.hypot(b.x - x, b.z - z) > 0.12)) continue;
            const q = p.pointer.screen(x, z); if (q.visible && q.y > 40 && q.y < innerHeight - 60 && q.x > 120 && q.x < innerWidth - 140) { best = { x: q.x, y: q.y, lx: x, lz: z }; break; } if (best) break; }
          return best; });
        await B.ev(() => { window.__red = false; window.__redI = setInterval(() => { if (__game._game.pool.placeBad && __game._game.pool.placeMark.visible) __red = true; }, 30); });
        if (cue && other && spot) await B.path([[cue.x, cue.y], [other.x, other.y], [spot.x, spot.y]], { steps: 8, holdMs: 300 });
        st.red = await B.ev(() => { clearInterval(__redI); return __red; });
        // bi trắng phải nằm đúng dưới chỗ nhấc ngón (điểm trên mặt bàn lúc đó), chỗ đó đặt được (không đỏ)
        const under = spot && await B.ev(([x, y]) => { const p = __game._game.pool; return { ...p.pointer.point(x, y), bad: !!p.placeBad }; }, [spot.x, spot.y]);
        const before = await B.ev(() => __game.pool.cue);
        t = await B.ev(() => __game.pool.touch());
        const pb = t.boxes.place; if (pb) await B.tap(pb.x + pb.w / 2, pb.y + pb.h / 2);
        const aimNow = await B.wait(() => __game.pool.phase === "aim", 4000);
        st.placed = { spot, under, cue: before, aimNow, ok: !!under && !under.bad && Math.hypot(before.x - under.x, before.z - under.z) < 0.01 };
        st.log.push("B:place");
        t = await B.ev(() => __game.pool.touch());
      }
      // ngắm bằng ngón tay tới bi mục tiêu gần nhất, kéo thanh lực
      const tgt = await B.ev(() => { const p = __game._game.pool, s = p.state, cue = s.balls[0];
        const own = s.balls.filter((b) => b.on && b.n !== 0 && b.n !== 8).sort((a, b) => Math.hypot(a.x - cue.x, a.z - cue.z) - Math.hypot(b.x - cue.x, b.z - cue.z))[0] || s.balls[8];
        const q = p.pointer.screen(own.x, own.z); return { x: q.x, y: q.y }; });
      if (tgt) await B.touch([[tgt.x + 4, tgt.y + 4]], [[tgt.x, tgt.y]], { steps: 3 });
      await sleep(150);
      t = await B.ev(() => __game.pool.touch());
      const tp = t.boxes.tpower;
      if (!tp) { st.log.push(`B:no-power(${(await bNet()).phase})`); break; }
      const sx = tp.x + tp.w / 2, sy = tp.y + 34;
      await B.path([[sx, sy], [sx, sy + tp.h * 0.5]], { steps: 6, holdMs: 200 });
      st.touchShots++; st.log.push("B:shot");
      await synced(q + 1);
    }
    const [a, b] = await Promise.all([poolNet(A), bNet()]);
    const con = [...A.problems.splice(0), ...B.problems.splice(0)];
    await check(started.every(Boolean) && st.touchShots >= 2 && st.deskShots >= 2 && st.placed?.ok && st.placed.aimNow && st.red && !st.unsynced && !st.mismatch
      && sameJson(a.server, b.server) && !con.length,
      `máy tính + điện thoại chơi ${st.deskShots + st.touchShots} cú (${st.touchShots} cú bằng ngón tay + thanh lực); bi trong tay: kéo bi trắng (chồng bi → vòng đỏ), "Đặt bi"; sau mỗi cú bàn 2 máy = bàn máy chủ, phát lại khớp; console sạch`,
      JSON.stringify({ started, ...st, a: { mismatch: a.mismatch, replays: a.replays }, b: { mismatch: b.mismatch, replays: b.replays }, console: con.slice(0, 6) }));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally { for (const p of [A, B]) await p?.ctx.close().catch(() => {}); }
}

// (f1g) ô nhắn tin ở góc trái dưới (máy tính, 1000 × 640, máy chủ local): khung đóng → ô "Enter: chat · /: quick message"; bấm
// vào ô → khung đầy đủ; "/" → gõ nhanh (chỉ ô nhập, ký tự "/" không lọt vào ô), Enter gửi rồi tự đóng; Enter → khung đầy đủ,
// Esc → đóng, KHÔNG mở menu Esc, không xin khoá con trỏ ngay (lỗi cũ: trình duyệt nhả khoá bằng chính phím Esc → game mở menu)
async function runChatBar(browser, base, srv) {
  const label = "nhắn tin · ô góc trái dưới";
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  await ctx.addInitScript(INIT_ONCE, { settings: { tier: "low", lang: "en", chat_rules: true }, save: { v: 1, created: true, player: { name: "Lan", position: "developer", gender: "nu", look: "intern_nu" } } });
  const page = await ctx.newPage();
  const problems = watch(page);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = async (fn, ms, a) => { try { await page.waitForFunction(fn, a, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
  const check = async (ok, text, extra = "") => {
    results.push({ look: label, ok, text });
    line(ok, `${label} · ${text}${extra && (verbose || !ok) ? ` — ${extra}` : ""}`);
    if (!ok) { mkdirSync(OUT, { recursive: true }); const f = join(OUT, `chatbar-${++shots}.png`); await page.screenshot({ path: f }).catch(() => {}); console.log(`    ảnh: ${f.replace(ROOT + "/", "")}`); }
    return ok;
  };
  try {
    await page.goto(`${base}/?debug&net=${encodeURIComponent(srv.url)}&title=off&start=zone_02`);
    const ready = await wait(() => window.__game?.state.phase === "playing" && __game.chat?.available, 90000);
    for (let k = 0; k < 4; k++) { await ev(() => __game.resolve({ maxMs: 20000 })); await sleep(1200); if (await ev(() => __game._game.mode === "play" && !__game._game.ui.dialogue.open)) break; }
    // giả lập khoá con trỏ (headless không khoá thật ổn định): lock() → khoá sau 30 ms như thật
    // headless có thể đang khoá con trỏ thật (bấm vào canvas lúc chơi) → mọi cú bấm chuột đi vào canvas; nhả khoá (không mở menu)
    await ev(() => { const i = __game._game.input; if (document.pointerLockElement) { i._releasing = true; document.exitPointerLock(); } });
    await sleep(300);
    await ev(() => { const i = __game._game.input; i._releasing = false; i.lockSupported = true; i.fakeLock = false; });
    const bar = await ev(() => { const b = document.querySelector("#chat .bar"), r = b.getBoundingClientRect(); return { shown: __game.chat.bar, text: b.textContent, left: Math.round(r.left), bottom: Math.round(innerHeight - r.bottom), h: Math.round(r.height) }; });
    const bc = await ev(() => { const r = document.querySelector("#chat .bar").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(bc.x, bc.y);
    const clickOpen = await wait(() => __game._game.chat.isOpen && !__game.chat.quick && document.activeElement === __game._game.chat.input, 3000);
    await ev(() => __game.chat.close());
    await sleep(300);
    // "/" → gõ nhanh
    await page.keyboard.press("Slash");
    const quick = await wait(() => __game._game.chat.isOpen && __game.chat.quick && document.activeElement === __game._game.chat.input, 3000);
    const q = await ev(() => ({ value: __game._game.chat.input.value, tabs: getComputedStyle(document.querySelector("#chat .tabs")).display, log: getComputedStyle(document.querySelector("#chat .log")).display, ph: __game._game.chat.input.placeholder }));
    await page.keyboard.type("Hi from the quick bar");
    await page.keyboard.press("Enter");
    const sent = await wait(() => (__game.net.chat.channels.zone || []).some((e) => e.mine && e.text === "Hi from the quick bar"), 5000);
    const closedQ = await wait(() => !__game._game.chat.isOpen && __game._game.mode === "play", 3000);
    await sleep(400);
    // Enter → khung đầy đủ; Esc → đóng, không menu, không xin khoá ngay
    await ev(() => { __game._game.input.fakeLock = false; });
    await page.keyboard.press("Enter");
    const full = await wait(() => __game._game.chat.isOpen && !__game.chat.quick && getComputedStyle(document.querySelector("#chat .tabs")).display !== "none", 3000);
    await page.keyboard.press("Escape");
    await sleep(200);
    const esc = await ev(() => ({ open: __game._game.chat.isOpen, menu: !document.getElementById("menu").hidden, mode: __game._game.mode, locked: __game._game.input.locked }));
    await sleep(700);
    // sau đó bấm vào game vẫn khoá lại được (chờ hết 0,5 s)
    await ev(() => __game._game.input.lock());
    const relock = await wait(() => __game._game.input.locked, 2000);
    const con = problems.splice(0);
    await check(ready && bar.shown && bar.left <= 24 && bar.bottom <= 24 && bar.text.includes(I18N.en.chat.bar) && clickOpen && quick && q.value === "" && q.tabs === "none" && q.log === "none"
      && sent && closedQ && full && !esc.open && !esc.menu && esc.mode === "play" && !esc.locked && relock && !con.length,
      `ô "${I18N.en.chat.bar}" ở góc trái dưới (cách mép ${bar.left} / ${bar.bottom} px), bấm → khung chat; "/" → gõ nhanh (không lọt "/"), Enter gửi rồi đóng; Enter → khung đầy đủ, Esc → đóng, không mở menu Esc, không xin khoá ngay; bấm lại thì khoá được; console sạch`,
      JSON.stringify({ ready, bar, clickOpen, quick, q, sent, closedQ, full, esc, relock, console: con.slice(0, 6) }));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally { await ctx.close().catch(() => {}); }
}

// (f2) nhắn tin bằng cảm ứng (máy chủ local): nút Chat mở khung chat (ô nhập được focus), gõ, chạm nút Gửi → tin tới máy chủ
// (bản đã lọc quay về), gửi xong cất bàn phím (ô nhập hết focus), đang mở chat thì cần điều khiển ẩn; chạm Menu → menu Esc
async function runMobileChat(browser, base, srv) {
  const label = "điện thoại · nhắn tin";
  const P = await mobilePage(browser, base, { query: `&net=${encodeURIComponent(srv.url)}&start=zone_02`, label, name: "Linh" });
  try {
    const on = P.ready && await P.wait(() => __game.chat?.available && !!__game.touch?.buttons.chat, 20000);
    await P.ev(() => (__game._game.mode === "play" ? null : __game.resolve({ maxMs: 20000 })));
    await P.wait(() => __game._game.mode === "play" && !!__game.touch?.buttons.chat, 20000);
    const b = await P.ev(() => __game.touch.buttons.chat);
    await P.tap(b.x, b.y);
    const opened = await P.wait(() => __game._game.chat?.isOpen && document.activeElement?.closest?.("#chat") && getComputedStyle(document.querySelector("#touch .stick-zone")).display === "none", 5000);
    await P.ev(() => __game.chat.rulesOk());
    await P.page.keyboard.type("Hello from my phone");
    const send = await centerOf(P, "#chat form button");
    if (send) await P.tap(send.x, send.y);
    const echo = await P.wait(() => (__game.net.chat.channels.zone || []).some((e) => e.mine && e.text === "Hello from my phone"), 5000);
    // màn thấp (Android cầm ngang, thanh địa chỉ hiện): khung chat đang mở không tràn mép trên
    await P.page.setViewportSize({ width: 844, height: 230 });
    await sleep(500);
    const short = await P.ev(() => { const b = document.querySelector("#chat .box").getBoundingClientRect(), f = document.querySelector("#chat .box").firstElementChild.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), first: Math.round(f.top) }; });
    mkdirSync(join(OUT, "short"), { recursive: true });
    await P.page.screenshot({ path: join(OUT, "short", "chat-230.png") }).catch(() => {});
    await P.page.setViewportSize(MOBILE_VIEW);
    await sleep(300);
    const blurred = await P.ev(() => document.activeElement?.tagName !== "INPUT" && __game._game.chat.isOpen);
    await P.ev(() => __game.chat.close());
    const m = await P.wait(() => !!__game.touch.buttons.menu, 3000) && await P.ev(() => __game.touch.buttons.menu);
    if (m) await P.tap(m.x, m.y);
    const menu = await P.wait(() => !document.getElementById("menu").hidden, 3000);
    const con = P.problems.splice(0);
    const shortOk = short.top >= 0 && short.first >= 0 && short.bottom <= 231;
    await P.check(on && opened && !!send && echo && blurred && menu && shortOk && !con.length,
      "nút Chat → khung chat (ô nhập sẵn sàng, cần điều khiển ẩn), gõ + chạm Gửi → tin tới máy chủ, gửi xong cất bàn phím, khung 844 × 230 không tràn mép trên; nút Menu → menu Esc; console sạch",
      JSON.stringify({ on, opened, send: !!send, echo, blurred, menu, short, console: con.slice(0, 6) }));
  } catch (e) {
    results.push({ look: label, ok: false, text: e.message });
    line(false, `${label} · lỗi script: ${e.message.split("\n")[0]}`);
  } finally { await P.ctx.close().catch(() => {}); }
}

const server = await startServer();
const browser = await chromium.launch({ headless: !arg("headed"), ...(chromePath ? { executablePath: chromePath } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
console.log(`smoke: ${extra === "only" ? "" : mobileOnly ? `điện thoại (--mobile ${mobile}) · ` : `${looks.map((l) => l.id).join(", ")} · ${onlyZone ? startZone : `${order[0]} → ${order[order.length - 1]}`} · `}${extra === "off" || mobileOnly ? "" : "bản lưu cũ, mạng (zone 4, bi-a 2 người, nhắn tin, chia phòng, máy chủ cũ) · "}${server.mode || server.base}`);
try {
  // lần lượt từng ngoại hình (chạy song song chỉ nhanh hơn ~1 phút, và trang chạy nền không tải được ảnh thẻ)
  if (extra !== "only" && !mobileOnly) for (const look of looks) await runLook(browser, server.base, look);
  if (extra !== "only" && mobile !== "off" && mobile !== "pool") { await runMobile(browser, server.base); await runShort(browser, server.base); await runShortCam(browser, server.base); await runFullscreen(browser, server.base); }
  if (extra !== "only" && mobile !== "off" && mobile !== "ui") await runPoolTouch(browser, server.base);
  if (extra !== "off" && mobileOnly) {
    const srv = await startNetServer();
    if (!srv.skip && !srv.error) {
      try {
        if (mobile !== "pool") await runMobileChat(browser, server.base, srv);
        if (mobile !== "ui") await runPoolTouchNet(browser, server.base, srv);
      } finally { srv.stop(); }
    }
  } else if (extra !== "off") {
    await runOldSave(browser, server.base);
    // các test mạng dùng chung 1 máy chủ local; chia phòng chạy cuối (cần phòng 1 trống)
    const srv = await startNetServer();
    if (srv.skip) console.log(`– mạng: bỏ qua — ${srv.skip}`);
    else if (srv.error) { results.push({ look: "mạng", ok: false, text: "máy chủ local" }); line(false, `mạng · ${srv.error}`); }
    else {
      try {
        await runNetZone4(browser, server.base, srv);
        await runPoolNet(browser, server.base, srv);
        await runChat(browser, server.base, srv);
        await runChatBar(browser, server.base, srv);
        if (mobile !== "off") { await runMobileChat(browser, server.base, srv); await runPoolTouchNet(browser, server.base, srv); }
        await runRooms(srv);
      } finally { srv.stop(); }
      // máy chủ bản cũ (luật bi-a rút gọn, không báo "pool_rules2") — wrangler dev thứ 2, kho dữ liệu riêng
      const old = await startNetServer({ POOL_RULES: "1" });
      if (old.error) { results.push({ look: "mạng", ok: false, text: "máy chủ cũ" }); line(false, `mạng · máy chủ cũ · ${old.error}`); }
      else if (!old.skip) { try { await runPoolOld(browser, server.base, old); } finally { old.stop(); } }
    }
  }
} finally {
  await browser.close();
  server.stop();
}
const bad = results.filter((r) => !r.ok).length;
const sec = Math.round((Date.now() - t0) / 1000), dur = sec >= 60 ? `${Math.floor(sec / 60)} phút ${sec % 60} giây` : `${sec} giây`;
console.log(bad ? `✗ smoke: ${bad} / ${results.length} bước hỏng (${dur})` : `✓ smoke: ${results.length} bước đạt, ${extra === "only" || mobileOnly ? 0 : looks.length} ngoại hình${mobileOnly ? ` + điện thoại (--mobile ${mobile})` : ""}${extra === "off" || mobileOnly ? "" : " + bản lưu cũ, mạng (zone 4, bi-a 2 người, nhắn tin, chia phòng, máy chủ cũ)"} (${dur})`);
process.exit(bad ? 1 : 0);
