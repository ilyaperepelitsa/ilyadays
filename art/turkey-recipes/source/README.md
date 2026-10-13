# Canonical source snapshot · 13 October 2026

Full recipe data, exact-string Russian translations, scene specifications and generator changes are authored in `../recipes`. This sibling currently has no Git repository, so this snapshot preserves the publishable source alongside the exported site.

Recipe edits belong in `src/turkish_recipes.json`; run `python3 src/turkish_recipes.py` in the recipe source to refresh translations. `src/content.py` registers the twelve recipes in `Turkish & coastal` and dates them; `export_json.py` includes the collection in the Food introduction. Step.amounts now supports measured ingredients split between steps, localized and scaled alongside Step.uses. Source snapshots include kit.py, amounts.py and i18n/__init__.py for this behavior. A picture-only step marker enables full-size viewing without emitting any diagram.

The versioned image-policy owner is `art/image-requirements.json` in ilyadays; `scripts/sync-content.sh` copies it into the generator mirror before generation. `imagegen/prompts.py` applies it to every prompt/look. Restore module files into matching sibling paths; merge registry/exporter changes if the sibling has moved on. Finish with `SKIP_IMAGES=1 npm run sync` in ilyadays.

Images already shipped are under `public/media/illustrations/`; original generation PNG paths and exact prompts are recorded in this collection’s manifests. Earlier candidate PNGs are not shipped.

Nine full sashimi variants are authored in `src/sashimi_variants.json` and composed in `src/sashimi_recipes.py`. The exporter writes them together to `content/{en,ru}/sashimi.json`, with no extra route/index cards. Each species has its own image specification and raw, handling/cutting and plated illustrations. Shared chilling/dip pictures are exact byte copies and deduplicated during sync. The v4 style policy restores the approved nigiri style block verbatim and requires the actual reference image; see `art/recipe-quality/` for submitted prompts and review.
