"""Render xem trước cho nhân vật (Eevee, nền xám nhạt, 3 đèn) — dùng chung cho các script trong characters/."""
import os

import bpy
import numpy as np
from mathutils import Vector

PREVIEW = "PREVIEW"


def preview_setup():
    s = bpy.context.scene
    try:
        s.render.engine = "BLENDER_EEVEE"
    except TypeError as e:
        print("engine:", e)
    try:
        s.view_settings.view_transform = "Standard"  # màu texture đúng như ảnh
    except TypeError as e:
        print("view_transform:", e)
    s.eevee.taa_render_samples = 32
    # không ghi metadata vào ảnh (Blender mặc định ghi đường dẫn file .blend, ngày giờ, tên máy… vào PNG)
    for k in dir(s.render):
        if k.startswith("use_stamp"):
            try:
                setattr(s.render, k, False)
            except (AttributeError, TypeError):
                pass
    s.render.film_transparent = False
    world = bpy.data.worlds.new("preview_world")
    if world.node_tree is None:  # Blender 5 luôn có node; bản cũ cần bật
        world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.84, 0.87, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    s.world = world
    col = bpy.data.collections.new(PREVIEW)
    s.collection.children.link(col)

    def light(name, kind, energy, loc, rot, size=None):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        if size:
            ld.size = size
        lo = bpy.data.objects.new(name, ld)
        lo.location, lo.rotation_euler = loc, rot
        col.objects.link(lo)

    light("key", "SUN", 3.0, (0, 0, 0), (np.radians(50), 0, np.radians(-30)))
    light("fill", "AREA", 300.0, (2.5, -2.5, 1.6), (np.radians(70), 0, np.radians(45)), size=3)
    light("rim", "AREA", 200.0, (-1.5, 2.5, 2.2), (np.radians(-60), 0, np.radians(-150)), size=2)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    col.objects.link(cam)
    s.camera = cam
    return cam


def preview_teardown():
    col = bpy.data.collections.get(PREVIEW)
    if col:
        for o in list(col.objects):
            bpy.data.objects.remove(o)
        bpy.data.collections.remove(col)
    for d in (bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
        for x in list(d):
            if x.users == 0:
                d.remove(x)


def shoot(cam, path, target, direction, ortho_scale, res=(900, 1200)):
    """Camera trực giao nhìn vào target từ hướng direction (vector từ target tới camera)."""
    s = bpy.context.scene
    s.render.resolution_x, s.render.resolution_y = res
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    cam.data.clip_end = 50
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * 6
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
