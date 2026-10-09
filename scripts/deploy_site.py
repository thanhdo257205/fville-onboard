"""Đưa bản web mới lên GitHub Pages (nhánh gh-pages): build → quét riêng tư → commit → push.

Chạy:  python scripts/deploy_site.py [--no-build] [--no-push] [-m "thông điệp commit"]
  --no-build  dùng game/dist có sẵn (không chạy npm run build)
  --no-push   chỉ build + commit trong dist/, không push

Các bước:
  1. scripts/make_site.py: build game, gom game + viewer + GLB vào dist/ (git worktree của nhánh gh-pages)
  2. git add -A trong dist/, rồi scripts/tools/privacy_scan.py --worktree dist (email, đường dẫn máy, token,
     metadata ảnh, file > 20 MB, FBX/.blend/source/mixamo) — có phát hiện thì bỏ stage và dừng
  3. commit bằng danh tính noreply của repo (từ chối nếu git user.email không phải @users.noreply.github.com)
  4. git push origin gh-pages

Chỉ chạy khi người dùng đồng ý đưa bản mới lên mạng. Nhánh main (mã nguồn) commit/push riêng ở thư mục gốc.
"""
import datetime
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
NOREPLY = "@users.noreply.github.com"


def git(*args, cwd=DIST, check=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit(f"DỪNG: git {' '.join(args)} lỗi")
    return r.stdout.strip()


def main():
    args = sys.argv[1:]
    msg = args[args.index("-m") + 1] if "-m" in args else None

    email = git("config", "user.email")
    if not email.endswith(NOREPLY):
        raise SystemExit(f"DỪNG: git user.email = '{email}' — repo phải dùng email noreply của GitHub (git config user.email)")

    build = [sys.executable, str(ROOT / "scripts" / "make_site.py")] + (["--no-build"] if "--no-build" in args else [])
    r = subprocess.run(build, cwd=ROOT)
    if r.returncode != 0:
        raise SystemExit("DỪNG: make_site.py lỗi")

    git("add", "-A")
    if not git("status", "--porcelain"):
        print("Bản build không đổi — không có gì để commit.")
        return
    scan = subprocess.run([sys.executable, str(ROOT / "scripts" / "tools" / "privacy_scan.py"), "--worktree", "dist"],
                          cwd=ROOT)
    if scan.returncode != 0:
        git("reset", "-q")
        raise SystemExit("DỪNG: quét riêng tư có phát hiện (xem trên) — chưa commit")

    src = git("rev-parse", "--short", "HEAD", cwd=ROOT)
    msg = msg or f"Site: build {datetime.date.today():%Y-%m-%d} từ main {src}"
    git("commit", "-q", "-m", msg)
    print(git("log", "--oneline", "-1"))
    print(git("diff", "--stat", "HEAD~1", "HEAD", check=False).splitlines()[-1:])
    if "--no-push" in args:
        print("Đã commit trong dist/ (gh-pages), chưa push (--no-push).")
        return
    r = subprocess.run(["git", "push", "origin", "gh-pages"], cwd=DIST)
    if r.returncode != 0:
        raise SystemExit("DỪNG: push gh-pages lỗi")
    print("Đã push gh-pages → https://thanhdo257205.github.io/fville-onboard/")


if __name__ == "__main__":
    main()
