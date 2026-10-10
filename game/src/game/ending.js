// Cảnh kết (data/cutscenes.json → ending, GDD mục Kết thúc), ~1 phút, Skip / Esc:
//   1. 17:30: app báo hết giờ, Lan ghé bàn ("Time to head home…") — chỉ khi đang ở zone_05 (thử bằng __game.finish() ở
//      zone khác thì bỏ qua đoạn này)
//   2. màn tối: thẻ "17:30 · Time to head home", tải zone_01 với ánh sáng hoàng hôn (zones.json → variants, cờ game_complete)
//   3. Tú chạy tới bến xe; lời Tú theo số lần đã giúp Tú (dialogues.json → ending_tu)
//   4. người chơi + Tú bước lên xe, cửa đóng → Game.finishGame hiện thẻ thành tựu cuối rồi màn tổng kết
// Dùng lại khung Cutscene (thời gian game, track, camera, Skip).
import * as THREE from "three";
import { Cutscene } from "./cutscene.js";
import { hud } from "../ui/hud.js";
import { t } from "../i18n.js";
import { worldPos } from "../world/zone.js";
import { sound } from "../core/sound.js";   // tiếng báo 17:30 (lời báo nằm ở đầu hội thoại ending_lan, kiểu tin nhắn app)
// tiếng máy xe bus nổ máy chờ ở bến (cutscenes.json → ending.bus_stop.bus) từ lúc tới bến tới hết cảnh

const UP = new THREE.Vector3(0, 1, 0);
const V = (a) => new THREE.Vector3(...a);

export class Ending extends Cutscene {
  async run() {
    hud.cinematic(true);
    hud.skip(true, () => this.skip());
    try {
      await this.office();
      await this.toBusStop();
      await this.tuArrives();
      await this.board();
    } finally {
      await this.finish();
    }
  }

  // nhân vật chạy animation mỗi khung (đứng yên / nói) khi không có track đi bộ
  keepAlive(...chars) { this.track((dt) => { for (const c of chars) c?.update(dt); return true; }); }
  face(character, target) {
    const r = character.root.position;
    character.root.rotation.y = Math.atan2(target.x - r.x, target.z - r.z);
  }

  // 1. văn phòng 17:30: Lan đứng cạnh bàn intern, nói lời chào về
  async office() {
    const g = this.game, c = this.cfg.office || {};
    const lan = g.npc(c.colleague);
    if (this.skipped || g.state.zone !== c.zone || !lan) return;
    this.mark("alarm");
    sound.play("phone");
    await hud.fade(true, 400);
    // người chơi (đang ngồi làm việc → đứng dậy trong màn tối) đứng trước bàn (chỗ ngồi), Lan đứng phía lối đi
    const p = g.player, seat = worldPos(g.zone.spawns.get(c.seat));
    p.leaveSeat();
    p.body.teleport(seat.clone().add(V(c.player_offset || [0, 0, -0.55])).add(V([0, 0.05, 0])));
    p.velocity.set(0, 0, 0);
    p.character.enableLocomotion();
    p.character.setSpeed(0);
    p.sync();
    const lanPos = seat.clone().add(V(c.colleague_offset || [1.0, 0, -1.2]));
    lan.state = "idle";
    lan.lift = 0;
    lan.character.root.position.copy(lanPos);
    lan.character.play("idle", { fade: 0 });
    this.face(lan.character, p.position);
    this.face(p.character, lanPos);
    const mid = p.position.clone().lerp(lanPos, 0.5);
    this.cam = { pos: mid.clone().add(V(c.camera_offset || [2.2, 1.6, -2.8])), look: mid.clone().add(V([0, 1.15, 0])), fov: c.camera_fov_deg || 45, track: null };
    this.look.copy(this.cam.look);
    this.keepAlive(p.character);
    await hud.fade(false, 500);
    await this.wait(0.4);
    if (this.skipped) return;
    this.mark("lan");
    lan.state = "talking";
    const cast = {
      speak: (anim, speaker) => { if (speaker === c.colleague) lan.speak(anim); },
      listen: () => lan.listen(),
    };
    lan.character.play("talk");
    await g.runner.run(c.dialogue, { npc: cast });
    lan.state = "idle";
    lan.character.play("idle", { fade: 0.3 });
  }

  // 2. màn tối, thẻ chữ, tải bến xe zone_01 lúc hoàng hôn
  async toBusStop() {
    if (this.skipped) return;
    const g = this.game, b = this.cfg.bus_stop;
    this.mark("card");
    await hud.fade(true, 700);
    this.tracks.clear();
    hud.card(t(this.cfg.card));
    const loading = g.enterZone(b.zone, b.spawn, { fade: false, silent: true });
    await this.wait(this.T.card || 2.2);
    await loading;
    hud.card(null);
  }

  // 3. Tú chạy tới bến xe (từ phía cổng F-Ville), nói lời tạm biệt theo số lần đã giúp
  async tuArrives() {
    if (this.skipped) return;
    const g = this.game, z = g.zone, b = this.cfg.bus_stop, T = this.T;
    const p = g.player, tu = g.follower;
    const spawn = worldPos(z.spawns.get(b.spawn));
    this.startEngine(z.nodes.get(b.bus));
    this.face(p.character, spawn.clone().add(V(b.tu_from)));
    this.cam = { pos: spawn.clone().add(V(b.camera_offset)), look: spawn.clone().add(V(b.camera_look || [1.5, 1.2, 0])), fov: b.camera_fov_deg || 50, track: null };
    this.look.copy(this.cam.look);
    if (tu) {
      tu.character.root.visible = true;
      tu.body.teleport(spawn.clone().add(V(b.tu_from)).add(V([0, 0.05, 0])));
      tu.sync();
    }
    this.keepAlive(p.character);
    hud.fade(false, 700);
    this.mark("tu_run");
    if (tu) {
      const spot = spawn.clone().add(V(b.tu_to));
      this.walk(tu.body, tu.character, () => tu.sync(), spot, b.tu_speed_mps || 3.6);
      await this.wait(T.tu_run || 3.2);
      if (this.skipped) return;
      this.face(tu.character, p.position);
      this.face(p.character, tu.position);
      tu.character.enableLocomotion();
      this.keepAlive(tu.character);
    }
    this.mark("tu_line");
    const cast = { speak: (anim) => tu?.speak(anim), listen: () => tu?.listen() };
    if (tu) tu.speak(null);
    await g.runner.run(this.cfg.dialogue, { npc: cast });
    if (tu) tu.endTalk();
  }

  // 4. lên xe: người chơi + Tú đi tới cửa, tối nhẹ, khuất vào xe, cửa đóng
  async board() {
    if (this.skipped) return;
    const g = this.game, z = g.zone, b = this.cfg.bus_stop, T = this.T;
    const p = g.player, tu = g.follower;
    this.tracks.clear();
    this.mark("board");
    const door = worldPos(z.spawns.get(b.spawn)).add(V(b.door_offset || [0, 0, 0.6]));
    this.walk(p.body, p.character, () => p.sync(), door, 1.4);
    if (tu) this.walk(tu.body, tu.character, () => tu.sync(), door.clone().add(V([0.9, 0, -0.5])), 1.4);
    await this.wait(T.walk || 1.6);
    if (this.skipped) return;
    await hud.dim(0.6, 350);
    p.character.root.visible = false;
    if (tu) tu.character.root.visible = false;
    this.tracks.clear();
    hud.dim(0, 350);
    const d = z.nodes.get(b.door);
    if (d) this.swingDoor(d, 0, T.door || 0.8);
    this.mark("door_close");
    await this.wait((T.door || 0.8) + (T.hold || 1.2));
  }

  // trạng thái cuối (cả khi Skip): zone_01 hoàng hôn, người chơi + Tú đứng ở cửa xe, camera chơi
  async finish() {
    const g = this.game, b = this.cfg.bus_stop;
    this.stage = "finish";
    this.tracks.clear();
    this.stopEngine(3);
    hud.card(null);
    if (g.runner.active) g.runner.abort();
    await hud.fade(true, 400);
    if (g.state.zone !== b.zone) await g.enterZone(b.zone, b.spawn, { fade: false, silent: true });
    const z = g.zone, p = g.player, spawn = z.spawns.get(b.spawn);
    const door = z.nodes.get(b.door);
    if (door && this.doorRest !== undefined) door.quaternion.setFromAxisAngle(UP, this.doorRest);
    p.spawn(worldPos(spawn), spawn?.userData.yaw_deg ?? 0);
    p.character.root.visible = true;
    p.character.enableLocomotion();
    if (g.follower) {
      g.follower.character.root.visible = true;
      g.follower.character.enableLocomotion();
      g.follower.endTalk();
      g.follower.placeNear(p, { collider: z.collider, obstacles: g.npcs.map((n) => n.capsule()).filter(Boolean) });
    }
    this.blend = null;
    this.cam = null;
    g.camera.fov = 60;
    g.camera.updateProjectionMatrix();
    g.cam.behind(spawn?.userData.yaw_deg ?? 0);
    g.cam.update(0, p.position, { dx: 0, dy: 0, wheel: 0 }, z.collider, true, z.view);
    hud.skip(false);
    hud.cinematic(false);
    hud.dim(0, 0);
    g.applyVariant();
    g.updateObjective();
    g.persist();
    await hud.fade(false, 600);
    this.mark("done");
  }

  // cửa xe zone_01: GLB để mở sẵn → nhớ góc mở để trả lại sau khi đóng trong cảnh lên xe
  swingDoor(door, to, sec) {
    if (this.doorRest === undefined) this.doorRest = 2 * Math.atan2(door.quaternion.y, door.quaternion.w);
    super.swingDoor(door, to, sec);
  }
}
