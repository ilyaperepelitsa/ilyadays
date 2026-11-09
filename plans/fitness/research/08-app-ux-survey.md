# 08 — Workout-app UX survey: mobile logging patterns and a session-tracker spec

Research date: 2026-11-08. Scope: how Strong, Hevy, Fitbod, Boostcamp, Liftosaur, JEFIT, Alpha Progression, JuggernautAI, RP Hypertrophy, Caliber, Gravitus, Setgraph, Gymaholic, Apple Watch Workout and Garmin strength tracking lay out the "today" screen, log sets, run timers, generate warm-ups, swap exercises, model equipment, progress loads, chart progress and export data; what users complain about; and what a phone-first PWA tracker on ilyadays should implement. Store ratings and prices are as listed on the US App Store on the research date. Several vendor help centers (Hevy, Fitbod, RP) block automated fetches; where a fact comes from a search-engine excerpt of such a page rather than the page itself, the Sources entry says so.

---

## Summary

- Every mature tracker converged on the same session screen: one card per exercise, one row per set with **Previous | Target | Actual | ✓**, previous values prefilled, and a rest timer that auto-starts when a set is checked (Hevy, Strong, Boostcamp, Alpha Progression, Gravitus) [1][4][18][26][37]. Adopt it, and prefill *Actual = Target* so the common case is one tap.
- Tap budget to enforce in code: **1 tap** "did it as planned"; **2 taps** to change reps by ±1–2 or weight by one equipment step (field → chip in a bottom sheet that commits); **3+ taps** only for arbitrary values. Setgraph's swipe-to-repeat and Gymaholic's "mark sets complete with a single tap" are the existing benchmarks [38][39].
- Touch targets: ≥44×44 CSS px for everything on the set row (Apple default 44 pt, Android 48 dp, WCAG AAA 44 px; WCAG AA minimum is only 24 px), 56 px for the commit button, ≥8 px gaps, primary actions in the bottom third of the screen [53][55][57][51][52]. The watchOS 26 backlash ("touch targets are way too small", late-appearing play button) is the cautionary tale [41].
- Progression must explain itself. The loudest cross-app complaint after bugs is "why this weight?" (Fitbod too heavy/too light, JuggernautAI "really light", RP "why so many sets?") [17][30][33]. Show a reason code and one plain sentence next to every auto-progressed target, and persist manual overrides.
- Equipment is the backbone: a per-gym profile with machine list, stack increments, dumbbell range and bar/plates drives rounding, plate math, warm-up loads and the alternatives list (Alpha Progression and Fitbod patterns) [26][13][11]. Swaps are "today only" or "rest of block" (JuggernautAI) [29], plus a one-tap "machine busy → do later" reorder.
- Warm-up generation default: compounds cold 40/60/80 % × 8/5/3 of the first working set; machines/isolation one set at ~55 % × 8; already-warm muscle one set at 80 % × 3; never counted in volume or PRs [5][26][71][72].
- Session lifecycle: autosave every commit locally, outbox sync with idempotent set UUIDs; "still training?" prompt after 45 min without a set; **auto-close at 6 h** with end time = last set + its rest target; discards recoverable for 7 days. Hevy loses an active workout on uninstall and Boostcamp once deleted entries on a network error — both are avoidable [9][19].
- PWA reality on iPhone: Screen Wake Lock works (iOS 16.4+), the Vibration API does not exist on iOS Safari, Background Sync is Safari-less, Web Push needs a Home Screen install and a tap, JavaScript timers are suspended in the background, and Safari purges site storage after 7 days of non-use unless the app is installed [58][59][60][62][64][65][66]. Design timers from timestamps and nudge "Add to Home Screen".
- Analytics that matter for this owner: per-exercise e1RM (Epley, reps ≤10, RIR-adjusted, ±10 % error band), weekly fractional sets per muscle versus a target band as bars plus body heatmap (Boostcamp Muscle Tracker pattern), bodyweight EWMA trend (α = 0.1, interpolate gaps), and a weekly consistency count instead of daily streaks [67][68][18][75][77][78][79].
- Export one CSV row per set (plus full JSON) with targets, RIR, rest and gym, and make it round-trippable; Strong cannot re-import its own CSV and Hevy imports only Strong's format, which is exactly the lock-in to avoid [3][7].

---

## Publishable section

### What fifteen workout apps teach about logging a set

A workout tracker has one job during the session: make the three gym decisions cheap. What do I do now? Did I do it? What do I do next time? After going through the official docs, store listings and reviews of fifteen trackers, the striking thing is how much they agree, and how specific the remaining disagreements are.

**The session screen is a solved layout.** Hevy, Strong, Boostcamp, Alpha Progression and Gravitus all render one card per exercise and one row per set. When you add an exercise you have done before, "the previous sets, weight, and reps are pre-filled", a PREVIOUS column shows the last performance, and you "mark sets as completed to start the automatic rest timer" [4]. Hevy even lets you choose whether "previous" means the last time you did the exercise anywhere or only inside the current routine, which it calls more context-specific [5]. Alpha Progression goes a step further: every working set carries a recommended weight and reps (optionally RIR) computed from past sessions and the sets you just did, entered through a picker "showing likely values" rather than a keyboard [26]. Setgraph lets you "swipe to replicate previous sets" and fires a "Next Set Due" notification so you can repeat the last set without opening the app [38]; Gymaholic advertises "mark sets as complete with a single tap" [39]. The lesson for a new tracker is not to innovate here. Prefill the actual values with the planned ones so that the common case, "I did what the plan said", is a single tap, and spend the design effort on the uncommon cases.

**Rest timers belong to the set, not to a separate screen.** Every app that users praise starts the countdown the moment a set is checked ("integrated custom rest timers can begin to count down as soon as you finish entering the data", a Gravitus reviewer writes) [37]. Alpha Progression's timer keeps counting past zero so you can see how long you actually rested, allows per-exercise-type defaults and shows in the iOS Live Activity [26]; Boostcamp and Setgraph put the countdown on the Lock Screen [18][38]. The anti-pattern is instructive too: a Strong Apple Watch reviewer complains that the rest timer "is now just a tiny number instead of being the entire display" and can no longer be adjusted with the Crown [1]. Plate math should be equally ambient: Liftosaur prints the plates per side right next to the weight ("45/25/25/10 255lb") [22], Hevy puts a Calculator button above the keyboard [4], and Alpha Progression "will show the next lower achievable weight" when a target cannot be loaded [26].

**Warm-ups: generate them, but do not count them.** Hevy's warm-up calculator adds percentage-based sets with "weight plate and dumbbell rounding", and a separate setting controls whether warm-ups count toward volume and records [5]. Alpha Progression tailors the number of warm-up sets by exercise class (compound, medium, isolation) and by whether the muscle is cold or warm, with per-set percentages the user can edit (its examples are 35 % and 65 %), and states that "warm-up sets aren't tracked like normal working sets" [26]. Liftosaur expresses warm-ups relative to the first working set (`warmup: 1x5 45lb, 1x5 135lb, 1x3 80%`) [21]. The science supports a short ramp whose last set is heavy. In a crossover trial, 15 trained men did a single warm-up set at 40, 60 or 80 % of their 10RM; the 80 % condition produced more total training volume than 60 % (p = 0.010) and 40 % (p = 0.038), and the authors recommend warming up "at 80% of the initial workout load" [71]. A second 2024 trial found that neither a heavy (90 % 1RM × 3) nor a fast light conditioning set beat a standard warm-up for total squat volume, although the heavy set raised first-set volume load [72]. So: one to three ramp sets, the last near 80 % of the working load, and nothing heavier.

**Progression is where apps diverge and users get confused.** Liftosaur exposes the rules directly: `progress: lp(5lb, 2, 1, 10lb, 3)` for linear progression with failure counting, `dp(5lb, 8, 12)` for double progression inside a rep range, `sum(30, 5lb)` for a reps-sum rule, and custom scripts that read `completedReps` and write `weights` after the workout, with `increment()`/`roundWeight()` snapping to the user's plates [21][22]. Boostcamp's Pro tier "reads every set you log and sets your next weight and reps for you" [18]; Hevy Trainer raises the weight once you reach the top of the rep range on all sets [28]; Alpha Progression recommends per set and "does not assume that performance must improve every session" [26]. RP's app takes a different input entirely, asking how pumped, sore and "beat up from volume" you feel and using that to set future volume, and its help center notes that good pump, on-time soreness recovery and "pushing your limits" workload leave the recommendation unchanged [31][32]. JuggernautAI asks for a daily 1–5 readiness on motivation, sleep, calories and soreness and adjusts the day's loads; a reviewer watched it drop a third set after an RPE 10 second set [29]. The failure mode is the same everywhere: a number appears and the lifter does not trust it. Fitbod's help center admits its algorithm "starts conservatively" and tells users to lower sets, reps or weight if the workout feels too hard [15]; a roundup of Reddit threads is titled "Fitbod recommends dangerous weights" [17]; a JuggernautAI reviewer wrote "every session has my lifting really really really light" [30]; RP's FAQ has an entry called "Why is the app giving me so many sets?" [33]. Fitbod adds a second trap: any change (a logged workout, an equipment edit, a settings change) regenerates the recommendation "and your edits are replaced" [12]. A tracker that replaces a coach must therefore do what a coach does: say why. Every auto-progressed target should carry a reason ("all three sets hit 12 → +2.5 kg", "missed reps on two sets → hold") and a manual override should stick.

**Equipment is a first-class object.** Fitbod's whole generator runs off a gym profile: "your workouts only include exercises that match the equipment you have access to", one profile per place (home, gym, travel), now called Locations [13][16]; exercises can be replaced, excluded with "Don't Recommend Again", or weighted with Recommend More/Less [11]. Alpha Progression's gym profiles store weight ranges with increments ("1 kg steps up to 10 kg, then 2.5 kg steps") and bar-and-plate sets, so a 31.7 kg target is never proposed on a machine that jumps from 30 to 35 kg, and its replace flow lists "similar exercises" filtered to what the active gym supports [26]. Liftosaur substitutes by similar muscle activation [22]; JuggernautAI lets you swap "for a single day or an entire block" [29]; Boostcamp has Swap Exercise mid-program [18]. For someone who trains on machines in a commercial gym, the missing-machine case is the daily reality, so the swap sheet must be one tap away from the exercise card, filtered by the gym profile, ranked by muscle match, and must carry over a sensible starting load.

**Analytics: three charts earn their place.** All the trackers chart e1RM and volume; Hevy and JEFIT add weekly sets per muscle group [4][6][24], Boostcamp's Muscle Tracker shows "weekly sets per muscle as a body heatmap, radar or table" against the previous period [18], and Caliber frames balance as a percentage with a muscle heatmap [36]. Two caveats come from the literature. Estimated 1RM formulas (Epley w·(1+r/30), Brzycki w·36/(37−r)) agree at 10 reps and "greatly diverge after about 10 reps", with individual error of 10 % or more [67]; the RIR-based RPE scale lets you correct a non-failure set by adding reps in reserve (RPE 10 = 0 RIR, 9 = 1 RIR) [68], and the pooled repetitions-to-failure data put bench press at roughly 8.8 reps at 80 % 1RM with a between-person SD of about 2.5 reps [69]. A 2026 preprint fitted on 303,494 app-logged sets argues the conversion factor should depend on absolute load, improving internal consistency by 17–22 %, but it is not peer-reviewed and validated only against consistency, not measured maxes [70]. For bodyweight, the Hacker's Diet exponentially smoothed trend (new trend = old trend + 0.1 × (today − old trend)) [75][76] is the same device MacroFactor uses, with linear interpolation across missed days [77].

**What people complain about.** Reading the one- and two-star reviews across apps gives a tight list. Small or slow primary controls: watchOS 26 replaced large tiles with a list and a play button that "loads late", and users "have to tap the play button several times" [41]; a Setgraph user wishes "the add a set button was bigger and not in the bottom right corner" [38]. Extra friction on entry: JEFIT "inputting your weight and reps has become more convoluted" and "the set counters were removed" [24]; a Hevy user has to scroll year by year to edit a date [6]. Data loss: Boostcamp would "throw a network error and delete the information I just entered" until offline mode shipped [19]; Hevy warns that an unsaved active workout "will be lost" on uninstall [9]; Setgraph has no backup restore and Gymaholic's export "is gone now with iCloud sync" [38][39]. Opaque or wrong progression, covered above. Lock-in: Fitbod will not let you "navigate the rest of the very limited app" during a workout [14]. Unit bugs: Gymaholic weights "will not get actually converted" and Caliber "recalculates random sets" between kg and lb [39][36]. Watch friction: JEFIT's timer "will freeze so you have to keep tapping", Gymaholic cannot edit the last set from the wrist [24][39].

**One-handed ergonomics have evidence, with caveats.** Hoober's 1,333 street observations found 49 % of people touching a phone one-handed, 36 % cradling and 15 % two-handed, with the right thumb used two-thirds of the time; he also warned that grips change every few seconds and later called his reach drawings inaccurate, noting people touch the center more than the edges [51]. The practical rules survive that correction: put core actions where a thumb rests, at the bottom, use bottom sheets instead of full-screen pickers, keep at most five bottom tabs, and avoid the top-right corner for frequent actions [52]. Apple's HIG sets a 44×44 pt default control size with 28 pt as the absolute minimum and recommends about 12 pt of padding around bezelled controls [53]; Android asks for 48×48 dp (about 9 mm) separated by 8 dp [55]; WCAG 2.2 requires only 24×24 CSS px at level AA but 44×44 at AAA [57]. On haptics both platforms say the same thing: short, consistent, paired with a visual, and switchable off; Android explicitly prefers "no haptics" over buzzy ones and sizes a key-click at 10–20 ms [54][56].

**The web platform sets hard limits for a PWA.** Screen Wake Lock is available in Safari on iOS since 16.4 and in 96 % of browsers globally, so the screen can stay on during a session [58][59]. The Vibration API is not implemented in any Safari version [60][61], so haptics are an Android-only enhancement. Background Sync has no Safari support, so writes must go to an IndexedDB outbox that replays on reconnect, on visibility change and on service-worker start, with idempotent requests [62][63]. Web Push on iOS exists only for web apps added to the Home Screen and only after a user gesture [64]; there are no local notifications, and background JavaScript is suspended quickly, so a rest timer must be computed from an end timestamp, not a tick count [66]. Finally, Safari deletes a site's IndexedDB, LocalStorage and service-worker registrations after seven days of Safari use without visiting the site, an exemption applying to Home Screen web apps [65]. Liftosaur, itself a PWA, notes that rest-timer push notifications work only in its native builds [22]. The implication is clear: nudge installation, persist locally first, sync second.

**Ending a session is a design problem too.** Apple Watch taps your wrist when it senses the workout has stopped, but the workout "continues until you choose to end or pause" [43], and forgotten sessions produce records such as "1h 38m" for an 11-minute workout that cannot be edited [44]. Hevy's answer is a Discard button [10]; Garmin's strength flow ends each set explicitly and lets you edit reps during the rest [45][46]. A tracker should prompt after a long silence, auto-close after a hard limit with a sensible end time, and keep the data.

**Streaks: weekly, repairable, honest.** Hevy counts a weekly streak and lets you "enter a past workout for that week" to recover it [8]; Alpha Progression lets the user set a streak target of 1 to 7 workouts per week [26]; Boostcamp reports a week streak in its weekly recap [18]. The evidence for gamification is modest: in the 602-person STEP UP trial, points-and-levels designs added 637–920 steps per day during 24 weeks, activity fell in every arm afterwards and only the competition arm stayed above control [78]; a 2025 randomized trial found a skill-progression system did not improve adherence at all [79]. For a lifter who trains three days a week and is content for progress to take years, the honest metric is "weeks on plan", not consecutive days.

---

## Decision rules / parameters

### A. Prioritized feature list

| Priority | Feature | Rule / spec | Precedent |
|---|---|---|---|
| P0 | Session screen (cards + set rows) | Columns: set badge, Previous (ghost), Target, Actual weight, Actual reps, optional RIR, ✓. Actual prefilled with Target. | Hevy, Strong, Alpha [4][1][26] |
| P0 | 1-tap commit | ✓ (56×56 px) logs the set as planned, persists, starts rest. Swipe-right on row is an alias, never the only path. | Gymaholic, Setgraph [39][38] |
| P0 | 2-tap adjust | Tap weight/reps → bottom sheet in thumb zone; reps chips commit on tap; weight chips update then ✓. | Alpha picker [26] |
| P0 | Rest timer | Auto-start on commit; defaults by exercise class; ±30 s; continues past zero; timestamp-based; logs actual rest. | Alpha, Boostcamp [26][18] |
| P0 | Previous-performance ghost values | Source order: same program slot → same exercise anywhere. Show "60 × 10 @2". | Hevy setting [5] |
| P0 | Warm-up generation | Table F; warm-ups tagged W, excluded from volume/PRs, collapsible, 1 tap each. | Hevy, Alpha [5][26] |
| P0 | Progression engine with reasons | Rule types (Table K); reason code + sentence at finish and on next-session card; overrides persist. | Liftosaur, Boostcamp [21][18]; complaints [17][30][33] |
| P0 | Equipment profile (one gym) | Machines, stack increments, dumbbell range, bar + plates; drives rounding, plate string, alternatives. | Alpha, Fitbod [26][13] |
| P0 | Exercise swap with equipment filter | Sheet from card header; filtered to active gym; ranked; "today" vs "rest of block"; "do later" reorder. | Alpha, Fitbod, JuggernautAI [26][11][29] |
| P0 | Autosave + offline outbox | Persist on every commit to IndexedDB; idempotent sync; status dot. | Boostcamp lesson [19]; MDN/Workbox [62][63] |
| P0 | Timeout handling | 45-min inactivity prompt; 6-h auto-close; resume rule; discard recoverable. | Apple reminder, Hevy discard [43][10] |
| P0 | Finish summary + next-session preview | Sets done, volume, PRs, e1RM delta, per-exercise next targets with reasons. | Hevy finish, Alpha [4][26] |
| P0 | Export | CSV per set + JSON; round-trip import; Strong-compatible CSV option. | Strong/Hevy gaps [3][7] |
| P0 | Charts: e1RM per exercise, weekly sets per muscle vs band | Rules in Table L. | Hevy, Boostcamp [4][18] |
| P1 | Inline plate string | "20 | 10 | 2.5 per side" next to barbell weights; next-lower achievable when unloadable. | Liftosaur, Alpha [22][26] |
| P1 | Multiple gym profiles | Select at Start; default last used. | Fitbod Locations, Alpha [16][26] |
| P1 | RIR picker | Chips 0–4; default prompt only on last working set per exercise; drives rir_autoregulated rule. | Boostcamp RPE 6–10 with RIR hint [18]; Helms [68] |
| P1 | Pinned exercise notes | Note shown on card header every time the exercise appears. | Hevy pinned notes [6] |
| P1 | Bodyweight trend | EWMA α = 0.1 with gap interpolation; weekly rate after 14 days. | Hacker's Diet, MacroFactor [75][77] |
| P1 | Calendar + weekly consistency | Planned vs done; week complete at plan frequency; repair by logging past session. | Hevy weekly streak [8] |
| P1 | Wake Lock + haptics | Wake lock during active session; vibrate patterns on Android; toggle. | MDN, caniuse, HIG [58][60][54] |
| P1 | Exercise history sheet | Tap exercise name → last 5 sessions + e1RM sparkline. | Caliber "see last workout while logging" [36] |
| P1 | Supersets | Pair exercises; commit on A focuses B (Smart Superset Scrolling). | Hevy [5] |
| P2 | Body heatmap of weekly sets | Secondary view of the same data as the bars. | Boostcamp, Caliber [18][36] |
| P2 | Readiness check-in | Optional 1–5 (sleep, soreness, motivation); adjusts today's targets ±1 step; never silently. | JuggernautAI [29] |
| P2 | Session-end recovery feedback | Soreness-recovery and performance 1–4 → set-count progression (Table K). | RP [31][35] |
| P2 | Web Push rest alerts | Only when installed; server schedules at rest end_at. | WebKit [64] |
| Never | Social feed, photos as proof, daily streaks, ads | Out of scope for a single-user coach replacement. | Evidence on streaks [78][79] |

### B. Session screen layout (portrait phone, 360–430 px wide)

| Zone | Height | Content | Rules |
|---|---|---|---|
| Header (top) | 56 px | Session name, elapsed time, sync-status dot, overflow "…" (Finish, Discard, Notes) | Read-mostly. No frequent-tap controls in the top-right [52]. |
| Body (scroll) | flexible | Exercise cards; the focused card expanded, others collapsed with "2/3 sets" | Autoscroll the next pending set to just above the bottom bar after each commit (user-switchable). |
| Set row | ≥56 px | `#` badge (W/1/2/3/D/F) · Previous ghost · weight · reps · [RIR] · ✓ | ✓ 56×56 px on the thumb side (right by default, switchable to left; Hoober: right thumb 67 % of one-handed use [51]). Every tappable ≥44×44 px, ≥8 px apart [53][55]. |
| Adjust sheet | ≤40 % viewport | Mirrors the row; chips row; stepper −/+ (48×48 px); numeric keypad (`inputmode="decimal"`) | Reps chip tap commits the set; weight chip updates field; ✓ in the sheet commits. Sheet dismisses on commit. |
| Bottom bar (sticky) | 64 px + safe-area | Rest countdown (large), [−30 s] [Skip] [+30 s]; when no timer: [Finish] | Always within the thumb zone; never overlaps ✓ of the focused row. |

Implementation notes: inputs ≥16 px font to avoid Safari focus zoom (platform behaviour, not a cited guideline); destructive actions only behind the overflow menu plus a confirm sheet; show the plate string under barbell weights; the focused set is visually distinct so the ✓ target is unambiguous.

### C. Tap budget (hard requirements for the implementation)

| Action | Taps | Path |
|---|---|---|
| Log set exactly as planned | 1 | ✓ |
| Log set with reps ±1–2 | 2 | reps → chip (commits) |
| Log set with weight ±1 equipment step | 2 | weight → chip (updates) → ✓ … counts 3 if reps also change; 2 if the chip row includes "commit with target reps" (enable this: chip long-press = commit) |
| Log arbitrary weight/reps | 3–4 | field → keypad → ✓ |
| Change RIR on the prompted set | +1 | RIR chip |
| Skip or extend rest | 1 | bottom bar |
| Swap exercise (today) | 3 | ⇄ → alternative → "Today" |
| Move exercise to end ("machine busy") | 2 | ⇄ → "Do later" |
| Finish session | 2 | Finish → Save |

### D. Set row states

| State | Visual | Allowed actions |
|---|---|---|
| pending | Target shown in Actual fields (muted), ghost Previous above | ✓, tap field, swipe-right |
| focused | Highlight + plate string + rest preview | same as pending |
| editing | Sheet open, row pinned above sheet | chips, stepper, keypad, ✓, cancel |
| done | Actual bold, ✓ filled, RIR badge, rest actual logged | tap to re-open (edits allowed, re-run progression at finish) |
| skipped | Struck through, "skipped" badge | tap to un-skip (only before finish) |

### E. Rest timer rules

| Parameter | Default | Note |
|---|---|---|
| Compound (press, row, pulldown, machine squat/leg press when added) | 150 s | Helms recommends 3–5 min for strength work; hypertrophy rest "should not be restricted" [68]. 150 s balances a 60–75 min session. |
| Machine isolation / cables | 90 s | |
| Abs (loaded) | 75 s | |
| Warm-up sets | 60 s | |
| Adjust step | ±30 s | RP reviewer explicitly asks for 30-s increments [34] |
| Past-zero display | continue, cap +10 min | Alpha pattern [26] |
| Alert | Flash + optional chime (audio unlocked on Start); Android vibrate [100,60,100]; iOS web: no vibration [60] | |
| Computation | `end_at = commit_at + rest_s`; re-render from `Date.now()` on `visibilitychange`; fire alert only if `now − end_at < 60 s` | background JS suspended [66] |
| Logging | `rest_actual_s = next_commit_at − commit_at` stored on the following set | Strong records rest breaks [1] |

### F. Warm-up generation algorithm

Inputs: first working-set weight `W1`, target reps, exercise class (compound / machine-isolation / bodyweight), whether the primary muscle is already "warm" (worked earlier this session), equipment profile (increment, minimum load, bar weight).

| Case | Sets (pct of W1 × reps) | Evidence / precedent |
|---|---|---|
| Compound, cold | 40 % × 8, 60 % × 5, 80 % × 3 | Last set near 80 % of working load improved total volume vs 40/60 % [71]; heavier than working load adds nothing [72]; Alpha's configurable percentages [26] |
| Compound, warm | 80 % × 3 | |
| Machine/isolation, cold | 55 % × 8 | Alpha uses fewer sets for isolation [26] |
| Machine/isolation, warm | none | |
| Bodyweight/assisted | 1 set at 50 % of target reps | |

Rounding: round **down** to the equipment increment; drop any set below the minimum load (empty bar for barbells, lightest stack plate for machines); if two sets round to the same load, merge them. Warm-ups are rows tagged W, committed with 1 tap, excluded from volume, e1RM and PRs (Hevy's "Warm Up Sets" stats toggle [5]). A per-session "skip warm-ups" toggle exists for the second half of a session.

### G. Session state machine

```
idle ──start──▶ active ◀──timer elapsed / skip── resting
                 │  ▲                                ▲
       tap field │  │ cancel                          │ commit (✓ or reps chip)
                 ▼  │                                 │
             set_editing ─────────────────────────────┘
                 │
 active|resting ─┼── tap Finish / last set done ──▶ finishing ──save──▶ finished
                 │                                     │ back ▲
                 ├── 45 min no set event ──▶ prompt {continue | finish | discard}
                 ├── 6 h no set event ─────▶ auto_closed
                 └── discard + confirm ─────▶ discarded (soft, 7-day undo)
```

| State | Entry effects | Exit / guards |
|---|---|---|
| idle | Home shows "Next session" card: exercises, est. duration = Σ sets × (40 s + rest), gym selector, big Start in bottom zone | Start creates `session{uuid, gym_profile_id, started_at}` and persists before navigation; acquire Wake Lock [58] |
| active | Focus first pending set; header timer running | — |
| set_editing | Sheet open; row pinned | Commit → resting; cancel → active |
| resting | `rest.end_at` set; bottom bar shows countdown; next pending set focused | Elapsed/skip → active; tapping a field during rest → set_editing (timer continues) |
| finishing | Summary: sets, volume, PRs, e1RM deltas, per-exercise next targets + reasons, notes field | Save → finished; Back → active |
| finished | `ended_at = now`; progression committed; Wake Lock released; outbox flush | Editable later (targets recomputed on edit) |
| auto_closed | `ended_at = last_set_at + last rest target (fallback 90 s)`; unlogged sets → skipped; progression evaluated only for exercises with ≥1 working set; `auto_closed = true`; banner offers "edit end time" | Precedent: Apple's reminder-but-never-auto-end leaves wrong durations [43][44] |
| discarded | Soft delete, hidden, restorable 7 days | Hevy's hard discard is the anti-pattern when accidental [10] |

Resume rule: on app open, if an active session has `last_set_at` (or `started_at`) less than 6 h ago, open it at the first pending set; otherwise apply auto_close, then show Home with the banner. Navigation elsewhere in the app during an active session is allowed; a persistent "Session in progress · 42:10" pill returns to it (contrast Fitbod's lock-out complaint [14]).

### H. Next-session targets: what to show

| Field | Example | Source of truth |
|---|---|---|
| Exercise + equipment | Chest press (machine) | plan slot |
| Prescription | 3 × 8–12 @ 62.5 kg, RIR 2 | progression engine |
| Delta vs last | +2.5 kg · reps reset to 8 | computed |
| Reason code + sentence | `HIT_TOP_RANGE_ALL_SETS` → "You hit 12 on all three sets, so the weight goes up one step." | engine |
| Basis | "based on 4 sessions; e1RM 84 kg (+3 %)" | history |
| Override | tap → edit weight/reps; stores `manual_override=true`, shown as a pencil badge; never overwritten by regeneration | user |

Reason codes: `HIT_TOP_RANGE_ALL_SETS`, `HIT_TOP_RANGE_SOME`, `MISSED_REPS_HOLD`, `THIRD_MISS_DELOAD`, `FIRST_EXPOSURE_CALIBRATE`, `SWAPPED_EXERCISE`, `RETURN_AFTER_GAP`, `DELOAD_WEEK`, `MANUAL_OVERRIDE`, `AUTO_CLOSED_INSUFFICIENT_DATA`. Rules: a skipped session keeps targets unchanged; after a gap of ≥14 days since the last exposure to an exercise, show `RETURN_AFTER_GAP` with load × 0.9 (practical default, judgment-based); targets are shown at the finish screen, on the Home "Next session" card and in each exercise card header (Liftosaur updates the program after the workout [21]; Alpha recommends per set [26]).

### I. Alternatives when a machine is missing or busy

1. Entry: ⇄ icon on the exercise card header → bottom sheet titled "Replace {exercise}".
2. Default filter: equipment available in the active gym profile (Alpha filters to the active gym [26]; Fitbod only generates matching equipment [13]). Chips: Available here · Machine · Cable · Dumbbell · Barbell · Bodyweight.
3. Ranking score = 3·same primary muscle + 2·same movement pattern + 1·secondary-muscle overlap + 1·same equipment class + 1·has history. Show top 5 (Liftosaur substitutes by similar muscle activation [22]).
4. Each alternative shows: name, equipment, match quality (primary/secondary), last performance on it or "no history", and a suggested start. With history: the engine's current target for that exercise. Without history: "calibration set" — first working set at RIR 3–4, no progression judgment this session (`FIRST_EXPOSURE_CALIBRATE`).
5. Scope buttons: "Today only" or "Rest of block" (JuggernautAI distinguishes a day from a block [29]). "Today only" leaves the plan slot untouched and logs the swap on the session; "Rest of block" rewrites the slot and tags `SWAPPED_EXERCISE`.
6. "Do later" (1 tap) moves the exercise to the end of the session for a busy machine.
7. After two "today only" swaps of the same slot within a block, offer "make this permanent".
8. Never auto-regenerate the session on an equipment change; only the swapped slot changes (Fitbod's refresh wiping edits is the anti-pattern [12]).

### J. Equipment profile schema (defaults)

| Field | Default | Note |
|---|---|---|
| machines[] | from the owner's gym list, each with `increment_kg` | stack step is usually 5 kg; add-on magnets 1.25/2.5 kg if present |
| machine_stack_increment_kg | 5 | per-machine override |
| add_on_magnet_kg | 2.5 | |
| dumbbell_range_kg / increment | 2–40 / 2.0 | |
| barbell_kg, plates_kg | 20; [25,20,15,10,5,2.5,1.25] | plate string uses greedy per-side packing |
| fixed_bars_kg[] | [] | |
| assist_machines[] | [] | assisted pull-up/dip: weight stored as assistance, bodyweight-minus logic (Liftosaur `bodyweight − weight` pattern [21]) |
| active profile | last used | choose at Start if >1 |

### K. Progression rule types (settings exposed per exercise, plain-language preview under each)

| Type | Parameters | Trigger / effect |
|---|---|---|
| double_progression | rep_range [8,12], increment = equipment step | All working sets ≥ top → +1 step, reps reset to bottom (Liftosaur `dp` [21]; Hevy Trainer [28]) |
| linear_with_deload | increment, fail_limit 3, deload 0.9 | Hit → +1 step; miss → failures+1; 3 misses → ×0.9, reset (StrongLifts rule in Liftosaur README [22]) |
| rir_autoregulated | target_rir 2 | Last-set RIR ≥ target+2 → +1 step; RIR ≤ target−1 on ≥2 sets → hold; reps missed on ≥2 sets → −1 step (RIR scale per Helms [68]) |
| set_progression_by_recovery | soreness-recovery 1–4, performance 1–4 | both 1 → +2 sets; any 2 → +1; any 3 → hold; performance 4 → deload to maintenance volume (RP rules [35]) |

Preview text pattern: "If you hit 3×12 at 50 kg, next time: 3×8 at 52.5 kg."

### L. Analytics rules

| Chart | Rule |
|---|---|
| e1RM per exercise | Epley `w·(1+r/30)` default, Brzycki optional (Setgraph offers a selectable formula [38]); use only working sets with reps ≤ 10 [67]; `effective_reps = reps + RIR`, skip if > 12 [68]; session value = max over sets; plot per-session points + 28-day median; show a ±10 % band and label it "estimate" [67]. |
| Weekly sets per muscle | Count working sets only; direct 1.0, indirect 0.5 (fractional counting had the strongest support in the dose-response meta-regression [74]); stacked bars per week vs target band; defaults until the volume research overrides: primary muscles 10–20, arms direct 6–12, abs 6–12 (dose-response: ~0.37 % extra hypertrophy per weekly set with diminishing returns [73][74]; RP: maintenance ≈ 6 sets, triceps MRV 18 direct [35]). Heatmap/table views are secondary (Boostcamp [18]). |
| Bodyweight | `trend_t = trend_{t−1} + 0.1·(w_t − trend_{t−1})`, first trend = first weight [75]; α 0.1 ≈ 20-day SMA lag [76]; linear interpolation for missed days [77]; show scale dots, trend line, 7-day rate after ≥14 days of data. |
| Consistency | Weeks on plan (sessions ≥ plan frequency) out of last 13; "maintained" at ≥2 sessions; repair by logging a past session (Hevy [8]); no daily streaks [78][79]. |

### M. Export schema

CSV, one row per set, UTF-8, ISO-8601 timestamps with offset, kg only:

`date_iso, session_id, session_name, gym, exercise, exercise_id, equipment, set_index, set_type, target_weight_kg, target_reps_min, target_reps_max, target_rir, weight_kg, reps, rir, e1rm_kg, rest_target_s, rest_actual_s, notes, flags`

Also: full JSON export (sessions, plans, equipment profiles, overrides) that re-imports losslessly, and a "Strong-compatible CSV" (`Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE` [3]) because Hevy imports only that format [7] and Strong cannot re-import its own [3].

### N. Offline, autosave and sync

| Rule | Detail |
|---|---|
| Persist on every commit | IndexedDB write before UI confirms (✓ fills only after the local write resolves) |
| Outbox | Each set carries a UUID used as idempotency key; flush on `online`, `visibilitychange` → visible, service-worker startup, and every 30 s while a session is active; Background Sync registration when available [62][63] |
| Retention | Retry up to 24 h, then surface "not synced" with manual retry |
| Conflicts | Last writer wins per set; sessions merge by set UUID |
| Install nudge | After the 2nd finished session: "Add to Home Screen" (avoids the 7-day storage purge, enables Web Push) [65][64] |
| Status | Header dot: saved locally / synced / retrying; never a blocking spinner |

### O. Touch, haptics, accessibility

| Rule | Value / source |
|---|---|
| Minimum tappable | 44×44 CSS px (Apple default 44 pt [53]; WCAG AAA 44 px [57]); 48 px for steppers (Android 48 dp [55]) |
| Spacing | ≥8 px between targets [55]; ~12 px padding around bezelled controls [53] |
| Primary actions | Bottom third; bottom sheets instead of full-screen pickers; ≤5 bottom tabs [52] |
| Gesture alternatives | Every swipe has a button [53] |
| Haptics | Android `navigator.vibrate`: set_done [15], set_adjusted [8], rest_end [100,60,100], PR [30,40,30,40,80]; iOS web: none available [60]; always paired with a visual; user toggle [54][56] |
| Wake Lock | Request on Start, re-request on visibility, release on finish [58] |
| Units | Store kg; display conversion only; never rewrite stored values on unit toggle (Gymaholic/Caliber bugs [39][36]) |

### JSON: `ux_patterns`

```json ux_patterns
{
  "ux_patterns": {
    "version": "2026-11-08",
    "scope": "mobile-first session tracker for the ilyadays fitness section (PWA, phone-first, one-handed)",
    "tap_budget": {
      "log_set_as_planned": 1,
      "adjust_reps_by_1_to_2_then_log": 2,
      "adjust_weight_one_step_then_log": 2,
      "arbitrary_value_then_log": 3,
      "swap_exercise_today": 3,
      "move_exercise_to_end": 2,
      "finish_session": 2
    },
    "touch_targets": {
      "min_css_px": 44,
      "commit_button_css_px": 56,
      "stepper_button_css_px": 48,
      "min_gap_css_px": 8,
      "set_row_min_height_css_px": 56,
      "bottom_action_bar_height_css_px": 64,
      "input_font_size_min_css_px": 16,
      "standards": {
        "apple_hig_default_pt": 44,
        "apple_hig_minimum_pt": 28,
        "android_dp": 48,
        "android_gap_dp": 8,
        "wcag_2_5_8_aa_px": 24,
        "wcag_2_5_5_aaa_px": 44
      }
    },
    "layout": {
      "primary_actions_zone": "bottom third of viewport; sticky bar above env(safe-area-inset-bottom)",
      "commit_column_side_default": "right",
      "commit_column_side_switchable": true,
      "destructive_actions": "overflow menu plus confirm sheet; never adjacent to commit",
      "max_bottom_tabs": 5,
      "autoscroll_to_next_pending_set": true,
      "screen_wake_lock_during_session": true,
      "allow_navigation_during_session": true,
      "session_in_progress_pill": true
    },
    "set_row": {
      "columns": ["set_badge", "previous_ghost", "target", "actual_weight", "actual_reps", "optional_rir", "commit"],
      "prefill_actual_with_target": true,
      "previous_source_order": ["same_program_slot", "same_exercise_any_session"],
      "set_types": ["warmup", "working", "amrap", "dropset", "failure"],
      "warmups_count_toward_volume_and_prs": false,
      "gesture_alias": "swipe right on row logs as planned; button remains primary",
      "adjust_sheet": {
        "anchor": "bottom sheet in thumb zone, mirrors the row",
        "reps_chips": ["target-2", "target-1", "target", "target+1", "amrap"],
        "reps_chip_tap_commits_set": true,
        "weight_chips": ["previous", "target-1step", "target", "target+1step"],
        "weight_chip_tap_commits_set": false,
        "weight_chip_long_press_commits_with_target_reps": true,
        "stepper_increment_source": "equipment_profile.increment_for_exercise",
        "numeric_keypad": "inputmode=decimal fallback"
      },
      "rir_prompt": {
        "default_scope": "last_working_set_per_exercise",
        "scale": [0, 1, 2, 3, 4],
        "rpe_equivalent": [10, 9, 8, 7, 6]
      }
    },
    "rest_timer": {
      "auto_start_on_commit": true,
      "defaults_s": {"compound": 150, "machine_or_isolation": 90, "abs": 75, "warmup": 60},
      "adjust_step_s": 30,
      "continue_past_zero": true,
      "overrun_display_cap_s": 600,
      "timestamp_based": true,
      "stale_alert_suppression_s": 60,
      "alert": {
        "foreground": "flash plus optional chime (audio unlocked on Start)",
        "android": "vibrate [100,60,100]",
        "ios_web": "no vibration API; visual and sound only",
        "background": "Web Push optional, installed PWA only"
      },
      "log_actual_rest": true
    },
    "warmup_generation": {
      "compound_cold": [
        {"pct_of_first_working_set": 0.40, "reps": 8},
        {"pct_of_first_working_set": 0.60, "reps": 5},
        {"pct_of_first_working_set": 0.80, "reps": 3}
      ],
      "compound_warm": [{"pct_of_first_working_set": 0.80, "reps": 3}],
      "isolation_or_machine_cold": [{"pct_of_first_working_set": 0.55, "reps": 8}],
      "isolation_or_machine_warm": [],
      "bodyweight": [{"pct_of_target_reps": 0.5, "sets": 1}],
      "rounding": "round down to equipment increment; drop sets below minimum load; merge duplicates",
      "warm_definition": "same primary muscle already worked this session",
      "user_toggle_skip_all": true
    },
    "session_state_machine": {
      "states": ["idle", "active", "set_editing", "resting", "finishing", "finished", "auto_closed", "discarded"],
      "transitions": [
        {"from": "idle", "to": "active", "on": "tap_start", "effects": ["create session uuid/gym/started_at", "persist locally", "acquire wake lock"]},
        {"from": "active", "to": "set_editing", "on": "tap_set_field"},
        {"from": "set_editing", "to": "active", "on": "cancel"},
        {"from": "set_editing", "to": "resting", "on": "commit", "effects": ["set.status=done", "persist", "rest.end_at=now+rest_s", "focus next pending set"]},
        {"from": "active", "to": "resting", "on": "tap_commit", "effects": ["set.status=done", "persist", "rest.end_at=now+rest_s", "focus next pending set"]},
        {"from": "resting", "to": "active", "on": "timer_elapsed_or_skip"},
        {"from": "resting", "to": "set_editing", "on": "tap_set_field", "note": "timer keeps running"},
        {"from": "active|resting", "to": "finishing", "on": "tap_finish_or_last_set_done"},
        {"from": "finishing", "to": "active", "on": "tap_back"},
        {"from": "finishing", "to": "finished", "on": "tap_save", "effects": ["ended_at=now", "run progression", "show next-session preview", "release wake lock", "flush outbox"]},
        {"from": "active|resting|set_editing", "to": "auto_closed", "on": "no_set_event_for_6h", "effects": ["ended_at=last_set_at+last_rest_target or +90s", "unlogged sets=skipped", "progression only for exercises with >=1 working set", "flag auto_closed", "offer edit end time"]},
        {"from": "active|resting|set_editing|finishing", "to": "discarded", "on": "tap_discard_confirm", "effects": ["soft delete, restorable 7 days"]}
      ],
      "timeouts": {
        "inactivity_prompt_min": 45,
        "inactivity_prompt_options": ["continue", "finish", "discard"],
        "auto_close_h": 6
      },
      "resume_rule": "on app open: active session with last event < 6h ago opens at first pending set; otherwise auto_close then home with banner"
    },
    "next_session_targets": {
      "shown_at": ["finish_summary", "home_next_session_card", "exercise_card_header"],
      "fields": ["exercise", "equipment", "sets", "rep_range", "weight", "rir_target", "delta_vs_last", "reason_code", "reason_text", "basis", "override_affordance"],
      "reason_codes": ["HIT_TOP_RANGE_ALL_SETS", "HIT_TOP_RANGE_SOME", "MISSED_REPS_HOLD", "THIRD_MISS_DELOAD", "FIRST_EXPOSURE_CALIBRATE", "SWAPPED_EXERCISE", "RETURN_AFTER_GAP", "DELOAD_WEEK", "MANUAL_OVERRIDE", "AUTO_CLOSED_INSUFFICIENT_DATA"],
      "override_persists": true,
      "skipped_session_keeps_targets": true,
      "return_after_gap_days": 14,
      "return_after_gap_load_factor": 0.9
    },
    "exercise_swap": {
      "entry": "card header swap icon opens bottom sheet",
      "filter_default": "equipment available in active gym profile",
      "filter_chips": ["available_here", "machine", "cable", "dumbbell", "barbell", "bodyweight"],
      "ranking_weights": {"same_primary_muscle": 3, "same_movement_pattern": 2, "secondary_muscle_overlap": 1, "same_equipment_class": 1, "has_history": 1},
      "show_top_n": 5,
      "per_alternative_fields": ["name", "equipment", "match_quality", "last_performance_or_none", "suggested_start"],
      "scope_options": ["today_only", "rest_of_block"],
      "do_later_option": "move exercise to end of session in one tap",
      "first_exposure_rule": "no history: first working set is a calibration set at RIR 3-4; progression judgment suppressed for that session",
      "suggest_permanent_after_today_only_swaps": 2,
      "never_regenerate_whole_session_on_equipment_change": true
    },
    "equipment_profile": {
      "fields": ["name", "machines[]", "machine_stack_increment_kg", "add_on_magnet_kg", "dumbbell_range_kg", "dumbbell_increment_kg", "barbell_kg", "plates_kg[]", "fixed_bars_kg[]", "assist_machines[]", "per_exercise_increment_overrides"],
      "defaults": {
        "machine_stack_increment_kg": 5,
        "add_on_magnet_kg": 2.5,
        "dumbbell_range_kg": [2, 40],
        "dumbbell_increment_kg": 2.0,
        "barbell_kg": 20,
        "plates_kg": [25, 20, 15, 10, 5, 2.5, 1.25]
      },
      "active_profile_selection": "at session start; default last used",
      "plate_math_display": "inline plates-per-side string next to barbell weights; show next lower achievable load when target is unloadable",
      "store_unit": "kg",
      "convert_on_display_only": true
    },
    "progression_rules": {
      "types": ["double_progression", "linear_with_deload", "rir_autoregulated", "set_progression_by_recovery"],
      "double_progression": {"rep_range": [8, 12], "trigger": "all working sets >= top of range", "increment": "equipment step", "reps_reset_to": "bottom of range"},
      "linear_with_deload": {"increment": "equipment step", "fail_limit": 3, "deload_factor": 0.9},
      "rir_autoregulated": {"target_rir": 2, "increase_if_last_set_rir_at_least": 4, "hold_if_rir_at_most_on_sets": {"rir": 1, "sets": 2}, "decrease_if_reps_missed_on_sets": 2},
      "set_progression_by_recovery": {"inputs": ["soreness_recovery_1_4", "performance_1_4"], "both_1": "+2 sets", "any_2": "+1 set", "any_3": "hold", "performance_4": "deload to maintenance volume"},
      "preview_text_pattern": "If you hit {sets}x{top} at {w}, next time: {sets}x{bottom} at {w_next}."
    },
    "analytics": {
      "e1rm": {
        "formula_default": "epley",
        "alternatives": ["brzycki"],
        "valid_reps_max": 10,
        "rir_adjust": "effective_reps = reps + rir; skip if effective_reps > 12",
        "per_session": "max over working sets",
        "smoothing": "28-day median overlay",
        "expected_error_pct": 10
      },
      "weekly_volume": {
        "counting": {"direct": 1.0, "indirect": 0.5, "warmup": 0},
        "default_band_sets_per_week": {"primary_muscles": [10, 20], "arms_direct": [6, 12], "abs": [6, 12]},
        "views": ["stacked_weekly_bars_vs_band", "body_heatmap", "table_vs_previous_period"],
        "band_override_source": "volume/progression research docs"
      },
      "bodyweight_trend": {"method": "ewma", "alpha": 0.1, "first_trend": "first weight", "gap_fill": "linear_interpolation", "show_rate_after_days": 14, "rate_window_days": 7}
    },
    "calendar_and_streaks": {
      "unit": "week",
      "week_complete_if_sessions_at_least": "plan_frequency",
      "default_plan_frequency": 3,
      "week_maintained_if_sessions_at_least": 2,
      "repair": "logging a past session repairs the week",
      "daily_streaks": false,
      "display": "weeks on plan: N of last 13"
    },
    "export": {
      "formats": ["csv_per_set", "json_full"],
      "csv_columns": ["date_iso", "session_id", "session_name", "gym", "exercise", "exercise_id", "equipment", "set_index", "set_type", "target_weight_kg", "target_reps_min", "target_reps_max", "target_rir", "weight_kg", "reps", "rir", "e1rm_kg", "rest_target_s", "rest_actual_s", "notes", "flags"],
      "round_trip_import": true,
      "strong_compatible_csv_columns": ["Date", "Workout Name", "Duration", "Exercise Name", "Set Order", "Weight", "Reps", "Distance", "Seconds", "Notes", "Workout Notes", "RPE"]
    },
    "offline_and_sync": {
      "persist_on_every_commit": true,
      "confirm_ui_after_local_write": true,
      "local_store": "IndexedDB",
      "outbox": {
        "idempotency_key": "set_uuid",
        "flush_triggers": ["online", "visibilitychange_visible", "sw_startup", "interval_30s_while_active"],
        "background_sync_if_available": true,
        "max_retention_h": 24
      },
      "conflict_policy": "last writer wins per set; sessions merged by set uuid",
      "install_nudge_after_sessions": 2,
      "install_nudge_reason": "Safari purges site storage after 7 days without a visit; Web Push needs Home Screen install",
      "sync_status_indicator": "header dot: saved locally / synced / retrying"
    },
    "haptics": {
      "api": "navigator.vibrate (Android only; unsupported in iOS Safari)",
      "patterns_ms": {"set_done": [15], "set_adjusted": [8], "rest_end": [100, 60, 100], "pr": [30, 40, 30, 40, 80]},
      "user_toggle": true,
      "always_pair_with_visual": true
    },
    "complaints_to_design_against": [
      "small or late-appearing primary buttons (watchOS 26 Workout app; Setgraph add-set button)",
      "extra taps and hidden set counters when entering weight/reps (JEFIT)",
      "data loss on network error or uninstall with an active session (Boostcamp before offline mode; Hevy)",
      "no backup restore or removed export (Setgraph; Gymaholic)",
      "unexplained or unrealistic load recommendations (Fitbod; JuggernautAI; RP set counts)",
      "edits wiped by automatic regeneration (Fitbod refresh)",
      "navigation locked during an active session (Fitbod)",
      "unit conversion rewriting stored values (Gymaholic; Caliber)",
      "rest timer reduced to a tiny secondary element (Strong on watch)"
    ]
  }
}
```

---

## Sources

1. Strong Workout Tracker Gym Log — App Store listing (features, 6.5.1 release notes, user reviews). Strong Fitness Pte. Ltd., 2025. https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
2. Strong — official site feature list (CSV export, charts, muscle heat map, Help Center link). Strong Fitness, 2025. https://www.strong.app/
3. "Import Strong data (weightlifting app)" — user-reported Strong CSV export columns and Brzycki formula. intervals.icu forum, 2021. https://forum.intervals.icu/t/import-strong-data-weightlifting-app/5531
4. Hevy — "Track workouts" feature page (logging flow, prefilled previous sets, set types, rest timer, notes, plate calculator, set count per muscle group). Hevy, 2025. https://www.hevyapp.com/features/track-workouts/
5. Hevy — "Workout settings" feature page (Default Rest Timer, Previous Workout Values, Warm-up Calculator, Warm Up Sets stats toggle, Keep Awake, Plate Calculator, RPE Tracking, Smart Superset Scrolling). Hevy, 2025. https://www.hevyapp.com/features/workout-settings/
6. Hevy — App Store listing (features, 3.2.x release notes, reviews). Hevy Studios, 2025. https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350
7. Hevy Help Center — "How to Import Strong App CSV Files and Export Your Data in Hevy" (export path; import limited to Strong CSV; via search excerpt). Hevy, 2025. https://help.hevyapp.com/hc/en-us/articles/38001424401943-How-to-Import-Strong-App-CSV-Files-and-Export-Your-Data-in-Hevy
8. Hevy Help Center — "How to Get Your Weekly Streak Back in the Hevy App" (via search excerpt). Hevy, 2025. https://help.hevyapp.com/hc/en-us/articles/34467766576279-How-to-Get-Your-Weekly-Streak-Back-in-the-Hevy-App
9. Hevy Help Center — "What will happen to my information if I uninstall and reinstall the Hevy app" (active workout lost if unsaved; via search excerpt). Hevy, 2025. https://help.hevyapp.com/hc/en-us/articles/38223672272791-What-will-happen-to-my-information-if-I-uninstall-and-reinstall-the-Hevy-app
10. Hevy Help Center — "How to Log a Workout in the Hevy App" (Discard Workout; via search excerpt). Hevy, 2025. https://help.hevyapp.com/hc/en-us/articles/35361530647959-How-to-Log-a-Workout-in-the-Hevy-App-Step-by-Step-Guide
11. Fitbod Help Center — "Editing Workouts in Fitbod" (Replace Exercise, Swap menu, Don't Recommend Again, Recommend More/Less; via search excerpt). Fitbod, 2025. https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod
12. Fitbod Help Center — "Why did my workout change? Understanding workout refreshes" (edits replaced on regeneration; via search excerpt). Fitbod, 2025. https://help.fitbod.me/hc/en-us/articles/42333470514455-Why-did-my-workout-change-Understanding-workout-refreshes
13. Fitbod Blog — "Your Gym Profile" (equipment-matched workouts; one profile per location; via search excerpt). Fitbod, 2024. https://fitbod.me/blog/your-gym-profile/
14. Fitbod: Gym & Fitness Planner — App Store listing (features, reviews incl. navigation lock during workout). Fitbod Inc., 2025. https://apps.apple.com/us/app/fitbod-gym-fitness-planner/id1041517543
15. Fitbod Help Center — "Getting Started with Fitbod: A New User's Guide" (algorithm starts conservatively; adjust if too hard/easy; via search excerpt). Fitbod, 2025. https://help.fitbod.me/hc/en-us/articles/30721771750039-Getting-Started-with-Fitbod-A-New-User-s-Guide
16. HotelGyms Blog — Fitbod review (Gym Profiles folded into "Locations" under Equipment & Locations; via search excerpt). HotelGyms, 2025. https://www.hotelgyms.com/blog/?p=5351
17. Dr. Muscle — "Fitbod Review Reddit: Top 10 Results" (roundup of Reddit threads incl. "Fitbod recommends dangerous weights"; competitor-authored). Dr. Muscle, 2024. https://dr-muscle.com/fitbod-review-reddit/
18. Boostcamp — Features page (RPE 6–10 with RIR hints, auto rest timers, PR badges, offline mode, Auto Progression, Muscle Tracker heatmap/radar/table, Strength Score, Weekly Report). Boostcamp, 2026. https://www.boostcamp.app/features
19. Boostcamp: Gym Workout Planner — App Store listing (features; reviews incl. network-error data loss and developer reply on offline mode). BPM Health, 2025. https://apps.apple.com/us/app/boostcamp-gym-workout-planner/id1529354455
20. Boostcamp — "Boostcamp vs RP Hypertrophy" comparison (RP feedback inputs, pricing; vendor-authored). Boostcamp, Oct 2026. https://www.boostcamp.app/vs/rp-hypertrophy
21. Liftosaur — Liftoscript documentation (exercise syntax, lp/dp/sum progressions, custom progress and update blocks, state variables, increment/decrement/roundWeight, warmup syntax). Anton Astashov, 2025. https://www.liftosaur.com/docs/liftoscript
22. Liftosaur — GitHub README (feature list, StrongLifts progression example, plates notation, exercise substitution by muscle activation, PWA offline mode, native-only push for rest timers). Anton Astashov, 2025. https://github.com/astashov/liftosaur
23. Liftosaur: Scriptable Workouts — App Store listing (features, pricing, reviews). 2025. https://apps.apple.com/us/app/liftosaur-scriptable-workouts/id1661880849
24. JEFIT Workout Planner Gym Log — App Store listing (features incl. BodyMap, weekly sets per muscle; reviews on convoluted input, removed set counters, Watch timer freeze). JEFIT Inc., 2025. https://apps.apple.com/us/app/jefit-workout-planner-gym-log/id449810000
25. JEFIT Gym Workout Tracker — Google Play listing and reviews (per-arm dumbbell weight change, redesign removing set recording outside workouts; via search excerpt). JEFIT Inc., 2025. https://play.google.com/store/apps/details?id=je.fit
26. Alpha Progression — "Alpha Progression Guide" (per-set recommendations, gym profiles with weight increments, exercise alternatives, warm-up calculator settings, plate calculator, rest timer behaviour, picker entry, charts, streak target, pricing). Alpha Progression GmbH, 2025. https://alphaprogression.com/en/blog/alpha-progression-guide
27. Gym Workout Alpha Progression — App Store listing (features, release notes, reviews). Alpha Progression GmbH, 2025. https://apps.apple.com/us/app/gym-workout-alpha-progression/id1462277793
28. Alpha Progression — "Alpha Progression vs Hevy" (Hevy Trainer progression rule; vendor-authored). Alpha Progression GmbH, 2025. https://alphaprogression.com/en/blog/alpha-progression-vs-hevy
29. Garage Gym Reviews — "JuggernautAI Review" (readiness 1–5 inputs, set removal at RPE 10, swaps per day or block, tab layout, UI complaints, pricing). Garage Gym Reviews, 2025. https://garagegymreviews.com/juggernautai-review
30. JuggernautAI — App Store listing (readiness system; reviews on light loads, warm-up cap ignored, inconsistent timer notification; pricing). Juggernaut Training Systems, 2025. https://apps.apple.com/us/app/juggernautai/id1515756471
31. RP Strength — "RP Hypertrophy App" product page (pump/soreness/workload feedback, week-by-week adjustment, on-the-fly changes, pricing). Renaissance Periodization, 2026. https://rpstrength.com/hypertrophy-app
32. RP Hypertrophy Help Center — article 14605661323671 on how feedback determines future volume (via search excerpt). Renaissance Periodization, 2025. https://hypertrophy.zendesk.com/hc/en-us/articles/14605661323671
33. RP Strength Help Center — "Navigating the App" section (FAQ titles incl. "Why is the app giving me so many sets?"; via search excerpt). Renaissance Periodization, 2025. https://help.rpstrength.com/hc/en-us/sections/30801323964183-Navigating-the-App
34. RP Hypertrophy — App Store listing (features, reviews incl. request for 30-second rest increments and unilateral set splitting). Renaissance Periodization, 2025. https://apps.apple.com/us/app/rp-hypertrophy/id1555614554
35. Renaissance Periodization — "Training Volume Landmarks for Muscle Growth" (MV/MEV/MAV/MRV definitions, ~6 sets maintenance, triceps MRV 18, week-to-week set progression rules). Renaissance Periodization, 2025. https://rpstrength.com/training-volume-landmarks-muscle-growth/
36. Caliber: Strength Training — App Store listing (Strength Score, Strength Balance heatmap, reviews incl. kg/lb recalculation; plate calculator fix notes). Caliber Fitness, 2025. https://apps.apple.com/us/app/caliber/id1482405410
37. Gravitus — App Store listing (autofill, per-exercise rest, plate calculator, reviews incl. rest timer praise and request for completion checkmarks). Gravitus Inc., 2025. https://apps.apple.com/us/app/gravitus-gym-workout-tracker/id965383840
38. Setgraph: Gym Workout Tracker — App Store listing (swipe-to-repeat sets, Next Set Due notification, auto rest timer with Dynamic Island, Notepad Mode, Smart Plates, selectable 1RM formula, CSV export; reviews on button size and backup). Setgraph, 2026. https://apps.apple.com/us/app/id1209781676
39. Gymaholic: Workout Tracker — App Store listing (Apple Watch set logging, single-tap set completion, replace exercises from watch; reviews on unit conversion, last-set editing, lost export). Devenyi Gabor, 2025. https://apps.apple.com/us/app/gymaholic-workout-tracker/id648518560
40. Apple Support — "Use the Workout app on your Apple Watch" (workout types, metrics, ending a workout, Workout Buddy). Apple, 2025. https://support.apple.com/en-us/HT204523
41. MacRumors — "Apple Watch Users Claim Workout App Is Now Worse in Every Way" (watchOS 26 redesign complaints: small targets, late play button, lag). MacRumors, 2025-11-20. https://www.macrumors.com/2025/11/20/apple-watch-users-workout-app-complaints/
42. DC Rainmaker — "Apple Watch Workout Builder (iOS 26 / watchOS 26)" (custom workouts are time/distance based; no sets/reps/weight). DC Rainmaker, 2025-09. https://www.dcrainmaker.com/2025/09/apple-watch-workout-builder-ios26-watchos26.html
43. iPhoneLife — "How to Turn Off Start & End Workout Reminders on Your Apple Watch" (End Workout Reminder behaviour, quoting Apple Support). iPhoneLife, 2024. https://iphonelife.com/content/how-to-turn-start-end-workout-reminders-your-apple-watch
44. Apple Support Communities — "How can I edit the end time of a forgotten Apple Fitness workout?" (1h 38m recorded for an 11-minute workout). Apple Discussions, 2024. https://discussions.apple.com/thread/255984490
45. Garmin — "Recording a Strength Training Activity" (owner's manual: rep counting, Auto Set, finish set → rest timer, edit reps during rest). Garmin, 2024. https://www8.garmin.com/manuals/webhelp/GUID-CB71AAE9-99E6-47B4-AB7F-F14BA316E7C6/EN-US/GUID-FD0DDF57-E3E0-4AD3-871C-88D0160A4B84.html
46. Garmin — "Tips for Recording Strength Training Activities" (rep counting conditions; leg exercises may not count). Garmin, 2024. https://www8.garmin.com/manuals/webhelp/GUID-C2B794A7-F2FB-456B-B090-69C0111C43CB/EN-US/GUID-7C8D56F5-E9F5-4825-9F66-3CC9124B2979.html
47. the5krunner — "New Garmin Connect Strength Training feature heading for the app?" (web view regroups sets by exercise or primary muscle). the5krunner, 2024-06-23. https://the5krunner.com/2024/06/23/new-garmin-connect-feature-heading-for-the-app-or-is-it-a-hidden-feature
48. Garmin Forums — "Strength training - editing" (limited exercise list, no custom exercises, editing removed in app). Garmin Connect Web forum, 2021–2024. https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/248139/strength-training---editing
49. JustUseApp — Hevy problems page (user-reported crashes, black screens, unsaved workouts). JustUseApp, 2023–2025. https://justuseapp.com/en/app/1458862350/hevy-workout-tracker-gym-log/problems
50. Mac Power Users Talk — "Gym iPhone App Recommendation" (Strong 6.0 beta feedback; Live Activity rest timer). MPU forum, 2024. https://talk.macpowerusers.com/t/gym-iphone-app-recommendation/32667?page=2
51. Hoober, S. — "How Do Users Really Hold Mobile Devices?" (1,333 observations; 49 % one-handed, 36 % cradled, 15 % two-handed; later revisions). UXmatters, 2013-02. https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
52. Smashing Magazine — "How To Design Mobile Apps For One-Hand Usage" (bottom placement of core actions, ≤5 bottom tabs, bottom sheets). Smashing Magazine, 2020-02. https://www.smashingmagazine.com/2020/02/design-mobile-apps-one-hand-usage/
53. Apple — Human Interface Guidelines: Accessibility (control size table: iOS default 44×44 pt, minimum 28×28 pt; 12/24 pt padding; gesture alternatives). Apple, 2025. https://developer.apple.com/design/human-interface-guidelines/accessibility
54. Apple — Human Interface Guidelines: Playing haptics (short haptics for discrete events, consistency, complement visuals, make optional; notification/impact/selection types). Apple, 2025. https://developer.apple.com/design/human-interface-guidelines/playing-haptics
55. Google — Accessibility Scanner help: "Touch target size" (≥48×48 dp ≈ 9 mm, ≥8 dp spacing). Google, 2025. https://support.google.com/accessibility/android/answer/7101858
56. Android Developers — "Haptics design principles" (clear vs buzzy haptics, consistency, scale strength with importance, 10–20 ms key click). Google, 2025. https://developer.android.com/develop/ui/views/haptics/haptics-principles
57. W3C — "Understanding Success Criterion 2.5.8: Target Size (Minimum)" (24×24 CSS px AA; 2.5.5 uses 44×44 at AAA). W3C WAI, 2023. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
58. MDN — Screen Wake Lock API (request/release/re-acquire pattern; Baseline 2025). Mozilla, 2025. https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
59. caniuse — Screen Wake Lock API (Safari on iOS since 16.4; 96 % global support). caniuse.com, 2026. https://caniuse.com/wake-lock
60. caniuse — Vibration API (no Safari/iOS support in any version). caniuse.com, 2026. https://caniuse.com/vibration
61. MDN — Navigator.vibrate() (limited availability; sticky user activation required). Mozilla, 2025. https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
62. MDN — Background Synchronization API (sync registration and event; limited availability). Mozilla, 2025. https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
63. Chrome for Developers — workbox-background-sync (IndexedDB queue, BackgroundSyncPlugin, replay on service-worker startup where Background Sync is unsupported). Google, 2025. https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
64. WebKit Blog — "Web Push for Web Apps on iOS and iPadOS" (iOS 16.4; Home Screen web apps only; permission on direct user interaction; Badging API). Apple WebKit team, 2023. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
65. WebKit Blog — "Full Third-Party Cookie Blocking and More" (7-day cap on script-writable storage incl. IndexedDB and service worker registrations; Home Screen web apps keep their own timer). Apple WebKit team, 2020. https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
66. MagicBell — "PWA iOS Limitations and Safari Support: Complete Guide" (no local notifications, background service workers and Background Sync unavailable on iOS). MagicBell, 2025. https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
67. Wikipedia — "One-repetition maximum" (Epley, Brzycki, Landers, Lombardi, Mayhew, O'Conner, Wathen formulas; divergence after ~10 reps; ±10 % error). Wikipedia, 2025. https://en.wikipedia.org/wiki/One-repetition_maximum
68. Helms, E. R., Cronin, J., Storey, A., Zourdos, M. C. — "Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training." Strength and Conditioning Journal 38(4):42–49, 2016. https://pmc.ncbi.nlm.nih.gov/articles/PMC4961270/
69. Nuzzo, J. L., Pinto, M. D., Nosaka, K., Steele, J. — "Maximal Number of Repetitions at Percentages of the One Repetition Maximum: A Meta-Regression and Moderator Analysis of Sex, Age, Training Status, and Exercise." Sports Medicine 54:303–321, 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/
70. "A Weight-Dependent 1RM Prediction Equation Optimized on 303,494 Near-Failure Sets Across 388 Exercises." arXiv preprint 2603.17495 (not peer-reviewed), 2026. https://arxiv.org/abs/2603.17495
71. Viveiros, L., Gioia, K., Nasser, I., Acetto, V., Farias, D., Willardson, J. M., Miranda, H. — "High-load and low-volume warm-up increases performance in a resistance training session." Journal of Bodywork and Movement Therapies 40:1487–1491, 2024. https://doi.org/10.1016/j.jbmt.2024.08.004
72. Souza, D., Silva, A. G., Vale, A., et al., Gentil, P. — "Effect of warm-up protocols using lower and higher loads on multiple-set back squat volume-load." PeerJ 12:e17347, 2024. https://peerj.com/articles/17347
73. Schoenfeld, B. J., Ogborn, D., Krieger, J. W. — "Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis." Journal of Sports Sciences 35(11):1073–1082, 2017. https://pubmed.ncbi.nlm.nih.gov/27433992/
74. Pelland, J., Remmert, J., Robinson, Z., Hinson, S., Zourdos, M. — "The Resistance Training Dose-Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gain." SportRxiv preprint (67 studies, 2,058 participants; fractional set counting), 2024. https://sportrxiv.org/index.php/server/preprint/view/460
75. Walker, J. — The Hacker's Diet, "Pencil and Paper" (trend = previous trend + 0.1 × (weight − previous trend); first trend = first weight). Fourmilab, 1991/2005. https://www.fourmilab.ch/hackdiet/e4/pencilpaper.html
76. Walker, J. — The Hacker's Diet, "Signal and Noise" (exponentially smoothed moving average; smoothing constant 0.9 ≈ 20-day SMA lag). Fourmilab, 1991/2005. https://www.fourmilab.ch/hackdiet/e4/signalnoise.html
77. MacroFactor Help — "Weight Trend" (recency-weighted moving average; linear interpolation across missed weigh-ins; weigh daily or ≥3×/week). MacroFactor, 2025. https://help.macrofactorapp.com/dashboard/weight_trend/
78. Patel, M. S., et al. — "Effectiveness of Behaviorally Designed Gamification Interventions With Social Incentives for Increasing Physical Activity Among Overweight and Obese Adults Across the United States: The STEP UP Randomized Clinical Trial." JAMA Internal Medicine 179(12):1624–1632, 2019. https://doi.org/10.1001/jamainternmed.2019.3505
79. "Persuasive Design in a Digital Mindfulness Intervention: A Randomized Trial of a Skill-Based Achievement System and Automated Peer Encouragement" (312 participants; gamification did not improve adherence). PMC, 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC12872988/
