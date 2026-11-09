# 05 — Longevity training: bone density, VO2max, strength and mortality

Research brief for the ilyadays fitness planner. Date: 2026-11-08. Audience: the site owner (adult male, trains alone, machine-first, three upper-body lifting days a week, no leg lifting at first; goals: fat loss, strength, some pec development, strong back, arm and ab strength, longevity) and the implementation agents (stream 03 program engine, 06 analytics, 08 science pages, 09 calculators).

Scope: what to train, and how much, to protect bone mineral density (BMD), raise and keep VO2max, and keep the strength and muscle that predict survival; carries, balance, protein and sleep briefly; a weekly "longevity minimum" that fits three upper-body lifting days; a VO2max tracking plan built on field tests the site can compute; target values by age from the FRIEND registry.

Evidence grades used below: **A** = several meta-analyses or large consistent cohorts; **B** = one meta-analysis, a few RCTs, or meta-analyses with important caveats; **C** = mechanism, expert consensus or coaching practice without controlled trials.

Relation to other files: research 01 ("Health and longevity maintenance") is the short version of this file. Stream 09 already implements Karvonen zones (50/60/70/80/90–100 % HRR), Tanaka HRmax and the Cooper and Uth estimators; every formula here matches those and adds machine-friendly tests. Exercise ids are taken from `content/fitness/registry.json`; impact drills (hops, jumping chin-ups) have no registry id yet and are flagged as such.

---

## Summary

1. **Aerobic fitness is the largest modifiable mortality signal.** Each +1 MET (3.5 mL/kg/min) of cardiorespiratory fitness is associated with 11–17 % lower all-cause mortality; the least fit quarter of 122,007 treadmill-tested patients had 5.04 times the mortality of the elite, and among 750,302 veterans the least fit fifth had 4.09 times the risk of the extremely fit, with the lowest risk near 14 METs and no upper limit [1][2][3][4]. The data are observational, but men who went from unfit to fit had 44 % lower mortality than men who stayed unfit [5]. (A)
2. **VO2max rises with volume plus intensity.** Endurance training adds ~4.9 and intervals ~5.5 mL/kg/min versus controls; the Norwegian 4×4 (4 × 4 min at 90–95 % HRmax, 3 min easy) raised VO2max 7.2 % in 8 weeks; one 4-minute bout or two 20-second sprints three times a week still raise it 10–15 % in beginners [6][7][8][9]. "Non-response" is a dose problem: it fell from 69 % at one weekly hour to 0 % at four [10]. (A/B)
3. **No leg lifting does not mean no leg cardio.** VO2max is mainly a central (stroke volume, haemoglobin) adaptation that needs big muscle mass; arm cranking peaks at ~70 % of cycling VO2 [11]. Use the bike, rower, incline treadmill or elliptical; concurrent cardio does not blunt hypertrophy or maximal strength (SMD −0.01 and −0.06) [12]. (A/B)
4. **Zone 2 = below the first threshold, found with the talk test.** Comfortable full sentences mean you are below VT1; "not quite comfortable" marks it [13][14]. Fixed %HRmax is unreliable because LT1 sits anywhere from 60 % to 90 % of HRmax between people [15]; and zone 2 is not magic — at low weekly volume the hard minutes matter more [16]. (B)
5. **Bone responds to heavy, fast, site-specific load.** LIFTMOR (5 × 5 at >80–85 % 1RM deadlift, squat, overhead press plus jumping chin-ups, 2 × 30 min/week, 8 months) raised lumbar BMD 2.9 % vs −1.2 % and preserved the femoral neck; in osteopenic men (LIFTMOR-M) the spine rose 4.1 % vs 0.9 % and the trochanter 2.8 % vs −0.1 %, while a machine-based isometric "bone press" did not improve BMD versus controls [17][18]. High-intensity programs move lumbar BMD about 2.5 times more than moderate ones, and exercise cuts low-trauma fractures by a third (IR 0.67; 0.44 when supervised) [19][20]. (A/B)
6. **Honest answer on upper-body-only training:** it does not protect the hip, and it helps the spine mainly through standing, axially loaded or back-extensor work [21][22][23]. Dieting itself costs ~1–1.5 % of hip BMD, and in a 2025 RCT neither resistance training nor a weighted vest prevented it [24][25]. Add hip loading early: carries and optional hops from week 1, leg press from week 5 (week 1 if the cut is long or bone risk is high), heavy hinge from week 13. (B)
7. **Strength and muscle predict survival.** Each 5 kg less grip: HR 1.16 (PURE); high vs low grip HR 0.69; top vs bottom quartile of muscle mass index HR 0.80; muscle-strengthening work is associated with 10–17 % lower mortality, peaking at 30–60 min/week, and 40 % lower when combined with aerobic activity (RR 0.60) [26][27][28][29]. (A for association, causality unproven)
8. **Longevity minimum on three upper-body days:** 3 × 10–15 min zone-2 finishers, one 45–60 min zone-2 session, one 4×4 session (≈150 moderate-equivalent minutes), carries and back extension twice a week, steps ≥8,000/day (≥6,000 after 60) [30][31]; then hip loading in weeks 5–12 and heavy hinge/squat from week 13, reaching LIFTMOR-style 5 × 5 at >80–85 % 1RM by about month 6. (A for totals, C for the exact split)
9. **Track VO2max with one repeatable field test every 8–12 weeks** (Ebbeling treadmill walk, Concept2 2k, 15 W/min bike ramp, Cooper or Rockport), weekly heart rate at a fixed workload, and resting HR; store raw performance first because converted VO2max estimates misclassify ~40–50 % of people [32][33][34][35][36]. Show METs, FRIEND percentile, Mandsager category and fitness age; aim ≥50th percentile now, ≥75th within 1–2 years, 90th as a stretch [37]. (B)
10. **Supporting habits:** protein 1.6–2.2 g/kg in a deficit (site rule from research 06; benefit plateaus near 1.6 g/kg; ≥1.0–1.2 g/kg in older age, ~0.4 g/kg per meal for older men); ≥7 h sleep (5.5 h in bed during a diet cut fat loss 55 % and raised lean loss 60 %); a 10-second one-leg-stance check (failure: HR 1.84) [38][39][40][41][42][43]. (A/B)

---

## Publishable section — Training for the long game: aerobic fitness, strength and bone

### Three traits that age with you

Three physical traits predict how long and how well people live, and all three respond to training: aerobic capacity (VO2max), muscle strength and mass, and bone strength. They erode quietly. In the FRIEND registry of directly measured treadmill tests, median VO2peak falls about 13.5 % — 4 mL/kg/min — per decade [37], and when the same people are followed over time the decline accelerates from 3–6 % per decade in the twenties and thirties to more than 20 % per decade in the seventies [44]. The dose that protects all three is modest and fits around three gym sessions a week.

### Aerobic fitness: the strongest modifiable predictor

Among 122,007 patients who did a treadmill test at one academic centre, risk-adjusted mortality fell with every step up in fitness and showed no upper limit: the least fit quarter had five times the mortality of the elite (hazard ratio 5.04), and being below average rather than above average carried a hazard ratio of 1.41 — the same as smoking and worse than coronary disease (1.29) [3]. In 750,302 US veterans aged 30 to 95, the least fit fifth had four times the risk of the extremely fit; the lowest risk sat near 14 METs, with no increase at extreme fitness [4]. Pooled, each extra MET (3.5 mL/kg/min, roughly 1 km/h faster running) is associated with 13 % lower all-cause mortality [2], and an overview of 199 cohorts puts the figure at 11–17 % per MET [1]. These are observations, not experiments: fitness is partly inherited, and illness lowers it. But men who moved from unfit to fit between two tests five years apart had 44 % lower mortality than men who stayed unfit [5]. The one large five-year trial in older adults, Generation 100, could not settle causality: supervised training did not beat an already active control group overall, with a non-significant trend favouring intervals (HR 0.63, 95 % CI 0.33–1.20) [45].

### How to raise VO2max

Both steady and interval training work. In healthy adults aged 18–45, continuous endurance training raised VO2max by 4.9 mL/kg/min and high-intensity interval training (HIIT) by 5.5 mL/kg/min compared with controls, a 1.2 mL/kg/min edge for intervals [6]. The best-known protocol is the Norwegian 4×4: four 4-minute bouts at 90–95 % of maximal heart rate (HRmax) separated by 3 minutes of easy movement at about 70 %. Three sessions a week for eight weeks raised VO2max 7.2 % and stroke volume about 10 %, significantly more than the same total work done steadily at 70 % or 85 % HRmax [7]. Smaller doses work for beginners: a single 4-minute bout three times a week raised VO2max 10 % in inactive men aged 35–45 [8], and 10-minute bike sessions containing two or three 20-second all-out sprints raised it 12–19 % [9][46]; across 93 trials, adding sprints added nothing [47]. If VO2max does not move, the answer is more training, not a different body: with one 60-minute session a week, 69 % of people "did not respond"; with four or five sessions none did, and adding two sessions converted every non-responder [10].

The weekly base should still be easy. "Zone 2" means exercise below the first lactate or ventilatory threshold: sustainable for an hour, recovered from overnight and compatible with lifting. Its popular reputation is overstated — a 2025 review found no evidence that it is the optimal intensity for mitochondria or fitness and argued that harder work matters more when weekly volume is low [16]. The practical synthesis: accumulate most minutes easily and add one or two hard sessions.

Skipping leg lifting does not mean skipping legs in cardio. VO2max is mostly a central adaptation — stroke volume and haemoglobin mass [7][10] — and needs a large working muscle mass; arm cranking peaks at only about 70 % of the oxygen uptake reached on a bike [11]. A bike, rower, incline treadmill or elliptical is the right tool. Concurrent aerobic work does not blunt muscle growth or maximal strength; only explosive strength suffers, mainly when both are done in the same session [12].

### Finding zone 2 without a lab

Percent-of-maximum formulas are poor guides: in 100 adults tested in a laboratory, the first lactate threshold fell anywhere between 60 % and 90 % of HRmax [15]. The talk test does better. Recite a short familiar passage: if you can speak comfortably you are below the first ventilatory threshold, and the point where speech becomes "not quite comfortable" coincides with it on both treadmill and bike [13][14]. The test is consistent across walking, cycling, elliptical and stair machines [48]; the "equivocal" stage and a rating of only 10–11 on the 6–20 Borg scale both mark the first threshold, while being unable to talk (a rating of 13–15) marks the second [49]. The site therefore starts from a heart-rate band and lets one talk-test session overwrite its ceiling.

### Strength and muscle are survival signals too

In 139,691 adults from 17 countries, every 5 kg less grip strength was associated with 16 % higher all-cause and 17 % higher cardiovascular mortality, a stronger predictor than systolic blood pressure [26]. Across about two million people, high grip strength carried a hazard ratio of 0.69 and high knee-extension strength 0.86 [27]; among 8,762 men, the stronger two thirds on bench and leg press had 23–28 % lower mortality even after adjustment for aerobic fitness [50]. Muscle mass matters as well: older adults in the top quarter of muscle mass relative to height had 20 % lower mortality than those in the bottom quarter [28]. The dose is small. Muscle-strengthening activity is associated with 10–17 % lower mortality, cardiovascular disease, cancer and diabetes, with the largest reduction around 30–60 minutes a week; combined with aerobic activity the association reaches 40 % [29], and a second meta-analysis puts the peak at 27 % near 60 minutes a week [51]. The flattening beyond that rests on few, self-reported, high-volume data rated very low certainty; it shows diminishing returns, not harm.

### Bone: load beats exercise in general

Bone adapts to large, fast strains at the loaded site. In LIFTMOR, 101 postmenopausal women with low bone mass trained for 30 minutes twice a week: deadlift, squat and overhead press for five sets of five above 80–85 % of one-repetition maximum, plus jumping chin-ups with landings. After eight months lumbar-spine BMD had risen 2.9 % against a 1.2 % loss in controls, femoral-neck BMD was preserved (+0.3 % vs −1.9 %), height increased, and the only adverse event was one minor back spasm [17]. In LIFTMOR-M, 93 men aged about 67 with osteopenia gained 4.1 % at the spine (controls +0.9 %) and 2.8 % at the trochanter (−0.1 %); a machine applying near-maximal isometric pushes improved lean mass but not BMD relative to controls [18][52]. Across 53 trials, high-intensity programs raised lumbar BMD about 2.5 times more than moderate ones (0.031 vs 0.012 g/cm²) [19]. Evidence in men is thinner and pooled effects are small — standardized effects of 0.38 at the spine and 0.25 at the femoral neck in one meta-analysis, a femoral-neck effect only in another [53][54] — but trials that used heavy or impact loading moved bone: twelve months of lifting (squats, deadlifts, presses and lunges, periodized up to 80–90 % 1RM) or jumping raised spine BMD about 1.3 %, and lifting also raised hip BMD 0.8 % [55]; 50 hops a day on one leg raised femoral-neck BMD 0.7 % while the other leg lost 0.9 % [56]; lifting plus impact work three times a week for 18 months improved femoral-neck and spine bone in men aged 50–79 [57]. Exercise also prevents fractures: by a third overall, and by more than half in supervised programs [20].

Does an upper-body machine program protect bone? Only where it loads. Bone responds locally: the playing arm of tennis and squash players carries 8–16 % more mineral than the other arm, against 3–5 % in non-players [21]. In premenopausal women, adding upper-body resistance to a lower-body and jumping program raised spine BMD 1.4 % among regular attenders (−0.9 % without it), while hip gains came only from the lower-body work [22]. Back-extensor strengthening did not change spine BMD over two years [58], yet eight years later the former exercisers had higher BMD and vertebral fractures in 1.6 % versus 4.3 % of vertebrae examined [23]. Seated, back-supported machines load the limbs, not the hip; walking preserves the femoral neck only inconsistently and the spine not at all [59], and road cyclists often have low spine BMD [60]. So: upper-body training helps the arms, may help the spine if it includes standing, axially loaded and back-extensor work, and does nothing measurable for the hip. That matters during a diet, because diet-induced weight loss lowers total-hip BMD by 0.010–0.015 g/cm², about 1–1.5 % [24]. One trial found resistance training limited the loss to 0.5 % versus 3 % with aerobic training [61], but a 2025 trial found that neither lifting nor a weighted vest prevented a 1.2–1.9 % loss of hip bone density [25]. Hip loading should start early, not after the diet.

### Carries, back extensions and balance

Loaded carries challenge the trunk differently from lifts — the farmer's walk and suitcase carry demand torso stiffness and lateral hip support — and modelling work suggests they complement lifting programs [62]; they also load the standing spine and train grip, although no trial has tested them for BMD. UK osteoporosis guidance recommends resistance training two to three days a week, at least 50 moderate impacts on most days and regular back-extension work, while avoiding loaded spinal flexion when bone is fragile [63][64]. Balance is cheap to check: middle-aged and older adults who could not stand on one leg for 10 seconds had 84 % higher mortality over seven years [43], and balance and functional exercise reduces falls in older people by about a quarter [65].

### Recovery that protects the investment

Older adults need at least 1.0–1.2 g of protein per kilogram of body weight a day, more when active [39]; the muscle-building benefit of extra protein plateaus around 1.6 g/kg [38], and older men need about 0.4 g/kg in a meal to maximally stimulate muscle protein synthesis, against 0.24 g/kg in young men [40]. Adults should sleep at least seven hours [41]; both short and long sleep predict higher mortality [66], and during a two-week diet, 5.5 instead of 8.5 hours in bed cut fat loss by 55 % and increased lean-mass loss by 60 % [42].

### Putting it into a week

The WHO floor is 150–300 minutes of moderate or 75–150 minutes of vigorous aerobic activity plus muscle strengthening on two or more days, with balance-focused training three days a week after 65 [30]. Steps count too: mortality kept falling up to 8,000–10,000 steps a day before 60 and 6,000–8,000 after [31], and three 1–2-minute bursts of vigorous everyday activity a day were associated with 38–40 % lower mortality in people who did not exercise [67]. On three upper-body lifting days that becomes a 10–15-minute zone-2 finisher after each session, one long easy session, one 4×4 session, carries and back extensions twice a week and a few sets of hops; hip-loading lifts start in week 5 and heavy hinges in week 13 (week 1 when bone risk is high). Test VO2max every 8–12 weeks with the same field test, and let the trend, not one result, steer the plan.

---

## Decision rules / parameters

All minutes are per week unless stated. "Moderate-equivalent minutes" = moderate minutes + 2 × vigorous minutes (WHO's "equivalent combination") [30]; zone-2 and brisk-walking minutes count as moderate, the work bouts of intervals and sprints as vigorous.

### Table 1 — Weekly longevity minimum and target

| Component | Longevity minimum (from week 1) | Target (from week 8–12) | Why | Grade |
| --- | --- | --- | --- | --- |
| Resistance training | the 3 upper-body sessions (A/B/C) | same + hip/axial lifts (Table 7) | 30–60 min/week captures most of the mortality association; ≥2 days is the WHO floor [29][30] | A |
| Aerobic total | ≥150 moderate-equivalent min | 200–300 | WHO 150–300 moderate or 75–150 vigorous [30] | A |
| Zone-2 finishers | 3 × 10–15 min after lifting | 3 × 15–20 min | easy volume that does not blunt strength or hypertrophy [12] | B |
| Long zone-2 session | 1 × 45–60 min | 1 × 60–75 min | weekly sessions/volume remove "non-response" [10] | B |
| Intervals | 1 × Norwegian 4×4 (~40 min) | 1–2 (4×4, plus an optional 1×4 finisher) | 4×4 +7.2 % VO2max in 8 weeks; HIIT beats continuous by 1.2 mL/kg/min [7][6] | A/B |
| Daily steps | ≥8,000 (<60 y); ≥6,000 (≥60 y) | 8,000–10,000 (<60 y); 6,000–8,000 (≥60 y) | mortality plateau by age [31] | A |
| Vigorous "snacks" | — | stairs or brisk uphill bursts, 3 × 1–2 min/day on non-gym days | VILPA association [67] | B |
| Carries | 2 sessions (farmers-carry on C, suitcase-carry on A) | same, heavier (Table 8) | trunk stiffness, grip, standing axial load [62] | C |
| Back extension | 2 sessions (lower-back-machine on B, back-extension-45 on C) | same, loaded | fewer vertebral fractures after back-extensor training [23]; UK guidance [63] | B/C |
| Impacts | optional 2 × 10 hops on 3 days | 50 moderate impacts (5 × 10) on ≥4 days | ≥50 impacts on most days [63]; 50 hops/day raised FN BMD in older men [56] | B |
| Hip and axial lifting | none in weeks 1–4 (phase 0; phase 1 from week 1 if an accelerator applies) | weeks 5–12: leg press on day C + standing press; from week 13: 2 sessions/week of heavy hinge + squat/leg press + standing press, reaching 5 × 5 at >80–85 % 1RM by about week 25 (Table 7) | LIFTMOR, LIFTMOR-M [17][18] | B |
| Balance | 10-s one-leg-stance test every 4 weeks | 2 × 30–60 s per leg on 2–3 days; ≥3 days of multicomponent work after 65 | [43][65][30] | B/C |
| Sleep | ≥7 h | 7–9 h | [41][42] | A/B |

### Table 2 — Example week on the owner's A/B/C program (phase 0–1)

| Day | Gym work (registry slots) | Longevity add-ons | Cardio | Extra time |
| --- | --- | --- | --- | --- |
| 1 · A chest focus | A1 machine-chest-press · A2 lat-pulldown · A3 pec-deck · A4 machine-row · A5 machine-shoulder-press · A6 machine-crunch | suitcase-carry 2 × 20–30 m per side | zone-2 finisher 12–15 min (incline treadmill) | ~20 min |
| 2 | — | optional hops 2 × 10 | long zone 2, 45–60 min (incline walk, bike or outdoor walk) | 45–60 min |
| 3 · B back focus | B1 assisted-pull-up · B2 machine-incline-press · B3 seated-cable-row · B4 cable-fly · B5 face-pull · B6 lower-back-machine (back extension #1) · B7 pallof-press | phase 1: jumping chin-up 3 × 5 before B1 | zone-2 finisher 12–15 min (bike or rower) | ~15 min |
| 4 | — | — | rest or walk (steps) | — |
| 5 · C arms, shoulders, core | C1 triceps-press-machine · C2 machine-preacher-curl · C3 cable-pushdown · C4 machine-lateral-raise · C5 hammer-curl · C6 captains-chair-knee-raise · C7 farmers-carry | back-extension-45 2 × 10–15 (back extension #2) | zone-2 finisher 12–15 min | ~20 min |
| 6 | — | — | Norwegian 4×4 on bike, rower or incline treadmill | ~40 min |
| 7 | — | balance test (every 4th week) | rest or easy walk | — |

Weekly totals: zone 2 ≈ 80–105 min; 4×4 = 16 vigorous + 24 moderate min → ≈ 140–160 moderate-equivalent minutes; carries 2; back extension 2. Placement rules: finishers after lifting; the 4×4 on a non-lifting day or ≥3 h after lifting (same-session cardio mainly costs explosive strength) [12]; never two high lower-back-load exercises in one session (catalog rule), so the trap-bar deadlift goes on day A, not on day B with the lower-back machine.

### Table 3 — Intensity zones (stream 09 Karvonen bands + talk-test calibration)

| Zone | % HRR (Karvonen) | Talk test | Borg 6–20 | Use | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 Recovery | 50–60 | chat freely | 7–9 | warm-up, cool-down, walks | — |
| 2 Endurance base | 60–70; start at 60–65 until calibrated | full sentences comfortably ("positive") | 9–11 | finishers, long session | first threshold ≈ "equivocal" stage ≈ Borg 10–11 [49]; LT1 lies at 60–90 % HRmax between people [15] |
| 3 Tempo | 70–80 | speech no longer comfortable ("equivocal" → "negative") | 12–13 | rarely needed | at or above VT1 [13] |
| 4 Threshold | 80–90 | a few words ("negative") | 13–15 | rarely needed | ≈ second threshold (RCP) [49] |
| 5 VO2max intervals | 90–100 (target 90–95 % HRmax) | no talking | 15–18 | 4×4, 1×4, sprints | HR lags; the target is reached by minute 2–3 of each 4-min bout [7] |

ACSM classes 40–59 % HRR as moderate and 60–89 % HRR as vigorous [68], so the site's zone 2 starts at the bottom of ACSM's vigorous band; for an untrained person it can sit above VT1, which is why the talk test overrides it.

**Talk-test calibration (every 8–12 weeks, on the machine used most):** 5 min easy, then raise speed/grade or watts every 2 min (+0.5 km/h or +2 % grade; +15–25 W). In the last 30 s of each stage recite a ~30-word passage (the original studies used the Pledge of Allegiance) and answer "Can you speak comfortably?" yes / not entirely / no [13][14]. Zone-2 ceiling = mean HR of the last "yes" stage; zone 2 = ceiling − 10 bpm to ceiling; VT1 estimate = HR at the first "not entirely" stage. The thresholds move with training, so re-run it [14].

### Table 4 — Interval protocols

| id | Structure | Time | Evidence | Use |
| --- | --- | --- | --- | --- |
| norwegian_4x4 | 10 min warm-up at 60–70 % HRmax → 4 × 4 min at 90–95 % HRmax, each followed by 3 min at ~70 % → 5 min cool-down | ~40 min | +7.2 % VO2max in 8 weeks at 3×/week (moderately trained men) [7]; +13 % in 10 weeks (inactive men) [8] | default, 1×/week; 2×/week in a 6–8-week VO2max block |
| one_by_four | 10 min warm-up → 1 × 4 min at 90 % HRmax → 3–5 min cool-down | ~17–19 min | +10 % VO2max in 10 weeks at 3×/week [8] | replaces a zone-2 finisher on busy days |
| rehit_2x20 | bike, 10 min at ~60 W containing 2 all-out sprints (10 s in week 1, 15 s weeks 2–3, then 20 s) | 10 min | VO2peak +12–15 % in 6 weeks at 3×/week [9]; more sprints add nothing [47][69] | time-crunched weeks |
| sit_3x20 | bike, 2 min at 50 W → 3 × 20 s all-out with 2 min at 50 W between → 3 min cool-down | 10 min | VO2peak +19 % in 12 weeks, equal to 45 min of continuous cycling at ~70 % HRmax [46] | alternative to REHIT |

Rules: progress to intervals gradually and only without symptoms (site default: ≥4 weeks of regular moderate training first) [70]; ≤2 interval sessions per week; update HRmax to any higher observed peak (5-s value at the end of bout 4); in cardiometabolic patients HIIT raised VO2peak 3.0 mL/kg/min more than moderate training [71], so the same protocol suits less fit users at a lower absolute pace.

### Table 5 — Cardio machines while the legs are not lifted

| Machine | VO2max stimulus | Bone loading | Best use | Caveat |
| --- | --- | --- | --- | --- |
| Incline treadmill walk (4.5–6 km/h, 5–12 % grade) | high for beginners; 4×4 by raising grade | low–moderate hip (weight-bearing), low spine | zone 2, 4×4, Ebbeling test | walking alone barely protects bone [59] |
| Upright or recumbent bike | high; exact watts | none [60] | 4×4, REHIT/SIT, ramp test | — |
| Rower (Concept2) | high, whole body | low | zone 2, 4×4, 2k test | hinge with a neutral spine; skip on back-pain days |
| Elliptical / stair climber | high | low–moderate | zone 2, intervals | — |
| Ski-erg | moderate–high | low | variety | — |
| Arm crank | ~70 % of cycling VO2peak [11] | none | injury periods only | caps the stimulus |
| Outdoor running (later) | high | moderate impact | Cooper test | build gradually |

### Table 6 — Which exercises load the spine and the hip

| Exercise (registry id) | Spine load | Hip load | Evidence | Role |
| --- | --- | --- | --- | --- |
| trap-bar-deadlift, conventional-deadlift, barbell-rdl | high (axial + extensor) | high | deadlift in LIFTMOR, LIFTMOR-M and Hinton [17][18][55] (B) | main bone lift from phase 2 |
| barbell-back-squat, goblet-squat, hack-squat, smith-squat | high (back squat) to moderate | high | squat in LIFTMOR(-M), Hinton [17][18][55] (B) | phase 2 |
| leg-press-45, seated-leg-press, belt-squat | low (back supported or unloaded) | moderate–high | used in multicomponent programs; no head-to-head bone data (C) | phase 1 hip loading without spinal load |
| standing-barbell-overhead-press, landmine-press | high / moderate axial | low | overhead press in LIFTMOR(-M) [17][18] (B) | swap one seated press for a standing press in phase 1–2 |
| machine-shoulder-press, machine-chest-press, pec-deck, lat-pulldown, machine-row (chest-supported) | low | none | bone gains are local to the loaded limb [21] (B) | today's program: arms and shoulders only |
| seated-cable-row, barbell-row, t-bar-row | moderate (extensor pull) | low–moderate | rows were part of Hinton's program [55] (C) | keep |
| lower-back-machine, back-extension-45, reverse-hyperextension | moderate (muscle pull on vertebrae) | low | BMD unchanged at 2 y, fewer vertebral fractures at 10 y [58][23] (B/C) | 2×/week from week 1 |
| farmers-carry, suitcase-carry | moderate–high (compression, lateral moment) | moderate (loaded gait) | mechanism only [62] (C) | 2×/week |
| standing-calf-raise-machine (shoulder pads) | moderate axial | moderate axial (static) | none (C) | optional |
| hops, pogo jumps, skipping (no registry id) | low–moderate | high (ground reaction force) | 50 hops/day: FN +0.7 % vs −0.9 % [56]; jumps raised spine BMD [55] (B) | bridge for the hip in phase 0–1 |
| jumping chin-up with landing (no registry id) | moderate | moderate–high (landing) | part of LIFTMOR(-M) [17][52] (B) | fits day B |
| walking, incline walking | low | low–moderate | FN effect inconsistent, spine none [59] (A) | steps for health, not bone |
| cycling | none | none | road cyclists often have low BMD [60] (B) | VO2max only |
| machine isometric axial compression ("bone density" machines) | — | — | no BMD gain vs controls; HiRIT better at the spine [18] (B) | not recommended for bone |

Registry gap: hops and jumping chin-ups have no exercise id. Proposal for the master plan: add `pogo-hops` (unit: reps, impacts counted) and `jumping-chin-up` (unit: reps) to the core and back slices.

### Table 7 — When and how to add legs and axial loading

| Phase | Weeks | Add | Dose | Entry / progression |
| --- | --- | --- | --- | --- |
| 0 · Foundation | 1–4 | carries 2×/week; back extension 2×/week; steps; optional hops 2 × 10 on 3 days | — | baseline tests (Table 14); no pain |
| 1 · Hip load without spinal load | 5–12 (week 1 if an accelerator applies) | leg-press-45 or belt-squat on day C; landmine-press or standing dumbbell press replacing one seated press; hops to 3–5 × 10 on 3–4 days; jumping chin-up 3 × 5 on day B | leg press 2–3 × 8–10 at RIR 2–3; impacts 20 → 50 per session | next-day joint pain ≤3/10 (research 03 pain rules) |
| 2 · Heavy hinge and squat | 13–24 | trap-bar-deadlift on day A; leg press or goblet/hack squat on day C; standing overhead or landmine press | LIFTMOR-M progression: 2 weeks of light technique → 5 × 5 at the heaviest load done with good form (RPE ≥16/20) → after ~10 weeks, 5 × 5 at >80–85 % 1RM; +2.5 kg when 7 reps feel easy [52] | e1RM from logs (stream 06); RIR ≥2 until technique is stable; no loaded spinal flexion if osteoporotic [64][63] |
| 3 · Maintenance | 25+ | 2 heavy lower-body/axial exposures per week; 50 impacts on most days | 5 × 5 at 80–85 % 1RM or 3 × 5 | DXA every 1–2 years only if indicated [72] |

Accelerators (start phase 1 in week 1): a planned loss ≥10 % of body weight or a cut longer than 12 weeks [24][25]; age ≥70, or 50–69 with risk factors such as low body weight, smoking or a prior fracture (these are also the DXA-testing criteria) [72]; a known T-score ≤ −1.0; long-term glucocorticoids. A prior fragility fracture or T-score ≤ −2.5 means a supervised start and impacts limited to brisk walking until cleared [63].

### Table 8 — Carries, back extension, impacts, balance, grip

| Item | Prescription | Progression | Evidence |
| --- | --- | --- | --- |
| farmers-carry (C7) | 3–4 × 30–40 m or 30–45 s, rest 60–90 s; start ~25 % body weight per hand | +2–4 kg per hand when all sets are done upright without grip failure; long-term ~50 % BW per hand for 30 m | C (coaching standard; mechanism [62]) |
| suitcase-carry | 2 × 20–30 m per side at 20–35 % BW | +2 kg when the trunk stays vertical | C [62] |
| Back extension (lower-back-machine, back-extension-45) | 2–3 × 8–15 at RIR 2–3, twice a week; move to neutral or slight extension | +2.5–5 kg at the top of the rep range | B/C [23][63] |
| Impacts (hops, pogo, skipping) | start 2 × 10; by week 12, 5 × 10 = 50 moderate impacts per session on ≥4 days | +10 impacts per session per week if pain-free; multidirectional hops later | B [56][63]; the Australian guidance quoted in the UK statement: 4–7 days a week, 50 jumps as 3–5 × 10–20, >4 × body weight for people without osteoporosis [63] |
| Balance | test: 10-s one-leg stance (barefoot, free foot on the back of the standing leg, arms at sides, gaze fixed, up to 3 tries); practice 2 × 30–60 s per leg on 2–3 days | eyes closed, then a soft surface | failure HR 1.84 [43]; balance and functional exercise RaR 0.76 [65]; ≥3 days/week after 65 [30] |
| Grip (a test, not a goal) | dynamometer, best of 3 per hand, every 8–12 weeks; trained via carries, pulls and dead-hang | compare with PURE norms (Table 13) | [26][73][74] |

### Table 9 — Field tests the site can compute

| id | Protocol | Formula (VO2max in mL/kg/min unless stated) | Error | Use |
| --- | --- | --- | --- | --- |
| uth_hr_ratio | resting HR (7-day morning mean) and HRmax | 15.3 × HRmax / HRrest | SEE 2.7 with measured HRmax, 4.7 with predicted, in well-trained men [75]; untrained men: bias +1.9, limits of agreement ≈ −16 to +12 [76] | day-0 rough estimate; not for tracking |
| hunt_nonexercise | questionnaire | men 100.27 − 0.296·age − 0.369·waist_cm − 0.155·HRrest + 0.226·PAI; women 74.74 − 0.247·age − 0.259·waist_cm − 0.114·HRrest + 0.198·PAI | SEE 5.70 (men), 5.14 (women) [77]; non-exercise equations track the direction of change correctly only ~56 % of the time [78] | day-0 estimate; ship only after the PA-index scoring is verified |
| cooper_12min | run as far as possible in 12 min on a measured route | (distance_m − 504.9) / 44.73 | not verified here; treat like other field tests | maximal; runners only [79] |
| rockport_1mile | walk 1 mile (1,609 m) as fast as possible; HR at the finish | 132.853 − 0.0769·weight_lb − 0.3877·age + 6.315·male − 3.2649·time_min − 0.1565·HR | L/min model SEE 0.325 L/min (≈4 mL/kg/min at 80 kg) [80] | submaximal; validated at 30–69 y |
| ebbeling_treadmill | 4 min at 0 % grade at a brisk 2.0–4.5 mph giving 50–70 % HRmax, then 4 min at 5 % grade at the same speed; HR = mean of the final 30 s | 15.1 + 21.8·mph − 0.327·HR − 0.263·mph·age + 0.00504·HR·age + 5.98·male | SEE 4.85; 91 % of cross-validation within ±5 [32] | submaximal, safe alone; owner default; validated at 20–59 y |
| concept2_2k | 2,000 m all-out on a Concept2 rower | Y (L/min): male not highly trained 10.7 − 0.9·T; male highly trained 15.1 − 1.5·T (≤75 kg) or 15.7 − 1.5·T (>75 kg); female not highly trained 10.26 − 0.93·T; female highly trained 14.6 − 1.5·T (≤61.36 kg) or 14.9 − 1.5·T (>61.36 kg); VO2max = 1000·Y / kg | not published [34] | maximal; after ≥4 weeks of rowing practice |
| storer_bike_ramp | bike ramp, +15 W per min from an easy start until cadence cannot be held; Wmax = highest watts reached | men (10.51·W + 6.35·kg − 10.49·age + 519.3) / kg; women (9.39·W + 7.7·kg − 5.88·age + 136.7) / kg | SEE 212 mL/min (men), 147 mL/min (women) [33] | maximal; 20–70 y; cycle values read lower than treadmill norms [37] |
| wearable | watch estimate | vendor algorithm | resting-based: bias +2.17, limits −13.1 to +17.4; exercise-based: bias −0.09, limits ±9.8 [81]; Apple Watch S7: MAPE 15.8 % [82] | trend line only |

Global rule: exercise-based equations put only 51 % (submaximal) to 59 % (maximal) of people into the correct fitness third [35]. Store the raw performance (distance, time, watts, HR) as the primary series and the VO2max conversion as a derived value shown with its error band. Units: mph = km/h ÷ 1.609; lb = kg × 2.2046; VO2 (L/min) = VO2 (mL/kg/min) × kg / 1000.

### Table 10 — Maximal heart rate and heart-rate signals

| Item | Formula / protocol | Error or threshold | Source |
| --- | --- | --- | --- |
| HRmax, Tanaka (stream 09 default) | 208 − 0.7·age | individual error ≈ ±10 bpm (cf. HUNT SEE 10.8) | [83] |
| HRmax, HUNT | 211 − 0.64·age | SEE 10.8 bpm; older formulas under-predict after 30 | [84] |
| HRmax, Gellish | 207 − 0.7·age | longitudinal model | [85] |
| Measured HRmax | highest 5-s HR at the end of bout 4 of a 4×4 or a maximal test, if above the formula | replaces the formula | C |
| Resting HR | 7-day mean of morning HR (seated or supine, before coffee) | typical error ~10 %, smallest worthwhile change ~2 % [36]; +10 bpm ≈ +9 % all-cause mortality [86] | [36][86] |
| HRex (submaximal HR at a fixed load) | weekly, same machine and setting (e.g., treadmill 5.0 km/h at 8 % grade, or bike 100 W), 5 min after a 5-min warm-up; mean HR of the last 60 s | typical error ~3 %, SWC ~1 % → compare 4-week means: ≥5 bpm below the baseline mean = real improvement | [36] |
| HRR60 | peak HR − HR 60 s after stopping (walking cool-down), after the last 4×4 bout | ≤12 bpm was abnormal in clinical testing (adjusted RR of death 2.0) → mention to a doctor | [87] |
| HRV (optional) | Ln rMSSD, 5 min after waking | typical error ~12 %, SWC ~3 % | [36] |

### Table 11 — FRIEND 2022 treadmill VO2peak percentiles, men (mL/kg/min)

| Percentile | 20–29 | 30–39 | 40–49 | 50–59 | 60–69 | 70–79 | 80–89 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 90th | 58.6 | 55.5 | 50.8 | 43.4 | 37.1 | 29.4 | 22.8 |
| 80th | 54.5 | 50.0 | 45.2 | 38.3 | 32.0 | 25.9 | 21.4 |
| 70th | 51.9 | 46.4 | 40.9 | 34.3 | 28.7 | 23.8 | 20.0 |
| 60th | 49.0 | 43.4 | 37.9 | 31.8 | 26.5 | 22.2 | 18.4 |
| 50th | 46.5 | 39.7 | 35.3 | 29.2 | 24.6 | 20.6 | 17.6 |
| 40th | 43.6 | 37.0 | 32.4 | 26.9 | 22.8 | 19.1 | 16.6 |
| 30th | 40.0 | 33.5 | 29.7 | 24.5 | 20.7 | 17.3 | 16.1 |
| 20th | 35.2 | 29.8 | 26.7 | 22.2 | 18.5 | 15.9 | 14.8 |
| 10th | 28.6 | 24.9 | 22.1 | 18.6 | 15.8 | 13.6 | 12.9 |

Source: Kaminsky 2022, treadmill tests of 9,564 men and 6,714 women [37], values as transcribed in [88]; the RER ≥ 1.10 subset gives 50th percentiles within 1.1 mL/kg/min of these (men 45.4, 38.6, 34.8, 29.4, 24.4, 20.6, 17.7). Re-verify against the paper before publishing the numbers.

### Table 12 — FRIEND 2022 treadmill VO2peak percentiles, women (mL/kg/min)

| Percentile | 20–29 | 30–39 | 40–49 | 50–59 | 60–69 | 70–79 | 80–89 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 90th | 49.0 | 42.1 | 37.8 | 32.4 | 27.3 | 22.8 | 20.8 |
| 80th | 44.8 | 37.0 | 33.0 | 28.4 | 24.3 | 20.8 | 18.4 |
| 70th | 41.8 | 33.6 | 30.0 | 26.3 | 22.4 | 19.6 | 17.3 |
| 60th | 39.0 | 31.0 | 27.7 | 24.6 | 20.9 | 18.3 | 16.0 |
| 50th | 36.6 | 28.3 | 25.7 | 22.9 | 19.6 | 17.2 | 15.4 |
| 40th | 34.0 | 26.4 | 23.9 | 21.5 | 18.3 | 16.2 | 14.7 |
| 30th | 30.8 | 24.2 | 21.8 | 20.1 | 17.0 | 15.2 | 13.7 |
| 20th | 27.2 | 21.9 | 19.7 | 18.5 | 15.4 | 14.0 | 12.6 |
| 10th | 22.5 | 18.6 | 17.2 | 16.5 | 13.4 | 12.3 | 11.4 |

### Table 13 — Targets by age (men), categories and derived numbers

| Age | Floor: 50th | Target: 75th* | Stretch: 90th | Elite ≈97.7th** | 50th in METs | "Low" (<25th*) below |
| --- | --- | --- | --- | --- | --- | --- |
| 20–29 | 46.5 | 53.2 | 58.6 | ~65 | 13.3 | 37.6 |
| 30–39 | 39.7 | 48.2 | 55.5 | ~64 | 11.3 | 31.6 |
| 40–49 | 35.3 | 43.0 | 50.8 | ~60 | 10.1 | 28.2 |
| 50–59 | 29.2 | 36.3 | 43.4 | ~51 | 8.3 | 23.4 |
| 60–69 | 24.6 | 30.4 | 37.1 | ~44 | 7.0 | 19.6 |
| 70–79 | 20.6 | 24.9 | 29.4 | ~34 | 5.9 | 16.6 |
| 80–89 | 17.6 | 20.7 | 22.8 | ~26 | 5.0 | 15.5 |

\* 25th and 75th = means of the neighbouring deciles. \*\* Normal approximation: p50 + 2 × (p90 − p50) / 1.2816; approximate, the distribution is slightly right-skewed.

| Category (Mandsager, by age-sex percentile) | Rule | Association |
| --- | --- | --- |
| Low | <25th | HR 5.04 vs elite [3] |
| Below average | 25th–49th | HR 1.41 vs above average [3] |
| Above average | 50th–74th | the site's floor |
| High | 75th–97.6th | the site's target |
| Elite | ≥97.7th | elite vs high HR 0.77 [3] |

Other anchors: Kodama's bands — low <7.9 METs (<27.7 mL/kg/min), intermediate 7.9–10.8, high ≥10.9 METs (≥38.2) [2]; Kokkinos' lowest risk ≈14 METs [4]. Both cohorts used METs estimated from treadmill workload, so these absolute values are not one-to-one with a field test or a gas-exchange test; the site uses percentiles for targets.

Derived numbers the site shows:
- METs = VO2max / 3.5.
- Fitness age = the age at which the FRIEND 50th-percentile curve (decade midpoints 25, 35 … 85) equals the user's VO2max; linear interpolation, clamped to 20–89.
- Years of average decline "bought" = ΔVO2max / 4.0 × 10 (FRIEND median decline ≈4.0 mL/kg/min per decade [37]); +1 MET ≈ 8.8 years.
- Illustrative relative risk = 0.87^ΔMET (Kodama, assumes a log-linear association) [2]; label it "association".
- Grip vs PURE Europe/North America median (25th–75th), men: 35–40 y 50 kg (43–56), 41–50 y 49 (42–56), 51–60 y 46 (39–52), 61–70 y 42 (36–47); women: 30 (26–35), 30 (25–34), 27 (23–31), 25 (21–29) [73]. Men's peak median 51 kg at 29–39 y; weak grip <27 kg [74].

### Table 14 — Tracking schedule and decision rules

| When | What | Site computes | Rule |
| --- | --- | --- | --- |
| Day 0 | HRrest (7-day mean), weight, waist; Uth (and HUNT once verified) estimate; grip; 10-s one-leg stance; primary test: Ebbeling treadmill walk (owner default; Rockport outdoors) | VO2max, METs, FRIEND percentile, Mandsager category, fitness age | pick one primary test and keep it |
| Weekly | HRex in one zone-2 finisher; resting HR; steps; zone-2 and interval minutes | moderate-equivalent minutes; HRex 4-week mean and Theil–Sen slope (stream 06) | HRex 4-week mean ≥5 bpm below baseline = fitter |
| Every 8–12 weeks | repeat the primary test: same machine, time of day ±2 h, ≥48 h after intervals or heavy legs, same caffeine, chest strap; re-run talk-test calibration | Δ raw performance, ΔVO2max, Δpercentile, Δfitness age | real change if raw performance moves ≥4 % (the typical error of ramp Wmax [10]) or the estimate moves ≥1 SEE, and the HRex trend agrees |
| Every 6–12 months | one maximal test (Concept2 2k or bike ramp) if healthy and ≥8 weeks into training; grip; balance | same | keep maximal and submaximal series separate (different equations and errors) |
| Plateau | adherence ≥80 % and no change for 12 weeks | — | add one session a week or turn a zone-2 session into a 4×4 [10] |
| Decline | >5 % worse with good adherence | — | check sleep, illness and deficit size; deload a week; retest in 2–3 weeks |
| Fat loss | relative VO2max rises as body mass falls | show absolute (L/min) and relative (mL/kg/min) | e.g., 3.4 L/min = 37.8 at 90 kg and 41.5 at 82 kg with no change in fitness |

Expected change for planning: +4.9 (continuous) to +5.5 (intervals) mL/kg/min versus no-exercise controls in trials of healthy 18–45-year-olds [6]; interval programs of 6–13 weeks average +0.51 L/min [89]; sprint programs +8.3 %, with +0.7 % per extra week of training [47].

### Table 15 — Risk gradients for explanations (associations, not guarantees)

| Marker | Gradient | Source |
| --- | --- | --- |
| Fitness per +1 MET | all-cause mortality −13 % (RR 0.87); −11–17 % across meta-analyses | [2][1] |
| Fitness category | low vs elite HR 5.04; below vs above average HR 1.41; elite vs high HR 0.77 | [3] |
| Fitness extremes | least fit (20th percentile) vs extremely fit HR 4.09; lowest risk ≈14 METs, no upturn | [4] |
| Becoming fit | unfit → fit: −44 %; −7.9 % per extra minute of treadmill time | [5] |
| Grip | +16 % all-cause mortality per −5 kg | [26] |
| Strength | high grip HR 0.69; high knee extension HR 0.86 | [27] |
| Muscle mass index | top vs bottom quartile HR 0.80 | [28] |
| Muscle strengthening | lowest all-cause RR 0.83 at ~40 min/week; below 1 up to ~140 min/week; with aerobic RR 0.60 | [29] |
| Steps | vs ~3,600/day: HR 0.60 (~5,800), 0.55 (~7,800), 0.47 (~10,900) | [31] |
| Vigorous bursts | 3 × 1–2 min/day: −38–40 % all-cause | [67] |
| Resting HR | +9 % all-cause per +10 bpm | [86] |
| HR recovery | ≤12 bpm at 1 min: adjusted RR 2.0 | [87] |
| One-leg stance | cannot hold 10 s: HR 1.84 | [43] |
| Sleep | short RR 1.12; long RR 1.30 | [66] |
| Exercise and fractures | overall IR 0.67; supervised 0.44 | [20] |

### Table 16 — Safety and stop rules

| Situation | Rule | Source |
| --- | --- | --- |
| Known cardiovascular, metabolic or renal disease, or symptoms (chest pain, unusual breathlessness, palpitations, fainting) | medical clearance before intervals or maximal tests | [70] |
| Currently inactive | start light to moderate and progress gradually; site default ≥4 weeks before 4×4 or sprints | [70] |
| Chest pain or pressure, dizziness, disproportionate breathlessness, irregular heartbeat during a session | stop; get medical evaluation | [70] |
| Perspective | in cardiac rehabilitation: 1 cardiac arrest per ~23,000 h of supervised intervals vs ~129,000 h of moderate training; low in both | [90] |
| Training alone | maximal tests only on machines that stop instantly; phone within reach; not fasted, ill or in heat | C |
| Osteoporosis (T ≤ −2.5) or vertebral fracture | supervised start; avoid loaded spinal flexion (heavy machine crunch, sit-ups); impacts up to brisk walking until cleared | [63][64] |
| Impact soreness | next-day joint pain >3/10 → halve impacts; persistent → stop and use leg press and carries | research 03 pain rules (C) |
| HRR60 ≤12 bpm on repeated sessions | mention it to a doctor | [87] |

### Where the evidence is weak or contested (and the default used)

1. **Causality of fitness and mortality.** Cohorts only; the largest RCT (Generation 100) was underpowered against active controls [45]. Default: train VO2max anyway; trials show it lowers blood pressure and glucose and raises function [8][46].
2. **Zone 2 as a special intensity.** Contested [16]. Default: easy minutes for volume and recovery plus one or two hard sessions.
3. **Percent-of-maximum zones.** Unreliable for individuals [15]. Default: the talk test overrides; before calibration zone 2 starts at 60–65 % HRR.
4. **Upper-body-only training and the hip.** No evidence of protection; site specificity says it cannot [21][22]. Default: hip loading from week 5 (week 1 with accelerators), heavy hinge and squat from week 13.
5. **Carries and bone.** No BMD trials (C). Default: keep them for grip, trunk and standing axial load.
6. **Resistance training against diet-induced hip loss.** Conflicting: Villareal 2017 vs INVEST 2025 [61][25]. Default: moderate deficit (research 06 rate rules), adequate protein and calcium, high-load and impact loading; accept a small loss as the price of fat loss [24].
7. **LIFTMOR-M in men.** Semi-randomized with a non-randomized control; the femoral neck, the primary outcome, is not among the significant results; supervised older osteopenic men [18][52]. Default: still the best template for men; expect smaller effects with normal BMD. Calcium and vitamin D on top of adequate intake added nothing in men [57].
8. **The resistance-training J-curve.** Very low certainty [29][51]. Default: three sessions (~150 min/week) are fine; the curve shows diminishing returns, not harm.
9. **Field-test conversions.** Large individual error [35][76][81]. Default: track raw performance; show VO2max as derived with an error band.
10. **FRIEND values.** Transcribed from two identical secondary reproductions; the RER ≥ 1.10 subset differs by ≤1.1 mL/kg/min [88]. Default: use them; re-verify against the paper before publishing.
11. **HUNT activity index.** Its scoring could not be verified from an open copy of the paper [77]. Default: do not ship the HUNT estimator until checked; Uth is the day-0 fallback.
12. **Estimated vs measured METs.** Mandsager and Kokkinos used treadmill-workload METs, not gas exchange [3][4]. Default: percentiles, not absolute MET cut-offs, drive targets.

---

## Machine-readable parameters

Conventions: VO2 in mL/kg/min; `sources` hold the numbers of the Sources list below; `evidence` uses the A/B/C grades above; exercise ids are registry ids, `null` where the registry has none. Formulas are plain expressions over the named inputs.

```json longevity_protocols
{
  "id": "longevity_protocols",
  "version": "2026-11-08",
  "units": {"vo2": "mL/kg/min", "ml_kg_min_per_met": 3.5, "mass": "kg", "hr": "bpm", "mph_per_kmh": 0.62137, "lb_per_kg": 2.2046},
  "evidence_grades": {"A": "several meta-analyses or large consistent cohorts", "B": "one meta-analysis, a few RCTs, or important caveats", "C": "mechanism, consensus or coaching practice"},
  "weekly": {
    "moderate_equivalent": {"rule": "moderate_min + 2 * vigorous_min", "moderate_includes": ["zone1_brisk_walk", "zone2", "interval_warmup_recovery"], "vigorous_includes": ["interval_work_bouts", "sprints"], "sources": [30]},
    "minimum": {
      "lifting_sessions": 3,
      "aerobic_moderate_equivalent_min": 150,
      "zone2_finishers": {"count": 3, "minutes": [10, 15], "placement": "after_lifting"},
      "zone2_long": {"count": 1, "minutes": [45, 60]},
      "intervals": {"count": 1, "protocol": "norwegian_4x4"},
      "carries_sessions": 2,
      "back_extension_sessions": 2,
      "impacts": {"optional": true, "days": 3, "per_session": 20},
      "steps_per_day": {"age_lt_60": 8000, "age_ge_60": 6000},
      "balance_test_every_weeks": 4,
      "sleep_h_min": 7,
      "sources": [30, 31, 7, 63, 41],
      "evidence": "A for totals, C for the split"
    },
    "target": {
      "from_week": [8, 12],
      "aerobic_moderate_equivalent_min": [200, 300],
      "zone2_finishers": {"count": 3, "minutes": [15, 20]},
      "zone2_long": {"count": 1, "minutes": [60, 75]},
      "intervals": {"count": [1, 2], "protocols": ["norwegian_4x4", "one_by_four"]},
      "hip_axial_lifting_sessions_per_week": {"phase1_weeks_5_12": 1, "phase2_from_week_13": 2, "see": "bone.phases"},
      "impacts": {"days_min": 4, "per_session": 50},
      "steps_per_day": {"age_lt_60": [8000, 10000], "age_ge_60": [6000, 8000]},
      "vigorous_snacks": {"bouts_per_day": 3, "minutes_each": [1, 2], "days": "non_gym"},
      "sleep_h": [7, 9],
      "sources": [30, 31, 67, 17, 18, 63],
      "evidence": "B"
    },
    "owner_week_phase1": [
      {"day": 1, "program_day": "A", "add": [{"exercise": "suitcase-carry", "sets": 2, "distance_m": [20, 30], "per_side": true}], "cardio": {"type": "zone2", "minutes": [12, 15], "machine": "incline_treadmill"}},
      {"day": 2, "program_day": null, "add": [{"exercise": null, "drill": "hops", "sets": 2, "reps": 10, "optional": true}], "cardio": {"type": "zone2", "minutes": [45, 60], "machine": "incline_walk_or_bike"}},
      {"day": 3, "program_day": "B", "add": [{"exercise": null, "drill": "jumping_chin_up", "sets": 3, "reps": 5, "from_phase": 1}], "back_extension_slot": "B6", "cardio": {"type": "zone2", "minutes": [12, 15], "machine": "bike_or_rower"}},
      {"day": 4, "program_day": null, "add": [], "cardio": {"type": "walk"}},
      {"day": 5, "program_day": "C", "add": [{"exercise": "back-extension-45", "sets": 2, "reps": [10, 15]}], "carry_slot": "C7", "cardio": {"type": "zone2", "minutes": [12, 15], "machine": "any"}},
      {"day": 6, "program_day": null, "add": [], "cardio": {"type": "intervals", "protocol": "norwegian_4x4", "machine": "bike_rower_or_incline_treadmill"}},
      {"day": 7, "program_day": null, "add": [{"test": "one_leg_stance_10s", "every_weeks": 4}], "cardio": {"type": "rest_or_walk"}}
    ],
    "placement_rules": [
      "zone2 finishers after lifting",
      "intervals on a non-lifting day or >= 3 h after lifting",
      "never two high lowerBackLoad exercises in one session: trap-bar-deadlift on day A, not day B with lower-back-machine"
    ],
    "placement_sources": [12]
  },
  "zones": {
    "method": "karvonen_hrr",
    "stream09_bands_pct_hrr": [[50, 60], [60, 70], [70, 80], [80, 90], [90, 100]],
    "zone2": {"pct_hrr": [60, 70], "uncalibrated_start_pct_hrr": [60, 65], "talk_test": "positive", "borg_6_20": [9, 11]},
    "vt1_marker": {"talk_test": "equivocal", "borg_6_20": [10, 11]},
    "vt2_marker": {"talk_test": "negative", "borg_6_20": [13, 15]},
    "interval_work_pct_hrmax": [90, 95],
    "interval_recovery_pct_hrmax": 70,
    "lt1_pct_hrmax_between_people": [60, 90],
    "acsm_pct_hrr": {"moderate": [40, 59], "vigorous": [60, 89]},
    "talk_test_calibration": {
      "every_weeks": [8, 12],
      "warmup_min": 5,
      "stage_min": 2,
      "increments": {"treadmill_kmh": 0.5, "treadmill_grade_pct": 2, "bike_w": [15, 25]},
      "passage_words": 30,
      "question": "Can you speak comfortably?",
      "answers": ["yes", "not_entirely", "no"],
      "zone2_ceiling": "mean HR in the last 30 s of the last 'yes' stage",
      "zone2_band_bpm": "[ceiling - 10, ceiling]",
      "vt1_estimate": "HR at the first 'not_entirely' stage"
    },
    "sources": [13, 14, 48, 49, 15, 68, 7]
  },
  "intervals": {
    "norwegian_4x4": {"warmup_min": 10, "warmup_pct_hrmax": [60, 70], "reps": 4, "work_min": 4, "work_pct_hrmax": [90, 95], "target_reached_by_min": [2, 3], "recovery_min": 3, "recovery_pct_hrmax": 70, "cooldown_min": 5, "total_min": 40, "vigorous_min": 16, "moderate_min": 24, "effect": "VO2max +7.2% in 8 wk at 3/wk (trained men); +13% in 10 wk (inactive men)", "sources": [7, 8], "evidence": "B"},
    "one_by_four": {"warmup_min": 10, "reps": 1, "work_min": 4, "work_pct_hrmax": 90, "cooldown_min": [3, 5], "total_min": [17, 19], "vigorous_min": 4, "effect": "VO2max +10% in 10 wk at 3/wk", "sources": [8], "evidence": "B"},
    "rehit_2x20": {"modality": "bike", "total_min": 10, "easy_w": 60, "sprints": 2, "sprint_s_progression": [10, 15, 15, 20, 20, 20], "effect": "VO2peak +12-15% in 6 wk at 3/wk", "sources": [9, 47, 69], "evidence": "B"},
    "sit_3x20": {"modality": "bike", "warmup_min": 2, "warmup_w": 50, "sprints": 3, "sprint_s": 20, "recovery_min": 2, "recovery_w": 50, "cooldown_min": 3, "total_min": 10, "effect": "VO2peak +19% in 12 wk, equal to 45 min continuous", "sources": [46], "evidence": "B"},
    "rules": {"prerequisite_weeks_moderate": 4, "max_per_week": 2, "block_weeks_at_2_per_week": [6, 8], "update_hrmax_if_observed_higher": true, "sources": [70, 12, 71]}
  },
  "cardio_machines": [
    {"id": "incline_treadmill", "vo2_stimulus": "high", "hip_load": "low_moderate", "spine_load": "low", "uses": ["zone2", "norwegian_4x4", "ebbeling_treadmill"], "sources": [59]},
    {"id": "bike", "vo2_stimulus": "high", "hip_load": "none", "spine_load": "none", "uses": ["norwegian_4x4", "rehit_2x20", "sit_3x20", "storer_bike_ramp"], "sources": [60]},
    {"id": "rower", "vo2_stimulus": "high", "hip_load": "low", "spine_load": "low", "uses": ["zone2", "norwegian_4x4", "concept2_2k"], "caveat": "neutral-spine hinge; skip on back-pain days"},
    {"id": "elliptical_or_stair", "vo2_stimulus": "high", "hip_load": "low_moderate", "spine_load": "low", "uses": ["zone2", "intervals"]},
    {"id": "ski_erg", "vo2_stimulus": "moderate_high", "hip_load": "low", "spine_load": "low", "uses": ["variety"]},
    {"id": "arm_crank", "vo2_stimulus": "low", "relative_to_cycling_peak": 0.7, "hip_load": "none", "spine_load": "none", "uses": ["injury_only"], "sources": [11]}
  ],
  "bone": {
    "principle": "site-specific, high-magnitude, high-rate strain; 2 x 30 min/week of 5x5 >80-85% 1RM plus impacts for 8 months moved BMD 1-4%",
    "trial_results": [
      {"id": "liftmor", "population": "101 postmenopausal women, low bone mass", "dose": "2 x 30 min/wk, 8 mo, 5x5 >85% 1RM + jumping chin-ups", "ls_pct": [2.9, -1.2], "fn_pct": [0.3, -1.9], "height_cm": [0.2, -0.2], "sources": [17]},
      {"id": "liftmor_m_hirit", "population": "93 men, 67 y, osteopenia", "dose": "2 x 30 min/wk, 8 mo", "ls_pct": [4.1, 0.9], "trochanter_pct": [2.8, -0.1], "lean_mass_pct": [1.5, -2.4], "sources": [18]},
      {"id": "liftmor_m_isometric_machine", "bmd_vs_control": "no significant gain", "ls_pct_vs_hirit": [2.0, 4.1], "sources": [18]},
      {"id": "hinton_rt_or_jump", "population": "38 osteopenic men, 44 y", "dose": "RT 2/wk or jumps 3/wk (<=100), 12 mo", "ls_pct_pooled": 1.3, "total_hip_pct_rt": 0.8, "sources": [55]},
      {"id": "allison_hops", "population": "35 men, 70 y", "dose": "50 multidirectional hops/day on one leg, 12 mo", "fn_pct": [0.7, -0.9], "sources": [56]},
      {"id": "kukuljan_rt_impact", "population": "180 men, 50-79 y", "dose": "RT + impact 3/wk, 18 mo", "fn_abmd_pct": 1.9, "ls_trabecular_pct": 2.2, "sources": [57]},
      {"id": "intensity_meta", "ls_g_cm2": {"high": 0.031, "moderate": 0.012, "low": 0.010}, "sources": [19]},
      {"id": "men_meta", "smd": {"ls": 0.38, "fn": 0.25}, "alt_meta_g": {"fn": 0.21, "ls": 0.10}, "sources": [53, 54]},
      {"id": "fractures_meta", "ir_overall": 0.67, "ir_major": 0.69, "ir_supervised": 0.44, "sources": [20]}
    ],
    "loading_map": [
      {"exercises": ["trap-bar-deadlift", "conventional-deadlift", "barbell-rdl"], "spine": "high", "hip": "high", "role": "phase2_main", "evidence": "B", "sources": [17, 18, 55]},
      {"exercises": ["barbell-back-squat", "goblet-squat", "hack-squat", "smith-squat"], "spine": "moderate_high", "hip": "high", "role": "phase2", "evidence": "B", "sources": [17, 18, 55]},
      {"exercises": ["leg-press-45", "seated-leg-press", "belt-squat"], "spine": "low", "hip": "moderate_high", "role": "phase1_hip_without_spine", "evidence": "C"},
      {"exercises": ["standing-barbell-overhead-press", "landmine-press"], "spine": "moderate_high", "hip": "low", "role": "phase1_swap_one_seated_press", "evidence": "B", "sources": [17, 18]},
      {"exercises": ["machine-shoulder-press", "machine-chest-press", "pec-deck", "lat-pulldown", "machine-row"], "spine": "low", "hip": "none", "role": "current_program_arms_only", "evidence": "B", "sources": [21]},
      {"exercises": ["seated-cable-row", "barbell-row", "t-bar-row"], "spine": "moderate", "hip": "low_moderate", "role": "keep", "evidence": "C", "sources": [55]},
      {"exercises": ["lower-back-machine", "back-extension-45", "reverse-hyperextension"], "spine": "moderate", "hip": "low", "role": "from_week1_2_per_week", "evidence": "B", "sources": [58, 23]},
      {"exercises": ["farmers-carry", "suitcase-carry"], "spine": "moderate_high", "hip": "moderate", "role": "from_week1_2_per_week", "evidence": "C", "sources": [62]},
      {"exercises": ["standing-calf-raise-machine"], "spine": "moderate", "hip": "moderate", "role": "optional", "evidence": "C"},
      {"exercises": [null], "drill": "hops", "spine": "low_moderate", "hip": "high", "role": "phase0_1_bridge", "evidence": "B", "sources": [56, 55]},
      {"exercises": [null], "drill": "jumping_chin_up", "spine": "moderate", "hip": "moderate_high", "role": "day_B_from_phase1", "evidence": "B", "sources": [17, 52]},
      {"exercises": [null], "drill": "walking", "spine": "low", "hip": "low_moderate", "role": "steps_not_bone", "evidence": "A", "sources": [59]},
      {"exercises": [null], "drill": "cycling", "spine": "none", "hip": "none", "role": "vo2_only", "evidence": "B", "sources": [60]},
      {"exercises": [null], "drill": "isometric_axial_compression_machine", "spine": "unknown", "hip": "unknown", "role": "not_recommended_for_bone", "evidence": "B", "sources": [18]}
    ],
    "registry_gaps": [{"proposed_id": "pogo-hops", "unit": "reps", "slice": "core"}, {"proposed_id": "jumping-chin-up", "unit": "reps", "slice": "back-neck"}],
    "phases": [
      {"phase": 0, "weeks": [1, 4], "add": ["farmers-carry", "suitcase-carry", "lower-back-machine", "back-extension-45", "hops_optional"], "impacts_per_session": 20},
      {"phase": 1, "weeks": [5, 12], "add": ["leg-press-45|belt-squat", "landmine-press|standing_dumbbell_press", "jumping_chin_up", "hops"], "leg_press": {"sets": [2, 3], "reps": [8, 10], "rir": [2, 3]}, "impacts_per_session": [20, 50], "impact_days": [3, 4], "gate": "next-day joint pain <= 3/10"},
      {"phase": 2, "weeks": [13, 24], "add": ["trap-bar-deadlift", "leg-press-45|goblet-squat|hack-squat", "standing-barbell-overhead-press|landmine-press"], "progression": {"technique_weeks": 2, "build": "5x5 at heaviest load with good form, RPE >= 16/20", "build_weeks": 10, "main": "5x5 > 80-85% 1RM", "increment_kg": 2.5, "increment_when": "7 reps feel easy"}, "frequency_per_week": 2, "rir_min_until_stable": 2, "sources": [52, 17]},
      {"phase": 3, "weeks": [25, null], "frequency_per_week": 2, "dose": "5x5 at 80-85% 1RM or 3x5", "impacts_per_session": 50, "impact_days_min": 4}
    ],
    "accelerators_start_phase1_week1": ["planned_loss_pct_bw >= 10", "cut_weeks > 12", "age >= 70", "age 50-69 with risk factors (low body weight, smoking, prior fracture)", "t_score <= -1.0", "long_term_glucocorticoids"],
    "supervised_start_if": ["t_score <= -2.5", "prior_fragility_fracture", "vertebral_fracture"],
    "osteoporosis_rules": {"avoid": "loaded spinal flexion (heavy machine-crunch, sit-ups)", "impact_cap": "brisk walking until cleared", "sources": [63, 64]},
    "dieting": {"hip_bmd_change_g_cm2": [-0.015, -0.010], "hip_bmd_change_pct_approx": [-1.5, -1.0], "rt_vs_aerobic_hip_pct": [-0.5, -3.0], "invest_hip_pct_all_groups": [-1.9, -1.2], "default": "moderate deficit, adequate protein and calcium, high-load and impact loading", "sources": [24, 61, 25], "evidence": "B (conflicting)"},
    "dxa": {"test_men_if": ["age >= 70", "age 50-69 with risk factors"], "repeat_years": [1, 2], "sources": [72]},
    "calcium_vitd_extra_benefit_if_replete": false,
    "calcium_vitd_sources": [57]
  },
  "carries": {
    "farmers-carry": {"sets": [3, 4], "distance_m": [30, 40], "seconds": [30, 45], "rest_s": [60, 90], "start_load_pct_bw_per_hand": 25, "increment_kg_per_hand": [2, 4], "long_term_pct_bw_per_hand": 50, "long_term_distance_m": 30, "evidence": "C", "sources": [62]},
    "suitcase-carry": {"sets": 2, "distance_m": [20, 30], "per_side": true, "load_pct_bw": [20, 35], "increment_kg": 2, "evidence": "C", "sources": [62]}
  },
  "back_extension": {"exercises": ["lower-back-machine", "back-extension-45"], "sessions_per_week": 2, "sets": [2, 3], "reps": [8, 15], "rir": [2, 3], "increment_kg": [2.5, 5], "range": "to neutral or slight extension", "evidence": "B/C", "sources": [23, 63]},
  "impacts": {"start": {"sets": 2, "reps": 10}, "target": {"sets": 5, "reps": 10, "days_min": 4, "by_week": 12}, "progression_per_week": 10, "australian_guidance": {"days": [4, 7], "jumps": 50, "sets": [3, 5], "reps": [10, 20], "rest_min": [1, 2], "grf_x_bw_min": 4}, "evidence": "B", "sources": [56, 63]},
  "balance": {"test": {"id": "one_leg_stance_10s", "barefoot": true, "free_foot": "on back of standing leg", "arms": "at sides", "attempts": 3, "pass_s": 10, "fail_hr_mortality": 1.84}, "practice": {"sets": 2, "seconds": [30, 60], "per_leg": true, "days": [2, 3]}, "age_ge_65_multicomponent_days_min": 3, "sources": [43, 65, 30]},
  "grip": {
    "test": {"device": "hand dynamometer", "trials_per_hand": 3, "score": "best", "every_weeks": [8, 12]},
    "pure_europe_north_america_median_iqr_kg": {
      "men": {"35-40": [50, 43, 56], "41-50": [49, 42, 56], "51-60": [46, 39, 52], "61-70": [42, 36, 47]},
      "women": {"35-40": [30, 26, 35], "41-50": [30, 25, 34], "51-60": [27, 23, 31], "61-70": [25, 21, 29]}
    },
    "men_peak_median_kg": 51,
    "men_weak_kg_below": 27,
    "hr_per_5kg_lower": 1.16,
    "sources": [73, 74, 26]
  },
  "field_tests": [
    {"id": "uth_hr_ratio", "kind": "resting", "inputs": ["hr_max", "hr_rest"], "formula": "15.3 * hr_max / hr_rest", "output": "vo2max", "see": {"measured_hrmax": 2.7, "predicted_hrmax": 4.7, "population": "well-trained men"}, "untrained_men": {"bias": 1.9, "loa": [-16, 12]}, "use": "day0_only", "sources": [75, 76]},
    {"id": "hunt_nonexercise", "kind": "questionnaire", "inputs": ["age", "waist_cm", "hr_rest", "pa_index", "sex"], "formula": {"male": "100.27 - 0.296*age - 0.369*waist_cm - 0.155*hr_rest + 0.226*pa_index", "female": "74.74 - 0.247*age - 0.259*waist_cm - 0.114*hr_rest + 0.198*pa_index"}, "output": "vo2max", "see": {"male": 5.70, "female": 5.14}, "status": "blocked_until_pa_index_scoring_verified", "sources": [77, 78]},
    {"id": "cooper_12min", "kind": "maximal", "inputs": ["distance_m"], "formula": "(distance_m - 504.9) / 44.73", "output": "vo2max", "valid_distance_m": [1000, 5000], "use": "runners", "sources": [79]},
    {"id": "rockport_1mile", "kind": "submaximal", "inputs": ["weight_kg", "age", "male", "time_min", "hr_end"], "formula": "132.853 - 0.0769*(weight_kg*2.2046) - 0.3877*age + 6.315*male - 3.2649*time_min - 0.1565*hr_end", "output": "vo2max", "see_l_min": 0.325, "valid_age": [30, 69], "sources": [80]},
    {"id": "ebbeling_treadmill", "kind": "submaximal", "protocol": {"stage1": {"min": 4, "grade_pct": 0, "speed_mph": [2.0, 4.5], "target_pct_hrmax": [50, 70]}, "stage2": {"min": 4, "grade_pct": 5, "speed": "same"}, "hr": "mean of final 30 s of stage 2"}, "inputs": ["speed_mph", "hr", "age", "male"], "formula": "15.1 + 21.8*speed_mph - 0.327*hr - 0.263*speed_mph*age + 0.00504*hr*age + 5.98*male", "output": "vo2max", "see": 4.85, "valid_age": [20, 59], "owner_default": true, "sources": [32]},
    {"id": "concept2_2k", "kind": "maximal", "inputs": ["time_min", "weight_kg", "sex", "highly_trained"], "formula_y_l_min": {"male_untrained": "10.7 - 0.9*time_min", "male_trained_le75kg": "15.1 - 1.5*time_min", "male_trained_gt75kg": "15.7 - 1.5*time_min", "female_untrained": "10.26 - 0.93*time_min", "female_trained_le61_36kg": "14.6 - 1.5*time_min", "female_trained_gt61_36kg": "14.9 - 1.5*time_min"}, "formula": "1000 * y_l_min / weight_kg", "output": "vo2max", "prerequisite_weeks_rowing": 4, "sources": [34]},
    {"id": "storer_bike_ramp", "kind": "maximal", "protocol": {"ramp_w_per_min": 15, "end": "cadence cannot be held", "wmax": "highest watts reached"}, "inputs": ["wmax", "weight_kg", "age", "sex"], "formula": {"male": "(10.51*wmax + 6.35*weight_kg - 10.49*age + 519.3) / weight_kg", "female": "(9.39*wmax + 7.7*weight_kg - 5.88*age + 136.7) / weight_kg"}, "output": "vo2max", "see_ml_min": {"male": 212, "female": 147}, "valid_age": [20, 70], "modality_note": "cycle values read lower than treadmill norms", "sources": [33, 37]},
    {"id": "wearable", "kind": "device", "error": {"resting_based": {"bias": 2.17, "loa": [-13.07, 17.41]}, "exercise_based": {"bias": -0.09, "loa": [-9.92, 9.74]}, "apple_watch_s7_mape_pct": 15.79}, "use": "trend_only", "sources": [81, 82]}
  ],
  "field_test_rules": {"primary_series": "raw performance (distance, time, watts, hr)", "derived_series": "vo2max with error band", "correct_tertile_pct": {"submaximal": 51, "maximal": 59, "nonexercise": 52}, "one_primary_test": true, "sources": [35, 78]},
  "heart_rate": {
    "hrmax_equations": {"tanaka": "208 - 0.7*age", "nes_hunt": "211 - 0.64*age", "gellish": "207 - 0.7*age", "default": "tanaka", "see_bpm": {"nes_hunt": 10.8}, "prefer_measured": "highest 5-s HR at end of 4x4 bout 4 or maximal test", "sources": [83, 84, 85]},
    "resting_hr": {"window_days": 7, "typical_error_pct": 10, "swc_pct": 2, "mortality_rr_per_10bpm": 1.09, "sources": [36, 86]},
    "hrex": {"frequency": "weekly", "warmup_min": 5, "fixed_load_min": 5, "record": "mean HR of last 60 s", "example_loads": ["treadmill 5.0 km/h at 8% grade", "bike 100 W"], "typical_error_pct": 3, "swc_pct": 1, "improvement_rule": "4-week mean >= 5 bpm below baseline 4-week mean", "sources": [36]},
    "hrr60": {"definition": "peak HR minus HR 60 s after stopping (walking cool-down)", "abnormal_le_bpm": 12, "adjusted_rr": 2.0, "action": "mention to a doctor if repeated", "sources": [87]},
    "hrv": {"metric": "ln_rmssd", "minutes": 5, "typical_error_pct": 12, "swc_pct": 3, "optional": true, "sources": [36]}
  },
  "friend_2022_treadmill_percentiles": {
    "note": "Kaminsky 2022 treadmill CPET, 9,564 men and 6,714 women; transcribed from two identical secondary reproductions; RER>=1.10 subset 50th percentiles differ by <= 1.1; re-verify before publishing",
    "percentiles": [90, 80, 70, 60, 50, 40, 30, 20, 10],
    "men": {
      "20-29": [58.6, 54.5, 51.9, 49.0, 46.5, 43.6, 40.0, 35.2, 28.6],
      "30-39": [55.5, 50.0, 46.4, 43.4, 39.7, 37.0, 33.5, 29.8, 24.9],
      "40-49": [50.8, 45.2, 40.9, 37.9, 35.3, 32.4, 29.7, 26.7, 22.1],
      "50-59": [43.4, 38.3, 34.3, 31.8, 29.2, 26.9, 24.5, 22.2, 18.6],
      "60-69": [37.1, 32.0, 28.7, 26.5, 24.6, 22.8, 20.7, 18.5, 15.8],
      "70-79": [29.4, 25.9, 23.8, 22.2, 20.6, 19.1, 17.3, 15.9, 13.6],
      "80-89": [22.8, 21.4, 20.0, 18.4, 17.6, 16.6, 16.1, 14.8, 12.9]
    },
    "women": {
      "20-29": [49.0, 44.8, 41.8, 39.0, 36.6, 34.0, 30.8, 27.2, 22.5],
      "30-39": [42.1, 37.0, 33.6, 31.0, 28.3, 26.4, 24.2, 21.9, 18.6],
      "40-49": [37.8, 33.0, 30.0, 27.7, 25.7, 23.9, 21.8, 19.7, 17.2],
      "50-59": [32.4, 28.4, 26.3, 24.6, 22.9, 21.5, 20.1, 18.5, 16.5],
      "60-69": [27.3, 24.3, 22.4, 20.9, 19.6, 18.3, 17.0, 15.4, 13.4],
      "70-79": [22.8, 20.8, 19.6, 18.3, 17.2, 16.2, 15.2, 14.0, 12.3],
      "80-89": [20.8, 18.4, 17.3, 16.0, 15.4, 14.7, 13.7, 12.6, 11.4]
    },
    "rer_ge_1_10_men_p50": {"20-29": 45.4, "30-39": 38.6, "40-49": 34.8, "50-59": 29.4, "60-69": 24.4, "70-79": 20.6, "80-89": 17.7},
    "decline_per_decade": {"pct": 13.5, "ml_kg_min": 4.0},
    "sources": [37, 88]
  },
  "targets": {
    "percentile_lookup": "use the user's age decade and sex; linear interpolation between listed percentiles; below 10th -> '<10', above 90th -> '>90'",
    "p25": "mean of p20 and p30",
    "p75": "mean of p70 and p80",
    "elite_p97_7_approx": "p50 + 2 * (p90 - p50) / 1.2816",
    "floor_percentile": 50,
    "target_percentile": 75,
    "target_horizon_months": [12, 24],
    "stretch_percentile": 90,
    "mandsager_categories": [
      {"id": "low", "percentile": [0, 25], "hr_vs_elite": 5.04},
      {"id": "below_average", "percentile": [25, 50], "hr_vs_above_average": 1.41},
      {"id": "above_average", "percentile": [50, 75]},
      {"id": "high", "percentile": [75, 97.7]},
      {"id": "elite", "percentile": [97.7, 100], "hr_vs_high": 0.77}
    ],
    "kodama_met_bands": {"low_lt": 7.9, "intermediate": [7.9, 10.8], "high_ge": 10.9, "rr_per_met": 0.87},
    "kokkinos_lowest_risk_mets": 14,
    "absolute_mets_caveat": "cohort METs were estimated from treadmill workload; use percentiles for targets",
    "fitness_age": {"curve": "FRIEND p50 by sex", "midpoints": [25, 35, 45, 55, 65, 75, 85], "method": "linear interpolation, clamp 20-89"},
    "years_bought_per_ml_kg_min": 2.5,
    "illustrative_rr": "0.87 ^ delta_mets (association)",
    "expected_gain_ml_kg_min": {"continuous_6_12wk": 4.9, "intervals_6_12wk": 5.5, "interval_programs_l_min": 0.51, "sit_pct": 8.3, "sit_pct_per_extra_week": 0.7},
    "sources": [3, 2, 4, 37, 6, 89, 47]
  },
  "tracking_plan": {
    "day0": ["hr_rest_7d", "weight", "waist", "uth_hr_ratio", "grip", "one_leg_stance_10s", "ebbeling_treadmill"],
    "weekly": ["hrex", "resting_hr_7d", "steps", "zone2_min", "interval_min"],
    "retest_weeks": [8, 12],
    "retest_standardization": ["same machine", "time of day +/- 2 h", ">= 48 h after intervals or heavy legs", "same caffeine", "chest-strap HR"],
    "maximal_test_months": [6, 12],
    "maximal_test_prerequisite_weeks": 8,
    "real_change": {"raw_performance_pct": 4, "or_estimate_see": 1, "confirm_with": "hrex trend"},
    "plateau": {"adherence_min_pct": 80, "weeks": 12, "action": "add one session per week or convert a zone-2 session to norwegian_4x4"},
    "decline": {"pct": 5, "action": "check sleep, illness, deficit; deload one week; retest in 2-3 weeks"},
    "show_absolute_and_relative": true,
    "sources": [10, 36, 35]
  },
  "risk_gradients": [
    {"marker": "cardiorespiratory fitness", "per": "+1 MET", "rr": 0.87, "range_pct_lower": [11, 17], "sources": [2, 1]},
    {"marker": "fitness category", "comparison": "low vs elite", "hr": 5.04, "sources": [3]},
    {"marker": "fitness extremes", "comparison": "20th percentile vs extremely fit", "hr": 4.09, "sources": [4]},
    {"marker": "becoming fit", "comparison": "unfit to fit vs stayed unfit", "pct_lower": 44, "sources": [5]},
    {"marker": "grip", "per": "-5 kg", "hr": 1.16, "sources": [26]},
    {"marker": "grip high vs low", "hr": 0.69, "sources": [27]},
    {"marker": "muscle mass index", "comparison": "Q4 vs Q1", "hr": 0.80, "sources": [28]},
    {"marker": "muscle strengthening", "best_min_per_week": 40, "rr": 0.83, "below_1_up_to_min": 140, "with_aerobic_rr": 0.60, "sources": [29]},
    {"marker": "steps", "quartile_medians": [3553, 5801, 7842, 10901], "hr": [1.0, 0.60, 0.55, 0.47], "sources": [31]},
    {"marker": "vigorous bursts", "bouts_per_day": 3, "pct_lower": [38, 40], "sources": [67]},
    {"marker": "resting hr", "per": "+10 bpm", "rr": 1.09, "sources": [86]},
    {"marker": "hr recovery", "threshold_bpm": 12, "adjusted_rr": 2.0, "sources": [87]},
    {"marker": "one-leg stance", "comparison": "fail 10 s", "hr": 1.84, "sources": [43]},
    {"marker": "sleep", "short_rr": 1.12, "long_rr": 1.30, "sources": [66]},
    {"marker": "exercise and fractures", "ir_overall": 0.67, "ir_supervised": 0.44, "sources": [20]}
  ],
  "safety": [
    {"if": "known cardiovascular, metabolic or renal disease, or symptoms", "then": "medical clearance before intervals or maximal tests", "sources": [70]},
    {"if": "currently inactive", "then": "start light to moderate and progress gradually; site default 4 weeks before intervals", "sources": [70]},
    {"if": "chest pain, dizziness, disproportionate breathlessness, irregular heartbeat", "then": "stop and seek medical evaluation", "sources": [70]},
    {"if": "training alone", "then": "maximal tests only on machines that stop instantly; phone in reach; not fasted, ill or in heat", "evidence": "C"},
    {"if": "t_score <= -2.5 or vertebral fracture", "then": "supervised start; no loaded spinal flexion; impacts up to brisk walking", "sources": [63, 64]},
    {"if": "next-day joint pain > 3/10 after impacts", "then": "halve impacts; persistent pain -> leg press and carries instead", "evidence": "C"},
    {"if": "hrr60 <= 12 bpm repeatedly", "then": "mention to a doctor", "sources": [87]},
    {"context": "cardiac rehab event rate", "hiit_h_per_event": 23182, "moderate_h_per_event": 129456, "sources": [90]}
  ],
  "protein": {"older_adults_g_per_kg_min": [1.0, 1.2], "active_older_g_per_kg_min": 1.2, "plateau_g_per_kg": 1.62, "older_men_per_meal_g_per_kg": 0.40, "young_men_per_meal_g_per_kg": 0.24, "fat_loss_rule": "research 06: 1.6-2.2 g/kg", "sources": [39, 38, 40]},
  "sleep": {"min_h": 7, "short_sleep_rr": 1.12, "long_sleep_rr": 1.30, "diet_sleep_restriction": {"hours": [8.5, 5.5], "fat_loss_kg": [1.4, 0.6], "ffm_loss_kg": [1.5, 2.4]}, "sources": [41, 66, 42]}
}
```

---

## Sources

1. Lang JJ, Prince SA, Merucci K, et al. Cardiorespiratory fitness is a strong and consistent predictor of morbidity and mortality among adults: an overview of meta-analyses representing over 20.9 million observations from 199 unique cohort studies. *Br J Sports Med* 2024;58(10):556–566. https://doi.org/10.1136/bjsports-2023-107849
2. Kodama S, Saito K, Tanaka S, et al. Cardiorespiratory fitness as a quantitative predictor of all-cause mortality and cardiovascular events in healthy men and women: a meta-analysis. *JAMA* 2009;301(19):2024–2035. https://doi.org/10.1001/jama.2009.681
3. Mandsager K, Harb S, Cremer P, Phelan D, Nissen SE, Jaber W. Association of Cardiorespiratory Fitness With Long-term Mortality Among Adults Undergoing Exercise Treadmill Testing. *JAMA Netw Open* 2018;1(6):e183605. https://doi.org/10.1001/jamanetworkopen.2018.3605
4. Kokkinos P, Faselis C, Samuel IBH, Pittaras A, Doumas M, Murphy R, Heimall MS, Sui X, Zhang J, Myers J. Cardiorespiratory Fitness and Mortality Risk Across the Spectra of Age, Race, and Sex. *J Am Coll Cardiol* 2022;80(6):598–609. https://doi.org/10.1016/j.jacc.2022.05.031
5. Blair SN, Kohl HW 3rd, Barlow CE, Paffenbarger RS Jr, Gibbons LW, Macera CA. Changes in physical fitness and all-cause mortality: a prospective study of healthy and unhealthy men. *JAMA* 1995;273(14):1093–1098. https://pubmed.ncbi.nlm.nih.gov/7707596/
6. Milanović Z, Sporiš G, Weston M. Effectiveness of High-Intensity Interval Training (HIT) and Continuous Endurance Training for VO2max Improvements: A Systematic Review and Meta-Analysis of Controlled Trials. *Sports Med* 2015;45(10):1469–1481. https://doi.org/10.1007/s40279-015-0365-0
7. Helgerud J, Høydal K, Wang E, et al. Aerobic high-intensity intervals improve VO2max more than moderate training. *Med Sci Sports Exerc* 2007;39(4):665–671. https://doi.org/10.1249/mss.0b013e3180304570
8. Tjønna AE, Leinan IM, Bartnes AT, Jenssen BM, Gibala MJ, Winett RA, Wisløff U. Low- and high-volume of intensive endurance training significantly improves maximal oxygen uptake after 10-weeks of training in healthy men. *PLoS One* 2013;8(5):e65382. https://doi.org/10.1371/journal.pone.0065382
9. Metcalfe RS, Babraj JA, Fawkner SG, Vollaard NBJ. Towards the minimal amount of exercise for improving metabolic health: beneficial effects of reduced-exertion high-intensity interval training. *Eur J Appl Physiol* 2012;112(7):2767–2775. https://doi.org/10.1007/s00421-011-2254-z
10. Montero D, Lundby C. Refuting the myth of non-response to exercise training: 'non-responders' do respond to higher dose of training. *J Physiol* 2017;595(11):3377–3387. https://doi.org/10.1113/JP273480
11. Price MJ, Smith PM, Bottoms LM, Hill MW. The effect of age and sex on peak oxygen uptake during upper and lower body exercise: A systematic review. *Exp Gerontol* 2024;190:112427. https://doi.org/10.1016/j.exger.2024.112427
12. Schumann M, Feuerbacher JF, Sünkeler M, Freitag N, Rønnestad BR, Doma K, Lundberg TR. Compatibility of Concurrent Aerobic and Strength Training for Skeletal Muscle Size and Function: An Updated Systematic Review and Meta-Analysis. *Sports Med* 2022;52(3):601–612. https://doi.org/10.1007/s40279-021-01587-7
13. Persinger R, Foster C, Gibson M, Fater DC, Porcari JP. Consistency of the talk test for exercise prescription. *Med Sci Sports Exerc* 2004;36(9):1632–1636. https://pubmed.ncbi.nlm.nih.gov/15354048/
14. Foster C, Porcari JP, Anderson J, et al. The talk test as a marker of exercise training intensity. *J Cardiopulm Rehabil Prev* 2008;28(1):24–30. https://doi.org/10.1097/01.HCR.0000311504.41775.78
15. Iannetta D, Inglis EC, Mattu AT, Fontana FY, Pogliaghi S, Keir DA, Murias JM. A Critical Evaluation of Current Methods for Exercise Prescription in Women and Men. *Med Sci Sports Exerc* 2020;52(2):466–473. https://doi.org/10.1249/MSS.0000000000002147
16. Storoschuk KL, Moran-MacDonald A, Gibala MJ, Gurd BJ. Much Ado About Zone 2: A Narrative Review Assessing the Efficacy of Zone 2 Training for Improving Mitochondrial Capacity and Cardiorespiratory Fitness in the General Population. *Sports Med* 2025;55(7):1611–1624. https://doi.org/10.1007/s40279-025-02261-y
17. Watson SL, Weeks BK, Weis LJ, Harding AT, Horan SA, Beck BR. High-Intensity Resistance and Impact Training Improves Bone Mineral Density and Physical Function in Postmenopausal Women With Osteopenia and Osteoporosis: The LIFTMOR Randomized Controlled Trial. *J Bone Miner Res* 2018;33(2):211–220. https://doi.org/10.1002/jbmr.3284
18. Harding AT, Weeks BK, Lambert C, Watson SL, Weis LJ, Beck BR. A Comparison of Bone-Targeted Exercise Strategies to Reduce Fracture Risk in Middle-Aged and Older Men with Osteopenia and Osteoporosis: LIFTMOR-M Semi-Randomized Controlled Trial. *J Bone Miner Res* 2020;35(8):1404–1414. https://doi.org/10.1002/jbmr.4008
19. Kistler-Fischbacher M, Weeks BK, Beck BR. The effect of exercise intensity on bone in postmenopausal women (part 2): A meta-analysis. *Bone* 2021;143:115697. https://doi.org/10.1016/j.bone.2020.115697
20. Hoffmann I, Shojaa M, Kohl M, et al. Exercise Reduces the Number of Overall and Major Osteoporotic Fractures in Adults. Does Supervision Make a Difference? Systematic Review and Meta-Analysis. *J Bone Miner Res* 2022;37(11):2132–2148. https://doi.org/10.1002/jbmr.4683
21. Kannus P, Haapasalo H, Sankelo M, Sievänen H, Pasanen M, Heinonen A, Oja P, Vuori I. Effect of starting age of physical activity on bone mass in the dominant arm of tennis and squash players. *Ann Intern Med* 1995;123(1):27–31. https://doi.org/10.7326/0003-4819-123-1-199507010-00003
22. Winters-Stone KM, Snow CM. Site-specific response of bone to exercise in premenopausal women. *Bone* 2006;39(6):1203–1209. https://doi.org/10.1016/j.bone.2006.06.005
23. Sinaki M, Itoi E, Wahner HW, et al. Stronger back muscles reduce the incidence of vertebral fractures: a prospective 10 year follow-up of postmenopausal women. *Bone* 2002;30(6):836–841. https://doi.org/10.1016/s8756-3282(02)00739-1
24. Zibellini J, Seimon RV, Lee CM, et al. Does Diet-Induced Weight Loss Lead to Bone Loss in Overweight or Obese Adults? A Systematic Review and Meta-Analysis of Clinical Trials. *J Bone Miner Res* 2015;30(12):2168–2178. https://doi.org/10.1002/jbmr.2564
25. Beavers KM, Lynch SD, Fanning J, et al. Weighted Vest Use or Resistance Exercise to Offset Weight Loss–Associated Bone Loss in Older Adults: A Randomized Clinical Trial. *JAMA Netw Open* 2025;8(6):e2516772. https://doi.org/10.1001/jamanetworkopen.2025.16772
26. Leong DP, Teo KK, Rangarajan S, et al.; PURE Study investigators. Prognostic value of grip strength: findings from the Prospective Urban Rural Epidemiology (PURE) study. *Lancet* 2015;386(9990):266–273. https://doi.org/10.1016/S0140-6736(14)62000-6
27. García-Hermoso A, Cavero-Redondo I, Ramírez-Vélez R, Ruiz JR, Ortega FB, Lee DC, Martínez-Vizcaíno V. Muscular Strength as a Predictor of All-Cause Mortality in an Apparently Healthy Population: A Systematic Review and Meta-Analysis of Data From Approximately 2 Million Men and Women. *Arch Phys Med Rehabil* 2018;99(10):2100–2113. https://doi.org/10.1016/j.apmr.2018.01.008
28. Srikanthan P, Karlamangla AS. Muscle mass index as a predictor of longevity in older adults. *Am J Med* 2014;127(6):547–553. https://doi.org/10.1016/j.amjmed.2014.02.007
29. Momma H, Kawakami R, Honda T, Sawada SS. Muscle-strengthening activities are associated with lower risk and mortality in major non-communicable diseases: a systematic review and meta-analysis of cohort studies. *Br J Sports Med* 2022;56(13):755–763. https://doi.org/10.1136/bjsports-2021-105061
30. Bull FC, Al-Ansari SS, Biddle S, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 2020;54(24):1451–1462. https://doi.org/10.1136/bjsports-2020-102955
31. Paluch AE, Bajpai S, Bassett DR, et al.; Steps for Health Collaborative. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. *Lancet Public Health* 2022;7(3):e219–e228. https://doi.org/10.1016/S2468-2667(21)00302-9
32. Ebbeling CB, Ward A, Puleo EM, Widrick J, Rippe JM. Development of a single-stage submaximal treadmill walking test. *Med Sci Sports Exerc* 1991;23(8):966–973. https://pubmed.ncbi.nlm.nih.gov/1956273/
33. Storer TW, Davis JA, Caiozzo VJ. Accurate prediction of VO2max in cycle ergometry. *Med Sci Sports Exerc* 1990;22(5):704–712. https://doi.org/10.1249/00005768-199010000-00024
34. Concept2. *VO2 Max Calculator* (equations derived from F. Hagerman's paired gas-analysis and 2,000 m ergometer tests). https://www.concept2.com/training/vo2max-calculator (accessed 2026-11-08)
35. Peterman JE, Harber MP, Imboden MT, Whaley MH, Fleenor BS, Myers J, Arena R, Kaminsky LA. Accuracy of Exercise-based Equations for Estimating Cardiorespiratory Fitness. *Med Sci Sports Exerc* 2021;53(1):74–82. https://doi.org/10.1249/MSS.0000000000002435
36. Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome? *Front Physiol* 2014;5:73. https://doi.org/10.3389/fphys.2014.00073
37. Kaminsky LA, Arena R, Myers J, Peterman JE, Bonikowske AR, Harber MP, Medina Inojosa JR, Lavie CJ, Squires RW. Updated Reference Standards for Cardiorespiratory Fitness Measured with Cardiopulmonary Exercise Testing: Data from the Fitness Registry and the Importance of Exercise National Database (FRIEND). *Mayo Clin Proc* 2022;97(2):285–293. https://doi.org/10.1016/j.mayocp.2021.08.020
38. Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. *Br J Sports Med* 2018;52(6):376–384. https://doi.org/10.1136/bjsports-2017-097608
39. Bauer J, Biolo G, Cederholm T, et al. Evidence-based recommendations for optimal dietary protein intake in older people: a position paper from the PROT-AGE Study Group. *J Am Med Dir Assoc* 2013;14(8):542–559. https://doi.org/10.1016/j.jamda.2013.05.021
40. Moore DR, Churchward-Venne TA, Witard O, Breen L, Burd NA, Tipton KD, Phillips SM. Protein ingestion to stimulate myofibrillar protein synthesis requires greater relative protein intakes in healthy older versus younger men. *J Gerontol A Biol Sci Med Sci* 2015;70(1):57–62. https://doi.org/10.1093/gerona/glu103
41. Watson NF, Badr MS, Belenky G, et al. Recommended Amount of Sleep for a Healthy Adult: A Joint Consensus Statement of the American Academy of Sleep Medicine and Sleep Research Society. *Sleep* 2015;38(6):843–844. https://doi.org/10.5665/sleep.4716
42. Nedeltcheva AV, Kilkus JM, Imperial J, Schoeller DA, Penev PD. Insufficient sleep undermines dietary efforts to reduce adiposity. *Ann Intern Med* 2010;153(7):435–441. https://doi.org/10.7326/0003-4819-153-7-201010050-00006
43. Araujo CG, de Souza e Silva CG, Laukkanen JA, Fiatarone Singh M, Kunutsor SK, Myers J, Franca JF, Castro CL. Successful 10-second one-legged stance performance predicts survival in middle-aged and older individuals. *Br J Sports Med* 2022;56(17):975–980. https://doi.org/10.1136/bjsports-2021-105360
44. Fleg JL, Morrell CH, Bos AG, Brant LJ, Talbot LA, Wright JG, Lakatta EG. Accelerated longitudinal decline of aerobic capacity in healthy older adults. *Circulation* 2005;112(5):674–682. https://doi.org/10.1161/CIRCULATIONAHA.105.545459
45. Stensvold D, Viken H, Steinshamn SL, et al. Effect of exercise training for five years on all cause mortality in older adults — the Generation 100 study: randomised controlled trial. *BMJ* 2020;371:m3485. https://doi.org/10.1136/bmj.m3485
46. Gillen JB, Martin BJ, MacInnis MJ, Skelly LE, Tarnopolsky MA, Gibala MJ. Twelve Weeks of Sprint Interval Training Improves Indices of Cardiometabolic Health Similar to Traditional Endurance Training despite a Five-Fold Lower Exercise Volume and Time Commitment. *PLoS One* 2016;11(4):e0154075. https://doi.org/10.1371/journal.pone.0154075
47. Hutchinson M, Kinghorn DJ, Hall ECR, Metcalfe RS, Paval DR, Gallagher IJ, Vollaard NBJ. Number of Sprint Repetitions in a Sprint Interval Training Session Does Not Moderate Improvements in VO2max With Training: A Systematic Review and Meta-Analysis. *Scand J Med Sci Sports* 2026;36(7):e70347. https://doi.org/10.1111/sms.70347
48. Reed JL, Pipe AL. The talk test: a useful tool for prescribing and monitoring exercise intensity. *Curr Opin Cardiol* 2014;29(5):475–480. https://doi.org/10.1097/HCO.0000000000000097
49. Bok D, Rakovac M, Foster C. An Examination and Critique of Subjective Methods to Determine Exercise Intensity: The Talk Test, Feeling Scale, and Rating of Perceived Exertion. *Sports Med* 2022;52(9):2085–2109. https://doi.org/10.1007/s40279-022-01690-3
50. Ruiz JR, Sui X, Lobelo F, Morrow JR Jr, Jackson AW, Sjöström M, Blair SN. Association between muscular strength and mortality in men: prospective cohort study. *BMJ* 2008;337:a439. https://doi.org/10.1136/bmj.a439
51. Shailendra P, Baldock KL, Li LSK, Bennie JA, Boyle T. Resistance Training and Mortality Risk: A Systematic Review and Meta-Analysis. *Am J Prev Med* 2022;63(2):277–285. https://doi.org/10.1016/j.amepre.2022.03.020
52. Harding AT, Weeks BK, Watson SL, Beck BR. The LIFTMOR-M (Lifting Intervention For Training Muscle and Osteoporosis Rehabilitation for Men) trial: protocol for a semirandomised controlled trial of supervised targeted exercise to reduce risk of osteoporotic fracture in older men with low bone mass. *BMJ Open* 2017;7(6):e014951. https://doi.org/10.1136/bmjopen-2016-014951
53. Mages M, Shojaa M, Kohl M, et al. Exercise Effects on Bone Mineral Density in Men. *Nutrients* 2021;13(12):4244. https://doi.org/10.3390/nu13124244
54. Hamilton BR, Staines KA, Kelley GA, Kelley KS, Kohrt WM, Pitsiladis Y, Guppy FM. The Effects of Exercise on Bone Mineral Density in Men: A Systematic Review and Meta-Analysis of Randomised Controlled Trials. *Calcif Tissue Int* 2022;110(1):41–56. https://doi.org/10.1007/s00223-021-00893-6
55. Hinton PS, Nigh P, Thyfault J. Effectiveness of resistance training or jumping-exercise to increase bone mineral density in men with low bone mass: A 12-month randomized, clinical trial. *Bone* 2015;79:203–212. https://doi.org/10.1016/j.bone.2015.06.008
56. Allison SJ, Folland JP, Rennie WJ, Summers GD, Brooke-Wavell K. High impact exercise increased femoral neck bone mineral density in older men: a randomised unilateral intervention. *Bone* 2013;53(2):321–328. https://doi.org/10.1016/j.bone.2012.12.045
57. Kukuljan S, Nowson CA, Sanders KM, Nicholson GC, Seibel MJ, Salmon J, Daly RM. Independent and combined effects of calcium-vitamin D3 and exercise on bone structure and strength in older men: an 18-month factorial design randomized controlled trial. *J Clin Endocrinol Metab* 2011;96(4):955–963. https://doi.org/10.1210/jc.2010-2284
58. Sinaki M, Wahner HW, Offord KP, Hodgson SF. Efficacy of nonloading exercises in prevention of vertebral bone loss in postmenopausal women: a controlled trial. *Mayo Clin Proc* 1989;64(7):762–769. https://doi.org/10.1016/s0025-6196(12)61748-0
59. Martyn-St James M, Carroll S. Meta-analysis of walking for preservation of bone mineral density in postmenopausal women. *Bone* 2008;43(3):521–531. https://doi.org/10.1016/j.bone.2008.05.012
60. Olmedillas H, González-Agüero A, Moreno LA, Casajus JA, Vicente-Rodríguez G. Cycling and bone health: a systematic review. *BMC Med* 2012;10:168. https://doi.org/10.1186/1741-7015-10-168
61. Villareal DT, Aguirre L, Gurney AB, et al. Aerobic or Resistance Exercise, or Both, in Dieting Obese Older Adults. *N Engl J Med* 2017;376(20):1943–1955. https://doi.org/10.1056/NEJMoa1616338
62. McGill SM, McDermott A, Fenwick CM. Comparison of different strongman events: trunk muscle activation and lumbar spine motion, load, and stiffness. *J Strength Cond Res* 2009;23(4):1148–1161. https://doi.org/10.1519/JSC.0b013e318198f8f7
63. Brooke-Wavell K, Skelton DA, Barker KL, et al. Strong, steady and straight: UK consensus statement on physical activity and exercise for osteoporosis. *Br J Sports Med* 2022;56(15):837–846. https://doi.org/10.1136/bjsports-2021-104634
64. Beck BR, Daly RM, Singh MAF, Taaffe DR. Exercise and Sports Science Australia (ESSA) position statement on exercise prescription for the prevention and management of osteoporosis. *J Sci Med Sport* 2017;20(5):438–445. https://doi.org/10.1016/j.jsams.2016.10.001
65. Sherrington C, Fairhall NJ, Wallbank GK, et al. Exercise for preventing falls in older people living in the community. *Cochrane Database Syst Rev* 2019;1:CD012424. https://doi.org/10.1002/14651858.CD012424.pub2
66. Cappuccio FP, D'Elia L, Strazzullo P, Miller MA. Sleep duration and all-cause mortality: a systematic review and meta-analysis of prospective studies. *Sleep* 2010;33(5):585–592. https://doi.org/10.1093/sleep/33.5.585
67. Stamatakis E, Ahmadi MN, Gill JMR, Thøgersen-Ntoumani C, Gibala MJ, Doherty A, Hamer M. Association of wearable device-measured vigorous intermittent lifestyle physical activity with mortality. *Nat Med* 2022;28(12):2521–2529. https://doi.org/10.1038/s41591-022-02100-x
68. Garber CE, Blissmer B, Deschenes MR, et al. American College of Sports Medicine position stand. Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults: guidance for prescribing exercise. *Med Sci Sports Exerc* 2011;43(7):1334–1359. https://pubmed.ncbi.nlm.nih.gov/21694556/
69. Vollaard NBJ, Metcalfe RS, Williams S. Effect of Number of Sprints in an SIT Session on Change in VO2max: A Meta-analysis. *Med Sci Sports Exerc* 2017;49(6):1147–1156. https://doi.org/10.1249/MSS.0000000000001204
70. Riebe D, Franklin BA, Thompson PD, Garber CE, Whitfield GP, Magal M, Pescatello LS. Updating ACSM's Recommendations for Exercise Preparticipation Health Screening. *Med Sci Sports Exerc* 2015;47(11):2473–2479. https://doi.org/10.1249/MSS.0000000000000664
71. Weston KS, Wisløff U, Coombes JS. High-intensity interval training in patients with lifestyle-induced cardiometabolic disease: a systematic review and meta-analysis. *Br J Sports Med* 2014;48(16):1227–1234. https://doi.org/10.1136/bjsports-2013-092576
72. Watts NB, Adler RA, Bilezikian JP, et al.; Endocrine Society. Osteoporosis in men: an Endocrine Society clinical practice guideline. *J Clin Endocrinol Metab* 2012;97(6):1802–1822. https://doi.org/10.1210/jc.2011-3045
73. Leong DP, Teo KK, Rangarajan S, et al. Reference ranges of handgrip strength from 125,462 healthy adults in 21 countries: a prospective urban rural epidemiologic (PURE) study. *J Cachexia Sarcopenia Muscle* 2016;7(5):535–546. https://doi.org/10.1002/jcsm.12112
74. Dodds RM, Syddall HE, Cooper R, et al. Grip strength across the life course: normative data from twelve British studies. *PLoS One* 2014;9(12):e113637. https://doi.org/10.1371/journal.pone.0113637
75. Uth N, Sørensen H, Overgaard K, Pedersen PK. Estimation of VO2max from the ratio between HRmax and HRrest — the Heart Rate Ratio Method. *Eur J Appl Physiol* 2004;91(1):111–115. https://doi.org/10.1007/s00421-003-0988-y
76. Castagna C, Krustrup P, Póvoas S. Estimation of maximal oxygen uptake using the heart rate ratio method in male recreational football players. *Eur J Appl Physiol* 2022;122(6):1421–1428. https://pmc.ncbi.nlm.nih.gov/articles/PMC8929450/
77. Nes BM, Janszky I, Vatten LJ, Nilsen TIL, Aspenes ST, Wisløff U. Estimating VO2peak from a nonexercise prediction model: the HUNT Study, Norway. *Med Sci Sports Exerc* 2011;43(11):2024–2030. https://doi.org/10.1249/MSS.0b013e31821d3f6f (coefficients as reproduced in Mayo Clin Proc Innov Qual Outcomes 2026, https://pmc.ncbi.nlm.nih.gov/articles/PMC13429898/)
78. Peterman JE, Harber MP, Imboden MT, et al. Accuracy of Nonexercise Prediction Equations for Assessing Longitudinal Changes to Cardiorespiratory Fitness in Apparently Healthy Adults: BALL ST Cohort. *J Am Heart Assoc* 2020;9(11):e015117. https://doi.org/10.1161/JAHA.119.015117
79. Cooper KH. A means of assessing maximal oxygen intake. Correlation between field and treadmill testing. *JAMA* 1968;203(3):201–204. https://pubmed.ncbi.nlm.nih.gov/5694044/
80. Kline GM, Porcari JP, Hintermeister R, Freedson PS, Ward A, McCarron RF, Ross J, Rippe JM. Estimation of VO2max from a one-mile track walk, gender, age, and body weight. *Med Sci Sports Exerc* 1987;19(3):253–259. https://pubmed.ncbi.nlm.nih.gov/3600239/ (mL/kg/min form as reproduced in Front Psychol 2021, https://pmc.ncbi.nlm.nih.gov/articles/PMC8595132/)
81. Molina-Garcia P, Notbohm HL, Schumann M, et al. Validity of Estimating the Maximal Oxygen Consumption by Consumer Wearables: A Systematic Review with Meta-analysis and Expert Statement of the INTERLIVE Network. *Sports Med* 2022;52(7):1577–1597. https://doi.org/10.1007/s40279-021-01639-y
82. Caserman P, Yum S, Göbel S, Reif A, Matura S. Assessing the Accuracy of Smartwatch-Based Estimation of Maximum Oxygen Uptake Using the Apple Watch Series 7: Validation Study. *JMIR Biomed Eng* 2024;9:e59459. https://doi.org/10.2196/59459
83. Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. *J Am Coll Cardiol* 2001;37(1):153–156. https://doi.org/10.1016/s0735-1097(00)01054-8
84. Nes BM, Janszky I, Wisløff U, Støylen A, Karlsen T. Age-predicted maximal heart rate in healthy subjects: The HUNT fitness study. *Scand J Med Sci Sports* 2013;23(6):697–704. https://doi.org/10.1111/j.1600-0838.2012.01445.x
85. Gellish RL, Goslin BR, Olson RE, McDonald A, Russi GD, Moudgil VK. Longitudinal modeling of the relationship between age and maximal heart rate. *Med Sci Sports Exerc* 2007;39(5):822–829. https://doi.org/10.1097/mss.0b013e31803349c6
86. Zhang D, Shen X, Qi X. Resting heart rate and all-cause and cardiovascular mortality in the general population: a meta-analysis. *CMAJ* 2016;188(3):E53–E63. https://doi.org/10.1503/cmaj.150535
87. Cole CR, Blackstone EH, Pashkow FJ, Snader CE, Lauer MS. Heart-rate recovery immediately after exercise as a predictor of mortality. *N Engl J Med* 1999;341(18):1351–1357. https://doi.org/10.1056/NEJM199910283411804
88. Secondary transcriptions of the FRIEND 2022 treadmill percentile table, used because the Mayo Clin Proc full text could not be fetched (both reproduce identical values; 9,564 men and 6,714 women): INSCYD, *VO2max charts by age, gender and sport* (2025), https://inscyd.com/article/vo2max-charts-by-age-gender-sport ; SENSAI, *What is a good VO2 max for your age?* (2025), https://www.sensai.fit/blog/vo2-max-by-age-chart-men-women ; cross-check of the RER ≥ 1.10 subset: FitnessNorms, *VO2 max norms by age and sex*, https://fitnessnorms.com/cardio/vo2-max/ (all accessed 2026-11-08)
89. Bacon AP, Carter RE, Ogle EA, Joyner MJ. VO2max trainability and high intensity interval training in humans: a meta-analysis. *PLoS One* 2013;8(9):e73182. https://doi.org/10.1371/journal.pone.0073182
90. Rognmo Ø, Moholdt T, Bakken H, Hole T, Mølstad P, Myhr NE, Grimsmo J, Wisløff U. Cardiovascular risk of high- versus moderate-intensity aerobic exercise in coronary heart disease patients. *Circulation* 2012;126(12):1436–1440. https://doi.org/10.1161/CIRCULATIONAHA.112.123117
