"""Three meeting rooms from the supplied video, with rice-grain door signs.

Reference photos / video stay private; all details below are simple game meshes.
"""
import math
import os
import bpy
from mathutils import Vector, Matrix
from .mesh import MeshBuilder
from . import interior as it, markers as mk, materials


def text(name, words, loc, collection, size=0.1, color=(0.08, 0.07, 0.05, 1)):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body, curve.align_x, curve.align_y = words, "CENTER", "CENTER"
    curve.size, curve.resolution_u = size, 1
    font = os.path.join(os.environ.get("WINDIR", ""), "Fonts", "arial.ttf")
    if os.path.isfile(font):
        curve.font = bpy.data.fonts.load(font, check_existing=True)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.location, obj.rotation_euler = loc, (math.pi / 2, 0, 0)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    obj.data.materials.append(materials.get("palette"))
    attr = obj.data.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    for c in attr.data:
        c.color_srgb = color
    obj.select_set(False)
    return obj


def grain(b, x, y, z, width, height, color, n=12):
    shape = [(x + width / 2 * math.cos(2 * math.pi * i / n),
              z + height / 2 * math.sin(2 * math.pi * i / n) * abs(math.sin(2 * math.pi * i / n)) ** .35)
             for i in range(n)]
    verts = [(a, y + d, c) for d in (-.014, .014) for a, c in shape]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    b.raw(verts, faces, color)


def door(cols, room, width):
    key, label = room["id"], room["name"]
    x0, x1, y0, _ = room["bounds"]
    cx, w, h = (x0 + x1) / 2, width - .08, 2.5
    hx = cx - w / 2
    hinge = mk.empty(f"ENV_cua_{key}", (hx, y0, 0), cols["ENV"])
    hinge["hinge"], hinge["dynamic"] = True, True
    b = MeshBuilder()
    b.box((w / 2, 0, h / 2), (w, .03, h), "glass_meeting", mat="glass")
    for x in (.025, w - .025):
        b.box((x, 0, h / 2), (.045, .065, h), "black")
    for z in (.025, h - .025):
        b.box((w / 2, 0, z), (w, .065, .05), "black")
    # Three frosted bands with transparent gaps, as in the supplied door photo.
    for lo, hi in ((.28, .63), (.67, 1.03), (1.07, 1.49)):
        b.box((w / 2, -.02, (lo + hi) / 2), (w - .06, .012, hi - lo), "sign_white")
    for i in range(5):
        grain(b, .22 + i * (w - .44) / 4, -.03, .83, .11, .045, "glass_meeting", n=8)
    for s in (-1, 1):
        for z in (.69, 1.43):
            b.tube((w - .15, 0, z), (w - .15, s * .1, z), .012, "meeting_chrome", segments=6, mat="gloss")
        b.tube((w - .15, s * .1, .69), (w - .15, s * .1, 1.43), .018, "black", segments=8)
    # Availability slider.
    b.box((w / 2, -.039, 1.27), (.43, .035, .18), "black")
    b.box((w / 2 + .1, -.06, 1.27), (.2, .012, .145), "meeting_chrome")
    leaf = b.to_object(f"ENV_canh_{key}", cols["ENV"], bevel=0)
    leaf.parent = hinge
    leaf["dynamic"] = True
    words = text(f"ENV_trang_thai_{key}", "Available", (w / 2 + .1, -.07, 1.27), cols["ENV"], size=.039)
    words.parent = hinge
    words["dynamic"] = True
    b = MeshBuilder()
    grain(b, w / 2, -.045, 2.21, 1.15, .34, "meeting_oak")
    sign = b.to_object(f"ENV_bien_{key}", cols["ENV"], bevel=0)
    sign.parent, sign["room_name"] = hinge, label
    sign["dynamic"] = True
    words = text(f"ENV_ten_{key}", label.upper(), (w / 2, -.063, 2.21), cols["ENV"], size=.12)
    words.parent, words["room_name"] = hinge, label
    words["dynamic"] = True
    mk.interactive(f"cua_{key}", f"Cửa {label}", (cx, y0, 1.1), cols["INT"])
    # Endpoint collision shapes; the game enables only the settled door pose.
    mk.collider(f"cua_{key}_closed", (cx, y0, h / 2), (w, .09, h), cols["COLLISION"])
    a = math.radians(85)
    mk.collider(f"cua_{key}_open", (hx + math.cos(a) * w / 2, y0 + math.sin(a) * w / 2, h / 2),
                (w, .09, h), cols["COLLISION"], yaw_deg=85)


def rod(b, a, c, radius, color, segments=4, mat="palette"):
    # Connected rails have hidden ends: omit end caps, keep their silhouette.
    a, c = Vector(a), Vector(c)
    axis = c - a
    m = Matrix.Translation(a) @ Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4()
    verts = [(radius * math.cos(i * math.tau / segments), radius * math.sin(i * math.tau / segments), z)
             for z in (0, axis.length) for i in range(segments)]
    b.raw(verts, [(i, (i + 1) % segments, segments + (i + 1) % segments, segments + i) for i in range(segments)], color, mat, m)


def chair(b, x, y, face):
    # Black mesh seat / back and bent chrome sled legs (video reference).
    b.box((x, y, .45), (.46, .44, .08), "black")
    def p(a, c, z):
        return (x + c, y + face * a, z)
    b.box((x, y - face * .24, .79), (.46, .045, .57), "black")
    for s in (-1, 1):
        side = s * .24
        for a, c in ((p(-.24, side, .04), p(.22, side, .04)),
                     (p(.22, side, .04), p(.22, side, .61)),
                     (p(.22, side, .61), p(-.23, side, .61)),
                     (p(-.24, side, .44), p(-.24, side, 1.07))):
            rod(b, a, c, .013, "meeting_chrome", mat="gloss")
        b.box((x + side, y, .63), (.055, .34, .04), "black")


def fan(b, x, y):
    b.cylinder((x, y, .02), .24, .04, "meeting_grey", segments=12)
    b.cylinder((x, y, .06), .025, 1.02, "meeting_chrome", segments=6)
    b.torus((x, y, 1.31), .245, .016, "meeting_grey", seg=12, seg2=3, rot=(90, 0, 0))
    for r in (.08, .16):
        b.torus((x, y - .018, 1.31), r, .005, "meeting_chrome", seg=12, seg2=3, rot=(90, 0, 0))
    for k in range(8):
        a = k * math.pi / 4
        rod(b, (x, y - .024, 1.31), (x + .23 * math.cos(a), y - .024, 1.31 + .23 * math.sin(a)), .004, "meeting_grey", segments=3)
    for k in range(3):
        a = k * math.tau / 3
        b.box((x + .09 * math.cos(a), y, 1.31 + .09 * math.sin(a)), (.16, .015, .07), "meeting_grey", rot=(0, -math.degrees(a), 0))


def build_rooms(cols, cfg, height):
    out = {}
    for room in cfg["meeting_rooms"]:
        key, label = room["id"], room["name"]
        x0, x1, y0, y1 = room["bounds"]
        cx, cy, width = (x0 + x1) / 2, (y0 + y1) / 2, cfg["door_width_m"]
        b = MeshBuilder()
        it.floor_tiles(b, x0, y0, x1, y1, 0, ["meeting_beige", "meeting_grey"], cell=1, mat="palette")
        it.ceiling(b, x0, y0, x1, y1, height)
        # Hall glazing, opaque rear TV wall / clock wall, outside windows with blinds.
        for lo, hi in ((x0, cx - width / 2), (cx + width / 2, x1)):
            it.glass_wall(b, (lo, y0), (hi, y0), 0, 2.6, band=(.28, 1.21, "sign_white"))
        it.wall(b, (x0, y0), (x1, y0), 2.6, height)
        it.wall(b, (x0, y0), (x0, y1), 0, height, color="meeting_green")
        it.wall(b, (x1, y0), (x1, y1), 0, height)
        it.wall(b, (x0, y1), (x1, y1), 0, .88)
        it.glass_wall(b, (x0, y1), (x1, y1), .88, 2.7, mullion=1.5)
        it.wall(b, (x0, y1), (x1, y1), 2.7, height)
        for xx in (x0 + .8, cx, x1 - .8):
            b.box((xx, y1 - .075, 2.31), (1.45, .04, .76), "reception_white")
            b.tube((xx + .68, y1 - .105, 2.67), (xx + .68, y1 - .105, 1.4), .006, "meeting_chrome", segments=4)
        # White table with a narrow centre cable strip / conference tablet.
        b.box((cx, cy + .3, .75), (3.9, 1.6, .07), "sign_white", mat="gloss")
        b.box((cx, cy + .3, .789), (3.85, .04, .004), "black")
        for xx in (cx - 1.2, cx + 1.2):
            b.box((xx, cy + .3, .37), (.06, 1.2, .72), "sign_white")
        b.box((cx - .65, cy + .06, .9), (.24, .03, .22), "black", rot=(25, 0, 0))
        for xx in (cx - 1.35, cx, cx + 1.35):
            chair(b, xx, cy - .87, 1)
            chair(b, xx, cy + 1.47, -1)
        b.box((x0 + .085, cy + .3, 1.69), (.1, 1.98, 1.25), "black")
        b.box((x0 + .146, cy + .3, 1.65), (.015, 1.78, .96), "screen", mat="gloss")
        b.box((x0 + .15, cy + .3, 2.24), (.04, .68, .065), "meeting_chrome")
        fan(b, x1 - .55, y1 - .56)
        # Align the first room's clock / artwork with the two table centres.
        art_y = cy + .3 if room == cfg["meeting_rooms"][0] else cy
        b.torus((x1 - .1, art_y, 2.2), .18, .016, "black", seg=12, seg2=3, rot=(0, 90, 0))
        verts = [(x1 - .105, art_y + .171 * math.cos(i * math.tau / 12), 2.2 + .171 * math.sin(i * math.tau / 12)) for i in range(12)]
        b.raw(verts, [tuple(reversed(range(12)))], "sign_white")
        b.tube((x1 - .11, art_y, 2.2), (x1 - .11, art_y + .06, 2.29), .008, "black", segments=4)
        b.tube((x1 - .11, art_y, 2.2), (x1 - .11, art_y - .12, 2.2), .006, "black", segments=4)
        for i, color in enumerate(("meeting_oak", "meeting_green", "meeting_beige")):
            yy = art_y + (i - 1) * .52
            b.box((x1 - .075, yy, 1.71), (.04, .48, .36), "black")
            b.quad([(x1 - .102, yy - .215, 1.555), (x1 - .102, yy - .215, 1.865), (x1 - .102, yy + .215, 1.865), (x1 - .102, yy + .215, 1.555)], color)
            b.quad([(x1 - .115, yy - .085, 1.64), (x1 - .115, yy - .085, 1.78), (x1 - .115, yy + .085, 1.78), (x1 - .115, yy + .085, 1.64)], "reception_white")
        b.box((cx, cy, height - .035), (.68, .68, .07), "sign_white")
        for i in range(5):
            # Only the underside of each thin grille is seen from inside.
            yy, z = cy + (i - 2) * .08, height - .082
            b.quad([(cx - .23, yy - .0135, z), (cx - .23, yy + .0135, z),
                    (cx + .23, yy + .0135, z), (cx + .23, yy - .0135, z)], "meeting_grey")
        for xx in (cx - 1.8, cx + 1.8):
            for yy in (cy - 1.5, cy + 1.5):
                verts = [(xx + .07 * math.cos(i * math.tau / 8), yy + .07 * math.sin(i * math.tau / 8), height - .025) for i in range(8)]
                b.raw(verts, [tuple(reversed(range(8)))], "lamp_white", mat="light")
        mesh = b.to_object(f"{key}_mesh", cols["INT"], bevel=0)
        root = mk.interactive(key, label, (cx, cy, 0), cols["INT"])
        mk.parent(mesh, root)
        root["room_number"] = cfg["meeting_rooms"].index(room) + 1
        root["clock_wall_axis_y"] = art_y
        door(cols, room, width)
        C = cols["COLLISION"]
        for name, pos, size in (
            ("san", (cx, cy, -.2), (x1 - x0, y1 - y0, .4)),
            ("bac", (cx, y1, height / 2), (x1 - x0, .16, height)),
            ("tay", (x0, cy, height / 2), (.16, y1 - y0, height)),
            ("dong", (x1, cy, height / 2), (.16, y1 - y0, height)),
            ("ban", (cx, cy + .3, .4), (3.9, 1.6, .8)),
        ):
            mk.collider(f"{key}_{name}", pos, size, C)
        for side, lo, hi in (("trai", x0, cx - width / 2), ("phai", cx + width / 2, x1)):
            mk.collider(f"{key}_{side}", ((lo + hi) / 2, y0, height / 2), (hi - lo, .16, height), C)
        out[key] = tuple(room["bounds"])
    return out
