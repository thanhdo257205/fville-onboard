// Tab Bản đồ của app My FPT (GDD: "sơ đồ đơn giản của zone hiện tại, chấm vị trí người chơi và mục tiêu").
// Chụp zone từ trên xuống 1 lần cho mỗi zone + tầng: camera trực giao đặt ở sàn chỗ người chơi + 2,4 m, nhìn thẳng xuống —
// mặt phẳng gần của camera cắt bỏ mái / trần / tán cây (không dùng clippingPlanes: mọi shader phải biên dịch lại, ~3 s trên
// máy dựng hình bằng phần mềm). Lượt 2 tô mặt sau màu tối → chỗ bị cắt (tường, tủ cao) thành nét tường. Đọc ảnh bất đồng bộ
// (readRenderTargetPixelsAsync): readPixels đồng bộ làm Chrome báo "GPU stall due to ReadPixels". Người chơi (mũi tên theo
// hướng mặt), Tú, mục tiêu hiện tại là phần tử HTML đè lên ảnh, tính lại mỗi lần vẽ tab.
// Khung: zone trong nhà (hộp va chạm ≤ 45 m) → cả hộp va chạm; ngoài trời (hộp va chạm rộng tới 200 m) → các điểm đáng chú ý
// (SPAWN_, NPC_, INT_, TRIGGER_) + lề 10 m. zones.json → <zone>.map: { bounds: [x0, z0, x1, z1], clip_m } ghi đè khi cần.
import * as THREE from "three";
import { worldPos } from "../world/zone.js";

const CLIP_M = 2.4;            // cắt trên sàn chỗ đứng
const INDOOR_MAX_M = 45;       // hộp va chạm nhỏ hơn → zone trong nhà, lấy cả hộp
const MARGIN_M = 10;           // lề quanh các điểm đáng chú ý (ngoài trời)
const MIN_M = 16, MAX_ASPECT = 2.2;
const BOX = { w: 360, h: 340 }; // khung ảnh trong app (px CSS, vừa bề ngang .phone); ảnh chụp gấp đôi cho nét
const BG = 0xdfe6e9, CAP = 0x3a3f47;

export class ZoneMap {
  constructor(game, onReady = () => {}) {
    this.g = game;
    this.onReady = onReady;    // ảnh vừa chụp xong (app vẽ lại tab)
    this.shot = null;          // { key, url, b, w, h, floorY, ms } — hoặc { key, pending: Promise } khi đang đọc ảnh
  }

  // sàn chỗ người chơi đứng (chỗ đứng vững gần nhất) — zone_04 có 2 tầng: mỗi tầng một ảnh
  floorY() { const p = this.g.player; return p.safe?.y ?? p.position.y; }
  key() { return this.g.zone ? `${this.g.zone.id}:${Math.round(this.floorY() / 2)}` : null; }

  bounds(zone) {
    const o = this.g.data.zones.zones[zone.id]?.map?.bounds;
    if (o) return { x0: o[0], z0: o[1], x1: o[2], z1: o[3] };
    const col = zone.collider.geometry.boundingBox ?? (zone.collider.geometry.computeBoundingBox(), zone.collider.geometry.boundingBox);
    let b;
    if (Math.max(col.max.x - col.min.x, col.max.z - col.min.z) <= INDOOR_MAX_M) b = { x0: col.min.x, z0: col.min.z, x1: col.max.x, z1: col.max.z };
    else {
      const box = new THREE.Box3();
      for (const n of [...zone.spawns.values(), ...zone.npcs, ...zone.ints.values(), ...zone.triggers.map((t) => t.node)]) box.expandByPoint(worldPos(n));
      b = { x0: Math.max(box.min.x - MARGIN_M, col.min.x), z0: Math.max(box.min.z - MARGIN_M, col.min.z),
        x1: Math.min(box.max.x + MARGIN_M, col.max.x), z1: Math.min(box.max.z + MARGIN_M, col.max.z) };
    }
    // không quá hẹp / quá dài: nới cạnh ngắn quanh tâm
    const grow = (a0, a1, want) => { const c = (a0 + a1) / 2, h = Math.max(a1 - a0, want) / 2; return [c - h, c + h]; };
    [b.x0, b.x1] = grow(b.x0, b.x1, Math.max(MIN_M, (b.z1 - b.z0) / MAX_ASPECT));
    [b.z0, b.z1] = grow(b.z0, b.z1, Math.max(MIN_M, (b.x1 - b.x0) / MAX_ASPECT));
    return b;
  }

  // chụp ảnh zone hiện tại (vẽ ngay, đọc ảnh bất đồng bộ) → Promise ảnh; đang chụp / đã có ảnh cùng zone + tầng thì dùng lại
  snapshot() {
    const g = this.g, zone = g.zone, key = this.key();
    if (!key) return Promise.resolve(null);
    if (this.shot?.key === key) return this.shot.pending ?? Promise.resolve(this.shot);
    const t0 = performance.now(), floorY = this.floorY();
    const b = this.bounds(zone), wm = b.x1 - b.x0, hm = b.z1 - b.z0;
    const s = Math.min(BOX.w / wm, BOX.h / hm);
    const w = Math.round(wm * s), h = Math.round(hm * s), pw = w * 2, ph = h * 2;
    const clipY = floorY + (g.data.zones.zones[zone.id]?.map?.clip_m ?? CLIP_M);
    // nhìn thẳng xuống từ độ cao cắt, phía trên ảnh = −Z
    const cam = new THREE.OrthographicCamera(-wm / 2, wm / 2, hm / 2, -hm / 2, 0.01, clipY - floorY + 40);
    cam.position.set((b.x0 + b.x1) / 2, clipY, (b.z0 + b.z1) / 2);
    cam.up.set(0, 0, -1);
    cam.lookAt(cam.position.x, floorY - 10, cam.position.z);
    cam.updateMatrixWorld();
    const r = g.renderer.three, scene = g.scene;
    const rt = new THREE.WebGLRenderTarget(pw, ph);   // không MSAA: ảnh gấp đôi khổ hiện đã đủ mịn
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    // chỉ vẽ zone + đèn: ẩn nhân vật, dấu "!", người chơi khác…; trời, sương tắt
    const hidden = scene.children.filter((o) => o.visible && o !== zone.root && !o.isLight);
    for (const o of hidden) o.visible = false;
    const keep = { bg: scene.background, fog: scene.fog, target: r.getRenderTarget(), autoClear: r.autoClear };
    scene.background = new THREE.Color(BG);
    scene.fog = null;
    // lượt 2: mặt sau tô màu tối — chỉ lộ ra ở chỗ bị cắt (tường, tủ cao, tán cây) → thành nét tường trên bản đồ
    const cap = new THREE.MeshBasicMaterial({ color: CAP, side: THREE.BackSide });
    try {
      r.setRenderTarget(rt);
      r.clear();
      r.render(scene, cam);
      r.autoClear = false;
      scene.background = null;
      scene.overrideMaterial = cap;
      r.render(scene, cam);
    } finally {
      scene.overrideMaterial = null;
      r.autoClear = keep.autoClear;
      r.setRenderTarget(keep.target);
      scene.background = keep.bg;
      scene.fog = keep.fog;
      for (const o of hidden) o.visible = true;
      cap.dispose();
    }
    const px = new Uint8Array(pw * ph * 4);
    const pending = r.readRenderTargetPixelsAsync(rt, 0, 0, pw, ph, px).then(() => {
      // hàng dưới cùng trước → lật dọc
      const cv = document.createElement("canvas");
      cv.width = pw; cv.height = ph;
      const ctx = cv.getContext("2d"), img = ctx.createImageData(pw, ph), row = pw * 4;
      for (let y = 0; y < ph; y++) img.data.set(px.subarray((ph - 1 - y) * row, (ph - y) * row), y * row);
      ctx.putImageData(img, 0, 0);
      const shot = { key, url: cv.toDataURL("image/webp", 0.85), b, w, h, floorY, ms: Math.round(performance.now() - t0) };
      if (this.shot?.key === key) { this.shot = shot; this.onReady(); }
      return shot;
    }, (e) => {
      console.warn("[bản đồ] không đọc được ảnh:", e?.message || e);
      if (this.shot?.key === key) this.shot = null;
      return null;
    }).finally(() => rt.dispose());
    this.shot = { key, pending };
    return pending;
  }

  // vị trí trên ảnh (0…1), kẹp vào trong khung (ngoài khung → nằm ở mép)
  uv(p) {
    const b = this.shot.b, k = (v) => Math.min(0.97, Math.max(0.03, v));
    return [k((p.x - b.x0) / (b.x1 - b.x0)), k((p.z - b.z0) / (b.z1 - b.z0))];
  }

  // dữ liệu vẽ tab: ảnh + các dấu (người chơi, Tú, mục tiêu; mục tiêu khác tầng → up / down). Chưa có ảnh → { pending: true }
  // và bắt đầu chụp (xong thì onReady)
  view() {
    const g = this.g;
    if (!g.zone) return null;
    if (this.shot?.key !== this.key() || this.shot.pending) { this.snapshot(); return { pending: true }; }
    const shot = this.shot, p = g.player.position, yaw = g.player.character.root.rotation.y;
    // hướng mặt (sin y, cos y) theo (x, z); trên ảnh x sang phải, z xuống dưới → mũi tên (mặc định chỉ lên) xoay 180° − yaw
    const me = { uv: this.uv(p), deg: Math.round(180 - THREE.MathUtils.radToDeg(yaw)) };
    const f = g.follower;
    const tu = f?.character.root.visible ? { uv: this.uv(f.character.root.position) } : null;
    const goal = g.guide.current();
    const tp = goal.target ? g.guide.targetPos(goal.target, new THREE.Vector3()) : null;
    let target = null;
    if (tp) {
      const dy = this.groundY(goal.target, tp) - shot.floorY;
      target = { uv: this.uv(tp), floor: dy > 2 ? "up" : dy < -2 ? "down" : null };
    }
    return { ...shot, me, tu, target };
  }
  // độ cao của mục tiêu (dấu "!" của guide nằm trên đầu / trên đỉnh vật): NPC, Tú → chân nhân vật; còn lại → tâm node
  // (INT_ / TRIGGER_ thường cao 0–1,5 m trên sàn — ngưỡng ±2 m ở view() vẫn tính là cùng tầng)
  groundY(target, markPos) {
    const g = this.g;
    if (target === "tu") return g.follower?.character.root.position.y ?? markPos.y;
    if (target.startsWith("NPC_")) return g.npc(target)?.character.root.position.y ?? markPos.y;
    const n = g.zone.nodes.get(target);
    return n ? worldPos(n).y : markPos.y;
  }
}
