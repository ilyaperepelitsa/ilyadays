# Fitness pictures — house style

Every generated picture in the fitness section (technique sequences, joint-angle side views, machine pictures,
muscle maps, the cover) is made from the prompt blocks in this file plus the per-exercise drawing data in
`art/fitness/scenes.json`. `scripts/fitness-images.py` parses the fenced ```` ```prompt <name> ```` blocks below
and assembles them, so what is documented here is exactly what is sent:

| picture kind | assembled prompt | size |
| --- | --- | --- |
| sequence (every exercise) | `base` + `mannequin` + `sequence` + `Scene: …` + `negative` | 1536×1024 (3:2) |
| sequence of a symmetric movement (`"pair": true`) | `base` + `mannequin` + `sequence-pair` + `Scene: …` + `negative` | 1536×1024 (3:2) |
| side (owner-primary exercises) | `base` + `mannequin` + `side` + `Scene: …` + `negative` | 1536×1024 (3:2) |
| machine (machine alone) | `base` + `machine` + `Scene: …` + `negative` | 1536×1024 (3:2) |
| muscle-map (one coarse group) | `base` + `mannequin` + `muscle-map` + `Scene: …` + `negative` | 1024×1024 |
| cover (home tile / link preview) | `cover` + `Scene: …` | 1536×1024 (3:2) |

When a style reference picture is passed to the edits endpoint, the `reference` block is prepended. Scenes are
built from `scenes.json` (machine as set up, seat height, grip, START/END, arrow path, hardest point, camera,
muscle locations) and, once the catalog exists, the exercise's own setup, cues and muscles from
`content/fitness/exercises.json`.

Colours are the site's (`src/styles/food.css`): ivory background `#faf6ef`, accent orange `#b83d0b`, warm dark-brown
outlines. The look follows the site-wide image policy (`art/image-requirements.json`: thin warm-brown contours,
matte two/three-tone cel shading, ivory ground, never photoreal, no text) with two stated exceptions for this
collection: one orange motion arrow and orange working muscles.

Conventions:

- **START/END**: LEFT = where the working (lifting) phase begins — usually the stretched position where the weight
  rests; RIGHT = where it ends. The single arrow sits in the LEFT panel and follows the path to the END position.
- **Mirrored pair** (added 2026-11-09): a symmetric movement where both sides travel toward or away from each other
  (flies, hip adduction, band pull-apart, raises with both arms) sets `"pair": true` in `scenes.json`, and the
  builder swaps in the `sequence-pair` layout: two mirror-image arrows, one per side. A single arrow on one side kept
  reading as outward in review (cable fly, hip adduction).
- **Bands are grey** (added 2026-11-09): resistance bands are light grey like cables, never orange; orange is
  reserved for the working muscles and the motion arrow.
- **Camera by movement pattern** (a scene may override): pure side for pulls, rows, curls, extensions, hinges,
  squats and trunk flexion (the joint angle is the point); three-quarter front for presses, flies, carries and
  anti-rotation; three-quarter rear for rear-delt work; straight front for raises and hip ab/adduction.
- **Side view** = the joint-angle view at the hardest point of the rep: a pure profile for movements in the
  sagittal plane; a rear, front or high front view for the few owner exercises that move in another plane (lateral
  raise, Pallof press, pec deck, cable fly).
- **Machine pictures**: the parts the user adjusts before a set (seat and pad pins, the selector pin, the pulley
  pop-pin) are accent orange, the only orange in the picture.

## Base look (all technical pictures)

```prompt base
Clean technical instruction illustration for a gym exercise guide, in the hand-drawn Japanese-animation look of the rest of the site: thin, even, warm dark-brown ink outlines (#4a3a2a) around every shape; large areas of smooth flat colour with simple matte two-tone cel shading (one base tone plus one darker shadow tone per surface — no gradients, no gloss, no texture); a plain warm ivory background (#faf6ef) filling the whole picture edge to edge, with no walls, no windows, no scenery and no props beyond what the scene names; each machine (or the mannequin's feet) stands on one soft flat shadow ellipse, nothing else marks the ground. Palette: the mannequin is a neutral matte warm grey (#d8cfc3 base, #b9ad9e shadow); machine frames are dark graphite (#3b3632); seats and pads are cream (#efe6d6); weight stacks, cables, pulleys, bars, handles, dumbbells, plates and resistance bands are light grey (#c9c3b8) — a band is never orange; the ONLY saturated colour in the picture is the accent orange (#b83d0b). Proportions true to real commercial gym equipment and a real adult body. Calm, tidy, diagrammatic — like the best page of a good instruction manual.
```

## The mannequin

```prompt mannequin
The person is a smooth stylised mannequin, gender-neutral with an athletic adult build (like a smooth artist's figure or a matte crash-test dummy): a smooth egg-shaped head with no face, no hair and no ears; simple mitten hands without individual fingers that visibly wrap around whatever they hold; smooth rounded joints; no clothing, no shoes, no muscle striations — one continuous matte grey surface, so that anatomy errors are impossible. The working muscles are painted directly on the mannequin's surface as clean flat orange (#b83d0b) regions with the same thin brown outline, shaped like the real muscle and exactly where it lies, only where the camera can see it; assisting muscles are a paler orange tint (#e8a37a). Everything else on the mannequin stays grey.
```

## Sequence (technique, every exercise)

```prompt sequence
Layout: ONE landscape picture (3:2) divided into exactly TWO equal panels side by side by one thin vertical dark-brown line. Both panels show the same mannequin on the same machine from the same camera angle and at the same scale. LEFT panel = the START position of one repetition; RIGHT panel = the END position of the same repetition. The machine's frame, seat and fixed pads are identical in both panels, while its moving parts — handles, lever arms, bar, cable, rollers and any pad the body pushes — stay attached to the hands or limbs and move with them, so they sit in a different place in each panel; nothing passes through the body. Draw the machine simply and recognisably — frame, seat, pads, handles or bar, cable path and weight stack — with fewer details than reality but true to size relative to the mannequin, and show clearly where the mannequin touches it (seat, pads, handles). In the LEFT panel only, exactly ONE curved orange arrow (#b83d0b) with a simple triangular head runs beside the moving hands (or the moving body part the scene names), following the path they travel to the END position. The panels carry no captions, letters or numbers: the arrow and the left-to-right order alone tell the story. No other arrows, dots, angle marks or lines.
```

## Sequence with a mirrored pair of arrows (symmetric movements, `"pair": true`)

The `sequence` layout with one change: two mirror-image arrows, one per side, instead of one.

```prompt sequence-pair
Layout: ONE landscape picture (3:2) divided into exactly TWO equal panels side by side by one thin vertical dark-brown line. Both panels show the same mannequin on the same machine from the same camera angle and at the same scale. LEFT panel = the START position of one repetition; RIGHT panel = the END position of the same repetition. The machine's frame, seat and fixed pads are identical in both panels, while its moving parts — handles, lever arms, bar, cable, rollers and any pad the body pushes — stay attached to the hands or limbs and move with them, so they sit in a different place in each panel; nothing passes through the body. Draw the machine simply and recognisably — frame, seat, pads, handles or bar, cable path and weight stack — with fewer details than reality but true to size relative to the mannequin, and show clearly where the mannequin touches it (seat, pads, handles). Both sides of the body move at the same time as mirror images, so in the LEFT panel only, exactly TWO curved orange arrows (#b83d0b), mirror images of each other, run beside the two moving hands (or the two moving body parts the scene names), one arrow on each side, each following the path its own side travels to the END position; each arrow has ONE simple triangular head, at the end it travels toward, and a plain tail with no head — never a double-headed arrow. The panels carry no captions, letters or numbers: the arrows and the left-to-right order alone tell the story. No other arrows, dots, angle marks or lines.
```

## Side view (joint angles, owner-primary exercises)

```prompt side
Layout: ONE landscape picture (3:2), a single scene with no panels and no dividing lines: the mannequin on the machine frozen at the hardest point of one repetition, large and centred, seen from the camera the scene names. Unless the scene names another view, this is a strict PROFILE drawing, like an engineering side elevation: the camera looks at the mannequin's left side at exactly 90 degrees, the mannequin faces the right edge of the picture, only its left arm and left leg are fully visible (the right ones are hidden behind them), the head is a profile silhouette, and the flat machine parts that face forward — back pad, seat, frame — are seen edge-on as thin slabs. The angles at the shoulder, elbow, hip and knee must read at a glance: draw the limbs as clean, clearly separated segments with visible joint bends, and show exactly where the mannequin touches the seat, pads and handles. Exactly ONE curved orange arrow (#b83d0b) with a simple triangular head, beside the moving hands (or the moving body part the scene names), shows the direction of the lift through this moment. No other arrows, angle marks, arcs, dots or lines.
```

## Machine illustration

```prompt machine
Layout: ONE landscape picture (3:2) of the machine alone, centred and filling most of the picture, seen from a three-quarter front view slightly above eye level so that the seat, pads, handles or bar, cable path and weight stack are all visible. No person, no mannequin, no hands. Draw it simply and recognisably in the palette above with the real proportions of commercial gym equipment; a weight stack is a plain block of identical rectangular plates with one selector pin and no numbers; plates on a plate-loaded machine are plain discs without lettering. The parts a user adjusts before a set — the seat-height lever or pop-pin, a back-pad or range pin, the selector pin, a pulley-height pop-pin — are painted accent orange (#b83d0b); nothing else is orange.
```

## Muscle map

```prompt muscle-map
Layout: ONE square picture divided into two equal panels side by side by one thin vertical dark-brown line. LEFT panel: the mannequin seen from the FRONT, standing relaxed in the anatomical position, arms slightly away from the sides with the palms forward, feet hip-width apart. RIGHT panel: the same mannequin seen from the BACK in the same pose at the same size. For this picture only, the major muscles of the whole body are drawn as faint thin outlines on the grey surface, like a simple anatomy chart without striations, so the highlighted group sits on a readable map. Exactly ONE muscle group, the one the scene names, is painted flat orange (#b83d0b) on whichever view shows it — on both views where it is visible from both sides; every other part of the body stays grey. No arrows, no marks.
```

## Forbidden (appended to every technical picture)

```prompt negative
Absolutely no text of any kind: no letters, words, numbers, labels, captions, panel titles, step numbers, callouts, leader lines, measurements, logos, brand names, watermarks or signatures anywhere — not on the machine, not on the weight stack or plates, not in the panels. No arrows except the motion arrow or arrows the layout describes. No faces, hair, fingers, clothing, shoes, sweat, motion blur, speed lines, sparkles or glow. No photorealism, no 3D rendering, no gradients, no texture, no hatching, no paper grain, no vignette. No extra people, mirrors, windows, plants, floor tiles or gym scenery.
```

## Reference note (prepended when a style reference is passed)

```prompt reference
Use the reference image(s) ONLY to keep the same art style: line weight, flat matte shading, palette and background tone (and, for the technical pictures, the mannequin's design and the panel layout). Draw a NEW picture exactly as described below; do not copy the machine, pose, composition, number of panels or any other detail from the reference.
```

## Cover (home tile and link preview)

The style text of the two existing covers (`art/covers/prompts.json`, the recipe site's "clean" look) with the
food-only rules removed; the two covers are passed as style references so the three home tiles match.

```prompt cover
Clean cel-shaded anime game illustration with a touch of realism, like polished official background art in a Japanese action game: semi-realistic forms, proportions, lighting and materials; crisp, well-defined ink outlines of confident even weight around every object, with clean hard edges and clear separation between pieces; large areas of smooth colour with two- or three-tone cel shading and a few soft gradients; sharp white gloss highlights on metal; bright, slightly richer colours. All surfaces clean: no texture, no grain, no noise, no hatching or cross-hatching, no pencil, no stippling, no mosaic or crackle pattern, no paper texture. Minimal scenery: only the items the scene mentions. No text, no labels, no lettering, no watermark, no people, no animals or characters.

Rules: smooth, clean surfaces with crisp, well-defined outlines — no grain, noise, hatching, stippling, paper or crackle texture anywhere. Draw only what the scene names. Sizes, quantities and proportions exactly as described and realistic: real commercial gym machines at true scale, with plain weight stacks and no numbers, logos or brand names anywhere.
```

## Review criteria (every picture, at full size)

1. Outlines thin, even and clean; flat matte two-tone shading; ivory background edge to edge.
2. No text, letters, numbers, labels, logos or watermarks anywhere (check the weight stack, plates and frame).
3. Mannequin plausible: proportions, joints, one head, two arms, two legs; contact with seat, pads and handles
   correct; mitten hands wrap the handles.
4. Working muscles in orange in the right place; nothing else orange except the arrow (machine pictures: only the
   adjustment points); resistance bands grey.
5. Sequence: two equal panels, START left and END right clearly different, machine identical, one arrow (or the
   mirrored pair) in the left panel along the real path, its head pointing the way the part travels.
6. Technically right: seat height, grip and path as the scene says (e.g. chest-press handles at mid-chest,
   pulldown bar to the upper chest, thighs under the pads).
7. Readable at 360 px wide (phone card).

Verdicts for the style test are in `art/fitness/style-review.md`; every exact prompt sent is in
`art/fitness/prompts.json`.
