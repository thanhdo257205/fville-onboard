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
//
//   npm run test:smoke                       3 ngoại hình (roles.player.looks), zone 0 → 5, server Vite dev tự bật
//   npm run test:smoke -- --zone 5           chỉ zone 5 (bản lưu mẫu ?start=zone_05 dựng từ data)
//   npm run test:smoke -- --look intern_nu   1 ngoại hình (CI: --look intern_nam)
//   npm run test:smoke -- --build            chạy trên bản build (game/dist, vite preview) — sau npm run build
//   npm run test:smoke -- --url http://localhost:5180   server đang chạy sẵn
//   --headed: mở cửa sổ trình duyệt · --verbose: in thêm chi tiết từng bước
// In gọn: mỗi bước 1 dòng ✓/✗, cuối cùng 1 dòng tổng kết + thời gian. Ảnh chụp chỉ khi bước hỏng: test-results/ (không commit).
import { spawn } from "node:child_process";
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
const zoneIsLast = (z) => z === order[order.length - 1];
// tên có dấu tiếng Việt để thử tên file ảnh thẻ
const NAMES = { intern_nam: ["Đỗ Minh Khôi", "do-minh-khoi"], intern_nam_kinh: ["Trần Đức Anh", "tran-duc-anh"], intern_nu: ["Nguyễn Thị Hà", "nguyen-thi-ha"] };
// Tú khác giới với người chơi (roles.tu): model, bộ đồ trước cổng, chân dung theo bộ đồ, câu dẫn trên xe bus
const tuOf = (look) => {
  const r = chars.roles.tu, id = r.model_by_gender?.[look.gender] ?? r.model, m = chars.models[id];
  const tex = r.outfit?.texture_by_model?.[id] ?? r.outfit?.texture ?? null;
  const female = m.gender === "female";
  return { id, tex, female, portrait: m.outfit_portraits?.[tex] ?? m.portrait, portraitCam: m.portrait,
    bus: `Tú drops ${female ? "her" : "his"} backpack on the seat beside ${female ? "her" : "him"}` };
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

async function runLook(browser, base, look) {
  const pick = PICK[looks.indexOf(look) % PICK.length];
  // màn chọn 3D cần khung ≥ 700 px; vào game rồi thu về 640 × 360 như trước (nhanh hơn trên swiftshader)
  const ctx = await browser.newContext({ viewport: pick === "cards" ? { width: 640, height: 360 } : { width: 1000, height: 640 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];   // lỗi / cảnh báo console chưa báo
  const ignore = [/\[vite\]/, /Download the React DevTools/];
  page.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !ignore.some((r) => r.test(m.text()))) problems.push(`[${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`[pageerror] ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`); });
  // ERR_ABORTED = trình duyệt huỷ request khi chuyển trang (bước tải lại giữa cảnh kết), không phải lỗi game
  page.on("requestfailed", (r) => { const err = r.failure()?.errorText || ""; if (!/favicon/.test(r.url()) && !/ERR_ABORTED/.test(err)) problems.push(`[request failed] ${r.url()} ${err}`); });
  const ev = (fn, a) => page.evaluate(fn, a);
  const [name, slug] = NAMES[look.id] || ["Test Intern", "test-intern"];
  let failed = false;
  const check = async (ok, text, extra = "") => {
    results.push({ look: look.id, ok, text });
    line(ok, `${look.id} · ${text}${extra && (verbose || !ok) ? ` — ${extra}` : ""}`);
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
    cr.shirtOn = await ev(() => [__creator.shirt, document.querySelector("#creator .shirt").getAttribute("aria-pressed"), document.querySelector("#creator .info .portrait").src.split("/").pop()]);
    await page.click("#creator .info .shirt");
    cr.shirtOff = await ev(() => [__creator.shirt, document.querySelector("#creator .info .portrait").src.split("/").pop()]);
    // ảnh chân dung (thẻ thông tin + thẻ ảnh) tải được thật — server dev trả index.html cho file không cho phép (mã 200)
    cr.imgs = await ev(async () => { const im = [...document.querySelectorAll("#creator img")]; await Promise.all(im.map((i) => i.decode().catch(() => null)));
      return im.filter((i) => !i.naturalWidth).map((i) => i.src.split("/").pop()); });
    await page.fill("#creator input[name=name]", name);
    await page.keyboard.press("Enter");                 // Enter trong ô tên = Start my first day
    const booted = await wait(() => window.__game?.state.phase === "playing", 120000);
    if (booted) await noLock();
    cr.disposed = await ev(() => !!window.__creator?.disposed && !document.getElementById("creator"));
    if (pick !== "cards") await page.setViewportSize({ width: 640, height: 360 });
    const wantMode = pick === "cards" ? "cards" : "3d";
    const crOk = cr.mode === wantMode && (wantMode === "cards" || cr.ready) && cr.selected === look.id && cr.shirtOn[0] && cr.shirtOn[1] === "true"
      && /_portrait\.png$/.test(cr.shirtOn[2]) && !cr.shirtOff[0] && /_portrait_dau_ngay\.png$/.test(cr.shirtOff[1]) && !cr.imgs.length && cr.disposed;
    await check(crOk, `màn chọn nhân vật (${wantMode === "3d" ? `3D, ${pick === "keys" ? "phím ←/→" : "bấm chuột"}` : "thẻ ảnh, màn hẹp"}): chọn ${look.id}, xem trước áo FPT, giải phóng cảnh 3D`, JSON.stringify(cr));
    const m = booted ? await ev(() => __game.model) : null;
    if (!await check(booted && m.id === look.id && m.look === look.id && m.gender === look.gender, `${startZone}: vào game "${name}", model ${look.id}${onlyZone ? `, bản lưu mẫu ?start=${startZone}` : ""}`, JSON.stringify(m))) return;
    // Tú (zone có Tú): đúng model khác giới, áo ngày đầu, chân dung theo bộ đồ, câu dẫn he / she
    const tu = tuOf(look);
    const tuCheck = async (when, cam) => {
      const x = await ev(async () => { const t = __game.tu;
        return { ...t, bus: __game.textOf("tu_bus_ride", "n2"), img: await fetch(t.portrait).then((r) => r.headers.get("content-type"), () => null) }; });
      const ok = x.img?.startsWith("image/png") && x.id === tu.id && x.built === tu.id && x.gender !== chars.models[look.id].gender && x.outfit === (cam ? null : tu.tex)
        && x.portrait === (cam ? tu.portraitCam : tu.portrait) && x.bus?.startsWith(tu.bus) && x.he === (tu.female ? "she" : "he");
      await check(ok, `Tú ${when}: ${tu.id} (${tu.female ? "nữ" : "nam"}), áo ${cam ? "ao_cam" : tu.tex}, chân dung ${(cam ? tu.portraitCam : tu.portrait).split("/").pop()}, "${tu.bus}…"`, JSON.stringify(x));
    };
    if (startZone === order[0]) await tuCheck("trước cổng", false);

    const pauses = (st) => zoneIsLast(st.zone) ? [...(st.lunch ? [] : ["time_skip"]), ...(st.login ? [] : ["login"]), ...(st.reloaded || look !== looks[0] ? [] : ["ending:lan"])] : [];
    for (let zi = order.indexOf(startZone); zi < order.length && !failed; zi++) {
      const zone = order[zi], next = order[zi + 1], zt = Date.now();
      const required = await ev((z) => __game._game.content.quests.filter((q) => q.zone === z && q.required).map((q) => q.id), zone);
      const ps = { zone, lunch: false, login: false, reloaded: false };
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
          } else if (r.paused === "ending:lan") {
            ps.reloaded = true;
            await page.goto(`${base}/?debug&net=off&look=${look.id}`);   // tải lại, bỏ ?start (không dựng lại bản lưu mẫu)
            const back = await wait(() => window.__game?.state.phase === "playing", 120000);
            if (back) await noLock();
            const sum = back && await wait(() => window.__game?.summary.open, 15000);
            const z = await ev(() => ({ zone: window.__game?.zone, ach: !!window.__game?.summary.text?.includes("Welcome to the F-Ville Family") }));
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
        } catch (e) { dl = { error: e.message.split("\n")[0] }; }
        await check(open && s.text.includes("Welcome to the F-Ville Family") && s.zone === "zone_01" && s.seen && dl.name === `fville-first-day-${slug}.png` && dl.size > 50000,
          `màn tổng kết: thành tựu, summary_seen, ảnh thẻ ${dl.name || "?"} (${Math.round((dl.size || 0) / 1024)} KB)`, JSON.stringify({ open, zone: s.zone, seen: s.seen, dl }));
        await page.click("#summary [data-a=close]");
        await page.keyboard.press("Escape");
        const menu = await wait(() => !document.getElementById("menu").hidden && !!document.querySelector("#menu [data-act=summary]"), 5000);
        if (menu) await page.click("#menu [data-act=summary]");
        const again = await wait(() => window.__game?.summary.open, 5000);
        await page.keyboard.press("Escape");
        const closed = await wait(() => !window.__game?.summary.open, 5000);
        const con2 = problems.splice(0);
        await check(menu && again && closed && !con2.length, "màn tổng kết: Close → menu Esc → View summary mở lại, console sạch", JSON.stringify({ menu, again, closed, console: con2.slice(0, 5) }));
        break;
      }
    }
  } catch (e) {
    await check(false, `lỗi script: ${e.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

const server = await startServer();
const browser = await chromium.launch({ headless: !arg("headed"), ...(chromePath ? { executablePath: chromePath } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
console.log(`smoke: ${looks.map((l) => l.id).join(", ")} · ${onlyZone ? startZone : `${order[0]} → ${order[order.length - 1]}`} · ${server.mode || server.base}`);
try {
  // lần lượt từng ngoại hình (chạy song song chỉ nhanh hơn ~1 phút, và trang chạy nền không tải được ảnh thẻ)
  for (const look of looks) await runLook(browser, server.base, look);
} finally {
  await browser.close();
  server.stop();
}
const bad = results.filter((r) => !r.ok).length;
const sec = Math.round((Date.now() - t0) / 1000), dur = sec >= 60 ? `${Math.floor(sec / 60)} phút ${sec % 60} giây` : `${sec} giây`;
console.log(bad ? `✗ smoke: ${bad} / ${results.length} bước hỏng (${dur})` : `✓ smoke: ${results.length} bước đạt, ${looks.length} ngoại hình (${dur})`);
process.exit(bad ? 1 : 0);
