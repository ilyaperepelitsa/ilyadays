import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyCommand,validateAnchor,plainDoc,preferredSourceLink} from '../../src/lib/aurelius/domain.mjs';
import {validateReferenceDiscovery} from '../../src/lib/aurelius/discovery.mjs';
import {upgradeStudy} from '../../src/lib/aurelius/study-upgrade.mjs';
const study=()=>JSON.parse(fs.readFileSync(new URL('../../content/aurelius/backup-study.json',import.meta.url),'utf8'));
const command=(w,type,payload,id)=>({id,type,payload,expected_version:w.version,at:'2026-11-10T00:00:00Z'});

test('map source navigation preserves the selected study and prefers revised studies over previous proposals',()=>{
 const w=study(),main=w.conclusions.find(c=>c.id===w.study_catalog.default_id),previous=w.conclusions.find(c=>w.study_catalog.previous_ids.includes(c.id));
 const giving=w.passages.find(p=>p.book==='5'&&p.section==='6'),revenge=w.passages.find(p=>p.book==='6'&&p.section==='5');
 assert.equal(preferredSourceLink(w,giving.revision_id,main.current).target_revision,main.current);
 assert.equal(preferredSourceLink(w,giving.revision_id,previous.current).target_revision,previous.current);
 const chosen=preferredSourceLink(w,revenge.revision_id,main.current);assert.equal(w.conclusions.find(c=>c.current===chosen.target_revision).id,'casaubon-gutenberg-2680-non-imitation');
 assert.equal(preferredSourceLink(w,'a-source-with-no-evidence',main.current),undefined);
});

test('published real maps match both complete inspected editions and exclude private text, full vectors and credentials',()=>{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../../content/aurelius/'+name,import.meta.url),'utf8'));
 const manifest=read('production-inputs.json'),status=read('processing-status.json');
 assert.equal(manifest.execution_enabled,false);assert.equal(status.state,'complete');assert.equal(status.network_requests_on_restart,0);
 for(const [file,key,kind]of [['real-map.json','primary','hays'],['backup-map.json','backup','public_domain_backup']]){
  const a=read(file);assert.equal(validateReferenceDiscovery(a),true);assert.equal(a.corpus_kind,kind);
  const imported=manifest.corpora.find(c=>c.edition_id===a.edition.id);assert.equal(a.chunk_count,imported.sections);assert.equal(a.corpus_hash,imported.corpus_hash);
  assert.equal(status.corpora[key].cached_vectors,a.chunk_count);assert.equal(status.corpora[key].vector_hash,a.vector_hash);
  assert.equal(a.pca.explained_variance_ratio.length,2);assert.ok(a.pca.explained_variance_ratio.every(v=>v>0&&v<1));
  const inspect=value=>{if(value&&typeof value==='object')for(const [name,v]of Object.entries(value)){assert.ok(!['text','raw_text','source_text','input_text','vectors','components','mean','vector_f32','api_key','credential','secret'].includes(name),`Private field in public artifact: ${name}`);inspect(v);}};inspect(a);
 }
});

test('revised study uses social-purpose premises and keeps revenge and common-good claims separate',()=>{
 const w=study(),current=w.study_catalog.current_ids;assert.equal(current.length,3);
 const sources=id=>w.links.filter(l=>l.target_revision===w.conclusions.find(c=>c.id===id).current).map(l=>{const span=w.spans.find(s=>s.id===l.source_span);const p=w.passages.find(p=>p.revision_id===span.passage_revision);return `${p.book}.${p.section}`;});
 assert.deepEqual(new Set(sources(current[0])),new Set(['1.15','5.6']));assert.deepEqual(sources(current[1]),['6.5']);assert.deepEqual(sources(current[2]),['6.49']);
 const main=w.conclusions.find(c=>c.id===current[0]);assert.ok(w.links.some(l=>l.target_revision===main.current&&l.relation==='qualifies'));
 assert.ok(w.spans.some(s=>s.start>0&&s.end<w.passages.find(p=>p.revision_id===s.passage_revision).text.length));
 const expr=w.expressions.find(e=>w.revisions.find(r=>r.id===e.current).dependencies.includes(main.current));
 const contributorSets=w.revisions.find(r=>r.id===expr.current).doc.content[0].content.map(n=>n.marks[0].attrs.sourceSpanIds);
 assert.ok(contributorSets.some(ids=>ids.length===2));assert.ok(contributorSets.some(ids=>ids.length===1));
});

test('the shipped previous study upgrades additively and retains user revisions, decisions and selection identity',async()=>{
 const old=JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-backup-study-v1.json',import.meta.url),'utf8')),id=old.conclusions[0].id;
 let saved=await applyCommand(old,command(old,'edit',{entity_id:id,doc:plainDoc('My interpretation, kept for later review.','user-block')},'my-study-edit'));
 saved=await applyCommand(saved,command(saved,'lock',{entity_id:id,locked:true},'my-study-lock'));
 const before=structuredClone(saved),upgraded=upgradeStudy(saved,study());
 assert.deepEqual(upgraded.conclusions.find(c=>c.id===id),before.conclusions[0]);
 for(const key of ['revisions','links','target_mappings','source_arguments'])for(const item of before[key])assert.deepEqual(upgraded[key].find(v=>v.id===item.id),item);
 assert.deepEqual(upgraded.assessments[before.conclusions[0].current],before.assessments[before.conclusions[0].current]);
 assert.equal(upgraded.passages.length,4);assert.equal(upgraded.study_revision,2);assert.ok(upgraded.study_catalog.previous_ids.includes(id));
 assert.equal(upgradeStudy(upgraded,study()),upgraded);
 const wrong=study();wrong.passages[0].text_hash='changed';assert.throws(()=>upgradeStudy(before,wrong),/identity/);
});

test('real backup preserves edition-specific references and exact source anchors without fabricated attribution',async()=>{const w=study();assert.equal(w.corpus_kind,'public_domain_backup');assert.equal(w.editions[0].translator,'Meric Casaubon');for(const span of w.spans)await validateAnchor(w.passages.find(p=>p.revision_id===span.passage_revision),span);assert.deepEqual(w.passages.map(p=>`${p.book}.${p.section}`),['5.6','6.5','6.49','1.15']);assert.equal(w.revisions.find(r=>r.id===w.conclusions[0].current).synthesis.method,'manual_editorial_study');assert.ok(w.revisions.find(r=>r.id===w.conclusions[0].current).synthesis.not_claimed.includes('dangerous person'));assert.ok(w.import_audit.source_chunk_count>w.passages.length);});

test('synthesis and resonant wording require separate reviews; the universal overreach remains rejectable',async()=>{let w=study();const meaning=w.conclusions[0],expression=w.expressions[0],unsupported=w.expressions[1];await assert.rejects(applyCommand(w,command(w,'review',{entity_id:meaning.id,decision:'approved',notes:'Not enough yet.'},'premature-review')));for(const [i,link] of w.links.entries())w=await applyCommand(w,command(w,'link_review',{link_id:link.id},`review-premise-${i}`));w=await applyCommand(w,command(w,'review',{entity_id:meaning.id,decision:'approved',notes:'Checked each premise and the explicit bridge and scope.'},'review-real-meaning'));assert.equal(w.assessments[expression.current].state,'stale');w=await applyCommand(w,command(w,'review',{entity_id:expression.id,decision:'approved',notes:'Checked the new wording against the approved meaning.'},'review-expression'));assert.equal(w.assessments[expression.current].state,'approved');await assert.rejects(applyCommand(w,command(w,'review',{entity_id:unsupported.id,decision:'approved',notes:'The universal promise is unsupported.'},'overreach-review')));});

test('editing the synthesized rule does not transfer exact clause maps or change its source revisions',async()=>{const w=study(),meaning=w.conclusions[0];const fresh=await applyCommand(w,command(w,'edit',{entity_id:meaning.id,doc:plainDoc('A changed claim needs fresh support.','new-meaning')},'edit-real-conclusion'));assert.deepEqual(fresh.passages,w.passages);assert.equal(fresh.assessments[fresh.conclusions[0].current].state,'stale');assert.equal(fresh.assessments[w.expressions[0].current].state,'stale');assert.ok(!fresh.target_mappings.some(m=>m.target_revision===fresh.conclusions[0].current));});

test('shareable real maps cannot smuggle text, lexical vectors or incomplete source coverage',()=>{const points=Array.from({length:3},(_,i)=>({passage_id:`p${i}`,revision_id:`p${i}:r1`,text_hash:'a'.repeat(64),reference:`1.${i+1}`,x:i,y:i*i}));const a={share_mode:'references_and_projection_only',vector_origin:'openai',dimensions:3072,embedding_configuration:{model:'text-embedding-3-large',dimensions:3072},sampled:false,excluded_chunks:[],chunk_count:3,points,clustering:{input_dimensions:3072,linkage:'average',distance:'cosine',labels_by_k:{2:[0,0,1]}}};assert.equal(validateReferenceDiscovery(a),true);assert.throws(()=>validateReferenceDiscovery({...a,vector_origin:'local_hashed_tfidf'}));assert.throws(()=>validateReferenceDiscovery({...a,points:points.slice(1)}));assert.throws(()=>validateReferenceDiscovery({...a,points:[{...points[0],text:'Private source text'},...points.slice(1)]}));});
