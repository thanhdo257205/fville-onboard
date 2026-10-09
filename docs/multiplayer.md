# Chơi nhiều người mức "thấy nhau"

Cập nhật: 09/10/2026

Mọi người chơi vào **một phòng chung** (không mã phòng, không tạo phòng). Mỗi người vẫn chơi phần của mình: nhiệm vụ,
hội thoại, Tú, NPC đều riêng từng máy. Phần chung chỉ có việc **thấy nhau** khi ở cùng zone, kèm emote và câu chat soạn
sẵn. Không có chat tự do.

`data/net.json` → `"url": ""` thì mạng tắt hẳn: không kết nối, không có góc online, không có phím T, menu không có dòng
"Show other players". Game chạy y như bản chơi một mình. Bản trên gh-pages hiện để trống.

## Thành phần

| Đường dẫn | Nội dung |
| --- | --- |
| `server/` | Máy chủ: Cloudflare Worker và một Durable Object tên `fville` giữ phòng chung (`src/index.js`, `wrangler.toml`). Dùng WebSocket Hibernation API |
| `data/net.json` | URL máy chủ, nhịp gửi, độ trễ nội suy, số người hiện tối đa, danh sách emote và câu chat, giới hạn của máy chủ (mục `server`). **Máy chủ đọc file này lúc `wrangler deploy`** |
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
  - Vẽ trễ 120 ms để nội suy cho mượt. Đứng yên lâu rồi mới đi thì không trượt chậm; cách nhau hơn 6 m thì dịch chuyển luôn.
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
| máy chủ → client | `welcome {id, online}` | |
| | `zone {zone, players, online}` | Vừa vào zone: danh sách người cùng zone |
| | `join {p}` · `state {id, pos, yaw, anim}` · `emote {id, e}` · `phrase {id, p}` · `leave {id}` | **Chỉ gửi cho người cùng zone** |
| | `online {n}` | Số người online, gửi cho cả phòng |
| | `error {code, msg}` | Vd phòng đầy |

## Máy chủ: giới hạn và kiểm tra đầu vào

- **Không lưu gì xuống storage.** Trạng thái chỉ nằm trong bộ nhớ, cộng với "attachment" gắn theo từng WebSocket để
  Durable Object ngủ dậy (hibernation) vẫn biết ai đang ở đâu. Gói Free bắt buộc khai báo Durable Object kiểu SQLite
  (`new_sqlite_classes` trong `wrangler.toml`), nhưng code không đọc hay ghi gì vào đó.
- **Tên:** tối đa 20 ký tự; chỉ giữ chữ (mọi ngôn ngữ, có dấu), số, khoảng trắng và `. ' _ -`, bỏ ký tự lạ và ký tự vô hình.
- **Vị trí, hướng:** phải là số hữu hạn (|x| ≤ 5000). Zone phải đúng dạng `zone_NN`. Anim lạ đổi thành `idle`.
- **Emote, câu chat:** id phải nằm trong danh sách của `data/net.json`, một người cách nhau ít nhất 0,8 s.
- **Tần suất:** quá 10 tin/giây mỗi kết nối thì bỏ tin, gấp 3 lần thì ngắt (mã 4003).
- **Số kết nối:** tối đa 60. Người thứ 61 nhận `error` "The room is full…" rồi bị đóng (mã 4001).
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

## Giới hạn đã biết

- **Lỗi đỏ trong console:** khi máy chủ không với tới được nhưng máy vẫn có mạng (vd máy chủ bị tắt, mạng công ty chặn
  `workers.dev`), chính Chrome in một dòng đỏ "WebSocket connection … failed" cho mỗi lần thử. Code game không in lỗi nào,
  và JavaScript không chặn được dòng này. Các lần thử cách nhau dần tới 60 giây. Khi máy mất mạng hẳn thì không thử, nên
  không có dòng nào.
- **Cảnh chuyển trên xe bus:** người chơi ngồi xe (zone 0 → 1) thì người khác vẫn thấy họ đứng ở cửa xe cho tới khi sang
  zone 1.
- **Không thấy Tú và NPC của người khác:** NPC và Tú là riêng từng máy.
- **Hibernation:** `wrangler dev` không cho Durable Object ngủ như trên Cloudflare thật, nên phần đọc lại attachment khi
  ngủ dậy chỉ thử được sau khi deploy. Ví dụ: đứng yên cả phòng hơn 10 giây rồi đi lại, mọi người vẫn thấy nhau đúng chỗ.
