// Hộp xác nhận nhỏ (Chơi lại). Màn tạo nhân vật: ui/creator.js.
export function confirmBox(text, yes, no) {
  const el = document.createElement("div");
  el.className = "confirm";
  el.innerHTML = `<div class="panel"><p>${text}</p><div class="row"><button class="ghost" data-a="0">${no}</button><button class="primary" data-a="1">${yes}</button></div></div>`;
  document.body.appendChild(el);
  return new Promise((resolve) => el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { el.remove(); resolve(b.dataset.a === "1"); })));
}
