# CLAUDE.md — Ngày Đầu Ở F-Ville (First Day at F-Ville)

Game web 3D về ngày onboarding đầu tiên của intern FPT Software tại campus F-Ville 1 (Hòa Lạc). Bối cảnh low-poly hoạt
hình dựng bằng script Python trong Blender, xuất GLB; game chạy trên trình duyệt bằng Vite + three.js.

- Repo công khai `thanhdo257205/fville-onboard`: nhánh **main** = mã nguồn, nhánh **gh-pages** = bản build cho GitHub Pages.
- Bản chơi: https://thanhdo257205.github.io/fville-onboard/game/ · xem bối cảnh: `/viewer/`
- Thiết kế: `docs/GDD.md` · tiến độ: `docs/PROGRESS.md` · lời thoại: `docs/dialogue_huyen.md` (Ms. Huyền),
  `docs/dialogue_nga.md` (Ms. Nga)

## Cấu trúc thư mục

| Đường dẫn | Nội dung |
| --- | --- |
| `scripts/blender/zone_00.py` … `zone_05.py` | Dựng từng zone (chạy trong Blender không giao diện) |
| `scripts/blender/lib/` | Thư viện dựng chung: kit modular, chất liệu, bảng màu, đồ vật, nội thất, phố, marker đối tượng game, lightmap, render |
| `scripts/blender/characters/` | Pipeline nhân vật: `prepare_for_mixamo.py`, `build_character.py`, `apply_chest_logo.py`, `outfit_textures.py` (mặt nạ vùng + bộ texture trang phục; `--glasses`: vùng kính), `render_portrait.py`, `texture_fix.py`, `char_render.py`, `char_data.py` (ghi `models.<id>` vào `data/characters.json` mà không định dạng lại cả file) |
| `scripts/blender/lib/cuder.py`, `scripts/blender/props/cuder_preview.py` | Tượng Cuder zone 2 từ mô hình Meshy (zone_02.py gọi khi build); xem trước riêng tượng |
| `scripts/blender/lib/pool_table.py` | Bàn bi-a zone 5 từ mô hình Sketchfab (zone_05.py gọi khi build): bỏ đèn treo, gộp texture, giảm lưới, đo mặt chơi / lỗ / bi → `data/pool.json` |
| `scripts/build.py` | Build trọn gói zone (Blender → nén Draco → kiểm tra GLB → ảnh so sánh) |
| `scripts/make_site.py`, `scripts/deploy_site.py` | Gom bản web vào `dist/` và đưa lên nhánh gh-pages |
| `scripts/tools/` | Công cụ phụ: cắt khung video, ảnh so sánh, bảng animation, kiểm tra GLB, `privacy_scan.py` |
| `scripts/tests/` | Kiểm thử tự động: `data.mjs` (`npm run test:data`), `smoke.mjs` (`npm run test:smoke`); ảnh bước hỏng vào `test-results/` (không commit). CI: `.github/workflows/test.yml` |
| `assets/glb/low/`, `assets/glb/high/` | GLB bối cảnh 2 mức đồ họa (game chỉ dùng **low**) |
| `assets/characters/<id>/` | GLB nhân vật, chân dung (`<id>_portrait.png`, theo bộ đồ `<id>_portrait_<bộ>.png`), texture bộ đồ `<id>_<bộ>.webp` (vd `intern_nam_dau_ngay.webp`, `intern_nu_tu_dau_ngay.webp`), cấu hình (`chest_logo.json`, `texture_fixes.json`, `mesh_fixes.json` (rút ngắn lọn tóc trước khi giảm tam giác), `mixamo/actions.json`) |
| `scripts/blender/accessories/build_cap.py` | Mũ lưỡi trai (phụ kiện tủ đồ): dựng lưới thấp bám mô hình Meshy + texture 512 vẽ bằng code → `assets/accessories/cap/cap.glb`, `cap.json` |
| `assets/accessories/<id>/` | Phụ kiện (GLB + số đo `<id>.json`); `source/`: mô hình Meshy gốc, logo gốc — chỉ có trên máy làm việc |
| `assets/props/<id>/source/` | Mô hình gốc của đồ vật (vd `cuder/source/cuder_meshy.glb`, `pool_table/source/pool_table_traditional.glb`) — chỉ có trên máy làm việc, build zone đọc từ đây |
| `assets/textures/` | Texture lặp cho bối cảnh (`assets/logos/`: logo để dán vào áo — chỉ có trên máy làm việc) |
| `data/` | Toàn bộ nội dung game dạng JSON: hội thoại, nhiệm vụ, vật tương tác, mini-game, quiz, phần thưởng, giá trị, zone, cảnh chuyển, nhân vật, va chạm bổ sung, hướng dẫn người chơi mới (`guidance.json`: gợi ý phím H, câu nhắc khi đứng yên), 4 Act (`acts.json`), thành tựu cuối + danh hiệu (`achievements.json`), chơi nhiều người (`net.json`), số đo bàn bi-a zone 5 (`pool.json`, build zone_05 ghi lại) |
| `data/i18n/en.json` | Mọi chữ giao diện (tiếng Anh) |
| `game/` | Game web (Vite). `game/src/`: `world/` (tải zone, va chạm), `player/`, `characters/`, `game/` (vòng chơi, tương tác, cảnh chuyển), `minigames/`, `ui/`, `render/`, `net/` (chơi nhiều người), `pool/` (bi-a zone 5: `physics.js` vật lý tất định, `table.js` chế độ chơi), `debug.js` |
| `server/` | Máy chủ chơi nhiều người "thấy nhau": Cloudflare Worker + 1 Durable Object (`wrangler.toml`, `src/index.js`); bật bằng `data/net.json` → `url` (trống = tắt). Đã lên mạng: `https://fville-net.fville-onboard.workers.dev` (`/status`). Xem `docs/multiplayer.md` |
| `viewer/index.html` | Trang xem bối cảnh + nhân vật (`?zone=zone_03_lobby&compare=prajith,huyen`; id vai cũng được: `compare=thao,le_tan,prajith` → kèm tint, tên vai) |
| `references/` | Chỉ có ghi chú `.md` và bảng màu trên repo; video, khung hình gốc chỉ có trên máy làm việc |
| `dist/` | **git worktree của nhánh gh-pages** (không thuộc nhánh main) |
| `renders/`, `assets/blend/`, `tools/bin/` | Chỉ có trên máy làm việc (bị .gitignore) |

## Quy ước đặt tên đối tượng trong GLB

| Tiền tố | Ý nghĩa |
| --- | --- |
| `COL_` | Hộp/mesh va chạm (ẩn khi chơi) |
| `INT_` | Điểm tương tác (custom property `label` tiếng Việt) |
| `NPC_` | Vị trí NPC (`label`, `yaw_deg`; 0 = nhìn −Z); vai gán trong `data/characters.json` |
| `SPAWN_` | Điểm xuất hiện (`SPAWN_<zone>_start`, …) |
| `TRIGGER_` | Vùng kích hoạt (chuyển zone, nhắc nhở, vùng tương tác) |
| `PATH_` | Đường cong cho xe chạy trong cảnh chuyển (extras.points, toạ độ glTF) |
| `CAM_` | Góc máy cảnh chuyển (extras target / fov_deg / track) |
| `ENV_` | Hình khối bối cảnh |

Đơn vị 1 = 1 m; Blender trục Z lên, glTF/three.js trục Y lên. Custom property `dynamic` = loại khỏi AO/lightmap.

## Lệnh thường dùng

```bash
# Bối cảnh (cần Blender 5.2 + gltf-transform): mặc định chỉ dựng bản Thấp
python scripts/build.py zone_02 [zone_03 ...] [--tier low|high|both]

# Game chạy local (game/.npmrc ép registry.npmjs.org; package-lock.json chỉ trỏ npmjs)
npm --prefix game ci
npm --prefix game run dev            # http://localhost:5180  (?debug: FPS, vị trí)

# Kiểm thử (chạy sau MỖI thay đổi — xem "Kiểm thử" dưới)
npm --prefix game run test:data      # dữ liệu: JSON, tham chiếu, node GLB, bản lưu mẫu, chữ i18n, model (~0,1 giây)
npm --prefix game run test:pool      # vật lý bi-a: 1.000 cú phá bi, không NaN / chồng bi / ra ngoài bàn, tất định (~3 giây)
npm --prefix game run test:smoke     # chơi tự động zone 0 → 5 tới màn tổng kết, 3 ngoại hình (~4 phút; tự bật Vite dev)
npm --prefix game run test:smoke -- --zone 5               # chỉ 1 zone (bản lưu mẫu ?start=zone_05), ~50 giây mỗi ngoại hình
npm --prefix game run test:smoke -- --look intern_nu       # 1 ngoại hình · --build: chạy trên game/dist (sau npm run build)
npm --prefix game run test:smoke -- --extra only           # chỉ bản lưu cũ + zone 4 có người chơi khác (máy chủ local), ~15 giây

# Viewer bối cảnh
python -m http.server 8765           # ở thư mục gốc, mở http://localhost:8765/viewer/

# Nhân vật (cần Blender + file riêng trên máy làm việc)
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/prepare_for_mixamo.py -- --id <id> --height 1.60 --tris 25000 [--protect-face] [--protect-logo]
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/apply_chest_logo.py -- --id <id> [--logo <png>] [--compare prajith]
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/outfit_textures.py -- --id <id> [--shirt cfe0ee] [--outfit tu_dau_ngay] [--glasses]   # sau apply_chest_logo
#   áo gốc Meshy là bộ ngày đầu (intern_nam_kinh): outfit_textures.py -- --id <id> --original dau_ngay --glasses --no-render
#   → apply_chest_logo.py (dán lên bản áo cam) → outfit_textures.py lại (render); xem đầu outfit_textures.py
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/build_character.py -- --id <id> --height 1.60 --tris 6000 --single [--decimate-only]
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/render_portrait.py -- --id <id> [--outfit dau_ngay]   # chân dung theo bộ đồ
python scripts/tools/anim_sheet.py <id>

# Đo hiệu năng bản build với độ trễ mạng giả lập (~GitHub Pages): xem docs/perf_report.md
python scripts/tools/slow_server.py --dir game/dist --port 8772 --delay 0.3

# Chơi nhiều người: máy chủ chạy thử trên máy (không cần tài khoản), game dev nhận ?net=ws://127.0.0.1:8787/ws
npm --prefix server ci && npm --prefix server run dev
node scripts/tools/net_bots.js --url ws://127.0.0.1:8787/ws --bots 20 --seconds 60   # đo tải, ước tính request Cloudflare
# đưa máy chủ lên Cloudflare (cần wrangler login, chỉ máy Desktop): docs/multiplayer.md

# Deploy GitHub Pages (chỉ khi người dùng đồng ý)
python scripts/deploy_site.py        # build → quét riêng tư → commit → push gh-pages
python scripts/tools/privacy_scan.py # quét nhánh main trước khi commit
```

Thử game không cần chuột/rAF: `window.__game` (xem đầu `game/src/debug.js`): `step()` (làm mục tiêu hiện tại: dịch chuyển
tới đích, bấm E, tự giải hội thoại / mini-game / cảnh chuyển — smoke test dùng), `approach`, `resolve`, `simulate`, `walkTo`, `route`, `goto`,
`talk`, `interact`, `mg` / `mgSolve` / `mgSkip`, `playCutscene`, `guide` / `help()` (dấu "!", mũi tên, các lần nhắc),
`acts` / `cards` (4 Act, thẻ giữa màn hình), `finish()` / `summary` (thành tựu cuối + màn tổng kết),
`net` / `netEmote(id)` / `netPhrase(id)` (chơi nhiều người), `pool` (bàn bi-a zone 5: `enter()`, `shoot(angle, power)` → Promise khi bi dừng, `leave()`, `rerack()`, `solve()`), `ending` (nhịp cảnh kết), `summaryCard()` (thẻ PNG của màn tổng kết),
`shot(name)` (chỉ dev: lưu ảnh vào `renders/game/`), `benchmark(120)` (ms/khung, quay camera 1 vòng). Độ nét:
`_game.renderer.setDetail(0|1|2)`, `state.detailLevel` (nấc Auto đã tự hạ).
Khung trình duyệt bị ẩn thì requestAnimationFrame dừng — lái game bằng `__game._game.update(1/30)`.
Tham số URL để thử (khi dev, hoặc bản build mở với `?debug`): `?start=zone_05` (bản lưu mẫu "đã chơi xong các zone trước",
dựng từ data: `game/src/game/autoplay.js`), `?look=intern_nam_kinh`, `?gender=nu`, `?net=ws://127.0.0.1:8787/ws`;
`?net=off` (tắt mạng) dùng được mọi lúc.

## Bắt đầu từ bản clone mới (Claude Code Web hoặc máy khác)

```bash
git clone https://github.com/thanhdo257205/fville-onboard.git
cd fville-onboard
git config user.name "$(git log -1 --format=%an)"    # repo công khai: commit bằng danh tính noreply
git config user.email "$(git log -1 --format=%ae)"   # của GitHub, lấy từ commit gần nhất trên main
git worktree add dist gh-pages        # dist/ = bản build (nhánh gh-pages), cần cho deploy
cd game && npm ci                     # tải từ registry.npmjs.org (game/.npmrc), chép bộ giải nén Draco vào public/draco
npm run dev                           # http://localhost:5180 — đọc thẳng ../assets và ../data của repo
npm run build                         # kiểm tra build (ra game/dist)
npm run test:data && npm run test:smoke   # kiểm thử (máy cloud có sẵn Chromium; máy khác: npx playwright install chromium)
cd .. && python scripts/deploy_site.py   # build → quét riêng tư → commit → push gh-pages (chỉ khi người dùng đồng ý)
```

Cần Node.js 20+ (đang dùng 24), Python 3 (deploy_site.py, make_site.py, privacy_scan.py chỉ dùng thư viện chuẩn), git.
`deploy_site.py` từ chối commit nếu `git config user.email` không phải email noreply — đặt 2 dòng `git config` ở trên
trước. `python -m http.server 8765` ở thư mục gốc để mở viewer (`/viewer/`).

**Làm được khi không có Blender:**
- Chạy game và viewer; thử game bằng `window.__game` (xem dưới).
- Sửa code game (`game/src/`), dữ liệu và lời thoại (`data/*.json`), chữ giao diện (`data/i18n/en.json`), va chạm bổ sung
  (`data/collision.json`), vật do code đặt (`data/interactables.json`), vai và tên nhân vật (`data/characters.json`).
- Sửa viewer, tài liệu (`docs/`, `CLAUDE.md`), script Python không dùng Blender.
- Build và deploy bản web (`npm run build`, `scripts/deploy_site.py`), quét riêng tư.

**Không làm được khi không có Blender** (cần máy làm việc gốc):
- Dựng lại hoặc sửa hình khối bối cảnh (`scripts/build.py`, `scripts/blender/`), nướng lightmap, ảnh so sánh với tham
  chiếu (video/khung hình gốc không có trên repo).
- Mọi bước của pipeline nhân vật: chuẩn bị cho Mixamo, ghép animation, giảm tam giác, dán logo, chân dung — cần
  `source/`, `mixamo/*.fbx`, `textures/`, file `.blend` (không có trên repo). GLB nhân vật trên repo chỉ để dùng.
- Render ảnh kiểm tra bằng Blender, bảng animation.

## Quy tắc đã chốt

- **Chữ trong game là tiếng Anh**, nằm hết trong `data/i18n/en.json` hoặc trường `{ "en": … }` của dữ liệu; tên riêng
  giữ dấu tiếng Việt (Tú, Huyền, F-Ville, Hòa Lạc). Không viết chữ hiển thị cứng trong code.
- **Chỉ dùng đồ họa Thấp** (bản Cao có lightmap đang tạm dừng; nhân vật huyen chỉ có bản 6k). Game khoá cứng:
  `game/src/core/quality.js` → `TIERS = ["low"]` (máy card rời / cài đặt cũ "high" vẫn chạy bản Thấp, menu ẩn nút High,
  bản build không chép `assets/glb/high/`). GLB bản Cao cũ thiếu node mới (vd `SPAWN_zone_04_from_zone_03`) → từng làm kẹt
  zone 4 trên trang thật (10/10/2026). Chỉ bật lại khi đã build lại đủ mọi zone bản Cao.
- **Tải zone không bao giờ được treo im lặng:** `Game.enterZone` bọc `_enterZone` — lỗi hoặc quá 20 s (`ZONE_TIMEOUT_MS`)
  → `console.error` + hộp lỗi trên màn tải (nút Retry, Back to <zone trước> / Reload page; `hud.zoneError`), trả `false`
  thay vì ném lỗi. Thiếu SPAWN_ → xuất hiện ở `start` của zone hoặc SPAWN_ đầu tiên (kèm cảnh báo console). Người chơi
  khác (mạng) chỉ dựng sau khi zone xong (`phase === "playing"`); lỗi mạng trong vòng lặp chỉ log, không dừng game.
- **Bản lưu cũ lệch data** tự sửa khi nạp (`GameState.repair`, gọi trong `main.js`): bỏ quest / phần thưởng / vật / giá
  trị / hạt lúa / lời khuyên không còn, zone không còn → zone xa nhất đã mở, giới tính / ngoại hình / vị trí về giá trị
  hợp lệ; in `[bản lưu] đã sửa N chỗ` (cảnh báo console) rồi ghi lại. Thêm / đổi id trong data thì nghĩ tới bản lưu cũ.
- **Bản build gắn mã build** vào `data/*.json` và GLB (`?v=<git hash>-<thời gian>`, `__BUILD_ID__` trong
  `vite.config.js`, `url()` của `game/src/core/fetch.js`) → deploy mới không bị bộ nhớ đệm trình duyệt / CDN trả file cũ.
- **Không sửa GLB bối cảnh từ code game.** Thiếu/sai đối tượng thì chỉnh bằng dữ liệu (`data/collision.json`: bỏ/thêm hộp
  va chạm; `data/scene_fixes.json`: chỉnh khi chạy, cửa mở được `doors`; `data/zones.json` → `spawn_offset`: dời chỗ
  xuất hiện; vật do code đặt trong `data/interactables.json`) và ghi vào báo cáo. Sửa bối cảnh
  thật thì sửa script Blender rồi build lại zone (cần người dùng đồng ý).
- Nội dung chờ HR có `"draft": true` → game hiện **[DRAFT]**. Danh sách: `docs/PROGRESS.md`.
- Vai nhân vật: id vai trong dữ liệu giữ nguyên (vd vai `thao` hiển thị là **Ms. Huyền**, model `huyen`; vai `le_tan`
  là **Ms. Nga**, model `nga`, kèm người nói `hr` của tin nhắn điện thoại). Vai `player` chọn model theo giới tính
  (`roles.player.model_by_gender`: nam → `intern_nam`, nu → `intern_nu`; bản lưu `player.gender`, mặc định nam; thử khi dev:
  `?gender=nu` hoặc `__game.setGender("nu")`; ngoại hình khác cùng giới tính: `roles.player.looks`, bản lưu `player.look`, dev
  `?look=intern_nam_kinh` hoặc `__game.setLook(...)`; màn tạo nhân vật `game/src/ui/creator.js` chọn ngoại hình theo
  `character_creation.looks`); bộ đồ đổi bằng texture (`dau_ngay` → texture trong GLB khi nhận Áo Cam), chân dung theo bộ đồ
  (`models.<id>.outfit_portraits`). **Tú khác giới với người chơi** (`roles.tu.model_by_gender`: nam → `intern_nu`, nữ →
  `intern_nam_kinh`; áo ngày đầu `outfit.texture_by_model`); mọi chữ nói về Tú dùng `{tu_he}` `{tu_his}` `{tu_him}`
  `{tu_himself}` (`{Tu_he}`… đầu câu), không viết cứng he/his/him — `test:data` kiểm tra. Lời thoại
  nhân vật dựa trên người thật (Ms. Huyền, Ms. Nga, Prajith): tự viết chi tiết cá nhân, giữ nhẹ nhàng, thân thiện, không nói chuyện
  sức khỏe, gia đình, tiền bạc hay điều làm họ trông thiếu chuyên nghiệp.
- Làm theo đợt và **dừng lại báo cáo** sau mỗi đợt; báo cáo bằng tiếng Việt.
- File chữ tiếng Việt: sửa bằng Edit hoặc Python (UTF-8). Không dùng PowerShell `Get-Content`/`Set-Content` để ghi lại.

## Kiểm thử

- **Sau mỗi thay đổi** chạy `npm --prefix game run test:data` và `npm --prefix game run test:smoke` (hoặc
  `-- --zone N` cho zone vừa sửa); sửa vật lý bi-a (`game/src/pool/physics.js`) thì chạy thêm `test:pool`. Kết quả in gọn: mỗi bước 1 dòng ✓/✗, dòng cuối tổng kết + thời gian; bước hỏng có ảnh
  trong `test-results/`. Smoke test luôn tắt mạng (`?net=off`) — không đụng máy chủ chơi nhiều người thật — trừ test
  "mạng + zone 4" dùng máy chủ local (`server/`, wrangler dev, cần `npm --prefix server ci`; chưa cài thì bỏ qua).
- Sau phần chơi theo ngoại hình, smoke chạy thêm 2 test (`--extra off` bỏ, `--extra only` chỉ chạy 2 test này, ~15 giây):
  bản lưu cũ lệch data (`scripts/tests/fixtures/old_save.json`, ẩn danh) → sửa, vào zone_04, tải lại trang, GLB hỏng →
  bảng lỗi + bấm Back; vào zone_04 khi có bot chờ sẵn (khởi động thẳng + đi qua cổng từ zone_03, phải xong trong 20 s,
  thấy bot). Cả hai đặt sẵn cài đặt cũ tier "high". `test:data` cũng thử `repair()` trên file đó và kiểm tra `start` của mọi zone có trong GLB bản Thấp.
- Chỉ tự lái trình duyệt (Playwright tự viết, chụp ảnh) khi cần **xem bằng mắt** phần mới; tối đa 3 ảnh mỗi lần.
- Thêm nội dung mới (quest, hội thoại, mini-game): smoke test tự chơi theo `guide.current()` + `__game.step()` — lựa chọn
  hội thoại theo `autoplay.pickChoice` (câu có giá trị > câu dẫn tới việc đang làm > câu đầu), mini-game cần
  `ctx.debug.solve()`. Kiểm tra riêng phần mới thì thêm vào `scripts/tests/smoke.mjs`.
- Vật lý bi-a phải **tất định** (bước 3 chơi nhiều người cần): chỉ + − × ÷, `Math.sqrt` (và abs / min / max / floor), không
  `Math.sin` / `cos` / `atan2` / `hypot` / `pow` trong `physics.js` — dùng `dsin` / `dcos` / `datan2` của file đó.
- GitHub Actions (`.github/workflows/test.yml`): mỗi lần push main chạy test:data + test:pool + build + test:smoke 1 ngoại hình;
  chạy tay (Run workflow) thì cả 3 ngoại hình. Đỏ → xem log + artifact `test-results`.

## Riêng tư và bản quyền (repo công khai)

- KHÔNG BAO GIỜ đưa lên: FBX gốc Mixamo (`mixamo/*.fbx`, điều khoản Mixamo không cho phát tán animation thô), file
  `.blend`, `source/` (file Meshy gốc), texture nhân vật, file logo gốc (`assets/logos/`, logo chỉ nằm trong texture), video/ảnh/khung hình trong `references/` (có khung chụp thẻ nhân
  viên ghi họ tên: `VanPhongLamViec/t_0008.0.jpg`, `t_0010.0.jpg`, `contact_01.jpg`), `renders/`, `tools/bin/`.
- **Người thật trong game đã đồng ý dùng hình — tất cả, kể cả nhân vật thêm sau này** (người dùng xác nhận
  09/10/2026): GLB và chân dung của mọi nhân vật được commit và deploy như bình thường, không cần chặn chờ đồng ý.
  Cơ chế `models.<id>.consent_pending` + `fallback` vẫn còn trong code (game, viewer, `vite.config.js`, `make_site.py`,
  `privacy_scan.py`) nhưng hiện không model nào dùng. Các quy tắc ở dòng trên vẫn giữ: không commit ảnh gốc của người
  thật, file Meshy gốc, FBX Mixamo, `.blend`, video/ảnh tham chiếu.
- Không đưa email, đường dẫn máy cá nhân, token vào file. Ảnh render từ Blender: `char_render.preview_setup()` đã tắt
  metadata (trước đây Blender ghi đường dẫn file vào PNG). Chạy `python scripts/tools/privacy_scan.py` trước khi commit;
  không file nào trên 20 MB.
- Commit bằng danh tính noreply đã cấu hình trong repo (`git config user.email` = `…@users.noreply.github.com`).
- Nhánh **main**: cuối mỗi lần làm việc cập nhật `docs/PROGRESS.md`, commit và push. Nhánh **gh-pages** (deploy bản
  web): chỉ push khi người dùng đồng ý.

## Việc chỉ làm được trên máy có Blender (máy làm việc gốc)

- Dựng/sửa bối cảnh: `scripts/build.py` (Blender 5.2 qua `tools/bin/blender.cmd`, `gltf-transform` CLI, Pillow, numpy);
  zone_02 cần thêm mô hình tượng Cuder gốc `assets/props/cuder/source/cuder_meshy.glb`, zone_05 cần bàn bi-a gốc
  `assets/props/pool_table/source/pool_table_traditional.glb` (Sketchfab, fizyman, CC BY 4.0; thiếu thì build báo lỗi).
- Lightmap bản Cao, ảnh so sánh với tham chiếu (cần `references/` gốc).
- Toàn bộ pipeline nhân vật: cần `assets/characters/<id>/source/`, `mixamo/*.fbx`, `textures/`, các file `.blend`
  (không có trên repo).
- Render ảnh kiểm tra, chân dung, bảng animation.

Máy không có Blender: xem mục "Bắt đầu từ bản clone mới" ở trên.
