#!/usr/bin/env python3
"""Topic hierarchy for the constitution: Ward linkage over the cached Casaubon source vectors.

Reads the private corpus and its cached embeddings under .aurelius/ and writes
content/aurelius/topics.json. The artifact holds references, revision ids and numbers only,
so it can be published. No network access and no new embeddings.

The stored average and complete hierarchies in backup-map.json stay untouched. Average linkage
puts 400 of 418 passages in one group at twelve groups, and complete linkage 267 of 418 at eight,
so neither gives chapters of usable size. Ward on unit vectors gives balanced groups. All three
have a cosine silhouette near zero: a group is a neighbourhood for finding passages, not a
proven theme.

Run: apps/aurelius/.venv/bin/python scripts/aurelius-topics.py
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage
from sklearn.metrics import silhouette_score

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5'
MAP = ROOT / 'content/aurelius/backup-map.json'
OUT = ROOT / 'content/aurelius/topics.json'
CHAPTERS = 7            # top cut: the largest count before a group of fewer than 20 passages appears
SECTION_TARGET = 11     # sections per chapter = max(2, round(size / SECTION_TARGET))


def unit(rows: np.ndarray) -> np.ndarray:
    return rows / np.linalg.norm(rows, axis=1, keepdims=True)


def describe(vectors: np.ndarray, members: np.ndarray) -> tuple[list[dict], float]:
    """Members ordered by cosine similarity to the group centroid, and the mean of those similarities."""
    centroid = vectors[members].mean(axis=0)
    centroid /= np.linalg.norm(centroid)
    similarity = vectors[members] @ centroid
    order = np.argsort(-similarity, kind='stable')
    return [{'index': int(members[i]), 'similarity': round(float(similarity[i]), 4)} for i in order], round(float(similarity.mean()), 4)


def main() -> None:
    passages = json.loads((CORPUS / 'corpus.json').read_text())['passages']
    published = json.loads(MAP.read_text())
    assert [p['revision_id'] for p in passages] == [p['revision_id'] for p in published['points']], 'corpus and published map differ'
    raw = np.load(CORPUS / 'projection-arrays.npz')['vectors']
    vector_hash = hashlib.sha256(np.ascontiguousarray(raw.astype('<f4')).tobytes()).hexdigest()
    vectors = unit(raw.astype(np.float64))

    tree = linkage(vectors, method='ward')
    top = fcluster(tree, CHAPTERS, criterion='maxclust')
    reference = lambda i: f"{passages[i]['book']}.{passages[i]['section']}"

    chapters = []
    for label in range(1, CHAPTERS + 1):
        members = np.where(top == label)[0]
        count = max(2, round(len(members) / SECTION_TARGET))
        inner = fcluster(linkage(vectors[members], method='ward'), count, criterion='maxclust')
        sections = []
        for part in range(1, count + 1):
            ranked, cohesion = describe(vectors, members[inner == part])
            sections.append({'id': f'c{label}.s{part}', 'size': len(ranked), 'cohesion': cohesion, 'members': [
                {'reference': reference(m['index']), 'revision_id': passages[m['index']]['revision_id'],
                 'similarity': m['similarity'], 'words': len(passages[m['index']]['text'].split())} for m in ranked]})
        ranked, cohesion = describe(vectors, members)
        chapters.append({'id': f'c{label}', 'size': len(members), 'cohesion': cohesion,
                         'central': [reference(m['index']) for m in ranked[:5]], 'sections': sections})

    comparison = {}
    for name, labels in (('ward', top),
                         ('complete', np.array(published['hierarchy']['methods']['complete']['labels_by_k'][str(CHAPTERS)])),
                         ('average', np.array(published['hierarchy']['methods']['average']['labels_by_k'][str(CHAPTERS)]))):
        sizes = sorted(np.bincount(labels)[np.bincount(labels) > 0].tolist(), reverse=True)
        comparison[name] = {'sizes': sizes, 'largest_fraction': round(sizes[0] / len(passages), 3),
                            'cosine_silhouette': round(float(silhouette_score(vectors, labels, metric='cosine')), 3)}

    artifact = {
        'schema_version': 1,
        'pipeline_version': 'aurelius-topic-hierarchy-v1',
        'edition_id': published['edition']['id'],
        'corpus_hash': published['corpus_hash'],
        'source_vector_hash': published['vector_hash'],
        'local_vector_file_hash': vector_hash,
        'vector_description': published['vector_description'],
        'method': {'linkage': 'ward', 'input': 'unit-normalised full 3072-dimensional vectors', 'distance': 'euclidean on unit vectors',
                   'chapters': CHAPTERS, 'sections_rule': f'max(2, round(size / {SECTION_TARGET})) by Ward linkage inside each chapter',
                   'order': 'dendrogram order; members by cosine similarity to the group centroid',
                   'software': {'numpy': np.__version__, 'scipy': __import__('scipy').__version__, 'scikit_learn': __import__('sklearn').__version__}},
        'passage_count': len(passages),
        'comparison_at_chapter_cut': comparison,
        'share_mode': 'references_and_numbers_only',
        'chapters': chapters,
    }
    OUT.write_text(json.dumps(artifact, indent=1) + '\n')
    print('wrote', OUT.relative_to(ROOT), {c['id']: [s['size'] for s in c['sections']] for c in chapters})
    print(comparison)


if __name__ == '__main__':
    main()
