# CLAUDE.md — Ngày Đầu Ở F-Ville (First Day at F-Ville)

Game web 3D về ngày onboarding đầu tiên của intern FPT Software tại campus F-Ville 1 (Hòa Lạc). Bối cảnh low-poly hoạt
hình dựng bằng script Python trong Blender, xuất GLB; game chạy trên trình duyệt bằng Vite + three.js.

- Repo công khai `thanhdo257205/fville-onboard`: nhánh **main** = mã nguồn, nhánh **gh-pages** = bản build cho GitHub Pages.
- Bản chơi: https://thanhdo257205.github.io/fville-onboard/game/ · xem bối cảnh: `/viewer/`
- Thiết kế: `docs/GDD.md` · tiến độ: `docs/PROGRESS.md` · lời thoại Ms. Huyền: `docs/dialogue_huyen.md`

## Cấu trúc thư mục

| Đường dẫn | Nội dung |
| --- | --- |
| `scripts/blender/zone_00.py` … `zone_05.py` | Dựng từng zone (chạy trong Blender không giao diện) |
| `scripts/blender/lib/` | Thư viện dựng chung: kit modular, chất liệu, bảng màu, đồ vật, nội thất, phố, marker đối tượng game, lightmap, render |
| `scripts/blender/characters/` | Pipeline nhân vật: `prepare_for_mixamo.py`, `build_character.py`, `apply_chest_logo.py`, `render_portrait.py`, `texture_fix.py`, `char_render.py` |
| `scripts/build.py` | Build trọn gói zone (Blender → nén Draco → kiểm tra GLB → ảnh so sánh) |
| `scripts/make_site.py`, `scripts/deploy_site.py` | Gom bản web vào `dist/` và đưa lên nhánh gh-pages |
| `scripts/tools/` | Công cụ phụ: cắt khung video, ảnh so sánh, bảng animation, kiểm tra GLB, `privacy_scan.py` |
| `assets/glb/low/`, `assets/glb/high/` | GLB bối cảnh 2 mức đồ họa (game chỉ dùng **low**) |
| `assets/characters/<id>/` | GLB nhân vật, chân dung, cấu hình (`chest_logo.json`, `texture_fixes.json`, `mixamo/actions.json`) |
| `assets/textures/`, `assets/logos/` | Texture lặp cho bối cảnh, logo |
| `data/` | Toàn bộ nội dung game dạng JSON: hội thoại, nhiệm vụ, vật tương tác, mini-game, quiz, phần thưởng, giá trị, zone, cảnh chuyển, nhân vật, va chạm bổ sung |
| `data/i18n/en.json` | Mọi chữ giao diện (tiếng Anh) |
| `game/` | Game web (Vite). `game/src/`: `world/` (tải zone, va chạm), `player/`, `characters/`, `game/` (vòng chơi, tương tác, cảnh chuyển), `minigames/`, `ui/`, `render/`, `debug.js` |
| `viewer/index.html` | Trang xem bối cảnh + nhân vật (`?zone=zone_03_lobby&compare=prajith,huyen`) |
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

# Game chạy local
npm --prefix game install
npm --prefix game run dev            # http://localhost:5180  (?debug: FPS, vị trí)

# Viewer bối cảnh
python -m http.server 8765           # ở thư mục gốc, mở http://localhost:8765/viewer/

# Nhân vật (cần Blender + file riêng trên máy làm việc)
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/prepare_for_mixamo.py -- --id <id> --height 1.60 --tris 25000
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/apply_chest_logo.py -- --id <id> [--logo <png>] [--compare prajith]
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/build_character.py -- --id <id> --height 1.60 --tris 6000 --single
tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/render_portrait.py -- --id <id>
python scripts/tools/anim_sheet.py <id>

# Deploy GitHub Pages (chỉ khi người dùng đồng ý)
python scripts/deploy_site.py        # build → quét riêng tư → commit → push gh-pages
python scripts/tools/privacy_scan.py # quét nhánh main trước khi commit
```

Thử game không cần chuột/rAF: `window.__game` (xem đầu `game/src/debug.js`): `simulate`, `walkTo`, `route`, `goto`,
`talk`, `interact`, `mg` / `mgSolve` / `mgSkip`, `playCutscene`, `shot(name)` (chỉ dev: lưu ảnh vào `renders/game/`).
Khung trình duyệt bị ẩn thì requestAnimationFrame dừng — lái game bằng `__game._game.update(1/30)`.

## Quy tắc đã chốt

- **Chữ trong game là tiếng Anh**, nằm hết trong `data/i18n/en.json` hoặc trường `{ "en": … }` của dữ liệu; tên riêng
  giữ dấu tiếng Việt (Tú, Huyền, F-Ville, Hòa Lạc). Không viết chữ hiển thị cứng trong code.
- **Chỉ dùng đồ họa Thấp** (bản Cao có lightmap đang tạm dừng; nhân vật huyen chỉ có bản 6k).
- **Không sửa GLB bối cảnh từ code game.** Thiếu/sai đối tượng thì chỉnh bằng dữ liệu (`data/collision.json`: bỏ/thêm hộp
  va chạm; `data/scene_fixes.json`; vật do code đặt trong `data/interactables.json`) và ghi vào báo cáo. Sửa bối cảnh
  thật thì sửa script Blender rồi build lại zone (cần người dùng đồng ý).
- Nội dung chờ HR có `"draft": true` → game hiện **[DRAFT]**. Danh sách: `docs/PROGRESS.md`.
- Vai nhân vật: id vai trong dữ liệu giữ nguyên (vd vai `thao` hiển thị là **Ms. Huyền**, model `huyen`). Lời thoại
  nhân vật dựa trên người thật (Ms. Huyền, Prajith): tự viết chi tiết cá nhân, giữ nhẹ nhàng, thân thiện, không nói chuyện
  sức khỏe, gia đình, tiền bạc hay điều làm họ trông thiếu chuyên nghiệp.
- Làm theo đợt và **dừng lại báo cáo** sau mỗi đợt; báo cáo bằng tiếng Việt.
- File chữ tiếng Việt: sửa bằng Edit hoặc Python (UTF-8). Không dùng PowerShell `Get-Content`/`Set-Content` để ghi lại.

## Riêng tư và bản quyền (repo công khai)

- KHÔNG BAO GIỜ đưa lên: FBX gốc Mixamo (`mixamo/*.fbx`, điều khoản Mixamo không cho phát tán animation thô), file
  `.blend`, `source/` (file Meshy gốc), texture nhân vật, video/ảnh/khung hình trong `references/` (có khung chụp thẻ nhân
  viên ghi họ tên: `VanPhongLamViec/t_0008.0.jpg`, `t_0010.0.jpg`, `contact_01.jpg`), `renders/`, `tools/bin/`.
- Không đưa email, đường dẫn máy cá nhân, token vào file. Ảnh render từ Blender: `char_render.preview_setup()` đã tắt
  metadata (trước đây Blender ghi đường dẫn file vào PNG). Chạy `python scripts/tools/privacy_scan.py` trước khi commit;
  không file nào trên 20 MB.
- Commit bằng danh tính noreply đã cấu hình trong repo (`git config user.email` = `…@users.noreply.github.com`).
- Nhánh **main**: cuối mỗi lần làm việc cập nhật `docs/PROGRESS.md`, commit và push. Nhánh **gh-pages** (deploy bản
  web): chỉ push khi người dùng đồng ý.

## Việc chỉ làm được trên máy có Blender (máy làm việc gốc)

- Dựng/sửa bối cảnh: `scripts/build.py` (Blender 5.2 qua `tools/bin/blender.cmd`, `gltf-transform` CLI, Pillow, numpy).
- Lightmap bản Cao, ảnh so sánh với tham chiếu (cần `references/` gốc).
- Toàn bộ pipeline nhân vật: cần `assets/characters/<id>/source/`, `mixamo/*.fbx`, `textures/`, các file `.blend`
  (không có trên repo).
- Render ảnh kiểm tra, chân dung, bảng animation.

Máy chỉ có Node.js vẫn chạy được game, viewer, sửa dữ liệu JSON và code game, deploy (`deploy_site.py --no-build` cần
`game/dist` có sẵn; bình thường để script tự build).
