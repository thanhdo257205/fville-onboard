"""Cây ngoài trời (zone 0–3) từ mô hình Sketchfab, dựng lại từ file gốc mỗi lần build zone (cùng cách bàn bi-a).

File gốc (KHÔNG có trên repo, chỉ ở máy làm việc): assets/props/tree/source/tree_low_poly_lowpoly.glb
  "Tree low poly lowpoly" — 00amza, CC BY 4.0
  https://sketchfab.com/3d-models/tree-low-poly-lowpoly-73201f05280d48dcb10ed4ca362d69f8 (glTF asset.extras)
  2 cây (816 + 813 tam giác) cao 9,0 / 8,5 m: thân + cành (ảnh vỏ cây lặp dọc) và các mảng lá (ảnh cành lá có alpha), chung
  1 chất liệu BLEND và 1 ảnh 256² (trái: cành lá, phải: vỏ cây).

Các bước:
  1. Nhập, đưa transform vào đỉnh. Tách mặt theo UV: u > 0,66 = vỏ cây (chất liệu M_tree_bark), còn lại = lá
     (M_tree_leaf). Gốc mỗi cây = tâm gốc thân trên mặt đất.
  2. Lá: alpha cắt (glTF MASK, ngưỡng 0,5 — không blend → không lỗi thứ tự vẽ), 2 mặt, custom property outline = False
     (game không vẽ viền nét quanh mảng lá; thân cây cũng không viền — đo FPS: viền thân tốn ~0,3 ms/khung ở zone_02). Pháp tuyến lá hướng từ tâm tán ra ngoài → tán sáng / tối mềm như khối tròn
     khi tô toon (mảng lá phẳng giữ pháp tuyến riêng thì loang lổ).
     Mảng lá cắt sát theo đa giác LEAF_SIDES cạnh bao quanh cành lá trên ảnh (đo từ alpha): ảnh cành lá chỉ phủ 21 % ô
     ảnh, phần trong suốt GPU vẫn tô rồi bỏ → cắt bỏ được ~44 % điểm ảnh lá phải tô (đo FPS zone_02, GPU tích hợp).
     Cây gần bỏ NEAR_DROP số mảng lá; bản cây xa (`*_xa`, kit.tree detail 1: rừng sau tường, cây phía nam đường, sân
     zone_03) bỏ FAR_DROP.
  3. Ảnh: LEAF_TOON → màu lá đổi về 3 tông xanh của bảng màu game theo độ sáng (phẳng kiểu hoạt hình, hợp cây cũ),
     vỏ cây giữ nguyên. Cả 2 chất liệu = ảnh × vertex color "Color" (AO zone).
  4. place(): đặt bản sao dùng chung lưới (instancing) theo danh sách chỗ đặt mà kit.tree() ghi lại (kit.TREES) — giữ
     nguyên chỗ / chiều cao cây như trước; xoay + chọn 1 trong 2 cây theo hạt giống riêng (không đụng rng của zone).
     Mỗi bản sao có custom property batch → game gộp các bản sao thành 1 lượt vẽ mỗi chất liệu (world/zone.js
     batchInstances), mỗi cây 1 số riêng để làm mờ khi che camera (render/seethrough.js).
"""
import math
import os
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

from . import pool_table

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC_DIR = os.path.join(ROOT, "assets", "props", "tree", "source")
SRC = os.path.join(SRC_DIR, "tree_low_poly_lowpoly.glb")
TEX = os.path.join(SRC_DIR, "tree_tex.png")                 # sinh ra mỗi lần build (chỉ ở máy làm việc)
SOURCE_INFO = {"title": "Tree low poly lowpoly", "author": "00amza", "license": "CC BY 4.0",
               "url": "https://sketchfab.com/3d-models/tree-low-poly-lowpoly-73201f05280d48dcb10ed4ca362d69f8"}
BARK_U = 0.66                # u trung bình của mặt > ngưỡng này = vỏ cây (ảnh gốc: 2/3 trái cành lá, 1/3 phải vỏ cây)
LEAF_TOON = True
LEAF_TONES = ("#3B6E2E", "#4E8A3A", "#6BA94A", "#8DB848")   # leaf_dark, leaf, leaf_light, leaf_yellow (lib/palette.py)
BATCH = "ENV_cay_lo"         # tên nhóm gộp trong game (khớp see_through.meshes "^ENV_(vegetation|cay_)")
SEED = 2026
LEAF_SIDES = 8
NEAR_DROP = 0.2             # tỉ lệ mảng lá bỏ bớt: cây gần / cây xa (đo FPS zone_02, GPU tích hợp)
FAR_DROP = 0.45

_co = pool_table._co
_tris = pool_table._tris
_meshes = {}                 # build_meshes() 1 lần mỗi lần build zone


def _rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


def load_source(collection):
    """Nhập GLB vào `collection`, transform vào đỉnh. → [obj cây 1, obj cây 2]"""
    if not os.path.exists(SRC):
        raise FileNotFoundError(
            f"thiếu mô hình cây gốc: {os.path.relpath(SRC, ROOT)} — chép tree_low_poly_lowpoly.glb "
            f"(Sketchfab, 00amza, CC BY 4.0: {SOURCE_INFO['url']}) vào đây (file gốc không có trên repo)")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SRC)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    trees = []
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
        trees.append(o)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    if len(trees) != 2:
        raise RuntimeError(f"mô hình cây khác dự kiến: {[o.name for o in new]}")
    return sorted(trees, key=lambda o: o.name)


def make_texture(src_img):
    """Ảnh gốc (RGBA) → ảnh build: lá đổi về tông bảng màu game (LEAF_TOON), giữ alpha và vỏ cây."""
    W, H = src_img.size
    px = pool_table._pixels(src_img).copy()                      # (H, W, 4), hàng dưới trước
    if LEAF_TOON:
        leaf = (np.arange(W) < BARK_U * W)[None, :] & (px[..., 3] > 0.05)
        lum = px[..., :3] @ np.array([0.3, 0.55, 0.15], np.float32)
        green = leaf & (px[..., 1] > px[..., 0] * 0.95)            # cành nâu giữ màu gốc
        q = np.clip(np.digitize(lum, np.percentile(lum[green], [30, 62, 88])), 0, len(LEAF_TONES) - 1)
        tones = np.stack([_rgb(t) for t in LEAF_TONES])
        px[..., :3] = np.where(green[..., None], tones[q], px[..., :3])
    img = bpy.data.images.new("tree_tex", W, H, alpha=True)
    img.colorspace_settings.name = "sRGB"
    img.alpha_mode = "STRAIGHT"
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = TEX
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(TEX, check_existing=False)


def leaf_material(img):
    """Ảnh × vertex color, alpha cắt (Math Round → glTF MASK 0,5), 2 mặt, không viền nét (custom property)."""
    mat = pool_table.make_material(img, "M_tree_leaf")
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
    rnd = nt.nodes.new("ShaderNodeMath")
    rnd.operation = "ROUND"
    nt.links.new(tex.outputs["Alpha"], rnd.inputs[0])
    nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    mat.use_backface_culling = False
    try:
        mat.surface_render_method = "DITHERED"
    except (AttributeError, TypeError):
        pass
    mat["outline"] = False
    return mat


def leaf_polygon(img, sides=LEAF_SIDES, pad=2.0):
    """Đa giác lồi `sides` cạnh (toạ độ UV) bao mọi điểm ảnh lá có alpha > 0,3 (+ pad px) trong ô cành lá của ảnh."""
    W, H = img.size
    px = pool_table._pixels(img)
    a = px[:, :int(BARK_U * W), 3]
    ys, xs = np.nonzero(a > 0.3)
    pts = np.stack([(xs + 0.5) / W, (ys + 0.5) / H], 1)            # hàng dưới trước = v tăng dần
    d = np.array([[math.cos(2 * math.pi * i / sides), math.sin(2 * math.pi * i / sides)] for i in range(sides)])
    h = (pts @ d.T).max(0) + pad / W
    return [np.linalg.solve(np.array([d[i], d[(i + 1) % sides]]), [h[i], h[(i + 1) % sides]]) for i in range(sides)]


def _clip(poly, edges):
    """Sutherland–Hodgman: cắt đa giác (danh sách điểm UV kèm toạ độ trọng tâm) theo đa giác lồi (cạnh ngược chiều kim
    đồng hồ). poly: [(uv, bary)]."""
    for a, b in edges:
        n = np.array([b[1] - a[1], a[0] - b[0]])                      # pháp tuyến ra ngoài
        out = []
        for i, (p, w) in enumerate(poly):
            q, wq = poly[i - 1]
            dp, dq = (p - a) @ n, (q - a) @ n
            if dp <= 0:
                if dq > 0:
                    t = dq / (dq - dp)
                    out.append((q + (p - q) * t, wq + (w - wq) * t))
                out.append((p, w))
            elif dq <= 0:
                t = dq / (dq - dp)
                out.append((q + (p - q) * t, wq + (w - wq) * t))
        poly = out
        if not poly:
            break
    return poly


def trim_leaves(obj, bark, poly, drop=0.0, rng=None):
    """Lưới mới: mặt vỏ giữ nguyên; mỗi tam giác lá cắt theo poly (UV) → đa giác (bỏ phần ngoài cành lá). drop > 0: bỏ
    ngẫu nhiên tỉ lệ đó số mảng lá (mảng = nhóm tam giác lá liền nhau). → mảng bool vỏ / lá theo mặt của lưới mới."""
    me = obj.data
    co = _co(obj)
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers[0].data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    edges = [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]
    keep_leaf = None
    if drop > 0:                                                    # mảng lá = mảnh liền của các mặt lá
        par = list(range(len(me.vertices)))

        def find(x):
            while par[x] != x:
                par[x] = par[par[x]]
                x = par[x]
            return x
        for p, b in zip(me.polygons, bark):
            if not b:
                for v in p.vertices[1:]:
                    par[find(v)] = find(p.vertices[0])
        cards = sorted({find(p.vertices[0]) for p, b in zip(me.polygons, bark) if not b})
        keep_leaf = set(rng.sample(cards, round(len(cards) * (1 - drop))))
    verts, faces, uvs, is_bark = [], [], [], []
    for p, b in zip(me.polygons, bark):
        li = list(p.loop_indices)
        vi = list(p.vertices)
        if b:
            pts = [(co[v], uv[l]) for v, l in zip(vi, li)]
        else:
            if keep_leaf is not None and find(vi[0]) not in keep_leaf:
                continue
            pts = []
            for k in range(1, len(vi) - 1):                          # quạt tam giác của mặt lá
                tri = [0, k, k + 1]
                tu = [uv[li[t]] for t in tri]
                clipped = _clip([(tu[t], np.eye(3)[t]) for t in range(3)], edges)
                if len(clipped) >= 3:
                    tri_co = np.array([co[vi[t]] for t in tri])
                    face = [(w @ tri_co, q) for q, w in clipped]
                    base = len(verts)
                    verts += [c for c, _ in face]
                    uvs.append([q for _, q in face])
                    faces.append(list(range(base, base + len(face))))
                    is_bark.append(False)
            continue
        base = len(verts)
        verts += [c for c, _ in pts]
        uvs.append([q for _, q in pts])
        faces.append(list(range(base, base + len(pts))))
        is_bark.append(True)
    new = bpy.data.meshes.new(me.name)
    new.from_pydata([tuple(v) for v in verts], [], faces)
    layer = new.uv_layers.new(name="UVMap")
    layer.data.foreach_set("uv", np.concatenate([np.array(u) for u in uvs]).ravel())
    old = obj.data
    obj.data = new
    bpy.data.meshes.remove(old)
    return np.array(is_bark)


def finish_tree(obj, m_bark, m_leaf, poly, drop=0.0, rng=None):
    """Cắt mảng lá theo poly (+ bỏ bớt mảng lá: drop), 2 chất liệu theo UV, vertex color trắng, pháp tuyến lá theo tâm
    tán, gốc = tâm gốc thân trên mặt đất. → (số mặt vỏ, số mặt lá)"""
    me = obj.data
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers[0].data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    bark = np.array([uv[list(p.loop_indices)][:, 0].mean() > BARK_U for p in me.polygons])
    bark = trim_leaves(obj, bark, poly, drop, rng)
    me = obj.data
    bm = bmesh.new()                                               # nối lại đỉnh trùng (vỏ cây mượt như lưới gốc)
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    co = _co(obj)
    vb = sorted({v for p, b in zip(me.polygons, bark) if b for v in p.vertices})
    foot = co[vb][co[vb][:, 2] < co[vb][:, 2].min() + 0.3][:, :2].mean(0)
    me.transform(Matrix.Translation((-foot[0], -foot[1], -co[:, 2].min())))
    me.materials.clear()
    me.materials.append(m_bark)
    me.materials.append(m_leaf)
    me.polygons.foreach_set("material_index", (~bark).astype(np.int32))
    col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    col.data.foreach_set("color", np.ones(len(me.loops) * 4, np.float32))
    me.shade_smooth()
    # pháp tuyến theo góc (mỗi góc của mặt): vỏ cây giữ pháp tuyến mượt của lưới, lá = hướng từ tâm tán (dẹt theo chiều cao)
    co = _co(obj)
    leaf_v = sorted({v for p, b in zip(me.polygons, bark) if not b for v in p.vertices})
    lc = co[leaf_v].mean(0)
    half = np.ptp(co[leaf_v], axis=0) / 2
    loop_v = np.empty(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", loop_v)
    vn = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("normal", vn)
    vn = vn.reshape(-1, 3)
    normals = vn[loop_v].copy()
    leaf_loop = np.zeros(len(me.loops), bool)
    for p, b in zip(me.polygons, bark):
        if not b:
            leaf_loop[p.loop_start:p.loop_start + p.loop_total] = True
    d = (co[loop_v[leaf_loop]] - lc) / np.maximum(half, 1e-3)
    normals[leaf_loop] = d / np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-6)
    me.normals_split_custom_set([tuple(n) for n in normals])
    return int(bark.sum()), int((~bark).sum())


def build_meshes(collection, log=print):
    """4 lưới cây dùng chung cho mọi zone trong lần build: `cay_lo_1`, `cay_lo_2` (đủ lá) và `cay_lo_1_xa`, `cay_lo_2_xa`
    (cây xa, bớt mảng lá). → {"near": [(mesh, chiều cao)], "far": [...]}"""
    if _meshes.get("trees"):
        return _meshes["trees"]
    objs = load_source(collection)
    src_img = pool_table._base_image(objs[0].data.materials[0])
    old_mats = {m for o in objs for m in o.data.materials}
    poly = leaf_polygon(src_img)
    img = make_texture(src_img)
    m_bark = pool_table.make_material(img, "M_tree_bark")
    m_bark["outline"] = False      # cây không viền nét: viền thân cây (gộp 1 lượt vẽ) tốn ~0,3 ms/khung ở zone_02 (GPU tích hợp)
    m_leaf = leaf_material(img)
    rng = random.Random(SEED)
    out = {"near": [], "far": []}
    for k, o in enumerate(objs, 1):
        far = o.copy()
        far.data = o.data.copy()
        collection.objects.link(far)
        for kind, ob, drop, name in (("near", o, NEAR_DROP, f"cay_lo_{k}"), ("far", far, FAR_DROP, f"cay_lo_{k}_xa")):
            src_tris = _tris(ob)
            nb, nl = finish_tree(ob, m_bark, m_leaf, poly, drop, rng)
            me = ob.data
            me.name = name
            h = float(_co(ob)[:, 2].max())
            out[kind].append((me, h))
            log(f"[cây] {name}: {src_tris} → {_tris(ob)} tam giác (mặt vỏ {nb}, mặt lá {nl} — cắt theo đa giác {LEAF_SIDES} "
                f"cạnh{f', bỏ {round(drop * 100)} % mảng lá' if drop else ''}), cao {h:.2f} m")
            bpy.data.objects.remove(ob)
    for om in old_mats:
        if om and om.users == 0:
            bpy.data.materials.remove(om)
    for im in [i for i in bpy.data.images if i.users == 0]:
        bpy.data.images.remove(im)
    _meshes["trees"] = out
    return out


def place(collection, records, log=print):
    """Bản sao cây tại các chỗ kit.tree() đã ghi ({x, y, z, h, detail}): chiều cao h như cây cũ, xoay ngẫu nhiên; detail
    ≤ 1 (cây xa) dùng lưới bớt lá. → [object]"""
    meshes = build_meshes(collection, log)
    rng = random.Random(SEED)
    objs = []
    for i, r in enumerate(records):
        k = rng.randrange(len(meshes["near"]))
        me, mh = meshes["far" if r.get("detail", 2) <= 1 else "near"][k]
        s = r["h"] / mh * rng.uniform(0.95, 1.05)
        o = bpy.data.objects.new(f"{BATCH}_{i:02d}", me)
        collection.objects.link(o)
        o.location = (r["x"], r["y"], r["z"])
        o.rotation_euler = (0, 0, rng.uniform(0, 2 * math.pi))
        o.scale = (s, s, s)
        o["batch"] = BATCH
        objs.append(o)
    far = sum(1 for r in records if r.get("detail", 2) <= 1)
    log(f"[cây] {len(objs)} cây ({far} cây xa bớt lá) dùng chung {len(meshes['near']) + len(meshes['far'])} lưới")
    return objs
