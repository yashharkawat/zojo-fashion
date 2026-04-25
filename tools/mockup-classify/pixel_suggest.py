#!/usr/bin/env python3
"""
Fast, reliable mockup classification using pixel color sampling.
NO machine learning required — just Pillow (standard library colorsys).

Face:   ordering by file number (first half = backs, second half = fronts).
Color:  sample pixels from the shirt sleeves / sides (x 10-28% and 72-90%),
        convert to HSV, match supplier color by hue-aware distance.

Usage (from repo root):
  python3 tools/mockup-classify/pixel_suggest.py buddha-mockups
  python3 tools/mockup-classify/pixel_suggest.py zoro-mockups
"""
from __future__ import annotations

import colorsys
import json
import math
import re
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).resolve().parent / "catalog-manifest.json"
DEFAULT_MOCKUP_ROOT = REPO_ROOT / "images-mockups-webp"


# ─── Supplier color palette ────────────────────────────────────────────────
# Reference RGBs are ideal swatch values; matching uses HSV hue for accuracy.

SUPPLIER_COLORS: list[dict] = [
    {"name": "White",           "slug": "white",           "rgb": (255, 255, 255)},
    {"name": "Off White",       "slug": "off-white",       "rgb": (255, 250, 231)},
    {"name": "Grey Melange",    "slug": "grey-melange",    "rgb": (195, 195, 195)},
    {"name": "Black",           "slug": "black",           "rgb": ( 21,  21,  21)},
    {"name": "Navy Blue",       "slug": "navy-blue",       "rgb": (  0,  11,  23)},
    {"name": "Royal Blue",      "slug": "royal-blue",      "rgb": ( 20,  28,  79)},
    {"name": "Petrol Blue",     "slug": "petrol-blue",     "rgb": ( 10,  43,  48)},
    {"name": "Baby Blue",       "slug": "baby-blue",       "rgb": (171, 235, 255)},
    {"name": "Bottle Green",    "slug": "bottle-green",    "rgb": (  8,  55,  23)},
    {"name": "Olive Green",     "slug": "olive-green",     "rgb": ( 38,  38,  10)},
    {"name": "Mint",            "slug": "mint",            "rgb": (173, 255, 240)},
    {"name": "Mustard Yellow",  "slug": "mustard-yellow",  "rgb": (182, 132,  13)},
    {"name": "Golden Yellow",   "slug": "golden-yellow",   "rgb": (255, 162,   0)},
    {"name": "Red",             "slug": "red",             "rgb": (144,   0,   1)},
    {"name": "Coral",           "slug": "coral",           "rgb": (179,  73,  70)},
    {"name": "Maroon",          "slug": "maroon",          "rgb": ( 41,   0,   5)},
    {"name": "Purple",          "slug": "purple",          "rgb": ( 39,  16,  51)},
    {"name": "Lavender",        "slug": "lavender",        "rgb": (224, 210, 252)},
    {"name": "Light Baby Pink", "slug": "light-baby-pink", "rgb": (255, 212, 233)},
]


def rgb_to_hsv(rgb: tuple) -> tuple[float, float, float]:
    r, g, b = rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0
    return colorsys.rgb_to_hsv(r, g, b)


def hue_diff(h1: float, h2: float) -> float:
    """Circular hue difference, 0–0.5 (both in [0,1] range)."""
    d = abs(h1 - h2)
    return min(d, 1.0 - d)


def color_distance(sampled_rgb: tuple, ref_rgb: tuple) -> float:
    """
    Hue-aware color distance:
    - For saturated colors: weight hue heavily (hue angle is very reliable).
    - For low-saturation colors (white, grey, pastels): fall back to RGB distance.
    """
    hs, ss, vs = rgb_to_hsv(sampled_rgb)
    hr, sr, vr = rgb_to_hsv(ref_rgb)

    # Low-saturation on either side → use plain RGB (hue is meaningless on grey/white)
    if ss < 0.12 or sr < 0.12:
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(sampled_rgb, ref_rgb)))

    # Saturated colors: hue dominates
    hd = hue_diff(hs, hr) * 360  # convert to degrees for readability
    sd = abs(ss - sr) * 100
    vd = abs(vs - vr) * 100
    return hd * 2.5 + sd * 0.4 + vd * 0.3


def nearest_color(rgb: tuple) -> tuple[dict, float]:
    """Return (best_match, raw_distance)."""
    scored = [(color_distance(rgb, c["rgb"]), c) for c in SUPPLIER_COLORS]
    scored.sort(key=lambda x: x[0])
    return scored[0][1], scored[0][0]


def second_nearest_color(rgb: tuple, exclude_slug: str) -> dict:
    scored = [(color_distance(rgb, c["rgb"]), c) for c in SUPPLIER_COLORS if c["slug"] != exclude_slug]
    scored.sort(key=lambda x: x[0])
    return scored[0][1]


def confidence(rgb: tuple, best: dict) -> float:
    """0–1 where 1 = unambiguous match, 0 = equally close to all."""
    dists = [color_distance(rgb, c["rgb"]) for c in SUPPLIER_COLORS]
    best_d = color_distance(rgb, best["rgb"])
    max_d = max(dists) if max(dists) > 0 else 1
    return round(1.0 - best_d / max_d, 3)


def sample_shirt_color(img: Image.Image) -> tuple[int, int, int]:
    """
    Sample pixels from the shirt sleeves/sides (away from the centre graphic).
    The t-shirt starts at ~10% from each edge; the print is in the centre ~35–65%.

    Zones:
      Left side:  x 10–28%, y 35–65%
      Right side: x 72–90%, y 35–65%
      Hem:        x 25–75%, y 80–90%

    Returns the median RGB of all sampled pixels (includes near-white for
    white/off-white shirts).
    """
    img_rgb = img.convert("RGB")
    w, h = img_rgb.size
    pixels = img_rgb.load()

    zones = [
        (int(w * 0.10), int(w * 0.28), int(h * 0.35), int(h * 0.65)),  # left sleeve/side
        (int(w * 0.72), int(w * 0.90), int(h * 0.35), int(h * 0.65)),  # right sleeve/side
        (int(w * 0.25), int(w * 0.75), int(h * 0.80), int(h * 0.90)),  # hem
    ]

    rs, gs, bs = [], [], []
    for x0, x1, y0, y1 in zones:
        for x in range(x0, x1, 3):
            for y in range(y0, y1, 3):
                if 0 <= x < w and 0 <= y < h:
                    r, g, b = pixels[x, y]
                    # Only exclude the pure near-white BACKGROUND pixels that appear
                    # at the very outer edges. Inside our zones, near-white = white shirt.
                    # A rough heuristic: skip only if it's a completely flat grey
                    # (r ≈ g ≈ b) AND above 240 — that's the background, not fabric.
                    is_flat_grey = abs(r - g) < 6 and abs(g - b) < 6 and r > 240
                    if not is_flat_grey:
                        rs.append(r)
                        gs.append(g)
                        bs.append(b)

    if not rs:
        # Fallback: entire image, skip only pure-flat-grey pixels
        for x in range(0, w, 5):
            for y in range(0, h, 5):
                if 0 <= x < w and 0 <= y < h:
                    r, g, b = pixels[x, y]
                    if not (abs(r - g) < 6 and abs(g - b) < 6 and r > 240):
                        rs.append(r); gs.append(g); bs.append(b)

    if not rs:
        return (250, 250, 250)  # treat as white

    def median(lst: list) -> int:
        s = sorted(lst)
        return s[len(s) // 2]

    return (median(rs), median(gs), median(bs))


def numeric_key(p: Path) -> int:
    m = re.match(r"(\d+)", p.stem)
    return int(m.group(1)) if m else 0


def main() -> None:
    import argparse

    p = argparse.ArgumentParser(description="Pixel-based mockup classification (no ML)")
    p.add_argument("folder", help="Subfolder of images-mockups-webp, e.g. buddha-mockups")
    p.add_argument("--root", type=Path, default=DEFAULT_MOCKUP_ROOT)
    args = p.parse_args()

    root: Path = args.root
    sub = root / args.folder
    if not sub.is_dir():
        print(f"Not a directory: {sub}", file=sys.stderr)
        sys.exit(1)

    webps = sorted(
        (f for f in sub.iterdir() if f.suffix.lower() == ".webp"),
        key=numeric_key,
    )
    if not webps:
        print(f"No .webp files in {sub}", file=sys.stderr)
        sys.exit(1)

    n = len(webps)
    n_backs = n // 2
    print(f"{n} images → {n_backs} backs + {n - n_backs} fronts\n")

    # ── Step 1: sample each image ─────────────────────────────────────────
    items: list[dict] = []
    for i, path in enumerate(webps):
        face = "back" if i < n_backs else "front"
        im = Image.open(path)
        rgb = sample_shirt_color(im)
        h, s, v = rgb_to_hsv(rgb)
        best, dist = nearest_color(rgb)
        conf = confidence(rgb, best)
        items.append({
            "file": path.name,
            "face": face,
            "face_conf": 1.0,
            "face_source": "ordering",
            "color": best["name"],
            "color_slug": best["slug"],
            "color_conf": conf,
            "sampled_rgb": list(rgb),
            "_hue_deg": round(h * 360, 1),
            "_sat": round(s, 3),
        })
        print(
            f"  {path.name:12s}  {face:5s}  {best['name']:18s}"
            f"  hue={h*360:5.1f}°  sat={s:.2f}  conf={conf:.2f}  rgb={rgb}"
        )

    # ── Step 2: pair enforcement (back i ↔ front i) ───────────────────────
    backs = [it for it in items if it["face"] == "back"]
    fronts = [it for it in items if it["face"] == "front"]
    print("\nPair enforcement:")
    for i, (b, f) in enumerate(zip(backs, fronts)):
        if b["color_slug"] != f["color_slug"]:
            # Merge the two sampled RGBs and re-match
            merged = tuple(
                (a + c) // 2 for a, c in zip(b["sampled_rgb"], f["sampled_rgb"])
            )
            winner, _ = nearest_color(merged)
            conf = confidence(merged, winner)
            print(
                f"  pair {i}: back={b['file']} {b['color']} vs front={f['file']} {f['color']}"
                f" → merged rgb={merged} → {winner['name']} (conf={conf:.2f})"
            )
            for item in (b, f):
                item["color"] = winner["name"]
                item["color_slug"] = winner["slug"]
                item["color_conf"] = conf
                item["pair_resolved"] = True
        else:
            print(f"  pair {i}: {b['file']} + {f['file']} → {b['color']} ✓")

    # ── Step 3: deduplication across pairs ───────────────────────────────
    # If two different pairs ended up with the same color, reassign the
    # less-confident pair to its second-nearest color.
    print("\nDeduplication:")
    seen: dict[str, int] = {}  # slug → pair index
    for i, b in enumerate(backs):
        slug = b["color_slug"]
        if slug in seen:
            prev_i = seen[slug]
            prev_b = backs[prev_i]
            # Reassign the pair with lower confidence to second-best
            if b["color_conf"] <= prev_b["color_conf"]:
                loser_i, loser_b, loser_f = i, b, fronts[i]
            else:
                loser_i, loser_b, loser_f = prev_i, prev_b, fronts[prev_i]

            merged_rgb = tuple(
                (a + c) // 2 for a, c in zip(loser_b["sampled_rgb"], loser_f["sampled_rgb"])
            )
            second = second_nearest_color(merged_rgb, slug)
            conf = confidence(merged_rgb, second)
            print(
                f"  [duplicate] '{slug}' used twice. "
                f"Reassigning pair {loser_i} ({loser_b['file']}) → {second['name']} (conf={conf:.2f})"
            )
            print(f"    NOTE: If this is wrong, edit suggestions.json manually before running update:images")
            for item in (loser_b, loser_f):
                item["color"] = second["name"]
                item["color_slug"] = second["slug"]
                item["color_conf"] = conf
                item["dedup_reassigned"] = True
            seen[second["slug"]] = loser_i
        else:
            seen[slug] = i
            print(f"  pair {i}: {slug} ✓")

    # ── Step 4: write suggestions.json ────────────────────────────────────
    # Strip internal debug keys before saving
    for it in items:
        it.pop("_hue_deg", None)
        it.pop("_sat", None)

    out_path = sub / "suggestions.json"
    payload = {
        "method": "pixel",
        "folder": args.folder,
        "use_ordering": True,
        "items": items,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"\nWrote {out_path} ({len(items)} images).")
    print("Review the dedup warnings above, then run:")
    print(f"  cd apps/api && npm run update:images -- ../../images-mockups-webp/{args.folder}/suggestions.json")


if __name__ == "__main__":
    main()
