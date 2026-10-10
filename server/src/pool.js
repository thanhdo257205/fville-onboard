// Bàn bi-a chung của một phòng (bi-a bước 3, server/src/index.js gọi): 2 ghế, lượt, vị trí bi, bi đã vào lỗ, số thứ tự
// cú, nhóm trơn / sọc. Luật 8 bi rút gọn: game/src/pool/rules.js (dùng chung với game).
//   • Người đánh tự tính cú bằng game/src/pool/physics.js (tất định) rồi gửi thông số (góc, lực, chỗ đặt bi trắng) + kết
//     quả (vị trí bi khi dừng, bi vào lỗ theo thứ tự, thời gian lăn). Máy chủ KHÔNG chạy vật lý: chỉ kiểm tra kết quả hợp lệ
//     (đúng người, đúng lượt, đúng số thứ tự cú, bi trong bàn, bi đã vào lỗ không quay lại…), áp luật, rồi phát cho cả zone.
//   • Một người ngồi: tập một mình (mode "solo"), cú đánh vẫn phát cho người xem. Người thứ hai ngồi → xếp lại bi, ván 8 bi,
//     người ngồi trước phá bi (mode "match"). Hết ván (mode "over"): R = ván mới, người thua phá.
//   • Ghế được giải phóng khi: rời bàn (pool_leave), sang zone khác, mất kết nối, hoặc tới lượt mà quá turnMs không đánh
//     (kiểm tra mỗi khi có tin tới; người chờ gửi pool_poke khi hết giờ). Đang giữa ván → người còn lại thắng.
//   • snapshot() / restore(): giữ bàn qua lúc Durable Object ngủ (hibernation) — index.js cất vào attachment của người đang ngồi.
// JS thuần, chạy cả trong Node (scripts/tests/pool_rules.mjs).
import { makeTable, rackState, cloneState } from "../../game/src/pool/physics.js";
import { applyShot, newMatch, idleMatch, packBalls, unpackBalls, validPacked, canPlaceCue, placeCue, roundState, round5 } from "../../game/src/pool/rules.js";

const fin = (v, lim) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim;

export class PoolRoom {
  constructor(cfg, { turnMs = 60000 } = {}) {
    this.table = makeTable(cfg);
    this.zone = cfg.zone;
    this.turnMs = turnMs;
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
    this.m = newMatch(breaker);
    this.turnAt = now;
    this.touch({ k: "start", seat: breaker });
  }

  // ngồi vào ghế trống → { changed, seated }; hết ghế → seated false (người đó đứng xem)
  join(id, name, now) {
    if (this.seatOf(id) >= 0) return { changed: false, seated: true };
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

  // tới lượt mà quá giờ → giải phóng ghế (gọi mỗi khi có tin tới)
  tick(now) {
    if (this.m.mode !== "match" || now - this.turnAt <= this.turnMs) return false;
    const s = this.seats[this.m.turn];
    return s ? this.leave(s.id, now, "timeout") : false;
  }

  // cú đánh: m = { seq, a (góc), p (lực 0..1), cue: [x, z] | null (bi trong tay), b: vị trí bi khi dừng (packBalls), k: bi vào
  // lỗ theo thứ tự, s: bi trắng rơi, d: thời gian lăn (s) } → { ok, shot } | { err }
  shot(id, m, now) {
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
    if (!validPacked(this.table, m.b)) return { err: "bad" };
    const after = unpackBalls(this.table, m.b);
    // bi vào lỗ = đúng những bi trên bàn trước cú mà nay không còn; bi đã vào lỗ từ trước không quay lại
    if (after.balls.some((b) => b.on && !before.balls[b.n].on)) return { err: "bad" };
    const gone = before.balls.filter((b) => b.on && !after.balls[b.n].on).map((b) => b.n);
    const k = m.k;
    if (!Array.isArray(k) || k.length !== gone.length || new Set(k).size !== k.length || !k.every((n) => gone.includes(n))) return { err: "bad" };
    const scratch = k.includes(0);
    if (!!m.s !== scratch) return { err: "bad" };
    const res = applyShot(this.table, this.m, before, after, { pocketed: k, scratch });
    this.m = res.m;
    this.state = roundState(res.state);
    const seq = this.seq++;
    this.shots++;
    // giờ lượt sau tính từ lúc bi dừng (máy khách phát lại cú trong d giây)
    this.turnAt = now + (fin(m.d, 60) && m.d > 0 ? Math.min(m.d, 30) : 0) * 1000;
    this.touch({ ...res.ev, by: id });
    return { ok: true, shot: { seq, by: id, a: m.a, p: m.p, cue, b: m.b } };   // b: người xem đối chiếu cú phát lại
  }

  // bàn gửi cho máy khách
  view(now) {
    const m = this.m;
    return {
      v: this.ver, seq: this.seq, n: this.shots, mode: m.mode, seats: this.seats.map((s) => s && { id: s.id, name: s.name }),
      turn: m.turn, groups: m.groups, inHand: m.inHand, brk: m.brk, winner: m.winner, reason: m.reason,
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
    this.state = unpackBalls(this.table, snap.b);
    this.turnAt = snap.ta || now;
    this.ev = snap.e || null;
    let changed = false;
    for (const s of [...this.seats]) if (s && !live.has(s.id)) changed = this.leave(s.id, now, "left") || changed;
    return changed;
  }
}
