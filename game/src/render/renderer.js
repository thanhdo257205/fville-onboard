// Renderer + chất liệu, gom một chỗ: muốn chuyển sang WebGPU chỉ cần viết lại file này
// (createRenderer trả về cùng giao diện: render, setSize, info, gl…; make*Material trả chất liệu tương ứng).
// Hiện dùng WebGLRenderer để tái sử dụng toon 3 bậc + viền nét (OutlineEffect) giống viewer/.
import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";

// gradient 3 bậc cho toon
const toonGradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter;
toonGradient.needsUpdate = true;

export const LIGHTMAP_INTENSITY = 2.2;

// Ưu tiên card đồ hoạ rời trên laptop 2 card. Dùng chung cho mọi backend:
//   WebGL  : new THREE.WebGLRenderer({ powerPreference })              (hiện tại)
//   WebGPU : navigator.gpu.requestAdapter({ powerPreference }) hoặc new WebGPURenderer({ powerPreference })
// Đây chỉ là gợi ý: Chrome trên Windows có thể bỏ qua → chỉnh Windows Settings → Display → Graphics → High performance.
export const POWER_PREFERENCE = "high-performance";
export const GPU_ADAPTER_OPTIONS = { powerPreference: POWER_PREFERENCE };

// Nấc độ nét (menu Esc → Detail; tự hạ khi đã ở mức Thấp mà FPS vẫn thấp — game.js autoDetail):
//   0 = đủ nét (pixelRatio tối đa 1,5 + viền nét) · 1 = pixelRatio 1,0 · 2 = pixelRatio 1,0 + tắt viền nét
export const DETAIL_LEVELS = [{ maxPixelRatio: 1.5, outline: true }, { maxPixelRatio: 1.0, outline: true }, { maxPixelRatio: 1.0, outline: false }];

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: POWER_PREFERENCE });
  const pixelRatioFor = (level) => Math.min(window.devicePixelRatio, DETAIL_LEVELS[level].maxPixelRatio);
  renderer.setPixelRatio(pixelRatioFor(0));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0025, defaultColor: [0.06, 0.06, 0.07] });
  let useOutline = true, detail = 0;
  return {
    three: renderer,
    canvas: renderer.domElement,
    get info() { return renderer.info.render; },
    setSize(w, h) { renderer.setSize(w, h); },
    setOutline(on) { useOutline = on; },
    render(scene, camera) { (useOutline ? outline : renderer).render(scene, camera); },
    get detail() { return detail; },
    // nấc có đổi gì so với nấc hiện tại không (vd màn hình devicePixelRatio 1: nấc 0 → 1 không khác gì)
    detailDiffers(level) { return pixelRatioFor(level) !== renderer.getPixelRatio() || DETAIL_LEVELS[level].outline !== useOutline; },
    setDetail(level) {
      detail = level;
      useOutline = DETAIL_LEVELS[level].outline;
      if (renderer.getPixelRatio() !== pixelRatioFor(level)) renderer.setPixelRatio(pixelRatioFor(level));   // tự đặt lại kích thước khung vẽ
    },
    // Biên dịch shader + đưa texture lên GPU trước khi hiện zone (gọi lúc màn chờ còn che). Không có bước này, khung đầu
    // tiên nhìn thấy một chất liệu mới đứng 90–300 ms để biên dịch (mỗi lần vào zone, vì shader zone cũ đã bị huỷ).
    // Dùng compile() đồng bộ, không dùng compileAsync: đo trên Chrome/ANGLE D3D11 (docs/perf_report.md), compileAsync
    // chờ KHR_parallel_shader_compile mất 0,35–0,75 s mỗi zone, còn compile() + 1 khung vẽ chỉ 50–65 ms — màn chờ đang
    // che nên chặn luồng chính lúc này không sao.
    async warmup(scene, camera) {
      // 1) lượt cảnh: mọi chất liệu đang hiện (toon, cây mờ seeThrough, nhân vật có tint), không phụ thuộc hướng camera
      renderer.compile(scene, camera);
      // 2) viền nét (OutlineEffect tạo chất liệu viền lúc vẽ) + texture: vẽ 1 khung với mọi vật, bỏ cắt theo tầm nhìn
      const culled = [];
      scene.traverse((o) => { if (o.frustumCulled && (o.isMesh || o.isLine || o.isPoints)) { o.frustumCulled = false; culled.push(o); } });
      try { (useOutline ? outline : renderer).render(scene, camera); } finally { for (const o of culled) o.frustumCulled = true; }
    },
    // tên GPU (để tự chọn mức đồ hoạ)
    gpuName() {
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    },
    // chờ GPU vẽ xong (đo thời gian khung hình thật, không phụ thuộc requestAnimationFrame/vsync)
    finish() { const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); },
  };
}

// Đèn chung: có lightmap (bản Cao) thì nắng/bóng đã nướng → giảm đèn thời gian thực.
// setMood(zones.json → mood): màu/hướng nắng, màu trời của từng zone (vd zone_00 sáng sớm); null = ban ngày mặc định.
export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x7a8a5a, 1.1);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.6);
  sun.position.set(-30, 60, 40);
  scene.add(hemi, sun);
  const base = { sky: hemi.color.clone(), ground: hemi.groundColor.clone(), sun: sun.color.clone(), pos: sun.position.clone() };
  let lightmap = false, mood = null;
  const apply = () => {
    const m = mood || {};
    hemi.color.set(m.hemi?.sky ?? base.sky);
    hemi.groundColor.set(m.hemi?.ground ?? base.ground);
    sun.color.set(m.sun?.color ?? base.sun);
    if (m.sun?.position) sun.position.fromArray(m.sun.position); else sun.position.copy(base.pos);
    const hi = m.hemi?.intensity ?? 1.1, si = m.sun?.intensity ?? 1.6;
    hemi.intensity = lightmap ? hi * 0.32 : hi;      // 1.1 → 0.35 như trước
    sun.intensity = lightmap ? si * 0.28 : si;       // 1.6 → 0.45
  };
  return {
    setLightmapMode(on) { lightmap = on; apply(); },
    setMood(m) { mood = m || null; apply(); },
  };
}

// Chất liệu bối cảnh: vertex color (đã nhân AO) × texture; bản Cao dùng occlusionTexture (UV 1) làm lightMap.
// Lá cây (glTF MASK → alphaTest, cắt theo alpha của ảnh, không blend) và chất liệu Blender đặt custom property
// outline = false (extras → userData): không vẽ viền nét — viền OutlineEffect không đọc alpha, sẽ thành khung đen quanh
// cả mảng lá.
export function makeZoneMaterial(src, { lightmap = false } = {}) {
  const lm = lightmap ? src.aoMap || null : null;
  const m = new THREE.MeshToonMaterial({
    color: src.color, map: src.map ?? null, vertexColors: true, gradientMap: toonGradient,
    transparent: src.transparent, opacity: src.opacity, side: src.side, alphaTest: src.alphaTest || 0,
    emissive: src.emissive, emissiveIntensity: src.emissiveIntensity,
    lightMap: lm, lightMapIntensity: LIGHTMAP_INTENSITY,
  });
  if (src.transparent || src.alphaTest > 0 || src.userData?.outline === false) m.userData.outlineParameters = { visible: false };
  return { material: m, hasLightmap: !!lm };
}

// Chất liệu nhân vật (không có vertex color). src có thể chỉ có màu (vd túi cầm tay do code dựng) → map = null,
// không truyền undefined (three.js cảnh báo "parameter 'map' has value of undefined").
export function makeCharacterMaterial(src) {
  return new THREE.MeshToonMaterial({ map: src.map ?? null, color: src.color, gradientMap: toonGradient });
}
