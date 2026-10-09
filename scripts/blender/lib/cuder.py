"""Tượng Cuder (zone_02) từ mô hình Meshy: tượng + đống xu 0/1 + bệ vuông, dựng lại từ file gốc mỗi lần build zone.

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/cuder/source/cuder_meshy.glb
  (Meshy "Binary Boy", 105k tam giác, texture 2K gần như trắng đều — nét mặt nằm ở hình khối, không ở texture).
Tượng thật (theo mentor): CU (cucumber) + DER (coder); đầu to, kính tròn to, bụng tròn; hai tay chống lên đầu một cán
cuốc thẳng, đầu dưới cán cắm vào đống xu hình chữ số 0 và 1 phủ mặt bệ; không thấy lưỡi cuốc.

Các bước (toạ độ "gốc" = toạ độ Blender của file Meshy sau khi nhập: mặt nhìn -Y, cao 1,898):
  1. Gộp đỉnh trùng (Meshy tách đỉnh theo đường nối UV) → lưới liền, kín (0 cạnh hở, không mảnh rời).
  2. Bệ: cắt bỏ khối bệ Meshy (sau khi giảm tam giác nó thành vài tam giác to, AO nướng vào màu đỉnh loang thành
     mảng tối) → thay bằng hộp sạch cùng kích thước, chia lưới đều, vát cạnh nhẹ; đáy phẳng.
  3. Búi tóc tròn sau gáy (nhiều khả năng AI tự thêm, chờ xác nhận) → tách thành object riêng `<tên>_buitoc`,
     vá lỗ trên đầu → muốn bỏ chỉ cần build(keep_bun=False) hoặc xoá object đó.
  4. Giảm tam giác theo vùng (mỗi lượt chỉ giảm 1 vùng, vùng khác giữ — cùng cách --protect-face của nhân vật):
     mặt trước (mắt sau kính, nụ cười, gọng kính) và hai bàn tay trên cán giữ nhiều; bệ, mặt phẳng giảm mạnh.
  5. Cán cuốc: đo độ thẳng sau khi giảm; lệch quá HANDLE_TOL thì thay bằng hình trụ low-poly.
  6. Màu đá trắng (statue_white) qua vertex color như mọi vật trong zone; AO của zone tự nướng vào.
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

from .mesh import PAL_NAMES, finalize_mesh

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "assets", "props", "cuder", "source", "cuder_meshy.glb")

# búi tóc (toạ độ gốc): elip tâm / bán trục — đo trên ảnh cạnh và sau đầu có lưới toạ độ
BUN = ((0.0, 0.222, 0.862), (0.112, 0.098, 0.092))
# cán cuốc (toạ độ gốc): trục thẳng đứng x 0.0075, y -0.2185, bán kính 0.029; phần lộ giữa đống xu và bàn tay
HANDLE = {"x": 0.0075, "y": -0.2185, "r": 0.029, "z0": -0.40, "z1": 0.08}
HANDLE_TOL = 0.004          # m (sau khi đổi tỉ lệ): lệch khỏi trục quá mức này → thay bằng hình trụ

# số tam giác đích cho từng vùng (bản Thấp, tổng ~7k). Thứ tự = thứ tự giảm (vùng nhiều nhất trước)
TARGETS = {
    "coins_back": 300, "body": 1100, "coins_front": 600, "head_front": 2400, "head_back": 550,
    "hands": 600, "handle": 120,
}
# mặt trước đống xu: Meshy nặn số 0/1 chảy nhoè (cả ở bản 105k) → cắt mép trước, đặt 1 hàng số sắc nét (toạ độ gốc)
DIGITS = "010110"
FRONT_CUT_Y = -0.262         # bỏ phần đống xu nhô ra trước mặt phẳng này (mép trước bệ ở y -0.278)
DIGIT_H, DIGIT_W, DIGIT_T, DIGIT_D = 0.085, 0.052, 0.016, 0.022   # cao, rộng, nét, dày
BUN_TRIS = 120


def _regions(co, zbox=-1e9):
    """Nhãn vùng cho từng đỉnh (toạ độ gốc). Hộp bệ (z < zbox) không thuộc vùng nào → không bao giờ bị giảm."""
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    r = {}
    box = z < zbox
    coins = (z < -0.40) & ~box
    r["coins_front"] = coins & (y < -0.12)
    r["coins_back"] = coins & ~r["coins_front"]
    r["hands"] = (z >= 0.08) & (z < 0.32) & (y < -0.12)
    r["handle"] = (z >= HANDLE["z0"]) & (z < HANDLE["z1"]) & (np.hypot(x - HANDLE["x"], y - HANDLE["y"]) < HANDLE["r"] * 1.6)
    r["head_front"] = (z >= 0.45) & (y < -0.02)
    r["head_back"] = (z >= 0.45) & (y >= -0.02)
    rest = ~box
    for m in r.values():
        rest &= ~m
    r["body"] = rest
    return r


def load_source():
    if not os.path.exists(SRC):
        raise FileNotFoundError(
            f"Thiếu mô hình tượng Cuder: {SRC}\n"
            "  File gốc Meshy (Meshy_AI_Binary_Boy_..._texture.glb) không có trên repo — chép vào đúng đường dẫn trên "
            "(máy làm việc gốc) rồi build lại zone_02.")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"{SRC}: cần đúng 1 mesh, có {len(meshes)}")
    obj = meshes[0]
    for o in new:
        if o is not obj:
            bpy.data.objects.remove(o)
    obj.parent = None
    # bỏ chất liệu + ảnh của Meshy (gán đá trắng của zone sau); giữ UV
    old_mats = [m for m in obj.data.materials if m]
    obj.data.materials.clear()
    for m in old_mats:
        imgs = [n.image for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image] if m.node_tree else []
        bpy.data.materials.remove(m)
        for im in imgs:
            if im.users == 0:
                bpy.data.images.remove(im)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)       # nối lại các mảnh tách theo đường nối UV
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def cut_base(obj):
    """Cắt bỏ khối bệ Meshy (đo mặt cắt ngang gần đáy để biết kích thước hộp), lấp đáy đống xu. Trả (zmin, zcut, xy)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    co = np.array([v.co[:] for v in bm.verts])
    zmin = co[:, 2].min()
    ref = co[np.abs(co[:, 2] - (zmin + 0.06)) < 0.01]
    x0, x1, y0, y1 = ref[:, 0].min(), ref[:, 0].max(), ref[:, 1].min(), ref[:, 1].max()
    ztop = zmin + 0.06
    for zz in np.arange(zmin + 0.06, zmin + 0.6, 0.002):           # đỉnh hộp = nơi mặt cắt bắt đầu rộng ra (đống xu)
        m = np.abs(co[:, 2] - zz) < 0.003
        if not m.any():
            continue
        p = co[m]
        if p[:, 0].min() < x0 - 0.004 or p[:, 0].max() > x1 + 0.004 or p[:, 1].min() < y0 - 0.004 or p[:, 1].max() > y1 + 0.004:
            break
        ztop = zz
    zcut = ztop - 0.006
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, zcut),
                           plane_no=(0, 0, 1), clear_inner=True)
    edges = [e for e in bm.edges if e.is_boundary]
    if edges:
        new = bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]   # đáy đống xu (nằm trên mặt hộp, không thấy)
        bmesh.ops.triangulate(bm, faces=new)
    bm.to_mesh(obj.data)
    bm.free()
    return float(zmin), float(zcut), (float(x0), float(x1), float(y0), float(y1))


def add_box(obj, zmin, zcut, xy, cuts=2, bevel=0.004):
    """Hộp bệ sạch (vát cạnh nhẹ, lưới đều để AO nướng vào màu đỉnh không loang), cắm 1,2 cm vào đáy đống xu."""
    x0, x1, y0, y1 = xy
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    ret = bmesh.ops.create_cube(bm, size=1.0)
    bv = ret["verts"]
    for v in bv:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = zmin if v.co.z < 0 else zcut + 0.012
    faces = list({f for v in bv for f in v.link_faces})
    edges = list({e for f in faces for e in f.edges})
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=cuts, use_grid_fill=True)
    box_faces = [f for f in bm.faces if all(zmin - 1e-6 <= u.co.z <= zcut + 0.0121 and x0 - 1e-6 <= u.co.x <= x1 + 1e-6
                                            and y0 - 1e-6 <= u.co.y <= y1 + 1e-6 for u in f.verts) and
                 all(abs(u.co.x - x0) < 1e-6 or abs(u.co.x - x1) < 1e-6 or abs(u.co.y - y0) < 1e-6 or abs(u.co.y - y1) < 1e-6
                     or abs(u.co.z - zmin) < 1e-6 or abs(u.co.z - (zcut + 0.012)) < 1e-6 for u in f.verts)]
    if bevel:
        outer = [e for e in {e for f in box_faces for e in f.edges} if len(e.link_faces) == 2 and
                 e.link_faces[0].normal.dot(e.link_faces[1].normal) < 0.5]
        bmesh.ops.bevel(bm, geom=outer, offset=bevel, segments=1, affect="EDGES", profile=0.5)
    bm.to_mesh(obj.data)
    bm.free()


def cut_front_coins(obj, zcut):
    """Cắt phẳng mép trước đống xu (y < FRONT_CUT_Y, chỉ phần thấp hơn chân) và lấp lại — chỗ đặt hàng số."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    faces = [f for f in bm.faces if f.calc_center_median().z < -0.43]
    geom = list({v for f in faces for v in f.verts}) + list({e for f in faces for e in f.edges}) + faces
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, FRONT_CUT_Y, 0), plane_no=(0, -1, 0), clear_outer=True)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    edges = [e for e in bm.edges if e.is_boundary]
    if edges:
        new = bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]
        bmesh.ops.triangulate(bm, faces=new)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()


def add_digits(obj, z0, xy, pattern=DIGITS):
    """Hàng số 0/1 sắc nét đứng trên mép trước bệ, mặt nhìn -Y (0 = vòng elip, 1 = thanh đứng + móc + đế)."""
    x0, x1, y0, _ = xy
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    yc = FRONT_CUT_Y - DIGIT_D / 2 + 0.002
    pitch = (x1 - x0 - 0.04) / len(pattern)
    zc = z0 + DIGIT_H / 2

    def box(cx, cz, w, h, rot=0.0):
        ret = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w, DIGIT_D, h), verts=ret["verts"])
        if rot:
            bmesh.ops.rotate(bm, verts=ret["verts"], cent=(0, 0, 0), matrix=Matrix.Rotation(rot, 3, "Y"))
        bmesh.ops.translate(bm, verts=ret["verts"], vec=(cx, yc, cz))

    for i, ch in enumerate(pattern):
        cx = x0 + 0.02 + pitch * (i + 0.5)
        if ch == "0":
            n, ax, az = 14, DIGIT_W / 2 - DIGIT_T / 2, DIGIT_H / 2 - DIGIT_T / 2
            ring = []
            for k in range(n):
                a = 2 * math.pi * k / n
                d = Vector((math.cos(a) * ax, 0, math.sin(a) * az))
                nrm = Vector((math.cos(a) * az, 0, math.sin(a) * ax)).normalized()   # pháp tuyến elip
                for side in (-1, 1):
                    for depth in (-1, 1):
                        ring.append(bm.verts.new((cx + d.x + nrm.x * side * DIGIT_T / 2, yc + depth * DIGIT_D / 2,
                                                  zc + d.z + nrm.z * side * DIGIT_T / 2)))
            for k in range(n):
                a, b = ring[k * 4:(k + 1) * 4], ring[((k + 1) % n) * 4:((k + 1) % n + 1) * 4]
                for (p, q) in ((0, 1), (1, 3), (3, 2), (2, 0)):    # trong-trước, trong-sau... 4 mặt của nét
                    bm.faces.new((a[p], a[q], b[q], b[p]))
        else:
            box(cx, zc, DIGIT_T, DIGIT_H)                                       # thân
            box(cx - DIGIT_W * 0.22, z0 + DIGIT_H * 0.8, DIGIT_T * 0.9, DIGIT_H * 0.32, rot=math.radians(-50))  # móc
            box(cx, z0 + DIGIT_T / 2, DIGIT_W * 0.8, DIGIT_T)                   # đế
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()


def _sel_faces(bm, fn):
    return [f for f in bm.faces if fn(f.calc_center_median())]


def split_bun(obj, name):
    """Tách búi tóc thành object riêng; vá lỗ trên đầu (lõm nhẹ ra ngoài cho tròn đầu)."""
    (cx, cy, cz), (ax, ay, az) = BUN
    inside = lambda p: ((p.x - cx) / ax) ** 2 + ((p.y - cy) / ay) ** 2 + ((p.z - cz) / az) ** 2 < 1.0
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    faces = _sel_faces(bm, inside)
    # bản sao búi tóc
    bun_bm = bmesh.new()
    vmap = {}
    for f in faces:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = bun_bm.verts.new(v.co)
            vs.append(vmap[v])
        bun_bm.faces.new(vs)
    head_c = Vector((0.0, 0.03, 0.66))
    for v in bun_bm.verts:                                        # mép búi tóc lún 1,2 cm vào đầu (không lộ răng cưa)
        if any(e.is_boundary for e in v.link_edges):
            v.co = v.co + (head_c - v.co).normalized() * 0.012
    me = bpy.data.meshes.new(name)
    bun_bm.to_mesh(me)
    bun_bm.free()
    bun = bpy.data.objects.new(name, me)
    for c in obj.users_collection:
        c.objects.link(bun)
    # xoá khỏi thân + vá: lấp lỗ, chia nhỏ, chiếu các đỉnh trong mặt vá lên mặt cầu khớp với vùng đầu quanh lỗ
    bmesh.ops.delete(bm, geom=faces, context="FACES_ONLY")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    edges = [e for e in bm.edges if e.is_boundary]
    ring = {v for e in edges for v in e.verts}
    # mặt cầu khớp với cả phần sau đầu (trừ vùng quanh búi tóc) — vá theo độ cong chung của đầu
    allc = np.array([v.co[:] for v in bm.verts])
    ell = ((allc[:, 0] - cx) / (ax * 1.4)) ** 2 + ((allc[:, 1] - cy) / (ay * 1.4)) ** 2 + ((allc[:, 2] - cz) / (az * 1.4)) ** 2
    pts = allc[(allc[:, 2] > 0.55) & (allc[:, 1] > 0.05) & (ell > 1.0)]
    A = np.c_[2 * pts, np.ones(len(pts))]                         # x²+y²+z² = 2ax+2by+2cz+d
    sol = np.linalg.lstsq(A, (pts ** 2).sum(1), rcond=None)[0]
    centre = Vector(sol[:3])
    ring_c = [v.co.copy() for v in ring]
    ring_r = [(p - centre).length for p in ring_c]
    for v in bm.verts:                                            # đánh dấu đỉnh cũ (đỉnh mới của mặt vá: tag False)
        v.tag = True
    new = bmesh.ops.holes_fill(bm, edges=edges, sides=0)["faces"]
    poked = bmesh.ops.poke(bm, faces=new)
    patch = list(poked["faces"])
    bmesh.ops.subdivide_edges(bm, edges=list({e for f in patch for e in f.edges
                                              if not (e.verts[0] in ring and e.verts[1] in ring)}), cuts=2)
    inner = [v for v in bm.verts if not v.tag]                    # mọi đỉnh mới của mặt vá
    for v in inner:                       # bán kính = trung bình (trọng số 1/d²) bán kính các đỉnh mép → nối liền mép
        w = [1.0 / max((v.co - p).length_squared, 1e-8) for p in ring_c]
        r = sum(wi * ri for wi, ri in zip(w, ring_r)) / sum(w) - 0.006   # lùi 6 mm: nằm hẳn dưới búi tóc
        v.co = centre + (v.co - centre).normalized() * r
    for v in bm.verts:
        v.tag = False
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])          # mặt vá cùng chiều pháp tuyến với đầu
    bm.to_mesh(obj.data)
    bm.free()
    return bun, len(faces)


def _tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def _decimate(obj, ratio, keep_mask, strength=6.0):
    """1 lượt Decimate collapse: đỉnh keep_mask (True) được giữ, còn lại giảm tự do (vertex group đảo ngược)."""
    vg = obj.vertex_groups.new(name="_giu")
    idx = [int(i) for i in np.where(keep_mask)[0]]
    if idx:
        vg.add(idx, 1.0, "REPLACE")
    mod = obj.modifiers.new("giam", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = max(0.001, min(1.0, ratio))
    mod.use_collapse_triangulate = True
    mod.vertex_group = vg.name
    mod.invert_vertex_group = True
    mod.vertex_group_factor = strength
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    g = obj.vertex_groups.get("_giu")
    if g:
        obj.vertex_groups.remove(g)


def _co(obj):
    a = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", a)
    return a.reshape(-1, 3)


def _region_tris(obj, mask):
    n = 0
    for p in obj.data.polygons:
        if all(mask[v] for v in p.vertices):
            n += len(p.vertices) - 2
    return n


def decimate_regions(obj, targets, zbox):
    """Giảm lần lượt từng vùng về số tam giác đích; vùng khác (và hộp bệ) được giữ trong lượt đó."""
    report = {}
    for name, target in targets.items():
        m = _regions(_co(obj), zbox)[name]
        before = _region_tris(obj, m)
        total = _tris(obj)
        cut = before - target
        if cut > 0:
            _decimate(obj, (total - cut) / total, ~m)
        report[name] = (before, _region_tris(obj, _regions(_co(obj), zbox)[name]))
    return report


def handle_deviation(obj, scale):
    """Độ lệch lớn nhất (m) của các đỉnh cán cuốc khỏi trục thẳng (đo ở phần lộ giữa xu và tay)."""
    co = _co(obj)
    m = (co[:, 2] > HANDLE["z0"] + 0.03) & (co[:, 2] < HANDLE["z1"] - 0.15) & \
        (np.hypot(co[:, 0] - HANDLE["x"], co[:, 1] - HANDLE["y"]) < HANDLE["r"] * 1.6)
    if m.sum() < 8:
        return None, int(m.sum())
    d = np.hypot(co[m, 0] - HANDLE["x"], co[m, 1] - HANDLE["y"])
    # lệch so với mặt trụ lý tưởng (bán kính r)
    return float(np.abs(d - HANDLE["r"]).max() * scale), int(m.sum())


def replace_handle(obj, segments=8):
    """Xoá phần cán lộ ra, thay bằng hình trụ thẳng (cắm vào đống xu và vào tay)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    hx, hy, r = HANDLE["x"], HANDLE["y"], HANDLE["r"]
    z0, z1 = HANDLE["z0"] + 0.03, HANDLE["z1"] - 0.02
    sel = _sel_faces(bm, lambda p: z0 < p.z < z1 and math.hypot(p.x - hx, p.y - hy) < r * 1.4)
    bmesh.ops.delete(bm, geom=sel, context="FACES_ONLY")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r,
                                depth=HANDLE["z1"] - HANDLE["z0"] + 0.06)
    bmesh.ops.translate(bm, verts=ret["verts"], vec=(hx, hy, (HANDLE["z0"] + HANDLE["z1"]) / 2))
    bm.to_mesh(obj.data)
    bm.free()


def finish(obj, color="statue_white", smooth_angle=60):
    """Màu đá trắng qua vertex color (palette), cùng chất liệu với vật khác trong zone."""
    from . import materials
    me = obj.data
    if "pal" in me.attributes:
        me.attributes.remove(me.attributes["pal"])
    pal = me.attributes.new("pal", "INT", "FACE")
    pal.data.foreach_set("value", [PAL_NAMES.index(color)] * len(me.polygons))
    me.materials.clear()
    me.materials.append(materials.get("palette"))
    finalize_mesh(obj, smooth_angle)


def build(collection, name, location, height, keep_bun=True, targets=None, log=print):
    """Dựng tượng: trả (object tượng, object búi tóc | None, báo cáo). Gốc object = tâm đáy bệ, cao đúng `height`."""
    obj = load_source()
    obj.name = obj.data.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    src_tris = _tris(obj)
    base_zmin, base_cut, base_xy = cut_base(obj)
    cut_front_coins(obj, base_cut)
    bun, bun_faces = split_bun(obj, f"{name}_buitoc")
    rep = decimate_regions(obj, targets or TARGETS, zbox=-1e9)
    add_box(obj, base_zmin, base_cut, base_xy)                         # sau khi giảm: hộp giữ lưới đều
    add_digits(obj, base_cut + 0.012, base_xy)
    if bun.data.polygons:
        _decimate(bun, BUN_TRIS / max(_tris(bun), 1), np.zeros(len(bun.data.vertices), bool))
    # đổi tỉ lệ + đặt gốc ở tâm đáy bệ
    co = _co(obj)
    zmin, zmax = co[:, 2].min(), co[:, 2].max()
    base = co[co[:, 2] < zmin + 0.02]
    cx, cy = (base[:, 0].min() + base[:, 0].max()) / 2, (base[:, 1].min() + base[:, 1].max()) / 2
    s = height / (zmax - zmin)
    dev, n = handle_deviation(obj, s)
    replaced = dev is None or dev > HANDLE_TOL
    if replaced:
        replace_handle(obj)
    for o in (obj, bun):
        o.data.transform(Matrix.Translation((-cx, -cy, -zmin)))
        o.data.transform(Matrix.Scale(s, 4))
        o.location = location
    finish(obj)
    if keep_bun:
        finish(bun)
    else:
        bpy.data.objects.remove(bun)
        bun = None
    co = _co(obj)
    foot = co[co[:, 2] < 0.02]
    info = {
        "src_tris": src_tris, "tris": _tris(obj), "bun_tris": _tris(bun) if bun else 0, "scale": round(float(s), 4),
        "height_m": round(float(co[:, 2].max()), 3), "base_xy_m": [round(float(foot[:, 0].min()), 3), round(float(foot[:, 0].max()), 3),
                                                                   round(float(foot[:, 1].min()), 3), round(float(foot[:, 1].max()), 3)],
        "regions": rep, "bun_faces_src": bun_faces, "handle_dev_m": None if dev is None else round(dev, 4),
        "handle_replaced": replaced, "transform": {"offset": [float(-cx), float(-cy), float(-zmin)], "scale": float(s)},
    }
    log(f"[cuder] {src_tris} → {info['tris']} tam giác (+ búi tóc {info['bun_tris']}); cao {info['height_m']} m; "
        f"bệ x {info['base_xy_m'][:2]} y {info['base_xy_m'][2:]}; cán lệch {info['handle_dev_m']} m → "
        f"{'thay hình trụ' if replaced else 'giữ'}")
    for k, (a, b) in rep.items():
        log(f"[cuder]   {k:11s} {a:6d} → {b:5d}")
    return obj, bun, info
