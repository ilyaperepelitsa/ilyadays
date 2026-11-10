'use client';
import type { Passage, SourceSpan } from '@/lib/aurelius/types';
import { scalarSlice } from '@/lib/aurelius/domain.mjs';

export const SOURCE_COLORS=['#4779ba','#a86c15','#35856d','#8864b1','#b35f79'];
export function sourceColor(id:string){return SOURCE_COLORS[[...id].reduce((v,c)=>v+c.charCodeAt(0),0)%SOURCE_COLORS.length];}
export function SourceText({passage,spans,selected,onSelect,contributors}:{passage:Passage;spans:SourceSpan[];selected:string|null;onSelect:(id:string)=>void;contributors:string[]}){
  const bounds=[...new Set([0,Array.from(passage.text).length,...spans.flatMap(s=>[s.start,s.end])])].sort((a,b)=>a-b);
  return <>{bounds.slice(0,-1).map((start,i)=>{
    const end=bounds[i+1],text=scalarSlice(passage.text,start,end),cover=spans.filter(s=>s.start<=start&&s.end>=end),span=cover.find(s=>s.id===selected)??cover.find(s=>contributors.includes(s.id))??cover[0];
    return span?<mark key={start} data-source-anchor={span.id} className={`${selected===span.id?'is-selected ':''}${contributors.includes(span.id)?'is-contributor':''}`} style={{'--source-color':sourceColor(span.id)} as React.CSSProperties} role="button" tabIndex={0} aria-label={`Inspect excerpt ${passage.book}.${passage.section}`} onFocus={()=>onSelect(span.id)} onClick={()=>onSelect(span.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(span.id);}}}>{text}</mark>:<span key={start}>{text}</span>;
  })}</>;
}
