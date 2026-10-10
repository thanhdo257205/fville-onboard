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

## Thư viện
- three.js (MIT) — trang xem thử `viewer/` và game web.
