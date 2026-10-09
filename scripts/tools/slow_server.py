"""Server tĩnh có độ trễ giả lập mạng — đo thời gian mở game / chuyển zone gần giống GitHub Pages (mỗi file ~0,3 s).

Chạy:  python scripts/tools/slow_server.py --dir game/dist --port 8771 [--delay 0.3]
Trả header Cache-Control: max-age=600 như GitHub Pages để bộ nhớ đệm HTTP của trình duyệt hoạt động giống bản thật.
Chỉ dùng để đo trên máy làm việc, không thay cho `npm run dev`.
"""
import argparse
import functools
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SlowHandler(SimpleHTTPRequestHandler):
    delay = 0.3

    def end_headers(self):
        self.send_header("Cache-Control", "max-age=600")
        super().end_headers()

    def do_GET(self):
        time.sleep(self.delay)
        super().do_GET()

    def do_HEAD(self):
        time.sleep(self.delay)
        super().do_HEAD()

    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="game/dist")
    ap.add_argument("--port", type=int, default=8771)
    ap.add_argument("--delay", type=float, default=0.3)
    a = ap.parse_args()
    SlowHandler.delay = a.delay
    SlowHandler.extensions_map[".glb"] = "model/gltf-binary"
    SlowHandler.extensions_map[".wasm"] = "application/wasm"
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), functools.partial(SlowHandler, directory=a.dir))
    print(f"http://127.0.0.1:{a.port}/  ({a.dir}, trễ {a.delay} s/file)", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
