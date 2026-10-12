"""All recipe content. Edit here (or add a module like curry.py), then run `python3 build.py`.

Each step's picture is a small function drawing a scene with the art kit;
`photos/<slug>/<step number>.jpg` (or .png/.webp) is shown next to it if present.
"""
import art as A
from art import Scene
from kit import (Bowl, Recipe, Step, Task, board_scene, from_bowl, mise_art, pan_scene,  # noqa: F401
                 pour_from, soak_scene, to_plate, two_bowls)

# ---------------------------------------------------------------- shared noodle text

NOODLE_PREP = (
    "Follow the packet’s <b>stir-fry preparation instructions</b>, stopping while they still have "
    "a little firmness. <b>Drain well and use promptly</b>; they’ll finish cooking in the sauce. "
    "Avoid fully softening them beforehand or aggressively stirring them in the pan."
)
RTE_STIRFRY = ("RecipeTin Eats — chicken stir-fry with rice noodles",
               "https://www.recipetineats.com/chicken-stir-fry-with-rice-noodles/")
RTE_PSE = ("RecipeTin Eats — Pad See Ew", "https://www.recipetineats.com/thai-stir-fried-noodles-pad-see-ew/")
RTE_PT = ("RecipeTin Eats — Chicken Pad Thai", "https://www.recipetineats.com/chicken-pad-thai/")
EPI_PT = ("Epicurious — 22-minute Pad Thai", "https://www.epicurious.com/recipes/food/views/22-minute-pad-thai-56390107")

# the soba alternatives (group "Soba"), offered on each rice-noodle page
SOBA_NOTE = ("Soba instead",
             "Established buckwheat-noodle dishes on this site. Hot: "
             "<a href=\"tori-nanban-soba.html\">tori nanban soba</a> (chicken and leek in dashi), "
             "<a href=\"curry-soba.html\">curry soba</a> and "
             "<a href=\"kake-soba.html\">kake soba</a> (soup). Cold: "
             "<a href=\"zaru-soba.html\">zaru soba</a> (with a dipping sauce) and "
             "<a href=\"bibim-naengmyeon.html\">bibim-naengmyeon</a> (spicy, Korean).")

NOODLE_SHOPPING = [
    ("Beyond the basics:", ["oyster sauce", "dark soy sauce", "fish sauce", "tamarind purée", "mushrooms", "bok choy",
                            "spring onions", "eggs", "bean sprouts", "roasted peanuts", "lime"]),
    "<b>Bok choy can cover both of the first two dishes</b>, so there’s no need to buy separate greens.",
]

# ---------------------------------------------------------------- 1. garlic–ginger noodles

GG_FINAL = [("noodles:garlic", 20), ("chicken_browned", 9), ("mushroom_browned", 6), ("leaf_wilted", 5), ("stem_cooked", 4)]

garlic_ginger = Recipe(
    slug="garlic-ginger-chicken-noodles",
    title="Garlic–ginger chicken noodles",
    group="Rice noodles",
    blurb="Mushrooms, bok choy and a sesame finish — the version closest to what’s already in the cupboard.",
    yields="1 generous serving",
    serves=1,
    total="~25 min",
    intro="The version closest to your existing ingredients, with mushrooms, greens and a sesame finish. "
          "Uses 100 g dried rice noodles and 150 g raw chicken.",
    equipment=["Large frying pan or wok", "Clean plate for the cooked chicken"],
    ingredients=[
        ("Main", [
            ("Dried flat rice noodles", "100 g"),
            ("Chicken breast or thigh", "150 g, thinly sliced"),
            ("Mushrooms", "100 g, sliced"),
            ("Bok choy", "100 g, chopped; stems and leaves separated"),
            ("Garlic", "2 cloves, finely chopped"),
            ("Ginger", "8 g, grated or finely chopped"),
            ("Spring onion", "1, sliced; whites and greens separated"),
            ("Neutral cooking oil", "1 tbsp (split in half)"),
            ("Toasted sesame oil", "½ tsp, for finishing"),
        ]),
        ("Sauce — mix together", [
            ("Soy sauce", "2¼ tsp"),
            ("Oyster sauce", "2¼ tsp"),
            ("Mirin", "1½ tsp"),
            ("Sake", "1½ tsp"),
            ("Rice vinegar", "1 tsp"),
            ("Water", "1½ tbsp"),
            ("Black or white pepper", "a pinch"),
        ]),
    ],
    mise=[
        Bowl("Chicken", "thinly sliced", [("chicken_raw", 8)], "Step 3", "plate"),
        Bowl("Mushrooms", "sliced", [("mushroom", 7)], "Step 4"),
        Bowl("Bok choy stems", "chopped", [("stem", 7)], "Step 5"),
        Bowl("Aromatics", "garlic · ginger · spring onion whites", [("garlic", 10), ("ginger", 8), ("sc_white", 6)], "Step 5", "cup"),
        Bowl("Bok choy leaves", "chopped", [("leaf", 6)], "Step 5"),
        Bowl("Noodles + sauce", "drained noodles; sauce mixed", [("noodles:soaked", 14), ("sauce:soy", 2)], "Step 6"),
        Bowl("To finish", "sesame oil · spring onion greens", [("sc_green", 8), ("oil", 3)], "Step 7", "cup"),
    ],
    timeline=[
        Task("Slice chicken", 0, 3, "board"),
        Task("Slice mushrooms, bok choy, aromatics", 3, 5, "board"),
        Task("Mix sauce", 8, 1, "bowl"),
        Task("Cook chicken → plate", 9, 4, "pan"),
        Task("Soak / boil noodles (packet time)", 11, 7, "wait"),
        Task("Brown mushrooms", 13, 4, "pan"),
        Task("Drain noodles", 18, 1, "bowl"),
        Task("Stems → aromatics → leaves", 17, 3, "pan"),
        Task("Noodles + sauce + chicken, fold", 20, 2, "pan"),
        Task("Heat off: sesame oil + greens", 22, .7, "pan"),
    ],
    timeline_note="Shift the noodle bar to match your packet: they should finish draining just before they go in the pan.",
    steps=[
        Step("Noodles first", NOODLE_PREP, lambda: soak_scene(11), time="per packet", uses=["Dried flat rice noodles"]),
        Step("Prep everything",
             ["Slice the chicken thinly.",
              "Slice the mushrooms.",
              "Chop the bok choy, keeping <b>stems and leaves separate</b>.",
              "Finely chop garlic and ginger; slice the spring onion, keeping <b>whites and greens separate</b>.",
              ("Mix the sauce in a small bowl:", ["soy sauce", "oyster sauce", "mirin", "sake", "rice vinegar", "water",
                                                  "black or white pepper"])],
             lambda: board_scene(12, [("chicken_raw", 9, "chicken"), ("mushroom", 6, "mushrooms"),
                                      ("stem", 6, "stems"), ("leaf", 4, "leaves"),
                                      ("bowl", [("sauce:soy", 3)], "sauce")], "Prep board"),
             time="~8 min", uses=["Chicken breast or thigh", "Mushrooms", "Bok choy", "Garlic", "Ginger", "Spring onion",
                                  "Soy sauce", "Oyster sauce", "Mirin", "Sake", "Rice vinegar", "Water",
                                  "Black or white pepper"]),
        Step("Cook the chicken",
             "Heat <b>half the neutral oil</b> in a large frying pan over medium-high heat. Brown the chicken and cook "
             "through, then transfer to a clean plate.",
             lambda: pan_scene(13, [("oil", 4), ("chicken_browned", 12)], "Chicken browning", sizzle=True,
                               side=to_plate([("chicken_browned", 4)]), notes=[(212, 150, "½ the oil")]),
             heat="medium-high", time="3–4 min"),
        Step("Brown the mushrooms",
             "Add the remaining oil and fry the mushrooms until browned, roughly 3–4 minutes.",
             lambda: pan_scene(14, [("oil", 3), ("mushroom_browned", 11)], "Mushrooms browning", sizzle=True,
                               notes=[(212, 150, "rest of the oil")]),
             heat="medium-high", time="3–4 min"),
        Step("Stems, then aromatics, then leaves",
             "Add bok choy <b>stems</b> for 1–2 minutes, followed by <b>garlic, ginger and spring onion whites</b> for "
             "30 seconds. Add the <b>leaves</b> and let them wilt.",
             lambda: pan_scene(15, [("mushroom_browned", 8), ("stem_cooked", 7), ("garlic", 8), ("ginger", 6),
                                    ("sc_white", 5), ("leaf_wilted", 6)], "Bok choy and aromatics",
                               notes=[(212, 140, "1 stems 1–2 min"), (212, 158, "2 aromatics 30 s"), (212, 176, "3 leaves, wilt")]),
             heat="medium-high", time="~3 min"),
        Step("Noodles, sauce and chicken",
             "Add the noodles, sauce and chicken. <b>Gently lift and fold</b> for roughly 1–2 minutes, until the noodles "
             "are tender and coated. Add water a tablespoon at a time if they remain firm but the pan is drying out.",
             lambda: pan_scene(16, GG_FINAL, "Folding noodles", side=from_bowl([("noodles:soaked", 10), ("sauce:soy", 1)]),
                               tool=("spatula", 118, 112, -32), notes=[(212, 150, "lift & fold,"), (212, 166, "don’t stir hard")]),
             heat="medium-high", time="1–2 min"),
        Step("Off the heat: finish",
             "Turn off the heat and add the <b>sesame oil and spring onion greens</b>. Keep this final stage brief to "
             "minimise noodle breakage.",
             lambda: pan_scene(17, GG_FINAL + [("sc_green", 10), ("oil", 3)], "Finished noodles", heat=0,
                               notes=[(212, 150, "heat off")]),
             heat="off", time="15 s", uses=["Toasted sesame oil"]),
    ],
    notes=[("Broccoli instead of bok choy",
            "Use small florets and briefly steam them before adding them with the mushrooms."),
           SOBA_NOTE],
    sources=[RTE_STIRFRY],
)

# ---------------------------------------------------------------- 2. pad see ew

PSE_FINAL = [("noodles:dark+brown", 20), ("chicken_cooked", 8), ("leaf_wilted", 6), ("stem_cooked", 4), ("egg_scrambled", 3)]

pad_see_ew = Recipe(
    slug="chicken-pad-see-ew",
    title="Chicken Pad See Ew",
    group="Rice noodles",
    blurb="Soy-rich, lightly sweet noodles with egg and greens — browned in the pan.",
    yields="1 generous serving",
    serves=1,
    total="~20 min",
    intro="Soy-rich, lightly sweet noodles with egg and greens. <b>Browning the noodles separately</b> from the "
          "other ingredients is the key technique here.",
    equipment=["Large frying pan or wok (non-stick helps the noodles brown without sticking)", "Plate"],
    ingredients=[
        ("Main", [
            ("Dried flat rice noodles", "100 g"),
            ("Chicken", "150 g, thinly sliced"),
            ("Chinese broccoli or bok choy", "125 g, chopped; stems and leaves separated"),
            ("Egg", "1"),
            ("Garlic", "2 cloves, finely chopped"),
            ("Neutral cooking oil", "1½ tbsp (½ + 1)"),
        ]),
        ("Sauce — mix together", [
            ("Oyster sauce", "1 tbsp"),
            ("Regular soy sauce", "1½ tsp"),
            ("Dark soy sauce", "1 tsp"),
            ("Rice vinegar", "1 tsp"),
            ("Sugar", "1 tsp"),
        ]),
    ],
    mise=[
        Bowl("Chicken", "thinly sliced", [("chicken_raw", 8)], "Step 3", "plate"),
        Bowl("Stems", "thinly sliced", [("stem", 7)], "Step 3"),
        Bowl("Garlic + leaves", "", [("leaf", 5), ("garlic", 8)], "Step 3"),
        Bowl("Egg", "cracked into a cup", [("egg_cracked", 1)], "Step 4", "cup"),
        Bowl("Noodles + sauce", "drained; sauce mixed", [("noodles:soaked", 14), ("sauce:dark", 2)], "Step 5"),
    ],
    timeline=[
        Task("Slice chicken", 0, 3, "board"),
        Task("Slice stems, chop leaves + garlic", 3, 4, "board"),
        Task("Mix sauce, crack egg", 7, 1.5, "bowl"),
        Task("Soak / boil noodles (packet time)", 6, 7, "wait"),
        Task("Chicken until nearly done", 9, 2.5, "pan"),
        Task("Stems, garlic, leaves", 11.5, 2, "pan"),
        Task("Drain noodles", 13, 1, "bowl"),
        Task("Scramble egg → everything to plate", 13.5, 1.5, "pan"),
        Task("Brown noodles in sauce", 15, 2, "pan"),
        Task("Return chicken mix, toss", 17, 1, "pan"),
    ],
    timeline_note="Shift the noodle bar to match your packet: they should be drained just before the browning step.",
    steps=[
        Step("Noodles first", NOODLE_PREP, lambda: soak_scene(21), time="per packet", uses=["Dried flat rice noodles"]),
        Step("Prep everything",
             ["Slice the chicken thinly.",
              "Slice the greens’ <b>stems thinly</b> and keep the leaves separate.",
              "Chop the garlic and crack the egg into a cup.",
              ("Mix the sauce:", ["oyster sauce", "regular soy sauce", "dark soy sauce", "rice vinegar", "sugar"])],
             lambda: board_scene(22, [("chicken_raw", 9, "chicken"), ("stem", 6, "stems"), ("leaf", 4, "leaves"),
                                      ("bowl", [("egg_cracked", 1)], "egg"), ("bowl", [("sauce:dark", 3)], "sauce")],
                                 "Prep board"),
             time="~8 min", uses=["Chicken", "Chinese broccoli or bok choy", "Garlic", "Egg", "Oyster sauce",
                                  "Regular soy sauce", "Dark soy sauce", "Rice vinegar", "Sugar"]),
        Step("Chicken and greens",
             "Heat <b>½ tablespoon oil</b> over medium-high heat. Cook the chicken until nearly done. Add the thinly "
             "sliced stems, then garlic and leaves; cook until the chicken is cooked through and greens are tender.",
             lambda: pan_scene(23, [("chicken_cooked", 10), ("stem_cooked", 6), ("garlic", 8), ("leaf_wilted", 5)],
                               "Chicken and greens", notes=[(212, 150, "½ tbsp oil"), (212, 166, "then stems,"), (212, 182, "garlic, leaves")]),
             heat="medium-high", time="~4 min"),
        Step("Egg",
             "Push everything aside, scramble the egg in the cleared space, then <b>transfer everything to a plate</b>.",
             lambda: pan_scene(24, [], "Egg scrambling beside the chicken",
                               egg=lambda sc, reg: A.push_aside(
                                   sc, *reg, [("chicken_cooked", 6), ("leaf_wilted", 4), ("stem_cooked", 3)],
                                   lambda s2, r2: A.fill(s2, r2, [("egg_scrambled", 4)])),
                               side=to_plate([("chicken_cooked", 3), ("leaf_wilted", 2), ("egg_scrambled", 1)], "→ all to plate")),
             heat="medium-high", time="~1 min"),
        Step("Brown the noodles",
             "Add the <b>remaining 1 tablespoon oil</b>, the noodles and the sauce. <b>Spread out, leave briefly to "
             "brown</b>, then gently turn. Cook for roughly 1–2 minutes.",
             lambda: pan_scene(25, [("oil", 3), ("noodles:dark+brown", 24)], "Noodles browning", sizzle=True,
                               notes=[(212, 150, "spread out,"), (212, 166, "leave to brown,"), (212, 182, "then turn")]),
             heat="medium-high", time="1–2 min"),
        Step("Toss and serve",
             "Return the chicken mixture, toss briefly and serve.",
             lambda: pan_scene(26, PSE_FINAL, "Pad See Ew tossed", tool=("spatula", 110, 120, -28), side=from_bowl([("chicken_cooked", 3), ("leaf_wilted", 2), ("egg_scrambled", 1)], vessel="plate")),
             heat="medium-high", time="~30 s"),
    ],
    notes=[("No dark soy?", "Substitute the same amount of regular soy; the noodles will be paler."), SOBA_NOTE],
    sources=[RTE_PSE],
)

# ---------------------------------------------------------------- 3. pad thai

PT_FINAL = [("noodles:padthai", 20), ("chicken_cooked", 8), ("egg_scrambled", 3), ("sprouts", 7), ("sc_length", 6)]


def pad_thai_plate():
    sc = Scene(37)
    region = A.plate(sc, 140, 100, 88)
    A.fill(sc, region, PT_FINAL)
    A.fill(sc, (140, 100, 44), [("peanut", 12), ("chilli", 10)])
    A.scatter(sc, "lime", 214, 160, 2, 1)
    A.label(sc, 262, 60, "peanuts", anchor="start")
    A.label(sc, 250, 172, "lime", anchor="start")
    return sc.render("Pad Thai plated with peanuts and lime")


pad_thai = Recipe(
    slug="chicken-pad-thai",
    title="Chicken Pad Thai",
    group="Rice noodles",
    blurb="Tangy tamarind, sweet-salty sauce, egg, crunchy peanuts and lime.",
    yields="1 generous serving",
    serves=1,
    total="~20 min",
    intro="A <b>simplified home version</b>: tangy tamarind, sweet-salty sauce, egg, crunchy peanuts and lime. "
          "No mirin, sake or sesame oil needed.",
    equipment=["Large frying pan or wok", "Clean plate"],
    ingredients=[
        ("Main", [
            ("Dried flat rice noodles", "100 g"),
            ("Chicken", "150 g, thinly sliced"),
            ("Egg", "1"),
            ("Garlic", "2 cloves, finely chopped"),
            ("Spring onions", "2; whites sliced, greens cut into short lengths"),
            ("Bean sprouts", "60–80 g"),
            ("Neutral cooking oil", "1 tbsp (split in half)"),
        ]),
        ("Sauce — stir until the sugar dissolves", [
            ("Tamarind purée", "1½ tbsp"),
            ("Fish sauce", "1 tbsp"),
            ("Brown or palm sugar", "1 tbsp"),
            ("Warm water", "2 tbsp"),
        ]),
        ("To serve", [
            ("Roasted peanuts", "15 g, roughly crushed"),
            ("Lime", "½, cut into wedges"),
            ("Chilli flakes", "optional, to taste"),
        ]),
    ],
    mise=[
        Bowl("Chicken", "thinly sliced", [("chicken_raw", 8)], "Step 3", "plate"),
        Bowl("Garlic + whites", "", [("garlic", 10), ("sc_white", 7)], "Step 3", "cup"),
        Bowl("Egg", "", [("egg_cracked", 1)], "Step 4", "cup"),
        Bowl("Noodles + sauce", "drained; sauce dissolved", [("noodles:soaked", 14), ("sauce:tamarind", 2)], "Step 5"),
        Bowl("Sprouts + greens", "", [("sprouts", 7), ("sc_length", 5)], "Step 6"),
        Bowl("To serve", "peanuts · lime · chilli", [("peanut", 9), ("chilli", 8)], "Step 7", "plate"),
    ],
    timeline=[
        Task("Slice chicken", 0, 3, "board"),
        Task("Garlic, spring onions", 3, 2, "board"),
        Task("Crush peanuts, cut lime", 5, 1.5, "board"),
        Task("Mix sauce", 6.5, 1.5, "bowl"),
        Task("Soak / boil noodles (packet time)", 5, 8, "wait"),
        Task("Chicken (+ garlic & whites last 30 s) → plate", 9, 4.5, "pan"),
        Task("Drain noodles", 13, 1, "bowl"),
        Task("Scramble egg", 13.5, 1, "pan"),
        Task("Noodles + sauce, fold until absorbed", 14.5, 2.5, "pan"),
        Task("Chicken, sprouts, greens back in", 17, 1.5, "pan"),
        Task("Plate + peanuts, lime", 18.5, .7, "bowl"),
    ],
    timeline_note="Shift the noodle bar to match your packet: they should be drained right before step 5.",
    steps=[
        Step("Noodles first", NOODLE_PREP, lambda: soak_scene(31), time="per packet", uses=["Dried flat rice noodles"]),
        Step("Prep everything",
             ["Slice the chicken.",
              "Chop the garlic; slice the spring onion whites and cut the greens into short lengths.",
              "Crush the peanuts, cut the lime into wedges.",
              ("Stir the sauce until the sugar dissolves:", ["tamarind purée", "fish sauce", "brown or palm sugar",
                                                             "warm water"])],
             lambda: board_scene(32, [("chicken_raw", 9, "chicken"), ("sc_length", 6, "greens"), ("sprouts", 6, "sprouts"),
                                      ("peanut", 9, "peanuts"), ("bowl", [("sauce:tamarind", 3)], "sauce")], "Prep board"),
             time="~8 min", uses=["Chicken", "Garlic", "Spring onions", "Roasted peanuts", "Lime", "Tamarind purée",
                                  "Fish sauce", "Brown or palm sugar", "Warm water"]),
        Step("Chicken and aromatics",
             "Heat <b>half the oil</b> over medium-high heat. Fry the chicken until cooked through. Add garlic and "
             "spring onion whites for the final 30 seconds, then transfer to a clean plate.",
             lambda: pan_scene(33, [("chicken_browned", 11), ("garlic", 9), ("sc_white", 6)], "Chicken with garlic",
                               side=to_plate([("chicken_browned", 4)]), notes=[(212, 150, "½ the oil"), (212, 166, "garlic + whites"), (212, 182, "last 30 s")]),
             heat="medium-high", time="~4 min"),
        Step("Egg",
             "Add the <b>remaining oil</b>, crack in the egg and scramble until just set.",
             lambda: pan_scene(34, [("oil", 3), ("egg_scrambled", 6)], "Egg scrambling", notes=[(212, 150, "rest of the oil")]),
             heat="medium-high", time="~1 min", uses=["Egg"]),
        Step("Noodles and sauce",
             "Add the prepared noodles and sauce. <b>Gently fold</b> over medium-high heat until the noodles are tender "
             "and most of the sauce is absorbed. Add a little more water if necessary.",
             lambda: pan_scene(35, [("sauce:tamarind", 3), ("noodles:padthai", 22), ("egg_scrambled", 4)], "Noodles in tamarind sauce",
                               tool=("spatula", 112, 118, -30), side=from_bowl([("noodles:soaked", 10), ("sauce:tamarind", 1)])),
             heat="medium-high", time="2–3 min"),
        Step("Chicken, sprouts, greens",
             "Return the chicken, then fold in the bean sprouts and spring onion greens; cook until hot.",
             lambda: pan_scene(36, PT_FINAL, "Pad Thai with sprouts", side=from_bowl([("sprouts", 4), ("sc_length", 3)])),
             heat="medium-high", time="~1 min", uses=["Bean sprouts"]),
        Step("Serve", "Serve with crushed peanuts, lime and optional chilli.", pad_thai_plate, uses=["Chilli flakes"]),
    ],
    notes=[
        ("Buy tamarind purée/paste, not concentrate",
         "Buy tamarind purée/paste rather than a highly concentrated extract: the strength varies, and strong "
         "concentrate cannot be substituted spoon for spoon. The tamarind supplies the characteristic sourness."),
        ("No tamarind?",
         "For a lime-based approximation, start with <b>1 tablespoon lime juice instead</b>, then adjust after "
         "cooking. It won’t taste identical, but lime is a workable fallback."),
        SOBA_NOTE,
    ],
    sources=[RTE_PT, EPI_PT],
    hero=pad_thai_plate,
)

# ---------------------------------------------------------------- oyakodon

OYA_TOP = [("onion_cooked", 9), ("ginger", 5), ("chicken_simmered", 10)]


def oyakodon_bowl():
    sc = Scene(48)
    cx, cy, r = A.donburi(sc, 150, 100, 90)
    A.rice(sc, cx, cy, r)
    A.fill(sc, (cx, cy, r * .78), [("sauce:dashi", 1)] + OYA_TOP + [("egg_soft", 1)])
    A.fill(sc, (cx, cy, r * .5), [("sc_green", 10), ("shichimi", 14)])
    return sc.render("Oyakodon in a bowl")


def oyakodon_marinating():
    sc = Scene(49)
    A.fill(sc, A.bowl(sc, 130, 100, 84), [("sauce:marinade", 4), ("kombu", 1), ("chicken_raw", 10)])
    A.label(sc, 272, 64, "dashi · kombu\nsoy · mirin\nsake · sugar")
    A.label(sc, 272, 150, "15–30 min")
    return sc.render("Chicken in the marinade")


oyakodon = Recipe(
    slug="oyakodon",
    title="Oyakodon",
    group="Japanese",
    blurb="Chicken marinated in kombu-dashi and soy, simmered with ginger and onion, set with softly cooked egg over rice.",
    yields="1 bowl",
    serves=1,
    total="~35 min (+ rice)",
    intro="“Parent-and-child” rice bowl. The chicken sits in the sauce — <b>kombu, dashi, soy, mirin, sake and "
          "sugar</b> — while finely chopped ginger and onion soften in the pan with a pinch of salt. Then the chicken goes in "
          "with all of its marinade, gets bound with <b>barely set egg</b> poured in two stages, and slides over hot "
          "rice.",
    equipment=["Small frying pan, 18–20 cm, <b>with a lid</b> (a small pan keeps the egg in a thick layer)",
               "Donburi or deep bowl"],
    ingredients=[
        ("Main", [
            ("Chicken thigh fillets", "150 g (about 1–2 fillets), 2–3 cm pieces (breast works; cook 1–2 min less)"),
            ("Onion", "½ small (~60 g), ends cut off, sliced lengthwise ~5 mm"),
            ("Ginger", "a 2 cm piece (~8 g), finely chopped"),
            ("Salt", "a pinch"),
            ("Neutral oil", "1 tsp"),
            ("Eggs", "2"),
            ("Cooked short-grain rice", "1 bowl (~200 g cooked, from ~80 g raw)"),
        ]),
        ("Sauce / chicken marinade", [
            ('<a href="niboshi-bonito-dashi.html">Dashi</a>', "80 ml (or 80 ml water + ¼ tsp dashi powder)"),
            ("Kombu", "a 5 cm square"),
            ("Soy sauce", "4 tbsp"),
            ("Mirin", "1 tbsp"),
            ("Sake", "1 tbsp"),
            ("Sugar", "1 tsp"),
        ]),
        ("To serve", [
            ("Spring onion greens or mitsuba", "a few, sliced"),
            ("Shichimi togarashi", "optional"),
        ]),
    ],
    mise=[
        Bowl("Chicken in marinade", "dashi · kombu · soy · mirin · sake · sugar",
             [("sauce:marinade", 3), ("kombu", 1), ("chicken_raw", 7)], "Step 7"),
        Bowl("Ginger", "finely chopped", [("ginger", 9)], "Step 5", "cup"),
        Bowl("Onion", "sliced lengthwise · pinch of salt", [("onion", 10)], "Step 5"),
        Bowl("Eggs", "loosely beaten", [("egg_beaten", 1)], "Steps 8–9"),
        Bowl("Rice + garnish", "hot rice · spring onion", [("rice", 1), ("sc_green", 6)], "Step 10"),
    ],
    timeline=[
        Task("Cook rice (start first; or reheat)", 0, 45, "wait"),
        Task("Cut chicken, mix marinade", 10, 5, "board"),
        Task("Chicken marinates", 15, 21, "wait"),
        Task("Slice onion + ginger", 20, 5, "board"),
        Task("Beat eggs", 25, 1, "bowl"),
        Task("Ginger, onion + salt", 27, 3, "pan"),
        Task("Pan cools down", 30, 6, "wait"),
        Task("Chicken + marinade, covered", 36, 6, "pan"),
        Task("Pour ⅔ egg, cover", 42, 1, "pan"),
        Task("Pour ⅓ egg, heat off, rest", 43, 1, "pan"),
        Task("Slide onto rice, garnish", 44, .8, "bowl"),
    ],
    timeline_note="If your rice is already cooked, skip the first bar — about 35 minutes, most of it the chicken "
                  "marinating.",
    steps=[
        Step("Rice first",
             "Have a bowl of hot rice ready before you start the pan — the egg won’t wait. Start the rice cooker "
             "about 45 minutes ahead, or reheat leftover rice until steaming.",
             lambda: (lambda sc: (A.rice(sc, *A.donburi(sc, 150, 100, 88)), A.steam(sc, 150, 30, 3, 50), sc.render("Bowl of rice"))[2])(Scene(41)),
             time="~45 min ahead", uses=["Cooked short-grain rice"]),
        Step("Marinate the chicken",
             ["Trim the thigh fillets of any excess fat and cut them into 2–3 cm pieces.",
              ("In a bowl, stir until the sugar dissolves:", ["dashi", "soy sauce", "mirin", "sake", "sugar"]),
              "Drop in the kombu, then the chicken.",
              "Leave it 15–30 minutes (in the fridge if longer)."],
             oyakodon_marinating, time="~5 min + 15–30 min",
             uses=["Chicken thigh fillets", "Dashi", "Kombu", "Soy sauce", "Mirin", "Sake", "Sugar"]),
        Step("Onion and ginger",
             ["Onion: cut off both ends (root and tip), halve it through the cut ends and peel.",
              "Lay each half flat and slice it <b>lengthwise — perpendicular to the cut ends</b>, along the lines — about "
              "5 mm thick. Slicing across the lines gives rings that fall apart; lengthwise slices hold their shape "
              "in the pan.",
              "Ginger: peel, cut into thin matchsticks, then across into <b>tiny cubes</b>."],
             lambda: board_scene(42, [("onion", 12, "onion, ~5 mm"), ("ginger", 12, "ginger, chopped")], "Onion and ginger cut"),
             time="~5 min", uses=["Onion", "Ginger"]),
        Step("Beat the eggs",
             "Crack the eggs into a bowl and beat <b>loosely — 4–5 strokes with chopsticks</b>, cutting through the "
             "whites. You want streaks of white and yolk, not a uniform yellow.",
             lambda: two_bowls(43, [("egg_beaten", 1)], [("egg_beaten", 1)], "Loosely beaten eggs",
                               "", "streaky, not smooth", chop=True),
             time="~1 min", uses=["Eggs"]),
        Step("Ginger, then onion",
             "Small pan, the oil, medium-low heat. Drop in the ginger for ~30 seconds until fragrant, then add the "
             "onion and a pinch of salt. Stir until the onion is <b>a bit soft</b> — 2–3 minutes, no colour.",
             lambda: pan_scene(50, [("oil", 3), ("ginger", 8), ("onion_cooked", 12), ("salt", 10)],
                               "Ginger and onion softening", r=74, sizzle=True, heat=.45),
             heat="medium-low", time="~3 min", uses=["Neutral oil", "Ginger", "Onion", "Salt"]),
        Step("Let it cool down",
             "Take the pan off the heat and let it cool for a few minutes while the chicken finishes marinating.",
             lambda: pan_scene(51, [("ginger", 6), ("onion_cooked", 13)], "Ginger and onion cooling off the heat",
                               r=74, heat=0, notes=[(212, 160, "off the heat,"), (212, 176, "~5 min")]),
             heat="off", time="~5 min"),
        Step("Chicken in, with all the marinade",
             "Back on medium. Tip in the chicken <b>with all of its marinade</b> (kombu too), spread it in a single "
             "layer. Bring to a simmer, cover, and simmer, turning once, until cooked through with "
             "no pink inside.",
             lambda: pan_scene(45, [("sauce:dashi", 4), ("kombu", 1)] + OYA_TOP, "Chicken simmering under a lid", r=74,
                               lid=True, lid_dx=22, notes=[(212, 160, "lid on,"), (212, 176, "turn once")]),
             heat="medium", time="5–6 min"),
        Step("Pour ⅔ of the egg",
             "Fish out the kombu. Drizzle <b>about two-thirds</b> of the egg in a circle over the chicken and onion. "
             "Cover and cook until the egg at the edges is set but the top is still runny.",
             lambda: pan_scene(46, [("sauce:dashi", 4)] + OYA_TOP + [("egg_soft", 1)], "First egg pour", r=74,
                               side=pour_from([("egg_beaten", 1)], "⅔ of the egg")),
             heat="medium", time="30–60 s"),
        Step("Pour the rest, heat off",
             "Pour the remaining egg, cook 10–15 seconds, then <b>turn off the heat</b> and cover for 30 seconds. "
             "The egg should be glossy and just set. Cook a little longer covered if you prefer it firm.",
             lambda: pan_scene(47, [("sauce:dashi", 4)] + OYA_TOP + [("egg_soft", 1), ("egg_soft", 1)], "Second egg pour, resting",
                               r=74, heat=0, lid=True, lid_dx=26, notes=[(212, 160, "heat off,"), (212, 176, "lid 30 s")]),
             heat="off", time="~45 s"),
        Step("Slide onto the rice",
             "Tilt the pan and slide everything, broth included, over the rice. Top with spring onion greens or "
             "mitsuba and a shake of shichimi.",
             oyakodon_bowl, uses=["Spring onion greens or mitsuba", "Shichimi togarashi"]),
    ],
    notes=[
        ("Filled in from your description",
         "The method is yours; these details are my guesses — adjust and tell me: <b>1 tsp oil</b> for the ginger; "
         "marinating <b>15–30 min</b>; the <b>kombu goes into the pan</b> with the marinade and comes out before the "
         "egg; the pan cools <b>~5 min</b> off the heat before the chicken goes in."),
        ("Sous vide chicken shortcut",
         "Cook the breast in the bath first (<a href=\"sous-vide.html#chicken-breast\">63 °C, 60–75 min for ~2 cm</a>), "
         "then slice it. Skip marinating: after the ginger and onion (step 5), pour in the sauce, bring it to a simmer "
         "and add the cooked chicken for just <b>1 minute</b> — no longer, or it tightens — then go straight to the egg."),
        ("Dashi",
         "Homemade is best — see <a href=\"niboshi-bonito-dashi.html\">niboshi–bonito dashi</a>. "
         "Water plus ¼ tsp dashi powder is the quick version; the kombu in the marinade adds depth either way."),
        ("Soft eggs",
         "The eggs end up only just set. If anyone eating should avoid undercooked egg, keep the lid on with the heat "
         "low for another minute or two until fully set."),
    ],
    hero=oyakodon_bowl,
)

# ---------------------------------------------------------------- sous vide beets


def beets_bag_scene():
    sc = Scene(53)
    sc += '<rect x="40" y="20" width="240" height="160" rx="14" fill="#ffffff" opacity=".55" stroke="#7d9fb3" stroke-width="2"/>'
    sc += '<rect x="48" y="28" width="224" height="6" rx="3" fill="#7d9fb3" opacity=".6"/>'
    A.scatter_rect(sc, "beet", 60, 50, 200, 110, 11)
    A.scatter_rect(sc, "thyme", 70, 60, 180, 100, 2)
    A.scatter_rect(sc, "garlic_slice", 70, 60, 180, 100, 4)
    A.scatter_rect(sc, "oil", 70, 60, 180, 100, 5)
    A.label(sc, 160, 192, "single layer · air out · one colour per bag")
    return sc.render("Beets laid flat in a bag")


def beets_bath_scene():
    sc = Scene(54)
    x, y, w, h = A.bath(sc, 34, 44, 230, 140, "85°C")
    A.bag(sc, x + 6, y + 8, w - 10, h - 18, ("beet", 6), clip_to_rim=(x + 4, 44))
    A.label(sc, 300, 190, "weigh down", anchor="end")
    return sc.render("Bag of beets in an 85 °C water bath")


def beets_ice_scene():
    sc = Scene(55)
    cx, cy, r = A.bowl(sc, 150, 100, 88, band="#7d9fb3")
    A.water(sc, cx, cy, r)
    A.scatter(sc, "ice", cx, cy, r * .85, 9)
    sc += '<rect x="96" y="70" width="108" height="62" rx="10" fill="#ffffff" opacity=".55" stroke="#7d9fb3" stroke-width="1.6"/>'
    A.scatter_rect(sc, "beet_cooked", 106, 82, 88, 40, 4)
    A.label(sc, 300, 56, "ice bath\n15–20 min", anchor="end")
    A.label(sc, 300, 150, "then fridge\n≤ 5 days", anchor="end")
    return sc.render("Bag of beets chilling in ice water")


def beets_plate():
    sc = Scene(56)
    region = A.plate(sc, 150, 100, 90)
    A.fill(sc, region, [("beet_cooked", 12), ("feta", 10), ("walnut", 6), ("dill", 4)])
    return sc.render("Beets with feta, walnuts and dill")


def beets_preheat():
    sc = Scene(51)
    A.bath(sc, 34, 44, 230, 140, "85°C")
    A.label(sc, 120, 34, "preheat to 85 °C", size=12)
    return sc.render("Water bath preheating")


sous_vide_beets = Recipe(
    slug="sous-vide-beets",
    title="Sous vide beets",
    group="Sous vide",
    blurb="Tender, intensely beet-y quarters at 85 °C — no boiling away the flavour, no oven.",
    yields="500 g batch · 3–4 sides",
    serves=3,
    total="~2–3 h, mostly hands-off",
    intro="Vegetables need a much hotter bath than meat: at <b>85 °C</b> the pectin that holds beets firm "
          "breaks down, so they turn tender while keeping all their flavour and colour in the bag. Make a "
          "batch, chill it, and use it all week.",
    equipment=["Immersion circulator + container", "Vacuum sealer + vacuum bags",
               "Clip and something heavy to keep the bag under", "Gloves for peeling (beet juice stains)"],
    ingredients=[
        ("Main", [
            ("Red beets", "500 g (~3 medium)"),
            ("Olive oil", "1 tbsp"),
            ("Salt", "½ tsp"),
            ("Vinegar (red wine, balsamic or rice)", "1 tsp"),
        ]),
        ("Optional, in the bag", [
            ("Thyme", "2 sprigs"),
            ("Garlic", "1 clove, sliced"),
        ]),
        ("To serve (pick some)", [
            ("Feta or goat cheese", "crumbled"),
            ("Walnuts", "toasted"),
            ("Dill", "chopped"),
            ("Flaky salt + olive oil", "to finish"),
        ]),
    ],
    mise=[
        Bowl("Beets", "peeled, quartered", [("beet", 7)], "Step 3"),
        Bowl("Bag seasoning", "oil · salt · vinegar · thyme · garlic", [("oil", 4), ("thyme", 1), ("garlic_slice", 3), ("salt", 8)], "Step 3", "cup"),
        Bowl("Ice bath", "for chilling after", [("water", 1), ("ice", 5)], "Step 5"),
    ],
    timeline=[
        Task("Heat bath to 85 °C", 0, 25, "bath"),
        Task("Peel + quarter (gloves)", 0, 15, "board"),
        Task("Season + vacuum seal", 15, 7, "bowl"),
        Task("Cook quarters ~2 h", 25, 120, "wait"),
        Task("Ice bath", 145, 18, "bowl"),
    ],
    steps=[
        Step("Preheat the bath", "Set the circulator to <b>85 °C</b>. Prep while it heats.", beets_preheat, time="15–30 min"),
        Step("Peel and quarter",
             "Wear gloves. Peel with a vegetable peeler and cut each beet into <b>quarters</b>.",
             lambda: board_scene(52, [("beet_whole", 1, "whole"), ("beet", 10, "quarters")], "Beets cut into quarters"),
             time="~15 min", uses=["Red beets"]),
        Step("Season and vacuum seal",
             [("Bag the beets in a <b>single layer</b> with (thyme and garlic optional):",
               ["olive oil", "salt", "vinegar (red wine, balsamic or rice)", "thyme", "garlic"]),
              "Seal with the vacuum sealer."],
             beets_bag_scene, time="~5 min",
             uses=["Olive oil", "Salt", "Vinegar (red wine, balsamic or rice)", "Thyme", "Garlic"]),
        Step("Cook",
             "Clip the bag to the side and weigh it down — vegetables float, and the bag can puff up as it cooks. "
             "<table class=\"mini\"><thead><tr><th>Cut</th><th>Time at 85 °C</th></tr></thead><tbody>"
             "<tr><td>Quarters, medium beets</td><td>about 2 h</td></tr>"
             "<tr><td>Quarters, large beets</td><td>2–2½ h</td></tr></tbody></table>"
             "<b>Check:</b> squeeze a piece through the bag with a towel — it should give like a cooked potato. "
             "Still firm? Another 30 minutes. A little over is fine; they just get softer.",
             beets_bath_scene, heat="85 °C bath", time="~2 h"),
        Step("Chill or serve warm",
             "To store, drop the sealed bag into ice water for 15–20 minutes, then refrigerate unopened and use within "
             "5 days.",
             beets_ice_scene, time="15–20 min"),
        Step("Serve",
             [("Warm, with:", ["butter", "flaky salt"]),
              ("Or cold, with:", ["crumbled feta or goat cheese", "walnuts", "dill", "a splash of vinegar", "olive oil"]),
              "They also go well tossed with the <a href=\"cucumber-sunomono.html\">cucumber pickle</a> dressing."],
             beets_plate, uses=["Feta or goat cheese", "Walnuts", "Dill", "Flaky salt + olive oil"]),
    ],
    notes=[("Cook times", "The quarter times are a starting point — trust the squeeze test."),
           ("Sous vide table", "All the other bath times are on the <a href=\"sous-vide.html\">sous vide quick tables</a> page.")],
    hero=beets_plate,
)

# ---------------------------------------------------------------- cucumber sunomono

import vinegar as V  # noqa: E402

CUKE_VINEGAR = V.options(30, "8 g (2 tsp)", "10 g (2½ tsp)")   # the marinade's 2 tbsp of rice vinegar


def cucumber_board():
    sc = Scene(61)
    A.board(sc, 10, 12, 300, 176)
    sc += ('<g filter="url(#f-food)"><rect x="30" y="40" width="130" height="28" rx="14" fill="#3f7a32" stroke="#2c5a22" stroke-width="1.2"/>'
           '<path d="M40,48 h110 M44,58 h100" stroke="#5f9a4a" stroke-width="2" stroke-dasharray="3 7"/>'
           '<path d="M38,45 h112" stroke="#fff" stroke-width="1.2" opacity=".3"/>'
           '<ellipse cx="160" cy="54" rx="4" ry="14" fill="#eef8de" stroke="#3f7a32" stroke-width="2"/></g>')
    A.scatter_rect(sc, "cucumber", 40, 86, 250, 76, 16)
    A.knife(sc, 196, 50, a=8, s=.8)
    A.label(sc, 160, 182, "~2 mm slices")
    return sc.render("Cucumber sliced thin")


def cucumber_salt():
    sc = Scene(62)
    cx, cy, r = A.bowl(sc, 130, 100, 86)
    A.scatter(sc, "cucumber", cx, cy, r * .85, 20)
    A.scatter(sc, "salt", cx, cy, r * .8, 40)
    A.scatter(sc, "drop", cx, cy, r * .8, 7)
    A.label(sc, 272, 90, "½ tsp salt\n10 min")
    return sc.render("Salted cucumber releasing water")


def cucumber_rinse():
    sc = Scene(65)
    cx, cy, r = A.sieve(sc, 118, 108, 74, handle_angle=-25)
    A.scatter(sc, "cucumber", cx, cy, r * .8, 16)
    A.scatter(sc, "drop", cx, cy, r * .8, 10)
    A.pour(sc, 150, 4, 110, 96, "#bfe3f4", "#7fb7d6")
    A.label(sc, 272, 120, "rinse off\nthe salt")
    A.label(sc, 272, 172, "squeeze hard")
    return sc.render("Rinsing the salted cucumber")


def cucumber_aromatics():
    sc = Scene(66)
    cx, cy, r = A.bowl(sc, 128, 100, 86)
    A.pool(sc, cx, cy, r * .55, "#efe3b8", .7, name="vinegar")
    A.scatter(sc, "cucumber", cx, cy, r * .82, 18)
    A.scatter(sc, "ginger", cx, cy, r * .6, 14)
    A.scatter(sc, "garlic", cx, cy, r * .6, 12)
    A.label(sc, 270, 74, "grated ginger\n+ garlic")
    A.label(sc, 270, 136, "1 tbsp\nrice vinegar")
    return sc.render("Cucumber tossed with ginger, garlic and rice vinegar")


def cucumber_marinade():
    sc = Scene(63)
    A.bottle(sc, 44, 92, "VINEGAR", body="#f3ecd0", h=96)
    A.bottle(sc, 96, 92, "MIRIN", body="#f2d98a", h=96)
    cx, cy, r = A.bowl(sc, 214, 100, 70)
    A.pool(sc, cx, cy, r * .8, "#efe3b8", .9, name="vinegar")
    A.scatter(sc, "sugar", cx, cy, r * .6, 20)
    A.arrow(sc, 60, 40, 158, 70, bend=-.2)
    A.label(sc, 214, 188, "stir until sugar dissolves")
    return sc.render("Mixing the marinade")


def cucumber_final():
    sc = Scene(64)
    cx, cy, r = A.bowl(sc, 150, 100, 88, band="#3f6fa0")
    A.pool(sc, cx, cy, r * .9, "#efe3b8", .8, name="vinegar")
    A.scatter(sc, "cucumber_pickled", cx, cy, r * .82, 22)
    A.scatter(sc, "ginger", cx, cy, r * .6, 8)
    A.scatter(sc, "sesame", cx, cy, r * .6, 30)
    return sc.render("Cucumber sunomono with sesame")


cucumber = Recipe(
    slug="cucumber-sunomono",
    title="Japanese cucumber pickle (sunomono)",
    group="Japanese basics",
    blurb="Salted, rinsed and squeezed cucumber with ginger and garlic, in a vinegar–mirin–sugar marinade.",
    yields="2 side servings",
    serves=2,
    total="~20 min + marinating",
    intro="Crisp and sweet-sour. Salting pulls the water out; rinsing takes the salt back off so the marinade does "
          "the seasoning. Ginger, garlic and a splash of rice vinegar go in first, then the vinegar–mirin–sugar "
          "marinade, with light soy and sesame at the very end. No rice vinegar for the marinade? Pick your vinegar "
          "below — the amounts update to match.",
    before_ingredients=V.picker(CUKE_VINEGAR),
    vinegar_options=CUKE_VINEGAR,
    batch=V.batch(CUKE_VINEGAR, mirin_ml=15, sugar_rice_g=8, sugar_other_g=10),
    ingredients=[
        ("Main", [
            ("Cucumber", "250 g (1 regular, or 2–3 small Japanese / Persian)"),
            ("Fine salt, for drawing out water", "½ tsp"),
        ]),
        ("First seasoning", [
            ("Ginger, grated", "1 tsp"),
            ("Garlic, grated", "1 small clove"),
            ("Rice vinegar (first splash)", "1 tbsp"),
        ]),
        ("Marinade", [
            (V.v("name", "Rice vinegar"), V.v("amount", "2 tbsp (30 ml)")),
            ('<span data-v-row="water">Water</span>', V.v("water", "—")),
            ("Mirin", "1 tbsp (15 ml) — half the vinegar, 2 : 1"),
            ("Sugar", V.v("sugar", "8 g (2 tsp)")),
        ]),
        ("To finish", [
            ("Light soy sauce (usukuchi)", "½–1 tsp"),
            ("Toasted sesame seeds", "1 tsp"),
        ]),
    ],
    mise=[
        Bowl("Cucumber", "sliced, salted, rinsed, squeezed", [("cucumber", 9)], "Step 3"),
        Bowl("Ginger + garlic", "grated, + rice vinegar", [("ginger", 10), ("garlic", 8)], "Step 4", "cup"),
        Bowl("Marinade", "vinegar · mirin · sugar", [("sauce:vinegar", 3), ("sugar", 12)], "Step 5", "cup"),
        Bowl("Finish", "light soy · sesame", [("sesame", 26)], "Step 6", "cup"),
    ],
    timeline=[
        Task("Slice cucumber", 0, 3, "board"),
        Task("Salt and rest", 3, 10, "wait"),
        Task("Grate ginger + garlic, mix marinade", 5, 4, "bowl"),
        Task("Rinse, squeeze", 13, 2, "bowl"),
        Task("Ginger, garlic, rice vinegar", 15, 1, "bowl"),
        Task("Marinade in", 16, 1, "bowl"),
        Task("Marinate in the fridge", 17, 20, "wait"),
        Task("Light soy + sesame", 37, 1, "bowl"),
    ],
    timeline_note="Marinate anywhere from 10 minutes (crispest) to an hour.",
    steps=[
        Step("Slice thin",
             "Slice the cucumber about <b>2 mm</b> thick (a mandoline makes this quick). Peeling a few stripes off "
             "first looks nice but is optional.",
             cucumber_board, time="~3 min", uses=["Cucumber"]),
        Step("Salt and rest",
             "Toss with ½ tsp salt and leave 10 minutes to pull the water out.",
             cucumber_salt, time="10 min", uses=["Fine salt, for drawing out water"]),
        Step("Rinse and squeeze",
             "Rinse the salt off under cold water, then <b>squeeze firmly</b> by the handful — this is what keeps "
             "them crunchy and stops them watering down the marinade.",
             cucumber_rinse, time="~2 min"),
        Step("Ginger, garlic, rice vinegar",
             "Add the grated ginger and garlic and the 1 tbsp rice vinegar. Mix it up.",
             cucumber_aromatics, time="~1 min", uses=["Ginger, grated", "Garlic, grated", "Rice vinegar (first splash)"]),
        Step("The marinade",
             [("Stir until the sugar dissolves:", [f"{V.v('name_lc', 'rice vinegar')}<span data-v-show=\"water\"> + water</span>",
                                                    "mirin", "sugar"]),
              "Pour it over the cucumbers and toss.",
              "Optional: microwave the mirin and sugar together for 20–30 seconds first to dissolve the sugar and cook "
              "off the mirin’s alcohol; let it cool before adding.",
              "Keeping a jar of the mix in the fridge? See <a href=\"#batch\">Make a big batch</a> for the amounts."],
             cucumber_marinade, time="~2 min", uses=["Rice vinegar", "Water", "Mirin", "Sugar"]),
        Step("Rest, then soy and sesame",
             "Chill <b>10 minutes</b> (crispest) up to <b>1 hour</b>. Add the <b>light soy sauce and sesame</b> at the "
             "end, just before serving. Keeps 2–3 days in the fridge, softening as it sits.",
             cucumber_final, time="10 min – 1 h", uses=["Light soy sauce (usukuchi)", "Toasted sesame seeds"]),
    ],
    notes=[
        ("Vinegar conversions (in place of the marinade’s 2 tbsp rice vinegar)", V.table(CUKE_VINEGAR, "the marinade")),
        ("Reading Korean vinegar labels", V.KOREAN_LABELS),
        ("Seasoned rice vinegar (sushi vinegar)?",
         "It already contains sugar and salt. Use 2 tbsp straight in the marinade, keep the mirin, and skip the sugar."),
        ("Light soy", "Usukuchi (light) soy is saltier but paler than regular soy — it seasons without darkening the "
                      "cucumber. Regular soy works; use a little less."),
        ("Radish too", "For a soaking-style pickle, see <a href=\"radish-pickle.html\">pickled radishes</a>."),
    ],
    hero=cucumber_final,
)

from curry import curry  # noqa: E402
import easy_curry  # noqa: E402
import dashi_shiitake, dashi_niboshi, furikake, radish, tamagoyaki, veggie_don, karaage, ramen, kimchi, kkakdugi  # noqa: E402,E401
import alkaline_noodles, ginger_scallion_noodles, ramen_egg, dakgangjeong  # noqa: E402,E401
import tori_nanban_soba, zaru_soba, bibim_naengmyeon  # noqa: E402,E401
import sushi_rice, nigiri, tuna_mango_roll, shrimp_poke_bowl, malai_tikka  # noqa: E402,E401
import drunken_noodles, singapore_noodles, curry_soba, kake_soba  # noqa: E402,E401
import onigiri  # noqa: E402
import onigiri_pages  # noqa: E402
import onigiri_shop_pages  # noqa: E402
import baby_octopus_onigiri  # noqa: E402
import nikumaki_onigiri  # noqa: E402
import salmon_onigiri  # noqa: E402
import yaki_onigiri  # noqa: E402
import shrimp_karaage_onigiri  # noqa: E402
import onigirazu  # noqa: E402
import spam_musubi  # noqa: E402
import grilled_cheese  # noqa: E402
import mac_and_cheese  # noqa: E402
import anko, strawberry_daifuku, natto  # noqa: E402,E401
import daifuku, mame_daifuku, yomogi_daifuku  # noqa: E402,E401
import sous_vide_tempura  # noqa: E402
import prdp_recipes  # noqa: E402
import turkish_recipes  # noqa: E402

RECIPES = [
    sous_vide_beets, *sous_vide_tempura.RECIPES,
    dashi_shiitake.recipe, dashi_niboshi.recipe, furikake.recipe, cucumber, radish.recipe, tamagoyaki.recipe,
    ramen_egg.recipe, natto.recipe,
    oyakodon, veggie_don.recipe, onigiri_pages.MAIN, *onigiri_pages.RECIPES, *onigiri_shop_pages.RECIPES, yaki_onigiri.recipe, nikumaki_onigiri.recipe, shrimp_karaage_onigiri.recipe, salmon_onigiri.recipe, baby_octopus_onigiri.recipe, onigirazu.recipe, spam_musubi.recipe, karaage.recipe, curry, easy_curry.recipe, ramen.recipe, alkaline_noodles.recipe,
    ginger_scallion_noodles.recipe,
    sushi_rice.recipe, nigiri.recipe, tuna_mango_roll.recipe, shrimp_poke_bowl.recipe,
    anko.recipe, daifuku.recipe, strawberry_daifuku.recipe, mame_daifuku.recipe, yomogi_daifuku.recipe,
    kimchi.recipe, kkakdugi.recipe, dakgangjeong.recipe,
    garlic_ginger, pad_see_ew, pad_thai, drunken_noodles.recipe, singapore_noodles.recipe,
    tori_nanban_soba.recipe, zaru_soba.recipe, bibim_naengmyeon.recipe, curry_soba.recipe, kake_soba.recipe,
    malai_tikka.recipe,
    grilled_cheese.recipe, mac_and_cheese.recipe,
    *prdp_recipes.RECIPES,
    *turkish_recipes.RECIPES,
]
# Keep rice-ball recipes and their shaping methods together in the index/navigation.
for r in RECIPES:
    if "onigiri" in r.slug or r.slug in ("onigirazu", "spam-musubi"):
        r.group = "Onigiri"
GROUPS = ["Turkish & coastal", "Sous vide", "Japanese basics", "Japanese", "Onigiri", "Sushi", "Japanese sweets", "Korean", "Rice noodles", "Soba",
          "Indian", "Cheese", "From friends (prdp.net)"]

# When each recipe went up (newest first on the home page's "Recently added"). Add a line with every new recipe;
# the first ones are dated by their first generated picture.
ADDED = {
    "sous-vide-salmon": "2026-10-11 08:00", "sous-vide-fries": "2026-10-11 07:59",
    "jumbo-shrimp-tempura": "2026-10-11 07:58", "oyster-mushroom-tempura": "2026-10-11 07:57",
    "soy-cured-yolk-onigiri": "2026-10-10 18:00",
    "soboro-onigiri": "2026-10-10 18:00",
    "pork-kimchi-onigiri": "2026-10-10 18:00",
    "shiso-kombu-onigiri": "2026-10-10 18:00",
    "takana-onigiri": "2026-10-10 18:00",
    "peanut-miso-onigiri": "2026-10-10 18:00",
    "eggplant-tsukudani-onigiri": "2026-10-10 18:00",
    "pepperoncino-onigiri": "2026-10-10 18:00",
    "mentai-cream-cheese-onigiri": "2026-10-10 18:00",
    "onigiri-mold": "2026-10-10 18:00",
    "onigiri-plastic-wrap": "2026-10-10 18:00",
    "oyakodon": "2026-10-05 20:25",
    "furikake": "2026-10-06 01:52", "karaage": "2026-10-06 01:52", "napa-shiitake-egg-bowl": "2026-10-06 01:52",
    "niboshi-bonito-dashi": "2026-10-06 01:52", "ramen": "2026-10-06 01:52", "shiitake-kombu-dashi": "2026-10-06 01:52",
    "tamagoyaki": "2026-10-06 01:52",
    "chicken-pad-see-ew": "2026-10-06 01:53", "chicken-pad-thai": "2026-10-06 01:53",
    "cucumber-sunomono": "2026-10-06 01:53", "garlic-ginger-chicken-noodles": "2026-10-06 01:53",
    "japanese-curry": "2026-10-06 01:53", "sous-vide-beets": "2026-10-06 01:53", "sous-vide": "2026-10-06 01:53",
    "radish-pickle": "2026-10-06 14:30",
    "kkakdugi": "2026-10-06 16:03", "kimchi": "2026-10-06 16:05",
    "alkaline-ramen-noodles": "2026-10-06 16:11", "ginger-scallion-noodles": "2026-10-06 16:11",
    "baka-with-eggs": "2026-10-06 18:03", "boiled-eggs": "2026-10-06 18:03", "coconut-chickpeas": "2026-10-06 18:03",
    "vegan-crunch-wrap-supreme": "2026-10-06 18:03",
    "ramen-egg": "2026-10-07 00:15",
    "dakgangjeong": "2026-10-07 12:00",
    "easy-curry": "2026-10-07 14:24",
    "sushi-rice": "2026-10-07 14:00", "nigiri": "2026-10-08 13:10", "tuna-mango-roll": "2026-10-07 14:00",
    "onigiri": "2026-10-07 14:21",
    "baby-octopus-onigiri": "2026-10-07 17:50",
    "nikumaki-onigiri": "2026-10-07 17:49",
    "salmon-onigiri": "2026-10-07 17:49",
    "yaki-onigiri": "2026-10-07 17:48",
    "shrimp-karaage-onigiri": "2026-10-07 19:00",
    "onigirazu": "2026-10-07 17:47",
    "spam-musubi": "2026-10-07 17:46",
    "shrimp-poke-bowl": "2026-10-07 14:30", "chicken-malai-tikka": "2026-10-07 14:30",
    "drunken-noodles": "2026-10-07 15:00", "singapore-noodles": "2026-10-07 15:00", "curry-soba": "2026-10-07 15:00",
    "kake-soba": "2026-10-07 15:00",
    "tori-nanban-soba": "2026-10-07 13:00", "zaru-soba": "2026-10-07 13:00", "bibim-naengmyeon": "2026-10-07 13:00",
    "grilled-cheese": "2026-10-09 00:20", "mac-and-cheese": "2026-10-09 00:20",
    "daifuku": "2026-10-10 03:47", "mame-daifuku": "2026-10-10 03:46", "yomogi-daifuku": "2026-10-10 03:45",
    "strawberry-daifuku": "2026-10-10 03:42", "anko": "2026-10-10 03:41", "natto": "2026-10-10 03:40",
}

# ---------------------------------------------------------------- sous vide quick tables (from the v4 PDF)

SV_PDF = "assets/sous_vide_quick_tables_v5.pdf"
from sous_vide_reference import INTRO as SV_INTRO, update_tables


SOUS_VIDE = [
    {"id": "vegetables", "title": "Vegetables",
     "cols": ["Food", "State", "Temp", "Time", "Notes"],
     "rows": [
         ["Asparagus (~1 cm spears)", "Frozen", "85°C", "12–18 min", "15 min default. Use 18–20 min if clumped/tightly packed."],
         ["Asparagus (~1 cm spears)", "Thawed", "85°C", "8–12 min", "Mostly heat-through + slight tenderizing. Single layer cooks best."],
         ["Cauliflower (florets, ~5 cm)", "Thawed", "85°C", "30–45 min", "Bag with butter + curry powder. Single layer; weigh down if needed."],
         ["Cauliflower (florets, ~5 cm)", "Frozen", "85°C", "45–60 min", "Add ~15 min for frozen. Same bag additions."],
     ],
     "after": ["<b>Asparagus finish (optional):</b> dry well, then blister 30–60 sec in a very hot pan.",
               "<b>Cauliflower finish (optional):</b> drain liquid, then roast or broil 4–6 min for color. Pairs well with a "
               "knob of butter and ½–1 tsp curry powder per ~300 g in the bag.",
               "<b>Beets:</b> 85 °C, 1½–4 h by size — see <a href=\"sous-vide-beets.html\">Sous vide beets</a>."]},
    {"id": "chicken-breast", "title": "Poultry: Chicken Breast",
     "cols": ["Cut", "Thickness", "State", "Temp", "Time", "Texture / Notes"],
     "rows": [
         ["Breast", "~2 cm", "Thawed", "63°C", "60–75 min", "Juicy + tender (default)."],
         ["Breast", "~2 cm", "Frozen", "63°C", "90–105 min", "Add ~30 min for frozen."],
         ["Breast", "~2 cm", "Thawed", "65°C", "45–60 min", "Firmer, more 'classic' bite."],
         ["Breast", "~2 cm", "Frozen", "65°C", "75–90 min", "Firmer + safer buffer."],
         ["Breast", "~4 cm", "Thawed", "63°C", "2.5 h", "2 h is often short; 2.5 h is safer."],
         ["Breast", "~4 cm", "Frozen", "63°C", "3 h", "Cook-from-frozen default."],
         ["Breast", "~4 cm", "Thawed", "65°C", "2 h", "Closest 'set-and-forget 2 hours' plan."],
         ["Breast", "~4 cm", "Frozen", "65°C", "2.5 h", "Add buffer if not fully thawed."],
     ],
     "after": ["<b>Finish:</b> pat dry, then hard sear 30–60 sec/side for color.",
               "Sliced into <a href=\"oyakodon.html\">oyakodon</a>: see the sous vide shortcut there."]},
    {"id": "drumsticks", "title": "Poultry: Chicken Drumsticks (bone-in)",
     "cols": ["Goal", "State", "Temp", "Time", "Notes"],
     "rows": [
         ["Tender / pulls off bone", "Defrosted", "74°C", "3–5 h", "Good all-round; avoids near-bone pinkness."],
         ["Tender / pulls off bone", "Frozen", "74°C", "4–6 h", "+30–60 min buffer; thickness-dependent."],
         ["Fall-off-the-bone", "Defrosted", "78°C", "3 h", "Best match for 'fall off bone'."],
         ["Fall-off-the-bone", "Frozen", "78°C", "3–4 h", "Add ~1 h if very thick or tightly packed."],
     ],
     "after": ["<b>Bagging:</b> 2 per bag for very thick drumsticks; 3 per bag OK if mostly single-layer. "
               "<b>Finish:</b> dry thoroughly, broil 4–8 min total, flip once; apply sugary sauces late."]},
    {"id": "beef", "title": "Beef",
     "cols": ["Cut", "Thickness", "State", "Doneness", "Temp", "Time", "Hold window"],
     "rows": [["Ribeye", "~2.5 cm", "Frozen", "Medium", "57°C", "2 h", "Best 1.5–3 h; OK up to ~4 h (softer past that)."]],
     "after": ["<b>Sear:</b> optional cool-in-bag 5–10 min, pat very dry, then 30–60 sec/side in screaming-hot pan + "
               "neutral oil. Add butter only at the end (15–30 sec baste)."]},
    {"id": "pork-ribs", "title": "Pork Ribs",
     "cols": ["Texture target", "Temp", "Time", "Notes"],
     "rows": [
         ["BBQ tender (sliceable)", "74°C", "18–24 h", "Default long-cook ribs."],
         ["Fall-off-the-bone", "78°C", "12–18 h", "Softer, more shreddy."],
         ["Steakier chew", "68°C", "24–36 h", "Tender but more bite."],
     ],
     "after": ["<b>Finish:</b> dry well, brush thin sauce, then broil 4–8 min total (flip once). If sauce is sweet, "
               "apply late and watch constantly."]},
    {"id": "lamb", "title": "Lamb — collagen-heavy cuts",
     "cols": ["Cut", "Goal", "Temp", "Time", "Notes"],
     "rows": [
         ["Lamb shank (whole)", "Braised tender (sliceable)", "68°C", "24–36 h", "Frozen vs thawed negligible at this scale."],
         ["Lamb shank (whole)", "Fall-apart", "74°C", "18–24 h", "More 'braise' texture."],
     ],
     "after": []},
    {"id": "lamb-slices", "title": "Lamb — steak-like slices",
     "cols": ["Cut", "Thickness", "State", "Temp", "Time", "Finish / Notes"],
     "rows": [
         ["Shank steaks (cross-cut)", "2–2.5 cm", "Frozen", "60°C", "9–13 h", "Collagen needs time. Add ~1 h buffer for frozen."],
         ["Boneless lamb slices w/ fat + some skin", "2–2.5 cm", "Frozen", "56–57°C", "2–2.5 h",
          "Dry thoroughly. Crisp skin in pan skin-side down 2–5 min (press for contact)."],
     ],
     "after": ["<b>Skin note:</b> sous vide does not crisp skin. You must dry thoroughly and use direct high heat (pan or broiler)."]},
]


SOUS_VIDE = update_tables(SOUS_VIDE)

def sous_vide_hero():
    sc = Scene(70)
    x, y, w, h = A.bath(sc, 34, 44, 230, 140, "63°C")
    A.bag(sc, x + 6, y + 8, w - 10, h - 18, ("chicken_raw", 4), clip_to_rim=(x + 4, 44))
    return sc.render("Sous vide bath")

# Full recipes promoted from the Turkey yacht shortlist.
ADDED.update({r.slug: "2026-10-13 18:00" for r in turkish_recipes.RECIPES})
