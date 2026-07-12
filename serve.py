#!/usr/bin/env python3
"""Development server for the Warzone Companion.

Serves the project directory at http://localhost:8080 with caching disabled,
so edited files are always reloaded. Stop with Ctrl+C.

Also exposes small proxies for the war report APIs on www.eveonline.com
(per-system Advantage and pirate insurgency state), which send no CORS
headers and are therefore unreachable from browser JavaScript directly.
Responses are cached in memory for a short time to keep request volume low.
The frontend treats these endpoints as optional and degrades gracefully.
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

PROXIES = {
    "/api/warzone": "https://www.eveonline.com/api/warzone/status",
    "/api/insurgency": "https://www.eveonline.com/api/warzone/insurgency",
}
PROXY_CACHE_SECONDS = 300
USER_AGENT = "WarzoneCompanion/0.4 (webmaster@tonicbeacon.com; +https://github.com/GurkeTonic/Warzone-Companion)"

_cache_lock = threading.Lock()
_cache = {}  # path -> {"ts": float, "body": bytes}


def fetch_proxied(path):
    with _cache_lock:
        entry = _cache.get(path)
        if entry and time.time() - entry["ts"] < PROXY_CACHE_SECONDS:
            return entry["body"]
    req = urllib.request.Request(
        PROXIES[path],
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        body = res.read()
    json.loads(body)  # validate before caching
    with _cache_lock:
        _cache[path] = {"ts": time.time(), "body": body}
    return body


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in PROXIES:
            self.handle_proxy(path)
            return
        super().do_GET()

    def handle_proxy(self, path):
        try:
            body = fetch_proxied(path)
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
