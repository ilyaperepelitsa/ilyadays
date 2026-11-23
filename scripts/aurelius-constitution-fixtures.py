#!/usr/bin/env python3
"""Fault fixtures for the Stoic Constitution's build and tests.

Usage: apps/aurelius/.venv/bin/python scripts/aurelius-constitution-fixtures.py [--json FILE] [name ...]

Each case takes a copy of a frozen authored record (build cases) or of the published files (test cases),
introduces one known fault, and runs the real build or the real test file on the copy. A case passes
when the fault is REJECTED with the expected message. Nothing under public/ or content/ is touched.
Exits 1 when any fault is accepted. Faults that need an impossible record (a four-passage section) are
synthetic cases inside tests/aurelius/constitution.test.mjs instead. The cases come from the second review of milestone M1
(plan/stoicism/33-astra-review-handover.md) and rows G1 to G8 of plan/stoicism/34-after-review-plan.md.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable
# Build cases start from a frozen record, so rewriting a real article cannot break them. Test cases start from the
# published files and change them by structure only (never by an article's wording).
AUTHORED = ROOT / 'tests/aurelius/fixtures/constitution-page-cases.json'
PUBLISHED = ROOT / 'public/apps'
TEST = ROOT / 'tests/aurelius/constitution.test.mjs'
TRANSLATION = ROOT / 'content/aurelius/translation/project-v1.json'


def article(record: dict, number: int) -> dict:
    return next(a for a in record['articles'] if a['number'] == number)


def seneca(record: dict, number: int) -> dict:
    return article(record, number)['voices']['seneca']


def item(record: dict, number: int, key: str) -> dict:
    return next(i for i in seneca(record, number)['items'] if i.get('key') == key or i.get('id') == key)


def clause(record: dict, number: int, target: str) -> dict:
    return next(c for c in seneca(record, number)['amend'] if c['target'] == target)


def chapter(files: dict, name: str = 'c6') -> dict:
    return files[f'stoic-constitution/{name}.json']


# ---- build cases: (name, row, what the fault is, mutate(authored), text the rejection must contain)
def g2_wrong_item(r):
    clause(r, 6, 'c2')['ids'] = ['S71.13c']


def g2_no_from(r):
    clause(r, 6, 'c2').pop('from', None)


def g2_limit_without_item(r):
    backing = next(i for i in seneca(r, 6)['items'] if i['effect'] == 'stronger' and i.get('claim') == 'c2')
    limit = clause(r, 6, 'c2')
    limit['kind'], limit['from'], limit['ids'] = 'limits', [backing.get('key') or backing['id']], [backing['id']]


def g3_duplicate_key(r):
    item(r, 6, 'w2')['key'] = 'w1'


def g4_empty_part(r):
    article(r, 6)['statement']['parts'][0]['ids'] = []


def g7_no_context(r):
    item(r, 6, 'S96.2b').pop('context', None)


def g7_short_context(r):
    item(r, 6, 'S96.2b')['context'] = 'about God'


def g7_placeholder(r):
    item(r, 3, next(i['id'] for i in seneca(r, 3)['items'] if i.get('effect') == 'stronger'))['context'] = 'TO REVIEW IN N3'


def g8_placeholder(r):
    seneca(r, 3)['searched'] = 'TO REVIEW IN N3'


def g8_no_search(r):
    seneca(r, 6).pop('searched', None)


def g8_two_searches(r):
    seneca(r, 6)['searched'] = {'searches': ['willing', 'Fate'], 'rejected': []}


def a3_inference_not_in_sentence(r):
    article(r, 6)['statement']['inferences'] = [{'words': 'therefore', 'why': 'The step from what is sent to what I want is the editor’s.'}]


def a3_inference_inside_backed_words(r):
    article(r, 6)['statement']['inferences'] = [{'words': 'good', 'why': 'The step from what is sent to what I want is the editor’s.'}]


BUILD = [
    ('a3-inference-not-in-the-sentence', 'A3', 'an editor\'s inference whose words are not in the statement', a3_inference_not_in_sentence, 'inference'),
    ('a3-inference-inside-backed-words', 'A3', 'an editor\'s inference that claims words a passage backs', a3_inference_inside_backed_words, 'inference'),
    ('g2-clause-cites-another-item', 'G2', 'the prayer clause on c2 cites S71.13c, a piece of the item on c3', g2_wrong_item, 'S71.13c'),
    ('g2-clause-without-from', 'G2', 'a body clause that does not say which items contribute it', g2_no_from, 'from'),
    ('g2-limit-from-no-limiting-item', 'G2', 'a clause said to limit claim 2 that comes from an item which only backs it', g2_limit_without_item, 'no qualified item'),
    ('g3-duplicate-item-key', 'G3', 'two added items share the key w1', g3_duplicate_key, 'w1'),
    ('g4-statement-part-without-witness', 'G4', 'the first part of the statement has no quote behind it', g4_empty_part, 'statement part'),
    ('g7-piece-without-context', 'G7', 'an added-author piece without a context sentence', g7_no_context, 'context'),
    ('g7-context-too-short', 'G7', 'an added-author piece whose context is two words', g7_short_context, 'context'),
    ('g7-placeholder-no-longer-accepted', 'R5', 'a context that still holds the N1 placeholder', g7_placeholder, 'placeholder'),
    ('g8-placeholder-no-longer-accepted', 'R5', 'a search log that still holds the N1 placeholder', g8_placeholder, 'placeholder'),
    ('g8-voice-without-search-log', 'G8', 'an added voice with no record of what was searched', g8_no_search, 'searched'),
    ('g8-two-searches', 'G8', 'an added voice that logs only two searches', g8_two_searches, 'searched'),
]


# ---- test cases: (name, row, fault, mutate(files), env, text the failure must contain)
def g1_no_shared_component(files):
    # Every claim of Article 4 keeps its words on one passage only: nothing is fused any more.
    a4 = next(a for a in chapter(files)['articles'] if a['number'] == 4)
    for claim in a4['claims']:
        for piece in claim['support'][1:]:
            if piece['ref'] != claim['support'][0]['ref']:
                piece['gives'] = []
                piece.setdefault('note', 'fixture')


def g5_duplicate(files):
    articles = chapter(files)['articles']
    articles.append(copy.deepcopy(articles[-1]))


def g5_missing(files):
    chapter(files)['articles'].pop()


def g6_shared_colour(files):
    a6 = next(a for a in chapter(files)['articles'] if a['number'] == 6)
    a6['colors']['10.21'] = a6['colors']['10.22']   # the two never meet in one claim or part; only the statement rule can see this


def g7_published_without_context(files):
    first = next(i for a in chapter(files)['articles'] for i in a['voices']['seneca']['items'] if i['effect'] == 'stronger')
    first['piece'].pop('context', None)


TESTS = [
    ('g1-article-without-a-shared-component', 'G1', 'an article whose claims give every phrase to a single passage', g1_no_shared_component, {}, 'rest on more than one passage'),
    ('g5-chapter-file-repeats-an-article', 'G5', 'the chapter file holds Article 6 twice', g5_duplicate, {}, 'chapter file'),
    ('g5-chapter-file-lacks-an-article', 'G5', 'the chapter file lacks Article 6', g5_missing, {}, 'chapter file'),
    ('g6-statement-passages-share-a-colour', 'G6', '10.21 and 10.22 share a colour in one statement although five colours allow otherwise', g6_shared_colour, {}, "statement's passages"),
    ('g7-published-piece-without-context', 'G7', 'a published Seneca piece without its context sentence', g7_published_without_context, {}, 'context'),
]


# ---- translation cases: (name, row, fault, mutate(stored translation record), text the rejection must contain)
def translated(r, standard):
    return next(p for p in r['passages'] if p['standard_ref'] == standard)


def t5_edited_in_place(r):
    translated(r, '10.21')['english'] = translated(r, '10.21')['english'].replace('loves', 'longs for', 1)


def t5_old_english(r):
    import hashlib
    passage = translated(r, '4.23')
    passage['english'] = passage['english'].replace('fits well with you', 'is expedient unto thee')
    body = '\n'.join([r['edition']['id'], passage['standard_ref'], passage['greek'], passage['english']])   # a proper new revision, so only the wording is at fault
    passage['superseded'].append(passage['revision'])
    passage['revision'] = f"{r['id']}:{passage['standard_ref']}:{hashlib.sha256(body.encode('utf-8')).hexdigest()[:16]}"


def t5_note_misquotes_greek(r):
    translated(r, '6.43')['notes'][0]['greek'] = 'Μήτις'


def t7_section_incomplete(r):
    r['passages'].remove(translated(r, '5.7'))


def t7_outside_listed_sections(r):
    r['sections'].remove('c6.s6')


def t7_part_without_what_is_left_out(r):
    next(p for p in r['passages'] if p.get('part')).pop('part')


def t7_whole_chapter_with_a_part(r):
    translated(r, '5.7')['part'] = {'of': '5.7', 'left_out': 'Εὐχὴ Ἀθηναίων', 'why': 'A whole chapter does not carry a part.'}


TRANSLATIONS = [
    ('t5-english-edited-in-place', 'T5', 'a translated passage reworded without a new revision', t5_edited_in_place, 'revision'),
    ('t5-old-english', 'T5', 'a translation that falls back into 1634 English', t5_old_english, "not today's English"),
    ('t5-note-misquotes-the-greek', 'T5', 'a note whose Greek is not in the passage', t5_note_misquotes_greek, 'not in the Greek'),
    ('t7-listed-section-incomplete', 'T7', 'a section listed as translated that lacks one of its passages', t7_section_incomplete, 'lacks'),
    ('t7-passage-outside-the-listed-sections', 'T7', 'translated passages whose section is not listed', t7_outside_listed_sections, 'not among the sections'),
    ('t7-part-of-a-chapter-without-what-is-left-out', 'T7', 'a passage numbered as part of a chapter that does not say what it leaves out', t7_part_without_what_is_left_out, 'part of a chapter'),
    ('t7-whole-chapter-with-a-part', 'T7', 'a whole chapter that claims to leave something out', t7_whole_chapter_with_a_part, 'only for a passage that covers part'),
]


def run_translation(mutate) -> tuple[bool, str]:
    record = json.loads(TRANSLATION.read_text())
    mutate(record)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'project.json'
        path.write_text(json.dumps(record, ensure_ascii=False))
        done = subprocess.run([PY, str(ROOT / 'scripts/aurelius-translation.py'), '--stored', str(path), '--out', str(Path(tmp) / 'out.json')],
                              capture_output=True, text=True, cwd=ROOT)
    return done.returncode != 0, (done.stderr.strip().splitlines() or done.stdout.strip().splitlines() or [''])[-1]


def run_build(mutate) -> tuple[bool, str]:
    record = json.loads(AUTHORED.read_text())
    mutate(record)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'constitution.json'
        path.write_text(json.dumps(record, ensure_ascii=False))
        done = subprocess.run([PY, str(ROOT / 'scripts/aurelius-constitution.py'), '--authored', str(path), '--out-dir', str(Path(tmp) / 'out')],
                              capture_output=True, text=True, cwd=ROOT)
    return done.returncode != 0, (done.stderr.strip().splitlines() or done.stdout.strip().splitlines() or [''])[-1]


def run_test(mutate, env) -> tuple[bool, str]:
    with tempfile.TemporaryDirectory() as tmp:
        shutil.copy(PUBLISHED / 'stoic-constitution.json', tmp)
        shutil.copytree(PUBLISHED / 'stoic-constitution', Path(tmp) / 'stoic-constitution')
        files = {str(p.relative_to(tmp)): json.loads(p.read_text()) for p in Path(tmp).rglob('*.json')}
        mutate(files)
        for name, data in files.items():
            (Path(tmp) / name).write_text(json.dumps(data, ensure_ascii=False))
        done = subprocess.run(['node', '--test', str(TEST)], capture_output=True, text=True, cwd=ROOT,
                              env={**os.environ, 'STOIC_RECORD_DIR': tmp, **env})
    failing = [line.strip() for line in done.stdout.splitlines() if line.lstrip().startswith(('not ok', 'error:', "error: '", 'AssertionError', '✖')) or 'Error' in line]
    return done.returncode != 0, ' | '.join(dict.fromkeys(failing))[:400]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--json', type=Path, help='also write the results here')
    parser.add_argument('names', nargs='*')
    args = parser.parse_args()
    results = []
    for name, row, fault, mutate, expect in BUILD:
        if args.names and name not in args.names:
            continue
        rejected, message = run_build(mutate)
        ok = rejected and expect.lower() in message.lower()
        results.append({'case': name, 'row': row, 'fault': fault, 'kind': 'build', 'rejected': rejected, 'ok': ok, 'message': message})
    for name, row, fault, mutate, expect in TRANSLATIONS:
        if args.names and name not in args.names:
            continue
        rejected, message = run_translation(mutate)
        ok = rejected and expect.lower() in message.lower()
        results.append({'case': name, 'row': row, 'fault': fault, 'kind': 'translation', 'rejected': rejected, 'ok': ok, 'message': message})
    for name, row, fault, mutate, env, expect in TESTS:
        if args.names and name not in args.names:
            continue
        rejected, message = run_test(mutate, env)
        ok = rejected and expect.lower() in message.lower()
        results.append({'case': name, 'row': row, 'fault': fault, 'kind': 'test', 'rejected': rejected, 'ok': ok, 'message': message})
    for r in results:
        verdict = 'ok   rejected' if r['ok'] else ('FAIL rejected for another reason' if r['rejected'] else 'FAIL accepted')
        print(f"{verdict:34} {r['row']} {r['case']}: {r['message'][:200]}")
    if args.json:
        args.json.write_text(json.dumps(results, indent=1, ensure_ascii=False))
    bad = sum(not r['ok'] for r in results)
    print('all faults rejected' if not bad else f'{bad} fault(s) not rejected as expected')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
