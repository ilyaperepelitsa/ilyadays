/** Append source-reason annotations/variants without rewriting an existing editorial revision. */
export function upgradeStudy(input,seed){
 if(input.corpus_kind==='synthetic'||input.corpus_kind!==seed.corpus_kind)throw Error('Study editions must remain separate');
 if((input.study_revision??0)>=(seed.study_revision??0))return input;
 const w=structuredClone(input);
 for(const p of seed.passages){const prior=w.passages.find(q=>q.id===p.id);if(!prior||prior.revision_id!==p.revision_id||prior.text_hash!==p.text_hash)throw Error('Study source identity changed; existing work retained');}
 for(const key of ['spans','revisions','expressions','source_arguments']){w[key]??=[];const ids=new Set(w[key].map(v=>v.id));for(const item of seed[key]??[])if(!ids.has(item.id)){w[key].push(structuredClone(item));ids.add(item.id);}}
 for(const [id,assessment]of Object.entries(seed.assessments))if(!w.assessments[id])w.assessments[id]=structuredClone(assessment);
 w.study_revision=seed.study_revision;w.version++;w.events.push({id:`study-extension-${seed.study_revision}`,type:'study_extension',at:'2026-11-10T00:00:00Z',entity_id:null});return w;
}
