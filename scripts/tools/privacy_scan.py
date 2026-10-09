"""Quét các file git sẽ đưa lên (đã stage / đang theo dõi) tìm thông tin không được công khai.

Chạy: python scripts/tools/privacy_scan.py [--worktree dist]   (mặc định: repo ở thư mục gốc dự án)
Tìm: email, đường dẫn ổ đĩa (chữ ổ đĩa + dấu hai chấm + gạch chéo), thư mục người dùng, token/khoá bí mật,
đường dẫn máy nhúng trong metadata ảnh/GLB, file lớn hơn 20 MB, file thuộc loại bị cấm (FBX, .blend, .raw.glb, thư mục source/, mixamo/, references/ gốc, renders/).
Thoát với mã 1 nếu có phát hiện — dùng trước mỗi commit (scripts/deploy_site.py gọi tự động).
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SELF = "scripts/tools/privacy_scan.py"
MAX_MB = 20
BINARY = (".glb", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2", ".ico")
PATTERNS = {
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]{2,}"),
    "drive_path": re.compile(r"(?<![A-Za-z])[A-Za-z]:[\\/](?![/\\])"),
    "user_dir": re.compile(r"[\\/]Users[\\/]|AppData|OneDrive", re.I),
    "token": re.compile(r"ghp_[A-Za-z0-9]{20,}|github_pat_|\bsk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-"
                        r"|BEGIN [A-Z ]*PRIVATE KEY|(?i:(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['\"][^'\"]{8,})"),
}
# đường dẫn thư mục người dùng nhúng trong file nhị phân (PNG tEXt, GLB extras…)
BINARY_PATH = re.compile(rb"[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][ -~]{0,40}|/home/[a-z_][a-z0-9_-]{1,30}/")
BLOCKED_EXT = (".fbx", ".blend", ".blend1", ".raw.glb", ".mp4", ".mov")
BLOCKED_DIRS = {"source", "mixamo", "renders"}
# email được phép (vd tác giả noreply của GitHub) — không có mặc định
ALLOWED = set()


def scan(repo):
    files = subprocess.run(["git", "-C", str(repo), "ls-files", "-z"], capture_output=True, check=True).stdout
    files = [f for f in files.decode("utf-8").split("\0") if f]
    found = []
    for f in files:
        p = repo / f
        if not p.exists():
            continue
        low = f.lower()
        parts = set(f.split("/")[:-1])
        if low.endswith(BLOCKED_EXT) or (BLOCKED_DIRS & parts and not low.endswith("mixamo/actions.json")):
            found.append(("blocked", f, 0, f))
        if p.stat().st_size > MAX_MB * 1024 * 1024:
            found.append(("too_big", f, 0, f"{p.stat().st_size / 1024 / 1024:.1f} MB"))
        if f.startswith("references/") and not (low.endswith(".md") or "palette" in low):
            found.append(("reference_raw", f, 0, f))
        if low.endswith(BINARY):
            # ảnh/GLB: metadata nhúng (vd Blender ghi đường dẫn file vào chunk tEXt của PNG)
            m = BINARY_PATH.search(p.read_bytes())
            if m:
                found.append(("binary_meta", f, 0, m.group(0).decode("latin-1")))
            continue
        if f == SELF:   # chính file này chứa các mẫu tìm
            continue
        try:
            txt = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for name, pat in PATTERNS.items():
            for m in pat.finditer(txt):
                if m.group(0) in ALLOWED:
                    continue
                line = txt.count("\n", 0, m.start()) + 1
                found.append((name, f, line, txt.splitlines()[line - 1].strip()[:140]))
    return files, found


def main():
    repo = ROOT / sys.argv[sys.argv.index("--worktree") + 1] if "--worktree" in sys.argv else ROOT
    files, found = scan(repo)
    for kind, f, line, text in found:
        print(f"{kind:13s} {f}:{line}: {text}")
    print(f"{len(files)} file, {len(found)} phát hiện")
    sys.exit(1 if found else 0)


if __name__ == "__main__":
    main()
