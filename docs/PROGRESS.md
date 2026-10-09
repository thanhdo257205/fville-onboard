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

- **Hướng dẫn người chơi mới (09/10/2026)** — nguyên tắc: lúc nào cũng biết "giờ làm gì" trong vài giây. Code
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
    balo cho Tú, trả ví). Dòng điều khiển thêm "H: help". Kiểm tra dữ liệu lúc tải: thiếu help / câu nhắc → báo lỗi.
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
1. Chơi thử hệ thống hướng dẫn với người mới thật: có ai đứng yên quá 10 s không, câu nhắc có đúng lúc không (thời gian
   chỉnh trong `data/guidance.json` → `settings`; câu chữ trong `goals`), dấu "!" có quá lộ không (tắt trong menu Esc).
2. Chơi thử lại bản đã deploy trên máy thật: cây mờ có dễ chịu không (mức mờ `max`, thời gian `fade_s` chỉnh trong
   `data/scene_fixes.json` → `see_through`), camera hội thoại (chỉnh khung hình bằng các hằng số đầu
   `game/src/player/talkcam.js`: `FRAME_FRAC`, `FACE_AT`, `SHOULDER`, `BLEND_S`).
3. Chơi thử với 3–5 người thật trên laptop văn phòng (điều kiện để sang Giai đoạn 2, theo GDD).
4. Giai đoạn 2: zone 4 (cửa quẹt thẻ, phòng FSA; lựa chọn nhắn Ms. Nga qua app — câu dự kiến trong
   `docs/dialogue_nga.md`), zone 5 (gặp Prajith, gặp Manager, Say Hello Team, bàn làm việc), màn tổng kết, danh hiệu,
   tải ảnh thẻ, tab Bản đồ và Sổ lời khuyên.

## Việc nhỏ để sau
- zone_03, cây ngoài sân (`ENV_cay_san`): một cụm khoảng 8,7 × 6,9 × 7,2 m (x 24,8–33,5; z 1,6–8,8, toạ độ glTF) bị
  `seeThrough` gộp thành 1 cây vì các tán dính nhau → khi che thì mờ cả cụm cùng lúc. Chưa cần sửa (cây ngoài vách kính,
  ít khi che người chơi). Cách sửa nếu cần: không gộp mảnh chỉ vì chạm nhau mà tách theo thân cây (mỗi thân + các cụm lá
  gần nó nhất).

## Nội dung [DRAFT] chờ HR (16 mục)
1. Tin nhắn đầu game (Ms. Nga, Tuyển dụng): xe số 2 đi Hòa Lạc, đón lúc 06:45, mã intern FV-2026 để đăng nhập App My FPT.
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
