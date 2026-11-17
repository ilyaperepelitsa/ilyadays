# Traditional Korean pan dishes

Six home adaptations added 2026-11-17 under Korean: `bulgogi` (beef half-frozen and sliced by hand),
`dak-bulgogi` (whole boneless thighs, no slicing), `tteokgalbi` (minced beef), `japchae`, `haemul-pajeon` and
`bibimbap` (uses leftover bulgogi; rice crust made in the steel pan). All mild by default and cooked in a steel pan.
Not kitchen tested; sources are on each page.

Canonical owner: `../recipes/src/korean_classics.{py,json}`, registered in `src/content.py` after the stews.
`source/` snapshots the module, data, Russian tables and image specs (the sibling is not a Git repository).
Images: `imagegen/auto.py --look clean` under policy 2026-11-16.1; exact prompts in
`../recipes/imagegen/prompt_log/clean/<slug>.json`. Pajeon step 5 and hero were regenerated once to keep the
pancake round, matching the pan.

Note: `RECIPES_LANG=ru RECIPES_I18N_SYNC=1 python3 build.py` drops strings that only `export_json.py` uses (home-page
lede, sous-vide card); after running it, check the export reports 0 untranslated before syncing.
