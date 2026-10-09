"""Ảnh chân dung nhân vật cho hộp thoại (nền trong suốt, 384 px) từ <id>_rig.blend.

Chạy: tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/render_portrait.py -- --id prajith
Ra:   assets/characters/<id>/<id>_portrait.png  (game dùng: models.<id>.portrait trong data/characters.json)
"""
import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from char_render import preview_setup, shoot  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
CID = ARGS[ARGS.index("--id") + 1] if "--id" in ARGS else "prajith"
OUT = os.path.join(ROOT, "assets", "characters", CID, f"{CID}_portrait.png")

bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, "assets", "characters", CID, f"{CID}_rig.blend"))
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
idle = bpy.data.actions["idle"]
arm.animation_data.action = idle
arm.animation_data.action_slot = idle.slots[0]
bpy.context.scene.frame_set(1)
cam = preview_setup()
bpy.context.scene.render.film_transparent = True          # nền trong suốt
bpy.context.scene.render.image_settings.color_mode = "RGBA"
head = arm.matrix_world @ arm.pose.bones["mixamorig:Head"].head
shoot(cam, OUT, (head.x, head.y, head.z + 0.02), (0.35, -1, 0.06), 0.62, res=(384, 384))
# ghi đường dẫn vào data/characters.json
data_path = os.path.join(ROOT, "data", "characters.json")
data = json.load(open(data_path, encoding="utf-8"))
data["models"][CID]["portrait"] = os.path.relpath(OUT, ROOT).replace("\\", "/")
with open(data_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("PORTRAIT", OUT)
