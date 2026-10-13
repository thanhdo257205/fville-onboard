// Dò chỗ ngồi trong mô hình zone (chỉ dùng khi thử: __game.findSeats() — scripts/tools/find_seats.mjs gom mọi zone). Ghế nằm
// chung lưới với bàn / đồ khác (không có node riêng) → tìm theo hình: mặt nằm ngang cao minH … maxH trên sàn COL_ (ghế văn phòng
// 0,51 m, ghế đẩu 0,45 m, ghế nhựa ~0,4 m), cỡ một chỗ ngồi (ghế băng dài → chia mỗi 0,6 m), phía trên trống (không phải ngăn dưới
// bàn). Hướng ngồi: quay lưng về lưng ghế (tia ngang ngay trên mặt ghế chạm gần); không có lưng → nhìn về bàn gần nhất (mặt ngang
// cao 0,6–0,85 m), không có bàn → nhìn về phía thoáng nhất. reach: đứng được trước ghế (capsule không lồng COL_).
// Kết quả là ỨNG VIÊN để người xem lại rồi chép vào data/seats.json (game chỉ đọc file đó, không tự dò lúc chơi).
import * as THREE from "three";
import { buildCollider, penetration } from "./collision.js";

const SEAT_STEP = 0.6;     // ghế băng: mỗi chỗ ngồi rộng chừng này (m)

// region: [x0, z0, x1, z1] → trả thêm mặt ngang / nhóm thô trong vùng đó (dò vì sao một ghế không ra)
export function findSeats(zone, { minH = 0.33, maxH = 0.62, skip = null, region = null } = {}) {
  zone.root.updateMatrixWorld(true);
  const meshes = [];
  zone.root.traverse((o) => {
    if (!o.isMesh || !o.visible || o.name.startsWith("COL_") || o.isInstancedMesh) return;   // mesh gộp bản sao (batch, vd bàn phòng phụ) vẫn xét; cây: skip
    if (skip && (skip.test(o.name) || skip.test(o.parent?.name || ""))) return;
    meshes.push(o);
  });
  const view = buildCollider(meshes).geometry.boundsTree, col = zone.collider.geometry.boundsTree;
  const ray = new THREE.Ray(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), ctr = new THREE.Vector3();
  // sàn dưới một điểm (COL_): mặt ngang đầu tiên phía dưới
  const floorAt = (p) => {
    ray.set(new THREE.Vector3(p.x, p.y - 0.01, p.z), down);
    for (const h of col.raycast(ray, THREE.DoubleSide, 0, 3).sort((x, y) => x.distance - y.distance)) if (Math.abs(h.face.normal.y) > 0.7) return h.point.y;
    return null;
  };
  // 1) mặt nằm ngang nhỏ (< 4 m²) → độ cao trên sàn
  const flats = [];
  for (const m of meshes) {
    const pos = m.geometry.attributes.position, idx = m.geometry.index, cnt = idx ? idx.count : pos.count;
    for (let i = 0; i < cnt; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);
      n.subVectors(b, a).cross(c.clone().sub(a));
      const area = n.length() / 2;
      if (area < 1e-4 || area > 4) continue;
      n.normalize();
      if (Math.abs(n.y) < 0.96) continue;
      ctr.copy(a).add(b).add(c).divideScalar(3);
      const fy = floorAt(ctr);
      if (fy == null) continue;
      const h = ctr.y - fy;
      if (h < minH - 0.02 || h > 0.9) continue;
      flats.push({ x: ctr.x, y: ctr.y, z: ctr.z, fy, h, area, mesh: m.name || m.parent?.name || "",
        minX: Math.min(a.x, b.x, c.x), maxX: Math.max(a.x, b.x, c.x), minZ: Math.min(a.z, b.z, c.z), maxZ: Math.max(a.z, b.z, c.z) });
    }
  }
  const tables = flats.filter((f) => f.h >= 0.6 && f.h <= 0.85);
  // 2) gộp tam giác cùng độ cao, sát nhau thành mặt (mặt ghế, mặt ghế băng)
  const groups = [];
  for (const f of flats.filter((f) => f.h >= minH && f.h <= maxH)) {
    const g = groups.find((g) => Math.abs(g.y - f.y) < 0.03 && f.minX <= g.maxX + 0.05 && f.maxX >= g.minX - 0.05 && f.minZ <= g.maxZ + 0.05 && f.maxZ >= g.minZ - 0.05);
    if (!g) { groups.push({ ...f, sx: f.x * f.area, sz: f.z * f.area, meshes: new Set([f.mesh]) }); continue; }
    g.minX = Math.min(g.minX, f.minX); g.maxX = Math.max(g.maxX, f.maxX); g.minZ = Math.min(g.minZ, f.minZ); g.maxZ = Math.max(g.maxZ, f.maxZ);
    g.sx += f.x * f.area; g.sz += f.z * f.area; g.area += f.area; g.meshes.add(f.mesh);
  }
  if (region) {
    const inR = (f) => f.x >= region[0] && f.x <= region[2] && f.z >= region[1] && f.z <= region[3];
    return { flats: flats.filter(inR).map((f) => ({ ...f, y: +f.y.toFixed(3), h: +f.h.toFixed(3) })), groups: groups.filter(inR).map((g) => ({ ...g, meshes: [...g.meshes] })) };
  }
  const free = (p) => penetration(zone.collider, p, 0.3, 1.7) < 0.02;
  const out = [];
  for (const g of groups) {
    const w = g.maxX - g.minX, d = g.maxZ - g.minZ, long = Math.max(w, d), short = Math.min(w, d);
    if (g.area < 0.08 || short < 0.25 || short > 1.0 || long > 8) continue;
    const k = long > 0.9 ? Math.floor(long / SEAT_STEP) : 1;
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? 0.5 : (i + 0.5) / k;
      const x = k === 1 ? g.sx / g.area : w >= d ? g.minX + w * t : (g.minX + g.maxX) / 2;
      const z = k === 1 ? g.sz / g.area : w >= d ? (g.minZ + g.maxZ) / 2 : g.minZ + d * t;
      const top = new THREE.Vector3(x, g.y, z);
      // phía trên trống trong 0,25 m (ngăn kệ, khe dưới mặt bàn… không phải chỗ ngồi; ghế kê sát dưới mép bàn như ghế tulip
      // thì mặt bàn cách mặt ghế ~0,3 m — vẫn tính). Chỉ mặt nằm ngang: lưng ghế cong vươn qua mặt ghế không tính
      ray.set(top.clone().add(new THREE.Vector3(0, 0.02, 0)), up);
      if (view.raycast(ray, THREE.DoubleSide, 0, 0.25).some((h) => Math.abs(h.face.normal.y) > 0.7)) continue;
      // lưng ghế: tia ngang ngay trên mặt ghế, 16 hướng (ghế băng dài: 2 hướng vuông góc chiều dài), chạm trong 0,4 m
      const across = long > 0.9 ? (w >= d ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]).map(([dx, dz]) => new THREE.Vector3(dx, 0, dz)) : null;
      const round = [...Array(16)].map((_, j) => new THREE.Vector3(Math.sin((j / 16) * Math.PI * 2), 0, Math.cos((j / 16) * Math.PI * 2)));
      let back = null;
      for (const dir of across || round) {
        ray.set(top.clone().add(new THREE.Vector3(0, 0.3, 0)), dir);
        const hit = view.raycastFirst(ray, THREE.DoubleSide, 0, 0.4);
        if (hit && (!back || hit.distance < back.d)) back = { d: hit.distance, dir };
      }
      let face, why;
      if (back) { face = back.dir.clone().negate(); why = "back"; }
      else {
        const tb = tables.reduce((best, f) => { const dd = Math.hypot(f.x - x, f.z - z); return dd > 0.25 && dd < 1.2 && Math.abs(f.fy - g.fy) < 0.1 && (!best || dd < best.dd) ? { f, dd } : best; }, null);
        if (tb) { face = new THREE.Vector3(tb.f.x - x, 0, tb.f.z - z).normalize(); why = "table"; }
        else {
          // ghế băng không lưng: chỉ 2 hướng vuông góc với chiều dài ghế
          let bestD = -1;
          for (const dir of across || round) {
            ray.set(top.clone().add(new THREE.Vector3(0, 0.6, 0)), dir);
            const hit = view.raycastFirst(ray, THREE.DoubleSide, 0, 6);
            const dd = hit ? hit.distance : 6;
            if (dd > bestD) { bestD = dd; face = dir; }
          }
          why = "open";
        }
      }
      // chỗ đứng gần nhất quanh ghế (capsule không lồng COL_, cùng mặt sàn) → khoảng cách (m); không có trong 1,2 m → null
      let reach = null;
      for (let r = 0.4; r <= 1.2001 && reach == null; r += 0.1) for (let j = 0; j < 16; j++) {
        const ang = (j / 16) * Math.PI * 2, p = new THREE.Vector3(x + Math.sin(ang) * r, g.fy + 0.6, z + Math.cos(ang) * r);
        const fy = floorAt(p);
        if (fy == null || Math.abs(fy - g.fy) > 0.1) continue;
        if (free(p.setY(fy + 0.02))) { reach = +r.toFixed(1); break; }
      }
      const yaw = THREE.MathUtils.radToDeg(Math.atan2(-face.x, -face.z));
      out.push({ at: [+x.toFixed(3), +g.fy.toFixed(3), +z.toFixed(3)], h: +g.h.toFixed(3), yaw_deg: Math.round(((yaw % 360) + 360) % 360),
        size: [+w.toFixed(2), +d.toFixed(2)], area: +g.area.toFixed(2), facing: why, reach, meshes: [...g.meshes] });
    }
  }
  return out;
}
