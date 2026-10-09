// Va chạm bằng three-mesh-bvh: gộp mọi hộp COL_ (kể cả mặt dốc cầu thang/bậc thềm) thành 1 lưới có BVH,
// nhân vật là capsule (theo ví dụ characterMovement của three-mesh-bvh). Không tự viết vật lý.
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// meshes: các mesh COL_; boxes: hộp thêm bằng code [{center:[x,y,z], size:[sx,sy,sz]}] (data/collision.json)
export function buildCollider(meshes, boxes = []) {
  const extra = boxes.map((b) => new THREE.BoxGeometry(...b.size).translate(...b.center).toNonIndexed());
  const geos = meshes.map((m) => {
    m.updateWorldMatrix(true, false);
    let g = m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
    g = g.index ? g.toNonIndexed() : g;
    g.applyMatrix4(m.matrixWorld);
    return g;
  });
  for (const g of extra) { for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k); geos.push(g); }
  const merged = mergeGeometries(geos, false);
  merged.boundsTree = new MeshBVH(merged);
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ wireframe: true, color: 0xff00ff }));
  mesh.visible = false;
  mesh.name = "collider";
  return mesh;
}

const _box = new THREE.Box3();
const _seg = new THREE.Line3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _ray = new THREE.Ray();

// Capsule đứng thẳng: position = điểm giữa hai bàn chân.
export class CapsuleBody {
  constructor({ radius = 0.3, height = 1.75, gravity = -24, substeps = 5 } = {}) {
    this.radius = radius;
    this.height = height;
    this.gravity = gravity;
    this.substeps = substeps;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.lastPush = 0;          // độ đẩy ngang lớn nhất ở bước vừa rồi (để phát hiện bị kẹt)
  }
  teleport(p) { this.position.copy(p); this.velocity.set(0, 0, 0); this.onGround = false; }

  // move: vận tốc ngang mong muốn (m/s, Vector3 với y bỏ qua)
  // obstacles: capsule đứng của nhân vật khác [{x, z, y, height, radius}] (NPC, Tú, người chơi) → không đi xuyên qua
  step(dt, move, collider, obstacles = null) {
    const h = dt / this.substeps;
    for (let i = 0; i < this.substeps; i++) this._sub(h, move, collider, obstacles);
  }

  _sub(dt, move, collider, obstacles) {
    const bvh = collider.geometry.boundsTree;
    if (this.onGround) this.velocity.y = dt * this.gravity;
    else this.velocity.y += dt * this.gravity;
    this.position.x += move.x * dt;
    this.position.z += move.z * dt;
    this.position.y += this.velocity.y * dt;
    // đẩy ra khỏi capsule nhân vật khác (theo phương ngang, trượt quanh) trước; tường COL_ xử lý sau nên luôn thắng
    if (obstacles) for (const o of obstacles) pushOutCapsule(this.position, this.radius, this.height, o, move);

    const r = this.radius;
    _seg.start.set(this.position.x, this.position.y + r, this.position.z);
    _seg.end.set(this.position.x, this.position.y + this.height - r, this.position.z);
    _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end);
    _box.min.addScalar(-r); _box.max.addScalar(r);

    const start = _seg.start.clone();
    bvh.shapecast({
      intersectsBounds: (b) => b.intersectsBox(_box),
      intersectsTriangle: (tri) => {
        const d = tri.closestPointToSegment(_seg, _p1, _p2);
        if (d < r) {
          const depth = r - d;
          const dir = _p2.sub(_p1).normalize();
          _seg.start.addScaledVector(dir, depth);
          _seg.end.addScaledVector(dir, depth);
        }
      },
    });
    _delta.subVectors(_seg.start, start);
    this.lastPush = Math.max(this.lastPush, Math.hypot(_delta.x, _delta.z));
    // bị đẩy chủ yếu theo phương thẳng đứng → đang đứng trên mặt đất/dốc
    this.onGround = _delta.y > Math.abs(dt * this.velocity.y * 0.25);
    const off = Math.max(0, _delta.length() - 1e-5);
    _delta.normalize().multiplyScalar(off);
    this.position.add(_delta);
    if (!this.onGround) {
      _delta.normalize();
      this.velocity.addScaledVector(_delta, -_delta.dot(this.velocity));
    } else {
      this.velocity.set(0, 0, 0);
    }
  }
}

// 2 capsule đứng chồng lên nhau (cao độ giao nhau, khoảng cách ngang < tổng bán kính) → đẩy p ra theo phương ngang
export function pushOutCapsule(p, radius, height, o, move = null) {
  if (p.y > o.y + o.height || o.y > p.y + height) return false;
  const min = radius + o.radius;
  const dx = p.x - o.x, dz = p.z - o.z;
  const d = Math.hypot(dx, dz);
  if (d >= min) return false;
  let nx = 1, nz = 0;
  if (d > 1e-4) { nx = dx / d; nz = dz / d; }
  else if (move && Math.hypot(move.x, move.z) > 1e-4) { const m = Math.hypot(move.x, move.z); nx = -move.x / m; nz = -move.z / m; }   // trùng tâm: lùi ngược hướng đi
  p.x += nx * (min - d); p.z += nz * (min - d);
  return true;
}

// Camera không xuyên tường: tia từ điểm nhìn tới camera, gặp COL_ thì kéo camera vào trước chỗ chạm.
export function clampCamera(collider, from, to, pad = 0.25) {
  const dir = _p1.subVectors(to, from);
  const dist = dir.length();
  if (dist < 1e-4) return dist;
  _ray.set(from, dir.divideScalar(dist));
  const hit = collider.geometry.boundsTree.raycastFirst(_ray, THREE.DoubleSide, 0, dist);
  return hit ? Math.max(0.5, hit.distance - pad) : dist;
}

// Có vật cản giữa 2 điểm (dùng để ẩn bảng tên bị tường che)
export function blocked(collider, from, to) {
  const dir = _p2.subVectors(to, from);
  const dist = dir.length();
  _ray.set(from, dir.divideScalar(dist));
  return !!collider.geometry.boundsTree.raycastFirst(_ray, THREE.DoubleSide, 0, dist - 0.3);
}

// Capsule có đang lồng vào COL_ không (kiểm tra lỗi va chạm)
export function penetration(collider, pos, radius = 0.3, height = 1.75) {
  _seg.start.set(pos.x, pos.y + radius, pos.z);
  _seg.end.set(pos.x, pos.y + height - radius, pos.z);
  _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end);
  _box.min.addScalar(-radius); _box.max.addScalar(radius);
  let worst = 0;
  collider.geometry.boundsTree.shapecast({
    intersectsBounds: (b) => b.intersectsBox(_box),
    intersectsTriangle: (tri) => { const d = tri.closestPointToSegment(_seg, _p1, _p2); if (d < radius) worst = Math.max(worst, radius - d); },
  });
  return worst;
}
