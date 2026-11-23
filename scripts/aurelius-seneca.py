#!/usr/bin/env python3
"""Seneca's Moral Letters (Gummere, 1917-25) as a second private corpus beside the Meditations.

Rights (checked 23 Nov 2026; full record with sources in content/aurelius/constitution.json, authors[0].rights):
Gummere died 3 Dec 1969. The three Loeb volumes (1917, 1920, 1925) are public domain in the United States
(published before 1931). In the EU, the UK and Turkey the general term is life + 70: protected through 2039. The
site quotes short sections with their source; whether to keep this translation is the owner's decision (plan 32, W5).

  fetch    download the 124 letters from English Wikisource into ignored .aurelius/imports/ (polite, resumable)
  parse    split each letter at its Loeb section numbers into passages with immutable revision ids
  preview  count tokens and estimate the embedding cost; makes no request
  embed    embed with the same model as the Meditations, under explicit token and cost caps
  arrays   write the cached vectors beside the corpus as an .npz
  attach   check the method on a known parallel, then list the letters' passages nearest each article for reading

Text and vectors stay under .aurelius/ (git-ignored). Nothing here writes a public file.
"""
import argparse
import hashlib
import html.parser
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / '.aurelius/imports/seneca-gummere-wikisource'
CORPUS = ROOT / '.aurelius/corpora/seneca-gummere-wikisource'
LETTERS = 124
EDITION = {'id': 'gummere-wikisource', 'work': 'Moral Letters to Lucilius (Ad Lucilium epistulae morales)', 'author': 'Seneca',
           'translator': 'Richard Mott Gummere', 'publisher': 'Loeb Classical Library, 1917-1925, as transcribed on English Wikisource',
           'source_location': 'https://en.wikisource.org/wiki/Moral_letters_to_Lucilius',
           'rights_notes': 'Translation published 1917, 1920 and 1925; treated as public domain in the USA. Kept privately; excerpts only are published.'}
SKIP_CLASSES = {'pagenum', 'ws-pagenum', 'reference', 'reflist', 'references', 'ws-noexport', 'mw-cite-backlink', 'wst-header', 'ws-header', 'mw-editsection'}


def fetch() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    failed = []
    for number in range(1, LETTERS + 1):
        target = RAW / f'letter-{number:03d}.json'
        if target.exists():
            continue
        url = 'https://en.wikisource.org/w/api.php?' + urllib.parse.urlencode({
            'action': 'parse', 'page': f'Moral letters to Lucilius/Letter {number}', 'prop': 'text|revid|displaytitle',
            'format': 'json', 'formatversion': '2', 'disableeditsection': '1', 'disabletoc': '1', 'maxlag': '5'})
        for _ in range(6):
            try:
                data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'corpus-study-script/1.0'}), timeout=40).read()
                if 'parse' in json.loads(data):
                    target.write_bytes(data)
                    break
                time.sleep(10)
            except urllib.error.HTTPError as error:
                time.sleep(min(max(float(error.headers.get('Retry-After') or 30), 20), 120) if error.code == 429 else 15)
            except OSError:
                time.sleep(15)
        else:
            failed.append(number)
        time.sleep(3)
    print(json.dumps({'have': len(list(RAW.glob('letter-*.json'))), 'of': LETTERS, 'failed': failed}))


class Letter(html.parser.HTMLParser):
    """Rendered Wikisource page -> [(section number or None, text)]. Page numbers, notes and the header are dropped."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # one flag per open element: True if it (or an ancestor) is skipped
        self.inside = False      # within the transcluded text block
        self.depth = 0
        self.title = []
        self.in_title = 0
        self.parts = [[None, []]]
        self.pending = None      # a section marker whose own digits must not enter the text

    def handle_starttag(self, tag, attrs):
        if tag in {'br', 'link', 'meta', 'img', 'hr', 'input', 'wbr'}:
            if tag == 'br' and self.inside and not (self.stack and self.stack[-1]):
                self.parts[-1][1].append(' ')
            return
        attrs = dict(attrs)
        classes = set((attrs.get('class') or '').split())
        if not self.inside:
            if tag == 'div' and 'prp-pages-output' in classes:
                self.inside, self.depth = True, 1
                self.stack = [False]
            return
        self.depth += 1
        skip = (self.stack[-1] if self.stack else False) or bool(classes & SKIP_CLASSES) or tag in {'style', 'script'}
        if 'wst-verse' in classes and not skip:
            number = re.fullmatch(r'(\d+)\.?', (attrs.get('id') or '').strip())
            self.parts.append([int(number.group(1)) if number else -1, []])
            skip = True            # the visible "52." is a label, not Seneca's text
        if 'wst-center' in classes and not self.title and not skip:
            self.in_title = self.depth
            skip = True
        self.stack.append(skip)

    def handle_endtag(self, tag):
        if not self.inside or tag in {'br', 'link', 'meta', 'img', 'hr', 'input', 'wbr'}:
            return
        if self.in_title == self.depth:
            self.in_title = 0
        if tag in {'p', 'div', 'li', 'tr', 'dd', 'blockquote'} and not self.stack[-1]:
            self.parts[-1][1].append(' ')
        self.stack.pop()
        self.depth -= 1
        if self.depth == 0:
            self.inside = False

    def handle_data(self, data):
        if not self.inside:
            return
        if self.in_title:
            self.title.append(data)
        elif not self.stack[-1]:
            self.parts[-1][1].append(data)


def clean(text: str) -> str:
    text = text.replace('​', '').replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    return re.sub(r'\s+([,.;:!?])', r'\1', text)


def parse() -> None:
    files = sorted(RAW.glob('letter-*.json'))
    passages, letters, warnings = [], [], []
    for file in files:
        number = int(file.stem.split('-')[1])
        page = json.loads(file.read_text())['parse']
        reader = Letter()
        reader.feed(page['text'])
        title = clean(' '.join(reader.title))
        sections = [(n, clean(''.join(chunks))) for n, chunks in reader.parts]
        opening = sections[0][1] if sections[0][0] is None else ''
        sections = [(n, text) for n, text in sections if n is not None]
        if opening:
            # Text before the first numbered marker: section 1 when the marker is missing, otherwise a stray heading.
            if sections and sections[0][0] != 1 and len(opening.split()) > 12:
                sections.insert(0, (1, opening))
            elif len(opening.split()) > 12:
                warnings.append({'letter': number, 'kind': 'unnumbered_opening', 'words': len(opening.split()), 'text': opening[:120]})
        numbers = [n for n, _ in sections]
        if numbers != list(range(1, len(numbers) + 1)):
            warnings.append({'letter': number, 'kind': 'section_sequence', 'numbers': numbers})
        if not sections:
            warnings.append({'letter': number, 'kind': 'no_sections'})
        for n, text in sections:
            if not text:
                warnings.append({'letter': number, 'kind': 'empty_section', 'section': n})
                continue
            digest = hashlib.sha256(text.encode()).hexdigest()
            passage_id = f"{EDITION['id']}-{number}-{n}"
            passages.append({'id': passage_id, 'revision_id': f'{passage_id}:{digest[:16]}', 'reference': f'Ep. {number}.{n}', 'letter': number, 'section': n,
                             'text': text, 'text_hash': digest, 'words': len(text.split())})
        letters.append({'letter': number, 'title': title, 'sections': len(sections), 'wikisource_revision': page['revid']})
    seen = {}
    for passage in passages:
        if passage['id'] in seen:
            warnings.append({'letter': passage['letter'], 'kind': 'duplicate_section', 'section': passage['section']})
        seen[passage['id']] = True
    CORPUS.mkdir(parents=True, exist_ok=True)
    counts = sorted(p['words'] for p in passages)
    report = {'letters': len(letters), 'missing_letters': sorted(set(range(1, LETTERS + 1)) - {l['letter'] for l in letters}), 'passages': len(passages),
              'words': sum(counts), 'median_words': counts[len(counts) // 2] if counts else 0, 'longest': counts[-3:], 'under_10_words': sum(1 for c in counts if c < 10),
              'over_400_words': sum(1 for c in counts if c > 400), 'warnings': warnings}
    (CORPUS / 'corpus.json').write_text(json.dumps({'editions': [EDITION], 'letters': letters, 'passages': passages}, ensure_ascii=False, indent=1) + '\n')
    (CORPUS / 'inspection.json').write_text(json.dumps(report, ensure_ascii=False, indent=1) + '\n')
    for name in ('corpus.json', 'inspection.json'):
        (CORPUS / name).chmod(0o600)
    print(json.dumps({**report, 'warnings': len(warnings), 'warning_kinds': sorted({w['kind'] for w in warnings})}, indent=1))


MARCUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5'


def queries() -> list[dict]:
    """The articles' own sentences, used to look for Seneca passages that say the same thing."""
    authored = json.loads((ROOT / 'content/aurelius/constitution.json').read_text())
    out = []
    for article in authored['articles']:
        items = [('statement', article['statement']['t'])] + [(c['id'], c['t']) for c in article['claims']] + [('s:' + s['id'], s['t']) for s in article['single']]
        for key, text in items:
            digest = hashlib.sha256(text.encode()).hexdigest()
            out.append({'id': f"query-a{article['number']}-{key}", 'revision_id': f"query-a{article['number']}-{key}:{digest[:16]}", 'article': article['number'],
                        'key': key, 'text': text, 'text_hash': digest})
    return out


def attach() -> None:
    import numpy as np
    store = cache()
    seneca = json.loads((CORPUS / 'corpus.json').read_text())['passages']
    asked = queries()
    unit = lambda m: m / np.linalg.norm(m, axis=1, keepdims=True)
    s_raw = unit(store.matrix(seneca).astype(np.float64))
    q_raw = unit(store.matrix(asked).astype(np.float64))
    marcus = json.loads((MARCUS / 'corpus.json').read_text())['passages']
    m_raw = np.load(MARCUS / 'projection-arrays.npz')['vectors'].astype(np.float64)
    m_raw = unit(m_raw)
    # Each author has an average direction (voice, translator, genre). Removing it leaves what a passage says beyond that.
    s_mean, m_mean = s_raw.mean(axis=0), m_raw.mean(axis=0)
    s_adj, m_adj = unit(s_raw - s_mean), unit(m_raw - m_mean)
    topics = json.loads((ROOT / 'content/aurelius/topics.json').read_text())
    row = {p['revision_id']: i for i, p in enumerate(marcus)}
    sections = {s['id']: s for c in topics['chapters'] for s in c['sections']}
    authored = json.loads((ROOT / 'content/aurelius/constitution.json').read_text())
    names = {sid: authored['chapters'][c['id']]['sections'][sid] for c in topics['chapters'] for sid in [s['id'] for s in c['sections']]}
    centre = lambda rows, matrix: (lambda v: v / np.linalg.norm(v))(matrix[rows].mean(axis=0))
    ids = list(sections)
    refs = {m['revision_id']: m['reference'] for section in sections.values() for m in section['members']}
    c_raw = np.stack([centre([row[m['revision_id']] for m in sections[sid]['members']], m_raw) for sid in ids])
    c_adj = np.stack([centre([row[m['revision_id']] for m in sections[sid]['members']], m_adj) for sid in ids])
    gap = {'marcus_to_marcus': float(np.median(m_raw @ m_raw.T)), 'seneca_to_seneca': float(np.median(s_raw @ s_raw.T)), 'across': float(np.median(s_raw @ m_raw.T)),
           'adjusted_marcus_to_marcus': float(np.median(m_adj @ m_adj.T)), 'adjusted_seneca_to_seneca': float(np.median(s_adj @ s_adj.T)), 'adjusted_across': float(np.median(s_adj @ m_adj.T)),
           'cosine_between_author_means': float(s_mean @ m_mean / np.linalg.norm(s_mean) / np.linalg.norm(m_mean))}
    home_raw, home_adj = (s_raw @ c_raw.T).argmax(axis=1), (s_adj @ c_adj.T).argmax(axis=1)
    by_ref = {p['reference']: i for i, p in enumerate(seneca)}
    report = {'passages': len(seneca), 'gap': {k: round(v, 3) for k, v in gap.items()}, 'tests': [], 'articles': []}
    for ref, expect in (('Ep. 95.52', 'c6.s1'),):
        i = by_ref[ref]
        near = lambda v, m: [(refs[marcus[j]['revision_id']], round(float(v @ m[j]), 3)) for j in np.argsort(-(m @ v))[:5]]
        rank = lambda scores: int((scores > scores[i]).sum()) + 1
        report['tests'].append({'ref': ref, 'expected_section': names[expect], 'section_raw': names[ids[home_raw[i]]], 'section_adjusted': names[ids[home_adj[i]]],
                                'nearest_marcus_raw': near(s_raw[i], m_raw), 'nearest_marcus_adjusted': near(s_adj[i], m_adj),
                                'rank_for_expected_section_raw': rank(s_raw @ c_raw[ids.index(expect)]), 'rank_for_expected_section_adjusted': rank(s_adj @ c_adj[ids.index(expect)])})
    q_adj = unit(q_raw - s_mean)     # the articles' sentences are modern prose, nearer Gummere's voice than Casaubon's
    for article in authored['articles']:
        sid = article['section']
        k = ids.index(sid)
        mine = [n for n, q in enumerate(asked) if q['article'] == article['number']]
        scores = {asked[n]['key']: q_raw[n] @ s_raw.T for n in mine}
        adjusted = {asked[n]['key']: q_adj[n] @ s_adj.T for n in mine}
        picked = {}
        for key in scores:
            for table, how in ((scores[key], 'raw'), (adjusted[key], 'adjusted')):
                for i in np.argsort(-table)[:6 if key != 'statement' else 8]:
                    picked.setdefault(int(i), set()).add(key)
        for i in np.argsort(-(s_adj @ c_adj[k]))[:8]:
            picked.setdefault(int(i), set()).add('section')
        rows = []
        for i, why in picked.items():
            best = max(scores, key=lambda key: scores[key][i])
            rows.append({'ref': seneca[i]['reference'], 'words': seneca[i]['words'], 'for': sorted(why), 'best': best, 'best_raw': round(float(scores[best][i]), 3),
                         'to_section_adjusted': round(float(s_adj[i] @ c_adj[k]), 3), 'text': seneca[i]['text']})
        rows.sort(key=lambda r: -r['best_raw'])
        report['articles'].append({'number': article['number'], 'title': article['title'], 'seneca_nearest_this_section_raw': int((home_raw == k).sum()),
                                   'seneca_nearest_this_section_adjusted': int((home_adj == k).sum()), 'candidates': rows})
    (CORPUS / 'candidates.json').write_text(json.dumps(report, ensure_ascii=False, indent=1) + '\n')
    (CORPUS / 'candidates.json').chmod(0o600)
    print(json.dumps({'gap': report['gap'], 'tests': report['tests'],
                      'articles': [{k: a[k] for k in ('number', 'seneca_nearest_this_section_raw', 'seneca_nearest_this_section_adjusted')} | {'candidates': len(a['candidates'])} for a in report['articles']]}, indent=1))


def cache():
    sys.path.insert(0, str(ROOT / 'apps/aurelius'))
    from aurelius.embeddings import CONFIG, EmbeddingCache
    return EmbeddingCache(ROOT / '.aurelius/vectors', CONFIG)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='action', required=True)
    for name in ('fetch', 'parse', 'preview', 'arrays', 'attach'):
        sub.add_parser(name)
    embed = sub.add_parser('embed')
    embed.add_argument('--allow-openai', action='store_true')
    embed.add_argument('--review-import', action='store_true')
    embed.add_argument('--token-budget', type=int, required=True)
    embed.add_argument('--cost-budget-usd', type=float, required=True)
    args = parser.parse_args()
    if args.action == 'fetch':
        return fetch()
    if args.action == 'parse':
        return parse()
    if args.action == 'attach':
        return attach()
    passages = json.loads((CORPUS / 'corpus.json').read_text())['passages']
    store = cache()
    if args.action == 'preview':
        out = {}
        for name, items in (('letters', passages), ('article_sentences', queries())):
            plan = store.plan(items)
            out[name] = {k: plan[k] for k in ('chunks', 'cached_chunks', 'uncached_unique_inputs', 'input_tokens', 'estimated_usd', 'batch_count', 'invalid_inputs')}
        return print(json.dumps(out, indent=1))
    if args.action == 'embed':
        report = json.loads((CORPUS / 'inspection.json').read_text())
        if report['missing_letters'] or any(w['kind'] in {'duplicate_section', 'empty_section', 'no_sections'} for w in report['warnings']):
            raise SystemExit('The import is incomplete or has unresolved sections; nothing was sent')
        if not args.allow_openai or not args.review_import:
            raise SystemExit('Review inspection.json, then pass --review-import and --allow-openai')
        key = os.environ.get('OPENAI_API_KEY')
        if not key:
            raise SystemExit('Set OPENAI_API_KEY in the environment; never paste it into chat or source code')
        from aurelius.analysis import corpus_identity
        from openai import OpenAI
        client = OpenAI(api_key=key, base_url='https://api.openai.com/v1', max_retries=0, timeout=60)
        out = {}
        for name, items in (('letters', passages), ('article_sentences', queries())):
            approval = {'corpus_hash': corpus_identity(items), 'segmentation_reviewed': True, 'external_processing_approved': True,
                        'token_budget': args.token_budget, 'cost_budget_usd': args.cost_budget_usd, 'reviewer': 'explicit CLI operator approval',
                        'source': EDITION['source_location'] if name == 'letters' else 'content/aurelius/constitution.json'}
            result = store.embed(items, client, approval)
            out[name] = {'state': result['state'], **{k: result.get('plan', {}).get(k) for k in ('chunks', 'cached_chunks', 'uncached_unique_inputs')}}
        return print(json.dumps(out, indent=1))
    import numpy as np
    matrix = store.matrix(passages)
    np.savez_compressed(CORPUS / 'vectors.npz', vectors=matrix.astype(np.float32), revision_ids=np.array([p['revision_id'] for p in passages]))
    print(json.dumps({'vectors': list(matrix.shape), 'file': str((CORPUS / 'vectors.npz').relative_to(ROOT))}))


if __name__ == '__main__':
    main()
