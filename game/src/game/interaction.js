// Tương tác (data/interactables.json): đứng trong 'radius' (m, đo ngang; mặc định default_radius = 2) hoặc trong hộp
// 'area' (TRIGGER_) của một đối tượng còn dùng được → hiện gợi ý phím E. 'object' = vật do code đặt (vd chiếc ví),
// 'actor' = nhân vật do code đặt (vd Tú). Chọn đối tượng gần nhất.
import * as THREE from "three";
import { inTrigger, worldPos } from "../world/zone.js";
import { blocked } from "../world/collision.js";
import { tx } from "../content/content.js";

const IN_AREA_D = 1.0;  // m
const MAX_DY = 3.0;   // chênh cao tối đa (vd biển số tuyến trên kính lái xe bus ~3 m)

const GOLD = new THREE.MeshToonMaterial({ color: 0xf2c14e, emissive: 0x8a5a00, emissiveIntensity: 0.55 });

// hạt lúa vàng: hạt thóc thuôn + vầng sáng nhẹ (dễ thấy từ xa)
function makeGrain() {
  const g = new THREE.Group();
  const seed = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), GOLD);
  seed.scale.set(0.75, 1.6, 0.75);
  seed.rotation.z = 0.5;
  seed.position.y = 0.16;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.22, depthWrite: false }));
  glow.position.y = 0.16;
  glow.userData.outlineParameters = { visible: false };
  glow.material.userData.outlineParameters = { visible: false };
  g.add(seed, glow);
  g.userData.spin = seed;
  return g;
}

// hũ thủy tinh ở Phòng Hạt Lúa: bệ gỗ + hũ trong + nắp; hạt lúa bên trong = số đã nhặt (setJarCount)
function makeJar() {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 12), new THREE.MeshToonMaterial({ color: 0xc98a4b }));
  stand.position.y = 0.45;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 18, 1, true),
    new THREE.MeshToonMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 1.07;
  glass.material.userData.outlineParameters = { visible: false };
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 18), new THREE.MeshToonMaterial({ color: 0x8a5a3c }));
  lid.position.y = 1.265;
  const grains = new THREE.Group();
  grains.position.y = 0.92;
  g.add(stand, glass, lid, grains);
  g.userData.grains = grains;
  return g;
}
function setJarCount(jar, n) {
  const box = jar.userData.grains;
  while (box.children.length < n) {
    const i = box.children.length;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), GOLD);
    s.scale.set(0.75, 1.5, 0.75);
    const a = i * 2.4, r = 0.03 + 0.09 * ((i * 7) % 10) / 10;
    s.position.set(Math.cos(a) * r, 0.03 + Math.floor(i / 4) * 0.045, Math.sin(a) * r);
    s.rotation.set(i, i * 0.7, 0.6);
    box.add(s);
  }
  while (box.children.length > n) box.remove(box.children[box.children.length - 1]);
}

// vật code đặt: model đơn giản
function makeObject(kind) {
  if (kind === "grain") return makeGrain();
  if (kind === "jar") return makeJar();
  if (kind === "wallet") {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.09), new THREE.MeshToonMaterial({ color: 0x6b3f24 }));
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.027, 0.092), new THREE.MeshToonMaterial({ color: 0xc89a5a }));
    strap.position.x = 0.035;
    g.add(body, strap);
    g.rotation.y = 0.5;
    return g;
  }
  return new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshToonMaterial({ color: 0xffcc00 }));
}

// Mặt trên thật (mesh hiển thị, không phải hộp COL_) trong vùng của node neo: chiếu tia xuống lưới 5×5,
// lấy điểm có độ cao trong [surface_min, surface_max] gần tâm nhất (vd mặt đôn ~0,45 m, không phải đỉnh hộp va chạm).
function surfaceOn(zone, anchor, it) {
  const box = new THREE.Box3().setFromObject(anchor);
  if (box.isEmpty()) return worldPos(anchor);
  const meshes = [];
  zone.root.traverse((o) => { if (o.isMesh && o.visible && !o.name.startsWith("COL_")) meshes.push(o); });
  const c = box.getCenter(new THREE.Vector3());
  const rc = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const lo = it.surface_min ?? 0.25, hi = it.surface_max ?? 0.9;
  let best = null;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    const x = THREE.MathUtils.lerp(box.min.x, box.max.x, i / 4), z = THREE.MathUtils.lerp(box.min.z, box.max.z, j / 4);
    rc.set(new THREE.Vector3(x, box.max.y + 1, z), down);
    const h = rc.intersectObjects(meshes, false)[0];
    if (!h || h.point.y < lo || h.point.y > hi) continue;
    const d = Math.hypot(x - c.x, z - c.z);
    if (!best || d < best.d) best = { p: h.point.clone(), d };
  }
  return best ? best.p : new THREE.Vector3(c.x, box.max.y, c.z);
}

// điểm trên mặt hiển thị gần nhất phía dưới p (vd hạt lúa đặt trên bờ tường, chiếu nghỉ cầu thang); không có thì giữ p
function surfaceAt(zone, p, snap) {
  if (!snap) return p.clone();
  const meshes = [];
  zone.root.traverse((o) => { if (o.isMesh && o.visible && !o.name.startsWith("COL_")) meshes.push(o); });
  const rc = new THREE.Raycaster(p.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(0, -1, 0), 0, 4);
  const h = rc.intersectObjects(meshes, false)[0];
  return h ? h.point.clone() : p.clone();
}

export class Interaction {
  constructor(game, content) {
    this.game = game;
    this.c = content;
    this.list = [];
    this.current = null;
  }

  setup(zone, scene) {
    for (const x of this.list) x.mesh?.removeFromParent();
    this.list = [];
    for (const it of this.c.interactables) {
      if (it.zone !== zone.id) continue;
      const e = { item: it, radius: it.radius ?? this.c.defaultRadius, pos: null, trigger: null, mesh: null };
      if (it.area) e.trigger = zone.triggers.find((t) => t.name === it.area) || null;
      if (it.node && zone.nodes.has(it.node)) e.pos = worldPos(zone.nodes.get(it.node));
      if (it.at) e.pos = new THREE.Vector3(...it.at);          // điểm tương tác riêng (vd cửa xe thay cho tâm xe)
      if (it.object) {
        if (it.pos) e.pos = surfaceAt(zone, new THREE.Vector3(...it.pos), it.snap !== false);   // toạ độ glTF, rơi xuống mặt thật
        else {
          const a = zone.nodes.get(it.anchor);
          if (!a) continue;
          e.pos = surfaceOn(zone, a, it).add(new THREE.Vector3(...(it.offset || [0, 0, 0])));
        }
        e.mesh = makeObject(it.model);
        e.mesh.position.copy(e.pos);
        if (it.yaw_deg) e.mesh.rotation.y = THREE.MathUtils.degToRad(it.yaw_deg);
        e.mesh.name = `object_${it.object}`;
        scene.add(e.mesh);
      }
      this.list.push(e);
    }
    this.refresh();
  }

  // ẩn vật code đặt khi đã dùng xong (vd ví đã nhặt, hạt lúa đã nhặt); hũ thủy tinh hiện số hạt đã nhặt
  refresh() {
    for (const e of this.list) {
      if (!e.mesh) continue;
      e.mesh.visible = !(e.item.hide_if && this.hideMatch(e.item.hide_if));
      if (e.item.model === "jar") setJarCount(e.mesh, this.game.progress.grains.size);
    }
  }
  hideMatch(cond) {
    // hide_if: ẩn khi BẤT KỲ cờ/quest/phần thưởng/hạt lúa nào trong danh sách đã có
    const s = this.game.progress;
    return (cond.flags || []).some((f) => s.flags.has(f)) || (cond.quests || []).some((q) => s.quests.has(q))
      || (cond.rewards || []).some((r) => s.hasReward(r)) || (cond.grains || []).some((g) => s.grains.has(g));
  }
  // hạt lúa xoay + nhấp nhô nhẹ
  animate(dt) {
    this.t = (this.t || 0) + dt;
    for (const e of this.list) {
      const s = e.mesh?.userData.spin;
      if (!s || !e.mesh.visible) continue;
      s.rotation.y += dt * 1.6;
      e.mesh.position.y = e.pos.y + 0.04 * Math.sin(this.t * 2.2 + e.pos.x);
    }
  }
  available(e) {
    const it = e.item;
    if (it.hide_if && this.hideMatch(it.hide_if)) return false;
    return this.game.progress.check(it.requires);
  }

  actorPos(e) {
    if (e.item.actor === "tu") return this.game.follower?.position;
    return e.pos;
  }

  update(playerPos) {
    let best = null, bestD = Infinity;
    const p = playerPos.clone().setY(playerPos.y + 0.9);
    for (const e of this.list) {
      if (!this.available(e)) continue;
      let d = Infinity;
      const pos = this.actorPos(e);
      const h = pos ? Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z) : Infinity;
      // đứng trong vùng (area) = trong tầm, tính như cách tối đa 1 m → vật nhỏ sát chân (vd hạt lúa cạnh quầy lễ tân) vẫn được chọn
      if (e.trigger && inTrigger(e.trigger, p)) d = Math.min(h, IN_AREA_D);
      if (pos && Math.abs(pos.y - playerPos.y) <= MAX_DY && h <= e.radius) d = Math.min(d, h);
      if (d < bestD && !this.hiddenPerson(e, playerPos)) { bestD = d; best = e; }
    }
    this.current = best;
    return best ? tx(best.item.prompt) : null;
  }

  // nói chuyện với người (NPC_ / Tú) mà bị COL_ chắn giữa hai người (vd đứng bên kia thân xe) → không hiện lời nhắc.
  // Tia ngang tầm mặt (qua được quầy lễ tân cao 1,1 m); bỏ 0,3 m sát người kia (blocked).
  hiddenPerson(e, playerPos) {
    const it = e.item;
    if (!it.actor && !it.node?.startsWith("NPC_")) return false;
    const who = it.actor === "tu" ? this.game.follower?.character.root.position : this.npcFor(e)?.character.root.position ?? e.pos;
    if (!who) return false;
    const eye = playerPos.clone().setY(playerPos.y + 1.5), face = who.clone().setY(who.y + 1.45);
    return blocked(this.game.zone.collider, eye, face);
  }

  // NPC trong zone ứng với đối tượng (để quay mặt / diễn khi nói)
  npcFor(e) {
    if (!e) return null;
    if (e.item.node?.startsWith("NPC_")) return this.game.npc(e.item.node);
    return null;
  }
}
