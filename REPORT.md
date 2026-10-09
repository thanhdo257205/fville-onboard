# Báo cáo dựng bối cảnh F-Ville 1 (2026-10-08)

Build lại toàn bộ: `python scripts/build.py zone_01 zone_02 zone_03 zone_04 zone_05` (~3 phút).
Mỗi zone: Blender dựng → bake AO vào vertex color → `.blend` → GLB → ảnh so sánh → nén Draco → kiểm tra tên/extras.
Cả 5 GLB qua `gltf-transform validate`: 0 lỗi, 0 cảnh báo.

## Tổng quan
| Zone | Tam giác | Chất liệu | GLB (Draco) | Ảnh so sánh |
|---|---|---|---|---|
| zone_01_bus | 36,094 | 5 | 239 KB | `renders/gallery_zone_01.jpg` |
| zone_02_campus | 55,286 | 8 | 441 KB | `renders/gallery_zone_02.jpg` |
| zone_03_lobby | 48,366 | 7 | 325 KB | `renders/gallery_zone_03.jpg` |
| zone_04_corridor | 9,064 | 4 | 94 KB | `renders/gallery_zone_04.jpg` |
| zone_05_office | 32,086 | 4 | 124 KB | `renders/gallery_zone_05.jpg` |

### Nâng cấp đồ hoạ (vòng 2)
- Cây tán tròn nhiều cụm, bóng mềm (smooth + vertex color sáng dần lên trên), gốc quét vôi trắng; cây xa dùng bản rút gọn. Tre có đốt + chùm lá nhỏ; bụi có hoa; hàng rào bo tròn; khóm cỏ.
- Mặt đất loang màu tự nhiên (vertex color theo nhiễu), vỉa hè/đảo giếng texture gạch lục giác, giếng texture đá ong, lam gạch mặt tiền texture đục lỗ hạt lúa + khung cửa sổ; khối kỹ thuật trên mái.
- Biển cổng: chữ "FPT SOFTWARE" 3D bằng font thường (Arial Rounded MT Bold), viền trắng + mặt xám. Logo FPT màu vẫn là mảng màu thay thế.
- Toà nhà: **khối có logo FPT là cánh trái (sau lối đi, bên trái nhìn từ cổng), trên chân chữ V**; khối đầu phía đông là kính xám.
- Nội thất: trần ô thả văn phòng, cửa sổ rèm cuốn, len chân tường, tranh treo, đồ trên bàn (cốc, giấy, chuột, giấy nhớ), đèn chấm âm sàn sảnh, dây trầu bà rủ.
- Ảnh xem trước: trời chuyển màu, nắng ấm, GI/phản xạ Eevee, viền nét kiểu hoạt hình (vỏ lật pháp tuyến — giống `OutlineEffect` của Three.js; chỉ dùng khi render, không xuất GLB).
- Texture mới (sinh bằng `scripts/tools/make_textures.py`): `hex_pavers`, `laterite`, `brick_louver`, `ceiling_grid`.

Giới hạn: < 60k tam giác, ≤ 10 chất liệu, < 5 MB — tất cả đạt.

## File
- Script: `scripts/blender/lib/` (palette, materials, mesh, kit, props, interior, markers, scene, render, zone), `scripts/blender/zone_01..05.py`
- Công cụ: `scripts/build.py`, `scripts/tools/` (extract_frames, sample_colors, palette_swatch, make_textures, compare, check_glb, gallery)
- Texture: `assets/textures/brick_basketweave.png` (gạch đan rổ), `ceiling_dots.png` (trần đục lỗ) — trong GLB là WebP
- Mỗi zone, mỗi mức (`low` / `high`): `assets/blend/<mức>/<zone>.blend`, `assets/glb/<mức>/<zone>.glb` (dùng trong game), `<zone>.raw.glb` (chưa nén), `<zone>.report.json`; bản Cao có thêm `<zone>_lightmap.png`. Ảnh: `renders/` (Thấp), `renders/high/` (Cao)

## Hai mức đồ hoạ (Thấp / Cao)
> ⏸ **Bản Cao đang tạm dừng (2026-10-08)** để tập trung hoàn thiện bản Thấp. File bản Cao đã build vẫn giữ trong `assets/glb/high/`, `assets/blend/high/`, `renders/high/` (có thể cũ so với bản Thấp nếu bản Thấp thay đổi). Viewer ẩn mục chọn mức (`SHOW_HIGH = false` trong `viewer/index.html`); `make_site.py` chỉ đóng gói bản Thấp (`TIERS`).

Build: `python scripts/build.py zone_01 zone_02 zone_03 zone_04 zone_05` (mặc định chỉ bản Thấp; `--tier high` hoặc `--tier both` khi bật lại bản Cao).

| | Thấp (`assets/glb/low/`) | Cao (`assets/glb/high/`) |
|---|---|---|
| Dành cho | laptop văn phòng, GPU tích hợp | máy có GPU rời / máy mạnh |
| Tam giác / zone | < 60k | < 250k |
| Cây, bụi, cỏ | rút gọn | dày ×1.6–4, tán 5 cụm, bo mịn hơn |
| Texture | 256–512 px | 512–1024 px (`*@2x.png`) |
| Ánh sáng | AO trong vertex color + đèn thời gian thực | thêm **lightmap** 2048² (nắng, bóng đổ, đèn trần nướng sẵn bằng Cycles) |

Số liệu thực tế (GLB đã nén Draco; lightmap nằm trong GLB dưới dạng WebP). Cả 10 file qua `gltf-transform validate`: 0 lỗi, 0 cảnh báo.

| Zone | Thấp: tam giác | Thấp: GLB | Cao: tam giác | Cao: GLB (gồm lightmap) | Thời gian build Cao |
|---|---|---|---|---|---|
| zone_01_bus | 36,094 | 238 KB | 78,022 | 810 KB | 6.4 phút |
| zone_02_campus | 55,286 | 439 KB | 145,676 | 1,322 KB | 8.5 phút |
| zone_03_lobby | 48,366 | 325 KB | 62,662 | 718 KB | 4.3 phút |
| zone_04_corridor | 9,064 | 94 KB | 9,624 | 232 KB | 6.2 phút |
| zone_05_office | 32,086 | 124 KB | 32,862 | 683 KB | 8.8 phút |

Đo trên máy dựng (GPU tích hợp AMD Radeon, 1600×900, toon + viền nét): Thấp ~65–80 FPS, Cao + lightmap ~75–80 FPS (giới hạn bởi vsync; lightmap làm tắt bớt đèn nên không chậm hơn). Ảnh so sánh 2 mức: `renders/tier_compare.jpg` (ảnh Eevee — lightmap chỉ thấy trong viewer/game); ảnh từng zone bản Cao: `renders/high/gallery_zone_XX.jpg`.

Lightmap: bóng cây/toà nhà ngoài trời, nắng qua cửa sổ và đèn trần trong nhà. Hiệu ứng khá nhẹ với `lightMapIntensity` 2.2; muốn bóng đậm hơn thì tăng lên ~2.6 và hạ Hemisphere xuống ~0.25 (chỉnh ở code game, không cần build lại). Viewer có ô "Chỉ xem lightmap" để kiểm tra.

**Chọn mức trong game:** đo GPU khi khởi động (vd thư viện `detect-gpu`: tier ≥ 2 → Cao), cho người chơi đổi trong Cài đặt, và tự hạ xuống Thấp nếu FPS trung bình < 40 trong 5 giây đầu. Hai bản có **cùng tên đối tượng và toạ độ** (COL_, INT_, SPAWN_, NPC_, TRIGGER_) nên code game không phải đổi gì.

**Dùng lightmap (bản Cao):** lightmap nằm trong ô `occlusionTexture` (TEXCOORD_1) — Three.js nạp thành `aoMap`. Đổi sang lightMap sau khi load:
```js
gltf.scene.traverse((o) => {
  if (!o.isMesh || !o.material.aoMap) return;
  o.material.lightMap = o.material.aoMap;   // cùng kênh UV 1
  o.material.lightMapIntensity = 2.2;
  o.material.aoMap = null;
});
// nắng/bóng đã nướng → giảm đèn thời gian thực (vd Hemisphere 0.35, Directional 0.45)
```
Xem thử cả 2 mức: `python -m http.server 8765` ở thư mục gốc rồi mở `http://localhost:8765/viewer/` (có FPS, số tam giác, bật/tắt lightmap, toon + viền nét).

## Nhân vật (tạm: Prajith cho mọi vai)
Build: `tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/build_character.py -- --id prajith` (~40 s), rồi `python scripts/tools/anim_sheet.py prajith` để ghép ảnh animation.

- `assets/characters/prajith/prajith.glb` — 0,76 MB (meshopt + WebP 1024), 14.998 tam giác, 28 xương, tối đa 4 xương/đỉnh, 15 animation; validate 0 lỗi. Three.js cần `MeshoptDecoder` (`loader.setMeshoptDecoder`).
- Model nhìn **+Z** (chuẩn glTF): đặt tại `NPC_`/`SPAWN_` với `rotation.y = yaw_deg + 180°`. Nhiều NPC dùng chung → `SkeletonUtils.clone`.
- `data/characters.json`: `roles` (vai → model, sửa tay), `models.prajith` (script sinh: đường dẫn, chiều cao, tốc độ, ghế, tên animation, lặp/1 lần, thời lượng), `name_tags`, `character_creation`.
- Animation: idle, walk, run, talk + talk_2 (nhóm `talk` phát luân phiên), wave, nod, think, point, phone, press, sit_down, stand_up (= sit_down đảo ngược), sit_type, cheer.
- Đã xử lý: file Without Skin của Mixamo có tư thế gốc T-pose (nhân vật gốc A-pose) → retarget theo hướng xương, khớp lệch ≤ 0,2 mm; walk/run bị trôi (1,72 m / 3,10 m) → khoá ngang hông; nod gật 33° → giảm còn 17°; sit_type dời 0,47 m cho trùng chỗ ngồi cuối của sit_down; xoá 5 xương thừa (đầu mút); 5 → 4 xương/đỉnh.
- Tốc độ khớp animation (đo): walk 1,66 m/s, run 4,39 m/s (`anim_speed_mps`). Tốc độ chơi (`speed_mps`, chỉnh tay): **walk 1,4 m/s** (phát walk ×0,84 để chân không trượt), **run 4,39 m/s**.
- Ngồi: mông cao **0,376 m** (sit_type 0,378 m); khi đã ngồi, mông ở sau gốc nhân vật 0,40 m → đặt ghế (mặt ngồi ~0,38–0,40 m) sau điểm đứng 0,40 m, giữ nguyên gốc nhân vật suốt sit_down → sit_type → stand_up.
- Viewer: chế độ "Nhân vật tại NPC_" (đặt model ở mọi `NPC_`, menu animation, toon + viền nét, bảng tên từ `label`). Ảnh: `renders/characters/prajith_animations.jpg`, `prajith_ty_le_ban_lam_viec.jpg`, `prajith_ty_le_cua_phong_hop.jpg`.
- Lưu ý hiệu năng: mỗi nhân vật ~15k tam giác; zone_05 có 6 NPC (+90k). Nếu máy yếu chậm, làm thêm bản nhân vật nhẹ (`prepare_for_mixamo.py --tris 6000`) cho đồ hoạ Thấp.
- Prajith đã được duyệt sử dụng (2026-10-09): GLB nhân vật (`prajith.glb` 15k cho đồ hoạ Cao, `prajith_6k.glb` cho Thấp) và game được đưa vào `dist/`; FBX gốc từ Mixamo, `.blend`, `source/`, `mixamo/` vẫn bị `make_site.py` chặn (điều khoản Mixamo). Ghi nguồn: `CREDITS.md`.

## Ghi chú tích hợp Three.js
- Nén Draco → cần `DRACOLoader`. Texture WebP (`EXT_texture_webp`).
- Màu nằm ở vertex color `COLOR_0` (đã nhân AO). Chất liệu có texture: màu cuối = texture × COLOR_0.
- `extras` trên node: `label` (INT_, NPC_), `yaw_deg` (SPAWN_, NPC_: 0 = nhìn về -Z glTF, tăng ngược chiều kim đồng hồ nhìn từ trên), `hinge: true` (cánh cửa — xoay quanh gốc node), `placeholder: true` (khối tạm).
- `TRIGGER_*`: empty, vùng = hộp [-1, 1] × scale của node.
- `COL_*`: hộp không chất liệu/màu → ẩn, dùng làm va chạm. Cầu thang/bậc thềm đi được có `COL_` dạng mặt dốc (`COL_bac_them`, `COL_ve_1`, `COL_ve_2`) + chiếu nghỉ.
- Mỗi zone có gốc toạ độ riêng, sàn chính z = 0 (riêng zone_04: tầng trệt 0, tầng trên +4.2 m). Chuyển zone bằng `TRIGGER_zone_XX_enter` → đặt người chơi tại `SPAWN_zone_YY_start` / `SPAWN_zone_YY_from_zone_XX`.

## Ước lượng / tự đoán
**Chung:** quãng đi bộ đã rút ngắn; hành lang/cửa ≥ 2.5 m; logo, chữ, biển phòng, tấm hạt lúa khắc tên, màn hình → mảng màu placeholder; không dựng người thật. Khung hình có thẻ nhân viên (`VanPhongLamViec/t_0008`, `t_0010`) không dùng.

- **zone_01:** xe bus kiểu (b) dài 12 m; sọc vàng và vị trí mảng logo ước lượng; 3 xe đậu dùng chung mesh; tường bản đồ tuyến đặt dưới mái hiên toà nhà gần điểm xuống xe (tự sắp xếp); giàn leo chờ xe tự thêm cho có chỗ ngồi.
- **zone_02:** **Cổng F-Ville = biển chữ FPT SOFTWARE** trên gò cỏ sau bờ tường thấp (theo LoiDi t_0000 + flycam). Đường nội bộ chạy ngang trước biển chữ; bên kia đường là **đảo giọt nước** lát lục giác có **giếng làng + cần vọt + bụi tre** (FV s_0117); đường xe bus từ phía nam đi vào; lối gạch bắt đầu bên trái biển chữ. Chữ là khối trắng placeholder. Đã bỏ khối cổng tạm và NPC bảo vệ. Sân ~44×30 m; khối kính FPT đặt góc đông. Sàn sảnh +0.88 m so với sân.
- **zone_03:** sảnh rút còn 20×14 m, trần 4.2 m; vị trí quầy/cầu thang/đôn theo video LeTan; lối vào Hạt Lúa rộng 8 m; phòng Hạt Lúa 12×10 m; khu ô màu cuối phòng theo `LoiDi/t_0104`. Cầu thang trong sảnh chỉ để cảnh (lối lên tầng là ở zone_04).
- **zone_04:** vị trí cửa quẹt thẻ (tầng trệt, cạnh panel đục lỗ) → cầu thang chữ U 2 vế (12 bậc × 17.5 cm mỗi vế, rộng 2.6 m) → giếng trời tầng trên → cửa FSA (kính Wing 3) ở tường tây. Khoảng cách giữa các điểm là tự sắp. Biển "FSA" là placeholder tròn màu cam.
- **zone_05:** 2 phòng họp hộp kính tối 6×5.5 m (mentor: biển cam, manager: biển xanh); 6 cụm × 8 bàn; bàn intern = bàn đầu dãy gần lối vào, có laptop + hộp quà + bảng tên trống. Tên NPC đồng nghiệp "Lan, Minh, Hà" là tên tạm — đổi trong `zone_05.py` (`build_markers`).

## Đối tượng game
| Zone | INT_ | NPC_ | SPAWN_ | TRIGGER_ |
|---|---|---|---|---|
| 01 | xe_bus (Xe Bus FPT), ban_do_tuyen_xe | tai_xe, dong_nghiep_don | zone_01_start, zone_01_from_zone_02 | xuong_xe, ban_do_tuyen_xe, zone_02_enter |
| 02 | cong_fville (biển chữ), gieng_lang, tuong_cuder | — | zone_02_start (phía nam đảo giếng), zone_02_from_zone_03 | zone_02_enter, cong_fville, gieng_lang, tuong_cuder, zone_03_enter |
| 03 | quay_le_tan, hat_lua | le_tan | zone_03_start, zone_03_from_zone_04 | zone_02_enter, quay_le_tan, hat_lua, zone_04_enter |
| 04 | cua_quet_the (2 cánh + đầu đọc thẻ), cua_phong_fsa (2 cánh + biển + đầu đọc) | — | zone_04_start, zone_04_from_zone_05 | zone_03_enter, cua_quet_the, cau_thang, cua_phong_fsa, zone_05_enter |
| 05 | phong_hop_mentor, phong_hop_manager, ban_lam_viec | mentor, manager, dong_nghiep_1..3, ban_bi_a | zone_05_start, phong_hop_mentor, phong_hop_manager, ban_lam_viec | zone_04_enter, phong_hop_mentor, phong_hop_manager, khu_team, ban_lam_viec |

## Việc còn mở
1. Xác nhận vị trí thật của cửa phòng FSA so với cầu thang (hiện tự sắp).
2. Đèn trong ảnh render chỉ để xem trước, không xuất GLB — ánh sáng/toon shading làm ở Three.js.
