# Controlled machine image system

The authored sources are `art/fitness/machines/language.json` and `specs.json`. They cover every machine/station in the image index: 70 exercise configurations, 47 shared physical machine identities, six required views per exercise and 397 unique images after sharing the identity views. Each configuration has 12 checkpoint definitions with exact observations, rejection criteria and view assignments. Existing pictures remain legacy assets; the new configs do not mark them reviewed or claim to have regenerated them.

The fixed language inherits the site's warm hand-drawn contours, ivory ground and muted matte shading. It explicitly replaces culinary framing with adult exercise demonstrations. Graphite frames, cream pads and grey hardware/person stay consistent; orange marks adjustment controls only. No arrows, lettering, muscle overlays, diagram insets or glossy renders. Hands use plausible individual digits with natural occlusion. Generic physical families are not manufacturer-certified models.

## Six views and dependencies

| View | Purpose | Required approved input |
| --- | --- | --- |
| identity | Whole machine, fixed chassis, resistance mechanism and adjustment hardware | Existing house line/palette reference |
| adjustment | Main adjustment, engaged latch/pin and adjacent contact landmark | Physical machine identity |
| setup | Whole adult, grip, supports and exercise-specific attachment/settings | Physical machine identity |
| start | Beginning of the working phase | Machine identity and setup |
| end | End of that same repetition; same crop, actor, fixed geometry and settings | Machine identity and start |
| alignment | Close view of the authored critical contact/joint or hardest point where supplied | Machine identity and start |

The frame, pads, pivots, rails, cable routing, actor scale and camera cannot drift between start and end. Moving parts remain connected. Seat/pad/pulley settings are body-relative, not invented universal seat numbers or weights. Missing authored hardest-point data becomes an explicit start-contact check; it is not represented as a known hardest point. Two old scene descriptions incorrectly called plate-loaded stations pin-loaded; the decline press and four-way neck configs now follow the catalog equipment, with the correction recorded.

## Compile and inspect without spending API credits

```sh
node scripts/fitness-machine-specs.mjs check
node scripts/fitness-machine-specs.mjs build
node scripts/fitness-machine-specs.mjs export --job machine-chest-press/identity
```

The build writes a manifest and 70 standalone exercise JSON configs to `output/fitness-machine-specs/`. Each contains the exact request fields/prompts, reference roles, source hashes, output path and per-view checkpoints. The identity request is shared by all exercises using that physical machine. The compiler does not call an API or publish an image.

API requests use the Images **edits** endpoint, model snapshot `gpt-image-2-2026-04-21`, one image, 1536×1024, high quality, opaque PNG and automatic moderation. Inputs are ordered multipart `image[]` file fields, with each reference's role stated in the prompt. Camera/pose are prompt constraints. There is no invented seed/camera API field or `input_fidelity` setting. The pinned snapshot and hashes support traceability; image generation remains stochastic. See the official [model snapshot documentation](https://developers.openai.com/api/docs/models/gpt-image-2), [Images API](https://developers.openai.com/api/reference/resources/images) and [image generation guide](https://developers.openai.com/api/docs/guides/image-generation).

For actual generation use the installed imagegen skill's bundled `scripts/image_gen.py edit`, passing the exported prompt file, exact settings and ordered `--image` references. The verified dry run used:

```sh
python3 "$CODEX_HOME/skills/.system/imagegen/scripts/image_gen.py" edit \
  --model gpt-image-2-2026-04-21 \
  --image public/media/illustrations/nigiri/technique-4.webp \
  --prompt-file output/fitness-machine-specs/machine-chest-press--identity.prompt.txt \
  --n 1 --size 1536x1024 --quality high --background opaque \
  --output-format png --moderation auto --no-augment \
  --out output/imagegen/fitness-v2/machine-chest-press/identity.png --dry-run
```

`--dry-run` makes no network request. A live API run needs a locally configured API key. Never put it in configs, git, database rows or browser code. Do not run the entire dependent collection as unrelated text-only generations.

## Review and publication

Every generated asset starts `unreviewed`. A review record binds `jobId`, exact `promptSha256`, `imageSha256`, actual model, API request ID, reviewer, review date and every input reference's hash. Each scoped checkpoint requires `pass: true`, a written observation and normalized `[x, y, width, height]` boxes showing the component/contact. Inspect original resolution and thumbnail readability. Any failed/missing/occluded required item blocks approval.

Downstream export requires a JSON array of these review records, including each approved reference's local `path`:

```sh
node scripts/fitness-machine-specs.mjs export \
  --job machine-chest-press/setup --reviews output/image-reviews.json
```

The resolver validates reviews, file hashes and the entire dependency lineage. A bare `approved` label, mismatched prompt, changed reference or missing checkpoint does not unlock exports. Review records are evidence provided by an actual inspection; scripts cannot establish anatomical correctness from metadata alone. No generated files are automatically copied into `public/`.

Supabase stores private per-exercise specs and prompt hashes in `fitness_internal.image_specs`, with backend-only generation/review records. Public image assets are read through an approved-only RLS policy. A publication trigger requires the matching approved generation, bytes, view and evidence. Approved generation records are immutable. The existing image index remains in use until replacements have been generated, inspected, compressed and deliberately indexed.
