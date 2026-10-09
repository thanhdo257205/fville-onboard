"""Lightmap (ánh sáng nướng sẵn) cho bản đồ hoạ CAO.

Cách làm:
  1. Mọi mesh (trừ COL_) có 2 lớp UV: "UVMap" (texture, TEXCOORD_0) và "UVLight" (TEXCOORD_1).
     Mesh dùng chung (instance) được tách riêng để mỗi bản có vùng lightmap riêng.
  2. "UVLight" của các vật tĩnh lớn được trải tự động (Smart UV) rồi xếp CHUNG vào 1 ảnh.
     Vật nhỏ/hữu cơ (cây, tượng) không trải — UV dồn vào 1 điểm sáng ở góc ảnh.
  3. Cycles nướng ánh sáng khuếch tán (trực tiếp + gián tiếp, không màu vật liệu) vào ảnh 2048².
  4. Ảnh chuẩn hoá về 0..1 (xám), làm mượt nhẹ, ghi PNG và nối vào chất liệu như
     occlusionTexture (texCoord 1) để glTF xuất kèm.

Phía Three.js: material.lightMap = material.aoMap; material.aoMap = null (xem REPORT.md).
"""
import math
import os

import bpy

from . import quality as Q
from .scene import out_path

SKIP_PREFIXES = ("ENV_vegetation", "ENV_cay", "ENV_tuong", "tuong_cuder")
RESERVED = 0.985   # UV > 0.985 dành cho điểm sáng chung của vật không trải lightmap
SPOT = (0.9925, 0.9925)


def _gltf_output_group():
    """Node group 'glTF Material Output' có ổ 'Occlusion' — exporter glTF đọc ổ này."""
    ng = bpy.data.node_groups.get("glTF Material Output")
    if ng is None:
        ng = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        ng.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    return ng


MIN_FACE_AREA = 0.2  # m² — mặt nhỏ hơn (cột đèn, viền vỉa, khung cửa...) dùng chung điểm sáng


def _prepare_uvs(objs, mapped):
    for o in objs:
        if o.data.users > 1:
            o.data = o.data.copy()
        me = o.data
        if "UVMap" not in me.uv_layers:
            me.uv_layers.new(name="UVMap")
        lm = me.uv_layers.get("UVLight") or me.uv_layers.new(name="UVLight")
        me.uv_layers.active = lm
        lm.data.foreach_set("uv", [SPOT[i % 2] for i in range(len(lm.data) * 2)])  # mặc định: điểm sáng
        if o in mapped:  # chỉ trải lightmap cho mặt đủ lớn
            sel = [p.area >= MIN_FACE_AREA for p in me.polygons]
            me.polygons.foreach_set("select", sel)
    bpy.ops.object.select_all(action="DESELECT")
    for o in mapped:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mapped[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="FACE")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, scale_to_bounds=False)
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True, margin_method="FRACTION", margin=0.0015)
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in mapped:  # thu nhỏ một chút, chừa dải góc trên-phải cho điểm sáng (chỉ mặt đã trải)
        me = o.data
        lm = me.uv_layers["UVLight"]
        uv = [0.0] * (len(lm.data) * 2)
        lm.data.foreach_get("uv", uv)
        for p in me.polygons:
            if p.select:
                for li in p.loop_indices:
                    uv[li * 2] *= RESERVED
                    uv[li * 2 + 1] *= RESERVED
        lm.data.foreach_set("uv", uv)


def _wire_materials(mats, image):
    """Nút ảnh lightmap (UV 'UVLight') làm nút active để bake + nối vào Occlusion cho exporter."""
    group = _gltf_output_group()
    for mat in mats:
        nt = mat.node_tree
        for n in [n for n in nt.nodes if n.name.startswith("LM_")]:
            nt.nodes.remove(n)
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.name = "LM_uv"
        uv.uv_map = "UVLight"
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.name = "LM_tex"
        tex.image = image
        tex.interpolation = "Linear"
        nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        sep.name = "LM_sep"
        nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
        out = nt.nodes.new("ShaderNodeGroup")
        out.name = "LM_gltf"
        out.node_tree = group
        nt.links.new(sep.outputs[0], out.inputs["Occlusion"])
        nt.nodes.active = tex
        for n in nt.nodes:
            n.select = n == tex


def bake(zone):
    scene = bpy.context.scene
    objs = [o for o in scene.objects if o.type == "MESH" and not o.name.startswith("COL_") and o.data.materials]
    # vật chuyển động ("dynamic"): không trải lightmap (dùng điểm sáng chung) và không đổ bóng lúc nướng
    mapped = [o for o in objs if not o.name.startswith(SKIP_PREFIXES) and not o.get("dynamic")]
    dynamic = [o for o in scene.objects if o.get("dynamic")]
    _prepare_uvs(objs, mapped)

    size = Q.LIGHTMAP_SIZE
    img = bpy.data.images.new(f"LM_{zone}", size, size, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    mats = {m for o in objs for m in o.data.materials if m}
    _wire_materials(mats, img)

    prev = scene.render.engine
    scene.render.engine = "CYCLES"
    scene.cycles.samples = Q.LIGHTMAP_SAMPLES
    scene.cycles.device = "CPU"
    scene.render.bake.margin = 6
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    bpy.ops.object.select_all(action="DESELECT")
    for o in mapped:
        o.select_set(True)
    scene.view_layers[0].objects.active = mapped[0]
    for o in dynamic:
        o.hide_render = True
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, target="IMAGE_TEXTURES",
                        use_clear=True, margin=6)
    for o in dynamic:
        o.hide_render = False
    scene.render.engine = prev

    path = out_path("glb", f"{zone}_lightmap.png")
    final = _postprocess(img, path)
    for mat in mats:
        mat.node_tree.nodes["LM_tex"].image = final
    bpy.data.images.remove(img)
    return path


def _postprocess(img, path):
    """Độ rọi → xám 0..1 (chuẩn hoá theo phân vị 98%), làm mượt nhẹ, tô điểm sáng ở góc. Ghi PNG."""
    import numpy as np  # có sẵn trong Python của Blender

    size = img.size[0]
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(size, size, 4)  # hàng 0 = đáy ảnh = UV v = 0
    lum = 0.2126 * px[..., 0] + 0.7152 * px[..., 1] + 0.0722 * px[..., 2]
    ref = float(np.percentile(lum[lum > 0], 98)) if (lum > 0).any() else 1.0
    val = np.clip(lum / max(ref, 1e-4) * 0.95, 0.0, 1.0)
    # làm mượt 3×3 (giảm nhiễu Cycles)
    pad = np.pad(val, 1, mode="edge")
    val = sum(pad[1 + dy:1 + dy + size, 1 + dx:1 + dx + size] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0
    edge = int(size * RESERVED)
    val[edge:, :] = 0.85   # dải trên (UV v > RESERVED)
    val[:, edge:] = 0.85   # dải phải (UV u > RESERVED)
    out = bpy.data.images.new(os.path.splitext(os.path.basename(path))[0], size, size, alpha=False)
    out.colorspace_settings.name = "Non-Color"
    rgba = np.repeat(val[..., None], 4, axis=2)
    rgba[..., 3] = 1.0
    out.pixels.foreach_set(rgba.astype(np.float32).ravel())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    print("lightmap", path, "ref", round(ref, 3))
    return out
