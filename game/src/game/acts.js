// 4 Act của ngày đầu (data/acts.json): mỗi Act gồm các mục checklist (quests.json → checklist). Act xong khi mọi mục xong.
// Thẻ tiêu đề Act (không chặn điều khiển) hiện khi bắt đầu game (Act hiện tại) và ngay khi xong mục cuối của Act trước —
// không phụ thuộc chuyển zone. Thành tựu cuối + danh hiệu (data/achievements.json) cho màn tổng kết.
import { tx } from "../content/content.js";
import { hud } from "../ui/hud.js";

export class Acts {
  constructor(game, content) {
    this.g = game;
    this.c = content;
    this.cfg = content.acts || { acts: [] };
    this.list = this.cfg.acts || [];
    this.done = new Set();     // Act đã xong (để biết Act nào vừa xong)
    this.log = [];             // các thẻ Act đã hiện (để __game kiểm tra)
  }

  itemStatus(id) {
    const s = this.g.progress, has = this.c.quests.some((q) => q.checklist === id);
    return { id, done: s.checklistDone(id), locked: !has };
  }
  status() {
    return this.list.map((a) => {
      const items = a.checklist.map((id) => this.itemStatus(id));
      const n = items.filter((x) => x.done).length;
      return { act: a, items, done: n, total: items.length, complete: n === items.length };
    });
  }
  // Act hiện tại = Act đầu tiên chưa xong
  current() { return this.status().find((x) => !x.complete) || null; }

  // bắt đầu game (tạo mới hoặc chơi tiếp): ghi nhận Act đã xong, hiện thẻ Act hiện tại
  start() {
    this.done = new Set(this.status().filter((x) => x.complete).map((x) => x.act.id));
    const cur = this.current();
    if (cur) this.announce(cur.act);
  }

  // sau mỗi lần áp hiệu ứng (Game.applyEffects): Act vừa xong → hiện thẻ Act kế tiếp
  update() {
    for (const st of this.status()) {
      if (!st.complete || this.done.has(st.act.id)) continue;
      this.done.add(st.act.id);
      const next = this.list[this.list.indexOf(st.act) + 1];
      if (next) this.announce(next);
    }
  }

  announce(act) {
    this.log.push(act.id);
    hud.actCard(act.number, tx(act.title), this.cfg.card_seconds ?? 2.2);
  }

  info() {
    return { current: this.current()?.act.id ?? null, shown: [...this.log],
      acts: this.status().map((x) => ({ id: x.act.id, done: x.done, total: x.total, complete: x.complete, locked: x.items.filter((i) => i.locked).map((i) => i.id) })) };
  }
}

// danh hiệu ở màn tổng kết (data/achievements.json → titles): xếp cao → thấp; chính = dòng đầu đạt, phụ = các dòng khác đạt
// (dòng mặc định "if": null chỉ hiện khi không đạt dòng nào khác)
export function earnedTitles(content, s) {
  const list = content.achievements?.titles || [];
  const ok = (c) => {
    if (!c) return true;
    if (c.values_all && !content.values.every((v) => s.valueLit(v.id))) return false;
    if (c.flags && !c.flags.every((f) => s.flags.has(f))) return false;
    if (c.stat && !Object.entries(c.stat).every(([k, v]) => (s.stats[k] ?? 0) >= v)) return false;
    if (c.grains_all && s.grains.size < (content.grainsTotal ?? 10)) return false;
    return true;
  };
  const got = list.filter((x) => x.if && ok(x.if));
  return got.length ? got : list.filter((x) => !x.if);
}
