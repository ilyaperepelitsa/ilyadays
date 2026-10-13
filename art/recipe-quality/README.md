# Turkish recipe and sashimi illustration revision

The approved style block is preserved **verbatim** from `art/nigiri/illustration-prompts.json#style` in the shared `art/image-requirements.json` policy. Every drawing uses the actual approved `public/media/illustrations/nigiri/technique-4.webp` as a visual reference. Additional policy instructions prohibit diagrams, arrows, photo textures and dense recursive detail.

`prompts.json` records the 111 initial submitted prompts, exact scene text, reference paths and SHA-256 prompt hashes. `repair-prompts.json` records the subsequent targeted corrections verbatim, including the tuna grain identification and perpendicular cutting pair. These are submitted tool inputs, rather than reconstructed descriptions. Original absolute reference paths are retained for audit; ordinary style references resolve to the corresponding path in this repository.

`requirements.json` snapshots the policy used for this revision. `references/tuna-grain-v1.webp` preserves the rejected identification candidate; `references/tuna-grain-approved.webp` is the corrected same-block reference used for the cutting scene. The other reference files preserve the mince and walnut edit targets. Reference images serve the saved tool requests and are not additional website illustrations.

`generated.json` maps final unique scenes to their source PNG, submitted prompt hash, optimized canonical asset and published asset. Shared chilling, dip and plated/hero images reuse the same bytes. `review.json` records the final content and image review. The earlier `art/turkey-recipes/` prompts and review are historical and are superseded by this collection for the currently published pictures.

Canonical recipe data, measured step ingredients, exact-string Russian translations, scene specifications and exporter/model support are preserved in `art/turkey-recipes/source/`. The sibling recipe source remains the authoring owner. Restore those files and use `SKIP_IMAGES=1 npm run sync` to export without launching additional image generation.
