# GDD – Ngày Đầu Ở F-Ville

Cập nhật: 09/10/2026

## Tổng quan

Người chơi vào vai một intern FPT Software trong ngày đầu tiên, đi từ lúc đón xe bus ở thành phố đến khi tan làm ở F-Ville 1, trong khoảng 25–30 phút chơi.

| Hạng mục | Nội dung |
| --- | --- |
| Tên tạm | Ngày Đầu Ở F-Ville |
| Thể loại | Phiêu lưu nhẹ nhàng (cozy adventure) 3D, góc nhìn thứ ba |
| Người chơi | Intern mới của FPT Software, chơi đơn |
| Nền tảng | Trình duyệt web (Three.js), hai mức đồ họa Thấp / Cao |
| Thời lượng | 25–30 phút, zone 0 (điểm đón, mở đầu) + 5 zone |
| Ngôn ngữ | Tiếng Anh cho mọi chữ trong game (lời thoại, giao diện, app); tên riêng giữ dấu tiếng Việt (Tú, Huyền, F-Ville, Hòa Lạc). Lời thoại mẫu trong tài liệu này viết tiếng Việt để duyệt nội dung |
| Mục tiêu | Intern biết trước hành trình ngày đầu, các giá trị văn hóa FPT và những người mình sẽ gặp |

**Trụ cột thiết kế**

1. **Một ngày có nhịp:** mỗi zone là một chương 4–6 phút, luôn có một việc chính và vài việc phụ.
2. **Văn hóa qua hành động:** người chơi thể hiện giá trị FPT bằng lựa chọn của mình, không phải đọc slide.
3. **Không có thua cuộc:** chọn sai chỉ đổi lời thoại hoặc lỡ một mảnh thưởng, không bao giờ bị chặn đường.
4. **Khám phá được thưởng:** đi lệch đường chính luôn có thứ để nhặt, đọc hoặc người để nói chuyện.

**Hành trình tóm tắt**

| Chương | Giờ trong game | Địa điểm (theo bảng ý tưởng) | Phần thưởng chính |
| --- | --- | --- | --- |
| Zone 0 | 06:30 | Điểm đón xe bus trong thành phố, cảnh lên xe | — |
| Zone 1 | 07:30 | Điểm xuống xe bus | App My FPT |
| Zone 2 | 07:40 | Cổng F-Ville, Giếng Làng, Tượng Cuder | Áo Cam FPT, huy hiệu Tinh thần Đồng đội, huy hiệu Tôn Đổi Đồng Chí Gương Sáng |
| Zone 3 | 08:00 | Sảnh Lễ Tân, Phòng Hạt Lúa | Thẻ nhân viên FPT, Welcome Kit |
| Zone 4 | 08:30 | Cửa Quẹt Thẻ, Cửa Phòng FSA | Sổ tay học tập (đề xuất) |
| Zone 5 | 09:00–17:30 | Gặp Prajith, Gặp Manager, Say Hello Team, Ngồi vào bàn làm việc | La bàn nghề nghiệp, Sổ lời khuyên (đề xuất) |

## Cốt truyện và nhân vật

Game không có phản diện: thử thách đến từ sự bỡ ngỡ của ngày đầu, và mạch cảm xúc đi từ hồi hộp, qua tò mò, đến cảm giác thuộc về.

Người chơi bắt chuyến xe bus sớm lên Hòa Lạc ở một điểm đón trong thành phố. Ở mái chờ, họ làm quen với Tú, một intern cùng đợt hay lo lắng; ở cửa xe, chị Huyền, FSofter lâu năm làm buddy, đón đợt intern lên xe. Suốt ngày, người chơi nhận áo, thẻ, gặp mentor và team, rồi kết thúc ở bàn làm việc của chính mình.

**Sợi chỉ xuyên suốt:** ở Tượng Cuder, người chơi nhận huy hiệu Tôn Đổi Đồng Chí Gương Sáng với 6 ô trống. Mỗi ô sáng lên khi người chơi hành động đúng tinh thần đó trong ngày (xem phần Cơ chế chơi).

**Mạch của Tú:** Tú nhờ người chơi giúp hai lần (quên balo trên xe, thẻ chưa kích hoạt ở cửa quẹt thẻ). Sau phòng FSA, Tú lên team khác và hẹn gặp lại lúc tan làm. Nhờ vậy zone 5 không cần nhân vật đi theo.

| Nhân vật | Vai trò | Xuất hiện | Đối tượng trong GLB |
| --- | --- | --- | --- |
| Người chơi | Intern mới, tự tạo ở màn đầu | Toàn game | `SPAWN_*` |
| Tú (tên tạm) | Intern cùng đợt, bạn đồng hành | Zone 0 đến zone 4 | Không có, code tự đặt (zone 0: đứng ở mái chờ; từ lúc bắt chuyện: đi theo người chơi) |
| Chị Huyền (Ms. Huyền) | FSofter lâu năm, buddy đón intern. Người thật, đã đồng ý dùng hình; model riêng `huyen` (áo polo cam có logo FPT, không đổi màu áo bằng code). Id vai trong dữ liệu vẫn là `thao` | Zone 0, zone 1 | `NPC_thao_cua_xe` (zone 0, cửa xe số 2), `NPC_dong_nghiep_don` (zone 1) |
| Bác tài | Tài xế xe bus FPT | Zone 1 | `NPC_tai_xe` |
| Bác tài xe số 1, xe số 3 | Tài xế hai tuyến khác, chỉ đường sang xe số 2 | Zone 0 | `NPC_tai_xe_1`, `NPC_tai_xe_3` |
| Hành khách mang túi | Người lên xe số 2 cùng lúc với người chơi | Zone 0 | `NPC_hanh_khach` |
| Chị Nga (Ms. Nga) | Tuyển dụng (Recruitment): người đã liên lạc với người chơi suốt quá trình tuyển, gửi tin nhắn hẹn xe ở zone 0; ở quầy lễ tân zone 3 lần đầu gặp người chơi trực tiếp, phát thẻ nhân viên và Welcome Kit. Người thật, đã đồng ý dùng hình; model riêng `nga` (áo polo cam có logo FPT, quần đổi sang xanh than bằng code để khác chị Huyền). Id vai trong dữ liệu vẫn là `le_tan`; tin nhắn điện thoại dùng người nói `hr` | Zone 0 (tin nhắn), zone 3 | `NPC_le_tan` |
| Prajith | Mentor, định hướng nghề nghiệp | Zone 5, phòng họp mentor | `NPC_mentor` |
| Manager | Quản lý team, giao nhiệm vụ đầu tiên | Zone 5, phòng họp manager | `NPC_manager` |
| Lan, Minh, Hà (tên tạm) | Đồng nghiệp trong team | Zone 5, khu team | `NPC_dong_nghiep_1..3` |
| Anh Khang (tên tạm) | Đồng nghiệp ở khu nghỉ | Zone 5, bàn bi-a | `NPC_ban_bi_a` |

## Tạo nhân vật

Người chơi tạo nhân vật trên một màn hình duy nhất trước khi vào game, dùng 2 thân cơ bản (nam, nữ) chung bộ xương và animation.

| Tùy chọn | Lựa chọn | Ghi chú |
| --- | --- | --- |
| Giới tính | Nam, Nữ | Chọn thân cơ bản; mọi tùy chọn khác dùng chung |
| Kiểu tóc | 4 kiểu mỗi thân | |
| Màu tóc | 5 màu | |
| Màu da | 5 tông | |
| Kính | Không, gọng tròn, gọng vuông | |
| Túi | Balo, túi đeo chéo, túi tote | Hiện trên lưng hoặc vai suốt game |
| Tên hiển thị | Nhập tự do, tối đa 16 ký tự | In lên thẻ nhân viên; lọc từ ngữ không phù hợp |
| Vị trí intern | Developer, Tester, BA, Designer | Đổi một số lời thoại với Prajith và nhiệm vụ của Manager |

**Trang phục:** nhân vật bắt đầu với áo sơ mi thường. Khi nhận Áo Cam FPT ở cổng (zone 2), áo được mặc vào ngay, và các huy hiệu nhận về sau hiện trên ngực áo.

**Cách xưng hô:** lời dẫn và giao diện gọi người chơi là "bạn". Người lớn tuổi hơn (chị Huyền, chị Nga, mentor, manager, đồng nghiệp) gọi "em"; người chơi xưng "em" và gọi "anh/chị". Tú và người chơi xưng "mình" – "cậu". Cách này không phụ thuộc giới tính đã chọn, nên không cần viết lời thoại hai phiên bản.

**Chi tiết cá nhân của nhân vật dựa trên người thật** (chị Huyền, chị Nga, Prajith): nhóm tự viết, không chờ người thật xác nhận (có thay đổi thì sửa sau). Giữ nhẹ nhàng, thân thiện, không gây ngượng: không nói chuyện sức khỏe, gia đình, tiền bạc, hay chuyện làm họ trông thiếu chuyên nghiệp.

## Cơ chế chơi

App My FPT trên điện thoại nhân vật là giao diện chính của game: người chơi nhận nó ở zone 1, và từ đó mọi checklist, đồ vật, huy hiệu đều nằm trong app.

**App My FPT (phím Tab)**

| Tab | Nội dung |
| --- | --- |
| Checklist | 12 việc của ngày đầu, đúng theo bảng ý tưởng; việc hiện tại được tô đậm |
| Túi đồ | Đồ đã nhận: áo, thẻ, Welcome Kit, laptop, sổ tay |
| Huy hiệu | Huy hiệu Tinh thần Đồng đội và huy hiệu 6 giá trị |
| Bản đồ | Sơ đồ đơn giản của zone hiện tại, chấm vị trí người chơi và mục tiêu |
| Sổ lời khuyên | Lời khuyên thu được từ đồng nghiệp ở zone 5 |

Trước khi có app (zone 0 và đầu zone 1), giao diện chỉ hiện một dòng mục tiêu.

**Hai chỉ số**, thang 0–100, chỉ cộng không trừ:

- **Hiểu biết:** trả lời đúng quiz, đọc bảng thông tin, hoàn thành mini-game.
- **Kết nối:** trò chuyện với NPC, chọn câu hỏi thăm hỏi, giúp Tú.

**Sáu giá trị Tôn Đổi Đồng Chí Gương Sáng:** mỗi giá trị gắn với một lựa chọn cụ thể trong ngày. Lựa chọn làm trước khi nhận huy hiệu ở zone 2 vẫn được tính, và ô sáng lên ngay lúc nhận. Diễn giải các giá trị dưới đây là đề xuất, cần HR rà lại.

| Giá trị | Ô sáng khi người chơi | Zone |
| --- | --- | --- |
| Tôn trọng | Cảm ơn bác tài và nhường lối cho người xuống xe sau | 1 |
| Chí công | Mang chiếc ví nhặt được đến trả chị Nga ở quầy lễ tân thay vì để lại | 3 |
| Đồng đội | Nhắn chị Nga qua App My FPT giúp Tú khi thẻ của Tú báo đỏ | 4 |
| Gương mẫu | Không cho người lạ đi ké qua cửa quẹt thẻ, chỉ đường cho họ về lễ tân | 4 |
| Đổi mới | Tự đặt thêm một mục tiêu học tập ngoài lộ trình gợi ý ở phòng FSA | 4 |
| Sáng suốt | Sắp xếp thứ tự ưu tiên công việc hợp lý khi gặp Manager | 5 |

**Thời gian:** đồng hồ góc màn hình bắt đầu ở 06:30 (zone 0) và chỉ nhảy khi người chơi xong một mốc, không đếm ngược. Người chơi không bao giờ bị "trễ giờ".

**Hạt lúa vàng:** 10 hạt giấu khắp các zone (zone 1: 2, zone 2: 3, zone 3: 2, zone 4: 1, zone 5: 2). Ở Phòng Hạt Lúa có một hũ thủy tinh hiện số hạt đã nhặt. Nhặt đủ 10 mở danh hiệu riêng ở màn tổng kết.

**Điều khiển**

| Thao tác | Phím |
| --- | --- |
| Di chuyển | W A S D hoặc phím mũi tên; giữ Shift để chạy |
| Xoay camera | Di chuột (click vào game để khóa con trỏ; mở hội thoại, app, menu thì con trỏ hiện lại) |
| Tương tác với vật hoặc NPC (trong bán kính riêng của từng đối tượng, mặc định 2 m) | E |
| Tiếp lời thoại / chọn đáp án | Space hoặc click / phím 1–4 |
| Mở App My FPT | Tab |
| Menu, cài đặt, mức đồ họa | Esc |
| Bỏ qua cảnh chuyển | Nút Skip hoặc Esc |

## Zone 0 · Điểm đón xe bus (06:30, khoảng 2 phút)

Zone 0 là đoạn mở đầu chơi được: một điểm đón trong thành phố lúc sáng sớm, nơi người chơi tìm đúng xe đi Hòa Lạc, làm quen với Tú và chị Huyền, rồi lên xe. Mục tiêu là giới thiệu hai nhân vật này và văn hóa đi bus FPT, đồng thời dạy cách đi lại và tương tác trước khi có app.

**Bối cảnh:** một đoạn phố khoảng 60 × 30 m: đường 2 làn, vỉa hè, mái chờ xe buýt, dãy nhà phố và cửa hàng (biển hiệu để trống, không logo, không chữ thương hiệu thật), cây, cột đèn. Đây là điểm đón chung chung, không mô phỏng địa điểm thật. Ba xe bus FPT đậu dọc vỉa hè, mỗi xe có biển số tuyến trên kính lái: "1", "2", "3"; xe số 2 đi Hòa Lạc.

| Đối tượng | Hoạt động | Kết quả |
| --- | --- | --- |
| Điện thoại (tự hiện khi vào zone) | Tin nhắn của chị Nga (Tuyển dụng): số xe và giờ đón *[HR cung cấp nội dung tin nhắn]* | Mục tiêu "Tìm xe số 2" |
| `INT_bien_xe_1..3` | Đọc biển số tuyến trên kính lái; xe số 2 là xe đi Hòa Lạc | Xe số 2: tìm được xe, Hiểu biết +3 |
| `NPC_tai_xe_1`, `NPC_tai_xe_3` | Hỏi bác tài xe sai: bác chỉ sang xe số 2. Không bị phạt | |
| Tú ở mái chờ (code đặt, đang xem điện thoại) | Tú bắt chuyện, xem bên dưới; sau đó Tú đi theo người chơi | Lựa chọn A: Kết nối +5 |
| `NPC_thao_cua_xe` (chị Huyền, cạnh cửa xe số 2) | Lời chào và tối đa 3 câu hỏi về văn hóa đi bus, xem bên dưới | Mỗi câu Kết nối +3 |
| `NPC_hanh_khach` (người mang túi, gần cửa xe số 2) | Người này đang lên xe: nhường lên trước hoặc chen lên trước | Nhường: Kết nối +3 (không phải ô giá trị) |
| `TRIGGER_len_xe` (cửa xe số 2) | Lên xe, mở cảnh chuyển sang zone 1 | |

**Diễn biến**

1. Người chơi xuất hiện ở `SPAWN_zone_00_start`, đồng hồ 06:30. Điện thoại rung: tin nhắn của chị Nga (Tuyển dụng) có số xe và giờ đón.
2. Tìm đúng xe: xem biển tuyến `INT_bien_xe_1..3`. Hỏi bác tài xe sai thì được chỉ sang xe số 2.
3. Tú bắt chuyện ở mái chờ:
    - Tú: "Cậu cũng intern đợt này à? Mình là Tú. Hồi hộp quá, mình còn chưa biết xuống xe thì đi đâu..."
    - Lựa chọn A: "Mình cũng vậy, đi cùng nhau nhé!" → Kết nối +5, Tú vui hẳn lên.
    - Lựa chọn B: "Chắc sẽ có người hướng dẫn thôi." → Tú gật đầu, không cộng điểm.
    - Tú: "Mình đi xe số 2 đúng không? Đi tìm xe thôi!" Từ đây Tú đi theo người chơi.
4. Chị Huyền ở cửa xe số 2: "Hai em intern mới à? Chào mừng lên xe! Chị là Huyền, hôm nay chị đón đợt của các em." (Nếu người chơi chưa gặp Tú: "Một em intern mới à? Chào mừng lên xe!…") Người chơi chọn tối đa 3 câu hỏi; mỗi câu Kết nối +3 và mở một mẩu thông tin về văn hóa đi bus FPT:
    - "Xe bus mấy giờ về ạ?" *[HR: giờ các chuyến về]*
    - "Đi xe công ty có quy định gì không ạ?" *[HR: 2–3 quy định thật]*
    - "Chị đi tuyến này lâu chưa ạ?" → một câu chuyện ngắn, vui về tuyến xe (chị đi sáu năm rồi; mẹo chọn ghế cạnh cửa sổ phía cuối xe để ngắm đồng lúa)
5. Người mang túi đang lên xe: nhường lên trước thì Kết nối +3 và người đó lên xe trước; chen lên trước thì không cộng điểm.
6. `TRIGGER_len_xe` chỉ mở khi đã gặp chị Huyền. Nếu chưa, Tú nhắc: "Khoan, mình chào chị ở cửa xe trước đã?" (chưa gặp Tú thì chị Huyền tự gọi lại).

**Cảnh chuyển lên xe** (khoảng 20 giây, có nút Skip):

1. Người chơi và Tú đi tới cửa xe; màn hình tối nhẹ khi bước lên; cửa xe đóng.
2. Camera theo các góc `CAM_lenxe_1..3`: xe số 2 chạy khỏi trạm theo đường cong `PATH_xe_roi_tram` rồi mờ dần.
3. Nền tối, thẻ chữ "06:45 · On the way to Hòa Lạc". Một câu thoại ngắn của Tú; Tú đặt balo xuống ghế bên cạnh và mải nhìn ra cửa sổ (chuẩn bị cho sự kiện quên balo ở zone 1).
4. Sang zone 1: xe chạy vào trạm theo `PATH_xe_vao_tram`, dừng, cửa mở; người chơi và Tú bước xuống ở `SPAWN_zone_01_cua_xe`, chị Huyền đã xuống trước. Từ đây zone 1 chạy bình thường.

Xe chạy bằng code dọc đường cong, cánh cửa xe xoay bằng code; không cần animation trong GLB. Bấm Skip lúc nào cũng về đúng trạng thái cuối (zone 1, xe đỗ, cửa mở, người chơi và Tú ở cửa xe).

**Có thể cắt:** mini-game "Đừng ngủ gật" (giữ thanh tỉnh táo trên quãng đường dài, chèn vào đoạn nền tối). Chỉ thêm nếu cảnh chuyển thấy quá tĩnh khi chơi thử.

## Zone 1 · Điểm xuống xe bus (07:30, khoảng 4 phút)

Việc chính ở zone 1 là nhận App My FPT từ chị Huyền; đây là zone dạy người chơi cách đi lại và tương tác.

| Đối tượng | Hoạt động | Kết quả |
| --- | --- | --- |
| `NPC_dong_nghiep_don` (chị Huyền) | Mini-game **Cài app**: điện thoại hiện 3 bước xáo trộn (tải app, đăng nhập bằng mã intern trong tin nhắn, bật thông báo), người chơi bấm đúng thứ tự | **App My FPT**, mở giao diện app; Hiểu biết +5 |
| `NPC_tai_xe` (bác tài) | Trò chuyện; chọn "Cháu cảm ơn bác ạ, bác về cẩn thận!" | Ô **Tôn trọng**; Kết nối +3 |
| `INT_xe_bus` | Chỉ mở sau khi Tú kêu quên balo: người chơi quay lại xe lấy balo đưa Tú | Kết nối +5 |
| `INT_ban_do_tuyen_xe` | Đọc bản đồ tuyến xe và giờ chuyến về *[HR: tuyến và giờ thật]* | Hiểu biết +5; giờ chuyến về được ghi vào app |
| Hạt lúa vàng × 2 | Dưới giàn leo chỗ ngồi chờ; sau cột đèn cuối vỉa hè | |

**Diễn biến**

1. Sau cảnh chuyển, người chơi và Tú bước xuống ở `SPAWN_zone_01_cua_xe` (tải lại bản lưu thì xuất hiện ở `SPAWN_zone_01_start`). Gợi ý điều khiển hiện ở góc màn hình trong 10 giây đầu.
2. Chị Huyền đã xuống xe trước, đứng chờ, có dấu chấm than trên đầu.
3. Khoảng 20 giây sau, Tú hốt hoảng: "Ơ, balo của mình đâu rồi!" → mở việc phụ lấy balo.
4. Sau khi có app, chị Huyền: "Giờ các em đi thẳng vào cổng nhé, chị lên văn phòng trước. Có gì nhắn chị qua app!"

**Chuyển zone:** `TRIGGER_zone_02_enter` chỉ mở sau khi có App My FPT. Nếu người chơi đi tới trước, chị Huyền gọi lại: "Em ơi, cài app trước đã!". Người chơi xuất hiện ở `SPAWN_zone_02_from_zone_01`.

## Zone 2 · Cổng, Giếng Làng, Tượng Cuder (07:40, khoảng 6 phút)

Zone 2 là nơi người chơi chính thức "gia nhập Làng F" và nhận cả ba phần thưởng văn hóa đầu tiên; zone này không có NPC, chỉ có Tú đi cùng.

| Đối tượng | Hoạt động | Kết quả |
| --- | --- | --- |
| `INT_cong_fville` | Check-in gia nhập Làng F: chế độ **chụp ảnh** trước biển chữ FPT SOFTWARE, người chơi chọn tư thế và có thể kéo Tú vào khung | **Áo Cam FPT**, mặc vào ngay; ảnh lưu vào app; Hiểu biết +5 |
| `INT_gieng_lang` | Mini-game **Kéo nước bằng cần vọt**: 3 lượt, bấm đúng lúc thanh chạy vào vùng xanh. Mỗi gầu kéo lên mở một mẩu về ý nghĩa F-Ville và triết lý "Làng Công Nghệ" *[HR cung cấp 3 mẩu]* | Huy hiệu **Tinh thần Đồng đội** gắn lên áo; Hiểu biết +10 |
| `INT_tuong_cuder` | Đọc câu chuyện về Cuder (CU + DER, người làm IT chăm chỉ, cây cuốc và đống xu 0/1; nội dung từ mentor, `data/quiz.json`), rồi trả lời **quiz 3 câu** | Huy hiệu **Tôn Đổi Đồng Chí Gương Sáng** (6 ô); Hiểu biết +5 mỗi câu đúng |
| Hạt lúa vàng × 3 | Trong bụi tre trên đảo giếng; trên gò cỏ sau biển chữ; dưới tầng trệt pilotis | |

**Quiz ở Tượng Cuder:** trả lời sai không bị phạt; game hiện lời giải thích ngắn rồi sang câu tiếp. Nhận huy hiệu xong, ô Tôn trọng sáng lên ngay nếu người chơi đã cảm ơn bác tài ở zone 1, kèm lời giải thích "Bạn đã thể hiện điều này từ sáng nay!".

**Lời Tú (mẫu):** đứng trước tượng, Tú nói: "Sáu ô này mình phải lấp đầy trong hôm nay à? Thử thách chấp nhận!". Câu này giới thiệu sợi chỉ xuyên suốt cho người chơi.

**Chuyển zone:** cả ba hoạt động là bắt buộc. `TRIGGER` ở bậc thềm lên sảnh chỉ mở khi xong cả ba; nếu thiếu, Tú nhắc việc còn thiếu. Người chơi xuất hiện ở `SPAWN_zone_03_from_zone_02`.

## Zone 3 · Sảnh Lễ Tân và Phòng Hạt Lúa (08:00, khoảng 5 phút)

Người chơi nhận thẻ nhân viên, thứ mở được mọi cánh cửa phía sau, và tìm hiểu lịch sử thành tựu FPT ở Phòng Hạt Lúa.

| Đối tượng | Hoạt động | Kết quả |
| --- | --- | --- |
| `NPC_le_tan` (chị Nga), `INT_quay_le_tan` | Mini-game **Kiểm tra hồ sơ**: phiếu thông tin điền sẵn có 1 chỗ sai (ví dụ sai tên team), người chơi tìm và sửa. Sau đó **chụp ảnh thẻ**: camera chân dung, chọn 1 trong 3 biểu cảm | **Thẻ nhân viên FPT** (in tên, vị trí, ảnh vừa chụp) và **Welcome Kit** *[HR: Welcome Kit thật gồm những gì]*; Hiểu biết +5 |
| Chiếc ví đánh rơi (code đặt cạnh đôn lục giác, không có trong GLB) | Nhặt ví, rồi chọn: mang đến quầy lễ tân trả chị Nga, hoặc để lại chỗ cũ | Trả ví: ô **Chí công**, Kết nối +3 |
| `INT_hat_lua` | Đọc về các cá nhân, tập thể xuất sắc. Mini-game **Dòng thời gian**: kéo 5 mốc thành tựu vào đúng thứ tự năm *[HR cung cấp 5 mốc]* | Hiểu biết +10; hũ thủy tinh hiện số hạt lúa vàng đã nhặt |
| Hạt lúa vàng × 2 | Sau chậu cọ cạnh quầy; góc sàn dưới chân cầu thang trang trí, cạnh lối vào Phòng Hạt Lúa (thành cầu thang kín nên hạt đặt trên chiếu nghỉ không nhìn thấy từ sàn) | |

**Chị Nga ở quầy (mẫu):** chị tự giới thiệu là người tuyển dụng đã liên lạc với người chơi, vui vì lần đầu gặp trực tiếp, hỏi tin nhắn hẹn xe có giúp người chơi lên đúng xe không, rồi: "Giờ tới giấy tờ nhé. Em kiểm tra giúp chị thông tin trên phiếu này, có gì sai thì sửa luôn." Toàn bộ lời thoại: `docs/dialogue_nga.md`.

**Chuyển zone:** nhận thẻ và Phòng Hạt Lúa là bắt buộc; chiếc ví là tùy chọn. Đi về phía hành lang, người chơi xuất hiện ở `SPAWN_zone_04_from_zone_03`.

## Zone 4 · Cửa Quẹt Thẻ, cầu thang, Cửa Phòng FSA (08:30, khoảng 5 phút)

Zone 4 có hai tình huống lựa chọn quan trọng nhất game, đều xoay quanh an toàn ra vào, và là nơi Tú chia tay người chơi.

| Đối tượng | Hoạt động | Kết quả |
| --- | --- | --- |
| `INT_cua_quet_the` | **Lần quẹt thẻ đầu tiên:** đưa thẻ vào đầu đọc, đèn xanh, tiếng bíp, hai cánh cửa mở; chữ "Lần quẹt thẻ đầu tiên!" hiện lên | Hiểu biết +5 |
| Người lạ (code đặt cạnh cửa, mặc đồ khách) | Tình huống 1, xem bên dưới | Ô **Gương mẫu** |
| Tú ở cửa quẹt thẻ | Tình huống 2, xem bên dưới | Ô **Đồng đội** |
| `TRIGGER_cau_thang` | Đi lên cầu thang chữ U lên tầng trên | |
| `INT_cua_phong_fsa` | Đọc sứ mệnh FSA và vai trò của học tập trong FPT *[HR cung cấp]*. Mini-game **Lộ trình học**: kéo 3 khóa gợi ý (theo vị trí intern) vào lịch tuần đầu, rồi được hỏi có muốn tự đặt thêm một mục tiêu riêng không | **Sổ tay học tập** (đề xuất); tự đặt mục tiêu: ô **Đổi mới**; Hiểu biết +10 |
| Hạt lúa vàng × 1 | Trên chiếu nghỉ cầu thang | |

**Tình huống 1 · Người lạ xin đi ké** (xảy ra ngay khi người chơi vừa mở cửa)

- Người lạ: "Em ơi, cho anh đi cùng với, anh để quên thẻ trên xe."
- "Dạ anh vào đi ạ." → cửa mở cho cả hai. Không có ô; chị Huyền nhắn qua app một lời nhắc nhẹ nhàng về việc không cho người khác đi ké.
- "Dạ em xin lỗi, anh qua lễ tân để được hỗ trợ nhé." → ô **Gương mẫu**; người lạ cảm ơn và quay về sảnh.

**Tình huống 2 · Thẻ của Tú báo đỏ**

- Tú: "Ơ, thẻ mình bị đỏ... Hay cậu quẹt giúp mình đi cùng luôn?"
- "Ừ, đi cùng mình." → Tú qua được, nhưng chị Huyền nhắn: kể cả bạn bè cũng không nên đi ké. Không có ô.
- "Để mình nhắn chị Nga qua app." → chị Nga kích hoạt thẻ từ xa và nhắn lại, thẻ Tú chuyển xanh. Ô **Đồng đội**, Kết nối +5.
- "Cậu quay lại lễ tân hỏi thử xem." → Tú đi một mình, quay lại sau ít phút. Không có ô, không cộng điểm.

**Tú chia tay:** sau phòng FSA, Tú nói: "Team mình ở tầng trên nữa. Hẹn gặp cậu lúc tan làm nhé!"

**Chuyển zone:** quẹt thẻ và phòng FSA là bắt buộc. Người chơi xuất hiện ở `SPAWN_zone_05_from_zone_04`.

## Zone 5 · Văn phòng (09:00–17:30, khoảng 8 phút)

Zone 5 nén cả ngày làm việc thành bốn cuộc gặp, kết thúc khi người chơi ngồi vào bàn có tên mình.

| Đối tượng | Hoạt động | Kết quả |
| --- | --- | --- |
| `NPC_mentor` trong `INT_phong_hop_mentor` (Prajith) | **Gặp Prajith:** 4 câu hỏi định hướng nghề nghiệp, không có đáp án đúng sai (ví dụ: "Em thích gỡ một lỗi khó hay dựng một tính năng mới?") | **La bàn nghề nghiệp** (đề xuất): một thẻ gợi ý hướng phát triển theo vị trí intern và câu trả lời; Kết nối +5 |
| `NPC_manager` trong `INT_phong_hop_manager` | **Gặp Manager:** nghe mục tiêu của team *[team cung cấp, hoặc dùng bản chung]*, rồi mini-game **Sắp xếp ưu tiên**: kéo 5 thẻ việc tuần đầu theo thứ tự | **Nhiệm vụ đầu tiên** ghi vào app; xếp hợp lý: ô **Sáng suốt** |
| `NPC_dong_nghiep_1..3` (Lan, Minh, Hà) | **Say Hello Team:** nói chuyện với từng người, mỗi người cho một lời khuyên ngày đầu | Lời khuyên vào **Sổ lời khuyên**; Kết nối +5 mỗi người |
| `NPC_ban_bi_a` (anh Khang) | Trò chuyện và mini-game tùy chọn **Một cú bi-a**: chỉnh hướng và lực, đưa bi vào lỗ | Một lời khuyên nữa; Kết nối +5 |
| `INT_ban_lam_viec` | **Ngồi vào bàn làm việc:** mở hộp quà của team; mini-game **Đăng nhập**: tạo mật khẩu đạt yêu cầu (thanh độ mạnh) và bật xác thực hai lớp *[HR/IT: quy định mật khẩu thật]*; rồi xem checklist ngày đầu tự tick | Bảng tên trống trên bàn hiện tên người chơi; Hiểu biết +10; kích hoạt kết thúc |
| Hạt lúa vàng × 2 | Trên kệ ô vuông đỏ; dưới bàn bi-a | |

**Mini-game Sắp xếp ưu tiên (mẫu):** 5 thẻ gồm hoàn thành khóa an toàn thông tin bắt buộc (hạn hôm nay), cài môi trường làm việc, đọc tài liệu dự án, xem qua mã nguồn, đăng ký câu lạc bộ thể thao. Thứ tự hợp lý là việc có hạn hôm nay lên đầu, câu lạc bộ xuống cuối. Ba việc ở giữa đổi chỗ nhau vẫn được tính đúng. Xếp chưa hợp lý thì Manager góp ý một câu và cho xếp lại một lần.

**Trình tự:** khi vào zone, app báo "09:15 Họp với Prajith". Gặp Prajith và Manager theo thứ tự; Say Hello Team làm lúc nào cũng được; bàn làm việc chỉ mở khi đã gặp Manager. Sau buổi gặp Manager, màn hình mờ đi với dòng chữ "12:00 · Cả team rủ bạn đi ăn trưa" rồi sáng lại ở buổi chiều.

**Lời Manager (mẫu):** "Chào em, chào mừng em về team! Tuần đầu chưa cần làm gì lớn đâu, nhưng chị muốn xem em sắp xếp công việc thế nào."

## Kết thúc và màn tổng kết

Game kết thúc lúc 17:30 bằng một thẻ "Ngày Đầu" tóm tắt những gì người chơi đã làm; ai chơi đến cuối cũng có danh hiệu.

**Cảnh kết (khoảng 1 phút)**

1. Chuông báo 17:30 trên app. Lan ghé bàn: "Về thôi em, mai gặp nhé!"
2. Màn hình mờ, chuyển về zone_01 với ánh sáng hoàng hôn. *(Tùy chọn: nếu chưa kịp làm bản hoàng hôn, dùng nền ảnh tĩnh.)*
3. Tú chạy đến bến xe. Lời Tú đổi theo số lần người chơi đã giúp: giúp cả hai lần → "Hôm nay không có cậu chắc mình toang rồi, cảm ơn nhé!"; còn lại → "Ngày đầu cũng không đáng sợ lắm nhỉ? Mai gặp lại!"
4. Lên xe, màn tổng kết hiện ra.

**Màn tổng kết** hiện trên một thẻ đứng:

- Nhân vật mặc áo cam, đeo các huy hiệu đã nhận, cạnh ảnh check-in ở cổng
- Huy hiệu 6 giá trị: ô nào sáng, ô nào còn trống (kèm gợi ý ngắn cho ô trống)
- Hiểu biết, Kết nối, số hạt lúa vàng
- Danh hiệu chính và các danh hiệu phụ đạt được
- Lời nhắn của Prajith, viết theo kết quả La bàn nghề nghiệp
- Nút **Tải ảnh thẻ** (PNG) và **Chơi lại**

**Danh hiệu** (danh hiệu chính là dòng cao nhất người chơi đạt; các dòng khác đạt được hiện thành danh hiệu phụ)

| Danh hiệu | Điều kiện |
| --- | --- |
| Gương Sáng Làng F | Sáng đủ 6 ô giá trị |
| Đồng Đội Số 1 | Giúp Tú cả hai lần (lấy balo, nhắn chị Nga kích hoạt thẻ) |
| Người Kết Nối | Kết nối từ 80 trở lên |
| Mọt Sách Làng F | Hiểu biết từ 80 trở lên |
| Nhà Thám Hiểm | Nhặt đủ 10 hạt lúa vàng |
| Intern Làng F | Hoàn thành game (mặc định) |

Ngưỡng 80 là tạm, sẽ chỉnh sau khi chơi thử để khoảng một phần ba người chơi đạt được.

## Phần thưởng

Game có 11 phần thưởng: 6 lấy từ bảng ý tưởng, 5 là đề xuất thêm để các địa điểm phía sau cũng có quà.

| Phần thưởng | Loại | Nơi nhận | Điều kiện | Nguồn |
| --- | --- | --- | --- | --- |
| App My FPT | Mở giao diện app | Zone 1, chị Huyền | Xong mini-game Cài app | Bảng ý tưởng |
| Áo Cam FPT | Trang phục, mặc ngay | Zone 2, cổng | Chụp ảnh check-in | Bảng ý tưởng |
| Huy hiệu Tinh thần Đồng đội | Huy hiệu trên áo | Zone 2, giếng làng | Kéo xong 3 gầu nước | Bảng ý tưởng |
| Huy hiệu Tôn Đổi Đồng Chí Gương Sáng | Huy hiệu 6 ô trên áo | Zone 2, tượng Cuder | Làm xong quiz, đúng sai đều nhận | Bảng ý tưởng |
| Thẻ nhân viên FPT | Vật phẩm, dùng ở cửa quẹt thẻ | Zone 3, chị Nga ở quầy lễ tân | Kiểm tra hồ sơ và chụp ảnh thẻ | Bảng ý tưởng |
| Welcome Kit | Vật phẩm | Zone 3, chị Nga ở quầy lễ tân | Nhận cùng thẻ | Bảng ý tưởng |
| Ảnh check-in | Ảnh trong app và màn tổng kết | Zone 2, cổng | Chụp ảnh check-in | Đề xuất |
| Sổ tay học tập | Vật phẩm | Zone 4, phòng FSA | Xong mini-game Lộ trình học | Đề xuất |
| La bàn nghề nghiệp | Thẻ gợi ý hướng phát triển | Zone 5, Prajith | Trả lời đủ 4 câu | Đề xuất |
| Nhiệm vụ đầu tiên | Mục trong app | Zone 5, Manager | Xong mini-game Sắp xếp ưu tiên | Đề xuất |
| Sổ lời khuyên | Tab trong app | Zone 5, đồng nghiệp | Mỗi người trò chuyện thêm một lời khuyên | Đề xuất |

## Nội dung cần HR và các đơn vị cung cấp

Mười bốn mục nội dung dưới đây cần nguồn chính thức; trong lúc chờ, game dùng nội dung tạm có đánh dấu `[DRAFT]` để không lộ ra bản phát hành.

- [ ] Tin nhắn chào mừng, số xe và giờ đón, lịch trình ngày đầu (zone 0)
- [ ] Tuyến xe và giờ các chuyến về (zone 0, zone 1)
- [ ] 2–3 quy định khi đi xe bus công ty (zone 0)
- [ ] 3 mẩu về ý nghĩa F-Ville và triết lý "Làng Công Nghệ" (zone 2, giếng làng)
- [x] Câu chuyện hình tượng Cuder và 3 câu quiz (zone 2) — đã có từ mentor, 09/10/2026
- [ ] Diễn giải chính thức 6 giá trị Tôn Đổi Đồng Chí Gương Sáng; rà lại 6 lựa chọn gắn với từng giá trị (Cơ chế chơi)
- [ ] Welcome Kit thật gồm những gì (zone 3)
- [ ] 5 mốc thành tựu, cùng các cá nhân và tập thể xuất sắc được phép nêu tên (zone 3, Phòng Hạt Lúa)
- [ ] Sứ mệnh FSA và các khóa học gợi ý theo từng vị trí intern (zone 4)
- [ ] Quy định ra vào bằng thẻ và cách xử lý khi thẻ lỗi hoặc quên thẻ (zone 4)
- [ ] Quy định mật khẩu và xác thực hai lớp, từ IT (zone 5)
- [ ] Mục tiêu team mẫu và 5 việc tuần đầu cho mini-game Sắp xếp ưu tiên (zone 5)
- [ ] Checklist ngày đầu thật (zone 5)
- [ ] Đồng ý dùng tên Prajith và hình hoạt hóa, nếu đây là người thật (zone 5)

## Phạm vi và thứ tự làm

Làm theo ba giai đoạn, và chỉ sang giai đoạn sau khi giai đoạn trước đã được 3–5 người chơi thử trên laptop văn phòng thật.

1. **Vertical slice: zone 0 đến zone 3**
    - Màn tạo nhân vật đầy đủ, nhân vật điều khiển được, va chạm với `COL_`, chuyển zone qua `TRIGGER_`/`SPAWN_`
    - Hệ thống tương tác và hội thoại đọc từ JSON (xem Phụ lục)
    - App My FPT với tab Checklist, Túi đồ, Huy hiệu
    - Zone 0 (điểm đón, cảnh lên xe), zone 1, 2, 3 đủ hoạt động bắt buộc; ô Tôn trọng và Chí công
    - Lưu tiến trình vào trình duyệt; hai mức đồ họa tự chọn theo máy
2. **Đủ hành trình: zone 4, zone 5 và kết thúc**
    - Hai tình huống ở cửa quẹt thẻ, phòng FSA, bốn cuộc gặp ở văn phòng
    - Màn tổng kết, danh hiệu, tải ảnh thẻ
    - Hạt lúa vàng, tab Bản đồ và Sổ lời khuyên
3. **Hoàn thiện**
    - Thay toàn bộ nội dung `[DRAFT]` bằng nội dung HR
    - Âm thanh và nhạc nền, cảnh hoàng hôn ở zone 1
    - Mini-game tùy chọn (Một cú bi-a, Đừng ngủ gật), chỉnh ngưỡng danh hiệu

**Cắt được nếu thiếu thời gian**, theo thứ tự cắt trước: Đừng ngủ gật, Một cú bi-a, cảnh hoàng hôn, hạt lúa vàng. Tú là phần đắt nhất nhưng cũng giữ mạch cảm xúc; nếu phải bỏ Tú, chuyển tình huống thẻ báo đỏ sang một intern khác do code đặt tạm ở cửa.

**Ngoài phạm vi:** chơi nhiều người, điều khiển cảm ứng trên điện thoại, lồng tiếng, bản tiếng Việt (chữ trong game là tiếng Anh, đã tách theo mã ngôn ngữ trong `data/i18n/` nên thêm bản tiếng Việt sau được).

## Phụ lục: dữ liệu JSON cho Claude Code

Toàn bộ nội dung game nằm trong các file JSON ở thư mục `data/`, để người không biết code cũng sửa được lời thoại, quiz và phần thưởng.

| File | Chứa gì |
| --- | --- |
| `data/dialogues.json` | Các đoạn hội thoại, dạng cây nút có lựa chọn |
| `data/quests.json` | Việc cần làm ở mỗi zone, gắn với mục checklist |
| `data/interactables.json` | Nối tên đối tượng trong GLB (`INT_`, `NPC_`, `TRIGGER_`) với hội thoại, mini-game, điều kiện mở |
| `data/quiz.json` | Câu hỏi quiz và giải thích |
| `data/rewards.json` | Phần thưởng: tên, loại, biểu tượng, có mặc lên người không |
| `data/values.json` | 6 giá trị và gợi ý hiện ở màn tổng kết |
| `data/zones.json` | Danh sách zone (bắt đầu ở zone 0), điểm xuất hiện, ánh sáng riêng từng zone |
| `data/cutscenes.json` | Cảnh chuyển (cảnh lên xe zone 0 → zone 1): đối tượng, góc máy, thời lượng từng nhịp |
| `data/characters.json` | Vai, model, tên hiển thị, màu áo/quần tạm cho các NPC còn dùng chung model |
| `data/i18n/en.json` | Chữ giao diện tiếng Anh (thêm ngôn ngữ khác bằng file cùng cấu trúc) |

**Hiệu ứng** dùng chung cho lựa chọn hội thoại và mini-game: `hieu_biet`, `ket_noi` (số cộng thêm), `value` (id giá trị), `reward` (id phần thưởng), `flags` (cờ đánh dấu sự kiện), `quest` (id việc vừa xong). Chữ hiển thị là object theo mã ngôn ngữ, ví dụ `{ "en": "..." }`. Nội dung chờ HR có `"draft": true` (game hiện `[DRAFT]`); bản phát hành báo lỗi nếu còn mục nào như vậy.

**Ví dụ hội thoại** (đoạn Tú bắt chuyện ở mái chờ, zone 0):

```json
{
  "id": "tu_bat_chuyen",
  "start": "n1",
  "nodes": {
    "n1": {
      "speaker": "tu",
      "anim": "wave",
      "text": { "en": "Are you an intern in this batch too? I'm Tú. I'm so nervous... I don't even know where to go after we get off the bus." },
      "choices": [
        { "text": { "en": "Me too — let's stick together!" }, "effects": { "ket_noi": 5 }, "next": "happy" },
        { "text": { "en": "I'm sure someone will show us around." }, "next": "nod" }
      ]
    },
    "happy": { "speaker": "tu", "text": { "en": "Really? Phew, I feel so much better already!" }, "next": "n2" },
    "nod": { "speaker": "tu", "anim": "nod", "text": { "en": "Yeah... I guess you're right." }, "next": "n2" },
    "n2": { "speaker": "tu", "text": { "en": "We're on Bus No. 2, right? Let's go find it!" }, "effects": { "quest": "z0_meet_tu", "flags": ["tu_met"] }, "next": null }
  }
}
```

**Ví dụ việc cần làm và điều kiện chuyển zone:**

```json
{
  "quests": [
    { "id": "z0_meet_thao", "zone": "zone_00", "checklist": "bus", "required": true, "target": "NPC_thao_cua_xe", "title": { "en": "Say hello to Ms. Huyền at Bus No. 2" } },
    { "id": "z1_get_app", "zone": "zone_01", "checklist": "bus", "required": true, "target": "NPC_dong_nghiep_don", "title": { "en": "Get the My FPT app from Ms. Huyền" } }
  ],
  "triggers": [
    { "zone": "zone_00", "node": "TRIGGER_len_xe", "cutscene": "len_xe", "requires": ["z0_meet_thao"], "blocked_dialogue": "board_remind" },
    { "zone": "zone_01", "node": "TRIGGER_zone_02_enter", "to_zone": "zone_02", "to_spawn": "SPAWN_zone_02_start", "requires": ["z1_get_app"], "blocked_dialogue": "thao_remind_app" }
  ]
}
```

**Ví dụ nối đối tượng GLB:**

```json
[
  { "zone": "zone_00", "node": "INT_bien_xe_2", "radius": 3.0, "prompt": { "en": "Read the route sign" }, "action": "dialogue:bien_xe_2" },
  { "zone": "zone_02", "node": "INT_gieng_lang", "area": "TRIGGER_gieng_lang", "prompt": { "en": "Draw water from the well" }, "action": "minigame:well" },
  { "zone": "zone_01", "node": "NPC_tai_xe", "radius": 2.5, "prompt": { "en": "Talk to the bus driver" }, "action": "dialogue:tai_xe_thanks" }
]
```

**Trạng thái lưu trong trình duyệt:** thông tin nhân vật (giới tính, tóc, da, kính, túi, tên, vị trí), hai chỉ số, 6 giá trị, phần thưởng, việc đã xong, cờ sự kiện, hạt lúa đã nhặt, zone và giờ hiện tại.

**Kiểm tra khi tải game:** mọi `node` trong JSON (kể cả xe, cánh cửa, `CAM_`, `PATH_` mà cảnh chuyển dùng) phải có thật trong GLB của zone tương ứng; thiếu thì báo lỗi rõ tên ở chế độ debug. Tên trigger và spawn trong ví dụ theo quy ước của báo cáo bối cảnh; Claude Code đối chiếu với tên thật trong file GLB.

## Câu hỏi mở

- [ ] Giữ nhân vật Tú hay bỏ để giảm khối lượng? Tú đắt nhất về code nhưng mang mạch cảm xúc và ô Đồng đội.
- [ ] Prajith là người thật hay nhân vật? Nếu là người nước ngoài, có muốn Prajith nói tiếng Anh kèm phụ đề cho thực tế hơn không?
- [ ] Tên chính thức cho các NPC tạm: Tú, Lan, Minh, Hà, anh Khang.
- [ ] Bốn vị trí intern (Developer, Tester, BA, Designer) đã đủ chưa, hay cần thêm vị trí khác?
- [ ] Ở zone 2, giếng làng là bắt buộc hay tùy chọn? Hiện đang để bắt buộc cả ba hoạt động.
- [ ] Có làm cảnh hoàng hôn ở zone 1 cho đoạn kết, hay dùng nền ảnh tĩnh?
