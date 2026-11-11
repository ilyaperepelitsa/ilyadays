"""Crispy potato wedges: source-informed home adaptations; see ilyadays art/crispy-potatoes."""
import json
from pathlib import Path
from kit import Recipe, Step, Bowl

def load():
    rows = json.loads(Path(__file__).with_suffix('.json').read_text())
    for row in rows:
        row['steps'] = [Step(**s) for s in row['steps']]
        row['mise'] = [Bowl(**b) for b in row['mise']]
        yield Recipe(**row)

RECIPES = list(load())
