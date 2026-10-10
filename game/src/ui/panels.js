// Màn tạo nhân vật: tên, giới tính, vị trí intern (ẩn tóc, da: character_creation.hidden) + hộp xác nhận (Chơi lại).
import { tx } from "../content/content.js";
import { t } from "../i18n.js";

// → Promise<{ name, gender, position }> (gender: id trong character_creation.genders, vd "nam" | "nu")
export function characterCreator(cfg) {
  const el = document.createElement("div");
  el.id = "creator";
  const max = cfg.name_max ?? 16;
  el.innerHTML = `<form class="panel">
    <h2>${t("creator.title")}</h2>
    <label>${t("creator.name")}<input name="name" maxlength="${max}" autocomplete="off" placeholder="${t("creator.name_placeholder")}"></label>
    ${cfg.genders?.length ? `<fieldset class="gender"><legend>${t("creator.gender")}</legend>
      ${cfg.genders.map((g, i) => `<label class="pos"><input type="radio" name="gender" value="${g.id}" ${i === 0 ? "checked" : ""}><span>${tx(g.name)}</span></label>`).join("")}
    </fieldset>` : ""}
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
      resolve({ name, gender: form.elements.gender?.value || null, position: form.elements.position.value });
    });
    el.addEventListener("keydown", (e) => e.stopPropagation());   // gõ tên không điều khiển nhân vật
  });
}

// Hộp xác nhận nhỏ (Chơi lại)
export function confirmBox(text, yes, no) {
  const el = document.createElement("div");
  el.className = "confirm";
  el.innerHTML = `<div class="panel"><p>${text}</p><div class="row"><button class="ghost" data-a="0">${no}</button><button class="primary" data-a="1">${yes}</button></div></div>`;
  document.body.appendChild(el);
  return new Promise((resolve) => el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { el.remove(); resolve(b.dataset.a === "1"); })));
}
