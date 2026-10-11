// Hộp hội thoại: chân dung bên trái, tên người nói, lời thoại; tiếp lời bằng Space/click, chọn đáp án bằng phím 1–4 hoặc click
// (cảm ứng: chạm vào hộp / bất kỳ đâu trên màn hình để nói tiếp, chạm vào lựa chọn).
// Màn thấp (body.short — ui/touch.js): khung nhỏ lại, cao tối đa bằng vùng nhìn thấy (--vvh), nội dung dài thì cuộn bằng ngón tay
// (kéo cuộn không tính là chọn: trình duyệt không bắn click khi ngón đã kéo); mở câu mới → cuộn về đầu (tên + câu hỏi). Dòng
// "Chạm…" không chiếm dòng riêng: cuối câu thoại (nói tiếp), ô trống cuối lưới lựa chọn (số lựa chọn lẻ, 2 cột) hoặc cạnh tên.
// body.talking: đang mở hộp thoại (CSS ẩn bảng tên, dòng mục tiêu / đồng hồ / "N online" trên màn thấp); .choosing: đang chọn.
// Chạy cây hội thoại trong dialogues.json: branch / action (mini-game) / lời thoại có anim / choices + effects.
// Tiếng: sang câu (line), chọn đáp án (select), câu kiểu tin nhắn style "phone" (phone); câu có "sfx": "<tên>" (data/sounds.json)
// phát tiếng đó khi câu hiện (vd tiếng bíp đầu đọc thẻ ở cửa quẹt thẻ zone 4).
import { tx, draftMark } from "../content/content.js";
import { t } from "../i18n.js";
import { url } from "../core/assets.js";
import { sound } from "../core/sound.js";
import { device } from "../core/device.js";

const TWO_COL_MIN = 520;   // màn thấp rộng hơn chừng ấy px: lựa chọn xếp 2 cột (style.css, cùng số)

export class DialogueUI {
  constructor() {
    const el = document.createElement("div");
    el.id = "dialogue";
    el.hidden = true;
    el.innerHTML = `<img class="portrait" alt=""><div class="body"><div class="head"><div class="name"></div></div><div class="text"></div>
      <ol class="choices"></ol><div class="more"></div></div>`;
    document.body.appendChild(el);
    this.el = el;
    this.moreEl = el.querySelector(".more");   // giữ tham chiếu: màn thấp dời nó vào trong câu thoại (textContent xoá mất)
    this.waiting = null;   // { kind: "next" | "choice", resolve, count }
    el.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) this.choose(+li.dataset.i);
      else if (this.waiting?.kind === "next") this.next();
    });
  }
  get open() { return !this.el.hidden; }
  show({ name, portrait, text, choices, style = null }) {
    this.el.hidden = false;
    document.body.classList.add("talking");
    this.el.classList.toggle("choosing", !!choices?.length);
    this.el.classList.toggle("narrator", !name);
    this.el.classList.toggle("phone", style === "phone");
    const img = this.el.querySelector(".portrait");
    img.hidden = !portrait;
    if (portrait) img.src = portrait;
    this.el.querySelector(".name").textContent = name || "";
    const textEl = this.el.querySelector(".text");
    textEl.textContent = text;
    const ol = this.el.querySelector(".choices");
    ol.innerHTML = (choices || []).map((c, i) => `<li data-i="${i}"><b>${i + 1}</b> <span>${escapeHtml(c)}</span></li>`).join("");
    // cảm ứng: "Chạm để nói tiếp" (chạm bất kỳ đâu — ui/touch.js) / "Chạm vào một lựa chọn"
    const more = this.moreEl;
    more.textContent = choices?.length ? t(device.touch ? "dialogue.choose_touch" : "dialogue.choose_hint", { n: choices.length })
      : t(device.touch ? "dialogue.continue_touch" : "dialogue.continue");
    // màn thấp: dòng "Chạm…" vào chỗ trống sẵn có; màn thường: dòng riêng cuối khung như cũ
    const short = document.body.classList.contains("short"), n = choices?.length || 0;
    if (!short) this.el.querySelector(".body").appendChild(more);
    else if (!n) textEl.appendChild(more);
    else if (n % 2 && innerWidth > TWO_COL_MIN) ol.appendChild(more);
    else this.el.querySelector(".head").appendChild(more);
    this.el.scrollTop = 0;
    return new Promise((resolve) => { this.waiting = { kind: choices?.length ? "choice" : "next", resolve, count: choices?.length || 0 }; });
  }
  // auto: tự sang câu (cảnh chuyển) → không có tiếng
  next({ auto = false } = {}) { if (this.waiting?.kind === "next") { const w = this.waiting; this.waiting = null; if (!auto) sound.play("line"); w.resolve(null); } }
  choose(i) { if (this.waiting?.kind === "choice" && i >= 0 && i < this.waiting.count) { const w = this.waiting; this.waiting = null; sound.play("select"); w.resolve(i); } }
  hide() { this.el.hidden = true; this.waiting = null; document.body.classList.remove("talking"); }
  // huỷ hội thoại đang chờ (vd chuyển zone) — trả 'abort' cho vòng chạy
  abort() { const w = this.waiting; this.waiting = null; this.el.hidden = true; document.body.classList.remove("talking"); w?.resolve("abort"); }
  get snapshot() {
    if (!this.open) return null;
    return { name: this.el.querySelector(".name").textContent, text: this.el.querySelector(".text").textContent,
      choices: [...this.el.querySelectorAll(".choices li[data-i]")].map((li) => li.textContent.trim()), waiting: this.waiting?.kind || null };
  }
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

// Chạy 1 hội thoại. hooks: speakerInfo(role) → {name, portrait}; effects(e); minigame(id) → Promise<bool>; npc (Npc | null)
export class DialogueRunner {
  constructor({ content, state, ui, hooks }) { Object.assign(this, { c: content, state, ui, hooks }); this.active = null; }

  abort() { if (this.active) { this.active.aborted = true; this.ui.abort(); } }

  // auto (giây): lời thoại không có lựa chọn tự sang câu sau (cảnh chuyển); Space/click vẫn bỏ qua nhanh được
  async run(id, { npc = null, vars = {}, auto = 0 } = {}) {
    const d = this.c.dialogues.get(id);
    if (!d) throw new Error(`không có hội thoại ${id}`);
    this.active = { id, node: d.start };
    const v = { player: this.state.player.name || "", grains: this.state.grains.size, grains_total: this.c.grainsTotal ?? 10, ...vars };
    let key = d.start, guard = 0;
    try {
      while (key != null && guard++ < 200) {
        const n = d.nodes[key];
        this.active.node = key;
        if (n.branch) { key = (n.branch.find((b) => this.state.check(b.if)) || { next: n.next }).next; continue; }
        if (n.action) {
          this.ui.hide();
          const [kind, arg] = n.action.split(":");
          if (kind === "minigame") { if (!(await this.hooks.minigame(arg))) break; }   // bỏ ngang → kết thúc hội thoại
          else await this.hooks.action?.(kind, arg);    // vd sit:<SPAWN_> (người chơi ngồi vào ghế), stand
          if (this.active?.aborted) break;
          key = n.next;
          continue;
        }
        if (n.effects) this.hooks.effects(n.effects);
        // diễn: NPC đang nói thì talk (+ anim 1 lần), người chơi nói thì NPC nghe
        if (npc) { if (n.speaker === "player") npc.listen(); else if (n.speaker !== "narrator") npc.speak(n.anim, n.speaker); }
        this.hooks.line?.(n);   // vd camera hội thoại (Game.onLine)
        const who = this.hooks.speakerInfo(n.speaker);
        const text = draftMark(d.draft || n.draft) + tx(n.text, v);
        const choices = n.choices?.filter((ch) => this.state.check(ch.if)).map((ch) => tx(ch.text, v));
        const shown = this.ui.show({ name: who.name, portrait: who.portrait, text, choices, style: n.style || null });
        let timer = null;
        if (n.sfx) sound.play(n.sfx);
        else if (n.style === "phone") sound.play("phone");
        if (auto && !choices?.length) timer = setTimeout(() => this.ui.next({ auto: true }), auto * 1000);
        const pick = await shown;
        clearTimeout(timer);
        if (pick === "abort" || this.active?.aborted) break;
        if (n.choices) {
          const ch = n.choices.filter((c) => this.state.check(c.if))[pick];
          if (ch.effects) this.hooks.effects(ch.effects);
          key = ch.next;
        } else key = n.next;
      }
    } finally {
      this.ui.hide();
      this.active = null;
    }
  }
}

export const portraitUrl = (p) => (p ? url(p) : null);
