from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import threading

from .anchors import validate_anchor
from .models import Command, Workspace

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parents[1]


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def validate_workspace(value):
    workspace = Workspace.model_validate(value).model_dump()
    if workspace['corpus_kind'] != 'synthetic':
        expected = 'Gregory Hays' if workspace['corpus_kind'] == 'hays' else 'Meric Casaubon'
        if not workspace['editions'] or any(e.get('translator') != expected for e in workspace['editions']):
            raise ValueError('Real corpus edition/translator identity is required')
        if workspace['corpus_kind'] == 'hays' and any(e.get('isbn') != '9781588361738' for e in workspace['editions']):
            raise ValueError('Selected Hays ebook identity is required')
    passages = {p['revision_id']: p for p in workspace['passages']}
    for span in workspace['spans']:
        validate_anchor(passages[span['passage_revision']], span)
    # Immutable revision order is also the topological order of derivation.
    seen = set()
    for revision in workspace['revisions']:
        if revision['id'] in seen or any(source not in seen for source in revision['dependencies']):
            raise ValueError('Lineage must reference earlier immutable revisions')
        seen.add(revision['id'])
    for argument in workspace['source_arguments']:
        target = next((r for r in workspace['revisions'] if r['id'] == argument['target_revision']), None)
        if not target or target['kind'] != 'conclusion' or argument['kind'] not in ['explicit_reason','analogy','reason_not_stated'] or not argument['source_span_ids'] or any(sid not in {s['id'] for s in workspace['spans']} for sid in argument['source_span_ids']):
            raise ValueError('Invalid source reasoning references')
    for mapping in workspace['target_mappings']:
        target = next((r for r in workspace['revisions'] if r['id'] == mapping['target_revision']), None)
        block = next((b for b in target['doc']['content'] if b['attrs']['id'] == mapping['block_id']), None) if target else None
        text = ''.join(n.get('text', '') for n in block.get('content', [])) if block else ''
        if not block or not 0 <= mapping['start'] < mapping['end'] <= len(text) or text[mapping['start']:mapping['end']] != mapping['exact']:
            raise ValueError('Invalid exact target mapping')
        if not mapping['source_span_ids'] or any(sid not in {s['id'] for s in workspace['spans']} for sid in mapping['source_span_ids']):
            raise ValueError('Unknown target-mapping source')
    return workspace


class Store:
    def __init__(self, directory: Path, workspace_file: Path | None = None):
        directory = directory.resolve()
        if any(directory.is_relative_to(ROOT / name) for name in ['public', 'src', 'content']):
            raise ValueError('Private data must be outside published source and assets')
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = directory / 'aurelius.sqlite3'
        self.analysis_lock = threading.Lock()
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
                fixture = validate_workspace(json.loads((workspace_file or ROOT / 'content/aurelius/fixture.json').read_text()))
                self.persist(db, fixture)
            elif self.state(db)['corpus_kind'] == 'synthetic':
                current = self.state(db)
                result = subprocess.run([self.node, str(ROOT / 'scripts/aurelius-upgrade.mjs')], input=encode(current), text=True, capture_output=True, timeout=10, cwd=ROOT, env={'PATH': os.defpath})
                if result.returncode:
                    raise ValueError(result.stderr[:500])
                upgraded = validate_workspace(json.loads(result.stdout))
                if upgraded['version'] != current['version']:
                    self.persist(db, upgraded)
            elif workspace_file:
                current = self.state(db)
                seed = validate_workspace(json.loads(workspace_file.read_text()))
                result = subprocess.run([self.node, str(ROOT / 'scripts/aurelius-upgrade.mjs')], input=encode({'mode':'study','workspace':current,'seed':seed}), text=True, capture_output=True, timeout=10, cwd=ROOT, env={'PATH':os.defpath})
                if result.returncode:
                    raise ValueError(result.stderr[:500])
                upgraded = validate_workspace(json.loads(result.stdout))
                if upgraded['version'] != current['version']:
                    self.persist(db, upgraded)
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

    def analysis(self):
        from .analysis import PIPELINE_VERSION, corpus_identity, write_fixture_analysis
        import numpy as np
        import sklearn
        with self.analysis_lock:
            w = self.state()
            if w['corpus_kind'] != 'synthetic':
                from .embeddings import CONFIG, CONFIG_HASH, EmbeddingCache
                from .analysis import analyze_embeddings
                vectors = EmbeddingCache(ROOT / '.aurelius/vectors').matrix(w['passages'])
                key = hashlib.sha256((corpus_identity(w['passages']) + CONFIG_HASH + np.__version__ + sklearn.__version__).encode()).hexdigest()
                directory = self.path.parent / 'analysis' / key
                metadata = directory / 'projection.json'
                if metadata.exists():
                    return json.loads(metadata.read_text())
                result, arrays = analyze_embeddings(w, vectors, CONFIG)
                directory.mkdir(parents=True, exist_ok=True, mode=0o700)
                np.savez_compressed(directory / 'arrays.npz', **arrays)
                metadata.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
                with self.connect() as db:
                    db.execute('INSERT OR IGNORE INTO analysis_runs VALUES (?,?,?,?)', (result['run_id'], 'pca_cluster', encode(CONFIG), encode(result)))
                return result
            key = hashlib.sha256((corpus_identity(w['passages']) + PIPELINE_VERSION + np.__version__ + sklearn.__version__).encode()).hexdigest()
            directory = self.path.parent / 'analysis' / key
            metadata = directory / 'projection.json'
            if metadata.exists():
                return json.loads(metadata.read_text())
            result = write_fixture_analysis(w, metadata, directory / 'arrays.npz')
            with self.connect() as db:
                db.execute('INSERT OR IGNORE INTO analysis_runs VALUES (?,?,?,?)', (result['run_id'], 'pca_cluster', encode({'corpus_hash':result['corpus_hash'],'pipeline':PIPELINE_VERSION}), encode(result)))
            return result

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
        for m in w.get('target_mappings', []):
            db.execute('INSERT OR IGNORE INTO target_mappings VALUES (?,?,?,?,?,?,?)', (m['id'], m['target_revision'], m['block_id'], m['start'], m['end'], m['exact'], encode(m)))
            for sid in m['source_span_ids']:
                db.execute('INSERT OR IGNORE INTO target_mapping_sources VALUES (?,?)', (m['id'], sid))
        for rid, a in w['assessments'].items():
            db.execute('INSERT INTO assessments VALUES (?,?,?) ON CONFLICT(revision_id) DO UPDATE SET state=excluded.state,notes=excluded.notes', (rid, a['state'], a['notes']))
        for r in w['reviews']:
            db.execute('INSERT OR IGNORE INTO reviews VALUES (?,?,?)', (r['id'], r['revision_id'], encode(r)))
        for c in w['concepts']:
            db.execute('INSERT OR IGNORE INTO concepts VALUES (?,?)', (c['id'], encode(c)))
        for p in w.get('propositions', []):
            db.execute('INSERT OR IGNORE INTO propositions VALUES (?,?,?)', (p['id'], p['revision_id'], encode(p)))
        for a in w.get('source_arguments', []):
            db.execute('INSERT OR IGNORE INTO source_arguments VALUES (?,?,?,?,?)', (a['id'], a['revision_id'], a['target_revision'], a['kind'], encode(a)))
            for sid in a['source_span_ids']:
                db.execute('INSERT OR IGNORE INTO source_argument_spans VALUES (?,?)', (a['id'], sid))
        for m in w['memberships']:
            source = next((p['revision_id'] for p in w['passages'] if p['id'] == m.get('passage_id')), None)
            db.execute('INSERT OR IGNORE INTO memberships(id,concept_id,payload_json,passage_revision,proposition_revision) VALUES (?,?,?,?,?)', (m['id'], m['concept_id'], encode(m), source, m.get('proposition_revision')))
        for e in w['events']:
            db.execute('INSERT OR IGNORE INTO events VALUES (?,?,?)', (e['id'], w['version'], encode(e)))
        payload = encode(w)
        db.execute('INSERT INTO workspace_snapshots(version,payload_json,content_hash) VALUES (?,?,?)', (w['version'], payload, hashlib.sha256(payload.encode()).hexdigest()))
