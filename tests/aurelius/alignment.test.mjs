import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeAlignment, alignmentScores, bestMatches, nearest, alignmentTextKeyInput, COUNTERPART } from '../../src/lib/aurelius/alignment.mjs';
import { draftBook } from '../../src/lib/aurelius/book.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../../content/aurelius/${name}`,import.meta.url),'utf8'));
const study=read('backup-study.json'),artifact=read('alignment.json');

test('alignment artifact was computed from the current study wording and spans',()=>{
 assert.equal(artifact.schema,'aurelius-alignment-v1');
 assert.equal(artifact.text_key,createHash('sha256').update(alignmentTextKeyInput(study)).digest('hex'),'run scripts/aurelius-alignment.py');
 assert.match(artifact.method.model_revision,/^[0-9a-f]{40}$/);assert.match(artifact.method.reference,/BERTScore/);
});
test('every word offset points at that word in the exact stored text',()=>{
 const revisions=new Map(study.revisions.map(r=>[r.id,r])),spans=new Map(study.spans.map(s=>[s.id,s]));
 for(const [id,item]of Object.entries(artifact.items)){
  const a=decodeAlignment(item),text=revisions.get(id).text;
  for(const t of a.result)assert.equal(text.slice(t.start,t.end),t.text);
  for(const s of a.sources)for(const t of s.tokens)assert.equal(spans.get(s.spanId).exact.slice(t.start,t.end),t.text);
  assert.equal(a.sim.length,a.result.length);assert.ok(a.sim.every(row=>row.length===a.columns.length&&row.every(v=>v>=-1&&v<=1)));
 }
});
test('published precision, recall and F1 are re-derived from the stored matrix',()=>{
 for(const item of Object.values(artifact.items)){
  const s=alignmentScores(decodeAlignment(item));
  for(const k of ['precision','recall','f1'])assert.ok(Math.abs(s[k]-item[k])<0.002,`${k} ${s[k]} vs ${item[k]}`);
 }
});
test('every lesson in the book has an alignment, and identical words align above the counterpart line',()=>{
 for(const lesson of draftBook(study).chapters.flatMap(c=>c.lessons)){
  const item=artifact.items[lesson.expression_revision??lesson.conclusion_revision];assert.ok(item,lesson.conclusion_id);
  const a=decodeAlignment(item),best=bestMatches(a);
  for(const r of a.result.filter(t=>!t.stop)){
   const same=a.columns.find(c=>!c.stop&&c.text.toLowerCase()===r.text.toLowerCase());
   if(same)assert.ok(best.forResult.get(r.index).value>=COUNTERPART,`${r.text} should meet its own occurrence`);
   const top=nearest(a,r.index,3);assert.ok(top.length>0&&top[0].value===best.forResult.get(r.index).value);
  }
 }
});
