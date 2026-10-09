"""Chất liệu dùng chung. Chỉ Principled BSDF + Color Attribute (xuất glTF giữ nguyên).

Màu nằm ở vertex color "Color", nên cả zone chỉ cần vài chất liệu:
  palette  — bề mặt mờ (gần hết mọi thứ)
  gloss    — bề mặt bóng: đá đen, granite, sàn mài, sơn xe
  glass    — kính trong (alpha blend)
  light    — bóng đèn tự phát sáng
  brick_tex — gạch lát đan rổ: texture × vertex color (vertex color giữ AO đã bake)
"""
import os

import bpy

from .palette import color_linear
from . import quality as Q

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

SPECS = {
    # tên: (roughness, metallic, alpha, emission)
    "palette":   (0.85, 0.0, 1.0, 0.0),
    "gloss":     (0.3, 0.0, 1.0, 0.0),
    "glass":     (0.05, 0.0, 0.35, 0.0),
    "light":     (0.5, 0.0, 1.0, 2.0),
    "brick_tex": (0.9, 0.0, 1.0, 0.0),
    "ceiling_tex": (0.9, 0.0, 1.0, 0.0),
    "hex_tex": (0.9, 0.0, 1.0, 0.0),
    "laterite_tex": (0.95, 0.0, 1.0, 0.0),
    "louver_tex": (0.85, 0.0, 1.0, 0.0),
    "ceiling_grid_tex": (0.9, 0.0, 1.0, 0.0),
}

# chất liệu có texture: tên → (file ảnh, số mét cho 1 ô ảnh — dùng để chiếu UV theo hướng mặt)
# bản cao dùng file @2x (gấp đôi độ phân giải)
_T = os.path.join(ROOT, "assets", "textures")


def _tex(name):
    return os.path.join(_T, f"{name}@2x.png" if Q.HIGH else f"{name}.png")


TEXTURES = {
    "brick_tex": (_tex("brick_basketweave"), 1.0),
    "ceiling_tex": (_tex("ceiling_dots"), 1.0),
    "hex_tex": (_tex("hex_pavers"), 1.0),
    "laterite_tex": (_tex("laterite"), 0.5),
    "louver_tex": (_tex("brick_louver"), 1.0),
    "ceiling_grid_tex": (_tex("ceiling_grid"), 1.2),
}


def _input(node, *names):
    for n in names:
        if n in node.inputs:
            return node.inputs[n]
    raise KeyError(names)


def get(name):
    mname = f"M_{name}"
    mat = bpy.data.materials.get(mname)
    if mat:
        return mat
    rough, metal, alpha, emit = SPECS[name]
    mat = bpy.data.materials.new(mname)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    attr.location = (-300, 200)
    if name in TEXTURES:
        # Base Color = ảnh × vertex color (Mix Multiply) — glTF xuất baseColorTexture + COLOR_0
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(TEXTURES[name][0], check_existing=True)
        tex.interpolation = "Linear"
        tex.location = (-600, 350)
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.location = (-250, 300)
        mix.inputs[0].default_value = 1.0
        a, b = [s for s in mix.inputs if s.type == "RGBA"][:2]
        nt.links.new(tex.outputs["Color"], a)
        nt.links.new(attr.outputs["Color"], b)
        out = next(s for s in mix.outputs if s.type == "RGBA")
        nt.links.new(out, _input(bsdf, "Base Color"))
    else:
        nt.links.new(attr.outputs["Color"], _input(bsdf, "Base Color"))
    _input(bsdf, "Roughness").default_value = rough
    _input(bsdf, "Metallic").default_value = metal
    if alpha < 1.0:
        _input(bsdf, "Alpha").default_value = alpha
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "BLENDED"
        if hasattr(mat, "blend_method"):
            try:
                mat.blend_method = "BLEND"
            except (TypeError, AttributeError):
                pass
    if emit > 0:
        _input(bsdf, "Emission Color", "Emission").default_value = color_linear("lamp_white")
        _input(bsdf, "Emission Strength").default_value = emit
    mat.diffuse_color = (0.8, 0.8, 0.8, alpha)
    return mat
