// Khởi động: chữ (i18n), dữ liệu + nội dung (kiểm tra node GLB), tiến trình đã lưu hoặc màn tạo nhân vật, vòng lặp game.
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./style.css";
import * as THREE from "three";
import { loadJSON, url } from "./core/assets.js";
import { loadStrings, t } from "./i18n.js";
import { createRenderer } from "./render/renderer.js";
import { Input } from "./core/input.js";
import { loadSettings } from "./core/quality.js";
import { Characters } from "./characters/characters.js";
import { Game } from "./game/game.js";
import { GameState, save } from "./game/state.js";
import { loadContent, validateNodes, validateLinks } from "./content/content.js";
import { NameTags } from "./ui/nametags.js";
import { Menu } from "./ui/menu.js";
import { DialogueUI } from "./ui/dialogue.js";
import { MyFptApp } from "./ui/app.js";
import { characterCreator, confirmBox } from "./ui/panels.js";
import { MinigameHost } from "./minigames/host.js";
import { hud } from "./ui/hud.js";
import { installDebug } from "./debug.js";

async function boot() {
  await loadStrings("en");
  document.title = t("app.title");
  hud.loading(t("app.loading"));
  const [zones, chars, collision, sceneFixes, content] = await Promise.all([
    loadJSON(url("data/zones.json")), loadJSON(url("data/characters.json")),
    loadJSON(url("data/collision.json")), loadJSON(url("data/scene_fixes.json")), loadContent(),
  ]);
  const debugMode = new URLSearchParams(location.search).has("debug");

  // kiểm tra dữ liệu: tham chiếu nội bộ + mọi node nhắc tới phải có trong GLB của zone (thiếu → báo rõ tên)
  const zoneFiles = Object.fromEntries(zones.order.map((z) => [z, zones.zones[z].file]));
  const linkErrors = validateLinks(content);
  const nodeCheck = await validateNodes(content, zoneFiles);
  const problems = [...linkErrors, ...nodeCheck.missing];
  if (problems.length) {
    console.error("[kiểm tra dữ liệu]\n" + problems.join("\n"));
    if (debugMode) hud.debug(`Lỗi dữ liệu (${problems.length}):\n${problems.join("\n")}`);
  } else console.info(`[kiểm tra dữ liệu] OK — ${nodeCheck.checked} tham chiếu node GLB, ${content.dialogues.size} hội thoại`);

  const app = document.getElementById("app");
  const renderer = createRenderer(app);
  const input = new Input(renderer.canvas);
  const settings = loadSettings();
  const nametags = new NameTags(app);
  content.zoneOrder = zones.order;          // để chuyển bản lưu cũ (trước khi có zone_00)
  const progress = new GameState(content);
  const saved = save.load();
  if (saved) progress.fromJSON(saved);
  const ui = { dialogue: new DialogueUI(), app: new MyFptApp(content, progress), minigame: new MinigameHost(content) };
  const game = new Game({ renderer, data: { zones, quests: content.raw.quests, collision, sceneFixes }, characters: new Characters(chars),
    input, settings, nametags, content, progress, ui });
  game.validation = { problems, nodes: nodeCheck };
  ui.minigame.game = game;
  ui.app.game = game;

  const loop = { fps: 0 };
  const menu = new Menu({
    info: () => ({ setting: settings.tier, tier: game.state.tier, gpu: game.gpu, fps: loop.fps }),
    onTier: async (v) => { await game.setTier(v); menu.draw(); },
    onClose: () => game.setMode("play"),
    onPlayAgain: async () => {
      if (await confirmBox(t("menu.play_again_confirm"), t("menu.yes"), t("menu.no"))) { save.clear(); location.reload(); }
    },
  });

  // phím: E tương tác · Space/Enter tiếp lời · 1–4 chọn · Tab app · Esc đóng / menu
  input.on("KeyE", () => game.interact());
  for (const k of ["Space", "Enter", "NumpadEnter"]) input.on(k, () => ui.dialogue.next());
  for (let i = 1; i <= 4; i++) { input.on(`Digit${i}`, () => ui.dialogue.choose(i - 1)); input.on(`Numpad${i}`, () => ui.dialogue.choose(i - 1)); }
  input.on("Tab", () => game.toggleApp());
  // Esc khi đang khoá con trỏ: trình duyệt tự nhả khoá → mở menu ở onUnlock (bỏ qua phím Esc đi kèm nếu có)
  const pause = () => { if (!menu.open) { menu.show(); game.setMode("menu"); } };
  input.onUnlock = () => { if (game.mode === "play" && game.state.phase === "playing") pause(); };
  input.on("Escape", () => {
    if (game.cutscene) return game.cutscene.skip();
    if (input.locked || performance.now() - input.unlockedAt < 300) return;
    if (ui.app.open) return game.toggleApp();
    if (ui.minigame.open) return ui.minigame.close(false);
    if (ui.dialogue.open) return;
    menu.toggle();
    game.setMode(menu.open ? "menu" : "play");
  });

  document.getElementById("skip").textContent = t("cutscene.skip");
  addEventListener("resize", () => game.resize(innerWidth, innerHeight));
  installDebug(game, loop);

  // người chơi mới → màn tạo nhân vật (tạm: tên + vị trí intern)
  if (!progress.created) {
    hud.loading(null);
    const who = await characterCreator(chars.character_creation);
    progress.player.name = who.name;
    progress.player.position = who.position;
    progress.created = true;
    save.store(progress);
    hud.loading(t("app.loading"));
  }
  const startZone = zoneFiles[progress.zone] ? progress.zone : zones.order[0];
  await game.start(startZone);
  if (saved) hud.toast(t("hud.welcome_back", { name: progress.player.name }));
  hud.hint(t("hud.controls"), 10);

  const clock = new THREE.Clock();
  let frames = 0, acc = 0;
  renderer.three.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!menu.open) game.update(dt);
    game.render(dt);
    hud.lockHint(input.lockSupported && input.lookActive && !input.locked && game.state.phase === "playing" ? t("hud.click_to_look") : null);
    frames++; acc += dt;
    if (acc >= 0.5) {
      loop.fps = frames / acc; frames = 0; acc = 0;
      if (debugMode && !problems.length) {
        const i = renderer.info, p = game.player.position;
        hud.debug(`${loop.fps.toFixed(0)} FPS · ${game.state.tier} · ${i.triangles.toLocaleString()} tris · ${i.calls} calls\n${game.state.zone} (${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)})`);
      }
    }
  });
}

boot().catch((e) => { console.error(e); hud.error(e.message); });
