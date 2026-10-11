// Luật 8 bi + mã hoá trạng thái bàn — dùng chung cho game (game/src/pool/table.js) và máy chủ chơi nhiều người
// (server/src/pool.js). JS thuần, không three.js; TẤT ĐỊNH như physics.js: chỉ + − × ÷ và Math.round / abs / floor, không
// dùng ** (Math.pow) — máy chủ và mọi máy khách phải ra cùng một bàn.
//
// Có 2 bộ luật cho ván 2 người: luật chuẩn "sọc trơn" (applyShotV2, bàn chung khi máy chủ báo features "pool_rules2") và
// luật rút gọn cũ (applyShot — máy chủ cũ chưa có "pool_rules2"; tập một mình và thử thách của anh Khang luôn như cũ).
//
// Luật rút gọn cũ (docs/CHECKLIST.md → "Bi-a bước 3"):
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

// ================= luật chuẩn 8 bi "sọc trơn" (theo WPA, rút gọn cho game) =================
// docs/GDD.md → mục bi-a. Khác luật cũ:
//   • Cú phá hợp lệ: có bi vào lỗ hoặc ≥ 4 bi (trừ bi trắng) chạm băng. Không hợp lệ → đối thủ chọn (choice "break"): xếp lại
//     và tự phá, hoặc đánh tiếp từ bàn đang có. Bi trắng rơi lúc phá → lỗi, đối thủ đặt bi trắng ở khu đầu bàn. Bi 8 vào lúc
//     phá → đặt lại ở điểm chân, người phá đánh tiếp (bi trắng cũng rơi → đối thủ có bi trong tay ở khu đầu bàn).
//   • Bàn vẫn mở sau cú phá (bi vào lỗ lúc phá không quyết định nhóm); nhóm chọn ở cú vào bi hợp lệ đầu tiên sau đó.
//   • Lỗi → đổi lượt, đối thủ có bi trong tay đặt bất kỳ đâu trên bàn (inHand "table"): bi trắng rơi lỗ / văng khỏi bàn
//     ("scratch" / "off"); chạm bi khác nhóm trước — bàn mở: chạm bi 8 trước ("wrong_first"); không chạm bi nào ("no_hit");
//     sau khi chạm không bi nào vào lỗ và không bi nào chạm băng ("no_rail"); hết giờ ("timeout", máy chủ).
//   • Bi 8: phải gọi lỗ trước cú đánh bi 8 (call = id lỗ). Thua khi bi 8 vào sớm ("eight_early"), vào khác lỗ đã gọi / không
//     gọi ("eight_pocket"), vào kèm lỗi ("eight_scratch" nếu bi trắng rơi, còn lại "eight_foul") hoặc văng khỏi bàn ("eight_off").
// Vật lý 2D (physics.js) không làm bi văng khỏi bàn — "off" chỉ có khi sự kiện cú đánh mang facts.off (để sau này có nhảy bi).
export const RULES_V2 = 2;

// sự kiện của cú (simulateShot → events theo thứ tự thời gian, không đổi vật lý) → dữ kiện để áp luật:
// { first: bi trắng chạm bi nào trước (null: không chạm), rail: sau lần chạm đó có bi nào (kể cả bi trắng) chạm băng,
//   railBalls: số bi (trừ bi trắng) chạm băng trong cả cú, pocketed: bi vào lỗ theo thứ tự, pockets: { n: id lỗ }, scratch, off }
export function shotFacts(res) {
  let contacted = false, rail = false;
  const railBalls = new Set(), pockets = {}, pocketed = [];
  for (const e of res.events) {
    if (e.type === "ball") { if (e.a === 0 || e.b === 0) contacted = true; }
    else if (e.type === "rail") { if (e.a !== 0) railBalls.add(e.a); if (contacted) rail = true; }
    else if (e.type === "pocket") { pocketed.push(e.a); pockets[e.a] = e.v; }
  }
  return { first: res.firstContact ?? null, rail, railBalls: railBalls.size, pocketed, pockets, scratch: pocketed.includes(0), off: res.off || [] };
}

// người ở ghế `seat` đang đánh bi 8 (nhóm mình đã hết trước cú này) → cú phải gọi lỗ
export function onEight(state, m, seat) {
  const own = m?.mode === "match" ? m.groups[seat] : null;
  return own != null && ballsLeft(state, own) === 0;
}

// bi trong tay: "kitchen" = khu đầu bàn (sau cú phá bi trắng rơi), "table" = bất kỳ đâu trong mũi băng; không chồng bi
export function handArea(table, hand) {
  if (hand === "kitchen") return kitchen(table);
  return { x0: -table.rx + table.r, x1: table.rx - table.r, z0: -table.rz + table.r, z1: table.rz - table.r };
}
export function canPlaceCueIn(table, state, x, z, hand) {
  const k = handArea(table, hand);
  if (!(x >= k.x0 && x <= k.x1 && z >= k.z0 && z <= k.z1)) return false;      // NaN → false
  const d2 = 4 * table.r * table.r;
  return state.balls.every((b) => b.n === 0 || !b.on || (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) >= d2);
}

// ván luật chuẩn: thêm rules: 2, choice (null | "break": người tới lượt chọn sau cú phá không hợp lệ), to: số lần hết giờ
// liên tiếp của mỗi ghế (máy chủ); inHand: false | "kitchen" | "table"
export const newMatchV2 = (breaker) => ({ ...newMatch(breaker), rules: RULES_V2, choice: null, to: [0, 0] });

// cú đánh xong (luật chuẩn) → { m, state, ev }. before: bàn trước cú (đã đặt bi trắng nếu có bi trong tay); after: bàn sau
// cú; facts: shotFacts(res); call: id lỗ đã gọi cho bi 8 (hoặc null). Tập một mình / chưa vào ván: như luật cũ.
// ev: { k: "shot", seat, potted, assigned, keep, respot8, foul: null | { why, n? }, brk: null | "legal" | "illegal", call }
export function applyShotV2(table, m, before, after, facts, call = null) {
  if (m.mode !== "match") return applyShot(table, m, before, after, { pocketed: facts.pocketed, scratch: facts.scratch });
  const state = cloneState(after), turn = m.turn, opp = 1 - turn;
  const next = { ...m, groups: [...m.groups], inHand: false, choice: null };
  const obj = facts.pocketed.filter((n) => n !== 0 && n !== 8);
  const scratch = facts.scratch || facts.off.includes(0);
  const eight = facts.pocketed.includes(8) || facts.off.includes(8);
  const ev = { k: "shot", seat: turn, scratch, potted: facts.pocketed.filter((n) => n !== 0), assigned: null, keep: false, respot8: false,
    foul: null, brk: null, call };
  const foulOut = (why, extra = {}) => {
    ev.foul = { why, ...extra };
    next.turn = opp;
    next.inHand = "table";
    if (scratch) respotCue(table, state);           // bi trắng về điểm đầu bàn — người kia dời đi đâu cũng được
    return { m: next, state, ev };
  };
  if (m.brk) {
    next.brk = false;
    ev.brk = obj.length || eight || facts.railBalls >= 4 ? "legal" : "illegal";
    if (facts.pocketed.includes(8)) { respotBall(table, state, 8); ev.respot8 = true; }
    if (scratch) {                                   // bi trắng rơi lúc phá: đối thủ đặt bi trắng ở khu đầu bàn
      ev.foul = { why: facts.off.includes(0) ? "off" : "scratch" };
      next.turn = opp;
      next.inHand = "kitchen";
      respotCue(table, state);
      return { m: next, state, ev };
    }
    if (ev.respot8) { ev.keep = true; return { m: next, state, ev }; }    // bi 8 vào lúc phá: người phá đánh tiếp
    if (ev.brk === "illegal") { next.turn = opp; next.choice = "break"; return { m: next, state, ev }; }
    ev.keep = obj.length > 0;                        // phá hợp lệ: vào bi → đánh tiếp (bàn vẫn mở)
    if (!ev.keep) next.turn = opp;
    return { m: next, state, ev };
  }
  const own = m.groups[turn], eightNow = onEight(before, m, turn);
  // lỗi của cú (chưa tính bi 8)
  let foul = null;
  if (scratch) foul = { why: facts.off.includes(0) ? "off" : "scratch" };
  else if (facts.first == null) foul = { why: "no_hit" };
  else if (own == null ? facts.first === 8 : eightNow ? facts.first !== 8 : groupOf(facts.first) !== own) foul = { why: "wrong_first", n: facts.first };
  else if (!facts.pocketed.length && !facts.rail) foul = { why: "no_rail" };
  if (eight) {
    const off8 = facts.off.includes(8);
    const reason = off8 ? "eight_off" : !eightNow ? "eight_early" : foul ? (scratch ? "eight_scratch" : "eight_foul")
      : call == null || facts.pockets[8] !== call ? "eight_pocket" : "eight";
    next.mode = "over";
    next.winner = reason === "eight" ? turn : opp;
    next.reason = reason;
    if (scratch) respotCue(table, state);
    return { m: next, state, ev: { ...ev, k: "over", foul, winner: next.winner, reason } };
  }
  if (foul) return foulOut(foul.why, foul.n != null ? { n: foul.n } : {});
  if (own == null && obj.length) {                   // bàn mở: cú vào bi hợp lệ đầu tiên → nhận nhóm của bi vào trước
    const g = groupOf(obj[0]);
    next.groups[turn] = g;
    next.groups[opp] = otherGroup(g);
    ev.assigned = g;
  }
  const mine = next.groups[turn];
  ev.keep = mine != null && obj.some((n) => groupOf(n) === mine);
  if (!ev.keep) next.turn = opp;
  return { m: next, state, ev };
}
