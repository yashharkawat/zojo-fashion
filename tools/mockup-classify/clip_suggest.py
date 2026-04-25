#!/usr/bin/env python3
"""
Phase B: score each .webp in a product folder with OpenCLIP.
Writes suggestions.json next to the images. CPU is fine; first run downloads model weights.

Front/back modes
  default         Use CLIP similarity (struggles when both sides have graphic prints).
  --use-ordering  Derive face from file-number position: first N//2 files (sorted numerically)
                  are backs, rest are fronts. Reliable when the mockup tool exports in that order.
                  Use this when CLIP gives uniform ~1.0 front confidence.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import torch
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).resolve().parent / "catalog-manifest.json"
DEFAULT_MOCKUP_ROOT = REPO_ROOT / "images-mockups-webp"

FACE_PROMPTS = (
    "a front view of a t-shirt with a large graphic print or artwork on the chest",
    "the back of a plain t-shirt showing no large print, only blank fabric and a small neck label",
)


def color_prompts_for_display(names: list[str]) -> list[str]:
    """Generate CLIP text prompts for each color name."""
    out: list[str] = []
    for n in names:
        out.append(f"a {n.lower()} colored t-shirt fabric")
    return out


def load_manifest() -> dict:
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def colors_for_folder(manifest: dict, folder: str) -> list[dict]:
    meta = manifest["productFolders"].get(folder)
    if not meta:
        print(f"Unknown folder '{folder}'. Add it to catalog-manifest.json productFolders.", file=sys.stderr)
        sys.exit(1)
    preset = meta["colorPreset"]
    return list(manifest["colorPresets"][preset])


def numeric_key(p: Path) -> int:
    """Sort by leading integer in filename so 99 < 100 < 101."""
    m = re.match(r"(\d+)", p.stem)
    return int(m.group(1)) if m else 0


def face_from_ordering(webps: list[Path]) -> dict[str, str]:
    """First half (by numeric sort) = backs, second half = fronts."""
    n = len(webps)
    n_backs = n // 2
    result: dict[str, str] = {}
    for i, p in enumerate(webps):
        result[p.name] = "back" if i < n_backs else "front"
    return result


def main() -> None:
    p = argparse.ArgumentParser(description="OpenCLIP suggestions for mockup images")
    p.add_argument("folder", help="Subfolder of images-mockups-webp, e.g. buddha-mockups")
    p.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_MOCKUP_ROOT,
        help=f"Path to images-mockups-webp (default: {DEFAULT_MOCKUP_ROOT})",
    )
    p.add_argument(
        "--model",
        default="ViT-B-32",
        help="OpenCLIP model name (default ViT-B-32)",
    )
    p.add_argument(
        "--pretrained",
        default="laion2b_s34b_b79k",
        help="OpenCLIP pretrained tag",
    )
    p.add_argument(
        "--use-ordering",
        action="store_true",
        help=(
            "Determine front/back from file-number position (first N//2 = backs) instead of CLIP. "
            "Use when CLIP always predicts front with high confidence."
        ),
    )
    args = p.parse_args()

    root: Path = args.root
    sub = root / args.folder
    if not sub.is_dir():
        print(f"Not a directory: {sub}", file=sys.stderr)
        sys.exit(1)

    manifest = load_manifest()
    color_rows = colors_for_folder(manifest, args.folder)
    color_names = [c["name"] for c in color_rows]
    color_slugs = [c["slug"] for c in color_rows]

    import open_clip

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms(
        args.model, pretrained=args.pretrained, device=device
    )
    model.eval()
    tokenizer = open_clip.get_tokenizer(args.model)

    color_text_list = color_prompts_for_display(color_names)
    with torch.no_grad():
        face_tokens = tokenizer(list(FACE_PROMPTS)).to(device)
        face_text = model.encode_text(face_tokens)
        face_text = face_text / face_text.norm(dim=-1, keepdim=True)
        col_tokens = tokenizer(color_text_list).to(device)
        col_text = model.encode_text(col_tokens)
        col_text = col_text / col_text.norm(dim=-1, keepdim=True)

    webps = sorted(
        (f for f in sub.iterdir() if f.suffix.lower() == ".webp" and f.name != "suggestions.json"),
        key=numeric_key,
    )
    if not webps:
        print(f"No .webp files in {sub}", file=sys.stderr)
        sys.exit(1)

    ordering_map: dict[str, str] = {}
    if args.use_ordering:
        ordering_map = face_from_ordering(webps)
        n_backs = sum(1 for v in ordering_map.values() if v == "back")
        n_fronts = len(webps) - n_backs
        print(f"Ordering mode: {n_backs} backs, {n_fronts} fronts (total {len(webps)} files).")

    items: list[dict] = []
    for img_path in webps:
        im = Image.open(img_path).convert("RGB")
        with torch.no_grad():
            t = preprocess(im).unsqueeze(0).to(device)
            image_features = model.encode_image(t)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            face_logits = 100.0 * (image_features @ face_text.T)
            col_logits = 100.0 * (image_features @ col_text.T)
            face_probs = face_logits.softmax(dim=-1).squeeze(0).cpu().tolist()
            color_probs = col_logits.softmax(dim=-1).squeeze(0).cpu().tolist()

        front_i, back_i = 0, 1
        clip_face = "front" if face_probs[front_i] >= face_probs[back_i] else "back"
        clip_face_conf = float(face_probs[front_i] if clip_face == "front" else face_probs[back_i])

        if args.use_ordering:
            face = ordering_map[img_path.name]
            face_conf = 1.0
            face_source = "ordering"
        else:
            face = clip_face
            face_conf = clip_face_conf
            face_source = "clip"

        best_ci = max(range(len(color_names)), key=lambda i: color_probs[i])
        out_all_colors = {color_slugs[i]: float(color_probs[i]) for i in range(len(color_names))}

        items.append(
            {
                "file": img_path.name,
                "face": face,
                "face_conf": face_conf,
                "face_source": face_source,
                "clip_face": clip_face,
                "clip_face_conf": clip_face_conf,
                "color": color_names[best_ci],
                "color_slug": color_slugs[best_ci],
                "color_conf": float(color_probs[best_ci]),
                "all_faces": {"front": float(face_probs[front_i]), "back": float(face_probs[back_i])},
                "all_colors": out_all_colors,
            }
        )

    # ── Pair enforcement (ordering mode only) ──────────────────────────────
    # Each back at index i is paired with the front at index i + n_backs.
    # When their colors differ, take the one with higher color_conf; warn on low confidence.
    if args.use_ordering:
        n_backs = sum(1 for it in items if it["face"] == "back")
        backs = [it for it in items if it["face"] == "back"]
        fronts = [it for it in items if it["face"] == "front"]
        conflicts: list[str] = []
        for i, (b, f) in enumerate(zip(backs, fronts)):
            if b["color_slug"] != f["color_slug"]:
                if b["color_conf"] >= f["color_conf"]:
                    winner = {"color": b["color"], "color_slug": b["color_slug"], "color_conf": b["color_conf"]}
                    loser_file = f["file"]
                else:
                    winner = {"color": f["color"], "color_slug": f["color_slug"], "color_conf": f["color_conf"]}
                    loser_file = b["file"]
                msg = (
                    f"  pair {i}: back={b['file']} ({b['color']} {b['color_conf']:.2f}) "
                    f"front={f['file']} ({f['color']} {f['color_conf']:.2f}) "
                    f"→ using {winner['color']} (conf {winner['color_conf']:.2f})"
                )
                print(msg)
                conflicts.append(msg)
                b["color"] = f["color"] = winner["color"]
                b["color_slug"] = f["color_slug"] = winner["color_slug"]
                b["color_conf"] = f["color_conf"] = winner["color_conf"]
                b["pair_conflict_resolved"] = f["pair_conflict_resolved"] = True
            # Warn when best confidence is low even after resolution
            if b["color_conf"] < 0.40:
                print(f"  [low-conf] pair {i}: {b['color']} {b['color_conf']:.2f} — review manually")

        # Detect duplicate color slugs (two pairs with the same color)
        slug_counts: dict[str, int] = {}
        for b in backs:
            slug_counts[b["color_slug"]] = slug_counts.get(b["color_slug"], 0) + 1
        for slug, count in slug_counts.items():
            if count > 1:
                print(f"  [duplicate] color '{slug}' assigned to {count} pairs — review suggestions.json")

    out_path = sub / "suggestions.json"
    payload = {
        "model": args.model,
        "pretrained": args.pretrained,
        "folder": args.folder,
        "device": device,
        "use_ordering": args.use_ordering,
        "items": items,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {out_path} ({len(items)} images).")


if __name__ == "__main__":
    main()
