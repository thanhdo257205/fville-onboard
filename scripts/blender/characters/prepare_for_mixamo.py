"""Chuẩn bị nhân vật tạo bằng Meshy (GLB) để gắn xương trên Mixamo.

Chạy (không giao diện):
  tools/bin/blender.cmd --background --factory-startup \
      --python scripts/blender/characters/prepare_for_mixamo.py -- [--id prajith] [--tris 15000] [--height 1.75] [--protect-face] [--protect-logo]
  (--name là tên cũ của --id, vẫn dùng được; vd huyen: -- --id huyen --height 1.60)

Vào:  assets/characters/<name>/source/<name>_meshy.glb   (bản chép — không sửa file gốc)
Ra:   assets/characters/<name>/<name>_for_mixamo.fbx      (FBX nhúng texture, chỉ mesh)
      assets/characters/<name>/<name>_prep.blend
      assets/characters/<name>/textures/<name>_basecolor.jpg (1024 px)
      renders/characters/<name>_front.png, <name>_side.png
      renders/characters/check/<name>_{orig|<tris>}_{face|hair|hand_l|hand_r|eyes|collar}.png (soi mặt, kính, tóc, tay,
      mắt, cổ áo); có texture_fixes.json: renders/characters/<name>_texture_truoc_sau.png

Nhân vật trong thư mục này có thể là người thật → KHÔNG đưa vào dist/ hay repo công khai.
"""
import json
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import texture_fix as TF  # noqa: E402
from char_render import preview_setup, preview_teardown, shoot  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default, cast=str):
    return cast(ARGS[ARGS.index(name) + 1]) if name in ARGS else default


NAME = arg("--id", arg("--name", "prajith"))
# 12.000 làm vỡ texture ở má cạnh gọng kính (prajith) → dùng 15.000; so sánh ở renders/characters/check/
TARGET_TRIS = arg("--tris", 15000, int)
HEIGHT = arg("--height", 1.75, float)
# --protect-face: giữ nguyên nửa trước vùng đầu (mặt, kính, lông mày, tóc mái) khi giảm tam giác. Dùng khi đường nối
# UV chạy ngang mặt làm lông mày/sống kính vỡ ở mọi mức tam giác (vd nga); thân giảm mạnh hơn để vẫn đủ mục tiêu.
PROTECT_FACE = "--protect-face" in ARGS
FACE_DEPTH = 0.30          # m tính từ đỉnh đầu xuống
# --protect-logo: giữ nguyên tam giác (và UV gốc) quanh vị trí logo ngực trong chest_logo.json — giảm mạnh ở thân làm
# UV vùng ngực méo, texture bị kéo giãn → logo dán sau bị vệt hình nêm.
PROTECT_LOGO = "--protect-logo" in ARGS
LOGO_RADIUS = 0.065        # m quanh tâm logo
TEX_SIZE = arg("--tex", 1024, int)   # cạnh ảnh màu xuất ra (px)
MERGE_DIST = 1e-4          # m — gộp đỉnh trùng (Meshy tách đỉnh ở đường nối UV)

CHAR_DIR = os.path.join(ROOT, "assets", "characters", NAME)
SRC = os.path.join(CHAR_DIR, "source", f"{NAME}_meshy.glb")
FBX = os.path.join(CHAR_DIR, f"{NAME}_for_mixamo.fbx")
BLEND = os.path.join(CHAR_DIR, f"{NAME}_prep.blend")
TEX = os.path.join(CHAR_DIR, "textures", f"{NAME}_basecolor.jpg")
FIXES = os.path.join(CHAR_DIR, "texture_fixes.json")  # tuỳ chọn: collar, magnify, remove, bands, decals (texture_fix.py)
RENDER_DIR = os.path.join(ROOT, "renders", "characters")


# ---------- đo đạc ----------
def tri_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def coords(obj):
    me = obj.data
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def topology(obj):
    """Số cạnh biên (lỗ hở) và cạnh không đa tạp — để so trước/sau khi giảm tam giác."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    nonmanifold = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    return boundary, nonmanifold


# ---------- các bước ----------
def import_source():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.import_scene.gltf(filepath=SRC)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"cần đúng 1 mesh, có {len(meshes)}")
    obj = meshes[0]
    for o in list(bpy.context.scene.objects):  # bỏ empty/camera thừa nếu có
        if o is not obj:
            bpy.data.objects.remove(o)
    # đưa mọi transform (kể cả của cha) vào dữ liệu đỉnh
    obj.data.transform(obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.name = obj.data.name = NAME
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj


def orient_scale_origin(obj):
    """Nhìn về -Y, cao HEIGHT, gốc giữa hai bàn chân, chân chạm z = 0. Giữ nguyên A-pose."""
    me = obj.data
    co = coords(obj)
    size = co.max(0) - co.min(0)
    if size[2] < size.max() - 1e-6:
        raise RuntimeError(f"nhân vật không đứng thẳng theo Z (kích thước {size.round(3)})")
    if size[0] < size[1]:  # vai/tay dang ngang phải nằm theo X
        me.transform(Matrix.Rotation(np.pi / 2, 4, "Z"))
        co = coords(obj)
    zmin, h = co[:, 2].min(), np.ptp(co[:, 2])
    feet = co[co[:, 2] < zmin + 0.06 * h]
    shins = co[(co[:, 2] > zmin + 0.15 * h) & (co[:, 2] < zmin + 0.30 * h)]
    # mũi bàn chân nhô về phía trước ống chân → trước mặt là phía bàn chân lệch về
    toes_dir = feet[:, 1].mean() - shins[:, 1].mean()
    if toes_dir > 0:
        me.transform(Matrix.Rotation(np.pi, 4, "Z"))
        co = coords(obj)
    print(f"[hướng] mũi chân lệch {toes_dir:+.3f} m theo Y → {'xoay 180°' if toes_dir > 0 else 'đã nhìn về -Y'}")

    s = HEIGHT / h
    me.transform(Matrix.Scale(s, 4))
    co = coords(obj)
    zmin = co[:, 2].min()
    feet = co[co[:, 2] < zmin + 0.06 * HEIGHT]
    cx = (feet[:, 0].min() + feet[:, 0].max()) / 2
    cy = (feet[:, 1].min() + feet[:, 1].max()) / 2
    me.transform(Matrix.Translation((-cx, -cy, -zmin)))
    me.update()
    print(f"[tỉ lệ] cao gốc {h:.3f} m × {s:.4f} → {HEIGHT} m; gốc dời ({cx:+.3f}, {cy:+.3f}, {zmin:+.3f})")


def merge_and_clean(obj, label):
    """Gộp đỉnh trùng, xoá đỉnh/cạnh lẻ, mặt suy biến, tính lại pháp tuyến hướng ra ngoài."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=MERGE_DIST)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=MERGE_DIST)
    loose_e = [e for e in bm.edges if not e.link_faces]
    bmesh.ops.delete(bm, geom=loose_e, context="EDGES")
    loose_v = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose_v, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    print(f"[dọn {label}] đỉnh {n0} → {len(obj.data.vertices)} (xoá lẻ: {len(loose_v)} đỉnh, {len(loose_e)} cạnh)")


def smooth_normals(obj):
    """Bỏ pháp tuyến tuỳ chỉnh từ glTF (sai sau khi giảm tam giác) → bóng mượt toàn bộ."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bpy.ops.object.shade_smooth()


def face_mask(obj):
    """Đỉnh thuộc nửa trước vùng đầu: trong FACE_DEPTH m tính từ đỉnh đầu, phía trước tâm đầu (nhân vật nhìn -Y)."""
    co = coords(obj)
    top = co[:, 2].max()
    head = co[:, 2] > top - FACE_DEPTH
    cy = co[head, 1].mean()
    return head & (co[:, 1] < cy + 0.01)


def logo_mask(obj):
    """Đỉnh mặt trước thân quanh tâm logo (chest_logo.json → result.center hoặc center), bán kính LOGO_RADIUS."""
    path = os.path.join(CHAR_DIR, "chest_logo.json")
    co = coords(obj)
    if not os.path.exists(path):
        print("[giảm] --protect-logo: chưa có chest_logo.json — bỏ qua")
        return np.zeros(len(co), bool)
    cfg = json.load(open(path, encoding="utf-8"))
    cx, _, cz = (cfg.get("result") or cfg)["center"]
    return (np.hypot(co[:, 0] - cx, co[:, 2] - cz) < LOGO_RADIUS) & (co[:, 1] < 0)


def protect_mask(obj):
    co = coords(obj)
    m = np.zeros(len(co), bool)
    if PROTECT_FACE:
        m |= face_mask(obj)
    if PROTECT_LOGO:
        m |= logo_mask(obj)
    return m


def decimate(obj, target):
    before = tri_count(obj)
    mod = obj.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = min(1.0, target / before)
    mod.use_collapse_triangulate = True
    if PROTECT_FACE or PROTECT_LOGO:
        mask = protect_mask(obj)
        vg = obj.vertex_groups.new(name="_protect_face")
        vg.add([int(i) for i in np.where(mask)[0]], 1.0, "REPLACE")
        mod.vertex_group = vg.name
        mod.invert_vertex_group = True      # trọng số 1 → 0 sau khi đảo = được giữ
        mod.vertex_group_factor = 6.0
        me = obj.data
        me.calc_loop_triangles()
        face_before = sum(1 for t in me.loop_triangles if all(mask[v] for v in t.vertices))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    after = tri_count(obj)
    if PROTECT_FACE or PROTECT_LOGO:
        mask = protect_mask(obj)
        obj.data.calc_loop_triangles()
        face_after = sum(1 for t in obj.data.loop_triangles if all(mask[v] for v in t.vertices))
        obj.vertex_groups.remove(obj.vertex_groups["_protect_face"])
        print(f"[giảm] vùng giữ ({'mặt ' if PROTECT_FACE else ''}{'logo' if PROTECT_LOGO else ''}) {face_before} → "
              f"{face_after} tam giác, phần còn lại {before - face_before} → {after - face_after}")
    print(f"[giảm] {before} → {after} tam giác (mục tiêu {target}); UV: {[u.name for u in obj.data.uv_layers]}")
    return after


def simplify_material(obj):
    """Chỉ giữ baseColor; metallic 0, roughness 1; ảnh màu 1024 px ghi ra JPEG để FBX nhúng."""
    if len(obj.data.materials) != 1:
        print(f"[chất liệu] cảnh báo: {len(obj.data.materials)} chất liệu — chỉ xử lý cái đầu")
    mat = obj.data.materials[0]
    mat.name = f"M_{NAME}"
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    base_link = bsdf.inputs["Base Color"].links
    if not base_link or base_link[0].from_node.type != "TEX_IMAGE":
        raise RuntimeError("Base Color không nối từ ảnh")
    base_tex = base_link[0].from_node
    keep = {bsdf, base_tex, next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")}
    for n in [n for n in nt.nodes if n not in keep]:
        nt.nodes.remove(n)
    for inp in ("Metallic", "Roughness", "Normal"):
        for link in list(bsdf.inputs[inp].links):
            nt.links.remove(link)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    print(f"[chất liệu] {mat.name}: chỉ giữ baseColor; đã xoá metallicRoughness + normal")
    return base_tex


def image_pixels(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def make_image(name, px):
    img = bpy.data.images.new(name, px.shape[1], px.shape[0], alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    img.update()
    return img


def downscale(px, size):
    """Thu nhỏ đúng bội số bằng trung bình khối (lọc hộp, không răng cưa)."""
    f = px.shape[0] // size
    return px.reshape(size, f, size, f, 4).mean(axis=(1, 3)) if f > 1 else px


def fix_texture(obj, px):
    """Áp các chỉnh sửa trong assets/characters/<name>/texture_fixes.json lên ảnh màu gốc (độ phân giải gốc)."""
    if not os.path.exists(FIXES):
        return px, {}
    cfg = json.load(open(FIXES, encoding="utf-8"))
    R = TF.Raster(obj.data, px.shape[0])
    print(f"[texture] raster {px.shape[1]}×{px.shape[0]}: {R.covered.mean():.0%} texel thuộc mesh")
    found = {}
    for c in cfg.get("collar", []):
        if c.get("enabled", True):
            px, info = TF.collar_fix(px, R, c["band_z"], c["axis_xy"], c["neck_z"])
            found["collar"] = info
            print(f"[texture] mặt trong cổ áo '{c['name']}': {info}")
    caster = None
    for m in cfg.get("magnify", []):
        if not m.get("enabled", True):
            print(f"[texture] bỏ qua phóng to '{m['name']}' (enabled: false)")
            continue
        caster = caster or TF.FrontCaster(R)
        px, info = TF.magnify(px, R, m["center"], m["radii"], m["scale"], inner=m.get("inner", 0.55), caster=caster)
        found.setdefault("magnify", []).append(info)
        print(f"[texture] phóng to '{m['name']}': {info}")
    for r in cfg.get("remove", []):
        px, info = TF.remove_patch(px, R, r["box"], r["facing"], near=r.get("near"), radius=r.get("radius", 0.06),
                                   margin=r.get("margin", 0.012))
        found[r["name"]] = info
        print(f"[texture] tô lại '{r['name']}': {info}")
    for b in cfg.get("bands", []):
        segs = b.get("segments") or TF.uv_seam_segments(obj.data, b["region"], b.get("facing"))
        if not segs:
            print(f"[texture] '{b['name']}': không thấy đường nối UV trong vùng")
            continue
        px, info = TF.paint_band(px, R, segs, b["region"], b.get("width", 0.005), facing=b.get("facing"))
        info["segments"] = len(segs)
        print(f"[texture] tô vết '{b['name']}': {info}")
    for d in cfg.get("decals", []):
        png = os.path.join(ROOT, d["png"])
        if not os.path.exists(png):
            print(f"[texture] CHƯA dán '{d['name']}': thiếu {d['png']}")
            continue
        logo_img = bpy.data.images.load(png)
        logo = image_pixels(logo_img)
        bpy.data.images.remove(logo_img)
        logo, n_holes = TF.prepare_logo(logo, d.get("fill_holes"))
        if n_holes:
            print(f"[texture] logo: tô {n_holes} px lỗ kín bằng {d['fill_holes']} (chữ bị xoá nền)")
        center = found[d["at"]]["center"] if "at" in d else d["center"]
        center = [c + o for c, o in zip(center, d.get("offset", (0, 0, 0)))]
        px, info = TF.paste_decal(px, R, logo, center, d["width"], tuple(d.get("facing", (0, -1, 0))))
        print(f"[texture] dán '{d['name']}' tại {np.round(center, 3).tolist()}: {info}")
    if cfg.get("pad", 0):
        px = TF.pad_islands(px, R.covered, cfg["pad"])
        print(f"[texture] lan màu mép mảnh UV {cfg['pad']} texel (tránh viền trắng khi thu nhỏ)")
    return px, found


def build_texture(obj, base_tex):
    """Ảnh màu gốc → (sửa) → 1024 px JPEG. Trả về ảnh 'trước' (chỉ thu nhỏ) để render so sánh."""
    src = base_tex.image
    src_size = tuple(src.size)
    px = image_pixels(src)
    before = downscale(px, TEX_SIZE)
    fixed, found = fix_texture(obj, px)
    img = make_image(f"{NAME}_basecolor", downscale(fixed, TEX_SIZE))
    os.makedirs(os.path.dirname(TEX), exist_ok=True)
    img.filepath_raw = TEX
    img.file_format = "JPEG"
    try:
        img.save(quality=90)
    except TypeError:
        img.save()
    img.filepath = TEX  # tuyệt đối tới khi lưu .blend (xem save_blend)
    # bản không logo cũ (apply_chest_logo.py) dựng từ ảnh màu TRƯỚC → xoá để lần dán logo sau tạo lại từ ảnh mới
    nologo = os.path.join(CHAR_DIR, "textures", f"{NAME}_basecolor_nologo.jpg")
    if os.path.exists(nologo):
        os.remove(nologo)
        print(f"[texture] xoá {os.path.basename(nologo)} cũ: chạy lại apply_chest_logo.py để dán logo lên ảnh mới")
    base_tex.image = img
    for im in [im for im in bpy.data.images if im is not img]:
        bpy.data.images.remove(im)
    print(f"[texture] {src_size[0]}×{src_size[1]} → {TEX_SIZE}×{TEX_SIZE}: {TEX} ({os.path.getsize(TEX) // 1024} KB)")
    return before, found


def export_fbx():
    os.makedirs(CHAR_DIR, exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=FBX,
        use_selection=False,
        object_types={"MESH"},          # chỉ xuất mesh
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_ALL",
        bake_space_transform=True,      # "Apply Transform": dữ liệu đã ở hệ trục FBX, không xoay gốc
        axis_forward="-Z",
        axis_up="Y",
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        add_leaf_bones=False,
        path_mode="COPY",
        embed_textures=True,
    )
    print(f"[fbx] {FBX} ({os.path.getsize(FBX) / 1024 / 1024:.2f} MB)")


def save_blend():
    os.makedirs(CHAR_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    bpy.ops.file.make_paths_relative()  # texture → //textures/... (chép cả thư mục nhân vật vẫn mở được)
    bpy.ops.wm.save_mainfile(compress=True)
    print(f"[blend] {BLEND}")


# ---------- render xem trước (char_render.py) ----------


def close_ups(obj, chest=None):
    """Các góc cận: mặt (kính), 2 bàn tay, ngực trái (logo). → {tên: (tâm, hướng camera, ortho_scale)}"""
    co = coords(obj)
    top = co[:, 2].max()
    head = co[co[:, 2] > top - 0.28]
    shots = {"face": ((head[:, 0].mean(), head[:, 1].mean(), top - 0.12), (0.25, -1, 0.05), 0.42),
             # tóc: nhìn chếch từ sau-trên (nhân vật nhìn -Y → sau lưng là +Y)
             "hair": ((head[:, 0].mean(), head[:, 1].mean(), top - 0.15), (-0.35, 1, 0.35), 0.50)}
    xr = np.abs(co[:, 0]).max()
    for side, sign in (("hand_l", 1), ("hand_r", -1)):
        hand = co[co[:, 0] * sign > xr - 0.20]
        shots[side] = (tuple(hand.mean(0)), (0.35 * sign, -1, 0.15), 0.32)
    if chest is not None:
        shots["chest"] = (tuple(chest), (0.12, -1, 0.05), 0.30)
    # cận mắt (chính diện) và mặt trong cổ áo (nhìn chếch từ trên-trước) — xem sửa texture
    shots["eyes"] = ((head[:, 0].mean(), head[:, 1].mean(), top - 0.10 * HEIGHT / 1.7), (0, -1, 0.02), 0.13)
    neck = np.array(sorted(np.arange(0.78, 0.90, 0.005) * HEIGHT,
                           key=lambda z: np.ptp(co[np.abs(co[:, 2] - z) < 0.003, 0]) if (np.abs(co[:, 2] - z) < 0.003).any() else 9))
    shots["collar"] = ((0, head[:, 1].mean(), neck[0] - 0.03), (0.55, -0.8, 0.75), 0.2)
    return shots


def check_shots(obj, cam, tag):
    """Cận cảnh mặt (kính), tóc và 2 bàn tay để so trước/sau khi giảm tam giác."""
    for key, (t, d, sc) in close_ups(obj).items():
        shoot(cam, os.path.join(RENDER_DIR, "check", f"{NAME}_{tag}_{key}.png"), t, d, sc, res=(800, 800))


def texture_before_after(obj, cam, base_tex, before_px, found):
    """Render cùng góc với texture trước/sau khi sửa, ghép 1 ảnh: hàng = góc, cột = trước | sau."""
    chest = found.get("logo_nguc", {}).get("center")
    ups = close_ups(obj, chest)
    want = [k for k, f in (("eyes", "magnify"), ("collar", "collar")) if f in found] or ["chest", "hand_r"]
    shots = {k: ups[k] for k in want if k in ups}  # góc đầu tiên nằm trên cùng
    after = base_tex.image
    before = make_image(f"{NAME}_before", before_px)
    paths = {}
    for state, img in (("before", before), ("after", after)):
        base_tex.image = img
        for key, (t, d, sc) in shots.items():
            p = os.path.join(RENDER_DIR, "check", f"{NAME}_texfix_{state}_{key}.png")
            shoot(cam, p, t, d, sc, res=(700, 700))
            paths[state, key] = p
    base_tex.image = after
    bpy.data.images.remove(before)
    rows = []
    for key in shots:
        row = []
        for state in ("before", "after"):
            im = bpy.data.images.load(paths[state, key])
            row.append(image_pixels(im)[..., :3])
            bpy.data.images.remove(im)
        gap = np.full((row[0].shape[0], 12, 3), 0.13, dtype=np.float32)
        rows.append(np.concatenate([row[0], gap, row[1]], axis=1))
    gap = np.full((12, rows[0].shape[1], 3), 0.13, dtype=np.float32)
    grid = rows[0]
    for r in rows[1:]:
        grid = np.concatenate([r, gap, grid], axis=0)  # hàng 0 = đáy ảnh → nối ngược để góc đầu ở trên
    rgba = np.concatenate([grid, np.ones(grid.shape[:2] + (1,), dtype=np.float32)], axis=2)
    out = make_image("before_after", rgba)
    path = os.path.join(RENDER_DIR, f"{NAME}_texture_truoc_sau.png")
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    print(f"[render] trước | sau: {path}")


def main():
    obj = import_source()
    tris0 = tri_count(obj)
    print(f"[nhập] {SRC}: {tris0} tam giác, {len(obj.data.vertices)} đỉnh")
    orient_scale_origin(obj)

    # gộp đỉnh trùng TRƯỚC khi giảm: Meshy tách đỉnh ở đường nối UV, để nguyên thì Decimate coi là mép hở
    merge_and_clean(obj, "trước giảm")
    print("[topo trước] cạnh biên, không đa tạp:", topology(obj))
    cam = preview_setup()
    check_shots(obj, cam, "orig")
    preview_teardown()

    tris = decimate(obj, TARGET_TRIS)
    merge_and_clean(obj, "sau giảm")
    smooth_normals(obj)
    print("[topo sau] cạnh biên, không đa tạp:", topology(obj))
    base_tex = simplify_material(obj)
    # Decimate dời đỉnh tới vị trí tối ưu → đo lại: đúng chiều cao, chân chạm z = 0, gốc giữa hai bàn chân
    orient_scale_origin(obj)
    before_px, found = build_texture(obj, base_tex)  # sửa texture theo vị trí 3D cuối cùng

    # đảm bảo transform object là đơn vị (đã đưa hết vào đỉnh)
    assert obj.matrix_world == Matrix.Identity(4)
    co = coords(obj)
    height = co[:, 2].max() - co[:, 2].min()
    print(f"[kết quả] {tri_count(obj)} tam giác, cao {height:.3f} m, z thấp nhất {co[:, 2].min():.4f}, "
          f"rộng {np.ptp(co[:, 0]):.3f} × sâu {np.ptp(co[:, 1]):.3f} m")

    export_fbx()
    save_blend()

    cam = preview_setup()
    check_shots(obj, cam, str(TARGET_TRIS))
    shoot(cam, os.path.join(RENDER_DIR, f"{NAME}_front.png"), (0, 0, HEIGHT / 2), (0, -1, 0), 2.1)
    shoot(cam, os.path.join(RENDER_DIR, f"{NAME}_side.png"), (0, 0, HEIGHT / 2), (1, 0, 0), 2.1)
    if found:
        texture_before_after(obj, cam, base_tex, before_px, found)
    print(f"[render] {RENDER_DIR}")
    print(f"TOM_TAT tris={tris} height={height:.3f} fbx_mb={os.path.getsize(FBX) / 1024 / 1024:.2f}")


main()
