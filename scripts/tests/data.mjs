// npm run test:data (trong game/) — kiểm tra dữ liệu không cần trình duyệt, chạy dưới 1 giây:
//   1. mọi data/*.json, data/i18n/*.json là JSON hợp lệ
//   2. tham chiếu nội bộ (content.validateLinks — cùng hàm game chạy khi mở): hội thoại, quest, phần thưởng, mini-game…
//   3. node GLB mà data nhắc tới có trong GLB bối cảnh (đọc khối JSON của assets/glb/low/*.glb)
//   4. bản lưu mẫu ?start=zone_0X dựng được từ data cho mọi zone (game/autoplay.js → buildStartState)
//   5. chữ giao diện t("…") viết sẵn trong code có trong data/i18n/en.json; model nhân vật mà vai dùng có GLB + chân dung
//      (+ chân dung theo bộ đồ, texture bộ đồ của vai, tên / mô tả ngoại hình ở màn chọn nhân vật)
//   6. Tú khác giới với người chơi; không còn he/his/him/she/her viết cứng nhắc tới Tú, biến {tu_*} thay được cho cả 2 giới
// In 1 dòng ✓/✗ cho mỗi mục; lỗi → in chi tiết, thoát mã 1.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { FILES, buildContent, validateLinks, nodeRefs } from "../../game/src/content/content.js";
import { setStrings, setTextVars, tuPronouns, fill, TU_VARS } from "../../game/src/i18n.js";
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
  for (const [k, p] of Object.entries(m.outfit_portraits || {})) if (!existsSync(join(ROOT, p))) modelErrs.push(`models.${id}: thiếu chân dung bộ ${k} (${p})`);
}
// bộ đồ theo vai: texture (chung hoặc theo model) phải có trong models.<id>.outfit_textures của model vai đó dùng
for (const [k, r] of Object.entries(chars.roles)) {
  if (k.startsWith("_") || !r.outfit) continue;
  const ids = [r.model, ...Object.values(r.model_by_gender || {}), ...Object.values(r.looks || {}).flat()].filter(Boolean);
  for (const id of new Set(ids)) {
    const tex = r.outfit.texture_by_model?.[id] ?? r.outfit.texture;
    if (tex && !chars.models[id]?.outfit_textures?.[tex]) modelErrs.push(`roles.${k}.outfit: model ${id} không có bộ ${tex}`);
  }
}
// màn chọn nhân vật: mỗi ngoại hình trong roles.player.looks có tên + mô tả, và ngược lại
const lookIds = Object.values(chars.roles.player.looks || {}).flat(), cc = chars.character_creation?.looks || [];
for (const id of lookIds) { const l = cc.find((x) => x.id === id); if (!l?.name?.en || !l?.desc?.en) modelErrs.push(`character_creation.looks: thiếu tên / mô tả của ${id}`); }
for (const l of cc) if (!lookIds.includes(l.id)) modelErrs.push(`character_creation.looks: ${l.id} không có trong roles.player.looks`);
report("model nhân vật", modelErrs, `${used.size} model, ${cc.length} ngoại hình`);

// 6. Tú: khác giới với người chơi; đại từ của Tú trong chữ là biến {tu_he}/{tu_his}/{tu_him}/{tu_himself} (+ viết hoa
//    {Tu_he}…), không viết cứng he/his/him/she/her. "Nhắc tới Tú" = tên đứng gần nhất trước đại từ là Tú; câu dẫn
//    (narrator) không có tên nào → xét người nói ở nút hội thoại liền trước (Tú vừa nói → câu dẫn nói về Tú).
const tuErrs = [];
const tuRole = chars.roles.tu;
for (const [g, ids] of Object.entries(chars.roles.player.looks || {})) {
  const tuId = tuRole.model_by_gender?.[g] ?? tuRole.model, tuG = chars.models[tuId]?.gender;
  for (const id of ids) if (!tuG || tuG === chars.models[id]?.gender) tuErrs.push(`người chơi ${id} (${g}) → Tú = ${tuId} (${tuG}): phải khác giới`);
}
const PRON = /\b(he|his|him|himself|she|her|hers|herself)\b/gi;
const NAMES = [...new Set(Object.values(chars.names?.en || {}).map((n) => n.split(/\s+/).pop()).filter((n) => /^\p{Lu}/u.test(n)))];
const nameRe = new RegExp(`(${NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}])`, "gu");
const aboutTu = (s) => [...s.matchAll(PRON)].some((p) => {
  const before = [...s.slice(0, p.index).matchAll(nameRe)].pop();
  return before?.[1] === "Tú";
});
const lastName = (s) => [...s.matchAll(nameRe)].pop()?.[1];
const strings = [];   // [nơi, chữ en, nút hội thoại?]
const collect = (o, where) => {
  if (typeof o === "string") strings.push([where, o]);
  else if (Array.isArray(o)) o.forEach((v, i) => collect(v, `${where}[${i}]`));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (!k.startsWith("_") && k !== "id") collect(k === "en" ? v : v, `${where}.${k}`);
};
for (const [f, d] of Object.entries(json)) if (!f.endsWith("characters.json") && !f.endsWith("net.json")) collect(d, f.replace("data/", ""));
for (const [where, s] of strings) if (aboutTu(s)) tuErrs.push(`${where}: "${s.slice(0, 90)}" — đại từ cứng nhắc tới Tú, dùng {tu_he}/{tu_his}/{tu_him}`);
// câu dẫn không tên ngay sau lời của Tú
for (const dlg of D("dialogues").dialogues) {
  const prev = {};
  for (const [id, n] of Object.entries(dlg.nodes)) for (const nx of [n.next, ...(n.choices || []).map((c) => c.next)].filter(Boolean)) (prev[nx] ||= []).push(n);
  for (const [id, n] of Object.entries(dlg.nodes)) {
    const s = n.text?.en;
    if (n.speaker !== "narrator" || !s || lastName(s) || !s.match(PRON)) continue;
    if ((prev[id] || []).some((p) => p.speaker === "tu")) tuErrs.push(`dialogues ${dlg.id}.${id}: "${s.slice(0, 90)}" — câu dẫn sau lời của Tú dùng đại từ cứng`);
  }
}
// biến {tu_*}: đúng tên, thay được cho cả 2 giới
const used2 = strings.filter(([, s]) => /\{[Tt]u_/.test(s));
for (const [where, s] of used2) for (const m of s.matchAll(/\{([Tt]u_\w+)\}/g)) if (!TU_VARS.includes(m[1])) tuErrs.push(`${where}: biến lạ {${m[1]}} (có: ${TU_VARS.join(", ")})`);
const outs = {};
for (const g of ["male", "female"]) {
  setTextVars(tuPronouns(g));
  outs[g] = used2.map(([where, s]) => [where, fill(s, { player: "Alex" })]);
  for (const [where, s] of outs[g]) if (/\{[Tt]u_/.test(s)) tuErrs.push(`${where} (${g}): còn biến chưa thay — "${s.slice(0, 90)}"`);
}
const sample = outs.female.find(([w]) => w.includes("dialogues"))?.[1];
report("đại từ của Tú", tuErrs, `${used2.length} câu dùng {tu_*}${sample ? `; nữ: "${sample.slice(0, 60)}…"` : ""}`);

const ms = Math.round(performance.now() - t0);
console.log(failed ? `✗ test:data: ${failed} mục lỗi (${ms} ms)` : `✓ test:data: đạt hết (${ms} ms)`);
process.exit(failed ? 1 : 0);
