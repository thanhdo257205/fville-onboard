"""Kiểm tra GLB: tên node theo quy ước game, extras (label, yaw_deg), COL_ không có chất liệu.

Chạy: python scripts/tools/check_glb.py assets/glb/zone_02_campus.glb
"""
import json
import struct
import sys

PREFIXES = ("COL_", "INT_", "SPAWN_", "NPC_", "TRIGGER_", "CAM_", "PATH_")


def load(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, _, _ = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "không phải GLB"
    clen, ctype = struct.unpack_from("<II", data, 12)
    return json.loads(data[20:20 + clen])


def main(path):
    g = load(path)
    nodes = g.get("nodes", [])
    meshes = g.get("meshes", [])
    problems = []
    rows = []
    for n in nodes:
        name = n.get("name", "")
        if not name.startswith(PREFIXES):
            continue
        extras = n.get("extras", {})
        kind = name.split("_")[0] + "_"
        if kind in ("INT_", "NPC_") and "label" not in extras:
            problems.append(f"{name}: thiếu label")
        if kind == "COL_" and "mesh" in n:
            for p in meshes[n["mesh"]]["primitives"]:
                if "material" in p or "COLOR_0" in p["attributes"]:
                    problems.append(f"{name}: COL_ có chất liệu/màu")
        if kind == "TRIGGER_" and "scale" not in n:
            problems.append(f"{name}: TRIGGER_ thiếu scale")
        if kind == "CAM_" and not ("target" in extras and "fov_deg" in extras):
            problems.append(f"{name}: CAM_ thiếu target / fov_deg")
        if kind == "PATH_":
            pts = extras.get("points", [])
            if len(pts) < 6 or len(pts) % 3:
                problems.append(f"{name}: PATH_ thiếu points (cần ≥ 2 điểm x, y, z)")
        if kind == "PATH_":
            pts = extras.get("points", [])
            rows.append((name, f"{len(pts) // 3} điểm, {extras.get('length_m', 0):.1f} m", pts[:3] or [0, 0, 0], None))
            continue
        rows.append((name, extras.get("label", ""), n.get("translation", [0, 0, 0]), n.get("scale")))
    counts = {p: sum(1 for r in rows if r[0].startswith(p)) for p in PREFIXES}
    print("Số lượng:", counts)
    for name, label, t, s in sorted(rows):
        if not name.startswith("COL_"):
            pos = ", ".join(f"{v:.2f}" for v in t)
            print(f"  {name:32s} {label:14s} pos(glTF)=({pos})" + (f" scale={[round(v, 2) for v in s]}" if s else ""))
    print("Chất liệu:", [m.get("name") for m in g.get("materials", [])])
    print("Lỗi:", problems or "không có")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
