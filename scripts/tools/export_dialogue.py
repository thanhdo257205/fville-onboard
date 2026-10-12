"""Xuất toàn bộ lời thoại + câu riêng (gợi ý, tin nhắn, mini-game, quiz, câu nhanh) ra 1 file Excel để gửi đề xuất chỉnh sửa.

Chạy:  python scripts/tools/export_dialogue.py [--out exports/loi_thoai.xlsx]
Ra:    file .xlsx (mặc định exports/loi_thoai_<ngày>.xlsx — thư mục exports/ không commit). Trang:
  Hướng dẫn · Hội thoại (data/dialogues.json: lời nhân vật, lời dẫn, lựa chọn của người chơi, tin nhắn trong hội thoại) ·
  Gợi ý & tin nhắn (data/guidance.json: gợi ý phím H, câu Tú nhắc, tin nhắn điện thoại khi đứng yên, lối ra zone) ·
  Mini-game & quiz (data/interactables.json → minigames, data/quiz.json) · Câu nhanh (data/net.json: câu nhanh, emote) ·
  Tổng hợp (số câu theo nhân vật / zone — công thức COUNTIF).
Mỗi câu 1 dòng: mã (để tìm lại trong dữ liệu), nhân vật, ngữ cảnh, câu tiếng Anh + tiếng Việt hiện tại, 2 cột trống (nền vàng)
"Đề xuất sửa" EN / VI + Ghi chú. Chỉ dùng thư viện chuẩn + openpyxl.
"""
import argparse
import datetime
import json
import os

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = lambda n: json.load(open(os.path.join(ROOT, "data", n), encoding="utf-8"))

FONT = "Arial"
HEAD_FILL = PatternFill("solid", fgColor="1F2937")
EDIT_FILL = PatternFill("solid", fgColor="FFF2CC")       # ô cần điền (đề xuất)
DRAFT_FILL = PatternFill("solid", fgColor="FCE4D6")
THIN = Side(style="thin", color="D0D5DD")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def tr(v):
    """{en, vi} → (en, vi); chuỗi thường → (chuỗi, "")."""
    if isinstance(v, dict):
        return v.get("en", ""), v.get("vi", "")
    return (v or ""), ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "exports", f"loi_thoai_{datetime.date.today().isoformat()}.xlsx"))
    out = ap.parse_args().out
    os.makedirs(os.path.dirname(out), exist_ok=True)

    chars, zones, quests = D("characters.json"), D("zones.json"), D("quests.json")
    names_vi, names_en = chars["names"]["vi"], chars["names"]["en"]
    special = {"narrator": "Lời dẫn", "player": "Người chơi", "app": "App My FPT", "hr": f"{names_vi.get('hr', 'HR')} (tin nhắn)", None: "—"}
    who = lambda r: special.get(r) or (f"{names_vi.get(r, r)} / {names_en.get(r, r)}" if names_en.get(r) and names_en.get(r) != names_vi.get(r) else names_vi.get(r, r))
    zone_title = {z: tr(c.get("title"))[1] or z for z, c in zones["zones"].items()} if all("title" in c for c in zones["zones"].values()) else {}
    order = {z: i for i, z in enumerate(zones["order"])}

    # zone của mỗi hội thoại: tìm "dialogue:<id>" / "dialogue": "<id>" trong mọi file data, lấy "zone" gần nhất ở trên
    dlg = D("dialogues.json")["dialogues"]
    dzone = {}

    def walk(o, zone=None):
        if isinstance(o, dict):
            zone = o.get("zone", zone) if isinstance(o.get("zone"), str) else zone
            for k, v in o.items():
                z = k if k in zones["zones"] else zone
                if isinstance(v, str):
                    did = v[9:] if v.startswith("dialogue:") else (v if k in ("dialogue", "on_enter", "dialog") else None)
                    if did and z and did not in dzone:
                        dzone[did] = z
                walk(v, z)
        elif isinstance(o, list):
            for v in o:
                walk(v, zone)
    for f in ("zones.json", "interactables.json", "cutscenes.json", "quests.json", "guidance.json", "characters.json"):
        walk(D(f))
    # chưa rõ zone (hội thoại gọi từ code / trigger): tiền tố id (z5_…), đuôi _zoneN, bảng dưới; cảnh kết riêng
    hint = {"board_remind": "zone_00", "thao_remind_app": "zone_01", "fsa_remind": "zone_04", "ending_tu": "ending"}
    for x in dlg:
        i = x["id"]
        if i in dzone:
            continue
        if i in hint:
            dzone[i] = hint[i]
        elif i[:2] in ("z0", "z1", "z2", "z3", "z4", "z5"):
            dzone[i] = f"zone_0{i[1]}"
        elif i[-5:-1] == "zone" and i[-1].isdigit():
            dzone[i] = f"zone_0{i[-1]}"
    vi18n = json.load(open(os.path.join(ROOT, "data", "i18n", "vi.json"), encoding="utf-8"))
    zname = {z: f"Zone {int(z[-1])} · {v['title']}" for z, v in vi18n.get("zones", {}).items() if z.startswith("zone_")}
    zname["ending"] = "Cảnh kết"
    order["ending"] = 98

    wb = Workbook()
    ws0 = wb.active
    ws0.title = "Hướng dẫn"

    def sheet(title, headers, widths):
        ws = wb.create_sheet(title)
        ws.append(headers)
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        for c in ws[1]:
            c.font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
            c.fill = HEAD_FILL
            c.alignment = Alignment(wrap_text=True, vertical="center")
            c.border = BORDER
        ws.freeze_panes = "A2"
        ws.row_dimensions[1].height = 30
        return ws

    def finish(ws, edit_cols, draft_col=None):
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.font = Font(name=FONT, size=10)
                c.alignment = Alignment(wrap_text=True, vertical="top")
                c.border = BORDER
            for k in edit_cols:
                row[k - 1].fill = EDIT_FILL
            if draft_col and row[draft_col - 1].value:
                for c in row[:draft_col]:
                    c.fill = DRAFT_FILL
        ws.auto_filter.ref = ws.dimensions

    # ---------- Hội thoại ----------
    H = ["STT", "Zone", "Mã hội thoại", "Mã câu", "Nhân vật", "Loại", "Cử chỉ", "Câu hiện tại — tiếng Anh", "Câu hiện tại — tiếng Việt",
         "DRAFT", "Đề xuất sửa — tiếng Anh", "Đề xuất sửa — tiếng Việt", "Ghi chú / lý do"]
    ws = sheet("Hội thoại", H, [6, 22, 20, 8, 22, 16, 10, 48, 48, 8, 40, 40, 30])
    anim_vi = {"wave": "vẫy tay", "nod": "gật đầu", "point": "chỉ tay", "think": "nghĩ", "talk": "nói", "phone": "xem điện thoại",
               "cheer": "vui mừng", "press": "bấm"}
    rows = []
    for x in dlg:
        z = dzone.get(x["id"], "")
        for nid, n in x["nodes"].items():
            if isinstance(n.get("text"), dict):
                kind = "Tin nhắn" if n.get("style") == "phone" else "Lời dẫn" if n.get("speaker") == "narrator" else "Lời nói"
                en, vi = tr(n["text"])
                rows.append((z, x["id"], nid, who(n.get("speaker")), kind, anim_vi.get(n.get("anim"), n.get("anim") or ""), en, vi,
                             "DRAFT" if n.get("draft") else ""))
            for i, ch in enumerate(n.get("choices") or []):
                if isinstance(ch.get("text"), dict):
                    en, vi = tr(ch["text"])
                    rows.append((z, x["id"], f"{nid}.{i + 1}", "Người chơi (lựa chọn)", "Lựa chọn", "", en, vi, "DRAFT" if ch.get("draft") else ""))
    rows.sort(key=lambda r: order.get(r[0], 99))           # theo zone, giữ thứ tự trong file
    for k, r in enumerate(rows, 1):
        ws.append([k, zname.get(r[0], r[0]), *r[1:], "", "", ""])
    finish(ws, (11, 12, 13), draft_col=10)
    n_dialogue = len(rows)

    # ---------- Gợi ý & tin nhắn ----------
    g = D("guidance.json")
    phone_from = g["settings"].get("phone_from", {})
    qzone = {q["id"]: q.get("zone", "") for q in quests.get("quests", []) if isinstance(q, dict)}
    qtitle = {q["id"]: tr(q.get("title"))[1] for q in quests.get("quests", []) if isinstance(q, dict)}
    H2 = ["STT", "Zone", "Mã việc", "Việc (tên nhiệm vụ)", "Loại", "Người nói / gửi", "Lần", "Câu hiện tại — tiếng Anh", "Câu hiện tại — tiếng Việt",
          "Đề xuất sửa — tiếng Anh", "Đề xuất sửa — tiếng Việt", "Ghi chú / lý do"]
    ws2 = sheet("Gợi ý & tin nhắn", H2, [6, 22, 18, 30, 18, 22, 6, 48, 48, 40, 40, 30])
    rows = []
    for gid, v in g["goals"].items():
        if gid.startswith("_"):
            continue
        z = qzone.get(gid, "")
        if v.get("help"):
            en, vi = tr(v["help"]); rows.append((z, gid, qtitle.get(gid, ""), "Gợi ý (phím H)", "—", 1, en, vi))
        for i, t in enumerate(v.get("tu") or [], 1):
            en, vi = tr(t); rows.append((z, gid, qtitle.get(gid, ""), "Tú nhắc khi đứng yên", who("tu"), i, en, vi))
        for i, t in enumerate(v.get("phone") or [], 1):
            en, vi = tr(t); rows.append((z, gid, qtitle.get(gid, ""), "Tin nhắn khi đứng yên", who(phone_from.get(z)), i, en, vi))
    for z, v in g.get("zone_exits", {}).items():
        if z.startswith("_"):
            continue
        if v.get("help"):
            en, vi = tr(v["help"]); rows.append((z, f"exit:{z}", "Lối ra zone", "Gợi ý (phím H)", "—", 1, en, vi))
        for i, t in enumerate(v.get("tu") or [], 1):
            en, vi = tr(t); rows.append((z, f"exit:{z}", "Lối ra zone", "Tú nhắc khi đứng yên", who("tu"), i, en, vi))
        for i, t in enumerate(v.get("phone") or [], 1):
            en, vi = tr(t); rows.append((z, f"exit:{z}", "Lối ra zone", "Tin nhắn khi đứng yên", who(phone_from.get(z)), i, en, vi))
    rows.sort(key=lambda r: order.get(r[0], 99))
    for k, r in enumerate(rows, 1):
        ws2.append([k, zname.get(r[0], r[0]), *r[1:], "", "", ""])
    finish(ws2, (10, 11, 12))
    n_guide = len(rows)

    # ---------- Mini-game & quiz ----------
    H3 = ["STT", "Nguồn", "Mini-game / câu hỏi", "Khoá (đường dẫn)", "Câu hiện tại — tiếng Anh", "Câu hiện tại — tiếng Việt",
          "Đề xuất sửa — tiếng Anh", "Đề xuất sửa — tiếng Việt", "Ghi chú / lý do"]
    ws3 = sheet("Mini-game & quiz", H3, [6, 14, 22, 34, 50, 50, 40, 40, 30])
    rows = []

    def leaves(o, path):
        if isinstance(o, dict):
            if set(o) >= {"en", "vi"} and isinstance(o["en"], str):
                yield path, o["en"], o["vi"]
                return
            for k, v in o.items():
                if not k.startswith("_"):
                    yield from leaves(v, f"{path}.{k}" if path else k)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                yield from leaves(v, f"{path}[{i + 1}]")
    ia = D("interactables.json")
    for mid, m in (ia.get("minigames") or {}).items():
        if mid.startswith("_"):
            continue
        for p, en, vi in leaves(m, ""):
            rows.append(("Mini-game", mid, p, en, vi))
    for p, en, vi in leaves(D("quiz.json"), ""):
        rows.append(("Quiz Cuder", p.split(".")[0], p, en, vi))
    for k, r in enumerate(rows, 1):
        ws3.append([k, *r, "", "", ""])
    finish(ws3, (7, 8, 9))
    n_mg = len(rows)

    # ---------- Câu nhanh ----------
    net = D("net.json")
    H4 = ["STT", "Loại", "Mã", "Biểu tượng", "Câu hiện tại — tiếng Anh", "Câu hiện tại — tiếng Việt", "Đề xuất sửa — tiếng Anh",
          "Đề xuất sửa — tiếng Việt", "Ghi chú / lý do"]
    ws4 = sheet("Câu nhanh", H4, [6, 18, 16, 10, 40, 40, 36, 36, 30])
    rows = []
    for kind, lab in (("phrases", "Câu nhanh (phím T)"), ("emotes", "Emote")):
        for e in net.get(kind) or []:
            en, vi = tr(e.get("text") or e.get("label") or e.get("name"))
            rows.append((lab, e.get("id", ""), e.get("icon", ""), en, vi))
    for k, r in enumerate(rows, 1):
        ws4.append([k, *r, "", "", ""])
    finish(ws4, (7, 8, 9))

    # ---------- Tổng hợp (công thức) ----------
    ws5 = sheet("Tổng hợp", ["Nhân vật / nguồn", "Số câu", "Số câu có đề xuất (EN hoặc VI)"], [34, 12, 28])
    people = sorted({r[0].value for r in ws.iter_rows(min_row=2, min_col=5, max_col=5)} - {None})
    last = ws.max_row
    for p in people:
        r = ws5.max_row + 1
        ws5.append([p, f"=COUNTIF('Hội thoại'!$E$2:$E${last},A{r})",
                    f"=COUNTIFS('Hội thoại'!$E$2:$E${last},A{r},'Hội thoại'!$K$2:$K${last},\"<>\")"
                    f"+COUNTIFS('Hội thoại'!$E$2:$E${last},A{r},'Hội thoại'!$K$2:$K${last},\"\",'Hội thoại'!$L$2:$L${last},\"<>\")"])
    for title, sh in (("Gợi ý & tin nhắn (cả trang)", ws2), ("Mini-game & quiz (cả trang)", ws3), ("Câu nhanh (cả trang)", ws4)):
        r = ws5.max_row + 1
        n = sh.max_row
        ec = {"Gợi ý & tin nhắn": ("J", "K"), "Mini-game & quiz": ("G", "H"), "Câu nhanh": ("G", "H")}[sh.title]
        q = f"'{sh.title}'"
        ws5.append([title, f"=COUNTA({q}!$A$2:$A${n})",
                    f"=SUMPRODUCT(--((LEN({q}!${ec[0]}$2:${ec[0]}${n})+LEN({q}!${ec[1]}$2:${ec[1]}${n}))>0))"])
    r = ws5.max_row + 1
    ws5.append(["TỔNG", f"=SUM(B2:B{r - 1})", f"=SUM(C2:C{r - 1})"])
    finish(ws5, ())
    for c in ws5[ws5.max_row]:
        c.font = Font(name=FONT, size=10, bold=True)

    # ---------- Hướng dẫn ----------
    ws0.column_dimensions["A"].width = 28
    ws0.column_dimensions["B"].width = 110
    info = [
        ("Lời thoại — Ngày Đầu Ở F-Ville", ""),
        ("Xuất ngày", datetime.date.today().strftime("%d/%m/%Y") + " (từ data/*.json của repo; chạy lại: python scripts/tools/export_dialogue.py)"),
        ("Cách đề xuất", "Ghi câu mới vào 2 cột NỀN VÀNG \"Đề xuất sửa — tiếng Anh / tiếng Việt\" ở cùng dòng; lý do (nếu có) ghi ở "
                         "\"Ghi chú / lý do\". Không sửa các cột khác (mã dùng để tìm lại câu trong dữ liệu). Câu không cần đổi: để trống."),
        ("Biến trong câu", "Giữ nguyên các chỗ trong ngoặc nhọn: {player} = tên người chơi; {tu_he} / {tu_his} / {tu_him} / {Tu_he}… = đại "
                           "từ của Tú (đổi theo giới tính); {name}, {n}… = số / tên game tự điền."),
        ("Văn phong tiếng Việt", "Tú xưng \"mình – cậu\"; người lớn (chị Huyền, chị Nga, anh Prajith…) xưng \"chị / anh – em\"; giao diện gọi "
                                 "\"bạn\". Giữ các từ intern, mentor, team, app, check-in. Chi tiết: docs/vi_style.md."),
        ("DRAFT", "Dòng tô cam nhạt có chữ DRAFT: nội dung đang chờ HR xác nhận (giờ xe, quy định…) — trong game hiện [DRAFT]."),
        ("Người thật", "Lời của chị Huyền, chị Nga, anh Prajith dựa trên người thật: giữ nhẹ nhàng, thân thiện, không nói chuyện sức khỏe, "
                       "gia đình, tiền bạc."),
        ("Các trang", f"Hội thoại ({n_dialogue} câu) · Gợi ý & tin nhắn ({n_guide}) · Mini-game & quiz ({n_mg}) · Câu nhanh ({ws4.max_row - 1}) · "
                      "Tổng hợp (đếm số câu và số câu đã có đề xuất theo nhân vật)."),
        ("", ""),
        ("Ví dụ một dòng đề xuất", "Trang Hội thoại, cột \"Đề xuất sửa — tiếng Việt\": Chào buổi sáng {player}! Chị Nga bên Tuyển dụng đây. "
                                   "· Ghi chú: \"Thêm lời chào cho tự nhiên hơn\""),
    ]
    for a, b in info:
        ws0.append([a, b])
    for row in ws0.iter_rows():
        row[0].font = Font(name=FONT, size=10, bold=True)
        row[1].font = Font(name=FONT, size=10)
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    ws0["A1"].font = Font(name=FONT, size=14, bold=True)
    ws0["B3"].fill = EDIT_FILL

    wb.calculation.fullCalcOnLoad = True        # Excel / WPS tính lại công thức trang Tổng hợp khi mở
    wb.save(out)
    print(f"[xuất] {out}: hội thoại {n_dialogue} câu, gợi ý & tin nhắn {n_guide}, mini-game & quiz {n_mg}, câu nhanh {ws4.max_row - 1}")


if __name__ == "__main__":
    main()
