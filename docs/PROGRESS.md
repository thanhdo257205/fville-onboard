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
- Zone 4–5 (09/10/2026, `docs/zone45_check.md`): soát node theo GDD và thử va chạm bằng capsule trong game.
  - Thêm `SPAWN_zone_04_from_zone_03`, `SPAWN_zone_05_from_zone_04`.
  - Thêm hộp va chạm đầu hành lang đông zone 4 (trước đây đi qua là rơi khỏi bản đồ) và 2 chậu cọ zone 5.
  - Đã xuất lại GLB bản Thấp.
  - Phần dữ liệu cần làm cho zone 4–5 (đăng ký zone, trigger, 3 hạt lúa, vị trí người lạ) liệt kê trong file đó.
- **Tượng Cuder zone 2 từ mô hình Meshy** (09/10/2026, `scripts/blender/lib/cuder.py`; xem trước riêng:
  `scripts/blender/props/cuder_preview.py`):
  - Thay cả `tuong_cuder_tuong` + `tuong_cuder_be` dựng tay; cùng vị trí, cùng tổng cao 2,384 m, mặt nhìn -Y.
  - File gốc (105k tam giác) chỉ có trên máy làm việc: `assets/props/cuder/source/cuder_meshy.glb`; thiếu thì build
    zone_02 báo lỗi.
  - Làm sạch:
    - lưới vốn liền và kín (0 cạnh hở, không mảnh rời, sau khi gộp đỉnh trùng theo đường nối UV);
    - bệ Meshy thay bằng hộp sạch cùng kích thước (0,63 × 0,54 m, đáy phẳng);
    - mép trước đống xu (số 0/1 vốn chảy nhoè) thay bằng hàng số **010110** sắc nét;
    - cán cuốc kiểm độ thẳng (lệch 0,9 mm, giữ nguyên; lệch > 4 mm thì tự thay hình trụ).
  - Giảm theo vùng còn **7.810 tam giác** (+ búi tóc 119): mặt trước 2.525, tay 686, thân 1.320, đống xu 1.310…
  - Chất liệu đá trắng `statue_white` qua màu đỉnh + AO zone, **không texture**. Đã thử texture AO 512 nướng từ bản
    105k: ở khoảng cách chơi không khác, nhìn cận thêm vài vệt lỗi đường nối, tốn thêm 1 chất liệu + ảnh.
  - Búi tóc tròn sau gáy (nghi AI thêm) là object riêng `tuong_cuder_tuong_buitoc`; `zone_02.py` → `CUDER_KEEP_BUN =
    False` thì bỏ (đầu đã vá).
  - `COL_tuong_cuder` 1,4 × 1,4 → 0,73 × 0,79 m (ôm tượng mới).
  - GLB zone_02: 449.840 → 507.768 byte (+12,9 %).

### Game web — Giai đoạn 1 (vertical slice zone 0 đến zone 3)
- **Đợt 1 (khung):** Vite + three.js 0.186, va chạm capsule (three-mesh-bvh), camera góc thứ ba không xuyên tường,
  màn tạo nhân vật, chuyển zone theo `TRIGGER_`/`SPAWN_`, hội thoại đọc từ JSON, app My FPT (Checklist, Túi đồ,
  Huy hiệu), lưu tiến trình vào trình duyệt, menu Esc, chữ giao diện tách ra `data/i18n/en.json`.
- **Đợt 2 (hệ thống):** bán kính tương tác riêng từng vật, vùng `TRIGGER_` làm vùng tương tác, nhiệm vụ và checklist,
  NPC đứng/ngồi/quay về người chơi, Tú đi theo, 6 giá trị và huy hiệu, ánh sáng theo zone, xoay camera bằng chuột.
- **Mở đầu mới:** zone 0 điểm đón 06:30 (tin nhắn HR, tìm xe số 2, Tú ở mái chờ, chị Huyền ở cửa xe, nhường hành khách)
  và cảnh chuyển lên xe khoảng 21 giây (có Skip) sang zone 1.
- **Đợt 3 (nội dung):**
  - 7 mini-game, chơi bằng chuột và bàn phím, không thua: sai thì gợi ý, sau 2 lần sai có Skip (từ 09/10/2026: gợi ý
    tăng dần, xem "Hướng dẫn người chơi mới"). Gồm: cài app, ảnh check-in, kéo nước giếng, quiz CUDER, sửa hồ sơ, ảnh
    thẻ, dòng thời gian.
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
- **Camera hội thoại (09/10/2026):** `game/src/player/talkcam.js`.
  - Nói chuyện với NPC / Tú: câu đầu tiên của nhân vật → camera chuyển êm 0,4 s sang góc qua vai người chơi, nhìn vào
    mặt người đối thoại: người đối thoại cao ~1/3 khung hình, mặt ở điểm 1/3 (trên, phía không có người chơi), chân nằm
    trên hộp thoại. Đóng hội thoại → chuyển êm 0,4 s về camera chơi (yaw / pitch / khoảng cách như trước khi mở).
  - Tin nhắn điện thoại (Ms. Nga đầu game) và lời dẫn narrator (biển xe, bản đồ tuyến…) giữ nguyên camera; hội thoại
    đã chuyển camera thì câu narrator ở giữa không đổi lại.
  - Camera nằm trên đường thẳng từ mặt người đối thoại qua điểm cạnh vai người chơi (0,6 m) → người chơi không che.
    Không xuyên tường / quầy: lùi dọc đường đó, chạm `COL_` (BVH va chạm) thì dừng trước 0,2 m (thu gần lại); lúc
    chuyển giữa chừng cũng kéo vào theo va chạm. Không thấp hơn tầm mắt người chơi.
  - Chọn góc: 2 vai × 2 độ cao, chấm theo khoảng lùi được, mặt / ngực có bị bối cảnh che (lưới mesh hiển thị có BVH, dựng
    lúc tải zone ~45 ms, trừ cây vì cây tự mờ — lúc nói chuyện `seeThrough` xét đường nhìn tới người đối thoại) và
    Tú / NPC khác che không; chọn góc ~0,3 ms. Không góc nào thấy mặt → giữ camera chơi.
  - Mini-game chụp ảnh giữa hội thoại (ảnh thẻ với Ms. Nga) dùng camera riêng; xong thì chuyển êm về camera hội thoại.
  - Kiểm tra bằng `__game` (dev + bản build), ảnh trước/sau: Ms. Huyền (cửa xe zone 0, zone 1), Ms. Nga (quầy zone 3),
    bác tài xe 1 (zone 0), Tú (mái chờ zone 0, kêu mất balo zone 1). Trước: Ms. Huyền bị người chơi che 3/3 điểm đo,
    Ms. Nga 2/3. Sau: không điểm nào bị che, người đối thoại cao 0,35–0,36 khung (0,51–0,62 khi bị chắn phải thu gần),
    mặt đúng điểm 1/3, camera không cắt `COL_`; đóng hội thoại camera về chỗ cũ (lệch ≤ 4 cm, hướng trùng). Chuyển
    0,4 s = 24 khung ở 60 FPS, không giật. Chơi trọn zone 0 → 3 vẫn qua, console sạch. Xem trạng thái: `__game.talkCam`.
- **Sửa sau lần kiểm tra camera hội thoại (09/10/2026, `main` f8c9356, đã deploy `gh-pages` 53b8578 — gồm cả camera
  hội thoại ở trên):**
  - Camera hội thoại coi tán cây / chậu cây (plant của `seeThrough`) và mọi mesh hiển thị (mái hiên, biển hiệu, ban công…
    không có `COL_`) là vật cản như tường: lùi qua là dừng trước 0,2 m; góc không dùng nếu camera / điểm qua vai nằm trong
    hoặc sát (< 0,15 m) bề mặt, trong tán cây, hay camera lùi chưa được 0,3 m. Thử 2 vai × 2 độ cao; không góc nào hợp lệ
    → giữ camera chơi (vd người chơi ép sát bó vỉa, sau lưng là thân xe). `__game.talkCam.pick` ghi lý do từng góc.
  - `seeThrough`: camera nằm hẳn trong tán (cụm lá to hơn `near_m`) → mờ cây đó. Kiểm tra "trong tán" theo từng mảnh kín
    (cụm lá, thân, chậu): tia từ camera cắt mặt mảnh đó số lẻ lần (các cụm lá chồng nhau nên không gộp cả cây); khớp
    343/343 điểm thử với đếm chẵn lẻ 3 hướng khác. Camera chơi chui vào tán cây số 8 zone 0 (đúng hiện tượng "cả màn hình
    xanh lá") → cây mờ hẳn.
  - zone_00: mặt tiền dãy nhà phố bắc (mái hiên vải, biển hiệu, ban công có chậu bụi) gộp chung mesh nhà, không có `COL_`
    → camera chơi lùi vào trong (cách mesh 0,02 m). Thêm hộp chắn camera `camera_mat_tien_bac` trong
    `data/collision.json` (z −7 … −5,75, từ cao 2,2 m trở lên — người chơi vẫn đi dưới mái hiên): camera dừng ở z −5,5.
  - Bác tài zone_01 dời ra vỉa hè cạnh cửa xe, phía đầu xe (`data/characters.json` roles.tai_xe: `near_node` NPC_tai_xe
    + offset, yaw −30° nhìn về phía vỉa hè / Ms. Huyền); điểm tương tác theo chỗ bác đứng (`interactables.json` `at`);
    cảnh xe vào trạm: bác "xuống trước" cùng Ms. Huyền (`cutscenes.json` off_before_us, bỏ ride_along). Lời thoại và ô
    Tôn trọng giữ nguyên (đã thử: chọn câu cảm ơn → `respect`, `z1_thank_driver`). Camera hội thoại thấy mặt bác.
  - Lời nhắc E với người (NPC_ / Tú): kiểm tra đường nhìn ngang tầm mặt (BVH `COL_`) — đứng trong / bên kia thân xe, sau
    vách kính mái chờ thì không hiện; qua quầy lễ tân vẫn hiện.
  - Thử: Ms. Huyền 8 hướng có / không có Tú (phía vỉa hè: góc qua vai, camera cách bề mặt ≥ 0,62 m; sát bó vỉa: giữ camera
    chơi; trong thân xe: không còn lời nhắc), 7 tình huống camera hội thoại cũ (kể cả bác tài zone_01) đều bật, không bị
    che; chơi trọn zone 0 → 3 (dev + bản build), console sạch.

- **Hướng dẫn người chơi mới (09/10/2026, `main` a3ca18e + 6124460, đã deploy `gh-pages` 4b4494d)** — nguyên tắc: lúc nào cũng biết "giờ làm gì" trong vài giây. Code
  `game/src/game/guide.js`; chữ trong `data/guidance.json` (tiếng Anh) và `data/i18n/en.json` (`guide.*`, `menu.guide*`).
  - **Chỉ đường:** mục tiêu hiện tại = quest bắt buộc đầu tiên chưa xong của zone (`quests.json` → `target`); zone xong hết
    → `guidance.json` → `zone_exits` (zone 1 → cổng F-Ville, zone 2 → cửa tòa nhà; zone 3 hết việc → không có dấu, H nói
    phần tiếp theo mở ở bản sau). Dấu **"!"** nổi trên target (NPC/Tú: trên bảng tên; INT_ có hình: trên đỉnh khối;
    INT_ rỗng có vùng tương tác: trên hộp TRIGGER_ = chỗ đứng bấm E; TRIGGER_: trên đỉnh hộp), nhấp nhô, viền cam như
    bảng tên. Target ngoài khung nhìn → **mũi tên** tròn có "!" ở mép màn hình (chừa dòng mục tiêu phía trên và lời
    nhắc E / dòng điều khiển phía dưới; sau lưng → chúc xuống). Chỉ hiện lúc đang đi lại (tắt khi hội thoại, mini-game,
    app, menu, cảnh chuyển, chụp ảnh). Menu Esc → **Objective markers: On / Off** (lưu trong cài đặt trình duyệt).
  - **Mini-game:** trước mỗi trò có lời giới thiệu luật / thứ tự: Ms. Huyền nói đủ 3 bước cài app (tải → đăng nhập bằng
    mã intern trong tin nhắn Ms. Nga → bật thông báo; tin nhắn đầu game thêm mã **FV-2026** [DRAFT]); Ms. Nga nói luật
    phiếu hồ sơ và ảnh thẻ; Tú nói luật ảnh check-in, giếng, tượng Cuder, dòng thời gian (hội thoại `*_intro`, lần đầu;
    bỏ ngang rồi quay lại thì vào thẳng). Gợi ý tăng dần cho mọi trò (`minigames/host.js`): **8 s không thao tác** →
    gợi ý của bước đang làm (vàng); **sai 2 lần ở một bước** → làm sáng lựa chọn đúng (cài app: bước kế; giếng: vùng xanh
    rộng thêm 0,12 và sáng; quiz: đáp án; hồ sơ: dòng sai rồi giá trị đúng; dòng thời gian: hiện năm trên mọi thẻ);
    **sai 3 lần** → nút Skip (đi tiếp, vẫn nhận phần thưởng bắt buộc, không cộng Hiểu biết của trò đó). Cài app: dòng
    trạng thái lúc đầu "Ready to set up — which step comes first?", xong mỗi bước đổi thành câu hoàn tất ("My FPT
    downloaded ✓ — what's next?", "Logged in as {player} ✓ — one more step!", "Notifications on ✓"). Đã rà 7 trò: chỗ
    nào cũng có chữ nói việc cần làm (ảnh: "chọn dáng rồi Space", "Enter giữ ảnh / R chụp lại").
  - **Nhắc khi đứng yên:** 30 s không tiến triển nhiệm vụ (chỉ tính lúc đang đi lại) → Tú nói 1 câu bong bóng trên đầu
    (không mở hộp thoại, không dừng game, 5 s); không có Tú đi cùng (zone 0 trước khi gặp Tú, hoặc Tú ở xa > 15 m) →
    tin nhắn điện thoại ngắn góc phải trên từ Ms. Huyền (zone 0–2) hoặc Ms. Nga (zone 3–4). Mỗi mục tiêu tối đa 2 lần,
    lần 2 sau thêm 45 s. Có câu nhắc (2 câu Tú + 2 tin nhắn) cho mọi mục tiêu bắt buộc zone 0–3 và lối ra zone 1, 2;
    thời gian chỉnh trong `guidance.json` → `settings`.
  - **Phím H / nút Help trong app My FPT:** thẻ "What now?" với gợi ý của mục tiêu hiện tại (+ việc phụ đang nhận: tìm
    balo cho Tú, trả ví); bấm H lần nữa thì ẩn, tự ẩn sau 8 s hoặc khi đổi mục tiêu / sang zone. Dòng điều khiển thêm
    "H: help". Kiểm tra dữ liệu lúc tải: thiếu help / câu nhắc → báo lỗi.
  - Sửa kèm: camera lúc vào zone_00 không còn quay ngược ra cuối phố (tán cây không tính là vật che khi chọn hướng
    camera ban đầu — cây tự mờ; chấp nhận hướng gốc nếu lùi được ≥ 60% khoảng cách) → thấy ngay các xe bus và dấu "!".
    Mini-game mở từ hội thoại không còn bắt người chơi quay mặt về người đối thoại (ảnh check-in sau lời Tú: người chơi
    nhìn camera). Menu Esc chỉ cập nhật dòng FPS mỗi 0,5 s thay vì vẽ lại cả bảng (trước đó bấm nút có thể hụt).
  - **Thử như người mới** (bot chỉ nhìn dấu "!" / mũi tên, bấm E khi có lời nhắc, không teleport; dev và bản build): trọn
    zone 0 → 3 trong ~215 s giờ game (đọc mỗi câu 1,5 s, mini-game giải theo luật). **Không lần nào đứng yên quá 10 s.**
    Kẹt ngắn (đi thẳng về phía dấu thì đụng vật, né sang bên 2–5 s là qua): zone_00 (5,2; −0,3) cột biển trạm sát bó
    vỉa giữa xe 3 và xe 2; zone_01 (12,6; −6,9) vỉa hè đường ra cổng; zone_02 (18,5; −13,6) bờ tường thấp gò cỏ biển
    chữ khi đi từ chỗ chụp ảnh sang tượng Cuder; zone_02 (12,2; −35,7) khe giữa bồn cây và canteen. Người thật sẽ tự
    đi vòng; ghi lại để theo dõi khi chơi thử với người. Không lần nhắc nào bật trong lượt bot (mỗi mục tiêu xong < 30 s);
    đã thử riêng: tin nhắn Ms. Huyền (zone 0, chưa gặp Tú), bong bóng Tú (zone 0, zone 2), tin nhắn Ms. Nga (zone 3, ẩn
    Tú), lần nhắc thứ 3 không bật, tắt dấu trong menu. Console sạch.

- **Hiệu năng (09/10/2026, chi tiết + số đo trước/sau: `docs/perf_report.md`):**
  - Đo bản deploy trên máy thật: Chrome dùng GPU tích hợp AMD Radeon, không lấy RTX 3060 dù xin `high-performance`.
    Không zone nào dưới 30 FPS: 1920×1010 đạt 85–98 FPS, 1366×768 đạt 117–131 FPS.
  - **Hết giật khi vào zone:**
    - Trước đây lần nào vào zone khung đầu cũng đứng 90–285 ms vì phải biên dịch shader; lần đầu mở game là 960 ms.
    - Nay `renderer.warmup` biên dịch shader trong lúc màn chờ còn che: `compile()` + 1 khung vẽ mọi vật, mất 50–90 ms.
    - Không dùng `compileAsync`, vì đo trên máy này nó mất 0,37–0,88 s.
  - **Mở game nhanh hơn:**
    - Bản build bỏ bước đối chiếu node GLB; bước này vẫn chạy ở bản dev.
    - Trong lúc người chơi điền tên, game tải song song file zone đầu, GLB nhân vật và bộ giải nén Draco/Meshopt.
    - 2 s sau khi vào zone, game tải sẵn GLB của zone kế tiếp.
    - Lần đầu mở game (trễ 0,3 s/file): tới màn tạo nhân vật 3,3 → 1,7 s; từ Start tới lúc hình chạy mượt
      ~2,3 → 0,6 s.
  - **Menu Esc → Detail (Auto / Sharper / Faster):**
    - Auto: đã ở mức Thấp mà FPS vẫn < 45 thì hạ từng nấc, pixelRatio 1,25 → 1,0 rồi tắt viền nét; mỗi nấc nhẹ hơn
      khoảng 19 % và 27 %.
    - Lựa chọn lưu trong `fville.settings` → `detail`.
  - `scripts/tools/slow_server.py`: server tĩnh có độ trễ để đo trước/sau; cấu hình `perf-before` / `perf-after` trong
    `.claude/launch.json`.
- **Nội dung tượng Cuder từ mentor (09/10/2026, `data/quiz.json` → quiz `cuder`, bỏ [DRAFT]):**
  - Câu chuyện 4 đoạn: CU (cucumber) + DER (coder); đầu to, kính, bụng tròn; cây cuốc = gốc nông nghiệp và tinh thần
    chăm chỉ, đống xu 0/1 = thế giới số; con người là cốt lõi thành công của FPT.
  - 3 câu hỏi mới: tên Cuder từ đâu, cây cuốc tượng trưng gì, điều gì là cốt lõi thành công của FPT. Câu giải thích do
    nhóm game viết, chỉ nhắc lại ý câu chuyện.
  - Game không xáo phương án quiz → đáp án đúng đặt ở vị trí 2, 3, 1. Lời giới thiệu của Tú giữ nguyên.
  - Đã chạy thử trên bản dev: đọc câu chuyện, trả lời sai (hiện gợi ý) rồi đúng (hiện giải thích), nhận huy hiệu
    6 giá trị, +10 Hiểu biết, checklist "Cuder Statue" ✓, console sạch.

### Game web — Giai đoạn 2: zone 4 (09/10/2026, `main` aee0dee, đã deploy `gh-pages` 15f3036 — gồm cả commit hiệu năng 76d9914)
- **Zone 4 · Cửa quẹt thẻ, cầu thang, Cửa Phòng FSA** (GDD mục Zone 4). Lời thoại: `data/dialogues.json` → `card_gate`,
  `fsa_visit`, `fsa_remind`; tài liệu `docs/dialogue_nga.md` mục 3, `docs/dialogue_huyen.md` mục 4.
  - **Dữ liệu theo `docs/zone45_check.md`:** zone_04, zone_05 vào `zones.json`; trigger zone 3 ↔ 4 ↔ 5 (zone 4 → 5 cần
    quẹt thẻ + phòng FSA); 3 hạt lúa còn lại (chiếu nghỉ zone 4; nóc kệ ô vuông và gầm bàn bi-a zone 5, `snap: false`
    giờ được truyền đúng); người lạ dời ra cạnh đầu đọc thẻ (`offset [1.9, 0, 0.6]`, nhìn về phía người chơi đi tới).
    Quest mới `z4_card_gate`, `z4_fsa` (checklist Card Gate, FSA Room). 3 ô giá trị zone 4 bật (`values.json` active).
  - **Cửa quẹt thẻ:** bấm E ở đầu đọc → "Beep — green light!", Hiểu biết +5, chữ lớn "First card tap!". Hai cánh cửa
    (`cua_quet_the_canh_trai/_phai`, custom property `hinge`) xoay 90° quanh bản lề mở vào phía cầu thang trong 0,9 s,
    `COL_cua_quet_the` bỏ khỏi va chạm. Cấu hình bằng dữ liệu: `data/scene_fixes.json` → `zone_04.doors` (cánh + góc,
    COL bỏ, điều kiện mở); vào lại zone thì cửa mở sẵn. Xoay bằng quaternion quanh trục Y của node cha (cánh phải có
    Euler 180/0/180 — chỉnh `rotation.y` làm cánh mở ngược ra hành lang). Cửa phòng FSA mở khi xong Lộ trình học.
  - **Tình huống 1 · người lạ xin đi ké** (ngay sau khi cửa mở): *"Sure, come on in."* → người lạ đi qua cửa về phía
    cầu thang rồi khuất, Ms. Huyền nhắn nhắc nhẹ (không có ô); *"Sorry, I can't let you in — reception can help you."*
    → ô **Role Model**, người lạ cảm ơn và đi về phía sảnh.
  - **Tình huống 2 · thẻ Tú báo đỏ:** *"Sure, come with me."* → Ms. Huyền nhắn: bạn bè cũng không đi ké; *"I'll message
    Ms. Nga in the app."* → tin nhắn trả lời của Ms. Nga đúng như `docs/dialogue_nga.md`, thẻ Tú xanh, ô **Teamwork**,
    Kết nối +5; *"Maybe ask at reception?"* → Tú tự đi về phía sảnh, khuất, 40 giây sau quay lại cạnh người chơi với bong
    bóng "I'm back! Reception sorted my card out." (không ô, không điểm).
  - **Phòng FSA:** đọc biển sứ mệnh FSA [DRAFT], Tú nói luật (Tú vắng thì lời dẫn nói luật), mini-game **Lộ trình học**
    (`minigames.learning_path`, `kind: learning_path`): xếp 3 khóa gợi ý theo vị trí intern (Developer / Tester / BA /
    Designer, [DRAFT]) vào lịch Mon / Wed / Fri, khóa cơ bản trước (mỗi thẻ ghi "Start here" / "After: …"); kéo thẻ vào
    lịch, hoặc click / phím 1–3. Gợi ý tăng dần như mọi mini-game (8 s → gợi ý ngày đang xếp; sai 2 → sáng thẻ đúng; sai
    3 → Skip). Xếp xong hỏi có tự đặt mục tiêu riêng không (3 lựa chọn + "Not now"): chọn → ô **Innovation**. Nhận
    **Sổ tay học tập**, Hiểu biết +10.
  - **Tú chia tay:** sau Lộ trình học, *"My team's on the floor above. See you after work, okay?"*, Tú đi vòng giếng trời
    về phía cầu thang rồi khuất (cờ `tu_said_bye` → từ đó không còn đi theo, zone 5 không có Tú). Tú đang ở lễ tân lúc
    xong FSA → nhắn tin chào thay.
  - **Hội thoại nhiều người:** camera hội thoại và hướng người chơi chuyển sang người đang nói (người lạ rồi Tú); NPC nói
    trong hội thoại không bắt đầu từ họ (người lạ) cũng quay về phía người chơi. Hiệu ứng mới: `banner` (chữ lớn giữa màn
    hình), `walk` (NPC / Tú đi chỗ khác rồi khuất; Tú quay lại sau `return_s`).
  - **Hướng dẫn:** câu nhắc (help, 2 câu Tú, 2 tin nhắn Ms. Nga) cho 2 mục tiêu zone 4 và lối ra zone 3, zone 4; zone 5
    hiện "Explore the Office" + help "các cuộc gặp mở ở bản sau". Phòng FSA ở tầng 2 → dấu "!" đi theo điểm dẫn đường
    (`guidance.json` → `goals.z4_fsa.route`): chân cầu thang ngay sau cửa → nửa tây chiếu nghỉ → nửa đông chiếu nghỉ
    (đi thẳng từ đầu vế 1 tới đầu vế 2 vướng lan can giữa) → đầu vế 2 → góc tây bắc tầng 2 (vòng giếng trời) → cửa FSA.
  - **Sửa bằng dữ liệu, không sửa GLB** (nên sửa thật trong `scripts/blender/zone_04.py` khi dựng lại zone):
    - `SPAWN_zone_04_from_zone_03` chỉ cách tường cuối hành lang 1,15 m → camera phải quay ngang nhìn vào tường. Thêm
      `zones.json` → `spawn_offset` (xuất hiện lùi vào 2 m): camera đứng sau lưng, thấy dọc hành lang tới cửa quẹt thẻ.
    - Vách phía trên cửa quẹt thẻ (cao 2,55–3,6 m) không có COL_ → đi lên vế 1, camera lọt khe ra hành lang, vách che đầu
      người chơi (5/64 mẫu). Thêm hộp `camera_tren_cua_quet_the` (`data/collision.json`) → 0/117 mẫu bị che.
    - **Mép tây chiếu trên (đầu vế 2, tầng 2) hở, không lan can lẫn COL_:** từ đầu vế 2 đi về phía tây là rơi xuống giếng
      cầu thang (bot người chơi mới rơi 2 lần). Thêm hộp `lan_can_chieu_tren` cao 2,6–6 m (người đi tầng trệt không
      vướng). Quét 9 điểm × 16 hướng × 3 s chạy: không còn chỗ rơi.
  - **Camera ở cầu thang và chiếu nghỉ** (sảnh hẹp 7 m, trần 7,4 m): đi lên + xuống 2 vế, đo mỗi 0,25 s: camera cách bề
    mặt ≥ 0,13 m, không mẫu nào bị che đầu người chơi; xoay camera 8 hướng ở chiếu nghỉ: không bị che (sát góc tường thì
    camera kéo gần tới 0,86 m). Camera hội thoại với Tú ở chiếu nghỉ, giữa vế 1, giữa vế 2: đều bật, thấy mặt Tú.
  - `zoneTime` tăng ở mọi zone (trước chỉ tăng ở zone có sự kiện → việc "quay lại sau 40 s" không chạy ở zone 4).
- **Zone 5:** vào được qua cửa FSA, NPC đứng/ngồi đúng chỗ, 2 hạt lúa; chưa có việc (gặp Prajith, Manager, Say Hello
  Team, bàn làm việc làm ở đợt sau).
- **Kiểm tra:** chơi trọn zone 0 → 4 rồi vào zone 5 **không teleport** (bot chỉ nhìn dấu "!" / mũi tên, bấm E khi có lời
  nhắc, ở cửa quẹt thẻ chọn từ chối người lạ + nhắn Ms. Nga), bản dev và bản build sau khi gộp commit hiệu năng: trọn
  mạch 293 s giờ game (zone 4: 62 s), **không lần nào đứng yên quá 10 s**, không lần nhắc nào phải bật. Kẹt ngắn mới ở
  zone 4: người lạ đứng gần đường thẳng từ đầu hành lang tới dấu "!" của cửa (4,8; −1), né sang bên 3 s là qua. Thử riêng 2 nhánh còn lại (cho người lạ vào, Tú quay lại lễ tân), mini-game (gợi ý 8 s,
  sáng thẻ đúng, mục tiêu riêng), bị chặn khi vào cửa FSA chưa làm Lộ trình học, sang zone 5. Console sạch.

### 4 Act, thành tựu cuối, sửa quiz (09/10/2026, `main` 2c6c88d, đã deploy `gh-pages` 9494993)
- **4 Act** (`data/acts.json`, `game/src/game/acts.js`; GDD mục Cấu trúc 4 Act): ACT 1 ENTER THE VILLAGE (Bus — gồm điểm
  đón zone 0 + bến xe zone 1 và cài app, F-Ville Gate, Village Well, Cuder Statue), ACT 2 BECOMING A FSOFTER (Reception,
  Rice Grain Room, Card Gate), ACT 3 JOINING FSA (FSA Room, Meet Prajith, Meet Manager), ACT 4 JOINING THE TEAM (Say
  Hello Team, Your Desk). Act gom các mục checklist có sẵn (đúng id), Act xong khi mọi mục xong.
  - Thẻ tiêu đề Act ~2,2 s, không chặn điều khiển: lúc bắt đầu game (Act hiện tại, cả khi chơi tiếp bản lưu; trước thẻ
    tên zone) và ngay khi xong mục cuối của Act trước — không phụ thuộc chuyển zone (Act 2 hiện khi xong việc cuối ở
    zone 2; Act 3 hiện ngay sau "First card tap!" ở cửa quẹt thẻ). Thẻ chữ lớn giữa màn hình (tên zone, "First card
    tap!", Act, thành tựu) giờ xếp hàng, không đè nhau (`hud._queueCard`).
  - App My FPT → Checklist nhóm theo Act: tiêu đề "ACT n · tên", tiến độ x/y + thanh, Act đang làm màu cam, Act xong có
    ✓; mục zone 5 (chưa có việc) hiện 🔒 "Later today". Kiểm tra dữ liệu: mỗi mục checklist thuộc đúng 1 Act.
- **Thành tựu cuối** (`data/achievements.json` → `final`): "ACHIEVEMENT UNLOCKED: Welcome to the F-Ville Family" luôn mở
  khi hoàn thành game — hiệu ứng `"finish": true` (gắn vào việc cuối ở bàn làm việc khi làm zone 5) → `Game.finishGame()`:
  cờ `achievement_welcome_family` + `game_complete`, thẻ thành tựu vàng giữa màn hình, rồi **màn tổng kết dựng sẵn**
  (`game/src/ui/summary.js`): thành tựu đứng đầu, rồi danh hiệu chính / phụ (6 danh hiệu GDD, tên tiếng Anh + điều kiện
  trong `achievements.json → titles`), ảnh check-in, Hiểu biết / Kết nối, hạt lúa, 6 ô giá trị, tiến độ 4 Act, nút Close
  (Esc) / Play again. Chưa có zone 5 nên chưa có chỗ gọi trong mạch chơi; thử bằng `__game.finish()`, xem
  `__game.summary`, `__game.acts`, `__game.cards`.
- **Quiz:** câu chuyện Cuder hiện thành đoạn (`white-space: pre-line` cho `.quiz .story`); phương án xáo lại mỗi lần chơi
  cho mọi quiz (đáp án, gợi ý khi sai, giải thích vẫn khớp; làm sáng đáp án đúng sau 2 lần sai theo vị trí đã xáo; thử 8
  lần ra 7 thứ tự khác nhau); câu 2 Cuder cân độ dài phương án: đúng "Farming roots and hard work, now in tech", sai
  "Digging for gold in the hills" / "Building new roads for the city" / "Winning a big sports trophy" (giữ hint, explain).

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
- **intern_nam, intern_nu — nhân vật NGƯỜI CHƠI (hư cấu, Meshy; 10/10/2026), mới tới bước chuẩn bị Mixamo:**
  - Nam cao 1,70 m (gốc 71k tam giác), nữ 1,60 m (56k) → 25.000 tam giác, đứng chữ A, nhìn -Y, giữ nguyên mặt và vùng
    logo khi giảm. FBX cho Mixamo: `assets/characters/intern_nam/intern_nam_for_mixamo.fbx`,
    `assets/characters/intern_nu/intern_nu_for_mixamo.fbx` (không commit).
  - Sửa texture theo vị trí 3D (`texture_fixes.json`): mặt trong cổ áo Meshy tô màu da lởm chởm → tô lại màu áo (cả
    hai); mắt intern_nam to hơn 15% (phóng đều đồng tử + lòng trắng, lông mày không đổi) — so trước/sau: giữ.
  - Logo FPT ngực trái (cùng file logo của nga): nam 7,5 cm tại z 1,275 m, nữ 7 cm tại z 1,19 m (hạ 1 cm cho cách mũi
    cổ áo như áo nga); cùng tỉ lệ vị trí với nga và prajith.
  - 2 bộ texture cùng UV (`outfit_textures.py`): `ao_cam` (áo cam + logo, bản chuẩn) và `dau_ngay` (áo xanh nhạt
    #cfe0ee giữ nếp vải, không logo); mặt nạ vùng 512 px (áo, quần, giày, da, tóc). Đường dẫn ghi ở
    `data/characters.json` → `models.intern_nam/intern_nu.textures`; vai player chưa đổi, code chưa sửa.
  - Ảnh: `renders/characters/<id>_trang_phuc.png` (chính diện 2 bộ, mặt nạ trước/sau, cận ngực logo, cận mặt).
- Công cụ:
  - `prepare_for_mixamo.py`: Meshy → FBX cho Mixamo; `--protect-face`, `--protect-logo` giữ nguyên mặt / vùng logo khi
    giảm tam giác. `texture_fixes.json` thêm `collar` (tô lại mặt trong cổ áo theo pháp tuyến mượt quay vào trục cổ) và
    `magnify` (phóng to một vùng như mắt, lấy mẫu qua tia chiếu chính diện); chạy lại thì xoá `_basecolor_nologo.jpg`
    cũ để `apply_chest_logo.py` dựng lại từ ảnh mới.
  - `outfit_textures.py`: mặt nạ vùng theo hình khối (cắt dưới nách tách tay / thân + chân / phần trên → quần không bao
    giờ so màu với da), màu chỉ để tách trong từng khu, dọn mảng vụn theo liên thông; đổi màu áo giữ nếp vải.
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
- `docs/perf_report.md` (hiệu năng, số đo trước/sau), `docs/zone45_check.md` (soát zone 4–5),
  `docs/hr_content_request.md` (15 mục nội dung cần HR cung cấp, theo zone, gửi thẳng cho HR được).
- Bản clone mới chạy được không cần máy làm việc gốc: `game/.npmrc` ép `registry.npmjs.org`, `package-lock.json` chỉ
  trỏ về npmjs (trước trỏ mirror `registry.npmmirror.com` làm `npm ci` treo trên máy cloud); đã thử `npm ci` +
  `npm run build`. Hướng dẫn trong `CLAUDE.md` → "Bắt đầu từ bản clone mới".

## Đang dở
- intern_nam, intern_nu: chờ người dùng gắn xương trên Mixamo (2 FBX ở trên) → `mixamo/` → `build_character.py`
  (6k, `--single`), chân dung; sau đó mới đổi vai player và làm đổi texture `dau_ngay` → `ao_cam` khi nhận Áo Cam
  (cần quyết cách đưa bản `dau_ngay` vào game: texture riêng nén WebP hay cách khác — `textures/` hiện không commit).
  Mặt nạ intern_nu: lọn tóc mảnh vắt ngang trán (vẽ trên da mặt, giữa lọn có vệt sáng trắng) đang tính là da — chỉ ảnh
  hưởng khi sau này đổi màu tóc.
- huyen: bàn tay buông lấn vào đùi 3–5 cm ở 7 animation (talk, talk_2, nod, phone, press, wave, cheer) do dùng lại
  animation của prajith; chờ quyết định tải bản Mixamo riêng cho huyen.
- Logo FPT trên áo prajith và huyen là bản tạm (mảng tách từ texture prajith); thay khi có file logo chính thức
  (`apply_chest_logo.py --id <nhân vật> --logo <file>`).
- Zone 5 vào được nhưng chưa có việc: gặp Prajith (La bàn nghề nghiệp), gặp Manager (Sắp xếp ưu tiên, ô Wisdom), Say
  Hello Team (Sổ lời khuyên), bàn làm việc; cảnh kết, màn tổng kết, danh hiệu. Đủ 10 hạt lúa vàng (zone 1–5).
- nga: tay lún thân 4–6 cm ở talk, talk_2, nod, think, sit_down (cùng mức huyen, do dùng lại animation của prajith).
- Tượng Cuder: chờ xác nhận búi tóc sau gáy (giữ / bỏ: `CUDER_KEEP_BUN` trong `scripts/blender/zone_02.py`). Khi đã
  chốt, dọn mép búi tóc (còn răng cưa nhỏ khi nhìn cận từ phía sau). zone_03 vẫn còn bản sao tượng cũ nhìn qua vách
  kính (`ENV_tuong_cuder_xa`) — đổi theo tượng mới nếu cần.

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
1. Chơi thử hệ thống hướng dẫn với người mới thật: có ai đứng yên quá 10 s không, câu nhắc có đúng lúc không (thời gian
   chỉnh trong `data/guidance.json` → `settings`; câu chữ trong `goals`), dấu "!" có quá lộ không (tắt trong menu Esc).
2. Chơi thử lại bản đã deploy trên máy thật: cây mờ có dễ chịu không (mức mờ `max`, thời gian `fade_s` chỉnh trong
   `data/scene_fixes.json` → `see_through`), camera hội thoại (chỉnh khung hình bằng các hằng số đầu
   `game/src/player/talkcam.js`: `FRAME_FRAC`, `FACE_AT`, `SHOULDER`, `BLEND_S`).
3. Chơi thử với 3–5 người thật trên laptop văn phòng (điều kiện để sang Giai đoạn 2, theo GDD).
   Đo luôn hiệu năng trên một laptop Intel UHD/Iris Xe: mở `?debug`, gõ `__game.benchmark(120)` ở từng zone; xem
   nấc Detail tự hạ có bật không (`__game.state.detailLevel`).
   Gửi `docs/hr_content_request.md` cho HR.
4. Giai đoạn 2 tiếp: zone 5 (gặp Prajith, gặp Manager, Say Hello Team, bàn làm việc — quest gắn vào mục checklist
   `meet_prajith`, `meet_manager`, `hello_team`, `desk` thì Act 3–4 tự mở khóa), cảnh kết, gắn `"finish": true` vào việc
   cuối (thành tựu + màn tổng kết đã dựng sẵn), hoàn thiện màn tổng kết (nhân vật áo cam, lời nhắn Prajith, tải ảnh thẻ),
   tab Bản đồ và Sổ lời khuyên.

## Việc nhỏ để sau
- zone_04 (đang chặn bằng dữ liệu, nên sửa trong `scripts/blender/zone_04.py` khi dựng lại zone): thêm lan can thật ở mép
  tây chiếu trên (x 3,4, z −3 … −1,65) và COL_ cho vách trên cửa quẹt thẻ; dời `SPAWN_zone_04_from_zone_03` vào trong
  ~2 m (rồi bỏ `spawn_offset` trong `zones.json`).
- zone_03, cây ngoài sân (`ENV_cay_san`): một cụm khoảng 8,7 × 6,9 × 7,2 m (x 24,8–33,5; z 1,6–8,8, toạ độ glTF) bị
  `seeThrough` gộp thành 1 cây vì các tán dính nhau → khi che thì mờ cả cụm cùng lúc. Chưa cần sửa (cây ngoài vách kính,
  ít khi che người chơi). Cách sửa nếu cần: không gộp mảnh chỉ vì chạm nhau mà tách theo thân cây (mỗi thân + các cụm lá
  gần nó nhất).

## Nội dung [DRAFT] chờ HR (17 mục)
1. Tin nhắn đầu game (Ms. Nga, Tuyển dụng): xe số 2 đi Hòa Lạc, đón lúc 06:45, mã intern FV-2026 để đăng nhập App My FPT.
2. Giờ xe về (chị Huyền trả lời ở zone 0).
3. Quy định trên xe công ty (chị Huyền trả lời ở zone 0).
4. Bản đồ tuyến xe ở zone 1: xe sáng đến 07:30, xe về 17:30 và 18:15.
5. Mô tả phần thưởng huy hiệu 6 giá trị.
6. Mô tả phần thưởng Welcome Kit.
7–12. Tên tiếng Anh của 6 giá trị: Respect, Innovation, Teamwork, Fairness, Role Model, Wisdom.
13. Dòng giải thích huy hiệu 6 giá trị.
14. 3 mẩu thông tin trong mini-game kéo nước giếng.
15. 5 mốc của mini-game dòng thời gian (1988, 1999, 2006, 2018, 2019): năm và cách viết.
16. Biển sứ mệnh FSA ở cửa phòng FSA (zone 4).
17. Mini-game Lộ trình học: 3 khóa gợi ý cho mỗi vị trí intern (zone 4).

Danh sách lấy từ dữ liệu (`"draft": true`); trong game các nội dung này hiện chữ [DRAFT]. Quiz tượng Cuder đã có nội
dung từ mentor (09/10/2026), không còn [DRAFT].
