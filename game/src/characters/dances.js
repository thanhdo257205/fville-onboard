// Dance variants include the playable character mesh; load only the clips on demand.
// Dispose the unused preview model / images after parsing, cache clips per rig.
import { loadGLTF, url } from "../core/assets.js";
import { t } from "../i18n.js";
import { hud } from "../ui/hud.js";
import * as THREE from "three";

const packs = new Map();
export async function loadDanceClips(ch, anim = null) {
  const path = ch.model.dance_glbs?.[anim] ?? ch.model.dance_glb;
  if (!path) return false;
  if (!packs.has(path)) {
    packs.set(path, loadGLTF(url(path)).then(gltf => {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      gltf.scene.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        for (const m of [o.material].flat().filter(Boolean)) {
          materials.add(m);
          for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
        }
        o.skeleton?.dispose();
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const texture of textures) { texture.dispose(); texture.image?.close?.(); }
      return gltf.animations;
    }).catch(error => { packs.delete(path); throw error; }));
  }
  const clips = await packs.get(path);
  for (const clip of clips) if (!ch.actions[clip.name]) ch.actions[clip.name] = ch.mixer.clipAction(clip);
  return true;
}

// Keep the capsule's starting point, but carry the visual trajectory across loops.
// Both local and remote rigs use this playback, including late-join time seeking.
export function startDancePlayback(ch, anim, elapsed = 0) {
  stopDancePlayback(ch);
  if (!ch.danceMotion) {
    ch.danceMotion = new THREE.Group();
    ch.danceMotion.name = "dance_motion";
    ch.root.add(ch.danceMotion);
    ch.danceMotion.add(ch.mixer.getRoot());
  }
  const action = ch._play(anim, { loop: true, fade: .2 });
  if (!action) return null;
  ch.root.updateMatrixWorld(true);
  const track = action.getClip().tracks.find(t => t.name === `${ch.hips?.name}.position`);
  const delta = new THREE.Vector3();
  if (track) {
    const matrix = ch.root.matrixWorld.clone().invert().multiply(ch.hips.parent.matrixWorld);
    const first = new THREE.Vector3().fromArray(track.values, 0).applyMatrix4(matrix);
    delta.fromArray(track.values, track.values.length - 3).applyMatrix4(matrix).sub(first).setY(0);
  }
  const playback = ch.dancePlayback = { action, delta, elapsed: 0 };
  playback.loop = e => { if (e.action === action) ch.danceMotion.position.addScaledVector(delta, e.loopDelta); };
  ch.mixer.addEventListener("loop", playback.loop);
  ch.root.traverse(o => { if (o.isSkinnedMesh) { o.userData.danceCull = o.frustumCulled; o.frustumCulled = false; } });
  seekDancePlayback(ch, elapsed);
  return action;
}

export function seekDancePlayback(ch, elapsed) {
  const p = ch.dancePlayback;
  if (!p) return;
  const duration = p.action.getClip().duration;
  p.elapsed = Math.max(0, elapsed);
  p.action.time = p.elapsed % duration;
  ch.danceMotion.position.copy(p.delta).multiplyScalar(Math.floor(p.elapsed / duration));
  ch.mixer.update(0);
}

export function stopDancePlayback(ch) {
  const p = ch.dancePlayback;
  if (!p) return;
  ch.mixer.removeEventListener("loop", p.loop);
  ch.dancePlayback = null;
  ch.danceMotion.position.set(0, 0, 0);
  ch.root.traverse(o => { if (o.isSkinnedMesh) { o.frustumCulled = o.userData.danceCull; delete o.userData.danceCull; } });
  if (ch.current === p.action) ch.enableLocomotion();
}

export function dancePosition(ch) {
  if (!ch.dancePlayback || !ch.hips) return ch.root.position;
  ch.root.updateMatrixWorld(true);
  return ch.hips.getWorldPosition(new THREE.Vector3()).setY(ch.root.position.y);
}

export class DanceController {
  get position() { return this.active ? dancePosition(this.active.ch) : null; }
  constructor(game, cfg) {
    this.g = game;
    this.items = cfg?.dances || [];
    this.serial = 0;
    this.active = null;
    this.loading = false;
  }
  async play(id) {
    const item = this.items.find(d => d.id === id), g = this.g, ch = g.player?.character;
    if (!item || !ch || g.player.seated || g.mode !== "play" || g.state.phase !== "playing") return false;
    this.stop();
    const serial = ++this.serial, zone = g.state.zone;
    this.loading = true;
    this.pendingCharacter = ch;
    hud.toast(t("actions.loading"));
    try {
      await loadDanceClips(ch, item.anim);
      if (serial !== this.serial || g.player?.character !== ch || g.state.zone !== zone || g.mode !== "play") return false;
      if (!ch.actions[item.anim]) throw new Error(`Missing dance clip: ${item.anim}`);
      this.loading = false;
      this.pendingCharacter = null;
      if (g.net) g.net.myEmote = null;
      const action = startDancePlayback(ch, item.anim);
      this.active = { id, ch, action, zone, serial, origin: g.player.position.clone() };
      g.player.dancing = true;
      g.player.velocity.set(0, 0, 0); g.player.speed = 0;
      // The combined clip needs a server that advertises the new allowlist / stop message.
      if (g.net?.connected && g.net.features.includes("dance_sequence")) {
        g.net.client.send({ t: "emote", id });
        this.active.sent = true;
      }
      return true;
    } catch (error) {
      if (serial === this.serial) {
        this.loading = false;
        this.pendingCharacter = null;
        hud.toast(t("actions.load_error"));
        console.warn("[dance]", error.message);
      }
      return false;
    } finally {
      if (serial === this.serial) { this.loading = false; this.pendingCharacter = null; }
    }
  }
  stop() {
    const active = this.active;
    this.serial++;
    this.active = null;
    this.loading = false;
    this.pendingCharacter = null;
    if (active?.sent && this.g.net?.connected && this.g.net.features.includes("dance_sequence")) {
      this.g.net.client.send({ t: "emote_stop", id: active.id });
    }
    if (active) {
      stopDancePlayback(active.ch);
      if (this.g.player?.character === active.ch) {
        this.g.player.dancing = false;
        if (this.g.state.zone === active.zone) this.g.player.body.teleport(active.origin);
        this.g.player.sync();
      }
    }
  }
  update() {
    const g = this.g;
    if (!this.active && !this.loading) return;
    if (g.state.phase !== "playing" ||
        this.active && (g.player?.character !== this.active.ch || g.state.zone !== this.active.zone || this.active.ch.current !== this.active.action) ||
        this.loading && g.player?.character !== this.pendingCharacter) this.stop();
  }
}
