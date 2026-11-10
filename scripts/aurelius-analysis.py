#!/usr/bin/env python3
"""Only original synthetic source is eligible for the checked-in demonstration artifact."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/aurelius'))
from aurelius.analysis import write_fixture_analysis
w = json.loads((ROOT / 'content/aurelius/fixture.json').read_text())
r = write_fixture_analysis(w, ROOT / 'content/aurelius/analysis.json', ROOT / 'art/aurelius/fixture-analysis.npz')
print(f"Actual PCA and full-space cosine clustering: {r['chunk_count']}/{len(w['passages'])} synthetic chunks; no sampling; no external calls.")
