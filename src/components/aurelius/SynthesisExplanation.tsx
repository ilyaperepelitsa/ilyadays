'use client';
import type { Revision,Workspace } from '@/lib/aurelius/types';

export function SynthesisExplanation({revision,workspace,onInspect}:{revision:Revision;workspace:Workspace;onInspect:(rid?:string,sources?:string[])=>void}){
 const notes=revision.synthesis;if(!notes)return null;
 return <section className="au-synthesis" aria-label="How the synthesis changes the material">
  <div className="au-synthesis-heading"><h3>From reminders to a decision rule</h3><span className="au-status">Editorial synthesis · proposed</span></div>
  {notes.meaning_revision!==revision.id&&<p className="au-warning">This explanation belongs to an earlier wording. Review it against the edited conclusion.</p>}
  <ol className="au-premises">{notes.premises.map((premise,i)=><li key={i}><span className="au-step-number">{i+1}</span><div><p>{premise.claim}</p><button type="button" onClick={()=>onInspect(revision.id,premise.source_span_ids)}>{premise.source_span_ids.map(id=>{const span=workspace.spans.find(s=>s.id===id),p=workspace.passages.find(p=>p.revision_id===span?.passage_revision);return p?`${p.book}.${p.section}`:id;}).join(' + ')} · inspect premise ↗</button></div></li>)}</ol>
  <div className="au-inference-step"><strong>The interpretive step</strong><p>{notes.interpretive_step}</p></div>
  <div className="au-synthesis-result"><strong>What the synthesis adds</strong><p>{notes.what_changes}</p></div>
  <details><summary>Where the evidence stops</summary><p>{notes.not_claimed}</p></details>
  <details><summary>Why phrase it this way?</summary><p>{notes.expression_choice}</p></details>
  <small>Hand-authored study. The bridge and formulation are open to rejection; no human approval or model verification is implied.</small>
 </section>;
}
