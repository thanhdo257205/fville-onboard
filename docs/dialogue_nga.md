# Lời thoại của Ms. Nga

Tài liệu tham khảo lời thoại, game "Ngày Đầu Ở F-Ville" (cập nhật 09/10/2026; nguồn: `data/dialogues.json`). Trong game,
chị Nga làm ở bộ phận Tuyển dụng (Recruitment): chị là người đã liên lạc với người chơi suốt quá trình tuyển, gửi tin nhắn
hẹn xe sáng nay (zone 0), và hôm nay lần đầu gặp người chơi trực tiếp ở quầy lễ tân sảnh tòa nhà (zone 3). Bảng tên trên
đầu, tên trong hộp thoại và tên người gửi tin nhắn đều ghi **Ms. Nga**; trong câu thoại chị tự giới thiệu là **Nga**.
Id vai trong dữ liệu vẫn là `le_tan` (tin nhắn điện thoại dùng người nói `hr`, mượn chân dung của vai `le_tan`).

Mọi chữ trong game là tiếng Anh, chỉ có chữ, không có lồng tiếng. `{player}` là tên người chơi tự đặt ở màn đầu. Cột
"Cử chỉ" là animation nhân vật làm khi nói câu đó. Người chơi gọi chị bằng "you" trong tiếng Anh (bản tiếng Việt sau này
sẽ xưng "em" và gọi "chị").

Cột Ghi chú: **[DRAFT]** = nội dung đang chờ HR xác nhận (giờ xe, quy định), trong game hiện chữ [DRAFT].

> Chị Nga là người thật, **chưa xác nhận đồng ý dùng hình**. Model `nga` và chân dung chỉ có trên máy làm việc; bản web
> công khai (và bản clone repo) dùng tạm model Prajith cho vai này. Xem `docs/PROGRESS.md`.

## 1. Zone 0 · Điểm đón xe bus (06:30) — tin nhắn điện thoại

Vừa vào zone, điện thoại rung, tin nhắn tự hiện (khung tin nhắn, có chân dung chị Nga).

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | Tin nhắn hẹn xe, tự hiện khi vào zone 0 | Good morning, {player}! It's Nga from Recruitment. Your shuttle today is Bus No. 2 to Hòa Lạc — pickup at 06:45 at this stop. See you at F-Ville! | | số xe, giờ đón [DRAFT] |

Ở zone 1, gợi ý của mini-game Cài app nhắc lại tin nhắn này: *"Hint: once the app is installed, log in with the code from
Ms. Nga's message."*

## 2. Zone 3 · Sảnh tòa nhà, quầy lễ tân (08:00)

Chị Nga đứng sau quầy lễ tân. Lời nhắc khi lại gần: **"Talk to Ms. Nga"**; nhiệm vụ trong app: **"Get your employee card
from Ms. Nga"**. Thứ tự giữ như cũ: phiếu thông tin (mini-game Kiểm tra hồ sơ) → chụp ảnh thẻ → nhận thẻ nhân viên và
Welcome Kit.

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 2 | Lần đầu nói chuyện | {player}? Welcome to F-Ville! I'm Nga from Recruitment — so nice to finally meet you in person. | vẫy tay | |
| 3 | Ngay sau câu 2 (hoặc câu 12) | After all our emails and calls, it's lovely to put a face to the name. Did my message get you onto Bus No. 2 all right? | | người chơi chọn 1 trong 2 câu trả lời |
| 4 | Người chơi trả lời: *"Yes — Ms. Huyền was waiting right at the door!"* | That's Huyền — she never loses an intern. Oh, and look: orange suits you. We match today! | gật đầu | người chơi đã mặc Áo Cam FPT từ cổng zone 2 |
| 5 | Người chơi trả lời: *"Just in time — I almost got on Bus No. 1!"* | Ha! The number on the windshield is the one to trust. Anyway, you made it — and orange suits you. We match today! | | thay cho câu 4 |
| 6 | Trước mini-game Kiểm tra hồ sơ | Now, the paperwork. Could you check the details on this form for me? If anything's wrong, just fix it. | | |
| 7 | Sửa phiếu xong, trước mini-game Chụp ảnh thẻ | Perfect. Now a quick photo for your card. Big smile — you'll be wearing this one every day! | chỉ tay | |
| 8 | Chụp ảnh xong: trao thẻ nhân viên và Welcome Kit | Here's your FPT employee card, {player}, and your Welcome Kit. From our first call to your first day — I'm so glad you're here! | gật đầu | Welcome Kit gồm gì: chờ HR |
| 9 | Nói chuyện lại sau khi đã có thẻ | Your card opens the gates upstairs. If anything comes up today, just message me in the app! | | mở đường cho lựa chọn ở zone 4 |

**Chiếc ví đánh rơi.** Người chơi nhặt ví trên ghế ở sảnh rồi mang đến quầy. Câu 10–11 chạy trước mọi câu khác nếu người
chơi đang cầm ví.

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 10 | Người chơi (đang cầm ví) nói trước | Excuse me — I found this wallet on the seats over there. | | lời người chơi |
| 11 | Chị nhận ví | Oh, thank you! Someone must be worried sick. I'll make sure it gets back to its owner. | gật đầu | ô **Chí công** (Fairness), Kết nối +3 |
| 12 | Sau câu 11, nếu người chơi **chưa** nhận thẻ: chị mới nhận ra người chơi | And you must be {player}! I'm Nga from Recruitment — so nice to finally meet you in person. | vẫy tay | thay cho câu 2, rồi tiếp câu 3 |

Nếu người chơi đã nhận thẻ rồi mới mang ví đến, hội thoại dừng sau câu 11.

## 3. Zone 4 (chưa làm)

Ở cửa quẹt thẻ, thẻ của Tú báo đỏ. Lựa chọn trước đây "gọi lễ tân qua app" đổi thành **nhắn chị Nga qua App My FPT**:

- Lựa chọn của người chơi (dự kiến): *"I'll message Ms. Nga in the app."*
- Tin nhắn trả lời của chị Nga (dự kiến, khung tin nhắn như câu 1): *"Got it! I've just activated Tú's card — try again
  now. Thanks for looking out for each other!"*
- Kết quả: thẻ Tú chuyển xanh; ô **Đồng đội** (Teamwork), Kết nối +5. Mô tả cách đạt ô này trong app đã đổi thành
  *"Message Ms. Nga in the app when Tú's card turns red."*

Câu chữ zone 4 sẽ chốt và thêm vào game khi làm tới zone 4.
