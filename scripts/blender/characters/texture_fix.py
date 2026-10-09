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

    def texels_bary(self, tri_idx):
        """→ yy, xx, trọng số barycentric (k×3), chỉ số tam giác (k) của mọi texel thuộc các tam giác tri_idx."""
        ys, xs, ws, ts = [], [], [], []
        for t in tri_idx:
            r = _raster_tri(self.uv[t], self.size)
            if r is None:
                continue
            ys.append(r[0])
            xs.append(r[1])
            ws.append(r[2])
            ts.append(np.full(len(r[0]), t))
        if not ys:
            return np.zeros(0, int), np.zeros(0, int), np.zeros((0, 3)), np.zeros(0, int)
        return np.concatenate(ys), np.concatenate(xs), np.concatenate(ws), np.concatenate(ts)

    def vertex_normals(self):
        """Pháp tuyến mượt tại 3 đỉnh mỗi tam giác (n×3×3): gộp đỉnh trùng toạ độ, cộng pháp tuyến mặt theo diện tích."""
        V = self.co.reshape(-1, 3)
        _, inv = np.unique(np.round(V / 1e-5).astype(np.int64), axis=0, return_inverse=True)
        inv = inv.ravel()
        an = np.cross(self.co[:, 1] - self.co[:, 0], self.co[:, 2] - self.co[:, 0])
        acc = np.zeros((inv.max() + 1, 3))
        np.add.at(acc, inv, np.repeat(an, 3, axis=0))
        acc /= np.maximum(np.linalg.norm(acc, axis=1, keepdims=True), 1e-12)
        return acc[inv].reshape(-1, 3, 3)

    def tris_in(self, lo, hi, axes, facing, depth_axis, depth_c, depth=0.08, min_dot=0.2):
        """Tam giác có khung bao giao với hộp [lo, hi] theo `axes` (kể cả tam giác lớn phủ qua hộp mà không có đỉnh nào
        bên trong — mesh đã giảm mạnh), hướng `facing`, gần mặt `depth_c`."""
        co = self.co
        overlap = np.ones(co.shape[0], dtype=bool)
        for k in axes:
            overlap &= (co[..., k].min(1) <= hi[k]) & (co[..., k].max(1) >= lo[k])
        near = np.abs(co[..., depth_axis].mean(1) - depth_c) < depth
        face_ok = self.fn @ np.asarray(facing, dtype=np.float64) > min_dot
        return np.where(overlap & near & face_ok)[0]


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


LUMA = np.array([0.2126, 0.7152, 0.0722])


class FrontCaster:
    """Chiếu tia từ phía trước (−Y → +Y) lên các tam giác của Raster: điểm (x, z) trên mặt → toạ độ texel (x, y).
    Dùng để lấy mẫu ảnh theo vị trí 3D (vd phóng to mắt: texel đích lấy màu ở điểm 3D khác)."""

    def __init__(self, R):
        from mathutils import Vector
        from mathutils.bvhtree import BVHTree
        self.R, self.V = R, Vector
        n = len(R.co)
        self.bvh = BVHTree.FromPolygons([Vector(v) for v in R.co.reshape(-1, 3)], np.arange(n * 3).reshape(n, 3).tolist())

    def depth(self, x, z):
        """y của mặt đầu tiên tia trúng (None nếu trượt)."""
        loc = self.bvh.ray_cast(self.V((x, -3.0, z)), self.V((0, 1, 0)), 6.0)[0]
        return None if loc is None else float(loc[1])

    def texel(self, x, z):
        loc, _, idx, _ = self.bvh.ray_cast(self.V((x, -3.0, z)), self.V((0, 1, 0)), 6.0)
        if loc is None:
            return None
        a, b, c = self.R.co[idx]
        p = np.array(loc)
        v0, v1, v2 = b - a, c - a, p - a
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        w1 = (d11 * d20 - d01 * d21) / den
        w2 = (d00 * d21 - d01 * d20) / den
        return np.array([1 - w1 - w2, w1, w2]) @ self.R.uv[idx]


def _bilinear(px, x, y):
    h, w = px.shape[:2]
    x0, y0 = int(np.floor(x)), int(np.floor(y))
    fx, fy = x - x0, y - y0
    x0c, x1c = np.clip([x0, x0 + 1], 0, w - 1)
    y0c, y1c = np.clip([y0, y0 + 1], 0, h - 1)
    return (px[y0c, x0c] * (1 - fx) * (1 - fy) + px[y0c, x1c] * fx * (1 - fy)
            + px[y1c, x0c] * (1 - fx) * fy + px[y1c, x1c] * fx * fy)


def magnify(px, R, center, radii, scale, inner=0.55, facing=(0, -1, 0), depth=0.03, caster=None):
    """Phóng to một vùng trên texture theo vị trí 3D (vd mắt): trong elip bán kính `radii` (x, z) m quanh `center`,
    phần trong `inner` × bán kính phóng ĐỀU ×scale (giữ hình tròng mắt), ra tới mép elip hoà mượt về ×1 (phần ngoài —
    lông mày, má — giữ nguyên). Texel đích lấy màu ảnh GỐC tại điểm nguồn, qua tia chiếu từ phía trước.
    center[1] (y) = None → lấy y của mặt tại (x, z)."""
    caster = caster or FrontCaster(R)
    cx, cy, cz = center
    if cy is None:
        cy = caster.depth(cx, cz)
    rx, rz = radii
    lo = np.array([cx - rx, cy - depth, cz - rz])
    hi = np.array([cx + rx, cy + depth, cz + rz])
    tris = R.tris_in(lo, hi, (0, 2), facing, 1, cy, depth=depth, min_dot=0.3)
    yy, xx, P, _ = R.texels(tris)
    d = P[:, [0, 2]] - np.array([cx, cz])
    r = np.hypot(d[:, 0] / rx, d[:, 1] / rz)
    sel = r < 1
    yy, xx, d, r = yy[sel], xx[sel], d[sel], r[sel]
    t = np.clip((r - inner) / (1 - inner), 0, 1)
    s = t * t * (3 - 2 * t)
    g = (1 / scale) * (1 - s) + s                 # điểm nguồn = tâm + d·g (g = 1/scale ở giữa, 1 ở mép)
    src = np.array([cx, cz]) + d * g[:, None]
    out = px.copy()
    miss = 0
    for k in range(len(yy)):
        tx = caster.texel(src[k, 0], src[k, 1])
        if tx is None:
            miss += 1
            continue
        out[yy[k], xx[k], :3] = _bilinear(px, tx[0], tx[1])[:3]
    return out, {"center": [round(float(v), 4) for v in (cx, cy, cz)], "radii": list(radii), "scale": scale,
                 "texels": int(len(yy)), "miss": miss}


def collar_fix(px, R, band, axis_xy, neck_z, inward=(0.02, -0.08), dark=0.3):
    """Mặt TRONG cổ áo (dải z `band`, pháp tuyến quay vào trục cổ `axis_xy`) bị Meshy tô màu da lởm chởm → tô lại
    màu áo. Pháp tuyến MƯỢT nội suy theo từng texel (không theo mặt) → ranh giới chạy theo nếp gấp cổ áo / cổ, không
    răng cưa theo cạnh tam giác; mức đổi tăng dần khi thành phần hướng vào trục đi từ inward[0] tới inward[1].
    Chỉ đổi texel giống màu da hơn màu áo (tóc, viền tối giữ nguyên); texel lẫn đổi theo tỉ lệ. Màu da mẫu: cổ (mặt
    quay ra, dải `neck_z`); màu áo mẫu: phần mặt trong cổ áo vốn đã đúng màu áo, không đủ thì thân áo dưới cổ."""
    covered, pos, nrm = R.covered, R.pos, R.nrm
    ax = np.asarray(axis_xy, np.float64)

    def radial(P, N):
        v = P[..., :2] - ax
        rr = np.linalg.norm(v, axis=-1)
        return rr, (N[..., :2] * v).sum(-1) / np.maximum(rr, 1e-6)

    rr, nr = radial(pos, nrm)
    lum = px[..., :3] @ LUMA
    neck = covered & (pos[..., 2] > neck_z[0]) & (pos[..., 2] < neck_z[1]) & (nr > 0.3) & (lum > 0.45)
    skin = np.median(px[neck][:, :3], 0)
    below = covered & (pos[..., 2] > band[0] - 0.10) & (pos[..., 2] < band[0] - 0.03) & (nrm[..., 1] < -0.5) \
        & (np.abs(pos[..., 0]) > 0.03)
    shirt = np.median(px[below][:, :3], 0)
    # tam giác trong dải có ít nhất 1 đỉnh quay vào trục (pháp tuyến mượt) → texel: pháp tuyến nội suy
    vn = R.vertex_normals()
    cen = R.co.mean(1)
    vnr = np.stack([radial(R.co[:, k], vn[:, k])[1] for k in range(3)], 1)
    tris = np.where((cen[:, 2] > band[0]) & (cen[:, 2] < band[1]) & (vnr.min(1) < inward[0]))[0]
    yy, xx, w, ti = R.texels_bary(tris)
    P = np.einsum("kj,kjd->kd", w, R.co[ti])
    N = np.einsum("kj,kjd->kd", w, vn[ti])
    _, nrs = radial(P, N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9))
    t = np.clip((nrs - inward[0]) / (inward[1] - inward[0]), 0, 1)
    g = t * t * (3 - 2 * t)                                           # 0 = quay ra / ngang, 1 = quay hẳn vào cổ
    C = px[yy, xx, :3].astype(np.float64)
    sv = skin - shirt
    a = np.clip(((C - shirt) @ sv) / max(sv @ sv, 1e-9), 0, 1)       # 0 = màu áo, 1 = màu da
    a[(C @ LUMA) < dark] = 0                                          # tóc / viền tối: giữ
    good = (a < 0.15) & (g > 0.5)
    fill = np.median(C[good], 0) if good.sum() > 50 else shirt * 0.92
    k = a * g
    out = px.copy()
    out[yy, xx, :3] = np.clip(C + k[:, None] * (fill - skin), 0, 1)
    return out, {"tris": int(len(tris)), "texels": int(len(yy)), "changed": int((k > 0.15).sum()),
                 "skin": skin.round(3).tolist(), "shirt": shirt.round(3).tolist(), "fill": np.round(fill, 3).tolist()}


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


def paste_decal(px, R, logo, center, width, facing=(0, -1, 0), depth=0.06, shade=None):
    """Dán ảnh RGBA `logo` (H×W×4, hàng 0 = đáy) chiếu song song theo -facing, tâm `center` (3D), rộng `width` m.
    Chỉ chiếu lên mặt hướng về phía trước. Trục ngang = X, trục đứng = Z (nhân vật nhìn -Y). Dán theo tam giác.
    shade(yy, xx, P) → hệ số (k,) nhân vào màu logo (giữ nếp vải / bóng đổ của texture bên dưới)."""
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
    if shade is not None:
        s = s.copy()
        s[:, :3] = np.clip(s[:, :3] * shade(yy, xx, P[sel])[:, None], 0, 1)
    out = px.copy()
    out[yy, xx, :3] = s[:, :3] * a + px[yy, xx, :3] * (1 - a)
    area = width * height
    return out, {"tris": int(len(tris)), "texels": int(len(yy)), "size_m": (round(width, 4), round(height, 4)),
                 "texel_mm": round(float(np.sqrt(area / max(len(np.unique(yy * R.size + xx)), 1))) * 1000, 2)}
