"""zone_01_bus — xe bus FPT và điểm xuống xe.

Chạy:  python scripts/build.py zone_01

Bố cục (1 đơn vị = 1 m):
  y -14..-4  bãi cỏ + hàng cây phía nam đường
  y  -4..4   đường nội bộ; xe bus đậu làn bắc, đầu xe hướng -X, cửa khách mở ra vỉa hè
  y   4..14  vỉa hè gạch lục giác: giàn leo chờ xe, bụi tre, cột đèn (SPAWN ở cửa xe)
  y  14..    nhà có tầng trệt lùi vào; tường BẢN ĐỒ TUYẾN XE BUÝT dưới mái hiên + cột chắn xếp hàng
  x  ~25     cuối vỉa hè → đi tiếp tới cổng F-Ville (TRIGGER_zone_02_enter)
Cảnh chuyển từ zone_00: xe chính chạy vào theo PATH_xe_vao_tram (từ phía đông, làn bắc), dừng, cánh cửa
xe_bus_cua mở (game xoay bằng code), người chơi xuất hiện ở SPAWN_zone_01_cua_xe. Xe đỗ ENV_xe_bus_dau_2 đặt ở
làn nam (x 20) để đường vào trạm trống.
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

from lib import kit, props, zone  # noqa: E402
from lib import quality as Q  # noqa: E402
from lib import markers as mk  # noqa: E402
from lib.mesh import MeshBuilder  # noqa: E402

ZONE = "zone_01_bus"
ROAD_Y = (-4.0, 4.0)
WALK = (-30.0, 26.0, 4.0, 14.0)   # vỉa hè x0, x1, y0, y1
WALK_Z = 0.15
BUS_MAIN = (0.0, 2.3)             # xe chính (đầu xe hướng -X)
BUILDING = (-30.0, 22.0, 14.0, 30.0)
PARKED_2 = (20.0, -2.3, 0)        # xe đỗ làn nam (trước đây ở làn bắc x 15 — chắn đường xe chính vào trạm)
BOARD = (-2.0, 15.95)


def build_ground(col, rng):
    b = MeshBuilder()
    b.grid(-50, -30, 50, 40, 0.0, Q.cell(4.0), ["grass"])  # màu loang nhờ tint="ground"
    b.grid(-50, ROAD_Y[0], 50, ROAD_Y[1], 0.02, 3.5, ["asphalt"])
    for x in range(-48, 48, 4):
        b.quad([(x, -0.08, 0.03), (x + 2, -0.08, 0.03), (x + 2, 0.08, 0.03), (x, 0.08, 0.03)], "road_line")
    x0, x1, y0, y1 = WALK
    b.grid(x0, y0, x1, y1, WALK_Z, 3.0, ["tex_white"], mat="hex_tex")
    kit.slab_rect_sides(b, x0, y0, x1, y1, 0, WALK_Z, "concrete_grey")
    # nền dưới mái hiên (sàn bê tông mài)
    bx0, bx1, by0, by1 = BUILDING
    b.grid(bx0, by0, bx1, by0 + 2.5, WALK_Z + 0.01, 2.0, ["polished_floor"])
    return b.to_object("ENV_ground", col, tint="ground")


def build_buildings(col, rng):
    b = MeshBuilder()
    bx0, bx1, by0, by1 = BUILDING
    top = kit.building_block(b, bx0, by0, bx1, by1, floors=3, facades=("S", "E"), roof_rng=rng,
                             col_skip=(BOARD[0] - 5.5, BOARD[0] + 5.5, by0, by0 + 1.5))
    vb = MeshBuilder()
    kit.roof_garden(vb, bx0 + 1, by0 + 1, bx1 - 1, by1 - 1, top + 0.45, rng, density=0.025)
    vb.to_object("ENV_cay_mai", col, smooth_angle=80, tint="foliage")
    return b.to_object("ENV_buildings", col)


def build_props(col, rng):
    b = MeshBuilder()
    x0, x1, y0, y1 = WALK
    kit.curb_line(b, (-50, ROAD_Y[1] + 0.12), (50, ROAD_Y[1] + 0.12))
    kit.curb_line(b, (-50, ROAD_Y[0] - 0.12), (50, ROAD_Y[0] - 0.12))
    for x in (-22, -10, 4, 18):
        kit.lamp_post(b, x, y0 + 0.6, z=WALK_Z)
    props.queue_stanchions(b, BOARD[0] - 3.5, BOARD[0] + 2.5, BOARD[1] - 1.4, n=5)
    props.pergola(b, 7.0, 7.0, 13.0, 10.5, rng)
    obj = b.to_object("ENV_props", col)

    bb = MeshBuilder()
    props.route_map_board(bb)
    board = bb.to_object("ban_do_tuyen_xe_mesh", col, location=(*BOARD, WALK_Z))
    return obj, board


def build_vegetation(col, rng):
    b = MeshBuilder()
    for x in range(-44, 46, 7 if not Q.HIGH else 4):  # hàng cây phía nam đường
        kit.tree(b, x + rng.uniform(-1.5, 1.5), -8 + rng.uniform(-1.5, 1.5), rng)
    for x in (-26, -16, 20, 24):
        kit.tree(b, x, 12.2, rng, height=rng.uniform(6, 7.5), z=WALK_Z)
    kit.hedge(b, (-50, -5.2), (50, -5.2), width=0.9, height=0.8, rng=rng)
    kit.bamboo_clump(b, -13.0, 8.5, rng, z=WALK_Z)
    kit.bamboo_clump(b, 16.5, 11.5, rng, n=8, z=WALK_Z)
    for _ in range(Q.n(25)):
        kit.bush(b, rng.uniform(-48, 48), rng.uniform(-28, -10), rng.uniform(0.5, 1.0), rng,
                 flowers=rng.random() < 0.3, lobes=1)
    kit.grass_tufts(b, (-30, 26, 4.6, 6.0), 30, rng, z=WALK_Z)
    return b.to_object("ENV_vegetation", col, smooth_angle=80, tint="foliage")


def build_buses(cols):
    """Xe chính (tương tác) + 3 xe đậu cùng chung một mesh (instance → GLB nhẹ).
    Cánh cửa khách xe chính là object con riêng (xe_bus_cua, gốc = bản lề) để game đóng/mở khi xe vào trạm;
    trong GLB đang mở như trước."""
    b = MeshBuilder()
    props.bus(b, door_open=False)
    main = b.to_object("xe_bus_mesh", cols["INT"], location=(*BUS_MAIN, 0), bevel=0.16)
    main.rotation_euler = (0, 0, math.radians(180))
    d = MeshBuilder()
    props.bus_door(d)
    door = d.to_object("xe_bus_cua", cols["INT"])
    door.parent = main
    door.location = props.bus_door_hinge()
    door.rotation_euler = (0, 0, math.radians(props.BUS_DOOR_OPEN_DEG))
    b2 = MeshBuilder()
    props.bus(b2, door_open=False)
    parked = b2.to_object("ENV_xe_bus_dau_1", cols["ENV"], location=(-15.0, 2.3, 0), bevel=0.16)
    parked.rotation_euler = (0, 0, math.radians(180))
    for name, loc, yaw in (("ENV_xe_bus_dau_2", PARKED_2, 0), ("ENV_xe_bus_dau_3", (6.0, -2.3, 0), 0)):
        o = bpy.data.objects.new(name, parked.data)  # dùng chung mesh
        cols["ENV"].objects.link(o)
        o.location = loc
        o.rotation_euler = (0, 0, math.radians(yaw))
    bus = mk.interactive("xe_bus", "Xe Bus FPT", (*BUS_MAIN, 0), cols["INT"])
    mk.parent(main, bus)
    return main


def door_world():
    """Vị trí cửa khách của xe chính (xe quay 180° → cửa ở phía +Y, gần đầu xe -X)."""
    hx, hy = props.BUS_L / 2, props.BUS_W / 2
    dx = (hx - 1.9 + hx - 0.75) / 2
    return BUS_MAIN[0] - dx, BUS_MAIN[1] + hy


def build_markers(cols):
    g = cols["GAME_markers"]
    dx, dy = door_world()
    mk.spawn("zone_01_start", (dx, dy + 1.2, WALK_Z), yaw_deg=0, collection=g)
    mk.spawn("zone_01_from_zone_02", (WALK[1] - 3.0, 9.0, WALK_Z), yaw_deg=90, collection=g)
    mk.spawn("zone_01_cua_xe", (dx, dy + 0.7, WALK_Z), yaw_deg=0, collection=g)   # ngay cửa xe (cảnh chuyển)
    # xe chạy vào từ phía đông theo làn bắc, nhập vào sát bó vỉa rồi dừng đúng chỗ xe chính
    mk.path("xe_vao_tram", [(46, 1.0, 0), (30, 1.0, 0), (15, 1.5, 0), (6, 2.2, 0), (BUS_MAIN[0], BUS_MAIN[1], 0)], g)
    mk.npc("tai_xe", (dx + 0.2, BUS_MAIN[1] - 0.6, 1.0), "Tài xế", yaw_deg=180, collection=g)
    mk.npc("dong_nghiep_don", (dx + 3.0, dy + 2.6, WALK_Z), "Đồng nghiệp đón", yaw_deg=-120, collection=g)
    mk.trigger("xuong_xe", (dx, dy + 1.0, 1.5), (3, 2.5, 3), g)
    mk.trigger("ban_do_tuyen_xe", (BOARD[0], BOARD[1] - 2.5, 1.5), (8, 3, 3), g)
    mk.trigger("zone_02_enter", (WALK[1] - 1.0, 9.0, 1.5), (2, 10, 3), g)

    bd = mk.interactive("ban_do_tuyen_xe", "Bản đồ tuyến xe buýt", (*BOARD, WALK_Z), cols["INT"])
    mk.parent(bpy.data.objects["ban_do_tuyen_xe_mesh"], bd)


def build_colliders(col):
    C = mk.collider
    C("ground", (0, 5, -0.25), (100, 70, 0.5), col)
    C("sidewalk", ((WALK[0] + WALK[1]) / 2, (WALK[2] + WALK[3]) / 2, WALK_Z / 2), (WALK[1] - WALK[0], 10, WALK_Z), col)
    for x, y in ((BUS_MAIN[0], BUS_MAIN[1]), (-15, 2.3), PARKED_2[:2], (6, -2.3)):
        C(f"xe_bus_{x:+.0f}", (x, y, 1.75), (props.BUS_L, props.BUS_W, 3.5), col)
    bx0, bx1, by0, by1 = BUILDING
    C("toa_nha", ((bx0 + bx1) / 2, (by0 + 2 + by1) / 2, 7), (bx1 - bx0 - 4, by1 - by0 - 2, 14), col)
    C("ban_do", (BOARD[0], BOARD[1] + 0.05, 1.8), (9.2, 0.3, 3.6), col)
    C("gian_leo", (10.0, 8.75, 0.5), (6.2, 3.7, 1.0), col)
    C("bui_tre_1", (-13.0, 8.5, 2), (1.4, 1.4, 4), col)
    C("bui_tre_2", (16.5, 11.5, 2), (1.2, 1.2, 4), col)
    for x in (-22, -10, 4, 18):
        C(f"cot_den_{x:+d}", (x, WALK[2] + 0.6, 2), (0.3, 0.3, 4), col)
    # biên vùng chơi
    C("bien_nam", (0, -0.3, 2), (100, 0.4, 4), col)
    C("bien_tay", (WALK[0] - 0.3, 9, 2), (0.4, 18, 4), col)
    C("bien_dong", (WALK[1] + 0.3, 9, 2), (0.4, 18, 4), col)


def build(cols, rng):
    build_ground(cols["ENV"], rng)
    build_buildings(cols["ENV"], rng)
    build_props(cols["ENV"], rng)
    build_vegetation(cols["ENV"], rng)
    build_buses(cols)
    build_markers(cols)
    build_colliders(cols["COLLISION"])


def compare_cameras():
    dx, dy = door_world()
    return [
        ("cua_xe", "fville_green_office_720p/s_0023.2.jpg", (dx - 3.2, dy + 3.6, 1.6), (dx + 0.3, dy, 1.8), 26),
        ("hang_xe", "fville_green_office_720p/t_0090.0.jpg", (8.0, 6.6, 1.3), (-10.0, 2.6, 2.2), 24),
        ("ban_do", "fville_green_office_720p/t_0084.0.jpg", (BOARD[0], BOARD[1] - 6.5, 1.7), (BOARD[0], BOARD[1], 2.1), 24),
        ("xe_do", "GiengLang/t_0010.0.jpg", (-10.0, 6.0, 1.5), (-15.0, 3.6, 1.6), 26),
    ]


if __name__ == "__main__":
    zone.run(ZONE, build, compare_cameras(), overview=((30, -26, 24), (-2, 8, 0), 24))
