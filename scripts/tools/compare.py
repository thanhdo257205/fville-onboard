"""Ghép ảnh tham chiếu (trái) + ảnh render Blender (phải) → renders/compare_<zone_ngắn>_<tên>.png

Đọc danh sách cặp ảnh từ renders/<zone>_compare.json (do script zone ghi ra).
Chạy: python scripts/tools/compare.py zone_02_campus
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = str(Path(os.environ.get("WINDIR", "")) / "Fonts" / "segoeui.ttf")
H = 960


def fit(im, h=H):
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def main(zone, tier="low"):
    rdir = ROOT / "renders" if tier == "low" else ROOT / "renders" / "high"
    data = json.loads((rdir / f"{zone}_compare.json").read_text(encoding="utf-8"))
    short = "_".join(zone.split("_")[:2])  # zone_02
    font = ImageFont.truetype(FONT, 28)
    for p in data["pairs"]:
        if not p.get("reference"):  # ảnh xem trước (zone không có ảnh thật, vd zone_00 phố chung chung)
            print(Path(p["render"]).relative_to(ROOT))
            continue
        ref = fit(Image.open(ROOT / "references" / "frames" / p["reference"]).convert("RGB"))
        ren = fit(Image.open(p["render"]).convert("RGB"))
        pad = 16
        out = Image.new("RGB", (ref.width + ren.width + pad * 3, H + 60 + pad), "#1d1d1f")
        out.paste(ref, (pad, 60))
        out.paste(ren, (ref.width + pad * 2, 60))
        d = ImageDraw.Draw(out)
        d.text((pad, 14), f"Tham chiếu: {p['reference']}", fill="#f0f0f0", font=font)
        d.text((ref.width + pad * 2, 14), f"Blender: {Path(p['render']).name}", fill="#f0f0f0", font=font)
        dst = rdir / f"compare_{short}_{p['name']}.png"
        out.save(dst)
        print(dst.relative_to(ROOT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "zone_02_campus", sys.argv[2] if len(sys.argv) > 2 else "low")
