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
//     (2 trình duyệt chơi trọn một ván + người xem vào giữa ván), chia phòng ~30 người. Bản lưu cũ + zone 4 đặt sẵn cài đặt
//     cũ tier "high"
//   --lang vi | en: mọi ngoại hình chơi bằng 1 ngôn ngữ (mặc định: ngoại hình thứ 2 tiếng Việt, còn lại tiếng Anh)
//   --headed: mở cửa sổ trình duyệt · --verbose: in thêm chi tiết từng bước
// In gọn: mỗi bước 1 dòng ✓/✗, cuối cùng 1 dòng tổng kết + thời gian. Ảnh chụp chỉ khi bước hỏng: test-results/ (không commit).
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
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
const zoneIsLast = (z) => z === order[order.length - 1];
const langArg = arg("lang");
const langOf = (look) => (langArg ? String(langArg) : looks.indexOf(look) === 1 ? "vi" : "en");
const I18N = { en: JSON.parse(readFileSync(join(ROOT, "data", "i18n", "en.json"), "utf8")), vi: JSON.parse(readFileSync(join(ROOT, "data", "i18n", "vi.json"), "utf8")) };
const ACH = JSON.parse(readFileSync(join(ROOT, "data", "achievements.json"), "utf8")).final.title;   // tên thành tựu cuối theo ngôn ngữ
const QUESTS = JSON.parse(readFileSync(join(ROOT, "data", "quests.json"), "utf8")).quests;
// tên có dấu tiếng Việt để thử tên file ảnh thẻ
const NAMES = { intern_nam: ["Đỗ Minh Khôi", "do-minh-khoi"], intern_nam_kinh: ["Trần Đức Anh", "tran-duc-anh"], intern_nu: ["Nguyễn Thị Hà", "nguyen-thi-ha"] };
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
  // khoá con trỏ (Pointer Lock) không phải thứ cần thử: headless + đổi chế độ liên tục bằng code → khoá / nhả chồng nhau có
  // thể làm main.js tưởng người chơi bấm Esc (mở menu). Tắt hẳn, Esc đi thẳng vào main.js như khi không khoá
  const noLock = () => ev(() => { const i = __game._game.input; i.lockSupported = false; if (document.pointerLockElement) { i._releasing = true; document.exitPointerLock(); } });

  try {
    // không ?look: chọn ngoại hình qua màn tạo nhân vật
    const q = `?debug&net=off${onlyZone ? `&start=${startZone}` : ""}`;
    await page.goto(`${base}/${q}`);
    await page.waitForSelector("#creator input[name=name]", { timeout: 90000 });
    const cr = { mode: await ev(() => window.__creator?.mode) };
    if (pick !== "cards" && cr.mode === "3d") {
      cr.ready = await wait(() => window.__creator?.ready, 90000);
      if (pick === "keys") {
        await page.focus("#creator .stage canvas");
        for (let i = 0; i < looks.length + 1 && await ev(() => __creator.selected) !== look.id; i++) await page.keyboard.press("ArrowRight");
      } else {
        const i = await ev((id) => __creator.looks.indexOf(id), look.id);
        const p = await ev((k) => __creator.screen(k), i);
        if (p) await page.mouse.click(p.x, p.y);
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
    // đổi ngôn ngữ giữa chừng (menu Esc → Language): mục tiêu, tiêu đề menu đổi ngay, tiến trình / vị trí giữ nguyên, đổi lại
    if (lang !== "en" && startZone === order[0]) {
      const q0 = QUESTS.find((q) => q.zone === startZone && q.required)?.title;
      const sw = {};
      const snap = () => ev(() => ({ lang: document.documentElement.lang, objective: __game.objective, menu: document.querySelector("#menu h2")?.textContent,
        quests: __game.progress.quests.length, pos: __game.player.pos, mode: __game._game.mode }));
      sw.before = await snap();
      await page.keyboard.press("Escape");
      sw.menuOpen = await wait(() => !document.getElementById("menu").hidden, 5000);
      await page.click("#menu [data-lang=en]");
      await wait(() => document.documentElement.lang === "en", 10000);
      sw.en = await snap();
      await page.click(`#menu [data-lang=${lang}]`);
      await wait((l) => document.documentElement.lang === l, 10000, lang);
      sw.back = await snap();
      sw.saved = await ev(() => JSON.parse(localStorage.getItem("fville.settings") || "{}").lang);
      await page.keyboard.press("Escape");
      sw.closed = await wait(() => document.getElementById("menu").hidden && __game._game.mode === "play", 5000);
      await check(sw.before.objective === q0?.[lang] && sw.menuOpen && sw.en.objective === q0?.en && sw.en.menu === I18N.en.menu.title
        && sw.back.objective === q0?.[lang] && sw.back.menu === I18N[lang].menu.title && sw.saved === lang && sw.closed
        && sw.en.quests === sw.before.quests && JSON.stringify(sw.en.pos) === JSON.stringify(sw.before.pos),
        `menu Esc → English → ${I18N[lang].lang[lang]}: mục tiêu "${sw.before.objective}" ↔ "${sw.en.objective}", tiến trình giữ nguyên, lưu cài đặt`, JSON.stringify(sw));
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

    const pauses = (st) => zoneIsLast(st.zone) ? [...(st.lunch ? [] : ["time_skip"]), ...(st.login ? [] : ["login"]), ...(st.reloaded || look !== looks[0] ? [] : ["ending:lan"])] : [];
    for (let zi = order.indexOf(startZone); zi < order.length && !failed; zi++) {
      const zone = order[zi], next = order[zi + 1], zt = Date.now();
      const required = await ev((z) => __game._game.content.quests.filter((q) => q.zone === z && q.required).map((q) => q.id), zone);
      const ps = { zone, lunch: false, login: false, reloaded: false };
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
      // zone_05: bàn bi-a (mô hình Sketchfab, node pool_table + 16 bi + cơ, COL): chơi một mình (lời nhắc "Play pool", đánh
      // bằng __game.pool.shoot, bi lăn rồi dừng, rời bàn) và mini-game Một cú bi-a của anh Khang trên bàn thật (thử thách)
      if (zone === "zone_05" && look === looks[0]) {
        const bi = await ev(async () => {
          const g = __game._game, t = g.zone.root.getObjectByName("pool_table");
          const scene = { table: !!t, balls: t ? t.children.filter((c) => /^ball_\d+$/.test(c.name)).length : 0,
            cue: !!t?.getObjectByName("cue"), col: g.zone.colMeshes.some((m) => m.name === "COL_ban_bi_a") };
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
          for (let i = 0; i < 2000 && g.pool.playback; i++) { g.update(1 / 20); if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0)); }
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
          return { scene, ok: a.ok && k.ok, prompt, inPool: { mode: inPool.mode, active: inPool.active, hidden: inPool.cuesHidden }, turn, before, res, after: { phase: after.phase, shots: after.shots, cue: after.cue }, drawn, inside, out,
            khang: { minigames: r.minigames, dialogues: r.dialogues, played: g.progress.flags.has("billiards_played"), potted: g.progress.flags.has("billiards_potted"),
              hit: g.progress.flags.has("billiards_last_hit"), pool: g.pool.active, mode: g.mode } };
        });
        await check(bi.scene.table && bi.scene.balls === 16 && bi.scene.cue && bi.scene.col && bi.ok && bi.prompt === "Play pool" && bi.inPool.mode === "pool" && bi.inPool.active && bi.inPool.hidden
          && bi.turn.turned > 0.5 && bi.turn.moved > 0.3 && bi.turn.rise < 0.01
          && bi.res && bi.res.frames > 10 && bi.res.time > 0.3 && bi.after.phase === "aim" && bi.after.shots === 1 && (bi.after.cue.z !== bi.before.z || !bi.after.cue.on) && bi.drawn && bi.inside
          && bi.out.mode === "play" && bi.out.cuesBack,
          `zone_05: bàn bi-a — "Play pool", xoay cơ (đi vòng ${bi.turn.moved} m, chân cách sàn tối đa ${Math.round(bi.turn.rise * 1000)} mm), phá bi (${bi.res?.pocketed?.length ?? 0} bi vào lỗ, ${bi.res?.time ?? "?"} s), bi dừng đúng chỗ, rời bàn`, JSON.stringify(bi));
        await check(bi.khang.minigames.includes("billiards") && bi.khang.played && bi.khang.potted && bi.khang.hit && !bi.khang.pool && bi.khang.mode === "play",
          "zone_05: anh Khang → Một cú bi-a trên bàn thật: bi vào lỗ, billiards_potted + billiards_played (gộp)", JSON.stringify(bi.khang));
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
      // zone trong nhà: kéo chuột ngẩng hết cỡ + lăn chuột lùi xa nhất → camera vẫn dưới trần (trần không có COL_; trước
      // đây camera bay lên tận nóc nhà). Đối chứng: cùng các góc khi camera chỉ tránh COL_ (số lần xuyên trần trước khi sửa)
      if (/^zone_0[345]$/.test(zone) && look === looks[0]) {
        const cc = await ev(() => ({ fixed: __game.cameraCeiling(), old: __game.cameraCeiling({ withView: false }) }));
        await check(cc.fixed.through === 0 && cc.fixed.pitch >= 1.1 && cc.fixed.distance >= 7 && cc.fixed.maxUp < cc.old.maxUp,
          `${zone}: camera ngẩng / lùi hết cỡ không xuyên trần (${cc.fixed.n} góc ở ${cc.fixed.points} điểm, cao nhất ${cc.fixed.maxUp} m trên chân; chỉ tránh COL_: xuyên ${cc.old.through} lần, cao ${cc.old.maxUp} m)`,
          JSON.stringify(cc));
      }
      let steps = 0, stepFail = null;
      while (steps++ < 40) {
        const g = await ev(() => ({ key: __game._game.guide.current().key, zone: __game.zone }));
        if (g.zone !== zone || g.key === "complete") break;
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
            await check(seat.seated === "seated" && seat.sits === 1 && seat.rootY > 0.02 && /sit/.test(seat.anim || "") && Math.abs(seat.dist - Math.hypot(...(seat.offset || [0, 0]))) < 0.05,
              `zone_05: ngồi vào ghế bàn làm việc (${seat.anim}, nâng ${Math.round(seat.rootY * 100)} cm, cách chỗ ghế ${seat.dist} m)`, JSON.stringify(seat));
          } else if (r.paused === "ending:lan") {
            ps.reloaded = true;
            await page.goto(`${base}/?debug&net=off&look=${look.id}`);   // tải lại, bỏ ?start (không dựng lại bản lưu mẫu)
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
      const st = await ev(() => ({ quests: __game.progress.quests, zone: __game.zone, outfit: __game.model.outfit ?? null, ao: __game.progress.rewards.includes("ao_cam"), complete: __game._game.complete }));
      const missing = required.filter((q) => !st.quests.includes(q));
      const con = problems.splice(0);
      const bad = [stepFail, missing.length && `chưa xong ${missing.join(", ")}`, st.outfit !== (st.ao ? null : "dau_ngay") && `áo sai (outfit=${st.outfit}, ao_cam=${st.ao})`,
        next && !st.complete && st.zone !== next && `đang ở ${st.zone}, không sang ${next}`, con.length && `console: ${con.slice(0, 5).join(" | ")}`].filter(Boolean);
      const where = st.complete ? "cảnh kết" : next ? `→ ${next}` : "";
      await check(!bad.length, `${zone}: ${required.length} việc bắt buộc, áo ${st.ao ? "ao_cam" : "dau_ngay"}, ${where}, console sạch (${Math.round((Date.now() - zt) / 1000)} s)`, bad.join("; "));
      if (zone === "zone_02" && !failed && await ev(() => __game.tu.visible)) await tuCheck("sau cổng", true);
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
        // tủ đồ (chưa có tab Wardrobe): xong game → menu Esc có hàng "FPT Orange Cap" → bật → mũ gắn vào xương đầu, vòm trên đỉnh
        // đầu (không lún, không bay), đi theo animation, vào bản lưu
        await page.keyboard.press("Escape");
        const row = await wait(() => !document.getElementById("menu").hidden && !!document.querySelector("#menu [data-acc=cap][data-on='1']"), 5000);
        if (row) await page.click("#menu [data-acc=cap][data-on='1']");
        const worn = await wait(() => window.__game?.model.accessories.includes("cap"), 15000);
        const cap = worn ? await ev(() => { const i = __game.accessoryInfo("cap"), c = __game._game.player.character;
          const root = c.root.position.y, f = i.fit;
          return { ...i, headTop: +(root + f.top).toFixed(3), saved: JSON.parse(localStorage.getItem("fville.save.v1") || "{}").player?.accessories }; }) : null;
        await page.keyboard.press("Escape");
        const con3 = problems.splice(0);
        await check(row && worn && /Head$/.test(cap?.bone || "") && cap.top > cap.headTop && cap.top < cap.headTop + 0.15 && cap.bottom < cap.headTop - 0.05
          && cap.fit.scale > 0.8 && cap.fit.scale < 2 && cap.saved?.includes("cap") && !con3.length,
          `tủ đồ: menu Esc → đội mũ lưỡi trai (xương ${cap?.bone}, tỉ lệ ${cap?.fit?.scale}, vòm cao hơn đỉnh đầu ${cap ? Math.round((cap.top - cap.headTop) * 100) : "?"} cm), lưu vào bản lưu`,
          JSON.stringify({ row, worn, cap, console: con3.slice(0, 5) }));
        // tải lại trang (không ?lang): ngôn ngữ đã chọn ở màn tạo nhân vật nằm trong cài đặt → vẫn tiếng Việt
        if (lang !== "en") {
          await page.goto(`${base}/?debug&net=off`);
          const back = await wait(() => window.__game?.state.phase === "playing", 120000);
          const r = await ev(() => ({ lang: document.documentElement.lang, title: document.title, objective: window.__game?.objective }));
          await check(back && r.lang === lang && r.title === I18N[lang].app.title && r.objective === I18N[lang].hud.objective_complete && !problems.splice(0).length,
            `tải lại trang → vẫn ${I18N[lang].lang[lang]}: "${r.title}", "${r.objective}"`, JSON.stringify(r));
        }
        break;
      }
    }
  } catch (e) {
    await check(false, `lỗi script: ${e.message.split("\n")[0]}`);
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
    await page.goto(`${base}/?debug&net=off`);
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
async function startNetServer() {
  const wr = join(ROOT, "server", "node_modules", "wrangler", "bin", "wrangler.js");
  if (!existsSync(wr)) return { skip: "chưa cài máy chủ local (npm --prefix server ci)" };
  const port = await freePort(), inspector = await freePort();
  const win = process.platform === "win32";
  const proc = spawn(process.execPath, [wr, "dev", "--port", String(port), "--ip", "127.0.0.1", "--inspector-port", String(inspector)],
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
    await page.goto(`${base}/?debug&net=${encodeURIComponent(srv.url)}&start=zone_04`);
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

// (c) bi-a 2 người (bi-a bước 3) trên máy chủ local: An, Bình mở zone_05 ở 2 trình duyệt. An ngồi → tập một mình, cú của An
// phát lại (có hoạt cảnh) ở máy Bình; Bình ngồi → ván 8 bi, An phá; Bình đánh sai lượt → máy chủ chặn; chơi trọn ván bằng
// cú tự chọn (__game.pool.autoShot) — sau mỗi cú bàn của 2 người (và người xem) giống hệt bàn máy chủ, cú phát lại khớp
// từng bit với người đánh; Cường vào xem giữa ván → thấy đúng bàn, hết ghế thì chỉ xem; hết ván → R: ván mới, người thua
// phá; Bình rớt mạng → ghế được giải phóng, An thắng; Cường ngồi vào ghế trống; máy chủ cũ (không báo "pool") → bàn chỉ
// tập một mình
async function runPoolNet(browser, base, srv) {
  const label = "bi-a 2 người";
  const pages = [];
  const open = async (name, look, gender) => {
    const save = { v: 1, created: true, player: { name, position: "developer", gender, look } };
    const p = await openPage(browser, `${label} · ${name}`, { settings: { tier: "low", detail: "auto" }, save });
    pages.push(p);
    await p.page.goto(`${base}/?debug&net=${encodeURIComponent(srv.url)}&start=zone_05`);
    p.ready = await p.wait(() => window.__game?.state.phase === "playing" && window.__game.net?.connected && !!window.__game.pool?.net?.on, 120000);
    // tắt Pointer Lock như runLook (headless: khoá / nhả chồng nhau → main.js tưởng người chơi bấm Esc → rời bàn)
    await p.ev(() => { const i = __game._game.input; i.lockSupported = false; if (document.pointerLockElement) { i._releasing = true; document.exitPointerLock(); } });
    return p;
  };
  const net = (p) => p.ev(() => __game.pool.net);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  try {
    const t1 = Date.now();
    const [A, B] = await Promise.all([open("An", "intern_nam", "nam"), open("Bình", "intern_nu", "nu")]);
    const check = A.check;
    const [a0, b0] = await Promise.all([net(A), net(B)]);
    const f0 = await A.ev(() => __game.net.features);
    await check(A.ready && B.ready && f0.includes("pool") && a0.mode === "idle" && same(a0.server, b0.server) && !A.problems.length && !B.problems.length,
      `2 trình duyệt vào zone_05, máy chủ báo features "pool", cùng một bàn (${Math.round((Date.now() - t1) / 1000)} s)`,
      JSON.stringify({ ready: [A.ready, B.ready], f0, a0: a0.mode, console: [...A.problems, ...B.problems].slice(0, 5) }));
    // An ngồi → tập một mình; cú của An phát lại ở máy Bình (có hoạt cảnh)
    await A.ev(() => __game.pool.enter());
    const solo = await A.wait(() => { const n = __game.pool.net; return n.seat === 0 && n.mode === "solo" && __game.pool.phase === "aim"; }, 10000);
    const seq0 = (await net(A)).seq;
    await A.ev(() => __game.pool.autoShot());
    const rolled = await B.wait(() => __game.pool.rolling, 10000);
    // máy Bình phát lại theo thời gian thực, mỗi khung tối đa 0,1 s: lần chạy đầu (Vite còn biên dịch) khung hình thấp → cú phá
    // ~8 s có lúc quá 20 s (từng hỏng ngẫu nhiên) → chờ 40 s
    const synced = await Promise.all([A, B].map((p) => p.wait((q) => __game.pool.net.seq === q && !__game.pool.rolling, 40000, seq0 + 1)));
    const [a1, b1] = await Promise.all([net(A), net(B)]);
    await check(solo && rolled && synced.every(Boolean) && b1.replays === 1 && b1.mismatch === 0 && same(a1.shown, b1.shown)
      && same(b1.shown, b1.server) && b1.seats.join() === "An,",
      "An ngồi → tập một mình; cú của An phát lại ở máy Bình (bi lăn rồi dừng), 2 bàn khớp bàn máy chủ",
      JSON.stringify({ solo, rolled, synced, a1: { seat: a1.seat, mode: a1.mode }, b1: { replays: b1.replays, mismatch: b1.mismatch, seats: b1.seats } }));
    // Bình ngồi → ván 8 bi, An (ngồi trước) phá
    await Promise.all([A, B].map((p) => p.ev(() => __game.pool.setFast(true))));
    await B.ev(() => __game.pool.enter());
    const started = await Promise.all([A, B].map((p) => p.wait(() => { const n = __game.pool.net; return n.mode === "match" && n.turn === 0 && n.seats.join() === "An,Bình" && n.log.some((l) => l.k === "start"); }, 10000)));
    const phases = await Promise.all([A, B].map((p) => p.ev(() => __game.pool.phase)));
    await check(started.every(Boolean) && phases[0] === "aim" && phases[1] === "watch", "Bình ngồi → ván 8 bi, xếp lại bi, An (ngồi trước) phá; Bình chờ lượt", JSON.stringify({ started, phases }));
    // Bình đánh khi chưa tới lượt: giao diện không cho; gửi thẳng → máy chủ chặn
    const seqM = (await net(A)).seq;
    const ui = await B.ev(() => __game.pool.autoShot());
    await B.ev(() => __game.pool.forceShot(Math.PI / 2, 0.8));
    const blocked = await B.wait(() => __game.pool.net.log.some((l) => l.err === "turn"), 5000);
    const aNow = await net(A);
    await check(ui === null && blocked && aNow.seq === seqM && aNow.turn === 0, "chặn cú sai lượt: giao diện không cho đánh, gửi thẳng → máy chủ từ chối, bàn không đổi",
      JSON.stringify({ ui, blocked, seq: [seqM, aNow.seq] }));
    // chơi trọn ván; Cường vào xem sau cú thứ 3
    let C = null, shots = 0, bad = null, cView = null;
    for (; shots < 150; shots++) {
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
      const r = await shooter.ev(() => __game.pool.autoShot());
      const live = [A, B, C].filter(Boolean);
      const ok = await Promise.all(live.map((p) => p.wait((q) => __game.pool.net.seq === q && !__game.pool.rolling, 20000, n.seq + 1)));
      const ns = await Promise.all(live.map(net));
      const ref = JSON.stringify(ns[0].server);
      if (!r || !ok.every(Boolean) || ns.some((x) => JSON.stringify(x.shown) !== ref || JSON.stringify(x.server) !== ref || x.mismatch)) {
        bad = { shot: shots, r, ok, ns: ns.map((x) => ({ seq: x.seq, mode: x.mode, turn: x.turn, mismatch: x.mismatch, same: JSON.stringify(x.shown) === ref })) };
        break;
      }
    }
    const [aE, bE, cE] = await Promise.all([A, B, C].map((p) => (p ? net(p) : null)));
    await check(!!cView?.ready && cView.same && cView.full && cView.seats.join() === "An,Bình",
      "Cường vào zone_05 giữa ván → thấy đúng bàn đang chơi; bấm Play pool khi hết ghế → đứng xem", JSON.stringify(cView));
    const replays = aE.replays + bE.replays + (cE?.replays ?? 0);
    await check(!bad && aE.mode === "over" && bE.winner === aE.winner && cE?.winner === aE.winner && aE.mismatch + bE.mismatch + (cE?.mismatch ?? 0) === 0,
      `chơi trọn ván: ${shots} cú, ${aE.seats[aE.winner] ?? "?"} thắng (${aE.reason}); sau mỗi cú bàn của 2 người + người xem = bàn máy chủ, ${replays} lần phát lại khớp từng bit`,
      JSON.stringify(bad || { mode: aE.mode, winner: [aE.winner, bE.winner, cE?.winner], groups: aE.groups, log: aE.log.slice(-4) }));
    // hết ván → R (người thua) → ván mới, người thua phá
    const loserSeat = 1 - aE.winner, loser = loserSeat === 0 ? A : B;
    await loser.ev(() => __game.pool.rerack());
    const re = await A.wait((s) => { const n = __game.pool.net; return n.mode === "match" && n.turn === s && n.log.filter((l) => l.k === "start").length >= 2; }, 10000, loserSeat);
    await check(re, "hết ván → R: ván mới, người thua phá", JSON.stringify(await net(A)));
    // Bình rớt mạng giữa ván → ghế giải phóng, An thắng; Cường ngồi vào ghế trống
    pages.splice(pages.indexOf(B), 1);
    await B.ctx.close();
    const freed = await A.wait(() => { const n = __game.pool.net; return n.seats[1] === null && n.mode === "solo" && n.log.some((l) => l.k === "forfeit"); }, 15000);
    const cSeesFree = await C.wait(() => __game.pool.net.seats[1] === null, 10000);
    await C.ev(() => __game.pool.join());
    const cSeat = await C.wait(() => { const n = __game.pool.net; return n.seat === 1 && n.mode === "match"; }, 10000);
    await check(freed && cSeesFree && cSeat, "Bình rớt mạng giữa ván → ghế được giải phóng, An thắng; Cường (đang xem) bấm J → ngồi, ván mới",
      JSON.stringify({ freed, cSeesFree, cSeat, a: await net(A) }));
    // An phá bằng cú đánh bi trắng thẳng vào lỗ góc đầu bàn → Cường có bi trong tay: đặt bi trắng ở khu đầu bàn rồi đánh;
    // An phát lại đúng cú đó (kể cả chỗ đặt bi trắng)
    const sq = (await net(A)).seq, errs0 = (await net(C)).log.filter((l) => l.err).length;
    const scr = await A.ev(() => {
      const p = __game._game.pool, c = p.state.balls[0], k = p.table.pockets.find((q) => q.id === "head_left");
      return __game.pool.shoot(Math.atan2(k.z - c.z, k.x - c.x), 0.6, { instant: true });
    });
    const inHand = await C.wait((q) => { const n = __game.pool.net; return n.seq === q && n.inHand && n.turn === 1 && __game.pool.phase === "place"; }, 10000, sq + 1);
    const badSpot = await C.ev(() => __game.pool.place(0, 0));                // giữa bàn: ngoài khu đầu bàn → không được
    const spot = await C.ev(() => { const t = __game._game.pool.table; return __game.pool.place(0.3, -t.rz * 0.75); });
    const cue = (await C.ev(() => __game.pool.cue));
    await C.ev(() => __game.pool.autoShot());
    const after = await Promise.all([A, C].map((p) => p.wait((q) => __game.pool.net.seq === q && !__game.pool.rolling, 20000, sq + 2)));
    const [aH, cH] = await Promise.all([A, C].map(net));
    await check(scr?.cueScratch && inHand && !badSpot && spot && Math.abs(cue.x - 0.3) < 1e-4 && after.every(Boolean) && aH.mismatch === 0
      && JSON.stringify(aH.shown) === JSON.stringify(cH.shown) && cH.log.filter((l) => l.err).length === errs0,
      "bi trắng rơi → đối thủ có bi trong tay: chỉ đặt được ở khu đầu bàn, đánh từ chỗ đặt; người kia phát lại khớp",
      JSON.stringify({ scr, inHand, badSpot, spot, cue, after, aMismatch: aH.mismatch, cLog: cH.log.slice(-3) }));
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
    await check(idle && !old.active && !old.on && old.shots === 1 && old.r && sAfter === sBefore, 'máy chủ cũ (không có features "pool") → bàn chỉ tập một mình, bàn chung không đổi',
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

const server = await startServer();
const browser = await chromium.launch({ headless: !arg("headed"), ...(chromePath ? { executablePath: chromePath } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
console.log(`smoke: ${extra === "only" ? "" : `${looks.map((l) => l.id).join(", ")} · ${onlyZone ? startZone : `${order[0]} → ${order[order.length - 1]}`} · `}${extra === "off" ? "" : "bản lưu cũ, mạng (zone 4, bi-a 2 người, chia phòng) · "}${server.mode || server.base}`);
try {
  // lần lượt từng ngoại hình (chạy song song chỉ nhanh hơn ~1 phút, và trang chạy nền không tải được ảnh thẻ)
  if (extra !== "only") for (const look of looks) await runLook(browser, server.base, look);
  if (extra !== "off") {
    await runOldSave(browser, server.base);
    // các test mạng dùng chung 1 máy chủ local; chia phòng chạy cuối (cần phòng 1 trống)
    const srv = await startNetServer();
    if (srv.skip) console.log(`– mạng: bỏ qua — ${srv.skip}`);
    else if (srv.error) { results.push({ look: "mạng", ok: false, text: "máy chủ local" }); line(false, `mạng · ${srv.error}`); }
    else {
      try {
        await runNetZone4(browser, server.base, srv);
        await runPoolNet(browser, server.base, srv);
        await runRooms(srv);
      } finally { srv.stop(); }
    }
  }
} finally {
  await browser.close();
  server.stop();
}
const bad = results.filter((r) => !r.ok).length;
const sec = Math.round((Date.now() - t0) / 1000), dur = sec >= 60 ? `${Math.floor(sec / 60)} phút ${sec % 60} giây` : `${sec} giây`;
console.log(bad ? `✗ smoke: ${bad} / ${results.length} bước hỏng (${dur})` : `✓ smoke: ${results.length} bước đạt, ${extra === "only" ? 0 : looks.length} ngoại hình${extra === "off" ? "" : " + bản lưu cũ, mạng (zone 4, bi-a 2 người, chia phòng)"} (${dur})`);
process.exit(bad ? 1 : 0);
