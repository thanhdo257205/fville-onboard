// Bàn bi-a zone 5 (data/pool.json, node pool_table + ball_0…ball_15, cue, cue_2 trong GLB): chơi một mình, chơi 2 người
// qua máy chủ, và mini-game "Một cú bi-a" của anh Khang (minigames.billiards, kind pool_shot). Vật lý: ./physics.js (tất
// định, toạ độ cục bộ bàn); luật 8 bi: ./rules.js (dùng chung với máy chủ server/src/pool.js).
//   • Đến gần bàn: lời nhắc "Play pool" (interactables.json → action pool:play) → chế độ "pool": camera sau bi trắng, xoay
//     quanh bàn theo hướng ngắm; người chơi đứng cạnh bàn; đường ngắm + bi ma ở điểm chạm đầu tiên.
//   • Ngắm (./pointer.js đổi con trỏ → điểm trên mặt bàn): con trỏ đang khoá → di chuột ngang xoay cơ; chưa khoá / không
//     khoá được → cơ hướng từ bi trắng tới điểm con trỏ trên mặt bàn (camera đứng yên). A/D, ←/→ luôn dùng được; Shift: chậm.
//     Cú bấm khi chưa khoá chỉ để khoá con trỏ (hoặc lấy lại chuột sau khi rời cửa sổ) — không nạp lực. Giữ chuột trái /
//     Space nạp lực (thanh lực chạy lên xuống), thả để đánh: cây cơ lùi theo lực rồi đẩy tới, bi lăn (xoay theo quãng
//     đường). Lăn chuột: gần / xa. Cú đánh gửi đi (bàn chung) vẫn chỉ là góc + lực như cũ.
//   • Tập một mình (không có mạng, hoặc máy chủ cũ chưa báo features "pool"): đếm số cú, số bi vào lỗ; bi trắng rơi lỗ → đặt
//     lại ở điểm đầu bàn; R / nút Rerack: xếp lại. Esc rời bàn; trạng thái bàn giữ trong lượt chơi (game.poolSession, không
//     vào bản lưu). Ẩn cue (cây dựng cạnh bàn) và cue_2 (cây nằm trên mặt nỉ) khi đang chơi.
//   • Bàn chung (bi-a bước 3, máy chủ báo features "pool"): cả phòng cùng thấy một bàn (game.poolShared = bàn máy chủ gửi).
//     "Play pool" → xin ghế (pool_join): một người ngồi → tập một mình (cú vẫn phát cho người xem); người thứ 2 ngồi → ván
//     8 bi, người ngồi trước phá; hết ghế → đứng xem (J: ngồi khi có ghế trống). Người đánh tự tính cú rồi gửi góc / lực /
//     chỗ đặt bi trắng + kết quả; người kia và người xem phát lại đúng cú đó từ bàn của mình, cuối cú chốt theo bàn máy chủ
//     gửi. Bi trắng rơi → đối thủ có bi trong tay: W/A/S/D (hoặc chuột) đặt bi trắng ở khu đầu bàn, Space / nhấp chuột đặt.
//     Hết ván: R = ván mới. Mất kết nối / máy chủ không trả lời → tập một mình tiếp với bàn đang có.
//   • Luật chuẩn "sọc trơn" (máy chủ báo thêm "pool_rules2", bàn có rules: 2 — rules.js → applyShotV2): pool_join kèm r: 2, cf: 1;
//     cú đánh gửi kèm sự kiện cú (wireFacts) — máy chủ không chạy vật lý, chỉ kiểm tra rồi áp luật. Lỗi → toast kèm lý do + dòng "lỗi" trên bảng, đối thủ có bi trong tay cả bàn (camera nhìn bao
//     quát, chuột / W/A/S/D đặt); cú phá không hợp lệ → người tới lượt chọn: R xếp lại và phá / P đánh tiếp (pool_choice);
//     đánh bi 8: phải gọi lỗ — bấm vào lỗ (con trỏ không khoá), C đổi lỗ, hoặc Space / cú bấm đầu gọi lỗ đang ngắm tới (không
//     nạp lực); vòng sáng ở các lỗ, lỗ đã gọi màu cam. Đồng hồ 60 s mỗi cú trên bảng; H: tóm tắt luật. Máy chủ cũ (không có
//     "pool_rules2") → luật cũ như trên, giao diện cũ.
//   • Thử thách (enter({ challenge })): thế bi cho sẵn, đưa bi vào lỗ trong N cú; kết quả qua ctx của khung mini-game. Luôn là
//     bàn riêng (bàn chung vẫn cập nhật ngầm, hiện lại khi xong).
//   • Điểm chạm trên bi trắng (xoáy — physics.js đầu file): hình bi trắng ở góc phải dưới, kéo chấm (chuột / ngón tay, chỉ trên
//     ô đó nên không đụng ngắm cơ bằng chuột trên khung vẽ) hoặc phím Z / X (trái / phải), F / B (đè / kéo); 5 nấc mỗi chiều,
//     mặc định giữa, về giữa sau mỗi cú. Đường ngắm thêm một đoạn ngắn hướng bi trắng sau lần chạm đầu (physics.js cueAfter).
//     Thử thách của anh Khang: luôn đánh tâm, không có ô chọn. Bàn chung: chỉ khi máy chủ báo "pool_spin" và bàn báo spin: true
//     (mọi người ngồi đều dùng bản hiểu xoáy — pool_join sp: 1); không thì ẩn ô chọn, cú gửi spin = roll = 0.
//   • Cảm ứng (body.touch — core/device.js; máy tính giữ nguyên mọi phím / chuột ở trên): ./pointer.js nhận cả ngón tay — chạm /
//     kéo một ngón trên bàn: cơ hướng từ bi trắng tới ngón tay (như chuột không khoá), chạm không đánh; 2 ngón chụm: camera gần /
//     xa (core/input.js → wheel); vuốt xoay camera của chế độ đi bộ tắt ở bàn. Lực: thanh kéo dọc mép phải (#pool-touch .tpower)
//     — kéo xuống chọn lực (cơ lùi theo), thả đánh, kéo về đỉnh rồi thả = huỷ; đánh bi 8 chưa gọi lỗ: chạm thanh lực gọi lỗ đang
//     ngắm tới (như Space). Ngắm tinh: giữ ◀ ▶ (như A/D + Shift). Bi trong tay: kéo bi trắng bằng ngón tay (vòng đỏ: chỗ không
//     đặt được), nút "Đặt bi". Gọi lỗ: chạm vào lỗ (vùng chạm ≥ POCKET_TOUCH_PX px trên màn). Cột nút: Luật (H), Xếp lại (R),
//     Ngồi (J — khi có ghế trống), Rời bàn (Esc); sau cú phá không hợp lệ: "Xếp lại và phá" / "Đánh tiếp" (R / P). Ô áp phê dời
//     xuống góc trái dưới (CSS). Cú đánh vẫn là góc / lực / spin / roll / chỗ đặt bi / lỗ gọi như máy tính (shoot()).
// __game.pool: trạng thái + enter / shoot(angle, power, { spin, roll }) / setSpin / leave / rerack / join / autoShot (smoke test).
import * as THREE from "three";
import { makeTable, rackState, customState, simulateShot, aimInfo, cueAfter, findPottingShot, respotCue, cloneState, angleTo, spinLevel,
  SPIN_LEVELS, FRAME_STEPS, DT, MAX_SPEED } from "./physics.js";
import { packBalls, unpackBalls, placeCue, ballsLeft, targets, handArea, canPlaceCueIn, onEight, shotFacts, wireFacts, RULES_V2 } from "./rules.js";
import { pickShot } from "./auto.js";
import { TablePointer } from "./pointer.js";
import { clampCamera } from "../world/collision.js";
import { hud } from "../ui/hud.js";
import { t } from "../i18n.js";
import { tx } from "../content/content.js";
import { sound } from "../core/sound.js";
import { device } from "../core/device.js";

const UP = new THREE.Vector3(0, 1, 0);
const CHARGE_S = 1.3;             // thanh lực 0 → 1 trong 1,3 s rồi chạy ngược lại
const STRIKE_S = 0.07;            // cơ đẩy tới bi
const FRAME_S = DT * FRAME_STEPS; // 1/60 s mỗi khung vật lý đã ghi
const WAIT_S = 6;                 // bàn chung: máy chủ không trả lời pool_join chừng ấy giây → tập một mình
const POKE_S = 1.5;               // hết giờ lượt của đối thủ + chừng ấy giây → báo máy chủ (pool_poke), lặp lại mỗi 4 s
const OWN = ["aim", "charge", "place", "strike"];
// thứ tự đổi lỗ bằng phím C (đi vòng quanh bàn)
const POCKET_ORDER = ["head_left", "side_left", "foot_left", "foot_right", "side_right", "head_right"];
const NUDGE = 0.9 * 0.25;         // cảm ứng: giữ ◀ ▶ xoay cơ (rad/s) — như A/D + Shift
const POCKET_TOUCH_PX = 34;       // cảm ứng: chạm cách tâm lỗ (trên màn) chừng ấy px vẫn tính là chạm lỗ (vùng ≥ 44 px)
const CANCEL_POWER = 0.04;        // thanh lực cảm ứng: thả ở dưới mức này = huỷ cú
// chữ có bản cảm ứng (khoá + "_touch" trong data/i18n) — không ghi phím
const TOUCH_TEXT = new Set(["pool.cleared", "pool.net_status_free", "pool.net_status_place", "pool.net_status_place_table", "pool.net_rematch_hint",
  "pool.net_status_choice", "pool.net_status_call", "pool.rules_eight", "pool.rules_practice", "pool.rules_spin"]);
const tt = (key, vars) => t(device.touch && TOUCH_TEXT.has(key) ? `${key}_touch` : key, vars);
const SPIN_R = 0.6;               // ô chọn điểm chạm: nấc 2 cách tâm 0,6 bán kính hình bi (cả nấc chéo 2 / 2 vẫn nằm trong hình)
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
    this.mouse = false;           // đang giữ nút chuột chính (nạp lực)
    this.pointer = null;          // TablePointer khi đang ở bàn (con trỏ → điểm trên mặt bàn)
    this.cursorAim = false;       // góc ngắm vừa đặt bằng con trỏ (không khoá) → camera giữ hướng, không xoay theo góc ngắm
    this.cursorMoved = false;     // con trỏ vừa đổi góc ngắm → đặt lại chỗ đứng của người chơi ở khung tới
    this.camAngle = this.angle;   // hướng camera nhìn bàn (khoá chuột / phím: theo góc ngắm)
    this.lockFailed = false;      // lần ngồi này trình duyệt từ chối khoá con trỏ → ngắm bằng con trỏ, bấm là nạp lực
    this.regain = false;          // cửa sổ vừa mất focus → cú bấm tới chỉ để lấy lại chuột
    this.onBlur = () => { this.regain = true; this.mouse = false; };
    this.onLockError = () => {
      if (!this.active) return;
      this.lockFailed = true;
      this.game.input.setLook(false);       // thôi xin khoá ở mỗi cú bấm (cú bấm giờ là nạp lực)
      this.showHint();
    };
    this.onLockChange = () => { if (this.active) this.showHint(); };
    this.netActive = false;       // đang ở bàn chung (quyết lúc vào bàn)
    this.seat = -1;               // ghế của mình ở bàn chung (−1: đứng xem)
    this.override = null;         // bàn có bi trắng mình vừa đặt (bi trong tay), chỉ trong lượt của mình
    this.needRelease = false;     // vừa đặt bi trắng / tới lượt: thả Space / chuột rồi mới nạp lực
    this.fast = false;            // kiểm thử: cú của người khác hiện ngay kết quả, không phát lại
    this.replays = 0;             // số cú của người khác đã phát lại
    this.replayMismatch = 0;      // cú phát lại lệch kết quả người đánh (phải luôn 0 — vật lý tất định)
    this.netLog = [];             // sự kiện / lỗi máy chủ trả về (kiểm thử)
    this.seenV = -1;
    this.call = null;             // luật chuẩn: lỗ đã gọi cho bi 8 (id lỗ) trong lượt này
    this.choiceV = -1;            // đã gửi lựa chọn sau cú phá không hợp lệ cho bàn phiên bản này (không gửi 2 lần)
    this.foul = null;             // lỗi gần nhất (chữ hiện trên bảng) — hết khi có cú mới
    this.rulesOpen = false;       // thẻ tóm tắt luật (phím H)
    this.spinLv = 0;              // điểm chạm trên bi trắng: ngang −2 (trái) … +2 (phải)
    this.rollLv = 0;              //   dọc: +2 (trên, đánh đè) … −2 (dưới, đánh kéo)
    this.touchPower = null;       // cảm ứng: lực đang kéo trên thanh lực (null: không kéo)
    this.nudge = 0;               // cảm ứng: đang giữ ◀ (−1) / ▶ (+1)
    this.placeBad = null;         // cảm ứng, bi trong tay: chỗ ngón tay vừa kéo tới không đặt được (vòng đỏ)
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
  // bàn chung đang theo luật chuẩn (máy chủ có "pool_rules2")? Máy chủ cũ không gửi rules → luật cũ
  get rules2() { return this.netActive && this.tb?.rules === RULES_V2; }
  // bi trong tay của người tới lượt: "kitchen" (khu đầu bàn) | "table" (cả bàn) | null — luật cũ gửi true = khu đầu bàn
  get hand() {
    if (this.forceHand && !this.netActive) return this.forceHand;          // kiểm thử (debugState): bi trong tay ở bàn tập
    const h = this.tb?.mode === "match" ? this.tb.inHand : false; return h === true ? "kitchen" : h || null;
  }
  // được chọn điểm chạm (xoáy)? thử thách: không; bàn chung: máy chủ có "pool_spin" và bàn báo spin: true
  get spinOn() {
    if (this.challenge) return false;
    if (!this.netActive) return true;
    return !!this.game.net?.poolSpin && this.tb?.spin === true;
  }
  // tới lượt mình đánh bi 8 (luật chuẩn: phải gọi lỗ trước)
  get needCall() {
    if (this.forceCall) return this.active && !this.netActive && !this.challenge;   // kiểm thử (debugState): thế bi dựng sẵn, gọi lỗ
    const tb = this.tb;
    return this.rules2 && this.myTurn && tb.mode === "match" && !tb.brk && !tb.choice && onEight(this.state, tb, this.seat);
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
    this.pathLine = line(0x8fd8ff, 0.8);          // hướng bi trắng sau lần chạm đầu (có tính xoáy) — đoạn ngắn
    this.pathLine.visible = false;
    this.ghost = new THREE.Mesh(new THREE.SphereGeometry(this.table.r, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.userData.dynamic = true;
    g.add(this.ghost);
    // vòng sáng ở miệng các lỗ (gọi lỗ cho bi 8): nổi trên mặt bàn, luôn vẽ đè (không bị băng che); lỗ đã gọi màu cam
    this.pocketMarks = this.table.pockets.map((p) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(p.r * 0.7, p.r * 1.05, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, this.table.ballY + this.table.r * 0.2, p.z);
      m.renderOrder = 10;
      m.visible = false;
      m.userData = { dynamic: true, pocket: p.id };
      g.add(m);
      return m;
    });
    // bi trong tay (cảm ứng): vòng dưới bi trắng — xanh: đặt được; đỏ ở chỗ ngón tay: không đặt được
    this.placeMark = new THREE.Mesh(new THREE.RingGeometry(this.table.r * 1.15, this.table.r * 1.5, 32),
      new THREE.MeshBasicMaterial({ color: 0x5ce08a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    this.placeMark.rotation.x = -Math.PI / 2;
    this.placeMark.renderOrder = 10;
    this.placeMark.visible = false;
    this.placeMark.userData.dynamic = true;
    g.add(this.placeMark);
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
    this.mouse = false;
    this.lockFailed = false;
    this.regain = false;
    this.cursorAim = false;
    g.input.setLook(true);
    this.pointer = new TablePointer({ canvas: g.input.canvas, camera: g.camera, root: this.root, y: this.table.ballY, types: ["mouse", "touch", "pen"],
      onMove: (pt) => this.pointerMove(pt), onDown: (pt, e) => this.pointerDown(pt, e), onUp: () => { this.mouse = false; } }).attach();
    // bấm vào lỗ để gọi lỗ cho bi 8: cú bấm đó không khoá con trỏ (core/input.js hỏi trước khi khoá)
    g.input.skipLock = (e) => this.phase === "aim" && this.needCall && !!this.pocketAt(this.pointer?.point(e.clientX, e.clientY));
    this.call = null;
    this.foul = null;
    this.rulesOpen = false;
    this.spinLv = this.rollLv = 0;
    this.buildSpin();
    this.touchPower = null;
    this.nudge = 0;
    this.placeBad = null;
    this.buildTouch();
    document.body.classList.add("pool-on");     // CSS cảm ứng: ẩn dòng mục tiêu / đồng hồ / "N online" / tin chat xem trước ở bàn
    // laptop cảm ứng: chạm lần đầu / bấm phím đổi giao diện giữa chừng → vẽ lại bảng, dòng hướng dẫn
    this.offTouch = device.onChange(() => { if (!this.active) return; this.touchPower = null; this.nudge = 0; this.drawHud(); this.showHint(); this.spinKey = this.touchKey = null; });
    addEventListener("blur", this.onBlur);
    document.addEventListener("pointerlockerror", this.onLockError);
    document.addEventListener("pointerlockchange", this.onLockChange);
    if (this.netActive) {
      this.phase = "wait";
      this.waitT = 0;
      this.hideAim();
      this.net.sendPool({ t: "pool_join", r: RULES_V2, cf: 1, sp: 1 });   // r: hiểu luật chuẩn, cf: gửi sự kiện cú, sp: hiểu xoáy (máy chủ cũ bỏ qua)
    } else {
      this.phase = "aim";
      this.aimAtTarget();
      this.placePlayer();
    }
    this.camAngle = this.angle;
    this.showHint();
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
    this.pointer?.detach();
    this.pointer = null;
    g.input.skipLock = null;
    this.mouse = false;
    this.call = null;
    this.rulesOpen = false;
    removeEventListener("blur", this.onBlur);
    document.removeEventListener("pointerlockerror", this.onLockError);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.hudEl?.remove();
    this.hudEl = null;
    this.spinEl?.remove();
    this.spinEl = null;
    this.spinLv = this.rollLv = 0;
    this.touchEl?.remove();
    this.touchEl = null;
    document.body.classList.remove("pool-on");
    this.forceCall = false;
    this.forceHand = null;
    this.offTouch?.();
    this.offTouch = null;
    this.touchPower = null;
    this.nudge = 0;
    this.placeBad = null;
    this.placeMark.visible = false;
    this.helpers.visible = false;
    for (const m of this.pocketMarks) m.visible = false;
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
  // chế độ chuột ở bàn: "lock" con trỏ đang khoá (di chuột xoay cơ) · "wait" chưa khoá nhưng khoá được (con trỏ ngắm; cú bấm
  // để khoá, chưa nạp lực) · "free" không khoá được (trình duyệt không hỗ trợ / từ chối): con trỏ ngắm, giữ chuột trái nạp lực
  get mouseMode() {
    const i = this.game.input;
    return i.locked ? "lock" : i.lockSupported && !this.lockFailed ? "wait" : "free";
  }
  // bấm nút chuột chính / chạm trên khung vẽ (./pointer.js)
  pointerDown(pt, e) {
    if (!this.active) return;
    if (this.pointer?.lastType && this.pointer.lastType !== "mouse") { this.touchDown(pt, e); return; }
    const mode = this.mouseMode;
    if (mode !== "lock" && this.phase === "aim" && this.needCall) {   // đánh bi 8: bấm vào lỗ = gọi lỗ đó (không nạp lực)
      const p = this.pocketAt(pt);
      if (p) { this.regain = false; this.setCall(p.id); return; }
    }
    if (mode === "wait") return;                           // cú bấm này chỉ để khoá con trỏ (core/input.js) — chưa nạp lực
    if (mode === "free") {
      if (this.regain) { this.regain = false; return; }    // vừa quay lại cửa sổ: cú bấm chỉ để lấy lại chuột
      this.pointerMove(pt);                                 // ngắm đúng chỗ vừa bấm rồi mới nạp lực
    }
    this.mouse = true;
  }
  // con trỏ chưa khoá di trên mặt bàn: cơ hướng từ bi trắng tới điểm đó (đang nạp lực thì giữ hướng — thả tay không lệch cú);
  // bi trong tay: bi trắng theo con trỏ (khu đầu bàn / cả bàn)
  pointerMove(pt) {
    if (!this.active || !pt || this.game.input.locked) return;
    if (this.phase === "aim") {
      const cue = this.state.balls[0], dx = pt.x - cue.x, dz = pt.z - cue.z;
      if (!cue.on || dx * dx + dz * dz < (this.table.r * 1.5) ** 2) return;   // sát bi trắng: hướng không rõ
      this.angle = angleTo(cue.x, cue.z, pt.x, pt.z);
      this.cursorAim = true;
      this.cursorMoved = true;
    } else if (this.phase === "place") this.moveCue(pt.x, pt.z);
  }
  // chạm (ngón tay / bút): đánh bi 8 chưa gọi lỗ → chạm lỗ = gọi lỗ; còn lại: ngắm tới chỗ chạm / kéo bi trắng (bi trong tay).
  // Không bao giờ nạp lực (lực: thanh kéo — buildTouch)
  touchDown(pt, e) {
    if (this.phase === "aim" && this.needCall) {
      const p = this.pocketAtScreen(e?.clientX, e?.clientY) || this.pocketAt(pt);
      if (p) { this.setCall(p.id); return; }
    }
    this.pointerMove(pt);
  }
  // lỗ có tâm trên màn hình cách (cx, cy) ≤ POCKET_TOUCH_PX px (gần nhất) hoặc null
  pocketAtScreen(cx, cy) {
    if (cx == null || !this.pointer) return null;
    let best = null, bd = POCKET_TOUCH_PX;
    for (const p of this.table.pockets) {
      const s = this.pointer.screen(p.x, p.z);
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (s.visible && d <= bd) { bd = d; best = p; }
    }
    return best;
  }
  rerack() {
    if (!this.active || this.challenge || this.playback) return;
    if (this.phase === "choice") { this.choose("rerack"); return; }   // sau cú phá không hợp lệ: R = xếp lại và tự phá
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
    this.net?.sendPool({ t: "pool_join", r: RULES_V2, cf: 1, sp: 1 });
    this.drawHud();
  }
  // luật chuẩn, sau cú phá không hợp lệ của đối thủ: "rerack" (R) xếp lại và tự phá · "play" (P) đánh tiếp từ bàn đang có
  choose(c) {
    const tb = this.tb;
    if (!this.active || this.phase !== "choice" || !this.myTurn || tb?.choice !== "break" || this.choiceV === tb.v) return false;
    this.choiceV = tb.v;
    this.net?.sendPool({ t: "pool_choice", c });
    sound.play("tap");
    return true;
  }

  // ---------- gọi lỗ cho bi 8 (luật chuẩn) ----------
  // lỗ gần điểm (x, z) trên mặt bàn (trong ~2,5 bán kính miệng lỗ) hoặc null
  pocketAt(pt) {
    if (!pt) return null;
    let best = null, bd = Infinity;
    for (const p of this.table.pockets) {
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d < p.r * 2.5 && d < bd) { bd = d; best = p; }
    }
    return best;
  }
  // lỗ bi 8 đang hướng tới theo đường ngắm (bi ma chạm bi 8: lỗ gần hướng bi 8 chạy nhất); không thì lỗ gần bi 8 nhất
  predictPocket() {
    const s = this.state, b8 = s.balls[8], info = this.aim;
    if (!b8?.on) return this.table.pockets[0]?.id ?? null;
    let best = null, score = -Infinity;
    for (const p of this.table.pockets) {
      const dx = p.x - b8.x, dz = p.z - b8.z, len = Math.hypot(dx, dz) || 1;
      const sc = info?.ball === 8 && info.objDir ? (dx * info.objDir.x + dz * info.objDir.z) / len : -len;
      if (sc > score) { score = sc; best = p; }
    }
    return best?.id ?? null;
  }
  // tên lỗ theo góc nhìn hiện tại (camera hướng camAngle; id lỗ trong data đặt theo trục bàn, nhìn từ phía khác thì "trái" lại
  // nằm bên phải màn hình): lỗ góc xa / gần + trái / phải; lỗ giữa: trái / phải (nhìn dọc bàn) hoặc xa / gần (nhìn ngang bàn)
  pocketName(id) {
    const p = this.table.pockets.find((x) => x.id === id);
    if (!p) return id;
    const fx = Math.cos(this.camAngle), fz = Math.sin(this.camAngle);       // hướng nhìn; bên phải màn hình = (−fz, fx)
    const ahead = p.x * fx + p.z * fz, right = -p.x * fz + p.z * fx;
    const key = !p.side ? `${ahead > 0 ? "far" : "near"}_${right > 0 ? "right" : "left"}`
      : Math.abs(right) >= Math.abs(ahead) ? `side_${right > 0 ? "right" : "left"}` : `side_${ahead > 0 ? "far" : "near"}`;
    return t(`pool.pocket_${key}`);
  }
  setCall(id) {
    if (!id || !this.needCall) return;
    this.call = id;
    hud.toast(t("pool.called", { pocket: this.pocketName(id) }));
    sound.play("tap");
    this.drawMarks();
    this.drawStatus();
  }
  // C: đổi lỗ đã gọi (đi vòng quanh bàn); chưa gọi → lỗ đang ngắm tới
  cycleCall() {
    if (!this.active || !this.needCall || (this.phase !== "aim" && this.phase !== "charge")) return;
    const ids = POCKET_ORDER.filter((id) => this.table.pockets.some((p) => p.id === id));
    for (const p of this.table.pockets) if (!ids.includes(p.id)) ids.push(p.id);
    this.setCall(this.call ? ids[(ids.indexOf(this.call) + 1) % ids.length] : this.predictPocket());
  }
  drawMarks() {
    const pb = this.playback, show = this.active && this.needCall && (this.phase === "aim" || this.phase === "charge");
    const lit = show ? this.call : pb?.call ?? null;     // đang lăn: lỗ người đánh đã gọi (cả khi xem người khác)
    for (const m of this.pocketMarks || []) {
      const on = m.userData.pocket === lit;
      m.visible = show || (!!lit && on);
      m.material.color.setHex(on ? 0xf37021 : 0xffffff);
      m.material.opacity = on ? 0.95 : 0.45;
    }
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

  // đánh: lực 0..1; spin / roll: điểm chạm (mặc định điểm đang chọn; không được chọn xoáy → 0). Trả Promise khi bi đã dừng (kết
  // quả cú). instant: bỏ qua hoạt cảnh (kiểm thử)
  shoot(angle = this.angle, power = this.power, { instant = false, spin = this.spinLv, roll = this.rollLv } = {}) {
    if (!this.active || this.playback || this.phase === "strike") return Promise.resolve(null);
    if (this.netActive && (!this.myTurn || !OWN.includes(this.phase))) return Promise.resolve(null);
    if (this.netActive && this.tb?.choice) return Promise.resolve(null);       // chờ chọn sau cú phá không hợp lệ
    this.angle = angle;
    this.power = power;
    const start = this.state;
    // đánh bi 8 mà chưa gọi lỗ (vd __game.pool.shoot): gọi lỗ bi 8 đang hướng tới theo góc này
    const call = this.needCall ? this.call || ((this.aim = aimInfo(this.table, start, angle)), this.predictPocket()) : null;
    if (!this.spinOn) spin = roll = 0;
    spin = spinLevel(spin); roll = spinLevel(roll);
    const res = simulateShot(this.table, start, { angle, power, spin, roll });
    this.phase = "strike";
    this.strikeT = 0;
    this.pull = 0.04 + 0.22 * power;
    this.playback = { res, t: 0, frame: 0, prev: res.frames[0], hidden: new Set(), own: true, net: this.netActive, tb: null, call, spin, roll };
    if (this.netActive) {
      // bàn chung: gửi thông số + kết quả (vị trí đã làm tròn — mọi bên lấy bàn máy chủ gửi về làm điểm xuất phát cú sau) + sự
      // kiện cú cho luật chuẩn (f / r / rb / kp — máy chủ không chạy vật lý, chỉ kiểm tra rồi áp luật; máy chủ cũ bỏ qua)
      const tb = this.tb, cue = tb.mode === "match" && tb.inHand ? [start.balls[0].x, start.balls[0].z] : null;
      this.playback.seq = tb.seq;
      // spin / roll chỉ gửi khi có xoáy (máy chủ cũ / bàn chưa cho xoáy: tin như cũ)
      this.net.sendPool({ t: "pool_shot", seq: tb.seq, a: angle, p: power, ...(spin || roll ? { spin, roll } : {}), cue, call,
        b: packBalls(res.finalState), k: res.pocketed, s: res.cueScratch, d: +res.time.toFixed(2), ...wireFacts(res) });
    }
    this.spinLv = this.rollLv = 0;                   // về giữa sau mỗi cú
    this.forceCall = false;
    this.drawSpin();
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
    this.lastSpin = { spin: pb.spin ?? 0, roll: pb.roll ?? 0, own: !!pb.own };    // kiểm thử: điểm chạm của cú vừa xong
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
      if (this.session.state.balls.every((b) => b.n === 0 || !b.on)) hud.toast(tt("pool.cleared", { n: this.session.shots }));
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
        const res = simulateShot(this.table, before, { angle: shot.a, power: shot.p, spin: shot.spin ?? 0, roll: shot.roll ?? 0 });
        if (Array.isArray(shot.b) && !same(packBalls(res.finalState), shot.b)) this.replayMismatch++;
        this.replays++;
        this.apply(before);
        this.playback = { res, t: 0, frame: 0, prev: res.frames[0], hidden: new Set(), own: false, net: true, seq: shot.seq, tb: m.tb, call: shot.call ?? null,
          spin: shot.spin ?? 0, roll: shot.roll ?? 0 };
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
    if (!this.spinOn && (this.spinLv || this.rollLv)) this.spinLv = this.rollLv = 0;     // bàn vừa tắt xoáy (có người ngồi bằng bản cũ)
    this.drawHud();
  }
  // tới lượt mình → ngắm (bi trong tay: đặt bi trắng trước; luật chuẩn sau cú phá không hợp lệ: chọn trước); không → xem
  refreshRole(instant = true) {
    if (!this.active || !this.netActive || this.playback) return;
    const tb = this.tb;
    if (!tb || (this.phase === "wait" && this.seat < 0)) return;     // chưa có trả lời cho pool_join
    const inHand = tb.mode === "match" && tb.inHand;
    if (this.myTurn) {
      if (this.rules2 && tb.choice) {                                  // xếp lại và phá (R) hay đánh tiếp (P)
        if (this.phase !== "choice") { this.phase = "choice"; this.override = null; this.hideAim(); this.snapCamera = instant; }
        return;
      }
      if (!inHand && this.override) { this.override = null; if (this.phase === "place") this.phase = "aim"; }
      if (OWN.includes(this.phase)) return;
      const turnChanged = this.turnV !== tb.v, fromChoice = this.phase === "choice";
      this.turnV = tb.v;
      this.override = inHand ? cloneState(this.shared.state) : null;
      this.phase = inHand ? "place" : "aim";
      this.needRelease = true;
      this.power = 0;
      this.call = null;
      if (inHand) this.angle = Math.PI / 2; else this.aimAtTarget();
      this.cursorAim = false;
      this.snapCamera = instant;
      this.placePlayer();
      // luật chuẩn: lỗi của đối thủ đã báo "bạn được bi trong tay" (netEvent) — không báo lại
      if (tb.mode === "match" && turnChanged && !fromChoice && this.foulV !== tb.v) hud.toast(t(inHand ? "pool.net_your_turn_in_hand" : "pool.net_your_turn"));
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
    this.netLog.push({ v: tb.v, k: ev.k, ...(ev.why ? { why: ev.why } : {}), ...(ev.reason ? { reason: ev.reason } : {}),
      ...(ev.foul ? { foul: ev.foul.why, ...(ev.foul.n != null ? { n: ev.foul.n } : {}) } : {}), ...(ev.brk ? { brk: ev.brk } : {}),
      ...(ev.c ? { c: ev.c } : {}), ...(ev.call ? { call: ev.call } : {}) });
    if (this.netLog.length > 60) this.netLog.splice(0, this.netLog.length - 60);
    if (!this.active || !this.netActive) return;
    const me = this.seat, name = (i) => tb.seats[i]?.name || "?", group = (g) => t(`pool.group_${g}`);
    const say = (key, vars) => hud.toast(t(key, vars));
    const v2 = tb.rules === RULES_V2;
    // lỗi (luật chuẩn): "Chạm bi 3 trước — lỗi." + ai được bi trong tay (cả bàn / khu đầu bàn); giữ trên bảng tới cú sau
    const foulSay = (foul, who) => {
      const why = t(`pool.foul_${foul.why}`, { n: foul.n ?? "", name: name(who) });
      const hand = tb.inHand === "kitchen" ? "pool.net_hand_kitchen" : "pool.net_hand";
      this.foul = why;
      this.foulV = tb.v;
      hud.toast(`${why} ${t(tb.turn === me ? `${hand}_you` : hand, { name: name(tb.turn) })}`);
      sound.play("tap");
    };
    if (ev.k === "start" || ev.k === "shot" || ev.k === "choice") this.foul = null;
    if (ev.k === "start") say("pool.net_start", { a: name(0), b: name(1), who: name(ev.seat) });
    else if (ev.k === "shot" && tb.mode !== "solo") {
      if (ev.respot8) say("pool.net_respot8");
      if (v2 && ev.foul) foulSay(ev.foul, ev.seat);
      else if (ev.scratch) say(tb.turn === me ? "pool.net_scratch_you" : "pool.net_scratch", { name: name(tb.turn) });
      if (ev.brk === "illegal") say("pool.net_break_illegal");             // ai chọn, chọn gì: dòng trạng thái + nút trên bảng
      else if (ev.brk === "legal" && ev.potted.some((n) => n !== 8) && !ev.foul) say("pool.net_open");
      if (ev.assigned) say(ev.seat === me ? "pool.net_you_group" : "pool.net_group", { name: name(ev.seat), group: group(ev.assigned) });
    } else if (ev.k === "foul") foulSay({ why: ev.why }, ev.seat);       // hết giờ (máy chủ)
    else if (ev.k === "choice") say(ev.c === "rerack" ? "pool.net_chose_rerack" : "pool.net_chose_play", { name: name(ev.seat) });
    else if (ev.k === "over") {
      const winner = name(ev.winner), loser = name(1 - ev.winner);
      const lose = { eight: "pool.net_lose", eight_scratch: "pool.net_lose_scratch", eight_early: "pool.net_lose_early",
        eight_foul: "pool.net_lose_foul", eight_pocket: "pool.net_lose_pocket", eight_off: "pool.net_lose_off" };
      if (v2 && ev.foul && ev.reason !== "eight_scratch") this.foul = t(`pool.foul_${ev.foul.why}`, { n: ev.foul.n ?? "", name: loser });
      if (me === ev.winner) say(ev.reason === "eight" ? "pool.net_win" : "pool.net_win_foul", { name: loser });
      else if (me >= 0) say(lose[ev.reason] || "pool.net_lose_early", { name: winner });
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
    this.showHint();
    this.drawHud();
  }
  // mỗi khung (bàn chung): chờ ghế quá lâu, đồng hồ lượt, báo máy chủ khi đối thủ hết giờ
  netTick(dt) {
    if (this.phase === "wait" && (this.waitT += dt) > WAIT_S) { this.toLocal("pool.net_no_reply"); return; }
    const tb = this.tb;
    if (tb?.mode !== "match" || this.deadline == null) return;
    const now = performance.now(), left = Math.max(0, Math.ceil((this.deadline - now) / 1000));
    if (left !== this.shownLeft) { this.shownLeft = left; this.drawStatus(); }
    // luật chuẩn: mình hết giờ (máy chủ sẽ tính lỗi khi có tin tới) → thôi nạp lực, chờ máy chủ
    if (this.rules2 && this.myTurn && now > this.deadline && this.phase === "charge") { this.phase = "aim"; this.power = 0; this.needRelease = true; this.touchPower = null; }
    if (this.seat >= 0 && tb.turn !== this.seat && !this.playback && now > this.deadline + POKE_S * 1000 && now - (this.pokeAt || 0) > 4000) {
      this.pokeAt = now;
      this.net?.sendPool({ t: "pool_poke" });
    }
  }

  // ---------- mỗi khung ----------
  update(dt, drag) {
    if (!this.active) { if (this.playback) this.roll(dt); return; }    // cú của người khác vẫn lăn khi mình đi lại
    // cảm ứng: kéo một ngón là ngắm (./pointer.js), không xoay camera; 2 ngón chụm vẫn thu phóng
    if (device.touch && drag) drag = { dx: 0, dy: 0, wheel: drag.wheel || 0 };
    const input = this.game.input, k = input.keys;
    const pressing = this.mouse || k.has("Space");
    if (!pressing) this.needRelease = false;
    if (this.netActive) this.netTick(dt);
    const slow = k.has("ShiftLeft") || k.has("ShiftRight") ? 0.25 : 1;
    const turn = ((k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0)) * 0.9 * slow;
    // chuột khoá: di chuột xoay cơ (movementX → drag, core/input.js); chuột không khoá: con trỏ ngắm (pointerMove), kéo chuột
    // không xoay cơ. Kéo ngón tay / kéo kiểu cũ khi không có chuột: vẫn xoay.
    const useDrag = input.locked || this.pointer?.lastType !== "mouse";
    const dx = useDrag ? (drag?.dx || 0) : 0, dy = useDrag ? (drag?.dy || 0) : 0;
    if (turn || dx) this.cursorAim = false;               // phím / chuột khoá: camera lại theo góc ngắm
    if (this.phase === "place") this.updatePlace(dt, { dx, dy }, pressing);
    else if (this.phase === "watch" || this.phase === "wait") {
      this.angle += turn * dt + (drag?.dx || 0) * 0.0032 * slow;   // xem: xoay quanh bàn (kéo chuột cũng được)
      if (drag?.dx) this.cursorAim = false;
    } else if (this.phase === "choice") {
      this.angle += turn * dt + (drag?.dx || 0) * 0.0032 * slow;   // chờ chọn R / P: xoay quanh bàn xem thế bi
      if (drag?.dx) this.cursorAim = false;
    } else if (this.phase === "aim" || this.phase === "charge") {
      const fine = this.nudge * NUDGE;                      // cảm ứng: giữ ◀ ▶ (camera giữ nguyên như ngắm bằng ngón tay)
      this.angle += turn * dt + dx * 0.0032 * slow + fine * dt;
      if (this.touchPower != null) {
        // cảm ứng: thanh lực đang kéo — lực theo ngón tay, thả mới đánh / huỷ (buildTouch)
        if (this.phase === "aim") { this.phase = "charge"; this.chargeT = 0; }
        this.power = this.touchPower;
      } else {
        const want = pressing && !this.needRelease;
        // đánh bi 8 chưa gọi lỗ: lần bấm này gọi lỗ đang ngắm tới (không nạp lực) — đổi bằng C / bấm vào lỗ khác
        if (want && this.phase === "aim" && this.needCall && !this.call) { this.setCall(this.predictPocket()); this.needRelease = true; }
        else if (want && this.phase === "aim") { this.phase = "charge"; this.chargeT = 0; }
        if (this.phase === "charge") {
          this.chargeT += dt;
          const c = (this.chargeT / CHARGE_S) % 2;
          this.power = c <= 1 ? c : 2 - c;
          if (!want) this.shoot(this.angle, Math.max(0.04, this.power));
        }
      }
      if (this.phase === "aim" || this.phase === "charge") this.drawAim();
      if (turn || dx || fine || this.cursorMoved) this.placePlayer();
      this.cursorMoved = false;
    }
    if (!this.cursorAim) this.camAngle = this.angle;
    if (drag?.wheel) this.camDist = THREE.MathUtils.clamp(this.camDist + drag.wheel * 0.12, 0.55, 2.4);
    if (this.phase === "strike") {
      this.strikeT += dt;
      if (this.strikeT >= STRIKE_S) { this.phase = "roll"; this.rollT = 0; }
    }
    if (this.playback && (this.phase === "roll" || !this.playback.own)) this.roll(dt);
    this.drawCue();
    this.drawPower();
    this.drawMarks();
    this.drawSpin();
    this.drawTouch();
    this.drawPlaceMark();
  }
  // bi trắng trong tay: W/S dọc bàn, A/D ngang (chuột kéo cũng được), trong khu đầu bàn (luật chuẩn sau lỗi: cả bàn), không
  // chồng bi; Space / nhấp: đặt
  updatePlace(dt, drag, pressing) {
    const st = this.override;
    if (!st) { this.phase = "aim"; return; }
    if (pressing && !this.needRelease) { this.confirmPlace(); return; }
    const k = this.game.input.keys, has = (...c) => c.some((x) => k.has(x));
    const sp = 0.5 * (has("ShiftLeft", "ShiftRight") ? 0.3 : 1) * dt;
    const right = (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0);
    const fwd = (has("KeyW", "ArrowUp") ? 1 : 0) - (has("KeyS", "ArrowDown") ? 1 : 0);
    // camera nhìn từ đầu bàn về phía xếp bi (+z): bên phải màn hình = −x cục bộ
    const dx = -right * sp - (drag?.dx || 0) * 0.0012, dz = fwd * sp - (drag?.dy || 0) * 0.0012;
    if (!dx && !dz) return;
    const c = st.balls[0];
    this.moveCue(c.x + dx, c.z + dz);
  }
  // bi trong tay → đặt xong (Space / nhấp chuột / nút "Đặt bi" cảm ứng): sang ngắm
  confirmPlace() {
    if (!this.active || this.phase !== "place" || !this.override) return false;
    if (this.forceHand && !this.netActive) { this.override = null; this.forceHand = null; }   // kiểm thử ở bàn tập: bàn tập giữ chỗ bi
    this.phase = "aim";
    this.needRelease = true;
    this.placeBad = null;
    this.aimAtTarget();
    this.placePlayer();
    this.snapCamera = true;
    this.drawStatus();
    if (device.touch) sound.play("tap");
    return true;
  }
  // bi trong tay: dời bi trắng tới (x, z) cục bộ — kẹp trong vùng được đặt (khu đầu bàn / cả bàn), không chồng bi (không được
  // thì trượt theo 1 trục). placeBad: chỗ được hỏi không đặt được (vòng đỏ khi kéo bằng ngón tay)
  moveCue(x, z) {
    const st = this.override;
    if (!st) return false;
    const hand = this.hand || "kitchen";
    const c = st.balls[0], kk = handArea(this.table, hand), clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const nx = clamp(x, kk.x0, kk.x1), nz = clamp(z, kk.z0, kk.z1);
    const tryAt = (px, pz) => canPlaceCueIn(this.table, st, px, pz, hand) && !!placeCue(st, px, pz);
    const exact = nx === x && nz === z && tryAt(nx, nz);
    this.placeBad = exact ? null : { x: nx, z: nz };
    if (exact || tryAt(nx, nz) || tryAt(nx, c.z) || tryAt(c.x, nz)) this.apply(st);
    return exact;
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
  hideAim() { this.aimLine.visible = this.objLine.visible = this.ghost.visible = this.assistLine.visible = this.pathLine.visible = false; }
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
    // hướng bi trắng sau lần chạm đầu, có tính xoáy (gợi ý ngắn; thử thách: không vẽ — giữ như cũ)
    const after = this.challenge ? null : cueAfter(this.table, s, this.angle, this.spinOn ? this.spinLv : 0, this.spinOn ? this.rollLv : 0);
    this.pathLine.visible = !!after && after.speed > 0.02;
    if (this.pathLine.visible) {
      const from = new THREE.Vector3(after.from.x, y, after.from.z), len = 0.08 + 0.22 * Math.min(1, after.speed);
      setLine(this.pathLine, from, from.clone().add(new THREE.Vector3(after.dir.x, 0, after.dir.z).multiplyScalar(len)));
    }
    this.after = after;
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
        if (a === "play") this.choose("play");
        if (a === "rules") this.help();
      });
    }
    const leave = `<button class="ghost" data-a="leave">${esc(t("pool.leave"))} <kbd>Esc</kbd></button>`;
    const power = `<div class="power"><span>${esc(t("pool.power"))}</span><div class="bar"><i></i></div><em class="left"></em></div>`;
    if (this.netActive) {
      this.hudEl.innerHTML = this.netPanel(leave) + power + this.rulesCard();
      this.drawStatus();
      return;
    }
    const s = this.session, total = this.table.rack.length - 1;
    this.hudEl.innerHTML = `${this.challenge ? "" : `<div class="panel"><b>🎱 ${esc(t("pool.title"))}</b>
        <span>${esc(t("pool.stats", { shots: s.shots, potted: s.potted, total }))}</span>
        <div class="row"><button class="ghost" data-a="rerack">${esc(t("pool.rerack"))} <kbd>R</kbd></button>${leave}</div></div>`}${power}${this.rulesCard()}`;
  }
  // bàn chung: 2 ghế (tên, nhóm, số bi còn lại, ai đang đánh), dòng trạng thái, nút
  netPanel(leave) {
    const tb = this.tb;
    const match = tb && (tb.mode === "match" || tb.mode === "over");
    // luật chuẩn: đồng hồ lượt cạnh tiêu đề (drawStatus cập nhật mỗi giây)
    const clock = this.rules2 && tb.mode === "match" ? `<span class="clock"></span>` : "";
    const title = `<div class="head"><b>🎱 ${esc(t(match ? "pool.title_match" : "pool.title"))}</b>${clock}</div>`;
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
    if (this.phase === "choice") {
      btns.push(`<button data-a="rerack">${esc(t("pool.rerack_break"))} <kbd>R</kbd></button>`);
      btns.push(`<button data-a="play">${esc(t("pool.play_on"))} <kbd>P</kbd></button>`);
    }
    if (this.seat >= 0 && (tb.mode === "solo" || tb.mode === "over")) btns.push(`<button class="ghost" data-a="rerack">${esc(t(tb.mode === "over" ? "pool.rematch" : "pool.rerack"))} <kbd>R</kbd></button>`);
    if (this.seat < 0 && tb.seats.includes(null) && this.phase !== "wait") btns.push(`<button class="ghost" data-a="join">${esc(t("pool.join"))} <kbd>J</kbd></button>`);
    if (tb.rules === RULES_V2) btns.push(`<button class="ghost" data-a="rules">${esc(t("pool.rules"))} <kbd>H</kbd></button>`);
    btns.push(leave);
    const foul = this.foul && this.rules2 ? `<span class="foul">⚠ ${esc(this.foul)}</span>` : "";
    return `<div class="panel net">${title}<div class="seats">${seats}</div>${stats}${foul}<span class="status"></span><div class="row">${btns.join("")}</div></div>`;
  }
  statusText() {
    const tb = this.tb;
    if (!tb || this.phase === "wait") return t("pool.net_joining");
    const name = (i) => tb.seats[i]?.name || "?";
    const s = this.deadline != null ? Math.max(0, Math.ceil((this.deadline - performance.now()) / 1000)) : null;
    if (tb.mode === "over") {
      const head = this.seat === tb.winner ? t("pool.net_status_won") : t("pool.net_status_winner", { name: name(tb.winner) });
      return this.seat >= 0 ? `${head} ${tt("pool.net_rematch_hint")}` : head;
    }
    if (this.seat < 0) {
      if (tb.seats.includes(null)) return tt("pool.net_status_free");
      return tb.mode === "match" ? t("pool.net_status_turn", { name: name(tb.turn), s: s ?? "–" }) : t("pool.net_status_watch");
    }
    if (tb.mode === "solo") return t("pool.net_status_solo");
    if (tb.turn !== this.seat) {
      if (this.rules2 && tb.choice) return t("pool.net_status_choosing", { name: name(tb.turn) });
      return t("pool.net_status_turn", { name: name(tb.turn), s: s ?? "–" });
    }
    if (this.phase === "choice") return tt("pool.net_status_choice");
    if (this.phase === "place") return tt(this.hand === "table" ? "pool.net_status_place_table" : "pool.net_status_place");
    if (this.needCall) return this.call ? t("pool.net_status_called", { pocket: this.pocketName(this.call) }) : tt("pool.net_status_call");
    if (this.rules2) return t("pool.net_status_your_turn");              // luật chuẩn: giây đếm ngược ở đồng hồ
    return s != null && s <= 20 ? t("pool.net_status_your_turn_s", { s }) : t("pool.net_status_your_turn");
  }
  drawStatus() {
    const el = this.hudEl?.querySelector(".status");
    if (el) el.textContent = this.statusText();
    const clock = this.hudEl?.querySelector(".clock");
    if (clock) {
      const s = this.deadline != null ? Math.max(0, Math.ceil((this.deadline - performance.now()) / 1000)) : null;
      clock.textContent = s == null ? "" : `⏱ ${s}`;
      clock.classList.toggle("low", s != null && s <= 10);
    }
  }
  // ---------- điểm chạm trên bi trắng (xoáy) ----------
  // ô góc phải dưới: hình bi trắng + chấm điểm chạm. Kéo / bấm chấm bằng chuột hoặc ngón tay (pointer events trên chính ô đó,
  // giữ pointer capture → kéo ra ngoài vẫn nhận; không đụng khung vẽ nên không lẫn với ngắm cơ / khoá con trỏ). Con trỏ đang
  // khoá (ẩn) thì dùng phím Z / X / F / B.
  buildSpin() {
    this.spinEl?.remove();
    const el = document.createElement("div");
    el.id = "pool-spin";
    el.hidden = true;
    el.innerHTML = `<b>${esc(t("pool.spin"))}</b><div class="ball" role="slider" tabindex="-1" aria-label="${esc(t("pool.spin"))}"><span class="cross"></span><i></i></div>
      <small class="val"></small><small class="keys">Z X · F B</small>`;
    document.body.appendChild(el);
    const ball = el.querySelector(".ball");
    let id = null;
    const at = (e) => {
      const r = ball.getBoundingClientRect(), R = r.width / 2;
      if (!R) return;
      const ux = (e.clientX - (r.left + R)) / R, uy = -(e.clientY - (r.top + R)) / R;
      const lv = (u) => Math.max(-SPIN_LEVELS, Math.min(SPIN_LEVELS, Math.round((u / SPIN_R) * SPIN_LEVELS)));
      this.setSpin(lv(ux), lv(uy), { quiet: true });
    };
    ball.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !this.spinShown) return;
      e.preventDefault(); e.stopPropagation();
      id = e.pointerId;
      ball.setPointerCapture?.(id);
      at(e);
    });
    ball.addEventListener("pointermove", (e) => { if (e.pointerId === id) at(e); });
    const up = (e) => { if (e.pointerId !== id) return; id = null; ball.releasePointerCapture?.(e.pointerId); sound.play("tap"); };
    ball.addEventListener("pointerup", up);
    ball.addEventListener("pointercancel", up);
    ball.addEventListener("dblclick", () => this.setSpin(0, 0));
    this.spinEl = el;
    this.spinKey = null;
    this.drawSpin();
  }
  // đặt điểm chạm (nấc −2 … +2) — không được chọn xoáy thì giữ giữa
  setSpin(spin, roll, { quiet = false } = {}) {
    if (!this.active || !this.spinOn) return false;
    const s = spinLevel(Math.round(spin)), r = spinLevel(Math.round(roll));
    if (s === this.spinLv && r === this.rollLv) return true;
    this.spinLv = s; this.rollLv = r;
    if (!quiet) sound.play("tap");
    this.drawSpin();
    return true;
  }
  // phím Z / X (trái / phải), F / B (đè / kéo): dời chấm 1 nấc — chỉ lúc đang ngắm / đặt bi trắng của mình
  nudgeSpin(ds, dr) {
    if (!this.spinShown) return false;
    return this.setSpin(this.spinLv + ds, this.rollLv + dr);
  }
  // ô chọn hiện khi: được chọn xoáy và đang tới lượt mình ngắm / nạp lực / đặt bi trắng
  get spinShown() {
    return this.active && this.spinOn && ["aim", "charge", "place"].includes(this.phase) && (!this.netActive || this.myTurn);
  }
  spinText() {
    const parts = [];
    if (this.spinLv) parts.push(t(this.spinLv > 0 ? "pool.spin_right" : "pool.spin_left", { n: Math.abs(this.spinLv) }));
    if (this.rollLv) parts.push(t(this.rollLv > 0 ? "pool.spin_follow" : "pool.spin_draw", { n: Math.abs(this.rollLv) }));
    return parts.length ? parts.join(" · ") : t("pool.spin_center");
  }
  // vẽ lại khi đổi (gọi mỗi khung; chỉ đụng DOM khi khác lần trước)
  drawSpin() {
    const el = this.spinEl;
    if (!el) return;
    const shown = this.spinShown, key = `${shown}|${this.spinLv}|${this.rollLv}`;
    if (key === this.spinKey) return;
    this.spinKey = key;
    el.hidden = !shown;
    const dot = el.querySelector(".ball i");
    dot.style.left = `${50 + (this.spinLv / SPIN_LEVELS) * SPIN_R * 50}%`;
    dot.style.top = `${50 - (this.rollLv / SPIN_LEVELS) * SPIN_R * 50}%`;
    el.classList.toggle("off", !this.spinLv && !this.rollLv);
    el.querySelector(".val").textContent = this.spinText();
  }

  // ---------- cảm ứng: thanh lực, ngắm tinh, cột nút (chỉ hiện khi body.touch — CSS) ----------
  // Khung riêng #pool-touch (không nằm trong #pool-hud: bảng được vẽ lại mỗi khi bàn chung đổi, ngón tay đang kéo thanh lực
  // sẽ mất). Thanh lực: kéo xuống từ chỗ đặt ngón (lực = quãng kéo / 90 % chiều cao thanh), thả ≥ CANCEL_POWER → đánh, thấp hơn
  // (kéo về đỉnh) → huỷ. ◀ ▶: giữ để xoay chậm. Cột nút: Luật, Xếp lại / Ngồi, Rời bàn. Góc phải dưới theo lúc: ◀ ▶ (ngắm),
  // "Đặt bi" (bi trong tay), "Xếp lại và phá" / "Đánh tiếp" (sau cú phá không hợp lệ).
  buildTouch() {
    this.touchEl?.remove();
    const el = document.createElement("div");
    el.id = "pool-touch";
    const b = (a, label, text, cls = "round") => `<button type="button" class="${cls}" data-a="${a}" aria-label="${esc(label)}" title="${esc(label)}" hidden>${text}</button>`;
    el.innerHTML = `<div class="tpower" hidden role="slider" aria-label="${esc(t("pool.power_touch"))}" title="${esc(t("pool.power_touch"))}"><span>${esc(t("pool.power"))}</span><div class="track"><i></i><b></b></div></div>
      <div class="icons">${b("rules", t("pool.rules"), "?")}${b("rerack", t("pool.rerack"), "↻")}${b("join", t("pool.join"), "🪑")}${b("leave", t("pool.leave"), "✕")}</div>
      <div class="ctx">${b("aimL", t("pool.aim_left"), "◀")}${b("aimR", t("pool.aim_right"), "▶")}${b("place", t("pool.place"), esc(t("pool.place")), "primary")}${
        b("rerack_break", t("pool.rerack_break"), esc(t("pool.rerack_break")), "primary")}${b("play", t("pool.play_on"), esc(t("pool.play_on")), "ghost")}</div>`;
    document.body.appendChild(el);
    this.touchEl = el;
    this.touchKey = null;
    el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "rules") this.help();
      else if (a === "rerack") this.rerack();
      else if (a === "join") this.join();
      else if (a === "leave") { if (this.challenge) this.game.ui.minigame.close(false); else this.leave(); }
      else if (a === "place") this.confirmPlace();
      else if (a === "rerack_break") this.choose("rerack");
      else if (a === "play") this.choose("play");
    });
    // ◀ ▶: giữ để xoay
    for (const [a, dir] of [["aimL", -1], ["aimR", 1]]) {
      const btn = el.querySelector(`[data-a=${a}]`);
      const stop = () => { if (this.nudge === dir) this.nudge = 0; };
      btn.addEventListener("pointerdown", (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch { /* chạm giả lập */ } this.nudge = dir; });
      for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) btn.addEventListener(ev, stop);
    }
    // thanh lực
    const bar = el.querySelector(".tpower"), track = el.querySelector(".track");
    let id = null, y0 = 0;
    bar.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (id != null || !this.canCharge()) return;
      if (this.needCall && !this.call) { this.setCall(this.predictPocket()); return; }   // như Space: lần chạm đầu gọi lỗ đang ngắm tới
      id = e.pointerId;
      y0 = e.clientY;
      try { bar.setPointerCapture(id); } catch { /* chạm giả lập */ }
      this.touchPower = 0;
    });
    bar.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      const h = track.getBoundingClientRect().height || 1;
      this.touchPower = Math.max(0, Math.min(1, (e.clientY - y0) / (h * 0.9)));
    });
    const release = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      const p = this.touchPower;
      this.touchPower = null;
      if (this.phase !== "charge") return;
      if (p != null && p >= CANCEL_POWER) this.shoot(this.angle, p);
      else { this.phase = "aim"; this.power = 0; }                 // kéo về đỉnh rồi thả: huỷ
    };
    bar.addEventListener("pointerup", release);
    bar.addEventListener("pointercancel", release);
  }
  // được kéo thanh lực: đang ngắm, tới lượt mình, không chờ chọn / bi chưa dừng
  canCharge() {
    if (!this.active || this.phase !== "aim" || this.playback || !this.state.balls[0].on) return false;
    return !this.netActive || (this.myTurn && !this.tb?.choice);
  }
  // hiện / ẩn nút theo lúc (gọi mỗi khung; chỉ đụng DOM khi khác lần trước) + độ dài thanh lực
  drawTouch() {
    const el = this.touchEl;
    if (!el) return;
    const tb = this.tb, mine = !this.netActive || this.myTurn;
    const aiming = (this.phase === "aim" || this.phase === "charge") && mine && !(this.netActive && tb?.choice) && this.state.balls[0].on;
    const vis = {
      tpower: aiming, aimL: aiming, aimR: aiming, place: this.phase === "place", rerack_break: this.phase === "choice", play: this.phase === "choice",
      rules: !this.challenge, leave: !this.challenge,
      rerack: !this.challenge && this.phase !== "choice" && (!this.netActive || (this.seat >= 0 && (tb?.mode === "solo" || tb?.mode === "over"))),
      join: this.netActive && this.seat < 0 && !!tb?.seats.includes(null) && this.phase !== "wait",
    };
    const key = JSON.stringify(vis);
    if (key !== this.touchKey) {
      this.touchKey = key;
      for (const [a, on] of Object.entries(vis)) {
        const node = a === "tpower" ? el.querySelector(".tpower") : el.querySelector(`[data-a=${a}]`);
        node.hidden = !on;
      }
    }
    const pw = this.phase === "charge" && this.touchPower != null ? this.touchPower : this.phase === "charge" ? this.power : 0;
    if (pw !== this.touchPw) {
      this.touchPw = pw;
      el.querySelector(".track i").style.height = `${Math.round(pw * 100)}%`;
      el.querySelector(".track b").style.top = `${Math.round(pw * 100)}%`;
    }
  }
  // bi trong tay (cảm ứng): vòng xanh dưới bi trắng; chỗ ngón tay vừa kéo tới không đặt được → vòng đỏ ở đó
  drawPlaceMark() {
    const m = this.placeMark, on = device.touch && this.phase === "place" && !!this.override;
    m.visible = on;
    if (!on) return;
    const c = this.override.balls[0], at = this.placeBad || c, y = this.table.ballY - this.table.r * 0.9;
    m.position.set(at.x, y, at.z);
    m.material.color.setHex(this.placeBad ? 0xe5484d : 0x5ce08a);
  }
  // __game.pool.touch: các nút cảm ứng đang hiện (hộp trên màn hình), lực đang kéo — smoke test chạm đúng chỗ, đo chồng nhau
  touchInfo() {
    const box = (n) => { if (!n || n.hidden || !n.getClientRects().length) return null; const r = n.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    const el = this.touchEl, out = {};
    if (el) {
      out.tpower = box(el.querySelector(".tpower"));
      for (const n of el.querySelectorAll("[data-a]")) { const b = box(n); if (b) out[n.dataset.a] = b; }
    }
    const hudBox = { panel: box(this.hudEl?.querySelector(".panel")), rules: box(this.hudEl?.querySelector(".rules")), spin: box(this.spinEl), power: box(this.hudEl?.querySelector(".power.keep")) };
    for (const [k, v] of Object.entries(hudBox)) if (v) out[k] = v;
    const cue = this.state.balls[0], s = this.pointer && cue.on ? this.pointer.screen(cue.x, cue.z) : null;
    const contact = this.aim?.contact && this.pointer ? this.pointer.screen(this.aim.contact.x, this.aim.contact.z) : null;
    return { on: device.touch, boxes: out, power: this.touchPower, nudge: this.nudge, placeBad: !!this.placeBad, placeMark: this.placeMark?.visible ?? false,
      cueScreen: s && { x: Math.round(s.x), y: Math.round(s.y) }, contactScreen: contact && { x: Math.round(contact.x), y: Math.round(contact.y) },
      pockets: this.pointer ? this.table.pockets.map((p) => { const q = this.pointer.screen(p.x, p.z); return { id: p.id, x: Math.round(q.x), y: Math.round(q.y), visible: q.visible }; }) : [] };
  }

  // ---------- phím H: tóm tắt luật (bàn chung luật chuẩn / luật cũ / tập một mình) ----------
  rulesKeys() {
    const spin = this.spinOn ? ["rules_spin"] : [];
    if (this.rules2) return ["rules_break", "rules_open", "rules_foul", "rules_eight", "rules_lose", "rules_clock", ...spin];
    const tb = this.tb;
    return [this.netActive && tb && (tb.mode === "match" || tb.mode === "over") ? "rules_legacy" : "rules_practice", ...spin];
  }
  rulesCard() {
    if (!this.rulesOpen) return "";
    return `<div class="rules"><b>${esc(t(this.rules2 ? "pool.rules_title" : "pool.title"))} <kbd>H</kbd></b>${
      this.rulesKeys().map((k) => `<p>${esc(tt(`pool.${k}`))}</p>`).join("")}</div>`;
  }
  help() {
    if (!this.active || this.challenge) return false;
    this.rulesOpen = !this.rulesOpen;
    this.drawHud();
    sound.play("tap");
    return this.rulesOpen;
  }
  // dòng hướng dẫn dưới màn hình: cách ngắm theo chế độ chuột + phím của chế độ chơi
  hintText() {
    if (device.touch) return `${t("pool.hint_touch")}${this.spinOn ? ` · ${t("pool.hint_spin_touch")}` : ""}`;
    const aim = t(this.mouseMode === "free" ? "pool.hint_aim_free" : "pool.hint_aim_mouse");
    const spin = this.spinOn ? ` · ${t("pool.hint_spin")}` : "";
    return `${aim}${spin} · ${t(this.challenge ? "pool.controls_challenge" : this.netActive ? "pool.controls_net" : "pool.controls")}`;
  }
  showHint() { if (this.active) hud.hint(this.hintText(), device.touch ? 8 : 600); }   // cảm ứng: tắt sau 8 s (khỏi che bàn)

  // ---------- camera + chỗ đứng ----------
  local(v) { return this.root.localToWorld(v.clone()); }
  // độ cao (toạ độ cục bộ của bàn) camera không được vượt khi ở trên mặt bàn: vật thấp nhất phía trên mặt chơi (zone_05: mép
  // dưới 3 chao đèn thả ~1,75 m; không có đèn thì là trần) trừ 15 cm. Camera thấp hơn mép chao thì mọi tia nhìn xuống bàn
  // đều đi dưới đèn — đèn không che bàn, không kéo camera vào. Đo 1 lần mỗi zone: tia thẳng đứng từ lưới điểm phủ mặt bàn
  headroom() {
    if (this.headroomY != null && this.headroomOf === this.zone) return this.headroomY;
    const bt = this.zone?.view?.geometry.boundsTree, size = this.cfg.table.size, y = this.table.ballY, inv = this.root.matrixWorld.clone().invert();
    let top = Infinity;
    if (bt) {
      const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), up = new THREE.Vector3(0, 1, 0).transformDirection(this.root.matrixWorld);
      for (let x = -size.width / 2; x <= size.width / 2 + 1e-6; x += size.width / 16) {
        for (let z = -size.length / 2; z <= size.length / 2 + 1e-6; z += size.length / 28) {
          ray.set(this.local(new THREE.Vector3(x, y + 0.1, z)), up);
          const hit = bt.raycastFirst(ray, THREE.DoubleSide, 0, 4);
          if (hit) top = Math.min(top, hit.point.applyMatrix4(inv).y);
        }
      }
    }
    this.headroomOf = this.zone;
    this.headroomY = (top === Infinity ? y + 3 : top) - 0.15;
    return this.headroomY;
  }
  camera(dt) {
    const cam = this.game.camera, s = this.state, cue = s.balls[0], y = this.table.ballY;
    // hướng camera: theo góc ngắm, trừ khi vừa ngắm bằng con trỏ không khoá (camera xoay theo thì điểm dưới con trỏ chạy
    // theo → góc ngắm trôi mãi)
    const d = new THREE.Vector3(Math.cos(this.camAngle), 0, Math.sin(this.camAngle));
    let pos, look;
    if (this.phase === "place" && this.hand !== "table") {
      // bi trong tay ở khu đầu bàn: nhìn từ sau băng đầu bàn xuống khu đầu bàn
      pos = new THREE.Vector3(cue.x * 0.4, y + 1.2, -this.table.rz - 0.65);
      look = new THREE.Vector3(cue.x * 0.6, y, -this.table.rz * 0.4);
    } else if (this.phase === "roll" || this.phase === "watch" || this.phase === "wait" || this.phase === "choice" || this.phase === "place" || !cue.on) {
      // (bi trong tay cả bàn: cũng nhìn bao quát — góc ngắm π/2 khi đặt → camera ở đầu bàn, W/A/S/D như khu đầu bàn)
      // bi đang lăn / đang xem: nhìn bao quát bàn từ phía camera đang đứng — dưới chao đèn treo (thấp hơn thì lùi xa hơn,
      // vẫn thấy cả bàn); trước đây cao 1,55 m trên mặt bi → tia từ bi tới camera chạm chao, camera bị kéo vào sát đèn
      const h = Math.max(0.45, Math.min(1.55, this.headroom() - y));
      const back = d.clone().multiplyScalar(-(1.15 + (1.55 - h)));
      pos = new THREE.Vector3(back.x, y + h, back.z);
      look = new THREE.Vector3(0, y, 0);
    } else {
      const c = new THREE.Vector3(cue.x, y, cue.z);
      const h = Math.max(0.3, Math.min(0.18 + this.camDist * 0.42, this.headroom() - y));   // lăn chuột ra xa: không lên quá chao đèn
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
  // cú tự chọn (game/src/pool/auto.js) cho người tới lượt — kiểm thử 2 người; bi trong tay: giữ chỗ đặt hiện tại. Đánh bi 8
  // (luật chuẩn): gọi đúng lỗ bi 8 sẽ vào theo vật lý (không vào → lỗ đang hướng tới). Đang chờ chọn sau cú phá: trả null
  autoShot({ instant = true, spin = 0, roll = 0 } = {}) {
    if (!this.active || (this.netActive && !this.myTurn) || this.phase === "choice") return Promise.resolve(null);
    if (this.phase === "place") this.phase = "aim";
    const s = this.state;
    const list = this.netActive && this.tb ? targets(s, this.tb, this.seat) : s.balls.filter((b) => b.n !== 0 && b.on).map((b) => b.n);
    const pick = pickShot(this.table, s, list);
    if (this.needCall) {
      const sp = this.spinOn ? { spin, roll } : {};
      const facts = shotFacts(simulateShot(this.table, s, { angle: pick.angle, power: pick.power, ...sp }, { frames: false }));
      this.call = facts.pockets[8] || null;
      if (!this.call) { this.aim = aimInfo(this.table, s, pick.angle); this.call = this.predictPocket(); }
    }
    return this.shoot(pick.angle, pick.power, { instant, spin, roll });
  }
  // kiểm thử: thế bi dựng sẵn ở bàn tập một mình — balls { n: [x, z] }; call: bắt gọi lỗ như lúc đánh bi 8 (thử chạm vào lỗ);
  // hand: "table" / "kitchen" — bi trong tay (thử kéo bi trắng bằng ngón tay + nút Đặt bi)
  debugState(balls, { call = false, hand = null } = {}) {
    if (!this.active || this.netActive || this.challenge || this.playback) return false;
    this.session.state = customState(this.table, balls);
    this.apply(this.session.state);
    this.phase = "aim";
    this.power = 0;
    this.forceCall = !!call;
    this.forceHand = hand;
    this.call = null;
    this.aimAtTarget();
    if (hand) { this.override = this.session.state; this.phase = "place"; this.angle = Math.PI / 2; this.cursorAim = false; }
    this.placePlayer();
    this.snapCamera = true;
    return true;
  }
  // bi trong tay: đặt bi trắng ở (x, z) cục bộ (kiểm thử; người chơi dùng W/A/S/D) → false nếu ngoài vùng được đặt / chồng bi
  debugPlace(x, z) {
    if (this.phase !== "place" || !this.override || !canPlaceCueIn(this.table, this.override, x, z, this.hand || "kitchen")) return false;
    placeCue(this.override, x, z);
    this.apply(this.override);
    return true;
  }
  // gửi cú bất chấp lượt / giới hạn (kiểm thử: máy chủ phải chặn); extra: trường thêm vào tin (vd { spin: 3 })
  forceShot(angle, power, extra = {}) {
    const tb = this.tb, n = this.game.net;
    if (!tb || !n?.connected || !this.shared?.state) return false;
    const res = simulateShot(this.table, this.shared.state, { angle, power }, { frames: false });
    n.sendPool({ t: "pool_shot", seq: tb.seq, a: angle, p: power, cue: null, b: packBalls(res.finalState), k: res.pocketed, s: res.cueScratch, d: 1, ...wireFacts(res), ...extra });
    return true;
  }
  // kiểm thử: camera so với mặt bàn — cao bao nhiêu (cục bộ), giới hạn dưới chao đèn, tia camera → tâm bàn có vướng lưới
  // bối cảnh nào không (đèn treo, trần; bi và người do code dựng không thuộc zone.view)
  cameraView() {
    const cam = this.game.camera.position, bt = this.zone?.view?.geometry.boundsTree;
    const ctr = this.local(new THREE.Vector3(0, this.table.ballY, 0)), dir = ctr.clone().sub(cam), len = dir.length();
    const hit = bt && len > 0.1 ? bt.raycastFirst(new THREE.Ray(cam.clone(), dir.normalize()), THREE.DoubleSide, 0, len - 0.05) : null;
    return { y: +this.root.worldToLocal(cam.clone()).y.toFixed(3), headroom: +this.headroom().toFixed(3), blocked: hit ? +hit.distance.toFixed(2) : null };
  }
  info() {
    const s = this.state, tb = this.tb;
    return { active: this.active, challenge: !!this.challenge, phase: this.phase, angle: +this.angle.toFixed(4), power: +this.power.toFixed(2),
      shots: this.session?.shots, potted: this.session?.potted, onTable: s?.balls.filter((b) => b.on).map((b) => b.n),
      cue: s && { x: +s.balls[0].x.toFixed(4), z: +s.balls[0].z.toFixed(4), on: s.balls[0].on },
      cuesHidden: this.cues?.every((c) => !c.visible), rolling: !!this.playback, left: this.challenge?.left ?? null,
      spin: { on: this.spinOn, spin: this.spinLv, roll: this.rollLv, shown: !!this.spinEl && !this.spinEl.hidden, text: this.spinText(),
        path: this.pathLine?.visible && this.after ? { from: this.after.from, dir: this.after.dir } : null, last: this.playback ? { spin: this.playback.spin ?? 0, roll: this.playback.roll ?? 0 } : this.lastSpin ?? null },
      mouse: this.active ? this.mouseMode : null, cursorAim: this.cursorAim, camAngle: +this.camAngle.toFixed(4), pressing: this.mouse,
      net: { on: this.netMode, active: this.netActive, seat: this.seat, myTurn: this.myTurn, mode: tb?.mode ?? null, seq: tb?.seq ?? null,
        v: tb?.v ?? null, turn: tb?.turn ?? null, groups: tb?.groups ?? null, inHand: tb?.inHand ?? null, winner: tb?.winner ?? null,
        rules: tb?.rules ?? null, rules2: this.rules2, spin: tb?.spin ?? null, choice: tb?.choice ?? null, brk: tb?.brk ?? null, hand: this.hand, needCall: this.needCall,
        call: this.call, callName: this.call ? this.pocketName(this.call) : null, foul: this.foul, rulesOpen: this.rulesOpen, status: this.active && this.netActive ? this.statusText() : null,
        clock: this.hudEl?.querySelector(".clock")?.textContent ?? null, marks: this.pocketMarks?.filter((m) => m.visible).map((m) => m.userData.pocket) ?? [],
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
