// Cảnh chuyển theo data/cutscenes.json (hiện có "len_xe": zone_00 lên xe → zone_01 xuống xe), ~20 giây, Skip / Esc.
// Chạy theo thời gian game: Game.update(dt) gọi update(dt) → các "track" (xe chạy, cửa xoay, người đi) + các mốc chờ.
// Xe chạy bằng code dọc PATH_ (extras.points, toạ độ glTF), cánh cửa xoay quanh bản lề (trục Y), góc máy theo CAM_.
import * as THREE from "three";
import { hud } from "../ui/hud.js";
import { t } from "../i18n.js";
import { worldPos } from "../world/zone.js";

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const FOV = 60;
const heading = (d) => Math.atan2(-d.z, d.x);          // góc xoay (quanh Y) đưa +X về hướng d

// Đường cong PATH_: polyline đã lấy mẫu đều trong Blender
class PathTrack {
  constructor(node) {
    const p = node?.userData?.points || [];
    this.pts = [];
    for (let i = 0; i + 2 < p.length; i += 3) this.pts.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.cum[this.cum.length - 1] || 0;
  }
  // vị trí + hướng tại quãng đường s (m)
  at(s) {
    const n = this.pts.length;
    s = THREE.MathUtils.clamp(s, 0, this.length);
    let i = 1;
    while (i < n - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const k = (s - this.cum[i - 1]) / Math.max(1e-6, this.cum[i] - this.cum[i - 1]);
    return { pos: a.clone().lerp(b, k), dir: b.clone().sub(a).setY(0).normalize() };
  }
}

// Vật chạy theo đường: lưu tư thế gốc (trong GLB) để trả lại khi xong / Skip
class Mover {
  constructor(node, path, restAt) {
    this.node = node;
    this.path = path;
    this.restPos = node.position.clone();
    this.restQuat = node.quaternion.clone();
    const f = X.clone().applyQuaternion(node.quaternion);
    this.offset = heading(f) - heading(path.at(restAt).dir);   // vd INT_xe_bus: mesh con quay 180° → đầu xe là -X
  }
  place(s) {
    const { pos, dir } = this.path.at(s);
    this.node.position.copy(pos);
    this.node.quaternion.setFromAxisAngle(UP, heading(dir) + this.offset);
    this.node.updateMatrixWorld(true);
  }
  restore() { this.node.position.copy(this.restPos); this.node.quaternion.copy(this.restQuat); this.node.updateMatrixWorld(true); }
}

// góc xoay quanh Y của node (chỉ xoay quanh Y, vd cánh cửa)
const yAngle = (q) => 2 * Math.atan2(q.y, q.w);

export class Cutscene {
  constructor(game, id, cfg) {
    Object.assign(this, { game, id, cfg });
    this.T = cfg.timing || {};
    this.t = 0;
    this.waits = [];
    this.tracks = new Set();
    this.skipped = false;
    this.stage = "start";
    this.cam = null;               // { pos, look, fov, track }
    this.look = new THREE.Vector3();
    this.blend = null;
    this.log = [];                 // mốc thời gian từng nhịp (báo cáo / __game)
  }

  // ---------- thời gian ----------
  wait(sec) {
    if (this.skipped || !(sec > 0)) return Promise.resolve();
    return new Promise((res) => this.waits.push({ at: this.t + sec, res }));
  }
  track(fn) { this.tracks.add(fn); }
  mark(stage) { this.stage = stage; this.log.push({ stage, t: +this.t.toFixed(2) }); }

  update(dt) {
    this.t += dt;
    for (const fn of [...this.tracks]) if (fn(dt) === false) this.tracks.delete(fn);
    const due = this.waits.filter((w) => this.t >= w.at);
    this.waits = this.waits.filter((w) => this.t < w.at);
    for (const w of due) w.res();
    if (this.game.state.phase === "playing") for (const n of this.game.npcs) n.update(dt);
    this.applyCamera(dt);
  }

  skip() {
    if (this.skipped || this.stage === "finish") return;
    this.skipped = true;
    this.mark("skip");
    for (const w of this.waits) w.res();
    this.waits = [];
    this.tracks.clear();
    if (this.game.runner.active) this.game.runner.abort();
  }

  // ---------- camera ----------
  shot(node, { track = null } = {}) {
    const ex = node.userData || {};
    this.cam = {
      pos: worldPos(node),
      look: ex.target ? new THREE.Vector3(...ex.target) : worldPos(node).add(new THREE.Vector3(0, 0, -1)),
      fov: ex.fov_deg || FOV,
      track: track ?? (ex.track ? this.game.zone.nodes.get(ex.track) : null),
    };
    this.look.copy(this.lookTarget());
  }
  lookTarget() {
    const c = this.cam;
    return c.track ? worldPos(c.track).add(new THREE.Vector3(0, 1.6, 0)) : c.look;
  }
  applyCamera(dt) {
    const cam = this.game.camera;
    if (this.blend) {                                   // về camera chơi
      const b = this.blend;
      b.k = Math.min(1, b.k + dt / b.dur);
      const e = THREE.MathUtils.smoothstep(b.k, 0, 1);
      cam.position.lerpVectors(b.fromPos, b.toPos, e);
      cam.quaternion.slerpQuaternions(b.fromQuat, b.toQuat, e);
      cam.fov = THREE.MathUtils.lerp(b.fromFov, FOV, e);
      cam.updateProjectionMatrix();
      return;
    }
    if (!this.cam) return;
    this.look.lerp(this.lookTarget(), Math.min(1, dt * 6));
    cam.position.copy(this.cam.pos);
    cam.lookAt(this.look);
    if (cam.fov !== this.cam.fov) { cam.fov = this.cam.fov; cam.updateProjectionMatrix(); }
  }

  // ---------- người đi bộ (người chơi, Tú) ----------
  walk(body, character, sync, target, speed = 1.4) {
    character.enableLocomotion?.(0.15);
    this.track((dt) => {
      const p = body.position, d = new THREE.Vector3(target.x - p.x, 0, target.z - p.z);
      const len = d.length(), step = speed * dt;
      if (len <= Math.max(step, 0.02)) { p.x = target.x; p.z = target.z; character.setSpeed(0); character.update(dt); sync(); return false; }
      p.addScaledVector(d, step / len);
      character.faceDir(d, dt, 8);
      character.setSpeed(speed);
      character.update(dt);
      sync();
      return true;
    });
  }

  // cánh cửa xoay từ góc hiện tại tới `to` (rad) trong `sec` giây
  swingDoor(door, to, sec) {
    const from = yAngle(door.quaternion);
    let k = 0;
    this.track((dt) => {
      k = Math.min(1, k + dt / Math.max(sec, 1e-3));
      door.quaternion.setFromAxisAngle(UP, THREE.MathUtils.lerp(from, to, THREE.MathUtils.smoothstep(k, 0, 1)));
      return k < 1;
    });
  }

  // ---------- kịch bản ----------
  async run() {
    hud.cinematic(true);
    hud.skip(true, () => this.skip());
    try {
      await this.board();
      await this.depart();
      await this.ride();
      await this.arrive();
    } finally {
      await this.finish();
    }
  }

  // 1. người chơi + Tú đi tới cửa xe số 2, tối nhẹ khi bước lên, cửa đóng
  async board() {
    if (this.skipped) return;
    const g = this.game, z = g.zone, c = this.cfg, T = this.T;
    this.mark("board");
    const p = g.player, tu = g.follower;
    const door = worldPos(z.nodes.get(c.door_point)).setY(p.position.y);
    this.shot(z.nodes.get(c.cams[0]));
    this.walk(p.body, p.character, () => p.sync(), door);
    if (tu) {
      tu.stopWaiting();
      const spot = door.clone().add(new THREE.Vector3(1.0, 0, -0.6));     // sau người chơi một bước, phía vỉa hè
      if (tu.position.distanceTo(spot) > 4) tu.body.teleport(spot.clone().add(new THREE.Vector3(2.4, 0.05, -0.9)));
      this.walk(tu.body, tu.character, () => tu.sync(), spot);
    }
    await this.wait(T.walk);
    if (this.skipped) return;
    await hud.dim(0.6, (T.dim || 0.35) * 1000);
    p.character.root.visible = false;
    if (tu) tu.character.root.visible = false;
    for (const role of c.board_with || []) g.npc(role)?.setHidden(true);
    this.tracks.clear();
    hud.dim(0, (T.dim || 0.35) * 1000);
    const d = z.nodes.get(c.door);
    if (d) this.swingDoor(d, 0, T.door);
    this.mark("door_close");
    await this.wait(T.door + (T.dim || 0.35));
  }

  // 2. xe số 2 chạy khỏi trạm theo PATH_xe_roi_tram, CAM_lenxe_2 → CAM_lenxe_3, mờ dần
  async depart() {
    if (this.skipped) return;
    const g = this.game, z = g.zone, c = this.cfg, T = this.T;
    const bus = z.nodes.get(c.bus), path = new PathTrack(z.nodes.get(c.path));
    if (!bus || path.length <= 0) return;
    this.mark("depart");
    const mv = new Mover(bus, path, 0);
    const acc = c.depart_accel_mps2 || 1.8;
    let tt = 0;
    this.track((dt) => { tt += dt; mv.place(0.5 * acc * tt * tt); return true; });
    this.shot(z.nodes.get(c.cams[1]));
    await this.wait(T.cam2);
    if (this.skipped) return;
    this.mark("cam3");
    this.shot(z.nodes.get(c.cams[2]));
    await this.wait(Math.max(0, T.cam3 - T.fade_out));
    if (this.skipped) return;
    hud.fade(true, T.fade_out * 1000);
    await this.wait(T.fade_out);
    this.tracks.clear();
  }

  // 3. nền tối: thẻ chữ, tải zone_01 phía sau, câu thoại của Tú (đặt balo xuống ghế)
  async ride() {
    if (this.skipped) return;
    const g = this.game, c = this.cfg, a = c.arrive, T = this.T;
    this.mark("card");
    hud.card(t(c.card));
    const loading = g.enterZone(a.zone, a.spawn, { fade: false, silent: true });
    await this.wait(T.card);
    await loading;
    hud.card(null);
    if (this.skipped) return;
    this.prepareArrival();
    this.mark("line");
    await g.runner.run(c.dialogue, { auto: T.line });
  }

  // tư thế đầu của cảnh xuống xe: xe ở đầu đoạn cuối PATH_xe_vao_tram, cửa đóng, người chơi + Tú + chị Huyền (vai thao) khuất
  prepareArrival() {
    if (this.arrival) return this.arrival;
    const g = this.game, z = g.zone, a = this.cfg.arrive;
    const bus = z.nodes.get(a.bus), door = z.nodes.get(a.door), path = new PathTrack(z.nodes.get(a.path));
    const A = { bus, door, path, doorOpen: door ? yAngle(door.quaternion) : 0, riders: [], hidden: [] };
    if (bus && path.length > 0) {
      A.mover = new Mover(bus, path, path.length);
      bus.updateMatrixWorld(true);
      const inv = bus.matrixWorld.clone().invert();
      for (const role of a.ride_along || []) {           // bác tài ngồi trong xe → chạy cùng xe
        const n = g.npc(role);
        if (n) A.riders.push({ n, local: n.character.root.position.clone().applyMatrix4(inv), yaw: n.character.root.rotation.y, home: n.character.root.position.clone() });
      }
      A.D = Math.min(a.last_m || 18, path.length);
      A.mover.place(path.length - A.D);
      this.moveRiders(A);
    }
    if (door) door.quaternion.setFromAxisAngle(UP, 0);
    g.player.character.root.visible = false;
    if (g.follower) g.follower.character.root.visible = false;
    for (const role of a.off_before_us || []) { const n = g.npc(role); if (n) { n.setHidden(true); A.hidden.push(n); } }
    this.arrival = A;
    return A;
  }
  moveRiders(A) {
    const turn = yAngle(A.bus.quaternion) - yAngle(A.mover.restQuat);
    for (const r of A.riders) {
      r.n.character.root.position.copy(r.local).applyMatrix4(A.bus.matrixWorld);
      r.n.character.root.rotation.y = r.yaw + turn;
    }
  }

  // 4. xe chạy vào trạm, dừng, cửa mở; người chơi + Tú bước xuống; camera về góc chơi
  async arrive() {
    if (this.skipped) return;
    const g = this.game, z = g.zone, a = this.cfg.arrive, T = this.T;
    const A = this.prepareArrival();
    this.mark("arrive");
    const from = z.nodes.get(a.camera_from);
    this.cam = {
      pos: worldPos(from).add(new THREE.Vector3(...(a.camera_offset || [-7, 1.6, -3]))),
      look: worldPos(from).add(new THREE.Vector3(0, 1.4, 0)), fov: a.camera_fov_deg || 50, track: A.bus,
    };
    this.look.copy(this.lookTarget());
    hud.fade(false, 600);
    if (A.mover) {
      const v0 = a.speed_mps || 9, acc = (v0 * v0) / (2 * A.D), dur = v0 / acc, s0 = A.path.length - A.D;
      let tt = 0;
      this.track((dt) => {
        tt = Math.min(dur, tt + dt);
        A.mover.place(s0 + v0 * tt - 0.5 * acc * tt * tt);
        this.moveRiders(A);
        return tt < dur;
      });
      await this.wait(dur);
      if (this.skipped) return;
      A.mover.restore();
      this.moveRiders(A);
    }
    this.mark("door_open");
    this.cam.track = null;
    this.cam.look = this.look.clone();
    if (A.door) this.swingDoor(A.door, A.doorOpen, T.door_open);
    await this.wait(T.door_open);
    if (this.skipped) return;
    this.mark("step_out");
    for (const n of A.hidden) n.setHidden(false);
    const spawn = worldPos(z.spawns.get(a.spawn));
    const p = g.player;
    p.body.teleport(spawn.clone().add(new THREE.Vector3(0, 0.05, 0.5)));      // từ bậc cửa (phía xe = +Z glTF)
    p.character.root.visible = true;
    p.sync();
    this.walk(p.body, p.character, () => p.sync(), spawn, 1.2);
    await this.wait(T.step_out);
    if (this.skipped) return;
    if (g.follower) {
      g.follower.character.root.visible = true;
      g.follower.placeNear(p, { view: g.camera.position, collider: z.collider, obstacles: g.npcs.map((n) => n.capsule()).filter(Boolean) });
    }
    // về camera chơi (đã chọn hướng thoáng lúc tải zone)
    this.mark("blend");
    const cam = g.camera;
    const fromPos = cam.position.clone(), fromQuat = cam.quaternion.clone(), fromFov = cam.fov;
    g.cam.update(0, p.position, { dx: 0, dy: 0, wheel: 0 }, z.collider, true);
    this.blend = { fromPos, fromQuat, fromFov, toPos: cam.position.clone(), toQuat: cam.quaternion.clone(), k: 0, dur: T.blend || 0.8 };
    cam.position.copy(fromPos); cam.quaternion.copy(fromQuat);
    await this.wait(T.blend);
  }

  // trạng thái cuối (cả khi Skip): zone_01, xe đỗ đúng chỗ, cửa mở, người chơi + Tú ở cửa xe, cờ/quest đã bật
  async finish() {
    const g = this.game, c = this.cfg, a = c.arrive;
    this.stage = "finish";
    this.tracks.clear();
    hud.card(null);
    let dark = false;
    if (g.state.zone !== a.zone) {
      dark = true;
      await hud.fade(true, 250);
      await g.enterZone(a.zone, a.spawn, { fade: false, silent: true });
    }
    const A = this.arrival;
    if (A) {
      A.mover?.restore();
      if (A.door) A.door.quaternion.setFromAxisAngle(UP, A.doorOpen);
      for (const r of A.riders) { r.n.character.root.position.copy(r.home); r.n.character.root.rotation.y = r.yaw; }
      for (const n of A.hidden) n.setHidden(false);
    }
    if (c.effects) g.applyEffects(c.effects);
    const p = g.player;
    if (this.skipped || !p.character.root.visible) {
      p.spawn(worldPos(g.zone.spawns.get(a.spawn)), g.zone.spawns.get(a.spawn)?.userData.yaw_deg ?? 0);
      p.character.root.visible = true;
    }
    p.character.enableLocomotion();
    if (g.follower) {
      g.follower.character.root.visible = true;
      g.follower.character.enableLocomotion();
      if (this.skipped) g.follower.placeNear(p, { collider: g.zone.collider, obstacles: g.npcs.map((n) => n.capsule()).filter(Boolean) });
    }
    this.blend = null;
    this.cam = null;
    g.camera.fov = FOV;
    g.camera.updateProjectionMatrix();
    g.cam.update(0, p.position, { dx: 0, dy: 0, wheel: 0 }, g.zone.collider, true);
    hud.skip(false);
    hud.cinematic(false);
    hud.dim(0, 0);
    if (dark || this.skipped) await hud.fade(false, 400);
    hud.zoneCard(a.zone);
    g.updateObjective();
    g.persist();
    this.mark("done");
  }
}
