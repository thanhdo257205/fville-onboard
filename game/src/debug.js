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
//   __game.seeThrough         → cây cối có thể mờ của zone (số cây, cây đang mờ, cây đang che)
import * as THREE from "three";
import { sound as soundLog } from "./core/sound.js";
import { worldPos, inTrigger } from "./world/zone.js";
import { penetration } from "./world/collision.js";

export function installDebug(game, loop) {
  const v3 = (v) => v && [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
  const step = 1 / 60;
  const api = {
    get player() {
      const p = game.player;
      return p && { pos: v3(p.position), speed: +p.speed.toFixed(2), onGround: p.body.onGround, yaw: +THREE.MathUtils.radToDeg(p.character.root.rotation.y).toFixed(1), fellOut: p.fellOut || 0 };
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
    get model() { const c = game.player.character; return { tier: c.tier, glb: game.characters.model(game.characters.role("player").model).glb[c.tier] }; },
    get triggers() { return game.zone.triggers.map((t) => ({ name: t.name, inside: t.inside, cfg: game.triggerCfg(t.name) || null })); },
    get info() { const i = game.renderer.info; return { triangles: i.triangles, calls: i.calls }; },
    get seeThrough() { return game.seeThrough.info(); },
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
        game.cam.update(0, game.player.position, { dx: 0, dy: 0, wheel: 0 }, game.zone.collider, true);
        game.render(step);
        r.finish();
      }
      const ms = (performance.now() - t0) / frames;
      return { tier: game.state.tier, zone: game.state.zone, ms: +ms.toFixed(2), fps: +(1000 / ms).toFixed(0), ...api.info };
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
