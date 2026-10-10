// Bàn bi-a zone 5 (data/pool.json, node pool_table + ball_0…ball_15, cue, cue_2 trong GLB): chơi một mình, chơi 2 người
// qua máy chủ, và mini-game "Một cú bi-a" của anh Khang (minigames.billiards, kind pool_shot). Vật lý: ./physics.js (tất
// định, toạ độ cục bộ bàn); luật 8 bi rút gọn: ./rules.js (dùng chung với máy chủ server/src/pool.js).
//   • Đến gần bàn: lời nhắc "Play pool" (interactables.json → action pool:play) → chế độ "pool": camera sau bi trắng, xoay
//     quanh bàn theo hướng ngắm; người chơi đứng cạnh bàn; đường ngắm + bi ma ở điểm chạm đầu tiên.
//   • Ngắm: chuột (con trỏ khoá) hoặc A/D, ←/→ (Shift: chậm); giữ chuột trái / Space nạp lực (thanh lực chạy lên xuống),
//     thả để đánh: cây cơ lùi theo lực rồi đẩy tới, bi lăn (xoay theo quãng đường). Lăn chuột: gần / xa.
//   • Tập một mình (không có mạng, hoặc máy chủ cũ chưa báo features "pool"): đếm số cú, số bi vào lỗ; bi trắng rơi lỗ → đặt
//     lại ở điểm đầu bàn; R / nút Rerack: xếp lại. Esc rời bàn; trạng thái bàn giữ trong lượt chơi (game.poolSession, không
//     vào bản lưu). Ẩn cue (cây dựng cạnh bàn) và cue_2 (cây nằm trên mặt nỉ) khi đang chơi.
//   • Bàn chung (bi-a bước 3, máy chủ báo features "pool"): cả phòng cùng thấy một bàn (game.poolShared = bàn máy chủ gửi).
//     "Play pool" → xin ghế (pool_join): một người ngồi → tập một mình (cú vẫn phát cho người xem); người thứ 2 ngồi → ván
//     8 bi, người ngồi trước phá; hết ghế → đứng xem (J: ngồi khi có ghế trống). Người đánh tự tính cú rồi gửi góc / lực /
//     chỗ đặt bi trắng + kết quả; người kia và người xem phát lại đúng cú đó từ bàn của mình, cuối cú chốt theo bàn máy chủ
//     gửi. Bi trắng rơi → đối thủ có bi trong tay: W/A/S/D (hoặc chuột) đặt bi trắng ở khu đầu bàn, Space / nhấp chuột đặt.
//     Hết ván: R = ván mới. Mất kết nối / máy chủ không trả lời → tập một mình tiếp với bàn đang có.
//   • Thử thách (enter({ challenge })): thế bi cho sẵn, đưa bi vào lỗ trong N cú; kết quả qua ctx của khung mini-game. Luôn là
//     bàn riêng (bàn chung vẫn cập nhật ngầm, hiện lại khi xong).
// __game.pool: trạng thái + enter / shoot(angle, power) / leave / rerack / join / autoShot (smoke test).
import * as THREE from "three";
import { makeTable, rackState, customState, simulateShot, aimInfo, findPottingShot, respotCue, cloneState, angleTo, FRAME_STEPS, DT, MAX_SPEED } from "./physics.js";
import { packBalls, unpackBalls, canPlaceCue, placeCue, kitchen, ballsLeft, targets } from "./rules.js";
import { pickShot } from "./auto.js";
import { clampCamera } from "../world/collision.js";
import { hud } from "../ui/hud.js";
import { t } from "../i18n.js";
import { tx } from "../content/content.js";
import { sound } from "../core/sound.js";

const UP = new THREE.Vector3(0, 1, 0);
const CHARGE_S = 1.3;             // thanh lực 0 → 1 trong 1,3 s rồi chạy ngược lại
const STRIKE_S = 0.07;            // cơ đẩy tới bi
const FRAME_S = DT * FRAME_STEPS; // 1/60 s mỗi khung vật lý đã ghi
const WAIT_S = 6;                 // bàn chung: máy chủ không trả lời pool_join chừng ấy giây → tập một mình
const POKE_S = 1.5;               // hết giờ lượt của đối thủ + chừng ấy giây → báo máy chủ (pool_poke), lặp lại mỗi 4 s
const OWN = ["aim", "charge", "place", "strike"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export class PoolTable {
  constructor(game, cfg) {
    this.game = game;
    this.cfg = cfg;
    this.table = makeTable(cfg);
    this.active = false;
    this.challenge = null;
    this.phase = "idle";          // idle | aim | charge | strike | roll · bàn chung: wait (chờ ghế) | place (bi trong tay) | watch
    this.angle = Math.PI / 2;     // hướng ngắm (quy ước physics.js); π/2 = về phía xếp bi
    this.power = 0;
    this.camDist = 1.05;
    this.view = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.mouse = false;
    this.onMouse = (e) => { if (e.button === 0) this.mouseButton(e.type === "mousedown"); };
    this.netActive = false;       // đang ở bàn chung (quyết lúc vào bàn)
    this.seat = -1;               // ghế của mình ở bàn chung (−1: đứng xem)
    this.override = null;         // bàn có bi trắng mình vừa đặt (bi trong tay), chỉ trong lượt của mình
    this.needRelease = false;     // vừa đặt bi trắng / tới lượt: thả Space / chuột rồi mới nạp lực
    this.fast = false;            // kiểm thử: cú của người khác hiện ngay kết quả, không phát lại
    this.replays = 0;             // số cú của người khác đã phát lại
    this.replayMismatch = 0;      // cú phát lại lệch kết quả người đánh (phải luôn 0 — vật lý tất định)
    this.netLog = [];             // sự kiện / lỗi máy chủ trả về (kiểm thử)
    this.seenV = -1;
  }

  // ---------- gắn vào zone ----------
  attach(zone) {
    this.zone = zone;
    this.root = zone.root.getObjectByName(this.cfg.node);
    if (!this.root) return false;
    this.balls = this.cfg.balls.map((n) => this.root.getObjectByName(n));
    this.cues = this.cfg.cues.map((n) => this.root.getObjectByName(n)).filter(Boolean);
    this.game.poolSession ||= { state: rackState(this.table), shots: 0, potted: 0 };
    const sh = this.game.poolShared;
    if (sh?.tb && !sh.state) sh.state = unpackBalls(this.table, sh.tb.b);
    this.buildHelpers();
    this.apply(this.state);
    return true;
  }
  detach() {
    if (this.active) this.leave();
    this.playback = null;
    this.helpers?.removeFromParent();
    this.root = null;
    this.game.poolShared = null;      // rời zone: máy chủ thôi gửi bàn; vào lại thì nhận bàn mới
  }
  get session() { return this.game.poolSession; }
  get net() { const n = this.game.net; return n?.poolOn ? n : null; }
  get shared() { return this.game.poolShared; }
  get tb() { return this.shared?.tb || null; }
  get netMode() { return !!(this.net && this.tb && this.shared.state); }
  // bàn đang hiện là bàn chung? (thử thách, tập một mình khi vào bàn lúc chưa có mạng: bàn riêng)
  get showsShared() { return !this.challenge && !!this.shared?.state && (this.active ? this.netActive : this.netMode); }
  get state() { return this.challenge ? this.challenge.state : this.override || (this.showsShared ? this.shared.state : this.session.state); }
  set state(s) { if (this.challenge) this.challenge.state = s; else if (this.showsShared) this.shared.state = s; else this.session.state = s; }
  get myTurn() {
    const tb = this.tb;
    return this.netActive && !!tb && this.seat >= 0 && (tb.mode === "solo" || (tb.mode === "match" && tb.turn === this.seat));
  }

  // đường ngắm, hướng bi bị chạm, bi ma, đường gợi ý (thử thách), cây cơ đang chơi — con của pool_table (toạ độ cục bộ)
  buildHelpers() {
    const g = new THREE.Group();
    g.name = "pool_helpers";
    const line = (color, opacity) => {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      l.frustumCulled = false;
      l.userData.dynamic = true;
      g.add(l);
      return l;
    };
    this.aimLine = line(0xffffff, 0.85);
    this.objLine = line(0xffe08a, 0.85);
    this.assistLine = line(0x5ce08a, 0.95);
    this.ghost = new THREE.Mesh(new THREE.SphereGeometry(this.table.r, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.userData.dynamic = true;
    g.add(this.ghost);
    this.cuePivot = new THREE.Group();
    const src = this.cues.find((c) => c.name === "cue_2") || this.cues[0];
    if (src) this.cuePivot.add(cueModel(src));
    g.add(this.cuePivot);
    g.visible = false;
    this.root.add(g);
    this.helpers = g;
  }

  // vị trí bi theo trạng thái (bi đã vào lỗ: ẩn)
  apply(state) {
    if (!this.root) return;
    const y = this.table.ballY;
    state.balls.forEach((b, i) => {
      const m = this.balls[i];
      if (!m) return;
      m.visible = b.on;
      if (b.on) m.position.set(b.x, y, b.z);
    });
    this.updateCues();
  }
  // cây cơ dựng cạnh bàn / nằm trên mặt nỉ: ẩn khi mình đang chơi hoặc có người đang ngồi ở bàn chung
  updateCues() {
    const busy = this.active || (this.showsShared && this.tb && this.tb.mode !== "idle");
    for (const c of this.cues || []) c.visible = !busy;
  }

  // ---------- vào / rời bàn ----------
  // challenge: { ctx, data } (mini-game pool_shot) — thế bi riêng, bàn tập một mình / bàn chung giữ nguyên
  enter({ challenge = null } = {}) {
    const g = this.game;
    if (!this.root || this.active) return null;
    if (this.playback?.net) this.finishPlayback(true);     // đang phát lại cú của người khác → hiện ngay kết quả
    this.active = true;
    this.netActive = !challenge && this.netMode;
    this.seat = -1;
    this.override = null;
    this.back = { pos: g.player.position.clone(), yaw: g.player.character.root.rotation.y };
    // độ cao sàn quanh bàn = chỗ đứng vững gần nhất; placePlayer đặt người chơi theo mức này (trước đây lấy y hiện tại + 2 cm ở
    // mỗi khung xoay cơ → giữ A/D hoặc kéo chuột thì người chơi bay lên ~1 m/s)
    this.standY = g.player.safe?.y ?? g.player.position.y;
    if (challenge) this.startChallenge(challenge);
    else g.setMode("pool");
    this.helpers.visible = true;
    this.power = 0;
    this.playback = null;
    this.apply(this.state);
    this.snapCamera = true;
    g.cameraOverride = (dt) => this.camera(dt);
    g.input.setLook(true);
    addEventListener("mousedown", this.onMouse);
    addEventListener("mouseup", this.onMouse);
    if (this.netActive) {
      this.phase = "wait";
      this.waitT = 0;
      this.hideAim();
      this.net.sendPool({ t: "pool_join" });
      hud.hint(t("pool.controls_net"), 600);
    } else {
      this.phase = "aim";
      this.aimAtTarget();
      hud.hint(t(challenge ? "pool.controls_challenge" : "pool.controls"), 600);
      this.placePlayer();
    }
    this.drawHud();
    return () => this.leave();
  }

  leave() {
    if (!this.active) return;
    const g = this.game;
    // đang lăn: tập một mình / bàn chung → nhảy tới trạng thái cuối; thử thách (khung mini-game đã đóng) → bỏ cú đó
    if (this.playback) {
      if (this.challenge) { this.playback.resolve?.(null); this.playback = null; }
      else this.finishPlayback(true);
    }
    if (this.netActive) this.net?.sendPool({ t: "pool_leave" });
    this.active = false;
    this.netActive = false;
    this.seat = -1;
    this.override = null;
    this.phase = "idle";
    removeEventListener("mousedown", this.onMouse);
    removeEventListener("mouseup", this.onMouse);
    this.hudEl?.remove();
    this.hudEl = null;
    this.helpers.visible = false;
    const wasChallenge = !!this.challenge;
    this.challenge = null;
    this.apply(this.state);                                // thử thách xong → bàn tập một mình / bàn chung như cũ
    g.cameraOverride = null;
    if (this.back) {
      g.player.body.teleport(this.back.pos.clone().add(new THREE.Vector3(0, 0.02, 0)));
      g.player.velocity.set(0, 0, 0);
      g.player.sync();
      g.player.character.root.rotation.y = this.back.yaw;
      g.cam.yaw = this.back.yaw + Math.PI;
    }
    hud.hint(t(g.net?.enabled ? "hud.controls_net" : "hud.controls"), 6);
    if (!wasChallenge) g.setMode("play");
    else g.input.setLook(false);
  }

  // ---------- thử thách (mini-game "Một cú bi-a") ----------
  startChallenge({ ctx, data }) {
    const s = data.setup;
    const place = () => customState(this.table, { 0: s.cue, [s.ball]: s.object });
    this.challenge = { ctx, data, setup: s, state: place(), left: s.shots ?? 3, place, solution: null };
    ctx.idleHint = () => tx(data.idle);
    ctx.onAssist = () => this.drawAssist();
    ctx.onKey = () => false;                   // phím đi thẳng tới game (Space, A/D, ←/→)
    ctx.debug = {
      solve: () => this.solve(),
      state: () => ({ left: this.challenge?.left, phase: this.phase, potted: !this.challenge?.state.balls[s.ball].on }),
    };
  }
  // cú gợi ý: tìm bằng vật lý (tất định) từ thế bi hiện tại
  solution() {
    const c = this.challenge;
    if (!c) return null;
    if (!c.solution || c.solutionFor !== c.state) { c.solution = findPottingShot(this.table, c.state, c.setup.ball); c.solutionFor = c.state; }
    return c.solution;
  }
  drawAssist() {
    const c = this.challenge, sol = c && c.ctx.assist ? this.solution() : null;
    this.assistLine.visible = !!sol;
    if (!sol) return;
    const cue = c.state.balls[0], y = this.table.ballY;
    const a = new THREE.Vector3(cue.x, y, cue.z), d = new THREE.Vector3(Math.cos(sol.angle), 0, Math.sin(sol.angle));
    setLine(this.assistLine, a, a.clone().addScaledVector(d, 1.2));
    if (c.ctx.assist) c.ctx.hint(tx(c.data.assist), "assist");
  }
  // tự giải (kiểm thử / gợi ý): đánh cú tìm được
  solve() {
    const sol = this.solution();
    if (!sol) return null;
    this.angle = sol.angle;
    return this.shoot(sol.angle, sol.power);
  }
  challengeResult(res) {
    const c = this.challenge, ctx = c.ctx, d = c.data, target = c.setup.ball;
    c.left--;
    if (res.pocketed.includes(target) && !res.cueScratch) {
      ctx.correct(tx(d.potted));
      c.done = true;
      ctx.later(() => ctx.finish({ flags: ["billiards_potted", "billiards_last_hit"] }), 1300);
      return;
    }
    if (res.pocketed.includes(target)) c.state = c.place();          // bi mục tiêu vào nhưng bi trắng cũng rơi → xếp lại
    if (res.cueScratch) respotCue(this.table, c.state, { x: c.setup.cue[0], z: c.setup.cue[1] });
    ctx.mistake(tx(res.cueScratch ? d.scratch : d.miss));
    if (c.left <= 0) {
      c.state = c.place();
      c.left = c.setup.shots ?? 3;
      ctx.hint(tx(d.reset), "info");
    }
    this.apply(c.state);
    this.aimAtTarget();
    this.drawAssist();
  }

  // ---------- điều khiển ----------
  mouseButton(down) {
    if (!this.active) return;
    if (down) {
      // nhấp đầu tiên để khoá con trỏ (ngắm bằng chuột) — chưa nạp lực
      if (this.game.input.lockSupported && !this.game.input.locked) return;
      this.mouse = true;
    } else this.mouse = false;
  }
  rerack() {
    if (!this.active || this.challenge || this.playback) return;
    if (this.netActive) {
      // bàn chung: tập một mình → xếp lại; hết ván → ván mới (máy chủ quyết)
      if (this.seat >= 0 && (this.tb?.mode === "solo" || this.tb?.mode === "over")) { this.net?.sendPool({ t: "pool_rerack" }); sound.play("tap"); }
      return;
    }
    this.session.state = rackState(this.table);
    this.session.shots = 0;
    this.session.potted = 0;
    this.apply(this.session.state);
    this.angle = Math.PI / 2;
    this.aimAtTarget();
    this.drawHud();
    sound.play("tap");
  }
  // J / nút Join: đang đứng xem mà có ghế trống → xin ghế
  join() {
    if (!this.active || !this.netActive || this.seat >= 0 || !this.tb?.seats.includes(null) || this.phase === "wait") return;
    this.phase = "wait";
    this.waitT = 0;
    this.net?.sendPool({ t: "pool_join" });
    this.drawHud();
  }
  // hướng ngắm ban đầu: vào bi mục tiêu (thử thách) / bi gần nhất (bàn chung: bi nhóm mình)
  aimAtTarget() {
    const s = this.state, cue = s.balls[0];
    const list = this.challenge ? [this.challenge.setup.ball]
      : this.netActive && this.tb ? targets(s, this.tb, this.seat) : s.balls.filter((b) => b.n !== 0 && b.on).map((b) => b.n);
    const target = list.map((n) => s.balls[n]).filter((b) => b?.on)
      .sort((a, b) => (a.x - cue.x) ** 2 + (a.z - cue.z) ** 2 - ((b.x - cue.x) ** 2 + (b.z - cue.z) ** 2))[0];
    if (target) this.angle = angleTo(cue.x, cue.z, target.x, target.z);
  }

  // đánh: lực 0..1. Trả Promise khi bi đã dừng (kết quả cú). instant: bỏ qua hoạt cảnh (kiểm thử)
  shoot(angle = this.angle, power = this.power, { instant = false } = {}) {
    if (!this.active || this.playback || this.phase === "strike") return Promise.resolve(null);
    if (this.netActive && (!this.myTurn || !OWN.includes(this.phase))) return Promise.resolve(null);
    this.angle = angle;
    this.power = power;
    const start = this.state;
    const res = simulateShot(this.table, start, { angle, power });
    this.phase = "strike";
    this.strikeT = 0;
    this.pull = 0.04 + 0.22 * power;
    this.playback = { res, t: 0, frame: 0, prev: res.frames[0], hidden: new Set(), own: true, net: this.netActive, tb: null };
    if (this.netActive) {
      // bàn chung: gửi thông số + kết quả (vị trí đã làm tròn — mọi bên lấy bàn máy chủ gửi về làm điểm xuất phát cú sau)
      const tb = this.tb, cue = tb.mode === "match" && tb.inHand ? [start.balls[0].x, start.balls[0].z] : null;
      this.playback.seq = tb.seq;
      this.net.sendPool({ t: "pool_shot", seq: tb.seq, a: angle, p: power, cue, b: packBalls(res.finalState), k: res.pocketed,
        f: res.firstContact, s: res.cueScratch, d: +res.time.toFixed(2) });
    }
    this.hideAim();   // tiếng đầu cơ: lúc bi cái bắt đầu lăn (cueSound)
    return new Promise((resolve) => {
      this.playback.resolve = resolve;
      if (instant) this.finishPlayback(true);
    });
  }
  finishPlayback(instant = false) {
    const pb = this.playback;
    if (!pb) return;
    this.playback = null;
    const res = pb.res;
    const summary = { pocketed: res.pocketed, firstContact: res.firstContact, cueScratch: res.cueScratch, time: +res.time.toFixed(2), frames: res.frames.length };
    if (pb.net) {
      // bàn chung (cú của mình hoặc phát lại cú người khác): chốt theo bàn máy chủ gửi; cú của mình mà máy chủ chưa trả
      // lời → tạm giữ kết quả của mình, chờ
      if (pb.tb) this.applyTb(pb.tb, instant);
      else {
        this.override = null;
        if (this.shared) this.shared.state = cloneState(res.finalState);
        this.apply(this.state);
        if (this.active && this.netActive) { this.phase = "watch"; this.drawHud(); }
      }
      pb.resolve?.(summary);
      return;
    }
    this.state = cloneState(res.finalState);
    if (!this.challenge) {
      this.session.shots++;
      this.session.potted += res.pocketed.filter((n) => n !== 0).length;
      if (res.cueScratch) { respotCue(this.table, this.session.state); hud.toast(t("pool.scratch")); }
      if (this.session.state.balls.every((b) => b.n === 0 || !b.on)) hud.toast(t("pool.cleared", { n: this.session.shots }));
      this.drawHud();
    }
    this.apply(this.state);
    this.phase = "aim";
    this.power = 0;
    if (this.challenge) this.challengeResult(res);
    this.snapCamera = instant;
    this.placePlayer();
    pb.resolve?.(summary);
  }

  // ---------- bàn chung (tin từ máy chủ qua game/src/net/net.js) ----------
  // pool {tb, err?}: bàn hiện tại · pool_shot {shot, tb}: một cú vừa được máy chủ nhận + bàn sau cú
  onNet(m) {
    if (!m.tb) return;
    this.game.poolShared ||= { tb: null, state: null };
    if (m.err) {
      this.netLog.push({ err: m.err });
      if (m.err === "full" && this.active && this.netActive && this.phase === "wait") { this.phase = "watch"; hud.toast(t("pool.net_full")); }
    }
    const pb = this.playback;
    if (m.t === "pool_shot") {
      const shot = m.shot, mine = shot.by === this.game.net?.myId;
      if (mine && pb?.own && pb.net && pb.seq === shot.seq) { pb.tb = m.tb; return; }   // cú của mình: áp khi bi dừng
      if (pb?.net) this.finishPlayback(true);
      const base = this.shared;
      if (!mine && base.tb && base.tb.seq === shot.seq && base.state && this.showsShared && this.root && !this.playback) {
        // phát lại đúng cú đó từ bàn của mình (vật lý tất định → giống hệt người đánh), cuối cú chốt theo bàn máy chủ
        let before = cloneState(base.state);
        if (shot.cue) before = placeCue(before, shot.cue[0], shot.cue[1]);
        const res = simulateShot(this.table, before, { angle: shot.a, power: shot.p });
        if (Array.isArray(shot.b) && !same(packBalls(res.finalState), shot.b)) this.replayMismatch++;
        this.replays++;
        this.apply(before);
        this.playback = { res, t: 0, frame: 0, prev: res.frames[0], hidden: new Set(), own: false, net: true, seq: shot.seq, tb: m.tb };
        if (this.active && this.netActive) { this.phase = "watch"; this.hideAim(); this.drawHud(); }
        if (this.fast) this.finishPlayback(true);        // kiểm thử: vẫn tính + đối chiếu, chỉ bỏ hoạt cảnh
        return;
      }
      this.applyTb(m.tb);
      return;
    }
    if (pb?.net) { if (!pb.tb || m.tb.v >= pb.tb.v) pb.tb = m.tb; return; }   // đang lăn: áp sau khi bi dừng
    this.applyTb(m.tb);
  }
  applyTb(tb, instant = true) {
    const sh = (this.game.poolShared ||= { tb: null, state: null });
    sh.tb = tb;
    sh.state = unpackBalls(this.table, tb.b);
    this.deadline = tb.left != null ? performance.now() + tb.left * 1000 : null;
    this.pokeAt = 0;
    if (this.active && this.netActive) this.seat = tb.seats.findIndex((s) => s && s.id === this.game.net?.myId);
    this.netEvent(tb);
    this.refreshRole(instant);
    if (this.showsShared) this.apply(this.state);
    else this.updateCues();
    this.drawHud();
  }
  // tới lượt mình → ngắm (bi trong tay: đặt bi trắng trước); không → xem
  refreshRole(instant = true) {
    if (!this.active || !this.netActive || this.playback) return;
    const tb = this.tb;
    if (!tb || (this.phase === "wait" && this.seat < 0)) return;     // chưa có trả lời cho pool_join
    const inHand = tb.mode === "match" && tb.inHand;
    if (this.myTurn) {
      if (!inHand && this.override) { this.override = null; if (this.phase === "place") this.phase = "aim"; }
      if (OWN.includes(this.phase)) return;
      const turnChanged = this.turnV !== tb.v;
      this.turnV = tb.v;
      this.override = inHand ? cloneState(this.shared.state) : null;
      this.phase = inHand ? "place" : "aim";
      this.needRelease = true;
      this.power = 0;
      if (inHand) this.angle = Math.PI / 2; else this.aimAtTarget();
      this.snapCamera = instant;
      this.placePlayer();
      if (tb.mode === "match" && turnChanged) hud.toast(t(inHand ? "pool.net_your_turn_in_hand" : "pool.net_your_turn"));
    } else if (this.phase !== "watch") {
      this.phase = "watch";
      this.override = null;
      this.hideAim();
    }
  }
  // thông báo theo sự kiện máy chủ gửi kèm bàn (mỗi sự kiện 1 lần; chỉ khi đang ở bàn)
  netEvent(tb) {
    const ev = tb.ev;
    if (!ev || tb.v === this.seenV) return;
    this.seenV = tb.v;
    this.netLog.push({ v: tb.v, k: ev.k, ...(ev.why ? { why: ev.why } : {}), ...(ev.reason ? { reason: ev.reason } : {}) });
    if (this.netLog.length > 60) this.netLog.splice(0, this.netLog.length - 60);
    if (!this.active || !this.netActive) return;
    const me = this.seat, name = (i) => tb.seats[i]?.name || "?", group = (g) => t(`pool.group_${g}`);
    const say = (key, vars) => hud.toast(t(key, vars));
    if (ev.k === "start") say("pool.net_start", { a: name(0), b: name(1), who: name(ev.seat) });
    else if (ev.k === "shot" && tb.mode !== "solo") {
      if (ev.respot8) say("pool.net_respot8");
      if (ev.assigned) say(ev.seat === me ? "pool.net_you_group" : "pool.net_group", { name: name(ev.seat), group: group(ev.assigned) });
      if (ev.scratch) say(tb.turn === me ? "pool.net_scratch_you" : "pool.net_scratch", { name: name(tb.turn) });
    } else if (ev.k === "over") {
      const winner = name(ev.winner), loser = name(1 - ev.winner);
      if (me === ev.winner) say(ev.reason === "eight" ? "pool.net_win" : "pool.net_win_foul", { name: loser });
      else if (me >= 0) say(ev.reason === "eight" ? "pool.net_lose" : ev.reason === "eight_scratch" ? "pool.net_lose_scratch" : "pool.net_lose_early", { name: winner });
      else say("pool.net_winner", { name: winner });
      sound.play(me === ev.winner ? "correct" : "tap");
    } else if (ev.k === "forfeit") {
      if (ev.id === this.game.net?.myId) say("pool.net_timeout_you");
      else if (ev.seat === me) say(ev.why === "timeout" ? "pool.net_win_timeout" : "pool.net_win_left", { name: ev.name });
      else say("pool.net_forfeit", { name: ev.name });
    }
  }
  // mất kết nối (net.js) → đang ở bàn chung thì tập một mình tiếp với bàn đang có; không ở bàn: bàn riêng = bàn chung cuối
  onNetLost() {
    if (this.playback?.net) this.finishPlayback(true);
    if (this.active && this.netActive) this.toLocal("pool.net_lost");
    else if (this.shared?.state && !this.challenge) this.session.state = cloneState(this.shared.state);
    this.game.poolShared = null;
    if (!this.active) this.apply(this.state);
  }
  toLocal(key) {
    if (!this.netActive) return;
    if (this.playback?.net) this.finishPlayback(true);
    this.net?.sendPool({ t: "pool_leave" });             // máy chủ trả lời muộn mà đã xếp ghế → trả ghế
    if (this.shared?.state) this.session.state = cloneState(this.override || this.shared.state);
    if (!this.session.state.balls[0].on) respotCue(this.table, this.session.state);
    this.netActive = false;
    this.seat = -1;
    this.override = null;
    this.phase = "aim";
    this.power = 0;
    this.apply(this.state);
    this.aimAtTarget();
    this.placePlayer();
    this.snapCamera = true;
    hud.toast(t(key));
    hud.hint(t("pool.controls"), 600);
    this.drawHud();
  }
  // mỗi khung (bàn chung): chờ ghế quá lâu, đồng hồ lượt, báo máy chủ khi đối thủ hết giờ
  netTick(dt) {
    if (this.phase === "wait" && (this.waitT += dt) > WAIT_S) { this.toLocal("pool.net_no_reply"); return; }
    const tb = this.tb;
    if (tb?.mode !== "match" || this.deadline == null) return;
    const now = performance.now(), left = Math.max(0, Math.ceil((this.deadline - now) / 1000));
    if (left !== this.shownLeft) { this.shownLeft = left; this.drawStatus(); }
    if (this.seat >= 0 && tb.turn !== this.seat && !this.playback && now > this.deadline + POKE_S * 1000 && now - (this.pokeAt || 0) > 4000) {
      this.pokeAt = now;
      this.net?.sendPool({ t: "pool_poke" });
    }
  }

  // ---------- mỗi khung ----------
  update(dt, drag) {
    if (!this.active) { if (this.playback) this.roll(dt); return; }    // cú của người khác vẫn lăn khi mình đi lại
    const input = this.game.input, k = input.keys;
    const pressing = this.mouse || k.has("Space");
    if (!pressing) this.needRelease = false;
    if (this.netActive) this.netTick(dt);
    const slow = k.has("ShiftLeft") || k.has("ShiftRight") ? 0.25 : 1;
    const turn = ((k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0)) * 0.9 * slow;
    if (this.phase === "place") this.updatePlace(dt, drag, pressing);
    else if (this.phase === "watch" || this.phase === "wait") this.angle += turn * dt + (drag?.dx || 0) * 0.0032 * slow;   // xem: xoay quanh bàn
    else if (this.phase === "aim" || this.phase === "charge") {
      this.angle += turn * dt + (drag?.dx || 0) * 0.0032 * slow;
      const want = pressing && !this.needRelease;
      if (want && this.phase === "aim") { this.phase = "charge"; this.chargeT = 0; }
      if (this.phase === "charge") {
        this.chargeT += dt;
        const c = (this.chargeT / CHARGE_S) % 2;
        this.power = c <= 1 ? c : 2 - c;
        if (!want) this.shoot(this.angle, Math.max(0.04, this.power));
      }
      if (this.phase === "aim" || this.phase === "charge") this.drawAim();
      if (turn || drag?.dx) this.placePlayer();
    }
    if (drag?.wheel) this.camDist = THREE.MathUtils.clamp(this.camDist + drag.wheel * 0.12, 0.55, 2.4);
    if (this.phase === "strike") {
      this.strikeT += dt;
      if (this.strikeT >= STRIKE_S) { this.phase = "roll"; this.rollT = 0; }
    }
    if (this.playback && (this.phase === "roll" || !this.playback.own)) this.roll(dt);
    this.drawCue();
    this.drawPower();
  }
  // bi trắng trong tay: W/S dọc bàn, A/D ngang (chuột kéo cũng được), chỉ trong khu đầu bàn, không chồng bi; Space / nhấp: đặt
  updatePlace(dt, drag, pressing) {
    const st = this.override;
    if (!st) { this.phase = "aim"; return; }
    if (pressing && !this.needRelease) {
      this.phase = "aim";
      this.needRelease = true;
      this.aimAtTarget();
      this.placePlayer();
      this.snapCamera = true;
      this.drawStatus();
      return;
    }
    const k = this.game.input.keys, has = (...c) => c.some((x) => k.has(x));
    const sp = 0.5 * (has("ShiftLeft", "ShiftRight") ? 0.3 : 1) * dt;
    const right = (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0);
    const fwd = (has("KeyW", "ArrowUp") ? 1 : 0) - (has("KeyS", "ArrowDown") ? 1 : 0);
    // camera nhìn từ đầu bàn về phía xếp bi (+z): bên phải màn hình = −x cục bộ
    const dx = -right * sp - (drag?.dx || 0) * 0.0012, dz = fwd * sp - (drag?.dy || 0) * 0.0012;
    if (!dx && !dz) return;
    const c = st.balls[0], kk = kitchen(this.table), clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const nx = clamp(c.x + dx, kk.x0, kk.x1), nz = clamp(c.z + dz, kk.z0, kk.z1);
    const tryAt = (x, z) => canPlaceCue(this.table, st, x, z) && !!placeCue(st, x, z);
    if (tryAt(nx, nz) || tryAt(nx, c.z) || tryAt(c.x, nz)) this.apply(st);
  }

  // phát lại các khung của cú đánh (60 khung/giây theo thời gian thật), bi xoay theo quãng đường lăn
  roll(dt) {
    const pb = this.playback, res = pb.res, r = this.table.r, y = this.table.ballY;
    pb.t += dt;
    const target = Math.min(res.frames.length - 1, Math.floor(pb.t / FRAME_S));
    if (!pb.cued) this.cueSound(pb);
    if (target === pb.frame) return;
    this.rollSounds(pb, target);
    const f = res.frames[target], prev = pb.prev;
    for (const e of res.events) if (e.type === "pocket" && e.frame <= target) pb.hidden.add(e.a);
    const axis = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let i = 0; i < this.balls.length; i++) {
      const m = this.balls[i];
      if (!m) continue;
      if (pb.hidden.has(i)) { m.visible = false; continue; }
      const x = f[i * 2], z = f[i * 2 + 1], dx = x - prev[i * 2], dz = z - prev[i * 2 + 1];
      const len = Math.sqrt(dx * dx + dz * dz);
      m.position.set(x, y, z);
      if (len > 1e-6) { axis.set(dz / len, 0, -dx / len); m.quaternion.premultiply(q.setFromAxisAngle(axis, len / r)); }
    }
    pb.prev = f;
    pb.frame = target;
    if (target >= res.frames.length - 1) this.finishPlayback();
  }

  // tiếng (data/sounds.json → pool_*): đầu cơ chạm bi cái lúc bi bắt đầu lăn (to theo tốc độ bi cái); bi chạm bi / chạm băng /
  // vào lỗ theo sự kiện vật lý của các khung vừa qua (simulateShot → events), mỗi khung vài tiếng mạnh nhất (cú phá bi có
  // hàng chục va chạm cùng lúc). Cả khi phát lại cú của người khác ở bàn chung — nghe theo vị trí bàn.
  cueSound(pb) {
    pb.cued = true;
    const [f0, f1] = pb.res.frames;
    const v = f1 ? Math.sqrt((f1[0] - f0[0]) ** 2 + (f1[1] - f0[1]) ** 2) / FRAME_S : 0;
    if (v > 0) sound.play("pool_cue", { pos: this.ballPos(0), gain: Math.min(1, 0.35 + v / MAX_SPEED) });
  }
  rollSounds(pb, target) {
    const ev = pb.res.events.filter((e) => e.frame > pb.frame && e.frame <= target);
    if (!ev.length) return;
    const top = (type, n) => ev.filter((e) => e.type === type).sort((a, b) => b.v - a.v).slice(0, n);
    for (const e of top("ball", 3)) {
      if (e.v < 0.03) continue;
      const k = Math.min(1, e.v / 3);
      sound.play("pool_ball", { pos: this.ballPos(e.a), gain: Math.min(1, (e.v / 2.5) ** 0.8), rate: 0.92 + 0.14 * k });
    }
    for (const e of top("rail", 2)) if (e.v >= 0.05) sound.play("pool_rail", { pos: this.ballPos(e.a), gain: Math.min(1, e.v / 2.2) });
    for (const e of ev.filter((x) => x.type === "pocket").slice(0, 2)) sound.play("pool_pocket", { pos: this.ballPos(e.a), gain: 0.9 });
  }
  ballPos(i) { return this.balls?.[i]?.getWorldPosition(new THREE.Vector3()) ?? this.root?.getWorldPosition(new THREE.Vector3()) ?? null; }

  // ---------- vẽ: đường ngắm, bi ma, cơ, thanh lực ----------
  hideAim() { this.aimLine.visible = this.objLine.visible = this.ghost.visible = this.assistLine.visible = false; }
  drawAim() {
    const s = this.state, cue = s.balls[0], y = this.table.ballY;
    if (!cue.on) { this.hideAim(); return; }
    const info = aimInfo(this.table, s, this.angle);
    const a = new THREE.Vector3(cue.x, y, cue.z), c = new THREE.Vector3(info.contact.x, y, info.contact.z);
    setLine(this.aimLine, a, c);
    this.aimLine.visible = true;
    this.ghost.position.copy(c);
    this.ghost.visible = info.ball != null;
    if (info.ball != null) {
      const b = s.balls[info.ball], from = new THREE.Vector3(b.x, y, b.z);
      setLine(this.objLine, from, from.clone().add(new THREE.Vector3(info.objDir.x, 0, info.objDir.z).multiplyScalar(0.3)));
      this.objLine.visible = true;
    } else this.objLine.visible = false;
    this.aim = info;
    if (this.challenge) this.drawAssist();
  }
  drawCue() {
    const s = this.state, cue = s.balls[0], y = this.table.ballY;
    const show = cue.on && (this.phase === "aim" || this.phase === "charge" || this.phase === "strike" || (this.phase === "roll" && this.rollT < 0.25));
    this.cuePivot.visible = show;
    if (!show) return;
    if (this.phase === "roll") this.rollT += 1 / 60;
    let back;
    if (this.phase === "charge") back = 0.012 + (0.04 + 0.22 * this.power);
    else if (this.phase === "strike") back = 0.012 + this.pull * (1 - this.strikeT / STRIKE_S);
    else if (this.phase === "roll") back = -0.02;
    else back = 0.025;
    const d = new THREE.Vector3(Math.cos(this.angle), 0, Math.sin(this.angle));
    const tip = new THREE.Vector3(cue.x, y + 0.004, cue.z).addScaledVector(d, -(this.table.r + back));
    this.cuePivot.position.copy(tip);
    const fwd = d.clone().setY(-0.13).normalize();          // đuôi cơ nâng ~7°
    this.cuePivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
  }
  drawPower() {
    const el = this.hudEl?.querySelector(".power");
    if (!el) return;
    const on = this.phase === "charge";
    el.classList.toggle("on", on);
    el.classList.toggle("keep", !!this.challenge);
    el.querySelector("i").style.width = `${Math.round((on ? this.power : 0) * 100)}%`;
    const left = el.querySelector(".left");
    if (left) left.textContent = this.challenge ? tx(this.challenge.data.shots_left, { n: this.challenge.left }) : "";
  }

  // bảng nhỏ góc trên (tập một mình / bàn chung) + thanh lực (mọi chế độ)
  drawHud() {
    if (!this.active) return;
    if (!this.hudEl) {
      this.hudEl = document.createElement("div");
      this.hudEl.id = "pool-hud";
      document.body.appendChild(this.hudEl);
      this.hudEl.addEventListener("click", (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if (a === "rerack") this.rerack();
        if (a === "join") this.join();
        if (a === "leave") this.leave();
      });
    }
    const leave = `<button class="ghost" data-a="leave">${esc(t("pool.leave"))} <kbd>Esc</kbd></button>`;
    const power = `<div class="power"><span>${esc(t("pool.power"))}</span><div class="bar"><i></i></div><em class="left"></em></div>`;
    if (this.netActive) {
      this.hudEl.innerHTML = this.netPanel(leave) + power;
      this.drawStatus();
      return;
    }
    const s = this.session, total = this.table.rack.length - 1;
    this.hudEl.innerHTML = `${this.challenge ? "" : `<div class="panel"><b>🎱 ${esc(t("pool.title"))}</b>
        <span>${esc(t("pool.stats", { shots: s.shots, potted: s.potted, total }))}</span>
        <div class="row"><button class="ghost" data-a="rerack">${esc(t("pool.rerack"))} <kbd>R</kbd></button>${leave}</div></div>`}${power}`;
  }
  // bàn chung: 2 ghế (tên, nhóm, số bi còn lại, ai đang đánh), dòng trạng thái, nút
  netPanel(leave) {
    const tb = this.tb;
    const match = tb && (tb.mode === "match" || tb.mode === "over");
    const title = `<b>🎱 ${esc(t(match ? "pool.title_match" : "pool.title"))}</b>`;
    if (!tb) return `<div class="panel net">${title}<span class="status"></span><div class="row">${leave}</div></div>`;
    const st = this.shared.state, total = this.table.rack.length - 1;
    const seats = tb.seats.map((s, i) => {
      if (!s) return `<div class="seat empty"><span class="nm">${esc(t("pool.net_free_seat"))}</span></div>`;
      const g = match ? tb.groups[i] : null;
      const info = !match ? "" : g ? `${t(`pool.group_${g}`)} · ${t("pool.balls_left", { n: ballsLeft(st, g) })}` : t("pool.group_open");
      const cls = ["seat", tb.mode === "match" && tb.turn === i ? "turn" : "", i === this.seat ? "me" : "", tb.mode === "over" && tb.winner === i ? "won" : ""].filter(Boolean).join(" ");
      return `<div class="${cls}"><span class="nm">${esc(s.name)}${i === this.seat ? ` <small>${esc(t("pool.net_you"))}</small>` : ""}</span>${info ? `<em>${esc(info)}</em>` : ""}</div>`;
    }).join("");
    const potted = st.balls.filter((b) => b.n !== 0 && !b.on).length;
    const stats = tb.mode === "solo" ? `<span>${esc(t("pool.stats", { shots: tb.n, potted, total }))}</span>` : "";
    const btns = [];
    if (this.seat >= 0 && (tb.mode === "solo" || tb.mode === "over")) btns.push(`<button class="ghost" data-a="rerack">${esc(t(tb.mode === "over" ? "pool.rematch" : "pool.rerack"))} <kbd>R</kbd></button>`);
    if (this.seat < 0 && tb.seats.includes(null) && this.phase !== "wait") btns.push(`<button class="ghost" data-a="join">${esc(t("pool.join"))} <kbd>J</kbd></button>`);
    btns.push(leave);
    return `<div class="panel net">${title}<div class="seats">${seats}</div>${stats}<span class="status"></span><div class="row">${btns.join("")}</div></div>`;
  }
  statusText() {
    const tb = this.tb;
    if (!tb || this.phase === "wait") return t("pool.net_joining");
    const name = (i) => tb.seats[i]?.name || "?";
    const s = this.deadline != null ? Math.max(0, Math.ceil((this.deadline - performance.now()) / 1000)) : null;
    if (tb.mode === "over") {
      const head = this.seat === tb.winner ? t("pool.net_status_won") : t("pool.net_status_winner", { name: name(tb.winner) });
      return this.seat >= 0 ? `${head} ${t("pool.net_rematch_hint")}` : head;
    }
    if (this.seat < 0) {
      if (tb.seats.includes(null)) return t("pool.net_status_free");
      return tb.mode === "match" ? t("pool.net_status_turn", { name: name(tb.turn), s: s ?? "–" }) : t("pool.net_status_watch");
    }
    if (tb.mode === "solo") return t("pool.net_status_solo");
    if (tb.turn !== this.seat) return t("pool.net_status_turn", { name: name(tb.turn), s: s ?? "–" });
    if (this.phase === "place") return t("pool.net_status_place");
    return s != null && s <= 20 ? t("pool.net_status_your_turn_s", { s }) : t("pool.net_status_your_turn");
  }
  drawStatus() {
    const el = this.hudEl?.querySelector(".status");
    if (el) el.textContent = this.statusText();
  }

  // ---------- camera + chỗ đứng ----------
  local(v) { return this.root.localToWorld(v.clone()); }
  camera(dt) {
    const cam = this.game.camera, s = this.state, cue = s.balls[0], y = this.table.ballY;
    const d = new THREE.Vector3(Math.cos(this.angle), 0, Math.sin(this.angle));
    let pos, look;
    if (this.phase === "place") {
      // bi trong tay: nhìn từ sau băng đầu bàn xuống khu đầu bàn
      pos = new THREE.Vector3(cue.x * 0.4, y + 1.2, -this.table.rz - 0.65);
      look = new THREE.Vector3(cue.x * 0.6, y, -this.table.rz * 0.4);
    } else if (this.phase === "roll" || this.phase === "watch" || this.phase === "wait" || !cue.on) {
      // bi đang lăn / đang xem: nhìn bao quát bàn từ phía camera đang đứng
      const back = d.clone().multiplyScalar(-1.15);
      pos = new THREE.Vector3(back.x, y + 1.55, back.z);
      look = new THREE.Vector3(0, y, 0);
    } else {
      const c = new THREE.Vector3(cue.x, y, cue.z);
      const h = 0.18 + this.camDist * 0.42;
      pos = c.clone().addScaledVector(d, -this.camDist).add(new THREE.Vector3(0, h, 0));
      look = c.clone().addScaledVector(d, 0.45).add(new THREE.Vector3(0, -0.05, 0));
    }
    pos = this.local(pos);
    look = this.local(look);
    // không xuyên tường / đồ đạc: tia từ trên bi trắng (cao hơn mặt bàn, không vướng hộp COL của bàn) tới vị trí camera,
    // xét cả hộp COL_ lẫn lưới hiển thị (vd ghế sofa sau đầu bàn không có COL_ cao tới tầm camera)
    const from = this.local(new THREE.Vector3(cue.on ? cue.x : 0, y + 0.45, cue.on ? cue.z : 0));
    const want = pos.clone().sub(from), len = want.length();
    if (len > 0.01) {
      let freeLen = len;
      for (const m of [this.zone?.collider, this.zone?.view]) if (m) freeLen = Math.min(freeLen, clampCamera(m, from, pos, 0.15));
      if (freeLen < len) pos = from.clone().addScaledVector(want.normalize(), Math.max(0.2, freeLen));
    }
    const k = this.snapCamera ? 1 : 1 - Math.exp(-(dt || 0) * 6);
    this.snapCamera = false;
    this.view.lerp(pos, k);
    this.lookAt.lerp(look, k);
    if (k === 1) { this.view.copy(pos); this.lookAt.copy(look); }
    cam.position.copy(this.view);
    cam.lookAt(this.lookAt);
    if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
  }
  // người chơi đứng ngoài mép bàn, gần bi trắng, không chắn hướng đánh / camera; quay mặt về bi trắng
  placePlayer() {
    const p = this.game.player, cue = this.state.balls[0];
    if (!p || !cue.on) return;
    const size = this.cfg.table.size, hw = size.width / 2 + 0.38, hl = size.length / 2 + 0.38;
    const d = { x: Math.cos(this.angle), z: Math.sin(this.angle) };
    const cands = [[hw, cue.z], [-hw, cue.z], [cue.x, hl], [cue.x, -hl]].map(([x, z]) => {
      const ox = x - cue.x, oz = z - cue.z, ahead = ox * d.x + oz * d.z, side = Math.abs(ox * -d.z + oz * d.x);
      // phía trước cú đánh: che bàn; ngay sau bi trắng trên đường ngắm: camera lọt vào người → tránh cả hai
      return { x, z, cost: Math.sqrt(ox * ox + oz * oz) + (ahead > 0.3 ? 4 : 0) + (ahead <= 0.3 && side < 0.55 ? 3 : 0) };
    }).sort((a, b) => a.cost - b.cost);
    const c = cands[0];
    const w = this.local(new THREE.Vector3(c.x, 0, c.z));
    w.y = this.standY ?? p.position.y;
    p.body.teleport(w);
    p.velocity.set(0, 0, 0);
    p.sync();
    const cw = this.local(new THREE.Vector3(cue.x, 0, cue.z));
    p.character.root.rotation.y = Math.atan2(cw.x - w.x, cw.z - w.z);
  }

  // ---------- __game.pool ----------
  // cú tự chọn (game/src/pool/auto.js) cho người tới lượt — kiểm thử 2 người; bi trong tay: giữ chỗ đặt hiện tại
  autoShot({ instant = true } = {}) {
    if (!this.active || (this.netActive && !this.myTurn)) return Promise.resolve(null);
    if (this.phase === "place") this.phase = "aim";
    const s = this.state;
    const list = this.netActive && this.tb ? targets(s, this.tb, this.seat) : s.balls.filter((b) => b.n !== 0 && b.on).map((b) => b.n);
    const pick = pickShot(this.table, s, list);
    return this.shoot(pick.angle, pick.power, { instant });
  }
  // bi trong tay: đặt bi trắng ở (x, z) cục bộ (kiểm thử; người chơi dùng W/A/S/D) → false nếu ngoài khu đầu bàn / chồng bi
  debugPlace(x, z) {
    if (this.phase !== "place" || !this.override || !canPlaceCue(this.table, this.override, x, z)) return false;
    placeCue(this.override, x, z);
    this.apply(this.override);
    return true;
  }
  // gửi cú bất chấp lượt (kiểm thử: máy chủ phải chặn)
  forceShot(angle, power) {
    const tb = this.tb, n = this.game.net;
    if (!tb || !n?.connected || !this.shared?.state) return false;
    const res = simulateShot(this.table, this.shared.state, { angle, power }, { frames: false });
    n.sendPool({ t: "pool_shot", seq: tb.seq, a: angle, p: power, cue: null, b: packBalls(res.finalState), k: res.pocketed, f: res.firstContact, s: res.cueScratch, d: 1 });
    return true;
  }
  info() {
    const s = this.state, tb = this.tb;
    return { active: this.active, challenge: !!this.challenge, phase: this.phase, angle: +this.angle.toFixed(4), power: +this.power.toFixed(2),
      shots: this.session?.shots, potted: this.session?.potted, onTable: s?.balls.filter((b) => b.on).map((b) => b.n),
      cue: s && { x: +s.balls[0].x.toFixed(4), z: +s.balls[0].z.toFixed(4), on: s.balls[0].on },
      cuesHidden: this.cues?.every((c) => !c.visible), rolling: !!this.playback, left: this.challenge?.left ?? null,
      net: { on: this.netMode, active: this.netActive, seat: this.seat, myTurn: this.myTurn, mode: tb?.mode ?? null, seq: tb?.seq ?? null,
        v: tb?.v ?? null, turn: tb?.turn ?? null, groups: tb?.groups ?? null, inHand: tb?.inHand ?? null, winner: tb?.winner ?? null,
        reason: tb?.reason ?? null, seats: tb?.seats.map((x) => x?.name ?? null) ?? null, replays: this.replays, mismatch: this.replayMismatch,
        log: [...this.netLog], shown: s ? packBalls(s) : null, server: tb?.b ?? null } };
  }
}

function setLine(line, a, b) {
  const p = line.geometry.attributes.position;
  p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z);
  p.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

// cây cơ đang chơi: bản sao của cue_2 (lưới nằm dọc trục z cục bộ) xoay cho đầu cơ (đầu nhỏ) ở gốc, thân dọc −z
function cueModel(src) {
  const obj = src.clone(true);
  obj.position.set(0, 0, 0); obj.quaternion.identity(); obj.scale.set(1, 1, 1);
  obj.visible = true;
  obj.updateMatrixWorld(true);
  // 2 đầu theo trục dài (z) của lưới; đầu có bán kính nhỏ hơn = đầu cơ
  const pts = [], v = new THREE.Vector3();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
  });
  if (!pts.length) return obj;
  let zmin = Infinity, zmax = -Infinity;
  for (const p of pts) { zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); }
  const end = (z0) => {
    const near = pts.filter((p) => Math.abs(p.z - z0) < 0.02);
    const c = near.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / near.length);
    const rad = near.reduce((m, p) => Math.max(m, Math.hypot(p.x - c.x, p.y - c.y)), 0);
    return { c, rad };
  };
  const A = end(zmin), B = end(zmax);
  const tip = A.rad < B.rad ? A.c : B.c, butt = A.rad < B.rad ? B.c : A.c;
  const q = new THREE.Quaternion().setFromUnitVectors(tip.clone().sub(butt).normalize(), new THREE.Vector3(0, 0, 1));
  obj.quaternion.copy(q);
  obj.position.copy(tip.clone().applyQuaternion(q).negate());
  // clone() chép userData qua JSON → userData.srcMaterial (vật liệu gốc, zone.js) thành object thường; bỏ đi, nếu không
  // disposeZone hỏng khi rời zone_05 (cảnh kết không sang được bến xe)
  obj.traverse((m) => { m.userData = { dynamic: true }; m.frustumCulled = false; });
  return obj;
}
