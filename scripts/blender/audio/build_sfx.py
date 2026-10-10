# Dựng hiệu ứng âm thanh của game từ data/sounds.json → assets/sfx/<id>.mp3 (hoặc <id>_<n>.mp3), chép giấy phép của các gói
# nguồn vào assets/sfx/licenses/, viết lại docs/audio_credits.md (danh sách file + nguồn + giấy phép — file tự sinh).
#
#   tools/bin/blender.cmd --background --factory-startup --python scripts/blender/audio/build_sfx.py [-- --only phone,grain]
#
# Chạy trong Blender vì cần audaspace (module aud: đọc OGG, ghi MP3) + numpy có sẵn; không cần ffmpeg.
# Gói nguồn: assets/sfx/source/<gói>.zip (không có trên repo — tải lại ở link `download` trong data/sounds.json; SHA-256
# phải khớp `zip_sha256`, lệch là dừng). Chỉ nhận gói giấy phép CC0-1.0. Xử lý mỗi file: trộn về mono, cắt khoảng lặng
# đầu / cuối, chuẩn hoá đỉnh −1 dBFS, MP3 96 kbps (âm lượng trong game chỉnh ở data/sounds.json → volume, lúc phát).
import hashlib
import io
import json
import os
import sys
import tempfile
import zipfile

import aud
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import synth  # noqa: E402

SR = 44100
BITRATE = 96000
PEAK_DB = -1.0
OUT = os.path.join(ROOT, "assets", "sfx")
SRC = os.path.join(OUT, "source")
LIC = os.path.join(OUT, "licenses")
DOC = os.path.join(ROOT, "docs", "audio_credits.md")
ALLOWED = {"CC0-1.0"}
LICENSE_URL = {"CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/"}
PROCESS = "trộn về mono, cắt khoảng lặng đầu / cuối, chuẩn hoá đỉnh −1 dBFS, đổi sang MP3 96 kbps"


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = None
    if "--only" in a:
        only = set(a[a.index("--only") + 1].split(","))
    return only


def sha(b):
    return hashlib.sha256(b).hexdigest()


def out_name(sid, i, n):
    return f"{sid}.mp3" if n == 1 else f"{sid}_{i + 1}.mp3"


def read_ogg(data, name):
    """bytes của file âm thanh trong zip → (mảng mono float32, tần số mẫu)"""
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, os.path.basename(name))
        with open(p, "wb") as f:
            f.write(data)
        s = aud.Sound(p)
        sr = int(s.specs[0])
        x = np.asarray(s.data(), dtype=np.float32)
    return (x.mean(axis=1) if x.ndim == 2 else x), sr


def trim(x, sr):
    a = np.abs(x)
    peak = a.max()
    if peak <= 0:
        raise ValueError("file im lặng")
    on = np.flatnonzero(a > peak * 10 ** (-50 / 20))
    start = max(0, on[0] - int(sr * 0.001))
    end = min(len(x), on[-1] + int(sr * 0.01))
    y = x[start:end].copy()
    k = min(len(y), int(sr * 0.005))
    y[-k:] *= np.linspace(1, 0, k)
    return y


def normalize(x):
    return (x * (10 ** (PEAK_DB / 20) / np.abs(x).max())).astype(np.float32)


def write_mp3(x, sr, path):
    s = aud.Sound.buffer(x.reshape(-1, 1), sr)
    s.write(path, rate=sr, channels=aud.CHANNELS_MONO, format=aud.FORMAT_S16, container=aud.CONTAINER_MP3,
            codec=aud.CODEC_MP3, bitrate=BITRATE)


def main():
    only = args()
    cfg = json.load(open(os.path.join(ROOT, "data", "sounds.json"), encoding="utf-8"))
    sources, sounds = cfg["sources"], cfg["sounds"]
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(LIC, exist_ok=True)

    # gói nguồn: đúng giấy phép, đúng file đã ghi trong data (SHA-256)
    zips = {}
    used = {f["src"].split("/", 1)[0] for s in sounds.values() for f in s["files"] if "src" in f}
    for pack in sorted(used):
        meta = sources.get(pack)
        if not meta:
            sys.exit(f"[sfx] gói '{pack}' chưa khai ở sources")
        if meta.get("license") not in ALLOWED:
            sys.exit(f"[sfx] gói '{pack}': giấy phép {meta.get('license')} chưa được chấp nhận (chỉ {sorted(ALLOWED)})")
        zp = os.path.join(SRC, pack + ".zip")
        if not os.path.exists(zp):
            sys.exit(f"[sfx] thiếu {os.path.relpath(zp, ROOT)} — tải lại ở {meta['download']}")
        raw = open(zp, "rb").read()
        if sha(raw) != meta["zip_sha256"]:
            sys.exit(f"[sfx] {pack}.zip lệch SHA-256 ghi trong data/sounds.json (gói đã đổi?)")
        z = zipfile.ZipFile(io.BytesIO(raw))
        zips[pack] = z
        lic = z.read(meta["license_member"]).decode("utf-8", "replace").replace("\r\n", "\n")
        with open(os.path.join(LIC, pack + ".txt"), "w", encoding="utf-8", newline="\n") as f:
            f.write(lic.strip() + "\n")

    rows, made = [], set()
    for sid, s in sounds.items():
        files = s["files"]
        for i, f in enumerate(files):
            name = out_name(sid, i, len(files))
            made.add(name)
            row = {"id": sid, "file": f"assets/sfx/{name}", "use": s.get("use", "")}
            if "src" in f:
                pack, member = f["src"].split("/", 1)
                data = zips[pack].read(member)
                row.update(kind="pack", pack=pack, member=member, src_sha=sha(data))
                if only is None or sid in only:
                    x, sr = read_ogg(data, member)
            elif "synth" in f:
                if f["synth"] not in synth.RECIPES:
                    sys.exit(f"[sfx] {sid}: không có công thức '{f['synth']}' trong synth.py")
                row.update(kind="synth", recipe=f["synth"], doc=(synth.RECIPES[f["synth"]].__doc__ or "").strip())
                if only is None or sid in only:
                    x, sr = synth.RECIPES[f["synth"]](SR), SR
            else:
                sys.exit(f"[sfx] {sid}: mỗi bản cần 'src' hoặc 'synth'")
            path = os.path.join(OUT, name)
            if only is None or sid in only:
                y = normalize(trim(np.asarray(x, dtype=np.float32), sr))
                write_mp3(y, sr, path)
                row["dur"] = len(y) / sr
                print(f"[sfx] {name:24s} {len(y) / sr:5.2f} s  {os.path.getsize(path) / 1024:5.1f} KB")
            elif os.path.exists(path):
                s2 = aud.Sound(path)
                row["dur"] = s2.length / s2.specs[0]
            row["bytes"] = os.path.getsize(path) if os.path.exists(path) else 0
            rows.append(row)

    if only is None:   # file cũ không còn trong data → xoá (khỏi lọt vào bản build mà không có trong danh sách giấy phép)
        for name in os.listdir(OUT):
            if name.endswith(".mp3") and name not in made:
                os.remove(os.path.join(OUT, name))
                print(f"[sfx] xoá file thừa {name}")
        for name in os.listdir(LIC):
            if name.endswith(".txt") and name[:-4] not in used:
                os.remove(os.path.join(LIC, name))

    write_doc(sources, used, rows)
    total = sum(r["bytes"] for r in rows)
    print(f"[sfx] {len(rows)} file, {total / 1024:.0f} KB → assets/sfx/; danh sách nguồn + giấy phép → docs/audio_credits.md")


def write_doc(sources, used, rows):
    packs = [r for r in rows if r["kind"] == "pack"]
    synths = [r for r in rows if r["kind"] == "synth"]
    L = []
    w = L.append
    w("# Âm thanh: danh sách file, nguồn và giấy phép")
    w("")
    w("> File tự sinh bởi `scripts/blender/audio/build_sfx.py` từ `data/sounds.json` — đừng sửa tay; sửa data rồi chạy lại "
      "script. `npm --prefix game run test:data` báo lỗi nếu file âm thanh trong `assets/sfx/` không có trong danh sách này.")
    w("")
    w("## Tóm tắt")
    w("")
    w(f"Game có **{len(rows)} file âm thanh** ({sum(r['bytes'] for r in rows) / 1024:.0f} KB, `assets/sfx/`), thuộc 2 loại:")
    w("")
    w(f"1. **{len(packs)} file lấy từ {len(used)} gói âm thanh của Kenney** (kenney.nl), phát hành theo giấy phép "
      "**Creative Commons CC0 1.0 Universal** — tác giả từ bỏ quyền tác giả và các quyền liên quan ở mức tối đa pháp "
      "luật cho phép, đưa tác phẩm vào phạm vi công cộng (public domain). Được dùng cho mục đích cá nhân, giáo dục và "
      "**thương mại**, được sửa đổi, phát tán, **không phải ghi công, không phải xin phép, không mất phí**. Nội dung file "
      "giấy phép trong từng gói được chép nguyên văn vào `assets/sfx/licenses/`.")
    w(f"2. **{len(synths)} file tự tạo cho dự án** bằng công thức toán (sóng sin / vuông, nhiễu, bộ lọc) trong "
      "`scripts/blender/audio/synth.py` — không dùng bản ghi hay mẫu âm thanh của bên thứ ba nào. Là sản phẩm của dự án, "
      "cùng chủ sở hữu với mã nguồn trong repo.")
    w("")
    w("Ngoài ra **tiếng nền theo zone** (gió, chim, xe cộ xa, máy lạnh, gõ phím), **tiếng máy xe bus** và **tiếng vang trong "
      "nhà** được tạo bằng code ngay lúc chơi (`game/src/core/ambience.js`, Web Audio API) — không có file, không dùng mẫu "
      "âm thanh nào.")
    w("")
    w("Không file nào dùng giấy phép có điều kiện (ghi công BY, phi thương mại NC, chia sẻ tương tự SA, không phái sinh ND) "
      "→ dùng được trong tổ chức, cả trong sản phẩm nội bộ lẫn công khai. `build_sfx.py` chỉ nhận gói có giấy phép CC0-1.0.")
    w("")
    w("**Summary (English):** all game audio is either (a) from Kenney asset packs released under the CC0 1.0 Universal "
      "public-domain dedication (free for commercial use, modification allowed, no attribution required — the original "
      "`License.txt` of each pack is kept in `assets/sfx/licenses/`), or (b) synthesized from scratch for this project by "
      "code (`scripts/blender/audio/synth.py`, no third-party recordings or samples), or (c) generated live by code in the "
      "browser (`game/src/core/ambience.js`). No file is under an attribution, non-commercial, share-alike or "
      "no-derivatives licence.")
    w("")
    w("## Giấy phép CC0 1.0")
    w("")
    w(f"- Bản tóm tắt: {LICENSE_URL['CC0-1.0']}")
    w(f"- Văn bản pháp lý đầy đủ: {LICENSE_URL['CC0-1.0']}legalcode")
    w("- Trang của mỗi gói trên kenney.nl ghi giấy phép \"Creative Commons CC0\"; file `License.txt` trong gói zip ghi "
      "\"License: (Creative Commons Zero, CC0)\" kèm link trên và câu \"free to use in personal, educational and commercial "
      "projects\" / \"You may use these assets in personal and commercial projects\"; ghi công Kenney là không bắt buộc "
      "(dự án vẫn ghi công ở đây và trong `CREDITS.md`).")
    w("- CC0 không cấp quyền nhãn hiệu hay bằng sáng chế — không liên quan ở đây: các file là tiếng động chung (bấm nút, "
      "bước chân, va chạm, đoạn nhạc ngắn), không có tên, giọng nói hay thương hiệu của ai.")
    w("")
    w("## Gói nguồn")
    w("")
    w("| Gói | Tác giả | Trang gói | Kích thước zip | SHA-256 của file zip | Ngày tải | Giấy phép (bản trong repo) |")
    w("| --- | --- | --- | --- | --- | --- | --- |")
    for p in sorted(used):
        m = sources[p]
        w(f"| {m['title']} | {m['author']} | {m['page']} | {m['zip_bytes']:,} byte | `{m['zip_sha256']}` | {m['retrieved']} "
          f"| [{m['license']}]({LICENSE_URL[m['license']]}) (`assets/sfx/licenses/{p}.txt`) |")
    w("")
    w("Link tải trực tiếp (file zip) ghi ở `data/sounds.json` → `sources.<gói>.download`. Kiểm tra lại: tải zip ở link đó, "
      "tính SHA-256, so với cột trên; SHA-256 từng file gốc ở bảng dưới so được với file cùng tên trong zip.")
    w("")
    w("## File lấy từ gói Kenney")
    w("")
    w("| File trong game | Dùng ở | Gói | File gốc trong zip | SHA-256 của file gốc |")
    w("| --- | --- | --- | --- | --- |")
    for r in packs:
        w(f"| `{r['file']}` | {r['use']} | {sources[r['pack']]['title']} | `{r['member']}` | `{r['src_sha']}` |")
    w("")
    w(f"Chỉnh sửa so với file gốc: {PROCESS}. CC0 cho phép sửa đổi tự do.")
    w("")
    w("## File tự tạo")
    w("")
    w("| File trong game | Dùng ở | Công thức (`synth.py`) | Cách tạo |")
    w("| --- | --- | --- | --- |")
    for r in synths:
        w(f"| `{r['file']}` | {r['use']} | `{r['recipe']}` | {r['doc']} |")
    w("")
    w("Tạo lại đúng từng file (nhiễu dùng hạt ngẫu nhiên cố định): chạy `build_sfx.py` (lệnh ở đầu file).")
    w("")
    w("## Tạo lúc chơi (không có file)")
    w("")
    w("| Âm thanh | Ở đâu | Cách tạo |")
    w("| --- | --- | --- |")
    w("| Tiếng nền phố sáng sớm (zone 0): xe cộ xa, xe máy chạy qua, chim | `game/src/core/ambience.js` → `street` | nhiễu nâu "
      "lọc thấp, sóng răng cưa lọc thấp trượt tần (xe máy), sóng sin quét tần (chim) |")
    w("| Tiếng nền campus (zone 1–2): gió, lá xào xạc, chim; hoàng hôn ở bến xe: dế | `ambience.js` → `campus`, `evening` | "
      "nhiễu hồng lọc dải, sóng sin quét tần, sóng sin điều biên (dế) |")
    w("| Tiếng nền trong nhà (zone 3–5): máy lạnh, gõ phím, tiếng bước chân xa | `ambience.js` → `lobby`, `corridor`, `office` | "
      "nhiễu nâu lọc thấp, chuỗi tiếng tách ngắn từ nhiễu lọc dải |")
    w("| Tiếng máy xe bus (cảnh lên / xuống xe, cảnh kết) | `ambience.js` → `Engine` | sóng răng cưa + vuông theo tốc độ xe, "
      "nhiễu lọc thấp |")
    w("| Tiếng vang trong nhà | `ambience.js` → `impulse()` | phản hồi xung tạo từ nhiễu tắt dần |")
    w("")
    w("## Thêm âm thanh mới")
    w("")
    w("1. Chỉ dùng nguồn **CC0** (vd các gói trên kenney.nl) hoặc tự tạo bằng công thức trong `synth.py`. Không dùng file "
      "CC BY / NC / SA, file \"free\" không ghi giấy phép rõ ràng, hay tiếng lấy từ game / phim / bài hát khác.")
    w("2. Gói mới: tải zip vào `assets/sfx/source/` (không đưa lên repo), khai ở `data/sounds.json` → `sources` (trang, link "
      "tải, SHA-256, kích thước, ngày tải, `license: \"CC0-1.0\"`, file giấy phép trong zip).")
    w("3. Thêm mục ở `data/sounds.json` → `sounds` (`src` hoặc `synth`, `use`: dùng ở đâu), chạy `build_sfx.py`, rồi "
      "`npm --prefix game run test:data`.")
    w("")
    with open(DOC, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))


main()
