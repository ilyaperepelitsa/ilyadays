"""The nine ORIGINAL shop-inspired fillings, separated without replacing their recipes.

onigiri_shop.py remains the preservation source for quantities, cooking instructions and notes.
"""
from copy import deepcopy
from dataclasses import replace
from kit import Recipe, Step
from onigiri_shop import recipe as ORIGINAL, INGREDIENTS, STEPS

SLUGS = [
    "soy-cured-yolk-onigiri", "soboro-onigiri", "pork-kimchi-onigiri",
    "shiso-kombu-onigiri", "takana-onigiri", "peanut-miso-onigiri",
    "eggplant-tsukudani-onigiri", "pepperoncino-onigiri", "mentai-cream-cheese-onigiri",
]
BLURBS = [
    "Bongo-inspired soy-cured yolk: a deep amber, jammy center inside warm rice.",
    "Bongo-inspired niku soboro: fine, glossy pork crumbs with soy, ginger and mirin.",
    "Bongo-inspired pork kimchi: browned pork belly and squeezed kimchi, fried dry.",
    "Yadoroku- and Bongo-inspired shiso kombu: glossy seaweed strips with fresh shiso.",
    "Bongo-inspired takana: sesame-fried pickled mustard greens with chilli.",
    "Bongo-inspired peanut miso: roasted peanuts in a sticky sweet miso glaze.",
    "A quick Nigihaya-inspired eggplant tsukudani, mixed all through the rice.",
    "Bongo-inspired pepperoncino: pale-gold garlic and chilli oil folded through rice.",
    "Bongo-inspired mentai mayo: spicy pollock roe with intact cream-cheese cubes.",
]
INTRO = ('A home version inspired by the shop filling named above. The shops do not publish their recipes; '
         'these quantities are this site\'s own. This page makes <b>one filling</b>, then shapes and serves it. '
         'Start with plain cooked Japanese short-grain rice: '
         '<a href="onigiri.html">rice cooking, hand shaping and all shop fillings →</a>. '
         'The filling preparation time below excludes cooking the rice.')
READY = 'Have the cooked rice ready, covered, and cool it only until comfortable to hold. Wet your hands and rub a little salt over both palms.'
TRIANGLE = 'Cup the rice from below with one hand. Bend the other hand into a roof, press gently to make a corner, turn a third of a turn and repeat. Keep it loose: press only enough to hold together.'
POCKET = 'For each onigiri, put about 60 g rice in your palm, make a well and add a heaped tablespoon of filling. Cover with another 60 g rice and gently close the rice around it. Save any extra filling separately.'
YOLK = 'For each onigiri, put about 60 g rice in your palm, make a well and add one drained cured yolk. Cover with another 60 g rice and gently close it around the yolk without crushing it.'
EGGPLANT = 'Fold the prepared eggplant evenly through 480–720 g warm rice. Divide into four to six portions, about 120 g rice per onigiri before adding the eggplant. There is no separate filling pocket.'
OIL = 'Fold about 1 tsp of the prepared garlic-chilli oil, including some garlic, through each 120 g portion of warm rice. Make four to six portions. This oil batch makes more than you need; do not pour it all into the rice. There is no separate filling pocket.'
FINISH = 'Wrap one strip of nori around the base and up the sides just before serving. Eat within the hour while the nori is crisp. The sliced example shows the inside; cutting yours open is optional.'
TOP = 'For the shop-style finish, set a little of the same filling on top so you can see what is inside. Leave the top uncovered by nori.'

def make_recipe(i):
    original = STEPS[i]
    prep = replace(deepcopy(original), part="Filling", art=None)
    notes = []
    ingredients = deepcopy(INGREDIENTS[i])
    sources = deepcopy(ORIGINAL.sources)
    if i == 1:
        prep.body[-1] = ('Bongo\'s favourite: a spoon of soboro with one '
                         '<a href="soy-cured-yolk-onigiri.html">soy-cured yolk</a> on top. '
                         'The yolk is an optional second filling; prepare it a day ahead.')
    if i == 3:
        # Dashi hydrates kombu but does not necessarily tenderize it. Soften before reducing.
        ingredients = (INGREDIENTS[i][0], [
            ("Kombu left over from dashi, drained (wet weight)", "50 g"),
            ("Water (kombu)", "300 ml, plus more as needed"),
            ("Soy sauce (kombu)", "2 tbsp"), ("Sugar (kombu)", "1 tbsp"),
            ("Mirin (kombu)", "1 tbsp"), ("Rice vinegar (kombu)", "1 tsp"),
            ("Fresh green shiso (perilla) leaves, optional", "4")])
        prep.uses = [name for name, _ in ingredients[1]]
        prep.time = "~35–80 min (until tender)"
        prep.body = [
            'Use <b>50 g drained, hydrated kombu left from dashi</b>, not 50 g dry seaweed. Cut into strips about <b>2 mm wide and 3 cm long</b>. Hydrated does not necessarily mean tender.',
            'Put the kombu, <b>300 ml water and 1 tsp rice vinegar</b> in a small pot. Bring to a boil, then simmer gently, partly covered. Keep the strips submerged: add water whenever the level drops. <b>Do not add soy sauce, sugar or mirin yet.</b>',
            'Start checking after <b>20 minutes</b>; thick kombu may need <b>60 minutes or longer</b>. Cool a strip and bite it: it must cut through easily, without a leathery or stringy centre. <b>Keep simmering with water until it passes this test</b>; the clock is only a guide.',
            'Reserve <b>50 ml cooking water</b>, then drain. Return the tender kombu and reserved water to the pot; add the <b>soy sauce, sugar and mirin</b>. Simmer gently, stirring, about <b>10–15 minutes</b>, until the sauce coats the strips and no loose puddle remains. Stop while the kombu is <b>soft, moist and glossy</b>; do not fry or dry it into furikake.',
            'Turn off the heat and stir in the <b>fresh green shiso (perilla)</b>, finely sliced. It is an aromatic Japanese herb; <b>omit it if unavailable</b> for a plain kombu filling. Let the filling cool before shaping.'
        ]
        notes.extend([
            ("Which kombu?", 'Hidaka or quick-cooking kombu (hayani) is easier to soften for eating. Thick dashi kombu can take longer. If starting from dry kombu, hydrate it fully first, then weigh out 50 g. The cooking time depends on the type and thickness.'),
            ("Still tough?", 'Do not reduce a chewy batch further. Add enough water to cover and simmer gently again, checking a cooled strip until tender. Recheck the seasoning afterwards. This filling should stay moist; dried furikake is a different preparation.'),
            ("What is shiso?", 'Fresh green shiso is green perilla, also sold as aojiso or oba: an aromatic, serrated green leaf. Use fresh leaves here, not dried red shiso seasoning. It adds fragrance, not softness; leaving it out does not change the kombu cooking method.')
        ])
        sources.extend([
            ("Nissui — softening leftover dashi kombu (Japanese)", "https://www.nissui.co.jp/recipe/00990.html"),
            ("Kikkoman — kombu varieties (Japanese)", "https://www.kikkoman.co.jp/homecook/series/konbu/detail.html"),
            ("Kikkoman — shiso / perilla", "https://www.kikkoman.com/en/cookbook/glossary/shiso.html")
        ])
    if i == 5:
        notes.append((ORIGINAL.notes[1][0], ORIGINAL.notes[1][1].replace('in step 6', 'in this recipe')))
    if i == 6:
        notes.append((ORIGINAL.notes[2][0], ORIGINAL.notes[2][1].replace('Step 7', 'This recipe')))
    if i in (1, 3, 4, 5):
        notes.append(("Keeping", "Keep the prepared filling, without rice, in the fridge for 4–5 days."))
    if i == 2:
        notes.append(("Keeping", "Keep the prepared pork kimchi, without rice, in the fridge for two days."))
    if i == 8:
        notes.append(("Another shop combination", 'Try mentai mayo on <a href="takana-onigiri.html">takana</a>; prepare each filling separately.'))
    rice_amount = "480 g (120 g each)" if i == 0 else "480–720 g (120 g each)"
    nori_amount = "4" if i == 0 else "4–6"
    shaping = YOLK if i == 0 else EGGPLANT if i == 6 else OIL if i == 7 else POCKET
    return Recipe(
        slug=SLUGS[i], title=INGREDIENTS[i][0] + " onigiri", group="Onigiri",
        blurb=BLURBS[i], intro=INTRO,
        yields="4 onigiri" if i == 0 else "4–6 onigiri",
        serves=2, total=prep.time + " filling prep, plus rice and shaping",
        equipment=(["Small dishes with lids"] if i == 0 else ["Small bowl"] if i == 8
                   else ["Small pot"] if i == 3 else ["Small frying pan"])
                  + (["Four chopsticks for the soboro"] if i == 1 else [])
                  + ["Rice paddle", "Small bowl of water for your hands", "Kitchen scissors"],
        ingredients=[ingredients, ("To shape", [
            ("Cooked rice, from the onigiri page", rice_amount), ("Nori strips", nori_amount),
            ("Kosher salt (for your hands)", "a little for each onigiri")])],
        steps=[prep,
               Step("Shape them shop style", [READY, shaping, TRIANGLE], part="Shape by hand",
                    time="~2 min each", uses=["Cooked rice, from the onigiri page", "Kosher salt (for your hands)"]),
               Step("Wrap and serve", ([TOP] if i not in (0, 6, 7) else []) + [FINISH],
                    part="Finish", uses=["Nori strips"])],
        notes=notes, sources=sources, hero=None,
    )

RECIPES = [make_recipe(i) for i in range(9)]
