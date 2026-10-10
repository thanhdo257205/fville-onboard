// Hộp hội thoại: chân dung bên trái, tên người nói, lời thoại; tiếp lời bằng Space/click, chọn đáp án bằng phím 1–4 hoặc click.
// Chạy cây hội thoại trong dialogues.json: branch / action (mini-game) / lời thoại có anim / choices + effects.
// Tiếng: sang câu (line), chọn đáp án (select), câu kiểu tin nhắn style "phone" (phone); câu có "sfx": "<tên>" (data/sounds.json)
// phát tiếng đó khi câu hiện (vd tiếng bíp đầu đọc thẻ ở cửa quẹt thẻ zone 4).
import { tx, draftMark } from "../content/content.js";
import { t } from "../i18n.js";
import { url } from "../core/assets.js";
import { sound } from "../core/sound.js";

export class DialogueUI {
  constructor() {
    const el = document.createElement("div");
    el.id = "dialogue";
    el.hidden = true;
    el.innerHTML = `<img class="portrait" alt=""><div class="body"><div class="name"></div><div class="text"></div>
      <ol class="choices"></ol><div class="more"></div></div>`;
    document.body.appendChild(el);
    this.el = el;
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
    this.el.classList.toggle("narrator", !name);
    this.el.classList.toggle("phone", style === "phone");
    const img = this.el.querySelector(".portrait");
    img.hidden = !portrait;
    if (portrait) img.src = portrait;
    this.el.querySelector(".name").textContent = name || "";
    this.el.querySelector(".text").textContent = text;
    const ol = this.el.querySelector(".choices");
    ol.innerHTML = (choices || []).map((c, i) => `<li data-i="${i}"><b>${i + 1}</b> ${escapeHtml(c)}</li>`).join("");
    this.el.querySelector(".more").textContent = choices?.length ? t("dialogue.choose_hint", { n: choices.length }) : t("dialogue.continue");
    return new Promise((resolve) => { this.waiting = { kind: choices?.length ? "choice" : "next", resolve, count: choices?.length || 0 }; });
  }
  // auto: tự sang câu (cảnh chuyển) → không có tiếng
  next({ auto = false } = {}) { if (this.waiting?.kind === "next") { const w = this.waiting; this.waiting = null; if (!auto) sound.play("line"); w.resolve(null); } }
  choose(i) { if (this.waiting?.kind === "choice" && i >= 0 && i < this.waiting.count) { const w = this.waiting; this.waiting = null; sound.play("select"); w.resolve(i); } }
  hide() { this.el.hidden = true; this.waiting = null; }
  // huỷ hội thoại đang chờ (vd chuyển zone) — trả 'abort' cho vòng chạy
  abort() { const w = this.waiting; this.waiting = null; this.el.hidden = true; w?.resolve("abort"); }
  get snapshot() {
    if (!this.open) return null;
    return { name: this.el.querySelector(".name").textContent, text: this.el.querySelector(".text").textContent,
      choices: [...this.el.querySelectorAll(".choices li")].map((li) => li.textContent.trim()), waiting: this.waiting?.kind || null };
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
