// Tải JSON + đường dẫn tương đối gốc web. Tách khỏi assets.js (three.js, bộ giải nén) để nội dung / chữ / trạng thái
// import được cả trong Node (scripts/tests/data.mjs): document chỉ dùng khi gọi hàm, không dùng lúc import.
export async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// đường dẫn tương đối gốc web (index.html) — chạy được cả dev lẫn bản build đặt trong thư mục con
export const url = (p) => new URL(p.replace(/^\//, ""), document.baseURI).href;
