import argparse
import json
import mimetypes
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from physics import MechanicsError, World

WEB = Path(__file__).parent / "web"


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            return self._send(200, {"ok": True})
        target = (WEB / ("index.html" if path == "/" else path.lstrip("/"))).resolve()
        if WEB.resolve() not in target.parents or not target.is_file():
            return self._send(404, {"error": "not found"})
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self._send(200, target.read_bytes(), ctype + ("; charset=utf-8" if ctype.startswith("text") else ""))

    def do_POST(self):
        if self.path != "/api/simulate":
            return self._send(404, {"error": "not found"})
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            world = World.from_dict(data)
            self._send(200, world.simulate(t_end=float(data.get("t_end", 10)), fps=int(data.get("fps", 60))))
        except MechanicsError as e:
            self._send(400, {"error": str(e)})
        except (KeyError, ValueError, TypeError, ZeroDivisionError, OverflowError) as e:
            self._send(400, {"error": f"Invalid scene: {e}"})

    def log_message(self, fmt, *args):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()
    server = ThreadingHTTPServer((a.host, a.port), Handler)
    url = f"http://{a.host}:{a.port}"
    print(f"Mechanics Lab running at {url}  (Ctrl+C to stop)")
    if not a.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
