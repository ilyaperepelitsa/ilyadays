"""Yaki onigiri — rice seasoned with soy, sugar and sesame oil, pressed into firm triangles, pan-grilled on parchment
until the outside is a crisp brown crust, then brushed with a soy glaze that lacquers in the pan.

Rice seasoning, shaping, pan-grill and soy glaze: Just One Cookbook's yaki onigiri. Miso glaze: Just One Cookbook's
miso yaki onigiri. Butter on top: Chopstick Chronicles' soy-butter yaki onigiri. Replaces the two yaki steps that used
to sit at the end of the onigiri page.
"""
import art as A
from art import Scene
from kit import PX, PY, Bowl, Recipe, Step, Task

RICE, RICE_EDGE = "#fbf8f0", "#d8cfbd"
SEASONED, SEASONED_EDGE = "#e6c992", "#b08c52"

# ---------------------------------------------------------------- shapes


def _tri_path(s=1.0):
    """Rounded triangle, point up, about 30 px wide at s=1."""
    p = [(0, -15), (15, 11), (-15, 11)]
    d = ""
    for i, (x, y) in enumerate(p):
        nx, ny = p[(i + 1) % 3]
        px_, py_ = p[i - 1]
        a = (x + (px_ - x) * .22, y + (py_ - y) * .22)
        b = (x + (nx - x) * .22, y + (ny - y) * .22)
        d += ("M" if i == 0 else "L") + f"{a[0] * s:.1f},{a[1] * s:.1f} Q{x * s:.1f},{y * s:.1f} {b[0] * s:.1f},{b[1] * s:.1f} "
    return d + "Z"


def _grains(rng, n, spread, fill="#fff", edge="#e6dfcf"):
    out = ""
    for _ in range(n):
        gx, gy = rng.uniform(-spread, spread), rng.uniform(-spread, spread) * .8 + 2
        out += (f'<ellipse cx="{gx:.1f}" cy="{gy:.1f}" rx="2.2" ry="1.05" fill="{fill}" stroke="{edge}" '
                f'stroke-width=".4" transform="rotate({rng.uniform(0, 180):.0f} {gx:.1f} {gy:.1f})"/>')
    return out


# stage → (fill, inner crust, edge, shine)
STAGES = {
    "seasoned": (SEASONED, None, SEASONED_EDGE, None),
    "grilled": ("#dcaa62", "#c08038", "#9a6326", "#fff1d2"),
    "glazed": ("#b56a28", "#8a4616", "#6a3410", "#ffd9a8"),
    "miso": ("#9a5a2c", "#6e3a18", "#55290f", "#f6c99a"),
}


def _yaki(stage, butter=False):
    fill, inner, edge, shine = STAGES[stage]

    def f(rng):
        b = f'<path d="{_tri_path()}" fill="{fill}" stroke="{edge}" stroke-width=".9"/>'
        if inner:
            b += f'<path d="{_tri_path(.72)}" fill="{inner}" opacity=".55"/>'
        else:
            b += _grains(rng, 9, 7, "#f3e2bc", SEASONED_EDGE)
        if shine:
            b += f'<path d="M-6,-6 Q0,-9 5,-6" stroke="{shine}" stroke-width="1.3" fill="none" opacity=".75"/>'
        if stage == "miso":
            b += '<path d="M-7,2 Q0,-1 7,2 Q0,6 -7,2Z" fill="#7a3f1c" opacity=".55"/>'
        if butter:
            b += ('<rect x="-5" y="-4" width="10" height="7" rx="1.6" fill="#f8de6a" stroke="#d1ad2e" stroke-width=".6"/>'
                  '<path d="M-6,3 Q-2,7 3,5 Q6,4 7,2" fill="#f6d65e" opacity=".75"/>')
        return b
    return f


def _open(rng):
    """A yaki onigiri broken in two: brown crust outside, steaming white rice inside."""
    b = ""
    for dx, rot in ((-7, -14), (8, 12)):
        b += (f'<g transform="translate({dx} 0) rotate({rot})">'
              f'<path d="M-9,-10 Q-2,-14 1,-9 L1,10 L-11,10 Q-14,0 -9,-10Z" fill="#b56a28" stroke="#6a3410" '
              f'stroke-width=".9" transform="scale({1 if dx < 0 else -1} 1)"/>'
              f'<path d="M-6,-7 Q-1,-10 0,-6 L0,8 L-8,8 Q-10,0 -6,-7Z" fill="{RICE}" stroke="{RICE_EDGE}" '
              f'stroke-width=".5" transform="scale({1 if dx < 0 else -1} 1)"/></g>')
    return b


A.SHAPES["yaki_seasoned"] = (_yaki("seasoned"), 34, 1)
A.SHAPES["yaki_grilled"] = (_yaki("grilled"), 34, 1)
A.SHAPES["yaki_glazed"] = (_yaki("glazed"), 34, 1)
A.SHAPES["yaki_miso"] = (_yaki("miso"), 34, 1)
A.SHAPES["yaki_butter"] = (_yaki("glazed", butter=True), 34, 1)
A.SHAPES["yaki_open"] = (_open, 34, 1)
A.SHAPES["yaki_butter_pat"] = (lambda rng: (
    '<rect x="-6" y="-4.5" width="12" height="9" rx="1.8" fill="#f8de6a" stroke="#d1ad2e" stroke-width=".7"/>'
    '<path d="M-4,-2.5 H3" stroke="#fff6c9" stroke-width="1" opacity=".8"/>'), 14, 1)

# ---------------------------------------------------------------- scenes


def _place(sc, kind, cx, cy, spots, scale):
    """Put one shape at each (dx, dy) offset — scatter() drops pieces when the area is tight."""
    for dx, dy in spots:
        A.scatter(sc, kind, cx + dx, cy + dy, 1, 1, scale=scale, rotate=False)


GRID4 = [(-26, -24), (26, -24), (-26, 26), (26, 26)]
GRID6 = [(-46, -26), (0, -30), (46, -26), (-46, 28), (0, 24), (46, 28)]


def _parchment(sc, cx, cy):
    sc += f'<rect x="{cx - 60}" y="{cy - 52}" width="120" height="104" rx="4" fill="#f4ead2" opacity=".92"/>'


def s_rice():
    sc = Scene(801)
    cx, cy, r = A.bowl(sc, 120, 104, 84)
    A.rice(sc, cx, cy, r * .86)
    A.steam(sc, cx, cy - 40, 3, 50)
    A.label(sc, 268, 56, "short-grain rice,\njust cooked")
    A.label(sc, 268, 130, "2¼ cups dry →\n~990 g = 9 balls")
    return sc.render("Freshly cooked short-grain rice")


def s_season():
    sc = Scene(802)
    cx, cy, r = A.bowl(sc, 118, 106, 84)
    A.pool(sc, cx, cy, r * .78, SEASONED, .95)
    A.rice(sc, cx, cy, r * .74, n=40)
    A.label(sc, 268, 50, "soy + sugar, hot;\nsesame oil + salt")
    A.label(sc, 268, 122, "fold in with a\nslicing motion")
    A.label(sc, 268, 178, "don’t mash")
    return sc.render("Rice seasoned with soy, sugar and sesame oil")


def s_shape():
    sc = Scene(803)
    cx, cy, r = A.plate(sc, 128, 102, 88)
    _place(sc, "yaki_seasoned", cx, cy, GRID6, 1.25)
    A.label(sc, 274, 52, "~110 g each,\nhand or mold")
    A.label(sc, 274, 126, "press firmer\nthan usual")
    return sc.render("Seasoned rice pressed into firm triangles")


def s_grill():
    sc = Scene(804)
    region = A.pan(sc, PX, PY, 80, heat=.4)
    cx, cy, r = region
    _parchment(sc, cx, cy)
    _place(sc, "yaki_grilled", cx, cy, GRID4, 1.3)
    A.label(sc, 272, 46, "parchment,\nmedium-low")
    A.label(sc, 272, 118, "turn only when\nthat side is crisp")
    A.label(sc, 272, 178, "two spatulas")
    return sc.render("Onigiri crisping on parchment in a pan")


def s_glaze():
    sc = Scene(805)
    region = A.pan(sc, PX, PY, 80, heat=.15)
    cx, cy, r = region
    _parchment(sc, cx, cy)
    _place(sc, "yaki_glazed", cx, cy, GRID4, 1.3)
    sc += (f'<path d="M{cx + 30},{cy - 30} L{cx + 90},{cy - 86}" stroke="#c9a06a" stroke-width="5" stroke-linecap="round"/>'
           f'<path d="M{cx + 22},{cy - 22} L{cx + 34},{cy - 34}" stroke="#5a3014" stroke-width="9" stroke-linecap="round"/>')
    A.label(sc, 272, 50, "heat low")
    A.label(sc, 272, 116, "brush soy + sesame\noil, glaze side down")
    A.label(sc, 272, 176, "then the other side")
    return sc.render("Brushing the soy glaze on in the pan")


def s_miso():
    sc = Scene(806)
    region = A.pan(sc, PX, PY, 80, heat=.15)
    cx, cy, r = region
    _parchment(sc, cx, cy)
    _place(sc, "yaki_miso", cx, cy, GRID4, 1.3)
    A.label(sc, 272, 50, "miso · mirin · sugar")
    A.label(sc, 272, 116, "10–15 s a side")
    A.label(sc, 272, 170, "it burns fast")
    return sc.render("Miso-glazed yaki onigiri in the pan")


def s_butter():
    sc = Scene(807)
    cx, cy, r = A.plate(sc, 128, 102, 88)
    _place(sc, "yaki_butter", cx, cy, GRID4, 1.45)
    A.label(sc, 274, 58, "½ tbsp butter on\neach, straight\nfrom the pan")
    A.label(sc, 274, 150, "it melts into\nthe crust")
    return sc.render("Butter melting on hot soy-glazed yaki onigiri")


def s_serve():
    sc = Scene(808)
    cx, cy, r = A.plate(sc, 140, 102, 92)
    A.scatter(sc, "yaki_glazed", cx - 40, cy - 26, 2, 1, scale=2)
    A.scatter(sc, "yaki_miso", cx + 34, cy - 30, 2, 1, scale=2)
    A.scatter(sc, "yaki_butter", cx + 40, cy + 30, 2, 1, scale=2)
    A.scatter(sc, "yaki_open", cx - 24, cy + 32, 2, 1, scale=2.1)
    A.steam(sc, cx - 24, cy + 4, 2, 24)
    return sc.render("Soy, miso and butter yaki onigiri, one broken open")


recipe = Recipe(
    slug="yaki-onigiri",
    title="Yaki onigiri (grilled, soy-glazed rice balls)",
    group="Japanese",
    blurb="Rice seasoned with soy and sesame oil, pressed into firm triangles, pan-grilled until the outside is a "
          "crisp brown crust and lacquered with a soy glaze — plus miso and butter versions.",
    yields="9 yaki onigiri",
    serves=3,
    total="~30 min with the rice cooked",
    intro="The onigiri you grill: the rice is seasoned with soy sauce, sugar and sesame oil before shaping, the "
          "triangles are pressed firmer than usual, then pan-grilled on parchment until every side is a <b>crisp, "
          "deep golden-brown crust</b> — and brushed with soy at the end so it lacquers in the pan. Crunchy outside, "
          "soft and steaming inside. For the shaping itself (by hand or with a mold), see "
          "<a href=\"onigiri.html\">onigiri</a>.",
    equipment=["Rice cooker or heavy pot with a lid", "Large bowl + rice paddle", "Onigiri mold (optional)",
               "Large frying pan + parchment paper", "Two silicone spatulas", "Pastry brush"],
    ingredients=[
        ("Rice", [
            ("Japanese short-grain rice", "2¼ cups (450 g, 3 rice-cooker cups)"),
            ("Water (rice)", "2½ cups (600 ml)"),
        ]),
        ("Rice seasoning", [
            ("Soy sauce (rice)", "3 tbsp"),
            ("Sugar", "1 tbsp"),
            ("Toasted sesame oil (rice)", "1 tbsp"),
            ("Kosher salt", "¼ tsp"),
        ]),
        ("Soy glaze", [
            ("Soy sauce (glaze)", "1 tbsp"),
            ("Toasted sesame oil (glaze)", "1 tsp"),
        ]),
        ("Miso glaze (optional)", [
            ("Miso", "2 tbsp"),
            ("Mirin", "1 tbsp"),
            ("Sugar (miso glaze)", "1 tsp"),
        ]),
        ("Butter finish (optional)", [
            ("Butter", "½ tbsp per onigiri"),
        ]),
    ],
    mise=[
        Bowl("Rice", "freshly cooked, hot", [("rice", 1)], "Step 2"),
        Bowl("Rice seasoning", "soy · sugar · sesame oil · salt", [("sauce:soy", 3)], "Step 2", "cup"),
        Bowl("Soy glaze", "soy · sesame oil", [("sauce:glaze", 3)], "Step 5", "cup"),
        Bowl("Miso glaze", "miso · mirin · sugar (optional)", [("sauce:roux_dark", 3)], "Step 6", "cup"),
        Bowl("Butter", "in ½ tbsp pats (optional)", [("yaki_butter_pat", 4)], "Step 7", "plate"),
    ],
    timeline=[
        Task("Season the rice, let it cool a little", 0, 6, "bowl"),
        Task("Shape 9 firm triangles", 6, 8, "bowl"),
        Task("Grill on parchment", 14, 12, "pan"),
        Task("Glaze (soy or miso)", 26, 3, "pan"),
        Task("Butter, serve", 29, 1, "bowl"),
    ],
    timeline_note="Cook the rice first (soak 20–30 min, then cook) — it has to be hot or warm to shape. The grill "
                  "is most of the time: don’t rush it, the crust is the point.",
    steps=[
        Step("Cook the rice",
             ["Soak the rice 20–30 minutes, then cook it with the water in a rice cooker or a heavy pot — see "
              "<a href=\"onigiri.html\">onigiri</a> for the pot method.",
              "This makes about 990 g of cooked rice: nine 110 g onigiri."],
             s_rice, time="~1 h with soaking", part="Rice",
             uses=["Japanese short-grain rice", "Water (rice)"]),
        Step("Season the rice",
             ["Stir the soy sauce and sugar together and microwave 30–60 seconds until hot; whisk until the sugar "
              "dissolves. Stir in the sesame oil and salt.",
              "Hot rice into a large bowl, pour the seasoning over and fold it through with the rice paddle in a "
              "<b>slicing motion</b> — don’t mash.",
              "Making some <b>miso</b> ones? Set aside 110 g of plain rice for each before you season — the miso "
              "glaze goes on plain rice.",
              "Let it cool just until you can hold it; it must still be warm to shape."],
             s_season, time="~5 min", part="Rice",
             uses=["Soy sauce (rice)", "Sugar", "Toasted sesame oil (rice)", "Kosher salt"]),
        Step("Shape firm triangles",
             ["Shape nine triangles of about 110 g, by hand or in a wet mold (fill to the top edge, lid on, push "
              "down until you feel resistance, flip out onto parchment) — see <a href=\"onigiri.html\">onigiri</a>.",
              "Then press each one again with wet hands, <b>firmer than a normal onigiri</b>: left hand underneath "
              "squeezing the sides, right hand a “mountain” on top; press, roll the corner toward you, repeat for "
              "all three corners, then 2–3 more times. Loose ones fall apart in the pan."],
             s_shape, time="~8 min", part="Shape"),
        Step("Grill until crisp",
             ["Line a large frying pan with parchment and set the onigiri on it, a little apart. Medium-low heat.",
              "Leave each side alone until it’s <b>crisp and browned</b> before you turn it — two silicone spatulas, "
              "one side at a time. Moving them early breaks them.",
              "Turn them onto every side, including the edges, until the whole outside is a crisp golden-brown "
              "crust."],
             s_grill, heat="medium-low", time="~12 min", part="Grill"),
        Step("Soy glaze",
             ["Stir the soy sauce and sesame oil together. Turn the heat to low (or off).",
              "Brush one side, turn it glaze-side down onto the parchment, brush the top. A minute or so per side "
              "until it lacquers and darkens — it burns fast once the glaze is on."],
             s_glaze, heat="low", time="~3 min", part="Grill",
             uses=["Soy sauce (glaze)", "Toasted sesame oil (glaze)"]),
        Step("Or: miso glaze",
             ["Mix the miso, mirin and sugar. Grill the plain-rice triangles the same way (a little oil brushed on the "
              "parchment helps), until both sides are browned.",
              "Heat to low, spread miso on top, flip and cook that side <b>10–15 seconds</b>; spread the other side, "
              "flip, 10–15 seconds. Miso burns very fast."],
             s_miso, heat="low", time="~1 min", part="Variations",
             uses=["Miso", "Mirin", "Sugar (miso glaze)"]),
        Step("Or: butter on top",
             ["Straight off the pan, put ½ tbsp butter on each hot soy-glazed onigiri and let it melt into the crust."],
             s_butter, time="~1 min", part="Variations", uses=["Butter"]),
        Step("Eat hot",
             ["Best straight from the pan, while the crust still crackles and the inside steams.",
              "To keep: wrap each one in plastic and freeze for up to a month; reheat in a frying pan or the "
              "microwave."],
             s_serve, part="Serve"),
    ],
    notes=[
        ("Why season the rice", "Soy, sugar and sesame oil in the rice brown faster and deeper than plain rice, so the "
                                "crust gets real colour at medium-low heat — and every bite is seasoned, not just the "
                                "outside. (This is Just One Cookbook’s method.)"),
        ("Why parchment", "Rice sticks and tears on a bare pan; on parchment the crust forms and lifts off cleanly. "
                          "A good non-stick pan works without it."),
        ("Other glazes", "Just One Cookbook suggests unagi or teriyaki sauce instead of soy. Over charcoal or under a "
                         "broiler works too — watch it closely."),
        ("Variations: where they’re from", "The miso glaze is Just One Cookbook’s miso yaki onigiri (she brushes it "
                                           "on plain salted rice). The butter on top is Chopstick Chronicles’ "
                                           "soy-butter version. Putting both on one page, and the butter on JOC’s "
                                           "seasoned rice, is this site’s choice."),
        ("Fridge", "Rice hardens in the fridge. If you must, wrap them and then a thick towel, up to 2 days; let them "
                   "come back to room temperature and reheat in a pan."),
    ],
    sources=[("Just One Cookbook — Yaki onigiri (grilled rice balls)",
              "https://www.justonecookbook.com/yaki-onigiri-grilled-rice-ball/"),
             ("Just One Cookbook — Miso yaki onigiri", "https://www.justonecookbook.com/miso-yaki-onigiri/"),
             ("Chopstick Chronicles — Yaki onigiri (miso-butter and soy-butter)",
              "https://www.chopstickchronicles.com/yaki-onigiri/")],
    hero=s_serve,
)

# Rice storage guidance shared by the combined onigiri page.
from dataclasses import replace
recipe = replace(recipe, notes=[(title, 'Eat freshly made. For later, cool promptly and refrigerate ideally within one hour; use within 24 hours. Keep cold for transport. Reheat grilled rice balls until steaming hot; eat seafood and egg fillings cold or freshly made.' if title == 'Fridge' else body) for title, body in recipe.notes])
