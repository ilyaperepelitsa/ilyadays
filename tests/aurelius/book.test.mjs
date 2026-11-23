import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { draftBook,lessonSnapshot,lessonSources,bookLessonState,validateBook } from '../../src/lib/aurelius/book.mjs';
import { applyCommand,plainDoc } from '../../src/lib/aurelius/domain.mjs';
const seed=()=>JSON.parse(fs.readFileSync(new URL('../../content/aurelius/backup-study.json',import.meta.url),'utf8'));
const command=(w,type,payload,id)=>({id,type,payload,expected_version:w.version,at:'2026-11-11T12:00:00Z'});
test('chapter structure supports distinct lessons, shared sources and repeated lesson placement independently of clustering',()=>{
 const w=seed(),book=draftBook(w);assert.equal(validateBook(w,book),true);
 const attention=book.chapters.find(c=>c.id==='attention');assert.equal(attention.lessons.length,2);
 const [ordinary,distress]=attention.lessons;assert.ok(ordinary.conclusion_id.endsWith('ordinary-impressions'));assert.ok(distress.conclusion_id.endsWith('distress-and-threat'));
 const ordinarySources=lessonSources(w,ordinary.conclusion_revision),distressSources=lessonSources(w,distress.conclusion_revision);
 assert.ok(ordinarySources.some(p=>p.book==='8'&&p.section==='12'&&distressSources.some(q=>q.id===p.id)));
 assert.ok(book.chapters.find(c=>c.id==='response').lessons.some(l=>l.conclusion_id===distress.conclusion_id));
 assert.ok(w.revisions.find(r=>r.id===ordinary.expression_revision).text.startsWith('When you can, examine'));
 for(const c of book.chapters)for(const l of c.lessons)assert.equal(bookLessonState(w,l),'awaiting_review');
 assert.equal('clusters' in book,false);
});
test('saving/reordering a manuscript preserves immutable source revisions, review states, and earlier outlines',async()=>{
 let w=seed(),book=draftBook(w);const source=structuredClone(w.passages),reviews=structuredClone(w.assessments);
 w=await applyCommand(w,command(w,'manuscript',book,'book-first'));const first=structuredClone(w.manuscript_revisions[0]);
 book=draftBook(w);book.title='My considered commitments';book.chapters.reverse();
 w=await applyCommand(w,command(w,'manuscript',book,'book-reorder'));
 assert.deepEqual(w.manuscript_revisions[0],first);assert.equal(w.manuscript_revisions[1].parent_id,first.id);assert.equal(draftBook(w).title,book.title);
 assert.deepEqual(w.passages,source);assert.deepEqual(w.assessments,reviews);assert.equal(w.manuscript_revisions[1].status,'draft');
 const lesson=draftBook(w).chapters.flatMap(c=>c.lessons)[0];
 w=await applyCommand(w,command(w,'edit',{entity_id:lesson.conclusion_id,doc:plainDoc('A materially different teaching.','changed')},'book-source-edit'));
 assert.equal(bookLessonState(w,lesson),'older_revision');assert.deepEqual(draftBook(w).chapters,book.chapters);
 const fresh=lessonSnapshot(w,lesson.conclusion_id);assert.equal(bookLessonState(w,fresh),'stale');
});
test('editing expression cannot transfer its review to an existing book clause',async()=>{
 let w=seed();const lesson=lessonSnapshot(w,w.study_catalog.default_id),expression=w.revisions.find(r=>r.id===lesson.expression_revision);
 w=await applyCommand(w,command(w,'edit',{entity_id:expression.entity_id,doc:plainDoc('New, unsupported wording.','new-voice')},'book-expression-edit'));
 assert.equal(bookLessonState(w,lesson),'older_revision');
});
test('invalid, duplicate and unrelated manuscript references fail instead of becoming evidence',async()=>{
 const w=seed(),book=draftBook(w),bad=structuredClone(book);bad.chapters[0].lessons.push(bad.chapters[0].lessons[0]);
 await assert.rejects(applyCommand(w,command(w,'manuscript',bad,'duplicate-lesson')),/distinct/);
 const unknown=structuredClone(book);unknown.chapters[0].lessons[0].conclusion_revision='invented:r1';assert.throws(()=>validateBook(w,unknown),/known/);
 const unrelated=structuredClone(book);unrelated.chapters[0].lessons[0].expression_revision=w.expressions.find(e=>e.id.endsWith('social-purpose-overreach')).current;
 assert.throws(()=>validateBook(w,unrelated),/recorded meaning/);
});

test('reading plan: the first chapter states recurring lessons as principles and each lesson is printed once',async()=>{
 const {readingPlan}=await import('../../src/lib/aurelius/book.mjs');
 const w=seed(),book=draftBook(w),plan=readingPlan(book),all=plan.flatMap(c=>c.lessons);
 assert.equal(plan[0].title,'Opening principles');
 assert.ok(plan[0].lessons.length===5&&plan[0].lessons.every(l=>l.mode==='principle'),'every opening principle returns as a lesson later');
 const ids=new Set(all.map(l=>l.lesson.conclusion_id));
 for(const id of ids){const full=all.filter(l=>l.lesson.conclusion_id===id&&l.mode==='full');assert.equal(full.length,1);assert.ok(all.filter(l=>l.lesson.conclusion_id===id).every(l=>l.fullAt===full[0].number));}
 // Every lesson now has a firm formulation, and none of them is a marked-unsupported decoy.
 for(const l of plan[0].lessons){const e=w.expressions.find(e=>e.current===l.lesson.expression_revision);assert.ok(['Personal constitution formulation','Concise formulation'].includes(e.title));assert.notEqual(w.assessments[e.current].state,'unsupported');}
 // A lesson placed only in the first chapter is printed there in full.
 const solo=readingPlan({...book,chapters:[{...book.chapters[0],lessons:book.chapters[0].lessons.slice(0,1)},{...book.chapters[3]}]});
 assert.equal(solo[0].lessons[0].mode,'full');
 // A lesson that recurs after the first chapter is stated there and printed in full at its later placement.
 const twice=readingPlan({...book,chapters:[book.chapters[1],book.chapters[2]]});
 assert.deepEqual(twice.flatMap(c=>c.lessons.map(l=>l.mode)),['full','principle','full','full']);
 const later=readingPlan({...book,chapters:[book.chapters[3],book.chapters[1],book.chapters[2]]});
 assert.deepEqual(later.flatMap(c=>c.lessons.map(l=>l.mode)),['full','full','full','full','reference','full']);
});
