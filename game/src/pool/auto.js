// Chọn cú tự động (kiểm thử: scripts/tests/pool_rules.mjs, __game.pool.autoShot trong smoke test 2 người) — không phải
// đối thủ máy trong game. Tất định (simulateShot): cùng bàn → cùng cú.
//   1. bi mục tiêu × lỗ: nhắm "bi ma" (tâm bi trắng chạm bi mục tiêu đúng hướng ra lỗ), thử vài mức lực → cú đưa được bi
//      mục tiêu vào lỗ, bi trắng không rơi, không vào bi 8 (trừ khi bi 8 là mục tiêu)
//   2. không có: quét góc quanh bi mục tiêu gần nhất (findPottingShot, thô)
//   3. vẫn không: đánh nhẹ vào bi mục tiêu gần nhất
import { simulateShot, findPottingShot, angleTo } from "./physics.js";

export function pickShot(table, state, targets, { powers = [0.32, 0.5, 0.7] } = {}) {
  const cue = state.balls[0], r = table.r;
  const balls = targets.map((n) => state.balls[n]).filter((b) => b?.on)
    .sort((a, b) => (a.x - cue.x) * (a.x - cue.x) + (a.z - cue.z) * (a.z - cue.z) - ((b.x - cue.x) * (b.x - cue.x) + (b.z - cue.z) * (b.z - cue.z)));
  if (!cue.on || !balls.length) return { angle: Math.PI / 2, power: 0.5, how: "none" };
  const good = (res, n) => res.pocketed.includes(n) && !res.cueScratch && (n === 8 || !res.pocketed.includes(8));
  for (const b of balls) {
    for (const p of table.pockets) {
      const dx = p.x - b.x, dz = p.z - b.z, len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-6) continue;
      const gx = b.x - (dx / len) * 2 * r, gz = b.z - (dz / len) * 2 * r;
      const angle = angleTo(cue.x, cue.z, gx, gz);
      for (const power of powers) {
        if (good(simulateShot(table, state, { angle, power }, { frames: false }), b.n)) return { angle, power, how: "ghost", ball: b.n };
      }
    }
  }
  const near = balls[0];
  const found = findPottingShot(table, state, near.n, { spread: 0.25, stepRad: 0.01, powers: [0.35, 0.55] });
  if (found) return { ...found, how: "sweep", ball: near.n };
  return { angle: angleTo(cue.x, cue.z, near.x, near.z), power: 0.45, how: "nudge", ball: near.n };
}
