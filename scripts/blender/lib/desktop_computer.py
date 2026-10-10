"""Máy tính để bàn ở bàn intern zone_05 từ mô hình Sketchfab, dựng lại từ file gốc mỗi lần build zone (cùng cách bàn bi-a).

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/desktop_computer/source/desktop_computer.glb
  "Desktop Computer" — Tyler P Halterman, CC BY 4.0
  https://sketchfab.com/3d-models/desktop-computer-561abc2fc95941609fc7bc6f232895c2 (glTF asset.extras)
  794 tam giác: màn hình (Computer_Low), cổ + đế (Vert_Low, Base_Low), bàn phím, chuột + con lăn; 1 chất liệu PBR với
  4 ảnh 1024² (màu, metallic-roughness, phát sáng, normal). Màn hình rộng 0,756 m (to hơn thật), mặt trước nhìn -Y.

Các bước:
  1. Nhập, đưa transform vào đỉnh, bỏ empty. Bàn phím, chuột hạ xuống cùng mặt đáy đế (mô hình gốc lơ lửng 7–12 mm).
  2. Mặt màn hình (2 tam giác nhìn -Y ở mặt trước, UV trong ô hình nền Windows 7) tách thành object riêng `monitor_screen`
     (con của máy): 1 hình chữ nhật, UV 0..1 theo hình học, ảnh riêng SCREEN_SIZE = màn đăng nhập "My FPT" vẽ bằng code
     (chữ: font → tam giác → tô bằng numpy; nền, thẻ, ô nhập, nút: hình chữ nhật bo góc), chất liệu riêng
     M_monitor_screen → game đổi texture màn hình được sau này. `dynamic`: không nướng AO (4 đỉnh — AO ở góc loang cả màn).
  3. Thân máy (mọi phần còn lại) gộp 1 mesh `<name>`: ảnh màu thu về TEX_SIZE², bỏ normal / metallic-roughness / phát
     sáng; vùng ảnh không mặt nào dùng (hình nền Windows 7, mặt màn hình nướng sẵn) tô màu trung bình → WebP nhẹ. Chất
     liệu M_desktop_tex = ảnh × vertex color "Color" (AO zone) → game đổi sang toon + viền nét như mọi vật trong zone.
  4. Thu nhỏ cho màn hình rộng SCREEN_W; gốc = tâm đáy đế màn hình (đặt lên mặt bàn); mặt trước vẫn nhìn -Y.
"""
import math
import os
import re

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

from . import pool_table, props

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC_DIR = os.path.join(ROOT, "assets", "props", "desktop_computer", "source")
SRC = os.path.join(SRC_DIR, "desktop_computer.glb")
TEX = os.path.join(SRC_DIR, "desktop_computer_tex.png")        # sinh ra mỗi lần build (chỉ ở máy làm việc)
SCREEN_PNG = os.path.join(SRC_DIR, "monitor_screen_login.png")  # như trên
SOURCE_INFO = {"title": "Desktop Computer", "author": "Tyler P Halterman", "license": "CC BY 4.0",
               "url": "https://sketchfab.com/3d-models/desktop-computer-561abc2fc95941609fc7bc6f232895c2"}
PARTS = ("computer", "vert", "base", "key_board", "mouse", "mouse_wheel")

SCREEN_W = 0.55              # m — bề rộng ngoài của màn hình (cả viền)
TEX_SIZE = 512
SCREEN_SIZE = (512, 320)     # px, đúng tỉ lệ mặt màn hình (16:10)
FONTS = os.path.join(os.environ.get("WINDIR", ""), "Fonts")
FONT = os.path.join(FONTS, "segoeui.ttf")                       # thiếu → font có sẵn của Blender
FONT_BOLD = os.path.join(FONTS, "segoeuib.ttf")

_co = pool_table._co
_tris = pool_table._tris


def load_source(collection):
    """Nhập GLB vào `collection`, transform vào đỉnh. → {"computer", "vert", "base", "key_board", "mouse", "mouse_wheel"}"""
    if not os.path.exists(SRC):
        raise FileNotFoundError(
            f"thiếu mô hình máy tính bàn gốc: {os.path.relpath(SRC, ROOT)} — chép desktop_computer.glb "
            f"(Sketchfab, Tyler P Halterman, CC BY 4.0: {SOURCE_INFO['url']}) vào đây (file gốc không có trên repo)")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    parts = {}
    for o in new:
        if o.type != "MESH":
            continue
        key = re.sub(r"_low.*$", "", (o.parent or o).name.lower())     # Mouse_Wheel_Low → mouse_wheel
        mw = o.matrix_world.copy()
        o.parent = None
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)
        parts[key] = o
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    if sorted(parts) != sorted(PARTS):
        raise RuntimeError(f"mô hình máy tính bàn khác dự kiến: {sorted(parts)}")
    return parts


# ---------- vẽ bằng numpy (toạ độ ảnh: gốc trên-trái, y xuống; đổi chiều khi ghi vào ảnh Blender) ----------
def _raster(tris, W, H, ss=4):
    """Tam giác (n, 3, 2) theo px → độ phủ (H, W) 0..1 (lấy mẫu ss × ss mỗi px)."""
    cov = np.zeros((H * ss, W * ss), bool)
    for a, b, c in np.asarray(tris, float) * ss:
        if abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-9:
            continue
        x0, x1 = max(int(min(a[0], b[0], c[0])), 0), min(int(math.ceil(max(a[0], b[0], c[0]))), W * ss)
        y0, y1 = max(int(min(a[1], b[1], c[1])), 0), min(int(math.ceil(max(a[1], b[1], c[1]))), H * ss)
        if x0 >= x1 or y0 >= y1:
            continue
        X, Y = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        e = [(q[0] - p[0]) * (Y - p[1]) - (q[1] - p[1]) * (X - p[0]) for p, q in ((a, b), (b, c), (c, a))]
        cov[y0:y1, x0:x1] |= ((e[0] >= 0) & (e[1] >= 0) & (e[2] >= 0)) | ((e[0] <= 0) & (e[1] <= 0) & (e[2] <= 0))
    return cov.reshape(H, ss, W, ss).mean((1, 3))


def _rgb(hexcode):
    return np.array([int(hexcode[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


class _Canvas:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.px = np.zeros((H, W, 3), np.float32)
        self.X, self.Y = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)

    def paint(self, alpha, color):
        a = np.clip(np.asarray(alpha, np.float32), 0.0, 1.0)[..., None]
        self.px = self.px * (1 - a) + _rgb(color) * a

    def gradient(self, top, bottom):
        t = (self.Y / self.H)[..., None]
        self.px = _rgb(top) * (1 - t) + _rgb(bottom) * t

    def _sdf(self, x0, y0, x1, y1, r):
        qx = np.abs(self.X - (x0 + x1) / 2) - ((x1 - x0) / 2 - r)
        qy = np.abs(self.Y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r)
        return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

    def rrect(self, box, r, color, border=None, width=1.5, shadow=0.0):
        d = self._sdf(*box, r)
        if shadow:
            ds = self._sdf(box[0], box[1] + 3, box[2], box[3] + 3, r)
            self.paint(shadow * np.clip(1 - ds / 10, 0, 1), "#1f3b64")         # bóng mờ lệch xuống 3 px
        self.paint(0.5 - d, color)
        if border:
            self.paint(np.minimum(0.5 - d, 0.5 + d + width), border)

    def text(self, body, size, x, baseline, color, align="left", bold=False):
        """Chữ một dòng: font → mesh phẳng (props.text_mesh) → tam giác → tô. → bề rộng (px)."""
        font = FONT_BOLD if bold else FONT
        me = props.text_mesh(body, size=1.0, extrude=0.0, font=font if os.path.exists(font) else "")
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        tris = np.array([[(lp.vert.co.x, lp.vert.co.y) for lp in f.loops] for f in bm.faces], float)
        bm.free()
        bpy.data.meshes.remove(me)
        lo, hi = tris[..., 0].min(), tris[..., 0].max()
        x0 = {"left": x - lo * size, "center": x - (lo + hi) / 2 * size, "right": x - hi * size}[align]
        pts = np.stack([x0 + tris[..., 0] * size, baseline - tris[..., 1] * size], -1)
        self.paint(_raster(pts, self.W, self.H), color)
        return (hi - lo) * size

    def image(self, name, path):
        img = bpy.data.images.new(name, self.W, self.H, alpha=False)
        img.colorspace_settings.name = "sRGB"
        rgba = np.concatenate([self.px[::-1], np.ones((self.H, self.W, 1), np.float32)], -1)  # Blender: hàng dưới trước
        img.pixels.foreach_set(rgba.astype(np.float32).ravel())
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
        bpy.data.images.remove(img)
        return bpy.data.images.load(path, check_existing=False)


def screen_image():
    """Màn đăng nhập "My FPT" (chữ tiếng Anh như mọi chữ trong game; "FPT" màu cam như đầu app My FPT trong game)."""
    W, H = SCREEN_SIZE
    cv = _Canvas(W, H)
    cv.gradient("#eef3f9", "#d3dfee")
    cv.rrect((-8, -8, W + 8, 40), 0, "#ffffff")                          # thanh trên
    cv.paint((cv.Y > 40) & (cv.Y < 41.5), "#c9d6e6")
    w = cv.text("My", 22, 18, 28, "#1f3b64", bold=True)
    cv.text("FPT", 22, 18 + w + 6, 28, "#f37021", bold=True)
    cv.text("F-Ville 1 · Hòa Lạc", 12, W - 18, 26, "#7a8aa0", align="right")
    card = (146, 66, W - 146, 286)
    cv.rrect(card, 12, "#ffffff", border="#d5dfeb", shadow=0.25)
    cx = W / 2
    cv.text("Sign in", 22, cx, 104, "#1f3b64", align="center", bold=True)
    cv.text("Welcome to your first day!", 12, cx, 124, "#7a8aa0", align="center")
    for k, label in enumerate(("Intern ID", "Password")):
        y0 = 140 + k * 42
        cv.rrect((166, y0, W - 166, y0 + 32), 6, "#f7f9fc", border="#b8c7da")
        cv.text(label, 13, 178, y0 + 21, "#98a6b8")
    cv.rrect((166, 232, W - 166, 266), 6, "#f37021")
    cv.text("Sign in", 15, cx, 254, "#ffffff", align="center", bold=True)
    cv.text("FPT Software", 11, cx, H - 14, "#7a8aa0", align="center")
    return cv.image("monitor_screen_login", SCREEN_PNG)


# ---------- thân máy: ảnh màu thu nhỏ, bỏ vùng không dùng ----------
def body_texture(obj, src_img):
    """Ảnh màu gốc → TEX_SIZE²; px không thuộc UV của mặt nào (đã nới 6 px) tô màu trung bình phần được dùng."""
    W, H = src_img.size
    px = pool_table._pixels(src_img)[..., :3].copy()                       # (H, W, 3), hàng dưới trước
    me = obj.data
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    tris = []
    for p in me.polygons:
        ids = list(p.loop_indices)
        for k in range(1, len(ids) - 1):
            tris.append([uv[ids[0]], uv[ids[k]], uv[ids[k + 1]]])
    used = _raster(np.asarray(tris) * (W, H), W, H, ss=1) > 0          # toạ độ UV ↔ hàng dưới trước: cùng chiều
    for _ in range(6):
        u = used.copy()
        u[1:] |= used[:-1]
        u[:-1] |= used[1:]
        u[:, 1:] |= used[:, :-1]
        u[:, :-1] |= used[:, 1:]
        used = u
    px[~used] = px[used].mean(0)
    small = px.reshape(TEX_SIZE, H // TEX_SIZE, TEX_SIZE, W // TEX_SIZE, 3).mean((1, 3))
    img = bpy.data.images.new("desktop_computer_tex", TEX_SIZE, TEX_SIZE, alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(np.concatenate([small, np.ones((TEX_SIZE, TEX_SIZE, 1), np.float32)], -1).ravel())
    img.filepath_raw = TEX
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(TEX, check_existing=False), float(used.mean())


# ---------- màn hình ----------
def split_screen(comp, collection):
    """Bỏ 2 tam giác mặt màn hình khỏi Computer_Low → object `monitor_screen` (hình chữ nhật, UV 0..1)."""
    me = comp.data
    uvl = me.uv_layers.active.data
    faces = [p.index for p in me.polygons if p.normal.y < -0.99
             and np.mean([uvl[i].uv[0] for i in p.loop_indices]) > 0.7 and np.mean([uvl[i].uv[1] for i in p.loop_indices]) > 0.5]
    if len(faces) != 2:
        raise RuntimeError(f"mặt màn hình: tìm thấy {len(faces)} tam giác (cần 2)")
    co = np.array([me.vertices[v].co[:] for f in faces for v in me.polygons[f].vertices])
    (x0, y, z0), (x1, _, z1) = co.min(0), co.max(0)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in faces], context="FACES")
    bm.to_mesh(me)
    bm.free()
    sm = bpy.data.meshes.new("monitor_screen")
    sm.from_pydata([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [], [(0, 1, 2, 3)])   # nhìn -Y
    sm.uv_layers.new(name="UVMap").data.foreach_set("uv", [0, 0, 1, 0, 1, 1, 0, 1])
    so = bpy.data.objects.new("monitor_screen", sm)
    collection.objects.link(so)
    return so, (x1 - x0, z1 - z0)


def _finish(obj, mat):
    """1 chất liệu, vertex color "Color" trắng (AO nướng sau), bóng mượt theo góc (UV giữ nguyên)."""
    pool_table.retexture(obj, (0, 0, 1, 1), mat, atlas_size=(1, 1))


# ---------- dựng ----------
def build(collection, name, location, yaw_deg=0.0, log=print):
    """Dựng máy tại `location` (toạ độ Blender, z = mặt bàn), xoay `yaw_deg` quanh Z (0 = mặt trước nhìn -Y).
    → (object máy, object màn hình `monitor_screen` (con của máy), báo cáo)."""
    parts = load_source(collection)
    src_tris = sum(_tris(o) for o in parts.values())
    src_img = pool_table._base_image(parts["computer"].data.materials[0])
    old_mats = {m for o in parts.values() for m in o.data.materials}
    old_meshes = [o.data for o in parts.values() if o is not parts["computer"]]
    # bàn phím, chuột (+ con lăn) đặt xuống cùng mặt đáy đế màn hình
    floor = float(_co(parts["base"])[:, 2].min())
    for group in (("key_board",), ("mouse", "mouse_wheel")):
        dz = floor - min(_co(parts[k])[:, 2].min() for k in group)
        for k in group:
            parts[k].data.transform(Matrix.Translation((0, 0, dz)))
    # tỉ lệ theo bề rộng ngoài của màn hình; gốc = tâm đáy đế
    width = float(np.ptp(_co(parts["computer"])[:, 0]))
    s = SCREEN_W / width
    bc = _co(parts["base"])
    pivot = Vector(((bc[:, 0].min() + bc[:, 0].max()) / 2, (bc[:, 1].min() + bc[:, 1].max()) / 2, floor))
    screen, (sw, sh) = split_screen(parts["computer"], collection)
    body = parts["computer"]
    with bpy.context.temp_override(active_object=body, object=body, selected_objects=list(parts.values()),
                                   selected_editable_objects=list(parts.values())):
        bpy.ops.object.join()
    img, used = body_texture(body, src_img)
    _finish(body, pool_table.make_material(img, "M_desktop_tex"))
    _finish(screen, pool_table.make_material(screen_image(), "M_monitor_screen"))
    for me in old_meshes:                 # lưới của các phần đã gộp vào thân máy
        if me.users == 0:
            bpy.data.meshes.remove(me)
    for om in old_mats:
        if om and om.users == 0:
            bpy.data.materials.remove(om)
    for im in [i for i in bpy.data.images if i.users == 0]:
        bpy.data.images.remove(im)
    m = Matrix.Scale(s, 4) @ Matrix.Translation(-pivot)
    for o in (body, screen):
        o.data.transform(m)
    body.name = body.data.name = name
    body.location = location
    body.rotation_mode = "XYZ"
    body.rotation_euler = (0, 0, math.radians(yaw_deg))
    screen.parent = body
    screen.matrix_parent_inverse = Matrix.Identity(4)
    screen["dynamic"] = True             # không nướng AO (xem đầu file); game đổi texture lúc chơi
    bpy.context.view_layer.update()
    co = _co(body)
    lo, hi = co.min(0), co.max(0)
    info = {"src_tris": src_tris, "tris": _tris(body) + _tris(screen), "scale": s, "source": SOURCE_INFO,
            "size": (hi - lo).round(3).tolist(), "screen_size": [round(float(sw * s), 3), round(float(sh * s), 3)],
            "texture": {"body": TEX_SIZE, "screen": list(SCREEN_SIZE), "used": round(used, 3)}}
    log(f"[máy tính bàn] {src_tris} → {info['tris']} tam giác, tỉ lệ {s:.4f}: rộng × sâu × cao {info['size']} m, mặt màn hình "
        f"{info['screen_size']} m; ảnh thân {TEX_SIZE}² (dùng {used:.0%} ảnh gốc), màn hình {SCREEN_SIZE[0]} × {SCREEN_SIZE[1]}")
    return body, screen, info
