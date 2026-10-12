# Ghi nguồn

## Nhân vật
Mô hình nhân vật tạo bằng Meshy (meshy.ai), giấy phép CC BY 4.0. Gắn xương và animation: Adobe Mixamo.

- `assets/characters/prajith/` — Prajith (dùng tạm cho mọi vai trong game, trừ vai chị Huyền, chị Nga và người chơi; xem
  `data/characters.json`).
- `assets/characters/huyen/` — Huyền (vai chị Huyền, buddy đón intern ở zone 0 và zone 1; người thật, đã đồng ý dùng
  hình). Animation dùng lại bộ Mixamo của Prajith (retarget sang bộ xương của Huyền).
- `assets/characters/nga/` — Nga (vai Ms. Nga, Tuyển dụng: tin nhắn hẹn xe ở zone 0, quầy lễ tân zone 3; người thật,
  đã đồng ý dùng hình).
  Mô hình tạo bằng Meshy (meshy.ai), giấy phép CC BY 4.0; gắn xương Adobe Mixamo; animation dùng lại bộ Mixamo của
  Prajith (retarget sang bộ xương của Nga).
- `assets/characters/intern_nam/`, `assets/characters/intern_nu/` — nhân vật người chơi nam / nữ (hư cấu). Mô hình tạo
  bằng Meshy (meshy.ai), giấy phép CC BY 4.0; gắn xương Adobe Mixamo; animation dùng lại bộ Mixamo của Prajith.
- `assets/characters/intern_nam_kinh/` — nhân vật người chơi nam đeo kính (hư cấu; sau này cũng là model Tú). Mô hình
  tạo bằng Meshy (meshy.ai), giấy phép CC BY 4.0; gắn xương Adobe Mixamo; animation dùng lại bộ Mixamo của Prajith.

Logo FPT trên ngực áo (Prajith, Huyền) là bản tạm: mảng logo tách từ texture của Prajith
(chỉ có trên máy làm việc), sẽ thay bằng file logo chính thức của FPT
(`scripts/blender/characters/apply_chest_logo.py`). Logo trên áo Nga và các nhân vật người chơi (bộ `ao_cam`): logo FPT
do người dùng cung cấp, chỉ nằm trong texture.

## Phụ kiện
- Mũ lưỡi trai cam (`assets/accessories/cap/cap.glb`): dáng mũ lấy từ mô hình tạo bằng Meshy (meshy.ai), giấy phép
  CC BY 4.0 (file gốc không có trên repo; `scripts/blender/accessories/build_cap.py` dựng lại lưới thấp bám theo mô hình
  đó); logo FPT do người dùng cung cấp, chỉ nằm trong texture.

## Bối cảnh
- Tượng Cuder ở zone 2 (`zone_02_campus.glb`, mesh `tuong_cuder_tuong` + búi tóc `tuong_cuder_tuong_buitoc`): mô hình
  tạo bằng Meshy (meshy.ai), giấy phép CC BY 4.0. File gốc không có trên repo; `scripts/blender/lib/cuder.py` làm sạch,
  giảm tam giác, thay bệ, nắn hàng số 0/1 khi build zone.
- Bàn bi-a ở zone 5 (`zone_05_office.glb`, node `pool_table` + bi `ball_0`…`ball_15`, cơ `cue`, `cue_2`):
  "Pool Table Traditional" by fizyman (Sketchfab), giấy phép CC BY 4.0 —
  https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977
  (link nguồn ghi trong file gốc, glTF `asset.extras.source`). File gốc không có trên repo;
  `scripts/blender/lib/pool_table.py` bỏ đèn treo, gộp texture, giảm lưới bàn, chuyển chất liệu khi build zone.
- Máy tính bàn ở bàn intern zone 5 (`zone_05_office.glb`, node `desktop_computer` + màn hình `monitor_screen`):
  "Desktop Computer" by Tyler P Halterman (Sketchfab), giấy phép CC BY 4.0 —
  https://sketchfab.com/3d-models/desktop-computer-561abc2fc95941609fc7bc6f232895c2
  (link nguồn ghi trong file gốc, glTF `asset.extras.source`). File gốc không có trên repo;
  `scripts/blender/lib/desktop_computer.py` thu nhỏ, gộp và nén texture, thay hình nền màn hình bằng màn đăng nhập
  "My FPT" tự vẽ khi build zone.

- Xe bus đưa đón ở zone 0 và zone 1 (`zone_00_pickup.glb`, `zone_01_bus.glb`: lưới `bus_body` + cánh cửa `bus_door`, dùng
  chung cho mọi xe trong zone): "Bus jb5 Low Poly" by seenkonkgrng (Sketchfab), giấy phép CC BY 4.0 —
  https://sketchfab.com/3d-models/bus-jb5-low-poly-fae01c4c820c4a7b958c3de2b3b011ab (link nguồn ghi trong file gốc, glTF
  `asset.extras.source`). File gốc không có trên repo; `scripts/blender/lib/bus.py` đổi sơn sang màu xe đưa đón F-Ville,
  xoá chữ thương hiệu / biển số, tách cánh cửa khách, bỏ clearcoat khi build zone.
- Cây ngoài trời ở zone 0–3 (lưới `cay_lo_1`, `cay_lo_2`, dùng chung cho mọi cây): "Tree low poly lowpoly" by 00amza
  (Sketchfab), giấy phép CC BY 4.0 — https://sketchfab.com/3d-models/tree-low-poly-lowpoly-73201f05280d48dcb10ed4ca362d69f8
  (link nguồn ghi trong file gốc). File gốc không có trên repo; `scripts/blender/lib/trees.py` tách vỏ / lá, đổi màu lá
  theo bảng màu game, lá cắt alpha khi build zone.
- Bụi tre ở zone 2 (lưới `bamboo`, dùng chung cho mọi bụi): "bamboo tree" by tojamerlin (Sketchfab), giấy phép CC BY 4.0 —
  https://sketchfab.com/3d-models/bamboo-tree-d0161434cf6844a8bc6eaeb0c0692ed0 (link nguồn ghi trong file gốc). File gốc
  không có trên repo; `scripts/blender/lib/bamboo.py` dựng lại bản low-poly (thân trụ + lá 2 tam giác) theo đúng vị trí
  thân, lá của mô hình gốc và gộp texture khi build zone.
- Cây ngô quanh tượng Cuder ở zone 2 (lưới `cay_ngo`, dùng chung cho mọi cây): "Maize Corn Plant" by gilles.schaeck
  (Sketchfab), giấy phép CC BY 4.0 — https://sketchfab.com/3d-models/maize-corn-plant-5fd3b104d8104519b061469c365d4974
  (link nguồn ghi trong file gốc). File gốc không có trên repo; `scripts/blender/lib/corn.py` gộp mảnh, giảm lưới, gộp
  texture màu thành 1 atlas khi build zone.

## Đồ vật đặt bằng dữ liệu
- Nền cỏ (`assets/props/grass_ground/grass_ground.glb`): "Simple Grass Ground (Free Low Model)" by Shun Koizumi
  (Sketchfab), giấy phép CC BY 4.0 —
  https://sketchfab.com/3d-models/simple-grass-ground-free-low-model-758b5be71cd6427e9834d2968afff7c4
  (nguồn và giấy phép trong glTF `asset.extras`). File gốc chỉ lưu ở thư mục `source/` trên máy làm việc.
  `scripts/tools/prepare_grass.py`: giữ mặt phẳng tối thiểu 2 tam giác, bỏ normal / AO / metallic-roughness map,
  texture màu 512 px WebP, Draco: 6.890.736 → 77.600 byte. Game dùng bề mặt này cho các bãi cỏ hiện có, lát 4 × 4 m;
  lưới cỏ hình chữ nhật được gộp về 2 tam giác, giữ đường / vỉa hè / va chạm.
- Chậu cây trong nhà (`assets/props/potted_plant/potted_plant.glb` — thay chậu cọ cũ ở sảnh zone 3, tầng trên zone 4, khu
  nghỉ zone 5): "Potted Plant" by Blizzy (Sketchfab), giấy phép CC BY 4.0 —
  https://sketchfab.com/3d-models/potted-plant-2cfe4f4c192f4dd08229bd7460532b09 (ghi trong file gốc, glTF `asset.extras`).
  File gốc không có trên repo; `scripts/tools/make_prop.sh potted_plant` giảm 3.916 → 1.174 tam giác, texture 512 px WebP,
  nén Draco; đặt vào zone bằng `data/scene_fixes.json` → `props`.

## Âm thanh
Danh sách đầy đủ từng file, nguồn, SHA-256 và giấy phép: `docs/audio_credits.md`.

- Hiệu ứng âm thanh từ các gói của Kenney (www.kenney.nl): Interface Sounds, Impact Sounds, RPG Audio, Music Jingles, Casino
  Audio — giấy phép Creative Commons CC0 1.0 (phạm vi công cộng, không bắt buộc ghi công; bản giấy phép của từng gói:
  `assets/sfx/licenses/`).
- Các tiếng còn lại tự tạo cho dự án bằng code: `scripts/blender/audio/synth.py` (tin nhắn, hạt lúa, màn trập, nước, cửa,
  đầu đọc thẻ, xe bus), tiếng nền theo zone và tiếng máy xe bus tạo lúc chơi (`game/src/core/ambience.js`).
- Nhạc nền `assets/music/piano_spiegel.mp3`: "Piano Spiegel" — Oliver Siimon, trong "Fantasy Music Mega Pack (Royalty free,
  CC0, Public Domain)" của Blacis — https://blacis.itch.io/royalty-free-music-megapack — giấy phép Creative Commons CC0 1.0
  (trang ghi nhạc tạo bằng AI, chỉnh tay). Nén lại cho game (bỏ metadata, tăng 4 dB, MP3 ~75 kbps); SHA-256 file gốc trong
  `data/sounds.json` → `music`; ghi chú giấy phép: `assets/music/licenses/`.

## Thư viện
- three.js (MIT) — trang xem thử `viewer/` và game web.
