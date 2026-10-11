// Điều khiển cảm ứng (điện thoại / máy tính bảng; laptop cảm ứng: bật khi chạm lần đầu, bấm phím thì tắt — core/device.js).
// Chỉ hiện khi body.touch (CSS). Thành phần:
//   • Điều khiển ảo (joystick) góc trái dưới: chạm vào nửa trái phía dưới → tâm cần điều khiển đặt ở chỗ chạm, kéo để đi; đẩy hết
//     cỡ (> 92 % bán kính) = chạy. Ghi vào input.stick (core/input.js thay phím W/A/S/D). Vuốt phần còn lại của màn hình: xoay
//     camera; chụm / mở 2 ngón: camera xa / gần (core/input.js).
//   • Nút góc phải dưới: nút lớn thay phím E — ghi đúng tên việc như dòng nhắc "E: …" (hud.promptText), chỉ hiện khi đứng gần;
//     hàng nút tròn ≥ 48 px: Chat, Emote / câu nhanh (T), Help (H), App My FPT (Tab), Menu (Esc), toàn màn hình (Android; iOS:
//     hướng dẫn "Thêm vào màn hình chính"). Hội thoại: chạm vào màn hình để nói tiếp (input.onTap), chạm vào lựa chọn.
//   • Ở bàn bi-a (chưa chơi bằng cảm ứng được — làm sau): dòng "Bi-a bằng cảm ứng sắp có" + nút Rời bàn.
//   • Cầm dọc: nhắc xoay ngang (CSS, #rotate). Bàn phím ảo (visualViewport): --kb = chiều cao bàn phím, ô đang gõ cuộn vào giữa
//     phần còn thấy (khung chat, ô mật khẩu mini-game Đăng nhập, ô tên).
//   • Chặn menu khi giữ ngón (contextmenu), phóng to bằng 2 ngón trên iOS (gesturestart); phóng to / kéo xuống làm mới: CSS
//     (touch-action, overscroll-behavior), meta viewport.
//   • Màn thấp (body.short — giao diện cảm ứng đang bật hoặc khung cao ≤ SHORT_H px; vd Android cầm ngang, thanh địa chỉ chiếm
//     ~1/4 → còn ~230 px): CSS thu nhỏ khung thoại / bảng tên / các khung khác; --vvh = chiều cao vùng nhìn thấy thật
//     (visualViewport) cho max-height của các khung.
//   • Toàn màn hình: Start / Continue ở màn tiêu đề (cử chỉ người dùng) → tự xin toàn màn hình + khoá xoay ngang (Android; lỗi
//     thì im lặng); thoát toàn màn hình → nút ⛶ nhấp nháy 1 lần. "Thêm vào màn hình chính": public/manifest.webmanifest.
// Chữ: data/i18n → touch.*. __game.touch: trạng thái + vị trí các nút (smoke test chạm đúng chỗ).
import { t, lang } from "../i18n.js";
import { device } from "../core/device.js";
import { hud } from "./hud.js";
import { sound } from "../core/sound.js";

const STICK_R = 56;          // bán kính kéo của cần điều khiển (px)
const DEAD = 0.12;           // vùng chết (tỉ lệ bán kính)
const RUN_AT = 0.92;         // đẩy quá chừng ấy bán kính = chạy
const KB_MIN = 80;           // bàn phím ảo coi như đang mở khi che quá chừng ấy px
const SHORT_H = 420;         // khung cao ≤ chừng ấy px (CSS) → giao diện màn thấp kể cả khi không cảm ứng
const BUTTONS = [            // [id, biểu tượng, khoá chữ (aria-label)]
  ["chat", "💬", "touch.chat"], ["emote", "👋", "touch.emote"], ["help", "?", "touch.help"],
  ["app", "📱", "touch.app"], ["menu", "☰", "touch.menu"], ["full", "⛶", "touch.fullscreen"],
];

export class TouchControls {
  // actions: { interact, chat, emote, help, app, menu } — main.js (cùng việc với phím); emotes / chat: bảng đang có (hoặc null)
  constructor({ game, input, ui, actions, emotes = null, chat = null }) {
    Object.assign(this, { game, input, ui, actions, emotes, chat });
    this.stickAt = null;       // { id, x, y } tâm cần điều khiển đang giữ
    this.shownKey = "";
    this.lang = null;
    this.build();
    // nhận biết: điện thoại / ?touch=1 → bật ngay; laptop có màn cảm ứng → bật khi chạm lần đầu, bấm phím (không phải lúc đang
    // gõ chữ) thì tắt lại — chơi bàn phím như thường
    if (device.phone) device.setTouch(true);
    else if (device.touchCapable) {
      addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") device.setTouch(true); }, { capture: true, passive: true });
      addEventListener("keydown", (e) => {
        if (!device.touch || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || /^(Shift|Control|Alt|Meta)/.test(e.code)) return;
        device.setTouch(false);
      }, { capture: true });
    }
    device.onChange((on) => { this.onTouch(on); this.layout(); });
    if (device.touch) this.onTouch(true);
    addEventListener("resize", () => this.layout());
    this.layout();
    // thoát toàn màn hình (vuốt từ mép, nút Back) → nút ⛶ nhấp nháy 1 lần cho người chơi biết bấm lại ở đâu
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement || !device.touch) return;
      const b = this.el.querySelector("[data-a=full]");
      b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
    });
    // chạm nhanh trên khung vẽ: hội thoại đang chờ "nói tiếp" → sang câu
    input.onTap = () => { if (device.touch && this.ui.dialogue.waiting?.kind === "next") this.ui.dialogue.next(); };
    // bàn phím ảo
    const vv = window.visualViewport;
    this.kb = 0;
    if (vv) {
      const onVV = () => { this.keyboard(vv); this.layout(); };
      vv.addEventListener("resize", onVV);
      vv.addEventListener("scroll", onVV);
      addEventListener("focusin", () => setTimeout(onVV, 250));
    }
    // giữ ngón: không mở menu chuột phải / chọn chữ; iOS: không phóng to bằng 2 ngón
    addEventListener("contextmenu", (e) => { if (device.touch && !(e.target instanceof HTMLInputElement)) e.preventDefault(); });
    for (const ev of ["gesturestart", "gesturechange"]) addEventListener(ev, (e) => { if (device.touch) e.preventDefault(); }, { passive: false });
  }

  build() {
    const el = document.createElement("div");
    el.id = "touch";
    el.innerHTML = `<div class="stick-zone"><div class="stick"><i></i></div></div>
      <button type="button" class="act" hidden><span></span></button>
      <div class="pad">${BUTTONS.map(([id, icon]) => `<button type="button" class="round" data-a="${id}" hidden>${icon}</button>`).join("")}</div>
      <div class="pool-note" hidden><p></p><button type="button" class="primary" data-a="leave"></button></div>`;
    document.body.appendChild(el);
    const rot = document.createElement("div");
    rot.id = "rotate";
    rot.innerHTML = `<div class="icon">📱</div><p></p>`;
    document.body.appendChild(rot);
    this.el = el;
    this.rotEl = rot;
    this.zone = el.querySelector(".stick-zone");
    this.stick = el.querySelector(".stick");
    this.knob = el.querySelector(".stick i");
    this.actBtn = el.querySelector(".act");
    this.poolEl = el.querySelector(".pool-note");
    // nút: chạm (click — trình duyệt cảm ứng gửi click sau khi nhấc ngón) — không để lọt xuống khung vẽ
    el.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) e.stopPropagation(); });
    this.actBtn.addEventListener("click", () => { sound.play("tap"); this.actions.interact(); });
    el.querySelector(".pad").addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (!a) return;
      if (a === "full") this.fullscreen();
      else this.actions[a]?.();
    });
    el.querySelector("[data-a=leave]").addEventListener("click", () => this.leavePool());
    // cần điều khiển
    this.zone.addEventListener("pointerdown", (e) => {
      if (this.stickAt || this.game.mode !== "play") return;
      e.preventDefault();
      try { this.zone.setPointerCapture(e.pointerId); } catch { /* chạm giả lập / con trỏ đã nhả: ngón tay vẫn bị "bắt ngầm" vào vùng */ }
      const r = this.zone.getBoundingClientRect();
      // tâm: chỗ chạm, chừa đủ chỗ cho cả vòng cần điều khiển trong vùng
      const x = Math.min(Math.max(e.clientX, r.left + STICK_R + 8), r.right - STICK_R - 8);
      const y = Math.min(Math.max(e.clientY, r.top + STICK_R + 8), r.bottom - STICK_R - 8);
      this.stickAt = { id: e.pointerId, x, y };
      this.stick.classList.add("on");
      this.stick.style.left = `${x - r.left}px`;
      this.stick.style.top = `${y - r.top}px`;
      this.stickMove(e);
    });
    this.zone.addEventListener("pointermove", (e) => { if (this.stickAt?.id === e.pointerId) this.stickMove(e); });
    const release = (e) => { if (this.stickAt?.id === e.pointerId) this.stickRelease(); };
    this.zone.addEventListener("pointerup", release);
    this.zone.addEventListener("pointercancel", release);
    this.retext();
  }

  // kéo cần điều khiển: (dx, dy) so với tâm → { x: phải, y: tới, run } cho input.stick
  stickMove(e) {
    const s = this.stickAt;
    let dx = e.clientX - s.x, dy = e.clientY - s.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, len / STICK_R);
    if (m < DEAD) { this.input.stick = null; return; }
    const run = m >= RUN_AT;
    const k = run ? 1 / Math.max(m, 1e-6) : 1;                 // chạy: hướng đầy đủ (tốc độ chạy); đi: tốc độ theo độ đẩy
    this.input.stick = { x: (dx / STICK_R) * k, y: (-dy / STICK_R) * k, run };
  }
  stickRelease() {
    this.stickAt = null;
    this.input.stick = null;
    this.knob.style.transform = "";
    this.stick.classList.remove("on");
    this.stick.style.left = this.stick.style.top = "";
  }

  // bật / tắt giao diện cảm ứng (device.setTouch)
  onTouch(on) {
    if (!on) { this.stickRelease(); return; }
    // laptop cảm ứng đang khoá con trỏ (chơi chuột) rồi chạm → nhả khoá: ngón tay cần toạ độ thật
    if (this.input.locked && this.input.fakeLock === null) { this.input._releasing = true; document.exitPointerLock?.(); }
    // dòng hướng dẫn điều khiển: bản cảm ứng (không ghi WASD, E); iOS: một lần nhắc "Thêm vào màn hình chính"
    if (this.game.state.phase === "playing") hud.hint(t(this.game.net?.enabled ? "hud.controls_touch_net" : "hud.controls_touch"), 8);
    if (device.ios && !navigator.standalone && !this.iosTipped) { this.iosTipped = true; setTimeout(() => hud.toast(t("touch.ios_tip")), 1500); }
  }

  retext() {
    this.lang = lang;
    for (const [id, , key] of BUTTONS) {
      const b = this.el.querySelector(`[data-a=${id}]`);
      b.setAttribute("aria-label", t(key));
      b.title = t(key);
    }
    this.poolEl.querySelector("p").textContent = t("touch.pool_soon");
    this.poolEl.querySelector("button").textContent = t("touch.pool_leave");
    this.rotEl.querySelector("p").textContent = t("touch.rotate");
    this.shownKey = "";
  }

  // màn thấp + chiều cao vùng nhìn thấy thật (thanh địa chỉ, bàn phím ảo không tính)
  layout() {
    const h = Math.round(window.visualViewport?.height || innerHeight);
    if (h !== this.vvh) { this.vvh = h; document.body.style.setProperty("--vvh", `${h}px`); }
    document.body.classList.toggle("short", device.touch || innerHeight <= SHORT_H);
  }

  // toàn màn hình (Android Chrome…; iOS Safari không có Fullscreen API → hướng dẫn "Thêm vào màn hình chính").
  // auto: gọi từ nút Start / Continue của màn tiêu đề — chỉ khi giao diện cảm ứng đang bật, không hiện thông báo khi lỗi
  fullscreen({ auto = false } = {}) {
    if (auto && (!device.touch || device.ios || !document.fullscreenEnabled || document.fullscreenElement)) return;
    if (device.ios || !document.fullscreenEnabled) { hud.toast(t("touch.ios_home")); return; }
    if (document.fullscreenElement) { document.exitFullscreen?.().catch(() => {}); return; }
    const p = document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    p?.then(() => screen.orientation?.lock?.("landscape").catch(() => {}))
      .catch(() => { if (!auto) hud.toast(t("touch.fullscreen_failed")); });
  }

  leavePool() {
    const p = this.game.pool;
    if (!p?.active) return;
    if (p.challenge) this.ui.minigame.close(false);            // thử thách của anh Khang: đóng khung mini-game
    else p.leave();
  }

  // bàn phím ảo: phần bị che (px) → --kb; ô đang gõ cuộn vào giữa phần còn thấy
  keyboard(vv) {
    const kb = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    if (kb === this.kb) return;
    this.kb = kb;
    document.body.style.setProperty("--kb", `${kb}px`);
    document.body.classList.toggle("kb-open", kb > KB_MIN);
    const a = document.activeElement;
    if (kb > KB_MIN && (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement)) a.scrollIntoView({ block: "center", inline: "nearest" });
  }

  // mỗi khung: hiện / ẩn theo chế độ chơi (chỉ đụng DOM khi khác lần trước)
  update() {
    if (this.lang !== lang) this.retext();
    const g = this.game, on = device.touch;
    const playing = on && g.state.phase === "playing" && !g.cutscene && !g.preview && !g.timeSkipping;
    const free = playing && g.mode === "play";
    if (!free && (this.stickAt || this.input.stick)) this.stickRelease();
    const act = free ? g.interaction?.current && hud.promptText : null;
    const pool = playing && !!g.pool?.active;
    const vis = {
      chat: free && !!this.chat?.available, emote: free && !!this.emotes && !!g.net?.connected, help: free,
      app: free && g.progress.hasReward("app_my_fpt"), menu: free, full: free && (device.ios || !!document.fullscreenEnabled),
    };
    const key = `${on}|${free}|${act}|${pool}|${Object.values(vis).map(Number).join("")}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.el.classList.toggle("free", free);
    this.actBtn.hidden = !act;
    if (act) this.actBtn.querySelector("span").textContent = act;
    for (const [id, v] of Object.entries(vis)) this.el.querySelector(`[data-a=${id}]`).hidden = !v;
    this.poolEl.hidden = !pool;
    document.body.classList.toggle("touch-pool", pool);   // ẩn dòng hướng dẫn phím của bàn bi-a (chuột / A, D / Space)
  }

  // __game.touch: trạng thái + tâm các nút (toạ độ màn hình) — smoke test chạm đúng chỗ
  info() {
    const c = (el) => { if (!el || el.hidden || !el.offsetParent) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; };
    const z = this.zone.getBoundingClientRect();
    return {
      on: device.touch, phone: device.phone, ios: device.ios, stick: this.input.stick, kb: this.kb,
      zone: { x: Math.round(z.left + z.width * 0.35), y: Math.round(z.top + z.height * 0.6), w: Math.round(z.width), h: Math.round(z.height) },
      act: this.actBtn.hidden ? null : { ...c(this.actBtn), text: this.actBtn.textContent },
      buttons: Object.fromEntries(BUTTONS.map(([id]) => [id, c(this.el.querySelector(`[data-a=${id}]`))]).filter(([, v]) => v)),
      pool: this.poolEl.hidden ? null : { text: this.poolEl.querySelector("p").textContent, leave: c(this.poolEl.querySelector("button")) },
    };
  }
}
