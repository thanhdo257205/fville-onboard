// Điều phối game: tải zone, đặt người chơi tại SPAWN_, nhân vật theo vai (data/characters.json roles),
// trigger chuyển zone có màn mờ (điều kiện từ quests.json), mức đồ hoạ (tự chọn / menu / tự hạ khi FPS < 40),
// tương tác (interactables.json) → hội thoại (dialogues.json) / mini-game / nhặt vật; hiệu ứng → tiến trình (lưu trình duyệt).
import * as THREE from "three";
import { loadZone, disposeZone, inTrigger, worldPos, applySceneFixes, prefetchZone, pendingPrefetch } from "../world/zone.js";
import { buildCollider } from "../world/collision.js";
import { createLights, DETAIL_LEVELS } from "../render/renderer.js";
import { SeeThrough } from "../render/seethrough.js";
import { ThirdPersonCamera } from "../player/camera.js";
import { TalkCamera } from "../player/talkcam.js";
import { Player } from "../player/player.js";
import { Npc } from "../characters/npc.js";
import { Follower } from "../characters/follower.js";
import { FpsMonitor, detectTier, saveSettings, DETAIL_FPS } from "../core/quality.js";
import { hud } from "../ui/hud.js";
import { t } from "../i18n.js";
import { tx } from "../content/content.js";
import { url, preloadDecoders } from "../core/assets.js";
import { save } from "./state.js";
import { Interaction } from "./interaction.js";
import { DialogueRunner } from "../ui/dialogue.js";
import { Cutscene } from "./cutscene.js";
import { Guide } from "./guide.js";
import { setTint } from "../characters/characters.js";
import { sound } from "../core/sound.js";

export class Game {
  constructor({ renderer, data, characters, input, settings, nametags, content, progress, ui }) {
    Object.assign(this, { renderer, data, characters, input, settings, nametags, content, progress, ui });
    ui.hudQueue = () => hud.queue;
    this.mode = "play";      // play | dialogue | minigame | app | menu | cutscene
    this.cutscene = null;    // cảnh chuyển đang chạy (data/cutscenes.json)
    this.cameraOverride = null;   // mini-game chụp ảnh đặt camera riêng
    this.outfitOverride = null;   // vd đang chụp check-in: mặc thử Áo Cam FPT
    this.zoneTime = 0;            // giây đã chơi trong zone hiện tại (sự kiện theo giờ, vd Tú kêu mất balo)
    this.interaction = new Interaction(this, content);
    this.runner = new DialogueRunner({ content, state: progress, ui: ui.dialogue, hooks: {
      speakerInfo: (role) => this.speakerInfo(role),
      effects: (e) => this.applyEffects(e),
      minigame: (id) => this.runMinigame(id),
      line: (n) => this.onLine(n),
    } });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9cc4e8);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
    this.cam = new ThirdPersonCamera(this.camera);
    this.talkCam = new TalkCamera(this.camera);   // camera qua vai khi nói chuyện với NPC / Tú
    this.talkPartner = null;                     // Npc | Follower đang nói chuyện (runDialogue)
    this.lights = createLights(this.scene);
    this.seeThrough = new SeeThrough(data.sceneFixes?.see_through);   // cây che người chơi → mờ dần
    this.guide = new Guide(this, content);       // dấu "!" + mũi tên chỉ đường, nhắc khi đứng yên, gợi ý phím H
    this.zone = null;
    this.npcs = [];          // Npc (đứng/ngồi tại node)
    this.follower = null;    // Tú
    this.player = null;
    this.state = { zone: null, phase: "boot", tier: "low", tierSource: "auto" };   // trạng thái máy (tiến trình chơi: this.progress)
    this.gpu = renderer.gpuName();
    this.detected = detectTier(this.gpu);
    this.fps = 0;
    this.monitor = new FpsMonitor({ onLow: (fps) => this.autoLow(fps) });
    // đã ở mức Thấp mà FPS vẫn < DETAIL_FPS → hạ độ nét từng nấc (menu Esc → Detail = Auto)
    this.detailMonitor = new FpsMonitor({ threshold: DETAIL_FPS, onLow: (fps) => this.autoDetail(fps) });
    this.state.detailLevel = 0;              // nấc Auto đã tự hạ tới (chỉ trong phiên chơi này)
    this.applyDetail();
    const tags = characters.tagConfig();
    nametags.maxDistance = tags.max_distance_m ?? 12;
    nametags.occlusion = tags.hide_when_occluded !== false;
    nametags.above = tags.above_head_m ?? 0.28;
    this.resolveTier();
  }

  resolveTier() {
    const s = this.settings.tier;
    this.state.tierSource = s === "auto" ? (this.state.autoLowered ? "auto-lowered" : "auto") : "manual";
    this.state.tier = s === "auto" ? (this.state.autoLowered ? "low" : this.detected.tier) : s;
  }

  async start(zoneId = this.data.zones.order[0]) {
    this.player = new Player(await this.characters.create("player", this.state.tier));
    this.scene.add(this.player.character.root);
    this.updateOutfit();
    await this.enterZone(zoneId, this.data.zones.zones[zoneId].start, { fade: false });
    this.setMode("play");
  }

  zoneCfg(id) { return this.data.zones.zones[id]; }

  // tải trước trong lúc người chơi điền tên (main.js): GLB zone đầu (bộ nhớ đệm HTTP), GLB nhân vật, bộ giải nén
  preload(zoneId) {
    return Promise.allSettled([preloadDecoders(), prefetchZone(this.zoneCfg(zoneId).file, this.state.tier),
      this.characters.preload(this.state.tier)]);
  }

  // zone kế tiếp theo thứ tự chơi: tải sẵn GLB khi đang chơi zone này (bản build không còn tải mọi zone lúc mở game)
  prefetchNext(zoneId) {
    const order = this.data.zones.order, next = order[order.indexOf(zoneId) + 1];
    if (next && this.zoneCfg(next)) prefetchZone(this.zoneCfg(next).file, this.state.tier);
  }

  // silent: tải sau màn tối của cảnh chuyển — không hiện màn chờ, thẻ tên zone, hội thoại vào zone
  async enterZone(zoneId, spawnName, { fade = true, keepPose = null, file = null, silent = false } = {}) {
    this.state.phase = "transition";
    // đang hội thoại / mini-game / mở app thì đóng lại trước khi rời zone
    if (this.runner.active) this.runner.abort();
    if (this.ui.minigame.open) this.ui.minigame.close(false);
    if (this.ui.app.open) this.ui.app.hide();
    this.talkCam.reset();
    if (fade) await hud.fade(true);
    if (!silent) hud.loading(t("app.loading_zone", { zone: t(`zones.${zoneId}.title`) }));
    await pendingPrefetch(file ?? this.zoneCfg(zoneId).file, this.state.tier);
    const zone = await loadZone(zoneId, file ?? this.zoneCfg(zoneId).file, this.state.tier, this.data.collision?.[zoneId]);
    applySceneFixes(zone, this.data.sceneFixes?.[zoneId]);   // vd hạ ghế zone_05 (không sửa GLB)
    this.seeThrough.setup(zone, this.data.sceneFixes?.[zoneId]?.see_through);   // trước lần vẽ đầu (vá shader)
    // lưới bối cảnh có BVH (camera hội thoại xét góc nào thấy mặt người đối thoại): mesh hiển thị trừ COL_ và cây (cây tự mờ)
    const plantRe = new RegExp(this.seeThrough.cfg.meshes), blockers = [];
    zone.root.traverse((o) => { if (o.isMesh && o.visible && !o.name.startsWith("COL_") && !plantRe.test(o.name) && !plantRe.test(o.parent?.name || "")) blockers.push(o); });
    zone.view = buildCollider(blockers);
    // dọn zone cũ
    if (this.zone) { this.scene.remove(this.zone.root, this.zone.collider); disposeZone(this.zone); }
    for (const n of this.npcs) n.character.dispose();
    this.follower?.character.dispose();
    this.npcs = [];
    this.follower = null;
    this.nametags.clear();
    this.zone = zone;
    this.scene.add(zone.root, zone.collider);
    this.lights.setLightmapMode(zone.hasLightmap);
    this.applyMood(this.zoneCfg(zoneId)?.mood);
    this.state.zone = zoneId;
    // người chơi: đổi model nếu mức đồ hoạ đổi (Thấp = bản 6k, Cao = 15k)
    if (this.player.character.tier !== this.state.tier) {
      this.player.setCharacter(await this.characters.create("player", this.state.tier));
      this.scene.add(this.player.character.root);
      this.updateOutfit();
    }
    const spawn = zone.spawns.get(spawnName) ?? zone.spawns.get(this.zoneCfg(zoneId)?.start ?? "");
    if (!spawn && !keepPose) throw new Error(`${zoneId}: thiếu ${spawnName}`);
    const yaw = keepPose ? 0 : spawn.userData.yaw_deg ?? 0;
    this.player.spawn(keepPose ? keepPose.pos : worldPos(spawn), yaw);
    if (keepPose) this.player.character.root.rotation.y = keepPose.rot;
    if (!keepPose) {
      this.cam.behind(yaw);
      // sau lưng bị che (vd xe bus ở zone_01) → xoay sang hướng thoáng; tán cây không tính (tự mờ khi che), để camera
      // vẫn nhìn theo hướng SPAWN_ (zone_00: về phía các xe bus, không quay ngược ra cuối phố)
      const plants = new Set(this.seeThrough.meshes || []);
      this.cam.pickStartYaw(this.player.position, zone, (o) => plants.has(o.name) || plants.has(o.parent?.name));
    } else this.cam.occluders = null;
    this.cam.update(0, this.player.position, { dx: 0, dy: 0, wheel: 0 }, zone.collider, true);
    await this.spawnActors();
    this.interaction.setup(zone, this.scene);
    this.guide.reset();
    this.progress.zone = zoneId;
    this.zoneTime = 0;
    this.firedEvents = new Set();
    this.updateObjective();
    this.persist();
    // trigger đang chứa người chơi lúc xuất hiện: chỉ kích hoạt sau khi đã bước ra
    for (const tr of zone.triggers) tr.inside = inTrigger(tr, this.player.position.clone().setY(this.player.position.y + 0.9));
    this.cam.update(0, this.player.position, { dx: 0, dy: 0, wheel: 0 }, zone.collider, true);
    // biên dịch shader + đưa texture lên GPU khi màn chờ / màn tối còn che (không giật ở khung đầu tiên)
    const tw = performance.now();
    await this.renderer.warmup(this.scene, this.camera);
    this.state.warmupMs = Math.round(performance.now() - tw);
    this.monitor.reset();
    this.detailMonitor.reset();
    hud.loading(null);
    if (!silent) hud.zoneCard(zoneId);
    if (fade) await hud.fade(false);
    this.state.phase = "playing";
    if (!silent) setTimeout(() => this.runOnEnter(zoneId), 600);
    setTimeout(() => this.prefetchNext(zoneId), 2000);
  }

  // trang phục người chơi (characters.json roles.player.outfit): áo sơ mi thường tới khi nhận Áo Cam FPT ở cổng
  updateOutfit() {
    const o = this.characters.role("player")?.outfit;
    if (!o || !this.player) return;
    const wearing = this.outfitOverride === o.until_reward || this.progress.hasReward(o.until_reward);
    setTint(this.player.character, wearing ? null : o.tint);
  }

  // sự kiện theo giờ trong zone (zones.json → events): vd zone_01, 20 giây sau khi xuống xe Tú kêu mất balo
  checkZoneEvents(dt) {
    const evs = this.zoneCfg(this.state.zone)?.events;
    if (!evs) return;
    this.zoneTime += dt;
    if (this.mode !== "play") return;
    for (const [i, ev] of evs.entries()) {
      if (this.firedEvents.has(i) || this.zoneTime < ev.after_s || !this.progress.check(ev.if)) continue;
      this.firedEvents.add(i);
      if (ev.dialogue) this.runDialogue(ev.dialogue, { actor: ev.actor || null });
      return;
    }
  }

  // ánh sáng / trời / sương riêng của zone (zones.json → mood), vd zone_00 sáng sớm có sương mỏng
  applyMood(mood) {
    const sky = new THREE.Color(mood?.sky ?? 0x9cc4e8);
    this.scene.background.copy(sky);
    this.scene.fog = mood?.fog ? new THREE.Fog(sky, mood.fog[0], mood.fog[1]) : null;
    this.lights.setMood(mood);
  }

  // hội thoại tự chạy khi vào zone lần đầu (zones.json → on_enter), vd tin nhắn HR ở zone_00
  runOnEnter(zoneId) {
    const oe = this.zoneCfg(zoneId)?.on_enter;
    if (!oe || this.state.zone !== zoneId || this.mode !== "play" || this.state.phase !== "playing") return;
    if (oe.once_flag && this.progress.flags.has(oe.once_flag)) return;
    if (oe.once_flag) this.progress.flags.add(oe.once_flag);
    this.runDialogue(oe.dialogue);
  }

  // cảnh chuyển (trigger có "cutscene"): khoá điều khiển, camera theo kịch bản; xong thì chơi tiếp ở zone đích
  async playCutscene(id) {
    const cfg = this.content.cutscenes[id];
    if (!cfg || this.cutscene) return;
    this.setMode("cutscene");
    this.cutscene = new Cutscene(this, id, cfg);
    this.lastCutscene = this.cutscene;
    try { await this.cutscene.run(); } catch (e) { console.error("[cảnh chuyển]", e); } finally { this.cutscene = null; this.setMode("play"); }
  }

  // đặt nhân vật theo vai: node → đứng/ngồi tại node; near_node → cạnh node; follow_player → Tú
  async spawnActors() {
    const tier = this.state.tier;
    this.state.missingNpcRoles = [];
    this.followerWait = null;
    for (const [role, r] of this.characters.roles()) {
      if (r.hide_if && this.progress.check(r.hide_if)) continue;   // vd hành khách đã lên xe
      if (r.place === "node" || r.place === "near_node") {
        const nodeName = [].concat(r.node || []).find((n) => this.zone.nodes.has(n));   // node có thể là danh sách (theo zone)
        const node = nodeName && this.zone.nodes.get(nodeName);
        if (!node) continue;                             // vai không có trong zone này
        const pos = worldPos(node);
        let yaw = node.userData.yaw_deg ?? 0;
        if (r.place === "near_node") { pos.add(new THREE.Vector3(...(r.offset || [1, 0, 0]))); yaw = r.yaw_deg ?? 0; }
        const npc = new Npc(await this.characters.create(role, tier), { role, node: nodeName, pos, yaw, pose: r.pose, nodeMarks: r.node_marks,
          chairHeight: r.chair_height_m != null ? r.chair_height_m - (this.zone.chairDrop || 0) : null });
        npc.start();
        this.scene.add(npc.character.root);
        this.nametags.add(npc.character.root, this.characters.displayName(role), npc.character.model.height_m);
        this.npcs.push(npc);
      } else if (r.place === "follow_player") {
        this.follower = new Follower(await this.characters.create(role, tier));
        this.scene.add(this.follower.character.root);
        this.nametags.add(this.follower.character.root, this.characters.displayName(role), this.follower.character.model.height_m);
        // chờ ở một chỗ tới khi đạt điều kiện (zone_00: Tú xem điện thoại ở mái chờ tới khi người chơi bắt chuyện)
        const w = r.wait?.[this.state.zone];
        const anchor = w && this.zone.nodes.get(w.near_node);
        if (anchor && !this.progress.check(w.until)) {
          this.follower.wait({ pos: worldPos(anchor).add(new THREE.Vector3(...(w.offset || [0, 0, 0]))),
            yaw: THREE.MathUtils.degToRad(w.yaw_deg ?? 0) + Math.PI, anim: w.anim || "idle" });
          this.followerWait = w.until;
        }
      }
    }
    // Tú xuất hiện chếch sau người chơi, sau khi đã có NPC (không đặt lồng vào NPC) và hướng camera (không chắn tầm nhìn)
    if (this.follower && !this.follower.waiting) {
      this.follower.placeNear(this.player, { view: this.camera.position, obstacles: this.npcs.map((n) => n.capsule()).filter(Boolean),
        collider: this.zone.collider, occluders: this.cam.occluders });
    }
    // NPC_ trong GLB mà không vai nào trỏ tới → báo để sửa characters.json
    this.state.missingNpcRoles = this.zone.npcs.map((n) => n.name).filter((n) => !this.characters.roleOfNode(n));
  }

  npc(nodeOrRole) { return this.npcs.find((n) => n.node === nodeOrRole || n.role === nodeOrRole); }

  // đổi mức đồ hoạ: tải lại zone hiện tại, giữ nguyên vị trí người chơi
  async setTier(setting) {
    this.settings.tier = setting;
    saveSettings(this.settings);
    if (setting !== "auto") this.state.autoLowered = false;
    const before = this.state.tier;
    this.resolveTier();
    if (this.state.tier !== before && this.zone) await this.reloadZone();
  }

  async reloadZone() {
    const keep = { pos: this.player.position.clone(), rot: this.player.character.root.rotation.y };
    await this.enterZone(this.state.zone, null, { fade: true, keepPose: keep, file: this.zone.file });
  }

  // độ nét: settings.detail = "auto" (tự hạ khi FPS thấp) | "sharper" (luôn đủ nét) | "faster" (luôn nhẹ nhất)
  detailLevel() {
    const s = this.settings.detail ?? "auto";
    return s === "sharper" ? 0 : s === "faster" ? DETAIL_LEVELS.length - 1 : this.state.detailLevel;
  }

  applyDetail() { this.renderer.setDetail(this.detailLevel()); }

  setDetail(setting) {
    this.settings.detail = setting;
    saveSettings(this.settings);
    this.applyDetail();
    this.detailMonitor.reset();
  }

  autoDetail(fps) {
    this.state.lastDetailFps = fps;
    if ((this.settings.detail ?? "auto") !== "auto" || this.state.tier !== "low") return;
    let lv = this.state.detailLevel;
    do lv++; while (lv < DETAIL_LEVELS.length - 1 && !this.renderer.detailDiffers(lv));   // bỏ nấc không đổi gì
    if (lv >= DETAIL_LEVELS.length) return;
    this.state.detailLevel = lv;
    this.applyDetail();
    hud.toast(t("hud.detail_lowered"), 4);
    if (lv < DETAIL_LEVELS.length - 1) this.detailMonitor.reset();   // đo lại với nấc mới
  }

  async autoLow(fps) {
    this.state.lastAutoFps = fps;
    if (this.state.tierSource !== "auto" || this.state.tier !== "high") return;
    this.state.autoLowered = true;
    this.resolveTier();
    hud.toast(t("hud.tier_auto_low"), 4);
    await this.reloadZone();
  }

  triggerCfg(name) {
    return this.data.quests.triggers.find((x) => x.zone === this.state.zone && x.node === name);
  }

  checkTriggers() {
    if (this.triggersOff) return;           // __game.collisionScan tắt tạm
    const p = this.player.position.clone().setY(this.player.position.y + 0.9);
    for (const tr of this.zone.triggers) {
      const inside = inTrigger(tr, p);
      if (inside && !tr.inside) this.onTrigger(tr.name);
      tr.inside = inside;
    }
  }

  onTrigger(name) {
    const cfg = this.triggerCfg(name);
    this.state.lastTrigger = name;
    if (!cfg) return;
    const missing = this.progress.missingFor(cfg.requires);
    if (missing.length) {
      const list = missing.map((q) => tx(this.content.questById.get(q)?.title)).join(", ");
      if (cfg.blocked_dialogue) this.runDialogue(cfg.blocked_dialogue, { vars: { missing: list } });
      else hud.toast(t(cfg.blocked || "hud.zone_locked"));
      return;
    }
    if (cfg.cutscene) { this.playCutscene(cfg.cutscene); return; }
    if (cfg.blocked || !cfg.to_zone) { hud.toast(t(cfg.blocked || "hud.zone_locked")); return; }
    this.enterZone(cfg.to_zone, cfg.to_spawn);
  }

  // vai có "board" (characters.json): khi có cờ on_flag thì đi tới to_node rồi khuất, bật done_flag (vd hành khách lên xe)
  checkBoarding() {
    for (const n of this.npcs) {
      const b = this.characters.role(n.role)?.board;
      if (!b || n.boarding || n.hidden || !this.progress.flags.has(b.on_flag) || this.mode !== "play") continue;
      const to = this.zone.nodes.get(b.to_node);
      if (!to) continue;
      n.boarding = true;
      n.walkTo(worldPos(to).setY(n.character.root.position.y), { speed: 1.1, done: () => { n.setHidden(true); this.applyEffects({ flags: [b.done_flag] }); } });
    }
  }

  // ---------- tiến trình, tương tác, hội thoại ----------
  applyEffects(e) {
    const events = this.progress.apply(e);
    hud.notify(events);
    if (e?.reward) this.updateOutfit();
    this.interaction.refresh();
    this.updateObjective();
    this.persist();
    return events;
  }

  updateObjective() {
    const q = this.progress.currentQuest(this.state.zone);
    hud.objective(q ? tx(q.title) : t("hud.objective_done_zone"));
  }

  persist() {
    clearTimeout(this._save);
    this._save = setTimeout(() => {
      if (!save.store(this.progress) && !this._saveWarned) { this._saveWarned = true; hud.toast(t("hud.save_failed")); }
    }, 300);
  }

  speakerInfo(role) {
    if (role === "narrator") return { name: "", portrait: null };
    const portrait = this.characters.portrait(role);
    const name = role === "player" ? this.progress.player.name : this.characters.displayName(role);
    return { name, portrait: portrait ? url(portrait) : null };
  }

  setMode(m) {
    this.mode = m;
    this.input.enabled = m === "play";
    this.input.setLook(m === "play");   // chơi: khoá + ẩn con trỏ, chuột xoay camera; còn lại: hiện con trỏ để bấm
    if (m !== "play") { hud.prompt(null); this.guide.hideMarks(); }   // dấu "!" / mũi tên chỉ hiện lúc đang đi lại
    hud.cover(m === "dialogue" || m === "minigame" || m === "app");   // ẩn dòng hướng dẫn điều khiển
  }

  // phím E
  interact() {
    if (this.mode !== "play" || this.state.phase !== "playing") return null;
    const e = this.interaction.current;
    if (!e) return null;
    const [kind, id] = e.item.action.split(":");
    if (kind === "dialogue") return this.runDialogue(id, { npc: this.interaction.npcFor(e), actor: e.item.actor });
    if (kind === "minigame") return this.runMinigame(id);
    if (kind === "pickup") { sound.play("pickup"); return this.applyEffects({ item: id, flags: [`has_${id}`] }); }
    if (kind === "grain") { sound.play("grain"); return this.applyEffects({ grain: id }); }
    return null;
  }

  async runDialogue(id, { npc = null, actor = null, vars = {} } = {}) {
    if (this.mode === "dialogue") return;
    this.setMode("dialogue");
    const p = this.player;
    p.velocity.set(0, 0, 0);
    const speakers = new Set(Object.values(this.content.dialogues.get(id).nodes).map((n) => n.speaker));
    const tu = this.follower && (actor === "tu" || speakers.has("tu")) ? this.follower : null;
    this.talkPartner = npc || tu;
    const face = npc?.character.root.position ?? tu?.position;
    if (face) this.faceTarget = face.clone();
    if (tu) tu.speak(null);
    try {
      if (npc) await npc.engage(p.position.clone());
      const cast = {   // ai đang nói thì người đó diễn
        speak: (anim, speaker) => (speaker === "tu" ? tu?.speak(anim) : npc?.speak(anim)),
        listen: () => { npc?.listen(); tu?.listen(); },
      };
      await this.runner.run(id, { npc: npc || tu ? cast : null, vars });
    } finally {
      this.talkPartner = null;
      this.talkCam.release();
      this.faceTarget = null;
      if (npc) npc.release();
      if (tu) tu.endTalk();
      this.setMode("play");
    }
  }

  // câu của người đối thoại / người chơi → camera qua vai (tới hết hội thoại); lời dẫn (narrator) và tin nhắn điện thoại
  // không đổi camera (vd tin nhắn Ms. Nga đầu game, đọc biển xe)
  onLine(n) {
    const partner = this.talkPartner;
    if (!partner || this.mode !== "dialogue" || n.speaker === "narrator" || n.style === "phone") return;
    const obstacles = this.npcs.filter((x) => x !== partner).map((x) => x.capsule());
    if (this.follower && this.follower !== partner) obstacles.push(this.follower.capsule());
    this.talkCam.engage(partner, { player: this.player, env: this.talkEnv(), obstacles: obstacles.filter(Boolean) });
  }

  // vật cản cho camera hội thoại: COL_, lưới mesh hiển thị, tán cây / chậu cây (seeThrough)
  talkEnv() { return { collider: this.zone.collider, view: this.zone.view, see: this.seeThrough }; }

  async runMinigame(id) {
    const prev = this.mode;
    // mở từ hội thoại (vd Tú nói luật, Ms. Nga đưa phiếu): thôi quay mặt về người đối thoại trong lúc chơi
    // (trò chụp ảnh tự đặt hướng người chơi nhìn camera)
    const face = this.faceTarget;
    this.faceTarget = null;
    this.setMode("minigame");
    const r = await this.ui.minigame.run(id);   // { ok, skipped, effects } — Skip: không cộng Hiểu biết lượt đó
    if (this.mode === "minigame" && prev === "dialogue") this.faceTarget = face;
    this.lastMinigame = { id, ...r };
    if (r.ok) this.applyEffects(r.effects);
    this.setMode(prev === "dialogue" ? "dialogue" : "play");
    return r.ok;
  }

  // phím H: gợi ý của mục tiêu hiện tại (đang đi lại: thẻ gợi ý; app My FPT đang mở: ô Help trong app)
  help() {
    if (this.state.phase !== "playing") return;
    if (this.mode === "app") { this.ui.app.toggleHelp(); return; }
    if (this.mode === "play") this.guide.help();
  }

  toggleApp() {
    if (this.ui.app.open) { this.ui.app.hide(); this.setMode("play"); return; }
    if (this.mode !== "play") return;
    if (!this.progress.hasReward("app_my_fpt")) { hud.toast(t("hud.no_app")); return; }
    this.setMode("app");
    this.ui.app.show();
  }

  update(dt) {
    if (this.cutscene) { this.input.consumeDrag(); this.guide.update(dt, { cutscene: true }); if (!this.debugHold?.(this.cutscene)) { this.cutscene.update(dt); this.seeThrough.update(dt, null); } return; }   // debugHold: __game.holdCutscene (chụp ảnh từng nhịp)
    if (this.state.phase !== "playing") return;
    const drag = this.input.consumeDrag();
    const still = { x: 0, y: 0, run: false };
    // Tú hết chờ (vd vừa bắt chuyện ở mái chờ) → đi theo người chơi
    if (this.followerWait && this.follower?.waiting && this.progress.check(this.followerWait)) { this.follower.stopWaiting(); this.followerWait = null; }
    this.checkBoarding();
    this.checkZoneEvents(dt);
    this.interaction.animate(dt);
    // capsule nhân vật: người chơi không xuyên NPC / Tú; Tú tránh NPC + người chơi
    const npcCaps = this.npcs.map((n) => n.capsule()).filter(Boolean);
    const tuCap = this.follower?.capsule();
    this.player.update(dt, this.mode === "play" ? this.input.move() : still, this.cam, this.zone.collider, tuCap ? [...npcCaps, tuCap] : npcCaps);
    if (this.faceTarget) {
      const p = this.player.position;
      this.player.character.faceDir(new THREE.Vector3(this.faceTarget.x - p.x, 0, this.faceTarget.z - p.z), dt, 6);
    }
    for (const n of this.npcs) n.update(dt);
    this.follower?.update(dt, this.player, this.zone.collider, { view: this.camera.position, obstacles: [...npcCaps, this.player.capsule()] });
    if (this.cameraOverride) { this.cameraOverride(dt); this.talkCam.overridden(); }
    else {
      this.cam.update(dt, this.player.position, this.mode === "play" ? drag : { dx: 0, dy: 0, wheel: 0 }, this.zone.collider);
      this.talkCam.apply(dt, this.cam.target, { player: this.player, env: this.talkEnv() });
    }
    // cây che: lúc nói chuyện thì xét đường nhìn tới người đối thoại
    this.seeThrough.update(dt, this.camera.position, this.talkCam.active ? this.talkCam.partner.character.root.position : this.player.position);
    if (this.mode === "play") {
      this.checkTriggers();
      hud.prompt(this.interaction.update(this.player.position));
    }
    this.guide.update(dt);
    this.monitor.tick(dt);
    this.detailMonitor.tick(dt);
  }

  render(dt) {
    this.renderer.render(this.scene, this.camera);
    this.nametags.render(this.scene, this.camera, this.zone?.collider, dt);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.nametags.setSize(w, h);
  }
}
