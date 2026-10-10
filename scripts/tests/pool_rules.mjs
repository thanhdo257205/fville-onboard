// npm run test:pool (phần 2, trong game/) — luật 8 bi rút gọn (game/src/pool/rules.js) và bàn bi-a của máy chủ
// (server/src/pool.js), bằng Node, không cần trình duyệt / máy chủ thật:
//   • luật: nhận nhóm, đánh tiếp khi vào bi nhóm mình, bi trắng rơi → đổi lượt + bi trong tay, bi 8 sớm / kèm bi trắng → thua,
//     bi 8 hợp lệ → thắng, bi 8 lúc phá → đặt lại
//   • bàn máy chủ: ngồi / tập một mình / người thứ 2 → ván mới (người ngồi trước phá), chặn cú sai lượt / lệch số cú / kết quả
//     không hợp lệ / đặt bi trắng sai chỗ, rời bàn giữa ván → đối thủ thắng, quá giờ lượt → mất ghế, ván mới người thua phá,
//     bản chụp qua lúc ngủ (hibernation)
//   • một ván trọn giữa 2 người chơi giả (chọn cú: game/src/pool/auto.js) + 1 người xem: người xem phát lại từng cú bằng
//     physics.js từ bàn của mình → khớp từng bit với kết quả người đánh; chạy lại cả ván → giống hệt
// In 1 dòng ✓/✗ cho mỗi mục; lỗi → thoát mã 1.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTable, rackState, customState, simulateShot, cloneState } from "../../game/src/pool/physics.js";
import { applyShot, newMatch, packBalls, unpackBalls, placeCue, canPlaceCue, roundState, targets, SOLID, STRIPE, kitchen } from "../../game/src/pool/rules.js";
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
  report(!bad.length, `luật 8 bi rút gọn — ${out.length} tình huống`, bad.join("; "));
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
  const room = new PoolRoom(cfg, { turnMs: 60000 });
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
  const back = new PoolRoom(cfg);
  const ch1 = back.restore(snap, new Set(["aa", "bb"]), now);
  const v1 = room.view(now), v2 = back.view(now);
  out.push(["bản chụp qua lúc ngủ: dựng lại giống hệt", !ch1 && same({ ...v1, left: 0 }, { ...v2, left: 0 })]);
  const back2 = new PoolRoom(cfg);
  const ch2 = back2.restore(snap, new Set(["aa"]), now);
  out.push(["bản chụp: người ngồi đã mất kết nối lúc ngủ → giải phóng ghế, đối thủ thắng", ch2 && back2.seats[1] === null && back2.m.mode === "solo" && back2.ev.k === "forfeit" && back2.ev.seat === 0]);
  // quá giờ lượt → mất ghế
  const who = room.seats[room.m.turn].id;
  out.push(["chưa hết giờ → giữ ghế", !room.tick(room.turnAt + 59000)]);
  out.push(["quá giờ lượt → mất ghế, đối thủ thắng", room.tick(room.turnAt + 61000) && room.seatOf(who) < 0 && room.ev.k === "forfeit" && room.ev.why === "timeout" && room.m.mode === "solo"]);
  // ván mới khi hết ván: người thua phá
  const room2 = new PoolRoom(cfg);
  room2.join("aa", "An", now); room2.join("bb", "Bình", now);
  room2.m = { ...room2.m, mode: "over", winner: 0, reason: "eight" };
  out.push(["hết ván, R → ván mới, người thua phá", room2.rerack("bb", now) && room2.m.mode === "match" && room2.m.turn === 1]);
  out.push(["giữa ván không xếp lại được", !room2.rerack("aa", now)]);
  out.push(["rời bàn giữa ván → đối thủ thắng, còn 1 người tập", room2.leave("bb", now) && room2.ev.k === "forfeit" && room2.ev.seat === 0 && room2.m.mode === "solo" && room2.seated === 1]);
  out.push(["người cuối rời bàn → bàn trống", room2.leave("aa", now) && room2.m.mode === "idle" && room2.seated === 0]);
  const bad = out.filter(([, ok]) => !ok).map(([n]) => n);
  report(!bad.length, `bàn bi-a của máy chủ — ${out.length} tình huống`, bad.join("; "));
}

// ---------- 3. một ván trọn: 2 người chơi giả + 1 người xem ----------
// scratchOnce: ghế 1 cố ý đánh bi trắng thẳng vào lỗ góc đầu bàn ở lượt đầu → ghế 0 có bi trong tay, đặt bi trắng ở chỗ
// khác chỗ máy chủ đặt sẵn
function playMatch({ scratchOnce = false } = {}) {
  const room = new PoolRoom(cfg);
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

console.log(`${failed ? "✗" : "✓"} pool_rules: ${failed ? `${failed} mục hỏng` : "đạt hết"} (${Math.round(performance.now() - t0)} ms)`);
process.exit(failed ? 1 : 0);
