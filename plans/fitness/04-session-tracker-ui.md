# 04 — Session tracker (the gym screen) and the fitness home page

Status: done · 2026-11-09 (resumed after the usage-limit stop). Stream 04. Contract: `00-master-plan.md` §2, §4–§8,
§15, §16 (the master plan wins). Inputs: `research/08-app-ux-survey.md` (tap budget, set-row states, rest timer, state machine),
`03-program-engine-and-progression.md` + `templates.mjs` / `progression.mjs` / `session.mjs`,
`01-database-and-sync.md` + `store-core.mjs` / `Provider.tsx` / `ModeNote.tsx`, `catalog.mjs`, `analytics.mjs`,
`content/fitness/safety.json`. First real use: Tuesday/Wednesday 2026-11-10/11, phone in hand.

## Scope

- `/fitness/train` (EN + RU): start a session, log every planned set with one tap, adjust with steppers, rest timer,
  swap / skip / add sets, end with a summary of what changes next time. Viewers watch read-only (live sets).
- `/fitness` (EN + RU): the hub — next session card with Start, this week, last session, body weight trend, tiles.
- Pure logic in `src/lib/fitness/tracker.mjs` (no DOM, node:test). The engine (stream 03) decides every number; this
  stream only arranges, logs and calls it.

## Files (owned)

```
plans/fitness/04-session-tracker-ui.md            this plan
src/lib/fitness/tracker.mjs                        pure helpers (session model, logging, ending, close-outs, formatting)
tests/fitness/tracker.test.mjs                     node:test for tracker.mjs
src/components/fitness/train/SessionTracker.tsx    "use client" — state machine: loading → start → active → summary
src/components/fitness/train/StartPanel.tsx        next day, gym, day override, readiness, body weight, warm-up, Start
src/components/fitness/train/ExerciseBlock.tsx     exercise card / superset pair (interleaved rows), technique, actions
src/components/fitness/train/SetRow.tsx            one set: planned/actual text, Done, steppers + RIR chips
src/components/fitness/train/Stepper.tsx           − value + control (≥ 48 px buttons)
src/components/fitness/train/RestTimer.tsx         sticky bar: rest countdown ±30 s, elapsed, End
src/components/fitness/train/SwapSheet.tsx         alternatives at this gym + "use here from now on"
src/components/fitness/train/EndSheet.tsx          confirm end / discard
src/components/fitness/train/SessionSummary.tsx    top sets, e1RM, outcome badges, PRs, next session
src/components/fitness/train/Sheet.tsx             <dialog> bottom sheet used by SwapSheet and EndSheet
src/components/fitness/train/ErrorGuard.tsx        error boundary around the train and home client islands (no blank screen)
src/components/fitness/train/hooks.ts              clock, per-session UI store (localStorage), summary (sessionStorage), wake lock, close-outs
src/components/fitness/home/HomePanel.tsx          "use client" next session, this week, last session, body weight
src/views/fitness/TrainView.tsx, FitnessHomeView.tsx   server views
src/app/(en)/fitness/page.tsx, train/page.tsx       thin routes (same under src/app/ru/fitness/)
src/styles/fitness/train.css, home.css              trk-* and fh-* classes
```

## Contract / API (`tracker.mjs`)

- `ensureProgram(snapshot, now)` → `{ program, created }` — the active program, else the owner template
  (`owner-3day-upper`) built with `settings.goal` / `settings.daysPerWeek`. The caller upserts it when `created`
  (first visit, writable modes only).
- `activeSession(snapshot, now)` → newest session still `active` under the 6 h rule (`sessionStatus`), else null.
- `startSession({ program, dayKey, gymId, now, readiness, bodyweightKg })` → `Session` (UUID).
- `logPlannedSet({ session, planned, exerciseId, slotId, index, now, overrides })` → `LoggedSet` (exactly the plan:
  kg, reps, rir = target; warm-ups rir null). `adjustSet(set, { repsDelta, kgDelta, rir }, exercise)` → clamped copy.
- `activePlan({ snapshot, session, program, swaps })` → `PlannedSession` planned at `session.startedAt` (stable
  across reloads); today's swaps and swaps inferred from logged sets go in as gym preferences, so the engine's own
  substitution maths (`substituteState`, warm-ups, deload, gaps) applies. `swapInSession(planned, slotId, to, states,
  catalog, ctx)` returns the plan with one slot swapped (same mechanism; `substituteState` fallback without ctx).
- `sessionModel({ plan, sets, ui })` → blocks (superset pairs interleaved by round), rows per exercise
  (planned / done / failed / skipped, warm-ups separate, added sets, rows logged before a swap), the current set,
  completion. `completion(planned, sets)`, `restFor(plannedExercise, lastSet)`, `elapsed(session, now)`.
- `endSession({ snapshot, session, sets, program, now, catalog })` → `{ session, states, changed, outcomes, summary }`
  (status `finished`, or `abandoned` when nothing was logged; `applySession` for the progression; summary =
  per-exercise top set, e1RM, outcome badge + engine note, PRs, tonnage, minutes, next session preview, and
  `reopen: EndUndo` = the session before End + every state End wrote with its previous value).
- `reopenSession({ snapshot, undo, now })` → `{ session (active again), states (previous values, fresh updatedAt),
  remove (states End created) }`, or null when unsafe (session gone/changed since End, a later session, a state End
  wrote changed since — compared by a stamp without `updatedAt`, which the server re-stamps — or the 6 h auto-close
  < 10 min away).
- `nextAfter(snapshot, program, now)` → `{ dayKey, plan, gym }`. `closeOuts(snapshot, now)` → auto-closed sessions
  to apply (progression from their logged sets, once) and empty ones to mark `abandoned`.
- Formatting (bilingual, tested): `setText`, `prescriptionText` (with the load hint), `setHint` ("per hand", "each
  side", "plates, both sides"), `kgStepLabel`, `stepsFor`, `badgeFor`; home helpers
  `weekStatus`, `lastSessionInfo`, `bodyweightTrend`, `latestBodyweight`; `safetyInfo()`, `techniqueOf(id)`.

## Design decisions (with reasons)

1. **One tap = the plan; the current set shows its steppers.** The current set's row is expanded (reps ±, kg ± the
   exercise/gym increment, RIR 0 1 2 3 4+), so adjusting is 2 taps (− then Done) and logging as planned is 1
   (master plan rule 2, research 08 §C). Other rows open their steppers on tap; logged rows edit in place or undo.
2. **The current set** = the next pending row after the last logged row of the block that was logged last, else the
   first block with pending rows; passed-over warm-ups never block it. Only that row carries `set-done` and the
   stepper test ids (§15).
3. **Supersets**: one block, rows interleaved by round (A3·1, A4·1, A3·2 …). Each exercise stays its own
   `exercise-card` element (`display: contents` + CSS `order`), so tests and screen readers keep the containment.
4. **Plan stability**: the active session is re-planned with `now = startedAt`, so a reload resumes exactly.
   Per-device UI state (today-only swaps, skips, added sets, rest-timer ±30 s / dismiss, warm-up toggles) lives in
   localStorage keyed by session id; swaps are also inferred from logged sets, so another device still shows them.
   Everything that matters for progression is a store row (sessions, sets, exercise_state, bodyweight, gyms).
5. **Swaps go through the engine**: a today-only swap is a virtual gym preference for `planSession`; "use this at
   this gym from now on" writes `gym.preferred[slotId]` (creating a default gym when none exists). A swap after some
   working sets gives the substitute the remaining sets (at least one).
6. **Rest timer is computed** from the last set's `doneAt` + `restFor` (warm-up ≤ 60 s, otherwise the slot rest;
   superset members already carry halved rests), so it survives reloads; ±30 s and dismiss are per device;
   vibrates once at zero (`navigator.vibrate`), keeps counting past zero up to 10 min.
7. **Ending**: no logged working set → `abandoned` (the rotation and adherence ignore it). End time = now, or last
   set + 5 min when End is tapped more than 30 min after the last set (forgotten End).
8. **Auto-closed sessions** (store closes them at 6 h) get their progression applied once on the next visit
   (`applySession` is idempotent; applied = an exercise's `lastAt` ≥ the session start); empty ones become
   `abandoned`; the train page says "closed automatically after 6 h" once. In synced mode this waits for a clean
   pull (`syncedAt` set, no `lastError`) so a half-pulled snapshot never overwrites real states. Same guard before
   auto-creating the program.
9. **Added sets are `backoff`**: extra volume shows in analytics but never turns a made session into a hold.
10. **Bundle**: the engine imports the full catalog (576 KB JSON), so `/fitness` and `/fitness/train` ship it (the
    master's `/fitness/tools` does too). Accepted for the gym page (cached, immutable chunk); see open questions.
11. **Viewer** sees the next planned session and, during the owner's session, the same blocks read-only with live
    sets (realtime from the store); no buttons render. Loading renders a skeleton (no hydration mismatch).
12. **Home** keeps static parts (tiles, how it works) in the server view; the client panel holds the data cards.
13. **Reopen after End (master plan §16)**: sets are never edited after End in place; instead the summary offers
    "Reopen the session" while it is safe. It restores the exercise states End changed (removes the ones End
    created) and makes the session active again, so ending again re-applies the progression from the corrected
    sets (`applySession` skips exercises whose `lastAt` ≥ the session start, so the old states must come back first).
    The undo data travels with the summary (sessionStorage), not in a new column.
14. **Plate-loaded machines (§16)**: rows, the kg stepper, plan lines and swap options say "plates, both sides"
    ("блины с обеих сторон"); the number is the plates on both sides together, without the sled.
15. **ErrorGuard** wraps `SessionTracker` and `HomePanel`: a render error (say, a malformed program row pulled from
    the database) shows a message and Reload instead of a blank gym screen; the store already saved every set.
16. **`start-session` is the owner's control only**: the viewer's "Watch live" link on the home card carries no test id.

## Acceptance checks

- [x] `node --test tests/fitness/tracker.test.mjs` passes (33 tests; 47 after the QA fixes of 2026-11-09; whole
      `tests/fitness`: all pass).
- [x] `npx tsc --noEmit` (repo-wide, `--incremental false`) exits 0; `npx eslint` clean on this stream's files.
- [x] Routes `/fitness`, `/fitness/train`, `/ru/fitness`, `/ru/fitness/train` exist with `fitnessMeta` / `trainMeta`;
      the probe route `src/app/(en)/fitness/zz-probe` is gone.
- [x] §15 hooks: `next-session` (+ `data-day-key`), `start-session`, `session` (+ id, status), `exercise-card`
      (+ exercise, slot, slot exercise), `set-row` (+ kind, index, state, kg, reps), `set-done`, `reps-/kg-minus/plus`
      (current set only), `rest-timer` (+ `data-ends-at`), `swap-open`, `swap-option` (+ `data-exercise-id`),
      `end-session`, `session-summary`; extra: `end-confirm`, `session-reopen`.
- [x] No view or screen renders its own `ModeNote` (FitnessNav does); the hub links every sub-page including
      `/fitness/tools`.
- [x] CSS: set rows ≥ 64 px, Done ≥ 56 px, steppers/chips ≥ 44–48 px, sticky bars with
      `env(safe-area-inset-bottom)`, tabular numerals, tokens only (dark mode), `prefers-reduced-motion` respected.
- [x] Phone browser pass (360–430 px, EN/RU, local and viewer modes): `tests/fitness/e2e/test_gym_session.py`
      (14 tests) against `next dev` on 2026-11-09 (QA fixes below).

## Status

Done (2026-11-09). Resumed the stopped run: deliverables A–G were on disk and passing; this pass added the §16 rules
(reopen after End, plate-loaded labels), ErrorGuard, the viewer test-id fix and the Russian End label
("Завершить"), with tests. Not verified in a browser in this pass.

## QA fixes 2026-11-09 (rehearsal findings, tracker-flow review)

- **Double taps**: for 700 ms after a set is logged, a tap within 48 px of that tap is dropped (click capture on the
  `session` root) and the next set's Done is disabled for 760 ms; set ids are per row (`setIdFor`: a v8 UUID from
  session, slot, exercise and set index), so a row logged twice is one set. `.trk-session` has
  `touch-action: manipulation` (no double-tap zoom).
- **Gym**: `sessionGym` (the session's gym, else the active one) plans the running session, so a machine marked
  "not here" on /fitness/gyms swaps at once. The swap sheet lists only what that gym has (`swapChoices`); with
  nothing left it explains which machines are marked missing (`swap-empty`) and offers "Skip it today"
  (`swap-skip`) and the gym page.
- **End**: the screen's planned working sets per exercise (`plannedCounts`, keyed by exercise id; `plannedOf`
  without the screen) go to `applySession` as `plannedSets` (`withPlannedSets` / `applyWithPlan`) for the engine's
  rule 4 (fewer logged than planned holds). Reopen keeps a weight hold set or cleared since End.
- **Holds** (`ExerciseState.holdUntil`, strictly after the session time): "Weight held until 16 Nov" on the exercise
  card, start panel, home card, summary and the program page's slot rows (`data-hold-until`), shown once when the
  engine's note already names the date (`noteHasHold`); the program page sets 1–8 weeks or clears it (`slot-hold`).
- **Summary**: "Done" (`summary-done`) keeps the summary on screen until /fitness has loaded (no Start button
  sliding under the thumb) and forgets it for reloads; leaving the train page by any link clears it, so the train page
  then shows the next day.
- **Texts**: a missed set's target carries its unit ("target 30 s"). Visitors: every goal and day button is disabled.
- **New hooks** (please add to master plan §15): `summary-done`, `swap-empty` (+ `data-missing`), `swap-skip`,
  `day-pick` (+ `data-value`), `auto-closed` (+ `data-session-id`), `rest-adjust` (+ `data-delta`), `slot-hold`
  (+ `data-value`), `data-hold-until` on `exercise-card` / `slot-row`, `set-row-done` (Done of a row other than the
  current one).
- **Tests**: `tests/fitness/tracker.test.mjs` (set ids, planned counts in deload weeks / with added, skipped or
  swapped sets / at a gym, holds in both languages, swap choices, `sessionGym`, reopen with holds);
  `tests/fitness/e2e/test_gym_session.py` (double tap, Done size and the bar, rest timer across a reload, a session
  closed after 6 h, a missing machine, goal and days after a reload, reopen, Done → next day). Run against
  `next dev` with `FITNESS_E2E_DEV=1`.

## Open questions

- `Session` has no field for today-only swaps / skips / added sets, and `toRemote` maps only known columns, so these
  stay per device (localStorage). A `fitness_sessions.ui jsonb` column (or `Session.plan?: {...}`) would sync them.
- Resolved: §15 includes `end-confirm` (Finish / Discard in the sheet) and `session-reopen` on the summary.
- Viewers on a first visit see the template plan for a moment until the owner's rows arrive (the store gives no
  signal that tells "owner not answered yet" from "nobody owns the data"). A `status.ownerKnown` flag would let the
  page show its skeleton instead.
- A slim engine catalog (ids, equipment, pattern, muscles, increment, repRange, repUnit, startLoad, alternatives —
  ≈ 60 KB) imported by `session.mjs` / `progression.mjs` would cut the train/home bundle by ~100 KB gzipped.
