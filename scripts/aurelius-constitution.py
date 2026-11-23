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
import warnings
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/corpus.json'
TOPICS = ROOT / 'content/aurelius/topics.json'
AUTHORED = ROOT / 'content/aurelius/constitution.json'
OUT = ROOT / 'public/apps/stoic-constitution.json'          # the index: everything but full articles
CHAPTER_DIR = ROOT / 'public/apps/stoic-constitution'        # one file per chapter that has articles
SENECA = ROOT / '.aurelius/corpora/seneca-gummere-wikisource'
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

    def centre(members: list[dict]) -> np.ndarray:
        mean = vectors[[row[m['revision_id']] for m in members]].mean(axis=0)
        return mean / np.linalg.norm(mean)

    centres = {sid: centre(section['members']) for sid, (_, section) in sections.items()}

    # Added authors ("voices"). One so far: Seneca's letters, split at their section numbers and embedded with the same model.
    # To add another: give it a corpus under .aurelius/corpora/ with vectors.npz, an entry in `authors` in the authored record,
    # and load it here the same way; every article then carries its items under voices[<key>].
    assert [a['key'] for a in authored['authors']] == ['seneca'], 'only Seneca has a corpus so far'
    seneca_corpus = json.loads((SENECA / 'corpus.json').read_text())
    letters = {p['reference']: p for p in seneca_corpus['passages']}
    letter_titles = {l['letter']: l['title'].split('. ', 1)[-1].capitalize() for l in seneca_corpus['letters']}
    stored = np.load(SENECA / 'vectors.npz')
    assert list(stored['revision_ids']) == [p['revision_id'] for p in seneca_corpus['passages']], 'Seneca vectors do not match the corpus'
    letter_vectors = stored['vectors'].astype(np.float64)
    letter_vectors /= np.linalg.norm(letter_vectors, axis=1, keepdims=True)
    letter_row = {p['reference']: i for i, p in enumerate(seneca_corpus['passages'])}
    section_ids = list(centres)
    letter_home = (letter_vectors @ np.stack([centres[sid] for sid in section_ids]).T).argmax(axis=1)
    # Two authors, two translators: similarity across them runs lower than within Marcus by about this much.
    author_gap = float(np.median(vectors @ vectors.T) - np.median(letter_vectors @ vectors.T))
    home = {m['revision_id']: sid for sid, (_, section) in sections.items() for m in section['members']}
    reference = {m['revision_id']: m['reference'] for _, section in sections.values() for m in section['members']}

    def section_card(sid: str) -> dict:
        chapter, section = sections[sid]
        names = authored['chapters'][chapter['id']]
        return {'id': sid, 'title': names['sections'][sid], 'chapter': names['title'], 'size': section['size'], 'provisional': names['read'] != 'full',
                'article': next((a['number'] for a in authored['articles'] if a['section'] == sid), None)}

    def surroundings(sid: str) -> dict:
        """What lies next to a section in the whole book: nearest sections, members on a border, and close passages left outside."""
        own = centres[sid]
        others = sorted(((float(own @ c), other) for other, c in centres.items() if other != sid), reverse=True)
        border = []
        for member in sections[sid][1]['members']:
            vector = vectors[row[member['revision_id']]]
            pull, other = max((float(vector @ c), other) for other, c in centres.items() if other != sid)
            if pull >= float(vector @ own) - 0.01:
                border.append({'ref': member['reference'], 'own': round(float(vector @ own), 3), 'other': round(pull, 3), 'section': section_card(other)['title']})
        to_centre = vectors @ own
        weakest = min(float(to_centre[row[m['revision_id']]]) for m in sections[sid][1]['members'])
        outside = sorted(((float(to_centre[i]), rev) for rev, i in row.items() if home[rev] != sid), reverse=True)
        return {'near': [{**section_card(other), 'similarity': round(value, 3)} for value, other in others[:4]],
                'lowest': round(others[-1][0], 3), 'highest': round(others[0][0], 3), 'farthest': section_card(others[-1][1])['title'],
                'border': border, 'weakest_member': round(weakest, 3),
                'outside': [{'ref': reference[rev], 'similarity': round(value, 3), 'section': section_card(home[rev])['title']} for value, rev in outside[:3]],
                'outside_closer': sum(1 for value, _ in outside if value > weakest)}

    def layout(revisions: list[str], extra: np.ndarray | None = None) -> dict:
        """Two-dimensional picture of a section: metric MDS on cosine distance, with the distortion it costs."""
        from sklearn.manifold import MDS
        unit = vectors[[row[r] for r in revisions]]
        sim = np.clip(unit @ unit.T, -1, 1)
        dist = 1 - sim
        np.fill_diagonal(dist, 0)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', FutureWarning)
            flat = MDS(n_components=2, dissimilarity='precomputed', random_state=0, n_init=16, max_iter=600).fit_transform(dist)
        flat -= flat.mean(axis=0)
        _, _, axes = np.linalg.svd(flat, full_matrices=False)      # widest spread along x
        flat = flat @ axes.T
        for axis in (0, 1):                                        # fixed orientation, so a rebuild does not mirror the picture
            if flat[np.argmax(np.abs(flat[:, axis])), axis] < 0:
                flat[:, axis] *= -1
        upper = np.triu_indices(len(revisions), 1)
        drawn = np.linalg.norm(flat[:, None] - flat[None], axis=2)
        stress = float(np.sqrt(((dist[upper] - drawn[upper]) ** 2).sum() / (dist[upper] ** 2).sum()))
        added = []
        if extra is not None and len(extra):
            # Place each added passage where its distances to the fixed points fit best; the first picture does not move.
            from scipy.optimize import minimize
            for vector in extra:
                want = 1 - np.clip(unit @ vector + author_gap, -1, 1)     # lift by the average gap between the authors, or he lands in a ring outside
                cost = lambda at: float(((np.linalg.norm(flat - at, axis=1) - want) ** 2).sum())
                best = min((minimize(cost, start, method='L-BFGS-B') for start in list(flat) + [flat.mean(axis=0)]), key=lambda result: result.fun)
                added.append(best.x)
        size = max(np.abs(flat).max(), max((np.abs(point).max() for point in added), default=0))
        flat /= size
        if added:
            return {'points': [[round(float(x), 4), round(float(y), 4)] for x, y in flat], 'stress': round(stress, 3),
                    'sim': [[round(float(v), 3) for v in line] for line in sim],
                    'lowest': round(float(sim[upper].min()), 3), 'highest': round(float(sim[upper].max()), 3),
                    'added': [[round(float(x / size), 4), round(float(y / size), 4)] for x, y in added]}
        return {'points': [[round(float(x), 4), round(float(y), 4)] for x, y in flat], 'stress': round(stress, 3),
                'sim': [[round(float(v), 3) for v in line] for line in sim],
                'lowest': round(float(sim[upper].min()), 3), 'highest': round(float(sim[upper].max()), 3)}

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
        # One colour slot per passage, fixed for the article. Passages that meet in a claim or in a part of the
        # statement never share a slot; passages that never meet may. Five slots are all the palette can keep apart.
        meets = {ref: set() for ref in used}
        for group in [c['passages'] for c in claims] + [part['refs'] for part in statement['parts']]:
            for ref in group:
                meets[ref] |= set(group) - {ref}
        colors = {}
        for ref in sorted(used, key=lambda r: (-len(meets[r]), used.index(r))):
            colors[ref] = next(slot for slot in range(1, 99) if slot not in {colors.get(other) for other in meets[ref]})
        assert max(colors.values()) <= 5, f'{where}: needs {max(colors.values())} passage colours; the palette has five'
        second = None
        extra = None
        assert set(article.get('voices', {})) <= {'seneca'}, f'{where}: unknown voice'
        if 'seneca' in article.get('voices', {}):
            voice = article['voices']['seneca']
            added = {}
            claim_text = {c['id']: c['t'] for c in claims}

            def letter_piece(item: dict, context: str, text: str | None) -> dict:
                number = re.fullmatch(r'S(\d+)\.(\d+)[a-z]', item['id'])
                assert number and item['id'] not in added, f"{where}: Seneca piece {item['id']}"
                ref = f'Ep. {number[1]}.{number[2]}'
                start, end = span(letters[ref]['text'], item['quote'], f"{where} {item['id']}")
                for words_ in item.get('gives', []):
                    assert text and words_.lower() in text.lower(), f"{where} {item['id']}: “{words_}” is not in the sentence it backs"
                added[item['id']] = {'id': item['id'], 'ref': ref, 'author': 'seneca', 'quote': letters[ref]['text'][start:end], 'at': start, 'in': context,
                                     'follows': item['follows'], **({'gives': item['gives']} if 'gives' in item else {})}
                return added[item['id']]

            items = []
            for item in voice['items']:
                if item['effect'] == 'stronger':
                    assert item['claim'] in claim_text and item.get('gives'), f"{where}: {item['id']}"
                    items.append({'effect': 'stronger', 'claim': item['claim'], 'piece': letter_piece(item, item['claim'], claim_text[item['claim']])})
                elif item['effect'] == 'wider':
                    assert item['label'] in keys and item['t'] and item['why'] and item['role'], f"{where}: {item['key']}"
                    items.append({'effect': 'wider', 'key': item['key'], 'label': item['label'], 'role': item['role'], 't': item['t'], 'why': item['why'],
                                  'support': [letter_piece(piece_, 'w:' + item['key'], item['t']) for piece_ in item['support']]})
                else:
                    assert item['effect'] == 'qualified' and item['claim'] in claim_text and item['t'], f"{where}: {item.get('key')}"
                    items.append({'effect': 'qualified', 'key': item['key'], 'claim': item['claim'], 't': item['t'],
                                  'support': [letter_piece(piece_, 'q:' + item['key'], None) for piece_ in item['support']]})
            # Clauses the added author contributes to the article's own sentences. Marcus's words are never altered:
            # a clause is appended to the statement or to a claim, and stays marked as the other author's.
            amend = []
            for clause in voice.get('amend', []):
                assert clause['target'] == 'statement' or clause['target'] in claim_text, f"{where}: amend target {clause['target']}"
                assert clause['kind'] in {'adds', 'changes', 'challenges'} and clause['t'].strip() and clause['ids'], f"{where}: amend {clause}"
                assert clause['t'][0] in ' ,;' and not clause['t'].rstrip().endswith('.'), f"{where}: an added clause continues the sentence and carries no full stop"
                assert all(piece_id in added for piece_id in clause['ids']), f"{where}: amend ids {clause['ids']} are not among this author's pieces"
                amend.append(clause)
            cited = list(dict.fromkeys(piece_['ref'] for piece_ in added.values()))
            extra = letter_vectors[[letter_row[ref] for ref in cited]]
            own = centres[article['section']]
            to_centre = letter_vectors @ own
            member_unit = vectors[[row[m['revision']] for m in members]]
            passages_out = []
            for index, ref in enumerate(cited):
                near = extra[index] @ member_unit.T
                used_rows = [i for i, m in enumerate(members) if m['used']]
                closest = max(used_rows, key=lambda i: near[i])
                passages_out.append({'ref': ref, 'title': letter_titles[letters[ref]['letter']], 'text': letters[ref]['text'], 'words': letters[ref]['words'],
                                     'revision': letters[ref]['revision_id'], 'to_centre': round(float(to_centre[letter_row[ref]]), 3),
                                     'rank': int((to_centre > to_centre[letter_row[ref]]).sum()) + 1,
                                     'nearest': {'ref': members[closest]['ref'], 'similarity': round(float(near[closest]), 3)},
                                     'sims': {**{m['ref']: round(float(near[i]), 3) for i, m in enumerate(members)},
                                              **{other: round(float(extra[index] @ extra[j]), 3) for j, other in enumerate(cited) if j != index}}})
            second = {'becomes': voice['becomes'], 'statement': voice['statement'], 'items': items, 'amend': amend, 'passages': passages_out,
                      'counts': {effect: sum(1 for item in items if item['effect'] == effect) for effect in ('stronger', 'wider', 'qualified')},
                      'nearest_here': int((letter_home == section_ids.index(article['section'])).sum()), 'total': len(letter_row)}
        picture = layout([m['revision'] for m in members], extra)
        if second:
            for passage_, at in zip(second['passages'], picture.pop('added')):
                passage_['at'] = at
        picture['refs'] = [m['ref'] for m in members]
        picture['around'] = surroundings(article['section'])
        articles.append({'number': article['number'], 'section': article['section'], 'title': article['title'], 'statement': statement, 'groups': groups, 'colors': colors, 'map': picture, 'voices': {'seneca': second} if second else {},
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
        'effects': authored['effects'],
        'authors': [{**authored['authors'][0], 'passages': len(letter_row), 'units': len(seneca_corpus['letters']),
                          'median_similarity': {'marcus_to_marcus': round(float(np.median(vectors @ vectors.T)), 3),
                                                'seneca_to_seneca': round(float(np.median(letter_vectors @ letter_vectors.T)), 3),
                                                'across': round(float(np.median(letter_vectors @ vectors.T)), 3)},
                          'author_gap': round(author_gap, 3)}],
        'chapters': chapters,
    }
    # The page loads the index first and a chapter's articles only when that chapter is opened.
    chapter_of = {s['id']: c['id'] for c in topics['chapters'] for s in c['sections']}
    record['articles'] = [{
        'number': a['number'], 'section': a['section'], 'chapter': chapter_of[a['section']], 'title': a['title'],
        'statement': {'t': a['statement']['t']},
        'counts': {'claims': len(a['claims']), 'single': len(a['single']), 'sources': len(a['sources']), 'section_size': a['section_size']},
        'voices': {key: {'becomes': voice['becomes'], 'counts': voice['counts']} for key, voice in a['voices'].items()},
    } for a in articles]
    OUT.write_text(json.dumps(record, ensure_ascii=False, indent=1) + '\n')
    print('wrote', OUT.relative_to(ROOT), f'{OUT.stat().st_size // 1024} KB')
    CHAPTER_DIR.mkdir(exist_ok=True)
    written = set()
    for chapter_id in dict.fromkeys(chapter_of[a['section']] for a in articles):
        path = CHAPTER_DIR / f'{chapter_id}.json'
        path.write_text(json.dumps({'chapter': chapter_id, 'articles': [a for a in articles if chapter_of[a['section']] == chapter_id]},
                                   ensure_ascii=False, indent=1) + '\n')
        written.add(path.name)
        print('wrote', path.relative_to(ROOT), f'{path.stat().st_size // 1024} KB')
    for stale in CHAPTER_DIR.glob('*.json'):
        if stale.name not in written:
            stale.unlink()
            print('removed', stale.relative_to(ROOT), '(chapter has no articles)')
    for a in articles:
        print(f"  Article {a['number']} {a['title']!r}: {len(a['sources'])} of {a['section_size']} passages, "
              + ', '.join(f"claim {c['number']} from {len(c['passages'])} ({c['closeness']})" for c in a['claims'])
              + f", {len(a['single'])} said once; section closeness {a['section_closeness']}")

if __name__ == '__main__':
    main()
