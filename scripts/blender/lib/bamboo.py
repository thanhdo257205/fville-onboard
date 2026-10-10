"""Bụi tre zone_02 từ mô hình Sketchfab, dựng lại bản low-poly từ file gốc mỗi lần build zone (cùng cách bàn bi-a).

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/bamboo/source/bamboo_tree.glb
  "bamboo tree" — tojamerlin, CC BY 4.0
  https://sketchfab.com/3d-models/bamboo-tree-d0161434cf6844a8bc6eaeb0c0692ed0 (glTF asset.extras)
  178k tam giác, 10,6 MB, đơn vị cm: 1 bụi cao 4,3 m — 14 thân (Trunk, mỗi thân 1 mảnh liền) + ~7.800 lá thật (Leaf_0,
  Leaf_0.001, mỗi lá 1 mảnh liền ~14–22 tam giác) + cỏ gốc (Mf_Grass); 4 ảnh 256 × 1024 (thân, normal, cỏ, lá).

Dựng lại (không giảm lưới gốc — lưới lá quá vụn, giảm thẳng sẽ nát):
  1. Thân: mỗi mảnh liền lớn của Trunk → trục (PCA), đáy / ngọn, bán kính → trụ STALK_SIDES cạnh × STALK_SEGS đoạn, thu
     nhỏ dần lên ngọn. UV: u quanh thân trong ô thân của atlas, v = độ cao / NODE_TILE (lặp → đốt tre đúng cỡ thật).
  2. Lá: mỗi lá (mảnh liền dài ≥ LEAF_MIN) → PCA: hướng dọc lá, bề ngang, pháp tuyến → lá hình thoi 2 tam giác gập
     nhẹ theo gân (gốc = đầu cao hơn: lá tre rủ xuống). Chọn ngẫu nhiên LEAF_COUNT lá (hạt giống cố định), phóng
     LEAF_SCALE để tán vẫn dày. UV: ô lá của atlas (gân giữa lá dọc theo lá).
  3. Bỏ cỏ gốc (18,8k tam giác).
  4. Atlas ATLAS_SIZE: [thân | lá], mỗi ô hết chiều cao (v lặp được). 2 chất liệu dùng chung ảnh: M_bamboo_stalk (thân) và
     M_bamboo_leaf (lá, 2 mặt), cả hai custom property outline = False (game không vẽ viền nét, như cây) = ảnh × vertex color
     "Color" (AO zone) → toon như mọi vật.
  Kết quả: 1 mesh `bamboo` (gốc = tâm gốc bụi trên mặt đất), zone_02 đặt nhiều object dùng chung mesh này (instancing).
"""
import math
import os
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

from . import pool_table

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC_DIR = os.path.join(ROOT, "assets", "props", "bamboo", "source")
SRC = os.path.join(SRC_DIR, "bamboo_tree.glb")
ATLAS = os.path.join(SRC_DIR, "bamboo_atlas.png")            # sinh ra mỗi lần build (chỉ ở máy làm việc)
SOURCE_INFO = {"title": "bamboo tree", "author": "tojamerlin", "license": "CC BY 4.0",
               "url": "https://sketchfab.com/3d-models/bamboo-tree-d0161434cf6844a8bc6eaeb0c0692ed0"}

ATLAS_SIZE = (256, 512)
RECTS = {"stalk": (0, 0, 128, 512), "leaf": (128, 0, 128, 512)}
STALK_MIN_H = 1.5            # m — mảnh liền của Trunk cao hơn mức này mới là thân (còn lại: cành, mắt nhỏ → bỏ)
STALK_SIDES = 5
STALK_SEGS = 4
NODE_TILE = 1.6              # m — chiều cao 1 lần lặp ảnh thân (5 đốt → đốt ~32 cm)
LEAF_MIN = 0.08              # m — mảnh liền ngắn hơn: cuống, vụn
LEAF_COUNT = 600             # đo FPS zone_02 (GPU tích hợp): 1.100 lá × 4 bụi tốn ~0,3 ms/khung → bớt lá, phóng lá to hơn
LEAF_SCALE = 1.5
SEED = 2026
BATCH = "ENV_cay_tre"        # tên nhóm gộp trong game (khớp see_through.meshes "^ENV_(vegetation|cay_)")
_built = {}

_co = pool_table._co
_tris = pool_table._tris


def load_source(collection):
    """Nhập GLB vào `collection`, transform vào đỉnh (cm → m). → {"trunk", "grass", "leaves": [obj, …]}"""
    if not os.path.exists(SRC):
        raise FileNotFoundError(
            f"thiếu mô hình bụi tre gốc: {os.path.relpath(SRC, ROOT)} — chép bamboo_tree.glb "
            f"(Sketchfab, tojamerlin, CC BY 4.0: {SOURCE_INFO['url']}) vào đây (file gốc không có trên repo)")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    parts = {"trunk": None, "grass": None, "leaves": []}
    for o in new:
        if o.type != "MESH":
            continue
        mw = o.matrix_world.copy()
        o.parent = None
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)
        n = o.name.lower()
        if "trunk" in n:
            parts["trunk"] = o
        elif "grass" in n:
            parts["grass"] = o
        elif "leaf" in n:
            parts["leaves"].append(o)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    if parts["trunk"] is None or not parts["leaves"]:
        raise RuntimeError(f"mô hình bụi tre khác dự kiến: {[o.name for o in new]}")
    h = float(_co(parts["trunk"])[:, 2].max())
    if h > 50:                                            # đơn vị cm (glTF Sketchfab giữ scale 0.01 ở node cha)
        for o in [parts["trunk"], parts["grass"], *parts["leaves"]]:
            if o:
                o.data.transform(Matrix.Scale(0.01, 4))
    return parts


def _components(obj):
    """Nhãn mảnh liền cho từng đỉnh (theo cạnh)."""
    me = obj.data
    e = np.empty(len(me.edges) * 2, np.int64)
    me.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    lab = np.arange(len(me.vertices))
    while True:
        old = lab.copy()
        np.minimum.at(lab, e[:, 0], lab[e[:, 1]])
        np.minimum.at(lab, e[:, 1], lab[e[:, 0]])
        lab = lab[lab]
        if (lab == old).all():
            return lab


def _pca(pts):
    c = pts.mean(0)
    _, _, vt = np.linalg.svd(pts - c, full_matrices=False)
    return c, vt                                          # vt[0] = hướng dài nhất, vt[2] = pháp tuyến (lá)


def measure_stalks(trunk):
    """→ [(đáy, ngọn, bán kính)] (Vector, Vector, float) — mỗi thân 1 mảnh liền cao ≥ STALK_MIN_H."""
    co = _co(trunk)
    lab = _components(trunk)
    out = []
    for i in np.unique(lab):
        p = co[lab == i]
        if np.ptp(p[:, 2]) < STALK_MIN_H:
            continue
        c, vt = _pca(p)
        d = vt[0] if vt[0][2] > 0 else -vt[0]
        t = (p - c) @ d
        base, top = c + d * t.min(), c + d * t.max()
        r = float(np.median(np.linalg.norm((p - c) - np.outer((p - c) @ d, d), axis=1)[t < np.percentile(t, 40)]))
        out.append((Vector(base), Vector(top), r))
    return out


def measure_leaves(leaves):
    """→ [(gốc, ngọn, vector bề ngang (nửa), pháp tuyến)] cho mọi lá dài ≥ LEAF_MIN."""
    out = []
    for o in leaves:
        co = _co(o)
        lab = _components(o)
        order = np.argsort(lab, kind="stable")
        ids, starts = np.unique(lab[order], return_index=True)
        for k in range(len(ids)):
            p = co[order[starts[k]:starts[k + 1] if k + 1 < len(ids) else None]]
            if len(p) < 4:
                continue
            c, vt = _pca(p)
            t = (p - c) @ vt[0]
            if t.max() - t.min() < LEAF_MIN:
                continue
            a, b = c + vt[0] * t.min(), c + vt[0] * t.max()
            base, tip = (a, b) if a[2] >= b[2] else (b, a)
            w = float(np.percentile(np.abs((p - c) @ vt[1]), 90))
            out.append((base, tip, vt[1] * w, vt[2]))
    return out


def build_mesh(name, stalks, leaves, mat_stalk, mat_leaf):
    W, H = ATLAS_SIZE
    sx, _, sw, _ = RECTS["stalk"]
    lx, _, lw, _ = RECTS["leaf"]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")

    def face(vs, uvs, mat):
        f = bm.faces.new(vs)
        f.material_index = mat
        for lp, t in zip(f.loops, uvs):
            lp[uv].uv = t
    # thân: trụ thu nhỏ dần, u quanh thân trong ô thân (chừa 2 px mép), v lặp theo độ cao
    u0, u1 = (sx + 2) / W, (sx + sw - 2) / W
    for base, top, r in stalks:
        axis = (top - base).normalized()
        side = axis.cross(Vector((0, 0, 1)) if abs(axis.z) < 0.99 else Vector((1, 0, 0))).normalized()
        if side.length < 0.5:
            side = Vector((1, 0, 0))
        fwd = axis.cross(side)
        rings = []
        for s in range(STALK_SEGS + 1):
            f = s / STALK_SEGS
            c = base.lerp(top, f)
            rr = r * (1.0 - 0.35 * f)
            rings.append([bm.verts.new(c + (side * math.cos(a) + fwd * math.sin(a)) * rr)
                          for a in (2 * math.pi * k / STALK_SIDES for k in range(STALK_SIDES))])
        for s in range(STALK_SEGS):
            v0, v1 = (base.lerp(top, s / STALK_SEGS).z) / NODE_TILE, (base.lerp(top, (s + 1) / STALK_SEGS).z) / NODE_TILE
            for k in range(STALK_SIDES):
                k1 = (k + 1) % STALK_SIDES
                ua, ub = u0 + (u1 - u0) * k / STALK_SIDES, u0 + (u1 - u0) * (k + 1) / STALK_SIDES
                face([rings[s][k], rings[s][k1], rings[s + 1][k1], rings[s + 1][k]],
                     [(ua, v0), (ub, v0), (ub, v1), (ua, v1)], 0)
    # lá: thoi 2 tam giác gập theo gân (gốc → ngọn), chỗ rộng nhất ở 35 % chiều dài
    um, uw = (lx + lw / 2) / W, (lw / 2 - 2) / W
    for base, tip, half, nrm in leaves:
        mid = base.lerp(tip, 0.35)
        L = (tip - base).length
        b = [bm.verts.new(p) for p in (base, mid + half * LEAF_SCALE + nrm * 0.08 * L, tip,
                                         mid - half * LEAF_SCALE + nrm * 0.08 * L)]
        face([b[0], b[1], b[2]], [(um, 0.02), (um + uw, 0.35), (um, 0.98)], 1)
        face([b[0], b[2], b[3]], [(um, 0.02), (um, 0.98), (um - uw, 0.35)], 1)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat_stalk)
    me.materials.append(mat_leaf)
    col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", np.ones(len(me.loops) * 4, np.float32))
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(50))
    return me


def make_atlas(trunk, leaves):
    W, H = ATLAS_SIZE
    atlas = np.ones((H, W, 4), np.float32)
    for k, src in (("stalk", pool_table._base_image(trunk.data.materials[0])),
                   ("leaf", pool_table._base_image(leaves[0].data.materials[0]))):
        x, y, w, h = RECTS[k]
        atlas[y:y + h, x:x + w, :3] = pool_table._resized(src, w, h)[..., :3]
    img = bpy.data.images.new("bamboo_atlas", W, H, alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(atlas.ravel())
    img.filepath_raw = ATLAS
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(ATLAS, check_existing=False)


def build(collection, name="bamboo", log=print):
    """Dựng mesh bụi tre (gốc = tâm gốc bụi trên mặt đất), xoá lưới gốc. → (mesh, báo cáo). 1 lần mỗi lần build zone."""
    if _built.get(name):
        return _built[name]
    parts = load_source(collection)
    src = {"trunk": _tris(parts["trunk"]), "leaves": sum(_tris(o) for o in parts["leaves"]),
           "grass": _tris(parts["grass"]) if parts["grass"] else 0}
    stalks = measure_stalks(parts["trunk"])
    leaves = measure_leaves(parts["leaves"])
    rng = random.Random(SEED)
    picked = rng.sample(leaves, min(LEAF_COUNT, len(leaves)))
    img = make_atlas(parts["trunk"], parts["leaves"])
    m_stalk = pool_table.make_material(img, "M_bamboo_stalk")
    m_stalk["outline"] = False                             # như cây (lib/trees.py): cây cối không viền nét — đo FPS
    m_leaf = pool_table.make_material(img, "M_bamboo_leaf")
    m_leaf.use_backface_culling = False                    # lá 2 mặt (glTF doubleSided)
    m_leaf["outline"] = False                              # game: không vẽ viền nét trên lá
    # gốc = tâm gốc bụi (trung bình đáy các thân) trên mặt đất
    foot = sum((b for b, _, _ in stalks), Vector()) / len(stalks)
    foot.z = min(b.z for b, _, _ in stalks)
    shift = Matrix.Translation(-foot)
    stalks = [(shift @ b, shift @ t, r) for b, t, r in stalks]
    picked = [(shift @ Vector(b), shift @ Vector(t), Vector(h), Vector(n)) for b, t, h, n in picked]
    me = build_mesh(name, stalks, picked, m_stalk, m_leaf)
    old_mats = {m for o in [parts["trunk"], parts["grass"], *parts["leaves"]] if o for m in o.data.materials}
    for o in [parts["trunk"], parts["grass"], *parts["leaves"]]:
        if o:
            data = o.data
            bpy.data.objects.remove(o)
            if data.users == 0:
                bpy.data.meshes.remove(data)
    for om in old_mats:
        if om and om.users == 0:
            bpy.data.materials.remove(om)
    for im in [i for i in bpy.data.images if i.users == 0]:
        bpy.data.images.remove(im)
    co = np.array([v.co[:] for v in me.vertices])
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    info = {"src_tris": src, "tris": tris, "stalks": len(stalks), "leaves": [len(picked), len(leaves)],
            "size": np.ptp(co, axis=0).round(2).tolist(), "height": round(float(co[:, 2].max()), 2),
            "radius_base": round(float(max(Vector((b.x, b.y)).length + r for b, _, r in stalks)), 2), "source": SOURCE_INFO}
    log(f"[bụi tre] {sum(src.values())} → {tris} tam giác: {len(stalks)} thân, {len(picked)}/{len(leaves)} lá; "
        f"cao {info['height']} m, tán {info['size'][0]} × {info['size'][1]} m, gốc rộng r {info['radius_base']} m")
    _built[name] = (me, info)
    return me, info


def place(collection, spots, log=print):
    """Bản sao bụi tre dùng chung lưới tại spots [(x, y, z, cao m)], xoay ngẫu nhiên (hạt giống riêng).
    → [(object, bán kính gốc thật m)] — zone đặt COL_ ở gốc theo bán kính này."""
    me, info = build(collection, log=log)
    rng = random.Random(SEED + 1)
    out = []
    for i, (x, y, z, h) in enumerate(spots):
        s = h / info["height"]
        o = bpy.data.objects.new(f"{BATCH}_{i:02d}", me)
        collection.objects.link(o)
        o.location = (x, y, z)
        o.rotation_euler = (0, 0, rng.uniform(0, 2 * math.pi))
        o.scale = (s, s, s)
        o["batch"] = BATCH
        out.append((o, info["radius_base"] * s))
    log(f"[bụi tre] {len(out)} bụi dùng chung 1 lưới")
    return out
