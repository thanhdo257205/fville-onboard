# Checklist dự án "Ngày Đầu Ở F-Ville"

Bảng việc chung của nhóm. Cập nhật lần cuối: 10/10/2026 (trang đang chạy: `gh-pages` 5b32098, build từ `main` 8347ca1).

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

- [ ] P1 **Lỗi: không ra được khỏi zone 5** (từ `gh-pages` 04a74b2). Đi ra cửa sang zone 4 → "Couldn't open Card Gate · FSA
  Room. t.map?.dispose is not a function"; bấm Back / vào lại → "Couldn't open Office." Cảnh kết (zone 5 → bến xe zone 1)
  cũng hỏng theo. Nguyên nhân: cây cơ của bàn bi-a là bản sao `cue_2` (`cueModel` trong `game/src/pool/table.js`) —
  `clone()` chép `userData` qua JSON nên `userData.srcMaterial` thành object thường, `map` là chuỗi id → `disposeZone`
  (`game/src/world/zone.js`) gọi `.dispose()` trên chuỗi khi rời zone. Sửa: xoá `srcMaterial` khỏi bản sao + `disposeZone`
  chỉ dispose texture thật; thêm vào `test:smoke` bước zone 5 → zone 4 → zone 5 (smoke hiện không đi ngược khỏi zone 5 nên
  không bắt được); build, deploy lại — Phụ trách: —
- [ ] P1 **Lỗi: camera xuyên trần nhà khi ở trong nhà** (zone 3, 4, 5 — kéo chuột lên thì camera bay lên tận nóc, thấy cả mái
  nhà từ trên xuống). Nguyên nhân: camera chỉ tránh hộp `COL_` mà các zone trong nhà không có `COL_` cho trần; góc ngẩng tối
  đa 1,15 rad × khoảng cách 4,2 m → camera cao ~5 m trên đầu người chơi (trần ~3 m). Sửa: thêm hộp trần cho zone 3–5 bằng
  `data/collision.json` (không cần Blender) hoặc cho camera tránh cả lưới hiển thị (`zone.view`, như camera hội thoại / bàn
  bi-a), kèm giới hạn độ cao camera theo zone; thêm kiểm tra vào `test:smoke` (ngẩng hết cỡ, camera vẫn dưới trần) —
  Phụ trách: —
- [ ] P1 Chơi trọn 1 lượt từ đầu tới màn tổng kết trên máy thật có card NVIDIA, với cả 3 nhân vật — Phụ trách: —
- [ ] P1 Mở game trên mạng công ty: góc màn hình hiện "N online" (mạng không chặn máy chủ) — Phụ trách: —
- [ ] P1 Hai người mở game cùng lúc: thấy nhau, vẫy tay, câu chat soạn sẵn — Phụ trách: —
- [ ] P1 Gửi `docs/hr_content_request.md` cho HR (20 mục [DRAFT]) — Phụ trách: —
- [ ] P1 Chuẩn bị buổi chơi thử: 3–5 người chưa từng thấy game, ít nhất 1 laptop Intel UHD/Iris Xe, phiếu ghi nhận — Phụ trách: —

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
- [ ] P2 Rà lại toàn bộ lời thoại tiếng Anh (chính tả, giọng văn, độ dài câu) — Phụ trách: —
- [ ] P3 Xin file logo FPT chính thức từ phòng thương hiệu, thay logo tạm trên áo (prajith, huyen, nga, 3 intern) và mũ — Phụ trách: —

## 4. Nhân vật và 3D (cần máy có Blender + file gốc)

- [ ] P2 Model riêng cho Manager, Lan, Minh, Hà, anh Khang (đang tạm dùng intern đổi màu áo): ảnh → Meshy → Mixamo → dựng — Phụ trách: —
- [ ] P2 Người chơi ngồi vào ghế ở bàn làm việc zone 5 (hiện đứng trước bàn) — Phụ trách: —
- [x] P3 Máy tính bàn ở bàn intern zone 5: mô hình Sketchfab "Desktop Computer" (CC BY 4.0) thay laptop hộp; màn hình
  `monitor_screen` hiện màn đăng nhập "My FPT", game đổi texture được (`scripts/blender/lib/desktop_computer.py`) — Phụ trách:
  Thanh Do — 94b7938
- [ ] P3 Tượng Cuder: quyết giữ / bỏ búi tóc sau gáy (`CUDER_KEEP_BUN` trong `scripts/blender/zone_02.py`); đổi bản sao tượng cũ
  nhìn qua vách kính zone 3 (`ENV_tuong_cuder_xa`) — Phụ trách: —
- [ ] P3 Mũ lưỡi trai phần 2: gắn vào xương Head của 3 intern (làm cùng tủ đồ) — Phụ trách: —
- [ ] P3 Huyền, Nga: tay lún vào thân 3–6 cm ở vài động tác (tải animation Mixamo riêng nếu cần) — Phụ trách: —

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
  - [ ] Build, push `main`, deploy `gh-pages` (build đã thử được; chờ PR được gộp); [x] ghi bước bật máy chủ vào `docs/multiplayer.md`
- [ ] P2 Bi-a bước 3 — bật trên máy chủ thật: máy Desktop `git pull` rồi trong `server/` chạy `npx wrangler deploy`, kiểm tra
  `/status` (sau khi bản Web xong việc trên) — Phụ trách: —
- [ ] P2 Bi-a bước 3 — chơi thử một ván 2 người trên trang thật, góp ý cảm giác chơi (lực đánh, tốc độ bi, độ nảy băng) — Phụ trách: —
- [ ] P3 Bi-a: chốt có thêm đánh xoáy (2D + xoáy) và phím V nhìn từ trên xuống hay không; 3D thật thì bỏ qua — Phụ trách: —
- [ ] P2 Tủ đồ: chốt danh sách món → texture áo / phụ kiện (Blender) → tab Wardrobe + mở khóa trong game — Phụ trách: —
- [ ] P3 Tab Bản đồ trong app My FPT — Phụ trách: —
- [x] P3 Chơi nhiều người: tự chia phòng khoảng 30 người khi đông (`room_size` 30, tối đa 6 phòng; cần `wrangler deploy`) —
  Phụ trách: Claude — nhánh `feat/pool-step3`
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

## 6. Ngôn ngữ và âm thanh

- [ ] P2 Chức năng ngôn ngữ Anh / Việt — Phụ trách: —
  - [ ] Chốt với nhóm: thêm tiếng Việt (sửa quy tắc "Chữ trong game là tiếng Anh" trong `CLAUDE.md`); tên riêng giữ dấu ở cả
    hai bản (Tú, Huyền, F-Ville, Hòa Lạc)
  - [ ] `data/i18n/vi.json` (186 chữ giao diện) + trường `"vi"` cạnh `"en"` trong data (684 chỗ: mini-game 256, lời thoại 179,
    hướng dẫn 101, …); thiếu bản Việt thì hiện bản Anh
  - [ ] Nút chọn ngôn ngữ ở màn tạo nhân vật và menu Esc, lưu trong cài đặt; mặc định theo ngôn ngữ trình duyệt; đổi giữa
    chừng không mất tiến trình
  - [ ] Chữ vẽ bằng canvas (ảnh thẻ PNG, bảng tên trên bàn) theo ngôn ngữ; font Nunito hiện đủ dấu tiếng Việt
  - [ ] Kiểm thử: `test:data` báo khóa thiếu / thừa giữa `en` và `vi`, biến `{…}` khớp nhau; `test:smoke` chạy thêm 1 lượt
    tiếng Việt (vd `?lang=vi`)
  - [ ] Người Việt rà lại bản dịch (giọng văn trẻ, thân thiện; đúng thuật ngữ FPT: FSofter, FSA, …)
- [ ] P3 Lồng tiếng nhân vật — Phụ trách: —
  - [ ] Chốt phạm vi: chỉ câu quan trọng hay cả 143 câu thoại (lời dẫn 29, Tú 27, Ms. Huyền 20, Ms. Nga 10, Manager 10, …);
    tiếng Anh, tiếng Việt hay cả hai
  - [ ] Người thật (Ms. Huyền, Ms. Nga, Prajith): tự thu âm hoặc dùng giọng khác — không dùng AI bắt chước giọng người thật khi
    chưa có đồng ý bằng văn bản
  - [ ] Nhân vật hư cấu: thu âm, hoặc giọng tổng hợp (TTS) có giấy phép dùng; ghi nguồn vào `CREDITS.md`
  - [ ] File `assets/voice/<ngôn ngữ>/<hội thoại>_<câu>.ogg` (OGG/Opus, mỗi câu khoảng ≤ 50 KB), tải theo zone; phát khi câu
    hiện, dừng khi sang câu; phụ đề giữ nguyên; thiếu file thì im lặng
  - [ ] Âm lượng giọng trong menu Esc; `test:data` báo câu thiếu file / file thừa
- [ ] P2 Nhạc nền và hiệu ứng âm thanh — Phụ trách: —
  - [ ] Chọn nhạc nền theo zone / thời điểm (sáng sớm ở điểm đón, nhộn nhịp ở campus, nhẹ ở văn phòng, ấm ở cảnh kết lúc
    hoàng hôn) — nguồn CC0 hoặc có giấy phép, ghi `CREDITS.md`
  - [ ] Hiệu ứng âm thanh: điền file cho các chỗ gọi sẵn trong `game/src/core/sound.js` (mini-game đúng / sai, nhặt hạt lúa,
    chụp ảnh, tin nhắn điện thoại, …) + thêm cửa quẹt thẻ, xe bus, bi-a (bi chạm bi, chạm băng, vào lỗ — `physics.js` đã
    trả các sự kiện này)
  - [ ] Phát nhạc sau lần bấm đầu tiên (trình duyệt chặn tự phát); chuyển zone thì chuyển bài êm; nhỏ lại khi đang hội
    thoại; tắt / mở và thanh âm lượng nhạc, hiệu ứng (và giọng) trong menu Esc, lưu trong cài đặt
  - [ ] Dung lượng: nhạc OGG khoảng 128 kbps, mỗi bài ≤ ~1,5 MB, tải lười theo zone (không làm chậm lúc mở game); đo lại
    theo `docs/perf_report.md`
  - [ ] Kiểm thử: `test:smoke` chạy khi tắt âm thanh, không lỗi console; `test:data` báo file âm thanh thiếu

## 7. Kỹ thuật và vận hành

- [ ] P1 Thêm thành viên mới làm collaborator trên GitHub (Settings → Collaborators) — Phụ trách: —
- [x] P1 GitHub Actions chạy kiểm thử cả cho Pull Request (`pull_request` vào `main`) — Phụ trách: Claude — nhánh `ci/pr-tests`
- [x] P2 Cập nhật `docs/PROGRESS.md` → "Việc tiếp theo": mục 0 (đưa máy chủ lên Cloudflare) đã xong — Phụ trách: Claude — nhánh `ci/pr-tests`
- [ ] P3 Theo dõi Cloudflare: Workers & Pages → fville-net → Metrics (hạn miễn phí 100.000 lượt/ngày) — Phụ trách: —
- [ ] P3 zone 4: lan can thật ở mép chiếu nghỉ, COL_ vách trên cửa quẹt thẻ, dời `SPAWN_zone_04_from_zone_03` vào trong (sửa
  trong `scripts/blender/zone_04.py`) — Phụ trách: —
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
