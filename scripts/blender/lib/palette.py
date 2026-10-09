"""Bảng màu chung cho toàn game (đã duyệt ở references/palette_proposal.png).

Màu được ghi vào vertex color (attribute "Color") của từng mặt, nên mỗi zone chỉ cần
vài chất liệu dùng chung (xem materials.py). Thêm màu mới ở đây, không viết hex rải rác.
"""

PALETTE = {
    # --- ngoài trời ---
    "brick":          "#A0563F",  # gạch lát sân / lối đi
    "brick_dark":     "#96503A",  # gạch lát tông đậm (xen kẽ, tương phản thấp)
    "brick_louver":   "#8E4636",  # lam gạch mặt tiền (đậm hơn gạch lát)
    "concrete_white": "#EDEBE6",  # sàn/dầm bê tông trắng
    "concrete_grey":  "#C9C5BC",  # bồn cây, viền bê tông
    "glass":          "#9FC9CF",
    "glass_facade":   "#7F98A2",  # kính mặt tiền (phản chiếu trời, xám xanh)
    "glass_grey":     "#5E6B74",  # khối kính xám đầu phía đông
    "glass_dark":     "#3C4A55",  # kính nhìn vào trong tối
    "stone_black":    "#2B2B30",  # bậc thềm đá đen
    "column_green":   "#B7D8A8",  # cột pilotis
    "polished_floor": "#BDB6A8",  # sàn bê tông mài
    "grass":          "#8CC152",
    "grass_dark":     "#6FA542",
    "leaf":           "#4E8A3A",  # tán cây
    "leaf_light":     "#6BA94A",
    "leaf_dark":      "#3B6E2E",
    "leaf_yellow":    "#8DB848",  # tán non vàng xanh
    "bamboo":         "#B5C35A",
    "bamboo_dark":    "#6E9440",
    "bamboo_leaf":    "#8FBF4A",
    "trunk":          "#7A5C44",
    "trunk_white":    "#ECEAE2",  # gốc cây quét vôi trắng
    "flower_pink":    "#E86A9A",
    "flower_white":   "#F6F3EA",
    "dirt":           "#A07E5E",  # nền đất ruộng đã gặt
    "curb_yellow":    "#F2C14E",
    "curb_grey":      "#8F939C",
    "asphalt":        "#6E7380",
    "road_line":      "#F4F4F2",
    "hex_paver":      "#9C6E62",  # gạch lục giác (giữa có cỏ mọc)
    "hex_paver_dark": "#8A5F55",
    "lamp_black":     "#2E2E33",
    "lamp_white":     "#F7F5EC",
    # --- điểm nhấn ---
    "statue_white":   "#F2F0EA",
    "laterite":       "#A0643A",  # đá ong giếng
    "laterite_dark":  "#7E4E2E",
    "mortar":         "#D9CBB5",
    "wood_pole":      "#6B5640",
    "fern":           "#5FA040",
    "net":            "#5E5A55",
    "sign_white":     "#F2F2F2",
    "bus_red":        "#D7263D",
    "bus_white":      "#F4F4F4",
    "fpt_orange":     "#F37021",  # chỉ dùng cho mảng thay logo
    "fpt_green":      "#4CB848",
    "fpt_blue":       "#0B6EB6",
    "placeholder":    "#FF4FB0",  # hồng chói: đánh dấu khối tạm chờ tham chiếu
    "tex_white":      "#FFFFFF",  # mặt có texture: để màu ảnh hiện nguyên (AO vẫn nhân vào)
    "tex_shade":      "#D6CEC2",  # mặt có texture, tông tối hơn (đá ong từng viên khác nhau)
    "sign_inner":     "#B9BCC0",  # mặt chữ biển FPT SOFTWARE (xám nhạt trong viền trắng)
    # --- trong nhà ---
    "granite":        "#1F1E1D",
    "granite_2":      "#272522",  # ô granite xen kẽ (tương phản rất thấp)
    "cushion_grey":   "#55524E",  # mặt đệm đôn
    "wood_floor_dk":  "#B88E5A",
    "ceiling_white":  "#F4F4F2",
    "wood_light":     "#D9A866",
    "wood_floor":     "#C9A36B",
    "rice_grain":     "#E8D3A0",
    "black":          "#1E1E22",
    "office_tile_dk": "#456E3E",
    "office_tile_md": "#79A85E",
    "office_tile_yl": "#C9C77E",
    "desk_black":     "#2F3633",
    "divider_wood":   "#C98A4B",
    "glass_meeting":  "#2A2F45",
    "shelf_red":      "#D83A3A",
    "atrium_floor":   "#9DB08F",
    "atrium_floor_2": "#A7B999",
    "terracotta":     "#B5633F",  # chậu cây đất nung
    "san_go_vp":      "#9A6B4A",  # sàn gỗ hành lang văn phòng
    "san_go_vp_2":    "#8C6044",
    "office_tile_lt": "#5DAA72",  # gạch VP xanh ngọc
    "pool_blue":      "#2F5FB0",  # nỉ bàn bi-a
    "pool_wood":      "#3A2622",  # thân bàn bi-a gỗ nâu đen
    "screen":         "#26303C",  # màn hình tắt
    "screen_on":      "#3F79C8",  # màn hình đang bật
    "blind_white":    "#ECEAE4",  # rèm cuốn cửa sổ văn phòng
    "mug":            "#F2F0EA",
    "paper":          "#FAFAF5",
    "sticky":         "#F7E26B",
    "tile_light":     "#E2DED4",  # sàn gạch sáng hành lang tầng trệt
    "duct_grey":      "#4A4C52",  # ống kỹ thuật lộ trần
    "reception_white": "#F5F3EE",
    "reception_base": "#CDB48E",
    "ottoman_wood":   "#C0703F",
    "led_green":      "#3CFF6A",
    # --- phố (zone_00 điểm đón) ---
    "led_amber":      "#FFB31A",  # số tuyến trên bảng LED xe bus
    "house_yellow":   "#E9C46A",  # nhà phố: tường sơn
    "house_mint":     "#A8D5BA",
    "house_pink":     "#E8A9A0",
    "house_cream":    "#EFE3C8",
    "house_blue":     "#A3BCD6",
    "house_peach":    "#F0B98D",
    "house_grey":     "#C8C5BF",
    "awning_red":     "#C44536",  # mái hiên vải
    "awning_green":   "#3E8E5E",
    "awning_blue":    "#3A6EA5",
    "awning_orange":  "#E07A3F",
    "shutter":        "#A9ADB3",  # cửa cuốn
    "shelter_blue":   "#2F6DB5",  # khung mái chờ xe buýt
    "stool_red":      "#D9443A",  # ghế nhựa quán vỉa hè
    "stool_blue":     "#3A78C9",
    "pavement":       "#B8A99A",  # gạch vỉa hè phố
    "pavement_2":     "#A99A8B",
}


def hex_to_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def color(name, alpha=1.0):
    """Màu sRGB (r, g, b, a) 0..1 — dùng cho vertex color kiểu BYTE_COLOR (lưu sRGB)."""
    return (*hex_to_srgb(PALETTE[name]), alpha)


def color_linear(name, alpha=1.0):
    """Màu tuyến tính — dùng cho Base Color của chất liệu."""
    return (*(srgb_to_linear(c) for c in hex_to_srgb(PALETTE[name])), alpha)
