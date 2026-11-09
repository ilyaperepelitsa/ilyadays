# Fitness section — master plan

Status: in progress · Started 2026-11-08 (Sunday) · First gym session planned Tue/Wed 2026-11-10/11.

This folder holds one plan per work stream (`NN-*.md`) plus the evidence research under `research/`. Every stream
plan states its scope, files, contracts, acceptance checks and open questions. The master plan is the contract that
keeps parallel streams compatible. **When a stream plan and this file disagree, this file wins; fix the stream plan.**

## 1. What we are building

A science-based gym planner and tracker on ilyadays.com that replaces a personal coach:

- **Goal modes** (strength · hypertrophy · recomposition/fat loss · endurance · maintenance) with evidence-backed
  training variables and a conversion table for switching modes mid-program.
- **A program** for the owner: 3 days/week, upper body + core, strength-leaning fat-loss phase, pec priority, strong
  back, arm strength, ab strength, longevity add-ons (bone loading, VO2max). No legs at first; legs are an optional
  add-on block. 2-day fallback and 4-day option exist as templates.
- **Exercise + machine catalog** with muscle maps, technique diagrams (generated), cues, mistakes, and ordered
  **alternatives** so a missing machine is swapped in two taps.
- **Gym profiles**: name a gym, tick which machines it has, mark favourites. The planner resolves every slot to the
  best available exercise for the active gym.
- **Session tracker** (mobile-first, one-thumb): Start session → each planned set is a big row; 1 tap = "did it as
  planned", +/- steppers for reps/weight, RIR picker, rest timer, auto-save. End session, or auto-close 6 h after
  start. The next session's targets are computed automatically from the logged sets (double progression with RIR
  autoregulation, deload and gap rules).
- **Progress**: e1RM per exercise with trend and uncertainty, weekly hard sets and tonnage per muscle group, body
  weight with EWMA trend and weekly rate, adherence calendar, Banister fitness–fatigue model, PRs, time-to-goal.
- **Science pages**: goals & programming, progression, injury prevention & warm-up & technique, longevity,
  nutrition — bilingual, with citations.
- **Nutrition calculators**: TDEE, protein target by goal, deficit/surplus, expected rate, protein food table.
- **AI advisor** (optional, owner's own OpenAI key kept in localStorage like the trip planner): structured-output
  proposals to adjust the plan (reduce days, delay increases, swap exercises) that the owner reviews and applies.
- **Profiles** (later): friends can train with their own plan. The schema is per-user from day one.

## 2. Non-negotiable product rules

1. **Phone first.** Design at 360–430 px. Touch targets ≥ 44 px. Primary actions in the thumb zone (bottom).
2. **Fewest taps.** 1 tap logs a set exactly as planned; 2 taps adjust it. No typing during a session.
3. **Local-first, sync when possible.** Everything works in this browser with no Supabase (localStorage). When
   Supabase is configured and the owner is signed in, writes go to a local outbox and sync; reads are cached.
4. **Only the owner can log**, visitors can watch. Writes are gated by RLS (`user_id = auth.uid()` and
   `public.fitness_can_write()`); the UI fails closed like the Istanbul app.
5. **No cookies, no server code.** Static pages (SSG) + client components, exactly like the rest of the site.
6. **Bilingual.** Every string EN + RU. Fitness components keep their own strings inline with
   `pick(lang, en, ru)` from `src/lib/fitness/i18n.ts` — do not edit `src/lib/i18n.ts` except the nav/home strings
   the master plan owns.
7. **Everything scientific is cited.** Numbers in content JSON carry a `source` field; science pages carry a
   numbered sources list. No invented studies.
8. **kg only** for now (`weightKg` fields). A unit toggle is a later stream.
9. **Dark mode works** (CSS tokens from `food.css` only — never hard-code colours).
10. **No new runtime dependencies.** Charts are hand-rolled SVG. Markdown for science pages is rendered at build by
    our own tiny renderer.

## 3. Routes (EN at root, RU under /ru — every page in both)

| Path | View | Purpose |
| --- | --- | --- |
| `/fitness` | `FitnessHomeView` | Hub: next session card (day, exercises, targets), Start button, tiles to every sub-page, weekly status |
| `/fitness/train` | `TrainView` | The session tracker. Public: shows the plan and any live/last session. Owner: logs |
| `/fitness/program` | `ProgramView` | Program: goal mode switch, days/week, the A/B/C days with slots, progression settings, template picker, AI advisor |
| `/fitness/exercises` | `ExercisesView` | Catalog with filters (muscle, equipment, pattern), search |
| `/fitness/exercises/[id]` | `ExerciseView` | Diagrams (angles), muscle map, cues, mistakes, warm-up ramp, alternatives, personal history chart |
| `/fitness/gyms` | `GymsView` | Gym profiles: create/select gym, tick equipment, favourites |
| `/fitness/progress` | `ProgressView` | Charts + weigh-in entry + PRs + adherence |
| `/fitness/science` | `ScienceIndexView` | Index of explainers |
| `/fitness/science/[topic]` | `ScienceView` | One explainer (goals, progression, safety, longevity, nutrition) |
| `/fitness/nutrition` | `NutritionView` | Calculators + protein table |
| `/fitness/tools` | `ToolsView` | Load calculator: e1RM from any set, kg for any reps × RIR rounded to the machine's increment, warm-up ramp, plates per side (master-owned: `src/lib/fitness/tools.mjs`, `src/components/fitness/tools/*`, `src/styles/fitness/tools.css`) |

Route files are thin: `src/app/(en)/fitness/**/page.tsx` and `src/app/ru/fitness/**/page.tsx` import a view from
`src/views/fitness/*.tsx` and metadata from `src/views/fitness/meta.ts`. Dynamic routes use `generateStaticParams`.

## 4. File ownership (one stream per path; do not edit another stream's files)

```
plans/fitness/                          this folder (each stream writes/updates its own NN-*.md)
supabase/migrations/20261108120000_fitness.sql      stream 01 (written by the master plan; stream 01 may amend)
src/lib/fitness/types.ts                CONTRACT (master plan). Add fields only; never rename.
src/lib/fitness/i18n.ts                 pick(), number/date formatting (master plan)
src/lib/fitness/catalog.mjs             stream 02: exercises, muscles, equipment, alternatives, lookups
src/lib/fitness/templates.mjs           stream 03: goal modes, split templates, progression rule sets
src/lib/fitness/progression.mjs         stream 03: rounding, warm-up ramp, init, next targets, deload, gaps
src/lib/fitness/session.mjs             stream 03: plan a session for a day + gym, status machine (6 h), next day
src/lib/fitness/analytics.mjs           stream 06: e1RM, volume, EWMA, Theil–Sen, Banister, ACWR, forecasts
src/lib/fitness/nutrition.mjs           stream 09: TDEE, protein, deficit, timeline, VO2max estimators
src/lib/fitness/advisor.mjs             stream 10: OpenAI call builders + schema + apply()
src/lib/fitness/store.ts                stream 01: local-first store + Supabase sync (implements FitnessStore)
src/lib/fitness/markdown.mjs            stream 08: tiny markdown → HTML for science pages
src/lib/fitness/index.ts                typed re-exports (each stream adds its own exports; append-only)
src/components/fitness/Provider.tsx     stream 01: FitnessProvider (auth + store + snapshot via useSyncExternalStore)
src/components/fitness/train/*          stream 04: SessionTracker, SetRow, RestTimer, Steppers, SwapSheet
src/components/fitness/program/*        stream 03/10: ProgramEditor, ModeSwitch, DaysSwitch, AdvisorPanel
src/components/fitness/exercises/*      stream 02/07: ExerciseCard, ExerciseDetail, MuscleMap (SVG), Diagram
src/components/fitness/gyms/*           stream 05: GymProfiles
src/components/fitness/progress/*       stream 06: charts (LineChart, Bars, Heatmap, Calendar), BodyweightLog
src/components/fitness/nutrition/*      stream 09
src/components/fitness/science/*        stream 08
src/views/fitness/*.tsx, meta.ts        each stream adds its own view(s); FitnessHomeView is stream 04
src/app/(en)/fitness/**, src/app/ru/fitness/**   each stream adds its own routes
src/styles/fitness.css                  SHARED — append-only, each stream adds a clearly commented block
content/fitness/exercises.json          stream 02
content/fitness/muscles.json            stream 02
content/fitness/templates.json          stream 03 (goal modes + split templates + progression params)
content/fitness/safety.json             stream 08 (warm-up ramp, pain rules, cue library by family)
content/fitness/nutrition.json          stream 09 (food table, constants)
content/fitness/science/<topic>.{en,ru}.md   stream 08
public/media/fitness/**                 stream 07 (generated diagrams); art/fitness/** prompts + logs
scripts/fitness-images.py               stream 07 (stdlib OpenAI client, budget cap, prompt log)
tests/fitness/*.test.mjs                each stream adds its own test file(s)
```

Shared files edited ONLY by the master plan: `src/lib/i18n.ts` (nav strings), `src/components/site/SiteHeader.tsx`,
`src/views/HomeView.tsx`, `src/app/globals.css`, `src/app/sitemap.ts`, `src/lib/offline/catalog.mjs`, `package.json`
(test glob), `README.md`, `next.config.ts`.

## 5. Data model (Supabase, Postgres) — see `supabase/migrations/20261108120000_fitness.sql`

All tables carry `user_id uuid NOT NULL DEFAULT auth.uid()`, `created_at`, `updated_at` (trigger). Client-generated
UUID primary keys so offline writes are idempotent upserts.

| Table | Row | Notes |
| --- | --- | --- |
| `fitness_profiles` | one per user allowed to write | `is_owner` marks the site owner whose data visitors see; `settings jsonb` (goal, daysPerWeek, bodyweightKg, activeGymId, unit, timezone) |
| `fitness_programs` | a program version | `spec jsonb` = `Program`; `active boolean` |
| `fitness_gyms` | a gym profile | `spec jsonb` = `Gym` |
| `fitness_sessions` | a training session | `day_key`, `started_at`, `ended_at`, `status` (active/finished/auto_closed/abandoned), `bodyweight_kg`, `readiness jsonb`, `notes`, `plan jsonb` (frozen context) |
| `fitness_sets` | one logged set | `session_id`, `slot_id`, `exercise_id`, `set_index`, `kind`, planned/actual kg + reps, `rir`, `done_at`, `prescription jsonb` (suggestion provenance and effort-report status) |
| `fitness_exercise_state` | progression memory per exercise | PK (`user_id`, `exercise_id`); `spec jsonb` = `ExerciseState` |
| `fitness_bodyweight` | a weigh-in | `measured_at`, `weight_kg`, `body_fat_pct`, `note` |
| `fitness_adjustments` | an AI/engine/manual plan change | `source`, `input jsonb`, `output jsonb`, `applied` |

Security: `SELECT` for everyone (progress is public by design; a later `profiles.public` gate is planned).
`INSERT/UPDATE/DELETE` for `authenticated` only when `user_id = auth.uid() AND public.fitness_can_write()`.
`fitness_can_write()` = `is_admin()` OR a row in `fitness_profiles` for `auth.uid()`. The owner's profile is created
by the app on first sign-in (allowed only when `is_admin()`); friends are enabled later by inserting their profile
row in SQL Editor. Realtime publication includes sessions and sets so visitors can watch a live session.

RPCs: `fitness_can_write()`, `fitness_owner_id()` (returns the `is_owner` profile's user id; viewers filter by it),
`fitness_close_stale_sessions()` (sets `status='auto_closed'`, `ended_at = started_at + 6 h` on the caller's stale
active sessions).

## 6. Store contract (`src/lib/fitness/types.ts` → `FitnessStore`)

- `getSnapshot()` returns the whole `Snapshot` synchronously (rows keyed by id). Components read via
  `useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT)`.
- `upsert(table, row)` / `remove(table, id)` update the local snapshot **synchronously**, persist it to
  `localStorage["ilyadays-fitness:<project>:snapshot"]`, append to the outbox
  `localStorage["ilyadays-fitness:<project>:outbox"]`, and notify subscribers. The sync layer flushes the outbox
  (online, visibilitychange, after each write with a 300 ms debounce, every 30 s while a session is active).
- `mode()`: `"local"` (Supabase not configured → this browser only), `"synced"` (owner signed in),
  `"viewer"` (configured, not allowed to write → reads the owner's rows, no local writes), `"loading"`.
- `refresh()` pulls everything for the viewed user from Supabase and merges by `updatedAt` (last-writer-wins per row).
- `canWrite()` = mode is local or synced.
- Local-first means **the owner can train on Tuesday before Supabase exists**; when it is configured, the outbox
  replays on the next visit while signed in. Local snapshot survives.

## 7. Engine contracts (pure `.mjs`, unit-tested, no DOM)

- `catalog.mjs`: `EXERCISES`, `MUSCLES`, `exerciseById(id)`, `alternativesFor(id, gym?)`, `exercisesForMuscle(id)`,
  `equipmentLabel(eq, lang)`, `patternLabel(p, lang)`.
- `templates.mjs`: `GOAL_MODES` (parameters per mode with sources), `TEMPLATES` (3-day A/B/C owner program,
  2-day, 4-day, legs add-on), `buildProgram({templateId, goal, daysPerWeek, now, id, catalog})` → `Program`,
  `convertProgram(program, newGoal, now?, {id, catalog}?)` → a new program version. Programs are gym-independent;
  starting loads live in exercise states. `slotRole(program, slot)` uses the template slot's role or infers one from
  the exercise and current rep range; `ExerciseSlot` has no persisted role. Goal conversion of loads is performed
  lazily by session planning/applying through `convertState`. `Program.active?: boolean` supports archival.
- `progression.mjs`: `roundLoad(kg, exercise, gym?, direction?)`,
  `warmupRamp(workingKg, exercise, e1rm?, {gym, bodyweightKg, targetReps, rir}?)` → `SetPrescription[]`,
  `initialState(exercise, {bodyweightKg, goal, now, repRange, rir, gym}?)` → `ExerciseState` (`mode` aliases `goal`).
  `nextState(state, loggedSets, params, exercise, now?, {bodyweightKg, gym, calibration, at, plannedSets}?)` →
  `{state, outcome: "progressed"|"held"|"failed"|"deloaded", note}`; the shorter
  `nextState(state, loggedSets, params, now)` looks up the exercise in the catalog. Use `slotParams(program, slot)`
  for slot-specific parameters, including the rep range and RIR.
  `gapAdjust(state, daysSince, now?, {exercise, gym, bodyweightKg}?)` → `{state, outcome, pct, note}`
  (`outcome` is null, `deloaded` or `reset`).
  `convertState(state, fromRange, toRange, {rir, exercise, gym, bodyweightKg, now, factor}?)` → `ExerciseState`;
  both ranges are `[number, number]`.
- `session.mjs`: `nextDayKey(program, sessions, now?)`,
  `planSession({program, dayKey, states, gym, settings, now, catalog, deload})` → `PlannedSession`,
  `sessionStatus(session, now?, hours?)` (auto-close at 6 h by default), `summarize(session, sets, catalog?)`.
  `applySession({program, session, sets, states, settings, gym, now, catalog, deload, plannedSets})` →
  `{states, changed, outcomes}`. Only callers write the returned `changed` rows; application is idempotent per
  session. The tracker restores pre-session states before a corrected session is evaluated again.
- `analytics.mjs`: `e1rm(kg, reps, rir?, formula?)` (Epley/Brzycki blend; reliability depends on total reps plus RIR),
  `weeklyVolumeByGroup(sets, lookup, groupOf, opts?)`, `ewma(points, alpha?)`, `theilSen(points, opts?)`,
  `banister(loads, params?)`, `acwrEwma(loads, opts?)`, `forecast(points, horizonDays, opts?)`, `prs(sets, opts?)`.
- `nutrition.mjs`: `bmrMifflin({kg, cm, age, sex})`, `bmrKatch({kg, bodyFatPct})`, `tdee(bmr, activity)`,
  `proteinTarget({kg, bodyFatPct, goal})`, `energyTarget({tdee, goal, kg, ratePctPerWeek, bmr})`,
  `weeksToGoal({kg, targetKg, weeklyChangeKg})`, `nutritionPlan(input)`, `vo2maxCooper(metres)`,
  `vo2maxUth(hrMax, hrRest)`.
- `advisor.mjs`: `adjustCall(input)` → `LlmCall` (strict JSON schema), `validateProposal(raw, program, catalog, opts?)`,
  `applyProposal({program, states, proposal, now, settings, gym, catalog, bodyweightKg})` → the proposed changes.
  `applyAdjustment(program, states, proposal, now?, opts?)` is the positional alias; callers persist accepted results.
- `index.ts` re-exports the shared types and these engine entry points. Routes may continue importing leaf modules
  to avoid pulling unrelated engine areas into a page. Function types are inferred from the modules' JSDoc;
  `types.ts` owns the data model. Detailed progression/session options are in plan 03's API section.

## 8. UI conventions

- Shared layout: `SiteHeader section="fitness"` + `<main className="fit">` + `SiteFooter`. Everything wrapped in
  `<AuthProvider>` and `<FitnessProvider>`.
- Big tap targets, `button` elements with `aria-pressed`, sticky bottom action bar on `/fitness/train`.
- Charts: inline SVG, `viewBox`, responsive width, `currentColor`-based with CSS variables, tabular numerals,
  points + trend + uncertainty band, text labels outside the plot. Colour by role: accent = you, cool = model,
  muted = history.
- Diagrams: `<img>` 3:2 webp from `/media/fitness/...` with `?v=` hash like the rest of the site; muscle map is
  inline SVG with `data-muscle` paths highlighted via CSS classes.

## 9. Images (stream 07) — budget ≤ USD 20 total

`scripts/fitness-images.py` uses the Images API (`gpt-image-2`, webp, stdlib only, same approach as the recipe
generator), writes to `public/media/fitness/**`, logs every prompt to `art/fitness/prompts.json`, and **refuses to
exceed `--budget-usd 20`** using the per-image price table from research file 09. Style: clean technical
instruction illustration (flat, line + two-tone, orange arrows for motion, highlighted muscles in accent colour),
no text in the image. Order of spending: owner's 3-day program exercises first (2 angles each), then their
alternatives (1 angle), then machines, then the cover.

## 10. Launch checklist (stream 12)

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, phone-width browser pass of every route in EN
and RU, local-mode gym rehearsal (plan → start → log → end → next session shows progression), Supabase SQL applied
on the dedicated project, owner profile created, sign-in on the phone, one synced session, visitor view.

## 11. Decisions log

- 2026-11-08 Local-first store with outbox chosen over Supabase-only so the first session can happen before the
  database exists.
- 2026-11-08 Per-user schema from day one (friends later) but a single owner view now; public reads.
- 2026-11-08 Inline bilingual strings per component (`pick`) to let streams run in parallel without merge
  conflicts on `i18n.ts`.
- 2026-11-08 Hand-rolled SVG charts and markdown renderer; no new dependencies.

## 12. Canonical registry (added 2026-11-08, relaunch after the usage-limit stop)

`content/fitness/registry.json` is the single source of truth for every id shared between streams:

- `groups` — 14 coarse muscle groups (volume accounting, filters, muscle map colours).
- `muscles` — 36 muscle ids with group, region (front/back), bilingual name and function. `MuscleGroup[]`.
- `classes` — 36 equivalence classes (pattern × primary muscle) with ordered members, taken from
  `research/04-exercise-and-machine-catalog.partial.md` §3.6. A class is the substitution unit.
- `exercises` — all 138 exercise ids → `{class, classes, slice, pattern}`. **No stream invents an exercise id.**
- `ownerTemplate` — the owner's 3-day program (exercise per slot) and the legs add-on:

| Day | Slots |
| --- | --- |
| A · Chest focus | A1 machine-chest-press · A2 lat-pulldown · A3 pec-deck · A4 machine-row · A5 machine-shoulder-press · A6 machine-crunch |
| B · Back focus | B1 assisted-pull-up · B2 machine-incline-press · B3 seated-cable-row · B4 cable-fly · B5 face-pull · B6 lower-back-machine · B7 pallof-press |
| C · Arms, shoulders, core | C1 triceps-press-machine · C2 machine-preacher-curl · C3 cable-pushdown · C4 machine-lateral-raise · C5 hammer-curl · C6 captains-chair-knee-raise · C7 farmers-carry |
| Legs add-on (later) | L1 leg-press-45 · L2 seated-leg-curl · L3 leg-extension · L4 standing-calf-raise-machine · L5 trap-bar-deadlift |

Why: pecs get 3 exposures/week (pec deck mandatory, the owner's "red" seated chest press first), back gets the
most volume, arms and ab strength on C, longevity via the lumbar machine, carries (grip, bone loading) and cardio
finishers. Stream 03 sets sets × reps × RIR × rest per goal mode from research 01/02; it does not change the
exercise per slot without updating this table.

Catalog data flow: five slice agents write `content/fitness/exercises/<slice>.json` (`chest-shoulders`,
`back-neck`, `arms-grip`, `core`, `legs`) → `node scripts/fitness-catalog-merge.mjs` validates everything against
the registry and the type unions and writes `content/fitness/exercises.json` (nothing is written when a check fails)
→ `src/lib/fitness/catalog.mjs` imports it with `with { type: "json" }` (works in Node 25 and TypeScript).

Type additions (append-only, done): `MovementPattern` gained `"hip-extension"`; `Exercise` gained `repUnit`
(reps | seconds | meters — `LoggedSet.reps` uses the same unit), `class`, `lowerBackLoad`, `lengthenedBias`,
`assistance` (assisted machines: lower is harder), `sources`.

## 13. Orchestration after the relaunch

The first wave stopped on the Fable usage limit; the session now runs on Opus 5.5. Surviving inputs: research
01, 02, 06, 07, 08, the catalog draft (04 partial) and the food table draft (06 partial); plan files 01, 06, 07, 09;
`art/fitness/STYLE.md`, `art/fitness/pricing.json` (validated against 2,961 logged gpt-image-2 calls: medium
1536×1024 ≈ $0.041), `scripts/fitness-images.py`. No image money has been spent.

Dependency graph of the relaunch workflow (one workflow, promise-chained so nothing waits on unrelated work):

```
research 03 (injury/technique) ─┐
research 05 (longevity) ────────┼──────────────► 08 science content
catalog slices ×5 ─► merge ─────┼─► 02 catalog UI ─┐
                                ├─► images batch   │
03 engine ──────────────────────┤                  ├─► verify ─► QA (phone screenshots) + reviews ─► fixes
01 store ───────────────────────┼─► 04 tracker+home, 05 gyms, 10 program+advisor
06 progress, 09 nutrition, 07 image pipeline (independent)
```

## 14. Decisions log (continued)

- 2026-11-08 `scripts/fitness-sql-check.sh` runs all three migrations (fitness twice) on a throwaway Homebrew
  Postgres 17 with a small Supabase stand-in (`tests/fitness/sql/supabase-stub.sql`: anon/authenticated roles,
  `auth.users`, `auth.uid()` from `request.jwt.claim.sub`, `supabase_realtime`) and asserts 30 RLS cases
  (`tests/fitness/sql/fitness-rls.sql`). It found and we fixed two bugs before anyone ran the SQL in Supabase:
  policy names quoted as string literals in the `DROP POLICY` loop (syntax error on re-run), and a plain
  `session_id` foreign key that let an enabled friend attach sets to the owner's session (FK checks bypass RLS).
  Sets now reference `(session_id, user_id)` → `fitness_sessions (id, user_id)`.
- 2026-11-08 The DB trigger sets `updated_at = now()` on every write (server clock). Clients must not let a
  pulled row overwrite a row that still has a pending outbox entry; LWW applies only to rows with nothing pending.
- 2026-11-08 `FitnessNav` (Shell.tsx) renders `<ModeNote>` once under the sub-navigation on every page. Views must
  not render `ModeNote` themselves (duplicates are a review finding). `Program.active?: boolean` added.
- 2026-11-08 `scripts/sync-content.sh` keeps `content/fitness` and `public/media/fitness` (it used to delete
  everything under `content/` and `public/media/` except travel) and rebuilds `public/share/fitness.jpg`.
- 2026-11-08 Personal settings (body weight, height, birth year) are world-readable with the rest of the log; the owner
  said progress may be public. Revisit with plan 11 (`is_public`, private columns) before friends join.

## 15. Test hooks (contract for every screen stream, added 2026-11-08)

Browser tests (`tests/fitness/e2e/*.py`, run with `npm run test:fitness:e2e`) find elements by `data-testid`, never
by visible text (the UI is bilingual) or CSS classes (styles change). Every screen stream adds these attributes;
renaming one is a breaking change: update the e2e tests in the same change.

| Screen | `data-testid` | Extra attributes |
| --- | --- | --- |
| every page (ModeNote, done) | `mode-note` | `data-mode` = local / viewer / synced, `data-reason` (local), `data-pending` (synced) |
| home | `next-session` (the "next workout" card) | `data-day-key` (A, B, C …) |
| home / train | `start-session` (button) | |
| train | `session` (the running-session root) | `data-session-id`, `data-status` |
| train | `exercise-card` | `data-exercise-id` (performed), `data-slot-id`, `data-slot-exercise-id` (planned), `data-hold-until` (ISO, while a weight hold runs) |
| train | `set-row` | `data-kind` (warmup / working / backoff), `data-index`, `data-state` = planned / done / failed / skipped, `data-kg`, `data-reps` (performed or planned values) |
| train | `set-done` (the one-tap "done as planned" button of the current set), `set-row-done` (the same button on any other row) | |
| train | `reps-minus`, `reps-plus`, `kg-minus`, `kg-plus` (steppers of the current set) | |
| train | `rest-timer` | `data-ends-at` (ISO) |
| train | `rest-adjust` (the −30 s / +30 s buttons) | `data-delta` (seconds) |
| train | `swap-open` (per exercise card), `swap-option` (in the sheet) | `data-exercise-id` on options |
| train | `swap-empty` (the sheet's note when the gym has no alternative), `swap-skip` (skip this exercise's sets) | `data-missing` (alternatives the gym lacks) on `swap-empty` |
| train | `end-session`, `session-summary` | |
| train | `end-confirm` (the end sheet's confirm button: Finish, or Discard when no working set was logged), `session-reopen` (on the summary) | |
| train | `summary-done` (the summary's Done: back to /fitness) | |
| train (start) | `day-pick` (choose another day than the rotation's), `auto-closed` (the notice after a 6 h auto-close) | `data-value` (day key) on `day-pick`, `data-session-id` on `auto-closed` |
| program | `goal-select`, `days-select` (radios/segments carry `data-value`) | |
| program (done) | `program-day`, `slot-row`, `slot-edit`, `slot-swap-open`, `slot-swap-option`, `slot-up`, `slot-down`, `slot-remove`, `slot-rir`, `slot-rule`, `slot-hold` (group: `data-value` = the running hold's ISO end or ""; its buttons carry `data-value` = weeks, 0 clears), `day-add`, `day-add-search`, `day-add-option`, `legs-toggle`, `legs-slots`, `template-use`, `program-save`, `program-discard`, `program-saved`, `program-summary`, `program-loading`, `plan-change`, `plan-history` | `data-hold-until` on `slot-row` |
| program, AI adviser (done) | `advisor-key`, `advisor-key-change`, `advisor-key-remove`, `advisor-model`, `advisor-effort`, `advisor-example`, `advisor-request`, `advisor-ask`, `advisor-proposal`, `advisor-change`, `advisor-apply`, `advisor-dismiss`, `advisor-done`, `advisor-error` | |
| gyms | `gym-card` (`data-gym-id`, `data-active`), `machine-toggle` (`data-exercise-id`, `data-available`) | |
| progress (done) | `chart` (the chart's `figure`) | `data-kind`: e1rm, volume, volume-group, volume-heatmap, bodyweight, adherence, fitness-fatigue, acwr; exercise-e1rm on exercise pages |
| exercises | `exercise-tile` | `data-exercise-id` |
| tools (done) | `calc-exercise` (select), `calc-kg`, `calc-reps`, `calc-bodyweight` (inputs; each with `-minus` / `-plus` buttons), `calc-e1rm`, `calc-table`, `calc-error`, `plates-total`, `plates-result` | `data-kg` on `calc-e1rm`, `data-loaded` on `plates-result` |

Views must keep these on the elements the user actually taps (a `button`, not a wrapper), so a test tap is a real tap.
Seeded pure-logic simulations (`tests/fitness/simulation.test.mjs`) and the database checks
(`tests/fitness/sql.test.mjs`, skipped without a local Postgres) run inside `npm test`.

## 16. Decisions from the stream reports (2026-11-09)

- **Plate-loaded machines log the plates on both sides together, without the sled or carriage** (leg press, hack
  squat, plate-loaded rows and presses, landmine: bar + plates). The tracker labels the number "plates, both sides";
  `/fitness/tools` converts a total into plates per side. Pin-stack defaults: 5 kg for compound presses and pulls,
  2.5 kg for small machines; a gym can override any machine.
- **Bodyweight rep exercises (increment 0, e.g. the owner's C6 captain's chair knee raise)** progress reps to the top of
  the range; from there the plan must say what is next (a harder class-mate, or added load where the exercise allows
  it) instead of stalling silently.
- **Editing a set after End** must never leave the next targets silently based on a set the owner corrected: either
  re-open restores the pre-session exercise states, or progression is recomputed from them.
- **Accepted quirks:** gripper filed as `band`, plate pinch as `barbell`, neck machines as `plate-loaded` (no new
  Equipment members for now); 4 owner exercises whose "side" diagram is a front or rear view (they move in another
  plane); 8-hex `?v=` hashes for fitness media (the site's 10-hex rule is per file, both work); exercise-name links in
  the session cards stay 24 px tall (WCAG 2.5.8 minimum) so a stray tap cannot leave a running set, while the 44 px
  Technique button and the "Setup, all cues…" link reach the same page.
- **Recomposition protein:** the calculator's 2.2 g/kg target (lean-mass basis once body fat is known) is the number
  every page quotes; template summaries say "about 2.2 g/kg".
- **Not now (logged for later):** a VO2max test log with FRIEND percentiles (research 05), session RPE as the
  Banister input, per-muscle-group set targets, a `Gym.checked` list for confirmed equipment.
- **Progression rule changes after the 52-week simulation (2026-11-09; research 02 §§ A–I is the basis):**
  1. *Breaks:* the gap reduction exists to recalibrate effort, not because strength is gone (trivial losses ≤ 28 days).
     Round the reduction to the NEAREST step, apply it once; when coarse steps would turn it into more than twice
     the intended cut (cable fly 7.5 → 5 kg is −33 %), keep the load and lower that session's rep target by 2 instead.
  2. *Big steps on light loads:* the research's capacity guard — raise the load only when the e1RM-implied reps at the
     new load reach the range floor at target RIR; until then keep adding reps past the range top (up to 15 total for
     compounds, 20 for isolation and small muscles). If that ceiling is reached and the step is still too large,
     flag it so the tracker suggests a variant with smaller steps (cable, machine) or micro-plates. No more
     fail → deload → repeat cycles (hammer curl 8 → 10 kg).
  3. *Easy sets count:* every working set at the top of the range with logged RIR ≥ target + 1 jumps to the
     e1RM-implied load, capped at +10 % (as research 02 recommends); RIR is never ignored.
  4. *Incomplete logs:* progression needs every planned working set logged; with fewer, the exercise holds (no step,
     no failure) unless a logged set fell below the floor (the failure ladder applies).
  5. *Plateau memory (2026-11-09):* each session used to be judged alone, so a lifter stalled right at a coarse step
     passed the capacity guard on one good day, stepped up, missed twice, deloaded and retried the same weight over
     and over (the 52-week "stalled" simulation run: lower-back machine 40 → 35 kg five times).
     A reactive deload that lowers the load now remembers the load it came down from
     (`ExerciseState.plateau = { kg, times, streak }`, in the state's spec jsonb, no SQL change). A step from below that
     load back to it, or past it, waits for min(3, 1 + times) sessions in a row at the planned load with every set at
     the top and the weakest set carrying that load by the capacity guard of rule 2 (2 after the first deload from it,
     the ACSM two-session hand-off; 3 after the second, and from then with 2 more reps in hand, earned with reps first,
     except at the rep ceiling, where the guard alone decides): until then the hardest step that stays below it, else
     the same load at the top with a note that names the failed load and the sessions left (from the second deload:
     smaller steps or micro-plates). A test session after a break counts like any other, from its planned load; its
     re-anchor, or a ramp that reached that load, stops one step below it until the confirmation. A load change (a
     break's cut too), a session that does not count or a miss starts the streak over; an incomplete log and a deload
     week leave it. The memory clears after a complete session past that load with no set below the range (a session
     at that load keeps it), and with a goal or range conversion; a swap starts without it; breaks keep it. The `rpe`
     rule keeps the load of a wait and otherwise stops one step below it; an adviser's weight change starts the streak
     over. It never blocks deloads, misses, holds, rep progression, the rep ceiling and its variant flag, the
     bodyweight/band "harder" flag or rule 4, and a lifter at the top every session always gets the step (after a
     second deload with up to 3 sessions of reps first: the 2 reps are counted at the failed load). There is no
     permanent stall, so a third and, rarely, a fourth deload from the same load stay possible: of 400 simulated
     stalled years not used to tune the rule, 19 have a third (4.75 %) and 1 a fourth (0.25 %, a face pull whose range
     top is the rep ceiling, so no reps to spare), against 361 and 202 of the same years before. Malformed values
     count as none; states without one never grow the field; the adviser sees `states[].plateau = { failedKg, times }`.
- **Not now (from the 2026-11-09 reports):** today-only swaps, skips and added sets live on the device that made
  them (Session has no field for them; a `fitness_sessions.ui jsonb` column would sync them); a visitor briefly sees
  the template plan before the owner's rows arrive (a store `ownerKnown` flag would allow a skeleton); the engine
  ships the full 576 KB catalog to /fitness and /fitness/train (a slim engine catalog would save about 100 KB gzipped;
  the service worker caches it after the first visit); readiness (sleep, soreness) is advice only; the 4-tier warm-up
  of research 03 and extra carries or back extensions from research 05 stay optional additions, not template slots.
- **Holds are real (2026-11-09):** `ExerciseState.holdUntil` (types.ts) — no load increase before that date; reps may
  still rise within the range; deloads and the failure ladder still apply. The adviser's "hold" / "delay the next
  increase" change sets it, the tracker and program preview show "weight held until …", and the owner can set or
  clear it by hand on the program page.
- **Gym copy (2026-11-09):** a training phone keeps the gym pages offline without the 138 MB site save
  (`GymOffline.tsx` + `public/sw.js`, plan 12). Visitors get no worker.


## 17. Per-exercise calibration and missed targets (2026-11-09)

This supersedes earlier descriptions that allow an incomplete calibration to re-anchor upward or ignore failed
heavier working attempts. Implemented in progression/session/tracker, store mappings, train UI and migration
`20261109135752_fitness_calibration.sql`.

- `ExerciseState.baseline` lives in existing `spec`: learning or established, with observed kg, reps, RIR, timestamp,
  session and set count. Catalog/bodyweight starts are estimates, never measured personal strength. Exercise changes
  calibrate separately. Confirmation requires the complete prescription, no missed working targets, reported effort
  and two sets at the anchor load (one when only one is prescribed). Missing effort or partial work remains learning.
  Learning after the first visit still uses the normal failure ladder; it does not suppress deloads indefinitely.
- The starting program, gym increments, exercise states and prescription are frozen in `Session.plan`; replay and
  evaluation use that context. Current explicit swaps retain the original slot range for matching units; equipment-availability changes remain live,
  and an explicitly set/cleared hold still applies. Original
  sessions without this field retain legacy behavior rather than receiving invented historical plans.
- `plannedKg/plannedReps` retain the original row's intent; `kg/reps` are actual performance. Set `prescription`
  records target RIR, whether it was reported, effective suggested kg/reps, reason and source-set ID. A displayed RIR
  remains a target until explicitly reported. Editing RIR updates that provenance.
- Example: original 20×10, actual 20×8 inside the range → suggest 20×8 after the full rest. Below-range work or
  excessive reported effort → one easier equipment step, bottom of range. Assistance increases to make work easier;
  stack minimums and zero-added bodyweight loads are respected. No automatic within-session load increases. A later
  recovered set can return to the original rep suggestion. Completed logs never change when suggestions change.
- Every working attempt matters, including failed higher attempts and lighter fatigue sets during calibration.
  Incomplete or missed original work cannot earn a next-visit load increase under calibration, double, linear or
  RPE rules, including when the performed load was manually higher. A best-set calibration candidate must also pass
  the weakest-set capacity guard. Extra/backoff rows do not replace missing prescribed row identities, including
  after swaps. The effective swapped plan is passed to final evaluation; idempotence and newer-state protection stay.
- Scientific basis: ACSM 2026 (PMID 41843416) supports individualized progressive training and adequate effort without
  requiring failure; RIR accuracy review PMID 34542869 supports treating effort estimates cautiously. Exact next-set
  steps, tolerance and baseline-confirmation thresholds are app heuristics, not validated physiological formulas.
  Bilingual explanation and sources: `content/fitness/science/progression.{en,ru}.md`.
- Coverage: `tests/fitness/calibration.test.mjs`, existing progression/session/tracker/store tests and simulation
  invariants; SQL metadata ownership/round-trip checks and browser missed-reps/reload workflow. Simulation plateau
  comparisons now use the same calibration policy without plateau memory, isolating its effect from policy changes.


## 18. Personal profiles, flexible plans and body measurements (2026-11-09)

- Self-service `/fitness/profile` (EN/RU), private non-owner registration without invitations, own-account name and
  profile-wide sharing preferences. Own-user/RLS protects all nine fitness tables. Public sharing is explicit and
  disclosed to include settings, weight and circumference observations. Site-owner administration stays separate.
- TrainingPreferences persist one primary prescription, up to two supporting priorities, upper/full/custom scope
  and canonical muscle exclusions. “legs” normalizes into quads/hamstrings/adductors/glutes/calves. Upper or custom
  with all lower groups excluded also excludes lower patterns and loaded carries. Goal/day/template/adviser/gym
  substitution paths preserve exclusions; profile full-body pivots add actual lower-body work.
- The constructor edits names, day order, individual exercises/prescriptions and pivot reasons; blank custom days
  are real drafts and cannot save until populated. Saves archive versions and log readable changes. State/baseline
  history and the frozen current workout remain intact. Account changes clear private snapshots and UI drafts.
- `fitness_measurements` stores independent dated centimetre observations, optional notes and separate left/right
  arm/forearm/thigh/calf sites, plus waist/chest/hips/neck. No kg is required or invented. Weigh-ins remain independent;
  exercise loads are still actual/planned set fields. Comparisons use recorded observations, with entry time breaking
  same-day ties. No inference of muscle/fat change from circumference alone.
- Per-set “When should I stop?” guidance explains 10 versus15: if15 is the maximum, about13 leavesRIR2; if15 still
  leaves the target reserve, record15. Reported extra reserve can suggest one more next-set rep at the same kg within
  range, only after successful work with no earlier miss. Unknown/default RIR never earns that suggestion. This is
  conservative coaching, not a guarantee of capacity; actual logs and next-visit failure guards remain authoritative.
- Migration `20261109142245_fitness_profiles_self_service.sql` is applied to dedicated ilyadays only. Native SQL,
  store/core/browser evidence and the ten different critique perspectives are recorded in
  `docs/development-review-10-loops.md`. Publishing remains a separate owner-approved step.
