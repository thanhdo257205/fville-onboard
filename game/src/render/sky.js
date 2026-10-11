// Bầu trời + phông nền xa (data/backdrop.json), dùng chung mọi zone — không thuộc GLB bối cảnh (không sửa GLB từ code: chỉ
// thêm vật ở xa, ngoài hộp bao zone). Thay cho trời một màu phẳng (scene.background = mood.sky) và đường cắt giữa mép mặt
// đất zone với trời:
//   • vòm trời: shader 2 màu đỉnh (mood.sky_top) → chân trời (mood.sky_horizon), quầng sáng phía mặt trời (mood.sun), đi theo
//     camera, nằm đúng mặt phẳng xa (z = w) và vẽ SAU mọi vật đục → chỉ tô điểm ảnh còn trống (không tô kín màn hình mỗi khung;
//     không bao giờ che vật trong zone). Phông nền + mặt đất xa cũng vẽ sau vật trong zone (renderOrder) → phần bị nhà, cây che
//     bị loại sớm theo độ sâu;
//   • sương = đúng màu chân trời (mood.fog, không có thì default_fog) → mặt đất tan dần vào trời;
//   • mặt đất xa: vành phẳng quanh hộp bao zone (từ mép hộp ra radius_m), thấp hơn mặt đất zone, có sương;
//   • phông nền: các vòng hàng cây / dãy nhà khu Công nghệ cao / đồi / núi Ba Vì quanh tâm zone — không chiếu sáng, màu theo
//     đỉnh, pha dần sang màu chân trời theo khoảng cách (tính sẵn trên CPU khi đổi mood, không dùng sương của three);
//   • mây low-poly trôi chậm.
// Không vẽ viền nét (OutlineEffect), không nằm trong zone.root (bản đồ app My FPT tự ẩn mọi thứ ngoài zone). Nấc Detail thấp
// nhất (điện thoại): tắt mây + lớp low_detail: false. Đổi zone: chỉ dựng lại vành mặt đất (hộp bao zone khác), giải phóng bản cũ.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const DOME_R = 560;          // < camera.far (600)
const BASE_Y = -8;           // chân các vòng phông nền (dưới mặt đất, không hở khe với vành mặt đất)
const NO_OUTLINE = { visible: false };
const DEFAULT_SUN = { position: [-30, 60, 40], color: "#fff0d8" };   // như createLights (render/renderer.js)

// số ngẫu nhiên có hạt giống (phông nền giống hệt nhau mỗi lần mở game)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const span = (r, [a, b]) => a + (b - a) * r();
// hướng la bàn (0 = bắc = −Z, 90 = đông = +X) → (x, z)
const dirOf = (deg) => { const a = THREE.MathUtils.degToRad(deg); return [Math.sin(a), -Math.cos(a)]; };
const angDiff = (a, b) => { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
// nhiễu mượt theo góc (tổng vài sóng sin, pha ngẫu nhiên) → −1 … 1
function wave(r, n = 4) {
  const parts = Array.from({ length: n }, (_, i) => ({ f: 2 + i * 3 + Math.floor(r() * 3), p: r() * Math.PI * 2, a: 1 / (i + 1) }));
  const sum = parts.reduce((s, q) => s + q.a, 0);
  return (deg) => { const t = THREE.MathUtils.degToRad(deg); let v = 0; for (const q of parts) v += q.a * Math.sin(t * q.f + q.p); return v / sum; };
}

// một vòng phông nền: dải tứ giác đứng quanh tâm, đáy BASE_Y, đỉnh theo heights; trả các mảng thô + thông tin pha màu
function ring({ samples, color, haze }) {
  const pos = [], idx = [], base = [], hz = [], dist = [];
  const c = new THREE.Color(color);
  samples.forEach(({ deg, r, h, tint = 1 }, i) => {
    const [x, z] = dirOf(deg);
    pos.push(x * r, BASE_Y, z * r, x * r, h, z * r);
    for (let k = 0; k < 2; k++) { base.push(c.r * tint, c.g * tint, c.b * tint); dist.push(r); }
    hz.push(Math.min(1, haze + 0.22), haze);     // chân pha nhiều hơn → tan vào mặt đất xa
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  return { pos, idx, base, hz, dist };
}

function buildLayer(L, scale) {
  const r = rng(L.seed ?? 1), R = L.radius_m * scale, [h0, h1] = L.height_m;
  if (L.kind === "blocks") {
    // dãy nhà: mỗi nhà một tứ giác riêng (cạnh đứng sắc), chỉ trong các cung sectors_deg
    const parts = [];
    for (const [a0, a1] of L.sectors_deg || []) {
      for (let a = a0; a < a1;) {
        const w = THREE.MathUtils.radToDeg(span(r, L.width_m) / R), h = span(r, L.height_m), rr = R + span(r, [-10, 10]), tint = 0.86 + r() * 0.22;
        const b = Math.min(a + w, a1);
        parts.push(ring({ samples: [{ deg: a, r: rr, h, tint }, { deg: b, r: rr, h, tint }], color: L.color, haze: L.haze }));
        a = b + THREE.MathUtils.radToDeg(span(r, L.gap_m) / R);
      }
    }
    return concat(parts);
  }
  const n = L.segments || 160, noise = wave(r, 5), jag = rng((L.seed ?? 1) + 7);
  const crowns = Math.round((2 * Math.PI * R) / 13) / 2, ph = r() * Math.PI;   // hàng cây: mỗi tán ~13 m
  const samples = [];
  for (let i = 0; i <= n; i++) {
    const deg = (i / n) * 360;
    let k;
    if (L.kind === "trees") k = 0.3 + 0.35 * (0.5 + 0.5 * noise(deg)) + 0.35 * Math.abs(Math.sin(THREE.MathUtils.degToRad(deg) * crowns + ph));
    else k = 0.5 + 0.5 * noise(deg) + (jag() - 0.5) * 0.18;     // đồi / núi: thêm gờ gãy khúc kiểu low-poly
    let h = h0 + (h1 - h0) * k;
    for (const p of L.peaks || []) { const d = angDiff(deg, p.bearing_deg) / (p.width_deg / 2); h = Math.max(h, p.height_m * Math.exp(-d * d) * (0.94 + jag() * 0.06)); }
    samples.push({ deg, r: R * (1 + (jag() - 0.5) * 0.04), h: h * Math.min(scale, 1.3) });
  }
  return ring({ samples, color: L.color, haze: L.haze });
}

function concat(parts) {
  const out = { pos: [], idx: [], base: [], hz: [], dist: [] };
  for (const p of parts) {
    const off = out.pos.length / 3;
    out.pos.push(...p.pos); out.base.push(...p.base); out.hz.push(...p.hz); out.dist.push(...p.dist);
    out.idx.push(...p.idx.map((i) => i + off));
  }
  return out;
}

function toMesh(raw) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(raw.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(raw.base.slice(), 3));
  g.setIndex(raw.idx);
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  m.userData.outlineParameters = NO_OUTLINE;
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 900;
  mesh.userData.raw = raw;          // màu gốc + độ pha → pha lại khi đổi mood
  return mesh;
}

function cloudsMesh(C) {
  const r = rng(C.seed ?? 1), parts = [], ks = [];
  for (let i = 0; i < C.count; i++) {
    const deg = (i / C.count) * 360 + r() * (300 / C.count), [x, z] = dirOf(deg), R = span(r, C.radius_m), y = span(r, C.height_m), size = span(r, C.size_m);
    const blobs = 3 + Math.floor(r() * 3);
    for (let b = 0; b < blobs; b++) {
      const rad = size * (0.45 + r() * 0.35);
      const g0 = new THREE.IcosahedronGeometry(rad, 0), g = g0.index ? g0.toNonIndexed() : g0;   // gộp được với nhau: cùng không chỉ mục
      if (g !== g0) g0.dispose();
      g.scale(1.5, 0.55, 1);
      // độ cao trong từng cụm (0 = đáy, 1 = đỉnh) → màu theo đỉnh: trên sáng, dưới pha chân trời
      const py = g.attributes.position.array;
      for (let i = 1; i < py.length; i += 3) ks.push(THREE.MathUtils.clamp(0.5 + py[i] / (rad * 0.55 * 2), 0, 1));
      g.rotateY(-THREE.MathUtils.degToRad(deg));
      // xếp các cụm dọc theo phương tiếp tuyến của vòng mây
      const along = (b - (blobs - 1) / 2) * size * 0.75, [tx, tz] = [-z, x];
      g.translate(x * R + tx * along, y + (r() - 0.5) * size * 0.25, z * R + tz * along);
      parts.push(g);
    }
  }
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));   // đặt ở setMood
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  m.userData.outlineParameters = NO_OUTLINE;
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 900;
  mesh.userData.ks = ks;
  return mesh;
}

export class Sky {
  constructor(scene, cfg) {
    this.cfg = cfg || {};
    this.root = new THREE.Group();
    this.root.name = "sky_backdrop";
    this.backdrop = new THREE.Group();          // vòng phông nền + mây + mặt đất xa: đặt ở tâm zone
    this.root.add(this.backdrop);
    // vòm trời: đi theo camera, vẽ đầu tiên
    this.uniforms = {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
    };
    const dm = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float t = pow(clamp(d.y, 0.0, 1.0), 0.6);
          vec3 c = mix(horizon, top, smoothstep(0.0, 1.0, t));
          float s = max(dot(d, sunDir), 0.0);
          c += sunColor * (pow(s, 5.0) * 0.18 + pow(s, 60.0) * 0.45) * smoothstep(-0.05, 0.08, d.y);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    dm.userData.outlineParameters = NO_OUTLINE;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 32, 16), dm);
    this.dome.renderOrder = 1000;            // sau mọi vật đục (vật trong suốt three vẽ sau nữa)
    this.dome.frustumCulled = false;
    this.root.add(this.dome);
    // vòng phông nền (dựng 1 lần, dùng chung mọi zone): core luôn hiện, extra tắt ở nấc Detail thấp nhất
    this.scale = 1;
    this.buildLayers();
    this.clouds = cloudsMesh(this.cfg.clouds || { count: 0, radius_m: [300, 400], height_m: [90, 120], size_m: [30, 40] });
    this.backdrop.add(this.clouds);
    this.ground = null;
    this.low = false;
    this.mood = null;
    scene.add(this.root);
  }

  buildLayers() {
    for (const m of [this.core, this.extra]) if (m) { this.backdrop.remove(m); m.geometry.dispose(); m.material.dispose(); }
    const layers = this.cfg.layers || [];
    const raw = (keep) => concat(layers.filter((L) => (L.low_detail !== false) === keep).map((L) => buildLayer(L, this.scale)));
    this.core = toMesh(raw(true));
    this.extra = toMesh(raw(false));
    this.backdrop.add(this.core, this.extra);
  }

  // zone mới: tâm phông nền = tâm hộp bao zone; vành mặt đất xa từ mép hộp bao ra radius_m
  setZone(zone) {
    const box = new THREE.Box3().setFromObject(zone.root);
    if (box.isEmpty()) box.set(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 0, 50));
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    this.backdrop.position.set(cx, 0, cz);
    const half = Math.hypot(box.max.x - cx, box.max.z - cz);
    const first = this.cfg.layers?.[0]?.radius_m ?? 190;
    const scale = Math.max(1, (half + 60) / first);          // zone rộng hơn dự kiến → nới các vòng ra (phông nền ngoài zone)
    if (Math.abs(scale - this.scale) > 1e-3) { this.scale = scale; this.buildLayers(); if (this.mood) this.setMood(this.mood); }
    // vành mặt đất: hình tròn bán kính G, khoét lỗ đúng hộp bao zone (mặt đất zone vẫn là của GLB)
    const G = this.cfg.ground || {}, R = Math.max(G.radius_m ?? 560, half + 100);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    const [x0, x1, z0, z1] = [box.min.x - cx, box.max.x - cx, box.min.z - cz, box.max.z - cz];
    // ShapeGeometry nằm trong mặt XY, xoay −90° quanh X → (x, y) thành (x, −y) trên mặt XZ
    hole.moveTo(x0, -z0); hole.lineTo(x0, -z1); hole.lineTo(x1, -z1); hole.lineTo(x1, -z0); hole.lineTo(x0, -z0);
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape, Math.max(8, Math.round((G.segments ?? 72) / 4)));
    g.rotateX(-Math.PI / 2);
    if (this.ground) { this.backdrop.remove(this.ground); this.ground.geometry.dispose(); }
    else {
      const m = new THREE.MeshLambertMaterial({ color: G.color ?? "#7f9a5c", fog: true });
      m.userData.outlineParameters = NO_OUTLINE;
      this.ground = new THREE.Mesh(g, m);
      this.ground.frustumCulled = false;
      this.ground.renderOrder = 900;
    }
    this.ground.geometry = g;
    this.ground.position.y = Math.min(G.y_m ?? -0.56, box.min.y - 0.06);
    this.backdrop.add(this.ground);
  }

  // màu trời / sương theo mood (zones.json → mood: sky_top, sky_horizon, fog, sun) → trả sương cho scene
  setMood(mood) {
    this.mood = mood || {};
    const d = this.cfg.default_sky || {};
    const top = new THREE.Color(this.mood.sky_top ?? d.top ?? "#5e9fdc");
    const horizon = new THREE.Color(this.mood.sky_horizon ?? this.mood.sky ?? d.horizon ?? "#cfe3f1");
    this.uniforms.top.value.copy(top);
    this.uniforms.horizon.value.copy(horizon);
    const sun = { ...DEFAULT_SUN, ...(this.mood.sun || {}) };
    this.uniforms.sunDir.value.fromArray(sun.position).normalize();
    this.uniforms.sunColor.value.set(sun.color);
    const fog = this.mood.fog ?? this.cfg.default_fog ?? [90, 480];
    // phông nền: pha màu chân trời theo độ pha của lớp + sương ở khoảng cách đó
    const fh = this.cfg.fog_haze ?? 0.8, c = new THREE.Color();
    for (const mesh of [this.core, this.extra]) {
      const raw = mesh.userData.raw, col = mesh.geometry.attributes.color;
      for (let i = 0; i < raw.dist.length; i++) {
        const f = THREE.MathUtils.clamp((raw.dist[i] - fog[0]) / Math.max(1, fog[1] - fog[0]), 0, 1) * fh;
        const k = 1 - (1 - raw.hz[i]) * (1 - f);
        c.setRGB(raw.base[i * 3], raw.base[i * 3 + 1], raw.base[i * 3 + 2]).lerp(horizon, k);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }
    // mây: trên trắng (ánh nắng), dưới pha chân trời
    const cc = this.clouds.geometry.attributes.color, ks = this.clouds.userData.ks, white = new THREE.Color(this.cfg.clouds?.color ?? "#ffffff");
    const lit = white.clone().lerp(new THREE.Color(sun.color), 0.18), under = white.clone().lerp(horizon, 0.45).multiplyScalar(0.94);
    for (let i = 0; i < ks.length; i++) { c.copy(under).lerp(lit, 0.35 + 0.65 * ks[i]); cc.setXYZ(i, c.r, c.g, c.b); }
    cc.needsUpdate = true;
    return { color: horizon, fog };
  }

  // nấc Detail thấp nhất: tắt mây + lớp phụ
  setLowDetail(low) { this.low = !!low; this.clouds.visible = !this.low; this.extra.visible = !this.low; }

  update(camera, dt) {
    this.dome.position.copy(camera.position);
    if (!this.low) this.clouds.rotation.y += THREE.MathUtils.degToRad(this.cfg.clouds?.speed_deg_s ?? 0.25) * dt;
  }

  // số liệu cho kiểm thử (__game.sky)
  info() {
    const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    return { core: tris(this.core), extra: tris(this.extra), clouds: tris(this.clouds), ground: this.ground ? tris(this.ground) : 0,
      dome: tris(this.dome), center: this.backdrop.position.toArray().map((v) => +v.toFixed(1)), scale: +this.scale.toFixed(2),
      low: this.low, top: "#" + this.uniforms.top.value.getHexString(), horizon: "#" + this.uniforms.horizon.value.getHexString() };
  }
}
