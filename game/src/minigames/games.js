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
// Phương án xáo lại mỗi lần chơi: perm[vị trí hiện] = chỉ số phương án trong dữ liệu (answer, hint, explain theo dữ liệu)
const quiz = {
  start(ctx) {
    const q = ctx.content.quizzes.get(ctx.data.quiz);
    const per = ctx.data.per_correct ?? 5;
    let i = -1, knowledge = 0, firstTry = true, answered = false, perm = [];
    const story = () => {
      ctx.body.innerHTML = `<div class="quiz"><div class="story">${draftMark(q.draft)}${esc(tx(q.story))}</div>
        <button class="primary go">${t("minigame.start_quiz")} ${kbd("Enter")}</button></div>`;
      ctx.body.querySelector(".go").addEventListener("click", () => ask(0));
    };
    const ask = (n) => {
      i = n; firstTry = true; answered = false;
      if (i >= q.questions.length) { ctx.finish({ hieu_biet: knowledge }); return; }
      const qq = q.questions[i];
      perm = shuffle(qq.options.map((_, k) => k));
      ctx.hint("");
      ctx.body.innerHTML = `<div class="quiz"><div class="qn">${t("minigame.question_n", { n: i + 1, total: q.questions.length })}</div>
        <p class="q">${esc(tx(qq.q))}</p><ol class="opts">${perm.map((o, k) => `<li data-k="${k}">${kbd(k + 1)} ${esc(tx(qq.options[o]))}</li>`).join("")}</ol>
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
      if (perm[k] !== qq.answer) { li.classList.add("no"); firstTry = false; ctx.mistake(tx(qq.hint || qq.explain)); return; }
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
    ctx.onAssist = () => { if (i >= 0) ctx.body.querySelector(`.opts li[data-k="${perm.indexOf(q.questions[i].answer)}"]`)?.classList.toggle("glow", ctx.assist && !answered); };
    ctx.onKey = (e) => {
      if (i < 0 && (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")) { ask(0); return true; }
      if (i >= 0 && answered && (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")) { ask(i + 1); return true; }
      const d = digit(e);
      if (i >= 0 && d >= 0) { choose(d); return true; }
      return false;
    };
    ctx.skipExtra = () => ({});
    ctx.debug = {
      solve: () => { if (i < 0) ask(0); while (i < q.questions.length) { if (!answered) choose(perm.indexOf(q.questions[i].answer)); ask(i + 1); } },
      wrong: () => { if (i < 0) ask(0); const qq = q.questions[i]; const k = perm.findIndex((o, n) => o !== qq.answer && !ctx.body.querySelector(`.opts li[data-k="${n}"]`).classList.contains("no")); choose(k); },
      state: () => ({ i, knowledge, perm: [...perm], answerAt: i >= 0 ? perm.indexOf(q.questions[i].answer) : null, glow: [...ctx.body.querySelectorAll(".opts li.glow")].map((li) => +li.dataset.k) }),
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

// ---------- Lộ trình học (phòng FSA, zone 4): xếp 3 khóa gợi ý (theo vị trí intern) vào lịch tuần đầu, khóa cơ bản trước;
// xong thì hỏi có tự đặt thêm mục tiêu riêng không (chọn → ô Innovation) ----------
const learning_path = {
  start(ctx) {
    const d = ctx.data, g = ctx.game;
    const courses = d.courses[g?.progress.player.position] || d.courses.developer;
    const days = d.days.map((x) => tx(x));
    const order = shuffle(courses.map((_, i) => i));
    let next = 0, stage = "place", drag = -1;
    const title = (i) => tx(courses[i].title);
    const draw = () => {
      if (stage === "place") {
        ctx.body.innerHTML = `<div class="lpath"><div class="cal">${days.map((day, k) => `<div class="day ${k < next ? "filled" : k === next ? "now" : ""}">
            <b>${esc(day)}</b><span>${k < next ? esc(title(k)) : ""}</span></div>`).join("")}</div>
          <ol class="opts lp-cards">${order.map((ci, k) => `<li data-k="${k}" draggable="${ci >= next}" class="${ci < next ? "used" : ""} ${ctx.assist && ci === next ? "glow" : ""}">
            ${kbd(k + 1)}<div><b>${esc(title(ci))}</b><small>${esc(tx(courses[ci].tag))}</small></div></li>`).join("")}</ol></div>`;
        ctx.body.querySelectorAll(".lp-cards li").forEach((li) => {
          li.addEventListener("click", () => pick(+li.dataset.k));
          li.addEventListener("dragstart", (e) => { drag = +li.dataset.k; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", li.dataset.k); });
        });
        const cal = ctx.body.querySelector(".cal");
        cal.addEventListener("dragover", (e) => { e.preventDefault(); cal.classList.add("over"); });
        cal.addEventListener("dragleave", () => cal.classList.remove("over"));
        cal.addEventListener("drop", (e) => { e.preventDefault(); cal.classList.remove("over"); const k = drag >= 0 ? drag : +e.dataTransfer.getData("text/plain"); drag = -1; pick(k); });
      } else {
        ctx.body.innerHTML = `<div class="lpath"><div class="cal">${days.map((day, k) => `<div class="day filled"><b>${esc(day)}</b><span>${esc(title(k))}</span></div>`).join("")}</div>
          <p class="q">${esc(tx(d.goal_question))}</p>
          <ol class="opts lp-goals">${d.goals.map((x, k) => `<li data-o="${k}">${kbd(k + 1)} ${esc(tx(x.text))}</li>`).join("")}
            <li data-o="${d.goals.length}" class="skip-goal">${kbd(d.goals.length + 1)} ${esc(tx(d.goal_skip))}</li></ol></div>`;
        ctx.body.querySelectorAll(".lp-goals li").forEach((li) => li.addEventListener("click", () => choose(+li.dataset.o)));
      }
    };
    const pick = (k) => {
      if (stage !== "place" || k < 0 || k >= order.length) return;
      const ci = order[k];
      if (ci < next) return;                      // đã xếp rồi
      sound.play("tap");
      if (ci !== next) { ctx.mistake(tx(d.hints[next], { prev: next ? title(next - 1) : "" })); return; }
      next++;
      ctx.correct(tx(d.placed, { course: title(ci), day: days[ci] }));
      if (next >= courses.length) stage = "goal";
      draw();
    };
    const choose = (o) => {
      if (stage !== "goal" || o < 0 || o > d.goals.length) return;
      stage = "done";
      sound.play("tap");
      const goal = d.goals[o];
      ctx.correct(tx(goal ? d.done_goal : d.done));
      ctx.body.querySelectorAll(".lp-goals li").forEach((li) => li.classList.toggle("yes", +li.dataset.o === o));
      ctx.later(() => ctx.finish(goal ? { value: "innovation", flags: ["own_goal_set", `own_goal_${goal.id}`] } : {}), 1100);
    };
    draw();
    ctx.idleHint = () => (stage === "place" ? tx(d.idle.place, { day: days[next] }) : stage === "goal" ? tx(d.idle.goal) : null);
    ctx.onAssist = () => { if (stage === "place") draw(); };
    ctx.onKey = (e) => { const n = digit(e); if (n < 0) return false; stage === "place" ? pick(n) : choose(n); return true; };
    ctx.skipExtra = () => ({});
    ctx.debug = {
      solve: (goal = 0) => { while (stage === "place") pick(order.indexOf(next)); choose(goal); },
      wrong: () => { if (stage === "place") pick(order.findIndex((ci) => ci > next)); },
      state: () => ({ stage, next, order, glow: [...ctx.body.querySelectorAll(".glow")].map((li) => +li.dataset.k), courses: courses.map((c) => tx(c.title)) }),
    };
  },
};

// ---------- La bàn nghề nghiệp (gặp Prajith, zone 5): 4 câu không đúng / sai → thẻ gợi ý hướng phát triển theo vị trí
// intern + xu hướng chính (nhiều nhất; bằng nhau → câu trả lời sớm hơn) ----------
const compass = {
  start(ctx) {
    const d = ctx.data, g = ctx.game, qs = d.questions;
    const pos = g?.progress.player.position || "developer";
    const posName = tx(g?.characters.cfg.character_creation?.positions?.find((x) => x.id === pos)?.name) || "";
    let i = 0, done = false, finished = false;
    const answers = [];
    const result = () => {
      const count = {};
      let best = null;
      answers.forEach((k, n) => { const tr = qs[n].options[k].trait; count[tr] = (count[tr] || 0) + 1; });
      answers.forEach((k, n) => { const tr = qs[n].options[k].trait; if (!best || count[tr] > count[best]) best = tr; });
      return best;
    };
    const draw = () => {
      if (!done) {
        const q = qs[i];
        ctx.body.innerHTML = `<div class="quiz compass"><p class="qn">${t("minigame.question_n", { n: i + 1, total: qs.length })}</p>
          <p class="q">${esc(tx(q.q))}</p>
          <ol class="opts">${q.options.map((o, k) => `<li data-k="${k}">${kbd(k + 1)} ${esc(tx(o.text))}</li>`).join("")}</ol></div>`;
        ctx.body.querySelectorAll(".opts li").forEach((li) => li.addEventListener("click", () => pick(+li.dataset.k)));
        return;
      }
      const tr = result(), trait = d.traits[tr];
      const dir = d.directions[pos]?.[tr] ?? d.directions.developer[tr];
      ctx.body.innerHTML = `<div class="compass-card"><div class="needle">🧭</div><small>${esc(tx(d.card_title))}</small>
        <h3>${esc(tx(trait.name))}</h3><p class="who">${esc(t("myfpt.compass_of", { trait: tx(trait.name), position: posName }))}</p>
        <p>${esc(tx(trait.desc))}</p><p class="dir"><b>→</b> ${esc(tx(dir))}</p><small class="note">${esc(tx(d.card_note))}</small>
        <button class="primary done">${t("minigame.done")} ${kbd("Enter")}</button></div>`;
      ctx.body.querySelector(".done").addEventListener("click", finish);
    };
    const pick = (k) => {
      if (done || k < 0 || k >= qs[i].options.length) return;
      sound.play("tap");
      answers.push(k);
      if (++i >= qs.length) { done = true; ctx.correct(tx(d.done)); }
      draw();
    };
    const finish = () => {
      if (finished || !done) return;
      finished = true;
      ctx.finish({ compass: { trait: result(), answers: [...answers], position: pos } });
    };
    draw();
    ctx.idleHint = () => (done ? null : tx(d.idle));
    ctx.onKey = (e) => {
      if (done) { if (["Enter", "NumpadEnter", "Space"].includes(e.code)) { finish(); return true; } return false; }
      const n = digit(e);
      if (n < 0) return false;
      pick(n);
      return true;
    };
    ctx.debug = {
      solve: (picks = [0, 0, 0, 0]) => { for (const k of picks) if (!done) pick(k); finish(); },
      state: () => ({ i, answers: [...answers], done, trait: done ? result() : null }),
    };
  },
};

// ---------- Sắp xếp ưu tiên (gặp Manager, zone 5): 5 thẻ việc tuần đầu; việc có hạn hôm nay lên đầu, câu lạc bộ xuống
// cuối, 3 việc giữa đổi chỗ vẫn đúng. Chưa hợp lý → Manager góp ý 1 câu (thẻ đặt sai được làm sáng) + xếp lại 1 lần ----------
const priorities = {
  start(ctx) {
    const d = ctx.data;
    const items = d.items.map((it, k) => ({ ...it, k }));
    const sensible = (o) => o[0].rank === "first" && o[o.length - 1].rank === "last";
    let order = shuffle(items);
    for (let n = 0; n < 20 && sensible(order); n++) order = shuffle(items);
    let sel = 0, done = false, tries = 0, flagged = new Set();
    const draw = () => {
      ctx.body.innerHTML = `<div class="timeline prio"><div class="ends">${esc(tx(d.top))}</div>
        <ol class="cards">${order.map((it, n) => `<li data-k="${it.k}" class="${n === sel && !done ? "sel" : ""} ${flagged.has(it.k) ? "glow" : ""}">
          <span class="grip">⋮⋮</span><span class="txt">${esc(tx(it.text))}</span><em class="tag">${esc(tx(it.tag))}</em></li>`).join("")}</ol>
        <div class="ends">${esc(tx(d.bottom))}</div>
        ${done ? "" : `<button class="primary check">${t("minigame.check")} ${kbd("Enter")}</button>`}</div>`;
      ctx.body.querySelector(".check")?.addEventListener("click", check);
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
      sel = to; sound.play("tap"); draw();
    };
    const check = () => {
      if (done) return;
      if (sensible(order)) {
        done = true; flagged = new Set();
        ctx.correct(tx(d.done_good)); draw();
        ctx.later(() => ctx.finish({ value: "wisdom", flags: ["priorities_sensible"] }), 1400);
        return;
      }
      tries++;
      if (tries >= 2) {                                 // xếp lại 1 lần vẫn chưa hợp lý: vẫn xong, không có ô Wisdom
        done = true; flagged = new Set();
        ctx.hint(tx(d.done_ok), "info"); draw();
        ctx.later(() => ctx.finish({ flags: ["priorities_done"] }), 1800);
        return;
      }
      const firstOk = order[0].rank === "first";
      flagged = new Set([items.find((x) => x.rank === (firstOk ? "last" : "first")).k]);
      draw();
      ctx.mistake(`${tx(firstOk ? d.feedback_last : d.feedback_first)} ${tx(d.retry)}`);
    };
    draw();
    ctx.idleHint = () => (done ? null : tx(d.idle));
    ctx.onKey = (e) => {
      if (done) return false;
      if (e.code === "ArrowUp") { e.shiftKey ? move(sel, sel - 1) : (sel = Math.max(0, sel - 1), draw()); return true; }
      if (e.code === "ArrowDown") { e.shiftKey ? move(sel, sel + 1) : (sel = Math.min(order.length - 1, sel + 1), draw()); return true; }
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") { check(); return true; }
      return false;
    };
    const arrange = (good) => {
      const first = items.find((x) => x.rank === "first"), last = items.find((x) => x.rank === "last");
      const mid = items.filter((x) => !x.rank);
      order = good ? [first, ...mid, last] : [last, ...mid, first];
    };
    ctx.debug = {
      solve: () => { arrange(true); check(); ctx.finish({ value: "wisdom", flags: ["priorities_sensible"] }); },
      wrong: () => { arrange(false); check(); },
      state: () => ({ order: order.map((x) => x.id), tries, done, flagged: [...flagged] }),
    };
  },
};

// ---------- Một cú bi-a (anh Khang, zone 5, tùy chọn): trên bàn bi-a thật của zone 5 (game/src/pool/table.js, vật lý
// game/src/pool/physics.js). Thế bi dễ cho sẵn (data: setup), đưa bi vào lỗ trong 3 cú (hết thì xếp lại); mỗi cú trượt =
// 1 lần sai (sai 2 → đường ngắm gợi ý tìm bằng vật lý, sai 3 → Skip). Khung mini-game chỉ là bảng chữ nhỏ phía trên ----------
const pool_shot = {
  layout: "pool",
  start(ctx) {
    const pool = ctx.game?.pool;
    if (pool?.root) return pool.enter({ challenge: { ctx, data: ctx.data } });
    // không ở cạnh bàn (vd mở bằng __game khi đang ở zone khác): chỉ còn Skip
    ctx.hint(t("pool.no_table"), "info");
    ctx.debug = { solve: () => ctx.finish() };
    return null;
  },
};

// ---------- Đăng nhập lần đầu (bàn làm việc, zone 5): mật khẩu đạt mọi quy định (thanh độ mạnh, quy định thật chờ HR/IT →
// draft) rồi bật xác thực hai lớp. Mật khẩu chỉ kiểm tra trong trình duyệt: không lưu (bản lưu, debug.state chỉ có đúng /
// sai từng quy định), không log, không gửi đi. Không dùng <form>, không ô username, không autocomplete="new-password" →
// Chrome / Safari không đề nghị lưu hay gợi ý mật khẩu: ô nhập type="text" ẩn ký tự bằng CSS -webkit-text-security
// (trình duyệt không có thuộc tính này → type="password" ngoài form, autocomplete="off"). Enter = ctx.onKey ----------
const MASK_CSS = typeof CSS !== "undefined" && !!CSS.supports?.("-webkit-text-security", "disc");
const login = {
  start(ctx) {
    const d = ctx.data;
    const first = String(ctx.vars.player || "").trim().split(/\s+/)[0].toLowerCase();
    const tests = {
      len: (p) => [...p].length >= 12,
      case: (p) => /\p{Lu}/u.test(p) && /\p{Ll}/u.test(p),
      digit: (p) => /\d/.test(p),
      symbol: (p) => /[^\p{L}\p{N}\s]/u.test(p),
      name: (p) => p.length > 0 && (first.length < 3 || !p.toLowerCase().includes(first)),
    };
    let stage = "pw", fails = 0, finished = false;
    const passed = (p) => d.rules.map((r) => !!tests[r.id]?.(p));
    const draw = () => {
      if (stage === "pw") {
        ctx.body.innerHTML = `<div class="login"><div class="pwrow"><input type="${MASK_CSS ? "text" : "password"}" class="pw${MASK_CSS ? " masked" : ""}"
            autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true"
            aria-label="${esc(tx(d.placeholder))}" placeholder="${esc(tx(d.placeholder))}" maxlength="64"><button type="button" class="ghost show">${t("minigame.show_pw")}</button></div>
          <div class="meter"><i></i></div><p class="level"></p>
          <b class="rules-t">${t("minigame.rules")}</b><ul class="rules">${d.rules.map((r) => `<li data-r="${r.id}"><span class="tick"></span>${esc(tx(r.text))}</li>`).join("")}</ul>
          <button type="button" class="primary set">${esc(tx(d.login_btn))} ${kbd("Enter")}</button></div>`;
        ctx.body.querySelector(".set").addEventListener("click", submit);
        const inp = ctx.body.querySelector(".pw");
        inp.addEventListener("input", update);
        // Show: bỏ / đặt lại lớp ẩn ký tự (hoặc đổi type khi không có CSS ẩn ký tự)
        ctx.body.querySelector(".show").addEventListener("click", () => {
          if (MASK_CSS) inp.classList.toggle("masked"); else inp.type = inp.type === "password" ? "text" : "password";
          inp.focus();
        });
        setTimeout(() => inp.focus(), 30);
        update();
      } else {
        ctx.body.innerHTML = `<div class="login twofa"><div class="ok-pw">✓ ${esc(tx(d.login_btn))}</div>
          <div class="tf"><div><b>${esc(tx(d.twofa_title))}</b><small>${esc(tx(d.twofa_desc))}</small></div>
          <button class="switch ${stage === "done" ? "on" : ""} ${ctx.assist && stage === "twofa" ? "glow" : ""}" aria-pressed="${stage === "done"}">
            <i></i><span>${t(stage === "done" ? "minigame.twofa_onstate" : "minigame.twofa_off")}</span></button></div>
          ${stage === "twofa" ? `<button class="primary on">${esc(tx(d.twofa_on))} ${kbd("Space")}</button>` : ""}</div>`;
        ctx.body.querySelector(".switch").addEventListener("click", enable2fa);
        ctx.body.querySelector(".on")?.addEventListener("click", enable2fa);
      }
    };
    function update() {
      const p = ctx.body.querySelector(".pw")?.value || "";
      const ok = passed(p), n = ok.filter(Boolean).length;
      ctx.body.querySelectorAll(".rules li").forEach((li, k) => li.classList.toggle("ok", ok[k] && p.length > 0));
      // độ mạnh: đạt đủ mọi quy định = mức cao nhất; còn lại theo số quy định đạt (0–1 → thấp nhất)
      const top = d.strength.length - 1;
      const lv = n === d.rules.length ? top : Math.max(0, Math.min(top - 1, n - 1));
      const bar = ctx.body.querySelector(".meter i");
      bar.style.width = `${p ? Math.round((100 * n) / d.rules.length) : 0}%`;
      bar.dataset.lv = p ? lv : 0;
      ctx.body.querySelector(".level").textContent = p ? t("minigame.strength", { level: tx(d.strength[lv]) }) : "";
    }
    function submit() {
      if (stage !== "pw") return;
      const p = ctx.body.querySelector(".pw").value;
      if (passed(p).every(Boolean)) { stage = "twofa"; ctx.correct(""); draw(); return; }
      fails++;
      ctx.mistake(`${tx(d.not_yet)}${fails >= 2 ? ` ${tx(d.suggest)}` : ""}`);
      ctx.body.querySelector(".pw").focus();
    }
    function enable2fa() {
      if (stage !== "twofa") return;
      stage = "done";
      sound.play("tap");
      ctx.correct(tx(d.done));
      draw();
      ctx.later(() => { if (!finished) { finished = true; ctx.finish(); } }, 1300);
    }
    draw();
    ctx.idleHint = () => (stage === "pw" ? tx(d.idle.pw) : stage === "twofa" ? tx(d.idle.twofa) : null);
    ctx.onAssist = () => { if (stage === "twofa") draw(); };
    ctx.onKey = (e) => {
      if (stage === "pw" && (e.code === "Enter" || e.code === "NumpadEnter")) { submit(); return true; }
      if (stage === "twofa" && ["Space", "Enter", "NumpadEnter"].includes(e.code)) { enable2fa(); return true; }
      return false;
    };
    ctx.debug = {
      solve: () => { if (stage === "pw") { const inp = ctx.body.querySelector(".pw"); inp.value = "Orange-Rice-Field-26!"; update(); submit(); } enable2fa(); if (!finished) { finished = true; ctx.finish(); } },
      wrong: () => { if (stage === "pw") { const inp = ctx.body.querySelector(".pw"); inp.value = "password"; update(); submit(); } },
      state: () => ({ stage, fails, rules: passed(ctx.body.querySelector(".pw")?.value || "") }),
    };
  },
};

// ---------- Checklist ngày đầu (bàn làm việc, zone 5): các mục theo 4 Act tự tick lần lượt, mục bàn làm việc tick cuối ----------
const day_checklist = {
  start(ctx) {
    const d = ctx.data, g = ctx.game, c = ctx.content;
    const acts = g?.acts.status() || [];
    const ticks = [];
    acts.forEach((st) => st.items.forEach((it) => { if (it.done) ticks.push(it.id); }));
    if (!ticks.includes("desk")) ticks.push("desk");                 // đang ngồi vào bàn: tick cuối cùng
    let n = 0, ready = false, finished = false;
    ctx.body.innerHTML = `<div class="daylist">${acts.map((st) => `<section><b>${esc(t("acts.label", { n: st.act.number }))} · ${esc(tx(st.act.title))}</b>
      <ol>${st.items.map((it) => `<li data-id="${it.id}"><span class="tick"></span>${esc(tx(c.checklist.find((x) => x.id === it.id)?.title))}</li>`).join("")}</ol></section>`).join("")}
      <button class="primary done" disabled>${esc(tx(d.done_btn))} ${kbd("Enter")}</button></div>`;
    const btn = ctx.body.querySelector(".done");
    const tickNext = () => {
      if (n >= ticks.length) { ready = true; btn.disabled = false; return; }
      ctx.body.querySelector(`li[data-id="${ticks[n++]}"]`)?.classList.add("ok");
      sound.play("tap");
      ctx.later(tickNext, 260);
    };
    ctx.later(tickNext, 350);
    const finish = () => { if (!ready || finished) return; finished = true; ctx.finish(); };
    btn.addEventListener("click", finish);
    ctx.idleHint = () => (ready ? tx(d.idle) : null);
    ctx.onKey = (e) => { if (["Enter", "NumpadEnter", "Space"].includes(e.code)) { finish(); return true; } return false; };
    ctx.debug = {
      solve: () => { while (n < ticks.length) ctx.body.querySelector(`li[data-id="${ticks[n++]}"]`)?.classList.add("ok"); ready = true; finish(); },
      state: () => ({ ticked: n, total: ticks.length, ready }),
    };
  },
};

export const GAMES = {
  install_app, well, quiz, profile_check, timeline, learning_path, compass, priorities, pool_shot, login, day_checklist,
  photo_checkin: { layout: "photo", start: (ctx) => photo.start(ctx, "checkin") },
  photo_id: { layout: "photo", start: (ctx) => photo.start(ctx, "id") },
};
