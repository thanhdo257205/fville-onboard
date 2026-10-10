// Vite: game đọc GLB và JSON trực tiếp từ thư mục gốc dự án (assets/, data/) — không chép trùng.
// Dev: middleware phục vụ /assets/... và /data/... từ thư mục gốc. Build: chép đúng các file cần vào dist/.
// Nhân vật Prajith, Huyền đã được duyệt: GLB nhân vật được phép đóng gói; KHÔNG bao giờ chép FBX Mixamo, .blend, source/,
// và không chép model còn chờ người thật đồng ý (models.<id>.consent_pending; hiện không model nào dùng).
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, resolve, sep } from "node:path";
import { createReadStream, existsSync, statSync, readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { TIERS } from "./src/core/quality.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SHARED = ["/assets/glb/", "/assets/characters/", "/assets/accessories/", "/data/"];
const TYPES = { ".glb": "model/gltf-binary", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

// model chờ người thật đồng ý (data/characters.json → models.<id>.consent_pending): không bao giờ vào bản build
function pendingModels() {      // JSON lỗi → build dừng (không lặng lẽ chép hết)
  const cfg = JSON.parse(readFileSync(join(ROOT, "data", "characters.json"), "utf-8"));
  return new Set(Object.entries(cfg.models || {}).filter(([, m]) => m.consent_pending).map(([id]) => id));
}

// chỉ các file game dùng (không .raw.glb, .fbx, .blend, ảnh nguồn…); build: bỏ cả model chờ đồng ý
function wanted(rel, pending = new Set()) {
  // GLB zone: chỉ các mức đồ hoạ đang dùng (bản Cao tạm dừng → không chép assets/glb/high/, GLB cũ lệch data)
  if (rel.startsWith("assets/glb/")) return TIERS.some((t) => rel.startsWith(`assets/glb/${t}/`)) && rel.endsWith(".glb") && !rel.endsWith(".raw.glb");
  if (rel.startsWith("assets/characters/")) {
    const parts = rel.split("/");             // assets/characters/<id>/<id>.glb hoặc <id>_6k.glb (bản nhẹ)
    if (pending.has(parts[2])) return false;
    const name = parts[3] || "";
    // chân dung hộp thoại: <id>_portrait.png, theo bộ đồ <id>_portrait_<bộ>.png (models.<id>.outfit_portraits)
    if (parts.length === 4 && (name === `${parts[2]}_portrait.png` || /^.+_portrait_[a-z0-9_]+\.png$/.test(name) && name.startsWith(`${parts[2]}_`))) return true;
    if (parts.length === 4 && name.startsWith(`${parts[2]}_`) && name.endsWith(".webp")) return true;   // texture bộ đồ
    return parts.length === 4 && name.endsWith(".glb") && !name.endsWith(".raw.glb")
      && (name === `${parts[2]}.glb` || /^.+_\d+k\.glb$/.test(name));
  }
  // phụ kiện (tủ đồ): chỉ assets/accessories/<id>/<id>.glb (không source/, .raw.glb, số đo .json)
  if (rel.startsWith("assets/accessories/")) { const p = rel.split("/"); return p.length === 4 && p[3] === `${p[2]}.glb`; }
  if (rel.startsWith("data/")) return rel.endsWith(".json");
  return false;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

function sharedAssets() {
  let outDir = "dist";
  return {
    name: "shared-assets",
    configResolved(c) { outDir = c.build.outDir; },
    configureServer(server) {
      // CHỈ khi chạy dev: __game.saveImage() gửi ảnh (data URL) về đây → renders/game/<tên> (để kiểm tra khi khung trình duyệt bị ẩn)
      server.middlewares.use("/__dev/save", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
        let body = "";
        req.on("data", (c) => { body += c; if (body.length > 8e6) req.destroy(); });
        req.on("end", () => {
          try {
            const { name, data } = JSON.parse(body);
            if (!/^[a-z0-9_.-]+\.(jpg|png)$/i.test(name)) throw new Error("tên file không hợp lệ");
            const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(data);
            if (!m) throw new Error("không phải ảnh");
            const dir = resolve(ROOT, "renders", "game");
            mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, name), Buffer.from(m[2], "base64"));
            res.end(JSON.stringify({ ok: true, path: `renders/game/${name}` }));
          } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: e.message })); }
        });
      });
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || "").split("?")[0]);
        if (!SHARED.some((p) => url.startsWith(p))) return next();
        const file = resolve(ROOT, "." + url);
        const rel = file.slice(ROOT.length + 1).split(sep).join("/");
        if (!file.startsWith(ROOT + sep) || !wanted(rel) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", TYPES[extname(file)] || "application/octet-stream");
        res.setHeader("Cache-Control", "no-cache");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      let n = 0;
      const pending = pendingModels();
      for (const top of ["assets/glb", "assets/characters", "assets/accessories", "data"]) {
        const dir = join(ROOT, top);
        if (!existsSync(dir)) continue;
        for (const f of walk(dir)) {
          const rel = f.slice(ROOT.length + 1).split(sep).join("/");
          if (!wanted(rel, pending)) continue;
          const dst = resolve(HERE, outDir, rel);
          mkdirSync(dirname(dst), { recursive: true });
          copyFileSync(f, dst);
          n++;
        }
      }
      console.log(`shared-assets: chép ${n} file (GLB zone, GLB nhân vật, phụ kiện, JSON) vào ${outDir}/`
        + (pending.size ? `; bỏ model chờ đồng ý: ${[...pending].join(", ")}` : ""));
    },
  };
}

// mã phiên bản bản build: commit + thời điểm build → core/fetch.js gắn ?v=<mã> vào data/*.json, GLB, ảnh nhân vật, để sau
// mỗi lần deploy trình duyệt không dùng file cũ còn trong bộ nhớ đệm (dev: rỗng, không gắn)
function buildId() {
  if (process.env.FVILLE_BUILD_ID) return process.env.FVILLE_BUILD_ID;
  let commit = "nogit";
  try { commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* không có git */ }
  return `${commit}-${Date.now().toString(36)}`;
}

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [sharedAssets()],
  server: { port: 5180, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  define: { __BUILD_ID__: JSON.stringify(command === "build" ? buildId() : "") },
}));
