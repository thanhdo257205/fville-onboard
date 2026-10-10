// Mức đồ hoạ: tự chọn theo GPU khi khởi động, đổi được trong menu Esc, tự hạ xuống Thấp nếu FPS < 40.
// Độ nét (menu Esc → Detail: Auto / Sharper / Faster): đã ở mức Thấp mà FPS vẫn < DETAIL_FPS thì (Auto) hạ từng nấc
// pixelRatio 1,25 → 1,0, rồi tắt viền nét (render/renderer.js → DETAIL_LEVELS).
const KEY = "fville.settings";
export const DETAIL_FPS = 45;

// Mức đồ hoạ đang có GLB build đúng với data. Bản Cao (lightmap, assets/glb/high/) TẠM DỪNG từ 08/10/2026: không build
// lại nên lệch data — vd zone_04 bản Cao thiếu SPAWN_zone_04_from_zone_03 (thêm 09/10) → máy GPU rời tự chọn Cao kẹt ở
// màn tải khi vào zone 4 (10/10/2026). Bật lại: build lại đủ 6 zone bản Cao rồi thêm "high" vào đây.
export const TIERS = ["low"];
export const usableTier = (tier) => (TIERS.includes(tier) ? tier : "low");

export function loadSettings() {
  const d = { tier: "auto", detail: "auto" };
  let s = d;
  try { s = { ...d, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { /* hỏng → mặc định */ }
  if (s.tier !== "auto" && !TIERS.includes(s.tier)) s.tier = "auto";   // cài đặt cũ (vd "high" khi bản Cao đang tạm dừng)
  return s;
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* chế độ riêng tư: bỏ qua */ }
}

// GPU rời / chip mạnh → Cao; GPU tích hợp, phần mềm → Thấp
const HIGH = /(nvidia|geforce|rtx|gtx|quadro|radeon\s*(rx|pro|r9|vii)|arc\s*a\d|apple m\d\s*(pro|max|ultra))/i;
const SOFTWARE = /(swiftshader|llvmpipe|software|basic render|microsoft basic)/i;

export function detectTier(gpuName) {
  if (SOFTWARE.test(gpuName)) return { tier: "low", reason: "software" };
  if (HIGH.test(gpuName)) return TIERS.includes("high") ? { tier: "high", reason: "gpu" } : { tier: "low", reason: "gpu (high paused)" };
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
