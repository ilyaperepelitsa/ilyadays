# 10 — Program page (editor, goal modes, days per week) and the AI advisor

Status: done · 2026-11-09. Stream 10. Contract: `00-master-plan.md` §2–§8, §12, §14–§16 (the master plan wins).
Inputs: `research/01-goals-and-programming.md` (Tables 1, 4, 5, 7, 10), `research/02-progression-algorithms.md`,
`research/08-app-ux-survey.md` (§H reasons, §K plain-language previews), stream 03's `templates.mjs` /
`progression.mjs` / `session.mjs`, stream 01's store, `src/lib/trips/openai.mjs` + `src/lib/trips/store.mjs` (reused).

## Scope

- `/fitness/program` (EN + RU): goal mode switch with the parameter table, days per week 2/3/4, template picker,
  legs add-on toggle, the A/B/C… days with editable slots (swap, sets, reps, RIR, rest, rule, order, add, remove, the
  slot's "why", next-session target), progression settings with a plain-language preview, the AI advisor, and the
  list of recent plan changes.
- Pure, tested logic: `src/lib/fitness/program-edit.mjs` (edits) and `src/lib/fitness/advisor.mjs` (LLM call
  builder, strict schema, validation, apply). The engine (stream 03) decides every number; this stream edits the
  program and calls the engine.
- Viewer mode: the program read-only, no editor controls, no advisor. The one ModeNote comes from `FitnessNav`.

## Files (owned)

```
plans/fitness/10-ai-advisor.md                         this plan
src/lib/fitness/program-edit.mjs                       pure program edits, bounds, diff, commit
src/lib/fitness/advisor.mjs                            adjustCall, advisorSchema, validateProposal, applyProposal
src/components/fitness/program/ProgramEditor.tsx       "use client" — draft, save bar, sections
src/components/fitness/program/ModeSwitch.tsx          goal buttons + GOAL_MODES parameter table + sources
src/components/fitness/program/DaysSwitch.tsx          DaysSwitch (2 / 3 / 4) and LegsToggle
src/components/fitness/program/TemplatePicker.tsx      start over from a template
src/components/fitness/program/DayCard.tsx             one day: slots, finisher, add exercise
src/components/fitness/program/SlotRow.tsx             one slot: prescription, next target, why, editor, swap list
src/components/fitness/program/ProgressionSettings.tsx rule parameters + deload interval + engine preview
src/components/fitness/program/AdvisorPanel.tsx        AdvisorPanel (request, key/model/effort, proposal) + PlanHistory
src/components/fitness/program/Stepper.tsx             − value + (44 px buttons)
src/components/fitness/program/format.ts               bilingual prescription / target / load / number texts
src/views/fitness/ProgramView.tsx                      server view (FitnessShell + h1 + FitnessNav + editor)
src/app/(en)/fitness/program/page.tsx, src/app/ru/fitness/program/page.tsx   thin routes (programMeta)
src/styles/fitness/program.css, src/styles/fitness/advisor.css               fpr-* and fad-* classes
tests/fitness/program-edit.test.mjs, tests/fitness/advisor.test.mjs
```

## Contract / API

`program-edit.mjs` — every edit is pure and returns a new `Program` with `version + 1` and `updatedAt = now`, keeping
the id. It returns the SAME object when nothing changes (unknown day or slot, or the same value):

- `setGoal(program, goal, states, now)` → `{ program, states }` via `convertProgram`: the slots are re-derived and the
  block calendar restarts. `states` comes back unchanged on purpose (decision 2).
- `setDays(program, days, now)` rebuilds from the 2-, 3- or 4-day template. It carries over the owner's swaps,
  slot overrides (sets, reps, RIR, rest, rule, increment; clamped), removals and added slots, keyed by the template
  exercise id. The legs add-on, the progression parameters, `deloadEveryWeeks` and `createdAt` carry over too.
- `swapSlot(program, dayKey, slotId, exerciseId, now)` changes the slot's exercise.
- `setSlot(program, dayKey, slotId, { sets, repRange, rir, restSec, progression }, now)` is clamped by
  `slotBounds(goal, unit)`.
- `moveSlot(program, dayKey, slotId, delta, now)` moves a superset pair as one block.
- `addSlot(program, dayKey, exerciseId, now)` derives the prescription from the role.
- `removeSlot(program, dayKey, slotId, now)` never empties a day, and a lone superset partner gets its straight-set
  rest back.
- Also: `addLegs(program, now, { as })`, `removeLegs(program, now)`,
  `resetToTemplate(templateId, goal, days, now, { from })` (with `from`: same id, next version, new block),
  `setProgressionParams(program, ruleId, patch, now)` and `setDeloadEvery(program, weeks, now)`.
- Bounds: `GOAL_BOUNDS`, `UNIT_BOUNDS`, `PROGRESSION_BOUNDS`, `DELOAD_EVERY_BOUNDS`, `slotBounds(goal, unit)`.
- `currentProgram(snapshot)` → `{ program, saved }` gives the active program. Without one, it gives the owner
  template with the saved goal and days (deterministic id `"default"`, never written as is), mirroring stream 04's
  `ensureProgram`.
- `commitProgram(saved, draft, now)` → `{ program, archived }`: the row to upsert (new UUID, `version = saved.version
  + 1`, `active: true`) and the old row with `active: false`.
- `programDiff(before, after)` → `[{ kind, dayKey, slotId, text: Text2 }]`, used by the save bar and the manual
  adjustment row.
- Lookups: `swapCandidates(exerciseId, gym)`, `likeForLike(a, b)`, `templateSlotOf(program, slotId)`,
  `legsMode(program)`, `isDefaultProgram(p)`, `defaultProgram(goal, days)`, `nextSlotId`, `slotBlocks`.

`advisor.mjs`:

- `adjustCall({ program, states, sessions, sets, settings, bodyweight, adjustments, gym, request, lang, now })` →
  `LlmCall { name, developer, user, schema }`.
  - The developer prompt holds the engine's rules, the owner's constraints and the change types. It also says that
    states hold the NEXT session's plan.
  - The user message holds the request plus `advisorContext(...)` as compact JSON: the program (slots with role,
    unit and bounds), the exercise states, the last 8 sessions summarised by `session.mjs summarize`, adherence
    (`analytics.adherence`), body weight, recent plan changes and gym-available swap options per exercise.
- `advisorSchema()` / `ADVISOR_SCHEMA` is strict: every object has `additionalProperties: false` and `required` = all
  keys. Shape: `{ summary: {en, ru}, changes: [{ type, dayKey, slotId, exerciseId, newExerciseId, value, value2,
  text: {en, ru}, reason: {en, ru} }], cautions: [{en, ru}] }`.
  - `type` is one of set_days | swap_exercise | change_sets | change_reps | change_rir | change_load | deload |
    hold | add_legs | note.
- `validateProposal(raw, program, catalog, { states, gym, allowLegs, bodyweightKg })` → `{ summary, changes,
  cautions, dropped }`. It throws `AdvisorError("shape")` when the answer is not an object.
- `applyProposal({ program, states, proposal, now, settings, gym })` → `{ program, states, applied, skipped,
  changedStates }`. Program changes go through `program-edit.mjs`, and load, deload and hold edit the states directly.
  `applyAdjustment(program, states, proposal, now)` is the master plan §7 alias.
- Helpers: `describeChange(change, program, states, lang)`, `adjustmentRow({ …, applied, saved })`,
  `manualAdjustmentRow(...)` and `asksForLegs(request)`.

UI writes happen only when `canWrite` and the store is settled:

- **Save** writes `programs` (the new version), the archived old row, `settings` (goal, daysPerWeek) and an
  `adjustments` row (`source: "manual"`, the diff lines).
- **Advisor Apply** makes the same program and settings writes when the program changed, plus the changed
  `exercise_state` rows and an `adjustments` row (`source: "ai"`, `applied: true`, `savedProgramId`).
- **Dismiss** writes an `adjustments` row with `applied: false`.

## Design decisions (with reasons)

1. **Draft + Save, one new program row per save.** Edits go to a local draft. A sticky bottom bar in the thumb zone
   shows "N changes · Discard · Save". Saving writes a new program version (new UUID) and marks the old one
   `active: false`. Reasons:
   - One tap on a stepper must not write a row.
   - Plan 03 treats versions as rows.
   - A session in progress keeps planning against the version it started with (`programs[session.programId]`).
   - The old version stays as history.
2. **Exercise states convert lazily (deliberate deviation from "convertProgram + convertState").**
   `session.mjs startingState` converts a state whose range or RIR differs from its slot at plan time (× 0.95), and
   `applySession` marks that session `converted` so it calibrates. Converting in `setGoal` would line the ranges up
   early, so both the 5 % safety margin and the calibration would be skipped. The page shows the converted next
   targets through `planSession`.
3. **Bounds come from research 01** (Tables 1, 4, 5). Each goal gets reps / RIR / rest windows wide enough for every
   role:

   | Goal | Reps | RIR | Rest |
   | --- | --- | --- | --- |
   | strength | 3–15 | 1–4 | 60–300 s |
   | hypertrophy | 5–30 | 0–4 | |
   | recomp | 4–20 | 1–4 | |
   | endurance | 10–30 | 0–3 | 30–120 s |
   | maintenance | 4–20 | 1–4 | |

   Holds take 10–120 s, carries 10–100 m, and every slot 1–5 sets.
4. **Days switch keeps your edits; the template picker starts over** (new block, next version of the draft).
5. **Added slots never reuse a template slot id** (`A7` after A1–A6). The engine looks up a slot's role by template
   slot id, and gyms keep preferences by slot id.
6. **Advisor: smallest safe change.** The prompt states the engine's rules and the owner's constraints:
   - keep the goals;
   - machines first;
   - no legs unless asked;
   - pain → swap and a caution;
   - load jumps of at most +10 %;
   - at most 6 changes;
   - ids only from the context.

   `validateProposal` is the real gate. It drops:
   - unknown ids;
   - swaps that are not like-for-like or not at the gym;
   - values outside the bounds;
   - load jumps over 10 %;
   - legs nobody asked for;
   - slot changes next to `set_days`;
   - duplicates and anything past 6 changes.
7. **`value2` added to the change schema.** A rep range needs two numbers (`change_reps`: value = bottom, value2 =
   top), and `change_load` uses it for the target reps (0 = keep). Every other type sends 0.
8. **Diff lines are computed, not trusted.** Each change is shown as a line built from the program and the states
   (`A3 · Pec deck → Cable fly`, `Lat pulldown: next time again 55 kg × 7`), followed by the model's reason. What is
   applied is exactly what is shown.
9. **`hold` is note-only.** A state already holds the next session's plan (the last session is counted in it), so
   `hold` keeps it and adds the reason. Going back to a lighter weight is `change_load`, and the prompt says so.
10. **Key handling mirrors the trip planner**: the same localStorage key (`readAiKey`/`writeAiKey`), model and
    effort (`subscribePrefs`), and `completeJson` (Responses API, strict json_schema, one retry on 5xx/429). The key
    field hides once stored. The key goes to OpenAI only and never into a row.
11. **Read-only until the data is settled.** Viewer and loading modes render the program without controls. In
    synced mode with no program yet, editing waits for the first pull, so a half-loaded snapshot never replaces the
    real program. The tracker (stream 04) saves the default program on the first visit; this page never writes it
    unprompted.
12. **Advisor works on the saved program only**: Ask and Apply are disabled while the editor has unsaved edits
    (Apply would otherwise replace them).
13. **No page-level mode notes** (master plan §14): the viewer line was removed; ModeNote in `FitnessNav` says it.

## Test hooks (§15 and additions)

§15:

- `goal-select` and `days-select` on the button groups. Each group has the current value in `data-value`, and each
  option button carries its own `data-value`.

Added (stable; renaming one means updating the e2e tests):

| Area | Hooks |
| --- | --- |
| Program | `program-summary` (`data-program-id`, `data-version`, `data-saved`, `data-editable`), `program-loading`, `program-save`, `program-discard`, `program-saved`, `program-day` (`data-day-key`) |
| Slots | `slot-row` (`data-slot-id`, `data-exercise-id`), `slot-edit`, `slot-sets`, `slot-rest`, `slot-reps-from`, `slot-reps-to` (each with `-minus` / `-plus` and `data-value`), `slot-rir` and `slot-rule` (groups, `data-value`), `slot-swap-open`, `slot-swap-option` (`data-exercise-id`), `slot-up`, `slot-down`, `slot-remove` |
| Days | `day-add` (`data-day-key`), `day-add-search`, `day-add-option` (`data-exercise-id`) |
| Legs, templates | `legs-toggle` (`aria-pressed`), `legs-slots`, `template-use` (`data-template-id`) |
| Progression | `progression-step`, `progression-fails`, `progression-deload`, `progression-overshoot`, `deload-every` (steppers) |
| Advisor | `advisor-example`, `advisor-request`, `advisor-key`, `advisor-key-change`, `advisor-key-remove`, `advisor-model`, `advisor-effort` (`data-value`), `advisor-ask`, `advisor-error`, `advisor-proposal`, `advisor-change` (`data-type`), `advisor-apply`, `advisor-dismiss`, `advisor-done` (`data-applied`) |
| History | `plan-history`, `plan-change` (`data-source`, `data-applied`) |

## Acceptance checks

- [x] `node --test tests/fitness/program-edit.test.mjs tests/fitness/advisor.test.mjs` passes: 25/25. The whole
  `tests/fitness` suite passes too: 606/606.
- [x] `npx tsc --noEmit` is clean for the whole repo, including with `--incremental false`. `npx eslint` is clean on
  every stream file.
- [x] `/fitness/program` and `/ru/fitness/program` exist with `programMeta`. Both are in the sitemap and the offline
  catalog (master-owned).
- [x] A server-render smoke harness ran without an app server (scratchpad, not committed). It made 64 renders of
  `ProgramEditor` across 16 states × EN/RU × slots closed/open:
  - States: loading, local unsaved and saved, gym substitutions, synced waiting and saved, viewer, legs day and
    slots, 2/4 days, strength, endurance, draft, proposal, done + error.
  - Results: no throw, no React warning, no "NaN/undefined/null" in the text, and the expected hooks are present.
    Viewer and loading renders show no editor or advisor hooks.
- [x] Phone layout of those renders with the real stylesheets in Chromium, 360/390/430 px, light + dark:
  - no horizontal scroll;
  - every button, summary and input is at least 44 px;
  - the save bar sticks to the bottom of the viewport.

## Status

Done. Changes in the resume pass:

- Removed the duplicate viewer mode note.
- Russian decimal commas in steps; deload size without a double minus.
- The progression preview explains the engine's "earn the big step with extra reps first".
- Slot actions laid out as a swap row plus a ↑ ↓ … Remove row.
- Apply is disabled while the draft is dirty.
- The `hold` line shows numbers, and the prompt says the states are the next session's plan.
- `savedProgramId` / `savedVersion` in AI adjustment rows.
- `resetToTemplate({ from })`, a `LegsToggle` component and the `applyAdjustment` alias.
- The full set of test hooks, with tests for the new behaviour.

## Open questions

1. `setGoal` returns the states unchanged (decision 2) instead of running `convertState`. Is the lazy, calibrated
   conversion the intended contract? (It is what `session.mjs` implements.)
2. Should master plan §15 list the program page's added hooks above (it is master-owned)?
3. A real "hold the next progression" (no increase after the next session) needs engine support, for example
   `ExerciseState.holdUntil?: string` in `types.ts` (master-owned). Today `hold` is a note and `change_load` lowers a
   weight.
4. `value2` in the advisor change schema is an addition to the task's field list (decision 7). Keep it?
