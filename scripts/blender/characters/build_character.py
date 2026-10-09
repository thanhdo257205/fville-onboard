"""Ghép nhân vật đã gắn xương trên Mixamo (1 file With Skin + các file Without Skin) thành 1 GLB có mọi animation.

Chạy (không giao diện):
  tools/bin/blender.cmd --background --factory-startup \
      --python scripts/blender/characters/build_character.py -- --id prajith [--tris 6000] [--no-render]
  huyen (chỉ có bản Thấp): ... -- --id huyen --height 1.60 --tris 6000 --single

  --tris N   bản rút gọn N tam giác (Decimate, giữ chi tiết vùng đầu/mặt/kính) → <id>_<N/1000>k.glb, dùng cho đồ hoạ
             Thấp (models.<id>.glb.low). Không có --tris → bản đầy đủ <id>.glb cho đồ hoạ Cao (glb.high) và là bản
             sở hữu các số đo (tốc độ animation, ghế, thời lượng).
  --single   bản duy nhất của nhân vật (vd chỉ dùng đồ hoạ Thấp): tên <id>.glb, ghi glb.low VÀ các số đo.
  --height H chiều cao nhân vật (m) ở tư thế gốc, mặc định 1.75.

Vào:  assets/characters/<id>/mixamo/*.fbx  (tên file → id action: bảng ACTIONS bên dưới, hoặc
      assets/characters/<id>/mixamo/actions.json cùng cấu trúc để ghi đè). Thêm trong actions.json:
        "anim_dir": thư mục chứa các file Without Skin (vd dùng lại animation của prajith);
        "idle_file": file lấy idle khi file gốc chỉ là tư thế tĩnh (tải từ Mixamo không kèm animation);
        "speed_mps": tốc độ chơi {walk, run} ghi vào characters.json (game chỉnh tốc độ phát cho khớp chân).
      assets/characters/<id>/textures/<id>_basecolor.jpg (ảnh màu chuẩn của nhân vật)
Ra:   assets/characters/<id>/<id>.glb        (đã tối ưu: WebP 1024, meshopt) — dùng trong game
      assets/characters/<id>/<id>.raw.glb    (Blender xuất, chưa tối ưu)
      assets/characters/<id>/<id>_rig.blend, <id>.report.json
      data/characters.json → cập nhật models.<id> (bảng roles giữ nguyên)
      renders/characters/<id>_anim/<action>_<k>.png (3 khung/animation, ghép bằng scripts/tools/anim_sheet.py)

Lưu ý Mixamo: file "With Skin" có tư thế gốc = tư thế lúc upload (A-pose), còn file "Without Skin" có tư thế
gốc T-pose. Cùng tên xương/cha/độ dài nhưng khác tư thế gốc → không gán thẳng action được; script RETARGET:
xương nhân vật copy hướng (không gian thế giới) của xương cùng tên ở file animation (+ vị trí hông), rồi nướng
thành keyframe. Sai lệch vị trí khớp sau retarget được đo và ghi vào report.
Animation của nhân vật KHÁC (vd prajith → huyen): vị trí hông nhân theo tỉ lệ độ cao hông hai nhân vật (chân chạm sàn
đúng), xương nguồn thừa (ngón tay) bỏ qua; mỗi action được soát tay lún vào thân, điểm thấp nhất (chân lún/hổng sàn),
bàn chân trượt khi đứng yên → report.

Prajith đã được duyệt dùng: GLB được phép lên dist/; FBX Mixamo, .blend, source/ thì KHÔNG (make_site.py chặn).
"""
import json
import math
import os
import subprocess
import sys

import bpy
import numpy as np
from bpy_extras import anim_utils
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from char_render import preview_setup, preview_teardown, shoot  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
CID = ARGS[ARGS.index("--id") + 1] if "--id" in ARGS else "prajith"
RENDER = "--no-render" not in ARGS
TRIS = int(ARGS[ARGS.index("--tris") + 1]) if "--tris" in ARGS else None
VARIANT = "low" if TRIS else "high"                       # mức đồ hoạ dùng bản này
SINGLE = "--single" in ARGS                               # bản duy nhất: tên <id>.glb, ghi cả số đo
SUFFIX = f"_{TRIS // 1000}k" if TRIS and not SINGLE else ""
OWNS_MEASURE = VARIANT == "high" or SINGLE
HEIGHT = float(ARGS[ARGS.index("--height") + 1]) if "--height" in ARGS else 1.75

CHAR_DIR = os.path.join(ROOT, "assets", "characters", CID)
MIX_DIR = os.path.join(CHAR_DIR, "mixamo")
TEX = os.path.join(CHAR_DIR, "textures", f"{CID}_basecolor.jpg")
RAW = os.path.join(CHAR_DIR, f"{CID}{SUFFIX}.raw.glb")
GLB = os.path.join(CHAR_DIR, f"{CID}{SUFFIX}.glb")
BLEND = os.path.join(CHAR_DIR, f"{CID}{SUFFIX}_rig.blend")
REPORT = os.path.join(CHAR_DIR, f"{CID}{SUFFIX}.report.json")
DATA = os.path.join(ROOT, "data", "characters.json")
ANIM_DIR = os.path.join(ROOT, "renders", "characters", f"{CID}_anim")

# Bảng mặc định (đặt tên file trên Mixamo theo bảng này thì nhân vật mới không cần cấu hình gì thêm)
ACTIONS = {
    "base": ["Standing Idle.fbx", "idle"],
    "files": {
        "walk": "Walking.fbx", "run": "Running.fbx", "talk": "Talking_1.fbx", "talk_2": "Talking_2.fbx",
        "wave": "Waving.fbx", "nod": "Hard Head Nod.fbx", "think": "Thinking.fbx", "point": "Pointing.fbx",
        "phone": "Texting.fbx", "press": "Button Pushing.fbx", "sit_down": "Stand To Sit.fbx",
        "sit_type": "Typing.fbx", "cheer": "Happy Idle.fbx",
    },
    "reverse": {"stand_up": "sit_down"},          # action tạo bằng cách đảo ngược action khác
    "in_place": ["walk", "run"],                  # phải đứng yên tại chỗ (khoá hông theo phương ngang)
    "nod": "nod",                                 # kiểm tra biên độ gật đầu
    "nod_max_deg": 25.0,                          # gật mạnh hơn mức này → giảm một nửa
    "sit": ["sit_down", "stand_up", "sit_type"],  # đo độ cao mông khi ngồi
    "align_seated": {"sit_type": "sit_down"},     # Typing ngồi tại gốc, Stand To Sit kết thúc lùi ~0.4 m → dời cho khớp
    "loop": ["idle", "walk", "run", "talk", "talk_2", "think", "phone", "sit_type", "cheer"],
    "groups": {"talk": ["talk", "talk_2"]},       # nhóm phát luân phiên
}

HIPS = "mixamorig:Hips"
HAND_BONES = ("mixamorig:LeftHand", "mixamorig:RightHand")
BODY_BONES = ("mixamorig:Hips", "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2", "mixamorig:Neck",
              "mixamorig:Head", "mixamorig:LeftUpLeg", "mixamorig:RightUpLeg")
SEAT_BONES = ("mixamorig:Hips", "mixamorig:LeftUpLeg", "mixamorig:RightUpLeg")
FEET = ("mixamorig:LeftToeBase", "mixamorig:RightToeBase")
NOD_BONES = ("mixamorig:Neck", "mixamorig:Head")


# ---------- tiện ích ----------
def _num(o):
    """json: số numpy (float32 từ mathutils) → số Python."""
    return o.item() if hasattr(o, "item") else str(o)


def channelbag(action):
    return anim_utils.action_get_channelbag_for_slot(action, action.slots[0])


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arms = [o for o in new if o.type == "ARMATURE"]
    if len(arms) != 1:
        raise RuntimeError(f"{os.path.basename(path)}: cần 1 armature, có {len(arms)}")
    return arms[0], new


def frames_of(action):
    s, e = action.frame_range
    return int(round(s)), int(round(e))


def eval_mesh_co(mesh):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    return (np.array(mesh.matrix_world) @ np.c_[co.reshape(-1, 3), np.ones(len(co) // 3)].T).T[:, :3]


def bone_world(arm, name, tail=False):
    pb = arm.pose.bones[name]
    return np.array(arm.matrix_world @ (pb.tail if tail else pb.head))


def set_action(arm, action):
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]


# ---------- nhân vật gốc ----------
def load_base(cfg):
    path = os.path.join(MIX_DIR, cfg["base"][0])
    arm, objs = import_fbx(path)
    meshes = [o for o in objs if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"file nhân vật gốc cần 1 mesh, có {len(meshes)}")
    mesh = meshes[0]
    for o in objs:
        if o not in (arm, mesh):
            bpy.data.objects.remove(o)
    idle = arm.animation_data.action
    idle.name = cfg["base"][1]
    mesh.name, mesh.data.name = f"{CID}_body", f"{CID}_body"   # đổi mesh trước, tránh armature thành "<id>.001"
    arm.name, arm.data.name = CID, f"{CID}_rig"
    print(f"[gốc] {cfg['base'][0]}: armature scale {tuple(round(s, 4) for s in arm.scale)}, "
          f"xoay {tuple(round(math.degrees(r), 1) for r in arm.rotation_euler)}°, {len(arm.data.bones)} xương")

    # apply mọi transform (armature scale = 1, không xoay) — xương và mesh cùng dời vào hệ thế giới
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # chiều cao (tư thế gốc) → đúng HEIGHT
    rest_h = mesh_rest_height(arm, mesh)
    s = HEIGHT / rest_h
    if abs(s - 1) > 1e-3:
        arm.scale = (s, s, s)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        scale_location_curves(idle, s)
    print(f"[gốc] cao (tư thế gốc) {rest_h:.4f} m → {HEIGHT} m (hệ số {s:.4f})")
    return arm, mesh, idle


def is_static(arm, action, rot_deg=0.5, loc_m=0.002):
    """File gốc tải từ Mixamo không kèm animation: stack chỉ là tư thế gốc đứng yên (không xương nào xoay/dời)."""
    set_action(arm, action)
    s, e = frames_of(action)
    bpy.context.scene.frame_set(s)
    ref = {pb.name: pb.matrix.copy() for pb in arm.pose.bones}
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        for pb in arm.pose.bones:
            m = pb.matrix
            if (math.degrees(ref[pb.name].to_quaternion().rotation_difference(m.to_quaternion()).angle) > rot_deg
                    or (ref[pb.name].translation - m.translation).length > loc_m):
                return False
    return True


def rest_hips_height(arm, mesh):
    """Độ cao đầu xương Hips so với điểm thấp nhất của mesh, ở tư thế gốc."""
    pos = arm.data.pose_position
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    floor = float(eval_mesh_co(mesh)[:, 2].min())
    arm.data.pose_position = pos
    bpy.context.view_layer.update()
    return float((arm.matrix_world @ arm.data.bones[HIPS].head_local).z) - floor


def mesh_rest_height(arm, mesh):
    pos = arm.data.pose_position
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    co = eval_mesh_co(mesh)
    arm.data.pose_position = pos
    bpy.context.view_layer.update()
    return float(co[:, 2].max() - co[:, 2].min())


def scale_location_curves(action, s):
    for fc in channelbag(action).fcurves:
        if fc.data_path.endswith(".location"):
            for kp in fc.keyframe_points:
                kp.co[1] *= s
                kp.handle_left[1] *= s
                kp.handle_right[1] *= s


def ground_at_first_idle_frame(arm, mesh, idle):
    """Dời xương + mesh theo Z để chân chạm z = 0 ở frame đầu của idle. Trả về độ dời."""
    set_action(arm, idle)
    bpy.context.scene.frame_set(frames_of(idle)[0])
    dz = -float(eval_mesh_co(mesh)[:, 2].min())
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    arm.location.z += dz
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    bpy.context.scene.frame_set(frames_of(idle)[0])
    print(f"[gốc] dời {dz * 100:+.2f} cm → z thấp nhất ở frame đầu idle: {eval_mesh_co(mesh)[:, 2].min():+.4f}")
    return dz


def setup_material(mesh):
    """1 chất liệu: baseColor từ ảnh chuẩn của nhân vật (gắn lại kể cả khi FBX có ảnh nhúng), metallic 0, roughness 1."""
    embedded = [i for i in bpy.data.images if i.size[0] > 0]
    if os.path.exists(TEX):
        img = bpy.data.images.load(TEX)
        src = TEX
    elif embedded:
        img = embedded[0]
        src = f"ảnh nhúng trong FBX ({img.name})"
    else:
        raise RuntimeError(f"không có texture: thiếu {TEX} và FBX không nhúng ảnh")
    img.name = f"{CID}_basecolor"
    mat = bpy.data.materials.new(f"M_{CID}")
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)
    for im in [i for i in bpy.data.images if i is not img and i.users == 0]:
        bpy.data.images.remove(im)
    print(f"[chất liệu] M_{CID}: baseColor ← {src}; metallic 0, roughness 1")


def tri_count(mesh):
    return sum(len(p.vertices) - 2 for p in mesh.data.polygons)


def head_tris(mesh, bones=("mixamorig:Head",)):
    """Số tam giác thuộc vùng đầu (đỉnh có trọng số xương đầu > 0.5) — để so mức giữ chi tiết mặt/kính."""
    idx = {g.index for g in mesh.vertex_groups if g.name in bones}
    head = {v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if g.group in idx) > 0.5}
    return sum(len(p.vertices) - 2 for p in mesh.data.polygons if all(v in head for v in p.vertices))


def _decimate_pass(mesh, ratio, weights, strength):
    """1 lượt Decimate collapse (đặt TRƯỚC Armature): đỉnh trọng số 1 được giữ, 0 thì giảm tự do.
    Lưu ý: Blender cộng (độ dài cạnh × (2 − w1' − w2') × strength) vào chi phí gộp cạnh — lớn hơn hẳn sai số hình học,
    nên trọng số chỉ cần > ~0,01 là vùng đó coi như được giữ hẳn (không 'giữ một phần' được bằng trọng số)."""
    vg = mesh.vertex_groups.new(name="_protect")
    for i in np.where(weights > 0)[0]:
        vg.add([int(i)], float(weights[i]), "REPLACE")
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    mod = mesh.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = min(1.0, ratio)
    mod.use_collapse_triangulate = True
    mod.vertex_group = vg.name
    mod.invert_vertex_group = True          # trọng số 1 → 0 sau khi đảo = được giữ
    mod.vertex_group_factor = strength
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    tmp = mesh.vertex_groups.get("_protect")    # tra lại theo tên: tham chiếu cũ có thể mất sau khi apply
    if tmp:
        mesh.vertex_groups.remove(tmp)


def _zones(mesh, protect, opts, regions, hc=None):
    """Mặt nạ đỉnh: trọng số xương đầu/cổ, tóc sau gáy (sau tâm đầu), vùng giữ thêm; + tâm đầu."""
    mw = mesh.matrix_world
    co = np.array([tuple(mw @ v.co) for v in mesh.data.vertices])
    gidx = {g.name: g.index for g in mesh.vertex_groups}
    pidx = {gidx[n] for n in protect if n in gidx}
    wb = np.array([min(1.0, sum(g.weight for g in v.groups if g.group in pidx)) for v in mesh.data.vertices])
    if hc is None:
        hc = co[wb > 0.5].mean(0)
    back = (wb > 0) & (co[:, 1] > hc[1] + opts.get("back_offset_m", 0.01))      # nhân vật nhìn -Y
    reg = np.zeros(len(wb), bool)
    for r in regions:
        c = np.array(r["center"], dtype=float)
        c[2] += opts.get("_dz", 0.0)                      # mesh đã dời chân chạm sàn
        reg |= (np.linalg.norm((co - c)[:, [0, 2]], axis=1) < r["radius"]) & (np.abs(co[:, 1] - c[1]) < 0.05)
    return wb, back, reg, hc


def decimate_skinned(mesh, target, protect=("mixamorig:Head", "mixamorig:Neck"), strength=6.0, opts=None):
    """Giảm tam giác mesh đã gắn xương (Decimate collapse đặt TRƯỚC Armature → trọng số, UV được nội suy).
    Vùng đầu/cổ được bảo vệ (nhóm đỉnh đảo ngược) để mặt và kính ít bị vỡ texture.
    opts (actions.json → decimate_protect, tuỳ chọn) — khi đầu quá nặng (vd tóc bob + kính) giữ cả đầu thì thân
    còn quá ít tam giác, texture thân (logo ngực, ống quần) vỡ:
      back_of_head_keep: lượt 1 chỉ giảm tóc sau gáy (đỉnh đầu nằm sau tâm đầu) còn tỉ lệ này, mọi chỗ khác giữ;
      regions / chest_logo: vùng trên thân được giữ như đầu ở lượt 2 (chest_logo: tâm lấy từ chest_logo.json → result,
                            bán kính chest_logo_radius_m)."""
    opts = opts or {}
    before, head_before = tri_count(mesh), head_tris(mesh)
    regions = list(opts.get("regions", []))
    if opts.get("chest_logo"):
        cl = os.path.join(CHAR_DIR, "chest_logo.json")
        if os.path.exists(cl):
            c = json.load(open(cl, encoding="utf-8"))
            regions.append({"center": (c.get("result") or c)["center"], "radius": opts.get("chest_logo_radius_m", 0.06),
                            "name": "logo"})
    tris_of = lambda m: sum(1 for p in mesh.data.polygons if all(m[v] for v in p.vertices))
    wb, back, reg, hc = _zones(mesh, protect, opts, regions)
    zb = {"head_front": tris_of((wb > 0.5) & ~back), "head_back": tris_of((wb > 0.5) & back), "regions": tris_of(reg)}
    if "back_of_head_keep" in opts:     # lượt 1: chỉ tóc sau gáy
        n_back = tris_of(back)
        keep_w = np.where(back, 0.0, 1.0)
        _decimate_pass(mesh, (before - n_back * (1 - opts["back_of_head_keep"])) / before, keep_w, strength)
        wb, back, reg, hc = _zones(mesh, protect, opts, regions, hc)
        w = np.maximum(wb, reg.astype(float))           # lượt 2: giữ cả đầu (đã giảm gáy) + vùng logo
    else:
        w = np.maximum(wb, reg.astype(float))
    mid = tri_count(mesh)
    _decimate_pass(mesh, target / mid, w, strength)
    wb, back, reg, hc = _zones(mesh, protect, opts, regions, hc)
    za = {"head_front": tris_of((wb > 0.5) & ~back), "head_back": tris_of((wb > 0.5) & back), "regions": tris_of(reg)}
    if mesh.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bpy.ops.object.shade_smooth()
    after, head_after = tri_count(mesh), head_tris(mesh)
    print(f"[giảm] {before} → {after} tam giác (mục tiêu {target}); vùng đầu {head_before} → {head_after} "
          f"({head_after / max(head_before, 1):.0%}, cả người {after / before:.0%})")
    rest = after - za["head_front"] - za["head_back"] - za["regions"]
    if opts:
        print(f"[giảm] mặt trước {zb['head_front']} → {za['head_front']}, tóc sau gáy {zb['head_back']} → {za['head_back']}"
              f", vùng giữ thêm ({', '.join(r.get('name', '?') for r in regions)}) {zb['regions']} → {za['regions']}, "
              f"còn lại (thân, tay, chân) ≈ {rest}")
    return {"tris_before": before, "tris_after": after, "head_before": head_before, "head_after": head_after,
            "zones_before": zb, "zones_after": dict(za, body_rest=rest),
            "opts": {k: v for k, v in opts.items() if k != "_dz"}}


def limit_weights(mesh, limit=4):
    def max_inf():
        return max(sum(1 for g in v.groups if g.weight > 0) for v in mesh.data.vertices)
    before = max_inf()
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.001)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=limit)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    after = max_inf()
    print(f"[trọng số] xương/đỉnh tối đa {before} → {after} (đã chuẩn hoá tổng = 1)")
    return before, after


def remove_unused_bones(arm, mesh):
    """Xoá xương lá không có trọng số (HeadTop_End, Toe_End, ngón 4...) + kênh animation của chúng."""
    weighted = set()
    idx = {g.index: g.name for g in mesh.vertex_groups}
    for v in mesh.data.vertices:
        for g in v.groups:
            if g.weight > 0:
                weighted.add(idx[g.group])
    removed = []
    while True:
        leaf = [b.name for b in arm.data.bones if not b.children and b.name not in weighted and b.parent]
        if not leaf:
            break
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode="EDIT")
        for n in leaf:
            arm.data.edit_bones.remove(arm.data.edit_bones[n])
        bpy.ops.object.mode_set(mode="OBJECT")
        removed += leaf
    for g in [g for g in mesh.vertex_groups if g.name not in arm.data.bones]:
        mesh.vertex_groups.remove(g)
    print(f"[xương] xoá {len(removed)} xương thừa: {removed} → còn {len(arm.data.bones)}")
    return removed


def strip_curves(action, bones):
    cb = channelbag(action)
    names = set(bones)
    for fc in [fc for fc in cb.fcurves if fc.data_path.startswith('pose.bones["')
               and fc.data_path.split('"')[1] not in names]:
        cb.fcurves.remove(fc)
    for fc in [fc for fc in cb.fcurves if fc.data_path.endswith(".scale")]:  # Mixamo không dùng scale
        cb.fcurves.remove(fc)


# ---------- retarget ----------
def retarget(arm, path, name, dz, hips_h):
    """hips_h: độ cao hông nhân vật (rest_hips_height). File animation có sàn ở z = 0 → vị trí hông nguồn nhân
    k = hips_h / độ cao hông nguồn (k ≈ 1 khi animation tải cho chính nhân vật này → giữ nguyên như cũ)."""
    src, objs = import_fbx(path)
    src_act = src.animation_data.action
    s, e = frames_of(src_act)
    k = hips_h / float((src.matrix_world @ src.data.bones[HIPS].head_local).z)
    src.location.z += dz      # cùng độ dời chân chạm đất như nhân vật gốc
    missing = set(b.name for b in arm.data.bones) - set(b.name for b in src.data.bones)
    if missing:
        raise RuntimeError(f"{os.path.basename(path)}: thiếu xương so với nhân vật gốc: {sorted(missing)}")
    rest_diff = max(np.linalg.norm(np.array(src.matrix_world @ src.data.bones[b.name].head_local)
                                   - np.array(arm.matrix_world @ b.head_local)) for b in arm.data.bones)

    arm.animation_data.action = None
    for pb in arm.pose.bones:
        c = pb.constraints.new("COPY_ROTATION")
        c.target, c.subtarget = src, pb.name
        c.target_space = c.owner_space = "WORLD"
        if pb.parent is None:
            c = pb.constraints.new("COPY_LOCATION")
            c.target, c.subtarget = src, pb.name
            c.target_space = c.owner_space = "WORLD"
    # đo sai lệch vị trí khớp (đầu + đuôi xương) giữa nguồn và nhân vật trước khi nướng
    err = 0.0
    for f in range(s, e + 1, max(1, (e - s) // 6)):
        bpy.context.scene.frame_set(f)
        for pb in arm.pose.bones:
            for tail in (False, True):
                err = max(err, float(np.linalg.norm(bone_world(arm, pb.name, tail) - bone_world(src, pb.name, tail))))
    opts = anim_utils.BakeOptions(only_selected=False, do_pose=True, do_object=False, do_visual_keying=True,
                                  do_constraint_clear=True, do_parents_clear=False, do_clean=False,
                                  do_location=True, do_rotation=True, do_scale=False, do_bbone=False,
                                  do_custom_props=False)
    baked = anim_utils.bake_action(arm, action=None, frames=range(s, e + 1), bake_options=opts)
    baked.name = name
    baked.use_fake_user = True
    if abs(k - 1) > 0.002:    # nhân vật khác tỉ lệ: hông = k × hông nguồn (so với sàn), nguồn vẫn đang chạy action
        set_action(arm, baked)
        pb = arm.pose.bones[HIPS]
        for f in range(s, e + 1):
            bpy.context.scene.frame_set(f)
            h = bone_world(src, HIPS)
            m = pb.matrix.copy()
            m.translation = Vector((h[0] * k, h[1] * k, (h[2] - dz) * k + dz))
            pb.matrix = m
            bpy.context.view_layer.update()
            pb.keyframe_insert("location", frame=f)
    for o in objs:
        bpy.data.objects.remove(o)
    bpy.data.actions.remove(src_act)
    for im in [i for i in bpy.data.images if i.users == 0]:        # ảnh/chất liệu của file With Skin nguồn
        bpy.data.images.remove(im)
    for mt in [m for m in bpy.data.materials if m.users == 0]:
        bpy.data.materials.remove(mt)
    print(f"[retarget] {name:9s} ← {os.path.basename(path):20s} {e - s + 1:4d} frame; "
          f"tư thế gốc lệch {rest_diff:.3f} m; khớp lệch sau retarget {err * 1000:.1f} mm; hông × {k:.4f}")
    return baked, {"file": os.path.basename(path), "rest_diff_m": round(rest_diff, 3),
                   "joint_err_mm": round(err * 1000, 1), "hips_scale": round(k, 4)}


def reverse_action(src, name):
    act = src.copy()
    act.name = name
    act.use_fake_user = True
    s, e = frames_of(src)
    for fc in channelbag(act).fcurves:
        for kp in fc.keyframe_points:
            kp.co[0] = s + e - kp.co[0]
            hl, hr = kp.handle_left[0], kp.handle_right[0]
            kp.handle_left[0], kp.handle_right[0] = s + e - hr, s + e - hl
        fc.update()
    print(f"[đảo] {name} = {src.name} chạy ngược ({e - s + 1} frame)")
    return act


# ---------- kiểm tra ----------
def hips_track(arm, action):
    set_action(arm, action)
    s, e = frames_of(action)
    pts = []
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        pts.append(bone_world(arm, HIPS))
    return np.array(pts)


def lock_horizontal(arm, action):
    """Khoá chuyển động ngang (X, Y thế giới) của hông ở giá trị frame đầu; giữ chuyển động lên xuống."""
    set_action(arm, action)
    s, e = frames_of(action)
    pb = arm.pose.bones[HIPS]
    bpy.context.scene.frame_set(s)
    x0, y0 = pb.matrix.translation.x, pb.matrix.translation.y
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        m = pb.matrix.copy()
        m.translation.x, m.translation.y = x0, y0
        pb.matrix = m
        bpy.context.view_layer.update()
        pb.keyframe_insert("location", frame=f)


def shift_horizontal(arm, action, dx, dy):
    """Dời cả quỹ đạo hông theo phương ngang (X, Y thế giới) một đoạn cố định."""
    set_action(arm, action)
    s, e = frames_of(action)
    pb = arm.pose.bones[HIPS]
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        m = pb.matrix.copy()
        m.translation.x += dx
        m.translation.y += dy
        pb.matrix = m
        bpy.context.view_layer.update()
        pb.keyframe_insert("location", frame=f)


def stance_speed(arm, action):
    """Tốc độ để chân không trượt: vận tốc lùi trung bình của mũi chân khi đang chạm đất (animation tại chỗ)."""
    set_action(arm, action)
    s, e = frames_of(action)
    fps = bpy.context.scene.render.fps
    tracks = {}
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        for b in FEET:
            tracks.setdefault(b, []).append(bone_world(arm, b))
    speeds = []
    for b, p in tracks.items():
        p = np.array(p)
        ground = p[:, 2] < p[:, 2].min() + 0.02
        v = np.diff(p[:, 1]) * fps                      # m/s theo Y (nhân vật nhìn -Y → chân lùi về +Y)
        st = ground[:-1] & ground[1:]
        if st.sum() >= 2:
            speeds.append(float(np.median(v[st])))
    cycle = (e - s) / fps
    speed = float(np.mean(speeds)) if speeds else 0.0
    return speed, cycle


def soften_nod(arm, action, max_deg):
    """Đo biên độ gật (góc quay đầu so với frame đầu); quá max_deg thì giảm một nửa ở Neck + Head."""
    def amplitude():
        set_action(arm, action)
        s, e = frames_of(action)
        bpy.context.scene.frame_set(s)
        q0 = (arm.matrix_world @ arm.pose.bones["mixamorig:Head"].matrix).to_quaternion()
        amp = 0.0
        for f in range(s, e + 1):
            bpy.context.scene.frame_set(f)
            q = (arm.matrix_world @ arm.pose.bones["mixamorig:Head"].matrix).to_quaternion()
            amp = max(amp, math.degrees(q0.rotation_difference(q).angle))
        return amp
    before = amplitude()
    if before <= max_deg:
        print(f"[gật] biên độ {before:.1f}° ≤ {max_deg}° — giữ nguyên")
        return {"amplitude_deg": round(before, 1), "softened": False}
    cb = channelbag(action)
    for bone in NOD_BONES:
        fcs = sorted([fc for fc in cb.fcurves if fc.data_path == f'pose.bones["{bone}"].rotation_quaternion'],
                     key=lambda c: c.array_index)
        if len(fcs) != 4:
            continue
        n = len(fcs[0].keyframe_points)
        q0 = Quaternion([fcs[i].keyframe_points[0].co[1] for i in range(4)])
        for k in range(n):
            q = Quaternion([fcs[i].keyframe_points[k].co[1] for i in range(4)])
            if q0.dot(q) < 0:  # cùng bán cầu → nội suy đường ngắn nhất
                q.negate()
            qn = q0.slerp(q, 0.5)
            for i in range(4):
                kp = fcs[i].keyframe_points[k]
                d = qn[i] - kp.co[1]
                kp.co[1] += d
                kp.handle_left[1] += d
                kp.handle_right[1] += d
        for fc in fcs:
            fc.update()
    after = amplitude()
    print(f"[gật] biên độ {before:.1f}° > {max_deg}° → giảm một nửa ở Neck/Head: {after:.1f}°")
    return {"amplitude_deg": round(before, 1), "softened": True, "amplitude_after_deg": round(after, 1)}


def seat_metrics(arm, mesh, action, frames):
    """Độ cao mặt ghế = điểm thấp nhất của mông/đùi (đỉnh có xương chính là Hips/UpLeg) khi ngồi."""
    set_action(arm, action)
    groups = {g.index: g.name for g in mesh.vertex_groups}
    dom = np.array([groups[max(v.groups, key=lambda g: g.weight).group] in SEAT_BONES if v.groups else False
                    for v in mesh.data.vertices])
    res = []
    for f in frames:
        bpy.context.scene.frame_set(f)
        co = eval_mesh_co(mesh)[dom]
        z = co[:, 2].min()
        low = co[co[:, 2] < z + 0.01]
        res.append((z, low[:, 0].mean(), low[:, 1].mean(), bone_world(arm, HIPS)))
    z = float(np.median([r[0] for r in res]))
    x = float(np.median([r[1] for r in res]))
    y = float(np.median([r[2] for r in res]))
    hips = np.median([r[3] for r in res], axis=0)
    return {"seat_height_m": round(z, 3), "seat_xy_m": [round(x, 3), round(y, 3)],
            "hips_m": [round(float(v), 3) for v in hips], "frames": [int(frames[0]), int(frames[-1])]}


def eval_mesh_co_nrm(mesh):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get("co", co)
    nr = np.empty(n * 3)
    me.vertex_normals.foreach_get("vector", nr)
    ev.to_mesh_clear()
    mw = np.array(mesh.matrix_world)
    co = (mw @ np.c_[co.reshape(-1, 3), np.ones(n)].T).T[:, :3]
    nr = (mw[:3, :3] @ nr.reshape(-1, 3).T).T
    return co, nr / np.maximum(np.linalg.norm(nr, axis=1, keepdims=True), 1e-9)


def body_checks(arm, mesh, action, locomotion=False, step=2):
    """Soát 1 action (mỗi `step` frame):
    - tay lún vào thân/đầu/đùi: đỉnh bàn tay nằm phía trong mặt thân (theo pháp tuyến đỉnh thân gần nhất) sâu > 1 cm;
    - điểm thấp nhất của mesh mỗi frame: < −1,5 cm = lún sàn; chân (đứng yên) cao nhất của điểm thấp nhất > 3 cm = hổng;
    - bàn chân trượt khi đang chạm đất (bỏ qua walk/run: tại chỗ, game tự khớp tốc độ)."""
    set_action(arm, action)
    s, e = frames_of(action)
    gname = {g.index: g.name for g in mesh.vertex_groups}
    dom = [gname[max(v.groups, key=lambda g: g.weight).group] if v.groups else "" for v in mesh.data.vertices]
    hand = np.array([d in HAND_BONES for d in dom])
    body = np.array([d in BODY_BONES for d in dom])
    body_idx = np.where(body)[0]
    pen_max, pen_frames, lows, n = 0.0, 0, [], 0
    feet = {b: [] for b in FEET}
    for f in range(s, e + 1, step):
        bpy.context.scene.frame_set(f)
        co, nr = eval_mesh_co_nrm(mesh)
        lows.append(float(co[:, 2].min()))
        kd = KDTree(len(body_idx))
        for i, vi in enumerate(body_idx):
            kd.insert(co[vi], i)
        kd.balance()
        deepest = 0.0
        for p in co[hand]:
            q, i, d = kd.find(p)
            if d < 0.06:
                depth = -float(np.dot(p - np.array(q), nr[body_idx[i]]))
                deepest = max(deepest, depth)
        if deepest > 0.01:
            pen_frames += 1
        pen_max = max(pen_max, deepest)
        n += 1
        for b in FEET:
            feet[b].append(bone_world(arm, b))
    slide = 0.0
    if not locomotion:
        for b, p in feet.items():
            p = np.array(p)
            g = p[p[:, 2] < p[:, 2].min() + 0.02]
            if len(g) > 1:
                slide = max(slide, float(np.linalg.norm(g[:, :2] - g[0, :2], axis=1).max()))
    return {"hand_in_body_cm": round(pen_max * 100, 1), "hand_in_body_frames": f"{pen_frames}/{n}",
            "lowest_min_cm": round(min(lows) * 100, 1), "lowest_max_cm": round(max(lows) * 100, 1),
            "foot_slide_cm": None if locomotion else round(slide * 100, 1)}


# ---------- xuất ----------
def export(arm, mesh, idle):
    set_action(arm, idle)
    bpy.context.scene.frame_set(frames_of(idle)[0])
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=RAW, export_format="GLB", use_selection=True, export_apply=False, export_yup=True,
        export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_frame_step=1, export_optimize_animation_size=True, export_anim_slide_to_zero=True,
        export_anim_single_armature=True, export_reset_pose_bones=True, export_rest_position_armature=True,
        export_skins=True, export_influence_nb=4, export_all_influences=False, export_def_bones=False,
        export_leaf_bone=False, export_materials="EXPORT", export_image_format="AUTO",
        export_extras=False, export_cameras=False, export_lights=False,
    )
    print(f"[glb] thô {RAW} ({os.path.getsize(RAW) / 1024 / 1024:.2f} MB)")


def optimize():
    cmd = (f'gltf-transform optimize "{RAW}" "{GLB}" --compress meshopt --texture-compress webp '
           f'--texture-size 1024 --simplify false --join false --flatten false --instance false --palette false')
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise RuntimeError("gltf-transform optimize lỗi")
    v = subprocess.run(f'gltf-transform validate "{GLB}"', shell=True, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    ok = "No errors found" in v.stdout + v.stderr
    print(f"[glb] tối ưu {GLB} ({os.path.getsize(GLB) / 1024 / 1024:.2f} MB); validate: {'0 lỗi' if ok else 'CÓ LỖI'}")
    if not ok:
        print((v.stdout + v.stderr)[-3000:])
    return ok


def update_data(entry, tris, speed=None):
    """models.<id>: glb/tris theo mức đồ hoạ; số đo (anim_speed_mps, seat, animations...) do bản đầy đủ (hoặc bản
    --single) ghi; speed_mps = tốc độ chơi: lấy từ actions.json → speed_mps nếu có, không thì chỉ đặt lần đầu bằng
    tốc độ animation (chỉnh tay trong JSON)."""
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    data = json.load(open(DATA, encoding="utf-8")) if os.path.exists(DATA) else {}
    m = data.setdefault("models", {}).setdefault(CID, {})
    glb = m.get("glb") if isinstance(m.get("glb"), dict) else ({"high": m["glb"]} if m.get("glb") else {})
    glb[VARIANT] = os.path.relpath(GLB, ROOT).replace("\\", "/")
    m["glb"] = glb
    m.setdefault("tris", {})[VARIANT] = tris
    if OWNS_MEASURE:
        m.update(entry)
        if speed:
            m["speed_mps"] = dict(speed)
        else:
            m.setdefault("speed_mps", dict(entry["anim_speed_mps"]))
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=_num)
    print(f"[data] cập nhật models.{CID} trong {DATA}")


def render_actions(arm, mesh, actions):
    cam = preview_setup()
    for name, act in actions.items():
        set_action(arm, act)
        s, e = frames_of(act)
        for k, t in enumerate((0.15, 0.5, 0.85)):
            bpy.context.scene.frame_set(int(round(s + (e - s) * t)))
            shoot(cam, os.path.join(ANIM_DIR, f"{name}_{k}.png"), (0, 0, 0.9), (0.55, -1, 0.12), 2.3, res=(300, 360))
    preview_teardown()    # mỗi preview_setup thêm 1 bộ đèn → phải gỡ, không thì lần render sau sáng gấp đôi
    print(f"[render] {len(actions)} animation × 3 khung → {ANIM_DIR}")


def face_check(arm, mesh, idle, tag=None):
    """Ảnh cận mặt (kính) ở frame đầu idle → renders/characters/check/<id><tag>_face.png để so trước / sau giảm."""
    cam = preview_setup()
    set_action(arm, idle)
    bpy.context.scene.frame_set(frames_of(idle)[0])
    head = bone_world(arm, "mixamorig:Head")
    p = os.path.join(ROOT, "renders", "characters", "check", f"{CID}{SUFFIX if tag is None else tag}_face.png")
    shoot(cam, p, (head[0], head[1], head[2] + 0.09), (0.25, -1, 0.05), 0.42, res=(600, 600))
    preview_teardown()
    print(f"[render] mặt: {p}")


def main():
    cfg = dict(ACTIONS)
    override = os.path.join(MIX_DIR, "actions.json")
    if os.path.exists(override):
        cfg.update(json.load(open(override, encoding="utf-8")))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    anim_dir = os.path.join(ROOT, cfg["anim_dir"]) if cfg.get("anim_dir") else MIX_DIR
    arm, mesh, base_act = load_base(cfg)
    hips_h = rest_hips_height(arm, mesh)
    report = {"id": CID, "variant": VARIANT, "single": SINGLE, "bones_before": len(arm.data.bones),
              "anim_dir": os.path.relpath(anim_dir, ROOT).replace("\\", "/"), "rest_hips_m": round(hips_h, 4)}
    if is_static(arm, base_act):
        # file gốc chỉ là tư thế tĩnh → idle lấy từ idle_file (retarget), rồi mới đặt chân chạm sàn theo idle
        idle_file = cfg.get("idle_file", "Standing Idle.fbx")
        print(f"[gốc] {cfg['base'][0]}: stack '{base_act.name}' là tư thế tĩnh → idle lấy từ {idle_file}")
        bpy.data.actions.remove(base_act)
        idle, idle_info = retarget(arm, os.path.join(anim_dir, idle_file), cfg["base"][1], 0.0, hips_h)
        idle_info["base_static"] = True
    else:
        idle, idle_info = base_act, {"file": cfg["base"][0], "native": True}
    idle.use_fake_user = True
    dz = ground_at_first_idle_frame(arm, mesh, idle)
    setup_material(mesh)
    if TRIS:
        face_check(arm, mesh, idle, f"_{tri_count(mesh) // 1000}k")      # trước khi giảm, để so
        report["decimate"] = decimate_skinned(mesh, TRIS, strength=cfg.get("protect_strength", 6.0),
                                              opts=dict(cfg.get("decimate_protect", {}), _dz=dz) if cfg.get("decimate_protect") else None)
    report["influences_before"], report["influences_after"] = limit_weights(mesh)
    report["removed_bones"] = remove_unused_bones(arm, mesh)
    report["bones"] = len(arm.data.bones)
    bones = [b.name for b in arm.data.bones]
    strip_curves(idle, bones)

    actions = {cfg["base"][1]: idle}
    report["actions"] = {cfg["base"][1]: idle_info}
    for name, fname in cfg["files"].items():
        path = os.path.join(anim_dir, fname)
        if not os.path.exists(path):
            print(f"[retarget] BỎ QUA {name}: thiếu {fname}")
            continue
        act, info = retarget(arm, path, name, dz, hips_h)
        strip_curves(act, bones)
        actions[name], report["actions"][name] = act, info
    for name, src in cfg.get("reverse", {}).items():
        if src in actions:
            actions[name] = reverse_action(actions[src], name)
            report["actions"][name] = {"reverse_of": src}

    # trôi vị trí (walk/run phải tại chỗ) + tốc độ đề xuất
    speeds = {}
    for name in cfg.get("in_place", []):
        if name not in actions:
            continue
        tr = hips_track(arm, actions[name])
        drift = float(np.linalg.norm(tr[-1, :2] - tr[0, :2]))
        dur = (len(tr) - 1) / bpy.context.scene.render.fps
        root_speed = drift / dur if dur else 0.0
        info = report["actions"][name]
        info["drift_m"] = round(drift, 3)
        if drift > 0.05:
            lock_horizontal(arm, actions[name])
            tr2 = hips_track(arm, actions[name])
            info["locked"] = True
            info["drift_after_m"] = round(float(np.linalg.norm(tr2[-1, :2] - tr2[0, :2])), 4)
            info["root_motion_speed"] = round(root_speed, 3)
            print(f"[tại chỗ] {name}: trôi {drift:.2f} m ({root_speed:.2f} m/s) → khoá ngang hông, "
                  f"còn {info['drift_after_m'] * 100:.1f} cm")
        else:
            print(f"[tại chỗ] {name}: trôi {drift * 100:.1f} cm — đã tại chỗ")
        sp, cycle = stance_speed(arm, actions[name])
        speeds[name] = round(abs(sp), 2)
        info["stance_speed"] = round(abs(sp), 3)
        info["cycle_s"] = round(cycle, 3)
        info["stride_m"] = round(abs(sp) * cycle, 3)
        print(f"[tốc độ] {name}: chân chạm đất lùi {abs(sp):.2f} m/s, chu kỳ {cycle:.2f} s, sải (2 bước) "
              f"{abs(sp) * cycle:.2f} m → đề xuất {abs(sp):.2f} m/s")

    if cfg.get("nod") in actions:
        report["actions"][cfg["nod"]].update(soften_nod(arm, actions[cfg["nod"]], cfg.get("nod_max_deg", 25.0)))

    # các action ngồi tại chỗ (vd sit_type) dời cho trùng chỗ ngồi cuối của sit_down → ghế đặt 1 chỗ cố định
    for name, ref in cfg.get("align_seated", {}).items():
        if name in actions and ref in actions:
            end = hips_track(arm, actions[ref])[-1]
            mid = np.median(hips_track(arm, actions[name]), axis=0)
            dx, dy = float(end[0] - mid[0]), float(end[1] - mid[1])
            shift_horizontal(arm, actions[name], dx, dy)
            report["actions"][name]["aligned_to"] = ref
            report["actions"][name]["shift_m"] = [round(dx, 3), round(dy, 3)]
            print(f"[ngồi] dời {name} ({dx:+.3f}, {dy:+.3f}) m cho trùng chỗ ngồi cuối của {ref}")

    seats = {}
    for name in cfg.get("sit", []):
        if name not in actions:
            continue
        s, e = frames_of(actions[name])
        if name.startswith("sit_down"):
            fr = [e - 2, e - 1, e]
        elif name.startswith("stand_up"):
            fr = [s, s + 1, s + 2]
        else:
            fr = list(range(s, e + 1, max(1, (e - s) // 12)))
        seats[name] = seat_metrics(arm, mesh, actions[name], fr)
        report["actions"][name].update(seats[name])
        print(f"[ngồi] {name}: mặt ghế (mông) cao {seats[name]['seat_height_m']:.3f} m tại "
              f"(x {seats[name]['seat_xy_m'][0]:+.3f}, y {seats[name]['seat_xy_m'][1]:+.3f}); hông {seats[name]['hips_m']}")

    fps = bpy.context.scene.render.fps
    for name, act in actions.items():
        s, e = frames_of(act)
        report["actions"][name]["frames"] = e - s + 1
        report["actions"][name]["duration_s"] = round((e - s) / fps, 3)
        if name not in cfg.get("reverse", {}):         # action đảo ngược: giống action gốc
            chk = body_checks(arm, mesh, act, locomotion=name in cfg.get("in_place", []))
            report["actions"][name]["checks"] = chk
            print(f"[soát] {name:9s} tay lún thân {chk['hand_in_body_cm']:4.1f} cm ({chk['hand_in_body_frames']}); "
                  f"điểm thấp nhất {chk['lowest_min_cm']:+.1f}..{chk['lowest_max_cm']:+.1f} cm; "
                  f"chân trượt {chk['foot_slide_cm']} cm")

    report["height_m"] = round(mesh_rest_height(arm, mesh), 4)
    set_action(arm, idle)
    bpy.context.scene.frame_set(frames_of(idle)[0])
    report["idle_first_frame_min_z"] = round(float(eval_mesh_co(mesh)[:, 2].min()), 4)
    report["triangles"] = sum(len(p.vertices) - 2 for p in mesh.data.polygons)

    export(arm, mesh, idle)
    report["validate_ok"] = optimize()
    report["glb_mb"] = round(os.path.getsize(GLB) / 1024 / 1024, 3)
    report["raw_glb_mb"] = round(os.path.getsize(RAW) / 1024 / 1024, 3)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_mainfile(compress=True)

    sit = seats.get("sit_down", {})
    groups = cfg.get("groups", {})
    anims = {n: n for n in actions}
    for g, members in groups.items():
        anims[g] = [m for m in members if m in actions]
    update_data({
        "height_m": HEIGHT,
        "forward": "+Z",
        "_forward_ghi_chu": "Model nhìn về +Z (chuẩn glTF). Với yaw_deg của SPAWN_/NPC_ (0 = nhìn -Z): rotation.y = yaw + 180°.",
        "anim_speed_mps": {"walk": speeds.get("walk"), "run": speeds.get("run")},
        "_speed_ghi_chu": "anim_speed_mps: tốc độ khớp animation (đo, chân không trượt). speed_mps: tốc độ chơi "
                          "(chỉnh tay); game phát walk/run với timeScale = tốc độ thật / anim_speed_mps.",
        "seat": {"height_m": sit.get("seat_height_m"), "offset_xz_m": None if not sit else
                 [sit["seat_xy_m"][0], -sit["seat_xy_m"][1]],
                 "_ghi_chu": "offset_xz_m: vị trí mông so với gốc nhân vật khi đã ngồi, theo trục glTF (x, z); "
                             "nhân vật nhìn +Z nên z âm = lùi về sau.",
                 "sit_type_height_m": seats.get("sit_type", {}).get("seat_height_m")},
        "animations": anims,
        "loop": [n for n in cfg.get("loop", []) if n in actions],
        "once": [n for n in actions if n not in cfg.get("loop", [])],
        "durations_s": {n: report["actions"][n]["duration_s"] for n in actions},
    }, report["triangles"], cfg.get("speed_mps"))
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=_num)
    print(f"[report] {REPORT}")

    face_check(arm, mesh, idle, f"_{TRIS // 1000}k" if TRIS else None)
    if RENDER:
        render_actions(arm, mesh, actions)
    print(f"TOM_TAT bones={report['bones']} actions={len(actions)} glb_mb={report['glb_mb']} "
          f"validate={report['validate_ok']} height={report['height_m']}")


main()
