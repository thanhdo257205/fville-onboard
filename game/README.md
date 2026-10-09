# Ngày Đầu Ở F-Ville — game web (vertical slice)

Vite + Three.js 0.186 (đóng gói trong dự án, không dùng CDN), va chạm three-mesh-bvh, font Nunito (đủ dấu tiếng Việt).

```bash
npm install          # cũng chép bộ giải nén Draco vào public/draco
npm run dev          # http://localhost:5180  (thêm ?debug để hiện FPS / vị trí)
npm run build        # dist/ — đóng gói vào ../dist/game bằng python scripts/make_site.py (chưa push khi chưa được đồng ý)
```

Game đọc trực tiếp từ thư mục gốc dự án: `assets/glb/<low|high>/`, `assets/characters/<id>/<id>.glb`, `data/*.json`, `data/i18n/en.json` (mọi chữ hiển thị).

## Cấu trúc
- `src/render/renderer.js` — renderer + chất liệu toon/viền nét/lightmap (đổi sang WebGPU chỉ sửa file này)
- `src/world/` — tải zone, đối tượng game theo tên (SPAWN_/NPC_/INT_/TRIGGER_/COL_), va chạm capsule
- `src/player/` — người chơi (đi/chạy theo hướng camera), camera góc thứ ba không xuyên tường; lúc xuất hiện tự xoay sang hướng thoáng nếu sau lưng bị che (vd xe bus ở zone_01)
- `src/characters/` — nhân vật theo `data/characters.json`, trộn idle/walk/run theo tốc độ; capsule va chạm cho NPC + Tú (không đi xuyên); Tú đứng chếch sau 45°, tránh che giữa camera và người chơi; `tint.js` đổi màu áo/quần từng vai (TẠM, `roles.<vai>.tint`)
- `src/game/game.js` — vòng chơi, chuyển zone qua TRIGGER_ (theo `data/quests.json`), mức đồ hoạ, ánh sáng / sương theo zone (`zones.json` → mood), hội thoại vào zone (on_enter)
- `src/game/cutscene.js` — cảnh chuyển theo `data/cutscenes.json` (hiện có `len_xe`: zone_00 lên xe → zone_01 xuống xe, ~21 s, nút Skip / Esc): xe chạy bằng code dọc `PATH_` (extras.points), cánh cửa xoay quanh bản lề, góc máy `CAM_`
- `src/minigames/` — `host.js` khung chung (một dòng hướng dẫn, sai → gợi ý + làm lại, sau 2 lần sai hiện **Skip** (phím S): vẫn nhận phần thưởng bắt buộc, không cộng Hiểu biết lượt đó; Esc = Not now), `games.js` 5 mini-game giao diện (cài app, kéo nước, quiz, sửa hồ sơ, dòng thời gian — kéo thả chuột hoặc ↑/↓ + Shift), `photo.js` chụp ảnh check-in / ảnh thẻ (tư thế = animation, camera riêng, cắt canvas → JPEG ≤ max_kb lưu vào tiến trình)
- `src/core/sound.js` — chỗ gọi âm thanh `sound.play(tên)`; đường dẫn file để trống (null) trong bảng `SOUNDS`, thêm file là có tiếng
- `src/ui/` — HUD, menu Esc, bảng tên NPC, app My FPT (túi đồ hiện ảnh check-in, thẻ nhân viên có ảnh, số hạt lúa vàng)
- `src/debug.js` — `window.__game` (xem chú thích đầu file)

## Điều khiển (GDD)
WASD / mũi tên: đi · giữ Shift: chạy · chuột: xoay camera (click vào game để khoá con trỏ; hội thoại / app / menu tự hiện lại con trỏ; Esc nhả khoá và mở menu) · lăn chuột: gần/xa · E: tương tác (≤ bán kính đối tượng)
· Space/click: tiếp lời · 1–4: chọn · Tab: App My FPT · Esc: menu (mức đồ hoạ, Chơi lại)

## Nội dung (data/, chữ theo mã ngôn ngữ "en")
- `dialogues.json` cây hội thoại · `quests.json` checklist 12 việc + quest + điều kiện chuyển zone · `interactables.json` đối tượng
  tương tác (radius riêng, area = TRIGGER_, object/actor do code đặt) + mini-game · `quiz.json` · `rewards.json` · `values.json`
- `zones.json` thứ tự zone (bắt đầu ở `zone_00` điểm đón, 06:30) · `cutscenes.json` cảnh chuyển
- `i18n/en.json` chữ giao diện · `characters.json` vai/model/tên (node theo danh sách, Tú chờ ở mái chờ `wait`, đồ cầm tay `carry`, lên xe `board`) · `collision.json`, `scene_fixes.json` chỉnh bối cảnh khi chạy (không sửa GLB)
- Khi tải: kiểm tra mọi node nhắc tới có trong GLB + tham chiếu nội bộ; lỗi in console (và góc màn hình khi `?debug`).
- `draft: true` = chờ HR → game hiện [DRAFT]. Tiến trình lưu `localStorage` (`fville.save.v1`); bản lưu cũ ở zone sau được tính đã xong việc bắt buộc của các zone trước (vd lên xe ở zone_00).
- Hạt lúa vàng: `interactables.json` → `grains` (toạ độ glTF, tự rơi xuống mặt thật), hũ thủy tinh ở Phòng Hạt Lúa hiện số hạt đã nhặt. Sự kiện theo giờ trong zone: `zones.json` → `events` (vd Tú quên balo sau 20 s ở zone_01).
- Thử mini-game: `__game._game.runMinigame(id)`, `__game.mg` (trạng thái), `__game.mgSolve()`, `__game.mgWrong()`, `__game.mgSkip()`, `__game.sounds` (âm thanh đã gọi). Chỉ khi `npm run dev`: `__game.shot(tên.jpg)` / `__game.saveImage(tên, dataURL)` lưu ảnh vào `renders/game/`.
- Thử cảnh chuyển: `__game.playCutscene('len_xe')`, `__game.skipCutscene()`, `__game.holdCutscene(nhịp, giây)` dừng hình để chụp, `__game.cutscene` (nhịp + mốc thời gian).
