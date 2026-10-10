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
import { Ending } from "./ending.js";
import { Guide } from "./guide.js";
import { Acts, earnedTitles } from "./acts.js";
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
    this.acts = new Acts(this, content);         // 4 Act (data/acts.json): thẻ tiêu đề Act, checklist theo Act
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

  // spawn: chỗ xuất hiện khác SPAWN_ đầu zone (vd đã xong game → cửa xe bến zone_01, trạng thái cuối của cảnh kết)
  async start(zoneId = this.data.zones.order[0], spawn = null) {
    this.player = new Player(await this.characters.create("player", this.state.tier));
    this.scene.add(this.player.character.root);
    this.updateOutfit();
    await this.enterZone(zoneId, spawn ?? this.data.zones.zones[zoneId].start, { fade: false, zoneCard: false });
    this.acts.start();          // thẻ "ACT n" của Act hiện tại trước, rồi tới thẻ tên zone
    hud.zoneCard(zoneId, this.zoneClock(zoneId));
    this.setMode("play");
  }

  zoneCfg(id) { return this.data.zones.zones[id]; }

  // zones.json → variants: [{ if, mood, time }] — dòng đầu đạt điều kiện (vd zone_05 buổi chiều sau bữa trưa, zone_01
  // hoàng hôn ở cảnh kết): ánh sáng riêng + giờ trên đồng hồ
  zoneVariant(id) { return (this.zoneCfg(id)?.variants || []).find((v) => this.progress.check(v.if)) || null; }
  zoneClock(id) { const v = this.zoneVariant(id); return v?.time ? tx(v.time) : null; }
  applyVariant() {
    const id = this.state.zone;
    this.applyMood(this.zoneVariant(id)?.mood ?? this.zoneCfg(id)?.mood);
    hud.clock(this.zoneClock(id) ?? t(`zones.${id}.time`));
  }

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
  async enterZone(zoneId, spawnName, { fade = true, keepPose = null, file = null, silent = false, zoneCard = true } = {}) {
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
    const leaves = new Set((this.data.sceneFixes?.[zoneId]?.doors || []).flatMap((d) => Object.keys(d.leaves || {})));   // cánh cửa mở được
    zone.root.traverse((o) => { if (o.isMesh && o.visible && !o.name.startsWith("COL_") && !plantRe.test(o.name) && !plantRe.test(o.parent?.name || "") && !leaves.has(o.parent?.name)) blockers.push(o); });
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
    this.applyMood(this.zoneVariant(zoneId)?.mood ?? this.zoneCfg(zoneId)?.mood);
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
    // zones.json → spawn_offset.<SPAWN_>: dời chỗ xuất hiện (toạ độ glTF, m) — vd zone_04: SPAWN_ sát tường cuối hành lang,
    // camera không lùi được ra sau lưng → xuất hiện lùi vào trong 2 m
    const spawnOff = !keepPose && this.zoneCfg(zoneId)?.spawn_offset?.[spawn.name];
    this.player.spawn(keepPose ? keepPose.pos : worldPos(spawn).add(new THREE.Vector3(...(spawnOff || [0, 0, 0]))), yaw);
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
    this.setupDoors();
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
    if (!silent && zoneCard) hud.zoneCard(zoneId, this.zoneClock(zoneId));
    else hud.clock(this.zoneClock(zoneId) ?? t(`zones.${zoneId}.time`));
    if (fade) await hud.fade(false);
    this.state.phase = "playing";
    this.state.readyAt = performance.now();    // __game.step chờ hội thoại on_enter (600 ms) trước khi làm việc đầu tiên
    if (!silent) setTimeout(() => this.runOnEnter(zoneId), 600);
    setTimeout(() => this.prefetchNext(zoneId), 2000);
  }

  // trang phục người chơi (characters.json roles.player.outfit): bộ đồ ngày đầu (texture outfit.texture, vd dau_ngay) tới
  // khi nhận Áo Cam FPT ở cổng → texture trong GLB (áo cam + logo). outfit.tint: cách cũ, đổi màu áo bằng shader.
  // Theo phần thưởng đã lưu → tải lại game vẫn đúng áo.
  updateOutfit() {
    const o = this.characters.role("player")?.outfit;
    if (!o || !this.player) return;
    const wearing = this.outfitOverride === o.until_reward || this.progress.hasReward(o.until_reward);
    if (o.texture) this.player.character.setOutfit(wearing ? null : o.texture);
    if (o.tint) setTint(this.player.character, wearing ? null : o.tint);
  }

  // sự kiện theo giờ trong zone (zones.json → events): vd zone_01, 20 giây sau khi xuống xe Tú kêu mất balo
  checkZoneEvents(dt) {
    this.zoneTime += dt;            // cũng dùng cho việc khác theo giờ trong zone (vd Tú đi hỏi lễ tân rồi quay lại)
    const evs = this.zoneCfg(this.state.zone)?.events;
    if (!evs) return;
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
    if (e?.banner) hud.banner(tx(e.banner));                        // chữ lớn giữa màn hình (vd "First card tap!")
    for (const w of [].concat(e?.walk || [])) this.walkActor(w);     // NPC / Tú đi chỗ khác (rồi khuất)
    // cờ của màn mờ chuyển giờ (vd lunch_done) lưu ngay, trước khi mờ màn hình: tải lại giữa chừng vẫn đúng buổi chiều
    // (cờ chỉ đổi ánh sáng / giờ qua applyVariant, gọi sau khi màn đã tối)
    const events = this.progress.apply(e?.time_skip?.flags ? { ...e, flags: [...[].concat(e.flags || []), ...e.time_skip.flags] } : e);
    hud.notify(events);
    if (e?.reward) this.updateOutfit();
    this.interaction.refresh();
    this.updateObjective();
    this.acts.update();                                             // xong mục cuối của một Act → thẻ Act kế tiếp
    // màn mờ chuyển giờ (vd "12:00 · The team invites you to lunch") và hoàn thành game (sau bàn làm việc zone 5):
    // chạy khi hội thoại đang mở đã đóng
    if (e?.time_skip) this.afterDialogue(() => this.timeSkip(e.time_skip));
    if (e?.finish) this.afterDialogue(() => this.finishGame());
    this.persist();
    return events;
  }

  // việc chờ hội thoại đang mở đóng lại (hiệu ứng time_skip, finish đặt trong lời thoại / kết quả mini-game)
  afterDialogue(fn) {
    if (this.runner.active || this.mode === "dialogue" || this.mode === "minigame") (this._after ||= []).push(fn);
    else fn();
  }
  flushAfterDialogue() {
    const q = this._after || [];
    this._after = [];
    for (const fn of q) fn();
  }

  // màn mờ chuyển giờ (hiệu ứng time_skip: { card, flags }) — vd sau buổi gặp Manager: "12:00 · The team invites you to
  // lunch" rồi sáng lại buổi chiều (zones.json → variants: ánh sáng + giờ theo cờ lunch_done; cờ đã lưu lúc áp hiệu ứng).
  // Đang chạy (timeSkipping): Esc / Tab / E không làm gì (main.js, setMode "cutscene")
  async timeSkip(cfg) {
    if (this.cutscene) return;
    this.setMode("cutscene");
    this.timeSkipping = cfg;
    this.persist(true);                       // cờ của màn mờ (vd lunch_done) đã vào bản lưu trước khi màn tối
    try {
      await hud.fade(true, 700);
      hud.card(tx(cfg.card));
      await new Promise((r) => setTimeout(r, (cfg.seconds ?? 2.6) * 1000));
      this.applyVariant();
      hud.card(null);
      await hud.fade(false, 800);
    } finally {
      this.timeSkipping = null;
      this.setMode("play");
    }
  }

  // hoàn thành game: cờ game_complete + thành tựu cuối (data/achievements.json → final); cảnh kết (data/cutscenes.json →
  // ending: 17:30 Lan ghé bàn → bến xe zone_01 lúc hoàng hôn → Tú chạy tới → lên xe), rồi thẻ "ACHIEVEMENT UNLOCKED" và
  // màn tổng kết (thành tựu đứng đầu, trước các danh hiệu)
  async finishGame({ ending = true } = {}) {
    const a = this.content.achievements?.final;
    if (!a || this.finishing) return;
    this.finishing = true;
    try {
      const flag = `achievement_${a.id}`;
      if (!this.progress.flags.has(flag)) this.applyEffects({ flags: [flag, "game_complete"] });
      this.persist(true);                     // tải lại giữa cảnh kết → main.js mở bến xe + màn tổng kết
      const cfg = this.content.cutscenes?.ending;
      if (ending && cfg && !this.cutscene) await this.playEnding(cfg);
      hud.achievement(tx(a.label), tx(a.title));
      clearTimeout(this._summaryTimer);
      this._summaryTimer = setTimeout(() => this.openSummary(), 3900);
    } finally { this.finishing = false; }
  }

  async playEnding(cfg) {
    this.setMode("cutscene");
    this.cutscene = new Ending(this, "ending", cfg);
    this.lastCutscene = this.cutscene;
    try { await this.cutscene.run(); } catch (e) { console.error("[cảnh kết]", e); } finally { this.cutscene = null; this.setMode("play"); }
  }

  summaryData() {
    const s = this.progress, c = this.content, a = c.achievements?.final;
    const titles = earnedTitles(c, s);
    return {
      achievement: a && s.flags.has(`achievement_${a.id}`) ? { label: tx(a.label), title: tx(a.title), desc: tx(a.desc) } : null,
      title: titles[0] ? { title: tx(titles[0].title), desc: tx(titles[0].desc) } : null,
      subtitles: titles.slice(1).map((x) => ({ title: tx(x.title), desc: tx(x.desc) })),
      name: s.player.name, stats: { ...s.stats }, grains: s.grains.size, grainsTotal: c.grainsTotal ?? 10,
      values: c.values.map((v) => ({ name: tx(v.name), lit: s.valueLit(v.id), hint: tx(v.hint) })), photo: s.photos.checkin || null,
      idPhoto: s.photos.id || null,
      position: tx(this.characters.cfg.character_creation?.positions?.find((x) => x.id === s.player.position)?.name) || "",
      badges: s.rewards.map((id) => c.rewards.get(id)).filter((r) => String(r?.type).startsWith("badge")).map((r) => ({ icon: r.icon, name: tx(r.name) })),
      // lời nhắn của Prajith theo xu hướng ở La bàn nghề nghiệp (minigames.career_compass → messages)
      note: s.compass ? tx(c.minigames.career_compass?.messages?.[s.compass.trait], { player: s.player.name }) || null : null,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),   // chữ trong game: tiếng Anh
      acts: this.acts.status().map((x) => ({ number: x.act.number, title: tx(x.act.title), done: x.done, total: x.total })),
    };
  }

  // màn tổng kết; lần đầu mở sau khi xong game → cờ summary_seen (chưa có cờ này mà đã game_complete, vd tải lại giữa cảnh
  // kết → main.js gọi resumeSummary). Xem lại bất cứ lúc nào sau khi xong game: menu Esc / app My FPT → View summary
  openSummary() {
    if (this.mode === "dialogue" || this.mode === "minigame" || this.mode === "cutscene" || this.state.phase !== "playing") { clearTimeout(this._summaryTimer); this._summaryTimer = setTimeout(() => this.openSummary(), 500); return; }
    if (this.ui.app.open) this.ui.app.hide();
    this.setMode("summary");
    this.ui.summary?.show(this.summaryData(), () => this.setMode("play"));
    if (this.progress.flags.has("game_complete") && !this.progress.flags.has("summary_seen")) {
      this.progress.flags.add("summary_seen");
      this.persist(true);
    }
  }
  get complete() { return this.progress.flags.has("game_complete"); }

  // tải game khi đã xong (game_complete) mà chưa thấy màn tổng kết (tải lại giữa cảnh kết / trước khi tổng kết hiện):
  // thẻ thành tựu cuối rồi màn tổng kết, như cuối cảnh kết
  resumeSummary() {
    if (!this.complete || this.progress.flags.has("summary_seen")) return false;
    const a = this.content.achievements?.final;
    if (a) hud.achievement(tx(a.label), tx(a.title));
    clearTimeout(this._summaryTimer);
    this._summaryTimer = setTimeout(() => this.openSummary(), a ? 3900 : 600);
    return true;
  }

  // effects.walk = { who: vai NPC | "tu", to: node | [x, y, z] | [[x, y, z], …] (Tú: đường đi qua nhiều điểm), hide,
  //   return_s, return_line, return_flag }
  // NPC: đi thẳng tới đó (hide → khuất khi tới). Tú: đi tới đó rồi khuất; return_s → quay lại cạnh người chơi sau chừng
  // ấy giây chơi, nói return_line (bong bóng) và bật return_flag — trừ khi đã chia tay (cờ tu_said_bye).
  walkActor(w) {
    const node = typeof w.to === "string" ? this.zone.nodes.get(w.to) : null;
    const path = node ? [worldPos(node)] : Array.isArray(w.to?.[0]) ? w.to.map((q) => new THREE.Vector3(...q)) : Array.isArray(w.to) ? [new THREE.Vector3(...w.to)] : null;
    if (!path) return;
    const to = path[path.length - 1];
    if (w.who === "tu") {
      const f = this.follower;
      if (!f || f.gone) return;
      if (this.talkCam.partner === f) this.talkCam.release();
      f.leave(path);
      f.returnInfo = w.return_s ? { at: this.zoneTime + w.return_s, line: w.return_line, flag: w.return_flag } : null;
      return;
    }
    const n = this.npc(w.who);
    if (!n || n.hidden) return;
    if (this.talkCam.partner === n) this.talkCam.release();
    n.walkTo(path[0].setY(n.character.root.position.y), { speed: w.speed ?? 1.3, done: () => { if (w.hide) n.setHidden(true); } });
  }

  // Tú đi hỏi lễ tân (walk return_s) → tới giờ thì quay lại cạnh người chơi, nói 1 câu bong bóng
  checkTuReturn() {
    const f = this.follower, r = f?.returnInfo;
    if (!r || !f.gone || this.mode !== "play" || this.zoneTime < r.at) return;
    f.returnInfo = null;
    if (this.progress.flags.has("tu_said_bye")) return;
    f.comeBack(this.player, { view: this.camera.position, obstacles: this.npcs.map((n) => n.capsule()).filter(Boolean), collider: this.zone.collider });
    if (r.flag) this.applyEffects({ flags: [r.flag] });
    if (r.line) this.guide.say(tx(r.line, { player: this.progress.player.name }));
  }

  // cửa mở được (data/scene_fixes.json → <zone>.doors): open_if đạt → các cánh (node có custom property hinge) xoay quanh
  // bản lề tới góc đã cho trong `seconds`, hộp COL_ của cửa bỏ khỏi va chạm (dựng lại BVH va chạm). Vào zone mà đã đạt
  // điều kiện → cửa mở sẵn.
  setupDoors() {
    this.doors = (this.data.sceneFixes?.[this.zone.id]?.doors || []).map((cfg) => ({
      cfg, t: 0, open: false,
      leaves: Object.entries(cfg.leaves || {}).map(([name, deg]) => {
        const node = this.zone.nodes.get(name);
        // xoay quanh trục Y của node cha (quaternion: cánh có thể đã xoay sẵn, vd Euler 180/0/180)
        const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(deg));
        return node && { node, from: node.quaternion.clone(), to: turn.multiply(node.quaternion) };
      }).filter(Boolean),
    }));
    this.updateDoors(0, true);
  }
  updateDoors(dt, instant = false) {
    for (const d of this.doors || []) {
      if (!d.open && this.progress.check(d.cfg.open_if)) {
        d.open = true;
        if (instant) d.t = 1;
        if (d.cfg.col?.length) this.removeColliders(d.cfg.col);
      }
      if (!d.open || (d.t >= 1 && !instant)) continue;
      d.t = Math.min(1, d.t + dt / (d.cfg.seconds ?? 0.9));
      const k = THREE.MathUtils.smootherstep(d.t, 0, 1);
      for (const l of d.leaves) l.node.quaternion.slerpQuaternions(l.from, l.to, k);
    }
  }
  removeColliders(names) {
    const zone = this.zone, drop = new Set(names);
    zone.colMeshes = zone.colMeshes.filter((m) => !drop.has(m.name));
    this.scene.remove(zone.collider);
    zone.collider.geometry.dispose();
    zone.collider = buildCollider(zone.colMeshes, this.data.collision?.[zone.id]?.add || []);
    this.scene.add(zone.collider);
  }

  updateObjective() {
    const z = this.state.zone, q = this.progress.currentQuest(z);
    // zone chưa có việc (zone_05: các cuộc gặp làm sau) → "Explore <zone>"; zone đã xong hết việc → sang khu tiếp theo
    const none = !this.content.quests.some((x) => x.zone === z);
    if (this.progress.flags.has("game_complete")) { hud.objective(t("hud.objective_complete")); return; }
    hud.objective(q ? tx(q.title) : none ? t("hud.objective_explore", { zone: t(`zones.${z}.title`) }) : t("hud.objective_done_zone"));
  }

  // lưu bản lưu (gộp nhiều thay đổi liền nhau: chờ 300 ms); now = lưu ngay (trước màn mờ chuyển giờ, cảnh kết)
  persist(now = false) {
    clearTimeout(this._save);
    const store = () => { if (!save.store(this.progress) && !this._saveWarned) { this._saveWarned = true; hud.toast(t("hud.save_failed")); } };
    if (now) store();
    else this._save = setTimeout(store, 300);
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
    hud.cover(m === "dialogue" || m === "minigame" || m === "app" || m === "summary");   // ẩn dòng hướng dẫn điều khiển
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
    const tu = this.follower && !this.follower.gone && (actor === "tu" || speakers.has("tu")) ? this.follower : null;
    this.talkPartner = npc || tu;
    const face = npc?.character.root.position ?? tu?.position;
    if (face) this.faceTarget = face.clone();
    const others = new Set();
    if (tu) tu.speak(null);
    try {
      if (npc) await npc.engage(p.position.clone());
      const cast = {   // ai đang nói thì người đó diễn; NPC khác trong cảnh nói (vd người lạ ở cửa quẹt thẻ) → quay về người chơi
        speak: (anim, speaker) => {
          if (speaker === "tu") return tu?.speak(anim);
          const who = npc && npc.role === speaker ? npc : this.speakerActor(speaker);
          if (who && who !== npc && who !== this.follower && !others.has(who)) { others.add(who); who.engage(p.position.clone()); }
          who?.speak?.(anim);
        },
        listen: () => { npc?.listen(); tu?.listen(); for (const o of others) o.listen(); },
      };
      await this.runner.run(id, { npc: cast, vars });
    } finally {
      for (const o of others) o.release();
      this.talkPartner = null;
      this.talkCam.release();
      this.faceTarget = null;
      if (npc) npc.release();
      if (tu) tu.endTalk();
      this.setMode("play");
      this.flushAfterDialogue();
    }
  }

  // câu của người đối thoại / người chơi → camera qua vai (tới hết hội thoại); lời dẫn (narrator) và tin nhắn điện thoại
  // không đổi camera (vd tin nhắn Ms. Nga đầu game, đọc biển xe)
  onLine(n) {
    if (this.mode !== "dialogue" || n.speaker === "narrator" || n.style === "phone") return;
    // camera + người chơi quay về phía người đang nói (hội thoại nhiều người, vd người lạ rồi Tú ở cửa quẹt thẻ)
    const speaker = n.speaker === "player" ? null : this.speakerActor(n.speaker);
    if (speaker && speaker !== this.talkPartner) { this.talkPartner = speaker; this.faceTarget = speaker.character.root.position.clone(); }
    const partner = this.talkPartner;
    if (!partner) return;
    const obstacles = this.npcs.filter((x) => x !== partner).map((x) => x.capsule());
    if (this.follower && this.follower !== partner) obstacles.push(this.follower.capsule());
    this.talkCam.engage(partner, { player: this.player, env: this.talkEnv(), obstacles: obstacles.filter(Boolean) });
  }

  // người (NPC / Tú) đang có mặt ứng với vai người nói
  speakerActor(role) {
    if (role === "tu") return this.follower && !this.follower.gone && this.follower.character.root.visible ? this.follower : null;
    return this.npcs.find((x) => x.role === role && !x.hidden) || null;
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
    if (prev !== "dialogue") this.flushAfterDialogue();
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
    this.updateDoors(dt);
    this.checkTuReturn();
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
