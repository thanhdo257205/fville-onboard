// Tải 1 zone: GLB theo mức đồ hoạ, chất liệu toon, gom đối tượng game theo tên (REPORT.md mục 8):
// SPAWN_/NPC_ (empty, yaw_deg), INT_ (vật tương tác, label), TRIGGER_ (hộp [-1,1] × scale), COL_ (va chạm, ẩn).
import * as THREE from "three";
import { loadGLTF, url } from "../core/assets.js";
import { makeZoneMaterial, makeCharacterMaterial } from "../render/renderer.js";
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

// mesh va chạm chỉ gồm các mặt nằm ngang (|pháp tuyến.y| > 0,7) của mesh hiển thị m, toạ độ thế giới (không gắn vào cảnh)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
function floorMesh(m) {
  m.updateWorldMatrix(true, false);
  const pos = m.geometry.attributes.position, idx = m.geometry.index, cnt = idx ? idx.count : pos.count, out = [];
  for (let i = 0; i < cnt; i += 3) {
    const v = [0, 1, 2].map((k) => (idx ? idx.getX(i + k) : i + k));
    _a.fromBufferAttribute(pos, v[0]).applyMatrix4(m.matrixWorld);
    _b.fromBufferAttribute(pos, v[1]).applyMatrix4(m.matrixWorld);
    _c.fromBufferAttribute(pos, v[2]).applyMatrix4(m.matrixWorld);
    _n.subVectors(_b, _a).cross(_c.clone().sub(_a));
    if (_n.lengthSq() < 1e-12 || Math.abs(_n.normalize().y) <= 0.7) continue;
    out.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  const mesh = new THREE.Mesh(g);
  mesh.name = `COL_floor_${m.name}`;
  mesh.updateMatrixWorld(true);
  return mesh;
}

// overrides (data/collision.json → <zone>): { remove: [tên COL_], add: [hộp], floors: [regex mesh hiển thị làm sàn] } — chỉnh va chạm bằng code, không sửa GLB
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
  // sàn hiển thị cao hơn sàn COL_ (vd sân lát gạch zone_02 cao 8 cm trên COL_ground → chân lún vào gạch, camera hạ thấp chui
  // xuống dưới lớp gạch thấy cỏ): overrides.floors = [regex tên mesh] → mặt nằm ngang của các mesh đó thành sàn va chạm
  zone.colFloors = [];
  if (overrides.floors?.length) {
    const re = new RegExp(overrides.floors.join("|"));
    root.traverse((o) => { if (o.isMesh && re.test(o.name) && !o.name.startsWith("COL_")) zone.colFloors.push(floorMesh(o)); });
    zone.colMeshes.push(...zone.colFloors);
  }
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
  // phòng giả sau cửa / lối sang zone khác (rooms): zone kia nằm ở file GLB khác → nhìn qua cửa kính / lối mở chỉ thấy phông
  // nền ngoài trời. Mỗi phòng = 1 hộp chỉ vẽ mặt trong (BackSide): đứng ngoài nhìn qua cửa thấy sàn, tường, trần như một khoảng
  // phòng; mặt hướng về cửa tự ẩn. Màu sàn / trần / tường theo zone bên kia; không va chạm, không viền nét, dọn cùng zone.root
  if (fixes.rooms?.length) {
    out.rooms = fixes.rooms.map((r, i) => {
      const geo = new THREE.BoxGeometry(...r.size);
      const col = (k) => new THREE.Color(r[k] ?? r.wall);
      // thứ tự mặt của BoxGeometry: +x, −x, +y (trần), −y (sàn), +z, −z — mỗi mặt 4 đỉnh
      const faces = ["wall", "wall", "ceiling", "floor", "wall", "wall"].map(col);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let v = 0; v < geo.attributes.position.count; v++) faces[Math.floor(v / 4)].toArray(colors, v * 3);
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const { material } = makeZoneMaterial({ color: new THREE.Color(1, 1, 1), side: THREE.BackSide, opacity: 1, transparent: false,
        emissive: new THREE.Color(0, 0, 0), emissiveIntensity: 1, userData: { outline: false } });
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `FIX_room_${r.id ?? i}`;
      mesh.position.set(...r.center);
      // tấm sàn rộng hơn hộp `pad_m` mỗi phía, thấp hơn đáy hộp 1 mm: sàn zone thường dừng trước mặt cửa → khe ở ngưỡng nhìn
      // xuống thấy trời; nằm dưới sàn zone nên chỗ có sàn thì bị che, chỉ lấp khe
      const pad = r.pad_m ?? 0.6;
      if (pad > 0) {
        const pg = new THREE.PlaneGeometry(r.size[0] + 2 * pad, r.size[2] + 2 * pad).rotateX(-Math.PI / 2);
        const fc = col("floor"), pc = new Float32Array(pg.attributes.position.count * 3);
        for (let v = 0; v < pg.attributes.position.count; v++) fc.toArray(pc, v * 3);
        pg.setAttribute("color", new THREE.BufferAttribute(pc, 3));
        const { material: pm } = makeZoneMaterial({ color: new THREE.Color(1, 1, 1), side: THREE.FrontSide, opacity: 1, transparent: false,
          emissive: new THREE.Color(0, 0, 0), emissiveIntensity: 1, userData: { outline: false } });
        const plate = new THREE.Mesh(pg, pm);
        plate.name = `${mesh.name}_san`;
        plate.position.y = -r.size[1] / 2 - 0.001;
        mesh.add(plate);
      }
      mesh.userData.fix = "room";
      zone.root.add(mesh);
      return mesh.name;
    });
  }
  // gỡ vật dựng chung mesh với đồ khác (remove_parts): mesh khớp `mesh` (tên node hoặc node cha — GLTFLoader tách mỗi chất liệu
  // thành 1 mesh con), bỏ mọi mảnh lưới rời (tam giác nối nhau qua đỉnh chung) có tâm hộp bao nằm trong một hộp `boxes` (toạ độ
  // glTF). Vd chậu cọ cũ (chậu + thân + từng lá là các mảnh riêng) nằm chung mesh nội thất → thay bằng mô hình mới (props)
  if (fixes.remove_parts?.length) out.remove_parts = fixes.remove_parts.map((r) => removeParts(zone, r));
  if (fixes.lower_parts?.length) out.lower_parts = fixes.lower_parts.map((r) => lowerParts(zone, r));
  zone.fixes = out;
  return out;
}

// hạ thấp vật dựng chung mesh với đồ khác (lower_parts, vd ghế tulip zone_05 cao 0,66 m → 0,48 m): đỉnh của mesh khớp `mesh` nằm
// trong một hộp { center, size } (toạ độ glTF), cao hơn from_y (và thấp hơn to_y nếu có — chừa mặt bàn ngay cạnh) được hạ xuống drop_m (chân đế dưới from_y giữ nguyên, trụ ngắn
// lại). Mesh dùng chung lưới (bản sao) chỉ sửa 1 lần.
function lowerParts(zone, r) {
  const re = new RegExp(r.mesh), boxes = r.boxes.map((b) => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...b.center), new THREE.Vector3(...b.size)));
  const v = new THREE.Vector3(), inv = new THREE.Matrix4(), done = new Set();
  let verts = 0;
  zone.root.updateMatrixWorld(true);
  zone.root.traverse((m) => {
    if (!m.isMesh || !(re.test(m.name) || re.test(m.parent?.name || "")) || done.has(m.geometry.uuid)) return;
    done.add(m.geometry.uuid);
    inv.copy(m.matrixWorld).invert();
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y <= r.from_y || v.y >= (r.to_y ?? Infinity) || !boxes.some((b) => b.containsPoint(v))) continue;
      v.y -= r.drop_m;
      v.applyMatrix4(inv);
      pos.setXYZ(i, v.x, v.y, v.z);
      verts++;
    }
    if (verts) { pos.needsUpdate = true; m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere(); }
  });
  return { mesh: r.mesh, drop_m: r.drop_m, verts };
}

function removeParts(zone, r) {
  const re = new RegExp(r.mesh), boxes = r.boxes.map((b) => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...b.center), new THREE.Vector3(...b.size)));
  const hits = boxes.map(() => 0), done = new Set();
  let tris = 0;
  zone.root.updateMatrixWorld(true);
  zone.root.traverse((m) => {
    if (!m.isMesh || !(re.test(m.name) || re.test(m.parent?.name || "")) || done.has(m.geometry.uuid) || !m.geometry.index) return;
    done.add(m.geometry.uuid);
    const g = m.geometry, idx = g.index.array, pos = g.attributes.position, nv = pos.count;
    // mảnh rời: hợp các đỉnh cùng tam giác + các đỉnh trùng vị trí (lưới bối cảnh tô phẳng: mỗi mặt có đỉnh riêng) — union-find
    const par = new Int32Array(nv).map((_, i) => i);
    const find = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
    for (let t = 0; t < idx.length; t += 3) { join(idx[t], idx[t + 1]); join(idx[t], idx[t + 2]); }
    const same = new Map();
    for (let i = 0; i < nv; i++) {
      const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
      if (same.has(k)) join(same.get(k), i); else same.set(k, i);
    }
    const bb = new Map(), v = new THREE.Vector3();
    for (let i = 0; i < nv; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const k = find(i);
      if (!bb.has(k)) bb.set(k, new THREE.Box3());
      bb.get(k).expandByPoint(v);
    }
    const drop = new Set(), c = new THREE.Vector3();
    for (const [k, box] of bb) {
      box.getCenter(c);
      const j = boxes.findIndex((b) => b.containsPoint(c));
      if (j >= 0) { drop.add(k); hits[j]++; }
    }
    if (!drop.size) return;
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) { if (drop.has(find(idx[t]))) tris++; else keep.push(idx[t], idx[t + 1], idx[t + 2]); }
    g.setIndex(keep);
    g.computeBoundingBox();
    g.computeBoundingSphere();
  });
  return { mesh: r.mesh, parts_per_box: hits, tris };
}

// vật đặt bằng dữ liệu từ GLB riêng (props): assets/props/<model>/<model>.glb (đã giảm tam giác, nén Draco), mỗi chỗ 1 bản sao
// dùng chung lưới + chất liệu (đổi sang toon 1 lần, giữ qua các zone: userData.shared). at = điểm đặt đáy (toạ độ glTF),
// height_m = chiều cao sau khi co, yaw_deg = xoay quanh trục đứng. Lá (alpha BLEND trong file gốc) → alphaTest, 2 mặt, không viền nét
const propModels = new Map();
async function propModel(id) {
  if (!propModels.has(id)) propModels.set(id, loadGLTF(url(`assets/props/${id}/${id}.glb`)).then((gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene), mats = new Map();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      if (!mats.has(src)) {
        const m = makeCharacterMaterial(src);
        if (src.transparent || src.alphaTest > 0) { m.alphaTest = 0.5; m.userData.outlineParameters = { visible: false }; }
        m.side = THREE.DoubleSide;
        m.userData.shared = true;
        if (m.map) m.map.userData.shared = true;
        src.dispose();
        mats.set(src, m);
      }
      o.material = mats.get(src);
      o.geometry.userData.shared = true;
    });
    return { scene: gltf.scene, height: box.max.y - box.min.y };
  }));
  return propModels.get(id);
}

export async function placeProps(zone, props = []) {
  const out = [];
  for (const [i, p] of props.entries()) {
    const m = await propModel(p.model);
    const o = m.scene.clone(true);
    o.name = `PROP_${p.model}_${i}`;
    o.position.set(...p.at);
    o.rotation.y = THREE.MathUtils.degToRad(p.yaw_deg ?? 0);
    o.scale.setScalar((p.height_m ?? m.height) / m.height);
    o.userData.fix = "prop";
    zone.root.add(o);
    out.push(o.name);
  }
  (zone.fixes ||= {}).props = out;
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

// giải phóng GPU của cả cây đối tượng: geometry (Mesh, cả Line / Points — vd đường ngắm bàn bi-a), vật liệu, mọi texture của
// vật liệu. Vật liệu / texture dùng chung giữa các zone (userData.shared, vd vật liệu vàng của hạt lúa, gradient toon) giữ lại.
// Trước đây chỉ dọn mesh của zone.root, chỉ map + aoMap; vật do code đặt (hạt lúa, hũ, ví, bảng tên…) không dọn → mỗi vòng
// qua các zone đọng thêm ~25 geometry, ~15 texture trên GPU
export function disposeTree(root) {
  root.traverse((o) => {
    if (!o.geometry?.userData.shared) o.geometry?.dispose?.();   // lưới dùng chung nhiều zone (vd chậu cây props) giữ lại
    // chỉ dọn vật liệu / texture thật (bản sao do code tạo có thể mang userData đã chép qua JSON)
    for (const m of [o.material, o.userData.srcMaterial].flat()) {
      if (!m?.isMaterial || m.userData.shared) continue;
      for (const v of Object.values(m)) if (v?.isTexture && !v.userData.shared) v.dispose();
      m.dispose();
    }
  });
}

export function disposeZone(zone) {
  disposeTree(zone.root);
  zone.collider.geometry.dispose();
  zone.view?.geometry.dispose();
  for (const f of zone.colFloors || []) f.geometry.dispose();
}
