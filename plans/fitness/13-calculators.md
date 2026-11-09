# 13 — Training calculators (`/fitness/tools`)

Owner: master (added 2026-11-08 after checking the request against the stream plans: nutrition, heart-rate and VO2max
calculators existed in plan 09, but nothing answered "I did 45 kg × 8 — what do I put on for 5?").

## What it does

- **One-rep max and loads.** Pick an exercise (the program's first, then every loaded exercise), enter a set
  (kg × reps, reps in reserve) or tap "Use my last set". It shows the estimated 1RM and a table of loads for
  1–20 reps at RIR 0–3, rounded to the machine's step (the active gym's increment wins), with the program's rep range
  highlighted and estimates past 12 total reps greyed out.
- **Assisted machines** work on the lifted part (body weight − assistance): the table lists assistance, less for
  harder targets, "none" when a target needs no assistance. Body weight comes from the latest weigh-in, then the
  settings, else an input appears.
- **Warm-up** for the entered set: the engine's ramp (`warmupRamp`).
- **Plates per side** for barbells and plate-loaded machines: bar 20/15/10 kg or none, untick plates the gym lacks;
  exact with the fewest plates (dynamic programming, not greedy), else the heaviest load below with the shortfall.

## Why one formula

`src/lib/fitness/tools.mjs` calls the engine (`e1rmOf`, `loadFraction`, `roundLoad`, `warmupRamp` in
`progression.mjs`). The analytics module computes the same e1RM (mean of Epley and Brzycki); a test pins the
agreement, so the plan, the progress charts and this page never show different numbers. Loads for a target come
from `loadFraction`, as in the planner: the exact inverse of the equations up to 12 total reps (reps + RIR), the
%1RM table above (2026-11-09: the table had used the inverse everywhere, about 6 % light at 15 reps with 2 in
reserve and 12 % at 20 total reps; `tests/fitness/tools.test.mjs` pins the planner's numbers).

## Files

| File | What |
| --- | --- |
| `src/lib/fitness/tools.mjs` | `loadTable`, `platesPerSide`, `warmupFor`, `lastWorkingSet`, `calculable` (pure) |
| `src/components/fitness/tools/LoadCalculator.tsx` | `LoadCalculator`, `PlateCalculator` (client) |
| `src/views/fitness/ToolsView.tsx`, `src/app/(en)/fitness/tools/page.tsx`, `src/app/ru/fitness/tools/page.tsx` | page + routes |
| `src/styles/fitness/tools.css` | styles (48 px steppers, scrollable table on phones) |
| `tests/fitness/tools.test.mjs` | 19 behavioural tests: identity, RIR shift, monotonicity, rounding, gym override, reliability, assisted maths, plates (exact, fewest, non-greedy, fallback, no bar), warm-up, last set |

Wired into: the fitness sub-navigation (`Shell.tsx`), `sitemap.ts`, the offline catalog's fixed pages, and the
browser page sweep (`tests/fitness/e2e/test_pages.py`).

## Status

- [x] Pure module and tests
- [x] Page, routes, metadata, styles, navigation, sitemap, offline
- [ ] Phone screenshots reviewed in the QA pass (plan 12)
