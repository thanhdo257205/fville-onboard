// Dò ứng viên chỗ ngồi ở mọi zone (game/src/world/seats.js qua __game.findSeats()) — dùng khi thêm / build lại zone, rồi xem
// lại và chép vào data/seats.json (game chỉ đọc file đó). Không cần Blender: bật Vite dev, mở từng zone bằng ?start=…, in JSON.
//   node scripts/tools/find_seats.mjs [--zones zone_03,zone_05] [--out renders/seats.json] [--url http://127.0.0.1:5180]
// Mỗi ứng viên: at (glTF, y = sàn), h (mặt ngồi trên sàn), yaw_deg (0 = nhìn −Z), facing (back = có lưng ghế | table | open),
// reach (đứng được trước ghế), meshes (lưới chứa mặt ghế), npc (NPC_ ngồi sẵn trong 0,6 m).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GAME = join(ROOT, "game");
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? null : process.argv[i + 1]; };
const req = createRequire(join(GAME, "package.json"));
let pw;
for (const id of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { pw = req(id); break; } catch { /* thử chỗ khác */ } }
if (!pw) { console.error("✗ không có playwright (npm --prefix game ci)"); process.exit(2); }

async function server() {
  if (arg("url")) return { base: arg("url").replace(/\/$/, ""), stop: () => {} };
  const port = 5190 + Math.floor(Math.random() * 50);
  const proc = spawn(process.execPath, [join(GAME, "node_modules", "vite", "bin", "vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: GAME, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(base)).ok) return { base, stop: () => proc.kill() }; } catch { /* chưa lên */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error("không bật được Vite");
}

const zones = (arg("zones") || "zone_00,zone_01,zone_02,zone_03,zone_04,zone_05").split(",");
const srv = await server();
const browser = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const out = {};
try {
  for (const z of zones) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.goto(`${srv.base}/?start=${z}&title=off&net=off&lang=en`);
    await page.waitForSelector("#creator input[name=name]", { timeout: 90000 });
    await page.fill("#creator input[name=name]", "Seat");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__game?.state.phase === "playing", null, { timeout: 120000 });
    out[z] = await page.evaluate(() => {
      const seats = __game.findSeats();
      const npcs = __game._game.npcs.filter((n) => n.pose === "seated").map((n) => n.character.root.position);
      for (const s of seats) {
        const n = npcs.find((p) => Math.hypot(p.x - s.at[0], p.z - s.at[2]) < 0.6);
        if (n) s.npc = true;
      }
      return seats;
    });
    console.log(`${z}: ${out[z].length} ứng viên (${out[z].filter((s) => s.facing === "back").length} có lưng ghế, ${out[z].filter((s) => s.reach != null).length} có chỗ đứng trong 1,2 m)`);
    await page.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
const file = arg("out");
if (file) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(out, null, 1)); console.log(`→ ${file}`); }
else console.log(JSON.stringify(out));
