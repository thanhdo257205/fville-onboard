// Video trên màn hình TV (data/scene_fixes.json → videos + <zone>.screens). Mặt TV trong GLB chỉ là một mặt màu dính chung lưới
// với khung (không UV riêng) → đặt một tấm phẳng mỏng sát trước mặt TV, phát video lên đó (không sửa GLB). Mỗi video một
// <video> cho cả zone (mọi TV cùng phát một bản), tắt tiếng + lặp (trình duyệt chỉ cho tự phát khi tắt tiếng), chỉ tải khi
// vào zone có TV; đứng xa mọi TV quá play_m (hoặc tab ẩn) thì dừng giải mã. Tấm phẳng ẩn tới khi video có khung đầu → trước
// đó vẫn thấy mặt TV cũ. Dọn: disposeZone → stopScreens (video thả file, texture dọn theo disposeTree).
//   screens: [{ video, center: [x, y, z] (glTF), size: [rộng, cao], yaw_deg (0 = mặt nhìn +Z), fit: "contain" | "fill" }]
import * as THREE from "three";
import { url } from "../core/fetch.js";

const NO_OUTLINE = { visible: false };
const LIFT_M = 0.006;      // tấm phẳng nhô trước mặt TV chừng này (tránh z-fighting)

export function placeScreens(zone, list = [], videos = {}) {
  zone.screens = [];
  if (!list.length) return [];
  const byId = new Map();
  for (const [i, s] of list.entries()) {
    const v = videos[s.video];
    if (!v?.src?.length) { console.warn(`[tv] scene_fixes.${zone.id}.screens[${i}]: không có video "${s.video}"`); continue; }
    let entry = byId.get(s.video);
    if (!entry) {
      const el = document.createElement("video");
      Object.assign(el, { muted: true, loop: true, playsInline: true, preload: "auto", crossOrigin: "anonymous" });
      el.setAttribute("muted", ""); el.setAttribute("playsinline", "");
      // chọn định dạng trình duyệt phát được (WebM VP9 / MP4 H.264 — Chromium không có H.264, Safari cũ không có VP9)
      const pick = v.src.find((p) => el.canPlayType(p.endsWith(".webm") ? 'video/webm; codecs="vp9"' : 'video/mp4; codecs="avc1.4d401e"')) || v.src[0];
      el.src = url(pick);
      const tex = new THREE.VideoTexture(el);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      mat.userData.outlineParameters = NO_OUTLINE;
      entry = { id: s.video, el, tex, mat, src: pick, meshes: [], ready: false, playing: false, play_m: v.play_m ?? 18, aspect: v.aspect ?? 16 / 9 };
      el.addEventListener("loadeddata", () => { entry.ready = true; for (const m of entry.meshes) m.visible = true; });
      el.addEventListener("error", () => console.warn(`[tv] không tải được ${pick}`));
      byId.set(s.video, entry);
      zone.screens.push(entry);
    }
    // contain: giữ tỉ lệ video trong khung TV (dải đen là mặt TV cũ phía sau); fill: kéo kín khung
    let [w, h] = s.size;
    if (s.fit !== "fill") { if (w / h > entry.aspect) w = h * entry.aspect; else h = w / entry.aspect; }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), entry.mat);
    const yaw = THREE.MathUtils.degToRad(s.yaw_deg ?? 0);
    mesh.position.set(...s.center).add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(LIFT_M));
    mesh.rotation.y = yaw;
    mesh.name = `TV_${s.video}_${i}`;
    mesh.userData.dynamic = true;
    mesh.visible = false;
    zone.root.add(mesh);
    entry.meshes.push(mesh);
  }
  return zone.screens;
}

// mỗi khung: gần TV nào (camera trong play_m, tab đang hiện) → phát, không thì dừng
export function updateScreens(zone, eye) {
  for (const e of zone?.screens || []) {
    const near = !document.hidden && e.meshes.some((m) => m.position.distanceTo(eye) < e.play_m);
    if (near && !e.playing) { e.playing = true; e.el.play().catch(() => { e.playing = false; e.blocked = true; }); }
    else if (!near && e.playing) { e.playing = false; e.el.pause(); }
  }
}

export function stopScreens(zone) {
  for (const e of zone?.screens || []) {
    e.el.pause();
    e.el.removeAttribute("src");
    e.el.load();                // thả file / bộ giải mã
    e.tex.dispose();
  }
  if (zone) zone.screens = [];
}

// __game.screens: trạng thái từng video (smoke kiểm tra)
export function screensInfo(zone) {
  return (zone?.screens || []).map((e) => ({ id: e.id, src: e.src, ready: e.ready, playing: e.playing && !e.el.paused, time: +e.el.currentTime.toFixed(2),
    blocked: !!e.blocked, size: [e.el.videoWidth, e.el.videoHeight], screens: e.meshes.map((m) => ({ name: m.name, visible: m.visible, at: m.position.toArray().map((v) => +v.toFixed(3)) })) }));
}
