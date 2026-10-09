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

> Chị Nga là người thật, đã đồng ý dùng hình (xác nhận 09/10/2026).

## 1. Zone 0 · Điểm đón xe bus (06:30) — tin nhắn điện thoại

Vừa vào zone, điện thoại rung, tin nhắn tự hiện (khung tin nhắn, có chân dung chị Nga).

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | Tin nhắn hẹn xe, tự hiện khi vào zone 0 | Good morning, {player}! It's Nga from Recruitment. Your shuttle today is Bus No. 2 to Hòa Lạc — pickup at 06:45 at this stop. Your intern code for the My FPT app: FV-2026. See you at F-Ville! | | số xe, giờ đón, mã intern [DRAFT] |

Ở zone 1, trước mini-game Cài app chị Huyền nói thứ tự 3 bước (tải app → đăng nhập bằng mã intern trong tin nhắn này →
bật thông báo); gợi ý của bước đăng nhập nhắc lại tin nhắn: *"Hint: the app is installed — now log in with the intern
code from Ms. Nga's message."*

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
| 6 | Trước mini-game Kiểm tra hồ sơ: nói rõ luật (1 dòng sai → tìm dòng đó rồi chọn giá trị đúng) | Now, the paperwork. One detail on this form got mixed up — can you find that line, then pick the right value for it? | | |
| 7 | Sửa phiếu xong, trước mini-game Chụp ảnh thẻ: nói rõ luật (chọn biểu cảm rồi chụp) | Perfect. Now a quick photo for your card: pick an expression, then take the shot. Big smile — you'll be wearing this one every day! | chỉ tay | |
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

**Tin nhắn nhắc việc (zone 3–4).** Người chơi chưa làm được việc gì trong 30 giây (không tính lúc hội thoại, mini-game)
mà Tú không đi cùng → chị Nga nhắn một tin ngắn (góc phải trên, không dừng game); mỗi việc tối đa 2 lần, cách nhau 45
giây. Nguồn: `data/guidance.json`. Ở bản hiện tại Tú luôn đi cùng ở zone 3 nên các tin này hiếm khi hiện.

| Việc | Lần 1 | Lần 2 |
| --- | --- | --- |
| Nhận thẻ ở quầy | I'm at the reception desk, right in the lobby — come and get your card! | Your employee card is ready at reception — come find me! |
| Phòng Hạt Lúa | Before you go up, take a look at the Rice Grain Room at the back of the lobby. | The Rice Grain Room tells FPT's story — it's at the back of the lobby! |

## 3. Zone 4 · Cửa quẹt thẻ (08:30) — tin nhắn

Ở cửa quẹt thẻ, sau khi người chơi xử lý người lạ, thẻ của Tú báo đỏ (hội thoại `card_gate`). Người chơi chọn
**"I'll message Ms. Nga in the app."** → lời dẫn *"You open My FPT and message Ms. Nga: "Tú's card shows red at the gate —
could you help?""* → chị Nga trả lời bằng tin nhắn (khung điện thoại, chân dung chị Nga):

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 13 | Trả lời tin nhắn nhờ kích hoạt thẻ cho Tú | Got it! I've just activated Tú's card — try again now. Thanks for looking out for each other! | | tin nhắn; ngay sau đó thẻ Tú xanh: ô **Đồng đội** (Teamwork), Kết nối +5 |

Hai lựa chọn còn lại không có tin nhắn của chị Nga: "Sure, come with me." (Tú đi ké → chị Huyền nhắn nhắc, xem
`docs/dialogue_huyen.md`), "Maybe ask at reception?" (Tú tự quay lại lễ tân, khoảng 40 giây sau quay lại).

**Tin nhắn nhắc việc ở zone 4** (đứng yên 30 giây mà Tú không đi cùng — vd Tú đang quay lại lễ tân, hoặc đã chia tay):

| Việc | Lần 1 | Lần 2 |
| --- | --- | --- |
| Quẹt thẻ | Hi {player}! Your card opens the glass gate down the corridor — just tap it on the reader. | Tap your employee card on the reader by the glass doors and they'll open for you. |
| Phòng FSA | Next stop: the FSA Room, upstairs at the end of the corridor. | Take the stairs behind the card gate — the FSA Room is at the far end upstairs. |
| Vào văn phòng | Your team is waiting in the office — go on through the glass door at the end of the corridor! | The office is right behind the FSA Room's glass door. See you there! |

Ở zone 3, khi đã nhận thẻ và xem Phòng Hạt Lúa (lối ra zone 4): *"Your card is ready to use — the card gate is down the
corridor at the back of the lobby."* / *"Head to the corridor at the back of the lobby — the card gate is just there."*
