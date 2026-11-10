'use client';
import type { ReactNode } from 'react';
import type { Passage, SourceSpan } from '@/lib/aurelius/types';
import { sourceIntervals,sourceColor,sourceGradient } from '@/lib/aurelius/provenance.mjs';
export {sourceColor} from '@/lib/aurelius/provenance.mjs';
export function SourceText({passage,spans,selected,onSelect,contributors}:{passage:Passage;spans:SourceSpan[];selected:string|null;onSelect:(id:string)=>void;contributors:string[]}){
 return <>{sourceIntervals(passage.text,spans,contributors).map((part:{start:number;text:string;cover:SourceSpan[];contributors:string[]})=>{
  const span=part.cover.find(s=>s.id===selected)??part.cover.find(s=>part.contributors.includes(s.id))??part.cover[0];
  if(!span)return <span key={part.start}>{part.text}</span>;
  const content=part.cover.filter(s=>s.id!==span.id).reduce<ReactNode>((child,s)=><span key={s.id} data-source-anchor={s.id}>{child}</span>,part.text);
  return <mark key={part.start} data-source-anchor={span.id} data-contributor-ids={part.contributors.join(' ')} className={`${selected===span.id?'is-selected ':''}${part.contributors.length?'is-contributor':''}`} style={{'--source-color':sourceColor(span.id),'--au-provenance':sourceGradient(part.contributors)} as React.CSSProperties} role="button" tabIndex={0} title={`Demo ${passage.book}.${passage.section} · ${part.contributors.length?part.contributors.join(' + '):'candidate excerpt'} · exact source ranges`} aria-label={`Inspect excerpt ${passage.book}.${passage.section}`} onFocus={()=>onSelect(span.id)} onClick={()=>onSelect(span.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(span.id);}}}>{content}</mark>;
 })}</>;
}
