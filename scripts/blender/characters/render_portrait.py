"""Ảnh chân dung nhân vật cho hộp thoại (nền trong suốt, 384 px) từ <id>_rig.blend.

Chạy: tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/render_portrait.py -- --id prajith
      [--outfit dau_ngay]   chân dung khi mặc bộ đồ khác (texture textures/<id>_basecolor_<bộ>.jpg, cùng UV)
Ra:   assets/characters/<id>/<id>_portrait.png  (game dùng: models.<id>.portrait trong data/characters.json)
      --outfit: <id>_portrait_<bộ>.png → models.<id>.outfit_portraits.<bộ> (game chọn theo bộ đồ đang mặc)
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from char_data import update_model  # noqa: E402
from char_render import preview_setup, shoot  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
CID = ARGS[ARGS.index("--id") + 1] if "--id" in ARGS else "prajith"
OUTFIT = ARGS[ARGS.index("--outfit") + 1] if "--outfit" in ARGS else None
OUT = os.path.join(ROOT, "assets", "characters", CID, f"{CID}_portrait{'_' + OUTFIT if OUTFIT else ''}.png")

bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, "assets", "characters", CID, f"{CID}_rig.blend"))
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
idle = bpy.data.actions["idle"]
arm.animation_data.action = idle
arm.animation_data.action_slot = idle.slots[0]
bpy.context.scene.frame_set(1)
if OUTFIT:   # thay ảnh màu của chất liệu bằng texture bộ đồ (cùng UV với texture trong GLB)
    tex = os.path.join(ROOT, "assets", "characters", CID, "textures", f"{CID}_basecolor_{OUTFIT}.jpg")
    img = bpy.data.images.load(tex)
    for mat in bpy.data.materials:
        for n in (mat.node_tree.nodes if mat.node_tree else []):
            if n.type == "TEX_IMAGE":
                n.image = img
cam = preview_setup()
bpy.context.scene.render.film_transparent = True          # nền trong suốt
bpy.context.scene.render.image_settings.color_mode = "RGBA"
head = arm.matrix_world @ arm.pose.bones["mixamorig:Head"].head
shoot(cam, OUT, (head.x, head.y, head.z + 0.02), (0.35, -1, 0.06), 0.62, res=(384, 384))
# ghi đường dẫn vào data/characters.json (chỉ khối models.<id>)
REL = os.path.relpath(OUT, ROOT).replace("\\", "/")
update_model(os.path.join(ROOT, "data", "characters.json"), CID,
             (lambda m: m.setdefault("outfit_portraits", {}).__setitem__(OUTFIT, REL)) if OUTFIT else (lambda m: m.__setitem__("portrait", REL)))
print("PORTRAIT", OUT)
