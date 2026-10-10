// Dò chỗ hở của mô hình bối cảnh (chỉ dùng khi thử: __game.gaps()) — không cần Blender. Từ các chỗ đứng được TRONG NHÀ
// (sàn COL_ + có trần phía trên) bắn tia ngang và chéo xuống ở tầm mắt: tia trong nhà mà không chạm lưới đục nào (đi xuyên
// kính) = lọt ra trời → người chơi thấy dải trời qua khe (sàn không áp tường, góc tường thiếu, mặt đất ngoài kính không đủ
// rộng). Tia chéo xuống lọt ra luôn là lỗi (đứng nhìn xuống thì phải thấy sàn / đất); tia ngang lọt ra mà không qua kính =
// khe / ô mở không kính (có thể là cửa ra ngoài — xem toạ độ). Kết quả gộp theo ô 0,5 m nơi tia rời lưới.
import * as THREE from "three";
import { buildCollider } from "./collision.js";

const GLASS = /glass|kinh/i;

function isGlass(m) {
  const mats = [m.userData.srcMaterial ?? m.material].flat();
  return mats.some((x) => x && (GLASS.test(x.name || "") || x.transparent && x.opacity < 0.9));
}

// zone: zone đang chơi (game.zone), from: các điểm xuất phát (người chơi, SPAWN_, NPC_, INT_ — chỉ xét chỗ đi tới được từ
// đó; cửa đóng có COL_ chặn đường lan nên cần điểm ở cả hai phía). opts: step (m giữa 2 điểm đứng), eye (m trên sàn), dirs (số hướng), pitches (độ, âm =
// nhìn xuống), far (m), skip (RegExp tên mesh bỏ qua, vd cây)
export function findGaps(zone, from, { step = 1, eye = 1.6, dirs = 24, pitches = [0, -8, -20, -40], far = 60, skip = null } = {}) {
  const opaque = [], glass = [];
  zone.root.updateMatrixWorld(true);
  zone.root.traverse((o) => {
    if (!o.isMesh || !o.visible || o.name.startsWith("COL_") || o.userData.batchGroup) return;
    if (skip && (skip.test(o.name) || skip.test(o.parent?.name || ""))) return;
    (isGlass(o) ? glass : opaque).push(o);
  });
  const view = buildCollider(opaque), glassBvh = glass.length ? buildCollider(glass) : null;
  const col = zone.collider.geometry.boundsTree, bt = view.geometry.boundsTree, gt = glassBvh?.geometry.boundsTree;
  const box = new THREE.Box3().setFromBufferAttribute(zone.collider.geometry.attributes.position);
  const ray = new THREE.Ray(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
  const cells = new Map(), all = [], grid = new Map();
  let rays = 0;
  // 1) mọi chỗ đứng được trong nhà theo lưới `step`
  for (let i = 0, x = box.min.x + step / 2; x < box.max.x; i++, x += step) {
    for (let k = 0, z = box.min.z + step / 2; z < box.max.z; k++, z += step) {
      ray.set(new THREE.Vector3(x, box.max.y + 1, z), down);
      for (const h of col.raycast(ray, THREE.DoubleSide, 0, box.max.y - box.min.y + 2)) {
        if (Math.abs(h.face.normal.y) < 0.7) continue;
        const fy = h.point.y;
        // đứng được: không vướng COL_ từ chân tới quá đầu; trong nhà: có lưới phía trên trong 8 m
        ray.set(new THREE.Vector3(x, fy + 0.05, z), up);
        if (col.raycastFirst(ray, THREE.DoubleSide, 0, eye + 0.2)) continue;
        if (!bt.raycastFirst(ray, THREE.DoubleSide, 0, 8)) continue;
        const s = { i, k, x, z, fy, seen: false };
        all.push(s);
        grid.set(`${i},${k}`, [...(grid.get(`${i},${k}`) || []), s]);
      }
    }
  }
  // 2) chỉ giữ chỗ đi tới được từ người chơi: lan sang ô kề (chênh độ cao ≤ 0,7 m — bậc thang; giữa 2 ô không vướng COL_)
  const near = (f) => all.reduce((b, s) => { const d = (s.x - f.x) ** 2 + (s.z - f.z) ** 2 + 4 * (s.fy - f.y) ** 2; return !b || d < b.d ? { s, d } : b; }, null);
  const queue = [];
  for (const f of from) { const n = near(f); if (n && n.d < 4 && !n.s.seen) { n.s.seen = true; queue.push(n.s); } }
  while (queue.length) {
    const s = queue.shift();
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const n of grid.get(`${s.i + di},${s.k + dk}`) || []) {
        if (n.seen || Math.abs(n.fy - s.fy) > 0.7) continue;
        const a = new THREE.Vector3(s.x, Math.max(s.fy, n.fy) + 0.5, s.z), d = new THREE.Vector3(n.x - s.x, 0, n.z - s.z);
        ray.set(a, d.clone().normalize());
        if (col.raycastFirst(ray, THREE.DoubleSide, 0, d.length())) continue;
        n.seen = true;
        queue.push(n);
      }
    }
  }
  const spots = all.filter((s) => s.seen);
  // 3) tia từ tầm mắt ở mỗi chỗ đứng
  for (const s of spots) {
    const o = new THREE.Vector3(s.x, s.fy + eye, s.z);
    for (let i = 0; i < dirs; i++) {
      const a = (i / dirs) * Math.PI * 2;
      for (const p of pitches) {
        const r = THREE.MathUtils.degToRad(p);
        const d = new THREE.Vector3(Math.cos(a) * Math.cos(r), Math.sin(r), Math.sin(a) * Math.cos(r));
        ray.set(o, d);
        rays++;
        if (bt.raycastFirst(ray, THREE.DoubleSide, 0, far)) continue;
        const g = gt?.raycastFirst(ray, THREE.DoubleSide, 0, far);
        if (p >= 0 && g) continue;            // nhìn ngang ra ngoài qua kính: thấy trời là đúng
        // chỗ hở: tia chéo xuống → chỗ tia cắt mức sàn đang đứng (sàn lẽ ra phải có ở đó); tia ngang → điểm đầu tiên trên
        // tia mà phía trên không còn lưới (vừa ra khỏi toà nhà qua khe tường)
        let t = p < 0 ? eye / -Math.sin(r) : 0.5;
        if (p >= 0) for (; t < far; t += 0.25) {
          ray.set(o.clone().addScaledVector(d, t), up);
          if (!bt.raycastFirst(ray, THREE.DoubleSide, 0, 30)) break;
        }
        const at = o.clone().addScaledVector(d, Math.min(t, far));
        const key = `${Math.round(at.x)},${Math.round(at.y)},${Math.round(at.z)},${p < 0 ? "down" : "flat"}`;
        const c = cells.get(key) ?? { at: [+at.x.toFixed(1), +at.y.toFixed(1), +at.z.toFixed(1)], kind: p < 0 ? "down" : "flat", glass: !!g, rays: 0, from: [+o.x.toFixed(1), +o.y.toFixed(1), +o.z.toFixed(1)] };
        c.rays++;
        cells.set(key, c);
      }
    }
  }
  view.geometry.dispose();
  glassBvh?.geometry.dispose();
  const gaps = [...cells.values()].sort((a, b) => b.rays - a.rays);
  return { spots: spots.length, unreachable: all.length - spots.length, rays, leaks: gaps.reduce((n, g) => n + g.rays, 0), gaps };
}
