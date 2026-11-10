'use client';
import { useEffect } from 'react';
import { EditorContent, useEditor, type JSONContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UniqueID from '@tiptap/extension-unique-id';
import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { sourceColor } from './SourceText';

const Grounding=Mark.create({
  name:'grounding',inclusive:false,
  addOptions(){return {highlightUnmapped:false};},
  addAttributes(){return {conclusionRevision:{default:null},sourceSpanIds:{default:[]},state:{default:'proposed'}};},
  parseHTML(){return [{tag:'span[data-grounding]'}];},
  renderHTML({HTMLAttributes}){const ids=HTMLAttributes.sourceSpanIds as string[],colors=ids.map(sourceColor),segments=colors.map((c,i)=>`${c} ${100*i/colors.length}% ${100*(i+1)/colors.length}%`).join(',');return ['span',mergeAttributes(HTMLAttributes,{'data-grounding':'clause','data-conclusion-revision':HTMLAttributes.conclusionRevision,class:'au-grounded',tabindex:0,style:`--au-provenance:linear-gradient(90deg,${segments})`,'aria-label':`Clause mapping to ${HTMLAttributes.conclusionRevision}; ${ids.length} contributing source spans, no percentage attribution`}),0];},
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

export function ProvenanceEditor({document,identity,label,readOnly,onChange,onReady,onInspect}:{document:JSONContent;identity:string;label:string;readOnly:boolean;onChange:(doc:JSONContent)=>void;onReady?:(editor:Editor)=>void;onInspect?:(revisionId?:string)=>void}){
  const editor=useEditor({
    immediatelyRender:false,
    extensions:[StarterKit.configure({heading:false,bulletList:false,orderedList:false,blockquote:false,codeBlock:false,code:false,horizontalRule:false,bold:false,italic:false,strike:false,link:false,underline:false,hardBreak:false}),UniqueID.configure({types:['paragraph']}),Grounding.configure({highlightUnmapped:label==='Expression text'})],
    content:document,editable:!readOnly,
    editorProps:{attributes:{class:'au-editor',role:'textbox','aria-label':label,'aria-multiline':'true','data-editor-revision':identity},handleClick:(_view,_pos,event)=>{const mark=(event.target as HTMLElement)?.closest<HTMLElement>('[data-grounding]');onInspect?.(mark?.dataset.conclusionRevision);return false;}},
    onUpdate:({editor})=>onChange(editor.getJSON()),
  });
  useEffect(()=>{if(editor)onReady?.(editor);},[editor,onReady]);
  useEffect(()=>{editor?.setEditable(!readOnly,false);},[editor,readOnly]);
  return <EditorContent editor={editor} onFocusCapture={event=>{const mark=(event.target as HTMLElement)?.closest<HTMLElement>('[data-grounding]');if(mark)onInspect?.(mark.dataset.conclusionRevision);}} />;
}
