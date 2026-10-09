"""Ghi models.<id> vào data/characters.json mà KHÔNG định dạng lại cả file: chỉ thay khối của nhân vật đó (phần còn
lại — mảng viết gọn một dòng, khối bản Web sửa tay — giữ nguyên từng ký tự). Dùng chung cho build_character.py,
render_portrait.py."""
import json
import os


def _num(o):
    """json: số numpy (float32 từ mathutils) → số Python."""
    return o.item() if hasattr(o, "item") else str(o)


def splice_model(text, cid, entry):
    """Thay giá trị "models" → "<cid>" trong văn bản JSON bằng entry (thụt lề 2). Không tìm thấy khối, hoặc kết quả
    đọc lại không khớp → None."""
    def skip_ws(i):
        while i < len(text) and text[i] in " \t\r\n":
            i += 1
        return i

    def end_of_value(i):          # i trỏ vào '{' → chỉ số sau '}' khớp (bỏ qua nội dung chuỗi)
        depth, k, in_str = 0, i, False
        while k < len(text):
            ch = text[k]
            if in_str:
                if ch == "\\":
                    k += 1
                elif ch == '"':
                    in_str = False
            elif ch == '"':
                in_str = True
            elif ch in "{[":
                depth += 1
            elif ch in "}]":
                depth -= 1
                if depth == 0:
                    return k + 1
            k += 1
        return -1

    mi = text.find('"models"')
    if mi < 0:
        return None
    mstart = skip_ws(text.index(":", mi) + 1)
    if text[mstart] != "{":
        return None
    mend = end_of_value(mstart)
    key = f'"{cid}"'
    ki = text.find(key, mstart, mend)
    while ki >= 0 and text[skip_ws(ki + len(key))] != ":":
        ki = text.find(key, ki + 1, mend)
    if ki < 0:
        return None
    indent = text[text.rfind("\n", 0, ki) + 1:ki]
    vstart = skip_ws(text.index(":", ki) + 1)
    vend = end_of_value(vstart)
    body = json.dumps(entry, ensure_ascii=False, indent=2, default=_num).replace("\n", "\n" + indent)
    out = text[:vstart] + body + text[vend:]
    try:
        same = json.loads(json.dumps(json.loads(out)["models"][cid])) == json.loads(json.dumps(entry, default=_num))
    except (ValueError, KeyError):
        return None
    return out if same else None


def update_model(path, cid, mutate):
    """Đọc data/characters.json, mutate(models.<cid>) (tạo nếu chưa có), ghi lại chỉ khối đó; chưa có khối → ghi cả
    file. → True nếu chỉ thay khối."""
    text = open(path, encoding="utf-8").read() if os.path.exists(path) else "{}"
    data = json.loads(text)
    m = data.setdefault("models", {}).setdefault(cid, {})
    mutate(m)
    out = splice_model(text, cid, m)
    with open(path, "w", encoding="utf-8", newline="") as f:
        if out is not None:
            f.write(out)
        else:
            json.dump(data, f, ensure_ascii=False, indent=2, default=_num)
    return out is not None
