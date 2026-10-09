"""Sửa texture màu của nhân vật theo VỊ TRÍ 3D (texture Meshy là atlas vỡ thành hàng trăm mảnh,
nên không vẽ trực tiếp trên ảnh 2D được).

Ý tưởng: raster mọi tam giác UV → biết mỗi texel ứng với điểm 3D nào trên người (vị trí + pháp tuyến).
Từ đó:
  - tô vùng (logo nhòe, vết) bằng màu nội suy mượt từ vành xung quanh trong không gian 3D;
  - dán logo PNG như decal chiếu từ phía trước;
  - lan màu mảnh UV ra lề trắng (edge padding) để thu nhỏ ảnh/mipmap không lộ đường nối trắng.

Chỉ dùng numpy (Python của Blender không có Pillow). Mảng ảnh: hàng 0 = đáy ảnh = v = 0 (quy ước Blender).
"""
import numpy as np


class Raster:
    """Raster UV của mesh: bản đồ texel → điểm 3D, kèm dữ liệu từng tam giác để tô lại theo tam giác
    (sau Decimate các mảnh UV có thể chồng nhau → 1 texel thuộc nhiều mặt; tô theo tam giác thì mọi texel
    mà vùng 3D cần tô đều được tô, không sót)."""

    def __init__(self, me, size):
        self.size = size
        self.uv, self.co, self.fn = _tri_data(me, size)
        self.covered, self.pos, self.nrm = rasterize_arrays(self.uv, self.co, self.fn, size)

    def texels(self, tri_idx):
        """→ yy, xx, pos (k×3), nrm (k×3) của mọi texel thuộc các tam giác tri_idx (có thể trùng texel)."""
        ys, xs, ps, ns = [], [], [], []
        for t in tri_idx:
            r = _raster_tri(self.uv[t], self.size)
            if r is None:
                continue
            yy, xx, w = r
            ys.append(yy)
            xs.append(xx)
            ps.append(w @ self.co[t])
            ns.append(np.repeat(self.fn[t][None], len(yy), 0))
        if not ys:
            return (np.zeros(0, int),) * 2 + (np.zeros((0, 3)),) * 2
        return np.concatenate(ys), np.concatenate(xs), np.concatenate(ps), np.concatenate(ns)

    def tris_in(self, lo, hi, axes, facing, depth_axis, depth_c, depth=0.08, min_dot=0.2):
        """Tam giác có ít nhất 1 đỉnh trong hộp [lo, hi] theo `axes`, hướng `facing`, gần mặt `depth_c`."""
        co = self.co
        inside = np.ones(co.shape[:2], dtype=bool)
        for k in axes:
            inside &= (co[..., k] >= lo[k]) & (co[..., k] <= hi[k])
        near = np.abs(co[..., depth_axis].mean(1) - depth_c) < depth
        face_ok = self.fn @ np.asarray(facing, dtype=np.float64) > min_dot
        return np.where(inside.any(1) & near & face_ok)[0]


def _tri_data(me, size):
    me.calc_loop_triangles()
    uv_layer = me.uv_layers.active.data
    n_tri = len(me.loop_triangles)
    loops = np.empty(n_tri * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("loops", loops)
    verts = np.empty(n_tri * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", verts)
    uv = np.empty(len(uv_layer) * 2, dtype=np.float64)
    uv_layer.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)[loops].reshape(n_tri, 3, 2) * size - 0.5   # toạ độ texel (tâm texel = số nguyên)
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)[verts].reshape(n_tri, 3, 3)
    fn = np.cross(co[:, 1] - co[:, 0], co[:, 2] - co[:, 0])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    return uv, co, fn


def _raster_tri(p, size):
    """Texel (tâm) nằm trong tam giác UV p (3×2, toạ độ texel) → (yy, xx, trọng số barycentric k×3) hoặc None."""
    x0, y0 = np.floor(p.min(0)).astype(int)
    x1, y1 = np.ceil(p.max(0)).astype(int)
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, size - 1), min(y1, size - 1)
    if x1 < x0 or y1 < y0:
        return None
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    (ax, ay), (bx, by), (cx, cy) = p
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-12:
        return None
    w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
    w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
    w2 = 1 - w0 - w1
    inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
    if not inside.any():
        return None
    return ys[inside], xs[inside], np.stack([w0[inside], w1[inside], w2[inside]], 1)


def rasterize_arrays(uv, co, fn, size):
    covered = np.zeros((size, size), dtype=bool)
    pos = np.zeros((size, size, 3), dtype=np.float32)
    nrm = np.zeros((size, size, 3), dtype=np.float32)
    for t in range(len(uv)):
        r = _raster_tri(uv[t], size)
        if r is None:
            continue
        yy, xx, w = r
        covered[yy, xx] = True
        pos[yy, xx] = w @ co[t]
        nrm[yy, xx] = fn[t]
    return covered, pos, nrm


def rasterize(me, size):
    """→ covered (H×W bool), pos (H×W×3), nrm (H×W×3) tại tâm texel (texel trùng: mặt vẽ sau thắng)."""
    return rasterize_arrays(*_tri_data(me, size), size)


def pad_islands(px, covered, iters=12):
    """Lan màu mép mảnh UV ra lề (mỗi vòng 1 texel) — tránh lẫn nền trắng khi thu nhỏ/mipmap."""
    rgb = px[..., :3].copy()
    known = covered.copy()
    for _ in range(iters):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * k[..., None]
            cnt += k
        grow = (~known) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow, None]
        known |= grow
    out = px.copy()
    out[..., :3] = rgb
    return out


def _smooth_fill(px, pos, target, ring, axes, feather_d=None, feather=0.004):
    """Tô texel trong `target` bằng mặt cong bậc 2 (theo 2 trục 3D `axes`) khớp màu texel trong `ring`."""
    a, b = axes
    def design(p):
        x, z = p[:, a], p[:, b]
        return np.stack([np.ones_like(x), x, z, x * x, x * z, z * z], 1)
    A = design(pos[ring].astype(np.float64))
    coef, *_ = np.linalg.lstsq(A, px[ring][:, :3].astype(np.float64), rcond=None)
    fit = design(pos[target].astype(np.float64)) @ coef
    rgb = px[target][:, :3]
    if feather_d is not None:  # hoà dần ở mép vùng tô
        w = np.clip(feather_d[target] / feather, 0, 1)[:, None]
        fit = fit * w + rgb * (1 - w)
    out = px.copy()
    out[target, :3] = np.clip(fit, 0, 1)
    return out, float(np.sqrt(((A @ coef - px[ring][:, :3]) ** 2).mean()))


def _quad_design(p, axes):
    a, b = axes
    x, z = p[:, a], p[:, b]
    return np.stack([np.ones_like(x), x, z, x * x, x * z, z * z], 1)


def remove_patch(px, R, box, facing, deviation=0.16, margin=0.012, ring_w=0.03, near=None, radius=0.06,
                 feather=0.004):
    """Tìm vùng khác màu nền (vd logo) trong hộp 3D `box` ((x0,x1),(y0,y1),(z0,z1)), mặt hướng `facing`
    (vector pháp tuyến), rồi tô lại bằng màu nội suy (mặt cong bậc 2) từ vành xung quanh.
    `near` (x, y, z — y bỏ qua): chỉ lấy cụm khác màu trong bán kính `radius` quanh điểm này
    (tránh viền cổ áo, nút áo cũng khác màu nền). Tô theo TAM GIÁC (R.texels) để không sót texel chồng UV."""
    covered, pos, nrm = R.covered, R.pos, R.nrm
    f = np.asarray(facing, dtype=np.float32)
    in_box = covered & (nrm @ f > 0.35)
    for k, (lo, hi) in enumerate(box):
        in_box &= (pos[..., k] >= lo) & (pos[..., k] <= hi)
    base = np.median(px[in_box][:, :3], axis=0)
    dev = np.linalg.norm(px[..., :3] - base, axis=-1)
    patch = in_box & (dev > deviation)
    if patch.sum() < 10:
        raise RuntimeError(f"không thấy vùng khác màu trong hộp {box} (nền {base.round(3)})")
    pp = pos[patch]
    axes = [k for k in range(3) if abs(f[k]) < 0.5]       # 2 trục nằm trên mặt (bỏ trục chiếu)
    if near is not None:
        ref = np.asarray(near, dtype=np.float64)
        pp = pp[np.linalg.norm(pp[:, axes] - ref[axes], axis=1) < radius]
        if len(pp) < 10:
            raise RuntimeError(f"không thấy vùng khác màu quanh {near}")
    else:
        c = np.median(pp, axis=0)
        pp = pp[np.linalg.norm(pp - c, axis=1) < radius]  # cụm chính quanh trung vị
    c = np.median(pp, axis=0)
    lo, hi = pp.min(0) - margin, pp.max(0) + margin
    dax = [k for k in range(3) if k not in axes][0]       # trục chiều sâu (trục chiếu)

    def dist_out(p):  # >0: ngoài hộp vùng tô (m), theo 2 trục trên mặt
        d = np.zeros(p.shape[:-1])
        for k in axes:
            d = np.maximum(d, np.maximum(lo[k] - p[..., k], p[..., k] - hi[k]))
        return d

    # vành lấy màu: texel quanh vùng, cùng hướng, gần màu nền
    front = covered & (nrm @ f > 0.2) & (np.abs(pos[..., dax] - c[dax]) < 0.08)
    d_map = dist_out(pos)
    ring = front & (d_map > feather) & (d_map < ring_w) & (np.linalg.norm(px[..., :3] - base, axis=-1) < deviation)
    A = _quad_design(pos[ring].astype(np.float64), axes)
    coef, *_ = np.linalg.lstsq(A, px[ring][:, :3].astype(np.float64), rcond=None)
    rms = float(np.sqrt(((A @ coef - px[ring][:, :3]) ** 2).mean()))

    # tô: mọi texel của các tam giác chạm vùng (kể cả texel UV chồng nhau)
    tris = R.tris_in(lo - 0.02, hi + 0.02, axes, f, dax, c[dax])
    yy, xx, P, _ = R.texels(tris)
    d = dist_out(P)
    keep = d <= 0
    yy, xx, P, d = yy[keep], xx[keep], P[keep], d[keep]
    w = np.clip(-d / feather, 0, 1)[:, None]               # hoà dần ở mép vùng
    fit = np.clip(_quad_design(P, axes) @ coef, 0, 1)
    out = px.copy()
    out[yy, xx, :3] = fit * w + px[yy, xx, :3] * (1 - w)
    info = {"center": c.round(4).tolist(), "size": (hi - lo).round(4).tolist(), "tris": int(len(tris)),
            "texels": int(len(yy)), "ring": int(ring.sum()), "base": base.round(3).tolist(), "fit_rms": round(rms, 4)}
    return out, info


def uv_seam_segments(me, region, facing=None):
    """Các cạnh là đường nối UV (2 mặt kề có UV khác nhau) nằm trong hộp 3D `region`, mặt kề hướng `facing`."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    f = None if facing is None else np.asarray(facing, dtype=np.float64)
    segs = []
    for e in bm.edges:
        if len(e.link_loops) != 2:
            continue
        a, b = np.array(e.verts[0].co), np.array(e.verts[1].co)
        if not all(lo <= a[k] <= hi and lo <= b[k] <= hi for k, (lo, hi) in enumerate(region)):
            continue
        l1, l2 = e.link_loops
        if (l1[uv].uv - l2.link_loop_next[uv].uv).length < 1e-5 and (l1.link_loop_next[uv].uv - l2[uv].uv).length < 1e-5:
            continue
        if f is not None and not any(np.dot(np.array(fc.normal), f) > 0 for fc in e.link_faces):
            continue
        segs.append((a.tolist(), b.tolist()))
    bm.free()
    return segs


def paint_band(px, R, segments, region, width=0.005, ring_w=0.02, facing=None):
    """Tô dải rộng `width` quanh các đoạn 3D `segments` (vd đường nối UV lộ vết) bằng màu nội suy từ vành."""
    covered, pos, nrm = R.covered, R.pos, R.nrm
    sel = covered.copy()
    for k, (lo, hi) in enumerate(region):
        sel &= (pos[..., k] >= lo) & (pos[..., k] <= hi)
    if facing is not None:
        sel &= nrm @ np.asarray(facing, dtype=np.float32) > 0.0
    p = pos[sel].astype(np.float64)
    d = np.full(len(p), np.inf)
    for a, b in segments:
        a, b = np.asarray(a), np.asarray(b)
        ab = b - a
        t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.minimum(d, np.linalg.norm(p - (a + t[:, None] * ab), axis=1))
    dist = np.full(pos.shape[:2], np.inf, dtype=np.float32)
    dist[sel] = d
    target = sel & (dist <= width)
    ring = sel & (dist > width) & (dist < ring_w)
    # trục chiếu = trục có pháp tuyến trung bình lớn nhất → khớp theo 2 trục còn lại
    mean_n = np.abs(nrm[target].mean(0))
    axes = [k for k in range(3) if k != int(mean_n.argmax())]
    feather = np.where(np.isfinite(dist), width - dist, 0).astype(np.float32)
    out, rms = _smooth_fill(px, pos, target, ring, axes, feather_d=feather, feather=width * 0.5)
    return out, {"texels": int(target.sum()), "ring": int(ring.sum()), "fit_rms": round(rms, 4)}


def _shift_or(m):
    out = m.copy()
    out[1:] |= m[:-1]
    out[:-1] |= m[1:]
    out[:, 1:] |= m[:, :-1]
    out[:, :-1] |= m[:, 1:]
    return out


def prepare_logo(logo, fill_holes=None, alpha_min=16 / 255):
    """Cắt lề trong suốt; tuỳ chọn tô các lỗ kín (vd chữ trắng bị công cụ xoá nền làm trong suốt)."""
    a = logo[..., 3]
    if fill_holes is not None:
        low = a < 0.5
        outside = np.zeros_like(low)
        outside[0, :], outside[-1, :], outside[:, 0], outside[:, -1] = low[0, :], low[-1, :], low[:, 0], low[:, -1]
        while True:  # loang từ mép ảnh qua vùng trong suốt = nền ngoài
            grown = _shift_or(outside) & low
            if (grown == outside).all():
                break
            outside = grown
        outside = _shift_or(_shift_or(outside))  # gồm cả viền khử răng cưa phía ngoài
        holes = ~outside & (a < 1.0)
        col = np.asarray(fill_holes, dtype=np.float32)
        logo = logo.copy()
        logo[holes, :3] = logo[holes, :3] * a[holes, None] + col * (1 - a[holes, None])
        logo[holes, 3] = 1.0
        a = logo[..., 3]
    ys, xs = np.where(a > alpha_min)
    return logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1], int(holes.sum()) if fill_holes is not None else 0


def paste_decal(px, R, logo, center, width, facing=(0, -1, 0), depth=0.06):
    """Dán ảnh RGBA `logo` (H×W×4, hàng 0 = đáy) chiếu song song theo -facing, tâm `center` (3D), rộng `width` m.
    Chỉ chiếu lên mặt hướng về phía trước. Trục ngang = X, trục đứng = Z (nhân vật nhìn -Y). Dán theo tam giác."""
    lh, lw = logo.shape[:2]
    height = width * lh / lw
    cx, cy, cz = center
    lo = np.array([cx - width / 2, cy, cz - height / 2]) - 0.02
    hi = np.array([cx + width / 2, cy, cz + height / 2]) + 0.02
    tris = R.tris_in(lo, hi, (0, 2), facing, 1, cy, depth=depth, min_dot=0.3)
    yy, xx, P, _ = R.texels(tris)
    u = (P[:, 0] - (cx - width / 2)) / width
    v = (P[:, 2] - (cz - height / 2)) / height
    if tuple(facing) == (0, 1, 0):
        u = 1 - u
    sel = (u >= 0) & (u <= 1) & (v >= 0) & (v <= 1)
    yy, xx = yy[sel], xx[sel]
    # lấy mẫu song tuyến
    x = u[sel] * (lw - 1)
    y = v[sel] * (lh - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, lw - 1), np.minimum(y0 + 1, lh - 1)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    s = (logo[y0, x0] * (1 - fx) * (1 - fy) + logo[y0, x1] * fx * (1 - fy)
         + logo[y1, x0] * (1 - fx) * fy + logo[y1, x1] * fx * fy)
    a = s[:, 3:4]
    out = px.copy()
    out[yy, xx, :3] = s[:, :3] * a + px[yy, xx, :3] * (1 - a)
    area = width * height
    return out, {"tris": int(len(tris)), "texels": int(len(yy)), "size_m": (round(width, 4), round(height, 4)),
                 "texel_mm": round(float(np.sqrt(area / max(len(np.unique(yy * R.size + xx)), 1))) * 1000, 2)}
