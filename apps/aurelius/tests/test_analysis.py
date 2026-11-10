import hashlib
import json
from pathlib import Path
import numpy as np
import pytest
from aurelius.analysis import analyze_fixture,project_vectors
from aurelius.store import ROOT,Store


def fixture():
    return json.loads((ROOT/'content/aurelius/fixture.json').read_text())


def test_checked_in_projection_is_an_actual_fit_over_every_full_vector():
    w=fixture()
    artifact=json.loads((ROOT/'content/aurelius/analysis.json').read_text())
    with np.load(ROOT/'art/aurelius/fixture-analysis.npz') as arrays:
        vectors=arrays['vectors']
        assert vectors.shape==(len(w['passages']),3072)
        assert list(arrays['row_ids'])==[p['revision_id'] for p in w['passages']]
        assert np.isfinite(vectors).all()
        assert np.allclose(np.linalg.norm(vectors,axis=1),1)
        coordinates=(vectors.astype(np.float64)-arrays['mean'])@arrays['components'].T
        assert np.allclose(coordinates,arrays['coordinates'],atol=1e-10)
        assert np.allclose(coordinates,[[p['x'],p['y']] for p in artifact['points']],atol=1e-10)
        variance=np.var(coordinates,axis=0,ddof=1)
        assert np.allclose(variance,artifact['pca']['explained_variance'])
        assert np.allclose(variance/np.var(vectors.astype(np.float64),axis=0,ddof=1).sum(),artifact['pca']['explained_variance_ratio'])
    assert artifact['chunk_count']==len(w['passages'])
    assert len(artifact['clustering']['children'])==len(w['passages'])-1
    assert not artifact['sampled'] and not artifact['excluded_chunks']


def test_clustering_receives_full_space_instead_of_two_projection_columns(monkeypatch):
    import aurelius.analysis as module
    original=module.AgglomerativeClustering
    dimensions=[]
    class Recorder:
        def __init__(self,**kwargs):self.actual=original(**kwargs)
        def fit(self,x):dimensions.append(x.shape[1]);return self.actual.fit(x)
        def fit_predict(self,x):dimensions.append(x.shape[1]);return self.actual.fit_predict(x)
    monkeypatch.setattr(module,'AgglomerativeClustering',Recorder)
    project_vectors(np.random.default_rng(41).uniform(.1,1,(8,24)))
    assert dimensions and set(dimensions)=={24}


@pytest.mark.parametrize('x',[np.ones((4,3)),np.zeros((4,3)),np.array([[1,2],[np.nan,3],[4,5]]),np.ones((2,4))])
def test_invalid_or_uninformative_inputs_fail_instead_of_faking_a_map(x):
    with pytest.raises(ValueError):project_vectors(x)


def test_analysis_covers_extra_chunk_and_changes_its_input_identity():
    w=fixture();first,_=analyze_fixture(w)
    p={**w['passages'][0],'id':'new-chunk','revision_id':'new-chunk:r1','text':'A new synthetic chunk asks how fair cooperation changes when circumstances change.'}
    p['text_hash']=hashlib.sha256(p['text'].encode()).hexdigest();w['passages'].append(p)
    second,_=analyze_fixture(w)
    assert second['chunk_count']==first['chunk_count']+1
    assert second['corpus_hash']!=first['corpus_hash']
    assert second['run_id']!=first['run_id']
    assert second['points'][-1]['revision_id']==p['revision_id']
    with pytest.raises(ValueError,match='cannot replace'):analyze_fixture({**w,'corpus_kind':'hays'})


def test_private_analysis_is_cached_and_recorded_without_external_calls(tmp_path):
    store=Store(tmp_path)
    first=store.analysis();second=store.analysis()
    assert first==second
    assert len(list((tmp_path/'analysis').rglob('arrays.npz')))==1
    with store.connect() as db:
        assert db.execute('SELECT count(*) FROM analysis_runs').fetchone()[0]==1
    assert first['chunk_count']==len(store.state()['passages'])
