#!/usr/bin/env python3
"""Build the published record for the first constitution articles.

Joins the topic hierarchy (content/aurelius/topics.json), the authored fusions
(content/aurelius/constitution.json) and the Casaubon text of the sections that have an article
(private corpus under .aurelius/, public-domain Project Gutenberg 2680). An article is a thought
induced from fused claims; a fused claim rests on exact quotes from at least two passages. Every
quote must resolve to exactly one span of its immutable passage. Writes public/apps/stoic-constitution.json.

Run: apps/aurelius/.venv/bin/python scripts/aurelius-constitution.py [--authored FILE] [--out-dir DIR]
(--authored and --out-dir let scripts/aurelius-constitution-fixtures.py build altered copies without touching public/.)

Russian: add `--lang ru`. The articles' own words come from the overlay content/aurelius/translation/articles-ru-v1.json
({articles: {"N": {"<path in the authored article>": "<Russian>"}}, global: {...}}), the passages from ru-v1.json (Marcus by
standard reference, Seneca as "Ep. N.M"). Every rule of the English build is run again on the Russian: each quote one exact span
of its passage's Russian, each gives phrase inside the sentence it backs, statement parts inside the statement, inferences once.
The overlay must cover exactly the paths the present English has (`overlay_paths`), and every Russian passage must have been
made from the present English. Writes public/apps/stoic-constitution.ru.json and public/apps/stoic-constitution/ru/<chapter>.json.
`--partial` (with --out-dir, for development only) builds articles the overlay does not cover completely in English.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import warnings
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/corpus.json'
TOPICS = ROOT / 'content/aurelius/topics.json'
AUTHORED = ROOT / 'content/aurelius/constitution.json'
MARCUS_REVISION = ROOT / 'content/aurelius/constitution-marcus-revised.json'
OUT = ROOT / 'public/apps/stoic-constitution.json'          # the index: everything but full articles
CHAPTER_DIR = ROOT / 'public/apps/stoic-constitution'        # one file per chapter that has articles
SENECA = ROOT / '.aurelius/corpora/seneca-gummere-wikisource'   # private: Gummere's English, used only for the vectors
SENECA_TRANSLATION = ROOT / 'content/aurelius/translation/seneca-v1.json'   # the project's own English of every quoted section
TRANSLATION_VECTORS = ROOT / '.aurelius/corpora/project-v1/vectors.npz'   # the same model, on the new English (scripts/aurelius-translation.py --embed)
TRANSLATION = ROOT / 'content/aurelius/translation/project-v1.json'   # the project's own English from the Greek (pilot)
RUSSIAN = ROOT / 'content/aurelius/translation/ru-v1.json'    # the Russian of every passage, made from the project's English
OVERLAY = ROOT / 'content/aurelius/translation/articles-ru-v1.json'   # the Russian of the articles' own words (written by the translators' merge)
RU_NAME = 'stoic-constitution.ru.json'                      # the Russian index; its chapters go to CHAPTER_DIR / 'ru'
# Strings of the record that are not the articles' own words and not in the overlay: the English each was translated from,
# and its Russian. A changed English fails the Russian build until its Russian is written again.
RU_FIXED = {
    'status': ('Editorial draft. Topic names, selections and article wordings are unreviewed.',
               'Редакторский черновик. Названия тем, отбор фрагментов и формулировки статей не проверены. '
               'Русский текст переведён с английского текста этого проекта моделью и человеком пока не проверен.'),
    'vectors': ('OpenAI text-embedding-3-large, full 3072-dimensional cached source vectors',
                'векторы OpenAI text-embedding-3-large, полные, в 3072 измерениях, вычисленные заранее по исходному тексту'),
    'seneca.name': ('Seneca', 'Сенека'),
    'seneca.work': ('Moral Letters to Lucilius', '«Нравственные письма к Луцилию»'),
    'seneca.short': ('Letters', '«Письма»'),
}
# Overlay paths that hold keys the build and the page use, not words: they must be present but keep their English key.
RU_KEYS = re.compile(r'voices/seneca/amend/\d+/kind|voices/seneca/items/\d+/label')
PLACEHOLDER = 'TO REVIEW IN N3'     # stood in for `context` and `searched` during milestone N1; no longer accepted (every one was written on 23 Nov 2026)
CHAPTER_WARN_BYTES = 600 * 1024
RELATIONS = {'supports', 'qualifies', 'challenges', 'illustrates', 'depends_on', 'paraphrases', 'answers'}



def load_seneca_translation(path: Path) -> dict:
    """The project's English of Seneca's letters, from the Latin. Each passage's revision is a hash of its reference, its Latin
    and its English, so an edit without a new revision fails; notes quote the Latin exactly; the English is today's."""
    data = json.loads(path.read_text())
    by_ref = {}
    for p in data['passages']:
        digest = hashlib.sha256(f"{p['ref']}\n{p['latin']}\n{p['english']}".encode()).hexdigest()[:16]
        assert p['revision'] == f"{data['id']}:{p['ref']}:{digest}", f"Seneca {p['ref']}: revision does not match its Latin and English"
        assert p['ref'] not in by_ref, f"Seneca {p['ref']} translated twice"
        for kind in ('notes', 'check'):
            for x in p[kind]:
                assert x['latin'] in p['latin'], f"Seneca {p['ref']}: a {kind} item quotes Latin that is not in the section: {x['latin'][:40]!r}"
        assert not re.search(r'["\']', p['english']), f"Seneca {p['ref']}: straight quote in the English"
        assert not re.search(r'\b(thee|thou|thy|thine|doth|hath|saith|unto|shalt)\b', p['english'], re.I), f"Seneca {p['ref']}: an old form in the English"
        by_ref[p['ref']] = p
    letters_cited = {int(r.split()[1].split('.')[0]) for r in by_ref}
    assert letters_cited <= {int(n) for n in data['letters']}, f"Seneca: letters without a title: {sorted(letters_cited - {int(n) for n in data['letters']})}"
    return {**data, 'by_ref': by_ref}


# ---------- Russian ----------
# Keys whose string values the page shows (the same rule as the translators' tool, which cut the overlay into units).
RU_TEXT_KEYS = {'title', 't', 'kind', 'form', 'why', 'role', 'shared', 'changed', 'follows', 'note', 'label', 'limit', 'context',
                'becomes', 'statement', 'words', 'doubt', 'action', 'practice', 'breaks'}
RU_ID = re.compile(r'[a-z]?\d+(\.\d+)*[a-z]?|c\d+|w\d+|S[\d.]+[a-z]')


def overlay_paths(article: dict) -> dict[str, str]:
    """Every string of an authored article that has a Russian in the overlay: path (keys and list indices joined by '/') -> English."""
    out = {}

    def walk(x, path: list):
        if isinstance(x, dict):
            for k, v in x.items():
                if k != 'searched':
                    walk(v, path + [k])
        elif isinstance(x, list):
            for i, v in enumerate(x):
                walk(v, path + [i])
        elif isinstance(x, str):
            key = next((p for p in reversed(path) if isinstance(p, str)), '')
            if key in ('quote', 'gives', 'decisions') or key in RU_TEXT_KEYS or path[0] in ('limit', 'decisions', 'aside', 'empty'):
                if not RU_ID.fullmatch(x):
                    out['/'.join(map(str, path))] = x
    walk(article, [])
    return out


def global_paths(authored: dict, letter_titles: dict) -> dict[str, str]:
    """The record's own words outside the articles: labels, effects, chapter titles and summaries, the order note, letter titles."""
    out = {f'labels/{i}/{k}': label[k] for i, label in enumerate(authored['labels']) for k in ('name', 'asks')}
    out |= {f'effects/{i}/{k}': effect[k] for i, effect in enumerate(authored['effects']) for k in ('name', 'asks')}
    out |= {f'chapters/{c}/{k}': names[k] for c, names in authored['chapters'].items() for k in ('title', 'summary')}
    out['chapter_order_note'] = authored['chapter_order_note']
    out |= {f'letters/{n}': title for n, title in letter_titles.items()}
    return out


def english_digest(paths: dict[str, str]) -> str:
    return hashlib.sha256(json.dumps(paths, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def put(target, path: str, value: str) -> None:
    node = target
    parts = path.split('/')
    for i, part in enumerate(parts):
        key = int(part) if isinstance(node, list) else part
        if i == len(parts) - 1:
            assert isinstance(node[key], str), f'overlay path {path} does not end at a string'
            node[key] = value
        else:
            node = node[key]


def load_russian(translation: dict, seneca_english: dict) -> tuple[dict, dict, dict]:
    """The Russian of the passages: Marcus by standard reference, Seneca by "Ep. N.M". Refuses any passage whose Russian was made
    from an English that is no longer the published one."""
    data = json.loads(RUSSIAN.read_text())
    current = {('marcus', p['standard_ref']): p['revision'] for p in translation['passages']}
    current |= {('seneca', ref): p['revision'] for ref, p in seneca_english['by_ref'].items()}
    stale = [p['ref'] for p in data['passages'] if current.get((p['work'], p['ref'])) != p['english_revision']]
    assert not stale, f"{RUSSIAN.name}: the Russian of {stale[:5]} was made from an English that is no longer published (or is unknown); translate again"
    marcus = {p['ref']: p for p in data['passages'] if p['work'] == 'marcus'}
    seneca = {p['ref']: p for p in data['passages'] if p['work'] == 'seneca'}
    for p in data['passages']:
        assert isinstance(p['russian'], str) and p['russian'].strip(), f"{RUSSIAN.name}: {p['ref']} has no Russian"
    return data, marcus, seneca


def russify(authored: dict, overlay: dict, letter_titles: dict, partial: bool) -> tuple[dict, dict, set[int], list[str]]:
    """The authored record with the overlay's Russian at every path, and the letter titles in Russian.
    Returns (record, letter titles, numbers of the articles in Russian, notes). Without `partial` the overlay must hold exactly the
    paths of the present English, article by article and for the record; with it, an article not fully covered stays English."""
    russian = copy.deepcopy(authored)
    notes, done, refused = [], set(), []
    digests = overlay.get('english') or {}
    if not digests:
        notes.append('the overlay carries no digests of the English it was made from: only its paths are checked against the English')
    by_number = {str(a['number']): a for a in russian['articles']}
    unknown = sorted(set(overlay['articles']) - set(by_number), key=int)
    assert not unknown, f'overlay: articles {unknown} are not in the record'
    for article in russian['articles']:
        n = str(article['number'])
        want = overlay_paths(next(a for a in authored['articles'] if a['number'] == article['number']))
        have = overlay['articles'].get(n, {})
        missing, extra = sorted(set(want) - set(have)), sorted(set(have) - set(want))
        changed = n in digests and digests[n] != english_digest(want)
        problem = (f'article {n}: ' + '; '.join(x for x in [f'{len(missing)} paths of the English have no Russian (first {missing[:3]})' if missing else '',
                                                             f'{len(extra)} paths are not in the present English (first {extra[:3]})' if extra else '',
                                                             'its English changed after the Russian was made' if changed else ''] if x))
        if missing or extra or changed:
            (notes if partial else refused).append(problem + ('; built in English' if partial else ''))
            continue
        for path, value in have.items():
            assert isinstance(value, str) and value.strip(), f'overlay article {n}: {path} is empty'
            if not RU_KEYS.fullmatch(path):
                put(article, path, value)
        done.add(article['number'])
    want = global_paths(authored, letter_titles)
    have = overlay.get('global', {})
    missing, extra = sorted(set(want) - set(have)), sorted(set(have) - set(want))
    changed = 'global' in digests and digests['global'] != english_digest(want)
    if missing or extra or changed:
        problem = f'global: {len(missing)} missing (first {missing[:3]}), {len(extra)} not in the present English (first {extra[:3]})' + (', English changed' if changed else '')
        (notes if partial else refused).append(problem + ('; those stay English' if partial else ''))
    if refused:
        raise SystemExit('the overlay is not complete and current:\n  ' + '\n  '.join(refused))
    titles = dict(letter_titles)
    for path, value in have.items():
        if path not in want:
            continue
        assert isinstance(value, str) and value.strip(), f'overlay global: {path} is empty'
        if path.startswith('letters/'):
            titles[int(path.split('/')[1])] = value
        elif path.startswith('chapters/'):
            _, c, k = path.split('/')
            russian['chapters'][c][k] = value
        else:
            put(russian, path, value)
    # A section is named by its article's title.
    for article in russian['articles']:
        if article['number'] in done:
            russian['chapters'][article['section'].split('.')[0]]['sections'][article['section']] = article['title']
    return russian, titles, done, notes


def russian_problems(article: dict, marcus_text, seneca_text) -> list[str]:
    """Every rule of the build that the Russian of one article breaks, listed at once (the build itself stops at the first).
    marcus_text(casaubon_ref) and seneca_text("Ep. N.M") give the Russian passage."""
    where, out = f"article {article['number']}", []

    def once(text: str, quote: str, name: str) -> None:
        found = len(re.findall(r'\s+'.join(re.escape(w) for w in quote.split()), text))
        if found != 1:
            out.append(f'{where} {name}: the quote matches {found} times in the Russian passage: «{quote[:60]}»')

    def inside(phrase: str, sentence: str | None, name: str, what: str) -> None:
        if not sentence or phrase.lower() not in sentence.lower():
            out.append(f'{where} {name}: «{phrase}» is not in {what}')

    def inferences(sentence: str, backed: list[str], items: list[dict], name: str) -> None:
        try:
            check_inferences(f'{where} {name}', sentence, backed, items, 260)
        except AssertionError as error:
            out.append(str(error))

    claim_t = {c['id']: c['t'] for c in article['claims']}
    for c in article['claims']:
        for item in c['support']:
            once(marcus_text(item['id'].rstrip('abcdefghijklmnopqrstuvwxyz')), item['quote'], item['id'])
            for g in item.get('gives', []):
                inside(g, c['t'], item['id'], f"claim {c['id']}")
        inferences(c['t'], [g for s in c['support'] for g in s.get('gives', [])], c.get('inferences', []), c['id'])
    for item in article['single']:
        once(marcus_text(item['id'].rstrip('abcdefghijklmnopqrstuvwxyz')), item['quote'], item['id'])
    st = article['statement']
    for part in st['parts']:
        inside(part['words'], st['t'], 'statement', 'the statement')
    inferences(st['t'], [p['words'] for p in st['parts']], st.get('inferences', []), 'statement')
    voice = article.get('voices', {}).get('seneca')
    if voice:
        def letter(piece: dict, sentence: str | None, what: str) -> None:
            number = re.fullmatch(r'S(\d+)\.(\d+)[a-z]', piece['id'])
            once(seneca_text(f'Ep. {number[1]}.{number[2]}'), piece['quote'], piece['id'])
            for g in piece.get('gives', []):
                inside(g, sentence, piece['id'], what)
            if not 20 <= len(piece.get('context', '')) <= 260:
                out.append(f"{where} {piece['id']}: context must be 20 to 260 characters ({len(piece.get('context', ''))})")
        for item in voice['items']:
            if item['effect'] == 'stronger':
                letter(item, claim_t.get(item['claim']), f"claim {item['claim']}")
            else:
                for piece in item['support']:
                    letter(piece, item['t'] if item['effect'] == 'wider' else None, f"Seneca's item {item['key']}" if item['effect'] == 'wider' else 'nothing (a limiting item backs no words)')
        for clause in voice.get('amend', []):
            if clause['t'][:1] not in (' ', ',', ';') or clause['t'].rstrip().endswith('.'):
                out.append(f"{where}: Seneca's clause on {clause['target']} must continue the sentence (start with a space, comma or semicolon) and carry no full stop: «{clause['t'][:50]}»")
    return out


def words(text: str) -> int:
    return sum(1 for word in text.split() if re.search(r'\w', word))


def span(text: str, quote: str, where: str) -> tuple[int, int]:
    pattern = r'\s+'.join(re.escape(word) for word in quote.split())
    found = list(re.finditer(pattern, text))
    if len(found) != 1:
        raise SystemExit(f'{where}: quote matches {len(found)} times: {quote[:60]!r}')
    return found[0].start(), found[0].end()


def recover_five_colours(used, meets, position):
    """Reassign earlier colours when the greedy pass exhausts all five at one passage."""
    colours = {}
    def assign():
        if len(colours) == len(used):
            return True
        # Most constrained first. Source order breaks ties independently of set iteration.
        remaining = (ref for ref in used if ref not in colours)
        def saturation(ref):
            return len({colours[r] for r in meets[ref] if r in colours}), len(meets[ref])
        ref = max(remaining, key=saturation)
        excluded = {colours[r] for r in meets[ref] if r in colours}
        # Unused colours are interchangeable. Try one new colour at each level.
        choices = [i for i in range(1, min(5, 1 + max(colours.values(), default=0)) + 1) if i not in excluded]
        if ref in position:
            def nearest_same_colour(i):
                distances = (abs(position[r] - position[ref]) for r in position if colours.get(r) == i)
                return min(distances, default=float('inf'))
            choices.sort(key=nearest_same_colour, reverse=True)
        for i in choices:
            colours[ref] = i
            if assign():
                return True
            del colours[ref]
        return False
    return colours if assign() else {}


def shared_components(claims: list[dict]) -> tuple[int, int]:
    """Claim components (runs of words backed by the same set of passages) and how many rest on two or more."""
    components = shared = 0
    for claim in claims:
        cover = [set() for _ in claim['t']]
        for piece in claim['support']:
            for words_ in piece.get('gives', []):
                at = claim['t'].lower().find(words_.lower())
                for i in range(at, at + len(words_)):
                    cover[i].add(piece['ref'])
        keys = ['|'.join(sorted(refs)) for refs in cover]
        for i, key in enumerate(keys):
            if key and key != (keys[i - 1] if i else None):
                components += 1
                shared += '|' in key
    return shared, components


def check_inferences(where: str, sentence: str, backed: list[str], inferences: list[dict], longest: int = 200) -> None:
    """An inference is a word or two of the editor's that draws a conclusion ("so", "therefore", "because").
    It is recorded with one sentence of why the step is the editor's, so the page can say so. It must stand once in
    the sentence, as whole words, outside every phrase a passage backs."""
    for inference in inferences:
        words_, why = inference.get('words', ''), inference.get('why', '')
        found = [m.start() for m in re.finditer(r'(?<!\w)' + re.escape(words_) + r'(?!\w)', sentence)] if words_ else []
        assert len(found) == 1, f"{where}: the inference “{words_}” must stand exactly once in the sentence; found {len(found)} times"
        assert isinstance(why, str) and 20 <= len(why) <= longest, f"{where}: the inference “{words_}” needs one sentence of why it is the editor's (20 to {longest} characters)"
        for phrase in backed:
            start = sentence.lower().find(phrase.lower())
            assert start < 0 or not (start <= found[0] < start + len(phrase)), f"{where}: the inference “{words_}” lies inside “{phrase}”, which a passage backs; an inference is the editor's alone"


def scalar(text: str, index: int) -> int:
    return len(text[:index].encode('utf-32-le')) // 4


def compiled_marcus_revision():
    """Compile the Marcus-only text separately from claims with Seneca annotations."""
    with tempfile.TemporaryDirectory() as folder:
        subprocess.run([sys.executable, str(Path(__file__).resolve()), '--authored', str(MARCUS_REVISION),
                        '--out-dir', folder], check=True, stdout=subprocess.DEVNULL)
        return {article['number']: article
                for file in (Path(folder) / CHAPTER_DIR.name).glob('*.json')
                for article in json.loads(file.read_text())['articles']}


def attach_marcus_revision(articles, revised):
    assert set(revised) == {article['number'] for article in articles}, 'Marcus revision must cover the same articles'
    for article in articles:
        revision = revised[article['number']]
        assert article['section'] == revision['section'] and article['title'] == revision['title'], article['number']
        assert not revision['voices'], 'Seneca belongs to the English wording on which its annotation was edited'
        article['marcus_revision'] = {key: value for key, value in revision.items()
                                      if key != 'voices' and article.get(key) != value}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--authored', type=Path, default=AUTHORED)
    parser.add_argument('--out-dir', type=Path, default=None, help='write the index and chapter files here instead of public/apps')
    parser.add_argument('--lang', choices=['en', 'ru'], default='en', help='ru: the Russian edition, from --overlay and ru-v1.json')
    parser.add_argument('--overlay', type=Path, default=OVERLAY, help='the Russian of the articles (default: the merged overlay)')
    parser.add_argument('--partial', action='store_true', help='development only, needs --out-dir: build articles the overlay does not fully cover in English')
    args = parser.parse_args()
    ru = args.lang == 'ru'
    if args.partial and not (ru and args.out_dir):
        parser.error('--partial is for a development build: it needs --lang ru and --out-dir')
    out = args.out_dir / OUT.name if args.out_dir else OUT
    chapter_dir = args.out_dir / CHAPTER_DIR.name if args.out_dir else CHAPTER_DIR
    if ru:
        out, chapter_dir = out.parent / RU_NAME, chapter_dir / 'ru'
    topics = json.loads(TOPICS.read_text())
    authored = json.loads(args.authored.read_text())
    english = authored      # the English record; in a Russian build `authored` becomes its Russian
    ru_done: set[int] = set()
    if ru:
        assert args.overlay.exists(), f'{args.overlay} does not exist yet: the Russian of the articles is merged there (or pass --overlay)'
        overlay = json.loads(args.overlay.read_text())
        assert overlay.get('language') == 'ru', f'{args.overlay.name}: not a Russian overlay'
        titles_en = {int(n): title for n, title in json.loads(SENECA_TRANSLATION.read_text())['letters'].items()}
        authored, ru_titles, ru_done, ru_notes = russify(english, overlay, titles_en, args.partial)
        # Every rule the Russian breaks, for all articles at once; a partial build keeps such an article in English.
        project = json.loads(TRANSLATION.read_text())
        _, marcus_ru, seneca_ru = load_russian(project, load_seneca_translation(SENECA_TRANSLATION))
        standard = {p['casaubon_ref']: p['standard_ref'] for p in project['passages']}
        broken = []
        for index, article in enumerate(authored['articles']):
            if article['number'] not in ru_done:
                continue
            problems = russian_problems(article, lambda ref: marcus_ru[standard[ref]]['russian'], lambda ref: seneca_ru[ref]['russian'])
            if problems and args.partial:
                ru_notes.append(f"article {article['number']}: {len(problems)} rules broken in the Russian (first: {problems[0]}); built in English")
                ru_done.discard(article['number'])
                original = next(a for a in english['articles'] if a['number'] == article['number'])
                authored['articles'][index] = copy.deepcopy(original)
                authored['chapters'][article['section'].split('.')[0]]['sections'][article['section']] = original['title']
            broken += problems
        if broken and not args.partial:
            raise SystemExit(f'the Russian breaks {len(broken)} rules of the build:\n  ' + '\n  '.join(broken))
        for note in ru_notes:
            print('  note (ru):', note)
    english_of = {a['number']: a for a in english['articles']}
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
    # What is published of Seneca is the project's own translation from the Latin: the text of each quoted section and the
    # letters' titles. Gummere's English stays private; it is used only for the vectors (as the 1634 English is for Marcus).
    seneca_english = load_seneca_translation(SENECA_TRANSLATION)
    letter_titles = {int(n): title for n, title in seneca_english['letters'].items()}
    if not ru:
        ru_titles = letter_titles
    letters = {ref: {**letters[ref], 'text': p['english'], 'words': len(p['english'].split()), 'revision_id': p['revision']}
               for ref, p in seneca_english['by_ref'].items()} | {ref: {**v, 'text': None} for ref, v in letters.items() if ref not in seneca_english['by_ref']}
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

    # An article may be anchored in the project's own translation instead of Casaubon: `"edition": "project-v1"`.
    # Its quotes are then exact spans of that English; the passages keep their Casaubon numbers and revisions as their
    # identity (sections, vectors and colours were built on them), and carry the modern number, the Greek and both Englishes.
    translation = json.loads(TRANSLATION.read_text()) if TRANSLATION.exists() else {'id': None, 'edition': {}, 'passages': []}
    translated = {p['casaubon_revision']: p for p in translation['passages']}
    for p in translation['passages']:
        body = '\n'.join([translation['edition']['id'], p['standard_ref'], p['greek'], p['english']])
        assert p['revision'] == f"{translation['id']}:{p['standard_ref']}:{hashlib.sha256(body.encode('utf-8')).hexdigest()[:16]}", \
            f"translation {p['standard_ref']}: text and revision disagree; run scripts/aurelius-translation.py"
    # The Russian of the passages, each made from the English published now.
    ru_record, marcus_ru, seneca_ru = load_russian(translation, seneca_english) if ru else (None, {}, {})

    # Vectors of the translated passages, by the Casaubon revision each one replaces.
    new_vectors = {}
    if TRANSLATION_VECTORS.exists():
        kept = np.load(TRANSLATION_VECTORS)
        by_new = {p['revision']: p['casaubon_revision'] for p in translation['passages']}
        new_vectors = {by_new[str(rid)]: v / np.linalg.norm(v) for rid, v in zip(kept['revision_ids'], kept['vectors'].astype(np.float64)) if str(rid) in by_new}

    def closeness_new(revisions: list[str]) -> float | None:
        """As `closeness`, measured on the new English of the same passages."""
        rows_ = [new_vectors[r] for r in dict.fromkeys(revisions)]
        if len(rows_) < 2:
            return None
        sims = np.stack(rows_) @ np.stack(rows_).T
        return round(float(sims[np.triu_indices(len(rows_), 1)].mean()), 3)

    articles = []
    counted = {'pieces': 0, 'voices': 0}
    for article in authored['articles']:
        chapter, section = sections[article['section']]
        where = f"article {article['number']}"
        by_ref = {m['reference']: m for m in section['members']}
        ids: dict[str, dict] = {}
        anchored = 'edition' in article
        here = article['number'] in ru_done     # this article is built in Russian: its quotes are spans of the Russian passages
        russian_of = lambda revision: marcus_ru[translated[revision]['standard_ref']]
        letter_text = lambda ref: seneca_ru[ref]['russian'] if here else letters[ref]['text']
        if anchored:
            assert article['edition'] == translation['id'], f"{where}: unknown edition {article['edition']!r}; the only one besides Casaubon is {translation['id']!r}"
            missing = [m['reference'] for m in section['members'] if m['revision_id'] not in translated]
            assert not missing, f"{where}: anchored in {article['edition']} but these passages of its section are not translated: {', '.join(missing)}"
            unembedded = [m['reference'] for m in section['members'] if m['revision_id'] not in new_vectors]
            assert not unembedded, f"{where}: the new English of {', '.join(unembedded)} has no vectors; run scripts/aurelius-translation.py --embed"

        def piece(item: dict, context: str) -> dict:
            ref = item['id'].rstrip('abcdefghijklmnopqrstuvwxyz')
            assert ref in by_ref and item['id'] not in ids, f"{where}: piece {item['id']}"
            text = translated[by_ref[ref]['revision_id']]['english'] if anchored else passages[by_ref[ref]['revision_id']]['text']
            if here:
                text = russian_of(by_ref[ref]['revision_id'])['russian']
            start, end = span(text, item['quote'], f"{where} {item['id']}" + (' (in the Russian)' if here else f" (in the {article['edition']} English)" if anchored else ''))
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
            check_inferences(f"{where} {claim['id']}", claim['t'], [words_ for s in support for words_ in s.get('gives', [])], claim.get('inferences', []), 260 if here else 200)
            claims.append({'id': claim['id'], 'number': number, 'role': claim['role'], 't': claim['t'], 'shared': claim['shared'],
                           **({'changed': claim['changed']} if 'changed' in claim else {}), **({'inferences': claim['inferences']} if claim.get('inferences') else {}), 'passages': refs,
                           'closeness': closeness([by_ref[r]['revision_id'] for r in refs]),
                           **({'closeness_new': closeness_new([by_ref[r]['revision_id'] for r in refs])} if anchored else {}), 'support': support})
        single = [{**piece(item, 'single'), 'label': item['label'], 't': item['t'], 'why': item['why'], 'follows': item['follows']} for item in article['single']]
        # A section whose passages share no claim gets an article of said-once items only, and says so (plan 32, Article 29).
        unfused = article.get('unfused')
        assert bool(claims) != bool(unfused), f"{where}: an article fuses at least one claim, or carries `unfused` with the reason it cannot, not both"
        assert not unfused or len(unfused.get('reason', '')) >= 40, f"{where}: `unfused.reason` must say in a sentence why no two passages share a claim"

        used = list(dict.fromkeys(p['ref'] for p in ids.values()))
        assert set(article['aside']) == set(by_ref) - set(used), f"{where}: every unused member needs a reason; mismatch {set(article['aside']) ^ (set(by_ref) - set(used))}"
        members = []
        for rank, member in enumerate(section['members'], 1):
            ref = member['reference']
            members.append({'ref': ref, 'revision': member['revision_id'], 'rank': rank, 'similarity': member['similarity'],
                            'words': member['words'], 'used': ref in used,
                            'feeds': sorted({p['in'] for p in ids.values() if p['ref'] == ref}),
                            'why': article['aside'].get(ref), 'text': passages[member['revision_id']]['text'],
                            **({'standard': translated[member['revision_id']]['standard_ref'], 'translation': translated[member['revision_id']]['revision'],
                                'english': translated[member['revision_id']]['english'], 'greek': translated[member['revision_id']]['greek']}
                               if member['revision_id'] in translated else {})})
            if here:
                # The Russian edition carries the Russian as the passage's text, beside the English it was made from and the Greek.
                said = russian_of(member['revision_id'])
                members[-1].update({'text': said['russian'], 'words': len(said['russian'].split()), 'russian': said['revision']})
        statement = article['statement']
        for part in statement['parts']:
            assert part['words'].lower() in statement['t'].lower() and set(part['ids']) <= set(ids), f"{where}: statement part {part['words']!r}"
            assert part['ids'], f"{where}: statement part {part['words']!r} has no witness: every part needs at least one quoted piece"
            part['refs'] = list(dict.fromkeys(ids[i]['ref'] for i in part['ids']))
        check_inferences(f'{where} statement', statement['t'], [part['words'] for part in statement['parts']], statement.get('inferences', []), 260 if here else 200)
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
        # statement never share a slot (hard). Passages anywhere in the same sentence (the statement, or one claim)
        # also differ when five slots allow it (soft); if they cannot, the two that share are the ones whose words sit
        # farthest apart in that sentence, and the build says so. Five slots are all the palette can keep apart.
        meets = {ref: set() for ref in used}
        for group in [c['passages'] for c in claims] + [part['refs'] for part in statement['parts']]:
            for ref in group:
                meets[ref] |= set(group) - {ref}
        sentence_order = list(dict.fromkeys(ref for part in statement['parts'] for ref in part['refs']))
        # Positions are read in the English statement, so that both editions give every passage the same colour.
        lead = english_of[article['number']]['statement'] if here else statement
        position = {ref: lead['t'].lower().find(next(q['words'] for q, p in zip(lead['parts'], statement['parts']) if ref in p['refs']).lower()) for ref in sentence_order}
        near = {ref: set(sentence_order) - {ref} if ref in sentence_order else set() for ref in used}
        colors = {}
        for ref in sorted(used, key=lambda r: (-len(meets[r] | near[r]), used.index(r))):
            hard = {colors.get(other) for other in meets[ref]}
            free = [slot for slot in range(1, 6) if slot not in hard]
            if not free:
                colors = recover_five_colours(used, meets, position)
                assert colors, f'{where}: needs more than five passage colours; the palette has five'
                break
            clear = [slot for slot in free if slot not in {colors.get(other) for other in near[ref]}]
            if clear:
                colors[ref] = clear[0]
            else:
                # Keep reused colours as far apart as possible, with ties in statement order.
                holder = {}
                for other in sorted(near[ref], key=lambda r: (-abs(position[r] - position[ref]), -sentence_order.index(r))):
                    if other in colors:
                        holder[colors[other]] = other
                colors[ref] = max(free, key=lambda slot: abs(position[holder[slot]] - position[ref]) if slot in holder else 10**6)
                print(f"  note: {where}: {ref} shares a colour with {holder.get(colors[ref])} in the statement; five colours cannot keep all apart")
        second = None
        extra = None
        assert set(article.get('voices', {})) <= {'seneca'}, f'{where}: unknown voice'
        if 'seneca' in article.get('voices', {}):
            voice = article['voices']['seneca']
            searched = voice.get('searched')
            assert searched != PLACEHOLDER, f"{where}: voices.seneca.searched still holds the placeholder {PLACEHOLDER!r}; write the search log"
            assert isinstance(searched, dict) and len(searched.get('searches', [])) >= 3 and all(isinstance(x, str) and x.strip() for x in searched['searches']) \
                and all(r.get('ref') and r.get('why') for r in searched.get('rejected', [])), \
                f"{where}: voices.seneca.searched must log at least three word searches of the corpus and a reason for each passage rejected"
            counted['voices'] += 1
            added = {}
            claim_text = {c['id']: c['t'] for c in claims}

            def letter_piece(item: dict, context: str, text: str | None) -> dict:
                number = re.fullmatch(r'S(\d+)\.(\d+)[a-z]', item['id'])
                assert number and item['id'] not in added, f"{where}: Seneca piece {item['id']}"
                ref = f'Ep. {number[1]}.{number[2]}'
                assert letters[ref]['text'] is not None, f"{where} {item['id']}: {ref} is not in the project's translation of Seneca ({SENECA_TRANSLATION.name})"
                start, end = span(letter_text(ref), item['quote'], f"{where} {item['id']}" + (' (in the Russian)' if here else ''))
                for words_ in item.get('gives', []):
                    assert text and words_.lower() in text.lower(), f"{where} {item['id']}: “{words_}” is not in the sentence it backs"
                said = item.get('context')
                assert said != PLACEHOLDER, f"{where} {item['id']}: context still holds the placeholder {PLACEHOLDER!r}; read the passage and write the sentence"
                longest = 260 if here else 200    # Russian runs longer than English
                assert isinstance(said, str) and 20 <= len(said) <= longest, \
                    f"{where} {item['id']}: context must say, in 20 to {longest} characters, what the passage around the quote is about and what its key words refer to"
                counted['pieces'] += 1
                added[item['id']] = {'id': item['id'], 'ref': ref, 'author': 'seneca', 'quote': letter_text(ref)[start:end], 'at': start, 'in': context,
                                     'follows': item['follows'], 'context': said, **({'gives': item['gives']} if 'gives' in item else {})}
                return added[item['id']]

            items = []
            keys_seen = {}
            for item in voice['items']:
                if item['effect'] != 'stronger':
                    assert item['key'] not in keys_seen, f"{where}: two Seneca items share the key {item['key']!r}: “{keys_seen.get(item['key'])}” and “{item.get('role') or item['t'][:50]}”"
                    keys_seen[item['key']] = item.get('role') or item['t'][:50]
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
            # Each clause names the items it comes from (`from`), cites only their pieces, and those items must be about
            # what the clause is appended to: a claim's own items for a claim, and for the statement an addition or an
            # item on a claim that feeds the statement.
            owner = {}
            about = {}
            for item in items:
                key = item['piece']['id'] if item['effect'] == 'stronger' else item['key']
                about[key] = (item['effect'], item.get('claim'))
                for piece_ in ([item['piece']] if item['effect'] == 'stronger' else item['support']):
                    owner[piece_['id']] = key
            statement_ids = {i for part in statement['parts'] for i in part['ids']}
            feeds = {c['id'] for c in claims if statement_ids & {p['id'] for p in c['support']}}
            describe = lambda key: f"{key} ({about[key][0]}" + (f", claim {about[key][1]})" if about[key][1] else ")")
            amend = []
            for clause in voice.get('amend', []):
                name = f"clause on {clause['target']} ({clause['kind']}) “{clause['t'].strip()[:50]}…”"
                assert clause['target'] == 'statement' or clause['target'] in claim_text, f"{where}: amend target {clause['target']}"
                assert clause['kind'] in {'adds', 'changes', 'challenges', 'limits'} and clause['t'].strip() and clause['ids'], f"{where}: amend {clause}"
                assert clause['t'][0] in ' ,;' and not clause['t'].rstrip().endswith('.'), f"{where}: an added clause continues the sentence and carries no full stop"
                assert all(piece_id in added for piece_id in clause['ids']), f"{where}: amend ids {clause['ids']} are not among this author's pieces"
                frm = clause.get('from')
                assert frm and all(key in about for key in frm), f"{where}: {name} must name in `from` the Seneca items it comes from; got {frm!r}"
                for piece_id in clause['ids']:
                    assert owner[piece_id] in frm, (f"{where}: {name} cites {piece_id}, which belongs to item {describe(owner[piece_id])}, "
                                                    f"not to the items it comes from: {', '.join(describe(k) for k in frm)}")
                for key in frm:
                    effect, on = about[key]
                    if clause['target'] == 'statement':
                        assert effect == 'wider' or on in feeds, f"{where}: {name} comes from {describe(key)}, whose claim does not feed the statement"
                    else:
                        assert on == clause['target'], f"{where}: {name} comes from {describe(key)}, which is not about claim {clause['target']}"
                if clause['target'] != 'statement' and clause['kind'] in {'challenges', 'limits'}:
                    assert any(about[key] == ('qualified', clause['target']) for key in frm), f"{where}: {name} limits or challenges claim {clause['target']} but comes from no qualified item on that claim"
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
                passages_out.append({'ref': ref, 'title': (ru_titles if here else letter_titles)[letters[ref]['letter']], 'text': letter_text(ref),
                                     'words': len(letter_text(ref).split()) if here else letters[ref]['words'],
                                     'revision': letters[ref]['revision_id'], **({'russian': seneca_ru[ref]['revision']} if here else {}),
                                     'to_centre': round(float(to_centre[letter_row[ref]]), 3),
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
        articles.append({'number': article['number'], 'section': article['section'], 'title': article['title'], **({'edition': article['edition']} if anchored else {}), 'statement': statement, 'groups': groups, 'colors': colors, 'map': picture, 'voices': {'seneca': second} if second else {},
                         'section_size': section['size'], 'cohesion': section['cohesion'],
                         'section_closeness': closeness([m['revision_id'] for m in section['members']]),
                         # For an article quoted in the new English: the same measure on the new English, and how many of its
                         # passages are still nearest to this section's centre among all sections when said in today's words.
                         **({'in_translation': {'closeness': closeness_new([m['revision_id'] for m in section['members']]),
                                                'stayed': sum(1 for m in section['members'] if max(centres, key=lambda sid: float(centres[sid] @ new_vectors[m['revision_id']])) == article['section']),
                                                'of': len(section['members']), 'sections': len(centres)}} if anchored else {}),
                         'sources': [m['ref'] for m in members if m['used']], 'claims': claims, 'single': single, **({'unfused': unfused} if unfused else {}), 'members': members,
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
    if ru:
        def fixed(key: str, english_text: str) -> str:
            assert english_text == RU_FIXED[key][0], f'RU_FIXED[{key!r}] was translated from “{RU_FIXED[key][0]}”, but the English is now “{english_text}”: translate it again'
            return RU_FIXED[key][1]
        author = record['authors'][0]
        author.update({k: fixed('seneca.' + k, author[k]) for k in ('name', 'work', 'short')})
        record['status'] = fixed('status', record['status'])
        record['method']['vectors'] = fixed('vectors', record['method']['vectors'])
        record = {'schema_version': record['schema_version'], 'format': record['format'], 'language': 'ru',
                  'overlay': {'id': overlay.get('id'), 'made': overlay.get('made'), 'articles': sorted(ru_done), 'partial': args.partial},
                  'translation': {k: ru_record[k] for k in ('id', 'made', 'status')}, **record}
    # The page loads the index first and a chapter's articles only when that chapter is opened.
    # Nothing of Gummere's English may be published: any clause of 30 or more characters that stands in his text and not in the
    # project's own translation fails the build (a literal rendering of the same Latin may of course coincide with his).
    published = json.dumps([record, articles], ensure_ascii=False)   # the index and every chapter file
    ours = ' '.join(p['english'] for p in seneca_english['passages'])
    leaked = sorted({s for p in seneca_corpus['passages'] for s in re.split(r'(?<=[.;?!:,])\s+', p['text'])
                     if len(s) >= 30 and s in published
                     and re.sub(r'^(and|for|but|or|so|that)\s+', '', s.strip(' ,.;:?!“”‘’'), flags=re.I) not in ours})
    assert not leaked, f'words of the old Seneca translation would be published: {leaked[:5]}'
    chapter_of = {s['id']: c['id'] for c in topics['chapters'] for s in c['sections']}
    record['articles'] = [{
        'number': a['number'], 'section': a['section'], 'chapter': chapter_of[a['section']], 'title': a['title'],
        'statement': {'t': a['statement']['t']},
        'counts': {'claims': len(a['claims']), 'single': len(a['single']), 'sources': len(a['sources']), 'section_size': a['section_size']},
        'voices': {key: {'becomes': voice['becomes'], 'counts': voice['counts']} for key, voice in a['voices'].items()},
    } for a in articles]
    if not ru and args.authored.resolve() == AUTHORED and MARCUS_REVISION.is_file():
        attach_marcus_revision(articles, compiled_marcus_revision())
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(record, ensure_ascii=False, indent=1) + '\n')
    print('wrote', out, f'{out.stat().st_size // 1024} KB')
    chapter_dir.mkdir(parents=True, exist_ok=True)
    written = set()
    for chapter_id in dict.fromkeys(chapter_of[a['section']] for a in articles):
        path = chapter_dir / f'{chapter_id}.json'
        path.write_text(json.dumps({'chapter': chapter_id, 'articles': [a for a in articles if chapter_of[a['section']] == chapter_id]},
                                   ensure_ascii=False, indent=1) + '\n')   # readable diffs; compact saved 6 KB after gzip
        written.add(path.name)
        size = path.stat().st_size
        print('wrote', path, f'{size // 1024} KB' + (f'  WARNING: above {CHAPTER_WARN_BYTES // 1024} KB; a phone will feel it' if size > CHAPTER_WARN_BYTES else ''))
    for stale in chapter_dir.glob('*.json'):
        if stale.name not in written:
            stale.unlink()
            print('removed', stale, '(chapter has no articles)')
    for a in articles:
        print(f"  Article {a['number']} {a['title']!r}: {len(a['sources'])} of {a['section_size']} passages, "
              + ', '.join(f"claim {c['number']} from {len(c['passages'])} ({c['closeness']})" for c in a['claims'])
              + f", {len(a['single'])} said once; section closeness {a['section_closeness']}"
              + "; shared components {}/{}".format(*shared_components(a['claims'])))
    print(f"added authors: {counted['pieces']} pieces, each with its context sentence; {counted['voices']} voices, each with a search log")

if __name__ == '__main__':
    main()
