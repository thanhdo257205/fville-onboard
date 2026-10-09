"""Bộ module (modular kit) dùng chung cho mọi zone.

Mỗi hàm THÊM hình khối vào một MeshBuilder `b` (toạ độ local), không tự tạo object.
Như vậy nhiều module có thể gộp chung một object để giảm draw call.
"""
import math

from mathutils import Vector

from . import quality as Q

# Kích thước chuẩn (m)
FLOOR_H = 3.6       # chiều cao tầng
GROUND_H = 4.2      # tầng trệt (pilotis)
SLAB_T = 0.35       # dày sàn
BAY = 1.6           # module mặt tiền: lam 0.75 + kính 0.85
FIN_W = 0.75
DOOR_H = 2.4
MIN_PASSAGE = 2.5   # hành lang / cửa tối thiểu cho camera


# ---------------- tiện ích ----------------
def seg_box(b, p0, p1, width, z0, z1, color, mat="palette"):
    """Hộp chạy dọc đoạn thẳng p0→p1 (2D), rộng `width`, từ z0 đến z1."""
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    d = p1 - p0
    yaw = math.degrees(math.atan2(d.y, d.x))
    c = (p0 + p1) / 2
    b.box((c.x, c.y, (z0 + z1) / 2), (d.length, width, z1 - z0), color, rot=(0, 0, yaw), mat=mat)


# ---------------- mặt đất ----------------
def slab_rect(b, x0, y0, x1, y1, z0, z1, color, top=None, mat="palette"):
    b.prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, color, top_color=top, mat=mat)


def paving(b, x0, y0, x1, y1, z, colors, cell=1.2, thickness=0.08):
    """Nền lát gạch nổi `thickness`: mặt trên chia ô xen màu, cạnh bên một màu."""
    b.grid(x0, y0, x1, y1, z, cell, colors)
    slab_rect_sides(b, x0, y0, x1, y1, z - thickness, z, colors[0])


def brick_paving(b, x0, y0, x1, y1, z, cell=1.6, thickness=0.08):
    """Nền gạch đan rổ dùng texture (chất liệu brick_tex). Lưới `cell` chỉ để AO mịn hơn."""
    b.grid(x0, y0, x1, y1, z, cell, ["tex_white"], mat="brick_tex")
    slab_rect_sides(b, x0, y0, x1, y1, z - thickness, z, "brick_dark")


def slab_rect_sides(b, x0, y0, x1, y1, z0, z1, color):
    pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    for i in range(4):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % 4]
        b.quad([(ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1)], color)


def curb_line(b, p0, p1, width=0.25, height=0.18, seg=1.0, colors=("curb_yellow", "curb_grey"), z=0.0):
    """Viền vỉa sơn xen kẽ vàng–xám: một dải liền, tiết diện có vát cạnh trên (rẻ hơn nhiều so với hộp bo)."""
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    d = p1 - p0
    n = max(1, round(d.length / seg))
    t = d.normalized()
    nx = Vector((-t.y, t.x, 0)) * (width / 2)
    ch = min(0.04, width / 4)
    prof = [(-1, 0.0), (-1, height - ch), (-1 + 2 * ch / width, height), (1 - 2 * ch / width, height), (1, height - ch), (1, 0.0)]
    for i in range(n):
        a = p0.lerp(p1, i / n)
        c = p0.lerp(p1, (i + 1) / n)
        ring_a = [a + nx * s + Vector((0, 0, z + h)) for s, h in prof]
        ring_c = [c + nx * s + Vector((0, 0, z + h)) for s, h in prof]
        # thứ tự đỉnh ngược chiều kim đồng hồ nhìn từ ngoài (glTF chỉ hiện mặt trước)
        quads = [(ring_a[k + 1], ring_a[k], ring_c[k], ring_c[k + 1]) for k in range(len(prof) - 1)]
        for q in quads:
            b.quad([tuple(v) for v in q], colors[i % len(colors)])
    for end, flip in ((p0, False), (p1, True)):  # bịt 2 đầu
        pts = [end + nx * s + Vector((0, 0, z + h)) for s, h in prof]
        b.quad([tuple(v) for v in (list(reversed(pts)) if flip else pts)], colors[0])


def planter_wall(b, p0, p1, width=0.25, height=0.45, z=0.0):
    seg_box(b, p0, p1, width, z, z + height, "concrete_grey")


# ---------------- cây cối ----------------
# Cây/bụi nên dựng trong MeshBuilder riêng rồi to_object(..., smooth_angle=80, tint="foliage")
# để tán tròn mềm và sáng dần lên trên (kiểu hoạt hình).
LEAVES = ("leaf", "leaf_light", "leaf_dark", "leaf_yellow")


def tree(b, x, y, rng, height=None, z=0.0, detail=2, white_base=True):
    """Cây tán tròn nhiều cụm. detail=2: cây gần (4 cụm), 1: cây xa (2 cụm).
    Thân quét vôi trắng phần gốc như cây trong khuôn viên F-Ville."""
    detail = Q.detail(detail)
    h = height or rng.uniform(6.0, 8.5)
    trunk_h = h * 0.48
    lean = (rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25))
    top = (x + lean[0], y + lean[1], z + trunk_h)
    wb = 0.9 if white_base else 0.0
    if wb:
        b.cylinder((x, y, z), 0.19, wb, "trunk_white", segments=7, radius_top=0.16)
    b.tube((x, y, z + wb), top, 0.16, "trunk", segments=7, radius_end=0.1)
    r = h * 0.26
    lobes = [(0.0, 0.0, 0.62, 1.0)]
    k = {1: 1, 2: 2}.get(detail, 4)  # detail 3 (bản cao, cây gần): 5 cụm lá
    a0 = rng.uniform(0, 2 * math.pi)
    for i in range(k):
        a = a0 + 2 * math.pi * i / k + rng.uniform(-0.4, 0.4)
        lobes.append((math.cos(a) * r * 0.7, math.sin(a) * r * 0.7, rng.uniform(0.15, 0.45), rng.uniform(0.62, 0.78)))
    main = rng.choice(LEAVES[:3])
    for i, (dx, dy, dz, s) in enumerate(lobes):
        c = (top[0] + dx, top[1] + dy, top[2] + r * dz)
        if i and detail >= 2:  # cành nối thân → cụm lá
            b.tube(top, (c[0], c[1], c[2] - r * s * 0.5), 0.06, "trunk", segments=5, radius_end=0.04)
        col = main if i == 0 else rng.choice(LEAVES)
        b.ico(c, r * s, col, subdiv=2, scale=(1, 1, rng.uniform(0.78, 0.9)), rot=(0, 0, rng.uniform(0, 90)))


def bush(b, x, y, r, rng, z=0.0, color=None, flowers=False, lobes=2):
    """Bụi tròn 1–2 cụm, có thể điểm hoa."""
    col = color or rng.choice(["leaf", "leaf_dark", "leaf_light"])
    b.sphere((x, y, z + r * 0.45), r, col, segments=8, rings=5, scale=(1, 1, 0.75), rot=(0, 0, rng.uniform(0, 90)))
    if r > 0.55 and lobes > 1:
        a = rng.uniform(0, 2 * math.pi)
        b.sphere((x + r * 0.6 * math.cos(a), y + r * 0.6 * math.sin(a), z + r * 0.35), r * 0.7, col,
                 segments=8, rings=5, scale=(1, 1, 0.75))
    if flowers:
        for _ in range(4):
            a, rr = rng.uniform(0, 2 * math.pi), rng.uniform(0.2, 0.75) * r
            b.sphere((x + rr * math.cos(a), y + rr * math.sin(a), z + r * 0.75), 0.06,
                     rng.choice(["flower_pink", "flower_white", "curb_yellow"]), segments=4, rings=3)


def hedge(b, p0, p1, width=0.6, height=0.6, z=0.0, color="leaf_dark", rng=None):
    """Hàng rào cây bụi: tiết diện bo tròn phần trên + vài u lá nhô lên cho tự nhiên."""
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    d = p1 - p0
    L = d.length
    t = d.normalized()
    nx = Vector((-t.y, t.x, 0))
    w, h = width / 2, height
    prof = [(-w, 0), (-w, h * 0.62), (-w * 0.72, h * 0.9), (0, h), (w * 0.72, h * 0.9), (w, h * 0.62), (w, 0)]
    ra = [p0 + nx * u + Vector((0, 0, z + v)) for u, v in prof]
    rb = [p1 + nx * u + Vector((0, 0, z + v)) for u, v in prof]
    for k in range(len(prof) - 1):
        b.quad([tuple(ra[k + 1]), tuple(ra[k]), tuple(rb[k]), tuple(rb[k + 1])], color)
    b.raw([tuple(v) for v in ra], [tuple(range(len(prof)))], color)
    b.raw([tuple(v) for v in rb], [tuple(reversed(range(len(prof))))], color)
    if rng:
        for i in range(int(L / (1.3 if Q.HIGH else 2.6))):
            c = p0 + t * rng.uniform(0.4, L - 0.4) + nx * rng.uniform(-w * 0.4, w * 0.4)
            b.sphere((c.x, c.y, z + h * 0.88), rng.uniform(0.25, 0.4) * width / 0.8, color,
                     segments=6, rings=4, scale=(1.3, 1, 0.55), rot=(0, 0, math.degrees(math.atan2(t.y, t.x))))


def bamboo_clump(b, x, y, rng, n=12, height=5.0, z=0.0):
    """Khóm tre: thân cong nhẹ toả ra (gốc xanh đậm, ngọn vàng), lá nhỏ dài rủ thành chùm."""
    for _ in range(Q.n(n, 1.5)):
        a = rng.uniform(0, 2 * math.pi)
        r0 = rng.uniform(0.03, 0.3)
        lean = rng.uniform(0.4, 1.3)
        h = height * rng.uniform(0.75, 1.1)
        base = Vector((x + r0 * math.cos(a), y + r0 * math.sin(a), z))
        out = Vector((math.cos(a), math.sin(a), 0))
        mid = base + out * lean * 0.25 + Vector((0, 0, h * 0.55))
        top = base + out * lean + Vector((0, 0, h))
        b.tube(tuple(base), tuple(mid), 0.04, "bamboo_dark", segments=5, radius_end=0.033)
        b.tube(tuple(mid), tuple(top), 0.033, "bamboo", segments=5, radius_end=0.018)
        for k in range(3):  # đốt tre
            p = base.lerp(mid, (k + 1) / 4)
            b.cylinder(tuple(p), 0.046, 0.03, "bamboo_dark", segments=5)
        for s in range(5):  # chùm lá dọc nửa trên
            p = mid.lerp(top, 0.15 + s * 0.2)
            for _ in range(Q.n(3, 2.0)):
                yaw = rng.uniform(0, 360)
                L = rng.uniform(0.22, 0.32)
                yr = math.radians(yaw)
                c = (p.x + math.cos(yr) * L * 0.5, p.y + math.sin(yr) * L * 0.5, p.z - 0.05)
                b.sphere(c, L / 2, rng.choice(["bamboo_leaf", "leaf_light", "leaf"]), segments=4, rings=2,
                         scale=(1, 0.16, 0.06), rot=(0, rng.uniform(15, 40), yaw))


def grass_tufts(b, region, n, rng, z=0.0):
    """Khóm cỏ nhỏ 3 lá (rải mép lối đi, quanh gốc cây)."""
    x0, x1, y0, y1 = region
    for _ in range(Q.n(n, 4.0)):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        for k in range(3):
            a = rng.uniform(0, 2 * math.pi)
            b.tube((x, y, z), (x + 0.08 * math.cos(a), y + 0.08 * math.sin(a), z + rng.uniform(0.18, 0.3)),
                   0.035, rng.choice(["grass_dark", "leaf_light"]), segments=3, radius_end=0.0)


# ---------------- đồ ngoài trời ----------------
def lamp_post(b, x, y, z=0.0, height=3.8):
    """Cột đèn gang đen 3 bóng tròn kiểu cổ điển (ven đường F-Ville, LoiDi t_0004)."""
    K = "lamp_black"
    b.cylinder((x, y, z), 0.2, 0.12, K, segments=8)                          # đế
    b.cylinder((x, y, z + 0.12), 0.16, 0.45, K, segments=8, radius_top=0.13)  # thân đế bát giác
    b.cylinder((x, y, z + 0.57), 0.17, 0.06, K, segments=8)                   # gờ
    b.sphere((x, y, z + 0.78), 0.14, K, segments=6, rings=4, scale=(1, 1, 1.4))  # bầu hoa văn
    b.cylinder((x, y, z + 1.03), 0.065, height - 1.4, K, segments=6, radius_top=0.05)
    for k in range(3):
        a = math.radians(90 + 120 * k)
        ex, ey = x + 0.32 * math.cos(a), y + 0.32 * math.sin(a)
        b.tube((x, y, z + height - 0.38), (ex, ey, z + height - 0.3), 0.022, K, segments=4)
        b.sphere((ex, ey, z + height - 0.12), 0.16, "lamp_white", segments=7, rings=4, mat="light")
    b.sphere((x, y, z + height + 0.08), 0.17, "lamp_white", segments=7, rings=4, mat="light")


def stairs(b, x0, y0, width, n, rise, run, color="stone_black", direction=1, z0=0.0):
    """Bậc thang đi lên theo trục +Y (direction=1) hoặc -Y (-1), bậc đầu bắt đầu ở y0."""
    for i in range(n):
        ya = y0 + direction * i * run
        yb = y0 + direction * (n) * run
        lo, hi = sorted((ya, yb))
        b.box_minmax((x0, lo, z0), (x0 + width, hi, z0 + (i + 1) * rise), color, mat="gloss")


def round_column(b, x, y, z0, z1, r=0.2, color="column_green", segments=10):
    b.cylinder((x, y, z0), r, z1 - z0, color, segments=segments)


# ---------------- tòa nhà ----------------
def facade_side(b, p0, p1, z0, floors, outward, style="louver"):
    """Mặt tiền các tầng trên.
    louver: lam gạch đỏ dọc (texture đục lỗ hạt lúa) xen ô kính có khung đen + bậu cửa.
    glass : vách kính xám, đố đứng đen mỗi 1.6 m + đố ngang giữa tầng."""
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    d = p1 - p0
    L = d.length
    t = d.normalized()
    n = Vector((*outward, 0)).normalized()
    nb = max(1, round(L / BAY))
    for f in range(floors):
        zf = z0 + f * FLOOR_H
        zt = zf + FLOOR_H - SLAB_T
        for i in range(nb):
            c = p0 + t * ((i + 0.5) * L / nb)
            if style == "louver":
                fc = c - n * 0.15  # lam nằm giữa mép sàn và mặt kính
                seg_box(b, fc - t * FIN_W / 2, fc + t * FIN_W / 2, 0.25, zf, zt, "tex_white", mat="louver_tex")
                g = p0 + t * ((i + 1) * L / nb) - n * 0.27  # khe kính giữa 2 lam: khung + bậu
                b.box((g.x, g.y, zf + 1.0), (0.06 + abs(t.x) * 0.8, 0.06 + abs(t.y) * 0.8, 0.06), "black")
                b.box((g.x, g.y, (zf + zt) / 2), (0.05 + abs(n.x) * 0.02, 0.05 + abs(n.y) * 0.02, zt - zf), "black")
            else:
                m = c - t * (L / nb / 2) - n * 0.29
                b.box((m.x, m.y, (zf + zt) / 2), (0.08 + abs(n.x) * 0.04, 0.08 + abs(n.y) * 0.04, zt - zf), "black")
        if style == "glass":
            a = p0 - n * 0.29
            e = p1 - n * 0.29
            seg_box(b, (a.x, a.y), (e.x, e.y), 0.06, zf + 1.05, zf + 1.13, "black")


def building_block(b, x0, y0, x1, y1, floors=3, facades=("S", "N", "E", "W"), pilotis=True,
                   ground_inset=2.0, col_step=3.6, col_skip=None, legs="columns", style="louver", roof_rng=None):
    """Khối nhà F-Ville: tầng trệt lùi vào, các tầng trên lam gạch (hoặc kính xám), mái cây xanh.

    facades: các mặt có lam/khung (bỏ mặt khuất để tiết kiệm tam giác).
    col_skip: (xa, xb, ya, yb) — bỏ cột trong vùng này (vd trước tường bản đồ, lối vào).
    legs: "columns" (cột vuông trắng) | "v" (chân chữ V trắng — khối có logo FPT).
    style: "louver" | "glass".  roof_rng: có thì đặt vài khối kỹ thuật trắng trên mái.
    """
    top = GROUND_H + floors * FLOOR_H
    # lõi kính các tầng trên
    slab_rect(b, x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, GROUND_H, top,
              "glass_facade" if style == "louver" else "glass_grey", mat="gloss")
    # lõi tầng trệt (lùi vào)
    gi = (ground_inset + (1.5 if legs == "v" else 0)) if pilotis else 0.3
    slab_rect(b, x0 + gi, y0 + gi, x1 - gi, y1 - gi, 0, GROUND_H, "glass_dark", mat="gloss")
    # dải sàn trắng + rãnh bóng dưới mép sàn
    for f in range(floors + 1):
        z = GROUND_H + f * FLOOR_H
        slab_rect(b, x0, y0, x1, y1, z - SLAB_T, z, "concrete_white")
        slab_rect(b, x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, z - SLAB_T - 0.06, z - SLAB_T, "concrete_grey")
    # lan can mái + mái cây
    for (ax, ay), (bx, by) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                               ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        seg_box(b, (ax, ay), (bx, by), 0.3, top, top + 0.7, "concrete_white")
    slab_rect(b, x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, top, top + 0.45, "grass_dark")
    if roof_rng:  # khối kỹ thuật / buồng thang trắng trên mái
        for _ in range(max(1, int((x1 - x0) * (y1 - y0) / 220))):
            w, dd, hh = roof_rng.uniform(2, 5), roof_rng.uniform(2, 4), roof_rng.uniform(1.2, 2.6)
            cx, cy = roof_rng.uniform(x0 + w, x1 - w), roof_rng.uniform(y0 + dd, y1 - dd)
            b.box((cx, cy, top + 0.45 + hh / 2), (w, dd, hh), "concrete_white")
    # chân tầng trệt
    if pilotis and legs == "columns":
        for x, y in _perimeter_points(x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6, col_step):
            if col_skip and col_skip[0] <= x <= col_skip[1] and col_skip[2] <= y <= col_skip[3]:
                continue
            b.box((x, y, GROUND_H / 2), (0.5, 0.5, GROUND_H), "concrete_white")
    elif pilotis and legs == "v":
        zt = GROUND_H - SLAB_T
        for (ax, ay), (bx, by) in (((x0, y0), (x1, y0)), ((x1, y1), (x0, y1)), ((x1, y0), (x1, y1)), ((x0, y1), (x0, y0))):
            L = math.hypot(bx - ax, by - ay)
            tx, ty = (bx - ax) / L, (by - ay) / L
            inx, iny = -ty, tx  # hướng vào trong khối
            n = max(1, round(L / 6.0))
            for i in range(n):
                s = (i + 0.5) * L / n
                fx, fy = ax + tx * s + inx * 1.0, ay + ty * s + iny * 1.0
                for k in (-1, 1):
                    b.tube((fx, fy, 0), (fx + tx * k * 1.6, fy + ty * k * 1.6, zt), 0.17, "concrete_white", segments=6)
                b.cylinder((fx, fy, 0), 0.3, 0.12, "concrete_white", segments=6)
    sides = {
        "S": ((x0, y0), (x1, y0), (0, -1)),
        "N": ((x1, y1), (x0, y1), (0, 1)),
        "E": ((x1, y0), (x1, y1), (1, 0)),
        "W": ((x0, y1), (x0, y0), (-1, 0)),
    }
    for s in facades:
        p0, p1, out = sides[s]
        facade_side(b, p0, p1, GROUND_H, floors, out, style=style)
    return top


def logo_placeholder(b, x, y, z, face=(0, -1), size=1.6):
    """Mảng màu thay logo FPT (3 ô xanh dương – cam – xanh lá, nghiêng nhẹ) + vạch xám thay chữ 'Software'."""
    fx, fy = face
    tx, ty = -fy, fx  # hướng ngang trên mặt tường
    for i, c in enumerate(("fpt_blue", "fpt_orange", "fpt_green")):
        o = (i - 1) * size * 1.12
        b.box((x + tx * o + fx * 0.06, y + ty * o + fy * 0.06, z + (0.12 if i == 1 else 0)),
              (size if fx == 0 else 0.1, size if fy == 0 else 0.1, size), c, rot=(0, 6 if fy else 0, 0))
    o = size * 2.6
    b.box((x + tx * o + fx * 0.06, y + ty * o + fy * 0.06, z - size * 0.3),
          (size * 1.6 if fx == 0 else 0.08, size * 1.6 if fy == 0 else 0.08, size * 0.32), "concrete_grey")


def _perimeter_points(x0, y0, x1, y1, step):
    pts = []
    for (ax, ay), (bx, by) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                               ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        L = math.hypot(bx - ax, by - ay)
        n = max(1, round(L / step))
        for i in range(n):
            pts.append((ax + (bx - ax) * i / n, ay + (by - ay) * i / n))
    return pts


def roof_garden(b, x0, y0, x1, y1, z, rng, density=0.04):
    """Bụi cây trên mái (mái phủ xanh của F-Ville). Nên dựng vào builder cây cối (tint foliage)."""
    n = Q.n(int((x1 - x0) * (y1 - y0) * density))
    for _ in range(n):
        bush(b, rng.uniform(x0 + 1, x1 - 1), rng.uniform(y0 + 1, y1 - 1), rng.uniform(0.5, 1.0), rng, z=z,
             lobes=2 if Q.HIGH else 1, flowers=Q.HIGH and rng.random() < 0.2)
