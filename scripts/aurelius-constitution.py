#!/usr/bin/env python3
"""Build the published record for the first constitution articles.

Joins the topic hierarchy (content/aurelius/topics.json), the authored fusions
(content/aurelius/constitution.json) and the Casaubon text of the sections that have an article
(private corpus under .aurelius/, public-domain Project Gutenberg 2680). An article is a thought
induced from fused claims; a fused claim rests on exact quotes from at least two passages. Every
quote must resolve to exactly one span of its immutable passage. Writes public/apps/stoic-constitution.json.

Run: apps/aurelius/.venv/bin/python scripts/aurelius-constitution.py
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/corpus.json'
TOPICS = ROOT / 'content/aurelius/topics.json'
AUTHORED = ROOT / 'content/aurelius/constitution.json'
OUT = ROOT / 'public/apps/stoic-constitution.json'
RELATIONS = {'supports', 'qualifies', 'challenges', 'illustrates', 'depends_on', 'paraphrases', 'answers'}


def words(text: str) -> int:
    return sum(1 for word in text.split() if re.search(r'\w', word))


def span(text: str, quote: str, where: str) -> tuple[int, int]:
    pattern = r'\s+'.join(re.escape(word) for word in quote.split())
    found = list(re.finditer(pattern, text))
    if len(found) != 1:
        raise SystemExit(f'{where}: quote matches {len(found)} times: {quote[:60]!r}')
    return found[0].start(), found[0].end()


def scalar(text: str, index: int) -> int:
    return len(text[:index].encode('utf-32-le')) // 4


def main() -> None:
    topics = json.loads(TOPICS.read_text())
    authored = json.loads(AUTHORED.read_text())
    passages = {p['revision_id']: p for p in json.loads(CORPUS.read_text())['passages']}
    for passage in passages.values():
        assert hashlib.sha256(passage['text'].encode()).hexdigest() == passage['text_hash'], passage['id']
    sections = {s['id']: (c, s) for c in topics['chapters'] for s in c['sections']}

    chapters = []
    for chapter in topics['chapters']:
        names = authored['chapters'][chapter['id']]
        assert set(names['sections']) == {s['id'] for s in chapter['sections']}, f"section names for {chapter['id']}"
        chapters.append({'id': chapter['id'], 'order': names['order'], 'title': names['title'], 'summary': names['summary'],
                         'read': names['read'], 'size': chapter['size'], 'cohesion': chapter['cohesion'],
                         'sections': [{'id': s['id'], 'title': names['sections'][s['id']], 'size': s['size'], 'cohesion': s['cohesion'],
                                       'central': [m['reference'] for m in s['members'][:3]],
                                       'article': next((a['number'] for a in authored['articles'] if a['section'] == s['id']), None)}
                                      for s in chapter['sections']]})
    chapters.sort(key=lambda c: c['order'])
    assert sum(c['size'] for c in chapters) == topics['passage_count']

    vectors = np.load(CORPUS.parent / 'projection-arrays.npz')['vectors'].astype(np.float64)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    row = {p['revision_id']: i for i, p in enumerate(json.loads(CORPUS.read_text())['passages'])}

    def closeness(revisions: list[str]) -> float | None:
        """Mean cosine similarity between distinct passages, as wholes."""
        rows = [row[r] for r in dict.fromkeys(revisions)]
        if len(rows) < 2:
            return None
        sims = vectors[rows] @ vectors[rows].T
        return round(float(sims[np.triu_indices(len(rows), 1)].mean()), 3)

    articles = []
    for article in authored['articles']:
        chapter, section = sections[article['section']]
        where = f"article {article['number']}"
        by_ref = {m['reference']: m for m in section['members']}
        ids: dict[str, dict] = {}

        def piece(item: dict, context: str) -> dict:
            ref = item['id'].rstrip('abcdefghijklmnopqrstuvwxyz')
            assert ref in by_ref and item['id'] not in ids, f"{where}: piece {item['id']}"
            text = passages[by_ref[ref]['revision_id']]['text']
            start, end = span(text, item['quote'], f"{where} {item['id']}")
            ids[item['id']] = {'id': item['id'], 'ref': ref, 'quote': text[start:end], 'at': start,
                               'start': scalar(text, start), 'end': scalar(text, end), 'in': context}
            return ids[item['id']]

        claims = []
        for number, claim in enumerate(article['claims'], 1):
            support = []
            for item in claim['support']:
                record = {**piece(item, claim['id']), 'follows': item['follows'], **{k: item[k] for k in ('gives', 'note') if k in item}}
                for words in record.get('gives', []):
                    assert words.lower() in claim['t'].lower(), f"{where} {item['id']}: “{words}” is not in the fused claim"
                assert record.get('gives') or record.get('note'), f"{where} {item['id']}: says neither which words it backs nor why it is there"
                support.append(record)
            refs = list(dict.fromkeys(s['ref'] for s in support))
            assert len(refs) >= 2, f"{where} {claim['id']}: a fused claim needs at least two passages"
            claims.append({'id': claim['id'], 'number': number, 'role': claim['role'], 't': claim['t'], 'shared': claim['shared'],
                           **({'changed': claim['changed']} if 'changed' in claim else {}), 'passages': refs,
                           'closeness': closeness([by_ref[r]['revision_id'] for r in refs]), 'support': support})
        single = [{**piece(item, 'single'), 'label': item['label'], 't': item['t'], 'why': item['why'], 'follows': item['follows']} for item in article['single']]

        used = list(dict.fromkeys(p['ref'] for p in ids.values()))
        assert set(article['aside']) == set(by_ref) - set(used), f"{where}: every unused member needs a reason; mismatch {set(article['aside']) ^ (set(by_ref) - set(used))}"
        members = []
        for rank, member in enumerate(section['members'], 1):
            ref = member['reference']
            members.append({'ref': ref, 'revision': member['revision_id'], 'rank': rank, 'similarity': member['similarity'],
                            'words': member['words'], 'used': ref in used,
                            'feeds': sorted({p['in'] for p in ids.values() if p['ref'] == ref}),
                            'why': article['aside'].get(ref), 'text': passages[member['revision_id']]['text']})
        statement = article['statement']
        for part in statement['parts']:
            assert part['words'].lower() in statement['t'].lower() and set(part['ids']) <= set(ids), f"{where}: statement part {part['words']!r}"
            part['refs'] = list(dict.fromkeys(ids[i]['ref'] for i in part['ids']))
        keys = [label['key'] for label in authored['labels']]
        assert list(article['groups']) == keys, f'{where}: groups follow the fixed labels'
        placed = [item for key in keys for item in article['groups'][key]]
        expected = [c['id'] for c in claims] + [s['id'] for s in single]
        assert sorted(placed) == sorted(expected), f'{where}: every claim and single item sits under exactly one label; mismatch {set(placed) ^ set(expected)}'
        groups = []
        for label in authored['labels']:
            items = article['groups'][label['key']]
            group = {**label, 'items': items, 'claims': [i for i in items if i in {c['id'] for c in claims}], 'single': [i for i in items if i in {s['id'] for s in single}]}
            if not items:
                group['empty'] = article['empty'][label['key']]
            groups.append(group)
        # Claims are numbered in the order the reader meets them, label by label.
        shown = [i for group in groups for i in group['claims']]
        for claim in claims:
            claim['number'] = shown.index(claim['id']) + 1
        articles.append({'number': article['number'], 'section': article['section'], 'title': article['title'], 'statement': statement, 'groups': groups,
                         'section_size': section['size'], 'cohesion': section['cohesion'],
                         'section_closeness': closeness([m['revision_id'] for m in section['members']]),
                         'sources': [m['ref'] for m in members if m['used']], 'claims': claims, 'single': single, 'members': members,
                         'decisions': article['decisions'], 'limit': article['limit']})

    record = {
        'schema_version': 1,
        'format': 'stoic-constitution-articles-v3',
        'status': authored['status'],
        'edition': {'id': topics['edition_id'], 'translator': 'Meric Casaubon', 'source': 'Project Gutenberg 2680', 'offset_convention': 'unicode-scalar-half-open-v1'},
        'method': {**topics['method'], 'vectors': topics['vector_description'], 'source_vector_hash': topics['source_vector_hash'],
                   'passage_count': topics['passage_count'], 'comparison': topics['comparison_at_chapter_cut']},
        'chapter_order_note': authored['chapter_order_note'],
        'labels': authored['labels'],
        'chapters': chapters,
        'articles': articles,
    }
    OUT.write_text(json.dumps(record, ensure_ascii=False, indent=1) + '\n')
    print('wrote', OUT.relative_to(ROOT), f'{OUT.stat().st_size // 1024} KB')
    for a in articles:
        print(f"  Article {a['number']} {a['title']!r}: {len(a['sources'])} of {a['section_size']} passages, "
              + ', '.join(f"claim {c['number']} from {len(c['passages'])} ({c['closeness']})" for c in a['claims'])
              + f", {len(a['single'])} said once; section closeness {a['section_closeness']}")

if __name__ == '__main__':
    main()
