"""zone_03_lobby — sảnh lễ tân + phòng Hạt Lúa.

Chạy:  python scripts/build.py zone_03

Bố cục theo video LeTan (đứng giữa sảnh, quay theo chiều kim đồng hồ):
  cửa kính lối vào (nam, y=0) → quầy lễ tân bên trái khi bước vào → vách lam đen + cây (tường tây)
  → cầu thang đá đen dọc tường tây → lối vào HẠT LÚA (góc tây bắc) → TV đứng → khu đôn chờ
  cạnh vách kính lam gạch phía đông (nhìn ra tượng Cuder).
Sàn sảnh z = 0 (ở zone_02 sàn sảnh cao +0.88 so với sân).
Hạt Lúa: x -10..2, y 14..24; lối ra hành lang (zone_04) ở tường tây, y 20..23.
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
from lib import kit, props, zone  # noqa: E402
from lib import markers as mk  # noqa: E402
from lib.mesh import MeshBuilder  # noqa: E402

ZONE = "zone_03_lobby"
LOBBY = (-10.0, 10.0, 0.0, 14.0)
H = it.CEIL_LOBBY
DOOR_X = (-1.5, 1.5)               # khoảng mở cửa chính (3 m)
HL = (-10.0, 2.0, 14.0, 24.0)       # phòng Hạt Lúa
HL_OPEN = (-7.5, 0.5)               # lối vào Hạt Lúa từ sảnh (8 m — mặt tiền mở gần hết tường)
HL_H = 3.4
EXIT_Y = (20.0, 23.0)               # lối ra hành lang (tường tây Hạt Lúa)
DESK = (-5.5, 4.6, 70.0)            # x, y, yaw — mặt quầy quay về phía người bước vào
PLAZA_Z = -0.8
STATUE = (17.0, 3.0)


def build_shell(col, rng):
    b = MeshBuilder()
    x0, x1, y0, y1 = LOBBY
    # sàn granite + trần đục lỗ
    it.floor_tiles(b, x0, -3.0, x1, y1, 0.0, ["granite", "granite_2"], cell=0.8, mat="gloss")
    it.floor_dots(b, x0, 0.2, x1, y1, 0.0)
    it.baseboard(b, (x0, y0), (x0, y1), (1, 0))
    it.ceiling_tex(b, x0, y0, x1, y1, H)
    kit.slab_rect_sides(b, x0, -3.0, x1, y1, PLAZA_Z, 0.0, "stone_black")
    # tường tây, tường bắc (chừa lối Hạt Lúa)
    it.wall(b, (x0, y0), (x0, y1), 0, H)
    it.wall(b, (x0, y1), (x1, y1), 0, H, openings=[(HL_OPEN[0] - x0, HL_OPEN[1] - x0, HL_H)], color="wood_light")
    kit.seg_box(b, (HL_OPEN[0], y1 - 0.12), (HL_OPEN[1], y1 - 0.12), 0.06, HL_H, H, "black")  # dầm đen trên lối vào
    # mặt kính lối vào (nam): dải dán mờ + mảng thay chữ FPT
    for a, c in ((x0, DOOR_X[0]), (DOOR_X[1], x1)):
        it.glass_wall(b, (a, 0), (c, 0), 0, H, band=(1.0, 0.28, "sign_white"))
        for k in range(int((c - a) / 2.5)):
            b.box((a + 1.0 + k * 2.5, -0.03, 1.14), (0.7, 0.02, 0.14), "concrete_grey")
    kit.seg_box(b, (DOOR_X[0], 0), (DOOR_X[1], 0), 0.1, H - 0.6, H, "black")
    for x in DOOR_X:  # cánh cửa mở trượt sang hai bên + tay nắm thanh dài
        it.door_handles(b, x + (0.3 if x > 0 else -0.3), -0.06, along="x")
    # cột vuông gần mặt kính
    for x in (-5.0, 5.0):
        b.box((x, 1.4, H / 2), (0.6, 0.6, H), "concrete_white")
    # vách kính phía đông xen tấm lam gạch đục lỗ hạt lúa
    it.glass_wall(b, (x1, y0), (x1, y1), 0, H, mullion=1.9)
    for k in range(7):
        yc = y0 + 1.0 + k * 1.9
        b.box((x1 - 0.06, yc, H / 2), (0.08, 0.7, H), "brick_louver")
        for r in range(9):
            for s in (-1, 1):
                b.sphere((x1 - 0.11, yc + s * 0.15, 0.4 + r * 0.42 + (0.2 if s > 0 else 0)), 0.09, "black",
                         segments=6, rings=2, scale=(0.15, 0.6, 1.0))
    return b.to_object("ENV_sanh", col)


def build_hat_lua(col, rng):
    b = MeshBuilder()
    x0, x1, y0, y1 = HL
    it.floor_tiles(b, x0, y0, x1, y1, 0.0, ["wood_floor", "wood_floor_dk"], cell=0.6, mat="palette",
                   jitter=lambda i, j: int((i * 7 + j * 3) % 5 == 0))
    it.ceiling(b, x0, y0, x1, y1, HL_H + 0.4, "black")
    for k in range(int((y1 - y0) / 0.25)):  # trần lam gỗ
        y = y0 + 0.12 + k * 0.25
        b.box(((x0 + x1) / 2, y, HL_H + 0.1), (x1 - x0, 0.06, 0.2), "wood_light")
    ey0, ey1 = EXIT_Y
    it.wall(b, (x0, y0), (x0, y1), 0, HL_H + 0.4, openings=[(ey0 - y0, ey1 - y0, 2.8)], color="black")
    it.wall(b, (x0, y1), (x1, y1), 0, HL_H + 0.4, color="black")
    it.wall(b, (x1, y1), (x1, y0), 0, HL_H + 0.4, color="black")
    # vách vây gỗ hạt lúa: tường đông, tây (trước lối ra), nam (hai bên lối vào)
    it.rice_fin_wall(b, (x1, y0 + 0.3), (x1, y1 - 3.3), h=HL_H, axis="x", sign=-1)
    it.rice_fin_wall(b, (x0, y0 + 0.3), (x0, ey0 - 0.3), h=HL_H, axis="x", sign=1)
    it.rice_fin_wall(b, (x0 + 0.3, y0 + 0.1), (HL_OPEN[0] - 0.2, y0 + 0.1), h=HL_H, axis="y", sign=1)
    it.rice_fin_wall(b, (HL_OPEN[1] + 0.2, y0 + 0.1), (x1 - 0.3, y0 + 0.1), h=HL_H, axis="y", sign=1)
    # cọc sắt + tấm hạt lúa
    for i in range(6):
        for j in range(4):
            x = x0 + 1.6 + i * 1.6 + (0.6 if j % 2 else 0)
            y = y0 + 1.6 + j * 1.3
            if x < x1 - 1.0:
                it.rice_rod(b, x, y, HL_H + 0.1, rng)
    # khu sinh hoạt cuối phòng: tường ô màu + cỏ nhân tạo + đôn + bàn tròn
    it.tile_wall(b, x0 + 3.5, x1 - 0.5, y1 - 0.1, 0.4, 3.0, rng, face=-1)
    b.box_minmax((x0 + 3.0, y1 - 3.0, 0.0), (x1, y1 - 0.1, 0.04), "grass_dark")
    for x in (-5.5, -3.0, -0.5):
        it.cube_stool(b, x, y1 - 1.6)
    it.round_table(b, -1.8, y1 - 1.5)
    # hành lang ra zone_04
    cx0 = x0 - 4.0
    it.floor_tiles(b, cx0, ey0, x0, ey1, 0.0, ["polished_floor"], cell=1.5, mat="palette")
    it.ceiling(b, cx0, ey0, x0, ey1, 2.8, "ceiling_white")
    it.wall(b, (cx0, ey0), (x0, ey0), 0, 2.8)
    it.wall(b, (x0, ey1), (cx0, ey1), 0, 2.8)
    return b.to_object("ENV_hat_lua", col)


def build_furniture(col, rng):
    b = MeshBuilder()
    x0, x1, y0, y1 = LOBBY
    it.slat_screen(b, x0 + 0.4, 1.8, 9.0, 3.8, rng=rng)
    for y in (3.0, 5.6, 8.0):
        it.potted_palm(b, x0 + 1.2, y, rng)
    # cầu thang đá đen dọc tường tây + lan can đặc đen
    sx0, sw, sy0 = x0 + 0.3, 1.8, 9.2
    kit.stairs(b, sx0, sy0, sw, 10, 0.18, 0.3)
    b.box_minmax((sx0, sy0 + 3.0, 0), (sx0 + sw, y1 - 0.1, 1.8), "stone_black", mat="gloss")
    xr = sx0 + sw + 0.03
    poly = [(sy0, 0.0), (y1 - 0.1, 0.0), (y1 - 0.1, 2.85), (sy0 + 3.0, 2.85), (sy0, 1.05)]
    verts = [(xr - 0.04, y, z) for y, z in poly] + [(xr + 0.04, y, z) for y, z in poly]
    n = len(poly)
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    b.raw(verts, faces, "black", mat="gloss")
    b.tube((xr, sy0, 1.1), (xr, sy0 + 3.0, 2.9), 0.03, "concrete_grey", segments=5)
    # khu đôn chờ cạnh vách kính đông + TV đứng
    for x, y, r in ((6.6, 4.0, 0), (8.2, 5.6, 15), (6.2, 6.6, 30), (8.0, 8.2, 5), (5.6, 9.0, 20), (8.6, 2.8, 10)):
        it.hex_ottoman(b, x, y, rot=r)
    it.tv_stand(b, 3.5, 11.6, yaw=200)
    it.tv_stand(b, 1.6, 13.2, yaw=180, w=2.4, h=1.3)
    return b.to_object("ENV_noi_that", col)


def build_outside(col, rng):
    """Ngoài kính: chiếu nghỉ, mái hiên, bậc xuống sân gạch, tượng Cuder nhìn qua vách kính đông."""
    b = MeshBuilder()
    kit.slab_rect(b, -10, -3.0, 10, 0.0, H + 0.2, H + 0.6, "concrete_white")
    for x in (-9.4, -5.8, -2.2, 2.2, 5.8, 9.4):
        b.box((x, -2.6, H / 2), (0.5, 0.5, H), "concrete_white")
    kit.stairs(b, -6.0, -5.5, 12.0, 5, 0.16, 0.5, z0=PLAZA_Z)
    kit.building_block(b, 42, -30, 56, 30, floors=3, facades=("W",))
    kit.building_block(b, -30, -58, 40, -44, floors=3, facades=("N",))
    obj = b.to_object("ENV_ngoai_troi", col)
    vb = MeshBuilder()  # cây ngoài sân: object riêng, tán tròn mềm
    for _ in range(12):
        kit.tree(vb, rng.uniform(14, 38), rng.uniform(-38, 24), rng, z=PLAZA_Z, detail=1)
    vb.to_object("ENV_cay_san", col, smooth_angle=80, tint="foliage")
    pb = MeshBuilder()
    kit.brick_paving(pb, -30, -44, 42, -5.5, PLAZA_Z, cell=3.0)
    kit.brick_paving(pb, 10, -5.5, 42, 30, PLAZA_Z, cell=3.0)
    pb.to_object("ENV_san_gach", col)
    # tượng Cuder (bản sao từ zone_02), mặt quay vào sảnh (-X)
    sb = MeshBuilder()
    top = props.cuder_pedestal(sb)
    props.cuder_figure(sb, top)
    st = sb.to_object("ENV_tuong_cuder_xa", col, location=(*STATUE, PLAZA_Z), smooth_angle=75)
    st.rotation_euler = (0, 0, math.radians(-90))
    return obj


def build_interactives(cols):
    b = MeshBuilder()
    it.reception_desk(b)
    x, y, yaw = DESK
    desk = b.to_object("quay_le_tan_mesh", cols["INT"], location=(x, y, 0))
    desk.rotation_euler = (0, 0, math.radians(yaw))
    q = mk.interactive("quay_le_tan", "Quầy lễ tân", (x, y, 0), cols["INT"])
    mk.parent(desk, q)
    mk.interactive("hat_lua", "Phòng Hạt Lúa", ((HL[0] + HL[1]) / 2, (HL[2] + HL[3]) / 2, 0), cols["INT"])


def build_markers(g):
    x, y, yaw = DESK
    r = math.radians(yaw)
    behind = (x - 0.9 * math.sin(r), y + 0.9 * math.cos(r))
    front = (x + 1.8 * math.sin(r), y - 1.8 * math.cos(r))
    mk.spawn("zone_03_start", (0.0, 1.6, 0.0), yaw_deg=0, collection=g)
    mk.spawn("zone_03_from_zone_04", (HL[0] + 1.0, sum(EXIT_Y) / 2, 0.0), yaw_deg=-90, collection=g)
    mk.npc("le_tan", (*behind, 0.0), "Lễ tân", yaw_deg=yaw - 180, collection=g)
    mk.trigger("zone_02_enter", (0.0, -1.8, 1.5), (6, 1.6, 3), g)
    mk.trigger("quay_le_tan", (*front, 1.2), (3.0, 3.0, 2.4), g, yaw_deg=yaw)
    mk.trigger("hat_lua", (sum(HL_OPEN) / 2, HL[2] + 1.5, 1.5), (HL_OPEN[1] - HL_OPEN[0], 3, 3), g)
    mk.trigger("zone_04_enter", (HL[0] - 3.2, sum(EXIT_Y) / 2, 1.4), (1.2, 3.0, 2.8), g)


def build_colliders(col):
    C = mk.collider
    x0, x1, y0, y1 = LOBBY
    C("san_sanh", (0, (y1 - 3) / 2, -0.25), (20, y1 + 3, 0.5), col)
    C("san_hat_lua", (sum(HL[:2]) / 2, sum(HL[2:]) / 2, -0.25), (HL[1] - HL[0], HL[3] - HL[2], 0.5), col)
    C("san_hanh_lang", (HL[0] - 2, sum(EXIT_Y) / 2, -0.25), (4, 3, 0.5), col)
    C("tuong_tay", (x0 - 0.1, y1 / 2, H / 2), (0.3, y1, H), col)
    C("vach_kinh_dong", (x1 + 0.05, y1 / 2, H / 2), (0.3, y1, H), col)
    C("kinh_nam_trai", ((x0 + DOOR_X[0]) / 2, 0, H / 2), (DOOR_X[0] - x0, 0.3, H), col)
    C("kinh_nam_phai", ((DOOR_X[1] + x1) / 2, 0, H / 2), (x1 - DOOR_X[1], 0.3, H), col)
    C("tuong_bac_trai", ((x0 + HL_OPEN[0]) / 2, y1, H / 2), (HL_OPEN[0] - x0, 0.3, H), col)
    C("tuong_bac_phai", ((HL_OPEN[1] + x1) / 2, y1, H / 2), (x1 - HL_OPEN[1], 0.3, H), col)
    C("vach_lam_va_cay", (x0 + 0.9, 5.4, 2), (1.4, 7.6, 4), col)
    C("cau_thang", (x0 + 1.2, 11.6, 2), (2.0, 4.8, 4), col)
    for x in (-5.0, 5.0):
        C(f"cot_{x:+.0f}", (x, 1.4, H / 2), (0.6, 0.6, H), col)
    C("quay_le_tan", (DESK[0], DESK[1], 0.55), (3.5, 1.2, 1.1), col, yaw_deg=DESK[2])
    C("cum_don", (7.1, 5.8, 0.25), (3.8, 7.2, 0.5), col)
    C("tv_1", (3.5, 11.6, 1.0), (1.0, 0.7, 2.0), col)
    C("tv_2", (1.6, 13.2, 1.0), (1.0, 0.7, 2.0), col)
    # ngoài: chặn mép chiếu nghỉ (lối về zone_02 bằng trigger)
    C("bien_chieu_nghi", (0, -3.3, 1.5), (20, 0.4, 3), col)
    # Hạt Lúa
    hx0, hx1, hy0, hy1 = HL
    C("hl_tuong_dong", (hx1 + 0.1, (hy0 + hy1) / 2, 2), (0.6, hy1 - hy0, 4), col)
    C("hl_tuong_bac", ((hx0 + hx1) / 2, hy1 + 0.1, 2), (hx1 - hx0, 0.6, 4), col)
    C("hl_tuong_tay_nam", (hx0 - 0.1, (hy0 + EXIT_Y[0]) / 2, 2), (0.6, EXIT_Y[0] - hy0, 4), col)
    C("hl_tuong_tay_bac", (hx0 - 0.1, (EXIT_Y[1] + hy1) / 2, 2), (0.6, hy1 - EXIT_Y[1], 4), col)
    C("hl_khu_sinh_hoat", (-3.0, hy1 - 1.5, 0.4), (6.0, 1.6, 0.8), col)
    C("hanh_lang_nam", (hx0 - 2, EXIT_Y[0] - 0.1, 1.4), (4, 0.3, 2.8), col)
    C("hanh_lang_bac", (hx0 - 2, EXIT_Y[1] + 0.1, 1.4), (4, 0.3, 2.8), col)
    C("hanh_lang_cuoi", (hx0 - 4.1, sum(EXIT_Y) / 2, 1.4), (0.3, 3, 2.8), col)


def build(cols, rng):
    build_shell(cols["ENV"], rng)
    build_hat_lua(cols["ENV"], rng)
    build_furniture(cols["ENV"], rng)
    build_outside(cols["ENV"], rng)
    build_interactives(cols)
    build_markers(cols["GAME_markers"])
    build_colliders(cols["COLLISION"])


def compare_cameras():
    return [
        ("le_tan", "LeTan/t_0003.5.jpg", (0.5, 6.5, 1.5), (-6.0, 3.8, 1.3), 24),
        ("cho_ngoi", "LeTan/t_0000.0.jpg", (-1.0, 6.0, 1.5), (10.0, 5.5, 1.1), 24),
        ("hat_lua", "LeTan/t_0006.5.jpg", (-4.0, 17.0, 1.4), (2.0, 19.5, 1.7), 24),
        ("vao_hat_lua", "LoiDi/t_0094.0.jpg", (-3.8, 5.5, 1.4), (-3.8, 20.0, 1.2), 22),
    ]


LIGHTS = [((-5, 4, 4.0), 3.0, 500), ((5, 4, 4.0), 3.0, 500), ((-5, 10, 4.0), 3.0, 500), ((5, 10, 4.0), 3.0, 500),
          ((-6, 17, 3.2), 2.5, 260), ((-2, 20, 3.2), 2.5, 260), ((-6, 21.5, 3.2), 2.5, 200), ((-12, 21.5, 2.7), 1.5, 120)]

if __name__ == "__main__":
    # toàn cảnh: nhìn thẳng từ trên, cắt bỏ phần trên 3.3 m để thấy bên trong
    zone.run(ZONE, build, compare_cameras(), overview=((-2, 9, 40), (-2, 9, 0), 0, {"ortho": 34, "cut_z": 3.3}),
             interior=True, ao_distance=1.2, preview_lights=LIGHTS)
