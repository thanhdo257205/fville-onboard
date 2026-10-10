// Luật 8 bi rút gọn + mã hoá trạng thái bàn — dùng chung cho game (game/src/pool/table.js) và máy chủ chơi nhiều người
// (server/src/pool.js). JS thuần, không three.js; TẤT ĐỊNH như physics.js: chỉ + − × ÷ và Math.round / abs / floor, không
// dùng ** (Math.pow) — máy chủ và mọi máy khách phải ra cùng một bàn.
//
// Luật (docs/CHECKLIST.md → "Bi-a bước 3"):
//   • Người ngồi trước phá bi. Bàn "mở" tới khi có người đưa được bi vào lỗ mà bi trắng không rơi: người đó nhận nhóm của
//     bi vào lỗ đầu tiên — bi trơn 1–7 (solid) hoặc bi sọc 9–15 (stripe); đối thủ nhận nhóm còn lại.
//   • Đánh tiếp khi đưa được bi nhóm mình vào lỗ (bàn mở: bi bất kỳ trừ bi 8) và bi trắng không rơi; không thì đổi lượt.
//   • Lỗi duy nhất: bi trắng rơi lỗ → đổi lượt, đối thủ đặt bi trắng ở khu đầu bàn (giữa băng đầu và vạch đầu bàn z = −rz/2).
//   • Bi 8 cuối cùng: vào lỗ khi nhóm mình đã hết từ trước cú đó và bi trắng không rơi → thắng; vào sớm hoặc kèm bi trắng
//     rơi → thua. Bi 8 vào lỗ ngay cú phá → đặt lại ở điểm chân bàn, chơi tiếp.
//   • Rút gọn: không phạt chạm sai bi trước hay không chạm bi nào (chỉ mất lượt vì không vào bi).
import { cloneState, respotCue } from "./physics.js";

export const SOLID = "solid";
export const STRIPE = "stripe";
export const groupOf = (n) => (n >= 1 && n <= 7 ? SOLID : n >= 9 && n <= 15 ? STRIPE : null);
export const otherGroup = (g) => (g === SOLID ? STRIPE : g === STRIPE ? SOLID : null);
export const ballsLeft = (state, group) => state.balls.reduce((k, b) => k + (b.on && groupOf(b.n) === group ? 1 : 0), 0);

// ---------- làm tròn / mã hoá ----------
// vị trí gửi qua mạng làm tròn 0,01 mm; mọi bên (cả người đánh) lấy bàn đã làm tròn làm điểm xuất phát cú sau → cùng đầu vào
export const round5 = (v) => Math.round(v * 1e5) / 1e5;
export function roundState(state) {
  for (const b of state.balls) { b.x = round5(b.x); b.z = round5(b.z); b.vx = 0; b.vz = 0; }
  return state;
}
// [x0, z0, x1, z1, …] (bi đã vào lỗ: null, null)
export function packBalls(state) {
  const out = [];
  for (const b of state.balls) { if (b.on) out.push(round5(b.x), round5(b.z)); else out.push(null, null); }
  return out;
}
export function unpackBalls(table, arr) {
  return {
    balls: table.rack.map((r, i) => {
      const x = arr?.[i * 2], z = arr?.[i * 2 + 1], on = typeof x === "number" && typeof z === "number";
      return { id: r.id, n: r.n, x: on ? x : r.x, z: on ? z : r.z, vx: 0, vz: 0, on, pocket: null };
    }),
  };
}
export function validPacked(table, arr) {
  if (!Array.isArray(arr) || arr.length !== table.rack.length * 2) return false;
  for (let i = 0; i < arr.length; i += 2) {
    const x = arr[i], z = arr[i + 1];
    if (x === null && z === null) continue;
    if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) > table.rx + 1e-4 || Math.abs(z) > table.rz + 1e-4) return false;
  }
  return true;
}

// ---------- bi trắng trong tay: khu đầu bàn ----------
export function kitchen(table) {
  return { x0: -table.rx + table.r, x1: table.rx - table.r, z0: -table.rz + table.r, z1: -table.rz / 2 };
}
export function canPlaceCue(table, state, x, z) {
  const k = kitchen(table);
  if (!(x >= k.x0 && x <= k.x1 && z >= k.z0 && z <= k.z1)) return false;      // NaN → false
  const d2 = 4 * table.r * table.r;
  return state.balls.every((b) => b.n === 0 || !b.on || (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) >= d2);
}
export function placeCue(state, x, z) {
  Object.assign(state.balls[0], { x: round5(x), z: round5(z), vx: 0, vz: 0, on: true, pocket: null });
  return state;
}

// đặt lại bi n (bi 8 vào lỗ lúc phá) ở điểm chân bàn (đỉnh tam giác xếp bi); bị chiếm thì lùi dần về phía băng chân bàn,
// rồi về phía giữa bàn
export function respotBall(table, state, n) {
  const b = state.balls[n], foot = table.rack[1] || { x: 0, z: table.rz / 2 };
  const d2 = 4.4 * table.r * table.r, step = 2.2 * table.r;
  const free = (x, z) => state.balls.every((o) => o === b || !o.on || (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) >= d2);
  for (const dir of [1, -1]) {
    for (let k = 0; k < 40; k++) {
      const z = foot.z + dir * k * step;
      if (z > table.rz - table.r || z < -table.rz + table.r) break;
      if (free(foot.x, z)) { Object.assign(b, { x: foot.x, z, vx: 0, vz: 0, on: true, pocket: null }); return b; }
    }
  }
  Object.assign(b, { x: foot.x, z: foot.z, vx: 0, vz: 0, on: true, pocket: null });
  return b;
}

// ---------- ván ----------
// m = { mode: "idle" | "solo" | "match" | "over", turn: ghế đang đánh (0 | 1), groups: [nhóm ghế 0, nhóm ghế 1] (null = bàn mở),
//       inHand: người đánh tiếp được đặt bi trắng ở khu đầu bàn, brk: cú tiếp theo là cú phá, winner: ghế thắng, reason }
export const idleMatch = (mode = "idle") => ({ mode, turn: 0, groups: [null, null], inHand: false, brk: false, winner: null, reason: null });
export const newMatch = (breaker) => ({ mode: "match", turn: breaker, groups: [null, null], inHand: false, brk: true, winner: null, reason: null });

// cú đánh xong → áp luật. before: bàn trước cú (đã đặt bi trắng nếu có bi trong tay); after: bàn sau cú; shot: { pocketed: [n]
// theo thứ tự vào lỗ, scratch }. → { m: trạng thái ván mới, state: bàn sau khi đặt lại bi trắng / bi 8, ev: sự kiện cho giao diện }
// reason khi hết ván: "eight" (vào bi 8 hợp lệ), "eight_early" (vào bi 8 khi nhóm mình chưa hết), "eight_scratch" (vào bi 8
// kèm bi trắng rơi)
export function applyShot(table, m, before, after, { pocketed, scratch }) {
  const state = cloneState(after), next = { ...m, groups: [...m.groups] };
  const turn = m.turn;
  const ev = { k: "shot", seat: turn, scratch: !!scratch, potted: pocketed.filter((n) => n !== 0), assigned: null, keep: false, respot8: false };
  if (m.mode !== "match") {                        // tập một mình: bi trắng rơi → đặt lại điểm đầu bàn
    if (scratch) respotCue(table, state);
    return { m: next, state, ev };
  }
  next.inHand = false;
  if (pocketed.includes(8)) {
    if (m.brk) { respotBall(table, state, 8); ev.respot8 = true; }
    else {
      const own = m.groups[turn];
      const cleared = own != null ? ballsLeft(before, own) === 0 : ballsLeft(before, SOLID) + ballsLeft(before, STRIPE) === 0;
      const win = cleared && !scratch;
      next.mode = "over";
      next.winner = win ? turn : 1 - turn;
      next.reason = win ? "eight" : scratch ? "eight_scratch" : "eight_early";
      if (scratch) respotCue(table, state);
      return { m: next, state, ev: { ...ev, k: "over", winner: next.winner, reason: next.reason } };
    }
  }
  next.brk = false;
  const obj = pocketed.filter((n) => n !== 0 && n !== 8);
  if (!scratch && next.groups[turn] == null && obj.length) {
    const g = groupOf(obj[0]);
    next.groups[turn] = g;
    next.groups[1 - turn] = otherGroup(g);
    ev.assigned = g;
  }
  const own = next.groups[turn];
  ev.keep = !scratch && own != null && obj.some((n) => groupOf(n) === own);
  if (!ev.keep) next.turn = 1 - turn;
  if (scratch) { respotCue(table, state); next.inHand = true; }
  return { m: next, state, ev };
}

// bi người ở ghế `seat` nên nhắm: nhóm của mình (bàn mở: mọi bi trừ 8); hết nhóm → bi 8
export function targets(state, m, seat) {
  const own = m?.mode === "match" ? m.groups[seat] : null;
  const on = state.balls.filter((b) => b.on && b.n !== 0);
  if (m?.mode !== "match") return on.map((b) => b.n);
  const list = on.filter((b) => (own ? groupOf(b.n) === own : b.n !== 8)).map((b) => b.n);
  return list.length ? list : on.filter((b) => b.n === 8).map((b) => b.n);
}
