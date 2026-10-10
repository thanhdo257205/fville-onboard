// Tự chơi theo data (không cần DOM / three.js — chạy được cả trong Node: scripts/tests/data.mjs):
//   • pickChoice: chọn đáp án như người chơi "tốt": câu có giá trị (value) > câu dẫn tới giá trị > câu dẫn tới việc đang làm
//     > câu đầu. Dùng cho __game.resolve() (smoke test) và bản lưu mẫu.
//   • buildStartState: bản lưu mẫu "đã chơi xong các zone trước zone X" (?start=zone_0X khi phát triển hoặc ?debug;
//     npm run test:smoke -- --zone N) — dựng từ data, không ghi tay: lần lượt từng zone trước X, từng việc bắt buộc
//     (quests.json, theo thứ tự): chạy nhanh hội thoại gắn với đích của việc (interactables.json → action, như bấm E) —
//     rẽ nhánh theo trạng thái, lựa chọn theo pickChoice, mini-game → áp result trong data; đích là vùng kích hoạt có cảnh
//     chuyển (vd lên xe bus) → hội thoại + effects của cảnh chuyển; hội thoại on_enter của zone (vd tin nhắn HR).
//     Giới hạn: phần thưởng mini-game tự tính lúc chơi (Hiểu biết của quiz, ô Innovation của Lộ trình học…) không có;
//     việc không bắt buộc (balo của Tú, ví đánh rơi) không làm.
const list = (x) => (x == null ? [] : [].concat(x));

// node kế tiếp có thể đi tới từ một node (bỏ qua điều kiện): next, nhánh, lựa chọn
const nexts = (n) => [n.next, ...(n.branch || []).map((b) => b.next), ...(n.choices || []).map((c) => c.next)].filter((x) => x != null);

// từ node `from` (không đi qua node có lựa chọn khác, tối đa `depth` bước) có node nào thỏa test(effects, node) không
function reaches(d, from, test, depth = 24) {
  const seen = new Set();
  const stack = [[from, 0]];
  while (stack.length) {
    const [k, n] = stack.pop();
    if (k == null || seen.has(k) || n > depth) continue;
    seen.add(k);
    const node = d.nodes[k];
    if (!node) continue;
    if (test(node.effects || {}, node)) return true;
    if (node.choices) { if (node.choices.some((c) => test(c.effects || {}, c))) return true; continue; }
    for (const x of nexts(node)) stack.push([x, n + 1]);
  }
  return false;
}

// minigame mà action của node trỏ tới có result chứa quest q
const minigameGives = (c, node, q) => {
  const [kind, id] = String(node.action || "").split(":");
  return kind === "minigame" && list(c.minigames[id]?.result?.quest).includes(q);
};

// choices: các lựa chọn đang hiện (đã lọc điều kiện if) của node `key` trong hội thoại `dialogueId`; goal: id quest đang làm
export function pickChoice(c, dialogueId, key, choices, goal = null) {
  const d = c.dialogues.get(dialogueId);
  if (!d || !choices?.length) return 0;
  const hasValue = (e) => list(e.value).length > 0;
  const hasGoal = (e, node) => !!goal && (list(e.quest).includes(goal) || minigameGives(c, node, goal));
  let best = 0, bestScore = -1;
  choices.forEach((ch, i) => {
    const e = ch.effects || {};
    const score = hasValue(e) ? 3 : reaches(d, ch.next, hasValue) ? 2 : hasGoal(e, ch) || reaches(d, ch.next, hasGoal) ? 1 : 0;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

// chạy nhanh 1 hội thoại trên state (GameState): như DialogueRunner nhưng không hiện gì. apply(effects) = áp hiệu ứng
export function fastForward(c, state, id, { goal = null, apply = (e) => state.apply(e) } = {}) {
  const d = c.dialogues.get(id);
  if (!d) return;
  const eff = (e) => { if (!e) return; apply(e.time_skip?.flags ? { ...e, flags: [...list(e.flags), ...e.time_skip.flags] } : e); };
  let key = d.start, guard = 0;
  while (key != null && guard++ < 200) {
    const n = d.nodes[key];
    if (!n) break;
    if (n.branch) { key = (n.branch.find((b) => state.check(b.if)) || { next: n.next }).next; continue; }
    if (n.action) {
      const [kind, arg] = n.action.split(":");
      if (kind === "minigame") eff(c.minigames[arg]?.result);
      key = n.next;
      continue;
    }
    eff(n.effects);
    if (n.choices) {
      const vis = n.choices.filter((ch) => state.check(ch.if));
      if (!vis.length) break;
      const ch = vis[pickChoice(c, id, key, vis, goal)];
      eff(ch.effects);
      key = ch.next;
    } else key = n.next;
  }
}

// điểm tương tác của quest (đích = node / actor / object trong zone của quest) đang dùng được với state
function sourceOf(c, state, q) {
  const hide = (h) => !!h && (list(h.flags).some((f) => state.flags.has(f)) || list(h.quests).some((x) => state.quests.has(x))
    || list(h.rewards).some((r) => state.hasReward(r)) || list(h.grains).some((g) => state.grains.has(g)));
  return c.interactables.find((it) => it.zone === q.zone && [it.node, it.actor, it.object].includes(q.target)
    && !hide(it.hide_if) && state.check(it.requires)) || null;
}

// zones: data/zones.json. Trả { problems } — việc bắt buộc nào không làm xong được từ data (báo trong npm run test:data)
export function buildStartState(c, zones, zoneId, state) {
  const order = zones.order, at = order.indexOf(zoneId), problems = [];
  if (at < 0) return { problems: [`không có zone ${zoneId}`] };
  for (const z of order.slice(0, at)) {
    const oe = zones.zones[z]?.on_enter;
    if (oe?.dialogue) fastForward(c, state, oe.dialogue);
    if (oe?.once_flag) state.flags.add(oe.once_flag);
    for (const q of c.quests.filter((x) => x.zone === z && x.required)) {
      if (state.quests.has(q.id)) continue;
      const tr = c.triggers.find((x) => x.zone === z && x.node === q.target && x.cutscene);
      if (tr) {
        const cs = c.cutscenes[tr.cutscene] || {};
        if (cs.dialogue) fastForward(c, state, cs.dialogue, { goal: q.id });
        state.apply(cs.effects || {});
      } else {
        const it = sourceOf(c, state, q);
        const [kind, id] = String(it?.action || "").split(":");
        if (kind === "dialogue") fastForward(c, state, id, { goal: q.id });
        else if (kind === "minigame") state.apply(c.minigames[id]?.result || {});
      }
      if (!state.quests.has(q.id)) problems.push(`${zoneId}: bản lưu mẫu không làm xong được ${q.id} (${z}, đích ${q.target})`);
    }
  }
  state.zone = zoneId;
  return { problems };
}
