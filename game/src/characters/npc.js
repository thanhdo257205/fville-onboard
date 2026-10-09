// NPC: đứng hoặc ngồi (pose) tại node. Khi người chơi đến nói chuyện:
//   ngồi → stand_up → quay về phía người chơi → talk (talk/talk_2 luân phiên); xong → quay về hướng cũ → sit_down → sit_type
//   đứng → quay về phía người chơi → talk; xong → quay về hướng cũ → idle
// Gốc nhân vật = điểm đứng. Khi ngồi, animation đưa mông lùi về phía ghế (models.<id>.seat.offset_xz_m, ~0,40 m).
// node_marks "seat": node là CHỖ GHẾ → điểm đứng = node − offset (xoay theo hướng); chair_height_m: nâng nhân vật
// lúc ngồi cho mông chạm mặt ghế thật trong GLB (nâng/hạ dần theo stand_up / sit_down).
import * as THREE from "three";

const TURN_RATE = 6;
const _hip = new THREE.Vector3();

export class Npc {
  constructor(character, { role, node, pos, yaw, pose = "stand", nodeMarks = "stand", chairHeight = null }) {
    Object.assign(this, { character, role, node, pose });
    this.homeYaw = THREE.MathUtils.degToRad(yaw) + Math.PI;   // model nhìn +Z
    const seat = character.model.seat || {};
    const root = pos.clone();
    if (pose === "seated" && nodeMarks === "seat" && seat.offset_xz_m) {
      const [ox, oz] = seat.offset_xz_m, c = Math.cos(this.homeYaw), s = Math.sin(this.homeYaw);
      root.x -= ox * c + oz * s;
      root.z -= -ox * s + oz * c;
    }
    this.baseY = root.y;
    this.lift = pose === "seated" && chairHeight != null && seat.height_m != null ? chairHeight - seat.height_m : 0;
    character.root.position.copy(root);
    character.root.rotation.y = this.homeYaw;
    this.state = "idle";
    this._turn = null;
  }

  start() {
    if (this.pose === "seated") { this.character.play("sit_type", { fade: 0, randomStart: true }); this.state = "seated"; }
    else { this.character.play("idle", { fade: 0, randomStart: true }); this.state = "idle"; }
  }

  // ẩn / hiện (vd hành khách đã lên xe, chị Huyền (vai thao) lên xe trong cảnh chuyển). NPC ẩn không có va chạm.
  get hidden() { return !this.character.root.visible; }
  setHidden(on) { this.character.root.visible = !on; }

  // đi bộ tới điểm (thế giới) rồi gọi done — vd hành khách bước lên cửa xe
  walkTo(target, { speed = 1.2, done = null } = {}) {
    if (this._turn) { const r = this._turn.res; this._turn = null; r(); }   // đang quay mặt (engage) → thôi, đi luôn
    this.state = "walking";
    this.character.enableLocomotion(0.2);
    this._walk = { target: target.clone(), speed, done };
  }

  // capsule va chạm (người chơi / Tú không đi xuyên): tâm theo xương hông → ngồi thì nằm trên ghế
  capsule() {
    if (this.hidden) return null;
    const c = this.character, r = c.root.position;
    let x = r.x, z = r.z;
    if (c.hips) { c.hips.getWorldPosition(_hip); x = _hip.x; z = _hip.z; }
    return { x, z, y: this.baseY, height: c.model.height_m, radius: c.model.collision?.radius_m ?? 0.3 };
  }

  get busy() { return !["idle", "seated", "talking"].includes(this.state); }

  turnTo(angle) { return new Promise((res) => { this._turn = { angle, res }; }); }
  faceAngleTo(p) { const r = this.character.root.position; return Math.atan2(p.x - r.x, p.z - r.z); }

  async engage(playerPos) {
    if (this.state === "talking" || this.busy) return;
    if (this.state === "seated") { this.state = "standing_up"; await this.character.playOnce("stand_up"); }
    this.state = "turning";
    this.character.play("idle", { fade: 0.2 });
    await this.turnTo(this.faceAngleTo(playerPos));
    if (this._walk) return;               // vừa được bảo đi chỗ khác giữa lúc quay (vd người lạ quay về sảnh)
    this.character.play("talk");          // nhóm talk/talk_2 luân phiên
    this.state = "talking";
  }

  // trong hội thoại: NPC nói (talk/talk_2 luân phiên; anim nod|wave|think|point diễn 1 lần rồi nói tiếp) / nghe
  speak(anim) {
    if (this.state !== "talking") return;
    if (anim && this.character.actions[this.character.model.animations[anim] ?? anim]) {
      const token = (this._say = {});
      this.character.playOnce(anim).then(() => { if (this._say === token && this.state === "talking") this.character.play("talk"); });
    } else if (!this.character.group) this.character.play("talk");
  }
  listen() { if (this.state === "talking") { this._say = null; this.character.play("idle", { fade: 0.25 }); } }

  async release() {
    if (this.state !== "talking") return;
    this.state = "turning_back";
    this.character.play("idle", { fade: 0.25 });
    await this.turnTo(this.homeYaw);
    if (this.pose === "seated") {
      this.state = "sitting_down";
      await this.character.playOnce("sit_down");
      this.character.play("sit_type", { fade: 0.2 });
      this.state = "seated";
    } else this.state = "idle";
  }

  // mức "đang ngồi" 0..1 để nâng nhân vật lên mặt ghế
  seatedness() {
    const a = this.character.current;
    const k = a ? a.time / a.getClip().duration : 0;
    switch (this.state) {
      case "seated": return 1;
      case "standing_up": return 1 - k;
      case "sitting_down": return k;
      default: return 0;
    }
  }

  update(dt) {
    if (this._walk) {
      const r = this.character.root.position, w = this._walk;
      const d = new THREE.Vector3(w.target.x - r.x, 0, w.target.z - r.z);
      const len = d.length(), step = w.speed * dt;
      if (len <= step) { r.x = w.target.x; r.z = w.target.z; this._walk = null; this.character.setSpeed(0); this.state = "idle"; w.done?.(); }
      else { r.addScaledVector(d, step / len); this.character.faceDir(d, dt, 8); this.character.setSpeed(w.speed); }
    }
    if (this._turn) {
      const left = this.character.turnToward(this._turn.angle, dt, TURN_RATE);
      if (left < THREE.MathUtils.degToRad(3)) { const r = this._turn.res; this._turn = null; r(); }
    }
    this.character.update(dt);
    if (this.lift) this.character.root.position.y = this.baseY + this.lift * THREE.MathUtils.smoothstep(this.seatedness(), 0, 1);
  }
}
