# Fitness pictures — style-test review (2026-11-08)

Model `gpt-image-2`, quality **medium**, 1536×1024 (muscle map 1024×1024), webp. Every picture was inspected at full
size (the original) and as the 1200 px web copy. Exact prompts, refs and usage of every request:
`art/fitness/prompts.json`; replaced originals: `art/fitness/originals/_previous/` (gitignored).

**Spend for the whole test: $0.52 of the $2.00 test cap** (9 requests; cumulative `spend.json` total $0.5161).
Measured usage matched the price model exactly: 1372 output image tokens per 1536×1024 picture ($0.0412), 1756 per
square picture ($0.0527), 1536 input tokens per reference picture ($0.0123), 720–1430 prompt tokens ($0.004–0.007).

Criteria (STYLE.md): 1 outlines and flat shading · 2 no text · 3 plausible mannequin and contact points ·
4 muscle highlight · 5 panels and arrow · 6 technically right (seat, grip, path) · 7 readable on a phone.

| Picture | Try | Refs | Cost | Verdict |
| --- | --- | --- | --- | --- |
| `machine-chest-press/sequence` | 1 | — | $0.0468 | **Fail** (6) |
| `machine-chest-press/sequence` | 2 | — | $0.0473 | **Pass** — sequence anchor |
| `lat-pulldown/sequence` | 1 | chest press v1 | $0.0597 | **Fail** (6, camera) |
| `lat-pulldown/sequence` | 2 | chest press v2 | $0.0606 | **Pass with one defect** — redo first in the batch |
| `machines/pec-deck` | 1 | chest press v1 | $0.0571 | **Pass** — machine anchor |
| `cover` | 1 | travel + food covers | $0.0683 | **Pass** |
| `machine-chest-press/side` (anchor check) | 1 | sequence anchor | $0.0594 | **Fail** (camera) |
| `machine-chest-press/side` (anchor check) | 2 | — | $0.0472 | **Pass** — side anchor |
| `muscles/chest` (anchor check) | 1 | sequence anchor | $0.0697 | **Pass** — muscle-map anchor |

The two anchor checks were not in the original three: each becomes the style reference for its whole kind (20 side
views, 14 muscle maps), the batch would have made them first anyway, and a bad anchor would spread to every later
picture of its kind.

## machine-chest-press/sequence

- **Try 1 — fail.** Outlines clean, no text, mannequin plausible, pecs orange and front delts pale, two panels, one
  arrow in the left panel. But in the END panel the hands moved forward while the lever arms stayed put, so the
  handle bar crossed the chest. Cause: the `sequence` block said "the machine is identical in both panels".
  **Fix:** STYLE.md `sequence` now keeps only the frame, seat and fixed pads identical and makes handles, lever arms,
  bar, cable, rollers and pushed pads move with the hands ("nothing passes through the body"); the scene now names
  two lever arms pivoting high behind the shoulders with handles beside the chest, "nothing crosses in front of the
  chest".
- **Try 2 — pass.** Overhead-pivot lever arms swing forward with the hands; handles level with mid-chest; START
  elbows about 90° and just below shoulder height, END arms almost straight; back and head on the pad, feet flat;
  pecs orange, front delts pale; one arrow; plain stack with one pin; crisp at 1200 px (55 KB). Minor: the arrow is
  short and straight, and the stack does not visibly rise in the END panel.

## lat-pulldown/sequence

- **Try 1 — fail.** Drawn from a three-quarter rear view instead of the profile; the END panel pulled the bar
  **behind the neck**; the knee rollers sat beside the hips instead of on the thighs. **Fix:** the `pure side`
  camera text now describes the profile ("left side at exactly 90 degrees … never a front, back or three-quarter
  view"); the scene says the mannequin faces the stack, the rollers press on the tops of the thighs, the bar comes
  down **in front of the face** to the collarbones ("never behind the neck") and is seen end-on.
- **Try 2 — pass with one defect.** Profile view; bar path in front of the face to the upper chest; 10–15° lean
  held; elbows down beside the ribs; lats orange, rear delts pale; the selected plates rise in the END panel; one
  arrow; no text. **Defect:** the knee roller still sits behind the hips, not on the thighs. Under the
  one-regeneration rule it stays for now. The roller wording is fixed in all four pulldown scenes (lat-pulldown,
  neutral-grip-pulldown, vertical-traction, plate-loaded-pulldown: "a round pad seen end-on on top of the thigh near
  the knee, never behind the hips", stack column in front). The batch's first command regenerates this picture
  (≈ $0.06).

## machines/pec-deck

- **Pass.** A recognisable pin-loaded pec deck / rear-delt machine: upright back pad, seat, two swing arms with
  vertical handles, plate stack with one pin. Only the adjustment points are orange (selector pin, seat pop-pin,
  arm start-position knob); no person, no text, one shadow ellipse; clean at 360 px. Minor: the far swing arm is
  half hidden by the frame.

## cover

- **Pass.** Same clean cel-shaded look and warm light as the food and travel tiles: chest press on the left, dual
  cable station in the middle, lat pulldown on the right, pale-wood bench with a terracotta towel, window light; no
  people, no text, no logos, plain stacks. The 1200×630 share crop trims the top of the pulldown's pulley
  (acceptable). Minor: the chest press's lever arms are stylised.

## machine-chest-press/side (anchor check)

- **Try 1 — fail.** It copied the reference's three-quarter front composition almost exactly, so the joint angles
  were not readable. **Fix:** the `side` block now describes a strict PROFILE elevation (left side at 90°, facing
  right, only the left limbs fully visible, back pad and seat edge-on), and the side anchor starts without a
  reference (`planned_refs`); later side views reference this profile anchor, never a three-quarter picture.
- **Try 2 — pass.** A true profile at the bottom of the press: hands on the handles at mid-chest, elbow about 90°
  and below the shoulder, upper arm along the back pad, back on the pad, feet flat; pecs orange, front delt and
  triceps pale; arrow pointing forward; no text. Minor: the elbows are a little more tucked than the scene's 45°.

## muscles/chest (anchor check)

- **Pass.** Front and back panels with faint anatomy-chart outlines; pectoralis (three parts) and serratus orange on
  the front view only; nothing orange on the back; no text. Minor: hands drawn with fingers instead of mittens (the
  anatomy is correct at this size).

## Lessons applied to the batch

1. A style reference transfers composition strongly. Each kind gets its own anchor, and a profile view never gets a
   three-quarter reference.
2. Every scene states where the moving parts are relative to the body (handles, rollers, bar path). The faults were
   geometry and camera — prompt problems, not quality problems.
3. Profile views need the "edge-on" cues.
4. Medium quality was enough: outlines, no text and the muscle highlights were right in 9 of 9 pictures. High
   quality (4× the price) is not needed for the batch.

## Batch run (2026-11-08, stream 07.batch)

The plan was built from the merged catalog (`content/fitness/exercises.json`, 138 exercises). After the batch it holds
**243 pictures**: 138 sequences, 20 side views, 70 machines, 14 muscle maps and the cover. Two plate neck exercises
lost a machine picture that never existed (see P3). Every picture is medium quality, `gpt-image-2`, made with three
workers. P2 to P4 ran with `--budget-usd 19`, a $1 reserve under the hard $20 cap.

**Result.**
- **On the site: 241 pictures** in `content/fitness/images.json`, plus the cover. Only the Pallof press sequence is
  missing: it failed twice and was removed.
- **Spend: $14.86 in total.** That is $0.52 for the style test and **$14.34 for the batch**: 275 paid pictures, 37
  of them redos.
- The batch ended $4.14 under the $19 stop and never touched the cap.

| phase | pictures | cost |
| --- | ---: | ---: |
| lat pulldown redo (the style test's knee-roller defect, try 3) | 1 | $0.06 |
| P1: owner program | 54 | $3.15 |
| P1 redo | 17 | $0.88 |
| P2: alternatives | 97 | $4.91 |
| P2 redo | 14 | $0.64 |
| P3: everything else | 73 | $3.55 |
| P2/P3 redo | 6 | $0.29 |
| P4: muscle maps | 13 | $0.85 |
| **batch** | **275** | **$14.34** |

### Scene fixes from the catalog, before any spending

- **One-side flag.** An explicit `uni` in the scene now beats the catalog's `unilateral`. The catalog marks eight
  exercises unilateral ("one side, then the other"): the Pallof press, woodchop, rotary torso, bird dog, dead bug,
  side plank, bicycle crunch and Copenhagen adduction. The builder then added "the working arm is nearest the camera;
  the other rests", which is wrong when both hands hold one handle. These scenes now say `"uni": false`.
- **Setup alignment.** The landmine press and plate pinch scenes now match the catalog: two hands at the upper chest,
  and a pinched pair of plates in each hand. The face pull got the catalog's grip and stance: overhand on the rope
  ends, slight split stance.
- **Attachment check.** The `straight bar` check now accepts "straight or EZ bar", so the cable-curl warning no
  longer fires falsely.
- **Lat pulldown.** This is the style test's knee-roller redo. A second look at the old picture also showed the stack
  *behind* the mannequin, so the scene got a `note`: stack in front, beam over the head, roller on the thigh. The
  redo (try 3) puts the stack in front, the roller on top of the thighs and the bar in front of the face. The camera
  drifted to a three-quarter rear view, which is acceptable for a pull because the lats show.

### How the pictures were reviewed

Reviews were checked against the STYLE.md criteria: seat, grip, path, joint angles, muscles, no text and style.

| priority | how reviewed |
| --- | --- |
| P1 | every picture at web size (1200 px) with Read |
| P2 | about 50 sequences at web size; the rest of P2, and all of P3, on contact sheets (640 px per sequence, 400 px per machine), zooming in on anything doubtful |
| P4 | all 14 maps |

That is more than the one-in-five the task asked for. A redo costs about $0.05, so a full pass paid for itself.

### Verdicts after the single redo

| priority | angle | on the site | pass | weak (kept) | removed |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | sequence | 19 / 20 | 16 | 3 | 1 |
| 1 | side | 20 / 20 | 19 | 1 | — |
| 1 | machine | 18 / 18 | 18 | — | — |
| 2 | sequence | 67 / 67 | 65 | 2 | — |
| 2 | machine | 30 / 30 | 29 | 1 | — |
| 3 | sequence | 51 / 51 | 49 | 2 | — |
| 3 | machine | 22 / 22 | 22 | — | — |
| 4 | muscle map | 14 / 14 | 14 | — | — |
| **all** | | **241 / 242** | **232** | **9** | **1** |

- "Pass" includes the minor defects listed below.
- "Weak" means one real defect is left. It survived the single redo, or the picture was not worth a redo.
- **37 pictures failed on try 1** (P1 17, P2 15, P3 5). After one redo:

  | result | count |
  | --- | ---: |
  | pass | 30 |
  | weak | 6 |
  | failed twice | 1 |

- Failure causes across the 37:

  | cause | count |
  | --- | ---: |
  | arrow direction | 11 |
  | seats on cable stations | 9 |
  | geometry or panels the model would not follow | 9 |
  | composition or highlight copied from the style reference | 6 |
  | wrong equipment from the catalog | 2 |

### Priority 1: owner program (20 sequences, 20 side views, 18 machines)

54 new pictures in one run, then all 58 reviewed. **17 failed** and were regenerated once with corrected scenes for
$0.88: 12 now pass, 4 keep one defect, and 1 failed twice and was taken off the site.

- **Arrow direction (7).**
  - Failures:
    - face pull: pointed at the pulley;
    - pec deck sequence and side view: outward;
    - cable fly: outward;
    - lower-back machine: forward;
    - farmer's carry: sideways;
    - machine crunch side view: up, which is the return.
  - Root cause in the builder: the side view said "the arrow leads up to the hands", and both blocks only implied the
    direction.
  - Fix: the builder now states the direction: tail at the START position, head the way the part travels, never
    back. Direction-prone paths also name picture directions, such as "curving in to the breastbone" or "toward the
    left of the picture".
  - Fixed: face pull, pec deck ×2, crunch side view, carry.
  - Still reversed after the redo: cable fly sequence, lower-back machine sequence and side view, machine row
    sequence (a new reversal).
- **Composition copied from the style reference (5).**
  - Failures:
    - machine crunch sequence: the three-quarter chest-press frame, and it barely curls;
    - machine row sequence: the elbows end in front of the torso;
    - shoulder press side view: handles at the chest, like the chest-press side anchor;
    - face pull and cable pushdown machines: a seat from the pec-deck anchor.
  - Fix: per-exercise `fresh` and notes, plus the reference rule below.
  - All five now pass, apart from the machine row sequence's arrow.
- **Geometry the model would not follow (5).**
  - Failures:
    - Pallof press sequence and side view: the arms pressed sideways along the cable;
    - lower-back machine side view: hovering above the seat;
    - cable pushdown side view: facing away from the column, with the cable through the shoulder;
    - machine row machine: handles on the seat side of the chest pad.
  - Fix: picture-direction notes (`sideNote`, `machineNote`), a named three-quarter camera "away from the column",
    and the L-shape of cable and arms for the Pallof press.
  - Four now pass. The **Pallof sequence failed twice**: a front view with the arms pressed sideways away from the
    column, which is the wrong exercise. It was removed from `public/media/fitness`, so the page shows the side
    view, which passes, and the cues. Both tries are kept in `originals/_previous/`.

### Priority 2: alternatives (67 sequences, 30 machines)

**15 failed**: 14 in the redo run ($0.64) and 1 in the P3 redo run. 14 now pass, and 1 kept its first try.

- **Seats on cable stations (9 machines).** These were made without any reference, yet 8 of 9 single cable columns
  grew a seat, back pad, bench or knee rollers. The single-arm cable pulldown got a pulldown seat while its sequence
  is half-kneeling. This is the same failure class as the P1 face pull and pushdown machines.
  - Fix in the builder: `FREE_STANDING_CABLE`. A cable station whose text names no seat or bench gets "free-standing
    … NO seat, NO bench, NO back pad and NO knee rollers".
  - All 9 pass after the redo.
- **Arrow direction (3).**
  - Failures: cable external rotation (toward the column), reverse hyperextension (feet forward under the bench),
    overhead cable triceps extension (back toward the column).
  - Fix: picture-direction paths.
  - Two pass. The external rotation redo drew the arm *nearest* the column swinging across the body, which is a
    cross-body pull, not external rotation. **Try 1 was put back** from `originals/_previous/`: the right arm, with a
    reversed arrow. It is weak.
- **Highlight carried from the reference (1).** The plate-loaded shoulder press had bright orange pecs. Fix: `fresh`
  and a `seqNote` naming the deltoid caps. Pass.
- **Geometry (2).**
  - The Bayesian cable curl faced the column with the cable between the legs.
  - The decline sit-up drew an incline bench (head end high) and the arrow curled back.
  - Fix: picture-direction `seqNote`s. Both pass.

### Priority 3: everything else (51 sequences, 22 machines)

**5 failed.** After one redo, 4 pass and 1 is weak.

- **Wrong equipment (2).**
  - What happened: the catalog files the plate neck extension and neck flexion under "plate-loaded". That fell
    through to "done on a plate-loaded lever machine", and the model drew a lever machine under the bench.
  - Fix in the builder: `where()` now takes the scene's own `eq` when the scene has no station text. Before the P3
    run, `"station": false` also dropped the two machine pictures that the catalog's equipment implied but that do
    not exist (245 → 243 planned).
  - Both pass.
- **Mirrored panel (1).** The seated leg press END panel was drawn from the other side. Fix: a `seqNote` fixing the
  sides. Pass.
- **Wrong movement (1).** The leg-press calf raise started with bent knees, which is a leg press. Fix: a `seqNote`
  saying the legs are straight in both panels and only the ankles move. Pass.
- **Arrow direction (1).** The hip adduction arrow pointed outward. Try 2 moved it between the knees, but it still
  reads as outward. Weak.
- **Prevention before the run.** The pull-through arrow got a picture direction ("away from the column"), and it came
  out right. The neck isometrics and rotary torso sequences were made `fresh`, because they are three-quarter front
  but are not chest presses.

### Priority 4: muscle maps (13 new + the chest anchor)

All 14 pass. Each map has front and back panels, the right group in flat orange, and no text.

### Known weak pictures

These are kept on the site and are candidates for a later redo:

- `machine-row/sequence`: the arrow points toward the handles (reversed); the pose is right.
- `cable-fly/sequence`: a short arrow runs from the shoulder out to the hand (outward).
- `lower-back-machine/sequence` and `lower-back-machine/side`: the arrow curves up and forward, but the trunk moves up
  and back.
- `cable-external-rotation/sequence`: the arrow points toward the column. Try 1 is kept because try 2 drew the wrong
  exercise.
- `reverse-crunch/sequence`: the arrow at the hips points toward the feet, while the knees travel toward the chest.
- `hip-adduction-machine/sequence`: the arrow left of the seat points left, which reads as outward.
- `rotary-torso-machine/sequence`: the turn is hard to read in a front view.
- `machines/t-bar-row`: a muddled lever, with a second pair of grips far from the chest pad, and a stray stool.

**Removed:** `pallof-press/sequence`, after failing twice.

**Minor defects accepted as a pass:**

- Resistance bands drawn orange, which reads like a highlight: band lateral raise, band pull-apart, band external
  rotation.
- Two arrows: band lateral raise, cable fly side view.
- Side plank on a straight arm, where the catalog teaches the forearm.
- Suitcase-carry floor arrow pointing sideways.
- Dead bug arrow in the END panel.
- Faint bicycle-crunch twist.
- Stray weight stacks or assisted-machine frames behind free-weight and bar pictures: pull-up, chin-up, dead hang,
  band-assisted pull-up, dip, barbell presses, barbell RDL, goblet squat, incline dumbbell curl, neck isometrics.
- Small stray seats on the v-squat and standing calf raise machines; a weight stack mixed into the plate-loaded shrug
  machine.
- Three-quarter cameras instead of profile: hack squat, back squat, preacher curl.
- Muscle maps paint wrap-around groups on one view only: obliques, adductors, triceps, calves.

### Reference rule (changed by the batch)

A style reference transfers composition (camera, seat, handle height), not only style. Fresh pictures kept the house
style from the prompt alone. So a picture references its kind's anchor only when the anchor matches it:

- a sequence only when it uses the anchor's own three-quarter front camera;
- a side view never when it has its own `sideCamera`;
- a machine never when it is a cable station or has no seat or bench (the seated pec-deck anchor adds seats);
- never for a kind listed in the scene's `fresh`.

Fresh pictures are also about 20 % cheaper ($0.044–0.048 against $0.057–0.060).

### Lessons

1. **Arrows are the weakest element.** 11 of the 37 failures and 7 of the 9 weak pictures are arrows. Words like
   "back", "inward" or "forward" are not enough: name the picture direction ("toward the left of the picture") and
   where the arrow sits. A single arrow stays ambiguous for symmetric movements such as adduction and flies.
2. **The model fills empty space with gym equipment.** A station without "no seat" gets a seat, and free-weight
   scenes get weight stacks. Say what is *not* there when it matters.
3. **Catalog fields meant for filters can leak into drawings.** Examples: "plate-loaded" for a plate held on a towel,
   and "band" for the gripper. The drawing's own `eq` now wins.
4. **One redo with a corrected scene fixed 30 of 37 failures.** One redo made things worse, so its first try was
   kept, and one failed twice and was removed. Redos are cheap, so a full review pays.

## Review 2026-11-09 (stream 07 review, before the first training days)

Every picture in `content/fitness/images.json` and the cover was viewed with Read at full size. Each was checked
against its exercise's setup and cues in `content/fitness/exercises.json` and against the criteria below. That is
58 P1, 97 P2, 73 P3 and 14 muscle maps.

Criteria:

- the right machine and body position;
- joints and arrow direction;
- no extra limbs or fused parts;
- no text;
- the same person and machine across angles;
- the right muscles.

Cables were checked where they run, at full size; contact sheets hide that.

**Rules added** (`STYLE.md`, `scripts/fitness-images.py`, `scenes.json` 2026-11-09.7):

- *Mirrored pair*: a symmetric movement sets `"pair": true` and gets the `sequence-pair` layout. That layout draws
  two mirror-image arrows with one head each.
- *Bands are grey*: a band is drawn like a cable.
- *Negative block*: "no arrows except the motion arrow or arrows the layout describes".
- Arrow paths and `seqNote`s name directions in the picture ("toward the RIGHT of the picture", "the dumbbell
  straight above the waist") rather than on the body.

Six batches cost $1.62 in total: A $0.69 (14 pictures), B $0.15 (3), C $0.49 (10), D $0.19 (4), E $0.05 (1) and
F $0.05 (1). Each new picture was viewed. The kept version is the better one, and every replaced file is in
`art/fitness/originals/_previous/`.

| picture | defect before | now |
| --- | --- | --- |
| pallof-press/sequence (P1) | missing (removed after two sideways presses) | back on the site: drawn from its own side view as the reference, arms straight out the way the chest faces |
| machine-row/sequence (P1) | arrow toward the handles | arrow toward the ribs, away from the stack |
| cable-fly/sequence (P1) | arrow outward; one cable ran to the stack | mirrored pair, single heads, each cable to its own hand |
| lower-back-machine/sequence and side (P1) | arrow up and forward | arrow up and back toward the stack |
| machine-shoulder-press/side (P1) | a handle floated off its lever | each lever runs in one piece from the pivot to the handle |
| machine-lateral-raise/sequence (P1) | one lever reached across to the frame | both levers pivot behind the shoulders |
| machines/machine-crunch (P1) | handles out in front like a chest press | handles beside the head on a lever pivoting behind |
| cable-external-rotation/sequence (P2) | arrow toward the column | far arm with a towel, arrow away from the column |
| reverse-crunch/sequence (P2) | arrow toward the feet | arrow from the knees toward the chest |
| band-lateral-raise, band-pull-apart, band-external-rotation (P2) | orange bands, arrows | grey bands; mirrored pairs for the two symmetric ones |
| landmine-press/sequence (P2) | arrow up and back over the head | arrow up and forward along the bar's arc |
| back-extension-45/sequence (P2) | arrow ran past the straight line toward the feet | arrow ends where the body is one straight line |
| dumbbell-curl/sequence (P2) | hammer grip (setup: palms forward) | underhand grip, three-quarter front view, elbows at the sides |
| gripper/sequence (P2) | flat fingers under the handle; arrow down beside the wrist | fingers round the front handle; arrow toward the palm |
| cable-rear-delt-fly/sequence (P2) | END hands held the column uprights, cables ended at the shoulders | hands keep the cable ends, cables cross in front of the chest; mirrored pair |
| machines/cable-rear-delt-fly (P2) | one cable strung across between the columns | two separate cables with ball stops |
| machines/t-bar-row (P2) | second pair of grips on a post far from the pad; stray stool | one lever from the back pivot under the pad to the front horn, handles under the pad |
| machines/cable-lateral-raise (P2) | carriage low but the cable dropped from the top pulley | the handle hangs at the low pulley |
| side-lying-external-rotation/sequence (P2) | END arm grew out of the hip with the elbow lifted; towel under the waist | elbow on a towel at the side, forearm turned up (second try in this review) |
| dead-hang/sequence (P2) | step vanished in END; bar on a cable tower | plain pull-up frame; the step stays under the feet |
| neck-flexion/sequence (P3) | END was a full sit-up | a nod with the shoulders on the bench (second try in this review) |
| trap-bar-deadlift/sequence (P3) | sleeves and plates ran front to back past the shins | sleeves to the sides, three-quarter front view |
| hip-adduction-machine/sequence (P3) | arrow read as outward; START pads outside the knees | pads inside the spread knees, arrows toward each other (third try in this review) |
| muscles/adductors (P4) | one inner thigh painted | both inner thighs |

**Tries that were worse and not kept:**

- Pallof press with an elevated camera: the model ignored it, so retry 1 is kept.
- Hip adduction batch B: the arrows pointed outward.
- Neck flexion batch C: it still curled like a crunch.
- Side-lying external rotation batch D: the whole upper arm was lifted.

**Kept, minor** (they do not teach a wrong movement):

- Stray equipment:
  - weight stacks behind free-weight, bar and Smith pictures (barbell presses, smith squat, pull-up, chin-up, goblet
    squat, barbell RDL, nordic curl, neck isometrics on a leg-extension seat);
  - a stray seat in single-arm cable pulldown.
- Machine pictures:
  - the plate-loaded incline pad is steeper than 45°;
  - the triceps-extension machine reads like a preacher curl;
  - the plate-loaded pulldown seat is off centre;
  - the glute-kickback pad is high;
  - stray seats or stools on the v-squat and standing calf raise; a stack in the shrug machine;
  - the rotary torso pad is behind the seat, as in the sequence.
- Exercise pictures:
  - rotary torso: the turn is hard to read;
  - dead bug: the arrow is in the END panel;
  - bicycle crunch: the twist is faint;
  - landmine press: the bar is slightly bowed and the pivot differs between panels;
  - Pallof side view: an eye-level three-quarter view;
  - dead hang: still a three-quarter rear view;
  - suitcase carry and side plank: tint on muscles outside the list.

Spend: **$16.48 of the $20 cap**. This review cost $1.62 and kept the $19 stop.

**Lessons, continued:**

5. **Name places in the picture, not on the body.** "Toward the RIGHT of the picture" and "the dumbbell straight
   above the waist" worked where "forward" and "elbow on the side" failed.
6. **Pick the camera that shows the cue.** A pure profile hides the grip (hammer against underhand) and turns a trap
   bar 90°. A three-quarter front view shows both.
7. **Follow every cable at full size.** Cables ending at the shoulders, a cable strung across the gap and a handle
   hanging from the wrong pulley all passed on contact sheets.
