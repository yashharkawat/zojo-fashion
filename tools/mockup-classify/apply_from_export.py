#!/usr/bin/env python3
"""
Apply a JSON export from the labeler: copies each source .webp into
{productRoot}/{color_slug}/{face}.webp. Run after Phases B+C when not using
Chrome directory writes.

Usage:
  python3 apply_from_export.py path/to/apply.json

JSON shape (see labeler "Download apply JSON"):
  {
    "sourceRoot": "/abs/path/images-mockups-webp",
    "product": "buddha-mockups",
    "assignments": { "110.webp": { "face": "front", "slug": "forest" } }
  }
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("json_path", type=Path)
    p.add_argument(
        "--root",
        type=Path,
        help="Override images-mockups-webp path (else JSON sourceRoot, else repo default)",
    )
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    with open(args.json_path, encoding="utf-8") as f:
        data = json.load(f)

    if args.root:
        root = args.root.resolve()
    elif data.get("sourceRoot"):
        root = Path(data["sourceRoot"]).resolve()
    else:
        root = (Path(__file__).resolve().parents[2] / "images-mockups-webp").resolve()
    product = data["product"]
    sub = root / product
    if not sub.is_dir():
        print(f"Not a directory: {sub}", file=sys.stderr)
        sys.exit(1)
    ass = data["assignments"]
    for fname, a in ass.items():
        src = sub / fname
        if not src.is_file():
            print(f"Skip missing: {src}", file=sys.stderr)
            continue
        face = a["face"]
        slug = a["slug"]
        if face not in ("front", "back"):
            print(f"Bad face for {fname}: {face}", file=sys.stderr)
            continue
        dest = sub / slug / f"{face}.webp"
        if args.dry_run:
            print(f"copy {src} -> {dest}")
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            print(dest)

    audit = sub / "applied.log"
    if not args.dry_run:
        audit.write_text(
            json.dumps({"applied_from": str(args.json_path), "count": len(ass)}, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {audit}")


if __name__ == "__main__":
    main()
