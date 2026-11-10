'use client';
import { useEffect } from 'react';
import { EditorContent, useEditor, type JSONContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UniqueID from '@tiptap/extension-unique-id';
import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { sourceGradient, targetIntervals } from '@/lib/aurelius/provenance.mjs';
import { scalarToUtf16 } from '@/lib/aurelius/domain.mjs';
import type { EvidenceLink,TargetMapping } from '@/lib/aurelius/types';

const Grounding=Mark.create({
  name:'grounding',inclusive:false,
  addOptions(){return {highlightUnmapped:false};},
  addAttributes(){return {conclusionRevision:{default:null},sourceSpanIds:{default:[]},state:{default:'proposed'}};},
  parseHTML(){return [{tag:'span[data-grounding]'}];},
  renderHTML({HTMLAttributes}){const ids=HTMLAttributes.sourceSpanIds as string[];return ['span',mergeAttributes(HTMLAttributes,{'data-grounding':'clause','data-conclusion-revision':HTMLAttributes.conclusionRevision,'data-source-span-ids':ids.join(' '),class:'au-grounded',tabindex:0,style:`--au-provenance:${sourceGradient(ids)}`,'aria-label':`Clause mapping to ${HTMLAttributes.conclusionRevision}; ${ids.length} contributing source spans, not measured percentages`}),0];},
  addProseMirrorPlugins(){const unmapped=this.options.highlightUnmapped;return [new Plugin({
    props:{decorations(state){if(!unmapped)return null;const marks:Decoration[]=[];state.doc.descendants((node,pos)=>{if(node.isText&&node.text?.trim()&&!node.marks.some(m=>m.type.name==='grounding'))marks.push(Decoration.inline(pos,pos+node.nodeSize,{class:'au-unmapped',title:'Unsupported / unmapped addition: review and attach meaning before approval'}));});return DecorationSet.create(state.doc,marks);}},
    appendTransaction(transactions,oldState,newState){
      if(!transactions.some(t=>t.docChanged)||transactions.some(t=>t.getMeta('aurelius-load')||t.getMeta('aurelius-map')))return null;
      // A changed paragraph loses its marks conservatively. Never let inserted words inherit attribution.
      const prior=new Map<string,string>();oldState.doc.forEach(n=>{if(n.attrs.id)prior.set(n.attrs.id,n.textContent);});
      const tr=newState.tr;
      newState.doc.forEach((node,offset)=>{
        if(prior.get(node.attrs.id)!==node.textContent&&node.nodeSize>2)tr.removeMark(offset+1,offset+node.nodeSize-1,newState.schema.marks.grounding);
      });
      return tr.steps.length?tr.setMeta('aurelius-invalidated',true):null;
    }
  })];}
});

const EMPTY_MAPPINGS:TargetMapping[]=[];
const EMPTY_LINKS:EvidenceLink[]=[];
const EMPTY_LABELS:Record<string,string>={};
type MappingData={document:JSONContent;targetMappings:TargetMapping[];links:EvidenceLink[];identity:string;sourceLabels:Record<string,string>};
const meaningEvidenceKey=new PluginKey<MappingData>('aureliusMeaningEvidence');
const MeaningEvidence=Extension.create({
 name:'meaningEvidence',addOptions(){return {initialData:{document:{},targetMappings:[],links:[],identity:'',sourceLabels:{}} as MappingData};},
 addProseMirrorPlugins(){const initialData=this.options.initialData as MappingData;return [new Plugin({key:meaningEvidenceKey,state:{init:()=>initialData,apply(tr,value){return tr.getMeta('aurelius-provenance-data')??value;}},props:{decorations(state){
  const data=meaningEvidenceKey.getState(state) as MappingData;if(!data.targetMappings.length)return null;
  const decorations:Decoration[]=[];
  state.doc.forEach((node,pos)=>{
   const saved=data.document.content?.find(b=>b.attrs?.id===node.attrs.id),savedText=saved?.content?.map(n=>n.text??'').join('');
   if(savedText!==node.textContent){if(node.content.size)decorations.push(Decoration.inline(pos+1,pos+node.nodeSize-1,{class:'au-unmapped',title:'Edited paragraph: source assessments are stale'}));return;}
   const intervals=targetIntervals(node.textContent,node.attrs.id,data.targetMappings,data.links) as {start:number;end:number;sourceIds:string[];mappingIds:string[];granularity:string}[];
   for(const range of intervals){if(range.start===range.end)continue;const start=pos+1+scalarToUtf16(node.textContent,range.start),end=pos+1+scalarToUtf16(node.textContent,range.end);
    if(range.sourceIds.length){const relations=range.sourceIds.map(id=>`${data.sourceLabels[id]??id}: ${data.links.filter(l=>l.source_span===id&&l.active).map(l=>l.relation).join('/')}`).join('; ');
     decorations.push(Decoration.inline(start,end,{class:'au-meaning-evidence','data-target-mapping':range.mappingIds.join(' '),'data-conclusion-revision':data.identity,'data-source-span-ids':range.sourceIds.join(' '),tabindex:'0',style:`--au-provenance:${sourceGradient(range.sourceIds)}`,title:`${range.granularity.replaceAll('_',' ')} · ${relations} · inspect exact sources`,'aria-label':`${range.granularity.replaceAll('_',' ')} evidence: ${relations}`}));
    }else if(node.textContent.slice(scalarToUtf16(node.textContent,range.start),scalarToUtf16(node.textContent,range.end)).trim())decorations.push(Decoration.inline(start,end,{class:'au-unmapped',title:'No current stored source mapping'}));
   }
  });return DecorationSet.create(state.doc,decorations);
 }}})];}
});
export function ProvenanceEditor({document,identity,label,readOnly,onChange,onReady,onInspect,targetMappings=EMPTY_MAPPINGS,sourceLinks=EMPTY_LINKS,sourceLabels=EMPTY_LABELS}:{document:JSONContent;identity:string;label:string;readOnly:boolean;onChange:(doc:JSONContent)=>void;onReady?:(editor:Editor)=>void;onInspect?:(revisionId?:string,sourceIds?:string[])=>void;targetMappings?:TargetMapping[];sourceLinks?:EvidenceLink[];sourceLabels?:Record<string,string>}){
 const inspect=(target:EventTarget|null)=>{const mark=(target as HTMLElement)?.closest<HTMLElement>('[data-source-span-ids]');onInspect?.(mark?.dataset.conclusionRevision,mark?.dataset.sourceSpanIds?.split(' ').filter(Boolean));};
 const editor=useEditor({immediatelyRender:false,
  extensions:[StarterKit.configure({heading:false,bulletList:false,orderedList:false,blockquote:false,codeBlock:false,code:false,horizontalRule:false,bold:false,italic:false,strike:false,link:false,underline:false,hardBreak:false}),UniqueID.configure({types:['paragraph']}),Grounding.configure({highlightUnmapped:label==='Expression text'}),MeaningEvidence.configure({initialData:{document,targetMappings,links:sourceLinks,identity,sourceLabels}})],
  content:document,editable:!readOnly,editorProps:{attributes:{class:'au-editor',role:'textbox','aria-label':label,'aria-multiline':'true','data-editor-revision':identity},handleClick:(_view,_pos,event)=>{inspect(event.target);return false;}},onUpdate:({editor})=>onChange(editor.getJSON())
 });
 useEffect(()=>{if(editor)onReady?.(editor);},[editor,onReady]);
 useEffect(()=>{editor?.setEditable(!readOnly,false);},[editor,readOnly]);
 useEffect(()=>{editor?.view.dispatch(editor.state.tr.setMeta('aurelius-provenance-data',{document,targetMappings,links:sourceLinks,identity,sourceLabels}));},[document,targetMappings,sourceLinks,identity,editor,sourceLabels]);
 return <EditorContent editor={editor} onFocusCapture={event=>{if((event.target as HTMLElement)?.closest('[data-source-span-ids]'))inspect(event.target);}}/>;
}
