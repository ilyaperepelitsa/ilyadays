# 07 — Quantitative analytics and models for the training log

Research date: 2026-11-08 · Consumers: the owner (quant, trains alone, machines, 3 days/week) and the stream 06
implementers (`src/lib/fitness/analytics.mjs`, progress views). Scope: estimated 1RM, effort-adjusted e1RM, volume
and intensity metrics, Banister fitness–fatigue, ACWR, body-weight trend, robust trend estimation, plateau detection,
forecasting, readiness, strength normalization, small-n visualization, and a light ML layer. Everything below is
either taken from a cited source or derived from one by elementary algebra; where evidence is weak or contested the
text says so and gives the practical default.

## Summary

1. **e1RM**: use `total reps = reps + RIR`, cap at 10 (hard limit 12), and default to the mean of Epley and Brzycki
   (they coincide at 10 reps and bracket the other classic equations between 3 and 10 reps). Five-rep sets predict
   best; linear equations lose validity beyond 10 reps [2]. Treat e1RM as a noisy measurement with σ ≈ 4 % of the
   value (1RM test–retest CV ≈ 3.3 % [4] plus RIR error ≈ 0.7 rep [10]).
2. **Machines are their own instruments**: reps-at-%1RM depend on the exercise and muscle mass involved [2][5][8],
   so keep one e1RM series per exercise *and per machine*, learn a per-exercise calibration factor from heavy
   sets, and never compare machine loads across gyms or to barbell standards.
3. **Volume**: count weekly *fractional hard sets* per muscle (direct = 1, indirect = 0.5, only sets with RIR ≤ 4)
   — the quantification that best predicted outcomes in the 2025 meta-regression [14]. Strength has a steep
   diminishing-returns curve (≈ +0.21 % 1RM per weekly set at the mean, detectable increments up to ≈ 4 sets per
   exercise per week); hypertrophy keeps growing slowly (≈ +0.24 % per set) [14].
4. **Banister**: with ~2 performance observations per week the four-parameter model is not identifiable [21][27].
   Fix τ₁/τ₂ on a small grid (τ₁ ∈ {30, 42, 50} d, τ₂ ∈ {5, 7, 10, 15} d), fit only p₀, k₁, k₂ by linear least
   squares, require ≥ 12 observations over ≥ 8 weeks, and otherwise show the parameter-free CTL/ATL/TSB analogue
   (42 d / 7 d) [28].
5. **ACWR**: compute it, but as a *descriptive load-ramp indicator* only — EWMA (λ = 2/(N+1): 0.25 acute,
   0.069 chronic) [31], uncoupled (chronic excludes the acute window) [33][34], shown after a 50-day warm-up [33].
   Causal evidence for injury prediction is absent [36]; the 0.8–1.3 "sweet spot" and ≥ 1.5 "danger" bands are
   heuristics [37].
6. **Body weight**: EWMA with α = 0.10 (lag ≈ 9 days) for the displayed trend [38]; the *rate* comes from a
   Theil–Sen/OLS slope on the last 14–28 days of raw weights with a CI (14 days of daily weigh-ins ⇒ ± 0.36 kg/week
   at 95 %; 28 days ⇒ ± 0.13 kg/week, given day-to-day noise ≈ 0.5 % of body mass [40]). Target 0.5–1.0 %/week
   loss [49][50]. Use 7,700 kcal/kg only as a short-window approximation; the 3,500 kcal/lb rule is wrong over
   months [39].
7. **Trend of e1RM**: Theil–Sen slope on log(e1RM) (percent per week), with the rank-based CI [45][46]; needs ≥ 8
   points over ≥ 4 weeks for a CI, ≥ 5 points for a line.
8. **Plateau**: three detectors in increasing sophistication — "no confirmed PR (≥ +2.5 %) in N sessions"
   (N = 6 novice, 10 intermediate), tabular CUSUM on standardized residuals (k = 0.5, h ≈ 4.2) [42], and Bayesian
   online changepoint detection with hazard 1/40 sessions [43][44]. Keep the Starting-Strength "3 misses → −10 %"
   rule as the hard stop for linear progression [62].
9. **Readiness**: subjective items (sleep, soreness, stress, mood) are more responsive than objective markers [55];
   acute sleep loss costs ≈ 2.9 % of maximal strength but ≈ 9.9 % of strength-endurance [51][52]; HRV is optional and
   only meaningful as a 7-day lnRMSSD average with ≥ 3 readings/week and an individual SWC of 0.5–1 × CV [53][54].
10. **Build order (TypeScript, no dependencies)**: e1RM + calibration → volume metrics → EWMA weight + slope CI →
    Theil–Sen e1RM trend → no-PR/CUSUM plateau flags → Kalman local-linear-trend (weight, then log e1RM) → Banister
    with fixed τ grid → BOCPD and empirical-Bayes shrinkage of per-exercise progression rates (James–Stein) [47].

## Publishable section

### Reading a small, noisy training log like a quant

A training log is a short, irregular, heteroscedastic time series. A three-day-per-week lifter produces two to three
observations per exercise per week, each of them an *estimate* of strength rather than a measurement of it, and
each contaminated by sleep, hydration, machine setup and the lifter's judgement of effort. The analytics on this site
are built on one principle: show the raw points, estimate the trend robustly, state the uncertainty, and only then
make a decision.

**Estimating maximal strength without testing it.** Nobody should max out on a machine chest press every week. The
one-repetition maximum (1RM) is instead *estimated* from a set taken near failure. The classic equations convert the
weight `w` and the repetitions `r` into an estimate: Epley `w·(1 + r/30)`, Brzycki `w·36/(37 − r)`, Lander
`100·w/(101.3 − 2.67123·r)`, Lombardi `w·r^0.10`, Mayhew `100·w/(52.2 + 41.9·e^(−0.055·r))`, O'Conner
`w·(1 + 0.025·r)` and Wathan `100·w/(48.8 + 53.8·e^(−0.075·r))` [1]. Between three and ten repetitions they agree
to within a few percent; beyond ten they diverge, and the exponential ones (Mayhew, Wathan) are not anchored at one
rep [1]. Reynolds and colleagues tested 1, 5, 10 and 20RM on a chest press and a plate-loaded leg press in 70 adults:
the 5RM gave the most accurate prediction (R² = 0.993 chest, 0.974 leg press), accuracy fell at 10 and 20 reps, and
the authors concluded that no more than ten repetitions should be used in linear equations [2]. Their leg-press
standard error (16 kg) was five times the chest-press error (3 kg), a first hint that the rep–load curve is
exercise-specific [2]. A 2024 study of 119 young adults before and after 16 weeks of training found Lombardi's
equation least biased for men's bench press and squat (bias 0.4 and −0.7 kg) while Brzycki and Lander were off by
about 14 kg on the squat, with limits of agreement spanning ± 25 kg [3]. Shimano's group showed why: at 60 % of 1RM
the back squat allows far more repetitions than the bench press or arm curl, because repetition capacity scales
with the muscle mass involved [5]. The practical consequence for a machine-based program is blunt. Every exercise, and
indeed every machine, is its own instrument: compare an e1RM only with earlier e1RMs on the same machine, and learn a
small calibration factor per exercise from occasional heavy triples. Equations fitted to barbell lifts are a
starting point, not a truth. A 2026 analysis of 303,494 logged sets across 388 exercises found that the
reps-to-1RM conversion factor itself varies with the load, and that classical equations underestimate this variation,
most strongly for lighter, "assistance"-type exercises [6]; the paper is validated only on internal consistency, so it
is a candidate for later evaluation rather than a default.

How noisy is an e1RM? A systematic review of 32 studies found the 1RM test itself has a median test–retest
coefficient of variation of 3.3 % (median ICC 0.97) [4]. Add the effort judgement: trained lifters predict their
repetitions in reserve (RIR) to within about 0.65 reps on the bench press, more accurately at 1 RIR (0.39) than at
3 RIR (0.93) [10]; errors exceed one repetition when a set stops more than three reps short of failure, and novices
under-predict by four to five reps versus one to two for experienced lifters [8][11]. Since each repetition moves an
Epley estimate by `w/30` (≈ 2.9 % of the estimate at five reps), an RIR error of 0.8 rep adds about 2.3 % noise.
Combined, a single-set e1RM carries a standard deviation of roughly 4 % — the number every chart on this site uses as
its noise band. The RIR adjustment itself is simple and principled: a set of `r` reps with `RIR` left is treated as a
set of `r + RIR` reps to failure, which is exactly how the RIR-based RPE table is constructed [7][12], and it should
only be trusted when `RIR ≤ 3` and `r + RIR ≤ 10` [8][10].

**Dose: what to count.** Tonnage (`Σ sets × reps × load`) is intuitive but rewards light high-rep work and cannot be
compared across exercises. Relative volume (`Σ reps × load/e1RM`) fixes the second problem [8]. For weekly planning
the better unit is the *hard set per muscle group*. The largest dose–response meta-regression to date (67 studies,
2,058 participants) found that counting indirect sets as half a set — a biceps curl counts 1 for biceps, a row
counts 0.5 — predicted outcomes better than counting them as 1 or 0, and that the two outcomes behave differently:
hypertrophy rises about 0.24 % per additional weekly set (95 % CrI 0.15–0.33) along a square-root curve, whereas
strength rises about 0.21 % per set (0.16–0.26) along a reciprocal curve with a functional plateau — one set is
already an effective dose and detectable increments stop around four fractional sets per exercise per week [14].
Earlier work agrees in direction: +0.37 % muscle gain per weekly set [15]; four sets per muscle group, at roughly 80 %
of 1RM twice a week, maximized strength gains in trained people in the older meta-analyses [16][17]. Frequency helped
strength with diminishing returns but had no clear independent effect on hypertrophy [14]. For a strength-leaning
lifter this means: keep hard sets per exercise modest, spread them across sessions, and spend extra sets on the
muscles with a size goal (pecs). Intensity is tracked two ways — load as a percentage of the current e1RM, and
Hristov's INOL, `reps/(100 − %1RM)` per set, which weights heavy reps more than light ones; Hristov's guidance is
0.4–1.0 INOL per exercise per workout for a sustainable session, 1–2 for a hard loading block, and under 2 per
exercise per week for an easy week [13]. Session RPE × minutes gives a one-number internal load [20]; Foster's
*monotony* (mean/SD of daily load over a week) and *strain* (weekly load × monotony) flag weeks that are both heavy
and unvarying, which in his athletes preceded illness [19].

**Fitness and fatigue as two decaying integrals.** The Banister impulse–response model says that each day's training
impulse `w(t)` leaves a fitness trace that decays with time constant τ₁ and a fatigue trace that decays faster with
τ₂; performance is `p₀ + k₁·Σ w(i)e^(−(t−i)/τ₁) − k₂·Σ w(i)e^(−(t−i)/τ₂)` [25][26]. The original constants were
k₁ = 1, k₂ ≈ 1.8–2.0, τ₁ ≈ 49–50 days, τ₂ ≈ 11 days [30]; fitted values vary enormously — τ₁ = 38 and τ₂ = 1.9 days in
cyclists [26], τ₁ = 38 (95 % CI 17–59) and τ₂ = 19 (6–32) days in elite swimmers [21]. That swimming study is the
cautionary tale: the model fit well (r² = 0.79) yet the parameters were so correlated that their interpretation was
"meaningless" [21], and practitioners who fit it to real data see time constants collapse onto each other or onto
implausible values [27]. Fatigue is not even constant: when untrained men went from three to five sessions a week,
recovery time per session rose from 0.9 to 3.6 days and the gain per unit load fell [22], which motivated Busso's
variable-dose model [23]. The model does deliver two useful closed-form quantities: the time after a training impulse
at which its net effect turns positive, `t_n = τ₁τ₂/(τ₁ − τ₂)·ln(k₂/k₁)`, and the time of maximal benefit,
`t_g = τ₁τ₂/(τ₁ − τ₂)·ln(k₂τ₁/(k₁τ₂))` [24]; with 42/7 days and k₂/k₁ = 2 these are 5.8 and 20.9 days, which is the
quantitative reason a deload week is scheduled one to three weeks before a test. Our implementation therefore fixes
the time constants on a grid, fits only the three linear parameters, insists on at least a dozen e1RM observations
over two months, and falls back to the parameter-free CTL/ATL/TSB display (42-day and 7-day exponentially weighted
loads) that TrainingPeaks adopted precisely because the gain factors are so unstable [28]. A Kalman-filter
reformulation, which updates fitness and fatigue every time a new performance arrives, is the natural upgrade [29].

**Load ramps and the acute:chronic ratio.** The ACWR divides the last week's load by the last month's. The EWMA
version replaces the averages with exponentially weighted ones, λ = 2/(N+1), i.e. 0.25 for the 7-day and 0.069 for
the 28-day window [31][33], and was more sensitive to injury risk than rolling averages in Australian footballers
(R² 0.21 → 0.87) [32][33]. Three critiques matter for us. The conventional ratio is *mathematically coupled* — the
acute week sits inside the chronic month — which manufactures correlation [34]; the EWMA remains coupled and needs
about 50 days to forget its initial value [33]; and, most fundamentally, no study has established a causal effect of
manipulating the ratio on injuries, so the metric "adds noise and creates statistical artifacts" when used
prescriptively [36]. We therefore show an *uncoupled EWMA ratio* purely as a description of how fast the owner is
ramping load, with the familiar 0.8–1.3 and ≥ 1.5 bands labelled as heuristics [37][33], alongside the older rule
of not increasing weekly load by more than 10–20 % [33].

**Body weight: a signal buried in water.** Day-to-day body mass fluctuates with a standard deviation of about 0.5 %
of body mass (≈ 0.4 kg at 80 kg), most of it genuine fluid shifts rather than scale error (≈ 0.1 kg) [40]. The
Hacker's Diet trend, `T_n = T_{n−1} + 0.1·(W_n − T_{n−1})`, is an exponentially weighted moving average with α = 0.1
[38]; its mean age is (1 − α)/α = 9 days, equivalent to a 19-day simple moving average, and its standard error is
`σ·√(α/(2 − α))` ≈ 0.23σ ≈ 0.09 kg [41]. The trend is therefore smooth but late. The *rate* should not be read off
the trend's last two points; it should be a regression slope on raw weights with a confidence interval. With daily
weigh-ins and σ = 0.4 kg, 14 days give a 95 % interval of ± 0.36 kg/week and 28 days give ± 0.13 kg/week — so a
two-week dip is not evidence of anything, and four weeks are needed before adjusting intake. A Kalman local-linear-
trend filter does the same job with proper handling of missed days (process noise scales with the gap) and yields a
forecast band; its process-noise parameter cannot be identified from a month of data and should be fixed as a prior
[48]. For fat loss while keeping muscle, the recommended pace is 0.5–1.0 % of body mass per week [49]; athletes
losing 0.7 %/week gained lean mass while those losing 1.4 % did not [50]. Energy accounting from the trend is
approximate at best: 7,700 kcal/kg (3,500 kcal/lb) [38] holds only over short windows, and the dynamic model shows
that a permanent 10 kcal/day change moves steady-state weight by about one pound, half of it within a year [39].

**Trends, plateaus and forecasts.** Ordinary least squares is dragged by one bad session. The Theil–Sen estimator —
the median of all pairwise slopes — tolerates up to 29 % outliers and comes with a distribution-free confidence
interval built from ranks of the pairwise slopes (`Var(S) = n(n − 1)(2n + 5)/18`) [45][46]. Fitting it to log(e1RM)
gives a progression rate in percent per week that is comparable across exercises. A plateau is then a statistical
question: has the rate fallen to zero? The simplest detector counts sessions since the last *confirmed* personal
record, where "confirmed" means at least 2.5 % above the previous best so that noise alone rarely triggers it; if the
probability of a PR per session is 0.35 while progressing, six PR-less sessions happen by chance only 7.5 % of the
time, and ten sessions are needed at p = 0.2. Page's CUSUM accumulates standardized residuals from the expected
trend and alarms when the sum exceeds h ≈ 4–5σ with reference value k = 0.5σ, a design that detects one-sigma
shifts quickly while keeping false alarms rare [42]. Bayesian online changepoint detection goes further: it keeps a
probability distribution over the "run length" since the last regime change, with a constant hazard such as 1/40
sessions, and naturally reports *how sure* it is that the trend has broken [43][44]. Forecasting time-to-goal divides
the remaining gap by the slope, but the honest answer is an interval — the slope's confidence limits map to an
earliest and a latest date, and if the lower limit of the slope touches zero the latest date is "not estimable".
Strength gains also decelerate, so linear extrapolation is capped at twice the length of the data window.

**Readiness, with and without gadgets.** A systematic review of 56 studies found that subjective wellness ratings
(fatigue, stress, mood, sleep quality) tracked training load more sensitively and consistently than heart-rate,
hormonal or blood markers [55]. Acute sleep loss reduces performance by about 7.6 % overall, but only 2.9 % for
maximal strength versus 9.9 % for strength-endurance, and the deficit is larger in the evening and after late-night
restriction [51][52] — so a bad night changes rep targets more than load targets, and is a reason to train anyway.
If the owner wears a device, the useful index is morning lnRMSSD averaged over the week; at least three readings a
week are required [54], the individual coefficient of variation is typically 10–20 %, the smallest worthwhile change
is 0.5–1 × that CV, and a falling lnRMSSD must be read together with resting heart rate [53].

**How strong is strong?** Bodyweight-normalized standards exist only for barbell lifts. The Wilks (2020 revision),
DOTS, IPF GL and Sinclair formulas scale a total by a polynomial or exponential function of body mass and are valid
within stated body-mass ranges [59][60][61]. Community percentile tables for machine movements exist — for men the
lat pulldown, machine chest press and seated row all put the 50th percentile near 1.0 × body weight and the 95th near
1.75–2.0 × [56][57][58] — but those loads come from thousands of different machines, so they are at best a rough
orientation. On this site the primary normalization is *the owner's own history*: percent of the first-month
baseline, z-scores against the personal noise, and a goal expressed as a bodyweight ratio on a named machine.

**Drawing it.** Every strength chart shows the qualifying sets as points, a Theil–Sen line, a ± 1.96σ band, PR markers
and the number of points used; load axes are logarithmic when the range exceeds 1.5×, because progress is
multiplicative. No curve is fitted to fewer than five points and no forecast to fewer than ten. Weekly aggregation
(best e1RM per week) is for the eye; sessions are for the math. Body-weight charts show light daily points, a bold
trend and the weekly rate with its interval. When the data are too thin, the page says so instead of drawing a line.

**Borrowing strength across exercises.** With eight exercises and a dozen sessions each, individual slopes are noisy.
Empirical-Bayes shrinkage pulls each exercise's percent-per-week rate toward the lifter's overall rate in proportion
to its uncertainty — the James–Stein idea, which lowers total squared error whenever three or more rates are estimated
at once [47]. The same machinery as a per-exercise state-space model (level and slope of log e1RM, measurement noise
4 %) is the recommended "light ML" layer: it is a dozen lines of TypeScript, needs no library, and produces exactly
the trend, band and forecast the charts require.

## Decision rules / parameters

### A. Estimated 1RM

Formulas (`w` = load, `r` = reps to failure; use `T = r + RIR` as `r`). Values of e1RM/w for w = 100 [1]:

| Equation | Formula | r=1 | r=3 | r=5 | r=8 | r=10 | r=12 |
|---|---|---|---|---|---|---|---|
| Epley | `w·(1 + r/30)` | 1.033 | 1.100 | 1.167 | 1.267 | 1.333 | 1.400 |
| Brzycki | `w·36/(37 − r)` | 1.000 | 1.059 | 1.125 | 1.241 | 1.333 | 1.440 |
| Lander | `100·w/(101.3 − 2.67123·r)` | 1.014 | 1.072 | 1.137 | 1.251 | 1.341 | 1.444 |
| Lombardi | `w·r^0.10` | 1.000 | 1.116 | 1.175 | 1.231 | 1.259 | 1.282 |
| Mayhew | `100·w/(52.2 + 41.9·e^(−0.055r))` | 1.089 | 1.140 | 1.190 | 1.263 | 1.309 | 1.354 |
| O'Conner | `w·(1 + 0.025·r)` | 1.025 | 1.075 | 1.125 | 1.200 | 1.250 | 1.300 |
| Wathan | `100·w/(48.8 + 53.8·e^(−0.075r))` | 1.013 | 1.090 | 1.166 | 1.277 | 1.348 | 1.415 |
| RTS chart (1/%1RM) [12] | table by `T` | 1.000 | 1.085 | 1.159 | 1.272 | 1.353 | 1.437 |
| Marzagao 2026 (w in kg) [6] | `w·(1 + (r−1)^0.85/(−2.55 + 4.58·ln w))` | 1.000 | 1.136 | 1.175 | 1.238 | 1.278 | 1.316 |

Rules:

| ID | Rule | Basis |
|---|---|---|
| E1 | `T = reps + RIR`; if `T == 1` → e1RM = w. Reject sets with `T > 12`; down-weight `10 < T ≤ 12` (σ += 2 %). | [2][8][12] |
| E2 | Default formula = mean(Epley, Brzycki) for `2 ≤ T ≤ 10`; always `max(e1RM, w)`. | [1][2] |
| E3 | Accept RIR-based e1RM only if `RIR ≤ 3` (σ += 3 % if RIR = 4; reject RIR ≥ 5). | [8][10][11] |
| E4 | Measurement σ_rel = √(0.033² + (0.8·w/30 / e1RM)²) ≈ 4 % for free weights; add 1 % for selectorized machines (stack granularity, seat setup). | [4][10] |
| E5 | Per-exercise calibration `c = median(e1RM_heavy / e1RM_rep)` from pairs within 14 days where the heavy set has `T ≤ 3`; clamp to [0.90, 1.10]; apply `e1RM_adj = c · e1RM_rep`. Reset `c` when the machine or gym changes. | [2][3][5] |
| E6 | Session e1RM = precision-weighted mean of qualifying sets (`1/σ²` weights); display the best set as "PR candidate". | derived |
| E7 | Machine series are keyed by `(exerciseId, gymId, machineId)`; cross-machine comparison is shown only as % of each series' own baseline. | [2][5][8] |
| E8 | Load progression (ACSM): when the target reps are exceeded by 1–2 in the last set for two consecutive sessions, raise load 2–10 % (2.5–5 % on machines with 2.5 kg plates). | [18] |

RTS %1RM by total reps `T` (RPE 10 row; RPE x at r reps = row `T = r + (10 − x)`) [12]:
`T: 1→100, 2→95.5, 3→92.2, 4→89.2, 5→86.3, 6→83.7, 7→81.1, 8→78.6, 9→76.2, 10→73.9, 11→71.7, 12→69.6 %`.
Caveat: table derived from barbell squat data with SD ≈ 1.2 RIR at 8 reps @ 70 % — a conceptual guide, not a
conversion tool, and likely shifted for machines and single-joint work [8].

### B. Volume, intensity, internal load

| Metric | Formula | Default thresholds |
|---|---|---|
| Tonnage (volume load) | `Σ reps × load` per exercise/muscle/week | display only |
| Relative volume | `Σ reps × load / e1RM_current` | display only [8] |
| Fractional hard sets | `Σ sets × (direct ? 1 : 0.5)` over sets with `RIR ≤ 4`; per muscle, per ISO week | strength: 4–10 fractional sets per *exercise*-week saturates; hypertrophy focus (pecs): 10–20 per muscle-week [14][15] |
| Per-set marginal effect | hypertrophy ≈ +0.24 %/set (CrI 0.15–0.33), strength ≈ +0.21 %/set (0.16–0.26) at the mean dose; MED = 1 set | [14] |
| Frequency | strength ↑ with sessions/week (diminishing); hypertrophy slope 0.32 %/session (CrI −0.14–0.82) ≈ null | [14] |
| Relative intensity | `load / e1RM_current` and RPE-implied `%1RM(T)` | strength work 75–90 %, hypertrophy 65–80 % [16][17] |
| INOL | `Σ reps / (100 − %1RM)`; clamp %1RM ≤ 95 | per exercise-workout: <0.4 low, 0.4–1.0 sustainable, 1–2 loading, >2 brutal; per exercise-week: <2 easy, 2–3 tough, 3–4 brutal, >4 avoid [13] |
| Prilepin optimum | <70 %: 18–30 reps (24 opt.), 70–79 %: 12–24 (18), 80–89 %: 10–20 (15), ≥90 %: 4–10 (7) | [13] |
| sRPE load | `RPE(CR-10) × minutes` | ICC 0.88 in resistance training [20] |
| Monotony / strain | `mean(daily load, 7 d)/SD`; `strain = Σ weekly load × monotony` | flag monotony > 2.0 and strain in the personal top decile [19] |

### C. Banister fitness–fatigue

| Item | Specification |
|---|---|
| Recursion (daily) | `F_t = F_{t−1}·e^(−1/τ₁) + w_t`; `G_t = G_{t−1}·e^(−1/τ₂) + w_t`; `P_t = p₀ + k₁·F_{t−1} − k₂·G_{t−1}` (loads of day t affect later days) [25][26][30] |
| Input `w_t` | per muscle group or whole-body: daily fractional-hard-set count × mean relative intensity, or daily INOL sum, or sRPE; must be the same unit throughout [30] |
| Performance observation | session e1RM of a key exercise as % of its first-4-week baseline (or precision-weighted composite of several) |
| Reference parameter sets | original: k₁=1, k₂≈1.8–2.0, τ₁≈49–50 d, τ₂≈11 d [30]; cycling: k₁=0.048, k₂=0.117, τ₁=38, τ₂=1.9 [26]; swimming: τ₁=38 (17–59), τ₂=19 (6–32) [21]; variable-dose: τ₁=30.8, τ₂=16.8, τ₃=2.3 [23][26]; TrainingPeaks fixed 42/7 [28] |
| Fitting | grid τ₁ ∈ {30, 42, 50}, τ₂ ∈ {5, 7, 10, 15}; for each pair solve the 3×3 normal equations for (p₀, k₁, k₂); accept only k₁ > 0, k₂ > 0, k₂/k₁ ∈ [1, 4]; choose min SSE; report SSE across the grid as an identifiability diagnostic [21][27] |
| Minimum data | ≥ 12 performance observations spanning ≥ 56 days (≥ 5 per free parameter [28]); refit every 60–90 days [28]; below that, show CTL/ATL/TSB with 42/7 d and no gains [28] |
| Timing outputs | `t_n = τ₁τ₂/(τ₁−τ₂)·ln(k₂/k₁)`, `t_g = τ₁τ₂/(τ₁−τ₂)·ln(k₂τ₁/(k₁τ₂))` [24]; 42/7 & k₂/k₁=2 → 5.8 d and 20.9 d; 49/11 & 1.9 → 9.1 d and 30.3 d |
| Performance potential | `form_t = k₁F_{t−1} − k₂G_{t−1}` (model units) and `TSB = CTL − ATL` (parameter-free); flag "fresh" when form is in the personal top quartile |
| Known failures | parameters correlate and CIs are wide [21]; fatigue grows with frequency (recovery 0.9 → 3.6 d at 5 sessions/week) [22]; prediction error 2–2.7 % even in good fits [30]; expect the fit to describe, not predict |

### D. ACWR (descriptive only)

| Item | Specification |
|---|---|
| EWMA | `EWMA_t = λ·L_t + (1−λ)·EWMA_{t−1}`, `λ = 2/(N+1)`: acute N=7 → 0.25, chronic N=28 → 0.069 [31][33] |
| Uncoupled | chronic EWMA computed on the series lagged by 7 days (acute window excluded) [33][34] |
| Warm-up | hide ratio for the first 50 days (EWMA initial-value problem) [33] |
| Bands | 0.8–1.3 "steady", 1.3–1.5 "ramping", ≥ 1.5 "spike", < 0.8 "dip" — heuristics from team sports, no causal evidence [36][37][33] |
| Companion rule | weekly load change vs. 4-week mean ≤ +10–20 % [33] |
| Never | use ACWR to auto-change the plan; it is a chart annotation |

### E. Body weight

| Item | Specification |
|---|---|
| Trend | EWMA α = 0.10 [38]; lag (1−α)/α = 9 d; ≈ 19-day SMA; `SE = σ·√(α/(2−α)) ≈ 0.23σ` [41] |
| Noise | σ_day ≈ 0.5 % body mass (≈ 0.4 kg at 80 kg); scale error ≈ 0.1 kg [40]; measurement rule: same time, post-void, pre-breakfast |
| Rate | Theil–Sen (fallback OLS) slope on raw weights over the last 28 days (min 14), × 7 = kg/week with 95 % CI; 95 % half-width ≈ 0.36 kg/wk at 14 d and 0.13 kg/wk at 28 d for σ = 0.4 kg (independence assumed; autocorrelated water retention widens it) |
| Targets | fat-loss phase 0.5–1.0 %/wk [49]; prefer ≈ 0.7 %/wk when strength matters [50]; alert if CI entirely above 1.0 %/wk for 2 weeks ("too fast") or entirely below 0.25 %/wk for 3 weeks ("adjust intake") |
| Energy | kcal/day ≈ rate_kg_per_week × 7,700 / 7 (± 30 %; short windows only) [38]; long-run: 10 kcal/day per lb of eventual change, half within ≈ 1 year [39] |
| Kalman option | local linear trend; `R = (0.005·BW)²`; level process SD 0.05 kg/√day; slope process SD 0.01 kg/day/√day (fixed priors, not fitted) [48] |

### F. Trend of strength

| Item | Specification |
|---|---|
| Estimator | Theil–Sen on `(t_days, ln e1RM_session)`; slope × 7 × 100 = %/week [45] |
| CI | `Var(S) = n(n−1)(2n+5)/18`; `C = z_{0.975}·√Var(S)`; lower = slope ranked `(N−C)/2`, upper = slope ranked `(N+C)/2 + 1` (1-based) among the `N = n(n−1)/2` pairwise slopes [46]; for n < 10 use a 1,000-draw bootstrap of pairs instead [45][46] |
| Minimums | line ≥ 5 points over ≥ 21 days; CI ≥ 8 points over ≥ 28 days; forecast ≥ 10 points over ≥ 42 days |
| Windows | default 12 weeks; also "since program start" |
| Expected rates (anchors) | untrained young men: 1RM gains of ES 0.17–0.27 over 16 weeks [3]; resistance-trained men: squat +14–17 kg, bench +10–11 kg in 8 weeks [8]; expect 1–3 %/wk early, < 0.5 %/wk after a year (declining) |

### G. Plateau / changepoint

| Detector | Specification |
|---|---|
| Confirmed PR | session e1RM ≥ 1.025 × previous confirmed best (≈ 0.6σ) on comparable sets (`T ≤ 8`, `RIR ≤ 2`), or two consecutive sessions above the previous best |
| No-PR rule | sessions since confirmed PR ≥ N; N = 6 (novice; P(false alarm) ≈ 0.65⁶ = 7.5 %), 10 (intermediate; 0.8¹⁰ = 10.7 %), 14 (advanced) — N counts sessions of that exercise, not calendar weeks |
| Linear-progression stop | 3 consecutive failed target sets → −10 % load, resume; second stall → change progression scheme [62] |
| CUSUM | on `z_t = (ln e1RM_t − trend_t)/σ`, k = 0.5, h = 4.2 (NIST design α = 0.0027, β = 0.01, δ = 1) [42]; `S_lo` alarm = stall/regression; `S_hi` alarm = faster than modelled (re-fit trend) |
| BOCPD | Gaussian, known σ = 0.04 (log units), prior mean = current trend level, prior SD = 0.08; hazard H = 1/40 sessions; truncate run length at 100; flag when P(run length ≤ 3) > 0.5 [43][44] |
| Action mapping | plateau flag + high fatigue (TSB/form low, monotony > 2) → deload week (−40–50 % sets, same loads); plateau flag + fresh → change stimulus (rep range, exercise variant, +1 set) |

### H. Forecast (time-to-goal)

| Item | Specification |
|---|---|
| Point estimate | `days = (ln goal − ln level_now)/slope` with slope per day on log scale |
| Interval | `[gap/slope_hi, gap/slope_lo]`; if `slope_lo ≤ 0` → upper bound "not estimable"; if `slope_hi ≤ 0` → "not on current trend" |
| Caps | horizon ≤ 2 × data span and ≤ 26 weeks; recompute weekly; show the date band, never a single date |
| Decay | if ≥ 24 weeks of data, fit slope on the last 12 weeks only (progress decelerates); optional Kalman forecast variance `P₀₀ + 2hP₀₁ + h²P₁₁ + σ_s²h³/3 + σ_l²h` |
| Body-weight goal | same machinery on raw kg (linear), using the 28-day slope CI |

### I. Readiness

| Item | Specification |
|---|---|
| Inputs (daily, 1 tap each) | sleep hours; sleep quality 1–5; soreness 1–5; stress 1–5; mood/energy 1–5; optional lnRMSSD, resting HR [55][53] |
| Score | each item → z vs. personal 28-day baseline (sign-aligned so + = better); composite = mean of available z; HRV enters only as the 7-day mean when ≥ 3 readings/week [54] |
| HRV detail | SWC = 0.5–1.0 × individual CV of lnRMSSD (CV typically 10–20 %) [53]; falling lnRMSSD with rising RHR = fatigue signal; falling lnRMSSD with falling RHR may be saturation [53] |
| Tiers | ≥ −0.5: train as planned · −0.5 to −1.0: keep loads, −1 set per exercise, cap RPE 8 · < −1.0: −20–30 % sets, cap RPE 7, no PR attempts, keep the session |
| Sleep < 6 h | expect ≈ −3 % max strength and ≈ −10 % reps-at-load [51][52]; keep load, lower rep targets 1–2, or −3 % load; prefer morning training on short-sleep days [52] |
| Evidence weight | subjective > objective for load response [55]; HRV optional |

### J. Strength normalization

| Formula | Specification |
|---|---|
| Bodyweight ratio | `e1RM / BW`; machine percentile heuristics (men): 0.50× ≈ 5th pct, 0.75× ≈ 20th, 1.00× ≈ 50th, 1.50× ≈ 80th, 1.75× (pulldown, row) or 2.00× (chest press) ≈ 95th — machine-specific loads, orientation only [56][57][58] |
| Allometric | `e1RM / BW^(2/3)` for cross-weight comparison of one person over time (theory; use with care) |
| Wilks 2020 (men) | `600 / (a + b·x + c·x² + d·x³ + e·x⁴ + f·x⁵)`, x = BW kg; a=47.46178854, b=8.472061379, c=0.07369410346, d=−0.001395833811, e=7.07665973070743e−6, f=−1.20804336482315e−8 (women: −125.4255398, 13.71219419, −0.03307250631, −0.001050400051, 9.38773881462799e−6, −2.3334613884954e−8) [59] |
| DOTS (men) | `500 / (a·x⁴ + b·x³ + c·x² + d·x + e)`; a=−0.0000010930, b=0.0007391293, c=−0.1918759221, d=24.0900756, e=−307.75076; clamp x to 40–210 kg (women: −0.0000010706, 0.0005158568, −0.1126655495, 13.6175032, −57.96288; 40–150 kg) [60] |
| IPF GL (men, classic PL) | `total × 100 / (A − B·e^(−C·x))`, A=1199.72839, B=1025.18162, C=0.00921 (bench only: 320.98041, 281.40258, 0.01008) [60] |
| Sinclair 2017–2020 (men) | `10^(A·(log10(x/b))²)` for x < b else 1; A=0.751945030, b=175.508 (women 0.783497476, 153.655); later cycles not verified here [61] |
| Site default | barbell formulas only for barbell lifts; machines: % of personal baseline + BW ratio with machine label |

### K. Visualization (small-n)

1. Points (qualifying sets, grey for non-qualifying) + Theil–Sen line + ± 1.96σ band + confirmed-PR markers + "n points, span" badge.
2. Log y-axis for load when `max/min > 1.5`; otherwise linear with 0 excluded.
3. No line under 5 points / 21 days; no band under 8 points; no forecast under 10 points / 42 days — render a "collecting data" state instead.
4. Weekly best e1RM for display; session-level data for estimation; never splines or polynomials; no dual axes.
5. Body weight: light daily dots, bold trend, slope label "−0.6 kg/wk (−0.9 to −0.3)".
6. Volume: weekly stacked bars of fractional hard sets per muscle with the target band; hover shows direct vs indirect.
7. Banister/TSB: three lines (fitness, fatigue, form), shown only after 8 weeks, labelled "model".
8. ACWR: a thin annotation strip with bands, not a headline metric.
9. Small multiples per exercise, identical axes within a muscle group; phone width first (360–430 px).

### L. Light ML and implementation order

| Step | Component | Notes |
|---|---|---|
| 1 | `e1rm()` with RIR, validity gates, σ, calibration | pure functions, unit-tested against the table above |
| 2 | volume metrics (`fractionalSets`, `tonnage`, `relativeVolume`, `inol`, `sRPE`, monotony/strain) | needs the exercise→muscle direct/indirect map |
| 3 | `ewma`, body-weight trend, `theilSen` with CI, weekly rate | O(n²) pairwise slopes is fine for n ≤ 365 |
| 4 | e1RM trend per exercise, confirmed PRs, no-PR rule | first plateau detector |
| 5 | `cusum` on residuals | second detector |
| 6 | `kalmanLLT` for weight, then for log e1RM | gives forecasts with bands |
| 7 | `banister()` + `fitBanisterGrid()` with CTL/ATL fallback | after ≥ 8 weeks of data |
| 8 | `bocpd()` and `shrinkSlopes()` (James–Stein / DerSimonian–Laird empirical Bayes) | optional; shrinkage needs ≥ 3 exercises with slopes and SEs [47] |

## JS-ready pseudocode

```js
// ---------- A. e1RM ----------
export const E1RM = {
  epley:    (w, r) => w * (1 + r / 30),
  brzycki:  (w, r) => w * 36 / (37 - r),
  lander:   (w, r) => 100 * w / (101.3 - 2.67123 * r),
  lombardi: (w, r) => w * Math.pow(r, 0.10),
  mayhew:   (w, r) => 100 * w / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  oconner:  (w, r) => w * (1 + 0.025 * r),
  wathan:   (w, r) => 100 * w / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  marzagao: (wKg, r) => wKg * (1 + Math.pow(r - 1, 0.85) / (-2.55 + 4.58 * Math.log(wKg))),
};
// RTS chart, index = total reps T = reps + RIR (RPE 10 row); %1RM as fraction
export const PCT_BY_TOTAL_REPS = [null, 1.000, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.717, 0.696];

export function e1rm(w, reps, rir = 0, { formula = 'blend', calibration = 1, machine = false } = {}) {
  if (!(w > 0) || !(reps >= 1) || rir < 0) return null;
  const T = reps + rir;
  if (T > 12 || rir >= 5) return null;                       // out of validity
  let v;
  if (T === 1) v = w;
  else if (formula === 'blend') v = 0.5 * (E1RM.epley(w, T) + E1RM.brzycki(w, T));
  else if (formula === 'chart') v = w / PCT_BY_TOTAL_REPS[T];
  else v = E1RM[formula](w, T);
  v = Math.max(v, w) * calibration;
  let sigmaRel = Math.hypot(0.033, 0.8 * (w / 30) / v);       // 1RM test CV + RIR error (0.8 rep)
  if (T > 10) sigmaRel = Math.hypot(sigmaRel, 0.02);
  if (rir === 4) sigmaRel = Math.hypot(sigmaRel, 0.03);
  if (machine) sigmaRel = Math.hypot(sigmaRel, 0.01);
  const quality = (rir <= 3 && T <= 10) ? 'good' : 'weak';
  return { value: v, sigmaRel, sigma: v * sigmaRel, T, quality };
}

export function sessionE1rm(sets) {                            // precision-weighted mean of qualifying sets
  const est = sets.map(s => e1rm(s.kg, s.reps, s.rir, s.opts)).filter(Boolean);
  if (!est.length) return null;
  const wts = est.map(e => 1 / (e.sigma * e.sigma));
  const W = wts.reduce((a, b) => a + b, 0);
  const mean = est.reduce((a, e, i) => a + wts[i] * e.value, 0) / W;
  return { value: mean, sigma: Math.sqrt(1 / W), best: Math.max(...est.map(e => e.value)), n: est.length };
}

export function calibrationFactor(pairs) {                     // pairs: [{heavy: e1rm(T<=3), rep: e1rm(T 5..10)}] within 14 days
  if (pairs.length < 2) return 1;
  const ratios = pairs.map(p => p.heavy / p.rep).sort((a, b) => a - b);
  const med = ratios[Math.floor(ratios.length / 2)];
  return Math.min(1.10, Math.max(0.90, med));
}

// ---------- B. Volume / intensity ----------
export function fractionalSets(sets, muscleId, roleOf /* (exerciseId, muscleId) => 'direct'|'indirect'|null */) {
  return sets.reduce((acc, s) => {
    if (s.rir > 4) return acc;                                 // not a hard set
    const role = roleOf(s.exerciseId, muscleId);
    return acc + (role === 'direct' ? 1 : role === 'indirect' ? 0.5 : 0);
  }, 0);
}
export const tonnage = sets => sets.reduce((a, s) => a + s.kg * s.reps, 0);
export const relativeVolume = (sets, e1rmOf) => sets.reduce((a, s) => a + s.reps * s.kg / e1rmOf(s.exerciseId), 0);
export function inol(sets, e1rmOf) {
  return sets.reduce((a, s) => {
    const pct = Math.min(95, 100 * s.kg / e1rmOf(s.exerciseId));
    return a + s.reps / (100 - pct);
  }, 0);
}
export const sessionRPE = (rpeCR10, minutes) => rpeCR10 * minutes;
export function monotonyStrain(dailyLoads7) {                  // 7 numbers, 0 for rest days
  const mean = dailyLoads7.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(dailyLoads7.reduce((a, b) => a + (b - mean) ** 2, 0) / 6);
  const monotony = sd > 0 ? mean / sd : Infinity;
  return { monotony, strain: mean * 7 * monotony };
}

// ---------- C. EWMA, body weight ----------
export function ewma(values, lambda, init = values[0]) {       // values may contain null (missing day → carry)
  let s = init; return values.map(v => (s = v == null ? s : lambda * v + (1 - lambda) * s));
}
export function weightTrend(daily /* [{t: dayIndex, kg|null}] */, alpha = 0.10) {
  const series = ewma(daily.map(d => d.kg), alpha);
  return daily.map((d, i) => ({ t: d.t, kg: d.kg, trend: series[i] }));
}
export function weeklyRate(daily, days = 28) {                 // uses raw weights, robust slope
  const pts = daily.filter(d => d.kg != null).slice(-days);
  if (pts.length < 10) return null;
  const ts = theilSen(pts.map(p => p.t), pts.map(p => p.kg));
  return { kgPerWeek: 7 * ts.slope, lo: 7 * ts.lo, hi: 7 * ts.hi, n: pts.length,
           kcalPerDay: 7 * ts.slope * 7700 / 7 };              // short-window approximation only
}

// ---------- D. Theil–Sen with rank CI ----------
export function theilSen(xs, ys, z = 1.96) {
  const n = xs.length, slopes = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
  slopes.sort((a, b) => a - b);
  const N = slopes.length, med = a => a.length % 2 ? a[(a.length - 1) / 2] : 0.5 * (a[a.length / 2 - 1] + a[a.length / 2]);
  const slope = med(slopes);
  const intercept = med(xs.map((x, i) => ys[i] - slope * x).sort((a, b) => a - b));
  const varS = n * (n - 1) * (2 * n + 5) / 18, C = z * Math.sqrt(varS);
  const rLo = Math.max(1, Math.round((N - C) / 2)), rHi = Math.min(N, Math.round((N + C) / 2) + 1);
  return { slope, intercept, lo: slopes[rLo - 1], hi: slopes[rHi - 1], n, N, reliable: n >= 10 };
}
// percent/week trend of strength: theilSen(days, e1rms.map(Math.log)) → slope*7*100

// ---------- E. Kalman local linear trend (irregular time) ----------
export function kalmanLLT(obs /* [{t, y}] sorted */, { sigmaObs, sigmaLevel, sigmaSlope, slopePriorSd = 0.1 }) {
  let x = [obs[0].y, 0];
  let P = [[sigmaObs ** 2, 0], [0, slopePriorSd ** 2]];
  const R = sigmaObs ** 2, out = [{ t: obs[0].t, level: x[0], slope: 0, sdLevel: sigmaObs, sdSlope: slopePriorSd }];
  for (let k = 1; k < obs.length; k++) {
    const dt = obs[k].t - obs[k - 1].t, ql = sigmaLevel ** 2, qs = sigmaSlope ** 2;
    // predict
    x = [x[0] + dt * x[1], x[1]];
    const P00 = P[0][0] + 2 * dt * P[0][1] + dt * dt * P[1][1] + ql * dt + qs * dt ** 3 / 3;
    const P01 = P[0][1] + dt * P[1][1] + qs * dt * dt / 2;
    const P11 = P[1][1] + qs * dt;
    P = [[P00, P01], [P01, P11]];
    // update (skip if y missing)
    if (obs[k].y != null) {
      const S = P[0][0] + R, K0 = P[0][0] / S, K1 = P[0][1] / S, innov = obs[k].y - x[0];
      x = [x[0] + K0 * innov, x[1] + K1 * innov];
      P = [[(1 - K0) * P[0][0], (1 - K0) * P[0][1]], [P[0][1] - K1 * P[0][0], P[1][1] - K1 * P[0][1]]];
    }
    out.push({ t: obs[k].t, level: x[0], slope: x[1], sdLevel: Math.sqrt(P[0][0]), sdSlope: Math.sqrt(P[1][1]) });
  }
  const forecast = h => ({ mean: x[0] + h * x[1],
    sd: Math.sqrt(P[0][0] + 2 * h * P[0][1] + h * h * P[1][1] + sigmaSlope ** 2 * h ** 3 / 3 + sigmaLevel ** 2 * h) });
  return { states: out, forecast };
}
// weight: {sigmaObs: 0.005*BW, sigmaLevel: 0.05, sigmaSlope: 0.01}; log e1RM: {sigmaObs: 0.04, sigmaLevel: 0.004, sigmaSlope: 0.0002}

// ---------- F. Banister ----------
export function banister(loads /* daily w_t */, { p0, k1, k2, tau1, tau2 }) {
  let F = 0, G = 0; const d1 = Math.exp(-1 / tau1), d2 = Math.exp(-1 / tau2);
  return loads.map(w => {
    const perf = p0 + k1 * F - k2 * G, form = k1 * F - k2 * G;   // uses traces before today's load
    F = F * d1 + w; G = G * d2 + w;
    return { fitness: F, fatigue: G, perf, form };
  });
}
export function fitBanisterGrid(loads, perfObs /* [{day, value}] */, grid = { tau1: [30, 42, 50], tau2: [5, 7, 10, 15] }) {
  if (perfObs.length < 12 || perfObs.at(-1).day - perfObs[0].day < 56) return { ok: false, reason: 'insufficient data' };
  let best = null; const diagnostics = [];
  for (const tau1 of grid.tau1) for (const tau2 of grid.tau2) {
    if (tau2 >= tau1) continue;
    const tr = banister(loads, { p0: 0, k1: 1, k2: 0, tau1, tau2 });   // reuse traces: fitness=F, fatigue=G
    // design rows [1, F_{d-1}, -G_{d-1}] → solve normal equations for [p0, k1, k2]
    const X = perfObs.map(o => [1, o.day > 0 ? tr[o.day - 1].fitness : 0, -(o.day > 0 ? tr[o.day - 1].fatigue : 0)]);
    const y = perfObs.map(o => o.value);
    const beta = solve3x3(XtX(X), Xty(X, y));                            // small dense solver, no deps
    if (!beta) continue;
    const [p0, k1, k2] = beta;
    const sse = X.reduce((a, row, i) => a + (y[i] - (row[0] * p0 + row[1] * k1 + row[2] * k2)) ** 2, 0);
    diagnostics.push({ tau1, tau2, k1, k2, sse });
    if (k1 > 0 && k2 > 0 && k2 / k1 >= 1 && k2 / k1 <= 4 && (!best || sse < best.sse)) best = { p0, k1, k2, tau1, tau2, sse };
  }
  if (!best) return { ok: false, reason: 'no admissible fit', diagnostics };
  const f = best.tau1 * best.tau2 / (best.tau1 - best.tau2);
  best.tN = f * Math.log(best.k2 / best.k1);                           // net effect turns positive after tN days
  best.tG = f * Math.log(best.k2 * best.tau1 / (best.k1 * best.tau2)); // maximal benefit after tG days
  return { ok: true, params: best, diagnostics };
}
export function ctlAtlTsb(loads, { tauC = 42, tauA = 7 } = {}) {       // parameter-free fallback
  const lc = 1 - Math.exp(-1 / tauC), la = 1 - Math.exp(-1 / tauA);
  let c = 0, a = 0; return loads.map(w => { c += lc * (w - c); a += la * (w - a); return { ctl: c, atl: a, tsb: c - a }; });
}

// ---------- G. ACWR (descriptive) ----------
export function acwrEwmaUncoupled(daily /* loads, 0 for rest */, { nA = 7, nC = 28, warmup = 50 } = {}) {
  const la = 2 / (nA + 1), lc = 2 / (nC + 1);
  const acute = ewma(daily, la, 0);
  const lagged = daily.map((_, i) => (i >= nA ? daily[i - nA] : 0));  // exclude the acute window
  const chronic = ewma(lagged, lc, 0);
  return daily.map((_, i) => {
    if (i < warmup || chronic[i] <= 0) return { ratio: null, zone: 'warmup' };
    const r = acute[i] / chronic[i];
    return { ratio: r, zone: r < 0.8 ? 'dip' : r <= 1.3 ? 'steady' : r < 1.5 ? 'ramping' : 'spike' };
  });
}

// ---------- H. Plateau detectors ----------
export function confirmedPRs(sessions /* [{idx, e1rm, comparable}] */, thresh = 0.025) {
  let best = -Infinity, since = 0; const prs = [];
  for (const s of sessions) {
    if (s.comparable && s.e1rm >= best * (1 + thresh)) { best = s.e1rm; prs.push(s.idx); since = 0; } else since++;
  }
  return { prs, sessionsSinceConfirmedPR: since };
}
export const noPrPlateau = (since, stage) => since >= ({ novice: 6, intermediate: 10, advanced: 14 })[stage];

export function cusum(z /* standardized residuals */, k = 0.5, h = 4.2) {
  let hi = 0, lo = 0; const alarms = [];
  z.forEach((v, i) => {
    hi = Math.max(0, hi + v - k); lo = Math.max(0, lo - v - k);
    if (hi > h) { alarms.push({ i, dir: 'up' }); hi = 0; }
    if (lo > h) { alarms.push({ i, dir: 'down' }); lo = 0; }
  });
  return alarms;
}

export function bocpd(xs, { hazard = 1 / 40, mu0, sigma0 = 0.08, sigma = 0.04, maxRun = 100 }) {
  let R = [1], mus = [mu0], precs = [1 / sigma0 ** 2];
  const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  return xs.map(x => {
    const pred = R.map((_, i) => pdf(x, mus[i], Math.sqrt(sigma ** 2 + 1 / precs[i])));
    const growth = R.map((r, i) => r * pred[i] * (1 - hazard));
    const cp = R.reduce((a, r, i) => a + r * pred[i] * hazard, 0);
    let newR = [cp, ...growth]; const Z = newR.reduce((a, b) => a + b, 0); newR = newR.map(v => v / Z);
    const newPrecs = [1 / sigma0 ** 2, ...precs.map(p => p + 1 / sigma ** 2)];
    const newMus = [mu0, ...mus.map((m, i) => (m * precs[i] + x / sigma ** 2) / newPrecs[i + 1])];
    R = newR.slice(0, maxRun); mus = newMus.slice(0, maxRun); precs = newPrecs.slice(0, maxRun);
    const pShort = R.slice(0, 4).reduce((a, b) => a + b, 0);         // P(run length <= 3)
    return { pChange: pShort, mapRun: R.indexOf(Math.max(...R)) };
  });
}

// ---------- I. Forecast ----------
export function timeToGoal(levelNow, goal, slope, slopeLo, slopeHi, { spanDays, maxDays = 182 }) {
  const gap = Math.log(goal) - Math.log(levelNow);                     // log scale for strength; use raw kg for weight
  if (gap <= 0) return { days: 0 };
  const cap = Math.min(maxDays, 2 * spanDays);
  const d = s => (s > 0 ? gap / s : Infinity);
  const res = { days: d(slope), earliest: d(slopeHi), latest: d(slopeLo), capDays: cap };
  res.estimable = res.days <= cap; res.latestEstimable = Number.isFinite(res.latest) && res.latest <= cap;
  return res;
}

// ---------- J. Readiness ----------
export function readiness(today, baseline /* {mean, sd} per item, 28 days */, hrvWeek /* lnRMSSD values this week */) {
  const items = ['sleepHours', 'sleepQuality', 'soreness', 'stress', 'mood'];
  const sign = { sleepHours: 1, sleepQuality: 1, soreness: -1, stress: -1, mood: 1 };
  const zs = items.filter(k => today[k] != null && baseline[k]?.sd > 0)
                  .map(k => sign[k] * (today[k] - baseline[k].mean) / baseline[k].sd);
  if (hrvWeek && hrvWeek.length >= 3 && baseline.lnRMSSD?.cv > 0) {
    const wk = hrvWeek.reduce((a, b) => a + b, 0) / hrvWeek.length;
    zs.push((wk - baseline.lnRMSSD.mean) / (baseline.lnRMSSD.mean * baseline.lnRMSSD.cv)); // units of individual CV
  }
  const score = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : 0;
  const tier = score >= -0.5 ? 'normal' : score >= -1.0 ? 'reduced' : 'light';
  const shortSleep = today.sleepHours != null && today.sleepHours < 6;
  return { score, tier, shortSleep, adjust: { normal: {}, reduced: { setsDelta: -1, rpeCap: 8 },
           light: { setsFactor: 0.75, rpeCap: 7, noPR: true } }[tier], repTargetDelta: shortSleep ? -1 : 0 };
}

// ---------- K. Normalization ----------
export const dots = (total, bw, sex = 'm') => {
  const c = sex === 'm' ? [-0.0000010930, 0.0007391293, -0.1918759221, 24.0900756, -307.75076]
                        : [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288];
  const x = Math.min(sex === 'm' ? 210 : 150, Math.max(40, bw));
  return total * 500 / (c[0] * x ** 4 + c[1] * x ** 3 + c[2] * x ** 2 + c[3] * x + c[4]);
};
export const wilks2020 = (total, x, sex = 'm') => {
  const c = sex === 'm' ? [47.46178854, 8.472061379, 0.07369410346, -0.001395833811, 7.07665973070743e-6, -1.20804336482315e-8]
                        : [-125.4255398, 13.71219419, -0.03307250631, -0.001050400051, 9.38773881462799e-6, -2.3334613884954e-8];
  return total * 600 / c.reduce((a, ci, i) => a + ci * x ** i, 0);
};
export const ipfGL = (total, x, { A = 1199.72839, B = 1025.18162, C = 0.00921 } = {}) => total * 100 / (A - B * Math.exp(-C * x));
export const sinclair2017 = (total, x, sex = 'm') => {
  const [A, b] = sex === 'm' ? [0.751945030, 175.508] : [0.783497476, 153.655];
  return x >= b ? total : total * Math.pow(10, A * Math.log10(x / b) ** 2);
};
export function bwRatioLevel(e1rmKg, bwKg, eliteRatio = 1.75) {       // machine heuristics; orientation only
  const r = e1rmKg / bwKg;
  return r < 0.5 ? 'beginner' : r < 0.75 ? 'novice' : r < 1.0 ? 'intermediate' : r < 1.5 ? 'advanced' : r < eliteRatio ? 'elite' : 'elite+';
}

// ---------- L. Empirical-Bayes shrinkage of per-exercise %/week slopes ----------
export function shrinkSlopes(items /* [{id, slope, se}] */) {
  const m = items.length; if (m < 3) return items.map(i => ({ ...i, shrunk: i.slope }));
  const w = items.map(i => 1 / (i.se * i.se)), W = w.reduce((a, b) => a + b, 0);
  const mu = items.reduce((a, i, k) => a + w[k] * i.slope, 0) / W;
  const Q = items.reduce((a, i, k) => a + w[k] * (i.slope - mu) ** 2, 0);
  const tau2 = Math.max(0, (Q - (m - 1)) / (W - w.reduce((a, b) => a + b * b, 0) / W)); // DerSimonian–Laird
  return items.map((i, k) => ({ ...i, shrunk: mu + (tau2 / (tau2 + i.se ** 2)) * (i.slope - mu), mu, tau: Math.sqrt(tau2) }));
}
```

## analytics_models

```json analytics_models
{
  "version": "2026-11-08",
  "e1rm": {
    "default_formula": "blend_epley_brzycki",
    "total_reps_definition": "T = reps + RIR",
    "formulas": {
      "epley": "w*(1+r/30)",
      "brzycki": "w*36/(37-r)",
      "lander": "100*w/(101.3-2.67123*r)",
      "lombardi": "w*r^0.10",
      "mayhew": "100*w/(52.2+41.9*exp(-0.055*r))",
      "oconner": "w*(1+0.025*r)",
      "wathan": "100*w/(48.8+53.8*exp(-0.075*r))",
      "marzagao_2026_kg": "w*(1+(r-1)^0.85/(-2.55+4.58*ln(w)))",
      "rts_chart": "w/pct_by_total_reps[T]"
    },
    "pct_by_total_reps": [null, 1.0, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.717, 0.696],
    "validity": { "T_preferred_max": 10, "T_hard_max": 12, "rir_max_good": 3, "rir_max_accept": 4, "best_rep_range_for_prediction": [3, 5] },
    "noise": { "sigma_rel_1rm_test": 0.033, "rir_error_reps": 0.8, "sigma_rel_default": 0.04, "machine_extra": 0.01, "T_over_10_extra": 0.02, "rir4_extra": 0.03 },
    "calibration": { "heavy_set_T_max": 3, "pair_window_days": 14, "clamp": [0.9, 1.1], "reset_on_machine_change": true },
    "series_key": ["exerciseId", "gymId", "machineId"],
    "load_progression_rule": { "extra_reps_trigger": [1, 2], "consecutive_sessions": 2, "increase_pct": [2, 10], "machine_default_pct": [2.5, 5] }
  },
  "volume": {
    "fractional_weights": { "direct": 1, "indirect": 0.5 },
    "hard_set_rir_max": 4,
    "marginal_effect_per_weekly_set": { "hypertrophy_pct": 0.24, "hypertrophy_cri": [0.15, 0.33], "strength_pct": 0.21, "strength_cri": [0.16, 0.26] },
    "strength_saturation_sets_per_exercise_week": 4,
    "hypertrophy_target_sets_per_muscle_week": [10, 20],
    "strength_target_sets_per_exercise_week": [4, 10],
    "relative_intensity_bands": { "strength": [0.75, 0.90], "hypertrophy": [0.65, 0.80] },
    "inol": {
      "formula": "sum(reps/(100-pct1rm))",
      "pct_clamp_max": 95,
      "per_exercise_workout": { "low": 0.4, "sustainable": [0.4, 1.0], "loading": [1.0, 2.0], "brutal": 2.0 },
      "per_exercise_week": { "easy": 2.0, "tough": [2.0, 3.0], "brutal": [3.0, 4.0], "avoid_above": 4.0 }
    },
    "prilepin": [
      { "pct_max": 70, "reps_per_set": [3, 6], "total_range": [18, 30], "optimal": 24 },
      { "pct_range": [70, 79], "reps_per_set": [3, 6], "total_range": [12, 24], "optimal": 18 },
      { "pct_range": [80, 89], "reps_per_set": [2, 4], "total_range": [10, 20], "optimal": 15 },
      { "pct_min": 90, "reps_per_set": [1, 2], "total_range": [4, 10], "optimal": 7 }
    ],
    "srpe": { "formula": "rpe_cr10*minutes", "monotony": "mean(daily_load_7d)/sd(daily_load_7d)", "strain": "weekly_load*monotony", "monotony_flag": 2.0 }
  },
  "banister": {
    "recursion": { "fitness": "F_t = F_{t-1}*exp(-1/tau1) + w_t", "fatigue": "G_t = G_{t-1}*exp(-1/tau2) + w_t", "performance": "P_t = p0 + k1*F_{t-1} - k2*G_{t-1}" },
    "tau_grid_days": { "tau1": [30, 42, 50], "tau2": [5, 7, 10, 15] },
    "fit": { "free_params": ["p0", "k1", "k2"], "method": "linear_least_squares_per_tau_pair", "admissible": { "k1_min": 0, "k2_min": 0, "k2_over_k1": [1, 4] } },
    "min_observations": 12,
    "min_span_days": 56,
    "refit_every_days": [60, 90],
    "fallback": { "ctl_tau_days": 42, "atl_tau_days": 7, "tsb": "ctl-atl" },
    "reference_params": [
      { "source": "Calvert/Banister original", "k1": 1.0, "k2": [1.8, 2.0], "tau1": [49, 50], "tau2": 11 },
      { "source": "Busso 1991 cycling", "k1": 0.048, "k2": 0.117, "tau1": 38, "tau2": 1.9 },
      { "source": "Hellard 2006 swimming", "tau1": 38, "tau1_ci": [17, 59], "tau2": 19, "tau2_ci": [6, 32] },
      { "source": "Busso 2003 variable dose", "tau1": 30.8, "tau2": 16.8, "tau3": 2.3 }
    ],
    "timing": { "t_n": "tau1*tau2/(tau1-tau2)*ln(k2/k1)", "t_g": "tau1*tau2/(tau1-tau2)*ln(k2*tau1/(k1*tau2))", "example_42_7_ratio2_days": { "t_n": 5.8, "t_g": 20.9 } }
  },
  "acwr": {
    "lambda_formula": "2/(N+1)",
    "acute_days": 7,
    "chronic_days": 28,
    "lambda_acute": 0.25,
    "lambda_chronic": 0.069,
    "uncoupled": true,
    "warmup_days": 50,
    "zones": { "dip_below": 0.8, "steady": [0.8, 1.3], "ramping": [1.3, 1.5], "spike_at_or_above": 1.5 },
    "weekly_change_rule_pct": [10, 20],
    "prescriptive_use": false
  },
  "bodyweight": {
    "ewma_alpha": 0.10,
    "ewma_lag_days": 9,
    "ewma_equiv_sma_days": 19,
    "ewma_se_factor": "sqrt(alpha/(2-alpha))",
    "day_to_day_sd_rel": 0.005,
    "scale_error_kg": 0.1,
    "rate": { "method": "theil_sen_on_raw", "window_days": 28, "min_days": 14, "ci_halfwidth_kg_per_week_at_sigma_0p4": { "14d": 0.36, "28d": 0.13 } },
    "loss_target_pct_per_week": [0.5, 1.0],
    "loss_preferred_pct_per_week": 0.7,
    "alerts": { "too_fast_pct_per_week": 1.0, "too_fast_weeks": 2, "too_slow_pct_per_week": 0.25, "too_slow_weeks": 3 },
    "kcal_per_kg_short_window": 7700,
    "long_run_rule": "10 kcal/day per lb eventual change; half within ~1 year",
    "kalman": { "sigma_obs": "0.005*BW", "sigma_level_kg_per_sqrt_day": 0.05, "sigma_slope_kg_per_day_per_sqrt_day": 0.01, "fit_process_noise": false }
  },
  "trend": {
    "estimator": "theil_sen",
    "transform": "ln(e1rm)",
    "units": "pct_per_week = slope_per_day*7*100",
    "ci": { "var_s": "n*(n-1)*(2n+5)/18", "z": 1.96, "lower_rank": "(N-C)/2", "upper_rank": "(N+C)/2+1", "bootstrap_if_n_below": 10, "bootstrap_draws": 1000 },
    "min_points_line": 5,
    "min_days_line": 21,
    "min_points_ci": 8,
    "min_days_ci": 28,
    "min_points_forecast": 10,
    "min_days_forecast": 42,
    "default_window_weeks": 12,
    "expected_pct_per_week": { "novice": [1, 3], "intermediate": [0.25, 1], "advanced": [0, 0.5] }
  },
  "plateau": {
    "confirmed_pr_threshold_rel": 0.025,
    "comparable_set": { "T_max": 8, "rir_max": 2 },
    "no_pr_sessions": { "novice": 6, "intermediate": 10, "advanced": 14 },
    "linear_progression_stop": { "consecutive_misses": 3, "deload_pct": 10 },
    "cusum": { "k": 0.5, "h": 4.2, "input": "standardized residuals of ln(e1rm) from trend" },
    "bocpd": { "hazard": 0.025, "sigma": 0.04, "prior_sd": 0.08, "max_run": 100, "flag_if_p_run_le_3_above": 0.5 },
    "actions": { "plateau_and_fatigued": "deload: sets x0.5-0.6, same loads, 1 week", "plateau_and_fresh": "change stimulus: rep range or variant, +1 set" }
  },
  "forecast": {
    "point": "gap/slope",
    "interval": "[gap/slope_hi, gap/slope_lo]",
    "horizon_cap_days": 182,
    "horizon_cap_multiple_of_span": 2,
    "recompute_days": 7,
    "recent_window_weeks_if_long_history": 12,
    "kalman_forecast_var": "P00 + 2h*P01 + h^2*P11 + sigma_slope^2*h^3/3 + sigma_level^2*h"
  },
  "readiness": {
    "items": ["sleepHours", "sleepQuality", "soreness", "stress", "mood"],
    "signs": { "sleepHours": 1, "sleepQuality": 1, "soreness": -1, "stress": -1, "mood": 1 },
    "baseline_days": 28,
    "tiers": { "normal_min": -0.5, "reduced_min": -1.0 },
    "adjustments": { "reduced": { "sets_delta": -1, "rpe_cap": 8 }, "light": { "sets_factor": 0.75, "rpe_cap": 7, "no_pr": true } },
    "sleep": { "short_hours": 6, "max_strength_loss_pct": 2.85, "strength_endurance_loss_pct": 9.85, "rep_target_delta": -1, "load_alternative_pct": -3 },
    "hrv": { "index": "lnRMSSD", "rolling_days": 7, "min_readings_per_week": 3, "swc_in_cv_units": [0.5, 1.0], "typical_cv_pct": [10, 20], "read_with_resting_hr": true }
  },
  "normalization": {
    "machine_ratio_levels_bw": { "beginner": 0.5, "novice": 0.75, "intermediate": 1.0, "advanced": 1.5, "elite": { "lat_pulldown": 1.75, "seated_row": 1.75, "chest_press": 2.0 } },
    "machine_percentiles": { "beginner": 5, "novice": 20, "intermediate": 50, "advanced": 80, "elite": 95 },
    "allometric": "e1rm/BW^(2/3)",
    "wilks_2020": { "numerator": 600, "men": [47.46178854, 8.472061379, 0.07369410346, -0.001395833811, 7.07665973070743e-6, -1.20804336482315e-8], "women": [-125.4255398, 13.71219419, -0.03307250631, -0.001050400051, 9.38773881462799e-6, -2.3334613884954e-8] },
    "dots": { "numerator": 500, "men": [-0.0000010930, 0.0007391293, -0.1918759221, 24.0900756, -307.75076], "women": [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288], "bw_clamp_men": [40, 210], "bw_clamp_women": [40, 150] },
    "ipf_gl_classic": { "men": { "A": 1199.72839, "B": 1025.18162, "C": 0.00921 }, "women": { "A": 610.32796, "B": 1045.59282, "C": 0.03048 }, "men_bench": { "A": 320.98041, "B": 281.40258, "C": 0.01008 }, "women_bench": { "A": 142.40398, "B": 442.52671, "C": 0.04724 } },
    "sinclair_2017_2020": { "men": { "A": 0.751945030, "b": 175.508 }, "women": { "A": 0.783497476, "b": 153.655 }, "later_cycles_verified": false },
    "machines_cross_comparable": false
  },
  "viz": {
    "log_axis_if_range_ratio_above": 1.5,
    "band_z": 1.96,
    "aggregate_for_display": "weekly_best",
    "no_curves": ["spline", "polynomial"],
    "dual_axes": false,
    "banister_min_weeks": 8,
    "phone_widths_px": [360, 430]
  },
  "ml": {
    "kalman_log_e1rm": { "sigma_obs": 0.04, "sigma_level": 0.004, "sigma_slope": 0.0002 },
    "shrinkage": { "method": "james_stein_dersimonian_laird", "min_series": 3, "unit": "pct_per_week" }
  },
  "implementation_order": ["e1rm", "volume", "ewma_theil_sen", "trend_prs_no_pr", "cusum", "kalman", "banister_grid", "bocpd_shrinkage"]
}
```

## Sources

1. One-repetition maximum (formula table: Epley, Brzycki, Landers, Lombardi, Mayhew, O'Conner, Wathan). Wikipedia, accessed 2026-11-08. https://en.wikipedia.org/wiki/One-repetition_maximum
2. Reynolds JM, Gordon TJ, Robergs RA. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. J Strength Cond Res 2006;20(3):584–592. https://pubmed.ncbi.nlm.nih.gov/16937972/
3. Ribeiro AS, Alencar da Silva J, Nascimento MA, Martinho D, Santos L, de Salles BF, Mayhew JL, Cyrino ES. Accuracy of 1RM Prediction Equations Before and After Resistance Training in Three Different Lifts. Int J Strength Cond 2024;4(1). https://doi.org/10.47206/ijsc.v4i1.327
4. Grgic J, Lazinica B, Schoenfeld BJ, Pedisic Z. Test–Retest Reliability of the One-Repetition Maximum (1RM) Strength Assessment: a Systematic Review. Sports Med Open 2020;6:31. https://pmc.ncbi.nlm.nih.gov/articles/PMC7367986/
5. Shimano T, Kraemer WJ, Spiering BA, et al. Relationship between the number of repetitions and selected percentages of one repetition maximum in free weight exercises in trained and untrained men. J Strength Cond Res 2006;20(4):819–823. https://pubmed.ncbi.nlm.nih.gov/17194239/
6. Marzagao T. A Weight-Dependent 1RM Prediction Equation Optimized on 303,494 Near-Failure Sets Across 388 Exercises. arXiv:2603.17495, 2026. https://arxiv.org/abs/2603.17495
7. Helms ER, Cronin J, Storey A, Zourdos MC. Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training. Strength Cond J 2016;38(4):42–49. https://pmc.ncbi.nlm.nih.gov/articles/PMC4961270/
8. Helms ER. Using the Repetitions in Reserve-based Rating of Perceived Exertion Scale to Autoregulate Powerlifting Training. PhD thesis, Auckland University of Technology, 2017 (RIR accuracy review; RPE-stops; 8-week RPE vs %1RM trial). AUT Scholarly Commons, https://openrepository.aut.ac.nz/
9. Zourdos MC, Klemp A, Dolan C, et al. Novel Resistance Training–Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve. J Strength Cond Res 2016;30(1):267–275. https://doi.org/10.1519/JSC.0000000000001049
10. Refalo MC, et al. Accuracy of Intraset Repetitions-in-Reserve Predictions During the Bench Press Exercise in Resistance-Trained Male and Female Subjects. 2024. https://www.researchgate.net/publication/375687905
11. Steele J, Endres A, Fisher J, Gentil P, Giessing J. Ability to predict repetitions to momentary failure is not perfectly accurate, though improves with resistance training experience. PeerJ 2017;5:e4105. https://peerj.com/articles/4105/
12. Tuchscherer M. RPE/%1RM chart (Reactive Training Systems), as reproduced in the FitnessVolt RPE calculator. https://fitnessvolt.com/rpe-training/rpe-calculator/
13. Hristov H. How to Design Strength Training Programs using Prilepin's Table (INOL), 2005; summarized by Lift Vault, "Designing Strength Programs With Prilepin's Chart and INOL". https://liftvault.com/resources/prilepins-table-inol/
14. Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. Sports Med 2025. https://doi.org/10.1007/s40279-025-02344-w
15. Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. J Sports Sci 2017;35(11):1073–1082. https://pubmed.ncbi.nlm.nih.gov/27433992/
16. Rhea MR, Alvar BA, Burkett LN, Ball SD. A meta-analysis to determine the dose response for strength development. Med Sci Sports Exerc 2003;35(3):456–464. https://pubmed.ncbi.nlm.nih.gov/12618576/
17. Peterson MD, Rhea MR, Alvar BA. Applications of the dose-response for muscular strength development: a review of meta-analytic efficacy and reliability for designing training prescription. J Strength Cond Res 2005;19(4):950–958. https://pubmed.ncbi.nlm.nih.gov/16287373/
18. American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687–708. https://pubmed.ncbi.nlm.nih.gov/19204579/
19. Foster C. Monitoring training in athletes with reference to overtraining syndrome. Med Sci Sports Exerc 1998;30(7):1164–1168. https://pubmed.ncbi.nlm.nih.gov/9662690/
20. Day ML, McGuigan MR, Brice G, Foster C. Monitoring exercise intensity during resistance training using the session RPE scale. J Strength Cond Res 2004;18(2):353–358. https://pubmed.ncbi.nlm.nih.gov/15142026/
21. Hellard P, Avalos M, Lacoste L, Barale F, Chatard JC, Millet GP. Assessing the limitations of the Banister model in monitoring training. J Sports Sci 2006;24(5):509–520. https://pmc.ncbi.nlm.nih.gov/articles/PMC1974899/
22. Busso T, Benoit H, Bonnefoy R, Feasson L, Lacour JR. Effects of training frequency on the dynamics of performance response to a single training bout. J Appl Physiol 2002;92(2):572–580. https://pubmed.ncbi.nlm.nih.gov/11796666/
23. Busso T. Variable dose-response relationship between exercise training and performance. Med Sci Sports Exerc 2003;35(7):1188–1195. https://journals.lww.com/acsm-msse/fulltext/2003/07000/variable_dose_response_relationship_between.18.aspx
24. Fitz-Clarke JR, Morton RH, Banister EW. Optimizing athletic performance by influence curves. J Appl Physiol 1991;71(3):1151–1158. https://doi.org/10.1152/jappl.1991.71.3.1151
25. Morton RH, Fitz-Clarke JR, Banister EW. Modeling human performance in running. J Appl Physiol 1990;69(3):1171–1177. https://pubmed.ncbi.nlm.nih.gov/2246166/
26. Mathematical Modelling and Optimisation of Athletic Performance: Tapering and Periodisation (review of fitness–fatigue models; Busso 1991 and Busso 2003 parameter sets; influence-curve timings). arXiv:2505.20859, 2025. https://arxiv.org/abs/2505.20859
27. Liversedge M. Implementing the Banister Impulse-Response Model in GoldenCheetah. 2019. http://markliversedge.blogspot.com/2019/01/implementing-banister-impulse-response.html
28. Coggan AR / TrainingPeaks. The Science of the Performance Manager (CTL 42 d, ATL 7 d, TSB; data requirements for fitting Banister). https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/
29. Kolossa D, Bin Azhar MA, Rasche C, Endler S, Hanakam F, Ferrauti A, Pfeiffer M. Performance Estimation using the Fitness-Fatigue Model with Kalman Filter Feedback. Int J Comput Sci Sport 2017;16(2). https://doi.org/10.1515/ijcss-2017-0010
30. fellrnr.com. Modeling Human Performance (Banister constants k1=1, k2=1.8–2.0, r1=49–50, r2=11 from Calvert et al. 1976; Vermeire 2022; Busso & Chalencon 2023). https://fellrnr.com/wiki/Modeling_Human_Performance
31. Williams S, West S, Cross MJ, Stokes KA. Better way to determine the acute:chronic workload ratio? Br J Sports Med 2017;51(3):209–210. https://bjsm.bmj.com/content/51/3/209
32. Murray NB, Gabbett TJ, Townshend AD, Blanch P. Calculating acute:chronic workload ratios using exponentially weighted moving averages provides a more sensitive indicator of injury likelihood than rolling averages. Br J Sports Med 2017;51(9):749–754. https://bjsm.bmj.com/content/51/9/749
33. Wang C, Vargas JT, Stokes T, Steele R, Shrier I. The acute:chronic workload ratio: challenges and prospects for improvement. arXiv:1907.05326, 2019. https://arxiv.org/abs/1907.05326
34. Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. Br J Sports Med 2019;53:921–922. https://doi.org/10.1136/bjsports-2017-098110
35. Lolli L, Batterham AM, Hawkins R, et al. The acute-to-chronic workload ratio: an inaccurate scaling index for an unnecessary normalisation process? Br J Sports Med 2019 (editorial). https://doi.org/10.1136/bjsports-2017-098884
36. Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. Int J Sports Physiol Perform 2020;15(6):907–913. https://doi.org/10.1123/ijspp.2019-0864
37. Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med 2016;50(5):273–280. https://pubmed.ncbi.nlm.nih.gov/26758673/
38. Walker J. The Hacker's Diet — Pencil and Paper (trend with 10 % smoothing; weekly rate; 3,500 kcal/lb). Fourmilab. https://www.fourmilab.ch/hackdiet/e4/pencilpaper.html
39. Hall KD, Sacks G, Chandramohan D, Chow CC, Wang YC, Gortmaker SL, Swinburn BA. Quantification of the effect of energy imbalance on bodyweight. Lancet 2011;378(9793):826–837. https://doi.org/10.1016/S0140-6736(11)60812-X
40. Day-to-day variability in euvolemic body mass (9,521 daily measurements; SD 0.53 % at 1-day interval; measurement error ≈ 0.1 kg). Renal Failure 2023;45(2):2273421. https://pmc.ncbi.nlm.nih.gov/articles/PMC10653631/
41. NIST/SEMATECH e-Handbook of Statistical Methods, §6.3.2.4 EWMA Control Charts. https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm
42. NIST/SEMATECH e-Handbook of Statistical Methods, §6.3.2.3 Cusum Control Charts. https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc323.htm
43. Adams RP, MacKay DJC. Bayesian Online Changepoint Detection. arXiv:0710.3742, 2007. https://arxiv.org/abs/0710.3742
44. Gundersen G. Bayesian Online Changepoint Detection (derivation and reference implementation). 2019. https://gregorygundersen.com/blog/2019/08/13/bocd/
45. Theil–Sen estimator. Wikipedia, accessed 2026-11-08. https://en.wikipedia.org/wiki/Theil%E2%80%93Sen_estimator
46. Pacific Northwest National Laboratory, Visual Sample Plan help: Nonparametric Estimate of Trend (Sen's slope and rank-based confidence interval). https://vsp.pnnl.gov/help/vsample/Nonparametric_Estimate_of_Trend.htm
47. James–Stein estimator. Wikipedia, accessed 2026-11-08. https://en.wikipedia.org/wiki/James%E2%80%93Stein_estimator
48. HealthTrend — Probabilistic body-weight trend estimation with irregular-time Kalman filtering (GitHub). https://github.com/AlfredHong2006/HealthTrend
49. Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 2014;11:20. https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/
50. Garthe I, Raastad T, Refsnes PE, Koivisto A, Sundgot-Borgen J. Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. Int J Sport Nutr Exerc Metab 2011;21(2):97–104. https://doi.org/10.1123/ijsnem.21.2.97
51. Craven J, McCartney D, Desbrow B, et al. Effects of Acute Sleep Loss on Physical Performance: A Systematic and Meta-Analytical Review. Sports Med 2022;52:2669–2690. https://link.springer.com/article/10.1007/s40279-022-01706-y
52. Nuckols G. How much does sleep loss affect strength performance? Stronger by Science (research spotlight on Craven 2022). https://www.strongerbyscience.com/research-spotlight-sleep-loss/
53. Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome? Front Physiol 2014;5:73. https://www.frontiersin.org/articles/10.3389/fphys.2014.00073/full
54. Plews DJ, Laursen PB, Le Meur Y, Hausswirth C, Kilding AE, Buchheit M. Monitoring training with heart-rate variability: how much compliance is needed for valid assessment? Int J Sports Physiol Perform 2014;9(5):783–790. https://journals.humankinetics.com/view/journals/ijspp/9/5/article-p783.xml
55. Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. Br J Sports Med 2016;50(5):281–291. https://pubmed.ncbi.nlm.nih.gov/26423706/
56. Strength Level. Lat Pulldown Standards (kg), community percentiles. https://strengthlevel.com/strength-standards/lat-pulldown/kg
57. Strength Level. Chest Press Standards (kg), community percentiles. https://strengthlevel.com/strength-standards/chest-press/kg
58. Strength Level. Seated Cable Row Standards (kg), community percentiles. https://strengthlevel.com/strength-standards/seated-cable-row/kg
59. Wilks coefficient (original and 2020 coefficients). Wikipedia, accessed 2026-11-08. https://en.wikipedia.org/wiki/Wilks_coefficient
60. DOTS Formula and Coefficients (DOTS; IPF GL coefficients; OpenPowerlifting bodyweight clamps). dotscalculator.online. https://dotscalculator.online/dots-calculation-methodology/
61. Sinclair coefficient (2017–2020 constants). Wikipedia, accessed 2026-11-08. https://en.wikipedia.org/wiki/Sinclair_coefficient
62. Starting Strength forum. Stall protocol (three consecutive misses → 10 % reset). https://startingstrength.com/resources/forum/general-programming/47586-stall-protocol-post859184.html
63. Wood TM, Maddalozzo GF, Harter RA. Accuracy of Seven Equations for Predicting 1-RM Performance of Apparently Healthy, Sedentary Older Adults. Meas Phys Educ Exerc Sci 2002;6(2):67–94 (abstract-level only: Mayhew, Epley and Wathan showed the lowest error; absolute errors high for all). https://doi.org/10.1207/S15327841MPEE0602_1
64. kalorie — nutrition tracker with a Kalman-filter calorie target and validated intervals (GitHub; implementation example, self-reported results). https://github.com/Alexandre-Reyob/kalorie
