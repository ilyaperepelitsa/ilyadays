import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradeFixture } from '../../src/lib/aurelius/upgrade.mjs';
import { sourceIntervals,targetIntervals,sourceGradient } from '../../src/lib/aurelius/provenance.mjs';
import { applyCommand,plainDoc } from '../../src/lib/aurelius/domain.mjs';
import {hierarchyIndex,hierarchyCut,hierarchyCutAtDistance,hierarchyFrontier,validateReferenceDiscovery} from '../../src/lib/aurelius/discovery.mjs';
const seed=()=>JSON.parse(fs.readFileSync(new URL('../../content/aurelius/fixture.json',import.meta.url),'utf8'));
const artifact=JSON.parse(fs.readFileSync(new URL('../../content/aurelius/analysis.json',import.meta.url),'utf8'));
const command=(w,type,payload,id='discovery-command')=>({id,type,payload,expected_version:w.version,at:'2026-11-10T00:00:00Z'});
function legacy(){const w=seed();w.fixture_revision=1;w.passages=w.passages.slice(0,5);w.spans=w.spans.slice(0,5);w.conclusions=w.conclusions.slice(0,1);w.expressions=w.expressions.slice(0,2);w.revisions=w.revisions.slice(0,3);w.links=w.links.slice(0,3);w.bundles=w.bundles.slice(0,1);w.concepts=w.concepts.slice(0,2);w.memberships=w.memberships.slice(0,5);w.target_mappings=[];w.assessments=Object.fromEntries(Object.entries(w.assessments).filter(([id])=>['c1:r1','e1:r1','e2:r1'].includes(id)));return w;}
test('PCA artifact contains every current source chunk once, without sampling or a top-k subset',()=>{const w=seed();assert.equal(artifact.sampled,false);assert.equal(artifact.chunk_count,w.passages.length);assert.equal(artifact.points.length,w.passages.length);assert.equal(new Set(artifact.points.map(p=>p.revision_id)).size,w.passages.length);for(const p of w.passages){const row=artifact.points.find(r=>r.revision_id===p.revision_id);assert.equal(row?.text_hash,p.text_hash);}assert.equal(artifact.dimensions,3072);assert.equal(artifact.clustering.input_dimensions,3072);assert.equal(artifact.clustering.input_space,'full_feature_space');assert.equal(artifact.vector_origin,'local_hashed_tfidf');assert.match(artifact.vector_description,/not OpenAI/);});
test('every cluster cut assigns every chunk and never changes the projection',()=>{for(const [k,labels] of Object.entries(artifact.clustering.labels_by_k)){assert.equal(labels.length,artifact.chunk_count);assert.equal(new Set(labels).size,Number(k));}assert.equal(artifact.pca.explained_variance_ratio.length,2);assert.ok(artifact.pca.explained_variance_ratio.every(n=>n>0));assert.ok(artifact.pca.explained_variance_ratio.reduce((a,b)=>a+b,0)<=1);});
test('legacy upgrade appends content while preserving a user revision, locks, rejections and preferences',async()=>{let old=legacy();old=await applyCommand(old,command(old,'edit',{entity_id:'c1',doc:plainDoc('A personal edited claim.','personal')}));old=await applyCommand(old,command(old,'lock',{entity_id:'c1',locked:true},'lock-personal'));old.preferences['demo-p1']={pinned:true,excluded:true};old.assessments['e2:r1']={state:'rejected',notes:'Keep this decision.'};const original=structuredClone(old);const upgraded=upgradeFixture(old,seed());assert.equal(upgraded.passages.length,seed().passages.length);assert.equal(upgraded.conclusions[0].current,original.conclusions[0].current);assert.equal(upgraded.conclusions[0].locked,true);assert.deepEqual(upgraded.revisions.find(r=>r.id===original.conclusions[0].current),original.revisions.at(-1));assert.deepEqual(upgraded.preferences,original.preferences);assert.deepEqual(upgraded.assessments['e2:r1'],original.assessments['e2:r1']);assert.equal(upgraded.version,old.version+1);assert.equal(upgradeFixture(upgraded,seed()),upgraded);assert.deepEqual(old,original);});
test('upgrade never substitutes changed source revisions or touches a real corpus',()=>{const w=legacy();w.passages[0].text_hash='changed';assert.throws(()=>upgradeFixture(w,seed()),/identity conflict/);assert.throws(()=>upgradeFixture({...legacy(),corpus_kind:'hays'},seed()),/real corpus/);});
test('left-side overlap preserves all contributors, not a preferred single color',()=>{const w=seed(),p=w.passages.find(p=>p.id==='demo-duty-1'),spans=w.spans.filter(s=>s.passage_revision===p.revision_id),parts=sourceIntervals(p.text,spans,['span-duty-1','span-duty-4']);assert.ok(parts.some(p=>p.contributors.length===2));assert.equal(parts.map(p=>p.text).join(''),p.text);assert.match(sourceGradient(['span-duty-1','span-duty-4']),/linear-gradient/);});
test('right-side intervals resolve only exact stored mappings with the complete active evidence set',()=>{const w=seed(),r=w.revisions.find(r=>r.id==='c-duty:r1'),maps=w.target_mappings.filter(m=>m.target_revision===r.id),links=w.links.filter(l=>l.target_revision===r.id);const parts=targetIntervals(r.text,r.doc.content[0].attrs.id,maps,links);assert.ok(parts.some(p=>p.sourceIds.length===2));assert.equal(targetIntervals('Changed unsupported text',r.doc.content[0].attrs.id,maps,links).flatMap(p=>p.sourceIds).length,0);const removed=links.map(l=>({...l,active:l.source_span!=='span-duty-4'}));assert.equal(targetIntervals(r.text,r.doc.content[0].attrs.id,maps,removed)[0].sourceIds.length,0);});
test('mapping a new meaning clause validates exact text and source identities and invalidates review',async()=>{const w=seed(),r=w.revisions[0];const next=await applyCommand(w,command(w,'map_target',{entity_id:'c1',block_id:r.doc.content[0].attrs.id,start:0,end:5,exact:r.text.slice(0,5),source_span_ids:['span-1'],justification:'Manual selected-clause proposal.'}));assert.equal(next.assessments[r.id].state,'stale');await assert.rejects(applyCommand(w,command(w,'map_target',{entity_id:'c1',block_id:r.doc.content[0].attrs.id,start:0,end:5,exact:'fake',source_span_ids:['span-1'],justification:'bad'})),/does not match/);});

test('deployment rejects missing, changed and non-finite map rows rather than claiming full coverage',async()=>{const {validateDiscoveryArtifact}=await import('../../src/lib/aurelius/discovery.mjs');const w=seed();assert.equal(validateDiscoveryArtifact(w,artifact),true);assert.throws(()=>validateDiscoveryArtifact(w,{...artifact,points:artifact.points.slice(1)}),/every source/);const bad=structuredClone(artifact);bad.points[0].text_hash='changed';assert.throws(()=>validateDiscoveryArtifact(w,bad),/hash mismatch/);});

test('stored hierarchies expose nested branches and depth-limited views without losing source leaves',()=>{
 const run={children:[[0,1],[2,3],[4,5]],distances:[.1,.2,.7]},nodes=hierarchyIndex(run,4);
 assert.deepEqual(nodes[6].members,[0,1,2,3]);assert.equal(nodes[0].parent,4);assert.deepEqual(hierarchyCut(nodes,2),[4,5]);assert.deepEqual(hierarchyCut(nodes,3),[4,2,3]);
 const view=hierarchyFrontier(nodes,6,1);assert.deepEqual(view.frontier,[4,5]);assert.deepEqual(view.frontier.flatMap(id=>nodes[id].members),[0,1,2,3]);
 assert.equal(new Set(view.visible.map(n=>n.y)).size,view.visible.length);assert.equal(view.rows,view.visible.length);
 assert.deepEqual(hierarchyFrontier(nodes,4,1).frontier,[0,1]);
 for(const bad of [{...run,children:[[0,1],[0,2],[4,5]]},{...run,children:[[0,5],[2,3],[4,5]]},{...run,distances:[.1,.2,.05]}])assert.throws(()=>hierarchyIndex(bad,4));
});

test('real comparison artifacts retain the original baseline and reject fabricated branches, cuts or neighbors',()=>{
 for(const name of ['real-map.json','backup-map.json']){
  const a=JSON.parse(fs.readFileSync(new URL('../../content/aurelius/'+name,import.meta.url),'utf8'));assert.equal(validateReferenceDiscovery(a),true);
  assert.deepEqual(a.hierarchy.methods.average.children,a.clustering.children);
  const rounded=structuredClone(a);rounded.hierarchy.methods.average.diagnostics_by_k['6'].largest_fraction+=Number.EPSILON;assert.equal(validateReferenceDiscovery(rounded),true);
  for(const [k,labels]of Object.entries(a.clustering.labels_by_k))assert.deepEqual(a.hierarchy.methods.average.labels_by_k[k],labels);
  const invalid=structuredClone(a);invalid.hierarchy.methods.complete.children[0][1]=invalid.hierarchy.methods.complete.children[0][0];assert.throws(()=>validateReferenceDiscovery(invalid),/merge/);
  const bad=structuredClone(a);bad.hierarchy.neighbors[0][0].index=0;assert.throws(()=>validateReferenceDiscovery(bad),/neighbors/);
 }
});

 test('distance cuts include tied merges atomically and preserve all leaves',()=>{
 const nodes=hierarchyIndex({children:[[0,1],[2,3],[4,5]],distances:[.2,.2,.7]},4);
 assert.deepEqual(hierarchyCutAtDistance(nodes,-Infinity),[0,1,2,3]);
 assert.deepEqual(hierarchyCutAtDistance(nodes,.2),[4,5]);
 assert.deepEqual(hierarchyCutAtDistance(nodes,.7),[6]);
 assert.throws(()=>hierarchyCutAtDistance(nodes,NaN));
 });
