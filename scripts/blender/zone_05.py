"""zone_05_office — khu nghỉ, phòng họp mentor/manager, khu team, bàn làm việc của intern.

Chạy:  python scripts/build.py zone_05

Bố cục (người chơi vào từ cửa FSA phía đông, đi về -X):
  x  -8..0    KHU NGHỈ sàn gỗ: bàn bi-a, kệ ô vuông đỏ–trắng, ghế tulip. Cửa FSA ở x = 0, y -1.6..1.6
  x -34..-8   VĂN PHÒNG sàn gạch caro xanh 4 tông
     lối đi chính y -1.5..1.5 (3 m)
     phía bắc: PHÒNG HỌP MENTOR (x -21..-15) và PHÒNG HỌP MANAGER (x -30..-24), hộp kính tối, cửa mở ra lối đi
     phía nam: 6 cụm bàn (2 hàng × 3 cụm × 8 bàn); BÀN INTERN ở đầu dãy gần lối vào (x ≈ -11.9)
Sàn zone này z = 0 (tầng trên; zone_04 đặt tầng trên ở z 4.2).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
for _m in [k for k in sys.modules if k == "lib" or k.startswith("lib.")]:
    del sys.modules[_m]

import bpy  # noqa: E402

from lib import interior as it  # noqa: E402
from lib import kit, zone  # noqa: E402
from lib import markers as mk  # noqa: E402
from lib.mesh import MeshBuilder  # noqa: E402

ZONE = "zone_05_office"
H = it.CEIL_OFFICE
BREAK = (-8.0, 0.0, -6.0, 6.0)
OFFICE = (-34.0, -8.0, -14.0, 8.0)
FSA_Y = (-1.6, 1.6)
OPEN_Y = (-1.5, 1.5)                    # lối từ khu nghỉ sang văn phòng
ROOM_MENTOR = (-21.0, -15.0, 2.5, 8.0)
ROOM_MANAGER = (-30.0, -24.0, 2.5, 8.0)
ROOM_DOOR = 2.6
CLUSTERS_X = (-14.0, -22.2, -30.4)       # tâm các cụm bàn
CLUSTERS_Y = (-5.0, -11.0)               # đường vách ngăn giữa 2 hàng
DESK_W = 1.4
INTERN = (CLUSTERS_X[0] + 1.5 * DESK_W, CLUSTERS_Y[0])  # bàn đầu dãy gần lối vào, hàng phía bắc (yaw 180)


def office_floor_color(i, j):
    """Mảng gạch caro lớn 2.4 m, 4 tông xanh (khối 4×4 viên 0.6 m)."""
    bi, bj = i // 4, j // 4
    return (bi * 7 + bj * 13 + (bi * bj) % 3) % 4


def build_shell(col, rng):
    b = MeshBuilder()
    bx0, bx1, by0, by1 = BREAK
    ox0, ox1, oy0, oy1 = OFFICE
    # sàn
    it.floor_tiles(b, bx0, by0, bx1, by1, 0.0, ["san_go_vp", "san_go_vp_2"], cell=0.5, mat="gloss",
                   jitter=lambda i, j: int((i * 3 + j * 7) % 5 == 0))
    it.floor_tiles(b, ox0, oy0, ox1, oy1, 0.0, ["office_tile_dk", "office_tile_md", "office_tile_yl", "office_tile_lt"],
                   cell=0.6, mat="gloss", jitter=office_floor_color)
    # trần + đèn panel LED
    it.ceiling_tex(b, bx0, by0, bx1, by1, H, mat="ceiling_grid_tex")
    it.ceiling_tex(b, ox0, oy0, ox1, oy1, H, mat="ceiling_grid_tex")
    for x in range(int(ox0) + 2, int(bx1), 3):
        for y in range(int(oy0) + 2, int(oy1), 3):
            if not (ROOM_MANAGER[0] < x < ROOM_MENTOR[1] and y > ROOM_MENTOR[2]):
                b.box((x, y, H - 0.01), (0.6, 0.6, 0.02), "lamp_white", mat="light")
    # tường khu nghỉ (cửa FSA phía đông, lối sang văn phòng phía tây)
    it.wall(b, (bx1, by0), (bx1, by1), 0, H, openings=[(FSA_Y[0] - by0, FSA_Y[1] - by0, 2.6)])
    it.wall(b, (bx0, by1), (bx1, by1), 0, H)
    it.wall(b, (bx1, by0), (bx0, by0), 0, H)
    it.wall(b, (bx0, by0), (bx0, by1), 0, H, openings=[(OPEN_Y[0] - by0, OPEN_Y[1] - by0, H)])
    it.hex_panels(b, bx0 - 0.13, by0 + 0.3, OPEN_Y[0] - 0.2, 0.1, H - 0.1, face=-1)
    it.hex_panels(b, bx0 - 0.13, OPEN_Y[1] + 0.2, by1 - 0.3, 0.1, H - 0.1, face=-1)
    # tường văn phòng
    it.wall(b, (ox0, oy0), (ox1, oy0), 0, H)
    it.wall(b, (ox0, oy1), (ox1, oy1), 0, H)
    it.wall(b, (ox0, oy0), (ox0, oy1), 0, H)
    it.wall(b, (ox1, oy1), (ox1, by1), 0, H)
    it.wall(b, (ox1, by0), (ox1, oy0), 0, H)
    # cửa FSA nhìn từ bên trong (khung, đầu đọc thẻ phía trong)
    it.door_handles(b, bx1 - 0.08, 0.0, along="y")
    it.card_reader(b, bx1 - 0.13, FSA_Y[0] - 0.4, 1.2, face=(-1, 0))
    it.fire_cabinet(b, -9.0, oy1 - 0.15, face=(0, -1))
    # cửa sổ rèm cuốn (tường nam + tây văn phòng), len chân tường, tranh treo tường khu nghỉ
    it.window_band(b, (ox0, oy0), (ox1, oy0), (0, 1), rng=rng)
    it.window_band(b, (ox0, oy0), (ox0, oy1), (1, 0), rng=rng)
    for p0, p1, inw in (((ox0, oy0), (ox1, oy0), (0, 1)), ((ox0, oy1), (ox1, oy1), (0, -1)),
                        ((ox0, oy0), (ox0, oy1), (1, 0)), ((bx0, by1), (bx1, by1), (0, -1)),
                        ((bx0, by0), (bx1, by0), (0, 1))):
        it.baseboard(b, p0, p1, inw)
    for k, c in enumerate(("fpt_orange", "office_tile_md", "fpt_blue")):
        it.wall_frame(b, -6.0 + k * 1.6, by1 - 0.13, 1.7, 1.0, 0.7, (0, -1), c)
    return b.to_object("ENV_vo_phong", col)


def build_break_area(col, rng):
    b = MeshBuilder()
    it.pool_table(b, -4.0, 3.0)
    it.cube_shelf(b, -7.6, -3.5, yaw=90)
    it.cube_shelf(b, -2.0, -5.75, cols=4, rows=3, yaw=0)
    it.tulip_set(b, -4.2, -3.0)
    for x, y in ((-1.0, 5.2), (-7.2, 5.2)):
        it.potted_palm(b, x, y, rng, h=1.4, pot="sign_white")
    return b.to_object("ENV_khu_nghi", col)


def build_meeting_rooms(cols, rng):
    I = cols["INT"]
    out = {}
    for key, label, (x0, x1, y0, y1) in (("phong_hop_mentor", "Phòng họp Mentor", ROOM_MENTOR),
                                         ("phong_hop_manager", "Phòng họp Manager", ROOM_MANAGER)):
        cx = (x0 + x1) / 2
        b = MeshBuilder()
        it.meeting_room(b, x0, y0, x1, y1, ("S", cx - ROOM_DOOR / 2, cx + ROOM_DOOR / 2), h=H, rng=rng)
        # biển phòng (placeholder màu: mentor = cam, manager = xanh dương)
        b.box((cx + ROOM_DOOR / 2 + 0.5, y0 - 0.06, 2.0), (0.5, 0.02, 0.3), "fpt_orange" if "mentor" in key else "fpt_blue")
        mesh = b.to_object(f"{key}_mesh", I)
        root = mk.interactive(key, label, (cx, (y0 + y1) / 2, 0), I)
        mk.parent(mesh, root)
        out[key] = (x0, x1, y0, y1)
    return out


def desk_rows():
    """Danh sách (x, y, yaw) của mọi bàn, vách ngăn chung tại y = cy.
    yaw 0: bàn nằm phía nam vách, người ngồi nhìn về +Y; yaw 180: bàn phía bắc, người nhìn về -Y."""
    rows = []
    for cy in CLUSTERS_Y:
        for cx in CLUSTERS_X:
            for k in range(4):
                x = cx + (k - 1.5) * DESK_W
                rows.append((x, cy, 180))
                rows.append((x, cy, 0))
    return rows


def build_desks(cols, rng):
    """Bàn dùng chung 2 mesh (có/không chậu cây) → GLB nhẹ. Bàn intern là bản riêng có đồ chào mừng."""
    E = cols["ENV"]
    b1 = MeshBuilder()
    it.desk_unit(b1, plant=True)
    m_plant = b1.to_object("ENV_ban_mau_cay", E).data
    b2 = MeshBuilder()
    it.desk_unit(b2, plant=False)
    m_plain = b2.to_object("ENV_ban_mau", E).data
    bpy.data.objects.remove(bpy.data.objects["ENV_ban_mau_cay"])
    bpy.data.objects.remove(bpy.data.objects["ENV_ban_mau"])
    n = 0
    intern_pos = None
    for i, (x, y, yaw) in enumerate(desk_rows()):
        # bàn intern: đầu dãy gần lối vào, hàng phía bắc của cụm đầu (ngồi quay lưng ra lối đi chính)
        if intern_pos is None and abs(x - INTERN[0]) < 0.01 and abs(y - INTERN[1]) < 0.01 and yaw == 180:
            intern_pos = (x, y, yaw)
            continue
        o = bpy.data.objects.new(f"ENV_ban_{n:02d}", m_plant if i % 3 == 0 else m_plain)
        E.objects.link(o)
        o.location = (x, y, 0)
        o.rotation_euler = (0, 0, math.radians(yaw))
        n += 1
    # bàn intern
    x, y, yaw = intern_pos
    b = MeshBuilder()
    it.desk_unit(b, plant=True)
    b.box((0.35, -0.4, 0.78), (0.34, 0.24, 0.02), "concrete_grey")                  # laptop
    b.box((0.35, -0.29, 0.9), (0.34, 0.02, 0.22), "concrete_grey", rot=(-15, 0, 0))
    b.box((-0.5, -0.45, 0.85), (0.3, 0.22, 0.18), "fpt_orange")                     # hộp quà chào mừng
    b.box((-0.5, -0.45, 0.85), (0.31, 0.04, 0.19), "fpt_green")
    b.box((0.0, -0.66, 0.8), (0.3, 0.04, 0.1), "sign_white", rot=(-30, 0, 0))     # bảng tên (để trống)
    desk = b.to_object("ban_lam_viec_mesh", cols["INT"], location=(x, y, 0))
    desk.rotation_euler = (0, 0, math.radians(yaw))
    root = mk.interactive("ban_lam_viec", "Bàn làm việc của bạn", (x, y, 0), cols["INT"])
    mk.parent(desk, root)
    return intern_pos


def build_markers(g, intern):
    mk.spawn("zone_05_start", (-1.2, 0.0, 0.0), yaw_deg=90, collection=g)
    mk.spawn("zone_05_from_zone_04", (-1.2, 0.0, 0.0), yaw_deg=90, collection=g)   # tên theo GDD (vào từ cửa FSA)
    x, y, yaw = intern
    r = math.radians(yaw)
    seat = (x + math.sin(r) * 1.0, y - math.cos(r) * 1.0)   # chỗ ngồi (phía -Y của bàn khi yaw 0)
    mk.spawn("ban_lam_viec", (*seat, 0.0), yaw_deg=yaw, collection=g)
    for key, room in (("mentor", ROOM_MENTOR), ("manager", ROOM_MANAGER)):
        x0, x1, y0, y1 = room
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        mk.npc(key, (x1 - 0.8, cy, 0.0), "Mentor" if key == "mentor" else "Manager", yaw_deg=90, collection=g)
        mk.trigger(f"phong_hop_{key}", (cx, y0 + 0.2, 1.2), (ROOM_DOOR, 1.6, 2.4), g)
        mk.spawn(f"phong_hop_{key}", (cx - 1.2, cy - 0.95, 0.0), yaw_deg=0, collection=g)
    # đồng nghiệp ngồi ở bàn
    for k, (dx, dy, yaw, lbl) in enumerate(((CLUSTERS_X[0] - 0.7, CLUSTERS_Y[0], 0, "Đồng nghiệp Lan"),
                                            (CLUSTERS_X[0] + 0.7, CLUSTERS_Y[0], 180, "Đồng nghiệp Minh"),
                                            (CLUSTERS_X[1] + 0.7, CLUSTERS_Y[0], 0, "Đồng nghiệp Hà"))):
        r = math.radians(yaw)
        mk.npc(f"dong_nghiep_{k + 1}", (dx + math.sin(r) * 1.0, dy - math.cos(r) * 1.0, 0.0), lbl,
               yaw_deg=yaw, collection=g)
    mk.npc("ban_bi_a", (-2.2, 1.6, 0.0), "Đồng nghiệp ở khu nghỉ", yaw_deg=135, collection=g)
    mk.trigger("zone_04_enter", (-0.3, 0.0, 1.2), (0.6, 3.2, 2.4), g)
    mk.trigger("khu_team", (sum(CLUSTERS_X[:2]) / 2, CLUSTERS_Y[0], 1.2), (14, 6, 2.4), g)
    mk.trigger("ban_lam_viec", (*seat, 1.2), (2.2, 2.0, 2.4), g)


def build_colliders(col, rooms):
    C = mk.collider
    bx0, bx1, by0, by1 = BREAK
    ox0, ox1, oy0, oy1 = OFFICE
    C("san", ((ox0 + bx1) / 2, (oy0 + oy1) / 2, -0.25), (bx1 - ox0, oy1 - oy0, 0.5), col)
    C("tuong_fsa_nam", (bx1, (by0 + FSA_Y[0]) / 2, H / 2), (0.3, FSA_Y[0] - by0, H), col)
    C("tuong_fsa_bac", (bx1, (FSA_Y[1] + by1) / 2, H / 2), (0.3, by1 - FSA_Y[1], H), col)
    C("cua_fsa", (bx1 + 0.1, 0, H / 2), (0.1, FSA_Y[1] - FSA_Y[0], H), col)
    C("nghi_tuong_bac", ((bx0 + bx1) / 2, by1, H / 2), (bx1 - bx0, 0.3, H), col)
    C("nghi_tuong_nam", ((bx0 + bx1) / 2, by0, H / 2), (bx1 - bx0, 0.3, H), col)
    C("vach_luc_giac_nam", (bx0, (oy0 + OPEN_Y[0]) / 2, H / 2), (0.4, OPEN_Y[0] - oy0, H), col)
    C("vach_luc_giac_bac", (bx0, (OPEN_Y[1] + oy1) / 2, H / 2), (0.4, oy1 - OPEN_Y[1], H), col)
    C("vp_tuong_nam", ((ox0 + ox1) / 2, oy0, H / 2), (ox1 - ox0, 0.3, H), col)
    C("vp_tuong_bac", ((ox0 + ox1) / 2, oy1, H / 2), (ox1 - ox0, 0.3, H), col)
    C("vp_tuong_tay", (ox0, (oy0 + oy1) / 2, H / 2), (0.3, oy1 - oy0, H), col)
    C("ban_bi_a", (-4.0, 3.0, 0.45), (2.7, 1.6, 0.9), col)
    C("ke_o_vuong_1", (-7.6, -3.5, 1.0), (0.45, 1.3, 2.0), col)
    C("ke_o_vuong_2", (-2.0, -5.75, 0.8), (1.7, 0.45, 1.6), col)
    C("ban_tulip", (-4.2, -3.0, 0.4), (2.0, 2.0, 0.8), col)
    for x, y in ((-1.0, 5.2), (-7.2, 5.2)):   # 2 chậu cọ khu nghỉ (build_break_area) — trước đây đi xuyên được
        C(f"chau_cay_{x:+.0f}_{y:+.0f}", (x, y, 0.6), (0.8, 0.8, 1.2), col)
    for key, (x0, x1, y0, y1) in rooms.items():
        cx = (x0 + x1) / 2
        d0, d1 = cx - ROOM_DOOR / 2, cx + ROOM_DOOR / 2
        C(f"{key}_nam_trai", ((x0 + d0) / 2, y0, H / 2), (d0 - x0, 0.2, H), col)
        C(f"{key}_nam_phai", ((d1 + x1) / 2, y0, H / 2), (x1 - d1, 0.2, H), col)
        C(f"{key}_tay", (x0, (y0 + y1) / 2, H / 2), (0.2, y1 - y0, H), col)
        C(f"{key}_dong", (x1, (y0 + y1) / 2, H / 2), (0.2, y1 - y0, H), col)
        C(f"{key}_ban", (cx, (y0 + y1) / 2, 0.4), (x1 - x0 - 2.2, 1.3, 0.8), col)
    for cy in CLUSTERS_Y:
        for cx in CLUSTERS_X:
            C(f"cum_ban_{cx:+.0f}_{cy:+.0f}", (cx, cy, 0.55), (4 * DESK_W, 1.5, 1.1), col)


def build(cols, rng):
    build_shell(cols["ENV"], rng)
    build_break_area(cols["ENV"], rng)
    rooms = build_meeting_rooms(cols, rng)
    intern = build_desks(cols, rng)
    build_markers(cols["GAME_markers"], intern)
    build_colliders(cols["COLLISION"], rooms)


def compare_cameras():
    return [
        ("loi_vao_vp", "VanPhongLamViec/t_0030.0.jpg", (-5.0, -1.0, 1.5), (-20.0, -0.5, 1.2), 22),
        ("khu_team", "VanPhongLamViec/t_0044.0.jpg", (-9.5, -8.0, 1.6), (-16.0, -4.0, 0.9), 22),
        ("ban_lam_viec", "VanPhongLamViec/t_0036.0.jpg", (INTERN[0] + 1.3, INTERN[1] + 2.2, 1.5),
         (INTERN[0], INTERN[1], 0.8), 24),
        ("bi_a", "VanPhongLamViec/t_0018.0.jpg", (-6.2, 0.2, 1.6), (-3.2, 4.0, 0.8), 22),
        ("phong_hop", "VanPhongLamViec/t_0024.0.jpg", (-12.0, -1.0, 1.5), (-20.0, 4.5, 1.2), 22),
    ]


LIGHTS = ([((x, y, 2.95), 2.5, 60) for x in range(-31, 0, 5) for y in (-10, -4, 2, 6)]
          + [((x, y, 1.2), 4.0, 120, True) for x in range(-30, 0, 8) for y in (-8, 0, 5)])

if __name__ == "__main__":
    zone.run(ZONE, build, compare_cameras(),
             overview=((-17, -3, 40), (-17, -3, 0), 0, {"ortho": 36, "cut_z": 2.7}),
             interior=True, ao_distance=1.0, preview_lights=LIGHTS)
