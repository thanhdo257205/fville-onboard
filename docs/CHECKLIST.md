# Checklist dự án "Ngày Đầu Ở F-Ville"

Bảng việc chung của nhóm. Cập nhật lần cuối: 10/10/2026 (trang đang chạy: `gh-pages` 04a74b2).

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
- [ ] P3 Tượng Cuder: quyết giữ / bỏ búi tóc sau gáy (`CUDER_KEEP_BUN` trong `scripts/blender/zone_02.py`); đổi bản sao tượng cũ
  nhìn qua vách kính zone 3 (`ENV_tuong_cuder_xa`) — Phụ trách: —
- [ ] P3 Mũ lưỡi trai phần 2: gắn vào xương Head của 3 intern (làm cùng tủ đồ) — Phụ trách: —
- [ ] P3 Huyền, Nga: tay lún vào thân 3–6 cm ở vài động tác (tải animation Mixamo riêng nếu cần) — Phụ trách: —

## 5. Tính năng

- [ ] P2 Bi-a bước 3 — chơi 2 người theo lượt qua máy chủ, người khác đứng xem (Claude Code Web) — Phụ trách: —
  - [ ] Máy chủ (`server/`): mỗi bàn giữ 2 ghế, lượt chơi, vị trí bi, bi đã vào lỗ, số thứ tự cú, nhóm trơn/sọc; tin nhắn
    `pool_join`, `pool_leave`, `pool_shot`, `pool_state`; chỉ người tới lượt được đánh; giải phóng ghế khi rời bàn, mất kết
    nối hoặc 60 s không đánh; tin chào báo `features: ["pool"]`
  - [ ] Game: người đánh tự tính cú bằng `physics.js` rồi gửi thông số + kết quả; người kia và người xem phát lại đúng cú đó,
    cuối cú chốt theo kết quả người đánh; người vào sau nhận trạng thái bàn hiện tại
  - [ ] Luật 8 bi rút gọn (nhóm trơn/sọc, đánh tiếp khi vào bi nhóm mình, bi trắng rơi lỗ → đối thủ đặt bi trắng ở khu đầu
    bàn, bi 8 cuối cùng) + giao diện tên 2 người, "Your turn", thắng/thua
  - [ ] Máy chủ bản cũ (chưa có `features: ["pool"]`) → bàn chỉ cho tập một mình
  - [ ] Kiểm thử: 2 trình duyệt headless + máy chủ local chơi một ván; vị trí bi 2 bên khớp sau mỗi cú; chặn cú sai lượt; ghế
    được giải phóng khi rớt mạng; người xem vào giữa ván thấy đúng bàn; thêm vào `test:smoke`
  - [ ] Build, push `main`, deploy `gh-pages`; ghi bước bật máy chủ vào `docs/multiplayer.md`
- [ ] P2 Bi-a bước 3 — bật trên máy chủ thật: máy Desktop `git pull` rồi trong `server/` chạy `npx wrangler deploy`, kiểm tra
  `/status` (sau khi bản Web xong việc trên) — Phụ trách: —
- [ ] P2 Bi-a bước 3 — chơi thử một ván 2 người trên trang thật, góp ý cảm giác chơi (lực đánh, tốc độ bi, độ nảy băng) — Phụ trách: —
- [ ] P3 Bi-a: chốt có thêm đánh xoáy (2D + xoáy) và phím V nhìn từ trên xuống hay không; 3D thật thì bỏ qua — Phụ trách: —
- [ ] P2 Tủ đồ: chốt danh sách món → texture áo / phụ kiện (Blender) → tab Wardrobe + mở khóa trong game — Phụ trách: —
- [ ] P3 Tab Bản đồ trong app My FPT — Phụ trách: —
- [ ] P3 Chơi nhiều người: tự chia phòng khoảng 30 người khi đông — Phụ trách: —

## 6. Kỹ thuật và vận hành

- [ ] P1 Thêm thành viên mới làm collaborator trên GitHub (Settings → Collaborators) — Phụ trách: —
- [ ] P1 GitHub Actions chạy kiểm thử cả cho Pull Request (hiện chỉ chạy khi push `main`) — Phụ trách: —
- [ ] P2 Cập nhật `docs/PROGRESS.md` → "Việc tiếp theo": mục 0 (đưa máy chủ lên Cloudflare) đã xong — Phụ trách: —
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
