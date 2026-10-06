#!/usr/bin/env bash
# Pull content from the sibling source repos into the Next.js app. Run after changing a recipe, a picture or the
# Istanbul app, then commit the result (Vercel builds from what's committed; it never sees the sibling repos).
#
#   npm run sync            (= bash scripts/sync-content.sh)
#
# Sources (siblings of this repo):
#   ../recipes        recipes + pictures → content/{en,ru}, content/svg-defs.svg, public/media; style.css → src/styles/food.css;
#                     the site icon → public/icons
#   ../istanbul_trip  dist/app.js + app.css → public/apps/istanbul; dist/app.d.ts → src/types/istanbul.d.ts
#   art/covers        home-page covers → public/covers (1200 px webp) and 1200×630 link previews → public/share
set -euo pipefail
cd "$(dirname "$0")/.."
RECIPES="${RECIPES_DIR:-../recipes}"
TRIP="${ISTANBUL_DIR:-../istanbul_trip}"

# Recipes: JSON for both languages + every picture they reference.
rm -rf content public/media
python3 "$RECIPES/export_json.py" --out content --images-out public/media
mkdir -p src/styles public/icons
cp "$RECIPES/static/style.css" src/styles/food.css
cp "$RECIPES"/static/icons/*.png public/icons/

# Istanbul trip app (embeddable build).
mkdir -p public/apps/istanbul src/types
cp "$TRIP/dist/app.js" "$TRIP/dist/app.css" public/apps/istanbul/
cp "$TRIP/dist/app.d.ts" src/types/istanbul.d.ts

# Home-page covers and link-preview pictures.
mkdir -p public/covers public/share
for c in art/covers/*.webp; do cwebp -quiet -q 80 -resize 1200 0 "$c" -o "public/covers/$(basename "$c")"; done
share() {  # share <cover.webp> <name>: 1200×630 JPEG, centre crop
  local png; png="$(mktemp -t share).png"
  dwebp -quiet "$1" -o "$png"
  sips -s format jpeg -s formatOptions 82 --resampleWidth 1200 "$png" --out "public/share/$2.jpg" >/dev/null
  sips -c 630 1200 "public/share/$2.jpg" >/dev/null
  rm -f "$png"
}
share art/covers/food.webp home
share art/covers/travel.webp travel

echo "synced: $(ls content/en/recipes | wc -l | tr -d ' ') recipes/lang, media $(du -sh public/media | cut -f1)"
