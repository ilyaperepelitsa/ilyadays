---
title: How the planner picks your next weights
description: Double progression with reps in reserve — the exact rules that turn each logged session into the next targets, from the first test session to misses, deloads, breaks and swaps.
updated: 2026-11-09
order: 2
sources:
- [1] Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations — PeerJ, 2022. https://doi.org/10.7717/peerj.14142
- [2] Progression models in resistance training for healthy adults (ACSM position stand) — Medicine & Science in Sports & Exercise, 2009. https://pubmed.ncbi.nlm.nih.gov/19204579/
- [3] Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve — Journal of Strength and Conditioning Research, 2016. https://doi.org/10.1519/JSC.0000000000001049
- [4] RPE vs. percentage 1RM loading in periodized programs matched for sets and repetitions — Frontiers in Physiology, 2018. https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330/
- [5] Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis — Sports Medicine, 2022. https://doi.org/10.1007/s40279-021-01559-x
- [6] Exploring the dose–response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy: a series of meta-regressions — Sports Medicine, 2024. https://doi.org/10.1007/s40279-024-02069-2
- [7] Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training — Strength and Conditioning Journal, 2016. https://doi.org/10.1519/SSC.0000000000000218
- [8] Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry — Journal of Strength and Conditioning Research, 2006. https://doi.org/10.1519/R-15304.1
- [9] Training load chart (adapted from Landers, 1984) — National Strength and Conditioning Association, 2012. https://www.nsca.com/contentassets/61d813865e264c6e852cadfe247eae52/nsca_training_load_chart.pdf
- [10] Maximal number of repetitions at percentages of the one repetition maximum: a meta-regression and moderator analysis of sex, age, training status, and exercise — Sports Medicine, 2024. https://doi.org/10.1007/s40279-023-01937-7
- [11] Muscle strength testing: use of normalisation for body size — Sports Medicine, 2002. https://doi.org/10.2165/00007256-200232100-00002
- [12] Effect of training cessation on muscular performance: a meta-analysis — Scandinavian Journal of Medicine & Science in Sports, 2013. https://doi.org/10.1111/sms.12047
- [13] Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach — Sports Medicine Open, 2023. https://doi.org/10.1186/s40798-023-00633-0
- [14] Deloading practices in strength and physique sports: a cross-sectional survey — Sports Medicine Open, 2024. https://doi.org/10.1186/s40798-024-00691-y
- [15] Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations — PeerJ, 2024. https://doi.org/10.7717/peerj.16777
- [16] Energy deficiency impairs resistance training gains in lean mass but not strength: a meta-analysis and meta-regression — Scandinavian Journal of Medicine & Science in Sports, 2022. https://doi.org/10.1111/sms.14075
- [17] Effect of free-weight vs. machine-based strength training on maximal strength, hypertrophy and jump performance — a systematic review and meta-analysis — BMC Sports Science, Medicine and Rehabilitation, 2023. https://doi.org/10.1186/s13102-023-00713-4
- [18] ACSM Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults — Medicine & Science in Sports & Exercise, 2026. https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/
---

After every session the planner looks at what I actually lifted and sets the next weight and rep target for each exercise. There is no black box: a short list of rules, each with a reason. This page describes them exactly as the code applies them.

> **In short:** reps go up first, then the weight. A set counts when it reaches the target with about the planned reps in reserve. The weight rises only when every planned set reaches the top of the range, two sessions in a row below the range cost 10 %, one week in six is lighter, and the first session on any exercise is a test.

## Two levers: reps, then load

Progressive overload can come from more weight at the same reps or from more reps at the same weight. When trained lifters were randomised to one or the other for eight weeks, the results were within noise of each other [1]. A rep gained at a fixed weight is real progress, which matters on machines whose next pin is 5 kg away. The American College of Sports Medicine puts the hand-off this way: when you can do one or two reps more than the target on two sessions in a row, add 2–10 % [2]. The planner uses the top of a rep range as the trigger instead, one session at a time: double progression, for every exercise in my program.

## Effort: reps in reserve

Each working set has a target in reps in reserve (RIR): how many more clean reps you could have done. RIR 2 means stopping two reps short of failure. The scale tracks bar speed closely [3], and lifters who chose loads by effort gained as much as lifters who followed fixed percentages [4]. People misjudge it, though: on average they under-predict the reps they have left by about one, and more on long sets [5]. So the planner treats a logged RIR as ±1. Strength gains are nearly flat across a wide range of RIR, while muscle growth improves closer to failure [6]. That is why the big lifts stay at RIR 2 and isolation work at RIR 1.

## The rules after each session

For each exercise the planner uses the most common working weight as its load anchor, but checks every working attempt for missed reps and effort, including heavier and lighter attempts. A failed heavier attempt cannot be hidden by two successful lighter sets. A set is **made** when it reaches the target reps with at least the planned RIR minus one. One-tap "done" records the displayed reps and weight. The displayed RIR is a target until I tap an effort estimate; this distinction is stored. Assumed RIR cannot confirm an initial baseline or earn its load increase.

| What happened | Next session |
| --- | --- |
| Every set made, below the top of the range | Same weight; target +1 rep, or the weakest set +1, or that set's reps plus its reserve beyond the plan, whichever is higher |
| Every set made at the top of the range | One weight step up, if the weakest set can carry it (below): the machine's increment, or 2.5 % if that is bigger (5 % in the endurance mode); target back to the bottom |
| …and the first set beat the top by 2+ reps (3+ in the endurance mode) with an extra rep in reserve | Two steps, capped at +10 % |
| …and every set had an extra rep in reserve | The weight those sets imply for the bottom of the range, capped at +10 % (one step, if a step is bigger) |
| Some sets short of the target, none below the range | Same weight; target = weakest set +1 |
| Fewer working sets logged than planned | Same weight and target; a set below the range still counts as a miss |
| Any set below the bottom of the range | A miss: same weight, target back to the bottom |
| The second miss in a row (the third in the strength mode) | Weight −10 %, then build back up |
| At the top below a weight that ended in a deload | That weight only after 2 top sessions in a row that can carry it, test sessions included [2]; after a second deload, 3 with 2 reps more in reserve; until then a smaller step or the same weight |
| A weight hold is on (from the adviser or the program page) | No heavier weight before its date; reps still climb within the range, and misses and deloads still apply |

Three details keep the steps sane:

- **Coarse steps.** The weakest set must support the next step at the bottom of the range. Otherwise reps can rise to 15 on compounds or 20 on isolation exercises; after that the planner suggests smaller equipment steps.
- **Nothing to add.** A bodyweight exercise at the top of its range stays there, and the plan names a harder variant (knee raise → hanging leg raise) or added weight.
- **Dropping the weight blocks progress.** If I had to go lighter partway through, the session cannot progress: the weight stays, and a lighter set below the range counts as a miss. In a test session successful lighter working sets can be a ramp, but any working set below the range still blocks an increase. Warm-up rows are kept separate.

## A worked example

Machine chest press: four sets of 6–10 at RIR 2 on a stack with 5 kg steps. These are the engine's own answers to an imagined run of sessions, all at RIR 2 unless noted:

| Session | Logged (kg × reps) | Outcome | Next target |
| --- | --- | --- | --- |
| 1, test | 20 × 6 and 30 × 6 to ramp up, then 40 × 6, 40 × 6 | 40 kg becomes the working weight | 40 × 7 |
| 2 | 40 × 7, 7, 7, 7 | Progressed | 40 × 8 |
| 3 | 40 × 8, 8, 8, 7 | Held | 40 × 8 |
| 4 | 40 × 9, 9, 8, 8 | Progressed | 40 × 9 |
| 5 | 40 × 10, 10, 9, 9 | Progressed | 40 × 10 |
| 6 | 40 × 10, 10, 10, 10 | Top reached, but +5 kg would be 12.5 % | 40 × 11 |
| 7 | 40 × 11, 11, 11, 10 | Held | 40 × 11 |
| 8 | 40 × 11, 11, 11, 11 | Progressed | 45 × 6 |
| 9 | 45 × 6, 6, 6 (RIR 1), 5 (RIR 0) | Miss 1 of 2 | 45 × 6 |
| 10 | 45 × 6, 6, 6, 6 | Progressed | 45 × 7 |

Over this run the estimated one-rep max rose from 50 to 57 kg.

## Estimated one-rep max in the background

The planner estimates 1RM from reps and RIR using Epley and Brzycki [7], using only sets with at most 12 total reps because longer-set predictions are less dependable [5,8]. Above that it uses a percentage table [9]. Individual responses vary [10]; estimates are separate for every exercise. A best-ever estimate helps select warm-ups, but cannot override missed work when setting the next load. The [load calculator](/fitness/tools) shows the arithmetic.

## The first session is a test

Each exercise has its own baseline. Shoulder-press performance does not establish a curl or row baseline, and changing machines may require another calibration. The catalog and bodyweight formula supply only a starting estimate, not a validated individual strength assessment. Body-size scaling [11] does not establish the right weight for a particular person or machine.

Start with light warm-up sets and check the setup and range of motion. Adjust the first working weight so the bottom of the prescribed range leaves roughly two or three clean reps in reserve. No maximum attempt is needed. The 2026 ACSM overview supports individualized progressive training and notes that failure is not necessary; sufficient effort can be achieved with about 2–3 RIR [18]. RIR is still an imperfect estimate [5], so actual performance across sets matters.

The baseline remains **learning** after partial work or unreported effort. It becomes **established** after the planned work is complete, no working attempt misses its prescription, and at least two sets at the anchor weight have reported effort within the plan's tolerance (one if only one set was prescribed). The saved baseline includes the observed load, reps, RIR, date and source session. This confirmation threshold is an app convention, not a clinically validated test. Subsequent misses still follow the failure ladder while learning; provisional status does not suspend it indefinitely.

During the first session, a heavier re-anchor requires complete successful work and reported effort. An incomplete session cannot earn more weight. A below-range set can still lead to a lighter starting load. Recalibration also runs after longer breaks or a goal change; previous records remain available.

## When 10 planned reps become 8

Record **8**, leaving the original target of 10 intact. If 8 is inside the range and effort was manageable, the next set suggests the same weight with an 8-rep target after the full rest. If the set was below the range or reported effort was too high, it suggests one easier equipment step and the bottom of the range. For assisted exercises, easier means **more assistance**. A later set that recovers to 10 restores the original rep suggestion. Suggestions never automatically add weight within the workout; I can adjust them.

The original prescription, effective suggestions and actual results stay separate. An easier suggestion does not erase the original miss. Extra sets cannot replace missing prescribed rows; one good set cannot override the guards.

These exact next-set choices, the ±1 RIR tolerance, and the confirmation threshold are conservative product defaults. Studies support individualization, progressive training and effort monitoring; they do not prove that 8 reps always requires exactly one particular adjustment [5,18]. A single miss within the range generally holds the next visit's load; repeated below-range work follows the existing deload rule. Load is earned again through completed work.

## Breaks, deloads, swaps and goal switches

| Situation | What the planner does |
| --- | --- |
| Under 14 days since the exercise | Nothing changes |
| 14–27 days | 5 % lighter at two weeks, rising to 10 % at four |
| 28 days or more | 10 % lighter, rising to 15 % at 90 days; target back to the bottom; a test session |
| Planned deload week | 40 % fewer sets (rounded, at least one), the same weights, 2 more reps in reserve and 2 fewer reps; no progression |
| Swapping in another exercise | 85 % of the equivalent weight (60 % if the movement differs), converted between machines, dumbbells and barbells; then a test session |
| Switching goal mode | Weights carried to the new rep range through the percentage table, 5 % lighter for the first session, which runs as a test |
| Skipped exercise | Targets unchanged, with a note |

Break cuts are rounded once; coarse steps use fewer reps instead. Short breaks need not imply substantial strength loss [12]. A deload follows five accumulation weeks (eight in maintenance): less volume at usual weights, consistent with coaching consensus [13,14]. A full week off did not improve adaptations in one trial [15].

## What this means for me

- In a deficit of about 500 kcal a day, strength gains hold up while muscle gains flatten [16]. "Held" is a normal outcome in this phase, and keeping the estimated maximum level counts as a win.
- Machines are a legitimate choice: free weights and machines build similar strength and size, and the gains are specific to what you train on [17]. I keep the same machine for an exercise when I can.
- The first session of every exercise is a test, so I follow the protocol on each card and expect light weights on day one.
- I log RIR honestly: a grinder gets RIR 0, an easy set its real number.
- Deload weeks are weeks 6, 12, 18 and so on.

## Caveats

- The specific numbers — two misses before −10 %, two or three top sessions before a failed weight, the 14- and 28-day break tiers, the 85 % start, 40 % fewer sets in a deload, the swap ratios — are conservative design defaults built on the evidence, not measured optima.
- RIR is a judgement, and early on it is often off by a rep or more [5]; the first weeks of numbers are the least reliable.
- The one-rep-max equations come from free-weight lifts; machine strength curves differ, and individuals vary widely at the same percentage [10].
- The planner sees only what is logged: sleep, stress and soreness do not change the plan yet.
