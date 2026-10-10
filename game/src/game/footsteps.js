// Tiếng bước chân của người chơi và Tú — cả khi cảnh chuyển dắt đi (chỉ dựa vào quãng đường gốc nhân vật đi được).
// Mỗi bước dài ~0,55 m + 0,17 × tốc độ (đi 1,4 m/s ≈ 0,8 m; chạy 4,4 m/s ≈ 1,3 m). Mặt đất dưới chân: 1 tia dò xuống lưới
// bối cảnh, nhớ theo ô 1 m (mỗi ô dò 1 lần mỗi zone): chất liệu tô màu theo đỉnh (M_palette) mà màu xanh lá → cỏ; còn lại
// theo data/zones.json → <zone>.audio.steps (concrete | carpet | grass; mặc định concrete). Tiếng: data/sounds.json →
// step_<mặt đất>. Người chơi nghe thẳng, Tú theo vị trí (nhỏ hơn).
import * as THREE from "three";
import { sound } from "../core/sound.js";

const TELEPORT_M = 1.5;       // nhảy xa hơn chừng này trong 1 khung = dịch chuyển (đổi zone, cảnh chuyển) → không tính bước
const _ray = new THREE.Raycaster();
const _down = new THREE.Vector3(0, -1, 0);
const _o = new THREE.Vector3();
const _c = new THREE.Color();

export class Footsteps {
  constructor(game) {
    this.game = game;
    this.walkers = new Map();     // vai → { prev, acc }
    this.cache = new Map();       // "x,z" → mặt đất
    this.zone = null;
    this.count = 0;
    _ray.far = 1.6;
  }
  reset(zone) {
    this.zone = zone;
    this.cache.clear();
    this.walkers.clear();
    this.meshes = [];
    zone?.root.traverse((o) => { if (o.isMesh && o.visible && !o.name.startsWith("COL_") && !o.userData.batchGroup) this.meshes.push(o); });
  }
  update(dt) {
    const g = this.game;
    if (!g.zone || dt <= 0) return;
    if (g.zone !== this.zone) this.reset(g.zone);
    const list = [["player", g.player?.character, g.player?.body]];
    if (g.follower) list.push(["tu", g.follower.character, g.follower.body]);
    for (const [role, ch, body] of list) {
      const root = ch?.root;
      if (!root) continue;
      const p = root.position, w = this.walkers.get(role) ?? { prev: p.clone(), acc: 0 };
      this.walkers.set(role, w);
      const d = Math.hypot(p.x - w.prev.x, p.z - w.prev.z);
      w.prev.copy(p);
      // ẩn (đang ngồi trong xe), ngồi ghế, lơ lửng giữa không trung, bị dịch chuyển → không có tiếng
      if (!root.visible || d > TELEPORT_M || (role === "player" && (g.player.seated || body?.onGround === false && Math.abs(body.velocity.y) > 2))) { w.acc = 0; continue; }
      if (d < 1e-4) { w.acc = Math.min(w.acc, 0.35); continue; }   // đứng lại: bước đầu khi đi tiếp nghe sớm hơn
      const speed = d / dt;
      w.acc += d;
      const stride = 0.55 + 0.17 * Math.min(speed, 5);
      if (w.acc < stride) continue;
      w.acc -= stride;
      const name = `step_${this.surface(p)}`;
      const run = Math.min(1, Math.max(0, (speed - 1.6) / 2.5));
      if (role === "player") sound.play(name, { gain: 0.8 + 0.4 * run });
      else sound.play(name, { gain: 0.55 + 0.3 * run, pos: p });
      this.count++;
    }
  }
  // mặt đất dưới điểm p (thế giới): grass | concrete | carpet
  surface(p) {
    const key = `${Math.round(p.x)},${Math.round(p.z)},${Math.round(p.y)}`;
    let s = this.cache.get(key);
    if (s) return s;
    const def = this.game.zoneAudio()?.steps || "concrete";
    s = def;
    _ray.set(_o.set(p.x, p.y + 0.5, p.z), _down);
    const hit = _ray.intersectObjects(this.meshes, false)[0];
    if (hit && def !== "carpet") {
      const m = hit.object, col = m.geometry.attributes.color, src = m.userData.srcMaterial ?? m.material;
      const name = [src].flat()[0]?.name || "";
      if (col && hit.face && /palette/i.test(name)) {
        _c.fromBufferAttribute(col, hit.face.a);
        if (_c.g > _c.r * 1.12 && _c.g > _c.b * 1.12 && _c.g > 0.08) s = "grass";
      }
    }
    if (!sound.defs[`step_${s}`]) s = "concrete";
    this.cache.set(key, s);
    return s;
  }
}
