// npm run test:pool (phần 2, trong game/) — luật 8 bi (game/src/pool/rules.js: luật rút gọn cũ + luật chuẩn "sọc trơn") và bàn
// bi-a của máy chủ (server/src/pool.js, cả 2 bộ luật), bằng Node, không cần trình duyệt / máy chủ thật:
//   • luật: nhận nhóm, đánh tiếp khi vào bi nhóm mình, bi trắng rơi → đổi lượt + bi trong tay, bi 8 sớm / kèm bi trắng → thua,
//     bi 8 hợp lệ → thắng, bi 8 lúc phá → đặt lại
//   • bàn máy chủ: ngồi / tập một mình / người thứ 2 → ván mới (người ngồi trước phá), chặn cú sai lượt / lệch số cú / kết quả
//     không hợp lệ / đặt bi trắng sai chỗ, rời bàn giữa ván → đối thủ thắng, quá giờ lượt → mất ghế, ván mới người thua phá,
//     bản chụp qua lúc ngủ (hibernation)
//   • một ván trọn giữa 2 người chơi giả (chọn cú: game/src/pool/auto.js) + 1 người xem: người xem phát lại từng cú bằng
//     physics.js từ bàn của mình → khớp từng bit với kết quả người đánh; chạy lại cả ván → giống hệt
//   • luật chuẩn: cú phá hợp lệ / không hợp lệ (+ 2 lựa chọn), bàn mở sau phá, từng loại lỗi, bi trong tay cả bàn / khu đầu
//     bàn, gọi lỗ bi 8 đúng / sai, bi 8 vào sớm / kèm lỗi / văng, hết giờ = lỗi; sự kiện cú từ vật lý thật (shotFacts)
//   • bàn máy chủ luật chuẩn: chặn máy khách cũ, máy chủ tự tính cú (bỏ qua kết quả máy khách gửi), kiểm tra chỗ đặt bi trong
//     tay / lỗ đã gọi, lựa chọn sau cú phá không hợp lệ, hết giờ 3 lần → mất ghế, bản chụp; một ván trọn 2 người giả + người xem
// In 1 dòng ✓/✗ cho mỗi mục; lỗi → thoát mã 1.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTable, rackState, customState, simulateShot, cloneState } from "../../game/src/pool/physics.js";
import { applyShot, newMatch, packBalls, unpackBalls, placeCue, canPlaceCue, roundState, targets, SOLID, STRIPE, kitchen,
  applyShotV2, shotFacts, newMatchV2, canPlaceCueIn, onEight } from "../../game/src/pool/rules.js";
import { pickShot } from "../../game/src/pool/auto.js";
import { PoolRoom } from "../../server/src/pool.js";

const t0 = performance.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cfg = JSON.parse(readFileSync(join(ROOT, "data", "pool.json"), "utf8"));
const table = makeTable(cfg);
let failed = 0;
const report = (ok, name, detail = "") => { if (!ok) failed++; console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- 1. luật ----------
{
  const st = (place) => customState(table, place);
  const shot = (m, before, pocketed) => {
    const after = cloneState(before);
    for (const n of pocketed) after.balls[n].on = false;
    return applyShot(table, m, before, after, { pocketed, scratch: pocketed.includes(0) });
  };
  const all = Object.fromEntries(table.rack.map((b) => [b.n, [b.x, b.z]]));
  const out = [];
  // phá bi, vào bi 3 (trơn) → nhận nhóm trơn, đánh tiếp
  let r = shot(newMatch(0), st(all), [3]);
  out.push(["phá vào bi trơn → nhóm trơn, đánh tiếp", r.m.groups[0] === SOLID && r.m.groups[1] === STRIPE && r.m.turn === 0 && r.ev.keep && !r.m.brk]);
  // bàn đã chia nhóm: vào bi của đối thủ → đổi lượt
  const m1 = { ...newMatch(0), brk: false, groups: [SOLID, STRIPE] };
  r = shot(m1, st(all), [12]);
  out.push(["vào bi nhóm đối thủ → đổi lượt", r.m.turn === 1 && !r.ev.keep]);
  // không vào gì → đổi lượt
  r = shot(m1, st(all), []);
  out.push(["không vào bi nào → đổi lượt", r.m.turn === 1]);
  // bi trắng rơi (kèm bi nhóm mình) → đổi lượt, bi trong tay, bi trắng đặt lại trên bàn
  r = shot(m1, st(all), [2, 0]);
  out.push(["bi trắng rơi → đổi lượt + bi trong tay", r.m.turn === 1 && r.m.inHand && r.state.balls[0].on && !r.ev.keep]);
  // bi 8 khi nhóm trơn còn bi → thua
  r = shot(m1, st({ 0: [0, -0.6], 1: [0.2, 0.2], 8: [0, 0.5], 9: [-0.2, 0.3] }), [8]);
  out.push(["vào bi 8 sớm → thua", r.m.mode === "over" && r.m.winner === 1 && r.m.reason === "eight_early"]);
  // nhóm trơn đã hết → vào bi 8 thắng; kèm bi trắng rơi → thua
  const end = st({ 0: [0, -0.6], 8: [0, 0.5], 9: [-0.2, 0.3] });
  r = shot(m1, end, [8]);
  out.push(["hết nhóm rồi vào bi 8 → thắng", r.m.mode === "over" && r.m.winner === 0 && r.m.reason === "eight"]);
  r = shot(m1, end, [8, 0]);
  out.push(["vào bi 8 kèm bi trắng rơi → thua", r.m.mode === "over" && r.m.winner === 1 && r.m.reason === "eight_scratch"]);
  // bi 8 vào lúc phá → đặt lại điểm chân bàn, chơi tiếp
  r = shot(newMatch(1), st(all), [8, 4]);
  out.push(["bi 8 vào lúc phá → đặt lại, chơi tiếp", r.m.mode === "match" && r.state.balls[8].on && r.ev.respot8 && r.m.groups[1] === SOLID && r.m.turn === 1]);
  // bàn mở, vào bi 11 kèm bi trắng rơi → chưa chia nhóm
  r = shot(newMatch(0), st(all), [11, 0]);
  out.push(["bàn mở, bi trắng rơi → chưa chia nhóm", r.m.groups[0] === null && r.m.turn === 1 && r.m.inHand]);
  // khu đầu bàn
  const k = kitchen(table), s0 = rackState(table);
  out.push(["bi trong tay: chỉ đặt được ở khu đầu bàn, không chồng bi", canPlaceCue(table, s0, 0, (k.z0 + k.z1) / 2) && !canPlaceCue(table, s0, 0, 0)
    && !canPlaceCue(table, s0, 0, k.z0 - 0.01) && !canPlaceCue(table, s0, NaN, k.z1)]);
  out.push(["mục tiêu: nhóm mình, hết nhóm → bi 8", same(targets(end, m1, 0), [8]) && targets(end, m1, 1).join() === "9"]);
  const bad = out.filter(([, ok]) => !ok).map(([n]) => n);
  report(!bad.length, `luật 8 bi rút gọn (cũ) — ${out.length} tình huống`, bad.join("; "));
}

// ---------- 2. bàn của máy chủ ----------
// máy khách giả: tính cú bằng physics.js từ bàn máy chủ gửi, gửi thông số + kết quả như game (game/src/pool/table.js)
function makeShot(room, view, angle, power, cue = null) {
  let start = unpackBalls(table, view.b);
  if (cue) start = placeCue(start, cue[0], cue[1]);
  const res = simulateShot(table, start, { angle, power }, { frames: false });
  return { msg: { t: "pool_shot", seq: view.seq, a: angle, p: power, cue, b: packBalls(res.finalState), k: res.pocketed, f: res.firstContact, s: res.cueScratch, d: +res.time.toFixed(2) }, res };
}
{
  const out = [];
  let now = 1000;
  const room = new PoolRoom(cfg, { turnMs: 60000, rules: 1 });
  let r = room.join("aa", "An", now);
  out.push(["ngồi một mình → tập (solo)", r.changed && room.m.mode === "solo" && room.view(now).seats[0]?.name === "An"]);
  // tập một mình: cú đánh hợp lệ được nhận
  let s = makeShot(room, room.view(now), Math.PI / 2, 0.6);
  r = room.shot("aa", s.msg, now);
  out.push(["tập một mình: cú hợp lệ được nhận, số cú tăng", r.ok && room.seq === 1 && room.shots === 1]);
  r = room.join("bb", "Bình", now);
  out.push(["người thứ 2 ngồi → ván mới, xếp lại bi, người ngồi trước phá", r.changed && room.m.mode === "match" && room.m.turn === 0 && room.m.brk
    && room.shots === 0 && same(room.view(now).b, packBalls(roundState(rackState(table)))) && room.view(now).ev.k === "start"]);
  r = room.join("cc", "Cường", now);
  out.push(["người thứ 3 → không có ghế (xem)", !r.changed && !r.seated && room.seated === 2]);
  s = makeShot(room, room.view(now), Math.PI / 2, 0.8);
  out.push(["chặn cú sai lượt", room.shot("bb", s.msg, now).err === "turn" && room.seq === 1]);
  out.push(["chặn cú của người không ngồi", room.shot("cc", s.msg, now).err === "seat"]);
  out.push(["chặn cú lệch số thứ tự", room.shot("aa", { ...s.msg, seq: 0 }, now).err === "seq"]);
  const resurrect = [...s.msg.b];
  out.push(["chặn kết quả sai: danh sách bi vào lỗ không khớp", room.shot("aa", { ...s.msg, k: [...s.msg.k, 15] }, now).err === "bad"]);
  resurrect[3] = 9; // bi 1 ra ngoài bàn
  out.push(["chặn kết quả sai: bi ra ngoài bàn", room.shot("aa", { ...s.msg, b: resurrect }, now).err === "bad"]);
  out.push(["chặn đặt bi trắng khi không có bi trong tay", room.shot("aa", { ...s.msg, cue: [0, -0.8] }, now).err === "cue"]);
  out.push(["chặn lực ngoài 0..1 / góc NaN", room.shot("aa", { ...s.msg, p: 1.5 }, now).err === "bad" && room.shot("aa", { ...s.msg, a: NaN }, now).err === "bad"]);
  r = room.shot("aa", s.msg, now);
  out.push(["cú phá đúng lượt được nhận, bàn = kết quả người đánh (đã làm tròn)", r.ok && room.seq === 2 && r.shot.seq === 1
    && same(room.view(now).b.filter((v, i) => !s.res.cueScratch || i > 1), packBalls(s.res.finalState).filter((v, i) => !s.res.cueScratch || i > 1))]);
  // bản chụp → dựng lại (DO ngủ dậy): giống hệt; người đã đi → mất ghế, đối thủ thắng
  const snap = JSON.parse(JSON.stringify(room.snapshot()));
  const back = new PoolRoom(cfg, { rules: 1 });
  const ch1 = back.restore(snap, new Set(["aa", "bb"]), now);
  const v1 = room.view(now), v2 = back.view(now);
  out.push(["bản chụp qua lúc ngủ: dựng lại giống hệt", !ch1 && same({ ...v1, left: 0 }, { ...v2, left: 0 })]);
  const back2 = new PoolRoom(cfg, { rules: 1 });
  const ch2 = back2.restore(snap, new Set(["aa"]), now);
  out.push(["bản chụp: người ngồi đã mất kết nối lúc ngủ → giải phóng ghế, đối thủ thắng", ch2 && back2.seats[1] === null && back2.m.mode === "solo" && back2.ev.k === "forfeit" && back2.ev.seat === 0]);
  // quá giờ lượt → mất ghế
  const who = room.seats[room.m.turn].id;
  out.push(["chưa hết giờ → giữ ghế", !room.tick(room.turnAt + 59000)]);
  out.push(["quá giờ lượt → mất ghế, đối thủ thắng", room.tick(room.turnAt + 61000) && room.seatOf(who) < 0 && room.ev.k === "forfeit" && room.ev.why === "timeout" && room.m.mode === "solo"]);
  // ván mới khi hết ván: người thua phá
  const room2 = new PoolRoom(cfg, { rules: 1 });
  room2.join("aa", "An", now); room2.join("bb", "Bình", now);
  room2.m = { ...room2.m, mode: "over", winner: 0, reason: "eight" };
  out.push(["hết ván, R → ván mới, người thua phá", room2.rerack("bb", now) && room2.m.mode === "match" && room2.m.turn === 1]);
  out.push(["giữa ván không xếp lại được", !room2.rerack("aa", now)]);
  out.push(["rời bàn giữa ván → đối thủ thắng, còn 1 người tập", room2.leave("bb", now) && room2.ev.k === "forfeit" && room2.ev.seat === 0 && room2.m.mode === "solo" && room2.seated === 1]);
  out.push(["người cuối rời bàn → bàn trống", room2.leave("aa", now) && room2.m.mode === "idle" && room2.seated === 0]);
  const bad = out.filter(([, ok]) => !ok).map(([n]) => n);
  report(!bad.length, `bàn bi-a của máy chủ (luật cũ — máy chủ bản cũ) — ${out.length} tình huống`, bad.join("; "));
}

// ---------- 3. một ván trọn: 2 người chơi giả + 1 người xem ----------
// scratchOnce: ghế 1 cố ý đánh bi trắng thẳng vào lỗ góc đầu bàn ở lượt đầu → ghế 0 có bi trong tay, đặt bi trắng ở chỗ
// khác chỗ máy chủ đặt sẵn
function playMatch({ scratchOnce = false } = {}) {
  const room = new PoolRoom(cfg, { rules: 1 });
  let now = 0;
  room.join("p0", "An", now);
  room.join("p1", "Bình", now);
  let watcher = unpackBalls(table, room.view(now).b);        // bàn của người xem (phát lại từng cú)
  const log = [];
  let mismatch = 0, inHand = 0, scratches = 0, rejected = 0;
  for (let i = 0; i < 200 && room.m.mode === "match"; i++) {
    const view = room.view(now), seat = view.turn, id = view.seats[seat].id;
    const state = unpackBalls(table, view.b);
    let cue = null;
    if (view.inHand) {
      inHand++;
      const k = kitchen(table), alt = [0.3, (k.z0 + k.z1) / 2];
      cue = canPlaceCue(table, state, alt[0], alt[1]) ? alt : [state.balls[0].x, state.balls[0].z];
      placeCue(state, cue[0], cue[1]);
    }
    let pick = pickShot(table, state, targets(state, view, seat));
    if (scratchOnce && seat === 1 && !scratches) {
      const p = table.pockets.find((q) => q.id === "head_left"), c = state.balls[0];
      pick = { angle: Math.atan2(p.z - c.z, p.x - c.x), power: 0.6, how: "scratch" };
    }
    const s = makeShot(room, view, pick.angle, pick.power, cue);
    const r = room.shot(id, s.msg, now);
    if (!r.ok) { rejected++; break; }
    if (s.res.cueScratch) scratches++;
    // người xem: phát lại từ bàn của mình với đúng thông số → phải ra đúng kết quả người đánh
    let replay = cloneState(watcher);
    if (r.shot.cue) replay = placeCue(replay, r.shot.cue[0], r.shot.cue[1]);
    const res = simulateShot(table, replay, { angle: r.shot.a, power: r.shot.p }, { frames: false });
    if (!same(packBalls(res.finalState), s.msg.b) || !same(res.pocketed, s.msg.k)) mismatch++;
    watcher = unpackBalls(table, room.view(now).b);           // cuối cú: chốt theo bàn máy chủ
    log.push([seat, pick.how, s.msg.k.join(","), room.m.turn]);
    now += (s.res.time + 2) * 1000;
  }
  return { room, log, mismatch, inHand, scratches, rejected };
}
{
  const a = playMatch(), b = playMatch();
  const m = a.room.m;
  report(m.mode === "over" && a.rejected === 0, `một ván trọn giữa 2 người chơi giả: ${a.log.length} cú, ${m.winner === 0 ? "An" : "Bình"} thắng (${m.reason})`,
    `bi trắng rơi ${a.scratches} lần, bi trong tay ${a.inHand} lần, bị chặn ${a.rejected}`);
  report(a.mismatch === 0, "người xem phát lại từng cú từ bàn của mình → khớp từng bit với người đánh", `${a.log.length} cú, lệch ${a.mismatch}`);
  report(same(a.log, b.log) && same(a.room.view(0).b, b.room.view(0).b), "chạy lại cả ván → giống hệt (tất định)");
  const c = playMatch({ scratchOnce: true });
  report(c.room.m.mode === "over" && c.scratches >= 1 && c.inHand >= 1 && c.mismatch === 0 && c.rejected === 0,
    `ván có bi trắng rơi: đối thủ đặt bi trắng ở khu đầu bàn, máy chủ nhận, người xem khớp — ${c.log.length} cú, ${c.room.m.winner === 0 ? "An" : "Bình"} thắng (${c.room.m.reason})`,
    `bi trắng rơi ${c.scratches}, bi trong tay ${c.inHand}, lệch ${c.mismatch}, bị chặn ${c.rejected}`);
}

// ---------- 4. luật chuẩn "sọc trơn" (applyShotV2) — dữ kiện cú dựng tay ----------
{
  const st = (place) => customState(table, place);
  const all = Object.fromEntries(table.rack.map((b) => [b.n, [b.x, b.z]]));
  const F = ({ first = null, rail = true, railBalls = 0, pocketed = [], pockets = {}, off = [] } = {}) =>
    ({ first, rail, railBalls, pocketed, pockets, scratch: pocketed.includes(0), off });
  const go = (m, before, f, call = null) => {
    const after = cloneState(before);
    for (const n of f.pocketed) after.balls[n].on = false;
    return applyShotV2(table, m, before, after, f, call);
  };
  const out = [];
  const brk = newMatchV2(0), rack = st(all);
  let r = go(brk, rack, F({ first: 1, pocketed: [3], railBalls: 2 }));
  out.push(["phá: vào bi → hợp lệ, người phá đánh tiếp, bàn vẫn mở", r.ev.brk === "legal" && r.ev.keep && r.m.turn === 0 && r.m.groups[0] === null && !r.m.brk && !r.ev.foul]);
  r = go(brk, rack, F({ first: 1, railBalls: 4 }));
  out.push(["phá: 4 bi chạm băng, không vào bi → hợp lệ, đổi lượt, không lỗi", r.ev.brk === "legal" && r.m.turn === 1 && !r.ev.foul && !r.m.choice && !r.m.inHand]);
  r = go(brk, rack, F({ first: 1, railBalls: 3 }));
  out.push(["phá không hợp lệ (3 bi chạm băng, không vào bi) → đối thủ chọn (choice break)", r.ev.brk === "illegal" && r.m.turn === 1 && r.m.choice === "break" && !r.ev.foul]);
  r = go(brk, rack, F({ first: 1, railBalls: 6, pocketed: [0] }));
  out.push(["phá: bi trắng rơi → lỗi, đối thủ đặt bi trắng khu đầu bàn", r.ev.foul?.why === "scratch" && r.m.turn === 1 && r.m.inHand === "kitchen" && r.state.balls[0].on]);
  r = go(brk, rack, F({ first: 1, pocketed: [8] }));
  out.push(["phá: bi 8 vào → đặt lại điểm chân, người phá đánh tiếp", r.ev.respot8 && r.state.balls[8].on && r.m.turn === 0 && r.m.mode === "match" && !r.ev.foul]);
  r = go(brk, rack, F({ first: 1, pocketed: [8, 0] }));
  out.push(["phá: bi 8 + bi trắng cùng rơi → đặt lại bi 8, đối thủ có bi trong tay khu đầu bàn", r.ev.respot8 && r.state.balls[8].on && r.m.turn === 1 && r.m.inHand === "kitchen"]);
  const open = { ...newMatchV2(0), brk: false };
  r = go(open, rack, F({ first: 11, pocketed: [11] }));
  out.push(["bàn mở sau phá: cú vào bi hợp lệ đầu tiên → nhận nhóm (sọc), đánh tiếp", r.ev.assigned === STRIPE && r.m.groups[0] === STRIPE && r.m.groups[1] === SOLID && r.ev.keep]);
  r = go(open, rack, F({ first: 8, pocketed: [3] }));
  out.push(["bàn mở: chạm bi 8 trước → lỗi (bi trong tay cả bàn), chưa chia nhóm", r.ev.foul?.why === "wrong_first" && r.ev.foul.n === 8 && r.m.inHand === "table" && r.m.groups[0] === null && r.m.turn === 1]);
  const m1 = { ...newMatchV2(0), brk: false, groups: [SOLID, STRIPE] };
  r = go(m1, rack, F({ first: 2 }));
  out.push(["chạm bi nhóm mình, có bi chạm băng, không vào bi → đổi lượt, không lỗi", r.m.turn === 1 && !r.ev.foul && !r.m.inHand]);
  r = go(m1, rack, F({ first: 12 }));
  out.push(["chạm bi nhóm khác trước (bi 12) → lỗi \"chạm bi 12 trước\"", r.ev.foul?.why === "wrong_first" && r.ev.foul.n === 12 && r.m.inHand === "table" && r.m.turn === 1]);
  r = go(m1, rack, F({ first: null, rail: false }));
  out.push(["không chạm bi nào → lỗi", r.ev.foul?.why === "no_hit" && r.m.inHand === "table"]);
  r = go(m1, rack, F({ first: 2, rail: false }));
  out.push(["chạm rồi không bi nào vào lỗ, không bi nào chạm băng → lỗi", r.ev.foul?.why === "no_rail" && r.m.inHand === "table"]);
  r = go(m1, rack, F({ first: 2, rail: false, pocketed: [2] }));
  out.push(["chạm rồi vào bi (không chạm băng) → hợp lệ, đánh tiếp", !r.ev.foul && r.ev.keep && r.m.turn === 0]);
  r = go(m1, rack, F({ first: 2, pocketed: [2, 0] }));
  out.push(["bi trắng rơi (kèm bi nhóm mình) → lỗi, bi đã vào giữ nguyên, bi trắng về bàn", r.ev.foul?.why === "scratch" && !r.ev.keep && r.m.turn === 1 && r.m.inHand === "table" && !r.state.balls[2].on && r.state.balls[0].on]);
  r = go(m1, rack, F({ first: 2, off: [0] }));
  out.push(["bi trắng văng khỏi bàn → lỗi", r.ev.foul?.why === "off" && r.m.inHand === "table"]);
  // bi trong tay
  const mid = st({ 0: [0, -0.6], 1: [0.2, 0.3], 9: [-0.2, 0.3] }), kk = kitchen(table);
  out.push(["bi trong tay cả bàn: đặt giữa bàn được, khu đầu bàn thì không", canPlaceCueIn(table, mid, 0, 0, "table") && !canPlaceCueIn(table, mid, 0, 0, "kitchen")
    && canPlaceCueIn(table, mid, 0, (kk.z0 + kk.z1) / 2, "kitchen")]);
  out.push(["bi trong tay: không chồng bi, không ra ngoài mũi băng, NaN không được", !canPlaceCueIn(table, mid, 0.2, 0.3, "table") && !canPlaceCueIn(table, mid, 0, table.rz, "table")
    && !canPlaceCueIn(table, mid, NaN, 0, "table")]);
  // bi 8 (nhóm trơn đã hết)
  const end = st({ 0: [0, -0.6], 8: [0, 0.5], 9: [-0.2, 0.3] });
  out.push(["đang đánh bi 8 khi nhóm mình hết (onEight)", onEight(end, m1, 0) && !onEight(end, m1, 1) && !onEight(rack, m1, 0)]);
  const p8 = (call, extra = {}) => go(m1, end, F({ first: 8, pocketed: [8], pockets: { 8: "foot_left" }, ...extra }), call);
  r = p8("foot_left");
  out.push(["bi 8 vào đúng lỗ đã gọi → thắng", r.m.mode === "over" && r.m.winner === 0 && r.m.reason === "eight"]);
  r = p8("foot_right");
  out.push(["bi 8 vào khác lỗ đã gọi → thua", r.m.mode === "over" && r.m.winner === 1 && r.m.reason === "eight_pocket"]);
  r = p8(null);
  out.push(["bi 8 vào mà không gọi lỗ → thua", r.m.winner === 1 && r.m.reason === "eight_pocket"]);
  r = p8("foot_left", { pocketed: [8, 0], pockets: { 8: "foot_left", 0: "side_left" } });
  out.push(["bi 8 vào kèm bi trắng rơi → thua", r.m.winner === 1 && r.m.reason === "eight_scratch"]);
  r = p8("foot_left", { first: 9 });
  out.push(["bi 8 vào kèm lỗi (chạm bi khác trước) → thua", r.m.winner === 1 && r.m.reason === "eight_foul"]);
  r = go(m1, st({ 0: [0, -0.6], 1: [0.2, 0.2], 8: [0, 0.5], 9: [-0.2, 0.3] }), F({ first: 1, pocketed: [8], pockets: { 8: "foot_left" } }), "foot_left");
  out.push(["bi 8 vào sớm (nhóm mình còn bi) → thua", r.m.winner === 1 && r.m.reason === "eight_early"]);
  r = go(open, rack, F({ first: 3, pocketed: [8], pockets: { 8: "foot_left" } }));
  out.push(["bàn mở mà bi 8 vào → thua", r.m.winner === 1 && r.m.reason === "eight_early"]);
  r = go(m1, end, F({ first: 8, off: [8] }), "foot_left");
  out.push(["bi 8 văng khỏi bàn → thua", r.m.winner === 1 && r.m.reason === "eight_off"]);
  r = go(m1, end, F({ first: 9 }), "foot_left");
  out.push(["đang đánh bi 8 mà chạm bi khác trước → lỗi", r.ev.foul?.why === "wrong_first" && r.ev.foul.n === 9 && r.m.mode === "match"]);
  const bad = out.filter(([, ok]) => !ok).map(([n]) => n);
  report(!bad.length, `luật chuẩn 8 bi "sọc trơn" — ${out.length} tình huống`, bad.join("; "));
}

// ---------- 5. sự kiện cú từ vật lý thật (shotFacts) ----------
{
  const out = [];
  const brk = simulateShot(table, rackState(table), { angle: Math.PI / 2, power: 0.9 }, { frames: false });
  const f = shotFacts(brk);
  out.push(["cú phá thật: bi chạm đầu tiên, số bi chạm băng, bi vào lỗ khớp vật lý", f.first === brk.firstContact && f.first > 0 && f.railBalls >= 4 && same(f.pocketed, brk.pocketed)
    && f.pocketed.every((n) => typeof f.pockets[n] === "string")]);
  // bi trắng đánh ngược ra băng đầu bàn, không chạm bi nào: chạm băng trước khi chạm bi không tính
  const away = simulateShot(table, customState(table, { 0: [0, -0.6], 5: [0, 0.6] }), { angle: -Math.PI / 2, power: 0.15 }, { frames: false });
  const fa = shotFacts(away);
  out.push(["bi trắng chỉ chạm băng, không chạm bi → first null, không tính chạm băng sau khi chạm", fa.first === null && !fa.rail && fa.railBalls === 0]);
  // bi trắng đánh thẳng bi 5 về băng chân bàn: bi 5 chạm băng sau lần chạm
  const hit = simulateShot(table, customState(table, { 0: [0, -0.2], 5: [0, 0.2] }), { angle: Math.PI / 2, power: 0.7 }, { frames: false });
  const fh = shotFacts(hit);
  out.push(["bi trắng đánh bi 5 về băng → first 5, có bi chạm băng sau lần chạm", fh.first === 5 && fh.rail && fh.railBalls >= 1]);
  out.push(["vật lý không đổi: cú cũ chạy lại giống từng bit", same(packBalls(simulateShot(table, rackState(table), { angle: Math.PI / 2, power: 0.9 }, { frames: false }).finalState), packBalls(brk.finalState))]);
  const bad = out.filter(([, ok]) => !ok).map(([n]) => n);
  report(!bad.length, `sự kiện cú từ vật lý (shotFacts) — ${out.length} tình huống`, bad.join("; "));
}

// ---------- 6. bàn máy chủ luật chuẩn ----------
// máy khách luật chuẩn: chỉ gửi thông số (máy chủ tự tính); b / k gửi kèm như game nhưng máy chủ bỏ qua
function makeShotV2(view, angle, power, cue = null, call = null) {
  let start = unpackBalls(table, view.b);
  if (cue) start = placeCue(start, cue[0], cue[1]);
  const res = simulateShot(table, start, { angle, power }, { frames: false });
  return { msg: { t: "pool_shot", seq: view.seq, a: angle, p: power, cue, call, b: packBalls(res.finalState), k: res.pocketed, s: res.cueScratch, d: +res.time.toFixed(2) }, res };
}
// lỗ bi 8 sẽ vào với cú này (vật lý tất định) — không vào thì lỗ gần bi 8 nhất
function callFor(state, angle, power) {
  const res = simulateShot(table, state, { angle, power }, { frames: false }), f = shotFacts(res);
  if (f.pockets[8]) return f.pockets[8];
  const b = state.balls[8];
  return table.pockets.reduce((best, p) => (!best || (p.x - b.x) ** 2 + (p.z - b.z) ** 2 < (best.x - b.x) ** 2 + (best.z - b.z) ** 2 ? p : best), null).id;
}
{
  const out = [];
  let now = 1000;
  const room = new PoolRoom(cfg, { turnMs: 60000 });
  out.push(["bàn mặc định là luật chuẩn (rules 2)", room.rules === 2 && room.view(now).rules === 2]);
  let r = room.join("old", "Cũ", now);
  out.push(["máy khách cũ (pool_join không kèm r) → không được ngồi (err version)", !r.changed && !r.seated && r.err === "version" && room.seated === 0]);
  room.join("aa", "An", now, 2);
  r = room.join("bb", "Bình", now, 2);
  const v0 = room.view(now);
  out.push(["2 máy khách mới ngồi → ván luật chuẩn, người ngồi trước phá", r.changed && v0.mode === "match" && v0.turn === 0 && v0.brk && v0.choice === null && v0.inHand === false]);
  // phá rất nhẹ → không vào bi, < 4 bi chạm băng → không hợp lệ → Bình chọn
  let s = makeShotV2(v0, Math.PI / 2, 0.02);
  const tampered = { ...s.msg, b: s.msg.b.map((v, i) => (i === 3 && v != null ? v + 0.001 : v)), k: [] };
  r = room.shot("aa", tampered, now);
  const v1 = room.view(now);
  out.push(["máy chủ tự tính cú (bỏ qua kết quả máy khách gửi sai): bàn = vật lý", r.ok && same(v1.b, packBalls(roundState(cloneState(s.res.finalState)))) && same(r.shot.b, s.msg.b)]);
  out.push(["phá không hợp lệ → Bình chọn (choice break), cú đánh bị chặn tới khi chọn", v1.choice === "break" && v1.turn === 1 && v1.ev.brk === "illegal"
    && room.shot("bb", makeShotV2(v1, Math.PI / 2, 0.5).msg, now).err === "choice" && room.choose("aa", "play", now).err === "choice"]);
  r = room.choose("bb", "rerack", now);
  const v2 = room.view(now);
  out.push(["chọn \"xếp lại và tự phá\" → xếp lại bi, Bình phá", r.ok && v2.mode === "match" && v2.brk && v2.turn === 1 && same(v2.b, packBalls(roundState(rackState(table)))) && v2.ev.k === "choice"]);
  // lựa chọn "đánh tiếp": dựng lại tình huống
  room.m = { ...room.m, brk: false, choice: "break", turn: 0 };
  r = room.choose("aa", "play", now);
  out.push(["chọn \"đánh tiếp từ đây\" → hết lựa chọn, đánh được", r.ok && room.m.choice === null && room.m.turn === 0 && !room.m.brk]);
  // bi trong tay: cả bàn / khu đầu bàn
  room.m = { ...room.m, inHand: "table" };
  const vh = room.view(now), sth = unpackBalls(table, vh.b);
  const free = [[0, 0], [0.3, 0.1], [-0.3, -0.2], [0.1, 0.5]].find(([x, z]) => canPlaceCueIn(table, sth, x, z, "table"));
  const busy = sth.balls.find((b) => b.n !== 0 && b.on);
  out.push(["bi trong tay cả bàn: đặt chồng bi khác → chặn", room.shot("aa", makeShotV2(vh, Math.PI / 2, 0.3, [busy.x, busy.z]).msg, now).err === "cue"]);
  room.m = { ...room.m, inHand: "kitchen" };
  out.push(["bi trong tay khu đầu bàn: đặt giữa bàn → chặn", room.shot("aa", makeShotV2(room.view(now), Math.PI / 2, 0.3, free).msg, now).err === "cue"]);
  room.m = { ...room.m, inHand: "table" };
  r = room.shot("aa", makeShotV2(room.view(now), Math.PI / 2, 0.3, free).msg, now);
  out.push(["bi trong tay cả bàn: đặt giữa bàn → được, máy chủ đánh từ chỗ đặt", r.ok && same(r.shot.cue, free.map((v) => Math.round(v * 1e5) / 1e5))]);
  // gọi lỗ bi 8: nhóm của người tới lượt đã hết
  const room3 = new PoolRoom(cfg);
  room3.join("aa", "An", now, 2); room3.join("bb", "Bình", now, 2);
  room3.m = { ...room3.m, brk: false, groups: [SOLID, STRIPE], turn: 0 };
  room3.state = roundState(customState(table, { 0: [0, -0.4], 8: [0, 0.3], 9: [-0.3, 0.3] }));
  const v3 = room3.view(now), st3 = unpackBalls(table, v3.b);
  const aim8 = Math.atan2(0.3 + 0.4, 0);
  out.push(["đánh bi 8 mà không gọi lỗ / gọi lỗ không có → chặn (err call)", room3.shot("aa", makeShotV2(v3, aim8, 0.6).msg, now).err === "call"
    && room3.shot("aa", makeShotV2(v3, aim8, 0.6, null, "nowhere").msg, now).err === "call"]);
  const call = callFor(st3, aim8, 0.6);
  r = room3.shot("aa", makeShotV2(v3, aim8, 0.6, null, call).msg, now);
  out.push([`gọi lỗ (${call}) rồi đánh → máy chủ nhận, áp luật bi 8`, r.ok && r.shot.call === call && (room3.m.mode === "over" || room3.m.mode === "match")]);
  // hết giờ = lỗi; 3 lần liên tiếp → mất ghế
  const room4 = new PoolRoom(cfg, { turnMs: 60000 });
  room4.join("aa", "An", now, 2); room4.join("bb", "Bình", now, 2);
  room4.m = { ...room4.m, brk: false };
  let t = room4.turnAt;
  out.push(["chưa hết giờ → không gì", !room4.tick(t + 59000)]);
  const to1 = room4.tick(t + 61000);
  out.push(["hết giờ → lỗi: đổi lượt, đối thủ có bi trong tay cả bàn", to1 && room4.m.turn === 1 && room4.m.inHand === "table" && room4.ev.k === "foul" && room4.ev.why === "timeout" && room4.ev.seat === 0]);
  t = room4.turnAt; room4.tick(t + 61000);           // Bình hết giờ 1
  t = room4.turnAt; room4.tick(t + 61000);           // An hết giờ 2
  t = room4.turnAt; room4.tick(t + 61000);           // Bình hết giờ 2
  t = room4.turnAt;
  const gone = room4.tick(t + 61000);                // An hết giờ lần 3 liên tiếp → mất ghế
  out.push(["hết giờ 3 lần liên tiếp → mất ghế, đối thủ thắng", gone && room4.seatOf("aa") < 0 && room4.ev.k === "forfeit" && room4.ev.why === "timeout"]);
  // bản chụp qua lúc ngủ: giữ luật chuẩn; bản chụp ván luật cũ → bỏ ván đó, xếp lại
  const snap = JSON.parse(JSON.stringify(room.snapshot())), back = new PoolRoom(cfg);
  out.push(["bản chụp luật chuẩn: dựng lại giống hệt", !back.restore(snap, new Set(["aa", "bb"]), now) && same({ ...room.view(now), left: 0 }, { ...back.view(now), left: 0 })]);
  const old = new PoolRoom(cfg, { rules: 1 });
  old.join("aa", "An", now); old.join("bb", "Bình", now);
  const fresh = new PoolRoom(cfg), ch = fresh.restore(JSON.parse(JSON.stringify(old.snapshot())), new Set(["aa", "bb"]), now);
  out.push(["bản chụp ván luật cũ vào máy chủ luật chuẩn → ván mới luật chuẩn", ch && fresh.m.mode === "match" && fresh.m.rules === 2 && fresh.view(now).ev.k === "start"]);
  const bad = out.filter(([, ok]) => !ok).map(([n]) => n);
  report(!bad.length, `bàn bi-a của máy chủ (luật chuẩn) — ${out.length} tình huống`, bad.join("; "));
}

// ---------- 7. một ván trọn luật chuẩn: 2 người chơi giả + 1 người xem ----------
// cú phá đầu tiên cố ý rất nhẹ (không hợp lệ) → Bình chọn xếp lại và tự phá; đang đánh bi 8 thì gọi lỗ bi 8 sẽ vào; bi trong
// tay: giữ chỗ bi trắng đang nằm (cả bàn) — cú do máy chủ tự tính phải khớp từng bit với máy khách và người xem
function playMatchV2() {
  const room = new PoolRoom(cfg);
  let now = 0;
  room.join("p0", "An", now, 2);
  room.join("p1", "Bình", now, 2);
  let watcher = unpackBalls(table, room.view(now).b);
  const log = [];
  let mismatch = 0, rejected = 0, fouls = 0, inHand = 0, calls = 0, choices = 0;
  for (let i = 0; i < 300 && room.m.mode === "match"; i++) {
    const view = room.view(now), seat = view.turn, id = view.seats[seat].id;
    if (view.choice) {
      choices++;
      const c = choices === 1 ? "rerack" : "play";
      if (!room.choose(id, c, now).ok) { rejected++; break; }
      log.push([seat, "choice", c]);
      watcher = unpackBalls(table, room.view(now).b);
      continue;
    }
    const state = unpackBalls(table, view.b);
    let cue = null;
    if (view.inHand) { inHand++; cue = [state.balls[0].x, state.balls[0].z]; placeCue(state, cue[0], cue[1]); }
    let pick = i === 0 ? { angle: Math.PI / 2, power: 0.02, how: "soft_break" } : pickShot(table, state, targets(state, view, seat));
    const call = onEight(state, view, seat) ? callFor(state, pick.angle, pick.power) : null;
    if (call) calls++;
    const s = makeShotV2(view, pick.angle, pick.power, cue, call);
    const r = room.shot(id, s.msg, now);
    if (!r.ok) { rejected++; log.push([seat, "rejected", r.err]); break; }
    if (!same(r.shot.b, s.msg.b)) mismatch++;                       // máy chủ tự tính = máy khách
    let replay = cloneState(watcher);
    if (r.shot.cue) replay = placeCue(replay, r.shot.cue[0], r.shot.cue[1]);
    const res = simulateShot(table, replay, { angle: r.shot.a, power: r.shot.p }, { frames: false });
    if (!same(packBalls(res.finalState), r.shot.b)) mismatch++;     // người xem phát lại = máy chủ
    if (room.ev.foul) fouls++;
    watcher = unpackBalls(table, room.view(now).b);
    log.push([seat, pick.how, s.msg.k.join(","), room.m.turn, room.ev.foul?.why ?? ""]);
    now += (s.res.time + 2) * 1000;
  }
  return { room, log, mismatch, rejected, fouls, inHand, calls, choices };
}
{
  const a = playMatchV2(), b = playMatchV2();
  const m = a.room.m;
  report(m.mode === "over" && a.rejected === 0 && a.choices >= 1 && a.log[1]?.[2] === "rerack",
    `ván trọn luật chuẩn giữa 2 người chơi giả: ${a.log.length} lượt, ${m.winner === 0 ? "An" : "Bình"} thắng (${m.reason})`,
    `phá không hợp lệ → xếp lại ${a.choices} lần, lỗi ${a.fouls}, bi trong tay ${a.inHand}, gọi lỗ bi 8 ${a.calls}, bị chặn ${a.rejected}${a.rejected ? ` ${JSON.stringify(a.log.at(-1))}` : ""}`);
  report(a.mismatch === 0, "máy chủ tự tính = máy khách = người xem phát lại, từng bit", `lệch ${a.mismatch}`);
  report(same(a.log, b.log) && same(a.room.view(0).b, b.room.view(0).b), "chạy lại cả ván luật chuẩn → giống hệt (tất định)");
}

console.log(`${failed ? "✗" : "✓"} pool_rules: ${failed ? `${failed} mục hỏng` : "đạt hết"} (${Math.round(performance.now() - t0)} ms)`);
process.exit(failed ? 1 : 0);
