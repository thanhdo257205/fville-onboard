# Lời thoại của Ms. Nga

Tài liệu tham khảo lời thoại, game "Ngày Đầu Ở F-Ville" (cập nhật 12/10/2026; nguồn: `data/dialogues.json`). Trong game,
chị Nga làm ở bộ phận Tuyển dụng (Recruitment): chị là người đã liên lạc với người chơi suốt quá trình tuyển, gửi tin nhắn
hẹn xe sáng nay (zone 0), nhắn tin nhắc việc ở zone 3–5, và hôm nay lần đầu gặp người chơi trực tiếp ở văn phòng (zone 5)
với vai **mentor** của intern. Bảng tên trên đầu, tên trong hộp thoại và tên người gửi tin nhắn đều ghi **Ms. Nga**; trong
câu thoại chị tự giới thiệu là **Nga**. Id vai trong dữ liệu là `mentor` (tin nhắn điện thoại dùng người nói `hr`, mượn
chân dung của vai `mentor`).

> Đổi kịch bản 12/10/2026 (người dùng chốt): chị Nga không còn đứng quầy lễ tân zone 3 (thay bằng chị lễ tân hư cấu,
> vai `le_tan`) mà là mentor ở zone 5; Prajith chuyển từ mentor sang quản lý team (vai `manager`).

Mọi chữ trong game là tiếng Anh, chỉ có chữ, không có lồng tiếng. `{player}` là tên người chơi tự đặt ở màn đầu. Cột
"Cử chỉ" là animation nhân vật làm khi nói câu đó. Người chơi gọi chị bằng "you" trong tiếng Anh (bản tiếng Việt sau này
sẽ xưng "em" và gọi "chị").

Cột Ghi chú: **[DRAFT]** = nội dung đang chờ HR xác nhận (giờ xe, quy định), trong game hiện chữ [DRAFT].

> Chị Nga là người thật, đã đồng ý dùng hình (xác nhận 09/10/2026).

## 1. Zone 0 · Điểm đón xe bus (06:30) — tin nhắn điện thoại

Vừa vào zone, điện thoại rung, tin nhắn tự hiện (khung tin nhắn, có chân dung chị Nga).

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | Tin nhắn hẹn xe, tự hiện khi vào zone 0 | Good morning, {player}! It's Nga from Recruitment. Today's shuttle: Bus No. 2 to Hòa Lạc, leaving this stop at 06:45. Your My FPT intern code: FV-2026. See you at F-Ville! | | số xe, giờ đón, mã intern [DRAFT] |

Ở zone 1, trước mini-game Cài app chị Huyền nói thứ tự 3 bước (tải app → đăng nhập bằng mã intern trong tin nhắn này →
bật thông báo); gợi ý của bước đăng nhập nhắc lại tin nhắn: *"Hint: the app is installed — now log in with the intern
code from Ms. Nga's message."*

## 2. Zone 3 · Sảnh tòa nhà (08:00) — tin nhắn

Quầy lễ tân giờ là **chị lễ tân** (nhân vật hư cấu, bảng tên "Receptionist"): chị phát thẻ nhân viên, Welcome Kit, nhận
lại ví bị đánh rơi; lúc chào chị nhắc *"Ms. Nga from Recruitment told me to look out for you."*, lúc nói chuyện lại thì
dặn *"…pop back to reception — or message Ms. Nga in the app!"*.

**Tin nhắn nhắc việc (zone 3–4).** Người chơi chưa làm được việc gì trong 30 giây (không tính lúc hội thoại, mini-game)
mà Tú không đi cùng → chị Nga nhắn một tin ngắn (góc phải trên, không dừng game); mỗi việc tối đa 2 lần, cách nhau 45
giây. Nguồn: `data/guidance.json`. Ở bản hiện tại Tú luôn đi cùng ở zone 3 nên các tin này hiếm khi hiện.

| Việc | Lần 1 | Lần 2 |
| --- | --- | --- |
| Nhận thẻ ở quầy | Reception is right in the lobby — your card is waiting for you there! | Your employee card is ready at reception — go and pick it up! |
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

## 4. Zone 5 · Văn phòng (09:00) — mentor

Vừa vào zone, app báo lịch hẹn rồi chị nhắn (khung tin nhắn, chân dung chị Nga):

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 14 | Lịch hẹn trong app | 📅 09:15 · Meeting with Ms. Nga — mentor meeting room, left side of the office. | | người gửi: app |
| 15 | Tin nhắn của chị | Hi {player}, welcome to the office! It's Nga — and from today I'm your mentor, too. I'm in the meeting room on the left — the door's open. See you in a minute! 🙂 | | |

Chị ngồi ở phòng họp mentor bên trái văn phòng. Lời nhắc khi lại gần: **"Talk to Ms. Nga"**; nhiệm vụ trong app:
**"09:15 · Meet Ms. Nga in the meeting room on the left"**.

| # | Ngữ cảnh | Câu thoại | Cử chỉ | Ghi chú |
| --- | --- | --- | --- | --- |
| 16 | Lần đầu nói chuyện | There you are, {player}! Welcome to the team. Surprise — after all our emails, I'm your mentor for the whole internship. | vẫy tay |  |
| 17 | Tiếp câu 16 | I've welcomed plenty of interns, and every first day looks the same: a morning learning everyone's names, an afternoon hunting for the best coffee on this floor. You'll have both sorted by Friday! |  |  |
| 18 | Trước mini-game La bàn nghề nghiệp (4 câu, không đúng / sai) | Before we plan anything, I'd like to know how you like to work. Four quick questions — there are no right or wrong answers. | chỉ tay |  |
| 19 | Xong La bàn nghề nghiệp | Thanks, {player} — that tells me a lot. Your Career Compass is saved in My FPT. Let's look at it together again at the end of your first month. | gật đầu | thẻ La bàn lưu trong My FPT → Bag; Kết nối +5 |
| 20 | Chỉ sang quản lý | Next, Prajith — our team manager — would like to meet you. His room is next door, just a little further down. |  |  |
| 21 | Nói chuyện lại | Prajith's room is just next door. And I'm right here all day if you have any questions! |  |  |

**Tin nhắn nhắc việc (zone 5)** — Tú đã chia tay ở zone 4 nên ở văn phòng chỉ có tin nhắn của chị:

| Việc | Lần 1 | Lần 2 |
| --- | --- | --- |
| Gặp mentor | Hi {player}, I'm in the meeting room on the left — just walk in! 🙂 | Head down the corridor on the left: I'm in the first meeting room. See you there! |
| Gặp quản lý (Prajith) | Prajith's room is right next to mine — he's expecting you! | Just one door further down from my room. Good luck! 🙂 |

**Lời nhắn ở màn tổng kết** ("A note from Ms. Nga", theo xu hướng chính ở La bàn nghề nghiệp):

| Xu hướng | Lời nhắn |
| --- | --- |
| Builder | {player}, you light up when you're building something. Pick one small thing next week and take it all the way to done — I'll be right behind you. — Nga |
| Problem Solver | {player}, you like getting to the bottom of things — that's a superpower here. Bring me your trickiest question next week! — Nga |
| Team Player | {player}, you think best with others around you. Don't be shy in meetings — your questions will help the whole team. — Nga |
| Explorer | {player}, you learn by trying. Keep experimenting, and share what you find with the team — we'll all learn from it. — Nga |
