// Bộ lọc tin nhắn chat (data/chat.json → filter) — dùng chung cho máy chủ (server/src/index.js: lọc trước khi phát, người
// nhận chỉ thấy bản đã lọc; cũng lọc tên người chơi) và kiểm thử (scripts/tests/data.mjs). JS thuần, không phụ thuộc trình
// duyệt / Node.
//   • Chuẩn hoá: cleanText bỏ ký tự điều khiển / vô hình (zero-width), gộp khoảng trắng, NFC.
//   • Lọc theo TỪNG TỪ (không lọc chuỗi con: "class", "Scunthorpe", "assistant" không bị che):
//     - exact: so nguyên dấu tiếng Việt (chữ thường) — bỏ dấu sẽ trùng từ thường ("cặc" → "các", "lồn" → "lớn").
//     - plain: so sau khi bỏ dấu, đổi chữ số / ký hiệu giống chữ (0 → o, 1 → i, 3 → e, 4 → a, 5 → s, 7 → t, @ → a, $ → s), gộp
//       chữ lặp ("fuuuck" → "fuck"); "*" cuối mục = mọi từ bắt đầu bằng phần trước.
//     - Mục nhiều từ ("đụ má") so các từ liền nhau. Chữ cái tách rời ("f u c k", "d m") ghép lại rồi so.
//     - allow: từ không bao giờ che (so nguyên dấu).
//   • mask_links: đường link (http://, www., tên miền .com / .vn …) → "[link]".
// Từ bị lọc thay bằng dấu "*" cùng độ dài.

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };
const TOKEN = /[\p{L}\p{N}$@]+/gu;
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:com|net|org|vn|io|xyz|ru|info|link|me|app|co|biz|top|site|online|gg|ly)\b(?:\/\S*)?/giu;

// bỏ ký tự điều khiển (\p{Cc}) và định dạng / vô hình (\p{Cf}: zero-width, đổi chiều chữ…), gộp khoảng trắng
export function cleanText(s) {
  if (typeof s !== "string") return "";
  return s.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
}

const lowerNFC = (s) => s.normalize("NFC").toLowerCase();
const collapse = (s) => s.replace(/(.)\1+/gu, "$1");
// bỏ dấu + đ → d, chữ số / ký hiệu giống chữ, gộp chữ lặp
function plainForm(s) {
  const base = s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d");
  return collapse([...base].map((c) => LEET[c] ?? c).join(""));
}
const exactForm = (s) => collapse(lowerNFC(s));

// mục danh sách → { words: [dạng so sánh của từng từ], prefix: mục kết thúc bằng "*" }
function compile(list, form) {
  return (list || []).filter((x) => typeof x === "string" && x.trim()).map((x) => {
    const prefix = x.trim().endsWith("*");
    const words = (prefix ? x.trim().slice(0, -1) : x).trim().split(/\s+/).map(form).filter(Boolean);
    return { words, prefix };
  }).filter((e) => e.words.length).sort((a, b) => b.words.length - a.words.length);   // cụm dài so trước ("địt mẹ" trước "địt")
}

export function makeFilter(cfg = {}) {
  const f = cfg.filter || cfg;
  const exact = compile(f.exact, exactForm), plain = compile(f.plain, plainForm);
  const allow = new Set((f.allow || []).map(lowerNFC));
  const maskChar = typeof f.mask === "string" && f.mask ? [...f.mask][0] : "*";
  const maskLinks = f.mask_links !== false;

  // các từ (vị trí trong chuỗi) + chuỗi chữ cái tách rời ghép lại (vd "f u c k") như một từ ảo trải trên nhiều từ
  function tokens(text) {
    const out = [];
    for (const m of text.matchAll(TOKEN)) out.push({ s: m.index, e: m.index + m[0].length, raw: m[0] });
    return out;
  }
  // mục e có khớp bắt đầu từ từ thứ i không → số từ khớp (0 = không)
  function hit(entry, toks, i, key) {
    const n = entry.words.length;
    if (i + n > toks.length) return 0;
    for (let k = 0; k < n; k++) {
      const w = toks[i + k][key], want = entry.words[k];
      const last = k === n - 1;
      if (!(w === want || (last && entry.prefix && w.startsWith(want)))) return 0;
    }
    return n;
  }

  // → { text: chuỗi đã lọc, hits: số chỗ bị che, links: số link bị che }
  function clean(input) {
    let text = cleanText(input), links = 0;
    if (maskLinks) text = text.replace(LINK, () => { links++; return "[link]"; });
    const toks = tokens(text).map((t) => ({ ...t, ex: exactForm(t.raw), pl: plainForm(t.raw), ok: allow.has(lowerNFC(t.raw)) }));
    // chữ cái tách rời: ≥ 2 từ 1 ký tự liền nhau → thêm 1 "từ ghép" phủ cả đoạn
    const groups = [];
    for (let i = 0; i < toks.length;) {
      let j = i;
      while (j < toks.length && [...toks[j].raw].length === 1) j++;
      if (j - i >= 2) {
        const raw = toks.slice(i, j).map((t) => t.raw).join("");
        groups.push({ s: toks[i].s, e: toks[j - 1].e, raw, ex: exactForm(raw), pl: plainForm(raw), ok: false, parts: toks.slice(i, j) });
      }
      i = Math.max(j, i + 1);
    }
    const spans = [];
    const scan = (list) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].ok) continue;
        let n = 0;
        for (const e of exact) if ((n = hit(e, list, i, "ex"))) break;
        if (!n) for (const e of plain) if ((n = hit(e, list, i, "pl"))) break;
        if (n) {
          for (let k = i; k < i + n; k++) spans.push(...(list[k].parts || [list[k]]));
          i += n - 1;
        }
      }
    };
    scan(toks);
    scan(groups);
    if (!spans.length) return { text, hits: 0, links };
    const chars = [...text];
    // vị trí theo code unit (matchAll) → đổi sang chỉ số ký tự
    const idx = [];
    let u = 0;
    chars.forEach((c, i) => { idx[u] = i; u += c.length; });
    idx[u] = chars.length;
    const seen = new Set();
    for (const sp of spans) {
      const key = `${sp.s}:${sp.e}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (let i = idx[sp.s]; i < idx[sp.e]; i++) chars[i] = maskChar;
    }
    return { text: chars.join(""), hits: seen.size, links };
  }
  return { clean };
}
