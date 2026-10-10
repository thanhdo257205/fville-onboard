# Phiếu ghi nhận buổi chơi thử — "Ngày Đầu Ở F-Ville"

Dùng cho các việc trong `docs/CHECKLIST.md`: chuẩn bị buổi chơi thử, tổ chức buổi chơi thử (ngồi xem, không nhắc), đo hiệu
năng trên laptop Intel, thử 2–3 người chơi cùng lúc, tổng hợp phản hồi thành GitHub Issues.

- **In ra:** phần A (người điều phối giữ 1 bản); phần B–D: **1 bản cho mỗi người chơi**; phần E: 1 bản cho mỗi máy; phần F
  dùng sau buổi.
- **Riêng tư:** phiếu chỉ ghi **mã người chơi** (P1, P2, …) và **mã máy** (M1, M2, …). Không ghi họ tên, email, số điện
  thoại, không chụp ảnh mặt người chơi. Repo công khai — mọi thứ đưa lên GitHub Issues cũng theo quy tắc này.

---

## A. Hướng dẫn cho người điều phối

### A1. Chuẩn bị (trước buổi 1 ngày và 30 phút trước giờ chơi)

| ✓ | Việc |
| --- | --- |
| ☐ | 3–5 người chơi **chưa từng thấy game**; mỗi người một mã P1…P5 |
| ☐ | Ít nhất 1 **laptop Intel UHD / Iris Xe** (không card rời) + các máy khác; chuột rời + bàn phím (game dùng WASD + chuột) |
| ☐ | Cắm sạc mọi laptop (chạy pin thì chậm hơn); tắt ứng dụng nặng; zoom trình duyệt 100% |
| ☐ | Mở link chơi trong **cửa sổ ẩn danh mới cho mỗi người chơi** (Ctrl+Shift+N) để không còn bản lưu cũ: https://thanhdo257205.github.io/fville-onboard/game/ — người chơi đã chơi dở thì **Esc → Play again → Yes, start over** |
| ☐ | Máy đo hiệu năng: mở link có thêm `?debug` (góc màn hình hiện FPS): https://thanhdo257205.github.io/fville-onboard/game/?debug |
| ☐ | Mạng công ty không chặn máy chủ: góc màn hình hiện **"N online · M in this zone"** |
| ☐ | Ghi cấu hình từng máy vào bảng A2 |
| ☐ | Đồng hồ (giờ hệ thống hoặc bấm giờ điện thoại), bút, phiếu đã in |
| ☐ | Người quan sát ngồi chếch phía sau, nhìn được màn hình, không che tầm nhìn người chơi |

### A2. Cấu hình máy

Cách xem: **CPU / RAM** — Settings → System → About; **GPU** — trong game bấm Esc, dòng "Now: Low · <tên GPU>", hoặc
`chrome://gpu`; **trình duyệt** — `chrome://version` (Edge: `edge://version`); **độ phân giải** — Settings → Display.

| Mã máy | CPU | GPU | RAM | Trình duyệt + phiên bản | Độ phân giải / toàn màn hình (F11)? | Cắm sạc? |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | | | | | | |
| M2 | | | | | | |
| M3 | | | | | | |

### A3. Lời dặn trước khi chơi (đọc nguyên văn, không thêm gợi ý)

> Cảm ơn bạn đã tham gia. Đây là bản thử của một game web về ngày đầu đi làm của intern FPT Software ở F-Ville. Hôm nay
> chúng mình thử **game**, không thử bạn — không có cách chơi đúng hay sai.
>
> Bạn cứ chơi như đang ở nhà. Nếu muốn, bạn nói to điều mình đang nghĩ, ví dụ "mình đang tìm…", "chỗ này khó hiểu".
> Trong lúc chơi mình sẽ **không trả lời câu hỏi và không gợi ý**, vì muốn biết game tự hướng dẫn tốt đến đâu. Bạn cứ
> hỏi, mình ghi lại và trả lời sau khi chơi xong.
>
> Game dài khoảng 25–30 phút, chữ trong game là tiếng Anh. Tên nhân vật bạn đặt tùy ý, không cần tên thật. Bạn có thể
> dừng bất cứ lúc nào. Chơi xong có vài câu hỏi ngắn, khoảng 5 phút. Phiếu chỉ ghi mã số, không ghi tên bạn.

### A4. Quy tắc quan sát

- **Không nhắc**, không chỉ tay vào màn hình, không gật / lắc đầu, không phản ứng khi người chơi làm "sai".
- Người chơi hỏi "giờ làm gì?" (hoặc câu tương tự): **ghi nguyên văn câu hỏi + giờ + chỗ**, chỉ đáp: *"Bạn thử theo cách
  bạn nghĩ nhé."*
- **Dừng > 10 giây:** đứng yên, hoặc đi lòng vòng không tiến về mục tiêu, quá 10 giây → ghi chỗ (vd "sảnh, trước cầu
  thang").
- **Chỉ can thiệp khi kẹt > 3 phút** không tiến triển, hoặc lỗi chặn (kẹt trong tường, màn tải treo, bảng lỗi). Can thiệp
  bằng gợi ý nhỏ nhất có thể, rồi ghi **CT** + giờ + đã nói gì.
- Ghi khi người chơi tự dùng: phím **H** (gợi ý), app **My FPT** (phím Tab), menu **Esc**, nút **Skip** ở cảnh chuyển /
  mini-game.
- **Cảm xúc** (ký hiệu dùng trong bảng): **V** vui / cười · **N** ngạc nhiên, thích thú · **B** bối rối · **C** chán, bực
  · **T** tập trung, bình thường.
- Gặp lỗi: chụp màn hình (Win+Shift+S), ghi giờ. Ảnh đưa lên GitHub phải che tên nhân vật nếu người chơi lỡ dùng tên thật.
- Sau mỗi người chơi: ghi xong phiếu, đóng cửa sổ ẩn danh.

---

<div style="page-break-before: always"></div>

## B. Thông tin phiên (1 bản / người chơi)

| Mã người chơi | Ngày | Mã máy | Người quan sát (viết tắt) | Giờ bắt đầu (màn tạo nhân vật) | Giờ thấy màn tổng kết | Tổng thời gian |
| --- | --- | --- | --- | --- | --- | --- |
| P__ | __/__/2026 | M__ | | __:__ | __:__ | ___ phút |

| Hỏi trước khi chơi (khoanh) | |
| --- | --- |
| Hay chơi game 3D trên máy tính? | Thường xuyên · Thỉnh thoảng · Hiếm khi / chưa |
| Vai trò | Intern · Nhân viên mới · Nhân viên lâu năm · Khác |
| Đã từng đến F-Ville? | Có · Chưa |
| Nhân vật đã chọn | Easygoing · Bookworm · Go-getter |
| Vị trí intern đã chọn | Developer · Tester · Business Analyst · Designer |

Màn tạo nhân vật: thời gian ____ giây · ghi chú (đọc được không, xoay nhân vật, đặt tên…): ______________________________

---

## C. Theo dõi theo zone

Cột **Xong**: ✓ = làm được · **T** = có tùy chọn, người chơi bỏ qua · **CT** = phải can thiệp. Thời gian "dự kiến" theo
`docs/GDD.md`. Tên trong ngoặc là chữ hiện trong game.

### Zone 0 · Điểm đón xe bus (City Pickup Stop, 06:30) — dự kiến ~2 phút

Giờ vào: __:__ · Giờ bắt đầu cảnh lên xe: __:__ · Cảnh chuyển (~21 giây): xem hết / bấm Skip

| Mốc | Xong | Dừng > 10 s (chỗ) | "Giờ làm gì?" | Lỗi / kẹt / CT | Cảm xúc |
| --- | --- | --- | --- | --- | --- |
| Đọc tin nhắn của Ms. Nga (Bus No. 2, 06:45) | | | | | |
| Tìm xe số 2: đọc biển trên kính lái / hỏi bác tài xe 1, 3 | | | | | |
| Bắt chuyện với Tú ở mái chờ (tùy chọn) | | | | | |
| Chào Ms. Huyền ở cửa xe số 2 — hỏi __ / 3 câu | | | | | |
| Hành khách mang túi: nhường / chen / không gặp | | | | | |
| Bước qua cửa xe số 2 để lên xe | | | | | |

### Zone 1 · Bến xe F-Ville (F-Ville Bus Stop, 07:30) — dự kiến ~4 phút

Giờ vào: __:__ · Giờ ra: __:__ · Hạt lúa vàng: __ / 2

| Mốc | Xong | Dừng > 10 s (chỗ) | "Giờ làm gì?" | Lỗi / kẹt / CT | Cảm xúc |
| --- | --- | --- | --- | --- | --- |
| Tìm Ms. Huyền, cài App My FPT (mini-game) | | | | | |
| Cảm ơn bác tài (tùy chọn) | | | | | |
| Đọc bản đồ tuyến xe (tùy chọn) | | | | | |
| Tú quên balo (~20 s sau khi xuống xe): tìm ở cửa xe, trả Tú (tùy chọn) | | | | | |
| Mở app My FPT lần đầu (phím Tab) — tự mở? | | | | | |
| Đi dọc vỉa hè tới cổng F-Ville | | | | | |

### Zone 2 · Cổng F-Ville · Giếng Làng · Tượng Cuder (07:40) — dự kiến ~6 phút

Giờ vào: __:__ · Giờ ra: __:__ · Hạt lúa vàng: __ / 3

| Mốc | Xong | Dừng > 10 s (chỗ) | "Giờ làm gì?" | Lỗi / kẹt / CT | Cảm xúc |
| --- | --- | --- | --- | --- | --- |
| Ảnh check-in ở biển FPT SOFTWARE → mặc FPT Orange Shirt | | | | | |
| Kéo nước ở Giếng Làng (3 gầu) — có đọc 3 mẩu chữ? | | | | | |
| Tượng Cuder: đọc câu chuyện (đọc hết / lướt) + quiz 3 câu | | | | | |
| Tìm lối vào tòa nhà | | | | | |

### Zone 3 · Sảnh lễ tân · Phòng Hạt Lúa (Reception · Rice Grain Room, 08:00) — dự kiến ~5 phút

Giờ vào: __:__ · Giờ ra: __:__ · Hạt lúa vàng: __ / 2

| Mốc | Xong | Dừng > 10 s (chỗ) | "Giờ làm gì?" | Lỗi / kẹt / CT | Cảm xúc |
| --- | --- | --- | --- | --- | --- |
| Tìm quầy lễ tân, nói chuyện với Ms. Nga | | | | | |
| Kiểm tra hồ sơ → ảnh thẻ → nhận thẻ + Welcome Kit | | | | | |
| Ví đánh rơi: trả lễ tân / để lại / không thấy | | | | | |
| Phòng Hạt Lúa: Dòng thời gian (5 mốc) | | | | | |
| Hũ thủy tinh (tùy chọn) | | | | | |
| Tìm hành lang sau cầu thang ra cửa quẹt thẻ | | | | | |

### Zone 4 · Cửa quẹt thẻ · Phòng FSA (Card Gate · FSA Room, 08:30) — dự kiến ~5 phút

Giờ vào: __:__ · Giờ ra: __:__ · Hạt lúa vàng: __ / 1

| Mốc | Xong | Dừng > 10 s (chỗ) | "Giờ làm gì?" | Lỗi / kẹt / CT | Cảm xúc |
| --- | --- | --- | --- | --- | --- |
| Quẹt thẻ ("First card tap!") | | | | | |
| Người lạ xin đi ké: cho vào / chỉ ra lễ tân | | | | | |
| Thẻ của Tú báo đỏ: cho đi ké / nhắn Ms. Nga / ra lễ tân | | | | | |
| Lên cầu thang, tìm phòng FSA ở cuối hành lang tầng trên | | | | | |
| Lộ trình học + mục tiêu riêng: chọn __ / "Not now" | | | | | |
| Tú chia tay; qua cửa kính vào văn phòng | | | | | |

### Zone 5 · Văn phòng (Office, 09:00–17:30) — dự kiến ~8 phút

Giờ vào: __:__ · Giờ bắt đầu cảnh kết: __:__ · Hạt lúa vàng: __ / 2

| Mốc | Xong | Dừng > 10 s (chỗ) | "Giờ làm gì?" | Lỗi / kẹt / CT | Cảm xúc |
| --- | --- | --- | --- | --- | --- |
| Đọc tin nhắn 09:15, tìm phòng họp của Prajith | | | | | |
| Prajith: La bàn nghề nghiệp (4 câu) | | | | | |
| Manager: Sắp xếp ưu tiên — hợp lý ngay / sau 1 lần sửa / không → ăn trưa | | | | | |
| Chào Lan, Minh, Hà | | | | | |
| Anh Khang + "Một cú bi-a" (tùy chọn) | | | | | |
| Bàn bi-a chơi một mình (tùy chọn) — chơi ___ phút | | | | | |
| Bàn làm việc: hộp quà → Đăng nhập (mật khẩu + 2FA) → checklist | | | | | |
| Cảnh kết (Lan, 17:30, bến xe, Tú): xem hết / Skip | | | | | |
| Màn tổng kết: đọc kỹ / lướt · bấm Download card? | | | | | |

### Mini-game

Số lần sai: đếm khi thấy thông báo sai / gợi ý. Game tự **hiện gợi ý** sau 8 giây không thao tác, **làm sáng đáp án**
khi sai 2 lần ở cùng bước, **hiện nút Skip** khi sai 3 lần.

| Mini-game | Zone | Số lần sai | Hiện Skip? | Bấm Skip? | Thời gian (ước) | Ghi chú (hiểu luật không, đọc dòng hướng dẫn?) |
| --- | --- | --- | --- | --- | --- | --- |
| Cài app My FPT | 1 | | C / K | C / K | | |
| Ảnh check-in | 2 | — | — | — | | |
| Kéo nước giếng | 2 | | C / K | C / K | | |
| Quiz tượng Cuder | 2 | | C / K | C / K | | |
| Kiểm tra hồ sơ | 3 | | C / K | C / K | | |
| Ảnh thẻ | 3 | — | — | — | | |
| Dòng thời gian | 3 | | C / K | C / K | | |
| Lộ trình học | 4 | | C / K | C / K | | |
| La bàn nghề nghiệp | 5 | — (không có đúng sai) | — | — | | |
| Sắp xếp ưu tiên | 5 | | — | — | | |
| Một cú bi-a (tùy chọn) | 5 | __ cú trượt | C / K | C / K | | |
| Đăng nhập (mật khẩu + 2FA) | 5 | | C / K | C / K | | |
| Checklist ngày đầu | 5 | — | — | — | | |

### Lựa chọn và kết quả (chép từ màn tổng kết)

| Tình huống | Người chơi chọn | Ô giá trị |
| --- | --- | --- |
| Cảm ơn bác tài (zone 1) | Có / Không | Respect |
| Ví đánh rơi (zone 3) | Trả / Để lại / Không thấy | Fairness |
| Người lạ xin đi ké (zone 4) | Cho vào / Chỉ ra lễ tân | Role Model |
| Thẻ của Tú báo đỏ (zone 4) | Đi ké / Nhắn Ms. Nga / Ra lễ tân | Teamwork |
| Mục tiêu học tập riêng (zone 4) | Có / Not now | Innovation |
| Sắp xếp ưu tiên (zone 5) | Hợp lý / Chưa | Wisdom |

Hiểu biết: ____ · Kết nối: ____ · Hạt lúa vàng: __ / 10 · Số ô giá trị sáng: __ / 6 · Danh hiệu chính: ______________

Dùng phím H: ___ lần · Mở app My FPT: ___ lần · Số lần CT: ___

---

<div style="page-break-before: always"></div>

## D. Phỏng vấn sau khi chơi (~5 phút, 1 bản / người chơi)

Đọc câu hỏi, không gợi ý đáp án. Thang 1–5: khoanh số.

| # | Câu hỏi | 1–5 | Câu trả lời mở |
| --- | --- | --- | --- |
| 1 | Trong lúc chơi, bạn có biết mình cần làm gì tiếp theo không? (1 = rất hay bị lạc · 5 = lúc nào cũng biết) Chỗ nào bạn thấy lạc nhất? | 1 2 3 4 5 | |
| 2 | Độ dài của game thế nào? (1 = quá ngắn · 3 = vừa · 5 = quá dài) Đoạn nào thấy dài hoặc chán? | 1 2 3 4 5 | |
| 3 | Chữ và lời thoại tiếng Anh có dễ đọc, dễ hiểu không? (1 = rất khó · 5 = rất dễ) Câu nào khó hiểu hoặc quá dài? | 1 2 3 4 5 | |
| 4 | Bạn nhớ được những giá trị nào trong 6 giá trị của FPT? (người chơi tự kể, không gợi ý; ghi số giá trị nhớ đúng) | ___ / 6 | |
| 5 | Ngoài 6 giá trị, bạn nhớ được gì về văn hóa FPT / F-Ville? (vd Cuder, Làng Công Nghệ, Phòng Hạt Lúa, FSA, quy định quẹt thẻ) | — | |
| 6 | Mini-game nào khó nhất? Mini-game nào thích nhất? Nhìn chung mini-game khó hay dễ? (1 = rất khó · 5 = rất dễ) | 1 2 3 4 5 | |
| 7 | (Nếu đã chơi bi-a) Ngắm và chỉnh lực có dễ không? (1 = rất khó · 5 = rất dễ) Có muốn chơi bi-a với người khác không? | 1 2 3 4 5 | |
| 8 | Sau khi chơi, bạn có thấy tự tin hơn về ngày đầu đi làm thật không? (1 = không · 5 = rất nhiều) Nếu được sửa một điều, bạn sửa gì? | 1 2 3 4 5 | |

Câu hỏi người chơi đã hỏi trong lúc chơi (trả lời bây giờ, ghi lại): ________________________________________________

---

<div style="page-break-before: always"></div>

## E. Hiệu năng (1 bản / máy)

### E1. Đo từng zone trên laptop Intel

Đo **sau** khi người chơi chơi xong (lệnh benchmark quay camera một vòng, làm phiền người chơi), trên cùng máy, cửa sổ ẩn
danh mới:

1. Zone 0: mở https://thanhdo257205.github.io/fville-onboard/game/?debug, tạo nhân vật, đứng ở chỗ bắt đầu.
2. Zone 1–5: mở `…/game/?debug&start=zone_01` (… `zone_05`; tạo nhân vật nếu game hỏi): game dựng sẵn bản lưu "đã
   xong các zone trước" và ghi đè bản lưu của cửa sổ đó.
3. Chờ zone tải xong khoảng 10 giây, đứng yên. Bấm F12 → Console (Chrome có thể yêu cầu gõ `allow pasting` trước khi
   dán), gõ `__game.benchmark(120)` → ghi `ms` và `fps`.
4. Gõ `__game.state.detailLevel` → ghi nấc Detail game đã tự hạ: **0** = độ phân giải đầy đủ, có viền · **1** = độ phân
   giải thấp hơn, có viền · **2** = độ phân giải thấp hơn, không viền.
5. Đi lại khoảng 20 giây, ghi FPS ở góc màn hình (thấp nhất / thường thấy).

Trong lúc người chơi chơi trên máy này: ghi lại nếu thấy thông báo **"Detail lowered to keep things smooth"** (giờ, zone).

Mã máy: M__ · Detail trong menu Esc: Auto / Sharper / Faster · Graphics: Low

| Zone | benchmark `ms` | benchmark `fps` | FPS khi đi lại (thấp nhất / thường) | `detailLevel` | Thấy "Detail lowered" lúc chơi? (giờ) | Ghi chú (giật, tải lâu…) |
| --- | --- | --- | --- | --- | --- | --- |
| 0 · City Pickup Stop | | | / | | | |
| 1 · F-Ville Bus Stop | | | / | | | |
| 2 · Cổng · Giếng · Tượng Cuder | | | / | | | |
| 3 · Sảnh · Phòng Hạt Lúa | | | / | | | |
| 4 · Cửa quẹt thẻ · Phòng FSA | | | / | | | |
| 5 · Văn phòng | | | / | | | |

Thời gian mở game (từ lúc bấm link tới màn tạo nhân vật): ____ giây · Tải mỗi zone (màn "Heading to …"): ____ giây

### E2. 2–3 người chơi cùng lúc (bản thật, mạng công ty)

1. 2–3 máy mở link có `?debug`, cùng vào một zone (nên thử zone 2 — rộng, và zone 4 — hẹp, có cầu thang).
2. Kiểm tra góc màn hình: "N online · M in this zone"; thấy nhân vật + bảng tên người khác; bấm **T** để vẫy tay / chọn câu
   chat soạn sẵn.
3. Trên từng máy: **Esc → Show other players: On**, đứng yên 10 giây, `__game.benchmark(120)`, ghi FPS góc màn hình;
   rồi **Off**, đo lại.

| Mã máy | Zone | Số người cùng zone | On: benchmark ms / fps | On: FPS góc màn hình | Off: benchmark ms / fps | Off: FPS góc màn hình | Thấy nhau? Vẫy tay / chat được? | Ghi chú (giật, nhân vật nhảy, mất kết nối) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M__ | | | / | | / | | | |
| M__ | | | / | | / | | | |
| M__ | | | / | | / | | | |

---

## F. Tổng hợp phản hồi thành GitHub Issues

Làm trong vòng 1–2 ngày sau buổi chơi (CHECKLIST: "Tổng hợp phản hồi thành danh sách việc sửa").

### F1. Gom và gộp

1. Chép mọi quan sát từ các phiếu vào một bảng chung, mỗi quan sát một dòng: **zone · mô tả ngắn · mã người chơi · loại**.
2. Gộp những dòng cùng một vấn đề; ghi số người gặp (vd "3/5: P1, P2, P4").
3. Mỗi vấn đề đã gộp = **1 issue**. Ý kiến khen cũng ghi lại (giữ những gì đang tốt), không cần thành issue.

### F2. Nhãn và mức ưu tiên

| Nhãn | Dùng khi |
| --- | --- |
| `bug` | Lỗi: kẹt trong tường, màn tải treo, bảng lỗi, việc không hoàn thành được, chữ hiện sai / thiếu |
| `ux` | Khó hiểu, lạc đường, không thấy mục tiêu, điều khiển khó, luật mini-game không rõ |
| `content` | Lời thoại, thông tin văn hóa / công ty, nội dung [DRAFT], câu quá dài, chính tả |
| `perf` | FPS thấp, giật, tải chậm, Detail tự hạ, chơi nhiều người làm chậm máy |

Thêm nhãn zone nếu cần (`zone-0` … `zone-5`). Repo chưa có nhãn thì tạo ở GitHub → Issues → Labels.

| Mức | Khi nào | Làm khi nào |
| --- | --- | --- |
| **P1** | Chặn tiến trình (phải CT, kẹt > 3 phút, lỗi không chơi tiếp được), hoặc từ một nửa số người chơi trở lên gặp | Trước buổi chơi thử tiếp theo / trước khi gửi cho intern |
| **P2** | Gây bối rối hoặc chậm rõ rệt nhưng người chơi tự vượt qua; 2 người trở lên gặp | Sau P1 |
| **P3** | Góp ý nhỏ, ý thích cá nhân, chỉ 1 người gặp | Khi rảnh |

### F3. Mẫu một issue

```
Tiêu đề: [zone 3] Người chơi không thấy lối ra hành lang tới cửa quẹt thẻ

Quan sát: 3/5 người (P1, P2, P4) đứng ở sảnh > 30 giây sau khi nhận thẻ, hỏi "giờ đi đâu?";
P2 phải can thiệp sau 3 phút.
Bước tái hiện: nhận thẻ ở quầy → xem Phòng Hạt Lúa → tìm lối ra zone 4.
Mong đợi: thấy dấu "!" / mũi tên dẫn ra hành lang sau cầu thang.
Thực tế: dấu "!" bị cầu thang che khi đứng cạnh quầy.
Máy: M1 (Intel Iris Xe, Chrome 1xx, 1920×1080).
Ảnh: (ảnh màn hình game, đã che tên nhân vật nếu là tên thật)
Đề xuất: …
Nhãn: ux, zone-3 · Mức: P1
```

### F4. Lưu ý

- Không ghi tên thật, email, ảnh mặt người chơi; chỉ mã P1, P2… và mã máy.
- Số liệu hiệu năng (phần E) ghi vào issue `perf` hoặc bổ sung vào `docs/perf_report.md`.
- Câu hỏi về nội dung chờ HR (giờ xe, 6 giá trị, Welcome Kit…) gom vào `docs/hr_content_request.md`, không mở issue riêng.
- Sau khi tạo xong issue: cập nhật dòng "Tổng hợp phản hồi…" trong `docs/CHECKLIST.md` (số issue, link).
