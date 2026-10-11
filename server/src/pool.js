// Bàn bi-a chung của một phòng (bi-a bước 3, server/src/index.js gọi): 2 ghế, lượt, vị trí bi, bi đã vào lỗ, số thứ tự
// cú, nhóm trơn / sọc. Luật: game/src/pool/rules.js (dùng chung với game). 2 bộ luật (rules):
//   • 2 = luật chuẩn 8 bi "sọc trơn" (mặc định; tin chào báo features "pool_rules2", "pool_facts"): người đánh tự tính cú
//     (game/src/pool/physics.js, tất định) rồi gửi thông số (góc, lực, chỗ đặt bi trắng, lỗ gọi cho bi 8) + kết quả như luật
//     cũ + sự kiện cú (chạm bi đầu tiên, có chạm băng, số bi chạm băng, bi vào lỗ nào — rules.js wireFacts). Máy chủ KHÔNG
//     chạy vật lý (bản tự tính lại cú tốn 11–20 ms CPU mỗi cú phá trên Cloudflare, quá mốc 10 ms của gói Free): kiểm tra kết
//     quả + sự kiện cú hợp lý (factsFromWire), chỗ đặt bi trong tay (khu đầu bàn / cả bàn), lỗ đã gọi, áp luật chuẩn, rồi phát
//     cho cả zone; sau cú phá không hợp lệ người tới lượt chọn (pool_choice); hết giờ lượt = lỗi (3 lần liên tiếp → mất ghế).
//     Máy khách cũ (pool_join không kèm r: 2 + cf: 1 — chưa gửi sự kiện cú) không được ngồi.
//   • 1 = luật rút gọn cũ (biến POOL_RULES = "1" trong wrangler — bản máy chủ cũ, để thử máy khách mới với máy chủ cũ): người
//     đánh tự tính cú rồi gửi cả kết quả (vị trí bi khi dừng, bi vào lỗ theo thứ tự, thời gian lăn); máy chủ KHÔNG chạy vật
//     lý, chỉ kiểm tra kết quả hợp lệ (đúng người, đúng lượt, đúng số thứ tự cú, bi trong bàn, bi đã vào lỗ không quay lại…),
//     áp luật, rồi phát cho cả zone.
//   • Một người ngồi: tập một mình (mode "solo"), cú đánh vẫn phát cho người xem. Người thứ hai ngồi → xếp lại bi, ván 8 bi,
//     người ngồi trước phá bi (mode "match"). Hết ván (mode "over"): R = ván mới, người thua phá.
//   • Ghế được giải phóng khi: rời bàn (pool_leave), sang zone khác, mất kết nối, hoặc tới lượt mà quá turnMs không đánh
//     (luật cũ: ngay lần đầu; luật chuẩn: lần thứ maxTimeouts liên tiếp — các lần trước là lỗi; kiểm tra mỗi khi có tin tới;
//     người chờ gửi pool_poke khi hết giờ). Đang giữa ván → người còn lại thắng.
//   • snapshot() / restore(): giữ bàn qua lúc Durable Object ngủ (hibernation) — index.js cất vào attachment của người đang ngồi.
// JS thuần, chạy cả trong Node (scripts/tests/pool_rules.mjs).
import { makeTable, rackState, cloneState } from "../../game/src/pool/physics.js";
import { applyShot, applyShotV2, factsFromWire, onEight, newMatch, newMatchV2, idleMatch, packBalls, unpackBalls, validPacked, canPlaceCue,
  canPlaceCueIn, placeCue, roundState, round5, RULES_V2 } from "../../game/src/pool/rules.js";

const fin = (v, lim) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim;

export class PoolRoom {
  constructor(cfg, { turnMs = 60000, rules = RULES_V2, maxTimeouts = 3 } = {}) {
    this.table = makeTable(cfg);
    this.zone = cfg.zone;
    this.turnMs = turnMs;
    this.rules = rules === 1 ? 1 : RULES_V2;
    this.maxTimeouts = maxTimeouts;
    this.pocketIds = new Set(this.table.pockets.map((p) => p.id));
    this.seats = [null, null];          // { id, name }
    this.state = roundState(rackState(this.table));
    this.m = idleMatch();
    this.seq = 0;                       // số thứ tự cú (không bao giờ quay về 0) — cú gửi lên phải đúng số này
    this.shots = 0;                     // số cú từ lần xếp bi gần nhất (bảng điểm)
    this.ver = 0;                       // tăng mỗi lần bàn đổi (máy khách bỏ qua sự kiện đã thấy)
    this.turnAt = 0;                    // mốc bắt đầu tính giờ lượt hiện tại (ms)
    this.ev = null;
  }
  seatOf(id) { return this.seats.findIndex((s) => s?.id === id); }
  get seated() { return (this.seats[0] ? 1 : 0) + (this.seats[1] ? 1 : 0); }
  touch(ev) { this.ver++; this.ev = ev || null; }
  rack() { this.state = roundState(rackState(this.table)); this.shots = 0; }
  startMatch(breaker, now) {
    this.rack();
    this.m = this.rules === RULES_V2 ? newMatchV2(breaker) : newMatch(breaker);
    this.turnAt = now;
    this.touch({ k: "start", seat: breaker });
  }

  // ngồi vào ghế trống → { changed, seated }; hết ghế → seated false (người đó đứng xem). r: bộ luật máy khách hiểu, cf: máy
  // khách gửi sự kiện cú (pool_join {r, cf}) — bàn luật chuẩn không nhận máy khách cũ (err "version": máy khách cũ hết giờ chờ
  // → tập một mình, bàn không lệch)
  join(id, name, now, r = null, cf = false) {
    if (this.seatOf(id) >= 0) return { changed: false, seated: true };
    if (this.rules === RULES_V2 && (r !== RULES_V2 || !cf)) return { changed: false, seated: false, err: "version" };
    const i = this.seats.indexOf(null);
    if (i < 0) return { changed: false, seated: false };
    this.seats[i] = { id, name };
    if (this.seated === 2) this.startMatch(1 - i, now);         // người ngồi trước phá bi
    else { this.m = idleMatch("solo"); this.touch({ k: "sit", seat: i }); }
    return { changed: true, seated: true };
  }

  // rời ghế (why: "left" | "timeout") → true nếu bàn đổi. Đang giữa ván → người còn lại thắng, tập một mình tiếp
  leave(id, now, why = "left") {
    const i = this.seatOf(id);
    if (i < 0) return false;
    const name = this.seats[i].name, wasMatch = this.m.mode === "match";
    this.seats[i] = null;
    this.m = idleMatch(this.seated ? "solo" : "idle");
    this.touch(wasMatch ? { k: "forfeit", seat: 1 - i, why, name, id } : { k: "stand", seat: i, why, name, id });
    return true;
  }

  // R: tập một mình → xếp lại bi; hết ván → ván mới, người thua phá
  rerack(id, now) {
    if (this.seatOf(id) < 0) return false;
    if (this.m.mode === "solo") { this.rack(); this.touch({ k: "rerack" }); return true; }
    if (this.m.mode === "over" && this.seated === 2) { this.startMatch(1 - this.m.winner, now); return true; }
    return false;
  }

  // tới lượt mà quá giờ (gọi mỗi khi có tin tới): luật cũ → giải phóng ghế; luật chuẩn → lỗi (đối thủ có bi trong tay cả bàn,
  // đang chờ phá thì khu đầu bàn), lần thứ maxTimeouts liên tiếp → giải phóng ghế
  tick(now) {
    if (this.m.mode !== "match" || now - this.turnAt <= this.turnMs) return false;
    const seat = this.m.turn, s = this.seats[seat];
    if (!s) return false;
    if (this.rules !== RULES_V2) return this.leave(s.id, now, "timeout");
    const to = [...(this.m.to || [0, 0])];
    to[seat]++;
    if (to[seat] >= this.maxTimeouts) return this.leave(s.id, now, "timeout");
    this.m = { ...this.m, to, turn: 1 - seat, inHand: this.m.brk ? "kitchen" : "table", choice: null };
    this.turnAt = now;
    this.touch({ k: "foul", seat, why: "timeout", name: s.name, id: s.id });
    return true;
  }

  // luật chuẩn: sau cú phá không hợp lệ, người tới lượt chọn (pool_choice {c}): "rerack" = xếp lại và tự phá, "play" = đánh
  // tiếp từ bàn đang có → { ok } | { err }
  choose(id, c, now) {
    const i = this.seatOf(id);
    if (i < 0 || this.m.mode !== "match" || this.m.choice !== "break" || this.m.turn !== i) return { err: "choice" };
    if (c === "rerack") { this.rack(); this.m = { ...newMatchV2(i), to: [...(this.m.to || [0, 0])] }; }
    else if (c === "play") this.m = { ...this.m, choice: null };
    else return { err: "bad" };
    this.turnAt = now;
    this.touch({ k: "choice", seat: i, c });
    return { ok: true };
  }

  // cú đánh (luật chuẩn): m = { seq, a (góc), p (lực 0..1), cue: [x, z] | null (bi trong tay), call: id lỗ gọi cho bi 8, b / k / s
  // / d: kết quả như luật cũ, f / r / rb / kp: sự kiện cú (rules.js wireFacts) } → { ok, shot } | { err }
  shot(id, m, now) {
    if (this.rules !== RULES_V2) return this.shotV1(id, m, now);
    const i = this.seatOf(id);
    if (i < 0) return { err: "seat" };
    const mode = this.m.mode;
    if (mode !== "solo" && mode !== "match") return { err: "mode" };
    if (mode === "match" && this.m.turn !== i) return { err: "turn" };
    if (m.seq !== this.seq) return { err: "seq" };
    if (mode === "match" && this.m.choice) return { err: "choice" };
    if (!fin(m.a, 100) || !fin(m.p, 1) || m.p < 0) return { err: "bad" };
    const before = cloneState(this.state);
    let cue = null;
    if (m.cue != null) {
      const hand = mode === "match" ? this.m.inHand : false;
      if (!hand) return { err: "cue" };
      if (!Array.isArray(m.cue) || m.cue.length !== 2 || !m.cue.every((v) => fin(v, 10))) return { err: "bad" };
      cue = [round5(m.cue[0]), round5(m.cue[1])];
      if (!canPlaceCueIn(this.table, before, cue[0], cue[1], hand)) return { err: "cue" };
      placeCue(before, cue[0], cue[1]);
    }
    let call = null;
    if (mode === "match" && onEight(before, this.m, i)) {
      if (typeof m.call !== "string" || !this.pocketIds.has(m.call)) return { err: "call" };
      call = m.call;
    }
    const res = this.result(before, m);
    const facts = res && factsFromWire(this.table, before, res.k, m);
    if (!facts) return { err: "bad" };
    const r = applyShotV2(this.table, this.m, before, res.after, facts, call);
    if (r.m.to) { r.m.to = [...r.m.to]; r.m.to[i] = 0; }          // đã đánh → hết đếm số lần hết giờ liên tiếp
    this.m = r.m;
    this.state = roundState(r.state);
    const seq = this.seq++;
    this.shots++;
    this.turnAt = now + this.rollMs(m);                               // giờ lượt sau tính từ lúc bi dừng
    this.touch({ ...r.ev, by: id });
    return { ok: true, shot: { seq, by: id, a: m.a, p: m.p, cue, call, b: m.b } };   // b: người xem đối chiếu cú phát lại
  }

  // kết quả cú máy khách gửi (b: vị trí bi khi dừng — packBalls, k: bi vào lỗ theo thứ tự, s: bi trắng rơi) → { after, k, scratch }
  // | null. Bi vào lỗ = đúng những bi trên bàn trước cú mà nay không còn; bi đã vào lỗ từ trước không quay lại
  result(before, m) {
    if (!validPacked(this.table, m.b)) return null;
    const after = unpackBalls(this.table, m.b);
    if (after.balls.some((b) => b.on && !before.balls[b.n].on)) return null;
    const gone = before.balls.filter((b) => b.on && !after.balls[b.n].on).map((b) => b.n);
    const k = m.k;
    if (!Array.isArray(k) || k.length !== gone.length || new Set(k).size !== k.length || !k.every((n) => gone.includes(n))) return null;
    const scratch = k.includes(0);
    if (!!m.s !== scratch) return null;
    return { after, k, scratch };
  }
  // thời gian bi lăn máy khách báo (d, giây; tối đa 30) → ms
  rollMs(m) { return (fin(m.d, 60) && m.d > 0 ? Math.min(m.d, 30) : 0) * 1000; }

  // cú đánh (luật cũ): m = { seq, a (góc), p (lực 0..1), cue: [x, z] | null (bi trong tay), b: vị trí bi khi dừng (packBalls), k: bi vào
  // lỗ theo thứ tự, s: bi trắng rơi, d: thời gian lăn (s) } → { ok, shot } | { err }
  shotV1(id, m, now) {
    const i = this.seatOf(id);
    if (i < 0) return { err: "seat" };
    const mode = this.m.mode;
    if (mode !== "solo" && mode !== "match") return { err: "mode" };
    if (mode === "match" && this.m.turn !== i) return { err: "turn" };
    if (m.seq !== this.seq) return { err: "seq" };
    if (!fin(m.a, 100) || !fin(m.p, 1) || m.p < 0) return { err: "bad" };
    const before = cloneState(this.state);
    let cue = null;
    if (m.cue != null) {
      if (!(mode === "match" && this.m.inHand)) return { err: "cue" };
      if (!Array.isArray(m.cue) || m.cue.length !== 2 || !m.cue.every((v) => fin(v, 10))) return { err: "bad" };
      cue = [round5(m.cue[0]), round5(m.cue[1])];
      if (!canPlaceCue(this.table, before, cue[0], cue[1])) return { err: "cue" };
      placeCue(before, cue[0], cue[1]);
    }
    const out = this.result(before, m);
    if (!out) return { err: "bad" };
    const res = applyShot(this.table, this.m, before, out.after, { pocketed: out.k, scratch: out.scratch });
    this.m = res.m;
    this.state = roundState(res.state);
    const seq = this.seq++;
    this.shots++;
    this.turnAt = now + this.rollMs(m);                               // giờ lượt sau tính từ lúc bi dừng
    this.touch({ ...res.ev, by: id });
    return { ok: true, shot: { seq, by: id, a: m.a, p: m.p, cue, b: m.b } };   // b: người xem đối chiếu cú phát lại
  }

  // bàn gửi cho máy khách
  view(now) {
    const m = this.m;
    return {
      v: this.ver, seq: this.seq, n: this.shots, mode: m.mode, seats: this.seats.map((s) => s && { id: s.id, name: s.name }),
      turn: m.turn, groups: m.groups, inHand: m.inHand, brk: m.brk, winner: m.winner, reason: m.reason, rules: this.rules,
      choice: m.choice ?? null,
      left: m.mode === "match" ? Math.max(0, Math.ceil((this.turnAt + this.turnMs - now) / 1000)) : null,
      b: packBalls(this.state), ev: this.ev,
    };
  }

  // ---------- qua lúc Durable Object ngủ ----------
  snapshot() {
    return { v: this.ver, q: this.seq, n: this.shots, s: this.seats.map((s) => s && [s.id, s.name]), m: this.m, b: packBalls(this.state), ta: this.turnAt, e: this.ev };
  }
  // live: id người còn kết nối — ghế của người đã đi (đóng kết nối lúc DO ngủ) được giải phóng. → true nếu có ghế bị giải phóng
  restore(snap, live, now) {
    if (!snap || !Array.isArray(snap.b) || !validPacked(this.table, snap.b)) return false;
    this.ver = snap.v | 0;
    this.seq = snap.q | 0;
    this.shots = snap.n | 0;
    this.seats = [0, 1].map((i) => (Array.isArray(snap.s?.[i]) ? { id: snap.s[i][0], name: snap.s[i][1] } : null));
    this.m = { ...idleMatch(), ...snap.m, groups: [...(snap.m?.groups || [null, null])] };
    // bản chụp của ván luật khác (vừa đổi POOL_RULES / bản máy chủ) → không trộn 2 bộ luật: bỏ ván đó, xếp lại
    const stale = (this.m.mode === "match" || this.m.mode === "over") && (this.m.rules ?? 1) !== this.rules;
    this.state = unpackBalls(this.table, snap.b);
    this.turnAt = snap.ta || now;
    this.ev = snap.e || null;
    let changed = false;
    if (stale) { if (this.seated === 2) this.startMatch(0, now); else this.m = idleMatch(this.seated ? "solo" : "idle"); changed = true; }
    for (const s of [...this.seats]) if (s && !live.has(s.id)) changed = this.leave(s.id, now, "left") || changed;
    return changed;
  }
}
