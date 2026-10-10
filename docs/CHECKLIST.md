# Checklist dự án "Ngày Đầu Ở F-Ville"

Bảng việc chung của nhóm. Cập nhật lần cuối: 10/10/2026 (trang đang chạy: `gh-pages` a9a3dcc, build từ `main` 1a79739 — gồm PR #1
bi-a bước 3, chia phòng, ngồi ghế, mũ, zone_04, sửa lỗi zone 5; PR #2 camera / rơi xuyên sàn; PR #3 tiếng Việt; sửa CI + ảnh
thẻ; PR #5 mô hình bối cảnh Sketchfab (xe bus, cây, bụi tre); PR #6 sửa bay lơ lửng ở bàn bi-a, rò rỉ bộ nhớ GPU; PR #7 tab
Bản đồ; máy chủ Cloudflare chưa `wrangler deploy` bản mới → bàn bi-a trên trang thật vẫn chỉ tập một mình).

## Cách dùng

- Nhận việc: điền tên vào `Phụ trách:` rồi commit (hoặc ghi trong Pull Request).
- Xong việc: đổi `[ ]` thành `[x]`, ghi hash commit / số PR ở cuối dòng.
- Ưu tiên: P1 = làm trước buổi chơi thử · P2 = làm sau buổi chơi thử · P3 = khi rảnh.
- Chi tiết kỹ thuật của từng việc nằm trong `docs/PROGRESS.md`; nội dung game trong `docs/GDD.md`.

## Quy tắc làm chung

- Mỗi việc làm trên một nhánh riêng → Pull Request vào `main` → GitHub Actions chạy kiểm thử → người duyệt gộp.
- Mỗi người một mảng file, tránh hai người cùng sửa một chỗ (ghi mảng của mình trong PR).
- Chỉ một người deploy trang (`python scripts/deploy_site.py`) và máy chủ Cloudflare (`npx wrangler deploy`).
- Commit bằng email noreply GitHub của chính mình. Không commit: ảnh/video người thật, file Meshy gốc, FBX Mixamo, `.blend`,
  logo gốc, token, email, đường dẫn máy cá nhân (`privacy_scan` sẽ chặn).
- File gốc 3D chia sẻ riêng qua Drive nội bộ, không đưa lên repo. Không chia sẻ ảnh/video có người thật hoặc thẻ nhân viên.
- Kiểm thử trước khi push: `npm run test:data`, `npm run test:pool`, `npm run test:smoke -- --zone N` (zone vừa sửa).

## 1. Trước buổi chơi thử (P1)

- [x] P1 **Lỗi: không ra được khỏi zone 5** (từ `gh-pages` 04a74b2; đã sửa — c255b5c, gộp `main` qua PR #1; smoke thêm bước
  zone 5 → zone 4 → zone 5; đã deploy `gh-pages` 0790018). Đi ra cửa sang zone 4 → "Couldn't open Card Gate · FSA
  Room. t.map?.dispose is not a function"; bấm Back / vào lại → "Couldn't open Office." Cảnh kết (zone 5 → bến xe zone 1)
  cũng hỏng theo. Nguyên nhân: cây cơ của bàn bi-a là bản sao `cue_2` (`cueModel` trong `game/src/pool/table.js`) —
  `clone()` chép `userData` qua JSON nên `userData.srcMaterial` thành object thường, `map` là chuỗi id → `disposeZone`
  (`game/src/world/zone.js`) gọi `.dispose()` trên chuỗi khi rời zone. Sửa: xoá `srcMaterial` khỏi bản sao + `disposeZone`
  chỉ dispose texture thật; thêm vào `test:smoke` bước zone 5 → zone 4 → zone 5 (smoke hiện không đi ngược khỏi zone 5 nên
  không bắt được); build, deploy lại — Phụ trách: —
- [x] P1 **Lỗi: camera xuyên trần nhà khi ở trong nhà** (zone 3, 4, 5 — kéo chuột lên thì camera bay lên tận nóc, thấy cả mái
  nhà từ trên xuống; đã sửa — nhánh `fix/camera-ceiling`: camera tránh mặt nằm ngang của lưới hiển thị `zone.view` (trần, gầm
  chiếu nghỉ, mái hiên), không cần hộp trần trong data hay giới hạn độ cao theo zone; smoke zone 3–5 ngẩng / lùi hết cỡ: 0 lần
  xuyên, chỉ tránh `COL_` thì 30–72 lần; PR #2, đã deploy `gh-pages` 0790018). Nguyên nhân: camera chỉ tránh hộp `COL_` mà các zone trong nhà không có `COL_` cho trần; góc ngẩng tối
  đa 1,15 rad × khoảng cách 4,2 m → camera cao ~5 m trên đầu người chơi (trần ~3 m). Sửa: thêm hộp trần cho zone 3–5 bằng
  `data/collision.json` (không cần Blender) hoặc cho camera tránh cả lưới hiển thị (`zone.view`, như camera hội thoại / bàn
  bi-a), kèm giới hạn độ cao camera theo zone; thêm kiểm tra vào `test:smoke` (ngẩng hết cỡ, camera vẫn dưới trần) —
  Phụ trách: Claude
- [x] P1 **Lỗi: rơi xuyên sàn khi vào zone, không lên lại được** (thấy khi sửa lỗi camera; đã sửa — PR #2; đã deploy
  `gh-pages` 0790018). Khung đầu tiên sau lúc tải zone / biên dịch shader có dt âm (−0,9 s trên SwiftShader; máy yếu như laptop Intel
  của buổi chơi thử cũng có thể gặp) → trọng lực đảo chiều, người chơi bị kéo xuống dưới sàn (thấy rõ khi tải lại trang ở
  zone 5); cứu "rơi khỏi bản đồ" lại đưa về vị trí khung trước + 1 m (đã ở dưới sàn) → rơi mãi quanh y −9 … −10. Sửa: chặn dt
  âm (`game/src/main.js`), rơi thì về chỗ đứng vững gần nhất (`game/src/player/player.js`); smoke kiểm tra lúc vào zone —
  Phụ trách: Claude
- [x] P1 **Lỗi: mất dấu Objective markers ở tất cả các zone** (dấu "!" + mũi tên ở mép màn hình) — người dùng kiểm tra lại
  10/10/2026: đã hết lỗi (bản `gh-pages` 6416ec3 trên trình duyệt sạch cũng hiện đủ ở 6 zone; nếu gặp lại, xem trước menu
  Esc → "Objective markers" có đang Off không) — Phụ trách: —
- [ ] P1 **Lỗi: đánh bi-a xong camera nâng lên, bị đèn treo của bàn che** — Phụ trách: —
  - Nguyên nhân (đọc code): lúc bi lăn (`phase === "roll"`, camera trong `game/src/pool/table.js`) camera đặt cao hơn mặt bi
    1,55 m (~2,4 m trên sàn), lùi 1,15 m. 3 chao đèn thả (`pool_lamps`, `scripts/blender/lib/interior.py`: chao ở 1,62–1,87 m,
    bán kính 0,24 m, cách nhau 0,8 m) nằm ngay giữa camera và mặt bàn. `clampCamera` xét cả lưới hiển thị nên tia từ bi tới
    camera chạm chao đèn → camera bị kéo vào sát chao. Lúc ngắm, lăn chuột kéo camera ra xa hết cỡ (`camDist` 2,4 → cao ~2 m)
    cũng chạm đèn.
  - [ ] Sửa (đề xuất): camera lúc bi lăn hạ xuống dưới mép chao (≤ ~1,5 m) và lùi xa hơn, nhìn chéo xuống bàn; đèn nào che
    tầm nhìn thì làm mờ bằng `seeThrough` sẵn có (không sửa GLB) và không tính đèn trong `clampCamera`; giới hạn chiều cao
    camera lúc ngắm thấp hơn mép chao
  - [ ] Kiểm thử: smoke bi-a — trong lúc bi lăn, tia từ camera tới tâm bàn không cắt lưới nào (trừ bi); chụp 1 ảnh để xem
- [x] P1 **Lỗi: nhân vật bay lơ lửng khi chỉnh góc cơ ở bàn bi-a** (người dùng báo 10/10/2026; đã sửa — nhánh
  `fix/pool-float-card`, PR #6; đã deploy `gh-pages` a9a3dcc). Giữ A/D hoặc kéo chuột 2 s → người chơi lên cao 1,94 m. Nguyên nhân: mỗi khung xoay cơ
  `placePlayer()` (`game/src/pool/table.js`) đặt người chơi ở độ cao hiện tại + 2 cm, trọng lực chỉ kéo xuống ~3 mm / khung →
  bay lên ~1 m/s. Sửa: đặt theo độ cao sàn lúc vào bàn (`standY`, chỗ đứng vững gần nhất), không cộng thêm; smoke giữ D rồi A
  ở bàn: chân cách sàn 0 mm (bỏ bản sửa thì 1940 mm) — Phụ trách: Claude
- [x] P2 **Rò rỉ bộ nhớ GPU khi đổi zone** (thấy khi tìm lỗi CI; đã sửa — nhánh `fix/pool-float-card`). Mỗi vòng zone 2 → 5 → 1
  đọng thêm ~25 geometry, ~15 texture: vật do code đặt (hạt lúa, hũ, ví, bảng tên — nằm ngoài `zone.root`), đường ngắm bàn
  bi-a (Line, `disposeZone` chỉ dọn Mesh), texture xương của mọi nhân vật (`Character.dispose` không gọi `skeleton.dispose()`,
  zone 5 đọng 7 cái mỗi lần vào). Người chơi thật đi một mạch zone 0 → 5 → bến xe cũng đọng như vậy (laptop dùng chung RAM
  cho card đồ hoạ). Sửa: `disposeTree` (`game/src/world/zone.js`), dọn vật do code đặt khi đổi zone, `Character.dispose` dọn
  xương + vật liệu riêng; đồ dùng chung đánh dấu `userData.shared`; smoke: zone_04 ↔ zone_05 2 vòng, số geometry / texture
  không tăng — Phụ trách: Claude
- [ ] P1 **Lỗi: mô hình bối cảnh bị hở nhiều chỗ** (người dùng gửi 5 ảnh, 10/10/2026; sửa trong script Blender → cần máy có
  Blender) — Phụ trách: —
  - Các chỗ trong ảnh (vị trí đoán theo ảnh — đứng đúng chỗ, mở `?debug` ghi lại toạ độ khi sửa):
    1. zone_04 tầng trên (sàn xanh nhạt): khối tường bao (quanh giếng cầu thang / giếng trời) **hở ở cả 4 góc** — các đoạn
       tường không khớp nhau ở góc.
    2. zone_04 chiếu nghỉ cầu thang: khe tối dọc mép chiếu nghỉ sát tường, nhìn xuyên xuống dưới.
    3. zone_04 tầng trệt (sàn gạch sáng, chậu cây trên tủ trắng cạnh cửa kính): chân tường xám không chạm sàn, lộ dải trời
       xanh giữa sàn và tường.
    4. zone_04 cầu thang lên tầng trên: khe hở dọc mép trái bậc thang với tường, nhìn xuyên xuống dưới.
    5. zone_03 sảnh lễ tân (chỗ chị Nga): nhìn qua vách kính thấy mảng sân / mái màu nâu lơ lửng, bên dưới là trời — mặt đất
       ngoài sảnh không kéo tới chân kính.
  - Nguyên nhân chỗ 1 (đọc code): `kit.seg_box` (`scripts/blender/lib/kit.py`) dựng đoạn tường dài đúng bằng khoảng cách 2
    đầu mút, không cộng bề dày → 2 đoạn gặp nhau ở góc thiếu một ô vuông (nửa bề dày × nửa bề dày) ở góc ngoài. Các chỗ
    còn lại: sàn / bậc thang / chiếu nghỉ không áp sát tường, mặt đất ngoài nhà không đủ rộng; nhìn rõ vì trời trong nhà là
    màu xanh sáng (`mood.sky` mặc định `#9cc4e8`).
  - [ ] Sửa trong script Blender (`scripts/blender/zone_03.py`, `zone_04.py`, `lib/kit.py`, `lib/interior.py`): đoạn tường kéo
    dài thêm nửa bề dày ở mỗi đầu (tham số mới của `seg_box`, mặc định giữ như cũ để không xê dịch zone khác) hoặc thêm cột
    góc; sàn chạy dưới chân tường; bậc thang / chiếu nghỉ áp sát tường (hoặc thêm tấm ốp chân tường); mặt đất ngoài sảnh
    zone_03 kéo ra đủ xa. Build lại zone bản Thấp, `check_glb` 0 lỗi; `COL_` giữ nguyên chỗ cũ
  - [ ] Rà các zone còn lại tìm chỗ hở tương tự bằng công cụ tự dò (chạy trong game / viewer, không cần Blender): từ các điểm
    đi được bắn tia ngang và chéo xuống, tia trong nhà mà không chạm lưới nào (lọt ra trời) → ghi toạ độ → danh sách chỗ hở
  - [ ] Tạm thời (không cần Blender): zone trong nhà 3–5 đặt màu nền tối trung tính (`data/zones.json` → `mood.sky`) để khe
    hở không lộ dải xanh — chỉ che bớt, không thay việc sửa mô hình
  - [ ] Kiểm thử: công cụ dò → 0 chỗ hở trong nhà; smoke zone 3–5 (cả bước camera không xuyên trần); ảnh trước / sau 5 chỗ
- [ ] P1 Chơi trọn 1 lượt từ đầu tới màn tổng kết trên máy thật có card NVIDIA, với cả 3 nhân vật — Phụ trách: —
- [ ] P1 Mở game trên mạng công ty: góc màn hình hiện "N online" (mạng không chặn máy chủ) — Phụ trách: —
- [ ] P1 Hai người mở game cùng lúc: thấy nhau, vẫy tay, câu chat soạn sẵn — Phụ trách: —
- [ ] P1 Gửi `docs/hr_content_request.md` cho HR (20 mục [DRAFT]; file đã cập nhật đủ 20 mục theo game hiện tại, gửi thẳng
  được — nhánh `content/playtest-dialogue`) — Phụ trách: —
- [ ] P1 Chuẩn bị buổi chơi thử: 3–5 người chưa từng thấy game, ít nhất 1 laptop Intel UHD/Iris Xe, phiếu ghi nhận (đã có:
  `docs/playtest_form.md` — theo dõi từng zone, mini-game, hiệu năng, phỏng vấn sau khi chơi, cách gộp thành Issues) — Phụ trách: —

## 2. Buổi chơi thử với người thật

- [ ] P1 Tổ chức buổi chơi thử: ngồi xem, không nhắc; ghi chỗ dừng quá 10 giây, chỗ hỏi "giờ làm gì?", thời gian mỗi zone,
  tổng thời gian — Phụ trách: —
- [ ] P1 Đo hiệu năng trên laptop Intel: mở `?debug`, gõ `__game.benchmark(120)` ở từng zone; xem nấc Detail tự hạ
  (`__game.state.detailLevel`) — Phụ trách: —
- [ ] P1 Thử 2–3 người chơi cùng lúc trên bản thật, đo FPS khi bật / tắt "Show other players" — Phụ trách: —
- [ ] P2 Tổng hợp phản hồi thành danh sách việc sửa (GitHub Issues), xếp ưu tiên — Phụ trách: —

## 3. Nội dung

- [ ] P2 Nhận trả lời của HR, thay 20 mục [DRAFT] (danh sách trong `docs/PROGRESS.md` → "Nội dung [DRAFT] chờ HR") — Phụ trách: —
- [ ] P2 Hỏi mentor: tượng Cuder cầm "pickaxe" (cuốc chim) hay "hoe" (cuốc làm ruộng) — Phụ trách: —
- [ ] P2 Hỏi mentor / HR tên tiếng Anh chính thức của 6 giá trị (Tôn Đổi Đồng Chí Gương Sáng) — Phụ trách: —
- [ ] P2 Xin tư liệu chính thức cho Giếng Làng và Phòng Hạt Lúa (như tư liệu tượng Cuder) — Phụ trách: —
- [x] P2 Rà lại toàn bộ lời thoại tiếng Anh (chính tả, giọng văn, độ dài câu): 42 chuỗi, mọi câu thoại ≤ 30 từ (trừ câu
  chuyện tượng Cuder của mentor) — Phụ trách: Claude — nhánh `content/playtest-dialogue`, chi tiết `docs/dialogue_review.md`
- [ ] P2 Quyết các điểm trong `docs/dialogue_review.md` → "Điểm cần mentor / HR quyết": ô Respect (chữ nói nhường hành khách
  nhưng chỉ cảm ơn bác tài mới sáng ô), danh hiệu "The Explorer" trùng xu hướng La bàn nghề nghiệp, "an FSofter", tên huy
  hiệu Teamwork Spirit, Manager chưa có tên… — Phụ trách: —
- [ ] P3 Xin file logo FPT chính thức từ phòng thương hiệu, thay logo tạm trên áo (prajith, huyen, nga, 3 intern) và mũ — Phụ trách: —

## 4. Nhân vật và 3D (cần máy có Blender + file gốc)

- [ ] P2 Model riêng cho Manager, Lan, Minh, Hà, anh Khang (đang tạm dùng intern đổi màu áo): ảnh → Meshy → Mixamo → dựng — Phụ trách: —
- [x] P2 Người chơi ngồi vào ghế ở bàn làm việc zone 5 (code + data, không cần build lại zone) — Phụ trách: Claude — nhánh
  `feat/zone5-seat-cap`
- [x] P3 Máy tính bàn ở bàn intern zone 5: mô hình Sketchfab "Desktop Computer" (CC BY 4.0) thay laptop hộp; màn hình
  `monitor_screen` hiện màn đăng nhập "My FPT", game đổi texture được (`scripts/blender/lib/desktop_computer.py`) — Phụ trách:
  Thanh Do — 94b7938
- [x] P3 Thay mô hình bối cảnh bằng mô hình Sketchfab (CC BY 4.0; script `scripts/blender/lib/bus.py`, `trees.py`, `bamboo.py`) —
  Phụ trách: Claude — nhánh `feat/env-models` — 84fcbec (PR #5, `main` 9f2c335; đã deploy `gh-pages` 4b0aed0)
  - [x] Xe bus zone 0–1 ("Bus jb5 Low Poly"): sơn trắng–đỏ như xe cũ, cánh cửa tách riêng đúng chỗ TRIGGER_len_xe, biển số
    1/2/3 trên kính, dùng chung lưới mọi xe trong zone — 84fcbec
  - [x] Cây ngoài trời zone 0–3 ("Tree low poly lowpoly"): lá alphaTest không viền, dùng chung lưới, mỗi cây làm mờ riêng — 84fcbec
  - [x] Bụi tre zone 2 ("bamboo tree"): 1.960 tam giác / bụi, đuôi đảo giếng + 2 bên đường xe vào, COL_ ở gốc — 84fcbec
  - [x] Đo FPS trước / sau (`__game.benchmark(120)` zone 0–3, draw call, tam giác, dung lượng GLB): FPS giảm 5 / 5 / 9 / 5 %
    (zone 0 / 1 / 2 / 3), chi tiết `docs/PROGRESS.md` — 84fcbec
- [ ] P3 Tượng Cuder: quyết giữ / bỏ búi tóc sau gáy (`CUDER_KEEP_BUN` trong `scripts/blender/zone_02.py`); đổi bản sao tượng cũ
  nhìn qua vách kính zone 3 (`ENV_tuong_cuder_xa`) — Phụ trách: —
- [x] P3 Mũ lưỡi trai phần 2: gắn vào xương Head của 3 intern (tự ướm theo lưới, mở khoá khi xong game, bật / tắt ở menu Esc,
  người khác thấy mũ) — Phụ trách: Claude — nhánh `feat/zone5-seat-cap`; tab Wardrobe vẫn chờ mục "Tủ đồ"
- [ ] P3 Huyền, Nga: tay lún vào thân 3–6 cm ở vài động tác (tải animation Mixamo riêng nếu cần) — Phụ trách: —
- [ ] P2 **Khoảng trống ngoài vùng đi được trông trống trơn** (zone 0, 1, 2; cả chỗ nhìn ra ngoài qua kính zone 3–5) — Phụ trách: —
  - Hiện trạng: trời chỉ là một màu phẳng (`scene.background` = `mood.sky` trong `data/zones.json`; zone 0 gần như trắng
    `#dbe4ea`, mặc định `#9cc4e8`, zone 1 hoàng hôn cam `#f3b183`). Mặt cỏ zone 1 (100 × 70 m) hết ở cách người chơi 30–60 m,
    thành một đường cắt thẳng với trời (sương 45–150 m nên ở mép gần như chưa phủ). Chỗ hết đường là tường vô hình (`COL_bien_*`), người chơi bị chặn mà không
    thấy lý do.
  - Hướng đề xuất: dựng 4 lớp như dưới, không tô trời một màu (trắng hay màu khác) và không dùng ảnh nền 360° (lệch phong
    cách low-poly, nặng cho điện thoại). Lớp 1 + 2 làm được trên máy cloud (không cần Blender), làm xong là hết cảm giác
    "trống trơn"; lớp 3 + 4 cần máy có Blender.
  - [ ] Lớp 1 — bầu trời chuyển màu (code): vòm trời bằng shader 2–3 màu (đỉnh → chân trời, quầng sáng phía mặt trời), vài
    cụm mây low-poly trôi chậm. Màu theo `mood` của từng zone / variant (thêm `sky_top`, `sky_horizon`: sáng sớm, trưa, chiều,
    hoàng hôn). Sương lấy đúng màu chân trời để mặt đất tan dần vào trời, không còn đường cắt.
  - [ ] Lớp 2 — phông nền xa (code + data; muốn vẽ tay thì dựng bằng Blender): vòng bóng núi Ba Vì (phía tây Hòa Lạc — xác
    nhận hướng theo thực tế), hàng cây, dãy nhà khu Công nghệ cao / campus F-Ville ở 150–400 m; 2–3 lớp nhạt dần theo khoảng
    cách. Một lưới dùng chung cho các zone ngoài trời: màu theo đỉnh, không chiếu sáng, ≤ 5.000 tam giác, 1–2 lệnh vẽ. Cũng
    hiện qua cửa kính zone 3–5.
  - [ ] Lớp 3 — vùng đệm giữa chỗ đi được và phông nền (Blender, `scripts/blender/zone_00.py` … `zone_02.py`): kéo mặt đất ra
    ~200 m (sương phủ hết mép); rải ruộng lúa, bụi cây, cụm cây, cột điện (instancing); khu phố zone 0 thêm dãy nhà / mặt
    tiền đơn giản.
  - [ ] Lớp 4 — ranh giới nhìn thấy được thay tường vô hình (Blender): hàng rào thấp, bồn hoa, hàng bụi, mương nước, lan can,
    rào chắn đặt đúng chỗ `COL_bien_*`, để người chơi hiểu vì sao không đi tiếp được.
  - [ ] Camera không lùi / chúc xuống tới chỗ thấy mép mặt đất hoặc dưới chân phông nền. Điện thoại và nấc Detail thấp thì tắt
    mây, bớt lớp phông nền.
  - [ ] Kiểm thử:
    - `test:data`: mọi zone ngoài trời có đủ màu trời và phông nền.
    - Smoke: đứng ở mọi `SPAWN_` zone 0–2, quay 8 hướng, nửa trên khung hình không còn mảng trời một màu (đo độ lệch màu).
    - Đo FPS trước / sau trên laptop Intel (`__game.benchmark(120)`), ghi vào `docs/perf_report.md`.
  - [ ] Build lại zone 0–2 bản Thấp (máy có Blender), push `main`, deploy `gh-pages`

## 5. Tính năng

- [ ] P2 Bi-a bước 3 — chơi 2 người theo lượt qua máy chủ, người khác đứng xem — Phụ trách: Claude — nhánh `feat/pool-step3`
  - [x] Máy chủ (`server/src/pool.js`): mỗi bàn giữ 2 ghế, lượt chơi, vị trí bi, bi đã vào lỗ, số thứ tự cú, nhóm trơn/sọc; tin
    nhắn `pool_join`, `pool_leave`, `pool_shot`, `pool_rerack`, `pool_poke` / `pool` (bàn), `pool_shot` (cú + bàn); chỉ người
    tới lượt được đánh; giải phóng ghế khi rời bàn, sang zone khác, mất kết nối hoặc 60 s không đánh; tin chào báo
    `features: ["pool"]`; bàn qua được lúc Durable Object ngủ
  - [x] Game: người đánh tự tính cú bằng `physics.js` rồi gửi thông số + kết quả; người kia và người xem phát lại đúng cú đó,
    cuối cú chốt theo bàn máy chủ (= kết quả người đánh, làm tròn 0,01 mm); người vào sau nhận trạng thái bàn hiện tại
  - [x] Luật 8 bi rút gọn (`game/src/pool/rules.js`, dùng chung với máy chủ) + giao diện 2 ghế (tên, nhóm, số bi còn lại),
    "Your turn", đồng hồ lượt, bi trong tay (W/A/S/D), thắng/thua, R: ván mới, J: ngồi khi có ghế trống
  - [x] Máy chủ bản cũ (chưa có `features: ["pool"]`) → bàn chỉ cho tập một mình
  - [x] Kiểm thử: `test:pool` (luật, bàn máy chủ, một ván trọn giữa 2 người chơi giả) + `test:smoke` (2 trình duyệt headless
    + máy chủ local chơi trọn một ván; vị trí bi khớp sau mỗi cú; chặn cú sai lượt; bi trong tay; ghế giải phóng khi rớt mạng;
    người xem vào giữa ván thấy đúng bàn; máy chủ cũ)
  - [x] Build, push `main` (PR #1, `main` 56537a3); [x] deploy `gh-pages` (0790018); [x] ghi bước bật máy chủ vào `docs/multiplayer.md`
- [x] P2 Bi-a bước 3 — bật trên máy chủ thật: máy Desktop `git pull` rồi trong `server/` chạy `npx wrangler deploy`, kiểm tra
  `/status` (sau khi bản Web xong việc trên) — Phụ trách: Claude (máy Desktop) — 10/10/2026, Cloudflare version 3764cab6:
  tin chào `features: ["pool"]`; 2 trình duyệt độc lập trên trang thật (`gh-pages` a9a3dcc) ngồi 2 ghế zone_05, 4 cú → bàn 2
  bên = bàn máy chủ sau mọi cú, phát lại không lệch, rời bàn thì ghế trống
- [ ] P2 Bi-a bước 3 — chơi thử một ván 2 người trên trang thật, góp ý cảm giác chơi (lực đánh, tốc độ bi, độ nảy băng) — Phụ trách: —
- [ ] P3 Bi-a: chốt có thêm phím V nhìn bàn từ trên xuống hay không — Phụ trách: —
- [ ] P2 Bi-a: đánh xoáy ngang (side spin / "xoáy trái – phải") — Phụ trách: —
  - Hiện trạng: `game/src/pool/physics.js` chỉ có vị trí + vận tốc mỗi bi (đầu file: "Chưa có xoáy"); bi trắng luôn đánh vào
    giữa tâm.
  - [ ] Chọn điểm chạm trên bi trắng: lệch trái / phải (đề xuất 5 nấc: −2 … +2; xoáy lên / xuống — follow / draw — chốt làm
    cùng hay để sau). Bảng bi-a có hình bi trắng với chấm điểm chạm (bấm / kéo chấm, hoặc phím riêng — đề xuất Z / X, không
    trùng A / D ngắm, E, R, J, Space); điện thoại: kéo chấm bằng ngón tay
  - [ ] Vật lý (mỗi bi thêm 1 số `spin`): chạm băng → góc bật lệch theo chiều xoáy (xoáy thuận tay "running" mở góc, ngược
    "check" khép góc), mỗi lần chạm băng xoáy giảm; bi trắng lệch nhẹ ngược phía xoáy lúc vừa đánh (squirt, ~1°); va bi →
    truyền một phần xoáy, bi mục tiêu lệch hướng rất nhẹ (throw); xoáy giảm dần theo thời gian lăn trên nỉ
  - [ ] Giữ **tất định**: chỉ + − × ÷, `Math.sqrt`, `dsin` / `dcos` / `datan2` (quy tắc bi-a trong `CLAUDE.md`); `spin = 0`
    phải cho kết quả **giống từng bit** như hiện nay (ván cũ, phát lại, thử thách của anh Khang không đổi)
  - [ ] Chơi nhiều người: tin nhắn cú đánh thêm `spin`; máy chủ (`server/src/pool.js`) kiểm tra giới hạn và tính lại cú như
    máy khách; báo `features` mới (vd `"pool_spin"`) — máy khách / máy chủ bản cũ thì bàn chung không cho đánh xoáy, không
    lệch bàn; cần `npx wrangler deploy` ở máy Desktop
  - [ ] Đường ngắm: thêm đoạn bi trắng sau khi chạm băng / chạm bi có tính xoáy (ngắn, để gợi ý chứ không lộ hết); thử thách
    của anh Khang giữ đánh tâm (hoặc chỉ cho xoáy sau khi vào bi lần đầu)
  - [ ] Chữ giao diện en + vi; dòng hướng dẫn bảng bi-a ghi cách chọn xoáy
  - [ ] Kiểm thử: `test:pool` — 1.000 cú phá với xoáy ngẫu nhiên không NaN / chồng bi / ra ngoài bàn, chạy lại giống từng bit,
    `spin = 0` khớp bản cũ, xoáy trái / phải làm góc bật băng lệch đúng chiều; smoke bi-a 2 người: cú có xoáy phát lại khớp
    bàn máy chủ
- [ ] P2 Bi-a: luật chuẩn bi-a 8 bi "sọc trơn" cho bàn chung 2 người (thay luật rút gọn hiện nay) — Phụ trách: —
  - Hiện trạng (`game/src/pool/rules.js`, dùng chung với máy chủ): nhóm trơn 1–7 / sọc 9–15 nhận theo bi vào lỗ đầu tiên;
    lỗi duy nhất là bi trắng rơi lỗ → đối thủ đặt bi trắng ở khu đầu bàn; không phạt chạm sai bi trước / không chạm bi nào;
    bi 8 không phải gọi lỗ.
  - [ ] Chốt bộ luật theo luật 8 bi quốc tế (WPA), viết tóm tắt vào `docs/GDD.md` (mục bi-a), gồm các ý dưới
  - [ ] Cú phá hợp lệ: có bi vào lỗ hoặc ít nhất 4 bi chạm băng — không thì đối thủ chọn xếp lại phá hoặc đánh tiếp; bi trắng
    rơi lúc phá → đối thủ đặt bi trắng ở khu đầu bàn; bi 8 vào lỗ lúc phá → đặt lại bi 8 (như hiện nay) hoặc xếp lại
  - [ ] Bàn vẫn "mở" sau cú phá (bi vào lỗ lúc phá không quyết định nhóm); nhóm chọn ở cú vào bi hợp lệ đầu tiên sau đó
  - [ ] Lỗi (foul) → đổi lượt, đối thủ có **bi trong tay đặt bất kỳ đâu trên bàn** (trừ sau cú phá chỉ ở khu đầu bàn):
    bi trắng rơi lỗ / văng khỏi bàn; bi trắng chạm bi nhóm khác trước (bàn mở: chạm bi 8 trước); không chạm bi nào; sau khi
    chạm không có bi nào vào lỗ và không bi nào (kể cả bi trắng) chạm băng
  - [ ] Bi 8: phải **gọi lỗ** trước cú đánh bi 8 (bấm vào lỗ trên bàn); thua khi đưa bi 8 vào lỗ sớm (nhóm chưa hết), vào lỗ
    khác lỗ đã gọi, vào lỗ kèm lỗi, hoặc làm bi 8 văng khỏi bàn
  - [ ] Giao diện: HUD ghi nhóm của mỗi người (trơn / sọc) + số bi còn lại; báo lỗi kèm lý do ("Chạm bi 3 trước — lỗi"); đặt bi
    trong tay trên cả bàn (không chồng bi khác); chọn lỗ cho bi 8; bấm H xem tóm tắt luật; chữ en + vi
  - [ ] Bàn chung: thêm giới hạn thời gian mỗi cú (vd 60 s, hết giờ = lỗi) để không ai giữ bàn mãi
  - [ ] Máy chủ (`server/src/pool.js`) áp đúng bộ luật mới (kiểm tra chỗ đặt bi trong tay, lỗ đã gọi); báo `features` mới (vd
    `"pool_rules2"`) — máy khách cũ không vào được bàn luật mới, không lệch bàn; `npx wrangler deploy` ở máy Desktop
  - [ ] Tập một mình và thử thách của anh Khang giữ như cũ (không áp luật thi đấu)
  - [ ] Kiểm thử: `scripts/tests/pool_rules.mjs` thêm từng trường hợp — cú phá không hợp lệ, bàn mở sau phá, từng loại lỗi, bi
    trong tay toàn bàn, gọi lỗ bi 8 đúng / sai, bi 8 vào sớm / kèm lỗi; ván 2 người giả chơi trọn; smoke bi-a 2 người với luật
    mới
- [ ] P2 Bi-a: ngắm cơ bằng chuột, không chỉ phím A / D — Phụ trách: —
  - Hiện trạng: chuột chỉ xoay cơ khi con trỏ đang bị khoá (Pointer Lock, `game/src/core/input.js`: không khoá thì bỏ qua di
    chuột và kéo chuột). Khoá không được (vừa bấm Esc, trình duyệt từ chối) thì chuột không làm gì; bấm chuột để khoá lại thì
    cú bấm đó cũng bắt đầu lấy lực (`mouseButton` trong `game/src/pool/table.js`).
  - [ ] Không khoá con trỏ: cơ chỉ theo con trỏ — chiếu con trỏ xuống mặt bàn, cơ hướng từ bi trắng tới điểm đó; giữ chuột
    trái để lấy lực, thả để đánh (hoặc kéo lùi chuột để chỉnh lực)
  - [ ] Đang khoá con trỏ: di chuột ngang xoay cơ như hiện nay; giữ Shift để ngắm tinh (chậm lại); A / D vẫn dùng được
  - [ ] Cú bấm đầu tiên chỉ để khoá con trỏ / lấy lại chuột, không bắt đầu lấy lực
  - [ ] Dùng cho cả tập một mình, bàn chung 2 người, thử thách của anh Khang; dòng hướng dẫn trên bảng bi-a ghi cách ngắm bằng
    chuột (`data/i18n/en.json` + `vi.json`); trên điện thoại: kéo ngón tay để ngắm (xem mục "Chơi trên trình duyệt điện thoại")
  - [ ] Kiểm thử: smoke bi-a ngắm bằng chuột ở cả 2 chế độ (khoá / không khoá) → góc cơ đổi đúng hướng, bấm lần đầu không đánh
- [ ] P2 Tủ đồ: chốt danh sách món → texture áo / phụ kiện (Blender) → tab Wardrobe + mở khóa trong game — Phụ trách: —
- [x] P3 Tab Bản đồ trong app My FPT — Phụ trách: Claude — nhánh `feat/map-tab` (PR #7, `main` 1a79739; đã deploy `gh-pages` a9a3dcc). Ảnh zone chụp từ trên xuống
  (cắt bỏ trần / mái ở sàn + 2,4 m, nét tường tối), mũi tên "Bạn" theo hướng mặt, chấm Tú, dấu "!" + dòng mục tiêu (khác tầng:
  "(tầng trên / dưới)"); zone_04 mỗi tầng một ảnh; smoke mở tab ở zone 2–5
- [x] P3 Chơi nhiều người: tự chia phòng khoảng 30 người khi đông (`room_size` 30, tối đa 6 phòng; cần `wrangler deploy`) —
  Phụ trách: Claude — nhánh `feat/pool-step3`; [x] đã `wrangler deploy` (10/10/2026, version 3764cab6): `/status` có
  `room_size` 30, `max_rooms` 6, danh sách `rooms`
- [ ] P2 Nhắn tin giữa người chơi: cùng zone, tất cả mọi người, nhắn riêng — Phụ trách: —
  - [ ] Chốt với nhóm / HR: cho gõ chữ tự do hay chỉ mở rộng câu soạn sẵn (hiện có câu chat soạn sẵn ở phím T); quy tắc ứng xử
    hiện khi mở khung chat lần đầu
  - [ ] Máy chủ (`server/`): tin nhắn `chat` với kênh `zone` (người cùng zone), `all` (mọi người đang online), `dm` (một người,
    theo id phiên); giới hạn độ dài (~120 ký tự), chống spam (vd 1 tin / giây, tối đa 5 tin dồn), lọc từ ngữ thô tục cơ bản;
    không lưu lịch sử trên máy chủ; tin chào báo `features: ["chat"]` — máy chủ bản cũ thì chỉ có câu soạn sẵn
  - [ ] Game: khung chat (Enter mở / gửi, Esc đóng; đang gõ không điều khiển nhân vật), 3 tab Zone / All / Private kèm số tin
    chưa đọc; tin cùng zone hiện thêm bong bóng trên đầu người gửi; nhắn riêng bằng cách bấm vào bảng tên người chơi hoặc
    chọn trong danh sách người online; giữ ~50 tin gần nhất mỗi kênh trong lượt chơi (không vào bản lưu)
  - [ ] An toàn: tắt nhận tin từ một người (mute), tắt hẳn chat trong menu Esc; "Show other players" tắt thì ẩn cả bong bóng chat;
    tên người chơi trong tin là tên tự đặt, không hiện thông tin khác
  - [ ] Chữ giao diện trong `data/i18n/en.json`; tính lại số lượt Cloudflare (mỗi tin = 1 tin nhắn WebSocket) với hạn miễn phí
    100.000 lượt / ngày, ghi vào `docs/multiplayer.md`
  - [ ] Kiểm thử: 3 trình duyệt headless + máy chủ local — tin zone chỉ tới người cùng zone, tin all tới mọi người, tin dm chỉ
    tới đúng người; chặn tin quá dài / gửi quá nhanh; máy chủ bản cũ không có chat thì không lỗi; thêm vào `test:smoke`
  - [ ] Build, push `main`, deploy `gh-pages`; bật trên máy chủ thật (`npx wrangler deploy` ở máy Desktop)
- [ ] P2 Chơi trên trình duyệt điện thoại: tối ưu cho điện thoại + nút điều hướng và tương tác trên màn hình — Phụ trách: —
  - [ ] Nhận biết máy cảm ứng bằng `matchMedia("(pointer: coarse)")` / `navigator.maxTouchPoints` (không dựa vào user agent);
    khi dev thử bằng `?touch=1` hoặc chế độ giả lập điện thoại của Chrome DevTools. Sửa GDD → "Ngoài phạm vi" (đang ghi
    "điều khiển cảm ứng trên điện thoại")
  - [ ] Điều hướng: cần điều khiển ảo (joystick) góc trái dưới để đi (đẩy hết cỡ = chạy); vuốt nửa phải màn hình để xoay
    camera (đã kéo được bằng ngón tay — chỉnh độ nhạy); chụm 2 ngón để kéo camera xa / gần (thay con lăn chuột)
  - [ ] Nút tương tác góc phải dưới: nút lớn thay phím E, ghi tên việc như dòng nhắc "E: …", chỉ hiện khi đứng gần vật / người;
    nút App (Tab), Help (H), Emote / câu chat (T), Menu (Esc); hội thoại: chạm để nói tiếp, chạm vào lựa chọn (không cần
    phím 1–4)
  - [ ] Mini-game và bi-a bằng cảm ứng: kéo để ngắm, giữ nút để lấy lực, nút Rerack / Leave / Join; rà từng mini-game xem có
    chỗ nào cần bàn phím (ô mật khẩu Đăng nhập: bàn phím ảo không được che ô nhập)
  - [ ] Giao diện: nút ≥ 44 px, không đè lên nhau hay che nhân vật; dòng hướng dẫn điều khiển đổi theo cảm ứng (không ghi
    "WASD", "E"); cầm dọc thì nhắc xoay ngang; chừa vùng tai thỏ / thanh điều hướng (`env(safe-area-inset-*)`); chặn phóng
    to trang, kéo xuống làm mới, menu khi giữ ngón
  - [ ] Hiệu năng: điện thoại mặc định nấc Detail thấp (pixelRatio ≤ 1, tắt viền nét), bóng / số người chơi khác hiện tối đa
    ít hơn nếu cần; giải phóng zone cũ đủ sạch (Safari iOS đóng tab khi tốn quá nhiều RAM); đo FPS + RAM trên 1 máy Android
    tầm trung và 1 iPhone, ghi vào `docs/perf_report.md`
  - [ ] Nút toàn màn hình (Android; iOS Safari không có — hướng dẫn "Thêm vào màn hình chính"); âm thanh chỉ phát sau lần
    chạm đầu; ảnh thẻ PNG tải được trên điện thoại (iOS: mở ảnh để lưu)
  - [ ] Chữ giao diện mới trong `data/i18n/en.json` + `vi.json`
  - [ ] Kiểm thử: `test:smoke` thêm lượt giả lập điện thoại (Playwright `hasTouch` + `isMobile`, khung ngang ~844 × 390): đi
    bằng joystick ảo, bấm nút tương tác, chơi qua ít nhất 1 zone, console sạch; chơi thử tay trên máy thật (Android Chrome,
    iPhone Safari)
  - [ ] Build, push `main`, deploy `gh-pages`

## 6. Ngôn ngữ và âm thanh

- [ ] P2 Chức năng ngôn ngữ Anh / Việt — Phụ trách: Claude — nhánh `feat/vietnamese` (PR #3, đã deploy `gh-pages` 6416ec3);
  còn: người trong team đọc lại
  - [x] Chốt (người dùng, 10/10/2026): thêm tiếng Việt, sửa quy tắc trong `CLAUDE.md`; tên riêng giữ dấu ở cả hai bản; xưng hô
    Tú "mình – cậu", người lớn "chị / anh – em" (tài xế: "anh – em", GDD viết "bác tài"), giao diện gọi "bạn"; giữ từ công sở
    intern, mentor, team, app, check-in; mặc định theo ngôn ngữ trình duyệt — chi tiết `docs/vi_style.md`
  - [x] `data/i18n/vi.json` (233 chữ giao diện) + trường `"vi"` cạnh `"en"` trong data (685 chỗ); tên vai `names.vi`, tên gọi
    trong câu `names_ref.vi` ("chị Lan"); tên danh hiệu lấy theo GDD (Gương Sáng Làng F…); thiếu bản Việt thì hiện bản Anh
  - [x] Nút chọn ngôn ngữ ở màn tạo nhân vật và menu Esc, lưu trong cài đặt; mặc định theo ngôn ngữ trình duyệt; đổi giữa
    chừng không mất tiến trình, không tải lại trang
  - [x] Chữ vẽ bằng canvas (ảnh thẻ PNG, bảng tên trên bàn) theo ngôn ngữ, ngày "10 tháng 10, 2026"; font Nunito có đủ dấu
  - [x] Kiểm thử: `test:data` báo thiếu `vi`, khóa lệch giữa `en.json` / `vi.json`, biến `{…}` lệch, chữ vi giống hệt en, dấu
    thanh kiểu mới (hoà / khoá); `test:smoke` ngoại hình thứ 2 chơi trọn bằng tiếng Việt + đổi ngôn ngữ ở menu Esc (CI có luôn)
  - [ ] Người Việt rà lại bản dịch (giọng văn trẻ, thân thiện; đúng thuật ngữ FPT: FSofter, FSA, …) — đã có 1 lượt soát
    (3 agent đọc độc lập lời thoại / mini-game / giao diện, ~110 câu đã sửa); cần người trong team chơi thử bản tiếng Việt
- [ ] P3 Lồng tiếng nhân vật — Phụ trách: —
  - [ ] Chốt phạm vi: chỉ câu quan trọng hay cả 143 câu thoại (lời dẫn 29, Tú 27, Ms. Huyền 20, Ms. Nga 10, Manager 10, …);
    tiếng Anh, tiếng Việt hay cả hai
  - [ ] Người thật (Ms. Huyền, Ms. Nga, Prajith): tự thu âm hoặc dùng giọng khác — không dùng AI bắt chước giọng người thật khi
    chưa có đồng ý bằng văn bản
  - [ ] Nhân vật hư cấu: thu âm, hoặc giọng tổng hợp (TTS) có giấy phép dùng; ghi nguồn vào `CREDITS.md`
  - [ ] File `assets/voice/<ngôn ngữ>/<hội thoại>_<câu>.ogg` (OGG/Opus, mỗi câu khoảng ≤ 50 KB), tải theo zone; phát khi câu
    hiện, dừng khi sang câu; phụ đề giữ nguyên; thiếu file thì im lặng
  - [ ] Âm lượng giọng trong menu Esc; `test:data` báo câu thiếu file / file thừa
- [ ] P2 Nhạc nền và hiệu ứng âm thanh — Phụ trách: Claude (hiệu ứng + tiếng nền, nhánh `feat/sfx`); nhạc nền: —
  - [x] Chốt (người dùng, 10/10/2026): nguồn CC0 (gói Kenney) + tự tạo bằng code; đợt này làm hiệu ứng, bi-a / cửa / xe bus,
    bước chân + tiếng nền; nhạc nền để đợt sau
  - [x] Hiệu ứng: 58 file MP3, 286 KB (48 từ 5 gói Kenney CC0, 10 tự tạo bằng `scripts/blender/audio/synth.py`) —
    `data/sounds.json`; mọi chỗ gọi sẵn + hội thoại (sang câu, chọn đáp án, câu kiểu tin nhắn), app My FPT, menu Esc, quest /
    checklist / giá trị / phần thưởng / thẻ Act / thành tựu; cửa quẹt thẻ (bíp xanh / đỏ — trường `sfx` của câu thoại, khoá
    nhả, cánh cửa); xe bus (cửa hơi nén, phanh, tiếng máy theo tốc độ xe); bi-a (đầu cơ, bi chạm bi / băng / vào lỗ theo lực
    va, cả khi phát lại cú của người khác); bước chân người chơi + Tú (cỏ / nền cứng / thảm)
  - [x] Danh sách file + nguồn + bằng chứng giấy phép: `docs/audio_credits.md` (tự sinh: gói, link tải, SHA-256 zip và từng
    file gốc, `License.txt` của từng gói chép vào `assets/sfx/licenses/`)
  - [x] Tiếng nền theo zone tạo bằng code lúc chơi (phố sáng sớm, campus, hoàng hôn ở bến xe, sảnh, hành lang, văn phòng) +
    tiếng vang trong nhà — `game/src/core/ambience.js`, `zones.json` → `audio`
  - [x] Phát sau lần bấm / phím đầu tiên; đổi zone tiếng nền chuyển êm; nhỏ lại khi hội thoại / mini-game / app; menu Esc: Âm
    thanh Bật / Tắt + thanh Hiệu ứng, Tiếng nền, lưu trong cài đặt; tab ẩn thì tạm dừng; tiếng của zone tải khi vào zone
  - [x] Kiểm thử: `test:data` (file thiếu / thừa, chỉ nhận gói CC0, mọi file có trong `audio_credits.md`, tên trong
    `sound.play("…")` / `sfx` / `zones.json` có thật, dung lượng); `test:smoke` (AudioContext chạy, file tải được, tiếng nền đúng
    zone, đi bộ có tiếng bước chân, các tiếng chính đã phát qua zone 0 → 4, console sạch)
  - [ ] Người trong team nghe thử, chỉnh âm lượng / đổi file nghe chưa hợp (chọn file theo số đo, chưa ai nghe bằng tai)
  - [ ] Nhạc nền theo zone / thời điểm (sáng sớm ở điểm đón, nhộn nhịp ở campus, nhẹ ở văn phòng, ấm ở cảnh kết lúc hoàng hôn)
    — nguồn CC0, khai ở `data/sounds.json` như hiệu ứng; chuyển bài êm khi đổi zone, nhỏ lại khi hội thoại, thanh âm lượng nhạc
    (và giọng) trong menu Esc; mỗi bài ≤ ~1,5 MB (MP3 ~128 kbps — Safari cũ không đọc OGG), tải lười theo zone, đo lại theo
    `docs/perf_report.md`

## 7. Kỹ thuật và vận hành

- [ ] P1 Thêm thành viên mới làm collaborator trên GitHub (Settings → Collaborators) — Phụ trách: —
- [x] P1 GitHub Actions chạy kiểm thử cả cho Pull Request (`pull_request` vào `main`) — Phụ trách: Claude — nhánh `ci/pr-tests`
- [x] P1 **Lỗi: GitHub Actions không chạy kiểm thử nào từ c2439ba** (PR #1, #2 và 2 lần gộp vào `main` đều báo đỏ, 0 job):
  tên một bước trong `.github/workflows/test.yml` có `: ` ("test mạng: zone 4 …") → YAML không đọc được. Sửa: đặt tên bước
  trong ngoặc kép. Sửa file workflow thì kiểm tra trước: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml'))"`
  — Phụ trách: Claude
- [x] P1 **Lỗi: CI hỏng bước ảnh thẻ ở màn tổng kết** (ngoại hình thứ 2, sau cảnh kết: "Preparing your card…" mãi) — trên
  Chromium headless shell `canvas.toBlob` chờ GPU 52 s. Sửa: canvas ảnh thẻ trên CPU (`willReadFrequently`,
  `game/src/ui/summary.js`). Thêm (nhánh `fix/pool-float-card`, đo trên CI 3 lượt:
  phông, ảnh, vẽ xong trong 0,1 s rồi kẹt; hẹn giờ 6 s đặt trước đó không chạy → luồng chính bị chặn ngay trong `toBlob`):
  `toDataURL` thay `toBlob` (0,1 s; `toBlob` 1–2 s cả trên máy thật vì chờ lúc luồng chính rảnh), phông / ảnh có hạn giờ, smoke
  in thời gian từng khâu, hỏng thì thử hẹn giờ / khung hình của trang. Cùng lúc: chạy tay workflow (Run workflow) giờ đủ 3
  ngoại hình — biểu thức `== 'workflow_dispatch' && '' || '--look …'` luôn ra vế sau vì chuỗi rỗng bị coi là sai — Phụ trách:
  Claude
- [x] P2 Cập nhật `docs/PROGRESS.md` → "Việc tiếp theo": mục 0 (đưa máy chủ lên Cloudflare) đã xong — Phụ trách: Claude — nhánh `ci/pr-tests`
- [ ] P3 `test:smoke`: trước mỗi mục tiêu bắt buộc zone 0–5 kiểm tra có dấu "!" hoặc mũi tên (`__game.guide` → `marker` /
  `arrow`), để lỗi mất dấu không quay lại mà không ai biết — Phụ trách: —
- [ ] P3 Theo dõi Cloudflare: Workers & Pages → fville-net → Metrics (hạn miễn phí 100.000 lượt/ngày) — Phụ trách: —
- [x] P3 zone 4: lan can thật ở mép chiếu nghỉ, COL_ vách trên cửa quẹt thẻ, dời `SPAWN_zone_04_from_zone_03` vào trong (sửa
  trong `scripts/blender/zone_04.py`, build lại GLB bản Thấp, bỏ bản vá dữ liệu) — Phụ trách: Claude — nhánh `zone04/rebuild`
- [ ] P3 zone 3: tách cụm cây ngoài sân bị gộp làm một khi làm mờ (`seeThrough`) — Phụ trách: —

## Đã xong (tóm tắt)

- [x] 6 zone chơi trọn: điểm đón → xe bus → cổng F-Ville → sảnh → cửa quẹt thẻ / phòng FSA → văn phòng, cảnh kết, màn tổng kết
- [x] 4 Act theo góp ý mentor, thành tựu "Welcome to the F-Ville Family", tải ảnh thẻ PNG
- [x] Nhân vật người thật: Prajith, Ms. Huyền, Ms. Nga (đã đồng ý dùng hình)
- [x] Màn chọn nhân vật 3D: 3 intern; Tú khác giới với người chơi, đại từ tự đổi
- [x] Áo ngày đầu → Áo Cam FPT có logo ở cổng zone 2
- [x] Tượng Cuder (Meshy) + câu chuyện, quiz từ mentor
- [x] Hướng dẫn người mới: dấu "!", mũi tên, gợi ý tăng dần, nhắc khi đứng yên, phím H
- [x] Camera hội thoại qua vai, làm mờ cây che camera
- [x] Chơi nhiều người mức "thấy nhau" (Cloudflare), emote, câu chat soạn sẵn
- [x] Bàn bi-a Sketchfab (bước 1) + chơi một mình và thử thách của anh Khang trên bàn thật (bước 2, `gh-pages` 04a74b2)
- [x] Hiệu năng: biên dịch shader trước, mở game nhanh, nấc Detail; chỉ đồ họa Thấp
- [x] Chống kẹt khi chuyển zone, sửa bản lưu cũ, chống bộ nhớ đệm cũ
- [x] Bộ kiểm thử tự động (test:data, test:pool, test:smoke) + GitHub Actions
