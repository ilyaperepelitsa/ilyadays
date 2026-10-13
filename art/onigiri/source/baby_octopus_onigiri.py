"""Plain rice with separately tender-cooked, browned and glazed baby octopus.
Cooking liquor and excess glaze never enter the rice; ginger is finely chopped.
"""
from kit import Recipe, Step, Bowl, Task

def picture(key):
    def draw(): return None
    draw.picture_key = str(key)
    return draw

recipe = Recipe(
    slug='baby-octopus-onigiri',
    title='Baby octopus onigiri (caramelized sweet-soy filling)',
    group='Japanese',
    blurb=('Plain rice with separately tender-cooked, browned and glazed baby octopus folded through; finely chopped '
 'ginger, no octopus cooking liquor in the rice.'),
    yields='6 onigiri',
    total='~75–95 min, depending on tenderness',
    intro=('Cook the rice on its own. Tender-cook all the octopus separately, drain and dry it, then brown and glaze '
 'it briefly. Fold only the coated pieces and green onion into the cooked rice. This keeps the rice texture '
 'under control and avoids cooking it in purple octopus liquor; a little local colour from the glaze is '
 'normal. This is a home adaptation, rather than traditional takomeshi (rice cooked with octopus).'),
    ingredients=[('Baby octopus',
  [('Baby octopus (iidako)', 'about 300 g (10–12), fresh or thawed frozen'),
   ('Coarse salt (for cleaning)', '1 tbsp')]),
 ('Plain rice', [('Short-grain rice', '225 g'), ('Water for rice', '300 ml')]),
 ('Caramelized octopus',
  [('Neutral oil', '2 tsp'),
   ('Ginger', '14 g, finely chopped to 1–2 mm'),
   ('Soy sauce', '1½ tbsp'),
   ('Mirin', '1½ tbsp'),
   ('Sugar', '1 tbsp'),
   ('Water for glaze', '2 tbsp'),
   ('Green onion', '1 stalk, thinly sliced')]),
 ('To shape',
  [('Salt (for your hands)', 'a pinch per onigiri'), ('Nori', '1 sheet, cut into 6 strips about 2 cm wide')])],
    steps=[
        Step(title='Clean the baby octopus', body=['Frozen ones: thaw them in the fridge overnight. Many are sold already cleaned — then go straight to the '
 'salt rub.',
 'With kitchen scissors, snip across just behind the eyes, where the head joins the body.',
 'Push the top of the head with a chopstick to turn it inside out, pull away the innards, then turn it back '
 'the right way out.',
 'Snip out the eyes, and squeeze the small hard beak out from the centre of the tentacles.'], heat='', time='~10 min', part='The octopus', uses=['Baby octopus (iidako)'], amounts={}),
        Step(title='Salt rub and rinse', body=['Put them in a bowl with the coarse salt and rub hard for 1–2 minutes, until a grey foam comes up.',
 'Run your fingers down each tentacle to clean the suckers.',
 'Rinse well under running water until the surface feels slightly rough, not slimy.'], heat='', time='~4 min', part='The octopus', uses=['Coarse salt (for cleaning)'], amounts={}),
        Step(title='Chop all of it', body=['Cut all the cleaned octopus into 1 cm pieces. Keep the whole batch for separate tender-cooking; none goes '
 'into the rice cooker.'], heat='', time='~4 min', part='The octopus', uses=['Baby octopus (iidako)'], amounts={}),
        Step(title='Wash rice; finely chop ginger', body=['Wash the rice until the water runs nearly clear, drain well, then soak in the measured 300 ml fresh water '
 'for 20 minutes. Keep that water for cooking.',
 'Slice ginger into thin matchsticks, then cut across them and finely chop to 1–2 mm. Reserve for the pan; '
 'no long fibres in the filling.'], heat='', time='~25 min including soaking', part='Plain rice', uses=['Short-grain rice', 'Water for rice', 'Ginger'], amounts={}, diagram=picture(4)),
        Step(title='Cook plain rice on its own', body=['Rice cooker: cook the soaked rice in its measured fresh water on the normal short-grain setting. Do not '
 'add octopus, octopus liquor, soy, dashi or glaze.',
 'Pot: bring to a boil, cover tightly, cook on the lowest heat for 12–13 minutes until absorbed, then rest '
 'off heat covered for 10 minutes. Follow your rice packet if its water ratio differs.',
 'Fluff gently and keep covered until the octopus is ready.'], heat='', time='~25–45 min', part='Plain rice', uses=['Short-grain rice', 'Water for rice'], amounts={}, diagram=picture(5)),
        Step(title='Tender-cook all octopus separately', body=['Cover all the chopped octopus with fresh water in a saucepan. Bring to a gentle simmer and cook quietly; '
 'start checking after 20 minutes.',
 'Cool a piece and taste it. Continue in 5–10 minute intervals until it bites easily; size and species '
 'change the timing. Pink and opaque alone is not enough.',
 'Drain and discard all cooking liquor. Spread on clean towels and pat thoroughly dry. If using already '
 'tender-cooked octopus, skip the simmer and dry it well.'], heat='low', time='20–40+ min; test tenderness', part='Separate octopus cooking', uses=['Baby octopus (iidako)'], amounts={}, diagram=picture(6)),
        Step(title='Brown the dry pieces', body=['Heat neutral oil in a 26 cm pan over medium-high heat. Add the dry tender octopus in one uncrowded layer; '
 'work in batches if necessary.',
 'Leave briefly to develop browned edges, then turn: about 2–3 minutes total. Do not keep frying to fix '
 'tough octopus; it should already be tender. Transfer to a clean plate.'], heat='medium-high', time='2–3 min', part='Separate octopus cooking', uses=['Baby octopus (iidako)', 'Neutral oil'], amounts={}, diagram=picture(7)),
        Step(title='Reduce the ginger glaze, then coat', body=['Lower the heat. Stir the finely chopped ginger in the remaining oil for 20–30 seconds. Add soy, mirin, '
 'sugar and 2 tbsp water.',
 'Bubble gently for 1–2 minutes until lightly syrupy. Return the browned octopus and toss for 30–60 seconds, '
 'just until a thin caramelized sweet-soy coating clings. Stop before sugar burns.',
 'Lift the coated pieces out with tongs or a slotted spoon. Leave any excess sauce in the pan.'], heat='medium-low', time='2–3 min', part='Separate octopus cooking', uses=['Ginger', 'Soy sauce', 'Mirin', 'Sugar', 'Water for glaze'], amounts={}, diagram=picture(8)),
        Step(title='Fold coated octopus into cooked rice', body=['Put the warm cooked rice in a wide bowl. Add only the drained coated octopus pieces and finely sliced '
 'green onion. Do not pour in cooking liquor or leftover glaze.',
 'Cut and fold gently with the rice paddle so pieces spread through without crushing the grains. A few local '
 'brown marks are normal; the rice was never cooked in purple octopus broth.',
 'Cool only until comfortable to handle, then divide the entire mixture into six equal portions.'], heat='', time='~5 min', part='Shape', uses=['Baby octopus (iidako)', 'Green onion'], amounts={}, diagram=picture(9)),
        Step(title='Shape and wrap', body=['Wet and lightly salt your hands. Shape each of the six equal portions gently into a triangle, keeping the '
 'rice airy.',
 'Add the selected nori wrapping just before eating. Remove all cling film before serving.'], heat='', time='~12 min', part='Shape', uses=['Salt (for your hands)', 'Nori'], amounts={}, diagram=picture(10)),
    ],
    mise=[
        Bowl(name='Baby octopus', items='all cleaned and chopped · no split batch', draw=[], goes_in='Steps 3 & 6', vessel='bowl'),
        Bowl(name='Plain rice', items='225 g rice · 300 ml fresh water', draw=[], goes_in='Step 5', vessel='bowl'),
        Bowl(name='Ginger', items='14 g · finely chopped to 1–2 mm', draw=[], goes_in='Step 8', vessel='bowl'),
        Bowl(name='Sweet-soy glaze', items='soy · mirin · sugar · water', draw=[], goes_in='Step 8', vessel='cup'),
        Bowl(name='Green onion', items='thinly sliced', draw=[], goes_in='Step 9', vessel='bowl'),
        Bowl(name='Nori strips', items='6 strips, 2 cm wide', draw=[], goes_in='Step 10', vessel='bowl'),
    ],
    timeline=[
        Task(label='Clean, rinse and chop', start=0, dur=18, where='board'),
        Task(label='Wash and soak rice; chop ginger', start=18, dur=20, where='bowl'),
        Task(label='Cook and rest plain rice', start=38, dur=35, where='wait'),
        Task(label='Tender-cook octopus separately', start=20, dur=40, where='pan'),
        Task(label='Drain, dry, brown and glaze', start=60, dur=9, where='pan'),
        Task(label='Fold, then shape', start=73, dur=12, where='board'),
    ],
    timeline_note=('Cook the rice while the octopus tenderizes in a separate pan. The octopus timing is a guide: test '
 'tenderness before browning. Keep cooked rice covered until folding.'),
    equipment=['Rice cooker or heavy pot with lid',
 'Saucepan, strainer and clean towels',
 '26 cm frying pan and tongs',
 'Kitchen scissors, knife, board and rice paddle'],
    notes=[('Adaptation and sources',
  'MAFF supplies the cleaning/tenderizing-before-seasoning reference. The separate browning, reduced glaze '
  'and folding into plain rice are this site’s revised home method. All octopus is cooked outside the rice '
  'cooker.'),
 ('Tenderness controls the first stage',
  'Pink colour alone does not mean tender. Cool a test piece and bite it: it should yield easily. Continue '
  'gentle cooking if chewy; a brief sear will not tenderize it.'),
 ('Keep the rice dry and fluffy',
  'Discard the octopus cooking liquor. Fold in only drained, thinly coated pieces, not the leftover pan '
  'sauce. Divide the finished mixture into six equal portions rather than assuming a fixed 90 g ball.'),
 ('Serve or chill promptly',
  'Eat freshly made. For later, cool rice quickly and refrigerate ideally within one hour; use within 24 '
  'hours. Add nori just before eating. Texture will firm in the fridge, but that is not a reason to leave '
  'rice out.')],
    sources=[('MAFF — Iidako no nitsuke (simmered baby octopus), Okayama',
  'https://www.maff.go.jp/e/policies/market/k_ryouri/search_menu/4556/index.html'),
 ('Honda fishing — how to clean iidako (Japanese)',
  'https://www.honda.co.jp/fishing/picture-book/iidako/clean01/'),
 ('Food Standards Agency — rice storage', 'https://www.food.gov.uk/safety-hygiene/home-food-fact-checker')],
    before_ingredients='',
    hero=None,
    original='',
    vinegar_options=None,
    batch=None,
    serves=3,
    diagrams=False,
)
