"""Phòng làm việc phụ và hành lang ba phòng họp theo video tham chiếu.

Đọc data/office.json; không dùng ảnh người trong video làm texture.
Giữ lối giữa rộng 3 m. Phòng họp phía +Y: bên trái khi đi +X về phòng chính.
"""
import math
import os

import bpy

from . import interior as it, kit, markers as mk, materials
from .mesh import MeshBuilder


def wood_floor(b, rect, z=0):
    """Ván dài nâu đỏ thay các ô vuông: chia màu theo ván, ít tam giác."""
    x0, x1, y0, y1 = rect
    row, y = 0, y0
    while y < y1 - 0.001:
        x, col = x0, 0
        while x < x1 - 0.001:
            end = min(x1, x + (2.0 if row % 2 and col == 0 else 4.0))
            edge = min(y1, y + 0.22)
            b.quad([(x, y, z), (end, y, z), (end, edge, z), (x, edge, z)],
                   "san_go_vp_2" if (row * 7 + col * 3) % 5 < 2 else "san_go_vp", mat="gloss")
            x, col = end, col + 1
        y, row = min(y1, y + 0.22), row + 1


def collaboration_area(cols, height):
    """Bàn trắng / ghế lưới và tủ cây ở mép khu chính, theo đoạn 20–26 s."""
    b = MeshBuilder()
    for i, x in enumerate((-14.0, -22.2, -30.4)):
        b.box((x, 4.6, 0.74), (4.6, 1.25, 0.06), "sign_white")
        for dx in (-1.8, 1.8):
            b.box((x + dx, 4.6, 0.37), (0.08, 1.05, 0.7), "concrete_grey")
        for dx in (-1.5, -0.5, 0.5, 1.5):
            it.office_chair(b, x + dx, 3.6)
        b.box((x, 7.5, 0.6), (4.6, 0.65, 1.2), "curb_grey")
        for dx in (-1.5, -0.5, 0.5, 1.5):
            b.box((x + dx, 7.16, 0.62), (0.9, 0.03, 1.0), "concrete_grey")
            b.cylinder((x + dx, 7.5, 1.2), 0.12, 0.18, "sign_white", segments=6)
            b.ico((x + dx, 7.5, 1.55), 0.22, "leaf", subdiv=1)
        mk.collider(f"ban_cong_tac_{i}", (x, 4.6, 0.4), (4.6, 1.25, 0.8), cols["COLLISION"])
        mk.collider(f"tu_chinh_{i}", (x, 7.5, 0.6), (4.6, 0.65, 1.2), cols["COLLISION"])
    b.to_object("ENV_ban_cong_tac_tu_cay", cols["ENV"], bevel=0)


def ceiling_lights(b, rect, height):
    x0, x1, y0, y1 = rect
    it.ceiling_tex(b, x0, y0, x1, y1, height, mat="ceiling_grid_tex")
    x = x0 + 1.5
    while x < x1:
        y = y0 + 1.5
        while y < y1:
            b.box((x, y, height - 0.025), (0.6, 0.6, 0.03), "lamp_white", mat="light")
            y += 3
        # Lưới hút gió đơn giản, không thêm texture / chất liệu riêng.
        b.box((x + 0.7, (y0 + y1) / 2, height - 0.018), (0.45, 0.45, 0.025), "curb_grey")
        for k in range(4):
            b.box((x + 0.7, (y0 + y1) / 2 + (k - 1.5) * 0.07, height - 0.04), (0.35, 0.025, 0.012), "black")
        x += 3


def nameplate(name, text, x, y, collection):
    """Chữ thật trên biển phòng, dùng cùng palette để không tăng texture / material."""
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.size = 0.15
    curve.resolution_u = 2
    font_path = os.path.join(os.environ.get("WINDIR", ""), "Fonts", "arial.ttf")
    if os.path.isfile(font_path):
        curve.font = bpy.data.fonts.load(font_path, check_existing=True)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.location = (x, y, 1.92)
    obj.rotation_euler = (math.pi / 2, 0, 0)   # hướng ra hành lang (-Y)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    obj.data.materials.append(materials.get("palette"))
    color = obj.data.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    for c in color.data:
        c.color_srgb = (0.96, 0.96, 0.93, 1)
    obj.select_set(False)
    obj["room_name"] = text
    return obj


def door_leaf(key, center_x, wall_y, width, height, collection):
    """Cánh kính mở sẵn 85° vào phòng: lối vào thông, cánh có bản lề và tay nắm."""
    hinge = mk.empty(f"ENV_cua_{key}", (center_x - width / 2, wall_y, 0), collection, yaw_deg=85)
    hinge["hinge"] = True
    b = MeshBuilder()
    b.box((width / 2, 0, height / 2), (width - 0.04, 0.035, height), "glass_meeting", mat="glass")
    for x in (0.025, width - 0.025):
        b.box((x, 0, height / 2), (0.045, 0.07, height), "black")
    b.box((width / 2, 0, height - 0.025), (width, 0.07, 0.05), "black")
    b.box((width / 2, 0, 1.02), (width, 0.055, 0.24), "sign_white")
    for y in (-0.065, 0.065):
        b.box((width - 0.16, y, 1.16), (0.025, 0.025, 0.45), "concrete_grey", mat="gloss")
    leaf = b.to_object(f"ENV_canh_{key}", collection, bevel=0)
    leaf.parent = hinge
    return hinge


def shell(cols, cfg, height, floor_color):
    E, C = cols["ENV"], cols["COLLISION"]
    b = MeshBuilder()
    x0, x1, y0, y1 = cfg["corridor"]
    # Hành lang gỗ nâu đỏ: cửa kính phòng họp một bên, cửa sổ mặt ngoài bên kia.
    wood_floor(b, (x0, x1, y0, y1))
    ceiling_lights(b, (x0, x1, y0, y1), height)
    it.wall(b, (x0, y0), (x1, y0), 0, 0.95)
    it.glass_wall(b, (x0, y0), (x1, y0), 0.95, 2.72, mullion=1.8)
    it.wall(b, (x0, y0), (x1, y0), 2.72, height)
    it.baseboard(b, (x0, y0), (x1, y0), (0, 1))
    mk.collider("hanh_lang_san", ((x0 + x1) / 2, 0, -0.2), (x1 - x0, y1 - y0, 0.4), C)
    mk.collider("hanh_lang_cua_so", ((x0 + x1) / 2, y0, height / 2), (x1 - x0, 0.22, height), C)
    # Phòng phụ: bàn đen, vách gỗ, tủ thấp có cây; lối sàn gỗ dọc vách kính.
    sx0, sx1, sy0, sy1 = cfg["secondary"]
    it.floor_tiles(b, sx0, sy0, sx1, sy1, 0,
                   ["office_tile_dk", "office_tile_md", "office_tile_yl", "office_tile_lt"],
                   cell=1.2, mat="gloss", jitter=lambda i, j: floor_color(i * 2, j * 2))
    wood_floor(b, (sx0, sx1, 1.45, 3.4), z=0.006)
    ceiling_lights(b, (sx0, sx1, sy0, sy1), height)
    for p0, p1, inward in (((sx0, sy0), (sx1, sy0), (0, 1)),
                            ((sx0, sy1), (sx1, sy1), (0, -1)),
                            ((sx0, sy0), (sx0, sy1), (1, 0))):
        it.wall(b, p0, p1, 0, height)
        it.baseboard(b, p0, p1, inward)
    it.wall(b, (sx1, sy0), (sx1, sy1), 0, height,
            openings=[(-1.5 - sy0, 1.5 - sy0, 2.65)])
    it.window_band(b, (sx0, sy0), (sx1, sy0), (0, 1), rng=None)
    it.window_band(b, (sx0, sy1), (sx1, sy1), (0, -1), rng=None)
    # Vách kính bắc và cửa mở sẵn sau lối đi phụ.
    it.glass_wall(b, (sx0, 3.4), (sx1 - 3.0, 3.4), 0, height, band=(0.9, 0.32, "sign_white"))
    for x in (sx0 + 1.5, sx0 + 4.5, sx0 + 7.5, sx0 + 10.5):
        b.box((x, 0.95, 0.6), (2.7, 0.65, 1.2), "curb_grey")
        for dx in (-0.85, 0, 0.85):
            b.box((x + dx, 0.61, 0.65), (0.8, 0.025, 1.0), "concrete_grey")
            b.box((x + dx, 0.58, 0.96), (0.12, 0.02, 0.04), "sign_white")
            b.cylinder((x + dx, 0.95, 1.2), 0.12, 0.18, "sign_white", segments=6)
            b.ico((x + dx, 0.95, 1.5), 0.2, "leaf", subdiv=1, scale=(1, 1, 1.3))
        mk.collider(f"phu_tu_{x:g}", (x, 0.95, 0.6), (2.7, 0.65, 1.2), C)
    b.to_object("ENV_phong_phu_hanh_lang", E, bevel=0)
    mk.collider("phu_san", ((sx0 + sx1) / 2, (sy0 + sy1) / 2, -0.2), (sx1 - sx0, sy1 - sy0, 0.4), C)
    for key, center, size in (
        ("nam", ((sx0 + sx1) / 2, sy0, height / 2), (sx1 - sx0, 0.22, height)),
        ("bac", ((sx0 + sx1) / 2, sy1, height / 2), (sx1 - sx0, 0.22, height)),
        ("tay", (sx0, (sy0 + sy1) / 2, height / 2), (0.22, sy1 - sy0, height)),
        ("dong_nam", (sx1, (sy0 - 1.5) / 2, height / 2), (0.22, -1.5 - sy0, height)),
        ("dong_bac", (sx1, (sy1 + 1.5) / 2, height / 2), (0.22, sy1 - 1.5, height)),
        ("vach_kinh", ((sx0 + sx1 - 3) / 2, 3.4, height / 2), (sx1 - sx0 - 3, 0.15, height)),
    ):
        mk.collider(f"phu_{key}", center, size, C)
    mk.spawn("phong_phu", (sx1 - 1.8, 0, 0), yaw_deg=90, collection=cols["GAME_markers"])
    mk.spawn("hanh_lang_phong_hop", (x0 + 1.8, 0, 0), yaw_deg=270, collection=cols["GAME_markers"])


def rooms(cols, cfg, height):
    out = {}
    for item in cfg["meeting_rooms"]:
        key, label = item["id"], item["name"]
        x0, x1, y0, y1 = item["bounds"]
        cx = (x0 + x1) / 2
        width = cfg["door_width_m"]
        b = MeshBuilder()
        it.floor_tiles(b, x0, y0, x1, y1, 0, ["office_tile_md", "office_tile_lt"], cell=1.2, mat="gloss")
        it.meeting_room(b, x0, y0, x1, y1, ("S", cx - width / 2, cx + width / 2), h=height)
        for a, z in ((x0, cx - width / 2), (cx + width / 2, x1)):
            kit.seg_box(b, (a, y0 - 0.01), (z, y0 - 0.01), 0.1, 0.92, 1.2, "sign_white")
        b.box((cx + 1.9, y0 - 0.075, 1.98), (1.35, 0.06, 0.38), "black")
        # Khung cửa riêng nhìn thấy rõ ở lối vào từng phòng.
        for x in (cx - width / 2, cx + width / 2):
            b.box((x, y0, 1.3), (0.07, 0.12, 2.6), "black")
        b.box((cx, y0, 2.6), (width + 0.07, 0.12, 0.07), "black")
        for x in (cx - 1.2, cx + 1.2):
            b.box((x, (y0 + y1) / 2, height - 0.025), (0.6, 0.6, 0.03), "lamp_white", mat="light")
        mesh = b.to_object(f"{key}_mesh", cols["INT"], bevel=0)
        root = mk.interactive(key, label, (cx, (y0 + y1) / 2, 0), cols["INT"])
        mk.parent(mesh, root)
        root["room_number"] = cfg["meeting_rooms"].index(item) + 1
        door_leaf(key, cx, y0, width - 0.08, 2.5, cols["ENV"])
        nameplate(f"ENV_bien_{key}", label, cx + 1.9, y0 - 0.112, cols["ENV"])
        C = cols["COLLISION"]
        mk.collider(f"{key}_san", (cx, (y0 + y1) / 2, -0.2), (x1 - x0, y1 - y0, 0.4), C)
        mk.collider(f"{key}_bac", (cx, y1, height / 2), (x1 - x0, 0.2, height), C)
        # Cánh mở 85° nằm bên trái ngưỡng, không chặn khoảng mở 1.8 m.
        mk.collider(f"{key}_canh", (cx - width / 2 + 0.08, y0 + 0.85, 1.25), (width - 0.08, 0.08, 2.5), C, yaw_deg=85)
        out[key] = (x0, x1, y0, y1)
    return out


def desks(cols, cfg, width):
    """16 bàn phụ dùng cùng mesh mẫu, không thêm texture."""
    E = cols["ENV"]
    meshes = {}
    for plant in (False, True):
        b = MeshBuilder()
        it.desk_unit(b, plant=plant)
        obj = b.to_object(f"ENV_phu_mau_{int(plant)}", E)
        # Cùng độ cao ghế của bản đang chơi (scene_fixes: hạ 6.7 cm).
        # Làm trước khi gộp bàn phụ để không cần sửa mesh đã gộp ở runtime.
        for v in obj.data.vertices:
            if v.co.y < -0.69:
                v.co.z -= 0.067
        meshes[plant] = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
    for row, (cx, cy) in enumerate(cfg["secondary_clusters"]):
        for k in range(4):
            x = cx + (k - 1.5) * width
            for side, yaw in enumerate((0, 180)):
                obj = bpy.data.objects.new(f"ENV_ban_phu_{row}_{k}_{side}", meshes[k % 3 == 0])
                E.objects.link(obj)
                obj.location = (x, cy, 0)
                obj.rotation_euler = (0, 0, math.radians(yaw))
                obj["batch"] = "ENV_ban_phu"
        mk.collider(f"cum_ban_phu_{row}", (cx, cy, 0.55), (4 * width, 1.5, 1.1), cols["COLLISION"])
