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
import { loadSettings, saveSettings } from "./core/quality.js";
import { Characters } from "./characters/characters.js";
import { Game } from "./game/game.js";
import { GameState, save } from "./game/state.js";
import { loadContent, validateNodes, validateLinks } from "./content/content.js";
import { NameTags } from "./ui/nametags.js";
import { Menu } from "./ui/menu.js";
import { DialogueUI } from "./ui/dialogue.js";
import { MyFptApp } from "./ui/app.js";
import { Summary } from "./ui/summary.js";
import { EmotePanel } from "./ui/emotes.js";
import { Net } from "./net/net.js";
import { confirmBox } from "./ui/panels.js";
import { characterCreator } from "./ui/creator.js";
import { MinigameHost } from "./minigames/host.js";
import { hud } from "./ui/hud.js";
import { installDebug } from "./debug.js";
import { buildStartState } from "./game/autoplay.js";

async function boot() {
  await loadStrings("en");
  document.title = t("app.title");
  hud.loading(t("app.loading"));
  const [zones, chars, collision, sceneFixes, content, netCfg, poolCfg] = await Promise.all([
    loadJSON(url("data/zones.json")), loadJSON(url("data/characters.json")),
    loadJSON(url("data/collision.json")), loadJSON(url("data/scene_fixes.json")), loadContent(),
    loadJSON(url("data/net.json")).catch(() => ({ url: "" })),   // chơi nhiều người: thiếu / lỗi file → tắt mạng
    loadJSON(url("data/pool.json")).catch(() => null),            // bàn bi-a zone 5 (thiếu → không có chế độ bi-a)
  ]);
  const params = new URLSearchParams(location.search);
  const debugMode = params.has("debug");
  // tham số thử — khi phát triển, hoặc bản build mở với ?debug (smoke test chạy trên bản build):
  //   ?gender=nu|nam · ?look=intern_nam_kinh (ngoại hình, đặt luôn giới tính) · ?start=zone_05 (bản lưu mẫu)
  //   · ?net=ws://127.0.0.1:8787/ws (máy chủ chơi nhiều người local). ?net=off (tắt mạng) dùng được mọi lúc.
  const testParams = import.meta.env.DEV || debugMode;

  // kiểm tra dữ liệu: tham chiếu nội bộ + mọi node nhắc tới phải có trong GLB của zone (thiếu → báo rõ tên)
  const zoneFiles = Object.fromEntries(zones.order.map((z) => [z, zones.zones[z].file]));
  content.zoneOrder = zones.order;          // để chuyển bản lưu cũ (trước khi có zone_00); kiểm tra guidance theo zone
  const linkErrors = validateLinks(content);
  // đối chiếu node GLB phải tải cả 4 zone (~1 MB, lần lượt) → chỉ chạy khi phát triển; bản build mở game ngay
  const nodeCheck = import.meta.env.DEV ? await validateNodes(content, zoneFiles) : { checked: 0, skipped: 0, missing: [], off: true };
  const problems = [...linkErrors, ...nodeCheck.missing];
  if (problems.length) {
    console.error("[kiểm tra dữ liệu]\n" + problems.join("\n"));
    if (debugMode) hud.debug(`Lỗi dữ liệu (${problems.length}):\n${problems.join("\n")}`);
  } else console.info(`[kiểm tra dữ liệu] OK — ${nodeCheck.off ? "bản build: bỏ đối chiếu node GLB" : `${nodeCheck.checked} tham chiếu node GLB`}, ${content.dialogues.size} hội thoại`);

  const app = document.getElementById("app");
  const renderer = createRenderer(app);
  const input = new Input(renderer.canvas);
  const settings = loadSettings();
  const nametags = new NameTags(app);
  const progress = new GameState(content);
  const saved = save.load();
  if (saved) {
    progress.fromJSON(saved);
    // bản lưu cũ lệch data (zone / quest / phần thưởng / ngoại hình… không còn) → sửa về giá trị hợp lệ gần nhất, ghi lại
    const fixed = progress.repair({ zoneOrder: zones.order, looks: chars.roles.player.looks || {},
      positions: (chars.character_creation?.positions || []).map((x) => x.id) });
    if (fixed.length) { console.warn([`[bản lưu] đã sửa ${fixed.length} chỗ lệch dữ liệu`, ...fixed].join("\n")); save.store(progress); }
  }
  const playAgain = async () => {
    if (await confirmBox(t("menu.play_again_confirm"), t("menu.yes"), t("menu.no"))) { save.clear(); location.reload(); }
  };
  const ui = { dialogue: new DialogueUI(), app: new MyFptApp(content, progress), minigame: new MinigameHost(content),
    summary: new Summary({ onPlayAgain: playAgain }) };
  const characters = new Characters(chars);
  content.names = (role) => characters.displayName(role);   // tên vai cho thông báo (vd lời khuyên của Lan vào Sổ lời khuyên)
  await characters.probe();                 // model chờ người thật đồng ý mà thiếu file → dùng model thay thế
  // giới tính người chơi → model (roles.player.model_by_gender; màn tạo nhân vật có mục giới tính, mặc định nam).
  // Thử: ?gender=nu (hoặc nam) — ghi vào bản lưu; hoặc __game.setGender("nu") lúc đang chơi.
  const gq = testParams && params.get("gender");
  if (gq === "nam" || gq === "nu") { progress.player.gender = gq; if (saved) save.store(progress); }
  // ngoại hình (roles.player.looks, bản lưu player.look; màn tạo nhân vật chưa có mục này): ?look=intern_nam_kinh
  // — đặt luôn giới tính theo model, ghi vào bản lưu; hoặc __game.setLook("intern_nam_kinh") lúc đang chơi
  const lq = testParams && params.get("look");
  if (lq && characters.lookGender(lq)) {
    Object.assign(progress.player, { look: lq, gender: characters.lookGender(lq) });
    if (saved) save.store(progress);
  }
  characters.gender = progress.player.gender || "nam";
  characters.look = progress.player.look || null;
  // bản lưu mẫu: ?start=zone_05 → như đã chơi xong các zone trước (game/autoplay.js → buildStartState, dựng từ data);
  // giữ tên / vị trí / giới tính / ngoại hình, ghi đè phần còn lại của bản lưu
  const sq = testParams && params.get("start");
  if (sq && zoneFiles[sq]) {
    const player = { ...progress.player }, created = progress.created;
    progress.reset();
    Object.assign(progress.player, player);
    progress.created = created;
    const { problems: sp } = buildStartState(content, zones, sq, progress);
    if (sp.length) console.warn(`[bản lưu mẫu]\n${sp.join("\n")}`);
    if (created) save.store(progress);
  }
  const game = new Game({ renderer, data: { zones, quests: content.raw.quests, collision, sceneFixes, pool: poolCfg }, characters,
    input, settings, nametags, content, progress, ui });
  game.validation = { problems, nodes: nodeCheck };
  // chơi nhiều người "thấy nhau" (data/net.json → url trống = tắt, game y như chơi một mình). ?net=off: tắt (smoke test,
  // không đụng máy chủ thật); ?net=ws://127.0.0.1:8787/ws: máy chủ local (tham số thử)
  const netUrl = params.get("net");
  if (netUrl === "off") netCfg.url = "";
  else if (netUrl && testParams) netCfg.url = netUrl;
  const net = new Net({ game, cfg: netCfg, settings });
  game.net = net;
  const emotes = net.enabled ? new EmotePanel(net) : null;
  ui.minigame.game = game;
  ui.app.game = game;

  // zone đầu + GLB nhân vật + bộ giải nén tải trong lúc người chơi điền tên (không chờ ở đây).
  // Đã xong game (cờ game_complete, kể cả khi tải lại giữa cảnh kết) → bến xe zone_01 lúc hoàng hôn, cạnh cửa xe: trạng
  // thái cuối của cảnh kết (cutscenes.json → ending.bus_stop)
  const endAt = progress.flags.has("game_complete") ? content.cutscenes?.ending?.bus_stop : null;
  const startZone = endAt && zoneFiles[endAt.zone] ? endAt.zone : zoneFiles[progress.zone] ? progress.zone : zones.order[0];
  const startSpawn = endAt && startZone === endAt.zone ? endAt.spawn : null;
  game.preload(startZone);

  const loop = { fps: 0 };
  const menu = new Menu({
    info: () => ({ setting: settings.tier, tier: game.state.tier, gpu: game.gpu, fps: loop.fps, guide: settings.guide !== false,
      detail: settings.detail ?? "auto", detailLevel: renderer.detail, net: net.enabled, players: settings.players !== false,
      complete: game.complete }),
    onTier: async (v) => { await game.setTier(v); menu.draw(); },
    onDetail: (v) => { game.setDetail(v); menu.draw(); },
    onGuide: (on) => { settings.guide = on; saveSettings(settings); menu.draw(); },
    onPlayers: (on) => { settings.players = on; saveSettings(settings); net.setShow(on); menu.draw(); },
    onSummary: () => { menu.hide(true); game.openSummary(); },   // chỉ hiện khi đã xong game
    onClose: () => game.setMode("play"),
    onPlayAgain: playAgain,
  });

  // phím: E tương tác · Space/Enter tiếp lời · 1–4 chọn (bảng emote đang mở: 1–9 chọn emote / câu chat) · Tab app
  // · H gợi ý · T emote + câu chat (chỉ khi bật mạng) · Esc đóng / menu
  input.on("KeyE", () => game.interact());
  input.on("KeyH", () => game.help());
  for (const k of ["Space", "Enter", "NumpadEnter"]) input.on(k, () => ui.dialogue.next());
  const digit = (i) => () => { if (emotes?.open) emotes.pick(i - 1); else if (i <= 4) ui.dialogue.choose(i - 1); };
  for (let i = 1; i <= 9; i++) { input.on(`Digit${i}`, digit(i)); input.on(`Numpad${i}`, digit(i)); }
  if (emotes) input.on("KeyT", () => {
    if (game.mode !== "play" || game.state.phase !== "playing") return;
    if (!net.connected) { emotes.hide(); hud.toast(t("net.offline")); return; }
    emotes.toggle();
  });
  input.on("Tab", () => game.toggleApp());
  // Esc khi đang khoá con trỏ: trình duyệt tự nhả khoá → mở menu ở onUnlock (bỏ qua phím Esc đi kèm nếu có)
  const pause = () => { if (!menu.open) { menu.show(); game.setMode("menu"); } };
  // Esc khi đang khoá con trỏ ở bàn bi-a (chơi một mình): trình duyệt tự nhả khoá → rời bàn
  input.onUnlock = () => {
    if (game.mode === "pool") return game.pool?.leave();
    if (game.mode === "play" && game.state.phase === "playing") pause();
  };
  input.on("KeyR", () => { if (game.pool?.active) game.pool.rerack(); });   // bi-a: xếp lại bi
  input.on("Escape", () => {
    if (game.cutscene) return game.cutscene.skip();
    if (game.timeSkipping) return;            // màn mờ chuyển giờ (vd "12:00 · lunch"): không mở menu giữa chừng
    if (game.mode === "pool") return game.pool?.leave();
    if (input.locked || performance.now() - input.unlockedAt < 300) return;
    if (ui.summary.open) return ui.summary.hide();
    if (ui.app.open) return game.toggleApp();
    if (ui.minigame.open) return ui.minigame.close(false);
    if (ui.dialogue.open) return;
    menu.toggle();
    game.setMode(menu.open ? "menu" : "play");
  });

  document.getElementById("skip").textContent = t("cutscene.skip");
  addEventListener("resize", () => game.resize(innerWidth, innerHeight));
  installDebug(game, loop);

  // người chơi mới → màn tạo nhân vật: chọn nhân vật (giới tính suy ra từ nhân vật), tên, vị trí intern
  if (!progress.created) {
    hud.loading(null);
    const who = await characterCreator(chars.character_creation, { characters, settings, initial: progress.player.look });
    progress.player.name = who.name;
    progress.player.position = who.position;
    if (who.gender) { progress.player.gender = who.gender; characters.gender = who.gender; }
    if (who.look) { progress.player.look = who.look; characters.look = who.look; }
    progress.created = true;
    save.store(progress);
    hud.loading(t("app.loading"));
  }
  await game.start(startZone, startSpawn);
  net.start();                              // sau "Start my first day" (người chơi cũ: khi game bắt đầu)
  addEventListener("pagehide", () => net.stop());
  if (saved) hud.toast(t("hud.welcome_back", { name: progress.player.name }));
  game.resumeSummary();                     // đã xong game mà chưa thấy màn tổng kết (tải lại giữa cảnh kết) → mở lại
  hud.hint(t(net.enabled ? "hud.controls_net" : "hud.controls"), 10);

  // THREE.Timer (thay THREE.Clock đã bị bỏ): connect(document) → tab ẩn thì dt = 0, quay lại không nhảy cóc
  const timer = new THREE.Timer();
  timer.connect(document);
  let frames = 0, acc = 0, netErr = null;
  renderer.three.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.1);
    if (!menu.open) game.update(dt);
    // người chơi khác vẫn đi lại khi mở menu. Lỗi phần mạng không được dừng vòng lặp game (ghi console, mỗi lỗi 1 lần)
    try { net.update(dt); } catch (e) { if (netErr !== e.message) { netErr = e.message; console.error("[mạng]", e); } }
    if (emotes?.open && game.mode !== "play") emotes.hide();
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
