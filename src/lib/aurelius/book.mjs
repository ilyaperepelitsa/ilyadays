/** Editorial structure is independent of computational cluster assignments. */
export function lessonSnapshot(w, id) {
 const conclusion=w.conclusions.find(c=>c.id===id);
 if(!conclusion)throw Error('Unknown book lesson');
 const candidates=w.expressions.filter(e=>w.revisions.find(r=>r.id===e.current)?.dependencies.includes(conclusion.current)&&w.assessments[e.current]?.state!=='unsupported');
 const expression=candidates.find(e=>e.title==='Personal constitution formulation')??candidates.find(e=>e.title==='Concise formulation')??candidates[0];
 return {conclusion_id:id,conclusion_revision:conclusion.current,expression_revision:expression?.current??null};
}
export function draftBook(w) {
 const saved=(w.manuscript_revisions??[]).find(r=>r.id===w.manuscript_current);
 if(saved)return structuredClone(saved);
 const previous=new Set(w.study_catalog?.previous_ids??[]),current=w.conclusions.filter(c=>!previous.has(c.id));
 const ids=suffixes=>current.filter(c=>suffixes.some(s=>c.id.endsWith(s))).map(c=>lessonSnapshot(w,c.id));
 const chapters=[
  {id:'foundations',title:'Opening principles',lessons:ids(['ordinary-impressions','social-purpose'])},
  {id:'attention',title:'Judgment and attention',lessons:ids(['ordinary-impressions','distress-and-threat'])},
  {id:'response',title:'Action in difficult encounters',lessons:ids(['distress-and-threat','non-imitation'])},
  {id:'shared-life',title:'Our shared life',lessons:ids(['social-purpose','shared-good'])}
 ].filter(c=>c.lessons.length);
 const placed=new Set(chapters.flatMap(c=>c.lessons.map(l=>l.conclusion_id))),unassigned=current.filter(c=>!placed.has(c.id));
 if(unassigned.length)chapters.push({id:'unplaced',title:'Lessons awaiting placement',lessons:unassigned.map(c=>lessonSnapshot(w,c.id))});
 return {id:null,parent_id:null,title:'A personal constitution',status:'draft',created_at:null,chapters};
}
export function validateBook(w, book) {
 if(typeof book?.title!=='string'||!book.title.trim()||book.title.length>200||!Array.isArray(book.chapters)||!book.chapters.length||book.chapters.length>100)throw Error('A book needs a title and 1–100 chapters');
 const chapters=new Set();
 for(const chapter of book.chapters){
  if(typeof chapter.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(chapter.id)||chapters.has(chapter.id))throw Error('Chapter IDs must be unique and stable');chapters.add(chapter.id);
  if(typeof chapter.title!=='string'||!chapter.title.trim()||chapter.title.length>200||!Array.isArray(chapter.lessons)||chapter.lessons.length>500)throw Error('Invalid chapter title or lesson list');
  const seen=new Set();
  for(const lesson of chapter.lessons){
   const c=w.conclusions.find(c=>c.id===lesson.conclusion_id),r=w.revisions.find(r=>r.id===lesson.conclusion_revision);
   if(!c||!r||r.entity_id!==c.id||r.kind!=='conclusion'||seen.has(c.id))throw Error('Each chapter needs distinct, known lesson revisions');seen.add(c.id);
   if(lesson.expression_revision){const e=w.revisions.find(r=>r.id===lesson.expression_revision);if(!e||e.kind!=='expression'||!e.dependencies.includes(r.id)||w.assessments[e.id]?.state==='unsupported')throw Error('Book wording must reference its recorded meaning');}
  }
 }
 return true;
}
export function saveBook(w, payload, command) {
 const book={id:`manuscript-${command.id}`,parent_id:w.manuscript_current??null,title:payload.title,status:'draft',created_at:command.at,
  chapters:(payload.chapters??[]).map(c=>({id:c.id,title:c.title,lessons:c.lessons?.map(l=>({conclusion_id:l.conclusion_id,conclusion_revision:l.conclusion_revision,expression_revision:l.expression_revision??null}))}))};
 validateBook(w,book);
 w.manuscript_revisions??=[];w.manuscript_revisions.push(book);w.manuscript_current=book.id;
}
export function lessonSources(w, revisionId) {
 const links=w.links.filter(l=>l.active&&l.target_revision===revisionId),refs=new Map();
 for(const link of links){const span=w.spans.find(s=>s.id===link.source_span),p=w.passages.find(p=>p.revision_id===span?.passage_revision);if(p)refs.set(p.id,p);}
 return [...refs.values()];
}
export function bookLessonState(w, lesson) {
 const current=w.conclusions.find(c=>c.id===lesson.conclusion_id)?.current;
 if(current!==lesson.conclusion_revision)return 'older_revision';
 const expression=w.revisions.find(r=>r.id===lesson.expression_revision);
 if(expression&&w.expressions.find(e=>e.id===expression.entity_id)?.current!==expression.id)return 'older_revision';
 const meaning=w.assessments[lesson.conclusion_revision]?.state??'awaiting_review';
 if(meaning!=='approved')return meaning;
 return lesson.expression_revision?w.assessments[lesson.expression_revision]?.state??'awaiting_review':'awaiting_review';
}
