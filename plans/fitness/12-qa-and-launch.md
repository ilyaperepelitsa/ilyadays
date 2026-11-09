# 12 — QA and launch

Status: checklist; run after every wave and before each push.

## Automated

```bash
npm test                 # includes tests/fitness/*.test.mjs
npm run typecheck
npm run lint
npm run build            # also rewrites public/offline-catalog.json
npm run check:cookies    # no cookies anywhere
```

## Database (dedicated ilyadays Supabase project)

1. Run `supabase/migrations/20261006110000_ilyadays_admin.sql` (once per project), then
   `supabase/migrations/20261108120000_fitness.sql` in SQL Editor.
2. Sign in on the site once; insert the owner profile (SQL in the migration's footer) or tap the in-app button.
3. Local check before touching Supabase: `bash scripts/fitness-sql-check.sh` (throwaway Homebrew Postgres 17, a
   Supabase stand-in, all three migrations with the fitness one twice, then 30 RLS assertions for visitor, stranger,
   owner and friend). It must end with "fitness SQL checks passed".

## Phone pass (360 × 780, 390 × 844 and 430 × 932), EN and RU

- `/fitness`: next session card, Start button reachable by thumb, tiles.
- `/fitness/train`: start → each set row 1 tap → steppers → rest timer → swap exercise → end; reload keeps the
  session; a session older than 6 h shows as auto-closed; next session shows progressed targets.
- `/fitness/program`: switch goal mode and days/week; weights convert; AI advisor needs a key and proposes a diff.
- `/fitness/exercises` and one exercise page: diagram loads, muscle map highlights, alternatives list.
- `/fitness/gyms`: create a gym, untick a machine, see the plan swap it.
- `/fitness/progress`: weigh-in entry, charts readable, empty states honest.
- `/fitness/nutrition`: calculators update live; table sorts.
- `/fitness/science/*`: readable, sources listed.
- Dark mode on every page.

## Modes

- Local mode (no Supabase env): everything works, note says "saved in this browser".
- Viewer (configured, signed out): sees the owner's data, cannot log.
- Synced (owner): writes reach Supabase; outbox drains after going offline and back.

## Publishing

Push `main`; Vercel GitHub integration deploys. Verify the production commit and `ilyadays.com`. Do not run a CLI
production deployment for the same commit.


## Gym copy: the training pages with no network (added 2026-11-09, master)

The rehearsal found that without "Save on this phone" (a 138 MB whole-site save) any navigation in a gym with no
signal showed the browser's offline page. Now `src/components/fitness/GymOffline.tsx` (mounted in `FitnessShell`)
registers `public/sw.js` on a training phone only (store mode synced, or local with at least one session; production
builds only) and, at most every 12 hours per language, asks the worker to warm the "gym copy" (`gym-runtime-v1`):
`/fitness`, `/fitness/train`, `/fitness/program`, `/fitness/gyms`, `/fitness/tools`, `/fitness/exercises` and the
active program's exercise pages, with the files they reference. Without a full save, the worker answers fitness
navigations network-first (3.5 s) with the gym copy as the fallback, keeps the files fitness pages load (cache-first
only for hashed `_next/static` files and `?v=` media), leaves every other request to the network, and never touches
`/_vercel/`. A full save, when present, still takes precedence. Tests: `tests/fitness/e2e/test_offline.py` (fully
offline reload, logging, hub and exercise navigation; visitors get no worker and no downloads).

## Test suite (added 2026-11-09, test-suite review)

### Running the tests

```bash
npm test                                      # every unit test (trips, offline, food, site, fitness): 783 tests, about 7 s
node --test tests/fitness/*.test.mjs          # the fitness files only (the glob in package.json picks up new files)
node --test tests/fitness/catalog.test.mjs    # one file
node --test --experimental-test-coverage \
  --test-coverage-include='src/lib/fitness/**' --test-coverage-include='src/lib/offline/**' \
  --test-coverage-include='scripts/**' tests/fitness/*.test.mjs tests/offline/*.test.mjs   # the coverage table below
npm run test:fitness:sql                      # bash scripts/fitness-sql-check.sh: migrations + 30 RLS cases, Postgres 17
npm run test:fitness:e2e                      # browser tests: production build (if none), next start, pytest
bash scripts/fitness-e2e.sh --build -k gym    # rebuild first; extra arguments go to pytest
```

- **SQL inside `npm test`:** `tests/fitness/sql.test.mjs` runs the same check when `initdb` and `pg_ctl` exist in
  `/opt/homebrew/opt/postgresql@17/bin` (or `PGBIN=<bin dir>`), and is skipped otherwise with "no Postgres at …"
  (`PGBIN=/nonexistent node --test tests/fitness/sql.test.mjs`: 1 skipped, 0.2 s).
- **Browser tests** (`tests/fitness/e2e/*.py`) need Python with Playwright: `/Users/ilyaperepelitsa/miniforge3/bin/python`,
  or set `PY=`. pytest-playwright is not installed; `conftest.py` wraps the sync API and stands in for the
  Vercel-only `/_vercel/` scripts. Tests find elements only by the §15 `data-testid` hooks. The build reads
  `.env.local`; today's production backend has no fitness tables, so the run exercises local mode.
- Node's coverage report lists only files a test loads. A module no test imports does not appear at all: that is how
  `i18n.ts`, `science.ts` and the catalog merge script sat at 0 % unnoticed.

### What each file covers

| File | Tests | What it pins |
| --- | ---: | --- |
| `advisor.test.mjs` | 10 | `advisor.mjs`: strict OpenAI schema, call and context, `validateProposal` (safe ranges, like-for-like swaps, ≤ 6 changes, legs only on request), `applyProposal`, change lines, adjustment rows |
| `analytics.test.mjs` | 34 | `analytics.mjs`: e1RM blend and reliability, effective load, session bests, hard sets, tonnage, weekly volume, EWMA, weekly rate, forecast, Theil–Sen intervals, PRs, plateau, Banister, ACWR, adherence |
| `catalog.test.mjs` | 46 | `catalog.mjs` + `catalog-core.mjs`: data vs registry and type unions, picture URLs, search folding and ranking tiers, alternatives at a gym, classes, labels and lookups, facets, muscle-map geometry, history rows |
| `catalog-merge.test.mjs` | 15 | `scripts/fitness-catalog-merge.mjs`: the shipped `exercises.json` is exactly the merge of the five slices; every rule's message; slice-file problems; `--check`/`--slice` never write; exit codes; a checkout path with spaces and Cyrillic |
| `gyms.test.mjs` | 21 | `gyms-core.mjs`/`gyms.mjs`: availability marks and checklists, quick setup, preferences, increments, plan at a gym vs `planSession` on seeded random gyms |
| `i18n.test.mjs` | 14 | `i18n.ts`: `pick`/`t2`, kg formatting (decimal mark, grouping, never "-0"), dates and times in the phone's zone (Istanbul), the m:ss clock, Russian plurals |
| `image-index.test.mjs` | 8 | `scripts/fitness-image-index.mjs` on fixture checkouts: angle order, `?v=` hashes, strays, `--check` vs write, started through a symlinked folder |
| `images.test.mjs` | 22 | stream 07 artefacts: pricing, STYLE.md, scenes, manifest, spend cap, prompt log; the real `images.json` is current and points at right-sized pictures; the cover |
| `markdown.test.mjs` | 29 | `markdown.mjs`: front matter, headings and contents, inline formatting, safe links, citations, lists, tables, callouts, escaping, word counts |
| `nutrition.test.mjs` | 57 | `nutrition.mjs`: BMR, TDEE, protein (lean-mass basis, cap), energy targets and warnings, weeks to goal, macros, the whole plan and its errors, heart-rate zones, VO2max, food search; `nutrition.json` integrity; `inputs-core.mjs` |
| `offline-pages.test.mjs` | 4 | the fitness part of the offline catalog: every fitness route exists in EN and RU; every static page, exercise page and topic is saved in both languages; no dead URL |
| `program-edit.test.mjs` | 16 | `program-edit.mjs`: goal bounds, every edit pure and bounded, current/default program, commit, readable diff lines |
| `progression.test.mjs` | 21 | `progression.mjs`: rounding, e1RM and %1RM, warm-ups, start loads, double progression, holds, failures and deloads, overshoot, calibration, carries, assisted machines, gaps, conversion, substitution |
| `science.test.mjs` | 88 | every topic file (front matter, sources, citations, length, sections, links, EN/RU mirror), `science-core.mjs`, `science.ts`, `safety.json`, the worked example replayed through the engine |
| `session.test.mjs` | 16 | `session.mjs`: 6 h auto-close, rotation, exercise resolution, `planSession`, `summarize`, `applySession`, the real catalog |
| `simulation.test.mjs` | 101 | seeded 12–52-week simulations of the owner's program (lifter profiles, gyms, a holiday, a swap): progression invariants |
| `sql.test.mjs` | 1 | the migrations and the 30 RLS cases on a throwaway Postgres (skipped without one) |
| `store-core.test.mjs` | 41 | `store-core.mjs`: row validation, upsert/remove, last-writer-wins merge, outbox, row mappers vs the migration, stale sessions, storage keys, adopting local data |
| `store-offline.test.mjs` | 29 | `store.ts` mode decisions without or with flaky signal, a missing migration, an expired session, the connection coming back (the slowest file, ≈ 6 s) |
| `store-sync.test.mjs` | 29 | `store.ts` local, synced and viewer modes against the in-memory Supabase stand-in `store-fake-supabase.mjs` |
| `templates.test.mjs` | 12 | `templates.mjs`: goal modes, %1RM table, owner template = registry, slots, supersets, build/convert/legs, session length, weekly volume |
| `thumbs.test.mjs` | 3 | card thumbnails: one per exercise picture, made from its current version, 360 px |
| `tools.test.mjs` | 19 | `tools.mjs`: load table, rounding to the machine, assisted machines, plates per side, warm-up, last working set |
| `tracker.test.mjs` | 33 | `tracker.mjs`: bootstrap, logging, rows and supersets, the running plan, rest timer, ending, reopening, auto-closed sessions, body weight and home cards, texts |

Browser tests: `test_pages.py` (every page at phone and desktop width, navigation, an exercise page), `test_tools.py`
(load calculator), `test_gym_session.py` (local-mode logging, a full rotation's progression, double tap, visitor, live
session, no signal, Russian small phone), `test_offline.py` (the gym copy offline).

### Coverage (lines / branches, %)

| Module | Before (2026-11-09) | After |
| --- | --- | --- |
| `scripts/fitness-catalog-merge.mjs` | not loaded (0) | 98.8 / 96.2 |
| `scripts/fitness-image-index.mjs` | 77.8 / 60.9 | 98.3 / 95.1 |
| `src/lib/fitness/i18n.ts` | not loaded (0) | 100 / 100 |
| `src/lib/fitness/science.ts` | not loaded (0) | 100 / 100 |
| `src/lib/fitness/science-core.mjs` | 100 / 90.6 | 100 / 100 |
| `src/lib/fitness/catalog-core.mjs` | 98.1 / 89.5 | 100 / 99.2 |
| `src/lib/fitness/catalog.mjs` | 99.5 / 91.8 | 99.5 / 95.7 (line 47: an angle other than sequence/side, which the naming contract does not produce) |
| `src/lib/fitness/nutrition.mjs` | 100 / 95.9 | 100 / 99.6 |
| `src/lib/offline/catalog.mjs` | 100 / 97.0 | 100 / 97.0 |

Other modules, owned by other reviewers (after): advisor 96.9 / 70.9, analytics 100 / 90.0, gyms-core 99.1 / 95.5,
gyms 100 / 87.5, markdown 96.1 / 88.8, program-edit 99.4 / 85.4, progression 100 / 93.4, session 100 / 89.5,
store-core 99.4 / 96.3, store.ts 94.3 / 82.3, templates 98.6 / 80.1, tools 100 / 98.8, tracker 98.0 / 82.7;
all files 98.5 / 88.6.

Bugs the review fixed (each with a failing test first): `fmtKg` printed "-0" for a flat body-weight rate (home card
"-0 kg/week"); `fmtClock` printed "NaN:NaN" for a slot without a rest time; the catalog merge script failed in a
checkout path with spaces or Cyrillic letters (`URL.pathname` is percent-encoded) and crashed with a TypeError on a
cue or mistake list without one language; the image index script silently did nothing (exit 0) when started through
a symlinked folder (macOS `/var`, a linked checkout), so `--check` could pass without checking.

Open gaps for the owners (as of this review): master plan §16 rule 4 (fewer working sets logged than planned → hold)
has no test; `holdUntil` is set, cleared and shown (program-edit, tracker) but no test pins the engine rule "no load
increase before it" (`progression.mjs`/`session.mjs` do not read it); `tracker.test.mjs` "a lighter load than
planned…" guards its outcome checks with `if`, so it passes while 1 of 4 logged sets progresses; `advisor.mjs` has the
lowest branch coverage (70.9 %).

## Final verification (2026-11-09, master, after every review)

All on one tree, after the last edit, in this order:

| Check | Result |
| --- | --- |
| `node scripts/fitness-catalog-merge.mjs --check` | 138 exercises OK |
| `scripts/fitness-thumbs.py --check`, `node scripts/fitness-image-index.mjs --check` | 158 thumbs and 242 pictures up to date |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` (whole repo) | 0 problems |
| `npm test` | 900 tests, 900 pass (786 in `tests/fitness`), about 7 s |
| `tests/fitness/*.test.mjs` with `TZ` = UTC, Los Angeles, Kiritimati, Istanbul, Pago Pago, Dubai, Havana, Lord Howe | 786 pass in every zone |
| `bash scripts/fitness-sql-check.sh` | 30 checks ok, "fitness SQL checks passed" |
| coverage (`node --test --experimental-test-coverage tests/fitness/*.test.mjs`) | all files: 98.66 % lines, 89.37 % branches, 96.93 % functions |
| `<ModeNote` outside `Shell.tsx` | none |
| `npm run build` | exit 0 |
| `bash scripts/fitness-e2e.sh` (production server, includes `test_offline.py`) | 95 passed |
| `scripts/fitness-qa.py --dark` | 328 page views, 0 problems (66 small targets, all inline citation numbers) |
| `npm run check:cookies`, and `-- --live` against `next start` | no cookie writes, no `Set-Cookie` |

The first sweep had one navigation timeout: the live Supabase project took 4–45 s to answer `fitness_owner_id`, and
`networkidle` waited for it. The sweep now answers the Supabase API itself as a project without the fitness tables
does (404 PGRST202/PGRST205); `--live-backend` calls the configured project instead.
