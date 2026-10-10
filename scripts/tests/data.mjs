// npm run test:data (trong game/) — kiểm tra dữ liệu không cần trình duyệt, chạy dưới 1 giây:
//   1. mọi data/*.json, data/i18n/*.json là JSON hợp lệ
//   2. tham chiếu nội bộ (content.validateLinks — cùng hàm game chạy khi mở): hội thoại, quest, phần thưởng, mini-game…
//   3. node GLB mà data nhắc tới có trong GLB bối cảnh (đọc khối JSON của assets/glb/low/*.glb)
//   4. bản lưu mẫu ?start=zone_0X dựng được từ data cho mọi zone (game/autoplay.js → buildStartState)
//   5. chữ giao diện t("…") viết sẵn trong code có trong data/i18n/en.json; model nhân vật mà vai dùng có GLB + chân dung
// In 1 dòng ✓/✗ cho mỗi mục; lỗi → in chi tiết, thoát mã 1.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { FILES, buildContent, validateLinks, nodeRefs } from "../../game/src/content/content.js";
import { setStrings } from "../../game/src/i18n.js";
import { GameState } from "../../game/src/game/state.js";
import { buildStartState } from "../../game/src/game/autoplay.js";

const t0 = performance.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rel = (p) => relative(ROOT, p).replaceAll("\\", "/");
let failed = 0;
const report = (name, errs, extra = "") => {
  if (errs.length) { failed++; console.log(`✗ ${name} (${errs.length})`); for (const e of errs.slice(0, 40)) console.log(`    ${e}`); if (errs.length > 40) console.log(`    … và ${errs.length - 40} lỗi nữa`); }
  else console.log(`✓ ${name}${extra ? ` — ${extra}` : ""}`);
};

// 1. JSON hợp lệ
const json = {}, jsonErrs = [];
const dataFiles = [join(ROOT, "data"), join(ROOT, "data", "i18n")].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => join(d, f)));
for (const f of dataFiles) {
  try { json[rel(f)] = JSON.parse(readFileSync(f, "utf8")); } catch (e) { jsonErrs.push(`${rel(f)}: ${e.message}`); }
}
report("JSON hợp lệ", jsonErrs, `${dataFiles.length} file`);
if (jsonErrs.length) { console.log(`✗ dừng: JSON hỏng (${Math.round(performance.now() - t0)} ms)`); process.exit(1); }

const D = (name) => json[`data/${name}.json`];
const en = json["data/i18n/en.json"];
setStrings(en, "en");
const zones = D("zones"), chars = D("characters");
const content = buildContent(Object.fromEntries(FILES.map((f) => [f, D(f)])));
content.zoneOrder = zones.order;
content.names = (role) => chars.names?.en?.[role] ?? role;

// 2. tham chiếu nội bộ
report("tham chiếu nội bộ (validateLinks)", validateLinks(content), `${content.dialogues.size} hội thoại, ${content.quests.length} quest`);

// 3. node GLB
const glbNames = (file) => {
  const buf = readFileSync(file);
  const len = buf.readUInt32LE(12);
  return new Set((JSON.parse(buf.subarray(20, 20 + len).toString("utf8")).nodes || []).map((n) => n.name).filter(Boolean));
};
const nodeErrs = [], names = {};
for (const z of zones.order) {
  const f = join(ROOT, "assets", "glb", "low", `${zones.zones[z].file}.glb`);
  if (!existsSync(f)) { nodeErrs.push(`${z}: thiếu ${rel(f)}`); continue; }
  names[z] = glbNames(f);
}
const refs = nodeRefs(content).filter((r) => names[r.zone]);
for (const r of refs) if (!names[r.zone].has(r.node)) nodeErrs.push(`${r.zone}: thiếu ${r.node} (${r.where})`);
report("node GLB", nodeErrs, `${refs.length} tham chiếu, ${Object.keys(names).length} zone`);

// 4. bản lưu mẫu cho từng zone
const startErrs = [];
for (const z of zones.order.slice(1)) {
  const s = new GameState(content);
  const { problems } = buildStartState(content, zones, z, s);
  startErrs.push(...problems);
  const before = zones.order.slice(0, zones.order.indexOf(z));
  for (const q of content.quests) if (q.required && before.includes(q.zone) && !s.quests.has(q.id)) startErrs.push(`${z}: thiếu quest ${q.id}`);
}
report("bản lưu mẫu ?start=zone_0X", startErrs, `${zones.order.length - 1} zone`);

// 5a. chữ t("khoá") viết sẵn trong code
const i18nErrs = [];
const has = (key) => key.split(".").reduce((o, k) => (o == null ? o : o[k]), en) !== undefined;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });
let keys = 0;
for (const f of walk(join(ROOT, "game", "src"))) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*"([a-z0-9_]+(?:\.[a-z0-9_]+)+)"/g)) { keys++; if (!has(m[1])) i18nErrs.push(`${rel(f)}: thiếu chữ "${m[1]}" trong data/i18n/en.json`); }
}
report("chữ giao diện (i18n)", [...new Set(i18nErrs)], `${keys} lần gọi t("…")`);

// 5b. model của các vai: có trong models, GLB thấp + chân dung có trên đĩa
const modelErrs = [];
const used = new Set();
for (const [k, r] of Object.entries(chars.roles)) {
  if (k.startsWith("_")) continue;
  for (const id of [r.model, ...Object.values(r.model_by_gender || {}), ...Object.values(r.looks || {}).flat()]) if (id) used.add(id);
}
for (const id of used) {
  const m = chars.models[id];
  if (!m) { modelErrs.push(`characters.json: vai dùng model ${id} nhưng models.${id} không có`); continue; }
  if (m.consent_pending) continue;
  const glb = m.glb?.low ?? m.glb?.high;
  if (!glb || !existsSync(join(ROOT, glb))) modelErrs.push(`models.${id}: thiếu GLB ${glb}`);
  if (m.portrait && !existsSync(join(ROOT, m.portrait))) modelErrs.push(`models.${id}: thiếu chân dung ${m.portrait}`);
  for (const [k, p] of Object.entries(m.outfit_textures || {})) if (!existsSync(join(ROOT, p))) modelErrs.push(`models.${id}: thiếu texture bộ đồ ${k} (${p})`);
}
report("model nhân vật", modelErrs, `${used.size} model`);

const ms = Math.round(performance.now() - t0);
console.log(failed ? `✗ test:data: ${failed} mục lỗi (${ms} ms)` : `✓ test:data: đạt hết (${ms} ms)`);
process.exit(failed ? 1 : 0);
