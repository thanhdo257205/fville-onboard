"""Thẻ nhân viên (lễ tân đưa cho người chơi ở zone 3, người chơi quẹt ở cửa zone 4) từ mô hình người dùng gửi.

Chạy (không giao diện):
  tools/bin/blender.cmd --background --factory-startup --python scripts/blender/props/build_id_card.py

Vào:  assets/props/id_card/source/id_card_model.glb (chỉ trên máy làm việc, .gitignore)
Ra:   assets/props/id_card/id_card.glb, renders/props/id_card.png

- Chỉ giữ khung nhựa + mặt thẻ. Bỏ dây đeo (lưới cứng, cầm tay trông như que dựng đứng) và ảnh mặt thẻ mẫu (thẻ của một người
  khác: tên, ảnh chân dung) — mặt thẻ là chất liệu "card_face" trắng, game vẽ mặt thẻ bằng code (ảnh thẻ người chơi vừa
  chụp + tên: game/src/characters/idcard.js). Khung nhựa: màu phẳng, không texture.
- Kích thước thẻ thật dọc 54 × 86 mm. Trục glTF: rộng X, cao Y, mặt trước nhìn +Z; gốc ở giữa thẻ.
"""
import os

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = os.path.join(ROOT, "assets", "props", "id_card", "source", "id_card_model.glb")
OUT = os.path.join(ROOT, "assets", "props", "id_card", "id_card.glb")
CARD_H = 0.086             # m (thẻ dọc)

bpy.ops.wm.read_factory_settings(use_empty=True)
if not os.path.exists(SRC):
    raise FileNotFoundError(f"thiếu {os.path.relpath(SRC, ROOT)} (chỉ có trên máy làm việc)")
bpy.ops.import_scene.gltf(filepath=SRC)

face = plastic = None
for o in list(bpy.data.objects):
    if o.type != "MESH":
        continue
    mats = [m.name for m in o.data.materials if m]
    if "Ribbon" in mats:
        bpy.data.objects.remove(o)
    elif "Plastic" in mats:
        plastic = o
    elif "Employee_Id_Card_Design" in mats:
        face = o
assert face and plastic, "không thấy mặt thẻ / khung nhựa trong mô hình gốc"

# áp phép biến đổi, bỏ cha (glTF importer tạo node rỗng)
for o in (face, plastic):
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
for o in list(bpy.data.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o)

# mặt thẻ gốc nằm trong mặt phẳng YZ (pháp tuyến ±X) → xoay để pháp tuyến mặt trước = -Y Blender (= +Z glTF)
n = face.data.polygons[0].normal.copy()
rot = n.rotation_difference(Vector((0, -1, 0))).to_matrix().to_4x4()
pts = [v.co for o in (face, plastic) for v in o.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center = (lo + hi) / 2
fz = [v.co.z for v in face.data.vertices]
scale = CARD_H / (max(fz) - min(fz))
m = Matrix.Scale(scale, 4) @ rot @ Matrix.Translation(-center)
for o in (face, plastic):
    o.data.transform(m)
    o.data.update()

# chất liệu: mặt thẻ trắng (game thay bằng ảnh vẽ bằng code), khung nhựa màu phẳng
def flat(name, rgba, rough=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    return mat

face.data.materials.clear()
face.data.materials.append(flat("card_face", (1, 1, 1, 1), 0.4))
plastic.data.materials.clear()
plastic.data.materials.append(flat("card_plastic", (0.93, 0.94, 0.95, 1), 0.3))
face.name, plastic.name = "id_card_face", "id_card_frame"
for img in list(bpy.data.images):
    bpy.data.images.remove(img)

pts = [o.matrix_world @ v.co for o in (face, plastic) for v in o.data.vertices]
size = Vector((max(p.x for p in pts) - min(p.x for p in pts), max(p.y for p in pts) - min(p.y for p in pts),
               max(p.z for p in pts) - min(p.z for p in pts)))
tris = sum(len(p.vertices) - 2 for o in (face, plastic) for p in o.data.polygons)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_apply=True,
                          export_extras=False, export_cameras=False, export_lights=False, export_materials="EXPORT")
print(f"[thẻ] {os.path.relpath(OUT, ROOT)}: {tris} tam giác, {size.x * 1000:.0f} × {size.z * 1000:.0f} × {size.y * 1000:.1f} mm, "
      f"{os.path.getsize(OUT) / 1024:.1f} KB")
