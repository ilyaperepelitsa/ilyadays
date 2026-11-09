# 09 — Nutrition calculators (+ heart-rate zones and VO2max field tests)

Status: done · 2026-11-08 (relaunch; the first attempt left only this plan and an empty CSS stub)

## Scope

`/fitness/nutrition` (EN + RU), phone first:

- Energy: BMR (Mifflin–St Jeor; Katch–McArdle and their mean when body fat is entered), TDEE from five activity
  levels, target intake from a goal and a pace slider (loss 0.25–1 %/week, gain 0.1–0.5 %/week), weekly change,
  weeks to a target weight (static and with adaptation + diet breaks).
- Protein per day (range + target) and per meal (3/4/5 meals, 0.4 g/kg floor), fat with a floor, carbs as the
  remainder with a goal floor, fibre; creatine, caffeine and water numbers.
- Heart rate: Tanaka HRmax (or a measured one), five Karvonen zones with the zone-2 range (its lower part until a
  talk test sets the ceiling, research 05 Table 3), "which zone is this bpm", Cooper 12-minute and Uth HR-ratio
  VO2max estimates with METs.
- A searchable, sortable protein food table (59 foods incl. Turkish, Japanese and Russian staples), short rules,
  numbered sources.

## Files (owned by this stream)

- `content/fitness/nutrition.json` — goal rules, constants, activity levels, supplements, hydration, heart-rate
  formulas, rules list, food groups, 59 foods, sources. Every number carries `source` ids.
- `src/lib/fitness/nutrition.mjs` — pure engine (JSDoc types, imports the JSON with `with { type: "json" }`).
- `src/components/fitness/nutrition/` — `NutritionCalc.tsx` (calculator), `HeartCard.tsx`, `FoodTable.tsx`,
  `inputs.ts` (per-browser inputs hook), `inputs-core.mjs` (pure: parse edits, profile values, last-writer-wins pick,
  decimal-comma parsing; unit-tested), `ui.tsx` (fields, formatting, source refs).
- `src/views/fitness/NutritionView.tsx` — server view; rules + sources rendered statically.
- `src/app/(en)/fitness/nutrition/page.tsx`, `src/app/ru/fitness/nutrition/page.tsx` — thin routes, `nutritionMeta`.
- `src/styles/fitness/nutrition.css` — all stream CSS (imported by `fitness.css`).
- `tests/fitness/nutrition.test.mjs` — engine, validation, JSON integrity.

## Contract / API (`src/lib/fitness/nutrition.mjs`)

Every function validates and returns `{ error: "<field>" }` on bad input; success is always an object.

| Function | Returns |
| --- | --- |
| `bmrMifflin({kg, cm, age, sex})` | `{ kcal }` — 10·kg + 6.25·cm − 5·age + 5 (male) / −161 (female) |
| `bmrKatch({kg, bodyFatPct})` | `{ kcal, ffmKg }` — 370 + 21.6·FFM |
| `tdee(bmr, activity)` | `{ kcal, factor }` — 1.2 / 1.375 / 1.55 / 1.725 / 1.9 |
| `proteinTarget({kg, bodyFatPct?, goal})` | `{ min, max, target, gPerKg, basis, ffmKg, perMeal(meals) → {min, max, target, floor, short} }` |
| `energyTarget({tdee, goal, kg, ratePctPerWeek?, bmr?})` | `{ kcal, deltaKcal, deltaPctTdee, weeklyChangeKg, weeklyChangePct, ratePctPerWeek, direction, warnings }` |
| `weeksToGoal({kg, targetKg, weeklyChangeKg})` | `{ weeks, dietWeeks, breakWeeks, totalWeeks, direction }` |
| `macroSplit({kcal, proteinG, kg, goal})` | `{ protein, fat, carbs (each {g, kcal, pct}), fatFloorG, carbFloorG, fibreG, fatLowered, warnings }` |
| `nutritionPlan(input)` | all of the above for the UI, plus `supplements` and `hydration` |
| `hrMaxTanaka(age)` | `{ hrMax }` — 208 − 0.7·age |
| `hrZones({age, hrRest, hrMax?})` | `{ hrMax, hrRest, reserve, measured, zones: [{zone, pct:[lo,hi], from, to}] }` |
| `zoneOf(hr, zones)` | `{ zone }` (0 below zone 1, 5 at or above the top) |
| `zone2Range(zones, ceiling?)` | `{ from, to, basis }` — talk-test ceiling − 10 bpm to the ceiling, else 60–65 % HRR (`"start"`) |
| `vo2maxCooper(metres)` | `{ vo2max, mets }` — (d − 504.9) / 44.73 |
| `vo2maxUth(hrMax, hrRest)` | `{ vo2max, mets }` — 15.3 · HRmax / HRrest |
| `ageFromBirthYear(year, nowYear?)`, `matchesFood(food, query)`, `sortFoods(foods, key)` | helpers |
| data | `NUTRITION`, `GOAL_KEYS`, `GOALS`, `ACTIVITY`, `ACTIVITY_KEYS`, `FOODS`, `FOOD_GROUPS`, `SOURCES`, `RULES` |

Goal rules (JSON `goals`, research 06 §3 unless noted):

| Goal | Protein g/kg BW (target) | g/kg FFM when BF known | Energy | Pace %BW/week: slider, default, recommended | Carb floor g/kg |
| --- | --- | --- | --- | --- | --- |
| recomp | 1.6–2.2 (2.2) | 2.5–3.1 (2.8) | loss | 0.25–1.0, 0.5, 0.5–0.75 | 2 |
| strength | 1.6–2.2 (1.8) | 2.0–2.5 (2.2) | gain | 0.1–0.5, 0.1, 0.1–0.15 | 3 |
| hypertrophy | 1.6–2.2 (1.8) | 2.0–2.5 (2.2) | gain | 0.1–0.5, 0.25, 0.1–0.25 | 3 |
| endurance | 1.4–2.0 (1.6) (Jäger 2017) | — | maintain | — | 3 |
| maintenance | 1.8–2.2 (2.0) | 2.3–2.6 (2.4) | maintain | — | 3 |

All goals: fat 0.8 g/kg default, floor max(0.5 g/kg, 20 % kcal), ceiling 40 % kcal, lowered toward 0.6 g/kg when
carbs fall under the floor; FFM-based protein capped at 2.6 g/kg BW; fibre 14 g/1000 kcal (25–50 g); creatine
3–5 g/day (5 g above 90 kg); caffeine 3–6 mg/kg (≤ 400 mg/day); water ≈ 35 ml/kg/day + 0.5–1 L per training hour.
Pace → kcal: loss 7,700 kcal/kg, gain 5,500 kcal/kg (Hall 2008). Warnings (never silent caps): deficit > 500
kcal/day, deficit > 25 % of TDEE, intake below BMR, pace above the goal's recommended band.

## Design decisions

- **The JSON owns the numbers; the engine reads them.** The master plan confirmed `with { type: "json" }` works in
  Node 25, TypeScript and Next (catalog.mjs does the same), so the earlier "engine owns constants, JSON mirrors"
  idea is dropped: one source of truth, tests assert the JSON's integrity.
- **Recomp protein = 1.6–2.2 g/kg with a 2.2 target** (the brief's band, Morton 2018's plateau to upper CI); research
  06 recommends 2.2–2.6 in a cut, which the engine reaches through the FFM basis (2.5–3.1 g/kg FFM, Helms 2014,
  Refalo 2025) as soon as body fat is entered — higher for lean people, capped at 2.6 g/kg BW.
- **Mifflin–St Jeor as published.** With body fat entered, BMR = mean(Mifflin, Katch–McArdle) (research 06 §3.10).
- **Pace slider, not fixed deltas.** The deficit follows from %BW/week; warnings explain the limits instead of
  clamping (a slider that stops responding is worse than one that warns).
- **Weeks to goal** shows the static number and a realistic one (× 1.10 adaptation + one diet-break week per 7 diet
  weeks, research 06 §3.8/3.10; loss only).
- **Inputs:** every field merges the profile and this browser's last edit by time (last writer wins): settings
  (`updatedAt`) and the latest weigh-in (`at`) versus local edits (`localStorage["ilyadays-fitness:nutrition"]`,
  read through `useSyncExternalStore`, in-memory fallback when storage is blocked). Visitors see the owner's public
  numbers (master plan 2026-11-08: settings are world-readable) until they type their own; nothing a visitor types
  leaves their browser.
- **Save to my profile** (only when `canWrite` and a body field was edited and differs) upserts `settings` with
  bodyweightKg, heightCm, birthYear, sex. It does **not** write `goal`: the goal drives the program mode (streams
  03/10 own goal switching and program conversion).
- **Phone first:** results first, inputs after, a sticky bottom summary while the results are off-screen; two-column
  numeric inputs (16 px, `inputMode="decimal"`); food table is a fixed 4-column table that fits 360 px, rows expand
  for full macros; chips scroll inside their strip; all touch targets ≥ 44 px.
- **Heart rate:** Karvonen bands 50/60/70/80/90–100 % HRR; ACSM intensity bands for context; VO2max also as METs
  with Kodama 2009. Zone 2 follows research 05 Table 3: until calibrated, train in its lower part (60–65 % HRR),
  because the first threshold sits anywhere from 60 to 90 % of HRmax between people (Iannetta 2020); a collapsible
  talk-test protocol (stages every 2 min, "can I speak comfortably?", Persinger 2004, Foster 2008) lets the person
  enter their ceiling, and zone 2 becomes ceiling − 10 bpm to the ceiling. The ceiling stays in this browser like
  the other heart-rate inputs (no profile field for it).

## Acceptance checks

- `node --test tests/fitness/nutrition.test.mjs`: Mifflin 80/180/35 male = 1755 (and 1780 at age 30), female case;
  Katch; TDEE; protein recomp 80 kg → 128–176 (target 176) and per meal; FFM basis and cap; energy loss/gain/
  maintain and warnings; weeks to goal incl. the research worked example; macro split incl. fat floor and lowering;
  Cooper 2800 m ≈ 51.3; Tanaka 35 → 183.5; Uth; Karvonen zones; zoneOf; validation errors for every function; JSON
  integrity (≥ 45 foods, bilingual names and serving labels, numeric macros, kcal ≈ 4P + 9F + 4C within 15 %,
  derived per-serving and per-100-kcal values consistent, unique ids, every source id resolves, goal keys = the
  GoalMode union).
- `npx tsc --noEmit` clean; `npx eslint` clean on the stream's files.
- EN and RU routes render the same structure; colours only through tokens (dark mode).

## Status

Done (2026-11-08).

- `content/fitness/nutrition.json`: 5 goal rules, activity levels, daily rules (protein cap, per meal, fat, fibre,
  creatine, caffeine, water), heart-rate block (zones, zone-2 start band and talk-test calibration), 9 rules,
  59 foods, 49 sources. USDA rows were read from the SR Legacy CSV (FDC April 2018 release) by a generator script,
  not typed by hand. That check replaced five ids in the research 06 draft table that pointed at other foods or
  were not SR Legacy ids, with their values: light tuna 175158 (white tuna) → 173709, 90/10 beef 174036 (80/20) →
  174030, sea bass 171962 (raw grouper) → 173694, Greek yogurt 0 % 330137 → 170894, cottage cheese 2 % 328841 →
  172182. Menemen and mercimek are recipe estimates from SR Legacy ingredients (recipes in their `source`). Carbs
  follow the USDA/MEXT convention (fibre included); fibre `null` = not reported (tempeh, soba, seitan).
- `node --test tests/fitness/nutrition.test.mjs`: 49 tests pass. `npx tsc --noEmit` clean; `npx eslint` clean on all
  stream files. Last `npm test`: 390 of 392 pass; both failures are in `tests/fitness/images.test.mjs` (stream 07's
  manifest and image index vs pictures being generated in parallel), not in this stream.
- Reconciled with research 05 (landed during this stream): formulas already matched (its intro says so); added the
  zone-2 start band, the talk-test protocol and ceiling input, and the ACSM "zone 2 starts where vigorous begins"
  remark; the resting-HR hint now asks for an average of a few mornings. Citation numbers now render ascending.
- No dev server or build was run. The view was server-rendered in Node (TypeScript transpile + mocked
  Provider/Shell) in EN/RU × local/viewer × empty/profile without errors, and the rendered HTML with the site CSS was
  screenshotted in headless Chromium at 360 px (light, dark RU) and 1200 px. That pass found and fixed: inputs
  overflowing two-column grids at 360 px, single-class overrides losing to `fitness.css` rules declared after the
  import, a too-narrow zone column, a hole in the desktop grid, and a fat-trim note for a 0.2 g change.
- Not verified here (needs a browser with hydration): sticky-summary toggling, localStorage persistence across
  reloads, Save to my profile against the real store. Stream 12 should cover these in the phone pass.

## Open questions

- Resolved 2026-11-09 (phone review, "400 / mg" at 360 px): `keepUnits` (`src/lib/fitness/i18n.ts`) puts a no-break
  space between number and unit in all nutrition copy, JSX pairs use `{"\u00a0"}`; "100 ккал" fits the table header.
  Round 2: U+2060 after an en dash between digits and after a unit's slash ("0,5–1 л", "0,4 г/кг"), U+00A0 after "≈"
  and "±", no bare "с" (a preposition); copy groups thousands with U+00A0; `test_pages.py` checks the 360 px page.
  Takeover pass: serving measures (`tbsp`, `cup(s)`, «ст. ложки», «чашки», «стаканы») and «тыс.» also stay with
  their number; the two words in «ст. ложки» stay together. Unit/content and phone-browser checks cover them.
- `src/components/fitness/nutrition/inputs-core.mjs` imports the engine by relative path; tests import it directly.
  If a shared lint rule later forbids `.mjs` under `src/components`, move it to `src/lib/fitness/` (needs the master
  plan's ownership table to list it).
- The page shows 49 numbered sources, including two pseudo-sources ("typical labels", "recipe estimate") so every
  food row has a resolvable `ref`. Stream 08 may want to reuse the source entries for the nutrition science page.
- The brief's "Mifflin 80 kg / 180 cm / 35 y male = 1780 kcal" is the age-30 result; the published equation gives
  1755 at 35. The engine follows the publication; the test asserts both ages.
- `energyTarget` needs `kg` to turn %/week into kcal (in the brief's signature) and takes an optional `bmr` for the
  below-BMR warning.
- Research 05 also proposes FRIEND percentiles, Mandsager categories, fitness age and a VO2max tracking plan
  (Ebbeling, Rockport, Concept2 2k). This page shows only the Cooper and Uth estimates with METs; the tracking plan
  belongs with progress analytics (stream 06) or the science pages (08), which can reuse `vo2maxCooper`,
  `vo2maxUth`, `hrZones` and `zone2Range`.
- `content/fitness/nutrition.json` is now the source of truth. The generator that built it from the SR Legacy CSV
  lived in this session's scratchpad; every USDA row's `source` names its SR Legacy id and description, so a row
  can be re-checked by hand, and the tests guard the derived values.
