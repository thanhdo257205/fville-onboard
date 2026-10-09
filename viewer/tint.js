// Đổi màu áo / quần cho từng vai bằng code (TẠM, khi mọi vai dùng chung model prajith): characters.json
// roles.<vai>.tint = { "shirt": "#hex", "pants": "#hex" }. Không sửa texture/GLB.
// Vùng: mỗi đỉnh có mặt nạ theo trọng số xương (thân + tay → áo; hông + chân → quần), lưu 1 lần cho mỗi geometry.
// Điểm ảnh: áo = cam đậm (bão hoà cao), da = cam nhạt (bão hoà thấp) → chỉ đổi điểm ảnh cam đậm trong vùng áo;
// quần = xám sáng (bão hoà thấp) trong vùng chân. Màu mới = màu đích × (độ sáng điểm ảnh / độ sáng trung bình gốc)
// → giữ nếp vải, bóng đổ của texture.
import * as THREE from "three";

const SHIRT_BONES = /^(Hips|Spine\d?|Neck|(Left|Right)(Shoulder|Arm|ForeArm|UpLeg))$/;
const PANTS_BONES = /^(Hips|(Left|Right)(UpLeg|Leg|Foot))$/;
const boneKey = (name) => name.replace(/^mixamorig:?/, "");

// sRGB 8 bit → HSV (h độ, s, v 0..1) và độ sáng tuyến tính
function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luma = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const isShirtPixel = (h, s, v) => s > 0.45 && v > 0.35 && h > 5 && h < 45;
export const isPantsPixel = (h, s, v) => s < 0.25 && v > 0.45;

// mặt nạ đỉnh (attribute tintMask: x = áo, y = quần) + độ sáng trung bình của áo / quần gốc (lấy mẫu texture tại uv đỉnh)
function prepare(mesh) {
  const geo = mesh.geometry;
  if (geo.userData.tint) return geo.userData.tint;
  const names = mesh.skeleton.bones.map((b) => boneKey(b.name));
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, uv = geo.attributes.uv;
  const mask = new Float32Array(si.count * 2);
  for (let i = 0; i < si.count; i++) {
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k), n = names[si.getComponent(i, k)];
      if (SHIRT_BONES.test(n)) mask[i * 2] += w;
      if (PANTS_BONES.test(n)) mask[i * 2 + 1] += w;
    }
  }
  geo.setAttribute("tintMask", new THREE.BufferAttribute(mask, 2));
  const base = { shirt: 0.3, pants: 0.6 };
  const tex = mesh.material.map;
  try {
    const img = tex.image, cv = document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;
    const acc = { shirt: [0, 0], pants: [0, 0] };
    for (let i = 0; i < uv.count; i++) {
      const x = Math.min(cv.width - 1, Math.max(0, Math.floor(uv.getX(i) * cv.width)));
      const v = tex.flipY ? 1 - uv.getY(i) : uv.getY(i);
      const y = Math.min(cv.height - 1, Math.max(0, Math.floor(v * cv.height)));
      const k = (y * cv.width + x) * 4, [r, g, b] = [px[k], px[k + 1], px[k + 2]];
      const [h, s, val] = hsv(r, g, b);
      if (mask[i * 2] > 0.5 && isShirtPixel(h, s, val)) { acc.shirt[0] += luma(r, g, b); acc.shirt[1]++; }
      if (mask[i * 2 + 1] > 0.5 && isPantsPixel(h, s, val)) { acc.pants[0] += luma(r, g, b); acc.pants[1]++; }
    }
    for (const p of ["shirt", "pants"]) if (acc[p][1] > 20) base[p] = acc[p][0] / acc[p][1];
  } catch (e) { console.warn("[tint] không đọc được texture, dùng độ sáng mặc định", e); }
  geo.userData.tint = base;
  return base;
}

// gắn vào material (MeshToonMaterial riêng của nhân vật). Chương trình shader dùng chung, uniform riêng từng NPC.
// dynamic: gắn shader cả khi chưa có màu → setTint() đổi lúc chơi (vd người chơi mặc áo sơ mi thường, nhận Áo Cam FPT ở cổng).
export function applyTint(character, tint, { dynamic = false } = {}) {
  if (!dynamic && (!tint || (!tint.shirt && !tint.pants))) return;
  character.tintUniforms = [];
  character.root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.material.map) return;
    const base = prepare(o);
    const u = {
      tintShirt: { value: new THREE.Color(tint.shirt || "#ffffff") },
      tintPants: { value: new THREE.Color(tint.pants || "#ffffff") },
      tintOn: { value: new THREE.Vector2(tint.shirt ? 1 : 0, tint.pants ? 1 : 0) },
      tintBase: { value: new THREE.Vector2(base.shirt, base.pants) },
    };
    character.tintUniforms.push(u);
    o.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 tintMask;\nvarying vec2 vTintMask;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTintMask = tintMask;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 tintShirt;\nuniform vec3 tintPants;\nuniform vec2 tintOn;\nuniform vec2 tintBase;\nvarying vec2 vTintMask;")
        .replace("#include <map_fragment>", `#include <map_fragment>
  {
    vec3 tc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));      // về sRGB để phân loại như trên CPU
    float tmx = max(tc.r, max(tc.g, tc.b)), td = tmx - min(tc.r, min(tc.g, tc.b));
    float tsat = tmx > 1e-4 ? td / tmx : 0.0;
    float thue = 0.0;
    if (td > 1e-4) {
      if (tmx == tc.r) thue = mod((tc.g - tc.b) / td, 6.0);
      else if (tmx == tc.g) thue = (tc.b - tc.r) / td + 2.0;
      else thue = (tc.r - tc.g) / td + 4.0;
      thue *= 60.0;
    }
    float tl = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float ws = tintOn.x * step(0.5, vTintMask.x) * smoothstep(0.38, 0.5, tsat) * smoothstep(0.3, 0.4, tmx)
      * smoothstep(2.0, 8.0, thue) * (1.0 - smoothstep(42.0, 50.0, thue));
    float wp = tintOn.y * step(0.5, vTintMask.y) * (1.0 - smoothstep(0.2, 0.3, tsat)) * smoothstep(0.4, 0.5, tmx);
    diffuseColor.rgb = mix(diffuseColor.rgb, min(tintShirt * (tl / tintBase.x), vec3(1.0)), ws);
    diffuseColor.rgb = mix(diffuseColor.rgb, min(tintPants * (tl / tintBase.y), vec3(1.0)), wp);
  }`);
    };
    o.material.customProgramCacheKey = () => "fville-tint-v1";
    o.material.needsUpdate = true;
  });
}

// đổi màu lúc chơi (cần applyTint(..., { dynamic: true }) trước); tint null = màu gốc của model
export function setTint(character, tint) {
  for (const u of character.tintUniforms || []) {
    u.tintOn.value.set(tint?.shirt ? 1 : 0, tint?.pants ? 1 : 0);
    if (tint?.shirt) u.tintShirt.value.set(tint.shirt);
    if (tint?.pants) u.tintPants.value.set(tint.pants);
  }
}
