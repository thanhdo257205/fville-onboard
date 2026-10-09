"""Ghép ảnh animation của nhân vật (renders/characters/<id>_anim/<action>_<k>.png) thành 1 bảng có nhãn.

Chạy: python scripts/tools/anim_sheet.py prajith  →  renders/characters/<id>_animations.jpg
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = Path(os.environ.get("WINDIR", "")) / "Fonts"   # font hệ thống Windows (có dấu tiếng Việt)


def main(cid, cols=5):
    d = ROOT / "renders" / "characters" / f"{cid}_anim"
    report = json.loads((ROOT / "assets" / "characters" / cid / f"{cid}.report.json").read_text(encoding="utf-8"))
    names = list(report["actions"])
    tiles = []
    font = ImageFont.truetype(str(FONTS / "segoeuib.ttf"), 18)
    small = ImageFont.truetype(str(FONTS / "segoeui.ttf"), 14)
    for n in names:
        frames = [Image.open(d / f"{n}_{k}.png").convert("RGB") for k in range(3)]
        w, h = frames[0].size
        t = Image.new("RGB", (w * 3, h + 30), "#24262b")
        for k, im in enumerate(frames):
            t.paste(im, (k * w, 30))
        dr = ImageDraw.Draw(t)
        info = report["actions"][n]
        loop = "lặp" if n in json.loads((ROOT / "data" / "characters.json").read_text(encoding="utf-8"))["models"][cid]["loop"] else "1 lần"
        dr.text((8, 4), n, font=font, fill="#ffffff")
        dr.text((8 + dr.textlength(n, font=font) + 10, 7), f"{info.get('duration_s', 0):.1f} s · {loop}", font=small, fill="#a9b0b8")
        tiles.append(t)
    tw, th = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw + (cols - 1) * 6, rows * th + (rows - 1) * 6), "#111214")
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * (tw + 6), (i // cols) * (th + 6)))
    out = ROOT / "renders" / "characters" / f"{cid}_animations.jpg"
    sheet.save(out, quality=88)
    print(out.relative_to(ROOT), sheet.size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "prajith")
