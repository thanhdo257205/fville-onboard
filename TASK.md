# Nhiệm vụ: Dựng bối cảnh 3D hoạt hình của F-Ville 1 bằng Blender, từ video và ảnh tham chiếu

## Trạng thái môi trường (kiểm tra 2026-10-08)
| Công cụ | Trạng thái |
|---|---|
| Blender MCP | ✅ Kết nối OK — addon 1.8, protocol 13 (up to date) |
| Blender | ✅ 5.2.1 LTS — cài ở thư mục mặc định của Blender Foundation (chưa có trong PATH; gọi qua `tools/bin/blender.cmd`) |
| glTF exporter | ✅ `io_scene_gltf2` đã bật |
| Python | ✅ 3.12 (hệ thống), 3.13 (trong Blender) |
| Node / npx | ✅ có |
| ffmpeg | ✅ 7.1 (từ pip `imageio-ffmpeg`, vì winget không tải được từ GitHub) — dùng `tools/bin/ffmpeg.exe` |
| gltf-transform | ✅ 4.5.1 (`npm i -g @gltf-transform/cli`) — có trong PATH |
| Pillow / numpy | ✅ 12.3 / 2.5 (cho contact sheet, ảnh so sánh) |

Gọi Blender không giao diện: `tools/bin/blender.cmd --background --python <script>`

## Cấu trúc thư mục
```
references/videos/   fville_green_office_720p.mp4
references/photos/   (trống — cần bổ sung ảnh)
references/frames/   frame cắt từ video
notes.md             ghi chú thêm
scripts/blender/lib/ hàm dùng chung (chất liệu, bảng màu, modular kit)
scripts/blender/     zone_XX.py
assets/blend/        zone_XX.blend
assets/glb/          zone_XX.glb
renders/             compare_zone_XX_*.png
```

## Bối cảnh
Game 3D chạy trên web (Three.js) về ngày onboarding đầu tiên của intern FPT Software tại F-Ville 1.
Phong cách: hoạt hình low-poly, dễ thương, màu phẳng, cạnh bo nhẹ. Bối cảnh cần "nhận ra được" là F-Ville 1,
không cần giống chính xác từng chi tiết. Game phải chạy mượt trên trình duyệt của laptop văn phòng.

## Các địa điểm (theo thứ tự hành trình)
1. Xe Bus FPT (model xe bus + điểm xuống xe)
2. Cổng F-Ville
3. Giếng Làng
4. Tượng Cuder
5. Sảnh Lễ Tân
6. Phòng Hạt Lúa
7. Cửa Quẹt Thẻ (lối vào khu làm việc)
8. Cửa Phòng FSA
9. Khu làm việc: phòng họp (gặp mentor, gặp manager), khu ngồi của team, bàn làm việc của intern

Zone:
- zone_01_bus: xe bus và điểm xuống xe
- zone_02_campus: cổng, giếng làng, tượng Cuder, lối đi ngoài trời
- zone_03_lobby: sảnh lễ tân, phòng Hạt Lúa
- zone_04_corridor: cửa quẹt thẻ, hành lang, cửa phòng FSA
- zone_05_office: phòng họp, khu team, bàn làm việc

## Bước 1: Chuẩn bị môi trường
- Kiểm tra blender, ffmpeg, python. Cài ffmpeg nếu thiếu.
- Blender không giao diện: `blender --background --python <script>`

## Bước 2: Phân tích tham chiếu
- Cắt video bằng ffmpeg (scene detection + 1 khung/2 giây cho đoạn quay chậm) → references/frames/<tên_video>/
- Contact sheet mỗi video, chọn khung rõ nhất cho từng địa điểm.
- Bỏ qua khuôn mặt người. Không dựng lại người thật.
- Viết references/reference_index.md, mỗi địa điểm: khung hình tốt nhất; hình khối, số tầng, cửa sổ, mái, cột, cổng;
  màu chủ đạo (hex) + chất liệu; kích thước ước lượng (cửa ~2.1 m, tầng ~3.5 m, người); những gì chưa rõ cần xác nhận.

## Bước 3: DỪNG lại và hỏi
Tóm tắt: địa điểm đủ/thiếu tham chiếu, danh sách câu hỏi, bảng màu đề xuất. Chờ xác nhận rồi mới dựng.

## Bước 4: Quy chuẩn dựng
- 1 đơn vị = 1 m. Nhân vật ~1.7 m. Tỷ lệ tòa nhà gần thật, rút ngắn quãng đi bộ.
- Hành lang, cửa rộng ≥ 2.5 m.
- Màu phẳng/vertex color, bevel nhỏ. Chỉ Principled BSDF cơ bản (màu, roughness, metallic). Toon shading làm ở Three.js.
- Logo/chữ: mảng màu placeholder.
- Mọi thứ bằng script Python chạy lại được; modular kit trong scripts/blender/lib/.
- Đặt tên: `COL_*`, `INT_*` (vd INT_gieng_lang, INT_tuong_cuder, INT_cua_quet_the, INT_ban_lam_viec),
  `SPAWN_*`, `NPC_*`, `TRIGGER_*` (vd TRIGGER_zone_04_enter). Custom property `label` (tiếng Việt) cho INT_ và NPC_.
- Mỗi zone: < ~60k tam giác, ≤ ~10 chất liệu, apply modifier, bake AO vào vertex color nếu cần.

## Bước 5: Xuất file
- assets/blend/zone_XX.blend, assets/glb/zone_XX.glb
- Nén gltf-transform (Draco; WebP/KTX2 nếu có texture). Mục tiêu < 5 MB/zone.

## Bước 6: Tự kiểm tra
- Đặt camera theo 2-3 ảnh tham chiếu, render, ghép cạnh ảnh thật → renders/compare_zone_XX_*.png
- Tự nhận xét và sửa tối đa 3 vòng.
- Kiểm tra GLB (gltf-transform inspect) và tên đối tượng.

## Thứ tự làm việc
- THÍ ĐIỂM zone_02_campus trước (cổng, giếng làng, tượng Cuder). Xong thì dừng, gửi ảnh so sánh + báo cáo ngắn.

## Báo cáo cuối mỗi zone
- Danh sách file; số tam giác, dung lượng GLB; chỗ ước lượng/tự đoán; danh sách INT_, NPC_, SPAWN_, TRIGGER_.
