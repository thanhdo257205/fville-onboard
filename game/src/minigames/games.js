// Các mini-game (GDD). Mỗi trò: { layout, start(ctx) → hàm dọn dẹp }. ctx: xem host.js.
// Nội dung chữ nằm trong data (interactables.json → minigames, quiz.json); ở đây chỉ có luật chơi.
// Gợi ý tăng dần (host.js): mỗi trò đặt ctx.idleHint (gợi ý của bước đang làm, hiện sau 8 s không thao tác) và
// ctx.onAssist (sai 2 lần ở một bước → làm sáng lựa chọn đúng: class "glow").
// ctx.debug.solve() / wrong(): để __game tự kiểm tra (khung trình duyệt ẩn vẫn chạy).
import { tx, draftMark } from "../content/content.js";
import { t } from "../i18n.js";
import { sound } from "../core/sound.js";
import { photo } from "./photo.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const kbd = (k) => `<kbd>${k}</kbd>`;
function shuffle(list, notSorted = true) {
  const a = [...list];
  for (let n = 0; n < 20; n++) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (!notSorted || a.some((x, i) => x !== list[i])) break;
  }
  return a;
}
const digit = (e) => (/^(Digit|Numpad)[1-9]$/.test(e.code) ? +e.code.slice(-1) - 1 : -1);

// ---------- Cài app (zone 1): bấm 3 bước theo đúng thứ tự ----------
const install_app = {
  start(ctx) {
    const steps = ctx.data.steps;
    const order = shuffle(steps.map((_, i) => i));
    let next = 0, busy = false;
    ctx.body.innerHTML = `<div class="phone-mock"><div class="phone-top">My FPT · ${t("minigame.setup")}</div>
      <ol class="steps">${order.map((si, k) => `<li data-k="${k}">${kbd(k + 1)}<span>${esc(tx(steps[si].text))}</span><i></i></li>`).join("")}</ol>
      <div class="progress"><div class="label"></div><div class="bar"><i></i></div></div></div>`;
    const lis = [...ctx.body.querySelectorAll(".steps li")];
    const label = ctx.body.querySelector(".progress .label"), fill = ctx.body.querySelector(".progress .bar i");
    label.textContent = tx(ctx.data.ready, ctx.vars);       // chưa bắt đầu: dòng trạng thái nói việc cần làm
    const pick = (k) => {
      if (busy || next >= steps.length) return;
      const si = order[k];
      if (lis[k].classList.contains("done")) return;
      sound.play("tap");
      if (si !== next) { ctx.mistake(tx(steps[next].hint)); return; }
      lis[k].classList.add("done");
      lis[k].classList.remove("glow");
      busy = true;
      sound.play("progress");
      label.textContent = tx(steps[si].doing, ctx.vars);
      fill.style.transition = "none"; fill.style.width = "0%"; void fill.offsetWidth;
      fill.style.transition = "width 1.1s linear"; fill.style.width = "100%";
      ctx.hint("");
      ctx.later(() => {
        busy = false;
        next++;
        label.textContent = tx(steps[si].after, ctx.vars);     // bước xong: câu hoàn tất (không giữ "Downloading…")
        ctx.correct(next < steps.length ? "" : tx(ctx.data.done));
        if (next >= steps.length) ctx.later(() => ctx.finish(), 900);
      }, 1150);
    };
    lis.forEach((li, k) => li.addEventListener("click", () => pick(k)));
    ctx.onKey = (e) => { const d = digit(e); if (d >= 0 && d < lis.length) { pick(d); return true; } return false; };
    ctx.idleHint = () => (busy || next >= steps.length ? null : tx(steps[next].hint));
    ctx.onAssist = () => lis.forEach((li, k) => li.classList.toggle("glow", ctx.assist && order[k] === next));
    ctx.debug = {
      solve: () => { busy = false; while (next < steps.length) { const k = order.indexOf(next); lis[k].classList.add("done"); next++; } ctx.finish(); },
      wrong: () => { const k = order.findIndex((si) => si !== next && !lis[order.indexOf(si)].classList.contains("done")); if (k >= 0) pick(k); },
      state: () => ({ next, order, label: label.textContent, glow: lis.filter((li) => li.classList.contains("glow")).map((li) => +li.dataset.k) }),
    };
  },
};

// ---------- Kéo nước bằng cần vọt (zone 2): bấm đúng lúc vạch chạy vào vùng xanh, 3 gầu ----------
const well = {
  start(ctx) {
    const d = ctx.data, total = d.snippets.length;
    let bucket = 0, zone = null, t0 = performance.now(), reading = false, raf = 0;
    ctx.body.innerHTML = `<div class="well"><div class="buckets">${d.snippets.map(() => "<span>🪣</span>").join("")}</div>
      <div class="meter"><div class="zone"></div><div class="mark"></div></div>
      <button class="primary pull">${t("minigame.pull")} ${kbd("Space")}</button>
      <div class="snippet" hidden><p></p><button class="ghost next">${t("minigame.next")} ${kbd("Enter")}</button></div></div>`;
    const zoneEl = ctx.body.querySelector(".zone"), mark = ctx.body.querySelector(".mark"), pullBtn = ctx.body.querySelector(".pull");
    const snip = ctx.body.querySelector(".snippet"), buckets = [...ctx.body.querySelectorAll(".buckets span")];
    const speed = () => d.speed[Math.min(bucket, d.speed.length - 1)];
    const pos = () => { const ph = ((performance.now() - t0) / 1000) * speed(); const f = ph % 2; return f < 1 ? f : 2 - f; };  // 0..1..0
    // làm sáng (sai 2 lần): vùng xanh rộng thêm assist_width và sáng lên
    const newZone = () => {
      const w = d.zone_width[Math.min(bucket, d.zone_width.length - 1)] + (ctx.assist ? d.assist_width ?? 0.12 : 0);
      zoneEl.classList.toggle("glow", ctx.assist);
      const a = 0.12 + Math.random() * (0.76 - w);
      zone = [a, a + w];
      zoneEl.style.left = `${a * 100}%`; zoneEl.style.width = `${w * 100}%`;
      t0 = performance.now();
    };
    const draw = () => { mark.style.left = `${pos() * 100}%`; raf = requestAnimationFrame(draw); };
    const pull = (forced = null) => {
      if (reading || bucket >= total) return;
      const p = forced ?? pos();
      if (p < zone[0] || p > zone[1]) { sound.play("splash"); ctx.mistake(tx(p < zone[0] ? d.hint_early : d.hint_late)); return; }
      sound.play("bucket");
      buckets[bucket].classList.add("full");
      snip.querySelector("p").textContent = draftMark(d.draft_snippets) + tx(d.snippets[bucket]);
      snip.hidden = false; pullBtn.hidden = true; reading = true;
      bucket++;
      ctx.correct(t("minigame.bucket_n", { n: bucket, total }));
    };
    const next = () => {
      if (!reading) return;
      reading = false; snip.hidden = true;
      if (bucket >= total) { ctx.finish(); return; }
      pullBtn.hidden = false; newZone();
    };
    newZone(); draw();
    ctx.idleHint = () => (bucket >= total ? null : tx(reading ? d.idle.read : d.idle.pull));
    ctx.onAssist = () => { if (!reading) newZone(); else zoneEl.classList.toggle("glow", ctx.assist); };
    pullBtn.addEventListener("click", () => pull());
    snip.querySelector(".next").addEventListener("click", next);
    ctx.onKey = (e) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") { reading ? next() : pull(); return true; }
      return false;
    };
    ctx.debug = {
      solve: () => { while (bucket < total) { if (reading) next(); else pull((zone[0] + zone[1]) / 2); } next(); },
      wrong: () => { if (reading) next(); pull(zone[0] > 0.2 ? 0.02 : 0.98); },
      state: () => ({ bucket, zone, reading, glow: zoneEl.classList.contains("glow") }),
    };
    return () => cancelAnimationFrame(raf);
  },
};

// ---------- Quiz (Tượng Cuder, zone 2): đọc câu chuyện, 3 câu hỏi; sai → gợi ý, chọn lại ----------
const quiz = {
  start(ctx) {
    const q = ctx.content.quizzes.get(ctx.data.quiz);
    const per = ctx.data.per_correct ?? 5;
    let i = -1, knowledge = 0, firstTry = true, answered = false;
    const story = () => {
      ctx.body.innerHTML = `<div class="quiz"><div class="story">${draftMark(q.draft)}${esc(tx(q.story))}</div>
        <button class="primary go">${t("minigame.start_quiz")} ${kbd("Enter")}</button></div>`;
      ctx.body.querySelector(".go").addEventListener("click", () => ask(0));
    };
    const ask = (n) => {
      i = n; firstTry = true; answered = false;
      if (i >= q.questions.length) { ctx.finish({ hieu_biet: knowledge }); return; }
      const qq = q.questions[i];
      ctx.hint("");
      ctx.body.innerHTML = `<div class="quiz"><div class="qn">${t("minigame.question_n", { n: i + 1, total: q.questions.length })}</div>
        <p class="q">${esc(tx(qq.q))}</p><ol class="opts">${qq.options.map((o, k) => `<li data-k="${k}">${kbd(k + 1)} ${esc(tx(o))}</li>`).join("")}</ol>
        <div class="explain" hidden><p></p><button class="primary next">${t("minigame.next")} ${kbd("Enter")}</button></div></div>`;
      ctx.body.querySelectorAll(".opts li").forEach((li) => li.addEventListener("click", () => choose(+li.dataset.k)));
      ctx.body.querySelector(".next").addEventListener("click", () => ask(i + 1));
    };
    const choose = (k) => {
      const qq = q.questions[i];
      if (answered || k >= qq.options.length) return;
      const li = ctx.body.querySelector(`.opts li[data-k="${k}"]`);
      if (li.classList.contains("no")) return;
      sound.play("tap");
      if (k !== qq.answer) { li.classList.add("no"); firstTry = false; ctx.mistake(tx(qq.hint || qq.explain)); return; }
      answered = true;
      li.classList.remove("glow");
      li.classList.add("yes");
      if (firstTry) knowledge += per;
      ctx.correct(firstTry ? t("minigame.correct_plus", { n: per }) : t("minigame.correct"));
      const ex = ctx.body.querySelector(".explain");
      ex.querySelector("p").textContent = tx(qq.explain);
      ex.hidden = false;
    };
    story();
    ctx.idleHint = () => (i < 0 ? tx(ctx.data.idle.story) : answered ? tx(ctx.data.idle.next) : tx(q.questions[i].hint || ctx.data.idle.story));
    ctx.onAssist = () => { if (i >= 0) ctx.body.querySelector(`.opts li[data-k="${q.questions[i].answer}"]`)?.classList.toggle("glow", ctx.assist && !answered); };
    ctx.onKey = (e) => {
      if (i < 0 && (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")) { ask(0); return true; }
      if (i >= 0 && answered && (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")) { ask(i + 1); return true; }
      const d = digit(e);
      if (i >= 0 && d >= 0) { choose(d); return true; }
      return false;
    };
    ctx.skipExtra = () => ({});
    ctx.debug = {
      solve: () => { if (i < 0) ask(0); while (i < q.questions.length) { if (!answered) choose(q.questions[i].answer); ask(i + 1); } },
      wrong: () => { if (i < 0) ask(0); const qq = q.questions[i]; const k = qq.options.findIndex((_, n) => n !== qq.answer && !ctx.body.querySelector(`.opts li[data-k="${n}"]`).classList.contains("no")); choose(k); },
      state: () => ({ i, knowledge, glow: [...ctx.body.querySelectorAll(".opts li.glow")].map((li) => +li.dataset.k) }),
    };
  },
};

// ---------- Kiểm tra hồ sơ (zone 3): phiếu điền sẵn có 1 chỗ sai — tìm rồi sửa ----------
const profile_check = {
  start(ctx) {
    const d = ctx.data, g = ctx.game;
    const positions = g.characters.cfg.character_creation.positions;
    const myPos = positions.find((p) => p.id === g.progress.player.position) || positions[0];
    const bus = tx(d.bus_value);
    const wrongKey = Math.random() < 0.5 ? "position" : "bus";
    const otherPos = positions.filter((p) => p.id !== myPos.id);
    const fields = d.fields.map((f) => {
      let value = tx(f.value, ctx.vars), options = null, correct = null;
      if (f.key === "name") value = g.progress.player.name;
      if (f.key === "position") {
        value = tx(myPos.name); correct = value;
        options = shuffle([myPos, ...otherPos.slice(0, 2)], false).map((p) => tx(p.name));
        if (wrongKey === "position") value = tx(otherPos[Math.floor(Math.random() * otherPos.length)].name);
      }
      if (f.key === "bus") {
        value = bus; correct = bus;
        options = d.bus_options.map((o) => tx(o));
        if (wrongKey === "bus") value = tx(d.bus_wrong);
      }
      return { ...f, value, options, correct };
    });
    const target = fields.findIndex((f) => f.key === wrongKey);
    let stage = "find", fixed = false;
    const draw = () => {
      ctx.body.innerHTML = `<div class="form"><div class="form-top">${esc(tx(d.form_title))}</div>
        <ol class="fields">${fields.map((f, k) => `<li data-k="${k}" class="${k === target && stage === "fix" ? "sel" : ""} ${fixed && k === target ? "ok" : ""} ${k === target && stage === "find" && ctx.assist ? "glow" : ""}">
          ${kbd(k + 1)}<span class="lab">${esc(tx(f.label))}</span><b>${esc(f.value)}</b></li>`).join("")}</ol>
        ${stage === "fix" && !fixed ? `<div class="fix"><p>${esc(t("minigame.pick_correct", { field: tx(fields[target].label) }))}</p>
          <ol class="opts">${fields[target].options.map((o, k) => `<li data-o="${k}" class="${ctx.assist && o === fields[target].correct ? "glow" : ""}">${kbd(k + 1)} ${esc(o)}</li>`).join("")}</ol></div>` : ""}</div>`;
      ctx.body.querySelectorAll(".fields li").forEach((li) => li.addEventListener("click", () => find(+li.dataset.k)));
      ctx.body.querySelectorAll(".opts li").forEach((li) => li.addEventListener("click", () => fix(+li.dataset.o)));
    };
    const find = (k) => {
      if (stage !== "find" || k >= fields.length) return;
      sound.play("tap");
      if (k !== target) { ctx.mistake(tx(d.hint_find)); return; }
      stage = "fix"; ctx.correct(tx(d.found)); draw();
    };
    const fix = (o) => {
      if (stage !== "fix" || fixed) return;
      const f = fields[target];
      if (o >= f.options.length) return;
      sound.play("tap");
      if (f.options[o] !== f.correct) { ctx.mistake(tx(wrongKey === "bus" ? d.hint_bus : d.hint_position)); return; }
      f.value = f.correct; fixed = true; ctx.correct(tx(d.done)); draw();
      ctx.later(() => ctx.finish(), 900);
    };
    draw();
    ctx.idleHint = () => (fixed ? null : stage === "find" ? tx(d.idle_find) : tx(wrongKey === "bus" ? d.hint_bus : d.hint_position));
    ctx.onAssist = () => draw();
    ctx.onKey = (e) => { const n = digit(e); if (n < 0) return false; stage === "find" ? find(n) : fix(n); return true; };
    ctx.debug = {
      solve: () => { if (stage === "find") find(target); fix(fields[target].options.indexOf(fields[target].correct)); ctx.finish(); },
      wrong: () => { if (stage === "find") find((target + 1) % fields.length); else fix(fields[target].options.findIndex((x) => x !== fields[target].correct)); },
      state: () => ({ wrongKey, stage, fixed, glow: [...ctx.body.querySelectorAll(".glow")].map((li) => li.textContent.trim()) }),
    };
  },
};

// ---------- Dòng thời gian (Phòng Hạt Lúa, zone 3): kéo 5 mốc theo thứ tự năm ----------
const timeline = {
  start(ctx) {
    const d = ctx.data;
    const items = d.items.map((it, k) => ({ ...it, k }));
    const sorted = [...items].sort((a, b) => a.year - b.year);
    let order = shuffle(items);
    let sel = 0, done = false, hints = 0, okSet = new Set();
    // làm sáng (sai 2 lần): mọi thẻ hiện năm (thẻ chưa đúng chỗ: class glow) → chỉ còn việc xếp theo năm
    const draw = (reveal = false) => {
      ctx.body.innerHTML = `<div class="timeline"><div class="ends">${t("minigame.oldest")}</div>
        <ol class="cards">${order.map((it, n) => `<li data-k="${it.k}" class="${n === sel && !done ? "sel" : ""} ${okSet.has(it.k) || reveal ? "ok" : ctx.assist ? "glow" : ""}">
          <span class="grip">⋮⋮</span><span class="txt">${esc(tx(it.text))}</span>${reveal || okSet.has(it.k) || ctx.assist ? `<b>${it.year}</b>` : ""}</li>`).join("")}</ol>
        <div class="ends">${t("minigame.newest")}</div>
        ${done ? "" : `<button class="primary check">${t("minigame.check")} ${kbd("Enter")}</button>`}</div>`;
      ctx.body.querySelector(".check")?.addEventListener("click", check);
      // kéo thả: bắt con trỏ trên danh sách (không đứng yên), vì thẻ đổi chỗ trong DOM sẽ mất pointer capture
      const list = ctx.body.querySelector(".cards");
      let drag = null;
      list.addEventListener("pointerdown", (e) => {
        const li = e.target.closest("li");
        if (done || !li || e.button !== 0) return;
        drag = li; list.setPointerCapture(e.pointerId); li.classList.add("drag");
      });
      list.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cards li");
        if (!over || over === drag) return;
        const r = over.getBoundingClientRect();
        list.insertBefore(drag, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
      });
      const drop = () => {
        if (!drag) return;
        const li = drag;
        drag = null;
        order = [...list.querySelectorAll("li")].map((x) => items[+x.dataset.k]);
        sel = order.findIndex((x) => x.k === +li.dataset.k);
        okSet = new Set();
        sound.play("tap");
        draw();
      };
      list.addEventListener("pointerup", drop);
      list.addEventListener("pointercancel", drop);
    };
    const move = (from, to) => {
      if (to < 0 || to >= order.length || from === to) return;
      const [it] = order.splice(from, 1);
      order.splice(to, 0, it);
      okSet = new Set();
      sel = to; sound.play("tap"); draw();
    };
    const check = () => {
      if (done) return;
      const wrong = order.findIndex((it, n) => it.year !== sorted[n].year);
      if (wrong < 0) { done = true; ctx.correct(tx(d.done)); draw(true); ctx.later(() => ctx.finish(), 1400); return; }
      // các thẻ đã đúng chỗ hiện năm (xanh), gợi ý dần
      okSet = new Set(order.filter((it, n) => it.year === sorted[n].year).map((it) => it.k));
      const h = d.hints[Math.min(hints++, d.hints.length - 1)];
      draw();
      ctx.mistake(tx(h));
    };
    draw();
    ctx.idleHint = () => (done ? null : tx(d.idle));
    ctx.onAssist = () => { if (!done) draw(); };
    ctx.onKey = (e) => {
      if (done) return false;
      if (e.code === "ArrowUp") { e.shiftKey ? move(sel, sel - 1) : (sel = Math.max(0, sel - 1), draw()); return true; }
      if (e.code === "ArrowDown") { e.shiftKey ? move(sel, sel + 1) : (sel = Math.min(order.length - 1, sel + 1), draw()); return true; }
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") { check(); return true; }
      return false;
    };
    ctx.debug = {
      solve: () => { order = [...sorted]; check(); ctx.finish(); },
      wrong: () => { const a = [...sorted]; [a[0], a[1]] = [a[1], a[0]]; order = a; check(); },
      state: () => ({ order: order.map((x) => x.year), sel, years: ctx.body.querySelectorAll(".cards li b").length }),
    };
  },
};

export const GAMES = {
  install_app, well, quiz, profile_check, timeline,
  photo_checkin: { layout: "photo", start: (ctx) => photo.start(ctx, "checkin") },
  photo_id: { layout: "photo", start: (ctx) => photo.start(ctx, "id") },
};
