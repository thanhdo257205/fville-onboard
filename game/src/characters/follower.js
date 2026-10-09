// Tú: đi theo người chơi (đi/chạy), có va chạm capsule riêng (tường + NPC + người chơi); tụt lại quá xa hoặc kẹt thì
// dịch chuyển ra sau người chơi. Chỗ đứng: chếch sau người chơi 45°, không đứng chắn giữa camera và người chơi.
import * as THREE from "three";
import { CapsuleBody, pushOutCapsule, blocked, penetration } from "../world/collision.js";

const FAR = 14;            // m — xa hơn thì dịch chuyển lại gần
const STUCK_SEC = 2.5;
const RING = 1.55;         // m — Tú đứng trên vòng quanh nửa sau người chơi
const HOME_DEG = 45;       // chỗ chuẩn: chếch sau 45° (dương = bên phải)
const ANGLES = [45, 70, 95, 20, 0, -20, -45, -70, -95];   // các chỗ thử khi chỗ chuẩn bị che (độ, so với sau lưng)
const MARGIN_DEG = 6;      // nhìn từ camera: thân Tú phải cách thân người chơi ít nhất chừng này độ
const BACK_DEG = 10;       // chỗ chuẩn thoáng hơn MARGIN_DEG + chừng này thì quay về (không lắc qua lại)
const AROUND = 0.3;        // m — lề khi đi vòng qua người chơi / NPC (ngoài tổng bán kính 2 capsule)
const ARRIVE = 0.2;        // m — tới gần chỗ đứng chừng này thì dừng
const HALF_W = 0.35;       // m — nửa bề ngang thân người

// Nhìn từ camera c: Tú (q) có che người chơi (p) không. Trả về khoảng hở (độ) giữa hai thân trên màn hình;
// Tú ở xa camera hơn người chơi hoặc sau lưng camera → Infinity (không che).
function viewGap(c, p, q) {
  const vx = p.x - c.x, vz = p.z - c.z, L = Math.hypot(vx, vz);
  const wx = q.x - c.x, wz = q.z - c.z, D = Math.hypot(wx, wz);
  if (L < 1e-3 || D < 1e-3 || D >= L || vx * wx + vz * wz <= 0) return Infinity;
  const sep = Math.acos(Math.min(1, (vx * wx + vz * wz) / (L * D)));
  return THREE.MathUtils.radToDeg(sep - Math.atan(HALF_W / D) - Math.atan(HALF_W / L));
}

export class Follower {
  constructor(character) {
    this.character = character;
    this.body = new CapsuleBody({ radius: character.model.collision?.radius_m ?? 0.3, height: character.model.height_m });
    this.side = 1;          // 1 = sau-phải, -1 = sau-trái
    this.angle = HOME_DEG;  // chỗ đang nhắm trên vòng (độ)
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.stuck = 0;
    this.teleports = 0;
    character.enableLocomotion();
  }
  get position() { return this.body.position; }
  capsule() { const p = this.body.position; return { x: p.x, z: p.z, y: p.y, height: this.body.height, radius: this.body.radius }; }

  // điểm trên vòng quanh người chơi: deg so với sau lưng (dương = bên phải)
  ring(player, deg) {
    const yaw = player.character.root.rotation.y;               // model nhìn +Z
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const a = THREE.MathUtils.degToRad(deg);
    return player.position.clone().addScaledVector(fwd, -RING * Math.cos(a)).addScaledVector(right, RING * Math.sin(a));
  }

  // dùng được: từ người chơi nhìn thẳng tới được (tia ngang gối và ngang ngực — thành giếng cao 1 m chặn tia ngang gối)
  // và capsule đặt ở đó không lồng vào COL_
  usable(player, q, collider) {
    if (!collider) return true;
    const ray = (h) => blocked(collider, player.position.clone().setY(player.position.y + h), q.clone().setY(q.y + h));
    return !ray(0.4) && !ray(1) && penetration(collider, q.clone().setY(q.y + 0.05), this.body.radius, this.body.height) < 0.05;
  }

  // chỗ đứng mong muốn: chếch sau người chơi 45° bên đang đứng. Nhìn từ camera mà chỗ đó che người chơi, hoặc chỗ đó
  // nằm sau / trong tường → sang chỗ dùng được gần Tú nhất trên vòng nửa sau (đi ít, không cắt ngang tầm nhìn);
  // chỗ chuẩn thoáng hẳn thì quay về. Không đặt lồng vào NPC.
  slot(player, { view = null, obstacles = null, collider = null } = {}) {
    const at = (deg) => this.ring(player, deg);
    const usable = (q) => this.usable(player, q, collider);
    const gap = (deg) => (view ? viewGap(view, player.position, at(deg)) : Infinity);
    const home = HOME_DEG * this.side;
    let angle = this.angle;
    if (usable(at(home)) && gap(home) >= MARGIN_DEG + BACK_DEG) angle = home;
    else if (!usable(at(angle)) || gap(angle) < MARGIN_DEG) {
      let best = null;
      for (const deg of ANGLES) {
        const a = deg * this.side, q = at(a), g = gap(a);
        // ưu tiên chỗ dùng được + thoáng hẳn gần nhất (camera đang quay không đuổi kịp ngay), rồi chỗ vừa đủ thoáng,
        // rồi chỗ thoáng nhất; chỗ Tú không đi thẳng tới được (vd vướng giếng) xếp sau, chỗ sau / trong tường xếp cuối
        const d = q.distanceTo(this.position);
        const walkable = !collider || !blocked(collider, this.position.clone().setY(this.position.y + 0.4), q.clone().setY(q.y + 0.4));
        const score = (usable(q) ? 0 : 1000) + (walkable ? 0 : 500)
          + (g >= MARGIN_DEG + BACK_DEG ? d : g >= MARGIN_DEG ? 10 + d : 100 - Math.max(g, -90));
        if (!best || score < best.score) best = { a, score };
      }
      angle = best.a;
    }
    this.angle = angle;
    if (Math.abs(angle) >= 20) this.side = Math.sign(angle);
    const s = at(angle);
    if (obstacles) for (const o of obstacles) pushOutCapsule(s, this.body.radius + 0.1, this.body.height, o);
    return s;
  }

  // đặt ngay vào chỗ đứng (lúc vào zone / bị kẹt / tụt xa). Có camera: chọn chỗ trên vòng mà camera nhìn thấy Tú,
  // không che người chơi, dùng được — xét cả mesh hiển thị gần camera (opts.occluders; vd zone_01: thân xe bus thật
  // nhô ra ngoài hộp COL_ che mất chỗ sau-phải). Không chỗ nào đạt → chỗ đứng thường.
  placeNear(player, opts = {}) {
    let spot = null;
    const { view, collider, occluders } = opts;
    if (view && collider) {
      const rc = new THREE.Raycaster();
      const seen = (q) => {
        const eye = q.clone().setY(q.y + 1.2);
        if (blocked(collider, view, eye)) return false;
        if (!occluders?.length) return true;
        const d = eye.clone().sub(view), len = d.length();
        rc.set(view, d.divideScalar(len)); rc.far = Math.max(0, len - 0.4);
        return !rc.intersectObjects(occluders, false).length;
      };
      for (const deg of [HOME_DEG, -HOME_DEG, ...ANGLES].map((d) => d * this.side)) {
        const q = this.ring(player, deg);
        if (!this.usable(player, q, collider) || viewGap(view, player.position, q) < MARGIN_DEG + BACK_DEG || !seen(q)) continue;
        this.angle = deg;
        if (Math.abs(deg) >= 20) this.side = Math.sign(deg);
        spot = q;
        if (opts.obstacles) for (const o of opts.obstacles) pushOutCapsule(spot, this.body.radius + 0.1, this.body.height, o);
        break;
      }
    }
    this.body.teleport((spot || this.slot(player, opts)).add(new THREE.Vector3(0, 0.05, 0)));
    this.velocity.set(0, 0, 0);
    this.character.root.rotation.y = player.character.root.rotation.y;
    this.sync();
  }

  // chờ tại chỗ (vd zone_00: Tú đứng xem điện thoại ở mái chờ tới khi người chơi bắt chuyện), không đi theo
  wait({ pos, yaw, anim = "idle" }) {
    this.waiting = { pos: pos.clone(), yaw, anim };
    this.body.teleport(pos.clone().add(new THREE.Vector3(0, 0.05, 0)));
    this.velocity.set(0, 0, 0);
    this.character.root.rotation.y = yaw;
    this.character.play(anim, { fade: 0, randomStart: true });
    this.sync();
  }
  stopWaiting() { if (!this.waiting) return; this.waiting = null; if (!this.talking) this.character.enableLocomotion(); }

  // trong hội thoại: đứng lại, quay về phía người chơi, diễn anim (think, wave...) rồi về đi/đứng
  speak(anim) {
    this.talking = true;
    if (!anim) return;
    this.character.playOnce(anim).then(() => { if (this.talking) this.character.play("talk"); });
  }
  listen() { if (this.talking) this.character.play("idle", { fade: 0.25 }); }
  endTalk() {
    this.talking = false;
    if (this.waiting) { this.character.root.rotation.y = this.waiting.yaw; this.character.play(this.waiting.anim, { fade: 0.3 }); }
    else this.character.enableLocomotion();
  }

  // opts: { view: vị trí camera, obstacles: capsule NPC + người chơi }
  update(dt, player, collider, opts = {}) {
    if (this.waiting && !this.talking) { this.character.update(dt); return; }
    if (this.talking) {   // đứng yên, nhìn người chơi
      this.character.faceDir(new THREE.Vector3(player.position.x - this.position.x, 0, player.position.z - this.position.z), dt, 5);
      this.character.update(dt);
      return;
    }
    const { walk, run } = this.character.model.speed_mps;
    const target = this.slot(player, { ...opts, collider });
    const to = new THREE.Vector3(target.x - this.position.x, 0, target.z - this.position.z);
    const dist = to.length();
    const toPlayer = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
    if (toPlayer > FAR || this.stuck > STUCK_SEC) { this.placeNear(player, { ...opts, collider }); this.stuck = 0; this.teleports++; return; }
    let want = 0;
    // chỗ đứng đi cùng người chơi → Tú nhanh hơn người chơi một chút cho kịp (vd người chơi rẽ, Tú ở vòng ngoài)
    const catchUp = player.speed + dist * 1.2;
    if (dist > ARRIVE) want = dist > 3.5 ? run * 1.1 : Math.min(run * 1.1, Math.max(Math.min(walk, dist * 1.8), catchUp));
    // đang chắn giữa camera và người chơi → đi tiếp tới chỗ mới dù đã gần, không đứng lại trong tầm nhìn
    if (opts.view && dist > 0.1 && viewGap(opts.view, player.position, this.position) < MARGIN_DEG) want = Math.max(want, Math.min(walk, Math.max(dist * 2.5, 0.5)));
    const dir = this.steer(target, opts.obstacles);
    const wantVel = dist > 1e-3 ? dir.multiplyScalar(want) : new THREE.Vector3();
    const diff = wantVel.sub(this.velocity);
    const maxStep = 9 * dt;
    if (diff.length() > maxStep) diff.setLength(maxStep);
    this.velocity.add(diff);
    const before = this.position.clone();
    this.body.step(dt, this.velocity, collider, opts.obstacles);
    const moved = Math.hypot(this.position.x - before.x, this.position.z - before.z) / Math.max(dt, 1e-4);
    this.speed = THREE.MathUtils.lerp(this.speed, Math.min(moved, this.velocity.length()), Math.min(1, dt * 12));
    // muốn đi mà không nhúc nhích → đang kẹt
    this.stuck = want > 0.5 && moved < 0.15 ? this.stuck + dt : 0;
    if (this.velocity.lengthSq() > 0.04) this.character.faceDir(this.velocity, dt, 8);
    else this.character.faceDir(new THREE.Vector3(player.position.x - this.position.x, 0, player.position.z - this.position.z), dt, 3);
    this.character.setSpeed(this.speed);
    this.character.update(dt);
    if (this.position.y < -10) this.placeNear(player, { ...opts, collider });
    this.sync();
  }

  // hướng đi tới target; đường thẳng cắt qua capsule khác (người chơi, NPC) → nhắm điểm bên cạnh capsule đó để đi vòng
  // (đâm thẳng vào lưng người chơi thì lực đẩy ngược chiều → đứng kẹt tới khi dịch chuyển)
  steer(target, obstacles) {
    const p = this.position, sx = target.x - p.x, sz = target.z - p.z, L2 = sx * sx + sz * sz;
    const dir = new THREE.Vector3(sx, 0, sz);
    if (L2 < 1e-6) return dir.set(0, 0, 0);
    let hit = null;
    for (const o of obstacles || []) {
      const t = ((o.x - p.x) * sx + (o.z - p.z) * sz) / L2;
      if (t <= 0 || t >= 1) continue;
      const cx = p.x + sx * t - o.x, cz = p.z + sz * t - o.z, d = Math.hypot(cx, cz), need = this.body.radius + o.radius + AROUND;
      if (d < need && (!hit || t < hit.t)) hit = { o, t, cx, cz, d, need };
    }
    if (hit) {
      let nx = hit.cx, nz = hit.cz;
      if (hit.d < 1e-3) { nx = -sz; nz = sx; }          // đi thẳng vào tâm: vòng bên trái hướng đi
      const nl = Math.hypot(nx, nz);
      dir.set(hit.o.x + (nx / nl) * hit.need - p.x, 0, hit.o.z + (nz / nl) * hit.need - p.z);
    }
    return dir.lengthSq() > 1e-8 ? dir.normalize() : dir;
  }

  sync() { this.character.root.position.copy(this.body.position); }
}
