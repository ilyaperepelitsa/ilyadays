---
title: Analytics behind the progress charts
description: How estimated 1RM, the body-weight trend, robust slopes, weekly hard sets, the fitness–fatigue model and the workload ratio are computed, how far to trust each, and how I read them.
updated: 2026-11-08
order: 6
sources:
- [1] Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training — Strength and Conditioning Journal, 2016. https://doi.org/10.1519/SSC.0000000000000218
- [2] Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry — Journal of Strength and Conditioning Research, 2006. https://doi.org/10.1519/R-15304.1
- [3] Relationship between the number of repetitions and selected percentages of one repetition maximum in free weight exercises in trained and untrained men — Journal of Strength and Conditioning Research, 2006. https://doi.org/10.1519/R-18195.1
- [4] Test–retest reliability of the one-repetition maximum (1RM) strength assessment: a systematic review — Sports Medicine Open, 2020. https://doi.org/10.1186/s40798-020-00260-z
- [5] Ability to predict repetitions to momentary failure is not perfectly accurate, though improves with resistance training experience — PeerJ, 2017. https://doi.org/10.7717/peerj.4105
- [6] The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains — Sports Medicine, 2026. https://doi.org/10.1007/s40279-025-02344-w
- [7] Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis — Journal of Sports Sciences, 2017. https://doi.org/10.1080/02640414.2016.1210197
- [8] Day-to-day variability in euvolemic body mass — Renal Failure, 2023. https://doi.org/10.1080/0886022X.2023.2273421
- [9] The Hacker's Diet, chapter Pencil and Paper — Fourmilab, 2005. https://www.fourmilab.ch/hackdiet/e4/pencilpaper.html
- [10] EWMA control charts, e-Handbook of Statistical Methods section 6.3.2.4 — NIST/SEMATECH, 2012. https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm
- [11] Quantification of the effect of energy imbalance on bodyweight — The Lancet, 2011. https://doi.org/10.1016/S0140-6736(11)60812-X
- [12] Estimates of the regression coefficient based on Kendall's tau — Journal of the American Statistical Association, 1968. https://doi.org/10.1080/01621459.1968.10480934
- [13] Theil–Sen estimator — Wikipedia, 2026. https://en.wikipedia.org/wiki/Theil%E2%80%93Sen_estimator
- [14] Modeling human performance in running — Journal of Applied Physiology, 1990. https://doi.org/10.1152/jappl.1990.69.3.1171
- [15] The science of the TrainingPeaks Performance Manager — TrainingPeaks, 2022. https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/
- [16] Optimizing athletic performance by influence curves — Journal of Applied Physiology, 1991. https://doi.org/10.1152/jappl.1991.71.3.1151
- [17] Assessing the limitations of the Banister model in monitoring training — Journal of Sports Sciences, 2006. https://doi.org/10.1080/02640410500244697
- [18] Effects of training frequency on the dynamics of performance response to a single training bout — Journal of Applied Physiology, 2002. https://doi.org/10.1152/japplphysiol.00429.2001
- [19] Better way to determine the acute:chronic workload ratio? — British Journal of Sports Medicine, 2017. https://doi.org/10.1136/bjsports-2016-096589
- [20] The training-injury prevention paradox: should athletes be training smarter and harder? — British Journal of Sports Medicine, 2016. https://doi.org/10.1136/bjsports-2015-095788
- [21] Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations — British Journal of Sports Medicine, 2019. https://doi.org/10.1136/bjsports-2017-098110
- [22] Acute:chronic workload ratio: conceptual issues and fundamental pitfalls — International Journal of Sports Physiology and Performance, 2020. https://doi.org/10.1123/ijspp.2019-0864
- [23] Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes — International Journal of Sport Nutrition and Exercise Metabolism, 2011. https://doi.org/10.1123/ijsnem.21.2.97
---

A training log is a short, noisy time series. Three sessions a week give two or three data points per exercise per week, and each one is an *estimate* of strength, nudged by sleep, water, seat position and my own judgement of effort. Every chart on the progress page follows one rule: show the raw points, estimate the trend robustly, state the uncertainty, and only then decide.

> **In short:** one estimate is noisy (about ±4–5 %), trends need weeks, every slope comes with an interval, and the fitness–fatigue and workload-ratio charts describe load rather than predict anything.

## Estimated 1RM without maxing out

Testing a true one-rep max every week is pointless and risky, so the site estimates it from ordinary sets. Two classic equations do the job: Epley, `kg × (1 + r / 30)`, and Brzycki, `kg × 36 / (37 − r)`. The site averages them, with `r` = reps done + reps in reserve (RIR). A set stopped two reps short of failure counts as a set of reps + 2 to failure, the logic of the RIR-based effort scale [1].

The two equations agree in the middle and drift apart at the ends. Estimates from a set with 100 kg:

| Reps + RIR | Epley | Brzycki | Site |
| --- | --- | --- | --- |
| 3 | 110 | 106 | 108 |
| 5 | 117 | 113 | 115 |
| 8 | 127 | 124 | 125 |
| 10 | 133 | 133 | 133 |
| 12 | 140 | 144 | 142 |
| 15 | 150 | 164 | 157 |
| 20 | 167 | 212 | 189 |

When the 1RM was predicted from 5, 10 and 20-rep maxima on the barbell bench press and a plate-loaded leg press, five-rep sets predicted best, and the authors advise no more than ten reps in such linear equations [2]. The leg-press error (16 kg) was five times the bench-press error (3 kg) [2], and the number of reps possible at a given percentage of 1RM differs between exercises [3]. Each machine is its own instrument.

## How noisy is one estimate?

Even a real 1RM test varies when repeated: across 32 studies the median test–retest coefficient of variation was 4.2 % [4]. Then comes effort judgement. In 141 trainees who went to failure, people under-predicted how many reps they had left, with typical errors of 2.6–3.4 reps, and accuracy tended to improve with experience [5]. At five reps, every misjudged rep moves the Epley estimate by about 3 %.

Taken together (my arithmetic, not a study result), a single set's e1RM carries a standard deviation of roughly 4–5 % with nothing real changing. A new best smaller than that is a hint, not proof; one that repeats next session is real.

## Counting the dose: hard sets

Tonnage (kg × reps) is intuitive, but it rewards light, high-rep work and can't be compared between exercises. The better unit is the **hard set**: a working set that ends within about four reps of failure. A large dose–response meta-regression (67 studies, 2,058 people) found that counting a set as 1 for the muscles it targets and 0.5 for helpers (a row counts 1 for the back and 0.5 for the biceps) described results better than counting indirect sets fully or not at all [6]. Its conclusions:

- Muscle size and strength both rise with weekly sets, with diminishing returns that are much stronger for strength [6].
- An earlier meta-analysis also found a graded relationship between weekly sets and muscle growth [7].
- Training a muscle more often helped strength, with diminishing returns, but had no clear effect on size [6].

For a strength-leaning lifter this means a few hard sets per exercise buy most of the strength, and extra sets go to the muscles with a size goal.

## Body weight: a signal buried in water

From one day to the next, body mass moves with a standard deviation of about 0.5 % (≈ 0.4 kg at 80 kg). That is genuine change in water, food and gut content, not the scale: measurement error is only about 0.1 kg [8].

The trend line is an exponentially weighted moving average (EWMA): each day it moves 10 % of the way toward the new weigh-in, `trend = trend + 0.1 × (weight − trend)`, the method of *The Hacker's Diet* [9]. Standard EWMA algebra gives its two properties [10]:

- **Smooth:** daily noise shrinks to about a quarter (σ × √(0.1 / 1.9) ≈ 0.23σ).
- **Late:** the average age of the data inside it is 9 days, like a 19-day moving average. It confirms a change; it does not discover one.

The *rate* comes from a regression slope through the raw weigh-ins, with an interval. With daily weigh-ins and σ = 0.4 kg (my arithmetic, assuming independent days):

| Window | 95 % interval of the weekly rate |
| --- | --- |
| 14 days | ±0.36 kg/week |
| 28 days | ±0.13 kg/week |

A two-week dip proves little; four weeks tell a real story. Turning the trend into calories with 7,700 kcal per kg works only over short windows, because expenditure drifts as weight changes [11].

## Robust trends: Theil–Sen

Ordinary least squares lets one bad session drag the whole line. The Theil–Sen estimator takes the median of the slopes between every pair of points, and Sen's method adds a distribution-free confidence interval from the ranks of those pairwise slopes [12]. Up to about 29 % of the points can be wild without moving it much [13].

Fitted to the logarithm of e1RM, the slope reads as percent per week, comparable across exercises. The same machinery turns a goal into a date range: the steep end of the interval gives the earliest date, the shallow end the latest, and if the interval reaches zero there is no latest date at all.

## Fitness and fatigue: the Banister model

The impulse–response model treats each day's training load as leaving two traces: *fitness*, which fades slowly, and *fatigue*, which fades fast but weighs more. Predicted performance is a baseline plus k1 × fitness minus k2 × fatigue [14]. The usual textbook settings are a 42-day fitness and a 7-day fatigue time constant, the defaults of the TrainingPeaks Performance Manager. The site also counts fatigue twice, as in the original model's worked example; the Performance Manager itself weighs the two equally [15].

With those numbers a single session's net effect turns positive after about 6 days and peaks after about 3 weeks. That follows from the model's influence curves [16] and is the logic behind a lighter week before a test.

The limits are serious:

- In elite swimmers the model fitted well (R² ≈ 0.79), but several parameters were strongly correlated and their intervals wide (fatigue time constant 19 days, 6–32), so they could not be interpreted one by one [17].
- Fatigue is not fixed. When untrained people went from three to five sessions a week, recovery after one session stretched from 0.9 to 3.6 days [18].
- A trustworthy fit needs 5–50 performance measurements per adjustable parameter, so 20–200 tests for the four-parameter model [15].

## The acute:chronic workload ratio

The ACWR divides the last week's load by the last month's. The exponentially weighted version uses λ = 2 / (N + 1): 0.25 for 7 days and about 0.069 for 28 days [19]. Team-sport research popularised a "sweet spot" of 0.8–1.3 and a danger zone from 1.5 upward [20].

Then the critiques arrived. In the classic form the acute week sits inside the chronic month, which manufactures correlation from arithmetic alone [21]. More broadly, the ratio rests on weak conceptual ground as an injury predictor, and its reported links with injury may be statistical artefacts [22].

## What this means for me

This is how I read the [progress page](/fitness/progress), chart by chart.

### Estimated 1RM

- One point per exercise per session: the best estimate from that day's working sets. Hollow points come from sets with more than 12 reps + RIR, or with RIR above 4. They are shown but never drive the trend [2][5].
- The trend line appears after about five sessions over three weeks. Its band shows how far single sessions normally scatter: 4 % or the actual scatter, whichever is larger [4].
- A new gym or a different machine is a new instrument, so I compare like with like [2][3].
- A plateau flag appears after four sessions without a confirmed best (2.5 % above the old one, or two sessions in a row above it). Next to it is the chance that a lifter who is still improving sees such a dry spell anyway, assuming a 35 % chance of a best per session: 18 % after four sessions, 7.5 % after six. During a cut, a flat line counts as a win.

### Body-weight trend

- Light dots are weigh-ins, the bold line is the EWMA trend [9], and the weekly rate is a Theil–Sen slope over the last 28 days with a 95 % interval, widened when water retention makes neighbouring days alike [12].
- I weigh every morning after the bathroom and before eating, so the noise stays near 0.5 % [8].
- My target is −0.5 to −0.75 % a week: athletes losing about 0.7 % a week gained lean mass, those losing faster did not [23]. I change calories only when the whole interval sits outside that band for two weeks; the [nutrition explainer](/fitness/science/nutrition) has the rules.

### Slopes and their intervals

- Strength trends read as percent per week, for example "+1.2 %/week (0.4 to 2.0)". The interval appears from eight sessions [12].
- If the interval includes zero, there is no evidence yet of progress or of a stall, and I keep training as planned.
- A forecast to a target, such as goal body weight, is a date range built from the slope's interval, never a single date, and it never reaches further than twice the data span or 26 weeks.

### Hard sets per muscle per week

- The heatmap counts fractional hard sets per muscle group per week (1 direct, 0.5 indirect, RIR 4 or less) and rings the cells that fall inside 10–20 sets [6][7].
- In the fat-loss mode my program aims for roughly 10–16 sets per muscle; chest and back sit at the top by design.
- Strength needs fewer sets than size [6], so a lower count for arms or shoulders is not automatically a problem.

### Fitness–fatigue

- Three lines: fitness (slow), fatigue (fast) and the performance index they imply. Daily tonnage drives them, with the textbook constants rather than values fitted to me [15][17].
- Fatigue climbing while e1RM stalls is my cue for a lighter week; a test or a heavy top set goes one to three weeks after it [16].
- It is a picture of my load pattern, not a forecast.

### Workload ratio

- It stays hidden for the first 50 days, while the exponential averages forget their starting values, and its chronic average leaves out the latest week to avoid the coupling problem [19][21].
- With three sessions a week the ratio jumps around, and the first week back after a missed one spikes it by arithmetic alone.
- Above 1.5 it means "ramping fast, check sleep and soreness", not "injury coming" [22].

### Also on the page

Weekly tonnage (comparable within one exercise only), PR markers (the first session only sets the baselines) and a 12-week adherence calendar with a streak of weeks that met the plan.

## Caveats

- The e1RM equations and their error figures come mostly from free-weight lifts and small samples; machine curves differ [2][3].
- People under-predict how many reps they have left, especially early on [5], so early e1RMs run conservative.
- The intervals assume independent errors. Water retention and weekly rhythms make the real uncertainty larger than the formulas say.
- The fitness–fatigue model and the ACWR come from endurance and team sports with far richer data; here they are descriptive only [17][22].
- With little data, every chart shows a "collecting data" state instead of a line. That is deliberate.
- This page explains methods. It is not medical advice.
