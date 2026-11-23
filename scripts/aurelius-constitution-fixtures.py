#!/usr/bin/env python3
"""Fault fixtures for the Stoic Constitution's build and tests.

Usage: apps/aurelius/.venv/bin/python scripts/aurelius-constitution-fixtures.py [--json FILE] [name ...]

Each case takes a copy of the authored record (build cases) or of the published files (test cases),
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
AUTHORED = ROOT / 'content/aurelius/constitution.json'
PUBLISHED = ROOT / 'public/apps'
TEST = ROOT / 'tests/aurelius/constitution.test.mjs'


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


def g3_duplicate_key(r):
    item(r, 6, 'w2')['key'] = 'w1'


def g4_empty_part(r):
    article(r, 6)['statement']['parts'][0]['ids'] = []


def g7_no_context(r):
    item(r, 6, 'S96.2b').pop('context', None)


def g7_short_context(r):
    item(r, 6, 'S96.2b')['context'] = 'about God'


def g8_no_search(r):
    seneca(r, 6).pop('searched', None)


def g8_two_searches(r):
    seneca(r, 6)['searched'] = {'searches': ['willing', 'Fate'], 'rejected': []}


BUILD = [
    ('g2-clause-cites-another-item', 'G2', 'the prayer clause on c2 cites S71.13c, a piece of the item on c3', g2_wrong_item, 'S71.13c'),
    ('g2-clause-without-from', 'G2', 'a body clause that does not say which items contribute it', g2_no_from, 'from'),
    ('g3-duplicate-item-key', 'G3', 'two added items share the key w1', g3_duplicate_key, 'w1'),
    ('g4-statement-part-without-witness', 'G4', 'the first part of the statement has no quote behind it', g4_empty_part, 'statement part'),
    ('g7-piece-without-context', 'G7', 'an added-author piece without a context sentence', g7_no_context, 'context'),
    ('g7-context-too-short', 'G7', 'an added-author piece whose context is two words', g7_short_context, 'context'),
    ('g8-voice-without-search-log', 'G8', 'an added voice with no record of what was searched', g8_no_search, 'searched'),
    ('g8-two-searches', 'G8', 'an added voice that logs only two searches', g8_two_searches, 'searched'),
]


# ---- test cases: (name, row, fault, mutate(files), env, text the failure must contain)
def g1_none(files):
    pass


def g5_duplicate(files):
    articles = chapter(files)['articles']
    articles.append(copy.deepcopy(articles[-1]))


def g5_missing(files):
    chapter(files)['articles'].pop()


def g6_shared_colour(files):
    a6 = next(a for a in chapter(files)['articles'] if a['number'] == 6)
    a6['colors']['10.21'] = a6['colors']['10.22']   # the two never meet in one claim or part; only the statement rule can see this


def g7_published_without_context(files):
    a6 = next(a for a in chapter(files)['articles'] if a['number'] == 6)
    a6['voices']['seneca']['items'][0]['piece'].pop('context', None)


TESTS = [
    ('g1-article-5-without-exemption', 'G1', 'Article 5 has 0 of 9 shared components and is not on the exempt list', g1_none, {'STOIC_KNOWN_BELOW': '1,4'}, 'article 5'),
    ('g5-chapter-file-repeats-an-article', 'G5', 'the chapter file holds Article 6 twice', g5_duplicate, {}, 'chapter file'),
    ('g5-chapter-file-lacks-an-article', 'G5', 'the chapter file lacks Article 6', g5_missing, {}, 'chapter file'),
    ('g6-statement-passages-share-a-colour', 'G6', '10.21 and 10.22 share a colour in one statement although five colours allow otherwise', g6_shared_colour, {}, "statement's passages"),
    ('g7-published-piece-without-context', 'G7', 'a published Seneca piece without its context sentence', g7_published_without_context, {}, 'context'),
]


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
