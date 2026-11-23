#!/usr/bin/env python3
"""Check the project's own translation of the Meditations and publish it for the page.

Run: apps/aurelius/.venv/bin/python scripts/aurelius-translation.py [--stored FILE] [--out FILE]
     apps/aurelius/.venv/bin/python scripts/aurelius-translation.py --embed --allow-openai --token-budget 2000 --cost-budget-usd 0.01

--embed sends the English of each translated passage to the same embedding model the Meditations and Seneca were
embedded with (through the shared cache, under explicit token and cost caps; the key is read from OPENAI_API_KEY),
and keeps the vectors in .aurelius/corpora/project-v1/vectors.npz. With those vectors present, publishing also
reports how each passage sits in the new English: how close its vector is to the vector of the same passage in the
1634 English, which section's centre it is nearest to, and how close the translated passages are to one another
compared with the same passages in 1634 English. The sections themselves were grouped on the 1634 English.

The stored record (content/aurelius/translation/project-v1.json) holds, per passage: the reference in the 1634
translation the articles were built on (Casaubon) and that passage's revision id; the standard reference of modern
editions; the Greek of the recorded edition; the project's English; the translator's notes on what the Greek leaves
open; and what the second, independent reader questioned and how each point was settled.

Rules checked here:
- A revision never changes. Each passage's `revision` is a hash of the edition, the reference, the Greek and the
  English; editing any of them without making a new revision fails the build. A correction keeps the old revision
  in `superseded`.
- Every passage names an existing passage of the 1634 corpus, and each such passage is translated at most once.
- Translation goes section by section: `sections` lists the sections done, and every passage of a listed section is
  translated, none from outside them.
- The 1634 translation sometimes cuts its sections inside a modern chapter. A passage that covers only part of a
  chapter carries a letter on its modern number (11.8a: the chapter's first part; 3.11b: its next part) and says in `part`
  which Greek words of the chapter it leaves out, and why.
- Notes quote the Greek exactly: the words of a note must stand in the passage's Greek.
- The English is today's: none of the old forms the 1634 text is full of.

Writes public/apps/stoic-translation.json: the stored record plus the 1634 text of each passage, for reading side by side.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/corpus.json'
STORED = ROOT / 'content/aurelius/translation/project-v1.json'
OUT = ROOT / 'public/apps/stoic-translation.json'
TOPICS = ROOT / 'content/aurelius/topics.json'
VECTORS = ROOT / '.aurelius/corpora/project-v1/vectors.npz'
STANDARD = r'\d{1,2}\.\d{1,2}[a-d]?(?:–\d{1,2}[a-d]?)?'   # 10.21 · 6.9–10 (two chapters) · 11.8a (first part of 11.8) · 3.11b (its next part) · 7.31b–34
OLD_FORMS = re.compile(r"\b(thee|thou|thy|thine|doth|hath|saith|unto|whatsoever|shalt)\b", re.I)


def revision_of(record_id: str, edition_id: str, passage: dict) -> str:
    """The id of one translated passage: a new id whenever the Greek or the English changes."""
    body = '\n'.join([edition_id, passage['standard_ref'], passage['greek'], passage['english']])
    return f"{record_id}:{passage['standard_ref']}:{hashlib.sha256(body.encode('utf-8')).hexdigest()[:16]}"


def section_of() -> dict:
    """The section each passage of the 1634 corpus was grouped into, by its revision id."""
    return {m['revision_id']: s['id'] for c in json.loads(TOPICS.read_text())['chapters'] for s in c['sections'] for m in s['members']}


def check(stored: dict, corpus: dict) -> list[dict]:
    """Validate the stored record against the 1634 corpus; return its passages with the 1634 text and section added."""
    edition = stored['edition']
    for key in ('id', 'short', 'citation', 'editor', 'editor_died', 'year', 'source', 'file_sha256', 'retrieved', 'licence', 'rights'):
        assert edition.get(key), f'edition.{key} is missing'
    assert stored['made'] and stored['method'] and stored['limits'] and stored['status'], 'made, method, limits and status are required'
    by_revision = {p['revision_id']: p for p in corpus['passages']}
    home = section_of()
    listed = stored.get('sections')
    assert listed and len(set(listed)) == len(listed), '`sections` lists the sections translated so far, each once'
    done = {p.get('casaubon_revision') for p in stored['passages']}
    for section in listed:
        members = [rev for rev, sid in home.items() if sid == section]
        assert members, f'{section} is not a section of the book'
        missing = [by_revision[rev]['book'] + '.' + by_revision[rev]['section'] for rev in members if rev not in done]
        assert not missing, f'{section} is listed as translated but lacks {missing} (1634 numbers)'
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
        assert re.fullmatch(STANDARD, passage['standard_ref']) and re.fullmatch(r'\d{1,2}\.\d{1,2}', passage['casaubon_ref']), f'{where}: references are book.chapter'
        assert home.get(passage['casaubon_revision']) in listed, f"{where}: its section {home.get(passage['casaubon_revision'])} is not among the sections listed as translated"
        part = passage.get('part')
        if re.search(r'[a-d]', passage['standard_ref']):
            assert part and part.get('left_out') and part.get('why'), f'{where}: a passage that is part of a chapter says which Greek it leaves out, and why'
            assert re.search(r'[Ͱ-Ͽἀ-῿]', part['left_out']) and part['left_out'] not in passage['greek'], f'{where}: `left_out` holds the Greek of the chapter that is not in this passage'
        else:
            assert not part, f'{where}: `part` is only for a passage that covers part of a chapter'
        expected = revision_of(stored['id'], edition['id'], passage)
        assert passage['revision'] == expected, (f"{where}: the Greek or the English changed but the revision did not. A revision never changes: "
                                                 f"move {passage['revision']} to `superseded` and record {expected}")
        assert passage['revision'] not in passage.get('superseded', []), f'{where}: the current revision is also listed as superseded'
        assert re.search(r'[Ͱ-Ͽἀ-῿]', passage['greek']) and not re.search(r'[A-Za-z]{4,}', passage['greek']), f'{where}: the Greek field must hold Greek'
        found = OLD_FORMS.search(passage['english'])
        assert not found, f"{where}: “{found.group(0)}” is not today's English"
        # A ratio means little on a short passage: ten Greek words that are each one verb (9.39b) take three or four English words apiece.
        if len(passage['greek'].split()) >= 20:
            assert 0.4 <= len(passage['english'].split()) / len(passage['greek'].split()) <= 2.6, f'{where}: the English is far longer or shorter than the Greek'
        for note in passage.get('notes', []):
            assert note.get('greek') and note.get('note'), f'{where}: a note needs the Greek words and what is open'
            assert note['greek'] in passage['greek'], f"{where}: the note quotes “{note['greek']}”, which is not in the Greek of this passage"
        for point in passage.get('check', []):
            assert point.get('greek') and point.get('note') and point.get('decided'), f'{where}: each point of the second reading needs the Greek, the objection and what was decided'
            assert point['greek'] in passage['greek'], f"{where}: the second reading quotes “{point['greek']}”, which is not in the Greek of this passage"
        out.append({**passage, 'notes': passage.get('notes', []), 'check': passage.get('check', []), 'casaubon': re.sub(r'\s+', ' ', old['text']).strip(),
                    'section': home[passage['casaubon_revision']]})
    return out


def items(stored: dict) -> list[dict]:
    """The translated passages in the shape the embedding cache takes: an immutable id, the text, and its hash."""
    return [{'revision_id': p['revision'], 'text': p['english'], 'text_hash': hashlib.sha256(p['english'].encode()).hexdigest()} for p in stored['passages']]


def cache():
    sys.path.insert(0, str(ROOT / 'apps/aurelius'))
    from aurelius.embeddings import CONFIG, EmbeddingCache
    return EmbeddingCache(ROOT / '.aurelius/vectors', CONFIG), CONFIG


def embed(stored: dict, args) -> None:
    import numpy as np
    store, _ = cache()
    plan = store.plan(items(stored))
    print(json.dumps({k: plan[k] for k in ('chunks', 'cached_chunks', 'uncached_unique_inputs', 'input_tokens', 'estimated_usd')}))
    if plan['uncached_unique_inputs']:
        if not args.allow_openai or not args.token_budget or not args.cost_budget_usd:
            raise SystemExit('Nothing was sent. Pass --allow-openai with --token-budget and --cost-budget-usd to embed.')
        key = os.environ.get('OPENAI_API_KEY')
        if not key:
            raise SystemExit('Set OPENAI_API_KEY in the environment; never paste it into chat or source code')
        from aurelius.analysis import corpus_identity
        from openai import OpenAI
        client = OpenAI(api_key=key, base_url='https://api.openai.com/v1', max_retries=0, timeout=60)
        approval = {'corpus_hash': corpus_identity(items(stored)), 'segmentation_reviewed': True, 'external_processing_approved': True,
                    'token_budget': args.token_budget, 'cost_budget_usd': args.cost_budget_usd, 'reviewer': 'explicit CLI operator approval',
                    'source': 'content/aurelius/translation/project-v1.json'}
        print('state:', store.embed(items(stored), client, approval)['state'])
    matrix = store.matrix(items(stored))
    VECTORS.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(VECTORS, vectors=matrix.astype(np.float32), revision_ids=np.array([p['revision'] for p in stored['passages']]))
    print('kept', list(matrix.shape), 'in', VECTORS.relative_to(ROOT))


def compare(stored: dict, corpus: dict) -> dict | None:
    """How the translated passages sit in the new English, against the 1634 English they replace. None without vectors."""
    if not VECTORS.exists():
        return None
    import numpy as np
    kept = np.load(VECTORS)
    assert list(kept['revision_ids']) == [p['revision'] for p in stored['passages']], 'the vectors are of other revisions: run --embed again'
    unit = lambda m: m / np.linalg.norm(m, axis=-1, keepdims=True)
    new = unit(kept['vectors'].astype(np.float64))
    old_all = unit(np.load(CORPUS.parent / 'projection-arrays.npz')['vectors'].astype(np.float64))
    row = {p['revision_id']: i for i, p in enumerate(corpus['passages'])}
    old = old_all[[row[p['casaubon_revision']] for p in stored['passages']]]
    topics = json.loads(TOPICS.read_text())
    index = ROOT / 'public/apps/stoic-constitution.json'   # section names live in the published index
    names = {s['id']: s.get('title') or s.get('name') for c in json.loads(index.read_text())['chapters'] for s in c['sections']} if index.exists() else {}
    sections = [(s['id'], names.get(s['id']) or s['id'], unit(old_all[[row[m['revision_id']] for m in s['members']]].mean(axis=0)))
                for c in topics['chapters'] for s in c['sections']]
    position = {sid: i for i, (sid, _, _) in enumerate(sections)}
    centres = np.stack([c for _, _, c in sections])
    home = section_of()
    per, rows = [], {}
    for i, p in enumerate(stored['passages']):
        own = position[home[p['casaubon_revision']]]
        rows.setdefault(own, []).append(i)
        to_new, to_old = centres @ new[i], centres @ old[i]
        order = list(np.argsort(-to_new))
        per.append({'revision': p['revision'], 'to_1634': round(float(new[i] @ old[i]), 3),
                    'home': round(float(to_new[own]), 3), 'home_1634': round(float(to_old[own]), 3), 'home_rank': order.index(own) + 1,
                    'nearest': {'section': sections[order[0]][0], 'title': sections[order[0]][1], 'similarity': round(float(to_new[order[0]]), 3)}})
    def closeness(matrix, members):
        pairs = np.triu_indices(len(members), 1)
        return round(float((matrix[members] @ matrix[members].T)[pairs].mean()), 3) if len(members) > 1 else None
    by_section = [{'section': sections[own][0], 'title': sections[own][1], 'passages': len(members),
                   'closeness': closeness(new, members), 'closeness_1634': closeness(old, members),
                   'stayed_home': sum(1 for i in members if per[i]['home_rank'] == 1)}
                  for own, members in sorted(rows.items(), key=lambda item: stored['sections'].index(sections[item[0]][0]))]
    _, config = cache()
    return {'model': config['model'], 'dimensions': config['dimensions'], 'sections': len(sections),
            'note': 'The sections were grouped on the 1634 English, and each centre is the mean of its own passages in that English, so a passage in 1634 English has a head start toward its own centre. Read the new numbers as: does the passage still belong here when said in today’s words?',
            'stayed_home': sum(1 for x in per if x['home_rank'] == 1), 'to_1634': round(float(np.mean([x['to_1634'] for x in per])), 3),
            'by_section': by_section, 'passages': per}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stored', type=Path, default=STORED)
    parser.add_argument('--out', type=Path, default=OUT)
    parser.add_argument('--embed', action='store_true', help='embed the English of each passage with the corpus model, then stop')
    parser.add_argument('--allow-openai', action='store_true')
    parser.add_argument('--token-budget', type=int, default=0)
    parser.add_argument('--cost-budget-usd', type=float, default=0.0)
    args = parser.parse_args()
    stored = json.loads(args.stored.read_text())
    corpus = json.loads(CORPUS.read_text())
    passages = check(stored, corpus)
    if args.embed:
        return embed(stored, args)
    record = {key: stored[key] for key in ('id', 'made', 'status', 'sections', 'owner', 'edition', 'method', 'limits', 'footer') if key in stored}
    index = ROOT / 'public/apps/stoic-constitution.json'
    known = {s['id']: s for c in json.loads(index.read_text())['chapters'] for s in c['sections']} if index.exists() else {}
    record['sections'] = [{'id': sid, 'title': known.get(sid, {}).get('title') or sid, 'article': known.get(sid, {}).get('article'),
                           'passages': sum(1 for p in passages if p['section'] == sid)} for sid in stored['sections']]
    passages.sort(key=lambda p: stored['sections'].index(p['section']))   # the page reads section by section; the stored order is kept within each
    vectors = compare(stored, corpus) if args.stored == STORED else None
    if vectors:
        by = {x['revision']: x for x in vectors.pop('passages')}
        passages = [{**p, 'vector': {k: v for k, v in by[p['revision']].items() if k != 'revision'}} for p in passages]
        record['vectors'] = vectors
    record['passages'] = passages
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(record, ensure_ascii=False, indent=1) + '\n')
    print('wrote', args.out, f'{args.out.stat().st_size // 1024} KB;', len(passages), 'passages,',
          sum(len(p['notes']) for p in passages), 'notes,', sum(len(p['check']) for p in passages), 'points settled from the second reading')


if __name__ == '__main__':
    main()
