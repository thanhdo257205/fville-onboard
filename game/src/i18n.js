// Mọi chữ hiển thị lấy từ data/i18n/<lang>.json — không viết cứng trong code.
import { loadJSON, url } from "./core/fetch.js";

let strings = {};
export let lang = "en";
// chữ đã có sẵn (Node: scripts/tests/data.mjs đọc data/i18n/en.json từ đĩa)
export function setStrings(s, l = "en") { strings = s || {}; lang = l; }

export async function loadStrings(l = "en") {
  strings = await loadJSON(url(`data/i18n/${l}.json`));
  lang = l;
}

// Biến dùng chung cho mọi chữ (t() và content.tx()), khỏi truyền ở từng chỗ gọi: đại từ của Tú theo giới tính của Tú
// ({tu_he} {tu_his} {tu_him} {tu_himself}, viết hoa đầu câu {Tu_he}…) — Characters đặt khi biết giới tính người chơi.
export const textVars = {};
const PRONOUNS = { male: { he: "he", his: "his", him: "him", himself: "himself" },
  female: { he: "she", his: "her", him: "her", himself: "herself" } };
export const TU_VARS = Object.keys(PRONOUNS.male).flatMap((k) => [`tu_${k}`, `Tu_${k}`]);
export function tuPronouns(gender) {   // "male" | "female" → { tu_he: "she", Tu_he: "She", … }
  const p = PRONOUNS[gender] || PRONOUNS.male;
  return Object.fromEntries(Object.entries(p).flatMap(([k, v]) => [[`tu_${k}`, v], [`Tu_${k}`, v[0].toUpperCase() + v.slice(1)]]));
}
export function setTextVars(v) { Object.assign(textVars, v); }
export const fill = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? textVars[k] ?? `{${k}}`));

// t("hud.objective_explore", { zone: "Bus Stop" })
export function t(key, vars = {}) {
  const v = key.split(".").reduce((o, k) => (o == null ? o : o[k]), strings);
  if (typeof v !== "string") return key;   // thiếu chuỗi → hiện khoá cho dễ phát hiện
  return fill(v, vars);
}
