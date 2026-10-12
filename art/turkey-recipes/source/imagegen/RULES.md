# Current image requirements

The authoritative requirements are in `../ilyadays/art/image-requirements.json`, copied to `imagegen/requirements.json` before generation. `prompts.prompt()` reads that policy for every image. See `../ilyadays/art/IMAGE_REQUIREMENTS.md` for the built-in and export workflow. It takes precedence over the historical notes below, including old style names and obsolete diagram references.

## Historical feedback and rationale

# Image rules

Every rule here comes from feedback on the pilot images. The ones the model can act on are also in
`RULES` in `imagegen/prompts.py`, which is added to **every** image prompt automatically. The rest are
for whoever writes prompts and reviews images (human or agent).

## What was said → the rule

| Feedback | Rule |
|---|---|
| "need better visuals", "still need better visual style", "make them more detailed" | Hand-built SVG drawings are not good enough as step pictures; use generated illustrations. |
| "neither is good" (realistic photo, painted cookbook) | No photo look, no watercolour/gouache cookbook look. |
| "cel looks better. a bit more hand drawn aesthetic. less scenery" | Cel-shaded anime game food art. **Minimal scenery**: only the items the step needs; no rooms, shelves, background props. |
| "everything is too grainy, feels like mandelbrot shit" | **No grain, noise, hatching, stippling, pencil, paper texture, mosaic/crackle** — in the images *and* in the site's SVG art (feTurbulence textures were removed). |
| "clean is good … a smidge more realism, less grain, more definition of lines, edges" | Look = `clean`: crisp, well-defined outlines and hard edges, clear separation between pieces, a touch of realism in form and light. |
| "mixed egg with rice … too grainy, simmering too grainy too" | Cooked egg: smooth, silky, glossy folds — never curdled, foamy, bubbly or pebbly. Simmering liquid: smooth glossy surface, only a few clean bubbles. Rice: a soft mound with a modest number of clearly drawn grains. |
| "show procedure images too … how to cut, how to chop" / "show more action steps" | Every hands-on step gets **technique shots** (`"how"`), 1–2 per step: hands doing the action, captioned. |
| "all pictures need to be bigger if they show process or actions, rather than finished state" | Technique shots are shown **full width**; the finished-state picture is secondary. |
| "maybe finished state should be in the right side of cards? where text is" | The finished-state picture goes under the step text ("Should look like this"). |
| "Mise en place also those icons look terrible" | Mise-en-place icons are generated too: top-down, one vessel, plain off-white background, cropped round. |
| "diagrams with amounts still look like shit" | No SVG diagrams next to generated pictures. Amounts are text: inline in ingredient sub-lists and a "For this step" box (`Step.uses`, set by hand). |
| "any list of steps in text should be pretty bullets … same for lists of ingredients" | Step text is one bullet per action; ingredients named in a run become a sub-list. |
| "ginger not matchsticks but chopped cubes (post matchsticks). chicken - thigh fillets" | Follow the cook's method **exactly**; never invent a cut. When unsure, flag it on the page instead of guessing silently. |
| "fillet chicken thighs don't look that massive" | A chicken thigh fillet is small and thin: about palm-sized (12 × 8 cm), 1–2 cm thick, irregular, pale pink with a little fat — never a big thick slab, never marbled like pork or beef. |
| "the fact that you need to lift the roll to have liquid come underneath is missing" (tamagoyaki) | **Every technique cue in the step text gets its own action shot** (lift, tilt, push, fold, flip…) — a beginner should be able to copy the motion from the pictures alone. Repeated steps ("repeat") get a shot of the key move too. |
| "next image after lifting shows roll disconnected from the trail" (tamagoyaki) | **Physical continuity**: things that are attached in reality stay attached in the picture (a new egg layer runs out from *under* the roll as one sheet). Fix the **orientation** of a pan across a recipe (e.g. handle toward the viewer, "far end" = top of frame) so directions in the text match every picture. |
| "tamagoyaki make sure roll position is consistent with stage start/end" | Every stage picture states **where things are** at that moment, and the next stage starts where the last ended (roll rolled to the near end → pushed to the far end → layer poured → rolled back to the near end). |
| "also do hand orientations and angles consistent" | **One right-handed cook, one camera**: right hand does the knife/chopsticks/pouring work from the right, left hand steadies or holds the pan handle from the left; same camera angle across a recipe. |
| "all pictures that have things like bubbles, anything grainy turns into factorial mandelbrot things … have individual grains/bubbles rendered individually" | **Small repeated things are drawn one by one**: rice, bubbles, crumbs, starch, seeds, salt, flakes, crust nubs. Each is a separate, outlined piece of the same readable size, and there are a few dozen, not hundreds. Never clusters made of smaller clusters, never pieces shrinking into specks, never froth or a beaded surface. A big mass is one smooth shape with a few dozen outlined pieces on its surface. Hot oil gets a ring of about a dozen separate bubbles. This is `SMALL_PIECES` in `prompts.py`, and it goes **last** in every prompt. In the middle of the prompt it had almost no effect. Recipe prompts must not contradict it: "lively small bubbles" and "nubbly crust" had to be rewritten as countable pieces. Don't ask for a "flat fill", which made the rice blotchy. Reference images pass old texture along, so the reference note says to redraw surfaces, not copy them. Regenerate in step order so later steps build on clean images. **Fried crust is the exception**: asking for a countable number of nubs gives bubble-wrap. Describe it as a smooth glossy shell with a few creases and ridges, and no pieces at all. |
| "furikake baby anchovies look like mandelbrot shit too" | Countable is not enough: hundreds of separately drawn, detailed fish carpeting the frame read as fractal too. **Keep pieces sparse with visible surface between them**, and simplify small creatures (baby fish, shrimp) to a clean silhouette with one eye dot, with no scales, stripes or segments. This is in `SMALL_PIECES`. For furikake the prompt asks for about 12–20 anchovies and 8–12 shrimp in the whole picture. |
| "baby anchovies and sakura shrimps are smaller" | **Give real sizes against something in the picture.** The model blows small ingredients up to be readable. State their size relative to an everyday item or the vessel: chirimen are 1–1.5 cm, about five sesame seeds long and 1/20 of the pan's width; sakura shrimp curl to about 1 cm. |
| "furikake after mixing is a bit more wet than you did" | Moisture is part of the food state: say whether something is dry, moist, glossy or wet at each stage, and never "tidy it up" to dry and loose unless the cook says so. |
| "I only use red beets" · "radish is regular red ones, not daikon" · "chopped with a knife, not mixer" · "I make whole tentacle" | **Never swap in a variety, tool or cut the cook didn't name**: no golden beets "for colour", no daikon for "radish", no food processor for chopping, no slicing what they keep whole. If the source doesn't say, ask or flag it on the page. Then make every picture match: say what it is NOT ("never daikon"). |
| "you sous vide a tentacle, then sear it with soy sauce and put whole in the bowl. you did cut it" | **"Whole" must look whole**: the model draws "a tentacle" as a short chunk with a flat white cut face, which reads as cut. Describe the full natural shape and length (a 30–35 cm tentacle tapering to a curled tip, the base end rounded and covered in skin) and ban any visible cut face or cross-section. |
| "some chopsticks angles are fucked and there are sometimes 3 chopsticks in one hand" | **Chopsticks are exactly one pair**: two identical straight sticks, and only one pair in the picture. They're held the Japanese way in the right hand: the upper stick like a pencil, the lower one resting still against the thumb and ring finger. The two sticks run almost parallel and their tips meet at the food, pointing lower-right to upper-left at 30–45°. Never vertical, crossed, bent, or passing through fingers. Resting chopsticks lie as one parallel pair. This is `CHOPSTICKS` in `prompts.py`, added last to any scene that mentions chopsticks. Review check: count the sticks. |
| "you cut off the butts and slices should be perpendicular to butts, otherwise you're fucking up your onions" | Onion for simmering/stir-frying: cut off both ends, halve through them, slice **lengthwise — perpendicular to the cut ends, along the lines** — never crosswise rings, unless a recipe explicitly says otherwise. |
| "new recipes should have their images be auto generated like the old ones. AUTOMATICALLY" | **Every recipe ships with generated pictures.** Write the spec with the recipe; `npm run sync` (ilyadays) runs `imagegen/auto.py`, which generates anything missing and drafts a spec for a recipe without one. SVG drawings are only a fallback, never the shipped look. |
| "some recipes have a mix of shitty and good pics" | **Review a recipe's pictures as a set**, not one by one: same style, camera, background and quality across all of them. One bad picture spoils the page — fix it (prompt first) rather than keeping it because the rest are fine. |
| "yaki image 8 … spread fucking vegemite" | **Miso glaze = thin caramelised lacquer**, same shiny language as soy glaze (slightly redder), never a thick opaque paste with spoon swirls / Vegemite smear. Finish plates that show variants must still look consistent. |
| "shaping nigiri — there are NAMED techniques with varying step count, and specific hand/finger movements that need to be ACCURATELY depicted" | **Technique pages follow a researched, named method** (e.g. kote-gaeshi, tate-gaeshi), with its real number of moves. Every move gets its own picture, and each prompt states which hand, which fingers, where they touch, which way they press and how the piece turns — taken from the research, never improvised. |
| "all the prompts for generating these images should be preserved" | Prompts live in `imagegen/recipes/<slug>.py`; every exact prompt ever sent is kept in `imagegen/prompt_log/<look>/<slug>.json` (all versions). |

## Found while reviewing (also rules)

- **Continuity leaks**: reference images carry content into the next image (a pan of finished food in
  step 1, egg on the rice before it was added). Every scene says what is *not* there when it matters
  ("Only these two bowls — no pan, no stove").
- **Wrong food state**: nothing is cooked, assembled or garnished before its step.
- **Shapes**: chicken pieces are angular cut chunks, never round meatballs; cuts and sizes as written.
- **Quantities**: amounts must look right (a tablespoon of ginger is a small pinch, not a pile the size
  of the onion).
- **Hands**: only hands and forearms, five fingers, natural; knife work in a claw grip, fingertips tucked.
- **Quality setting**: `medium`. `high` added fussy detail (scrambled-looking egg) at 4× the cost.

- **Clutter from equipment lists** (found in the curry): a setting that lists every pot and tool invites
  them all into every picture, and naming what's absent ("no roux yet") can pull it in. Prefer "tight
  close-up, X fills the frame" and keep equipment lists short.

## Review checklist (every generated image)

1. Look at it at full size and at a full-resolution crop — grain and texture hide at thumbnail size.
2. Matches the step text: right ingredients, right cut, right amount, right state, right vessel.
3. Nothing extra in frame; nothing left over from another step.
4. Technique shots: the technique is actually visible and correct (grip, knife direction, motion).
5. Fix the prompt (never just re-roll the same prompt), regenerate, check again.
