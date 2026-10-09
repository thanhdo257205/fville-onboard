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

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: POWER_PREFERENCE });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0025, defaultColor: [0.06, 0.06, 0.07] });
  let useOutline = true;
  return {
    three: renderer,
    canvas: renderer.domElement,
    get info() { return renderer.info.render; },
    setSize(w, h) { renderer.setSize(w, h); },
    setOutline(on) { useOutline = on; },
    render(scene, camera) { (useOutline ? outline : renderer).render(scene, camera); },
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
export function makeZoneMaterial(src, { lightmap = false } = {}) {
  const lm = lightmap ? src.aoMap || null : null;
  const m = new THREE.MeshToonMaterial({
    color: src.color, map: src.map ?? null, vertexColors: true, gradientMap: toonGradient,
    transparent: src.transparent, opacity: src.opacity, side: src.side,
    emissive: src.emissive, emissiveIntensity: src.emissiveIntensity,
    lightMap: lm, lightMapIntensity: LIGHTMAP_INTENSITY,
  });
  if (src.transparent) m.userData.outlineParameters = { visible: false };
  return { material: m, hasLightmap: !!lm };
}

// Chất liệu nhân vật (không có vertex color). src có thể chỉ có màu (vd túi cầm tay do code dựng) → map = null,
// không truyền undefined (three.js cảnh báo "parameter 'map' has value of undefined").
export function makeCharacterMaterial(src) {
  return new THREE.MeshToonMaterial({ map: src.map ?? null, color: src.color, gradientMap: toonGradient });
}
