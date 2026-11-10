'use client';
import { useCallback, useMemo, useState } from 'react';
import type { Editor, JSONContent } from '@tiptap/react';
import type { EditorialEntity, Revision, Workspace, EvidenceLink } from '@/lib/aurelius/types';
import { currentLinks, INTERPRETATIONS, utf16ToScalar } from '@/lib/aurelius/domain.mjs';
import { ProvenanceEditor } from './ProvenanceEditor';
import { ActionIcon } from '../site/ActionIcon';

type Commit=(type:string,payload:Record<string,unknown>)=>Promise<boolean>;
export function EditorialCard({workspace,item,revision,meaning,busy,commit,onDirty,onInspect,reviewBlocked=false}:{workspace:Workspace;item:EditorialEntity;revision:Revision;meaning:Revision;busy:boolean;commit:Commit;onDirty:(id:string,dirty:boolean)=>void;onInspect:(revisionId?:string,sourceIds?:string[])=>void;reviewBlocked?:boolean}){
  const [doc,setDoc]=useState<JSONContent>(revision.doc),[scope,setScope]=useState(revision.scope),[practical,setPractical]=useState(revision.practical_implication??''),[qualifications,setQualifications]=useState(revision.qualifications),[assumptions,setAssumptions]=useState(revision.assumptions),[interpretation,setInterpretation]=useState(revision.interpretation),[note,setNote]=useState(''),[dirty,setDirty]=useState(false),[editor,setEditor]=useState<Editor|null>(null),[mapError,setMapError]=useState(''),[editorEpoch,setEditorEpoch]=useState(0);
  const state=workspace.assessments[revision.id],expression=revision.kind==='expression';
  const sourceLinks=useMemo(()=>currentLinks(workspace,revision.id) as EvidenceLink[],[workspace,revision.id]);
  const targetMappings=useMemo(()=>(workspace.target_mappings??[]).filter(m=>m.target_revision===revision.id),[workspace.target_mappings,revision.id]);
  const sourceLabels=useMemo(()=>Object.fromEntries(workspace.spans.map(s=>{const p=workspace.passages.find(p=>p.revision_id===s.passage_revision);return [s.id,p?`Demo ${p.book}.${p.section}`:s.id];})),[workspace.spans,workspace.passages]);
  const markDirty=()=>{setDirty(true);onDirty(item.id,true);};
  const change=useCallback((next:JSONContent)=>{setDoc(next);setDirty(true);onDirty(item.id,true);},[item.id,onDirty]);
  const onReady=useCallback((value:Editor)=>setEditor(value),[]);
  const discard=()=>{setDoc(revision.doc);setScope(revision.scope);setPractical(revision.practical_implication??'');setQualifications(revision.qualifications);setAssumptions(revision.assumptions);setInterpretation(revision.interpretation);setDirty(false);onDirty(item.id,false);setMapError('');setEditorEpoch(v=>v+1);};
  const save=async()=>{if(await commit('edit',{entity_id:item.id,doc,scope,practical_implication:practical,qualifications,assumptions,interpretation})){onDirty(item.id,false);}};
  const map=()=>{
    if(!editor||editor.state.selection.empty){setMapError('Select the exact clause to map first.');return;}
    const spans=currentLinks(workspace,meaning.id).map((l:EvidenceLink)=>l.source_span);
    if(!spans.length){setMapError('Attach evidence to the selected meaning first.');return;}
    setMapError('');editor.chain().focus().command(({tr})=>{tr.setMeta('aurelius-map',true);return true;}).setMark('grounding',{conclusionRevision:meaning.id,sourceSpanIds:spans,state:'proposed'}).run();
  };
  const mapMeaning=async()=>{
    if(!editor||editor.state.selection.empty){setMapError('Select the exact saved clause to map first.');return;}
    const { $from,$to }=editor.state.selection;if($from.parent!==$to.parent){setMapError('Select text within one paragraph.');return;}
    const text=$from.parent.textContent,start=utf16ToScalar(text,$from.parentOffset),end=utf16ToScalar(text,$to.parentOffset);
    if(await commit('map_target',{entity_id:item.id,block_id:$from.parent.attrs.id,start,end,exact:Array.from(text).slice(start,end).join(''),source_span_ids:sourceLinks.map(l=>l.source_span),justification:'Manual proposal: these saved sources jointly support the selected clause.'}))setMapError('');
  };
  return <section className={`au-editorial-card ${expression?'is-expression':''}`} data-testid={expression?'expression-card':'meaning-card'} data-status={dirty||reviewBlocked?'stale':state.state}>
    <div className="au-card-top"><span className={`au-status status-${dirty||reviewBlocked?'stale':state.state}`}>{dirty?'Unsaved · support stale':reviewBlocked?'Unsaved evidence · support stale':state.state.replaceAll('_',' ')}</span><span className="au-revision">r{revision.sequence}</span><button type="button" className="au-icon-button" aria-label={item.locked?'Unlock decision':'Lock decision'} disabled={busy||dirty||reviewBlocked} onClick={()=>void commit('lock',{entity_id:item.id,locked:!item.locked})}>{item.locked?'Locked':'Lock'}</button></div>
    <h3>{item.title}</h3>
    {expression&&<p className="au-help">Editorial wording, never a quotation attributed to Marcus.</p>}
    <div data-target-anchor={item.id} className="au-editor-frame"><ProvenanceEditor key={editorEpoch} document={revision.doc} identity={revision.id} label={expression?'Expression text':'Conclusion text'} readOnly={item.locked||busy} onChange={change} onReady={onReady} onInspect={onInspect} targetMappings={expression?undefined:targetMappings} sourceLinks={sourceLinks} sourceLabels={sourceLabels} /></div>
    <div className="au-editor-tools"><button type="button" disabled={busy||item.locked||!editor?.can().undo()} onClick={()=>editor?.chain().focus().undo().run()}>Undo</button><button type="button" disabled={busy||item.locked||!editor?.can().redo()} onClick={()=>editor?.chain().focus().redo().run()}>Redo</button>{!expression&&<button type="button" onClick={()=>void mapMeaning()} disabled={busy||dirty||item.locked||!sourceLinks.length}>Map selected meaning clause</button>}{expression&&<button type="button" onClick={map} disabled={busy||item.locked}>Map selected clause</button>}<button type="button" disabled={!dirty||busy} onClick={discard}>Discard draft</button><button type="button" className="au-primary" disabled={!dirty||busy||item.locked||reviewBlocked} onClick={()=>void save()}><ActionIcon name="check" />Save revision</button></div>
    {mapError&&<p role="status" className="au-warning">{mapError}</p>}
    {!expression&&<p className="au-help au-target-help">Source colors inside the meaning text show stored clause or joint-statement mappings. Select a colored clause to inspect its exact contributors. Dashed text needs mapping or review.</p>}{expression?<p className="au-help">Colored text: an explicit clause mapping. Dashed underline: unmapped prose. Mapping is a review proposal, not proof.</p>:<>
      <label className="au-field">Interpretation<select aria-label="Interpretation type" value={interpretation} disabled={item.locked||busy} onChange={e=>{setInterpretation(e.target.value);markDirty();}}>{INTERPRETATIONS.map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label>
      <label className="au-field">Practical implication<textarea aria-label="Practical implication" value={practical} disabled={item.locked||busy} onChange={e=>{setPractical(e.target.value);markDirty();}} rows={2}/></label>
      <label className="au-field">Scope<textarea aria-label="Conclusion scope" value={scope} disabled={item.locked||busy} onChange={e=>{setScope(e.target.value);markDirty();}} rows={2}/></label>
      <label className="au-field">Qualifications & limits<textarea aria-label="Conclusion qualifications" value={qualifications} disabled={item.locked||busy} onChange={e=>{setQualifications(e.target.value);markDirty();}} rows={2}/></label>
      <details><summary>Bridge assumption</summary><textarea aria-label="Bridge assumption" value={assumptions} disabled={item.locked||busy} onChange={e=>{setAssumptions(e.target.value);markDirty();}} rows={3}/></details>
    </>}
    <div className="au-review"><p>{dirty?'Save the revision before reviewing. Previous approval never transfers to edited wording.':reviewBlocked?'Save or discard the open evidence/meaning drafts before reviewing.':state.notes}</p><label className="au-field">Your review<textarea aria-label={expression?'Expression review note':'Conclusion review note'} placeholder="What did you check? What remains uncertain?" value={note} onChange={e=>setNote(e.target.value)} rows={2}/></label><div className="au-button-row"><button type="button" disabled={busy||dirty||reviewBlocked||!note.trim()} onClick={()=>void commit('review',{entity_id:item.id,decision:'rejected',notes:note})}>Reject</button><button type="button" disabled={busy||dirty||reviewBlocked||!note.trim()} onClick={()=>void commit('review',{entity_id:item.id,decision:'approved',notes:note})}>Approve after review</button></div></div>
  </section>;
}
