# 02 — Exercise catalog code, muscle map and exercise pages

Status: done (2026-11-08). Contract: `00-master-plan.md` §4–§7, §12, §15 (the master plan wins). Data:
`content/fitness/exercises.json` (138 exercises, merged and validated by `scripts/fitness-catalog-merge.mjs`),
`content/fitness/registry.json`, `content/fitness/images.json` (stream 07 naming contract).

## Scope

- Catalog lookups for every stream: labels for equipment, patterns and equivalence classes, search, images,
  owner program, class mates — pure `.mjs`, unit-tested.
- `/fitness/exercises` (EN + RU): search, faceted filters (muscle group, equipment, pattern), "machines first",
  "in my program" and "missing at my gym" badges.
- `/fitness/exercises/[id]` (138 × EN + RU, static): technique pictures per angle, machine picture, muscle map,
  facts, setup, cues, mistakes, warm-up ramp, alternatives (available at the active gym, class name), personal
  e1RM history, sources.
- `MuscleMap`: hand-authored inline SVG anatomy chart, front + back.

## Files (owned)

```
plans/fitness/02-exercise-catalog-and-alternatives.md   this plan
src/lib/fitness/catalog.mjs                     data-backed lookups (imports the JSON; server, engine, tests)
src/lib/fitness/catalog-core.mjs                import-free part for client bundles: labels, search, availability
src/components/fitness/exercises/shapes.mjs     muscle map geometry (left half authored, right half mirrored)
src/components/fitness/exercises/MuscleMap.tsx  SVG muscle map (no "use client": renders on server or client)
src/components/fitness/exercises/ExercisesBrowser.tsx   "use client" catalog list
src/components/fitness/exercises/ExerciseDetail.tsx     server: the exercise page body
src/components/fitness/exercises/ExerciseLive.tsx       "use client" islands: gym marks, program badge, history
src/components/fitness/exercises/useActive.ts           "use client" hook: active program, active gym, program slots
src/components/fitness/exercises/history.mjs            pure: per-session best set + e1RM rows for one exercise
src/views/fitness/ExercisesView.tsx, ExerciseView.tsx   server views (+ params and metadata helpers)
src/app/(en)/fitness/exercises/page.tsx, [id]/page.tsx   thin routes (same under src/app/ru/fitness/…)
src/styles/fitness/exercises.css                fx-* classes
tests/fitness/catalog.test.mjs
content/fitness/exercises.json (+ slices)       data fixes only, re-merged with the merge script
```

`scripts/fitness-image-index.mjs` already exists (written in the first wave, claimed by plan 07 and imported by
`tests/fitness/images.test.mjs`). It meets this stream's spec (sequence → side → alphabetical angles, `v` = first 8
hex of SHA-1, idempotent, ≈ 0.08 s), so it is kept unchanged and only run.

## Contract / API

`catalog.mjs` keeps every first-wave export and signature (`EXERCISES`, `MUSCLES`, `GROUPS`, `CLASSES`,
`OWNER_TEMPLATE`, `REGISTRY_VERSION`, `exerciseById`, `muscleById`, `groupById`, `isAvailable`, `alternativesFor`,
`exercisesForMuscle`, `groupsOf`, `groupOfMuscle`, `exercisesForGroup`, `equipmentLabel`) and adds:

- `EQUIPMENT`, `PATTERNS` (re-exported from core): `{ id, name: Text2, short: Text2 }[]` in display order;
  `MACHINE_EQUIPMENT` (selectorized, plate-loaded, cable, assisted, smith); `patternLabel(p, lang)`,
  `classLabel(classId, lang)`, `CLASS_NAMES`.
- `exerciseImages(id)` → `[{ angle, src: "/media/fitness/…webp?v=…", alt: Text2 }]` (sequence, side, …);
  `machineImage(id)` / `muscleImage(group)` → `{ src, alt } | null`. `EXERCISES[i].images` is filled from the same
  index (it was `[]` in the JSON).
- `searchExercises(query, lang)` → `Exercise[]` ranked (current-language name prefix > word prefix > all tokens in
  the name > other-language name > aka > id). Case-, diacritic- (NFD, ё = е) and punctuation-insensitive; tokens
  are ANDed; "pullup" finds "pull-up". Empty query → every exercise in catalog order.
- `ownerPrimary()` → the owner's A/B/C exercises (`registry.ownerTemplate`), slot order, once each.
- `classOf(id)` → the exercise's main class `{ id, pattern, slice, members }`; `classMates(id)` → other members of
  every class it belongs to, member order, no duplicates, no self.
- `muscleNames(lang)` → `Record<muscleId, string>` for the map's accessible title.
- Core (no imports): `foldText`, `searchItems(items, query, lang)`, `isAvailable(id, gym)`, `isMachine(eq)`,
  `programSlots(program, gym?)` → `Record<exerciseId, slotId[]>` (slot exercise or the gym's preferred swap).

`MuscleMap` props: `{ primary, secondary, groups?, compact?, lang, names?, className? }`. Primary (or in `groups`)
→ `var(--accent)`; secondary → `var(--accent-soft)` + accent outline; others `var(--surface-2)` + `var(--line)`.
Full map: `role="img"` + a spoken summary ("Muscles worked — main: …; also: …"), front and back figures
(`viewBox 0 0 200 420` each) side by side, wrapping under each other only below ≈ 274 px; every drawn muscle is a
`<path data-muscle data-group data-level>` with a `<title>`; the transverse abdominis (deep) is drawn dashed. Compact
(cards): one view cropped to the highlighted muscles (`compactCrop`: front or back by highlighted area), built from
`<use>` references into `<MuscleSprite />`, which a page renders once — the list page is 133 KB instead of 2.2 MB.

`exerciseHistory(snapshot, facts)` (history.mjs) → newest-first rows `{ sessionId, at, best, sets, e1rm, reliable }`:
warm-ups excluded, best set = the session's e1RM set (assisted machines need a body weight; holds and carries have no
e1RM and pick longer, then heavier).

Test hooks (§15): `exercise-tile` + `data-exercise-id` on each card link.

## Design decisions

- **Big JSON stays on the server.** `exercises.json` is 576 KB; client components get trimmed props from the
  server views and import only `catalog-core.mjs`, `analytics.mjs` (import-free) and `i18n.ts`. Never
  `catalog.mjs`/`progression.mjs`/`session.mjs` in client code (they pull the catalog into the bundle).
- **Detail page = server component with small client islands** (gym marks on alternatives, program badge, history),
  so the 276 static pages ship almost no JS. The warm-up table is computed at build time with stream 03's
  `warmupRamp` for the engine's first working load (`startingLoad`, 80 kg reference lifter), labelled as such.
- **Faceted chips.** Each filter row shows only options that still have matches under the other filters, with
  counts, so a 36-pattern row never offers an empty result. Rows scroll sideways on phones.
- **"Machines first" on by default** (the owner trains on machines); stable sort keeps the registry's preference
  order inside each block; it steps aside while a search ranks results.
- **Filters live in the URL** (`?q=&group=&eq=&pattern=&mf=0&mine=1`, `history.replaceState`), read after
  hydration: a filtered list can be shared or reloaded and the back button returns to it; no localStorage.
- **Muscle map geometry is data** (`shapes.mjs`): authored once for the left half, mirrored for the right, so the
  figure is symmetric and testable in Node (every registry muscle drawn, groups match the registry).
- **Search over both languages.** A Russian reader may type a machine's English model name; the current language
  only ranks results higher.
- Personal e1RM history uses `analytics.mjs` (`e1rmSeries`, `effectiveLoad`, `bodyweightLookup`) and stream 06's
  `LineChart` (dots, hollow = more than 12 reps, log scale on auto) when there are two or more sessions, plus a table.
- **Program badges render on the server from the owner template** and switch to the active program and gym after
  the store loads (`useActive`); `programSlots` also counts a gym's preferred swap (`gym.preferred`) as in-program.

## Acceptance checks

- [x] `node --test tests/fitness/catalog.test.mjs` passes, 37/37 (data integrity, images index shape + files, search,
      alternatives with a gym, images, class helpers, muscle-map geometry vs registry, history rows).
- [x] `npx tsc --noEmit` clean; `npx eslint` clean on this stream's files.
- [x] 360 px (EN + RU, light + dark, rendered with the real CSS): no horizontal scroll, chips scroll inside their row,
      cards ≥ 44 px targets; 960 px+: three-column list, two-column detail.
- [x] All 276 detail pages server-render without errors: ≥ 41 `[data-muscle]` paths and ≥ 3 links to other exercise
      pages each (the e2e check on `/fitness/exercises/pec-deck`); title and description in both languages.

## Status

Done (2026-11-08). `content/fitness/images.json` regenerated (all 138 exercises with pictures, 158 pictures, 51
machines, 1 muscle group at the time of writing); stream 07's batch keeps adding pictures, so re-run
`node scripts/fitness-image-index.mjs` after each batch run (`--check` fails while it is stale).

## Open questions

- `exerciseMeta` (meta.ts, master plan) declares link-preview images as 1200×630; exercise sequence pictures are
  1200×800 webp. Previews work, the declared size is off.
- Cards show the full 1200 px sequence webp in a 112 px thumbnail (lazy). A small thumbnail size from the image
  pipeline (stream 07) would save phone data on the list page.
- Lateral-raise style exercises (side delts only) crop to the back view in compact maps; acceptable, could prefer
  the front on ties.
