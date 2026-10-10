// Màn tạo nhân vật: chọn nhân vật + tên + vị trí intern → Promise<{ name, gender, look, position }>.
// Chọn nhân vật (data/characters.json → character_creation.looks, giới tính suy ra từ roles.player.looks):
//   - cảnh 3D nhỏ: các nhân vật đứng thành hàng trên bục, mặc bộ dau_ngay, phát idle; nhân vật đang chọn bước lên trước,
//     vẫy tay, có vòng sáng dưới chân; người khác lùi nhẹ, tối hơn. Đổi: bấm vào nhân vật, phím ←/→ (khi canvas / nút mũi
//     tên đang được chọn), nút mũi tên. Kéo chuột / vuốt: xoay nhân vật đang chọn 360°. GLB tải song song ngay khi mở màn
//     (cùng bộ nhớ đệm với game → vào game không tải lại). Bắt đầu chơi → dừng vòng vẽ, giải phóng renderer riêng của màn.
//   - màn hẹp (< NARROW_PX) hoặc Detail = Faster, hoặc WebGL / GLB lỗi: 3 thẻ chân dung (radio) thay cảnh 3D.
//   Thẻ thông tin: chân dung, tên gọi ngắn, 1 dòng mô tả, nút "Preview FPT shirt" (xem trước bộ ao_cam = texture trong GLB).
// window.__creator: trạng thái cho smoke test (chế độ, nhân vật đang chọn, toạ độ trên màn hình của từng nhân vật).
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { loadGLTF, url } from "../core/assets.js";
import { Character } from "../characters/characters.js";
import { tx } from "../content/content.js";
import { t } from "../i18n.js";

export const NARROW_PX = 700;
const SPACING = 0.82;          // m giữa 2 nhân vật trên bục
const STEP_FWD = 0.38, STEP_BACK = -0.12, PODIUM_Y = 0.16;
const DIM = 0.62;              // độ sáng người không được chọn

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function characterCreator(cfg, { characters, settings = {}, initial = null } = {}) {
  const looks = (cfg.looks || []).filter((l) => characters.lookGender(l.id) && characters.model(l.id)?.glb);
  const portraitOf = (id, shirt) => {
    const m = characters.model(id);
    return url((!shirt && m.outfit_portraits?.dau_ngay) || m.portrait);
  };
  let sel = Math.max(0, looks.findIndex((l) => l.id === initial));
  let shirt = false;
  const max = cfg.name_max ?? 16;
  const el = document.createElement("div");
  el.id = "creator";
  el.innerHTML = `<form class="panel" novalidate>
    <h2>${t("creator.title")}</h2>
    <div class="look-row">
      <div class="stage" hidden>
        <canvas tabindex="0" aria-label="${esc(t("creator.look_stage"))}"></canvas>
        <button type="button" class="arrow prev" aria-label="${esc(t("creator.look_prev"))}">‹</button>
        <button type="button" class="arrow next" aria-label="${esc(t("creator.look_next"))}">›</button>
        <p class="stage-msg">${t("creator.look_loading")}</p>
        <p class="hint" aria-hidden="true">${t("creator.look_hint")}</p>
      </div>
      <fieldset class="cards" hidden><legend>${t("creator.look")}</legend>
        ${looks.map((l, i) => `<label class="card"><input type="radio" name="look" value="${l.id}" ${i === sel ? "checked" : ""}>
          <span><img alt="" src="${portraitOf(l.id, false)}"><b>${esc(tx(l.name))}</b></span></label>`).join("")}
      </fieldset>
      <aside class="info">
        <img class="portrait" alt="">
        <div><h3 class="look-name"></h3><p class="look-desc"></p>
        <button type="button" class="ghost shirt" aria-pressed="false">${t("creator.preview_shirt")}</button></div>
      </aside>
      <p class="sr" aria-live="polite"></p>
    </div>
    <label class="name">${t("creator.name")}<input name="name" maxlength="${max}" autocomplete="off" placeholder="${t("creator.name_placeholder")}"></label>
    <fieldset class="positions"><legend>${t("creator.position")}</legend>
      ${cfg.positions.map((p, i) => `<label class="pos"><input type="radio" name="position" value="${p.id}" ${i === 0 ? "checked" : ""}><span>${tx(p.name)}</span></label>`).join("")}
    </fieldset>
    <p class="err" aria-live="polite"></p>
    <button class="primary" type="submit">${t("creator.start")}</button></form>`;
  document.body.appendChild(el);
  const form = el.querySelector("form");
  const input = form.elements.name;
  const stageEl = el.querySelector(".stage"), cardsEl = el.querySelector(".cards"), msg = el.querySelector(".stage-msg");
  const info = { img: el.querySelector(".info .portrait"), name: el.querySelector(".look-name"), desc: el.querySelector(".look-desc"),
    shirt: el.querySelector(".shirt"), live: el.querySelector(".sr") };
  const dbg = window.__creator = { mode: null, ready: false, disposed: false, looks: looks.map((l) => l.id),
    get selected() { return looks[sel]?.id; }, get shirt() { return shirt; }, screen: () => null };

  let stage = null;
  const showInfo = (announce) => {
    const l = looks[sel];
    if (!l) return;
    info.img.src = portraitOf(l.id, shirt);
    info.name.textContent = tx(l.name);
    info.desc.textContent = tx(l.desc);
    for (const r of form.querySelectorAll("input[name=look]")) r.checked = r.value === l.id;
    for (const img of cardsEl.querySelectorAll("img")) img.src = portraitOf(img.closest("label").querySelector("input").value, shirt);
    if (announce) info.live.textContent = t("creator.look_selected", { name: tx(l.name), n: sel + 1, total: looks.length });
  };
  const select = (i, { announce = true } = {}) => {
    sel = (i + looks.length) % looks.length;
    stage?.select(sel);
    showInfo(announce);
  };
  const useCards = (why) => {
    stage?.dispose();
    stage = null;
    stageEl.hidden = true;
    cardsEl.hidden = false;
    dbg.mode = "cards";
    if (why) info.live.textContent = t("creator.look_failed");
  };

  // ---------- chế độ ----------
  const narrow = window.innerWidth < NARROW_PX || (settings.detail ?? "auto") === "faster";
  if (narrow || !looks.length) useCards();
  else {
    stageEl.hidden = false;
    dbg.mode = "3d";
    try {
      stage = makeStage(stageEl.querySelector("canvas"), looks.map((l) => characters.model(l.id)), sel, (i) => select(i));
      dbg.screen = (i) => stage?.screen(i) ?? null;
      stage.ready.then(() => { msg.hidden = true; dbg.ready = true; }, (e) => { console.warn("[màn tạo nhân vật] cảnh 3D lỗi — dùng thẻ ảnh", e); useCards(true); });
    } catch (e) { console.warn("[màn tạo nhân vật] không tạo được WebGL — dùng thẻ ảnh", e); useCards(true); }
  }
  showInfo(false);

  // ---------- điều khiển ----------
  el.querySelector(".prev").addEventListener("click", () => select(sel - 1));
  el.querySelector(".next").addEventListener("click", () => select(sel + 1));
  stageEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); select(sel + (e.key === "ArrowLeft" ? -1 : 1)); }
  });
  cardsEl.addEventListener("change", (e) => { const i = looks.findIndex((l) => l.id === e.target.value); if (i >= 0) select(i); });
  info.shirt.addEventListener("click", () => {
    shirt = !shirt;
    info.shirt.setAttribute("aria-pressed", String(shirt));
    stage?.setShirt(shirt);
    showInfo(false);
  });
  setTimeout(() => input.focus(), 50);
  const bad = (name) => {
    const words = name.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u);
    return (cfg.blocked_words || []).some((w) => words.includes(w.toLowerCase()));
  };
  return new Promise((resolve) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, " ").slice(0, max);
      const err = form.querySelector(".err");
      if (!name) { err.textContent = t("creator.name_empty"); input.focus(); return; }
      if (bad(name)) { err.textContent = t("creator.name_bad"); input.focus(); return; }
      const look = looks[sel]?.id ?? null;
      stage?.dispose();
      stage = null;
      dbg.disposed = true;
      el.remove();
      resolve({ name, look, gender: look ? characters.lookGender(look) : null, position: form.elements.position.value });
    });
    el.addEventListener("keydown", (e) => e.stopPropagation());   // gõ tên / phím mũi tên không điều khiển nhân vật trong game
  });
}

// ---------- cảnh 3D: bục + nhân vật, renderer riêng (giải phóng khi xong) ----------
function makeStage(canvas, models, initial, onPick) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0035, defaultColor: [0.06, 0.06, 0.07] });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 1.3, 6.2);
  camera.lookAt(0, 0.92, 0);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.7);
  sun.position.set(-2, 4, 5);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x5d6575, 1.25), sun);
  const own = [];                // geometry / chất liệu của riêng màn này (GLB nhân vật dùng chung bộ nhớ đệm với game)
  const keep = (x) => { own.push(x); return x; };
  const podium = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.75, 1.88, PODIUM_Y, 48)), keep(new THREE.MeshToonMaterial({ color: 0x3a4152 })));
  podium.position.y = PODIUM_Y / 2;
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(1.76, 0.018, 6, 64)), keep(new THREE.MeshBasicMaterial({ color: 0xf37021 })));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = PODIUM_Y;
  rim.userData.outlineParameters = { visible: false };
  const glowMat = keep(new THREE.MeshBasicMaterial({ color: 0xffa25c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  const glow = new THREE.Mesh(keep(new THREE.RingGeometry(0.26, 0.4, 48)), glowMat);
  const discMat = keep(new THREE.MeshBasicMaterial({ color: 0xf37021, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  const disc = new THREE.Mesh(keep(new THREE.CircleGeometry(0.26, 48)), discMat);
  for (const m of [glow, disc]) { m.rotation.x = -Math.PI / 2; m.position.y = PODIUM_Y + 0.004; m.userData.outlineParameters = { visible: false }; m.renderOrder = 1; }
  scene.add(podium, rim, glow, disc);
  const hitGeo = keep(new THREE.CylinderGeometry(0.33, 0.33, 1.8, 12)), hitMat = keep(new THREE.MeshBasicMaterial({ visible: false }));

  const slots = models.map((m, i) => ({ model: m, x: (i - (models.length - 1) / 2) * SPACING, z: 0, yaw: 0, dim: 1, ch: null, mats: [], hit: null }));
  let sel = initial, shirt = false, token = 0, raf = 0, disposed = false, last = performance.now(), pulse = 0;

  const ready = Promise.all(slots.map(async (s, i) => {
    const gltf = await loadGLTF(url(s.model.glb.low ?? s.model.glb.high), { cached: true });
    if (disposed) return;
    const ch = new Character(SkeletonUtils.clone(gltf.scene), gltf.animations, s.model, "creator");
    await ch.loadOutfits();
    if (disposed) { ch.dispose(); return; }
    ch.setOutfit(shirt ? null : "dau_ngay");
    ch.root.traverse((o) => { if (o.isMesh) s.mats.push({ m: o.material, base: o.material.color.clone() }); });
    s.hit = new THREE.Mesh(hitGeo, hitMat);
    s.hit.position.y = 0.9;
    s.hit.userData.slot = i;
    ch.root.add(s.hit);
    ch.root.position.set(s.x, PODIUM_Y, s.z);
    ch.play("idle", { fade: 0, randomStart: true });
    s.ch = ch;
    scene.add(ch.root);
    if (i === sel) wave(s);
  }));

  function wave(s) {
    const my = ++token;
    if (!s.ch) return;
    s.ch.playOnce("wave").then(() => { if (my === token && s.ch && !disposed) s.ch.play("idle", { fade: 0.4 }); });
  }
  function select(i) {
    if (i === sel) return;
    const old = slots[sel];
    sel = i;
    if (old?.ch && old.ch.current?.getClip().name !== "idle") old.ch.play("idle", { fade: 0.3 });
    wave(slots[sel]);
  }

  // ---------- kéo xoay / bấm chọn ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, last: e.clientX, drag: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!down) return;
    if (!down.drag && Math.abs(e.clientX - down.x) > 5) down.drag = true;
    if (down.drag) { slots[sel].yaw += (e.clientX - down.last) * 0.012; down.last = e.clientX; }
  });
  canvas.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || d.drag) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(slots.map((s) => s.hit).filter(Boolean), false)[0];
    if (hit) onPick(hit.object.userData.slot);
  });
  canvas.addEventListener("pointercancel", () => { down = null; });

  // ---------- kích thước, vòng vẽ ----------
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.25 ? 30 : 26;     // khung hẹp: lùi tầm nhìn cho đủ 3 người
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  fit();
  const ease = (a, b, dt, k) => a + (b - a) * Math.min(1, k * dt);
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pulse += dt;
    slots.forEach((s, i) => {
      if (!s.ch) return;
      const on = i === sel;
      s.z = ease(s.z, on ? STEP_FWD : STEP_BACK, dt, 6);
      s.dim = ease(s.dim, on ? 1 : DIM, dt, 6);
      if (!on) s.yaw = ease(s.yaw, Math.round(s.yaw / (2 * Math.PI)) * 2 * Math.PI, dt, 4);   // quay về nhìn ra trước
      s.ch.root.position.z = s.z;
      s.ch.root.rotation.y = s.yaw;
      for (const { m, base } of s.mats) m.color.copy(base).multiplyScalar(s.dim);
      s.ch.update(dt);
    });
    const s = slots[sel];
    glow.position.x = disc.position.x = s.x;
    glow.position.z = disc.position.z = s.z;
    glowMat.opacity = 0.6 + 0.25 * Math.sin(pulse * 3);
    outline.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    ready,
    select,
    setShirt(on) { shirt = on; for (const s of slots) s.ch?.setOutfit(on ? null : "dau_ngay"); },
    // toạ độ trên trang (px) của giữa người nhân vật i — smoke test bấm chọn
    screen(i) {
      const s = slots[i];
      if (!s?.ch) return null;
      const p = new THREE.Vector3(s.x, PODIUM_Y + 0.95, s.z).project(camera), r = canvas.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const s of slots) {
        if (!s.ch) continue;
        s.ch.dispose();
        for (const { m } of s.mats) m.dispose();      // chất liệu toon riêng của bản sao (texture GLB dùng chung: giữ)
      }
      for (const x of own) x.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
