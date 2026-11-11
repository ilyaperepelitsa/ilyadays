# Recipe variation placement

Useful ingredient, filling, sauce and method alternatives are visible before ingredients. Cooking-stage
alternatives can be attached to a numbered step: the mini cream puffs' fan-oven conversion is beside step 9,
and its temperatures also enter that step's conditions table. Storage, troubleshooting and source notes keep
their existing position. No recipe prose, amounts or source attribution are rewritten.

The editorial source is `../recipes/src/note_placement.json`, snapshotted under `source/src/` here. It explicitly
assigns 129 existing notes across 68 recipes/variants. The exporter resolves each original English title once,
validates it against the canonical source and carries `placement: start` or `placement: step` plus a step number
into both languages' note records. Missing, ambiguous or stale choices fail export. Future alternatives should
receive placement metadata here when authored; the frontend uses the metadata without slug or title matching.

`source/export_json.py` snapshots the updated sibling exporter because that source tree has no Git repository.
Restore it together with the placement JSON when recovering authoring. Export using the normal recipe exporter,
then optimize media and regenerate thumbnails. Existing art remains unchanged.

Shared rendering covers regular recipes, composed onigiri and selected sashimi. Plain-text copying puts recipe-wide
variations before ingredients and includes step-specific alternatives with that step. Existing quantity markup, unit conversion, and fixed-batch amount conventions remain unchanged. App-owned styles live in `src/styles/cooking-tables.css`
and survive syncs of the sibling stylesheet.

Verify with `npm run typecheck`, `node --test tests/food/*.test.mjs`, and `npm run build`; check ordering, selected
onigiri changes, °C/°F, portion scaling, and copied text in the browser.
