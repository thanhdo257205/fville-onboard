"""Mặt nạ vùng (áo, quần, giày, da, tóc, kính) + các bộ texture trang phục của một nhân vật, cùng UV với <id>_prep.blend.

Chạy (không giao diện, sau prepare_for_mixamo.py và apply_chest_logo.py):
  tools/bin/blender.cmd --background --factory-startup \
      --python scripts/blender/characters/outfit_textures.py -- --id intern_nam [--shirt cfe0ee] [--glasses] [--no-render]

Áo gốc Meshy là bộ NGÀY ĐẦU (vd intern_nam_kinh: áo phông xanh ngọc) — --original dau_ngay, chạy TRƯỚC apply_chest_logo.py:
  ... outfit_textures.py -- --id intern_nam_kinh --original dau_ngay [--orange fb8136] --glasses --no-render
  ... apply_chest_logo.py -- --id intern_nam_kinh            (dán logo lên bản cam _nologo → _basecolor.jpg)
  ... outfit_textures.py -- --id intern_nam_kinh --original dau_ngay --glasses   (chạy lại để render bản ao_cam có logo)
  → textures/<id>_basecolor_dau_ngay.jpg = ảnh màu gốc (chép nguyên byte từ _basecolor.jpg do prepare_for_mixamo.py ghi,
    các lần sau đọc lại từ đây); textures/<id>_basecolor_nologo.jpg = áo đổi sang cam --orange theo mặt nạ, giữ nếp vải
    (mặc định = màu mẫu áo cam của intern_nam → hai áo cam giống nhau), chưa logo. Chạy lại prepare_for_mixamo.py thì
    hai ảnh này bị xoá, làm lại từ bước đầu.
--glasses: thêm vùng kính (gọng kính dính liền mặt trong lưới Meshy): đỉnh vùng đầu có độ dày < GLASSES_THICK (tia bắn
từ đỉnh vào trong theo pháp tuyến: gọng là ống ~3 mm, mặt / đầu dày hàng chục cm) trong dải mắt --glasses-band
(× chiều cao), gom liên thông, giữ mảng lớn (lọn tóc mảnh lẻ trong dải bị loại).

Vào:  assets/characters/<id>/<id>_prep.blend                  (mesh cuối, UV)
      assets/characters/<id>/textures/<id>_basecolor_nologo.jpg (áo gốc, không logo — apply_chest_logo.py tạo)
      assets/characters/<id>/textures/<id>_basecolor.jpg        (bản "ao_cam": áo cam + logo)
Ra:   textures/<id>_mask.png              512 px, mỗi vùng một màu (MASK_COLORS; đen = ngoài mảnh UV)
      textures/<id>_basecolor_dau_ngay.jpg bản "dau_ngay": áo đổi màu --shirt (giữ nếp vải), không logo; quần, giày,
                                           da, tóc giữ nguyên
      renders/characters/<id>_trang_phuc.png (chính diện ao_cam | dau_ngay | mặt nạ trước | mặt nạ sau; cận ngực logo,
      cận mặt); ảnh lẻ trong renders/characters/outfit/

Mặt nạ KHÔNG đoán theo màu trên toàn thân (quần kem gần màu da): chia vùng theo HÌNH KHỐI trước, màu chỉ dùng để
tách giữa các vùng có thể có ở chỗ đó:
  - cắt ngang dưới nách (độ cao cao nhất mà phần thân dưới tách thành thân + 2 cánh tay) → 3 khu:
      cánh tay dưới mặt cắt: {áo (tay áo), da}; thân + chân dưới mặt cắt: {áo, quần, giày}; trên mặt cắt: {áo, da, tóc}
    → quần và da không bao giờ so màu với nhau;
  - mỗi đỉnh lấy màu texture tại UV → gán vùng có màu mẫu gần nhất trong khu (màu mẫu lấy ở chỗ chắc chắn: ngực áo,
    đùi, đế giày, bàn tay, đỉnh đầu);
  - dọn theo liên thông trên lưới: mảng tóc nhỏ (mắt, lông mày) → da; mảng vụn của vùng khác (nút áo, vết) → vùng
    bao quanh;
  - texel: tam giác cùng vùng → vùng đó; tam giác giáp ranh → màu mẫu gần nhất trong các vùng của 3 đỉnh.
"""
import json
import os
import shutil
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import texture_fix as TF  # noqa: E402
from char_render import preview_setup, preview_teardown, shoot  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None, cast=str):
    return cast(ARGS[ARGS.index(name) + 1]) if name in ARGS else default


CID = arg("--id")
SHIRT_HEX = arg("--shirt", "cfe0ee")          # bộ "dau_ngay": áo sơ mi xanh nhạt (GDD, giống tint của vai player)
# --outfit <tên>: ghi bộ đổi màu áo thành textures/<id>_basecolor_<tên>.jpg thay cho dau_ngay (vd intern_nu làm Tú:
# --outfit tu_dau_ngay --shirt f3df8a — polo vàng nhạt, khác áo người chơi); bộ dau_ngay có sẵn không bị ghi đè
OUTFIT = arg("--outfit", "dau_ngay")
ORIGINAL = arg("--original", "ao_cam")         # áo gốc Meshy là bộ nào: ao_cam (mặc định) | dau_ngay
ORANGE_HEX = arg("--orange", "fb8136")         # --original dau_ngay: màu áo cam = màu mẫu áo của intern_nam (đo 10/10/2026)
GLASSES = "--glasses" in ARGS
GLASSES_BAND = arg("--glasses-band", (0.855, 0.912), lambda v: tuple(float(x) for x in v.split(",")))
GLASSES_THICK = 0.012                          # m
RENDER = "--no-render" not in ARGS
SIZE = 1024                                    # ảnh màu
MASK_SIZE = 512
LABELS = {1: "ao", 2: "quan", 3: "giay", 4: "da", 5: "toc", 6: "kinh"}
MASK_COLORS = {0: (0, 0, 0), 1: (255, 0, 0), 2: (0, 0, 255), 3: (0, 255, 0), 4: (255, 255, 0), 5: (255, 0, 255),
               6: (0, 255, 255)}
SHIRT, PANTS, SHOES, SKIN, HAIR, GLASS = 1, 2, 3, 4, 5, 6
LUMA = TF.LUMA
FOLD_RANGE = (0.6, 1.12)                       # giới hạn hệ số nếp vải khi đổi màu áo

CHAR_DIR = os.path.join(ROOT, "assets", "characters", CID or "")
TEX_DIR = os.path.join(CHAR_DIR, "textures")
P = {"blend": os.path.join(CHAR_DIR, f"{CID}_prep.blend"),
     "nologo": os.path.join(TEX_DIR, f"{CID}_basecolor_nologo.jpg"),
     "ao_cam": os.path.join(TEX_DIR, f"{CID}_basecolor.jpg"),
     "dau_ngay": os.path.join(TEX_DIR, f"{CID}_basecolor_{OUTFIT}.jpg"),
     "mask": os.path.join(TEX_DIR, f"{CID}_mask.png"),
     "logo": os.path.join(CHAR_DIR, "chest_logo.json")}
RENDER_DIR = os.path.join(ROOT, "renders", "characters")


# ---------- ảnh ----------
def load_pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)


def save_pixels(px, path, fmt):
    img = bpy.data.images.new("_out", px.shape[1], px.shape[0], alpha=False)
    img.colorspace_settings.name = "sRGB"
    rgba = px if px.shape[2] == 4 else np.concatenate([px, np.ones(px.shape[:2] + (1,), np.float32)], -1)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = fmt
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        img.save(quality=92) if fmt == "JPEG" else img.save()
    except TypeError:
        img.save()
    bpy.data.images.remove(img)


# ---------- lưới ----------
class Mesh:
    def __init__(self, me):
        me.calc_loop_triangles()
        nv, nl, ne, nt = len(me.vertices), len(me.loops), len(me.edges), len(me.loop_triangles)
        self.co = np.empty(nv * 3)
        me.vertices.foreach_get("co", self.co)
        self.co = self.co.reshape(-1, 3)
        self.nrm = np.empty(nv * 3)
        me.vertices.foreach_get("normal", self.nrm)
        self.nrm = self.nrm.reshape(-1, 3)
        self.edges = np.empty(ne * 2, np.int64)
        me.edges.foreach_get("vertices", self.edges)
        self.edges = self.edges.reshape(-1, 2)
        self.loop_v = np.empty(nl, np.int64)
        me.loops.foreach_get("vertex_index", self.loop_v)
        self.uv = np.empty(nl * 2)
        me.uv_layers.active.data.foreach_get("uv", self.uv)
        self.uv = self.uv.reshape(-1, 2)
        self.tri_v = np.empty(nt * 3, np.int64)
        me.loop_triangles.foreach_get("vertices", self.tri_v)
        self.tri_v = self.tri_v.reshape(-1, 3)
        self.tri_l = np.empty(nt * 3, np.int64)
        me.loop_triangles.foreach_get("loops", self.tri_l)
        self.tri_l = self.tri_l.reshape(-1, 3)
        self.n = nv

    def components(self, mask):
        """Nhãn liên thông (chỉ đỉnh trong mask, cạnh có 2 đầu trong mask); ngoài mask = -1."""
        e = self.edges[mask[self.edges[:, 0]] & mask[self.edges[:, 1]]]
        lab = np.arange(self.n)
        while True:
            old = lab.copy()
            np.minimum.at(lab, e[:, 0], lab[e[:, 1]])
            np.minimum.at(lab, e[:, 1], lab[e[:, 0]])
            lab = lab[lab]
            if (lab == old).all():
                break
        lab[~mask] = -1
        return lab

    def vertex_colors(self, px):
        h, w = px.shape[:2]
        x = np.clip((self.uv[:, 0] * w).astype(int), 0, w - 1)
        y = np.clip((self.uv[:, 1] * h).astype(int), 0, h - 1)
        acc = np.zeros((self.n, 3))
        cnt = np.zeros(self.n)
        np.add.at(acc, self.loop_v, px[y, x, :3])
        np.add.at(cnt, self.loop_v, 1)
        return acc / np.maximum(cnt, 1)[:, None]


# ---------- mặt nạ ----------
def arm_cut(M, H):
    """Độ cao cắt cao nhất mà phần dưới tách thành thân (lớn nhất) + 2 cánh tay. → (z, nhãn liên thông, id 2 tay)."""
    for zc in np.arange(0.76, 0.40, -0.01) * H:
        m = M.co[:, 2] < zc
        lab = M.components(m)
        ids, cnt = np.unique(lab[m], return_counts=True)
        big = ids[cnt > 0.003 * M.n]
        if len(big) >= 3:
            body = ids[cnt.argmax()]
            arms = sorted([i for i in big if i != body], key=lambda i: -abs(M.co[lab == i, 0].mean()))[:2]
            return float(zc), lab, arms
    raise RuntimeError("không tìm được mặt cắt tách 2 cánh tay khỏi thân (tư thế không phải chữ A?)")


def reference_colors(M, vc, H, zone_up, zone_arm, zone_low):
    co, n = M.co, M.nrm
    sets = {
        SHIRT: zone_up & (co[:, 2] > 0.70 * H) & (co[:, 2] < 0.79 * H) & (np.abs(co[:, 0]) > 0.03)
        & (np.abs(co[:, 0]) < 0.12) & (n[:, 1] < -0.5),
        PANTS: zone_low & (co[:, 2] > 0.25 * H) & (co[:, 2] < 0.40 * H),
        SHOES: co[:, 2] < 0.025 * H,
        SKIN: zone_arm & (co[:, 2] < co[zone_arm, 2].min() + 0.08),
        HAIR: co[:, 2] > H - 0.015,
    }
    ref = {}
    for k, s in sets.items():
        if s.sum() < 5:
            raise RuntimeError(f"không đủ đỉnh để lấy màu mẫu vùng {LABELS[k]} ({s.sum()})")
        ref[k] = [np.median(vc[s], 0)]
    # giày 2 màu mẫu: đế (sát sàn, thường xám) + thân giày (phần sáng nhất quanh mắt cá, vd giày trắng)
    up = (co[:, 2] < 0.06 * H) & (vc @ LUMA > np.percentile(vc[co[:, 2] < 0.06 * H] @ LUMA, 75))
    ref[SHOES].append(np.median(vc[up], 0))
    return ref


def nearest(colors, ref, allowed):
    """Vùng (trong `allowed`) có một màu mẫu gần nhất với từng màu."""
    labs = np.array([k for k in allowed for _ in ref[k]])
    cols = np.array([c for k in allowed for c in ref[k]])
    d = ((colors[:, None, :] - cols[None]) ** 2).sum(-1)
    return labs[d.argmin(1)]


def clean_labels(M, vl, vc, min_frac=0.002, hair_keep=0.2, hair_near=0.006):
    """Tóc: vệt sáng trắng xám trên tóc (bị gán da vì gần màu da hơn) → tóc, nếu sát tóc. Giữ mảng tóc lớn
    (≥ hair_keep × mảng lớn nhất) và mảng nhỏ cách khối tóc lớn ≤ hair_near m (lọn tóc mái bị vệt sáng cắt rời);
    mảng tối nhỏ ở xa (mắt, lông mày) → da.
    Vùng khác: mảng < min_frac × số đỉnh → vùng chiếm đa số ở các đỉnh kề (lặp tới khi ổn)."""
    vl = vl.copy()
    mx, mn = vc.max(1), vc.min(1)
    shine = (vl == SKIN) & (vc @ LUMA > 0.75) & ((mx - mn) / np.maximum(mx, 1e-6) < 0.08)
    for _ in range(3):
        h = vl == HAIR
        e = M.edges
        touch = np.zeros(M.n, bool)
        touch[e[h[e[:, 1]], 0]] = True
        touch[e[h[e[:, 0]], 1]] = True
        grow = shine & touch & ~h
        if not grow.any():
            break
        vl[grow] = HAIR
    hl = M.components(vl == HAIR)
    ids, cnt = np.unique(hl[vl == HAIR], return_counts=True)
    if len(ids):
        main = ids[cnt >= hair_keep * cnt.max()]
        main_pts = M.co[np.isin(hl, main)]
        from mathutils.kdtree import KDTree
        kd = KDTree(len(main_pts))
        for i, p in enumerate(main_pts):
            kd.insert(p, i)
        kd.balance()
        for i in ids[cnt < hair_keep * cnt.max()]:
            pts = M.co[hl == i]
            if min(kd.find(p)[2] for p in pts) > hair_near:
                vl[hl == i] = SKIN
    changed_total = 0
    for _ in range(4):
        changed = 0
        for k in LABELS:
            lab = M.components(vl == k)
            ids, cnt = np.unique(lab[vl == k], return_counts=True)
            for i in ids[cnt < max(8, min_frac * M.n)]:
                members = np.where(lab == i)[0]
                ms = np.zeros(M.n, bool)
                ms[members] = True
                e = M.edges[ms[M.edges[:, 0]] ^ ms[M.edges[:, 1]]]
                nb = np.where(ms[e[:, 0]], e[:, 1], e[:, 0])
                nbl = vl[nb]
                nbl = nbl[nbl != k]
                if len(nbl):
                    vl[members] = np.bincount(nbl).argmax()
                    changed += len(members)
        changed_total += changed
        if not changed:
            break
    return vl, changed_total


def glasses_vertices(M, H):
    """Gọng kính: đỉnh vùng đầu mỏng (< GLASSES_THICK) trong dải mắt, mảng liên thông lớn. → (mặt nạ đỉnh, thông tin)."""
    head = np.where(M.co[:, 2] > H * GLASSES_BAND[0] - 0.02)[0]
    bvh = BVHTree.FromPolygons([Vector(v) for v in M.co], M.tri_v.tolist())
    thick = np.full(M.n, 9.0)
    for i in head:
        hit = bvh.ray_cast(Vector(M.co[i] - M.nrm[i] * 1e-4), Vector(-M.nrm[i]), 0.5)
        if hit[0] is not None:
            thick[i] = hit[3]
    cand = (thick < GLASSES_THICK) & (M.co[:, 2] > H * GLASSES_BAND[0]) & (M.co[:, 2] < H * GLASSES_BAND[1])
    lab = M.components(cand)
    ids, cnt = np.unique(lab[cand], return_counts=True)
    if not len(ids):
        raise RuntimeError("--glasses: không có đỉnh mỏng nào trong dải mắt")
    keep = ids[(cnt >= 0.2 * cnt.max()) & (cnt >= 30)]
    g = np.isin(lab, keep)
    p = M.co[g]
    r = lambda v: round(float(v), 3)  # noqa: E731
    info = {"dinh": int(g.sum()), "mang": len(keep), "bo_manh_le": int(cand.sum() - g.sum()),
            "x": [r(p[:, 0].min()), r(p[:, 0].max())], "y": [r(p[:, 1].min()), r(p[:, 1].max())],
            "z": [r(p[:, 2].min()), r(p[:, 2].max())]}
    return g, info


def texel_labels(M, px, vl, ref, mark_v):
    """Nhãn từng texel (SIZE × SIZE): tam giác cùng vùng → vùng đó; giáp ranh → màu mẫu gần nhất trong các vùng của
    3 đỉnh. Texel ngoài mảnh UV = 0; covered = texel thuộc tam giác nào đó.
    → (nhãn, marked = texel của tam giác có đỉnh trong mark_v)."""
    uvt = M.uv[M.tri_l] * SIZE - 0.5
    tl = vl[M.tri_v]
    tm = mark_v[M.tri_v].any(1)
    lab = np.zeros((SIZE, SIZE), np.uint8)
    marked = np.zeros((SIZE, SIZE), bool)
    for t in range(len(uvt)):
        r = TF._raster_tri(uvt[t], SIZE)
        if r is None:
            continue
        yy, xx, _ = r
        a, b, c = tl[t]
        if a == b == c:
            lab[yy, xx] = a
        else:
            lab[yy, xx] = nearest(px[yy, xx, :3].astype(np.float64), ref, np.unique(tl[t]))
        if tm[t]:
            marked[yy, xx] = True
    return lab, marked


def flood_hair(tlab, px, ref, iters=400):
    """Lọn tóc VẼ trên texture da mặt (không có hình khối riêng → các đỉnh quanh nó đều là da): texel da có màu gần
    tóc hơn gần da và liền mạch (4 hướng, trong cùng mảnh UV) với texel tóc → tóc. Đồng tử, lông mày nằm riêng giữa
    da/lòng trắng nên không bị loang tới."""
    rgb = px[..., :3].astype(np.float64)
    dark = (tlab == SKIN) & (np.linalg.norm(rgb - ref[HAIR][0], axis=-1) < np.linalg.norm(rgb - ref[SKIN][0], axis=-1))
    hair = tlab == HAIR
    start = hair.sum()
    for _ in range(iters):
        nb = np.zeros_like(hair)
        nb[1:] |= hair[:-1]
        nb[:-1] |= hair[1:]
        nb[:, 1:] |= hair[:, :-1]
        nb[:, :-1] |= hair[:, 1:]
        g = nb & dark & ~hair
        if not g.any():
            break
        hair |= g
    out = tlab.copy()
    out[hair] = HAIR
    return out, int(hair.sum() - start)


def grow_labels(lab, iters):
    """Lan nhãn ra lề ngoài mảnh UV (lọc ảnh ở mép mảnh không lấy nhầm nhãn 0)."""
    lab = lab.copy()
    for _ in range(iters):
        empty = lab == 0
        if not empty.any():
            break
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb = np.roll(np.roll(lab, dy, 0), dx, 1)
            fill = empty & (nb > 0) & (lab == 0)
            lab[fill] = nb[fill]
    return lab


def downsample_mode(lab, f):
    h, w = lab.shape[0] // f, lab.shape[1] // f
    blocks = lab.reshape(h, f, w, f).transpose(0, 2, 1, 3).reshape(h, w, f * f)
    counts = np.stack([(blocks == k).sum(-1) for k in range(len(MASK_COLORS))], -1)
    counts[..., 0] = np.where(counts[..., 1:].sum(-1) > 0, -1, counts[..., 0])   # có vùng nào thì không lấy 0
    return counts.argmax(-1).astype(np.uint8)


def mask_image(lab):
    rgb = np.zeros(lab.shape + (3,), np.float32)
    for k, c in MASK_COLORS.items():
        rgb[lab == k] = np.array(c) / 255
    return rgb


# ---------- đổi màu áo ----------
def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def recolor_shirt(px, lab, covered, ref, target, near3d, ring=3):
    """Áo → màu target, giữ nếp vải: hệ số sáng = độ sáng texel / độ sáng màu áo mẫu (giới hạn FOLD_RANGE).
    Trong áo: tỉ lệ đổi = độ "đậm màu áo" của texel (nút áo trắng, chỉ may giữ nguyên). Texel vùng khác sát áo (≤ ring px)
    VÀ thuộc tam giác giáp áo trên lưới (near3d — mảnh UV mắt, tóc nằm cạnh mảnh áo trong atlas thì không phải mép áo:
    đồng tử tối bị tính là "lẫn màu áo" → chấm màu áo trên mắt): đổi theo tỉ lệ lẫn màu áo (mép áo mờ của Meshy không
    còn viền màu cũ). Sau cùng lan màu lại ra lề mảnh UV."""
    rgb = px[..., :3].astype(np.float64)
    S = ref[SHIRT][0]
    lum = rgb @ LUMA
    l = np.clip(lum / (S @ LUMA), *FOLD_RANGE)
    new = np.clip(target[None, None] * l[..., None], 0, 1)
    # trong áo: hướng màu so với xám cùng độ sáng
    g = lum[..., None] * np.ones(3)
    sl = S[None, None] * (lum / (S @ LUMA))[..., None]
    v = sl - g
    a_in = np.clip(((rgb - g) * v).sum(-1) / np.maximum((v * v).sum(-1), 1e-9), 0, 1)
    shirt = lab == SHIRT
    near = np.zeros_like(shirt)
    for dy in range(-ring, ring + 1):
        for dx in range(-ring, ring + 1):
            near |= np.roll(np.roll(shirt, dy, 0), dx, 1)
    border = near & ~shirt & (lab > 0) & near3d
    a = np.where(shirt, a_in, 0.0)
    for k in [k for k in ref if k != SHIRT]:
        sel = border & (lab == k)
        if sel.any():
            o = ref[k][0] if k != SHOES else ref[k][-1]
            sv = S - o
            a[sel] = np.clip(((rgb[sel] - o) @ sv) / (sv @ sv), 0, 1)
    # bỏ đúng phần màu áo cũ (a × màu áo) rồi thêm a × màu mới; trộn rgb·(1 − a) + mới·a để lại a(1 − a) màu áo cũ ở
    # chỗ lẫn màu (mép cổ, nách) → viền ô liu khi đổi xanh ngọc → cam. Trong áo: màu cũ theo độ sáng texel; ở mép: màu mẫu
    old = np.where(shirt[..., None], sl, S[None, None])
    tgt = np.where(shirt[..., None], new, target[None, None])
    out = np.clip(rgb + a[..., None] * (tgt - old), 0, 1)
    res = px.copy()
    res[..., :3] = out
    res = TF.pad_islands(res, covered, iters=8)
    return res, {"texels_ao": int(shirt.sum()), "texels_mep": int((border & (a > 0.05)).sum()),
                 "do_cam_tb": round(float(a_in[shirt].mean()), 3)}


# ---------- render ----------
def render_set(obj, imgs, logo_center):
    me = obj.data
    co = np.array([v.co[:] for v in me.vertices])
    H = co[:, 2].max()
    head = co[co[:, 2] > H - 0.25]
    out_dir = os.path.join(RENDER_DIR, "outfit")
    cam = preview_setup()
    for o in bpy.data.objects:      # đèn dịu hơn bản xem trước mặc định (mặt, áo sáng không bị cháy trắng)
        if o.type == "LIGHT":
            o.data.energy *= {"key": 0.55, "fill": 0.45, "rim": 0.8}.get(o.name, 1)
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.75
    tex = next(n for n in me.materials[0].node_tree.nodes if n.type == "TEX_IMAGE")
    paths = {}

    def snap(key, img, target, d, scale, res):
        tex.image = img
        p = os.path.join(out_dir, f"{CID}_{key}.png")
        shoot(cam, p, target, d, scale, res=res)
        paths[key] = p

    body = ((0, 0, H / 2), (0, -1, 0), H * 1.04, (560, 1000))
    snap("ao_cam_truoc", imgs["ao_cam"], *body)
    snap("dau_ngay_truoc", imgs["dau_ngay"], *body)
    snap("mat_na_truoc", imgs["mask"], *body)
    snap("mat_na_sau", imgs["mask"], (0, 0, H / 2), (0, 1, 0), H * 1.04, (560, 1000))
    snap("dau_ngay_sau", imgs["dau_ngay"], (0, 0, H / 2), (0, 1, 0), H * 1.04, (560, 1000))
    snap("nguc_logo", imgs["ao_cam"], logo_center, (0.12, -1, 0.05), 0.30, (560, 560))
    face_c = (head[:, 0].mean(), head[:, 1].mean(), H - 0.12 * H / 1.7)
    snap("mat", imgs["ao_cam"], face_c, (0.15, -1, 0.03), 0.30, (560, 560))
    snap("mat_dau_ngay", imgs["dau_ngay"], face_c, (0.15, -1, 0.03), 0.30, (560, 560))
    snap("mat_na_mat", imgs["mask"], face_c, (0.35, -1, 0.05), 0.30, (560, 560))
    preview_teardown()
    return paths


def compose(paths, out):
    """Hàng trên: 4 ảnh toàn thân (560 × 1000); hàng dưới: cận ngực, cận mặt ao_cam / dau_ngay, cận mặt mặt nạ (560 × 560)."""
    top = [load_pixels(paths[k])[..., :3] for k in ("ao_cam_truoc", "dau_ngay_truoc", "mat_na_truoc", "mat_na_sau")]
    gap = 10
    W = sum(i.shape[1] for i in top) + gap * 3
    row1 = np.full((top[0].shape[0], W, 3), 0.13, np.float32)
    x = 0
    for i in top:
        row1[:, x:x + i.shape[1]] = i
        x += i.shape[1] + gap
    bottom = []
    for k in ("nguc_logo", "mat", "mat_dau_ngay", "mat_na_mat"):
        im = load_pixels(paths[k])[..., :3]
        f = im.shape[0] // 500 or 1
        bottom.append(im[::f, ::f] if f > 1 else im)
    hb = max(i.shape[0] for i in bottom)
    row2 = np.full((hb, W, 3), 0.13, np.float32)
    x = 0
    for i in bottom:
        row2[:i.shape[0], x:x + i.shape[1]] = i
        x += i.shape[1] + gap
    grid = np.concatenate([row2, np.full((gap, W, 3), 0.13, np.float32), row1], 0)   # hàng 0 = đáy ảnh
    save_pixels(grid, out, "PNG")
    print(f"[render] {out}")


def make_img(name, px):
    img = bpy.data.images.new(name, px.shape[1], px.shape[0], alpha=False)
    rgba = px if px.shape[2] == 4 else np.concatenate([px, np.ones(px.shape[:2] + (1,), np.float32)], -1)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.update()
    return img


def main():
    if not CID:
        raise SystemExit("cần --id <nhân vật>")
    if ORIGINAL == "dau_ngay" and OUTFIT != "dau_ngay":
        raise SystemExit("--outfit chỉ dùng khi áo gốc là ao_cam (bộ đổi màu từ áo gốc)")
    if ORIGINAL == "dau_ngay":
        # ảnh màu gốc = bộ ngày đầu: lần đầu chép từ _basecolor.jpg (prepare_for_mixamo.py vừa ghi, chưa có _nologo);
        # các lần sau đọc lại bản chép (lúc đó _basecolor.jpg đã là áo cam + logo)
        if not os.path.exists(P["dau_ngay"]):
            if os.path.exists(P["nologo"]) or not os.path.exists(P["ao_cam"]):
                raise SystemExit(f"thiếu {P['dau_ngay']} và _basecolor.jpg không còn là ảnh gốc — chạy lại prepare_for_mixamo.py")
            shutil.copy2(P["ao_cam"], P["dau_ngay"])
            print(f"[gốc] chép {os.path.basename(P['ao_cam'])} → {os.path.basename(P['dau_ngay'])} (bộ dau_ngay = áo gốc)")
        src = P["dau_ngay"]
    elif ORIGINAL == "ao_cam":
        for k in ("nologo", "ao_cam"):
            if not os.path.exists(P[k]):
                raise SystemExit(f"thiếu {P[k]} — chạy prepare_for_mixamo.py rồi apply_chest_logo.py trước")
        src = P["nologo"]
    else:
        raise SystemExit("--original: ao_cam | dau_ngay")
    if not os.path.exists(P["blend"]):
        raise SystemExit(f"thiếu {P['blend']} — chạy prepare_for_mixamo.py trước")
    bpy.ops.wm.open_mainfile(filepath=P["blend"])
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    M = Mesh(obj.data)
    H = M.co[:, 2].max()
    px = load_pixels(src)
    if px.shape[0] != SIZE:
        raise SystemExit(f"ảnh {px.shape[1]}×{px.shape[0]}, cần {SIZE}")
    vc = M.vertex_colors(px)

    zc, lab, arms = arm_cut(M, H)
    zone_arm = np.isin(lab, arms)
    zone_low = (M.co[:, 2] < zc) & ~zone_arm
    zone_up = M.co[:, 2] >= zc
    print(f"[khu] cắt dưới nách z = {zc:.3f} m ({zc / H:.2f} × cao): tay {zone_arm.sum()} đỉnh, thân + chân "
          f"{zone_low.sum()}, trên {zone_up.sum()}")
    ref = reference_colors(M, vc, H, zone_up, zone_arm, zone_low)
    print("[màu mẫu] " + ", ".join(f"{LABELS[k]} {[np.round(c, 3).tolist() for c in ref[k]]}" for k in ref))

    vl = np.zeros(M.n, np.int64)
    co = M.co
    vl[zone_arm] = nearest(vc[zone_arm], ref, [SHIRT, SKIN])
    lo_idx = np.where(zone_low)[0]                                  # giày chỉ ở thấp, áo chỉ trên đầu gối
    for allowed, sel in (([PANTS, SHOES], (co[lo_idx, 2] < 0.12 * H)),
                         ([SHIRT, PANTS], (co[lo_idx, 2] >= 0.35 * H)),
                         ([PANTS], (co[lo_idx, 2] >= 0.12 * H) & (co[lo_idx, 2] < 0.35 * H))):
        ii = lo_idx[sel]
        vl[ii] = nearest(vc[ii], ref, allowed)
    vl[zone_up] = nearest(vc[zone_up], ref, [SHIRT, SKIN, HAIR])
    vl, changed = clean_labels(M, vl, vc)
    if GLASSES:
        g, ginfo = glasses_vertices(M, H)
        vl[g] = GLASS
        # 2 màu mẫu: thân gọng (trung vị) + viền tối của gọng (texel giáp ranh với da / tóc chọn theo màu)
        ref[GLASS] = [np.median(vc[g], 0), np.percentile(vc[g], 10, axis=0)]
        print(f"[kính] {ginfo}; màu mẫu {[np.round(c, 3).tolist() for c in ref[GLASS]]}")
    print(f"[đỉnh] {', '.join(f'{LABELS[k]} {(vl == k).sum()}' for k in LABELS)}; dọn mảng vụn: {changed} đỉnh")

    # đỉnh áo + 1 vòng cạnh quanh áo → texel của tam giác giáp áo trên lưới (mép áo thật, không phải mảnh UV kề nhau)
    near_v = vl == SHIRT
    e = M.edges[near_v[M.edges[:, 0]] != near_v[M.edges[:, 1]]]
    near_v = near_v.copy()
    near_v[e.ravel()] = True
    tlab, near3d = texel_labels(M, px, vl, ref, near_v)
    tlab, flooded = flood_hair(tlab, px, ref)
    print(f"[texel] lọn tóc vẽ trên da → tóc: {flooded} texel")
    covered = tlab > 0
    tlab_g = grow_labels(tlab, 6)
    total = covered.sum()
    print("[texel] " + ", ".join(f"{LABELS[k]} {(tlab == k).sum() / total:.1%}" for k in LABELS))
    mask = downsample_mode(tlab_g, SIZE // MASK_SIZE)
    save_pixels(mask_image(mask), P["mask"], "PNG")
    print(f"[mặt nạ] {P['mask']} ({MASK_SIZE} px, {os.path.getsize(P['mask']) // 1024} KB): "
          + ", ".join(f"{LABELS[k]} = {MASK_COLORS[k]}" for k in LABELS) + ", ngoài UV = đen")

    ao_cam_img = None
    if ORIGINAL == "ao_cam":
        target = hex_rgb(SHIRT_HEX)
        dau_ngay, info = recolor_shirt(px, tlab_g, covered, ref, target, near3d)
        save_pixels(dau_ngay, P["dau_ngay"], "JPEG")
        print(f"[{OUTFIT}] áo → #{SHIRT_HEX}: {info} → {P['dau_ngay']} ({os.path.getsize(P['dau_ngay']) // 1024} KB)")
    else:
        dau_ngay = px
        cam, info = recolor_shirt(px, tlab_g, covered, ref, hex_rgb(ORANGE_HEX), near3d)
        save_pixels(cam, P["nologo"], "JPEG")
        print(f"[ao_cam] áo gốc → cam #{ORANGE_HEX} (chưa logo): {info} → {P['nologo']} "
              f"({os.path.getsize(P['nologo']) // 1024} KB)")
        with open(P["ao_cam"], "rb") as a, open(P["dau_ngay"], "rb") as b:
            has_logo = a.read() != b.read()       # _basecolor.jpg còn là bản chép của ảnh gốc → chưa dán logo
        if not has_logo:
            ao_cam_img = make_img("ao_cam", cam)
            print("[ao_cam] chưa dán logo: chạy apply_chest_logo.py -- --id " + CID + " rồi chạy lại script này để render")

    if RENDER:
        cfg = json.load(open(P["logo"], encoding="utf-8")) if os.path.exists(P["logo"]) else {}
        lc = (cfg.get("result") or cfg).get("center", [0.08, -0.07, 0.75 * H])
        imgs = {"ao_cam": ao_cam_img or bpy.data.images.load(P["ao_cam"]), "dau_ngay": make_img("dau_ngay", dau_ngay),
                "mask": make_img("mask", np.concatenate([mask_image(tlab_g), np.ones((SIZE, SIZE, 1), np.float32)], -1))}
        paths = render_set(obj, imgs, lc)
        compose(paths, os.path.join(RENDER_DIR, f"{CID}_trang_phuc{'' if OUTFIT == 'dau_ngay' else '_' + OUTFIT}.png"))
    print(f"TOM_TAT id={CID} cut_z={zc:.3f} mask={P['mask']} dau_ngay={P['dau_ngay']}")


main()
