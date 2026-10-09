# Tổng kết công việc — F-Ville 1 (bối cảnh 3D cho game onboarding intern)

Cập nhật: 2026-10-08 · Bản công khai: https://thanhdo257205.github.io/fville-onboard/viewer/

---

## 1. Kết quả chính

| Hạng mục | Trạng thái |
|---|---|
| 5 zone 3D (xe bus → cổng/giếng/tượng → sảnh + Hạt Lúa → hành lang + cầu thang → văn phòng) | ✅ Xong |
| 2 mức đồ hoạ **Thấp** / **Cao** (bản Cao có lightmap nướng sẵn) | ✅ Xong, cả 10 file GLB |
| Kiểm tra GLB (`gltf-transform validate`) | ✅ 10/10 file: 0 lỗi, 0 cảnh báo |
| Đối tượng game (va chạm, tương tác, điểm xuất hiện, NPC, vùng kích hoạt) | ✅ Đặt tên chuẩn, giống nhau ở cả 2 mức |
| Trang xem thử (viewer Three.js: toon shading, viền nét, FPS) | ✅ `viewer/index.html` |
| Đưa lên mạng (GitHub Pages) | ✅ Repo `thanhdo257205/fville-onboard` |
| Mọi thứ dựng lại được bằng script | ✅ `python scripts/build.py ...` |

---

## 2. Yêu cầu ban đầu (tóm tắt từ `TASK.md`)

- Dựng lại F-Ville 1 (campus FPT Software) kiểu **hoạt hình low-poly dễ thương** trong Blender, từ video và ảnh tham chiếu, cho game web Three.js về ngày đầu onboarding của intern.
- Màu phẳng hoặc vertex color, bo cạnh nhỏ, chỉ dùng Principled BSDF; toon shading làm ở Three.js. Logo/chữ là mảng màu thay thế.
- 1 đơn vị = 1 m; hành lang và cửa rộng ≥ 2.5 m; rút ngắn quãng đi bộ.
- Quy ước tên: `COL_`, `INT_`, `SPAWN_`, `NPC_`, `TRIGGER_`; `INT_`/`NPC_` có thuộc tính `label` tiếng Việt.
- Giới hạn mỗi zone: < ~60k tam giác, ≤ ~10 chất liệu, < 5 MB; nén Draco.
- So ảnh render với tham chiếu, tối đa 3 vòng sửa; báo cáo mỗi zone.
- Dừng lại hỏi sau bước phân tích tham chiếu và sau zone thử nghiệm.

---

## 3. Môi trường và công cụ đã cài

| Công cụ | Ghi chú |
|---|---|
| Blender 5.2.1 LTS + MCP addon | Kiểm tra kết nối MCP thành công. Chạy không giao diện qua `tools/bin/blender.cmd` (Blender chưa có trong PATH) |
| ffmpeg 7.1 | winget không tải được (lỗi mạng 0x80072eff) → lấy từ gói pip `imageio-ffmpeg`, chép vào `tools/bin/ffmpeg.exe` |
| gltf-transform 4.5.1 | `npm i -g @gltf-transform/cli` — nén Draco, kiểm tra GLB |
| Pillow, numpy | Ghép ảnh so sánh, sinh texture, phân tích lightmap |
| Python 3.12 (hệ thống), 3.13 (trong Blender) | |
| git 2.52 | Không có GitHub CLI (`gh`); push dùng Git Credential Manager |

---

## 4. Các giai đoạn đã làm

### 4.1. Phân tích tham chiếu
- Cắt khung hình từ 6 video bằng `scripts/tools/extract_frames.py` (1 khung/2 giây + phát hiện chuyển cảnh, ảnh ghép contact sheet). Video LoiDi quay dọc không có thông tin xoay → xoay bằng `transpose=1`.

  | Video | Khung hình |
  |---|---|
  | LoiDi (lối đi) | 80 khung + 3 ảnh ghép |
  | fville_green_office_720p (quảng bá, flycam) | 69 + 14 chuyển cảnh + 3 ảnh ghép |
  | VanPhongLamViec (văn phòng) | 41 + 1 ảnh ghép |
  | LeTan (lễ tân) | 20 + 1 ảnh ghép |
  | GiengLang (giếng làng) | 9 + 1 ảnh ghép |
  | TuongCuDo (tượng Cuder) | 7 + 1 ảnh ghép |

- Viết `references/reference_index.md`: mỗi địa điểm có khung hình tốt nhất, hình khối, màu hex, kích thước ước lượng, điểm chưa rõ.
- Lấy màu mẫu từ ảnh (`sample_colors.py`), đề xuất bảng màu hoạt hình (`references/palette_proposal.png`), danh sách ảnh cần chụp thêm (`references/photo_checklist.md`).

### 4.2. Các quyết định đã chốt với bạn
| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Cổng F-Ville | Cổng = **biển chữ FPT SOFTWARE** trên gò cỏ (làm rõ thêm bằng ảnh flycam) |
| 2 | Kiểu xe bus | Kiểu (b): thân trên trắng, thân dưới đỏ, sọc vàng |
| 3 | Giếng làng | Giữ **cần vọt**; giếng + bụi tre nhỏ trên **đảo giọt nước** ngay trước biển chữ, bên kia đường |
| 4 | Ruộng quanh tượng | Đã gặt → **nền đất** quanh tượng Cuder |
| 5 | Phòng Hạt Lúa | Khu mở cạnh sảnh lễ tân (theo video LeTan) |
| 6 | Cửa quẹt thẻ | Cửa kính khung đen ở tầng trệt |
| 7 | Cửa phòng FSA | Cửa kính Wing 3 (đầu video VanPhongLamViec) |
| 8 | Cầu thang | Dựng cầu thang **đi được** |
| 9 | Văn phòng | Giữ hết các khu; **2 phòng họp riêng** (mentor, manager); bàn intern ở đầu dãy |
| — | Sân và lối đi | Dùng **texture gạch** |
| — | Toà nhà có logo FPT | Là **cánh trái** sau lối đi (nhìn từ cổng), đứng trên chân chữ V |
| — | Chữ trên biển cổng | Chữ 3D thật "FPT SOFTWARE" (font thường); logo FPT vẫn là mảng màu thay thế |

### 4.3. Zone thử nghiệm và duyệt phong cách
- Dựng zone_02 trước, so với ảnh thật → bạn **duyệt phong cách**, yêu cầu thêm texture gạch cho sân (đã làm: `brick_basketweave`).
- Sửa lại bố cục cổng theo ảnh flycam: đường nội bộ chạy ngang trước biển chữ; đảo giếng ở bên kia đường; bỏ khối cổng tạm và NPC bảo vệ.

### 4.4. Dựng đủ 5 zone
Xem chi tiết từng zone ở mục 5.

### 4.5. Nâng cấp đồ hoạ vòng 2 (bạn thấy bản đầu chưa đẹp)
- **Cây cối:** tán tròn nhiều cụm, bóng mềm, vertex color sáng dần lên trên, gốc quét vôi trắng; cây xa dùng bản rút gọn. Tre có đốt và chùm lá. Bụi có hoa, hàng rào bo tròn, khóm cỏ.
- **Mặt đất:** màu loang tự nhiên theo nhiễu; vỉa hè và đảo giếng lát gạch lục giác; viền vỉa liền khối vát cạnh.
- **Toà nhà:** lam gạch mặt tiền có texture đục lỗ, khung cửa sổ, đường bóng dưới sàn, khối kỹ thuật trên mái, vườn trên mái; khối đầu phía đông là kính xám.
- **Nội thất:** trần ô thả, rèm cuốn, len chân tường, tranh treo, đồ trên bàn (cốc, giấy, chuột, giấy nhớ), đèn chấm âm sàn, dây trầu bà rủ.
- **Ảnh render:** trời chuyển màu, nắng ấm, phản xạ/GI của Eevee, viền nét hoạt hình (chỉ khi render, không xuất GLB).
- 6 texture tự sinh bằng code (`scripts/tools/make_textures.py`), mỗi cái có bản thường và bản `@2x`: gạch đan rổ, trần đục lỗ, gạch lục giác, đá ong, lam gạch, trần ô.

### 4.6. Hai mức đồ hoạ Thấp / Cao
Bạn hỏi cách có đồ hoạ cao mà người khác vẫn chơi online được → chọn hướng 1: build 2 bản.

| | Thấp | Cao |
|---|---|---|
| Dành cho | Laptop văn phòng, GPU tích hợp | Máy có GPU rời / máy mạnh |
| Cây, bụi, cỏ | Rút gọn | Dày hơn ×1.5–4, bo mịn hơn |
| Texture | 256–512 px | Bản `@2x` |
| Ánh sáng | AO trong vertex color | Thêm **lightmap 2048²** nướng bằng Cycles (nắng, bóng đổ, đèn trần) |

- Lightmap nằm ở ô `occlusionTexture` (UV thứ 2) trong GLB. Code game đổi sang `lightMap` sau khi tải (đoạn code mẫu trong `REPORT.md`).
- Sửa lỗi xếp UV lightmap lần đầu (hàng nghìn mảnh nhỏ làm ảnh gần như trống): chỉ trải UV cho mặt ≥ 0.2 m², mặt nhỏ dùng chung một điểm sáng, lề theo tỉ lệ → ảnh lightmap dùng 49–76% diện tích.
- Đã kiểm tra trong viewer: bóng cây hiện trên cỏ, nắng qua cửa sổ và đèn trần trong nhà, không có mặt bị đen do lỗi. Hiệu ứng hơi nhẹ, có thể chỉnh đậm hơn trong code game.

> ⏸ **Tạm dừng (2026-10-08):** bạn muốn tập trung hoàn thiện bản Thấp trước. Build mặc định chỉ bản Thấp, viewer ẩn mục chọn Cao/lightmap, bản web chỉ đóng gói bản Thấp. File bản Cao đã build vẫn giữ nguyên.

### 4.7. Trang xem thử (viewer)
`viewer/index.html` — Three.js 0.160 (tải từ CDN jsdelivr), GLTFLoader + Draco, OrbitControls.
- Chọn zone, mức đồ hoạ; bật/tắt lightmap; toon shading 3 bậc + viền nét (`OutlineEffect`); ô "Chỉ xem lightmap" để kiểm tra.
- Hiện FPS, số tam giác, draw call; camera đặt tại điểm `SPAWN_*_start`.

### 4.8. Đưa lên mạng (GitHub Pages)
- So sánh Cloudflare Pages / GitHub Pages / Azure Static Web Apps → bạn chọn thử GitHub trước.
- `scripts/make_site.py` gom bản công khai vào `dist/` (viewer + 10 GLB, khoảng 5 MB). **Không** chép video, ảnh tham chiếu, `.blend`, ảnh render, `TASK.md`, `REPORT.md`. Đã quét: không có email, tên máy hay đường dẫn ổ đĩa.
- `dist/` là repo git riêng. Commit đứng tên "Thanh Do" với **email ẩn của GitHub** (chỉ cài trong repo này) để không lộ email cá nhân.
- Push lên `https://github.com/thanhdo257205/fville-onboard`, bạn bật Pages (nhánh `main`, thư mục gốc). Đã mở thử online: tải được cả 10 GLB, không lỗi.

---

## 5. Chi tiết từng zone

### zone_01_bus — Xe bus và điểm xuống xe
- Xe bus kiểu (b) dài 12 m; 3 xe đậu dùng chung mesh; đường nhựa, vỉa hè gạch lục giác, viền vỉa vàng–đen, cột đèn gang 3 bóng.
- Toà nhà lam gạch có vườn trên mái; tường bản đồ tuyến xe dưới mái hiên; giàn leo có chỗ ngồi chờ xe (tự thêm).
- Đối tượng game: `INT_xe_bus` (Xe Bus FPT), `INT_ban_do_tuyen_xe`; `NPC_tai_xe`, `NPC_dong_nghiep_don`; 2 SPAWN, 3 TRIGGER, 18 COL.

### zone_02_campus — Cổng, giếng làng, tượng Cuder
- Biển chữ 3D "FPT SOFTWARE" trên gò cỏ sau bờ tường thấp; đường nội bộ chạy ngang trước biển.
- Đảo giọt nước lát gạch lục giác: giếng đá ong + cần vọt + bụi tre.
- Lối gạch dưới hàng cây → qua tầng trệt pilotis → sân gạch lớn, tượng Cuder trên nền đất → bậc thềm lên sảnh.
- Toà nhà: cánh trái có logo FPT trên chân chữ V; khối lam gạch phía sau; khối kính xám ở góc đông.
- Đối tượng game: `INT_cong_fville`, `INT_gieng_lang`, `INT_tuong_cuder`; 2 SPAWN, 5 TRIGGER, 34 COL; không có NPC.

### zone_03_lobby — Sảnh lễ tân và Hạt Lúa
- Sảnh 20×14 m, trần 4.2 m: sàn đá granite tối bóng có đèn chấm, quầy lễ tân bo cong, đôn lục giác, chậu cọ, vách lam treo dây leo, cầu thang trang trí.
- Khu Hạt Lúa 12×10 m mở từ sảnh (lối vào rộng 8 m): vách lam hạt lúa, que treo, mảng tường ô màu.
- Đối tượng game: `INT_quay_le_tan`, `INT_hat_lua`; `NPC_le_tan`; 2 SPAWN, 4 TRIGGER, 26 COL.

### zone_04_corridor — Cửa quẹt thẻ, hành lang, cầu thang, cửa FSA
- Tầng trệt: hành lang, panel đục lỗ, **cửa quẹt thẻ** kính khung đen (2 cánh mở được + đầu đọc thẻ).
- Cầu thang chữ U 2 vế (12 bậc × 17.5 cm mỗi vế, rộng 2.6 m) có mặt dốc va chạm để đi được.
- Tầng trên (+4.2 m): giếng trời; **cửa phòng FSA** kính Wing 3 (2 cánh + biển tròn + đầu đọc).
- Đối tượng game: `INT_cua_quet_the`, `INT_cua_phong_fsa`; 2 SPAWN, 5 TRIGGER (gồm `cau_thang`), 27 COL.

### zone_05_office — Văn phòng
- 2 phòng họp hộp kính tối 6×5.5 m (mentor: biển cam, manager: biển xanh).
- Khu team 6 cụm × 8 bàn (dùng chung mesh); bàn intern ở đầu dãy gần lối vào, có laptop, hộp quà, bảng tên trống.
- Khu nghỉ: bàn bi-a, bàn tròn + ghế tulip, kệ ô vuông đỏ, sàn ô màu; trần ô thả, rèm cuốn.
- Đối tượng game: `INT_phong_hop_mentor`, `INT_phong_hop_manager`, `INT_ban_lam_viec`; `NPC_mentor`, `NPC_manager`, `NPC_dong_nghiep_1..3`, `NPC_ban_bi_a`; 4 SPAWN, 5 TRIGGER, 31 COL.

---

## 6. Số liệu

| Zone | Thấp: tam giác | Thấp: GLB | Cao: tam giác | Cao: GLB (gồm lightmap) | Chất liệu |
|---|---|---|---|---|---|
| zone_01_bus | 36,094 | 238 KB | 78,022 | 810 KB | 5 |
| zone_02_campus | 55,286 | 439 KB | 145,676 | 1,322 KB | 8 |
| zone_03_lobby | 48,366 | 325 KB | 62,662 | 718 KB | 7 |
| zone_04_corridor | 9,064 | 94 KB | 9,624 | 232 KB | 4 |
| zone_05_office | 32,086 | 124 KB | 32,862 | 683 KB | 4 |

- Bản Thấp đạt mọi giới hạn của đề bài (< 60k tam giác, ≤ 10 chất liệu, < 5 MB).
- Thời gian build: Thấp khoảng 1 phút/zone; Cao khoảng 4–9 phút/zone (nướng lightmap trên CPU), cả 5 zone khoảng 35 phút.
- FPS đo trên máy dựng (GPU tích hợp AMD Radeon, 1600×900, toon + viền nét): khoảng 65–80 FPS cả 2 bản (giới hạn bởi vsync). Cần đo lại trên máy thật của người chơi.

---

## 7. Cấu trúc code (khoảng 4.400 dòng Python + viewer)

```
scripts/
  build.py                 build zone: Blender → GLB thô → nén Draco → kiểm tra (--tier low|high|both)
  make_site.py             gom bản công khai vào dist/ cho GitHub Pages
  blender/
    zone_01.py … zone_05.py  dựng từng zone (bố cục, đối tượng game, camera so sánh)
    lib/
      quality.py           đọc --quality low|high, hệ số chi tiết cho bản Cao
      palette.py           bảng màu (tên màu → hex)
      materials.py         ≤ 10 chất liệu dùng chung (palette, gloss, glass, light, 6 chất liệu texture)
      mesh.py              MeshBuilder (bmesh + vertex color), hình cơ bản, UV hộp, tô màu theo nhiễu
      kit.py               bộ dựng ngoài trời: cây, bụi, tre, hàng rào, cỏ, cột đèn, toà nhà, mặt tiền, viền vỉa
      props.py             biển chữ 3D, giếng + cần vọt, tượng Cuder, xe bus, bảng tuyến, giàn leo…
      interior.py          nội thất: bàn, ghế, phòng họp, bi-a, quầy lễ tân, đôn, trần, rèm, cửa kính…
      markers.py           tạo COL_/INT_/SPAWN_/NPC_/TRIGGER_ và thuộc tính label
      scene.py             dọn cảnh, bake AO vào vertex color, lưu .blend, xuất GLB, báo cáo JSON
      lightmap.py          trải UV thứ 2, nướng lightmap Cycles, hậu xử lý, nối vào occlusion
      render.py            ánh sáng xem trước, viền nét, camera, render
      zone.py              trình tự chung của 1 zone
  tools/
    extract_frames.py      cắt khung hình video
    sample_colors.py       lấy màu mẫu từ ảnh
    palette_swatch.py      vẽ bảng màu
    make_textures.py       sinh texture (bản thường + @2x)
    compare.py             ghép ảnh tham chiếu | ảnh render
    check_glb.py           kiểm tra tên, extras, COL_ không có chất liệu
    gallery.py             ghép mọi ảnh so sánh của 1 zone (--high cho bản Cao)
viewer/index.html          trang xem thử Three.js
```

Kết quả: `assets/glb/<low|high>/`, `assets/blend/<low|high>/`, ảnh `renders/` (Thấp) và `renders/high/` (Cao), ảnh so sánh 2 mức `renders/tier_compare.jpg`.

---

## 8. Quy ước cho người làm game

- GLB nén Draco → cần `DRACOLoader`; texture WebP.
- Màu nằm ở vertex color `COLOR_0` (đã nhân AO). Chất liệu có texture: màu = texture × `COLOR_0`.
- `extras` trên node: `label` (INT_, NPC_), `yaw_deg` (hướng nhìn của SPAWN_, NPC_), `hinge: true` (cánh cửa xoay quanh gốc node), `placeholder: true`.
- `TRIGGER_*`: empty, vùng = hộp [-1, 1] × scale. `COL_*`: hộp ẩn dùng làm va chạm; cầu thang và bậc thềm có mặt dốc.
- Chuyển zone: `TRIGGER_zone_XX_enter` → đặt người chơi tại `SPAWN_zone_YY_start` hoặc `SPAWN_zone_YY_from_zone_XX`.
- Hai mức đồ hoạ có **cùng tên đối tượng và toạ độ**, code game không phải đổi. Đề xuất chọn mức: đo GPU khi khởi động (vd `detect-gpu`), cho đổi trong Cài đặt, tự hạ xuống Thấp nếu FPS < 40.

---

## 9. Lỗi đã gặp và cách xử lý

| Vấn đề | Cách xử lý |
|---|---|
| winget không tải được ffmpeg | Lấy ffmpeg từ pip `imageio-ffmpeg` |
| Tượng Cuder bị dời về gốc toạ độ | Cập nhật cảnh trước khi gắn object cha |
| Chữ tiếng Việt trong `zone_02.py` bị lỗi mã hoá sau khi PowerShell ghi lại file | Khôi phục bằng Python; từ đó không dùng PowerShell ghi file có tiếng Việt |
| Đồ vật ngoài trời 15.9k tam giác (viền vỉa bo cạnh từng đoạn) | Thay bằng dải vát cạnh liền khối, bỏ bo cạnh cho đồ vật |
| zone_02 lên 73k tam giác sau nâng cấp | Giảm cụm tán cây, bụi trên mái, mấu hàng rào, độ mịn đèn, chữ mặt trong phẳng → 55k |
| Vách lam hạt lúa không hiện (nằm trong tường) | Đẩy ra 0.16 m, bỏ mặt sau |
| Viền vỉa và hàng rào bị lật mặt | Sửa thứ tự đỉnh và nắp hai đầu |
| Lightmap lần đầu gần như trống | Chỉ trải UV mặt ≥ 0.2 m², lề theo tỉ lệ, mặt nhỏ dùng chung điểm sáng |
| Python trong Blender không có Pillow | Hậu xử lý lightmap bằng numpy + lưu ảnh qua Blender |
| Viewer báo FPS 0 / ảnh chụp không đổi | Khung trình duyệt bị ẩn nên trang ngừng vẽ → thêm `__viewer.renderNow()` |
| Link gốc GitHub Pages báo 404 ngay sau khi bật | GitHub giữ bản lỗi cũ tối đa 10 phút, tự hết |

---

## 10. Cách dùng

Build lại zone (mặc định chỉ bản Thấp — bản Cao tạm dừng từ 2026-10-08; thêm `--tier high` / `--tier both` khi bật lại):
```bash
python scripts/build.py zone_01 zone_02 zone_03 zone_04 zone_05
```

Xem trên máy (bản đang làm):
```bash
python -m http.server 8765   # chạy ở thư mục gốc dự án
```
rồi mở http://localhost:8765/viewer/

Cập nhật bản online:
```bash
python scripts/make_site.py
```
```bash
git -C dist add -A
```
```bash
git -C dist commit -m "Cập nhật zone"
```
```bash
git -C dist push
```
GitHub tự cập nhật trang sau khoảng 1 phút; trình duyệt có thể giữ bản cũ tối đa 10 phút (Ctrl+F5 để tải lại).

---

## 11. Riêng tư và bảo mật

- Khung `VanPhongLamViec/t_0008`, `t_0010` (và ảnh ghép `contact_01`) có thẻ nhân viên rõ họ tên → không dùng cho ảnh so sánh hay bất cứ thứ gì chia sẻ.
- Không dựng lại người thật; tên NPC là tên tạm.
- Repo GitHub là **công khai**: chỉ chứa viewer và GLB; commit dùng email ẩn của GitHub.

---

## 12. Việc còn mở / đề xuất tiếp theo

1. Xác nhận vị trí thật của cửa phòng FSA so với cầu thang (hiện tự sắp).
2. Đổi tên NPC tạm (Lan, Minh, Hà) trong `zone_05.py`.
3. Code game: điều khiển nhân vật, va chạm, trigger, hội thoại NPC, chuyển zone — chưa làm (hiện chỉ có viewer).
4. Khi làm game: thêm hook debug (`window.__game`) để kiểm tra bằng số liệu thay vì ảnh chụp (tiết kiệm token).
5. Tuỳ chọn: đóng gói bằng Vite (Three.js và bộ giải nén Draco nằm trong gói, không phụ thuộc CDN).
6. Tuỳ chọn: chỉnh độ đậm lightmap (`lightMapIntensity` ~2.6, Hemisphere ~0.25) ở code game.
7. Nếu cần giới hạn người xem: chuyển sang Cloudflare Pages + Access hoặc Azure Static Web Apps + đăng nhập Entra ID.
