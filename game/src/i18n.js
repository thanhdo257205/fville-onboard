// Mọi chữ hiển thị lấy từ data/i18n/<lang>.json (giao diện) và trường { "en", "vi" } của data (nội dung) — không viết cứng
// trong code. 2 ngôn ngữ: en (bản gốc), vi. Thiếu bản vi thì hiện bản en (content.tx); thiếu khoá thì hiện khoá.
// Văn phong bản tiếng Việt (xưng hô, thuật ngữ): docs/vi_style.md.
import { loadJSON, url } from "./core/fetch.js";

export const LANGS = ["en", "vi"];
let strings = {};
export let lang = "en";
// chữ đã có sẵn (Node: scripts/tests/data.mjs đọc data/i18n/en.json từ đĩa)
export function setStrings(s, l = "en") { strings = s || {}; lang = l; }

export async function loadStrings(l = "en") {
  if (!LANGS.includes(l)) l = "en";
  const s = await loadJSON(url(`data/i18n/${l}.json`));
  strings = s;
  lang = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
  setTextVars(tuPronouns(tuGender, l));     // đại từ của Tú theo ngôn ngữ mới
}

// ngôn ngữ lúc mở game: ?lang= (thử) > đã chọn (cài đặt) > ngôn ngữ trình duyệt (vi… → vi) > en
export function pickLang({ param = null, saved = null, nav = [] } = {}) {
  if (LANGS.includes(param)) return param;
  if (LANGS.includes(saved)) return saved;
  return [].concat(nav).some((x) => /^vi/i.test(x || "")) ? "vi" : "en";
}

// Biến dùng chung cho mọi chữ (t() và content.tx()), khỏi truyền ở từng chỗ gọi: đại từ của Tú theo giới tính của Tú
// ({tu_he} {tu_his} {tu_him} {tu_himself}, viết hoa đầu câu {Tu_he}…) — Characters đặt khi biết giới tính người chơi.
// Tiếng Việt: Tú là bạn cùng lứa → "cậu ấy" / "cô ấy" (bản vi thường gọi thẳng tên Tú, ít khi cần biến này).
export const textVars = {};
const PRONOUNS = {
  en: { male: { he: "he", his: "his", him: "him", himself: "himself" }, female: { he: "she", his: "her", him: "her", himself: "herself" } },
  vi: { male: { he: "cậu ấy", his: "của cậu ấy", him: "cậu ấy", himself: "chính cậu ấy" },
    female: { he: "cô ấy", his: "của cô ấy", him: "cô ấy", himself: "chính cô ấy" } },
};
export const TU_VARS = Object.keys(PRONOUNS.en.male).flatMap((k) => [`tu_${k}`, `Tu_${k}`]);
let tuGender = "male";
export function tuPronouns(gender, l = lang) {   // "male" | "female" → { tu_he: "she", Tu_he: "She", … }
  tuGender = gender === "female" ? "female" : "male";
  const p = (PRONOUNS[l] || PRONOUNS.en)[tuGender];
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
