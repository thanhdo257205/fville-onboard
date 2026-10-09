# Tiến độ — Ngày Đầu Ở F-Ville

Cập nhật: 09/10/2026. Bản chơi thử: https://thanhdo257205.github.io/fville-onboard/game/ (xem bối cảnh:
`/viewer/`).

Quy ước: cuối mỗi lần làm việc cập nhật file này, commit và push nhánh `main`.

## Đã xong

### Bối cảnh 3D (Blender → GLB)
- 6 zone dựng bằng script Python chạy lại được (`scripts/blender/zone_00.py` … `zone_05.py`, thư viện dùng chung
  `scripts/blender/lib/`): zone 0 điểm đón xe bus trong phố, zone 1 bến xe F-Ville, zone 2 cổng · giếng làng · tượng
  Cuder, zone 3 sảnh lễ tân · Phòng Hạt Lúa, zone 4 cửa quẹt thẻ · hành lang · cầu thang · phòng FSA, zone 5 văn phòng.
- Xuất GLB nén Draco, validate 0 lỗi; game và viewer chỉ dùng bản đồ họa **Thấp** (bản Cao có lightmap, đang tạm dừng).
- Đối tượng game đặt tên theo quy ước `COL_`, `INT_`, `SPAWN_`, `NPC_`, `TRIGGER_`, `PATH_`, `CAM_`.
- Viewer Three.js (`viewer/index.html`): toon shading, viền nét, nhân vật tại `NPC_`, so sánh model
  (`?compare=prajith,huyen`).

### Game web — Giai đoạn 1 (vertical slice zone 0 đến zone 3)
- **Đợt 1 (khung):** Vite + three.js 0.186, va chạm capsule (three-mesh-bvh), camera góc thứ ba không xuyên tường,
  màn tạo nhân vật, chuyển zone theo `TRIGGER_`/`SPAWN_`, hội thoại đọc từ JSON, app My FPT (Checklist, Túi đồ,
  Huy hiệu), lưu tiến trình vào trình duyệt, menu Esc, chữ giao diện tách ra `data/i18n/en.json`.
- **Đợt 2 (hệ thống):** bán kính tương tác riêng từng vật, vùng `TRIGGER_` làm vùng tương tác, nhiệm vụ và checklist,
  NPC đứng/ngồi/quay về người chơi, Tú đi theo, 6 giá trị và huy hiệu, ánh sáng theo zone, xoay camera bằng chuột.
- **Mở đầu mới:** zone 0 điểm đón 06:30 (tin nhắn HR, tìm xe số 2, Tú ở mái chờ, chị Huyền ở cửa xe, nhường hành khách)
  và cảnh chuyển lên xe khoảng 21 giây (có Skip) sang zone 1.
- **Đợt 3 (nội dung):**
  - 7 mini-game, chơi bằng chuột và bàn phím, không thua: sai thì gợi ý, sau 2 lần sai có Skip. Gồm: cài app,
    ảnh check-in, kéo nước giếng, quiz CUDER, sửa hồ sơ, ảnh thẻ, dòng thời gian.
  - Ảnh check-in và ảnh thẻ chụp từ canvas (JPEG có giới hạn dung lượng), hiện trong app.
  - Sự kiện Tú quên balo ở zone 1; 7 hạt lúa vàng ở zone 1–3; hũ thủy tinh ở Phòng Hạt Lúa đếm số hạt.
  - Sửa lỗi chơi thử đợt trước: camera lúc xuất hiện, capsule cho NPC và Tú, Tú đi chếch sau, màu áo/quần riêng từng NPC.
  - Chỗ chuẩn bị âm thanh (`game/src/core/sound.js`, chưa có file âm thanh).
- Đã chạy thử trọn zone 0 → hết zone 3 (ước tính 12–14 phút theo mạch chính) và đưa lên GitHub Pages.

### Nhân vật
- **prajith** (Meshy + Mixamo, đã được duyệt dùng): bản 15k và 6k, 15 animation, dùng tạm cho mọi vai trừ chị Huyền.
- **huyen** (Meshy + Mixamo, người thật, đã đồng ý): bản 6k duy nhất, cao 1,60 m, 15 animation retarget từ bộ của
  prajith, logo FPT trên ngực trái. Đóng vai `thao`, tên hiển thị **Ms. Huyền** (zone 0 và zone 1).
- Công cụ: `prepare_for_mixamo.py` (Meshy → FBX cho Mixamo), `build_character.py` (ghép animation, retarget giữa hai
  nhân vật, giảm tam giác có bảo vệ vùng mặt/logo, đo tốc độ và độ cao ngồi), `apply_chest_logo.py` (dán logo ngực),
  `render_portrait.py` (chân dung hộp thoại).

### Tài liệu và repo
- `docs/GDD.md` (thiết kế game), `docs/dialogue_huyen.md` (lời thoại Ms. Huyền), `CREDITS.md`, `CLAUDE.md` (hướng dẫn
  dự án: cấu trúc, quy ước, lệnh build/chạy/deploy, quy tắc đã chốt).
- Repo `thanhdo257205/fville-onboard` tách 2 nhánh (09/10/2026): `main` = mã nguồn, `gh-pages` = bản build (giữ nguyên
  lịch sử build cũ). `dist/` là git worktree của `gh-pages`; deploy bằng `scripts/deploy_site.py`, quét riêng tư bằng
  `scripts/tools/privacy_scan.py`. `.gitignore` loại video/ảnh tham chiếu gốc, FBX Mixamo, file Meshy gốc, texture
  nhân vật, `.blend`, `renders/`, `tools/bin/`.
- Bản clone mới chạy được không cần máy làm việc gốc: `game/.npmrc` ép `registry.npmjs.org`, `package-lock.json` chỉ
  trỏ về npmjs (trước trỏ mirror `registry.npmmirror.com` làm `npm ci` treo trên máy cloud); đã thử `npm ci` +
  `npm run build`. Hướng dẫn trong `CLAUDE.md` → "Bắt đầu từ bản clone mới".

## Đang dở
- Lỗi từ lần chơi thử (chưa sửa):
  - Hộp thoại đè lên dòng hướng dẫn điều khiển.
  - Camera bị cây che.
  - Có cảnh báo trong console.
- huyen: bàn tay buông lấn vào đùi 3–5 cm ở 7 animation (talk, talk_2, nod, phone, press, wave, cheer) do dùng lại
  animation của prajith; chờ quyết định tải bản Mixamo riêng cho huyen.
- Logo FPT trên áo prajith và huyen là bản tạm (mảng tách từ texture prajith); thay khi có file logo chính thức
  (`apply_chest_logo.py --id <nhân vật> --logo <file>`).
- Lối sang zone 4 đang khóa ("This way opens in the next update"). Còn 3 hạt lúa vàng dành cho zone 4–5.
- GitHub Pages vẫn lấy từ nhánh `main` (kiểm tra 09/10/2026: `/game/` trả `index.html` mã nguồn, game không chạy) —
  người dùng cần chuyển nguồn sang nhánh `gh-pages`, thư mục `/` (Settings → Pages).

## Đã quyết
- 09/10/2026: **không viết lại lịch sử commit** để xóa metadata đường dẫn máy trong 2 ảnh chân dung cũ
  (`prajith_portrait.png`, `huyen_portrait.png` ở các commit build trước 09/10/2026). Bản hiện tại đã sạch; render
  Blender không ghi metadata nữa; `privacy_scan.py` kiểm tra cả metadata ảnh.

## Việc tiếp theo
1. Sửa 3 lỗi chơi thử ở trên.
2. Chơi thử với 3–5 người thật trên laptop văn phòng (điều kiện để sang Giai đoạn 2, theo GDD).
3. Giai đoạn 2: zone 4 (cửa quẹt thẻ, phòng FSA), zone 5 (gặp Prajith, gặp Manager, Say Hello Team, bàn làm việc),
   màn tổng kết, danh hiệu, tải ảnh thẻ, tab Bản đồ và Sổ lời khuyên.

## Nội dung [DRAFT] chờ HR (16 mục)
1. Tin nhắn HR đầu game: xe số 2 đi Hòa Lạc, đón lúc 06:45.
2. Giờ xe về (chị Huyền trả lời ở zone 0).
3. Quy định trên xe công ty (chị Huyền trả lời ở zone 0).
4. Bản đồ tuyến xe ở zone 1: xe sáng đến 07:30, xe về 17:30 và 18:15.
5. Mô tả phần thưởng huy hiệu 6 giá trị.
6. Mô tả phần thưởng Welcome Kit.
7–12. Tên tiếng Anh của 6 giá trị: Respect, Innovation, Teamwork, Fairness, Role Model, Wisdom.
13. Dòng giải thích huy hiệu 6 giá trị.
14. Quiz CUDER: câu chuyện, 3 câu hỏi và gợi ý.
15. 3 mẩu thông tin trong mini-game kéo nước giếng.
16. 5 mốc của mini-game dòng thời gian (1988, 1999, 2006, 2018, 2019): năm và cách viết.

Danh sách lấy từ dữ liệu (`"draft": true`); trong game các nội dung này hiện chữ [DRAFT].
