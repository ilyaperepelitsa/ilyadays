#!/usr/bin/env python3
"""Build exact built-in prompts using the same shared policy as the recipe generator.
Does not generate images, contact an API, or consume generation credits.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--slug', action='append', required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
recipes = Path(os.environ.get('RECIPES_DIR', ROOT.parent / 'recipes')).resolve()
policy = ROOT / 'art/image-requirements.json'
shutil.copyfile(policy, recipes / 'imagegen/requirements.json')
sys.path.insert(0, str(recipes))
from imagegen.prompts import MISE_FRAME, POLICY, PROMPTS, prompt  # noqa: E402

rows = []
for slug in args.slug:
    spec = PROMPTS.get(slug)
    if not spec:
        parser.error(f'No authored image specification for {slug}')
    scenes = [('hero', spec['hero'])]
    scenes.extend((str(i), scene) for i, scene in enumerate(spec.get('steps', []), 1))
    scenes.extend((f'mise{i}', MISE_FRAME.format(item=scene)) for i, scene in enumerate(spec.get('mise', []), 1))
    scenes.extend((f'{n}-how{i}', scene) for n, shots in spec.get('how', {}).items() for i, (_, scene) in enumerate(shots, 1))
    for key, scene in scenes:
        hands = 'hand' in scene.lower() and 'no hands' not in scene.lower()
        rows.append({'slug': slug, 'key': key, 'scene': scene,
                     'policy_version': POLICY['version'],
                     'policy_sha256': hashlib.sha256(policy.read_bytes()).hexdigest(),
                     'prompt': prompt('clean', spec['setting'], scene, hands=hands)})
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
print(f'Wrote {len(rows)} prompts to {args.out}; no images generated.')
