import copy
import json
import pytest
import sqlite3
from aurelius.models import Command
from aurelius.store import ROOT, Store, validate_workspace
from aurelius.study import manual_study


def backup():
    return json.loads((ROOT/'content/aurelius/backup-study.json').read_text())


def test_actual_backup_study_has_joint_premises_a_visible_bridge_and_no_automatic_approval():
    w=validate_workspace(backup())
    assert w['corpus_kind']=='public_domain_backup'
    assert w['editions'][0]['translator']=='Meric Casaubon'
    assert {(p['book'],p['section']) for p in w['passages']}=={('5','6'),('6','5'),('6','49')}
    assert len(w['propositions'])==3
    assert w['revisions'][0]['synthesis']['interpretive_step']
    assert 'do not themselves state' in w['revisions'][0]['synthesis']['what_changes']
    assert w['revisions'][0]['interpretation']=='multi_passage_synthesis'
    assert all(a['state']!='approved' for a in w['assessments'].values())
    assert any(len(m['source_span_ids'])==2 for m in w['target_mappings'])
    assert w['import_audit']['source_chunk_count']>len(w['passages'])


def test_private_store_supports_real_editions_without_fixture_upgrade_or_relabeling(tmp_path):
    seed=tmp_path/'study.json';seed.write_text(json.dumps(backup()))
    store=Store(tmp_path/'data',seed);before=store.state()
    entity=before['conclusions'][0]
    after=store.apply(Command(id='edit-real-study',type='edit',expected_version=0,at='2026-11-10',payload={'entity_id':entity['id'],'doc':before['revisions'][0]['doc'],'scope':'Changed scope must be reviewed.'}))
    assert Store(tmp_path/'data',seed).state()==after
    assert after['assessments'][after['conclusions'][0]['current']]['state']=='stale'
    assert after['passages']==before['passages']
    with store.connect() as db:
        assert db.execute('SELECT count(*) FROM propositions').fetchone()[0]==3


def test_real_edition_identity_cannot_be_obtained_by_flipping_the_corpus_tag():
    w=backup();w['corpus_kind']='hays'
    with pytest.raises(ValueError,match='identity'):validate_workspace(w)
    corpus={**copy.deepcopy(w),'editions':[{'id':'hays','translator':'Gregory Hays'}]}
    # Full modern translation study export is blocked independently of source claims.
    with pytest.raises(ValueError,match='cannot be bundled'):manual_study(corpus,'hash',public_slice=True)


def test_source_reasons_preserve_an_objection_and_an_unexplained_prescription():
    w=validate_workspace(backup())
    assert {r['kind'] for r in w['source_arguments']}=={'explicit_reason','analogy','reason_not_stated'}
    assert any('objection-and-reply' in r['limits'] for r in w['source_arguments'])
    assert any('does not explain why' in r['summary'] for r in w['source_arguments'])
    explanatory=next(e for e in w['expressions'] if e['title']=='Explanation with source reasons')
    text=next(r['text'] for r in w['revisions'] if r['id']==explanatory['current'])
    assert 'vine image' in text and 'this suggests' in text


def test_adding_reasons_keeps_old_editorial_revisions_locks_and_reviews(tmp_path):
    seed=backup();legacy=copy.deepcopy(seed)
    legacy['study_revision']=0;legacy['source_arguments']=[]
    legacy['expressions']=legacy['expressions'][:2];legacy['revisions']=legacy['revisions'][:3]
    legacy['assessments']={k:v for k,v in legacy['assessments'].items() if k in {r['id'] for r in legacy['revisions']}}
    legacy['conclusions'][0]['locked']=True
    legacy['assessments'][legacy['conclusions'][0]['current']]={'state':'approved','notes':'Preserve this reviewed revision.'}
    legacy['version']=10
    source=tmp_path/'seed.json';source.write_text(json.dumps(legacy))
    Store(tmp_path/'data',source)
    source.write_text(json.dumps(seed))
    store=Store(tmp_path/'data',source);upgraded=store.state()
    assert upgraded['version']==11 and upgraded['study_revision']==1
    assert upgraded['conclusions']==legacy['conclusions']
    assert upgraded['revisions'][:3]==legacy['revisions']
    assert upgraded['assessments'][legacy['conclusions'][0]['current']]==legacy['assessments'][legacy['conclusions'][0]['current']]
    assert len(upgraded['source_arguments'])==4
    assert all(a['status']=='proposed' for a in upgraded['source_arguments'])
    assert Store(tmp_path/'data',source).state()==upgraded
    with store.connect() as db:
        assert db.execute('SELECT count(*) FROM source_argument_spans').fetchone()[0]==4
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):
            db.execute('UPDATE source_arguments SET payload_json=?',('{}',))
