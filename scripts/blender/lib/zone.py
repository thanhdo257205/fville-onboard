"""Quy trình chung cho mọi zone: dựng → bake AO → lưu .blend → xuất GLB → báo cáo → render so sánh.

Mỗi script zone_XX.py chỉ cần định nghĩa hàm build(cols, rng) và danh sách camera so sánh.
"""
import json
import os
import random
import sys

import bpy

from . import lightmap, render, scene
from . import quality as Q

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def run(zone, build, cameras=(), overview=None, interior=False, ao_distance=2.5,
        preview_lights=(), sun=None):
    """cameras: [(tên, ảnh tham chiếu, vị trí, điểm nhìn, lens)]
    overview: (vị trí, điểm nhìn, lens) cho ảnh toàn cảnh ngang.
    preview_lights: [(vị trí, kích thước, năng lượng W)] đèn area trần — chỉ để render xem trước, không xuất.
    """
    rng = random.Random(2026)
    scene.reset()
    cols = {k: scene.collection(k) for k in ("ENV", "INT", "GAME_markers", "COLLISION")}
    build(cols, rng)

    if "--no-ao" not in ARGS:
        visible = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.name.startswith("COL_")]
        scene.bake_ao(visible, strength=Q.AO_STRENGTH, samples=Q.AO_SAMPLES, distance=ao_distance)

    render.setup_lighting(interior=interior, **(sun or {}))
    for i, (loc, size, energy, *up) in enumerate(preview_lights):
        render.area_light(f"PREVIEW_area_{i}", loc, size, energy, up=bool(up and up[0]))
    if Q.LIGHTMAP:  # bản cao: nướng nắng + bóng đổ + đèn trần vào lightmap (TEXCOORD_1)
        lightmap.bake(zone)
    scene.save_and_export(zone)
    info = scene.report(zone)

    if "--no-render" not in ARGS:
        outlined = render.add_outlines(list(bpy.context.scene.objects))  # chỉ cho ảnh xem trước
        pairs = []
        for name, ref, loc, tgt, lens in cameras:
            cam = render.camera(f"CAM_compare_{name}", loc, tgt, lens=lens,
                                portrait=_is_portrait(ref))
            if ref:
                cam["reference"] = ref
            out = render.render(cam, f"{zone}_{name}.png")
            pairs.append({"name": name, "reference": ref, "render": out})
        with open(os.path.join(render.RENDER_DIR, f"{zone}_compare.json"), "w", encoding="utf-8") as f:
            json.dump({"zone": zone, "pairs": pairs}, f, ensure_ascii=False, indent=2)
        if overview:
            loc, tgt, lens, *rest = overview
            opts = rest[0] if rest else {}
            cam = render.camera("CAM_overview", loc, tgt, lens=lens or 24, portrait=False)
            if "ortho" in opts:  # nhìn thẳng từ trên, cắt trần (clip) để thấy mặt bằng
                cam.data.type = "ORTHO"
                cam.data.ortho_scale = opts["ortho"]
                cam.data.clip_start = loc[2] - opts.get("cut_z", 1e3)
                cam.rotation_euler = (0, 0, 0)
            render.render(cam, f"{zone}_overview.png")
        render.remove_outlines(outlined)
        bpy.ops.wm.save_mainfile()
    return info


def _is_portrait(ref):
    """Đọc kích thước ảnh tham chiếu (JPEG) để camera cùng tỉ lệ khung. Không có ảnh (xem trước) → khung ngang."""
    if not ref:
        return False
    path = os.path.join(scene.ROOT, "references", "frames", ref)
    try:
        img = bpy.data.images.load(path, check_existing=True)
        w, h = img.size
        bpy.data.images.remove(img)
        return h > w
    except RuntimeError:
        return True
