import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {annotationDraft,parseAnnotations,applyCommand,plainDoc} from '../../src/lib/aurelius/domain.mjs';
const seed=()=>JSON.parse(fs.readFileSync(new URL('../../content/aurelius/backup-study.json',import.meta.url),'utf8'));
const cmd=(w,type,payload,id)=>({id,type,payload,expected_version:w.version,at:'2026-11-10'});
test('annotation language preserves exact source pieces and marks mixed speech without certifying meaning',async()=>{
 const w=seed(),r=w.conclusions[0].current,text=annotationDraft(w,r),result=await parseAnnotations(w,text,r);
 assert.equal(result.review_state,'proposed');assert.equal(result.validation,'exact_anchors_validated');
 assert.ok(result.markup.pieces.some(p=>p.role==='analogy'));assert.ok(result.markup.pieces.some(p=>p.voice==='mixed'));
 for(const p of result.markup.pieces)assert.equal(result.anchors[p.id].exact,p.quote);
});
test('invented quotes, missing context, unknown roles, references, fields and argument cycles fail',async()=>{
 const w=seed(),r=w.conclusions[0].current,base=JSON.parse(annotationDraft(w,r));
 for(const mutate of [d=>d.pieces[0].quote='An invented quotation.',d=>d.pieces[0].prefix='invented context',d=>d.pieces[0].role='proven_fact',d=>d.pieces[0].voice='Marcus-certified',d=>d.relations[0].to='missing',d=>d.approved=true,d=>d.pieces.push({...d.pieces[0]}),d=>d.relations.push({from:'piece1',to:'piece2',relation:'supports',rationale:'loop one'},{from:'piece2',to:'piece1',relation:'supports',rationale:'loop two'})]){const d=structuredClone(base);mutate(d);await assert.rejects(parseAnnotations(w,d,r));}
});
test('annotation revisions persist separately, invalidate support and never overwrite evidence or transfer to changed meanings',async()=>{
 const w=seed(),e=w.conclusions[0],text=annotationDraft(w,e.current);
 const saved=await applyCommand(w,cmd(w,'annotate',{entity_id:e.id,document:JSON.parse(text)},'annotated'));
 assert.equal(saved.annotation_runs.length,1);assert.deepEqual(saved.links,w.links);assert.equal(saved.assessments[e.current].state,'stale');assert.equal(saved.assessments[w.expressions[0].current].state,'stale');
 const edited=await applyCommand(saved,cmd(saved,'edit',{entity_id:e.id,doc:plainDoc('Changed scope needs new annotations.','changed')},'changed-meaning'));
 assert.equal(edited.annotation_runs[0].target_revision,e.current);
 await assert.rejects(applyCommand(edited,cmd(edited,'annotate',{entity_id:e.id,document:JSON.parse(text)},'old-target')),/target revision/);
 const locked=await applyCommand(w,cmd(w,'lock',{entity_id:e.id,locked:true},'locked-annotation'));
 await assert.rejects(applyCommand(locked,cmd(locked,'annotate',{entity_id:e.id,document:JSON.parse(text)},'cannot-annotate')),/Unlock/);
});
