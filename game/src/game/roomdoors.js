// Reversible room doors. Rebuild static BVH only at animation endpoints;
// never close a door through the player, follower or an NPC.
import * as THREE from "three";
import { buildCollider } from "../world/collision.js";
import { sound } from "../core/sound.js";
import { hud } from "../ui/hud.js";
import { t } from "../i18n.js";

export class RoomDoors {
  constructor(game) { this.g = game; this.list = []; }
  setup() {
    const g = this.g, zone = g.zone;
    this.list = (g.data.sceneFixes?.[zone.id]?.room_doors || []).map(cfg => {
      const node = zone.nodes.get(cfg.leaf), closed = zone.nodes.get(cfg.col_closed), open = zone.nodes.get(cfg.col_open);
      if (!node || !closed || !open) throw new Error(`Incomplete meeting room door: ${cfg.id}`);
      const from = node.quaternion.clone();
      const to = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(cfg.degrees)).multiply(from);
      const sweep = new THREE.Box3().setFromObject(closed).union(new THREE.Box3().setFromObject(open));
      return { cfg, node, closed, open, from, to, sweep, value: 0, target: false, moving: false, collision: closed };
    });
    this.colNames = new Set(this.list.flatMap(d => [d.cfg.col_closed, d.cfg.col_open]));
    if (this.list.length) this.rebuild();
  }
  rebuild() {
    const g = this.g, z = g.zone;
    z.colMeshes = z.colMeshes.filter(m => !this.colNames.has(m.name));
    for (const d of this.list) if (d.collision) z.colMeshes.push(d.collision);
    g.scene.remove(z.collider);
    z.collider.geometry.dispose(); z.collider.material.dispose();
    z.collider = buildCollider(z.colMeshes, g.data.collision?.[z.id]?.add || []);
    g.scene.add(z.collider);
  }
  occupied(d) {
    const g = this.g;
    const people = [g.player?.position, g.follower && !g.follower.gone ? g.follower.position : null,
      ...g.npcs.filter(n => !n.hidden).map(n => n.character.root.position)].filter(Boolean);
    return people.some(p => p.y < d.sweep.max.y && p.y + 1.75 > d.sweep.min.y &&
      p.x > d.sweep.min.x - .35 && p.x < d.sweep.max.x + .35 && p.z > d.sweep.min.z - .35 && p.z < d.sweep.max.z + .35);
  }
  // chỉ người chơi đứng trong vùng cánh cửa quét qua (vd đứng trong phòng sát cửa — cánh mở vào trong) → lùi người chơi ra
  // khỏi vùng đó về phía đang đứng (trong / ngoài phòng) rồi đóng; người khác (Tú, NPC) đứng chắn → không đóng
  onlyPlayer(d) {
    const g = this.g, keep = g.player;
    g.player = null;
    const others = this.occupied(d);
    g.player = keep;
    return !others && this.occupied(d);
  }
  stepOut(d) {
    const p = this.g.player.position, b = d.sweep;
    // pháp tuyến mặt cửa = trục ngang mỏng nhất của hộp cánh đóng; phía đứng so với mặt cửa (tâm cánh đóng — không phải tâm cả
    // vùng quét: cánh mở nằm sâu trong phòng)
    const cb = new THREE.Box3().setFromObject(d.closed), cs = cb.getSize(new THREE.Vector3()), cc = cb.getCenter(new THREE.Vector3());
    const ax = cs.x < cs.z ? "x" : "z", side = Math.sign(p[ax] - cc[ax]) || 1;
    const to = p.clone();
    to[ax] = side > 0 ? b.max[ax] + 0.45 : b.min[ax] - 0.45;
    this.push = { from: p.clone(), to, t: 0, dur: 0.35 };
  }
  toggle(id) {
    const d = this.list.find(d => d.cfg.id === id);
    if (!d) return false;
    if (d.target && this.occupied(d)) {
      if (!this.onlyPlayer(d)) { hud.toast(t("meeting_doors.blocked")); return false; }
      this.stepOut(d);
    }
    d.target = !d.target; d.moving = true; d.collision = null;
    this.rebuild();
    sound.play("door_swing", { pos: d.node.getWorldPosition(new THREE.Vector3()) });
    return true;
  }
  prompt(id) {
    const d = this.list.find(d => d.cfg.id === id);
    return d ? t(d.target ? "meeting_doors.close" : "meeting_doors.open", { room: d.cfg.name }) : "";
  }
  update(dt) {
    let changed = false;
    if (this.push) {                       // người chơi lùi khỏi vùng cánh cửa (đóng cửa từ trong phòng)
      const w = this.push;
      w.t += dt;
      const k = THREE.MathUtils.smoothstep(Math.min(1, w.t / w.dur), 0, 1);
      this.g.player.body.teleport(w.from.clone().lerp(w.to, k));
      this.g.player.sync?.();
      if (k >= 1) this.push = null;
    }
    for (const d of this.list) {
      if (!d.moving) continue;
      // Somebody entered the sweep during closing: reverse, keeping the passage clear (người chơi đang được lùi ra: đợi).
      if (!d.target && !this.push && this.occupied(d)) { d.target = true; hud.toast(t("meeting_doors.blocked")); }
      d.value = THREE.MathUtils.clamp(d.value + (d.target ? 1 : -1) * dt / d.cfg.seconds, 0, 1);
      d.node.quaternion.slerpQuaternions(d.from, d.to, THREE.MathUtils.smootherstep(d.value, 0, 1));
      if (d.value === (d.target ? 1 : 0)) {
        d.moving = false; d.collision = d.target ? d.open : d.closed; changed = true;
      }
    }
    if (changed) this.rebuild();
  }
}
