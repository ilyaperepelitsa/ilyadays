"""Onigirazu — the rice sandwich: a nori sheet folded around two thin layers of rice and a thick, juicy filling,
rested in plastic wrap and cut in half to show the layers. The build is Just One Cookbook's ginger pork onigirazu
(lettuce, Kewpie, shogayaki), and the filling is her ginger pork (shogayaki) recipe. Her other onigirazu are listed as
variations. This site's additions — the batch of four, cooling the filling, the amounts per sandwich — are flagged
on the page.
"""
import art as A
from art import Scene
from kit import PX, PY, Bowl, Recipe, Step, Task, board_scene

NORI, NORI_EDGE = "#24331f", "#0f1a0c"
RICE, RICE_EDGE = "#fbf8ef", "#d9d0bd"
WRAP = "#dfeef6"

# ---------------------------------------------------------------- local shapes


def _pork(fill, edge, fat, glaze=None):
    """A thin pork loin slice with its strip of fat along one edge."""
    def f(rng):
        b = (f'<path d="{A.blob_path(rng, 0, 0, 10, .18, 9, 1.5, .62)}" fill="{fill}" stroke="{edge}" '
             'stroke-width=".8"/>'
             f'<path d="M-12,4 Q0,7 12,3" stroke="{fat}" stroke-width="2.2" fill="none" stroke-linecap="round" '
             'opacity=".9"/>')
        if glaze:
            b += (f'<path d="M-8,-3 Q-2,-6 6,-4" stroke="{glaze}" stroke-width="1.4" fill="none" opacity=".55" '
                  'stroke-linecap="round"/>')
        return b
    return f


A.SHAPES["gp_pork_raw"] = (_pork("#eab3a3", "#b9796a", "#fbeee6"), 26, 1)
A.SHAPES["gp_pork_seared"] = (_pork("#c98f62", "#8a5a34", "#f2d9b8"), 26, 1)
A.SHAPES["gp_pork_glazed"] = (_pork("#9a5a2c", "#5e3214", "#d9a868", glaze="#fff"), 26, 1)
A.SHAPES["gp_onion_gold"] = (lambda rng: (
    '<path d="M-7,1 Q0,-5 7,1" stroke="#d9a548" stroke-width="2.2" fill="none" stroke-linecap="round"/>'), 15, 1)
A.SHAPES["gp_lettuce"] = (lambda rng: (
    f'<path d="{A.blob_path(rng, 0, 0, 11, .3, 11, 1.3, .9)}" fill="#a9d86e" stroke="#6f9f3a" stroke-width=".8"/>'
    '<path d="M-9,2 Q0,-1 9,-3" stroke="#e8f5d0" stroke-width="1.2" fill="none"/>'), 26, 1)
A.SHAPES["gp_nori"] = (lambda rng: (
    f'<rect x="-11" y="-11" width="22" height="22" rx="1" fill="{NORI}" stroke="{NORI_EDGE}" stroke-width=".7"/>'), 26, 1)
A.SHAPES["gp_ginger_grated"] = (lambda rng: (
    f'<path d="{A.blob_path(rng, 0, 0, 4, .35, 7)}" fill="#f1dc9a" stroke="#c9ad5c" stroke-width=".5"/>'), 9, 1)


def _diamond(sc, cx, cy, h, wrap=True):
    """The nori sheet as a diamond (a corner pointing up), on a sheet of plastic wrap."""
    if wrap:
        sc += (f'<rect x="{cx - h * 1.25:.0f}" y="{cy - h * 1.05:.0f}" width="{h * 2.5:.0f}" height="{h * 2.1:.0f}" '
               f'rx="4" fill="{WRAP}" opacity=".55" stroke="#9fb9c6" stroke-width="1"/>')
    sc += (f'<path d="M{cx},{cy - h} L{cx + h},{cy} L{cx},{cy + h} L{cx - h},{cy}Z" fill="{NORI}" stroke="{NORI_EDGE}" '
           'stroke-width="1.2"/>')


def _rice_square(sc, cx, cy, s):
    sc += (f'<rect x="{cx - s}" y="{cy - s}" width="{2 * s}" height="{2 * s}" rx="3" fill="{RICE}" '
           f'stroke="{RICE_EDGE}" stroke-width="1"/>')
    for _ in range(18):
        x, y = cx + sc.rng.uniform(-s + 4, s - 4), cy + sc.rng.uniform(-s + 4, s - 4)
        sc += (f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="2.4" ry="1.3" transform="rotate({sc.rng.uniform(0, 180):.0f} '
               f'{x:.1f} {y:.1f})" fill="#fff" stroke="{RICE_EDGE}" stroke-width=".4"/>')


def _section(sc, cx, cy, w, h):
    """One cut half seen from the cut face: nori all round, rice, lettuce, pork, rice."""
    sc += (f'<rect x="{cx - w / 2 - 3}" y="{cy - h / 2 - 3}" width="{w + 6}" height="{h + 6}" rx="6" fill="{NORI}" '
           f'stroke="{NORI_EDGE}" stroke-width="1"/>')
    sc += f'<rect x="{cx - w / 2}" y="{cy - h / 2}" width="{w}" height="{h}" rx="4" fill="{RICE}"/>'
    sc += f'<rect x="{cx - w / 2 + 4}" y="{cy - h * .14:.1f}" width="{w - 8}" height="{h * .1:.1f}" rx="2" fill="#9fd166"/>'
    sc += f'<rect x="{cx - w / 2 + 4}" y="{cy - h * .04:.1f}" width="{w - 8}" height="{h * .2:.1f}" rx="3" fill="#8a4f24"/>'
    sc += f'<rect x="{cx - w / 2 + 6}" y="{cy - h * .05:.1f}" width="{w - 12}" height="{h * .025:.1f}" fill="#fdf3dc"/>'


# ---------------------------------------------------------------- scenes


def s_sauce():
    sc = Scene(1401)
    region = A.bowl(sc, 110, 102, 74)
    A.fill(sc, region, [("sauce:soy", 4), ("gp_ginger_grated", 5)])
    A.label(sc, 250, 46, "soy · mirin · sake\n· sugar")
    A.label(sc, 250, 104, "+ ½ the ginger juice,\ngrated ginger")
    A.label(sc, 250, 160, "+ 1 tbsp grated\nonion with juice")
    return sc.render("Ginger sauce")


def s_prep():
    return board_scene(1402, [("gp_pork_raw", 6, "pork + ginger juice\n+ sake, 5 min"),
                              ("onion", 9, "onion, thinly sliced")], "Pork marinating, onion sliced")


def s_sear():
    sc = Scene(1403)
    region = A.pan(sc, PX, PY, 80, heat=.8)
    A.scatter(sc, "gp_pork_seared", region[0], region[1], region[2] * .72, 6, scale=1.3)
    A.sizzle(sc, region[0], region[1], region[2])
    A.label(sc, 70, 18, "single layer, in batches")
    A.label(sc, 262, 186, "golden, then flip")
    return sc.render("Pork searing")


def s_glaze():
    sc = Scene(1404)
    region = A.pan(sc, PX, PY, 80, heat=.5)
    A.fill(sc, region, [("sauce:soy", 3), ("gp_pork_glazed", 6), ("gp_onion_gold", 10)])
    A.label(sc, 70, 18, "onion golden, pork back in")
    A.label(sc, 262, 186, "sauce in, ~2 min")
    return sc.render("Ginger pork in its sauce")


def s_nori():
    sc = Scene(1405)
    _diamond(sc, 150, 100, 82)
    A.label(sc, 272, 40, "plastic wrap,\nnori shiny side down")
    A.label(sc, 272, 160, "a corner\npointing up")
    return sc.render("Nori on plastic wrap")


def s_rice():
    sc = Scene(1406)
    _diamond(sc, 150, 100, 82)
    _rice_square(sc, 150, 100, 40)
    A.label(sc, 272, 40, "½ cup rice,\nthin square")
    A.label(sc, 272, 160, "a pinch\nof salt")
    return sc.render("First rice layer")


def s_fill():
    sc = Scene(1407)
    _diamond(sc, 150, 100, 82)
    _rice_square(sc, 150, 100, 40)
    A.scatter(sc, "gp_lettuce", 150, 100, 22, 2, scale=1.4)
    A.scatter(sc, "gp_pork_glazed", 150, 100, 18, 4, scale=1.1)
    A.label(sc, 272, 40, "lettuce · Kewpie\n· ginger pork")
    A.label(sc, 272, 160, "piled high\nin the middle")
    return sc.render("Fillings on the rice")


def s_top():
    sc = Scene(1408)
    _diamond(sc, 150, 100, 82)
    _rice_square(sc, 150, 100, 40)
    A.label(sc, 272, 40, "½ cup rice\non top")
    A.label(sc, 272, 160, "keep it\nsquare")
    return sc.render("Top rice layer")


def s_fold():
    sc = Scene(1409)
    _diamond(sc, 150, 100, 82)
    _rice_square(sc, 150, 100, 40)
    sc += (f'<path d="M68,100 L150,100 L150,60 L110,60Z M232,100 L150,100 L150,60 L190,60Z" fill="{NORI}" '
           f'stroke="{NORI_EDGE}" stroke-width="1" opacity=".95"/>')
    sc += f'<rect x="110" y="60" width="80" height="80" fill="{NORI}" stroke="{NORI_EDGE}" stroke-width="1.2"/>'
    sc += '<path d="M110,60 L190,140 M190,60 L110,140" stroke="#3a4c33" stroke-width="1"/>'
    A.label(sc, 272, 40, "left + right\ncorners in")
    A.label(sc, 272, 160, "then bottom\n+ top")
    return sc.render("Nori folded round")


def s_wrap():
    sc = Scene(1410)
    sc += (f'<rect x="96" y="46" width="108" height="108" rx="6" fill="{NORI}" stroke="{NORI_EDGE}" stroke-width="1.2"/>'
           f'<rect x="88" y="38" width="124" height="124" rx="10" fill="{WRAP}" opacity=".45" stroke="#9fb9c6" '
           'stroke-width="1.4"/>')
    A.label(sc, 268, 60, "wrapped tight,\nseam side down")
    A.label(sc, 268, 140, "rest\n5 min")
    return sc.render("Wrapped, resting")


def s_cut():
    sc = Scene(1411)
    _section(sc, 100, 100, 92, 70)
    _section(sc, 212, 100, 92, 70)
    A.label(sc, 160, 186, "wet knife, one clean cut")
    return sc.render("Onigirazu cut in half")


SAUCE_USES = ["Soy sauce", "Mirin", "Sake (sauce)", "Sugar", "Fresh ginger", "Onion"]
RICE_NAME = "Cooked Japanese short-grain rice, warm"

recipe = Recipe(
    slug="onigirazu",
    title="Onigirazu (ginger pork rice sandwich)",
    group="Japanese",
    blurb="Nori folded around two thin layers of rice and a thick, saucy filling of ginger pork, lettuce and Kewpie, "
          "then cut in half to show the layers.",
    yields="4 onigirazu (8 halves)",
    serves=4,
    total="~50 min (with the rice cooked)",
    intro="An <b>onigirazu</b> (“un-squeezed rice ball”) is the lazy cousin of <a href=\"onigiri.html\">onigiri</a>: "
          "no shaping at all. Rice, filling and rice are stacked on a sheet of nori, the four corners fold in like an "
          "envelope, and one cut through the middle shows the layers. This is Just One Cookbook’s <b>ginger pork</b> "
          "build — her shogayaki, a crisp lettuce leaf and a drizzle of Kewpie — so every bite is juicy, sweet-salty "
          "and gingery. Make the pork first; the rice should be warm when you build.",
    equipment=["Grater", "Large frying pan", "Plastic wrap", "Sharp knife", "Onigirazu mold (optional)"],
    ingredients=[
        ("Ginger sauce", [
            ("Soy sauce", "2 tbsp"),
            ("Mirin", "2 tbsp"),
            ("Sake (sauce)", "2 tbsp"),
            ("Sugar", "1 tsp"),
            ("Fresh ginger", "5 cm piece"),
            ("Onion", "½"),
        ]),
        ("Ginger pork (shogayaki)", [
            ("Thinly sliced pork loin", "340 g"),
            ("Sake (pork)", "1 tbsp"),
            ("Plain flour", "1 tbsp"),
            ("Neutral oil", "1–2 tbsp"),
            ("Black pepper (optional)", "to taste"),
        ]),
        ("Onigirazu", [
            ("Nori", "4 sheets"),
            (RICE_NAME, "4 cups (~600 g)"),
            ("Kosher salt", "a pinch per layer"),
            ("Lettuce", "4 leaves"),
            ("Japanese mayo (Kewpie)", "a drizzle each"),
        ]),
    ],
    mise=[
        Bowl("Ginger sauce", "soy · mirin · sake · sugar · ginger · onion", [("sauce:soy", 3), ("gp_ginger_grated", 4)],
             "Step 1", "cup"),
        Bowl("Pork", "thin loin slices", [("gp_pork_raw", 4)], "Step 2", "plate"),
        Bowl("Onion", "the rest, thinly sliced", [("onion", 8)], "Step 4"),
        Bowl("Nori", "4 whole sheets", [("gp_nori", 2)], "Step 5", "plate"),
        Bowl("Rice", "warm, salted as you build", [("rice", 1)], "Step 6"),
        Bowl("Lettuce + Kewpie", "one leaf each", [("gp_lettuce", 2)], "Step 7", "plate"),
    ],
    timeline=[
        Task("Ginger sauce", 0, 6, "bowl"),
        Task("Slice onion, marinate pork", 6, 6, "board"),
        Task("Sear the pork", 12, 6, "pan"),
        Task("Onion, then the sauce", 18, 10, "pan"),
        Task("Cool the filling", 28, 5, "wait"),
        Task("Build 4 onigirazu", 28, 14, "board"),
        Task("Rest in the wrap", 42, 5, "wait"),
        Task("Cut and serve", 47, 3, "board"),
    ],
    timeline_note="Cook the rice first so it’s ready and warm. While the pork cools you can lay out the wrap and nori.",
    steps=[
        Step("Ginger sauce",
             [("Stir together in a small bowl:", ["soy sauce", "mirin", "sake (sauce)", "sugar"]),
              "Peel the ginger and grate it, keeping the juice. Squeeze out <b>1 tbsp ginger juice</b>: half goes into "
              "the sauce, half is for the pork.",
              "Add 2–3 tsp of the squeezed grated ginger to the sauce, to taste.",
              "Grate <b>1 tbsp</b> of the onion with its juice into the sauce. Keep the rest of the onion."],
             s_sauce, time="~6 min", part="Ginger pork", uses=SAUCE_USES),
        Step("Pork and onion",
             ["Slice the rest of the onion thinly.",
              "If the pork slices are thicker than 3 mm, make a few small cuts through the white strip between meat "
              "and fat, so they stay flat.",
              "Sprinkle the pork with the other half of the ginger juice and the sake. Leave 5 minutes.",
              "Just before cooking, dust the slices lightly with the flour (skip it for paper-thin slices)."],
             s_prep, time="~6 min", part="Ginger pork", uses=["Thinly sliced pork loin", "Sake (pork)", "Plain flour"]),
        Step("Sear the pork",
             ["Heat the oil in a large frying pan over <b>medium-high</b> heat.",
              "Lay the pork in a single layer and turn each slice once the underside is golden. Work in batches — "
              "a crowded pan steams the meat.",
              "As soon as it is no longer pink, move it to a plate. It finishes in the sauce."],
             s_sear, heat="medium-high", time="~6 min", part="Ginger pork", uses=["Neutral oil"]),
        Step("Onion, then the sauce",
             ["A little more oil if needed, then the sliced onion: cook on medium until golden and tender, 6–8 min.",
              "Pork back in. Stir the sauce once more and pour it over.",
              "Simmer, spooning the sauce over the pork, about 2 minutes until it thickens and coats. Pepper if you "
              "like.",
              "Let it cool on a plate until just warm, about 5 minutes."],
             s_glaze, heat="medium", time="~10 min", part="Ginger pork", uses=["Black pepper (optional)"]),
        Step("Nori on plastic wrap",
             ["Lay a sheet of plastic wrap on the counter.",
              "One nori sheet on it, <b>shiny side down</b>, turned so a corner points up — a diamond."],
             s_nori, time="1 min", part="Build (one onigirazu)", uses=["Nori"]),
        Step("First rice layer",
             ["Spread <b>½ cup (~75 g)</b> warm rice in a thin, even <b>square</b> in the middle of the nori, about "
              "9 cm a side. Leave the four corners of nori bare.",
              "Sprinkle with a pinch of salt."],
             s_rice, time="1 min", part="Build (one onigirazu)", uses=[RICE_NAME, "Kosher salt"]),
        Step("Fillings",
             ["A lettuce leaf on the rice, folded to fit the square.",
              "A drizzle of Kewpie over the lettuce.",
              "A quarter of the ginger pork and its onion on top, folded and <b>piled high in the middle</b> — "
              "think about where you’ll cut, so the filling shows."],
             s_fill, time="1 min", part="Build (one onigirazu)", uses=["Lettuce", "Japanese mayo (Kewpie)"]),
        Step("Top rice layer",
             ["Another <b>½ cup</b> rice over the filling, spread into the same square.",
              "With a mold: wet its lid, press down gently, then lift the frame off while holding the lid down."],
             s_top, time="1 min", part="Build (one onigirazu)"),
        Step("Fold the nori",
             ["Bring the <b>left and right corners</b> into the middle, folding gently but tightly around the stack.",
              "Then the <b>bottom and top corners</b>, the same way. Tuck any loose rice in.",
              "If it’s square, mark the cut direction — a grain of rice on top, in line with the filling."],
             s_fold, time="1 min", part="Build (one onigirazu)"),
        Step("Wrap and rest",
             ["Wrap it tightly in its plastic wrap.",
              "Rest <b>seam side down</b> for 5 minutes while you build the others — the nori softens and seals."],
             s_wrap, time="5 min", part="Build (one onigirazu)"),
        Step("Cut in half",
             ["Run a sharp knife under cold water.",
              "Cut straight through the middle, wrap and all, along your mark, so the layers show.",
              "Serve cut side up; peel back the wrap as you eat."],
             s_cut, time="~3 min", part="Serve"),
    ],
    notes=[
        ("Other fillings (Just One Cookbook)",
         "<b>Chicken katsu</b>: shredded cabbage, a katsu, Dijon mustard and tonkatsu sauce. <b>Teriyaki "
         "salmon</b>, <b>bulgogi</b> and <b>Spam with egg</b> work the same way. Any juicy cooked meat does: keep the "
         "filling flat-ish and thick in the middle, with something crisp (lettuce, cabbage) next to the sauce."),
        ("Mold or no mold", "A mold (about 9 cm square) gives tidy edges. Without one, just spread and stack "
                            "carefully — the fold and the plastic wrap hold it together."),
        ("Making it ahead", "Wrapped in plastic and then a thick kitchen towel, it keeps in the fridge overnight; "
                            "the towel stops the rice going hard. Take it out 30–60 minutes before eating. Same day "
                            "is best."),
        ("This site’s additions",
         "The batch of four, the ~75 g of rice per layer, the lettuce-and-pork amounts per sandwich and cooling the "
         "pork to just warm before building (hot filling steams the nori soft) are this site’s. The build, the fold "
         "and the shogayaki are Just One Cookbook’s."),
    ],
    sources=[
        ("Just One Cookbook — Ginger pork onigirazu", "https://www.justonecookbook.com/ginger-pork-onigirazu/"),
        ("Just One Cookbook — Ginger pork (shogayaki)", "https://www.justonecookbook.com/ginger-pork-shogayaki/"),
        ("Just One Cookbook — Chicken katsu onigirazu", "https://www.justonecookbook.com/chicken-katsu-onigirazu/"),
    ],
    hero=s_cut,
)

# Rice storage guidance shared by the combined onigiri page.
from dataclasses import replace
recipe = replace(recipe, notes=[(title, 'Eat freshly made. For later, cool promptly and refrigerate ideally within one hour; use within 24 hours. Keep cold for transport. Reheat grilled rice balls until steaming hot; eat seafood and egg fillings cold or freshly made.' if title == 'Making it ahead' else body) for title, body in recipe.notes])
