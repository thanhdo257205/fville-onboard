// Tải 1 zone: GLB theo mức đồ hoạ, chất liệu toon, gom đối tượng game theo tên (REPORT.md mục 8):
// SPAWN_/NPC_ (empty, yaw_deg), INT_ (vật tương tác, label), TRIGGER_ (hộp [-1,1] × scale), COL_ (va chạm, ẩn).
import * as THREE from "three";
import { loadGLTF, url } from "../core/assets.js";
import { makeZoneMaterial } from "../render/renderer.js";
import { buildCollider } from "./collision.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const _inv = new THREE.Matrix4();

// tải trước file GLB của zone vào bộ nhớ đệm HTTP (không giải nén): lúc điền tên, hoặc zone kế tiếp khi đang chơi
const prefetched = new Map();
export function prefetchZone(file, tier) {
  const u = url(`assets/glb/${tier}/${file}.glb`);
  if (!prefetched.has(u)) prefetched.set(u, fetch(u).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  return prefetched.get(u);
}
// file đang được tải trước (nếu có) — chờ xong rồi mới tải thật, khỏi tải 2 lần cùng lúc
export function pendingPrefetch(file, tier) { return prefetched.get(url(`assets/glb/${tier}/${file}.glb`)) ?? null; }
const _p = new THREE.Vector3();

// Bản sao dùng chung lưới (cây, bụi tre — Blender đặt custom property "batch" = tên nhóm trên từng bản sao, GLB giữ 1
// lưới cho mọi bản sao): gộp mọi bản sao cùng nhóm thành 1 mesh mỗi chất liệu → vài lượt vẽ thay vì 2–3 lượt mỗi cây.
// Mỗi bản sao mang số riêng (thuộc tính đỉnh plantId, từ 1) → render/seethrough.js vẫn làm mờ từng cây. Mesh gộp tên
// "<nhóm>_<chất liệu>" (vd ENV_cay_lo_M_tree_leaf) — vẫn khớp see_through.meshes. Không đổi hình, chỉ đổi cách vẽ.
const _m = new THREE.Matrix4();
export function batchInstances(root) {
  const nodes = [];
  root.traverse((o) => { if (o.userData.batch) nodes.push(o); });
  if (!nodes.length) return 0;
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), groups = new Map(), counts = new Map();
  for (const node of nodes) {
    const key = node.userData.batch, id = (counts.get(key) || 0) + 1;
    counts.set(key, id);
    node.traverse((m) => {
      if (!m.isMesh) return;
      const k = `${key}|${m.material.uuid}`;
      if (!groups.has(k)) groups.set(k, { key, name: `${key}_${m.material.name}`, material: m.material, geos: [] });
      const g = m.geometry.clone().applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld));
      g.setAttribute("plantId", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(id), 1));
      groups.get(k).geos.push(g);
    });
  }
  const merged = [...groups.values()].map((g) => ({ ...g, geo: mergeGeometries(g.geos, false) }));
  for (const g of groups.values()) for (const x of g.geos) x.dispose();
  const bad = merged.filter((g) => !g.geo);
  if (bad.length) {   // lưới các bản sao khác thuộc tính (không gộp được) → giữ nguyên từng bản sao, báo ra console
    console.warn(`[zone] không gộp được ${bad.map((g) => g.name).join(", ")} — vẽ từng bản sao`);
    for (const g of merged) g.geo?.dispose();
    return 0;
  }
  const shared = new Set();
  for (const node of nodes) { node.traverse((m) => { if (m.isMesh) shared.add(m.geometry); }); node.removeFromParent(); }
  for (const g of shared) g.dispose();
  for (const { key, name, material, geo } of merged) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.userData.batchGroup = key;      // seethrough: plantId của cùng nhóm ở các mesh gộp (thân, lá) là cùng 1 cây
    root.add(mesh);
  }
  root.updateMatrixWorld(true);
  return nodes.length;
}

// overrides (data/collision.json → <zone>): { remove: [tên COL_], add: [hộp] } — chỉnh va chạm bằng code, không sửa GLB
export async function loadZone(id, file, tier, overrides = {}) {
  const gltf = await loadGLTF(url(`assets/glb/${tier}/${file}.glb`));
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const batched = batchInstances(root);
  const zone = { id, file, tier, root, nodes: new Map(), spawns: new Map(), npcs: [], ints: new Map(), triggers: [], colMeshes: [], hasLightmap: false, batched };
  root.traverse((o) => {
    if (o.name) zone.nodes.set(o.name, o);
    if (o.name.startsWith("COL_")) { if (o.isMesh) zone.colMeshes.push(o); o.visible = false; return; }
    if (o.name.startsWith("SPAWN_")) zone.spawns.set(o.name, o);
    else if (o.name.startsWith("NPC_")) zone.npcs.push(o);
    else if (o.name.startsWith("INT_")) zone.ints.set(o.name, o);
    else if (o.name.startsWith("TRIGGER_")) zone.triggers.push({ name: o.name, node: o, inside: false, inv: _inv.clone().copy(o.matrixWorld).invert() });
  });
  // COL_ có thể là con của object khác → gom cả mesh con
  for (const c of [...zone.colMeshes]) c.traverse((m) => { if (m.isMesh && !zone.colMeshes.includes(m)) zone.colMeshes.push(m); });
  const removed = new Set(overrides.remove || []);
  zone.colRemoved = zone.colMeshes.filter((m) => removed.has(m.name)).map((m) => m.name);
  zone.colMeshes = zone.colMeshes.filter((m) => !removed.has(m.name));
  zone.colAdded = (overrides.add || []).map((b) => b.name);
  zone.collider = buildCollider(zone.colMeshes, overrides.add || []);
  zone.applyMaterials = () => {
    let lm = false;
    root.traverse((o) => {
      if (!o.isMesh || o.name.startsWith("COL_") || !o.visible) return;
      o.userData.srcMaterial ??= o.material;
      const { material, hasLightmap } = makeZoneMaterial(o.userData.srcMaterial, { lightmap: tier === "high" });
      o.material = material;
      lm ||= hasLightmap;
    });
    zone.hasLightmap = lm;
  };
  zone.applyMaterials();
  return zone;
}

// Chỉnh bối cảnh khi chạy (data/scene_fixes.json → <zone>), không sửa GLB. Trả thông tin để báo cáo/kiểm tra.
export function applySceneFixes(zone, fixes = {}) {
  const out = {};
  const c = fixes.chairs;
  if (c) {
    const re = new RegExp(c.nodes);
    const done = new Set();
    let verts = 0, minY = Infinity, meshes = 0;
    zone.root.traverse((o) => {
      if (!re.test(o.name)) return;
      o.traverse((m) => {
        if (!m.isMesh || done.has(m.geometry.uuid)) return;
        done.add(m.geometry.uuid);                // mesh dùng chung (instance) → chỉ sửa 1 lần
        meshes++;
        const pos = m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          if (pos.getZ(i) <= c.local_z_min) continue;           // không phải phần ghế
          const y = pos.getY(i);
          if (c.mode === "seat" && y < c.seat_from_m) continue; // giữ đế + chân trụ
          pos.setY(i, y - c.drop_m);
          minY = Math.min(minY, y - c.drop_m);
          verts++;
        }
        pos.needsUpdate = true;
        m.geometry.computeBoundingBox();
        m.geometry.computeBoundingSphere();
      });
    });
    out.chairs = { mode: c.mode, drop_m: c.drop_m, meshes, verts, lowest_m: +minY.toFixed(3) };
    zone.chairDrop = c.drop_m;
  }
  zone.fixes = out;
  return out;
}

// điểm có nằm trong hộp TRIGGER_ không
export function inTrigger(trigger, p) {
  _p.copy(p).applyMatrix4(trigger.inv);
  return Math.abs(_p.x) <= 1 && Math.abs(_p.y) <= 1 && Math.abs(_p.z) <= 1;
}

export function worldPos(node) { return node.getWorldPosition(new THREE.Vector3()); }

// yaw_deg (0 = nhìn -Z, tăng ngược chiều kim đồng hồ nhìn từ trên) → hướng nhìn
export function yawDir(yawDeg) {
  const a = THREE.MathUtils.degToRad(yawDeg);
  return new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
}

export function disposeZone(zone) {
  zone.root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    // chỉ dọn vật liệu / texture thật (bản sao do code tạo có thể mang userData đã chép qua JSON)
    for (const m of [o.material, o.userData.srcMaterial].flat()) {
      if (!m?.isMaterial) continue;
      if (m.map?.isTexture) m.map.dispose();
      if (m.aoMap?.isTexture) m.aoMap.dispose();
      m.dispose();
    }
  });
  zone.collider.geometry.dispose();
  zone.view?.geometry.dispose();
}
