# Tiến độ — Ngày Đầu Ở F-Ville

Cập nhật: 10/10/2026. Bản chơi thử: https://thanhdo257205.github.io/fville-onboard/game/ (xem bối cảnh:
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

### Chơi nhiều người mức "thấy nhau" (09/10/2026, `main` d5727d5 + bddb7f6, đã deploy `gh-pages` 1a78a90 — mạng tắt)
- **Một phòng chung**, không mã phòng (`docs/multiplayer.md`, GDD mục Chơi nhiều người). `data/net.json` → `url` trống =
  tắt mạng: bản gh-pages lần này để trống, game y như chơi một mình (đã thử: chơi trọn zone 0 → 5 không teleport trên bản
  build, không có WebSocket, không góc online / phím T / dòng menu, console sạch).
- **Máy chủ `server/`**: Cloudflare Worker + 1 Durable Object `fville`, WebSocket Hibernation API, gói Free (Durable Object
  kiểu SQLite nhưng không ghi gì — trạng thái chỉ trong bộ nhớ + attachment theo từng kết nối). Tin `join` / `state` /
  `emote` / `phrase` / `leave` / `ping` (ping do runtime tự trả lời). Chỉ phát cho người cùng zone; vào zone nhận danh
  sách người cùng zone + số online toàn phòng. Kiểm tra đầu vào: tên ≤ 20 ký tự (lọc ký tự lạ), số hữu hạn, zone
  `zone_NN`, emote / câu chat theo danh sách trong `data/net.json`; 10 tin/s mỗi kết nối (gấp 3 thì ngắt 4003), tối đa
  60 kết nối (người thứ 61 nhận lý do rồi bị đóng 4001), im lặng > 60 s bị ngắt (4002), chỉ nhận trang github.io +
  localhost. `GET /status`: số online, số người từng zone (không tên).
- **Trong game** (`game/src/net/`, `game/src/ui/emotes.js`): kết nối sau "Start my first day"; lỗi mạng → chơi một mình,
  tự thử lại 2 → 60 s, mất mạng thì chờ có mạng; người khác dùng model + bộ đồ họ gửi (model lạ → model người chơi),
  bảng tên viền xanh ngọc, idle / walk / run / sit theo state, nội suy trễ 120 ms, 10 người gần nhất cùng zone, không va
  chạm, ngoài khung nhìn không vẽ, viền nét chỉ trong 12 m; góc dưới phải "N online · M in this zone"; phím T: Wave / Nod /
  Cheer + 6 câu soạn sẵn thành bong bóng (bong bóng của Tú); menu Esc "Show other players: On / Off" (lưu); dòng điều
  khiển thêm "T: wave & chat". Hội thoại: ẩn người đứng sát người chơi / người đối thoại; mini-game: ẩn hết; dấu "!",
  gợi ý E, camera hội thoại không đổi. Bản dev nhận `?net=ws://…` để thử; `__game.net`, `netEmote`, `netPhrase`.
- **Đã thử** (`wrangler dev`, Chromium headless): 3 trình duyệt cùng lúc thấy nhau, đi (B thấy A đi đúng chỗ, anim walk),
  emote, câu chat qua bảng T, cooldown, đổi zone, Show other players Off / On, tắt máy chủ (vẫn chơi, ẩn góc online) rồi
  bật lại (cả 3 tự vào lại sau ~11 s), 1 máy offline rồi online (vào lại ngay); hội thoại / mini-game không bị ảnh hưởng;
  giao thức (lọc tên, số lỗi, zone lạ, emote lạ, dồn tin → 4003, 61 kết nối → 4001, im lặng 60 s → 4002).
- **Đo tải** (`scripts/tools/net_bots.js`, 20 bot đi 60% thời gian): máy chủ nhận 62 tin/s (3,1/người), phát ~1.250/s;
  1 giờ 21 người ≈ 11.800 request → hạn 100.000/ngày đủ ~8,5 giờ (xấu nhất: mọi người đi liên tục ~5,3 giờ). FPS phía
  người chơi (headless, vẽ bằng CPU): 13,7 → 11,7 (−14%) với 20 bot (hiện 10) — cần đo lại trên laptop thật.
- **Chưa lên mạng**: máy cloud không đăng nhập Cloudflare được → bản Desktop làm theo `docs/multiplayer.md` (wrangler
  login, wrangler deploy, điền URL vào `data/net.json`, build, deploy gh-pages, kiểm tra).

### Giai đoạn 2: zone 5, cảnh kết, màn tổng kết (10/10/2026)
- **Màn tạo nhân vật** có mục giới tính (Male / Female → `intern_nam` / `intern_nu`; `character_creation.genders`).
- **Nhân vật zone 5** (`data/characters.json`): Prajith = model `prajith` thật (bỏ đổi màu áo). Manager (`intern_nu`, áo xanh
  than), Lan (`intern_nu`, hồng), Minh (`intern_nam`, vàng), Hà (`intern_nu`, xanh lá), anh Khang (`intern_nam`, tím) — **tạm**
  (`_tam` trong từng vai), `"portrait": false` (không hiện chân dung trùng mặt người chơi; `characters.js` → `portrait()`).
- **Zone 5** (`dialogues.json`, `quests.json` z5_*, `interactables.json`, `guidance.json`; GDD mục Zone 5 "Đã làm"):
  - app báo "📅 09:15 · Meeting with Prajith" khi vào zone; Prajith nhắn tin nhắc (zone 5 không có Tú: `no_tu_zones`);
  - dấu "!" dẫn tới cửa phòng họp rồi mới vào trong (`route`);
  - Prajith → mini-game La bàn nghề nghiệp (`compass`: 4 câu, 4 xu hướng × 4 vị trí intern) → thẻ trong My FPT → Bag,
    Kết nối +5;
  - Manager (chỉ sau Prajith) → mục tiêu team [DRAFT] → mini-game Sắp xếp ưu tiên (`priorities`: sai 1 lần → góp ý đúng
    chỗ sai + xếp lại 1 lần; hợp lý → ô Wisdom, đã bật `active`) → Nhiệm vụ đầu tiên trong app → Act 4;
  - màn mờ "12:00 · The team invites you to lunch" (hiệu ứng `time_skip`), sáng lại buổi chiều 13:30 (`zones.json` →
    `variants`: ánh sáng + giờ theo cờ);
  - Lan, Minh, Hà: mỗi người 1 lời khuyên → tab **Advice** (Sổ lời khuyên, `rewards.json` → `advice`, hiệu ứng `advice`);
    Lan / Hà nói chuyện được qua mặt bàn (bán kính 2,4 m);
  - anh Khang (tùy chọn): mini-game Một cú bi-a (`billiards`: canvas, ngắm + thanh lực, sai 2 lần → đường ngắm gợi ý),
    thêm 1 lời khuyên;
  - bàn làm việc (chỉ sau Manager; chưa chào đủ team thì hỏi trước): hộp quà [DRAFT] → mini-game Đăng nhập [DRAFT]
    (`login`: 5 quy định mật khẩu, thanh độ mạnh, bật 2FA; không lưu mật khẩu) → bảng tên trên bàn hiện tên người
    chơi (vật code đặt `bang_ten`, canvas) → checklist ngày đầu tự tick (`day_checklist`) → Hiểu biết +10, `finish`.
- **Cảnh kết** (`cutscenes.json` → `ending`, `game/src/game/ending.js`): 17:30 Lan đứng cạnh bàn → thẻ "17:30 · Time to head
  home" → bến xe zone_01 hoàng hôn (variant theo cờ `game_complete`) → Tú chạy tới (lời theo số lần đã giúp; Tú hiện lại
  nhờ `hide_if.not_flags`) → lên xe, cửa đóng → thẻ thành tựu → màn tổng kết. Skip được. Sau đó đi lại tự do ở bến xe lúc
  hoàng hôn, dòng mục tiêu "Your first day is complete! 🎉", không còn dấu "!".
- **Màn tổng kết**: ảnh thẻ (áo cam) + huy hiệu + ảnh check-in, danh hiệu, chỉ số, hạt lúa, 6 ô giá trị (ô trống có gợi ý),
  lời nhắn Prajith theo La bàn, 4 Act; nút **Download card (PNG)** (canvas 720 × 1080), **Play again**, **Close**.
- **Mạng**: người chơi đang ngồi trên xe bus (cảnh chuyển, cảnh kết) báo `transit_zone` (`data/net.json`, `zone_99`) →
  người khác thấy họ rời đi lúc bước lên xe, không còn đứng ở cửa xe; máy chủ không cần sửa.
- Code khác: hiệu ứng `unflags`, `advice`, `compass`, `time_skip`; `finish` / `time_skip` chạy sau khi hội thoại đóng
  (`Game.afterDialogue`); ô chữ (mật khẩu) không điều khiển nhân vật (`input.js`); __game: `ending`, `summaryCard()`.
- **Kiểm tra** (bản build `vite preview`, máy chủ mạng local `wrangler dev` 127.0.0.1:8787, không dùng máy chủ thật):
  - Chơi trọn zone 0 → 5 không teleport, tới màn tổng kết, nam ("Minh Anh", intern_nam) và nữ ("Thu Hà", intern_nu):
    đủ 4 Act (4/4, 3/3, 3/3, 2/2), cảnh kết đủ nhịp (alarm → lan → card → tu_run → tu_line → board → door_close → done),
    thẻ thành tựu, màn tổng kết, tải ảnh thẻ PNG 720 × 1080 (~310 KB). Console chỉ còn dòng kiểm tra dữ liệu OK.
  - Mạng: người A lên xe bus zone 0 → 1, người B đứng ở bến: A gửi zone_00 → zone_99 → zone_01; sau khi A khuất vào xe B
    không còn thấy A (0/72 mẫu). Zone 5: 3 bot (`net_bots.js --zone zone_05`) hiện đủ quanh người chơi, "4 online · 4 in
    this zone".
  - Bản đã deploy (`dist/` = gh-pages, phục vụ local vì máy cloud không vào được github.io; net.json chặn về máy chủ
    local): vào game, chọn được Male / Female, zone 5 đủ 6 NPC, console sạch.
  - `main` 08872eb (+ e338289 PROGRESS); đã deploy `gh-pages` 0be1660 (từ `main` e338289, chơi nhiều người vẫn bật
    `wss://fville-net.fville-onboard.workers.dev/ws`).

### Sửa lỗi review zone 5 + bộ kiểm thử tự động (10/10/2026)
- **Sửa lỗi review commit 08872eb:**
  1. Màn tổng kết không mất nữa: cờ `summary_seen` chỉ lưu khi màn tổng kết đã mở; tải game có `game_complete` → vào bến
     xe zone_01 lúc hoàng hôn (trạng thái cuối cảnh kết, kể cả khi tải lại lúc còn ở zone_05), chưa `summary_seen` thì
     hiện thẻ thành tựu + màn tổng kết (`Game.resumeSummary`). Xem lại bất cứ lúc nào: menu Esc → **View summary**, nút
     đầu tab Checklist của app. `game_complete` và `summary_seen` lưu ngay (không chờ 300 ms).
  2. Mini-game Đăng nhập: bỏ `<form>`, ô username ẩn, `autocomplete="new-password"`; ô nhập `type="text"` +
     `autocomplete="off"` + ẩn ký tự bằng `-webkit-text-security: disc` (trình duyệt không hỗ trợ → `type="password"`
     ngoài form); Enter qua `ctx.onKey`. Mật khẩu không lưu, không log, không gửi (debug chỉ trả đúng / sai từng quy định).
  3. Màn mờ "12:00 · lunch": Esc không mở menu giữa chừng; cờ `lunch_done` vào bản lưu ngay khi áp hiệu ứng (trước khi mờ).
  4. Tên file ảnh thẻ bỏ dấu đúng (NFD + xoá `\p{M}`, đ → d): "Nguyễn Thị Hà" → `fville-first-day-nguyen-thi-ha.png`.
  5. `roundRect` có phương án dự phòng (arcTo) cho trình duyệt cũ; tạo / tải ảnh hỏng → báo ngay trong màn tổng kết.
  6. `host.js end()`: hiệu ứng dạng danh sách (flags, quest, reward…) của kết quả trò **gộp** với `result` trong data
     (trước đây ghi đè: bi-a mất cờ `billiards_played`).
- **Lỗi khác tìm ra nhờ bộ kiểm thử:**
  - Tú kêu mất balo lúc hoàng hôn sau cảnh kết nếu sáng đó rời zone_01 trước 20 giây (sự kiện zone_01 thêm
    `not_flags: game_complete`).
  - Bấm View summary trong menu: khoá con trỏ tới muộn sau khi màn tổng kết đã mở (con trỏ bị ẩn) → `input.js` nhả ngay
    khoá tới muộn khi game không ở chế độ chơi; menu → tổng kết không đi qua chế độ chơi.
  - Màn tạo nhân vật / mini-game trên màn thấp (điện thoại xoay ngang ~360 px): nút Start bị khuất dưới mép → bảng cuộn được.
  - Code chết: khung mini-game tạm `MinigamePanel` (panels.js) dùng chữ i18n không có.
- **Bộ kiểm thử** (`scripts/tests/`, chạy trong `game/`):
  - `npm run test:data` (Node, không trình duyệt, ~40 ms + khởi động npm): JSON hợp lệ (16 file), `validateLinks`, node
    GLB (94 tham chiếu, đọc khối JSON của GLB), bản lưu mẫu cho 5 zone, 126 chữ `t("…")` trong code có trong `en.json`,
    model của các vai có GLB / chân dung / texture bộ đồ.
  - `npm run test:smoke` (Playwright 1.56.1 = devDependency, Chromium headless, `?net=off`): tự bật Vite dev (hoặc
    `--build` = `vite preview` trên game/dist, `--url` = server sẵn có), chơi zone 0 → 5 bằng `__game.step()` cho 3 ngoại
    hình (intern_nam, intern_nam_kinh, intern_nu; tên có dấu). Mỗi zone 1 dòng: việc bắt buộc xong, đúng áo, sang đúng
    zone, console sạch. Zone 5 thêm: lunch_done + Esc lúc màn mờ, Đăng nhập không form / gợi ý mật khẩu, tải lại giữa cảnh
    kết (ngoại hình đầu), màn tổng kết + summary_seen + tải ảnh thẻ (tên file bỏ dấu), Close → menu → View summary.
    `--zone N`: bản lưu mẫu `?start=zone_0N` (dựng từ data bằng `game/src/game/autoplay.js`, chạy nhanh hội thoại gắn với
    đích từng việc bắt buộc).
  - Thời gian (máy cloud, Chromium phần mềm): test:data 0,3 s; test:smoke 3 ngoại hình zone 0 → 5: 4 phút 5 giây (dev),
    4 phút 1 giây (build), 34 bước đạt; `--zone 5` 3 ngoại hình 2 phút 29 giây (19 bước); `--zone 3` 1 ngoại hình 9 giây.
  - Tham số thử dùng được cả trên bản build khi có `?debug`: `?start=`, `?look=`, `?gender=`, `?net=…`; `?net=off` mọi lúc.
  - `.github/workflows/test.yml`: push main → test:data + build + test:smoke `--build --look intern_nam`; chạy tay → 3
    ngoại hình; ảnh bước hỏng = artifact `test-results`. Không cần secret.
  - `CLAUDE.md` → mục "Kiểm thử": sau mỗi thay đổi chạy test:data + test:smoke (hoặc `--zone N`); chỉ tự lái trình duyệt
    khi cần xem bằng mắt, tối đa 3 ảnh.
- `main` 774fb9e; đã deploy `gh-pages` d82183d (từ `main` 774fb9e, chơi nhiều người vẫn bật).

### Bàn bi-a zone 5 từ mô hình Sketchfab (10/10/2026)
- "Pool Table Traditional" (fizyman, Sketchfab, CC BY 4.0) thay bàn dựng tay ở khu nghỉ zone_05, cùng chỗ (tâm (-4, 3)
  Blender, trục dài theo X dưới 3 đèn thả chao inox cũ — giữ đèn). File gốc chép vào
  `assets/props/pool_table/source/pool_table_traditional.glb` (không commit); `scripts/blender/lib/pool_table.py` dựng lại
  mỗi lần build zone_05 (cùng cách tượng Cuder), thiếu file → build báo lỗi kèm link nguồn.
- Xử lý: bỏ đèn treo (700 tam giác, chất liệu phát sáng); 4 chất liệu PBR (normal, metallic-roughness, transmission,
  alpha BLEND làm mặt nỉ trong suốt) → 1 chất liệu `M_pool_tex` = atlas 1024 × 768 (bàn 768², bi 256 × 512, cơ 256²) ×
  vertex color (AO của zone) → game đổi toon + viền nét như mọi vật; lưới túi lỗ thành đục. Atlas WebP **52 KB** (12 ảnh
  PNG gốc ~6 MB). Giảm lưới bàn theo từng mảnh liền: **19.954 → 8.262 tam giác** (chân tiện 9.408 → 2.633, mặt nỉ + băng
  2.324 → 1.162, thanh viền 3.296 → 1.483, nắp lỗ 2.520 → 1.386, lưới túi lỗ 2.016 → 1.208, yếm giữ 390); bi 16 × 192,
  cơ 2 × 270 giữ nguyên. Tên: `pool_table` (gốc = tâm bàn trên sàn), con: `ball_0` (bi trắng) … `ball_15` (số theo màu
  chuẩn, gốc = tâm bi), `cue` (dựng cạnh bàn), `cue_2` (nằm trên mặt nỉ); bi + cơ `dynamic` (không AO, sau này lăn được).
- `data/pool.json` (build ghi lại, đừng sửa tay; toạ độ glTF world + local của `pool_table`): mặt chơi trong băng
  **2,2535 × 1,1337 m** (bàn 8 feet), mặt nỉ cao 0,7614 m, bàn 2,491 × 1,407 × 0,815 m, bi r 2,85 cm, 6 lỗ (tâm miệng lỗ,
  r ~5,7–5,8 cm, điểm xa nhất 6,6–7,1 cm), vị trí xếp 16 bi.
- `COL_ban_bi_a` theo kích thước thật (2,491 × 1,47 × 0,815 m, gồm cây cơ dựng cạnh bàn; trước: 2,7 × 1,6 × 0,9),
  `NPC_ban_bi_a` giữ chỗ cũ; lối khu nghỉ → văn phòng / phòng FSA thông. Hạt lúa `z5_ban_bi_a` (dưới mép băng) vẫn trong
  tầm nhặt 1,4 m. zone_05: 32.086 → 43.700 tam giác, GLB **129 → 312 KB** (+183 KB). check_glb 0 lỗi.
- Kiểm tra: test:data đạt; test:smoke `--zone 5` thêm bước bàn bi-a (node + 16 bi + cơ + COL) + anh Khang → mini-game Một
  cú bi-a chạy, cờ billiards_played: **23 bước đạt, 3 ngoại hình (1 phút 42 giây)**. Ảnh:
  `renders/zone_05_office_khu_nghi.png` (toàn cảnh khu nghỉ, camera mới), `zone_05_office_ban_bi_a_can.png` (cận bàn).

### Màn chọn nhân vật mới, Tú khác giới với người chơi (10/10/2026)
- **Màn chọn nhân vật** (`game/src/ui/creator.js`, thay nút Male / Female): cảnh 3D nhỏ (renderer riêng + viền nét) với
  intern_nam, intern_nam_kinh, intern_nu đứng trên bục, mặc dau_ngay, phát idle; người đang chọn bước lên, vẫy tay, vòng
  sáng cam dưới chân; 2 người còn lại lùi nhẹ, tối hơn. Đổi: bấm vào nhân vật (tia trúng trụ ẩn quanh người), ←/→ khi
  canvas / nút mũi tên đang được chọn, nút ‹ ›; kéo chuột / vuốt xoay 360°. Thẻ thông tin: chân dung, tên gọi + 1 dòng
  mô tả (`character_creation.looks`: Easygoing / Bookworm / Go-getter, không nói về giới tính), nút "Preview FPT shirt"
  (aria-pressed; đổi cả 3 nhân vật và chân dung sang ao_cam). Giữ ô tên, vị trí intern, nút Start (Enter trong ô tên).
  3 GLB tải song song khi mở màn (cùng bộ nhớ đệm với game), chữ "Loading characters…"; màn < 700 px hoặc Detail =
  Faster (hoặc WebGL / GLB lỗi): 3 thẻ chân dung (radio) thay cảnh 3D. Bắt đầu chơi → dừng vòng vẽ, huỷ chất liệu riêng +
  renderer (`forceContextLoss`), không đụng GLB / texture dùng chung. Giới tính suy ra từ nhân vật; bản lưu `player.look`
  (bản lưu cũ không có → model mặc định theo giới tính). Radio vị trí / thẻ ảnh trước đây `display: none` (Tab không vào
  được) → ẩn trực quan, có viền khi focus. Bảng tạo nhân vật trên màn ≤ 400 px tràn 24 px (content-box + padding, có từ
  trước) → `box-sizing: border-box`.
- **Tú khác giới với người chơi** (`roles.tu.model_by_gender`: người chơi nam → `intern_nu`, nữ → `intern_nam_kinh`; bỏ
  model prajith + tint áo cũ). Bộ đồ ngày đầu không trùng người chơi (`roles.tu.outfit.texture_by_model`): intern_nu →
  `tu_dau_ngay` (polo vàng nhạt #f3df8a theo mặt nạ áo, giữ nếp vải, không logo — `outfit_textures.py --outfit
  tu_dau_ngay --shirt f3df8a`, WebP 66 KB), intern_nam_kinh → `dau_ngay` (áo phông xanh ngọc). Ở cổng zone 2 Tú cũng
  đổi sang Áo Cam (cùng lúc chụp check-in): `Game.updateOutfit` áp cho cả người chơi và Tú.
- **Chân dung theo bộ đồ**: `models.<id>.outfit_portraits.<bộ>` (`render_portrait.py --outfit`), `Characters.portrait`
  chọn theo bộ đang mặc (`characters.wearing`). Có cho tu_dau_ngay (intern_nu) và dau_ngay của cả 3 nhân vật người chơi →
  chân dung người chơi trước cổng giờ cũng mặc áo ngày đầu (trước đây luôn là áo cam). Tú không còn dùng ảnh Prajith.
  `vite.config.js` cho phép `<id>_portrait_<bộ>.png` (trước đó server dev trả index.html — ảnh vỡ, test đã thêm kiểm tra).
- **Đại từ của Tú**: biến `{tu_he}` `{tu_his}` `{tu_him}` `{tu_himself}` (+ `{Tu_he}`… viết hoa) thay ở mọi chữ (`i18n.fill`
  dùng chung cho `t()` và `tx()`; `Characters.gender` đặt theo giới tính model của Tú). Rà toàn bộ data: 5 câu nói về
  Tú (lời dẫn trên xe bus, Tú quẹt thẻ, gợi ý tìm balo, chụp check-in, mô tả danh hiệu Teammate No. 1); "He slips through…
  / He heads back…" ở cửa quẹt thẻ là người lạ → giữ. GDD: mục Tạo nhân vật, bảng nhân vật, "Đại từ của Tú".
- **Kiểm thử**: test:data thêm "đại từ của Tú" (Tú khác giới theo data; không còn he/his/him/she/her cứng nhắc tới Tú —
  tên gần nhất trước đại từ là Tú, hoặc câu dẫn không tên ngay sau lời của Tú; biến `{tu_*}` hợp lệ và thay hết cho cả 2
  giới), chân dung theo bộ đồ, texture bộ đồ của vai, tên / mô tả ngoại hình. test:smoke chọn qua màn mới (ngoại hình 1:
  3D + phím ←/→, 2: 3D + bấm chuột, 3: thẻ ảnh màn hẹp; xem trước áo, ảnh tải được thật, cảnh 3D được giải phóng), kiểm
  tra Tú trước / sau cổng (model, áo, chân dung là ảnh PNG thật, câu dẫn "her backpack … beside her" / "his … him").
  Kết quả: test:data đạt; test:smoke 3 ngoại hình zone 0 → 5: **43 bước đạt (2 phút 45 giây)**. Thử ngược: bỏ sửa
  `vite.config.js` → test đỏ đúng 2 bước (ảnh màn chọn, chân dung Tú).
- Ảnh: `renders/game/creator_3d.png`, `creator_the_anh.png`, `tu_nu_hoi_thoai.png`.
- Deploy (10/10/2026): trước khi deploy chạy lại trên máy cloud — test:data đạt hết (7 mục, 0,3 s), test:smoke 1 ngoại hình
  (intern_nam, zone 0 → 5) **15 bước đạt (1 phút 17 giây)**. `main` 3bf9623; đã deploy `gh-pages` e6e73ee (từ `main`
  3bf9623, chơi nhiều người vẫn bật).

### Sửa lỗi kẹt zone 4 trên trang thật (10/10/2026)
- **Lỗi** (gh-pages e6e73ee): vào zone 4 thì đứng mãi ở màn "Heading to Card Gate · FSA Room…", tải lại (Ctrl+F5) vẫn kẹt;
  console: `Uncaught (in promise) Error: zone_04: thiếu SPAWN_zone_04_from_zone_03 at enterZone`.
- **Nguyên nhân** (tái hiện trên trang thật bằng trình duyệt của Claude): **không phải mạng, không phải bản lưu**.
  - Máy có card đồ hoạ rời (NVIDIA / GeForce / RTX / Radeon RX) được `detectTier` tự chọn bản đồ hoạ **Cao**; menu Esc
    cũng cho chọn High. GLB bản Cao (`assets/glb/high/`) đã dừng cập nhật từ 08/10 → `high/zone_04_corridor.glb` không có
    `SPAWN_zone_04_from_zone_03` (thêm vào bản Thấp ngày 09/10, là `start` của zone_04).
  - `_enterZone` ném lỗi; `onTrigger` gọi `enterZone` không bắt lỗi → promise lỗi bị bỏ rơi, màn tải đứng yên mãi. Bản
    lưu đã ghi zone_04 → tải lại trang thì lúc khởi động lại lỗi y như vậy.
  - Bộ kiểm thử chạy Chromium phần mềm (swiftshader → bản Thấp) nên không thấy.
  - Thử trên trang thật: cài đặt High + mạng thật → kẹt; High + `?net=off` → kẹt; Auto trên máy iGPU (→ Thấp) + mạng thật →
    vào zone 4 bình thường. Bản lưu của người dùng (`fville_save.json`) không có trên máy này → test dùng bản lưu cũ dựng
    lại, ẩn danh.
- **Sửa tận gốc:** bản Cao tắt hẳn trong game (`quality.js` → `TIERS = ["low"]`): cài đặt "high" cũ đọc thành Auto, máy
  card rời chạy bản Thấp, menu ẩn nút High, bản build không chép `assets/glb/high/` (6 file, 4,4 MB bỏ khỏi gh-pages).
- **Chống treo cho mọi lần chuyển zone:**
  - `Game.enterZone` bọc `_enterZone`: lỗi hoặc quá **20 s** → `console.error` + hộp lỗi trên màn tải ("Couldn't open
    <zone>." + chi tiết lỗi) với nút **Retry** và **Back to <zone trước>** (khởi động lỗi ở zone đầu: **Reload page**);
    không ném lỗi ra ngoài nữa. Hộp lỗi nhả khoá chuột để bấm được nút; tải xong muộn sau khi đã báo quá giờ → hộp lỗi tự
    tắt.
  - Thiếu SPAWN_ được yêu cầu → xuất hiện ở `start` của zone, thiếu cả `start` → SPAWN_ đầu tiên (kèm lỗi console), không
    kẹt.
  - Mạng không chặn tải zone: người chơi khác chỉ dựng model khi zone đã xong (`phase === "playing"`); lỗi trong
    `net.update` chỉ log 1 lần, vòng lặp game chạy tiếp.
  - Bản lưu cũ lệch data tự sửa khi nạp (`GameState.repair`): bỏ quest / phần thưởng / vật / giá trị / hạt lúa / lời
    khuyên không còn, chỉ số hỏng → 0, zone không còn → zone xa nhất đã mở, giới tính kiểu cũ (male / female) → nam / nu,
    ngoại hình không còn → mặc định theo giới tính, vị trí intern không còn → vị trí đầu, tên trống → "Intern"; in cảnh
    báo `[bản lưu] đã sửa N chỗ` và ghi lại.
  - Bản build gắn mã build vào mọi `data/*.json` và GLB: `?v=<git hash>-<thời gian>` (`vite.config.js` → `__BUILD_ID__`,
    `fetch.js` → `url()`), deploy mới không bị bộ nhớ đệm trả file cũ.
- **Kiểm thử thêm:**
  - test:smoke chạy thêm 2 test sau phần chơi theo ngoại hình (`--extra only` chỉ chạy 2 test này, ~15 giây), cả hai đặt
    sẵn cài đặt cũ tier "high":
    - bản lưu cũ `scripts/tests/fixtures/old_save.json` (ẩn danh: zone `zone_04_corridor`, mục không còn trong data, giới
      tính "male", ngoại hình / vị trí cũ) → sửa 11 chỗ, vào zone_04 bản Thấp; tải lại trang → vào thẳng, không còn gì để sửa;
      tải zone_05 với GLB hỏng → bảng lỗi + console.error, bấm chuột "Back to Card Gate · FSA Room" → về zone_04;
    - máy chủ chơi nhiều người local (`server/`, wrangler dev trên cổng trống) + 1 bot chờ sẵn ở zone_04: khởi động thẳng
      vào zone_04 và đi qua cổng từ zone_03 sang zone_04 (phải xong trong 20 s), thấy bot, console sạch.
  - test:data: `repair()` trên file bản lưu cũ; `start` của mọi zone phải có trong GLB bản Thấp.
  - Thử ngược: tạm bật lại bản Cao → cả 4 bước mới đỏ (lỗi thiếu SPAWN_). Đã thử tay màn lỗi: GLB hỏng → hộp lỗi + Back về
    zone_03; giả lập tải treo → đúng 20 s hiện "Loading took longer than 20 seconds.", Retry → vào zone_04.
  - CI cài thêm `npm --prefix ../server ci` để chạy test mạng.
  - Kết quả: test:data đạt hết (8 mục, 62 ms); test:smoke `--build` 3 ngoại hình zone 0 → 5 + 2 test mới: **49 bước đạt
    (2 phút 55 giây)**; bản dev cũng đạt (`--extra only` 5 bước, 15 giây). Test cũ so tên ảnh chân dung bằng `…\.png$` →
    bỏ phần `?v=` trước khi so.
- Không sửa `server/` → không cần `wrangler deploy` lại.
- `main` efb03ed; đã deploy `gh-pages` 9dd3954 (từ `main` efb03ed; bỏ 6 GLB bản Cao 4,4 MB khỏi trang). Kiểm tra trên
  trang thật sau deploy (cài đặt cũ High + máy chủ thật, online 2): zone_03 → cổng → zone_04 trong ~1 giây; tải lại → vào
  thẳng zone_04, bản Thấp, URL có `?v=efb03ed-…`. Lưu ý: GitHub Pages cho trình duyệt giữ `index.html` tới 10 phút — trong
  lúc đó tải lại thường vẫn có thể ra bản cũ (đã thấy: transferSize 0, bundle cũ); Ctrl+F5 hoặc chờ 10 phút là ra bản mới.

### Bi-a bước 2: chơi một mình + "Một cú bi-a" trên bàn thật (10/10/2026)
- **Vật lý** `game/src/pool/physics.js` (JS thuần, không three.js, chạy cả trong Node): 2D trên mặt bàn theo toạ độ cục bộ
  của node `pool_table` (data/pool.json), bước cố định 1/240 s. **Tất định**: chỉ + − × ÷ và `Math.sqrt` (cùng abs / min /
  max / floor — không làm tròn); góc → hướng bằng `dsin` / `dcos` (đa thức Taylor cố định), `datan2` (chuỗi) — không dùng
  Math.sin / cos / atan2 / hypot / pow. Bi–bi đàn hồi hệ số 0,95 (đẩy tách khi chồng), bi–băng 0,8: băng là 6 đoạn thẳng
  chừa miệng lỗ (lỗ góc 1,35 × bán kính lỗ dọc mỗi băng, lỗ giữa ± bán kính lỗ), đầu đoạn = hàm lỗ. Ma sát lăn giảm tốc
  0,4 m/s² + 0,1·v. Vào lỗ khi tâm bi lọt bán kính lỗ hoặc qua hẳn mép băng ở miệng lỗ; bi dừng ở miệng lỗ mà tâm đã qua
  mép băng → rơi. API: `simulateShot(table, state, {angle, power})` → `{frames (60/s), events, finalState, pocketed[],
  firstContact, cueScratch, time}`; `rackState`, `customState`, `respotCue`, `aimInfo` (bi ma), `findPottingShot`. Chưa có xoáy.
- **Chơi một mình** `game/src/pool/table.js`: lời nhắc **Play pool** (interactables.json → `pool:play`), chế độ "pool":
  camera sau bi trắng xoay theo hướng ngắm (lăn chuột: gần / xa; tránh tường và đồ đạc theo cả hộp COL_ lẫn lưới hiển thị),
  lúc bi lăn nhìn bao quát bàn; người chơi đứng cạnh bàn (gần bi trắng, không chắn hướng đánh / camera). Ngắm bằng chuột
  (con trỏ khoá) hoặc A/D, ←/→ (Shift: chậm); đường ngắm + bi ma + hướng bi bị chạm. Giữ chuột trái / Space nạp lực (thanh
  lực lên xuống), thả để đánh: cây cơ (bản sao cue_2, đầu cơ nhận theo đầu nhỏ của lưới) lùi theo lực rồi đẩy tới; bi lăn
  xoay theo quãng đường, vào lỗ thì ẩn. Ẩn `cue` + `cue_2` khi đang chơi. Bảng góc trái: số cú, số bi vào lỗ, **Rerack**
  (R), **Leave table** (Esc); bi trắng rơi lỗ → đặt lại ở điểm đầu bàn; dọn hết bàn → thông báo. Trạng thái bàn giữ trong
  lượt chơi (`game.poolSession`, cả khi ra / vào lại zone; không vào bản lưu). Dòng hướng dẫn hiện điều khiển bi-a.
- **"Một cú bi-a" của anh Khang** (`minigames.billiards`, kind mới `pool_shot`, bỏ bản canvas 2D cũ): trên bàn thật, thế bi
  dễ cho sẵn (`setup`: bi trắng + bi 5 màu cam gần lỗ góc foot_right), đưa bi vào lỗ trong 3 cú, hết 3 cú thì xếp lại.
  Mỗi cú trượt = 1 lần sai (gợi ý tăng dần như mọi mini-game: sai 2 → đường xanh = cú tìm được bằng vật lý, sai 3 → Skip).
  Khung mini-game là bảng chữ nhỏ phía trên (layout "pool"), thanh lực kèm "Shots left". Giữ nguyên lời thoại + phần thưởng
  (`billiards_played` + `billiards_potted`, `billiards_last_hit` → anh Khang khen).
- **Kiểm thử**: `npm run test:pool` (Node, ~3 giây): 1.000 cú phá bi ngẫu nhiên (hạt giống cố định) — không NaN, không bi
  chồng nhau sau khi dừng (chồng lớn nhất 0,0000 mm), không bi ra ngoài mép băng, mọi bi tự dừng (lâu nhất 5,2 s), chạy lại
  cùng đầu vào → **giống hệt từng bit**, ghi khung không đổi kết quả; dsin / dcos / datan2 lệch Math.* ≤ 2e-14; thử thách
  của anh Khang giải được bằng 1 cú. Trung bình **1,8 ms / cú** (735 bước), 0,34 bi vào lỗ / cú phá. Đã thêm vào GitHub
  Actions. `test:smoke` zone 5: "Play pool" → chế độ pool, cue/cue_2 ẩn, `__game.pool.shoot` phá bi → bi lăn rồi dừng (vị trí
  vẽ khớp trạng thái cuối, trong mép băng), rời bàn (cơ hiện lại); anh Khang → thử thách tự giải → bi vào lỗ, cờ gộp đúng.
  Kết quả: test:data đạt; test:pool đạt; test:smoke 1 ngoại hình zone 0 → 5 + bản lưu cũ + mạng: **22 bước đạt (1 phút 39 giây)**.
- Sửa nhỏ: chọn chỗ đứng cạnh bàn — bản đầu đứng ngay sau bi trắng nên camera lọt vào người chơi (thấy qua ảnh kiểm tra).
- `main` d86c6d4; đã deploy `gh-pages` 04a74b2 (từ `main` d86c6d4).

### Máy tính bàn ở bàn intern zone 5 từ mô hình Sketchfab (10/10/2026)
- "Desktop Computer" (Tyler P Halterman, Sketchfab, CC BY 4.0) thay laptop hộp (`concrete_grey`) ở bàn intern; bàn intern
  trước đây còn có cả màn hình / bàn phím / chuột hộp của `desk_unit` → bỏ luôn (`desk_unit(gear=False)`, cùng cốc + xấp giấy:
  cốc lọt trong hộp quà, giấy sẽ nằm dưới chuột). Hộp quà, bảng tên giữ nguyên chỗ. File gốc chép vào
  `assets/props/desktop_computer/source/desktop_computer.glb` (không commit); `scripts/blender/lib/desktop_computer.py` dựng
  lại mỗi lần build zone_05 (cùng cách bàn bi-a), thiếu file → build báo lỗi kèm link nguồn.
- Tỉ lệ: màn hình gốc rộng 0,756 m → × 0,728 = **0,55 m** (mặt màn hình 0,507 × 0,304 m); cả bộ 0,73 × 0,48 × 0,48 m. Bàn
  phím, chuột hạ xuống mặt bàn (mô hình gốc lơ lửng 7–12 mm). Gốc `desktop_computer` = tâm đáy đế màn hình, đặt ở toạ độ cục
  bộ bàn (0,05; −0,16; 0,75) (`PC_LOCAL` trong `zone_05.py`): thẳng ghế, lùi sát vách ngăn, mặt trước nhìn về chỗ ngồi
  `SPAWN_ban_lam_viec`; bàn phím + chuột trước màn hình. Con của `INT_ban_lam_viec`.
- Texture: 4 ảnh 1024² (~1,9 MB: màu, metallic-roughness, phát sáng, normal) → 1 ảnh màu 512² (`M_desktop_tex`, WebP
  **12,5 KB**) × vertex color (AO) → toon + viền nét như mọi vật; vùng ảnh không mặt nào dùng (43 %, gồm hình nền Windows 7)
  tô màu trung bình.
- Màn hình: 2 tam giác hình nền Windows 7 tách thành object `monitor_screen` (con của `desktop_computer`), chất liệu riêng
  `M_monitor_screen`, ảnh 512 × 320 (WebP **3,5 KB**) vẽ bằng code: thanh trên "My FPT" ("FPT" màu cam như đầu app trong game),
  thẻ "Sign in", ô Intern ID / Password, nút cam "Sign in". Chữ: font Segoe UI → lưới phẳng (`props.text_mesh`) → tô tam giác
  bằng numpy (`blf` vẽ vào ảnh làm Blender 5.2 chạy nền bị crash). `dynamic`: không nướng AO (4 đỉnh — AO ở góc loang cả màn).
  Game đổi màn hình sau này: `zone.root.getObjectByName("monitor_screen").material.map`.
- Bàn của Lan, Minh, Hà không có laptop giả (chỉ màn hình hộp của `desk_unit`, mesh dùng chung cho mọi bàn) → giữ nguyên.
- `COL_`, `SPAWN_ban_lam_viec`, `INT_ban_lam_viec`, `TRIGGER_ban_lam_viec` không đổi; màn hình cao tới 1,23 m (màn hình hộp
  cũ 1,26 m) → không chắn camera.
- zone_05: 43.700 → 44.366 tam giác (+794 máy, −128 đồ hộp bỏ đi), GLB **319.768 → 345.872 byte (+25,5 KB)**. check_glb 0 lỗi.
- Kiểm tra: test:data đạt; test:smoke `--zone 5` (3 ngoại hình) **23/25 bước đạt**. 2 bước hỏng (intern_nam_kinh, intern_nu:
  cảnh kết không sang được zone_01, "m.map?.dispose is not a function") là lỗi P1 có sẵn trong `docs/CHECKLIST.md` (bản sao
  cây cơ bi-a), không do máy tính: GLB zone_05 cũ cũng hỏng y hệt ở ngoại hình thứ 2 (ngoại hình đầu không lộ lỗi vì có bước
  tải lại trang giữa cảnh kết). Ảnh: `renders/zone_05_office_ban_lam_viec_can.png` (camera mới, cận bàn intern); xem trong
  game bản dev: toon + viền nét, màn hình "My FPT" đọc được, console sạch.
- `main` 94b7938; đã deploy `gh-pages` 5b32098 (từ `main` 8347ca1; trước deploy: test:data, test:pool đạt, test:smoke
  `--zone 5` 1 ngoại hình 10 bước đạt). Lỗi không ra được khỏi zone 5 (CHECKLIST mục 1) vẫn còn trong bản này. `docs/CHECKLIST.md` → mục 4: dòng "Máy tính bàn ở bàn intern zone 5" đã đánh dấu xong.

### Bi-a bước 3: 2 người theo lượt qua máy chủ + chia phòng ~30 người (10/10/2026, nhánh `feat/pool-step3`)
- **Luật 8 bi rút gọn** `game/src/pool/rules.js` (dùng chung game + máy chủ, tất định như physics.js): bàn mở tới khi có
  người vào bi mà bi trắng không rơi → nhận nhóm của bi vào đầu tiên (trơn 1–7 / sọc 9–15); vào bi nhóm mình → đánh tiếp;
  bi trắng rơi → đổi lượt + bi trong tay (đặt ở khu đầu bàn, sau vạch z = −rz/2); bi 8: hết nhóm mình từ trước cú đó + bi
  trắng không rơi → thắng, sớm / kèm bi trắng → thua; bi 8 lúc phá → đặt lại điểm chân bàn. Không phạt chạm sai bi trước.
  Mã hoá bàn: 16 bi × (x, z) làm tròn 0,01 mm, bi đã vào lỗ = null.
- **Máy chủ** `server/src/pool.js` (JS thuần, thử bằng Node) + `server/src/index.js`: bàn chung của mỗi phòng — 2 ghế, lượt,
  vị trí bi, số thứ tự cú, nhóm; một người ngồi → tập một mình (cú vẫn phát cho người xem), người thứ 2 → xếp lại bi, ván 8
  bi, người ngồi trước phá; hết ván → R: ván mới, người thua phá. Kiểm tra cú: đúng người / lượt / số thứ tự, lực 0..1, 16
  bi trong bàn, bi đã vào lỗ không quay lại, danh sách bi vào lỗ khớp vị trí, bi trắng chỉ đặt ở khu đầu bàn khi có bi trong
  tay. Không chạy vật lý trên máy chủ. Giải phóng ghế: rời bàn, sang zone khác, mất kết nối, quá `pool_turn_s` (60 s) không
  đánh (kiểm tra mỗi khi có tin tới; người chờ gửi `pool_poke`) — giữa ván thì người còn lại thắng. Bàn cất vào attachment
  của người đang ngồi (qua lúc DO ngủ). `welcome` báo `room`, `features: ["pool"]`.
- **Chia phòng** (`data/net.json` → `server.room_size` 30, `max_rooms` 6): mỗi phòng một Durable Object (phòng 1 giữ tên cũ
  `fville`, rồi `fville-2`…); phòng đủ 30 kết nối thì DO chuyển nguyên request WebSocket sang phòng sau (đã thử trên
  workerd local: 32 kết nối → 30 + 2). `?room=N` vào thẳng phòng N (thử). `/status` cộng mọi phòng + liệt kê phòng có người.
  Góc màn hình phòng 2 trở đi: "Room 2 · N online · M in this zone".
- **Game** `game/src/pool/table.js`: máy chủ có "pool" → bàn bi-a là bàn chung (`game.poolShared`). "Play pool" → xin ghế; hết
  ghế → đứng xem (camera bao quát, xoay bằng A/D / chuột), J: ngồi khi có ghế trống. Người đánh tự tính cú rồi gửi góc / lực
  / chỗ đặt bi trắng + kết quả; người kia, người xem (kể cả đang đi lại trong zone) phát lại đúng cú đó từ bàn của mình, cuối
  cú chốt theo bàn máy chủ. Bảng góc trái: 2 ghế (tên, nhóm, số bi còn lại, viền cam = người đang đánh), dòng trạng thái +
  đồng hồ lượt, nút Rerack / Rematch, Join, Leave; thông báo phá bi, nhận nhóm, bi trắng rơi, thắng / thua. Bi trong tay:
  camera từ đầu bàn, W/A/S/D (hoặc kéo chuột) dời bi trắng trong khu đầu bàn, Space / nhấp để đặt. Cây cơ dựng / nằm trên
  bàn ẩn khi có người ngồi. Mất kết nối / máy chủ không trả lời 6 s → tập một mình với bàn đang có. Máy chủ cũ (không báo
  "pool") → như bước 2. Thử thách của anh Khang luôn là bàn riêng.
- **Kiểm thử**: `npm run test:pool` thêm `scripts/tests/pool_rules.mjs` (11 tình huống luật, 20 tình huống bàn máy chủ, một ván
  trọn giữa 2 người chơi giả: 14 cú, người xem phát lại khớp từng bit, chạy lại giống hệt; ván có bi trắng rơi + đặt bi trắng).
  `test:smoke` thêm "bi-a 2 người" (máy chủ local, 3 trình duyệt: chơi trọn ván 14 cú, 26 lần phát lại khớp từng bit; chặn cú
  sai lượt; người xem vào giữa ván; bi trong tay; R → ván mới người thua phá; rớt mạng → giải phóng ghế; máy chủ cũ) và "chia
  phòng" (31 kết nối → người thứ 31 sang phòng 2, `?room=3`, `/status`). Các test mạng dùng chung 1 máy chủ local. Kết quả:
  test:data, test:pool đạt; test:smoke 1 ngoại hình + phần thêm **34 bước đạt (1 phút 24 giây)**; `npm run build` được.
  Ảnh kiểm tra (`renders/game/pool_net_{1_aim,2_watch,3_in_hand}.png`): bảng 2 ghế, lượt, bi trong tay.
- Chưa: `wrangler deploy` máy chủ (máy Desktop, xem `docs/multiplayer.md` → "Bi-a 2 người"), deploy `gh-pages`, chơi thử 2
  người trên trang thật (cảm giác lực đánh, tốc độ bi, độ nảy băng). Chưa có chọn phòng trong game, chưa có âm thanh bi-a.

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
- **intern_nam, intern_nu — nhân vật NGƯỜI CHƠI (hư cấu, Meshy + Mixamo; 10/10/2026), đã vào game:**
  - Nam cao 1,70 m (gốc 71k tam giác), nữ 1,60 m (56k) → 25.000 tam giác, đứng chữ A, nhìn -Y, giữ nguyên mặt và vùng
    logo khi giảm. FBX cho Mixamo: `assets/characters/intern_nam/intern_nam_for_mixamo.fbx`,
    `assets/characters/intern_nu/intern_nu_for_mixamo.fbx` (không commit).
  - Sửa texture theo vị trí 3D (`texture_fixes.json`): mặt trong cổ áo Meshy tô màu da lởm chởm → tô lại màu áo (cả
    hai); mắt intern_nam to hơn 15% (phóng đều đồng tử + lòng trắng, lông mày không đổi) — so trước/sau: giữ.
  - Logo FPT ngực trái (cùng file logo của nga): nam 7,5 cm tại (x 0,088; z 1,275 m), nữ 7 cm tại (x 0,066; z 1,19 m):
    nữ hạ 1 cm cho cách mũi cổ áo như áo nga, dời vào 1,1 cm vì ở tư thế idle ngực sát nách co lại làm chữ T lật sang
    mặt bên.
  - 2 bộ texture cùng UV (`outfit_textures.py`): `ao_cam` (áo cam + logo, bản chuẩn) và `dau_ngay` (áo xanh nhạt
    #cfe0ee giữ nếp vải, không logo); mặt nạ vùng 512 px (áo, quần, giày, da, tóc).
  - Bản 6k duy nhất (`build_character.py --single`, 0,56 MB mỗi nhân vật, 15 animation retarget từ bộ prajith như nga;
    file Mixamo "With Skin" không kèm animation → idle lấy từ Standing Idle của prajith), chân dung (bộ ao_cam).
    Tay lún thân 4–6 cm ở vài animation nói / nghĩ / ngồi của intern_nu (như huyen, nga); intern_nam ≤ 5,8 cm (sit_down).
  - Vai `player`: `model_by_gender` (nam → intern_nam, nu → intern_nu), giới tính trong bản lưu `player.gender`, mặc
    định nam (màn tạo nhân vật có mục giới tính từ 10/10/2026). Thử khi dev: `?gender=nu` / `?gender=nam` (ghi vào bản lưu) hoặc
    `__game.setGender("nu")`; `__game.model` cho biết model + bộ đồ đang mặc.
  - Bộ đồ đổi bằng texture (thay cách tint áo cũ của người chơi; NPC vẫn tint): đầu game `dau_ngay`
    (`models.<id>.outfit_textures.dau_ngay` = `<id>_dau_ngay.webp`, WebP 1024, ~66 KB, cùng UV), nhận Áo Cam ở cổng (từ
    lúc vào chụp ảnh check-in) → texture trong GLB (ao_cam, có logo). Theo phần thưởng đã lưu → tải lại vẫn đúng áo.
    `Character.setOutfit` / `loadOutfits` (`game/src/characters/characters.js`), `Game.updateOutfit`.
  - Đã chạy zone 0 → 3 với cả nam và nữ (bản dev): áo xanh lúc đầu, đổi áo cam có logo ở cổng, tải lại vẫn áo cam;
    đi 1,4 m/s, chạy 4,39 m/s; mọi animation (cả ngồi) phát được trên người chơi; camera hội thoại qua vai đúng;
    lời thoại của người chơi (trả ví cho Ms. Nga) hiện chân dung đúng giới tính; ảnh check-in trên màn tổng kết đúng
    nhân vật. Ảnh: `renders/game/intern_{nam,nu}_*.jpg`.
  - Chơi nhiều người (khớp code mạng của bản Web): `join.model` gửi model theo giới tính (`Characters.modelId`), người
    khác đổi áo bằng texture như người chơi (`RemotePlayers.build/update`). Thử với `wrangler dev` + 4 bot
    (`net_bots.js` nay xen kẽ intern_nam / intern_nu, áo xanh / áo cam): đúng model, đúng áo, console sạch.
  - Texture bộ đồ tải lỗi → cảnh báo, nhân vật tạm mặc texture trong GLB (trước đây lỗi này chặn cả lúc mở game).
  - Ảnh: `renders/characters/<id>_trang_phuc.png` (chính diện 2 bộ, mặt nạ trước/sau, cận ngực logo, cận mặt).
- **Chơi nhiều người đã lên mạng (10/10/2026):** máy chủ `https://fville-net.fville-onboard.workers.dev` (Cloudflare
  Worker + Durable Object, gói Free), `data/net.json` → `url` = `wss://fville-net.fville-onboard.workers.dev/ws`. Kiểm tra
  `/` + `/status`, hibernation (đọc lại attachment sau khi ngủ), 8 bước với 2 cửa sổ bản build; FPS 10 bot trên GPU thật:
  72 → 66 FPS (1280 × 760, Detail 0). Sửa 2 lỗi client: danh sách người cùng zone bị xoá nếu về trước khung đầu tiên;
  `interp_ms` 120 → 260 (người khác đi giật). Chi tiết: `docs/multiplayer.md` → "Đã lên mạng".
  Đã deploy `gh-pages` 3203cbe (từ `main` 836c3d3, gồm intern nam / nữ, đổi áo bằng texture, mũ chưa gắn); trang thật kết
  nối máy chủ được (origin github.io).
- **Mũ lưỡi trai cam — phụ kiện tủ đồ (mở khoá khi xong game; 10/10/2026, `scripts/blender/accessories/build_cap.py`):**
  - Mô hình Meshy 307.500 tam giác (13,5 MB) → `assets/accessories/cap/cap.glb` **884 tam giác, 17,4 KB** (texture WebP 512
    nhúng, meshopt), validate 0 lỗi. Không Decimate: dựng lại lưới thấp bám bề mặt Meshy bằng tia chiếu — vòm 2 lớp
    (vải + lót) 24 tia × 6 vòng nối nhau ở mép đội đầu, nút đỉnh, vành có mặt trên / mặt dưới / mép (dày 4–8 mm, dài 7,7 cm,
    13 hướng), không thủng khi nhìn từ dưới; chỗ hở trên quai sau gáy được đóng kín.
  - Texture vẽ bằng code: cam phẳng #F26F21, đường may 6 mảnh + mũi chỉ nhạt, 5 hàng chỉ trên vành, lót #EFE8DC; miếng
    thêu trắng bo góc 6 × 4,2 cm có viền chỉ, logo FPT rộng 5 cm (tô trắng chữ F P T như áo Nga), lưới cong ôm mặt trước
    vòm, nổi 1,5 mm.
  - Gốc toạ độ = tâm vòng đội đầu, vành hướng +Z (glTF), giữ độ nghiêng tự nhiên (mép trước cao hơn mép sau 16,6°); số đo
    cho bước gắn lên đầu intern trong `cap.json` (vòng đội đầu 18,1 × 18,5 cm, vòm cao 11,3 cm). Chưa gắn vào game.
  - Ảnh: `renders/accessories/cap_so_sanh.png` (Meshy | bản thấp: chính diện, 3/4, ngang, từ dưới), `cap_chi_tiet.png`.
  - Còn: ở 2 đầu vành, mép vòm bước từ chân vành xuống mép tự nhiên thành một bậc nhỏ (thấy khi nhìn ngang sát).
- **intern_nam_kinh — người chơi nam đeo kính (hư cấu, Meshy + Mixamo; 10/10/2026), đã vào game:** ngoại hình thứ 2 của
  giới tính nam (lựa chọn thứ 3 của người chơi), sau này làm model Tú; màn tạo nhân vật chưa có mục chọn ngoại hình.
  - Gốc 65.584 tam giác → 25.000, cao 1,65 m, chữ A, giữ nguyên mặt (gọng kính, mắt sau kính, lông mày, môi) + vùng logo.
    FBX cho Mixamo: `assets/characters/intern_nam_kinh/intern_nam_kinh_for_mixamo.fbx` (0,98 MB, không commit).
  - Lọn tóc rủ giữa hai mắt kính (đầu lọn chạm sống kính → vết đen) rút ngắn 2,8 → 1,0 cm, tới ngang lông mày
    (`mesh_fixes.json` → `shorten`: chỉ dời đỉnh theo z, giữ UV, không vá lỗ). Ảnh: `renders/characters/intern_nam_kinh_hinh_khoi_truoc_sau.png`.
  - Mặt nạ 6 vùng: áo phông, quần jean, giày, da, tóc, **kính** (xanh lơ). Gọng kính dính liền mặt trong lưới Meshy, UV
    vỡ vụn → tách theo độ dày (tia bắn vào trong theo pháp tuyến: gọng ~3 mm, mặt dày hàng chục cm) trong dải mắt: 1 mảng
    1.273 đỉnh = 2 vòng gọng + cầu kính + 2 càng; 67 đỉnh tóc mảnh lẻ trong dải bị loại.
  - 2 bộ texture cùng UV: `dau_ngay` = áo phông xanh ngọc gốc, không logo (chép nguyên ảnh gốc); `ao_cam` = áo đổi sang
    cam #FB8136 (màu mẫu áo intern_nam) giữ nếp vải + logo FPT ngực trái 7 cm. Áo phông cổ tròn khoét sâu (đáy cổ z 1,245):
    thử 10 vị trí, chọn (x 0,085; z 1,1825) — không vắt đường nối UV nào, mép trên logo thấp hơn đáy cổ ~4 cm, cách vai
    cùng tỉ lệ áo intern_nam (tỉ lệ 0,75 × chiều cao của áo polo thì logo leo lên cổ áo). Ghi vào `models.intern_nam_kinh`.
  - Ảnh: `renders/characters/intern_nam_kinh_ket_qua.png` (chính diện dau_ngay | ao_cam, cận logo, cận mặt),
    `intern_nam_kinh_trang_phuc.png` (kèm mặt nạ trước/sau, cận mặt mặt nạ), `intern_nam_kinh_logo_nguc_so_sanh.png`
    (so với logo áo intern_nam).
  - Mixamo (25 xương, No Fingers, With Skin; `mixamo/intern_nam_kinh_rigged.fbx`, không commit) → bản 6k duy nhất
    (`build_character.py --single`, 0,59 MB, validate 0 lỗi), 15 animation retarget từ bộ prajith như intern_nam; walk
    phát ×0,85, run ×1,08 cho khớp chân (anim 1,65 / 4,07 m/s; tốc độ chơi 1,4 / 4,39 m/s). Tay lún thân tối đa 5,6 cm
    (think), 5,3 cm (sit_down) — như intern_nam. Kính (ống ~3 mm) vẫn liền ở 6k (vòng gọng thành đa giác). Mẩu lọn tóc đã
    rút ngắn bị gộp thành vệt tam giác đen trên trán → `decimate_protect.regions.dau_lon_toc` (lượt 0 giảm mặt nay chừa
    các vùng regions; nga không bị ảnh hưởng — vùng của nga ở ngực). Chân dung bộ ao_cam; `intern_nam_kinh_dau_ngay.webp`
    (PIL quality 85, method 6 — cùng cách tạo WebP của intern_nam / intern_nu: ra đúng 68.882 byte với ảnh của intern_nam).
  - Chọn ngoại hình (sửa code tối thiểu): `roles.player.looks` = {nam: [intern_nam, intern_nam_kinh], nu: [intern_nu]},
    bản lưu `player.look`; `Characters.modelId` dùng `look` nếu có trong `looks.<giới tính>`, không thì `model_by_gender`
    như cũ (đổi giới tính → ngoại hình không hợp lệ → model mặc định). Dev: `?look=intern_nam_kinh` (đặt luôn giới tính,
    ghi vào bản lưu) hoặc `__game.setLook("intern_nam_kinh")` / `setLook(null)`; `__game.model.look`.
  - Đã chạy zone 0 → 3 (bản dev, mạng local `wrangler dev`): mạch chính đủ, áo xanh ngọc tới cổng zone 2 → Áo Cam (texture
    trong GLB) từ ảnh check-in, tải lại vẫn đúng model + áo; đi 1,4 / chạy 4,39 m/s; sit_down / sit_type / stand_up phát
    đúng (zone 0–3 và cảnh kết không có chỗ ngồi cho người chơi — thử trực tiếp trên nhân vật); kính không xuyên mặt khi
    chạy, ngồi cúi đầu; camera hội thoại; chân dung trong hộp thoại (lời người chơi trả ví cho Ms. Nga) và ảnh thẻ trên màn
    tổng kết / thẻ tải về (`__game.finish()`). Chơi nhiều người: 2 bot local (intern_nam_kinh áo xanh, intern_nam áo cam)
    hiện đúng model + áo; bot thấy người chơi `intern_nam_kinh` + `ao_cam`. Console sạch. `npm run build`: dist có GLB,
    WebP, chân dung của model mới. Ảnh: `renders/game/intern_nam_kinh_trong_game_{1,2,3}.jpg`.
- Công cụ:
  - `prepare_for_mixamo.py`: Meshy → FBX cho Mixamo; `--protect-face`, `--protect-logo` giữ nguyên mặt / vùng logo khi
    giảm tam giác. `texture_fixes.json` thêm `collar` (tô lại mặt trong cổ áo theo pháp tuyến mượt quay vào trục cổ) và
    `magnify` (phóng to một vùng như mắt, lấy mẫu qua tia chiếu chính diện); chạy lại thì xoá `_basecolor_nologo.jpg`
    và `_basecolor_dau_ngay.jpg` cũ để dựng lại từ ảnh mới. `mesh_fixes.json` → `shorten` (10/10/2026): rút ngắn lọn
    tóc treo tự do trước khi giảm tam giác, render trước | sau.
  - `outfit_textures.py`: mặt nạ vùng theo hình khối (cắt dưới nách tách tay / thân + chân / phần trên → quần không bao
    giờ so màu với da), màu chỉ để tách trong từng khu, dọn mảng vụn theo liên thông; đổi màu áo giữ nếp vải.
    10/10/2026: `--glasses` (vùng kính theo độ dày), `--original dau_ngay` (áo gốc là bộ ngày đầu → bộ ao_cam = áo đổi
    sang cam rồi `apply_chest_logo.py`). Sửa 2 lỗi đổi màu áo: (1) trộn `rgb·(1−a) + mới·a` để lại a(1−a) màu áo cũ ở
    chỗ lẫn màu (viền ô liu ở cổ khi xanh ngọc → cam) → nay bỏ đúng phần màu cũ rồi thêm màu mới; (2) "mép áo" xét theo
    khoảng cách trên ảnh UV nên mảnh mắt nằm cạnh mảnh áo trong atlas cũng bị đổi (chấm cam trên đồng tử) → nay chỉ
    texel của tam giác giáp áo trên lưới. Bản `dau_ngay` đã commit của intern_nam / intern_nu dựng bằng cách cũ: chạy
    lại thử thì chỉ khác ~300 texel ở mép mảnh UV giày, không ở mắt → giữ nguyên.
  - `build_character.py`: ghép animation, retarget giữa hai nhân vật, giảm tam giác có bảo vệ vùng mặt/logo (và lượt
    giảm riêng phần da phẳng của mặt), đo tốc độ và độ cao ngồi.
  - `apply_chest_logo.py`: dán logo ngực bằng phép chiếu chính diện, tô trắng chữ bị công cụ xoá nền làm trong suốt,
    giữ nếp vải, lan màu ra lề mảnh UV.
  - `render_portrait.py`: chân dung hộp thoại.
  - Viewer: áp tint của vai (dùng chung `game/src/characters/tint.js` qua `viewer/tint.js`); `?compare=` nhận cả id vai
    (vd `?compare=thao,le_tan,prajith`: model + tint + tên hiển thị của vai).

### Mũ lưỡi trai phần 2: đội trên đầu 3 intern (10/10/2026, nhánh `feat/zone5-seat-cap`)
- `game/src/characters/accessories.js`: mũ (`assets/accessories/cap/cap.glb`) là con của xương đầu (`mixamorigHead`) → đi theo
  mọi animation. **Tự ướm theo lưới nhân vật**, không cần số đo tay: lấy các đỉnh thuộc xương đầu (trọng số ≥ 0,5, cả tóc) ở
  tư thế nghỉ — đỉnh ở hệ xương = boneInverse × bindMatrix × v (GLB lượng tử hoá đưa hệ số giải nén vào boneInverse), × ma
  trận xương đầu lúc nghỉ (`Character.headRest`, lấy khi tạo nhân vật; `skeleton.pose()` làm hỏng xương gốc nên không dùng).
  Mép trước vòng đội đầu ở tầm trán (xương đầu + 0,68 × (đỉnh đầu − xương đầu)), vòng đội đầu nghiêng 16,6° như mũ thật; tỉ
  lệ = vòng đội đầu vừa bề ngang / bề sâu đầu + tóc từ tầm trán trở lên × 1,06, rồi phóng to tới khi vòm thật (bản đồ độ cao
  ô 1 cm dựng từ đỉnh của GLB mũ) trùm được 97 % đỉnh đầu / tóc trên vòng đội đầu. Kết quả: intern_nam ×1,30, intern_nu
  ×1,37 (tóc bob dày, tóc lòi ra sau gáy như mũ thật), intern_nam_kinh ×1,60. Đã thử thu 10 % cho 2 nhân vật nam (mũ trông
  hơi to) → tóc đâm xuyên vòm sau → giữ tỉ lệ máy tính. Chỉnh tay theo model: `accessories.cap.adjust.<model>`.
- Cấu hình `data/characters.json` → `accessories.cap` (nhãn, GLB, số đo chép từ `cap.json` — `test:data` so khớp, `fit`,
  `adjust`, `unlock: { flags: ["game_complete"] }`). Bản lưu `player.accessories` (đang đội; `repair()` bỏ id lạ). Chưa có tab
  Wardrobe (chờ chốt danh sách món) → xong game thì menu Esc có hàng **FPT Orange Cap: On / Off**. Bản build chép
  `assets/accessories/<id>/<id>.glb` (không `source/`, `.json`).
- Chơi nhiều người: `join.acc` (máy chủ nhận tối đa 4 id dạng `[a-z0-9_]`, phát lại trong `join`/`zone`) → người khác thấy
  mũ; máy chủ cũ bỏ qua trường này (không ai thấy mũ của ai, không lỗi).
- Dev: `__game.setAccessory("cap", true, { force: true })` (bỏ qua mở khoá), `__game.accessoryInfo("cap")` (xương, hộp bao,
  số đo ướm), `__game.model.accessories`.
- Kiểm thử: `test:data` mục "phụ kiện (tủ đồ)"; smoke sau màn tổng kết: menu Esc → bật mũ → gắn xương đầu, vòm cao hơn đỉnh
  đầu 0–15 cm, lưu vào bản lưu; test "mạng + zone 4": bot đội mũ → thấy mũ trên người bot. Ảnh: `renders/game/cap_<model>_{front,side}.png`.

### Người chơi ngồi vào ghế ở bàn làm việc zone 5 + sửa lỗi cảnh kết (10/10/2026, nhánh `feat/zone5-seat-cap`)
- **Ngồi ghế** (không sửa GLB): hội thoại `desk_main` có node mới `"sit": { "action": "sit:SPAWN_ban_lam_viec" }` — chọn "Sit
  down now." (hoặc đã chào đủ Lan, Minh, Hà) thì người chơi ngồi vào ghế bàn intern rồi mới mở quà, đăng nhập, checklist.
  `Player.sit / standUp / leaveSeat` (`game/src/player/player.js`) theo đúng cách NPC ngồi: điểm đứng = chỗ ghế
  (`SPAWN_ban_lam_viec`, yaw nhìn vào bàn) − `models.<id>.seat.offset_xz_m`, sit_down → sit_type, nâng dần lên mặt ghế
  (`roles.player.chair_height_m` 0,51 − ghế đã hạ 0,067 − `seat.height_m`: nữ +7,5 cm, nam kính +10,8 cm); đang ngồi không
  đi lại, không trọng lực. Hội thoại kết thúc giữa chừng (vd bỏ mini-game Đăng nhập) → đứng dậy (stand_up); xong bàn làm
  việc → ngồi nguyên tới cảnh kết (cảnh kết đặt người chơi đứng cạnh bàn trong màn tối). Animation không chạy (khung ẩn) →
  chờ tối đa 4 s, hội thoại không treo. Chơi nhiều người: đang ngồi gửi anim "sit" + vị trí đã nâng.
  Hành động hội thoại mới (`game/src/ui/dialogue.js` → `hooks.action`): `sit:<SPAWN_>`, `stand`; `test:data` báo hành động
  lạ, `sit` không trỏ SPAWN_, và kiểm tra SPAWN_ có trong GLB của zone mở hội thoại đó.
- **Sửa lỗi có từ bi-a bước 2 (trang thật đang dính):** cây cơ đang chơi (`cueModel`) nhân bản `cue_2` bằng `clone()` →
  three.js chép `userData` qua JSON → `userData.srcMaterial` thành object thường → `disposeZone` ném lỗi khi rời zone_05 →
  cảnh kết báo "Couldn't open F-Ville Bus Stop" (ai chơi xong zone 5 mà không tải lại trang). Bản sao bỏ userData chép;
  `disposeZone` chỉ dọn vật liệu / texture thật. CI trước chỉ chạy 1 ngoại hình — ngoại hình đó thử "tải lại giữa cảnh kết"
  nên không đi qua đường này; nay CI chạy 2 ngoại hình (ngoại hình thứ 2 chạy trọn cảnh kết).
  Cùng lỗi làm hỏng cả việc đi từ zone 5 sang zone 4 (CHECKLIST mục 1) → smoke zone 5 thêm bước zone 5 → zone 4 → zone 5
  sau khi chơi bi-a.
- Kiểm thử: smoke zone 5 thêm bước "ngồi vào ghế bàn làm việc" (lúc mini-game Đăng nhập: đang sit_type, nâng lên mặt ghế,
  cách chỗ ghế đúng offset của model); `--zone 5` 2 ngoại hình 19 bước đạt (trước khi sửa: ngoại hình thứ 2 hỏng ở cảnh kết).
  Ảnh: `renders/game/seat_intern_nu.png`, `seat_intern_nam_kinh.png`.

### Dựng lại zone_04 (10/10/2026, nhánh `zone04/rebuild`; máy có Blender 5.2, không cần file gốc)
- Trước khi sửa: build lại `zone_04.py` nguyên trạng → GLB **giống hệt bản đang commit từng byte** (48 node, 9.064 tam giác
  hiện, 336 tam giác COL) → script tái tạo được, làm tiếp.
- `scripts/blender/zone_04.py`: lan can song sắt thật ở mép tây chiếu trên (trong `ENV_cau_thang`, tay vịn cao 5,2 m, x 3,35,
  z −3,0 … −1,6) + `COL_lan_can_chieu_tren` (trùng hộp dữ liệu cũ); `COL_tuong_bac_tren_cua` cho vách trên cửa quẹt thẻ (x 1,0–3,6,
  cao 2,55–4,2 — tới sàn tầng trên); `SPAWN_zone_04_from_zone_03` (11; 0; 0) → (9; 0; 0). Mọi node cũ giữ nguyên chỗ.
  GLB bản Thấp 97.224 → 99.344 byte; `check_glb` 0 lỗi. Bản Cao không dựng (đang tạm dừng).
- Bỏ bản vá dữ liệu đã thay bằng đồ thật: `data/collision.json` → zone_04 (`camera_tren_cua_quet_the`, `lan_can_chieu_tren`),
  `data/zones.json` → `zone_04.spawn_offset` (code đọc `spawn_offset` vẫn giữ cho zone khác).
- Thử va chạm (so với bản cũ có bản vá: số liệu như nhau): chỗ xuất hiện đứng trên sàn, camera sau lưng; lan can: 9 điểm × 16
  hướng × 3 s chạy trên chiếu trên → 0 lần rơi, người đi tầng trệt vẫn qua dưới; vách trên cửa: 120 mẫu camera → 0 lần
  xuyên vách. Còn 7/120 mẫu camera bị che có từ trước (ống gió hành lang không có COL_, cánh cửa quẹt thẻ đang mở).
- test:data đạt; smoke `--zone 4` 8 bước, `--zone 5` 15 bước đạt. Ảnh: `renders/game/z4_{1_spawn_from_zone_03,2_lan_can_chieu_tren,3_vach_tren_cua_quet_the}.jpg`.
  Máy làm việc này đã cài `gltf-transform` 4.5.1 (toàn cục) và `tools/bin/blender.cmd` (trỏ tới Blender 5.2 cài trên máy).

### Rà lời thoại, phiếu chơi thử, đề nghị HR (10/10/2026, nhánh `content/playtest-dialogue`)
- **Lời thoại tiếng Anh** (~870 chuỗi đã đọc, 42 chuỗi sửa: dialogues 24, interactables 7, guidance 4, quests 2, i18n 2,
  acts / quiz / values 1): mọi câu thoại ≤ 30 từ (trừ câu chuyện tượng Cuder của mentor), câu lựa chọn dài nhất 11 từ;
  chính tả Mỹ; thống nhất "pool / pool table" (id `billiards` giữ), "FPT Orange Shirt", "FSA Room", "Information Security
  course", dấu "…"; tên zone 1 "F-Ville Bus Stop" (khác zone 0 "City Pickup Stop"); "Becoming an FSofter"; sửa câu sai chỗ
  ("Your card opens the gates upstairs" → cửa quẹt thẻ ở cuối hành lang), câu hũ hạt lúa khi đã nhặt đủ. Không đổi id, key,
  `next`, điều kiện, giá trị, phần thưởng, `draft`. Các câu trích trong `dialogue_huyen.md`, `dialogue_nga.md`, GDD sửa theo.
  Ghi chép + 10 điểm cần mentor / HR quyết: `docs/dialogue_review.md`.
- **Phiếu chơi thử** `docs/playtest_form.md`: chuẩn bị, cấu hình máy, lời dặn đọc nguyên văn, quy tắc quan sát (không nhắc);
  bảng theo dõi zone 0 → 5, 13 mini-game (số lần sai, Skip), lựa chọn gắn 6 giá trị, màn tổng kết; hiệu năng
  (`benchmark`, `detailLevel` từng zone, FPS bật / tắt Show other players); 8 câu phỏng vấn; cách gộp thành GitHub Issues
  (nhãn bug / ux / content / perf, P1–P3). Chỉ dùng mã người chơi P1, P2…
- **`docs/hr_content_request.md`** cập nhật đủ 20 mục [DRAFT] theo game hiện tại (zone 0 → 5), câu tạm lấy đúng chữ trong
  game, bảng đối chiếu với danh sách cuối file này; tách 3 nội dung không [DRAFT] nên để HR xác nhận (quy định quẹt thẻ, 5
  việc tuần đầu, checklist ngày đầu).
- Kiểm tra: test:data đạt; privacy_scan 0 phát hiện.

### Camera không xuyên trần + sửa lỗi rơi xuyên sàn khi vào zone (10/10/2026, nhánh `fix/camera-ceiling`)
- **Camera xuyên trần (CHECKLIST mục 1, P1):** trần trong nhà chỉ là mặt lưới hiển thị (`interior.ceiling`, không có `COL_`)
  nên camera chơi (chỉ tránh `COL_`) ngẩng 1,15 rad × lùi 7 m lên tới 7,9 m trên chân người chơi, thấy mái nhà từ trên. Đo
  trước khi sửa (mọi chỗ đứng được dưới trần, 12 hướng): ngẩng hết cỡ xuyên trần ~85 % số lần ở zone 3–5, cả ở góc mặc định
  (0,32 rad, 4,2 m) cũng xuyên vài chục lần ở chỗ trần thấp. Sửa: `clampCeiling` (`game/src/world/collision.js`) — tia điểm
  nhìn → camera đang đi lên mà chạm mặt nằm ngang (|pháp tuyến.y| > 0,7) của `zone.view` (lưới hiển thị có BVH, đã có cho
  camera hội thoại) thì camera dừng dưới mặt đó ≥ 0,15 m theo phương đứng (mặt phẳng gần 0,1 m không cắt trần). Mặt đứng
  (tường, bàn ghế) bỏ qua → camera không bị kéo vào mỗi lần lướt qua sau đồ vật (tránh cả lưới hiển thị thì góc mặc định bị
  kéo vào gấp ~8 lần, góc thấp −0,25 rad 120–166 lần mỗi zone). Không cần hộp trần trong `data/collision.json` (zone 4 có
  giếng trời 7,35 m, nhiều tầng) hay giới hạn độ cao theo zone.
- Đo lại sau khi sửa (cả 6 zone, chỗ đứng được, 4 góc ngẩng × 12 hướng): 0 lần xuyên trần; còn 43–69 / 2.244 mẫu ở zone 3
  khi có vật nằm ngang ngay trên đầu < 0,5 m (tủ, kệ hạt lúa) — camera không vào gần hơn 0,5 m (như với tường). Ngoài trời góc
  mặc định bị kéo vào < 1 % mẫu (đi dưới mái hiên, biển hiệu — đúng ý). Ngẩng hết cỡ: zone 5 (trần 2,95 m) camera cao nhất
  2,85 m, lùi ~1,4 m; sảnh zone 3 4,05 m; zone 4 3,45 m.
- **Rơi xuyên sàn khi vào zone (thấy khi chụp ảnh camera):** `THREE.Timer` trả dt âm ở khung đầu tiên sau việc dài (tải zone,
  biên dịch shader: mốc thời gian rAF sớm hơn lúc tạo Timer) — −0,883 s trên SwiftShader khi vào thẳng zone 5. `Math.min(dt,
  0,1)` không chặn số âm → trọng lực đảo chiều, capsule bị kéo 4 m xuống dưới sàn. Cứu "rơi khỏi bản đồ" (y < −10) đưa về
  "vị trí khung trước + 1 m" — đã ở dưới sàn → rơi mãi quanh y −9 … −10 (`fellOut` tăng hoài). Có từ trước (cả `b9686c4`);
  smoke không thấy vì `step()` dịch chuyển người chơi. Sửa: `main.js` chặn dt trong [0; 0,1]; `Player.safe` = chỗ đứng vững
  gần nhất (lúc `spawn` + mỗi khung `onGround`), rơi thì về đó.
- Dev: `__game.cameraCeiling({ withView })` — camera ngẩng / lùi hết cỡ ở chỗ người chơi + mọi SPAWN_ của zone, 12 hướng: số
  lần xuyên trần, độ cao camera; `withView: false` = như trước khi sửa (đối chứng).
- Kiểm thử: smoke zone 3, 4, 5 (ngoại hình đầu) "camera ngẩng / lùi hết cỡ không xuyên trần" (0 lần; chỉ tránh `COL_`: 36 / 30
  / 72 lần); mọi lượt "đứng vững trên sàn khi vào zone; rơi xuyên sàn → về chỗ đứng gần nhất" (bỏ 2 bản sửa thì hỏng: rơi
  tới y −9,2). test:data đạt; build + smoke như CI (`--build --look intern_nam,intern_nu`) 58/58 bước (2 phút 45 giây).
  Ảnh: `renders/game/ceil_zone_05_{truoc,sau}.png`, `ceil_zone_04_sau.png`.

### Gộp 2 nhánh vào `main`, deploy, sửa CI (10/10/2026)
- `feat/zone5-seat-cap` (PR #1 → `main` 56537a3) và `fix/camera-ceiling` (PR #2 → `main` bef8792) đã gộp; `gh-pages` 0790018
  build từ `main` bef8792 (pages build and deployment: xanh). 2 lỗi P1 (không ra được khỏi zone 5, camera xuyên trần) + lỗi
  rơi xuyên sàn đã lên trang thật. Sau đó: PR #3 tiếng Việt (`main` ccf259f) + sửa ảnh thẻ (`main` 680cc30, CI xanh) →
  deploy `gh-pages` 6416ec3 (106 file, 16,9 MB, quét riêng tư 0 phát hiện). Deploy lại `gh-pages` 202c71d từ `main` ac4d358
  (code game như 680cc30, chỉ thêm tài liệu; test:data đạt, 106 file, quét riêng tư 0 phát hiện).
- **CI không chạy từ c2439ba:** tên bước "Cài máy chủ … (test mạng: zone 4 …)" trong `.github/workflows/test.yml` có `: `
  → YAML lỗi, GitHub báo đỏ ngay mà không có job nào (run 18–21: 2 nhánh + 2 lần gộp). Sửa: tên bước trong ngoặc kép.
- Kiểm tra lại `main` bef8792 trên máy cloud: test:data đạt; test:pool đạt (cả `pool_rules`); build + smoke
  (`--build --look intern_nam,intern_nu`) 58/58 bước (4 phút 5 giây). Lần chạy dev 1 ngoại hình trước đó hỏng 1 lần bước
  "bi-a 2 người · An ngồi → tập một mình" (máy Bình đã phát lại cú, `mismatch` 0, nhưng chưa về trạng thái dừng trong 20 s);
  chạy lại thì đạt — theo dõi trên CI, lặp lại thì xem thời gian phát lại cú ở máy người xem.
- **CI chạy lại được thì hỏng 1/58 bước: ảnh thẻ ở màn tổng kết của ngoại hình thứ 2** (lượt chạy trọn cảnh kết) — nút
  Download kẹt ở "Preparing your card…". CI dùng Chromium *headless shell* của Playwright (máy cloud dùng Chromium đầy đủ
  `/opt/pw-browsers/chromium-1194` → không thấy); bỏ `executablePath` thì máy cloud cũng hỏng. Đo: vẽ thẻ 3 ms nhưng
  `canvas.toBlob` 52 s — canvas 2D mặc định nằm trên GPU, phải chờ GPU (SwiftShader) vẽ xong cảnh 3D phía sau (zone_01
  hoàng hôn ~0,3 khung/giây; zone_01 vào thẳng 1, zone_05 7 khung/giây — do không có card đồ hoạ, không phải lỗi game).
  Sửa: canvas ảnh thẻ trên CPU (`getContext("2d", { willReadFrequently: true })`, `game/src/ui/summary.js`) → toBlob 34 ms
  – 1 s; cũng đỡ cho laptop yếu (GPU đang bận vẽ game). Thử lại như CI (headless shell, `--build --look
  intern_nam,intern_nu`): 58/58 bước (4 phút 41 giây); Chromium đầy đủ `--zone 5`: 15/15. CI của PR #3 (tiếng Việt,
  `main` ccf259f) hỏng đúng bước này; sau khi đặt bản sửa lên `main` ccf259f: 60/60 bước như CI (4 phút 43 giây).

### Ngôn ngữ Anh / Việt (10/10/2026, nhánh `feat/vietnamese`)
- **Chốt với người dùng:** thêm tiếng Việt (bỏ quy tắc "chữ trong game là tiếng Anh" — `CLAUDE.md` đã sửa); bản Việt phải
  tự nhiên, văn nói cho hội thoại, văn viết gọn cho giao diện. Xưng hô: Tú "mình – cậu"; chị Huyền, chị Nga, chị quản lý, chị
  Lan, chị Hà ↔ "em"; anh Prajith, anh Minh, anh Khang, anh tài xế, người lạ, hành khách ↔ "em"; lời dẫn + giao diện gọi "bạn".
  Giữ từ công sở FPT: intern, mentor, team, app, check-in, laptop. Mặc định theo ngôn ngữ trình duyệt. Toàn bộ quy tắc + bảng
  thuật ngữ: `docs/vi_style.md` (đọc trước khi viết chữ mới).
- **Nội dung:** `data/i18n/vi.json` (233 chuỗi, cùng khoá `en.json`; `en.json` thêm `menu.language`, `lang.en|vi`), trường
  `"vi"` ngay sau mọi `"en"` trong data (685 chuỗi: lời thoại 179, mini-game + lời nhắc E 256, hướng dẫn 101, nhiệm vụ 35,
  phần thưởng 32, quiz 22, giá trị 19, …) — chèn bằng script giữ nguyên định dạng file (diff chỉ thêm `"vi"`). Tên bảng tên
  `characters.json` → `names.vi` (Chị Huyền, Chị Nga, Tài xế, Quản lý…); mới: `names_ref.vi` = tên gọi khi nhắc trong câu
  (thông báo "Đã lưu lời khuyên của chị Lan…", chữ ký Sổ lời khuyên; `Characters.refName`). Tên danh hiệu theo GDD (Gương Sáng
  Làng F, Đồng Đội Số 1, Người Kết Nối, Mọt Sách Làng F, Nhà Thám Hiểm, Intern Làng F), "Sổ tay học tập", "Huy hiệu Tinh thần
  Đồng đội"; 6 giá trị dùng tên gốc (Tôn trọng, Đổi mới, Đồng đội, Chí công, Gương mẫu, Sáng suốt). Bản tiếng Việt gọi thẳng
  tên Tú (không cần `{tu_his}`; `{tu_he}` vi = cậu ấy / cô ấy vẫn có). Dấu thanh kiểu cũ như tên Hòa Lạc (hòa, khóa, thủy).
- **Soát bản dịch:** 3 agent đọc độc lập (lời thoại theo luồng + người nói; mini-game + nhãn nút; giao diện + hướng dẫn +
  tin nhắn) → ~110 câu sửa: xưng hô (chị Nga gọi "chị Huyền", chị quản lý gọi "chị Lan, anh Minh", lời khuyên của anh Minh /
  anh Khang gọi "em"), nghĩa ("túi đồ" chứ không phải "đồ mang theo", "việc không gấp" thay "việc làm thêm", "mốc sớm nhất",
  "nhà chờ xe"), nút trùng chữ ("Để sau" thoát mini-game ↔ "Chưa cần" / "Chưa gấp"), câu dịch sát ("Gặp em ở đó", "Lại là
  chị Huyền đây", "Cảm ơn cậu vì tất cả"). Giữ ô Tôn trọng "nhường người khác đi trước" (bản Anh ghi "get off first" nhưng
  cảnh trong game là nhường hành khách lên xe — đã có trong `docs/dialogue_review.md` chờ HR).
- **Code:** `game/src/i18n.js` — `LANGS`, `pickLang` (?lang= > cài đặt > `navigator.languages` vi… > en), `loadStrings` đặt
  `<html lang>` + đại từ Tú theo ngôn ngữ. `main.js` → `setLanguage(l)`: tải chữ, lưu `fville.settings.lang`, đổi tiêu đề
  trang / nút Skip, `Game.onLanguage()` viết lại mục tiêu, bảng tên NPC / Tú, biển tên trên bàn (chữ khác theo ngôn ngữ mới ở
  lần hiện sau; hội thoại / mini-game / app / bàn bi-a không mở cùng menu Esc được). Màn tạo nhân vật: nút English / Tiếng
  Việt ở góc (phần tử `data-t` / `data-t-aria` / `data-t-ph` viết lại tại chỗ, giữ tên đang gõ, nhân vật, vị trí); menu Esc:
  hàng "Ngôn ngữ". Ngày trên thẻ PNG theo `vi-VN`.
- **Kiểm thử:** `test:data` mục 7 "bản tiếng Việt" (917 cặp: thiếu `vi`, khoá `vi.json` lệch `en.json`, biến `{…}` lệch —
  bản vi được bỏ `{tu_*}`, chữ vi giống hệt en mà có ≥ 2 từ tiếng Anh, dấu thanh kiểu mới, `names.vi` / `names_ref`); thử cài
  lỗi → bắt đủ 4/4. `test:smoke`: ngoại hình thứ 2 (CI: intern_nu) bấm "Tiếng Việt" ở màn tạo nhân vật, đổi English ↔ Tiếng
  Việt ở menu Esc (mục tiêu đổi ngay, tiến trình / vị trí giữ nguyên), chơi trọn zone 0 → 5 + cảnh kết + màn tổng kết bằng
  tiếng Việt, tải lại trang vẫn tiếng Việt; `--lang vi|en` ép 1 ngôn ngữ. Build + smoke như CI: 60/60 bước (2 phút 25 giây).
  Ảnh: `renders/game/vi_{summary,card,compass}.png`.

### Mô hình bối cảnh Sketchfab: xe bus, cây, bụi tre (10/10/2026, nhánh `feat/env-models`)
Ba mô hình CC BY 4.0 (file gốc chép vào `assets/props/{bus,tree,bamboo}/source/`, không commit; ghi nguồn `CREDITS.md`),
dựng lại mỗi lần build zone bằng `scripts/blender/lib/bus.py`, `trees.py`, `bamboo.py` (cùng cách bàn bi-a / tượng Cuder).
- **Rà trước khi sửa — mọi chỗ game dùng xe bus:** zone_00 `xe_bus_1..3` (dùng chung lưới, xoay 180°, đầu xe −X), cánh cửa
  con `xe_bus_N_cua` (gốc = bản lề, mở 162° quanh trục đứng), `INT_bien_xe_N` + `bien_xe_N_mesh` (biển số trên kính, con
  của xe), xe số 2 `dynamic`, `NPC_tai_xe_1/3`, `NPC_thao_cua_xe`, `NPC_hanh_khach`, `TRIGGER_len_xe` (tâm cửa xe số 2),
  `CAM_lenxe_1..3`, `PATH_xe_roi_tram` (bắt đầu đúng gốc `xe_bus_2`), `COL_xe_bus_1..3`; zone_01 `INT_xe_bus` →
  `xe_bus_mesh` → `xe_bus_cua`, `ENV_xe_bus_dau_1..3`, `PATH_xe_vao_tram` (kết thúc đúng gốc `INT_xe_bus`), `NPC_tai_xe`,
  `SPAWN_zone_01_cua_xe`, `COL_xe_bus_*`; data: `cutscenes.json` (`len_xe`: bus / door / path / arrive; `ending.bus_stop`),
  `interactables.json` (`INT_bien_xe_1..3`, `INT_xe_bus` `at`), `quests.json`, `characters.json` (`tai_xe` near_node);
  code: `cutscene.js` (Mover theo PATH_, `swingDoor` quay cửa quanh Y, `yAngle` đọc góc mở từ GLB), `ending.js`,
  `guide.js` (dấu "!" trên đỉnh lưới biển số). Tên node và gốc toạ độ giữ nguyên → không phải sửa data.
- **Xe bus** ("Bus jb5 Low Poly", seenkonkgrng): xoay đầu xe +X, dời dọc thân để **tâm cửa khách vẽ trên mô hình trùng tâm
  cửa cũ** (`props.BUS_DOOR_X` = 4,675 m) → `TRIGGER_len_xe`, `SPAWN_`, `NPC_` ở cửa giữ nguyên. Cánh cửa cắt từ mặt hông
  theo khung cửa vẽ trên ảnh (dày 4 cm, gốc = bản lề mép trước), chỗ cắt thành hõm tối có khung + 2 bậc. Sơn tím → trắng +
  sọc đỏ như xe cũ (giữ đổ bóng; mép tối thành xám, không viền đỏ răng cưa), xoá chữ thương hiệu / biển số nước ngoài /
  chú thích bản vẽ, bỏ clearcoat → `M_bus_tex` (ảnh × vertex color, toon + viền nét), WebP 1024 × 512 **58 KB**. Biển số
  tuyến 1/2/3: bảng LED ngay trước kính lái, nghiêng 31° theo kính (đo bằng tia dò) + bảng trên cửa. Thân 1.697 + cửa 28 tam
  giác (xe khối cũ 2.364); thân thật 11,86 × 2,58 × 3,76 m → `COL_xe_bus_*` và kiểm tra đường xe rời trạm theo kích thước
  thật (`bus.body_box()`; hở với xe số 1: 0,33 m). Mọi xe trong zone dùng chung lưới thân + lưới cánh cửa; xe đậu zone_01 có
  cánh cửa đóng (trước đây chỉ có hõm).
- **Cây** ("Tree low poly lowpoly", 00amza): thay mọi cây `kit.tree` ở zone 0–3 (10 / 17 / 52 / 12 cây). `kit.TREES`: tree()
  vẫn rút số ngẫu nhiên y như cũ (mọi vật dựng sau giữ nguyên chỗ) + giữ ô gốc, vôi trắng, chỗ đặt, chiều cao; bỏ khối thân /
  tán, ghi chỗ đặt → `trees.place()` đặt bản sao (2 cây gốc, xoay ngẫu nhiên hạt giống riêng). Lá: alpha cắt (glTF MASK →
  `alphaTest`), 2 mặt, pháp tuyến hướng từ tâm tán (tô toon như khối tròn), màu lá đổi về 4 tông xanh bảng màu game; mảng lá
  cắt sát đa giác 8 cạnh bao cành lá (ảnh lá chỉ phủ 21 % ô ảnh → bớt ~44 % điểm ảnh lá phải tô); cây gần bỏ 20 %, cây xa
  (detail 1) bỏ 45 % mảng lá. Thân + lá **không viền nét** (viền thân cây gộp tốn ~0,3 ms/khung ở zone_02). Ảnh 256² WebP
  23 KB dùng chung.
- **Bụi tre** ("bamboo tree", tojamerlin; 178k tam giác, 10,6 MB, cm): dựng lại low-poly theo đúng 19 thân (trụ 5 cạnh × 4
  đoạn, đốt tre lặp theo độ cao) + 600 / 5.321 lá (thoi 2 tam giác theo hướng / bề ngang từng lá gốc) → **1.960 tam giác /
  bụi**, cao 4,3 m (đặt 4,6–5,2 m). Atlas thân | lá 256 × 512. 4 bụi ở zone_02: đuôi đảo giếng (chỗ bụi cũ, như ảnh thật — hạt
  lúa `z2_bui_tre` vẫn ở gốc) + 3 bụi hai bên đường xe vào (ngoài bó vỉa, không chắn đường); `COL_bui_tre*` ở gốc theo bán kính
  gốc thật. Bụi tre khối cũ (zone_01 vẫn dùng) gọi với builder bỏ hình → rng không lệch.
- **Game:** `world/zone.js batchInstances` gộp bản sao có custom property `batch` thành 1 mesh mỗi chất liệu (zone_02: 56 cây /
  tre → 4 lượt vẽ), mỗi bản sao 1 số `plantId`; `render/seethrough.js`: mỗi `plantId` = 1 cây (không chia mảnh, không gộp với
  cây tán chạm nhau), "camera trong tán" xét bằng hộp tán (mảng lá không kín); `renderer.js` + viewer: chép `alphaTest`, chất
  liệu `outline = false` (extras) hoặc alphaTest → không viền nét. Ảnh xem trước Blender (`render.add_outlines`) cũng bỏ viền
  các object đó.
- **Đo FPS** (trình duyệt nhúng, GPU tích hợp AMD Radeon, khung 1024 × 768, pixelRatio 1, Detail Sharper, `__game.benchmark(120)`
  ở SPAWN đầu zone; bản build `main` trước / sau đặt ở 2 tab, đo xen kẽ, trung vị; zone_02 đo cả 2 thứ tự tab — tab có lệch
  ~5 %, khung trình duyệt bị ẩn nên số nhiễu ±5 %):

  | Zone | ms/khung trước → sau | FPS | Draw call | Tam giác khung cuối | GLB |
  | --- | --- | --- | --- | --- | --- |
  | 0 | 4,35 → 4,58 | −5 % | 40 → 34 | 75,5k → 70,6k | 235 → 328 KB |
  | 1 | 4,39 → 4,61 | −5 % | 30 → 27 | 59,3k → 51,7k | 247 → 315 KB |
  | 2 | 3,28 / 3,41 → 3,53 / 3,80 | −9 % | 21 → 21 | 70,4k → 54,6k | 508 → 526 KB |
  | 3 | 4,70 → 4,92 | −5 % | 20 → 20 | 62,6k → 60,3k | 334 → 361 KB |

  Lần build đầu (lá đủ, viền thân cây, 1.100 lá tre) zone_02 −17 %; bớt viền + cắt / bớt lá → −9 %. Tam giác trong cả zone
  (report): zone_02 58,4k → 114,8k (cây gộp 1 lượt vẽ, không cắt theo tầm nhìn — vẫn trong mục tiêu FPS).
- **Kiểm tra:** check_glb 0 lỗi cả 4 zone; test:data đạt; test:smoke 3 ngoại hình zone 0 → 5 + bản lưu cũ, mạng: **79 bước
  đạt** (thêm bước zone 0–3: cây / tre gộp lượt vẽ, mỗi bản sao 1 cây làm mờ riêng, lá alphaTest không viền, xe bus mô hình).
  Ảnh (`renders/`): `zone_00_pickup_xe_bus_can.png` (cận xe số 2: cửa mở, biển "2"), `zone_00_pickup_xe_bus_toan_canh.png`,
  `zone_00_pickup_cay_via_he.png`, `zone_02_campus_cay_canh_lang.png`, `zone_02_campus_tre_gieng.png`; so trong game trước /
  sau ở đảo giếng zone_02.
- Commit 84fcbec trên nhánh `feat/env-models` (rebase lên `main` c430b03: test:data, test:pool đạt, smoke 81 bước đạt);
  Pull Request vào `main`, chưa deploy.

### Tài liệu và repo
- `docs/CHECKLIST.md` (10/10/2026): bảng việc chung của nhóm — cách nhận / đánh dấu việc, quy tắc làm chung (nhánh riêng →
  Pull Request → GitHub Actions), việc theo ưu tiên P1–P3 (trước / trong buổi chơi thử, nội dung, nhân vật 3D, tính năng,
  kỹ thuật) và tóm tắt việc đã xong. Thêm mục 6 "Ngôn ngữ và âm thanh": ngôn ngữ Anh / Việt, lồng tiếng nhân vật, nhạc
  nền + hiệu ứng âm thanh.
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
- Tủ đồ: mũ lưỡi trai đã đội được (phần 2, 10/10/2026); còn tab Wardrobe + danh sách món (CHECKLIST mục "Tủ đồ").
- Mặt nạ intern_nu: lọn tóc mảnh vắt ngang trán (vẽ trên da mặt, giữa lọn có vệt sáng trắng) đang tính là da — chỉ ảnh
  hưởng khi sau này đổi màu tóc.
- huyen: bàn tay buông lấn vào đùi 3–5 cm ở 7 animation (talk, talk_2, nod, phone, press, wave, cheer) do dùng lại
  animation của prajith; chờ quyết định tải bản Mixamo riêng cho huyen.
- Logo FPT trên áo prajith và huyen là bản tạm (mảng tách từ texture prajith); thay khi có file logo chính thức
  (`apply_chest_logo.py --id <nhân vật> --logo <file>`).
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
Bảng việc của cả nhóm (ai nhận gì, ưu tiên P1–P3): `docs/CHECKLIST.md`.

0. ~~Đưa máy chủ chơi nhiều người lên Cloudflare~~ — **xong 10/10/2026** (`https://fville-net.fville-onboard.workers.dev`,
   xem "Chơi nhiều người đã lên mạng" ở trên). Còn: chơi thử 2–3 người trên bản deploy; đo FPS trên laptop thật với
   `net_bots.js` (bật / tắt Show other players).
1. Chơi thử hệ thống hướng dẫn với người mới thật: có ai đứng yên quá 10 s không, câu nhắc có đúng lúc không (thời gian
   chỉnh trong `data/guidance.json` → `settings`; câu chữ trong `goals`), dấu "!" có quá lộ không (tắt trong menu Esc).
2. Chơi thử lại bản đã deploy trên máy thật: cây mờ có dễ chịu không (mức mờ `max`, thời gian `fade_s` chỉnh trong
   `data/scene_fixes.json` → `see_through`), camera hội thoại (chỉnh khung hình bằng các hằng số đầu
   `game/src/player/talkcam.js`: `FRAME_FRAC`, `FACE_AT`, `SHOULDER`, `BLEND_S`).
3. Chơi thử với 3–5 người thật trên laptop văn phòng (điều kiện để sang Giai đoạn 2, theo GDD).
   Đo luôn hiệu năng trên một laptop Intel UHD/Iris Xe: mở `?debug`, gõ `__game.benchmark(120)` ở từng zone; xem
   nấc Detail tự hạ có bật không (`__game.state.detailLevel`).
   Gửi `docs/hr_content_request.md` cho HR.
4. Giai đoạn 2 còn lại: tab Bản đồ trong My FPT; model riêng cho Manager, Lan, Minh, Hà, anh Khang (đang tạm dùng
   intern_nam / intern_nu); ~~người chơi ngồi vào ghế ở bàn làm việc~~ (xong 10/10/2026); chơi thử zone 5 + cảnh kết với
   người thật (độ dài ~8 phút, mini-game bi-a có quá khó không).

## Việc nhỏ để sau
- ~~zone_04: lan can thật ở mép tây chiếu trên, COL_ vách trên cửa quẹt thẻ, dời `SPAWN_zone_04_from_zone_03`~~ — xong
  10/10/2026 (xem "Dựng lại zone_04" ở trên).
- Công cụ build (thấy khi dựng lại zone_04): trên Windows `scripts/tools/check_glb.py` lỗi khi in chữ tiếng Việt (chạy với
  `PYTHONIOENCODING=utf-8`, cũng như `privacy_scan.py`); `scripts/build.py` không báo lỗi khi `gltf-transform` hỏng / thiếu
  (vẫn in kích thước GLB cũ) — nên kiểm tra mã thoát.
- zone_03, cây ngoài sân (`ENV_cay_san`): một cụm khoảng 8,7 × 6,9 × 7,2 m (x 24,8–33,5; z 1,6–8,8, toạ độ glTF) bị
  `seeThrough` gộp thành 1 cây vì các tán dính nhau → khi che thì mờ cả cụm cùng lúc. Chưa cần sửa (cây ngoài vách kính,
  ít khi che người chơi). Cách sửa nếu cần: không gộp mảnh chỉ vì chạm nhau mà tách theo thân cây (mỗi thân + các cụm lá
  gần nó nhất).

## Nội dung [DRAFT] chờ HR (20 mục)
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
18. Mục tiêu của team trong lời Manager (zone 5).
19. Hộp quà của team ở bàn làm việc (zone 5): vật trong hộp và mô tả phần thưởng Team Welcome Gift.
20. Mini-game Đăng nhập (zone 5): quy định mật khẩu thật và cách bật 2FA (HR/IT).

Danh sách lấy từ dữ liệu (`"draft": true`); trong game các nội dung này hiện chữ [DRAFT]. Quiz tượng Cuder đã có nội
dung từ mentor (09/10/2026), không còn [DRAFT].
