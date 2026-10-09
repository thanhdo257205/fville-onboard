"""Ghép mọi ảnh so sánh của 1 zone thành 1 ảnh dọc: renders/gallery_<zone_ngắn>.png

Chạy: python scripts/tools/gallery.py zone_01 zone_02 ...
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
W = 1800


def main(short, tier="low"):
    rdir = ROOT / "renders" if tier == "low" else ROOT / "renders" / "high"
    files = sorted(rdir.glob(f"compare_{short}_*.png"))
    over = list(rdir.glob(f"{short}_*_overview.png"))
    ims = []
    for f in files + over:
        im = Image.open(f).convert("RGB")
        ims.append(im.resize((W, round(im.height * W / im.width)), Image.LANCZOS))
    if not ims:
        return
    out = Image.new("RGB", (W, sum(i.height for i in ims) + 8 * len(ims)), "#1d1d1f")
    y = 0
    for im in ims:
        out.paste(im, (0, y))
        y += im.height + 8
    dst = rdir / f"gallery_{short}.jpg"
    out.save(dst, quality=85)
    print(dst.relative_to(ROOT), out.size)


if __name__ == "__main__":
    args = sys.argv[1:]
    tier = "high" if "--high" in args else "low"
    for s in [a for a in args if not a.startswith("--")]:
        main(s, tier)
