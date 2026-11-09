# Handover for Codex: ilyadays

Written 2026-11-09 by Claude Code at the end of the fitness build. Read this first, then
[`plans/fitness/00-master-plan.md`](plans/fitness/00-master-plan.md) (the contract for the fitness code) and
[`docs/fitness-setup.md`](docs/fitness-setup.md) (the owner's database steps). Run `.codex-memory/context --task "..."`
as usual. Memory authoring is disabled in this repo (`codex_authoring_mode: disabled`), so memory writes are blocked.

**Codex takeover:** see section 10 for current verification and changes after this original handover.

## 1. State

- **Fitness is finished locally and passes every check** (section 6): `/fitness`, with English at the root and Russian under `/ru`.
  It is a machine-first strength program with a one-tap gym log, automatic progression, technique diagrams, progress
  charts, nutrition, calculators, science pages and an AI plan adviser.
- **Nothing is committed.** The working tree holds two uncommitted streams together:
  - your Supabase / Google OAuth / travel-controls cutover ([`PLAN.md`](PLAN.md), [`docs/supabase-cutover.md`](docs/supabase-cutover.md));
  - the fitness section, which is built on top of it (section 2).
- `main` = `origin/main` = `bd8679e`. Vercel deploys every push to `main`, so the live site has neither stream yet.
- **Hosted database is now ready (Codex takeover).** A separate free Supabase `ilyadays` project exists with the
  admin, trip-state and fitness migrations installed. Google OAuth is enabled and the local app uses the new
  database. Owner sign-in/profile/sync, Vercel environment cutover and deploy remain pending. Production still uses
  the old backend, so fitness remains browser-only there.
- **Commit and push only when the owner asks** (section 7).

## 2. What is in the working tree

### Fitness (new paths, all untracked)

| Path | What |
| --- | --- |
| `src/lib/fitness/` | Pure engine modules (`.mjs`, no DOM), the store, types, i18n helpers |
| `src/components/fitness/<area>/` | UI by area: `home`, `train`, `program`, `progress`, `nutrition`, `gyms`, `tools`, `exercises`, `science`; `Shell.tsx`, `Provider.tsx`, `ModeNote.tsx`, `GymOffline.tsx` |
| `src/views/fitness/*View.tsx`, `src/app/(en)/fitness/`, `src/app/ru/fitness/` | Views and thin route files, 11 routes per language |
| `src/styles/fitness.css`, `src/styles/fitness/` | Styles (imported from `globals.css`) |
| `content/fitness/` | Catalog, templates and progression rules, nutrition table, safety, registry, science markdown (6 topics × EN/RU) |
| `public/media/fitness/` | Optimised diagrams: `exercises`, `machines`, `muscles`, `thumbs` |
| `art/fitness/` | Image prompts, scenes, style guide, spend log. `originals/` (252 MB) is git-ignored |
| `art/covers/fitness.webp`, `public/covers/fitness.webp`, `public/share/fitness.jpg` | Cover and share image |
| `supabase/migrations/20261108120000_fitness.sql` | 8 tables, RLS, `fitness_owner_id()`, `fitness_close_stale_sessions()`, Realtime |
| `scripts/fitness-*` | Catalog merge, image index, thumbs, image generator, SQL check, e2e runner, QA sweep |
| `tests/fitness/` | Unit tests (node:test), SQL checks, `e2e/` (Python Playwright + pytest) |
| `plans/fitness/` | Plans 00–13 and `research/`. The master plan wins over stream plans |
| `docs/fitness-setup.md` | Owner setup, offline behaviour, adviser, checks |

### Shared files: fitness hunks next to your hunks

Eighteen tracked files carry both streams. Do not revert either side.

| File | Fitness hunk |
| --- | --- |
| `package.json` | `build` runs `fitness-image-index.mjs` first; `test` includes `tests/fitness`; `test:fitness:sql`, `test:fitness:e2e` |
| `src/app/globals.css` | `@import "../styles/fitness.css" layer(recipes);` |
| `src/lib/i18n.ts` | Fitness nav label, home card text, fitness offline hint |
| `src/components/site/SiteHeader.tsx` | `fitness` section and nav link |
| `src/views/HomeView.tsx` | Fitness tile |
| `src/app/sitemap.ts` | Fitness routes, exercises, science topics |
| `src/lib/metadata.ts` | Image size for 1200×800 exercise diagrams |
| `src/components/site/OfflineSave.tsx` | Fitness-specific "Save on this phone" hint |
| `src/lib/offline/catalog.mjs`, `scripts/write-offline-catalog.mjs`, `tests/offline/catalog.test.mjs` | Fitness pages and diagrams in the offline catalog (`fitnessPages()`) |
| `public/sw.js` | The gym copy: cache `gym-runtime-v1` keeps fitness pages on a training phone without the full site save |
| `scripts/sync-content.sh` | Keeps `content/fitness` and `public/media/fitness` when recipes sync; builds the fitness share image |
| `scripts/optimize-media.py` | Skips `fitness/` when merging identical media (it would break `images.json` versions) |
| `.gitignore` | `art/fitness/originals/`, `art/fitness/.run.lock`, `output/` |
| `eslint.config.mjs` | Ignores `output/**` |
| `PLAN.md` | Steps 3 and 5 also run the fitness migration, `fitness-sql-check.sh` and "Create my fitness profile" |
| `README.md` | Fitness routes and commands |

### How fitness depends on the cutover

- Fitness imports `supabaseProject`, `isSupabaseConfigured` and the async `getSupabase()` from your
  `src/lib/supabase.ts`.
- The fitness migration needs your `20261006110000_ilyadays_admin.sql` (`ilyadays_admins`, `public.is_admin()`). Without
  it, the migration stops with an error and creates nothing. This keeps it out of a shared project.
- So fitness cannot be committed before the cutover. There are two choices, and they are the owner's:
  - one commit for both streams;
  - the cutover first, then fitness. This split needs `git add -p` on the 18 shared files.
- **Shipping before Supabase is safe.** Without the fitness tables, `fitness_owner_id` answers 404 PGRST202 and the
  section falls back to browser-only logging. The e2e suite and the QA sweep test exactly this.

## 3. How the fitness code works

- **Pages (EN and `/ru`):**
  - `/fitness`: hub with the next workout, Start, and this week;
  - `/fitness/train`: the gym log, one tap per set, rest timer, swaps, a summary, auto-close after 6 h;
  - `/fitness/program`: program editor, progression preview, holds, AI adviser;
  - `/fitness/progress`: charts, open to anyone;
  - `/fitness/nutrition`, `/fitness/gyms`, `/fitness/tools`;
  - `/fitness/exercises`, `/fitness/exercises/[id]` (138 exercises);
  - `/fitness/science`, `/fitness/science/[topic]` (topics: analytics, goals, longevity, nutrition, progression, safety).
- **Who can change things:** anyone can read; only the owner can write.
  - RLS: public `SELECT`; writes need the signed-in owner (or a profile row).
  - The UI hides logging from visitors.
  - The owner wants progress public and logging owner-only.
- **Store** (`store-core.mjs` is pure, `store.ts` does the I/O):
  - local-first with an outbox;
  - modes `local`, `synced`, `viewer`, `loading`;
  - the decision to sync times out after 10 s (`DECIDE_TIMEOUT_MS`);
  - a change the server refuses 5 times is set aside (dead-lettered) and the rest keep uploading;
  - a signed-in phone keeps logging offline;
  - the browser log uploads once on the first signed-in visit.
  - Ids must be UUIDs; a slug id keeps a row local-only.
- **Engine** (`progression.mjs`, `session.mjs`, `tracker.mjs`, `analytics.mjs`, `nutrition.mjs`, `tools.mjs`,
  `advisor.mjs`):
  - double progression with RIR;
  - e1RM is an Epley/Brzycki blend, and `loadFraction` is shared by the planner and `/fitness/tools`;
  - the rules from the 52-week simulation are in master plan §16:
    1. gap rounding;
    2. capacity guard and rep ceiling;
    3. easy-set jumps;
    4. incomplete logs hold;
    5. plateau memory (`ExerciseState.plateau`).
  - `ExerciseState.holdUntil` holds a load.
  - New `ExerciseState` fields travel in `fitness_exercise_state.spec` jsonb, so they need no SQL.
- **Generated files** (never edit them by hand):

  | File | Regenerate | Check |
  | --- | --- | --- |
  | `content/fitness/exercises.json` | `node scripts/fitness-catalog-merge.mjs` (from `content/fitness/exercises/<slice>.json`) | `--check` |
  | `content/fitness/images.json` | `node scripts/fitness-image-index.mjs` (also runs in `npm run build`) | `--check` |
  | `public/media/fitness/thumbs/` | `python3 scripts/fitness-thumbs.py` | `--check` |
  | `public/offline-catalog.json`, `public/offline-assets.js` | `node scripts/write-offline-catalog.mjs` (in `npm run build`, git-ignored) | — |
  | Diagrams | `scripts/fitness-images.py plan / run / status` | `status` |

## 4. Rules to keep

- **Phone first.** The owner uses a phone at the gym. Check 360, 390 and 430 px widths before desktop.
- **English and Russian for every page and string.** Use `pick(lang, en, ru)`. Russian lives under `/ru`.
- **No cookies.** Sessions stay in localStorage, and `npm run check:cookies` must pass.
- **Only `Shell.tsx` renders `<ModeNote>`.**
- **The test hooks are a contract.** The `data-testid` hooks in master plan §15 are used by the e2e tests; keep them
  when you change markup.
- **Plan ownership.** Master plan §4 says which plan owns each file, and §16 records the accepted decisions and quirks.
- **Image budget.** Images are capped at $20 in total, and $16.48 is spent (`python3 scripts/fitness-images.py status`).
  The script refuses runs over the budget.
- **Number and unit together.** `keepUnits()` in `src/lib/fitness/i18n.ts` keeps a number and its unit on one line
  in nutrition copy. In JSX use `{" "}`.
- **Time zones.** The fitness tests pass in 8 time zones. Build test dates from local `Date` parts, not UTC strings.
- **Where content is edited.** Recipes are edited in `../recipes`, then `npm run sync`. The Istanbul planner is edited
  in `../istanbul_trip`. Fitness content is authored in this repo.
- **Never use the `work` project-memory ecosystem.** This repo is `personal-git`.

## 5. Supabase setup (the owner's steps, not done)

Details are in [`docs/fitness-setup.md`](docs/fitness-setup.md), together with the cutover guide.

1. Create the dedicated Supabase project and Google sign-in (cutover guide §2–3).
2. Run these in the SQL Editor, in order:
   1. `20261006110000_ilyadays_admin.sql`
   2. `20261006120000_trip_state.sql`
   3. `20261108120000_fitness.sql`
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and in Vercel, then
   redeploy.
4. Sign in with Google, then add the owner's user id to `ilyadays_admins` (cutover guide §4).
5. Open `/fitness` while signed in and tap **Create my fitness profile**. The phone's browser log then uploads once.

## 6. Checks

The last full run on this tree passed every check below. It ran before the round-2 repair in section 8, so run it
again once that lands.

```bash
PY=/Users/ilyaperepelitsa/miniforge3/bin/python    # has pytest and Playwright; the system python3 lacks Playwright
node scripts/fitness-catalog-merge.mjs --check      # 138 exercises OK
python3 scripts/fitness-thumbs.py --check           # 158 thumbs up to date
node scripts/fitness-image-index.mjs --check        # 242 pictures up to date
npx tsc --noEmit                                    # exit 0
npx eslint                                          # 0 problems
npm test                                            # 900/900 (786 fitness), ~7 s; includes the SQL check if Postgres is found
npm run test:fitness:sql                            # migrations twice + 30 RLS checks on a throwaway Postgres 17
node --test --experimental-test-coverage tests/fitness/*.test.mjs   # 98.66 % lines, 89.37 % branches
! grep -rn "<ModeNote" src | grep -v src/components/fitness/Shell.tsx
npm run build
npm run test:fitness:e2e                            # 95 passed (production build; --build rebuilds)
npx next start -p 3131 &                            # wait until http://localhost:3131/fitness answers, then:
$PY scripts/fitness-qa.py --base http://localhost:3131 --dark   # 328 views, 0 problems; stop the server after
npm run check:cookies && npm run check:cookies -- --live   # --live needs `next start` on :3000
```

- **Python.** The e2e runner uses `$PY` by default (override it with `PY=`). The system `python3` has Pillow, which
  is enough for the thumbs and the image status, but not Playwright, so the QA sweep needs `$PY`.
- **Postgres.** `PGBIN` defaults to Homebrew `postgresql@17`. Without it, the SQL test is skipped.
- **e2e against `next dev`.** Set `FITNESS_E2E_BASE=http://localhost:3000 FITNESS_E2E_DEV=1`; the offline tests are
  skipped. `FITNESS_E2E_SHOTS=dir` saves screenshots.
- **The QA sweep's Supabase stub.** By default the sweep answers Supabase itself, as a project without the fitness
  tables. `--live-backend` calls the real project instead; the shared project took 4–45 s to answer.
- **Simulation report.** `FITNESS_SIM_REPORT=1 node --test tests/fitness/simulation.test.mjs` prints the 52-week
  trajectories.
- **Time-zone run.** Run the fitness tests in other zones with
  `TZ=Pacific/Kiritimati node --test tests/fitness/*.test.mjs`.
- **`output/`.** It holds about 836 MB of git-ignored QA screenshots and logs. It is safe to delete.

## 7. Commit and deploy

- **Only on the owner's go-ahead.** Pushes must use the owner's GitHub account; the default `gh` account gets a 403:

  ```bash
  git -c credential.helper= -c credential.helper='!f() { echo username=ilyaperepelitsa; echo "password=$(gh auth token -h github.com -u ilyaperepelitsa)"; }; f' push origin main
  ```

- **Vercel deploys every push to `main`.** The production acceptance list is in `PLAN.md` §7.
- **After deploy:** open `/fitness` once on the training phone on wifi so the gym copy is ready offline.

## 8. In flight when this was written

A round-2 repair of 12 minor review findings was running in Claude Code. If the code differs from this list, it has
landed.

- **Engine:**
  - the Russian deload note "уберите отягощение (−10 %)" appears on 0 kg bodyweight exercises;
  - an expired `holdUntil` is not cleared when a slot is skipped or has only warm-ups;
  - Russian assisted wording: "нагрузки", and "вес" vs "нагрузка";
  - more `rpe`-rule plan/note mismatches;
  - "Start lighter: no assistance" appears where the load cannot go lighter;
  - the simulation's 2 s budget once failed under machine load;
  - plan 03 count ("13 of them").
- **Nutrition:**
  - the e2e 360 px guard should assert that its clicks opened the rows;
  - 5 of 20 `keepUnits` mutants survive the tests;
  - the caffeine line reads "400–400 mg" for body weights of 132–250 kg (an older bug).

## 9. Open items and owner decisions

- **Your cutover.** `PLAN.md` steps 1–7, account access to production acceptance, are all still open.
- **Plateau memory leaves a rare retry.** Of 400 simulated stalled years not used to tune the rule, 19 had a third
  deload from the same load (4.75 %) and 1 a fourth, against 361 and 202 before rule 5.
  - A permanent stall rule was rejected on purpose.
  - A few random years still deload the hammer curl twice from 10 kg.
- **Nutrition typography.** Serving measures and «тыс.» are covered by `keepUnits` after the takeover (section 10).
  `×` formulas can still wrap.
- **Privacy.** The owner's `settings` (body weight, height, birth year, sex) are world-readable with the rest of the log.
  Plan 01 open question 4 and plan 11 cover hiding them before friends join.
- **Not now** (master plan §16):
  - syncing today-only swaps and skips (`fitness_sessions.ui jsonb`);
  - an `ownerKnown` flag, so visitors see a skeleton instead of the template plan for a moment;
  - a slim engine catalog (about 100 KB gzipped);
  - a VO2max test log;
  - session RPE for the Banister model;
  - per-muscle set targets;
  - `Gym.checked`.
- **Contract tidy-ups.** Master §7 now matches the implemented APIs, and stale `Program.active` and test-hook
  questions are marked resolved. `ExerciseSlot.role` remains inferred from its template/exercise; persisting an
  explicit role for custom slots is a possible later enhancement.

## 10. Codex takeover (2026-11-09)

- The round-2 fixes described in section 8 are present in the current code. The repository suite now has 951 tests;
  all pass. TypeScript, whole-repo ESLint, the production build, generated catalog/media checks and all 30 local
  PostgreSQL access checks pass.
- Extended `keepUnits` to serving measures in EN/RU and «тыс.», including both spaces in «4 ст. ложки».
  Existing unit/content tests and the 360 px nutrition browser check cover the added cases.
- Added the missing 430 px phone viewport to `scripts/fitness-qa.py` and its default sweep.
- The live cookie audit now checks every fitness route type in EN/RU. Set `COOKIE_AUDIT_BASE` to use a server
  other than `http://localhost:3000`. Build and live audits pass, including all 22 fitness URLs.
- Full production browser suite: 97 passed. After rebuilding the typography change, the six nutrition browser
  checks also pass against that final build.
- Final screenshot sweep: 410 page views, zero problems across EN/RU, 360/390/430 px phones, desktop and dark mode.
  Reports and screenshots: `output/fitness-handover-qa/{en,ru}/report.json` (git-ignored). This covers 41 paths per
  language: the fixed pages, owner exercise pages, six other exercises and every science topic.
- `.codex-memory/context` is absent in this checkout. The equivalent
  `python3 /Users/ilyaperepelitsa/.codex/plugins/codex-project-memory/scripts/pm_repo.py context --task "..." --path ...`
  works. `pm_repo.py delta --pending` reports no pending paths; authoring remains disabled.
- Cloud setup, phone sign-in/sync, production acceptance, commit and push remain pending. No cloud settings or
  environment values were changed, and neither uncommitted stream was reverted.
- Launch-access recheck: the configured backend still returns HTTP 404 / PGRST205 for `trip_state` and HTTP 404 /
  PGRST202 for `fitness_owner_id`; no progress export was written. Google auth is enabled on that backend, which
  does not establish the dedicated-project cutover. No dashboard browser is connected. Supabase and Vercel
  integrations were found in the plugin directory and offered for connection; neither was installed or connected
  at the time of this check. Continue from confirmed connection state rather than repeating the offer.
- Latest update: the owner installed both integrations. The plugin directory now confirms `installed: true` for
  Supabase and Vercel. This existing conversation still exposes neither integration's tools, so project access and
  OAuth connection state cannot yet be verified. Start a fresh Codex conversation in this repo to load them and
  continue the cutover; do not ask the owner to install them again. Commit and push still require the owner's go-ahead.
- Remaining local contract pass: added the missing `src/lib/fitness/index.ts` from master §4, re-exporting the shared
  types and public engine functions. Master §7 now names the real functions/options (including session application,
  range conversion, weekly volume, ACWR, nutrition and adviser calls), and stale resolved questions in plans 01/03/04
  are corrected. UI imports remain at their leaf modules. TypeScript, lint and production build pass; 97 targeted
  template/progression/session/adviser tests pass. A public-entry-point smoke check planned day A, logged 25 sets,
  updated six states, summarized it, verified idempotent replay and planned day B.
- CLI access is now available: both integrations' tools load. Supabase lists only `typekana`
  (`tbwzyxakskvgvoiqjrlb`) in the free personal organization `ilyaperepelitsa` (`prfjdcoucpakjoyuxkzq`). A read-only
  `pg_catalog` query confirms `trip_state` is absent in every schema, so any Istanbul progress recovery must come
  from a browser copy. The owner has been asked which organization should host the new dedicated `ilyadays` project;
  project creation has not been attempted. Vercel responds 403 for team `team_WIaaOlgeSjCwOu531IfYiTOc`
  (`ilyaperepelitsa-gmailcoms-projects`); `authorize_team_access` returned a one-time consent link for the owner.
  After approval, retry `list_projects` on the same connection. Do not repeat installation/reconnection advice.
- Hosted setup completed after the owner's free-project request: Supabase quoted **$0/month**, and created
  `ilyadays` (`mnqfdfxyodkakthxuwkw`) in `ilyaperepelitsa` (`prfjdcoucpakjoyuxkzq`), `eu-north-1`. Both projects
  are `ACTIVE_HEALTHY`; Typekana was unchanged. New dashboard:
  `https://supabase.com/dashboard/project/mnqfdfxyodkakthxuwkw`.
- All three prepared migrations were applied in order. Hosted history: `20261109131046 ilyadays_admin`,
  `20261109131047 trip_state`, `20261109131048 fitness` (MCP-generated versions differ from local filenames).
  Ten public tables have RLS, public data tables allow anonymous reads but not inserts, the admin table grants
  neither, and Realtime contains `trip_state`, sessions, sets, exercise state and bodyweight. Owner/admin rows remain
  empty until real sign-in. Security advisors report the deliberate private admin table with no policy and the
  explicitly granted lookup RPCs (is_admin, fitness_can_write, fitness_owner_id); these implement the access model.
- Vercel team approval succeeded. Verified target: team `team_WIaaOlgeSjCwOu531IfYiTOc`, project
  `prj_RixiWFfDS6JfFAvm0VzLlYQat4Lg`, name `ilyadays`, domains include `ilyadays.com` and `www.ilyadays.com`.
  Environment listing returned no variables. No Vercel settings or deployments were changed.
- New URL/publishable key are staged in git-ignored `output/supabase-cutover/ilyadays.env`. `.env.local` remains
  unchanged while Google OAuth is pending. Required Google callback:
  `https://mnqfdfxyodkakthxuwkw.supabase.co/auth/v1/callback`.
- Google configuration is now saved. The downloaded Web client JSON identifies project `ilyadays`, both production
  origins and `http://localhost:3000`, and the exact callback above. Google is enabled in `/auth/v1/settings`; a PKCE
  request redirects to the intended Google client and Supabase callback. The client secret stays in its original
  download/Supabase provider, never in frontend env files or Git.
- `.env.local` now points at the new project with the publishable key; the legacy anon-key entry was removed and
  unrelated variables preserved. Old configuration backup (0600, outside Git):
  `~/.local/share/ilyadays/backups/env.local.pre-cutover.20261109T133324466628Z`.
  `.vercel/project.json` (git-ignored) records the verified existing team/project IDs.
- Production build and typecheck pass with the new backend; the live local page and its browser scripts use it.
  Local production server is running on `http://localhost:3000/fitness` for the owner to sign in. The owner has been
  asked which Google email to grant admin access to; do not grant admin to an unverified first user. Production
  environment, commit and push remain unchanged/pending.
- Per-exercise baseline and missed-rep expansion (2026-11-09): added provisional/established baseline evidence in
  `ExerciseState.spec`, an inline bilingual calibration guide, explicit-versus-assumed effort provenance, and
  conservative next-set advice (within-range miss → same load/fewer reps; below range/excessive effort → one easier
  step; inverse for assisted equipment). Original row targets and actual performance stay separate; each set also
  retains its effective suggestion/reason/source. No automatic within-session weight increase.
- New sessions freeze starting program, gym increments, states and prescription in `Session.plan`; evaluation and
  reload use it. Explicit swaps and current equipment availability still work, matching-unit swaps retain the slot's
  range, and holds explicitly set/cleared during training remain effective. Missing prescribed row identities cannot
  be hidden by added sets, including after swaps. Incomplete/failed work cannot earn a heavier next-visit anchor,
  including manually attempted heavier loads or the RPE best-set override. Calibration raises also pass the
  weakest-set capacity guard. Provisional status after visit one does not suspend the ordinary failure ladder.
- Additive migration `20261109135752_fitness_calibration.sql` was CLI-generated and tested twice locally, then applied
  only to the new ilyadays backend as hosted `20261109135944 fitness_calibration`: nullable `fitness_sessions.plan`
  and `fitness_sets.prescription` JSONB. RLS stays enabled; new fields return HTTP 200 through anonymous REST;
  owner writes and stranger-denial/metadata round trips pass in the local SQL harness. No Typekana changes.
- Evidence/heuristics distinction is documented in both progression science articles and master §17: ACSM 2026,
  PMID 41843416, supports individualization and sufficient effort without required failure; PMID 34542869 supports
  caution with RIR estimates. Exact baseline confirmation and next-set adjustments are app defaults, not proven
  individual prescriptions. Baseline weights are per exercise, not inferred from a global muscle-strength score.
- Verification: 966 unit/integration/simulation tests, TypeScript, lint, production build and SQL ownership checks
  pass. All 15 workout browser checks pass (swaps, reopen, EN/RU phone, missed reps and reload included).
  Phone screenshots visually reviewed: `output/fitness-calibration/01-baseline-guide.png` and
  `02-actual-eight-next-eight.png`. New regressions: `tests/fitness/calibration.test.mjs`;
  browser scenario: `test_missed_reps_are_preserved_and_advice_survives_reload`. Local production server restored at
  `http://localhost:3000/fitness`. Owner email/admin grant, real owner sync, production environment and deploy remain
  pending; no commit or push was made.

- Ten critique/fix passes and the user's added personal-profile/travel/design scope are complete locally; the closure
  inventory, individual findings and exact evidence are in `docs/development-review-10-loops.md`. Self-service
  accounts are private non-owners; profile-wide public sharing is explicit. Private drafts clear across account
  changes. Personal goals, durable muscle exclusions (including strict no-legs), custom constructor and versioned
  pivots preserve exercise baselines and frozen running workouts. Body circumferences are independent dated cm
  records with separate left/right sites; dated bodyweight and actual exercise loads remain independent.
- Hosted migration `20261109143733 fitness_profiles_self_service` maps to local
  `20261109142245_fitness_profiles_self_service.sql`. It adds private registration/update RPCs with expected-account
  checks, privacy policies and `fitness_measurements`. Hosted RLS confirmed on all nine fitness tables; anonymous
  registration denied, authenticated registration granted, visibility defaults false. Native privacy/measurement SQL
  checks pass. Intentional lookup/profile RPC SECURITY DEFINER advisor notices remain reviewed, not silently waived.
- Trip creation supports optional stay dates, explicit destination time zone and live source-confirmed event
  suggestions. User acceptance creates immutable dated commitments; schedules/rebuilds preserve them and reject
  conflicts. Verification uses authenticated bounded public-HTTPS/DNS-pinned fetching, normalized UTC/DST dates,
  valid end dates, destroyed rejected streams and bounded linear/sanitized publisher parsing. No tickets are bought.
  Source coverage and existing newest-20-browser-trips retention are explicit in `docs/trip-planning.md`.
- New site-wide navigation keeps Fitness visible; home has a Fitness-first plan action and compact mobile cards.
  Per-set guidance now explains “10 planned, can do15”: if15 is a maximum and targetRIR2, about13 leaves reserve;
  actual15 remains loggable. Reported easy work can suggest one extra rep, same kg, within range, with no earlier
  misses. Assumed effort never earns that suggestion. Exact thresholds remain conservative coaching defaults.
- Final verification: **1,015 automated tests**, TypeScript, ESLint, production build and native SQL checks pass.
  **106 unique fitness browser checks** verified (105 passed together; one external network-idle timeout passed
  targeted retry) plus **7 trip creation browser scenarios**. **40 EN/RU viewport views** at360/390/430/1280 had
  HTTP200, no errors or horizontal overflow; screenshots in `output/site-and-personal-plans-qa/` were inspected.
- The owner explicitly prefers no cookies. First-party auth/preferences/data use localStorage; final build scan
  and live local response audits pass with no cookie writes or Set-Cookie. Google may use cookies on its own origin.
  README wording is scoped accurately to this site. No cookie consent banner or cookie session layer was added.
- Local preview is restored at `http://localhost:3000` (production server). All feature work remains uncommitted and
  unpublished. User go-ahead for push/deploy is still required by section7; pushing main deploys Vercel. Before
  publishing, set verified new-project URL/publishable key in Vercel and follow the existing cutover/owner-sync
  acceptance checklist. Typekana was untouched. Do not blindly db-push local filenames over MCP-generated hosted
  migration timestamps. Project-memory pending queue remains empty.


## 11. Production release authorized (2026-11-09)

The owner explicitly requested further UI polish and a production push. “mprod” was resolved against the real
repository/environment: only `main` exists, and Vercel's current production deployment is Git-sourced from
`origin/main`; the intended target is the existing ilyadays project and `ilyadays.com`, not a new branch or site.
The existing owner GitHub account is active and matches the configured commit author.

The final polish adds a clearer Fitness hero, personal setup steps, useful profile entry points, cleaner form
hierarchy/focus states and a first-visit path that does not present an unpublished sample as someone's real workout.
Redundant signup panels are removed from the profile and unpublished-owner overview. EN/RU and the warm site
design are retained. TypeScript, lint/build and the 1,015-test suite pass; the polish browser/visual checks and
production verification are retained under `output/` and summarized in the release result.

Vercel production now has exactly the dedicated project's public URL and publishable key. There are no legacy
anon-key overrides to remove. Google secrets, `.env.local`, `.vercel/` and QA output stay outside Git. A credential
scan of the release candidates found no private keys/tokens/client secrets. All supplied fitness, cutover/travel
and existing shared-file changes ship together; no existing stream was reverted.

Release method: commit reviewed work to `main`, push with the owner's GitHub credentials, follow that exact commit
through Git → Vercel, then verify custom-domain routes, mobile/desktop UI, project wiring and first-party
Set-Cookie behavior. No duplicate CLI deployment is needed while Git builds the approved commit. Actual owner
Google interaction/first profile use remains the user's own sign-in; no account is guessed or promoted.
