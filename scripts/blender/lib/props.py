"""Vật đặc trưng của F-Ville (giếng làng, tượng Cuder, biển chữ...).

Mỗi hàm thêm hình khối vào MeshBuilder; gốc toạ độ = tâm chân vật, mặt trước nhìn về -Y.
"""
import math
import os

import bpy
from mathutils import Matrix

from . import kit
from . import quality as Q


# ---------------- Giếng làng ----------------
def well(b, rng, r_out=0.65, r_in=0.45, height=0.58, courses=2, per_course=18):
    """Giếng tròn xây đá ong (khối đứng, mạch vữa sáng), lòng phủ lưới + dương xỉ."""
    # lõi vữa (vành khuyên)
    _ring(b, r_in + 0.01, r_out - 0.015, 0, height - 0.01, "mortar", 18)
    gap = 0.008
    ch = (height - gap * courses) / courses
    r_mid = (r_out + r_in) / 2
    step = 2 * math.pi / per_course
    agap = 0.018 / r_mid  # khe vữa đều (theo góc)
    for c in range(courses):
        z = gap + c * (ch + gap)
        off = (0.5 if c % 2 else 0.0) * step
        for i in range(per_course):
            a0 = off + i * step + agap / 2
            shade = "tex_white" if rng.random() > 0.3 else "tex_shade"  # đá ong: texture × sắc độ từng viên
            _sector(b, r_in, r_out, a0, a0 + step - agap, z, z + ch, shade, mat="laterite_tex")
    # đất + dương xỉ + lưới
    b.disc((0, 0, height - 0.18), r_in + 0.01, "dirt", segments=14)
    for k in range(3):  # 3 khóm dương xỉ, mỗi khóm vài lá dài toả ra
        cx, cy = rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2)
        for i in range(5):
            a = 2 * math.pi * i / 5 + rng.uniform(-0.3, 0.3)
            b.sphere((cx + 0.08 * math.cos(a), cy + 0.08 * math.sin(a), height - 0.13), 0.09, "fern",
                     segments=6, rings=3, scale=(1.3, 0.3, 0.25), rot=(0, -20, math.degrees(a)))
    for k in range(-4, 5):
        x = k * 0.095
        w = math.sqrt(max(r_in ** 2 - x ** 2, 0.01))
        b.box((x, 0, height - 0.05), (0.008, 2 * w, 0.008), "net")
        b.box((0, x, height - 0.05), (2 * w, 0.008, 0.008), "net")


def well_sweep(b, pivot=(1.6, 0.53), fork_h=0.55, tail=(3.0, 1.0, 0.45), tip=(0.15, 0.05, 0.66)):
    """Cần vọt: cọc chạc + sào gỗ gác qua thành giếng."""
    px, py = pivot
    b.cylinder((px, py, 0), 0.05, fork_h - 0.12, "wood_pole", segments=6)
    for s in (-1, 1):
        b.tube((px, py, fork_h - 0.14), (px + 0.08 * s, py - 0.05 * s, fork_h + 0.05), 0.03, "wood_pole", 5)
    b.tube(tail, tip, 0.045, "wood_pole", segments=6, radius_end=0.04)


def _sector(b, r0, r1, a0, a1, z0, z1, color, sub=2, mat="palette"):
    """Khối cong (một đoạn vành khuyên) — viên đá xây giếng."""
    angs = [a0 + (a1 - a0) * k / sub for k in range(sub + 1)]
    ring = [(r1, a) for a in angs] + [(r0, a) for a in reversed(angs)]
    poly = [(r * math.cos(a), r * math.sin(a)) for r, a in ring]
    b.prism(poly, z0, z1, color, cap_bottom=False, mat=mat)


def _ring(b, r0, r1, z0, z1, color, seg):
    verts, faces = [], []
    for z in (z0, z1):
        for r in (r0, r1):
            for i in range(seg):
                a = 2 * math.pi * i / seg
                verts.append((r * math.cos(a), r * math.sin(a), z))
    def idx(zi, ri, i):
        return zi * 2 * seg + ri * seg + i % seg
    for i in range(seg):
        faces.append((idx(0, 1, i), idx(0, 1, i + 1), idx(1, 1, i + 1), idx(1, 1, i)))  # ngoài
        faces.append((idx(0, 0, i + 1), idx(0, 0, i), idx(1, 0, i), idx(1, 0, i + 1)))  # trong
        faces.append((idx(1, 0, i), idx(1, 1, i), idx(1, 1, i + 1), idx(1, 0, i + 1)))  # trên
    b.raw(verts, faces, color)


# ---------------- Tượng Cuder ----------------
def cuder_pedestal(b, z_base=0.1, size=0.6, height=0.7):
    """Đế gạch + bệ vuông có viền xoáy mây ở mép trên."""
    b.box((0, 0, z_base / 2), (1.4, 1.4, z_base), "brick")
    top = z_base + height
    b.box((0, 0, z_base + height / 2), (size, size, height), "statue_white")
    # xoáy mây / sóng dọc mép trên: xen kẽ vòng xoáy nhỏ và cục mây
    h = size / 2
    for i in range(20):
        side, t = divmod(i, 5)
        u = -h + (t + 0.5) * size / 5
        pos = [(u, -h), (h, u), (-u, h), (-h, -u)][side]
        rot = [(90, 0, 0), (90, 0, 90), (90, 0, 0), (90, 0, 90)][side]
        zz = top - 0.04 + (0.02 if t % 2 else 0)
        if t % 2:
            b.torus((pos[0] * 1.04, pos[1] * 1.04, zz), 0.038, 0.016, "statue_white", seg=8, seg2=4, rot=rot)
        else:
            b.sphere((pos[0], pos[1], zz), 0.055, "statue_white", segments=8, rings=4, scale=(1, 1, 0.75))
    # gò mây xoáy dưới chân
    b.sphere((0, 0, top), size * 0.42, "statue_white", segments=12, rings=5, scale=(1, 1, 0.22))
    for i in range(8):
        a = 2 * math.pi * i / 8
        b.sphere((0.2 * math.cos(a), 0.2 * math.sin(a), top + 0.03), 0.07, "statue_white",
                 segments=8, rings=4, scale=(1, 1, 0.6))
    return top + 0.05


def cuder_figure(b, z):
    """Cậu bé đầu to, kính tròn to, cởi trần, quần đùi, hai tay chống cán thuổng. Cao ~1.6 m."""
    W = "statue_white"
    # chân ngắn kiểu hoạt hình
    for s in (-1, 1):
        b.cylinder((0.08 * s, -0.02, z), 0.065, 0.32, W, segments=8)
        b.sphere((0.08 * s, -0.07, z + 0.03), 0.07, W, segments=8, rings=4, scale=(0.9, 1.5, 0.5))
        b.cylinder((0.09 * s, -0.01, z + 0.27), 0.1, 0.07, W, segments=8)  # gấu quần xắn
    # quần đùi rộng + cạp quần bẹp
    b.cylinder((0, 0, z + 0.32), 0.2, 0.24, W, segments=10, radius_top=0.19)
    b.torus((0, 0, z + 0.57), 0.185, 0.035, W, seg=12, seg2=5, scale=(1, 0.85, 1))
    # thân trần
    b.sphere((0, 0, z + 0.74), 0.2, W, segments=14, rings=8, scale=(1, 0.82, 1.15))
    b.cylinder((0, 0, z + 0.9), 0.07, 0.08, W, segments=8)
    # đầu rất to + mái tóc
    hz = z + 1.22
    b.sphere((0, 0, hz), 0.29, W, segments=16, rings=10, scale=(1, 0.95, 0.98))
    b.sphere((0, 0.03, hz + 0.06), 0.295, W, segments=16, rings=8, scale=(1.02, 0.96, 0.86))
    # tai, mũi
    for s in (-1, 1):
        b.sphere((0.29 * s, 0.02, hz - 0.03), 0.07, W, segments=8, rings=5, scale=(0.5, 0.8, 1))
    b.sphere((0, -0.285, hz - 0.07), 0.045, W, segments=8, rings=5)
    # kính tròn RẤT to (điểm nhận diện) + quai kính
    gz = hz + 0.03
    for s in (-1, 1):
        b.torus((0.125 * s, -0.27, gz), 0.118, 0.032, W, seg=16, seg2=5, rot=(90, 0, 0))
        b.cylinder((0.125 * s, -0.25, gz), 0.09, 0.02, W, segments=14, rot=(90, 0, 0))
        b.sphere((0.125 * s, -0.275, gz), 0.03, W, segments=8, rings=4)  # con ngươi nổi
        b.tube((0.235 * s, -0.23, gz + 0.02), (0.285 * s, 0.05, gz + 0.04), 0.02, W, segments=4)
    b.tube((-0.025, -0.285, gz + 0.01), (0.025, -0.285, gz + 0.01), 0.02, W, segments=4)
    # miệng cười: cung tròn nằm trên mặt trước
    pts = []
    for i in range(7):
        a = math.radians(205 + i * 130 / 6)
        x, zz = 0.095 * math.cos(a), hz - 0.07 + 0.08 * math.sin(a)
        pts.append((x, -0.285 + 0.12 * abs(x), zz))
    for p0, p1 in zip(pts, pts[1:]):
        b.tube(p0, p1, 0.014, W, segments=4)
    # tay chống cán thuổng
    hand_z = z + 0.66
    for s in (-1, 1):
        sh = (0.19 * s, -0.01, z + 0.86)
        el = (0.24 * s, -0.13, z + 0.7)
        hd = (0.045 * s, -0.26, hand_z)
        b.sphere(sh, 0.06, W, segments=8, rings=5)
        b.tube(sh, el, 0.055, W, segments=8, radius_end=0.05)
        b.sphere(el, 0.05, W, segments=8, rings=5)
        b.tube(el, hd, 0.05, W, segments=8, radius_end=0.045)
        b.sphere(hd, 0.06, W, segments=8, rings=5)
    b.tube((0, -0.26, z - 0.03), (0, -0.26, hand_z - 0.02), 0.03, W, segments=8)


# ---------------- Biển chữ FPT SOFTWARE ----------------
SIGN_FONT = os.path.join(os.environ.get("WINDIR", ""), "Fonts", "ARLRDBD.TTF")   # Arial Rounded MT Bold — font chữ thường, không phải logo


def text_mesh(body, size=1.0, extrude=0.05, offset=0.0, font=SIGN_FONT, resolution=3):
    """Chữ 3D từ font → mesh tạm (người gọi tự xoá). Chữ nằm trên mặt XY, căn giữa."""
    cu = bpy.data.curves.new("TMP_text", "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.offset = offset
    cu.resolution_u = resolution
    cu.align_x = "CENTER"
    if os.path.exists(font):
        cu.font = bpy.data.fonts.load(font, check_existing=True)
    ob = bpy.data.objects.new("TMP_text", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return me


def fpt_sign(b, length=9.4, base_z=0.72):
    """Gò cỏ + thanh dầm đen + chữ 'FPT SOFTWARE' nổi 3D: viền trắng dày, mặt chữ xám nhạt (như ảnh thật).
    Mặt chữ nhìn về -Y."""
    b.sphere((0, 0.8, -0.6), 1.0, "grass", segments=16, rings=7, scale=(length * 0.64, 2.6, 1.7))
    b.box((0, 0.05, base_z - 0.14), (length + 0.3, 0.42, 0.26), "lamp_black")
    res = 4 if Q.HIGH else 2
    outer = text_mesh("FPT SOFTWARE", extrude=0.07, offset=0.035, resolution=res)
    inner = text_mesh("FPT SOFTWARE", extrude=0.0, resolution=res)  # mặt phẳng, chỉ thấy từ phía trước
    xs = [v.co.x for v in outer.vertices]
    ys = [v.co.y for v in outer.vertices]
    s = length / (max(xs) - min(xs))
    lift = base_z - min(ys) * s
    stand = Matrix.Rotation(math.radians(90), 4, "X")          # XY → XZ, mặt chữ nhìn -Y
    m_outer = Matrix.Translation((0, 0, lift)) @ stand @ Matrix.Scale(s, 4)
    m_inner = Matrix.Translation((0, -0.075 * s - 0.004, lift)) @ stand @ Matrix.Scale(s, 4)
    b.add_mesh(outer, "sign_white", matrix=m_outer)
    b.add_mesh(inner, "sign_inner", matrix=m_inner)
    bpy.data.meshes.remove(outer)
    bpy.data.meshes.remove(inner)


# ---------------- Xe bus (kiểu b: trắng trên, đỏ dưới, sọc vàng) ----------------
# Xe trong game là mô hình Sketchfab (lib/bus.py). bus() / bus_door() khối dưới đây giữ lại để tham khảo (không zone nào
# gọi). BUS_L, BUS_W: kích thước tham chiếu cũ — chỗ cửa, SPAWN_, NPC_, TRIGGER_ quanh xe tính theo đây, giữ nguyên;
# khung va chạm / kiểm tra đường chạy dùng kích thước thật của mô hình (bus.body_box()).
BUS_L, BUS_W, BUS_H = 12.0, 2.5, 3.5
BUS_DOOR_X = BUS_L / 2 - 1.325   # tâm cửa khách (local x của xe) — lib/bus.py đặt cửa vẽ trên mô hình trùng chỗ này


def bus(b, door_open=True):
    """Xe khách 45 chỗ. Gốc = tâm gầm xe trên mặt đất; đầu xe hướng +X, cửa khách bên phải (-Y)."""
    L, W, H = BUS_L, BUS_W, BUS_H
    hx, hy = L / 2, W / 2
    z0 = 0.4
    # thân dưới đỏ + thân trên trắng
    b.box((0, 0, z0 + 0.45), (L, W, 0.9), "bus_red")
    b.box((0, 0, z0 + 0.9 + (H - z0 - 0.9) / 2), (L, W, H - z0 - 0.9), "bus_white")
    # dải cửa sổ hai bên (kính tối, viền đen)
    for s in (-1, 1):
        y = s * (hy + 0.01)
        x_from = -hx + 0.5
        x_to = hx - (2.1 if s < 0 else 0.6)  # bên phải chừa chỗ cửa trước
        b.box(((x_from + x_to) / 2, y, 2.55), (x_to - x_from, 0.04, 1.15), "glass_dark", mat="gloss")
        for x in [x_from + i * 1.6 for i in range(1, int((x_to - x_from) / 1.6) + 1)]:
            b.box((x, y + s * 0.01, 2.55), (0.07, 0.04, 1.15), "black")
        # sọc vàng xéo (kiểu "swoosh")
        b.box((-1.2, y + s * 0.015, 1.55), (6.0, 0.02, 0.16), "curb_yellow", rot=(0, -4, 0))
        b.box((1.6, y + s * 0.015, 1.36), (2.0, 0.02, 0.12), "curb_yellow", rot=(0, -9, 0))
        # mảng thay logo (placeholder)
        for i, c in enumerate(("fpt_blue", "fpt_orange", "fpt_green")):
            b.box((-4.4 + i * 0.36, y + s * 0.02, 1.75), (0.3, 0.02, 0.3), c)
    # kính lái + kính sau
    b.box((hx + 0.01, 0, 2.3), (0.04, W - 0.25, 1.75), "glass_dark", mat="gloss")
    b.box((-hx - 0.01, 0, 2.6), (0.04, W - 0.4, 0.9), "glass_dark", mat="gloss")
    # cửa khách phía trước bên phải (-Y): mở = hõm tối + cánh cửa xoay ra
    dx0, dx1 = hx - 1.9, hx - 0.75
    b.box(((dx0 + dx1) / 2, -hy - 0.005, 1.75), (dx1 - dx0, 0.03, 2.5), "black")
    if door_open:  # cánh cửa mở gập về phía đầu xe, gần song song thân xe
        b.box((dx1 + 0.5, -hy - 0.22, 1.85), (1.05, 0.05, 2.3), "glass_dark", rot=(0, 0, -18), mat="gloss")
        b.box((dx1 + 0.5, -hy - 0.25, 1.85), (1.1, 0.06, 0.08), "black", rot=(0, 0, -18))
    for i in range(2):  # bậc lên xuống
        b.box(((dx0 + dx1) / 2, -hy + 0.15 + i * 0.15, 0.25 + i * 0.2), (dx1 - dx0, 0.3, 0.06), "lamp_black")
    # đèn
    for s in (-1, 1):
        b.box((hx + 0.02, s * (hy - 0.3), 0.85), (0.05, 0.45, 0.22), "lamp_white", mat="light")
        b.box((-hx - 0.02, s * (hy - 0.25), 0.95), (0.05, 0.25, 0.5), "bus_red", mat="gloss")
    # gương chiếu hậu "tai thỏ"
    for s in (-1, 1):
        b.tube((hx - 0.1, s * (hy - 0.1), 3.2), (hx + 0.55, s * (hy + 0.05), 3.0), 0.05, "black", segments=5)
        b.box((hx + 0.6, s * (hy + 0.05), 2.6), (0.12, 0.08, 0.5), "black", mat="gloss")
    # điều hoà trên nóc
    b.box((-1.0, 0, H + 0.12), (3.5, 1.4, 0.25), "bus_white")
    # bánh xe
    # (trụ xoay rot=(90,0,0) kéo dài theo -Y từ điểm đáy)
    for x in (hx - 2.0, -hx + 2.6):
        for s in (-1, 1):
            y_out = s * (hy + 0.02)                 # mặt ngoài lốp nhô nhẹ khỏi thân
            base = y_out if s > 0 else y_out + 0.32
            b.cylinder((x, base, 0.5), 0.5, 0.32, "lamp_black", segments=12, rot=(90, 0, 0))
            hub = y_out + 0.02 if s > 0 else y_out
            b.cylinder((x, hub, 0.5), 0.28, 0.02, "concrete_grey", segments=10, rot=(90, 0, 0))
            b.box((x, s * (hy + 0.01), 1.07), (1.3, 0.06, 0.12), "black")  # vòm bánh


# Cánh cửa khách tách riêng (game đóng/mở bằng code): gốc object = bản lề ở mép trước ô cửa, sát thân xe.
BUS_DOOR_OPEN_DEG = 162.0   # xoay quanh Z: 0 = đóng (che ô cửa), 162 = mở gập ra ngoài về phía đầu xe


def bus_door_hinge():
    """Vị trí bản lề (toạ độ local của xe bus)."""
    return (BUS_L / 2 - 0.75, -BUS_W / 2 - 0.06, 0.0)


def bus_door(b):
    """Cánh cửa kính khung đen, toạ độ tính từ bản lề; lúc đóng nằm dọc -X che kín ô cửa của bus(door_open=False)."""
    b.box((-0.56, 0.0, 1.85), (1.12, 0.05, 2.3), "glass_dark", mat="gloss")
    b.box((-0.58, -0.03, 1.85), (1.16, 0.06, 0.08), "black")


def _digit(b, text, center, face, height):
    """Chữ số phẳng màu hổ phách (bảng LED), mặt chữ nhìn theo face = (1, 0) hoặc (0, -1)."""
    me = text_mesh(text, extrude=0.0, resolution=2)
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    s = height / (max(ys) - min(ys))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    if face == (1, 0):     # chữ: X → +Y, Y → +Z, pháp tuyến → +X
        rot = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    else:                  # nhìn -Y: X → +X, Y → +Z
        rot = Matrix.Rotation(math.radians(90), 4, "X")
    m = Matrix.Translation(center) @ rot @ Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, 0))
    b.add_mesh(me, "led_amber", mat="light", matrix=m)
    bpy.data.meshes.remove(me)


def route_signs(b, number, front, side):
    """Biển số tuyến: bảng LED đen, chữ số hổ phách — trên kính lái (nhìn +X) và trên cửa khách (nhìn -Y).
    Toạ độ local của xe; chỉ là con số, không chữ thương hiệu. front = (x, z, nghiêng °) ngay trước kính lái (bảng ngả
    về sau theo kính), side = (x, y, z) mặt hông trên cửa — lib/bus.py đo trên mô hình."""
    text = str(number)
    fx, fz, tilt = front
    b.box((fx, 0, fz), (0.03, 0.95, 0.42), "black", rot=(0, -tilt, 0))
    me = text_mesh(text, extrude=0.0, resolution=2)
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    s = 0.3 / (max(ys) - min(ys))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    face_x = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # chữ: X → +Y, Y → +Z, pháp tuyến → +X
    m = (Matrix.Translation((fx, 0, fz)) @ Matrix.Rotation(math.radians(-tilt), 4, "Y") @ Matrix.Translation((0.017, 0, 0))
         @ face_x @ Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, 0)))
    b.add_mesh(me, "led_amber", mat="light", matrix=m)
    bpy.data.meshes.remove(me)
    sx, sy, sz = side
    b.box((sx, sy, sz), (0.8, 0.03, 0.34), "black")
    _digit(b, text, (sx, sy - 0.017, sz), (0, -1), 0.24)


def route_map_board(b, width=9.0, height=3.2):
    """Tường bản đồ tuyến xe buýt: nền trắng, băng tiêu đề xanh lá, các tuyến = vạch/chấm màu (placeholder)."""
    b.box((0, 0, 0.3 + height / 2), (width, 0.1, height), "sign_white")
    b.box((0, -0.06, 0.3 + height - 0.25), (width, 0.02, 0.4), "fpt_green")
    b.box((0, -0.06, 0.15), (width, 0.02, 0.3), "fpt_green")
    rng_cols = ["shelf_red", "fpt_blue", "fpt_green", "curb_yellow", "fpt_orange"]
    lines = [(-3.6, 2.4, -1.0, 1.4), (-1.0, 1.4, 1.8, 2.3), (-2.0, 0.9, 0.5, 1.9), (0.5, 1.9, 2.6, 1.2), (-3.0, 1.1, -1.6, 2.5)]
    for i, (x0, z0, x1, z1) in enumerate(lines):
        b.tube((x0, -0.07, z0 + 0.3), (x1, -0.07, z1 + 0.3), 0.025, "lamp_black", segments=4)
        for x, z in ((x0, z0), (x1, z1)):
            b.cylinder((x, -0.06, z + 0.3), 0.13, 0.03, rng_cols[i % 5], segments=10, rot=(90, 0, 0))
    b.box((-3.3, -0.07, 1.0), (1.4, 0.03, 0.8), "leaf")  # ảnh F-Ville (mảng xanh)
    for k in range(6):  # bảng thông tin bên phải
        b.box((3.4, -0.07, 0.8 + k * 0.35), (1.6, 0.02, 0.22), "concrete_grey")


def queue_stanchions(b, x0, x1, y, n=4):
    """Cột chắn inox + dây xanh xếp hàng."""
    xs = [x0 + (x1 - x0) * i / (n - 1) for i in range(n)]
    for x in xs:
        b.cylinder((x, y, 0), 0.16, 0.04, "concrete_grey", segments=8)
        b.cylinder((x, y, 0), 0.035, 0.95, "concrete_grey", segments=6, mat="gloss")
    for xa, xb in zip(xs, xs[1:]):
        b.box(((xa + xb) / 2, y, 0.88), (xb - xa, 0.02, 0.06), "fpt_blue")


def pergola(b, x0, y0, x1, y1, rng, height=2.7):
    """Giàn leo phủ cây (chỗ ngồi chờ xe) + ghế dài."""
    for x in (x0, x1):
        for y in (y0, y1):
            b.box((x, y, height / 2), (0.15, 0.15, height), "lamp_black")
    for t in range(int((x1 - x0) / 0.6) + 1):
        x = x0 + t * 0.6
        b.box((x, (y0 + y1) / 2, height), (0.06, y1 - y0 + 0.3, 0.06), "lamp_black")
    for _ in range(int((x1 - x0) * 2.5)):
        b.ico((rng.uniform(x0, x1), rng.uniform(y0, y1), height + 0.15), rng.uniform(0.5, 0.8),
              rng.choice(["leaf", "leaf_light", "leaf_dark"]), subdiv=1, scale=(1, 1, 0.45))
    for y in (y0 + 0.4, y1 - 0.4):
        b.box(((x0 + x1) / 2, y, 0.45), (x1 - x0 - 0.6, 0.45, 0.06), "wood_light")
        for x in (x0 + 0.5, x1 - 0.5):
            b.box((x, y, 0.22), (0.08, 0.4, 0.44), "lamp_black")


# ---------------- Canteen pilotis (lối đi xuyên qua) ----------------
def pavilion(b, x0, y0, x1, y1, passage_x0, passage_x1, rng, height=4.0, veg=None):
    """Mái bằng trên cột tròn xanh nhạt, mái phủ cây; 2 phòng kính hai bên lối đi.
    veg: builder cây cối riêng (bụi trên mái được tô bóng mềm); mặc định dùng chung b."""
    kit.slab_rect(b, x0, y0, x1, y1, height, height + 0.45, "concrete_white")
    kit.slab_rect(b, x0 + 0.4, y0 + 0.4, x1 - 0.4, y1 - 0.4, height + 0.45, height + 0.7, "grass_dark")
    kit.roof_garden(veg or b, x0, y0, x1, y1, height + 0.7, rng, density=0.04)
    xs = [x0 + 1.5 + i * 6 for i in range(int((x1 - x0 - 3) // 6) + 1)]
    for x in xs:
        for y in (y0 + 1.5, y1 - 1.5):
            kit.round_column(b, x, y, 0, height, r=0.22)
    for gx0, gx1 in ((x0 + 0.5, passage_x0 - 0.5), (passage_x1 + 0.5, x1 - 0.5)):
        if gx1 - gx0 < 1:
            continue
        for (ax, ay), (bx2, by) in (((gx0, y0 + 2.5), (gx1, y0 + 2.5)), ((gx1, y0 + 2.5), (gx1, y1 - 2.5)),
                                    ((gx1, y1 - 2.5), (gx0, y1 - 2.5)), ((gx0, y1 - 2.5), (gx0, y0 + 2.5))):
            kit.seg_box(b, (ax, ay), (bx2, by), 0.04, 0.1, height, "glass", mat="glass")
        # bàn ghế bên trong cho có cảm giác canteen
        for _ in range(int((gx1 - gx0) // 3)):
            tx, ty = rng.uniform(gx0 + 1, gx1 - 1), rng.uniform(y0 + 3.5, y1 - 3.5)
            b.box((tx, ty, 0.75), (1.2, 0.8, 0.06), "sign_white")
            b.cylinder((tx, ty, 0.08), 0.05, 0.67, "lamp_black", segments=5)
