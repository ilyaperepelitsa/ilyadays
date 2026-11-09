# 05 — Gym profiles

Status: done (2026-11-08). Contract: `00-master-plan.md` §4–§8, §12, §15 (the master plan wins). Inputs:
`research/08-app-ux-survey.md` §I–J (equipment profiles: Fitbod Locations, Alpha Progression gym profiles),
`src/lib/fitness/session.mjs` (`resolveExercise`, the planner's slot resolution), `templates.mjs` (`buildProgram`),
`progression.mjs` (`incrementFor`), `catalog-core.mjs` (client-safe labels and search), the store (stream 01).

## Scope

- Name gyms, pick the active one (`settings.activeGymId`), rename, delete (with a confirm step).
- Per gym: quick setup by equipment type, the "Equipment here" list (grouped by coarse muscle group, then
  equipment) with a three-state chip per exercise, search, "Your plan at this gym" with swaps marked and a
  per-slot "Preferred at this gym" picker, weight-step overrides (2.5 / 5 kg) for pin-loaded machines, notes.
- Read-only for visitors (viewer mode) and while the store is loading. EN + RU. Phone first.

## Files (owned)

```
plans/fitness/05-gym-profiles.md            this plan
src/lib/fitness/gyms-core.mjs               pure, import-free: every gym operation (client bundles import THIS)
src/lib/fitness/gyms.mjs                    server/engine: re-exports gyms-core with the full catalog as default,
                                            GYM_EXERCISES (trimmed catalog for the client), previewDays()
src/components/fitness/gyms/GymProfiles.tsx "use client" root: list, create, select, writes
src/components/fitness/gyms/GymEditor.tsx   header (rename, use, delete) + sections of one gym
src/components/fitness/gyms/EquipmentList.tsx, QuickSetup.tsx, PlanAtGym.tsx, WeightSteps.tsx, GymNotes.tsx, shared.ts
src/views/fitness/GymsView.tsx              server view (FitnessShell + h1 + FitnessNav + GymProfiles)
src/app/(en)/fitness/gyms/page.tsx, src/app/ru/fitness/gyms/page.tsx   thin routes (gymsMeta)
src/styles/fitness/gyms.css                 fit-gym-* classes
tests/fitness/gyms.test.mjs
```

## Contract / API

`gyms-core.mjs` (no imports; every function returns a NEW gym with `updatedAt = now`, or the SAME object when
nothing changed, so callers can skip the write):

- `newGym(name, now, id?)` → `Gym` (UUID id, `available: []` = everything assumed, `missing: []`, `preferred: {}`);
  `renameGym`, `setNotes(gym, text, now)` (empty clears).
- `effectiveAvailability(gym, id)` → `{ mark: "has" | "missing" | "unknown", available, assumed }`; `isAvailableAt`
  (same semantics as `catalog.isAvailable`), `isChecklist(gym)` (= `available` non-empty), `nextMark(gym, id)`.
- `setAvailability(gym, id, "has" | "missing" | "unknown", now)`: `missing` adds to `missing` (and leaves
  `available`); `has` removes from `missing` and adds to `available` only when that list is non-empty; `unknown`
  removes from both. A checklist never becomes empty (empty would mean "everything"): ids removed by the last change
  stay listed and are added to `missing` (missing wins).
- `setChecklist(gym, on, now, catalog)`: on = `available` ← every catalog exercise not missing (the plan does not
  change at the switch); off = `available: []`.
- `QUICK_TYPES` (9 equipment types, bodyweight excluded), `typePresent`, `presentTypes`,
  `quickSetup(gym, types, now, catalog)`: every exercise of an unticked type → missing; a ticked type that was
  absent (no exercise available) is restored (`has`); ticked types already present keep their individual marks.
- `setPreferred(gym, key, exerciseId | null, now)` (key = slot id or exercise id); `preferForSlot(gym, slot, id |
  null, now)` stores the choice under the slot's exercise id and clears the slot-id key that would shadow it.
- `setIncrement(gym, key, kg | null, now)` (null / ≤ 0 / NaN clears); `effectiveIncrement(gym, exercise)` mirrors
  `progression.incrementFor` (exercise id → equipment → catalog increment); `baseIncrement`, `incrementChoices`;
  `STACK_EQUIPMENT` (selectorized, cable, assisted) and `hasStack(exercise)`.
- `gymCatalog(entries)`, `resolveSlot(slot, gym, catalog)` (mirrors `session.resolveExercise`), `slotChoices`,
  `planAtGym(program, gym, catalog)` → `{ days: [{ key, name, slots: SlotAtGym[] }], changed, stuck }` with
  `status: "plan" | "preferred" | "swapped" | "stuck"`, `planDiff(program, gymA, gymB, catalog)` → changed slots,
  `gymSummary(gym, program, catalog)`.

`gyms.mjs` re-exports all of it, binds `catalog` to `GYM_CATALOG` (full catalog) for `quickSetup`, `setChecklist`,
`typePresent`, `presentTypes`, `resolveSlot`, `slotChoices`, `planAtGym`, `planDiff`, `gymSummary`, and adds
`GYM_EXERCISES` (`GymExercise[]`: id, name, aka, equipment, group, alternatives, registry classes, increment) and
`previewDays(daysPerWeek)` (the template days `buildProgram` makes when no program is saved yet).

Test hooks (§15): `gym-card` (button; `data-gym-id`, `data-active`), `machine-toggle` (the chip button;
`data-exercise-id`, `data-available` = true/false, `data-mark`). Also `gym-create-name`, `gym-create`, `gym-use`,
`gym-rename`, `gym-delete`, `gym-delete-confirm`, `quick-type` (`data-type`), `gym-search`, `group-toggle`
(`data-group`), `plan-slot` (`data-slot-id`, `data-exercise-id`, `data-program-exercise-id`, `data-status`),
`pref-open`, `pref-option` (`data-exercise-id`, "" = automatic), `steps-toggle`, `increment-option`
(`data-exercise-id`, `data-kg`), `gym-notes`, `gym-checklist` (`data-value` = assume / checklist), `gym-add`,
`gym-rename-input`.

## Design decisions

- **Two modules, like catalog / catalog-core.** `catalog.mjs`, `session.mjs` and `templates.mjs` import the 576 KB
  exercises JSON; client code must not (stream 02 rule). `gyms-core.mjs` is import-free and takes a small catalog
  (`GymExercise[]`, ~60 KB) that the server view passes as props; the program preview for "no program yet" is
  built on the server too. `resolveSlot` duplicates `session.resolveExercise` (10 lines) instead of importing it;
  a seeded test compares both over every template slot and 300 random gyms, so they cannot drift silently.
- **Everything is assumed until marked** (Fitbod's "large gym" default, the QA script "untick a machine, see the
  plan swap it"). In that mode `has` and `unknown` are the same stored state, so the chip toggles Here ⇄ Not here.
  A per-gym **checklist** switch ("unmarked machines: count as here / skip them") gives the third state meaning:
  "Not sure" machines are skipped by the planner. Seeding the checklist with everything not missing keeps the plan
  unchanged at the switch.
- **Preferences are keyed by the slot's exercise id**, not the slot id: slot ids differ between the 2-, 3- and
  4-day templates (A2 is a pulldown in one, a row in another), exercise ids do not. `session.resolveExercise`
  reads both keys and ignores a preference that is missing here or not in the slot's class / alternatives, so the
  picker offers exactly those exercises (`slotChoices`).
- **Quick setup is a set of toggles, not a wizard.** A chip is "on" while any exercise of that type is available;
  turning it off marks the type missing, turning it on restores it. Bodyweight is never touched (no chip).
- **Equipment list stays short on a phone.** Each muscle group shows only the exercises the program uses (or the
  plan resolves to) until "All N" is tapped; search shows a flat list across groups. So `machine-toggle` for every
  program exercise is visible without extra taps and appears once per exercise (no duplicate test ids).
- **Weight steps** for every weight-stack exercise the plan uses here — pin-loaded machines, and also cable
  stations and the assisted pull-up machine, which move by a pin in a stack too (6 of the owner's 20 slots; a 5 kg
  cable stack with a 2.5 kg catalog step would plan unloadable weights). Chips 2.5 / 5 kg plus the usual value;
  tapping the value the gym would use anyway clears the override. Collapsed by default (set once per gym).
- **Visitors** see the gym list, the marks, the plan there, the steps and the notes; quick setup, the checklist
  switch, pickers, rename, delete and create are not rendered.
- **Deleting the active gym** clears `settings.activeGymId` (the plan then assumes all equipment). Sessions keep
  their `gymId` (no foreign key). The first gym created becomes active automatically.
- **Writes** go through `store.upsert("gyms", …)` / `store.remove("gyms", id)` / `store.upsert("settings", …)`,
  only when `canWrite`, always from the latest snapshot row; notes are debounced (0.8 s) and flushed on blur.

## Acceptance checks

- `node --test tests/fitness/gyms.test.mjs` passes; `npx tsc --noEmit` clean for stream 05 files;
  `npx eslint` clean on stream 05 files.
- Phone (360–430 px): create a gym, untick "Pec deck", the plan shows "Cable fly instead of Pec deck"; untick a
  whole equipment type; pick a preferred alternative; set a 2.5 kg step; notes survive a reload; delete asks first.
- Viewer mode: every control disabled or hidden; nothing writes.

## Status

Done 2026-11-08.

- `node --test tests/fitness/gyms.test.mjs`: 21/21. Includes a seeded check that `resolveSlot` equals
  `session.resolveExercise` for every slot of the 2-, 3-, 4-day and legs programs at 300 random gyms, that every
  `slotChoices` entry is a preference the planner accepts, that `planAtGym` matches `planSession` exercise by
  exercise, and that `effectiveIncrement` equals `progression.incrementFor`.
- `npx tsc --noEmit` clean (whole repo); `npx eslint` clean on every stream 05 file.
- Browser check without next dev/build (workflow rule): the real components transpiled with the TypeScript API into
  a CommonJS bundle over a fake store (scratchpad only, not committed), driven by Playwright/Chromium at 390 × 844
  and 360 × 780, EN + RU, light + dark, local / viewer / loading: create → untick pec deck → A3 becomes cable fly;
  quick setup off/on; preference; weight step set and cleared; debounced notes; expand, search, checklist cycle;
  second gym, activate, delete; reload. No console errors, no horizontal scroll, every control ≥ 44 px. The client
  closure is gyms-core, catalog-core, i18n, store-core and the components (no exercises JSON).
- Full `npm test`: 537/543 at the time of writing; the 6 failures are not in this stream (`images.json` freshness,
  stream 07; five `simulation.test.mjs` progression cases, stream 03 engine).

## Open questions

- In "everything assumed" gyms a confirmed `has` cannot be stored (it equals `unknown`). A `Gym.checked?:
  string[]` field would let the chip keep three states without the checklist switch.
- `Gym` has no `createdAt`; the list sorts by name.
- Stack steps other than 2.5 / 5 kg (4.5 kg lb stacks, 7 kg) have no chip yet; `setIncrement` accepts any value, so a
  free "other" input can be added when a gym needs it.
- The tracker (stream 04) should let the owner pick the gym at "Start" and offer "use here from now on" in its swap
  sheet: `preferForSlot(gym, slot, id, now)` from `gyms-core.mjs` stores exactly what this page shows.
