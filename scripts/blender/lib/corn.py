"""Cây ngô quanh tượng Cuder (zone_02) từ mô hình Sketchfab, dựng lại bản nhẹ từ file gốc mỗi lần build zone (cùng cách cây,
bụi tre).

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/corn/source/maize_corn_plant.glb
  "Maize Corn Plant" — gilles.schaeck, CC BY 4.0
  https://sketchfab.com/3d-models/maize-corn-plant-5fd3b104d8104519b061469c365d4974 (glTF asset.extras)
  1 cây cao 2,65 m, 42 mảnh, 3.108 tam giác, 3 chất liệu: Maize (lá, 1.120 tam giác), Maize_2 (thân + bắp, 1.392), Maize_alpha
  (cờ ngô + râu, alpha BLEND, 596); mỗi chất liệu 3 ảnh 1024² (màu, ORM, normal) — 5,4 MB.

Các bước:
  1. Nhập, đưa transform vào đỉnh, gộp 42 mảnh thành 1 lưới; gốc = tâm gốc thân trên mặt đất.
  2. Atlas ATLAS_SIZE: chỉ ảnh màu của 3 chất liệu, mỗi ảnh 1 ô (UV gốc đều trong 0..1 → dồn vào ô, không cần lặp); ô cờ ngô
     giữ alpha, 2 ô kia alpha = 1. Bỏ ảnh ORM / normal (game tô toon, chỉ dùng màu).
  3. 1 chất liệu M_corn = ảnh × vertex color "Color" (AO zone), alpha cắt (Math Round → glTF MASK 0,5 — không blend, không lỗi
     thứ tự vẽ), 2 mặt, custom property outline = False (game không vẽ viền nét, như cây).
  4. Giảm lưới DECIMATE (collapse) → ~RATIO số tam giác; pháp tuyến hướng từ trục thân ra ngoài (+ chút hướng lên) → cả
     khóm sáng / tối mềm như khối khi tô toon (lá phẳng giữ pháp tuyến riêng thì loang lổ, mặt sau lá tối).
  5. place(): bản sao dùng chung lưới (instancing), xoay + co giãn theo hạt giống riêng; custom property batch → game gộp các
     bản sao thành 1 lượt vẽ (world/zone.js batchInstances), mỗi cây 1 số riêng để làm mờ khi che camera.
"""
import math
import os
import random

import bpy
import numpy as np
from mathutils import Matrix

from . import pool_table

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC_DIR = os.path.join(ROOT, "assets", "props", "corn", "source")
SRC = os.path.join(SRC_DIR, "maize_corn_plant.glb")
ATLAS = os.path.join(SRC_DIR, "corn_atlas.png")               # sinh ra mỗi lần build (chỉ ở máy làm việc)
SOURCE_INFO = {"title": "Maize Corn Plant", "author": "gilles.schaeck", "license": "CC BY 4.0",
               "url": "https://sketchfab.com/3d-models/maize-corn-plant-5fd3b104d8104519b061469c365d4974"}

ATLAS_SIZE = (512, 512)
CELLS = {"Maize": (0, 0, 256, 256), "Maize_2": (256, 0, 256, 256), "Maize_alpha": (0, 256, 256, 256)}
RATIO = 0.4                  # giảm lưới: giữ ~40 % tam giác (3.108 → ~1.250)
NORMAL_UP = 0.45             # pháp tuyến = hướng ngang từ trục thân + NORMAL_UP × trục z, chuẩn hoá
BATCH = "ENV_cay_ngo"        # tên nhóm gộp trong game (khớp see_through.meshes "^ENV_(vegetation|cay_)")
SEED = 2026
_built = {}

_co = pool_table._co
_tris = pool_table._tris


def load_source(collection):
    """Nhập GLB vào `collection`, transform vào đỉnh, gộp thành 1 object. → obj"""
    if not os.path.exists(SRC):
        raise FileNotFoundError(
            f"thiếu mô hình cây ngô gốc: {os.path.relpath(SRC, ROOT)} — chép maize_corn_plant.glb "
            f"(Sketchfab, gilles.schaeck, CC BY 4.0: {SOURCE_INFO['url']}) vào đây (file gốc không có trên repo)")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    meshes = []
    for o in new:
        if o.type != "MESH":
            continue
        mw = o.matrix_world.copy()
        o.parent = None
        o.data = o.data.copy()                                       # mảnh dùng chung lưới → tách trước khi transform
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)
        meshes.append(o)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    if not meshes:
        raise RuntimeError("mô hình cây ngô không có lưới")
    with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, selected_objects=meshes):
        bpy.ops.object.join()
    obj = meshes[0]
    obj.name = "cay_ngo_src"
    return obj


def make_atlas(obj):
    """Ảnh màu 3 chất liệu → atlas (ô cờ ngô giữ alpha). → (ảnh, {tên chất liệu: ô})"""
    W, H = ATLAS_SIZE
    atlas = np.ones((H, W, 4), np.float32)
    for m in obj.data.materials:
        key = m.name.split(".")[0]
        if key not in CELLS:
            raise RuntimeError(f"chất liệu lạ trong mô hình cây ngô: {m.name}")
        x, y, w, h = CELLS[key]
        px = pool_table._resized(pool_table._base_image(m), w, h)
        atlas[y:y + h, x:x + w, :3] = px[..., :3]
        if key == "Maize_alpha":
            atlas[y:y + h, x:x + w, 3] = px[..., 3]
    img = bpy.data.images.new("corn_atlas", W, H, alpha=True)
    img.colorspace_settings.name = "sRGB"
    img.alpha_mode = "STRAIGHT"
    img.pixels.foreach_set(atlas.ravel())
    img.filepath_raw = ATLAS
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(ATLAS, check_existing=False)


def corn_material(img):
    """Ảnh × vertex color, alpha cắt (Math Round → glTF MASK), 2 mặt, không viền nét (custom property)."""
    mat = pool_table.make_material(img, "M_corn")
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
    rnd = nt.nodes.new("ShaderNodeMath")
    rnd.operation = "ROUND"
    nt.links.new(tex.outputs["Alpha"], rnd.inputs[0])
    nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    mat.use_backface_culling = False
    try:
        mat.surface_render_method = "DITHERED"
    except (AttributeError, TypeError):
        pass
    mat["outline"] = False
    return mat


def build(collection, name="cay_ngo", log=print):
    """Lưới cây ngô dùng chung (gốc = tâm gốc thân trên mặt đất). → (mesh, chiều cao m)"""
    if name in _built:
        return _built[name]
    obj = load_source(collection)
    src_tris = _tris(obj)
    me = obj.data
    old_mats = list(me.materials)
    img = make_atlas(obj)
    mat = corn_material(img)
    # UV → ô atlas theo chất liệu gốc của từng mặt
    W, H = ATLAS_SIZE
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = np.clip(uv.reshape(-1, 2), 0.0, 1.0)
    for p in me.polygons:
        x, y, w, h = CELLS[me.materials[p.material_index].name.split(".")[0]]
        li = list(p.loop_indices)
        uv[li, 0] = (x + uv[li, 0] * w) / W
        uv[li, 1] = (y + uv[li, 1] * h) / H
    me.uv_layers.active.data.foreach_set("uv", uv.ravel())
    for extra in [u for u in me.uv_layers if u != me.uv_layers.active]:
        me.uv_layers.remove(extra)
    me.materials.clear()
    me.materials.append(mat)
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    if me.has_custom_normals:
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    # giảm lưới (giữ đường nối UV: các ô atlas không bị kéo sang nhau)
    mod = obj.modifiers.new("giam", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = RATIO
    mod.use_collapse_triangulate = True
    mod.delimit = {"UV", "SEAM"}
    bpy.context.view_layer.objects.active = obj
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # gốc = tâm gốc thân trên mặt đất
    co = _co(obj)
    z0 = co[:, 2].min()
    foot = co[co[:, 2] < z0 + 0.15][:, :2].mean(0)
    me.transform(Matrix.Translation((-foot[0], -foot[1], -z0)))
    col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", np.ones(len(me.loops) * 4, np.float32))
    me.shade_smooth()
    # pháp tuyến: hướng ngang từ trục thân (x = y = 0) ra + NORMAL_UP lên trên
    co = _co(obj)
    loop_v = np.empty(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", loop_v)
    d = co[loop_v].copy()
    d[:, 2] = 0.0
    r = np.linalg.norm(d, axis=1, keepdims=True)
    d = np.where(r > 1e-3, d / np.maximum(r, 1e-6), np.array([0.0, -1.0, 0.0]))
    d[:, 2] = NORMAL_UP
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    me.normals_split_custom_set([tuple(n) for n in d])
    me.name = name
    h = float(co[:, 2].max())
    log(f"[ngô] {name}: {src_tris} → {_tris(obj)} tam giác, cao {h:.2f} m, atlas {ATLAS_SIZE[0]}×{ATLAS_SIZE[1]} "
        f"(bỏ ảnh ORM / normal, 9 ảnh 1024² → 1)")
    bpy.data.objects.remove(obj)
    for om in old_mats:
        if om and om.users == 0:
            bpy.data.materials.remove(om)
    for im in [i for i in bpy.data.images if i.users == 0]:
        bpy.data.images.remove(im)
    _built[name] = (me, h)
    return me, h


def place(collection, spots, height=2.1, log=print):
    """Bản sao cây ngô tại `spots` [(x, y, z)]: cao ~height m (± 8 %), xoay ngẫu nhiên. → [object]"""
    me, mh = build(collection, log=log)
    rng = random.Random(SEED)
    objs = []
    for i, (x, y, z) in enumerate(spots):
        s = height / mh * rng.uniform(0.92, 1.08)
        o = bpy.data.objects.new(f"{BATCH}_{i:02d}", me)
        collection.objects.link(o)
        o.location = (x, y, z)
        o.rotation_euler = (0, 0, rng.uniform(0, 2 * math.pi))
        o.scale = (s, s, s)
        o["batch"] = BATCH
        objs.append(o)
    log(f"[ngô] {len(objs)} cây dùng chung lưới {me.name} ({_tris_mesh(me)} tam giác)")
    return objs


def _tris_mesh(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)
