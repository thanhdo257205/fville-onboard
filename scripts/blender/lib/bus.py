"""Xe bus đưa đón (zone_00, zone_01) từ mô hình Sketchfab, dựng lại từ file gốc mỗi lần build zone (cùng cách bàn bi-a).

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/bus/source/bus_jb5_low_poly.glb
  "Bus jb5 Low Poly" — seenkonkgrng, CC BY 4.0
  https://sketchfab.com/3d-models/bus-jb5-low-poly-fae01c4c820c4a7b958c3de2b3b011ab (glTF asset.extras)
  1 khối liền 1.422 tam giác, dài 11,86 m (12,2 m tính gương), cao 3,76 m, đầu xe hướng -X; 1 ảnh 1024 × 512 (bản vẽ
  mẫu sơn tím + xanh, chữ thương hiệu, biển số), chất liệu có KHR_materials_clearcoat. Hai bên hông chung 1 ảnh (đối xứng):
  cửa khách vẽ ở đầu xe, giữa cản trước và bánh trước.

Các bước (kết quả theo quy ước xe của game — lib/props.py: gốc = tâm gầm trên mặt đất, đầu xe +X, cửa khách bên -Y):
  1. Nhập, đưa transform vào đỉnh; xoay 180° (đầu xe +X), đặt bánh xuống z 0, dời dọc thân để tâm cửa khách vẽ trên
     mô hình trùng tâm cửa cũ (props.BUS_DOOR_X) → TRIGGER_len_xe, SPAWN_, NPC_ ở cửa giữ nguyên.
  2. Cánh cửa: cắt mặt hông bên -Y theo khung cửa vẽ trên ảnh (DOOR_MODEL) → object riêng (gốc = bản lề mép trước, dày
     DOOR_T) để game đóng / mở; chỗ cắt thành hõm cửa tối có khung + 2 bậc lên xuống (bảng màu, gộp vào thân).
  3. Ảnh: sơn tím / xanh → trắng (thân) + đỏ (sọc) như xe cũ của game (bus_white #F4F4F4, bus_red #D7263D), giữ đổ bóng;
     xoá chữ thương hiệu, biển số nước ngoài, chữ chú thích của bản vẽ mẫu. Bỏ clearcoat: chất liệu M_bus_tex = ảnh ×
     vertex color "Color" (AO zone) → toon + viền nét như mọi vật. glTF xuất WebP.
  4. Đo vị trí biển số tuyến trên kính lái (tia dò mặt trước ở độ cao biển) và trên cửa → props.route_signs.
  Mỗi zone build 1 lần (build_meshes), các xe trong zone dùng chung lưới thân + lưới cánh cửa (instancing).
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from . import pool_table
from .mesh import MeshBuilder

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC_DIR = os.path.join(ROOT, "assets", "props", "bus", "source")
SRC = os.path.join(SRC_DIR, "bus_jb5_low_poly.glb")
TEX = os.path.join(SRC_DIR, "bus_tex.png")                   # sinh ra mỗi lần build (chỉ ở máy làm việc)
SOURCE_INFO = {"title": "Bus jb5 Low Poly", "author": "seenkonkgrng", "license": "CC BY 4.0",
               "url": "https://sketchfab.com/3d-models/bus-jb5-low-poly-fae01c4c820c4a7b958c3de2b3b011ab"}

DOOR_MODEL = (-4.46, -3.61, -0.70, 1.33)   # khung cửa khách vẽ trên ảnh: x trước, x sau, z đáy, z đỉnh (toạ độ mô hình)
DOOR_T = 0.04                              # độ dày cánh cửa (m)
WHITE, RED = (0.957, 0.957, 0.957), (0.843, 0.149, 0.239)
# vùng xoá trên ảnh 1024 × 512 (px, gốc trên-trái): chữ thương hiệu, biển số, chú thích bản vẽ → màu nền quanh đó
BLANK = [
    ((93, 98, 170, 112), "#202024"),       # chữ thương hiệu sau xe (bản xanh)
    ((498, 370, 512, 426), "#202024"),     # chữ thương hiệu trên nóc (đầu xe)
    ((118, 49, 148, 59), "#f4f4f4"),       # biển số sau xe (bản xanh)
    ((336, 266, 368, 277), "#f4f4f4"),     # biển số sau xe
    ((86, 244, 104, 252), "#f4f4f4"),      # huy hiệu đầu xe
    ((80, 0, 190, 20), "#000000"), ((690, 0, 760, 20), "#000000"), ((95, 210, 170, 230), "#000000"),
    ((295, 210, 405, 230), "#000000"), ((690, 178, 770, 198), "#000000"), ((455, 360, 482, 420), "#000000"),
    ((130, 460, 900, 510), "#000000"),     # chú thích bản vẽ mẫu ([BELAKANG], [KIRI], … , tiêu đề cuối ảnh)
]

_co = pool_table._co
_tris = pool_table._tris
_built = {}


def _rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


def load_source(collection):
    if not os.path.exists(SRC):
        raise FileNotFoundError(
            f"thiếu mô hình xe bus gốc: {os.path.relpath(SRC, ROOT)} — chép bus_jb5_low_poly.glb "
            f"(Sketchfab, seenkonkgrng, CC BY 4.0: {SOURCE_INFO['url']}) vào đây (file gốc không có trên repo)")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    meshes = [o for o in new if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"mô hình xe bus khác dự kiến: {[o.name for o in new]}")
    o = meshes[0]
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
    for c in list(o.users_collection):
        c.objects.unlink(o)
    collection.objects.link(o)
    for x in new:
        if x is not o:
            bpy.data.objects.remove(x)
    return o


def make_texture(src_img):
    """Sơn tím / xanh → trắng + đỏ theo độ sáng (thân sáng → trắng, sọc tối → đỏ), giữ đổ bóng; xoá vùng BLANK."""
    W, H = src_img.size
    px = pool_table._pixels(src_img)[..., :3].copy()               # (H, W, 3), hàng dưới trước
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    mx, mn = px.max(-1), px.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    w = np.clip((sat - 0.2) / 0.15, 0, 1) * ((hue > 180) & (hue < 320)) * np.clip((mx - 0.15) / 0.1, 0, 1)
    ref = np.where(hue > 250, 0.93, 0.85)                           # độ sáng thân xe: tím / xanh
    t = np.clip((mx / ref - 0.72) / 0.18, 0, 1)[..., None]          # 1 = thân sáng, 0 = sọc tối
    shade = np.clip(0.55 + 0.45 * np.clip(mx / ref, 0, 1.1), 0, 1.05)[..., None]
    col = (np.array(RED) * (1 - t) + np.array(WHITE) * t) * shade
    # điểm ảnh rất tối ở mép sơn (tím pha đen do khử răng cưa cạnh kính, khe cửa) → xám tối thay vì đỏ (khỏi viền đỏ răng cưa)
    edge = np.clip((mx / ref - 0.35) / 0.2, 0, 1)[..., None]
    col = col * edge + mx[..., None] * 0.6 * (1 - edge)
    px = px * (1 - w[..., None]) + np.clip(col, 0, 1) * w[..., None]
    for (x0, y0, x1, y1), c in BLANK:
        px[H - y1:H - y0, x0:x1] = _rgb(c)
    img = bpy.data.images.new("bus_tex", W, H, alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(np.concatenate([px, np.ones((H, W, 1))], -1).astype(np.float32).ravel())
    img.filepath_raw = TEX
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(TEX, check_existing=False)


def _side_faces(bm, side_y):
    return [f for f in bm.faces if f.normal.y < -0.9 and f.calc_center_median().y < side_y + 0.15]


def cut_door(obj, rect):
    """Cắt mặt hông bên -Y theo rect (x0, x1, z0, z1, toạ độ local) → (mesh cánh cửa, gốc = bản lề mép trước, y mặt hông)."""
    x0, x1, z0, z1 = rect
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    ys = [f.calc_center_median().y for f in bm.faces if f.normal.y < -0.9]
    side_y = float(np.percentile(ys, 5))                           # mặt hông ngoài cùng (bỏ gương)
    for co, no in (((x0, 0, 0), (1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, 0, z0), (0, 0, 1)), ((0, 0, z1), (0, 0, 1))):
        faces = _side_faces(bm, side_y)
        geom = list({e for f in faces for e in f.edges}) + faces + list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=co, plane_no=no)
    door = [f for f in _side_faces(bm, side_y)
            if x0 < f.calc_center_median().x < x1 and z0 < f.calc_center_median().z < z1]
    if not door:
        raise RuntimeError("không cắt được mặt cửa khách (DOOR_MODEL lệch khỏi mặt hông?)")
    y = float(np.mean([v.co.y for f in door for v in f.verts]))
    dm = bpy.data.meshes.new("cua_tmp")
    dbm = bmesh.new()
    uv_src = bm.loops.layers.uv.active
    uv_dst = dbm.loops.layers.uv.new("UVMap")
    vmap = {}
    for f in door:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = dbm.verts.new(v.co - Vector((x1, y, 0)))   # gốc = bản lề (mép trước ô cửa, sát mặt hông)
            vs.append(vmap[v])
        nf = dbm.faces.new(vs)
        for lo, ls in zip(nf.loops, f.loops):
            lo[uv_dst].uv = ls[uv_src].uv
    bmesh.ops.delete(bm, geom=door, context="FACES_ONLY")
    bm.to_mesh(obj.data)
    bm.free()
    # dày DOOR_T vào phía trong xe (+Y)
    ext = bmesh.ops.extrude_face_region(dbm, geom=list(dbm.faces))
    bmesh.ops.translate(dbm, vec=(0, DOOR_T, 0), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(dbm, faces=list(dbm.faces))
    dbm.to_mesh(dm)
    dbm.free()
    return dm, y


def doorway(rect, y):
    """Hõm cửa tối sau cánh cửa: tấm hậu, khung 4 cạnh, 2 bậc lên xuống (bảng màu, toạ độ local xe)."""
    x0, x1, z0, z1 = rect
    b = MeshBuilder()
    w, cx = x1 - x0, (x0 + x1) / 2
    b.box((cx, y + 0.5, (z0 + z1) / 2), (w, 0.04, z1 - z0), "black")              # vách trong
    for zz in (z0, z1):
        b.box((cx, y + 0.25, zz), (w, 0.5, 0.04), "black")                             # bậu dưới / trên
    for xx in (x0, x1):
        b.box((xx, y + 0.25, (z0 + z1) / 2), (0.04, 0.5, z1 - z0), "black")           # khung trước / sau
    for i in range(2):                                                                 # bậc lên xe
        b.box((cx, y + 0.12 + i * 0.18, z0 - 0.22 + i * 0.2), (w - 0.06, 0.26, 0.06), "lamp_black")
    return b


def _front_x(bvh, z):
    hit = bvh.ray_cast(Vector((20, 0, z)), Vector((-1, 0, 0)), 40)
    return hit[0].x if hit[0] else None


def body_box():
    """Khung thân xe thật (local, sau build_meshes): (x sau, x trước, nửa rộng, cao) — va chạm, kiểm tra đường chạy."""
    if not _built.get("bus"):
        raise RuntimeError("bus.body_box() gọi trước bus.build_meshes()")
    return _built["bus"][2]["body"]


def build_meshes(collection, door_x, log=print):
    """→ (lưới thân `bus_body`, lưới cánh cửa `bus_door`, thông tin: hinge, sign_front, sign_side, body (x0, x1, nửa rộng, cao))."""
    if _built.get("bus"):
        return _built["bus"]
    o = load_source(collection)
    src_tris = _tris(o)
    src_img = pool_table._base_image(o.data.materials[0])
    old_mats = set(o.data.materials)
    co = _co(o)
    mx0, mx1, mz0, mz1 = DOOR_MODEL
    shift = door_x + (mx0 + mx1) / 2                                 # sau xoay 180°: x → -x
    o.data.transform(Matrix.Translation((shift, 0, -co[:, 2].min())) @ Matrix.Rotation(math.pi, 4, "Z"))
    rect = (-mx1 + shift, -mx0 + shift, mz0 - co[:, 2].min(), mz1 - co[:, 2].min())
    img = make_texture(src_img)
    mat = pool_table.make_material(img, "M_bus_tex")
    pool_table.retexture(o, (0, 0, 1, 1), mat, atlas_size=(1, 1))
    door_me, side_y = cut_door(o, rect)
    # hõm cửa (bảng màu) gộp vào thân
    hole = doorway(rect, side_y).to_object("bus_hom_cua_tmp", collection)
    with bpy.context.temp_override(active_object=o, object=o, selected_objects=[o, hole], selected_editable_objects=[o, hole]):
        bpy.ops.object.join()
    door_me.materials.append(mat)
    col = door_me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", np.ones(len(door_me.loops) * 4, np.float32))
    door_me.shade_flat()
    for om in old_mats:
        if om and om.users == 0:
            bpy.data.materials.remove(om)
    for im in [i for i in bpy.data.images if i.users == 0]:
        bpy.data.images.remove(im)
    # biển số tuyến: mặt kính lái ở độ cao biển (z 2.77 … 3.19) → bảng đứng ngay trước kính, nghiêng theo kính
    me = o.data
    bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [p.vertices[:] for p in me.polygons])
    xa, xb = _front_x(bvh, 2.77), _front_x(bvh, 3.19)
    tilt = math.degrees(math.atan2(xa - xb, 0.42))
    sign_front = ((xa + xb) / 2 + 0.04, 2.98, tilt)
    sign_side = ((rect[0] + rect[1]) / 2, side_y - 0.035, rect[3] + 0.42)
    co = _co(o)
    low = co[co[:, 2] < 1.6]                                         # dưới tầm gương chiếu hậu "tai thỏ" (z 1.8–2.5)
    info = {"hinge": (rect[1], side_y, 0.0), "door_rect": rect, "sign_front": sign_front, "sign_side": sign_side,
            "body": (float(low[:, 0].min()), float(low[:, 0].max()), float(np.abs(low[:, 1]).max()), float(co[:, 2].max())),
            "tris": {"src": src_tris, "body": _tris(o), "door": sum(len(p.vertices) - 2 for p in door_me.polygons)},
            "source": SOURCE_INFO}
    body_me = o.data
    body_me.name = "bus_body"
    door_me.name = "bus_door"
    bpy.data.objects.remove(o)
    log(f"[xe bus] {src_tris} → thân {info['tris']['body']} + cửa {info['tris']['door']} tam giác; thân x "
        f"{info['body'][0]:.2f}..{info['body'][1]:.2f}, nửa rộng {info['body'][2]:.2f}, cao {info['body'][3]:.2f}; "
        f"cửa x {rect[0]:.2f}..{rect[1]:.2f} z {rect[2]:.2f}..{rect[3]:.2f}, mặt hông y {side_y:.3f}; biển trước x "
        f"{sign_front[0]:.2f} nghiêng {tilt:.1f}°")
    _built["bus"] = (body_me, door_me, info)
    return _built["bus"]
