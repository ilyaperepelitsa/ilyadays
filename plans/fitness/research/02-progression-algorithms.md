# 02 — Progression Algorithms an App Can Run Automatically

Research brief for the ilyadays fitness section. Date: 2026-11-08.
Scope: how the planner should pick the next session's targets from the last session's results, a survey of the published progression schemes (linear, GZCLP, 5/3/1, RTS/RPE autoregulation, e1RM-driven apps, RP set progression, myo-reps), and one fully specified recommended algorithm for the owner (machine-based, 3 days/week, strength-leaning, fat-loss phase, upper body + trunk first).

Audience: the owner, and the implementation agents who turn this into planner code and site content. Everything numeric below is either cited or explicitly labelled as a design default.

---

## Summary

1. **Progress by reps, then by load.** In an 8-week RCT in trained lifters, adding reps at a fixed load and adding load at fixed reps produced the same outcomes (strength +2.0 kg for load, 90% CI −2.4 to 7.8; rectus femoris +2.8 mm for reps, 90% CI −0.5 to 5.8) [2]. Double progression (fill a rep range, then step the weight) is therefore the correct default for machines whose pins move in 5 kg steps; the ACSM trigger is "1–2 reps over target on two consecutive sessions → +2–10% load" [1].
2. **Use RIR-based RPE as the brake and the calibration signal.** The scale (RPE 10 = 0 RIR, 9 = 1, 8 = 2) tracks bar speed at r = −0.88 [3]; RPE-selected loads matched or beat %1RM loads over 8 weeks (squat +17.1 vs +13.9 kg, ES 0.50, n.s.) [4]. But lifters under-predict reps in reserve by ~1 rep (0.95, 95% CI 0.17–1.73) and are more accurate on sets ≤ 12 reps [6] — so treat logged RIR as ±1 and keep all e1RM-feeding sets at ≤ 12 total reps (reps + RIR).
3. **Strength is insensitive to proximity to failure; hypertrophy is not** [7]. Compounds at RIR 2, isolation at RIR 1–2.
4. **e1RM in the background, Epley with RIR:** 1RM ≈ w × (1 + (reps + RIR)/30), valid for reps + RIR ≤ 10–12 [10][11][14]; keep one e1RM per exercise because reps at a given %1RM differ between exercises [12][13]. Use it to size jumps, sanity-check that the next load lands inside the rep range, and detect plateaus.
5. **Failure logic borrowed from the linear programs:** repeat the weight after a miss; after three failures at the same weight drop ~10%; when 2.5 kg jumps stall, microload (1.25 kg) or progress every 2–3 sessions [19][20][21]. GZCLP swaps rep schemes before dropping load (5×3+ → 6×2+ → 10×1+ → test a 5RM and restart at 85%) [22][23]; 5/3/1 progresses a 90% training max by +2.5/+5 kg per 3-week cycle and lowers it (3 increments) only after a full cycle of misses [24][25].
6. **Deload by reducing, never by stopping.** Practitioners deload 5–7 days every 4–6 weeks (survey means 5.6 wk / 6.4 d): fewer sets and reps, same frequency, slightly lower load, higher RIR, mostly pre-planned [36][37]. The only RCT found that a full week off mid-program cost strength with no hypertrophy benefit [35]. Default: every 4 weeks run a fatigue check; deload only if ≥ 2 of 4 indicators fire, hard cap 8 weeks; deload = sets × 0.5, load × 0.9, RIR ≥ 4.
7. **Gaps cost less than people fear.** Maximal strength shows only trivial losses for ≤ 28 days of no training [38][39]; a 10-week break was regained in ~5 weeks [40]; regain time ≈ half the layoff [39]. Reductions after gaps (−5% > 7 d, −10% > 14 d, re-test > 28 d) exist for RIR re-calibration and joint safety, not because strength is gone.
8. **Frequency is a volume-delivery tool.** With weekly sets equated, 2 vs 3 days gives the same hypertrophy [33] and strength [32]; volume has diminishing returns, steeper for strength [29][30][31]; one hard set per lift 2–3×/week still raises 1RM in trained men [34]. Going 3 → 2 days: keep ≥ 85% of weekly hard sets (primaries 3 → 4 sets, cut isolation first).
9. **Fat-loss phase:** at ~500 kcal/day deficit lean-mass gain ≈ 0 while strength gain is preserved [41]. Count holding e1RM (±2%) as success, prefer the rep lever, disable automatic volume additions, cap the deficit at ~500 kcal/day. Machines are a legitimate choice: no strength/hypertrophy difference vs free weights, gains specific to the trained modality [42].
10. **Recommended algorithm — "DP-RIR-4":** class-specific rep ranges (compounds 6–10 @ RIR 2, isolation 10–15 @ RIR 1–2), all sets at top of range → +1 equipment step; exceed by 2+ reps (or RIR ≥ target + 1) → jump to the e1RM-implied load (cap +10%); some sets short of top → hold and add a rep to the weakest set; any set below the floor → hold once, then −5%, then −10% + plateau check; one within-session RIR correction per exercise; equipment-aware rounding with a guard that the new load still allows ≥ rep_min at target RIR; 4-week deload check; explicit gap, substitution and 2-day rules. Full spec and JSON below.

---

## Publishable section

### How the planner decides your next set

Every workout app faces the same small decision hundreds of times a year: given what you did last time, what should you do today? Coaches answer it with judgment; a planner has to answer it with rules. The rules below are the ones with evidence behind them, and the places where the evidence runs out are marked as defaults.

**Two levers, one principle.** Progressive overload can be delivered by adding load at fixed reps, or by adding reps at a fixed load. When Plotkin and colleagues randomised 43 trained lifters to eight weeks of one or the other (four sets each of squats, leg extensions and two calf raises, twice a week, starting from a 10RM), the groups finished within noise of each other: dynamic strength favoured the load group by 2.0 kg (90% CI −2.4 to 7.8), rectus femoris thickness favoured the rep group by 2.8 mm (90% CI −0.5 to 5.8), and every other outcome differed by less than a millimetre or a percent [2]. The practical conclusion is that a rep gained at a fixed weight is real progress, which matters on machines where the next pin is 5 kg away. The ACSM position stand formalised the hand-off between the two levers: when you can perform one or two reps more than the target on two consecutive sessions, raise the load by 2–10% [1]. That is double progression, and it is the backbone of what follows.

**Effort is a measurement, not a feeling.** The RIR-based RPE scale defines RPE 10 as no reps left, 9 as one rep left, 8 as two, with half points between [3]. Zourdos et al. showed it tracks bar speed closely (r = −0.88 in experienced squatters, −0.77 in novices) [3], and Helms et al. then ran an 8-week head-to-head: lifters who chose loads to hit RPE targets gained as much or slightly more than lifters on fixed percentages (squat +17.1 vs +13.9 kg, bench +10.7 vs +9.6 kg; combined ES 0.48 with a 72% chance of a real advantage, not statistically significant) [4]. Powerlifters in the same programme of work landed within 0.33 ± 0.28 RPE of their targets when self-selecting loads [5]. The scale is not perfect: across 12 studies and 414 participants, people underestimated how many reps they had left by about 0.95 reps (95% CI 0.17–1.73), and the error grows on sets longer than about 12 reps [6]. Two design rules follow. Treat a logged RIR as ±1. And keep every set that feeds the maths at twelve reps or fewer.

**How close to failure.** A 2024 series of meta-regressions found that strength gains were essentially flat across a wide range of RIR, while hypertrophy improved as sets moved closer to failure [7]. For a strength-leaning plan this is good news: the compounds can live at RIR 2, which is repeatable and keeps the technique clean, and only the isolation work for pecs and arms needs to approach RIR 1.

**The estimated one-rep max.** Nearly every automated system works in e1RM. Epley's equation, 1RM ≈ w × (1 + reps/30), extended to count reps in reserve as reps not yet done, is what Liftosaur, Boostcamp and most spreadsheets use [14][15]. The NSCA/Landers chart is the classic lookup: 10 reps = 75%, 8 = 80%, 5 = 87%, 3 = 93% [10]. Two caveats. Prediction degrades beyond ten reps: a 5RM predicted 1RM with R² of 0.97–0.99 in a 70-person study whose authors advised using no more than 10 reps in linear equations [11]. And the reps you get at a given percentage depend on the exercise — squats allow more reps at 60% than bench or curls [12] — so the planner keeps one e1RM per exercise and never shares it between movements. A 2026 analysis of 303,494 near-failure sets from a consumer app found the same pattern at scale and proposed a load-dependent conversion that reduced inconsistency by 17–22% [13]; the lesson for an app is to let each exercise's own history calibrate its curve rather than trusting any single formula.

**The families of algorithms.** *Linear progression* (StrongLifts, Starting Strength) adds 2.5 kg every session (5 kg on the deadlift until that slows), repeats the weight after a miss, and after three failures at the same weight drops about 10% and climbs back [19][20]. When 2.5 kg jumps stall, you switch to 1.25 kg microplates and progress every second or third session [19][20][21]. It is the fastest way to find a novice's working weights, and it stops working within months.

*GZCLP* keeps the load and changes the rep scheme first: tier 1 runs 5×3+ → 6×2+ → 10×1+ (the original 2016 post used 3×5+ as the first stage), then tests a new 5RM and restarts at 85% of it; tier 2 runs 3×10 → 3×8 → 3×6 and restarts a little heavier; tier 3 is 3×15+ and only adds weight when the final set reaches 25 reps [22][23]. The "+" sets stop one or two reps short of failure and are capped at ten reps [22][23].

Wendler's *5/3/1* takes the opposite view: progress slowly from a deliberately low training max (90% of a 1RM estimated from a 3–5 rep set), run three weeks at 65/75/85, 70/80/90 and 75/85/95 percent with a final "as many as possible" set, then add 2.5 kg (upper body) or 5 kg (lower body) to the training max regardless of how the top sets went [24]. The training max is wrong if you cannot do "5 awesome reps" with it; when you stall for a whole cycle you drop it by three increments and stay at the lower number one cycle longer than you think [24][25].

*Reactive Training Systems* formalised autoregulation of volume. After working up to a top set at a target RPE, you keep doing sets until your estimated 1RM has fallen by a chosen fatigue percent; going from RPE 8 to RPE 9 at the same load and reps is roughly 5% [8]. The three ways of getting there are repeats (same load, RPE climbs), load drops (same reps, load cut 4–6% and repeated until RPE matches the top set) and rep drops (same load, fewer reps) [8][9]. Helms' thesis tested 2%, 4% and 6% "RPE stops" and measured weekly relative volume of 74.6, 88.4 and 114.4 units respectively — a way to dial volume by changing one number [5].

*Commercial apps* publish their logic to different degrees. Liftosaur exposes it as functions: `lp(increment, successes needed, …, decrement, failures needed)`, `dp(increment, minReps, maxReps)` and `sum(repThreshold, increment)`, plus Epley e1RM and equipment-aware rounding [14]. Boostcamp applies linear progression to fixed-rep sets and double progression to rep-range sets, uses the weakest set as the next rep target, raises the weight only when every set reaches the top of the range, holds if the logged RPE exceeds the prescription, and on a missed best set estimates a weight for the target reps and rounds it down to your step size (default step: twice your smallest plate) [15]. Alpha Progression recommends per set from your history and the current session, refuses impossible loads (a 7.5 → 10 kg dumbbell jump is 33%, so it asks for more reps first) and lets estimates fall after bad days [16]. JuggernautAI layers a readiness check (sleep, mood, energy, soreness) over RPE on top and back-off sets, adjusting volume and load from session to session and week to week; the formulas are proprietary, and the public advice is to rate conservatively and start blocks about one RPE under target [17][18]. Stronger by Science's templates move a training max up or down according to how far the last-set AMRAP beats its rep target, or according to last-set RIR [46].

*Renaissance Periodization* progresses volume rather than load. Each week the lifter scores soreness (1–4) and performance (1–4): two 1s add 2–3 sets, 2s add one set, a 3 with lingering soreness holds, a 4 on performance means a recovery session or deload; a mesocycle runs from a minimum effective volume toward a maximum recoverable volume and ends in a deload back to maintenance volume [26]. The scheme is coach heuristics rather than trial-tested, but it is the clearest written rule for the volume knob. *Myo-reps* and *rest-pause* compress volume into one activation set plus short-rest mini-sets of a few reps; in a 6-week trial rest-pause matched traditional sets for strength and produced more thigh growth and leg-press endurance [28]. They suit stable machine and isolation work and are a time tool, not a strength tool [27].

**Deloads.** Coaches deload for 5–7 days every 4–6 weeks [36], and a survey of 246 competitive lifters found means of 5.6 ± 2.3 weeks and 6.4 ± 1.7 days: fewer sets and reps, the same frequency, slightly less load, more reps in reserve, mostly pre-planned [37]. The only randomised test so far — a complete week off at the midpoint of a 9-week programme — produced no hypertrophy difference and smaller strength gains than training straight through [35]. The conclusion is to reduce rather than stop: half the sets, about 10% off the load, nothing below RIR 4. And make the deload conditional on evidence of fatigue rather than the calendar, with a hard cap at eight weeks.

**Plateaus and gaps.** Strength is remarkably stable through short breaks. A 103-study meta-analysis found trivial losses in maximal strength for up to 28 days, with steeper losses after that [38][39]; a trial with a 10-week break regained the lost strength and size within about five weeks of retraining [40]. Load reductions after a gap are for re-calibrating effort and protecting joints, not because the strength has evaporated; a return takes roughly half as long as the layoff [39]. A plateau is only real when a rolling e1RM has made no new high for several weeks despite completed sets — short-term fluctuations are normal [45] — and the fixes are ordered: smaller steps or a wider rep range, then a different rep range, then one more set, then a variant exercise.

**Frequency and the fat-loss phase.** When weekly sets are matched, two sessions and three produce the same hypertrophy [33] and the same strength [32]; frequency is a way of delivering volume, and volume has clear but diminishing returns, more so for strength [29][30][31]. A single hard set per lift two or three times a week still raises 1RM in trained men [34], which bounds how little a busy fortnight can get away with; and because strength declines faster than muscle mass with age, strength is the thing worth protecting first [43]. In a deficit near 500 kcal/day lean-mass gains flatten to zero while strength gains are preserved [41], so the planner should count holding e1RM as success and reach for the rep lever first. Machines are a legitimate choice: a 13-study meta-analysis found no difference between free weights and machines for strength or hypertrophy, with gains specific to the trained modality [42].

**What we chose.** Double progression within a class-specific rep range, RIR as a brake and calibration signal, e1RM in the background to size jumps and detect plateaus, a 4-week fatigue check that may or may not trigger a half-volume deload, and explicit rules for gaps, substitutions and 2-day weeks. The numbers are in the next section.

---

## Decision rules / parameters

### A. Effort scale and load tables

**RPE ↔ RIR** [3]:

| RPE | 10 | 9.5 | 9 | 8.5 | 8 | 7.5 | 7 | 6 | ≤5 |
|---|---|---|---|---|---|---|---|---|---|
| RIR | 0 | 0 (could add load) | 1 | 1–2 | 2 | 2–3 | 3 | 4 | 5+ |

**%1RM by max reps (RIR 0)** — NSCA/Landers chart [10]; 11 and 13–16 interpolated/extrapolated (Epley-consistent), label as approximate:

| RM | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| %1RM | 100 | 95 | 93 | 90 | 87 | 85 | 83 | 80 | 77 | 75 | 72.5 | 70 | 68 | 67 | 65 | 64 |

**RIR shift rule:** `%1RM(reps @ RIR r) = %1RM_table[reps + r]`. Example: 8 reps @ RIR 2 ≈ the 10RM load ≈ 75%.

**Planner-internal formulas (Epley, self-consistent in both directions):**

```
e1rm(load, reps, rir)        = load * (1 + (reps + rir) / 30)          # only if reps + rir <= 12
load_for(e1rm, reps, rir)    = e1rm / (1 + (reps + rir) / 30)
predicted_total_reps(e1rm,w) = 30 * (e1rm / w - 1)                     # reps to failure at load w
predicted_reps_at_rir(e1rm,w,rir) = predicted_total_reps(e1rm, w) - rir
```

Epley at 10 reps = 75% matches the chart exactly; it is 1–2 points lower than the chart at 5–8 reps. Pick one representation per code path (we use Epley internally and show the chart to the user) [10][11][14].

**Exercise-specificity:** reps at a given %1RM differ by exercise (large-muscle lifts allow more) [12]; a 303,494-set dataset shows the reps→%1RM factor also depends on the absolute load [13]. Therefore: one e1RM per exercise; never derive one exercise's load from another's e1RM except through the substitution priors in section F.

**Evidence on which proximity to failure to target** [7]: strength ≈ flat across RIR 0–4+; hypertrophy improves closer to failure. **RIR accuracy** [6]: mean under-prediction 0.95 reps; worse above ~12 reps; so tolerance ±1 RIR, no e1RM math on sets > 12 total reps.

### B. Progression families — pseudocode and parameters

**B1. Double progression (generic)** [1][2][15][14]

```
inputs: sets[] = {reps, rir}, load, R_min, R_max, step
if all(s.reps >= R_max for s in sets):           load = next_step(load); target_reps = R_min
elif any(s.reps < R_min for s in sets):          misses += 1
                                                   if misses >= 2: load = round_down(load * 0.90); misses = 0
else:                                             hold load; target_reps = min(s.reps) + 1   # weakest set drives the target
```
Boostcamp's variant: weight rises only when *every* set hits the top; RPE above prescription holds weight and reps; a missed best set triggers an estimate of the load that fits the target reps, rounded *down* to the step [15]. Liftosaur: `dp(weightIncrease, minReps, maxReps)`; `sum(repsThreshold, weightIncrease)` raises load when total reps across sets exceed a threshold (e.g. `sum(30, 5lb)` on 3×10+) [14].

**B2. Linear progression with micro-loading and reset (StrongLifts family)** [19][20][21]

```
increment = 2.5 kg (squat/bench/press/row); deadlift 5 kg until it slows, then 2.5 kg
if all sets complete (5x5):      load += increment
else:                            repeat load next session; fails_at_load += 1
if fails_at_load >= 3:           load = round_down(load * 0.90); fails_at_load = 0   # "about 10%"
if deloads_at_same_wall >= 2:    increment = 1.25 kg (fractional plates 0.5/0.25/0.125 kg) and/or progress every 2–3 sessions
                                 and/or switch 5x5 -> top set + back-off sets
```
Liftosaur's `lp(weightIncrease, increaseAttempts, currentIncreaseAttempt, weightDecrease, decreaseAttempts, currentDecreaseAttempt)` encodes exactly this (e.g. `lp(5lb, 2, 1, 10lb, 3)` = +5 lb after 2 successes, −10 lb after 3 failures) [14].

**B3. GZCLP tiers** [22][23]

```
T1 (main lift):  stages = [5x3+, 6x2+, 10x1+]   # original 2016 post: [3x5+, 6x2+, 10x1+]
                 each session: if total reps met -> load += (2.5 kg upper | 5 kg lower); else stage += 1 at same load
                 after failing 10x1+: rest 2–3 days, test new 5RM, restart stage 0 at 85% of the 5RM
                 AMRAP: stop 1–2 reps short of failure, cap 10 reps
T2 (secondary):  stages = [3x10, 3x8, 3x6]; fail -> next stage at same load
                 after failing 3x6: restart 3x10 at last stage-0 load + 7–9 kg (no more than +9 kg)
T3 (accessory):  3x15+; add load when the AMRAP set reaches 25 reps
rest: T1 3–5 min, T2 2–3 min, T3 60–90 s
```

**B4. Wendler 5/3/1 training-max cycles** [24][25]

```
TM = 0.90 * e1rm_from_3to5_rep_set
week1: 65% x5, 75% x5, 85% x5+     week2: 70% x3, 80% x3, 90% x3+     week3: 75% x5, 85% x3, 95% x1+
back-off (FSL): 5x5 at the day's first-set percentage
after each 3-week cycle: TM += 2.5 kg (bench/press) | 5 kg (squat/deadlift), regardless of AMRAP reps
if prescribed reps are missed across a FULL cycle: TM -= 3 increments (7.5 kg upper | 15 kg lower); stay there one extra cycle
TM test (every ~3 cycles): 5 strong reps at TM. If in doubt, the TM is too high.
```

**B5. RPE/RIR autoregulation (RTS fatigue percents, RPE stops)** [5][8][9]

```
top = work up to planned reps at target RPE (e.g. 5 @ RPE 8); e1rm_top = e1rm(top)
fatigue% options: 0 (none) | 2 (minimal) | 5 (moderate) | 7 (high); 4–6% is the all-round default
mapping: same load & reps, RPE 8 -> 9  ≈ 5% fatigue
repeats:   same load, same reps; stop when RPE reaches target + mapped delta
load drop: load *= (1 - 0.04..0.06); same reps; repeat until RPE equals the top set's RPE
rep drop:  same load, fewer reps; stop when e1rm has fallen by fatigue%
RPE stops (Helms): 2% / 4% / 6% drop from the first set's load -> weekly relative volume 74.6 / 88.4 / 114.4 (sets x reps x %1RM)
```

**B6. e1RM-driven progression (Liftosaur / Boostcamp / Alpha Progression / JuggernautAI patterns)** [13][14][15][16][17][18][46]

```
per session: e1rm_s = max over working sets with reps+rir <= 12 of e1rm(load, reps, rir)
e1rm_hat   = median(e1rm_s over last 3 sessions)            # robust to one bad day
next_load  = round_down(load_for(e1rm_hat, target_reps, rir_target), achievable_loads)
brakes:    logged RPE > prescribed -> hold (Boostcamp); readiness low -> reduce volume/load (JuggernautAI)
big-jump guard (Alpha): if next achievable step is a large % jump, ask for more reps at current load first
AMRAP-driven TM (SBS RTF): reps over the last-set target -> TM up; under -> TM down
```

**B7. Renaissance Periodization set progression** [26]

```
per-session MEV check (0–2 each): pump, muscle challenge, soreness; total 0–1 below MEV, 2–4 at MEV, 5–6 above
weekly per muscle: soreness 1–4 (1 none … 4 still sore at next session), performance 1–4 (1 exceeded … 4 below last week)
both 1s -> +2–3 sets | 2s or 1–2 mix -> +1 set | any 3 with soreness 3–4 -> hold | performance 4 -> recovery session / deload
mesocycle example: 12 -> 14 -> 16 -> 18 -> 20 sets/week, then deload to ~6 (MV)
```

**B8. Myo-reps / rest-pause (brief)** [27][28]

```
activation set: high reps (commonly 9–20) to ~RIR 1 at the working load
rest 3–5 breaths (~10–20 s); mini-sets of a fixed small count (commonly 3–5 reps) at the same load
stop when a mini-set falls short of the target or after the planned number (3–5) of mini-sets
progress: add load when all planned mini-sets are completed
use for isolation/machine work only; evidence: similar strength to straight sets, more hypertrophy/endurance in one 6-week trial
```

### C. Next-session targets from last session (rule table)

Applied per exercise, over all working sets; `R_min..R_max` = class rep range; `RIR_t` = class target; `step` = next achievable equipment load.

| Observed | Action | Rationale |
|---|---|---|
| All sets ≥ R_max **and** mean RIR ≥ RIR_t − 1 | **+1 step**; rep target → R_min | ACSM 2–10% [1]; Boostcamp "all sets at top" [15] |
| All sets ≥ R_max + 2, **or** all ≥ R_max with mean RIR ≥ RIR_t + 1 | **Big jump:** load = round_down(load_for(e1rm_s, R_min, RIR_t)), at least 2 steps, **cap +10%** | e1RM-implied sizing [14][15][46]; GZCLP T3 25-rep rule is the same idea [22] |
| All sets ≥ R_min, not all at R_max | **Hold** load; next rep target = min(reps) + 1 | rep progression is real progress [2]; weakest-set rule [15] |
| Any set < R_min, or any set at RIR 0 when RIR_t ≥ 2 | **Miss #1: hold** (no change). **Miss #2 (consecutive): −5%**, rep target R_min. **Miss #3: −10%** and raise a plateau check | repeat-then-deload pattern [19][20]; three strikes [20] |
| Logged RIR on the calibration set ≥ RIR_t + 2 | within-session: remaining sets +1 step (once) | RPE as load selector [4][5] |
| Logged RIR on the calibration set ≤ RIR_t − 2, or reps < R_min | within-session: remaining sets −1 step (≈ −5%) (once) | RPE as brake [15][18] |
| **Guard** after any increase: predicted_reps_at_rir(e1rm_s, new_load, RIR_t) < R_min | do not jump; widen range to R_max + 2 and hold | avoids landing below the range on coarse steps [16] |

Consecutive-miss counters reset on any successful "hold" or "progress" session. During a deload week no evaluation runs (Liftosaur `progress: none` pattern) [14].

### D. Increments, rounding and plate math

**Why step size matters (derived from Epley):** a load jump is safe only if the new load still allows ≥ R_min reps at RIR_t when you were at R_max at RIR_t:

```
max_step_fraction = (30 + R_max + RIR_t) / (30 + R_min + RIR_t) - 1
6–10 @ RIR 2 -> 42/38 - 1 = 10.5%     8–12 @ RIR 2 -> 44/40 - 1 = 10.0%
10–15 @ RIR 2 -> 47/42 - 1 = 11.9%    6–8  @ RIR 2 -> 40/38 - 1 = 5.3%
rule of thumb: each rep of range width buys ≈ 2.5% of step; needed_width ≈ step% / 2.5
```
So a 5 kg pin on a 40 kg stack (12.5%) needs either add-on plates or a 5-rep-wide range (e.g. 8–13). A 2.5 kg step on a 60 kg load (4.2%) is fine with 6–10.

**Equipment model (configure per gym, store with the exercise):**

| Equipment | Achievable loads | Default step | Micro option | Rounding |
|---|---|---|---|---|
| Selectorized machine | `base + k·step` ∪ `{l + a : a ∈ addons}` | 5 kg (10 lb ≈ 4.5 kg on US stacks) | add-on 1.25 / 2.5 kg plates or the machine's half-step pin | down |
| Plate-loaded machine | like barbell without the bar (or with the carriage mass as "bar") | 2.5 kg (1.25 per side) | 0.5 kg microplates → 1 kg | down |
| Dumbbells | gym inventory, typically 2 kg steps to 10–12 kg then 2.5 kg | 2–2.5 kg per hand | magnetic 0.5–1.25 kg add-ons | down |
| Barbell | `20 + 2·Σ(pairs)`, pairs from {25, 20, 15, 10, 5, 2.5, 1.25} (+ 0.5, 0.25 micro) | 2.5 kg | 0.5 kg pair → 1 kg; 0.25 kg pair → 0.5 kg | down |

```
achievable(equipment) -> sorted list L
round_down(x, L)      -> max(l in L with l <= x)          # progression and deload both round DOWN (conservative)
next_step(x, L, k=1)  -> k-th element of L above x
plate_math(target, bar=20, pairs=[25,20,15,10,5,2.5,1.25]):
    side = (target - bar) / 2; result = []
    for p in pairs: while side >= p - 1e-9 and inventory[p] > 0: result.append(p); side -= p; inventory[p] -= 1
    if side > 1e-9: return not_exact -> use round_down(target)   # e.g. 77.5 = 20 + 2*(25+2.5+1.25)
```
Boostcamp's default step is twice the smallest plate; Alpha Progression only recommends loads you actually own [15][16]. Dumbbell jumps of 20–33% at light loads should be handled with wider ranges (12–20) or micro add-ons rather than by "jumping and failing" [16].

### E. Initialising a new exercise (first session = test session)

```
guess = (related exercise known) ? ratio_prior * load_for(e1rm_related, R_min, RIR_t + 2)
                                 : lightest sensible load (machine: low pin; DB: 25–30% bodyweight-based guess)
ramp:  10 reps @ 40% guess -> 6 reps @ 60% -> 3 reps @ 80% (rest 60–120 s), log RIR each set
       if the 3-rep set is RIR <= 4, stop ramping; else +10–15% and repeat the 3-rep set
test set: at ~90–100% of guess, reps until RIR 2, HARD CAP 12 reps.
       if cap reached with RIR >= 2: rest 3 min, +10%, repeat (max 2 retests)
e1rm_0 = e1rm(load, reps, 2)                       # total reps = reps + 2, must be <= 12
first working load = round_down(load_for(e1rm_0, R_min, RIR_t + 1))   # one extra RIR of margin
calibration mode for the next 2 sessions: within-session corrections allowed up to 2 steps; "miss" does not count
```
Why ≤ 12 total reps: 5RM-based prediction R² 0.97–0.99 vs lower for 10RM/20RM; "no more than 10 reps in linear equations" [11]; RIR accuracy degrades above ~12 reps [6]. Why RIR 2 not failure: the test should be repeatable and safe; the chart handles the shift [10].

### F. Exercise substitution

Strength is modality-specific (free-weight tests favour free-weight training, SMD −0.21; machine tests favour machines) [42], and machine load scales are not comparable across brands. Therefore:

```
k = 0.85 same movement pattern & same machine type (e.g. two selectorized chest presses)
  = 0.75 same pattern, different modality (selectorized <-> plate-loaded <-> barbell/DB)
  = 0.60 different pattern, same muscle group (e.g. lat pulldown -> seated row)      # design defaults
start_load = round_down(load_for(k * e1rm_old, R_min, RIR_t + 1)); run section E's calibration mode (2 sessions)
after 2 sessions store ratio_pair = e1rm_new / e1rm_old; reuse it next time the user swaps between these two exercises
```
The 0.85/0.75/0.60 priors are heuristics (no study estimates them); the learned per-user ratios replace them after one swap.

### G. Deload design

Practice: 5–7 days every 4–6 weeks; sets and reps cut, frequency kept, load slightly lower, RIR higher, mostly pre-planned, sometimes triggered by stalls or aches [36][37][44]. Evidence: a full week off mid-programme gave no hypertrophy benefit and smaller strength gains [35]. Hence **volume deload with mostly maintained intensity, triggered by indicators, with a calendar cap**.

```
every 4 weeks (end of block), compute deload_points:
  +1 if < 50% of primary exercises set a new block-high e1rm_hat (>= +1% vs previous block)
  +1 if >= 3 miss events across primaries in the last 2 weeks
  +1 if mean logged RIR over the last 6 sessions <= RIR_t - 1 while mean reps did not rise (effort creep)
  +1 if self-rated readiness <= 2/5 in >= 50% of the last 6 sessions, or a joint-pain flag is set
deload if points >= 2, or if weeks_since_last_deload >= 8 (>= 6 in a fat-loss phase), or on user request
deload week: same exercises & frequency; sets = ceil(0.5 * sets); load = round_down(0.90 * load); reps = R_min;
             RIR >= 4; no AMRAP; no progression evaluation
after deload: resume pre-deload loads; first session back uses RIR_t + 1 as target (re-calibration), then normal
volume vs intensity: keep one top set at ~90% of normal load for strength retention; cut sets, not frequency [35][37]
```

### H. Plateau detection

```
e1rm_hat(exercise) = median of the last 3 sessions' e1rm_s
plateau if: no new high in e1rm_hat vs the previous 6 sessions, AND >= 4 weeks elapsed, AND >= 1 hold/miss in the window
response ladder (one change per block, re-evaluate after 4 weeks):
  1. equipment: step% > 7.5%  -> microload or widen range (R_max + 2)
  2. shift rep range one notch (6–10 -> 10–15 or -> 4–6) at the same e1rm
  3. +1 set/week on that exercise (max +2) if deload_points <= 1
  4. swap to a variant (section F)
  5. if in a caloric deficit: success = e1rm_hat within ±2% of block start [41]
  6. review sleep, nutrition, technique (fatigue vs stimulus vs technique diagnosis) [45]
```
Short-term fluctuations are normal and are not plateaus [45].

### I. Missed sessions and gaps (per exercise, days since last performance)

Context: trivial strength loss ≤ 28 days, accelerating after [38][39]; 10-week break regained in ~5 weeks [40]; regain time ≈ half the layoff [39]. The reductions below are for RIR re-calibration and safety.

| Gap | Load for first session back | Extras |
|---|---|---|
| ≤ 7 days | unchanged | — |
| 8–14 days | −5% (one step) | misses not counted that session |
| 15–28 days | −10% | calibration mode 2 sessions |
| 29–90 days | re-test (section E) starting at 80% of the old working load | ramp: weeks_to_regain ≈ weeks_off / 2; weekly increase ≈ (old_load − restart_load) / (weeks_to_regain − 1) [39] |
| > 90 days | treat as new exercise; prior = 0.7 × old e1rm | — |

### J. Adjusting from 3 to 2 days per week

Evidence: equal weekly volume → equal hypertrophy [33] and strength [32]; strength ES by frequency 0.74/0.82/0.93/1.08 for 1/2/3/4+ days but not significant once volume is equated [32]; volume returns diminish, faster for strength [31]; low (<5) weekly sets underperform medium (5–9) and high (10+) [30]; minimum effective dose = 1 hard set per lift, 2–3×/week [34].

```
target: keep >= 85% of the 3-day weekly hard sets per muscle
primaries: 3 -> 4 sets per session (same rep range); secondary compounds: keep 3 sets
isolation: keep one exercise per muscle at 2 sets; drop the second accessory first
caps: <= 10 hard sets per muscle per session; session <= 75 min (drop isolation first when over)
split: upper A / upper B (or full-body when legs are added) so each muscle is still hit twice a week
if a week has only ONE session: run the two primaries per muscle group at 3 sets, RIR 2; skip isolation (maintenance dose [34])
```

### K. Fat-loss phase modifiers

Lean-mass gain ≈ 0 at ~500 kcal/day deficit; strength preserved (ES −0.31, n.s.) [41]. Rep progression is a valid overload [2]; strength does not need RIR 0 [7].

```
deficit cap ~500 kcal/day; success = e1rm_hat within ±2% (maintenance) or better
volume additions (RP-style) disabled; if deload_points >= 2 twice within 8 weeks -> sets *= 0.8 for the next block
RIR targets: compounds 2 (unchanged); isolation 1.5
expect: more "hold" outcomes; the planner must present "hold" as success in a deficit
```

### L. Recommended algorithm card — "DP-RIR-4" (double progression + RIR autoregulation + 4-week deload check)

```
CLASSES (owner defaults; no legs at first)
  primary_compound   6–10 reps, RIR 2 (tolerance ±1), 3 sets, rest 150–180 s
                     e.g. machine chest press, lat pulldown, chest-supported/seated row, machine shoulder press
  secondary_compound 8–12 reps, RIR 2, 3 sets, rest 90–120 s        e.g. incline machine press, assisted dip/pull-up
  isolation          10–15 reps, RIR 1.5, 2 sets, rest 60–90 s      e.g. pec-deck, cable curl, pushdown, lateral/rear-delt raise
  trunk_strength     8–12 reps loaded, RIR 2, 3 sets, rest 90–120 s e.g. cable crunch, weighted knee raise, ab machine, back extension

LOG per set: load, reps, RIR (0–5, halves allowed); per session: readiness 1–5 (optional), joint-pain flag

SESSION (per exercise)
  1. load = planned_load (after gap rule I, deload rule G)
  2. set 1 = calibration: RIR >= RIR_t + 2 -> remaining sets next_step(load); RIR <= RIR_t - 2 or reps < R_min -> remaining sets prev_step(load)
     (max one correction; if corrected and >= 2 sets done at the corrected load, evaluate those sets)
  3. e1rm_s = max over sets with reps+RIR <= 12 of e1rm(); e1rm_hat = median(last 3 sessions)

NEXT-SESSION DECISION (table C): progress (+1 step) | big jump (e1rm-implied, >= 2 steps, cap +10%) | hold (+1 rep on weakest set)
  | miss #1 hold | miss #2 -5% | miss #3 -10% + plateau check; guard: predicted_reps_at_rir(e1rm_s, new_load, RIR_t) >= R_min else widen range

ROUNDING (section D): equipment list per exercise; round DOWN; if step% > max_step_fraction(range) -> microload or widen range

INIT / SUBSTITUTION (sections E, F): ramp -> test set to RIR 2 (<= 12 total reps) -> Epley -> first load at RIR_t + 1; priors 0.85/0.75/0.60

BLOCK (4 weeks): deload check (section G): >= 2 of 4 indicators -> deload week (sets x0.5, load x0.9, RIR >= 4); cap 8 weeks (6 in deficit)
PLATEAU (section H) per exercise; GAPS (section I); 2-DAY WEEKS (section J); DEFICIT (section K)
```

---

## progression_rules (machine-readable)

```json
{
  "schema": "ilyadays.fitness.progression_rules",
  "version": "1.0.0",
  "generated": "2026-11-08",
  "algorithm": "dp_rir_4",
  "units": { "load": "kg", "time": "s" },
  "rpe_to_rir": [
    { "rpe": 10, "rir": 0 },
    { "rpe": 9.5, "rir": 0.5 },
    { "rpe": 9, "rir": 1 },
    { "rpe": 8.5, "rir": 1.5 },
    { "rpe": 8, "rir": 2 },
    { "rpe": 7.5, "rir": 2.5 },
    { "rpe": 7, "rir": 3 },
    { "rpe": 6, "rir": 4 },
    { "rpe": 5, "rir": 5 }
  ],
  "rir_logging": { "min": 0, "max": 5, "step": 0.5, "assumed_error_reps": 1 },
  "e1rm": {
    "formula": "epley_rir",
    "expression": "load * (1 + (reps + rir) / 30)",
    "inverse_expression": "e1rm / (1 + (reps + rir) / 30)",
    "predicted_reps_at_rir": "30 * (e1rm / load - 1) - rir",
    "valid_if_total_reps_lte": 12,
    "preferred_total_reps_lte": 10,
    "smoothing": { "method": "median", "window_sessions": 3 },
    "per_exercise_only": true
  },
  "percent_1rm_by_rm": {
    "1": 100, "2": 95, "3": 93, "4": 90, "5": 87, "6": 85, "7": 83, "8": 80, "9": 77, "10": 75,
    "11": 72.5, "12": 70, "13": 68, "14": 67, "15": 65, "16": 64
  },
  "percent_1rm_rir_shift_rule": "percent_1rm(reps, rir) = percent_1rm_by_rm[reps + rir]",
  "exercise_classes": {
    "primary_compound": { "rep_range": [6, 10], "rir_target": 2, "rir_tolerance": 1, "sets": 3, "rest_s": [150, 180],
      "examples": ["machine chest press", "lat pulldown", "seated cable row", "chest-supported row", "machine shoulder press"] },
    "secondary_compound": { "rep_range": [8, 12], "rir_target": 2, "rir_tolerance": 1, "sets": 3, "rest_s": [90, 120],
      "examples": ["incline machine press", "assisted dip", "assisted pull-up", "pulldown variant"] },
    "isolation": { "rep_range": [10, 15], "rir_target": 1.5, "rir_tolerance": 1, "sets": 2, "rest_s": [60, 90],
      "examples": ["pec-deck", "cable curl", "triceps pushdown", "lateral raise", "rear-delt fly"] },
    "trunk_strength": { "rep_range": [8, 12], "rir_target": 2, "rir_tolerance": 1, "sets": 3, "rest_s": [90, 120],
      "examples": ["cable crunch", "weighted hanging knee raise", "ab machine", "loaded back extension"] }
  },
  "next_session_rules": {
    "evaluate_on": "all_working_sets",
    "progress": { "condition": "all_sets_reps >= rep_max AND mean_rir >= rir_target - 1", "action": "load_up_steps", "steps": 1, "new_rep_target": "rep_min" },
    "big_jump": { "condition": "all_sets_reps >= rep_max + 2 OR (all_sets_reps >= rep_max AND mean_rir >= rir_target + 1)",
      "action": "load_to_e1rm_target", "formula": "round_down(e1rm_session / (1 + (rep_min + rir_target) / 30))", "min_steps": 2, "cap_pct": 10, "new_rep_target": "rep_min" },
    "hold": { "condition": "all_sets_reps >= rep_min AND NOT progress", "action": "same_load", "next_rep_target": "min_reps + 1" },
    "miss": { "condition": "any_set_reps < rep_min OR (any_set_rir == 0 AND rir_target >= 2)",
      "consecutive_actions": [
        { "n": 1, "action": "same_load" },
        { "n": 2, "action": "load_down_pct", "pct": 5, "new_rep_target": "rep_min" },
        { "n": 3, "action": "load_down_pct", "pct": 10, "flag": "plateau_check" }
      ],
      "counter_resets_on": ["hold", "progress", "big_jump"] },
    "post_increase_guard": { "expression": "30 * (e1rm_session / new_load - 1) - rir_target", "must_be_gte": "rep_min", "else": "widen_rep_max_by_2_and_hold" }
  },
  "within_session_autoregulation": {
    "calibration_set_index": 1,
    "too_easy": { "condition": "rir_set1 >= rir_target + 2", "action": "remaining_sets_next_step" },
    "too_hard": { "condition": "rir_set1 <= rir_target - 2 OR reps_set1 < rep_min", "action": "remaining_sets_prev_step" },
    "max_adjustments_per_exercise": 1,
    "evaluate_corrected_sets_if_count_gte": 2
  },
  "increments": {
    "rounding": "down",
    "machine_stack": { "default_step_kg": 5, "us_stack_step_kg": 4.5, "addon_plates_kg": [1.25, 2.5], "use_addon_if_step_pct_gt": 5 },
    "plate_loaded_machine": { "min_step_kg": 2.5, "micro_pairs_kg": [0.5] },
    "dumbbell": { "typical_inventory_kg": [2, 4, 6, 8, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40], "micro_addon_kg": [0.5, 1.0, 1.25], "configure_per_gym": true },
    "barbell": { "bar_kg": 20, "plate_pairs_kg": [25, 20, 15, 10, 5, 2.5, 1.25], "micro_pairs_kg": [0.5, 0.25], "min_step_kg": 2.5 },
    "max_step_fraction_formula": "(30 + rep_max + rir_target) / (30 + rep_min + rir_target) - 1",
    "max_step_fraction_examples": { "6-10@2": 0.105, "8-12@2": 0.100, "10-15@2": 0.119, "6-8@2": 0.053 },
    "needed_range_width_rule": "range_width >= step_pct / 2.5"
  },
  "initialization": {
    "guess": { "from_related": "ratio_prior * e1rm_related / (1 + (rep_min + rir_target + 2) / 30)", "fallback": "lightest_sensible_load" },
    "ramp": [ { "pct_of_guess": 0.4, "reps": 10 }, { "pct_of_guess": 0.6, "reps": 6 }, { "pct_of_guess": 0.8, "reps": 3 } ],
    "ramp_rest_s": [60, 120],
    "ramp_stop_when": "rir_of_3rep_set <= 4",
    "test_set": { "pct_of_guess": [0.9, 1.0], "stop_at_rir": 2, "rep_cap": 12, "retest_if_cap_with_rir_gte": 2, "retest_load_pct": 10, "retest_rest_s": 180, "max_retests": 2 },
    "first_working_load": "round_down(e1rm_0 / (1 + (rep_min + rir_target + 1) / 30))",
    "calibration_sessions": 2,
    "calibration_rules": { "max_steps_per_session": 2, "count_misses": false }
  },
  "substitution": {
    "priors": { "same_pattern_same_machine_type": 0.85, "same_pattern_different_modality": 0.75, "different_pattern_same_muscle": 0.60 },
    "start_load": "round_down(k * e1rm_old / (1 + (rep_min + rir_target + 1) / 30))",
    "calibration_sessions": 2,
    "learn_ratio_after_sessions": 2,
    "ratio_storage": "per ordered exercise pair, per user"
  },
  "deload": {
    "check_every_weeks": 4,
    "points_required": 2,
    "indicators": [
      { "id": "stalled_e1rm", "rule": "fewer than 50% of primary exercises set a new block-high e1rm_hat (>= +1% vs previous block)" },
      { "id": "misses", "rule": ">= 3 miss events across primary exercises in the last 2 weeks" },
      { "id": "rir_drift", "rule": "mean logged RIR over last 6 sessions <= rir_target - 1 while mean reps did not rise" },
      { "id": "readiness", "rule": "readiness <= 2 of 5 in >= 50% of last 6 sessions OR joint_pain_flag" }
    ],
    "max_weeks_without_deload": 8,
    "max_weeks_without_deload_fat_loss": 6,
    "user_request_triggers": true,
    "deload_week": { "keep_exercises": true, "keep_frequency": true, "sets_multiplier": 0.5, "sets_round": "ceil", "load_multiplier": 0.9, "reps": "rep_min", "min_rir": 4, "amrap": false, "progression_evaluation": false, "keep_one_top_set_at_load_multiplier": 0.9 },
    "after_deload": { "resume_loads": "pre_deload", "first_session_rir_target_bonus": 1 }
  },
  "plateau": {
    "metric": "median e1rm_s over last 3 sessions",
    "detect": { "no_new_high_vs_previous_sessions": 6, "min_weeks_elapsed": 4, "min_hold_or_miss_events_in_window": 1 },
    "ladder": [
      { "step": 1, "if": "step_pct > 7.5", "action": "microload_or_widen_rep_max_by_2" },
      { "step": 2, "action": "shift_rep_range_one_notch_for_one_block" },
      { "step": 3, "if": "deload_points <= 1", "action": "add_1_set_per_week", "max_added_sets": 2 },
      { "step": 4, "action": "swap_to_variant_exercise" },
      { "step": 5, "if": "in_caloric_deficit", "action": "success_is_maintenance_within_pct", "pct": 2 },
      { "step": 6, "action": "review_sleep_nutrition_technique" }
    ],
    "one_change_per_block": true
  },
  "gaps": {
    "measure": "days_since_last_session_of_exercise",
    "tiers": [
      { "max_days": 7, "load_multiplier": 1.0 },
      { "max_days": 14, "load_multiplier": 0.95, "no_miss_penalty_sessions": 1 },
      { "max_days": 28, "load_multiplier": 0.90, "calibration_sessions": 2 },
      { "max_days": 90, "action": "re_test", "start_multiplier_of_old_working_load": 0.80 },
      { "max_days": null, "action": "treat_as_new", "prior_multiplier_of_old_e1rm": 0.70 }
    ],
    "ramp_back": { "weeks_to_regain": "weeks_off / 2", "weekly_increase": "(pre_break_load - restart_load) / max(1, weeks_to_regain - 1)" }
  },
  "frequency_change": {
    "from_days_per_week": 3,
    "to_days_per_week": 2,
    "weekly_hard_sets_retention_target": 0.85,
    "primary_sets_per_session": { "from": 3, "to": 4 },
    "secondary_sets_per_session": 3,
    "isolation": { "keep_one_exercise_per_muscle": true, "sets": 2 },
    "drop_order": ["second accessory", "isolation third set", "secondary compound third set"],
    "per_muscle_per_session_hard_set_cap": 10,
    "session_time_cap_min": 75,
    "split": "upper A / upper B (full-body once legs are added)",
    "single_session_week": { "primaries_per_muscle": 2, "sets": 3, "rir_target": 2, "skip_isolation": true }
  },
  "fat_loss_modifiers": {
    "max_deficit_kcal_per_day": 500,
    "success_definition": "e1rm_hat within ±2% of block start counts as maintained",
    "volume_additions_enabled": false,
    "sets_multiplier_if_two_deload_triggers_in_8_weeks": 0.8,
    "rir_targets": { "primary_compound": 2, "secondary_compound": 2, "isolation": 1.5, "trunk_strength": 2 },
    "prefer": "rep_progression_before_load_progression"
  },
  "volume_knob_optional_rp_style": {
    "enabled_outside_deficit": true,
    "weekly_scores": { "soreness": [1, 4], "performance": [1, 4] },
    "rules": { "both_1": "+2 sets (planner uses +1 for machines)", "twos_or_mix_1_2": "+1 set", "any_3_with_soreness_3_or_4": "hold", "performance_4": "recovery session or deload" },
    "max_added_sets_per_muscle_per_block": 2
  },
  "alternative_methods": {
    "linear_stronglifts": { "increment_kg": 2.5, "deadlift_increment_kg": 5, "fails_before_deload": 3, "deload_pct": 10, "microload_kg": 1.25, "progress_every_n_sessions_options": [1, 2, 3, 5] },
    "gzclp": { "t1_stages": ["5x3+", "6x2+", "10x1+"], "t1_original_first_stage": "3x5+", "t1_reset": "test 5RM, restart at 85%", "t2_stages": ["3x10", "3x8", "3x6"], "t2_restart": "last stage-1 load + 7 to 9 kg", "t3": "3x15+; add load when AMRAP >= 25", "increment_kg": { "upper": 2.5, "lower": 5 }, "amrap_cap_reps": 10, "amrap_rir": [1, 2] },
    "wendler_531": { "tm_fraction_of_1rm": 0.90, "week_percents": [[65, 75, 85], [70, 80, 90], [75, 85, 95]], "week_reps": [["5", "5", "5+"], ["3", "3", "3+"], ["5", "3", "1+"]], "fsl_backoff": "5x5 at first-set percent", "tm_increment_kg": { "upper": 2.5, "lower": 5 }, "tm_reduce_after_full_cycle_misses_increments": 3, "tm_test": "5 strong reps at TM", "stay_lower_extra_cycles": 1 },
    "rts_fatigue_percents": { "options_pct": [0, 2, 5, 7], "all_round_pct": [4, 6], "load_drop_pct": [4, 6], "rpe_8_to_9_equals_pct": 5, "methods": ["repeats", "load_drop", "rep_drop"], "rpe_stops_pct_studied": [2, 4, 6] },
    "myo_reps": { "activation_reps": [9, 20], "activation_rir": 1, "rest_breaths": [3, 5], "mini_set_reps": [3, 5], "max_mini_sets": 5, "stop": "mini-set falls short of target", "progress": "add load when all mini-sets completed", "use_for": ["isolation", "machine"] }
  }
}
```

---

## Sources

1. American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 41(3):687–708, 2009. https://pubmed.ncbi.nlm.nih.gov/19204579/
2. Plotkin D, Coleman M, Van Every D, et al. Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. *PeerJ* 10:e14142, 2022. https://peerj.com/articles/14142
3. Zourdos MC, Klemp A, Dolan C, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. *J Strength Cond Res* 30(1):267–275, 2016. https://doi.org/10.1519/JSC.0000000000001049
4. Helms ER, Byrnes RK, Cooke DM, et al. RPE vs. percentage 1RM loading in periodized programs matched for sets and repetitions. *Front Physiol* 9:247, 2018. https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330/
5. Helms ER. Using the repetitions in reserve-based rating of perceived exertion scale to autoregulate powerlifting training. PhD thesis, Auckland University of Technology, 2017. https://openrepository.aut.ac.nz/server/api/core/bitstreams/9bf8de93-f847-4495-91d7-90e8216ae8f3/content
6. Halperin I, Malleron T, Har-Nir I, et al. Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. *Sports Med* 52(2):377–390, 2022. https://doi.org/10.1007/s40279-021-01559-x
7. Robinson ZP, Pelland JC, Remmert JF, et al. Exploring the dose-response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy: a series of meta-regressions. *Sports Med* 54(9):2209–2231, 2024. https://doi.org/10.1007/s40279-024-02069-2
8. Tuchscherer M. Fatigue percents revisited. Reactive Training Systems, 2016. https://store.reactivetrainingsystems.com/blogs/advanced-concepts/fatigue-percents-revisited
9. Wanamaker B. Auto-regulating volume. Reactive Training Systems, 2016. https://store.reactivetrainingsystems.com/blogs/rts-basics/auto-regulating-volume
10. National Strength and Conditioning Association. Training load chart (adapted from Landers J, *NSCA J* 6(6):60–61, 1984). NSCA, 2012. https://www.nsca.com/contentassets/61d813865e264c6e852cadfe247eae52/nsca_training_load_chart.pdf
11. Reynolds JM, Gordon TJ, Robergs RA. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. *J Strength Cond Res* 20(3):584–592, 2006. https://doi.org/10.1519/R-15304.1
12. Shimano T, Kraemer WJ, Spiering BA, et al. Relationship between the number of repetitions and selected percentages of one repetition maximum in free weight exercises in trained and untrained men. *J Strength Cond Res* 20(4):819–823, 2006. https://doi.org/10.1519/R-18195.1
13. Marzagão T. A weight-dependent 1RM prediction equation optimized on 303,494 near-failure sets across 388 exercises. arXiv:2603.17495, 2026. https://arxiv.org/abs/2603.17495
14. Liftosaur. Liftoscript documentation (lp, dp, sum progressions; Epley 1RM; rpeMultiplier; equipment rounding). https://www.liftosaur.com/doc/liftoscript
15. Boostcamp. Auto Progression (feature documentation). https://www.boostcamp.app/features/auto-progression
16. Alpha Progression. Alpha Progression guide (progression recommendations, available weights, RIR, deloads). https://alphaprogression.com/en/blog/alpha-progression-guide
17. Juggernaut Training Systems. How JuggernautAI is individualized to you (help center). https://help.jtsstrength.com/en/articles/3-how-juggernautai-is-individualized-to-you
18. Juggernaut Training Systems. All about RPE and RIR (help center). https://help.jtsstrength.com/en/articles/2-all-about-rpe-and-rir
19. StrongLifts. StrongLifts 5×5: How to progress. https://stronglifts.com/stronglifts-5x5/progress/
20. StrongLifts. StrongLifts 5×5: How to overcome failure. https://stronglifts.com/stronglifts-5x5/failure/
21. StrongLifts. StrongLifts 5×5: How to break plateaus. https://stronglifts.com/stronglifts-5x5/plateaus/
22. The Fitness Wiki (r/Fitness). GZCLP. https://thefitness.wiki/routines/gzclp/
23. Lefever C. GZCL applications & adaptations (GZCLP). Swole at Every Height, 2016. https://swoleateveryheight.blogspot.com/2016/02/gzcl-applications-adaptations.html
24. The Fitness Wiki (r/Fitness). 5/3/1 for Beginners (Jim Wendler's routine). https://thefitness.wiki/routines/5-3-1-for-beginners/
25. Wendler J. Building strength and the training max. jimwendler.com. https://www.jimwendler.com/blogs/jimwendler-com/building-strength-and-the-training-max
26. Renaissance Periodization. Training volume landmarks for muscle growth. RP Strength, 2017. https://rpstrength.com/training-volume-landmarks-muscle-growth/
27. Alpha Progression. Glossary: Myo-reps. https://alphaprogression.com/en/glossary/myo-reps
28. Prestes J, Tibana RA, de Araujo Sousa E, et al. Strength and muscular adaptations after 6 weeks of rest-pause vs. traditional multiple-sets resistance training in trained subjects. *J Strength Cond Res* 33(Suppl 1):S113–S121, 2019. https://doi.org/10.1519/JSC.0000000000001923
29. Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. *J Sports Sci* 35(11):1073–1082, 2017. https://doi.org/10.1080/02640414.2016.1210197
30. Ralston GW, Kilgore L, Wyatt FB, Baker JS. The effect of weekly set volume on strength gain: a meta-analysis. *Sports Med* 47(12):2585–2601, 2017. https://doi.org/10.1007/s40279-017-0762-7
31. Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. *Sports Med* 56(2):481–505, 2026. https://doi.org/10.1007/s40279-025-02344-w
32. Grgic J, Schoenfeld BJ, Davies TB, et al. Effect of resistance training frequency on gains in muscular strength: a systematic review and meta-analysis. *Sports Med* 48(5):1207–1220, 2018. https://doi.org/10.1007/s40279-018-0872-x
33. Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis. *J Sports Sci* 37(11):1286–1295, 2019. https://doi.org/10.1080/02640414.2018.1555906
34. Androulakis-Korakakis P, Fisher JP, Steele J. The minimum effective training dose required to increase 1RM strength in resistance-trained men: a systematic review and meta-analysis. *Sports Med* 50(4):751–765, 2020. https://doi.org/10.1007/s40279-019-01236-0
35. Coleman M, Burke R, Augustin F, et al. Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. *PeerJ* 12:e16777, 2024. https://peerj.com/articles/16777/
36. Bell L, Nolan D, Immonen V, et al. "You can't shoot another bullet until you've reloaded the gun": coaches' perceptions, practices and experiences of deloading in strength and physique sports. *Front Sports Act Living* 4:1073223, 2022. https://doi.org/10.3389/fspor.2022.1073223
37. Rogerson D, Nolan D, Androulakis Korakakis P, Immonen V, Wolf M, Bell L. Deloading practices in strength and physique sports: a cross-sectional survey. *Sports Med Open* 10(1):26, 2024. https://doi.org/10.1186/s40798-024-00691-y
38. Bosquet L, Berryman N, Dupuy O, et al. Effect of training cessation on muscular performance: a meta-analysis. *Scand J Med Sci Sports* 23(3):e140–e149, 2013. https://doi.org/10.1111/sms.12047
39. Nuckols G. A guide to detraining: what to expect, how to mitigate losses, and how to get back to full strength. Stronger by Science, 2022. https://www.strongerbyscience.com/detraining/
40. Halonen EJ, Gabriel I, Kelahaara MM, Ahtiainen JP, Hulmi JJ. Does taking a break matter — adaptations in muscle strength and size between continuous and periodic resistance training. *Scand J Med Sci Sports* 34(10):e14739, 2024. https://doi.org/10.1111/sms.14739
41. Murphy C, Koehler K. Energy deficiency impairs resistance training gains in lean mass but not strength: a meta-analysis and meta-regression. *Scand J Med Sci Sports* 32(1):125–137, 2022. https://doi.org/10.1111/sms.14075
42. Haugen ME, Vårvik FT, Larsen S, et al. Effect of free-weight vs. machine-based strength training on maximal strength, hypertrophy and jump performance — a systematic review and meta-analysis. *BMC Sports Sci Med Rehabil* 15:103, 2023. https://doi.org/10.1186/s13102-023-00713-4
43. Fyfe JJ, Hamilton DL, Daly RM. Minimal-dose resistance training for improving muscle mass, strength, and function: a narrative review of current evidence and practical considerations. *Sports Med* 52(3):463–479, 2022. https://doi.org/10.1007/s40279-021-01605-8
44. Bell L, Strafford BW, Coleman M, Androulakis Korakakis P, Nolan D. Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. *Sports Med Open* 9(1):87, 2023. https://doi.org/10.1186/s40798-023-00633-0
45. Feigenbaum J. Strength training plateau: why progress stalls and how to fix it. Barbell Medicine, updated 2026. https://www.barbellmedicine.com/blog/strength-training-plateau/
46. Stronger by Science. Program bundle (RIR, Last Set RIR, Reps to Failure and Linear Progression schemes). https://www.strongerbyscience.com/program-bundle/

---

### Notes on evidence strength

- **Strong (meta-analyses / RCTs):** load vs rep progression [2]; RPE vs %1RM [4]; RIR accuracy [6]; proximity to failure [7]; volume and frequency [29]–[34]; deload RCT [35]; detraining [38][40]; energy deficit [41]; machines vs free weights [42].
- **Practitioner consensus (surveys, Delphi):** deload frequency/duration/content [36][37][44].
- **Documented but untested rules (programs and apps):** StrongLifts, GZCLP, 5/3/1, RTS, RP, Liftosaur/Boostcamp/Alpha/JuggernautAI [8][9][14]–[26][46]. They encode coaching experience; the specific percentages (−10% after 3 fails, 85% restart, 90% TM, 4–6% fatigue drop) are conventions, not measured optima.
- **Design defaults in this document (no direct evidence; chosen to be conservative and consistent with the above):** the exact miss ladder (hold / −5% / −10%), the 4-indicator deload score, the gap tiers, the substitution priors (0.85/0.75/0.60), the 85% volume-retention target for 2-day weeks, and the per-class RIR targets.
