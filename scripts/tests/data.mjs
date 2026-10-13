// npm run test:data (trong game/) — kiểm tra dữ liệu không cần trình duyệt, chạy dưới 1 giây:
//   1. mọi data/*.json, data/i18n/*.json là JSON hợp lệ
//   2. tham chiếu nội bộ (content.validateLinks — cùng hàm game chạy khi mở): hội thoại, quest, phần thưởng, mini-game…
//   3. node GLB mà data nhắc tới (+ zones.json → start của mọi zone) có trong GLB bối cảnh (đọc khối JSON của assets/glb/low/*.glb)
//   4. bản lưu mẫu ?start=zone_0X dựng được từ data cho mọi zone (game/autoplay.js → buildStartState); bản lưu cũ lệch data
//      (scripts/tests/fixtures/old_save.json) được GameState.repair() sửa về giá trị hợp lệ, sửa lần 2 không còn gì
//   5. chữ giao diện t("…") viết sẵn trong code có trong data/i18n/en.json; model nhân vật mà vai dùng có GLB + chân dung
//      (+ chân dung theo bộ đồ, texture bộ đồ của vai, tên / mô tả ngoại hình ở màn chọn nhân vật)
//   6. Tú khác giới với người chơi; không còn he/his/him/she/her viết cứng nhắc tới Tú, biến {tu_*} thay được cho cả 2 giới
//   7. bản tiếng Việt: mọi chữ { "en" } có "vi", vi.json cùng khoá en.json, biến {…} khớp, không sót chữ chưa dịch
//   8. âm thanh (data/sounds.json): mỗi bản có file assets/sfx/<id>[_n].mp3, không có file thừa, gói nguồn giấy phép CC0 có bản
//      giấy phép trong assets/sfx/licenses/, mọi file có trong docs/audio_credits.md; tên trong sound.play("…") của code, "sfx"
//      của câu thoại, zones.json → audio (tiếng nền, mặt đất) đều có thật; dung lượng trong ngân sách
//   9. bầu trời + phông nền xa (data/backdrop.json, game/src/render/sky.js): màu trời mặc định, sương, các lớp (có núi Ba Vì),
//      mood nào có màu trời thì có đủ sky_top + sky_horizon (mọi zone + variants); dựng thật bằng sky.js: ≤ 5.000 tam giác
// In 1 dòng ✓/✗ cho mỗi mục; lỗi → in chi tiết, thoát mã 1.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { FILES, buildContent, validateLinks, nodeRefs, tx } from "../../game/src/content/content.js";
import { setStrings, setTextVars, tuPronouns, fill, TU_VARS } from "../../game/src/i18n.js";
import { GameState } from "../../game/src/game/state.js";
import { buildStartState } from "../../game/src/game/autoplay.js";
import { AMBIENCES } from "../../game/src/core/ambience.js";
import { makeFilter, cleanText } from "../../game/src/net/chatfilter.js";
import * as THREE from "../../game/node_modules/three/build/three.module.js";
import { Sky } from "../../game/src/render/sky.js";

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
for (const z of zones.order) if (names[z] && zones.zones[z].start && !names[z].has(zones.zones[z].start)) nodeErrs.push(`${z}: thiếu ${zones.zones[z].start} (zones.json · start)`);
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

// 4b. bản lưu cũ lệch data (scripts/tests/fixtures/old_save.json, ẩn danh) → repair() sửa về giá trị hợp lệ gần nhất,
// sửa lần 2 không còn gì (main.js gọi repair() mỗi lần nạp bản lưu)
const repairErrs = [];
{
  const old = JSON.parse(readFileSync(join(ROOT, "scripts", "tests", "fixtures", "old_save.json"), "utf8")).save;
  const ctx = { zoneOrder: zones.order, looks: chars.roles.player.looks, positions: chars.character_creation.positions.map((x) => x.id) };
  const s = new GameState(content);
  s.fromJSON(old);
  const fixed = s.repair(ctx);
  const o = s.toJSON();
  const expect = (ok, what) => { if (!ok) repairErrs.push(`${what} — ${JSON.stringify(o).slice(0, 200)}`); };
  expect(o.zone === "zone_04", `zone ${old.zone} → zone_04 (đã xong zone 0–3)`);
  expect(o.player.gender === "nam" && o.player.look === null && o.player.position === ctx.positions[0], "người chơi: male → nam, ngoại hình cũ → mặc định, vị trí cũ → vị trí đầu");
  expect(o.stats.ket_noi === 0, "stats.ket_noi null → 0");
  for (const [k, ok] of [["quests", (x) => content.questById.has(x)], ["rewards", (x) => content.rewards.has(x)], ["items", (x) => content.carry.has(x)],
    ["values", (x) => content.valueById.has(x)], ["advice", (x) => content.adviceById.has(x)]]) expect(o[k].every(ok), `${k}: còn mục không có trong data`);
  expect(o.flags.includes("co_cu_khong_con"), "flags giữ nguyên");
  expect(fixed.length >= 9, `phải báo ≥ 9 chỗ sửa, có ${fixed.length}`);
  const again = new GameState(content);
  again.fromJSON(o);
  const fixed2 = again.repair(ctx);
  expect(!fixed2.length, `sửa lần 2 vẫn còn: ${fixed2.join("; ")}`);
  if (!repairErrs.length) repairErrs.fixed = fixed.length;
}
report("bản lưu cũ lệch data (repair)", repairErrs, `${repairErrs.fixed ?? 0} chỗ sửa`);

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

// 5c. phụ kiện (characters.json → accessories, vd mũ lưỡi trai): GLB có trên đĩa, số đo khớp <id>.json của build_cap.py,
// điều kiện mở khoá chỉ dùng cờ / quest / phần thưởng có thật; bản lưu: player.accessories lạ → repair() bỏ
const accErrs = [];
const accIds = Object.keys(chars.accessories || {}).filter((k) => !k.startsWith("_"));
for (const id of accIds) {
  const a = chars.accessories[id], w = `accessories.${id}`;
  if (!a.glb || !existsSync(join(ROOT, a.glb))) { accErrs.push(`${w}: thiếu GLB ${a.glb}`); continue; }
  const mj = join(ROOT, dirname(a.glb), `${id}.json`);
  if (existsSync(mj)) {
    const m = JSON.parse(readFileSync(mj, "utf8"));
    const near = (x, y) => Math.abs(x - y) < 1e-4;
    if (!near(a.opening_m?.[0], m.opening_width_m) || !near(a.opening_m?.[1], m.opening_depth_m)) accErrs.push(`${w}.opening_m ${a.opening_m} ≠ ${id}.json (${m.opening_width_m}, ${m.opening_depth_m})`);
    if (!near(a.crown_m, m.crown_height_m)) accErrs.push(`${w}.crown_m ${a.crown_m} ≠ ${id}.json ${m.crown_height_m}`);
    if (!near(a.tilt_deg ?? 0, m.opening_tilt_deg ?? 0)) accErrs.push(`${w}.tilt_deg ${a.tilt_deg} ≠ ${id}.json ${m.opening_tilt_deg}`);
  }
  for (const q of a.unlock?.quests || []) if (!content.questById.has(q)) accErrs.push(`${w}.unlock: không có quest ${q}`);
  for (const r of a.unlock?.rewards || []) if (!content.rewards.has(r)) accErrs.push(`${w}.unlock: không có phần thưởng ${r}`);
  if (!tx(a.label)) accErrs.push(`${w}: thiếu label`);
  for (const k of Object.keys(a.adjust || {})) if (!k.startsWith("_") && !chars.models[k]) accErrs.push(`${w}.adjust: không có model ${k}`);
}
{
  const s = new GameState(content);
  s.fromJSON({ v: 1, created: true, player: { name: "A", accessories: [...accIds, "mu_cu", accIds[0], 7] } });
  const fixed = s.repair({ zoneOrder: zones.order, looks: chars.roles.player.looks, accessories: accIds });
  if (JSON.stringify(s.player.accessories) !== JSON.stringify(accIds) || !fixed.some((f) => f.startsWith("player.accessories"))) accErrs.push(`repair player.accessories → ${JSON.stringify(s.player.accessories)}`);
}
report("phụ kiện (tủ đồ)", accErrs, `${accIds.join(", ") || "không có"}; số đo khớp ${accIds.map((id) => `${id}.json`).join(", ")}`);

// tủ đồ (characters.json → wardrobe, ui/wardrobe.js): mỗi áo = "ao_cam" (bộ trong GLB) hoặc texture có ở MỌI model người chơi
// (roles.player.looks); id không trùng; tên / mô tả / câu gợi ý mở khoá đủ en + vi; điều kiện mở khoá có thật; phụ kiện có
// icon + câu gợi ý khi có unlock. Bản lưu: player.outfit lạ → repair() bỏ
const wErrs = [];
const outfits = chars.wardrobe?.outfits || [];
const playerModels = [...new Set(Object.values(chars.roles.player.looks || {}).flat())];
const until = chars.roles.player.outfit?.until_reward;
if (!outfits.length) wErrs.push("wardrobe.outfits trống");
if (new Set(outfits.map((o) => o.id)).size !== outfits.length) wErrs.push("wardrobe.outfits: id trùng");
for (const o of outfits) {
  const w = `wardrobe.outfits.${o.id}`;
  if (o.id !== until) for (const m of playerModels) if (!chars.models[m]?.outfit_textures?.[o.id]) wErrs.push(`${w}: model ${m} không có texture ${o.id}`);
  for (const k of ["name", "desc"]) if (!o[k]?.en || !o[k]?.vi) wErrs.push(`${w}.${k}: thiếu en / vi`);
  if (o.unlock && (!o.locked?.en || !o.locked?.vi)) wErrs.push(`${w}: có unlock nhưng thiếu locked (en / vi)`);
  for (const r of o.unlock?.rewards || []) if (!content.rewards.has(r)) wErrs.push(`${w}.unlock: không có phần thưởng ${r}`);
  for (const q of o.unlock?.quests || []) if (!content.questById.has(q)) wErrs.push(`${w}.unlock: không có quest ${q}`);
}
if (until && !outfits.some((o) => o.id === until)) wErrs.push(`wardrobe.outfits thiếu ${until} (Áo Cam)`);
for (const id of accIds) {
  const a = chars.accessories[id];
  if (!a.icon) wErrs.push(`accessories.${id}: thiếu icon (tủ đồ)`);
  if (a.unlock && (!a.locked?.en || !a.locked?.vi)) wErrs.push(`accessories.${id}: có unlock nhưng thiếu locked (en / vi)`);
}
{
  const s = new GameState(content);
  s.fromJSON({ v: 1, created: true, player: { name: "A", outfit: "ao_la" } });
  s.repair({ zoneOrder: zones.order, looks: chars.roles.player.looks, outfits: outfits.map((o) => o.id) });
  if (s.player.outfit !== undefined) wErrs.push(`repair player.outfit "ao_la" → ${JSON.stringify(s.player.outfit)}`);
}
report("tủ đồ", wErrs, `${outfits.length} áo (${outfits.map((o) => o.id).join(", ")}) × ${playerModels.length} model người chơi, ${accIds.length} phụ kiện`);

// thẻ nhân viên cầm tay (game/src/characters/idcard.js): hội thoại có hiệu ứng card (give: lễ tân đưa, tap: người chơi quẹt) →
// model vai lễ tân + mọi model người chơi có clip "reach" trong GLB (scripts/blender/characters/build_reach.py) và khai trong
// models.<id>.animations; câu thoại anim "reach" chỉ dùng cho vai có clip; mô hình thẻ có chất liệu "card_face"; vật đầu đọc
// (card.reader) có trong GLB bối cảnh
const cardErrs = [], cardUses = [];
const glbAnims = (f) => { const b = readFileSync(f), n = b.readUInt32LE(12); return new Set((JSON.parse(b.subarray(20, 20 + n).toString("utf8")).animations || []).map((x) => x.name)); };
const hasReach = (model) => {
  const m = chars.models[model], f = m && join(ROOT, m.glb?.low ?? m.glb?.high ?? "");
  return !!m && m.animations?.reach === "reach" && existsSync(f) && glbAnims(f).has("reach");
};
for (const [id, d] of content.dialogues) for (const [k, n] of Object.entries(d.nodes || {})) {
  const c = n.effects?.card;
  if (n.anim === "reach") {
    const model = chars.roles[n.speaker]?.model;
    if (!model || !hasReach(model)) cardErrs.push(`hội thoại ${id}/${k}: ${n.speaker} (model ${model}) không có clip reach`);
  }
  if (!c) continue;
  const kind = typeof c === "string" ? c : c.do;
  cardUses.push(`${id}/${k}:${kind}`);
  if (!["give", "tap"].includes(kind)) cardErrs.push(`hội thoại ${id}/${k}: card "${kind}" lạ (give | tap)`);
  for (const m of playerModels) if (!hasReach(m)) cardErrs.push(`hội thoại ${id}/${k}: model người chơi ${m} không có clip reach`);
  if (kind === "give" && !hasReach(chars.roles.le_tan?.model)) cardErrs.push(`hội thoại ${id}/${k}: lễ tân (${chars.roles.le_tan?.model}) không có clip reach`);
  if (c.reader && !Object.values(names).some((set) => set.has(c.reader))) cardErrs.push(`hội thoại ${id}/${k}: không có vật đầu đọc ${c.reader} trong GLB bối cảnh`);
}
{
  const f = join(ROOT, "assets/props/id_card/id_card.glb");
  if (!existsSync(f)) cardErrs.push("thiếu assets/props/id_card/id_card.glb");
  else { const b = readFileSync(f), n = b.readUInt32LE(12); const mats = (JSON.parse(b.subarray(20, 20 + n).toString("utf8")).materials || []).map((m) => m.name); if (!mats.includes("card_face")) cardErrs.push(`id_card.glb: không có chất liệu card_face (${mats.join(", ")})`); }
}
// cửa quẹt thẻ (scene_fixes → doors[].card): đầu đọc có trong GLB, outside [x, z] khác 0, có vật tương tác card:<id> cùng zone,
// lối ra đòi cửa (quests.json → triggers[].door) trỏ tới cửa có thật
const cardFx = D("scene_fixes") || {}, cardInt = D("interactables"), cardQ = D("quests");
for (const [z, zf] of Object.entries(cardFx)) for (const d of (zf?.doors || []).filter((x) => x.card)) {
  const c = d.card, w = `scene_fixes.${z}.doors[${c.id}]`;
  if (!names[z]?.has(c.reader)) cardErrs.push(`${w}: không có đầu đọc ${c.reader} trong GLB`);
  if (!Array.isArray(c.outside) || c.outside.length !== 2 || !(c.outside[0] || c.outside[1])) cardErrs.push(`${w}: outside phải là [x, z] khác 0`);
  if (!cardInt.items.some((it) => it.zone === z && it.action === `card:${c.id}`)) cardErrs.push(`${w}: thiếu vật tương tác card:${c.id}`);
}
for (const tr of cardQ.triggers || []) if (tr.door && !(cardFx[tr.zone]?.doors || []).some((d) => d.card?.id === tr.door)) cardErrs.push(`quests.triggers ${tr.node}: door "${tr.door}" không có trong scene_fixes.${tr.zone}.doors`);
report("thẻ nhân viên cầm tay", cardErrs, `${cardUses.join(", ") || "không có"}; clip reach: ${[chars.roles.le_tan?.model, ...playerModels].join(", ")}`);

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

// 7. bản tiếng Việt (docs/vi_style.md): mỗi chữ { "en" } có "vi"; data/i18n/vi.json cùng khoá với en.json; biến {…} khớp
// giữa 2 bản (bản vi được bỏ {tu_*} — gọi thẳng tên Tú); names.vi đủ vai; chữ vi giống hệt en mà có ≥ 2 từ tiếng Anh →
// nghi quên dịch (trừ tên gọi / chơi chữ cố ý giữ nguyên)
const viErrs = [];
const vi = json["data/i18n/vi.json"];
const KEEP_EN = new Set(["Business Analyst", "Welcome Kit", "Cute + leader", "Cube + builder", "Customer + order"]);
const varsOf = (s) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => !TU_VARS.includes(v)));
const sameVars = (a, b) => { const x = varsOf(a), y = varsOf(b); return x.size === y.size && [...x].every((v) => y.has(v)); };
const enWords = (s) => s.replace(/\{\w+\}/g, "").match(/[A-Za-z]{3,}/g) || [];
// dấu thanh kiểu cũ như tên Hòa Lạc (hòa, khóa, thủy, khỏe): vần oa / oe / uy cuối âm tiết mang dấu ở chữ sau = kiểu mới (trừ qu: quý)
const NEW_TONE = /(?<![qQ])(?:[oO][aAeE]|[uU][yY])[̣́̀̉̃](?![\p{L}\p{M}])/u;
const newTone = (s) => s.normalize("NFD").match(NEW_TONE)?.[0].normalize("NFC");
const checkPair = (where, e, v) => {
  if (typeof v !== "string") return viErrs.push(`${where}: thiếu bản vi — "${e.slice(0, 70)}"`);
  if (e.trim() && !v.trim()) viErrs.push(`${where}: bản vi rỗng`);
  if (!sameVars(e, v)) viErrs.push(`${where}: biến lệch — en {${[...varsOf(e)].join(", ")}} / vi {${[...varsOf(v)].join(", ")}}`);
  if (v === e && enWords(e).length >= 2 && !KEEP_EN.has(e)) viErrs.push(`${where}: bản vi giống hệt bản en (quên dịch?) — "${e.slice(0, 70)}"`);
  const nt = newTone(v);
  if (nt) viErrs.push(`${where}: dấu thanh kiểu mới "${nt}" — dùng kiểu cũ như Hòa Lạc (hòa, khóa, thủy) — "${v.slice(0, 60)}"`);
};
let viPairs = 0;
const viWalk = (o, where) => {
  if (Array.isArray(o)) o.forEach((x, i) => viWalk(x, `${where}[${i}]`));
  else if (o && typeof o === "object") {
    if (typeof o.en === "string") { viPairs++; checkPair(where, o.en, o.vi); }
    for (const [k, x] of Object.entries(o)) if (k !== "en" && k !== "vi") viWalk(x, `${where}.${k}`);
  }
};
for (const [f, d] of Object.entries(json)) if (!f.startsWith("data/i18n/")) viWalk(d, f.replace("data/", "").replace(".json", ""));
if (!vi) viErrs.push("thiếu data/i18n/vi.json");
else {
  const flat = (o, p = "", out = {}) => { for (const [k, x] of Object.entries(o)) if (!k.startsWith("_")) { if (x && typeof x === "object") flat(x, `${p}${k}.`, out); else out[`${p}${k}`] = x; } return out; };
  const fe = flat(en), fv = flat(vi);
  for (const k of Object.keys(fe)) { viPairs++; checkPair(`i18n ${k}`, fe[k], fv[k]); }
  for (const k of Object.keys(fv)) if (!(k in fe)) viErrs.push(`i18n ${k}: có trong vi.json, không có trong en.json`);
}
for (const r of Object.keys(chars.names.en)) if (typeof chars.names.vi?.[r] !== "string") viErrs.push(`characters names.vi: thiếu tên vai ${r}`);
for (const [l, m] of Object.entries(chars.names_ref || {})) if (!l.startsWith("_")) for (const [r, v] of Object.entries(m)) {
  if (!(r in chars.names.en)) viErrs.push(`characters names_ref.${l}.${r}: không có vai này trong names`);
  if (newTone(v)) viErrs.push(`characters names_ref.${l}.${r}: dấu thanh kiểu mới "${newTone(v)}"`);
}
for (const [r, v] of Object.entries(chars.names.vi || {})) if (newTone(v)) viErrs.push(`characters names.vi.${r}: dấu thanh kiểu mới "${newTone(v)}"`);
report("bản tiếng Việt", viErrs, `${viPairs} cặp en / vi, ${Object.keys(chars.names.vi || {}).length} tên vai`);

// 8. âm thanh
const sfxErrs = [], SFX = join(ROOT, "assets", "sfx"), snd = D("sounds") || { sources: {}, sounds: {} };
const LICENSES = new Set(["CC0-1.0"]), SFX_FILE_KB = 100, SFX_TOTAL_KB = 1024;
const credits = existsSync(join(ROOT, "docs", "audio_credits.md")) ? readFileSync(join(ROOT, "docs", "audio_credits.md"), "utf8") : "";
if (!credits) sfxErrs.push("thiếu docs/audio_credits.md (chạy scripts/blender/audio/build_sfx.py)");
const want = new Set();
let sfxBytes = 0;
for (const [id, d] of Object.entries(snd.sounds)) {
  const n = d.files?.length || 0;
  if (!n) sfxErrs.push(`sounds.${id}: không có bản nào (files)`);
  if (!["ui", "world"].includes(d.bus)) sfxErrs.push(`sounds.${id}: bus "${d.bus}" (ui | world)`);
  for (const k of ["volume", "pitch"]) if (d[k] != null && !(d[k] >= 0 && d[k] <= (k === "volume" ? 1 : 0.5))) sfxErrs.push(`sounds.${id}.${k} = ${d[k]} ngoài khoảng`);
  for (const z of d.zones || []) if (!zones.zones[z]) sfxErrs.push(`sounds.${id}.zones: không có zone ${z}`);
  (d.files || []).forEach((f, i) => {
    const name = n === 1 ? `${id}.mp3` : `${id}_${i + 1}.mp3`, path = join(SFX, name);
    want.add(name);
    if (f.src) {
      const pack = f.src.split("/")[0], src = snd.sources[pack];
      if (!src) sfxErrs.push(`sounds.${id}: gói "${pack}" chưa khai ở sources`);
      else {
        if (!LICENSES.has(src.license)) sfxErrs.push(`sources.${pack}: giấy phép ${src.license} chưa được chấp nhận (chỉ ${[...LICENSES]})`);
        if (!/^[0-9a-f]{64}$/.test(src.zip_sha256 || "") || !src.download || !src.page) sfxErrs.push(`sources.${pack}: thiếu page / download / zip_sha256`);
        if (!existsSync(join(SFX, "licenses", `${pack}.txt`))) sfxErrs.push(`thiếu bản giấy phép assets/sfx/licenses/${pack}.txt`);
      }
    } else if (!f.synth) sfxErrs.push(`sounds.${id}: bản ${i + 1} cần "src" (gói tải về) hoặc "synth" (tự tạo)`);
    if (!existsSync(path)) { sfxErrs.push(`thiếu assets/sfx/${name} (chạy build_sfx.py)`); return; }
    const kb = statSync(path).size / 1024;
    sfxBytes += statSync(path).size;
    if (kb > SFX_FILE_KB) sfxErrs.push(`assets/sfx/${name}: ${kb.toFixed(0)} KB > ${SFX_FILE_KB} KB`);
    if (!credits.includes(`assets/sfx/${name}`)) sfxErrs.push(`assets/sfx/${name} chưa có trong docs/audio_credits.md (chạy lại build_sfx.py)`);
  });
}
if (existsSync(SFX)) for (const f of readdirSync(SFX)) if (f.endsWith(".mp3") && !want.has(f)) sfxErrs.push(`assets/sfx/${f}: không có trong data/sounds.json (file thừa — không rõ nguồn / giấy phép)`);
if (sfxBytes / 1024 > SFX_TOTAL_KB) sfxErrs.push(`tổng âm thanh ${(sfxBytes / 1024).toFixed(0)} KB > ${SFX_TOTAL_KB} KB`);
let sfxCalls = 0;
for (const f of walk(join(ROOT, "game", "src"))) {
  for (const m of readFileSync(f, "utf8").matchAll(/\bsound\.play\(\s*"([a-z0-9_]+)"/g)) { sfxCalls++; if (!snd.sounds[m[1]]) sfxErrs.push(`${rel(f)}: sound.play("${m[1]}") — không có trong data/sounds.json`); }
}
for (const [id, d] of content.dialogues) for (const [k, n] of Object.entries(d.nodes || {})) if (n.sfx && !snd.sounds[n.sfx]) sfxErrs.push(`hội thoại ${id}/${k}: sfx "${n.sfx}" không có trong data/sounds.json`);
for (const [z, cfg] of Object.entries(zones.zones)) for (const a of [cfg.audio, ...(cfg.variants || []).map((v) => v.audio)].filter(Boolean)) {
  if (a.ambience && !AMBIENCES.includes(a.ambience)) sfxErrs.push(`zones.${z}.audio.ambience "${a.ambience}" (có: ${AMBIENCES.join(", ")})`);
  if (a.steps && !snd.sounds[`step_${a.steps}`]) sfxErrs.push(`zones.${z}.audio.steps "${a.steps}": không có tiếng step_${a.steps}`);
  if (a.steps && snd.sounds[`step_${a.steps}`]?.zones && !snd.sounds[`step_${a.steps}`].zones.includes(z)) sfxErrs.push(`zones.${z}: step_${a.steps} không tải ở zone này (sounds.json → zones)`);
  if (a.reverb != null && !(a.reverb >= 0 && a.reverb <= 1)) sfxErrs.push(`zones.${z}.audio.reverb ngoài 0..1`);
}
report("âm thanh", sfxErrs, `${want.size} file, ${(sfxBytes / 1024).toFixed(0)} KB, ${Object.keys(snd.sources).length} gói CC0, ${sfxCalls} lần gọi sound.play`);

// 8b. nhạc nền: data/sounds.json → music; mỗi bài có file assets/music/<id>.mp3 (≤ 2 MB), nguồn CC0 (trang + bản ghi giấy phép
// assets/music/licenses/<nguồn>.txt), SHA-256 file gốc, ghi trong CREDITS.md; không có file nhạc thừa; bài mặc định / zones.json →
// audio.music là bài có thật
const musErrs = [], MUS = join(ROOT, "assets", "music"), mus = snd.music, MUS_FILE_KB = 2048;
const creditsMain = existsSync(join(ROOT, "CREDITS.md")) ? readFileSync(join(ROOT, "CREDITS.md"), "utf8") : "";
let musBytes = 0;
if (mus) {
  const tracks = mus.tracks || {};
  for (const [id, tr] of Object.entries(tracks)) {
    const src = (mus.sources || {})[tr.source], path = join(MUS, `${id}.mp3`);
    if (!src) musErrs.push(`music.tracks.${id}: nguồn "${tr.source}" chưa khai ở music.sources`);
    else {
      if (!LICENSES.has(src.license)) musErrs.push(`music.sources.${tr.source}: giấy phép ${src.license} chưa được chấp nhận (chỉ ${[...LICENSES]})`);
      if (!src.page) musErrs.push(`music.sources.${tr.source}: thiếu page`);
      if (!existsSync(join(MUS, "licenses", `${tr.source}.txt`))) musErrs.push(`thiếu assets/music/licenses/${tr.source}.txt`);
    }
    if (!/^[0-9a-f]{64}$/.test(tr.original_sha256 || "")) musErrs.push(`music.tracks.${id}: thiếu original_sha256 (file gốc nhận được)`);
    if (!(tr.volume > 0 && tr.volume <= 1)) musErrs.push(`music.tracks.${id}.volume = ${tr.volume} (0..1)`);
    if (!creditsMain.includes(`assets/music/${id}.mp3`)) musErrs.push(`assets/music/${id}.mp3 chưa ghi trong CREDITS.md`);
    if (!existsSync(path)) { musErrs.push(`thiếu assets/music/${id}.mp3`); continue; }
    const kb = statSync(path).size / 1024;
    musBytes += statSync(path).size;
    if (kb > MUS_FILE_KB) musErrs.push(`assets/music/${id}.mp3: ${kb.toFixed(0)} KB > ${MUS_FILE_KB} KB`);
  }
  if (existsSync(MUS)) for (const f of readdirSync(MUS)) if (f.endsWith(".mp3") && !tracks[f.slice(0, -4)]) musErrs.push(`assets/music/${f}: không có trong data/sounds.json → music (file thừa — không rõ nguồn / giấy phép)`);
  if (mus.default != null && !tracks[mus.default]) musErrs.push(`music.default "${mus.default}" không có trong music.tracks`);
  if (mus.duck != null && !(mus.duck >= 0 && mus.duck <= 1)) musErrs.push(`music.duck ngoài 0..1`);
  for (const [z, cfg] of Object.entries(zones.zones)) for (const a of [cfg.audio, ...(cfg.variants || []).map((v) => v.audio)].filter(Boolean))
    if (a.music != null && !tracks[a.music]) musErrs.push(`zones.${z}.audio.music "${a.music}" không có trong music.tracks`);
} else if (existsSync(MUS) && readdirSync(MUS).some((f) => f.endsWith(".mp3"))) musErrs.push("có file trong assets/music/ nhưng data/sounds.json không có music");
report("nhạc nền", musErrs, `${Object.keys(mus?.tracks || {}).length} bài (mặc định: ${mus?.default ?? "—"}), ${(musBytes / 1024).toFixed(0)} KB, chỉ CC0`);

// ---------- nhắn tin: giới hạn + bộ lọc từ (data/chat.json, game/src/net/chatfilter.js — máy chủ dùng đúng module này) ----------
const chatErrs = [];
const chatCfg = JSON.parse(readFileSync(join(ROOT, "data", "chat.json"), "utf8"));
for (const k of ["max_len", "rate_per_s", "burst", "history", "bubble_s"]) if (!(chatCfg[k] > 0)) chatErrs.push(`chat.json: ${k} phải > 0`);
const flt = makeFilter(chatCfg);
// [chữ gửi, chữ người khác thấy] — che đúng từ thô tục / link, KHÔNG che từ thường (tiếng Việt bỏ dấu dễ trùng)
const chatCases = [
  ["Chào các bạn, mình là intern mới!", "Chào các bạn, mình là intern mới!"],
  ["Lớn lên ở Hòa Lạc, đeo kính, dù mà vui", "Lớn lên ở Hòa Lạc, đeo kính, dù mà vui"],
  ["class assistant Scunthorpe admin", "class assistant Scunthorpe admin"],
  ["đồ lồn", "đồ ***"], ["cặc", "***"], ["địt mẹ mày", "*** ** mày"], ["dit me may", "*** ** may"], ["Chó đẻ", "*** **"],
  ["fuuuck you", "****** you"], ["F u c k", "* * * *"], ["sh1t man", "**** man"], ["$hit", "****"], ["WTF vcl", "*** ***"],
  ["vào https://evil.example/x nhé", "vào [link] nhé"], ["xem www.abc.vn", "xem [link]"], ["F-Ville.com", "[link]"],
  ["  nhiều   khoảng\u200b trắng  ", "nhiều khoảng trắng"],
  // tiếng Việt: có dấu, không dấu / viết tắt, cụm xúc phạm — và câu thường dễ che nhầm (bỏ dấu trùng từ khác)
  ["đù má mày", "** ** mày"], ["ĐỜ MỜ", "** **"], ["đéo biết", "*** ****"], ["đếch quan tâm", "**** quan tâm"], ["lìn kặc", "*** ***"],
  ["thằng chó này", "***** *** này"], ["đồ ngu", "** ***"], ["tổ sư mày", "** ** mày"], ["mất dạy", "*** ***"], ["câm mồm đi", "*** *** đi"],
  ["con mẹ mày", "*** ** ***"], ["ditme duma dmvl cmnr", "***** **** **** ****"], ["đ ị t", "* * *"], ["đjt mẹ", "*** mẹ"],
  ["Đi ngủ thôi, di ngu thoi", "Đi ngủ thôi, di ngu thoi"], ["con chó nhà mình, đồ ngủ màu hồng, con ngủ chưa", "con chó nhà mình, đồ ngủ màu hồng, con ngủ chưa"],
  ["Dù mẹ bảo, chờ để em xem, cho de em xem", "Dù mẹ bảo, chờ để em xem, cho de em xem"],
  ["cac ban oi buoi chieu nay hop, lon bia, Dell laptop", "cac ban oi buoi chieu nay hop, lon bia, Dell laptop"],
  // Mở rộng danh sách: cụm có dấu / không dấu, viết tắt, leetspeak và che đúng ranh giới từ.
  ["VÃI BUỒI", "*** ****"], ["ăn cứt", "** ***"], ["đồ rác rưởi", "** *** ****"],
  ["đụ cả nhà", "** ** ***"], ["dit ca nha", "*** ** ***"], ["dau buoi", "*** ****"],
  ["vailon dclm deome", "****** **** *****"], ["v4il0n", "******"], ["d c l m", "* * * *"],
  ["bullshit dumbass shithead", "******** ******* ********"], ["son of a bitch", "*** ** * *****"],
  ["cocksucker phuck", "********** *****"], ["😀 ăn cứt nhé", "😀 ** *** nhé"],
  ["Cho dê ăn, dù cả nhà đi ngủ, đầu bài rất lớn", "Cho dê ăn, dù cả nhà đi ngủ, đầu bài rất lớn"],
  ["cho de an, du ca nha di ngu, dau bai rat lon", "cho de an, du ca nha di ngu, dau bai rat lon"],
  ["cocktail shuttle classic document", "cocktail shuttle classic document"],
];
for (const [inp, want] of chatCases) {
  const got = flt.clean(inp).text;
  if (got !== want) chatErrs.push(`lọc ${JSON.stringify(inp)} → ${JSON.stringify(got)} (cần ${JSON.stringify(want)})`);
}
if (cleanText("a\u0000b\u202ec") !== "a b c") chatErrs.push("cleanText phải bỏ ký tự điều khiển / đổi chiều chữ");
report("nhắn tin (bộ lọc từ)", chatErrs, `${chatCases.length} câu mẫu, tối đa ${chatCfg.max_len} ký tự, ${chatCfg.burst} tin dồn / ${chatCfg.rate_per_s} tin mỗi giây`);

// ---------- bầu trời + phông nền xa (data/backdrop.json → game/src/render/sky.js) ----------
const skyErrs = [];
const bd = JSON.parse(readFileSync(join(ROOT, "data", "backdrop.json"), "utf8"));
const hex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
if (!hex(bd.default_sky?.top) || !hex(bd.default_sky?.horizon)) skyErrs.push("backdrop.json: default_sky cần top + horizon (#rrggbb)");
const fogOk = (f) => Array.isArray(f) && f.length === 2 && f[0] >= 0 && f[1] > f[0] && f[1] <= 600;
if (!fogOk(bd.default_fog)) skyErrs.push("backdrop.json: default_fog = [gần, xa], 0 ≤ gần < xa ≤ 600 (camera.far)");
if (!(bd.ground?.radius_m > 0) || !hex(bd.ground?.color)) skyErrs.push("backdrop.json: ground cần radius_m > 0, color");
const ids = new Set();
for (const L of bd.layers || []) {
  if (ids.has(L.id)) skyErrs.push(`backdrop.json: lớp trùng id ${L.id}`);
  ids.add(L.id);
  if (!["trees", "blocks", "ridge"].includes(L.kind)) skyErrs.push(`backdrop.json: lớp ${L.id} kind "${L.kind}" lạ (trees | blocks | ridge)`);
  if (!hex(L.color) || !(L.radius_m > 0) || !(L.height_m?.[1] >= L.height_m?.[0]) || !(L.haze >= 0 && L.haze <= 1)) skyErrs.push(`backdrop.json: lớp ${L.id} thiếu / sai color, radius_m, height_m, haze`);
  if (L.radius_m >= 560) skyErrs.push(`backdrop.json: lớp ${L.id} radius_m ${L.radius_m} — vòm trời 560 m, camera.far 600 m`);
}
if ((bd.layers || []).length < 2) skyErrs.push("backdrop.json: cần ít nhất 2 lớp phông nền");
if (!(bd.layers || []).some((L) => L.kind === "ridge" && L.peaks?.length)) skyErrs.push("backdrop.json: thiếu lớp núi có đỉnh (Ba Vì)");
// mood có màu trời → đủ sky_top + sky_horizon; fog hợp lệ
for (const [z, cfg] of Object.entries(zones.zones)) {
  for (const [where, m] of [["mood", cfg.mood], ...(cfg.variants || []).map((v, i) => [`variants[${i}].mood`, v.mood])]) {
    if (!m) continue;
    if ((m.sky || m.sky_top || m.sky_horizon) && !(hex(m.sky_top) && hex(m.sky_horizon))) skyErrs.push(`zones.${z}.${where}: có màu trời thì cần đủ sky_top + sky_horizon (#rrggbb)`);
    if (m.fog && !fogOk(m.fog)) skyErrs.push(`zones.${z}.${where}: fog = [gần, xa], 0 ≤ gần < xa ≤ 600`);
  }
}
// dựng thật (không cần trình duyệt): số tam giác
const skyScene = new THREE.Scene();
const sky = new Sky(skyScene, bd);
const fakeZone = { root: new THREE.Mesh(new THREE.BoxGeometry(200, 1, 80)) };
sky.setZone(fakeZone);
sky.setMood(zones.zones[zones.order[0]].mood);
const si = sky.info(), skyTris = si.core + si.extra + si.clouds + si.ground;
if (skyTris > 5000) skyErrs.push(`phông nền + mây + mặt đất xa ${skyTris} tam giác (> 5.000)`);
report("bầu trời + phông nền", skyErrs, `${(bd.layers || []).length} lớp (${[...ids].join(", ")}), ${skyTris} tam giác (phông nền ${si.core + si.extra}, mây ${si.clouds}, mặt đất xa ${si.ground}), vòm trời ${si.dome}`);

// 10. phòng giả sau cửa / lối sang zone khác (data/scene_fixes.json → <zone>.rooms): zone có thật, center / size 3 số (size > 0),
// màu floor / wall / ceiling dạng #rrggbb, id không trùng
const roomErrs = [], fx = D("scene_fixes") || {};
let roomN = 0;
for (const [z, cfg] of Object.entries(fx)) {
  if (!cfg?.rooms) continue;
  if (!zones.zones[z]) roomErrs.push(`scene_fixes.${z}: không có zone này`);
  const seen = new Set();
  for (const [i, r] of cfg.rooms.entries()) {
    roomN++;
    const w = `scene_fixes.${z}.rooms[${r.id ?? i}]`;
    if (r.id && seen.has(r.id)) roomErrs.push(`${w}: id trùng`);
    seen.add(r.id);
    if (!(Array.isArray(r.center) && r.center.length === 3 && r.center.every(Number.isFinite))) roomErrs.push(`${w}: center phải là [x, y, z]`);
    if (!(Array.isArray(r.size) && r.size.length === 3 && r.size.every((v) => Number.isFinite(v) && v > 0))) roomErrs.push(`${w}: size phải là 3 số > 0`);
    for (const k of ["floor", "wall", "ceiling"]) if (!/^#[0-9a-f]{6}$/i.test(r[k] || "")) roomErrs.push(`${w}.${k} = ${r[k]} (#rrggbb)`);
    if (r.pad_m != null && !(r.pad_m >= 0 && r.pad_m <= 3)) roomErrs.push(`${w}.pad_m ngoài 0..3`);
  }
}
report("phòng giả sau cửa (scene_fixes → rooms)", roomErrs, `${roomN} phòng (${Object.entries(fx).filter(([, c]) => c?.rooms).map(([z]) => z).join(", ") || "—"})`);

// 11. vật từ GLB riêng (scene_fixes → props) + gỡ vật cũ dựng chung mesh (remove_parts): file assets/props/<model>/<model>.glb có
// thật (≤ 300 KB, nén Draco), ghi nguồn trong CREDITS.md; at 3 số, height_m > 0; remove_parts: regex mesh hợp lệ, hộp hợp lệ
const propErrs = [], propFiles = new Set(), PROP_KB = 300;
const creditsTxt = existsSync(join(ROOT, "CREDITS.md")) ? readFileSync(join(ROOT, "CREDITS.md"), "utf8") : "";
let propN = 0, removeN = 0;
for (const [z, cfg] of Object.entries(fx)) {
  for (const [i, pr] of (cfg?.props || []).entries()) {
    propN++;
    const w = `scene_fixes.${z}.props[${i}]`, f = `assets/props/${pr.model}/${pr.model}.glb`;
    if (!(Array.isArray(pr.at) && pr.at.length === 3 && pr.at.every(Number.isFinite))) propErrs.push(`${w}: at phải là [x, y, z]`);
    if (pr.height_m != null && !(pr.height_m > 0 && pr.height_m < 10)) propErrs.push(`${w}.height_m = ${pr.height_m}`);
    if (propFiles.has(f)) continue;
    propFiles.add(f);
    if (!existsSync(join(ROOT, f))) { propErrs.push(`${w}: thiếu ${f} (scripts/tools/make_prop.sh ${pr.model})`); continue; }
    const kb = statSync(join(ROOT, f)).size / 1024;
    if (kb > PROP_KB) propErrs.push(`${f}: ${kb.toFixed(0)} KB > ${PROP_KB} KB`);
    if (!creditsTxt.includes(f)) propErrs.push(`${f} chưa ghi nguồn trong CREDITS.md`);
    const buf = readFileSync(join(ROOT, f)), gj = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
    if (!(gj.extensionsUsed || []).includes("KHR_draco_mesh_compression")) propErrs.push(`${f}: chưa nén Draco`);
  }
  for (const [i, r] of (cfg?.remove_parts || []).entries()) {
    removeN++;
    const w = `scene_fixes.${z}.remove_parts[${i}]`;
    try { new RegExp(r.mesh); } catch { propErrs.push(`${w}.mesh: regex lỗi`); }
    if (names[z] && ![...names[z]].some((n) => new RegExp(r.mesh).test(n))) propErrs.push(`${w}.mesh ${r.mesh}: không có node nào trong GLB zone`);
    for (const b of r.boxes || []) if (!(b.center?.length === 3 && b.size?.length === 3 && b.size.every((v) => v > 0))) propErrs.push(`${w}: hộp sai`);
  }
}
report("vật từ GLB riêng (scene_fixes → props, remove_parts)", propErrs, `${propN} vật (${[...propFiles].map((f) => f.split("/").pop()).join(", ") || "—"}), ${removeN} mục gỡ vật cũ`);

// 12. chỗ ngồi tự do (data/seats.json): zone có thật, at 3 số, yaw_deg 0..360, h trong khoảng ghế ngồi được (0,3–0,75 m), group có
// tên, 2 ghế không trùng chỗ (< 0,3 m); radius_m / occupied_m hợp lệ; chữ seat.sit / seat.stand có ở cả en + vi
const seatErrs = [], seatCfg = D("seats");
let seatN = 0;
if (!seatCfg) seatErrs.push("thiếu data/seats.json");
else {
  if (!(seatCfg.radius_m > 0.5 && seatCfg.radius_m <= 2)) seatErrs.push(`radius_m = ${seatCfg.radius_m} (0,5–2)`);
  if (!(seatCfg.occupied_m > 0 && seatCfg.occupied_m <= 1)) seatErrs.push(`occupied_m = ${seatCfg.occupied_m} (0–1)`);
  for (const [z, list] of Object.entries(seatCfg.zones || {})) {
    if (!zones.zones[z]) seatErrs.push(`seats.zones.${z}: không có zone này`);
    for (const [i, x] of list.entries()) {
      seatN++;
      const w = `seats.zones.${z}[${i}]`;
      if (!(Array.isArray(x.at) && x.at.length === 3 && x.at.every(Number.isFinite))) { seatErrs.push(`${w}: at phải là [x, y, z]`); continue; }
      if (!(x.yaw_deg >= 0 && x.yaw_deg < 360)) seatErrs.push(`${w}.yaw_deg = ${x.yaw_deg} (0..360)`);
      if (!(x.h >= 0.3 && x.h <= 0.75)) seatErrs.push(`${w}.h = ${x.h} (0,3–0,75 m)`);
      if (!x.group) seatErrs.push(`${w}: thiếu group`);
      const dup = list.findIndex((y, k) => k < i && Math.hypot(y.at[0] - x.at[0], y.at[2] - x.at[2]) < 0.3 && Math.abs(y.at[1] - x.at[1]) < 0.5);
      if (dup >= 0) seatErrs.push(`${w}: trùng chỗ ghế [${dup}]`);
    }
  }
  for (const l of ["en", "vi"]) for (const k of ["sit", "stand"]) if (!D(`i18n/${l}`)?.seat?.[k]) seatErrs.push(`i18n/${l}.json: thiếu seat.${k}`);
}
report("chỗ ngồi tự do (seats.json)", seatErrs, `${seatN} ghế (${Object.entries(seatCfg?.zones || {}).map(([z, l]) => `${z} ${l.length}`).join(", ")})`);

const ms = Math.round(performance.now() - t0);
console.log(failed ? `✗ test:data: ${failed} mục lỗi (${ms} ms)` : `✓ test:data: đạt hết (${ms} ms)`);
process.exit(failed ? 1 : 0);
