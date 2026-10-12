import * as THREE from "three";

export function splitGrass(geometry, matrix, tileM = 4) {
  const pos = geometry.attributes.position, colors = geometry.attributes.color;
  if (!colors) return null;
  const index = geometry.index;
  const count = index?.count ?? pos.count;
  const kept = [], levels = new Map();
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((j) => index ? index.getX(i + j) : i + j);
    ids.forEach((id, j) => points[j].fromBufferAttribute(pos, id).applyMatrix4(matrix));
    const green = ids.every((id) => colors.getY(id) > colors.getX(id) * 1.15 && colors.getY(id) > colors.getZ(id) * 1.3);
    a.subVectors(points[1], points[0]); b.subVectors(points[2], points[0]); a.cross(b);
    const horizontal = a.lengthSq() > 0 && a.y / a.length() > 0.999;
    const low = points.every((p) => p.y >= -0.1 && p.y <= 0.3);
    if (!green || !horizontal || !low) { kept.push(...ids); continue; }
    const y = Math.round(points[0].y * 10000) / 10000;
    if (!levels.has(y)) levels.set(y, { points: [], area: 0 });
    const level = levels.get(y);
    level.area += Math.abs(a.y) / 2;
    level.points.push(...points.map((p) => p.clone()));
  }
  if (!levels.size) return null;
  let before = 0, after = 0, rectangles = 0;
  const vertices = [];
  for (const [y, level] of levels) {
    before += level.points.length / 3;
    const box = new THREE.Box3().setFromPoints(level.points);
    const area = (box.max.x - box.min.x) * (box.max.z - box.min.z);
    // Only a fully covered rectangle may lose its subdivisions. Discs and
    // disjoint/irregular patches retain their original triangles and holes.
    if (area > 0 && Math.abs(area - level.area) < Math.max(0.0001, area * 0.00001)) {
      const { min: l, max: h } = box;
      vertices.push(l.x,y,l.z, l.x,y,h.z, h.x,y,h.z, l.x,y,l.z, h.x,y,h.z, h.x,y,l.z);
      after += 2; rectangles++;
    } else {
      for (const p of level.points) vertices.push(p.x, p.y, p.z);
      after += level.points.length / 3;
    }
  }
  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  terrain.setAttribute("uv", new THREE.Float32BufferAttribute(vertices.flatMap((v, i) => i % 3 === 0 ? [v / tileM, vertices[i + 2] / tileM] : []), 2));
  terrain.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(vertices.length).fill(1), 3));
  terrain.computeVertexNormals();
  return { kept, terrain, before, after, rectangles };
}
