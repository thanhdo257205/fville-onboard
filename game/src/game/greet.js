// Chào hỏi lịch sự khi gặp một NPC lần đầu (hiệu ứng lời thoại "greet" — vd anh Prajith, zone 5):
//   NPC (đã đứng dậy khi bắt chuyện) bước ra chỗ trống npc_at, quay về phía người chơi → người chơi bước tới đứng đối diện, cách
//   gap_m (hai bàn tay gặp nhau giữa chừng clip "handshake") → người chơi cúi chào ("bow"), NPC gật đầu đáp → cả hai bắt tay
//   ("handshake", phát cùng lúc) → nói chuyện tiếp. Hội thoại xong NPC đi về chỗ cũ rồi mới ngồi (Npc.returnTo).
// Clip bow / handshake: scripts/blender/characters/build_reach.py --clip … (Mixamo "Quick Formal Bow", "Shaking Hands 2").
// Trong lúc chào: NPC ở trạng thái "greeting" (câu thoại không đổi animation của NPC); người chơi đứng yên (đang hội thoại).
import * as THREE from "three";

const clipOf = (ch, name) => ch?.actions[ch.model.animations?.[name] ?? name] ? name : null;

export class Greeter {
  constructor(game) { this.g = game; this.token = null; this.log = []; }

  info() { return { active: !!this.token, log: this.log.slice(-10) }; }

  stop() { this.token = null; }

  // cfg: { who, npc_path: [[x, z], …] (đi vòng qua bàn — glTF), npc_at: [x, z] (chỗ đứng chào), face: [x, z] (hướng NPC nhìn
//   khi chào), gap_m, side_m }
  async run(cfg) {
    const g = this.g, n = g.npc(cfg.who), pl = g.player, pc = pl?.character, nc = n?.character;
    if (!n || !pc || !nc) return;
    const token = (this.token = {});
    const alive = () => this.token === token && !nc.disposed && !pc.disposed;
    const frame = () => new Promise((r) => setTimeout(r, 40));
    this.log.push(`start:${cfg.who}`);
    // 1) NPC bước ra chỗ trống (đã đứng dậy ở Npc.engage)
    while (n.state === "standing_up" || n.state === "turning") { await frame(); if (!alive()) return; }
    n.returnTo ??= nc.root.position.clone();
    const y = nc.root.position.y, pts = (cfg.npc_path || []).map(([x, z]) => new THREE.Vector3(x, y, z));
    const A = new THREE.Vector3(cfg.npc_at[0], y, cfg.npc_at[1]);
    n.returnPath = pts.slice().reverse();                               // về chỗ cũ theo đường ngược lại (Npc.release)
    await n.walkPath([...pts, A]);
    if (!alive()) return;
    n.state = "greeting";
    const f = new THREE.Vector3(cfg.face[0], 0, cfg.face[1]).normalize();
    await n.turnTo(Math.atan2(f.x, f.z));
    if (!alive()) return;
    // 2) người chơi đứng đối diện, cách gap_m; lệch side_m sang phải người chơi (tay phải hai người cùng hơi lệch về trái mỗi người)
    const right = new THREE.Vector3(f.z, 0, -f.x);                      // bên phải của người chơi (người chơi nhìn ngược f)
    const B = A.clone().addScaledVector(f, cfg.gap_m ?? 1.08).addScaledVector(right, cfg.side_m ?? 0.1);
    if (!(await g.idCard.stepToPoint(B, 0, 700, { force: true })) || !alive()) return;   // đi bộ tới B
    g.faceTarget = A.clone();
    for (let k = 0; k < 10; k++) { await frame(); if (!alive()) return; }
    // 3) cúi chào — NPC gật đầu đáp
    this.log.push("bow");
    const bow = clipOf(pc, "bow") ? pc.playOnce("bow", { fade: 0.25 }) : Promise.resolve();
    setTimeout(() => { if (alive() && clipOf(nc, "nod")) nc.playOnce("nod", { fade: 0.25 }); }, 700);
    await bow;
    if (!alive()) return;
    // 4) bắt tay (cùng lúc)
    this.log.push("handshake");
    const both = [pc, nc].map((c) => (clipOf(c, "handshake") ? c.playOnce("handshake", { fade: 0.3 }) : Promise.resolve()));
    await Promise.all(both);
    if (!alive()) return;
    // 5) nói chuyện tiếp
    pc.enableLocomotion(0.3);
    n.state = "talking";
    this.log.push("done");
    this.token = null;
    if (g.mode === "dialogue" && g.talkPartner === n) nc.play("talk", { fade: 0.3 });
    else n.release();                                                  // hội thoại đã đóng trong lúc chào → về chỗ, ngồi
  }
}
