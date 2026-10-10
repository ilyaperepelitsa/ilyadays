"""Onigiri hand-shaping hub and alternative methods.

onigiri.py owns the drawing functions and shared instruction source. Only MAIN and RECIPES below
are registered in content.py; the old combined recipe is no longer published.
"""
from copy import deepcopy
from dataclasses import replace
from kit import Recipe, Step
from onigiri_shop import recipe as SHOP
from onigiri import recipe as ORIGINAL

RICE = [("Rice", [("Japanese short-grain rice", "150 g"), ("Water (rice)", "200 ml"),
                  ("Kosher salt (for your hands)", "a little for each onigiri")])]
FINISH = [("To finish", [("Nori", "1 sheet, cut in thirds"), ("Furikake", "to coat (optional)")])]
COOK = "Rice cooker: use the short-grain cycle. Pot: bring to a boil over medium heat with the lid slightly ajar, then cover tightly and cook on low for 12–13 minutes, until the water is absorbed. Rest off the heat, covered, for 10 minutes, then fluff."
RICE_STEP = replace(ORIGINAL.steps[0], body=[
    "Wash the rice, then soak it 20–30 minutes in the water.",
    COOK,
    "This batch makes about 330 g cooked rice, enough for three onigiri.",
    "Keep it plain: no vinegar or sugar. Cool only until comfortable to hold, keeping it covered with a damp towel."], part="Rice", heat="")
FINISH_STEP = replace(ORIGINAL.steps[9], body=[
    "Wrap a third of a nori sheet round the bottom of each onigiri just before eating for crisp nori.",
    "Or coat the faces in furikake with damp fingers. Serve freshly made."], uses=["Nori", "Furikake"])
COMMON_NOTES = [ORIGINAL.notes[0]]
HAND_EQUIPMENT = ["Rice cooker or heavy pot", "Large bowl or sushi tub to cool the rice", "Rice paddle",
                  "Small bowl of water for your hands", "Kitchen scissors"]

MIXED_NOTE = ('For eggplant or pepperoncino, use rice with the prepared filling already mixed through it. '
              'Shape directly from that rice and skip the separate filling and central well below.')
METHOD_INTRO = ('One shaping method, from rice to serving. Prepare one of the '
                '<a href="onigiri.html#onigiri-choices-title">shop-inspired fillings</a> before you start. '
                'For eggplant or pepperoncino, mix the filling through the rice first and skip the central well. '
                '<a href="onigiri.html">Back to hand shaping and all fillings →</a>')
PREPARED = [("Filling", [("Prepared filling of your choice", "1–2 tsp per onigiri")])]
METHOD_RICE = deepcopy(RICE)
METHOD_RICE[0][1][-1] = ("Kosher salt (for shaping)", "a little for each onigiri")
MOLD_FINISH = [("To finish", [("Nori", "1–2 sheets, cut in thirds"), ("Furikake", "to coat (optional)")])]

MOLD = Recipe(
    slug="onigiri-mold", title="Onigiri with a mold", group=ORIGINAL.group,
    blurb="Fill, press and release: one dedicated mold method.", yields="about 4 onigiri, depending on mold size",
    serves=1, total="~1¼ h", intro=METHOD_INTRO,
    equipment=HAND_EQUIPMENT + ["Onigiri mold — triangle, with lid and push-out button"],
    ingredients=deepcopy(METHOD_RICE)+deepcopy(PREPARED)+deepcopy(MOLD_FINISH),
    steps=[replace(RICE_STEP, body=[RICE_STEP.body[0],
            COOK, "This batch makes about 330 g cooked rice; the number of onigiri depends on your mold's capacity.", RICE_STEP.body[-1]]),
           replace(ORIGINAL.steps[7], body=[MIXED_NOTE, *ORIGINAL.steps[7].body[:2],
                "Add 1–2 tsp of prepared filling in the middle, then rice to the brim and a little salt on top."], part="Shape with a mold"),
           replace(ORIGINAL.steps[8], body=["Fit the lid and press down evenly, stopping when you feel slight resistance. If there is no resistance, add a little rice.", ORIGINAL.steps[8].body[1],
                "Wet your fingers before touching it. Press only until the rice holds its shape; too much pressure makes it dense."], part="Shape with a mold"),
           deepcopy(FINISH_STEP)], notes=deepcopy(COMMON_NOTES), sources=ORIGINAL.sources, hero=ORIGINAL.hero)

WRAP = Recipe(
    slug="onigiri-plastic-wrap", title="Onigiri through plastic wrap", group=ORIGINAL.group,
    blurb="Fill and shape a rice triangle through plastic wrap, without handling the rice directly.",
    yields="3 onigiri", serves=1, total="~1¼ h", intro=METHOD_INTRO,
    equipment=HAND_EQUIPMENT+["Plastic wrap", "Small bowl"],
    ingredients=deepcopy(METHOD_RICE)+deepcopy(PREPARED)+deepcopy(FINISH),
    steps=[deepcopy(RICE_STEP),
           Step("Fill the wrap", [MIXED_NOTE,
               "Line a small bowl with plastic wrap, leaving enough overhang to gather it closed. Sprinkle a little salt inside.",
               "Add about 50 g warm rice, make a well, and put 1–2 tsp prepared filling in the center.",
               "Cover with another 50 g rice, seal it around the filling, and add a little salt on top."], part="Shape through wrap"),
           Step("Gather and shape", [
               "Gather the wrap above the rice and twist it closed. Shape gently through the wrap; do not squeeze the rice hard.",
               "Cup the rice from underneath with your left hand. Bend your right hand into a roof to make one corner, turn the rice a third of a turn, and repeat for three corners.",
               "Flatten each face lightly. Unwrap for serving; remove all plastic before eating."], part="Shape through wrap"),
           deepcopy(FINISH_STEP)], notes=deepcopy(COMMON_NOTES), sources=ORIGINAL.sources, hero=ORIGINAL.hero)
RECIPES = [MOLD, WRAP]

MAIN = replace(ORIGINAL,
    title="Onigiri: shape by hand",
    blurb="The basic hand-shaped rice triangle. Each filling and alternative method has its own recipe page.",
    yields="9 hand-shaped onigiri", intro=
    'This page teaches <b>hand shaping</b>: plain short-grain rice, a cupped left hand and a roof-shaped right hand. '
    'Choose <b>one shop-inspired filling recipe</b> below, or make plain rice triangles. '
    'Tokyo\'s Bongo inspires the bold combinations here; Asakusa Yadoroku the traditional fillings, and Kyoto\'s Nigihaya the eggplant mixed through rice. These are our home versions: the shops do not publish their recipes. The <b>mold</b> and <b>plastic-wrap</b> methods have separate pages; you do not follow them after hand shaping.',
    equipment=HAND_EQUIPMENT,
    ingredients=[deepcopy(ORIGINAL.ingredients[0]),
                 ("Filling (optional)", [("Prepared filling of your choice", "1–2 tsp per onigiri")]),
                 deepcopy(ORIGINAL.ingredients[3])],
    mise=[], timeline=[], timeline_note="", before_ingredients="",
    steps=[replace(ORIGINAL.steps[0], body=[ORIGINAL.steps[0].body[0], COOK,
                   "This batch makes about 990 g cooked rice, enough for nine hand-shaped onigiri.", ORIGINAL.steps[0].body[2]], heat=""), replace(ORIGINAL.steps[3], part="Shape by hand"),
           replace(ORIGINAL.steps[4], body=[MIXED_NOTE, ORIGINAL.steps[4].body[0],
                   "For a filled onigiri, press a small well and add 1–2 tsp of one prepared filling. For plain onigiri, leave the filling out.",
                   ORIGINAL.steps[4].body[2]], part="Shape by hand"),
           replace(ORIGINAL.steps[5], part="Shape by hand"),
               deepcopy(FINISH_STEP)],
    notes=deepcopy(COMMON_NOTES) + [
        deepcopy(SHOP.notes[0]),
        (SHOP.notes[1][0], SHOP.notes[1][1].replace('The peanut miso in step 6',
         'The <a href="peanut-miso-onigiri.html">peanut miso</a>')),
    ])
