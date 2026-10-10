"""Module nội thất dùng chung (sảnh, hành lang, văn phòng).

Quy ước như kit.py: hàm thêm hình khối vào MeshBuilder `b`, toạ độ local.
"""
import math

from . import kit

CEIL_LOBBY = 4.2
CEIL_OFFICE = 3.0


# ---------------- vỏ phòng ----------------
def wall(b, p0, p1, z0=0.0, z1=CEIL_LOBBY, t=0.2, color="concrete_white", openings=()):
    """Tường thẳng p0→p1, chừa các ô cửa openings = [(từ_m, đến_m, cao_m)] tính dọc tường từ p0."""
    (ax, ay), (bx, by) = p0, p1
    L = math.hypot(bx - ax, by - ay)
    ux, uy = (bx - ax) / L, (by - ay) / L
    cuts = sorted(openings)
    pos = 0.0
    for s, e, h in cuts:
        if s > pos:
            kit.seg_box(b, (ax + ux * pos, ay + uy * pos), (ax + ux * s, ay + uy * s), t, z0, z1, color)
        if h < z1 - z0:  # lanh tô phía trên ô cửa
            kit.seg_box(b, (ax + ux * s, ay + uy * s), (ax + ux * e, ay + uy * e), t, z0 + h, z1, color)
        pos = e
    if pos < L:
        kit.seg_box(b, (ax + ux * pos, ay + uy * pos), (bx, by), t, z0, z1, color)


def floor_tiles(b, x0, y0, x1, y1, z, colors, cell=0.8, mat="gloss", jitter=None):
    b.grid(x0, y0, x1, y1, z, cell, colors, mat=mat, jitter=jitter)


def ceiling(b, x0, y0, x1, y1, z, color="ceiling_white", mat="palette"):
    """Mặt trần nhìn từ dưới lên (pháp tuyến hướng xuống)."""
    b.quad([(x0, y0, z), (x0, y1, z), (x1, y1, z), (x1, y0, z)], color, mat=mat)


def ceiling_tex(b, x0, y0, x1, y1, z, mat="ceiling_tex"):
    """Trần có texture: ceiling_tex (đục lỗ — sảnh) | ceiling_grid_tex (ô thả 0.6 m — văn phòng)."""
    b.quad([(x0, y0, z), (x0, y1, z), (x1, y1, z), (x1, y0, z)], "tex_white", mat=mat)


def baseboard(b, p0, p1, inward, h=0.1, color="black"):
    """Len chân tường chạy dọc mặt trong tường (inward = hướng vào phòng)."""
    ix, iy = inward
    a = (p0[0] + ix * 0.11, p0[1] + iy * 0.11)
    c = (p1[0] + ix * 0.11, p1[1] + iy * 0.11)
    kit.seg_box(b, a, c, 0.025, 0.0, h, color)


def window_band(b, p0, p1, inward, z0=0.9, z1=2.7, bay=1.5, rng=None):
    """Dải cửa sổ trên mặt trong tường: kính sáng + khung xám + rèm cuốn trắng hạ ở các độ cao khác nhau."""
    (ax, ay), (bx, by) = p0, p1
    ix, iy = inward
    L = math.hypot(bx - ax, by - ay)
    tx, ty = (bx - ax) / L, (by - ay) / L
    n = max(1, int(L / bay))
    for i in range(n):
        s0, s1 = i * L / n + 0.06, (i + 1) * L / n - 0.06
        cx, cy = ax + tx * (s0 + s1) / 2 + ix * 0.105, ay + ty * (s0 + s1) / 2 + iy * 0.105
        w = s1 - s0
        size = (w * abs(tx) + 0.02 * abs(ix), w * abs(ty) + 0.02 * abs(iy), z1 - z0)
        b.box((cx, cy, (z0 + z1) / 2), size, "glass", mat="light")
        drop = (rng.uniform(0.35, 0.95) if rng else 0.6) * (z1 - z0)
        bsz = (w * abs(tx) + 0.03 * abs(ix), w * abs(ty) + 0.03 * abs(iy), drop)
        b.box((cx + ix * 0.02, cy + iy * 0.02, z1 - drop / 2), bsz, "blind_white")
        b.box((cx + ix * 0.04, cy + iy * 0.04, z1 + 0.05), (bsz[0] + 0.02, bsz[1] + 0.02, 0.1), "curb_grey")
    kit.seg_box(b, (ax + ix * 0.11, ay + iy * 0.11), (bx + ix * 0.11, by + iy * 0.11), 0.06, z0 - 0.06, z0, "curb_grey")


def floor_dots(b, x0, y0, x1, y1, z, step=1.6):
    """Đèn chấm âm sàn (sảnh granite)."""
    y = y0 + step / 2
    k = 0
    while y < y1:
        x = x0 + step / 2 + (step / 2 if k % 2 else 0)
        while x < x1:
            b.quad([(x - 0.03, y - 0.03, z + 0.003), (x + 0.03, y - 0.03, z + 0.003),
                    (x + 0.03, y + 0.03, z + 0.003), (x - 0.03, y + 0.03, z + 0.003)], "lamp_white", mat="light")
            x += step
        y += step * 0.5
        k += 1


def wall_frame(b, x, y, z, w, h, face, color):
    """Tranh/khung ảnh treo tường (mảng màu)."""
    fx, fy = face
    sx, sy = (w if fx == 0 else 0.04), (w if fy == 0 else 0.04)
    b.box((x, y, z), (sx + 0.06 * (fx == 0), sy + 0.06 * (fy == 0), h + 0.06), "black")
    b.box((x + fx * 0.015, y + fy * 0.015, z), (sx, sy, h), color)


# ---------------- cửa kính ----------------
def glass_wall(b, p0, p1, z0, z1, mullion=1.5, frame="black", band=None):
    """Vách kính có đố đen; band=(z, cao, màu) = dải dán mờ ngang."""
    (ax, ay), (bx, by) = p0, p1
    L = math.hypot(bx - ax, by - ay)
    kit.seg_box(b, p0, p1, 0.03, z0, z1, "glass", mat="glass")
    n = max(1, round(L / mullion))
    for i in range(n + 1):
        t = i / n
        x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        b.box((x, y, (z0 + z1) / 2), (0.07, 0.07, z1 - z0), frame)
    kit.seg_box(b, p0, p1, 0.08, z1 - 0.08, z1, frame)
    kit.seg_box(b, p0, p1, 0.08, z0, z0 + 0.05, frame)
    if band:
        bz, bh, bc = band
        kit.seg_box(b, p0, p1, 0.04, bz, bz + bh, bc)


def door_handles(b, x, y, z=1.1, along="x", gap=0.25, length=1.6):
    """Cặp tay nắm thanh inox dài (cửa kính sảnh / Wing 3)."""
    for s in (-1, 1):
        px, py = (x + s * gap / 2, y) if along == "x" else (x, y + s * gap / 2)
        b.cylinder((px, py, z - length / 2 + 0.2), 0.025, length, "concrete_grey", segments=6, mat="gloss")


def card_reader(b, x, y, z=1.2, face=(0, -1)):
    """Đầu đọc thẻ đen + 5 đèn LED xanh."""
    fx, fy = face
    b.box((x, y, z), (0.09 if fy else 0.03, 0.03 if fy else 0.09, 0.13), "black", mat="gloss")
    for k in range(5):
        o = (k - 2) * 0.014
        b.box((x + fx * 0.017 + (o if fy else 0), y + fy * 0.017 + (0 if fy else o), z + 0.05),
              (0.008, 0.008, 0.008), "led_green")


def glass_leaf(b, width, height=2.4, framed=True, band=None):
    """Một cánh cửa kính, gốc tại bản lề (x=0), cánh kéo dài theo +X. framed=False: kính cường lực không khung."""
    b.box((width / 2, 0, height / 2), (width - 0.04, 0.02, height - 0.04), "glass", mat="glass")
    if framed:
        for x in (0.04, width - 0.04):
            b.box((x, 0, height / 2), (0.08, 0.06, height), "black")
        for z in (0.04, height - 0.04, 1.0):
            b.box((width / 2, 0, z), (width, 0.06, 0.08), "black")
    if band:
        bz, bh, bc = band
        b.box((width / 2, 0.0, bz + bh / 2), (width - 0.06, 0.03, bh), bc)


def perforated_panel(b, x0, x1, y, z0, z1, rng, color="wood_light", face=-1, holes=22):
    """Tấm ốp gỗ vàng đục lỗ hình hạt lúa (tường cạnh cửa quẹt thẻ)."""
    b.box(((x0 + x1) / 2, y, (z0 + z1) / 2), (x1 - x0 - 0.03, 0.05, z1 - z0 - 0.03), color)
    for _ in range(holes):
        b.sphere((rng.uniform(x0 + 0.1, x1 - 0.1), y + face * 0.03, rng.uniform(z0 + 0.15, z1 - 0.15)), 0.06,
                 "black", segments=6, rings=2, scale=(0.5, 0.15, 1.0), rot=(0, rng.uniform(-40, 40), 0))


def round_sign(b, x, y, z, face=(0, -1), r=0.17, inner=None):
    """Biển tròn gỗ (placeholder cho biển phòng/biển chỉ dẫn)."""
    fx, fy = face
    rot = (90, 0, 0) if fy else (90, 0, 90)
    off = (-fx * 0.02, -fy * 0.02)
    b.cylinder((x + off[0], y + off[1], z), r, 0.02, "wood_light", segments=14, rot=rot)
    if inner:
        b.cylinder((x + fx * 0.002, y + fy * 0.002, z - 0.03), r * 0.45, 0.01, inner, segments=10, rot=rot)


def white_double_door(b, x, y, along="x", w=1.6, h=2.3):
    """Cửa gỗ trắng 2 cánh trên tường (trang trí)."""
    if along == "x":
        b.box((x, y, h / 2), (w, 0.06, h), "sign_white")
        b.box((x, y - 0.035, h / 2), (0.02, 0.02, h - 0.1), "concrete_grey")
    else:
        b.box((x, y, h / 2), (0.06, w, h), "sign_white")
        b.box((x - 0.035, y, h / 2), (0.02, 0.02, h - 0.1), "concrete_grey")


def bar_railing(b, p0, p1, z0_start, z0_end, h=1.0, spacing=0.12):
    """Lan can song sắt đen (dốc theo cầu thang: chân từ z0_start → z0_end)."""
    (ax, ay), (bx, by) = p0, p1
    L = math.hypot(bx - ax, by - ay)
    n = max(1, int(L / spacing))
    for i in range(n + 1):
        t = i / n
        z = z0_start + (z0_end - z0_start) * t
        b.box((ax + (bx - ax) * t, ay + (by - ay) * t, z + h / 2), (0.025, 0.025, h), "black")
    b.tube((ax, ay, z0_start + h), (bx, by, z0_end + h), 0.03, "black", segments=4)


# ---------------- văn phòng ----------------
def office_chair(b, x, y, yaw=0.0):
    """Ghế lưới đen viền trắng, chân sao. Mặt ghế quay về hướng yaw (0 = nhìn +Y)."""
    r = math.radians(yaw)
    fx, fy = -math.sin(r), math.cos(r)  # hướng nhìn
    b.cylinder((x, y, 0.06), 0.3, 0.04, "black", segments=5)
    b.cylinder((x, y, 0.1), 0.03, 0.32, "concrete_grey", segments=5)
    b.box((x, y, 0.47), (0.5, 0.48, 0.08), "black", rot=(0, 0, yaw))
    bx, by = x - fx * 0.24, y - fy * 0.24
    b.box((bx, by, 0.82), (0.46, 0.05, 0.6), "black", rot=(-8, 0, yaw))
    b.box((bx, by, 1.13), (0.48, 0.07, 0.04), "sign_white", rot=(0, 0, yaw))


def desk_unit(b, plant=True, rng=None):
    """Bàn làm việc 1 chỗ: mép sau (vách ngăn) ở y = 0, người ngồi phía -Y.
    Mặt đen, hông thép đen đục lỗ lá, vách ngăn gỗ cam, màn hình, ghế."""
    W, D, H = 1.4, 0.7, 0.75
    b.box((0, -D / 2, H - 0.02), (W, D, 0.04), "desk_black")
    for s in (-1, 1):  # tấm hông đục lỗ lá
        x = s * (W / 2 - 0.02)
        b.box((x, -D / 2, (H - 0.04) / 2), (0.03, D - 0.04, H - 0.04), "desk_black")
        for k in range(3):
            b.sphere((x + s * 0.017, -D / 2 + (k - 1) * 0.16, 0.25 + 0.15 * k), 0.045, "curb_grey",
                     segments=6, rings=2, scale=(0.15, 0.5, 1.0), rot=(30 * (k - 1), 0, 0))
    b.box((W / 2 - 0.25, -D / 2 + 0.05, 0.33), (0.4, 0.55, 0.62), "desk_black")  # hộc tủ
    # vách ngăn gỗ cam + lỗ lá
    b.box((0, -0.015, H + 0.18), (W, 0.03, 0.36), "divider_wood")
    for k in range(4):
        b.sphere((-0.45 + k * 0.3, -0.035, H + 0.18 + (0.06 if k % 2 else -0.04)), 0.045, "trunk",
                 segments=6, rings=2, scale=(1.0, 0.15, 0.45), rot=(0, 35 * (1 if k % 2 else -1), 0))
    # màn hình + bàn phím
    b.box((-0.1, -0.15, H + 0.03), (0.22, 0.16, 0.02), "black")
    b.box((-0.1, -0.12, H + 0.13), (0.04, 0.03, 0.2), "black")
    b.box((-0.1, -0.13, H + 0.33), (0.6, 0.03, 0.36), "black")
    b.box((-0.1, -0.148, H + 0.33), (0.56, 0.01, 0.32), "screen_on" if plant else "screen", mat="gloss")
    b.box((-0.1, -0.45, H + 0.01), (0.42, 0.14, 0.02), "concrete_grey")
    b.box((0.18, -0.47, H + 0.01), (0.06, 0.1, 0.02), "black")                       # chuột
    b.cylinder((-0.52, -0.42, H), 0.045, 0.1, "mug", segments=6)                       # cốc
    b.box((0.42, -0.4, H + 0.02), (0.22, 0.3, 0.04), "paper", rot=(0, 0, 8))         # xấp giấy
    for k, c in enumerate(("sticky", "flower_pink", "sticky")):                        # giấy nhớ trên vách
        b.box((-0.55 + k * 0.08, -0.034, H + 0.27 - (k % 2) * 0.05), (0.06, 0.004, 0.06), c)
    if plant:  # chậu cây đặt trên vách ngăn
        b.cylinder((W / 2 - 0.15, -0.015, H + 0.36), 0.1, 0.16, "terracotta", segments=8)
        b.ico((W / 2 - 0.15, -0.015, H + 0.62), 0.17, "leaf", subdiv=1, scale=(1.1, 1.1, 0.9))
    office_chair(b, 0.05, -D - 0.3, yaw=0)


def meeting_room(b, x0, y0, x1, y1, door, h=3.0, seats=8, rng=None):
    """Phòng họp hộp kính tối. door = (cạnh 'S'|'N', từ x, đến x)."""
    side, d0, d1 = door
    for p0, p1, s in (((x0, y0), (x1, y0), "S"), ((x1, y0), (x1, y1), "E"),
                      ((x1, y1), (x0, y1), "N"), ((x0, y1), (x0, y0), "W")):
        if s == side:
            a, c = (p0[0], p1[0]) if s in "SN" else (p0[1], p1[1])
            lo, hi = sorted((d0, d1))
            for u0, u1 in ((min(a, c), lo), (hi, max(a, c))):
                if u1 - u0 > 0.01:
                    kit.seg_box(b, (u0, p0[1]), (u1, p0[1]), 0.08, 0, h, "glass_meeting", mat="gloss")
            kit.seg_box(b, (lo, p0[1]), (hi, p0[1]), 0.1, 2.5, h, "black")
        else:
            kit.seg_box(b, p0, p1, 0.08, 0, h, "glass_meeting", mat="gloss")
        for u in (p0, p1):
            b.box((u[0], u[1], h / 2), (0.1, 0.1, h), "black")
    # bàn họp dài trắng + ghế
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    L = (x1 - x0) - 2.2
    b.box((cx, cy, 0.73), (L, 1.2, 0.05), "sign_white")
    for s in (-1, 1):
        b.box((cx + s * (L / 2 - 0.3), cy, 0.36), (0.08, 1.0, 0.7), "concrete_grey")
    n = seats // 2
    for k in range(n):
        x = cx - L / 2 + 0.5 + k * (L - 1.0) / max(1, n - 1)
        office_chair(b, x, cy - 0.95, yaw=0)
        office_chair(b, x, cy + 0.95, yaw=180)
    # TV trên tường kín (phía bắc) + trần
    b.box((cx, y1 - 0.08, 1.6), (1.8, 0.06, 1.0), "black")
    b.box((cx, y1 - 0.115, 1.6), (1.7, 0.01, 0.9), "screen", mat="gloss")
    ceiling(b, x0, y0, x1, y1, h)


def pool_lamps(b, x, y):
    """3 đèn thả chao inox trên bàn bi-a (trục dài theo X). Bàn: mô hình Sketchfab, lib/pool_table.py."""
    for k in (-1, 0, 1):  # đèn thả chao inox
        b.cylinder((x + k * 0.8, y, 2.0), 0.01, 1.0, "black", segments=4)
        b.cylinder((x + k * 0.8, y, 1.75), 0.24, 0.25, "concrete_grey", segments=10, radius_top=0.06, mat="gloss")


def cube_shelf(b, x, y, cols=3, rows=4, cell=0.4, yaw=0.0):
    """Kệ ô vuông đỏ – trắng."""
    r = math.radians(yaw)
    ux, uy = math.cos(r), math.sin(r)
    for i in range(cols):
        for k in range(rows):
            c = "shelf_red" if (i + k) % 2 == 0 else "sign_white"
            off = (i - (cols - 1) / 2) * cell
            b.box((x + ux * off, y + uy * off, 0.2 + k * cell + cell / 2), (cell - 0.02, cell - 0.02, cell - 0.02),
                  c, rot=(0, 0, yaw))


def tulip_set(b, x, y, n=3):
    round_table(b, x, y, r=0.4, color="sign_white")
    for k in range(n):
        a = 2 * math.pi * k / n
        cx, cy = x + 0.75 * math.cos(a), y + 0.75 * math.sin(a)
        b.cylinder((cx, cy, 0), 0.22, 0.03, "black", segments=8)
        b.cylinder((cx, cy, 0.03), 0.03, 0.38, "black", segments=5)
        b.cylinder((cx, cy, 0.41), 0.22, 0.25, "black", segments=10, radius_top=0.27)


def hex_panels(b, x, y0, y1, z0, z1, face=1, r=0.22):
    """Tường ốp panel lục giác 3D trắng (mặt tường song song trục Y, nhô về +X nếu face=1)."""
    dy, dz = r * 1.75, r * 1.5
    k = 0
    z = z0 + r
    while z < z1 - r * 0.5:
        y = y0 + r + (dy / 2 if k % 2 else 0)
        while y < y1 - r * 0.5:
            b.cylinder((x, y, z), r * 0.95, 0.06, "sign_white", segments=6, rot=(0, 90 * face, 0))
            y += dy
        z += dz
        k += 1


def fire_cabinet(b, x, y, face=(1, 0)):
    fx, fy = face
    b.box((x, y, 1.0), (0.2 if fx else 0.7, 0.7 if fx else 0.2, 1.2), "shelf_red")
    b.box((x + fx * 0.105, y + fy * 0.105, 1.2), (0.01 if fx else 0.3, 0.3 if fx else 0.01, 0.2), "sign_white")


# ---------------- đồ đạc sảnh ----------------
def loft(b, rings, color, cap_top=True, cap_bottom=False, mat="palette"):
    """Nối các vòng đa giác (z, [(x, y)...]) cùng số đỉnh thành khối nhiều mặt vát."""
    n = len(rings[0][1])
    verts = [(x, y, z) for z, poly in rings for x, y in poly]
    faces = []
    for r in range(len(rings) - 1):
        for i in range(n):
            a, c = r * n + i, r * n + (i + 1) % n
            faces.append((a, c, c + n, a + n))
    b.raw(verts, faces, color, mat)
    if cap_top:
        b.raw(verts, [tuple(range((len(rings) - 1) * n, len(rings) * n))], color, mat)
    if cap_bottom:
        b.raw(verts, [tuple(reversed(range(n)))], color, mat)


def reception_desk(b):
    """Quầy lễ tân trắng nhiều mặt vát (như tinh thể), đế lùi màu be. Mặt trước hướng -Y local."""
    top = [(-1.25, 0.42), (-1.55, 0.0), (-1.3, -0.42), (1.3, -0.42), (1.6, 0.05), (1.3, 0.42)]
    mid = [(x * 1.06, y * 1.15 - 0.08) for x, y in top]     # mặt trước gần thẳng đứng, cao
    low = [(x * 0.7, y * 0.5) for x, y in top]              # vát mạnh vào trong
    base = [(x * 0.6, y * 0.42) for x, y in top]
    loft(b, [(0.3, low), (0.6, mid), (1.12, top)], "reception_white", cap_bottom=True)
    loft(b, [(0.0, base), (0.3, base)], "reception_base", cap_top=False)
    b.cylinder((-0.9, 0.12, 1.12), 0.08, 0.2, "glass_dark", segments=8, radius_top=0.05)  # bình hoa
    for k in range(6):
        a = 2 * math.pi * k / 6
        b.sphere((-0.9 + 0.12 * math.cos(a), 0.12 + 0.12 * math.sin(a), 1.42), 0.1, "shelf_red", segments=6, rings=4)


def hex_ottoman(b, x, y, r=0.45, h=0.45, rot=0.0):
    """Đôn lục giác: thân lam gỗ ngang (2 tông) + mặt đệm xám."""
    for k in range(4):
        z0 = k * h / 4
        b.cylinder((x, y, z0), r, h / 4 - 0.01, "ottoman_wood" if k % 2 == 0 else "divider_wood",
                   segments=6, rot=(0, 0, rot))
    b.cylinder((x, y, h - 0.01), r * 0.97, 0.06, "cushion_grey", segments=6, rot=(0, 0, rot))


def potted_palm(b, x, y, rng, h=1.8, pot="lamp_black"):
    b.cylinder((x, y, 0), 0.28, 0.5, pot, segments=8, radius_top=0.32)
    for k in range(9):
        a = 2 * math.pi * k / 9 + rng.uniform(-0.2, 0.2)
        tilt = rng.uniform(25, 55)
        L = rng.uniform(0.8, 1.1) * h * 0.55
        b.sphere((x + 0.35 * math.cos(a), y + 0.35 * math.sin(a), 0.5 + h * 0.5), L / 2, rng.choice(["leaf", "leaf_light"]),
                 segments=6, rings=3, scale=(1, 0.22, 0.06), rot=(0, -tilt, math.degrees(a)))
    b.cylinder((x, y, 0.45), 0.04, h * 0.5, "trunk", segments=5)


def slat_screen(b, x, y0, y1, h, gap=0.12, color="black", rng=None):
    """Vách lam đứng màu đen (sau quầy lễ tân), cây trầu bà rủ từ trên."""
    n = int((y1 - y0) / gap)
    for i in range(n + 1):
        b.box((x, y0 + i * gap, h / 2), (0.1, 0.04, h), color)
    b.box((x, (y0 + y1) / 2, h + 0.05), (0.2, y1 - y0, 0.1), color)
    if rng:  # dây trầu bà rủ: chuỗi chùm lá nhỏ, ngắn dài so le
        for i in range(int((y1 - y0) / 0.45)):
            yy = y0 + 0.22 + i * 0.45 + rng.uniform(-0.1, 0.1)
            drop = rng.uniform(0.7, 2.0)
            n = int(drop / 0.22)
            for k in range(n):
                r = 0.13 * (1 - 0.4 * k / max(1, n))
                b.sphere((x + 0.12 + rng.uniform(-0.04, 0.06), yy + rng.uniform(-0.08, 0.08), h - 0.1 - k * 0.22), r,
                         rng.choice(["leaf", "leaf_light", "leaf_dark"]), segments=6, rings=4, scale=(0.7, 1.2, 0.9))


def rice_fin(b, x, y, w0=0.045, bulge=0.075, h=3.4, grain=0.55, phase=0.0, t=0.03, off=0.16, axis="x", sign=1):
    """Một thanh gỗ đứng song song tường, bề ngang phình thành chuỗi hạt lúa (nhìn từ trong phòng).

    axis = trục pháp tuyến tường ("x" hoặc "y"); sign = hướng vào phòng; off = khoảng cách tới tường.
    """
    steps = int(h / grain * 5)
    left, right = [], []
    for k in range(steps + 1):
        z = h * k / steps
        u = (z / grain + phase) % 1.0
        w = w0 + bulge * math.sin(math.pi * u) ** 2
        left.append((-w, z))
        right.append((w, z))
    prof = right + list(reversed(left))  # vòng kín theo chiều dọc
    n = len(prof)
    verts = []
    for d in (off, off + t):
        for u, z in prof:
            if axis == "x":
                verts.append((x + sign * d, y + u, z))
            else:
                verts.append((x + u, y + sign * d, z))
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    faces.append(tuple(range(n, 2 * n)))  # chỉ mặt hướng vào phòng; bỏ mặt sát tường (không bao giờ thấy)
    b.raw(verts, faces, "wood_light")


def rice_fin_wall(b, p0, p1, h=3.4, spacing=0.21, axis="x", sign=1):
    (ax, ay), (bx, by) = p0, p1
    L = math.hypot(bx - ax, by - ay)
    n = int(L / spacing)
    for i in range(n + 1):
        t = i / n
        rice_fin(b, ax + (bx - ax) * t, ay + (by - ay) * t, h=h, phase=0.5 * (i % 2), axis=axis, sign=sign)


def rice_rod(b, x, y, h, rng, n=4):
    """Cọc sắt đen mảnh + các tấm hạt lúa (để trống, không ghi tên người thật)."""
    b.cylinder((x, y, 0), 0.02, h, "black", segments=5)
    for k in range(n):
        z = rng.uniform(1.1, h - 0.6)
        yaw = rng.uniform(0, 180)
        col = "sign_white" if rng.random() < 0.2 else "rice_grain"
        b.sphere((x, y, z), 0.22, col, segments=8, rings=4, scale=(1.0, 0.06, 0.28), rot=(0, 0, yaw))


def tile_wall(b, x0, x1, y, z0, z1, rng, cell=0.42, face=-1):
    """Tường ghép ô màu pastel (khu sinh hoạt cuối phòng Hạt Lúa)."""
    cols = ["glass", "curb_yellow", "fpt_orange", "office_tile_md", "sign_white", "fpt_blue", "rice_grain"]
    nx, nz = int((x1 - x0) / cell), int((z1 - z0) / cell)
    for i in range(nx):
        for k in range(nz):
            c = rng.choice(cols)
            b.box((x0 + (i + 0.5) * cell, y + face * 0.03, z0 + (k + 0.5) * cell),
                  (cell - 0.04, 0.03, cell - 0.04), c)


def round_table(b, x, y, r=0.35, h=0.72, color="sign_white"):
    b.cylinder((x, y, 0), 0.25, 0.03, color, segments=10)
    b.cylinder((x, y, 0.03), 0.04, h - 0.06, color, segments=6)
    b.cylinder((x, y, h - 0.03), r, 0.03, color, segments=12)


def cube_stool(b, x, y, s=0.45, color="concrete_grey"):
    b.box((x, y, s / 2), (s, s, s), color)


def tv_stand(b, x, y, yaw=0.0, w=1.6, h=0.95):
    """TV đứng trên chân di động."""
    r = math.radians(yaw)
    b.box((x, y, 0.05), (0.9, 0.6, 0.06), "black", rot=(0, 0, yaw))
    b.cylinder((x, y, 0.05), 0.04, 1.2, "black", segments=5)
    b.box((x, y, 1.25 + h / 2), (w, 0.07, h), "black", rot=(0, 0, yaw))
    b.box((x + 0.04 * math.sin(r), y - 0.04 * math.cos(r), 1.25 + h / 2), (w - 0.1, 0.02, h - 0.1),
          "fpt_blue", rot=(0, 0, yaw), mat="gloss")
