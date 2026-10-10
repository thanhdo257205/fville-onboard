"""Bàn bi-a zone_05 từ mô hình Sketchfab, dựng lại từ file gốc mỗi lần build zone (cùng cách tượng Cuder).

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/pool_table/source/pool_table_traditional.glb
  "Pool Table Traditional" — fizyman, CC BY 4.0
  https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977 (glTF asset.extras)
  Bàn 1,41 × 2,49 m, cao 0,82 m (đúng tỉ lệ thật), trục dài theo Y; 16 bi + 2 cây cơ + đèn treo là vật riêng.

Các bước:
  1. Nhập, đưa transform vào đỉnh, bỏ empty; bỏ đèn treo (ceiling_light: chất liệu phát sáng, lưới + ảnh nặng).
  2. Đo trên lưới gốc (trước khi giảm): mặt nỉ, mũi băng (mặt chơi trong băng), 6 lỗ (tia chiếu xuống: chỗ bề mặt cao
     nhất thấp hơn mặt nỉ = miệng lỗ), bán kính bi, vị trí xếp bi.
  3. Gộp ảnh màu của bàn + bi + cơ thành 1 atlas (ATLAS_SIZE), dồn UV vào ô tương ứng; bỏ normal / metallic-roughness /
     transmission / alpha (lưới túi lỗ thành đục). Chất liệu M_pool_tex = atlas × vertex color "Color" (trắng, AO của zone
     nướng vào) → game đổi sang toon + viền nét như mọi vật trong zone; glTF xuất ảnh WebP.
  4. Giảm lưới bàn theo từng mảnh liền (chân tiện, mặt nỉ + băng, thanh viền, nắp lỗ, lưới túi lỗ, yếm): mỗi lượt chỉ
     giảm 1 loại, loại khác giữ (vertex group đảo ngược như cuder.py). Bi, cơ giữ nguyên.
  5. Đặt tên: bàn `<name>` (gốc = tâm bàn trên sàn), con của bàn: `ball_0` (bi trắng) … `ball_15` (gốc = tâm bi),
     `cue` (cơ dựng cạnh bàn), `cue_2` (cơ nằm trên mặt nỉ, KEEP_SECOND_CUE). Bi + cơ có custom property `dynamic`
     (không che AO, không nướng AO — sau này lăn / cầm được).
"""
import math
import os
import re

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC_DIR = os.path.join(ROOT, "assets", "props", "pool_table", "source")
SRC = os.path.join(SRC_DIR, "pool_table_traditional.glb")
ATLAS = os.path.join(SRC_DIR, "pool_table_atlas.png")      # sinh ra mỗi lần build (chỉ ở máy làm việc)
SOURCE_INFO = {"title": "Pool Table Traditional", "author": "fizyman", "license": "CC BY 4.0",
               "url": "https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977"}

# atlas 1024 × 768 (px, gốc dưới-trái như UV): bàn 768², bi 256 × 512 (3 cột × 6 hàng ô ≈ 85 px/bi), cơ 256²
ATLAS_SIZE = (1024, 768)
RECTS = {"table": (0, 0, 768, 768), "ball": (768, 0, 256, 512), "cue": (768, 512, 256, 256)}
# tỉ lệ giữ tam giác theo loại mảnh của bàn (19.954 tam giác gốc)
RATIOS = {"leg": 0.28, "bed": 0.5, "rail": 0.45, "cap": 0.55, "net": 0.6, "apron": 1.0}
KEEP_SECOND_CUE = True
SMOOTH_DEG = 35


# ---------- tiện ích ----------
def _tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def _co(obj):
    a = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", a)
    return a.reshape(-1, 3)


def _pixels(img):
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def _resized(img, w, h):
    tmp = img.copy()
    tmp.scale(w, h)
    px = _pixels(tmp)
    bpy.data.images.remove(tmp)
    return px


def _base_image(mat):
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    link = bsdf.inputs["Base Color"].links
    if not link or link[0].from_node.type != "TEX_IMAGE":
        raise RuntimeError(f"{mat.name}: Base Color không nối từ ảnh")
    return link[0].from_node.image


def load_source(collection):
    """Nhập GLB vào `collection`, transform vào đỉnh. → {"table", "light", "balls": {số: obj}, "cues": [obj]}"""
    if not os.path.exists(SRC):
        raise FileNotFoundError(
            f"thiếu mô hình bàn bi-a gốc: {os.path.relpath(SRC, ROOT)} — chép pool_table_traditional.glb "
            f"(Sketchfab, fizyman, CC BY 4.0: {SOURCE_INFO['url']}) vào đây (file gốc không có trên repo)")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    parts = {"table": None, "light": None, "balls": {}, "cues": []}
    for o in meshes:
        n = o.name
        if n.startswith("pooltable"):
            parts["table"] = o
        elif n.startswith("ceiling_light"):
            parts["light"] = o
        elif n.startswith("pool_cue"):
            parts["cues"].append(o)
        elif n.startswith("billiard_ball"):
            # billiard_ball = bi 1, billiard_ball001…014 = bi 2…15, billiard_ball015 = bi trắng (đo màu atlas: ô
            # hàng 0–2 bi trơn vàng / xanh / đỏ / tím / cam / lục / nâu / đen, hàng 2–4 bi sọc, hàng 5 bi trắng)
            m = re.match(r"billiard_ball(\d{3})?_", n)
            k = int(m.group(1)) + 1 if m.group(1) else 1
            parts["balls"][0 if k == 16 else k] = o
    if parts["table"] is None or len(parts["balls"]) != 16 or len(parts["cues"]) != 2:
        raise RuntimeError(f"mô hình bàn bi-a khác dự kiến: {[o.name for o in meshes]}")
    return parts


# ---------- đo ----------
def measure(table, balls):
    """Đo trên lưới gốc (toạ độ mô hình: tâm bàn trên sàn, trục dài Y, Z lên)."""
    me = table.data
    bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [p.vertices[:] for p in me.polygons])
    radius = float(np.mean([np.ptp(_co(b), axis=0).max() / 2 for b in balls.values()]))

    def down(x, y):
        hit = bvh.ray_cast(Vector((x, y, 2.0)), Vector((0, 0, -1)), 3.0)
        return None if hit[0] is None else hit[0].z
    cloth = down(0.0, 0.0)
    zc = cloth + radius                                                  # cao tâm bi
    # mũi băng ở độ cao tâm bi: tia ngang từ trục bàn, lệch khỏi lỗ giữa (y = 0) và lỗ góc → lấy khoảng ngắn nhất
    nose = {}
    for k, d, offs in (("x+", (1, 0, 0), (-0.5, -0.3, 0.3, 0.5)), ("x-", (-1, 0, 0), (-0.5, -0.3, 0.3, 0.5)),
                       ("y+", (0, 1, 0), (-0.3, 0.0, 0.3)), ("y-", (0, -1, 0), (-0.3, 0.0, 0.3))):
        ds = []
        for o in offs:
            start = Vector((0, o, zc)) if k[0] == "x" else Vector((o, 0, zc))
            hit = bvh.ray_cast(start, Vector(d), 3.0)
            if hit[0] is not None:
                ds.append(float(hit[3]))
        nose[k] = min(ds) if ds else None
    # lỗ: lưới tia chiếu xuống; bề mặt cao nhất thấp hơn mặt nỉ (lưới túi bên dưới) = miệng lỗ
    co = _co(table)
    step = 0.005
    xs = np.arange(co[:, 0].min(), co[:, 0].max(), step)
    ys = np.arange(co[:, 1].min(), co[:, 1].max(), step)
    hole = np.zeros((len(ys), len(xs)), bool)
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            z = down(float(x), float(y))
            hole[j, i] = z is not None and z < cloth - 0.004
    lab = np.zeros(hole.shape, int)
    pockets, cur = [], 0
    for j, i in zip(*np.where(hole)):
        if lab[j, i]:
            continue
        cur += 1
        stack, cells = [(j, i)], []
        lab[j, i] = cur
        while stack:
            a, b = stack.pop()
            cells.append((a, b))
            for da in (-1, 0, 1):
                for db in (-1, 0, 1):
                    p, q = a + da, b + db
                    if 0 <= p < hole.shape[0] and 0 <= q < hole.shape[1] and hole[p, q] and not lab[p, q]:
                        lab[p, q] = cur
                        stack.append((p, q))
        if len(cells) * step * step < 0.0015:                              # vụn (khe nhỏ), không phải lỗ
            continue
        c = np.array(cells)
        px, py = xs[c[:, 1]], ys[c[:, 0]]
        pockets.append({"center": [float(px.mean()), float(py.mean())],
                        "radius": float(math.sqrt(len(cells) * step * step / math.pi)),
                        "radius_max": float(np.hypot(px - px.mean(), py - py.mean()).max() + step / 2)})
    rack = {k: [float(v) for v in (_co(b).max(0) + _co(b).min(0)) / 2] for k, b in balls.items()}
    return {"cloth_z": float(cloth), "ball_radius": radius, "ball_center_z": float(zc), "nose": nose,
            "play": {"x": [-nose["x-"], nose["x+"]], "y": [-nose["y-"], nose["y+"]]},
            "pockets": pockets, "balls": rack, "table_bounds": [co.min(0).tolist(), co.max(0).tolist()]}


# ---------- atlas + chất liệu ----------
def make_atlas(parts):
    W, H = ATLAS_SIZE
    atlas = np.ones((H, W, 4), np.float32)
    srcs = {"table": _base_image(parts["table"].data.materials[0]),
            "ball": _base_image(next(iter(parts["balls"].values())).data.materials[0]),
            "cue": _base_image(parts["cues"][0].data.materials[0])}
    for k, (x, y, w, h) in RECTS.items():
        atlas[y:y + h, x:x + w, :3] = _resized(srcs[k], w, h)[..., :3]
    img = bpy.data.images.new("pool_table_atlas", W, H, alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(atlas.ravel())
    img.filepath_raw = ATLAS
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(ATLAS, check_existing=False)


def make_material(img):
    mat = bpy.data.materials.new("M_pool_tex")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Linear"
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    a, b = [s for s in mix.inputs if s.type == "RGBA"][:2]
    nt.links.new(tex.outputs["Color"], a)
    nt.links.new(attr.outputs["Color"], b)
    nt.links.new(next(s for s in mix.outputs if s.type == "RGBA"), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def retexture(obj, rect, mat):
    """UV → ô `rect` của atlas; 1 chất liệu; vertex color trắng (AO nướng sau); bóng mượt theo góc."""
    W, H = ATLAS_SIZE
    x, y, w, h = rect
    me = obj.data
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = np.clip(uv.reshape(-1, 2), 0.0, 1.0)
    uv[:, 0] = (x + uv[:, 0] * w) / W
    uv[:, 1] = (y + uv[:, 1] * h) / H
    me.uv_layers.active.data.foreach_set("uv", uv.ravel())
    for extra in [u for u in me.uv_layers if u != me.uv_layers.active]:
        me.uv_layers.remove(extra)
    me.materials.clear()
    me.materials.append(mat)
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", np.ones(len(me.loops) * 4, np.float32))
    if me.has_custom_normals:                                       # pháp tuyến từ glTF: sai sau khi giảm lưới
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(SMOOTH_DEG))


# ---------- giảm lưới bàn ----------
def _kinds(obj):
    """Loại mảnh cho từng đỉnh, theo hộp bao của mảnh liền chứa đỉnh đó."""
    me = obj.data
    co = _co(obj)
    e = np.empty(len(me.edges) * 2, np.int64)
    me.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    lab = np.arange(len(co))
    while True:
        old = lab.copy()
        np.minimum.at(lab, e[:, 0], lab[e[:, 1]])
        np.minimum.at(lab, e[:, 1], lab[e[:, 0]])
        lab = lab[lab]
        if (lab == old).all():
            break
    kinds = np.empty(len(co), object)
    for i in np.unique(lab):
        m = lab == i
        lo, hi = co[m].min(0), co[m].max(0)
        foot = max(hi[0] - lo[0], hi[1] - lo[1])
        if lo[2] < 0.05:
            k = "leg"
        elif hi[2] < 0.79 and foot < 0.2:
            k = "net"
        elif lo[2] >= 0.7 and foot < 0.2:
            k = "cap"
        elif lo[2] >= 0.7:
            k = "bed"
        elif lo[2] >= 0.6:
            k = "rail"
        else:
            k = "apron"
        kinds[m] = k
    return kinds


def _decimate(obj, ratio, keep_mask, strength=6.0):
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


def _kind_tris(obj, kinds):
    out = {}
    for p in obj.data.polygons:
        k = kinds[p.vertices[0]]
        out[k] = out.get(k, 0) + len(p.vertices) - 2
    return out


def decimate_table(obj, ratios=RATIOS):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)       # Sketchfab tách đỉnh theo đường nối UV
    bm.to_mesh(obj.data)
    bm.free()
    kinds = _kinds(obj)
    before = _kind_tris(obj, kinds)
    for k, r in sorted(ratios.items(), key=lambda kv: -before.get(kv[0], 0)):
        if r >= 1.0 or not before.get(k):
            continue
        kinds = _kinds(obj)
        n_kind, total = _kind_tris(obj, kinds).get(k, 0), _tris(obj)
        target = int(before[k] * r)
        if n_kind <= target:
            continue
        _decimate(obj, (total - (n_kind - target)) / total, kinds != k)
    kinds = _kinds(obj)
    after = _kind_tris(obj, kinds)
    return {k: [before.get(k, 0), after.get(k, 0)] for k in before}


# ---------- dựng ----------
def build(collection, name, location, yaw_deg=0.0, keep_second_cue=KEEP_SECOND_CUE, log=print):
    """Dựng bàn tại `location` (toạ độ Blender, z = sàn), xoay `yaw_deg` quanh Z (0 = trục dài theo Y).
    → (object bàn, {tên: object con}, báo cáo + số đo theo toạ độ mô hình)."""
    parts = load_source(collection)
    src_tris = {"table": _tris(parts["table"]), "light": _tris(parts["light"]),
                "balls": sum(_tris(b) for b in parts["balls"].values()), "cues": sum(_tris(c) for c in parts["cues"])}
    m = measure(parts["table"], parts["balls"])
    # đèn treo: bỏ hẳn (mesh + chất liệu + ảnh không còn ai dùng thì exporter không xuất)
    light = parts.pop("light")
    if light:
        bpy.data.objects.remove(light)
    img = make_atlas(parts)
    old_mats = {s for o in [parts["table"], *parts["balls"].values(), *parts["cues"]] for s in o.data.materials}
    mat = make_material(img)
    retexture(parts["table"], RECTS["table"], mat)
    for b in parts["balls"].values():
        retexture(b, RECTS["ball"], mat)
    for c in parts["cues"]:
        retexture(c, RECTS["cue"], mat)
    for om in old_mats:
        if om and om.users == 0:
            bpy.data.materials.remove(om)
    for im in [i for i in bpy.data.images if i.users == 0 and i != img]:
        bpy.data.images.remove(im)
    dec = decimate_table(parts["table"])
    parts["table"].data.shade_smooth()
    parts["table"].data.set_sharp_from_angle(angle=math.radians(SMOOTH_DEG))

    table = parts["table"]
    table.name = table.data.name = name
    table.location = location
    table.rotation_mode = "XYZ"                 # trình nhập glTF đặt QUATERNION → rotation_euler không có tác dụng
    table.rotation_euler = (0, 0, math.radians(yaw_deg))
    children = {}
    # cơ: dựng cạnh bàn (cao theo Z) → cue; nằm trên mặt nỉ → cue_2
    cues = sorted(parts["cues"], key=lambda c: -np.ptp(_co(c)[:, 2]))
    if not keep_second_cue:
        bpy.data.objects.remove(cues.pop())
    for k, o in [(f"ball_{n}", parts["balls"][n]) for n in range(16)] + list(zip(("cue", "cue_2"), cues)):
        co = _co(o)
        c = (co.max(0) + co.min(0)) / 2
        o.data.transform(Matrix.Translation(Vector(-c)))           # gốc = tâm (bi lăn quanh tâm)
        o.name = o.data.name = k
        o.parent = table
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.rotation_mode = "XYZ"
        o.location = Vector(c)                                      # toạ độ cục bộ của bàn = toạ độ mô hình
        o["dynamic"] = True
        children[k] = o
    bpy.context.view_layer.update()
    w = [table.matrix_world @ Vector(p) for p in m["table_bounds"]]
    for k in ("cue", "cue_2"):
        if k in children:
            o = children[k]
            w += [o.matrix_world @ v.co for v in o.data.vertices]
    info = {"src_tris": src_tris, "tris": {"table": _tris(table), "balls": sum(_tris(children[f"ball_{n}"]) for n in range(16)),
                                           "cues": sum(_tris(o) for k, o in children.items() if k.startswith("cue"))},
            "decimate": dec, "measure": m, "location": list(location), "yaw_deg": yaw_deg,
            "atlas": {"size": list(ATLAS_SIZE), "rects": RECTS}, "source": SOURCE_INFO,
            # vùng va chạm: mặt bằng gồm bàn + 2 cây cơ (cơ dựng cạnh bàn nhô ra ngoài mép băng), cao = mặt bàn
            "world_bounds": [[min(p[i] for p in w) for i in range(3)],
                             [max(p[0] for p in w), max(p[1] for p in w), float(m["table_bounds"][1][2])]]}
    log(f"[bàn bi-a] bàn {src_tris['table']} → {info['tris']['table']} tam giác "
        f"({', '.join(f'{k} {a}→{b}' for k, (a, b) in dec.items())}); bi {info['tris']['balls']}, cơ {info['tris']['cues']}; "
        f"bỏ đèn treo {src_tris['light']}")
    log(f"[bàn bi-a] mặt nỉ z {m['cloth_z']:.4f}, bi r {m['ball_radius']:.4f}, mặt chơi trong băng "
        f"x {m['play']['x']} y {m['play']['y']}; {len(m['pockets'])} lỗ")
    return table, children, info
