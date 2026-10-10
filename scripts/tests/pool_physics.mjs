// npm run test:pool (trong game/) — kiểm tra vật lý bi-a (game/src/pool/physics.js) bằng Node, không cần trình duyệt:
//   • 1.000 cú phá bi ngẫu nhiên (PRNG có hạt giống cố định): không NaN, sau khi dừng không bi nào chồng lên nhau, không
//     bi nào nằm ngoài mép băng, mọi bi tự dừng trong thời gian giới hạn
//   • tất định: chạy lại cùng đầu vào → kết quả giống hệt từng số (so từng bit vị trí cuối, danh sách bi vào lỗ, số bước)
//   • thử thách "Một cú bi-a" của anh Khang (interactables.json → minigames.billiards): thế bi giải được bằng 1 cú
//   • đo thời gian tính 1 cú
// In 1 dòng ✓/✗ cho mỗi mục; lỗi → thoát mã 1.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTable, rackState, customState, simulateShot, findPottingShot, dsin, dcos, datan2 } from "../../game/src/pool/physics.js";

const t0 = performance.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cfg = JSON.parse(readFileSync(join(ROOT, "data", "pool.json"), "utf8"));
const mg = JSON.parse(readFileSync(join(ROOT, "data", "interactables.json"), "utf8")).minigames.billiards;
const table = makeTable(cfg);
const N = +(process.argv.find((a) => a.startsWith("--shots="))?.slice(8) || 1000);
let failed = 0;
const report = (ok, name, detail = "") => { if (!ok) failed++; console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`); };

// PRNG mulberry32 (hạt giống cố định → cùng 1.000 cú mỗi lần chạy)
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(20261010);

// 0. sin / cos / atan2 tất định gần đúng Math.*
let trigErr = 0;
for (let a = -20; a <= 20; a += 0.0137) trigErr = Math.max(trigErr, Math.abs(dsin(a) - Math.sin(a)), Math.abs(dcos(a) - Math.cos(a)));
for (let k = 0; k < 2000; k++) { const y = rand() * 4 - 2, x = rand() * 4 - 2; trigErr = Math.max(trigErr, Math.abs(datan2(y, x) - Math.atan2(y, x))); }
report(trigErr < 1e-13, "dsin / dcos / datan2 khớp Math.sin / cos / atan2", `sai số lớn nhất ${trigErr.toExponential(1)}`);

// 1. 1.000 cú phá bi
const rack = rackState(table);
const shots = [];
for (let i = 0; i < N; i++) {
  const s = rackState(table);
  s.balls[0].x = (rand() * 2 - 1) * (table.rx - 2 * table.r);              // bi trắng ở vạch đầu bàn, lệch ngang ngẫu nhiên
  const aim = datan2(rack.balls[1].z - s.balls[0].z, rack.balls[1].x - s.balls[0].x);
  shots.push({ state: s, shot: { angle: aim + (rand() * 2 - 1) * 0.06, power: 0.35 + rand() * 0.65 } });
}
const bad = { nan: [], overlap: [], outside: [], slow: [] };
let maxT = 0, totalSteps = 0, potted = 0, scratches = 0, maxOverlap = 0;
const tSim = performance.now();
const results = shots.map(({ state, shot }, i) => {
  const res = simulateShot(table, state, shot, { frames: false });
  totalSteps += res.steps;
  maxT = Math.max(maxT, res.time);
  potted += res.pocketed.filter((n) => n !== 0).length;
  if (res.cueScratch) scratches++;
  if (!res.stoppedNaturally || res.time > 20) bad.slow.push(i);
  const on = res.finalState.balls.filter((b) => b.on);
  if (res.finalState.balls.some((b) => !Number.isFinite(b.x) || !Number.isFinite(b.z) || !Number.isFinite(b.vx) || !Number.isFinite(b.vz))) bad.nan.push(i);
  for (const b of on) if (b.x < -table.rx || b.x > table.rx || b.z < -table.rz || b.z > table.rz) { bad.outside.push(i); break; }
  for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) {
    const d = Math.sqrt((on[a].x - on[b].x) ** 2 + (on[a].z - on[b].z) ** 2);
    const ov = 2 * table.r - d;
    if (ov > maxOverlap) maxOverlap = ov;
    if (ov > 1e-6) { bad.overlap.push(i); a = on.length; break; }
  }
  return res;
});
const msShot = (performance.now() - tSim) / N;
report(!bad.nan.length, `${N} cú phá bi: không NaN`, bad.nan.length ? `cú ${bad.nan.slice(0, 5)}` : "");
report(!bad.overlap.length, "sau khi dừng không bi nào chồng lên nhau", `${bad.overlap.length ? `${bad.overlap.length} cú, vd ${bad.overlap.slice(0, 5)}; ` : ""}chồng lớn nhất ${(maxOverlap * 1000).toFixed(4)} mm`);
report(!bad.outside.length, "không bi nào ra ngoài mép băng", bad.outside.length ? `${bad.outside.length} cú, vd ${bad.outside.slice(0, 5)}` : "");
report(!bad.slow.length, "mọi bi tự dừng trong 20 giây", `lâu nhất ${maxT.toFixed(1)} s${bad.slow.length ? `; ${bad.slow.length} cú quá giờ` : ""}`);

// 2. tất định: chạy lại toàn bộ, so từng bit
const bits = (x) => { const b = new Float64Array([x]); return new BigUint64Array(b.buffer)[0]; };
let diff = 0;
shots.forEach(({ state, shot }, i) => {
  const a = results[i], b = simulateShot(table, state, shot, { frames: false });
  const same = a.steps === b.steps && a.pocketed.join() === b.pocketed.join() && a.firstContact === b.firstContact
    && a.finalState.balls.every((x, k) => bits(x.x) === bits(b.finalState.balls[k].x) && bits(x.z) === bits(b.finalState.balls[k].z) && x.on === b.finalState.balls[k].on);
  if (!same) diff++;
});
// kèm khung hình: cùng kết quả với chế độ không ghi khung
const withFrames = simulateShot(table, shots[0].state, shots[0].shot);
const sameFrames = withFrames.steps === results[0].steps && withFrames.finalState.balls.every((x, k) => bits(x.x) === bits(results[0].finalState.balls[k].x));
report(diff === 0 && sameFrames, "tất định: chạy lại cùng đầu vào → giống hệt từng bit", `${N} cú${diff ? `, ${diff} cú khác` : ""}; ${withFrames.frames.length} khung (60/s) ở cú đầu`);

// 3. thử thách của anh Khang: thế bi dễ giải được trong 1 cú
const ch = mg.setup;
const cs = customState(table, { 0: ch.cue, [ch.ball]: ch.object });
const sol = findPottingShot(table, cs, ch.ball);
report(!!sol, `thử thách "${mg.title.en}": bi ${ch.ball} vào lỗ được bằng 1 cú`, sol ? `góc ${sol.angle.toFixed(3)} rad, lực ${sol.power}` : "không tìm được cú nào");

// 4. thời gian
const ms = Math.round(performance.now() - t0);
console.log(`  trung bình ${msShot.toFixed(2)} ms / cú (${Math.round(totalSteps / N)} bước), ${(potted / N).toFixed(2)} bi vào lỗ / cú phá, bi trắng rơi ${scratches} / ${N}`);
console.log(failed ? `✗ test:pool: ${failed} mục lỗi (${ms} ms)` : `✓ test:pool: đạt hết (${ms} ms)`);
process.exit(failed ? 1 : 0);
