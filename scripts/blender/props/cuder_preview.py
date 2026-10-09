"""Xem trước tượng Cuder (lib/cuder.py) riêng, không cần build cả zone: AO giống zone, viền nét, các góc chụp.

Chạy:  tools/bin/blender.cmd --background --factory-startup --python scripts/blender/props/cuder_preview.py -- [--no-bun]
Ra:    renders/cuder/cuder_<góc>.png  (front, q34, side, back, face, back_head, coins); --no-bun: cuder_nobun_<góc>.png
       (dựng lại không có búi tóc → AO nướng đúng như khi bỏ hẳn búi tóc)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LIB_PARENT = os.path.abspath(os.path.join(HERE, ".."))
if LIB_PARENT not in sys.path:
    sys.path.insert(0, LIB_PARENT)
for _m in [k for k in sys.modules if k == "lib" or k.startswith("lib.")]:
    del sys.modules[_m]

import bpy  # noqa: E402

from lib import cuder, render, scene  # noqa: E402
from lib import quality as Q  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
HEIGHT = 2.384          # = tổng chiều cao tượng cũ (bệ + tượng) trong zone_02
OUT = os.path.join(render.RENDER_DIR, "cuder")


def main():
    scene.reset()
    col = scene.collection("ENV")
    statue, bun, info = cuder.build(col, "tuong_cuder_tuong", (0, 0, 0), HEIGHT, keep_bun="--no-bun" not in ARGS)
    # mặt sân để AO có chỗ tối dưới chân bệ
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "san"
    objs = [o for o in (statue, bun) if o]
    scene.bake_ao(objs, strength=Q.AO_STRENGTH, samples=Q.AO_SAMPLES, distance=1.0)
    render.setup_lighting()
    render.add_outlines(objs, thickness=0.008)   # game: viền theo màn hình, mảnh hơn vỏ 2,5 cm mặc định
    os.makedirs(OUT, exist_ok=True)
    h = HEIGHT
    views = {
        "front": ((0, -4.2, h * 0.55), (0, 0, h * 0.5), 50),
        "q34": ((2.9, -3.1, h * 0.7), (0, 0, h * 0.5), 50),
        "side": ((4.2, 0, h * 0.55), (0, 0, h * 0.5), 50),
        "back": ((0, 4.2, h * 0.6), (0, 0, h * 0.5), 50),
        "face": ((0.2, -1.5, 2.1), (0, 0, 2.02), 55),
        "back_head": ((0.25, 1.5, 2.35), (0, 0.15, 2.12), 55),
        "coins": ((0.3, -1.4, 1.0), (0, -0.15, 0.62), 55),
    }
    prefix = "cuder_nobun_" if "--no-bun" in ARGS else "cuder_"
    for name, (loc, tgt, lens) in views.items():
        cam = render.camera(f"CAM_{name}", loc, tgt, lens=lens, portrait=name not in ("face", "back_head", "coins"))
        render.render(cam, os.path.join("cuder", f"{prefix}{name}.png"), res=(720, 1080))
    print("CUDER_INFO", info)


main()
