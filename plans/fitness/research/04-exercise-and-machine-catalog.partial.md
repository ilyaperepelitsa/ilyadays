# 04 — Exercise and machine catalog with alternatives

Research deliverable for the ilyadays fitness planner. Scope: a structured catalog of gym exercises (138 entries, 38 equivalence classes, 31 muscle-map regions) with machine names across manufacturer lines, load increments, difficulty, support/lower-back flags, ordered alternatives, strength standards for an untrained-to-novice adult male of 75–90 kg, and an honest account of what "colour-coded" machines mean. Date: 2026-11-08. Audience: the owner (adult male, trains alone, machine-first, 3 days/week; goals: fat loss, strength, some pec development, strong back, arm strength, ab strength, longevity; legs added later) and the implementation agents.

Method note: 41 peer-reviewed papers or position stands were read at abstract/full-text level through publisher, PubMed/Europe PMC or PMC pages; manufacturer facts come from official catalog pages or dealer spec sheets; strength standards were pulled directly from Strength Level machine pages (male, kg, by bodyweight) and Symmetric Strength. The ExRx pages refused automated fetches, so ExRx figures are reproduced from the widely republished table and flagged. The web-search budget for this session ran out before the ACE chest/triceps/biceps EMG studies could be verified, so they are not cited.

---

## 1. Summary

- Machines and free weights produce the same hypertrophy and the same general strength; strength gains are specific to the implement tested (Haugen 2023 meta-analysis: hypertrophy SMD −0.06, p = 0.75; strength tested on free weights SMD −0.21 favouring free weights, p = 0.02; strength tested on machines SMD +0.29 favouring machines, p = 0.06). A machine-first plan is fully legitimate; progress must be logged and tested per implement, not per "movement".
- The catalog's unit of substitution is the equivalence class = movement pattern × primary muscle (38 classes, 138 exercises). Members are interchangeable with a load re-seed; e.g. horizontal-press: machine chest press ≈ converging press ≈ plate-loaded press ≈ Smith bench ≈ dumbbell bench ≈ barbell bench ≈ push-up (same pec/front-delt EMG at matched relative load; machine 1RM ≈ 0.8× barbell, dumbbell per hand ≈ 0.42× barbell, Smith ≈ 0.97× barbell).
- Default to supported, lower-back-safe variants for this owner: chest-supported machine rows, lever pulldowns, machine or bench-supported presses, pad-supported curls and extensions. Among three rows, the inverted row gave the highest lat/upper-back EMG with the lowest lumbar load and the bent-over barbell row the highest lumbar load, so the barbell row is an alternative (`lower_back_load: high`), not a default.
- Evidence-ranked first choices per muscle: 30° incline for upper chest; medium pronated-grip pulldown (grip width barely changes lat EMG, pronated beats supinated); chin-up/pull-up top for lats; reverse pec deck for rear delts; dumbbell shoulder press for front delts; side-lying or cable external rotation for the cuff; overhead cable extension for the triceps long head (+28.5% vs +19.6% volume); seated over lying leg curl (≈14% vs ≈9% hamstring volume); standing over seated calf raise for the gastrocnemius (+9–12% vs +1–2%); hip thrust ≈ back squat for glutes.
- Lengthened-position rule for choosing within a class: prefer the variant that loads the primary muscle at long length (overhead triceps, incline or Bayesian curl, seated leg curl, standing calf raise, leg extension starting from ≥90–100° knee flexion). Each JSON entry carries `lengthened_bias`.
- Core for strength, not endurance: loaded trunk flexion (machine crunch, cable crunch), hip-flexion abs (captain's chair and hanging raises, 30° reverse crunch), anti-extension (rollouts), anti-rotation (Pallof press) and anti-lateral-flexion (side plank, suitcase carry). The rotary-torso machine is optional and light only: in a porcine model, axial twist combined with repeated flexion produced annular delamination in 67.5% of specimens.
- Load steps: metric pin stacks move in 5 kg plates with a 2.5 kg half-plate ("Smart Pin"); US-designed lines in 10 lb plates with 5 lb add-ons or 5/10/15 lb dials; plate-loaded machines 1.25 kg per arm; barbells 2.5 kg; dumbbells 2 kg; assisted machines 5 kg of assistance. Because 5 kg is +12% on a 40 kg pulldown, progression is double progression (fill the rep range first, then add the smallest step).
- Anchors for an untrained-to-novice 80 kg man (Strength Level Beginner / Novice 1RM, kg): lat pulldown 47/64, chest press 39/61, seated cable row 47/65, machine shoulder press 29/50, pec deck 42/63, 45° leg press 109/162, leg extension 48/72, seated leg curl 39/58, cable pushdown 22/36, machine curl 25/39, cable crunch 26/44. First working sets ≈ 60% of the Beginner 1RM (pulldown 30, chest press 25, row 30 kg); three-month 10RM targets ≈ 75% of the Novice 1RM (pulldown 48, chest press 46, row 49 kg).
- Colour coding has no industry-wide meaning: Planet Fitness's green/red circuit light is a timer, Technogym's yellow marks the parts you adjust, Easy Line hydraulics self-adjust, kettlebell and band colours encode load. The planner should treat any machine colour as a gym-local user tag, never as a difficulty rating.
- Longevity add-ons the catalog supports: direct neck work (+13% neck-extensor cross-section in 12 weeks where general lifting gave 0%), grip work (men's grip peaks at ≈52 kg around age 32; each 5 kg less grip was associated with 16% higher all-cause mortality in 140,000 people), and one or two axially loaded free-weight lifts in later phases (deadlift, squat, overhead press plus impact raised lumbar-spine BMD 4.1% vs 0.9% in osteopenic men and beat a machine-based isometric program).

---

## 2. Publishable section

### Choosing exercises, and swapping them, when you train alone on machines

**Machines are not a compromise.** The most direct test is Schwanbeck and colleagues' eight-week randomized trial: 46 young adults trained exclusively with free weights or exclusively with machines, 3–4 sets of 4–10 reps per exercise, and ended with the same gains in biceps and quadriceps thickness and the same strength on free-weight tests; the only strength difference favoured the machine group on the machine chest press (13.9% vs 8.6%) [1]. The 2023 meta-analysis by Haugen et al. (13 studies, 1,016 participants) found the same pattern at scale: no difference in hypertrophy (SMD −0.06, p = 0.75), none in isometric strength or jump height, and a modality-specific strength effect — free-weight groups improved more on free-weight tests (SMD −0.21, p = 0.02) and machine groups tended to improve more on machine tests (SMD +0.29, p = 0.06) [2][3]. Two things follow. A machine-first program builds muscle and general strength as well as a barbell program does. And progress has to be measured on the implements you actually train with, which is why this catalog attaches strength standards to machines and not only to barbell lifts.

**How the catalog is organized.** Every exercise carries a movement pattern (horizontal push, vertical pull, hip hinge and so on), primary and secondary muscles, an equipment type and an *equivalence class*: the set of exercises that load the same primary muscle through the same pattern. The horizontal-press class is machine chest press ≈ converging chest press ≈ plate-loaded press ≈ Smith bench ≈ dumbbell bench ≈ barbell bench ≈ push-up. Within a class the stimulus is close enough that members substitute for one another when a machine is occupied or missing; what changes is the load you can use, the stability demand and the lower-back exposure. EMG comparisons justify treating a class as a unit. A seated chest-press machine and a barbell bench press at 60% of 1RM produce similar pectoralis, anterior-deltoid and triceps activity (the machine's neutral grip slightly favoured the clavicular pec), although the machine 1RM was about 18% lower (≈70 vs 85 kg) [8]. Barbell, Smith-machine and dumbbell bench presses give the same pectoralis and anterior-deltoid activity, with dumbbells lowering the usable load by 14–17% and reducing triceps involvement [6]. Even the push-up belongs: when a band-resisted push-up is matched to a 6RM bench press by EMG, five weeks of either produce the same 1RM gains [10], and four weeks of progressive push-ups raised bench-press 1RM as much as bench pressing did in moderately trained men [11].

**Why "supported" matters for this plan.** The owner trains alone and wants a strong back rather than a fragile one, so each entry is flagged for chest or back support and for lumbar load. The clearest data come from McGill's laboratory: of three rows, the inverted row produced the highest latissimus and upper-back activation with the lowest lumbar spine load, the standing bent-over row produced the greatest lumbar load and stiffness, and the one-arm cable row mainly challenged torsional control [17]. Chest-supported machine rows, lever pulldowns and seated cable rows therefore head the horizontal-pull class for this user, and the barbell row is kept as an alternative with a high lower-back flag.

**Chest.** Bench angle changes which part of the pectoralis works hardest. In 30 trained lifters, 30° gave the highest upper-pec EMG, 0° the highest mid- and lower-pec EMG, and 60° shifted the work to the anterior deltoid [9]. The practical consequence for "a bit of pec development" is one flat press and one 30° incline press per week, with the pec deck or cable fly as the isolation option. Dips and the seated dip or triceps-press machine cover the lower-chest/triceps pattern; the assisted dip-chin machine is the regression.

**Back.** Grip width matters less than gym folklore says. Narrow, medium and wide pronated pulldown grips produced similar latissimus, trapezius and infraspinatus activation over the whole movement, and the medium grip (1.5× biacromial width) allowed a slightly heavier 6RM than the wide grip (80 vs 77 kg) [12]; a pronated grip activates the lats more than a supinated one at either width [13]. Chin-ups and pull-ups stay at the top of lat rankings — 117–130% of MVIC in Youdas et al. [15] and best for the lats among eight exercises in the ACE-sponsored back study [16] — and the chin-up adds more biceps and erector-spinae work than the pulldown [14]. For the mid-back, the ACE study found the bent-over row, inverted row, seated row and I-Y-T raises recruited the middle trapezius best and I-Y-T raises the lower trapezius best [16]. Among machine pulls, the reverse pec deck produced the highest posterior-deltoid activation and, together with the seated row, beat the pulldown for the middle deltoid [18].

**Shoulders.** In the ACE shoulder study the dumbbell shoulder press produced the highest anterior-deltoid activation, the 45° incline row and bent-arm lateral raise the highest medial-deltoid activation, and the seated rear lateral raise and 45° incline row the highest posterior-deltoid activation; the upright row ranked poorly on every head [19]. Standing dumbbell presses give the highest deltoid EMG but the lowest 1RM (about 10% below seated dumbbell and 7% below standing barbell) [20], which is why the seated machine or dumbbell press is the strength tool and the standing press is optional. Dumbbell and cable lateral raises produced identical lateral-deltoid growth over eight weeks in trained lifters (+3.3–4.6% thickness in both) [21], so the planner treats them as one class. For the rotator cuff, side-lying external rotation gives the highest infraspinatus and teres-minor activity (62% and 67% MVIC) [22]; a cable or band external rotation at the side is the gym equivalent.

**Arms and the long-length principle.** One rule recurs across recent trials: where an exercise lets you load a muscle in its lengthened position, that muscle tends to grow more. Cable triceps extensions performed overhead grew the long head 28.5% versus 19.6% for the same movement at the side, and the whole triceps 19.9% vs 13.9%, despite 34–39% lighter loads [23]. Incline curls grew the proximal biceps more and preacher curls the distal elbow flexors more, with strength gains specific to the trained variant [24]; a within-subject trial of preacher versus behind-the-body "Bayesian" cable curls, however, found no regional difference [25], so the biceps evidence is mixed and the practical default is simply to rotate one stretched-position curl (incline or Bayesian) with one preacher or machine curl. Kassiano et al.'s systematic review concluded that full ROM, or partial ROM in the stretched part of the movement, out-performs shortened-range partials for the quadriceps, biceps and distal brachialis [26]; Pedrosa et al. found that leg-extension training restricted to the 100–65° (stretched) range produced the largest distal quadriceps growth [27]; seated leg curls beat prone curls for whole-hamstring volume (≈14% vs ≈9%) [28]; and standing calf raises beat seated raises for the gastrocnemius (+12.4%/+9.2% vs +1.7%/+0.6%, soleus equal) [29]. In the catalog these findings decide which member of a class is listed first.

**Core: strength, not endurance.** For a strength goal the abdominals need progressive load, which means cable crunches, machine crunches, hanging knee or leg raises and rollouts rather than high-rep floor work. Escamilla's EMG study found the highest upper- and lower-rectus activity with the Power Wheel (roll-out, pike, knee-up), hanging knee-ups with straps and the 30° reverse crunch, and the highest external-oblique activity with the Power Wheel and the hanging knee-up [32]; ACE's 2001 study ranked the bicycle crunch and the captain's-chair knee raise first and second for the rectus abdominis (248% and 212% of a standard crunch) and the captain's chair first for the obliques (310%) [33]. Most of these also work the hip flexors hard [32], so a plank, dead-bug and side-plank layer is kept for days when the back complains, following McGill's curl-up, side-bridge and bird-dog progressions [34]. The rotary-torso machine is in the catalog but not as a default: in McGill's porcine model repeated axial twist alone did not herniate discs, but twist combined with repeated flexion produced radial annular delamination in 67.5% of specimens [35]. Loaded seated twisting is therefore optional, light and limited to a pain-free range, with Pallof presses, braced cable woodchops and suitcase carries as the rotation-control defaults.

**Lower back, neck, grip and bone.** The lumbar-extension machine ("Lower Back", "Back Extension") has its own evidence base: isolated lumbar-extension training produces meaningful improvements in pain and disability in chronic low-back pain, and once-weekly training to momentary failure appears sufficient [36]. The neck responds only to direct work: twelve weeks of squats, deadlifts, push presses and rows did nothing to neck-muscle cross-section, while adding 3 × 10 head extensions grew it from 19.5 to 22.0 cm² (+13%) and raised neck strength from 17.9 to 23.9 kg [37], hence the brief neck section. Grip is a longevity marker: British normative data put men's peak grip at 51.9 kg around age 32 [38], and in the 140,000-person PURE cohort each 5 kg lower grip strength was associated with 16% higher all-cause mortality (HR 1.16) [39]; the forearm and grip entries (carries, hangs, pinches) target that. Finally, bone: in men with low bone density, high-intensity resistance and impact training (deadlift, back squat, overhead press and jumping chin-ups at high loads) increased lumbar-spine BMD by 4.1% versus 0.9% in controls and out-performed a machine-based isometric program on spine BMD and function [40]. A machine-first plan should therefore still include one or two axially loaded free-weight lifts, such as a trap-bar deadlift, a goblet or back squat and an overhead press, in later phases.

**Legs, for later.** The lower-body catalog is included for the phase when legs are added. Hip thrusts and back squats produced similar gluteal growth over nine weeks, while squats grew the quadriceps and adductors more and each lift improved its own 3RM most [30]; free-weight squats produce about 43% higher average EMG than Smith-machine squats across seven muscles, mainly in the calves, hamstrings and vastus medialis [31]; and the Copenhagen adduction exercise lowered the odds of groin problems by 41% in a cluster-randomized trial of 652 footballers [41], which makes it the bodyweight substitute for the adductor machine.

**Loads, reps and increments.** The ACSM position stand recommends 8–12RM loads for novices, 2–10% load increases once one or two extra reps are possible, and a moderate 1–2 s concentric / 1–2 s eccentric tempo [4]; Schoenfeld's meta-analysis shows that hypertrophy is similar across loads when sets approach failure, while 1RM strength gains are larger with loads above 60% 1RM [5]. The catalog therefore gives each exercise a rep range (heavier for compound machines and barbells, lighter for single-joint and stabiliser work) and the smallest load step the equipment allows. Metric pin stacks move in 5 kg plates with a 2.5 kg half-plate "Smart Pin" on Technogym Element and Selection machines [45][46]; US-designed lines move in 10 lb plates with 5 lb add-ons (Life Fitness Signature, Nautilus Inspiration) or a dial giving 5/10/15 lb (Life Fitness fly machines, Cybex Eagle NX) [48][50][51]; Matrix Ultra offers 2.5/5/7.5 lb add-ons and Versa a 5 lb step [52]. Because a 5 kg jump is 12% of a 40 kg pulldown, the planner uses double progression — add reps inside the range first, then the smallest increment — rather than fixed weekly weight jumps.

**Strength standards.** Crowd-sourced standards (Strength Level, with 10⁵–10⁶ qualifying lifts per machine) and model-based standards (Symmetric Strength, ExRx) disagree in absolute terms because their populations differ: Strength Level's "Beginner" (the movement practised for at least a month) bench press of 56 kg for an 80 kg man is higher than Symmetric Strength's "Untrained" 45 kg and close to ExRx's "Untrained" ≈54 kg at 75 kg [42][43][44]. The catalog uses Strength Level for machine-specific anchors, because it is the only source that covers chest press, lat pulldown, seated row, leg press and the other machines directly, seeds the first working weight at about 60% of the Beginner 1RM, and then autoregulates.

**What colour coding means.** There is no industry convention. Planet Fitness's "30-Minute Express Circuit" is a separate zone of ten machines and ten step platforms controlled by a green/red light (green: exercise for about 60 s; red: move to the next station), so the colours signal timing, not difficulty [54]. Technogym paints every adjustable part of its Selection machines yellow so a first-time user knows what to touch, and adds visual position flags [45]; its Easy Line is a hydraulic circuit whose resistance scales with movement speed, so there is nothing to set at all [55]. Where colour does encode load it is on the implements, not the machines: competition kettlebells (16 kg yellow, 24 kg green, 32 kg red) and resistance bands, both manufacturer-specific [56]. A planner should therefore treat any machine colour as a gym-local tag the user attaches, never as a difficulty rating.

---
## 3. Decision rules / parameters

### 3.1 Field legend for the `exercise_catalog` JSON

| Field | Type | Meaning |
|---|---|---|
| `id` | string | kebab-case, stable key; alternatives reference these ids |
| `name` | string | display name |
| `group` | enum | `chest` `back` `shoulders` `arms` `forearms` `core` `neck` `legs` |
| `phase` | enum | `now` (upper body, core, neck) or `later` (legs, per the owner's plan) |
| `equipment` | enum | `selectorized-machine` `plate-loaded-machine` `cable` `barbell` `dumbbell` `bodyweight` `assisted-machine` `smith` `kettlebell` `band` |
| `machine_names` | string[] | common commercial names and manufacturer line names; verified from catalog/dealer pages where marked in §3.11, otherwise typical marketing names — confirm on the local gym floor |
| `primary` / `secondary` | string[] | ids from the `muscle_groups` JSON |
| `pattern` | string | movement pattern |
| `class` | string | equivalence class (see §3.6) |
| `difficulty` | 1–3 | see §3.3 |
| `increment_kg` / `min_increment_kg` | number | typical and smallest practical load step on that equipment (see §3.2); `0` = progress by reps, leverage or added load |
| `rep_range` / `rep_unit` | [lo, hi] + enum | `reps`, `seconds` (holds) or `meters` (carries) |
| `laterality` | enum | `bilateral`, `unilateral`, `either` (machine allows one side at a time) |
| `supported` | bool | trunk pinned by a chest/back pad or bench so the lumbar spine is not the limiting link |
| `lower_back_load` | enum | `low` (supported or unloaded spine), `moderate` (standing/neutral spine, light to moderate load), `high` (axial compression, loaded hinge, or loaded spinal rotation/flexion) |
| `lengthened_bias` | bool | the exercise loads the primary muscle hardest at long muscle length (favoured within a class, §2) |
| `alternatives` | string[] | ordered by similarity (same class, same primary muscle; closest equipment and support first) |
| `notes` | string | ≤200 chars; technique cues live in the technique research, not here |

### 3.2 Equipment types and load increments

| Equipment type | Typical step | Smallest practical step | Notes | Sources |
|---|---|---|---|---|
| Selectorized pin stack, metric lines (Technogym Selection/Element, European Matrix) | 5 kg plate | 2.5 kg ("Smart Pin" half-plate on Technogym; add-on weights elsewhere) | Stacks 65–130 kg; Lat Machine 90/130, Delts 65/100, Lower Back 65/95, Chest Press 100/130 kg | [45][46] |
| Selectorized, US-designed lines (Life Fitness Signature/Insignia, Nautilus Inspiration/One, Cybex Eagle NX, Precor Vitality/Discovery) | 10 lb (4.5 kg) | 5 lb (2.3 kg) add-on; Life Fitness fly dial 5/10/15 lb; Cybex Twist-Select 0/5/10/15 lb; Precor lever-engaged add-on | Many gyms outside the US stock the same frames with 5 kg stacks: read the plate labels | [48][50][51][53] |
| Matrix Ultra / Versa | 10 lb (Ultra Leg Press 20 lb) | Ultra 2.5/5/7.5 lb add-on; Versa 5 lb; Versa functional trainer 2.5 lb | — | [52] |
| Cable column / functional trainer | 5 kg or 2.5 kg plates | 1.25–2.5 kg | Dual-pulley trainers often use a 2:1 ratio: hand load and step are half the stack label | [52] |
| Plate-loaded lever machine (Hammer Strength, Technogym Pure) | 2.5 kg total (1.25 kg per side) | 1.25 kg per arm on iso-lateral units; 0.5 kg micro-plates | Lever ratio means plate mass ≠ hand load; log plates per side, never convert to "kg lifted" | [49][58] |
| Barbell | 2.5 kg (pair of 1.25 kg) | 0.5–1 kg fractional plates | Standard bar 20 kg; log bar weight | — |
| Smith machine | 2.5 kg | 1 kg | Bar weight 7–25 kg depending on counterbalance: weigh/record it once per gym | [6][7] |
| Dumbbell | 2 kg (1 kg below ~10 kg) | 1 kg; 0.5–1 kg magnetic adders | US racks 5 lb (2.3 kg) | — |
| Kettlebell | 4 kg | 2 kg (some racks) | Competition bells colour-coded by mass | [56] |
| Assisted dip/chin machine | 5 kg or 10 lb of assistance | 2.5 kg | Less assistance = progression; record assistance, not body weight | [47] |
| Bodyweight | — | reps, leverage (incline height, lever length), belt load (2.5 kg), assistance | Use rep progression within the range, then load | — |
| Band | one colour step | double band / shorter grip | Manufacturer-specific tension; Theraband-style sets progress yellow → red → green → blue → black | [56] |

Planner rule: store `increment_kg` and `min_increment_kg` per **gym × machine**, defaulting to the table; a 5 kg stack step is 12.5% on 40 kg and 25% on 20 kg, so for any exercise whose working load is < 10× the step, progress reps first (§3.5) and only then add the smallest step.

### 3.3 Difficulty scale

| Level | Definition | Typical members | Learning time |
|---|---|---|---|
| 1 | Guided/fixed path or pad-supported single-joint work; can be taken to failure alone with no spotter | pin and plate-loaded machines, seated cable isolation, assisted machines, basic bodyweight (plank, bird dog) | one session |
| 2 | Free-weight or cable compound with moderate stability demand, standing isolation, bodyweight with leverage, Smith compounds | dumbbell presses/rows, cable flies and curls, push-up, inverted row, dip, goblet squat, Smith bench/squat | 2–4 sessions |
| 3 | Axially loaded or technique-heavy barbell lifts and advanced bodyweight | back squat, deadlift, RDL, standing OHP, barbell row, incline/flat barbell bench without a spotter, pull-up/chin-up for the untrained, Nordic curl, hanging leg raise | weeks; use video self-check |

Rule: a substitute may be at most one difficulty level above the original; never auto-substitute a level-3 lift for a level-1 machine. The ACSM position stand recommends novices progress with 8–12RM loads and moderate tempo [4]; level-3 lifts enter in later phases.

### 3.4 Support and lower-back flags

| Flag | Rule in the planner |
|---|---|
| `supported: true` | may be programmed first in a session and taken to failure; preferred when the user reports back fatigue |
| `lower_back_load: low` | unrestricted |
| `lower_back_load: moderate` | ≤ 2 per session; not the first exercise of the day after prolonged sitting |
| `lower_back_load: high` | only in phases that deliberately include axial/hinge loading (bone-health block), never two in one session, technique load for ≥ 2 weeks before progression, excluded automatically when the user flags back pain |

Evidence: the inverted row had the lowest lumbar load and the bent-over row the highest among rows [17]; loaded flexion combined with twist is the disc-injury mechanism in McGill's porcine work [35]; the isolated lumbar-extension machine is the one deliberately loaded "back" exercise with clinical outcome evidence (once weekly to momentary failure) [36].

### 3.5 Rep-range rules

| Exercise type | Default range | Strength emphasis | Rationale |
|---|---|---|---|
| Compound machine / plate-loaded (presses, pulldowns, rows, leg press) | 6–12 | 5–8 | ACSM 8–12RM for novices, heavier (1–6RM) later [4]; 1RM gains larger above 60% 1RM [5] |
| Barbell compounds (bench, squat, deadlift, OHP, row) | 4–8 | 3–6 | heavy loads for strength [5]; keep 1–3 reps in reserve when alone |
| Dumbbell compounds | 6–12 | 5–8 | stability limits load [6][20] |
| Single-joint machine/cable/dumbbell | 8–15 | — | hypertrophy equal across loads to near-failure [5]; coarse stacks |
| Lateral raises, rear delts, rotator cuff, calves, neck, forearms | 10–20 | — | small muscles, small increments needed |
| Loaded core (crunch machine, cable crunch, hanging raises) | 8–15 | — | strength goal: progress load, not reps to 50 |
| Anti-movement core (plank, side plank, Pallof) | 20–60 s holds or 8–12 × 2–3 s | — | McGill progressions [34] |
| Carries | 20–40 m or 30–60 s | — | grip/posture |

Double progression: when the top of the range is reached on all sets with ≤ 2 RIR, add `min_increment_kg` and drop to the bottom of the range. ACSM: +2–10% load once 1–2 reps beyond target are possible [4].

### 3.6 Equivalence classes (members ordered for this owner: machine-first, back-safe, lengthened bias)

| Class | Pattern / primary | Ordered members |
|---|---|---|
| horizontal-press | horizontal push / chest-mid | machine-chest-press, converging-chest-press, plate-loaded-chest-press, smith-bench-press, dumbbell-bench-press, barbell-bench-press, push-up |
| incline-press | incline push / chest-upper | machine-incline-press, plate-loaded-incline-press, smith-incline-press, incline-dumbbell-press, incline-barbell-press, low-to-high-cable-fly |
| decline-press | decline push / chest-lower + triceps | triceps-press-machine, decline-chest-press-machine, assisted-dip, dip, high-to-low-cable-fly |
| chest-fly | horizontal adduction / chest | pec-deck, cable-fly, dumbbell-fly, low-to-high-cable-fly, high-to-low-cable-fly |
| vertical-pull | vertical pull / lats | vertical-traction, lat-pulldown, plate-loaded-pulldown, neutral-grip-pulldown, assisted-pull-up, single-arm-cable-pulldown, band-assisted-pull-up, pull-up, chin-up |
| lat-isolation | shoulder extension / lats | machine-pullover, straight-arm-pulldown, dumbbell-pullover |
| horizontal-pull | horizontal pull / upper-back + lats | machine-row, plate-loaded-row, t-bar-row, chest-supported-dumbbell-row, high-row-machine, seated-cable-row, inverted-row, single-arm-cable-row, single-arm-dumbbell-row, barbell-row |
| rear-delt | horizontal abduction / rear-delt | reverse-pec-deck, rear-delt-dumbbell-fly, cable-rear-delt-fly, face-pull, band-pull-apart |
| shrug | scapular elevation / traps-upper | machine-shrug, dumbbell-shrug |
| spinal-extension | lumbar extension / erectors | lower-back-machine, back-extension-45, reverse-hyperextension |
| spine-stability | bracing / core + erectors | bird-dog, dead-bug, plank, side-plank |
| vertical-press | vertical push / delts | machine-shoulder-press, plate-loaded-shoulder-press, smith-shoulder-press, seated-dumbbell-shoulder-press, landmine-press, standing-barbell-overhead-press |
| lateral-raise | abduction / side-delt | machine-lateral-raise, cable-lateral-raise, dumbbell-lateral-raise, band-lateral-raise |
| external-rotation | ER / rotator-cuff | cable-external-rotation, side-lying-external-rotation, band-external-rotation, face-pull |
| biceps-curl | elbow flexion / biceps | machine-preacher-curl, incline-dumbbell-curl, bayesian-cable-curl, ez-bar-preacher-curl, cable-curl, dumbbell-curl, barbell-curl |
| brachialis-curl | neutral/pronated elbow flexion | hammer-curl, reverse-curl |
| triceps-extension | elbow extension / triceps | overhead-cable-triceps-extension, machine-triceps-extension, dumbbell-overhead-triceps-extension, skull-crusher, cable-pushdown |
| triceps-press | compound press / triceps | triceps-press-machine, close-grip-bench-press, dip, assisted-dip, diamond-push-up |
| wrist-flexion / wrist-extension | forearms | wrist-curl / reverse-wrist-curl |
| grip | carry, hang, crush, pinch | farmers-carry, dead-hang, gripper, plate-pinch, suitcase-carry |
| trunk-flexion | loaded flexion / rectus | machine-crunch, cable-crunch, decline-sit-up, bicycle-crunch, mcgill-curl-up |
| lower-ab-flexion | hip flexion + posterior tilt | captains-chair-knee-raise, reverse-crunch, hanging-leg-raise |
| anti-extension | — | ab-wheel-rollout, plank, dead-bug |
| anti-rotation | — | pallof-press, single-arm-cable-row, bird-dog |
| rotation | loaded rotation / obliques | cable-woodchop, rotary-torso-machine (optional) |
| anti-lateral-flexion | — | side-plank, suitcase-carry |
| neck | flexion/extension | four-way-neck-machine, neck-extension, neck-flexion, neck-isometrics |
| squat | knee-dominant / quads + glutes | leg-press-45, seated-leg-press, hack-squat, v-squat, belt-squat, goblet-squat, bulgarian-split-squat, smith-squat, barbell-back-squat |
| knee-extension | quads (rectus femoris) | leg-extension |
| knee-flexion | hamstrings | seated-leg-curl, lying-leg-curl, nordic-hamstring-curl |
| hip-hinge | hinge / hamstrings + glutes + erectors | trap-bar-deadlift, dumbbell-rdl, barbell-rdl, cable-pull-through, back-extension-45, conventional-deadlift, kettlebell-swing |
| hip-thrust | hip extension / glute-max | machine-hip-thrust, barbell-hip-thrust, glute-kickback-machine |
| hip-abduction / hip-adduction | — | hip-abduction-machine / hip-adduction-machine, copenhagen-adduction |
| calf-straight | straight-knee / gastrocnemius + soleus | standing-calf-raise-machine, leg-press-calf-raise, single-leg-dumbbell-calf-raise |
| calf-bent | bent-knee / soleus | seated-calf-raise-machine |

### 3.7 Substitution algorithm

1. Candidates = entries with the same `class` whose `primary[0]` equals the original's `primary[0]`. If none are available in the user's gym profile, widen to the same `pattern`.
2. Order candidates by: same `equipment` family first (machine → machine), then cable, dumbbell, Smith, barbell, bodyweight; among equals prefer `supported: true` and `lower_back_load` no worse than the original; prefer `lengthened_bias: true` when the original had it.
3. Reject candidates with `difficulty` > original + 1, and reject `lower_back_load: high` unless the current phase allows it (§3.4).
4. Keep the original's `rep_range` unless the candidate's own range excludes it (use the candidate's range).
5. Seed the load with §3.8 (or the candidate's Strength Level Beginner anchor when no conversion exists), take the first set at ≈3 RIR, then autoregulate in the session.
6. Log the substitution as a separate exercise history: strength is modality-specific [2], so never write the substitute's load into the original's progression.

### 3.8 Load re-seeding heuristics between equivalent exercises

| From → To | Factor on load | Basis |
|---|---|---|
| barbell bench → dumbbell bench (per hand) | × 0.41–0.43 | dumbbell total ≈ 83% of barbell 1RM [6] |
| barbell bench → Smith bench | × 0.97, or Smith = 0.95 × BB − 6.8 kg | [6]; regression in [7] |
| barbell bench → selectorized chest press (stack kg) | × 0.80 | machine 1RM ≈ 70 vs 85 kg barbell [8]; Strength Level Novice 61 vs 75 kg [42] |
| barbell bench → plate-loaded iso-lateral press (plates) | start at × 0.6 and adjust | lever ratios vary by model; no study |
| standing barbell OHP → standing dumbbell (per hand) | × 0.47; seated dumbbell × 0.52 | standing DB ≈ 93% of standing BB; standing DB ≈ 90% of seated DB [20] |
| barbell OHP → machine shoulder press | × 1.1 | Strength Level Novice 50 vs 46 kg at 80 kg [42] |
| back squat → 45° sled leg press | × 1.6 | Strength Level Novice 162 vs 101 kg [42] |
| back squat → hack squat (plates) | × 1.0 | Strength Level Novice 102 vs 101 kg [42] |
| back squat → Smith squat | × 1.0–1.1 | Smith ≥ free in [7]; free squat ≈ 43% higher EMG [31] |
| barbell row → seated cable row | × 1.0 | Strength Level Novice 65 vs 66 kg [42] |
| lat pulldown 1RM ↔ pull-ups | 0.6 × BW ↔ first rep; 0.8 × BW ↔ ~7 reps; 1.05 × BW ↔ ~13 reps | Strength Level 80 kg male: pulldown 47/64/85 kg ↔ pull-ups 1/7/13 [42] |
| cable pushdown → overhead cable extension | × 0.63 | overhead loads 34–39% lighter [23] |
| machine/preacher curl → incline or Bayesian curl | × 0.95 | similar 1RM, 21.9 vs 20.7 kg [25] |
| seated leg curl ↔ lying leg curl | × 1.0 then adjust | both trained at 70% 1RM; no absolute loads reported [28] |
| standing ↔ seated calf raise | no conversion | different muscles (gastrocnemius vs soleus) [29] |

### 3.9 Strength standards and starting loads (adult male, 75–90 kg)

Definitions: Strength Level "Beginner" = can perform the movement correctly and has practised it for ≥ 1 month; "Novice" = ≥ 6 months regular training; "Intermediate" = ≥ 2 years [42]. Symmetric Strength uses model bands (Untrained → World class) derived from Wilks-scaled powerlifting totals [43]. ExRx (Kilgore) "Untrained" = healthy person who can perform the lift correctly without prior training, "Novice" = several months of regular training [44].

**Machine anchors (Strength Level, male, 1RM kg; Beginner / Novice / Intermediate) [42]**

| Exercise | 75 kg | 80 kg | 85 kg | 90 kg | Qualifying lifts (male) |
|---|---|---|---|---|---|
| Lat pulldown | 44 / 61 / 81 | 47 / 64 / 85 | 50 / 67 / 88 | 52 / 70 / 92 | 598,899 |
| Machine chest press | 36 / 57 / 85 | 39 / 61 / 89 | 42 / 64 / 93 | 45 / 68 / 98 | 180,929 |
| Seated cable row | 44 / 61 / 83 | 47 / 65 / 87 | 50 / 69 / 91 | 53 / 72 / 96 | 177,068 |
| Machine shoulder press | 26 / 46 / 71 | 29 / 50 / 76 | 32 / 53 / 81 | 35 / 57 / 86 | 105,396 |
| Pec deck (machine fly) | 39 / 59 / 84 | 42 / 63 / 89 | 46 / 67 / 93 | — | 134,143 |
| 45° sled leg press | 100 / 151 / 216 | 109 / 162 / 230 | 118 / 173 / 243 | 127 / 184 / 255 | ~728k total |
| Leg extension | 45 / 69 / 99 | 48 / 72 / 103 | 51 / 76 / 108 | — | 298,464 |
| Seated leg curl | 36 / 55 / 79 | 39 / 58 / 83 | 41 / 61 / 86 | — | 98,023 |
| Hack squat | 58 / 95 / 144 | 63 / 102 / 152 | 69 / 109 / 161 | — | 135,021 |
| Machine calf raise | 44 / 82 / 134 | 49 / 88 / 141 | 53 / 94 / 148 | — | 66,968 |
| Cable triceps pushdown | 20 / 34 / 53 | 22 / 36 / 56 | 23 / 39 / 59 | — | 214,143 |
| Machine biceps curl | 23 / 37 / 55 | 25 / 39 / 57 | 27 / 42 / 60 | — | 38,537 |
| Cable crunch | 24 / 41 / 65 | 26 / 44 / 68 | 27 / 46 / 70 | — | 10,753 |
| Barbell hip thrust | 50 / 88 / 139 | 56 / 96 / 149 | 62 / 104 / 158 | — | 158,924 |

**Free-weight and bodyweight anchors at 80 kg (Strength Level; Beginner / Novice / Intermediate) [42]:** barbell bench 56 / 75 / 98 kg; Smith bench 53 / 72 / 95; dumbbell bench 19 / 28 / 40 per hand (incl. 2 kg handle); overhead press 33 / 46 / 62; dumbbell shoulder press 15 / 22 / 31 per hand; dumbbell lateral raise 5 / 10 / 16 per hand; bent-over row 48 / 66 / 88; barbell curl 22 / 33 / 46; back squat 75 / 101 / 132; deadlift 89 / 119 / 155; pull-ups 1 / 7 / 13 reps; dips 3 / 10 / 20 reps (+5 / +26 / +52 kg); push-ups 6 / 20 / 38 reps.

**Symmetric Strength, 80 kg male, 1RM kg (Untrained / Novice / Intermediate) [43]:** bench 45 / 68 / 91; overhead press 29 / 44 / 59; Pendlay row 37 / 55 / 74; weighted pull-up −2 / +11 / +22; weighted chin-up +1 / +12 / +25; back squat 61 / 91 / 121; deadlift 70 / 105 / 140.

**ExRx (Kilgore) bench press, men 18–39 — reproduced from the widely republished table because exrx.net blocked automated fetches; verify before publishing [44]:** 75 kg (165 lb): Untrained 54 / Novice 68 / Intermediate 84 / Advanced 116 / Elite 145 kg; 82 kg (181 lb): 59 / 75 / 91 / 125 / 156 kg.

**Planner rule for first loads (untrained user, bodyweight bw):**
`first_load = round_to(min_increment, 0.60 × SL_Beginner_1RM(exercise, bw))`, target the bottom of the rep range at ≈3 RIR; if the user exceeds the top of the range, add two steps next set. Expected 10RM after ~12 weeks ≈ 0.75 × SL_Novice_1RM. For an 80 kg man: lat pulldown 30 → 48 kg; chest press 25 → 46; seated row 30 → 49; shoulder press 17.5 → 37.5; pec deck 25 → 47; leg press 65 → 120; leg extension 30 → 54; seated leg curl 25 → 44; pushdown 15 → 27; machine curl 15 → 29; cable crunch 15 → 33; assisted pull-up: assistance 35–50 kg for 6–8 reps (≈ pulldown 30–45 kg), reduce 2.5–5 kg per step. The 0.60 factor deliberately lands between Symmetric Strength's "Untrained" and Strength Level's "Beginner".

### 3.10 Colour coding: what was actually found

| Scheme | What the colour means | Is it a difficulty rating? | Source |
|---|---|---|---|
| Planet Fitness 30-Minute Express Circuit | Dedicated zone of 10 strength machines + 10 step stations; green light = exercise (~60 s), red light = move to the next station (~30 s); the zone itself is a distinct colour | No — timing signal | [54] (low-quality blog/forum descriptions; no official spec page found) |
| Technogym Selection 700/900 | All functional pins, levers and adjustment points are bright yellow; visual flags mark body position; 900 adds on-screen guidance and a 1RM test | No — "touch here" convention | [45] |
| Technogym Easy Line | Hydraulic pistons; resistance rises with movement speed; no pins or settings; sold as 8–16-station circuits for beginners | No — self-scaling resistance | [55] |
| Competition kettlebells | Colour = mass (8 kg pink, 12 blue, 16 yellow, 20 purple, 24 green, 28 orange, 32 red) | Load only | [56] |
| Resistance bands | Colour = tension, manufacturer-specific | Load only | [56] |
| Local stickers/placards ("beginner-friendly", muscle-group colours) | Gym-specific | Treat as a user-entered tag | — |

No chain-wide "green = easy, red = hard" machine scheme was found in this session's searches (Planet Fitness, Technogym, Life Fitness, Matrix, Cybex, Nautilus, Precor material). Implementation: `gym_machine.tags: string[]` free-form; difficulty always comes from the catalog's `difficulty` field.

### 3.11 Verified machine names and stacks by manufacturer line

| Line | Machines confirmed on official/dealer pages this session | Stack / increment facts |
|---|---|---|
| Technogym Selection 700/900 (selectorized) | Chest Press, Lat Machine, Delts Machine, Lower Back, Dual Pectoral/Reverse Fly, Dual Leg Extension/Seated Leg Curl, Dual Abductor/Adductor, Pulley; Vertical Traction, Low Row, Abdominal Crunch, Rotary Torso, Shoulder Press, Arm Curl/Arm Extension, Leg Press, Glute, Calf, Multipower are the line's standard names (not re-verified from a listing page this session) | Smart Pin half-plate; Lat Machine 90/130 kg, Delts 65/100 kg, Lower Back 65/95 kg, Chest Press 100/130 kg [45] |
| Technogym Element/Element+ | Chest Press, Shoulder Press, Lat Machine, Lower Back, Pectoral, Abdominal Crunch, Cable Column | Smart Pin 2.5 kg; Chest Press 82/109 kg; Shoulder Press 72.6/90.7 kg; Lat 80–90/120 kg [46] |
| Technogym Pure Strength (plate-loaded) | Chest Press, Row, Low Row, Shoulder Press, Linear Leg Press, Calf Press, Pullover, Biceps, Leg Extension, 45° Back Hyperextension | plate increments; Row max load 200 kg [58] |
| Life Fitness Insignia Series (selectorized) | Chest Press, Dual Axis Chest Press, Shoulder Press, Pulldown, Dual Axis Pulldown, Row, Pectoral Fly/Rear Deltoid, Lateral Raise, Biceps Curl (and Dependent), Triceps Extension, Triceps Press, Assist Dip Chin, Abdominal, Abdominal Advanced, Torso Rotation, Back Extension, Arc Leg Press, Leg Extension, Leg Curl, Seated Leg Curl, Calf Extension, Glute, Glute Bridge, Hip Abduction/Adduction, Hip Adduction, Sit/Stand Hip Abductor | stack options via sales rep [47]; Signature Series 5 lb add-on and 5/10/15 lb dial on fly [48] |
| Hammer Strength (plate-loaded) | Iso-Lateral Bench Press, Horizontal Bench Press, Incline Press, Super Incline Press, Decline Chest Press, Wide Chest, Chest/Back, Row, Low Row, High Row, D.Y. Row, T-Bar Row, Front Lat Pulldown, Wide Pulldown, Shoulder Press, Lateral Raise, Pullover, Seated Biceps, Seated Dip, Seated/Standing Shrug, Super Fly, Abdominal/Oblique Crunch, 4-Way Neck, Gripper; Linear Leg Press, Hack Squat, Reverse V-Squat, Pendulum-X Squat, Super Squat Press, Belt Squat, Glute Drive, Leg Extension, Leg Curl, Kneeling Leg Curl, Assisted Nordic Ham, Seated Calf Raise, Tibia Dorsi-Flexion, Glute Ham/Reverse Hyper | 1.25 kg per arm with fractional plates [49] |
| Cybex Eagle NX (selectorized) | Abdominal, Arm Curl, Arm Extension, Back Extension, Calf, Chest Press, Glute, Hip AB/AD, Lat Pulldown, Leg Curl, Leg Extension, Leg Press, Row, Overhead/Shoulder Press, Torso Rotation | 10 lb top plate + Twist-Select 0/5/10/15 lb [50][57] |
| Nautilus One / Inspiration (selectorized) | One: Leg Extension, Low Back, Abdominal Crunch, Rotary Torso, 4-Way Neck, Triceps Press, Lat Pulldown, Row, Chest Press, Shoulder Press, Biceps Curl, Leg Press, Hip Ab/Ad, Seated Leg Curl. Inspiration: Abdominal Crunch, Back Extension, Chest Press, Deltoid Raise, Pec Fly/Rear Deltoid, Biceps Curl, Bilateral Arm Curl, Vertical Row, Shoulder Press, Lat Pull Down, Tricep Dip, Abduction/Adduction, Glute Press, Rotary Torso, Pullover, Dual Adjustable Pulley, Leg Press | Inspiration: 10 lb increments, 5 lb add-on [51][57] |
| Precor Vitality (selectorized) | Chest Press, Shoulder Press, Multi-Press, Pulldown/Seated Row, Seated Row, Biceps Curl, Biceps Curl/Triceps Extension, Abdominal, Abdominal/Back Extension, Leg Extension | lever-engaged add-on weight (step not stated) [53] |
| Matrix Ultra / Versa (selectorized) | Versa Converging Chest Press, Versa Converging Shoulder Press, Versa Abdominal, Ultra Leg Press, Ultra Abdominal Crunch, Ultra Hip Abductor, Ultra Triceps Press | Versa 5 lb increment, 160/230 lb stacks; Ultra 2.5/5/7.5 lb add-on; Ultra Leg Press 20 lb steps [52] |

### 3.12 Evidence confidence

| Claim | Confidence | Why |
|---|---|---|
| Machines = free weights for hypertrophy and general strength | High | RCT + meta-analysis [1][2] |
| Overhead > pushdown for triceps long head; seated > prone leg curl; standing > seated calf for gastrocnemius | Moderate–high | single within-subject 12-week MRI trials each (n = 14–21) [23][28][29] |
| Incline curl vs preacher regional effects | Low–moderate | one RCT in women found regional differences [24], one within-subject trial found none [25] |
| 30° incline for upper pec | Moderate | acute EMG only [9] |
| EMG rankings (ACE, Youdas, Franke, Reinold, Escamilla) | Moderate for "which activates most", low for "which grows most" | acute surface EMG, small samples [15][16][18][19][22][32][33] |
| Rotary torso caution | Moderate (mechanistic) | porcine spine model [35]; no human RCT of the machine |
| Pallof press efficacy | Low | pilot EMG only; retained on mechanistic grounds |
| Strength standards | Moderate | large crowd-sourced samples but self-selected lifters [42]; model-based [43]; ExRx values unverified this session [44] |
| Stack increments | High for the lines cited, gym-specific otherwise | [45]–[53] |
| Colour-coding statements | Moderate | only low-quality sources describe Planet Fitness; absence of a scheme is a negative finding |

---
