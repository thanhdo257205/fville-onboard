// Tải JSON + đường dẫn tương đối gốc web. Tách khỏi assets.js (three.js, bộ giải nén) để nội dung / chữ / trạng thái
// import được cả trong Node (scripts/tests/data.mjs): document chỉ dùng khi gọi hàm, không dùng lúc import.
export async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// mã phiên bản bản build (vite.config.js → define __BUILD_ID__; dev / Node: rỗng). Gắn ?v=<mã> vào data/ và assets/ →
// sau mỗi lần deploy trình duyệt tải bản mới, không dùng bản cũ trong bộ nhớ đệm (GitHub Pages / CDN cache vài phút).
// eslint-disable-next-line no-undef
export const BUILD_ID = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "";

// đường dẫn tương đối gốc web (index.html) — chạy được cả dev lẫn bản build đặt trong thư mục con
export const url = (p) => {
  const u = new URL(p.replace(/^\//, ""), document.baseURI);
  if (BUILD_ID && /^\/?(data|assets)\//.test(p)) u.searchParams.set("v", BUILD_ID);
  return u.href;
};
