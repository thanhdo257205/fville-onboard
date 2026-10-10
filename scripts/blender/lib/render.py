"""Ánh sáng + camera so sánh với ảnh tham chiếu, render ra renders/.

Ánh sáng ở đây chỉ để xem trước trong Blender; không xuất sang glTF (Three.js tự chiếu sáng).
"""
import math
import os

import bpy
from mathutils import Vector

from . import quality as Q
from .scene import ROOT

RENDER_DIR = os.path.join(ROOT, "renders") if not Q.HIGH else os.path.join(ROOT, "renders", "high")


def area_light(name, loc, size, energy, up=False):
    """Đèn area chiếu thẳng xuống (giả đèn trần) — chỉ dùng cho render xem trước trong nhà.
    up=True: chiếu ngược lên để giả ánh sáng dội lên trần/tường."""
    data = bpy.data.lights.new(name, "AREA")
    data.size = size
    data.energy = energy
    data.color = (1.0, 0.97, 0.92)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    if up:
        obj.rotation_euler = (math.pi, 0, 0)
    return obj


def setup_lighting(sun_elev=45, sun_azim=35, strength=3.0, interior=False):
    """sun_azim: hướng mặt trời chiếu tới (0 = chiếu về +Y, tức nắng từ phía nam).
    interior=True: trời sáng hơn để ánh sáng lọt qua cửa kính, bổ sung bằng area_light()."""
    s = bpy.context.scene
    try:
        s.render.engine = "BLENDER_EEVEE"
    except TypeError as e:
        print("engine:", e)
    try:
        s.view_settings.view_transform = "Standard"  # màu phẳng đúng bảng màu, không bị AgX làm nhạt
    except TypeError as e:
        print("view_transform:", e)
    if s.world is None:
        s.world = bpy.data.worlds.new("World")
    s.world.use_nodes = True
    nt = s.world.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    bg.inputs[1].default_value = 1.5 if interior else 1.0
    # bầu trời chuyển màu: chân trời trắng xanh → đỉnh xanh trong (chỉ để xem trước)
    if not any(n.type == "VALTORGB" for n in nt.nodes):
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        e0, e1 = ramp.color_ramp.elements[0], ramp.color_ramp.elements[1]
        e0.position, e0.color = 0.0, (0.86, 0.92, 0.95, 1.0)
        e1.position, e1.color = 0.55, (0.32, 0.56, 0.86, 1.0)
        nt.links.new(ramp.outputs["Color"], bg.inputs[0])
    # Eevee: GI phản xạ nhanh + bóng mềm cho nội thất/ngoại thất
    ee = s.eevee
    for attr, val in (("use_raytracing", True), ("use_fast_gi", True), ("use_shadows", True),
                      ("fast_gi_distance", 6.0), ("shadow_ray_count", 2)):
        if hasattr(ee, attr):
            try:
                setattr(ee, attr, val)
            except (TypeError, AttributeError) as e:
                print("eevee", attr, e)
    sun_data = bpy.data.lights.get("PREVIEW_sun") or bpy.data.lights.new("PREVIEW_sun", "SUN")
    sun_data.energy = strength
    sun_data.color = (1.0, 0.93, 0.82)  # nắng chiều ấm
    sun_data.angle = math.radians(2.5)
    sun = bpy.data.objects.get("PREVIEW_sun") or bpy.data.objects.new("PREVIEW_sun", sun_data)
    if sun.name not in s.collection.objects:
        s.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(90 - sun_elev), 0, math.radians(sun_azim))
    return sun


def add_outlines(objects, thickness=0.025):
    """Viền nét kiểu hoạt hình cho ảnh xem trước (vỏ lật pháp tuyến — giống OutlineEffect của Three.js).
    Trả về danh sách để remove_outlines() gỡ ra trước khi lưu .blend."""
    mat = bpy.data.materials.get("PREVIEW_outline")
    if mat is None:
        mat = bpy.data.materials.new("PREVIEW_outline")
        mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (0.05, 0.05, 0.06, 1.0)
        bsdf.inputs["Roughness"].default_value = 1.0
        mat.use_backface_culling = True
    done, meshes = [], set()
    for o in objects:
        if o.type != "MESH" or o.name.startswith("COL_") or not o.visible_get():
            continue
        # chất liệu outline = False (lá cây mảng ảnh, như game: không viền) — vỏ lật phủ đen cả mảng lá → bỏ cả object
        if any(m is not None and m.get("outline") is False for m in o.data.materials):
            continue
        if o.data.name not in meshes:
            o.data.materials.append(mat)
            meshes.add(o.data.name)
        mod = o.modifiers.new("PREVIEW_outline", "SOLIDIFY")
        mod.thickness = thickness
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.material_offset = len(o.data.materials) - 1
        mod.material_offset_rim = len(o.data.materials) - 1
        done.append(o)
    return done


def remove_outlines(objects):
    meshes = set()
    for o in objects:
        m = o.modifiers.get("PREVIEW_outline")
        if m:
            o.modifiers.remove(m)
        if o.data.name not in meshes and o.data.materials and o.data.materials[-1] and \
                o.data.materials[-1].name == "PREVIEW_outline":
            o.data.materials.pop()
            meshes.add(o.data.name)


def camera(name, loc, target, lens=26, portrait=True):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.sensor_width = 36
    cam_data.sensor_fit = "AUTO"
    cam_data.clip_end = 400
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam["portrait"] = portrait
    return cam


def render(cam, out_name, res=(720, 1280), samples=32):
    s = bpy.context.scene
    s.camera = cam
    w, h = res if cam.get("portrait", True) else (res[1], res[0])
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.resolution_percentage = 100
    if hasattr(s, "eevee") and hasattr(s.eevee, "taa_render_samples"):
        s.eevee.taa_render_samples = samples
    path = os.path.join(RENDER_DIR, out_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s.render.filepath = path
    s.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return path
