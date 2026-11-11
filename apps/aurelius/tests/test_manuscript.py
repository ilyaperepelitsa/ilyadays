import json
import sqlite3
import pytest
from aurelius.models import Command
from aurelius.store import ROOT, Store


def test_manuscript_revisions_survive_restart_with_relational_lesson_references(tmp_path):
    source=ROOT/'content/aurelius/backup-study.json'
    store=Store(tmp_path/'data',source);w=store.state()
    c=next(c for c in w['conclusions'] if c['id']==w['study_catalog']['default_id'])
    e=next(e for e in w['expressions'] if next(r for r in w['revisions'] if r['id']==e['current'])['dependencies']==[c['current']])
    book={'title':'My principles','chapters':[{'id':'attention','title':'Attention','lessons':[{'conclusion_id':c['id'],'conclusion_revision':c['current'],'expression_revision':e['current']}]}]}
    first=store.apply(Command(id='book-first',type='manuscript',expected_version=w['version'],at='2026-11-11',payload=book))
    book['chapters'].append({'id':'pressure','title':'Under pressure','lessons':book['chapters'][0]['lessons']})
    second=store.apply(Command(id='book-second',type='manuscript',expected_version=first['version'],at='2026-11-11',payload=book))
    assert Store(tmp_path/'data',source).state()==second
    assert second['manuscript_revisions'][0]==first['manuscript_revisions'][0]
    assert second['manuscript_revisions'][1]['parent_id']==first['manuscript_current']
    assert second['assessments']==w['assessments']
    with store.connect() as db:
        assert db.execute('SELECT count(*) FROM manuscript_revisions').fetchone()[0]==2
        assert db.execute('SELECT count(*) FROM manuscript_lessons').fetchone()[0]==3
        payload=json.loads(db.execute('SELECT payload_json FROM manuscript_revisions WHERE id=?',(first['manuscript_current'],)).fetchone()[0])
        assert len(payload['chapters'])==1
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):
            db.execute('UPDATE manuscript_revisions SET payload_json=?',('{}',))
