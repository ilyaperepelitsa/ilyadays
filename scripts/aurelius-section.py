#!/usr/bin/env python3
"""Print one topic section for article writing: every passage in full, with its reference, rank and closeness.

Usage: apps/aurelius/.venv/bin/python scripts/aurelius-section.py c3.s1 [--seneca]

Reads the private corpus under .aurelius/. Prints to the terminal only; writes nothing.
Quotes for an article are copied from this output, never recalled.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/corpus.json'
CANDIDATES = ROOT / '.aurelius/corpora/seneca-gummere-wikisource/candidates.json'


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1].startswith('-'):
        sys.exit(__doc__)
    topics = json.loads((ROOT / 'content/aurelius/topics.json').read_text())
    authored = json.loads((ROOT / 'content/aurelius/constitution.json').read_text())
    sid = sys.argv[1]
    found = next(((c, s) for c in topics['chapters'] for s in c['sections'] if s['id'] == sid), None)
    if not found:
        sys.exit(f'No section {sid!r}. Section ids look like c6.s1.')
    chapter, section = found
    names = authored['chapters'][chapter['id']]
    text = {p['revision_id']: p['text'] for p in json.loads(CORPUS.read_text())['passages']}
    print(f"SECTION {sid} · {names['sections'][sid]} · chapter “{names['title']}” · {section['size']} passages · cohesion {section['cohesion']}\n")
    for rank, m in enumerate(section['members'], 1):
        print(f"[{m['reference']}] rank {rank} · closeness {m['similarity']} · {m['words']} words\n{text[m['revision_id']]}\n")
    if '--seneca' in sys.argv:
        if not CANDIDATES.exists():
            sys.exit('No candidates file yet: run scripts/aurelius-seneca.py attach (W4).')
        report = json.loads(CANDIDATES.read_text())
        numbers = {a['number'] for a in authored['articles'] if a['section'] == sid}
        article = next((a for a in report['articles'] if a['number'] in numbers), None)
        if not article:
            sys.exit('No candidates yet: write the article, embed its sentences, run attach (W4).')
        print(f"SENECA CANDIDATES for Article {article['number']} ({len(article['candidates'])}); nearest-section count {article['seneca_nearest_this_section_raw']}\n")
        for c in article['candidates']:
            print(f"[{c['ref']}] best for {c['best']} at {c['best_raw']} · found by {', '.join(c['for'])}\n{c['text']}\n")


if __name__ == '__main__':
    main()
