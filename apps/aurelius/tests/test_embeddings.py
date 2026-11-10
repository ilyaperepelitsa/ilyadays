"""Mocked adapter tests; no API key, paid calls, or real translation needed."""
import hashlib
from types import SimpleNamespace
import numpy as np
import pytest
from aurelius.embeddings import CONFIG, DIMENSIONS, MODEL, EmbeddingCache, input_key
from aurelius.analysis import corpus_identity, analyze_embeddings


def passages(n=4):
    return [{'id':f'test-{i}', 'revision_id':f'test-{i}:r1', 'book':'1', 'section':str(i+1), 'text':f'Original fixture proposition number {i}: keep qualifications visible.', 'text_hash':hashlib.sha256(f'Original fixture proposition number {i}: keep qualifications visible.'.encode()).hexdigest()} for i in range(n)]


def approval(items, **overrides):
    return {'corpus_hash':corpus_identity(items), 'segmentation_reviewed':True,
            'external_processing_approved':True, 'token_budget':100000, 'cost_budget_usd':1, **overrides}


class MockClient:
    def __init__(self):
        self.calls=[]
        self.embeddings=self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        assert kwargs['model']==MODEL and kwargs['dimensions']==DIMENSIONS
        rows=[]
        for i,text in enumerate(kwargs['input']):
            rng=np.random.default_rng(int(hashlib.sha256(text.encode()).hexdigest()[:8],16))
            vector=rng.normal(size=DIMENSIONS);vector/=np.linalg.norm(vector)
            rows.append(SimpleNamespace(index=i,embedding=vector.tolist()))
        return SimpleNamespace(model=MODEL,data=list(reversed(rows)),usage=SimpleNamespace(total_tokens=len(rows)*10),_request_id='mock-request')


def test_restart_and_editorial_changes_never_reembed_unchanged_source(tmp_path):
    cache=EmbeddingCache(tmp_path);items=passages();client=MockClient()
    cache.embed(items,client,approval(items))
    before=cache.matrix(items).copy()
    cache=EmbeddingCache(tmp_path)
    cache.embed(items,client,approval(items))
    assert len(client.calls)==1 and np.array_equal(cache.matrix(items),before)
    assert cache.plan(items)['input_tokens']==0
    changed={**items[0],'revision_id':'test-0:r2','text':'A changed original test proposition.'}
    changed['text_hash']=hashlib.sha256(changed['text'].encode()).hexdigest()
    current=[changed,*items[1:]]
    cache.embed(current,client,approval(current))
    assert len(client.calls)==2 and len(client.calls[-1]['input'])==1
    assert np.array_equal(cache.matrix(items),before)  # Previous source revision still resolves.
    assert input_key(changed['text'])!=input_key(items[0]['text'])


def test_identical_input_deduplicates_but_source_revision_associations_remain(tmp_path):
    items=passages(1);items.append({**items[0],'id':'copy','revision_id':'copy:r1'})
    cache=EmbeddingCache(tmp_path);client=MockClient();cache.embed(items,client,approval(items))
    assert len(client.calls[0]['input'])==1
    with cache.connect() as db:
        assert db.execute('SELECT count(*) FROM source_vectors').fetchone()[0]==2


def test_approval_budget_and_input_limits_prevent_unapproved_requests(tmp_path):
    cache=EmbeddingCache(tmp_path);items=passages();client=MockClient()
    for values in [approval(items,external_processing_approved=False),approval(items,segmentation_reviewed=False),approval(items,corpus_hash='wrong'),approval(items,cost_budget_usd=1e-12),approval(items,token_budget=1)]:
        with pytest.raises(ValueError):cache.embed(items,client,values)
    assert not client.calls
    too_long={**items[0],'text':'word '*10000}
    too_long['text_hash']=hashlib.sha256(too_long['text'].encode()).hexdigest()
    assert cache.plan([too_long])['invalid_inputs']
    with pytest.raises(ValueError,match='truncated'):cache.embed([too_long],client,approval([too_long]))
    assert not client.calls


def test_cancellation_and_restart_preserve_successful_batches(tmp_path):
    cache=EmbeddingCache(tmp_path);items=passages(40);client=MockClient()
    result=cache.embed(items,client,approval(items),cancel=lambda:bool(client.calls))
    assert result['state']=='canceled' and len(client.calls)==1
    cached=cache.plan(items)['cached_chunks'];assert cached==32
    cache=EmbeddingCache(tmp_path);cache.embed(items,client,approval(items))
    assert len(client.calls)==2 and len(client.calls[1]['input'])==8


def test_unknown_billing_stops_and_is_recorded_without_leaking_error_body(tmp_path):
    cache=EmbeddingCache(tmp_path);items=passages();client=MockClient()
    def fail(**kwargs):raise ConnectionError('sensitive upstream content must not be printed')
    client.create=fail
    with pytest.raises(RuntimeError,match='billing outcome unknown') as error:cache.embed(items,client,approval(items))
    assert 'sensitive' not in str(error.value)
    with cache.connect() as db:
        state,token_count=db.execute('SELECT state,reserved_tokens FROM requests').fetchone()
        assert state=='outcome_unknown' and token_count>0


def test_bad_response_cannot_be_cached_as_real_vectors(tmp_path):
    cache=EmbeddingCache(tmp_path);items=passages();client=MockClient();original=client.create
    def invalid(**kwargs):
        response=original(**kwargs);response.data[0].embedding=[1,2];return response
    client.create=invalid
    with pytest.raises(ValueError,match='3072'):cache.embed(items,client,approval(items))
    assert cache.plan(items)['cached_chunks']==0


def test_rate_limit_retries_are_bounded_and_each_attempt_reserves_budget(tmp_path):
    cache=EmbeddingCache(tmp_path);items=passages();client=MockClient();original=client.create
    class RateLimit(Exception):status_code=429
    attempts=[];delays=[]
    def limited(**kwargs):
        attempts.append(1)
        if len(attempts)<3:raise RateLimit()
        return original(**kwargs)
    client.create=limited
    cache.embed(items,client,approval(items),sleep=delays.append)
    assert len(attempts)==3 and delays==[1,2]
    with cache.connect() as db:
        assert [r[0] for r in db.execute('SELECT state FROM requests ORDER BY rowid')]==['failed','failed','succeeded']


def test_exhausted_retry_budget_and_different_repeated_vectors_do_not_override_cache(tmp_path):
    cache=EmbeddingCache(tmp_path);items=passages();client=MockClient()
    tokens=cache.plan(items)['input_tokens'];calls=[]
    class RateLimit(Exception):status_code=429
    def limited(**kwargs):calls.append(1);raise RateLimit()
    client.create=limited
    with pytest.raises(ValueError,match='budget exhausted'):
        cache.embed(items,client,approval(items,token_budget=tokens),sleep=lambda _:None)
    assert len(calls)==1
    cache.embed(items,MockClient(),approval(items))
    before=cache.get(items[0]['text'])
    with pytest.raises(ValueError,match='cannot be overwritten'):
        cache.put(items[0],before*.5,{'mock':True})
    assert np.array_equal(cache.get(items[0]['text']),before)


def test_real_pca_requires_complete_full_vectors_and_does_not_publish_text(tmp_path):
    items=passages();cache=EmbeddingCache(tmp_path)
    with pytest.raises(ValueError,match='no lexical fallback'):cache.matrix(items)
    cache.embed(items,MockClient(),approval(items))
    corpus={'corpus_kind':'hays','passages':items,'editions':[{'id':'mock-edition','translator':'Fixture author'}]}
    artifact,arrays=analyze_embeddings(corpus,cache.matrix(items),CONFIG)
    assert artifact['vector_origin']=='openai' and artifact['chunk_count']==len(items)
    assert arrays['vectors'].shape==(len(items),3072)
    assert all('text' not in point and 'raw_text' not in point for point in artifact['points'])
    assert np.allclose((arrays['vectors']-arrays['mean'])@arrays['components'].T,arrays['coordinates'])
    with pytest.raises(ValueError,match='one full vector'):analyze_embeddings(corpus,cache.matrix(items)[:,:2],CONFIG)
