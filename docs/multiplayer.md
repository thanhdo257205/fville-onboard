# Chơi nhiều người mức "thấy nhau"

Cập nhật: 10/10/2026 (thêm chia phòng ~30 người và bi-a 2 người — xem 2 mục cuối)

Không mã phòng, không tạo phòng: máy chủ tự xếp người vào phòng (mỗi phòng ~30 người, xem "Chia phòng"). Mỗi người vẫn
chơi phần của mình: nhiệm vụ, hội thoại, Tú, NPC đều riêng từng máy. Phần chung là **thấy nhau** khi ở cùng phòng và cùng
zone, kèm emote và câu chat soạn sẵn, và **bàn bi-a chung** ở zone 5 (2 người chơi theo lượt, người khác đứng xem). Không
có chat tự do.

`data/net.json` → `"url": ""` thì mạng tắt hẳn: không kết nối, không có góc online, không có phím T, menu không có dòng
"Show other players". Game chạy y như bản chơi một mình. Bản trên gh-pages hiện để trống.

## Thành phần

| Đường dẫn | Nội dung |
| --- | --- |
| `server/` | Máy chủ: Cloudflare Worker và Durable Object, mỗi DO một phòng (`fville`, `fville-2`…; `src/index.js`, `wrangler.toml`). Dùng WebSocket Hibernation API |
| `server/src/pool.js` | Bàn bi-a chung của một phòng: ghế, lượt, vị trí bi, kiểm tra cú đánh, luật (JS thuần, thử bằng Node) |
| `game/src/pool/rules.js` | Luật 8 bi rút gọn + mã hoá bàn — dùng chung cho game và máy chủ |
| `data/net.json` | URL máy chủ, nhịp gửi, độ trễ nội suy, số người hiện tối đa, danh sách emote và câu chat, giới hạn của máy chủ (mục `server`: cả `room_size`, `max_rooms`, `pool_turn_s`). **Máy chủ đọc file này (và `data/pool.json`) lúc `wrangler deploy`** |
| `game/src/net/client.js` | Kết nối WebSocket: thử lại theo backoff, ping khi đứng yên, phát hiện rớt mạng |
| `game/src/net/remotes.js` | Hiện người chơi khác: model, bộ đồ, bảng tên, animation, nội suy, bong bóng câu chat |
| `game/src/net/net.js` | Nối vào game: gửi vị trí, emote, câu chat; góc "N online · M in this zone" |
| `game/src/ui/emotes.js` | Bảng emote và câu chat (phím T) |
| `scripts/tools/net_bots.js` | Giả lập nhiều người đi lại để đo FPS, số tin mỗi giây và ước tính số request Cloudflare |

## Trong game

- **Kết nối:** sau khi bấm "Start my first day". Người chơi cũ (đã có bản lưu) không thấy màn này nên kết nối ngay khi game
  bắt đầu.
- **Lỗi mạng:** game vẫn chơi bình thường, không bao giờ bị chặn.
  - Tự thử lại sau 2, 4, 8, 16, 30 rồi 60 giây (có cộng ngẫu nhiên).
  - Trình duyệt báo mất mạng (`navigator.onLine`) thì không thử, chờ có mạng lại rồi vào ngay.
  - Phòng đầy thì chờ 90 giây mới thử lại.
- **Người khác:**
  - Hiện bằng model và bộ đồ họ gửi lên: chưa nhận Áo Cam FPT thì mặc bộ đồ ngày đầu (texture `dau_ngay`: áo polo xanh
    nhạt), đã nhận thì texture trong GLB (áo cam + logo) — cùng cách đổi áo như người chơi (`characters.json` →
    `roles.player.outfit.texture`, `Character.setOutfit`); cấu hình còn `outfit.tint` (cách cũ, đổi màu) thì vẫn dùng.
  - `join.model` = model theo giới tính của người gửi (`intern_nam` / `intern_nu`, `Characters.modelId("player")`). Model chưa
    có trong `data/characters.json` hoặc chưa có GLB thì dùng model của người chơi; model không có texture bộ đồ (vd
    `prajith`) thì luôn mặc áo cam của GLB.
  - Có bảng tên viền xanh ngọc để phân biệt với NPC viền cam.
  - Animation idle / walk / run / sit lấy theo vị trí và trạng thái họ gửi.
  - Vẽ trễ 260 ms để nội suy cho mượt (phải lớn hơn khoảng cách 2 bản tin 200 ms; 120 ms thì người khác đi giật, xem
    "Đã lên mạng"). Đứng yên lâu rồi mới đi thì không trượt chậm; cách nhau hơn 6 m thì dịch chuyển luôn.
  - Chỉ hiện 10 người gần nhất cùng zone, không va chạm với ai.
  - Ngoài khung nhìn thì không vẽ. Viền nét chỉ vẽ cho người trong vòng 12 m.
- **Không ảnh hưởng nhiệm vụ:**
  - Người khác không nằm trong danh sách NPC, nên dấu "!", gợi ý E, va chạm và camera hội thoại vẫn như chơi một mình.
  - Đang hội thoại: ẩn người đứng cách người chơi hoặc người đối thoại dưới 2,5 m.
  - Đang mini-game (vd ảnh check-in): ẩn hết.
  - Ai đứng sát camera (dưới 1,6 m) cũng bị ẩn.
- **Góc dưới phải:** "N online · M in this zone". Chỉ hiện khi đang kết nối.
- **Phím T:** mở bảng emote và câu chat, chọn bằng phím 1–9 hoặc chuột. Vẫn đi lại được khi bảng đang mở, chọn xong bảng tự
  đóng. Hai lần chọn phải cách nhau 1,5 giây.
  - Emote dùng animation có sẵn: Wave, Nod, Cheer.
  - Câu chat hiện thành bong bóng trên đầu (cùng kiểu bong bóng của Tú): "Hi!", "Good luck!", "Follow me!",
    "Thank you!", "See you at lunch!", "Welcome to F-Ville!".
  - Mình chọn gì thì máy mình cũng diễn hoặc hiện bong bóng luôn. Đi hoặc chạy thì emote dừng.
- **Menu Esc:** "Show other players: On / Off", lưu trong trình duyệt. Máy yếu nên tắt; tắt rồi vẫn kết nối, người khác vẫn
  thấy mình.
- **Dòng điều khiển** thêm "T: wave & chat" khi bật mạng.

## Giao thức (JSON gọn)

| Chiều | Tin | Ghi chú |
| --- | --- | --- |
| client → máy chủ | `join {name, model, outfit, zone}` | Gửi lại khi đổi bộ đồ (vd vừa nhận Áo Cam FPT) |
| | `state {zone, pos, yaw, anim}` | Tối đa 5 lần/giây và chỉ khi có thay đổi (> 2 cm, > 2°, đổi anim hoặc zone). Đổi zone cũng bằng tin này |
| | `emote {id}` · `phrase {id}` · `leave` | |
| | `ping` | Đứng yên 20 giây thì gửi. Runtime của Cloudflare tự trả `pong`, không đánh thức Durable Object |
| | `pool_join` · `pool_leave` · `pool_rerack` · `pool_poke` | Bi-a (chỉ nhận ở zone của bàn): xin ghế, rời ghế, xếp lại / ván mới, báo đối thủ hết giờ |
| | `pool_shot {seq, a, p, cue, b, k, s, d}` | Cú đánh: số thứ tự, góc, lực, chỗ đặt bi trắng (bi trong tay), vị trí 16 bi khi dừng, bi vào lỗ theo thứ tự, bi trắng rơi, thời gian lăn |
| máy chủ → client | `welcome {id, online, room, features}` | `room`: số phòng; `features: ["pool"]`: có bàn bi-a chung |
| | `zone {zone, players, online}` | Vừa vào zone: danh sách người cùng zone |
| | `join {p}` · `state {id, pos, yaw, anim}` · `emote {id, e}` · `phrase {id, p}` · `leave {id}` | **Chỉ gửi cho người cùng zone** |
| | `online {n}` | Số người online, gửi cho cả phòng |
| | `error {code, msg}` | Vd phòng đầy |
| | `pool {tb, err?}` | Bàn bi-a hiện tại (vừa vào zone của bàn cũng nhận); `err`: `full`, `turn`, `seq`, `cue`, `bad`… khi máy chủ từ chối |
| | `pool_shot {shot, tb}` | Một cú vừa được nhận (`shot`: người đánh, góc, lực, chỗ đặt bi trắng, vị trí bi) + bàn sau cú |

## Máy chủ: giới hạn và kiểm tra đầu vào

- **Không lưu gì xuống storage.** Trạng thái chỉ nằm trong bộ nhớ, cộng với "attachment" gắn theo từng WebSocket để
  Durable Object ngủ dậy (hibernation) vẫn biết ai đang ở đâu. Gói Free bắt buộc khai báo Durable Object kiểu SQLite
  (`new_sqlite_classes` trong `wrangler.toml`), nhưng code không đọc hay ghi gì vào đó.
- **Tên:** tối đa 20 ký tự; chỉ giữ chữ (mọi ngôn ngữ, có dấu), số, khoảng trắng và `. ' _ -`, bỏ ký tự lạ và ký tự vô hình.
- **Vị trí, hướng:** phải là số hữu hạn (|x| ≤ 5000). Zone phải đúng dạng `zone_NN`. Anim lạ đổi thành `idle`.
- **Emote, câu chat:** id phải nằm trong danh sách của `data/net.json`, một người cách nhau ít nhất 0,8 s.
- **Tần suất:** quá 10 tin/giây mỗi kết nối thì bỏ tin, gấp 3 lần thì ngắt (mã 4003).
- **Số kết nối:** phòng đủ `room_size` (30) thì người mới sang phòng sau; phòng cuối (`max_rooms` = 6) nhận tối đa 60, người
  thứ 61 nhận `error` "The room is full…" rồi bị đóng (mã 4001).
- **Bi-a:** chỉ người đang ngồi và tới lượt được đánh; cú phải đúng số thứ tự; kết quả phải hợp lệ (16 bi trong bàn, bi đã vào
  lỗ không quay lại, danh sách bi vào lỗ khớp vị trí, bi trắng chỉ đặt được ở khu đầu bàn khi có bi trong tay). Tin
  `pool_shot` được dài tới 1.200 ký tự (tin khác 512).
- **Im lặng:** không gửi gì, kể cả ping, quá 60 giây thì bị ngắt (mã 4002). Việc kiểm tra chạy mỗi khi có tin tới.
- **Origin:** chỉ nhận trang `https://thanhdo257205.github.io` (thêm trang khác vào `server.allowed_origins`); localhost
  và 127.0.0.1 luôn được, để thử. Công cụ không phải trình duyệt (không gửi Origin) vẫn vào được, nhưng các giới hạn trên
  vẫn áp.
- **`GET /status`:** trả số người online và số người từng zone, không có tên. Dùng để kiểm tra sau khi lên mạng.
- **Ghi log:** `wrangler.toml` tắt `observability`, Cloudflare không lưu log yêu cầu. Tên người chơi chỉ đi qua bộ nhớ của
  Durable Object và những người cùng zone đang online.

## Chạy thử trên máy (không cần tài khoản Cloudflare)

```bash
npm --prefix server ci
npm --prefix server run dev                 # wrangler dev → http://127.0.0.1:8787 (GET / = "F-Ville net: OK")
npm --prefix game run dev                   # http://localhost:5180
# mở vài cửa sổ (cửa sổ ẩn danh / profile khác để có tên khác nhau):
#   http://localhost:5180/?debug&net=ws://127.0.0.1:8787/ws
```

`?net=` chỉ có tác dụng ở bản dev. Bản build chỉ đọc `data/net.json`. Kiểm tra bằng số liệu: `__game.net` (trạng thái,
người khác, bong bóng…), `__game.netEmote("wave")`, `__game.netPhrase("hi")`.

## Đo tải: `scripts/tools/net_bots.js`

```bash
node scripts/tools/net_bots.js --url ws://127.0.0.1:8787/ws --bots 20 --seconds 60
# FPS phía người chơi (cần Playwright; game chạy bằng npm run dev):
node scripts/tools/net_bots.js --url ws://127.0.0.1:8787/ws --bots 20 --seconds 40 --fps http://localhost:5180/
```

Không có Playwright thì chạy bot không kèm `--fps`, mở game bằng `?debug&net=...` và đọc FPS ở góc trái dưới.

**Kết quả đo ngày 09/10/2026** (máy cloud, `wrangler dev`, 20 bot đi lại quanh người chơi trong bán kính 15 m, 60% thời
gian đi, mỗi bot cứ khoảng 45 giây emote hoặc nói một câu):

| Đại lượng | Giá trị |
| --- | --- |
| Tin máy chủ nhận (client gửi lên) | 62/giây, tức 3,1 tin/giây mỗi người |
| Tin máy chủ phát đi (miễn phí) | khoảng 1.250/giây |
| 1 giờ chơi, 21 người như vậy | 235.000 tin nhận → **11.800 request** (20 tin = 1 request, cộng 2 request/người cho lần kết nối) |
| Hạn gói Free 100.000 request/ngày | đủ khoảng **8,5 giờ** chơi 21 người mỗi ngày |
| Xấu nhất: cả 21 người đi liên tục (5 tin/giây) | 18.900 request/giờ → đủ khoảng 5,3 giờ/ngày |
| FPS người chơi (Chromium không GPU, 640×360) | 13,7 → 11,7 FPS (−14%) khi có 20 bot (hiện 10). Chỉ vẽ: 40 → 87 ms/khung |

FPS trên đo bằng Chromium headless, vẽ bằng CPU (SwiftShader). Chi phí vẽ người khác, nhất là viền nét, bị phóng đại nhiều
so với GPU thật. Trên laptop văn phòng nên đo lại: chạy bot không kèm `--fps`, mở game bằng `?debug&net=...`, so FPS khi
bật và tắt "Show other players". Nấc Detail = Auto vẫn tự tắt viền nét khi FPS < 45.

**Thời lượng Durable Object** (gói Free cho 13.000 GB-giây/ngày): khi có người đang đi lại, Durable Object thức liên tục
và tính 128 MB × số giây, tức khoảng 460 GB-giây mỗi giờ, đủ khoảng 28 giờ/ngày. Khi mọi người đứng yên, Durable Object ngủ
(hibernation), ping vẫn được trả lời mà không tính thời lượng.

## Đưa lên mạng (máy Desktop có tài khoản Cloudflare)

Máy cloud không đăng nhập được Cloudflare, nên các bước này làm trên máy Desktop.

1. **Cài và đăng nhập:**
   ```bash
   npm --prefix server ci
   cd server
   npx wrangler login              # mở trình duyệt, đăng nhập tài khoản Cloudflare (gói Free là đủ)
   ```
2. **Deploy máy chủ:**
   ```bash
   npx wrangler deploy             # in ra địa chỉ, vd https://fville-net.<tên-tài-khoản>.workers.dev
   ```
   Lần đầu deploy, Cloudflare có thể hỏi tạo subdomain `workers.dev` cho tài khoản; làm theo hướng dẫn trên màn hình. Lệnh
   `deploy` tự tạo Durable Object theo `[[migrations]]` trong `wrangler.toml`.
3. **Kiểm tra máy chủ:**
   ```bash
   curl https://fville-net.<tên-tài-khoản>.workers.dev/          # → F-Ville net: OK
   curl https://fville-net.<tên-tài-khoản>.workers.dev/status    # → {"online":0,"connections":0,"max":60,"zones":{}}
   node scripts/tools/net_bots.js --url wss://fville-net.<tên-tài-khoản>.workers.dev/ws --bots 3 --seconds 20
   ```
   Trước khi chạy `net_bots.js`, quay về thư mục gốc repo (`cd ..`).
4. **Điền URL** vào `data/net.json`:
   ```json
   "url": "wss://fville-net.<tên-tài-khoản>.workers.dev/ws",
   ```
   Lưu ý: `wss://` (không phải `https://`) và có `/ws` ở cuối. Trang chơi đặt ở chỗ khác `thanhdo257205.github.io` thì thêm
   origin đó vào `server.allowed_origins` rồi `wrangler deploy` lại.
5. **Build, deploy bản web:**
   ```bash
   npm --prefix game run build          # kiểm tra build
   python scripts/deploy_site.py        # build → quét riêng tư → commit → push gh-pages
   ```
   Rồi commit `data/net.json` lên `main`.

Đổi emote, câu chat hoặc giới hạn trong `data/net.json` thì phải `wrangler deploy` lại máy chủ (máy chủ đóng gói file này),
rồi deploy lại bản web.

## Kiểm tra sau khi lên

1. Mở https://thanhdo257205.github.io/fville-onboard/game/ ở 2 trình duyệt (hoặc 1 cửa sổ thường + 1 cửa sổ ẩn danh), đặt
   2 tên khác nhau. Góc dưới phải hiện "2 online · 2 in this zone", và thấy người kia có bảng tên viền xanh ngọc.
2. Một bên đi lại: bên kia thấy đi mượt, đúng animation đi / chạy.
3. Bấm T rồi 1 (Wave), T rồi 4 (Hi!): bên kia thấy vẫy tay và bong bóng "Hi!".
4. Một bên sang zone khác: bên kia thấy người đó biến mất, góc màn hình còn "2 online · 1 in this zone".
5. Esc → Show other players: Off thì người kia biến mất, On thì hiện lại.
6. Tắt Wi-Fi một bên khoảng 10 giây: game vẫn chơi được, góc online ẩn đi; bật lại thì tự vào lại.
7. `curl .../status` khớp số người đang mở game.
8. Theo dõi số request: Cloudflare dashboard → Workers & Pages → `fville-net` → Metrics, và mục Durable Objects. Gói Free
   cho 100.000 request/ngày cho cả Worker lẫn Durable Object.

**Tắt nhanh khi cần:** để `"url": ""` trong `data/net.json` rồi `python scripts/deploy_site.py`, game quay về chơi một
mình. Muốn dừng hẳn máy chủ: `npx wrangler delete` trong `server/`, hoặc tắt route `workers.dev` trên dashboard.

## Đã lên mạng (10/10/2026)

- Máy chủ: **https://fville-net.fville-onboard.workers.dev** (WebSocket `wss://fville-net.fville-onboard.workers.dev/ws`, đã
  điền vào `data/net.json` → `url`). Deploy bằng `npx wrangler deploy` trong `server/` (tài khoản Cloudflare của người dùng
  đăng nhập bằng `wrangler login`; token nằm ngoài repo, trong thư mục cấu hình của wrangler trên máy). Lần deploy đầu
  Cloudflare trả 504 khi đọc subdomain — deploy lại là được.
- `curl …/` → `F-Ville net: OK`; `curl …/status` → `{"online":0,"connections":0,"max":60,"zones":{}}`.
- **Hibernation:** 2 client vào zone_00 rồi chỉ ping 80 giây (Durable Object ngủ, ping do runtime tự trả lời). Client thứ
  ba vào sau vẫn nhận đúng 2 người kèm tên và vị trí ban đầu (đọc lại attachment khi thức dậy); 2 client cũ không bị ngắt
  nhầm sau khi Durable Object thức. Phòng trống vài phút rồi vào lại: bình thường.
- **8 bước kiểm tra** (bản build, 2 cửa sổ trên cùng máy: `localhost:8767` và `127.0.0.1:8767` — 2 origin nên 2 bản lưu,
  tên khác nhau, như 1 cửa sổ thường + 1 ẩn danh):
  1. "2 online · 2 in this zone", thấy người kia đúng model theo giới tính (Minh: intern_nam, Lan: intern_nu), đúng bộ đồ,
     bảng tên. ✓
  2. Đi / chạy (người chơi giả "Walker" gửi 5 tin/giây như game): **lỗi đã sửa** — `interp_ms` 120 < khoảng cách 2 bản tin
     200 ms → người khác đứng rồi nhảy, tốc độ ước 0,57 m/s thay vì 1,4, animation đi chỉ trộn ~40%. Nay 260 ms: 1,34 /
     4,28 m/s (thật 1,4 / 4,4), animation đi / chạy 96%. ✓
  3. Wave và "Hi!": bên kia thấy vẫy tay và bong bóng. ✓
  4. Một bên sang zone 1: bên kia hết thấy, "· 1 in this zone". ✓
  5. Show other players Off / On: ẩn / hiện lại (vẫn kết nối). ✓
  6. Rớt mạng (giả lập bằng sự kiện `offline` → client đóng socket): game vẫn chơi, góc online ẩn, tự vào lại sau 2,3 s và
     thấy lại người kia. Tắt Wi-Fi thật chưa thử (máy làm việc). ✓
  7. `/status` khớp số cửa sổ đang mở. ✓
  8. Số request trên Cloudflare dashboard: người dùng tự xem (Workers & Pages → `fville-net` → Metrics).
  **Lỗi đã sửa ở client:** tin "zone" (danh sách người cùng zone) về trước khung hình đầu tiên (vd tab đang ẩn lúc kết nối)
  thì `update()` coi là vừa đổi zone và xoá mất danh sách → người đứng yên không hiện. `sendJoin` nay ghi nhận zone.
- **FPS với 10 bot trên GPU thật** (máy làm việc: AMD Radeon tích hợp, Chrome D3D11; bản build 1280 × 760, Detail 0 = độ
  phân giải đầy đủ + viền nét; `__game.benchmark(180)` = thời gian vẽ thật có `gl.finish`, quay camera 1 vòng):

  | Trường hợp | ms / khung | FPS |
  | --- | --- | --- |
  | Chỉ 1 người khác | 13,7–13,8 | 72–73 |
  | 10 bot + 1 người (hiện 10) | 15,0–15,1 | 66–67 (−9 %) |
  | 10 bot, Show other players: Off | 13,5–13,9 | 72–74 |

  Tải máy chủ thật với 10 bot (100 s, 60 % thời gian đi): máy chủ nhận 26,7 tin/giây (2,67 / người), phát 241 tin/giây;
  1 giờ chơi 10 người ≈ 4.800 request → hạn 100.000 / ngày đủ ~20,7 giờ; xấu nhất (cả 10 người đi liên tục) ~11 giờ.

## Giới hạn đã biết

- **Lỗi đỏ trong console:** khi máy chủ không với tới được nhưng máy vẫn có mạng (vd máy chủ bị tắt, mạng công ty chặn
  `workers.dev`), chính Chrome in một dòng đỏ "WebSocket connection … failed" cho mỗi lần thử. Code game không in lỗi nào,
  và JavaScript không chặn được dòng này. Các lần thử cách nhau dần tới 60 giây. Khi máy mất mạng hẳn thì không thử, nên
  không có dòng nào.
- **Ngồi trên xe bus (đã sửa 10/10/2026):** lúc nhân vật khuất vào xe (cảnh chuyển zone 0 → 1, cảnh kết ở bến xe), client
  báo zone `transit_zone` (`data/net.json`, mặc định `zone_99`, không zone nào dùng). Người cùng zone thấy người đó rời đi
  ngay khi bước lên xe, không còn đứng ở cửa xe. Lúc xuống xe ở zone 1 thì xuất hiện ở cửa xe như bình thường. Máy chủ
  không cần sửa: `zone_99` đúng dạng `zone_NN`. Trong lúc ngồi xe, client bỏ qua tin của người khác.
- **Không thấy Tú và NPC của người khác:** NPC và Tú là riêng từng máy.
- **Hibernation:** `wrangler dev` không cho Durable Object ngủ như trên Cloudflare thật, nên phần đọc lại attachment khi
  ngủ dậy chỉ thử được sau khi deploy. Ví dụ: đứng yên cả phòng hơn 10 giây rồi đi lại, mọi người vẫn thấy nhau đúng chỗ.

## Chia phòng ~30 người (10/10/2026)

- Mỗi phòng là một Durable Object: phòng 1 giữ tên cũ `fville` (không đổi phòng của bản đang chạy), phòng 2 trở đi
  `fville-2`, `fville-3`… Worker luôn gửi kết nối mới vào phòng 1; phòng đã có `room_size` (30) kết nối thì DO đó chuyển
  nguyên request WebSocket sang phòng sau (header `X-FVille-Room`). Phòng cuối (`max_rooms`, mặc định 6) nhận tới
  `max_connections` (60) — tức tối đa ~210 người.
- Người ở phòng khác nhau không thấy nhau và có bàn bi-a riêng. Phòng 1 vơi bớt thì người mới lại vào phòng 1.
- Góc màn hình: phòng 1 vẫn "N online · M in this zone"; phòng 2 trở đi "Room 2 · N online · M in this zone" (N = số người
  của phòng đó).
- `?room=N` trên địa chỉ WebSocket (`wss://…/ws?room=2`): vào thẳng phòng N, bỏ qua giới hạn 30 (thử / kiểm thử). Game chưa
  có nút chọn phòng.
- `GET /status`: cộng mọi phòng (`online`, `connections`, `zones`) và liệt kê từng phòng đang có người (`rooms`, kèm trạng
  thái bàn bi-a: `mode`, số người ngồi, số cú).
- Chi phí: phòng 1 chưa đầy thì như cũ (1 request DO cho mỗi lần kết nối); phòng 1 đầy thì thêm 1 request cho mỗi phòng
  phải đi qua.

## Bi-a 2 người (bi-a bước 3, 10/10/2026)

Bàn bi-a ở zone 5 là **bàn chung của cả phòng** khi máy chủ báo `features: ["pool"]` trong `welcome`. Máy chủ cũ (chưa
deploy bản này) không báo → bàn chỉ cho tập một mình như bước 2.

**Trong game** (`game/src/pool/table.js`):
- "Play pool" → xin ghế. Một người ngồi: tập một mình (R: xếp lại), cú đánh vẫn phát cho người trong zone xem. Người thứ
  hai ngồi: xếp lại bi, bắt đầu ván 8 bi, **người ngồi trước phá**. Hết ghế: đứng xem (camera bao quát bàn, A/D hoặc chuột
  xoay); có ghế trống thì bấm **J** để ngồi.
- Bảng góc trái: 2 ghế (tên, nhóm trơn / sọc, số bi còn lại; viền cam = người đang đánh), dòng trạng thái ("Your turn",
  "An's turn · 42s", bi trong tay…), nút Rerack / Rematch (R), Join (J), Leave table (Esc).
- **Đồng bộ:** người đánh tự tính cú bằng `physics.js` (tất định) rồi gửi góc, lực, chỗ đặt bi trắng + kết quả (vị trí bi
  làm tròn 0,01 mm, bi vào lỗ theo thứ tự). Người kia và người xem phát lại đúng cú đó từ bàn của mình (cùng hoạt cảnh),
  cuối cú chốt theo bàn máy chủ gửi về. Mọi bên (cả người đánh) lấy bàn đã làm tròn làm điểm xuất phát cú sau, nên cú phát
  lại khớp từng bit với người đánh. Người vào zone giữa ván nhận ngay bàn hiện tại.
- **Luật 8 bi rút gọn** (`game/src/pool/rules.js`): bàn mở tới khi có người vào bi mà bi trắng không rơi → người đó nhận
  nhóm của bi vào đầu tiên (trơn 1–7 / sọc 9–15); vào bi nhóm mình thì đánh tiếp; bi trắng rơi → đổi lượt, đối thủ có
  **bi trong tay**: đặt bi trắng ở khu đầu bàn (W/A/S/D hoặc kéo chuột, Space / nhấp để đặt); bi 8 cuối cùng — vào khi đã
  hết nhóm mình (từ trước cú đó) và bi trắng không rơi thì thắng, vào sớm / kèm bi trắng rơi thì thua; bi 8 vào lúc phá →
  đặt lại điểm chân bàn. Không phạt chạm sai bi trước.
- **Giờ lượt:** tới lượt mà quá `pool_turn_s` (60 giây, tính từ lúc bi dừng) không đánh → mất ghế, đối thủ thắng. Máy chủ
  kiểm tra mỗi khi có tin tới; người chờ tự gửi `pool_poke` khi hết giờ.
- **Ghế được giải phóng** khi rời bàn (Esc), sang zone khác, mất kết nối, hoặc hết giờ lượt. Đang giữa ván → người còn lại
  thắng, tiếp tục tập một mình.
- **Mất kết nối khi đang ở bàn:** tập một mình tiếp với bàn đang có; vào lại bàn sau khi có mạng thì về bàn chung.
- Thử thách "Một cú bi-a" của anh Khang luôn là bàn riêng; bàn chung vẫn cập nhật ngầm và hiện lại khi xong.
- **Hibernation:** bàn (ghế, lượt, nhóm, vị trí bi, số cú) cất vào attachment của người đang ngồi sau mỗi lần đổi; DO ngủ
  dậy dựng lại từ bản mới nhất, ghế của người đã đi được giải phóng.
- Số request: mỗi cú = 1 tin gửi lên (người chờ thêm 1 `pool_poke` nếu đối thủ hết giờ) — không đáng kể so với tin vị trí.

**Kiểm thử:** `npm run test:pool` (Node: luật, bàn máy chủ, một ván trọn giữa 2 người chơi giả + người xem phát lại khớp
từng bit, ván có bi trong tay, bản chụp qua lúc ngủ); `npm run test:smoke` (máy chủ local: 2 trình duyệt chơi trọn một ván,
chặn cú sai lượt, người xem vào giữa ván, bi trong tay, rớt mạng → giải phóng ghế, máy chủ cũ → tập một mình; chia phòng 31
kết nối). Thử tay: `npm --prefix server run dev` + 2 cửa sổ `http://localhost:5180/?debug&net=ws://127.0.0.1:8787/ws&start=zone_05`
(1 cửa sổ thường + 1 ẩn danh). `__game.pool.net` cho biết ghế, lượt, nhóm, số cú đã phát lại / lệch.

**Bật trên máy chủ thật** (máy Desktop có `wrangler login`, sau khi nhánh này đã vào `main`):

```bash
git pull
cd server
npx wrangler deploy
curl https://fville-net.fville-onboard.workers.dev/status   # có "room_size", "rooms" và "pool" là bản mới
```

Rồi deploy bản web (`python scripts/deploy_site.py`). Thứ tự không bắt buộc: bản web mới + máy chủ cũ → bàn chỉ tập một
mình; máy chủ mới + bản web cũ → bản web cũ bỏ qua các tin `pool`.
