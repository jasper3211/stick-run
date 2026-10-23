"""Local dev server for Stick Run that disables browser caching.

python3 serve.py [port]   (default 8080)

The stock `python3 -m http.server` sends no Cache-Control header, so browsers keep
running stale JavaScript modules after the files change. This adds `no-cache`.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(NoCacheHandler, directory=str(Path(__file__).parent))
    print(f"Stick Run on http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), handler).serve_forever()
