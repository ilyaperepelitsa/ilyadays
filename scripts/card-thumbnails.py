#!/usr/bin/env python3
"""Write 600 px card pictures to public/media/thumbs/<path> for every recipe picture shown on a card.

Cards are about 360 CSS px wide, so the 1200 px hero was three times the data on a phone. The card URL keeps the
hero's `?v=` (src/components/food/parts.tsx), so a new hero means a new card URL. Run after optimize-media.py; it
needs cwebp (libwebp). Thumbnails no card uses any more are removed.
"""
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "public/media"
THUMBS = MEDIA / "thumbs"
WIDTH = 600


def card_pictures():
    paths = set()
    for lang in ("en", "ru"):
        index = json.loads((ROOT / "content" / lang / "index.json").read_text())
        for recipe in index.get("recipes", []):
            image = (recipe.get("hero") or {}).get("image")
            if image:
                paths.add(image.split("?", 1)[0])
    return sorted(paths)


def main():
    if not shutil.which("cwebp"):
        raise SystemExit("cwebp is required; install libwebp")
    wanted, written = set(), 0
    for rel in card_pictures():
        source = MEDIA / rel
        if not source.is_file() or source.suffix != ".webp":
            continue
        target = THUMBS / rel
        wanted.add(target)
        if target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["cwebp", "-quiet", "-q", "78", "-m", "6", "-resize", str(WIDTH), "0", str(source), "-o", str(target)], check=True)
        written += 1
    removed = 0
    for old in THUMBS.rglob("*.webp") if THUMBS.exists() else []:
        if old not in wanted:
            old.unlink()
            removed += 1
    size = sum(p.stat().st_size for p in wanted)
    print(json.dumps({"card_thumbnails": len(wanted), "written": written, "removed": removed, "bytes": size}))


if __name__ == "__main__":
    main()
