// Chụp ảnh: check-in trước biển chữ FPT SOFTWARE (zone 2) và ảnh thẻ ở quầy lễ tân (zone 3).
// Chọn tư thế / biểu cảm (= animation của nhân vật), camera riêng (Game.cameraOverride), chụp thẳng từ canvas WebGL
// → cắt theo tỉ lệ khung → JPEG nén, hạ chất lượng tới khi ≤ max_kb → lưu vào tiến trình (effects.photo), app hiện ảnh.
// Check-in: Tú đứng cạnh nếu đang đi theo; người chơi mặc Áo Cam FPT ngay khi vào chụp (nhận chính thức khi giữ ảnh).
import * as THREE from "three";
import { tx } from "../content/content.js";
import { t } from "../i18n.js";
import { sound } from "../core/sound.js";
import { worldPos } from "../world/zone.js";

const UP = new THREE.Vector3(0, 1, 0);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const kbd = (k) => `<kbd>${k}</kbd>`;

// chụp khung hình hiện tại: cắt giữa theo tỉ lệ aspect, thu về size, JPEG ≤ maxKb
export function captureCanvas(game, { aspect = [4, 3], size = [480, 360], maxKb = 60 } = {}) {
  game.cameraOverride?.(0);
  game.render(0);
  const src = game.renderer.canvas, W = src.width, H = src.height;
  let cw = W, ch = (W * aspect[1]) / aspect[0];
  if (ch > H) { ch = H; cw = (H * aspect[0]) / aspect[1]; }
  const out = document.createElement("canvas");
  out.width = size[0]; out.height = size[1];
  out.getContext("2d").drawImage(src, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, size[0], size[1]);
  let q = 0.85, data = out.toDataURL("image/jpeg", q);
  while (data.length * 0.75 > maxKb * 1024 && q > 0.35) { q -= 0.08; data = out.toDataURL("image/jpeg", q); }
  return { data, kb: Math.round((data.length * 0.75) / 1024), quality: +q.toFixed(2) };
}

export const photo = {
  start(ctx, kind) {
    const g = ctx.game, d = ctx.data, p = g.player, z = g.zone, cam = g.camera;
    const poses = d.poses;
    let pose = 0, shot = null;
    // chỗ đứng + hướng từ người chơi ra camera (ngang)
    const stand = p.position.clone();
    let dir;
    if (kind === "checkin") {
      const sign = worldPos(z.nodes.get(d.anchor));
      stand.x = sign.x + (d.stand_offset_x ?? -0.5);                   // đứng giữa biển chữ (Tú bên cạnh)
      dir = stand.clone().sub(sign).setY(0).normalize();
    } else {
      // ảnh thẻ: quay lưng về phía quầy (NPC gần nhất, vd lễ tân) → camera đặt bên khoảng trống, không bị đầu NPC che
      const near = g.npcs.filter((n) => !n.hidden).map((n) => n.character.root.position)
        .sort((a, b) => a.distanceTo(stand) - b.distanceTo(stand))[0];
      if (near && near.distanceTo(stand) < 4) dir = stand.clone().sub(near).setY(0).normalize();
      else { const y = p.character.root.rotation.y; dir = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)); }
    }
    p.body.teleport(stand.clone().add(new THREE.Vector3(0, 0.02, 0)));
    p.velocity.set(0, 0, 0);
    p.sync();
    const faceYaw = Math.atan2(dir.x, dir.z);
    p.character.root.rotation.y = faceYaw;
    // camera chụp
    const c = d.camera;
    const camPos = stand.clone().addScaledVector(dir, c.distance).addScaledVector(UP, c.height);
    const look = stand.clone().addScaledVector(UP, c.look_height).addScaledVector(dir, -(c.look_behind ?? 0));
    const fov0 = cam.fov;
    g.cameraOverride = () => {
      cam.position.copy(camPos); cam.lookAt(look);
      if (cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
    };
    // Tú đứng cạnh (check-in), cùng tư thế
    const tu = g.follower;
    const tuJoins = kind === "checkin" && tu && !tu.waiting && tu.character.root.visible;
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    // ai đứng chắn giữa camera và người chơi thì ẩn tạm (trả lại khi xong)
    const hidden = [];
    for (const ch of [...g.npcs.map((n) => n.character), ...(tu && !tuJoins ? [tu.character] : [])]) {
      const q = ch.root.position, seg = camPos.clone().sub(stand).setY(0), len = seg.length();
      const tt = THREE.MathUtils.clamp(q.clone().sub(stand).setY(0).dot(seg) / (len * len), 0, 1.2);
      const off = q.clone().sub(stand).setY(0).addScaledVector(seg, -tt).length();
      if (ch.root.visible && tt > 0.05 && off < 0.7) { ch.root.visible = false; hidden.push(ch); }
    }
    // phông nền xanh nhạt sau đầu (ảnh thẻ)
    let backdrop = null;
    if (kind === "id") {
      backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(d.backdrop || "#bcd7ef") }));
      backdrop.position.copy(stand).addScaledVector(dir, -0.5).addScaledVector(UP, 1.45);
      backdrop.lookAt(camPos);
      backdrop.userData.outlineParameters = { visible: false };
      g.scene.add(backdrop);
    }
    // áo cam: mặc ngay khi vào chụp check-in
    if (kind === "checkin") { g.outfitOverride = d.wear; g.updateOutfit?.(); }
    document.body.classList.add("photo-mode");

    const setPose = (k) => {
      pose = k;
      p.character.pose(poses[k]);
      if (tuJoins) tu.wait({ pos: stand.clone().addScaledVector(side, d.tu_side ?? 0.95), yaw: faceYaw, anim: poses[k] });
      if (tuJoins) tu.character.pose(poses[k]);
      sound.play("tap");
      draw();
    };
    const take = () => {
      if (shot) return;
      sound.play("shutter");
      shot = captureCanvas(g, { aspect: d.aspect, size: d.size, maxKb: d.max_kb });
      const flash = document.createElement("div");
      flash.className = "flash";
      document.body.appendChild(flash);
      ctx.later(() => flash.remove(), 500);
      draw();
    };
    const retake = () => { shot = null; sound.play("tap"); draw(); };
    const keep = () => { if (shot) ctx.finish({ photo: { key: kind, data: shot.data } }); };
    const posName = () => tx(g.characters.cfg.character_creation.positions.find((x) => x.id === g.progress.player.position)?.name);
    const draw = () => {
      if (!shot) {
        ctx.body.innerHTML = `<div class="photo-bar"><div class="poses">${poses.map((a, k) =>
          `<button class="${k === pose ? "on" : ""}" data-k="${k}">${kbd(k + 1)} ${esc(tx(d.pose_names[a]))}</button>`).join("")}</div>
          <button class="primary shoot">📸 ${t("minigame.take_photo")} ${kbd("Space")}</button></div>`;
        ctx.body.querySelectorAll(".poses button").forEach((b) => b.addEventListener("click", () => setPose(+b.dataset.k)));
        ctx.body.querySelector(".shoot").addEventListener("click", take);
        ctx.hint(tuJoins ? tx(d.tu_hint) : "");
      } else {
        const card = kind === "id"
          ? `<div class="id-card"><div class="top">FPT Software</div><img src="${shot.data}" alt=""><b>${esc(g.progress.player.name)}</b><span>${esc(posName())} · Intern</span></div>`
          : `<div class="polaroid"><img src="${shot.data}" alt=""><span>${esc(tx(d.caption, ctx.vars))}</span></div>`;
        ctx.body.innerHTML = `<div class="photo-preview">${card}<div class="act"><button class="primary keep">${t("minigame.keep")} ${kbd("Enter")}</button>
          <button class="ghost retake">${t("minigame.retake")} ${kbd("R")}</button><small>${shot.kb} KB</small></div></div>`;
        ctx.body.querySelector(".keep").addEventListener("click", keep);
        ctx.body.querySelector(".retake").addEventListener("click", retake);
        ctx.hint("");
      }
    };
    setPose(0);
    ctx.onKey = (e) => {
      const n = /^(Digit|Numpad)[1-3]$/.test(e.code) ? +e.code.slice(-1) - 1 : -1;
      if (!shot && n >= 0 && n < poses.length) { setPose(n); return true; }
      if (!shot && (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter")) { take(); return true; }
      if (shot && (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")) { keep(); return true; }
      if (shot && e.code === "KeyR") { retake(); return true; }
      return false;
    };
    ctx.debug = {
      solve: (k = 1) => { setPose(k); take(); keep(); },
      pose: (k) => setPose(k),
      take, keep, retake,
      state: () => ({ pose: poses[pose], kb: shot?.kb ?? null, quality: shot?.quality ?? null, tuJoins }),
    };
    // dọn dẹp: trả camera, tư thế, Tú, phông, áo
    return () => {
      g.cameraOverride = null;
      cam.fov = fov0; cam.updateProjectionMatrix();
      p.character.enableLocomotion();
      if (tuJoins) tu.stopWaiting();
      for (const ch of hidden) ch.root.visible = true;
      if (backdrop) { g.scene.remove(backdrop); backdrop.geometry.dispose(); backdrop.material.dispose(); }
      if (kind === "checkin") { g.outfitOverride = null; g.updateOutfit?.(); }
      document.body.classList.remove("photo-mode");
    };
  },
};
