# Kiểm tra zone_04_corridor và zone_05_office so với GDD

Ngày 09/10/2026. Đối chiếu `assets/glb/low/zone_04_corridor.glb` và `zone_05_office.glb` với GDD (mục Zone 4, Zone 5).

**Cách kiểm tra:**
- Đọc danh sách node trong GLB.
- Tải từng zone vào bản dev của game bằng `__game.goto(zone, spawn, file)`. Hai zone này chưa có trong
  `data/zones.json`.
- Dùng chính capsule va chạm của người chơi (bán kính 0,3 m) để:
  - đi thử mọi lối (`__game.walkTo`);
  - quét va chạm từ mọi `SPAWN_` (`__game.collisionScan`: 16 hướng × 3 s chạy);
  - kiểm tra chỗ đứng của NPC so với các hộp `COL_` (`__game.colAt`).

## Kết luận

- **Đủ node chính.** Chỉ thiếu 2 điểm xuất hiện đúng tên GDD: `SPAWN_zone_04_from_zone_03` và
  `SPAWN_zone_05_from_zone_04`. **Đã thêm**, đặt trùng vị trí `SPAWN_zone_0X_start` sẵn có.
- **Hai lỗi va chạm, đã sửa trong script Blender và xuất lại GLB:**
  - Zone 4: đầu hành lang phía đông không có hộp va chạm. Nếu trigger quay về zone 3 không chạy, người chơi đi tiếp và
    rơi khỏi bản đồ.
  - Zone 5: hai chậu cọ ở khu nghỉ không có hộp va chạm, nhân vật đi xuyên qua được.
- Lối đi đủ rộng ở mọi chỗ, đi được hết bằng capsule người chơi. NPC đứng không nằm trong vật.
- **Hạt lúa** không phải node trong GLB: game đặt theo toạ độ trong `data/interactables.json` → `grains`. Tôi đã thử chỗ
  đứng nhặt và đề xuất toạ độ (mục "Cần sửa trong dữ liệu").
- Một số việc nằm ở dữ liệu hoặc code game (đăng ký zone, trigger chuyển zone, vị trí người lạ, mở cửa quẹt thẻ). Phiên
  này không sửa phần đó; danh sách ở cuối.

## Danh sách node

Ký hiệu: ✅ có · ➕ đã thêm trong lần này · — không cần trong GLB (code đặt).

### Zone 4 — `zone_04_corridor.glb`

| Node | Trạng thái | Vị trí (glTF, m) / ghi chú |
| --- | --- | --- |
| `SPAWN_zone_04_from_zone_03` | ➕ | (11,0; 0; 0), đầu hành lang phía đông, nhìn về phía cửa quẹt thẻ; trùng `SPAWN_zone_04_start`. **Từ 10/10/2026: (9,0; 0; 0)** (dời vào 2 m, xem cuối file) |
| `SPAWN_zone_04_start` | ✅ | giữ lại cho `zones.json` → `start` |
| `SPAWN_zone_04_from_zone_05` | ✅ | (−10,5; 4,2; 6,0), tầng trên, trước cửa FSA (khi quay lại từ zone 5) |
| `INT_cua_quet_the` | ✅ | cửa kính khung đen 2 cánh + đầu đọc thẻ; `TRIGGER_cua_quet_the` |
| `INT_cua_phong_fsa` | ✅ | cửa kính Wing 3, tầng trên; `TRIGGER_cua_phong_fsa` |
| `TRIGGER_cau_thang` | ✅ | chân vế 1 cầu thang chữ U |
| `TRIGGER_zone_03_enter` | ✅ | đầu hành lang phía đông (quay về zone 3) |
| `TRIGGER_zone_05_enter` | ✅ | sát cửa FSA (sang zone 5); người chơi chạm tới được (x −11,64 < −11,5) |
| Người lạ, Tú | — | code đặt: người lạ = vai `nguoi_la` cạnh `INT_cua_quet_the` |
| Hạt lúa × 1 (chiếu nghỉ) | — | dữ liệu; toạ độ đề xuất ở dưới |

### Zone 5 — `zone_05_office.glb`

| Node | Trạng thái | Vị trí (glTF, m) / ghi chú |
| --- | --- | --- |
| `SPAWN_zone_05_from_zone_04` | ➕ | (−1,2; 0; 0), ngay sau cửa FSA, nhìn vào văn phòng; trùng `SPAWN_zone_05_start` |
| `SPAWN_zone_05_start` | ✅ | |
| `NPC_mentor` trong `INT_phong_hop_mentor` | ✅ | NPC (−15,8; 0; −5,25); phòng họp có `TRIGGER_` và `SPAWN_phong_hop_mentor` |
| `NPC_manager` trong `INT_phong_hop_manager` | ✅ | NPC (−24,8; 0; −5,25); phòng họp có `TRIGGER_` và `SPAWN_phong_hop_manager` |
| `NPC_dong_nghiep_1..3` | ✅ | ngồi ở cụm bàn đầu (Lan, Minh) và cụm thứ hai (Hà); `TRIGGER_khu_team` |
| `NPC_ban_bi_a` | ✅ | (−2,2; 0; −1,6), cạnh bàn bi-a |
| `INT_ban_lam_viec` | ✅ | bàn intern (−11,9; 0; 5,0): laptop, hộp quà, bảng tên trống; `TRIGGER_ban_lam_viec` |
| `SPAWN_ban_lam_viec` | ✅ | chỗ ngồi ở bàn intern (−11,9; 0; 4,0) |
| `TRIGGER_zone_04_enter` | ✅ | sau cửa FSA (quay về zone 4) |
| Hạt lúa × 2 (kệ ô vuông, dưới bàn bi-a) | — | dữ liệu; toạ độ đề xuất ở dưới |

Zone 5 là điểm kết thúc, không cần trigger sang zone khác. Cảnh kết (về zone_01 lúc hoàng hôn) do cảnh chuyển đảm nhận.

## Va chạm (`COL_`)

### Lối đi và độ rộng (capsule người chơi rộng 0,6 m)

| Chỗ | Rộng thông thủy | Kết quả đi thử |
| --- | --- | --- |
| Z4 hành lang tầng trệt (giữa tường bắc và dãy tủ thấp) | 2,85 m | ✅ |
| Z4 cửa quẹt thẻ | 2,6 m (cửa đóng có `COL_cua_quet_the`) | ✅ tới trước cửa; người lạ đứng chắn nửa phải (xem dưới) |
| Z4 vế 1, chiếu nghỉ, vế 2 (dốc ~30°) | 2,6 m | ✅ lên xuống được cả 2 chiều |
| Z4 cửa đầu cầu thang lên tầng trên | 2,6 m | ✅ |
| Z4 tầng trên, vòng qua lỗ thông tầng (có lan can) | ≥ 4 m | ✅; `COL_lo_thong_tang` chặn đúng |
| Z4 tới cửa FSA | 3,2 m | ✅; vào được `TRIGGER_zone_05_enter` |
| Z5 lối đi chính | 3,0 m | ✅ |
| Z5 cửa phòng họp mentor / manager | 2,6 m | ✅ vào được trong phòng; phía nam bàn họp |
| Z5 giữa bàn họp mentor và tường đông (chỗ NPC đứng) | 1,0 m | ✅ (đứng tới cách NPC 0,4 m) |
| Z5 khe giữa 2 cụm bàn | 2,6 m | ✅ |
| Z5 giữa 2 hàng cụm bàn | 4,5 m | ✅ |
| Z5 tới chỗ ngồi bàn intern (đi từ phía lối đi chính) | — | ✅ |
| Z5 khu nghỉ (bàn bi-a, ghế tulip, 2 kệ ô vuông) | ≥ 1,5 m | ✅ |

**Quét va chạm** (`collisionScan`, 16 hướng × 3 s từ mọi `SPAWN_`):

| Zone | Trước khi sửa | Sau khi sửa |
| --- | --- | --- |
| Zone 4 | 7 hướng từ `SPAWN_zone_04_start` rơi khỏi bản đồ ở đầu hành lang phía đông | 0 lỗi |
| Zone 5 | 0 lỗi, nhưng đi xuyên được 2 chậu cọ | 0 lỗi; chậu cọ chặn đúng |

### Cửa
- **Cửa quẹt thẻ:** `COL_cua_quet_the` chặn khi cửa đóng. Code zone 4 sau này phải tắt hộp này khi quẹt thẻ thành công
  (xem mục cuối).
- **Cửa FSA:**
  - Ở zone 4, `COL_cua_phong_fsa` nằm ngay sau `TRIGGER_zone_05_enter`: tới cửa là chuyển zone.
  - Ở zone 5, `COL_cua_fsa` nằm sau `TRIGGER_zone_04_enter`: không lọt ra ngoài bản đồ.

### Chỗ đứng của NPC

| NPC | Kết quả |
| --- | --- |
| Mentor, manager, anh Khang (đứng) | Không chạm hộp `COL_` nào. Mentor cách bàn họp đúng 0,3 m (vừa sát mép, không lấn), cách tường đông 0,4 m. |
| Lan, Minh, Hà (ngồi) | Gốc nhân vật nằm trong hộp `COL_cum_ban_*`. Đúng như thiết kế: game dời người ngồi 0,39 m vào gầm bàn theo `seat.offset_xz_m`, chân nằm dưới bàn; người chơi không cần đi tới đó. |
| `SPAWN_ban_lam_viec` (người chơi ngồi) | Cách hộp cụm bàn 0,25 m, nên capsule đứng lấn 0,05 m và bị đẩy ra 0,05 m khi dịch chuyển tới. Không ảnh hưởng: đây là chỗ ngồi, khi ngồi game tắt di chuyển. |
| Người lạ zone 4 (code đặt) | Đứng ở (3,5; 0; −0,5): ngay trước nửa phải cửa quẹt thẻ, cách tường 1 m. Đi thẳng từ đầu hành lang tới giữa cửa thì bị người lạ chặn, phải đi vòng sang nửa trái. Nên dời ra cạnh đầu đọc thẻ (đề xuất ở dưới). |

## Đã sửa trong lần này (script Blender + GLB)

| File | Thay đổi |
| --- | --- |
| `scripts/blender/zone_04.py` | Thêm `SPAWN_zone_04_from_zone_03` (trùng `SPAWN_zone_04_start`); thêm `COL_dau_hanh_lang_dong` (x 12,0–12,3, cao 3,6 m) sau `TRIGGER_zone_03_enter`. Người chơi vẫn vào được trigger (dừng ở x 11,7 trong vùng 11,5–12,1). |
| `scripts/blender/zone_05.py` | Thêm `SPAWN_zone_05_from_zone_04` (trùng `SPAWN_zone_05_start`); thêm `COL_chau_cay_-1_+5` và `COL_chau_cay_-7_+5` (0,8 × 0,8 × 1,2 m) cho 2 chậu cọ khu nghỉ. |
| `assets/glb/low/zone_04_corridor.glb` | `python scripts/build.py zone_04`: Draco, `check_glb` 0 lỗi, 94 → 95 KB. So với bản cũ chỉ thêm 2 node trên, không node nào bị xoá hay dời chỗ. |
| `assets/glb/low/zone_05_office.glb` | `python scripts/build.py zone_05`: Draco + WebP như cũ, `check_glb` 0 lỗi, 124 → 126 KB. Chỉ thêm 3 node trên. |

Chỉ dựng bản **Thấp**; bản Cao đang tạm dừng.

**Ảnh tổng quan** (chỉ có trên máy làm việc, `renders/` không lên repo):
- `renders/zone45/zone_04_corridor_tong_quan.jpg`: mặt bằng tầng trên, hành lang, cửa quẹt thẻ, cầu thang, cửa FSA,
  giếng trời.
- `renders/zone45/zone_05_office_tong_quan.jpg`: mặt bằng, lối vào, phòng họp, khu team, bàn intern, bàn bi-a.
- Ảnh từng góc: `renders/zone_04_corridor_*.png`, `renders/zone_05_office_*.png`.

## Cần sửa trong dữ liệu (chỉ liệt kê, chưa sửa)

Toạ độ dưới đây là toạ độ glTF (x, y lên, z), đúng như các mục `pos` đang có.

1. **`data/zones.json`:** thêm `zone_04`, `zone_05` vào `order` và `zones`:
   ```json
   "zone_04": { "file": "zone_04_corridor", "start": "SPAWN_zone_04_from_zone_03" },
   "zone_05": { "file": "zone_05_office",   "start": "SPAWN_zone_05_from_zone_04" }
   ```
   Thêm `mood` nếu muốn ánh sáng riêng. Thêm tên hiển thị và giờ trong `data/i18n/en.json` → `zones`.
2. **`data/quests.json` → `triggers`:**
   - Zone 3 `TRIGGER_zone_04_enter`: thêm `"to_zone": "zone_04", "to_spawn": "SPAWN_zone_04_from_zone_03"` và bỏ
     `"blocked"`. Hiện dòng này không có `to_zone` nên chỉ hiện "zone_locked".
   - Thêm `{ "zone": "zone_04", "node": "TRIGGER_zone_03_enter", "to_zone": "zone_03", "to_spawn":
     "SPAWN_zone_03_from_zone_04", "requires": [] }`. Zone 3 đã có node `SPAWN_zone_03_from_zone_04`.
   - Thêm `{ "zone": "zone_04", "node": "TRIGGER_zone_05_enter", "to_zone": "zone_05", "to_spawn":
     "SPAWN_zone_05_from_zone_04", "requires": [<quest quẹt thẻ>, <quest phòng FSA>] }`. GDD: quẹt thẻ và phòng FSA là
     bắt buộc.
   - Thêm `{ "zone": "zone_05", "node": "TRIGGER_zone_04_enter", "to_zone": "zone_04", "to_spawn":
     "SPAWN_zone_04_from_zone_05", "requires": [] }`.
   - Thêm các quest zone 4 và 5 (quẹt thẻ, FSA, gặp Prajith, gặp Manager, Say Hello Team, bàn làm việc), gắn vào các
     mục checklist `card_gate`, `fsa`, `meet_prajith`, `meet_manager`, `hello_team`, `desk` đã có.
3. **`data/interactables.json` → `grains`:** 3 hạt còn thiếu (GDD: zone 4: 1, zone 5: 2). Đã thử chỗ đứng nhặt bằng
   capsule; bán kính nhặt mặc định 1,4 m.
   ```json
   { "id": "z4_chieu_nghi", "zone": "zone_04", "pos": [5.3, 2.4, -9.9],  "where": "Góc đông bắc chiếu nghỉ cầu thang" },
   { "id": "z5_ke_o_vuong", "zone": "zone_05", "pos": [-1.6, 1.5, 5.75], "where": "Trên nóc kệ ô vuông đỏ–trắng ở khu nghỉ (kệ cao 1,4 m)" },
   { "id": "z5_ban_bi_a",   "zone": "zone_05", "pos": [-4.0, 0.02, -2.35], "snap": false, "where": "Dưới mép bàn bi-a, phía lối đi" }
   ```
   - Chiếu nghỉ: đứng tới được ngay cạnh, cách 0,15 m.
   - Kệ ô vuông: đứng phía bắc kệ, cách 0,6 m theo phương ngang.
   - Bàn bi-a: đứng ở mép bàn, cách 0,87 m. **Phải có `"snap": false`:** game chiếu tia từ cao hơn `pos` 1,2 m xuống
     mặt gần nhất, nên không có cờ này thì hạt sẽ nằm trên mặt bàn bi-a thay vì dưới gầm.
4. **`data/characters.json` → `roles.nguoi_la.offset`:**
   - Hiện là `[1.2, 0, 1.0]`, nên người lạ đứng chắn nửa phải cửa quẹt thẻ.
   - Đề xuất `[1.9, 0, 0.6]`: người lạ đứng ở (4,2; 0; −0,9), cạnh đầu đọc thẻ, ngoài khung cửa. Người chơi đi giữa hành
     lang tới cửa không bị chặn, vẫn thấy người lạ khi tới quẹt thẻ.

## Ghi chú cho phần code zone 4–5 (khi làm Giai đoạn 2)

- Quẹt thẻ thành công thì tắt `COL_cua_quet_the` và mở hai cánh. Hai cánh là `cua_quet_the_canh_trai` và `_phai`, có
  custom property `hinge`; xoay quanh bản lề. Tương tự với cửa FSA nếu muốn cửa mở trước khi chuyển zone.
- Zone 4 có hai tầng, sàn trên cao 4,2 m. Cầu thang dựng bằng 2 dốc va chạm (`COL_ve_1`, `COL_ve_2`), capsule leo được.
  Chưa thử camera góc thứ ba khi quay đầu ở chiếu nghỉ (sảnh cầu thang hẹp 7 m, trần cao 7,4 m), nên kiểm tra khi làm
  zone 4.

## Dựng lại zone_04 (10/10/2026): thay 3 bản vá dữ liệu bằng đồ thật trong GLB

`python scripts/build.py zone_04` (bản Thấp). Script chưa sửa dựng lại ra GLB giống hệt bản đang commit (từng byte). Sau khi
sửa `scripts/blender/zone_04.py`, GLB chỉ khác ở các chỗ dưới; mọi node cũ vẫn còn, cùng vị trí.

| Thay đổi | Toạ độ glTF | Thay cho (đã bỏ) |
| --- | --- | --- |
| `SPAWN_zone_04_from_zone_03` dời vào 2 m | (9,0; 0; 0), vẫn nhìn về cửa quẹt thẻ; `SPAWN_zone_04_start` giữ ở (11,0; 0; 0) | `zones.json` → `zone_04.spawn_offset` |
| `COL_tuong_bac_tren_cua`: vách trên cửa quẹt thẻ | x 1,0–3,6; cao 2,55–4,2; z −1,65 … −1,35 | `collision.json` → `zone_04.add` `camera_tren_cua_quet_the` (cao 2,55–3,65) |
| Lan can song sắt mép tây chiếu trên (trong `ENV_cau_thang`, +156 tam giác) | x 3,35; sàn 4,2 m, tay vịn 5,2 m; z −3,0 … −1,6 | — |
| `COL_lan_can_chieu_tren` | x 2,6–3,4; cao 2,6–6,0; z −3,0 … −1,65 (trùng hộp dữ liệu cũ) | `collision.json` → `zone_04.add` `lan_can_chieu_tren` |

`data/collision.json` không còn mục `zone_04`.
