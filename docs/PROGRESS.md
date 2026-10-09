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
- **Sửa 3 lỗi chơi thử (09/10/2026, `main` 9d0fe4a, đã deploy `gh-pages` 0af09a2):**
  - Dòng hướng dẫn điều khiển (cuối màn hình) ẩn khi hộp thoại, mini-game hoặc app My FPT đang mở (`hud.cover`, gọi từ
    `Game.setMode`); đồng hồ 10 giây của dòng này tạm dừng lúc bị ẩn, đóng lại thì hiện nốt (vd tin nhắn HR mở ngay đầu
    game).
  - Camera bị cây che: `game/src/render/seethrough.js` — cây nằm giữa camera và người chơi, hoặc bọc / quẹt sát camera,
    mờ dần bằng dither (Bayer 4×4, 0,3 s; giữ 0,4 s sau khi hết che rồi hiện lại), cả viền nét. Không sửa GLB: mesh cây
    gộp chung (`ENV_vegetation`, `ENV_cay_*`) được chia thành từng cây lúc tải zone; dò che khuất bằng 5 tia từ camera
    tới người chơi (BVH) + lá cách camera < 0,8 m. Cụm thấp hơn 1,2 m (hàng rào, bụi, cỏ) không mờ. 3 chậu cọ sảnh
    zone 3 nằm chung mesh nội thất (`ENV_noi_that`) → chọn bằng hộp trong `data/scene_fixes.json` → `zone_03.see_through`.
    Cấu hình chung: `data/scene_fixes.json` → `see_through`. Chi phí dò ≤ 0,2 ms/khung. Xem bằng `__game.seeThrough`.
  - Console sạch: hết cảnh báo `THREE.Material: parameter 'map' has value of undefined` (túi cầm tay của hành khách tạo
    chất liệu không có texture → `map: null`), `THREE.Clock` thay bằng `THREE.Timer` (`connect(document)`: tab ẩn thì
    dt = 0), thêm favicon rỗng trong `game/index.html` (hết lỗi 404 `/favicon.ico`).
  - Kiểm tra bằng `__game` (Chromium headless): cả 4 zone, đặt người chơi sau cây / cạnh chậu cọ → so ảnh tắt/bật mờ
    cây; chơi trọn mạch zone 0 → 3 (11 nhiệm vụ, 7 mini-game, cảnh lên xe, lối zone 4 vẫn khóa) trên bản dev và bản
    build: 32 lần hộp thoại / mini-game / app mở đều ẩn dòng hướng dẫn; console chỉ còn dòng `[kiểm tra dữ liệu] OK`.

### Nhân vật
- **prajith** (Meshy + Mixamo, đã được duyệt dùng): bản 15k và 6k, 15 animation, dùng tạm cho mọi vai trừ chị Huyền và
  chị Nga.
- **huyen** (Meshy + Mixamo, người thật, đã đồng ý): bản 6k duy nhất, cao 1,60 m, 15 animation retarget từ bộ của
  prajith, logo FPT trên ngực trái. Đóng vai `thao`, tên hiển thị **Ms. Huyền** (zone 0 và zone 1).
- **nga** — Ms. Nga, L1 of Recruitment (Meshy + Mixamo, người thật, đã đồng ý): bản 6k duy
  nhất (5.998 tam giác, 0,59 MB), cao 1,60 m, 15 animation retarget từ bộ của prajith, logo FPT trên ngực trái (7,5 cm,
  giữ nếp vải; WebP 1024 trong GLB vẫn đọc rõ chữ FPT), chân dung. Đóng vai `le_tan` (quầy lễ tân zone 3) và người nói
  `hr` (tin nhắn hẹn xe zone 0), tên hiển thị **Ms. Nga**; lời thoại mới: `docs/dialogue_nga.md`.
  - Bản 6k: mặt trước đã giữ nguyên lúc chuẩn bị Mixamo (~10,7k tam giác) → thêm lượt giảm riêng cho mặt
    (`decimate_protect.face_keep_tris`, `face_detail_pct`: giữ đỉnh có độ tương phản texture cao — mắt, lông mày,
    gọng kính, môi — chỉ giảm da phẳng); thử nhanh bằng `build_character.py --decimate-only`.
  - `nga.glb` và `nga_portrait.png` đã lên `main` (8996537) và đã deploy `gh-pages` 1e646c4 (09/10/2026, sau khi người
    dùng xác nhận đồng ý).
  - Cơ chế chờ đồng ý vẫn còn trong code, hiện không model nào dùng: `models.<id>.consent_pending` + `fallback` → thiếu
    file thì game/viewer dùng model thay thế và không hiện chân dung; bản build (`import.meta.env.PROD`) đổi thẳng,
    không request; `vite build`, `make_site.py` bỏ model đó; `privacy_scan.py` báo lỗi nếu lỡ stage.
  - Quần xanh than (`roles.le_tan.tint.pants = #2f3b55`) để khác Ms. Huyền; áo giữ cam. Tint không loang sang áo/logo.
    Loang nhẹ: vài đốm xanh trên chỗ sáng của giày (da giày sáng, ít màu như quần kem) và thắt lưng còn kem lẫn vài mảng
    xanh — chỉ thấy khi nhìn cận; trong game chị đứng sau quầy nên không thấy chân.
- Công cụ:
  - `prepare_for_mixamo.py`: Meshy → FBX cho Mixamo; `--protect-face`, `--protect-logo` giữ nguyên mặt / vùng logo khi
    giảm tam giác.
  - `build_character.py`: ghép animation, retarget giữa hai nhân vật, giảm tam giác có bảo vệ vùng mặt/logo (và lượt
    giảm riêng phần da phẳng của mặt), đo tốc độ và độ cao ngồi.
  - `apply_chest_logo.py`: dán logo ngực bằng phép chiếu chính diện, tô trắng chữ bị công cụ xoá nền làm trong suốt,
    giữ nếp vải, lan màu ra lề mảnh UV.
  - `render_portrait.py`: chân dung hộp thoại.
  - Viewer: áp tint của vai (dùng chung `game/src/characters/tint.js` qua `viewer/tint.js`); `?compare=` nhận cả id vai
    (vd `?compare=thao,le_tan,prajith`: model + tint + tên hiển thị của vai).

### Tài liệu và repo
- `docs/GDD.md` (thiết kế game), `docs/dialogue_huyen.md` (lời thoại Ms. Huyền), `docs/dialogue_nga.md` (lời thoại
  Ms. Nga), `CREDITS.md`, `CLAUDE.md` (hướng dẫn
  dự án: cấu trúc, quy ước, lệnh build/chạy/deploy, quy tắc đã chốt).
- Repo `thanhdo257205/fville-onboard` tách 2 nhánh (09/10/2026): `main` = mã nguồn, `gh-pages` = bản build (giữ nguyên
  lịch sử build cũ). `dist/` là git worktree của `gh-pages`; deploy bằng `scripts/deploy_site.py`, quét riêng tư bằng
  `scripts/tools/privacy_scan.py`. `.gitignore` loại video/ảnh tham chiếu gốc, FBX Mixamo, file Meshy gốc, texture
  nhân vật, `.blend`, `renders/`, `tools/bin/`, file logo gốc (`assets/logos/`, gỡ khỏi repo 09/10/2026).
- Bản clone mới chạy được không cần máy làm việc gốc: `game/.npmrc` ép `registry.npmjs.org`, `package-lock.json` chỉ
  trỏ về npmjs (trước trỏ mirror `registry.npmmirror.com` làm `npm ci` treo trên máy cloud); đã thử `npm ci` +
  `npm run build`. Hướng dẫn trong `CLAUDE.md` → "Bắt đầu từ bản clone mới".

## Đang dở
- huyen: bàn tay buông lấn vào đùi 3–5 cm ở 7 animation (talk, talk_2, nod, phone, press, wave, cheer) do dùng lại
  animation của prajith; chờ quyết định tải bản Mixamo riêng cho huyen.
- Logo FPT trên áo prajith và huyen là bản tạm (mảng tách từ texture prajith); thay khi có file logo chính thức
  (`apply_chest_logo.py --id <nhân vật> --logo <file>`).
- Lối sang zone 4 đang khóa ("This way opens in the next update"). Còn 3 hạt lúa vàng dành cho zone 4–5.
- nga: tay lún thân 4–6 cm ở talk, talk_2, nod, think, sit_down (cùng mức huyen, do dùng lại animation của prajith).

## Đã quyết
- 09/10/2026: **mọi nhân vật người thật đưa vào game đều đã đồng ý dùng hình, kể cả nhân vật thêm sau này** — không
  cần chặn chờ đồng ý nữa (GLB, chân dung commit và deploy bình thường). Giữ nguyên: không commit ảnh gốc của người
  thật, file Meshy gốc, FBX Mixamo, `.blend`, video/ảnh tham chiếu. Cơ chế `consent_pending` để lại trong code, không
  model nào dùng.
- 09/10/2026: vai `le_tan` → **Ms. Nga** (model `nga`); tin nhắn điện thoại zone 0 (`hr`) cũng hiện Ms. Nga kèm chân dung
  (`characters.json` → `speaker_as.hr = le_tan`). Zone 4: lựa chọn "gọi lễ tân qua app" → "nhắn Ms. Nga qua app"
  (mô tả ô Teamwork đã đổi; câu chữ zone 4 viết khi làm tới).
- GitHub Pages build từ nhánh **`gh-pages`** (Settings → Pages: "being built from the gh-pages branch"); người dùng đã
  chuyển từ trước (xác nhận 09/10/2026). Ghi chú cũ "Pages vẫn lấy từ `main`, cần chuyển nguồn" là sai, đã bỏ.
- 09/10/2026: **không viết lại lịch sử commit** để xóa metadata đường dẫn máy trong 2 ảnh chân dung cũ
  (`prajith_portrait.png`, `huyen_portrait.png` ở các commit build trước 09/10/2026). Bản hiện tại đã sạch; render
  Blender không ghi metadata nữa; `privacy_scan.py` kiểm tra cả metadata ảnh.

## Việc tiếp theo
1. Chơi thử lại bản đã deploy trên máy thật: cây mờ có dễ chịu không (mức mờ `max`, thời gian `fade_s` chỉnh trong
   `data/scene_fixes.json` → `see_through`).
2. Chơi thử với 3–5 người thật trên laptop văn phòng (điều kiện để sang Giai đoạn 2, theo GDD).
3. Giai đoạn 2: zone 4 (cửa quẹt thẻ, phòng FSA; lựa chọn nhắn Ms. Nga qua app — câu dự kiến trong
   `docs/dialogue_nga.md`), zone 5 (gặp Prajith, gặp Manager, Say Hello Team, bàn làm việc), màn tổng kết, danh hiệu,
   tải ảnh thẻ, tab Bản đồ và Sổ lời khuyên.

## Việc nhỏ để sau
- zone_03, cây ngoài sân (`ENV_cay_san`): một cụm khoảng 8,7 × 6,9 × 7,2 m (x 24,8–33,5; z 1,6–8,8, toạ độ glTF) bị
  `seeThrough` gộp thành 1 cây vì các tán dính nhau → khi che thì mờ cả cụm cùng lúc. Chưa cần sửa (cây ngoài vách kính,
  ít khi che người chơi). Cách sửa nếu cần: không gộp mảnh chỉ vì chạm nhau mà tách theo thân cây (mỗi thân + các cụm lá
  gần nó nhất).

## Nội dung [DRAFT] chờ HR (16 mục)
1. Tin nhắn đầu game (Ms. Nga, Tuyển dụng): xe số 2 đi Hòa Lạc, đón lúc 06:45.
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
