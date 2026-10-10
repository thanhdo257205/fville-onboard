// Phụ kiện đội trên đầu nhân vật (tủ đồ): hiện có mũ lưỡi trai cam (data/characters.json → accessories.cap; GLB
// assets/accessories/cap/cap.glb + số đo cap.json — scripts/blender/accessories/build_cap.py). Mũ là con của xương đầu
// (…Head) nên đi theo mọi animation, cả người chơi lẫn người chơi khác (chơi nhiều người).
// Chỗ đội tính từ chính lưới nhân vật ở tư thế gốc (bind pose), không cần số đo tay cho từng model:
//   • các đỉnh thuộc xương đầu (trọng số ≥ 0,5; gồm cả tóc) → đỉnh đầu, tâm + bề ngang / bề sâu ở dải tầm trán
//   • co giãn vòng đội đầu của mũ (opening_m) cho vừa bề ngang / bề sâu đó, chừa thêm `room` (tóc), đặt vòm mũ (crown_m)
//     cao hơn đỉnh đầu `gap_m`
//   • chỉnh tay theo model nếu cần: accessories.<id>.adjust.<model> = { up_m, forward_m, scale, pitch_deg }
// Kết quả (ma trận theo xương đầu) nhớ theo model, mọi nhân vật cùng model dùng chung.
import * as THREE from "three";
import { loadGLTF, url } from "../core/assets.js";
import { makeCharacterMaterial } from "../render/renderer.js";

const meshes = new Map();   // id → Promise<THREE.Object3D> (mẫu đã đổi vật liệu, clone khi gắn)
const fits = new Map();     // `${id}:${model}` → { bone: tên xương đầu, local: Matrix4 (trong hệ xương đầu), shape }

export function loadAccessory(id, cfg) {
  if (!meshes.has(id)) {
    meshes.set(id, loadGLTF(url(cfg.glb)).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) o.material = makeCharacterMaterial(o.material); });
      return g.scene;
    }));
  }
  return meshes.get(id);
}

// đầu ở tư thế nghỉ, toạ độ gốc nhân vật (Y lên, model nhìn +Z, mét): { pts (đỉnh thuộc xương đầu, cả tóc), top, cx, boneY,
// bone, boneMatrix }. Không đụng tư thế xương đang chạy: đỉnh gắn chặt xương đầu ở hệ xương = boneInverse × bindMatrix × v
// (GLB lượng tử hoá đưa hệ số giải nén vào boneInverse), rồi × xương đầu lúc nghỉ (Character.headRest, lấy khi tạo nhân vật).
export function headShape(character) {
  const rest = character.headRest;
  if (!rest || !character.head) return null;
  let out = null;
  character.root.traverse((o) => {
    if (out || !o.isSkinnedMesh) return;
    const sk = o.skeleton, hi = sk.bones.findIndex((b) => b.name === character.head.name);
    if (hi < 0) return;
    const toRoot = rest.clone().multiply(sk.boneInverses[hi]).multiply(o.bindMatrix);
    const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pts = [];
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
      if (w >= 0.5) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toRoot));
    }
    if (!pts.length) return;
    const xs = pts.map((p) => p.x);
    out = { pts, top: Math.max(...pts.map((p) => p.y)), cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      boneY: new THREE.Vector3().setFromMatrixPosition(rest).y, bone: character.head, boneMatrix: rest };
  });
  return out;
}

// ướm mũ (ma trận trong hệ xương đầu, nhớ theo model):
//   • tầm trán (mép trước vòng đội đầu): độ cao = xương đầu + fit.brow × (đỉnh đầu − xương đầu)
//   • tỉ lệ = vòng đội đầu vừa bề ngang / bề sâu phần đầu + tóc từ tầm trán (− 2 cm) trở lên (bỏ 4 % đỉnh lệch nhất mỗi phía:
//     lọn tóc vểnh) × fit.room — lưới 6k thưa, đo cả phần trên thay vì một dải mỏng; tóc dưới tầm đó (gáy, tóc dài) được
//     lòi ra như mũ thật
//   • vòng đội đầu nghiêng tilt_deg (mép trước cao hơn mép sau, như mũ thật), mép trước sát trước trán (+ fit.front_m)
//   • vòm mũ thật (bản đồ độ cao dựng từ đỉnh của GLB mũ, trên mặt phẳng vòng đội đầu): đỉnh đầu / tóc trên mặt phẳng đó
//     mà lòi ra ngoài vòm → phóng to thêm tới khi trùm được fit.enclose (97 %, bỏ lọn tóc lẻ) — vd tóc bob dày của intern_nu
//   • đỉnh vòm (crown_m × tỉ lệ) thấp hơn đỉnh tóc + fit.gap_m → nâng cả mũ lên (vòm không lún vào tóc)
export function fitAccessory(id, cfg, character, template) {
  const key = `${id}:${character.modelId}`;
  if (fits.has(key)) return fits.get(key);
  const h = headShape(character);
  if (!h) { fits.set(key, null); return null; }
  const adj = cfg.adjust?.[character.modelId] || {}, F = cfg.fit || {};
  const a = cfg.opening_m[0] / 2, c = cfg.opening_m[1] / 2, t = THREE.MathUtils.degToRad(cfg.tilt_deg ?? 0);
  const brow = h.boneY + (F.brow ?? 0.66) * (h.top - h.boneY) + (adj.up_m || 0);
  let band = h.pts.filter((p) => p.y >= brow - 0.02);
  if (band.length < 8) band = h.pts;
  const span = (vals) => { const v = [...vals].sort((x, y) => x - y), k = Math.floor(v.length * 0.04); return [v[k], v[v.length - 1 - k]]; };
  const [x0, x1] = span(band.map((p) => p.x)), [z0, z1] = span(band.map((p) => p.z));
  const width = x1 - x0, depth = z1 - z0;
  const s0 = Math.max(width / (2 * a), depth / (2 * c)) * (F.room ?? 1.06);
  const center = new THREE.Vector3((x0 + x1) / 2, brow - Math.sin(t) * c * s0, z1 - Math.cos(t) * c * s0 + (F.front_m ?? 0.004) + (adj.forward_m || 0));
  // điểm đầu / tóc trên mặt phẳng vòng đội đầu (toạ độ mũ chưa co giãn, gốc = tâm vòng đội đầu)
  const tanT = Math.tan(t), above = band.map((p) => p.clone().sub(center)).filter((q) => q.y > q.z * tanT);
  const dome = template ? domeOf(template, tanT) : null;
  const inside = (k) => above.filter((q) => dome.inside(q.x / k, q.y / k, q.z / k)).length / above.length;
  let enclose = s0;
  if (dome && above.length && inside(s0) < (F.enclose ?? 0.97)) {
    let lo = s0, hi = s0 * 2;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inside(mid) >= (F.enclose ?? 0.97)) hi = mid; else lo = mid; }
    enclose = hi;
  }
  const s = Math.max(s0, enclose) * (adj.scale ?? 1);
  const lift = Math.max(0, h.top + (F.gap_m ?? 0.004) - (center.y + cfg.crown_m * s));
  center.y += lift;
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(adj.pitch_deg || 0), 0, 0));
  const inRoot = new THREE.Matrix4().compose(center, quat, new THREE.Vector3(s, s, s));
  const local = h.boneMatrix.clone().invert().multiply(inRoot);
  const fit = { bone: h.bone.name, local, shape: { top: +h.top.toFixed(3), boneY: +h.boneY.toFixed(3), brow: +brow.toFixed(3),
    width: +width.toFixed(3), depth: +depth.toFixed(3), s0: +s0.toFixed(3), enclose: +enclose.toFixed(3), scale: +s.toFixed(3), lift: +lift.toFixed(3),
    center: center.toArray().map((v) => +v.toFixed(3)) } };
  fits.set(key, fit);
  return fit;
}
export const fitOf = (id, modelId) => fits.get(`${id}:${modelId}`) ?? null;

// vòm mũ: bản đồ độ cao (ô 1 cm trên mặt phẳng x–z của mũ) = đỉnh cao nhất của lưới mũ mỗi ô, chỉ phần trên mặt phẳng vòng
// đội đầu (y > z·tan(nghiêng)); điểm (x, y, z) trong vòm khi ô của nó (hoặc ô kề) có đỉnh và y ≤ độ cao đó
const domes = new WeakMap();
function domeOf(template, tanT) {
  if (domes.has(template)) return domes.get(template);
  const CELL = 0.01, H = new Map(), v = new THREE.Vector3();
  template.updateMatrixWorld(true);
  template.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y <= v.z * tanT + 0.005) continue;                     // vành / mép đội đầu: không phải vòm
      const key = `${Math.round(v.x / CELL)},${Math.round(v.z / CELL)}`;
      if (!(H.get(key) >= v.y)) H.set(key, v.y);
    }
  });
  const height = (x, z) => {
    const ix = Math.round(x / CELL), iz = Math.round(z / CELL);
    let best = -Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const h = H.get(`${ix + dx},${iz + dz}`); if (h > best) best = h; }
    return best;
  };
  const dome = { inside: (x, y, z) => y <= height(x, z) };
  domes.set(template, dome);
  return dome;
}

// gắn bản sao phụ kiện vào xương đầu của nhân vật → Object3D (gỡ bằng removeFromParent)
export function attachAccessory(id, cfg, character, template) {
  const fit = fitAccessory(id, cfg, character, template);
  if (!fit) return null;
  let bone = null;
  character.root.traverse((o) => { if (!bone && o.isBone && o.name === fit.bone) bone = o; });
  if (!bone) return null;
  const obj = template.clone(true);
  obj.name = `acc_${id}`;
  obj.matrixAutoUpdate = true;
  fit.local.decompose(obj.position, obj.quaternion, obj.scale);
  obj.traverse((o) => { o.userData = { dynamic: true, accessory: id }; });
  bone.add(obj);
  return obj;
}
