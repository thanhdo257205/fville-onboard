"""Dán logo lên ngực trái áo nhân vật: chiếu từ camera chính diện lên mesh → biết texel nào (vùng UV nào) nằm dưới
logo → vẽ logo vào ảnh màu <id>_basecolor.jpg. Bản không logo giữ ở <id>_basecolor_nologo.jpg; mỗi lần chạy đều vẽ
lại từ bản này (đổi logo / vị trí thì chạy lại, không chồng logo).

Chạy (không giao diện):
  tools/bin/blender.cmd --background --factory-startup \
      --python scripts/blender/characters/apply_chest_logo.py -- --id huyen [--logo assets/logos/<file>.png] \
      [--width 0.065] [--center x,z] [--compare prajith] [--dry-run] [--no-render]
  Tách mảng logo đang có trên áo một nhân vật thành PNG (nền áo → trong suốt):
      ... apply_chest_logo.py -- --extract-from prajith --out assets/logos/fpt_logo_tu_prajith.png

Cấu hình: assets/characters/<id>/chest_logo.json — tâm logo [x, y, z] (toạ độ sau chuẩn hoá của <id>_prep.blend:
nhìn -Y, gốc giữa 2 bàn chân; ngực TRÁI của nhân vật = phía +X = bên phải khi nhìn chính diện; y bỏ qua, dò lại mặt
áo bằng tia chiếu), bề rộng phần có hình của logo (m), file logo, remove_existing (chỉ dùng lần đầu tạo bản
_nologo từ ảnh đã có logo, vd prajith). Tham số dòng lệnh ghi đè cấu hình.

Đường nối UV: logo không nên vắt qua (mép mảnh UV dễ lộ vệt khi thu nhỏ/mipmap). Vắt thì dời nhẹ (±2 cm ngang,
±1,5 cm dọc) tới chỗ đường nối chỉ đi qua phần mờ nhất của logo; texture Meshy vỡ nhiều mảnh nên có khi không né hẳn
được → lan màu logo ra lề ngoài mảnh UV quanh đó (không lộ vệt); kết quả + chỗ gần nhất không vắt ghi vào
chest_logo.json → result. Vẽ ở độ phân giải ×2 rồi thu về (khử răng cưa logo).

Ra:   textures/<id>_basecolor.jpg (có logo), textures/<id>_basecolor_nologo.jpg (lần đầu)
      renders/characters/check/<id>_logo_{front,45}.png; renders/characters/<id>_logo_nguc_so_sanh.png
      (hàng trên: <id> chính diện | nghiêng 45°; hàng dưới: nhân vật --compare cùng góc, cùng tỉ lệ)
--dry-run: không ghi vào textures/ và cấu hình; ảnh thử ở renders/characters/check/<id>_basecolor_logo_thu.jpg.
"""
import json
import os
import shutil
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import texture_fix as TF  # noqa: E402
from char_render import preview_setup, preview_teardown, shoot  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None, cast=str):
    return cast(ARGS[ARGS.index(name) + 1]) if name in ARGS else default


def floats(s):
    return [float(v) for v in s.split(",")]


CID = arg("--id")
LOGO = arg("--logo")
WIDTH = arg("--width", None, float)
CENTER = arg("--center", None, floats)          # x,z
COMPARE = arg("--compare")
EXTRACT = arg("--extract-from")
OUT = arg("--out")
DRY = "--dry-run" in ARGS
RENDER = "--no-render" not in ARGS
PAD = "--no-pad" not in ARGS          # chỉ để so thử: tắt bước lan màu ra lề mảnh UV
SS = 2                    # vẽ ở độ phân giải ×SS rồi thu về
SEAM_MARGIN = 0.004       # m — khoảng cách tối thiểu từ mép logo tới đường nối UV
FACING = (0.0, -1.0, 0.0)
RENDER_DIR = os.path.join(ROOT, "renders", "characters")
CHECK_DIR = os.path.join(RENDER_DIR, "check")


def rel(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def char_paths(cid):
    d = os.path.join(ROOT, "assets", "characters", cid)
    return {"dir": d, "blend": os.path.join(d, f"{cid}_prep.blend"), "cfg": os.path.join(d, "chest_logo.json"),
            "tex": os.path.join(d, "textures", f"{cid}_basecolor.jpg"),
            "nologo": os.path.join(d, "textures", f"{cid}_basecolor_nologo.jpg"),
            "fixes": os.path.join(d, "texture_fixes.json")}


def load_cfg(cid):
    p = char_paths(cid)
    if os.path.exists(p["cfg"]):
        return json.load(open(p["cfg"], encoding="utf-8"))
    # chưa có cấu hình: lấy decal ngực trong texture_fixes.json (cách dán logo cũ của prepare_for_mixamo.py)
    if os.path.exists(p["fixes"]):
        for d in json.load(open(p["fixes"], encoding="utf-8")).get("decals", []):
            return {"center": d["center"], "width_m": d["width"], "logo": d.get("png")}
    return {}


# ---------- ảnh ----------
def image_pixels(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def load_pixels(path):
    img = bpy.data.images.load(path)
    px = image_pixels(img)
    bpy.data.images.remove(img)
    return px


def save_pixels(px, path, fmt):
    img = bpy.data.images.new("_out", px.shape[1], px.shape[0], alpha=(fmt == "PNG"))
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = fmt
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        img.save(quality=92) if fmt == "JPEG" else img.save()
    except TypeError:
        img.save()
    bpy.data.images.remove(img)


def upsample(px, f):
    return np.repeat(np.repeat(px, f, axis=0), f, axis=1)


def downscale(px, f):
    h, w = px.shape[0] // f, px.shape[1] // f
    return px.reshape(h, f, w, f, -1).mean(axis=(1, 3))


# ---------- mesh ----------
def open_character(cid):
    bpy.ops.wm.open_mainfile(filepath=char_paths(cid)["blend"])
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"{cid}_prep.blend: cần 1 mesh, có {len(meshes)}")
    obj = meshes[0]
    if obj.matrix_world != Matrix.Identity(4):
        raise RuntimeError("mesh phải có transform đơn vị (prepare_for_mixamo.py đã đưa hết vào đỉnh)")
    return obj


class Surface:
    """Chiếu tia từ phía trước (−Y → +Y) lên mesh: điểm trúng, tam giác, UV."""

    def __init__(self, me):
        me.calc_loop_triangles()
        n = len(me.loop_triangles)
        self.tri_v = np.empty(n * 3, dtype=np.int64)
        me.loop_triangles.foreach_get("vertices", self.tri_v)
        self.tri_v = self.tri_v.reshape(n, 3)
        loops = np.empty(n * 3, dtype=np.int64)
        me.loop_triangles.foreach_get("loops", loops)
        uv = np.empty(len(me.uv_layers.active.data) * 2)
        me.uv_layers.active.data.foreach_get("uv", uv)
        self.tri_uv = uv.reshape(-1, 2)[loops].reshape(n, 3, 2)
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        self.co = co.reshape(-1, 3)
        self.bvh = BVHTree.FromPolygons([Vector(v) for v in self.co], self.tri_v.tolist())

    def hit(self, x, z):
        loc, nrm, idx, _ = self.bvh.ray_cast(Vector((x, -2.0, z)), Vector((0, 1, 0)), 4.0)
        return (None, None, None) if loc is None else (np.array(loc), np.array(nrm), idx)

    def uv_at(self, p, idx):
        a, b, c = self.co[self.tri_v[idx]]
        v0, v1, v2 = b - a, c - a, p - a
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        w1 = (d11 * d20 - d01 * d21) / den
        w2 = (d00 * d21 - d01 * d20) / den
        return np.array([1 - w1 - w2, w1, w2]) @ self.tri_uv[idx]


def bilinear(px, uv):
    h, w = px.shape[:2]
    x, y = uv[0] * w - 0.5, uv[1] * h - 0.5
    x0, y0 = int(np.floor(x)), int(np.floor(y))
    fx, fy = x - x0, y - y0
    x0c, x1c = np.clip([x0, x0 + 1], 0, w - 1)
    y0c, y1c = np.clip([y0, y0 + 1], 0, h - 1)
    return (px[y0c, x0c] * (1 - fx) * (1 - fy) + px[y0c, x1c] * fx * (1 - fy)
            + px[y1c, x0c] * (1 - fx) * fy + px[y1c, x1c] * fx * fy)


# ---------- tách mảng logo đang có trên áo ----------
def extract(src_id, out):
    cfg = load_cfg(src_id)
    cx, _, cz = cfg["center"]
    width = cfg["width_m"]
    obj = open_character(src_id)
    S = Surface(obj.data)
    tex = load_pixels(char_paths(src_id)["tex"])
    W, H, step = width * 1.5, width * 1.0, 0.0004            # vùng lấy mẫu (m), 0,4 mm/px
    nx, nz = int(round(W / step)), int(round(H / step))
    xs = cx - W / 2 + (np.arange(nx) + 0.5) * step
    zs = cz - H / 2 + (np.arange(nz) + 0.5) * step
    img = np.zeros((nz, nx, 3))
    for j, z in enumerate(zs):
        for i, x in enumerate(xs):
            p, n, idx = S.hit(x, z)
            img[j, i] = bilinear(tex, S.uv_at(p, idx))[:3]
    # nền áo: mặt cong bậc 2 khớp màu dải viền ngoài 12% (chỉ có áo, không có logo)
    X, Z = np.meshgrid(xs, zs)
    band = np.zeros((nz, nx), bool)
    k = max(2, int(0.12 * min(nx, nz)))
    band[:k], band[-k:], band[:, :k], band[:, -k:] = True, True, True, True
    A = np.stack([np.ones_like(X), X, Z, X * X, X * Z, Z * Z], -1)
    coef, *_ = np.linalg.lstsq(A[band], img[band], rcond=None)
    bg = A @ coef
    dev = np.linalg.norm(img - bg, axis=-1)
    a = np.clip((dev - 0.05) / (0.16 - 0.05), 0, 1)
    col = np.clip((img - (1 - a[..., None]) * bg) / np.maximum(a[..., None], 1e-3), 0, 1)  # bỏ lẫn màu nền ở mép
    rgba = np.concatenate([col, a[..., None]], -1)
    save_pixels(rgba, out, "PNG")
    ys, xs_ = np.where(a > 16 / 255)
    print(f"[tách] {src_id}: tâm ({cx:.3f}, {cz:.3f}), vùng {W * 100:.1f} × {H * 100:.1f} cm → {nx}×{nz} px; "
          f"nền {bg[band].mean(0).round(3).tolist()}, phần có hình {(xs_.max() - xs_.min() + 1) * step * 100:.1f} × "
          f"{(ys.max() - ys.min() + 1) * step * 100:.1f} cm → {out}")


# ---------- đường nối UV ----------
def seam_segments(me, cx, cy, cz, span=0.13):   # đủ rộng cho cả lần tìm ±6 cm
    region = ((cx - span, cx + span), (cy - 0.06, cy + 0.06), (cz - span, cz + span))
    return [(np.array(a), np.array(b)) for a, b in TF.uv_seam_segments(me, region, FACING)]


def seam_score(segs, cx, cz, w, h, logo, m=SEAM_MARGIN):
    """Chiều dài đường nối UV (m) nằm trong khung logo (+ lề m), nhân độ đục của logo tại chỗ đó: đường nối đi qua
    chữ / mảng màu nặng hơn đi qua quầng mờ hay lề (tối thiểu 0,15). 0 = không vắt qua đường nối nào."""
    lh, lw = logo.shape[:2]
    total = 0.0
    for a, b in segs:
        L = float(np.hypot(*(b - a)[[0, 2]]))
        n = max(2, int(L / 0.001))
        q = a + (b - a) * ((np.arange(n) + 0.5) / n)[:, None]
        u = (q[:, 0] - (cx - w / 2)) / w
        v = (q[:, 2] - (cz - h / 2)) / h
        ins = (u >= -m / w) & (u <= 1 + m / w) & (v >= -m / h) & (v <= 1 + m / h)
        if ins.any():
            al = logo[(np.clip(v[ins], 0, 1) * (lh - 1)).astype(int), (np.clip(u[ins], 0, 1) * (lw - 1)).astype(int), 3]
            total += float((np.maximum(al, 0.15) * (L / n)).sum())
    return total


def place_logo(S, segs, cx, cz, w, h, logo, dx_max=0.02, dz_max=0.015):
    """Không vắt qua đường nối → giữ nguyên. Vắt → dời nhẹ (±dx_max ngang, ±dz_max dọc) tới chỗ gần nhất không vắt.
    Không có chỗ như vậy (mảnh UV nhỏ hơn logo) → giữ vị trí mong muốn (dời chỉ giảm bớt chứ không hết vắt, lại lệch
    khỏi chỗ đặt logo chuẩn); vệt đường nối được che bằng pad_painted.
    Trả (x, z, độ dời, điểm đường nối tại chỗ dán, chỗ gần nhất không vắt trong ±6 cm hoặc None)."""
    s0 = seam_score(segs, cx, cz, w, h, logo)
    if s0 == 0:
        return cx, cz, 0.0, 0.0, (cx, cz)

    def free_within(rx, rz):
        c = [(np.hypot(dx, dz), cx + dx, cz + dz) for dx in np.arange(-rx, rx + 1e-6, 0.0025)
             for dz in np.arange(-rz, rz + 1e-6, 0.0025)]
        for d, x, z in sorted(c):
            if S.hit(x, z)[0] is not None and seam_score(segs, x, z, w, h, logo) == 0:
                return float(d), x, z
        return None
    near = free_within(dx_max, dz_max)
    if near:
        return near[1], near[2], near[0], 0.0, (near[1], near[2])
    far = free_within(0.06, 0.06)
    return cx, cz, 0.0, s0, None if far is None else (far[1], far[2])


def pad_painted(big, before, covered, iters=6):
    """Lan màu texel vừa vẽ ra lề NGOÀI mảnh UV (texel không thuộc tam giác nào) quanh logo: lọc song tuyến / mipmap
    ở mép mảnh lấy màu logo chứ không lấy màu áo cũ ở lề → không lộ vệt dọc đường nối."""
    known = np.abs(big[..., :3] - before[..., :3]).max(-1) > 1e-4      # texel đã vẽ logo
    rgb = big[..., :3].copy()
    grown_total = np.zeros_like(known)
    for _ in range(iters):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * k[..., None]
            cnt += k
        grow = ~known & ~covered & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow, None]
        known |= grow
        grown_total |= grow
    out = big.copy()
    out[..., :3] = rgb
    return out, int(grown_total.sum())


# ---------- dán ----------
LUMA = np.array([0.2126, 0.7152, 0.0722])


def shirt_fit(px, R, center, w, h, pad=0.02):
    """Màu nền áo quanh/dưới logo: mặt cong bậc 2 theo (x, z), khớp 2 lượt (bỏ điểm lệch: nút, viền, vết).
    → (hàm fit(P) → RGB, mặt nạ texel trong khung logo, độ lệch màu của từng texel so với nền)."""
    cx, cy, cz = center
    pos, nrm = R.pos, R.nrm
    sel = R.covered & (nrm @ np.array(FACING, np.float32) > 0.3) & (np.abs(pos[..., 1] - cy) < 0.05)
    sel &= (np.abs(pos[..., 0] - cx) < w / 2 + pad) & (np.abs(pos[..., 2] - cz) < h / 2 + pad)
    P, C = pos[sel].astype(np.float64), px[sel][:, :3].astype(np.float64)
    A = TF._quad_design(P, (0, 2))
    keep = np.ones(len(P), bool)
    for _ in range(2):
        coef, *_ = np.linalg.lstsq(A[keep], C[keep], rcond=None)
        r = np.linalg.norm(C - A @ coef, axis=1)
        keep = r < max(2.0 * np.median(r), 0.02)
    inside = sel & (np.abs(pos[..., 0] - cx) <= w / 2) & (np.abs(pos[..., 2] - cz) <= h / 2)
    dev = np.zeros(pos.shape[:2], np.float32)
    dev[sel] = np.linalg.norm(C - A @ coef, axis=1)
    return (lambda Q: TF._quad_design(np.asarray(Q, np.float64), (0, 2)) @ coef), inside, dev


def fold_shade(px, fit, lo=0.85, hi=1.08):
    """Hệ số giữ nếp vải: độ sáng texel áo / độ sáng nền áo đã làm mượt (nếp gấp tối hơn, chỗ nhô sáng hơn).
    Giới hạn [lo, hi] (chest_logo.json → fold_range): làm sáng nhiều sẽ khuếch đại vệt bóng/đường nối có sẵn thành quầng."""
    def shade(yy, xx, P):
        base = px[yy, xx, :3] @ LUMA
        smooth = np.maximum(fit(P) @ LUMA, 1e-3)
        return np.clip(base / smooth, lo, hi)
    return shade


def base_pixels(cid, cfg, me):
    """Ảnh màu không logo. Lần đầu: chép <id>_basecolor.jpg thành _nologo (nếu ảnh đã có logo cũ và cấu hình có
    remove_existing thì tô lại vùng logo cũ trước)."""
    p = char_paths(cid)
    if os.path.exists(p["nologo"]):
        return load_pixels(p["nologo"]), "có sẵn"
    px = load_pixels(p["tex"])
    rm = cfg.get("remove_existing")
    if not rm:
        if not DRY:
            shutil.copy2(p["tex"], p["nologo"])          # giữ nguyên byte của ảnh gốc
        return px, "chép từ ảnh hiện tại"
    R = TF.Raster(me, px.shape[0])
    px, info = TF.remove_patch(px, R, rm["box"], rm["facing"], near=rm.get("near"), radius=rm.get("radius", 0.06),
                               margin=rm.get("margin", 0.012))
    if not DRY:
        save_pixels(px, p["nologo"], "JPEG")
    return px, f"tô lại logo cũ {info}"


def apply(cid):
    p = char_paths(cid)
    cfg = load_cfg(cid)
    logo_path = rel(LOGO or cfg.get("logo") or "")
    if not os.path.isfile(logo_path):
        raise RuntimeError(f"thiếu file logo: {logo_path!r} (--logo hoặc chest_logo.json → logo)")
    width = WIDTH or cfg["width_m"]
    cx, cz = CENTER if CENTER else (cfg["center"][0], cfg["center"][2])
    obj = open_character(cid)
    me = obj.data
    S = Surface(me)
    logo, n_holes = TF.prepare_logo(load_pixels(logo_path), cfg.get("fill_holes"))
    h = width * logo.shape[0] / logo.shape[1]
    hit = S.hit(cx, cz)[0]
    if hit is None:
        raise RuntimeError(f"tia chiếu từ phía trước không trúng áo tại ({cx}, {cz})")
    segs = seam_segments(me, cx, hit[1], cz)
    x, z, shift, s1, free = place_logo(S, segs, cx, cz, width, h, logo)
    s0 = seam_score(segs, cx, cz, width, h, logo)
    cy = float(S.hit(x, z)[0][1])
    print(f"[vị trí] mong muốn ({cx:.4f}, {cz:.4f}); {len(segs)} đoạn đường nối UV gần đó; "
          f"tâm dán ({x:.4f}, {cy:.4f}, {z:.4f}), dời {shift * 100:.1f} cm; logo {width * 100:.1f} × {h * 100:.1f} cm; "
          f"đường nối trong logo (m, nhân độ đục) {s0:.4f} → {s1:.4f}"
          + ("" if s1 == 0 else f"; chỗ gần nhất KHÔNG vắt: {'không có trong ±6 cm' if free is None else f'({free[0]:.4f}, {free[1]:.4f}), cách {np.hypot(free[0] - cx, free[1] - cz) * 100:.1f} cm'}"))

    px, how = base_pixels(cid, cfg, me)
    print(f"[ảnh gốc] {px.shape[1]}×{px.shape[0]} không logo: {how}")
    big0 = upsample(px, SS)
    R = TF.Raster(me, big0.shape[0])
    fit, inside, dev = shirt_fit(big0, R, (x, cy, z), width, h)
    keep_folds = cfg.get("keep_folds", False) or "--keep-folds" in ARGS
    big, info = TF.paste_decal(big0, R, logo, (x, cy, z), width, FACING,
                               shade=fold_shade(big0, fit, *cfg.get("fold_range", (0.85, 1.08))) if keep_folds else None)
    # dưới khung logo phải toàn là vải áo: texel lệch màu nền nhiều (nút trắng, viền cổ, đường may nách) = tràn
    info["keep_folds"] = keep_folds
    info["not_shirt_pct"] = round(float((dev[inside] > 0.18).mean() * 100), 2) if inside.any() else None
    info["rect_x_m"] = [round(x - width / 2, 4), round(x + width / 2, 4)]
    info["rect_z_m"] = [round(z - h / 2, 4), round(z + h / 2, 4)]
    if PAD:
        big, info["gutter_texels"] = pad_painted(big, big0, R.covered)
    out = downscale(big, SS)
    dst = os.path.join(CHECK_DIR, f"{cid}_basecolor_logo_thu.jpg") if DRY else p["tex"]
    save_pixels(out, dst, "JPEG")
    print(f"[dán] {os.path.relpath(logo_path, ROOT)} → {dst}: {info}")
    if not DRY:
        cfg.update({"center": [round(cx, 4), round(cy, 4), round(cz, 4)], "width_m": width,
                    "logo": os.path.relpath(logo_path, ROOT).replace("\\", "/"),
                    "result": {"center": [round(x, 4), round(cy, 4), round(z, 4)], "shift_m": round(shift, 4),
                               "seam_in_logo_m": round(s1, 4), "seam_at_wanted_m": round(s0, 4),
                               "nearest_seam_free": None if free is None else [round(free[0], 4), round(free[1], 4)],
                               "size_m": [round(width, 4), round(h, 4)], "texels": info["texels"],
                               "rect_x_m": info["rect_x_m"], "rect_z_m": info["rect_z_m"],
                               "not_shirt_pct": info["not_shirt_pct"], "keep_folds": keep_folds,
                               "texel_mm": info["texel_mm"]}})
        cfg.setdefault("_ghi_chu", "Tâm logo (m) theo toạ độ của <id>_prep.blend: nhìn -Y, gốc giữa 2 bàn chân; ngực trái "
                                   "nhân vật = +X. width_m = bề rộng phần có hình của logo. result = vị trí dán thật "
                                   "(đã dời nếu vắt qua đường nối UV). Chạy lại: scripts/blender/characters/apply_chest_logo.py")
        with open(p["cfg"], "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    if RENDER:
        # nạp ảnh mới vào chất liệu rồi chụp
        for im in bpy.data.images:
            if im.size[0] > 0:
                im.filepath = dst
                im.reload()
        shots = chest_shots(cid, (x, cy, z), "_thu" if DRY else "", zoom=True)
        if COMPARE:
            ccfg = load_cfg(COMPARE)
            o2 = open_character(COMPARE)
            S2 = Surface(o2.data)
            c2 = ccfg.get("result", {}).get("center") or ccfg["center"]
            y2 = float(S2.hit(c2[0], c2[2])[0][1])
            shots += chest_shots(COMPARE, (c2[0], y2, c2[2]), "")
        compose(shots, os.path.join(RENDER_DIR, f"{cid}_logo_nguc_so_sanh{'_thu' if DRY else ''}.png"))


def chest_shots(cid, center, tag, zoom=False):
    cam = preview_setup()
    out = []
    for k, d in (("front", (0, -1, 0.05)), ("45", (0.71, -0.71, 0.08))):
        path = os.path.join(CHECK_DIR, f"{cid}_logo_{k}{tag}.png")
        shoot(cam, path, center, d, 0.30, res=(640, 640))   # 30 cm ngang: cùng tỉ lệ cho mọi nhân vật
        out.append(path)
    if zoom:   # 10 cm ngang: soi vệt đường nối UV qua logo
        shoot(cam, os.path.join(CHECK_DIR, f"{cid}_logo_zoom{tag}.png"), center, (0, -1, 0.02), 0.10, res=(800, 800))
    preview_teardown()
    return out


def compose(paths, out):
    """2 ảnh mỗi hàng; hàng đầu = nhân vật chính (mảng ảnh Blender: hàng 0 = đáy → nối ngược)."""
    ims = [load_pixels(p)[..., :3] for p in paths]
    gap_v = np.full((ims[0].shape[0], 10, 3), 0.13, dtype=np.float32)
    rows = [np.concatenate([ims[i], gap_v, ims[i + 1]], 1) for i in range(0, len(ims), 2)]
    gap_h = np.full((10, rows[0].shape[1], 3), 0.13, dtype=np.float32)
    grid = rows[0]
    for r in rows[1:]:
        grid = np.concatenate([r, gap_h, grid], 0)
    save_pixels(np.concatenate([grid, np.ones(grid.shape[:2] + (1,), np.float32)], -1), out, "PNG")
    print(f"[render] {out}")


if EXTRACT:
    extract(EXTRACT, rel(OUT or f"assets/logos/logo_tu_{EXTRACT}.png"))
elif CID:
    apply(CID)
else:
    raise SystemExit("cần --id <nhân vật> hoặc --extract-from <nhân vật>")
