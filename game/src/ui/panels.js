// Màn tạo nhân vật (tạm: chỉ tên + vị trí intern; ẩn giới tính, tóc, da) và khung mini-game tạm (Đợt 2).
import { tx } from "../content/content.js";
import { t } from "../i18n.js";

// → Promise<{ name, position }>
export function characterCreator(cfg) {
  const el = document.createElement("div");
  el.id = "creator";
  const max = cfg.name_max ?? 16;
  el.innerHTML = `<form class="panel">
    <h2>${t("creator.title")}</h2>
    <label>${t("creator.name")}<input name="name" maxlength="${max}" autocomplete="off" placeholder="${t("creator.name_placeholder")}"></label>
    <fieldset><legend>${t("creator.position")}</legend>
      ${cfg.positions.map((p, i) => `<label class="pos"><input type="radio" name="position" value="${p.id}" ${i === 0 ? "checked" : ""}><span>${tx(p.name)}</span></label>`).join("")}
    </fieldset>
    <p class="err" aria-live="polite"></p>
    <button class="primary" type="submit">${t("creator.start")}</button></form>`;
  document.body.appendChild(el);
  const form = el.querySelector("form");
  const input = form.elements.name;
  setTimeout(() => input.focus(), 50);
  const bad = (name) => {
    const words = name.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u);
    return (cfg.blocked_words || []).some((w) => words.includes(w.toLowerCase()));
  };
  return new Promise((resolve) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, " ").slice(0, max);
      const err = form.querySelector(".err");
      if (!name) { err.textContent = t("creator.name_empty"); return; }
      if (bad(name)) { err.textContent = t("creator.name_bad"); return; }
      el.remove();
      resolve({ name, position: form.elements.position.value });
    });
    el.addEventListener("keydown", (e) => e.stopPropagation());   // gõ tên không điều khiển nhân vật
  });
}

// Khung mini-game tạm: tiêu đề + mô tả + "Finish for now" (áp kết quả) / "Not now". → Promise<bool>
export class MinigamePanel {
  constructor(content) {
    this.c = content;
    this.el = document.createElement("div");
    this.el.id = "minigame";
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.pending = null;
  }
  get open() { return !this.el.hidden; }
  run(id) {
    const m = this.c.minigames[id];
    this.id = id;
    this.el.hidden = false;
    this.el.innerHTML = `<div class="panel"><h2>${tx(m.title)}</h2><p>${tx(m.desc)}</p><p class="muted">${t("minigame.placeholder")}</p>
      <div class="row"><button class="ghost" data-a="0">${t("minigame.cancel")}</button><button class="primary" data-a="1">${t("minigame.finish")}</button></div></div>`;
    return new Promise((resolve) => {
      this.pending = resolve;
      this.el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => this.close(b.dataset.a === "1")));
    });
  }
  close(ok) {
    if (!this.pending) return;
    const r = this.pending;
    this.pending = null;
    this.el.hidden = true;
    r(ok);
  }
}

// Hộp xác nhận nhỏ (Chơi lại)
export function confirmBox(text, yes, no) {
  const el = document.createElement("div");
  el.className = "confirm";
  el.innerHTML = `<div class="panel"><p>${text}</p><div class="row"><button class="ghost" data-a="0">${no}</button><button class="primary" data-a="1">${yes}</button></div></div>`;
  document.body.appendChild(el);
  return new Promise((resolve) => el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { el.remove(); resolve(b.dataset.a === "1"); })));
}
