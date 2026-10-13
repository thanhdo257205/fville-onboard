# Chơi nhiều người mức "thấy nhau"

Cập nhật: 11/10/2026 (bi-a đánh xoáy — mục cuối; nhắn tin tự do + bộ lọc từ; bi-a: máy khách tính cú, máy chủ chỉ áp luật; luật chuẩn 8 bi "sọc trơn"; 10/10: chia phòng ~30 người, bi-a 2 người)

Không mã phòng, không tạo phòng: máy chủ tự xếp người vào phòng (mỗi phòng ~30 người, xem "Chia phòng"). Mỗi người vẫn
chơi phần của mình: nhiệm vụ, hội thoại, Tú, NPC đều riêng từng máy. Phần chung là **thấy nhau** khi ở cùng phòng và cùng
zone, kèm emote và câu chat soạn sẵn, **bàn bi-a chung** ở zone 5 (2 người chơi theo lượt, người khác đứng xem) và **nhắn tin
tự do** (kênh zone / cả phòng / nhắn riêng, lọc từ ở máy chủ — xem "Nhắn tin tự do + bộ lọc từ").

`data/net.json` → `"url": ""` thì mạng tắt hẳn: không kết nối, không có góc online, menu không có dòng
"Show other players". Phím T / nút 🕺 vẫn mở vòng chọn nhảy offline; tab Giao tiếp cần kết nối.

## Thành phần

| Đường dẫn | Nội dung |
| --- | --- |
| `server/` | Máy chủ: Cloudflare Worker và Durable Object, mỗi DO một phòng (`fville`, `fville-2`…; `src/index.js`, `wrangler.toml`). Dùng WebSocket Hibernation API |
| `server/src/pool.js` | Bàn bi-a chung của một phòng: ghế, lượt, vị trí bi, kiểm tra cú đánh, luật (JS thuần, thử bằng Node) |
| `game/src/pool/rules.js` | Luật 8 bi (luật chuẩn `applyShotV2` + luật rút gọn cũ `applyShot`) + mã hoá bàn — dùng chung cho game và máy chủ |
| `data/net.json` | URL máy chủ, nhịp gửi, độ trễ nội suy, số người hiện tối đa, danh sách emote và câu chat, giới hạn của máy chủ (mục `server`: cả `room_size`, `max_rooms`, `pool_turn_s`). **Máy chủ đọc file này (và `data/pool.json`) lúc `wrangler deploy`** |
| `game/src/net/client.js` | Kết nối WebSocket: thử lại theo backoff, ping khi đứng yên hoặc lâu không nhận được gì, phát hiện rớt mạng |
| `game/src/net/remotes.js` | Hiện người chơi khác: model, bộ đồ, bảng tên, animation, nội suy, bong bóng câu chat |
| `game/src/net/net.js` | Nối vào game: gửi vị trí, emote, câu chat; góc "N online · M in this zone" |
| `game/src/ui/emotes.js` | Vòng chọn nhảy và tab Giao tiếp (phím T / nút 🕺) |
| `game/src/characters/dances.js`, `data/dances.json` | 34 điệu Breakdance, tải clip theo ngoại hình khi cần, huỷ khi di chuyển / tương tác |
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
- **Phím T / nút 🕺:** mở vòng chọn, tạm dừng di chuyển để chọn bằng phím 1–8, chuột hoặc chạm. Mũi tên đổi trang;
  chọn xong vòng tự đóng, Esc / × đóng, nút giữa Dừng ngắt nhảy. Màn thấp dùng 4 lựa chọn mỗi trang.
  - Tab Nhảy có 34 điệu từ Breakdance Pack, dùng được offline. Tải GLB khoảng 1 MB cho ngoại hình hiện tại khi nhảy
    lần đầu. Nhảy một lượt, đi lại / tương tác sẽ dừng; đứng dậy khỏi ghế trước khi chọn nhảy.
  - Worker báo feature `dance` mới phát điệu nhảy cho người cùng zone; cần `wrangler deploy` sau khi merge. Worker cũ
    vẫn cho nhảy tại máy mình. Hai lần gửi hành động mạng cách nhau 1,5 giây.
  - Tab Giao tiếp giữ các emote và câu chat soạn sẵn bên dưới.
  - Emote dùng animation có sẵn: Wave, Nod, Cheer.
  - Câu chat hiện thành bong bóng trên đầu (cùng kiểu bong bóng của Tú): "Hi!", "Good luck!", "Follow me!",
    "Thank you!", "See you at lunch!", "Welcome to F-Ville!".
  - Mình chọn gì thì máy mình cũng diễn hoặc hiện bong bóng luôn. Đi hoặc chạy thì emote dừng.
- **Enter: nhắn tin tự do** (khi máy chủ báo `"chat"`): khung chat góc trái dưới, 3 tab Zone / All / Private, bong bóng
  cho tin cùng zone, bấm tên → nhắn riêng / tắt nhận tin. Chi tiết: "Nhắn tin tự do + bộ lọc từ".
- **Menu Esc:** "Show other players: On / Off" (tắt thì ẩn cả bong bóng chat), "Chat: On / Off" (tắt thì không hiện khung
  chat, không nhận tin), lưu trong trình duyệt. Máy yếu nên tắt Show other players; tắt rồi vẫn kết nối, người khác vẫn
  thấy mình.
- **Dòng điều khiển** thêm "T: wave & quick phrases · Enter: chat" khi bật mạng.

## Giao thức (JSON gọn)

| Chiều | Tin | Ghi chú |
| --- | --- | --- |
| client → máy chủ | `join {name, model, outfit, acc, zone}` | Gửi lại khi đổi bộ đồ (vd vừa nhận Áo Cam FPT) hoặc đội / bỏ phụ kiện (`acc`: vd `["cap"]`, tối đa 4 id) |
| | `state {zone, pos, yaw, anim}` | Tối đa 5 lần/giây và chỉ khi có thay đổi (> 2 cm, > 2°, đổi anim hoặc zone). Đổi zone cũng bằng tin này |
| | `emote {id}` · `phrase {id}` · `leave` | |
| | `ping` | Đứng yên 20 giây, hoặc 20 giây không nhận được tin nào (đang đi liên tục mà máy chủ không trả gì về cho mình), thì gửi. Runtime của Cloudflare tự trả `pong`, không đánh thức Durable Object |
| | `pool_join {r, cf, sp}` · `pool_leave` · `pool_rerack` · `pool_poke` | Bi-a (chỉ nhận ở zone của bàn): xin ghế (`r: 2` = máy khách hiểu luật chuẩn, `cf: 1` = gửi sự kiện cú, `sp: 1` = hiểu xoáy), rời ghế, xếp lại / ván mới, báo đối thủ hết giờ |
| | `pool_choice {c}` | Luật chuẩn, sau cú phá không hợp lệ của đối thủ: `"rerack"` (xếp lại và tự phá) / `"play"` (đánh tiếp) |
| | `chat {ch, to?, text}` | Nhắn tin tự do (`ch`: `zone` / `all` / `dm`; `to`: id phiên người nhận khi `dm`), tối đa 120 ký tự |
| | `pool_shot {seq, a, p, spin, roll, cue, call, b, k, s, d, f, r, rb, kp}` | Cú đánh: số thứ tự, góc, lực, nấc xoáy ngang / đè – kéo (số nguyên −2 … +2, chỉ gửi khi có xoáy), chỗ đặt bi trắng (bi trong tay), lỗ gọi cho bi 8 (luật chuẩn), vị trí 16 bi khi dừng, bi vào lỗ theo thứ tự, bi trắng rơi, thời gian lăn; sự kiện cú cho luật chuẩn (`rules.js` → `wireFacts`): bi trắng chạm bi nào trước, có bi chạm băng sau lần chạm đó, số bi chạm băng, lỗ của từng bi vào lỗ |
| máy chủ → client | `welcome {id, online, room, features}` | `room`: số phòng; `features: ["pool"]`: có bàn bi-a chung; thêm `"pool_rules2"`: bàn chung theo luật chuẩn 8 bi; `"pool_facts"`: máy chủ không chạy vật lý, dùng kết quả + sự kiện cú máy khách gửi; `"pool_spin"`: cú có xoáy; `"chat"`: có nhắn tin tự do |
| | `zone {zone, players, online}` | Vừa vào zone: danh sách người cùng zone |
| | `join {p}` · `state {id, pos, yaw, anim}` · `emote {id, e}` · `phrase {id, p}` · `leave {id}` | **Chỉ gửi cho người cùng zone** |
| | `online {n}` | Số người online, gửi cho cả phòng |
| | `chat {ch, id, name, text, zone?}` | Tin đã lọc: `zone` → người cùng zone, `all` → cả phòng, `dm` → người nhận; người gửi cũng nhận lại |
| | `chat_err {code}` | Tin bị từ chối: `empty`, `long` (quá 120 ký tự), `rate` (gửi quá nhanh), `nobody` (người nhận không còn online) |
| | `error {code, msg}` | Vd phòng đầy |
| | `pool {tb, err?}` | Bàn bi-a hiện tại (vừa vào zone của bàn cũng nhận); `err`: `full`, `turn`, `seq`, `cue`, `bad`, `call`, `choice`, `version` (máy khách cũ xin ghế ở bàn luật chuẩn)… khi máy chủ từ chối |
| | `pool_shot {shot, tb}` | Một cú vừa được nhận (`shot`: người đánh, góc, lực, `spin` / `roll`, chỗ đặt bi trắng, vị trí bi) + bàn sau cú; `tb.spin`: bàn cho đánh xoáy |

## Máy chủ: giới hạn và kiểm tra đầu vào

- **Không lưu gì xuống storage.** Trạng thái chỉ nằm trong bộ nhớ, cộng với "attachment" gắn theo từng WebSocket để
  Durable Object ngủ dậy (hibernation) vẫn biết ai đang ở đâu. Gói Free bắt buộc khai báo Durable Object kiểu SQLite
  (`new_sqlite_classes` trong `wrangler.toml`), nhưng code không đọc hay ghi gì vào đó.
- **Tên:** tối đa 20 ký tự; chỉ giữ chữ (mọi ngôn ngữ, có dấu), số, khoảng trắng và `. ' _ -`, bỏ ký tự lạ và ký tự vô hình.
- **Vị trí, hướng:** phải là số hữu hạn (|x| ≤ 5000). Zone phải đúng dạng `zone_NN`. Anim lạ đổi thành `idle`.
- **Emote, câu chat:** id phải nằm trong danh sách của `data/net.json`, một người cách nhau ít nhất 0,8 s.
- **Nhắn tin tự do:** bỏ ký tự điều khiển / vô hình, tối đa 120 ký tự, mỗi người dồn 5 tin rồi 1 tin / giây; lọc từ thô tục
  và link (`data/chat.json`) trước khi phát; tên người chơi cũng qua bộ lọc. Không lưu tin nào. Máy khách lọc lại tin + tên nhận
  được bằng cùng bộ lọc (`game/src/net/net.js`) theo `data/chat.json` của bản web → sửa danh sách từ có hiệu lực ngay khi deploy
  bản web; máy chủ chỉ lọc theo danh sách mới sau `wrangler deploy`.
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
- **Ghi log:** `wrangler.toml` tắt `observability`, Cloudflare không lưu log yêu cầu. Tên người chơi và tin nhắn chỉ đi qua
  bộ nhớ của Durable Object và những người nhận đang online.

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

## Bi-a luật chuẩn 8 bi "sọc trơn" (11/10/2026)

Bàn chung theo luật 8 bi chuẩn (WPA, rút gọn cho game — tóm tắt luật: `docs/GDD.md`, zone 5): cú phá hợp lệ (có bi vào hoặc
≥ 4 bi chạm băng; không thì đối thủ chọn xếp lại phá / đánh tiếp), bàn vẫn mở sau cú phá, lỗi → đối thủ có bi trong tay cả
bàn, phải gọi lỗ cho bi 8, mỗi cú 60 s (hết giờ = lỗi). Tập một mình và thử thách của anh Khang giữ luật cũ.

**Máy chủ** (`server/src/pool.js`, `PoolRoom` với `rules: 2`):
- *(Bản đầu, đã thay bằng "Máy khách tính cú" — mục cuối.)* **Tự tính lại cú**: người đánh chỉ gửi góc, lực, chỗ đặt bi trắng, lỗ gọi; máy chủ chạy `physics.js` (tất định, cùng mã
  với game) → sự kiện cú (bi trắng chạm bi nào trước, bi nào chạm băng, bi nào vào lỗ nào — `shotFacts`) → `applyShotV2`.
  Vị trí bi máy khách gửi (`b`, `k`, `s`, `d`) bị bỏ qua — không gian lận được kết quả. **CPU mỗi cú** (đo bằng Node, cùng
  V8 với workerd): 0,4–3 ms khi mã đã "nóng" (cú nhẹ → phá mạnh), ~24 ms cho cú đầu tiên sau khi máy chủ vừa khởi động. Gói
  Free của Workers giới hạn 10 ms CPU mỗi lần gọi; chưa kiểm được trên tài liệu Cloudflare giới hạn này có áp cho từng tin
  WebSocket của Durable Object không → sau `wrangler deploy` xem `npx wrangler tail` / dashboard (lỗi "exceeded CPU") khi
  chơi thử vài ván. Nếu bị chặn: chuyển máy chủ về `POOL_RULES = "1"` (luật cũ) rồi tính lại cách làm (vd tin kết quả của
  máy khách như luật cũ, chỉ kiểm tra lại bằng luật chuẩn).
- Kiểm tra: đúng ghế / lượt / số thứ tự cú; chưa chọn sau cú phá không hợp lệ thì không nhận cú (`choice`); chỗ đặt bi trong
  tay (`inHand`: `"kitchen"` khu đầu bàn sau cú phá, `"table"` cả bàn sau lỗi; không chồng bi — `canPlaceCueIn`); đang đánh
  bi 8 phải có `call` là id lỗ hợp lệ (`call`).
- Hết giờ lượt: lỗi (`ev {k: "foul", why: "timeout"}`), đối thủ có bi trong tay; 3 lần liên tiếp của cùng một người → mất ghế.
- `tb` gửi thêm `rules` (2), `choice` (`"break"` khi chờ chọn); `inHand` là `false` / `"kitchen"` / `"table"`; sự kiện cú có
  `foul {why, n}` (`scratch`, `off`, `no_hit`, `wrong_first`, `no_rail`), `brk` (`"legal"` / `"illegal"`), `call`; hết ván:
  `reason` thêm `eight_foul`, `eight_pocket`, `eight_off`.
- Bản chụp qua lúc DO ngủ ghi kèm bộ luật; dậy mà bản chụp là ván của bộ luật khác → xếp lại ván mới (không trộn 2 luật).

**Tương thích — không lệch bàn trong mọi trường hợp:**

| Máy chủ | Bản web | Kết quả |
| --- | --- | --- |
| mới (`pool_rules2`) | mới | luật chuẩn |
| mới | cũ (`pool_join` không có `r: 2`) | không được ngồi (`err: "version"`) → chờ hết 6 s rồi tập một mình; vẫn xem được (cú phát lại khớp vì máy chủ gửi kết quả nó tính) |
| cũ (chỉ `pool`) | mới | luật rút gọn cũ, giao diện cũ (máy khách thấy `tb.rules` không phải 2) |
| cũ | cũ | như trước |

Thử máy chủ bản cũ trên máy: `npx wrangler dev --var POOL_RULES:1` (biến `POOL_RULES = "1"` → luật cũ, không báo
`pool_rules2`; smoke dùng cách này).

**Kiểm thử:** `npm run test:pool` (thêm: từng tình huống luật chuẩn, sự kiện cú từ vật lý — cú cũ chạy lại giống từng bit,
bàn máy chủ luật chuẩn, ván trọn 2 người giả có xếp lại / lỗi / bi trong tay / gọi lỗ); `npm run test:smoke` (máy chủ local:
phá không hợp lệ → R / P, lỗi không chạm bi → bi trong tay cả bàn, gọi lỗ bi 8, máy khách cũ bị từ chối; rồi máy chủ giả
bản cũ: chơi trọn ván luật cũ).

**Cần `wrangler deploy`** (máy Desktop có `wrangler login`, sau khi nhánh `feat/pool-rules-8ball` đã vào `main`) — máy chủ
thật đang chạy bản cũ, chưa deploy thì bàn chung vẫn theo luật rút gọn cũ:

```bash
git pull
cd server
npx wrangler deploy
```

Rồi deploy bản web (`python scripts/deploy_site.py`). Nên deploy máy chủ và bản web gần nhau: trong lúc máy chủ đã mới mà
bản web còn cũ, người chơi bản web cũ không ngồi được bàn chung (chỉ tập một mình / đứng xem).

**Đã deploy (11/10/2026, máy Desktop):** bản web trước — gh-pages 6c15184 (từ `main` 048fa04, PR #14); rồi máy chủ
`npx wrangler deploy` → version `e150c939-0569-43e6-8b68-a377d4296be6` (bản trước 3764cab6, để `wrangler rollback`). `/` →
`F-Ville net: OK`, `/status` JSON, tin chào `features: ["pool", "pool_rules2"]`. `wrangler tail --format json` lúc người dùng
chơi thử bàn chung 2 người (3 lượt ván, ~8 phút): 325 sự kiện của Durable Object, **mọi `outcome` = `ok`**, 0 exception, không
`exceededCpu`. CPU mỗi tin: 296 tin 0 ms, cú đánh thường 1–4 ms, nhưng **7 cú 11–20 ms** (đi theo cặp ở đầu mỗi ván — cú phá
và cú ngay sau, nhiều bi lăn nhất; nặng nhất 20 ms). Vượt mốc 10 ms/lần gọi của gói Free nhưng Cloudflare vẫn chạy (không
`exceededCpu`); cần theo dõi dashboard → Workers & Pages → fville-net → Metrics, và cân nhắc giảm CPU máy chủ khi tự tính lại
cú phá (vd bước mô phỏng thưa hơn / tính lười).

## Máy khách tính cú, máy chủ chỉ áp luật (11/10/2026, sau deploy e150c939)

Bản e150c939 tự tính lại từng cú trên máy chủ: trên Cloudflare cú phá và cú ngay sau tốn **11–20 ms CPU**, quá mốc 10 ms / lần
gọi của gói Free (mục trên). Người dùng chốt: chi phí tính toán để ở máy khách.

- **Máy khách** (`game/src/pool/table.js`): như luật cũ, người đánh tự tính cú bằng `physics.js` rồi gửi thông số + kết quả
  (`b` vị trí bi khi dừng, `k` bi vào lỗ theo thứ tự, `s`, `d`), thêm **sự kiện cú** cho luật chuẩn (`rules.js` → `wireFacts`,
  rút từ `shotFacts`): `f` bi trắng chạm bi nào trước (null: không chạm), `r` có bi chạm băng sau lần chạm đó, `rb` số bi
  (trừ bi trắng) chạm băng, `kp` lỗ của từng bi trong `k`. Xin ghế kèm `cf: 1`.
- **Máy chủ** (`server/src/pool.js`): **không chạy vật lý** (không còn gọi `simulateShot`). Kiểm tra kết quả như luật cũ (bi
  vào lỗ = đúng những bi biến mất, bi đã vào không quay lại, `s` khớp `k`) + sự kiện cú hợp lý (`rules.js` → `factsFromWire`:
  `f` là bi đang trên bàn, không chạm bi nào thì không có bi khác vào lỗ / chạm băng, `rb` không quá số bi trên bàn, `kp` đủ
  và đúng id lỗ) → `applyShotV2` như trước; chỗ đặt bi trong tay, lỗ gọi, lựa chọn sau cú phá, hết giờ giữ nguyên. Tin chào
  thêm `"pool_facts"`.
- **CPU mỗi cú của máy chủ** (`test:pool`, Node, cả `JSON.parse`): ~0,09 ms trung bình, lâu nhất ~0,15 ms (bản tự tính lại:
  0,4–3 ms trong Node, 11–20 ms cú phá trên Cloudflare). Tin `pool_shot` lớn nhất trong ván ~410 ký tự, xấu nhất (16 bi vào
  lỗ) ~715 — dưới giới hạn 1.200.
- **Đánh đổi:** máy chủ tin kết quả người đánh gửi (như luật rút gọn cũ trước PR #14) — chỉ chặn được kết quả không hợp lý,
  không chặn được máy khách bị sửa để "bịa" một cú hợp lý. Mọi bên vẫn chốt theo bàn máy chủ gửi nên bàn không lệch; người
  xem phát lại từng cú và đếm cú lệch (`__game.pool.net.mismatch`). Nếu sau này cần chống gian lận: để người kia (đối thủ)
  phát lại cú — vốn đã làm để hiện hoạt cảnh — và báo máy chủ khi lệch.

**Tương thích (3 bản máy chủ):**

| Máy chủ | Bản web | Kết quả |
| --- | --- | --- |
| mới (`pool_facts`) | mới | luật chuẩn, máy chủ không chạy vật lý |
| mới | luật chuẩn bản đầu (gh-pages 6c15184: `r: 2`, chưa có `cf`) | không được ngồi (`version`) → chờ 6 s rồi tập một mình; vẫn xem được |
| e150c939 (đang chạy: `pool_rules2`, tự tính cú) | mới | luật chuẩn — máy chủ bỏ qua `cf` và sự kiện cú, tự tính như cũ (đã thử: chơi trọn ván với mã máy chủ của `main` fe49f63 qua `wrangler dev`, 15 cú, không lỗi, phát lại khớp) |
| cũ (chỉ `pool`) | mới | luật rút gọn cũ (smoke: `--var POOL_RULES:1`) |

**Thứ tự deploy: bản web trước, máy chủ sau** (bản web mới chạy được với máy chủ đang chạy, nên không có lúc nào người chơi
mất bàn chung; chỉ tab mở từ trước còn bản web cũ mới bị từ chối sau khi máy chủ lên bản mới — tải lại trang là được):

```bash
git pull
python scripts/deploy_site.py          # 1. bản web (hỏi người dùng trước)
cd server && npx wrangler deploy       # 2. máy chủ — tin chào phải có "pool_facts"
npx wrangler tail --format json        # 3. chơi thử 1 ván 2 người: cú phá phải còn ~0 ms CPU, mọi outcome ok
```

Lùi lại: `npx wrangler rollback` về e150c939 (bản web mới vẫn chạy với nó — bảng trên).

**Đã deploy (11/10/2026):** bản web gh-pages 9de6c01 (từ `main` 3bc97b8) → máy chủ `npx wrangler deploy` version **e7a013c0-82b6-4613-825a-74c93f299103** (bản trước e150c939, để `wrangler rollback`); `wrangler tail` lúc chơi thử ván 2 người: hơn 100 sự kiện, mọi `outcome` = `ok`, CPU 0 ms (3 sự kiện 1 ms) — cú phá hết 11–20 ms.

## Nhắn tin tự do + bộ lọc từ (11/10/2026)

Trạng thái: [PR #16](https://github.com/thanhdo257205/fville-onboard/pull/16) đã gộp vào `main` (1195cb1); **đã lên mạng 11/10/2026**: bản web gh-pages c26234f, máy chủ version
c487c71a-f7fb-4692-a942-8bbe6f9d2305 (bản trước e7a013c0 — `npx wrangler rollback` nếu cần quay lại).

Người dùng chốt: cho gõ chữ tự do (không chỉ câu soạn sẵn), kèm bộ lọc từ. Câu soạn sẵn ở phím T vẫn giữ.

- **Cấu hình:** `data/chat.json` — `max_len` 120 ký tự, chống spam `burst` 5 tin dồn + hồi `rate_per_s` 1 tin / giây,
  `history` 50 tin mỗi kênh (chỉ ở máy khách trong lượt chơi, không vào bản lưu), `bubble_s` 6 giây bong bóng; `filter`: danh
  sách từ. Máy chủ đọc file này lúc `wrangler deploy` → sửa danh sách từ thì phải deploy lại máy chủ.
- **Giao thức:** máy khách gửi `{ t: "chat", ch: "zone" | "all" | "dm", to?, text }`; máy chủ phát
  `{ t: "chat", ch, id, name, text, zone? }` (bản **đã lọc**) — `zone`: người cùng zone, `all`: cả phòng (mọi zone), `dm`: đúng
  1 người (id phiên, cùng phòng). Người gửi cũng nhận lại bản đã lọc (thấy đúng như người khác thấy). Lỗi:
  `{ t: "chat_err", code: "empty" | "long" | "rate" | "nobody" }` (tin quá dài bị từ chối, không cắt). Tin chào thêm
  `features: [..., "chat"]`; máy chủ bản cũ không có `"chat"` → game không hiện khung chat (vẫn có câu soạn sẵn). Máy chủ
  **không lưu lịch sử** — người vào sau không thấy tin cũ.
- **Bộ lọc** (`game/src/net/chatfilter.js`, dùng chung máy chủ + `test:data`): lọc theo từng từ (không lọc chuỗi con →
  "class", "assistant" không bị che). `exact`: so nguyên dấu tiếng Việt (bỏ dấu sẽ trùng từ thường: "cặc" / "các", "lồn" /
  "lớn"); `plain`: so sau khi bỏ dấu, đổi chữ số / ký hiệu giống chữ (0 → o, 4 → a, @ → a…), gộp chữ lặp ("fuuuck"); `*` cuối
  = tiền tố; cụm nhiều từ ("đụ má"); chữ cái tách rời ("f u c k") ghép lại rồi so; `allow`: từ không bao giờ che. Đường link
  (http://, www., tên miền .com / .vn …) → `[link]`. Tên tự đặt của người chơi cũng qua bộ lọc. Mất ~0,06 ms / tin 120 ký tự
  (Node). Không lọc được mọi cách viết lách — người chơi còn có mute và tắt chat.
- **Trong game** (`game/src/ui/chat.js`): góc trái dưới.
  - Đóng: vài tin mới nhất (mờ sau ~12 s) + "N tin mới — nhấn Enter để đọc".
  - **Enter** mở (khi đang đi lại / ở bàn bi-a, không trong hội thoại): nhân vật đứng yên, hiện con trỏ, gõ chữ không điều
    khiển nhân vật. Enter gửi, Enter khi ô trống / **Esc** đóng.
  - 3 tab **Zone / All / Private** kèm số tin chưa đọc; tin Zone hiện thêm bong bóng trên đầu người gửi (ẩn theo "Show other
    players"). Private: chọn người trong danh sách, hoặc bấm tên trong tin / bảng tên người chơi (bảng tên bấm được khi khung
    chat mở).
  - Bấm tên → nhắn riêng / tắt nhận tin (mute, theo phiên) / bật lại. Lần đầu mở: thẻ quy tắc ứng xử.
  - Menu Esc: "Chat: On / Off" (lưu cài đặt; tắt thì không hiện khung, không nhận tin).
  - Mọi chữ người khác gửi hiện bằng `textContent` (không chèn HTML).
- **Thử:** `__game.chat` (trạng thái, `open()`, `close()`, `send(text)`, `chat(ch, text, to)`, `rulesOk()`), `__game.net.chat`
  (kênh, mute, lỗi). Smoke (`--extra only`, máy chủ local): 2 trình duyệt + 1 bot WebSocket — tin zone chỉ tới người cùng
  zone (+ bong bóng), all tới cả phòng, từ thô tục / link bị che, dm chỉ tới đúng người, bấm bảng tên → Private, chặn tin
  dài / gửi nhanh, tên tự đặt bị lọc, mute, tắt chat ở menu Esc, máy chủ không có `"chat"` → không có khung chat.

**Số request Cloudflare.** Mỗi tin chat = 1 tin WebSocket gửi lên (tính như tin vị trí: 20 tin = 1 request); tin máy chủ phát
ra không tính. CPU máy chủ mỗi tin: lọc ~0,06 ms + gửi tới tối đa ~30 người cùng phòng.

| Trường hợp | Tin nhận / giờ | Request / giờ |
| --- | --- | --- |
| 21 người, mỗi người 1 tin / phút | 1.260 | **~63** (tin vị trí cùng lúc: ~11.800) |
| 21 người, mỗi người 1 tin / 10 giây (chat rất sôi nổi) | 7.560 | ~380 |
| Xấu nhất: cả 21 người gửi sát giới hạn (1 tin / giây) | 75.600 | ~3.800 |

→ Chat thêm không đáng kể so với tin vị trí; hạn 100.000 request / ngày gần như không đổi (trước: ~8,5 giờ chơi 21 người /
ngày; chat bình thường vẫn ~8,4 giờ).

**Deploy: bản web trước, máy chủ sau.** Bản web mới chạy được với máy chủ đang chạy (chưa có `"chat"` → khung chat ẩn, mọi
thứ khác như cũ); máy chủ mới chạy được với bản web cũ (bản cũ bỏ qua `features` lạ, không gửi `chat`).

```bash
git pull
python scripts/deploy_site.py          # 1. bản web (hỏi người dùng trước)
cd server && npx wrangler deploy       # 2. máy chủ — tin chào phải có "chat"
npx wrangler tail --format json        # 3. 2 cửa sổ nhắn thử: mọi outcome ok, CPU ~0–1 ms
```

Máy Desktop: nếu `deploy_site.py` báo `rejected … (non-fast-forward)` khi push gh-pages (có bản deploy từ máy khác, vd máy
cloud), `dist/` đang cũ hơn GitHub → `cd dist`, `git fetch origin gh-pages`, `git log --oneline FETCH_HEAD..HEAD` (chỉ còn commit
build vừa tạo), `git reset --hard FETCH_HEAD`, `cd ..`, chạy lại `python scripts/deploy_site.py`.

## Bi-a: đánh xoáy (11/10/2026, nhánh `feat/pool-spin`)

Người dùng chốt: áp phê trái / phải 5 nấc (−2 … +2) và xoáy lên / xuống (đánh đè / đánh kéo) 5 nấc. Chi tiết vật lý: đầu
`game/src/pool/physics.js`; giao diện: `game/src/pool/table.js` (ô chọn điểm chạm góc phải dưới, phím Z / X / F / B).

- **Máy khách** tính cú có xoáy như cú thường (`simulateShot(table, state, { angle, power, spin, roll })`, tất định — chỉ + − × ÷,
  `Math.sqrt`, `dsin` / `dcos`), gửi `pool_shot` kèm `spin`, `roll` (chỉ khi khác 0). Sự kiện cú (`wireFacts`: bi chạm trước,
  chạm băng, lỗ của từng bi) lấy từ cùng danh sách sự kiện của vật lý nên vẫn đúng khi có xoáy. `spin = roll = 0` cho kết quả
  **giống từng bit** bản trước (test:pool so dấu vân tay 300 cú ghi từ bản cũ) — ván cũ, phát lại, thử thách của anh Khang không
  đổi.
- **Máy chủ** (`server/src/pool.js`) vẫn **không chạy vật lý**: kiểm tra `spin` / `roll` là số nguyên −2 … +2 (không gửi = 0; sai →
  bỏ cú, `err: "bad"`), giữ nguyên `factsFromWire`, chuyển tiếp `spin` / `roll` trong `pool_shot.shot` để người kia và người xem
  phát lại đúng cú. Tin chào thêm `"pool_spin"`. CPU mỗi cú không đổi (~0,1 ms trong Node).
- **Tương thích:** `pool_join` kèm `sp: 1` = máy khách hiểu xoáy; bàn báo `tb.spin: true` khi mọi người đang ngồi đều hiểu xoáy.
  Có người ngồi bằng bản web chưa có xoáy (vd gh-pages c26234f) → `tb.spin: false`, cú có xoáy bị bỏ (`err: "spin"`), máy khách
  mới ẩn ô chọn và gửi như cũ. Máy chủ cũ (không có `"pool_spin"`, kể cả `POOL_RULES = "1"`) → máy khách mới ẩn ô chọn, luôn
  đánh tâm. Người xem dùng bản web cũ (không ngồi) phát lại cú có xoáy như đánh tâm → lệch hoạt cảnh, nhưng cuối cú vẫn chốt
  theo bàn máy chủ (bàn không lệch).

| Máy chủ | Bản web người ngồi | Kết quả |
| --- | --- | --- |
| mới (`pool_spin`) | cả 2 bản mới | đánh xoáy được |
| mới | có 1 người bản cũ | bàn chung luật chuẩn như trước, không xoáy |
| cũ (c487c71a, chưa có `pool_spin`) | mới | như trước, không xoáy (máy chủ cũ bỏ qua `sp`) |

**Thứ tự deploy: bản web trước, máy chủ sau** (bản web mới chạy được với máy chủ đang chạy):

```bash
git pull
python scripts/deploy_site.py          # 1. bản web (hỏi người dùng trước)
cd server && npx wrangler deploy       # 2. máy chủ — tin chào phải có "pool_spin"
```


## Breakdance liên tục (13/10/2026)

Bản web cần máy chủ có `dance_sequence` để gửi bài ghép. `dance_state` bổ sung trường `dance: {id, time}` vào
bản tin vị trí và danh sách người cùng zone; `time` là số giây đã nhảy, kể cả các vòng đã lặp. Máy chủ chỉ nhận
ID nằm trong danh sách dance, thời gian hữu hạn 0–86.400 giây; bản tin sai bị xoá trạng thái nhảy. Trạng thái
được lưu trong attachment của WebSocket, giữ qua lúc Durable Object ngủ. Người vào sau lấy thời gian hiện tại,
tải model / clip rồi tiếp tục đúng đoạn. Dừng gửi `emote_stop` và `dance: null`; máy khách hủy cả clip đang tải.

Giữ tin `emote` cho bản web cũ. Máy chủ lưu cả bài nhảy bắt đầu bằng emote cũ và xoá khi người đó đi lại / dừng.
Máy chủ chưa cập nhật chỉ cho nhảy tại máy mình; deploy Worker bằng `cd server && npx wrangler deploy`, rồi tải
lại trang để nhận features mới. Worker và bản web đều cần cập nhật để có đủ đồng bộ thời gian / quỹ đạo lặp.
