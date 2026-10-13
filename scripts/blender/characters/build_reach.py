"""Thêm 1 animation Mixamo vào GLB nhân vật đã có, giữ nguyên lưới và mọi animation cũ. Mặc định: "reach" (đưa tay ra
trước — đưa / nhận / quẹt thẻ nhân viên).

Chạy (không giao diện, mỗi nhân vật 1 lần):
  tools/bin/blender.cmd --background --factory-startup --python scripts/blender/characters/build_reach.py -- --id tiep_tan_nu
      [--source-root <thư mục repo có file riêng>] [--end 70]
  Clip khác: -- --id intern_nam --clip sit_idle --fbx "assets/characters/prajith/mixamo/Sitting.fbx" --end 0 --loop
      --align-seat sit_down
    --end 0: lấy cả clip · --loop: game phát lặp (models.<id>.loop) thay vì 1 lần · --align-seat <clip>: dời hông (ngang +
    độ cao) cho trùng chỗ ngồi cuối của clip đó (ngồi yên tại gốc như Mixamo "Sitting" → khớp ghế như sit_type)

Vào:  assets/characters/<id>/<id>_rig.blend, <id>.report.json (file riêng, chỉ trên máy làm việc)
      assets/characters/prajith/mixamo/Reaching Out.fbx (Mixamo "Reaching Out", Without Skin, 25 xương — không commit)
      GLB đang dùng: data/characters.json → models.<id>.glb.low
Ra:   GLB đó + clip "reach" (gltf-transform prune + meshopt như build_dances.py); data/characters.json → models.<id>:
      animations.reach, once += reach, durations_s.reach (chỉ ghi khối models.<id>)

Clip Mixamo gốc: tay phải đưa ra trước rồi vươn lên quá vai (khung 121: tay cao ~1,44 m). Chỉ lấy tới khung --end (mặc định
70: tay ngang ngực, cách thân ~0,55 m) — game phát 1 lần, giữ tư thế cuối (clampWhenFinished) rồi về idle.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from build_character import retarget, set_action, frames_of, strip_curves, hips_track, HIPS  # noqa: E402
from build_dances import read_glb, write_glb  # noqa: E402
from char_data import update_model  # noqa: E402

CLIP = "reach"
SRC_FBX = "assets/characters/prajith/mixamo/Reaching Out.fbx"


def shift_hips(arm, action, d):
    """Dời cả quỹ đạo hông một đoạn cố định d = (dx, dy, dz) (hệ thế giới Blender)."""
    set_action(arm, action)
    s, e = frames_of(action)
    pb = arm.pose.bones[HIPS]
    for f in range(s, e + 1):
        bpy.context.scene.frame_set(f)
        m = pb.matrix.copy()
        m.translation.x += d[0]
        m.translation.y += d[1]
        m.translation.z += d[2]
        pb.matrix = m
        bpy.context.view_layer.update()
        pb.keyframe_insert("location", frame=f)


def merge_clip(base, exported, output, name):
    """GLB gốc (giữ nguyên) + animation `name` từ GLB Blender vừa xuất (kênh trỏ theo tên node)."""
    import copy
    dst, binary = read_glb(base)
    src, src_bin = read_glb(exported)
    dst["animations"] = [a for a in dst.get("animations", []) if a.get("name") != name]
    by_name = {n.get("name"): i for i, n in enumerate(dst["nodes"])}
    acc_map, view_map = {}, {}

    def view(index):
        if index not in view_map:
            v = copy.deepcopy(src["bufferViews"][index])
            assert v.get("buffer", 0) == 0 and not v.get("extensions")
            binary.extend(b"\0" * (-len(binary) % 4))
            start = v.get("byteOffset", 0)
            offset = len(binary)
            binary.extend(src_bin[start:start + v["byteLength"]])
            v["buffer"], v["byteOffset"] = 0, offset
            view_map[index] = len(dst["bufferViews"])
            dst["bufferViews"].append(v)
        return view_map[index]

    def accessor(index):
        if index not in acc_map:
            a = copy.deepcopy(src["accessors"][index])
            assert "sparse" not in a
            a["bufferView"] = view(a["bufferView"])
            acc_map[index] = len(dst["accessors"])
            dst["accessors"].append(a)
        return acc_map[index]

    anim = next(a for a in src["animations"] if a["name"] == name)
    a = copy.deepcopy(anim)
    for sampler in a["samplers"]:
        sampler["input"] = accessor(sampler["input"])
        sampler["output"] = accessor(sampler["output"])
    for channel in a["channels"]:
        node = src["nodes"][channel["target"]["node"]]["name"]
        if node not in by_name:
            raise RuntimeError(f"{name}: node {node} không có trong GLB gốc")
        channel["target"]["node"] = by_name[node]
    dst["animations"].append(a)
    write_glb(output, dst, binary)
    return [x["name"] for x in dst["animations"]]


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    cid = args[args.index("--id") + 1]
    global CLIP
    CLIP = args[args.index("--clip") + 1] if "--clip" in args else CLIP
    src_fbx = args[args.index("--fbx") + 1] if "--fbx" in args else SRC_FBX
    loop = "--loop" in args
    seat_ref = args[args.index("--align-seat") + 1] if "--align-seat" in args else None
    end = int(args[args.index("--end") + 1]) if "--end" in args else 70
    source_root = Path(args[args.index("--source-root") + 1]).resolve() if "--source-root" in args else ROOT
    cfg = json.loads((ROOT / "data/characters.json").read_text(encoding="utf-8"))
    source_char = source_root / "assets/characters" / cid
    rig = source_char / f"{cid}_rig.blend"
    fbx = source_root / src_fbx
    for f in (rig, fbx):
        if not f.exists():
            raise RuntimeError(f"thiếu file riêng: {f}")
    original = ROOT / cfg["models"][cid]["glb"]["low"]
    work = ROOT / "renders" / CLIP / cid
    work.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(rig))
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE" and HIPS in o.data.bones)
    mesh = next(o for o in bpy.data.objects if o.type == "MESH" and o.find_armature() == arm)
    report = json.loads((source_char / f"{cid}.report.json").read_text(encoding="utf-8"))
    hips_height = report["rest_hips_m"]
    dz = float((arm.matrix_world @ arm.data.bones[HIPS].head_local).z) - hips_height
    idle = bpy.data.actions.get("idle")
    assert idle is not None
    action, _ = retarget(arm, str(fbx), CLIP, dz, hips_height)
    strip_curves(action, [b.name for b in arm.data.bones])
    start, _ = frames_of(action)
    # cắt đuôi: bỏ khoá sau khung `end` (reach: tay vươn quá vai); --end 0 → giữ cả clip
    stop = start + end - 1 if end > 0 else frames_of(action)[1]
    for fc in getattr(action, "fcurves", []) or [c for layer in action.layers for strip in layer.strips
                                                   for bag in strip.channelbags for c in bag.fcurves]:
        for kp in [k for k in fc.keyframe_points if k.co.x > stop][::-1]:
            fc.keyframe_points.remove(kp)
    action.use_frame_range = True
    action.frame_range = (start, stop)
    if seat_ref:
        import numpy as np
        ref = bpy.data.actions.get(seat_ref)
        assert ref is not None, f"rig không có action {seat_ref}"
        target = hips_track(arm, ref)[-1]
        mid = np.median(hips_track(arm, action), axis=0)
        d = [float(v) for v in (target - mid)]
        shift_hips(arm, action, d)
        print(f"[ngồi] dời hông {CLIP} ({d[0]:+.3f}, {d[1]:+.3f}, {d[2]:+.3f}) m cho trùng chỗ ngồi cuối của {seat_ref}")
    set_action(arm, action)
    hand = arm.pose.bones.get("mixamorig:RightHand") or arm.pose.bones.get("mixamorigRightHand")
    for f in (start, (start + stop) // 2, stop):
        bpy.context.scene.frame_set(f)
        p = arm.matrix_world @ hand.head
        print(f"[tay phải] khung {f}: x {p.x:+.2f}  trước {-p.y:+.2f}  cao {p.z:.2f} m")
    duration = round((stop - start) / bpy.context.scene.render.fps, 4)
    set_action(arm, idle)
    bpy.context.scene.frame_set(frames_of(idle)[0])
    # chỉ xuất action reach (các action khác lấy từ GLB gốc)
    for a in list(bpy.data.actions):
        if a.name not in (CLIP, "idle"):
            a.use_fake_user = False
            bpy.data.actions.remove(a)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    exported = work / f"{CLIP}.raw.glb"
    bpy.ops.export_scene.gltf(filepath=str(exported), export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True,
        export_anim_slide_to_zero=True, export_anim_single_armature=True, export_reset_pose_bones=True,
        export_rest_position_armature=True, export_skins=True, export_leaf_bone=False,
        export_extras=False, export_cameras=False, export_lights=False)
    merged = work / "merged.raw.glb"
    names = merge_clip(original, exported, merged, CLIP)
    pruned = work / "pruned.raw.glb"
    for command in (["gltf-transform", "prune", str(merged), str(pruned)],
                    ["gltf-transform", "meshopt", str(pruned), str(original), "--level", "high"]):
        result = subprocess.run(subprocess.list2cmdline(command), shell=True, capture_output=True,
                                text=True, encoding="utf-8", errors="replace")
        if result.returncode:
            print(result.stdout[-1500:], result.stderr[-1500:])
            raise RuntimeError(f"gltf-transform {command[1]} lỗi")

    def mutate(m):
        m.setdefault("animations", {})[CLIP] = CLIP
        kind, other = ("loop", "once") if loop else ("once", "loop")
        if CLIP not in m.setdefault(kind, []):
            m[kind].append(CLIP)
        if CLIP in m.get(other, []):
            m[other].remove(CLIP)
        m.setdefault("durations_s", {})[CLIP] = duration
    update_model(str(ROOT / "data/characters.json"), cid, mutate)
    print(f"CLIP {cid}: {len(names)} clip ({', '.join(names)}), {CLIP} {duration} s, {original.stat().st_size} byte")


if __name__ == "__main__":
    main()
