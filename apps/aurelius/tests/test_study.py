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
    assert {(p['book'],p['section']) for p in w['passages']}=={('5','6'),('6','5'),('6','49'),('1','15')}
    current=next(r for r in w['revisions'] if r['id']==w['study_catalog']['default_id']+':r1')
    assert len(current['synthesis']['premises'])==3
    assert current['synthesis']['interpretive_step']
    assert 'do not themselves state' in current['synthesis']['what_changes']
    assert current['interpretation']=='multi_passage_synthesis'
    assert all(a['state']!='approved' for a in w['assessments'].values())
    assert any(len(m['source_span_ids'])==2 for m in w['target_mappings'])
    assert w['import_audit']['source_chunk_count']>len(w['passages'])


def test_private_store_supports_real_editions_without_fixture_upgrade_or_relabeling(tmp_path):
    seed=tmp_path/'study.json';seed.write_text(json.dumps(backup()))
    store=Store(tmp_path/'data',seed);before=store.state()
    entity=before['conclusions'][0]
    after=store.apply(Command(id='edit-real-study',type='edit',expected_version=0,at='2026-11-10',payload={'entity_id':entity['id'],'doc':next(r['doc'] for r in before['revisions'] if r['id']==entity['current']),'scope':'Changed scope must be reviewed.'}))
    assert Store(tmp_path/'data',seed).state()==after
    assert after['assessments'][after['conclusions'][0]['current']]['state']=='stale'
    assert after['passages']==before['passages']
    with store.connect() as db:
        assert db.execute('SELECT count(*) FROM propositions').fetchone()[0]==len(before['propositions'])


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
    assert 'vine' in text and 'Read together' in text and 'rational awareness' in text


def test_revised_core_preserves_the_functional_reason_and_its_limits():
    w=validate_workspace(backup());primary=w['study_catalog']['default_id']
    target=next(c['current'] for c in w['conclusions'] if c['id']==primary)
    current=next(r for r in w['revisions'] if r['id']==target)
    arguments=[a for a in w['source_arguments'] if a['target_revision']==target]
    assert len(arguments)==3
    assert any('divine' in a['limits'] for a in arguments)
    assert 'normative view of human nature' in current['qualifications']
    assert 'mindless action' in current['text']
    passages={p['revision_id']:p for p in w['passages']};spans={s['id']:s for s in w['spans']}
    refs={(passages[spans[l['source_span']]['passage_revision']]['book'],passages[spans[l['source_span']]['passage_revision']]['section']) for l in w['links'] if l['target_revision']==target}
    assert refs=={('1','15'),('5','6')}


def test_adding_reasons_keeps_old_editorial_revisions_locks_and_reviews(tmp_path):
    seed=backup();legacy=json.loads((ROOT/'tests/aurelius/fixtures/legacy-backup-study-v1.json').read_text())
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
    assert upgraded['version']==11 and upgraded['study_revision']==2
    assert all(c in upgraded['conclusions'] for c in legacy['conclusions'])
    assert upgraded['study_catalog']['default_id'] in {c['id'] for c in upgraded['conclusions']}
    assert upgraded['revisions'][:3]==legacy['revisions']
    assert upgraded['assessments'][legacy['conclusions'][0]['current']]==legacy['assessments'][legacy['conclusions'][0]['current']]
    assert len(upgraded['source_arguments'])==9
    assert all(a['status']=='proposed' for a in upgraded['source_arguments'])
    assert Store(tmp_path/'data',source).state()==upgraded
    with store.connect() as db:
        assert db.execute('SELECT count(*) FROM source_argument_spans').fetchone()[0]==9
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):
            db.execute('UPDATE source_arguments SET payload_json=?',('{}',))


def test_annotation_language_persists_exact_pieces_as_immutable_proposed_records(tmp_path):
    source=tmp_path/'study.json';source.write_text(json.dumps(backup()))
    store=Store(tmp_path/'data',source);w=store.state();target=w['conclusions'][0]
    s=w['spans'][0]
    document={'format':'aurelius-annotations-v1','target_revision':target['current'],
              'pieces':[{'id':'vine','passage_revision':s['passage_revision'],'quote':s['exact'],'prefix':s['prefix'],'suffix':s['suffix'],'role':'argument','voice':'mixed','note':'Preserve the objection and reply for review.'}],
              'relations':[{'from':'vine','to':target['current'],'relation':'supports','rationale':'A proposed role, not reviewed support.'}],
              'inference':{'premises':['vine'],'rationale':'The interpretation still needs review.'}}
    after=store.apply(Command(id='annotation-save',type='annotate',expected_version=w['version'],at='2026-11-10',payload={'entity_id':target['id'],'document':document}))
    assert after['links']==w['links']
    assert after['annotation_runs'][0]['document']['review_state']=='proposed'
    assert after['assessments'][target['current']]['state']=='stale'
    assert Store(tmp_path/'data',source).state()==after
    with store.connect() as db:
        assert db.execute('SELECT exact_text FROM annotation_pieces').fetchone()[0]==s['exact']
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):db.execute('UPDATE annotation_runs SET payload_json=?',('{}',))
