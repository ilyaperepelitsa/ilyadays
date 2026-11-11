"""Original home adaptation inspired by MooKEN; source snapshots in ilyadays art/mooken-cream-puffs."""
import json
from pathlib import Path
from kit import Recipe, Step, Bowl

data = json.loads(Path(__file__).with_suffix('.json').read_text())
data['steps'] = [Step(**s) for s in data['steps']]
data['mise'] = [Bowl(**b) for b in data['mise']]
recipe = Recipe(**data)
