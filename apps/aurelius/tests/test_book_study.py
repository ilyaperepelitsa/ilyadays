import json
from pathlib import Path

import pytest

from aurelius.study import manual_study
from aurelius.store import ROOT, validate_workspace


def corpus():
    paths = sorted((ROOT / '.aurelius/corpora').glob('casaubon-*/corpus.json'))
    if not paths:
        pytest.skip('local Casaubon corpus not present')
    return json.loads(paths[0].read_text())


def test_book_pilot_exact_evidence_shared_sources_and_unapproved():
    w = validate_workspace(manual_study(corpus(), 'local-hash', public_slice=True))
    assert w['study_revision'] == 3
    assert w['study_catalog']['default_id'].endswith('-ordinary-impressions')
    lessons = [c for c in w['conclusions'] if c['id'].endswith(('-ordinary-impressions', '-distress-and-threat'))]
    assert len(lessons) == 2
    passage_by_revision = {p['revision_id']: p for p in w['passages']}
    spans = {s['id']: s for s in w['spans']}
    ref_sets = []
    for lesson in lessons:
        rid = lesson['current']
        assert w['assessments'][rid]['state'] == 'awaiting_review'
        r = next(r for r in w['revisions'] if r['id'] == rid)
        assert r['synthesis']['interpretive_step'] and r['qualifications']
        linked = [spans[l['source_span']] for l in w['links'] if l['target_revision'] == rid]
        refs = set()
        for span in linked:
            p = passage_by_revision[span['passage_revision']]
            assert p['text'][span['start']:span['end']] == span['exact']
            assert p['text_hash'] == span['text_hash']
            refs.add((p['book'],p['section']))
        assert len(refs) >= 2
        ref_sets.append(refs)
        for m in (m for m in w['target_mappings'] if m['target_revision'] == rid):
            assert r['text'][m['start']:m['end']] == m['exact']
    assert ('8','12') in ref_sets[0] & ref_sets[1]
    assert all(a['state'] != 'approved' for a in w['assessments'].values())
    memberships = [m for m in w['memberships'] if '-judgment-membership-' in m['id']]
    assert any(sum(m['passage_id'] == p['id'] for m in memberships) > 1 for p in w['passages'])
    assert {(p['book'],p['section']) for p in w['passages']} == {('5','6'),('6','5'),('6','49'),('1','15'),('8','12'),('9','13'),('5','16'),('5','20')}
