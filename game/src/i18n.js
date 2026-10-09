// Mọi chữ hiển thị lấy từ data/i18n/<lang>.json — không viết cứng trong code.
import { loadJSON, url } from "./core/assets.js";

let strings = {};
export let lang = "en";

export async function loadStrings(l = "en") {
  strings = await loadJSON(url(`data/i18n/${l}.json`));
  lang = l;
}

// t("hud.objective_explore", { zone: "Bus Stop" })
export function t(key, vars = {}) {
  const v = key.split(".").reduce((o, k) => (o == null ? o : o[k]), strings);
  if (typeof v !== "string") return key;   // thiếu chuỗi → hiện khoá cho dễ phát hiện
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}
