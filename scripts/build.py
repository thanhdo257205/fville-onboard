"""Build trọn gói một hoặc nhiều zone, ở một hoặc cả hai mức đồ hoạ:
  Blender (dựng + AO [+ lightmap ở bản cao] + .blend + GLB thô + render) → ảnh so sánh → nén Draco → kiểm tra GLB.

Chạy:  python scripts/build.py zone_02 [zone_03 ...] [--tier low|high|both] [-- --no-render --no-ao --no-lightmap]
Mặc định chỉ dựng bản THẤP — bản cao đang tạm dừng (2026-10-08), muốn dựng thì thêm --tier high hoặc --tier both.
Kết quả: assets/glb/<low|high>/<zone>.glb  (+ <zone>_lightmap.png ở bản cao)
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLENDER = ROOT / "tools" / "bin" / "blender.cmd"
SCRIPTS = {
    "zone_00": ("zone_00.py", "zone_00_pickup"),
    "zone_01": ("zone_01.py", "zone_01_bus"),
    "zone_02": ("zone_02.py", "zone_02_campus"),
    "zone_03": ("zone_03.py", "zone_03_lobby"),
    "zone_04": ("zone_04.py", "zone_04_corridor"),
    "zone_05": ("zone_05.py", "zone_05_office"),
}


def sh(cmd, **kw):
    print(">", " ".join(str(c) for c in cmd), flush=True)
    return subprocess.run(cmd, shell=True, **kw)


def build(key, tier, extra):
    script, zone = SCRIPTS[key]
    r = sh([str(BLENDER), "--background", "--factory-startup", "--python",
            str(ROOT / "scripts" / "blender" / script), "--", "--quality", tier, *extra],
           capture_output=True, text=True, encoding="utf-8", errors="replace")
    log = ROOT / "renders" / (f"{zone}_build.log" if tier == "low" else f"high/{zone}_build.log")
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(r.stdout + r.stderr, encoding="utf-8")
    if "Traceback" in r.stdout + r.stderr:
        print((r.stdout + r.stderr)[-3000:])
        raise SystemExit(f"{zone} [{tier}]: lỗi khi dựng (xem {log.relative_to(ROOT)})")
    if "--no-render" not in extra:
        sh([sys.executable, str(ROOT / "scripts" / "tools" / "compare.py"), zone, tier])
    glb_dir = ROOT / "assets" / "glb" / tier
    raw, out = glb_dir / f"{zone}.raw.glb", glb_dir / f"{zone}.glb"
    sh(["gltf-transform", "draco", str(raw), str(out)], capture_output=True)
    sh([sys.executable, str(ROOT / "scripts" / "tools" / "check_glb.py"), str(out)])
    print(f"{zone} [{tier}]: {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    args = sys.argv[1:]
    extra = args[args.index("--") + 1:] if "--" in args else []
    args = args[:args.index("--")] if "--" in args else args
    tier = "low"  # bản cao tạm dừng
    if "--tier" in args:
        tier = args[args.index("--tier") + 1]
        args = [a for i, a in enumerate(args) if a != "--tier" and (i == 0 or args[i - 1] != "--tier")]
    tiers = ["low", "high"] if tier == "both" else [tier]
    for k in args:
        for t in tiers:
            build(k, t, extra)
