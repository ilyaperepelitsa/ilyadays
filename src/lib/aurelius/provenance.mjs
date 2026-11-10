import { scalarLength, scalarSlice } from './domain.mjs';
export const SOURCE_COLORS=['#4479b7','#a56a14','#27816d','#8661ad','#b25275','#397c92','#997326','#6c799a'];
export function sourceColor(id){return SOURCE_COLORS[[...id].reduce((v,c)=>v+c.charCodeAt(0),0)%SOURCE_COLORS.length];}
export function sourceGradient(ids,soft=true){
 const colors=[...new Set(ids)].map(sourceColor);if(!colors.length)return 'none';
 const tone=c=>soft?`color-mix(in srgb,${c} var(--au-highlight-strength,28%),transparent)`:c;
 return colors.length===1?`linear-gradient(110deg,${tone(colors[0])},color-mix(in srgb,${colors[0]} 12%,transparent))`:`linear-gradient(110deg,${colors.map((c,i)=>`${tone(c)} ${100*i/(colors.length-1)}%`).join(',')})`;
}
export function sourceIntervals(text,spans,contributors){
 const bounds=[...new Set([0,scalarLength(text),...spans.flatMap(s=>[s.start,s.end])])].sort((a,b)=>a-b);
 return bounds.slice(0,-1).map((start,i)=>({start,end:bounds[i+1],text:scalarSlice(text,start,bounds[i+1]),cover:spans.filter(s=>s.start<=start&&s.end>=bounds[i+1]),contributors:spans.filter(s=>contributors.includes(s.id)&&s.start<=start&&s.end>=bounds[i+1]).map(s=>s.id)}));
}
export function targetIntervals(text,blockId,mappings,links){
 const activeSources=new Set(links.filter(l=>l.active).map(l=>l.source_span));
 const valid=mappings.filter(m=>m.active&&m.block_id===blockId&&m.start>=0&&m.end<=scalarLength(text)&&m.end>m.start&&scalarSlice(text,m.start,m.end)===m.exact&&m.source_span_ids.length&&m.source_span_ids.every(id=>activeSources.has(id)));
 const bounds=[...new Set([0,scalarLength(text),...valid.flatMap(m=>[m.start,m.end])])].sort((a,b)=>a-b);
 return bounds.slice(0,-1).map((start,i)=>{const covered=valid.filter(m=>m.start<=start&&m.end>=bounds[i+1]);return {start,end:bounds[i+1],sourceIds:[...new Set(covered.flatMap(m=>m.source_span_ids))],mappingIds:covered.map(m=>m.id),granularity:covered.some(m=>m.granularity==='whole_statement')?'whole_statement':'clause'};});
}
