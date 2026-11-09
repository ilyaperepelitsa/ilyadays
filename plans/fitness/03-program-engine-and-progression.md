# 03 — Program engine: goal modes, templates, progression, session planning

Status: done (engine, data, tests) · 2026-11-08; progression rules revised 2026-11-09 (master plan §16 rules 1–4 and
weight holds), checked by the 12- and 52-week simulation (`tests/fitness/simulation.test.mjs`). Stream 03.
Contract: `00-master-plan.md` §4–§7, §12 and §16 (the master plan wins). Inputs: `research/01-goals-and-programming.md`
(goal_modes JSON, Tables 1–10), `research/02-progression-algorithms.md` (progression_rules JSON, DP-RIR-4 card),
`research/04-…partial.md` §3.2/§3.8/§3.9 (increments, load re-seeding, starting loads), `content/fitness/registry.json`
(`ownerTemplate`, `legsAddon`, classes, 138 ids).

## Scope

Pure engine (no DOM, no fs, no React): goal-mode parameters and split templates as data, program building and goal
conversion, load rounding, warm-up ramps, initial loads, next-session targets (double progression + RIR
autoregulation, deloads, gaps, unit-aware holds/carries, assisted machines), substitution re-seeding, session planning
for a day + gym, the 6 h session status, session summaries and applying a finished session to the progression memory.
No UI in this stream's deliverable (ProgramEditor belongs to the program/advisor stream). No writes: callers upsert
the rows the engine returns.

## Files (owned)

| File | What |
| --- | --- |
| `content/fitness/templates.json` | goal modes (5) with per-role prescriptions + sources, `repMaxPercent` 1–20 + source, `warmup` (5 min general) + `warmupRamp`, `rules` (engine constants, each with a source), `patternGroups`, 4 templates (`owner-3day-upper`, `upper-2day`, `upper-4day`, `legs-addon`) with split-design sources |
| `src/lib/fitness/templates.mjs` | `GOAL_MODES`, `GOAL_IDS`, `TEMPLATES`, `REP_MAX_PERCENT`, `WARMUP`, `WARMUP_RAMP`, `RULES`, `PATTERN_GROUPS`, `COMPOUND_PATTERNS`, `templateById`, `modeParams`, `roleParams`, `rangeForUnit`, `progressionRecord`, `deriveSlot`, `buildProgram`, `withLegs`, `convertProgram`, `slotParams`, `slotRole`, `groupWeights`, `directGroups`, `finisherMinutes`, `estimateMinutes`, `newId`, `toIso`, `toMs` |
| `src/lib/fitness/progression.mjs` | `roundLoad`, `incrementFor`, `isAssisted`, `isCompound`, `unitOf`, `e1rmFactor`, `e1rmOf`, `loadForE1rm`, `pctOf1rm`, `loadFraction`, `repCeiling`, `holdActive`, `holdDay`, `warmupRamp`, `startingLoad`, `firstSessionTestProtocol`, `initialState`, `maxStepFraction`, `nextState`, `gapAdjust`, `convertState`, `substituteState`, `deloadSets`, `deloadPlan`, `deloadWeek`, `weeklySets`, `weeklySetsTarget`, `joinText` |
| `src/lib/fitness/session.mjs` | `AUTO_CLOSE_HOURS`, `DEFAULT_CATALOG`, `catalogFrom`, `fallbackExercise`, `sessionStatus`, `nextDayKey`, `resolveExercise`, `suggestVariant`, `planSession`, `summarize`, `applySession` |
| `tests/fitness/engine-fixtures.mjs` | fixture exercises built from registry ids (realistic equipment, increments, ranges, start loads), set/state/gym/params helpers |
| `tests/fitness/templates.test.mjs`, `progression.test.mjs`, `session.test.mjs` | node:test; plus real-catalog passes over `exercises.json` (or the slice files before the merge) |
| `tests/fitness/simulation.test.mjs` | deterministic 12- and 52-week runs of the owner program (3 profiles, skipped weeks, a 3-week break, swaps, a hold) and 20 more stalled lifters (rule 5) against the invariants below; all 29 simulations < 2 s of CPU together (≈ 0.7 s) |

## Contract / API (JSDoc-typed against `src/lib/fitness/types.ts`)

- `buildProgram({ templateId = "owner-3day-upper", goal = template goal, daysPerWeek = template days, now, id, catalog })`
  → `Program`. A day count that differs from the template's picks `upper-2day` / `upper-4day` (3 → owner). Every slot
  gets the goal mode's role prescription (sets, repRange, rir, restSec); exercises never change. `id` defaults to
  `crypto.randomUUID()`. The master plan's `gym` / `bodyweightKg` options are accepted and not needed (programs are
  gym-independent; start loads live in the progression memory). Throws on an unknown template/goal, an add-on, or
  days ∉ {2, 3, 4}.
- `convertProgram(program, newGoal, now, { id, catalog })` and `withLegs(program, now, { as: "day" | "slots", id })`
  → a NEW row (new UUID, `version + 1`). `convertProgram` sets `createdAt = now` (the block/deload calendar restarts);
  `withLegs` keeps `createdAt` and is idempotent (returns the same object when the legs are already there).
- `slotParams(program, slot)` → `ProgressionParams` for `nextState` (the slot's rule with its repRange and RIR).
- `nextState(state, loggedSets, params, exercise, now, { bodyweightKg, gym, calibration, at, plannedSets })` →
  `{ state, outcome, note }`, `outcome` ∈ `progressed | held | failed | deloaded`. `plannedSets` = the working sets
  planned for this exercise (fewer logged → held). The state may carry `variant` (`"smaller-steps" | "harder"`, null
  after a load step) and keeps `holdUntil` while it is in the future (cleared to null after). The master-plan form
  `nextState(state, loggedSets, rules, now)` also works (the exercise is looked up in the catalog).
  `initialState(exercise, { bodyweightKg, goal | mode, now, repRange, rir, gym })` → `lastOutcome: "init"`,
  `sessions: 0`, note = first-session test protocol. `gapAdjust(state, daysSince, now, opts)` →
  `{ state, outcome: null | "deloaded" | "reset", pct, note }`. `convertState(state, fromRange, toRange,
  { rir, exercise, factor })` → `lastOutcome: "converted"`. `substituteState(fromState, fromEx, toEx, opts)`.
- `planSession({ program, dayKey, states, gym, settings, now, catalog, deload })` → `PlannedSession` (warm-ups +
  working sets per slot, the exercise at this gym, its alternatives at this gym, a bilingual note, minutes, the
  general warm-up and the finisher). `deload` defaults to the program calendar (`deloadWeek`). A held exercise gets
  "Weight held until <day>." (once; "The weight hold ended …" after the date); a flagged state puts
  `suggestVariant`'s pick first in `alternatives` with "Harder variant: …" / "Smaller steps: …".
- `applySession({ program, session, sets, states, catalog, now, settings, gym, deload, plannedSets })` →
  `{ states, changed, outcomes: [{ exerciseId, slotId, outcome, note }] }`. Callers upsert each row of `changed` into
  `exercise_state` (only when `store.canWrite()`); `states` is the full next map. Pure, idempotent per session.
  `plannedSets` maps the PERFORMED exercise id to its planned working sets (the tracker's plan, with today's added
  sets); without it, the sum of `slot.sets` over the slots its sets were logged under.
- `nextDayKey(program, sessions, now)`, `sessionStatus(session, now, hours = 6)`, `summarize(session, sets, catalog)`
  → `{ perExercise: [{ exerciseId, sets, topSet, e1rm }], tonnage, hardSets, minutes }`; `e1rm` uses
  `analytics.effectiveLoad`, so the summary, the PR lines and the progress charts show the same number.
- `catalog` everywhere = `{ exerciseById, alternativesFor, isAvailable }`; defaults to `catalog.mjs`; tests pass
  `catalogFrom(fixtures)`. Unknown ids get a registry-derived `fallbackExercise`, so nothing crashes on an empty
  catalog.

## Design decisions (with reasons)

1. **Roles, not hand-typed numbers.** Each template slot names a role (`primary`, `secondary`, `isolation`, `small`,
   `trunk`, `hold`, `carry`); each goal mode defines sets × reps × RIR × rest per role (research 01 Table 1/3/5,
   research 02 §L). The explicit numbers in `templates.json` equal the derived ones for the template's own goal
   (tested), and any other goal re-derives them, so mode switching never edits exercises.
2. **Owner default = recomp with a strength lean**: primaries 6–10 @ RIR 2 (DP-RIR-4) instead of research 01's 5–8,
   because a 5 kg pin step needs ≥ 4–5 reps of range width (research 02 §D max-step formula); isolation 10–15 @ RIR 1,
   small muscles 12–20 (research 04 §3.5), loaded trunk 8–12. Priority slots (A1, A3, B1) get +1 set.
3. **Antagonist supersets only** (tested: push ↔ pull, curl ↔ triceps, trunk flexion ↔ extension, knee flexion ↔
   extension): owner A3+A4, B2+B3, B4+B5, C1+C2; 2-day A5+A6, A7+A8, B2+B3; legs L2+L3. Members rest
   `max(60, role rest ÷ 2)`. Supersets keep volume and shorten sessions (Zhang 2025 meta-analysis); similar-muscle
   pairs cost volume load, so the 2-day lateral raise and face pull stay straight sets.
4. **Double progression with RIR autoregulation** (research 02 §C): a set is "made" when reps ≥ target and RIR ≥
   target − 1 (logged RIR is ±1, Halperin 2022; a missing RIR counts as on target). All made → the highest of
   target + 1, the weakest set + 1 and the weakest set's reps plus its RIR above target (6 @ RIR 5 against RIR 2 → 9),
   up to the top. All at the top → the hardest load among these that the weakest set carries: one step
   (max(increment, stepPct), nearest), one increment, the overshoot double step (first set ≥ top + `overshootReps` at
   RIR ≥ target + 1; ≤ +10 %, rounded easier) and the easy-set jump (§16 rule 3: every set logged at RIR ≥ target + 1
   → the load the weakest set implies for the bottom of the range at target RIR, ≤ +10 % or one step, rounded easier;
   RIR is never ignored). **Capacity guard** (§16 rule 2): a load carries when new ÷ old ≤ (30 + reps + RIR of the
   weakest set at the working load) ÷ (30 + bottom + target RIR) in effective kg — Epley, i.e. `maxStepFraction` with
   the reps and RIR actually logged, whole reps (no half-rep leniency: it let the stalled hammer curl cycle). When
   nothing carries, the target climbs a rep per session past the top up to `rules.repCeiling` (15 compound, 20
   isolation and small muscles); at that ceiling the state is held and flagged `variant: "smaller-steps"`, and
   `planSession` names the alternative whose step is the smallest fraction of its seeded load (micro-plates at the
   gym clear the flag with the step). Missed target → hold (target follows the weakest set + 1). Below the range →
   `failed`, fails + 1; `failsBeforeDeload` (2; strength 3) → −`deloadPct` (10 %), and a machine already at its
   lightest setting or bodyweight with no added load stays there, with a note that says so and names no cut ("stay at
   bodyweight and build back up", "оставайтесь со своим весом"). **Incomplete logs** (§16 rule 4): fewer working sets than `plannedSets` → held, target
   and miss count unchanged, unless a logged set fell below the range (then the failure ladder applies). The most
   common load decides; lighter sets count as misses, heavier one-off attempts only feed the e1RM. `linear` = top
   only, `rep-target` never adds load, `rpe` sets the load from the e1RM within ±10 % (never lighter after a
   progressed session), except in a test session (its re-anchor decides, as under every rule) and where the note
   names the load to keep: a hold or a rule-5 wait at the top, reps to earn a step back, an incomplete log, no
   assistance left. Where it moves the load off the one the other notes name ("keep 60 kg" after a miss, "Repeat",
   "Same load", a step), the note keeps the session's reason and names the load it plans: "A set fell below 6 reps
   (miss 1 of 2). By effort: 55 kg × 6 reps next time (−5 kg)." Every note names the planned load, under every rule.
5. **Units**: seconds/metres progress by +5 until the top, then load if the exercise is loadable (carries: kg per
   hand; `maxWidenReps` still bounds their targets). Unloadable holds, bodyweight rep exercises (increment 0) and an
   assisted machine at 0 assistance stay at the top flagged `variant: "harder"` (not under `rep-target`), and
   `planSession` names the easiest harder exercise (catalog difficulty; registry class-mates first, bodyweight before
   loaded before assisted): the owner's captain's chair knee raise → hanging leg raise (master plan §16).
   **Assisted machines**: load = assistance; progress subtracts, deloads add; e1RM and % maths use bodyweight −
   assistance (one increment per 10 % without a bodyweight; the guard uses an 80 kg reference).
6. **Rounding** to the exercise increment (gym `increments[exerciseId]` → `increments[equipment]` → exercise);
   directions `nearest | down | up | easier | harder` (easier = down, or up for assistance). Never negative; 0 only
   for bodyweight, bands and assistance; other positive loads round to at least one step.
7. **e1RM**: internal Epley/Brzycki blend, numerically identical to stream 06's `analytics.e1rm` blend (pinned for
   1–20 reps × RIR 0–4, reliability included); reliable only when reps + RIR ≤ 12. Turning an e1RM back into a load
   (calibration, `rpe`, substitution, the guard) uses `loadFraction`: the exact inverse up to 12 total reps, the %1RM
   table above (Brzycki explodes near 37). `summarize` takes its effective load from `analytics.effectiveLoad`
   (push-ups ≈ 64 % of body weight, no e1RM where the share is unknown), so the session summary, its PR lines and the
   charts agree; the progression state keeps body weight + added load for its own maths.
8. **First session = test** (research 02 §E): start at `startLoad × 0.85` (bodyweight-scaled with the allometric 0.67
   exponent, Jaric 2002); the logged session re-anchors the working load at the e1RM-implied load for the bottom of
   the range with one extra RIR when that is heavier (or lighter after a too-heavy start); misses and ramp-up sets do
   not count. "Start lighter" names only a lighter load: a set below the range that leaves the load where it was (no
   assistance is the hardest setting, or the best set asks for more) says "Keep 40 kg and aim for 6 reps". The same
   calibration runs after a ≥ 14-day gap, after a goal switch, and for a substitute.
9. **Gaps** (task spec, softer than research 02 §I): < 14 days keep; 14–27 days −5 → −10 % (linear); ≥ 28 days
   −10 → −15 % (linear to 90 days), outcome `reset`, target to the bottom, test protocol shown again. §16 rule 1: the
   cut is rounded to the NEAREST step, never heavier, and applied once (a session done as planned is judged against
   the plan, not cut again); when that rounding gives no cut or more than `gapCut.maxMultiple` (2) × the intended one
   (cable fly 7.5 → 5 kg is −33 %), the load stays and the target drops `gapCut.repsMinus` (2) reps (10 s / 10 m), not
   below the bottom. Assisted cuts are measured in effective load (body weight − assistance).
10. **Goal switch**: `convertProgram` re-derives slots; states convert lazily (planSession/applySession) through the
    %1RM table to the new range's bottom (implied 1RM preserved), the first session × 0.95 with a single rounding to
    the nearest step (research 01 Table 10; rounding down lost 14–18 % of the implied 1RM on a 5 kg stack). Tested:
    the implied e1RM stays within 0.95 ± half a step (≤ 2 % from 40 kg up).
11. **Planned deload** (task spec): after `deloadEveryWeeks` (the goal's `blockWeeks`) accumulation weeks counted
    from `program.createdAt`, one deload week — sets × 0.6 (−40 %), same load, RIR + 2 and 2 fewer reps, no
    progression evaluation. An exercise back from a ≥ 14-day break is not deloaded again (the break was the deload).
12. **Rotation** A→B→C→A from the last finished or auto-closed session of any program version (unknown key → first
    day). `sessionStatus` turns an active session ≥ 6 h old into `auto_closed`. `nextDayKey` does not see sets: an
    empty session counts until the store has auto-closed it and the tracker's `closeOuts` (`useCloseOuts`, owner
    only) marks it `abandoned`.
13. **Gym preferences are guarded**: `preferred[slotId]` / `preferred[exerciseId]` apply only when the target is
    available and in the same registry class or listed as an alternative, so a stale preference never puts a row
    where a press belongs.
14. **Warm-ups**: compounds ramp 50 % × 8, plus 70 % × 4 and 85 % × 2 when heavy (≥ 80 % e1RM, or ≤ 8 total reps
    without one); none for bodyweight, bands, holds, carries. A compound whose direct muscles an earlier compound
    already warmed that day gets only its last ramp set (also priced into `estimateMinutes`).
15. **Substitutes** start from the current working load of the slot's exercise × 0.85 (× 0.6 for another pattern),
    across equipment families by research 04 §3.8 ratios (machine 0.8, dumbbell per hand 0.42, Smith 0.97 of
    barbell); assisted/bodyweight/band/hold crossings start fresh. They keep their own state.
16. **Skipped slots** keep their numbers; their note gets "Skipped last time" prepended once. Re-applying a session
    changes nothing (exercises whose `lastAt` ≥ session start are skipped). A slot logged with warm-ups only counts as
    skipped. A weight hold whose date has passed by the session start is cleared there too (decision 17), and advice
    that still names it gives way to the "The weight hold ended (…)" line `planSession` showed for it.
17. **Weight holds** (master plan §16, `ExerciseState.holdUntil`): before the date there is no load increase — no
    step, no widening past the top, no calibration or `rpe` raise; reps still climb within the range, and misses,
    deloads, break cuts and a calibration downwards still apply. A rep-range or RIR conversion during a hold keeps
    the load, at the reps it allows at the new RIR (40 kg × 12 @ 2 in 8–12 → 40 kg × 10 in 6–10, not 45 kg × 6). The
    first session after the date clears it to null, a deload-week session (which `applySession` does not evaluate)
    and a log with no working sets included (a slot skipped or logged with warm-ups only, judged at the session start). The adviser's `hold` change (`value` = 1–8 weeks) and the
    program page set it through `program-edit.setHold` / `holdUntilFor` (local midnight after the same weekday
    `weeks` later, so that session is still held); the adviser sees `states[].heldUntil`, and `validateProposal`
    drops a heavier `change_load` for a held exercise (lighter is how a hold goes back down).
18. **Plateau memory** (master plan §16 rule 5, 2026-11-09, revised the same day after review;
    `ExerciseState.plateau = { kg, times, streak }` in the row's spec jsonb, no migration): a reactive deload that
    lowers the load remembers the load it came down from (`times` + 1 when it is that load again; a machine already at
    its lightest setting has no step back to wait for). A step from below that load to it or harder waits for
    min(`rules.plateau.maxSessions` 3, 1 + times) sessions in a row at the planned load with every set at the top and
    the weakest set carrying that load by the capacity guard (`streak`, this session included; the target past the top
    counts while the guard holds the step). From `times` 2 that guard asks for `rules.plateau.spareReps` (2) more reps
    in hand, earned with reps at the same load first (EN/RU note "earn it with N reps at L first"), except at the rep
    ceiling, where the guard alone decides, so the wait always ends. Until then the hardest option that passes the
    guard and stays below it (a step trimmed to that load by the spare reps says "Only this step for now"), else the
    same load at the top with a note naming the failed load and the sessions left "like this one" (from `times` 2:
    "smaller steps or micro-plates"). A test session (back from a break of 2+ weeks) counts like any other, judged from
    its planned load (its lighter sets are the ramp-up); its e1RM re-anchor, or a ramp that reached that load, stops
    one step below it until the streak is there. A load change (a break's cut in `gapAdjust` too), a session that does
    not count or a miss starts the streak over; an incomplete log and a deload week leave it. The memory clears after a
    complete session past that load with no set below the range (a session at that load keeps it), and in
    `convertState`; `substituteState` starts without it; `gapAdjust` keeps it, so a break cannot erase it. The `rpe`
    rule keeps the load of a wait or a rep-earning session and otherwise stops one step below it (never below today's
    load). Deloads, misses, holds, rep progression, the rep ceiling and `variant`, bodyweight/band and rule 4 come
    first; a lifter at the top every session gets the step within min(3, 1 + times) sessions, after a second deload
    plus up to ceil(`spareReps` × failed ÷ current load, in effective kg) sessions of rep work: the spare reps are
    counted at the failed load, so they take 3 sessions at the current one for any step up to +50 % (11 376 cases of a
    lifter at the top every session, every loadable rep exercise × rule × RIR: none waits longer). The wait always
    ends, so a third and, rarely, a fourth deload from one load stay possible: 19 of 400 simulated stalled years not
    used to tune the rule (4.75 %) have an exercise deloaded 3+ times from one load, 1 (0.25 %) a fourth time, a face
    pull whose range top is the rep ceiling (12–20), so the spare reps never apply. `plateauOf` reads malformed values
    as none (cleared on the next session); states without one never grow the field; `store-core.isRow` does not check
    it. The adviser sees `states[].plateau = { failedKg, times }`, and its `change_load` / `deload` start the streak
    over at a new weight (a new range forgets it); the settings page's example (`ProgressionSettings`) runs with the
    memory, so it never promises a step the engine holds back. Where this departs from the first spec, measured on 230
    simulated stalled years (52 weeks; years with an exercise deloaded 3+ times from one load): clearing the memory on
    a test session 147 (30 of them 4+ times), clearing it after a complete session at that load 100 (16), 1 spare rep
    21 (0), the rule as above 9 (0); with 2 spare reps instead of 1 the 60 responding and average years of that sweep
    have the same deloads and failed sessions. Why not more: a longer wait would also slow a lifter who is still
    gaining.

## Acceptance checks (results 2026-11-08; §16 revision 2026-11-09)

- 2026-11-09, third review (decisions 4, 8, 16, 17, 18): `node --test tests/fitness/*.test.mjs` → 837 tests pass, 0
  fail (progression 46, session 25, units 12, simulation 152), also with TZ=America/Los_Angeles and
  TZ=Pacific/Kiritimati. The second review's "the load a note names to keep is kept" held for its three cases only (a
  hold at the top, an incomplete log, a test session): under `rpe`, 8 478 of 600 000 fuzzed `nextState` calls (three
  seeds) planned another load than their note named ("keep 60 kg" after a miss, "Repeat", "Same load", the "+2.5 kg"
  step, the big jump, the ceiling, less assistance). Now such a note keeps the session's reason and names the load the
  e1RM plans ("By effort: 55 kg × 6 reps next time (−5 kg)"), and 0 of the same 600 000 notes, under any rule, name
  another load than the plan. Fixed too: a weight hold whose date had passed survived a skipped slot and a slot logged
  with warm-ups only (18 later plans in the 400 stalled years below read such a state; now 0); a deload with nothing
  lighter to go to said "drop to bodyweight (−10 %)" / "уберите отягощение (−10 %)" at bodyweight and "drop to 5 kg
  (−10 %)" at a machine's lightest setting (now "stay at …" / "оставайтесь …", no percentage); a test session said
  "Start lighter: no assistance" while it kept no assistance; RU "Тот же вес (помощь 70 кг)", "для этого веса" and
  "оставьте этот вес" on assisted and bodyweight exercises (14 of 179 RU templates in a 150 000-call sweep; now "Та
  же нагрузка", "для этой нагрузки", "эту нагрузку"), and "начните с помощью 45 кг (−12,5 %)" after a break (now
  "−12,5 % нагрузки", as on the deload note). The runtime budget counts the simulating thread's CPU time
  (`process.threadCpuUsage`; the process's where Node lacks it): 710–736 ms alone; next to the parallel suite and 8
  busy processes the wall time was 1753–2513 ms (3 of 4 runs over 2 s) and the thread's CPU time 879–917 ms. Engine
  before → after this review, per-slot harness, 560 seeds (400 stalled, 40 each responder, average, small gym, new
  machine): every compared field identical (reactive deloads, failed sessions, worst repeat and where, hammer repeats,
  week-52 loads, failing checks); stalled: 3+ deloads from one load in 19 (4.75 %), 13 of them the machine incline
  press from 30 kg, 9.80 deloads and 26.45 failed sessions a year. The differential fuzz changed notes only (those
  above), `gapAdjust` only its RU percentage on assisted machines, and `convertState`, `substituteState` and
  `initialState` not at all. `npx tsc --noEmit` exit 0, `npx eslint` on the touched files clean.
- 2026-11-09, second review of rule 5 (decisions 4, 17, 18): `node --test tests/fitness/*.test.mjs` → 833 tests pass,
  0 fail (progression 44, session 24, advisor 14, simulation 152), also with TZ=America/Los_Angeles and
  TZ=Pacific/Kiritimati. Runtime: `num` built an `Intl.NumberFormat` per call, 2.6 s of the simulation file's 3.7 s
  (CPU profile); with one per language the 9 runs simulate in 0.19–0.22 s (was 0.78–0.79 s) and the 20 more stalled
  lifters in 0.47–0.53 s (was 2.60–2.62 s, outside the budget). All 29 are now timed against the 2 s budget (662–754
  ms, 826–913 ms in the parallel suite) and the file takes 1.04–1.19 s (was 3.84–3.96 s); FITNESS_SIM_REPORT=1 prints
  the same report as before. Fixed: the `rpe` rule planned 97.5 kg after "Keep 100 kg × 10 reps" during a hold and 107.5 kg
  after "100 kg × 8 reps again next time" (1 of 4 sets), and 418 of 10 991 test sessions in a fuzz named another
  load in "Test done: working load …" than the plan (now 0 of 10 991, 11 079 and 11 130 on three seeds): a test
  session now re-anchors as under every rule, and the load a note names to keep is kept. A weight hold whose date had
  passed survived a deload-week session (responder seed 700 011, and 3 of the 400 stalled seeds below); a deload week
  and a log with no working sets now clear it. RU notes on assisted machines and bodyweight with added load ("рабочий
  вес помощь 37,5 кг", "снизьте до помощь 45 кг", "с помощь 40 кг", "начните с помощь", "Повторите помощь", "с свой
  вес + 10 кг", the adviser's "вес помощь 30 кг зафиксирован") now read "рабочая помощь", "увеличьте помощь до 45 кг
  (−10 % нагрузки)", "с помощью", "с отягощением", "со своим весом", "нагрузка (помощь 30 кг) зафиксирована"; plain
  loads read as before. `checkPlans` expected the break's sentence first, but a weight hold ahead is said before it
  (responder seed 7 501, average 5 502). Per-slot harness, round 1 → now, the same 560 seeds (400 stalled, 40 each
  responder, average, small gym, new machine): every reactive deload count, failed session count, worst repeat and
  week-52 load identical; stalled: an exercise deloaded 3+ times from one load in 19 (4.75 %), a fourth time in 1
  (0.25 %), 9.80 deloads and 26.45 failed sessions a year; responder 3.10 / 15.57, average 7.50 / 22.98, small gym
  7.33 / 22.35, new machine 7.53 / 22.93; check failures 40 → 37 seeds (the 3 `checkHolds` gone; `checkCycles`, whose
  bounds are for the pinned runs, on 37 stalled seeds: 19 with 3+ deloads, 20 with the hammer curl twice, 2 both).
  `npx tsc --noEmit` exit 0, the strict `checkJs` pass exit 0, `npx eslint` on the touched files clean.
- 2026-11-09, rule 5 revised after review (decision 18): `node --test tests/fitness/*.test.mjs` → 826 tests pass, 0
  fail (progression 42, session 23, store-core 47, advisor 14, science 88, simulation 152), also with
  TZ=America/Los_Angeles and TZ=Pacific/Kiritimati. Fixed: the `rpe` rule planned a lighter load during a wait whose
  note said "keep" (338 of 6833 waits in a 60 000-call fuzz of the first version; now 0 of 5664); six test sessions in
  a row at the top never got back to the failed load (now the second one does); the streak counted top sessions that
  did not carry the load, so "never 3 times" held only on the pinned seed; the settings example ignored the memory;
  RU "Пока легче, чем помощь 25 кг" (now "с помощью 25 кг"). Engine before rule 5 → first version → revised, 52
  weeks, years with an exercise deloaded 3+ times from one load: per-slot-stream harness, 230 stalled seeds 204 → 120
  → 9 (4+ times: 117 → 26 → 0; mean deloads 14.37 → 11.48 → 9.87, failed sessions 36.03 → 30.60 → 27.03); the old
  shared-stream harness, 200 stalled seeds 175 → 103 → 12 (4+: 99 → 13 → 0); the 20 more stalled lifters of
  `simulation.test.mjs` 14 → 11 → 1. Responding and average lifters, before → revised, per-slot harness: mean
  deloads responder 3.00 → 2.90 (30 seeds) and 3.35 → 3.33 (40), average 8.00 → 7.70 and 7.35 → 7.10, small gym
  7.17 → 6.92, new machine 7.08 → 6.88; failed sessions fewer in every group; the three tracked lifts' mean week-52
  load 0 to 0.10 increments lower, no seed more than one increment lower. Shared-stream harness, 40 seeds each:
  average 7.85 → 7.17, responder 3.35 → 3.27, new machine 7.90 → 6.90, small gym 6.92 → 7.10 (its fixed run 3 → 3;
  the first version's 3 → 5 there was compared on the re-based harness); mean week-52 chest press, lat pulldown and
  assistance at most 0.5 kg behind. Pinned runs: `BEFORE_RULE_5` holds; stalled-52w 13 → 9 deloads, no load
  deloaded more than twice. A property fuzz of 3 × 60 000 `nextState` calls with a memory against an independent model
  of the revised rule: 0 violations (609–650 rep-earning sessions and 2–7 trimmed steps per run). Science page: EN
  2000 words, RU 1816. `npx tsc --noEmit` exit 0, a strict `checkJs` pass over progression, session, templates and
  advisor exit 0, `npx eslint` on the touched files clean.
- 2026-11-09, rule 5 (plateau memory), first version (the entry above supersedes it where they differ):
  `node --test tests/fitness/*.test.mjs` → 822 tests pass, 0 fail (progression
  40, session 23, store-core 47, advisor 14, science 88, simulation 150), also with TZ=America/Los_Angeles and
  TZ=Pacific/Kiritimati. The simulation now draws each slot of each workout from its own seeded stream (the calendar
  keeps the run's seed), so an engine change no longer reshuffles the rest of the run and before/after runs compare
  like for like; `checkPlateau` replays the memory independently and asserts every step from below a remembered load
  back to it came after min(3, 1 + times) top sessions in a row, test sessions included (never counting); the stalled
  lifter has no exemption in `checkCycles` any more (no exercise of any run deloaded from the same load more than
  twice a year). Same harness, engine before → after rule 5: stalled 52 weeks 13 → 9 reactive deloads and 40 → 32
  failed sessions, same-load repeats assisted pull-up 40 → 45 kg ×4 → ×2, machine crunch 22.5 → 20 kg ×3 → ×2,
  shoulder press 25 → 22.5 kg ×2 → ×1; responder and average runs: deloads equal or fewer (new machine 7 → 6), week-52
  chest press / lat pulldown / assisted pull-up unchanged (`BEFORE_RULE_5` pins these). Over 40 seeds × 52 weeks:
  stalled 15.48 → 11.98 deloads, 37.13 → 30.25 failed sessions, runs with an exercise deloaded 3+ times from one load
  38 → 28 of 40; responder 3.03 → 3.00, average 7.38 → 7.23 deloads, their mean week-52 chest press, lat pulldown and
  assisted pull-up within 0.13 kg. With the old shared stream the same engines give stalled 14 → 12 deloads
  (lower-back machine 40 → 35 kg ×5 → ×2, crunch ×4 → ×2, assisted pull-up ×3 → ×2); its small-gym run's 3 → 5 is
  reshuffling noise (40 seeds of that configuration: 6.63 → 6.67 deloads). 200 000 random `nextState` calls on states
  without a memory are identical to the engine before rule 5 except for the new field on 14 533 deloads that lowered
  the load; `gapAdjust`, `convertState`, `substituteState` identical. The 9 runs simulate in ≈ 0.8 s (limit 2 s).
  `npx tsc --noEmit` exit 0 (and a strict `checkJs` pass over progression, session, templates and advisor),
  `npx eslint` on the touched files clean.
- 2026-11-09: `node --test tests/fitness/*.test.mjs` → 785 tests pass, 0 fail (templates 12, progression 31, session
  22, program-edit 16, advisor 13, analytics 35, science 88, simulation 133 in ≈ 1.1 s). The simulation (owner
  program, responder / average / stalled lifters with ±4 % daily form, 12 and 52 weeks, skipped weeks, a 3-week break,
  a small gym, a new machine, a 3-week hold) asserts: every load step within one increment or +10 % and carried by the
  Epley guard; every planned set logged before a step; loads and targets within bounds (targets ≤ `repCeiling`);
  deloads only after `failsBeforeDeload` misses; a break cut once, ≤ 2 × the intended %, else the same load with 2
  fewer reps (also over every loadable slot × 24 loads × 14/17/21/27 days: > 1000 plans, > 50 reps-only); the hammer
  curl never repeats a deload; RIR 5 against a target of 2 plans 40 × 6 → 9 → 10 → 45 × 6 (RIR 2: one rep a
  session); 1 of 4 sets logged holds; assistance falls only when targets are hit; the average lifter's 52-week mean
  chest-press e1RM rises > 5 % and stays < 2 × the start (20 kg planned, 30 after the test, 40 at week 52); the
  rotation never skips a day; no load increase during a hold. `npx tsc --noEmit` exit 0; `npx eslint` on the
  touched files clean.

- `node --test tests/fitness/templates.test.mjs tests/fitness/progression.test.mjs tests/fitness/session.test.mjs`
  → 47 tests pass (12 + 21 + 14), including the real-catalog passes over the merged `exercises.json` (138 exercises):
  every template × goal × day (+ legs) plans finite loads with notes, and every catalog exercise starts, progresses
  five sessions and warms up sanely. All `tests/fitness/*.test.mjs` pass (213 at the time of writing).
- `npx tsc --noEmit` (whole repo, also `--incremental false`) exit 0; a strict `checkJs` pass with
  `--noUnusedLocals --noUnusedParameters` over the three modules exit 0; `npx eslint` on all seven files clean.
- Owner template slot ids/exercise ids/order equal `registry.ownerTemplate`; every template id is a registry id; no
  slot id twice in a template; sets 2–4; every slot has a bilingual `why`; every day has a 10–15 min finisher; all
  template days estimate 35–75 min (owner 68 / 56 / 52; 2-day 72 / 66; 4-day 57 / 56 / 39 / 53).
- Engine rows (`programs`, `exercise_state`) pass the store validators (`store-core.isRow`).

## Status

Done. Engine, data and tests are in place and green; no UI wiring in this stream (see integration notes in the
stream report: the session/logging UI calls `nextDayKey` → `planSession` → (log sets) → `applySession` and upserts
`changed`; the program UI upserts rows from `buildProgram` / `convertProgram` / `withLegs`).

## Open questions

- `ExerciseSlot` has no `role` field; roles are looked up from the template (by `templateId` + `slotId`) and inferred
  from the exercise otherwise. Adding `role?: string` to `ExerciseSlot` would make user-edited slots convert exactly.
- Resolved: master plan §7 now documents `nextState(state, sets, params, exercise, now, opts)` and the catalog-lookup
  shorthand, plus `initialState`'s `goal` option (`mode` remains an alias). It also lists the session application API.
- Program versions are new rows; the store makes the last upserted program active (`applyUpsert`), and old rows stay
  as history. `Program.active?: boolean` is now declared and supports explicit archival; version creation itself
  keeps older rows for history.
- Task-spec rules that deviate from research 02: gap tiers (14/28 days, −5…−15 %) are softer than §I; the planned
  deload cuts sets 40 % at the same load (§G suggests load or volume); "made" allows RIR one below target (§C says
  RIR ≥ target) because logged RIR is ±1.
- Weekly volume (fractional: direct 1, synergist 0.5) of the owner program with the merged catalog: chest 16.5,
  back 18.5 (13 direct), shoulders 21 (7 direct) vs the recomp band 10 / 13 / 16. Pressing and rowing synergists
  inflate shoulders; the UI should label the number as fractional (or show direct sets). No exercise change made —
  the master plan's slot table fixes the exercises.
- `applySession` is idempotent per session, so editing a set after applying does not re-evaluate it; re-evaluation
  needs the pre-session states (the store keeps no state history). Logging UI: apply once on finish/auto-close.
- Without `settings.bodyweightKg`, assisted start loads assume an 80 kg lifter and assistance changes by one
  increment per 10 %; the owner's bodyweight should be entered before the first assisted session.
- `ExerciseState.variant` was appended to types.ts (optional) for the §16 rule 2 flag; it travels in the row's
  `spec jsonb` (no migration), and `store-core.isRow` does not check it.
- Noise-driven retry cycles for a lifter who has truly stalled (the lower-back machine deloaded 40 → 35 kg five
  times in a year, ± 4 % daily form at a coarse step) are answered by rule 5 (decision 18): in the pinned runs no
  exercise repeats a deload from the same load more than twice a year. What remains: the wait always ends, so of 400
  random stalled years not used to tune the rule (per-slot harness, 40 seeds from each of 2 000 000, 3 000 000 …
  11 000 000), 19 still have an exercise deloaded 3 times or more from one load (4.75 %; 13 of them the machine incline
  press from 30 kg, a 5 kg pin that is +20 % at 25 kg) and 1 a fourth time (0.25 %: seed 5 000 020, face pull 15 →
  12.5 kg, range 12–20, whose top is the rep ceiling, so the spare reps never apply); the engine before rule 5 had 361
  and 202 of the same 400, mean reactive deloads 14.30 → 9.80, failed sessions 35.27 → 26.45. Fewer would need a
  longer wait or micro-plates by default on coarse stacks (a product decision); the note suggests them from the second
  deload. Flagging `variant: "smaller-steps"` from the second deload when the range top is the rep ceiling (so the
  planner names a variant with finer steps first) was measured and not adopted: it changes only the note and the order
  of the alternatives, so the 400 stalled and the 160 responding, average, small-gym and new-machine years keep every
  deload, failed session and week-52 load (the simulated lifter stays on the slot's exercise; whether the owner would
  switch is the open part).
- The hammer curl (C5, 10–15 @ RIR 1, 2 kg dumbbell steps: 8 → 10 kg is +25 %) no longer cycles 8 → 10 kg on the
  pinned runs (rule 2), but in a stalled year it can still be deloaded twice from 10 kg: 20 of the 400 years above
  (5 %), never 3 times. Before rule 5 the same 400 had 39 such years, 20 of them with 3–5 deloads from 10 kg, and each
  of today's 20 among them. That is rule 2's area (the capacity guard and the rep ceiling), not rule 5's; no behaviour
  change. `checkCycles` holds it to once only on the pinned runs.
- The tracker's RIR chips stop at "4+" (logged as 4), so the easy-set jump sees at most target + 2 at RIR 2; the
  engine handles any RIR.
- Under `rpe` the best set's e1RM can plan a heavier load after a session with a set below the range: 365, 377 and
  377 of the 925, 911 and 922 misses whose load the rule moved, in three 200 000-call fuzzes (the note now says so:
  "A set fell below 6 reps (miss 1 of 2). By effort: 65 kg × 6 reps next time (+5 kg)."). Double progression keeps
  the load after a miss. Whether `rpe` should never go heavier after a miss, as it never goes lighter after a
  progressed session, is the owner's call; nothing changed here.
