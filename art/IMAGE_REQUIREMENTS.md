# Shared requirements for generated images

`art/image-requirements.json` is the authoritative, versioned policy for **every future generated image on this site**, including Travel covers and Food preparation illustrations. It includes the animation style, anatomy, technical accuracy, sparse small details and review criteria. Recipes and individual scenes add detail; they never replace this policy.

`npm run sync` copies the policy into `../recipes/imagegen/requirements.json` before generation. The sibling generator's `prompts.prompt()` reads that mirror and applies it to every look, including older named looks. Existing images are not automatically regenerated. This collection replaces its earlier textured covers explicitly.

The approved style block is preserved **verbatim** from `art/nigiri/illustration-prompts.json#style`; do not summarize or paraphrase it when creating another collection. Supply `public/media/illustrations/nigiri/technique-4.webp` as the style reference. Scene instructions explicitly override the historical reference's optional arrows: current pictures have no arrows, labels, diagrams or insets. Sparse texture must retain useful food structure, grain direction, cut edges and precise tool contact.

For built-in image generation, prepare exact prompts with:

```sh
python3 scripts/recipe-image-prompts.py --slug menemen --slug cilbir --out output/recipe-prompts.json
```

Use one built-in call per distinct scene. Inspect the actual full-size outputs and technical contact points, correct failed scenes, then save optimized assets into the canonical recipe source before syncing. Keep the exact prompts, policy snapshot/version, output paths and review in `art/<collection>/`. Do not run the API-based automatic generator when using built-in tools: `SKIP_IMAGES=1 npm run sync` exports completed art without generating additional images.

The recipe source, translations and scene specifications remain in `../recipes`. Since that sibling is not a Git repository in this workspace, this collection also retains source snapshots in `art/turkey-recipes/source/` so changes remain reviewable and recoverable.

The recipe parity correction is recorded in `art/recipe-quality/`: full submitted prompt strings and style-reference paths in `prompts.json`, targeted corrections in `repair-prompts.json`, and final source/output hashes in the review manifest. The image-quality review checks visible technique and ingredient state as well as illustration style. Food pages should include prepared-ingredient previews and measured per-step ingredient lists; a single generic finished-dish picture cannot stand in for distinct selected foods.
