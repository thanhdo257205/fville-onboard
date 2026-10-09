"""Dọn cảnh, tạo collection, bake AO, lưu .blend, xuất GLB, báo cáo."""
import json
import os

import bpy

from . import quality as Q
from .mesh import tri_count

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
GAME_PREFIXES = ("COL_", "INT_", "SPAWN_", "NPC_", "TRIGGER_", "CAM_", "PATH_")


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # không tạo file sao lưu .blend1
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    s.unit_settings.scale_length = 1.0


def collection(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in (parent or bpy.context.scene.collection).children:
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def bake_ao(objects, strength=0.6, samples=32, distance=2.5):
    """Bake AO vào vertex color: Color *= mix(1, AO, strength). Cần Cycles."""
    scene = bpy.context.scene
    prev = scene.render.engine
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.device = "CPU"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.light_settings.distance = distance
    # vật chuyển động (custom property "dynamic", vd xe bus chạy khỏi trạm): không che AO cho vật khác
    # (không để lại vệt tối trên đường khi xe đi), cũng không bake riêng — mesh dùng chung lấy AO từ bản tĩnh
    dynamic = [o for o in scene.objects if o.get("dynamic")]
    for o in dynamic:
        o.hide_render = True
    meshes, seen = [], set()
    for o in objects:  # object dùng chung mesh (instance) chỉ bake 1 lần, tránh nhân AO nhiều lần
        if o.get("dynamic"):
            continue
        if o.type == "MESH" and "Color" in o.data.color_attributes and o.data.name not in seen:
            seen.add(o.data.name)
            meshes.append(o)
    for o in meshes:
        me = o.data
        if "AO" in me.color_attributes:
            me.color_attributes.remove(me.color_attributes["AO"])
        ao = me.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = ao
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    for o in meshes:
        me = o.data
        col, ao = me.color_attributes["Color"], me.color_attributes["AO"]
        n = len(me.loops)
        c = [0.0] * n * 4
        a = [0.0] * n * 4
        col.data.foreach_get("color_srgb", c)
        ao.data.foreach_get("color", a)  # AO tuyến tính 0..1
        for i in range(n):
            f = 1.0 - strength * (1.0 - a[i * 4])
            for k in range(3):
                c[i * 4 + k] *= f
        col.data.foreach_set("color_srgb", c)
        me.color_attributes.remove(ao)
        me.color_attributes.active_color = me.color_attributes["Color"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in dynamic:
        o.hide_render = False
    scene.render.engine = prev


def out_path(kind, name):
    """assets/<kind>/<low|high>/<name> — mỗi mức đồ hoạ một thư mục."""
    return os.path.join(ROOT, "assets", kind, Q.TIER, name)


def save_and_export(zone):
    blend = out_path("blend", f"{zone}.blend")
    glb_raw = out_path("glb", f"{zone}.raw.glb")
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    os.makedirs(os.path.dirname(glb_raw), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(
        filepath=glb_raw,
        export_format="GLB",
        export_apply=True,
        export_extras=True,
        export_yup=True,
        export_vertex_color="MATERIAL",
        export_cameras=False,
        export_lights=False,
        use_selection=False,
        use_visible=False,
        export_materials="EXPORT",
        export_image_format="WEBP",   # texture → WebP (EXT_texture_webp, Three.js hỗ trợ sẵn)
        export_image_quality=85,
    )
    return blend, glb_raw


def report(zone):
    objs = list(bpy.context.scene.objects)
    tris = sum(tri_count(o) for o in objs if not o.name.startswith("COL_"))
    col_tris = sum(tri_count(o) for o in objs if o.name.startswith("COL_"))
    mats = sorted({m.name for o in objs if o.type == "MESH" for m in o.data.materials if m})
    game = {p: sorted(o.name for o in objs if o.name.startswith(p)) for p in GAME_PREFIXES}
    labels = {o.name: o.get("label") for o in objs if "label" in o}
    info = {"zone": zone, "quality": Q.TIER, "triangles_visible": tris, "triangles_collision": col_tris,
            "materials": mats, "objects": len(objs), "game_objects": game, "labels": labels}
    path = out_path("glb", f"{zone}.report.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    print(json.dumps(info, ensure_ascii=False, indent=2))
    return info
