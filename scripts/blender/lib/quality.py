"""Mức đồ hoạ khi build: low (laptop văn phòng) | high (máy mạnh).

Chọn bằng tham số sau "--":  --quality high   (mặc định low)
Mọi module đọc từ đây để điều chỉnh mật độ, độ mịn, texture — không cần sửa từng zone.

Ngân sách mỗi zone:
  low : < ~60k tam giác, ≤ 10 chất liệu, < 5 MB
  high: < ~250k tam giác, < 15 MB, có lightmap (ánh sáng nướng sẵn) 2048²
"""
import sys

_ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TIER = _ARGS[_ARGS.index("--quality") + 1] if "--quality" in _ARGS else "low"
HIGH = TIER == "high"

TEX_SCALE = 2 if HIGH else 1          # texture gấp đôi độ phân giải
AO_SAMPLES = 64 if HIGH else 32
AO_STRENGTH = 0.4 if HIGH else 0.6    # bản cao đã có lightmap → AO đỉnh nhẹ hơn
LIGHTMAP = HIGH and "--no-lightmap" not in _ARGS
LIGHTMAP_SIZE = 2048
LIGHTMAP_SAMPLES = 96


def n(count, high_mult=2.0):
    """Số lượng vật rải (cây, bụi, cỏ...)."""
    return int(round(count * (high_mult if HIGH else 1.0)))


def detail(d):
    """Mức chi tiết cây: bản cao +1."""
    return d + 1 if HIGH else d


def cell(size, high_div=2.0):
    """Kích thước ô lưới mặt đất (nhỏ hơn ở bản cao → AO/loang màu mịn hơn)."""
    return size / high_div if HIGH else size


def seg(s):
    """Số cạnh cho khối cong (cầu, ống, trụ ≥ 7 cạnh). Trụ 6 cạnh (lục giác) giữ nguyên."""
    if not HIGH or s < 7:
        return s
    return int(round(s * 1.6))


def rings(r):
    return int(round(r * 1.5)) if HIGH else r
