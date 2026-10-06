#!/usr/bin/env bash
# Build ilyadays.com into public/ and (with --push) commit and push it; Vercel deploys every push to main.
#   ./publish.sh          build only (check public/ locally: python3 -m http.server -d public 8100)
#   ./publish.sh --push   build, commit, push
# Sources: ../recipes (Food, built with build.py), ../istanbul_trip/dist/index.html (Travel), src/ (home, covers).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"; NEXT="$ROOT/public.next"
rm -rf "$NEXT"; mkdir -p "$NEXT/covers" "$NEXT/travel/istanbul"

cp -R src/site/. "$NEXT/"
for c in src/covers/*.webp; do cwebp -quiet -q 80 -resize 1200 0 "$c" -o "$NEXT/covers/$(basename "$c")"; done

# Site icon (made for the recipes; shared) and 1200×630 link-preview pictures.
mkdir -p "$NEXT/icons" "$NEXT/share"
cp ../recipes/static/icons/*.png "$NEXT/icons/"
share() {  # share <cover.webp> <name>
  local png; png="$(mktemp -t share).png"
  dwebp -quiet "$1" -o "$png"
  sips -s format jpeg -s formatOptions 82 --resampleWidth 1200 "$png" --out "$NEXT/share/$2.jpg" >/dev/null
  sips -c 630 1200 "$NEXT/share/$2.jpg" >/dev/null
  rm -f "$png"
}
share src/covers/food.webp home
share src/covers/travel.webp travel

# Food: the recipe site, with an "ilyadays /" link back home.
RECIPES_HOME="../" RECIPES_SITE_URL="https://ilyadays.com/food/" RECIPES_OUT="$NEXT/food" python3 ../recipes/build.py

# Travel: the Istanbul trip app (single self-contained file; outside claude.ai it saves to this browser).
# Its own source stays untouched; the published copy gets the site icon and link-preview tags.
python3 - "$NEXT/travel/istanbul/index.html" <<'PY'
import sys
src = open("../istanbul_trip/dist/index.html", encoding="utf-8").read()
url, img = "https://ilyadays.com/travel/istanbul/", "https://ilyadays.com/share/travel.jpg"
title, desc = "Constantinople Days — Istanbul on foot", ("4-day and 2-day walking plans through Byzantine and Ottoman "
              "Istanbul: churches, palaces, treasuries and the sea walls, with a map and tick-off stops.")
tags = f"""<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="ilyadays"><meta property="og:type" content="website">
<meta property="og:url" content="{url}"><meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}"><meta name="description" content="{desc}">
<meta property="og:image" content="{img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{img}">
"""
assert "</head>" in src
open(sys.argv[1], "w", encoding="utf-8").write(src.replace("</head>", tags + "</head>", 1))
PY

rm -rf "$ROOT/public"; mv "$NEXT" "$ROOT/public"
echo "built public/ ($(du -sh public | cut -f1))"

if [[ "${1:-}" == "--push" ]]; then
  git add -A
  if git diff --cached --quiet; then echo "nothing changed"; exit 0; fi
  git commit -q -m "Publish $(date "+%Y-%m-%d %H:%M")"
  # Push as the ilyaperepelitsa account even if another gh account is active (this repo belongs to it).
  git -c credential.helper= \
      -c credential.helper='!f() { echo username=ilyaperepelitsa; echo "password=$(gh auth token -h github.com -u ilyaperepelitsa)"; }; f' \
      push -q origin main
  echo "pushed — Vercel deploys it in a minute or two"
fi
