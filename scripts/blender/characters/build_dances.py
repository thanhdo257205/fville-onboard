"""Retarget Breakdance Pack to a playable character, preserving its shipped mesh.

blender --background --threads 2 --python scripts/blender/characters/build_dances.py -- --id intern_nam
Source FBX: assets/characters/breakdance/source/ (private, ignored).
Output: <character>_dances.glb, a complete game character with dance animations,
loaded only when needed. Does not publish an animation-only/raw skeleton pack.
"""
import copy
import json
import os
from pathlib import Path
import struct
import subprocess
import sys

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from build_character import retarget, set_action, frames_of, strip_curves, eval_mesh_co, HIPS  # noqa: E402


def read_glb(path):
    b = path.read_bytes()
    length = struct.unpack_from("<I", b, 12)[0]
    j = json.loads(b[20:20 + length])
    start = 20 + length
    bin_length, kind = struct.unpack_from("<II", b, start)
    assert kind == 0x004E4942
    return j, bytearray(b[start + 8:start + 8 + bin_length])


def write_glb(path, data, binary):
    data["buffers"][0]["byteLength"] = len(binary)
    j = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    j += b" " * (-len(j) % 4)
    binary += b"\0" * (-len(binary) % 4)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, 28 + len(j) + len(binary)) +
                     struct.pack("<II", len(j), 0x4E4F534A) + j +
                     struct.pack("<II", len(binary), 0x004E4942) + binary)


def merge_dances(base, exported, output):
    original, binary = read_glb(base)
    src, src_bin = read_glb(exported)
    dst = copy.deepcopy(original)
    dst["animations"] = []
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

    for anim in src["animations"]:
        if not anim["name"].startswith("dance_"):
            continue
        a = copy.deepcopy(anim)
        for sampler in a["samplers"]:
            sampler["input"] = accessor(sampler["input"])
            sampler["output"] = accessor(sampler["output"])
        for channel in a["channels"]:
            node = src["nodes"][channel["target"]["node"]]["name"]
            if node not in by_name:
                raise RuntimeError(f"Dance targets unknown model node: {node}")
            channel["target"]["node"] = by_name[node]
        dst["animations"].append(a)
    write_glb(output, dst, binary)
    return len(dst["animations"])


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    cid = args[args.index("--id") + 1]
    source_root = Path(args[args.index("--source-root") + 1]).resolve() if "--source-root" in args else ROOT
    cfg = json.loads((ROOT / "data/characters.json").read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / "data/dances.json").read_text(encoding="utf-8"))
    char_dir = ROOT / "assets/characters" / cid
    source_char = source_root / "assets/characters" / cid
    rig = source_char / f"{cid}_rig.blend"
    if not rig.exists():
        raise RuntimeError(f"Missing private rig: {rig.name}")
    original = ROOT / cfg["models"][cid]["glb"]["low"]
    work = ROOT / "renders/dances" / cid
    work.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(rig))
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE" and HIPS in o.data.bones)
    mesh = next(o for o in bpy.data.objects if o.type == "MESH" and o.find_armature() == arm)
    report_file = source_char / f"{cid}.report.json"
    report = json.loads(report_file.read_text(encoding="utf-8"))
    hips_height = report["rest_hips_m"]
    dz = float((arm.matrix_world @ arm.data.bones[HIPS].head_local).z) - hips_height
    idle = bpy.data.actions.get("idle")
    assert idle is not None
    durations = {}
    for item in manifest["dances"]:
        action, _ = retarget(arm, str(source_root / "assets/characters/breakdance/source" / item["source"]),
                             item["anim"], dz, hips_height)
        strip_curves(action, [b.name for b in arm.data.bones])
        start, end = frames_of(action)
        # The source and target limb proportions differ. Preserve jumps / turns,
        # but raise hips only on frames whose deformed mesh penetrates the floor.
        set_action(arm, action)
        lift_max = 0.0
        for frame in range(start, end + 1):
            bpy.context.scene.frame_set(frame)
            lowest = float(eval_mesh_co(mesh)[:, 2].min())
            if lowest < -0.002:
                lift = -lowest + 0.002
                pb = arm.pose.bones[HIPS]
                matrix = pb.matrix.copy()
                matrix.translation.z += lift
                pb.matrix = matrix
                bpy.context.view_layer.update()
                pb.keyframe_insert("location", frame=frame)
                lift_max = max(lift_max, lift)
        print(f"[floor] {item['anim']}: lift max {lift_max:.3f} m")
        durations[item["id"]] = round((end - start) / bpy.context.scene.render.fps, 4)
        if durations[item["id"]] <= 0:
            raise RuntimeError(f"Empty animation {item['id']}")
    set_action(arm, idle)
    bpy.context.scene.frame_set(frames_of(idle)[0])
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    exported = work / "retargeted.raw.glb"
    bpy.ops.export_scene.gltf(filepath=str(exported), export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True,
        export_anim_slide_to_zero=True, export_anim_single_armature=True, export_reset_pose_bones=True,
        export_rest_position_armature=True, export_skins=True, export_leaf_bone=False,
        export_extras=False, export_cameras=False, export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=str(work / "dance_preview.blend"), compress=True)
    merged = work / "merged.raw.glb"
    count = merge_dances(original, exported, merged)
    assert count == len(manifest["dances"])
    pruned = work / "pruned.raw.glb"
    output = char_dir / f"{cid}_dances.glb"
    for command in (["gltf-transform", "prune", str(merged), str(pruned)],
                    ["gltf-transform", "meshopt", str(pruned), str(output), "--level", "high"]):
        # Windows npm shims are .cmd; invoke directly with the shell for CLI tools only.
        result = subprocess.run(subprocess.list2cmdline(command), shell=True, capture_output=True,
                                text=True, encoding="utf-8", errors="replace")
        print(result.stdout[-1500:], result.stderr[-500:])
        if result.returncode:
            raise RuntimeError(f"Asset conversion failed: {command[1]}")
    (work / "durations.json").write_text(json.dumps(durations, indent=2) + "\n", encoding="utf-8")
    print(f"DANCE_PACK {cid}: {count} clips, {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
