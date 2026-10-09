"""Vẽ bảng màu đề xuất ra references/palette_proposal.png.

Chạy: python scripts/tools/palette_swatch.py
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]

PALETTE = {
    "Ngoài trời": [
        ("Gạch lát sân", "#B5654A"), ("Lam gạch mặt tiền", "#A9553F"), ("Bê tông trắng", "#EDEBE6"),
        ("Kính", "#9FC9CF"), ("Đá đen bậc thềm", "#2B2B30"), ("Cột pilotis", "#B7D8A8"),
        ("Cỏ", "#8CC152"), ("Tán cây", "#4E8A3A"), ("Lúa xanh", "#A8D45A"),
        ("Vỉa vàng", "#F2C14E"), ("Vỉa xám / đường", "#8F939C"), ("Gạch lục giác", "#B08A80"),
    ],
    "Điểm nhấn": [
        ("Tượng Cuder", "#F2F0EA"), ("Đá ong giếng", "#9A6A43"), ("Vữa", "#D9CBB5"),
        ("Sào gỗ", "#6B5640"), ("Xe bus đỏ", "#D7263D"), ("Xe bus trắng", "#F4F4F4"),
        ("FPT cam", "#F37021"), ("FPT xanh lá", "#4CB848"), ("FPT xanh dương", "#0B6EB6"),
    ],
    "Trong nhà": [
        ("Granite sảnh", "#2E2C2A"), ("Trần / tường trắng", "#F4F4F2"), ("Gỗ sáng (lam trần)", "#D9A866"), ("Quầy lễ tân trắng", "#F5F3EE"), ("Đôn gỗ cam", "#C0703F"),
        ("Sàn gỗ", "#C9A36B"), ("Hạt lúa gỗ", "#E8D3A0"), ("Đen (cọc, khung)", "#1E1E22"),
        ("Gạch VP đậm", "#4F7A4A"), ("Gạch VP vừa", "#8DBF8A"), ("Gạch VP vàng xanh", "#D7D98E"),
        ("Bàn đen", "#2F3633"), ("Vách gỗ cam", "#C98A4B"), ("Kính tối phòng họp", "#2A2F45"),
        ("Kệ đỏ", "#D83A3A"), ("Sàn atrium", "#A9C49A"), ("LED đầu đọc thẻ", "#3CFF6A"),
    ],
}

W, SW, PAD, COLS = 1500, 230, 20, 6
FONT = str(Path(os.environ.get("WINDIR", "")) / "Fonts" / "segoeui.ttf")  # có dấu tiếng Việt
font = ImageFont.truetype(FONT, 17)
title = ImageFont.truetype(FONT, 24)

rows = sum((len(v) + COLS - 1) // COLS for v in PALETTE.values())
H = PAD + rows * (SW // 2 + 60) + len(PALETTE) * 45
img = Image.new("RGB", (W, H), "#FAFAF7")
d = ImageDraw.Draw(img)
y = PAD
for group, colors in PALETTE.items():
    d.text((PAD, y), group, fill="#222", font=title)
    y += 40
    for i, (name, hx) in enumerate(colors):
        x = PAD + (i % COLS) * (SW + 15)
        if i and i % COLS == 0:
            y += SW // 2 + 60
        d.rounded_rectangle([x, y, x + SW, y + SW // 2], radius=12, fill=hx, outline="#ccc")
        d.text((x + 2, y + SW // 2 + 6), name, fill="#222", font=font)
        d.text((x + 2, y + SW // 2 + 28), hx, fill="#666", font=font)
    y += SW // 2 + 65
img.crop((0, 0, W, y)).save(ROOT / "references" / "palette_proposal.png")
print("ok")
