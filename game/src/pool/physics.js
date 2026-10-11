// Vật lý bi-a 2D trên mặt bàn (JS thuần, không dùng three.js) — chạy được trong trình duyệt và Node (scripts/tests/pool_physics.mjs).
// TẤT ĐỊNH: bước thời gian cố định 1/240 s; chỉ dùng + − × ÷ và Math.sqrt (cùng phép so sánh, Math.abs / min / max /
// floor — các phép này không làm tròn) → cùng đầu vào cho kết quả giống hệt từng bit trên mọi máy / trình duyệt
// (bước 3 chơi nhiều người cần điều này). Không dùng Math.sin / cos / hypot / pow / atan2 (mỗi engine làm tròn khác nhau):
// góc đánh đổi ra hướng bằng dsin / dcos (đa thức cố định).
//
// Toạ độ = toạ độ cục bộ của node pool_table (data/pool.json → "local"), đơn vị m: x = trục ngắn, z = trục dài
// (+z = đầu xếp bi, −z = đầu bi trắng). Góc đánh `angle` (rad): hướng (dcos(angle), dsin(angle)) trên (x, z) — 0 = +x,
// π/2 = +z (về phía xếp bi). Lực `power` 0..1.
//
// Mô hình: bi–bi đàn hồi (hệ số phục hồi 0,95, khối lượng bằng nhau, đẩy tách khi chồng), bi–băng 0,8 (băng là các đoạn
// thẳng chừa miệng lỗ; đầu đoạn = "hàm lỗ"), ma sát lăn giảm tốc dần (a + k·v), bi vào lỗ khi tâm bi lọt bán kính lỗ
// (pool.json → pockets[].radius) hoặc đã qua hẳn mép băng ở miệng lỗ.
//
// Xoáy (điểm chạm trên bi trắng, simulateShot → shot.spin / shot.roll, số nguyên −2 … +2; 0 = đánh tâm):
//   • spin (ngang, + = phải): mỗi bi có một số xoáy s (bi trắng lúc đánh: spin / 2, tức −1 … 1). Chạm băng → cộng vận tốc dọc
//     băng theo chiều xoáy, tỉ lệ với lực nảy (thuận chiều lăn thì mở góc, ngược thì khép góc), xoáy giảm còn RAIL_SPIN_KEEP;
//     bi trắng lệch nhẹ ngược phía xoáy lúc vừa đánh (SQUIRT, ~1° ở nấc 2); va bi → bi kia bị đẩy lệch rất nhẹ (THROW, ngược
//     phía xoáy) và nhận một phần xoáy ngược chiều (SPIN_XFER); xoáy giảm dần theo thời gian lăn (SPIN_DECAY), bi dừng thì hết.
//   • roll (lên / xuống, + = đánh đè, − = đánh kéo): ở lần va bi đầu tiên của bi trắng, bi trắng được cộng vận tốc theo hướng
//     nó đang chạy trước va chạm (đè: đi tiếp) hoặc ngược lại (kéo: lùi), tỉ lệ roll / 2 · FOLLOW_K · tốc độ trước va chạm, giảm
//     tuyến tính theo quãng đường đã lăn trước khi chạm (hết hẳn sau ROLL_DIST m).
//   • spin = roll = 0: không tạo trạng thái xoáy, mọi phép tính như bản trước khi có xoáy → giống từng bit (ván cũ, phát lại,
//     thử thách của anh Khang; scripts/tests/pool_physics.mjs so dấu vân tay).

export const DT = 1 / 240;
export const FRAME_STEPS = 4;           // ghi 1 khung mỗi 4 bước = 60 khung/giây (để vẽ)
export const MAX_SPEED = 5.5;           // m/s ở power = 1
export const MIN_SPEED = 0.15;          // m/s ở power = 0
export const BALL_E = 0.95;             // phục hồi bi–bi
export const RAIL_E = 0.8;              // phục hồi bi–băng
export const ROLL_A = 0.4;             // giảm tốc không đổi (m/s²)
export const ROLL_K = 0.1;             // giảm tốc theo vận tốc (1/s)
export const STOP_V = 0.01;             // dưới mức này thì bi dừng (m/s)
export const MAX_TIME = 30;             // giới hạn thời gian một cú (s) — quá thì dừng hết (không xảy ra với số liệu trên)
// xoáy (đầu file)
export const SPIN_LEVELS = 2;           // nấc −2 … +2 (ngang và lên / xuống)
export const SQUIRT = 0.01745;          // bi trắng lệch ngược phía xoáy lúc vừa đánh (rad ở nấc 2 ≈ 1°)
export const RAIL_SPIN = 0.2;           // chạm băng: vận tốc dọc băng thêm = RAIL_SPIN · s · lực nảy ((1 + RAIL_E) · vận tốc vào)
export const RAIL_SPIN_KEEP = 0.5;      // xoáy còn lại sau mỗi lần chạm băng
export const THROW = 0.03;              // va bi: đẩy lệch dọc tiếp tuyến = THROW · (s_a + s_b) · xung lực (≈ 1,7° ở nấc 2)
export const SPIN_XFER = 0.15;          // va bi: mỗi bi bớt SPIN_XFER · (s_a + s_b) (bi kia nhận xoáy ngược chiều)
export const SPIN_DECAY = 0.5;          // xoáy giảm theo thời gian lăn (1/s)
export const SPIN_MIN = 0.005;          // xoáy nhỏ hơn mức này coi như hết
export const FOLLOW_K = 0.7;            // đè / kéo ở nấc 2: cộng 0,7 × tốc độ trước va chạm
export const ROLL_DIST = 3.0;           // đè / kéo hết hẳn sau chừng ấy m lăn trước khi chạm bi

// ---------- sin / cos tất định ----------
const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966;
// đa thức Taylor trên [-π/4, π/4] (sai số < 1e-16), chỉ + − ×
function sinPoly(x) {
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800)))))));
}
function cosPoly(x) {
  const x2 = x * x;
  return 1 + x2 * (-1 / 2 + x2 * (1 / 24 + x2 * (-1 / 720 + x2 * (1 / 40320 + x2 * (-1 / 3628800 + x2 * (1 / 479001600 + x2 * (-1 / 87178291200)))))));
}
// quy về [-π/4, π/4] bằng bội số π/2 (Math.floor chính xác, không làm tròn)
function reduce(a) {
  const k = Math.floor(a / HALF_PI + 0.5);
  return { r: a - k * HALF_PI, q: ((k % 4) + 4) % 4 };
}
export function dsin(a) {
  const { r, q } = reduce(a);
  return q === 0 ? sinPoly(r) : q === 1 ? cosPoly(r) : q === 2 ? -sinPoly(r) : -cosPoly(r);
}
export function dcos(a) {
  const { r, q } = reduce(a);
  return q === 0 ? cosPoly(r) : q === 1 ? -sinPoly(r) : q === 2 ? -cosPoly(r) : sinPoly(r);
}

// ---------- bàn ----------
// cfg = data/pool.json. Băng: x = ±rx, z = ±rz (mũi băng, đo ở độ cao tâm bi); miệng lỗ: lỗ góc chừa `corner` m dọc mỗi
// băng từ góc, lỗ giữa chừa ±`side` m quanh tâm lỗ. Đầu mỗi đoạn băng là hàm lỗ (bi chạm điểm).
export function makeTable(cfg) {
  const r = cfg.ball_radius;
  const rx = cfg.play_area.local.x[1], rz = cfg.play_area.local.z[1];
  const pockets = cfg.pockets.map((p) => ({ id: p.id, x: p.local[0], z: p.local[2], r: p.radius, rmax: p.radius_max ?? p.radius,
    side: Math.abs(p.local[2]) < rz / 2 }));
  const cornerR = Math.max(...pockets.filter((p) => !p.side).map((p) => p.rmax));
  const sideR = Math.max(...pockets.filter((p) => p.side).map((p) => p.rmax));
  const corner = cornerR * 1.35, side = Math.max(sideR, 2.3 * r);
  // đoạn băng [x1, z1, x2, z2]
  const segs = [];
  for (const sx of [-1, 1]) {
    segs.push([sx * rx, -(rz - corner), sx * rx, -side]);       // băng dài: góc đầu bi trắng → lỗ giữa
    segs.push([sx * rx, side, sx * rx, rz - corner]);          // lỗ giữa → góc đầu xếp bi
  }
  for (const sz of [-1, 1]) segs.push([-(rx - corner), sz * rz, rx - corner, sz * rz]);   // băng ngắn
  const ballY = cfg.cloth_height + r;
  const rack = (cfg.balls || []).map((id, i) => {
    const p = cfg.rack?.[id]?.local;
    return { id, n: i, x: p ? p[0] : 0, z: p ? p[2] : 0 };
  });
  const head = rack[0] ? { x: rack[0].x, z: rack[0].z } : { x: 0, z: -rz / 2 };
  return { r, rx, rz, pockets, segs, corner, side, ballY, rack, head };
}

// ---------- trạng thái ----------
// state = { balls: [{ id, n, x, z, vx, vz, on, pocket }] } — on = còn trên bàn; pocket = id lỗ khi đã vào lỗ
export function cloneState(s) { return { balls: s.balls.map((b) => ({ ...b })) }; }

// đẩy tách các bi chồng nhau (vd vị trí xếp bi đo trên lưới sát nhau 0,3 mm) — lặp cố định, tất định
function separate(table, balls, iters = 12) {
  const d2min = 4 * table.r * table.r;
  for (let k = 0; k < iters; k++) {
    let moved = false;
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (!a.on) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (!b.on) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= d2min) continue;
        const d = Math.sqrt(d2);
        const nx = d > 0 ? dx / d : 1, nz = d > 0 ? dz / d : 0, push = (2 * table.r - d) / 2 + 1e-7;
        a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

// bàn xếp sẵn (vị trí pool.json → rack), bi trắng ở điểm đầu bàn
export function rackState(table) {
  const balls = table.rack.map((b) => ({ id: b.id, n: b.n, x: b.x, z: b.z, vx: 0, vz: 0, on: true, pocket: null }));
  separate(table, balls);
  return { balls };
}

// trạng thái tuỳ chọn: chỉ các bi trong `place` ({ n: [x, z] }) ở trên bàn (vd thử thách của anh Khang)
export function customState(table, place) {
  const balls = table.rack.map((b) => {
    const p = place[b.n];
    return { id: b.id, n: b.n, x: p ? p[0] : b.x, z: p ? p[1] : b.z, vx: 0, vz: 0, on: !!p, pocket: null };
  });
  separate(table, balls);
  return { balls };
}

const free = (table, balls, x, z, skip) => balls.every((b) => b === skip || !b.on || (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) >= 4.4 * table.r * table.r);

// đặt lại bi trắng (sau khi rơi lỗ): điểm đầu bàn `at` (mặc định table.head); bị chiếm thì dịch dần sang hai bên
export function respotCue(table, state, at = table.head) {
  const cue = state.balls[0];
  const step = 2.2 * table.r, lim = table.rx - table.r;
  for (let k = 0; k < 40; k++) {
    const off = (k % 2 === 0 ? 1 : -1) * Math.floor((k + 1) / 2) * step;
    const x = at.x + off;
    if (x < -lim || x > lim) continue;
    if (free(table, state.balls, x, at.z, cue)) { Object.assign(cue, { x, z: at.z, vx: 0, vz: 0, on: true, pocket: null }); return cue; }
  }
  Object.assign(cue, { x: at.x, z: at.z, vx: 0, vz: 0, on: true, pocket: null });
  return cue;
}

// ---------- một bước ----------
// → còn bi nào lăn không; ev(type, a, b, extra) ghi sự kiện. sp: trạng thái xoáy của cú (null = không xoáy — mọi phép tính như
// bản trước khi có xoáy): { s: Float64Array xoáy ngang mỗi bi (theo b.n), roll: đè / kéo của bi trắng (−1 … 1, 0 = đã dùng),
// dist: quãng đường bi trắng đã lăn trước lần va bi đầu tiên }
function step(table, balls, dt, ev, sp = null) {
  const r = table.r, rx = table.rx, rz = table.rz;
  // 1. di chuyển
  for (const b of balls) if (b.on && (b.vx !== 0 || b.vz !== 0)) { b.x += b.vx * dt; b.z += b.vz * dt; }
  if (sp && sp.roll !== 0) { const c = balls[0]; if (c.on) sp.dist += Math.sqrt(c.vx * c.vx + c.vz * c.vz) * dt; }
  // 2. bi–bi (thứ tự cặp cố định)
  const d2min = 4 * r * r;
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.on) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.on) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx > 2 * r || dx < -2 * r || dz > 2 * r || dz < -2 * r) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 >= d2min) continue;
      const d = Math.sqrt(d2);
      const nx = d > 0 ? dx / d : 1, nz = d > 0 ? dz / d : 0;
      const push = (2 * r - d) / 2;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
      const vrel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (vrel < 0) {
        const J = ((1 + BALL_E) * vrel) / 2;
        // đè / kéo: vận tốc bi trắng ngay trước lần va bi đầu tiên (bi trắng luôn là a: chỉ số 0)
        const roll = sp && sp.roll !== 0 && a.n === 0 ? sp.roll : 0, ux = a.vx, uz = a.vz;
        a.vx += J * nx; a.vz += J * nz; b.vx -= J * nx; b.vz -= J * nz;
        if (sp) {
          // xoáy ngang: đẩy lệch dọc tiếp tuyến (bi b sang trái hướng a → b khi xoáy phải), bớt xoáy cả hai bi
          const S = sp.s[a.n] + sp.s[b.n];
          if (S !== 0) {
            const k = -THROW * S * J, tx = nz, tz = -nx;      // −J > 0 (xung lực)
            b.vx += k * tx; b.vz += k * tz; a.vx -= k * tx; a.vz -= k * tz;
            sp.s[a.n] -= SPIN_XFER * S; sp.s[b.n] -= SPIN_XFER * S;
          }
          if (roll !== 0) {
            const keep = 1 - sp.dist / ROLL_DIST;
            if (keep > 0) { const f = roll * FOLLOW_K * keep; a.vx += ux * f; a.vz += uz * f; }
            sp.roll = 0;
          }
        }
        ev("ball", a.n, b.n, -vrel);
      }
    }
  }
  // 3. băng + hàm lỗ (khoảng cách tới đoạn thẳng < r)
  for (const b of balls) {
    if (!b.on) continue;
    // nhanh: còn xa mọi băng thì bỏ qua
    if (b.x > -rx + r + 1e-9 && b.x < rx - r - 1e-9 && b.z > -rz + r + 1e-9 && b.z < rz - r - 1e-9) continue;
    for (const s of table.segs) {
      const ex = s[2] - s[0], ez = s[3] - s[1];
      let t = ((b.x - s[0]) * ex + (b.z - s[1]) * ez) / (ex * ex + ez * ez);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = s[0] + ex * t, cz = s[1] + ez * t;
      const dx = b.x - cx, dz = b.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      // pháp tuyến: từ điểm gần nhất ra tâm bi; tâm bi nằm đúng trên đoạn (hiếm) → hướng vào trong bàn
      let d = Math.sqrt(d2), nx, nz;
      if (d > 1e-12) { nx = dx / d; nz = dz / d; }
      else if (ez === 0) { nx = 0; nz = s[1] > 0 ? -1 : 1; }
      else { nx = s[0] > 0 ? -1 : 1; nz = 0; }
      // bi ở phía ngoài băng (đã lọt vào miệng lỗ rồi quay lại) thì không kéo vào trong qua băng
      b.x = cx + nx * r; b.z = cz + nz * r;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) {
        b.vx -= (1 + RAIL_E) * vn * nx; b.vz -= (1 + RAIL_E) * vn * nz;
        // xoáy ngang: vận tốc dọc băng thêm theo chiều xoáy (tiếp tuyến (nz, −nx): xoáy phải đánh thẳng vào băng → bật sang phải)
        const sv = sp ? sp.s[b.n] : 0;
        if (sv !== 0) {
          const k = -RAIL_SPIN * sv * (1 + RAIL_E) * vn;
          b.vx += k * nz; b.vz -= k * nx;
          sp.s[b.n] = sv * RAIL_SPIN_KEEP;
        }
        ev("rail", b.n, -1, -vn);
      }
    }
  }
  // 4. lỗ: tâm bi lọt bán kính lỗ, hoặc đã qua hẳn mép băng (chỉ có thể ở miệng lỗ)
  for (const b of balls) {
    if (!b.on) continue;
    const out = b.x > rx + r || b.x < -rx - r || b.z > rz + r || b.z < -rz - r;
    let best = null, bd = Infinity;
    for (const p of table.pockets) {
      const dx = b.x - p.x, dz = b.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = p; }
    }
    if (out || bd < best.r * best.r) {
      b.on = false; b.pocket = best.id; b.vx = 0; b.vz = 0;
      if (sp) sp.s[b.n] = 0;
      ev("pocket", b.n, -1, best.id);
    }
  }
  // 5. ma sát lăn
  let moving = false;
  for (const b of balls) {
    if (!b.on || (b.vx === 0 && b.vz === 0)) continue;
    const s = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    const ns = s - (ROLL_A + ROLL_K * s) * dt;
    if (ns <= STOP_V) { b.vx = 0; b.vz = 0; if (sp) sp.s[b.n] = 0; continue; }
    const k = ns / s;
    b.vx *= k; b.vz *= k;
    if (sp && sp.s[b.n] !== 0) {
      const sv = sp.s[b.n] * (1 - SPIN_DECAY * dt);
      sp.s[b.n] = sv > SPIN_MIN || sv < -SPIN_MIN ? sv : 0;
    }
    moving = true;
  }
  return moving;
}

// bi dừng ở miệng lỗ mà tâm đã qua mép băng → rơi xuống lỗ gần nhất (không bi nào nằm ngoài mép băng)
function settle(table, balls, ev) {
  for (const b of balls) {
    if (!b.on || (b.x >= -table.rx && b.x <= table.rx && b.z >= -table.rz && b.z <= table.rz)) continue;
    let best = null, bd = Infinity;
    for (const p of table.pockets) { const d2 = (b.x - p.x) * (b.x - p.x) + (b.z - p.z) * (b.z - p.z); if (d2 < bd) { bd = d2; best = p; } }
    b.on = false; b.pocket = best.id;
    ev("pocket", b.n, -1, best.id);
  }
}

// nấc xoáy hợp lệ: số nguyên −2 … +2 (khác → 0 ở máy khách; máy chủ từ chối cú — server/src/pool.js)
export const spinLevel = (v) => (Number.isInteger(v) && v >= -SPIN_LEVELS && v <= SPIN_LEVELS ? v : 0);

// ---------- một cú ----------
// → { frames: Float32Array[] (mỗi khung [x0, z0, x1, z1, …], 60 khung/giây), events: [{ frame, type, a, b, v }],
//     finalState, pocketed: [n], firstContact: n | null, cueScratch, steps, time, stoppedNaturally }
// shot.spin / shot.roll: nấc xoáy ngang / đè – kéo (−2 … +2, mặc định 0 = đánh tâm; đầu file)
// opts.frames = false: không ghi khung (tính nhanh — kiểm thử, tìm cú gợi ý)
export function simulateShot(table, state, { angle, power, spin = 0, roll = 0 }, { frames: keepFrames = true } = {}) {
  const s = cloneState(state);
  const balls = s.balls, cue = balls[0];
  const p = power < 0 ? 0 : power > 1 ? 1 : power;
  const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * p;
  const sl = spinLevel(spin), rl = spinLevel(roll);
  // có xoáy: trạng thái xoáy riêng của cú (không ghi vào bi — bàn sau cú vẫn chỉ có vị trí); không xoáy: null → như bản cũ
  const sp = sl !== 0 || rl !== 0 ? { s: new Float64Array(balls.length), roll: rl / SPIN_LEVELS, dist: 0 } : null;
  if (sp) sp.s[0] = sl / SPIN_LEVELS;
  // bi trắng lệch nhẹ ngược phía xoáy (xoáy phải → lệch trái: góc nhỏ đi)
  const a0 = sl !== 0 ? angle - (SQUIRT * sl) / SPIN_LEVELS : angle;
  if (cue.on) { cue.vx = speed * dcos(a0); cue.vz = speed * dsin(a0); }
  const frames = [], events = [], pocketed = [];
  let firstContact = null, cueScratch = false, n = 0;
  const snap = () => {
    const f = new Float32Array(balls.length * 2);
    for (let i = 0; i < balls.length; i++) { f[i * 2] = balls[i].x; f[i * 2 + 1] = balls[i].z; }
    frames.push(f);
  };
  const ev = (type, a, b, v) => {
    if (type === "ball" && firstContact === null && (a === 0 || b === 0)) firstContact = a === 0 ? b : a;
    if (type === "pocket") { pocketed.push(a); if (a === 0) cueScratch = true; }
    events.push({ frame: Math.floor(n / FRAME_STEPS), type, a, b, v });
  };
  if (keepFrames) snap();
  const maxSteps = Math.floor(MAX_TIME / DT);
  let moving = cue.on;
  while (moving && n < maxSteps) {
    moving = step(table, balls, DT, ev, sp);
    n++;
    if (keepFrames && n % FRAME_STEPS === 0) snap();
  }
  const stoppedNaturally = !moving;
  for (const b of balls) { b.vx = 0; b.vz = 0; }
  settle(table, balls, ev);
  if (keepFrames) snap();
  return { frames, events, finalState: s, pocketed, firstContact, cueScratch, steps: n, time: n * DT, stoppedNaturally };
}

// ---------- ngắm (cho giao diện; không cần tất định) ----------
// đường đi thẳng của bi trắng theo góc: điểm chạm đầu tiên (bi ma) + hướng bi bị chạm, hoặc điểm chạm băng
export function aimInfo(table, state, angle) {
  const cue = state.balls[0], r = table.r;
  const dx = dcos(angle), dz = dsin(angle);
  let best = Infinity, hit = null;
  for (const b of state.balls) {
    if (b === cue || !b.on) continue;
    const ox = b.x - cue.x, oz = b.z - cue.z;
    const t = ox * dx + oz * dz;
    if (t <= 0) continue;
    const perp2 = ox * ox + oz * oz - t * t, rr = 4 * r * r;
    if (perp2 >= rr) continue;
    const tt = t - Math.sqrt(rr - perp2);
    if (tt < best) { best = tt; hit = b; }
  }
  // băng (tâm bi chạm băng ở ±(rx − r), ±(rz − r))
  const lim = (p, d, m) => (d > 0 ? (m - p) / d : d < 0 ? (-m - p) / d : Infinity);
  const tRail = Math.min(lim(cue.x, dx, table.rx - r), lim(cue.z, dz, table.rz - r));
  if (!hit || tRail < best) {
    const t = Math.max(0, tRail);
    return { contact: { x: cue.x + dx * t, z: cue.z + dz * t }, ball: null, dist: t };
  }
  const gx = cue.x + dx * best, gz = cue.z + dz * best;
  const ox = hit.x - gx, oz = hit.z - gz, ol = Math.sqrt(ox * ox + oz * oz) || 1;
  return { contact: { x: gx, z: gz }, ball: hit.n, dist: best, objDir: { x: ox / ol, z: oz / ol } };
}

// hướng bi trắng ngay sau lần chạm đầu tiên theo đường ngắm thẳng (gợi ý cho giao diện, không tất định, không mô phỏng): chạm
// bi → hướng trượt theo tiếp tuyến (va chạm đàn hồi) + đè / kéo; chạm băng → bật lại + xoáy ngang. → { from: {x, z} (tâm bi
// trắng lúc chạm), dir: {x, z} (đơn vị), speed: tốc độ sau chạm so với trước chạm } | null
export function cueAfter(table, state, angle, spin = 0, roll = 0) {
  const cue = state.balls[0], r = table.r;
  if (!cue.on) return null;
  const info = aimInfo(table, state, angle);
  const dx = dcos(angle), dz = dsin(angle), sl = spinLevel(spin) / SPIN_LEVELS, rl = spinLevel(roll) / SPIN_LEVELS;
  let vx, vz;
  if (info.ball != null) {
    const nx = info.objDir.x, nz = info.objDir.z, vn = dx * nx + dz * nz, k = ((1 + BALL_E) / 2) * vn;
    const keep = Math.max(0, 1 - info.dist / ROLL_DIST), f = rl * FOLLOW_K * keep;
    vx = dx - k * nx + dx * f; vz = dz - k * nz + dz * f;
  } else {
    const lim = (p, d, m) => (d > 0 ? (m - p) / d : d < 0 ? (-m - p) / d : Infinity);
    const onX = lim(cue.x, dx, table.rx - r) < lim(cue.z, dz, table.rz - r);
    const nx = onX ? (dx > 0 ? -1 : 1) : 0, nz = onX ? 0 : dz > 0 ? -1 : 1, vn = dx * nx + dz * nz;
    const k = RAIL_SPIN * sl * (1 + RAIL_E) * -vn;
    vx = dx - (1 + RAIL_E) * vn * nx + k * nz; vz = dz - (1 + RAIL_E) * vn * nz - k * nx;
  }
  const sp = Math.sqrt(vx * vx + vz * vz);
  if (sp < 1e-6) return { from: info.contact, dir: { x: dx, z: dz }, speed: 0 };
  return { from: info.contact, dir: { x: vx / sp, z: vz / sp }, speed: sp };
}

// tìm một cú đưa bi `target` vào lỗ (không làm rơi bi trắng): quét góc quanh hướng nhắm thẳng vào bi đó, vài mức lực.
// Tất định (dùng simulateShot) → dùng cho gợi ý / tự giải trong kiểm thử. → { angle, power } | null
export function findPottingShot(table, state, target, { spread = 0.35, stepRad = 0.004, powers = [0.3, 0.42, 0.55, 0.7] } = {}) {
  const cue = state.balls[0], t = state.balls[target];
  if (!cue.on || !t?.on) return null;
  const base = angleTo(cue.x, cue.z, t.x, t.z);
  for (let k = 0; k * stepRad <= spread; k++) {
    for (const sgn of k === 0 ? [1] : [1, -1]) {
      const a = base + sgn * k * stepRad;
      for (const power of powers) {
        const res = simulateShot(table, state, { angle: a, power }, { frames: false });
        if (res.pocketed.includes(target) && !res.cueScratch) return { angle: a, power };
      }
    }
  }
  return null;
}

// góc (theo quy ước của simulateShot) từ (x0, z0) tới (x1, z1) — atan2 bằng chuỗi + − × ÷ (tất định)
export function angleTo(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  return datan2(dz, dx);
}
// atan2(y, x) tất định: quy về |t| ≤ tan(π/12) rồi chuỗi lẻ
export function datan2(y, x) {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y);
  const swap = ay > ax;
  const t = swap ? ax / ay : ay / ax;           // 0..1
  const a = datan01(t);
  let r = swap ? HALF_PI - a : a;
  if (x < 0) r = PI - r;
  return y < 0 ? -r : r;
}
const TAN_PI_12 = 0.2679491924311227, PI_6 = 0.5235987755982988, SQRT3 = 1.7320508075688772;
function datan01(t) {
  // t ∈ [0, 1]: nếu t > tan(π/12) dùng atan(t) = π/6 + atan((t√3 − 1)/(t + √3))
  let off = 0;
  if (t > TAN_PI_12) { t = (t * SQRT3 - 1) / (t + SQRT3); off = PI_6; }
  const t2 = t * t;
  // chuỗi atan: t − t³/3 + t⁵/5 − … (|t| ≤ 0,268 → 12 số hạng, sai số < 1e-16)
  let s = 0, term = t, sign = 1;
  for (let k = 1; k <= 25; k += 2) { s += (sign * term) / k; term *= t2; sign = -sign; }
  return off + s;
}
