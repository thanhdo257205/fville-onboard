// Khung mini-game (data/interactables.json → minigames.<id>, kind = tên trò trong GAMES).
// Luật chung (GDD: không có thua cuộc): một dòng hướng dẫn; sai → gợi ý + làm lại. Gợi ý tăng dần (cho mọi trò):
//   • 8 s không thao tác → hiện gợi ý của bước hiện tại (ctx.idleHint, chữ trong data: minigames.<id>.idle / steps[].hint)
//   • sai 2 lần ở cùng một bước → làm sáng lựa chọn đúng (ctx.assist = true, trò tự vẽ lại qua ctx.onAssist)
//   • sai 3 lần ở cùng một bước → hiện nút Skip (phím S): đi tiếp, vẫn nhận phần thưởng bắt buộc (result) nhưng KHÔNG
//     cộng Hiểu biết của lượt đó. Bước xong (ctx.correct) → đếm lại từ đầu. "Not now" (Esc) đóng lại, chưa nhận gì.
// Chơi được bằng chuột và bàn phím (mỗi trò tự nhận phím qua ctx.onKey). Âm thanh: core/sound.js (chỗ gọi sẵn).
import { tx, draftMark } from "../content/content.js";
import { t } from "../i18n.js";
import { sound } from "../core/sound.js";
import { GAMES } from "./games.js";

const IDLE_HINT_S = 8;      // không thao tác bao lâu thì hiện gợi ý bước hiện tại
const ASSIST_AFTER = 2;     // sai bấy nhiêu lần ở một bước → làm sáng lựa chọn đúng
const SKIP_AFTER = 3;       // sai bấy nhiêu lần ở một bước → hiện nút Skip

export class MinigameHost {
  constructor(content) {
    this.c = content;
    this.game = null;            // main.js gắn sau khi tạo Game (trò chụp ảnh cần camera / nhân vật)
    this.el = document.createElement("div");
    this.el.id = "minigame";
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.active = null;
    this.onKeyDown = (e) => this.key(e);
  }
  get open() { return !this.el.hidden; }
  get id() { return this.active?.id ?? null; }

  // → Promise<{ ok, skipped, effects }>
  run(id) {
    const m = this.c.minigames[id];
    const game = m && GAMES[m.kind || id];
    if (!game) return Promise.resolve({ ok: false, skipped: false, effects: {} });
    this.el.className = `mg-${game.layout || "panel"}`;
    this.el.hidden = false;
    this.el.innerHTML = `<div class="panel mg" data-id="${id}">
      <header><h2>${draftMark(m.draft)}${tx(m.title)}</h2></header>
      <p class="line">${tx(m.line || m.desc)}</p>
      <div class="body"></div>
      <p class="hint" aria-live="polite"></p>
      <footer><button class="ghost" data-a="cancel">${t("minigame.cancel")} <kbd>Esc</kbd></button>
        <button class="skip" data-a="skip" hidden>${t("minigame.skip")} <kbd>S</kbd></button></footer></div>`;
    const body = this.el.querySelector(".body"), hintEl = this.el.querySelector(".hint"), skipBtn = this.el.querySelector("[data-a=skip]");
    return new Promise((resolve) => {
      const a = { id, data: m, game, mistakes: 0, stepMistakes: 0, resolve, timers: new Set(), lastInput: performance.now(), idleShown: false };
      const setAssist = (on) => { if (ctx.assist === on) return; ctx.assist = on; ctx.onAssist?.(); };
      const ctx = {
        id, data: m, content: this.c, host: this, game: this.game, body,
        vars: { player: this.game?.progress.player.name || "" },
        assist: false,          // true = đang làm sáng lựa chọn đúng (sai 2 lần ở bước này)
        idleHint: null,         // () → gợi ý của bước hiện tại (trò đặt)
        onAssist: null,         // trò vẽ lại khi assist đổi
        // chữ mới (gợi ý sai, câu hỏi mới…) → đếm lại 8 s; hết 8 s mà chưa thao tác thì hiện gợi ý của bước đang làm
        hint: (text, kind = "info") => { hintEl.textContent = text || ""; hintEl.dataset.kind = kind; if (kind !== "idle") this.touched(a); },
        correct: (text) => { sound.play("mg_correct"); a.stepMistakes = 0; setAssist(false); ctx.hint(text || "", "good"); },
        mistake: (text) => {
          a.mistakes++;
          a.stepMistakes++;
          sound.play("mg_wrong");
          ctx.hint(text || t("minigame.try_again"), "wrong");
          if (a.stepMistakes >= ASSIST_AFTER) setAssist(true);
          if (a.stepMistakes >= SKIP_AFTER) skipBtn.hidden = false;     // hiện rồi thì giữ tới hết trò
          this.el.querySelector(".panel").classList.remove("shake"); void body.offsetWidth;
          this.el.querySelector(".panel").classList.add("shake");
        },
        later: (fn, ms) => { const h = setTimeout(() => { a.timers.delete(h); if (this.active === a) fn(); }, ms); a.timers.add(h); return h; },
        finish: (extra = {}) => this.end(a, { ok: true, skipped: false, extra }),
        onKey: null,
        debug: {},
      };
      a.ctx = ctx;
      this.active = a;
      this.el.querySelector("[data-a=cancel]").addEventListener("click", () => this.close(false));
      skipBtn.addEventListener("click", () => this.skip());
      this.el.addEventListener("pointerdown", () => this.touched(a));
      addEventListener("keydown", this.onKeyDown, true);
      // 8 s không thao tác → gợi ý của bước hiện tại (thao tác lại thì đếm lại; gợi ý đang hiện thì giữ)
      a.idle = setInterval(() => {
        if (this.active !== a || a.idleShown || performance.now() - a.lastInput < IDLE_HINT_S * 1000) return;
        const text = ctx.idleHint?.();
        if (!text) return;
        a.idleShown = true;
        ctx.hint(text, "idle");
      }, 250);
      sound.play("mg_open");
      a.stop = game.start(ctx) || null;
    });
  }

  // người chơi vừa thao tác → đếm lại 8 s
  touched(a) { a.lastInput = performance.now(); a.idleShown = false; }

  key(e) {
    const a = this.active;
    if (!a || e.repeat) return;
    this.touched(a);
    if (e.code === "Escape") { this.close(false); }
    else if (e.code === "KeyS" && !this.el.querySelector("[data-a=skip]").hidden) { this.skip(); }
    else if (!a.ctx.onKey?.(e)) return;              // trò không dùng phím này → để main.js xử lý (vd Tab bị khoá sẵn)
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  skip() {
    const a = this.active;
    if (!a) return;
    sound.play("mg_skip");
    this.end(a, { ok: true, skipped: true, extra: a.ctx.skipExtra?.() || {} });
  }

  // đóng từ ngoài (Esc, chuyển zone): chưa nhận gì
  close() {
    const a = this.active;
    if (a) this.end(a, { ok: false, skipped: false, extra: {} });
  }

  end(a, { ok, skipped, extra }) {
    if (this.active !== a) return;
    this.active = null;
    removeEventListener("keydown", this.onKeyDown, true);
    clearInterval(a.idle);
    for (const h of a.timers) clearTimeout(h);
    try { a.stop?.(); } catch (e) { console.error(e); }
    this.el.hidden = true;
    this.el.innerHTML = "";
    let effects = {};
    if (ok) {
      sound.play("mg_done");
      effects = { ...(a.data.result || {}) };
      for (const [k, v] of Object.entries(extra)) effects[k] = k === "hieu_biet" ? (effects[k] || 0) + v : v;
      if (skipped) delete effects.hieu_biet;          // Skip: vẫn nhận phần thưởng bắt buộc, không cộng Hiểu biết lượt này
    }
    this.last = { id: a.id, ok, skipped, mistakes: a.mistakes, effects };
    a.resolve({ ok, skipped, effects });
  }
}
