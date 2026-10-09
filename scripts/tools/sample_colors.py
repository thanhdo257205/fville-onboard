"""Lấy màu trung vị (hex) từ các vùng chọn trong khung hình tham chiếu.

Chạy: python scripts/tools/sample_colors.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

F = Path(__file__).resolve().parents[2] / "references" / "frames"

# tên vật liệu: (khung hình, (x0, y0, x1, y1))
SAMPLES = {
    "gach_lat_san":        ("LoiDi/t_0056.0.jpg", (300, 1000, 500, 1200)),
    "gach_lam_mat_tien":   ("LoiDi/t_0074.0.jpg", (435, 100, 460, 250)),
    "be_tong_trang":       ("LoiDi/t_0074.0.jpg", (200, 215, 600, 235)),
    "bac_thang_da_den":    ("LoiDi/t_0074.0.jpg", (300, 600, 450, 640)),
    "kinh_mat_tien":       ("LoiDi/t_0074.0.jpg", (240, 40, 270, 120)),
    "cot_xanh_pilotis":    ("LoiDi/t_0028.0.jpg", (437, 420, 463, 600)),
    "san_mai_be_tong":     ("LoiDi/t_0028.0.jpg", (300, 900, 500, 1100)),
    "co":                  ("LoiDi/t_0000.0.jpg", (400, 450, 600, 470)),
    "tan_cay":             ("LoiDi/t_0000.0.jpg", (550, 150, 700, 250)),
    "vien_via_vang":       ("LoiDi/t_0000.0.jpg", (660, 585, 730, 600)),
    "vien_via_xam":        ("LoiDi/t_0000.0.jpg", (560, 610, 620, 625)),
    "duong_nhua":          ("LoiDi/t_0000.0.jpg", (800, 620, 1100, 700)),
    "tuong_trang":         ("TuongCuDo/t_0012.0.jpg", (480, 1000, 560, 1100)),
    "da_ong_gieng":        ("GiengLang/t_0012.0.jpg", (200, 900, 400, 1000)),
    "gach_luc_giac":       ("GiengLang/t_0012.0.jpg", (600, 1150, 700, 1250)),
    "xe_bus_do":           ("GiengLang/t_0008.0.jpg", (300, 280, 500, 350)),
    "da_granite_sanh":     ("LoiDi/t_0094.0.jpg", (200, 950, 500, 1150)),
    "go_lam_tran_hat_lua": ("LoiDi/t_0100.0.jpg", (100, 100, 600, 200)),
    "san_go_hat_lua":      ("LoiDi/t_0100.0.jpg", (200, 900, 500, 1100)),
    "quay_le_tan_go":      ("fville_green_office_720p/t_0052.0.jpg", (720, 340, 880, 400)),
    "quay_le_tan_den":     ("fville_green_office_720p/t_0052.0.jpg", (580, 240, 760, 300)),
    "panel_go_duc_lo":     ("fville_green_office_720p/t_0062.0.jpg", (600, 200, 680, 400)),
    "san_go_vp":           ("VanPhongLamViec/t_0002.0.jpg", (150, 450, 300, 520)),
    "gach_vp_xanh_dam":    ("VanPhongLamViec/t_0024.0.jpg", (420, 445, 480, 470)),
    "gach_vp_xanh_vua":    ("VanPhongLamViec/t_0024.0.jpg", (120, 400, 200, 440)),
    "gach_vp_vang_xanh":   ("VanPhongLamViec/t_0024.0.jpg", (330, 375, 420, 410)),
    "ban_den":             ("VanPhongLamViec/t_0036.0.jpg", (420, 350, 560, 450)),
    "vach_ngan_go_cam":    ("VanPhongLamViec/t_0036.0.jpg", (300, 215, 380, 250)),
    "ke_do":               ("VanPhongLamViec/t_0024.0.jpg", (905, 180, 925, 200)),
    "tuong_vp_trang":      ("VanPhongLamViec/t_0036.0.jpg", (250, 30, 400, 120)),
    "kinh_phong_hop_toi":  ("VanPhongLamViec/t_0024.0.jpg", (200, 60, 350, 200)),
    "san_atrium_xanh":     ("LoiDi/t_0148.0.jpg", (200, 950, 500, 1100)),
    "le_tan_quay_trang":   ("LeTan/t_0003.5.jpg", (250, 700, 500, 800)),
    "le_tan_chan_quay":    ("LeTan/t_0003.5.jpg", (300, 835, 400, 860)),
    "le_tan_don_go":       ("LeTan/t_0000.0.jpg", (380, 745, 500, 790)),
    "le_tan_mat_don":      ("LeTan/t_0000.0.jpg", (440, 715, 500, 728)),
    "le_tan_lam_cua_so":   ("LeTan/t_0000.0.jpg", (140, 450, 190, 650)),
    "hat_lua_vach_go":     ("LeTan/t_0006.5.jpg", (150, 450, 250, 750)),
    "hat_lua_san_go":      ("LeTan/t_0006.5.jpg", (200, 1000, 500, 1200)),
}

for name, (f, box) in SAMPLES.items():
    px = np.asarray(Image.open(F / f).convert("RGB").crop(box)).reshape(-1, 3)
    r, g, b = np.median(px, axis=0).astype(int)
    print(f"{name:22s} #{r:02x}{g:02x}{b:02x}")
