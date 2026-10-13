"""Spam musubi — Hawaii's onigiri: a teriyaki-glazed slice of Spam on a pressed block of rice with furikake, belted with
nori. Sauce, slicing, sear-then-glaze and the mold method: The Heirloom Pantry's teriyaki spam musubi. Using the clean
Spam can as the mold (plastic wrap inside) and taking the glazed slices straight off the heat: Christie at Home. The thin
egg layer (Spam-and-egg musubi, a common Hawaii variation) is this site's addition, flagged on the page.
"""
import art as A
from art import Scene
from kit import PX, PY, Bowl, Recipe, Step, Task

# ---------------------------------------------------------------- local shapes


def _slab(fill, edge, top=None, w=26, h=14):
    """A Spam-can-shaped slice seen from above: a rounded rectangle, optionally with a glaze sheen."""
    def f(rng):
        b = (f'<rect x="{-w / 2}" y="{-h / 2}" width="{w}" height="{h}" rx="3.2" fill="{fill}" stroke="{edge}" '
             'stroke-width=".9"/>')
        if top:
            b += (f'<rect x="{-w / 2 + 2}" y="{-h / 2 + 2}" width="{w - 4}" height="{h - 4}" rx="2.4" fill="{top}" '
                  'opacity=".55"/>')
        return b + (f'<path d="M{-w / 2 + 3},{-h / 2 + 3} L{w / 2 - 6},{-h / 2 + 3}" stroke="#fff" stroke-width="1.1" '
                    'stroke-linecap="round" opacity=".55"/>')
    return f


A.SHAPES["sm_spam_raw"] = (_slab("#e9a3a0", "#b9706c"), 30, 1)
A.SHAPES["sm_spam_seared"] = (_slab("#d98b6c", "#9a5232", top="#b8653e"), 30, 1)
A.SHAPES["sm_spam_glazed"] = (_slab("#a8562a", "#6e3214", top="#7a3a16"), 30, 1)
A.SHAPES["sm_egg"] = (_slab("#f6d24a", "#d4a91c", top="#fbe48a"), 30, 1)


def _musubi(rng):
    """Finished musubi from above: rice block, glazed Spam on top, a nori belt round the middle."""
    return ('<rect x="-15" y="-9" width="30" height="18" rx="3" fill="#fbf8ef" stroke="#d9cdb3" stroke-width=".8"/>'
            '<rect x="-13" y="-7" width="26" height="14" rx="2.6" fill="#a8562a" stroke="#6e3214" stroke-width=".8"/>'
            '<rect x="-6" y="-10" width="12" height="20" fill="#1f2a22" stroke="#0e1410" stroke-width=".6"/>'
            '<path d="M-11,-5 L-7,-5" stroke="#fff" stroke-width="1" opacity=".5" stroke-linecap="round"/>')


A.SHAPES["sm_musubi"] = (_musubi, 36, 1)

# ---------------------------------------------------------------- scenes


def s_sauce():
    sc = Scene(1301)
    cx, cy, r = A.bowl(sc, 120, 104, 70)
    A.fill(sc, (cx, cy, r), [("sauce:soy", 4)])
    A.label(sc, 262, 56, "soy · mirin\n· sake")
    A.label(sc, 262, 126, "+ brown sugar,\nwhisked")
    return sc.render("Teriyaki sauce")


def s_slice():
    sc = Scene(1302)
    x, y, w, h = A.board(sc, 10, 12, 300, 176)
    A.scatter_rect(sc, "sm_spam_raw", x + 20, y + 16, w - 40, h - 60, 8, scale=1.5, layout="even")
    A.knife(sc, 246, 176, a=-8, s=.75)
    A.label(sc, x + w / 2, y + h - 8, "8 slices, ~1 cm, the shape of the can")
    return sc.render("Spam sliced")


def s_egg():
    sc = Scene(1303)
    x, y, w, h = A.board(sc, 10, 12, 300, 176)
    A.scatter_rect(sc, "sm_egg", x + 20, y + 16, w - 40, h - 60, 8, scale=1.5, layout="even")
    A.label(sc, x + w / 2, y + h - 8, "thin omelette, cut to Spam size")
    return sc.render("Egg layer (optional)")


def s_sear():
    sc = Scene(1304)
    region = A.pan(sc, PX, PY, 80, heat=.7)
    A.scatter(sc, "sm_spam_seared", region[0], region[1], region[2] * .62, 6, scale=1.4, layout="even")
    A.sizzle(sc, region[0], region[1], region[2])
    A.label(sc, 70, 18, "medium-high, one layer")
    A.label(sc, 262, 186, "3–5 min, flip halfway")
    return sc.render("Spam searing")


def s_glaze():
    sc = Scene(1305)
    region = A.pan(sc, PX, PY, 80, heat=.7)
    A.pool(sc, region[0], region[1], region[2] * .6, A.SAUCE["glaze"], .55, name="glaze")
    A.scatter(sc, "sm_spam_glazed", region[0], region[1], region[2] * .62, 6, scale=1.4, layout="even")
    A.steam(sc, region[0], region[1] - 40, 3, 50)
    A.label(sc, 70, 18, "sauce in, 1–2 min")
    A.label(sc, 262, 186, "thick glaze → plate")
    return sc.render("Teriyaki glaze")


def s_mold():
    sc = Scene(1306)
    x, y, w, h = A.board(sc, 10, 12, 300, 176)
    sc += ('<rect x="135" y="18" width="50" height="152" rx="2" fill="#1f2a22" stroke="#0e1410" stroke-width="1.2"/>'
           '<rect x="108" y="66" width="104" height="58" rx="6" fill="none" stroke="#7aa6c8" stroke-width="5"/>'
           '<rect x="112" y="70" width="96" height="50" rx="4" fill="#fbf8ef" stroke="#d9cdb3" stroke-width="1"/>')
    A.label(sc, 160, 186, "nori strip shiny side down · mold across it · rice ~2 cm deep")
    return sc.render("Rice in the mold")


def s_press():
    sc = Scene(1307)
    x, y, w, h = A.board(sc, 10, 12, 300, 176)
    sc += ('<rect x="135" y="18" width="50" height="152" rx="2" fill="#1f2a22" stroke="#0e1410" stroke-width="1.2"/>'
           '<rect x="112" y="70" width="96" height="50" rx="4" fill="#fbf8ef" stroke="#d9cdb3" stroke-width="1"/>')
    A.scatter_rect(sc, "aonori", 116, 74, 88, 42, 14)
    A.scatter_rect(sc, "sesame", 116, 74, 88, 42, 10)
    sc += ('<rect x="116" y="74" width="88" height="42" rx="5" fill="#a8562a" stroke="#6e3214" stroke-width="1"/>'
           '<path d="M122,80 L170,80" stroke="#fff" stroke-width="1.4" opacity=".5" stroke-linecap="round"/>')
    A.label(sc, 160, 186, "furikake · (egg) · glazed Spam — press, lift the mold")
    return sc.render("Layered and pressed")


def s_wrap():
    sc = Scene(1308)
    cx, cy, r = A.plate(sc, 160, 100, 86)
    A.scatter(sc, "sm_musubi", cx, cy, r * .55, 4, scale=1.5, layout="even")
    A.label(sc, 284, 60, "nori folded\nover, sealed")
    A.label(sc, 284, 140, "seam side\ndown")
    return sc.render("Spam musubi")


SPAM = "Spam (canned luncheon meat)"

recipe = Recipe(
    slug="spam-musubi",
    title="Spam musubi",
    group="Japanese",
    blurb="Hawaii's onigiri: a teriyaki-glazed slice of Spam on a pressed block of rice and furikake, belted with "
          "nori — salty, sweet, juicy, and fun to make with a mold or the Spam can itself.",
    yields="8 musubi",
    total="~25 min with the rice cooked",
    intro="Hawaii's favourite onigiri: Spam seared until caramelised, glazed in a quick teriyaki sauce, and pressed "
          "onto a block of warm rice with furikake, then wrapped in a strip of nori like a belt. A musubi mold makes "
          "it easy; the <b>empty Spam can</b>, lined with plastic wrap, works too. For the rice and more fillings see "
          "<a href=\"onigiri.html\">onigiri</a>.",
    equipment=["Musubi mold (press) — or the clean Spam can + plastic wrap", "Large frying pan",
               "Chef's knife + cutting board", "Small bowl (sauce)", "Rice paddle + a small bowl of water",
               "Small frying pan for the egg layer (optional)"],
    ingredients=[
        ("Musubi", [
            ("Cooked short-grain rice, warm", "~1.3 kg (from 3 cups / ~600 g uncooked)"),
            (SPAM, "1 can, 340 g (12 oz), low-sodium if you can"),
            ("Neutral oil", "1 tsp"),
            ("Nori", "2 sheets, each cut into 4 strips (~5 cm wide)"),
            ("Furikake", "4 tbsp"),
        ]),
        ("Teriyaki sauce", [
            ("Soy sauce", "3 tbsp"),
            ("Mirin", "4 tbsp"),
            ("Sake", "1 tbsp"),
            ("Brown sugar", "2 tsp"),
        ]),
        ("Egg layer (optional)", [
            ("Eggs", "3"),
            ("Sugar", "1 tsp"),
            ("Salt", "a pinch"),
        ]),
    ],
    mise=[
        Bowl("Teriyaki sauce", "soy · mirin · sake · brown sugar", [("sauce:soy", 3)], "Step 1", "cup"),
        Bowl("Spam", "1 can", [("sm_spam_raw", 4)], "Step 2", "plate"),
        Bowl("Eggs (optional)", "beaten with sugar + salt", [("egg_beaten", 1)], "Step 3"),
        Bowl("Rice", "freshly cooked, warm", [("rice", 1)], "Step 6"),
        Bowl("Nori + furikake", "nori strips · furikake", [("aonori", 12), ("sesame", 10)], "Step 7", "plate"),
    ],
    timeline=[
        Task("Teriyaki sauce", 0, 2, "bowl"),
        Task("Slice the Spam", 2, 3, "board"),
        Task("Egg layer (optional)", 5, 5, "pan"),
        Task("Sear the Spam", 10, 5, "pan"),
        Task("Glaze", 15, 2, "pan"),
        Task("Mold, layer, press, wrap ×8", 17, 10, "board"),
    ],
    timeline_note="Cook the rice first and keep it warm — warm rice presses into a block that holds; cold rice "
                  "crumbles.",
    steps=[
        Step("Teriyaki sauce",
             "Whisk the soy sauce, mirin, sake and brown sugar in a small bowl until the sugar dissolves.",
             s_sauce, time="2 min", uses=["Soy sauce", "Mirin", "Sake", "Brown sugar"]),
        Step("Slice the Spam",
             ["Tip the Spam out of the can. <b>Keep the can</b> if you have no mold — wash it, it's your mold.",
              "Cut the block into <b>8 even slices</b>, about 1 cm thick, each the shape of the can's top."],
             s_slice, time="3 min", uses=[SPAM]),
        Step("Egg layer (optional)",
             ["Beat the eggs with the sugar and salt.",
              "Cook as one thin omelette in a lightly oiled small pan over medium-low heat, without browning; flip "
              "once.",
              "Cut it into 8 pieces the size of a Spam slice (fold it to stack two layers if it's thin)."],
             s_egg, heat="medium-low", time="~5 min", uses=["Eggs", "Sugar", "Salt"]),
        Step("Sear the Spam",
             ["Heat the oil in a large frying pan over <b>medium-high</b> heat.",
              "Lay the slices in one layer and sear 3–5 minutes in all, flipping halfway, until caramelised and "
              "golden-brown on both sides."],
             s_sear, heat="medium-high", time="3–5 min", uses=["Neutral oil"]),
        Step("Glaze",
             ["Pour the sauce over the Spam and cook 1–2 minutes, flipping once, until it bubbles down to a thick, "
              "shiny glaze that coats the slices.",
              "Take them out straight away onto a plate, with a little of the glaze — left in the hot pan, the sugar "
              "burns."],
             s_glaze, heat="medium-high", time="1–2 min"),
        Step("Rice into the mold",
             ["Lay a strip of nori <b>shiny side down</b> on the board and set the mold across its middle.",
              "Wet the rice paddle and fill the mold evenly with warm rice, about 2 cm (¾ in) deep — roughly ⅛ of the "
              "rice.",
              "<b>No mold:</b> line the clean can with plastic wrap, pack the rice in the bottom, press it flat, lift "
              "it out by the wrap and unwrap it onto the nori."],
             s_mold, time="~1 min each", uses=["Cooked short-grain rice, warm", "Nori"]),
        Step("Layer and press",
             ["Sprinkle furikake over the rice; add a piece of egg if you made it; top with a glazed Spam slice, "
              "carrying a little glaze.",
              "Press down firmly with the mold's lid to pack the rice into a block.",
              "Keep pressing the lid down with one hand and lift the mold's frame off with the other."],
             s_press, time="~1 min each", uses=["Furikake"]),
        Step("Wrap in nori",
             ["Fold one end of the nori strip up over the Spam, then the other, snug, like a belt round the middle.",
              "Dab a little water on the overlap to seal it and set it seam side down.",
              "Repeat for all 8. Eat warm or at room temperature; cut in half with a wet knife if you like."],
             s_wrap, time="~1 min each"),
    ],
    notes=[
        ("Can as the mold", "The Spam can is exactly the right shape. Wash it, line it with plastic wrap so the rice "
                            "lifts out, and mind the edges if it was opened with a can opener."),
        ("Don't burn the glaze", "Mirin and sugar caramelise fast. As soon as the sauce turns thick and shiny, get "
                                 "the slices out of the pan."),
        ("Keeping", "Best the same day, at room temperature. Wrapped tightly in plastic wrap they keep a few hours; "
                    "the fridge hardens the rice."),
        ("Added here", "The egg layer (Spam-and-egg musubi, a common Hawaii version) is this site's addition. The "
                       "oil and the narrow nori strips (a belt with the Spam showing at both ends) follow Christie at "
                       "Home; The Heirloom Pantry uses half sheets that wrap the whole block."),
    ],
    sources=[("The Heirloom Pantry — How to make teriyaki spam musubi",
              "https://theheirloompantry.co/how-to-make-teriyaki-spam-musubi/"),
             ("Christie at Home — Quick & easy spam musubi (the can as the mold)",
              "https://christieathome.com/blog/spam-musubi/")],
    hero=s_wrap,
)

# Rice storage guidance shared by the combined onigiri page.
from dataclasses import replace
recipe = replace(recipe, notes=[(title, 'Eat freshly made. For later, cool promptly and refrigerate ideally within one hour; use within 24 hours. Keep cold for transport. Reheat grilled rice balls until steaming hot; eat seafood and egg fillings cold or freshly made.' if title == 'Keeping' else body) for title, body in recipe.notes])
