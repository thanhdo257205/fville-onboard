# Văn phong bản tiếng Việt

Chuẩn chung cho mọi chữ tiếng Việt trong game (`data/i18n/vi.json`, trường `"vi"` trong `data/*.json`). Đã chốt với người
dùng 10/10/2026. Mục tiêu: đọc như người Việt viết, không như bản dịch — hội thoại là **văn nói**, giao diện và hướng dẫn là
**văn viết gọn**. Bản tiếng Anh là bản gốc về nội dung (sự kiện, con số, quy tắc), không phải về câu chữ: được đổi trật tự,
gộp / tách câu, bỏ chữ thừa miễn giữ đúng ý và đúng gợi ý cho người chơi.

## Xưng hô

| Ai nói với người chơi | Xưng | Gọi người chơi | Người chơi đáp |
| --- | --- | --- | --- |
| Tú (intern cùng lứa, khác giới) | mình | cậu | mình – cậu |
| Ms. Huyền, Ms. Nga, Manager, Lan, Hà (nữ, đồng nghiệp lớn hơn) | chị | em | em – chị, "Dạ…", "… ạ" khi lễ phép |
| Prajith (mentor), Minh, Khang, tài xế, người lạ, hành khách (nam) | anh | em | em – anh |

GDD viết tài xế là "bác tài" (bác – cháu); người dùng đã chốt "anh tài xế – em" (model tài xế là người trẻ). Đổi lại thì sửa các
câu của `tai_xe*` trong `data/dialogues.json` và bảng tên `names.vi`.
| Lời dẫn (narrator), hướng dẫn, giao diện | — | bạn (thường bỏ chủ ngữ) | — |

- Người lớn nói với cả hai intern: "các em" (vd chị Huyền đón đợt intern). Tú nói về cả hai: "mình", "tụi mình", "bọn mình".
- Lời dẫn tả việc người chơi làm: bỏ chủ ngữ hoặc "Bạn …" — "Bạn chạm thẻ vào đầu đọc." Không dùng "anh / chị" cho người chơi.
- Nhắc tới nhân vật ở ngôi thứ ba: nhân vật nói với người chơi thì gọi theo vai vế của người chơi ("chị Nga", "anh Minh" —
  kể cả anh Prajith nói về chị Lan); hướng dẫn, mục tiêu, lời nhắc nút E cũng vậy ("Chào chị Lan", "Nói chuyện với anh
  Khang"); lời dẫn kể chuyện (narrator) gọi tên trần ("Lan, Minh và Hà ngồi ngay gần đây"). Tú luôn gọi tên trần. Tú ở ngôi thứ ba: gọi tên, tránh đại từ (bản tiếng Anh dùng `{tu_his}`… vì he / she đổi theo giới tính; bản
  tiếng Việt viết "Tú đặt balo xuống ghế" — không cần biến). Biến `{tu_he}` (cậu ấy / cô ấy) vẫn có nếu thật cần.
- Tin nhắn trong app của chị Huyền / chị Nga / anh Prajith: giữ đúng xưng hô như khi nói chuyện.

## Thuật ngữ

- **Giữ nguyên** từ dân công sở FPT hay dùng: intern, mentor, team, app, check-in, laptop, email, deadline, quiz, badge
  (huy hiệu khi đứng một mình trong giao diện), 2FA, code (mã nguồn khi nói chuyện: "đọc code").
- **Tên riêng giữ nguyên**: My FPT, FSA (FPT Software Academy), F-Ville, FSofter, Cuder, FPT SOFTWARE (bảng chữ), Hòa Lạc, Hà Nội.
- **Dịch** (bảng dưới — dùng đúng một cách cho cả game):

| Tiếng Anh | Tiếng Việt |
| --- | --- |
| Bus No. 2 | xe số 2 (đầu câu: Xe số 2) |
| route sign (số trên kính lái) | biển tuyến xe |
| bus shelter | nhà chờ xe |
| City Pickup Stop / F-Ville Bus Stop (tên zone) | Điểm đón xe nội thành / Điểm dừng xe F-Ville |
| shuttle bus / company bus | xe đưa đón / xe công ty |
| bus driver | anh tài xế (bảng tên: Tài xế) |
| amber (số trên kính lái xe) | vàng cam |
| employee card / card gate | thẻ nhân viên / cửa quẹt thẻ; "tap your card" = quẹt thẻ |
| reception | quầy lễ tân / lễ tân |
| Recruitment | phòng Tuyển dụng |
| Welcome Kit | Welcome Kit (giữ tên gốc; trong câu: "bộ Welcome Kit") |
| Village Well | Giếng Làng |
| Rice Grain Room | Phòng Hạt Lúa |
| golden grain | hạt lúa vàng |
| Cuder Statue | tượng Cuder |
| FPT Orange Shirt | Áo Cam FPT |
| Advice Book | Sổ lời khuyên |
| Teamwork Spirit Badge | Huy hiệu Tinh thần Đồng đội (GDD) |
| danh hiệu ở màn tổng kết | tên gốc trong GDD: Gương Sáng Làng F, Đồng Đội Số 1, Người Kết Nối, Mọt Sách Làng F, Nhà Thám Hiểm, Intern Làng F |
| Learning Notebook | Sổ tay học tập (tên trong GDD) |
| Career Compass | La bàn nghề nghiệp |
| learning path | lộ trình học |
| checklist (ngày đầu) | checklist |
| Bag (tab app) | Túi đồ |
| objective markers | dấu chỉ đường |
| Act 1 … 4 | Chương 1 … 4 |
| Knowledge / Connection (chỉ số) | Hiểu biết / Kết nối |
| manager | chị quản lý (bảng tên: Quản lý) |
| pickaxe (tượng Cuder) | chiếc cuốc (CHECKLIST: chờ mentor chốt pickaxe / hoe — "cuốc" đúng cả hai) |
| Developer, Tester, Business Analyst, Designer | giữ nguyên ("Intern Developer") |
| desk cluster | cụm bàn |
| Information Security course | khóa học An toàn thông tin |
| due today / nice-to-have / can wait (xếp việc) | có hạn hôm nay / việc không gấp, không bắt buộc / nhãn "Chưa gấp" (khác nút thoát "Để sau") |
| oldest … newest (dòng thời gian) | mốc sớm nhất … gần đây nhất |
| pool / 8-ball / solids / stripes | bi-a / bi-a 8 bi / bi trơn / bi sọc; "ball in hand" = bi trong tay; scratch = bi trắng vào lỗ |

- 6 giá trị cốt lõi dùng tên gốc tiếng Việt: **Tôn trọng, Đổi mới, Đồng đội, Chí công, Gương mẫu, Sáng suốt** (bản tiếng
  Anh: Respect, Innovation, Teamwork, Fairness, Role Model, Wisdom). Huy hiệu 6 ô: "Tôn Đổi Đồng Chí Gương Sáng".
- Hai nút cạnh nhau không được cùng chữ: nút thoát mini-game là "Để sau" → nút bỏ qua mục tiêu riêng ở Phòng FSA là "Chưa cần",
  nhãn cuối danh sách xếp việc là "Chưa gấp".
- Phím: giữ tên phím như trên bàn phím (E, Space, Enter, Esc, Shift, Tab, W/A/S/D, ←/→); "nhấn E", "giữ Shift".
- Nút trong giao diện được nhắc trong câu hướng dẫn thì viết đúng chữ trên nút, đặt trong ngoặc kép hoặc ngoặc đơn như bản
  tiếng Anh: "(hoặc bấm Kiểm tra)" ↔ nút `minigame.check` = "Kiểm tra".

## Câu chữ

- Hội thoại ngắn như bản tiếng Anh (≤ 30 từ mỗi câu thoại), có tiểu từ cho tự nhiên ở mức vừa phải: nhé, nha, đấy, à, ha,
  mà, thôi, nè… Không câu nào chêm quá một tiểu từ. Không dùng từ lóng mạng, không teencode.
- Giao diện, mục tiêu, gợi ý: câu mệnh lệnh ngắn, không chủ ngữ ("Tìm xe số 2", "Quẹt thẻ ở cửa kính"). Tiêu đề viết hoa
  chữ đầu, còn lại thường ("Phòng Hạt Lúa" là tên riêng nên viết hoa từng chữ).
- Dấu câu như văn bản tiếng Việt: dấu ba chấm "…", gạch ngang "—" giữ như bản gốc khi tách ý; ngoặc kép "…" cho chữ trên biển,
  trên màn hình; giờ "06:45", ngày "10 tháng 10, 2026".
- **Dấu thanh kiểu cũ** (hòa, khóa, thủy, khỏe, tùy — như tên Hòa Lạc), không trộn kiểu mới (hoà, khoá, thuỷ); `test:data` báo.
- Không dịch tên hiển thị của người chơi, biến `{…}` giữ nguyên tên và số lượng (test:data kiểm tra).
- Trật tự từ theo tiếng Việt: "{position} Intern" → "Intern {position}"; "{name}'s tip" → "Lời khuyên của {name}".
- Không dùng "của bạn" thừa ("Your desk" → "Bàn làm việc", "Bàn của bạn" chỉ khi cần phân biệt).
- Câu lựa chọn của người chơi: văn nói, ngắn; với người lớn thêm "ạ" khi hợp ("Dạ, cảm ơn anh ạ!").
- Nhắc tên một vai trong câu do code ghép (thông báo "Đã lưu lời khuyên của {name}…", chữ ký trong Sổ lời khuyên): lấy
  `data/characters.json` → `names_ref.vi` ("chị Lan", "anh Minh"); bảng tên dùng `names.vi`.
- Bảng tên trên đầu và tên người nói trong hộp thoại: như bản tiếng Anh — "Ms. Huyền" → "Chị Huyền", "Ms. Nga" → "Chị Nga",
  tên trần cho Prajith, Lan, Minh, Hà, Khang, Tú; vai không tên: Tài xế, Hành khách, Người lạ, Quản lý.
- Chữ đố / chơi chữ tiếng Anh (Cuder = CU + DER) giữ nguyên chữ Anh, kèm nghĩa trong ngoặc khi cần ("cucumber — dưa chuột").
- Mật khẩu ví dụ viết không dấu (ô mật khẩu không gõ dấu): "Ao-Cam-Lua-Vang-26!".

## Kiểm tra

`npm --prefix game run test:data` báo: trường `"en"` thiếu `"vi"`, khóa `vi.json` lệch `en.json`, biến `{…}` lệch giữa hai
bản. Smoke test chạy ngoại hình thứ hai bằng tiếng Việt (zone 0 → màn tổng kết) và thử đổi ngôn ngữ ở menu Esc.
