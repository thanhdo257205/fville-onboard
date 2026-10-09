"""MeshBuilder: ghép nhiều khối cơ bản (hộp, trụ, cầu, lăng trụ...) thành MỘT object.

Mỗi mặt mang chỉ số màu (face attribute "pal") + chỉ số chất liệu. Sau khi tạo object và
apply bevel, màu được ghi ra vertex color "Color" (BYTE_COLOR, CORNER) — glTF xuất thành COLOR_0.

Toạ độ trong builder là toạ độ LOCAL của object; đặt vị trí object bằng obj.location.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from .palette import PALETTE, hex_to_srgb
from . import materials
from . import quality as Q

PAL_NAMES = list(PALETTE.keys())


def T(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """Ma trận biến đổi. rot tính bằng độ (XYZ)."""
    r = Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
    s = Matrix.Diagonal((*scale, 1.0))
    return Matrix.Translation(loc) @ r @ s


class MeshBuilder:
    def __init__(self):
        self.bm = bmesh.new()
        self.pal = self.bm.faces.layers.int.new("pal")
        self.mats = []  # tên chất liệu theo thứ tự slot

    # ---------- nội bộ ----------
    def _mat_index(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _paint(self, faces, color, mat):
        ci = PAL_NAMES.index(color)
        mi = self._mat_index(mat)
        for f in faces:
            f[self.pal] = ci
            f.material_index = mi

    @staticmethod
    def _faces_of(verts):
        return {f for v in verts for f in v.link_faces}

    # ---------- khối cơ bản ----------
    def raw(self, verts, faces, color, mat="palette", matrix=None):
        bm = self.bm
        m = matrix or Matrix()
        vs = [bm.verts.new(m @ Vector(v)) for v in verts]
        fs = [bm.faces.new([vs[i] for i in f]) for f in faces]
        self._paint(fs, color, mat)
        return fs

    def box(self, center, size, color, rot=(0, 0, 0), mat="palette"):
        m = T(center, rot, size)
        vs = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)["verts"]
        self._paint(self._faces_of(vs), color, mat)

    def box_minmax(self, lo, hi, color, mat="palette"):
        c = [(a + b) / 2 for a, b in zip(lo, hi)]
        s = [abs(b - a) for a, b in zip(lo, hi)]
        self.box(c, s, color, mat=mat)

    def cylinder(self, base, radius, height, color, segments=8, radius_top=None,
                 rot=(0, 0, 0), mat="palette", cap=True):
        """Trụ đứng, đáy tại base (sau khi xoay quanh base)."""
        rt = radius if radius_top is None else radius_top
        m = T(base, rot) @ Matrix.Translation((0, 0, height / 2))
        vs = bmesh.ops.create_cone(self.bm, cap_ends=cap, cap_tris=False, segments=Q.seg(segments),
                                   radius1=radius, radius2=rt, depth=height, matrix=m)["verts"]
        self._paint(self._faces_of(vs), color, mat)

    def tube(self, p0, p1, radius, color, segments=6, radius_end=None, mat="palette"):
        """Trụ nối 2 điểm bất kỳ (cánh tay, sào, cây tre...)."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        re = radius if radius_end is None else radius_end
        m = Matrix.Translation(p0) @ rot @ Matrix.Translation((0, 0, d.length / 2))
        vs = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=Q.seg(segments),
                                   radius1=radius, radius2=re, depth=d.length, matrix=m)["verts"]
        self._paint(self._faces_of(vs), color, mat)

    def sphere(self, center, radius, color, segments=10, rings=6, scale=(1, 1, 1),
               rot=(0, 0, 0), mat="palette"):
        m = T(center, rot, scale)
        smooth_more = segments >= 7  # cầu nhỏ dạng lá (≤ 6 cạnh) giữ nguyên
        vs = bmesh.ops.create_uvsphere(self.bm, u_segments=Q.seg(segments),
                                       v_segments=Q.rings(rings) if smooth_more else rings,
                                       radius=radius, matrix=m)["verts"]
        self._paint(self._faces_of(vs), color, mat)

    def ico(self, center, radius, color, subdiv=1, scale=(1, 1, 1), rot=(0, 0, 0), mat="palette"):
        m = T(center, rot, scale)
        vs = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=radius, matrix=m)["verts"]
        self._paint(self._faces_of(vs), color, mat)

    def disc(self, center, radius, color, segments=12, rot=(0, 0, 0), mat="palette"):
        m = T(center, rot)
        vs = bmesh.ops.create_circle(self.bm, cap_ends=True, cap_tris=False, segments=Q.seg(segments),
                                     radius=radius, matrix=m)["verts"]
        self._paint(self._faces_of(vs), color, mat)

    def prism(self, poly, z0, z1, color, top_color=None, mat="palette", matrix=None, cap_bottom=False):
        """Lăng trụ đứng từ đa giác 2D (ngược chiều kim đồng hồ), từ z0 đến z1."""
        n = len(poly)
        verts = [(x, y, z0) for x, y in poly] + [(x, y, z1) for x, y in poly]
        sides = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        self.raw(verts, sides, color, mat, matrix)
        self.raw(verts, [tuple(range(n, 2 * n))], top_color or color, mat, matrix)
        if cap_bottom:
            self.raw(verts, [tuple(reversed(range(n)))], color, mat, matrix)

    def quad(self, pts, color, mat="palette"):
        self.raw(pts, [tuple(range(len(pts)))], color, mat)

    def torus(self, center, R, r, color, seg=12, seg2=6, rot=(0, 0, 0), scale=(1, 1, 1), mat="palette"):
        """Hình xuyến nằm trong mặt phẳng XY (trục Z) trước khi xoay."""
        verts, faces = [], []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            for j in range(seg2):
                b = 2 * math.pi * j / seg2
                d = R + r * math.cos(b)
                verts.append((d * math.cos(a), d * math.sin(a), r * math.sin(b)))
        for i in range(seg):
            for j in range(seg2):
                a, b = i * seg2 + j, i * seg2 + (j + 1) % seg2
                c, d = ((i + 1) % seg) * seg2 + (j + 1) % seg2, ((i + 1) % seg) * seg2 + j
                faces.append((a, d, c, b))
        self.raw(verts, faces, color, mat, T(center, rot, scale))

    def grid(self, x0, y0, x1, y1, z, cell, colors, mat="palette", jitter=None):
        """Mặt phẳng chia ô, tô màu xen kẽ (gợi ý họa tiết gạch lát). colors: list tên màu."""
        nx, ny = max(1, round((x1 - x0) / cell)), max(1, round((y1 - y0) / cell))
        dx, dy = (x1 - x0) / nx, (y1 - y0) / ny
        bm = self.bm
        vs = [[bm.verts.new((x0 + i * dx, y0 + j * dy, z)) for j in range(ny + 1)] for i in range(nx + 1)]
        for i in range(nx):
            for j in range(ny):
                f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
                k = (i + j) % len(colors) if jitter is None else jitter(i, j) % len(colors)
                self._paint([f], colors[k], mat)

    def merge(self, dist=0.0005):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=dist)

    def add_mesh(self, me, color, mat="palette", matrix=None):
        """Chép hình khối của một mesh có sẵn (vd chữ 3D từ font) vào builder."""
        m = matrix or Matrix()
        vs = [self.bm.verts.new(m @ v.co) for v in me.vertices]
        fs = []
        for p in me.polygons:
            try:
                fs.append(self.bm.faces.new([vs[i] for i in p.vertices]))
            except ValueError:
                pass  # mặt trùng
        self._paint(fs, color, mat)

    # ---------- tạo object ----------
    def to_object(self, name, collection=None, location=(0, 0, 0), bevel=0.0, bevel_angle=60,
                  smooth_angle=None, mats=None, tint=None, subdiv_high=False):
        """tint: None | "foliage" (sáng dần lên trên) | "ground" (loang màu tự nhiên theo vị trí).
        subdiv_high: bản cao làm mịn 1 cấp (Subdivision Surface) — cho tượng, khối hữu cơ."""
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        obj = bpy.data.objects.new(name, me)
        (collection or bpy.context.scene.collection).objects.link(obj)
        obj.location = location
        for m in self.mats:
            me.materials.append(materials.get(m))
        if bevel > 0:
            mod = obj.modifiers.new("Bevel", "BEVEL")
            mod.width = bevel
            mod.segments = 1
            mod.limit_method = "ANGLE"
            mod.angle_limit = math.radians(bevel_angle)
            mod.harden_normals = False
            apply_modifiers(obj)
        if subdiv_high and Q.HIGH:
            mod = obj.modifiers.new("Subsurf", "SUBSURF")
            mod.levels = mod.render_levels = 1
            apply_modifiers(obj)
        finalize_mesh(obj, smooth_angle, tint)
        if any(m in materials.TEXTURES for m in self.mats):
            mpt = [materials.TEXTURES[m][1] if m in materials.TEXTURES else 1.0 for m in self.mats]
            box_uv(obj, mpt)
        return obj


def box_uv(obj, mpt_by_slot):
    """UV chiếu theo hướng mặt (trên/dưới → XY, hướng X → YZ, hướng Y → XZ) theo toạ độ thế giới
    (bỏ qua góc xoay) → texture lát liền giữa các object và dán đúng cả lên mặt đứng."""
    me = obj.data
    uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    ox, oy, oz = obj.location
    co = [0.0] * (len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    data = [0.0] * (len(me.loops) * 2)
    for p in me.polygons:
        nx, ny, nz = (abs(c) for c in p.normal)
        s = mpt_by_slot[p.material_index] if p.material_index < len(mpt_by_slot) else 1.0
        for li in p.loop_indices:
            v = me.loops[li].vertex_index
            x, y, z = co[v * 3] + ox, co[v * 3 + 1] + oy, co[v * 3 + 2] + oz
            if nz >= nx and nz >= ny:
                u, w = x, y
            elif nx >= ny:
                u, w = y, z
            else:
                u, w = x, z
            data[li * 2] = u / s
            data[li * 2 + 1] = w / s
    uv.data.foreach_set("uv", data)


def _hash(i, j):
    h = (i * 374761393 + j * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h & 0xFFFF) / 32767.5 - 1.0


def vnoise(x, y):
    """Value noise mượt trong [-1, 1]."""
    i, j = math.floor(x), math.floor(y)
    fx, fy = x - i, y - j
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(i, j), _hash(i + 1, j)
    c, d = _hash(i, j + 1), _hash(i + 1, j + 1)
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy


def _tint_factor(kind, pos, nrm):
    if kind == "foliage":   # ánh sáng trời dịu: mặt trên sáng, mặt dưới tối (kiểu hoạt hình)
        return 0.74 + 0.38 * (nrm[2] * 0.5 + 0.5) + 0.05 * vnoise(pos[0] * 0.7, pos[1] * 0.7)
    if kind == "ground":    # loang màu nhẹ ở hai tầng tần số
        return 1.0 + 0.09 * vnoise(pos[0] / 9.0, pos[1] / 9.0) + 0.05 * vnoise(pos[0] / 2.7 + 13, pos[1] / 2.7 + 7)
    return 1.0


def apply_modifiers(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    name = old.name
    obj.modifiers.clear()
    obj.data = me
    bpy.data.meshes.remove(old)
    me.name = name


def finalize_mesh(obj, smooth_angle=None, tint=None):
    """Đặt cạnh sắc theo góc, rồi ghi vertex color từ 'pal' (nhân hệ số tint nếu có)."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    smooth = smooth_angle is not None
    for f in bm.faces:
        f.smooth = smooth
    if smooth:
        lim = math.radians(smooth_angle)
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
                e.smooth = False
    bm.to_mesh(me)
    bm.free()

    pal = me.attributes.get("pal")
    if "Color" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["Color"])
    col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    srgb = [(*hex_to_srgb(PALETTE[n]), 1.0) for n in PAL_NAMES]
    loop_cols = [0.0] * (len(me.loops) * 4)
    face_pal = [0] * len(me.polygons)
    if pal:
        pal.data.foreach_get("value", face_pal)
    if tint:
        nrm = [0.0] * (len(me.loops) * 3)
        me.corner_normals.foreach_get("vector", nrm)
        co = [0.0] * (len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        ox, oy, oz = obj.location
    for p in me.polygons:
        c = srgb[face_pal[p.index]]
        for li in p.loop_indices:
            if tint:
                v = me.loops[li].vertex_index
                pos = (co[v * 3] + ox, co[v * 3 + 1] + oy, co[v * 3 + 2] + oz)
                f = _tint_factor(tint, pos, nrm[li * 3:li * 3 + 3])
                loop_cols[li * 4:li * 4 + 4] = (min(1.0, c[0] * f), min(1.0, c[1] * f), min(1.0, c[2] * f), 1.0)
            else:
                loop_cols[li * 4:li * 4 + 4] = c
    col.data.foreach_set("color_srgb", loop_cols)
    me.color_attributes.active_color = col
    me.color_attributes.render_color_index = me.color_attributes.find("Color")


def tri_count(obj):
    if obj.type != "MESH":
        return 0
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)
