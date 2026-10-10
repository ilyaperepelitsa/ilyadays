#!/usr/bin/env python3
"""Run after recipe export: size ingredient thumbnails and share identical media.

Requires cwebp and webpinfo (libwebp). Detailed technique plates stay at full size.
The exporter remains the source of images; this step updates all cache hashes.
"""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "public/media"


def digest(path, algorithm="sha256"):
    return hashlib.new(algorithm, path.read_bytes()).hexdigest()


def main():
    for command in ("cwebp", "webpinfo"):
        if not shutil.which(command):
            raise SystemExit(f"{command} is required; install libwebp before syncing")
    before = sum(p.stat().st_size for p in MEDIA.rglob("*") if p.is_file())
    thumbnails = 0
    for image in sorted(MEDIA.glob("illustrations/*/mise*.webp")):
        info = subprocess.check_output(["webpinfo", str(image)], text=True)
        width = re.search(r"Width: (\d+)", info)
        if not width or int(width[1]) <= 600:
            continue
        temp = image.with_suffix(".tmp.webp")
        subprocess.run(["cwebp", "-quiet", "-q", "80", "-resize", "600", "0",
                        str(image), "-o", str(temp)], check=True)
        temp.replace(image)
        thumbnails += 1

    alias_file = ROOT / "art/media/aliases.json"
    previous = json.loads(alias_file.read_text()) if alias_file.exists() else {}
    aliases = {src: dst for src, dst in previous.items()
               if not (MEDIA / src).exists() and (MEDIA / dst).is_file()}
    unique = {}
    for image in sorted(MEDIA.rglob("*")):
        if not image.is_file() or image.suffix not in (".webp", ".jpg", ".png"):
            continue
        relative = image.relative_to(MEDIA).as_posix()
        # Keep reviewed nigiri filenames stable for the anatomy review manifest.
        if relative.startswith("illustrations/nigiri/"):
            continue
        key = (image.suffix, digest(image))
        if key in unique:
            aliases[relative] = unique[key]
        else:
            unique[key] = relative

    hashes = {}

    def rewrite(value):
        if isinstance(value, dict):
            return {k: rewrite(v) for k, v in value.items()}
        if isinstance(value, list):
            return [rewrite(v) for v in value]
        if isinstance(value, str):
            path = value.split("?", 1)[0]
            if path.startswith(("illustrations/", "share/", "photos/", "assets/")) and (MEDIA / path).is_file():
                path = aliases.get(path, path)
                if path not in hashes:
                    hashes[path] = digest(MEDIA / path, "sha1")[:10]
                return f"{path}?v={hashes[path]}"
        return value

    for file in sorted((ROOT / "content").rglob("*.json")):
        data = json.loads(file.read_text())
        updated = rewrite(data)
        if updated != data:
            file.write_text(json.dumps(updated, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    alias_file.parent.mkdir(parents=True, exist_ok=True)
    alias_file.write_text(json.dumps(aliases, indent=2, sort_keys=True) + "\n")
    removed = 0
    for duplicate in aliases:
        if (MEDIA / duplicate).exists():
            (MEDIA / duplicate).unlink()
            removed += 1

    # These legacy URLs have permanent redirects in next.config.ts.
    legacy = ROOT / "public/food"
    legacy_bytes = sum(p.stat().st_size for p in legacy.rglob("*") if p.is_file()) if legacy.exists() else 0
    if legacy.exists():
        shutil.rmtree(legacy)
    after = sum(p.stat().st_size for p in MEDIA.rglob("*") if p.is_file())
    print(json.dumps({"media_bytes_before": before, "media_bytes_after": after,
                      "legacy_duplicate_bytes_removed": legacy_bytes,
                      "thumbnails_resized": thumbnails, "duplicate_images_removed": removed}, indent=2))


if __name__ == "__main__":
    main()
