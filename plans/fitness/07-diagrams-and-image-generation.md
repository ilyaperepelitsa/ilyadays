# 07 — Technique diagrams, machine pictures, muscle maps and the section cover (image pipeline)

Status: pipeline, style test, cover, **batch done** (2026-11-08) and **full review done** (2026-11-09): all 242
pictures on the site, $16.48 spent of the $20 cap. See "Status" at the end.

## Scope

A stdlib-only Python pipeline around OpenAI's Images API (`gpt-image-2`, webp) that turns the exercise catalog into
technique pictures under a hard, cumulative USD 20 cap, with every prompt logged:

- **sequence** (every exercise, 138): one 3:2 picture, two panels START → END, working muscles in the site accent
  orange on a neutral mannequin, one curved orange motion arrow, no text;
- **side** (owner-primary exercises, 20): one 3:2 view at the hardest point of the rep, for joint angles;
- **machine** (every machine-based exercise — pin-loaded, plate-loaded, cable stations, assisted, Smith — plus the
  captain's chair and the 45° back-extension bench, 70): the machine alone, set up for that exercise;
- **muscle map** (the 14 coarse groups): square front + back mannequin with one group highlighted;
- the fitness **cover** for the home tile and link previews, in the look of the two existing covers.

No UI in this stream: the catalog (stream 02) reads `content/fitness/images.json`.

## Files (owned)

```
plans/fitness/07-diagrams-and-image-generation.md   this plan
art/fitness/STYLE.md                                 house style: fenced ```prompt <name>``` blocks the script assembles
art/fitness/scenes.json                              drawing data for all 138 registry ids (machine as set up, setup,
                                                     START/END, arrow path, hardest point, cameras, muscle locations)
art/fitness/pricing.json                             per-image prices + token rates, sources with URLs and check date
art/fitness/manifest.json                            written by `plan`: every picture, prompt, refs, cost, priority
art/fitness/spend.json                               cumulative spend, saved after every image (the cap)
art/fitness/prompts.json                             append-only log of every request (prompt/model/size/quality/refs/cost/usage/out)
art/fitness/style-review.md                          verdicts on the style-test pictures
art/fitness/originals/                               full-size API output (gitignored; replaced ones in originals/_previous/)
scripts/fitness-images.py                            plan / run / status / index (stdlib only)
scripts/fitness-image-index.mjs                      writes content/fitness/images.json from public/media/fitness
content/fitness/images.json                          the picture index the site reads (generated, never hand-edited)
public/media/fitness/**                              optimized pictures, served under /media/fitness/...
art/covers/fitness.webp → public/covers/fitness.webp (800×534) + public/share/fitness.jpg (1200×630)
tests/fitness/images.test.mjs
.gitignore                                           art/fitness/originals/ and art/fitness/.run.lock
```

## Contract / API

### CLI

```bash
python3 scripts/fitness-images.py plan   [--quality medium] [--model gpt-image-2]
python3 scripts/fitness-images.py run    [--budget-usd 20] [--quality low|medium|high] [--priority N]
                                         [--angle sequence,side,machine,muscle-map,cover] [--only id-or-key,...]
                                         [--workers 3] [--dry-run] [--force] [--no-ref] [--ref PATH]
python3 scripts/fitness-images.py status [--budget-usd 20]
python3 scripts/fitness-images.py index            # = node scripts/fitness-image-index.mjs
```

- `plan` reads `content/fitness/exercises.json`. While it is empty it falls back to the 138 registry ids
  (`registry.exercises`) with names, equipment and muscles from `art/fitness/scenes.json`. Once the catalog exists,
  its name, equipment, primary/secondary muscles, tags and alternatives win, and its `setup.en` and first four
  `cues.en` are added to every scene ("draw consistently with it"); `scenes.json` always supplies the drawing
  directions. `plan` warns when the catalog's setup names a different attachment (rope / bar / V-handle / stirrup /
  EZ bar) than the scene draws.
- `run` refuses a stale manifest (STYLE.md, scenes.json or exercises.json changed since `plan`), skips existing
  outputs unless `--force`, and **never lets `spend.json.total` pass `--budget-usd`**. Before each request it
  reserves estimate × 1.25 + $0.005 under a lock, and a request starts only if the spent total plus all
  reservations stays ≤ budget. After the response the reservation becomes the real cost from `usage` and
  `spend.json` is saved. A lock file (`art/fitness/.run.lock`) stops two runs from spending at once. A timeout
  (outcome unknown) is charged at the estimate and not retried in that run. 429/5xx and network errors get 3 retries
  with 10/20/40 s back-off (not billed). A moderation refusal is logged as `refused` and skipped. Any other API error
  stops scheduling (exit 1).
- `--workers N` (default 3) runs requests in parallel; the style anchors that are selected and missing run first,
  alone, so every later picture can reference them. `--dry-run` writes nothing.
- Filters: `--priority N` keeps priority ≤ N; `--angle` (alias `--kind`) takes `sequence`, `side`, `machine`,
  `muscle-map`, `cover`; `--only` takes keys (`lat-pulldown/side`, `machines/pec-deck`, `muscles/chest`, `cover`)
  or bare exercise ids (all of that exercise's pictures).
- **Style anchors** (passed to `/v1/images/edits` as `image[]`):
  - sequence → `machine-chest-press/sequence` (made fresh);
  - side → `machine-chest-press/side` (made fresh: a three-quarter reference pulls a profile off its camera);
  - machine → `machines/pec-deck`, and muscle map → `muscles/chest` (each made with the sequence anchor as
    reference).

  Every other picture references its kind's anchor **unless the anchor would distort it** (batch rule, see Status).
  These start without a reference:
  - a sequence drawn from a camera other than the anchor's three-quarter front;
  - a side view with its own non-profile `sideCamera`;
  - a cable station, or any station whose text names no seat or bench (the seated pec-deck anchor adds seats);
  - any kind listed in the scene's `fresh`.

  If a sequence, machine or muscle-map anchor is missing, the sequence anchor stands in; side views then get no
  reference. The cover references `art/covers/travel.webp` and `art/covers/food.webp`.
- **Per-exercise review overrides in `scenes.json`** (all optional, no trailing full stop): `note` (sequence + side),
  `seqNote` (sequence only — may talk about panels), `sideNote`, `machineNote`, `sidePath` (the side view's arrow),
  `fresh` (kinds drawn without a style reference), and an explicit `uni` that beats the catalog's `unilateral` (the
  catalog marks the Pallof press or the dead bug unilateral although both hands hold one handle). Each is appended as
  "Important: …" to the scene, so a reviewed failure is fixed in the manifest source, not only in the output.
  - `station` overrides the machine picture: `true` adds one, and `false` drops one the catalog's equipment implies.
    The plate neck extension and flexion are filed "plate-loaded", but there is no machine.
  - When a scene has no station text, its own `eq` (not the catalog's filter value) names the equipment in the
    prompt.
  - A cable station whose text names no seat or bench gets the builder's `FREE_STANDING_CABLE` sentence (no seat,
    bench, back pad or knee rollers): without it, 8 of 9 single columns grew a seat.

### Manifest entry (`art/fitness/manifest.json`)

```json
{ "key": "lat-pulldown/sequence", "kind": "sequence", "angle": "sequence", "exercise": "lat-pulldown",
  "out": "public/media/fitness/exercises/lat-pulldown/sequence.webp", "size": "1536x1024", "width": 1200,
  "quality": "medium", "model": "gpt-image-2", "priority": 1, "rank": 1, "camera": "pure side",
  "refs": ["art/fitness/originals/machine-chest-press/sequence.webp"], "cost": 0.0605, "scene": "…",
  "prompt": "<base + mannequin + sequence + Scene + negative>" }
```

The text actually sent is `referenceNote` (top level, = STYLE.md `reference`) + `prompt` when refs are passed;
`prompts.json` keeps the exact text of every request. Priorities: 1 = owner-primary (the A/B/C slots of
`registry.ownerTemplate` ∪ catalog tag `owner-primary`): sequence + side + machine; 2 = their alternatives (catalog
`alternatives`, or every member of their equivalence classes in the fallback): sequence + machine; 3 = the rest;
4 = muscle maps; 9 = the cover. Within a priority: sequences, then sides, then machines, in program order.

### File naming contract (stream 02 reads this)

`content/fitness/images.json`, written by `scripts/fitness-image-index.mjs` from what is on disk (after every `run`):

```json
{
  "exercises": { "<id>": [ { "angle": "sequence", "src": "fitness/exercises/<id>/sequence.webp", "v": "1a2b3c4d" },
                           { "angle": "side",     "src": "fitness/exercises/<id>/side.webp",     "v": "…" } ] },
  "machines":  { "<id>":   { "src": "fitness/machines/<id>.webp", "v": "…" } },
  "muscles":   { "<group>": { "src": "fitness/muscles/<group>.webp", "v": "…" } }
}
```

- `src` is relative to `/media/`; the page requests `/media/<src>?v=<v>`. `v` is the first 8 hex digits of the
  file's SHA-1, so a regenerated picture gets a new URL (`next.config.ts` caches `?v=` media for a year). The
  offline catalog (`scripts/write-offline-catalog.mjs`) already reads this shape.
- `<id>` is a registry exercise id; `machines` is keyed by the exercise id the machine is pictured for; `<group>`
  is one of the 14 `registry.groups` ids. Angles are listed sequence first, then side.
- Sizes: exercise and machine pictures 1200×800 webp (3:2, 25–60 KB); muscle maps 800×800. `alt` comes from the
  catalog, e.g. "Lat pulldown: start and end position" / "Тяга верхнего блока: начало и конец движения";
  side view: "… at the hardest point"; machine: "<name>: the machine".
- A missing entry means "no picture yet": the page shows the SVG muscle map and the cues without an `<img>`.

### Output sizes

| kind | API size | original (gitignored) | optimized copy |
| --- | --- | --- | --- |
| sequence, side, machine | 1536×1024 | `art/fitness/originals/<key>.webp` | `cwebp -q 80 -m 6 -resize 1200 0` → 1200×800 |
| muscle map | 1024×1024 | same | `-resize 800 0` → 800×800 |
| cover | 1536×1024 | `art/covers/fitness.webp` (committed, like food/travel) | `public/covers/fitness.webp` 800×534; `public/share/fitness.jpg` 1200×630 JPEG q82, centre crop |

## Design decisions

- **Prompts live in `STYLE.md` and `scenes.json`, not in the script**, so the documented style and the prompt sent
  cannot drift; the manifest records both files' SHA-1 and `run` refuses a stale manifest.
- **Scenes are data, written per exercise** (machine as set up, seat height, grip, START/END, arrow path, hardest
  point, camera). Pattern defaults alone gave generic pictures; correctness (handles at mid-chest, bar in front of
  the face to the collarbones, thighs under the rollers) needs the specific setup. Moving machine parts are always
  described relative to the body; the style test showed that geometry, not quality, is what fails.
- **START/END convention**: LEFT = where the working (lifting) phase begins, usually the stretched position where the
  weight rests; RIGHT = where it ends; the single arrow is in the left panel along the lifting path. Frame, seat and
  fixed pads are identical in both panels; handles, levers, bar, cable and rollers move with the body. The builder
  spells out the arrow's direction ("its tail starts where the moving part is in the START position and its head
  points the way it travels toward the END position, never back"): the batch showed the model reverses arrows when a
  path only says "back" or "inward", so direction-prone paths (rows, flies, rear-delt work, trunk extension) also name
  the picture direction ("toward the left of the picture", "curving in to the breastbone").
- **Camera by pattern** (scene may override): pure side for pulls, rows, curls, extensions, hinges, squats and trunk
  flexion; three-quarter front for presses, flies, carries and anti-rotation; three-quarter rear for rear-delt work;
  straight front for raises and hip ab/adduction; high side for lying presses.
- **Side view = joint-angle view**: a strict profile for sagittal movements. Four owner exercises move in another
  plane and get the view that shows their angle: lateral raise machine = straight rear view, Pallof press = front
  view, pec deck and cable fly = high front view.
- **Mannequin instead of a person**: a smooth faceless figure with mitten hands makes anatomy errors unlikely and
  keeps the orange muscles readable. It follows the site's image policy (`art/image-requirements.json`: thin
  warm-brown outlines, matte cel shading, ivory, no text, never photoreal). The motion arrow and muscle highlight are
  this collection's stated exceptions to "no arrows/diagrams".
- **Machine pictures per exercise**, not per machine family: the picture shows the station as set up for that
  exercise (pulley height, attachment, bench angle), which is what a novice needs to find and set it. The adjustment
  points (pins, pop-pins) are the only orange in the picture.
- **Price model** = OpenAI's per-image output price + text input (chars/4 × $5/M) + 1536 image-input tokens × $8/M
  per reference. The style test matched it to the token: 1372 output tokens per medium landscape picture, 1756 per
  square, 1536 per reference. Real cost always comes from `usage`.
- `content/fitness/images.json` is generated from the files on disk (single writer), so it can never point at a
  missing picture or a stale hash; the test re-derives it.
- The cover reuses the recipe site's "clean" style text (art/covers/prompts.json) without the food rules, and passes
  the two existing covers as references so the three home tiles match.

## Acceptance checks

- [x] `plan` writes 243 entries: 138 sequences, 20 side views (owner-primary), 70 machines, 14 muscle maps and the
  cover, with priorities 1–4/9 and per-entry costs (≈ $14.56 at medium).
- [x] `run --dry-run` prints candidates and costs and writes nothing; the cap stop and stale-manifest and run-lock
  guards were exercised; a 200-thread ledger simulation never passed the cap.
- [x] Every API call is in `prompts.json` (prompt, model, size, quality, refs, cost, usage, outputs, status).
- [x] Style test reviewed at full size in `art/fitness/style-review.md`.
- [x] `node --test tests/fitness/images.test.mjs` passes (24 tests since the 2026-11-09 review); `npx eslint` clean on
  the .mjs files; `ruff check` clean on the script.
- [x] Batch (2026-11-08): 241 of the 242 exercise, machine and muscle pictures are on the site and indexed in
  `content/fitness/images.json`, plus the cover. Only the Pallof press sequence is missing: it failed twice and was
  removed.
- [x] Spend stayed within the limits:
  - total $14.86;
  - batch $14.34, including 37 redos for $1.81;
  - $4.14 under the $19 stop, which kept a $1 reserve under the $20 hard cap.
- [x] Pictures reviewed with Read against the STYLE.md criteria:
  - every P1 picture at web size;
  - every P2 and P3 picture (about 50 at web size, the rest on contact sheets);
  - every muscle map.

  Failures were regenerated once with a corrected scene or builder rule. Verdicts and the known weak pictures are in
  `art/fitness/style-review.md` ("Batch run").

## Budget plan

Measured per-picture cost (medium, with one style reference): sequence and side $0.060, machine $0.057, muscle
map $0.070, cover $0.068; anchors made without a reference $0.047. High quality is ≈ 3× the price ($0.18
landscape, $0.23 square).

| kind | pictures | made | medium, all | medium, still to make | high, all |
| --- | ---: | ---: | ---: | ---: | ---: |
| sequence | 138 | 2 | $8.29 | $8.18 | $25.40 |
| side | 20 | 1 | $1.19 | $1.15 | $3.67 |
| machine | 70 | 1 | $4.02 | $3.96 | $12.70 |
| muscle map | 14 | 1 | $0.99 | $0.92 | $3.20 |
| cover | 1 | 1 | $0.07 | — | $0.19 |
| **total** | **243** | **6** | **$14.56** | **$14.21** | **$45.16** |

- Spent so far: **$0.52** (style test incl. three retries). Left under the cap: **$19.48**.
- **Plan: everything at medium** → ≈ $14.27 more including the lat-pulldown redo, total ≈ $14.8, leaving ≈ $5.2
  for about 85 targeted redos (the style test showed medium is enough; the faults were prompt geometry).
- What fits in the $19.48 left: all at medium ≈ 324 landscape pictures; all at high ≈ 105.
- Mixed options: owner side views at high (19 × $0.18 = $3.5) + the rest at medium = total ≈ $17.1 (fits, $2.9
  headroom). Owner priority 1 entirely at high + the rest at medium = ≈ $21.4 (does **not** fit).
- By priority at medium: P1 $3.21 (54 left), P2 $5.99 (101), P3 $4.08 (69), P4 $0.92 (13).

**Actuals (batch, 2026-11-08, all medium):**

| phase | pictures | cost |
| --- | ---: | ---: |
| style test (before the batch) | 9 | $0.52 |
| lat pulldown redo (try 3) | 1 | $0.06 |
| P1 | 54 | $3.15 |
| P1 redo | 17 | $0.88 |
| P2 | 97 | $4.91 |
| P2 redo | 14 | $0.64 |
| P3 | 73 | $3.55 |
| P2/P3 redo | 6 | $0.29 |
| P4 | 13 | $0.85 |
| **total** | **284** | **$14.86** |

- The real P2 to P4 costs came in under the estimates, because pictures without a reference cost $0.044 to $0.048.
- About $5.14 is left under the cap. A redo of every weak picture (9 × ≈ $0.05) plus a third Pallof try would cost
  about $0.55.

## Batch run commands

Run after the catalog merge, so the scenes pick up stream 02's setup and cues, and review between tiers:

```bash
node scripts/fitness-catalog-merge.mjs                          # content/fitness/exercises.json (preferred first)
python3 scripts/fitness-images.py plan                           # re-plan; read the attachment warnings, fix scenes.json
python3 scripts/fitness-images.py run --only lat-pulldown/sequence --force   # style-test defect (knee roller), ≈ $0.06
python3 scripts/fitness-images.py run --priority 1 --workers 3  # owner program: 20 seq + 20 sides + 18 machines ($3.15)
#   review P1 at full size (STYLE.md criteria); fix scenes.json/STYLE.md, re-plan, then --force only the failed keys
python3 scripts/fitness-images.py run --priority 2 --workers 3 --budget-usd 19  # alternatives $4.91
python3 scripts/fitness-images.py run --priority 3 --workers 3 --budget-usd 19  # the rest $3.55
python3 scripts/fitness-images.py run --priority 4 --workers 3 --budget-usd 19  # maps $0.85
#   redo a reviewed failure once:  run --force --workers 3 --budget-usd 19 --only key1,key2,...
python3 scripts/fitness-images.py status
node --test tests/fitness/images.test.mjs                        # contract + index up to date + cap
```

Each `run` rewrites `content/fitness/images.json`. Re-planning after any STYLE.md or scenes.json edit is
mandatory (`run` refuses otherwise). Existing pictures are never regenerated without `--force`.

## Status

Done (2026-11-08):

- `scripts/fitness-images.py` finished and hardened: plan/run/status/index; cumulative hard cap with locked
  reservations and parallel workers; run lock; stale-manifest guard; usage-based cost; timeout = charged, never
  blindly retried; key redaction; previous originals kept.
- Drawing data for all 138 exercises in `art/fitness/scenes.json`; STYLE.md gained the `side` block, moving-parts
  rule, profile rule and the cover text reused from the home covers.
- Style test at medium: chest press sequence (pass after one fix), lat pulldown sequence (pass with the knee-roller
  defect, queued as the batch's first redo), pec deck machine (pass), cover (pass). The side and muscle-map anchors
  were checked too (pass after one fix / pass). Verdicts in `art/fitness/style-review.md`.
- Cover: `art/covers/fitness.webp` → `public/covers/fitness.webp` 800×534 (31 KB), `public/share/fitness.jpg`
  1200×630 (replaces the placeholders).
- `content/fitness/images.json` indexes the 5 site pictures made so far (2 sequences, 1 side, 1 machine,
  1 muscle map). (Superseded by the batch below.)

Batch done (2026-11-08, stream 07.batch, all medium, `--workers 3`, P2–P4 with `--budget-usd 19`):

- **On the site: 241 pictures** in `content/fitness/images.json` (written by `node scripts/fitness-image-index.mjs`):

  | priority | sequences | side views | machines | muscle maps |
  | --- | --- | --- | --- | --- |
  | P1 | 19 / 20 | 20 / 20 | 18 / 18 | |
  | P2 | 67 | | 30 | |
  | P3 | 51 | | 22 | |
  | P4 | | | | 14 / 14 |

  The cover is also on the site. The missing P1 sequence is the Pallof press: it failed twice, so it was removed and
  the page shows its side view and cues.
- **Spend: $14.86 of $20** ($0.52 style test + $14.34 batch, including 37 redos). The table is in the "Budget plan"
  section.
- **Review.** Every picture was reviewed (P1 at web size; P2 and P3 at web size or on contact sheets; all muscle
  maps).

  | verdict | count |
  | --- | ---: |
  | pass, including minor defects | 232 |
  | weak, kept | 9 |
  | removed | 1 |

  Of the 37 try-1 failures, the single redo fixed 30. Six are weak (one kept its first try because the redo drew a
  different exercise), and one failed twice.

  | failure cause | count |
  | --- | ---: |
  | arrow direction | 11 |
  | seats on cable stations | 9 |
  | geometry or panels | 9 |
  | copied from the style reference | 6 |
  | equipment from the catalog | 2 |

  Full verdicts and the weak list are in `art/fitness/style-review.md` ("Batch run").
- **Fixes landed in the sources, not just the outputs.**
  - `scenes.json` 2026-11-08.11: per-exercise `note`, `seqNote`, `sideNote`, `machineNote`, `sidePath`, `fresh`,
    `uni` and `station`, plus picture-direction arrow paths.
  - `scripts/fitness-images.py`:
    - the arrow direction is spelled out in both builders;
    - the reference rule ("fresh" when the anchor would distort the picture);
    - `FREE_STANDING_CABLE`;
    - `station: false`;
    - `where()` uses the scene's own `eq`.
- **Weak pictures kept** (one defect each; redo candidates):
  - machine-row, cable-fly, lower-back-machine (sequence and side), cable-external-rotation, reverse-crunch,
    hip-adduction-machine: all the arrow;
  - rotary-torso-machine sequence: the turn is hard to read;
  - `machines/t-bar-row`: a muddled lever.

Review done (2026-11-09, stream 07 review, `--budget-usd 19`):

- **Every picture viewed at full size** with Read:
  - 58 P1, 97 P2 and 73 P3 pictures, 14 muscle maps and the cover;
  - each checked against the exercise's setup and cues and the STYLE.md criteria.
- **27 defective pictures regenerated and kept** for $1.62 (33 paid tries in six batches). Every try was viewed,
  and the better of old and new was kept. The Pallof press sequence is back, drawn from its own side view as the
  reference, so all 242 pictures are on the site.
- **New rules**:
  - `sequence-pair` layout and `"pair": true` for symmetric movements: two mirrored single-headed arrows;
  - bands are grey;
  - the negative block allows only the motion arrow or arrows the layout describes;
  - picture-direction wording in paths and notes.
- **Tests**: `tests/fitness/images.test.mjs` checks the new block, the grey-band rule, the `pair`/`fresh` flags
  and that every `pair` scene's prompt uses the pair arrows.
- **Spend: $16.48 of $20.**
- Table of fixes, tries not kept, the accepted minor defects and lessons 5–7: `art/fitness/style-review.md`
  ("Review 2026-11-09").

## Open questions

- Resolved 2026-11-09: `scripts/sync-content.sh` keeps `content/fitness` and `public/media/fitness` when it replaces
  the exported recipe trees, and rebuilds the fitness share image (`share art/covers/fitness.webp fitness`).
  `scripts/optimize-media.py` skips `fitness/` when it merges identical media, because merging would delete a file
  that content/fitness/images.json still points at.
- `v` is 8 hex digits as specified for images.json; the rest of the site uses 10 (`scripts/file-version.mjs`). Both
  work with the `?v=` cache rule and the offline catalog; the catalog should use the stored value, not recompute it.
- `art/covers/prompts.json` is rewritten by `scripts/make_covers.py` from its own list, so the fitness cover's prompt
  lives in `art/fitness/prompts.json` (key `cover`) instead.
- ~~**Pallof press sequence (owner program) is missing.**~~ Resolved 2026-11-09: retried with the side view as the
  reference and kept (the column sits about 45° behind; an elevated camera was ignored by the model).
  - What happened: it failed twice, both times a front view with the arms pressed sideways along the cable. Both
    tries are in `art/fitness/originals/_previous/`. The side view, a three-quarter view from the side away from the
    column, passed.
  - Next try (≈ $0.06): pass the passing side view as the reference (`run --only pallof-press/sequence --ref
    art/fitness/originals/pallof-press/side.webp`). A reference transfers composition, which is what this picture
    needs.
  - Caution: any later `run --priority N` regenerates it from the current scene, because it is a missing P1 picture.
- ~~**Arrows.**~~ Resolved 2026-11-09: picture-direction wording for the weak arrows and the mirrored pair for
  symmetric movements; an arrow-free variant was not needed. Background: 7 of the 9 weak pictures were arrows,
  and 11 of the 37 failures were reversed or ambiguous arrows.
  - Options: redo the weak ones with arrow-in-the-gap or picture-direction wording (≈ $0.35); for symmetric
    movements (adduction, flies), allow a pair of mirrored arrows; or offer an arrow-free variant.
  - This is a style decision for the owner.
- ~~**Bands are drawn orange in three band pictures.**~~ Resolved 2026-11-09: STYLE.md says bands are grey, and the
  three pictures were redrawn.
- ~~**Tracker picture without the caption.**~~ Resolved 2026-11-09: `ExerciseBlock.tsx` shows "Generated illustration —
  follow the cues" (RU too) under the tracker's technique picture (`.trk-tech-note`), as the exercise page does.
- **Minor picture defects accepted** (stray stacks and seats, a few machine proportions, the rotary-torso turn, the
  dead-bug arrow in END): listed in `art/fitness/style-review.md`. Redo them only if the owner trips over one.
- **Catalog equipment for the plate neck exercises** (stream 02). `neck-extension` and `neck-flexion` are filed
  "plate-loaded", and `gripper` is filed "band". The drawings no longer depend on that, but the site's equipment
  filter will list a weight plate under plate-loaded machines.

## Card thumbnails (added 2026-11-09, master)

The catalog list shows each exercise's sequence picture at about 112 px. Loading the 1200 px original for every card
cost about 40–60 KB each on gym signal, so `python scripts/fitness-thumbs.py` writes a 360 px WebP (about 6 KB) per
exercise picture to `public/media/fitness/thumbs/exercises/<id>/<angle>.webp` (inside `public/media/fitness`, which
`npm run sync` keeps) and records the source version in `art/fitness/thumbs.json`. The list requests
`thumbUrl(src)` (catalog.mjs) with the original's `?v=`, the offline save includes the thumbs, and
`tests/fitness/thumbs.test.mjs` fails when a picture changed without its thumb. After generating pictures:

```bash
python scripts/fitness-thumbs.py && node scripts/fitness-image-index.mjs
```

`npm run build` re-runs the index itself, so an unindexed picture cannot ship.
