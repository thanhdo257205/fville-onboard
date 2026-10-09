"""Cắt khung hình từ video tham chiếu + tạo contact sheet.

Mỗi video -> references/frames/<tên_video>/
  t_<giây>.jpg : 1 khung / INTERVAL giây (đoạn quay chậm)
  s_<giây>.jpg : khung lúc chuyển cảnh (scene detection)
  contact_XX.jpg : ảnh ghép xem nhanh, có nhãn thời gian

Chạy: python scripts/tools/extract_frames.py [tên_video ...]
"""
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FFMPEG = ROOT / "tools" / "bin" / "ffmpeg.exe"
VIDEOS = ROOT / "references" / "videos"
FRAMES = ROOT / "references" / "frames"

INTERVAL = 2.0        # giây giữa 2 khung đều
SCENE_THRESHOLD = 0.3
MAX_WIDTH = 1280      # khung lưu tối đa rộng 1280 px
THUMB_W = 360
COLS, ROWS = 5, 6

# Video quay dọc nhưng không có metadata xoay: tên video -> (filter xoay, xoay từ giây thứ mấy)
# transpose=1: xoay 90° theo chiều kim đồng hồ
ROTATE = {"LoiDi": ("transpose=1", 1.0)}


def run(args):
    return subprocess.run([str(FFMPEG), "-hide_banner", *args],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")


def duration(video):
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", run(["-i", str(video)]).stderr)
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def scene_times(video):
    out = run(["-i", str(video), "-an", "-vf",
               f"scale=320:-2,select='gt(scene,{SCENE_THRESHOLD})',showinfo",
               "-f", "null", "-"]).stderr
    return [float(t) for t in re.findall(r"pts_time:([\d.]+)", out)]


def grab(video, t, dst):
    vf = f"scale='if(gt(iw,ih),min({MAX_WIDTH},iw),-2)':'if(gt(iw,ih),-2,min({MAX_WIDTH},ih))'"
    rot = ROTATE.get(video.stem)
    if rot and t >= rot[1]:
        vf = f"{rot[0]},{vf}"
    run(["-y", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
         "-vf", vf, "-q:v", "3", str(dst)])


def contact_sheets(frames, out_dir):
    font = ImageFont.load_default(size=20)
    per_page = COLS * ROWS
    for p in range(0, len(frames), per_page):
        page = frames[p:p + per_page]
        thumbs = []
        for f in page:
            im = Image.open(f)
            im.thumbnail((THUMB_W, THUMB_W))
            thumbs.append((f, im))
        cell_h = max(im.height for _, im in thumbs)
        rows = (len(thumbs) + COLS - 1) // COLS
        sheet = Image.new("RGB", (COLS * THUMB_W, rows * cell_h), "black")
        draw = ImageDraw.Draw(sheet)
        for i, (f, im) in enumerate(thumbs):
            x, y = (i % COLS) * THUMB_W, (i // COLS) * cell_h
            sheet.paste(im, (x + (THUMB_W - im.width) // 2, y))
            label = f.stem  # vd t_0012.0 / s_0034.7
            draw.rectangle([x, y, x + 9 + 11 * len(label), y + 26], fill="black")
            draw.text((x + 4, y + 2), label, fill="yellow", font=font)
        sheet.save(out_dir / f"contact_{p // per_page + 1:02d}.jpg", quality=85)


def process(video):
    out_dir = FRAMES / video.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    dur = duration(video)
    times = [("t", i * INTERVAL) for i in range(int(dur // INTERVAL) + 1) if i * INTERVAL < dur - 0.1]
    scenes = scene_times(video)
    # bỏ khung chuyển cảnh trùng (<0.5 s) với khung đều
    times += [("s", t) for t in scenes if all(abs(t - u) > 0.5 for _, u in times)]
    times.sort(key=lambda x: x[1])
    files = []
    for kind, t in times:
        dst = out_dir / f"{kind}_{t:06.1f}.jpg"
        if not dst.exists():
            grab(video, t, dst)
        if dst.exists():
            files.append(dst)
    contact_sheets(files, out_dir)
    print(f"{video.name}: {dur:.1f}s, {len(scenes)} chuyển cảnh, {len(files)} khung -> {out_dir.relative_to(ROOT)}")


if __name__ == "__main__":
    names = sys.argv[1:]
    for v in sorted(VIDEOS.glob("*.mp4")):
        if not names or v.stem in names:
            process(v)
