#!/usr/bin/env python3
"""Local HTTP server for the labeler (avoids file:// CORS). From repo root:
   python3 tools/mockup-classify/serve.py
   Open http://127.0.0.1:8765/
"""
from __future__ import annotations

import http.client
import json
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MOCK = REPO / "images-mockups-webp"
TOOL = Path(__file__).resolve().parent
MOCK_RESOLVED = MOCK.resolve()
PORT = 8765

MIME = {
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".ico": "image/x-icon",
}


def safe_mock_path(rel: str) -> Path | None:
    if ".." in rel or rel.startswith("/"):
        return None
    p = (MOCK / rel).resolve()
    try:
        p.relative_to(MOCK_RESOLVED)
    except ValueError:
        return None
    return p if p.is_file() else None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def do_POST(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/save-apply":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                folder = data.get("product", "")
                if not folder or ".." in folder:
                    raise ValueError("missing or unsafe product field")
                dest_dir = (MOCK / folder).resolve()
                if not str(dest_dir).startswith(str(MOCK_RESOLVED)):
                    raise ValueError("path escape")
                if not dest_dir.is_dir():
                    raise ValueError(f"folder not found: {folder}")
                out = dest_dir / "apply.json"
                out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
                resp = json.dumps({"saved": str(out)}).encode("utf-8")
                print(f"  [save-apply] wrote {out}")
            except Exception as exc:
                resp = json.dumps({"error": str(exc)}).encode("utf-8")
                self.send_response(http.client.BAD_REQUEST)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return
            self.send_response(http.client.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return
        self.send_error(http.client.NOT_FOUND)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path in ("/", "/labeler.html"):
            return self._send_file(TOOL / "labeler.html", "text/html; charset=utf-8")
        if path == "/catalog-manifest.json":
            return self._send_file(TOOL / "catalog-manifest.json", "application/json; charset=utf-8")
        if path.startswith("/list-mockups/"):
            rel = urllib.parse.unquote(path.removeprefix("/list-mockups/").lstrip("/")).strip("/")
            d = (MOCK / rel).resolve() if rel and ".." not in rel else None
            if not d or not d.is_dir() or not str(d).startswith(str(MOCK_RESOLVED)):
                self.send_error(http.client.NOT_FOUND)
                return
            files = sorted(
                f.name
                for f in d.iterdir()
                if f.is_file() and f.suffix.lower() == ".webp" and f.name != "suggestions.json"
            )
            body = json.dumps({"folder": rel, "files": files}, indent=2).encode("utf-8")
            self.send_response(http.client.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path.startswith("/mockups/"):
            rel = urllib.parse.unquote(path.removeprefix("/mockups/").lstrip("/"))
            p = safe_mock_path(rel)
            if not p:
                self.send_error(http.client.NOT_FOUND)
                return
            return self._send_file(p, MIME.get(p.suffix.lower(), "application/octet-stream"))
        self.send_error(http.client.NOT_FOUND)

    def _send_file(self, fpath: Path, ctype: str) -> None:
        if not fpath.is_file():
            self.send_error(http.client.NOT_FOUND)
            return
        data = fpath.read_bytes()
        self.send_response(http.client.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(http.client.NO_CONTENT)
        self.end_headers()


def main() -> None:
    if not MOCK.is_dir():
        print(f"Warning: {MOCK} missing — create or symlink images-mockups-webp.\n")
    with ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Serving labeler: http://127.0.0.1:{PORT}/")
        print("Mockups URL prefix: /mockups/<folder>/...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
