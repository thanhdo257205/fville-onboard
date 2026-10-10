# Âm thanh: danh sách file, nguồn và giấy phép

> File tự sinh bởi `scripts/blender/audio/build_sfx.py` từ `data/sounds.json` — đừng sửa tay; sửa data rồi chạy lại script. `npm --prefix game run test:data` báo lỗi nếu file âm thanh trong `assets/sfx/` không có trong danh sách này.

## Tóm tắt

Game có **58 file âm thanh** (286 KB, `assets/sfx/`), thuộc 2 loại:

1. **48 file lấy từ 5 gói âm thanh của Kenney** (kenney.nl), phát hành theo giấy phép **Creative Commons CC0 1.0 Universal** — tác giả từ bỏ quyền tác giả và các quyền liên quan ở mức tối đa pháp luật cho phép, đưa tác phẩm vào phạm vi công cộng (public domain). Được dùng cho mục đích cá nhân, giáo dục và **thương mại**, được sửa đổi, phát tán, **không phải ghi công, không phải xin phép, không mất phí**. Nội dung file giấy phép trong từng gói được chép nguyên văn vào `assets/sfx/licenses/`.
2. **10 file tự tạo cho dự án** bằng công thức toán (sóng sin / vuông, nhiễu, bộ lọc) trong `scripts/blender/audio/synth.py` — không dùng bản ghi hay mẫu âm thanh của bên thứ ba nào. Là sản phẩm của dự án, cùng chủ sở hữu với mã nguồn trong repo.

Ngoài ra **tiếng nền theo zone** (gió, chim, xe cộ xa, máy lạnh, gõ phím), **tiếng máy xe bus** và **tiếng vang trong nhà** được tạo bằng code ngay lúc chơi (`game/src/core/ambience.js`, Web Audio API) — không có file, không dùng mẫu âm thanh nào.

Không file nào dùng giấy phép có điều kiện (ghi công BY, phi thương mại NC, chia sẻ tương tự SA, không phái sinh ND) → dùng được trong tổ chức, cả trong sản phẩm nội bộ lẫn công khai. `build_sfx.py` chỉ nhận gói có giấy phép CC0-1.0.

**Summary (English):** all game audio is either (a) from Kenney asset packs released under the CC0 1.0 Universal public-domain dedication (free for commercial use, modification allowed, no attribution required — the original `License.txt` of each pack is kept in `assets/sfx/licenses/`), or (b) synthesized from scratch for this project by code (`scripts/blender/audio/synth.py`, no third-party recordings or samples), or (c) generated live by code in the browser (`game/src/core/ambience.js`). No file is under an attribution, non-commercial, share-alike or no-derivatives licence.

## Giấy phép CC0 1.0

- Bản tóm tắt: https://creativecommons.org/publicdomain/zero/1.0/
- Văn bản pháp lý đầy đủ: https://creativecommons.org/publicdomain/zero/1.0/legalcode
- Trang của mỗi gói trên kenney.nl ghi giấy phép "Creative Commons CC0"; file `License.txt` trong gói zip ghi "License: (Creative Commons Zero, CC0)" kèm link trên và câu "free to use in personal, educational and commercial projects" / "You may use these assets in personal and commercial projects"; ghi công Kenney là không bắt buộc (dự án vẫn ghi công ở đây và trong `CREDITS.md`).
- CC0 không cấp quyền nhãn hiệu hay bằng sáng chế — không liên quan ở đây: các file là tiếng động chung (bấm nút, bước chân, va chạm, đoạn nhạc ngắn), không có tên, giọng nói hay thương hiệu của ai.

## Gói nguồn

| Gói | Tác giả | Trang gói | Kích thước zip | SHA-256 của file zip | Ngày tải | Giấy phép (bản trong repo) |
| --- | --- | --- | --- | --- | --- | --- |
| Casino Audio (1.1) | Kenney Vleugels (www.kenney.nl) | https://kenney.nl/assets/casino-audio | 876,839 byte | `f36250766ac5bc378c13708ddf12a23a8e54a3251f8d482c7536e51b5dbafa18` | 2026-10-10 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) (`assets/sfx/licenses/kenney_casino-audio.txt`) |
| Impact Sounds (1.0) | Kenney (www.kenney.nl) | https://kenney.nl/assets/impact-sounds | 800,850 byte | `029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8` | 2026-10-10 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) (`assets/sfx/licenses/kenney_impact-sounds.txt`) |
| Interface Sounds (1.0) | Kenney (www.kenney.nl) | https://kenney.nl/assets/interface-sounds | 834,536 byte | `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232` | 2026-10-10 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) (`assets/sfx/licenses/kenney_interface-sounds.txt`) |
| Music Jingles | Kenney Vleugels (www.kenney.nl) | https://kenney.nl/assets/music-jingles | 1,239,525 byte | `b729ba57959bd58793d2c5cafa348aaf2655d354f3da35ec4729e03ec77197b8` | 2026-10-10 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) (`assets/sfx/licenses/kenney_music-jingles.txt`) |
| RPG Audio | Kenney Vleugels (www.kenney.nl) | https://kenney.nl/assets/rpg-audio | 964,837 byte | `6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b` | 2026-10-10 | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) (`assets/sfx/licenses/kenney_rpg-audio.txt`) |

Link tải trực tiếp (file zip) ghi ở `data/sounds.json` → `sources.<gói>.download`. Kiểm tra lại: tải zip ở link đó, tính SHA-256, so với cột trên; SHA-256 từng file gốc ở bảng dưới so được với file cùng tên trong zip.

## File lấy từ gói Kenney

| File trong game | Dùng ở | Gói | File gốc trong zip | SHA-256 của file gốc |
| --- | --- | --- | --- | --- |
| `assets/sfx/tap.mp3` | bấm nút, chọn thẻ trong mini-game | Interface Sounds (1.0) | `Audio/click_002.ogg` | `adcd1f4adc35f1b41bc1b5bbefeff7aa44f2f3f0d96d3199b544140c7c1e761c` |
| `assets/sfx/select.mp3` | chọn câu trả lời trong hội thoại, đổi tab app My FPT | Interface Sounds (1.0) | `Audio/select_002.ogg` | `4cc6ac5341b9b2c86fef80c347de028e9ab9f2e037586ac7d9fa59a403a1c012` |
| `assets/sfx/line.mp3` | sang câu thoại tiếp theo | Interface Sounds (1.0) | `Audio/drop_002.ogg` | `4ac4d1cef7e936965cbf795852ca2020300b9e2ba7daa59f2bf4f1f7bf416218` |
| `assets/sfx/mg_open.mp3` | mở mini-game | Interface Sounds (1.0) | `Audio/maximize_001.ogg` | `fd3e75e1de2f2fda90aceeacaeb0427ac8bddd3b07a6ce2a8f9ba923df3771f9` |
| `assets/sfx/mg_correct.mp3` | mini-game: làm đúng một bước | Interface Sounds (1.0) | `Audio/confirmation_001.ogg` | `063564703b6094d70718a3e787a55cc9141611e4ecd6b6637f8828f79b4a8c3a` |
| `assets/sfx/mg_wrong.mp3` | mini-game: sai (kèm gợi ý) | Interface Sounds (1.0) | `Audio/question_004.ogg` | `585ecb58b529dc49b5c5ce5ba93427bf73b7052bae55e49c43ba8f169c93ac99` |
| `assets/sfx/mg_done.mp3` | xong mini-game | Music Jingles | `Audio/Pizzicato jingles/jingles_PIZZI02.ogg` | `4967dc3cd31257716f455ef50f8980378726ce086954c7a5563c0c57ee129e3e` |
| `assets/sfx/mg_skip.mp3` | bấm Skip mini-game | Interface Sounds (1.0) | `Audio/back_002.ogg` | `61581c58194e3f19f531072edabbc344204c7e0a2887b8ededce4357bcf09195` |
| `assets/sfx/bucket.mp3` | giếng làng: kéo được gầu nước | RPG Audio | `Audio/metalPot2.ogg` | `8e1f820d217d380fde10e969d109db34303e3f4d11c3951926eddef813d04ae2` |
| `assets/sfx/pickup.mp3` | nhặt đồ, nhận đồ mới vào túi | RPG Audio | `Audio/handleSmallLeather.ogg` | `ae3cbf695aa0a8b98b5a80a835be5a3ccbd5446a24db2235cd4c3cd6fc92ed96` |
| `assets/sfx/nudge.mp3` | bong bóng nhắc của Tú, người chơi khác gửi emote | Interface Sounds (1.0) | `Audio/pluck_002.ogg` | `c977fe249ff42d1c93a552b33abc13a8399df3879fa510475426e5c4bbac1da9` |
| `assets/sfx/help.mp3` | mở thẻ gợi ý (phím H) | Interface Sounds (1.0) | `Audio/question_003.ogg` | `00bafc564e29c12e99da584864a750260e7110378251d63d3aa5b3d727836efe` |
| `assets/sfx/app_open.mp3` | mở app My FPT (Tab) | Interface Sounds (1.0) | `Audio/open_002.ogg` | `24ff224fe2c09c6aed1b41249825382dc74cf324b887ff279d8494912ce2beee` |
| `assets/sfx/app_close.mp3` | đóng app My FPT | Interface Sounds (1.0) | `Audio/close_002.ogg` | `bc4279d2bb2bf86592473eab6a8eab55e51b54a8619315000dbd780a83b102d8` |
| `assets/sfx/menu_open.mp3` | mở menu Esc | Interface Sounds (1.0) | `Audio/open_003.ogg` | `bcdca6b5c9c33aa15ca3fb18a1fa8d98a01b528b85be08c5a610e57c75fc022d` |
| `assets/sfx/menu_close.mp3` | đóng menu Esc | Interface Sounds (1.0) | `Audio/close_003.ogg` | `39a1a7f3bc001766c1881841e9903c6b16f5a10b5666e0791d7f6444677d8b05` |
| `assets/sfx/quest.mp3` | xong một việc (quest) | Interface Sounds (1.0) | `Audio/confirmation_002.ogg` | `33b17a9a9a2397c62b285c52c33a907fdffb476909c99e42dde603f6a7a8b12c` |
| `assets/sfx/checklist.mp3` | xong một mục checklist | Music Jingles | `Audio/Pizzicato jingles/jingles_PIZZI04.ogg` | `f98fa4af012d443da636a2d90f2926adc2384ec833851918f88426be9a25acf9` |
| `assets/sfx/value.mp3` | thể hiện một giá trị cốt lõi | Music Jingles | `Audio/Pizzicato jingles/jingles_PIZZI16.ogg` | `1b1211b6360aae37ea685fee057bcabd034a749c1dfac6a9d643086d96e9b9aa` |
| `assets/sfx/advice.mp3` | lời khuyên mới vào Sổ lời khuyên | Interface Sounds (1.0) | `Audio/pluck_001.ogg` | `be97ec4893a02d6eccfb678daa76c83e34cb2583b834ec2593d2641def739fa4` |
| `assets/sfx/reward.mp3` | nhận phần thưởng / huy hiệu | Music Jingles | `Audio/Steel jingles/jingles_STEEL09.ogg` | `6eba3198a05a3388be4a1edc2d11135ac2b924d8418704e94636d3e0af3c2854` |
| `assets/sfx/act.mp3` | thẻ tiêu đề Act | Music Jingles | `Audio/Steel jingles/jingles_STEEL10.ogg` | `88a6645658b15dc327a2377ca7354e364625f081cd6ff9fda0b46dc54f664b71` |
| `assets/sfx/achievement.mp3` | thẻ thành tựu cuối (xong game) | Music Jingles | `Audio/Steel jingles/jingles_STEEL03.ogg` | `21233e95b5e2c167293484c9906264c632a5f1fe45744d1d5b52ba1dfb0a18fb` |
| `assets/sfx/step_concrete_1.mp3` | bước chân trên nền cứng (đường, vỉa hè, sàn gạch) | Impact Sounds (1.0) | `Audio/footstep_concrete_000.ogg` | `d7267e183067757c92c169de2a379abea592cfca6b39bb2e8feea15221ad79fe` |
| `assets/sfx/step_concrete_2.mp3` | bước chân trên nền cứng (đường, vỉa hè, sàn gạch) | Impact Sounds (1.0) | `Audio/footstep_concrete_001.ogg` | `507a75eb19b897087855a3be3cf11a12d7fa37d143ad535eeebe0b8031c7325d` |
| `assets/sfx/step_concrete_3.mp3` | bước chân trên nền cứng (đường, vỉa hè, sàn gạch) | Impact Sounds (1.0) | `Audio/footstep_concrete_002.ogg` | `b21fa546d74941196b25da8a20b7010abd8c05c4fcf93545d1f344e66a664e13` |
| `assets/sfx/step_concrete_4.mp3` | bước chân trên nền cứng (đường, vỉa hè, sàn gạch) | Impact Sounds (1.0) | `Audio/footstep_concrete_003.ogg` | `8b513c2f0316324060b9174b8f28df6c2147418c506e6a53b77f18e149a5547b` |
| `assets/sfx/step_concrete_5.mp3` | bước chân trên nền cứng (đường, vỉa hè, sàn gạch) | Impact Sounds (1.0) | `Audio/footstep_concrete_004.ogg` | `24dd8db2413e5b81ad181e1205c12a1c7801da5f85715d471b92a4b2f632e45e` |
| `assets/sfx/step_grass_1.mp3` | bước chân trên cỏ | Impact Sounds (1.0) | `Audio/footstep_grass_000.ogg` | `9d49497777405d78d7cf7f2888e28277f3a23192300cfd1d79d54876b20f479f` |
| `assets/sfx/step_grass_2.mp3` | bước chân trên cỏ | Impact Sounds (1.0) | `Audio/footstep_grass_001.ogg` | `fb28781bd22b2eefdc14077f1adf5c94d7fe9c3a130194633b55f3e0d39d9f04` |
| `assets/sfx/step_grass_3.mp3` | bước chân trên cỏ | Impact Sounds (1.0) | `Audio/footstep_grass_002.ogg` | `73a520139f5be716a403bfe9c80e0e94d1e61d8e9de04a354b336392164b53dc` |
| `assets/sfx/step_grass_4.mp3` | bước chân trên cỏ | Impact Sounds (1.0) | `Audio/footstep_grass_003.ogg` | `0546e1d8ab2def714425701a18bd34c5ee2794b12e858e5b595aabcf38a34137` |
| `assets/sfx/step_grass_5.mp3` | bước chân trên cỏ | Impact Sounds (1.0) | `Audio/footstep_grass_004.ogg` | `086fd4ab3546a507ea5f5c759a9a10e535c95ade13705c238bc0eeffd7d4e8ba` |
| `assets/sfx/step_carpet_1.mp3` | bước chân trên thảm văn phòng | Impact Sounds (1.0) | `Audio/footstep_carpet_000.ogg` | `b9524658b52a99a20590f8feefc103088637fd13ea8ec35811aee785e1f2f330` |
| `assets/sfx/step_carpet_2.mp3` | bước chân trên thảm văn phòng | Impact Sounds (1.0) | `Audio/footstep_carpet_001.ogg` | `9af3c3f76705107339e72036e4053bdca3eaa50ad31c8c929f42ce8d40e5d781` |
| `assets/sfx/step_carpet_3.mp3` | bước chân trên thảm văn phòng | Impact Sounds (1.0) | `Audio/footstep_carpet_003.ogg` | `4ae7454338d57c7d102145919ae653c7d010eb542797c4f25a1c7470be3a7e4c` |
| `assets/sfx/door_unlock.mp3` | khoá cửa kính nhả (cửa quẹt thẻ, cửa Phòng FSA) | RPG Audio | `Audio/metalLatch.ogg` | `ba9ba60b172b3ebc131a940f25793cd2e207aca7af73dc80d637277f060f1708` |
| `assets/sfx/pool_cue_1.mp3` | bi-a: đầu cơ chạm bi cái | Impact Sounds (1.0) | `Audio/impactWood_light_001.ogg` | `4b76bf3ccc8e60d19188f3165b778a7817786faa6887c55d9049bcbeef3b425f` |
| `assets/sfx/pool_cue_2.mp3` | bi-a: đầu cơ chạm bi cái | Impact Sounds (1.0) | `Audio/impactWood_light_003.ogg` | `cdfbe8af2fe7ff9ee28f337a0a989deee0f327620da456c8413644880e9d0004` |
| `assets/sfx/pool_ball_1.mp3` | bi-a: bi chạm bi (âm lượng theo tốc độ va) | Casino Audio (1.1) | `Audio/chips-collide-1.ogg` | `f41b3d106360fc68ebc061a211d4265b4cb5fa1fbe86e4d57d3673510e2c3784` |
| `assets/sfx/pool_ball_2.mp3` | bi-a: bi chạm bi (âm lượng theo tốc độ va) | Casino Audio (1.1) | `Audio/chips-collide-2.ogg` | `2a10c5ff4b2fbaa55a317fc258ddce3fec85bd26db2d3c2ad298b3b33ce23bc6` |
| `assets/sfx/pool_ball_3.mp3` | bi-a: bi chạm bi (âm lượng theo tốc độ va) | Casino Audio (1.1) | `Audio/chips-collide-3.ogg` | `1c5e885f72b64c38fff7ef05579e49310e7acf026cf123ffb65fffb57fb06e1c` |
| `assets/sfx/pool_ball_4.mp3` | bi-a: bi chạm bi (âm lượng theo tốc độ va) | Casino Audio (1.1) | `Audio/chips-collide-4.ogg` | `1ffa34af64adc62fce583c5aa9a3c98287b1673ef191576a5571f1ffd39529dd` |
| `assets/sfx/pool_rail_1.mp3` | bi-a: bi chạm băng | Impact Sounds (1.0) | `Audio/impactSoft_medium_000.ogg` | `7d3ba0bb5e60a11b5d3e558c141303dcf494256675fbf753c0d252d2cf0481e3` |
| `assets/sfx/pool_rail_2.mp3` | bi-a: bi chạm băng | Impact Sounds (1.0) | `Audio/impactSoft_medium_002.ogg` | `5069e3571a77d7f7aae9ef71d0364aa245fb7d64a7c8cc9956f221d03088c089` |
| `assets/sfx/pool_rail_3.mp3` | bi-a: bi chạm băng | Impact Sounds (1.0) | `Audio/impactSoft_medium_003.ogg` | `5c4a1f35fde7e14046931da7bc3d1b23736541b7190ba107e08a379c4ca43cd6` |
| `assets/sfx/pool_pocket_1.mp3` | bi-a: bi rơi vào lỗ | Impact Sounds (1.0) | `Audio/impactWood_medium_000.ogg` | `1723a9fd25103ed41af06054814e84e65f4a772bac86ab2dc927da93d9592ff5` |
| `assets/sfx/pool_pocket_2.mp3` | bi-a: bi rơi vào lỗ | Impact Sounds (1.0) | `Audio/impactWood_medium_002.ogg` | `3f3f1917428b828f733a963167833c707bf88296ff158e1559c57c5cb813d799` |

Chỉnh sửa so với file gốc: trộn về mono, cắt khoảng lặng đầu / cuối, chuẩn hoá đỉnh −1 dBFS, đổi sang MP3 96 kbps. CC0 cho phép sửa đổi tự do.

## File tự tạo

| File trong game | Dùng ở | Công thức (`synth.py`) | Cách tạo |
| --- | --- | --- | --- |
| `assets/sfx/progress.mp3` | thanh tải khi cài app (1,1 giây) | `progress` | thanh tải 1,1 giây: tiếng ngân nhẹ đi lên + nhịp tích tắc |
| `assets/sfx/shutter.mp3` | chụp ảnh check-in / ảnh thẻ | `shutter` | máy ảnh: tách (màn trập mở) – rè rất ngắn – tách (đóng) |
| `assets/sfx/splash.mp3` | giếng làng: trượt vùng xanh, nước đổ | `splash` | nước đổ lại vào giếng: tiếng ào (nhiễu lọc thấp dần) + bọt nước (tiếng 'bụp' tần số đi lên) |
| `assets/sfx/grain.mp3` | nhặt hạt lúa vàng | `grain` | hạt lúa vàng: 3 tiếng chuông nhỏ đi lên (A5, C#6, E6) + lấp lánh |
| `assets/sfx/phone.mp3` | tin nhắn điện thoại / app (câu thoại kiểu tin nhắn, nhắc khi không có Tú, báo 17:30) | `phone` | tin nhắn mới: 2 nốt kiểu đàn gỗ (C6 → G6, quãng 5 đi lên) |
| `assets/sfx/door_swing.mp3` | cánh cửa kính mở | `door_swing` | cánh cửa kính mở: tiếng gió lùa nhẹ (nhiễu hồng, dải giữa trượt lên) |
| `assets/sfx/card_ok.mp3` | đầu đọc thẻ: thẻ hợp lệ (đèn xanh) | `card_ok` | đầu đọc thẻ: 2 tiếng bíp cao ngắn (thẻ hợp lệ) |
| `assets/sfx/card_fail.mp3` | đầu đọc thẻ: thẻ báo đỏ | `card_fail` | đầu đọc thẻ: 2 tiếng rè trầm (thẻ báo đỏ) |
| `assets/sfx/bus_door.mp3` | cửa xe bus đóng / mở (hơi nén) | `bus_door` | cửa xe bus: xì hơi nén rồi 'cạch' khi cánh cửa chạm khung |
| `assets/sfx/bus_brake.mp3` | xe bus dừng ở bến (xả hơi phanh) | `bus_brake` | xe bus dừng: xả hơi phanh (xì mạnh, tắt dần) |

Tạo lại đúng từng file (nhiễu dùng hạt ngẫu nhiên cố định): chạy `build_sfx.py` (lệnh ở đầu file).

## Tạo lúc chơi (không có file)

| Âm thanh | Ở đâu | Cách tạo |
| --- | --- | --- |
| Tiếng nền phố sáng sớm (zone 0): xe cộ xa, xe máy chạy qua, chim | `game/src/core/ambience.js` → `street` | nhiễu nâu lọc thấp, sóng răng cưa lọc thấp trượt tần (xe máy), sóng sin quét tần (chim) |
| Tiếng nền campus (zone 1–2): gió, lá xào xạc, chim; hoàng hôn ở bến xe: dế | `ambience.js` → `campus`, `evening` | nhiễu hồng lọc dải, sóng sin quét tần, sóng sin điều biên (dế) |
| Tiếng nền trong nhà (zone 3–5): máy lạnh, gõ phím, tiếng bước chân xa | `ambience.js` → `lobby`, `corridor`, `office` | nhiễu nâu lọc thấp, chuỗi tiếng tách ngắn từ nhiễu lọc dải |
| Tiếng máy xe bus (cảnh lên / xuống xe, cảnh kết) | `ambience.js` → `Engine` | sóng răng cưa + vuông theo tốc độ xe, nhiễu lọc thấp |
| Tiếng vang trong nhà | `ambience.js` → `impulse()` | phản hồi xung tạo từ nhiễu tắt dần |

## Thêm âm thanh mới

1. Chỉ dùng nguồn **CC0** (vd các gói trên kenney.nl) hoặc tự tạo bằng công thức trong `synth.py`. Không dùng file CC BY / NC / SA, file "free" không ghi giấy phép rõ ràng, hay tiếng lấy từ game / phim / bài hát khác.
2. Gói mới: tải zip vào `assets/sfx/source/` (không đưa lên repo), khai ở `data/sounds.json` → `sources` (trang, link tải, SHA-256, kích thước, ngày tải, `license: "CC0-1.0"`, file giấy phép trong zip).
3. Thêm mục ở `data/sounds.json` → `sounds` (`src` hoặc `synth`, `use`: dùng ở đâu), chạy `build_sfx.py`, rồi `npm --prefix game run test:data`.
