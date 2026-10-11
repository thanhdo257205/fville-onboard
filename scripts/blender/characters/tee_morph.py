"""Áo phông cho bộ "ao_cam" khi áo gốc Meshy là hoodie (vd intern_nu_buitoc): morph target "ao_cam" trên cùng lưới.

Gọi từ build_character.py khi mixamo/actions.json có "tee_morph": { ... } (tuỳ chọn, mặc định ở TEE_DEFAULTS):
  prepare(arm, mesh, opts, char_dir, cid)  — lưới đầy đủ ở tư thế gốc (trước khi giảm), có xương + trọng số:
      tính độ dời từng đỉnh (hình áo phông), đỉnh tay lộ ra (bare), đỉnh mũ trùm / dây rút (flat); trả trạng thái
  apply(mesh, state)  — sau khi giảm tam giác: mỗi đỉnh lưới cuối lấy độ dời / bare / flat của điểm gần nhất trên lưới
      gốc (nội suy trọng tâm) → shape key Basis + "ao_cam"; tô texture theo tam giác của lưới cuối (ranh giới da / áo
      đi theo cạnh lưới — tô trên lưới đầy đủ thì lưới đã giảm lấy mẫu lệch, mép lởm chởm): tay lộ ra → màu da, mũ /
      dây rút cũ → cam đều → textures/<id>_basecolor_tee.jpg (gắn vào chất liệu thay ảnh bộ ao_cam). Game: Character.setOutfit bật morph cùng tên bộ đồ đang mặc
      (null = bộ trong GLB = ao_cam → influence 1; bộ khác → 0).

Hình áo phông (toạ độ Blender, nhìn −Y, z lên; vùng đỉnh theo mặt nạ textures/<id>_mask.png của outfit_textures.py):
  - tay áo: trục cánh tay = vai (đầu xương Arm) → khuỷu (ForeArm) → cổ tay (Hand). Đỉnh áo thuộc tay (trọng số Arm +
    ForeArm + Hand ≥ 0,5): xa vai hơn hem_frac × dài cánh tay trên → kéo về ống bán kính r(s) (cánh tay trần: cổ tay
    r_wrist đo từ bàn tay, khuỷu × elbow_k, bắp tay × upper_k) và tô màu da; gần vai hơn → tay áo ngắn: bán kính
    tối đa r(s) + sleeve_ease.
  - mũ trùm (sau gáy + 2 vạt vòng ra trước cổ): đỉnh áo cao hơn z của xương Spine2 + hood_z_m, cách trục đứng qua xương
    Neck < hood_r_m → giải phương trình Laplace (Jacobi, trọng số đều) với các đỉnh xung quanh giữ nguyên: khối mũ xẹp
    thành mặt lưng / vai trơn — chỉ phía sau tâm cổ (ngực trước dưới vòng cổ giữ nguyên: logo) — (đỉnh thuộc tay — trọng số tay ≥ 0,5 — không tính: giữ tay áo ngắn). Đỉnh mũ cao hơn vòng
    cổ áo (bán kính = cổ + collar_gap_m, z = đầu xương Neck + collar_z_front ở trước … collar_z_back ở sau) ghim xuống
    vòng đó — lưới Meshy kín, mép mũ chỉ là nếp gấp; không ghim thì mũ co thành cổ áo đứng cao lên gáy. Mặt trong của
    mũ xẹp theo, quay vào trong → bị cắt mặt sau.
  - dây rút trước ngực: đỉnh áo phía trước (y < tâm cổ − string_front_m), |x| < string_x_m, z trong string_z, nhô ra
    trước mặt áo → ép sát mặt áo (thụt string_inset_m; đẩy sâu hơn thì chỗ dây nối áo thành khe dọc), tô cùng màu áo.
"""
import os

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TEE_DEFAULTS = {
    "hem_frac": 0.42,          # gấu tay áo ngắn: phần cánh tay trên tính từ vai
    "sleeve_ease": 0.014,      # m — tay áo ngắn rộng hơn bắp tay
    "elbow_k": 1.30, "upper_k": 1.45,
    "hood_z_m": 0.02, "hood_r_m": 0.19, "hood_iters": 3000,
    "collar_z_front": -0.015, "collar_z_back": 0.02, "collar_gap_m": 0.006,   # vòng cổ áo: z so với đầu xương Neck
    "back_flat_m": 0.12,       # tô đều màu áo lưng trên (bóng mũ nướng sẵn): thêm bán kính / hạ thấp so với vùng mũ
    "string_front_m": 0.0, "string_x_m": 0.055, "string_z": [0.92, 1.27], "string_inset_m": 0.002,
}
MASK_SHIRT, MASK_SKIN = (1, 0, 0), (1, 1, 0)


def _arr(it, n, k):
    a = np.empty(n * k)
    it.foreach_get("co" if k == 3 else "uv", a)
    return a.reshape(n, k)


def _vertex_labels(me, mask_path):
    """Nhãn đỉnh theo mặt nạ (màu texel tại UV, trung bình các góc) → (áo, da) bool."""
    img = bpy.data.images.load(mask_path)
    w, h = img.size
    px = np.array(img.pixels[:]).reshape(h, w, 4)[..., :3]
    bpy.data.images.remove(img)
    uv = _arr(me.uv_layers.active.data, len(me.loops), 2)
    lv = np.empty(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", lv)
    x = np.clip((uv[:, 0] * w).astype(int), 0, w - 1)
    y = np.clip((uv[:, 1] * h).astype(int), 0, h - 1)
    acc = np.zeros((len(me.vertices), 3))
    cnt = np.zeros(len(me.vertices))
    np.add.at(acc, lv, px[y, x])
    np.add.at(cnt, lv, 1)
    c = acc / np.maximum(cnt, 1)[:, None]
    near = lambda ref: np.abs(c - np.array(ref)).max(1) < 0.35
    return near(MASK_SHIRT), near(MASK_SKIN)


def _weights(mesh, names):
    """Tổng trọng số của các xương `names` (theo tên vertex group) cho từng đỉnh."""
    idx = {g.index for g in mesh.vertex_groups if g.name in names}
    w = np.zeros(len(mesh.data.vertices))
    for v in mesh.data.vertices:
        w[v.index] = sum(g.weight for g in v.groups if g.group in idx)
    return w


def _neighbors(me):
    n = len(me.vertices)
    e = np.empty(len(me.edges) * 2, np.int64)
    me.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    return np.concatenate([e, e[:, ::-1]]), n


def _closest_on_polyline(p, pts):
    """p (N×3), polyline pts (K×3) → (điểm gần nhất N×3, độ dài cung từ pts[0] N)."""
    best_d = np.full(len(p), np.inf)
    best_c = np.zeros_like(p)
    best_s = np.zeros(len(p))
    s0 = 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        ab = b - a
        L = np.linalg.norm(ab)
        t = np.clip(((p - a) @ ab) / (L * L), 0, 1)
        c = a + t[:, None] * ab
        d = np.linalg.norm(p - c, axis=1)
        m = d < best_d
        best_d[m], best_c[m], best_s[m] = d[m], c[m], s0 + t[m] * L
        s0 += L
    return best_c, best_s


def prepare(arm, mesh, opts, char_dir, cid):
    o = dict(TEE_DEFAULTS, **(opts if isinstance(opts, dict) else {}))
    me = mesh.data
    n = len(me.vertices)
    co = _arr(me.vertices, n, 3)
    co = (np.array(mesh.matrix_world) @ np.c_[co, np.ones(n)].T).T[:, :3]
    mask = os.path.join(char_dir, "textures", f"{cid}_mask.png")
    if not os.path.exists(mask):
        raise RuntimeError(f"tee_morph: thiếu {mask} — chạy outfit_textures.py --original dau_ngay trước")
    shirt, skin = _vertex_labels(me, mask)
    bw = lambda n_: np.array(arm.matrix_world @ arm.data.bones[f"mixamorig:{n_}"].head_local)
    disp = np.zeros_like(co)
    bare = np.zeros(n)                        # 1 = da lộ ra ở bộ áo phông (tô màu da lên texture)
    info = {}

    # --- tay áo ---
    for side in ("Left", "Right"):
        sh, el, wr = bw(f"{side}Arm"), bw(f"{side}ForeArm"), bw(f"{side}Hand")
        L_up = float(np.linalg.norm(el - sh))
        tip = wr + (wr - el) / np.linalg.norm(wr - el) * 0.08          # kéo dài qua cổ tay để đo bàn tay
        w_arm = _weights(mesh, {f"mixamorig:{side}{b}" for b in ("Arm", "ForeArm", "Hand")})
        c, s = _closest_on_polyline(co, np.array([sh, el, wr, tip]))
        L_wr = L_up + float(np.linalg.norm(wr - el))
        rad = np.linalg.norm(co - c, axis=1)
        hand = skin & (w_arm > 0.5) & (s > L_wr) & (s < L_wr + 0.03)
        r_wr = float(np.median(rad[hand])) if hand.sum() > 5 else 0.026
        r_el, r_up = r_wr * o["elbow_k"], r_wr * o["upper_k"]
        r_of = lambda s_: np.interp(s_, [0, L_up, L_wr], [r_up, r_el, r_wr])
        s_hem = o["hem_frac"] * L_up
        sel = shirt & (w_arm >= 0.5)
        rv = co - c
        unit = rv / np.maximum(rad, 1e-6)[:, None]
        cut = sel & (s > s_hem)
        keep = sel & (s <= s_hem)
        new = co.copy()
        new[cut] = c[cut] + unit[cut] * r_of(s[cut])[:, None]
        rk = np.minimum(rad[keep], r_of(s[keep]) + o["sleeve_ease"])
        new[keep] = c[keep] + unit[keep] * rk[:, None]
        wgt = np.clip((w_arm - 0.5) * 4, 0, 1)[:, None]                 # mép vai (trọng số lẫn thân) dời ít dần
        disp += np.where(sel[:, None], (new - co) * np.where(cut[:, None], 1.0, wgt), 0)
        bare[cut] = 1
        bare[skin & (w_arm >= 0.5)] = 1       # tam giác giáp bàn tay (bo tay áo) cũng tô da — chỉ texel áo bị tô
        info[side] = {"r_wrist_m": round(r_wr, 4), "hem_s_m": round(s_hem, 3), "sleeve_cut": int(cut.sum()),
                      "sleeve_keep": int(keep.sum())}

    # --- mũ trùm → mặt lưng trơn (Laplace) ---
    w_arms = _weights(mesh, {f"mixamorig:{sd}{b}" for sd in ("Left", "Right") for b in ("Arm", "ForeArm", "Hand")})
    neck, sp2 = bw("Neck"), bw("Spine2")
    half_sh = 0.5 * float(np.linalg.norm(bw("LeftArm") - bw("RightArm")))
    hood = (shirt & (co[:, 2] > sp2[2] + o["hood_z_m"])
            & (np.hypot(co[:, 0] - neck[0], co[:, 1] - neck[1]) < o["hood_r_m"]) & (bare == 0) & (w_arms < 0.5))
    E, _ = _neighbors(me)
    deg = np.bincount(E[:, 0], minlength=n).astype(float)
    p = co + disp
    # đỉnh mũ cao hơn vòng cổ áo → ghim vào vòng
    neck_r = np.hypot(co[:, 0] - neck[0], co[:, 1] - neck[1])
    nsk = skin & (np.abs(co[:, 2] - (neck[2] + 0.03)) < 0.015) & (neck_r < 0.08)
    r_neck = float(np.median(neck_r[nsk])) if nsk.sum() > 5 else 0.045
    ang = np.arctan2(co[:, 0] - neck[0], -(co[:, 1] - neck[1]))          # 0 = trước (−Y)
    back = (1 - np.cos(ang)) / 2
    zr = neck[2] + o["collar_z_front"] + (o["collar_z_back"] - o["collar_z_front"]) * back
    rr = r_neck + o["collar_gap_m"]
    rim = hood & (co[:, 2] > zr)
    hood &= rim | (co[:, 1] > neck[1] - 0.02)      # ngực trước dưới vòng cổ giữ nguyên (logo, dây rút xử lý riêng)
    p[rim, 0] = neck[0] + np.sin(ang[rim]) * rr
    p[rim, 1] = neck[1] - np.cos(ang[rim]) * rr
    p[rim, 2] = zr[rim]
    free = hood & ~rim
    for _ in range(o["hood_iters"]):
        avg = np.zeros_like(p)
        np.add.at(avg, E[:, 0], p[E[:, 1]])
        avg /= np.maximum(deg, 1)[:, None]
        p[free] = avg[free]
    disp[hood] = p[hood] - co[hood]
    info["hood"] = {"verts": int(hood.sum()), "rim": int(rim.sum()), "r_neck_m": round(r_neck, 4), "max_move_m": round(float(np.linalg.norm(disp[hood], axis=1).max()), 3)
                    if hood.any() else 0.0}

    # --- dây rút trước ngực → lùi vào trong ---
    z0, z1 = o["string_z"]
    strings = (shirt & (co[:, 1] < neck[1] - o["string_front_m"]) & (np.abs(co[:, 0]) < o["string_x_m"])
               & (co[:, 2] > z0) & (co[:, 2] < z1) & ~hood & (bare == 0))
    # chỉ phần nhô ra trước mặt áo: so với mặt áo trước ngực ở cùng độ cao (phân vị 70 % của y, các đỉnh áo |x| < 0,1)
    front = shirt & (np.abs(co[:, 0]) < 0.10) & (co[:, 1] < neck[1])
    zb = np.round(co[:, 2] / 0.02).astype(int)
    surf = {}
    for k in np.unique(zb[front]):
        surf[k] = np.percentile(co[front & (zb == k), 1], 70)
    proud = np.array([strings[i] and co[i, 1] < surf.get(zb[i], -1) - 0.006 for i in range(n)])
    target_y = np.array([surf.get(zb[i], co[i, 1]) for i in range(n)]) + o["string_inset_m"]
    disp[proud, 1] += target_y[proud] - co[proud, 1]
    info["strings"] = int(proud.sum())
    info["neck_z_m"], info["spine2_z_m"] = round(float(neck[2]), 3), round(float(sp2[2]), 3)
    print(f"[áo phông] {info}")
    # màu da (bàn tay, dưới 1 m) + màu áo cam (trung vị) lấy từ ảnh của chất liệu, trên lưới đầy đủ
    node = next(n_ for n_ in mesh.data.materials[0].node_tree.nodes if n_.type == "TEX_IMAGE")
    vc = _vertex_colors(me, _pixels(node.image))
    skin_rgb = np.median(vc[skin & (co[:, 2] < 1.0)], 0)
    shirt_rgb = np.median(vc[shirt & ~hood & ~proud & (bare == 0)], 0)
    upback = (shirt & (bare == 0) & (co[:, 1] > neck[1]) & (co[:, 2] > sp2[2] + o["hood_z_m"] - o["back_flat_m"])
              & (neck_r < o["hood_r_m"] + o["back_flat_m"]))
    flat = (hood | proud | upback).astype(float)
    return {"co": co, "disp": disp, "tris": np.array(_tris(me)), "bare": bare, "flat": flat, "info": info,
            "skin_rgb": skin_rgb, "shirt_rgb": shirt_rgb, "char_dir": char_dir, "cid": cid}


def _pixels(img):
    w, h = img.size
    return np.array(img.pixels[:]).reshape(h, w, 4)


def _vertex_colors(me, px):
    h, w = px.shape[:2]
    uv = _arr(me.uv_layers.active.data, len(me.loops), 2)
    lv = np.empty(len(me.loops), np.int64)
    me.loops.foreach_get("vertex_index", lv)
    x = np.clip((uv[:, 0] * w).astype(int), 0, w - 1)
    y = np.clip((uv[:, 1] * h).astype(int), 0, h - 1)
    acc = np.zeros((len(me.vertices), 3))
    cnt = np.zeros(len(me.vertices))
    np.add.at(acc, lv, px[y, x, :3])
    np.add.at(cnt, lv, 1)
    return acc / np.maximum(cnt, 1)[:, None]


def _tris(me):
    me.calc_loop_triangles()
    return [t.vertices[:] for t in me.loop_triangles]


def _raster(me, val, w, h, max_uv=0.08):
    """Texel nào thuộc tam giác có giá trị nội suy (trọng tâm, theo `val` từng đỉnh) ≥ 0,5. Bỏ tam giác có cạnh UV dài
    hơn max_uv (lưới đã giảm có tam giác vắt qua đường nối UV: một góc nằm ở mảng UV khác → phủ ngang atlas)."""
    me.calc_loop_triangles()
    uv = _arr(me.uv_layers.active.data, len(me.loops), 2)
    out = np.zeros((h, w), bool)
    for t in me.loop_triangles:
        b = val[list(t.vertices)]
        if b.max() < 0.5:
            continue
        Q = uv[list(t.loops)]
        if max(np.linalg.norm(Q[0] - Q[1]), np.linalg.norm(Q[1] - Q[2]), np.linalg.norm(Q[2] - Q[0])) > max_uv:
            continue
        P = Q * [w, h]
        x0, y0 = np.floor(P.min(0)).astype(int) - 1
        x1, y1 = np.ceil(P.max(0)).astype(int) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w - 1), min(y1, h - 1)
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, bb, c = P
        den = (bb[1] - c[1]) * (a[0] - c[0]) + (c[0] - bb[0]) * (a[1] - c[1])
        if abs(den) < 1e-12:
            continue
        l1 = ((bb[1] - c[1]) * (gx - c[0]) + (c[0] - bb[0]) * (gy - c[1])) / den
        l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / den
        l3 = 1 - l1 - l2
        inside = (l1 >= -0.03) & (l2 >= -0.03) & (l3 >= -0.03)
        out[y0:y1 + 1, x0:x1 + 1] |= inside & (l1 * b[0] + l2 * b[1] + l3 * b[2] >= 0.5)
    return out


def _paint(mesh, bare, flat, state):
    """Trên lưới cuối: texel tay lộ ra → màu da; texel mũ trùm / dây rút cũ → màu áo cam đều (xoá bóng nướng sẵn của
    mũ trên lưng). Giữ chút nếp sáng tối (0,9 … 1,06). Lưu <id>_basecolor_tee.jpg, gắn vào chất liệu."""
    me = mesh.data
    node = next(n_ for n_ in me.materials[0].node_tree.nodes if n_.type == "TEX_IMAGE")
    px = _pixels(node.image)
    h, w = px.shape[:2]
    lum = px[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    # chỉ tô lên texel vùng áo của mặt nạ (outfit_textures.py), phóng theo cỡ ảnh
    mk = bpy.data.images.load(os.path.join(state["char_dir"], "textures", f"{state['cid']}_mask.png"))
    mpx = _pixels(mk)[..., :3]
    bpy.data.images.remove(mk)
    iy = (np.arange(h) * mpx.shape[0] // h)[:, None]
    ix = (np.arange(w) * mpx.shape[1] // w)[None, :]
    on_shirt = np.abs(mpx[iy, ix] - np.array(MASK_SHIRT)).max(-1) < 0.35
    res = {}
    for key, val, rgb in (("flat", flat, state["shirt_rgb"]), ("bare", bare, state["skin_rgb"])):
        m = _raster(me, val, w, h) & on_shirt
        if m.any():
            k = np.clip(lum / max(float(np.median(lum[m])), 1e-3), 0.9, 1.06)
            px[m, :3] = np.clip(rgb[None] * k[m][:, None], 0, 1)
        res[key] = int(m.sum())
    out = os.path.join(state["char_dir"], "textures", f"{state['cid']}_basecolor_tee.jpg")
    new = bpy.data.images.new(f"{state['cid']}_basecolor_tee", w, h)
    new.pixels.foreach_set(px.astype(np.float32).ravel())
    new.filepath_raw = out
    new.file_format = "JPEG"
    new.save()
    bpy.data.images.remove(new)
    node.image = bpy.data.images.load(out)
    node.image.name = f"{state['cid']}_basecolor"
    print(f"[áo phông] tô da {res['bare']} texel (màu {np.round(state['skin_rgb'], 3).tolist()}), tô lại áo {res['flat']} "
          f"texel (mũ, dây rút; màu {np.round(state['shirt_rgb'], 3).tolist()}) → {out}")
    return res


def apply(mesh, state):
    """Lưới cuối (đã giảm): độ dời nội suy từ lưới gốc → shape key Basis + ao_cam."""
    co0, disp0, tris0 = state["co"], state["disp"], state["tris"]
    bvh = BVHTree.FromPolygons([Vector(v) for v in co0], [tuple(t) for t in tris0])
    me = mesh.data
    n = len(me.vertices)
    co = _arr(me.vertices, n, 3)
    cw = (np.array(mesh.matrix_world) @ np.c_[co, np.ones(n)].T).T[:, :3]
    out = np.zeros_like(cw)
    bare = np.zeros(n)
    flat = np.zeros(n)
    far = 0.0
    for i, p in enumerate(cw):
        loc, _nrm, fi, dist = bvh.find_nearest(Vector(p))
        far = max(far, dist)
        a, b, c = (co0[j] for j in tris0[fi])
        v0, v1, v2 = b - a, c - a, np.array(loc) - a
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        l2 = (d11 * d20 - d01 * d21) / den if den else 0.0
        l3 = (d00 * d21 - d01 * d20) / den if den else 0.0
        l1 = 1 - l2 - l3
        ia, ib, ic = tris0[fi]
        out[i] = l1 * disp0[ia] + l2 * disp0[ib] + l3 * disp0[ic]
        for dst, src in ((bare, state["bare"]), (flat, state["flat"])):
            dst[i] = l1 * src[ia] + l2 * src[ib] + l3 * src[ic]
    inv = np.linalg.inv(np.array(mesh.matrix_world)[:3, :3])
    local = out @ inv.T
    if not me.shape_keys:
        mesh.shape_key_add(name="Basis", from_mix=False)
    key = mesh.shape_key_add(name="ao_cam", from_mix=False)
    flat = (co + local).ravel()
    key.data.foreach_set("co", flat)
    key.value = 0.0
    moved = int((np.linalg.norm(out, axis=1) > 1e-4).sum())
    print(f"[áo phông] shape key 'ao_cam': {moved}/{n} đỉnh dời, xa lưới gốc tối đa {far * 1000:.1f} mm")
    paint = _paint(mesh, bare, flat, state)
    return {"moved": moved, "max_map_mm": round(far * 1000, 2), "texels": paint}
