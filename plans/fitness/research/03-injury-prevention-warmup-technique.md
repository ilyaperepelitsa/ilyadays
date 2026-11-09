# 03 — Injury Prevention, Warm-up and Technique for a Machine-First Lifter

Research brief for the ilyadays fitness section. Date: 2026-11-08.
Scope: injury epidemiology of recreational resistance training, injury mechanisms, warm-up science (RAMP, general warm-up, ramp sets by load tier and on machines), technique rules for the shoulder, lower back, elbow, wrist and neck, tendon adaptation and load-spike control (including the acute:chronic workload ratio and its critiques), a pain traffic light, DOMS versus injury, red flags, sleep, recovery and deloads, and a cue library for all 36 exercise classes in `content/fitness/registry.json`.

Audience: the owner (adult male, trains alone, machine-first, three days a week; goals fat loss, strength, chest, back, arms, abdominal strength, longevity; legs later) and the agents who turn this into `content/fitness/safety.json`, the warm-up engine and the science pages. Every number is cited or labelled as a design default. Where the evidence is weak the practical default is stated as such. The machine-readable block mirrors the shape of `content/fitness/safety.json` with plain English strings; stream 08 adds the Russian text.

---

## Summary

1. **Gym lifting is low-risk, and the shoulder is the weak link.** The weight-training sports run at about 2–4 injuries per 1,000 h (bodybuilding 0.24–1). The only prospective cohort of recreational lifters found about 2 per 1,000 h. Team sports report 15–81 [1][4]. Shoulder, lower back, knee, elbow and wrist head every list, and the shoulder alone accounts for up to 36% of resistance-training injuries [1][5]. At about 150 h a year that means roughly one injury every 3–7 years. A previous injury doubles the risk of hurting the same area again [8].
2. **Four mechanisms, four guards.** The mechanisms are load spikes, technique that breaks down with fatigue (after fatiguing lifts the lumbar bending moment rose 36% and bench bar paths drift near failure), ego loading (lifters pressed about 12 kg more in front of an audience) and poor preparation [1][11][12][13]. The guards: load steps of 10% or less, sets that end 1–3 reps short of failure or at the first technique break, the hardest lifts first and no true 1RM attempts. Training itself is the best-proven protection: strength training cut sports injuries to about a third (RR 0.32), while stretching did nothing (RR 0.96) [9][15].
3. **The warm-up follows RAMP.** Do 5 min of easy cardio (8–10 min on heavy days, never tiring), 1–2 min of shoulder activation, then 1–4 ramp sets chosen by the working-load tier, all given as % of the working load. Light: 50%×10, only for the first exercise that loads the joint. Moderate: 50%×8, 70%×4. Heavy: add 85%×2. Max: add 92%×1. Rests run from 30 s to 3 min [17][18][79]. General plus specific warm-up raised 1RM by 8.4%, a ramp of light sets only underperformed, and long static stretches cost about 4.6% [20][23][25]. No warm-up has been shown to prevent injuries on the day [22][27].
4. **Machines.** Set the seat and pads first. An isolation machine gets at most one ramp set. A later compound for muscles that are already warm gets only the top step of its tier, and a later isolation exercise for them gets none. Steps that round to the same plate collapse into one. On plate-loaded machines the empty machine counts as a step.
5. **Shoulder rules.** Nothing behind the neck. Grip no wider than 1.5× shoulder width, elbows 45–60°, shoulder blades pulled back. On flyes and the pec deck the arms never travel behind the torso. Raises stop at 90° with the thumbs neutral. Do external-rotation and rear-delt work every week: lifters who trained the external rotators showed fewer impingement signs, and a shoulder programme done 3×/week cut shoulder problems by 28% [28][33][35][38].
6. **Lower-back rules.** Brace rather than hollow, and keep the spine neutral under load (flexion while lifting has not been shown to cause back pain). Rows are chest-supported by default. Use the lumbar machine only with the pelvis restrained, and train it light, slow and at RIR 3 or more at first. Hold your breath briefly on hard reps only [39][40][41][42][44].
7. **Elbows, wrists and neck.** Tendon pain is a load problem. Halve the aggravating volume, switch to neutral or EZ grips, lower over 3 s and rebuild over 12 weeks or more. Isometrics bring short, variable relief. In ab work the neck stays still, and neck training starts with isometrics in the mid-range [46][47][51][80].
8. **Tendons lag muscle by 1–2 months.** Stiffness responds mainly to loads above 70% of maximum, and collagen turnover after a session takes about 72 h. So: load steps of 10% or less, at most 2 extra sets per muscle per week, and at least 48 h between hard sessions for the same tendon. The acute:chronic workload ratio is shown as a description only, because its 0.8–1.3 and ≥1.5 bands are team-sport heuristics with known statistical artefacts [54][55][56][59].
9. **Pain traffic light (stricter than Silbernagel's model).** 0–3 continue, 4–5 modify, 6+ or any sharp pain stop. Pain must be back to baseline by the next morning and must not climb week to week. Diffuse soreness at 24–72 h is DOMS and does not count. Red flags go to a doctor, not to the app [60][64][67][69].
10. **Recovery.** Sleep at least 7 h. After a night under 6 h, drop top sets and add 1 RIR. Three or more bad nights, or two amber sessions for the same region, trigger a deload: sets ×0.5, load ×0.9, RIR 4 or more, same frequency [71][72][73][76].

---

## Publishable section — Training hard without getting hurt

**How risky is lifting?** Less risky than most people think, and safer than almost any team sport. A review of 20 studies across the weight-training sports found roughly 2–4 injuries per 1,000 hours of training. Bodybuilding, the closest thing to ordinary gym training, was the lowest at 0.24–1 per 1,000 hours. Soccer, rugby and cricket report about 15–81 [1]. Weightlifting runs at 2.4–3.3 injuries per 1,000 hours and powerlifting at 1.0–4.4 [2][3]. The only prospective cohort of recreational gym-goers recorded about one injury per 500 training hours, and a quarter of its members were hurt over six months [4]. At three one-hour sessions a week, that means roughly one injury worth noticing every three to seven years.

The same body parts top almost every list: shoulder, lower back, knee, elbow and wrist [1]. The shoulder alone accounts for up to 36% of resistance-training injuries [5]. Most injuries are strains, sprains and tendon overload, not catastrophes. In US emergency departments the leading cause was simply a weight dropped on the body, which accounts for 65.5% of cases, and free weights were involved in 90% [6]. In a Dutch survey, three in four gym injuries happened without supervision, and the bench press was the strength exercise most often involved [7]. A previous injury roughly doubles the chance of hurting the same area again [8]. The 2026 position stand of the American College of Sports Medicine (ACSM) is blunt: resistance training does not increase serious adverse events in healthy adults of any age [9].

**How lifters get hurt.** Four mechanisms cover most of it.

- **Load spikes.** Tissues tolerate what they are used to. Sudden jumps in load, volume or exercise choice are the classic route to overuse injury [10].
- **Technique breaking down under fatigue.** After 100 repetitive lifts, tired back muscles let the lumbar spine bend further, and the bending moment on it rose by 36% [11]. On the bench press, the bar path changes as a set approaches failure [12]. Lifters themselves most often blame fatigue, loads that were too heavy and poor preparation [1].
- **Ego loading.** Recreational lifters pressed about 12 kg more in front of an audience than when lifting next to others [13]. Young men carry the highest injury odds in gym surveys [14].
- **Too little preparation.** This is self-reported and weakly evidenced, but cheap to fix.

The ACSM now states that training to failure does not enhance gains in strength, size or power, and may be unwise for some groups, such as older adults, because poor form raises injury risk. It also finds that strength gains are larger when the lift comes early in the session [9]. Our planner follows from this: small load steps, sets that end one to three reps short of failure or at the first broken rep, the hardest lifts first, and no true one-rep-max attempts. The best-documented protection is the training itself. Across randomised trials, strength training cut sports injuries to about a third and nearly halved overuse injuries, while stretching made no difference [15][16].

**The warm-up.** We use the RAMP structure: Raise body temperature, Activate and Mobilise the working joints, then Potentiate with ramp sets [17][18]. Muscle temperature starts rising within 3–5 minutes of easy exercise and levels off after 10–20 minutes [18]. In one leg-press study, fifteen minutes at 40% of maximal aerobic capacity raised strength by 3%, five minutes changed nothing, and fifteen minutes at 70% lowered it by 4% [19]. In another, adding twenty easy minutes of cycling to a lifting-specific warm-up raised the one-rep max by 8.4% [20]. Our default is a compromise: five easy minutes, because the ramp sets that follow do the specific warming, and ten minutes on heavy days, still easy.

Across sports, warming up improved performance in 79% of the outcomes measured [21]. For the upper body, the strongest evidence favours loaded, movement-specific warm-ups [22]. Ramp sets matter, but they should be short. Before three sets of six at 80% of maximum, a warm-up that included a set at 80% of the working weight beat light sets alone [23]. Before sets taken to failure, the type of warm-up made no difference [24]. So the ramp is one to four sets that climb towards the working weight, and none of them is tiring. Long static stretches of 60 seconds or more per muscle cost about 4.6% of performance, and short ones about 1% [25].

What warm-ups lack is proof that they prevent injury on the day. By 2015 no upper-body warm-up trial had measured injuries [22]. Older sports trials lean favourable but are inconclusive [26], and a 2026 international consensus found no support for acute injury protection [27]. We keep the warm-up because it makes the first working set better and doubles as a pain check: a joint that hurts at 70% will hurt more at 100%.

**Shoulders.** Most shoulder trouble in lifters comes from one position, the "high-five": arm out to the side, rotated back, elbow behind the body. It stresses the front of the joint capsule [5][28]. Weight-lifters with unstable shoulders all reported pain in it [29]. About half of 112 published chest-muscle (pectoralis major) ruptures happened during weight training, a quarter on the bench press, typically in that position [5][30]. The rules:

- **Nothing behind the neck.** Pull and press in front of the head. The pulldown to the front works the back muscles at least as well [31][32].
- **Pressing.** Hands no wider than about 1.5 times shoulder width, elbows 45–60° from the body and shoulder blades pulled back. In a 2024 musculoskeletal model, narrower grips and retracted shoulder blades lowered compression on the collarbone joint and shear inside the shoulder, while elbow angle mattered less [33]. Narrowing the grip to that width changes the one-rep max by only about 5% [34].
- **Flyes and the pec deck.** The handles start at chest level, and the arms open only as far as the line of the torso [28].
- **Raises.** Raise to shoulder height with the thumbs neutral. Lifters who raised or upright-rowed above 90° showed more signs of impingement, and those who strengthened the external rotators showed fewer [35].

Recreational lifters tend to build pressing strength faster than strength in the muscles that rotate the arm outward, and lifters with impingement have weaker external rotators and lower trapezius [36][37]. So the programme includes external-rotation and rear-shoulder work every week. A similar shoulder routine, done three times a week as a warm-up, cut shoulder problems by 28% in elite handball players [38].

**Lower back.** Brace by tightening all the way around the trunk as if about to be poked, rather than sucking the belly in. In a laboratory model, bracing made the spine 32% more stable than hollowing [39]. Keep the spine roughly neutral under heavy load, but don't fear every bend: low-quality evidence finds no link between bending the lower back while lifting and later back pain [40]. Exercise choice protects more. Of three rows tested, the standing bent-over row put the highest load on the lower back [41], so our default rows are chest-supported.

Short breath-holds on hard reps are normal and stiffen the trunk [42]. But blood pressure has topped 300/250 mmHg during heavy leg presses [43], so anyone with high blood pressure should avoid long breath-holds and grinding sets to failure. The lower-back machine helps only when the pelvis is strapped in, because only then do the lower-back muscles do the work rather than the hips [44]. Trained that way it also reduces chronic back pain [45]. Start it light, slow and well short of failure.

**Elbows, wrists and neck.** Curls, pushdowns and skull crushers load small tendons. Tendon problems run along a continuum from reactive overload to degeneration [46], and the treatment is load, not rest:

- Lower the aggravating load and volume.
- Switch to a neutral or EZ grip.
- Slow the lowering to three seconds, then rebuild. Heavy slow resistance and eccentric programmes work in tendon trials [47][48][49].
- Isometric holds can ease tendon pain for a while, though not reliably better than slow reps [50][51].

Keep the wrists stacked over the forearms when pressing. Neutral handles and EZ bars spare the wrists and elbows; this is coaching practice rather than tested. In ab work the neck stays still: hands on the chest or the machine handles, never pulling on the head. The case against crunches is indirect, because it comes from pig spines bent up to 86,400 times in a laboratory [52][53].

**Tendons are slow.** In one 12-week training study, strength rose 30% within two months, but tendon stiffness did not change until the third month [54]. Tendons respond mainly to heavy loads, above about 70% of maximum, and a little better to programmes of 12 weeks or more [55]. The collagen turnover that follows each session lasts about three days [56][57]. That is the reason for small steps.

The acute:chronic workload ratio, last week's training load divided by the last month's, tries to formalise this. Its proponents call 0.8–1.3 a sweet spot and 1.5 or more a danger zone [10]. But the two numbers are mathematically coupled, and the ratio adds nothing over last week's load alone; neither predicts injuries much better than chance [58][59]. We show it as a note on the chart, never as a rule.

**Pain: a traffic light.** In Silbernagel's pain-monitoring model, people with Achilles tendon pain kept training with pain up to 5 out of 10. The conditions were that it settled by the next morning and did not climb from week to week. They did as well as patients who stopped running and jumping for six weeks [60][61]. In chronic muscle and joint pain, exercising into some pain was no worse than pain-free exercise [62][63]. Because you coach yourself, we use a stricter version:

- **0–3:** carry on.
- **4–5:** modify. Go lighter, use a shorter range, slow down or swap the exercise.
- **6 or more, or any sharp or catching pain:** stop that exercise today.

Muscle soreness that appears 12–24 hours later, peaks at 24–72 hours and fades within a week is delayed-onset muscle soreness (DOMS), not injury [64][65]. It shrinks after your first exposure to an exercise [66].

**Red flags.** These need a doctor rather than an app:

- chest pain, unusual breathlessness, palpitations or fainting [67];
- a sudden severe headache during a lift [68];
- numbness, tingling or weakness down a limb, or changes in bladder or bowel control [69];
- a pop followed by bruising or weakness, because a torn tendon repairs best early [30];
- dark urine with extreme muscle pain and swelling after a hard session, a sign of muscle breakdown (rhabdomyolysis) [70].

**Recovery.** Sleep at least seven hours [71]. One night without sleep cut muscle protein synthesis by 18% [72]. Short sleep lowers performance by about 7.6%, mostly in sessions later in the day [73]. Repeated short nights sap strength in multi-joint lifts more than in single-joint ones [74], and in adolescents chronic short sleep raises injury odds by about 60% [75]. So one bad night downgrades the session to no top sets and one extra rep in reserve, and several bad nights trigger a deload. A deload reduces training rather than stopping it. Our default is half the sets and about 10% less load at the same number of sessions, in line with coaches' consensus and practice [76][77]. In a 2024 trial, a full week off in the middle of a nine-week programme blunted lower-body strength gains [78].

---

## Decision rules / parameters

### A. Injury epidemiology

| Population / setting | Rate | Most injured regions | Notes | Source |
|---|---|---|---|---|
| Weight-training sports (20 studies) | ~2–4 per 1,000 h; bodybuilding 0.24–1; strongman 4.5–6.1; Highland Games 7.5 | shoulder, lower back, knee, elbow, wrist/hand | mostly strains, tendinitis, sprains; 16 of 20 studies retrospective | [1] |
| Weightlifting | 2.4–3.3 per 1,000 h | knee, lower back, shoulder, hands | | [2][3] |
| Powerlifting | 1.0–4.4 per 1,000 h; point prevalence 70% | lower back/pelvis, shoulder, elbow | weight-belt use associated with more lumbar injuries (association only) | [3][81] |
| Competitive bodybuilding | 0.24 per 1,000 h; higher after age 40 | shoulder, elbow, lumbar spine, knee | 45% train with symptoms | [82] |
| Recreational resistance training, 6-month prospective cohort | 1.07 per 500 h (≈2.1 per 1,000 h); 25% injured | knee 30%, shoulder 28%, spine 19% (men: shoulder first) | self-reported, n = 104 | [4] |
| Adult fitness clubs, all activities, 3 months | 7.83 per 1,000 h (time-loss 5.92); weight work low to medium | — | re-injury rate about 2× in previously injured areas | [8] |
| US emergency departments 1990–2007 | 970,801 estimated injuries | upper trunk 25.3%, lower trunk 19.7% | dropped weight 65.5%; free weights 90.4%; sprain/strain 46.1% | [6] |
| Victorian emergency departments, fitness facilities | — | — | overexertion 36.2% overall and 52.6% of free-weight injuries | [83] |
| Dutch gym-goers with an injury (n = 494) | — | shoulder, leg, knee | 73.1% unsupervised; bench press 11.8% of injuries | [7] |
| Resistance training, shoulder share | up to 36% of injuries | — | | [5] |
| Team sports (comparison) | ~15–81 per 1,000 h | | | [1] |

The owner's exposure is about 3 h a week × 50 weeks, or 150 h a year. At 1–2 injuries per 1,000 h that is 0.15–0.3 injuries a year, roughly one every 3–7 years. Injury definitions differ between studies, so treat this as an order of magnitude.

### B. Mechanisms and the app guards

| Mechanism | Evidence | Guard | Parameter |
|---|---|---|---|
| Load spikes | team-sport load–injury models; tendon lag (section I) | cap load steps and set additions; calibrate new exercises | load step ≤ +10% (research 02); ≤ +2 hard sets per muscle per week (research 01: +1, +2 only if recovery is excellent); new exercise: 2 sessions at RIR 3–4 [10][54] |
| Fatigue breaks technique | lumbar bending moment +36% after 100 lifts; bar path drift near failure; squat technique changes in high-rep fatiguing sets; lifters blame fatigue first | effort caps; stop at the first broken rep; order | compounds at RIR 2 (never 0); isolation at RIR 1–2; the set ends at the first rep that looks different from rep 1; the most technical and heaviest lift first [1][9][11][12][84] |
| Ego loading | +12 kg on the bench 1RM with an audience; young men have the highest injury odds | e1RM from submaximal sets; no true 1RM; a flag for loads above the plan | no singles above 90% e1RM; tests use 3–5RM or e1RM from sets with ≤ 12 total reps (research 02) [13][14] |
| Too little preparation | self-reported by 14–42% of injured bodybuilders | RAMP warm-up (sections C–E) | ≥ 5 min general plus a tier ramp [1] |
| Dropped weights and crush injuries | 65.5% of emergency visits; free weights 90.4% | machine-first; safety stops; dumbbell pick-up technique | always engage leg-press and Smith stops; hinge to pick up and set down [6][83] |
| Previous injury | re-injury about 2× | flag the region; conservative progression | design default: for 8 weeks after a return, +1 RIR and half-size load steps for exercises that load the region [8] |
| Age 40 and over | more upper-limb injuries in powerlifters and bodybuilders over 40 | longer general warm-up | design default: 8 min general warm-up [81][82] |
| Life load (full-time work plus 5+ sessions a month) | associated with injury in men | readiness downgrade on bad-sleep days (section M) | see M [14] |

### C. General warm-up and activation (Raise, Activate and Mobilise)

| Item | Default | Change when | Evidence |
|---|---|---|---|
| Mode | bike, rower, cross-trainer or brisk incline walk | — | [18] |
| Duration | 5 min | 8–10 min on a heavy or max-tier day, in the first session after ≥ 7 days off, in a cold gym, or at age 40+; never more than 15 min | muscle temperature rises within 3–5 min and plateaus at 10–20 min; leg-press 1RM: 5 min easy no change, 15 min easy +3%; 20 min easy plus a specific warm-up +8.4% 1RM. The 5 min default is a time compromise: the ramp sets add the specific warming [18][19][20] |
| Intensity | RPE 3–4 of 10; you can talk in full sentences | never hard: 15 min at ~70% VO2max lowered 1RM by ~4% | [19] |
| Shoulder activation | 1×15 band pull-aparts; 1×12–15 band or cable external rotations per arm | before the first press or pull of the session; counts toward the weekly external-rotation work on light days | [35][38] |
| Trunk activation (optional) | 1×6 dead bugs per side | before heavy hinges or carries | [85] |
| Static stretching | not needed; if used, ≤ 30–60 s per muscle, then the ramp sets | — | ≥ 60 s per muscle −4.6%, < 60 s −1.1% [25] |
| Total time before the first working set | ~7–10 min | | design default |

### D. Ramp sets by working-load tier (Potentiate)

Percentages are of the working load (for assisted machines, of the effective load = body weight − assistance). The tier comes from % e1RM when an e1RM is known, otherwise from the target reps + RIR, as in the heavy test in `progression.mjs` (Epley mapping: 15 reps to failure ≈ 67%, 8 ≈ 79%, 3 ≈ 91%; the heavy cut-offs of 80% and 8 total reps match `templates.json`).

| Tier | % e1RM | Reps + RIR | Typical sets | Ramp (% of working × reps) | Rest after each ramp set |
|---|---|---|---|---|---|
| light | < 68 | ≥ 15 | raises and ER at 15–20 reps | 50 × 10, only for the first exercise that loads that joint; otherwise none | 30–45 s |
| moderate | 68–79 | 9–14 | machine press, row or pulldown at 7–12 reps, RIR 2 | 50 × 8 → 70 × 4 | 45–60 s, then 60–90 s before the first working set |
| heavy | 80–89 | 4–8 | 4–6 reps at RIR 1–2 | 50 × 8 → 70 × 4 → 85 × 2 | 60 s, 90 s, 2 min |
| max | ≥ 90 | ≤ 3 | 3RM tests, doubles at RIR 1 | 50 × 8 → 70 × 4 → 85 × 2 → 92 × 1 | 60 s, 90 s, 2 min, 2–3 min |

Rules:

- **Second compound for already-warm muscles** (same region, same session): use only the top step of its tier (moderate 70 × 4; heavy 85 × 2; max 85 × 2 then 92 × 1). Isolation after a compound for the same muscle gets no ramp.
- **Effort:** every ramp set ends at least 5 reps short of failure, with at most 20 ramp reps per exercise. Ramp sets never count as working sets.
- **Rounding:** round each step to the nearest available load. If two steps land on the same load, keep the heavier one. If the working load is below 4 machine increments, an isolation exercise gets no ramp.
- **Pain check:** rate the last ramp set from 0 to 10. A rating of 4 or more puts the exercise in amber before the first working set (section J).
- **Basis:** the ladder follows the NSCA 1RM-testing warm-up (5–10 light reps, 1 min rest; 3–5 reps, 2 min; 2–3 near-maximal reps, 2–4 min) [79]. The specific warm-up of 8 × 50% and 3 × 70% used in strength testing [20], the finding that including an 80% set beats light-only ramps [23], and RAMP's 1–3 reps at 80–93% for potentiation [18] all support it. The exact ladder is coaching practice, not a trial-tested protocol. It matches the 50/70/85 ladder already in `templates.json`. New in this file: the 70% step starts at the moderate tier instead of the heavy tier, and there is a 92% × 1 step for the max tier.

### E. Ramp sets on machines

| Situation | Rule |
|---|---|
| Setup | Set the seat, back pad, range limiter and handle start before the first ramp set (joint axis at the machine pivot; press handles start at chest level, not behind it). The first ramp set checks the setup. |
| Selectorised stack, compound | Use the tier ladder from D, rounded to the stack. With a coarse stack (≥ 5 kg steps) and a light working load, two steps can land on the same plate; keep the heavier one. |
| Selectorised stack, isolation | One set of 50% × 10, only when the muscle has not been worked yet in the session and the working load is at least 4 increments. |
| Plate-loaded machine | The unloaded machine is the first step when its starting resistance is at least the step load. Skip lighter steps. |
| Assisted dip or pull-up | Ramp by adding assistance: the first step is the working assistance plus 2 increments, or 50% of the effective load when body weight is known (as in `progression.mjs`). |
| Unilateral machine | Ramp both sides and start with the weaker side. |
| Cable station | Same as a stack. Set the pulley height before ramping. |
| Machine compared with free weight | Same tissue warm-up and same tier ladder. Fewer skill sets are needed on a fixed path, so later exercises drop to the top step of their tier or none. |

Worked examples: chest press 60 kg × 8 at RIR 2 (moderate) gives 30 × 8, then 40 × 4. Chest press 70 kg × 5 at RIR 2 (heavy) gives 35 × 8, 50 × 4, 60 × 2. Machine lateral raise 20 kg × 15 (light, first shoulder exercise) gives 10 × 10. The same raise after shoulder presses gets no ramp.

### F. Shoulder rules

| Exercise / situation | Rule | Why | Evidence strength | Sources |
|---|---|---|---|---|
| Pulldowns and presses | Always in front of the head; never behind the neck | Behind the neck puts the arm in abduction + external rotation + horizontal abduction (the "at-risk" position) under load. The front pulldown gives equal or greater lat activity. A behind-the-neck press gives more side- and rear-delt EMG but is tolerable only with ideal shoulder mobility, and raises train those muscles more safely. | mechanistic, case series and EMG; no RCT | [5][28][29][31][32][86][87] |
| Flat and incline presses | Grip ≤ 1.5× shoulder width (forearms about vertical at the bottom); elbows 45–60°, never past ~75°; shoulder blades pulled back; handles start at chest level | Wider grips raise AC-joint compression and glenohumeral shear. Retraction lowers shear and rotator-cuff load. Wide-grip heavy lowering is linked to distal clavicle osteolysis (27–28% prevalence in weightlifters) and pec-major tears. | musculoskeletal model and expert opinion | [5][28][33][34] |
| Painful bottom position | Shorten the range: machine range stop, higher handle start, or a towel or board on a free-weight bench | Avoids the end-range high-five | expert opinion | [5][28] |
| Pec deck and flyes | Start position keeps the hands and elbows in line with or in front of the torso; elbows slightly below shoulder level; soft fixed elbow bend; 2–3 s opening | Limits anterior-capsule stretch under load; pec ruptures happen in abduction + external rotation | expert opinion and case series | [28][30] |
| Dips | Upper arm about parallel at the bottom; assisted until 8 controlled reps; skip if the front of the shoulder hurts | Shoulder extension under load; dips are among the reported causes of pec rupture | expert opinion | [5] |
| Lateral raises | Scapular plane (~30° forward), thumbs neutral or slightly up, stop at 90° | Raises and upright rows above 90° associated with impingement signs; the empty-can position narrows the subacromial outlet | case-control and kinematics | [28][35][88] |
| Upright rows | Not in the catalog; if used, elbows no higher than the shoulders (≤ 80–90°) | Internal rotation during elevation | case-control | [28][35] |
| Pullovers and lat isolation | Overhead stretch only to a comfortable range; ribs down | Hyperflexion compresses the cuff under the acromion | expert opinion | [28] |
| External rotation and lower trapezius | At least 2 sets × 12–20 per week (cable or band external rotation at the side, face pulls, rear-delt flyes), plus warm-up activation 2–3×/week | Recreational lifters show external-rotator and lower-trap weakness and strength-ratio imbalances. External-rotation training is inversely associated with impingement. The OSTRC programme cut shoulder problems 28% (OR 0.72). | case-control and a cluster RCT in handball | [35][36][37][38] |
| Scapular control | Set the shoulder blades before every press and row; no shrugging on presses and raises; full protraction to retraction on rows | Scapular dyskinesis raises future shoulder pain risk (RR 1.43 in athletes) and is common in shoulder injury | meta-analysis of cohorts; consensus | [89][90] |
| Pain with arm out and rotated back | Avoid that position, reduce load, swap to a neutral-grip or decline variant; if it persists, see a clinician | Occult anterior instability: 13 of 23 shoulders recovered with rehab plus technique change | case series | [29] |

### G. Lower-back rules

| Topic | Rule | Evidence |
|---|---|---|
| Bracing | Brace 360° before each rep and exhale through the hardest part. A breath-hold of about 2–3 s on heavy reps is fine. With hypertension, heart or eye disease, avoid long breath-holds and grinding sets to failure. | bracing +32% stability vs hollowing; brief Valsalva unavoidable above 80% MVC; BP 320/250 mmHg on leg press; the bench press produced the lowest intra-abdominal pressure (79 vs > 200 mmHg in squats), and the review recommends bench press and rows for people with hypertension [39][42][43][91] |
| Spine position | Neutral under heavy load; no ballistic end-range flexion under load; normal bending is not dangerous | flexion while lifting not a risk factor (low quality); fatigue increases flexion and bending moment [11][40] |
| Rows | Chest-supported by default (machine row, chest-supported dumbbell row, padded T-bar); bent-over barbell row only with a solid hinge and later | the bent-over row had the highest lumbar load of three rows [41] |
| Lumbar machine and 45° back extension | Fasten the pelvic restraint or footplate. Weeks 1–4: 15–20 reps at RIR ≥ 3, 2 s up and 3 s down, finishing at neutral. Then progress at most one step a week. Stop with radiating leg pain. | specific lumbar adaptation needs pelvic restraint; isolated lumbar extension improves chronic low-back pain [44][45] |
| Morning sessions | Within about 1 h of waking, put loaded trunk flexion and extension late in the session | controlling early-morning flexion reduced chronic low-back pain (RCT) [92] |
| Picking up dumbbells and carries | Hinge with a braced flat back and the weights close; set down before grip fails | dropped weights are the leading emergency mechanism [6] |
| Leg press (legs block) | Depth limited to where the pelvis stays on the pad | catalog cue; design default |

### H. Elbow, wrist and neck rules

| Topic | Rule | Evidence |
|---|---|---|
| Direct arm volume | Start at the research-01 volume; add at most 1–2 hard sets per arm muscle per week | slow tendon adaptation [54][55] |
| First elbow pain (amber) | Cut that exercise's sets by about 50% and its load by 10–20%. Switch grip (rope, EZ bar, dumbbells, neutral handles). Lower over 3 s. Keep pain at 3/10 or below. Keep training the other muscles. | load management is the core of tendinopathy care [46][49] |
| Rebuilding | Heavy slow resistance (3 s up, 3 s down) or eccentric emphasis, 2–3×/week, rising week to week within the traffic light. Expect 6–12 weeks or more. No improvement after 6 weeks → physiotherapist. | HSR = eccentric training in an RCT (compliance 92% vs 78%); added eccentric wrist-extensor work improved lateral elbow pain markedly [47][48][61] |
| Isometric option | 4–5 × 30–45 s holds at a load that keeps pain ≤ 3, before the session, for short-term relief; not a cure | relief in a small crossover trial; not superior to isotonic work in a meta-analysis [50][51] |
| Biceps curls and preacher curls | Never let the weight drop into a locked elbow; control the last 10–15° | eccentric overload at full extension is the classic distal-biceps tear mechanism (expert opinion; catalog) |
| Skull crushers and overhead extensions | Depth only to a comfortable range; prefer cable or rope; switch to pushdowns if the back of the elbow hurts | design default |
| Wrists | Stack the wrists over the forearms on presses; neutral handles where available; EZ bar for curls and skull crushers; reverse curls lighter | expert practice (no trial) [28] |
| Neck in ab work | Hands on the chest or the handles, never pulling on the head; chin slightly tucked; the head moves with the trunk | expert practice; curl-up technique [85] |
| Neck training | Isometrics first (5–10 s holds), then light dynamic work in the mid-range, slow, RIR 2–3; stop with dizziness, tingling or arm symptoms | 12 months of neck strength training reduced pain and disability; isometric flexion strength +110% [80] |

### I. Tendon adaptation and load-progression guards

| Fact | Number | Guard |
|---|---|---|
| Strength outruns tendon stiffness | strength +29.6% at 2 months and +40.5% at 3; tendon stiffness unchanged until after month 2; lost again within 2 months of detraining [54] | double progression (reps first); load steps ≤ 10%; after ≥ 4 weeks off, restart with research-02 gap rules |
| Tendon stiffness depends on heavy loads | stiffness SMD 0.90 with loads > 70% vs 0.04 with lighter loads; 0.91 for ≥ 12 weeks vs 0.81 for 8–12 weeks (duration difference not significant) [55] | some work above 70% e1RM for each region every week (compounds at 6–10 reps qualify) |
| Muscle and tendon adapt on different clocks | narrative review; adolescent data [93] | progress the most tendon-heavy lifts (curls, extensions, calf raises) by reps before load |
| Collagen turnover after a session | synthesis peaks around 24 h and stays raised for about 72 h; degradation peaks earlier [56][57] | ≥ 48 h between hard sessions for the same muscle and tendon (the 3-day non-consecutive split satisfies this) |
| Adult tendon core is essentially not renewed | carbon-14 bomb-pulse data: core tissue formed by about age 17 [94][95] | prevention beats cure; respect amber signals |
| Weekly load change | companion rule from research 07: ≤ +10–20% against the 4-week mean | warning note when exceeded |
| ACWR (EWMA, uncoupled 7/28 d) | bands 0.8–1.3 steady, 1.3–1.5 ramping, ≥ 1.5 spike; team-sport heuristics; mathematical coupling; no predictive gain over acute load (c-statistic 0.574 vs 0.5); most team-sport studies still find higher risk at a high ratio [10][58][59][96][97] | chart note only; never changes the plan automatically; computed on weekly hard sets per muscle group and volume load per pattern (research 07) |
| New exercise | the repeated-bout effect protects after the first exposure; introduce eccentric or novel work over 1–2 weeks [64][66] | first 2 sessions: 2 sets at RIR 3–4 |

### J. Pain traffic light

Rate the worst pain during the set from 0 (none) to 10 (worst imaginable). Muscle burn and DOMS are not scored.

| Level | Range | Also counts as this level | Action today | Following sessions |
|---|---|---|---|---|
| green | 0–3 and stable | — | continue and progress as planned | — |
| amber | 4–5 | pain rising from set to set; next-morning pain or stiffness above your usual | modify: −10–20% load, or shorter range, or a slower 3 s lowering, or swap to a pain-free member of the same class; no set below RIR 2 | no progression on that exercise until 2 consecutive green sessions |
| red | 6–10 | sharp, stabbing or catching pain; pain that changes the movement; pain with a pop, locking, giving way, numbness or weakness | stop that exercise; train other regions | red in 2 consecutive sessions, amber for more than 2 weeks, or no settling within 7–14 days → clinician; a red flag (section L) → doctor |

Rules:

- **Next morning:** pain must be back to its usual level, and never above 5 (Silbernagel: pain allowed to 5 during and after activity, subsided by the next morning). Otherwise the exercise starts amber next session [60].
- **Week to week:** pain and stiffness must not trend upward. Two weeks of upward trend → cut that region's weekly sets by 30–50%, or run a regional deload [60][61].
- **Why stricter than the original:** the original model has a safe zone at 0–2, an acceptable zone at 2–5 and a high-risk zone at 5–10, used under clinical supervision [61][98]. The app starts modifying at 4 because it coaches without a clinician. Painful exercise is not harmful in itself: in chronic musculoskeletal pain, painful protocols matched or slightly beat pain-free ones (ES −0.27 short term; updated review: no difference) [62][63].
- **Previous injury:** for regions with a history of injury, start each exercise one tier more cautious (+1 RIR, half-size steps) for 8 weeks [8].

### K. DOMS or injury?

| Feature | DOMS | Possible injury |
|---|---|---|
| Onset | 12–24 h after the session | during the set or within hours, often on one rep |
| Peak | 24–72 h | immediate, or worse with each session |
| Location | diffuse, in the muscle belly, often both sides | a point: joint line, tendon, one side |
| Quality | dull ache, tender to touch, stiff; eases as you warm up | sharp, stabbing or catching; worse with load; swelling or bruising possible |
| Function | full range, only stiff | weakness, instability, giving way, lost range |
| Course | gone within 5–7 days; much smaller after the first exposure | persists beyond 7 days or worsens |
| Action | train other muscles, or the same muscles lighter, for 1–2 days | pain traffic light; red flags |

Sources: [64][65][66].

### L. Red flags (doctor, not app)

| Sign | Urgency | Action | Source |
|---|---|---|---|
| Chest pain, pressure or tightness (may spread to the arm, jaw or back), unusual breathlessness, palpitations or an irregular heartbeat, dizziness or fainting during or after exercise | emergency | stop; call emergency services | [67] |
| Sudden severe headache during or right after a lift (worst ever, peaks within a minute), with or without neck stiffness, vomiting or confusion | emergency | stop; emergency department | [68] |
| Sudden weakness or numbness of the face or a limb, slurred speech, or loss of vision | emergency | call emergency services | design default (stroke warning signs) |
| Numbness around the groin or buttocks, new bladder or bowel problems, progressive leg weakness | emergency | emergency department the same day | [69] |
| Dark (cola-coloured) urine, muscle pain and swelling out of proportion 1–3 days after a session, generalised weakness | same day | medical care; drink fluids; no training | [70] |
| Pop or snap with sudden weakness, bruising or a changed muscle shape (biceps "Popeye" bulge, flattened armpit fold after bench or dips) | within days | doctor or orthopaedic surgeon; early repair gives better results | [30][99] |
| Shoulder dislocation or subluxation, a joint that locks or gives way, rapid joint swelling | within days | medical assessment | [29] |
| Numbness, tingling, burning or weakness running down an arm or leg, or weaker grip | within days; emergency if progressive | medical assessment | [69] |
| Back pain with fever, unexplained weight loss, a history of cancer, night pain that no position eases, major trauma, or new back pain after age 50 | soon | doctor | [69] |
| New bulge in the groin or abdomen when straining | soon | doctor; avoid heavy straining until checked | design default |
| Pain that does not improve after 2 weeks of modified training, or that wakes you at night | soon | physiotherapist or doctor | design default |

### M. Sleep, recovery and deloads

| Item | Rule | Evidence |
|---|---|---|
| Sleep target | ≥ 7 h a night | [71] |
| Last night < 6 h | Train, but no top sets or tests; +1 RIR on compounds; prefer machines and single-joint work; keep the session at or below the planned volume | sleep loss −7.6% performance (~0.4% per extra hour awake; morning tasks largely spared); multi-joint strength affected, single-joint not [73][74] |
| ≥ 3 nights < 6 h in 7 days | Reactive deload trigger (the research-01 trigger list) | one night of deprivation cut MPS by 18% [72] |
| Spacing | ≥ 48 h between hard sessions for the same muscle and tendon | [56][57] |
| DOMS | Train other muscles or the same ones lighter for 1–2 days; introduce new eccentric work over 1–2 weeks | [64][66] |
| Deload prescription | Sets × 0.5, load × 0.9, RIR ≥ 4, same frequency, 5–7 days (research 01/02) | coaches' consensus and practice survey; a full week off cost strength [76][77][78] |
| Safety deload triggers | Amber in the same region in 2 consecutive sessions; morning stiffness rising for 2 weeks; ≥ 3 poor-sleep nights in a week; illness; plus the research-02 performance triggers | design default built on [61] |
| Regional deload | Deload only the exercises that load the painful region; the rest continue | design default |
| Illness | No training with a fever; restart with a deload-level session | design default |
| Energy | Keep the deficit at or below ~500 kcal/day (research 06); a large deficit plus rising volume adds recovery debt | research 06 |

### N. Cue library by exercise class

The cues are class-level safety cues: the exercise pages carry fuller, exercise-specific cues and mistakes from the catalog, which these do not contradict. The "Global" row applies to every class.

| Class | Cues | Main risk | Sources |
|---|---|---|---|
| **Global** (every class) | (1) Set the machine up before loading it: seat height, pads, pivot aligned with the joint, range limiter. (2) Control every rep: 2–3 s down, no bouncing, no slamming the stack. (3) Exhale through the effort; hold your breath only briefly on the hardest reps. (4) End the set at the first rep that looks different from rep 1; never grind a compound to failure. (5) Pain check every set: 0–3 continue, 4–5 modify, 6+ or sharp pain stop. | Most gym injuries are overuse from load spikes plus fatigue, or weights dropped on the body. | [1][6][9] |
| `horizontal-press` | (1) Set the seat so the handles start level with mid-chest, not behind it. (2) Pull the shoulder blades back and down before the first rep and keep them there. (3) Hands no wider than about 1.5× shoulder width; elbows 45–60° from the torso, never flared to 90°. (4) Keep the wrists straight and stacked over the forearms. (5) Lower in 2–3 s and don't let the elbows sink far behind the body. | Front of the shoulder: impingement, anterior instability, AC-joint overload (distal clavicle osteolysis) and, rarely, a pec-major tear in the heavy lowering phase. | [5][28][30][33][34] |
| `incline-press` | (1) Set the bench or seat at 30–45° so the handles start at the upper chest. (2) Shoulder blades back and down; no shrug at the top. (3) Elbows 45–60° with vertical forearms, never past about 75°. (4) Lower in 2–3 s to the upper chest, no deeper. | Anterior shoulder and AC joint: the arm works closer to overhead, so a low seat turns it into a pinching shoulder press. | [28][33] |
| `decline-press` | (1) Chest up, shoulders pulled down away from the ears. (2) Elbows point back, close to the body. (3) Dips: lower only until the upper arm is about parallel to the floor; use the assisted machine until you can do 8 controlled reps. (4) On machines, stop the return at about 90° of elbow bend. | The front of the shoulder in deep dips (shoulder extension under load); otherwise one of the safer chest positions. | [5][28] |
| `chest-fly` | (1) Set the seat so the handles are at or slightly below shoulder height. (2) Keep a soft, fixed elbow bend: hug, don't press. (3) Set the start so the arms open only to the line of the torso, never behind it. (4) Open slowly (2–3 s) and don't bounce in the stretch. | The anterior capsule and pec tendon in the high-five position: arm out, rotated back, behind the body. | [5][28][30] |
| `vertical-press` | (1) Always press in front of the head, never behind the neck. (2) Elbows about 30° in front of the body (scapular plane), wrists over the elbows. (3) Ribs down and back on the pad; if the lower back arches off it, the weight is too heavy. (4) Lower to about shoulder height, no deeper, and press without shrugging. | Subacromial impingement and anterior shoulder stress; lower-back hyperextension when standing. | [5][28][86] |
| `lateral-raise` | (1) Raise in the scapular plane, arms about 30° forward of the sides. (2) Thumbs neutral or slightly up; don't 'pour the can'. (3) Stop at shoulder height (90°). (4) Lead with the elbows, shoulders down, no swing; 2–3 s down. | Subacromial impingement when raising above 90° or with the arm turned in. | [28][35][88] |
| `rear-delt` | (1) Chest on the pad, or a braced flat-back hinge for free weights. (2) Soft elbows; sweep wide to the line of the body, no further. (3) Shoulders down; don't shrug or poke the chin forward. (4) Light to moderate load for 12–20 reps, with a slow return. | Low: neck and upper-trap strain from shrugging; lower back in unsupported bent-over versions. | [37][90] |
| `external-rotation` | (1) Elbow pinned to the side (a rolled towel helps), forearm level. (2) Rotate out slowly through a comfortable range without twisting the torso. (3) Go light: 12–20 reps at RIR 2–3, because this is joint-health work. (4) Do it 2–3 times a week, as warm-up activation or as a programmed set. | Low; heavy or jerky loading can irritate the cuff. | [28][35][38] |
| `shrug` | (1) Lift straight up toward the ears, hold 1 s, lower fully. (2) No rolling; arms long and relaxed; straps are fine. (3) Chin level and neck neutral. | Neck strain from jutting the head forward; dropped dumbbells. | [6] |
| `vertical-pull` | (1) Pull to the front, handles or bar to the upper chest; never behind the neck. (2) Start by drawing the shoulder blades down, then drive the elbows to the ribs. (3) Grip about 1–1.5× shoulder width; take neutral handles if the shoulders or elbows complain. (4) Return in 2–3 s to straight arms without letting the stack yank you up. | Shoulder impingement or anterior instability with behind-the-neck pulls; medial elbow and biceps-tendon strain with heavy supinated (chin-up) grips. | [5][28][31][32] |
| `lat-isolation` | (1) Arms nearly straight with a fixed elbow bend. (2) Ribs down; don't arch the lower back to gain range. (3) Take the overhead stretch only as far as it is pain-free. (4) Lower slowly, and finish the set with the foot bar or rack. | Rotator-cuff compression in the overhead stretch (hyperflexion) and lower-back arching. | [28] |
| `horizontal-pull` | (1) Prefer chest-supported rows and keep the chest on the pad for the whole set. (2) Shoulder blades back first, then elbows past the torso; pause 1 s. (3) Return until the arms are straight and the shoulder blades spread. (4) No rocking or yanking; neck long, chin slightly tucked. (5) On unsupported rows, hinge with a braced flat back. | Lower-back strain in unsupported rows (the bent-over row puts the highest load on the lower back); biceps and elbow strain when yanking. | [11][41] |
| `spinal-extension` | (1) Fasten the pelvic restraint or footplate so the lower back moves, not the hips. (2) Move slowly, 2 s back and 3–4 s forward; finish upright, not hyperextended. (3) Start light: 15–20 reps, 2–3 reps short of failure, for the first weeks. (4) Effort is fine, but sharp pain or pain radiating into the leg means stop. | Lower-back strain or disc irritation with fast, heavy, end-range reps. | [44][45][92] |
| `neck` | (1) Start with 5–10 s isometric holds and very light loads. (2) Only the head moves and the torso stays fixed; 2 s out, 3 s back. (3) Stay in a pain-free middle range; never load the end of range or jerk. (4) Stop 2–3 reps short of failure; stop at once with dizziness, tingling or arm symptoms. | Neck strain or nerve-root irritation from heavy, jerky or end-range loading. | [80] |
| `biceps-curl` | (1) Elbows fixed, on the pad or at the sides; no swinging. (2) Lower in 2–3 s and never let the weight drop into a locked elbow. (3) Wrists straight; switch to an EZ bar, dumbbells or cables if the straight bar strains wrists or elbows. (4) Progress by reps first, then in small load steps. | Distal biceps tendon under heavy eccentric load at full extension; elbow tendinopathy from volume spikes. | [46][49][99] |
| `brachialis-curl` | (1) Hold the neutral (hammer) or overhand grip for the whole rep, wrist in line with the forearm. (2) Elbows pinned; control the lowering. (3) Keep reverse curls lighter than hammer curls; an EZ bar eases the wrists. | Lateral elbow (forearm extensor) tendinopathy, especially with heavy reverse curls. | [48][49] |
| `triceps-extension` | (1) Upper arms stay still; only the elbows move. (2) Overhead: ribs down, go only as deep as the elbow and shoulder tolerate, and start about a third lighter than pushdowns. (3) Use a rope, neutral or EZ grip if the elbow or wrist aches. (4) Control the stretch; no bouncing at the bottom. | Triceps-tendon and back-of-elbow irritation from skull crushers and heavy overhead work. | [46] |
| `triceps-press` | (1) Elbows close to the body and pointing back (about 30–45°). (2) Close-grip press: hands about shoulder width, not touching; wrists stacked. (3) Dips: torso upright, depth until the upper arm is parallel. (4) On the machine, stop the return at about 90° of elbow bend. | The back of the elbow and, in dips, the front of the shoulder. | [28] |
| `wrist` | (1) Forearms supported on the thighs or a bench; only the wrists move. (2) Light weight for 15–25 slow reps; no jerks or drops at the bottom. (3) Use about half the wrist-curl load for reverse wrist curls. | Medial or lateral elbow tendinopathy from heavy, jerky wrist work. | [48][49] |
| `grip` | (1) Pick up and set down with a hinge and a braced back; never round over to grab. (2) Stand tall with the shoulders down and take short steps; set the weights down before your grip fails. (3) Clear the path, wear closed shoes and keep the weights away from your feet. (4) Dead hang: keep the shoulders slightly active, and step down instead of dropping. | Weights dropped on feet or hands (the leading cause of gym emergency visits) and lower-back strain at pick-up. | [6][83] |
| `spine-stability` | (1) Brace as if about to be poked, and keep breathing. (2) Neutral spine: hips neither sagging nor piked. (3) Quality over time: hold 10–30 s and stop when form breaks. (4) Slow limb movements in dead bugs and bird dogs. | Low; lower-back sag in planks and shoulder load on the elbows. | [39][85] |
| `trunk-flexion` | (1) Curl the ribs toward the pelvis: roll, don't fold at the hips. (2) The head moves with the trunk, chin slightly tucked, hands on the chest or handles; never pull on the head. (3) Exhale on the curl, squeeze 1 s, take 2–3 s back. (4) Loaded flexion: 2–3 sets of 8–15, at most twice a week; skip it in the first hour after waking. | Neck strain from pulling on the head; disc irritation from high-rep loaded flexion (risk debated). | [52][53][92][100] |
| `lower-ab-flexion` | (1) Lift the knees, then curl the pelvis up toward the ribs; that last part is the abs. (2) No swinging; pause at the top and lower in 2–3 s. (3) Bent knees first; straight legs only once you have full control. (4) Press down through the forearms on the captain's chair, or keep the shoulders active when hanging. | Lower-back arching and hip-flexor dominance; shoulder strain when hanging. | [85][100] |
| `anti-extension` | (1) Ribs down and glutes squeezed; the lower back must not sag. (2) Ab wheel: start on the knees with a short range (roll to a wall) and extend it week by week. (3) Exhale and pull back with the abs and lats; stop when the hips drop. | Lower-back hyperextension at the far end of the rollout. | [85] |
| `anti-rotation` | (1) Stand side-on to the cable, braced, hips and shoulders square. (2) Press straight out from the breastbone, hold 2–3 s, return slowly. (3) Progress by load or distance from the stack in small steps. | Low. | [85] |
| `rotation` | (1) Brace and turn the ribcage and pelvis together; the lower back doesn't twist on its own. (2) Pivot the back foot so the hips can rotate (woodchop). (3) Controlled tempo, no momentum; on the rotary machine, moderate range and load. (4) Never round forward and twist at the same time. | Lower-back disc or facet strain from bending and twisting together under load. | [85] |
| `anti-lateral-flexion` | (1) Keep a straight line from head to feet with the hips stacked, not sagging. (2) Elbow under the shoulder; push the floor away. (3) Suitcase carry: stand tall without leaning, and pick the weight up with a hinge. | Low; shoulder load in side planks and the lower back at pick-up. | [85] |
| `squat` | (1) Leg press or hack squat: go only as deep as the pelvis and lower back stay on the pad. (2) Knees track over the second toe; heels down. (3) Brace before lowering and exhale through the hardest part. (4) Don't snap into locked knees, and use the safety stops. | Lower-back flexion under load at the bottom (pelvis rolling off the pad); knee irritation from ballistic lockouts. | [11][91] |
| `knee-extension` | (1) Line the knee up with the machine pivot, with the pad just above the ankle. (2) Extend smoothly, squeeze 1 s, take 2–3 s down; no kicking. (3) Shorten the range if the front of the knee hurts. | Front-of-knee (patellofemoral or patellar-tendon) irritation with heavy, fast reps. | [46] |
| `knee-flexion` | (1) Knee at the pivot, thighs pinned, hips down. (2) Curl fully, pause, return slowly. (3) Nordic curls: partial range and very low volume at first; expect strong DOMS. | Hamstring strain or cramp; severe DOMS from new eccentric work. | [64][66] |
| `hip-hinge` | (1) Hips back, back flat, bar or handles close to the legs. (2) Brace before every rep, and lower only as far as the back stays flat. (3) If your back position changes, set the weight down and end the set. (4) Do the heaviest hinge work early in the session, never after fatiguing back work. | Lower-back strain when fatigue lets the spine round. | [11][40][84] |
| `hip-thrust` | (1) Chin tucked and ribs down; finish with the glutes, not a lower-back arch. (2) Shins vertical at the top, with a 1 s pause. (3) Pad the bar or use the machine belt. | Lower-back hyperextension used to fake the lockout. | catalog; design default |
| `hip-abduction` | (1) Sit back on the seat without rocking. (2) Push out to a comfortable width, pause 1 s, return slowly without slamming. (3) Use a range you control; no bouncing. | Low; a strain from bouncing at end range. | catalog; design default |
| `hip-adduction` | (1) Start with a narrow setting and widen it over weeks. (2) Squeeze smoothly and open slowly (2–3 s); never let the weight yank the legs apart. (3) Copenhagen plank: start with the short lever (knee support). | Groin (adductor) strain from a wide start or jerky first reps. | catalog; design default |
| `calf-straight` | (1) Lower over 2–3 s into a deep stretch and pause 1–2 s; no bounce. (2) Knees straight but not locked. (3) Leg-press calf raise: feet secure on the plate and safety stops engaged. (4) Add load in small steps, because the Achilles tendon adapts slowly. | Achilles overload from load jumps or bouncing; a foot slipping on the leg-press plate. | [54][55][60] |
| `calf-bent` | (1) Lower slowly, pause in the stretch, then rise fully. (2) Pad on the lower thighs, torso still. (3) Lock the safety lever before taking your feet off. | Achilles irritation from load jumps. | [55] |

### Notes on evidence strength

- **Epidemiology:** mostly retrospective, self-reported and with mixed injury definitions [1][2]. The recreational data are thin: one small prospective cohort, emergency-department series and surveys. Rates are reliable to an order of magnitude only.
- **Warm-up:** moderate evidence for better performance, especially from loaded, specific ramp sets [22][23]. The 5-minute general default is shorter than the best-performing 15-minute protocol [19]; it may cost up to about 3% of one-rep-max strength, which matters only on test days, when the warm-up is extended. No direct evidence that warming up prevents injury in resistance training [27]. The ladder itself is practice.
- **Shoulder technique:** biomechanical models, EMG, case series and expert opinion. No trial randomises technique and counts injuries [5][33]. We follow the rules because they cost nothing in results: front pulldowns match lat activity, and narrower grips change 1RM by about 5% [34].
- **Pain model:** one RCT in Achilles tendinopathy plus clinical use, extrapolated to the upper-limb tendons and to self-coaching [60].
- **Tendon timeline:** small samples, mostly patellar and Achilles tendons, extrapolated to the elbow and shoulder [54][55].
- **ACWR:** team-sport cohorts, contested statistics, never studied in recreational lifting [59][96].
- **Sleep and injury:** the injury link comes from adolescents [75]. The performance effects come from adult meta-analyses [73].

---

## safety_rules (machine-readable)

```json safety_rules
{
  "schema": "ilyadays.fitness.safety_rules",
  "version": "1.0.0",
  "generated": "2026-11-08",
  "note": "Research 03. Same top-level shape as content/fitness/safety.json, with plain English strings (stream 08 adds ru). Ramp percentages are of the working load. Numbers in refs point to the Sources list.",
  "warmup": {
    "general": "5 min of easy cardio (bike, rower or brisk incline walk) at a pace where you can still talk in full sentences (RPE 3–4 of 10). Make it 8–10 min on heavy days, after a week or more off, or in a cold gym; finish warm, not tired. Then 1–2 min of shoulder activation before the first press or pull: 15 band pull-aparts and 12–15 band external rotations per arm. Then do ramp sets before the first working set of each exercise.",
    "generalMinutes": {
      "default": 5,
      "extended": 10,
      "max": 15,
      "extendWhen": [
        "heavy or max tier on the first exercise",
        "first session after >= 7 days off",
        "cold gym",
        "age >= 40 (design default 8 min)"
      ]
    },
    "intensity": {
      "rpe": [3, 4],
      "talkTest": "full sentences",
      "avoid": "anything that leaves you breathing hard: 15 min at about 70% VO2max lowered 1RM by about 4%"
    },
    "activation": [
      {
        "id": "band-pull-apart",
        "sets": 1,
        "reps": 15,
        "when": "before the first press or pull of the session"
      },
      {
        "id": "band-external-rotation",
        "sets": 1,
        "reps": "12-15 per arm",
        "when": "before the first press or pull of the session"
      },
      {
        "id": "dead-bug",
        "sets": 1,
        "reps": "6 per side",
        "when": "optional, before heavy hinges or carries"
      }
    ],
    "ramp": [
      {"pct": 50, "reps": 8, "when": "always"},
      {"pct": 70, "reps": 4, "when": "moderate"},
      {"pct": 85, "reps": 2, "when": "heavy"},
      {"pct": 92, "reps": 1, "when": "max"}
    ],
    "tiers": {
      "order": ["light", "moderate", "heavy", "max"],
      "minPctE1rm": {"moderate": 68, "heavy": 80, "max": 90},
      "maxRepsPlusRir": {"moderate": 14, "heavy": 8, "max": 3},
      "rule": "With a known e1RM, the tier is the highest one whose minPctE1rm the working load reaches. Without one, use the target reps + RIR (RIR defaults to 2): the highest tier whose maxRepsPlusRir it does not exceed. Below every threshold the tier is light. The heavy cut-offs (80%, 8) and the e1RM-first logic match progression.mjs and templates.json."
    },
    "whenSemantics": "A step is used when the exercise tier is at or above step.when in tiers.order; 'always' means every tier. The light tier uses only the 'always' step with 10 reps, and only for the first exercise that loads that joint in the session. progression.mjs currently keeps a step when its when is 'always' or the exercise is heavy; with this ladder that would give heavy exercises the 92% x 1 step and moderate ones only 50% x 8, so its filter must compare tiers as described here (engine change).",
    "rules": {
      "pctOf": "working load; for assisted machines, the effective load (body weight - assistance)",
      "isolation": {
        "maxSteps": 1,
        "reps": 10,
        "skipIfMuscleAlreadyWorked": true,
        "skipIfWorkingBelowIncrements": 4
      },
      "subsequentSameRegionCompound": "use only the top step of its tier (moderate 70x4; heavy 85x2; max 85x2 then 92x1)",
      "rampEffort": "every ramp set ends at least 5 reps short of failure; ramp sets never count as working sets",
      "maxRampReps": 20,
      "dedupe": "if two steps round to the same load, keep the heavier one",
      "painCheck": "rate the last ramp set 0-10; 4 or more puts the exercise in amber before the first working set"
    },
    "restAfterStepSec": {"always": [30, 60], "moderate": [60, 90], "heavy": [90, 120], "max": [120, 180]},
    "restNote": "Rest after each ramp step, keyed by that step's when; 30-45 s on light-tier exercises.",
    "machine": {
      "setupFirst": "Set the seat, pads, range limiter and handle start before the first ramp set (joint at the pivot; press handles start at chest level, not behind it).",
      "roundTo": "nearest machine increment; drop duplicate steps",
      "plateLoaded": "the unloaded machine is the first step when its starting resistance is at least the step load; skip lighter steps",
      "assisted": "ramp by adding assistance: first step = working assistance + 2 increments, or 50% of the effective load when body weight is known",
      "unilateral": "ramp both sides, weaker side first",
      "isolationAfterCompound": "no ramp"
    },
    "staticStretching": "optional; at most 30-60 s per muscle, followed by the ramp sets",
    "refs": [17, 18, 19, 20, 22, 23, 24, 25, 27, 79]
  },
  "pain": [
    {
      "level": "green",
      "range": [0, 3],
      "action": "Discomfort of 0–3 out of 10 that stays stable and is back to normal by the next morning: carry on and progress as planned.",
      "progress": true
    },
    {
      "level": "amber",
      "range": [4, 5],
      "action": "Pain of 4–5, pain that rises from set to set, or more pain or stiffness than usual the next morning: modify this exercise today. Cut the load 10–20%, shorten the range, slow the lowering to 3 s, or swap to a pain-free exercise from the same class. Don't progress it until two sessions in a row are green.",
      "progress": false,
      "loadMultiplier": [0.8, 0.9],
      "minRir": 2,
      "clearAfterGreenSessions": 2
    },
    {
      "level": "red",
      "range": [6, 10],
      "action": "Pain of 6 or more, or any sharp, stabbing or catching pain, pain that changes how you move, or pain with a pop, locking, giving way, numbness or weakness: stop this exercise today and train other areas. See a clinician if it is red two sessions in a row, amber for more than 2 weeks, or not settling within 7–14 days.",
      "stopExercise": true
    }
  ],
  "painRules": [
    {
      "id": "scale",
      "rule": "Rate the worst pain during the set from 0 (none) to 10 (worst imaginable). Muscle burn and DOMS are not scored.",
      "refs": [60]
    },
    {
      "id": "nextMorning",
      "rule": "Pain must be back to your usual level the next morning, and never above 5. If not, the exercise starts amber next session.",
      "refs": [60]
    },
    {
      "id": "weekly",
      "rule": "Pain and stiffness must not trend upward week to week. Two weeks of upward trend: cut that region's weekly sets by 30–50% or deload the region.",
      "refs": [60, 61]
    },
    {
      "id": "redOverrides",
      "rule": "Sharp, stabbing or catching pain, pain that changes the movement, a pop, locking, giving way, numbness or weakness count as red whatever the number.",
      "refs": []
    },
    {
      "id": "previousInjury",
      "rule": "For a region with a previous injury, use +1 RIR and half-size load steps for 8 weeks after returning (design default; re-injury risk is about 2x).",
      "refs": [8]
    },
    {
      "id": "origin",
      "rule": "Adapted from the Thomeé/Silbernagel pain-monitoring model (0–2 safe, 2–5 acceptable, 5–10 high risk; up to 5 allowed during and after activity under clinical supervision). The app modifies from 4 because it coaches unsupervised. Painful exercise is not harmful in itself.",
      "refs": [61, 62, 63, 98]
    }
  ],
  "doms": {
    "onsetHours": [12, 24],
    "peakHours": [24, 72],
    "resolvesDays": [5, 7],
    "signs": [
      "diffuse ache in the muscle belly",
      "often on both sides",
      "tender to touch, stiff",
      "eases as you warm up",
      "much smaller after the first exposure to an exercise"
    ],
    "injurySigns": [
      "sharp, stabbing or catching pain",
      "one point: joint line, tendon, one side",
      "began during a set or on one rep",
      "swelling, bruising, weakness, giving way or lost range",
      "not settling after 7 days"
    ],
    "action": "DOMS: train other muscles, or the same muscles lighter, for 1–2 days; introduce new eccentric work over 1–2 weeks. Signs of injury: use the pain traffic light and the red flags.",
    "refs": [64, 65, 66]
  },
  "redFlags": [
    {
      "urgency": "emergency",
      "text": "Chest pain, pressure or tightness (possibly spreading to the arm, jaw or back), unusual breathlessness, palpitations or an irregular heartbeat, dizziness or fainting during or after exercise: stop and call emergency services.",
      "refs": [67]
    },
    {
      "urgency": "emergency",
      "text": "A sudden severe headache during or right after a lift (worst ever, peaking within a minute), with or without neck stiffness, vomiting or confusion: stop and go to an emergency department.",
      "refs": [68]
    },
    {
      "urgency": "emergency",
      "text": "Sudden weakness or numbness of the face or a limb, slurred speech or loss of vision: call emergency services.",
      "refs": []
    },
    {
      "urgency": "emergency",
      "text": "Numbness around the groin or buttocks, new bladder or bowel problems, or progressive leg weakness: emergency department the same day.",
      "refs": [69]
    },
    {
      "urgency": "same-day",
      "text": "Dark, cola-coloured urine with muscle pain and swelling out of proportion 1–3 days after a session, or generalised weakness: get medical care the same day (possible rhabdomyolysis); drink fluids and don't train.",
      "refs": [70]
    },
    {
      "urgency": "days",
      "text": "A pop or snap followed by sudden weakness, bruising or a changed muscle shape (a biceps 'Popeye' bulge, a flattened armpit fold after bench presses or dips): see a doctor within days, because early repair gives better results.",
      "refs": [30, 99]
    },
    {
      "urgency": "days",
      "text": "A shoulder that dislocated or slipped, a joint that locks or gives way, or rapid joint swelling: get a medical assessment.",
      "refs": [29]
    },
    {
      "urgency": "days",
      "text": "Numbness, tingling, burning or weakness running down an arm or leg, or a weaker grip: get a medical assessment; go to emergency if it is getting worse.",
      "refs": [69]
    },
    {
      "urgency": "soon",
      "text": "Back pain with fever, unexplained weight loss, a history of cancer, night pain that no position eases, major trauma, or new back pain after age 50: see a doctor.",
      "refs": [69]
    },
    {
      "urgency": "soon",
      "text": "A new bulge in the groin or abdomen when straining: see a doctor and avoid heavy straining until checked.",
      "refs": []
    },
    {
      "urgency": "soon",
      "text": "Pain that does not improve after 2 weeks of modified training, or that wakes you at night: see a physiotherapist or doctor.",
      "refs": []
    }
  ],
  "recovery": [
    {"id": "sleep", "rule": "Sleep at least 7 h a night.", "refs": [71]},
    {
      "id": "shortNight",
      "rule": "Last night under 6 h: train, but no top sets or tests, +1 RIR on compounds, prefer machines and single-joint work, and keep volume at or below the plan.",
      "refs": [73, 74]
    },
    {
      "id": "sleepDebt",
      "rule": "Three or more nights under 6 h in 7 days is a reactive deload trigger.",
      "refs": [72, 74]
    },
    {
      "id": "spacing",
      "rule": "Allow at least 48 h between hard sessions for the same muscle and tendon (the 3-day non-consecutive split does this).",
      "refs": [56, 57]
    },
    {
      "id": "doms",
      "rule": "Train other muscles or the same muscles lighter for 1–2 days; introduce new eccentric work over 1–2 weeks.",
      "refs": [64, 66]
    },
    {
      "id": "illness",
      "rule": "No training with a fever; restart with a deload-level session (design default).",
      "refs": []
    },
    {
      "id": "energy",
      "rule": "Keep the energy deficit at or below about 500 kcal/day (research 06); a large deficit plus rising volume adds recovery debt.",
      "refs": []
    }
  ],
  "deload": {
    "setMultiplier": 0.5,
    "loadMultiplier": 0.9,
    "minRir": 4,
    "days": [5, 7],
    "keepFrequency": true,
    "completeRest": false,
    "safetyTriggers": [
      "amber in the same region in 2 consecutive sessions",
      "morning stiffness or pain trending up for 2 weeks",
      ">= 3 nights under 6 h of sleep in 7 days",
      "illness",
      "plus the research-02 performance triggers"
    ],
    "regional": "Deload only the exercises that load the painful region; the rest of the plan continues.",
    "refs": [76, 77, 78]
  },
  "loadGuards": {
    "maxLoadStepPct": 10,
    "maxWeeklyHardSetIncreasePerMuscle": 2,
    "weeklyLoadChangeWarnPct": 20,
    "newExercise": {"sessions": 2, "sets": 2, "rir": [3, 4]},
    "afterGap": "use the research-02 gap rules",
    "tendonHeavyLifts": "progress curls, triceps extensions and calf raises by reps before load",
    "heavyLoadExposure": "some work above 70% e1RM for each region every week",
    "previousInjury": {"weeks": 8, "extraRir": 1, "stepMultiplier": 0.5},
    "refs": [8, 10, 54, 55, 56]
  },
  "techniqueGuards": {
    "compoundRir": {"default": 2, "min": 1},
    "isolationRir": {"default": [1, 2], "min": 0},
    "stopAtTechniqueBreak": true,
    "hardestFirst": true,
    "noTrueOneRepMax": "test with a 3–5RM or an e1RM from sets with at most 12 total reps; no singles above 90% e1RM",
    "neverBehindNeck": true,
    "pressGripMaxShoulderWidths": 1.5,
    "pressElbowAngleDeg": [45, 60],
    "lateralRaiseMaxDeg": 90,
    "flyMaxHorizontalAbduction": "arms in line with the torso, never behind it",
    "dipDepth": "upper arm about parallel to the floor",
    "rowDefault": "chest-supported",
    "lumbarMachine": {"pelvicRestraint": true, "repsFirstWeeks": [15, 20], "minRirFirstWeeks": 3},
    "breathHoldMaxSec": 3,
    "refs": [9, 11, 12, 28, 33, 34, 35, 41, 42, 44]
  },
  "acwr": {
    "use": "chart annotation only; never changes the plan automatically",
    "method": "EWMA, uncoupled, 7/28 days (research 07); on weekly hard sets per muscle group and volume load per pattern",
    "bands": {"dipBelow": 0.8, "steady": [0.8, 1.3], "ramping": [1.3, 1.5], "spikeAtOrAbove": 1.5},
    "caveat": "Team-sport heuristics; mathematical coupling; no predictive gain over acute load; never studied in recreational lifting.",
    "refs": [10, 58, 59, 96, 97]
  },
  "globalCues": {
    "cues": [
      "Set the machine up before loading it: seat height, pads, pivot aligned with the joint, range limiter.",
      "Control every rep: 2–3 s down, no bouncing, no slamming the stack.",
      "Exhale through the effort; hold your breath only briefly on the hardest reps.",
      "End the set at the first rep that looks different from rep 1; never grind a compound to failure.",
      "Pain check every set: 0–3 continue, 4–5 modify, 6+ or sharp pain stop."
    ],
    "risk": "Most gym injuries are overuse from load spikes plus fatigue, or weights dropped on the body.",
    "refs": [1, 6, 9]
  },
  "families": {
    "horizontal-press": {
      "cues": [
        "Set the seat so the handles start level with mid-chest, not behind it.",
        "Pull the shoulder blades back and down before the first rep and keep them there.",
        "Hands no wider than about 1.5× shoulder width; elbows 45–60° from the torso, never flared to 90°.",
        "Keep the wrists straight and stacked over the forearms.",
        "Lower in 2–3 s and don't let the elbows sink far behind the body."
      ],
      "risk": "Front of the shoulder: impingement, anterior instability, AC-joint overload (distal clavicle osteolysis) and, rarely, a pec-major tear in the heavy lowering phase.",
      "refs": [5, 28, 30, 33, 34]
    },
    "incline-press": {
      "cues": [
        "Set the bench or seat at 30–45° so the handles start at the upper chest.",
        "Shoulder blades back and down; no shrug at the top.",
        "Elbows 45–60° with vertical forearms, never past about 75°.",
        "Lower in 2–3 s to the upper chest, no deeper."
      ],
      "risk": "Anterior shoulder and AC joint: the arm works closer to overhead, so a low seat turns it into a pinching shoulder press.",
      "refs": [28, 33]
    },
    "decline-press": {
      "cues": [
        "Chest up, shoulders pulled down away from the ears.",
        "Elbows point back, close to the body.",
        "Dips: lower only until the upper arm is about parallel to the floor; use the assisted machine until you can do 8 controlled reps.",
        "On machines, stop the return at about 90° of elbow bend."
      ],
      "risk": "The front of the shoulder in deep dips (shoulder extension under load); otherwise one of the safer chest positions.",
      "refs": [5, 28]
    },
    "chest-fly": {
      "cues": [
        "Set the seat so the handles are at or slightly below shoulder height.",
        "Keep a soft, fixed elbow bend: hug, don't press.",
        "Set the start so the arms open only to the line of the torso, never behind it.",
        "Open slowly (2–3 s) and don't bounce in the stretch."
      ],
      "risk": "The anterior capsule and pec tendon in the high-five position: arm out, rotated back, behind the body.",
      "refs": [5, 28, 30]
    },
    "vertical-press": {
      "cues": [
        "Always press in front of the head, never behind the neck.",
        "Elbows about 30° in front of the body (scapular plane), wrists over the elbows.",
        "Ribs down and back on the pad; if the lower back arches off it, the weight is too heavy.",
        "Lower to about shoulder height, no deeper, and press without shrugging."
      ],
      "risk": "Subacromial impingement and anterior shoulder stress; lower-back hyperextension when standing.",
      "refs": [5, 28, 86]
    },
    "lateral-raise": {
      "cues": [
        "Raise in the scapular plane, arms about 30° forward of the sides.",
        "Thumbs neutral or slightly up; don't 'pour the can'.",
        "Stop at shoulder height (90°).",
        "Lead with the elbows, shoulders down, no swing; 2–3 s down."
      ],
      "risk": "Subacromial impingement when raising above 90° or with the arm turned in.",
      "refs": [28, 35, 88]
    },
    "rear-delt": {
      "cues": [
        "Chest on the pad, or a braced flat-back hinge for free weights.",
        "Soft elbows; sweep wide to the line of the body, no further.",
        "Shoulders down; don't shrug or poke the chin forward.",
        "Light to moderate load for 12–20 reps, with a slow return."
      ],
      "risk": "Low: neck and upper-trap strain from shrugging; lower back in unsupported bent-over versions.",
      "refs": [37, 90]
    },
    "external-rotation": {
      "cues": [
        "Elbow pinned to the side (a rolled towel helps), forearm level.",
        "Rotate out slowly through a comfortable range without twisting the torso.",
        "Go light: 12–20 reps at RIR 2–3, because this is joint-health work.",
        "Do it 2–3 times a week, as warm-up activation or as a programmed set."
      ],
      "risk": "Low; heavy or jerky loading can irritate the cuff.",
      "refs": [28, 35, 38]
    },
    "shrug": {
      "cues": [
        "Lift straight up toward the ears, hold 1 s, lower fully.",
        "No rolling; arms long and relaxed; straps are fine.",
        "Chin level and neck neutral."
      ],
      "risk": "Neck strain from jutting the head forward; dropped dumbbells.",
      "refs": [6]
    },
    "vertical-pull": {
      "cues": [
        "Pull to the front, handles or bar to the upper chest; never behind the neck.",
        "Start by drawing the shoulder blades down, then drive the elbows to the ribs.",
        "Grip about 1–1.5× shoulder width; take neutral handles if the shoulders or elbows complain.",
        "Return in 2–3 s to straight arms without letting the stack yank you up."
      ],
      "risk": "Shoulder impingement or anterior instability with behind-the-neck pulls; medial elbow and biceps-tendon strain with heavy supinated (chin-up) grips.",
      "refs": [5, 28, 31, 32]
    },
    "lat-isolation": {
      "cues": [
        "Arms nearly straight with a fixed elbow bend.",
        "Ribs down; don't arch the lower back to gain range.",
        "Take the overhead stretch only as far as it is pain-free.",
        "Lower slowly, and finish the set with the foot bar or rack."
      ],
      "risk": "Rotator-cuff compression in the overhead stretch (hyperflexion) and lower-back arching.",
      "refs": [28]
    },
    "horizontal-pull": {
      "cues": [
        "Prefer chest-supported rows and keep the chest on the pad for the whole set.",
        "Shoulder blades back first, then elbows past the torso; pause 1 s.",
        "Return until the arms are straight and the shoulder blades spread.",
        "No rocking or yanking; neck long, chin slightly tucked.",
        "On unsupported rows, hinge with a braced flat back."
      ],
      "risk": "Lower-back strain in unsupported rows (the bent-over row puts the highest load on the lower back); biceps and elbow strain when yanking.",
      "refs": [11, 41]
    },
    "spinal-extension": {
      "cues": [
        "Fasten the pelvic restraint or footplate so the lower back moves, not the hips.",
        "Move slowly, 2 s back and 3–4 s forward; finish upright, not hyperextended.",
        "Start light: 15–20 reps, 2–3 reps short of failure, for the first weeks.",
        "Effort is fine, but sharp pain or pain radiating into the leg means stop."
      ],
      "risk": "Lower-back strain or disc irritation with fast, heavy, end-range reps.",
      "refs": [44, 45, 92]
    },
    "neck": {
      "cues": [
        "Start with 5–10 s isometric holds and very light loads.",
        "Only the head moves and the torso stays fixed; 2 s out, 3 s back.",
        "Stay in a pain-free middle range; never load the end of range or jerk.",
        "Stop 2–3 reps short of failure; stop at once with dizziness, tingling or arm symptoms."
      ],
      "risk": "Neck strain or nerve-root irritation from heavy, jerky or end-range loading.",
      "refs": [80]
    },
    "biceps-curl": {
      "cues": [
        "Elbows fixed, on the pad or at the sides; no swinging.",
        "Lower in 2–3 s and never let the weight drop into a locked elbow.",
        "Wrists straight; switch to an EZ bar, dumbbells or cables if the straight bar strains wrists or elbows.",
        "Progress by reps first, then in small load steps."
      ],
      "risk": "Distal biceps tendon under heavy eccentric load at full extension; elbow tendinopathy from volume spikes.",
      "refs": [46, 49, 99]
    },
    "brachialis-curl": {
      "cues": [
        "Hold the neutral (hammer) or overhand grip for the whole rep, wrist in line with the forearm.",
        "Elbows pinned; control the lowering.",
        "Keep reverse curls lighter than hammer curls; an EZ bar eases the wrists."
      ],
      "risk": "Lateral elbow (forearm extensor) tendinopathy, especially with heavy reverse curls.",
      "refs": [48, 49]
    },
    "triceps-extension": {
      "cues": [
        "Upper arms stay still; only the elbows move.",
        "Overhead: ribs down, go only as deep as the elbow and shoulder tolerate, and start about a third lighter than pushdowns.",
        "Use a rope, neutral or EZ grip if the elbow or wrist aches.",
        "Control the stretch; no bouncing at the bottom."
      ],
      "risk": "Triceps-tendon and back-of-elbow irritation from skull crushers and heavy overhead work.",
      "refs": [46]
    },
    "triceps-press": {
      "cues": [
        "Elbows close to the body and pointing back (about 30–45°).",
        "Close-grip press: hands about shoulder width, not touching; wrists stacked.",
        "Dips: torso upright, depth until the upper arm is parallel.",
        "On the machine, stop the return at about 90° of elbow bend."
      ],
      "risk": "The back of the elbow and, in dips, the front of the shoulder.",
      "refs": [28]
    },
    "wrist": {
      "cues": [
        "Forearms supported on the thighs or a bench; only the wrists move.",
        "Light weight for 15–25 slow reps; no jerks or drops at the bottom.",
        "Use about half the wrist-curl load for reverse wrist curls."
      ],
      "risk": "Medial or lateral elbow tendinopathy from heavy, jerky wrist work.",
      "refs": [48, 49]
    },
    "grip": {
      "cues": [
        "Pick up and set down with a hinge and a braced back; never round over to grab.",
        "Stand tall with the shoulders down and take short steps; set the weights down before your grip fails.",
        "Clear the path, wear closed shoes and keep the weights away from your feet.",
        "Dead hang: keep the shoulders slightly active, and step down instead of dropping."
      ],
      "risk": "Weights dropped on feet or hands (the leading cause of gym emergency visits) and lower-back strain at pick-up.",
      "refs": [6, 83]
    },
    "spine-stability": {
      "cues": [
        "Brace as if about to be poked, and keep breathing.",
        "Neutral spine: hips neither sagging nor piked.",
        "Quality over time: hold 10–30 s and stop when form breaks.",
        "Slow limb movements in dead bugs and bird dogs."
      ],
      "risk": "Low; lower-back sag in planks and shoulder load on the elbows.",
      "refs": [39, 85]
    },
    "trunk-flexion": {
      "cues": [
        "Curl the ribs toward the pelvis: roll, don't fold at the hips.",
        "The head moves with the trunk, chin slightly tucked, hands on the chest or handles; never pull on the head.",
        "Exhale on the curl, squeeze 1 s, take 2–3 s back.",
        "Loaded flexion: 2–3 sets of 8–15, at most twice a week; skip it in the first hour after waking."
      ],
      "risk": "Neck strain from pulling on the head; disc irritation from high-rep loaded flexion (risk debated).",
      "refs": [52, 53, 92, 100]
    },
    "lower-ab-flexion": {
      "cues": [
        "Lift the knees, then curl the pelvis up toward the ribs; that last part is the abs.",
        "No swinging; pause at the top and lower in 2–3 s.",
        "Bent knees first; straight legs only once you have full control.",
        "Press down through the forearms on the captain's chair, or keep the shoulders active when hanging."
      ],
      "risk": "Lower-back arching and hip-flexor dominance; shoulder strain when hanging.",
      "refs": [85, 100]
    },
    "anti-extension": {
      "cues": [
        "Ribs down and glutes squeezed; the lower back must not sag.",
        "Ab wheel: start on the knees with a short range (roll to a wall) and extend it week by week.",
        "Exhale and pull back with the abs and lats; stop when the hips drop."
      ],
      "risk": "Lower-back hyperextension at the far end of the rollout.",
      "refs": [85]
    },
    "anti-rotation": {
      "cues": [
        "Stand side-on to the cable, braced, hips and shoulders square.",
        "Press straight out from the breastbone, hold 2–3 s, return slowly.",
        "Progress by load or distance from the stack in small steps."
      ],
      "risk": "Low.",
      "refs": [85]
    },
    "rotation": {
      "cues": [
        "Brace and turn the ribcage and pelvis together; the lower back doesn't twist on its own.",
        "Pivot the back foot so the hips can rotate (woodchop).",
        "Controlled tempo, no momentum; on the rotary machine, moderate range and load.",
        "Never round forward and twist at the same time."
      ],
      "risk": "Lower-back disc or facet strain from bending and twisting together under load.",
      "refs": [85]
    },
    "anti-lateral-flexion": {
      "cues": [
        "Keep a straight line from head to feet with the hips stacked, not sagging.",
        "Elbow under the shoulder; push the floor away.",
        "Suitcase carry: stand tall without leaning, and pick the weight up with a hinge."
      ],
      "risk": "Low; shoulder load in side planks and the lower back at pick-up.",
      "refs": [85]
    },
    "squat": {
      "cues": [
        "Leg press or hack squat: go only as deep as the pelvis and lower back stay on the pad.",
        "Knees track over the second toe; heels down.",
        "Brace before lowering and exhale through the hardest part.",
        "Don't snap into locked knees, and use the safety stops."
      ],
      "risk": "Lower-back flexion under load at the bottom (pelvis rolling off the pad); knee irritation from ballistic lockouts.",
      "refs": [11, 91]
    },
    "knee-extension": {
      "cues": [
        "Line the knee up with the machine pivot, with the pad just above the ankle.",
        "Extend smoothly, squeeze 1 s, take 2–3 s down; no kicking.",
        "Shorten the range if the front of the knee hurts."
      ],
      "risk": "Front-of-knee (patellofemoral or patellar-tendon) irritation with heavy, fast reps.",
      "refs": [46]
    },
    "knee-flexion": {
      "cues": [
        "Knee at the pivot, thighs pinned, hips down.",
        "Curl fully, pause, return slowly.",
        "Nordic curls: partial range and very low volume at first; expect strong DOMS."
      ],
      "risk": "Hamstring strain or cramp; severe DOMS from new eccentric work.",
      "refs": [64, 66]
    },
    "hip-hinge": {
      "cues": [
        "Hips back, back flat, bar or handles close to the legs.",
        "Brace before every rep, and lower only as far as the back stays flat.",
        "If your back position changes, set the weight down and end the set.",
        "Do the heaviest hinge work early in the session, never after fatiguing back work."
      ],
      "risk": "Lower-back strain when fatigue lets the spine round.",
      "refs": [11, 40, 84]
    },
    "hip-thrust": {
      "cues": [
        "Chin tucked and ribs down; finish with the glutes, not a lower-back arch.",
        "Shins vertical at the top, with a 1 s pause.",
        "Pad the bar or use the machine belt."
      ],
      "risk": "Lower-back hyperextension used to fake the lockout.",
      "refs": []
    },
    "hip-abduction": {
      "cues": [
        "Sit back on the seat without rocking.",
        "Push out to a comfortable width, pause 1 s, return slowly without slamming.",
        "Use a range you control; no bouncing."
      ],
      "risk": "Low; a strain from bouncing at end range.",
      "refs": []
    },
    "hip-adduction": {
      "cues": [
        "Start with a narrow setting and widen it over weeks.",
        "Squeeze smoothly and open slowly (2–3 s); never let the weight yank the legs apart.",
        "Copenhagen plank: start with the short lever (knee support)."
      ],
      "risk": "Groin (adductor) strain from a wide start or jerky first reps.",
      "refs": []
    },
    "calf-straight": {
      "cues": [
        "Lower over 2–3 s into a deep stretch and pause 1–2 s; no bounce.",
        "Knees straight but not locked.",
        "Leg-press calf raise: feet secure on the plate and safety stops engaged.",
        "Add load in small steps, because the Achilles tendon adapts slowly."
      ],
      "risk": "Achilles overload from load jumps or bouncing; a foot slipping on the leg-press plate.",
      "refs": [54, 55, 60]
    },
    "calf-bent": {
      "cues": [
        "Lower slowly, pause in the stretch, then rise fully.",
        "Pad on the lower thighs, torso still.",
        "Lock the safety lever before taking your feet off."
      ],
      "risk": "Achilles irritation from load jumps.",
      "refs": [55]
    }
  },
  "sources": [
    "[1] Keogh JWL, Winwood PW. The epidemiology of injuries across the weight-training sports. Sports Med 47(3):479–501, 2017. https://doi.org/10.1007/s40279-016-0575-0",
    "[2] Aasa U, Svartholm I, Andersson F, Berglund L. Injuries among weightlifters and powerlifters: a systematic review. Br J Sports Med 51(4):211–219, 2017. https://doi.org/10.1136/bjsports-2016-096037",
    "[3] Tung MJ, Lantz GA, Lopes AD, Berglund L. Injuries in weightlifting and powerlifting: an updated systematic review. BMJ Open Sport Exerc Med 10(4):e001884, 2024. https://doi.org/10.1136/bmjsem-2023-001884",
    "[4] Batista GS, Galvão LL, da Silva WF, et al. Epidemiology of injuries in resistance training practitioners – a prospective study. Rev Bras Cineantropom Desempenho Hum 27:e99383, 2025. https://doi.org/10.1590/1980-0037.2025v27e99383",
    "[5] Kolber MJ, Beekhuizen KS, Cheng MS, Hellman MA. Shoulder injuries attributed to resistance training: a brief review. J Strength Cond Res 24(6):1696–1704, 2010. https://doi.org/10.1519/JSC.0b013e3181dc4330",
    "[6] Kerr ZY, Collins CL, Comstock RD. Epidemiology of weight training-related injuries presenting to United States emergency departments, 1990 to 2007. Am J Sports Med 38(4):765–771, 2010. https://doi.org/10.1177/0363546509351560",
    "[7] Kemler E, Noteboom L, van Beijsterveldt AM. Characteristics of fitness-related injuries in The Netherlands: a descriptive epidemiological study. Sports 10(12):187, 2022. https://doi.org/10.3390/sports10120187",
    "[8] Requa RK, DeAvilla LN, Garrick JG. Injuries in recreational adult fitness activities. Am J Sports Med 21(3):461–467, 1993. https://doi.org/10.1177/036354659302100323",
    "[9] Currier BS, D'Souza AC, Singh MAF, et al. (Phillips SM, chair). American College of Sports Medicine Position Stand. Resistance training prescription for muscle function, hypertrophy, and physical performance in healthy adults: an overview of reviews. Med Sci Sports Exerc 58(4):851–872, 2026. https://doi.org/10.1249/MSS.0000000000003897",
    "[10] Gabbett TJ. The training–injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med 50(5):273–280, 2016. https://doi.org/10.1136/bjsports-2015-095788",
    "[11] Dolan P, Adams MA. Repetitive lifting tasks fatigue the back muscles and increase the bending moment acting on the lumbar spine. J Biomech 31(8):713–721, 1998. https://doi.org/10.1016/s0021-9290(98)00086-4",
    "[12] Duffey MJ, Challis JH. Fatigue effects on bar kinematics during the bench press. J Strength Cond Res 21(2):556–560, 2007. https://doi.org/10.1519/R-19885.1",
    "[13] Rhea MR, Landers DM, Alvar BA, Arent SM. The effects of competition and the presence of an audience on weight lifting performance. J Strength Cond Res 17(2):303–306, 2003. https://pubmed.ncbi.nlm.nih.gov/12741867/",
    "[14] Noteboom L, Kemler E, van Beijsterveldt AMC, et al. Factors associated with gym-based fitness injuries: a case-control study. JSAMS Plus 2:100032, 2023. https://doi.org/10.1016/j.jsampl.2023.100032",
    "[15] Lauersen JB, Bertelsen DM, Andersen LB. The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials. Br J Sports Med 48(11):871–877, 2014. https://doi.org/10.1136/bjsports-2013-092538",
    "[16] Lauersen JB, Andersen TE, Andersen LB. Strength training as superior, dose-dependent and safe prevention of acute and overuse sports injuries: a systematic review, qualitative analysis and meta-analysis. Br J Sports Med 52(24):1557–1563, 2018. https://doi.org/10.1136/bjsports-2018-099078",
    "[17] Jeffreys I. The Warm-Up: Maximize Performance and Improve Long-Term Athletic Development. Human Kinetics, 2019 (the RAMP system, first published as 'Warm-up revisited: the ramp method of optimising warm-ups', Professional Strength & Conditioning, 2007). https://doi.org/10.5040/9781718214170",
    "[18] Racinais S, Cocking S, Périard JD. Sports and environmental temperature: from warming-up to heating-up. Temperature 4(3):227–257, 2017. https://doi.org/10.1080/23328940.2017.1356427",
    "[19] Barroso R, Silva-Batista C, Tricoli V, Roschel H, Ugrinowitsch C. The effects of different intensities and durations of the general warm-up on leg press 1RM. J Strength Cond Res 27(4):1009–1013, 2013. https://doi.org/10.1519/JSC.0b013e3182606cd9",
    "[20] Abad CC, Prado ML, Ugrinowitsch C, Tricoli V, Barroso R. Combination of general and specific warm-ups improves leg-press one repetition maximum compared with specific warm-up in trained individuals. J Strength Cond Res 25(8):2242–2245, 2011. https://doi.org/10.1519/JSC.0b013e3181e8611b",
    "[21] Fradkin AJ, Zazryn TR, Smoliga JM. Effects of warming-up on physical performance: a systematic review with meta-analysis. J Strength Cond Res 24(1):140–148, 2010. https://doi.org/10.1519/JSC.0b013e3181c643a0",
    "[22] McCrary JM, Ackermann BJ, Halaki M. A systematic review of the effects of upper body warm-up on performance and injury. Br J Sports Med 49(14):935–942, 2015. https://doi.org/10.1136/bjsports-2014-094228",
    "[23] Ribeiro B, Pereira A, Neves PP, et al. The role of specific warm-up during bench press and squat exercises: a novel approach. Int J Environ Res Public Health 17(18):6882, 2020. https://doi.org/10.3390/ijerph17186882",
    "[24] Ribeiro AS, Romanzini M, Schoenfeld BJ, et al. Effect of different warm-up procedures on the performance of resistance training exercises. Percept Mot Skills 119(1):133–145, 2014. https://doi.org/10.2466/25.29.PMS.119c17z7",
    "[25] Behm DG, Blazevich AJ, Kay AD, McHugh M. Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review. Appl Physiol Nutr Metab 41(1):1–11, 2016. https://doi.org/10.1139/apnm-2015-0235",
    "[26] Fradkin AJ, Gabbe BJ, Cameron PA. Does warming up prevent injury in sport? The evidence from randomised controlled trials? J Sci Med Sport 9(3):214–220, 2006. https://doi.org/10.1016/j.jsams.2006.03.026",
    "[27] Boullosa D, Gil-Calvo M, Xenofondos A, et al. International expert consensus on warm-up protocols for athletes: a Delphi study. Int J Sports Physiol Perform 21(9):982–995, 2026. https://doi.org/10.1123/ijspp.2025-0647",
    "[28] Durall CJ, Manske RC, Davies GJ. Avoiding shoulder injury from resistance training. Strength Cond J 23(5):10–18, 2001. https://doi.org/10.1519/00126548-200110000-00002",
    "[29] Gross ML, Brenner SL, Esformes I, Sonzogni JJ. Anterior shoulder instability in weight lifters. Am J Sports Med 21(4):599–603, 1993. https://doi.org/10.1177/036354659302100419",
    "[30] Bak K, Cameron EA, Henderson IJ. Rupture of the pectoralis major: a meta-analysis of 112 cases. Knee Surg Sports Traumatol Arthrosc 8(2):113–119, 2000. https://doi.org/10.1007/s001670050197",
    "[31] Sperandei S, Barros MA, Silveira-Júnior PC, Oliveira CG. Electromyographic analysis of three different types of lat pull-down. J Strength Cond Res 23(7):2033–2038, 2009. https://doi.org/10.1519/JSC.0b013e3181b8d30a",
    "[32] Signorile JF, Zink AJ, Szwed SP. A comparative electromyographical investigation of muscle utilization patterns using various hand positions during the lat pull-down. J Strength Cond Res 16(4):539–546, 2002. https://pubmed.ncbi.nlm.nih.gov/12423182/",
    "[33] Noteboom L, Belli I, Hoozemans MJM, Seth A, Veeger HEJ, Van Der Helm FCT. Effects of bench press technique variations on musculoskeletal shoulder loads and potential injury risk. Front Physiol 15:1393235, 2024. https://doi.org/10.3389/fphys.2024.1393235",
    "[34] Green CM, Comfort P. The affect of grip width on bench press performance and risk of injury. Strength Cond J 29(5):10–14, 2007. https://doi.org/10.1519/00126548-200710000-00001",
    "[35] Kolber MJ, Cheatham SW, Salamh PA, Hanney WJ. Characteristics of shoulder impingement in the recreational weight-training population. J Strength Cond Res 28(4):1081–1089, 2014. https://doi.org/10.1519/JSC.0000000000000250",
    "[36] Kolber MJ, Beekhuizen KS, Cheng MS, Hellman MA. Shoulder joint and muscle characteristics in the recreational weight training population. J Strength Cond Res 23(1):148–157, 2009. https://doi.org/10.1519/JSC.0b013e31818eafb4",
    "[37] Kolber MJ, Hanney WJ, Cheatham SW, et al. Shoulder joint and muscle characteristics among weight-training participants with and without impingement syndrome. J Strength Cond Res 31(4):1024–1032, 2017. https://doi.org/10.1519/JSC.0000000000001554",
    "[38] Andersson SH, Bahr R, Clarsen B, Myklebust G. Preventing overuse shoulder injuries among throwing athletes: a cluster-randomised controlled trial in 660 elite handball players. Br J Sports Med 51(14):1073–1080, 2017. https://doi.org/10.1136/bjsports-2016-096226",
    "[39] Grenier SG, McGill SM. Quantification of lumbar stability by using 2 different abdominal activation strategies. Arch Phys Med Rehabil 88(1):54–62, 2007. https://doi.org/10.1016/j.apmr.2006.10.014",
    "[40] Saraceni N, Kent P, Ng L, Campbell A, Straker L, O'Sullivan P. To flex or not to flex? Is there a relationship between lumbar spine flexion during lifting and low back pain? A systematic review with meta-analysis. J Orthop Sports Phys Ther 50(3):121–130, 2020. https://doi.org/10.2519/jospt.2020.9218",
    "[41] Fenwick CM, Brown SH, McGill SM. Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness. J Strength Cond Res 23(5):1408–1417, 2009. https://doi.org/10.1519/JSC.0b013e3181b07334",
    "[42] Hackett DA, Chow CM. The Valsalva maneuver: its effect on intra-abdominal pressure and safety issues during resistance exercise. J Strength Cond Res 27(8):2338–2345, 2013. https://doi.org/10.1519/JSC.0b013e31827de07d",
    "[43] MacDougall JD, Tuxen D, Sale DG, Moroz JR, Sutton JR. Arterial blood pressure response to heavy resistance exercise. J Appl Physiol 58(3):785–790, 1985. https://doi.org/10.1152/jappl.1985.58.3.785",
    "[44] Steele J, Bruce-Low S, Smith D. A review of the specificity of exercises designed for conditioning the lumbar extensors. Br J Sports Med 49(5):291–297, 2015. https://doi.org/10.1136/bjsports-2013-092197",
    "[45] Steele J, Bruce-Low S, Smith D. A review of the clinical value of isolated lumbar extension resistance training for chronic low back pain. PM R 7(2):169–187, 2015. https://doi.org/10.1016/j.pmrj.2014.10.009",
    "[46] Cook JL, Purdam CR. Is tendon pathology a continuum? A pathology model to explain the clinical presentation of load-induced tendinopathy. Br J Sports Med 43(6):409–416, 2009. https://doi.org/10.1136/bjsm.2008.051193",
    "[47] Beyer R, Kongsgaard M, Hougs Kjær B, et al. Heavy slow resistance versus eccentric training as treatment for Achilles tendinopathy: a randomized controlled trial. Am J Sports Med 43(7):1704–1711, 2015. https://doi.org/10.1177/0363546515584760",
    "[48] Tyler TF, Thomas GC, Nicholas SJ, McHugh MP. Addition of isolated wrist extensor eccentric exercise to standard treatment for chronic lateral epicondylosis: a prospective randomized trial. J Shoulder Elbow Surg 19(6):917–922, 2010. https://doi.org/10.1016/j.jse.2010.04.041",
    "[49] Coombes BK, Bisset L, Vicenzino B. Management of lateral elbow tendinopathy: one size does not fit all. J Orthop Sports Phys Ther 45(11):938–949, 2015. https://doi.org/10.2519/jospt.2015.5841",
    "[50] Rio E, Kidgell D, Purdam C, et al. Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy. Br J Sports Med 49(19):1277–1283, 2015. https://doi.org/10.1136/bjsports-2014-094386",
    "[51] Clifford C, Challoumas D, Paul L, Syme G, Millar NL. Effectiveness of isometric exercise in the management of tendinopathy: a systematic review and meta-analysis of randomised trials. BMJ Open Sport Exerc Med 6(1):e000760, 2020. https://doi.org/10.1136/bmjsem-2020-000760",
    "[52] Callaghan JP, McGill SM. Intervertebral disc herniation: studies on a porcine model exposed to highly repetitive flexion/extension motion with compressive force. Clin Biomech 16(1):28–37, 2001. https://doi.org/10.1016/s0268-0033(00)00063-2",
    "[53] Contreras B, Schoenfeld B. To crunch or not to crunch: an evidence-based examination of spinal flexion exercises, their potential risks, and their applicability to program design. Strength Cond J 33(4):8–18, 2011. https://doi.org/10.1519/SSC.0b013e3182259d05",
    "[54] Kubo K, Ikebukuro T, Yata H, Tsunoda N, Kanehisa H. Time course of changes in muscle and tendon properties during strength training and detraining. J Strength Cond Res 24(2):322–331, 2010. https://doi.org/10.1519/JSC.0b013e3181c865e2",
    "[55] Bohm S, Mersmann F, Arampatzis A. Human tendon adaptation in response to mechanical loading: a systematic review and meta-analysis of exercise intervention studies on healthy adults. Sports Med Open 1(1):7, 2015. https://doi.org/10.1186/s40798-015-0009-9",
    "[56] Magnusson SP, Langberg H, Kjaer M. The pathogenesis of tendinopathy: balancing the response to loading. Nat Rev Rheumatol 6(5):262–268, 2010. https://doi.org/10.1038/nrrheum.2010.43",
    "[57] Miller BF, Olesen JL, Hansen M, et al. Coordinated collagen and muscle protein synthesis in human patella tendon and quadriceps muscle after exercise. J Physiol 567(3):1021–1033, 2005. https://doi.org/10.1113/jphysiol.2005.093690",
    "[58] Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. Br J Sports Med 53(15):921–922, 2019. https://doi.org/10.1136/bjsports-2017-098110",
    "[59] Impellizzeri FM, Woodcock S, Coutts AJ, et al. What role do chronic workloads play in the acute to chronic workload ratio? Time to dismiss ACWR and its underlying theory. Sports Med 51(3):581–592, 2021. https://doi.org/10.1007/s40279-020-01378-6",
    "[60] Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy: a randomized controlled study. Am J Sports Med 35(6):897–906, 2007. https://doi.org/10.1177/0363546506298279",
    "[61] Silbernagel KG, Crossley KM. A proposed return-to-sport program for patients with midportion Achilles tendinopathy: rationale and implementation. J Orthop Sports Phys Ther 45(11):876–886, 2015. https://doi.org/10.2519/jospt.2015.5885",
    "[62] Smith BE, Hendrick P, Smith TO, et al. Should exercises be painful in the management of chronic musculoskeletal pain? A systematic review and meta-analysis. Br J Sports Med 51(23):1679–1687, 2017. https://doi.org/10.1136/bjsports-2016-097383",
    "[63] Tran I, Gibbs MT, Yu N, Powell JK, Smith BE, Jones MD. Effectiveness of painful versus nonpainful exercise on pain intensity, disability, and other patient-reported outcomes in adults with chronic musculoskeletal pain: an updated systematic review with meta-analysis. J Orthop Sports Phys Ther 55(8):1–11, 2025. https://doi.org/10.2519/jospt.2025.13253",
    "[64] Cheung K, Hume P, Maxwell L. Delayed onset muscle soreness: treatment strategies and performance factors. Sports Med 33(2):145–164, 2003. https://doi.org/10.2165/00007256-200333020-00005",
    "[65] Hotfiel T, Freiwald J, Hoppe MW, et al. Advances in delayed-onset muscle soreness (DOMS): Part I: pathogenesis and diagnostics. Sportverletz Sportschaden 32(4):243–250, 2018. https://doi.org/10.1055/a-0753-1884",
    "[66] McHugh MP. Recent advances in the understanding of the repeated bout effect: the protective effect against muscle damage from a single bout of eccentric exercise. Scand J Med Sci Sports 13(2):88–97, 2003. https://doi.org/10.1034/j.1600-0838.2003.02477.x",
    "[67] Riebe D, Franklin BA, Thompson PD, et al. Updating ACSM's recommendations for exercise preparticipation health screening. Med Sci Sports Exerc 47(11):2473–2479, 2015. https://doi.org/10.1249/MSS.0000000000000664",
    "[68] Do TP, Remmers A, Schytz HW, et al. Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list. Neurology 92(3):134–144, 2019. https://doi.org/10.1212/WNL.0000000000006697",
    "[69] Finucane LM, Downie A, Mercer C, et al. International framework for red flags for potential serious spinal pathologies. J Orthop Sports Phys Ther 50(7):350–372, 2020. https://doi.org/10.2519/jospt.2020.9971",
    "[70] Kim J, Lee J, Kim S, et al. Exercise-induced rhabdomyolysis mechanisms and prevention: a literature review. J Sport Health Sci 5(3):324–333, 2016. https://doi.org/10.1016/j.jshs.2015.01.012",
    "[71] Watson NF, Badr MS, Belenky G, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. Sleep 38(6):843–844, 2015. https://doi.org/10.5665/sleep.4716",
    "[72] Lamon S, Morabito A, Arentson-Lantz E, et al. The effect of acute sleep deprivation on skeletal muscle protein synthesis and the hormonal environment. Physiol Rep 9(1):e14660, 2021. https://doi.org/10.14814/phy2.14660",
    "[73] Craven J, McCartney D, Desbrow B, et al. Effects of acute sleep loss on physical performance: a systematic and meta-analytical review. Sports Med 52(11):2669–2690, 2022. https://doi.org/10.1007/s40279-022-01706-y",
    "[74] Knowles OE, Drinkwater EJ, Urwin CS, Lamon S, Aisbett B. Inadequate sleep and muscle strength: implications for resistance training. J Sci Med Sport 21(9):959–968, 2018. https://doi.org/10.1016/j.jsams.2018.01.012",
    "[75] Gao B, Dwivedi S, Milewski MD, Cruz AI Jr. Lack of sleep and sports injuries in adolescents: a systematic review and meta-analysis. J Pediatr Orthop 39(5):e324–e333, 2019. https://doi.org/10.1097/BPO.0000000000001306",
    "[76] Bell L, Strafford BW, Coleman M, et al. Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. Sports Med Open 9:87, 2023. https://doi.org/10.1186/s40798-023-00633-0",
    "[77] Rogerson D, Nolan D, Androulakis Korakakis P, Immonen V, Wolf M, Bell L. Deloading practices in strength and physique sports: a cross-sectional survey. Sports Med Open 10(1):26, 2024. https://doi.org/10.1186/s40798-024-00691-y",
    "[78] Coleman M, Burke R, Augustin F, et al. Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. PeerJ 12:e16777, 2024. https://doi.org/10.7717/peerj.16777",
    "[79] Human Performance Resources by CHAMP (HPRC). What is a one-rep max? (NSCA 1RM testing protocol: warm-up, rest and increments). HPRC, 2022. https://www.hprc-online.org/articles/one-rep-max-for-strength",
    "[80] Ylinen J, Takala EP, Nykänen M, et al. Active neck muscle training in the treatment of chronic neck pain in women: a randomized controlled trial. JAMA 289(19):2509–2516, 2003. https://doi.org/10.1001/jama.289.19.2509",
    "[81] Siewe J, Rudat J, Röllinghoff M, et al. Injuries and overuse syndromes in powerlifting. Int J Sports Med 32(9):703–711, 2011. https://doi.org/10.1055/s-0031-1277207",
    "[82] Siewe J, Marx G, Knöll P, et al. Injuries and overuse syndromes in competitive and elite bodybuilding. Int J Sports Med 35(11):943–948, 2014. https://doi.org/10.1055/s-0034-1367049",
    "[83] Gray SE, Finch CF. The causes of injuries sustained at fitness facilities presenting to Victorian emergency departments – identifying the main culprits. Inj Epidemiol 2:6, 2015. https://doi.org/10.1186/s40621-015-0037-4",
    "[84] Hooper DR, Szivak TK, Comstock BA, et al. Effects of fatigue from resistance training on barbell back squat biomechanics. J Strength Cond Res 28(4):1127–1134, 2014. https://doi.org/10.1097/JSC.0000000000000237",
    "[85] McGill SM, Karpowicz A. Exercises for spine stabilization: motion/motor patterns, stability progressions, and clinical technique. Arch Phys Med Rehabil 90(1):118–126, 2009. https://doi.org/10.1016/j.apmr.2008.06.026",
    "[86] McKean MR, Burkett BJ. Overhead shoulder press – in-front of the head or behind the head? J Sport Health Sci 4(3):250–257, 2015. https://doi.org/10.1016/j.jshs.2013.11.007",
    "[87] Coratella G, Tornatore G, Longo S, Esposito F, Cè E. Front vs back and barbell vs machine overhead press: an electromyographic analysis and implications for resistance training. Front Physiol 13:825880, 2022. https://doi.org/10.3389/fphys.2022.825880",
    "[88] Thigpen CA, Padua DA, Morgan N, Kreps C, Karas SG. Scapular kinematics during supraspinatus rehabilitation exercise: a comparison of full-can versus empty-can techniques. Am J Sports Med 34(4):644–652, 2006. https://doi.org/10.1177/0363546505281797",
    "[89] Hickey D, Solvig V, Cavalheri V, Harrold M, Mckenna L. Scapular dyskinesis increases the risk of future shoulder pain by 43% in asymptomatic athletes: a systematic review and meta-analysis. Br J Sports Med 52(2):102–110, 2018. https://doi.org/10.1136/bjsports-2017-097559",
    "[90] Kibler WB, Ludewig PM, McClure PW, et al. Clinical implications of scapular dyskinesis in shoulder injury: the 2013 consensus statement from the 'Scapular Summit'. Br J Sports Med 47(14):877–885, 2013. https://doi.org/10.1136/bjsports-2013-092425",
    "[91] Blazek D, Stastny P, Maszczyk A, et al. Systematic review of intra-abdominal and intrathoracic pressures initiated by the Valsalva manoeuvre during high-intensity resistance exercises. Biol Sport 36(4):373–386, 2019. https://doi.org/10.5114/biolsport.2019.88759",
    "[92] Snook SH, Webster BS, McGorry RW, Fogleman MT, McCann KB. The reduction of chronic nonspecific low back pain through the control of early morning lumbar flexion: a randomized controlled trial. Spine 23(23):2601–2607, 1998. https://doi.org/10.1097/00007632-199812010-00015",
    "[93] Mersmann F, Bohm S, Arampatzis A. Imbalances in the development of muscle and tendon as risk factor for tendinopathies in youth athletes: a review of current evidence and concepts of prevention. Front Physiol 8:987, 2017. https://doi.org/10.3389/fphys.2017.00987",
    "[94] Heinemeier KM, Schjerling P, Heinemeier J, Magnusson SP, Kjaer M. Lack of tissue renewal in human adult Achilles tendon is revealed by nuclear bomb 14C. FASEB J 27(5):2074–2079, 2013. https://doi.org/10.1096/fj.12-225599",
    "[95] Magnusson SP, Kjaer M. The impact of loading, unloading, ageing and injury on the human tendon. J Physiol 597(5):1283–1298, 2019. https://doi.org/10.1113/JP275450",
    "[96] Andrade R, Wik EH, Rebelo-Marques A, et al. Is the acute:chronic workload ratio (ACWR) associated with risk of time-loss injury in professional team sports? A systematic review of methodology, variables and injury risk in practical situations. Sports Med 50(9):1613–1635, 2020. https://doi.org/10.1007/s40279-020-01308-6",
    "[97] Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform 15(6):907–913, 2020. https://doi.org/10.1123/ijspp.2019-0864",
    "[98] Thomeé R. A comprehensive treatment approach for patellofemoral pain syndrome in young women. Phys Ther 77(12):1690–1703, 1997. https://doi.org/10.1093/ptj/77.12.1690",
    "[99] Haupt HA. Upper extremity injuries associated with strength training. Clin Sports Med 20(3):481–490, 2001. https://doi.org/10.1016/s0278-5919(05)70264-7",
    "[100] Axler CT, McGill SM. Low back loads over a variety of abdominal exercises: searching for the safest abdominal challenge. Med Sci Sports Exerc 29(6):804–811, 1997. https://doi.org/10.1097/00005768-199706000-00011"
  ]
}
```

---

## Sources

1. Keogh JWL, Winwood PW. The epidemiology of injuries across the weight-training sports. *Sports Med* 47(3):479–501, 2017. https://doi.org/10.1007/s40279-016-0575-0
2. Aasa U, Svartholm I, Andersson F, Berglund L. Injuries among weightlifters and powerlifters: a systematic review. *Br J Sports Med* 51(4):211–219, 2017. https://doi.org/10.1136/bjsports-2016-096037
3. Tung MJ, Lantz GA, Lopes AD, Berglund L. Injuries in weightlifting and powerlifting: an updated systematic review. *BMJ Open Sport Exerc Med* 10(4):e001884, 2024. https://doi.org/10.1136/bmjsem-2023-001884
4. Batista GS, Galvão LL, da Silva WF, et al. Epidemiology of injuries in resistance training practitioners – a prospective study. *Rev Bras Cineantropom Desempenho Hum* 27:e99383, 2025. https://doi.org/10.1590/1980-0037.2025v27e99383
5. Kolber MJ, Beekhuizen KS, Cheng MS, Hellman MA. Shoulder injuries attributed to resistance training: a brief review. *J Strength Cond Res* 24(6):1696–1704, 2010. https://doi.org/10.1519/JSC.0b013e3181dc4330
6. Kerr ZY, Collins CL, Comstock RD. Epidemiology of weight training-related injuries presenting to United States emergency departments, 1990 to 2007. *Am J Sports Med* 38(4):765–771, 2010. https://doi.org/10.1177/0363546509351560
7. Kemler E, Noteboom L, van Beijsterveldt AM. Characteristics of fitness-related injuries in The Netherlands: a descriptive epidemiological study. *Sports* 10(12):187, 2022. https://doi.org/10.3390/sports10120187
8. Requa RK, DeAvilla LN, Garrick JG. Injuries in recreational adult fitness activities. *Am J Sports Med* 21(3):461–467, 1993. https://doi.org/10.1177/036354659302100323
9. Currier BS, D'Souza AC, Singh MAF, et al. (Phillips SM, chair). American College of Sports Medicine Position Stand. Resistance training prescription for muscle function, hypertrophy, and physical performance in healthy adults: an overview of reviews. *Med Sci Sports Exerc* 58(4):851–872, 2026. https://doi.org/10.1249/MSS.0000000000003897
10. Gabbett TJ. The training–injury prevention paradox: should athletes be training smarter and harder? *Br J Sports Med* 50(5):273–280, 2016. https://doi.org/10.1136/bjsports-2015-095788
11. Dolan P, Adams MA. Repetitive lifting tasks fatigue the back muscles and increase the bending moment acting on the lumbar spine. *J Biomech* 31(8):713–721, 1998. https://doi.org/10.1016/s0021-9290(98)00086-4
12. Duffey MJ, Challis JH. Fatigue effects on bar kinematics during the bench press. *J Strength Cond Res* 21(2):556–560, 2007. https://doi.org/10.1519/R-19885.1
13. Rhea MR, Landers DM, Alvar BA, Arent SM. The effects of competition and the presence of an audience on weight lifting performance. *J Strength Cond Res* 17(2):303–306, 2003. https://pubmed.ncbi.nlm.nih.gov/12741867/
14. Noteboom L, Kemler E, van Beijsterveldt AMC, et al. Factors associated with gym-based fitness injuries: a case-control study. *JSAMS Plus* 2:100032, 2023. https://doi.org/10.1016/j.jsampl.2023.100032
15. Lauersen JB, Bertelsen DM, Andersen LB. The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials. *Br J Sports Med* 48(11):871–877, 2014. https://doi.org/10.1136/bjsports-2013-092538
16. Lauersen JB, Andersen TE, Andersen LB. Strength training as superior, dose-dependent and safe prevention of acute and overuse sports injuries: a systematic review, qualitative analysis and meta-analysis. *Br J Sports Med* 52(24):1557–1563, 2018. https://doi.org/10.1136/bjsports-2018-099078
17. Jeffreys I. *The Warm-Up: Maximize Performance and Improve Long-Term Athletic Development.* Human Kinetics, 2019 (the RAMP system, first published as 'Warm-up revisited: the ramp method of optimising warm-ups', Professional Strength & Conditioning, 2007). https://doi.org/10.5040/9781718214170
18. Racinais S, Cocking S, Périard JD. Sports and environmental temperature: from warming-up to heating-up. *Temperature* 4(3):227–257, 2017. https://doi.org/10.1080/23328940.2017.1356427
19. Barroso R, Silva-Batista C, Tricoli V, Roschel H, Ugrinowitsch C. The effects of different intensities and durations of the general warm-up on leg press 1RM. *J Strength Cond Res* 27(4):1009–1013, 2013. https://doi.org/10.1519/JSC.0b013e3182606cd9
20. Abad CC, Prado ML, Ugrinowitsch C, Tricoli V, Barroso R. Combination of general and specific warm-ups improves leg-press one repetition maximum compared with specific warm-up in trained individuals. *J Strength Cond Res* 25(8):2242–2245, 2011. https://doi.org/10.1519/JSC.0b013e3181e8611b
21. Fradkin AJ, Zazryn TR, Smoliga JM. Effects of warming-up on physical performance: a systematic review with meta-analysis. *J Strength Cond Res* 24(1):140–148, 2010. https://doi.org/10.1519/JSC.0b013e3181c643a0
22. McCrary JM, Ackermann BJ, Halaki M. A systematic review of the effects of upper body warm-up on performance and injury. *Br J Sports Med* 49(14):935–942, 2015. https://doi.org/10.1136/bjsports-2014-094228
23. Ribeiro B, Pereira A, Neves PP, et al. The role of specific warm-up during bench press and squat exercises: a novel approach. *Int J Environ Res Public Health* 17(18):6882, 2020. https://doi.org/10.3390/ijerph17186882
24. Ribeiro AS, Romanzini M, Schoenfeld BJ, et al. Effect of different warm-up procedures on the performance of resistance training exercises. *Percept Mot Skills* 119(1):133–145, 2014. https://doi.org/10.2466/25.29.PMS.119c17z7
25. Behm DG, Blazevich AJ, Kay AD, McHugh M. Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review. *Appl Physiol Nutr Metab* 41(1):1–11, 2016. https://doi.org/10.1139/apnm-2015-0235
26. Fradkin AJ, Gabbe BJ, Cameron PA. Does warming up prevent injury in sport? The evidence from randomised controlled trials? *J Sci Med Sport* 9(3):214–220, 2006. https://doi.org/10.1016/j.jsams.2006.03.026
27. Boullosa D, Gil-Calvo M, Xenofondos A, et al. International expert consensus on warm-up protocols for athletes: a Delphi study. *Int J Sports Physiol Perform* 21(9):982–995, 2026. https://doi.org/10.1123/ijspp.2025-0647
28. Durall CJ, Manske RC, Davies GJ. Avoiding shoulder injury from resistance training. *Strength Cond J* 23(5):10–18, 2001. https://doi.org/10.1519/00126548-200110000-00002
29. Gross ML, Brenner SL, Esformes I, Sonzogni JJ. Anterior shoulder instability in weight lifters. *Am J Sports Med* 21(4):599–603, 1993. https://doi.org/10.1177/036354659302100419
30. Bak K, Cameron EA, Henderson IJ. Rupture of the pectoralis major: a meta-analysis of 112 cases. *Knee Surg Sports Traumatol Arthrosc* 8(2):113–119, 2000. https://doi.org/10.1007/s001670050197
31. Sperandei S, Barros MA, Silveira-Júnior PC, Oliveira CG. Electromyographic analysis of three different types of lat pull-down. *J Strength Cond Res* 23(7):2033–2038, 2009. https://doi.org/10.1519/JSC.0b013e3181b8d30a
32. Signorile JF, Zink AJ, Szwed SP. A comparative electromyographical investigation of muscle utilization patterns using various hand positions during the lat pull-down. *J Strength Cond Res* 16(4):539–546, 2002. https://pubmed.ncbi.nlm.nih.gov/12423182/
33. Noteboom L, Belli I, Hoozemans MJM, Seth A, Veeger HEJ, Van Der Helm FCT. Effects of bench press technique variations on musculoskeletal shoulder loads and potential injury risk. *Front Physiol* 15:1393235, 2024. https://doi.org/10.3389/fphys.2024.1393235
34. Green CM, Comfort P. The affect of grip width on bench press performance and risk of injury. *Strength Cond J* 29(5):10–14, 2007. https://doi.org/10.1519/00126548-200710000-00001
35. Kolber MJ, Cheatham SW, Salamh PA, Hanney WJ. Characteristics of shoulder impingement in the recreational weight-training population. *J Strength Cond Res* 28(4):1081–1089, 2014. https://doi.org/10.1519/JSC.0000000000000250
36. Kolber MJ, Beekhuizen KS, Cheng MS, Hellman MA. Shoulder joint and muscle characteristics in the recreational weight training population. *J Strength Cond Res* 23(1):148–157, 2009. https://doi.org/10.1519/JSC.0b013e31818eafb4
37. Kolber MJ, Hanney WJ, Cheatham SW, et al. Shoulder joint and muscle characteristics among weight-training participants with and without impingement syndrome. *J Strength Cond Res* 31(4):1024–1032, 2017. https://doi.org/10.1519/JSC.0000000000001554
38. Andersson SH, Bahr R, Clarsen B, Myklebust G. Preventing overuse shoulder injuries among throwing athletes: a cluster-randomised controlled trial in 660 elite handball players. *Br J Sports Med* 51(14):1073–1080, 2017. https://doi.org/10.1136/bjsports-2016-096226
39. Grenier SG, McGill SM. Quantification of lumbar stability by using 2 different abdominal activation strategies. *Arch Phys Med Rehabil* 88(1):54–62, 2007. https://doi.org/10.1016/j.apmr.2006.10.014
40. Saraceni N, Kent P, Ng L, Campbell A, Straker L, O'Sullivan P. To flex or not to flex? Is there a relationship between lumbar spine flexion during lifting and low back pain? A systematic review with meta-analysis. *J Orthop Sports Phys Ther* 50(3):121–130, 2020. https://doi.org/10.2519/jospt.2020.9218
41. Fenwick CM, Brown SH, McGill SM. Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness. *J Strength Cond Res* 23(5):1408–1417, 2009. https://doi.org/10.1519/JSC.0b013e3181b07334
42. Hackett DA, Chow CM. The Valsalva maneuver: its effect on intra-abdominal pressure and safety issues during resistance exercise. *J Strength Cond Res* 27(8):2338–2345, 2013. https://doi.org/10.1519/JSC.0b013e31827de07d
43. MacDougall JD, Tuxen D, Sale DG, Moroz JR, Sutton JR. Arterial blood pressure response to heavy resistance exercise. *J Appl Physiol* 58(3):785–790, 1985. https://doi.org/10.1152/jappl.1985.58.3.785
44. Steele J, Bruce-Low S, Smith D. A review of the specificity of exercises designed for conditioning the lumbar extensors. *Br J Sports Med* 49(5):291–297, 2015. https://doi.org/10.1136/bjsports-2013-092197
45. Steele J, Bruce-Low S, Smith D. A review of the clinical value of isolated lumbar extension resistance training for chronic low back pain. *PM R* 7(2):169–187, 2015. https://doi.org/10.1016/j.pmrj.2014.10.009
46. Cook JL, Purdam CR. Is tendon pathology a continuum? A pathology model to explain the clinical presentation of load-induced tendinopathy. *Br J Sports Med* 43(6):409–416, 2009. https://doi.org/10.1136/bjsm.2008.051193
47. Beyer R, Kongsgaard M, Hougs Kjær B, et al. Heavy slow resistance versus eccentric training as treatment for Achilles tendinopathy: a randomized controlled trial. *Am J Sports Med* 43(7):1704–1711, 2015. https://doi.org/10.1177/0363546515584760
48. Tyler TF, Thomas GC, Nicholas SJ, McHugh MP. Addition of isolated wrist extensor eccentric exercise to standard treatment for chronic lateral epicondylosis: a prospective randomized trial. *J Shoulder Elbow Surg* 19(6):917–922, 2010. https://doi.org/10.1016/j.jse.2010.04.041
49. Coombes BK, Bisset L, Vicenzino B. Management of lateral elbow tendinopathy: one size does not fit all. *J Orthop Sports Phys Ther* 45(11):938–949, 2015. https://doi.org/10.2519/jospt.2015.5841
50. Rio E, Kidgell D, Purdam C, et al. Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy. *Br J Sports Med* 49(19):1277–1283, 2015. https://doi.org/10.1136/bjsports-2014-094386
51. Clifford C, Challoumas D, Paul L, Syme G, Millar NL. Effectiveness of isometric exercise in the management of tendinopathy: a systematic review and meta-analysis of randomised trials. *BMJ Open Sport Exerc Med* 6(1):e000760, 2020. https://doi.org/10.1136/bmjsem-2020-000760
52. Callaghan JP, McGill SM. Intervertebral disc herniation: studies on a porcine model exposed to highly repetitive flexion/extension motion with compressive force. *Clin Biomech* 16(1):28–37, 2001. https://doi.org/10.1016/s0268-0033(00)00063-2
53. Contreras B, Schoenfeld B. To crunch or not to crunch: an evidence-based examination of spinal flexion exercises, their potential risks, and their applicability to program design. *Strength Cond J* 33(4):8–18, 2011. https://doi.org/10.1519/SSC.0b013e3182259d05
54. Kubo K, Ikebukuro T, Yata H, Tsunoda N, Kanehisa H. Time course of changes in muscle and tendon properties during strength training and detraining. *J Strength Cond Res* 24(2):322–331, 2010. https://doi.org/10.1519/JSC.0b013e3181c865e2
55. Bohm S, Mersmann F, Arampatzis A. Human tendon adaptation in response to mechanical loading: a systematic review and meta-analysis of exercise intervention studies on healthy adults. *Sports Med Open* 1(1):7, 2015. https://doi.org/10.1186/s40798-015-0009-9
56. Magnusson SP, Langberg H, Kjaer M. The pathogenesis of tendinopathy: balancing the response to loading. *Nat Rev Rheumatol* 6(5):262–268, 2010. https://doi.org/10.1038/nrrheum.2010.43
57. Miller BF, Olesen JL, Hansen M, et al. Coordinated collagen and muscle protein synthesis in human patella tendon and quadriceps muscle after exercise. *J Physiol* 567(3):1021–1033, 2005. https://doi.org/10.1113/jphysiol.2005.093690
58. Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. *Br J Sports Med* 53(15):921–922, 2019. https://doi.org/10.1136/bjsports-2017-098110
59. Impellizzeri FM, Woodcock S, Coutts AJ, et al. What role do chronic workloads play in the acute to chronic workload ratio? Time to dismiss ACWR and its underlying theory. *Sports Med* 51(3):581–592, 2021. https://doi.org/10.1007/s40279-020-01378-6
60. Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy: a randomized controlled study. *Am J Sports Med* 35(6):897–906, 2007. https://doi.org/10.1177/0363546506298279
61. Silbernagel KG, Crossley KM. A proposed return-to-sport program for patients with midportion Achilles tendinopathy: rationale and implementation. *J Orthop Sports Phys Ther* 45(11):876–886, 2015. https://doi.org/10.2519/jospt.2015.5885
62. Smith BE, Hendrick P, Smith TO, et al. Should exercises be painful in the management of chronic musculoskeletal pain? A systematic review and meta-analysis. *Br J Sports Med* 51(23):1679–1687, 2017. https://doi.org/10.1136/bjsports-2016-097383
63. Tran I, Gibbs MT, Yu N, Powell JK, Smith BE, Jones MD. Effectiveness of painful versus nonpainful exercise on pain intensity, disability, and other patient-reported outcomes in adults with chronic musculoskeletal pain: an updated systematic review with meta-analysis. *J Orthop Sports Phys Ther* 55(8):1–11, 2025. https://doi.org/10.2519/jospt.2025.13253
64. Cheung K, Hume P, Maxwell L. Delayed onset muscle soreness: treatment strategies and performance factors. *Sports Med* 33(2):145–164, 2003. https://doi.org/10.2165/00007256-200333020-00005
65. Hotfiel T, Freiwald J, Hoppe MW, et al. Advances in delayed-onset muscle soreness (DOMS): Part I: pathogenesis and diagnostics. *Sportverletz Sportschaden* 32(4):243–250, 2018. https://doi.org/10.1055/a-0753-1884
66. McHugh MP. Recent advances in the understanding of the repeated bout effect: the protective effect against muscle damage from a single bout of eccentric exercise. *Scand J Med Sci Sports* 13(2):88–97, 2003. https://doi.org/10.1034/j.1600-0838.2003.02477.x
67. Riebe D, Franklin BA, Thompson PD, et al. Updating ACSM's recommendations for exercise preparticipation health screening. *Med Sci Sports Exerc* 47(11):2473–2479, 2015. https://doi.org/10.1249/MSS.0000000000000664
68. Do TP, Remmers A, Schytz HW, et al. Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list. *Neurology* 92(3):134–144, 2019. https://doi.org/10.1212/WNL.0000000000006697
69. Finucane LM, Downie A, Mercer C, et al. International framework for red flags for potential serious spinal pathologies. *J Orthop Sports Phys Ther* 50(7):350–372, 2020. https://doi.org/10.2519/jospt.2020.9971
70. Kim J, Lee J, Kim S, et al. Exercise-induced rhabdomyolysis mechanisms and prevention: a literature review. *J Sport Health Sci* 5(3):324–333, 2016. https://doi.org/10.1016/j.jshs.2015.01.012
71. Watson NF, Badr MS, Belenky G, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. *Sleep* 38(6):843–844, 2015. https://doi.org/10.5665/sleep.4716
72. Lamon S, Morabito A, Arentson-Lantz E, et al. The effect of acute sleep deprivation on skeletal muscle protein synthesis and the hormonal environment. *Physiol Rep* 9(1):e14660, 2021. https://doi.org/10.14814/phy2.14660
73. Craven J, McCartney D, Desbrow B, et al. Effects of acute sleep loss on physical performance: a systematic and meta-analytical review. *Sports Med* 52(11):2669–2690, 2022. https://doi.org/10.1007/s40279-022-01706-y
74. Knowles OE, Drinkwater EJ, Urwin CS, Lamon S, Aisbett B. Inadequate sleep and muscle strength: implications for resistance training. *J Sci Med Sport* 21(9):959–968, 2018. https://doi.org/10.1016/j.jsams.2018.01.012
75. Gao B, Dwivedi S, Milewski MD, Cruz AI Jr. Lack of sleep and sports injuries in adolescents: a systematic review and meta-analysis. *J Pediatr Orthop* 39(5):e324–e333, 2019. https://doi.org/10.1097/BPO.0000000000001306
76. Bell L, Strafford BW, Coleman M, et al. Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. *Sports Med Open* 9:87, 2023. https://doi.org/10.1186/s40798-023-00633-0
77. Rogerson D, Nolan D, Androulakis Korakakis P, Immonen V, Wolf M, Bell L. Deloading practices in strength and physique sports: a cross-sectional survey. *Sports Med Open* 10(1):26, 2024. https://doi.org/10.1186/s40798-024-00691-y
78. Coleman M, Burke R, Augustin F, et al. Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. *PeerJ* 12:e16777, 2024. https://doi.org/10.7717/peerj.16777
79. Human Performance Resources by CHAMP (HPRC). What is a one-rep max? (NSCA 1RM testing protocol: warm-up, rest and increments). HPRC, 2022. https://www.hprc-online.org/articles/one-rep-max-for-strength
80. Ylinen J, Takala EP, Nykänen M, et al. Active neck muscle training in the treatment of chronic neck pain in women: a randomized controlled trial. *JAMA* 289(19):2509–2516, 2003. https://doi.org/10.1001/jama.289.19.2509
81. Siewe J, Rudat J, Röllinghoff M, et al. Injuries and overuse syndromes in powerlifting. *Int J Sports Med* 32(9):703–711, 2011. https://doi.org/10.1055/s-0031-1277207
82. Siewe J, Marx G, Knöll P, et al. Injuries and overuse syndromes in competitive and elite bodybuilding. *Int J Sports Med* 35(11):943–948, 2014. https://doi.org/10.1055/s-0034-1367049
83. Gray SE, Finch CF. The causes of injuries sustained at fitness facilities presenting to Victorian emergency departments – identifying the main culprits. *Inj Epidemiol* 2:6, 2015. https://doi.org/10.1186/s40621-015-0037-4
84. Hooper DR, Szivak TK, Comstock BA, et al. Effects of fatigue from resistance training on barbell back squat biomechanics. *J Strength Cond Res* 28(4):1127–1134, 2014. https://doi.org/10.1097/JSC.0000000000000237
85. McGill SM, Karpowicz A. Exercises for spine stabilization: motion/motor patterns, stability progressions, and clinical technique. *Arch Phys Med Rehabil* 90(1):118–126, 2009. https://doi.org/10.1016/j.apmr.2008.06.026
86. McKean MR, Burkett BJ. Overhead shoulder press – in-front of the head or behind the head? *J Sport Health Sci* 4(3):250–257, 2015. https://doi.org/10.1016/j.jshs.2013.11.007
87. Coratella G, Tornatore G, Longo S, Esposito F, Cè E. Front vs back and barbell vs machine overhead press: an electromyographic analysis and implications for resistance training. *Front Physiol* 13:825880, 2022. https://doi.org/10.3389/fphys.2022.825880
88. Thigpen CA, Padua DA, Morgan N, Kreps C, Karas SG. Scapular kinematics during supraspinatus rehabilitation exercise: a comparison of full-can versus empty-can techniques. *Am J Sports Med* 34(4):644–652, 2006. https://doi.org/10.1177/0363546505281797
89. Hickey D, Solvig V, Cavalheri V, Harrold M, Mckenna L. Scapular dyskinesis increases the risk of future shoulder pain by 43% in asymptomatic athletes: a systematic review and meta-analysis. *Br J Sports Med* 52(2):102–110, 2018. https://doi.org/10.1136/bjsports-2017-097559
90. Kibler WB, Ludewig PM, McClure PW, et al. Clinical implications of scapular dyskinesis in shoulder injury: the 2013 consensus statement from the 'Scapular Summit'. *Br J Sports Med* 47(14):877–885, 2013. https://doi.org/10.1136/bjsports-2013-092425
91. Blazek D, Stastny P, Maszczyk A, et al. Systematic review of intra-abdominal and intrathoracic pressures initiated by the Valsalva manoeuvre during high-intensity resistance exercises. *Biol Sport* 36(4):373–386, 2019. https://doi.org/10.5114/biolsport.2019.88759
92. Snook SH, Webster BS, McGorry RW, Fogleman MT, McCann KB. The reduction of chronic nonspecific low back pain through the control of early morning lumbar flexion: a randomized controlled trial. *Spine* 23(23):2601–2607, 1998. https://doi.org/10.1097/00007632-199812010-00015
93. Mersmann F, Bohm S, Arampatzis A. Imbalances in the development of muscle and tendon as risk factor for tendinopathies in youth athletes: a review of current evidence and concepts of prevention. *Front Physiol* 8:987, 2017. https://doi.org/10.3389/fphys.2017.00987
94. Heinemeier KM, Schjerling P, Heinemeier J, Magnusson SP, Kjaer M. Lack of tissue renewal in human adult Achilles tendon is revealed by nuclear bomb 14C. *FASEB J* 27(5):2074–2079, 2013. https://doi.org/10.1096/fj.12-225599
95. Magnusson SP, Kjaer M. The impact of loading, unloading, ageing and injury on the human tendon. *J Physiol* 597(5):1283–1298, 2019. https://doi.org/10.1113/JP275450
96. Andrade R, Wik EH, Rebelo-Marques A, et al. Is the acute:chronic workload ratio (ACWR) associated with risk of time-loss injury in professional team sports? A systematic review of methodology, variables and injury risk in practical situations. *Sports Med* 50(9):1613–1635, 2020. https://doi.org/10.1007/s40279-020-01308-6
97. Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. *Int J Sports Physiol Perform* 15(6):907–913, 2020. https://doi.org/10.1123/ijspp.2019-0864
98. Thomeé R. A comprehensive treatment approach for patellofemoral pain syndrome in young women. *Phys Ther* 77(12):1690–1703, 1997. https://doi.org/10.1093/ptj/77.12.1690
99. Haupt HA. Upper extremity injuries associated with strength training. *Clin Sports Med* 20(3):481–490, 2001. https://doi.org/10.1016/s0278-5919(05)70264-7
100. Axler CT, McGill SM. Low back loads over a variety of abdominal exercises: searching for the safest abdominal challenge. *Med Sci Sports Exerc* 29(6):804–811, 1997. https://doi.org/10.1097/00005768-199706000-00011
