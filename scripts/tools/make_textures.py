"""Vẽ các texture lát liền mạch, phong cách màu phẳng. Mỗi texture có 2 bản:
  <tên>.png      — bản thấp (low)
  <tên>@2x.png   — bản cao (high), gấp đôi độ phân giải, thêm chi tiết nhỏ
Vẽ ở 2× kích thước đích rồi thu nhỏ (khử răng cưa).

Chạy: python scripts/tools/make_textures.py
"""
import math as m
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "assets" / "textures"
SS = 2  # siêu lấy mẫu


def _save(im, name, size):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / name
    im.resize((size, size), Image.LANCZOS).save(out)
    print(out.relative_to(ROOT), (size, size))


def _wrapped(draw_fn, size):
    """Vẽ lặp 3×3 để hình chạm mép ảnh vẫn liền mạch khi lát."""
    for dx in (-size, 0, size):
        for dy in (-size, 0, size):
            draw_fn(dx, dy)


def brick_basketweave(size, name, hi, seed=7):
    """Gạch đan rổ: 4×4 ô đan, mỗi ô 3 viên, xoay xen kẽ. 1 ô ảnh = 1 m."""
    S = size * SS
    k = S / 512
    rng = random.Random(seed)
    im = Image.new("RGB", (S, S), "#7A6B62")
    d = ImageDraw.Draw(im)
    bricks = ["#A0563F", "#96503A", "#A85E45", "#8E4A35", "#B0664B", "#9A5A47", "#8C6458"]
    weights = [5, 4, 4, 2, 2, 2, 1]
    cells, n = 4, 3
    cell = S / cells
    bw = cell / n
    for cy in range(cells):
        for cx in range(cells):
            horiz = (cx + cy) % 2 == 0
            x0, y0 = cx * cell, cy * cell
            for j in range(n):
                box = ([x0, y0 + j * bw, x0 + cell, y0 + (j + 1) * bw] if horiz
                       else [x0 + j * bw, y0, x0 + (j + 1) * bw, y0 + cell])
                h = 2 * k
                bx = [box[0] + h, box[1] + h, box[2] - h, box[3] - h]
                col = rng.choices(bricks, weights)[0]
                d.rounded_rectangle(bx, radius=3 * k, fill=col)
                shade = tuple(int(int(col[i:i + 2], 16) * 0.86) for i in (1, 3, 5))
                if horiz:
                    d.line([bx[0] + 3 * k, bx[3] - k, bx[2] - 3 * k, bx[3] - k], fill=shade, width=int(2 * k))
                else:
                    d.line([bx[2] - k, bx[1] + 3 * k, bx[2] - k, bx[3] - 3 * k], fill=shade, width=int(2 * k))
                if hi:  # đốm sần mặt gạch
                    for _ in range(4):
                        px, py = rng.uniform(bx[0], bx[2]), rng.uniform(bx[1], bx[3])
                        r = rng.uniform(1, 2.5) * k
                        d.ellipse([px - r, py - r, px + r, py + r], fill=shade)
    _save(im, name, size)


def ceiling_dots(size, name, hi, per_tile=4):
    """Trần trắng đục lỗ tròn (sảnh): 1 ô ảnh = 1 m, lỗ cách 0.25 m, xen vài đèn chấm."""
    S = size * SS
    k = S / 256
    im = Image.new("RGB", (S, S), "#EEEDEA")
    d = ImageDraw.Draw(im)
    step = S / per_tile
    for j in range(per_tile):
        for i in range(per_tile):
            cx, cy = (i + 0.5) * step, (j + 0.5) * step
            if (i + 2 * j) % 5 == 0:
                d.ellipse([cx - 9 * k, cy - 9 * k, cx + 9 * k, cy + 9 * k], fill="#D9D6CF")
                d.ellipse([cx - 6 * k, cy - 6 * k, cx + 6 * k, cy + 6 * k], fill="#FFFFFF")
            else:
                d.ellipse([cx - 7 * k, cy - 7 * k, cx + 7 * k, cy + 7 * k], fill="#4A4744")
                if hi:
                    d.ellipse([cx - 5 * k, cy - 7 * k, cx + 5 * k, cy - 3 * k], fill="#3A3836")
    _save(im, name, size)


def hex_pavers(size, name, hi, cols=5, rows=3, seed=3):
    """Gạch lục giác (vỉa hè, đảo giếng): 1 ô ảnh = 1 m, mạch rêu xanh lẫn đất."""
    S = size * SS
    k = S / 512
    rng = random.Random(seed)
    im = Image.new("RGB", (S, S), "#6F6A4A")
    d = ImageDraw.Draw(im)
    w = S / cols
    h = S / (rows * 2)
    r = w / m.sqrt(3) * 0.93
    ry = h / 1.5 * 0.93
    palette = ["#9C6E62", "#93685C", "#A47567", "#8A5F55", "#9F6A5A", "#8E6A60"]
    for j in range(rows * 2):
        for i in range(cols):
            cx = (i + 0.5 + (0.5 if j % 2 else 0)) * w
            cy = (j + 0.5) * h
            c = rng.choice(palette)

            def draw(dx, dy, cx=cx, cy=cy, c=c):
                pts = [(cx + dx + r * m.cos(m.radians(90 + 60 * t)), cy + dy + ry * m.sin(m.radians(90 + 60 * t)))
                       for t in range(6)]
                d.polygon(pts, fill=c)
                if hi:  # mép trên sáng nhẹ, gợi gạch nổi
                    d.line(pts[2:5], fill="#B08476", width=int(2 * k))
            _wrapped(draw, S)
    for _ in range(60 if not hi else 140):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        rr = rng.uniform(2, 4) * k
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=rng.choice(["#5E7A3A", "#6B8A40"]))
    _save(im, name, size)


def laterite(size, name, hi, seed=5):
    """Đá ong (giếng làng): nền vàng nâu, rỗ lỗ tối + đốm vàng. 1 ô ảnh = 0.5 m."""
    S = size * SS
    k = S / 256
    rng = random.Random(seed)
    im = Image.new("RGB", (S, S), "#A8743E")
    d = ImageDraw.Draw(im)
    for _ in range(140 if not hi else 300):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        rw, rh = rng.uniform(3, 9) * k, rng.uniform(2, 6) * k
        c = rng.choice(["#5A3820", "#4A2E1C", "#6B4426"])
        _wrapped(lambda dx, dy: d.ellipse([x + dx - rw, y + dy - rh, x + dx + rw, y + dy + rh], fill=c), S)
    for _ in range(120 if not hi else 260):
        x, y = rng.uniform(0, S), rng.uniform(0, S)
        rr = rng.uniform(1.5, 3.5) * k
        c = rng.choice(["#D6B04A", "#C99B45", "#E0C060"])
        _wrapped(lambda dx, dy: d.ellipse([x + dx - rr, y + dy - rr, x + dx + rr, y + dy + rr], fill=c), S)
    _save(im, name, size)


def louver(size, name, hi, seed=9):
    """Lam gạch đỏ mặt tiền: hàng gạch mỏng + lỗ đục hình hạt lúa. 1 ô ảnh = 1 m."""
    S = size * SS
    k = S / 256
    rng = random.Random(seed)
    im = Image.new("RGB", (S, S), "#7E3E30")
    d = ImageDraw.Draw(im)
    course = S / 12
    for row in range(12):
        y0 = row * course
        x = -(course * 1.5 if row % 2 else 0)
        while x < S:
            bw = course * 3
            c = rng.choice(["#8E4636", "#96503A", "#874233", "#9A5640"])
            d.rectangle([x + k, y0 + k, x + bw - k, y0 + course - k], fill=c)
            x += bw
    for _ in range(9):
        cx, cy = rng.uniform(20 * k, S - 20 * k), rng.uniform(20 * k, S - 20 * k)
        a = m.radians(rng.uniform(-50, 50))
        pts = []
        for t in range(24):
            u = 2 * m.pi * t / 24
            px, py = 14 * k * m.cos(u), 5 * k * m.sin(u) * (1 - 0.35 * m.cos(u))
            pts.append((cx + px * m.cos(a) - py * m.sin(a), cy + px * m.sin(a) + py * m.cos(a)))
        d.polygon(pts, fill="#2A1A16")
    _save(im, name, size)


def office_ceiling(size, name, hi):
    """Trần ô thả văn phòng: 2×2 tấm 0.6 m (1 ô ảnh = 1.2 m), khung T xám nhạt."""
    S = size * SS
    k = S / 256
    rng = random.Random(1)
    im = Image.new("RGB", (S, S), "#F2F1EE")
    d = ImageDraw.Draw(im)
    if hi:  # vân lỗ li ti trên tấm trần
        for _ in range(1500):
            x, y = rng.uniform(0, S), rng.uniform(0, S)
            d.point((x, y), fill="#DCDAD5")
    for c in (0, S // 2, S):
        d.rectangle([c - 2 * k, 0, c + 2 * k, S], fill="#C9C7C2")
        d.rectangle([0, c - 2 * k, S, c + 2 * k], fill="#C9C7C2")
    _save(im, name, size)


TEXTURES = [  # (hàm, tên, kích thước bản thấp)
    (brick_basketweave, "brick_basketweave", 512),
    (ceiling_dots, "ceiling_dots", 256),
    (hex_pavers, "hex_pavers", 512),
    (laterite, "laterite", 256),
    (louver, "brick_louver", 256),
    (office_ceiling, "ceiling_grid", 256),
]

if __name__ == "__main__":
    for fn, name, size in TEXTURES:
        fn(size, f"{name}.png", hi=False)
        fn(size * 2, f"{name}@2x.png", hi=True)
