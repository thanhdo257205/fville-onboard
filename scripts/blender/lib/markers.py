"""Đối tượng game đọc theo tên: COL_, INT_, SPAWN_, NPC_, TRIGGER_, CAM_, PATH_.

Quy ước cho phía Three.js:
  SPAWN_* / NPC_*  : empty, vị trí = chân nhân vật. Hướng nhìn lưu ở custom property "yaw_deg"
                     (0 = nhìn về +Y Blender = -Z glTF; tăng ngược chiều kim đồng hồ nhìn từ trên).
  TRIGGER_*        : empty hình hộp; vùng kích hoạt = hộp [-1, 1] nhân với scale của node.
  COL_*            : mesh hộp không chất liệu — game ẩn đi và dùng làm va chạm.
  INT_*            : object/empty cha của vật tương tác.
  CAM_*            : empty góc máy cho cảnh chuyển. extras: target = [x, y, z] điểm nhìn, fov_deg = góc mở dọc,
                     track (tuỳ chọn) = tên vật để camera bám theo khi nó di chuyển.
  PATH_*           : đường cong Bezier (sửa được trong .blend) cho vật chạy bằng code. extras: points =
                     [x0, y0, z0, x1, ...] lấy mẫu đều ~0,5 m dọc đường cong, length_m = chiều dài.
  Toạ độ trong extras của CAM_ / PATH_ là toạ độ glTF (Y lên: x, z_blender, -y_blender) → Three.js dùng thẳng.
INT_ và NPC_ có custom property "label" (tên tiếng Việt). glTF xuất ở node.extras.
"""
import math

import bpy
from mathutils import Matrix, Vector

from .mesh import MeshBuilder


def _link(obj, collection):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def empty(name, loc, collection=None, display="PLAIN_AXES", size=0.5, yaw_deg=0.0, label=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    obj.location = loc
    obj.rotation_euler = (0, 0, math.radians(yaw_deg))
    if label:
        obj["label"] = label
    if name.startswith(("SPAWN_", "NPC_")):
        obj["yaw_deg"] = yaw_deg
    return _link(obj, collection)


def spawn(name, loc, yaw_deg=0.0, collection=None):
    return empty(f"SPAWN_{name}", loc, collection, "SINGLE_ARROW", 1.0, yaw_deg)


def npc(name, loc, label, yaw_deg=0.0, collection=None):
    return empty(f"NPC_{name}", loc, collection, "CONE", 0.4, yaw_deg, label)


def trigger(name, center, size, collection=None, yaw_deg=0.0):
    """Vùng kích hoạt hình hộp kích thước size (m), tâm center."""
    obj = empty(f"TRIGGER_{name}", center, collection, "CUBE", 1.0, yaw_deg)
    obj.scale = [s / 2 for s in size]
    return obj


def collider(name, center, size, collection=None, yaw_deg=0.0):
    b = MeshBuilder()
    b.box((0, 0, 0), size, "placeholder")
    obj = b.to_object(f"COL_{name}", collection, location=center)
    obj.data.materials.clear()
    obj.data.color_attributes.remove(obj.data.color_attributes["Color"])
    obj.rotation_euler = (0, 0, math.radians(yaw_deg))
    obj.display_type = "WIRE"
    obj.hide_render = True
    return obj


def collider_ramp(name, start, end, width, collection=None):
    """Mặt dốc va chạm cho cầu thang: hộp mỏng nối start → end (x, y, z)."""
    sx, sy, sz = start
    ex, ey, ez = end
    dx, dy, dz = ex - sx, ey - sy, ez - sz
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    yaw = math.atan2(dy, dx)
    pitch = math.atan2(dz, math.hypot(dx, dy))
    obj = collider(name, ((sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2 - 0.05), (length, width, 0.1), collection)
    obj.rotation_euler = (0, -pitch, yaw)
    return obj


def gltf(v):
    """Toạ độ Blender (Z lên) → glTF (Y lên)."""
    return (v[0], v[2], -v[1])


def camera_mark(name, loc, target, fov_deg=50.0, collection=None, track=None):
    """Góc máy cảnh chuyển: empty nhìn về target (để xem trong Blender) + extras cho game."""
    obj = empty(f"CAM_{name}", loc, collection, "CONE", 0.5)
    d = Vector(target) - Vector(loc)
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()   # như camera Blender: nhìn theo -Z local
    obj["target"] = [round(c, 4) for c in gltf(target)]
    obj["fov_deg"] = float(fov_deg)
    if track:
        obj["track"] = track
    return obj


def path(name, points, collection=None, step=0.5):
    """Đường cong Bezier qua các điểm (x, y, z) Blender, tay cầm tự động. Lấy mẫu đều mỗi `step` m → extras."""
    cu = bpy.data.curves.new(f"PATH_{name}", "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 24
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(f"PATH_{name}", cu)
    _link(obj, collection)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = obj.evaluated_get(dg).to_mesh()
    dense = [obj.matrix_world @ v.co for v in me.vertices]   # theo thứ tự dọc đường cong
    obj.evaluated_get(dg).to_mesh_clear()
    out, since, total = [dense[0].copy()], 0.0, 0.0
    for a, c in zip(dense, dense[1:]):
        seg = (c - a).length
        total += seg
        pos = 0.0
        while seg > 1e-9 and since + (seg - pos) >= step:
            pos += step - since
            out.append(a.lerp(c, pos / seg))
            since = 0.0
        since += seg - pos
    if (out[-1] - dense[-1]).length > 0.05:
        out.append(dense[-1].copy())
    obj["points"] = [round(c, 4) for p in out for c in gltf(p)]
    obj["length_m"] = round(total, 3)
    obj.hide_render = True
    return obj, [tuple(p) for p in out]


def interactive(name, label, loc, collection=None):
    """Empty cha cho vật tương tác; gắn các mesh con bằng parent()."""
    return empty(f"INT_{name}", loc, collection, "SPHERE", 0.6, label=label)


def parent(child, par):
    bpy.context.view_layer.update()  # matrix_world chưa cập nhật ngay sau khi đặt .location
    mw = child.matrix_world.copy()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()
    child.matrix_world = mw
