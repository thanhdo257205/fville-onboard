"""zone_02_campus — cổng F-Ville (biển chữ FPT SOFTWARE), giếng làng, tượng Cuder, lối đi, sân trước sảnh.

Chạy:  python scripts/build.py zone_02

Bố cục (1 đơn vị = 1 m, +Y = hướng đi vào campus), theo LoiDi t_0000–t_0018 và flycam FV ~1:57–2:00:
  y -24..4   đường xe bus từ phía nam đi lên, giữa đường có ĐẢO GIỌT NƯỚC lát gạch lục giác:
             GIẾNG LÀNG + cần vọt + bụi tre (SPAWN phía nam đảo)
  y   4..11  đường nội bộ chạy ngang (E–W)
  y  11..14  vỉa hè lục giác, viền vỉa vàng–xám, cột đèn 3 bóng
  y  14      bờ tường bê tông thấp + dải cây bụi; sau đó là gò cỏ với BIỂN CHỮ FPT SOFTWARE = CỔNG F-VILLE
             lối gạch đỏ bắt đầu ngay bên trái biển chữ (x 6.5..11.5)
  y 14..44   lối gạch giữa bồn cây, xuyên qua canteen pilotis (y 26..36)
  y 44..74   SÂN GẠCH + TƯỢNG CUDER trước ruộng đất; bậc thềm đá đen lên sảnh (y 69.5..72)
Quãng đi bộ thật đã rút ngắn.
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
for _m in [k for k in sys.modules if k == "lib" or k.startswith("lib.")]:
    del sys.modules[_m]  # nạp lại khi chạy nhiều lần trong Blender đang mở

from lib import bamboo, cuder, kit, props, trees, zone  # noqa: E402
from lib import quality as Q  # noqa: E402
from lib import markers as mk  # noqa: E402
from lib.mesh import MeshBuilder  # noqa: E402

ZONE = "zone_02_campus"

# --- Toạ độ chính ---
ROAD_Y = (4.0, 11.0)                  # đường nội bộ chạy ngang trước biển chữ
ROAD_X = (-40.0, 50.0)
APPROACH_X = (10.0, 30.0)             # đường xe bus từ phía nam
WALK = (11.0, 14.0)                   # vỉa hè phía bắc đường
WALK_Z = 0.15
WALL_Y = 14.0                         # bờ tường thấp trước gò cỏ
PATH_X = (6.5, 11.5)                  # lối gạch rộng 5 m (≥ 2.5 m cho camera)
PAVILION = (-8.0, 26.0, 26.0, 36.0)
PLAZA = (-8.0, 36.0, 44.0, 74.0)
PLAZA_Z = 0.08
SIGN = (20.0, 18.5)                   # biển chữ FPT SOFTWARE, mặt chữ nhìn về -Y (ra đường)
ISLAND = (15.7, 25.5, -1.0, 2.2)      # đảo giọt nước: tâm đầu tròn x, mũi nhọn x, tâm y, bán kính
ISLAND_Z = 0.2
WELL = (16.0, -1.0)
BAMBOO = (21.5, -0.6)
# bụi tre (mô hình Sketchfab, lib/bamboo.py): (x, y, z, cao m) — đuôi đảo giếng (như ảnh thật), 2 bên đường xe bus vào
# (ngoài bó vỉa x 9.88 / 30.12, không chắn đường)
BAMBOO_SPOTS = ((*BAMBOO, ISLAND_Z, 5.2), (8.0, -2.5, 0.0, 4.6), (8.3, -12.0, 0.0, 5.0), (32.0, -6.0, 0.0, 4.8))
BAMBOO_R = {}                         # bán kính gốc thật từng bụi (build_vegetation ghi, build_colliders dùng)
STATUE = (20.0, 62.2)
# Tượng Cuder: mô hình Meshy (lib/cuder.py, đọc assets/props/cuder/source/cuder_meshy.glb — chỉ có trên máy làm việc).
# Cao (bệ + tượng) = tượng dựng tay trước đây; búi tóc sau gáy (chờ xác nhận) là object riêng, False = bỏ.
CUDER_H = 2.384
CUDER_KEEP_BUN = True
CUDER_FOOT = {}                       # khung bao xy của tượng (build_interactives ghi, build_colliders dùng)
DIRT = (2.0, 24.0, 64.0, 68.0)
STAIRS = dict(x0=18.0, y0=69.5, width=10.0, n=5, rise=0.16, run=0.5)
LOBBY_Z = PLAZA_Z + STAIRS["n"] * STAIRS["rise"]  # cao độ sàn sảnh (zone_03 khớp vào)


def island_poly():
    """Đa giác đảo giọt nước: đầu tròn phía tây (giếng), mũi nhọn phía đông."""
    cx, tip_x, cy, r = ISLAND
    pts = [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(75, 290, 15)]
    return pts + [(tip_x, cy)]


def build_ground(col):
    b = MeshBuilder()
    b.grid(-60, -24, 72, 100, 0.0, Q.cell(4.0), ["grass"])  # màu loang tự nhiên nhờ tint="ground"
    # đường nhựa: đường ngang + đường xe bus phía nam (chia lưới để màu loang theo đỉnh)
    rx0, rx1 = ROAD_X
    ry0, ry1 = ROAD_Y
    ax0, ax1 = APPROACH_X
    b.grid(rx0, ry0, rx1, ry1, 0.02, 3.5, ["asphalt"])
    b.grid(ax0, -24, ax1, ry0, 0.02, 3.5, ["asphalt"])
    for x in range(int(rx0) + 2, int(rx1), 4):
        if not ax0 - 1 < x < ax1:
            b.quad([(x, 7.42, 0.03), (x + 2, 7.42, 0.03), (x + 2, 7.58, 0.03), (x, 7.58, 0.03)], "road_line")
    # vỉa hè lục giác phía bắc đường (texture gạch lục giác)
    wy0, wy1 = WALK
    b.grid(rx0, wy0, rx1, wy1, WALK_Z, 3.0, ["tex_white"], mat="hex_tex")
    kit.slab_rect_sides(b, rx0, wy0, rx1, wy1, 0, WALK_Z, "concrete_grey")
    # đảo giọt nước: viền bê tông + mặt gạch lục giác + mảng cỏ dưới bụi tre
    poly = island_poly()
    b.prism(poly, 0.0, ISLAND_Z, "concrete_white")
    b.raw([(x, y, ISLAND_Z + 0.004) for x, y in poly], [tuple(range(len(poly)))], "tex_white", mat="hex_tex")
    b.disc((BAMBOO[0], BAMBOO[1], ISLAND_Z + 0.012), 1.3, "grass_dark", segments=10)
    # sàn mài dưới canteen
    px0, px1 = PATH_X
    b.grid(PAVILION[0], PAVILION[2], PAVILION[1], PAVILION[3], PLAZA_Z, 2.0, ["polished_floor"])
    kit.slab_rect_sides(b, PAVILION[0], PAVILION[2], PAVILION[1], PAVILION[3], 0, PLAZA_Z, "concrete_grey")
    # lối gạch + sân gạch lớn: texture đan rổ, tách object riêng (chỉ object này có UV)
    pb = MeshBuilder()
    kit.brick_paving(pb, px0, WALL_Y, px1, PAVILION[2], PLAZA_Z)
    kit.brick_paving(pb, px0, PAVILION[3], px1, PLAZA[2], PLAZA_Z)
    kit.brick_paving(pb, PLAZA[0], PLAZA[2], PLAZA[1], PLAZA[3], PLAZA_Z)
    paving = pb.to_object("ENV_paving", col)
    # ruộng đã gặt: nền đất có viền gạch
    dx0, dx1, dy0, dy1 = DIRT
    kit.slab_rect(b, dx0, dy0, dx1, dy1, 0, PLAZA_Z + 0.04, "dirt")
    for p0, p1 in (((dx0, dy0), (dx1, dy0)), ((dx1, dy0), (dx1, dy1)), ((dx1, dy1), (dx0, dy1)), ((dx0, dy1), (dx0, dy0))):
        kit.seg_box(b, p0, p1, 0.12, 0, PLAZA_Z + 0.08, "brick_dark")
    return b.to_object("ENV_ground", col, tint="ground"), paving


def build_buildings(col, rng):
    b = MeshBuilder()
    veg = MeshBuilder()  # bụi cây trên mái → object riêng, tô bóng mềm
    # cánh sau (sảnh nằm ở đây) — lam gạch đỏ
    top = kit.building_block(b, -18, 72, 34, 86, floors=3, facades=("S", "E"), roof_rng=rng)
    # cánh trái (sau lối đi, bên trái nhìn từ cổng): khối có LOGO FPT trên chân chữ V (flycam FV ~2:00)
    kit.building_block(b, -18, 44, -6, 72, floors=3, facades=("E",), legs="v", roof_rng=rng)
    kit.logo_placeholder(b, -13.0, 44.0, kit.GROUND_H + 3 * kit.FLOOR_H - 1.7, face=(0, -1), size=1.3)
    # lối vào sảnh: bậc thềm đá đen + chiếu nghỉ + cửa kính
    s = STAIRS
    kit.stairs(b, s["x0"], s["y0"], s["width"], s["n"], s["rise"], s["run"], z0=PLAZA_Z)
    y_land = s["y0"] + s["n"] * s["run"]
    b.box_minmax((s["x0"] - 1, y_land, 0), (s["x0"] + s["width"] + 1, 74.05, LOBBY_Z), "stone_black", mat="gloss")
    _ramp(b, s["x0"] + s["width"] + 1, y_land, 1.4, LOBBY_Z)
    for i in range(6):
        x = s["x0"] + i * s["width"] / 5
        b.box((x, 74.1, LOBBY_Z + 1.6), (0.08, 0.08, 3.2), "black")
    b.box_minmax((s["x0"], 74.08, LOBBY_Z), (s["x0"] + s["width"], 74.14, LOBBY_Z + 3.2), "glass", mat="glass")
    # khối đầu phía đông: vách kính xám (không logo)
    kit.building_block(b, 36, 66, 50, 86, floors=3, facades=("S", "W"), pilotis=False, style="glass", roof_rng=rng)
    kit.roof_garden(veg, -17, 73, 33, 85, top + 0.45, rng, density=0.03)
    kit.roof_garden(veg, -17, 45, -7, 71, top + 0.45, rng, density=0.03)
    props.pavilion(b, PAVILION[0], PAVILION[2], PAVILION[1], PAVILION[3], PATH_X[0] - 0.5, PATH_X[1] + 0.5, rng,
                   veg=veg)
    veg.to_object("ENV_cay_mai", col, smooth_angle=80, tint="foliage")
    return b.to_object("ENV_buildings", col)


def _ramp(b, x0, y_top, width, h):
    """Dốc trắng cho xe lăn cạnh bậc thềm (thấy trong LoiDi t_0074)."""
    y_bot = y_top - h * 8
    verts = [(x0, y_bot, 0), (x0 + width, y_bot, 0), (x0 + width, y_top, 0), (x0, y_top, 0),
             (x0, y_top, h), (x0 + width, y_top, h)]
    faces = [(0, 1, 5, 4), (4, 5, 2, 3), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    b.raw(verts, faces, "concrete_white")


def _scatter(rng, regions, n):
    """n điểm ngẫu nhiên trong các vùng chữ nhật (x0, x1, y0, y1), tỉ lệ theo diện tích."""
    areas = [(x1 - x0) * (y1 - y0) for x0, x1, y0, y1 in regions]
    for _ in range(n):
        x0, x1, y0, y1 = rng.choices(regions, areas)[0]
        yield rng.uniform(x0, x1), rng.uniform(y0, y1)


def build_vegetation(col, rng):
    b = MeshBuilder()
    kit.TREES = []                        # cây mô hình Sketchfab (lib/trees.py), gốc vôi trắng vẫn dựng khối
    px0, px1 = PATH_X
    # hàng cây hai bên lối gạch (thân quét vôi trắng trong ảnh — ở đây giữ thân nâu)
    for y in (17.0, 20.5, 24.0, 38.0, 41.5):
        kit.tree(b, px0 - 2.0, y, rng)
        kit.tree(b, px1 + 2.0, y, rng)
    # cây sau biển chữ và hai bên
    for x, y in ((-3, 21), (0, 23), (-8, 18), (15, 23.5), (19, 24.5), (24, 23), (28, 20.5), (32, 23),
                 (-5, 40), (1, 41), (17, 40), (22, 42), (-4, 47), (-4, 56), (33, 47), (33, 55), (33, 62)):
        kit.tree(b, x, y, rng)
    north = [(13, 40, 22.5, 25.5), (28, 40, 15.5, 22.5), (-34, 3, 16, 25)]
    for x, y in _scatter(rng, north, Q.n(13, 1.6)):  # rừng cây dày sau bờ tường (như LoiDi t_0000) — bản rút gọn
        kit.tree(b, x, y, rng, height=rng.uniform(7.5, 10), detail=1)
    south = [(-34, 7, -20, 1), (33, 48, -20, 1)]
    for x, y in _scatter(rng, south, Q.n(12, 1.6)):  # cây phía nam đường, hai bên đường xe bus — bản rút gọn
        kit.tree(b, x, y, rng, height=rng.uniform(6.5, 9), detail=1)
    # dải cây bụi trên bờ tường + bồn cây bụi dọc lối gạch
    rx0, rx1 = ROAD_X
    kit.hedge(b, (rx0, WALL_Y + 0.6), (px0 - 0.2, WALL_Y + 0.6), width=0.9, height=0.5, z=0.3, rng=rng)
    kit.hedge(b, (px1 + 0.2, WALL_Y + 0.6), (rx1, WALL_Y + 0.6), width=0.9, height=0.5, z=0.3, rng=rng)
    for y0, y1 in ((WALL_Y + 1.0, PAVILION[2]), (PAVILION[3], PLAZA[2])):
        kit.hedge(b, (px0 - 0.65, y0), (px0 - 0.65, y1), width=0.8, height=0.75, rng=rng)
        kit.hedge(b, (px1 + 0.65, y0), (px1 + 0.65, y1), width=0.8, height=0.75, rng=rng)
    lawns = [(-34, 4, 16, 25), (13, 34, 21.5, 25), (-34, 7, -20, 1), (33, 48, -20, 1)]
    for x, y in _scatter(rng, lawns, Q.n(30)):
        kit.bush(b, x, y, rng.uniform(0.4, 0.8), rng, flowers=rng.random() < 0.3, lobes=1)
    # khóm cỏ quanh đảo giếng và mép lối gạch
    kit.grass_tufts(b, (BAMBOO[0] - 1.0, BAMBOO[0] + 1.0, BAMBOO[1] - 1.0, BAMBOO[1] + 1.0), 12, rng, z=ISLAND_Z)
    kit.grass_tufts(b, (px0 - 3.5, px0 - 1.2, WALL_Y + 1.5, PAVILION[2] - 0.5), 12, rng)
    kit.grass_tufts(b, (px1 + 1.2, px1 + 3.5, WALL_Y + 1.5, PAVILION[2] - 0.5), 12, rng)
    # bụi tre: mô hình Sketchfab (lib/bamboo.py); bụi khối cũ vẫn gọi với builder bỏ hình → rng rút y như trước
    kit.bamboo_clump(kit.Skip(), *BAMBOO, rng, n=16, height=5.5, z=ISLAND_Z)
    veg = b.to_object("ENV_vegetation", col, smooth_angle=80, tint="foliage")
    trees.place(col, kit.TREES)
    kit.TREES = None
    for k, (_, r) in enumerate(bamboo.place(col, BAMBOO_SPOTS)):
        BAMBOO_R[k] = r
    return veg


def build_props(col, rng):
    b = MeshBuilder()
    rx0, rx1 = ROAD_X
    ry0, ry1 = ROAD_Y
    ax0, ax1 = APPROACH_X
    # viền vỉa vàng–xám: mép vỉa hè bắc, mép đường phía nam (chừa đường xe bus)
    kit.curb_line(b, (rx0, ry1 + 0.12), (rx1, ry1 + 0.12))
    kit.curb_line(b, (rx0, ry0 - 0.12), (ax0 - 0.12, ry0 - 0.12))
    kit.curb_line(b, (ax1 + 0.12, ry0 - 0.12), (rx1, ry0 - 0.12))
    kit.curb_line(b, (ax0 - 0.12, -24), (ax0 - 0.12, ry0))
    kit.curb_line(b, (ax1 + 0.12, -24), (ax1 + 0.12, ry0))
    # bờ tường bê tông thấp trước gò cỏ (chừa lối gạch)
    px0, px1 = PATH_X
    kit.seg_box(b, (rx0, WALL_Y + 0.15), (px0, WALL_Y + 0.15), 0.3, 0, 0.8, "concrete_grey")
    kit.seg_box(b, (px1, WALL_Y + 0.15), (rx1, WALL_Y + 0.15), 0.3, 0, 0.8, "concrete_grey")
    for y0_, y1_ in ((WALL_Y, PAVILION[2]), (PAVILION[3], PLAZA[2])):
        kit.planter_wall(b, (px0 - 0.12, y0_), (px0 - 0.12, y1_))
        kit.planter_wall(b, (px1 + 0.12, y0_), (px1 + 0.12, y1_))
    # cột đèn 3 bóng dọc vỉa hè (có 1 cột ngay góc lối gạch), thùng rác xanh – vàng
    for x in (-24, -12, px0 - 0.6, 15, 26, 38):
        kit.lamp_post(b, x, WALK[0] + 0.6, z=WALK_Z)
    for x in (-10, 34):
        kit.lamp_post(b, x, ry0 - 0.8)
    for k, c in enumerate(("fpt_blue", "curb_yellow")):
        b.cylinder((13.0 + k * 0.6, WALK[0] + 0.7, WALK_Z), 0.25, 0.8, c, segments=8)
    for x, y in ((px0 + 0.4, 21), (px1 - 0.4, 40), (-6, 46), (34, 46)):
        kit.lamp_post(b, x, y, z=PLAZA_Z)
    return b.to_object("ENV_props", col)


def build_interactives(col, rng):
    # Cổng F-Ville = biển chữ FPT SOFTWARE trên gò cỏ (chữ: khối trắng placeholder)
    gate = mk.interactive("cong_fville", "Cổng F-Ville", (*SIGN, 0), col)
    sb = MeshBuilder()
    props.fpt_sign(sb)
    sign = sb.to_object("cong_fville_bien_chu", col, location=(*SIGN, 0))
    mk.parent(sign, gate)

    # Giếng làng + cần vọt (sào gác về phía bụi tre, tựa lên cọc chạc)
    well = mk.interactive("gieng_lang", "Giếng Làng", (*WELL, ISLAND_Z), col)
    wb = MeshBuilder()
    props.well(wb, rng)
    props.well_sweep(wb, pivot=(2.6, 0.25), fork_h=0.6, tail=(4.2, 0.4, 0.5), tip=(0.2, 0.0, 0.66))
    wm = wb.to_object("gieng_lang_mesh", col, location=(*WELL, ISLAND_Z), bevel=0.012)
    mk.parent(wm, well)

    # Tượng Cuder (mặt nhìn về -Y, phía người chơi đi tới): mô hình Meshy, thay tượng + bệ dựng tay trước đây
    st = mk.interactive("tuong_cuder", "Tượng Cuder", (*STATUE, PLAZA_Z), col)
    fm, bun, info = cuder.build(col, "tuong_cuder_tuong", (*STATUE, PLAZA_Z), CUDER_H, keep_bun=CUDER_KEEP_BUN)
    for o in (fm, bun):
        if o:
            mk.parent(o, st)
    co = [fm.matrix_world @ v.co for v in fm.data.vertices]
    CUDER_FOOT.update(x=(min(p.x for p in co), max(p.x for p in co)), y=(min(p.y for p in co), max(p.y for p in co)))
    return gate, well, st


def build_markers(col):
    mk.spawn("zone_02_start", (17.5, -8.0, 0.0), yaw_deg=0, collection=col)
    mk.spawn("zone_02_from_zone_03", (23.0, 67.0, PLAZA_Z), yaw_deg=180, collection=col)

    mk.trigger("zone_02_enter", (17.5, -8.0, 1.5), (8, 4, 3), col)
    mk.trigger("cong_fville", (SIGN[0], sum(WALK) / 2, 1.5), (12, 3, 3), col)
    mk.trigger("gieng_lang", (*WELL, 1.5), (4.5, 4.5, 3), col)
    mk.trigger("tuong_cuder", (STATUE[0], STATUE[1] - 1.5, 1.5), (6, 6, 3), col)
    s = STAIRS
    mk.trigger("zone_03_enter", (s["x0"] + s["width"] / 2, 73.0, LOBBY_Z + 1.2), (s["width"], 2.0, 2.4), col)


def build_colliders(col):
    C = mk.collider
    rx0, rx1 = ROAD_X
    C("ground", (5, 38, -0.25), (140, 130, 0.5), col)
    C("via_he", ((rx0 + rx1) / 2, sum(WALK) / 2, WALK_Z / 2), (rx1 - rx0, WALK[1] - WALK[0], WALK_Z), col)
    cx, tip_x, cy, r = ISLAND
    C("dao_gieng", ((cx - r + tip_x) / 2, cy, ISLAND_Z / 2), (tip_x - cx + r, 2 * r, ISLAND_Z), col)
    # bờ tường + dải cây bụi (chừa lối gạch)
    px0, px1 = PATH_X
    C("bo_tuong_trai", ((rx0 + px0) / 2, WALL_Y + 0.5, 0.6), (px0 - rx0, 1.2, 1.2), col)
    C("bo_tuong_phai", ((px1 + rx1) / 2, WALL_Y + 0.5, 0.6), (rx1 - px1, 1.2, 1.2), col)
    # nhà
    C("canh_sau", (8, 79, 7.5), (48, 10, 15), col)
    C("canh_trai", (-12, 58, 7.5), (8, 24, 15), col)
    C("khoi_kinh_xam", (43, 76, 8), (14, 20, 16), col)
    C("chieu_nghi_sanh", (23, 73.0, LOBBY_Z / 2), (12, 2.1, LOBBY_Z), col)
    s = STAIRS
    mk.collider_ramp("bac_them", (s["x0"] + s["width"] / 2, s["y0"], PLAZA_Z),
                     (s["x0"] + s["width"] / 2, s["y0"] + s["n"] * s["run"], LOBBY_Z), s["width"], col)
    # canteen: 2 phòng kính + cột
    C("canteen_trai", (-1.25, 31, 2), (13.5, 10.0, 4), col)
    C("canteen_phai", (19.25, 31, 2), (13.5, 10.0, 4), col)
    # lối gạch: bồn cây
    for y0, y1 in ((WALL_Y, PAVILION[2]), (PAVILION[3], PLAZA[2])):
        for x in (PATH_X[0] - 0.4, PATH_X[1] + 0.4):
            C(f"bon_cay_{x:.0f}_{y0:.0f}", (x, (y0 + y1) / 2, 1.5), (0.8, y1 - y0, 3), col)
    # vật
    C("gieng_lang", (*WELL, 0.5), (1.5, 1.5, 1.0), col)
    for k, (x, y, z, _) in enumerate(BAMBOO_SPOTS):   # gốc bụi tre (thân tre loe dần lên ngọn, gốc chỉ ~0,3 m)
        d = 2 * (BAMBOO_R[k] + 0.25)
        C("bui_tre" if k == 0 else f"bui_tre_{k + 1}", (x, y, z + 1.5), (d, d, 3.0), col)
    fx, fy = CUDER_FOOT["x"], CUDER_FOOT["y"]   # hộp va chạm ôm khung bao tượng mới (bệ + đống xu + người)
    C("tuong_cuder", ((fx[0] + fx[1]) / 2, (fy[0] + fy[1]) / 2, (CUDER_H + PLAZA_Z) / 2),
      (fx[1] - fx[0] + 0.04, fy[1] - fy[0] + 0.04, CUDER_H + PLAZA_Z), col)
    for x in (-24, -12, px0 - 0.6, 15, 26, 38):
        C(f"cot_den_{x:+.0f}", (x, WALK[0] + 0.6, 2), (0.3, 0.3, 4), col)
    # biên vùng chơi (tường vô hình)
    C("bien_nam", (14, -24.5, 2), (54, 0.5, 4), col)
    C("bien_tay_duong", (-12.5, -5, 2), (0.5, 38, 4), col)
    C("bien_dong_duong", (40.5, -5, 2), (0.5, 38, 4), col)
    C("bien_nam_san_trai", (-5.95, 43.6, 2), (24.1, 0.5, 4), col)
    C("bien_nam_san_phai", (24.0, 43.6, 2), (24, 0.5, 4), col)
    C("bien_dong_san", (36.4, 55, 2), (0.5, 22, 4), col)
    C("bien_tay_san", (-18.4, 65, 2), (0.5, 43, 4), col)
    C("bien_bac_san", (9.0, 86.4, 2), (55, 0.5, 4), col)
    C("khe_giua_nha", (34.0, 80, 2), (4.0, 12, 4), col)


def compare_cameras():
    return [
        # (tên, ảnh tham chiếu, vị trí cam, điểm nhìn, lens)
        ("cong", "LoiDi/t_0000.0.jpg", (12.0, 5.5, 1.5), (19.4, 12.2, 1.9), 20),
        ("dao_gieng", "fville_green_office_720p/s_0117.1.jpg", (14.3, -3.7, 1.3), (19.0, 2.5, 0.9), 24),
        ("gieng", "GiengLang/t_0012.0.jpg", (WELL[0] + 1.25, WELL[1] + 0.35, ISLAND_Z + 1.35),
         (WELL[0] - 1.2, WELL[1] - 0.2, 0.2), 26),
        ("tuong", "TuongCuDo/t_0012.0.jpg", (STATUE[0] + 0.05, STATUE[1] - 2.3, 1.45), (STATUE[0], STATUE[1] + 1.0, 1.3), 26),
        ("san", "LoiDi/t_0056.0.jpg", (8.0, 47.0, 1.4), (17.0, 74.0, 6.5), 22),
        ("loi_di", "LoiDi/t_0012.0.jpg", (9.0, 18.5, 1.3), (9.0, 30.0, 1.6), 22),
        ("tre_gieng", None, (17.5, -7.0, 1.6), (19.5, -0.5, 2.6), 24),               # bụi tre đuôi đảo giếng + 2 bên đường
        ("cay_canh_lang", None, (24.0, 2.0, 1.7), (14.0, 22.0, 4.0), 22),          # cây sau biển chữ + hàng cây lối gạch
    ]


def build(cols, rng):
    env = cols["ENV"]
    build_ground(env)
    build_buildings(env, rng)
    build_vegetation(env, rng)
    build_props(env, rng)
    build_interactives(cols["INT"], rng)
    build_markers(cols["GAME_markers"])
    build_colliders(cols["COLLISION"])


if __name__ == "__main__":
    zone.run(ZONE, build, compare_cameras(), overview=((48, -30, 42), (16, 26, 0), 24))
