# Stream 06 — Progress analytics and charts

Status: see the end of this file · 2026-11-08. Owner's lens: quant — every estimate carries its uncertainty and its
caveat. Contract: `00-master-plan.md` §4–§7 (the master plan wins). Evidence: `research/07-analytics-and-models.md`.

## Scope

`/fitness/progress` (EN + RU): weigh-in entry and body-weight trend with a forecast to a target, e1RM trends with
uncertainty, PRs and a plateau flag, weekly hard sets per muscle group (bars + heatmap with the 10–20 sets/week band)
and tonnage, a 12-week adherence calendar with streak, the Banister fitness–fatigue model and an EWMA ACWR with
caveats. Pure maths in `analytics.mjs` (tested); hand-rolled SVG charts reusable by other streams; no new
dependencies, no server code.

## Files (owned by this stream)

```
src/lib/fitness/analytics.mjs                       pure maths (no imports at all: no catalog JSON in client bundles)
src/components/fitness/progress/charts.tsx          LineChart, Bars, Heatmap, Calendar, Sparkline, Legend, ChartTable
src/components/fitness/progress/scales.ts           nice ticks, time ticks, log scale, text width estimate (pure)
src/components/fitness/progress/types.ts            ProgressCatalog / ProgressGroup (what the server view passes)
src/components/fitness/progress/shared.tsx          Section, Empty, Stat, Caveat, useNow, useTargets, formatters
src/components/fitness/progress/useProgressData.ts  memoized derivation from the snapshot (sets, loads, sessions)
src/components/fitness/progress/BodyweightSection.tsx + WeighIn.tsx
src/components/fitness/progress/StrengthSection.tsx
src/components/fitness/progress/VolumeSection.tsx
src/components/fitness/progress/AdherenceSection.tsx
src/components/fitness/progress/ModelSection.tsx
src/components/fitness/progress/ProgressPanel.tsx   "use client" — useFitness() + sections
src/views/fitness/ProgressView.tsx                   server: builds the trimmed catalog, FitnessShell + h1 + FitnessNav
src/app/(en)/fitness/progress/page.tsx, src/app/ru/fitness/progress/page.tsx   thin wrappers, progressMeta
src/styles/fitness/progress.css                      fitp-* (panel) and fitc-* (charts)
tests/fitness/analytics.test.mjs
```

## Contract / API (`analytics.mjs`, JSDoc-typed, `// @ts-check`)

Times are epoch ms / ISO / Date; days are local calendar days; weeks start Monday. Nothing here imports the catalog:
callers pass exercise facts (`{ equipment, assistance, pattern, repUnit, primary, secondary }` or pre-weighted
`groups`).

- `e1rm(kg, reps, rir = null, formula = "blend")` → `{ kg, reliable, reps, sigmaRel, formula }` | null (kg ≤ 0 or
  reps < 1). Effective reps T = reps + RIR; T ≤ 1 → kg; Epley `kg(1 + T/30)`, Brzycki `36kg/(37 − T)`, blend = mean
  (Epley alone from T ≥ 36, as stream 03's `e1rmOf`). `reliable` = T ≤ 12 and RIR ≤ 4 when logged (research 07 E1,
  E3). `sigmaRel` = 3.3 % test–retest ⊕ 0.8-rep RIR error, +2 % above 10 reps, +3 % at RIR ≥ 4 (E4).
- `effectiveLoad(set, exercise, bodyweightKg)` → `{ kg, kind: external|assisted|bodyweight, flag }`. Assisted:
  bodyweight − assistance (≥ 0). Bodyweight: fraction × bodyweight + added kg, fractions in `BODYWEIGHT_FRACTION`
  (pull-up, chin-up, dip 1.0 by the stream-03 convention; push-ups 0.64, Ebben et al. 2011); unknown fraction or no
  bodyweight → kg 0 with `flag` (`unknown-fraction` | `no-bodyweight`); such sets get no e1RM.
- `bodyweightLookup(entries, fallbackKg)` → `(t) => kg | null` (latest weigh-in on/before t, else first after).
- `sessionBestE1rm(sets, { loadOf, timeOf, unitOf, aggregate: "best"|"mean" })` → one row per (session, exercise):
  best reliable set (falls back to best unreliable, flagged); `"mean"` = precision-weighted mean (E6).
  `e1rmSeries(sets, exerciseId, opts)` = the same for one exercise, sorted by time.
- `hardSets(sets, { rirMax = 4 })` (working/backoff/amrap, reps ≥ 1, RIR ≤ 4 or unknown), `tonnage(sets, { loadOf,
  unitOf })` (Σ kg·reps, rep-unit sets only, warm-ups excluded), `dailyLoads`, `weeklyTonnage`.
- `weeklyVolumeByGroup(sets, lookup, groupOf, { weeks = 8, now, timeOf, order })` → `{ weeks, groups, sets, direct,
  primary, hard }`. One hard set counts **1 for each distinct primary (direct) group and 0.5 for each secondary group
  that is not also primary** — the fractional count that best predicted outcomes in Pelland et al. 2025 [14]
  (`sets`). `direct` = the weight-1 part; `primary` splits each set evenly over its primary groups so a week's
  stack sums to the real number of hard sets (`hard`). Unknown exercises count under `"other"`.
- `ewma(points, alpha = 0.1)` → `[{ at, value, trend }]`; gap-aware α_eff = 1 − (1 − α)^Δdays (Hacker's Diet,
  time constant ≈ 9 days whatever the weigh-in frequency). `dailyMean(points)` first.
- `weeklyRate(trend, { days = 28, minDays = 14, confidence = 0.95 })` → `{ kgPerWeek, band, pctPerWeek, pctBand, n,
  spanDays, sigma, rho, confidence, reliable }` | null (< 3 points). Theil–Sen slope on the raw weigh-ins of the window; band = slope ±
  t(n−2)·σ_res/√Sxx, inflated by √((1+ρ)/(1−ρ)) for lag-1 autocorrelated residuals (water retention spells).
- `theilSen(points, { confidence = 0.95 })` → `{ slope, intercept, slopeCI | null, coverage, method, n, pairs }` | null.
  Median pairwise slope; intercept = median(y − slope·x). CI (Sen 1968): ranks of the sorted pairwise slopes from
  the **exact** null distribution of Kendall's S (Mahonian numbers) for n ≤ 40, normal approximation with tie
  correction above; `coverage` is the exact coverage; null when unbounded (n < 5 at 95 %).
- `forecast(points, horizonDays, { confidence = 0.9, windowDays = ∞ })` → `{ line, band, fitted, slope, slopeCI, … }` |
  null (< 4 points). Theil–Sen line through the last `windowDays`; cone from the last observation: slope CI × horizon ± t·SE(level); horizon capped at 2 × span and
  182 days (research 07 H). `timeToTarget(fc, target)` → `{ status, days, earliestDays, latestDays }`.
- `e1rmTrend(series, { minPoints = 5, minDays = 21, ciPoints = 8 })` → Theil–Sen on ln e1RM: %/week, CI (≥ 8
  points), line and a ±1.96σ noise band (σ = max(4 %, residual RMS)); `{ status: "collecting" }` below the minimums.
- `banister(dailyLoads, { k1 = 1, k2 = 2, tau1 = 42, tau2 = 7, p0 = 0, until })` → daily `{ fitness, fatigue,
  performance }` with P_t = p₀ + k₁F_{t−1} − k₂G_{t−1}; `banisterTiming(params)` → t_n 5.8 d, t_g 20.9 d.
- `acwrEwma(dailyLoads, { acute = 7, chronic = 28, uncoupled = true, warmup = 50 })` → daily `{ acute, chronic,
  ratio, zone }`, λ = 2/(N+1), chronic on loads lagged by the acute window, ratio hidden for 50 days.
- `prs(sets, opts)` → PR events (`e1rm` | `load` | `reps` at the same load); the first session only sets baselines.
  `bestRecords(sets, opts)` → current bests per exercise.
- `plateau(series, { sessions = 4, minGain = 0.025, pProgress = 0.35 })` → `{ flag, since, best, falseAlarm }`:
  sessions since the last confirmed best (≥ +2.5 % or two sessions above), `falseAlarm` = 0.65^since = the chance
  of such a dry spell while still progressing (research 07 G).
- `adherence(sessions, { weeks = 12, daysPerWeek = 3, now })` → weeks with days, planned/done/met, streak (back from
  the last complete week; the current week extends it once met), rate over completed weeks since the first session.
- Date helpers: `toMs`, `dayKey`, `dayStart`, `startOfWeek`, `addDays`, `daysBetween`.

Not implemented (research 07 build order steps 5–8, later): CUSUM, Kalman local-linear trend, Banister grid fit,
BOCPD, James–Stein shrinkage, per-machine calibration factor (needs heavy triples the owner does not do).

## Design decisions

- **No catalog in the client bundle.** `ProgressView` (server) builds a trimmed catalog (name, group weights from
  stream 03's `groupWeights` — catalog muscles, else the pattern map, so volume works before `exercises.json` is
  merged —, unit, equipment, assistance) and passes it as a prop (~20 KB). `analytics.mjs` imports nothing.
- **Measured-width SVG.** `viewBox="0 0 W H"` with W = the container's measured width (ResizeObserver, 340 before
  hydration). 1 unit = 1 px, so text stays 11 px and tick density is computed in pixels (≥ 64 px per time label,
  ≥ 30 px per y label). No label collisions at 360 px; end labels that would collide fall back to the legend.
- **Colour by role (validator run on the site tokens, light #fff and dark #24211d surfaces).** `--accent` = you,
  `--cool` = model/forecast, `--muted` = history/reference, `--ok` = target met, `--line` = grid. accent↔cool, the
  only chromatic identity pair, passes CVD (ΔE 17.5 light / 18.7 dark) and the normal-vision floor (23.9 / 22.3).
  muted is a grey (de-emphasis, not a categorical slot); ok is a status colour and always comes with a ✓ or a ring.
  The site tokens miss the validator's chroma floor (cool C 0.074) and dark lightness band; we keep the site's
  tokens (task rule) and compensate: every chart with ≥ 2 series has a legend, series differ in mark as well as hue
  (dots / solid / dashed projection / dotted / band), unreliable points are hollow, and every chart has a table view.
- **Forms.** Weight: muted dots + accent EWMA + cool dashed forecast cone + target line. Strength: accent points +
  cool Theil–Sen line + noise band; log axis when max/min > 1.5. Volume: heatmap (sequential accent opacity, number
  in cell, ok inset ring when inside 10–20) + bars (All = hard sets per week; one group = stacked direct + indirect
  with the 10–20 band). Adherence: 12 × 7 calendar (filled = trained), done/planned under each week, ✓ when met.
  Model: Banister index lines (performance cool, fitness/fatigue muted solid/dotted) + session ticks; ACWR line with
  the 0.8–1.3 band.
- **Honest empty states.** Each section says what is missing and when its chart appears: trend ≥ 5 sessions over
  3 weeks, CI ≥ 8, forecast ≥ 4 weigh-ins, ACWR after 50 days, Banister labelled "textbook constants, not fitted".
- **Hover + keyboard + table.** Line charts: crosshair snapping to the nearest x, ←/→ keys, live region; bars/cells:
  per-mark tooltip; every chart has a `<details>` table twin.
- **Writes.** Weigh-ins only when `canWrite`; one per local date (saving again replaces that day); delete with a
  second tap. Targets are per-viewer conveniences in `localStorage["ilyadays-fitness:targets"]` (try/catch).
- **Pace verdict as firm as its band.** The weekly-rate sentence says "inside / faster / slower" only when the whole
  95 % band agrees; when only the point estimate does it says "most likely" and names the side the band still
  reaches (0.5–1 % a week, Helms 2014; Garthe 2011). The body-weight chart draws the 28-day Theil–Sen fit as a thin
  cool segment, so the forecast visibly starts from the fit and not from the EWMA (which lags ≈ 9 days).
- **Layout rules found in the visual pass (360/430/1100 px, light/dark, EN/RU, empty).** Axis labels are placed by
  `thinLabels` (greedy from the right, clamped inside the plot, never overlapping — checked automatically on every
  SVG); history dots are drawn under the lines, dots keep a surface halo via `paint-order`; heatmap cells show whole
  numbers (tooltip/table keep one decimal); the tooltip measures itself and stays inside the plot; the current
  week's volume is labelled "so far" and the sparklines show completed weeks only; group chips scroll in one row
  below 700 px; numbers use a true minus and never "−0"; no line break inside "95 %", "≤ 12", "0.5–1" or before an
  em dash. Overrides of shared classes are chained (`.fit-button.fitp-step`): fitness.css imports stream files
  before its own rules, so a single-class override loses.
- **No impure calls in render.** `useNow()` (useSyncExternalStore, minute resolution, null on the server) feeds
  every time-dependent computation (React Compiler lint `react-hooks/purity`).

## Acceptance checks

- `node --test tests/fitness/analytics.test.mjs` passes (e1RM 100×10 → 133.3 both formulas; RIR adds reps; EWMA;
  Theil–Sen with outliers + exact CI; Banister zero-crossing 5.8 d and peak 20.9 d; forecast band ordering;
  adherence weeks + streak; assisted effective load; volume fractional counting; PRs; plateau).
- `npx tsc --noEmit` clean for this stream's files; `npx eslint` clean on them.
- `/fitness/progress` and `/ru/fitness/progress` render with EMPTY_SNAPSHOT (empty states, no crash) and with data;
  nothing overflows at 360 px; dark mode via tokens; touch targets ≥ 44 px.

## Status

Done (2026-11-08). `analytics.mjs` + 34 tests (pass in UTC, New York, Los Angeles, Istanbul, Moscow, Kolkata,
Auckland); charts, five sections, weigh-in entry, EN/RU routes and `progress.css`. `npx tsc --noEmit` and `eslint` on
this stream's files clean. Not run: `next build` / `next dev` (task rule). Rendered through a throwaway harness (the
real components, a mock 10-week snapshot and the real stylesheets) at 360/430/1100 px, light/dark, EN/RU and empty:
no console errors, no horizontal overflow, no tap target under 44 px, no overlapping SVG text. Already consumed by
other streams: `tracker.mjs` (adherence, bodyweightLookup, dailyMean, effectiveLoad, ewma, prs) and the tools test
(`e1rm`) — keep those signatures stable. The route is already in the master-owned nav (Shell), `progressMeta`,
the sitemap and the offline catalog; nothing shared was edited.

## Open questions

- `src/lib/fitness/index.ts` does not exist; consumers import `analytics.mjs` directly (task rule).
- Bodyweight fractions beyond pull-up/chin-up/dip/push-ups are unknown → those sets get no e1RM (flagged). If stream
  02 adds a `bodyweightFraction` field to `Exercise`, `effectiveLoad` should read it first.
- Settings have no history of `daysPerWeek`; adherence uses the current value for all 12 weeks.
- The Banister/ACWR input is daily tonnage (task text). Tonnage favours light high-rep work and ignores holds; a
  session-RPE × duration load would be a better input once sessions record RPE (master-plan field?).
- `TARGET_SETS_PER_WEEK` (10–20) is applied to every group; a per-group target (e.g. lower for forearms or lower
  back) would need a contract field.
