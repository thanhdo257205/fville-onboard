"""zone_00_pickup — điểm đón xe bus trong thành phố lúc sáng sớm (mở đầu game, 06:30).

Chạy:  python scripts/build.py zone_00 [--tier both]

Điểm đón chung chung, không mô phỏng địa điểm thật: biển hiệu cửa hàng để trống, không logo, không chữ.
Bố cục (1 đơn vị = 1 m), khu chơi ~60 × 30 m (x -30..30, y -13..17):
  y   7..16   dãy nhà phố + cửa hàng (mặt tiền nhìn -Y), mái hiên vải che vỉa hè
  y   0..7    vỉa hè phía bắc (khu chơi): mái chờ xe buýt, cây, cột đèn, quán ghế nhựa
  y  -3..0    làn đỗ: 3 xe bus FPT đầu hướng -X, cửa khách mở ra vỉa hè; biển số tuyến 1, 2, 3 trên kính lái
  y -10..-3   đường 2 làn (vạch giữa y = -6.5); xe số 2 (đi Hòa Lạc) chạy ra làn hướng tây theo PATH_xe_roi_tram
  y -13..-10  vỉa hè bên kia + cột điện; y < -13 dãy nhà phố bên kia đường
  Đường, vỉa hè, nhà kéo dài tới x ±62 (nền cho góc máy nhìn dọc phố, game phủ sương sớm).
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
from mathutils import Vector  # noqa: E402

from lib import kit, props, street, zone  # noqa: E402
from lib import quality as Q  # noqa: E402
from lib import markers as mk  # noqa: E402
from lib.mesh import MeshBuilder  # noqa: E402

ZONE = "zone_00_pickup"
WALK_Z = 0.15
NORTH = (0.0, 7.0)          # vỉa hè bắc: mép bó vỉa → mặt tiền nhà
SOUTH = (-13.0, -10.0)      # vỉa hè nam
ROAD = (-10.0, 0.0)         # lòng đường (gồm làn đỗ y -3..0)
CENTER_Y = -6.5
LANE_W = -4.75              # tâm làn hướng tây (xe ra khỏi trạm chạy làn này)
BUS_Y = -1.45               # tâm xe đỗ (thân xe cách bó vỉa 0,2 m)
BUSES = {1: -19.0, 2: 0.0, 3: 17.0}   # tâm xe; xe số 2 là xe đi Hòa Lạc
X_PLAY = (-30.0, 30.0)
X_FAR = 62.0
SHELTER = (8.0, 4.3)        # tâm mái chờ (rộng 5 m, sâu 1,8 m, mở về phía đường)


def door_x(n):
    """Tâm cửa khách xe số n (xe quay 180°: đầu xe hướng -X, cửa phía +Y)."""
    hx = props.BUS_L / 2
    return BUSES[n] - (hx - 1.325)


def build_ground(col, rng):
    b = MeshBuilder()
    b.grid(-95, ROAD[0], 95, ROAD[1], 0.02, 4.0, ["asphalt"])
    b.grid(-95, -40, 95, SOUTH[0] - 0.01, 0.0, 6.0, ["concrete_grey"])
    b.grid(-95, NORTH[1] + 0.01, 95, 40, 0.0, 6.0, ["concrete_grey"])
    # vạch: tim đường đứt khúc trắng, vạch làn đỗ vàng đứt khúc, mép đường trắng liền
    for x in range(-94, 94, 6):
        b.quad([(x, CENTER_Y - 0.07, 0.03), (x + 3, CENTER_Y - 0.07, 0.03), (x + 3, CENTER_Y + 0.07, 0.03), (x, CENTER_Y + 0.07, 0.03)], "road_line")
    for x in range(-28, 26, 2):
        b.quad([(x, -3.08, 0.03), (x + 1, -3.08, 0.03), (x + 1, -2.92, 0.03), (x, -2.92, 0.03)], "curb_yellow")
    b.quad([(-95, -9.75, 0.03), (95, -9.75, 0.03), (95, -9.62, 0.03), (-95, -9.62, 0.03)], "road_line")
    # vỉa hè gạch ô (khu chơi ô 1,2 m, xa hơn ô 2,4 m)
    cell = Q.cell(1.2, 1.5)
    b.grid(X_PLAY[0], NORTH[0], X_PLAY[1], NORTH[1], WALK_Z, cell, ["pavement", "pavement_2"])
    for x0, x1 in ((-95, X_PLAY[0]), (X_PLAY[1], 95)):
        b.grid(x0, NORTH[0], x1, NORTH[1], WALK_Z, 2.4, ["pavement", "pavement_2"])
    b.grid(-95, SOUTH[0], 95, SOUTH[1], WALK_Z, 2.4, ["pavement", "pavement_2"])
    kit.slab_rect_sides(b, -95, NORTH[0], 95, NORTH[1], 0, WALK_Z, "concrete_grey")
    kit.slab_rect_sides(b, -95, SOUTH[0], 95, SOUTH[1], 0, WALK_Z, "concrete_grey")
    return b.to_object("ENV_ground", col, tint="ground")


def build_curbs(col):
    b = MeshBuilder()
    for y in (NORTH[0] + 0.12, SOUTH[1] - 0.12):
        kit.curb_line(b, (-45, y), (45, y), seg=1.5)
        for x0, x1 in ((-95, -45), (45, 95)):
            b.box(((x0 + x1) / 2, y, 0.09), (x1 - x0, 0.25, 0.18), "curb_grey")
    return b.to_object("ENV_bo_via", col)


def build_buildings(col, rng):
    near, far = MeshBuilder(), MeshBuilder()
    street.shop_row(near, X_PLAY[0] - 2.0, X_PLAY[1] + 2.0, NORTH[1], -1, rng, detail=2)
    for x0, x1 in ((-X_FAR, X_PLAY[0] - 2.0), (X_PLAY[1] + 2.0, X_FAR)):
        street.shop_row(far, x0, x1, NORTH[1], -1, rng, detail=1)
    street.shop_row(far, -X_FAR, X_FAR, SOUTH[0], 1, rng, detail=1)
    far.to_object("ENV_nha_pho_xa", col)
    return near.to_object("ENV_nha_pho", col)


def build_props(col, rng):
    b = MeshBuilder()
    for x in (-28.0, -11.0, 3.6, 24.0):
        kit.lamp_post(b, x, NORTH[0] + 0.55, z=WALK_Z)
    street.bus_stop_sign(b, 4.8, NORTH[0] + 0.5, z=WALK_Z)
    street.plastic_cafe(b, -15.5, 5.6, rng)
    street.plastic_cafe(b, 21.5, 5.7, rng, n_stools=3)
    street.utility_poles(b, (-62, -42, -21, 0, 21, 42, 62), SOUTH[1] - 0.5)
    obj = b.to_object("ENV_props", col)
    v = MeshBuilder()
    for x in (-29.0, -16.0, 19.5, 27.5):
        street.tree_pit(v, x, NORTH[0] + 1.3, rng, z=WALK_Z)
    for x in (-36.0, -24.0, -7.0, 11.0, 28.0, 40.0):
        street.tree_pit(v, x, SOUTH[0] + 1.4, rng, z=WALK_Z)
    v.to_object("ENV_vegetation", col, smooth_angle=80, tint="foliage")
    return obj


def build_shelter(col):
    b = MeshBuilder()
    street.bus_shelter(b, -2.5, -0.9, 2.5, 0.9)
    return b.to_object("mai_cho_xe", col, location=(*SHELTER, WALK_Z))


def build_buses(cols):
    """3 xe dùng chung một mesh (như xe đỗ ở zone_01, instance → GLB nhẹ); cánh cửa khách là object con riêng
    để game đóng/mở; biển số tuyến là con của INT_bien_xe_N (con của xe) → chạy cùng xe.
    Xe số 2 đánh dấu "dynamic": không che AO/lightmap cho vật khác (xe chạy đi không để lại vệt tối)."""
    b = MeshBuilder()
    props.bus(b, door_open=False)
    d = MeshBuilder()
    props.bus_door(d)
    door_mesh = None
    hinge = props.bus_door_hinge()
    out = {}
    for n, x in BUSES.items():
        if door_mesh is None:
            bus = b.to_object(f"xe_bus_{n}", cols["ENV"], location=(x, BUS_Y, 0), bevel=0.16)
            door = d.to_object(f"xe_bus_{n}_cua", cols["ENV"])
            bus_mesh, door_mesh = bus.data, door.data
        else:
            bus = bpy.data.objects.new(f"xe_bus_{n}", bus_mesh)
            cols["ENV"].objects.link(bus)
            bus.location = (x, BUS_Y, 0)
            door = bpy.data.objects.new(f"xe_bus_{n}_cua", door_mesh)
            cols["ENV"].objects.link(door)
        bus.rotation_euler = (0, 0, math.radians(180))
        door.parent = bus
        door.location = hinge
        door.rotation_euler = (0, 0, math.radians(props.BUS_DOOR_OPEN_DEG))
        s = MeshBuilder()
        props.route_signs(s, n)
        sign = s.to_object(f"bien_xe_{n}_mesh", cols["INT"])
        sign.parent = bus
        bpy.context.view_layer.update()
        front = bus.matrix_world @ Vector((props.BUS_L / 2 + 0.05, 0, 2.98))
        it = mk.interactive(f"bien_xe_{n}", f"Biển tuyến xe số {n}", tuple(front), cols["INT"])
        mk.parent(it, bus)
        mk.parent(sign, it)
        if n == 2:
            for o in (bus, door, sign):
                o["dynamic"] = True
        out[n] = bus
    return out


def bus_rect(cx, cy, heading):
    """4 góc thân xe (dài 12, rộng 2,5) tại tâm (cx, cy), heading = góc hướng đầu xe (rad)."""
    hx, hy = props.BUS_L / 2, props.BUS_W / 2
    c, s = math.cos(heading), math.sin(heading)
    return [(cx + c * a - s * b2, cy + s * a + c * b2) for a, b2 in ((hx, hy), (-hx, hy), (-hx, -hy), (hx, -hy))]


def rect_gap(p, q):
    """Khoảng hở nhỏ nhất giữa 2 hình chữ nhật xoay (SAT, âm = chồng lên nhau)."""
    best = -1e9
    for poly in (p, q):
        for i in range(4):
            x0, y0 = poly[i]
            x1, y1 = poly[(i + 1) % 4]
            nx, ny = y1 - y0, -(x1 - x0)
            ln = math.hypot(nx, ny)
            nx, ny = nx / ln, ny / ln
            pa = [x * nx + y * ny for x, y in p]
            pb = [x * nx + y * ny for x, y in q]
            best = max(best, max(min(pb) - max(pa), min(pa) - max(pb)))
    return best


def check_path(points):
    """Xe chạy khỏi trạm không được quẹt xe số 1 đang đỗ phía trước."""
    still = bus_rect(BUSES[1], BUS_Y, math.radians(180))
    worst = 1e9
    for a, c in zip(points, points[1:]):
        h = math.atan2(c[1] - a[1], c[0] - a[0])
        worst = min(worst, rect_gap(bus_rect(a[0], a[1], h), still))
    print(f"PATH_xe_roi_tram: khoảng hở nhỏ nhất với xe số 1 = {worst:.2f} m")
    if worst < 0.3:
        raise SystemExit("PATH_xe_roi_tram quẹt vào xe số 1")


def build_markers(cols):
    g = cols["GAME_markers"]
    mk.spawn("zone_00_start", (26.5, 3.2, WALK_Z), yaw_deg=90, collection=g)

    def face(frm, to):
        return math.degrees(math.atan2(-(to[0] - frm[0]), to[1] - frm[1]))

    d2 = (door_x(2), NORTH[0])
    thao = (d2[0] + 1.6, 1.35)
    mk.npc("thao_cua_xe", (*thao, WALK_Z), "Chị Thảo (cửa xe số 2)", yaw_deg=face(thao, (thao[0] + 1.0, thao[1] + 0.35)), collection=g)
    pax = (d2[0] - 1.15, 1.15)
    mk.npc("hanh_khach", (*pax, WALK_Z), "Hành khách mang túi", yaw_deg=face(pax, d2), collection=g)
    for n in (1, 3):
        mk.npc(f"tai_xe_{n}", (door_x(n) + 1.5, 1.2, WALK_Z), f"Bác tài xe số {n}", yaw_deg=-90, collection=g)
    mk.trigger("len_xe", (d2[0], 0.75, 1.5), (1.6, 1.3, 3.0), g)

    mk.camera_mark("lenxe_1", (0.6, 4.4, 1.75), (d2[0] + 0.1, 0.3, 1.3), fov_deg=46, collection=g)
    mk.camera_mark("lenxe_2", (-12.5, -11.3, 2.2), (-2.0, -1.8, 1.6), fov_deg=48, collection=g, track="xe_bus_2")
    mk.camera_mark("lenxe_3", (10.5, -6.0, 2.4), (-30.0, LANE_W, 1.4), fov_deg=40, collection=g, track="xe_bus_2")

    x2 = BUSES[2]
    pts = [(x2, BUS_Y, 0), (x2 - 4, BUS_Y - 0.25, 0), (x2 - 9, -3.4, 0), (x2 - 14, -4.6, 0),
           (x2 - 20, LANE_W, 0), (-40, LANE_W, 0), (-85, LANE_W, 0)]
    _, samples = mk.path("xe_roi_tram", pts, g)
    check_path(samples)


def build_colliders(col):
    C = mk.collider
    C("ground", (0, 0, -0.25), (200, 80, 0.5), col)
    C("via_he_bac", (0, (NORTH[0] + NORTH[1]) / 2, WALK_Z / 2), (190, NORTH[1] - NORTH[0], WALK_Z), col)
    for n, x in BUSES.items():
        C(f"xe_bus_{n}", (x, BUS_Y, 1.75), (props.BUS_L, props.BUS_W, 3.5), col)
    sx, sy = SHELTER
    C("mai_cho_sau", (sx, sy + 0.65, 1.2), (5.0, 0.6, 2.4), col)
    C("mai_cho_hong", (sx + 2.5, sy, 1.3), (0.15, 1.8, 2.6), col)
    for x in (sx - 2.5, sx + 2.5):
        C(f"mai_cho_cot_{x:+.0f}", (x, sy - 0.9, 1.3), (0.2, 0.2, 2.6), col)
    for x in (-28.0, -11.0, 3.6, 24.0):
        C(f"cot_den_{x:+.0f}", (x, NORTH[0] + 0.55, 2), (0.3, 0.3, 4), col)
    C("bien_tram", (4.8, NORTH[0] + 0.5, 1.5), (0.2, 0.2, 3), col)
    for x in (-29.0, -16.0, 19.5, 27.5):
        C(f"cay_{x:+.0f}", (x, NORTH[0] + 1.3, 1.5), (0.45, 0.45, 3), col)
    C("quan_1", (-15.5, 5.6, 0.4), (1.7, 1.7, 0.8), col)
    C("quan_2", (21.5, 5.7, 0.4), (1.7, 1.7, 0.8), col)
    C("nha_bac", (0, NORTH[1] + 4.5, 5), (190, 9, 10), col)
    # biên khu chơi: mép bó vỉa (không bước xuống đường), hai đầu phố
    C("bien_bo_via", (0, NORTH[0] - 0.12, 2), (X_PLAY[1] - X_PLAY[0] + 2, 0.24, 4), col)
    C("bien_tay", (X_PLAY[0] - 0.2, 3.5, 2), (0.4, 8, 4), col)
    C("bien_dong", (X_PLAY[1] + 0.2, 3.5, 2), (0.4, 8, 4), col)


def build(cols, rng):
    build_ground(cols["ENV"], rng)
    build_curbs(cols["ENV"])
    build_buildings(cols["ENV"], rng)
    build_props(cols["ENV"], rng)
    build_shelter(cols["ENV"])
    build_buses(cols)
    build_markers(cols)
    build_colliders(cols["COLLISION"])


def preview_cameras():
    """Ảnh xem trước (zone không có ảnh thật để so sánh)."""
    d2 = door_x(2)
    return [
        ("pho", None, (27.0, 3.4, 1.7), (0.0, 0.5, 2.0), 24),
        ("cua_xe_2", None, (d2 + 4.0, 4.2, 1.7), (d2 - 1.0, -0.5, 1.6), 26),
        ("mai_cho", None, (SHELTER[0] + 1.5, -1.2, 1.6), (SHELTER[0] - 0.5, 5.0, 1.4), 26),
        ("ben_kia", None, (-12.5, -11.3, 2.2), (-2.0, -1.8, 1.6), 26),
    ]


if __name__ == "__main__":
    zone.run(ZONE, build, preview_cameras(), overview=((40, -8, 28), (-4, 2, 0), 26),
             sun={"sun_elev": 22, "sun_azim": 62, "strength": 2.6})
