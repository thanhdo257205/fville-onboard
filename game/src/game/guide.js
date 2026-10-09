// Hướng dẫn người chơi mới (data/guidance.json): lúc nào cũng biết "giờ làm gì" trong vài giây.
//   • Mục tiêu hiện tại = quest bắt buộc đầu tiên chưa xong của zone (quests.json → target); zone xong hết → zone_exits.
//   • Dấu "!" nổi trên target (nhấp nhô, viền như bảng tên); target ngoài khung nhìn → mũi tên ở mép màn hình.
//     Chỉ hiện lúc đang đi lại (tắt khi hội thoại / mini-game / app / menu / cảnh chuyển); tắt hẳn trong menu Esc.
//   • Không tiến triển nhiệm vụ idle_s giây (chỉ tính lúc đang đi lại) → Tú nói 1 câu bong bóng (không mở hộp thoại,
//     không dừng game); không có Tú đi cùng → tin nhắn điện thoại ngắn (Ms. Huyền zone 0–2, Ms. Nga zone 3–4).
//     Mỗi mục tiêu nhắc tối đa max_nudges lần, cách nhau repeat_s giây.
//   • Phím H / nút Help trong app My FPT: gợi ý của mục tiêu hiện tại (+ việc phụ đang nhận, vd tìm balo cho Tú).
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { worldPos } from "../world/zone.js";
import { tx } from "../content/content.js";
import { t } from "../i18n.js";
import { hud } from "../ui/hud.js";
import { sound } from "../core/sound.js";

const EDGE = { x: 34, top: 74, bottom: 112 };   // mũi tên cách mép màn hình (trên: dòng mục tiêu, dưới: gợi ý E + dòng điều khiển)
const TU_NEAR_M = 15;      // Tú ở xa hơn (vd vừa bị bỏ lại) → coi như không đi cùng, nhắn điện thoại

const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _box = new THREE.Box3();

// phần tử CSS2D neo ở cạnh đáy (bong bóng / dấu "!" nằm ngay phía trên điểm neo)
function anchored(cls, html) {
  const el = document.createElement("div");
  el.className = cls;
  el.innerHTML = html;
  const obj = new CSS2DObject(el);
  obj.center.set(0.5, 1);
  obj.visible = false;
  return obj;
}

export class Guide {
  constructor(game, content) {
    this.g = game;
    const cfg = content.guidance || {};
    this.goals = cfg.goals || {};
    this.exits = cfg.zone_exits || {};
    this.s = { idle_s: 30, repeat_s: 45, max_nudges: 2, bubble_s: 5, phone_s: 7, help_s: 8,
      marker_above_head_m: 0.8, marker_above_object_m: 0.6, marker_above_trigger_m: 0.3, phone_from: {}, ...cfg.settings };
    this.content = content;
    this.mark = anchored("guide-mark", "<span>!</span>");
    this.bubble = anchored("speech", "<span></span>");
    game.scene.add(this.mark, this.bubble);
    this.arrow = document.createElement("div");
    this.arrow.id = "guide-arrow";
    this.arrow.hidden = true;
    this.arrow.innerHTML = "<i></i><span>!</span>";   // i: mũi nhọn (xoay theo hướng), span: dấu "!" (đứng thẳng)
    document.getElementById("hud").appendChild(this.arrow);
    this.goal = null;          // { key, quest, target, data }
    this.idle = 0;             // giây không tiến triển (lúc đang đi lại)
    this.nudged = new Map();   // key mục tiêu → số lần đã nhắc
    this.doneCount = -1;
    this.bubbleLeft = 0;
    this.staticPos = null;     // vị trí "!" của target đứng yên (INT_ / TRIGGER_), tính 1 lần cho mỗi mục tiêu
    this.log = [];             // lịch sử nhắc (để __game kiểm tra)
  }

  get enabled() { return this.g.settings.guide !== false; }

  // mục tiêu hiện tại của zone
  current() {
    const z = this.g.state.zone, q = this.g.progress.currentQuest(z);
    if (q) return { key: q.id, quest: q, target: q.target ?? null, data: this.goals[q.id] || null };
    const ex = this.exits[z];
    return { key: `exit:${z}`, quest: null, target: ex?.target ?? null, data: ex || null };
  }

  // vào zone mới / tải lại zone: tính lại vị trí target
  reset() { this.goal = null; this.staticPos = null; this.hideBubble(); this.hideMarks(); }
  hideMarks() { this.mark.visible = false; this.arrow.hidden = true; }

  // điểm đặt dấu "!" (toạ độ thế giới) hoặc null
  targetPos(target, out) {
    const g = this.g, s = this.s;
    if (!target || !g.zone) return null;
    if (target === "tu") {
      const f = g.follower;
      if (!f || !f.character.root.visible) return null;
      return out.copy(f.character.root.position).setY(f.character.root.position.y + f.character.model.height_m + s.marker_above_head_m);
    }
    const npc = target.startsWith("NPC_") ? g.npc(target) : null;
    if (npc && !npc.hidden) {
      const r = npc.character.root.position;
      return out.copy(r).setY(r.y + npc.character.model.height_m + s.marker_above_head_m);
    }
    if (this.staticPos?.target === target) return this.staticPos.pos ? out.copy(this.staticPos.pos) : null;
    const pos = this.staticTarget(target);
    this.staticPos = { target, pos };
    return pos ? out.copy(pos) : null;
  }

  // target đứng yên: vật do code đặt (vd chiếc ví), TRIGGER_ (đỉnh hộp), INT_ có hình (đỉnh khối) hoặc INT_ rỗng
  // có vùng tương tác (đỉnh hộp TRIGGER_ của vùng = chỗ đứng bấm E)
  staticTarget(target) {
    const g = this.g, s = this.s;
    const obj = g.interaction.list.find((e) => e.item.object === target);
    if (obj) return obj.pos.clone().setY(obj.pos.y + s.marker_above_object_m + 0.3);
    const node = g.zone.nodes.get(target);
    if (!node) return null;
    const top = (n, extra) => { const p = worldPos(n); n.getWorldScale(_s); return p.setY(p.y + Math.abs(_s.y) + extra); };
    if (target.startsWith("TRIGGER_")) return top(node, s.marker_above_trigger_m);
    _box.makeEmpty();
    node.updateWorldMatrix(true, true);
    node.traverse((m) => { if (m.isMesh) _box.expandByObject(m); });
    if (!_box.isEmpty()) { const c = _box.getCenter(new THREE.Vector3()); return c.setY(_box.max.y + s.marker_above_object_m); }
    const it = g.interaction.list.find((e) => e.item.node === target && e.trigger);
    if (it) return top(it.trigger.node, s.marker_above_trigger_m);
    const p = worldPos(node);
    return p.setY(p.y + 2);
  }

  // mỗi khung (Game.update): dấu "!", mũi tên, đếm giờ nhắc, bong bóng
  update(dt, { cutscene = false } = {}) {
    const g = this.g;
    const playing = !cutscene && g.mode === "play" && g.state.phase === "playing" && !!g.zone;
    const goal = this.current();
    // đổi mục tiêu hoặc có quest vừa xong (kể cả việc phụ) → đếm lại
    const done = g.progress.quests.size;
    if (goal.key !== this.goal?.key) { this.goal = goal; this.staticPos = null; this.idle = 0; }
    if (done !== this.doneCount) { this.doneCount = done; this.idle = 0; }
    // dấu "!" + mũi tên
    const pos = playing && this.enabled ? this.targetPos(goal.target, _v) : null;
    this.mark.visible = !!pos;
    if (pos) this.mark.position.copy(pos);
    this.updateArrow(pos);
    // bong bóng của Tú: đi theo đầu Tú; hết giờ hoặc vào hội thoại / mini-game thì tắt
    if (this.bubbleLeft > 0) {
      this.bubbleLeft -= dt;
      const f = g.follower;
      if (this.bubbleLeft <= 0 || !playing || !f) this.hideBubble();
      else this.bubble.position.copy(f.character.root.position).setY(f.character.root.position.y + f.character.model.height_m + 0.55);
    }
    if (!playing) return;
    this.idle += dt;
    const n = this.nudged.get(goal.key) || 0;
    const due = this.s.idle_s + n * this.s.repeat_s;
    if (n < this.s.max_nudges && this.idle >= due) {
      this.nudged.set(goal.key, n + 1);
      this.nudge(goal, n);
    }
  }

  // mũi tên ở mép màn hình chỉ hướng target (khi target ngoài khung nhìn)
  updateArrow(pos) {
    const cam = this.g.camera, el = this.arrow;
    if (!pos) { if (!el.hidden) el.hidden = true; return; }
    const ndc = _s.copy(pos).project(cam);
    const onScreen = ndc.z < 1 && Math.abs(ndc.x) <= 0.97 && Math.abs(ndc.y) <= 0.95;
    if (onScreen) { if (!el.hidden) el.hidden = true; this.arrowInfo = null; return; }
    // hướng trong không gian camera (x phải, y lên); target sau lưng → chúc xuống (quay người lại)
    const c = _s.copy(pos).applyMatrix4(cam.matrixWorldInverse);
    let dx = c.x, dy = c.y;
    if (c.z > 0) dy = -Math.abs(dy) - 0.6 * Math.hypot(dx, dy) - 0.01;
    const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    // khung đặt mũi tên: màn hình trừ lề; tia từ tâm khung theo hướng (ux, uy) cắt cạnh khung
    const x0 = EDGE.x, x1 = innerWidth - EDGE.x, y0 = EDGE.top, y1 = innerHeight - EDGE.bottom;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const k = Math.min((x1 - cx) / Math.max(Math.abs(ux), 1e-4), (y1 - cy) / Math.max(Math.abs(uy), 1e-4));
    const x = cx + ux * k, y = cy - uy * k;
    const deg = Math.atan2(ux, uy) * 180 / Math.PI;    // 0 = chỉ lên
    el.hidden = false;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    el.firstChild.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    this.arrowInfo = { x: Math.round(x), y: Math.round(y), deg: Math.round(deg) };
  }

  tuWithPlayer() {
    const f = this.g.follower, p = this.g.player;
    return !!(f && !f.waiting && f.character.root.visible && p && f.position.distanceTo(p.position) < TU_NEAR_M);
  }

  // nhắc lần i (0, 1): Tú nói bong bóng, không có Tú → tin nhắn điện thoại
  nudge(goal, i) {
    const d = goal.data;
    if (!d) return;
    const vars = { player: this.g.progress.player.name };
    const pick = (list) => (list?.length ? list[Math.min(i, list.length - 1)] : null);
    const line = pick(d.tu), msg = pick(d.phone);
    if (line && this.tuWithPlayer()) {
      this.say(tx(line, vars));
      this.log.push({ key: goal.key, n: i + 1, kind: "tu", text: tx(line, vars) });
    } else if (msg) {
      const role = this.s.phone_from[this.g.state.zone] || "thao";
      const who = this.g.speakerInfo(role);
      sound.play("phone");
      hud.phone({ name: who.name, portrait: who.portrait, label: t("guide.phone_label"), text: tx(msg, vars) }, this.s.phone_s);
      this.log.push({ key: goal.key, n: i + 1, kind: "phone", from: role, text: tx(msg, vars) });
    }
  }

  // bong bóng lời Tú trên đầu (không dừng game)
  say(text) {
    const f = this.g.follower;
    if (!f) return;
    sound.play("nudge");
    this.bubble.element.querySelector("span").textContent = text;
    this.bubble.position.copy(f.character.root.position).setY(f.character.root.position.y + f.character.model.height_m + 0.55);
    this.bubble.visible = true;
    this.bubble.element.classList.remove("show"); void this.bubble.element.offsetWidth;
    this.bubble.element.classList.add("show");
    this.bubbleLeft = this.s.bubble_s;
  }
  hideBubble() { this.bubble.visible = false; this.bubbleLeft = 0; this.bubble.element.classList.remove("show"); }

  // gợi ý của mục tiêu hiện tại (+ việc phụ đang nhận trong zone) → mảng dòng chữ
  helpLines() {
    const g = this.g, vars = { player: g.progress.player.name };
    const goal = this.current();
    const lines = [];
    if (goal.data?.help) lines.push(tx(goal.data.help, vars));
    else if (goal.quest) lines.push(tx(goal.quest.title));
    // việc phụ đã nhận (quest không bắt buộc có visible_if đang hiện, chưa xong), vd tìm balo cho Tú, trả ví
    for (const q of this.content.quests) {
      if (q.zone !== g.state.zone || q.required || !q.visible_if || g.progress.quests.has(q.id) || !g.progress.check(q.visible_if)) continue;
      const h = this.goals[q.id]?.help;
      if (h) lines.push(t("guide.also", { text: tx(h, vars) }));
    }
    return lines;
  }

  // phím H: hiện / ẩn thẻ gợi ý
  help() {
    const lines = this.helpLines();
    if (!lines.length) return;
    sound.play("help");
    hud.help(t("guide.help_title"), lines, this.s.help_s);
  }

  info() {
    const goal = this.current();
    return { goal: goal.key, target: goal.target, marker: this.mark.visible ? this.mark.position.toArray().map((x) => +x.toFixed(2)) : null,
      arrow: this.arrow.hidden ? null : this.arrowInfo, idle: +this.idle.toFixed(1), nudged: Object.fromEntries(this.nudged),
      bubble: this.bubble.visible ? this.bubble.element.textContent : null, enabled: this.enabled, log: this.log };
  }
}
