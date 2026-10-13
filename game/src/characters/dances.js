// Dance variants include the playable character mesh; load only the clips on demand.
// Dispose the unused preview model / images after parsing, cache clips per rig.
import { loadGLTF, url } from "../core/assets.js";
import { t } from "../i18n.js";
import { hud } from "../ui/hud.js";

const packs = new Map();
export async function loadDanceClips(ch) {
  const path = ch.model.dance_glb;
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

export class DanceController {
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
      await loadDanceClips(ch);
      if (serial !== this.serial || g.player?.character !== ch || g.state.zone !== zone || g.mode !== "play") return false;
      if (!ch.actions[item.anim]) throw new Error(`Missing dance clip: ${item.anim}`);
      this.loading = false;
      this.pendingCharacter = null;
      if (g.net) g.net.myEmote = null;
      const done = ch.playOnce(item.anim);
      const action = ch.current;
      this.active = { id, ch, action, zone, serial };
      // The combined clip needs a server that advertises the new allowlist / stop message.
      if (g.net?.connected && g.net.features.includes("dance_sequence") && g.net.cooldown <= 0) {
        g.net.cooldown = g.net.cfg.cooldown_s ?? 1.5;
        g.net.client.send({ t: "emote", id });
        this.active.sent = true;
      }
      done.then(() => {
        if (this.active?.serial === serial && ch.current === action) this.stop();
      });
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
    if (active && active.ch.current === active.action) active.ch.enableLocomotion();
  }
  update() {
    const g = this.g;
    if (!this.active && !this.loading) return;
    if (g.mode !== "play" || g.state.phase !== "playing" || g.player?.speed > 0.15 ||
        this.active && (g.player?.character !== this.active.ch || g.state.zone !== this.active.zone || this.active.ch.current !== this.active.action) ||
        this.loading && g.player?.character !== this.pendingCharacter) this.stop();
  }
}
