import copy
import json
import pytest
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
