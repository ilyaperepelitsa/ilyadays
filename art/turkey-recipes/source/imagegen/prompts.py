"""Image prompts: one shared style per look, the RULES every image follows (imagegen/RULES.md), and per
recipe (imagegen/recipes/<slug>.py): a setting, one scene per step, "how" technique shots (caption shown
on the site, scene sent to the model), mise-en-place icons and a hero."""
import sys

# One shared policy for all generated site art. The versioned owner is
# ilyadays/art/image-requirements.json; sync-content.sh refreshes this local mirror.
import json
from pathlib import Path
POLICY = json.loads((Path(__file__).parent / "requirements.json").read_text())
RULES = POLICY["rules"] + " " + POLICY["anatomy"]
SMALL_PIECES = POLICY["small_pieces"]
NO_TEXT = POLICY["no_text"]
HANDS = POLICY["hands"]

# style: how it is drawn. counter/hob fill the {counter}/{hob} slots in each recipe's setting.
STYLES = {
    "photo": {
        "style": "Realistic overhead food photograph, shot from directly above (top-down flat lay). Soft natural "
                 "daylight from the upper left with gentle shadows, true-to-life colours, crisp detail, editorial "
                 "cookbook photography in a real home kitchen. Landscape frame with a little empty counter space on "
                 "the right.",
        "counter": "a light warm-grey stone countertop",
        "hob": "a gas hob with a black cast-iron grate and blue flame",
    },
    "painted": {
        "style": "Detailed hand-painted cookbook illustration: gouache and watercolour with fine ink linework, viewed "
                 "from directly above (top-down), warm natural light, realistic proportions and food textures, subtle "
                 "paper grain. Landscape frame with a little empty counter space on the right.",
        "counter": "a light warm-grey stone countertop",
        "hob": "a gas hob with a black cast-iron grate and blue flame",
    },
    "feast": {
        "style": "Stylized fantasy video-game food art, like the lavish meal cutscenes of a Japanese hunting action "
                 "RPG: hand-painted digital illustration, chunky slightly exaggerated shapes, ultra-glossy juicy food "
                 "with bright specular highlights, saturated warm colours, dramatic golden key light and rim light, "
                 "glistening sauce, billowing curls of steam, rich tactile textures on wood, iron and clay. "
                 "Three-quarter view from above, close and dramatic, the food is the hero.",
        "counter": "a heavy, worn dark-wood table in a rustic fantasy village kitchen, warm firelight",
        "hob": "a squat clay charcoal brazier with glowing coals and lively orange flames",
    },
    "cel": {
        "style": "Bold cel-shaded anime game illustration of food: clean confident dark outlines, bright saturated "
                 "flat colours with crisp two-tone shading, sharp white gloss highlights, slightly exaggerated "
                 "plump juicy shapes, stylized swirls of steam and little sparkles, high energy and appetising. "
                 "Three-quarter view from above.",
        "counter": "a warm honey-coloured wooden counter in a Japanese village inn kitchen",
        "hob": "a squat clay charcoal brazier with glowing coals and stylized orange flames",
    },
    "woodblock": {
        "style": "Japanese woodblock print (ukiyo-e) fused with modern game illustration: bold calligraphic "
                 "outlines, flat layered colour blocks with subtle gradients (bokashi), visible washi paper fibre "
                 "texture, palette of indigo, vermilion, ochre and gold with cream highlights, stylized swirling "
                 "steam and flame motifs, food still glossy and appetising. Three-quarter view from above.",
        "counter": "a warm wooden counter in a traditional Japanese village kitchen",
        "hob": "a squat clay charcoal brazier with glowing coals and stylized curling flames",
    },
    "sketch": {
        "style": "Hand-drawn cel-shaded anime game illustration of food, like a page from an artist's sketchbook: "
                 "visible pencil underdrawing and confident hand-inked outlines with natural line-weight variation "
                 "and slight wobble, coloured with alcohol markers and a little brush ink — bright saturated flat "
                 "colours, crisp two-tone shading, sharp white gloss highlights, slightly exaggerated plump juicy "
                 "shapes, hand-drawn curls of steam, subtle off-white paper grain. Tight close crop on the subject, "
                 "three-quarter view from above. Minimal scenery: only the items the scene mentions, sitting on a "
                 "small loosely sketched patch of counter that fades out into plain paper; no room, no shelves, no "
                 "background props.",
        "counter": "a plain light wooden counter",
        "hob": "a small clay charcoal brazier with glowing coals and inked orange flames",
    },
    "clean": {
        "style": "Clean cel-shaded anime game illustration of food with a touch of realism, like polished official "
                 "item art in a Japanese action game: semi-realistic forms, proportions, lighting and materials; "
                 "crisp, well-defined ink outlines of confident even weight around every object and every food "
                 "piece, with clean hard edges and clear separation between pieces; large areas of smooth colour "
                 "with two- or three-tone cel shading and a few soft gradients; sharp white gloss highlights; bright, "
                 "appetising, slightly richer colours; plump juicy shapes; simple stylized steam curls. "
                 "How to draw food surfaces: cooked egg is smooth, silky and glossy in large soft folds and sheets — "
                 "never curdled, foamy, bubbly, crumbly or pebbly; simmering liquid is a smooth glossy surface with "
                 "only a few small, clean bubbles near the edge — no foam, no dense bubbles; rice is a smooth soft "
                 "mound with a few dozen individually outlined, same-size grains on the top and edges, never a noisy "
                 "field of tiny grains; wood is smooth with a few long grain lines. All surfaces clean: no texture, no grain, "
                 "no noise, no hatching or cross-hatching, no pencil, no stippling, no mosaic or crackle pattern, no "
                 "paper texture. Tight close crop on the subject, three-quarter view from above. Minimal scenery: only "
                 "the items the scene mentions, on a plain clean off-white background with a simple soft shadow.",
        "counter": "a simple smooth light-wood surface under the items",
        "hob": "a small clay charcoal brazier with glowing coals and simple stylized orange flames",
    },
    "anime": {
        "style": "Food scene from a classic hand-drawn Japanese animated feature film (1980s–90s cel animation): "
                 "food drawn with love so it looks irresistibly delicious — glistening, jiggly, glowing with warm "
                 "light. Thin, soft, slightly coloured outlines (warm brown, not heavy black); smooth flat cel paint "
                 "with gentle two-tone shading and luminous soft highlights; a softly painted poster-colour "
                 "background with smooth gentle gradients. Warm golden afternoon sunlight, cosy and nostalgic, "
                 "slightly muted natural palette. Smooth clean surfaces: no grain, no noise, no hatching, no paper "
                 "texture. Close crop on the subject, three-quarter view from above; minimal scenery — only the items "
                 "the scene mentions, with a softly painted, out-of-focus kitchen hinted behind.",
        "counter": "a worn, warm wooden kitchen table",
        "hob": "a small clay charcoal brazier with glowing coals and soft orange flames",
    },
}


# Said last too, whenever the scene has chopsticks: they came out as three sticks in one hand, crossed,
# or at impossible angles.
CHOPSTICKS = POLICY["chopsticks"]


def prompt(look, setting, scene, hands=False):
    st = {**STYLES[look], "style": POLICY["style"]}
    tail = POLICY.get("rendering_lock", "") + "\n\n" + SMALL_PIECES + ("\n\n" + CHOPSTICKS if "chopstick" in scene.lower() else "")
    return f"{st['style']} {HANDS if hands else NO_TEXT}\n\n{RULES}\n\n{setting.format(**st)}\n\nScene: {scene}\n\n{tail}"


MISE_FRAME = ("Mise-en-place icon: viewed from directly above (top-down), {item}, centred and filling about 80% of "
              "a square frame, on a plain clean off-white background with a soft round shadow. Nothing else in "
              "frame, no hands, no table edges.")


def mise_scene(slug, i, name, items):
    """Scene for the i-th (1-based) mise bowl: hand-written in PROMPTS[slug]['mise'] or built from the Bowl."""
    custom = PROMPTS.get(slug, {}).get("mise", [])
    item = custom[i - 1] if i <= len(custom) else f"a small white bowl holding {name.lower()} ({items})"
    return MISE_FRAME.format(item=item)


def how_key(step, i):
    """File key of the i-th (1-based) technique shot for a step, e.g. '2-how1'."""
    return f"{step}-how{i}"


def how_captions(slug):
    """{file key: caption} for a recipe's technique shots."""
    spec = PROMPTS.get(slug, {})
    return {how_key(n, i): cap for n, shots in spec.get("how", {}).items() for i, (cap, _) in enumerate(shots, 1)}


def _load():
    """One module per recipe in imagegen/recipes/ (oyakodon.py, chicken_pad_thai.py, ...), each with SPEC."""
    import importlib.util
    from pathlib import Path
    out = {}
    for f in sorted((Path(__file__).parent / "recipes").glob("*.py")):
        spec = importlib.util.spec_from_file_location(f"imagegen_recipe_{f.stem}", f)
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except Exception as e:  # one broken recipe file must not stop the others
            print(f"warning: skipping {f.name}: {type(e).__name__}: {e}", file=sys.stderr)
            continue
        out[f.stem.replace("_", "-")] = mod.SPEC
    return out


PROMPTS = _load()
