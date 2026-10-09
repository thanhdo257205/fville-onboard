# Báo cáo hiệu năng — bản web

Đo lần đầu ngày 09/10/2026 trên bản đã deploy (`https://thanhdo257205.github.io/fville-onboard/game/`, gh-pages build từ `main`
8996537 trở về sau), đồ họa **Thấp** (game tự chọn: GPU tích hợp → Thấp). Lần đo đầu chỉ đo, không sửa code; mục
"Sau khi sửa" là kết quả sau khi làm đề xuất 1–3.

## Kết luận nhanh

- **Không zone nào dưới 30 FPS**, ở cả 1920×1010 và 1366×768. Khung 1 giây tệ nhất là 61 FPS (zone 1, 1920).
- Chrome **không dùng card rời RTX 3060** mà vẽ bằng **GPU tích hợp AMD Radeon** (Vega 8 trong Ryzen 9 5900HS), dù game
  đã xin `powerPreference: "high-performance"`. Card tích hợp vẫn đủ: GPU chỉ mất 1,5–4 ms để vẽ một khung.
- Vấn đề thấy được là **giật lúc vừa vào zone** (một khung 320–380 ms ở zone 1 và zone 2), do biên dịch shader.
  - Đính chính: đo kỹ ở lần sau cho thấy **lần nào vào zone cũng giật**, không riêng lần đầu. Khi rời zone, three.js huỷ
    shader của zone đó, nên vào lại phải biên dịch lại.
  - **Đã sửa:** xem mục "Sau khi sửa" ngay dưới.
- Máy đo này mạnh hơn laptop văn phòng mà GDD nhắm tới; cần đo thêm trên một máy Intel UHD/Iris Xe (xem cuối báo cáo).

## Sau khi sửa (đề xuất 1–3, 09/10/2026)

**Phần đã làm:**
- Biên dịch shader trước khi hiện zone.
- Bản build bỏ bước đối chiếu node GLB; tải trước file zone đầu, GLB nhân vật và bộ giải nén trong lúc người chơi điền
  tên.
- Thêm nấc hạ độ nét khi FPS thấp và tuỳ chọn **Detail** trong menu Esc.

**Cách đo (trước / sau):**
- Bản build trước: `main` 27f0840. Bản build sau: bản này.
- Cả hai được phục vụ qua `scripts/tools/slow_server.py`, trễ 0,3 s mỗi file, giống thời gian GitHub Pages trả file đo
  ở dưới.
- Máy và GPU giữ nguyên: AMD Radeon tích hợp.
- Hai trình duyệt:
  - **Thời gian mở game:** đo trong trình duyệt tích hợp của ứng dụng Claude (Chromium 152, cùng GPU). Tab Chrome bị ẩn
    trong lúc đo, nên Chrome chỉ cho bộ hẹn giờ chạy khoảng 1 s một lần và làm tròn số đo; phần này đã đo lại bằng trình
    duyệt tích hợp.
  - **Khung giật và `__game.benchmark`:** đo trong Chrome 154. Hai phép đo này đồng bộ (vẽ rồi `readPixels`) nên không
    bị ảnh hưởng.

### Mở game (người chơi mới, mất 4 s điền tên)

| | Trước | Sau |
| --- | --- | --- |
| Lần đầu (bộ nhớ đệm trống): mở trang → màn tạo nhân vật | 3,33 s | **1,71 s** |
| Lần đầu: bấm Start → chơi được | 1,35 s | **0,58 s** |
| Lần đầu: khung hình đầu tiên sau khi vào | **960 ms** (đứng hình) | 22 ms |
| Lần sau (đã có bộ nhớ đệm): mở trang → màn tạo nhân vật | 0,43–0,46 s | 0,40–0,43 s |
| Lần sau: bấm Start → chơi được | 0,50–0,57 s | 0,55–0,76 s (gồm 0,18–0,22 s biên dịch shader sẵn) |
| Lần sau: khung hình đầu tiên | 256–277 ms | 14–31 ms |

**Lần đầu (bộ nhớ đệm trống):**
- Bản trước tải lần lượt 4 GLB zone trước khi hiện màn tạo nhân vật (1,93 → 3,16 s). Bấm Start xong mới tải lần lượt
  GLB nhân vật, bộ giải nén Draco, GLB nhân vật tiếp theo (mỗi file ~0,3 s), rồi đứng hình gần 1 s ở khung đầu.
- Bản sau tải song song bộ giải nén Draco, `zone_00` và 3 GLB nhân vật (1,95 → 2,31 s) trong lúc người chơi điền tên.
- Từ lúc bấm Start tới lúc hình chạy mượt: khoảng **2,3 s → 0,6 s**.

**Lần sau (đã có bộ nhớ đệm):** tổng thời gian tới khung mượt đầu tiên gần như bằng nhau (~0,8 s). Khác biệt là bản sau
không còn khung đứng hình.

**Các zone sau `zone_00`:** bản sau không còn tải sẵn mọi zone lúc mở game. Thay vào đó, 2 s sau khi vào một zone, game
tải sẵn GLB của zone kế tiếp vào bộ nhớ đệm HTTP (`prefetchNext`).

### Vào zone (Chrome 154, 1920×1010)

Ngay sau khi vào zone, xoay camera một vòng 36 khung quanh người chơi:

| Zone | Trước: khung đầu / dài nhất | Trước: shader biên dịch lúc chơi | Trước: thời gian vào | Sau: khung đầu / dài nhất | Sau: shader biên dịch lúc chơi | Sau: thời gian vào (gồm biên dịch sẵn) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 · Bến xe | **285** / 285 ms | 10 | 0,37 s | 12 / 36 ms | 0 | 0,31 s (87 ms) |
| 2 · Cổng | **90** / 90 ms | 5 | 0,34 s | 11 / 14 ms | 0 | 0,48 s (76 ms) |
| 3 · Sảnh | **135** / 135 ms | 7 | 0,91 s | 10 / 15 ms | 0 | 0,65 s (80 ms) |
| 0 · Điểm đón (vào lại) | **174** / 174 ms | 8 | 0,22 s | 11 / 13 ms | 0 | 0,31 s (73 ms) |

**Cách biên dịch sẵn (`renderer.warmup` trong `game/src/render/renderer.js`):** chạy lúc màn chờ hoặc màn tối còn che.
1. Gọi `renderer.compile(scene, camera)` cho mọi chất liệu đang hiện: toon, cây mờ `seeThrough`, nhân vật có tint. Bước
   này không phụ thuộc hướng camera.
2. Vẽ 1 khung với mọi vật, tạm bỏ cắt theo tầm nhìn, để biên dịch shader viền nét (OutlineEffect tạo chất liệu viền lúc
   vẽ) và đưa texture lên GPU.

**Không dùng `compileAsync` như đề xuất ban đầu.** Đã thử trên máy này:
- `compileAsync` phải chờ `KHR_parallel_shader_compile` báo xong, mất **0,37–0,88 s** mỗi lần vào zone.
- `compile()` đồng bộ cộng 1 khung vẽ chỉ mất **48–64 ms** (lần đầu trong trang 0,15–0,47 s), và cũng hết giật như nhau.

Màn chờ đang che nên việc chặn luồng chính trong lúc này không ảnh hưởng người chơi.

### Khung hình đều (`__game.benchmark(120)`, Chrome 154, 1920×1010)

Số dưới đây là ms/khung, trung bình 2 lần chạy; giữa các lần chênh nhau tới khoảng ±30 % vì GPU tích hợp tự đổi xung
nhịp.

| Zone | Trước (đủ nét) | Sau · nấc 0: đủ nét | Sau · nấc 1: pixelRatio 1,0 | Sau · nấc 2: + tắt viền nét |
| --- | --- | --- | --- | --- |
| 0 | 9,9 | 10,2 | 8,6 | 7,6 |
| 1 | 11,4 | 10,9 | 8,9 | 7,5 |
| 2 | 7,5 | 10,5 | 7,7 | 7,8 |
| 3 | 10,2 | 14,1 | 9,0 | 7,7 |

**Nấc 0** vẽ y hệt bản trước; độ chênh trong bảng là nhiễu đo. Lấy trung bình nấc 0 của cả hai bản (10,5 ms):
- **Nấc 1** nhẹ hơn khoảng **19 %**.
- **Nấc 2** nhẹ hơn khoảng **27 %**.

### Nấc hạ độ nét và menu Esc → Detail

**Detail = Auto (mặc định):**
- Chỉ áp dụng khi đã ở mức đồ hoạ Thấp. Nếu FPS trung bình (3 s khởi động + 5 s đo) dưới **45**, game hạ một nấc:
  1. pixelRatio 1,25 → 1,0;
  2. tắt viền nét.
- Mỗi lần hạ có thông báo *"Detail lowered to keep things smooth (Esc → Detail)."*
- Hạ xong thì đo lại. Nấc nào không thay đổi gì thì bỏ qua: màn hình có `devicePixelRatio` 1 hạ thẳng từ nấc 0 xuống
  nấc 2.
- Không tự tăng nét lại trong phiên chơi.

**Sharper:** luôn ở nấc 0. **Faster:** luôn ở nấc 2. Lựa chọn được lưu trong `fville.settings` → `detail`.

**Đã thử:**
- Giả FPS thấp (đặt ngưỡng 1000) trên Chrome với DPR 1,25:
  - nấc 0 → 1: khung vẽ 1920 → 1536 px, có thông báo;
  - nấc 1 → 2: tắt viền nét;
  - sau đó dừng ở nấc 2.
- Giả DPR 1: hạ thẳng 0 → 2.
- Menu: hàng Detail hiện giữa Graphics và Objective markers.
  - Bấm Sharper: pixelRatio 1,25 + viền nét, có lưu vào bộ nhớ trình duyệt.
  - Bấm Faster: pixelRatio 1,0, tắt viền nét.
  - Bấm Auto: quay về nấc Auto đã tự hạ trong phiên.
- Console bản build chỉ có dòng `[kiểm tra dữ liệu] OK — bản build: bỏ đối chiếu node GLB`.
- Bản dev vẫn đối chiếu đủ node GLB (58 tham chiếu, 0 lỗi).

## Máy và cách đo

| Hạng mục | Giá trị |
| --- | --- |
| CPU | AMD Ryzen 9 5900HS (8 nhân), RAM 15,4 GB |
| GPU có trên máy | AMD Radeon Graphics (tích hợp, Vega 8 / gcn-5) và NVIDIA GeForce RTX 3060 Laptop GPU |
| GPU Chrome dùng | `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)` |
| Trình duyệt | Chrome 154.0.8037.99, Windows 11 |
| Nguồn | Cắm sạc (pin 100 %), chế độ nguồn ASUS **Silent** (có thể giới hạn xung GPU) |
| Màn hình chính | 1920×1080, scale 125 % (devicePixelRatio 1,25); làm tươi 165 Hz (khung hình rơi đúng bội số 6,06 ms) |
| Pixel ratio của game | `min(devicePixelRatio, 1.5)` = 1,25; MSAA 4× (`antialias: true`), có viền nét (OutlineEffect) |

**Hai lần đo:**
- **1920×1010:** Chrome toàn màn hình. Khung vẽ thực tế 1920×1010 px, vì thanh thông báo của tiện ích điều khiển Chrome
  chiếm 70 px.
- **1366×768:** cửa sổ Chrome đang phóng to nên không đổi được kích thước. Tôi đặt khung vẽ của game đúng 1366×768 px:
  số điểm ảnh phải vẽ bằng một màn hình 1366×768, phần trang ngoài khung vẽ để trống.

**Mỗi zone đo như sau:**
- Vào zone bằng `__game.goto`; thời gian tải là từ lúc gọi tới khi chơi được.
- Chờ 1,5 s, rồi cho nhân vật tự **đi bộ 30 s theo thời gian thực** qua các điểm `INT_`, `NPC_`, `SPAWN_` của zone (lái
  bằng `input.override` và hướng camera). Game chạy bằng requestAnimationFrame như khi người chơi thật chơi.
- Hội thoại tự mở thì bỏ qua, tắt `TRIGGER_` để không chuyển zone giữa chừng.
- Ghi thời gian từng khung, draw call và tam giác thật của cả hai lượt vẽ (cảnh + viền nét).
- Đo thêm thời gian GPU vẽ một khung bằng `EXT_disjoint_timer_query_webgl2`: 72 khung, camera quay một vòng quanh người
  chơi.

Mỗi zone đo một lần. Số NPC xuất hiện tùy tiến trình chơi; ví dụ zone 1 lượt 1920 chưa có NPC, lượt 1366 có 2 NPC.
Trước khi đo tôi đã sao lưu dữ liệu lưu game của trang github.io trên Chrome; đo xong đã trả về đúng như cũ (trống).

## Kết quả

### 1920×1010 (toàn màn hình)

| Zone | FPS TB | FPS thấp nhất (cửa sổ 1 s) | Thời gian khung p50 / p95 / p99 / max (ms) | Khung > 33 ms | Draw call TB / max | Tam giác TB / max | Tải zone | GPU vẽ 1 khung TB / p95 / max (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 · Điểm đón | 87,7 | 67 | 12,1 / 18,2 / 18,3 / 48 | 1 | 69 / 80 | 148k / 151k | 0,98 s | 3,6 / 5,9 / 7,2 |
| 1 · Bến xe | 85,0 | 61 | 12,1 / 18,2 / 24,2 / **321** | 9 | 29 / 47 | 88k / 135k | 0,50 s | 3,4 / 4,5 / 5,2 |
| 2 · Cổng, giếng | 89,1 | 65,5 | 12,1 / 18,1 / 18,3 / **376** | 1 | 16 / 47 | 50k / 135k | 0,28 s | 2,2 / 4,0 / 4,6 |
| 3 · Sảnh | 97,7 | 85 | 12,1 / 12,3 / 18,2 / 91 | 1 | 18 / 24 | 59k / 67k | 0,83 s | 4,1 / 5,7 / 6,1 |

### 1366×768

| Zone | FPS TB | FPS thấp nhất (cửa sổ 1 s) | Thời gian khung p50 / p95 / p99 / max (ms) | Khung > 33 ms | Draw call TB / max | Tam giác TB / max | Tải zone | GPU vẽ 1 khung TB / p95 / max (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 · Điểm đón | 116,8 | 84 | 6,2 / 12,2 / 18,1 / 36 | 1 | 68 / 80 | 148k / 151k | 0,32 s | 2,5 / 4,3 / 5,1 |
| 1 · Bến xe | 130,9 | 109 | 6,1 / 12,2 / 12,3 / 18 | 0 | 42 / 58 | 108k / 114k | 0,62 s | 2,2 / 2,9 / 3,3 |
| 2 · Cổng, giếng | 123,4 | 103 | 6,1 / 12,2 / 12,4 / 18 | 0 | 40 / 47 | 128k / 135k | 0,28 s | 1,5 / 2,6 / 2,8 |
| 3 · Sảnh | 119,9 | 105 | 6,1 / 12,2 / 12,3 / 24 | 0 | 42 / 54 | 125k / 134k | 0,81 s | 2,4 / 3,2 / 3,5 |

**Cách đọc bảng:**
- Draw call và tam giác là tổng của **hai lượt vẽ**: cảnh và viền nét. Viền nét vẽ lại toàn bộ mesh, nên số trong cảnh
  chỉ bằng khoảng một nửa (vd zone 0: khoảng 40 draw call, 75k tam giác).
- Các số này thay đổi theo hướng camera trong lúc đi. Ví dụ zone 2 ở lượt 1920 phần lớn thời gian nhìn vào tường.
- Lượt 1366 đo sau lượt 1920, nên shader đã biên dịch và GLB đã có trong bộ nhớ đệm. Vì vậy cột max ở lượt này thấp hơn,
  thời gian tải cũng nhanh hơn.

### Phân tích thời gian một khung (1920×1010)

**CPU:**
- Cập nhật vòng chơi (`game.update`): khoảng 0,2 ms một khung.
- Gửi lệnh vẽ (`game.render`, gồm bảng tên): 0,9–1,1 ms.

CPU không phải là chỗ nghẽn.

**GPU (đo bằng timer query, chỉ tính lệnh vẽ):** 2,2–4,1 ms trung bình. Tắt viền nét bớt khoảng 0,7 ms (zone 0: 3,6 →
2,9 ms).

**Đo bằng `__game.benchmark` (đồng bộ CPU–GPU mỗi khung bằng `readPixels`):** 9,6–12,7 ms một khung (79–104 FPS). Thử ở
zone 3:

| Cấu hình | ms/khung |
| --- | --- |
| Mặc định | 13,1 |
| Tắt viền nét | 10,7 |
| pixelRatio 1,0 (1536×808 px) | 10,9 |
| pixelRatio 1,0 + tắt viền nét | 9,0 |

**Nhịp khung thực tế:**
- 1920×1010: hầu hết khung dài **12,1 ms**, tức 2 nhịp làm tươi của màn hình 165 Hz.
- 1366×768: hầu hết khung dài **6,1 ms**, tức 1 nhịp.

GPU vẽ cảnh chỉ mất 2–4 ms, nên phần còn lại của khung 12 ms ở 1920 nằm ở khâu sau: hợp nhất MSAA, ghép trang
(compositor) và trình chiếu của Chrome trên GPU tích hợp. Phần này tăng theo số điểm ảnh. Ở 1366×768 lượng điểm ảnh ít
hơn 46 %, nên cả khung vừa trong một nhịp.

### Thời gian tải (lần đầu, bộ nhớ đệm trống)

**Trước màn tạo nhân vật:**
- Bundle JS: 223 KB truyền tải (825 KB giải nén), tải xong lúc 0,97 s; DOMContentLoaded lúc 1,0 s.
- Bước kiểm tra dữ liệu (`validateNodes`) tải **lần lượt từng file** GLB của 4 zone, tổng 958 KB truyền tải, từ 1,67 s
  đến 3,07 s. Màn tạo nhân vật chỉ hiện sau khi xong cả 4 file, tức khoảng **3,1 s** sau khi mở trang (mạng gia đình).

**Sau khi bấm "Start my first day":**
- GLB của prajith: 321 KB, 0,33 s.
- Bộ giải nén Draco: 0,3 s.
- GLB của huyen: 281 KB, 0,32 s.

Ba bước này **nối tiếp nhau**. Zone 0 chơi được khoảng **2,5 s** sau khi bấm.

**Chuyển zone trong game:** 0,3–1,0 s. GLB zone đã có sẵn vì bước kiểm tra đã tải từ đầu; phần còn lại là dựng cảnh,
va chạm và nhân vật. Zone 0 và zone 3 lâu nhất (0,8–1,0 s), vì có nhiều NPC và nhân vật phải dựng.

## Chỗ dưới 30 FPS và chỗ cần để ý

**Không có chỗ nào dưới 30 FPS trên máy này.** Hai điểm đáng để ý:

1. **Giật một lần khi vào zone lần đầu.**
   - Hiện tượng: một khung 321 ms ở zone 1 và 376 ms ở zone 2 (lượt 1920, lần đầu vào). Lượt 1366 vào lại các zone đó
     thì khung dài nhất chỉ 18–36 ms.
   - Nguyên nhân có thể: three.js biên dịch shader khi một chất liệu xuất hiện trên màn hình lần đầu, chứ không phải lúc
     tải zone. Các chất liệu như vậy gồm:
     - toon + vertex color + texture;
     - biến thể cây mờ dần `seeThrough`;
     - chất liệu nhân vật có tint (`onBeforeCompile`);
     - viền nét.

     Ngoài ra còn việc đưa texture lên GPU.
   - Người chơi sẽ thấy hình đứng khoảng 1/3 giây ngay sau khi vào zone hoặc lúc quay camera về phía có vật mới.
2. **Độ phân giải cao trên GPU yếu.**
   - Ở 1920×1010, máy này đã cần 2 nhịp làm tươi (12 ms) cho một khung, dù GPU vẽ cảnh chỉ mất 2–4 ms. Phần tốn là các
     khâu tăng theo số điểm ảnh: MSAA 4×, viền nét, hợp nhất và ghép trang.
   - Laptop văn phòng dùng Intel UHD 620 hoặc Iris Xe thường yếu hơn Vega 8 khoảng 1,5–3 lần, nên ở 1920×1080 có thể
     xuống quanh 40–60 FPS. Ước tính này **chưa đo**.
   - `FpsMonitor` hiện chỉ hạ mức đồ họa từ Cao xuống Thấp, mà game đã ở Thấp sẵn, nên không còn nấc nào để hạ tiếp.

## GPU: `powerPreference: "high-performance"` có lấy card rời không?

**Không.** Trong cùng trang:
- WebGL `getContext` với `default`, `low-power` và `high-performance` đều trả về AMD Radeon.
- WebGPU `requestAdapter({ powerPreference: "high-performance" })` cũng trả về AMD (`gcn-5`).

Trên Windows, Chrome chọn GPU cho cả tiến trình, theo cài đặt đồ họa của Windows dành cho `chrome.exe`; trang web không
đổi được. Máy này chưa đặt GPU riêng cho Chrome, Windows tự quyết và chọn card tiết kiệm điện.

Muốn thử RTX 3060: Windows Settings → System → Display → Graphics → Google Chrome → **High performance**, rồi khởi động lại
Chrome. Tôi không đổi cài đặt hệ thống này. Với số đo trên thì **không cần**: card tích hợp đã vượt 60 FPS ở mọi zone.

## Đề xuất

Đề xuất 1–3 đã làm ngày 09/10/2026 (xem mục "Sau khi sửa" ở đầu báo cáo); đề xuất 4–5 còn mở.

1. **Biên dịch shader trước khi hiện zone.** *(Đã làm.)*
   - Sau khi dựng zone và NPC, trong lúc màn hình còn mờ, gọi `renderer.compile(scene, camera)` (three r186 có cả
     `compileAsync`, dùng `KHR_parallel_shader_compile` nếu trình duyệt hỗ trợ).
   - Gồm cả biến thể `seeThrough` của cây và chất liệu nhân vật có tint. Có thể cho camera quay một vòng ẩn để mọi
     chất liệu được vẽ một lần.
   - Mục tiêu: hết khung 320–380 ms khi vào zone lần đầu.
2. **Mở game nhanh hơn.** *(Đã làm.)*
   - Bước kiểm tra node chỉ cần khi phát triển: bản build có thể bỏ (`import.meta.env.PROD`), hoặc tải 4 GLB song song
     (`Promise.all`) thay vì lần lượt. Màn tạo nhân vật sẽ hiện sớm hơn khoảng 1–1,4 s.
   - Tải song song GLB các nhân vật của zone đầu và bộ giải nén Draco ngay khi người chơi đang điền tên.
3. **Thêm nấc hạ chất lượng khi FPS thấp.** *(Đã làm hai nấc đầu; chưa làm tùy chọn tắt MSAA.)* Khi đã ở mức Thấp mà
   `FpsMonitor` vẫn đo dưới khoảng 45 FPS:
   - giảm pixelRatio 1,25 → 1,0 (zone 3: bớt khoảng 2 ms);
   - rồi tắt viền nét (bớt 0,7–2,4 ms);
   - cuối cùng có thể tắt MSAA (phải tạo lại renderer, nên để thành tùy chọn trong menu Esc).

   Cả ba đều không phải sửa GLB.
4. **Đo trên máy mục tiêu.** Đo lại trên một laptop văn phòng Intel UHD 620 hoặc Iris Xe, ở 1366×768 và 1920×1080:
   - Cách nhanh nhất: mở game với `?debug` rồi gõ `__game.benchmark(120)` trong console ở từng zone.
   - Muốn đo đầy đủ như báo cáo này thì dùng lại cách đo ở trên.

   Máy hiện tại (Ryzen 9 + Vega 8) mạnh hơn mục tiêu, nên con số ở đây là mức trần.
5. **Ghi chú cho người chơi** (trang hướng dẫn hoặc FAQ nội bộ): game chạy tốt trên GPU tích hợp. Nếu laptop có card rời
   và vẫn giật, đặt Chrome sang "High performance" trong cài đặt đồ họa của Windows.
