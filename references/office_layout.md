# Văn phòng theo ba video tham chiếu

Yêu cầu ngày 12/10/2026: vào từ phòng chính, nối tới phòng phụ bằng hành lang;
ba phòng họp bên trái khi đi từ phòng phụ sang phòng chính, bên phải ở chiều ngược lại.

## Tư liệu và cách dựng

- `VanPhongLamViec.mp4`: cửa kính / đầu đọc thẻ, bàn bi-a cạnh lối vào, kệ đỏ–trắng,
  khu bàn trắng / ghế lưới, bàn làm việc đen với vách gỗ cam và cây, sàn caro xanh / vàng,
  trần thả trắng và đèn panel. Giữ khu nghỉ tại lối vào, bàn intern và các tương tác hiện có.
- `2hgb6fgdsy6mehwougvbaggp0un9yfmsz6my2.mp4`: phòng phụ có bàn làm việc, tủ thấp
  đặt cây, lối sàn gỗ, vách kính với dải mờ và rèm cửa sổ.
- `2hgb6fgdsy5bvvqlfur14ouxy5nrsueccy2c1.mp4`: hành lang sàn gỗ dài, cửa phòng họp
  khung tối, dải mờ trên kính, cửa sổ phía đối diện, trần trắng với lưới thông gió.

Video không cung cấp kích thước đo thực tế; kích thước được ước lượng theo bàn và cửa,
giữ khoảng trống cho nhân vật và camera của game. Không dùng ảnh người / thẻ từ video làm texture.
Video và khung trích xuất chỉ ở máy làm việc, được gitignore.

## Bố cục

Tọa độ Blender: Z lên, X/Y trên sàn. Trục +X đi từ phòng phụ về phòng chính.

| Khu | X | Y |
| --- | --- | --- |
| Lối vào / khu nghỉ | −8 … 0 | −6 … 6 |
| Phòng chính | −34 … −8 | −14 … 8 |
| Hành lang | −52 … −34 | −1,5 … 1,5 |
| Ba phòng họp | −52 … −34 | 1,5 … 7,5 |
| Phòng phụ | −70 … −52 | −8 … 8 |

Phòng họp nằm phía +Y của hành lang: bên trái khi nhìn theo +X, bên phải khi nhìn theo −X.
Tên tạm **Phòng họp 1 / 2 / 3**, từ gần phòng chính tới gần phòng phụ.
Đổi trường `meeting_rooms[].name` trong `data/office.json`, sau đó build lại zone 5.
Cửa phòng họp mở sẵn vào trong 85° để đi được, có cánh, khung, tay nắm và va chạm;
chưa thêm cơ chế đóng / mở cửa bằng thao tác người chơi.

Giữ ID `INT_phong_hop_mentor`, `INT_phong_hop_manager`, NPC và spawn tương ứng
để tiến trình nhiệm vụ hiện tại tiếp tục hoạt động; phòng họp thứ ba dành cho nội dung sau.
Giữ vị trí và số đo bàn bi-a, bàn intern và ba đồng nghiệp. Phòng phụ có 16 bàn thêm,
dùng chung mesh / material và gộp lượt vẽ khi tải zone. Cả hai phòng nối bằng lối giữa 3 m.

## Kiểm tra

- Kiểm tra GLB: node game, metadata, va chạm không material; Draco và ngân sách dưới
  60.000 tam giác / 2 MiB.
- `scripts/tests/office.mjs`: đọc GLB thật để kiểm tra tên, phía phòng họp, sàn liên tục,
  khoảng trống capsule dọc hành lang và cửa, các node nhiệm vụ còn đủ.
- Smoke trên GitHub: capsule thật đi hai chiều và vào ba cửa; bàn phụ được gộp;
  luồng chơi, bi-a, camera, map và bộ nhớ dùng các kiểm tra hiện có.
- Dò khe hở zone 5 tăng tầm tia lên 100 m vì chiều dài văn phòng mới trên 70 m;
  không dùng giới hạn 60 m cũ để kết luận nhầm hành lang dài là khe hở.
- Có mặt sân thấp hơn sàn 4,2 m phía ngoài cửa sổ (2 tam giác, không thêm vùng đi),
  tránh nhìn xiên qua kính thấy khoảng trống. Zone 5 yêu cầu không còn tia nhìn xuống lọt ra trời.
- Hiệu năng trên GPU của người chơi cần đo riêng; số tam giác / dung lượng và test CI
  không tương đương phép đo FPS trên máy thật. Không chạy Chrome local theo lựa chọn người dùng.
