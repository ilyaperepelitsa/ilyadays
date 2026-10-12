# Canonical source snapshot · 13 October 2026

Full recipe data, exact-string Russian translations, scene specifications and generator changes are authored in `../recipes`. This sibling currently has no Git repository, so this snapshot preserves the publishable source alongside the exported site.

Recipe edits belong in `src/turkish_recipes.json`; run `python3 src/turkish_recipes.py` in the recipe source to refresh translations. `src/content.py` registers the twelve recipes in `Turkish & coastal` and dates them; `export_json.py` includes the collection in the Food introduction. The existing Recipe/Step model is unchanged. A picture-only step marker enables full-size viewing without emitting any diagram.

The versioned image-policy owner is `art/image-requirements.json` in ilyadays; `scripts/sync-content.sh` copies it into the generator mirror before generation. `imagegen/prompts.py` applies it to every prompt/look. Restore module files into matching sibling paths; merge registry/exporter changes if the sibling has moved on. Finish with `SKIP_IMAGES=1 npm run sync` in ilyadays.

Images already shipped are under `public/media/illustrations/`; original generation PNG paths and exact prompts are recorded in this collection’s manifests. Earlier candidate PNGs are not shipped.
