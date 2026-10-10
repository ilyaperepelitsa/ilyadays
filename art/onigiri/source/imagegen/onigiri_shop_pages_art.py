"""Step illustration specs for the nine separated ORIGINAL shop-inspired fillings."""
from recipes.onigiri_shop_fillings import SPEC as ORIGINAL

CAPTIONS = [
    "One drained cured yolk in the well, still whole.",
    "Fine soboro crumbs in a central well, surrounded by plain rice.",
    "Dry pork kimchi in the well; keep the rice edges clear so they can close.",
    "Glossy kombu and shiso in the well, enclosed with plain rice.",
    "A heaped spoon of dry takana in the well, then rice to cover.",
    "Sticky miso-coated peanuts in the well; close the rice loosely around them.",
    "Fold the eggplant evenly through warm rice before shaping; no central pocket.",
    "Fold about 1 tsp garlic-chilli oil through each rice portion; no central pocket.",
    "Mentai mayo and intact cream-cheese cubes in the well, then rice to cover.",
]

FILLINGS = [
    "one whole amber soy-cured egg yolk",
    "fine brown cooked pork soboro crumbs",
    "dry browned pork belly and red-orange napa-cabbage kimchi",
    "long narrow flat glossy black kombu strips and fine green shiso ribbons",
    "finely chopped cooked green takana mustard pickles with sesame",
    "roasted peanuts in sticky reddish-brown miso glaze",
    "small soft purple-brown eggplant cubes evenly mixed throughout rice",
    "pale golden garlic-chilli oil evenly mixed throughout rice, with pale garlic slices and red chilli flakes",
    "pale coral mentaiko mayo with intact ivory cream-cheese cubes",
]

def make_spec(i):
    filling = FILLINGS[i]
    preparation = ORIGINAL["steps"][i]
    if i == 3:
        preparation = "Finished thin 3 cm by 2 mm glossy black kombu strips in a saucepan, with fine green shiso ribbons " \
                      "just stirred in OFF THE HEAT. Gas burner visibly OFF, no blue flame. Almost dry glaze."
    elif i == 7:
        preparation = "Finished pale golden garlic slices in olive oil with red chilli flakes just added OFF THE HEAT. " \
                      "Gas burner visibly OFF, no blue flame. Garlic remains pale, oil settling, not vigorously boiling."
    return {
        "setting": "Warm Miyazaki-inspired hand-painted Japanese animation food illustration, "
                   "soft cel shading, ivory ceramics and honey wood. Only this recipe: " + filling + ". "
                   "No assortment, diagrams, labels or photorealism. Natural hand proportions and five digits per hand; "
                   "naturally occluded fingers stay hidden.",
        "steps": [preparation,
                  "Close up of both hands gently shaping one rounded triangle of the recipe's rice. "
                  "For eggplant or pepperoncino, the filling is mixed evenly throughout the rice. "
                  "For center-filled recipes, the filling is enclosed by plain white rice. No nori yet.",
                  "One onigiri cut into two matching halves, both cut faces showing " + filling + "."],
        "how": {2: [(CAPTIONS[i],
                     ORIGINAL["how"][i + 1][0][1] if i in (6, 7) else
                     "Left palm cups plain rice with a central well. Right hand adds only this recipe's "
                     "prepared filling to the well: " + filling + ". No nori, no other fillings, five fingers per hand.")]},
        "mise": [],
        "hero": "One onigiri cut into two matching halves showing only " + filling + ".",
    }
