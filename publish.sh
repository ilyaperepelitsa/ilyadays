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
mv "$NEXT/covers_icon.svg" "$NEXT/covers/icon.svg"
for c in src/covers/*.webp; do cwebp -quiet -q 80 -resize 1200 0 "$c" -o "$NEXT/covers/$(basename "$c")"; done

# Food: the recipe site, with an "ilyadays /" link back home.
RECIPES_HOME="../" RECIPES_OUT="$NEXT/food" python3 ../recipes/build.py

# Travel: the Istanbul trip app (single self-contained file; outside claude.ai it saves to this browser).
cp ../istanbul_trip/dist/index.html "$NEXT/travel/istanbul/index.html"

rm -rf "$ROOT/public"; mv "$NEXT" "$ROOT/public"
echo "built public/ ($(du -sh public | cut -f1))"

if [[ "${1:-}" == "--push" ]]; then
  git add -A
  if git diff --cached --quiet; then echo "nothing changed"; exit 0; fi
  git commit -q -m "Publish $(date "+%Y-%m-%d %H:%M")"
  git push -q origin main
  echo "pushed — Vercel deploys it in a minute or two"
fi
