#!/usr/bin/env python3
"""Stoicism section cover: a few drafts in the site's cover style, one of which becomes public/covers/stoicism.webp.

    python3 scripts/stoicism-cover.py draft [--only A,B] [--budget-usd 2]   # drafts into art/stoicism/drafts/
    python3 scripts/stoicism-cover.py pick X                                # draft X -> art/covers, public/covers, public/share

Uses the same OpenAI Images call, model, size, quality and style references as the Fitness cover
(scripts/fitness-images.py: /v1/images/edits with the Travel, Food and Fitness covers as style references).
Every request is logged with its exact prompt and cost in art/stoicism/prompts.json; OPENAI_API_KEY is never printed.
"""
import base64, importlib.util, json, shutil, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('fi', ROOT / 'scripts/fitness-images.py'); fi = importlib.util.module_from_spec(spec); spec.loader.exec_module(fi)
OUT = ROOT / 'art/stoicism'; LOG = OUT / 'prompts.json'
REFS = [ROOT / 'art/covers/travel.webp', ROOT / 'art/covers/food.webp', ROOT / 'art/covers/fitness.webp']
STYLE = ("Use the reference image(s) ONLY to keep the same art style: line weight, flat matte shading, palette, warm golden light "
         "and background tone. Draw a NEW picture exactly as described below; do not copy the subject, composition or any detail "
         "from the references.\n\n"
         "Clean cel-shaded anime game illustration with a touch of realism, like polished official background art in a Japanese "
         "action game: semi-realistic forms, proportions, lighting and materials; crisp, well-defined ink outlines of confident even "
         "weight around every object, with clean hard edges and clear separation between pieces; large areas of smooth colour with "
         "two- or three-tone cel shading and a few soft gradients; bright, slightly richer colours. All surfaces clean: no texture, "
         "no grain, no noise, no hatching or cross-hatching, no pencil, no stippling, no mosaic or crackle pattern, no paper texture. "
         "Minimal scenery: only the items the scene mentions. No text, no letters, no lettering, no numbers, no inscriptions, no "
         "watermark.\n\n")
FACE = ("Marcus Aurelius as his Roman portraits show him in middle age: thick curly hair, a full curly beard, a calm, "
        "inward, slightly heavy-lidded gaze, a straight nose.")
DIGITAL = ("The 'digital' part is subtle and clean: thin luminous gold lines and small glowing points, like a star chart or a "
           "network graph, drawn with the same crisp outlines; no screens, no circuitry, no code, no glitch effects, no text.")
SCENES = {
 'A': f"Scene: a white marble bust of {FACE} on a plain stone plinth beside a low wooden writing desk with one open papyrus scroll "
      f"(no legible writing, only soft grey strokes) and a small bronze oil lamp, in a quiet Roman room at golden hour; warm light "
      f"from a tall window on the left. Behind the bust, a few dozen small glowing points float in the air connected by thin gold "
      f"lines, grouped into a handful of loose clusters, as if the ideas of the scroll were mapped in space. {DIGITAL} Calm, "
      f"uncluttered, inviting; seen at eye level from a gentle three-quarter angle.",
 'B': f"Scene: a close portrait of a white marble bust of {FACE} in three-quarter profile against a warm sunset sky over soft "
      f"distant hills; the back of the head and shoulder gradually turn into a clean lattice of small glowing gold points joined by "
      f"thin lines, the marble form still readable through it. {DIGITAL} Calm and dignified; plenty of open sky.",
 'C': f"Scene: {FACE} He sits at a simple camp table inside an open Roman army tent at dusk, wearing a plain wool cloak over a "
      f"tunic, writing on a wax tablet with a stylus; an oil lamp glows on the table beside a few loose papyrus sheets; through the "
      f"open tent flap a wide river (the Danube) catches the last golden light. Above the table, faint thin gold threads link the "
      f"loose sheets like a small constellation. {DIGITAL} Quiet, focused, warm.",
 'D': f"Scene: the bronze equestrian statue of Marcus Aurelius (the emperor on horseback, right arm raised in a calm gesture, "
      f"{FACE}) on a tall stone pedestal in an open Roman square at golden hour, warm low sun, long soft shadows on pale paving; "
      f"in the clear sky above, a soft network of small glowing points and thin gold lines like a star chart. {DIGITAL} No people "
      f"besides the statue, no signs.",
}

def log(entry):
    data = json.loads(LOG.read_text()) if LOG.exists() else []
    data.append(entry); LOG.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')

def draft(only, budget):
    spent = sum(e.get('cost', 0) for e in (json.loads(LOG.read_text()) if LOG.exists() else []))
    pricing = fi.load_json(ROOT / 'art/fitness/pricing.json')
    (OUT / 'drafts').mkdir(parents=True, exist_ok=True)
    for k in only:
        if spent + 0.12 > budget: sys.exit(f'budget {budget} would be passed (spent {spent:.3f})')
        prompt = STYLE + SCENES[k]; t = time.time()
        r = fi.edit(prompt, REFS, 'gpt-image-2', 'medium', '1536x1024')
        cost = fi.cost_from_usage(pricing, 'gpt-image-2', r.get('usage', {})); spent += cost
        out = OUT / 'drafts' / f'{k}.webp'; out.write_bytes(base64.b64decode(r['data'][0]['b64_json']))
        log({'key': k, 'model': 'gpt-image-2', 'size': '1536x1024', 'quality': 'medium', 'refs': [str(p.relative_to(ROOT)) for p in REFS],
             'prompt': prompt, 'cost': round(cost, 4), 'usage': r.get('usage'), 'seconds': round(time.time() - t), 'out': str(out.relative_to(ROOT))})
        print(f'{k}: {out.relative_to(ROOT)} ${cost:.4f} (total ${spent:.4f})')

def pick(k):
    src = OUT / 'drafts' / f'{k}.webp'
    shutil.copy(src, ROOT / 'art/covers/stoicism.webp')
    fi.webp_resize(src, ROOT / 'public/covers/stoicism.webp', 800)
    png = OUT / 'drafts' / f'{k}.png'; subprocess.run(['dwebp', '-quiet', str(src), '-o', str(png)], check=True)
    from PIL import Image
    im = Image.open(png).convert('RGB'); w, h = 1200, 630; s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, tp = (im.width - w) // 2, (im.height - h) // 2; im.crop((l, tp, l + w, tp + h)).save(ROOT / 'public/share/stoicism.jpg', quality=85)
    png.unlink(); print('picked', k)

if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'draft':
        only = a[a.index('--only') + 1].split(',') if '--only' in a else list(SCENES)
        draft(only, float(a[a.index('--budget-usd') + 1]) if '--budget-usd' in a else 2.0)
    elif a[0] == 'pick': pick(a[1])
