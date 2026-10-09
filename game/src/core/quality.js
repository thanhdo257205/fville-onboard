// Mức đồ hoạ: tự chọn theo GPU khi khởi động, đổi được trong menu Esc, tự hạ xuống Thấp nếu FPS < 40.
// Độ nét (menu Esc → Detail: Auto / Sharper / Faster): đã ở mức Thấp mà FPS vẫn < DETAIL_FPS thì (Auto) hạ từng nấc
// pixelRatio 1,25 → 1,0, rồi tắt viền nét (render/renderer.js → DETAIL_LEVELS).
const KEY = "fville.settings";
export const DETAIL_FPS = 45;

export function loadSettings() {
  const d = { tier: "auto", detail: "auto" };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return d; }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* chế độ riêng tư: bỏ qua */ }
}

// GPU rời / chip mạnh → Cao; GPU tích hợp, phần mềm → Thấp
const HIGH = /(nvidia|geforce|rtx|gtx|quadro|radeon\s*(rx|pro|r9|vii)|arc\s*a\d|apple m\d\s*(pro|max|ultra))/i;
const SOFTWARE = /(swiftshader|llvmpipe|software|basic render|microsoft basic)/i;

export function detectTier(gpuName) {
  if (SOFTWARE.test(gpuName)) return { tier: "low", reason: "software" };
  if (HIGH.test(gpuName)) return { tier: "high", reason: "gpu" };
  return { tier: "low", reason: "integrated" };
}

// Đo FPS trung bình sau khi tải zone (bỏ 3 s đầu), gọi onLow nếu < threshold. Bỏ qua khung khi tab bị ẩn.
export class FpsMonitor {
  constructor({ warmup = 3, window = 5, threshold = 40, onLow }) {
    Object.assign(this, { warmup, window, threshold, onLow });
    this.reset();
  }
  reset() { this.t = 0; this.frames = 0; this.time = 0; this.done = false; }
  tick(dt) {
    if (this.done || dt > 0.25) return;      // khung bị dừng (tab ẩn) không tính
    this.t += dt;
    if (this.t < this.warmup) return;
    this.frames++; this.time += dt;
    if (this.time >= this.window) {
      this.done = true;
      const fps = this.frames / this.time;
      if (fps < this.threshold) this.onLow?.(fps);
    }
  }
}
