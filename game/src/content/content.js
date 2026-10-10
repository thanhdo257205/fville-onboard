// Nội dung game từ data/*.json (GDD Phụ lục): dialogues, quests, interactables, quiz, rewards, values, cutscenes,
// guidance (hướng dẫn người chơi mới: gợi ý H, câu nhắc khi đứng yên), acts (4 Act), achievements (thành tựu cuối, danh hiệu).
// Chữ hiển thị trong nội dung là object theo mã ngôn ngữ {"en": "..."} → tx() chọn theo ngôn ngữ hiện tại.
// Kiểm tra khi tải: mọi node mà JSON nhắc tới phải có thật trong GLB của zone đó; tham chiếu nội bộ phải khớp.
import { loadJSON, url } from "../core/fetch.js";
import { lang, t, fill } from "../i18n.js";

export const FILES = ["dialogues", "quests", "interactables", "quiz", "rewards", "values", "cutscenes", "guidance", "acts", "achievements"];

export async function loadContent() {
  return buildContent(Object.fromEntries(await Promise.all(FILES.map(async (f) => [f, await loadJSON(url(`data/${f}.json`))]))));
}

// raw: { dialogues: <data/dialogues.json>, … } — dùng chung cho game và Node (npm run test:data)
export function buildContent(raw) {
  return {
    raw,
    dialogues: new Map(raw.dialogues.dialogues.map((d) => [d.id, d])),
    quests: raw.quests.quests,
    questById: new Map(raw.quests.quests.map((q) => [q.id, q])),
    checklist: raw.quests.checklist,
    triggers: raw.quests.triggers,
    // hạt lúa vàng (interactables.json → grains) thành vật tương tác do code đặt: nhặt = grain:<id>
    interactables: [...raw.interactables.items, ...(raw.interactables.grains || []).map((g) => ({
      zone: g.zone, object: g.id, pos: g.pos, snap: g.snap, model: "grain", radius: g.radius ?? 1.4, prompt: raw.interactables.grain_prompt,
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
    guidance: raw.guidance,
    acts: raw.acts,
    achievements: raw.achievements,
    advice: raw.rewards.advice || [],
    adviceById: new Map((raw.rewards.advice || []).map((a) => [a.id, a])),
  };
}

// chữ theo ngôn ngữ + thay {biến} (vars của chỗ gọi, rồi biến chung i18n.textVars — vd đại từ của Tú {tu_his})
export function tx(obj, vars = {}) {
  if (obj == null) return "";
  const s = typeof obj === "string" ? obj : obj[lang] ?? obj.en ?? "";
  return fill(s, vars);
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
  for (const [zone, ex] of Object.entries(c.guidance?.zone_exits || {})) add(zone, ex.target, `guidance.json · zone_exits.${zone} · target`);
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
    if (cs.office) add(cs.office.zone, cs.office.seat, `${w} · office.seat`);          // cảnh kết
    for (const k of ["spawn", "door"]) if (cs.bus_stop) add(cs.bus_stop.zone, cs.bus_stop[k], `${w} · bus_stop.${k}`, true);
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
  const needAdvice = (id, where) => { for (const a of [].concat(id || [])) if (!c.adviceById.has(a)) errs.push(`${where}: không có lời khuyên ${a} (rewards.json → advice)`); };
  const checkEffects = (e, where) => {
    if (!e) return;
    needReward(e.reward, where); needValue(e.value, where); needQuest(e.quest, where); needItem(e.item, where); needItem(e.remove_item, where);
    needAdvice(e.advice, where);
    if (e.time_skip && !e.time_skip.card) errs.push(`${where}: time_skip thiếu card`);
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
    if (cs.office?.dialogue && !c.dialogues.has(cs.office.dialogue)) errs.push(`cutscenes.json · ${id}: không có hội thoại ${cs.office.dialogue}`);
    checkEffects(cs.effects, `cutscenes.json · ${id} · effects`);
  }
  for (const q of c.quests) if (q.checklist && !c.checklist.some((x) => x.id === q.checklist)) errs.push(`quest ${q.id}: không có mục checklist ${q.checklist}`);
  // hướng dẫn: mỗi quest bắt buộc có gợi ý (help) + 2 câu nhắc của Tú (trừ zone không có Tú: settings.no_tu_zones)
  // + 2 tin nhắn điện thoại; mọi quest có help
  const gd = c.guidance || {};
  const noTu = new Set(gd.settings?.no_tu_zones || []);
  for (const id of Object.keys(gd.goals || {})) if (!c.questById.has(id)) errs.push(`guidance.json · goals.${id}: không có quest ${id}`);
  for (const q of c.quests) {
    const g = gd.goals?.[q.id], where = `guidance.json · goals.${q.id}`;
    if (!g?.help) errs.push(`${where}: thiếu help`);
    if (q.required && !noTu.has(q.zone) && (g?.tu?.length ?? 0) < 2) errs.push(`${where}: cần 2 câu nhắc của Tú (tu)`);
    if (q.required && (g?.phone?.length ?? 0) < 2) errs.push(`${where}: cần 2 tin nhắn điện thoại (phone)`);
  }
  for (const zone of c.zoneOrder || []) {
    if (!c.quests.some((q) => q.zone === zone)) continue;
    if (!gd.zone_exits?.[zone]?.help) errs.push(`guidance.json · zone_exits.${zone}: thiếu help (zone đã xong hết việc)`);
  }
  // 4 Act: mỗi mục checklist thuộc đúng 1 Act, Act chỉ nhắc mục có thật
  const inAct = new Map();
  for (const a of c.acts?.acts || []) for (const id of a.checklist || []) {
    if (!c.checklist.some((x) => x.id === id)) errs.push(`acts.json · ${a.id}: không có mục checklist ${id}`);
    if (inAct.has(id)) errs.push(`acts.json: mục checklist ${id} nằm ở cả ${inAct.get(id)} và ${a.id}`);
    inAct.set(id, a.id);
  }
  for (const x of c.checklist) if (!inAct.has(x.id)) errs.push(`acts.json: mục checklist ${x.id} chưa thuộc Act nào`);
  for (const a of c.advice) if (!a.text) errs.push(`rewards.json · advice.${a.id}: thiếu text`);
  if (!c.achievements?.final?.title) errs.push("achievements.json: thiếu final (thành tựu cuối)");
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
