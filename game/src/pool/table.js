// Bàn bi-a zone 5 (data/pool.json, node pool_table + ball_0…ball_15, cue, cue_2 trong GLB): chơi một mình và mini-game
// "Một cú bi-a" của anh Khang (minigames.billiards, kind pool_shot). Vật lý: ./physics.js (tất định, toạ độ cục bộ bàn).
//   • Đến gần bàn: lời nhắc "Play pool" (interactables.json → action pool:play) → chế độ "pool": camera sau bi trắng, xoay
//     quanh bàn theo hướng ngắm; người chơi đứng cạnh bàn; đường ngắm + bi ma ở điểm chạm đầu tiên.
//   • Ngắm: chuột (con trỏ khoá) hoặc A/D, ←/→ (Shift: chậm); giữ chuột trái / Space nạp lực (thanh lực chạy lên xuống),
//     thả để đánh: cây cơ lùi theo lực rồi đẩy tới, bi lăn (xoay theo quãng đường). Lăn chuột: gần / xa.
//   • Tập một mình: đếm số cú, số bi vào lỗ; bi trắng rơi lỗ → đặt lại ở điểm đầu bàn; R / nút Rerack: xếp lại. Esc rời bàn;
//     trạng thái bàn giữ trong lượt chơi (game.poolSession, không vào bản lưu). Ẩn cue (cây dựng cạnh bàn) và cue_2 (cây
//     nằm trên mặt nỉ) khi đang chơi.
//   • Thử thách (enter({ challenge })): thế bi cho sẵn, đưa bi vào lỗ trong N cú; kết quả qua ctx của khung mini-game.
// __game.pool: trạng thái + enter / shoot(angle, power) / leave / rerack (smoke test).
import * as THREE from "three";
import { makeTable, rackState, customState, simulateShot, aimInfo, findPottingShot, respotCue, cloneState, angleTo, FRAME_STEPS, DT } from "./physics.js";
import { clampCamera } from "../world/collision.js";
import { hud } from "../ui/hud.js";
import { t } from "../i18n.js";
import { tx } from "../content/content.js";
import { sound } from "../core/sound.js";

const UP = new THREE.Vector3(0, 1, 0);
const CHARGE_S = 1.3;             // thanh lực 0 → 1 trong 1,3 s rồi chạy ngược lại
const STRIKE_S = 0.07;            // cơ đẩy tới bi
const FRAME_S = DT * FRAME_STEPS; // 1/60 s mỗi khung vật lý đã ghi
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export class PoolTable {
  constructor(game, cfg) {
    this.game = game;
    this.cfg = cfg;
    this.table = makeTable(cfg);
    this.active = false;
    this.challenge = null;
    this.phase = "idle";          // idle | aim | charge | strike | roll
    this.angle = Math.PI / 2;     // hướng ngắm (quy ước physics.js); π/2 = về phía xếp bi
    this.power = 0;
    this.camDist = 1.05;
    this.view = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.mouse = false;
    this.onMouse = (e) => { if (e.button === 0) this.mouseButton(e.type === "mousedown"); };
  }

  // ---------- gắn vào zone ----------
  attach(zone) {
    this.zone = zone;
    this.root = zone.root.getObjectByName(this.cfg.node);
    if (!this.root) return false;
    this.balls = this.cfg.balls.map((n) => this.root.getObjectByName(n));
    this.cues = this.cfg.cues.map((n) => this.root.getObjectByName(n)).filter(Boolean);
    this.game.poolSession ||= { state: rackState(this.table), shots: 0, potted: 0 };
    this.buildHelpers();
    this.apply(this.game.poolSession.state);
    return true;
  }
  detach() {
    if (this.active) this.leave();
    this.helpers?.removeFromParent();
    this.root = null;
  }
  get session() { return this.game.poolSession; }
  get state() { return this.challenge ? this.challenge.state : this.session.state; }
  set state(s) { if (this.challenge) this.challenge.state = s; else this.session.state = s; }

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
    const y = this.table.ballY;
    state.balls.forEach((b, i) => {
      const m = this.balls[i];
      if (!m) return;
      m.visible = b.on;
      if (b.on) m.position.set(b.x, y, b.z);
    });
  }

  // ---------- vào / rời bàn ----------
  // challenge: { ctx, data } (mini-game pool_shot) — thế bi riêng, bàn tập một mình giữ nguyên
  enter({ challenge = null } = {}) {
    const g = this.game;
    if (!this.root || this.active) return null;
    this.active = true;
    this.back = { pos: g.player.position.clone(), yaw: g.player.character.root.rotation.y };
    if (challenge) this.startChallenge(challenge);
    else g.setMode("pool");
    for (const c of this.cues) c.visible = false;
    this.helpers.visible = true;
    this.phase = "aim";
    this.power = 0;
    this.playback = null;
    this.apply(this.state);
    this.aimAtTarget();
    this.snapCamera = true;
    g.cameraOverride = (dt) => this.camera(dt);
    g.input.setLook(true);
    addEventListener("mousedown", this.onMouse);
    addEventListener("mouseup", this.onMouse);
    this.drawHud();
    hud.hint(t(challenge ? "pool.controls_challenge" : "pool.controls"), 600);
    this.placePlayer();
    return () => this.leave();
  }

  leave() {
    if (!this.active) return;
    const g = this.game;
    // đang lăn: tập một mình → nhảy tới trạng thái cuối; thử thách (khung mini-game đã đóng) → bỏ cú đó
    if (this.playback) {
      if (this.challenge) { this.playback.resolve?.(null); this.playback = null; }
      else this.finishShot(true);
    }
    this.active = false;
    this.phase = "idle";
    removeEventListener("mousedown", this.onMouse);
    removeEventListener("mouseup", this.onMouse);
    this.hudEl?.remove();
    this.hudEl = null;
    this.helpers.visible = false;
    for (const c of this.cues) c.visible = true;
    const wasChallenge = !!this.challenge;
    this.challenge = null;
    this.apply(this.session.state);                       // thử thách xong → bàn tập một mình như cũ
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
    this.session.state = rackState(this.table);
    this.session.shots = 0;
    this.session.potted = 0;
    this.apply(this.session.state);
    this.angle = Math.PI / 2;
    this.aimAtTarget();
    this.drawHud();
    sound.play("tap");
  }
  // hướng ngắm ban đầu: vào bi mục tiêu (thử thách) / bi gần nhất
  aimAtTarget() {
    const s = this.state, cue = s.balls[0];
    const target = this.challenge ? s.balls[this.challenge.setup.ball] : s.balls.filter((b) => b.n !== 0 && b.on)
      .sort((a, b) => (a.x - cue.x) ** 2 + (a.z - cue.z) ** 2 - ((b.x - cue.x) ** 2 + (b.z - cue.z) ** 2))[0];
    if (target?.on) this.angle = angleTo(cue.x, cue.z, target.x, target.z);
  }

  // đánh: lực 0..1. Trả Promise khi bi đã dừng (kết quả cú). instant: bỏ qua hoạt cảnh (kiểm thử)
  shoot(angle = this.angle, power = this.power, { instant = false } = {}) {
    if (!this.active || this.playback || this.phase === "strike") return Promise.resolve(null);
    this.angle = angle;
    this.power = power;
    const res = simulateShot(this.table, this.state, { angle, power });
    this.phase = "strike";
    this.strikeT = 0;
    this.pull = 0.04 + 0.22 * power;
    this.playback = { res, t: 0, frame: 0, prev: res.frames[0], hidden: new Set() };
    this.hideAim();
    sound.play("tap");
    return new Promise((resolve) => {
      this.playback.resolve = resolve;
      if (instant) this.finishShot(true);
    });
  }
  finishShot(instant = false) {
    const pb = this.playback;
    if (!pb) return;
    this.playback = null;
    const res = pb.res;
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
    pb.resolve?.({ pocketed: res.pocketed, firstContact: res.firstContact, cueScratch: res.cueScratch, time: +res.time.toFixed(2), frames: res.frames.length });
  }

  // ---------- mỗi khung ----------
  update(dt, drag) {
    if (!this.active) return;
    const input = this.game.input, k = input.keys;
    if (this.phase === "aim" || this.phase === "charge") {
      const slow = k.has("ShiftLeft") || k.has("ShiftRight") ? 0.25 : 1;
      const turn = ((k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0)) * 0.9 * slow;
      this.angle += turn * dt + (drag?.dx || 0) * 0.0032 * slow;
      if (drag?.wheel) this.camDist = THREE.MathUtils.clamp(this.camDist + drag.wheel * 0.12, 0.55, 2.4);
      const want = this.mouse || k.has("Space");
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
    if (this.phase === "strike") {
      this.strikeT += dt;
      if (this.strikeT >= STRIKE_S) { this.phase = "roll"; this.rollT = 0; }
    }
    if (this.playback && this.phase === "roll") this.roll(dt);
    this.drawCue();
    this.drawPower();
  }

  // phát lại các khung của cú đánh (60 khung/giây theo thời gian thật), bi xoay theo quãng đường lăn
  roll(dt) {
    const pb = this.playback, res = pb.res, r = this.table.r, y = this.table.ballY;
    pb.t += dt;
    const target = Math.min(res.frames.length - 1, Math.floor(pb.t / FRAME_S));
    if (target === pb.frame) return;
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
    if (target >= res.frames.length - 1) this.finishShot();
  }

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

  // bảng nhỏ góc trên (tập một mình) + thanh lực (cả hai chế độ)
  drawHud() {
    if (!this.active) return;
    if (!this.hudEl) {
      this.hudEl = document.createElement("div");
      this.hudEl.id = "pool-hud";
      document.body.appendChild(this.hudEl);
      this.hudEl.addEventListener("click", (e) => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if (a === "rerack") this.rerack();
        if (a === "leave") this.leave();
      });
    }
    const s = this.session, total = this.table.rack.length - 1;
    this.hudEl.innerHTML = `${this.challenge ? "" : `<div class="panel"><b>🎱 ${esc(t("pool.title"))}</b>
        <span>${esc(t("pool.stats", { shots: s.shots, potted: s.potted, total }))}</span>
        <div class="row"><button class="ghost" data-a="rerack">${esc(t("pool.rerack"))} <kbd>R</kbd></button>
        <button class="ghost" data-a="leave">${esc(t("pool.leave"))} <kbd>Esc</kbd></button></div></div>`}
      <div class="power"><span>${esc(t("pool.power"))}</span><div class="bar"><i></i></div><em class="left"></em></div>`;
  }

  // ---------- camera + chỗ đứng ----------
  local(v) { return this.root.localToWorld(v.clone()); }
  camera(dt) {
    const cam = this.game.camera, s = this.state, cue = s.balls[0], y = this.table.ballY;
    const d = new THREE.Vector3(Math.cos(this.angle), 0, Math.sin(this.angle));
    let pos, look;
    if (this.phase === "roll" || !cue.on) {
      // bi đang lăn: nhìn bao quát bàn từ phía camera đang đứng
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
    w.y = p.position.y;
    p.body.teleport(w.clone().add(new THREE.Vector3(0, 0.02, 0)));
    p.velocity.set(0, 0, 0);
    p.sync();
    const cw = this.local(new THREE.Vector3(cue.x, 0, cue.z));
    p.character.root.rotation.y = Math.atan2(cw.x - w.x, cw.z - w.z);
  }

  // ---------- __game.pool ----------
  info() {
    const s = this.state;
    return { active: this.active, challenge: !!this.challenge, phase: this.phase, angle: +this.angle.toFixed(4), power: +this.power.toFixed(2),
      shots: this.session?.shots, potted: this.session?.potted, onTable: s?.balls.filter((b) => b.on).map((b) => b.n),
      cue: s && { x: +s.balls[0].x.toFixed(4), z: +s.balls[0].z.toFixed(4), on: s.balls[0].on },
      cuesHidden: this.cues?.every((c) => !c.visible), rolling: !!this.playback, left: this.challenge?.left ?? null };
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
  obj.traverse((m) => { m.userData.dynamic = true; m.frustumCulled = false; });
  return obj;
}
