#!/usr/bin/env python3
"""Small card thumbnails for the fitness exercise pictures (the catalog list shows them at about 112 px).

  public/media/fitness/exercises/<id>/<angle>.webp  ->  public/media/fitness/thumbs/exercises/<id>/<angle>.webp

(Under public/media/fitness, which `npm run sync` keeps; it wipes public/media/thumbs for the recipe cards.)

360 px wide (3x a 120 px card), same aspect, WebP. The page requests the thumb with the ORIGINAL picture's `?v=`
(content/fitness/images.json), so art/fitness/thumbs.json records which version each thumb was made from;
tests/fitness/thumbs.test.mjs fails when a picture changed and its thumb was not remade.

  python scripts/fitness-thumbs.py          # make missing or outdated thumbs, delete orphans
  python scripts/fitness-thumbs.py --check  # exit 1 when anything is missing or outdated

Run after scripts/fitness-images.py and before node scripts/fitness-image-index.mjs.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/media/fitness/exercises"
DST = ROOT / "public/media/fitness/thumbs/exercises"
MANIFEST = ROOT / "art/fitness/thumbs.json"
WIDTH = 360


def version(path: Path) -> str:
    """Same 8-hex SHA-1 prefix scripts/fitness-image-index.mjs writes as `v`."""
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def main() -> int:
    check = "--check" in sys.argv[1:]
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    wanted, made, problems = {}, 0, []
    for src in sorted(SRC.glob("*/*.webp")):
        rel = src.relative_to(SRC).as_posix()
        v = version(src)
        wanted[rel] = v
        dst = DST / rel
        if dst.exists() and manifest.get(rel) == v:
            continue
        if check:
            problems.append(f"outdated or missing thumb: {rel}")
            continue
        from PIL import Image  # only needed when something is (re)made

        with Image.open(src) as im:
            im = im.convert("RGB")
            height = round(im.height * WIDTH / im.width)
            dst.parent.mkdir(parents=True, exist_ok=True)
            im.resize((WIDTH, height), Image.LANCZOS).save(dst, "WEBP", quality=78, method=6)
        made += 1
    orphans = [p for p in DST.glob("*/*.webp") if p.relative_to(DST).as_posix() not in wanted] if DST.exists() else []
    if check:
        problems += [f"orphan thumb: {p.relative_to(DST).as_posix()}" for p in orphans]
        problems += [f"manifest out of date: {rel}" for rel, v in wanted.items() if manifest.get(rel) != v and f"outdated or missing thumb: {rel}" not in problems]
        print("\n".join(problems) if problems else f"thumbs: {len(wanted)} up to date")
        return 1 if problems else 0
    for p in orphans:
        p.unlink()
    MANIFEST.write_text(json.dumps(dict(sorted(wanted.items())), indent=1) + "\n")
    total = sum((DST / rel).stat().st_size for rel in wanted)
    print(f"thumbs: {len(wanted)} total, {made} made, {len(orphans)} orphans removed, {total / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
