import copy
import hashlib
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from aurelius.anchors import scalar_to_utf16, utf16_to_scalar, validate_anchor
from aurelius.api import create_app
from aurelius.models import Command
from aurelius.store import ROOT, Store, validate_workspace


def cmd(w, kind, payload, op='unit-operation'):
    return Command(id=op, type=kind, expected_version=w['version'], at='2026-11-10T01:00:00Z', payload=payload)


def test_fixture_is_synthetic_and_all_exact_spans_validate():
    w = validate_workspace(json.loads((ROOT / 'content/aurelius/fixture.json').read_text()))
    assert w['corpus_kind'] == 'synthetic'
    assert not any(e.get('isbn') for e in w['editions'])
    for span in w['spans']:
        p = next(p for p in w['passages'] if p['revision_id'] == span['passage_revision'])
        validate_anchor(p, span)
        with pytest.raises(ValueError):
            validate_anchor(p, {**span, 'exact': 'An invented quotation.'})


def test_python_browser_scalar_convention_handles_surrogates_and_combining_marks():
    text = 'A🏛️ cafe\u0301'
    for i in range(len(text) + 1):
        assert utf16_to_scalar(text, scalar_to_utf16(text, i)) == i
    with pytest.raises(ValueError, match='surrogate'):
        utf16_to_scalar(text, 2)
    assert len('e\u0301') == 2


def test_sqlite_restart_persists_links_preferences_and_review_events(tmp_path):
    store = Store(tmp_path)
    w = store.apply(cmd(store.state(), 'preference', {'passage_id': 'demo-p1', 'preference': {'pinned': True}}))
    w = store.apply(cmd(w, 'link_review', {'link_id': 'link-1'}, 'second'))
    reopened = Store(tmp_path)
    assert reopened.state() == w
    with reopened.connect() as db:
        assert db.execute('SELECT count(*) FROM evidence_links').fetchone()[0] == len(w['links'])
        assert db.execute('SELECT count(*) FROM events').fetchone()[0] == 2
        assert [r[0] for r in db.execute('SELECT version FROM schema_migrations ORDER BY version')] == [1, 2, 3, 4]
        for payload, digest in db.execute('SELECT payload_json,content_hash FROM workspace_snapshots'):
            assert hashlib.sha256(payload.encode()).hexdigest() == digest


def test_sqlite_rejects_source_and_revision_mutation(tmp_path):
    store = Store(tmp_path)
    for table in ['passages', 'source_spans', 'revisions']:
        with store.connect() as db, pytest.raises(sqlite3.IntegrityError, match='immutable'):
            db.execute(f'UPDATE {table} SET payload_json=?', ('{}',))


def test_stale_writes_and_unknown_operations_roll_back(tmp_path):
    store = Store(tmp_path)
    before = store.state()
    c = cmd(before, 'link_review', {'link_id': 'link-1'})
    after = store.apply(c)
    with pytest.raises(ValueError, match='Workspace changed'):
        store.apply(c)
    with pytest.raises(ValueError):
        store.apply(cmd(after, 'unlink', {'link_id': 'not-a-link'}, 'bad-link'))
    assert store.state() == after


def test_corrupt_lineage_and_real_corpus_are_not_fixture_imports():
    w = json.loads((ROOT / 'content/aurelius/fixture.json').read_text())
    corrupt = copy.deepcopy(w)
    corrupt['revisions'][0]['dependencies'] = ['e1:r1']
    with pytest.raises(ValueError, match='Lineage'):
        validate_workspace(corrupt)
    with pytest.raises(ValueError):
        validate_workspace({**w, 'corpus_kind': 'hays'})


def test_api_is_private_cookie_free_and_uses_explicit_commands(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        response = client.get('/state')
        assert response.status_code == 200
        assert response.headers['cache-control'] == 'no-store'
        assert 'set-cookie' not in response.headers
        w = response.json()
        body = cmd(w, 'link_review', {'link_id': 'link-1'}).model_dump()
        assert client.post('/commands', json=body).status_code == 403
        assert client.post('/commands', json=body, headers={'Origin': 'https://evil.test', 'X-Aurelius-Local': '1'}).status_code == 403
        headers = {'Origin': 'http://127.0.0.1:3150', 'X-Aurelius-Local': '1'}
        assert client.post('/commands', json=body, headers=headers).status_code == 200
        assert client.post('/commands', json=body, headers=headers).status_code == 409
        assert client.get('/health').json()['external_processing'] is False
        assert client.post('/generate', json={}, headers=headers).status_code == 404
        assert client.get('/state', headers={'host': 'rebound.evil'}).status_code == 400


def test_relationship_tables_keep_membership_separate_and_reject_cycles(tmp_path):
    store = Store(tmp_path)
    with store.connect() as db:
        assert db.execute('SELECT count(*) FROM memberships WHERE passage_revision IS NOT NULL').fetchone()[0] == len(store.state()['memberships'])
        db.execute('INSERT INTO concept_parents VALUES (?,?)', ('judgment', 'fairness'))
        with pytest.raises(sqlite3.IntegrityError, match='acyclic'):
            db.execute('INSERT INTO concept_parents VALUES (?,?)', ('fairness', 'judgment'))
        with pytest.raises(sqlite3.IntegrityError, match='acyclic'):
            db.execute('INSERT INTO lineage VALUES (?,?)', ('c1:r1', 'e1:r1'))


def test_data_directory_cannot_become_a_published_asset():
    with pytest.raises(ValueError, match='Private data'):
        Store(ROOT / 'public' / 'private-aurelius')


def test_existing_v1_database_upgrades_without_replacing_editorial_decisions(tmp_path):
    legacy = json.loads((ROOT / 'content/aurelius/fixture.json').read_text())
    for field, count in [('passages', 5), ('spans', 5), ('conclusions', 1),
                         ('expressions', 2), ('revisions', 3), ('links', 3),
                         ('bundles', 1), ('concepts', 2), ('memberships', 5)]:
        legacy[field] = legacy[field][:count]
    legacy['fixture_revision'] = 1
    legacy['target_mappings'] = []
    legacy['assessments'] = {k: v for k, v in legacy['assessments'].items()
                             if k in {'c1:r1', 'e1:r1', 'e2:r1'}}
    legacy['conclusions'][0]['locked'] = True
    legacy['preferences']['demo-p1'] = {'pinned': True, 'excluded': True}
    legacy['assessments']['e2:r1'] = {'state': 'rejected', 'notes': 'Preserve my decision.'}
    legacy['version'] = 42
    old_store = Store.__new__(Store)
    old_store.path = tmp_path / 'aurelius.sqlite3'
    with old_store.connect() as db:
        db.execute('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
        for migration in sorted((ROOT / 'apps/aurelius/migrations').glob('00[12]_*.sql')):
            db.executescript(migration.read_text())
        old_store.persist(db, validate_workspace(legacy))
    upgraded = Store(tmp_path).state()
    assert len(upgraded['passages']) == 29
    assert upgraded['version'] == 43
    assert upgraded['conclusions'][0]['locked'] is True
    assert upgraded['preferences'] == legacy['preferences']
    assert upgraded['assessments']['e2:r1'] == legacy['assessments']['e2:r1']
    assert upgraded['revisions'][:3] == legacy['revisions']
    assert Store(tmp_path).state() == upgraded
    with old_store.connect() as db:
        assert db.execute('SELECT count(*) FROM target_mapping_sources').fetchone()[0] > 0
        assert db.execute('SELECT count(*) FROM workspace_snapshots').fetchone()[0] == 2
