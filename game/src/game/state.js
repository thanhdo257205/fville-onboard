// Trạng thái chơi + hiệu ứng (GDD: hieu_biet, ket_noi, value, reward, flags, quest; thêm item/remove_item cho vật mang theo)
// + lưu vào localStorage (bọc try/catch: trình duyệt chặn bộ nhớ thì vẫn chơi được, chỉ không lưu).
import { tx, draftMark } from "../content/content.js";
import { t } from "../i18n.js";

const SAVE_KEY = "fville.save.v1";
const STATS = ["hieu_biet", "ket_noi"];
const list = (x) => (x == null ? [] : [].concat(x));

export class GameState {
  constructor(content) { this.c = content; this.reset(); }

  reset() {
    this.player = { name: "", position: "" };
    this.stats = { hieu_biet: 0, ket_noi: 0 };
    this.values = new Set();      // giá trị đã thể hiện (sáng khi có huy hiệu 6 giá trị)
    this.rewards = [];            // theo thứ tự nhận
    this.items = [];              // vật mang theo tạm
    this.quests = new Set();
    this.flags = new Set();
    this.grains = new Set();       // hạt lúa vàng đã nhặt
    this.photos = {};              // ảnh chụp: { checkin, id } = data URL JPEG (đã nén)
    this.zone = null;
    this.created = false;
  }

  hasReward(id) { return this.rewards.includes(id); }

  // điều kiện { flags, not_flags, quests, rewards, items }
  check(cond) {
    if (!cond) return true;
    return list(cond.flags).every((f) => this.flags.has(f))
      && list(cond.not_flags).every((f) => !this.flags.has(f))
      && list(cond.quests).every((q) => this.quests.has(q))
      && list(cond.rewards).every((r) => this.hasReward(r))
      && list(cond.items).every((i) => this.items.includes(i))
      && list(cond.grains).every((g) => this.grains.has(g));
  }

  // áp hiệu ứng → danh sách thông báo (chữ đã dịch) để HUD hiện lần lượt
  apply(e = {}) {
    const out = [];
    const quests = list(e.quest);
    // làm lại việc đã xong: không cộng điểm/phần thưởng lần nữa (chỉ cập nhật cờ)
    const repeat = quests.length > 0 && quests.every((q) => this.quests.has(q));
    for (const f of list(e.flags)) this.flags.add(f);
    for (const g of list(e.grain)) if (!this.grains.has(g)) { this.grains.add(g); out.push(t("hud.grain_found", { n: this.grains.size, total: this.c.grainsTotal })); }
    if (e.photo) { this.photos[e.photo.key] = e.photo.data; out.push(t(`hud.photo_saved_${e.photo.key}`)); }
    for (const id of list(e.item)) if (!this.items.includes(id)) { this.items.push(id); out.push(t("hud.item_new", { name: tx(this.c.carry.get(id)?.name) })); }
    for (const id of list(e.remove_item)) if (this.items.includes(id)) { this.items = this.items.filter((x) => x !== id); out.push(t("hud.item_gone", { name: tx(this.c.carry.get(id)?.name) })); }
    if (repeat) return out;
    for (const s of STATS) if (e[s]) {
      const before = this.stats[s];
      this.stats[s] = Math.min(100, Math.max(0, before + e[s]));
      if (this.stats[s] !== before) out.push(t("hud.stat_gain", { n: this.stats[s] - before, stat: t(`stats.${s}`) }));
    }
    for (const id of list(e.reward)) {
      if (this.hasReward(id)) continue;
      this.rewards.push(id);
      const r = this.c.rewards.get(id);
      out.push(draftMark(r?.draft) + t("hud.reward_new", { name: tx(r?.name) }));
      // nhận huy hiệu 6 giá trị → các ô đã thể hiện từ trước sáng lên ngay
      if (id === this.c.badge.reward) for (const v of this.values) out.push(t("hud.value_earlier", { name: tx(this.c.valueById.get(v)?.name) }));
    }
    for (const v of list(e.value)) {
      if (this.values.has(v)) continue;
      this.values.add(v);
      const name = tx(this.c.valueById.get(v)?.name);
      out.push(t(this.hasReward(this.c.badge.reward) ? "hud.value_lit" : "hud.value_saved", { name }));
    }
    for (const q of quests) {
      if (this.quests.has(q)) continue;
      this.quests.add(q);
      const ck = this.c.questById.get(q)?.checklist;
      if (ck && this.checklistDone(ck)) out.push(t("hud.checklist_done", { name: tx(this.c.checklist.find((x) => x.id === ck)?.title) }));
    }
    return out;
  }

  checklistDone(id) {
    const qs = this.c.quests.filter((q) => q.checklist === id && q.required);
    return qs.length > 0 && qs.every((q) => this.quests.has(q.id));
  }

  // việc chính tiếp theo trong zone (bắt buộc, chưa xong, đang hiện)
  currentQuest(zone) {
    return this.c.quests.find((q) => q.zone === zone && q.required && !this.quests.has(q.id) && this.check(q.visible_if)) || null;
  }
  missingFor(questIds) { return list(questIds).filter((q) => !this.quests.has(q)); }

  valueLit(id) { return this.values.has(id) && this.hasReward(this.c.badge.reward); }

  toJSON() {
    return {
      v: 1, player: this.player, stats: this.stats, values: [...this.values], rewards: this.rewards, items: this.items,
      quests: [...this.quests], flags: [...this.flags], grains: [...this.grains], photos: this.photos, zone: this.zone, created: this.created,
    };
  }
  fromJSON(o) {
    this.reset();
    Object.assign(this.player, o.player || {});
    Object.assign(this.stats, o.stats || {});
    this.values = new Set(o.values || []);
    this.rewards = o.rewards || [];
    this.items = o.items || [];
    this.quests = new Set(o.quests || []);
    this.flags = new Set(o.flags || []);
    this.grains = new Set(o.grains || []);
    this.photos = o.photos || {};
    this.zone = o.zone || null;
    this.created = !!o.created;
    // bản lưu cũ (trước khi có zone_00): đã ở zone sau → coi như xong mọi việc bắt buộc của các zone trước
    // (trigger chuyển zone đã đòi các việc đó), vd mục checklist Xe Bus FPT giờ gồm cả việc lên xe ở zone_00
    const order = this.c.zoneOrder || [];
    const at = order.indexOf(this.zone);
    if (at > 0) for (const q of this.c.quests) if (q.required && order.indexOf(q.zone) >= 0 && order.indexOf(q.zone) < at) this.quests.add(q.id);
  }
}

export const save = {
  load() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  },
  store(state) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.toJSON())); return true; } catch { return false; }
  },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch { /* bỏ qua */ } },
};
