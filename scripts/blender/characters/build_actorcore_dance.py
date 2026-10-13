"""Bake ActorCore Graceful Dance onto the four existing playable rigs.

Sources remain private in assets/characters/actorcore/source/. Ships a complete
playable character variant, loaded only for this dance; never a raw motion pack.
Blender --background --threads 2 --python this_file -- --id intern_nam
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from build_character import HIPS, import_fbx, frames_of, eval_mesh_co, set_action, channelbag
from build_dances import merge_dances

ANIM = 'dance_graceful'
MAPPING = {'Hips': 'Hip', 'Spine': 'Waist', 'Spine1': 'Spine01', 'Spine2': 'Spine02',
           'Neck': 'NeckTwist01', 'Head': 'Head'}
for side, letter in (('Left', 'L'), ('Right', 'R')):
    for target, source in (('Shoulder', 'Clavicle'), ('Arm', 'Upperarm'), ('ForeArm', 'Forearm'),
                           ('Hand', 'Hand'), ('UpLeg', 'Thigh'), ('Leg', 'Calf'), ('Foot', 'Foot'), ('ToeBase', 'ToeBase')):
        MAPPING[side + target] = letter + '_' + source
    for target, source in (('Thumb', 'Thumb'), ('Index', 'Index'), ('Middle', 'Mid'), ('Ring', 'Ring'), ('Pinky', 'Pinky')):
        for index in range(1, 4):
            MAPPING[f'{side}Hand{target}{index}'] = f'{letter}_{source}{index}'


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    cid = args[args.index('--id') + 1]
    work = ROOT / 'renders/dances' / cid / 'graceful'
    work.mkdir(parents=True, exist_ok=True)
    cfg = json.loads((ROOT / 'data/characters.json').read_text(encoding='utf-8'))
    original = ROOT / cfg['models'][cid]['glb']['low']
    source_file = ROOT / 'assets/characters/actorcore/source/dance-graceful-378939.fbx'
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'renders/dances' / cid / 'dance_preview.blend'))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and HIPS in o.data.bones)
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == arm)
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    src, source_objects = import_fbx(str(source_file))
    start, end = frames_of(src.animation_data.action)
    bones = sorted(arm.pose.bones, key=lambda pb: len(pb.parent_recursive))
    mapping = {pb.name: 'CC_Base_' + MAPPING[pb.name.split(':')[-1]] for pb in bones}
    if any(name not in src.data.bones for name in mapping.values()):
        raise RuntimeError('ActorCore source lacks a mapped joint')
    target_rest = {pb.name: (arm.matrix_world @ pb.bone.matrix_local).to_quaternion() for pb in bones}
    source_rest = {name: (src.matrix_world @ src.data.bones[name].matrix_local).to_quaternion() for name in mapping.values()}
    correction = {}
    for name, source in mapping.items():
        # Preserve anatomical directions, correcting the different FBX bone rolls
        # and A/T rest poses, rather than copying incompatible local rotations.
        target_dir = target_rest[name] @ Vector((0, 1, 0))
        source_dir = source_rest[source] @ Vector((0, 1, 0))
        aligned_rest = target_dir.rotation_difference(source_dir) @ target_rest[name]
        correction[name] = source_rest[source].inverted() @ aligned_rest
    target_hips = arm.matrix_world @ arm.data.bones[HIPS].head_local
    source_hips = src.matrix_world @ src.data.bones['CC_Base_Hip'].head_local
    scale = target_hips.z / source_hips.z
    inverse_arm = arm.matrix_world.inverted()
    arm_rotation = arm.matrix_world.to_quaternion().inverted()
    action = bpy.data.actions.new(ANIM)
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    poses, lowest_before, lowest_after, lift_max = [], [], [], 0.0
    bpy.context.scene.frame_set(start)
    origin = (src.matrix_world @ src.pose.bones['CC_Base_Hip'].matrix).translation.copy()
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        desired = {name: arm_rotation @ (src.matrix_world @ src.pose.bones[source].matrix).to_quaternion() @ correction[name]
                   for name, source in mapping.items()}
        for pb in bones:
            pb.rotation_mode = 'QUATERNION'
            rest = pb.bone.matrix_local.to_quaternion()
            if pb.parent:
                local_rest = pb.parent.bone.matrix_local.to_quaternion().inverted() @ rest
                pb.rotation_quaternion = local_rest.inverted() @ desired[pb.parent.name].inverted() @ desired[pb.name]
            else:
                pb.rotation_quaternion = rest.inverted() @ desired[pb.name]
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        bpy.context.view_layer.update()
        position = (src.matrix_world @ src.pose.bones['CC_Base_Hip'].matrix).translation.copy() * scale
        position.x -= origin.x * scale; position.y -= origin.y * scale
        pb = arm.pose.bones[HIPS]
        matrix = pb.matrix.copy(); matrix.translation = inverse_arm @ position; pb.matrix = matrix
        bpy.context.view_layer.update()
        low = float(eval_mesh_co(mesh)[:, 2].min()); lowest_before.append(low)
        if low < .002:
            lift = .002 - low; lift_max = max(lift_max, lift)
            matrix = pb.matrix.copy(); matrix.translation += inverse_arm.to_3x3() @ Vector((0, 0, lift)); pb.matrix = matrix
            bpy.context.view_layer.update()
        lowest_after.append(float(eval_mesh_co(mesh)[:, 2].min()))
        poses.append([tuple(v.copy() for v in pb.matrix_basis.decompose()) for pb in bones])
        for pb in bones:
            pb.keyframe_insert('location', frame=frame)
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            pb.keyframe_insert('scale', frame=frame)
    # A pose-blended repeat at the travelled endpoint; runtime carries its offset.
    first = [(loc.copy(), rot.copy(), size.copy()) for loc, rot, size in poses[0]]
    for pb, (loc, rot, size) in zip(bones, first):
        pb.location, pb.rotation_quaternion, pb.scale = loc, rot, size
    bpy.context.view_layer.update()
    pb = arm.pose.bones[HIPS]
    matrix = pb.matrix.copy()
    endpoint = (src.matrix_world @ src.pose.bones['CC_Base_Hip'].matrix).translation.copy() * scale
    endpoint.x -= origin.x * scale; endpoint.y -= origin.y * scale
    matrix.translation.x, matrix.translation.y = (inverse_arm @ endpoint).xy
    pb.matrix = matrix
    bpy.context.view_layer.update()
    first = [tuple(v.copy() for v in pb.matrix_basis.decompose()) for pb in bones]
    bridge = round(.4 * bpy.context.scene.render.fps) + 1
    for i in range(1, bridge + 1):
        frame = end + i; bpy.context.scene.frame_set(frame)
        k = i / bridge; k = k * k * (3 - 2 * k)
        for pb, a, b in zip(bones, poses[-1], first):
            pb.location, pb.rotation_quaternion, pb.scale = a[0].lerp(b[0], k), a[1].slerp(b[1], k), a[2].lerp(b[2], k)
        bpy.context.view_layer.update()
        low = float(eval_mesh_co(mesh)[:, 2].min())
        if low < .002:
            pb = arm.pose.bones[HIPS]; matrix = pb.matrix.copy(); matrix.translation.z += .002 - low; pb.matrix = matrix
            bpy.context.view_layer.update()
        for pb in bones:
            pb.keyframe_insert('location', frame=frame); pb.keyframe_insert('rotation_quaternion', frame=frame); pb.keyframe_insert('scale', frame=frame)
    for fc in channelbag(action).fcurves:
        for key in fc.keyframe_points: key.interpolation = 'LINEAR'
    for obj in source_objects: bpy.data.objects.remove(obj, do_unlink=True)
    for old in list(bpy.data.actions):
        if old != action: bpy.data.actions.remove(old)
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = start, end + bridge
    set_action(arm, action); bpy.context.scene.frame_set(start)
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
    exported = work / 'retargeted.raw.glb'
    bpy.ops.export_scene.gltf(filepath=str(exported), export_format='GLB', use_selection=True, export_yup=True,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
        export_optimize_animation_size=True, export_anim_slide_to_zero=True, export_reset_pose_bones=True,
        export_rest_position_armature=True, export_extras=False, export_cameras=False, export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=str(work / 'preview.blend'), compress=True)
    merged, pruned = work / 'merged.raw.glb', work / 'pruned.raw.glb'
    assert merge_dances(original, exported, merged) == 1
    output = ROOT / 'assets/characters' / cid / f'{cid}_dance_graceful.glb'
    for command in (['gltf-transform', 'prune', str(merged), str(pruned)],
                    ['gltf-transform', 'meshopt', str(pruned), str(output), '--level', 'high']):
        result = subprocess.run(subprocess.list2cmdline(command), shell=True, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if result.returncode: raise RuntimeError(result.stderr[-1000:])
    report = {'provider': 'ActorCore', 'anim': ANIM, 'source_sha256': hashlib.sha256(source_file.read_bytes()).hexdigest(),
              'fps': bpy.context.scene.render.fps, 'source_frames': end - start + 1, 'frames': end + bridge - start + 1,
              'duration_s': (end + bridge - start) / bpy.context.scene.render.fps, 'loop_bridge_frames': bridge,
              'mapped_bones': len(mapping), 'lowest_before_m': min(lowest_before), 'lowest_after_m': min(lowest_after),
              'floor_lift_max_m': lift_max, 'bytes': output.stat().st_size}
    output.with_suffix('.report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('ACTORCORE_DANCE', cid, json.dumps(report))


if __name__ == '__main__': main()
