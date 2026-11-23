#!/usr/bin/env python3
"""Check the project's own translation of the Meditations and publish it for the page.

Run: apps/aurelius/.venv/bin/python scripts/aurelius-translation.py [--stored FILE] [--out FILE]

The stored record (content/aurelius/translation/project-v1.json) holds, per passage: the reference in the 1634
translation the articles were built on (Casaubon) and that passage's revision id; the standard reference of modern
editions; the Greek of the recorded edition; the project's English; the translator's notes on what the Greek leaves
open; and what the second, independent reader questioned and how each point was settled.

Rules checked here:
- A revision never changes. Each passage's `revision` is a hash of the edition, the reference, the Greek and the
  English; editing any of them without making a new revision fails the build. A correction keeps the old revision
  in `superseded`.
- Every passage names an existing passage of the 1634 corpus, and each such passage is translated at most once.
- Notes quote the Greek exactly: the words of a note must stand in the passage's Greek.
- The English is today's: none of the old forms the 1634 text is full of.

Writes public/apps/stoic-translation.json: the stored record plus the 1634 text of each passage, for reading side by side.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/corpus.json'
STORED = ROOT / 'content/aurelius/translation/project-v1.json'
OUT = ROOT / 'public/apps/stoic-translation.json'
OLD_FORMS = re.compile(r"\b(thee|thou|thy|thine|doth|hath|saith|unto|whatsoever|shalt)\b", re.I)


def revision_of(record_id: str, edition_id: str, passage: dict) -> str:
    """The id of one translated passage: a new id whenever the Greek or the English changes."""
    body = '\n'.join([edition_id, passage['standard_ref'], passage['greek'], passage['english']])
    return f"{record_id}:{passage['standard_ref']}:{hashlib.sha256(body.encode('utf-8')).hexdigest()[:16]}"


def check(stored: dict, corpus: dict) -> list[dict]:
    """Validate the stored record against the 1634 corpus; return its passages with the 1634 text added."""
    edition = stored['edition']
    for key in ('id', 'short', 'citation', 'editor', 'editor_died', 'year', 'source', 'file_sha256', 'retrieved', 'licence', 'rights'):
        assert edition.get(key), f'edition.{key} is missing'
    assert stored['made'] and stored['method'] and stored['limits'] and stored['status'], 'made, method, limits and status are required'
    by_revision = {p['revision_id']: p for p in corpus['passages']}
    out, seen_old, seen_new = [], set(), set()
    for passage in stored['passages']:
        where = f"Meditations {passage.get('standard_ref')}"
        for key in ('casaubon_ref', 'casaubon_revision', 'standard_ref', 'greek', 'english', 'revision'):
            assert passage.get(key), f'{where}: {key} is missing'
        old = by_revision.get(passage['casaubon_revision'])
        assert old, f"{where}: no passage {passage['casaubon_revision']} in the 1634 corpus"
        assert passage['casaubon_revision'] not in seen_old and passage['standard_ref'] not in seen_new, f'{where}: translated twice'
        seen_old.add(passage['casaubon_revision'])
        seen_new.add(passage['standard_ref'])
        assert re.fullmatch(r'\d{1,2}\.\d{1,2}', passage['standard_ref']) and re.fullmatch(r'\d{1,2}\.\d{1,2}', passage['casaubon_ref']), f'{where}: references are book.chapter'
        expected = revision_of(stored['id'], edition['id'], passage)
        assert passage['revision'] == expected, (f"{where}: the Greek or the English changed but the revision did not. A revision never changes: "
                                                 f"move {passage['revision']} to `superseded` and record {expected}")
        assert passage['revision'] not in passage.get('superseded', []), f'{where}: the current revision is also listed as superseded'
        assert re.search(r'[Ͱ-Ͽἀ-῿]', passage['greek']) and not re.search(r'[A-Za-z]{4,}', passage['greek']), f'{where}: the Greek field must hold Greek'
        found = OLD_FORMS.search(passage['english'])
        assert not found, f"{where}: “{found.group(0)}” is not today's English"
        assert 0.4 <= len(passage['english'].split()) / max(1, len(passage['greek'].split())) <= 2.6, f'{where}: the English is far longer or shorter than the Greek'
        for note in passage.get('notes', []):
            assert note.get('greek') and note.get('note'), f'{where}: a note needs the Greek words and what is open'
            assert note['greek'] in passage['greek'], f"{where}: the note quotes “{note['greek']}”, which is not in the Greek of this passage"
        for point in passage.get('check', []):
            assert point.get('greek') and point.get('note') and point.get('decided'), f'{where}: each point of the second reading needs the Greek, the objection and what was decided'
            assert point['greek'] in passage['greek'], f"{where}: the second reading quotes “{point['greek']}”, which is not in the Greek of this passage"
        out.append({**passage, 'notes': passage.get('notes', []), 'check': passage.get('check', []), 'casaubon': re.sub(r'\s+', ' ', old['text']).strip()})
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stored', type=Path, default=STORED)
    parser.add_argument('--out', type=Path, default=OUT)
    args = parser.parse_args()
    stored = json.loads(args.stored.read_text())
    corpus = json.loads(CORPUS.read_text())
    passages = check(stored, corpus)
    record = {key: stored[key] for key in ('id', 'made', 'status', 'scope', 'edition', 'method', 'limits', 'footer')}
    record['passages'] = passages
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(record, ensure_ascii=False, indent=1) + '\n')
    print('wrote', args.out, f'{args.out.stat().st_size // 1024} KB;', len(passages), 'passages,',
          sum(len(p['notes']) for p in passages), 'notes,', sum(len(p['check']) for p in passages), 'points settled from the second reading')


if __name__ == '__main__':
    main()
