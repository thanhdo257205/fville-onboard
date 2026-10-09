# Ghi nguồn

## Nhân vật
Mô hình nhân vật tạo bằng Meshy (meshy.ai), giấy phép CC BY 4.0. Gắn xương và animation: Adobe Mixamo.

- `assets/characters/prajith/` — Prajith (dùng tạm cho mọi vai trong game, trừ vai chị Huyền; xem `data/characters.json`).
- `assets/characters/huyen/` — Huyền (vai chị Huyền, buddy đón intern ở zone 0 và zone 1; người thật, đã đồng ý dùng
  hình). Animation dùng lại bộ Mixamo của Prajith (retarget sang bộ xương của Huyền).

Logo FPT trên ngực áo (Prajith, Huyền) là bản tạm: mảng logo tách từ texture của Prajith
(chỉ có trên máy làm việc), sẽ thay bằng file logo chính thức của FPT
(`scripts/blender/characters/apply_chest_logo.py`). Logo trên áo Nga: logo FPT do người dùng cung cấp, chỉ nằm trong texture.

## Thư viện
- three.js (MIT) — trang xem thử `viewer/` và game web.
