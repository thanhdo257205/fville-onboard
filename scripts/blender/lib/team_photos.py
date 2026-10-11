"""Ảnh team treo tường khu bàn bi-a (zone_05): 3 ảnh thật của người dùng gửi (12/10/2026 — mọi người trong ảnh đã đồng ý
xuất hiện công khai), khung theo đúng tỉ lệ từng ảnh.

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/team_photos/source/<tên>.webp
Mỗi lần build zone_05:
  1. Đọc ảnh gốc, làm mờ đậm vùng thẻ nhân viên (BLUR, toạ độ điểm ảnh của ảnh gốc, gốc trên-trái — thẻ có thể ghi họ
     tên) — làm mờ ở độ phân giải gốc rồi mới thu nhỏ.
  2. Thu cạnh dài về MAX_SIDE px → <tên>_game.png cạnh file gốc (chỉ ở máy làm việc; ảnh trong GLB là bản này).
  3. Khung viền đen (vào builder chung của tường) + mặt ảnh: 1 object riêng mỗi ảnh (`ENV_anh_team_<k>`), UV phủ cả ảnh,
     chất liệu ảnh × vertex color "Color" (AO zone) như mọi vật, custom property outline = False (không viền nét quanh ảnh).
"""
import os

import bpy
import bmesh
import numpy as np

from . import pool_table

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC_DIR = os.path.join(ROOT, "assets", "props", "team_photos", "source")
MAX_SIDE = 512
BLUR_RADIUS = 0.012          # × cạnh dài ảnh gốc (bán kính hộp làm mờ, lặp 3 lần ~ Gauss)

# vùng thẻ nhân viên cần làm mờ: (x0, y0, x1, y1) điểm ảnh ảnh gốc, gốc trên-trái
BLUR = {
    "team_garden": [(345, 575, 395, 645), (725, 540, 770, 590), (520, 825, 570, 895), (720, 790, 765, 850),
                    (850, 730, 890, 810)],
    "team_award": [(370, 1335, 420, 1400), (560, 1425, 610, 1495), (710, 1340, 760, 1415), (705, 1440, 752, 1500),
                   (820, 1130, 855, 1210)],
    "team_trainers_day": [(5, 575, 70, 655), (275, 610, 330, 680), (378, 566, 432, 635), (592, 592, 665, 690),
                          (825, 620, 870, 695), (1567, 520, 1609, 567), (1715, 503, 1757, 553), (1803, 511, 1844, 557)],
}


def _box_blur(a, r):
    """Làm mờ hộp bán kính r (theo 2 trục) cho mảng (h, w, c)."""
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(3)], mode="edge"), axis=axis)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
        a = (hi - lo) / (2 * r + 1)
    return a


def game_image(name):
    """Ảnh gốc → làm mờ thẻ → thu nhỏ → <tên>_game.png. → (ảnh Blender, rộng / cao)"""
    src = os.path.join(SRC_DIR, f"{name}.webp")
    if not os.path.exists(src):
        raise FileNotFoundError(f"thiếu ảnh team gốc: {os.path.relpath(src, ROOT)} (chỉ có trên máy làm việc)")
    img = bpy.data.images.load(src, check_existing=False)
    w, h = img.size
    px = pool_table._pixels(img).copy()                         # hàng dưới trước
    bpy.data.images.remove(img)
    r = max(2, int(BLUR_RADIUS * max(w, h)))
    for x0, y0, x1, y1 in BLUR.get(name, []):
        r0, r1 = h - y1, h - y0                                 # gốc trên-trái → hàng dưới trước
        pad = 3 * r
        a0, a1, b0, b1 = max(0, r0 - pad), min(h, r1 + pad), max(0, x0 - pad), min(w, x1 + pad)
        blk = px[a0:a1, b0:b1, :3]
        for _ in range(3):
            blk = _box_blur(blk, r)
        px[r0:r1, x0:x1, :3] = blk[r0 - a0:r1 - a0, x0 - b0:x1 - b0]
    tmp = bpy.data.images.new(f"{name}_full", w, h, alpha=False)
    tmp.pixels.foreach_set(px.ravel())
    s = MAX_SIDE / max(w, h)
    gw, gh = max(1, round(w * s)), max(1, round(h * s))
    tmp.scale(gw, gh)
    out = os.path.join(SRC_DIR, f"{name}_game.png")
    tmp.filepath_raw = out
    tmp.file_format = "PNG"
    tmp.save()
    bpy.data.images.remove(tmp)
    img = bpy.data.images.load(out, check_existing=False)
    img.colorspace_settings.name = "sRGB"
    return img, w / h


def frames(b, col, items, y, z, height, gap, center_x, border=0.03, log=print):
    """Hàng ảnh trên tường nhìn về −Y (tường bắc), canh giữa center_x, cùng chiều cao `height`, cách nhau `gap`.
    items: [tên ảnh]. Khung viền đen vào builder `b`; mặt ảnh: object riêng trong `col`. → [object mặt ảnh]"""
    imgs = [game_image(n) for n in items]
    widths = [height * ar for _, ar in imgs]
    x = center_x - (sum(widths) + gap * (len(items) - 1)) / 2
    objs = []
    for k, ((img, ar), w, name) in enumerate(zip(imgs, widths, items)):
        cx = x + w / 2
        b.box((cx, y, z), (w + 2 * border, 0.04, height + 2 * border), "black")
        me = bpy.data.meshes.new(f"anh_team_{name}")
        bm = bmesh.new()
        yf = y - 0.022                                          # trước mặt khung (khung dày 0,04)
        vs = [bm.verts.new(p) for p in ((cx - w / 2, yf, z - height / 2), (cx + w / 2, yf, z - height / 2),
                                         (cx + w / 2, yf, z + height / 2), (cx - w / 2, yf, z + height / 2))]
        f = bm.faces.new(vs)
        uv = bm.loops.layers.uv.new("UVMap")
        for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = t
        bm.to_mesh(me)
        bm.free()
        colr = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
        colr.data.foreach_set("color", np.ones(len(me.loops) * 4, np.float32))
        mat = pool_table.make_material(img, f"M_anh_team_{k + 1}")
        mat["outline"] = False
        me.materials.append(mat)
        o = bpy.data.objects.new(f"ENV_anh_team_{k + 1}", me)
        col.objects.link(o)
        objs.append(o)
        log(f"[ảnh team] {name}: {img.size[0]}×{img.size[1]} px, khung {w:.2f} × {height:.2f} m (tỉ lệ {ar:.3f}), "
            f"làm mờ {len(BLUR.get(name, []))} thẻ")
        x += w + gap
    return objs
