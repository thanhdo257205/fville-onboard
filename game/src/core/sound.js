// Âm thanh: chỗ gọi sẵn cho mini-game, nhặt đồ, chụp ảnh… — chưa có file (GDD Giai đoạn 3 thêm âm thanh).
// Gắn file: điền đường dẫn vào SOUNDS (vd "assets/sfx/correct.ogg"); sound.play(tên) tự phát, không có file thì bỏ qua.
// sound.log ghi lại các lần gọi để kiểm tra (__game.sounds).
import { url } from "./assets.js";

export const SOUNDS = {
  mg_open: null,       // mở mini-game
  mg_correct: null,    // làm đúng một bước
  mg_wrong: null,      // sai (kèm gợi ý)
  mg_done: null,       // xong mini-game
  mg_skip: null,       // bấm Skip
  tap: null,           // bấm nút / chọn thẻ
  progress: null,      // thanh tải (cài app)
  shutter: null,       // chụp ảnh
  bucket: null,        // kéo được gầu nước
  splash: null,        // trượt vùng xanh
  grain: null,         // nhặt hạt lúa vàng
  pickup: null,        // nhặt đồ
  nudge: null,         // Tú nhắc (bong bóng) khi đứng yên
  phone: null,         // tin nhắn điện thoại ngắn (nhắc khi không có Tú)
  help: null,          // mở thẻ gợi ý (phím H)
};

const cache = new Map();

export const sound = {
  enabled: true,
  volume: 0.8,
  log: [],
  play(name) {
    this.log.push(name);
    if (this.log.length > 200) this.log.shift();
    const src = SOUNDS[name];
    if (!src || !this.enabled) return;
    try {
      let a = cache.get(name);
      if (!a) { a = new Audio(url(src)); cache.set(name, a); }
      a.volume = this.volume;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch { /* trình duyệt chặn âm thanh: bỏ qua */ }
  },
};
