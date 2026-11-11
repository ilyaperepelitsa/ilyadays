# Crispy potato wedges and potato tempura

Two source-informed home adaptations, researched on 2026-11-11. These recipes have not been kitchen tested. `research.json` records the 15 recipe comparisons and the separate tenkasu reference, including which instructions transfer to these cuts.

- `crispy-potato-wedges`: floury potatoes cut to 15 mm thickness, simmered until tender, gently roughened and dried, fried at 130 °C, cooled, then finished at 185 °C. Baking soda is optional with a deliberately small dose.
- `potato-wedge-tempura`: the same cut, simmered without soda, left intact and dried, dusted with starch and coated with cold packaged tempura batter, then fried once at 170–175 °C. Packet hydration takes precedence; a measured homemade alternative is included.

Both are registered under Potatoes / Картофель, dated 2026-11-11, with exact-string Russian translations, scalable ingredients, measured per-step ingredient lists and linked alternatives. Oregano, basil and garlic seasoning goes on after frying.

The canonical authoring owner remains `../recipes/src/potato_wedges.{py,json}`. `source/` snapshots the module, data, translations and image specifications because the sibling is not a Git repository. `source/author.py` recreates those files and installs the import, recipe registration, group and recipe-owned publication dates in the sibling source; restore the two image specification files from `source/imagegen/recipes/` as well. It does not generate images or export the site.

`prompts.json` contains the full shared-policy prompts for every image slot. `repair-prompts.json` retains the initial two correction requests; `quality-prompts.json` records the additional cooling illustration and thin-dusting correction. `generated.json` maps the 14 distinct accepted scenes to original PNG paths, canonical WebP paths and published asset hashes; rejected candidates remain documented. Shared raw-potato, simmering and hero/final images reuse identical bytes. The first-fry action is now `4-how1`, followed by the pale cooling result in `4`. `requirements.json` is the policy snapshot. Images were made with the built-in image-generation tool and individually inspected at full size. Ingredient previews are square; technique and finished-dish pictures are landscape.

The quality revision adds crust/coating troubleshooting, explicit handling for fryers that cannot hold 130 °C, and a packet-water instruction that follows the scaled amount of batter mix.

To export completed art without generating more images:

```sh
python3 ../recipes/export_json.py --out content --images-out public/media
python3 scripts/optimize-media.py
python3 scripts/card-thumbnails.py
```

The export reports zero untranslated Russian strings and zero missing images. Verification and browser review are recorded in `review.json`.

The source snapshot also includes the shared `src/kit.py` publication-date field and `export_json.py` support. Restore these changes with the recipes. The app server discovers recipe records and computes Recently Added independently of the compatibility list in the export.
