"""zone_04_corridor — hành lang, cửa quẹt thẻ, cầu thang, giếng trời tầng trên, cửa phòng FSA.

Chạy:  python scripts/build.py zone_04

Bố cục (người chơi đi từ Hạt Lúa ở phía đông sang tây):
  TẦNG TRỆT (z 0): hành lang x 0..12, y -1.5..1.5 (rộng 3 m), trần lộ ống kỹ thuật.
     tường bắc: tấm ốp gỗ vàng đục lỗ hạt lúa + CỬA QUẸT THẺ (kính khung đen) ở x 1..3.6
     phía nam: dãy tủ thấp có chậu cây, sau là khu làm việc tối (chỉ để cảnh)
  SẢNH CẦU THANG x -0.5..6.5, y 1.5..10.5: 2 vế thang chữ U (rộng 2.6 m), chiếu nghỉ z 2.1
  TẦNG TRÊN (z 4.2): giếng trời, lỗ thông tầng có lan can trắng, cửa trắng 2 cánh,
     CỬA PHÒNG FSA (cửa kính Wing 3) ở tường tây x = -12 → sang zone_05.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
for _m in [k for k in sys.modules if k == "lib" or k.startswith("lib.")]:
    del sys.modules[_m]

from lib import interior as it  # noqa: E402
from lib import kit, zone  # noqa: E402
from lib import markers as mk  # noqa: E402
from lib.mesh import MeshBuilder  # noqa: E402

ZONE = "zone_04_corridor"
UP = 4.2                       # cao độ sàn tầng trên
CORR = (0.0, 12.0, -1.5, 1.5)  # hành lang tầng trệt
CORR_H = 3.6
CARD_DOOR = (1.0, 3.6)         # x của cửa quẹt thẻ trên tường y = 1.5
HALL = (-0.5, 6.5, 1.5, 10.5)  # sảnh cầu thang
F1 = (0.0, 2.6)                # vế 1 (đi lên theo +Y)
F2 = (3.4, 6.0)                # vế 2 (đi lên theo -Y)
STEP_N, STEP_R, STEP_T = 12, 0.175, 0.3
F1_Y0 = 3.0
LAND_Y = F1_Y0 + STEP_N * STEP_T          # 6.6: đầu chiếu nghỉ
UPPER = (-12.0, 12.0, -12.0, 1.5)         # sàn tầng trên
VOID = (-8.0, -2.0, -8.0, -3.0)           # lỗ thông tầng
FSA_Y = (-7.6, -4.4)                      # cửa FSA trên tường x = -12 (rộng 3.2 m)
UP_H = 3.2


def build_ground_floor(col, rng):
    b = MeshBuilder()
    x0, x1, y0, y1 = CORR
    it.floor_tiles(b, x0, y0 - 6, x1, y1, 0.0, ["tile_light", "polished_floor"], cell=1.0, mat="palette",
                   jitter=lambda i, j: int((i + j) % 2 == 0 and (i * j) % 3 == 0))
    # dải sàn + trần từ x0 tới tường tây (x0 - 0.5): trước đây hở → thấy trời giữa sàn và chân tường
    it.floor_tiles(b, x0 - 0.6, y0 - 6, x0, y1, 0.0, ["tile_light"], cell=1.0, mat="palette")
    it.ceiling(b, x0 - 0.6, y0 - 6, x0, y1, CORR_H, "black")
    # trần lộ: mặt đen + ống gió + máng cáp
    it.ceiling(b, x0, y0 - 6, x1, y1, CORR_H, "black")
    b.tube((x0, -0.6, CORR_H - 0.45), (x1, -0.6, CORR_H - 0.45), 0.28, "duct_grey", segments=8)
    b.tube((x0, 0.8, CORR_H - 0.25), (x1, 0.8, CORR_H - 0.25), 0.08, "duct_grey", segments=6)
    for x in range(1, 12, 3):
        b.box((x, 0, CORR_H - 0.6), (0.4, 0.4, 0.12), "lamp_white", mat="light")
    # tường bắc: panel gỗ vàng đục lỗ + chừa cửa quẹt thẻ
    cx0, cx1 = CARD_DOOR
    it.wall(b, (x0 - 0.5, y1), (x1, y1), 0, UP, openings=[(cx0 - x0 + 0.5, cx1 - x0 + 0.5, 2.6)])
    px = cx1 + 0.4
    while px + 1.2 <= x1:
        it.perforated_panel(b, px, px + 1.2, y1 - 0.13, 0.0, 3.0, rng)
        px += 1.22
    kit.seg_box(b, (cx0 - 0.1, y1), (cx1 + 0.1, y1), 0.26, 2.6, 2.75, "black")  # khung trên cửa
    for x in (cx0 - 0.05, cx1 + 0.05):
        b.box((x, y1, 1.3), (0.1, 0.26, 2.6), "black")
    # phía nam: tủ thấp + chậu cây, khu làm việc tối phía sau
    for k in range(6):
        x = x0 + 1.0 + k * 2.0
        b.box((x, y0 - 0.35, 0.55), (1.6, 0.6, 1.1), "sign_white")
        b.cylinder((x, y0 - 0.35, 1.1), 0.22, 0.25, "terracotta", segments=8)
        b.ico((x, y0 - 0.35, 1.5), 0.32, "leaf", subdiv=1, scale=(1.2, 1, 0.8))
    for k in range(4):
        b.box((2 + k * 3, y0 - 3.5, 0.37), (1.4, 0.7, 0.74), "desk_black")
    it.glass_wall(b, (x0 - 0.5, y0 - 6), (x1, y0 - 6), 0, CORR_H)  # từ tường tây (trước đây hở 0,5 m ở góc)
    # ngoài vách kính: sân cỏ + nhà đối diện (chỉ để cảnh; trước đây sau kính không có gì → nhìn chéo xuống thấy trời)
    gy = y0 - 6
    b.quad([(x0 - 30, gy - 40, -0.02), (x1 + 30, gy - 40, -0.02), (x1 + 30, gy, -0.02), (x0 - 30, gy, -0.02)], "grass_dark")
    kit.building_block(b, x0 - 30, gy - 52, x1 + 30, gy - 40, floors=3, facades=("N",), style="glass")
    it.wall(b, (x1, y0 - 6), (x1, y1), 0, CORR_H, color="black")  # đầu hành lang phía đông (cửa mở về Hạt Lúa)
    it.wall(b, (x0 - 0.5, y0 - 6), (x0 - 0.5, y1), 0, CORR_H)
    return b.to_object("ENV_tang_tret", col)


def build_stair_hall(col, rng):
    b = MeshBuilder()
    hx0, hx1, hy0, hy1 = HALL
    top = UP + UP_H
    it.floor_tiles(b, hx0, hy0, hx1, hy1, 0.0, ["granite", "granite_2"], cell=0.8)
    it.wall(b, (hx0, hy0), (hx0, hy1), 0, top)
    it.wall(b, (hx0, hy1), (hx1, hy1), 0, top)
    it.wall(b, (hx1, hy1), (hx1, hy0), 0, top)
    it.ceiling(b, hx0, hy0, hx1, hy1, top)
    # vế 1: lên theo +Y; chiếu nghỉ; vế 2: lên theo -Y
    # bậc / chiếu nghỉ chạy tới mặt trong tường sảnh (hx0 + 0.1, hx1 - 0.1): trước đây hở 0,4 m giữa mép bậc và tường
    wx0, wx1 = hx0 + 0.1, hx1 - 0.1
    kit.stairs(b, wx0, F1_Y0, F1[1] - wx0, STEP_N, STEP_R, STEP_T)
    z_mid = STEP_N * STEP_R
    b.box_minmax((wx0, LAND_Y, 0), (wx1, hy1, z_mid), "stone_black", mat="gloss")
    for i in range(STEP_N):
        ya = LAND_Y - (i + 1) * STEP_T
        b.box_minmax((F2[0], ya, z_mid), (wx1, LAND_Y - i * STEP_T, z_mid + (i + 1) * STEP_R), "stone_black", mat="gloss")
    b.box_minmax((F2[0], hy0, z_mid), (wx1, F1_Y0, UP), "stone_black", mat="gloss")  # chiếu tới tầng trên
    b.box_minmax((F2[0], hy0, 0), (wx1, F1_Y0, z_mid), "concrete_white")
    # lan can song sắt dọc khe giữa 2 vế + mép chiếu nghỉ
    it.bar_railing(b, (F1[1] + 0.05, F1_Y0), (F1[1] + 0.05, LAND_Y), 0.0, z_mid)
    it.bar_railing(b, (F2[0] - 0.05, LAND_Y), (F2[0] - 0.05, F1_Y0), z_mid, UP)
    it.bar_railing(b, (F1[1] + 0.05, LAND_Y), (F2[0] - 0.05, LAND_Y), z_mid, z_mid)
    # mép tây chiếu trên (đầu vế 2, sàn cao UP): nối tiếp lan can vế 2 tới tường bắc hành lang (y = hy0)
    it.bar_railing(b, (F2[0] - 0.05, F1_Y0), (F2[0] - 0.05, hy0 + 0.1), UP, UP)
    # cửa phòng dán tranh hoạt hình (placeholder: mảng màu) + biển tròn gỗ
    b.box((hx0 + 0.04, 8.8, 1.15), (0.04, 1.0, 2.3), "curb_yellow")
    for k, c in enumerate(("shelf_red", "fpt_blue", "fpt_green", "fpt_orange")):
        b.box((hx0 + 0.07, 8.5 + 0.2 * k, 0.5 + 0.4 * k), (0.02, 0.3, 0.3), c)
    it.round_sign(b, hx1 - 0.01, 6.0, 5.3, face=(-1, 0))
    it.round_sign(b, 1.3, hy1 - 0.11, 2.9, face=(0, -1))
    return b.to_object("ENV_cau_thang", col)


def build_upper_floor(col, rng):
    b = MeshBuilder()
    x0, x1, y0, y1 = UPPER
    vx0, vx1, vy0, vy1 = VOID
    top = UP + UP_H
    # sàn gạch xanh nhạt (bỏ ô thông tầng) + mặt dưới sàn
    for rx0, ry0, rx1, ry1 in ((x0, y0, x1, vy0), (x0, vy1, x1, y1), (x0, vy0, vx0, vy1), (vx1, vy0, x1, vy1)):
        it.floor_tiles(b, rx0, ry0, rx1, ry1, UP, ["atrium_floor", "atrium_floor_2"], cell=0.5, mat="palette",
                       jitter=lambda i, j: (i * 3 + j) % 2)
    # trần trắng + giếng trời (ống sáng lên tới mái kính)
    for rx0, ry0, rx1, ry1 in ((x0, y0, x1, vy0), (x0, vy1, x1, y1), (x0, vy0, vx0, vy1), (vx1, vy0, x1, vy1)):
        it.ceiling(b, rx0, ry0, rx1, ry1, top)
    for p0, p1 in (((vx0, vy0), (vx1, vy0)), ((vx1, vy0), (vx1, vy1)), ((vx1, vy1), (vx0, vy1)), ((vx0, vy1), (vx0, vy0))):
        kit.seg_box(b, p0, p1, 0.2, top, top + 2.8, "concrete_white", ext=0.12)
        kit.seg_box(b, p0, p1, 0.25, UP - 0.4, UP + 1.05, "concrete_white", ext=0.145)  # lan can đặc trắng quanh lỗ
    b.box(((vx0 + vx1) / 2, (vy0 + vy1) / 2, top + 2.9), (vx1 - vx0, vy1 - vy0, 0.06), "lamp_white", mat="light")
    for k in range(6):  # lam thông gió trắng 1 phía giếng trời
        b.box(((vx0 + vx1) / 2, vy1 - 0.15, top + 1.9 + k * 0.14), (vx1 - vx0 - 0.4, 0.04, 0.05), "concrete_white")
    # sàn tầng dưới nhìn qua lỗ thông tầng
    b.quad([(vx0, vy0, 0.0), (vx1, vy0, 0.0), (vx1, vy1, 0.0), (vx0, vy1, 0.0)], "atrium_floor")
    for p0, p1 in (((vx0, vy0), (vx1, vy0)), ((vx1, vy0), (vx1, vy1)), ((vx1, vy1), (vx0, vy1)), ((vx0, vy1), (vx0, vy0))):
        kit.seg_box(b, p0, p1, 0.15, 0, UP - 0.4, "concrete_white", ext=0.095)
    # tường bao: bắc (cửa lên từ cầu thang ở x F2), đông, nam, tây (cửa FSA)
    it.wall(b, (x0, y1), (x1, y1), UP, top, openings=[(F2[0] - x0, F2[1] - x0, 2.6)])
    it.wall(b, (x1, y1), (x1, y0), UP, top)
    it.wall(b, (x1, y0), (x0, y0), UP, top)
    it.wall(b, (x0, y0), (x0, y1), UP, top, openings=[(FSA_Y[0] - y0, FSA_Y[1] - y0, 2.6)])
    # cửa trắng 2 cánh, biển tròn, chậu cây
    for x in (-9.5, -6.5, 0.5, 6.0):
        it.white_double_door(b, x, y0 + 0.13, along="x")
        it.round_sign(b, x, y0 + 0.11, UP + 2.6, face=(0, 1))
    for x, y in ((-0.5, -2.5), (-9.5, -1.0), (8.0, -8.0)):
        b.cylinder((x, y, UP), 0.28, 0.5, "sign_white", segments=8, radius_top=0.32)
        for k in range(10):
            a = 2 * math.pi * k / 10
            b.sphere((x + 0.3 * math.cos(a), y + 0.3 * math.sin(a), UP + 1.6), 0.5, "leaf_dark",
                     segments=6, rings=3, scale=(1, 0.12, 0.05), rot=(0, -35, math.degrees(a)))
        b.cylinder((x, y, UP + 0.5), 0.04, 1.0, "trunk", segments=5)
    # nhìn qua cửa FSA: sàn gỗ + tường trắng của văn phòng (zone_05 dựng chi tiết)
    fy0, fy1 = FSA_Y
    b.quad([(x0 - 6, fy0 - 3, UP), (x0, fy0 - 3, UP), (x0, fy1 + 3, UP), (x0 - 6, fy1 + 3, UP)], "san_go_vp")
    it.wall(b, (x0 - 6, fy0 - 3), (x0 - 6, fy1 + 3), UP, top)
    it.wall(b, (x0, fy0 - 3), (x0 - 6, fy0 - 3), UP, top)  # 2 tường bên: trước đây nhìn chéo qua cửa thấy trời
    it.wall(b, (x0 - 6, fy1 + 3), (x0, fy1 + 3), UP, top)
    it.ceiling(b, x0 - 6, fy0 - 3, x0, fy1 + 3, UP + 3.0)
    # khung cửa kính đen ở đầu cầu thang (cánh đã mở hẳn, áp vào tường)
    for xx in (F2[0], F2[1]):
        b.box((xx, y1, UP + 1.3), (0.08, 0.3, 2.6), "black")
    b.box((sum(F2) / 2, y1, UP + 2.6), (F2[1] - F2[0], 0.3, 0.1), "black")
    return b.to_object("ENV_tang_tren", col)


def build_doors(cols, rng):
    I = cols["INT"]
    # --- CỬA QUẸT THẺ (kính khung đen 2 cánh, mở quay vào sảnh cầu thang) ---
    cx0, cx1 = CARD_DOOR
    w = (cx1 - cx0) / 2
    card = mk.interactive("cua_quet_the", "Cửa quẹt thẻ", ((cx0 + cx1) / 2, CORR[3], 0), I)
    for side, hinge, yaw in (("trai", cx0, 0), ("phai", cx1, 180)):
        lb = MeshBuilder()
        it.glass_leaf(lb, w, height=2.55, framed=True)
        lb.box((w - 0.15, -0.05, 1.05), (0.03, 0.06, 0.2), "concrete_grey", mat="gloss")  # tay nắm gạt
        leaf = lb.to_object(f"cua_quet_the_canh_{side}", I, location=(hinge, CORR[3], 0))
        leaf.rotation_euler = (0, 0, math.radians(yaw))
        leaf["hinge"] = True
        mk.parent(leaf, card)
    rb = MeshBuilder()
    it.card_reader(rb, 0, 0, 1.2, face=(0, -1))
    reader = rb.to_object("dau_doc_the", I, location=(cx1 + 0.3, CORR[3] - 0.13, 0))
    mk.parent(reader, card)

    # --- CỬA PHÒNG FSA (cửa kính Wing 3 không khung, dải mờ họa tiết lá) ---
    fy0, fy1 = FSA_Y
    x = UPPER[0]
    fsa = mk.interactive("cua_phong_fsa", "Cửa Phòng FSA", (x, (fy0 + fy1) / 2, UP), I)
    w = (fy1 - fy0) / 2
    for side, hinge, yaw in (("trai", fy0, 90), ("phai", fy1, -90)):
        lb = MeshBuilder()
        it.glass_leaf(lb, w, height=2.55, framed=False, band=(1.0, 0.45, "sign_white"))
        for k in range(14):  # họa tiết lá in trên dải mờ
            lb.sphere((0.12 + k * (w - 0.24) / 13, -0.025, 1.08 + 0.2 * (k % 3)), 0.06, "curb_grey",
                      segments=6, rings=2, scale=(1, 0.2, 0.45), rot=(0, 35 * (1 if k % 2 else -1), 0))
        lb.cylinder((w - 0.2, -0.06, 0.45), 0.022, 1.5, "concrete_grey", segments=6, mat="gloss")
        # biển tròn dán trên kính (PULL / nhắc nhở) — placeholder mảng màu
        it.round_sign(lb, w - 0.45, -0.02, 1.95, face=(0, -1), r=0.13, inner="shelf_red" if side == "trai" else "fpt_orange")
        leaf = lb.to_object(f"cua_phong_fsa_canh_{side}", I, location=(x, hinge, UP))
        leaf.rotation_euler = (0, 0, math.radians(yaw))
        leaf["hinge"] = True
        mk.parent(leaf, fsa)
    sb = MeshBuilder()
    it.round_sign(sb, 0, 0, 0, face=(1, 0), r=0.2, inner="fpt_orange")  # biển "FSA" (placeholder)
    sign = sb.to_object("bien_phong_fsa", I, location=(x + 0.04, fy1 + 0.6, UP + 1.9))
    mk.parent(sign, fsa)
    rb = MeshBuilder()
    it.card_reader(rb, 0, 0, 1.2, face=(1, 0))
    reader = rb.to_object("dau_doc_the_fsa", I, location=(x + 0.13, fy0 - 0.4, UP))
    mk.parent(reader, fsa)


def build_markers(g):
    mk.spawn("zone_04_start", (11.0, 0.0, 0.0), yaw_deg=90, collection=g)
    # tên theo GDD (vào từ Hạt Lúa); lùi vào trong 2 m so với start (x 11 chỉ cách tường cuối 1,15 m → camera không
    # lùi ra sau lưng được): camera đứng sau lưng, thấy dọc hành lang tới cửa quẹt thẻ
    mk.spawn("zone_04_from_zone_03", (9.0, 0.0, 0.0), yaw_deg=90, collection=g)
    mk.spawn("zone_04_from_zone_05", (UPPER[0] + 1.5, sum(FSA_Y) / 2, UP), yaw_deg=-90, collection=g)
    mk.trigger("zone_03_enter", (11.8, 0.0, 1.4), (0.6, 3.0, 2.8), g)
    mk.trigger("cua_quet_the", (sum(CARD_DOOR) / 2, 0.2, 1.2), (3.2, 2.2, 2.4), g)
    mk.trigger("cau_thang", (sum(F1) / 2, F1_Y0 - 0.5, 1.2), (2.6, 1.2, 2.4), g)
    mk.trigger("cua_phong_fsa", (UPPER[0] + 1.6, sum(FSA_Y) / 2, UP + 1.2), (2.4, 3.6, 2.4), g)
    mk.trigger("zone_05_enter", (UPPER[0] + 0.2, sum(FSA_Y) / 2, UP + 1.2), (0.6, 3.2, 2.4), g)


def build_colliders(col):
    C = mk.collider
    x0, x1, y0, y1 = CORR
    C("san_tret", (6, -2, -0.25), (14, 8, 0.5), col)
    C("tuong_bac_trai", ((x0 - 0.5 + CARD_DOOR[0]) / 2, y1, 1.8), (CARD_DOOR[0] - x0 + 0.5, 0.3, 3.6), col)
    C("tuong_bac_phai", ((CARD_DOOR[1] + x1) / 2, y1 - 0.05, 1.8), (x1 - CARD_DOOR[1], 0.4, 3.6), col)
    C("tu_thap", (6, y0 - 0.35, 0.8), (12, 0.7, 1.6), col)
    C("dau_hanh_lang_tay", (x0 - 0.5, 0, 1.8), (0.3, 3, 3.6), col)
    # đầu phía đông (sau TRIGGER_zone_03_enter x 11.5..12.1): chặn rơi khỏi bản đồ khi trigger không chạy
    C("dau_hanh_lang_dong", (x1 + 0.15, 0, 1.8), (0.3, 3, 3.6), col)
    C("cua_quet_the", (sum(CARD_DOOR) / 2, y1, 1.3), (CARD_DOOR[1] - CARD_DOOR[0], 0.12, 2.6), col)
    # vách trên cửa quẹt thẻ (từ đỉnh cánh 2,55 m tới sàn tầng trên): không có thì camera lọt khe ra hành lang khi đi vế 1
    C("tuong_bac_tren_cua", (sum(CARD_DOOR) / 2, y1, (2.55 + UP) / 2), (CARD_DOOR[1] - CARD_DOOR[0], 0.3, UP - 2.55), col)
    # sảnh cầu thang
    hx0, hx1, hy0, hy1 = HALL
    C("san_sanh_thang", ((hx0 + hx1) / 2, (hy0 + hy1) / 2, -0.25), (hx1 - hx0, hy1 - hy0, 0.5), col)
    C("thang_tuong_tay", (hx0 - 0.1, (hy0 + hy1) / 2, 4), (0.3, hy1 - hy0, 8), col)
    C("thang_tuong_bac", ((hx0 + hx1) / 2, hy1 + 0.1, 4), (hx1 - hx0, 0.3, 8), col)
    C("thang_tuong_dong", (hx1 + 0.1, (hy0 + hy1) / 2, 4), (0.3, hy1 - hy0, 8), col)
    z_mid = STEP_N * STEP_R
    mk.collider_ramp("ve_1", (sum(F1) / 2, F1_Y0, 0), (sum(F1) / 2, LAND_Y, z_mid), F1[1] - F1[0], col)
    C("chieu_nghi", ((F1[0] + F2[1]) / 2, (LAND_Y + hy1) / 2, z_mid / 2), (F2[1] - F1[0], hy1 - LAND_Y, z_mid), col)
    mk.collider_ramp("ve_2", (sum(F2) / 2, LAND_Y, z_mid), (sum(F2) / 2, F1_Y0, UP), F2[1] - F2[0], col)
    C("chieu_tren", (sum(F2) / 2, (hy0 + F1_Y0) / 2, UP / 2), (F2[1] - F2[0], F1_Y0 - hy0, UP), col)
    C("lan_can_giua", ((F1[1] + F2[0]) / 2, (F1_Y0 + LAND_Y) / 2, 3), (F2[0] - F1[1], LAND_Y - F1_Y0, 6), col)
    # dải 0,4 m giữa bậc / chiếu nghỉ và tường sảnh (bậc đã kéo tới tường): trước đây là khe, bước vào thì rơi xuống sàn
    wx0, wx1 = hx0 + 0.1, hx1 - 0.1
    mk.collider_ramp("ve_1_mep_tay", ((wx0 + F1[0]) / 2, F1_Y0, 0), ((wx0 + F1[0]) / 2, LAND_Y, z_mid), F1[0] - wx0, col)
    C("chieu_nghi_mep_tay", ((wx0 + F1[0]) / 2, (LAND_Y + hy1) / 2, z_mid / 2), (F1[0] - wx0, hy1 - LAND_Y, z_mid), col)
    C("chieu_nghi_mep_dong", ((F2[1] + wx1) / 2, (LAND_Y + hy1) / 2, z_mid / 2), (wx1 - F2[1], hy1 - LAND_Y, z_mid), col)
    mk.collider_ramp("ve_2_mep_dong", ((F2[1] + wx1) / 2, LAND_Y, z_mid), ((F2[1] + wx1) / 2, F1_Y0, UP), wx1 - F2[1], col)
    C("chieu_tren_mep_dong", ((F2[1] + wx1) / 2, (hy0 + F1_Y0) / 2, UP / 2), (wx1 - F2[1], F1_Y0 - hy0, UP), col)
    # lan can mép tây chiếu trên: nối tiếp lan can giữa tới tường bắc hành lang (mặt tường y hy0 + 0.15), cao 2,6–6 m
    # → người đi tầng trệt (cao 1,75 m) vẫn qua cửa quẹt thẻ / chân vế 1 bên dưới
    C("lan_can_chieu_tren", ((F1[1] + F2[0]) / 2, (hy0 + 0.15 + F1_Y0) / 2, 4.3), (F2[0] - F1[1], F1_Y0 - hy0 - 0.15, 3.4), col)
    # tầng trên
    ux0, ux1, uy0, uy1 = UPPER
    vx0, vx1, vy0, vy1 = VOID
    C("san_tren", ((ux0 + ux1) / 2, (uy0 + uy1) / 2, UP - 0.25), (ux1 - ux0, uy1 - uy0, 0.5), col)
    C("lo_thong_tang", ((vx0 + vx1) / 2, (vy0 + vy1) / 2, UP + 0.6), (vx1 - vx0 + 0.5, vy1 - vy0 + 0.5, 1.2), col)
    C("tren_tuong_bac_trai", ((ux0 + F2[0]) / 2, uy1, UP + 1.6), (F2[0] - ux0, 0.3, 3.2), col)
    C("tren_tuong_bac_phai", ((F2[1] + ux1) / 2, uy1, UP + 1.6), (ux1 - F2[1], 0.3, 3.2), col)
    C("tren_tuong_dong", (ux1, (uy0 + uy1) / 2, UP + 1.6), (0.3, uy1 - uy0, 3.2), col)
    C("tren_tuong_nam", ((ux0 + ux1) / 2, uy0, UP + 1.6), (ux1 - ux0, 0.3, 3.2), col)
    C("tren_tuong_tay_nam", (ux0, (uy0 + FSA_Y[0]) / 2, UP + 1.6), (0.3, FSA_Y[0] - uy0, 3.2), col)
    C("tren_tuong_tay_bac", (ux0, (FSA_Y[1] + uy1) / 2, UP + 1.6), (0.3, uy1 - FSA_Y[1], 3.2), col)
    C("cua_phong_fsa", (ux0, sum(FSA_Y) / 2, UP + 1.3), (0.12, FSA_Y[1] - FSA_Y[0], 2.6), col)
    for x, y in ((-0.5, -2.5), (-9.5, -1.0), (8.0, -8.0)):
        C(f"chau_cay_{x:+.0f}_{y:+.0f}", (x, y, UP + 0.6), (0.8, 0.8, 1.2), col)


def build(cols, rng):
    build_ground_floor(cols["ENV"], rng)
    build_stair_hall(cols["ENV"], rng)
    build_upper_floor(cols["ENV"], rng)
    build_doors(cols, rng)
    build_markers(cols["GAME_markers"])
    build_colliders(cols["COLLISION"])


def compare_cameras():
    return [
        ("cua_quet_the", "fville_green_office_720p/t_0062.0.jpg", (-0.2, -1.0, 1.6), (8.0, 1.4, 1.4), 22),
        ("hanh_lang", "LoiDi/t_0110.0.jpg", (11.5, 0.9, 1.4), (-2.0, 0.2, 1.3), 22),
        ("cau_thang", "LoiDi/t_0124.0.jpg", (1.3, 2.0, 1.3), (1.3, 7.5, 2.6), 22),
        ("gieng_troi", "LoiDi/t_0148.0.jpg", (4.7, 0.6, UP + 1.5), (-4.0, -5.0, UP + 0.9), 22),
        ("cua_fsa", "VanPhongLamViec/t_0002.0.jpg", (UPPER[0] + 3.6, sum(FSA_Y) / 2 + 0.6, UP + 1.5),
         (UPPER[0], sum(FSA_Y) / 2, UP + 1.3), 26),
    ]


LIGHTS = [((3, 0, 3.4), 2.0, 200), ((9, 0, 3.4), 2.0, 200), ((3, 6, 7.2), 3.0, 500),
          ((-5, -5.5, 10.0), 4.0, 900), ((4, -6, 7.2), 3.0, 400), ((-9, -6, 7.2), 3.0, 400)]

if __name__ == "__main__":
    zone.run(ZONE, build, compare_cameras(),
             overview=((0, -1, 40), (0, -1, 0), 0, {"ortho": 30, "cut_z": 6.8}),
             interior=True, ao_distance=1.2, preview_lights=LIGHTS)
