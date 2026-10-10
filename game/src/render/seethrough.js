// Cây cối không che người chơi: cây nằm giữa camera và người chơi — hoặc đang bọc lấy camera, quẹt sát ống kính — mờ dần
// bằng dither (bỏ điểm ảnh theo ma trận Bayer 4×4, vẫn là chất liệu đặc nên không lỗi thứ tự vẽ trong suốt), hết che thì
// hiện lại dần. Không sửa GLB: mesh cây gộp chung (ENV_vegetation, ENV_cay_*…) được chia thành từng cây lúc tải zone —
// đỉnh trùng vị trí nối thành mảnh (thân, cụm lá, chậu…), mảnh có hộp bao chạm nhau gộp thành 1 cây; mỗi đỉnh mang số cây
// (attribute seePlant, 0 = không bao giờ mờ). Viền nét (OutlineEffect) vẽ bằng chất liệu riêng → vá cùng đoạn shader,
// không thì vỏ viền đen lộ ra chỗ lá đã mờ.
// Cấu hình: data/scene_fixes.json → see_through (chung mọi zone) + <zone>.see_through.add (mesh gộp lẫn đồ khác, vd nội
// thất sảnh zone_03: chỉ lấy các mảnh có tâm nằm trong hộp).
// Cây mô hình dùng chung lưới (world/zone.js batchInstances: mesh gộp có thuộc tính đỉnh plantId): mỗi plantId = đúng 1
// cây, không chia mảnh, không gộp với cây có tán chạm nhau; lá là mảng phẳng (không kín) → "camera trong tán" xét bằng
// hộp tán (phần trên CANOPY_FROM chiều cao, thu vào CANOPY_SHRINK mỗi bên) thay cho đếm số lần cắt mặt.
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

const SLOTS = 8;   // số cây mờ cùng lúc tối đa (mảng uniform)
const CANOPY_FROM = 0.35, CANOPY_SHRINK = 0.15;

const DEFAULTS = {
  meshes: "^ENV_(vegetation|cay_)",
  fade_s: 0.3, hold_s: 0.4, max: 0.85, near_m: 0.8, min_height_m: 1.2,
  rays: [[0, 0.3], [0, 0.9], [0, 1.5], [-0.3, 1.15], [0.3, 1.15]],
};

// uniform dùng chung cho mọi chất liệu đã vá: cập nhật 1 lần mỗi khung
const uniforms = {
  seeIds: { value: new Float32Array(SLOTS).fill(-1) },
  seeVals: { value: new Float32Array(SLOTS) },
};

const FRAG = /* glsl */ `
uniform float seeIds[ ${SLOTS} ];
uniform float seeVals[ ${SLOTS} ];
varying float vSeePlant;
bool seeHidden() {
  if ( vSeePlant < 0.5 ) return false;
  float f = 0.0;
  for ( int i = 0; i < ${SLOTS}; i ++ ) if ( abs( seeIds[ i ] - vSeePlant ) < 0.5 ) f = seeVals[ i ];
  if ( f <= 0.0 ) return false;
  const float bayer[ 16 ] = float[ 16 ]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );
  ivec2 q = ivec2( mod( gl_FragCoord.xy, 4.0 ) );
  return f > ( bayer[ q.x + q.y * 4 ] + 0.5 ) / 16.0;
}
`;

// vá shader (chất liệu toon của bối cảnh và chất liệu viền của OutlineEffect đều có 2 chỗ chèn này)
function patchShader(shader) {
  shader.uniforms.seeIds = uniforms.seeIds;
  shader.uniforms.seeVals = uniforms.seeVals;
  shader.vertexShader = "attribute float seePlant;\nvarying float vSeePlant;\n"
    + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvSeePlant = seePlant;");
  shader.fragmentShader = FRAG
    + shader.fragmentShader.replace("#include <clipping_planes_fragment>", "if ( seeHidden() ) discard;\n\t#include <clipping_planes_fragment>");
}

function patchMaterial(m) {
  m.onBeforeCompile = patchShader;
  m.customProgramCacheKey = () => "seeThrough";
  m.userData.seeThrough = true;
}

// OutlineEffect gán tạm mesh.material = chất liệu viền (ShaderMaterial tạo trong OutlineEffect, không lấy ra được) rồi trả
// lại sau lượt vẽ viền → bắt lúc gán để vá chất liệu viền trước lần biên dịch đầu.
function hookOutline(mesh) {
  let current = mesh.material;
  Object.defineProperty(mesh, "material", {
    configurable: true, enumerable: true,
    get: () => current,
    set: (m) => {
      if (m && !m.userData.seeThrough && m.isShaderMaterial && m.uniforms?.outlineThickness) patchMaterial(m);
      current = m;
    },
  });
}

// Chia mesh thành mảnh liên thông: hàn đỉnh trùng vị trí (cạnh sắc tách đỉnh, khoá 1 mm) + union-find theo tam giác.
// → { compOf: Int32Array (đỉnh → số mảnh), boxes: Box3[] (toạ độ thế giới) }
function components(mesh) {
  const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index;
  const n = pos.count;
  const rep = new Int32Array(n), seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1000)}|${Math.round(pos.getY(i) * 1000)}|${Math.round(pos.getZ(i) * 1000)}`;
    let r = seen.get(k);
    if (r === undefined) { r = i; seen.set(k, i); }
    rep[i] = r;
  }
  const par = Int32Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const count = idx ? idx.count : n;
  for (let t = 0; t < count; t += 3) {
    const a = find(rep[idx ? idx.getX(t) : t]);
    const b = find(rep[idx ? idx.getX(t + 1) : t + 1]);
    par[b] = a;
    par[find(rep[idx ? idx.getX(t + 2) : t + 2])] = a;
  }
  const compOf = new Int32Array(n), slot = new Map(), boxes = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const root = find(rep[i]);
    let c = slot.get(root);
    if (c === undefined) { c = boxes.length; slot.set(root, c); boxes.push(new THREE.Box3()); }
    compOf[i] = c;
    boxes[c].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  }
  return { compOf, boxes };
}

// mesh gộp từ bản sao (thuộc tính plantId): mảnh = bản sao → { compOf, boxes } như components()
function instances(mesh) {
  const pos = mesh.geometry.attributes.position, pid = mesh.geometry.attributes.plantId;
  const compOf = new Int32Array(pos.count), slot = new Map(), boxes = [], pids = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const id = pid.getX(i);
    let c = slot.get(id);
    if (c === undefined) { c = boxes.length; slot.set(id, c); boxes.push(new THREE.Box3()); pids.push(id); }
    compOf[i] = c;
    boxes[c].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  }
  return { compOf, boxes, pids };
}

export class SeeThrough {
  constructor(cfg = {}) {
    this.cfg = { ...DEFAULTS, ...cfg };
    this.bvh = null;
    this.canopies = [];         // cây mô hình: { id, box } hộp tán (containing)
    this.fades = new Map();     // số cây → { f: 0..1, since: giây từ lần che gần nhất }
    this.hits = new Set();
    this._ray = new THREE.Ray();
    this._to = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._cp = {};
    this._upRay = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0.013, 1, 0.021).normalize());   // lệch nhẹ: không trượt cạnh
  }

  // zoneCfg: data/scene_fixes.json → <zone>.see_through ({ add: [{ mesh, boxes: [{center, size}] }] })
  setup(zone, zoneCfg = {}) {
    this.bvh = null;
    this.canopies = [];
    this.fades.clear();
    this.hits.clear();
    this.writeUniforms();
    zone.root.updateMatrixWorld(true);
    const entries = [{ mesh: this.cfg.meshes }, ...(zoneCfg.add || [])];
    const targets = new Map();   // mesh → hộp lọc (null = lấy cả mesh)
    for (const e of entries) {
      const re = new RegExp(e.mesh);
      const boxes = e.boxes?.map((b) => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...b.center), new THREE.Vector3(...b.size)));
      zone.root.traverse((o) => {
        if (!re.test(o.name)) return;
        o.traverse((m) => { if (m.isMesh && m.visible && !m.name.startsWith("COL_")) targets.set(m, boxes || null); });
      });
    }
    // mảnh của mọi mesh (thế giới) → gộp mảnh chạm nhau thành cây (quét theo trục x)
    const parts = [];
    for (const [mesh, filter] of targets) {
      const inst = !!mesh.geometry.attributes.plantId;
      const { compOf, boxes, pids } = inst ? instances(mesh) : components(mesh);
      const c = new THREE.Vector3();
      const keep = boxes.map((b) => !filter || filter.some((f) => f.containsPoint(b.getCenter(c))));
      parts.push({ mesh, inst, compOf, boxes, pids, keep, plantOf: new Int32Array(boxes.length) });
    }
    const all = parts.flatMap((p, pi) => p.boxes.map((box, ci) => ({ pi, ci, inst: p.inst, box: box.clone().expandByScalar(0.02) })).filter((x) => p.keep[x.ci]));
    all.sort((a, b) => a.box.min.x - b.box.min.x);
    const par = all.map((_, i) => i);
    const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    // cùng 1 bản sao ở nhiều mesh gộp (thân, lá: mỗi chất liệu 1 mesh) → 1 cây; bản sao không gộp với gì khác
    const instRoot = new Map();
    for (let i = 0; i < all.length; i++) {
      if (!all[i].inst) continue;
      const p = parts[all[i].pi], key = `${p.mesh.userData.batchGroup}|${p.pids[all[i].ci]}`;
      if (instRoot.has(key)) par[find(i)] = find(instRoot.get(key)); else instRoot.set(key, i);
    }
    for (let i = 0; i < all.length; i++) {
      if (all[i].inst) continue;
      for (let j = i + 1; j < all.length && all[j].box.min.x <= all[i].box.max.x; j++) {
        if (!all[j].inst && all[i].box.intersectsBox(all[j].box)) par[find(j)] = find(i);
      }
    }
    const rootBox = new Map();
    for (let i = 0; i < all.length; i++) {
      const root = find(i);
      if (!rootBox.has(root)) rootBox.set(root, new THREE.Box3());
      rootBox.get(root).union(parts[all[i].pi].boxes[all[i].ci]);
    }
    // cây thấp (hàng rào, bụi, cỏ: cao dưới min_height_m) không che người chơi → không bao giờ mờ (số cây 0)
    const ids = new Map(), plantBoxes = [];
    for (const [root, box] of rootBox) {
      if (box.max.y - box.min.y < this.cfg.min_height_m) continue;
      ids.set(root, ids.size + 1);
      plantBoxes.push(box);
    }
    for (let i = 0; i < all.length; i++) parts[all[i].pi].plantOf[all[i].ci] = ids.get(find(i)) ?? 0;
    // hộp tán của cây mô hình (camera trong tán)
    this.canopies = [];
    for (const [root, box] of rootBox) {
      const id = ids.get(root);
      if (!id || !all[root].inst) continue;
      const b = box.clone(), size = b.getSize(new THREE.Vector3());
      b.min.y += size.y * CANOPY_FROM;
      b.min.x += size.x * CANOPY_SHRINK; b.max.x -= size.x * CANOPY_SHRINK;
      b.min.z += size.z * CANOPY_SHRINK; b.max.z -= size.z * CANOPY_SHRINK;
      this.canopies.push({ id, box: b });
    }
    // số cây theo đỉnh (attribute cho shader) + lưới tam giác thế giới có BVH (dò che khuất)
    const tri = [], triPlant = [], triComp = [];
    const v = new THREE.Vector3();
    let compBase = 0;
    for (const p of parts) {
      const geo = p.mesh.geometry, pos = geo.attributes.position, idx = geo.index;
      const plant = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) plant[i] = p.plantOf[p.compOf[i]];
      geo.setAttribute("seePlant", new THREE.BufferAttribute(plant, 1));
      const count = idx ? idx.count : pos.count;
      for (let t = 0; t < count; t += 3) {
        const a = idx ? idx.getX(t) : t;
        if (!plant[a]) continue;
        for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k).applyMatrix4(p.mesh.matrixWorld);
          tri.push(v.x, v.y, v.z);
          triPlant.push(plant[a]);
          triComp.push(p.inst ? -1 : compBase + p.compOf[a]);   // mảnh kín (cụm lá, thân, chậu…) → kiểm tra camera trong tán
        }
      }
      compBase += p.boxes.length;
      patchMaterial(p.mesh.material);
      hookOutline(p.mesh);
    }
    this.meshes = parts.map((p) => p.mesh.name);
    this.plantBoxes = plantBoxes;
    if (!tri.length) return this.info();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3));
    this.vertPlant = Int32Array.from(triPlant);   // MeshBVH sắp lại index (không đổi đỉnh) → tra cây theo đỉnh
    this.vertComp = Int32Array.from(triComp);
    this.bvh = new MeshBVH(g);
    return this.info();
  }

  plantOfFace(face) { return this.vertPlant[this.bvh.geometry.index.getX(face * 3)]; }

  // điểm p nằm bên trong cây nào: mỗi mảnh (cụm lá, thân, chậu) là khối kín → tia từ p cắt mặt của mảnh đó số lẻ lần
  // = p ở trong mảnh (đếm riêng từng mảnh vì các cụm lá chồng lên nhau). Không có → 0
  containing(p) {
    if (!this.bvh) return 0;
    for (const c of this.canopies) if (c.box.containsPoint(p)) return c.id;   // cây mô hình: hộp tán
    this._upRay.origin.copy(p);
    const idx = this.bvh.geometry.index, crossings = new Map(), plantOf = new Map();
    for (const h of this.bvh.raycast(this._upRay, THREE.DoubleSide, 0, 200)) {
      const v = idx.getX(h.faceIndex * 3), comp = this.vertComp[v];
      if (comp < 0) continue;                                                     // mảng lá cây mô hình (không kín)
      crossings.set(comp, (crossings.get(comp) || 0) + 1);
      plantOf.set(comp, this.vertPlant[v]);
    }
    for (const [comp, n] of crossings) if (n % 2) return plantOf.get(comp);
    return 0;
  }

  // cam: vị trí camera; player: chân người chơi (null = không dò, vd đang cảnh chuyển → cây hiện lại dần)
  update(dt, cam, player) {
    if (!this.bvh) return;
    const c = this.cfg;
    this.hits.clear();
    if (cam && player) {
      this._right.set(player.x - cam.x, 0, player.z - cam.z).normalize().cross(THREE.Object3D.DEFAULT_UP);
      for (const [side, h] of c.rays) {
        this._to.set(player.x, player.y + h, player.z).addScaledVector(this._right, side);
        const len = this._dir.subVectors(this._to, cam).length();
        if (len < 1e-3) continue;
        this._ray.set(cam, this._dir.divideScalar(len));
        for (const x of this.bvh.raycast(this._ray, THREE.DoubleSide, 0, len)) this.hits.add(this.plantOfFace(x.faceIndex));
      }
      // lá sát ống kính: không nằm trên đường nhìn nhưng che kín một góc màn hình
      const near = this.bvh.closestPointToPoint(cam, this._cp, 0, c.near_m);
      if (near) this.hits.add(this.plantOfFace(near.faceIndex));
      // camera nằm hẳn trong tán (cụm lá to hơn near_m): cả màn hình xanh lá → mờ cây đang chứa camera
      const inside = this.containing(cam);
      if (inside) this.hits.add(inside);
    }
    for (const id of this.hits) if (!this.fades.has(id)) this.fades.set(id, { f: 0, since: 0 });
    const step = dt / Math.max(c.fade_s, 1e-3);
    for (const [id, s] of this.fades) {
      s.since = this.hits.has(id) ? 0 : s.since + dt;
      s.f = THREE.MathUtils.clamp(s.f + (s.since <= c.hold_s ? step : -step), 0, 1);
      if (s.f === 0 && s.since > c.hold_s) this.fades.delete(id);
    }
    this.writeUniforms();
  }

  writeUniforms() {
    const ids = uniforms.seeIds.value, vals = uniforms.seeVals.value;
    const top = [...this.fades].sort((a, b) => b[1].f - a[1].f).slice(0, SLOTS);
    for (let i = 0; i < SLOTS; i++) {
      ids[i] = top[i] ? top[i][0] : -1;
      vals[i] = top[i] ? top[i][1].f * this.cfg.max : 0;
    }
  }

  // __game.seeThrough
  info() {
    const size = (b) => b.getSize(new THREE.Vector3());
    const big = this.plantBoxes?.map((b, i) => ({ id: i + 1, size: size(b).toArray().map((x) => +x.toFixed(1)) }))
      .sort((a, b) => Math.max(...b.size) - Math.max(...a.size)).slice(0, 3);
    return { meshes: this.meshes, plants: this.plantBoxes?.length || 0, tris: this.bvh ? this.vertPlant.length / 3 : 0, biggest: big,
      fading: [...this.fades].map(([id, s]) => ({ id, f: +s.f.toFixed(2) })), hits: [...this.hits] };
  }
}
