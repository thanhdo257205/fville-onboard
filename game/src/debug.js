// window.__game — hook debug để tự kiểm tra bằng số liệu (không cần ảnh chụp).
//   __game.player            → { pos, speed, onGround, yaw }
//   __game.zone / .state      → zone hiện tại, trạng thái (phase, tier, việc đã xong, cờ)
//   __game.teleport(name, {offset, zone})   → dịch chuyển tới node theo tên (vd "INT_gieng_lang")
//   __game.goto(zone, spawn)  → vào zone tại SPAWN_
//   __game.complete(id)       → hoàn thành nhanh một việc (đánh dấu done)
//   __game.simulate(sec, {x, y, run}) → chạy mô phỏng cố định 60 Hz với phím giả lập (khi tab ẩn vẫn chạy)
//   __game.walkTo(name, {run, maxSec}) → đi thẳng tới node, trả kết quả (tới nơi / bị chặn)
//   __game.benchmark(frames)  → đo thời gian khung hình thật (ms, FPS tương đương), không phụ thuộc vsync
//   __game.collisionScan()    → quét lỗi va chạm quanh mọi SPAWN_ của zone hiện tại
//   __game.cameraCeiling()    → camera chơi ngẩng / lùi hết cỡ ở chỗ người chơi + mọi SPAWN_: có lên xuyên trần không
//   __game.seeThrough         → cây cối có thể mờ của zone (số cây, cây đang mờ, cây đang che)
//   __game.talkCam            → camera hội thoại (đang bật, vai trái/phải, điểm chọn vai, người đối thoại)
//   __game.guide              → hướng dẫn: mục tiêu, vị trí dấu "!", mũi tên, giờ đứng yên, các lần nhắc; help() = phím H
//   __game.acts               → 4 Act: Act hiện tại, tiến độ từng Act, các thẻ Act đã hiện; __game.cards = thẻ giữa màn hình gần đây
//   __game.finish()           → hoàn thành game: cảnh kết (ở zone_05: Lan ghé bàn; rồi bến xe zone_01 hoàng hôn, Tú, lên xe),
//                               thẻ thành tựu cuối, màn tổng kết; __game.ending (nhịp cảnh kết), __game.summary,
//                               summaryCard() (thẻ PNG của nút Download card)
//   __game.net                → chơi nhiều người: trạng thái kết nối, số online, người khác (vị trí, animation, bảng tên, bong bóng),
//                               emote / câu chat đã nhận; netEmote(id) / netPhrase(id) = chọn trong bảng phím T
//   smoke test (scripts/tests/smoke.mjs): step() = làm mục tiêu hiện tại (approach → bấm E / bước vào vùng → resolve);
//     approach(target) = dịch chuyển tới chỗ bấm E được; resolve() = tự giải hội thoại (autoplay.pickChoice), mini-game
//     (mgSolve), cảnh chuyển, màn mờ chuyển giờ tới khi đi lại tự do (pauseOn: dừng sớm khi mở mini-game / "time_skip")
import * as THREE from "three";
import { sound as soundLog } from "./core/sound.js";
import { worldPos, inTrigger } from "./world/zone.js";
import { penetration } from "./world/collision.js";
import { hud } from "./ui/hud.js";
import { pickChoice } from "./game/autoplay.js";
import { tx } from "./content/content.js";
import { fitOf } from "./characters/accessories.js";

export function installDebug(game, loop) {
  const v3 = (v) => v && [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
  const step = 1 / 60;
  const api = {
    get player() {
      const p = game.player;
      return p && { pos: v3(p.position), speed: +p.speed.toFixed(2), onGround: p.body.onGround, yaw: +THREE.MathUtils.radToDeg(p.character.root.rotation.y).toFixed(1), fellOut: p.fellOut || 0,
        seated: p.seated?.state ?? null, sits: p.sits || 0, rootY: +p.character.root.position.y.toFixed(3) };   // ngồi ghế: sitting_down | seated | standing_up
    },
    get zone() { return game.state.zone; },
    get state() {
      const s = game.state;
      return { ...s, mode: game.mode, gpu: game.gpu, detected: game.detected, setting: game.settings.tier, fps: +loop.fps.toFixed(1) };
    },
    // tiến trình chơi (lưu trong trình duyệt)
    get progress() { return game.progress.toJSON(); },
    get validation() { return game.validation; },
    // gợi ý E hiện tại (đối tượng gần nhất trong bán kính / vùng)
    get prompt() { const e = game.interaction.current; return e ? { text: document.getElementById("prompt").dataset.text, action: e.item.action, node: e.item.node || e.item.object || e.item.actor } : null; },
    get dialogue() { return game.ui.dialogue.snapshot && { id: game.runner.active?.id, node: game.runner.active?.node, ...game.ui.dialogue.snapshot }; },
    get minigame() { return game.ui.minigame.open ? game.ui.minigame.id : null; },
    get toasts() { return { now: document.getElementById("toast").textContent, queued: [...game.ui.hudQueue()] }; },
    get objective() { return document.getElementById("objective").textContent; },
    get guide() { const el = document.getElementById("phone-msg"); return { ...game.guide.info(), phone: el?.classList.contains("show") ? el.textContent : null }; },
    get acts() { return game.acts.info(); },
    get cards() { return { recent: hud.lastCards || [], queued: hud.cards.map((c) => c.kind) }; },
    finish() { game.finishGame(); return api.cards; },
    get net() { return game.net?.info(); },
    // bàn bi-a zone 5 (game/src/pool/table.js): trạng thái + enter() (chơi một mình / bàn chung), shoot(angle, power, {instant})
    // → Promise kết quả khi bi dừng, leave(), rerack(), solve() (thử thách của anh Khang: đánh cú tìm được bằng vật lý).
    // Bàn chung (bi-a bước 3): .net (ghế, lượt, nhóm, bàn đang hiện / bàn máy chủ, số cú đã phát lại, sự kiện), join(),
    // autoShot() (cú tự chọn cho người tới lượt), forceShot(angle, power) (gửi bất chấp lượt — máy chủ phải chặn), place(x, z)
    // (bi trong tay: đặt bi trắng),
    // setFast(true) (cú của người khác hiện ngay kết quả)
    get pool() {
      const p = game.pool;
      if (!p) return null;
      return Object.assign(p.info(), {
        enter: () => { if (!p.active) p.enter(); return p.info(); },
        shoot: (angle, power = 0.5, opts) => p.shoot(angle ?? p.angle, power, opts),
        leave: () => { p.leave(); return p.info(); },
        rerack: () => { p.rerack(); return p.info(); },
        solve: () => p.solve(),
        aim: () => p.aim ?? null,
        join: () => { p.join(); return p.info(); },
        autoShot: (opts) => p.autoShot(opts),
        forceShot: (angle, power = 0.5) => p.forceShot(angle, power),
        setFast: (on = true) => { p.fast = !!on; return p.fast; },
        place: (x, z) => p.debugPlace(x, z),
      });
    },
    netEmote(id) { return game.net?.emote(id); },
    netPhrase(id) { return game.net?.phrase(id); },
    // thẻ PNG của màn tổng kết (nút Download card): kích thước + độ dài data URL
    async summaryCard() { const cv = await game.ui.summary.card(game.summaryData()); return { width: cv.width, height: cv.height, png: cv.toDataURL("image/png").length }; },
    get ending() { const c = game.lastCutscene; return c?.id === "ending" ? { running: game.cutscene === c, stage: c.stage, log: c.log, skipped: c.skipped } : null; },
    get summary() { return { open: game.ui.summary.open, data: game.ui.summary.open ? game.summaryData() : null, text: game.ui.summary.open ? game.ui.summary.el.innerText : null }; },
    help() { game.help(); return { card: document.getElementById("helpcard")?.classList.contains("show") ? document.getElementById("helpcard").textContent : null, app: game.ui.app.helpOpen }; },
    // cảnh chuyển đang chạy / vừa chạy: nhịp hiện tại, thời gian (giây game), mốc từng nhịp
    get cutscene() { const c = game.cutscene || game.lastCutscene; return c ? { id: c.id, running: !!game.cutscene, stage: c.stage, t: +c.t.toFixed(2), skipped: c.skipped, log: c.log } : null; },
    playCutscene(id) { game.playCutscene(id); return api.cutscene; },
    // dừng hình cảnh chuyển khi tới nhịp `stage` + `after` giây (để chụp ảnh), gọi lại với nhịp khác để chạy tiếp
    holdCutscene(stage, after = 0) {
      game.debugHold = (c) => { const e = [...c.log].reverse().find((l) => l.stage === stage); return !!e && c.t - e.t >= after; };
      return stage;
    },
    releaseCutscene() { game.debugHold = null; },
    skipCutscene() { game.cutscene?.skip(); return api.cutscene; },
    // chạy cảnh chuyển bằng mô phỏng (khung trình duyệt ẩn vẫn chạy), chụp ảnh từng nhịp qua onStage(stage)
    async runCutscene(id, { step = 1 / 30, onStage = null, maxSec = 60 } = {}) {
      game.playCutscene(id);
      let last = null, n = 0;
      while (game.cutscene && n++ < maxSec / step) {
        game.update(step);
        game.render(step);
        const s = game.cutscene?.stage;
        if (s && s !== last) { last = s; if (onStage) await onStage(s); }
        await new Promise((r) => setTimeout(r, 0));
      }
      return api.cutscene;
    },
    get npcs() {
      return game.npcs.map((n) => ({ node: n.node, role: n.role, name: game.characters.displayName(n.role), pose: n.pose, state: n.state,
        anim: n.character.current?.getClip().name, yaw: +THREE.MathUtils.radToDeg(n.character.root.rotation.y).toFixed(1), pos: v3(n.character.root.position) }));
    },
    get follower() {
      const f = game.follower;
      return f && { pos: v3(f.position), speed: +f.speed.toFixed(2), toPlayer: +f.position.distanceTo(game.player.position).toFixed(2), teleports: f.teleports, onGround: f.body.onGround };
    },
    get model() {
      const c = game.player.character, id = game.characters.modelId("player");
      return { id, gender: game.characters.gender, look: game.characters.look, tier: c.tier, glb: game.characters.model(id).glb[c.tier], outfit: c.outfit ?? null,
        accessories: c.accessoryList };
    },
    // phụ kiện (characters.json → accessories, vd "cap"): đội / bỏ (opts.force: bỏ qua điều kiện mở khoá) → Promise
    setAccessory(id, on = true, opts) { return game.setAccessory(id, on, opts); },
    // phụ kiện đang đội trên người chơi: xương gắn, hộp bao (thế giới) so với xương đầu
    accessoryInfo(id = "cap") {
      const c = game.player.character, obj = c.accessories?.get(id);
      if (!obj) return null;
      c.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj), hp = obj.parent.getWorldPosition(new THREE.Vector3());
      return { bone: obj.parent.name, top: +box.max.y.toFixed(3), bottom: +box.min.y.toFixed(3), headY: +hp.y.toFixed(3), center: v3(box.getCenter(new THREE.Vector3())),
        root: v3(c.root.position), size: v3(box.getSize(new THREE.Vector3())), fit: fitOf(id, c.modelId)?.shape ?? null };
    },
    // đổi ngoại hình (roles.player.looks, vd "intern_nam_kinh"; null = mặc định theo giới tính): đặt luôn giới tính theo model
    async setLook(id) {
      const g = id ? game.characters.lookGender(id) : game.characters.gender;
      if (!g) throw new Error(`setLook: "${id}" không có trong roles.player.looks`);
      game.progress.player.look = id || null;
      game.characters.look = id || null;
      return api.setGender(g);
    },
    // đổi giới tính người chơi lúc chơi (lưu vào bản lưu): "nam" | "nu" → đổi model, giữ đúng bộ đồ
    async setGender(g) {
      game.progress.player.gender = g;
      game.characters.gender = g;
      game.persist();
      game.player.setCharacter(await game.characters.create("player", game.state.tier));
      game.updateAccessories();
      game.scene.add(game.player.character.root);
      game.updateOutfit();
      // Tú khác giới với người chơi (roles.tu.model_by_gender) → dựng lại zone ngay chỗ đang đứng để Tú đổi model theo
      if (game.follower) {
        const p = game.player;
        await game.enterZone(game.state.zone, null, { fade: false, zoneCard: false, keepPose: { pos: p.position.clone(), rot: p.character.root.rotation.y } });
      }
      return api.model;
    },
    // Tú: model đúng giới tính (khác người chơi), bộ đồ đang mặc, chân dung hộp thoại, đại từ trong chữ ({tu_he}…)
    get tu() {
      const c = game.characters, f = game.follower, id = c.modelId("tu");
      return { id, gender: c.model(id)?.gender ?? null, built: f?.character.modelId ?? null, outfit: f ? f.character.outfit ?? null : undefined,
        wearing: c.wearing.tu ?? null, portrait: c.portrait("tu"), visible: !!f && !f.gone && f.character.root.visible, he: tx("{tu_he}") };
    },
    // chữ của 1 nút hội thoại như game hiện (thay {player}, {tu_his}…)
    textOf(dialogue, node) {
      const n = game.content.dialogues.get(dialogue)?.nodes?.[node];
      return n ? tx(n.text, { player: game.progress.player.name }) : null;
    },
    get triggers() { return game.zone.triggers.map((t) => ({ name: t.name, inside: t.inside, cfg: game.triggerCfg(t.name) || null })); },

    // ---------- smoke test ----------
    // tới chỗ làm được mục tiêu `target` (node / actor "tu" / object): vùng kích hoạt (chuyển zone, lên xe) → đứng giữa hộp,
    // coi như vừa bước vào; điểm tương tác có vùng (area) → đứng trong vùng; còn lại → thử 8 hướng quanh đích tới khi
    // lời nhắc E đúng là đích. → { ok, kind: "trigger" | "interact", why }
    async approach(target) {
      const z = game.zone;
      if (!target) return { ok: false, why: "không có đích" };
      const stand = (p, triggers = true) => {
        game.player.body.teleport(p.clone().add(new THREE.Vector3(0, 0.05, 0)));
        game.player.velocity?.set(0, 0, 0);
        game.player.sync();
        game.triggersOff = true;
        api.simulate(0.4, undefined, { render: false });     // rơi xuống mặt đất, va chạm đẩy ra
        game.triggersOff = !triggers;
      };
      const tr = z.triggers.find((x) => x.name === target);
      if (tr && game.triggerCfg(target)) {
        stand(worldPos(tr.node));
        tr.inside = false;                                    // vừa bước vào → onTrigger
        api.simulate(0.1, undefined, { render: false });
        game.triggersOff = false;
        return { ok: true, kind: "trigger" };
      }
      const e = game.interaction.list.find((x) => [x.item.node, x.item.actor, x.item.object].includes(target) && game.interaction.available(x));
      if (!e) { game.triggersOff = false; return { ok: false, why: `không có điểm tương tác dùng được cho ${target}` }; }
      const ok = () => game.interaction.current === e;
      if (e.trigger) { stand(worldPos(e.trigger.node), false); game.triggersOff = false; if (ok()) return { ok: true, kind: "interact" }; }
      const c = game.interaction.actorPos(e);
      if (!c) { game.triggersOff = false; return { ok: false, why: `${target}: không có vị trí` }; }
      for (const r of [Math.min(1.1, e.radius * 0.6), Math.min(1.6, e.radius * 0.85)]) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          stand(c.clone().add(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)), false);
          if (ok()) { game.triggersOff = false; return { ok: true, kind: "interact" }; }
        }
      }
      game.triggersOff = false;
      return { ok: false, why: `${target}: không đứng được chỗ nào có lời nhắc E (lời nhắc: ${game.interaction.current?.item.action ?? "không có"}, mode ${game.mode}, phase ${game.state.phase})` };
    },
    // tự giải mọi thứ đang mở tới khi đi lại tự do: hội thoại (lựa chọn theo autoplay.pickChoice — giá trị > việc đang làm >
    // câu đầu), mini-game (debug solve), cảnh chuyển (chạy nhanh bằng update), màn mờ chuyển giờ. pauseOn: ["login",
    // "time_skip", …] → dừng ngay khi mini-game / màn mờ đó bắt đầu (để kiểm tra), gọi lại resolve() để chạy tiếp.
    async resolve({ goal = null, pauseOn = [], maxMs = 90000 } = {}) {
      const out = { dialogues: [], choices: [], minigames: [], cutscenes: [], paused: null };
      const t0 = performance.now(), g = goal ?? game.guide.current().quest?.id ?? null;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const note = (arr, x) => { if (x && arr[arr.length - 1] !== x) arr.push(x); };
      const answer = () => {
        const d = game.ui.dialogue, w = d.waiting, a = game.runner.active;
        if (!w) return;
        note(out.dialogues, a?.id);
        if (w.kind === "next") { d.next(); return; }
        const n = game.content.dialogues.get(a?.id)?.nodes[a?.node];
        const vis = (n?.choices || []).filter((ch) => game.progress.check(ch.if));
        const i = pickChoice(game.content, a?.id, a?.node, vis, g);
        out.choices.push(`${a?.id}/${a?.node}:${i}`);
        d.choose(i);
      };
      let mg = null, mgAt = 0, calm = 0;
      while (performance.now() - t0 < maxMs) {
        if (game.cutscene) {
          note(out.cutscenes, game.cutscene.id);
          if (pauseOn.includes(`${game.cutscene.id}:${game.cutscene.stage}`)) return { ...out, paused: `${game.cutscene.id}:${game.cutscene.stage}` };
          for (let k = 0; k < 20 && game.cutscene; k++) { game.update(1 / 30); answer(); }
          game.render(1 / 30);
          calm = 0; await sleep(0); continue;
        }
        if (game.timeSkipping) { if (pauseOn.includes("time_skip")) return { ...out, paused: "time_skip" }; calm = 0; await sleep(50); continue; }
        if (game.ui.dialogue.waiting) { answer(); calm = 0; await sleep(0); continue; }
        const a = game.ui.minigame.active;
        if (a) {
          if (a !== mg) {
            mg = a; mgAt = performance.now(); note(out.minigames, a.id);
            if (pauseOn.includes(a.id)) return { ...out, paused: a.id };
            a.ctx.debug.solve?.();
          } else if (performance.now() - mgAt > 4000) { mgAt = performance.now(); a.ctx.debug.solve?.(); }
          calm = 0; await sleep(50); continue;
        }
        const busy = game.state.phase !== "playing" || game.runner.active || game.finishing || game.mode === "dialogue" || game.mode === "minigame" || game.mode === "cutscene";
        if (busy) { calm = 0; game.update(1 / 30); await sleep(30); continue; }
        if (++calm >= 3) break;                              // 3 lượt liền không còn gì mở → xong
        game.update(1 / 30);
        await sleep(30);
      }
      return { ...out, ms: Math.round(performance.now() - t0), timeout: performance.now() - t0 >= maxMs };
    },
    // làm mục tiêu hiện tại (guide.current): xong mọi thứ đang mở (hội thoại on_enter của zone — chờ 0,7 s sau khi vào zone,
    // sự kiện theo giờ…), tới đích, bấm E hoặc bước vào vùng, resolve. Bị hội thoại khác chen ngang thì làm lại (3 lần).
    async step(opts = {}) {
      let why = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const wait = 700 - (performance.now() - (game.state.readyAt ?? 0));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        const pre = await api.resolve({ maxMs: 30000, pauseOn: opts.pauseOn });
        if (pre.paused) return { goal: game.guide.current().key, ok: true, zone: game.state.zone, ...pre };
        const goal = game.guide.current();
        if (goal.key === "complete") return { goal: goal.key, ok: true, complete: true };
        const r = await api.approach(goal.target);
        if (!r.ok) { why = r.why; continue; }
        if (r.kind === "interact" && !game.interact()) { why = `bấm E không có tác dụng (mode ${game.mode})`; continue; }
        const res = await api.resolve({ goal: goal.quest?.id, ...opts });
        return { goal: goal.key, ok: !res.timeout, zone: game.state.zone, ...res };
      }
      return { goal: game.guide.current().key, ok: false, why };
    },
    get info() { const i = game.renderer.info; return { triangles: i.triangles, calls: i.calls }; },
    get seeThrough() { return game.seeThrough.info(); },
    get talkCam() { const c = game.talkCam; return { active: c.active, goal: c.goal, t: +c.t.toFixed(2), side: c.side, lift: c.lift, pick: c.info, partner: c.partner?.role ?? (c.partner ? "tu" : null) }; },
    get _game() { return game; },          // truy cập nội bộ khi cần soi sâu
    nodes(prefix = "") { return [...game.zone.nodes.keys()].filter((n) => n.startsWith(prefix)); },
    // COL_ nào chứa điểm p (tìm vật cản khi bị kẹt)
    colAt(p, pad = 0.4) {
      const v = new THREE.Vector3(...p), box = new THREE.Box3();
      return game.zone.colMeshes.filter((m) => box.setFromObject(m).expandByScalar(pad).containsPoint(v))
        .map((m) => { box.setFromObject(m); return `${m.name} [${v3(box.min)}]→[${v3(box.max)}]`; });
    },

    // file: tải zone ngoài phạm vi chơi để thử (vd goto("zone_05", "SPAWN_zone_05_start", "zone_05_office"))
    async goto(zone, spawn, file) { await game.enterZone(zone, spawn ?? game.zoneCfg(zone)?.start, { fade: false, file }); return api.player; },
    // NPC: nói chuyện (ngồi → đứng dậy → quay về phía người chơi → talk) / kết thúc (quay lại → ngồi lại)
    async talk(nodeOrRole) {
      const n = game.npc(nodeOrRole);
      const t0 = performance.now();
      const p = n.engage(game.player.position.clone());
      while (n.state !== "talking" && performance.now() - t0 < 8000) api.simulate(0.1, undefined, { render: false }), await new Promise((r) => setTimeout(r, 0));
      await p;
      return { state: n.state, anim: n.character.current?.getClip().name, ms: Math.round(performance.now() - t0) };
    },
    async release(nodeOrRole) {
      const n = game.npc(nodeOrRole);
      const p = n.release();
      const t0 = performance.now();
      while (!["idle", "seated"].includes(n.state) && performance.now() - t0 < 8000) api.simulate(0.1, undefined, { render: false }), await new Promise((r) => setTimeout(r, 0));
      await p;
      return { state: n.state, anim: n.character.current?.getClip().name, yaw: +THREE.MathUtils.radToDeg(n.character.root.rotation.y).toFixed(1) };
    },
    async teleport(name, { offset = [0, 0, 1.5], zone } = {}) {
      if (zone && zone !== game.state.zone) await api.goto(zone);
      const node = game.zone.nodes.get(name);
      if (!node) throw new Error(`không có node ${name} trong ${game.state.zone}`);
      const p = worldPos(node).add(new THREE.Vector3(...offset));
      game.player.body.teleport(p);
      game.player.sync();
      for (const tr of game.zone.triggers) tr.inside = inTrigger(tr, p.clone().setY(p.y + 0.9));
      api.simulate(0.5);   // rơi xuống mặt đất, va chạm đẩy ra nếu đứng trong vật
      return api.player;
    },
    // hoàn thành nhanh 1 việc: áp kết quả mini-game gắn với quest (nếu có) hoặc chỉ đánh dấu xong
    complete(id) {
      const m = Object.entries(game.content.minigames).find(([k, v]) => !k.startsWith("_") && [].concat(v.result?.quest || []).includes(id));
      return game.applyEffects(m ? m[1].result : { quest: id });
    },
    effects(e) { return game.applyEffects(e); },
    // tương tác như bấm E; trả hành động đã chạy
    interact() { const e = game.interaction.current; if (!e) return null; game.interact(); return e.item.action; },
    advance() { game.ui.dialogue.next(); return api.dialogue; },
    choose(i) { game.ui.dialogue.choose(i); return api.dialogue; },
    finishMinigame(ok = true) { const a = game.ui.minigame.active; if (!a) return; ok ? a.ctx.debug.solve?.() : game.ui.minigame.close(); },
    // mini-game đang mở: trạng thái + thao tác thử (solve = làm đúng, wrong = làm sai 1 lần, skip = bấm Skip)
    get mg() {
      const h = game.ui.minigame, a = h.active;
      return a ? { id: a.id, mistakes: a.mistakes, skipShown: !h.el.querySelector("[data-a=skip]").hidden, hint: h.el.querySelector(".hint")?.textContent,
        state: a.ctx.debug.state?.() } : { last: h.last ? { ...h.last, effects: { ...h.last.effects, photo: h.last.effects.photo && { key: h.last.effects.photo.key, kb: Math.round(h.last.effects.photo.data.length * 0.75 / 1024) } } } : null };
    },
    mgSolve(...args) { game.ui.minigame.active?.ctx.debug.solve?.(...args); return api.mg; },
    mgWrong() { game.ui.minigame.active?.ctx.debug.wrong?.(); return api.mg; },
    mgSkip() { game.ui.minigame.skip(); return api.mg; },
    mgDebug() { return game.ui.minigame.active?.ctx.debug; },
    get sounds() { return [...soundLog.log]; },
    // CHỈ khi chạy dev: lưu ảnh vào renders/game/<name> (Vite middleware /__dev/save) — kiểm tra khi khung trình duyệt bị ẩn
    async saveImage(name, data) { const r = await fetch("/__dev/save", { method: "POST", body: JSON.stringify({ name, data }) }); return r.json(); },
    // chụp khung hình 3D hiện tại (không có HUD / bảng HTML)
    async shot(name, quality = 0.85) { game.render(0); return api.saveImage(name, game.renderer.canvas.toDataURL("image/jpeg", quality)); },
    app(tab) { if (tab === false) { if (game.ui.app.open) game.toggleApp(); return null; } if (!game.ui.app.open) game.toggleApp(); if (game.ui.app.open && tab) game.ui.app.show(tab); return game.ui.app.open; },
    async tick(ms = 30) { await new Promise((r) => setTimeout(r, ms)); return api.dialogue; },
    // "auto" | "low" | "high" — giống chọn trong menu Esc (lưu vào cài đặt)
    async setTier(v) { await game.setTier(v); await api.waitPlaying(); return { setting: game.settings.tier, tier: game.state.tier }; },

    // mô phỏng không cần requestAnimationFrame (khung trình duyệt bị ẩn vẫn chạy được)
    simulate(sec, move = { x: 0, y: 0, run: false }, { render = true } = {}) {
      game.input.override = move;
      const n = Math.round(sec / step);
      for (let i = 0; i < n && game.state.phase === "playing"; i++) game.update(step);
      game.input.override = null;
      if (render) game.render(step);
      return api.player;
    },
    // đi thẳng tới node theo hướng camera (xoay camera về phía mục tiêu)
    // name: tên node hoặc toạ độ [x, y, z]
    walkTo(name, { run = false, maxSec = 20, stopAt = 1.2 } = {}) {
      const target = Array.isArray(name) ? new THREE.Vector3(...name) : worldPos(game.zone.nodes.get(name));
      let t = 0, stuck = 0, last = game.player.position.clone();
      while (t < maxSec && game.state.phase === "playing") {
        const p = game.player.position;
        const d = new THREE.Vector3(target.x - p.x, 0, target.z - p.z);
        if (d.length() < stopAt) break;
        game.cam.yaw = Math.atan2(-d.x, -d.z);     // forward() = -(sin yaw, cos yaw)
        api.simulate(0.25, { x: 0, y: 1, run }, { render: false });
        t += 0.25;
        stuck = p.distanceTo(last) < 0.05 ? stuck + 1 : 0;
        last.copy(p);
        if (stuck >= 4) break;
      }
      const p = game.player.position;
      const dist = Math.hypot(target.x - p.x, target.z - p.z);
      game.render(step);
      return { target: name, reached: dist < stopAt + 0.3, dist: +dist.toFixed(2), sec: t, stuck: stuck >= 4, zone: game.state.zone, pos: v3(p) };
    },
    // đi lần lượt qua các điểm; dừng khi chuyển zone. Trả từng chặng.
    async route(points, opts = {}) {
      const z = game.state.zone, legs = [];
      for (const pt of points) {
        legs.push(api.walkTo(pt, { stopAt: 0.8, maxSec: 30, ...opts }));
        if (game.state.phase !== "playing") { await api.waitPlaying(); legs.push({ zoneChange: `${z} → ${game.state.zone}`, at: api.player.pos }); break; }
      }
      return legs;
    },
    async waitPlaying(timeout = 15000) {
      const t0 = performance.now();
      while (game.state.phase !== "playing" && performance.now() - t0 < timeout) await new Promise((r) => setTimeout(r, 100));
      return game.state.phase;
    },
    benchmark(frames = 120) {
      const r = game.renderer;
      game.render(step); r.finish();
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        game.cam.yaw += (Math.PI * 2) / frames;                // quay 1 vòng quanh người chơi
        game.cam.update(0, game.player.position, { dx: 0, dy: 0, wheel: 0 }, game.zone.collider, true, game.zone.view);
        game.render(step);
        r.finish();
      }
      const ms = (performance.now() - t0) / frames;
      return { tier: game.state.tier, zone: game.state.zone, ms: +ms.toFixed(2), fps: +(1000 / ms).toFixed(0), ...api.info };
    },
    // camera chơi ngẩng hết cỡ + lùi xa nhất (như kéo / lăn chuột hết cỡ) ở chỗ người chơi và mọi SPAWN_ của zone, quay
    // yaws hướng: tia điểm nhìn → camera có đi lên xuyên mặt nằm ngang nào của lưới hiển thị (trần) không. Chỉ tính khi
    // camera lùi được quá 0,5 m (sát hơn là vật ngay trên đầu — như clampCamera, camera không vào gần hơn).
    // withView=false: camera chỉ tránh COL_ như trước khi sửa lỗi xuyên trần (đối chứng)
    cameraCeiling({ yaws = 12, withView = true } = {}) {
      const z = game.zone, cam = game.cam, saved = { yaw: cam.yaw, pitch: cam.pitch, distance: cam.distance, current: cam.current };
      const pts = [game.player.position.clone(), ...[...z.spawns.values()].map((s) => worldPos(s))];
      const ray = new THREE.Ray(), bvh = z.view.geometry.boundsTree;
      let n = 0, through = 0, close = 0, maxUp = 0;
      for (const p of pts) for (let i = 0; i < yaws; i++) {
        cam.yaw = (i * Math.PI * 2) / yaws;
        cam.update(0, p, { dx: 0, dy: 1e4, wheel: 1e3 }, z.collider, true, withView ? z.view : null);
        const d = game.camera.position.clone().sub(cam.target), L = d.length();
        ray.set(cam.target, d.divideScalar(L));
        n++;
        if (bvh.raycast(ray, THREE.DoubleSide, 0, L).some((h) => Math.abs(h.face.normal.y) > 0.7)) { if (cam.current > 0.501) through++; else close++; }
        maxUp = Math.max(maxUp, game.camera.position.y - p.y);
      }
      const max = { pitch: +cam.pitch.toFixed(2), distance: cam.distance };
      Object.assign(cam, saved);
      cam.update(0, game.player.position, { dx: 0, dy: 0, wheel: 0 }, z.collider, true, z.view);
      return { points: pts.length, n, through, close, maxUp: +maxUp.toFixed(2), ...max };
    },
    // quét va chạm: mỗi SPAWN_ → đi 16 hướng × 3 s (chạy), ghi lỗi: rơi khỏi bản đồ, lún vào vật, không đứng được trên đất
    collisionScan(opts = {}) {
      game.triggersOff = true;
      try { return scan(opts); } finally { game.triggersOff = false; }
    },
  };
  function scan({ dirs = 16, sec = 3 } = {}) {
      const issues = [];
      const z = game.state.zone;
      for (const [name, sp] of game.zone.spawns) {
        const base = worldPos(sp);
        api.teleport(name, { offset: [0, 0, 0] });
        if (!game.player.body.onGround) issues.push({ zone: z, at: name, issue: "spawn không đứng trên mặt đất", pos: v3(game.player.position) });
        for (let k = 0; k < dirs; k++) {
          game.player.body.teleport(base.clone().add(new THREE.Vector3(0, 0.05, 0)));
          game.player.fellOut = 0;
          api.simulate(0.3, undefined, { render: false });
          game.cam.yaw = (k / dirs) * Math.PI * 2;
          let minY = Infinity;
          for (let s = 0; s < sec / 0.25; s++) {
            api.simulate(0.25, { x: 0, y: 1, run: true }, { render: false });
            minY = Math.min(minY, game.player.position.y);
            const pen = penetration(game.zone.collider, game.player.position);
            if (pen > 0.08) { issues.push({ zone: z, at: name, dir: k, issue: `lún vào vật ${pen.toFixed(2)} m`, pos: v3(game.player.position) }); break; }
            if (game.state.phase !== "playing") break;
          }
          if (game.player.fellOut) issues.push({ zone: z, at: name, dir: k, issue: "rơi khỏi bản đồ", pos: v3(game.player.position) });
          if (minY < base.y - 1.0) issues.push({ zone: z, at: name, dir: k, issue: `tụt xuống ${(base.y - minY).toFixed(2)} m`, pos: v3(game.player.position) });
          if (game.state.phase !== "playing" || game.state.zone !== z) return { issues, note: `dừng vì đã chuyển zone (${game.state.zone})` };
        }
      }
      api.teleport([...game.zone.spawns.keys()][0], { offset: [0, 0, 0] });
      return { zone: z, spawns: game.zone.spawns.size, issues };
  }
  window.__game = api;
  return api;
}
