#!/usr/bin/env python3
"""Numbers behind two diagrams of the method page: the map of all passages and the Ward tree.

Reads the private 1634-English vectors under .aurelius/ (the same file scripts/aurelius-topics.py clusters) and writes
public/apps/stoic-method/diagram-data.json, which holds passage references and numbers only: no text and no vector.

  projection  every passage as one point of a two-dimensional t-SNE of its unit vector (cosine, perplexity 50, seed 0),
              scaled into [-1, 1], with the section it belongs to; and how faithful the flat picture is
              (trustworthiness over the 10 nearest neighbours: 1 would keep every neighbourhood).
  gates       the acceptance gates' findings over all articles (scripts/aurelius-qa.py --json articles): blocking,
              warnings, and warnings by rule.
  tree        the Ward tree as the method page draws it: the six top merges of the whole-book tree that join the seven
              chapters, and each chapter's own Ward tree (the one its sections were cut from), in SciPy's linkage form
              over the chapter's references, with the leaf order of its dendrogram.
  validation  what a referee asked to see, recomputed here (seed 0; numbers only):
              chapter_cut  for k = 2..15 the smallest and largest group and the cosine silhouette, and which k the rule
                           "the largest k before a group of fewer than t passages appears" gives for every threshold t
                           (none gives 7: the seven chapters are a fixed choice, CHAPTERS in scripts/aurelius-topics.py);
              silhouette   chapters and sections, on the 1634 English and the new English, against the same group sizes
                           shuffled over the passages 200 times (mean, spread, maximum);
              stay         passages nearest their own section centre, five ways (the published mixed count, and same-text
                           counts with and without the passage in its own centre, on each English);
              similarity   median pairwise similarity of each whole text and each section's closeness on both, with how
                           many sections are tighter on the new English relative to its own median;
              stability    adjusted Rand index of Ward on the new English cut at 7 and 38 against the published chapters and
                           sections (and of a flat 38-cut of the 1634 tree, for scale; and of shuffled labels);
              length       correlation of passage length with similarity to its own section centre.
  software    the library versions used.

The script stops if the tree it rebuilds does not give exactly the chapters and sections of content/aurelius/topics.json.
Run: apps/aurelius/.venv/bin/python scripts/stoic-method-diagram-data.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import scipy
import sklearn
from scipy.cluster.hierarchy import dendrogram, fcluster, linkage
from scipy.stats import pearsonr, spearmanr
from sklearn.manifold import TSNE, trustworthiness
from sklearn.metrics import adjusted_rand_score, silhouette_score

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5'
NEW_VECTORS = ROOT / '.aurelius/corpora/project-v1/vectors.npz'   # the same model on the project's new English
TRANSLATION = ROOT / 'content/aurelius/translation/project-v1.json'
TOPICS = ROOT / 'content/aurelius/topics.json'
OUT = ROOT / 'public/apps/stoic-method/diagram-data.json'
PERPLEXITY, SEED, NEIGHBOURS = 50, 0, 10
SHUFFLES, K_RANGE = 200, range(2, 16)


def r(x: float, n: int = 4) -> float:
    return round(float(x), n)


def stay(vectors: np.ndarray, sections: list[str], centres_from: np.ndarray | None = None, leave_one_out: bool = False) -> int:
    """How many passages are nearest (cosine) to the centre of their own section among all section centres.

    centres_from: the vectors the centres are built from (default: `vectors`). leave_one_out: a passage's own section centre
    is built without it (only when the centres come from the same vectors)."""
    base = vectors if centres_from is None else centres_from
    ids = sorted(set(sections))
    lab = np.array([ids.index(s) for s in sections])
    sums = np.stack([base[lab == k].sum(axis=0) for k in range(len(ids))])
    counts = np.bincount(lab)
    kept = 0
    for i, v in enumerate(vectors):
        c = sums.copy()
        if leave_one_out:
            c[lab[i]] -= base[i]
        c /= np.linalg.norm(c, axis=1, keepdims=True)
        if counts[lab[i]] == 1 and leave_one_out:
            continue
        kept += int(np.argmax(c @ v) == lab[i])
    return kept


def null(vectors: np.ndarray, labels: np.ndarray, rng: np.random.Generator) -> dict:
    """Cosine silhouette of the labels, and of the same group sizes shuffled over the passages (SHUFFLES times)."""
    real = silhouette_score(vectors, labels, metric='cosine')
    shuffled = np.array([silhouette_score(vectors, rng.permutation(labels), metric='cosine') for _ in range(SHUFFLES)])
    return {'silhouette': r(real), 'shuffled_mean': r(shuffled.mean()), 'shuffled_sd': r(shuffled.std(ddof=1)),
            'shuffled_max': r(shuffled.max()), 'shuffles_at_or_above': int((shuffled >= real).sum()), 'shuffles': SHUFFLES}


def tightness(vectors: np.ndarray, sections: list[str]) -> dict[str, float]:
    """Mean cosine similarity between distinct passages of each section (the record's section_closeness)."""
    out = {}
    for sid in sorted(set(sections), key=lambda s: (int(s.split('.')[0][1:]), int(s.split('.s')[1]))):
        rows = vectors[[i for i, s in enumerate(sections) if s == sid]]
        sims = rows @ rows.T
        out[sid] = float(sims[np.triu_indices(len(rows), 1)].mean()) if len(rows) > 1 else float('nan')
    return out


def validation(vectors: np.ndarray, whole: np.ndarray, label: np.ndarray, sections: list[str], refs: list[str],
               passages: list[dict], words: np.ndarray) -> dict:
    """The checks a referee asked for, all from the cached vectors; numbers only."""
    rng = np.random.default_rng(SEED)
    chapters = np.array([int(s.split('.')[0][1:]) for s in sections])
    section_ids = sorted(set(sections))
    section_lab = np.array([section_ids.index(s) for s in sections])

    # 1. The chapter cut. For every k: the smallest group and the silhouette. Then the rule "the largest k before a group of
    #    fewer than t passages appears", for every threshold t, to show which k each threshold gives.
    by_k = []
    for k in K_RANGE:
        cut = fcluster(whole, k, criterion='maxclust')
        sizes = np.bincount(cut)[1:]
        by_k.append({'k': k, 'smallest': int(sizes.min()), 'largest': int(sizes.max()),
                     'silhouette': r(silhouette_score(vectors, cut, metric='cosine'))})
    rule = []
    for t in range(1, int(max(row['smallest'] for row in by_k)) + 2):
        k = K_RANGE.start - 1
        for row in by_k:
            if row['smallest'] < t:
                break
            k = row['k']
        if rule and rule[-1]['k'] == k:
            rule[-1]['threshold_to'] = t
        else:
            rule.append({'threshold_from': t, 'threshold_to': t, 'k': k})
    gives_seven = [x for x in rule if x['k'] == 7]
    record_stayed = sum(a['in_translation']['stayed'] for c in sorted(set(chapters))
                        for a in json.loads((ROOT / f'public/apps/stoic-constitution/c{c}.json').read_text())['articles'] if a.get('in_translation'))

    # 2. The new English: the same passages, the same model.
    translation = json.loads(TRANSLATION.read_text())
    kept = np.load(NEW_VECTORS)
    by_new = {p['revision']: p['casaubon_revision'] for p in translation['passages']}
    new_by_old = {by_new[str(rid)]: v for rid, v in zip(kept['revision_ids'], kept['vectors'].astype(np.float64)) if str(rid) in by_new}
    missing = [p['revision_id'] for p in passages if p['revision_id'] not in new_by_old]
    assert not missing, f'{len(missing)} passages have no new-English vector'
    new = np.stack([new_by_old[p['revision_id']] for p in passages])
    new /= np.linalg.norm(new, axis=1, keepdims=True)
    new_words = {p['casaubon_revision']: len(p['english'].split()) for p in translation['passages']}
    new_len = np.array([new_words[p['revision_id']] for p in passages])

    def median_pair(v: np.ndarray) -> float:
        sims = v @ v.T
        return float(np.median(sims[np.triu_indices(len(v), 1)]))

    med_old, med_new = median_pair(vectors), median_pair(new)
    t_old, t_new = tightness(vectors, sections), tightness(new, sections)
    lower_abs = sum(1 for s in t_old if t_new[s] < t_old[s])
    tighter_rel = sum(1 for s in t_old if t_new[s] - med_new > t_old[s] - med_old)

    # 3. Length against closeness to the passage's own section centre (centre includes the passage, as in topics.json).
    def to_centre(v: np.ndarray) -> np.ndarray:
        cents = np.stack([v[section_lab == k].mean(axis=0) for k in range(len(section_ids))])
        cents /= np.linalg.norm(cents, axis=1, keepdims=True)
        return np.einsum('ij,ij->i', v, cents[section_lab])

    def length_effect(v: np.ndarray, n_words: np.ndarray) -> dict:
        sim = to_centre(v)
        return {'pearson_log_words': r(pearsonr(np.log(n_words), sim)[0], 3), 'spearman_words': r(spearmanr(n_words, sim)[0], 3),
                'median_words': int(np.median(n_words)), 'shortest': int(n_words.min()), 'longest': int(n_words.max())}

    chapter_median_words = {f'c{c}': int(np.median(words[chapters == c])) for c in sorted(set(chapters))}

    # 4. Stability: Ward on the new English, cut at 7 and at 38, against the published chapters and sections.
    new_tree = linkage(new, method='ward')
    new7, new38 = fcluster(new_tree, 7, criterion='maxclust'), fcluster(new_tree, 38, criterion='maxclust')
    old38 = fcluster(whole, 38, criterion='maxclust')
    ari_null = np.array([adjusted_rand_score(chapters, rng.permutation(chapters)) for _ in range(SHUFFLES)])

    mixed = stay(new, sections, centres_from=vectors)
    assert mixed == record_stayed, f'the mixed stay count {mixed} is not the record\'s {record_stayed}'
    return {
        'about': 'Validation of the grouping, recomputed from the cached vectors by this script. Silhouettes are cosine; shuffles keep '
                 f'the group sizes and use seed {SEED}. Stay counts: passages nearest (cosine) to their own section centre among all '
                 f'{len(section_ids)} centres. Closeness of a section: mean cosine similarity between its distinct passages.',
        'chapter_cut': {
            'published_k': 7,
            'by_k': by_k,
            'rule': 'largest k before a group of fewer than t passages appears, for each threshold t',
            'rule_by_threshold': rule,
            'any_threshold_gives_7': bool(gives_seven),
            'twenty_gives': next(x['k'] for x in rule if x['threshold_from'] <= 20 <= x['threshold_to']),
        },
        'silhouette': {
            'chapters': null(vectors, chapters, rng),
            'sections': null(vectors, section_lab, rng),
            'chapters_new_english': null(new, chapters, rng),
            'sections_new_english': null(new, section_lab, rng),
        },
        'stay': {
            'of': len(refs), 'sections': len(section_ids),
            'published_mixed': mixed,
            'old_self_included': stay(vectors, sections),
            'old_leave_one_out': stay(vectors, sections, leave_one_out=True),
            'new_self_included': stay(new, sections),
            'new_leave_one_out': stay(new, sections, leave_one_out=True),
            'definitions': {
                'published_mixed': 'new-English vector against centres of the 1634-English vectors (the record\'s in_translation.stayed, summed)',
                'old_self_included': '1634-English vectors against their own section centres, the passage counted in its centre',
                'old_leave_one_out': '1634-English vectors, each passage left out of its own section centre',
                'new_self_included': 'new-English vectors against new-English section centres, the passage counted in its centre',
                'new_leave_one_out': 'new-English vectors, each passage left out of its own section centre'},
        },
        'similarity': {
            'median_pair_1634': r(med_old, 3), 'median_pair_new': r(med_new, 3),
            'sections_lower_on_new': lower_abs, 'sections_tighter_relative_to_median_on_new': tighter_rel,
            'sections': len(section_ids),
            'closeness_1634': {s: r(v, 3) for s, v in t_old.items()},
            'closeness_new': {s: r(v, 3) for s, v in t_new.items()},
        },
        'stability': {
            'ari_new_k7_vs_chapters': r(adjusted_rand_score(chapters, new7), 3),
            'ari_new_k38_vs_sections': r(adjusted_rand_score(section_lab, new38), 3),
            'ari_1634_k38_vs_sections': r(adjusted_rand_score(section_lab, old38), 3),
            'ari_shuffled_mean': r(ari_null.mean(), 3), 'ari_shuffled_sd': r(ari_null.std(ddof=1), 3),
            'note': 'the published sections are cut inside each chapter, not by a flat 38-cut of the whole tree; '
                    'ari_1634_k38_vs_sections shows how far that alone moves them',
        },
        'length': {
            '1634': length_effect(vectors, words),
            'new': length_effect(new, new_len),
            'chapter_median_words_1634': chapter_median_words,
            # Article 29's section ("Short sayings"): the words of each of its passages, in book order
            'c7.s3_words_1634': [int(words[i]) for i, sec in enumerate(sections) if sec == 'c7.s3'],
        },
    }


def main() -> None:
    passages = json.loads((CORPUS / 'corpus.json').read_text())['passages']
    refs = [f"{p['book']}.{p['section']}" for p in passages]
    vectors = np.load(CORPUS / 'projection-arrays.npz')['vectors'].astype(np.float64)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    topics = json.loads(TOPICS.read_text())
    section_of = {m['reference']: s['id'] for c in topics['chapters'] for s in c['sections'] for m in s['members']}
    assert sorted(section_of) == sorted(refs), 'topics.json and the corpus hold different passages'

    # The whole-book tree, cut into seven chapters, exactly as aurelius-topics.py does.
    whole = linkage(vectors, method='ward')
    label = fcluster(whole, 7, criterion='maxclust')
    for i, ref in enumerate(refs):
        assert section_of[ref].split('.')[0] == f'c{label[i]}', f'{ref}: chapter differs from topics.json'
    # The six merges above the cut, over chapter ids: each row joins two chapters or earlier rows ("m0", "m1", ...).
    n = len(refs)
    node_members: dict[int, set[int]] = {}   # node of the whole tree -> the chapter labels under it
    for row, (a, b, _h, _size) in enumerate(whole):
        node_members[n + row] = set().union(*({label[c]} if c < n else node_members[c] for c in (int(a), int(b))))
    top, name = [], {}
    for row in range(n - 7, n - 1):
        a, b, h, _ = whole[row]
        def tag(child: int) -> str:
            if child in name:
                return name[child]
            if child < n:
                return f'c{label[child]}'
            assert len(node_members[child]) == 1, 'a top merge joins something below the chapter cut'
            return f'c{next(iter(node_members[child]))}'
        top.append([tag(int(a)), tag(int(b)), round(float(h), 4)])
        name[n + row] = f'm{len(top) - 1}'
    chapters_in_top = {x for row in top for x in row[:2] if x.startswith('c')}
    assert chapters_in_top == {c['id'] for c in topics['chapters']}, 'the top merges do not join the seven chapters'

    # Each chapter's own tree, cut into its sections.
    trees = {}
    for chapter in topics['chapters']:
        members = [m['reference'] for s in chapter['sections'] for m in s['members']]
        members.sort(key=refs.index)
        index = [refs.index(r) for r in members]
        tree = linkage(vectors[index], method='ward')
        count = len(chapter['sections'])
        cut = fcluster(tree, count, criterion='maxclust')
        for i, ref in enumerate(members):
            assert section_of[ref] == f"{chapter['id']}.s{cut[i]}", f'{ref}: section differs from topics.json'
        order = dendrogram(tree, no_plot=True)['leaves']
        trees[chapter['id']] = {
            'leaves': members,
            'order': [members[i] for i in order],
            'linkage': [[int(a), int(b), round(float(h), 4)] for a, b, h, _ in tree],
            'cut': round(float((tree[-count, 2] + tree[-count + 1, 2]) / 2), 4) if count > 1 else None,
        }

    flat = TSNE(n_components=2, perplexity=PERPLEXITY, metric='cosine', init='pca', random_state=SEED).fit_transform(vectors)
    trust = trustworthiness(vectors, flat, n_neighbors=NEIGHBOURS, metric='cosine')
    flat -= flat.mean(axis=0)
    flat /= np.abs(flat).max()

    # The acceptance gates over the whole record, as the checks figure draws them.
    qa = json.loads(subprocess.run([sys.executable, str(ROOT / 'scripts/aurelius-qa.py'), '--json', 'articles'],
                                   check=False, capture_output=True, text=True).stdout)
    by_rule: dict[str, int] = {}
    for w in qa['warnings']:
        by_rule[w['rule']] = by_rule.get(w['rule'], 0) + 1
    gates = {'command': 'scripts/aurelius-qa.py --json articles', 'blocking': len(qa['blocking']), 'warnings': len(qa['warnings']),
             'warnings_by_rule': dict(sorted(by_rule.items(), key=lambda kv: (-kv[1], kv[0])))}

    sections = [section_of[r] for r in refs]
    words = np.array([len(p['text'].split()) for p in passages])
    data = {
        'about': 'Numbers behind the map, the tree and the validation of the method page (public/apps/stoic-method.html): passage references and numbers only.',
        'made_by': 'scripts/stoic-method-diagram-data.py',
        'software': {'numpy': np.__version__, 'scipy': scipy.__version__, 'scikit_learn': sklearn.__version__},
        'vectors': topics['vector_description'],
        'source_vector_hash': topics['source_vector_hash'],
        'projection': {
            'method': f't-SNE of the unit vectors, cosine distance, perplexity {PERPLEXITY}, PCA start, seed {SEED}; scaled into [-1, 1]',
            'trustworthiness': round(float(trust), 3), 'neighbours': NEIGHBOURS,
            'points': [[ref, round(float(x), 4), round(float(y), 4), section_of[ref]] for ref, (x, y) in zip(refs, flat)],
        },
        'tree': {
            'method': 'Ward linkage on unit vectors (euclidean); heights are Ward merge distances',
            'top': top,
            'chapters': trees,
        },
        'gates': gates,
        'validation': validation(vectors, whole, label, sections, refs, passages, words),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'wrote {OUT.relative_to(ROOT)}: {len(refs)} points, trustworthiness {trust:.3f}; top merges {[r[2] for r in top]}')


if __name__ == '__main__':
    main()
