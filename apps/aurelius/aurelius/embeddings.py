"""Private, content-addressed full vectors. Nothing is recomputed just to redraw a map."""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import sqlite3
import time
import uuid

import numpy as np
import tiktoken

from .analysis import corpus_identity

MODEL = 'text-embedding-3-large'
DIMENSIONS = 3072
CONFIG = {'provider': 'openai', 'model': MODEL, 'dimensions': DIMENSIONS,
          'normalization': 'identity-v1', 'input': 'exact_source_text_utf8',
          'encoding_format': 'float', 'endpoint': 'https://api.openai.com/v1/embeddings'}
PRODUCTION_CONFIG = {**CONFIG, 'transport': 'vercel_ai_gateway_production',
                     'endpoint': 'https://ai-gateway.vercel.sh/v1/embeddings',
                     'wire_model': 'openai/text-embedding-3-large', 'provider_allowlist': ['openai']}
PRICE_PER_MILLION = .13  # Official model page checked 2026-11-10; recorded with each run.
MAX_INPUT_TOKENS = 8191  # Conservative boundary below the documented 8192 maximum.
BATCH_TOKENS = 16000
BATCH_ITEMS = 32


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def fingerprint(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


CONFIG_HASH = fingerprint(CONFIG)


def input_key(text, configuration=CONFIG):
    return fingerprint({'text': text, 'configuration': configuration})


def valid_vector(value):
    vector = np.asarray(value, dtype='<f4')
    if vector.shape != (DIMENSIONS,) or not np.isfinite(vector).all() or not np.linalg.norm(vector):
        raise ValueError('Invalid embedding: require a finite nonzero 3072-dimensional vector')
    return vector


class EmbeddingCache:
    def __init__(self, directory: Path, configuration=None):
        self.configuration = dict(configuration or CONFIG)
        if self.configuration not in [CONFIG, PRODUCTION_CONFIG]:
            raise ValueError('Only the fixed full-dimensional OpenAI configurations are permitted')
        self.config_hash = fingerprint(self.configuration)
        self.wire_model = self.configuration.get('wire_model', MODEL)
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = directory/'embedding-cache.sqlite3'
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS cache_schema(version INTEGER PRIMARY KEY);
                INSERT OR IGNORE INTO cache_schema VALUES(1);
                CREATE TABLE IF NOT EXISTS vectors(
                  cache_key TEXT PRIMARY KEY,input_hash TEXT NOT NULL,configuration_hash TEXT NOT NULL,
                  dimensions INTEGER NOT NULL CHECK(dimensions=3072),vector_f32 BLOB NOT NULL,
                  vector_hash TEXT NOT NULL,metadata_json TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS source_vectors(
                  source_revision TEXT NOT NULL,cache_key TEXT NOT NULL REFERENCES vectors(cache_key),
                  input_hash TEXT NOT NULL,PRIMARY KEY(source_revision,cache_key));
                CREATE TABLE IF NOT EXISTS requests(
                  id TEXT PRIMARY KEY,run_id TEXT NOT NULL,state TEXT NOT NULL,
                  reserved_tokens INTEGER NOT NULL,reserved_usd REAL NOT NULL,
                  observed_tokens INTEGER,observed_usd REAL,metadata_json TEXT NOT NULL,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
                CREATE TRIGGER IF NOT EXISTS vector_immutable_update BEFORE UPDATE ON vectors
                  BEGIN SELECT RAISE(ABORT,'cached vectors are immutable'); END;
                CREATE TRIGGER IF NOT EXISTS vector_immutable_delete BEFORE DELETE ON vectors
                  BEGIN SELECT RAISE(ABORT,'cached vectors are immutable'); END;
            ''')
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

    def get(self, text):
        key = input_key(text, self.configuration)
        with self.connect() as db:
            row = db.execute('SELECT vector_f32,vector_hash,configuration_hash FROM vectors WHERE cache_key=?', (key,)).fetchone()
        if not row:
            return None
        if hashlib.sha256(row[0]).hexdigest() != row[1] or row[2] != self.config_hash:
            raise ValueError('Cached embedding integrity failure; refusing silent replacement')
        return valid_vector(np.frombuffer(row[0], dtype='<f4')).copy()

    def put(self, passage, vector, metadata):
        vector = valid_vector(vector)
        raw = vector.tobytes()
        key = input_key(passage['text'], self.configuration)
        text_hash = hashlib.sha256(passage['text'].encode()).hexdigest()
        if passage['text_hash'] != text_hash:
            raise ValueError('Embedding source/hash mismatch')
        with self.connect() as db:
            prior = db.execute('SELECT vector_hash FROM vectors WHERE cache_key=?', (key,)).fetchone()
            if prior and prior[0] != hashlib.sha256(raw).hexdigest():
                raise ValueError('Existing vectors cannot be overwritten by a repeated API result')
            db.execute('INSERT OR IGNORE INTO vectors(cache_key,input_hash,configuration_hash,dimensions,vector_f32,vector_hash,metadata_json) VALUES(?,?,?,?,?,?,?)',
                       (key, text_hash, self.config_hash, DIMENSIONS, raw, hashlib.sha256(raw).hexdigest(), canonical({**metadata, 'configuration': self.configuration})))
            db.execute('INSERT OR IGNORE INTO source_vectors VALUES(?,?,?)', (passage['revision_id'], key, text_hash))

    def plan(self, passages):
        encoder = tiktoken.encoding_for_model(MODEL)
        pending, cached, seen, invalid = [], 0, set(), []
        for p in passages:
            if hashlib.sha256(p['text'].encode()).hexdigest() != p['text_hash']:
                raise ValueError('Source text/hash mismatch; do not embed a mutable passage identity')
            tokens = len(encoder.encode(p['text'], disallowed_special=()))
            if not p['text'].strip() or not 0 < tokens <= MAX_INPUT_TOKENS:
                invalid.append({'revision_id': p['revision_id'], 'tokens': tokens, 'reason': 'empty_or_over_limit; split at a meaningful boundary, retaining the canonical parent'})
                continue
            if self.get(p['text']) is not None:
                cached += 1
                continue
            key = input_key(p['text'], self.configuration)
            if key not in seen:
                pending.append((p, tokens))
                seen.add(key)
        batches, current, count = [], [], 0
        for item in pending:
            if current and (len(current) >= BATCH_ITEMS or count+item[1] > BATCH_TOKENS):
                batches.append(current)
                current, count = [], 0
            current.append(item)
            count += item[1]
        if current:
            batches.append(current)
        total = sum(n for _, n in pending)
        return {'configuration': self.configuration, 'configuration_hash': self.config_hash,
                'corpus_hash': corpus_identity(passages), 'chunks': len(passages),
                'cached_chunks': cached, 'uncached_unique_inputs': len(pending),
                'input_tokens': total, 'estimated_usd': total*PRICE_PER_MILLION/1e6,
                'price_per_million_usd': PRICE_PER_MILLION, 'price_checked_at': '2026-11-10',
                'batch_count': len(batches), 'invalid_inputs': invalid,
                'tokenizer_version': tiktoken.__version__, 'batches': batches}

    def reserve(self, run_id, tokens, token_cap, cost_cap, metadata):
        cost = tokens*PRICE_PER_MILLION/1e6
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            used_tokens, used_cost = db.execute('SELECT coalesce(sum(reserved_tokens),0),coalesce(sum(reserved_usd),0) FROM requests WHERE run_id=?', (run_id,)).fetchone()
            if used_tokens+tokens > token_cap or used_cost+cost > cost_cap+1e-12:
                raise ValueError('Approved embedding budget exhausted; no request was made')
            request_id = uuid.uuid4().hex
            db.execute('INSERT INTO requests(id,run_id,state,reserved_tokens,reserved_usd,metadata_json) VALUES(?,?,?,?,?,?)',
                       (request_id, run_id, 'reserved', tokens, cost, canonical(metadata)))
            return request_id

    def complete_request(self, request_id, state, metadata, observed_tokens=None):
        with self.connect() as db:
            db.execute('UPDATE requests SET state=?,metadata_json=?,observed_tokens=?,observed_usd=? WHERE id=?',
                       (state, canonical(metadata), observed_tokens, None if observed_tokens is None else observed_tokens*PRICE_PER_MILLION/1e6, request_id))

    def embed(self, passages, client, approval, cancel=lambda: False, sleep=time.sleep):
        plan = self.plan(passages)
        if not approval.get('segmentation_reviewed') or not approval.get('external_processing_approved') or approval.get('corpus_hash') != plan['corpus_hash']:
            raise ValueError('Exact-corpus segmentation review and external-processing approval are required')
        token_cap, cost_cap = approval.get('token_budget', 0), approval.get('cost_budget_usd', 0)
        if not isinstance(token_cap, int) or token_cap <= 0 or not isinstance(cost_cap, (int, float)) or not np.isfinite(cost_cap) or cost_cap <= 0:
            raise ValueError('Explicit positive token and USD caps are required')
        if plan['invalid_inputs']:
            raise ValueError('Unresolved over-limit/empty chunks; nothing was silently truncated')
        if plan['input_tokens'] > token_cap or plan['estimated_usd'] > cost_cap:
            raise ValueError('Approved budget is below the remaining run estimate; no request was made')
        run_id = fingerprint({'corpus_hash': plan['corpus_hash'], 'configuration_hash': self.config_hash})
        for batch in plan['batches']:
            texts = [p['text'] for p, _ in batch]
            tokens = sum(n for _, n in batch)
            for attempt in range(3):
                if cancel():
                    return {'state': 'canceled', 'run_id': run_id}
                meta = {'run_id': run_id, 'configuration': self.configuration, 'source_revisions': [p['revision_id'] for p, _ in batch], 'attempt': attempt+1,
                        'approval': approval, 'billing_outcome': 'unconfirmed'}
                request_id = self.reserve(run_id, tokens, token_cap, cost_cap, meta)
                try:
                    response = client.embeddings.create(model=self.wire_model, dimensions=DIMENSIONS, input=texts, encoding_format='float')
                except Exception as error:
                    status = getattr(error, 'status_code', None)
                    unknown = status is None or status >= 500
                    self.complete_request(request_id, 'outcome_unknown' if unknown else 'failed', {**meta, 'status_code': status, 'error_type': type(error).__name__, 'billing_outcome': 'unknown' if unknown else 'request_rejected'})
                    # Network failures can be billed even though no vector arrived. Expose
                    # that uncertainty and require an operator resume, rather than promise exactly-once billing.
                    if status == 429 and attempt < 2:
                        sleep(2**attempt)
                        continue
                    raise RuntimeError(f'Embedding request stopped ({type(error).__name__}); billing outcome {"unknown" if unknown else "rejected"}. Cached successes are retained.') from None
                try:
                    if response.model != self.wire_model or len(response.data) != len(batch):
                        raise ValueError('Unexpected embedding model or response count')
                    ordered = sorted(response.data, key=lambda row: row.index)
                    if [row.index for row in ordered] != list(range(len(batch))):
                        raise ValueError('Duplicate or missing embedding result index')
                    vectors = [valid_vector(row.embedding) for row in ordered]
                    usage = response.usage.total_tokens
                    if not isinstance(usage, int) or usage < 0:
                        raise ValueError('Invalid observed token usage')
                    provider_metadata = getattr(response, 'provider_metadata', None)
                    for (passage, _), vector in zip(batch, vectors):
                        self.put(passage, vector, {'request_id': getattr(response, '_request_id', None), 'returned_model': response.model, 'run_id': run_id, 'input_tokens_batch': usage, 'provider_metadata':provider_metadata})
                    self.complete_request(request_id, 'succeeded', {**meta, 'returned_model': response.model, 'request_id': getattr(response, '_request_id', None), 'billing_outcome': 'observed', 'provider_metadata':provider_metadata}, usage)
                except (ValueError, TypeError, AttributeError) as error:
                    self.complete_request(request_id, 'validation_failed', {**meta, 'error_type': type(error).__name__, 'billing_outcome': 'response_received; usage may be billable'})
                    raise
                break
        # Also associate identical inputs/revisions that shared a request/cache entry.
        for passage in passages:
            vector = self.get(passage['text'])
            if vector is None:
                raise ValueError('Embedding run is incomplete')
            with self.connect() as db:
                db.execute('INSERT OR IGNORE INTO source_vectors VALUES(?,?,?)', (passage['revision_id'], input_key(passage['text'], self.configuration), passage['text_hash']))
        return {'state': 'complete', 'run_id': run_id, 'plan': {k: v for k, v in self.plan(passages).items() if k != 'batches'}}

    def matrix(self, passages):
        vectors = [self.get(p['text']) for p in passages]
        if any(v is None for v in vectors):
            raise ValueError('Real embeddings incomplete. Run the approved embedding job; there is no lexical fallback.')
        return np.stack(vectors)
