#!/usr/bin/env python
"""Token alignment between each lesson wording and the passage spans it cites.

Method: greedy soft token matching on contextual embeddings, as in BERTScore
(Zhang et al., ICLR 2020), without idf weighting or baseline rescaling. Runs a small
local model; no text leaves this machine. The output is a derived, public artifact:
it contains only the public study's own words plus similarity numbers.

    python scripts/aurelius-alignment.py            # rewrite content/aurelius/alignment.json
    python scripts/aurelius-alignment.py --check    # fail if the artifact is stale
"""
import argparse, hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / 'content/aurelius/backup-study.json'
OUT = ROOT / 'content/aurelius/alignment.json'
MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
REVISION = '1110a243fdf4706b3f48f1d95db1a4f5529b4d41'
WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*", re.UNICODE)
# Function words carry little meaning on their own; they are embedded in context but left out of the scores.
STOP = set('''a an the and or but nor so yet if then than that this these those there here of in on at by for from with without within into unto
upon to as is are was were be been being am do does did doth done have has had hath having it its itself he him his she her hers they them their
theirs we us our ours you your yours thee thou thy thine i me my mine not no nay neither either what which who whom whose when where why how
can may might must shall should will would could any some such so very too also only again once own same other others one all each every both
few more most much many still ever never while because until about against between through during before after above below up down out over
under again further s t'''.split())


def words(text):
    return [{'t': m.group(0), 'start': m.start(), 'end': m.end(), 'stop': m.group(0).lower().replace('’', "'") in STOP} for m in WORD.finditer(text)]


def pack(token):
    return [token['t'], token['start'], token['end'], int(token['stop'])]


def text_key(study):
    # Everything the scores depend on: the wording of each revision and the exact cited spans.
    payload = [[r['id'], r['text']] for r in study['revisions']] + [[s['id'], s['exact']] for s in study['spans']] + \
              [[l['id'], l['source_span'], l['target_revision'], l['active']] for l in study['links']]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def targets(study):
    revisions = {r['id']: r for r in study['revisions']}
    spans = {s['id']: s for s in study['spans']}
    for r in study['revisions']:
        meaning = r['id'] if r['kind'] == 'conclusion' else next((d for d in r['dependencies'] if revisions.get(d, {}).get('kind') == 'conclusion'), None)
        ids = list(dict.fromkeys(l['source_span'] for l in study['links'] if l['active'] and l['target_revision'] == meaning))
        if ids and r['text'].strip():
            yield r, [spans[i] for i in ids]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    study = json.loads(STUDY.read_text())
    key = text_key(study)
    if args.check:
        current = json.loads(OUT.read_text()) if OUT.exists() else {}
        if current.get('text_key') != key:
            sys.exit('content/aurelius/alignment.json is stale: run scripts/aurelius-alignment.py')
        print('alignment artifact matches the study'); return

    import numpy as np, torch
    from transformers import AutoModel, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    model = AutoModel.from_pretrained(MODEL, revision=REVISION).eval()

    def embed(text, tokens):
        enc = tokenizer(text, return_offsets_mapping=True, return_tensors='pt', truncation=True, max_length=512)
        offsets = enc.pop('offset_mapping')[0].tolist()
        if len(offsets) >= 512:
            raise ValueError('Text exceeds the model window; split the span before aligning')
        with torch.no_grad():
            hidden = model(**enc).last_hidden_state[0].numpy()
        rows = []
        for token in tokens:  # mean of the word's word-piece vectors, then unit length
            pieces = [i for i, (a, b) in enumerate(offsets) if b > a and a < token['end'] and b > token['start']]
            if not pieces:
                raise ValueError(f"No word piece covers {token['t']!r}")
            v = hidden[pieces].mean(axis=0); rows.append(v / np.linalg.norm(v))
        return np.array(rows)

    items = {}
    for revision, spans in targets(study):
        result = words(revision['text']); r = embed(revision['text'], result)
        sources, blocks = [], []
        for span in spans:
            tokens = words(span['exact']); sources.append({'span_id': span['id'], 'tokens': tokens}); blocks.append(embed(span['exact'], tokens))
        sim = np.clip(r @ np.concatenate(blocks).T, -1, 1)
        stop_r = np.array([t['stop'] for t in result]); stop_s = np.array([t['stop'] for s in sources for t in s['tokens']])
        content = np.round(sim * 100)[~stop_r][:, ~stop_s] / 100  # score the stored values, so the artifact can be re-derived
        precision, recall = float(content.max(axis=1).mean()), float(content.max(axis=0).mean())
        source_words = {t['t'].lower() for s in sources for t in s['tokens']}
        kept = [t for t in result if not t['stop']]
        items[revision['id']] = {
            'kind': revision['kind'], 'result': [pack(t) for t in result],
            'sources': [{'span_id': s['span_id'], 'tokens': [pack(t) for t in s['tokens']]} for s in sources],
            # cosine x 100, rounded: rows are result words, columns all source words in span order
            'sim': [[int(round(float(x) * 100)) for x in row] for row in sim],
            'precision': round(precision, 3), 'recall': round(recall, 3), 'f1': round(2 * precision * recall / (precision + recall), 3),
            'novel': round(sum(t['t'].lower() not in source_words for t in kept) / len(kept), 3),
        }
    artifact = {
        'schema': 'aurelius-alignment-v1', 'text_key': key, 'study_revision': study['study_revision'],
        'method': {'name': 'Greedy soft token matching on contextual embeddings (BERTScore without idf weighting or baseline rescaling)',
                   'reference': 'Zhang, Kishore, Wu, Weinberger, Artzi. BERTScore: Evaluating Text Generation with BERT. ICLR 2020.',
                   'model': MODEL, 'model_revision': REVISION, 'layer': 'last hidden state', 'pooling': 'mean of word pieces per word, unit-normalised',
                   'similarity': 'cosine', 'scored_tokens': 'content words (function words embedded in context, excluded from scores)',
                   'software': {'torch': torch.__version__, 'transformers': __import__('transformers').__version__}},
        'items': items,
    }
    OUT.write_text(json.dumps(artifact, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'revisions': len(items), 'bytes': OUT.stat().st_size}, indent=2))


if __name__ == '__main__':
    main()
