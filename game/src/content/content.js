// Nội dung game từ data/*.json (GDD Phụ lục): dialogues, quests, interactables, quiz, rewards, values, cutscenes.
// Chữ hiển thị trong nội dung là object theo mã ngôn ngữ {"en": "..."} → tx() chọn theo ngôn ngữ hiện tại.
// Kiểm tra khi tải: mọi node mà JSON nhắc tới phải có thật trong GLB của zone đó; tham chiếu nội bộ phải khớp.
import { loadJSON, url } from "../core/assets.js";
import { lang, t } from "../i18n.js";

const FILES = ["dialogues", "quests", "interactables", "quiz", "rewards", "values", "cutscenes"];

export async function loadContent() {
  const raw = Object.fromEntries(await Promise.all(FILES.map(async (f) => [f, await loadJSON(url(`data/${f}.json`))])));
  return {
    raw,
    dialogues: new Map(raw.dialogues.dialogues.map((d) => [d.id, d])),
    quests: raw.quests.quests,
    questById: new Map(raw.quests.quests.map((q) => [q.id, q])),
    checklist: raw.quests.checklist,
    triggers: raw.quests.triggers,
    // hạt lúa vàng (interactables.json → grains) thành vật tương tác do code đặt: nhặt = grain:<id>
    interactables: [...raw.interactables.items, ...(raw.interactables.grains || []).map((g) => ({
      zone: g.zone, object: g.id, pos: g.pos, model: "grain", radius: g.radius ?? 1.4, prompt: raw.interactables.grain_prompt,
      action: `grain:${g.id}`, hide_if: { grains: [g.id] }, where: g.where }))],
    grainsTotal: raw.interactables.grains_total ?? 10,
    defaultRadius: raw.interactables.default_radius ?? 2,
    minigames: raw.interactables.minigames,
    quizzes: new Map(raw.quiz.quizzes.map((q) => [q.id, q])),
    rewards: new Map(raw.rewards.rewards.map((r) => [r.id, r])),
    carry: new Map(raw.rewards.carry.map((r) => [r.id, r])),
    values: raw.values.values,
    valueById: new Map(raw.values.values.map((v) => [v.id, v])),
    badge: raw.values.badge,
    cutscenes: raw.cutscenes.cutscenes,
  };
}

// chữ theo ngôn ngữ + thay {biến}
export function tx(obj, vars = {}) {
  if (obj == null) return "";
  const s = typeof obj === "string" ? obj : obj[lang] ?? obj.en ?? "";
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}
export const draftMark = (isDraft) => (isDraft ? `${t("hud.draft_marker")} ` : "");

// ---------- kiểm tra ----------
const GLB_PREFIX = /^(INT_|NPC_|TRIGGER_|SPAWN_|COL_|CAM_|PATH_)/;

// mọi tham chiếu tới node GLB: [{zone, node, where}]
export function nodeRefs(c) {
  const refs = [];
  // any: node không theo tiền tố (vd thân xe xe_bus_2, cánh cửa xe_bus_2_cua mà cảnh chuyển điều khiển)
  const add = (zone, node, where, any = false) => { if (node && (any || GLB_PREFIX.test(node))) refs.push({ zone, node, where }); };
  for (const it of c.interactables) {
    for (const k of ["node", "area", "anchor"]) add(it.zone, it[k], `interactables.json · ${it.node || it.object || it.actor} · ${k}`);
  }
  for (const q of c.quests) add(q.zone, q.target, `quests.json · quest ${q.id} · target`);
  for (const tr of c.triggers) {
    add(tr.zone, tr.node, `quests.json · trigger ${tr.zone}/${tr.node}`);
    if (tr.to_zone) add(tr.to_zone, tr.to_spawn, `quests.json · trigger ${tr.zone}/${tr.node} · to_spawn`);
  }
  for (const q of c.quizzes.values()) add(q.zone, q.node, `quiz.json · ${q.id} · node`);
  for (const [id, cs] of Object.entries(c.cutscenes)) {
    if (id.startsWith("_")) continue;
    const w = `cutscenes.json · ${id}`;
    for (const k of ["door_point", "bus", "door", "path"]) add(cs.zone, cs[k], `${w} · ${k}`, true);
    for (const cam of cs.cams || []) add(cs.zone, cam, `${w} · cams`);
    const a = cs.arrive || {};
    for (const k of ["spawn", "bus", "door", "path", "camera_from"]) add(a.zone, a[k], `${w} · arrive.${k}`, true);
  }
  return refs;
}

// tên node trong 1 GLB: chỉ đọc khối JSON (không giải nén lưới) → nhanh
async function glbNodeNames(href) {
  const buf = await (await fetch(href)).arrayBuffer();
  const dv = new DataView(buf);
  const len = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, len)));
  return new Set((json.nodes || []).map((n) => n.name).filter(Boolean));
}

// zoneFiles: { zone_01: "zone_01_bus", ... } — chỉ kiểm tra các zone có trong game
export async function validateNodes(c, zoneFiles, tier = "low") {
  const refs = nodeRefs(c).filter((r) => zoneFiles[r.zone]);
  const names = {};
  for (const [zone, file] of Object.entries(zoneFiles)) names[zone] = await glbNodeNames(url(`assets/glb/${tier}/${file}.glb`));
  const missing = refs.filter((r) => !names[r.zone].has(r.node)).map((r) => `${r.zone}: thiếu ${r.node} (${r.where})`);
  const skipped = nodeRefs(c).filter((r) => !zoneFiles[r.zone]).length;
  return { checked: refs.length, skipped, missing };
}

// tham chiếu nội bộ: hội thoại → node tồn tại; phần thưởng, giá trị, quest, mini-game, hội thoại được nhắc tới phải có
export function validateLinks(c) {
  const errs = [];
  const needReward = (id, where) => { for (const r of [].concat(id || [])) if (!c.rewards.has(r)) errs.push(`${where}: không có phần thưởng ${r}`); };
  const needItem = (id, where) => { for (const r of [].concat(id || [])) if (!c.carry.has(r)) errs.push(`${where}: không có vật mang theo ${r}`); };
  const needValue = (id, where) => { for (const v of [].concat(id || [])) if (!c.valueById.has(v)) errs.push(`${where}: không có giá trị ${v}`); };
  const needQuest = (id, where) => { for (const q of [].concat(id || [])) if (!c.questById.has(q)) errs.push(`${where}: không có quest ${q}`); };
  const checkEffects = (e, where) => {
    if (!e) return;
    needReward(e.reward, where); needValue(e.value, where); needQuest(e.quest, where); needItem(e.item, where); needItem(e.remove_item, where);
  };
  const checkAction = (a, where) => {
    if (!a) return;
    const [kind, id] = a.split(":");
    if (kind === "dialogue" && !c.dialogues.has(id)) errs.push(`${where}: không có hội thoại ${id}`);
    if (kind === "minigame" && !c.minigames[id]) errs.push(`${where}: không có mini-game ${id}`);
    if (kind === "pickup" && !c.carry.has(id)) errs.push(`${where}: không có vật ${id}`);
  };
  for (const d of c.dialogues.values()) {
    const where = `dialogues.json · ${d.id}`;
    if (!d.nodes[d.start]) errs.push(`${where}: start '${d.start}' không có`);
    for (const [k, n] of Object.entries(d.nodes)) {
      const nexts = [n.next, ...(n.choices || []).map((ch) => ch.next), ...(n.branch || []).map((b) => b.next)];
      for (const x of nexts) if (x != null && !d.nodes[x]) errs.push(`${where} · ${k}: next '${x}' không có`);
      checkEffects(n.effects, `${where} · ${k}`);
      for (const ch of n.choices || []) checkEffects(ch.effects, `${where} · ${k} · lựa chọn`);
      checkAction(n.action, `${where} · ${k}`);
      if (n.choices && n.choices.length > 4) errs.push(`${where} · ${k}: quá 4 lựa chọn (phím 1–4)`);
    }
  }
  for (const it of c.interactables) checkAction(it.action, `interactables.json · ${it.node || it.object || it.actor}`);
  for (const [id, m] of Object.entries(c.minigames)) {
    if (id.startsWith("_")) continue;
    checkEffects(m.result, `minigames · ${id}`);
    if (!m.kind) errs.push(`minigames · ${id}: thiếu kind (luật chơi)`);
    if (m.quiz && !c.quizzes.has(m.quiz)) errs.push(`minigames · ${id}: không có quiz ${m.quiz}`);
  }
  for (const tr of c.triggers) {
    needQuest(tr.requires, `trigger ${tr.zone}/${tr.node}`);
    if (tr.blocked_dialogue && !c.dialogues.has(tr.blocked_dialogue)) errs.push(`trigger ${tr.zone}/${tr.node}: không có hội thoại ${tr.blocked_dialogue}`);
    if (tr.cutscene && !c.cutscenes[tr.cutscene]) errs.push(`trigger ${tr.zone}/${tr.node}: không có cảnh chuyển ${tr.cutscene}`);
  }
  for (const [id, cs] of Object.entries(c.cutscenes)) {
    if (id.startsWith("_")) continue;
    if (cs.dialogue && !c.dialogues.has(cs.dialogue)) errs.push(`cutscenes.json · ${id}: không có hội thoại ${cs.dialogue}`);
    checkEffects(cs.effects, `cutscenes.json · ${id} · effects`);
  }
  for (const q of c.quests) if (q.checklist && !c.checklist.some((x) => x.id === q.checklist)) errs.push(`quest ${q.id}: không có mục checklist ${q.checklist}`);
  if (!c.rewards.has(c.badge.reward)) errs.push(`values.json: badge.reward ${c.badge.reward} không có`);
  return errs;
}

// nội dung chờ HR (draft) — để báo cáo / chặn bản phát hành
export function draftList(c) {
  const out = [];
  for (const d of c.dialogues.values()) {
    if (d.draft) out.push(`hội thoại ${d.id}`);
    else for (const [k, n] of Object.entries(d.nodes)) if (n.draft) out.push(`hội thoại ${d.id}/${k}`);
  }
  for (const r of c.rewards.values()) if (r.draft) out.push(`phần thưởng ${r.id}`);
  for (const v of c.values) if (v.draft) out.push(`giá trị ${v.id} (tên tiếng Anh)`);
  if (c.badge.draft) out.push("huy hiệu 6 giá trị (dòng giải thích)");
  for (const q of c.quizzes.values()) if (q.draft) out.push(`quiz ${q.id}`);
  for (const [id, m] of Object.entries(c.minigames)) {
    if (id.startsWith("_")) continue;
    if (m.draft) out.push(`mini-game ${id}`);
    if (m.draft_snippets) out.push(`mini-game ${id} (các mẩu thông tin)`);
  }
  return out;
}
