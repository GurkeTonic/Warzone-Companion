#!/usr/bin/env python3
"""Development server for the Warzone Companion.

Serves the project directory at http://localhost:8080 with caching disabled,
so edited files are always reloaded. Stop with Ctrl+C.

Also exposes GET /api/warzone: a small proxy for the war report API on
www.eveonline.com (per-system Advantage values), which sends no CORS headers
and is therefore unreachable from browser JavaScript directly. The response
is cached in memory for a short time to keep request volume low. The
frontend treats this endpoint as optional and degrades gracefully without it.
"""
import http.server
import json
import os
import threading
import time
import urllib.request
import webbrowser

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))

WARZONE_API = "https://www.eveonline.com/api/warzone/status"
WARZONE_CACHE_SECONDS = 300

_cache_lock = threading.Lock()
_cache = {"ts": 0.0, "body": None}


def fetch_warzone_status():
    with _cache_lock:
        if _cache["body"] is not None and time.time() - _cache["ts"] < WARZONE_CACHE_SECONDS:
            return _cache["body"]
    req = urllib.request.Request(WARZONE_API, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as res:
        body = res.read()
    json.loads(body)  # validate before caching
    with _cache_lock:
        _cache["ts"] = time.time()
        _cache["body"] = body
    return body


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/api/warzone":
            self.handle_warzone()
            return
        super().do_GET()

    def handle_warzone(self):
        try:
            body = fetch_warzone_status()
            self.send_response(200)
        except Exception as err:
            body = json.dumps({"error": str(err)}).encode()
            self.send_response(502)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), DevHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"Serving {ROOT}")
        print(f"Open {url}  (Ctrl+C to stop)")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
