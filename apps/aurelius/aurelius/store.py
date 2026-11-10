from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess

from .anchors import validate_anchor
from .models import Command, Workspace

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parents[1]


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def validate_workspace(value):
    workspace = Workspace.model_validate(value).model_dump()
    passages = {p['revision_id']: p for p in workspace['passages']}
    for span in workspace['spans']:
        validate_anchor(passages[span['passage_revision']], span)
    # Immutable revision order is also the topological order of derivation.
    seen = set()
    for revision in workspace['revisions']:
        if revision['id'] in seen or any(source not in seen for source in revision['dependencies']):
            raise ValueError('Lineage must reference earlier immutable revisions')
        seen.add(revision['id'])
    return workspace


class Store:
    def __init__(self, directory: Path):
        directory = directory.resolve()
        if any(directory.is_relative_to(ROOT / name) for name in ['public', 'src', 'content']):
            raise ValueError('Private data must be outside published source and assets')
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = directory / 'aurelius.sqlite3'
        self.node = shutil.which('node')
        if not self.node:
            raise RuntimeError('Node.js from the existing frontend is required')
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
            for migration in sorted((BASE / 'migrations').glob('*.sql')):
                version = int(migration.name.split('_')[0])
                if not db.execute('SELECT 1 FROM schema_migrations WHERE version=?', (version,)).fetchone():
                    db.executescript(migration.read_text())
            if not db.execute('SELECT 1 FROM workspace_snapshots LIMIT 1').fetchone():
                fixture = validate_workspace(json.loads((ROOT / 'content/aurelius/fixture.json').read_text()))
                self.persist(db, fixture)
        self.path.chmod(0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def state(self, db=None):
        if db is not None:
            return json.loads(db.execute('SELECT payload_json FROM workspace_snapshots ORDER BY version DESC LIMIT 1').fetchone()[0])
        with self.connect() as connection:
            return self.state(connection)

    def apply(self, command: Command):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            current = self.state(db)
            if command.expected_version != current['version']:
                raise ValueError('Workspace changed. Reload before saving.')
            # One shared command engine avoids browser/local-service provenance drift.
            # Text travels only over a local subprocess pipe; it is never put in argv or logs.
            result = subprocess.run([self.node, str(ROOT / 'scripts/aurelius-command.mjs')], input=encode({'workspace': current, 'command': command.model_dump()}), text=True, capture_output=True, timeout=10, cwd=ROOT, env={'PATH': os.defpath})
            if result.returncode:
                raise ValueError(result.stderr[:500] or 'Invalid command')
            fresh = validate_workspace(json.loads(result.stdout))
            self.persist(db, fresh)
            return fresh

    def persist(self, db, w):
        for e in w['editions']:
            db.execute('INSERT OR IGNORE INTO editions VALUES (?,?)', (e['id'], encode(e)))
        for p in w['passages']:
            db.execute('INSERT OR IGNORE INTO passages VALUES (?,?,?,?,?,?)', (p['revision_id'], p['edition_id'], p['book'], p['section'], p['text_hash'], encode(p)))
        for s in w['spans']:
            db.execute('INSERT OR IGNORE INTO source_spans VALUES (?,?,?,?,?,?)', (s['id'], s['passage_revision'], s['start'], s['end'], s['exact'], encode(s)))
        for kind, items in [('conclusion', w['conclusions']), ('expression', w['expressions'])]:
            for e in items:
                db.execute('INSERT INTO editorial_entities VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET current_revision=excluded.current_revision,locked=excluded.locked', (e['id'], kind, e['current'], int(e['locked'])))
        for r in w['revisions']:
            db.execute('INSERT OR IGNORE INTO revisions VALUES (?,?,?,?,?)', (r['id'], r['entity_id'], r['kind'], r['sequence'], encode(r)))
            for parent in r['dependencies']:
                db.execute('INSERT OR IGNORE INTO lineage VALUES (?,?)', (r['id'], parent))
        for b in w['bundles']:
            db.execute('INSERT INTO evidence_bundles VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET explanation=excluded.explanation', (b['id'], b['target_revision'], b['mode'], b['explanation']))
        for l in w['links']:
            db.execute('INSERT INTO evidence_links VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,relation=excluded.relation', (l['id'], l['source_span'], l['target_revision'], l['bundle_id'], l['relation'], encode(l)))
        for rid, a in w['assessments'].items():
            db.execute('INSERT INTO assessments VALUES (?,?,?) ON CONFLICT(revision_id) DO UPDATE SET state=excluded.state,notes=excluded.notes', (rid, a['state'], a['notes']))
        for r in w['reviews']:
            db.execute('INSERT OR IGNORE INTO reviews VALUES (?,?,?)', (r['id'], r['revision_id'], encode(r)))
        for c in w['concepts']:
            db.execute('INSERT OR IGNORE INTO concepts VALUES (?,?)', (c['id'], encode(c)))
        for m in w['memberships']:
            source = next((p['revision_id'] for p in w['passages'] if p['id'] == m.get('passage_id')), None)
            db.execute('INSERT OR IGNORE INTO memberships(id,concept_id,payload_json,passage_revision,proposition_revision) VALUES (?,?,?,?,?)', (m['id'], m['concept_id'], encode(m), source, m.get('proposition_revision')))
        for e in w['events']:
            db.execute('INSERT OR IGNORE INTO events VALUES (?,?,?)', (e['id'], w['version'], encode(e)))
        payload = encode(w)
        db.execute('INSERT INTO workspace_snapshots(version,payload_json,content_hash) VALUES (?,?,?)', (w['version'], payload, hashlib.sha256(payload.encode()).hexdigest()))
