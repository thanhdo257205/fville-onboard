// npm run test:pool (trong game/) — kiểm tra vật lý bi-a (game/src/pool/physics.js) bằng Node, không cần trình duyệt:
//   • 1.000 cú phá bi ngẫu nhiên (PRNG có hạt giống cố định): không NaN, sau khi dừng không bi nào chồng lên nhau, không
//     bi nào nằm ngoài mép băng, mọi bi tự dừng trong thời gian giới hạn
//   • tất định: chạy lại cùng đầu vào → kết quả giống hệt từng số (so từng bit vị trí cuối, danh sách bi vào lỗ, số bước)
//   • thử thách "Một cú bi-a" của anh Khang (interactables.json → minigames.billiards): thế bi giải được bằng 1 cú
//   • xoáy (spin ngang / roll đè – kéo, nấc −2 … +2): spin = roll = 0 giống từng bit bản trước khi có xoáy (dấu vân tay 300 cú
//     ghi lại từ bản cũ + cú gợi ý của thử thách); 1.000 cú phá với xoáy ngẫu nhiên không NaN / chồng bi / ra ngoài bàn, chạy lại
//     giống từng bit; xoáy phải / trái làm bi bật băng lệch đúng chiều (thuận mở góc, ngược khép góc); đè → bi trắng đi tiếp,
//     kéo → bi trắng lùi; bi trắng lệch ~1° ngược phía xoáy lúc đánh; va bi chỉ đẩy bi kia lệch rất nhẹ
//   • đo thời gian tính 1 cú
// In 1 dòng ✓/✗ cho mỗi mục; lỗi → thoát mã 1.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeTable, rackState, customState, simulateShot, findPottingShot, dsin, dcos, datan2, SQUIRT } from "../../game/src/pool/physics.js";

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

// 4. xoáy
// 4a. spin = roll = 0 giống từng bit bản trước khi có xoáy: dấu vân tay (FNV-1a 64 bit) của 300 cú (phá bi + cú nối tiếp nhau,
// góc / lực ngẫu nhiên): số bước, số khung, vị trí cuối, mọi sự kiện, 2 khung — giá trị ghi từ physics.js trước khi có xoáy
// (main 8327163). Đổi vật lý của cú không xoáy thì phải cập nhật có chủ ý (ván cũ / phát lại / thử thách sẽ khác).
const OLD_PRINT = "f97833fdcb8daa82", OLD_SOLUTION = { angle: 0.889803689946292, power: 0.3 };
function fingerprint(extra) {
  const r2 = rng(777);
  let h = 0xcbf29ce484222325n;
  const mix = (x) => { h ^= BigInt.asUintN(64, x); h = BigInt.asUintN(64, h * 0x100000001b3n); };
  let st = rackState(table);
  for (let i = 0; i < 300; i++) {
    let s;
    if (i % 3 === 0) { s = rackState(table); s.balls[0].x = (r2() * 2 - 1) * (table.rx - 2 * table.r); } else s = st;
    if (!s.balls[0].on) s = rackState(table);
    const aim = i % 3 === 0 ? datan2(rack.balls[1].z - s.balls[0].z, rack.balls[1].x - s.balls[0].x) + (r2() * 2 - 1) * 0.06 : r2() * 6.283;
    const res = simulateShot(table, s, { angle: aim, power: 0.2 + r2() * 0.8, ...extra });
    mix(BigInt(res.steps)); mix(BigInt(res.frames.length));
    for (const b of res.finalState.balls) { mix(bits(b.x)); mix(bits(b.z)); mix(b.on ? 1n : 0n); }
    for (const e of res.events) { mix(BigInt(e.frame)); mix(BigInt(e.a + 1)); mix(BigInt(e.b + 2)); if (typeof e.v === "number") mix(bits(e.v)); }
    for (const f of [res.frames[1], res.frames[Math.floor(res.frames.length / 2)]]) if (f) for (const v of f) mix(bits(v));
    st = res.finalState;
  }
  return h.toString(16);
}
const fpNone = fingerprint({}), fpZero = fingerprint({ spin: 0, roll: 0 }), fpBad = fingerprint({ spin: 7, roll: 0.5 });
report(fpNone === OLD_PRINT && fpZero === OLD_PRINT && fpBad === OLD_PRINT && sol?.angle === OLD_SOLUTION.angle && sol?.power === OLD_SOLUTION.power,
  "spin = roll = 0 (hoặc nấc không hợp lệ) giống từng bit bản trước khi có xoáy",
  `dấu vân tay 300 cú ${fpNone}${fpZero !== fpNone ? ` / 0: ${fpZero}` : ""}${fpBad !== fpNone ? ` / sai nấc: ${fpBad}` : ""} (cần ${OLD_PRINT}); cú gợi ý thử thách ${sol?.angle}, ${sol?.power}`);

// 4b. 1.000 cú phá với xoáy ngẫu nhiên: như mục 1 + chạy lại giống từng bit
const randS = rng(20261011);
const lv = () => Math.floor(randS() * 5) - 2;
const spinShots = shots.map(({ state, shot }) => ({ state, shot: { ...shot, spin: lv(), roll: lv() } }));
const sbad = { nan: 0, overlap: 0, outside: 0, slow: 0 };
let sdiff = 0, sdifferent = 0;
for (const [i, { state, shot }] of spinShots.entries()) {
  const res = simulateShot(table, state, shot, { frames: false });
  if (!res.stoppedNaturally || res.time > 20) sbad.slow++;
  const on = res.finalState.balls.filter((b) => b.on);
  if (res.finalState.balls.some((b) => !Number.isFinite(b.x) || !Number.isFinite(b.z))) sbad.nan++;
  if (on.some((b) => b.x < -table.rx || b.x > table.rx || b.z < -table.rz || b.z > table.rz)) sbad.outside++;
  let ov = false;
  for (let a = 0; a < on.length && !ov; a++) for (let b = a + 1; b < on.length; b++) if (2 * table.r - Math.sqrt((on[a].x - on[b].x) ** 2 + (on[a].z - on[b].z) ** 2) > 1e-6) { ov = true; break; }
  if (ov) sbad.overlap++;
  const again = simulateShot(table, state, shot, { frames: false });
  if (again.steps !== res.steps || again.pocketed.join() !== res.pocketed.join() || again.finalState.balls.some((x, k) => bits(x.x) !== bits(res.finalState.balls[k].x) || bits(x.z) !== bits(res.finalState.balls[k].z))) sdiff++;
  if ((shot.spin || shot.roll) && res.finalState.balls.some((x, k) => x.x !== results[i].finalState.balls[k].x)) sdifferent++;
}
const withSpin = spinShots.filter((x) => x.shot.spin || x.shot.roll).length;
report(!sbad.nan && !sbad.overlap && !sbad.outside && !sbad.slow, `${N} cú phá có xoáy ngẫu nhiên: không NaN / chồng bi / ra ngoài bàn, tự dừng`,
  Object.entries(sbad).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", "));
report(sdiff === 0 && sdifferent > withSpin * 0.9, "có xoáy: chạy lại giống hệt từng bit, khác kết quả đánh tâm", `${sdiff} cú khác khi chạy lại; ${sdifferent} / ${withSpin} cú có xoáy ra bàn khác cú đánh tâm`);

// 4c. xoáy ngang khi chạm băng: bi trắng ở giữa bàn đánh thẳng vào băng xa (+z) → bật lại lệch sang phải (−x: bên phải người
// đánh nhìn về +z) khi xoáy phải, sang trái khi xoáy trái; đánh xiên: xoáy thuận chiều lăn (lăn +x → xoáy trái) mở góc, ngược khép
const bounce = (angle, spin) => {
  const res = simulateShot(table, customState(table, { 0: [0, 0] }), { angle, power: 0.4, spin });
  const e = res.events.find((x) => x.type === "rail"), f = res.frames;
  const a = f[e.frame + 4], b = f[e.frame + 10];
  return { vx: (b[0] - a[0]) * 10, vz: (b[1] - a[1]) * 10 };
};
const deg = (x) => (x * 180) / Math.PI;
const straight = [-2, -1, 0, 1, 2].map((sp) => bounce(Math.PI / 2, sp));
const sAng = straight.map((v) => deg(datan2(-v.vx, -v.vz)));      // góc lệch sang phải (độ) so với bật thẳng về −z
const slant = [-2, 0, 2].map((sp) => bounce(Math.PI / 2 - 0.35, sp));
const slAng = slant.map((v) => deg(datan2(Math.abs(v.vx), -v.vz)));   // góc bật so với pháp tuyến
report(sAng[0] < sAng[1] && sAng[1] < sAng[2] && sAng[2] < sAng[3] && sAng[3] < sAng[4] && Math.abs(sAng[2]) < 1e-9 && sAng[4] > 8 && Math.abs(sAng[0] + sAng[4]) < 1e-6
  && slAng[0] > slAng[1] && slAng[1] > slAng[2],
  "xoáy ngang: bật băng lệch đúng chiều (phải → sang phải, trái → sang trái), xoáy thuận mở góc / ngược khép góc",
  `đánh thẳng vào băng, nấc −2…+2: ${sAng.map((a) => a.toFixed(1)).join(" / ")}°; đánh xiên (lăn +x), xoáy −2 / 0 / +2: góc bật ${slAng.map((a) => a.toFixed(1)).join(" / ")}°`);

// 4d. đè / kéo: bi trắng (0, −0,6) đánh thẳng bi 1 (0, −0,2) — đè: bi trắng đi tiếp qua chỗ chạm, kéo: lùi về phía mình
const contactZ = -0.2 - 2 * table.r;
const rollRes = [-2, -1, 0, 1, 2].map((roll) => simulateShot(table, customState(table, { 0: [0, -0.6], 1: [0, -0.2] }), { angle: Math.PI / 2, power: 0.15, roll }, { frames: false }).finalState.balls[0].z);
report(rollRes.every((z, i) => i === 0 || z > rollRes[i - 1]) && rollRes[4] > contactZ + 0.1 && rollRes[0] < contactZ - 0.1 && Math.abs(rollRes[2] - contactZ) < 0.05,
  "đè → bi trắng đi tiếp, kéo → bi trắng lùi (đánh thẳng)", `bi trắng dừng ở z (chỗ chạm ${contactZ.toFixed(3)}): ${rollRes.map((z) => z.toFixed(3)).join(" / ")} (kéo 2 … đè 2)`);

// 4e. bi trắng lệch ngược phía xoáy lúc đánh (~1° ở nấc 2); va bi: bi kia lệch rất nhẹ (cú đánh gần, thẳng)
// góc lệch sang phải người đánh (−x khi đánh về +z), độ
const startDir = (spin) => { const f = simulateShot(table, customState(table, { 0: [0, 0] }), { angle: Math.PI / 2, power: 0.3, spin }).frames; return deg(datan2(-(f[2][0] - f[1][0]), f[2][1] - f[1][1])); };
const sq = [startDir(-2), startDir(2)];
const objDir = (spin) => {
  const res = simulateShot(table, customState(table, { 0: [0, -0.3], 1: [0, -0.3 + 2 * table.r + 0.002] }), { angle: Math.PI / 2, power: 0.3, spin });
  const e = res.events.find((x) => x.type === "ball"), f = res.frames;
  return deg(datan2(f[e.frame + 6][2] - f[e.frame + 2][2], f[e.frame + 6][3] - f[e.frame + 2][3]));
};
const od = [objDir(-2), objDir(0), objDir(2)];
report(Math.abs(sq[0] - deg(SQUIRT)) < 0.01 && Math.abs(sq[1] + deg(SQUIRT)) < 0.01 && Math.abs(od[1]) < 1e-6 && Math.abs(od[0]) > 0.05 && Math.abs(od[0]) < 3 && Math.abs(od[2]) < 3,
  "bi trắng lệch ~1° ngược phía xoáy lúc đánh; va bi: bi kia lệch rất nhẹ",
  `bi trắng lệch sang phải lúc đánh: xoáy trái ${sq[0].toFixed(2)}°, xoáy phải ${sq[1].toFixed(2)}°; bi 1 sau va chạm gần (xoáy −2 / 0 / +2): ${od.map((a) => a.toFixed(2)).join(" / ")}°`);

// 5. thời gian
const ms = Math.round(performance.now() - t0);
console.log(`  trung bình ${msShot.toFixed(2)} ms / cú (${Math.round(totalSteps / N)} bước), ${(potted / N).toFixed(2)} bi vào lỗ / cú phá, bi trắng rơi ${scratches} / ${N}`);
console.log(failed ? `✗ test:pool: ${failed} mục lỗi (${ms} ms)` : `✓ test:pool: đạt hết (${ms} ms)`);
process.exit(failed ? 1 : 0);
