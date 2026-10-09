"""Mũ lưỡi trai cam (phụ kiện, tủ đồ): dựng lại lưới thấp bám bề mặt mô hình Meshy + texture 512 vẽ bằng code.

Chạy (không giao diện):
  tools/bin/blender.cmd --background --factory-startup --python scripts/blender/accessories/build_cap.py [-- --no-render]

Vào:  assets/accessories/cap/source/cap_meshy.glb   (Meshy gốc, ~307k tam giác — chỉ có trên máy làm việc)
      assets/accessories/cap/source/logo_fpt_goc.png (logo FPT đã xoá nền — chỉ có trên máy làm việc)
Ra:   assets/accessories/cap/cap.glb     (lưới ~700 tam giác, 1 chất liệu, texture WebP 512 nhúng, meshopt)
      assets/accessories/cap/cap.json    (số đo cho bước gắn lên đầu nhân vật)
      assets/accessories/cap/cap.raw.glb (Blender xuất, chưa tối ưu — không commit)
      renders/accessories/cap_<góc>.png, cap_so_sanh.png (Meshy | bản thấp)

Vì sao dựng lại thay vì Decimate: 307k → <1k tam giác bằng Decimate làm vành mỏng 5 mm dính hai mặt / thủng, vòm méo.
Ở đây mỗi đỉnh lấy từ tia chiếu lên bề mặt Meshy:
  - vòm: SEG tia quanh trục vòm (khung nghiêng theo mép đội đầu), mỗi tia từ mép lên nút đỉnh qua các vòng RING_T;
    trúng lớp lót (mặt trong) rồi lớp vải (mặt ngoài) → vỏ 2 lớp, nối nhau bằng dải mép đội đầu; chỗ hở sau gáy (trên
    quai) không trúng gì → nội suy, thành vòm kín;
  - vành: BRIM_N hướng ngang quanh phía trước (phạm vi tự dò), mỗi hướng đi từ chân vành ra mép vành (dò bằng tia từ
    trên xuống), mặt trên + mặt dưới (tia từ dưới lên) → vành có độ dày thật, kín mép ngoài, chân vành và 2 đầu;
  - nút đỉnh: trụ 8 cạnh; miếng logo: lưới cong ôm mặt trước vòm, nổi 1,5 mm (như miếng thêu).
Toạ độ ra (Blender): gốc = tâm vòng đội đầu (trung bình các điểm mép lớp lót), vành hướng −Y (glTF +Z = phía trước nhân
vật), trên = +Z; giữ độ nghiêng tự nhiên của mũ (mép sau thấp hơn mép trước OPENING_TILT°).
"""
import json
import math
import os
import subprocess
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "characters"))
import texture_fix as TF  # noqa: E402
from char_render import preview_setup, preview_teardown, shoot  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = "--no-render" not in ARGS
CAP_DIR = os.path.join(ROOT, "assets", "accessories", "cap")
SRC = os.path.join(CAP_DIR, "source", "cap_meshy.glb")
LOGO = os.path.join(CAP_DIR, "source", "logo_fpt_goc.png")
RAW = os.path.join(CAP_DIR, "cap.raw.glb")
GLB = os.path.join(CAP_DIR, "cap.glb")
INFO = os.path.join(CAP_DIR, "cap.json")
RENDER_DIR = os.path.join(ROOT, "renders", "accessories")

WIDTH = 0.19                  # m — bề ngang ngoài của vòm (mũ người lớn ~58 cm vòng đầu); bước gắn mũ chỉnh theo đầu
SEG = 24                      # số tia quanh vòm
RING_T = (0.0, 0.10, 0.24, 0.42, 0.62, 0.82)    # vị trí các vòng từ mép (0) tới nút đỉnh (1)
BRIM_N = 13                   # số hướng trên vành
BRIM_ROWS = (0.0, 0.33, 0.67, 1.0)
MIN_SHELL = 0.002             # m — vỏ vòm / vành mỏng nhất
BRIM_SNAP = 0.004             # m — hướng có vành dài hơn: mép vòm phía đó hạ xuống mặt dưới chân vành
BUTTON_R, BUTTON_H = 0.0075, 0.005
PATCH_W, PATCH_H = 0.060, 0.042   # m — miếng thêu (logo rộng LOGO_W ở giữa)
LOGO_W = 0.050
PATCH_UP = 0.055              # m — tâm miếng thêu cao hơn chân vành (đo dọc mặt trước vòm)
PATCH_OFF = 0.0015            # m — nổi khỏi mặt vòm
PATCH_GRID = (8, 5)
ORANGE = "F26F21"
LINING = "EFE8DC"
PATCH_WHITE = "FBFBF8"
TEX = 512
SS = 2                        # vẽ texture ×2 rồi thu về (khử răng cưa)

# vùng UV (u0, v0, u1, v1), v hướng lên (hàng 0 của ảnh Blender = đáy)
UV = {"crown": (0.0, 0.56, 1.0, 1.0), "brim_top": (0.0, 0.29, 0.62, 0.53), "patch": (0.64, 0.29, 1.0, 0.535),
      "brim_bot": (0.0, 0.02, 0.62, 0.26), "lining": (0.645, 0.02, 0.82, 0.26), "rim": (0.84, 0.15, 0.98, 0.26),
      "orange_misc": (0.84, 0.02, 0.98, 0.12)}


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# ---------- Meshy ----------
def load_source():
    if not os.path.exists(SRC):
        raise SystemExit(f"thiếu {SRC} — chép mô hình Meshy gốc vào đây (không commit)")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.import_scene.gltf(filepath=SRC)
    o = [x for x in bpy.context.scene.objects if x.type == "MESH"][0]
    for x in list(bpy.context.scene.objects):
        if x is not o:
            bpy.data.objects.remove(x)
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
    tris0 = sum(len(p.vertices) - 2 for p in o.data.polygons)
    co = np.array([v.co[:] for v in o.data.vertices])
    s = WIDTH / np.ptp(co[:, 0])
    o.data.transform(Matrix.Scale(s, 4))
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bvh = BVHTree.FromBMesh(bm)
    co = np.array([v.co[:] for v in bm.verts])
    bm.free()
    return o, bvh, co, s, tris0


def hits(bvh, org, d, maxd):
    """Mọi điểm trúng dọc tia (vị trí, pháp tuyến, khoảng cách), theo thứ tự."""
    out, o, dd = [], Vector(org), Vector(d).normalized()
    walked = 0.0
    for _ in range(16):
        loc, nrm, _, dist = bvh.ray_cast(o, dd, maxd - walked)
        if loc is None:
            break
        walked += dist
        out.append((np.array(loc), np.array(nrm), walked))
        o = loc + dd * 1e-5
        walked += 1e-5
    return out


# ---------- khung vòm ----------
def crown_frame(bvh, co):
    """Tâm + trục vòm: mép trước (chân vành, giữa) và mép sau (đáy quai) → mặt phẳng nghiêng của vòng đội đầu."""
    zmid = (co[:, 2].min() + co[:, 2].max()) / 2
    mid = co[np.abs(co[:, 2] - zmid) < 0.004]
    y_front, y_back = mid[:, 1].min(), co[:, 1].max()
    cy = (y_front + y_back) / 2
    z_back = co[co[:, 1] > y_back - 0.02, 2].min()
    h = hits(bvh, (0, y_front - 0.003, co[:, 2].max() + 0.05), (0, 0, -1), 1.0)
    z_front = h[0][0][2] if h else zmid
    tilt = math.atan2(z_front - z_back, y_back - y_front)          # > 0: mép trước cao hơn mép sau
    up = np.array([0.0, math.sin(tilt), math.cos(tilt)])          # pháp tuyến mặt phẳng mép (nghiêng về sau)
    fwd = np.array([0.0, -math.cos(tilt), math.sin(tilt)])
    side = np.array([1.0, 0.0, 0.0])
    zc = (z_front + z_back) / 2
    c0 = np.array([0.0, cy, zc]) + up * 0.01
    apex = co[co[:, 2].argmax()]
    return {"c0": c0, "up": up, "fwd": fwd, "side": side, "tilt_deg": math.degrees(tilt), "apex": apex,
            "y_front": y_front, "y_back": y_back, "z_front": z_front, "z_back": z_back}


def wall_dir(F, phi, theta):
    h = math.cos(theta) * (math.cos(phi) * F["fwd"] + math.sin(phi) * F["side"])
    return h + math.sin(theta) * F["up"]


def shell_hit(bvh, F, d, R0, wall_only=False):
    """(trong, ngoài) trên vỏ vòm theo tia từ tâm, hoặc None. wall_only: bỏ mặt gần nằm ngang (mặt vành)."""
    H = [x for x in hits(bvh, F["c0"], d, 1.6 * R0) if x[2] > 0.35 * R0]
    if not H:
        return None
    if wall_only and abs(H[0][1] @ F["up"]) > 0.8:
        return None
    inner = H[0]
    outer = max((x for x in H if x[2] - inner[2] < 0.02), key=lambda x: x[2])
    return inner[0], outer[0], inner[2], outer[2]


def brim_tools(bvh, F, co):
    """Dò vành nhìn từ trên: dọc một hướng ngang từ tâm vòm, chỗ tia từ trên xuống bắt đầu trúng mặt vành (thấp, quay
    lên) = chân vành thấy được (ngay ngoài vách trước của vòm), chỗ hết trúng = mép vành. Mặt dưới: tia từ dưới lên."""
    ztop, zbot = co[:, 2].max() + 0.05, co[:, 2].min() - 0.05
    zr = F["z_front"]
    ctr = np.array([0.0, (F["y_front"] + F["y_back"]) / 2])

    def down(xy):
        H = hits(bvh, (xy[0], xy[1], ztop), (0, 0, -1), ztop - zbot)
        return H[0] if H else None

    def up_hit(xy):
        H = hits(bvh, (xy[0], xy[1], zbot), (0, 0, 1), ztop - zbot)
        return H[0] if H else None

    def is_brim(h):
        return h is not None and h[0][2] < zr + 0.012

    def span(heading, step=0.002, gap=0.012):
        """(chân, mép) dọc hướng ngang; bỏ qua khe ≤ gap (rãnh mũi chỉ trên mặt vành làm tia lọt / trúng mặt dốc)."""
        ds = np.arange(0.0, 0.3, step)
        on = [d for d in ds if is_brim(down(ctr + heading * d))]
        if not on:
            return None
        root, edge = on[0], on[0]
        for d in on[1:]:
            if d - edge > gap:
                break
            edge = d
        lo, hi = max(root - step, 0.0), root
        for _ in range(6):
            m = (lo + hi) / 2
            lo, hi = (lo, m) if is_brim(down(ctr + heading * m)) else (m, hi)
        root = hi
        lo, hi = edge, edge + step
        for _ in range(6):
            m = (lo + hi) / 2
            lo, hi = (m, hi) if is_brim(down(ctr + heading * m)) else (lo, m)
        return root, lo

    return ctr, down, up_hit, span


def heading_of(phi):
    """Hướng ngang: φ = 0 → phía trước (−Y), φ > 0 → +X."""
    return np.array([math.sin(phi), -math.cos(phi)])


def sample_brim(bvh, F, tools):
    ctr, down, up_hit, span = tools
    # phạm vi vành quanh phía trước: các hướng có vành dài > 4 mm
    scan = [(deg, span(heading_of(math.radians(deg)))) for deg in np.arange(-87, 88, 3)]
    ok = [deg for deg, sp in scan if sp and sp[1] - sp[0] > 0.004]
    half = min(-min(ok), max(ok)) - 1.0       # đối xứng trái / phải
    lo, hi = -half, half
    rows = []
    for phi in np.radians(np.linspace(lo, hi, BRIM_N)):
        h = heading_of(phi)
        sp = span(h)
        root, edge = sp
        pts = []
        for t in BRIM_ROWS:
            d = root + 0.0008 + (edge - root - 0.0016) * t
            xy = ctr + h * d
            top = down(xy)[0][2]
            bh = up_hit(xy)
            bot = bh[0][2] if bh is not None and 0 < top - bh[0][2] < 0.012 else top - 0.004
            pts.append((np.array([xy[0], xy[1], top]), np.array([xy[0], xy[1], top - max(top - bot, MIN_SHELL)])))
        rows.append({"phi": float(phi), "edge_m": float(edge - root), "pts": pts})
    return rows, (lo, hi)


def sample_crown(bvh, F, tools):
    ctr, down, up_hit, span = tools
    R0 = WIDTH / 2
    phis = [math.pi + 2 * math.pi * k / SEG for k in range(SEG)]   # k = 0: sau gáy; k = SEG/2: chính giữa phía trước
    top_dir = (F["apex"] - F["c0"]) / np.linalg.norm(F["apex"] - F["c0"])
    rim_theta, din, dout, dirs = [], np.full((SEG, len(RING_T)), np.nan), np.full((SEG, len(RING_T)), np.nan), {}
    snap = {}
    for i, phi in enumerate(phis):
        # phía có vành: mép vòm không thấp hơn chân vành (tia thấp hơn trúng dải chân vành nằm sau vách trước của vòm)
        lo_deg = -45.0
        w = wall_dir(F, phi, 0.0)
        hz = np.array([w[0], w[1]])
        sp = span(hz / np.linalg.norm(hz)) if hz[1] < -0.05 else None     # chỉ nửa phía trước (sau gáy: quai, không có vành)
        if sp and sp[1] - sp[0] < BRIM_SNAP:      # vành ngắn (gần 2 đầu): mép vòm tự nhiên, đầu vành gối lên vách vòm
            sp = None
        if sp:
            xy = ctr + hz / np.linalg.norm(hz) * sp[0]
            R = np.array([xy[0], xy[1], down(xy)[0][2] + 0.002])
            v = R - F["c0"]
            lo_deg = math.degrees(math.asin(np.clip((v @ F["up"]) / np.linalg.norm(v), -1, 1)))
        th = None
        for deg in np.arange(lo_deg, 30, 0.5):
            if shell_hit(bvh, F, wall_dir(F, phi, math.radians(deg)), R0, wall_only=True):
                th = math.radians(deg)
                break
        if th is None:
            raise RuntimeError(f"không thấy mép vòm ở φ = {math.degrees(phi):.0f}°")
        rim_theta.append(th)
        if sp:      # mặt dưới chân vành: vách vòm đi xuyên trong thân vành, mọc lên gọn từ mặt trên vành
            bh = up_hit(xy)
            zb = bh[0][2] if bh is not None and 0 < R[2] - bh[0][2] < 0.014 else R[2] - 0.006
            snap[i] = np.array([R[0], R[1], zb - 0.001])
        else:
            snap[i] = None
        w0 = wall_dir(F, phi, th)
        for j, t in enumerate(RING_T):
            w = math.sin(t * math.pi / 2)
            d = (1 - w) * w0 + w * top_dir
            d /= np.linalg.norm(d)
            dirs[i, j] = d
            r = shell_hit(bvh, F, d, R0)
            if r:
                din[i, j], dout[i, j] = r[2], r[3]
    # tia không trúng (chỗ hở sau gáy) → nội suy theo vòng
    miss = int(np.isnan(dout).sum())
    for arr in (din, dout):
        for i in range(SEG):
            row = arr[i]
            ok = ~np.isnan(row)
            if not ok.all():
                arr[i] = np.interp(np.arange(len(row)), np.where(ok)[0], row[ok])
    din = np.minimum(din, dout - MIN_SHELL)
    inner = np.array([[F["c0"] + dirs[i, j] * din[i, j] for j in range(len(RING_T))] for i in range(SEG)])
    outer = np.array([[F["c0"] + dirs[i, j] * dout[i, j] for j in range(len(RING_T))] for i in range(SEG)])
    # phía có vành: vòng dưới cùng của vòm kéo tới mặt dưới chân vành (không hở khe, vách vòm không xuyên mặt trên vành)
    for i, R in snap.items():
        if R is not None:
            shift = R - outer[i, 0]
            outer[i, 0] = R
            inner[i, 0] = inner[i, 0] + shift
    rt = [x for x in hits(bvh, F["c0"], top_dir, 2 * R0) if x[2] > 0.3 * R0]
    top_in, top_out = rt[0][0], max((x for x in rt if x[2] - rt[0][2] < 0.02), key=lambda x: x[2])[0]
    if np.linalg.norm(top_out - top_in) < MIN_SHELL:
        top_in = top_out - top_dir * MIN_SHELL
    return {"phis": phis, "inner": inner, "outer": outer, "top_in": top_in, "top_out": top_out, "top_dir": top_dir,
            "miss": miss, "rim_theta_deg": [round(math.degrees(t), 1) for t in rim_theta]}


# ---------- lưới ----------
class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")

    def face(self, verts, uvs):
        vs = [self.bm.verts.new(tuple(map(float, p))) for p in verts]
        f = self.bm.faces.new(vs)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv].uv = uv
        return f

    def quad(self, a, b, c, d, ua, ub, uc, ud):
        self.face((a, b, c, d), (ua, ub, uc, ud))

    def tri(self, a, b, c, ua, ub, uc):
        self.face((a, b, c), (ua, ub, uc))


def region(name, u, v):
    u0, v0, u1, v1 = UV[name]
    return (u0 + (u1 - u0) * u, v0 + (v1 - v0) * v)


def build_mesh(C, B, F):
    bld = Builder()
    n, R = SEG, len(RING_T)
    # vòm ngoài: u theo vòng quanh (k = 0 sau gáy → giữa phía trước u = 0,5), v theo vòng lên đỉnh
    def cuv(i, j):
        return region("crown", i / n, j / R)
    for i in range(n):
        i2 = (i + 1) % n
        for j in range(R - 1):
            o = C["outer"]
            bld.quad(o[i, j], o[i2, j], o[i2, j + 1], o[i, j + 1], cuv(i, j), cuv(i + 1, j), cuv(i + 1, j + 1), cuv(i, j + 1))
        bld.tri(C["outer"][i, R - 1], C["outer"][i2, R - 1], C["top_out"], cuv(i, R - 1), cuv(i + 1, R - 1), cuv(i + 0.5, R))
    # vòm trong (lót): ngược chiều (pháp tuyến hướng vào trong)
    def luv(i, j):
        return region("lining", i / n, j / R)
    for i in range(n):
        i2 = (i + 1) % n
        for j in range(R - 1):
            q = C["inner"]
            bld.quad(q[i, j], q[i, j + 1], q[i2, j + 1], q[i2, j], luv(i, j), luv(i, j + 1), luv(i + 1, j + 1), luv(i + 1, j))
        bld.tri(C["inner"][i, R - 1], C["top_in"], C["inner"][i2, R - 1], luv(i, R - 1), luv(i + 0.5, R), luv(i + 1, R - 1))
    # mép đội đầu: nối lớp ngoài với lớp lót
    def ruv(i, k):
        return region("rim", i / n, k)
    for i in range(n):
        i2 = (i + 1) % n
        bld.quad(C["outer"][i, 0], C["inner"][i, 0], C["inner"][i2, 0], C["outer"][i2, 0], ruv(i, 1), ruv(i, 0), ruv(i + 1, 0), ruv(i + 1, 1))
    # vành: mặt trên (u ngang, v từ chân ra mép), mặt dưới, mép ngoài, chân vành, 2 đầu
    m, rr = len(B), len(BRIM_ROWS)
    def tuv(a, k):
        return region("brim_top", a / (m - 1), k / (rr - 1))
    def buv(a, k):
        return region("brim_bot", a / (m - 1), k / (rr - 1))
    def ouv(a, k):
        return region("orange_misc", a, k)
    for a in range(m - 1):
        for k in range(rr - 1):
            t00, t10 = B[a]["pts"][k][0], B[a + 1]["pts"][k][0]
            t01, t11 = B[a]["pts"][k + 1][0], B[a + 1]["pts"][k + 1][0]
            bld.quad(t00, t01, t11, t10, tuv(a, k), tuv(a, k + 1), tuv(a + 1, k + 1), tuv(a + 1, k))
            b00, b10 = B[a]["pts"][k][1], B[a + 1]["pts"][k][1]
            b01, b11 = B[a]["pts"][k + 1][1], B[a + 1]["pts"][k + 1][1]
            bld.quad(b00, b10, b11, b01, buv(a, k), buv(a + 1, k), buv(a + 1, k + 1), buv(a, k + 1))
        e = rr - 1        # mép ngoài
        bld.quad(B[a]["pts"][e][0], B[a]["pts"][e][1], B[a + 1]["pts"][e][1], B[a + 1]["pts"][e][0],
                 ouv(a / (m - 1), 1), ouv(a / (m - 1), 0), ouv((a + 1) / (m - 1), 0), ouv((a + 1) / (m - 1), 1))
        bld.quad(B[a]["pts"][0][0], B[a + 1]["pts"][0][0], B[a + 1]["pts"][0][1], B[a]["pts"][0][1],   # chân vành
                 ouv(a / (m - 1), 1), ouv((a + 1) / (m - 1), 1), ouv((a + 1) / (m - 1), 0), ouv(a / (m - 1), 0))
    for a, first in ((0, True), (m - 1, False)):    # 2 đầu vành (mặt quay ra ngoài vành)
        for k in range(rr - 1):
            p = B[a]["pts"]
            vs = (p[k][0], p[k][1], p[k + 1][1], p[k + 1][0]) if first else (p[k][0], p[k + 1][0], p[k + 1][1], p[k][1])
            bld.face(vs, [ouv(0.1, 0.1)] * 4)
    # nút đỉnh: trụ 8 cạnh dọc pháp tuyến ở đỉnh
    up = C["top_dir"]
    ax1 = np.cross(up, [1.0, 0, 0]); ax1 /= np.linalg.norm(ax1)
    ax2 = np.cross(up, ax1)
    base = C["top_out"] - up * 0.001
    ring_b = [base + BUTTON_R * (math.cos(2 * math.pi * k / 8) * ax1 + math.sin(2 * math.pi * k / 8) * ax2) for k in range(8)]
    ring_t = [p + up * BUTTON_H for p in ring_b]
    cap_t = base + up * (BUTTON_H + 0.0015)
    for k in range(8):
        k2 = (k + 1) % 8
        bld.quad(ring_b[k], ring_b[k2], ring_t[k2], ring_t[k], ouv(0.2, 0.2), ouv(0.3, 0.2), ouv(0.3, 0.3), ouv(0.2, 0.3))
        bld.tri(ring_t[k], ring_t[k2], cap_t, ouv(0.2, 0.3), ouv(0.3, 0.3), ouv(0.25, 0.4))
    return bld


def add_patch(bld, F, C):
    """Miếng thêu logo: lưới PATCH_GRID ôm mặt ngoài vòm (lưới thấp vừa dựng), tâm ở giữa phía trước, cao PATCH_UP
    trên chân vành (đo dọc mặt vòm), nổi PATCH_OFF."""
    bm = bld.bm
    bm.verts.ensure_lookup_table()
    tmp = bm.copy()
    tmp.normal_update()                     # pháp tuyến mặt (bản sao chưa có) — tia chiếu cần để đặt miếng thêu
    bvh = BVHTree.FromBMesh(tmp)
    # đường giữa phía trước (k = SEG/2): đi dọc các vòng tới khi đủ PATCH_UP
    col = C["outer"][SEG // 2]
    acc, center = 0.0, col[0]
    for j in range(1, len(col)):
        seg = np.linalg.norm(col[j] - col[j - 1])
        if acc + seg >= PATCH_UP:
            center = col[j - 1] + (col[j] - col[j - 1]) * ((PATCH_UP - acc) / seg)
            break
        acc += seg
    # pháp tuyến mặt vòm tại tâm: tia từ ngoài vào theo hướng tâm vòm
    d_in = (F["c0"] - center) / np.linalg.norm(F["c0"] - center)
    # pháp tuyến: trung bình 2 mặt hai bên đường giữa (vòm nhiều cạnh — một mặt lệch thì miếng thêu bị xoay)
    ns = []
    for dx in (-0.01, 0.01):
        p0 = center + np.array([dx, 0.0, 0.0])
        loc, nrm, _, _ = bvh.ray_cast(Vector(p0 - d_in * 0.05), Vector(d_in), 0.2)
        if loc is not None:
            nn = np.array(nrm)
            ns.append(nn if nn @ (center - F["c0"]) > 0 else -nn)
    N = np.mean(ns, 0) if ns else -d_in
    N[0] = 0.0                              # mũ đối xứng trái / phải
    N /= np.linalg.norm(N)
    U = np.array([1.0, 0.0, 0.0])
    U = U - N * (U @ N); U /= np.linalg.norm(U)
    V = np.cross(N, U)
    if V[2] < 0:
        V = -V
    nx, ny = PATCH_GRID
    grid = np.zeros((nx + 1, ny + 1, 3))
    for i in range(nx + 1):
        for j in range(ny + 1):
            p = center + U * PATCH_W * (i / nx - 0.5) + V * PATCH_H * (j / ny - 0.5)
            loc, nrm, _, _ = bvh.ray_cast(Vector(p + N * 0.03), Vector(-N), 0.08)
            if loc is None:
                grid[i, j] = p + N * PATCH_OFF
            else:
                nn = np.array(nrm)
                nn = nn if nn @ N > 0 else -nn
                grid[i, j] = np.array(loc) + nn * PATCH_OFF
    tmp.free()
    print(f"[thêu] tâm {np.round(center, 4).tolist()}, N {np.round(N, 3).tolist()}, lưới x {np.ptp(grid[..., 0]):.4f} z {np.ptp(grid[..., 2]):.4f}, mặt trước {len(bm.faces)}")
    for i in range(nx):
        for j in range(ny):
            bld.quad(grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1],
                     region("patch", i / nx, j / ny), region("patch", (i + 1) / nx, j / ny),
                     region("patch", (i + 1) / nx, (j + 1) / ny), region("patch", i / nx, (j + 1) / ny))
    print(f"[thêu] mặt sau {len(bm.faces)}")
    return center, N


# ---------- texture ----------
def paint_texture(logo_px):
    S = TEX * SS
    O, L, W = hexrgb(ORANGE), hexrgb(LINING), hexrgb(PATCH_WHITE)
    img = np.ones((S, S, 3)) * O
    yy, xx = np.mgrid[0:S, 0:S]
    U, Vv = (xx + 0.5) / S, (yy + 0.5) / S

    def box(name, pad=0.0):
        u0, v0, u1, v1 = UV[name]
        return (U >= u0 - pad) & (U <= u1 + pad) & (Vv >= v0 - pad) & (Vv <= v1 + pad)

    img[box("lining", 0.008)] = L
    img[box("rim", 0.008)] = L
    # vòm: đường may 6 mảnh (giữa trước, ±60°, ±120°, sau) — sợi chỉ sẫm + 2 hàng mũi chỉ nhạt hai bên
    u0, v0, u1, v1 = UV["crown"]
    cr = box("crown")
    px_per_u = S * (u1 - u0)
    for k in range(6):
        us = u0 + (u1 - u0) * ((0.5 + k / 6) % 1.0)
        dist = np.abs(U - us) * px_per_u
        dist = np.minimum(dist, np.abs(U - us - (u1 - u0)) * px_per_u)
        line = cr & (dist < 1.2 * SS)
        img[line] = O * 0.80
        for off in (-3.0 * SS, 3.0 * SS):
            stitch = cr & (np.abs(dist - abs(off)) < 0.6 * SS) & (((yy // (3 * SS)) % 2) == 0)
            img[stitch] = O * 0.88
    # vành trên: các hàng mũi chỉ song song mép vành
    u0, v0, u1, v1 = UV["brim_top"]
    bt = box("brim_top")
    for t in (0.40, 0.52, 0.64, 0.76, 0.88):
        vs = v0 + (v1 - v0) * t
        row = bt & (np.abs(Vv - vs) * S < 0.7 * SS) & (((xx // (4 * SS)) % 3) != 2)
        img[row] = O * 0.82
    # miếng thêu: nền trắng bo góc + viền chỉ + logo
    u0, v0, u1, v1 = UV["patch"]
    pw, ph = (u1 - u0) * S, (v1 - v0) * S                   # px
    pxm = pw / PATCH_W                                      # px / m
    lx, ly = (U - u0) * S, (Vv - v0) * S
    r = 0.008 * pxm
    inset = 0.4 * SS
    cx = np.clip(lx, r + inset, pw - r - inset)
    cy = np.clip(ly, r + inset, ph - r - inset)
    dcorner = np.hypot(lx - cx, ly - cy)
    inside = box("patch") & (dcorner <= r)
    edge_aa = np.clip(r - dcorner + 0.5, 0, 1)
    pm = box("patch")
    img[pm] = (O * (1 - edge_aa[pm, None]) + W * edge_aa[pm, None])
    border = inside & (np.abs(dcorner - (r - 0.0035 * pxm)) < 0.5 * SS) & ((((xx + yy) // (3 * SS)) % 2) == 0)
    img[border] = W * 0.80
    # logo (đã cắt lề, tô trắng lỗ chữ), rộng LOGO_W, giữa miếng thêu
    lh, lw = logo_px.shape[:2]
    tw = LOGO_W * pxm
    th = tw * lh / lw
    x0, y0 = u0 * S + (pw - tw) / 2, v0 * S + (ph - th) / 2
    sel = (xx >= x0) & (xx < x0 + tw) & (yy >= y0) & (yy < y0 + th)
    su = (xx[sel] - x0) / tw * (lw - 1)
    sv = (yy[sel] - y0) / th * (lh - 1)
    xi0, yi0 = np.floor(su).astype(int), np.floor(sv).astype(int)
    xi1, yi1 = np.minimum(xi0 + 1, lw - 1), np.minimum(yi0 + 1, lh - 1)
    fx, fy = (su - xi0)[:, None], (sv - yi0)[:, None]
    s = (logo_px[yi0, xi0] * (1 - fx) * (1 - fy) + logo_px[yi0, xi1] * fx * (1 - fy)
         + logo_px[yi1, xi0] * (1 - fx) * fy + logo_px[yi1, xi1] * fx * fy)
    a = s[:, 3:4]
    img[sel] = s[:, :3] * a + img[sel] * (1 - a)
    small = img.reshape(TEX, SS, TEX, SS, 3).mean(axis=(1, 3))
    return np.concatenate([small, np.ones((TEX, TEX, 1))], -1).astype(np.float32), {"logo_px": [round(tw / SS), round(th / SS)]}


def load_logo():
    if not os.path.exists(LOGO):
        raise SystemExit(f"thiếu {LOGO} — chép logo FPT (đã xoá nền) vào đây (không commit)")
    im = bpy.data.images.load(LOGO)
    w, h = im.size
    px = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    logo, holes = TF.prepare_logo(px.reshape(h, w, 4), (1.0, 1.0, 1.0))
    return logo, holes


# ---------- xuất ----------
def make_object(bld, tex_px):
    me = bpy.data.meshes.new("cap")
    # chiều mặt đã đặt đúng khi dựng (ngoài vòm, lót quay vào trong, vành, nút, miếng thêu quay ra) — không tính lại:
    # recalc_face_normals đoán sai với tấm hở (miếng thêu, nút đỉnh)
    bmesh.ops.remove_doubles(bld.bm, verts=bld.bm.verts, dist=1e-6)
    bld.bm.to_mesh(me)
    bld.bm.free()
    obj = bpy.data.objects.new("cap", me)
    bpy.context.scene.collection.objects.link(obj)
    img = bpy.data.images.new("cap_basecolor", TEX, TEX, alpha=False)
    img.pixels.foreach_set(tex_px.ravel())
    img.filepath_raw = os.path.join(RENDER_DIR, "cap_basecolor.png")
    img.file_format = "PNG"
    os.makedirs(RENDER_DIR, exist_ok=True)
    img.save()
    img.pack()
    mat = bpy.data.materials.new("M_cap")
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tn = nt.nodes.new("ShaderNodeTexImage")
    tn.image = img
    nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    me.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    except (AttributeError, RuntimeError):
        bpy.ops.object.shade_smooth()
    return obj


def export(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=RAW, export_format="GLB", use_selection=True, export_yup=True,
                              export_materials="EXPORT", export_image_format="AUTO", export_extras=False,
                              export_cameras=False, export_lights=False, export_animations=False)
    cmd = (f'gltf-transform optimize "{RAW}" "{GLB}" --compress meshopt --texture-compress webp --texture-size {TEX} '
           f'--simplify false --join false --flatten false --instance false --palette false')
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        print(r.stdout[-1500:], r.stderr[-1500:])
        raise RuntimeError("gltf-transform optimize lỗi")
    v = subprocess.run(f'gltf-transform validate "{GLB}"', shell=True, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return "No errors found" in v.stdout + v.stderr


def renders(cap, src_obj):
    out = {}
    cam = preview_setup()
    co = np.array([v.co[:] for v in cap.data.vertices])
    c = (co.min(0) + co.max(0)) / 2
    views = {"front": (0, -1, 0.15), "q34": (0.7, -0.7, 0.35), "under": (0.25, -0.35, -1), "side": (1, 0, 0.1),
             "logo": (0, -1, 0.35)}
    for k, d in views.items():
        sc = 0.13 if k == "logo" else 0.36
        tgt = tuple(c) if k != "logo" else tuple(c + np.array([0, -0.06, 0.02]))
        for tag, show_cap in (("thap", True), ("meshy", False)):
            if k == "logo" and tag == "meshy":
                continue
            cap.hide_render, src_obj.hide_render = not show_cap, show_cap
            p = os.path.join(RENDER_DIR, f"cap_{tag}_{k}.png")
            shoot(cam, p, tgt, d, sc, res=(640, 640))
            out[(tag, k)] = p
    preview_teardown()
    return out


def compose(paths):
    rows = []
    for tag in ("meshy", "thap"):
        ims = []
        for k in ("front", "q34", "side", "under"):
            im = bpy.data.images.load(paths[(tag, k)])
            px = np.empty(im.size[0] * im.size[1] * 4, np.float32)
            im.pixels.foreach_get(px)
            ims.append(px.reshape(im.size[1], im.size[0], 4)[..., :3])
            bpy.data.images.remove(im)
        gap = np.full((ims[0].shape[0], 8, 3), 0.13, np.float32)
        r = ims[0]
        for x in ims[1:]:
            r = np.concatenate([r, gap, x], 1)
        rows.append(r)
    grid = np.concatenate([rows[1], np.full((8, rows[0].shape[1], 3), 0.13, np.float32), rows[0]], 0)  # hàng trên = Meshy
    img = bpy.data.images.new("so_sanh", grid.shape[1], grid.shape[0])
    img.pixels.foreach_set(np.concatenate([grid, np.ones(grid.shape[:2] + (1,), np.float32)], -1).ravel())
    p = os.path.join(RENDER_DIR, "cap_so_sanh.png")
    img.filepath_raw = p
    img.file_format = "PNG"
    img.save()
    return p


def main():
    src, bvh, co, scale, tris0 = load_source()
    F = crown_frame(bvh, co)
    tools = brim_tools(bvh, F, co)
    B, brim_range = sample_brim(bvh, F, tools)
    C = sample_crown(bvh, F, tools)
    print(f"[vòm] nghiêng mép {F['tilt_deg']:.1f}°, {SEG} tia × {len(RING_T)} vòng, {C['miss']} tia trượt (nội suy); "
          f"mép theo φ: {C['rim_theta_deg']}")
    print(f"[vành] {BRIM_N} tia trong {brim_range[0]:.0f}°…{brim_range[1]:.0f}°, dài {[round(r['edge_m'] * 100, 1) for r in B]} cm; "
          f"dày {[round(float(np.linalg.norm(r['pts'][1][0] - r['pts'][1][1])) * 1000, 1) for r in B]} mm")
    bld = build_mesh(C, B, F)
    pc, pn = add_patch(bld, F, C)
    logo, holes = load_logo()
    tex, tinfo = paint_texture(logo)
    print(f"[texture] {TEX} px; logo {LOGO_W * 100:.0f} cm = {tinfo['logo_px']} px; tô trắng {holes} px lỗ chữ")
    # gốc = tâm vòng đội đầu (trung bình mép lớp lót)
    origin = C["inner"][:, 0].mean(0)
    cap = make_object(bld, tex)
    cap.data.transform(Matrix.Translation(Vector(-origin)))
    src.data.transform(Matrix.Translation(Vector(-origin)))
    src.hide_render = True
    tris = sum(len(p.vertices) - 2 for p in cap.data.polygons)
    rim = C["inner"][:, 0] - origin
    info = {
        "_ghi_chu": "Mũ lưỡi trai (scripts/blender/accessories/build_cap.py). Toạ độ glTF: gốc = tâm vòng đội đầu, +Y lên, "
                    "+Z = phía trước (vành mũ). opening_*: vòng đội đầu (mép lớp lót) — bước gắn lên đầu nhân vật dùng để "
                    "co giãn và đặt mũ; opening_tilt_deg: mép trước cao hơn mép sau (độ nghiêng tự nhiên của mũ).",
        "tris": tris, "source_tris": tris0,
        "opening_width_m": round(float(np.ptp(rim[:, 0])), 4), "opening_depth_m": round(float(np.ptp(rim[:, 1])), 4),
        "opening_tilt_deg": round(F["tilt_deg"], 1),
        "crown_height_m": round(float((C["top_out"] - origin)[2]), 4),
        "brim_length_m": round(max(r["edge_m"] for r in B), 4),
        "logo": {"width_m": LOGO_W, "patch_m": [PATCH_W, PATCH_H],
                 "center_m": [round(float(v), 4) for v in (pc - origin)[[0, 2, 1]] * [1, 1, -1]]},
        "texture_px": TEX, "colors": {"orange": "#" + ORANGE, "lining": "#" + LINING},
    }
    ok = export(cap)
    info["glb_kb"] = round(os.path.getsize(GLB) / 1024, 1)
    info["source_mb"] = round(os.path.getsize(SRC) / 1024 / 1024, 2)
    info["validate_ok"] = ok
    with open(INFO, "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[xuất] {GLB}: {info['glb_kb']} KB (Meshy gốc {info['source_mb']} MB), {tris} tam giác "
          f"(gốc {tris0}); validate {'0 lỗi' if ok else 'CÓ LỖI'}")
    if RENDER:
        p = renders(cap, src)
        print(f"[render] {compose(p)}")
    print("TOM_TAT", json.dumps(info, ensure_ascii=False))


main()
