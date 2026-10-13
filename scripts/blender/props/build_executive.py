"""Optimize the user-supplied executive furniture and computer for zone 5.

Private inputs: assets/props/<id>/source/<id>.glb. Published outputs contain only
the simplified meshes/textures; no source, cameras, lights or private paths.
Run with Blender --background --threads 2 --python this_file.py.
"""
import json
import math
from pathlib import Path
import subprocess

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
(ROOT / 'renders/prajith').mkdir(parents=True, exist_ok=True)


def bounds(objects):
    points = [o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])


def triangles(objects):
    for o in objects:
        o.data.calc_loop_triangles()
    return sum(len(o.data.loop_triangles) for o in objects)


def cli(*args):
    r = subprocess.run(subprocess.list2cmdline(['gltf-transform', *map(str, args)]), shell=True,
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(r.stdout[-1200:], r.stderr[-500:])
    if r.returncode:
        raise RuntimeError('Conversion failed: ' + args[0])


def build(cid, budget, scale=1):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    path = ROOT / 'assets/props' / cid
    src = path / 'source' / (cid + '.glb')
    bpy.ops.import_scene.gltf(filepath=str(src))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    original_tris = triangles(objects)
    lo, hi = bounds(objects)
    # CEO: preserve real-world size, centre its footprint, put feet on the floor.
    # Computer: source monitor is ~3.24 m wide; .2 gives a 65 cm monitor.
    origin = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)) if cid == 'ceo_office' else Vector((-.024, 0, lo.z))
    transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-origin)
    for o in objects:
        m = transform @ o.matrix_world
        o.parent = None
        o.matrix_world = m
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        o.select_set(False)
        # Coplanar surfaces simplify without losing the executive desk silhouette.
        mod = o.modifiers.new('Planar simplification', 'DECIMATE')
        mod.decimate_type = 'DISSOLVE'
        mod.angle_limit = math.radians(2)
        mod.delimit = {'NORMAL', 'MATERIAL', 'UV'}
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if cid == 'apple_desktop':
        # The source mouse is disproportionately large. Fit it beside the keyboard.
        mouse = next(o for o in objects if o.name.startswith('Cube'))
        a, b = bounds([mouse]); c = (a + b) / 2
        dest = Vector((.30, -.24, (b.z - a.z) * .4 / 2))
        for v in mouse.data.vertices:
            v.co = (v.co - c) * .4 + dest
    before = triangles(objects)
    ratio = min(1, budget / max(1, before))
    for o in objects:
        bpy.context.view_layer.objects.active = o
        o.data.calc_loop_triangles()
        if len(o.data.loop_triangles) > 100:
            mod = o.modifiers.new('Mobile geometry budget', 'DECIMATE')
            mod.ratio = ratio
            bpy.ops.object.modifier_apply(modifier=mod.name)
    used_images = set()
    for o in objects:
        for mat in o.data.materials:
            if mat and mat.use_nodes:
                used_images.update(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
    for img in used_images:
        if max(img.size) > 512:
            k = 512 / max(img.size)
            img.scale(max(1, round(img.size[0] * k)), max(1, round(img.size[1] * k)))
    bpy.ops.object.select_all(action='DESELECT')
    for i, o in enumerate(objects):
        o.name = f'{cid}_{i:02d}'
        o.select_set(True)
    raw, tmp = path / (cid + '.raw.glb'), ROOT / 'renders/prajith' / (cid + '.webp.raw.glb')
    bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', use_selection=True,
        export_animations=False, export_extras=False, export_cameras=False, export_lights=False)
    cli('webp', raw, tmp, '--quality', '80')
    dedup = ROOT / 'renders/prajith' / (cid + '.dedup.raw.glb')
    joined = ROOT / 'renders/prajith' / (cid + '.joined.raw.glb')
    cli('dedup', tmp, dedup)
    cli('join', dedup, joined)
    output = path / (cid + '.glb')
    cli('draco', joined, output)
    lo, hi = bounds(objects)
    report = {'source_triangles': original_tris, 'triangles': triangles(objects), 'source_bytes': src.stat().st_size,
              'bytes': output.stat().st_size, 'bounds_blender': [list(lo), list(hi)], 'max_texture_px': 512}
    if cid == 'ceo_office':
        report['seat_local_blender'] = [-.195, .43, .447]
        report['desktop_height_m'] = .762
    (path / (cid + '.report.json')).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(cid, report)


build('ceo_office', 2600)
build('apple_desktop', 1200, .2)
