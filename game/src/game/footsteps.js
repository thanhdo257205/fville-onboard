// Tiếng bước chân của người chơi và Tú — cả khi cảnh chuyển dắt đi. Khớp nhịp chân của animation: theo dõi độ cao xương cổ
// chân (mixamorig LeftFoot / RightFoot) so với gốc nhân vật. Chân "chạm đất" khi xuống sát độ cao lúc đứng trên đất (≤ DOWN_M
// trên mức thấp nhất đã gặp), "nhấc lên" khi cao hơn UP_M; mỗi lần nhấc → chạm = 1 tiếng. Khoảng giữa 2 ngưỡng không đổi trạng
// thái → chân đang vung hơi trũng xuống (đi bộ: ~2–3 cm) hay rung khi đứng trên đất không thành tiếng thừa. Đi / chạy / trộn 2
// animation, tốc độ phát đổi theo tốc độ thật đều tự khớp (trước đây đếm theo quãng đường — mỗi ~0,8–1,3 m một tiếng, lệch với
// lúc chân chạm đất). Chỉ khi đang di chuyển (≥ MOVE_MPS); model không có xương bàn chân → đếm theo quãng đường như cũ.
// Mặt đất dưới chân: 1 tia dò xuống lưới
// bối cảnh, nhớ theo ô 1 m (mỗi ô dò 1 lần mỗi zone): chất liệu tô màu theo đỉnh (M_palette) mà màu xanh lá → cỏ; còn lại
// theo data/zones.json → <zone>.audio.steps (concrete | carpet | grass; mặc định concrete). Tiếng: data/sounds.json →
// step_<mặt đất>. Người chơi nghe thẳng, Tú theo vị trí (nhỏ hơn).
import * as THREE from "three";
import { sound } from "../core/sound.js";

const TELEPORT_M = 1.5;       // nhảy xa hơn chừng này trong 1 khung = dịch chuyển (đổi zone, cảnh chuyển) → không tính bước
const MOVE_MPS = 0.35;        // chậm hơn = đứng / xoay tại chỗ (animation idle cũng nhích chân) → không có tiếng
const DOWN_M = 0.015;         // cổ chân thấp hơn (so với mức thấp nhất đã gặp) = chân trên đất
const UP_M = 0.045;           // cao hơn = chân đã nhấc (đi bộ nhấc ~10 cm, chạy ~35 cm; chân vung trũng nhất ~2,5 cm)
const FEET = [["mixamorigLeftFoot", "mixamorig:LeftFoot", "LeftFoot"], ["mixamorigRightFoot", "mixamorig:RightFoot", "RightFoot"]];
const _f = new THREE.Vector3();
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
      const p = root.position;
      let w = this.walkers.get(role);
      if (!w || w.ch !== ch) {                 // vai mới / đổi model (đổi ngoại hình, mức đồ hoạ) → tìm lại xương bàn chân
        const feet = FEET.map((names) => names.map((n) => root.getObjectByName(n)).find(Boolean)).filter(Boolean);
        w = { ch, prev: p.clone(), acc: 0, feet: feet.length === 2 ? feet.map((bone) => ({ bone, low: Infinity, down: null })) : null };
        this.walkers.set(role, w);
      }
      const d = Math.hypot(p.x - w.prev.x, p.z - w.prev.z);
      w.prev.copy(p);
      // ẩn (đang ngồi trong xe), ngồi ghế, lơ lửng giữa không trung, bị dịch chuyển → không có tiếng
      if (!root.visible || d > TELEPORT_M || (role === "player" && (g.player.seated || body?.onGround === false && Math.abs(body.velocity.y) > 2))) { w.acc = 0; this.rest(w); continue; }
      const speed = d / dt;
      if (w.feet) { this.feet(w, role, p, speed, dt); continue; }
      if (d < 1e-4) { w.acc = Math.min(w.acc, 0.35); continue; }   // đứng lại: bước đầu khi đi tiếp nghe sớm hơn
      w.acc += d;
      const stride = 0.55 + 0.17 * Math.min(speed, 5);
      if (w.acc < stride) continue;
      w.acc -= stride;
      this.step(role, p, speed);
    }
  }
  // theo nhịp chân của animation: mỗi lần 1 chân nhấc lên rồi chạm đất → 1 tiếng
  feet(w, role, p, speed, dt) {
    const now = (w.t = (w.t || 0) + dt);
    if (speed < MOVE_MPS) { this.rest(w); return; }
    const rootY = w.ch.root.getWorldPosition(_o).y;
    for (const f of w.feet) {
      const h = f.bone.getWorldPosition(_f).y - rootY;
      f.low = Math.min(f.low + 0.01 * dt, h);           // độ cao cổ chân lúc đứng trên đất; nhích lên rất chậm (đổi model / dáng)
      const c = h - f.low;
      if (f.down == null) f.down = c < UP_M;             // vừa bắt đầu đi: chân đang trên đất thì chưa kêu
      else if (f.down && c > UP_M) f.down = false;
      else if (!f.down && c < DOWN_M) { f.down = true; this.step(role, p, speed, now); }
    }
  }
  // đứng yên / bị chặn: quên nhịp đang dở (đi tiếp thì tiếng đầu là lần chạm đất kế tiếp)
  rest(w) { for (const f of w.feet || []) f.down = null; }
  step(role, p, speed, t = null) {
    const name = `step_${this.surface(p)}`;
    const run = Math.min(1, Math.max(0, (speed - 1.6) / 2.5));
    if (role === "player") sound.play(name, { gain: 0.8 + 0.4 * run });
    else sound.play(name, { gain: 0.55 + 0.3 * run, pos: p });
    this.count++;
    (this.log ||= []).push({ role, t, speed: +speed.toFixed(2) });      // __game.footsteps: kiểm thử nhịp
    if (this.log.length > 120) this.log.shift();
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
