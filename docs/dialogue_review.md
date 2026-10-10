# Rà lời thoại tiếng Anh — "Ngày Đầu Ở F-Ville"

Rà ngày 10/10/2026, theo việc "Rà lại toàn bộ lời thoại tiếng Anh (chính tả, giọng văn, độ dài câu)" trong
`docs/CHECKLIST.md`. Đã đọc toàn bộ khoảng 870 chuỗi chữ hiển thị: `data/i18n/en.json` và các trường `{ "en": … }` trong
`data/*.json` (dialogues, interactables, quests, quiz, rewards, values, guidance, acts, achievements, zones, characters,
net). Đã sửa 42 chuỗi trong 8 file; `npm run test:data` đạt hết.

## Nguyên tắc đã áp dụng

- **Chỉ sửa giá trị chữ.** Không đổi id, key, cấu trúc, `next`, điều kiện, `values`, phần thưởng, `draft`. Nội dung
  `[DRAFT]` chỉ sửa câu chữ (độ dài, chính tả), không đổi thông tin.
- **Độ dài:** mỗi câu thoại (một node) tối đa khoảng 30 từ, câu lựa chọn của người chơi tối đa khoảng 12 từ (đếm theo khoảng trắng, tính cả gạch ngang và emoji). Sau khi
  rà: mọi câu thoại ≤ 30 từ; câu lựa chọn dài nhất 11 từ. Ngoại lệ có chủ ý: câu chuyện tượng Cuder (`quiz.json` →
  `story`, 4 đoạn, hiện trong khung đọc riêng, nội dung của mentor — giữ nguyên).
- **Giọng văn:** tiếng Anh tự nhiên, thân thiện, ngắn; tránh lặp cùng một câu ở nhiều nhân vật liền nhau ("lifesaver",
  "Welcome to the team", "Time to head home").
- **Chính tả:** thống nhất **tiếng Anh Mỹ** (đa số chữ trong game đã là Mỹ: windshield ×10, sidewalk ×5) → sửa
  organise → organize, neighbours → neighbors, Practise → Practice.
- **Dấu câu:** dấu ba chấm thống nhất là ký tự `…` (trước đây lẫn `...` và `…`); trích dẫn trong câu dùng nháy kép
  `"…"` (bỏ nháy đơn); không dùng dấu phẩy Oxford trong danh sách ngắn ("Lan, Minh and Hà" — kiểu đa số đang dùng).
- **Placeholder** `{player}`, `{tu_his}`, `{grains}`, `{missing}`… giữ nguyên; mọi chữ nói về Tú vẫn dùng `{tu_*}`.
  Phím `[E]`, `H`, `Space`, `1–3`… giữ nguyên.
- **Tên riêng** giữ dấu: Tú, Huyền, Nga, Hà, Hòa Lạc, Hà Nội, F-Ville, Làng Công Nghệ.
- **Người thật** (Ms. Huyền, Ms. Nga, Prajith): chỉ rút gọn, không thêm chi tiết cá nhân.
- Không đụng chữ mà kiểm thử smoke so khớp: lời nhắc **"Play pool"**, thành tựu **"Welcome to the F-Ville Family"**.

## Các câu đã đổi (trước → sau)

Không liệt kê những chỗ chỉ đổi `...` → `…` (7 chỗ: Tú, hành khách, Tú quên balo, gợi ý của Tú ở zone 0).

| # | Chỗ (file → id) | Trước | Sau | Lý do |
| --- | --- | --- | --- | --- |
| 1 | dialogues → `hr_message.n1` [DRAFT] | Good morning, {player}! It's Nga from Recruitment. Your shuttle today is Bus No. 2 to Hòa Lạc — pickup at 06:45 at this stop. Your intern code for the My FPT app: FV-2026. See you at F-Ville! | Good morning, {player}! It's Nga from Recruitment. Today's shuttle: Bus No. 2 to Hòa Lạc, leaving this stop at 06:45. Your My FPT intern code: FV-2026. See you at F-Ville! | 37 → 30 từ; giữ đủ số xe, giờ, mã intern |
| 2 | dialogues → `bien_xe_2.n1` | A big amber "2" on the windshield — this is the bus to Hòa Lạc! | A big amber "2" glows on the windshield — this is the bus to Hòa Lạc! | thành câu đủ, song song với biển số 1 và 3 |
| 3 | dialogues → `tu_bat_chuyen.n1` | Are you an intern in this batch too? I'm Tú. I'm so nervous... I don't even know where to go after we get off the bus. | Are you a new intern too? I'm Tú. I'm so nervous… I don't even know where to go once we get off the bus. | câu mở đầu tự nhiên hơn (dịch sát "intern đợt này") |
| 4 | dialogues → `card_gate.s_in` | Thanks, you're a lifesaver! | Thanks — you're a star! | Tú cũng nói "lifesaver" khi nhận balo; tránh lặp |
| 5 | dialogues → `card_gate.tu_follow2` (Ms. Huyền nhắn) | {player}, I saw Tú come in on your card. 🙂 Even friends shouldn't follow each other through the gate — if a card doesn't work, message Ms. Nga in the app and she'll sort it out. | {player}, I saw Tú come in on your card. 🙂 Even friends should each tap their own. If a card doesn't work, just message Ms. Nga in the app! | 36 → 29 từ; giữ đủ 2 ý: tự quẹt thẻ, thẻ lỗi thì nhắn Ms. Nga |
| 6 | dialogues → `le_tan_main.after` (Ms. Nga) | Your card opens the gates upstairs. If anything comes up today, just message me in the app! | Your card opens the card gate down the corridor. If anything comes up today, just message me in the app! | sửa vị trí: cửa quẹt thẻ ở tầng trệt, cuối hành lang (zone 4), không phải "upstairs"; câu cũng chỉ đường luôn |
| 7 | dialogues → `wallet_found.take` | You picked up the wallet. | You pick up the wallet. | lời dẫn cả game dùng thì hiện tại |
| 8 | dialogues → `jar_look.n1` | You've found {grains} of {grains_total} — more are hidden around F-Ville. | You've found {grains} of the {grains_total} hidden around F-Ville. | câu cũ sai khi đã nhặt đủ 10 hạt ("more are hidden") |
| 9 | dialogues → `mentor_main.n2` (Prajith) | I still remember my own first day here: I spent the morning learning everyone's names, and the afternoon finding the best coffee on this floor. You'll have both sorted by Friday! | I still remember my first day here: a morning learning everyone's names, an afternoon hunting for the best coffee on this floor. You'll have both sorted by Friday! | 31 → 28 từ, cùng ý |
| 10 | dialogues → `manager_main.n3` | Your first week doesn't need anything big. But I'd like to see how you'd organise your work. | You don't need to do anything big in your first week. But I'd like to see how you'd organize your work. | câu cũ dịch sát ("tuần đầu chưa cần làm gì lớn"); chính tả Mỹ |
| 11 | dialogues → `manager_main.n4` | Here are five tasks for your first week. Put them in order — the most urgent at the top, the one that can wait at the bottom — then press Check. | Here are five tasks for your first week. Put the most urgent at the top and the one that can wait at the bottom, then press Check. | 31 → 27 từ, bỏ hai gạch ngang |
| 12 | dialogues → `manager_main.n5` | …finish the mandatory information security course today. | …finish the mandatory Information Security course today. | viết hoa giống thẻ việc và Nhiệm vụ đầu tiên |
| 13 | dialogues → `ha_hello.n1` | Hi, I'm Hà! Welcome to the team, {player}. | Hi, I'm Hà! So glad you're joining us, {player}. | Prajith và Manager vừa nói "Welcome to the team" |
| 14 | dialogues → `khang_main.n2` | Fancy a single shot of billiards? Aim, pick your power, and try to sink the orange ball. | Fancy a quick shot at pool? Aim, pick your power and try to sink the orange ball. | thống nhất "pool" (xem Thuật ngữ) |
| 15 | dialogues → `khang_main.tip` | …good ideas often turn up over a game of billiards. | …good ideas often turn up over a game of pool. | như trên |
| 16 | dialogues → `ending_lan.n0` (app) | ⏰ 17:30 — that's a wrap for today! Time to head home. | ⏰ 17:30 — that's a wrap for today! | Lan nói ngay sau "Time to head home", rồi thẻ chữ "17:30 · Time to head home" — 3 lần liền |
| 17 | dialogues → `z5_app_meeting.n1` | …Meeting with Prajith — Mentor meeting room, on the left side of the office. | …Meeting with Prajith — mentor meeting room, left side of the office. | gọn kiểu thông báo lịch |
| 18 | interactables → `learning_path.line` [DRAFT] | Put the three suggested courses on your first-week calendar, basics first — drag a card onto the calendar, or click it / press 1–3 to place it on the next free day. | Put the three courses on your first-week calendar, basics first: drag a card onto the calendar, or click it / press 1–3 to fill the next free day. | 32 → 28 từ |
| 19 | interactables → `timeline.items[4]` [DRAFT] | FPT Software celebrates 20 years | FPT Software celebrates its 20th birthday | song song với "FPT celebrates its 30th birthday"; gợi ý trong trò gọi cả hai là "birthdays" |
| 20 | interactables → `well.snippets` [DRAFT] | 'tech village' … neighbours … / 'Làng Công Nghệ' means… | "tech village" … neighbors … / "Làng Công Nghệ" means… | nháy kép, chính tả Mỹ; nội dung giữ nguyên |
| 21 | guidance → `z4_fsa.help` | Go through the card gate and take the stairs up one floor. The FSA Room is… | Go through the card gate and up the stairs. The FSA Room is… | 31 → 28 từ |
| 22 | guidance → `z0_meet_thao.phone[1]` (Ms. Huyền) | …I'm the one in the orange FPT shirt by the bus door. | …I'm the one in the FPT orange shirt by the bus door. | cùng thứ tự chữ với tên phần thưởng "FPT Orange Shirt" |
| 23 | guidance → `z5_khang.help` | …by the billiard table… Optional — but he has good advice (and a billiard challenge). | …by the pool table… It's optional — but he has good advice (and a pool challenge). | "pool"; thành câu đủ |
| 24 | quests → `z1_thank_driver` | Say thanks to the bus driver | Thank the bus driver | gọn |
| 25 | quests → `z5_khang` | Take a break with Khang at the billiard table | Take a break with Khang at the pool table | "pool" |
| 26 | values → `innovation.how` [DRAFT] | …in the FSA room. | …in the FSA Room. | viết hoa như tên địa điểm ở mọi chỗ khác |
| 27 | acts → `act2` | Becoming a FSofter | Becoming an FSofter | ngữ pháp: "FSofter" đọc "ef-softer" → "an". Tên Act do mentor góp ý — xem mục cần quyết |
| 28 | quiz → `cuder.questions[1].explain` | Vietnam grew up farming the land. Cuder's pickaxe carries… | Vietnam's roots are in farming. Cuder's pickaxe carries… | câu cũ không tự nhiên; câu giải thích do nhóm viết, không phải chữ của mentor |
| 29 | i18n → `zones.zone_01.title` | Bus Stop | F-Ville Bus Stop | phân biệt với zone 0 "City Pickup Stop"; hiện trong "Heading to …", "Back to …" |
| 30 | i18n → `creator.preview_shirt` | Preview FPT shirt | Preview FPT Orange Shirt | gọi đúng tên phần thưởng |
| 31 | interactables → `career_compass.line` | …Click an answer or press 1–2. | …Click an answer or press 1 or 2. | giống câu nhắc khi đứng yên của cùng trò |
| 32 | interactables → `learning_path.goals[0]` [DRAFT] | Practise English for work — 15 minutes a day | Practice English for work — 15 minutes a day | chính tả Mỹ |

Sửa nhỏ khác: bỏ dấu phẩy thừa trước "and" ở `profile_check.hint_find` ("your position and the bus…") và
`manager_main.after` ("Settle in and say hello to everyone!").

Tài liệu cập nhật theo: `docs/dialogue_huyen.md` (câu 18, tin nhắn "Chào chị Huyền" lần 2), `docs/dialogue_nga.md`
(câu 1, câu 9), `docs/GDD.md` (bảng 4 Act: BECOMING AN FSOFTER).

## Thuật ngữ đã thống nhất

| Thuật ngữ | Dùng trong game | Ghi chú |
| --- | --- | --- |
| Áo Cam FPT | **FPT Orange Shirt** (tên vật phẩm); "FPT orange" khi tả màu áo | Không dùng "orange FPT shirt", "FPT shirt" |
| Bi-a | **pool**, **pool table** | Đa số chữ cũ là "billiard(s)" (5 chỗ) so với "pool" (3 chỗ), nhưng chọn **pool** vì: đúng tên trò bi lỗ trong tiếng Anh; giao diện chơi một mình đã là "Pool", "Rerack", "Potted"; lời nhắc "Play pool" được smoke test so khớp. Id `minigames.billiards`, cờ `billiards_*` giữ nguyên |
| Bi trắng | **white ball** | Không dùng "cue ball" (người mới dễ hiểu hơn) |
| Xe bus | **Bus No. 2**, "the bus to Hòa Lạc", "shuttle" | Giờ viết 24 giờ: 06:45, 17:30 |
| Bến xe zone 1 | **F-Ville Bus Stop** (tên zone) | Zone 0: City Pickup Stop |
| Cửa quẹt thẻ | **card gate** (trong câu), **Card Gate** (tên mục checklist, tên zone) | Cửa kính: "glass doors" |
| Phòng FSA | **FSA Room**; FSA = FPT Software Academy | Không viết "FSA room" |
| Phòng Hạt Lúa | **Rice Grain Room** | |
| Giếng làng | **Village Well** (tên địa điểm) | "a real village well" khi tả |
| Tượng Cuder | **Cuder Statue** | |
| Thẻ nhân viên | **employee card**; tên vật phẩm **FPT Employee Card** | |
| Hạt lúa vàng | **golden grain(s)**, hũ: **glass jar** | |
| Lời khuyên | **Advice Book** (tab, phần thưởng), "tip" (một lời khuyên) | |
| Các tên vật phẩm khác | My FPT App, Welcome Kit, Learning Notebook, Career Compass, First Mission, Team Welcome Gift, Teamwork Spirit Badge | Viết hoa như tên riêng |
| Khóa An toàn thông tin | **Information Security course** | Viết hoa ở cả 3 chỗ |
| Xác thực hai lớp | **two-factor authentication**, sau đó **2FA** | |
| Người thật | **Ms. Huyền**, **Ms. Nga** trong lời nhắc, nhiệm vụ, lời người chơi và lời Tú; "Huyền", "Nga" khi tự giới thiệu hoặc đồng nghiệp gọi nhau; **Prajith** (không "Mr.") | Vai `thao` = Ms. Huyền, `le_tan` / `hr` = Ms. Nga |
| Nhân viên FPT Software | **FSofter** (mạo từ "an FSofter") | |
| Chính tả | Tiếng Anh Mỹ | organize, neighbors, practice (động từ) |

## Điểm cần mentor / HR quyết (chưa tự đổi)

1. **Tên tiếng Anh 6 giá trị [DRAFT]:** Respect (Tôn trọng), Innovation (Đổi mới), Teamwork (Đồng đội), Fairness (Chí
   công), Role Model (Gương mẫu), Wisdom (Sáng suốt). "Chí công" → "Fairness" và "Sáng suốt" → "Wisdom" là cách dịch của
   nhóm; cần tên chính thức. Tên huy hiệu "Tôn Đổi Đồng Chí Gương Sáng" đang để nguyên tiếng Việt trong bản tiếng Anh —
   HR quyết giữ hay có tên tiếng Anh.
2. **Tượng Cuder cầm "pickaxe" (cuốc chim) hay "hoe" (cuốc làm ruộng)?** Đang là "pickaxe" ở câu chuyện, câu hỏi 2 và
   câu giải thích. Ý nghĩa "gốc nông nghiệp" hợp với "hoe" hơn; chờ mentor.
3. **Cách đạt ô Respect** (`values.json` → `respect.how`, [DRAFT]): "Thank the bus driver and let others get off first."
   Trong game chỉ có **cảm ơn bác tài** (zone 1) mới sáng ô này; nhường hành khách ở zone 0 là lúc **lên** xe và chỉ cộng
   Kết nối +3, không có ô giá trị. Cần chọn: sửa câu thành chỉ cảm ơn bác tài, hoặc gắn thêm ô Respect cho lựa chọn nhường
   hành khách (đổi dữ liệu, không chỉ chữ).
4. **Trùng tên:** danh hiệu "The Explorer" (nhặt đủ hạt lúa) trùng xu hướng "The Explorer" của La bàn nghề nghiệp — cả hai
   cùng hiện ở màn tổng kết; danh hiệu "F-Ville Bookworm" gần trùng ngoại hình "Bookworm" ở màn tạo nhân vật. Đề xuất đổi
   danh hiệu thành "F-Ville Explorer" (song song "F-Ville Bookworm", "F-Ville Intern") hoặc "Grain Hunter"; GDD cũng cần
   sửa theo.
5. **Tên Act 2:** đã sửa "Becoming a FSofter" → "Becoming an FSofter" (ngữ pháp). Tên 4 Act theo góp ý của mentor; nếu
   mentor muốn giữ cách viết cũ thì đổi lại một dòng trong `data/acts.json`.
6. **"Teamwork Spirit Badge"** (huy hiệu ở giếng làng) và ô giá trị **"Teamwork"** dễ bị hiểu là một. Có thể đổi tên huy
   hiệu (vd "Village Well Badge") nếu thấy người chơi thử nhầm.
7. **Tú ở cảnh kết** (`ending_tu.some`): "…See you tomorrow!" rồi ngay sau đó "Our bus is here — let's go home!" (hai bạn
   về cùng xe). Giữ nguyên vì GDD trích nguyên câu; nếu muốn mượt hơn thì bỏ "See you tomorrow!".
8. **Ms. Huyền "See you upstairs!"** (zone 1) — sau đó chị không xuất hiện trực tiếp nữa, chỉ nhắn tin. Có thể đổi thành
   "See you later!" nếu chị không có mặt ở văn phòng zone 5.
9. **Manager chưa có tên** (hiện "Manager"). Nếu team muốn đặt tên hư cấu, cần đổi ở `characters.json` → `names` và các
   câu "the manager" trong `dialogues.json`, `guidance.json`, `quests.json`.
10. **Nội dung [DRAFT] khác** (giờ xe, quy định xe, bản đồ tuyến, giếng làng, 5 mốc, FSA, mục tiêu team, hộp quà, mật khẩu)
    chỉ sửa câu chữ, giữ thông tin tạm — chờ HR theo `docs/hr_content_request.md`.
