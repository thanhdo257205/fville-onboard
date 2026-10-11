// Nhận biết máy cảm ứng (không dựa vào user agent): con trỏ chính "coarse" (ngón tay — điện thoại, máy tính bảng) hoặc có màn
// cảm ứng (navigator.maxTouchPoints > 0). Ép bật để thử: ?touch=1 (?touch=0: ép tắt).
//   • phone: con trỏ chính là ngón tay (matchMedia "(pointer: coarse)") hoặc ép bật → giao diện cảm ứng bật ngay, nấc Detail
//     thấp, ít người chơi khác hơn.
//   • laptop có màn cảm ứng + chuột (con trỏ chính "fine"): chơi bàn phím / chuột như thường; lần chạm đầu tiên mới bật giao
//     diện cảm ứng (ui/touch.js → device.setTouch(true)), bấm phím thì tắt lại.
//   • ios: Safari / iPhone / iPad (kể cả iPad báo "MacIntel") — chỉ dùng cho chỗ iOS khác hẳn: không có Fullscreen API (hướng
//     dẫn "Thêm vào màn hình chính"), tải ảnh thẻ PNG (mở ảnh trong tab mới để lưu).
// device.touch: giao diện cảm ứng đang bật (body.touch). Lắng nghe: device.onChange(fn).
import { t } from "../i18n.js";

const params = new URLSearchParams(location.search);
const forced = params.get("touch");
const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const points = (typeof navigator !== "undefined" && navigator.maxTouchPoints) || 0;
const plat = (typeof navigator !== "undefined" && navigator.platform) || "";

const listeners = new Set();
export const device = {
  forced: forced === "1" ? true : forced === "0" ? false : null,
  // có thể chạm (màn cảm ứng) — laptop cảm ứng cũng tính
  touchCapable: forced === "1" || (forced !== "0" && (coarse || points > 0)),
  // điện thoại / máy tính bảng: con trỏ chính là ngón tay
  phone: forced === "1" || (forced !== "0" && coarse),
  ios: /iP(hone|ad|od)/.test(plat) || (plat === "MacIntel" && points > 1),
  touch: false,
  setTouch(on) {
    on = !!on && this.forced !== false;
    if (on === this.touch) return;
    this.touch = on;
    document.body.classList.toggle("touch", on);
    for (const fn of listeners) fn(on);
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

// chữ nói về phím trong nội dung (vd gợi ý "press E near a sign" / "nhấn E") → đổi sang cách chạm khi giao diện cảm ứng đang
// bật. Cặp chữ trong data/i18n (touch.say_from / touch.say_to), mỗi ngôn ngữ một cặp; không phân biệt hoa thường, giữ chữ hoa đầu
export function touchText(s) {
  if (!device.touch || typeof s !== "string") return s;
  const from = t("touch.say_from"), to = t("touch.say_to");
  if (!from || from === "touch.say_from") return s;
  const re = new RegExp(`(^|[^\\p{L}])(${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\p{L}\\p{N}])`, "giu");
  return s.replace(re, (m, pre, word) => pre + (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to));
}
