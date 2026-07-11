#!/usr/bin/env python3
"""Development server for the Theatres of War companion.

Serves the project directory at http://localhost:8080 with caching disabled,
so edited files are always reloaded. Stop with Ctrl+C.
"""
import http.server
import os
import webbrowser

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


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
