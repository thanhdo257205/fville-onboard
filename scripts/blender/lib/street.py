"""Khối dựng cho phố (zone_00 điểm đón): nhà phố + cửa hàng, mái chờ xe buýt, biển trạm, cột điện, quán vỉa hè.

Điểm đón chung chung, không mô phỏng địa điểm thật: biển hiệu để trống (mảng màu), không logo, không chữ.
Toạ độ Blender (Z lên), 1 đơn vị = 1 m.
"""
import math

from . import kit
from . import quality as Q

HOUSE_COLORS = ("house_yellow", "house_mint", "house_pink", "house_cream", "house_blue", "house_peach", "house_grey")
AWNINGS = ("awning_red", "awning_green", "awning_blue", "awning_orange")
SIGNS = ("awning_red", "awning_blue", "awning_green", "shelter_blue", "awning_orange", "sign_white")
SHOP_H = 3.6     # tầng trệt (cửa hàng)
FLOOR_H = 3.2    # tầng trên


def shophouse(b, x0, x1, yf, out, rng, floors=None, depth=9.0, detail=2, color=None):
    """Nhà phố (nhà ống) mặt tiền hẹp nhìn theo hướng Y = out (-1: nhìn -Y, nhà kéo về +Y).
    Tầng trệt: cửa hàng mở (lòng tối) hoặc cửa cuốn, biển hiệu trống, mái hiên vải sọc.
    Tầng trên: ban công lan can / cửa sổ + cục nóng điều hoà; mái: tường chắn + bồn nước inox nằm.
    detail=1: nhà xa (bên kia đường, cuối phố) — bỏ ban công, điều hoà, bồn nước. Trả chiều cao nhà."""
    w = x1 - x0
    floors = floors or rng.choice((3, 3, 4, 4, 5))
    H = SHOP_H + (floors - 1) * FLOOR_H
    col = color or rng.choice(HOUSE_COLORS)
    xc = (x0 + x1) / 2

    def F(u, d, z):
        """u: lệch theo X từ x0; d: khoảng nhô ra khỏi mặt tiền (dương = ra phố); z: cao độ."""
        return (x0 + u, yf + out * d, z)

    b.box((xc, yf - out * depth / 2, H / 2), (w, depth, H), col)
    # --- tầng trệt ---
    kind = rng.choice(("open", "open", "shutter", "glass"))
    inner_w = w - 0.5
    if kind == "shutter":
        b.box(F(w / 2, 0.02, 1.45), (inner_w, 0.04, 2.7), "shutter")
        for k in range(Q.n(5) if detail > 1 else 3):
            b.box(F(w / 2, 0.045, 0.35 + k * (2.4 / (Q.n(5) if detail > 1 else 3))), (inner_w, 0.02, 0.04), "curb_grey")
    else:
        b.box(F(w / 2, 0.02, 1.45), (inner_w, 0.04, 2.7), "glass_dark", mat="gloss" if kind == "glass" else "palette")
        if kind == "glass":
            b.box(F(w / 2, 0.05, 1.45), (0.06, 0.04, 2.7), "black")
        elif detail > 1:  # hàng bày trước cửa: vài thùng/kệ màu
            for k in range(2):
                u = 0.7 + k * (w - 1.4)
                b.box(F(u, 0.35, 0.45), (0.8, 0.5, 0.9), rng.choice(("wood_light", "awning_orange", "leaf_light", "paper")))
    # biển hiệu: khung màu + mặt trắng trơn (không chữ)
    b.box(F(w / 2, 0.12, 3.12), (w - 0.3, 0.2, 0.62), rng.choice(SIGNS))
    b.box(F(w / 2, 0.23, 3.12), (w - 0.9, 0.02, 0.36), "sign_white")
    # mái hiên vải sọc: tấm nghiêng từ mặt tiền xuống ra phố + diềm trước
    if detail > 1 or rng.random() < 0.5:
        a1, a2 = rng.sample(AWNINGS, 2) if rng.random() < 0.5 else (rng.choice(AWNINGS), "sign_white")
        tilt = -out * 20.0
        b.box(F(w / 2, 0.56, 2.66), (w - 0.3, 1.18, 0.04), a1, rot=(tilt, 0, 0))
        n = max(2, int((w - 0.3) / 0.9))
        for k in range(n):
            u = 0.15 + (k + 0.5) * (w - 0.3) / n
            b.box(F(u, 0.56, 2.685), ((w - 0.3) / n * 0.45, 1.19, 0.03), a2, rot=(tilt, 0, 0))
        b.box(F(w / 2, 1.13, 2.36), (w - 0.3, 0.03, 0.2), a1)
    # --- tầng trên ---
    style = rng.choice(("balcony", "windows")) if detail > 1 else "windows"
    for k in range(1, floors):
        z0 = SHOP_H + (k - 1) * FLOOR_H
        b.box(F(w / 2, 0.06, z0), (w + 0.04, 0.12, 0.14), "concrete_white")   # gờ sàn
        if style == "balcony" and (k == 1 or rng.random() < 0.6):
            b.box(F(w / 2, 0.45, z0 + 0.06), (w - 0.2, 0.9, 0.12), "concrete_white")
            b.box(F(w / 2, 0.88, z0 + 0.6), (w - 0.2, 0.04, 0.95), "lamp_black")        # lan can (tấm)
            b.box(F(w / 2, 0.9, z0 + 1.1), (w - 0.16, 0.08, 0.06), "concrete_white")   # tay vịn
            b.box(F(w / 2, 0.02, z0 + 1.3), (min(2.2, w - 1.0), 0.04, 2.3), "glass_dark", mat="gloss")
            if rng.random() < 0.6:
                kit.bush(b, *F(0.5, 0.55, 0)[:2], 0.28, rng, z=z0 + 0.12, flowers=rng.random() < 0.5, lobes=1)
        else:
            nwin = 2 if w > 3.6 else 1
            for i in range(nwin):
                u = w * (i + 1) / (nwin + 1)
                b.box(F(u, 0.02, z0 + 1.65), (1.1, 0.04, 1.4), "glass_dark", mat="gloss")
                b.box(F(u, 0.08, z0 + 0.92), (1.3, 0.16, 0.08), "concrete_white")       # bậu cửa
                b.box(F(u, 0.05, z0 + 1.65), (0.05, 0.03, 1.4), "concrete_white")       # đố giữa
        if detail > 1 and rng.random() < 0.45:  # cục nóng điều hoà
            u = rng.choice((0.55, w - 0.55))
            b.box(F(u, 0.2, z0 + 2.55), (0.78, 0.3, 0.52), "concrete_white")
            b.box(F(u, 0.36, z0 + 2.55), (0.4, 0.02, 0.4), "curb_grey")
    # --- mái ---
    b.box(F(w / 2, 0.1, H + 0.3), (w, 0.2, 0.6), col)                     # tường chắn mái
    b.box(F(w / 2, 0.21, H + 0.62), (w + 0.04, 0.06, 0.06), "concrete_white")
    if detail > 1 and rng.random() < 0.7:  # bồn nước inox nằm trên giá
        u = rng.uniform(1.0, max(1.1, w - 1.0))
        bx, by, _ = F(u, -depth * 0.55, 0)
        b.box((bx, by, H + 0.25), (0.9, 0.7, 0.5), "lamp_black")
        b.cylinder((bx - 0.7, by, H + 0.95), 0.45, 1.4, "lamp_white", segments=10, rot=(0, 90, 0))
    return H


def shop_row(b, x0, x1, yf, out, rng, detail=2, widths=(3.6, 4.2, 4.8, 5.4), floors=None):
    """Dãy nhà phố liền kề từ x0 tới x1, mặt tiền tại yf. Trả [(x0, x1, H)]."""
    houses, x = [], x0
    while x < x1 - 1.0:
        w = min(rng.choice(widths), x1 - x)
        h = shophouse(b, x, x + w, yf, out, rng, floors=floors, detail=detail)
        houses.append((x, x + w, h))
        x += w
    return houses


def bus_shelter(b, x0, y0, x1, y1, h=2.6):
    """Mái chờ xe buýt: khung xanh, mái kính nghiêng, vách kính sau (y1), ghế băng, bảng sơ đồ trống bên hông.
    Mặt mở về phía -Y (ra đường)."""
    F = "shelter_blue"
    for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        b.box((x, y, h / 2), (0.1, 0.1, h), F)
    xc, yc = (x0 + x1) / 2, (y0 + y1) / 2
    b.box((xc, yc - 0.15, h + 0.12), (x1 - x0 + 0.5, y1 - y0 + 0.7, 0.06), "glass", mat="gloss", rot=(-5, 0, 0))
    b.box((xc, y0 - 0.48, h + 0.06), (x1 - x0 + 0.5, 0.08, 0.16), F)                   # diềm trước
    b.box((xc, y1 + 0.18, h + 0.18), (x1 - x0 + 0.5, 0.08, 0.16), F)                   # diềm sau
    b.box((xc, y1, 1.25), (x1 - x0 - 0.1, 0.04, 1.9), "glass", mat="gloss")             # vách kính sau
    b.box((xc, y1, 0.28), (x1 - x0, 0.06, 0.08), F)
    b.box((xc, y1, 2.22), (x1 - x0, 0.06, 0.08), F)
    # ghế băng
    b.box((xc, y1 - 0.35, 0.46), (x1 - x0 - 0.8, 0.42, 0.05), "wood_light")
    for x in (x0 + 0.6, x1 - 0.6):
        b.box((x, y1 - 0.35, 0.22), (0.06, 0.36, 0.44), "lamp_black")
    # bảng sơ đồ tuyến ở vách hông (x1): mặt trắng + vài đường màu, không chữ
    b.box((x1, yc, 1.35), (0.06, y1 - y0 - 0.2, 1.5), F)
    b.box((x1 - 0.04, yc, 1.35), (0.02, y1 - y0 - 0.45, 1.25), "sign_white")
    for i, c in enumerate(("fpt_blue", "fpt_orange", "fpt_green")):
        b.box((x1 - 0.055, yc + (i - 1) * 0.1, 1.35 + (i - 1) * 0.28), (0.01, y1 - y0 - 0.7, 0.05), c)


def bus_stop_sign(b, x, y, z=0.0):
    """Cột biển trạm: tấm xanh với hình xe buýt trắng (biểu tượng chung, không chữ). Mặt nhìn ±X."""
    b.cylinder((x, y, z), 0.05, 2.9, "lamp_black", segments=6)
    b.box((x, y, z + 2.55), (0.04, 0.62, 0.62), "shelter_blue")
    for s in (-1, 1):  # biểu tượng hai mặt
        px = x + s * 0.025
        b.box((px, y, z + 2.58), (0.01, 0.4, 0.22), "sign_white")
        b.box((px + s * 0.003, y, z + 2.62), (0.01, 0.32, 0.07), "shelter_blue")       # dải cửa sổ
        for dy in (-0.12, 0.12):
            b.box((px, y + dy, z + 2.44), (0.01, 0.08, 0.08), "sign_white")               # bánh xe


def utility_poles(b, xs, y, height=7.5, rng=None):
    """Cột điện bê tông + 3 dây võng giữa các cột (phố Việt Nam)."""
    tops = []
    for x in xs:
        b.box((x, y, height / 2), (0.24, 0.24, height), "concrete_grey")
        b.box((x, y, height - 0.5), (0.08, 1.2, 0.08), "concrete_grey")                  # xà ngang
        tops.append(x)
    for xa, xb in zip(tops, tops[1:]):
        for dy, dz in ((-0.5, 0.0), (0.0, 0.1), (0.5, 0.0)):
            za = height - 0.45 + dz
            mid = ((xa + xb) / 2, y + dy, za - 0.55)   # dây võng
            b.tube((xa, y + dy, za), mid, 0.018, "black", segments=4)
            b.tube(mid, (xb, y + dy, za), 0.018, "black", segments=4)


def plastic_cafe(b, x, y, rng, n_stools=4):
    """Quán vỉa hè: bàn nhựa thấp + ghế đẩu nhựa đỏ/xanh."""
    b.box((x, y, 0.42), (0.6, 0.6, 0.04), "stool_blue")
    for dx in (-0.25, 0.25):
        for dy in (-0.25, 0.25):
            b.box((x + dx, y + dy, 0.2), (0.04, 0.04, 0.4), "stool_blue")
    for k in range(n_stools):
        a = 2 * math.pi * k / n_stools + rng.uniform(-0.3, 0.3)
        sx, sy = x + 0.62 * math.cos(a), y + 0.62 * math.sin(a)
        c = rng.choice(("stool_red", "stool_blue"))
        b.cylinder((sx, sy, 0), 0.15, 0.3, c, segments=8, radius_top=0.13)


def tree_pit(b, x, y, rng, z=0.0, height=None):
    """Cây vỉa hè trong ô gốc vuông viền bê tông."""
    b.box((x, y, z + 0.04), (1.1, 1.1, 0.08), "concrete_grey")
    b.box((x, y, z + 0.05), (0.85, 0.85, 0.08), "dirt")
    kit.tree(b, x, y, rng, height=height or rng.uniform(5.5, 7.0), z=z, white_base=True)
