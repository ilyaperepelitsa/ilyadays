'use client';
import type { Revision,Workspace } from '@/lib/aurelius/types';

export function SynthesisExplanation({revision,workspace,onInspect}:{revision:Revision;workspace:Workspace;onInspect:(rid?:string,sources?:string[])=>void}){
 const notes=revision.synthesis;if(!notes)return null;
 const reasons=(workspace.source_arguments??[]).filter(a=>a.target_revision===revision.id||a.target_revision===notes.meaning_revision);
 return <section className="au-synthesis" aria-label="How the synthesis changes the material">
  <div className="au-synthesis-heading"><h3>What follows from these sources</h3><span className="au-status">{revision.interpretation==='close_paraphrase'?'Close paraphrase · proposed':'Editorial synthesis · proposed'}</span></div>
  {notes.meaning_revision!==revision.id&&<p className="au-warning">This explanation belongs to an earlier wording. Review it against the edited conclusion.</p>}
  <ol className="au-premises">{notes.premises.map((premise,i)=><li key={i}><span className="au-step-number">{i+1}</span><div><p>{premise.claim}</p><button type="button" onClick={()=>onInspect(revision.id,premise.source_span_ids)}>{premise.source_span_ids.map(id=>{const span=workspace.spans.find(s=>s.id===id),p=workspace.passages.find(p=>p.revision_id===span?.passage_revision);return p?`${p.book}.${p.section}`:id;}).join(' + ')} · inspect premise ↗</button></div></li>)}</ol>
  {reasons.length>0&&<section className="au-source-reasons" aria-label="Marcus’s reasons in the sources"><h4>Why, in Marcus’s own reasoning</h4><p className="au-help">Source arguments are separate from our combined inference below. These are proposed interpretations of exact cited text.{notes.meaning_revision!==revision.id&&' These annotations refer to the earlier meaning revision; they do not establish support for the edited text.'}</p>{reasons.map(reason=><article key={reason.revision_id} className={`au-source-reason is-${reason.kind}`}><span className="au-status">{reason.kind==='explicit_reason'?'Stated reason':reason.kind==='analogy'?'Source analogy':'Reason not stated here'}</span><p>{reason.summary}</p><button type="button" onClick={()=>onInspect(reason.target_revision===revision.id?revision.id:undefined,reason.source_span_ids)}>Inspect exact source ↗</button><details><summary>Scope & attribution</summary><p>{reason.limits}</p></details></article>)}</section>}
  <div className="au-inference-step"><strong>The interpretive step</strong><p>{notes.interpretive_step}</p></div>
  <div className="au-synthesis-result"><strong>What the reconstruction adds</strong><p>{notes.what_changes}</p></div>
  <details><summary>Where the evidence stops</summary><p>{notes.not_claimed}</p></details>
  <details><summary>Why phrase it this way?</summary><p>{notes.expression_choice}</p></details>
  <small>Hand-authored study. The bridge and formulation are open to rejection; no human approval or model verification is implied.</small>
 </section>;
}
