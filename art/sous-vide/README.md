# Sous vide and tempura additions, 2026-10-11

The sibling `../recipes` directory is canonical for recipe prose and export. Its changed modules, exporter, image specifications and Russian dictionaries are snapshotted under `source/` because that directory is not a Git repository.

Register `sous_vide_tempura.RECIPES` in canonical `content.RECIPES` and give all four slugs an `ADDED` date of 2026-10-11. Import `INTRO as SV_INTRO, update_tables` from `sous_vide_reference`, apply `SOUS_VIDE = update_tables(SOUS_VIDE)` after the historical tables, and set `SV_PDF = 'assets/sous_vide_quick_tables_v5.pdf'`. The exporter emits locale-independent table `states` and chooses the `_ru.pdf` file for Russian. Generate PDFs with `python scripts/export_sous_vide_pdf.py` (requires ReportLab).

Export with `python ../recipes/export_json.py --out content --images-out public/media`, then run `python scripts/optimize-media.py`. Imagegen files use the installed generated WebP stages. Final-stage images also serve as recipe heroes; exact duplicates share a published file.

See `reference-review.json` for timing assumptions and sources, and `new-recipe-art.json` for prompts, output hashes and visual review. No new diagrams, photographic assets or hand anatomy are introduced.

Regular oyster mushroom tempura replaces king oyster tempura at the user’s request. The current slug and ADDED registration are `oyster-mushroom-tempura`; old EN/RU URLs and pictures redirect to the replacement. Its four new illustrations show fan-shaped caps with short lateral stems.
