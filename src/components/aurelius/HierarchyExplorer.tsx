'use client';
import { useMemo,useState } from 'react';
import { hierarchyFrontier } from '@/lib/aurelius/discovery.mjs';
import type { DiscoveryArtifact } from '@/lib/aurelius/persistence';

export type HierarchyNode={id:number;parent:number;distance:number;members:number[];children:number[]};
export function HierarchyExplorer({nodes,points,focus,cut,representatives,selectedIndex,onFocus,onSelectPoint}:{nodes:HierarchyNode[];points:DiscoveryArtifact['points'];focus:number|null;cut:number[];representatives?:number[];selectedIndex:number;onFocus:(id:number|null)=>void;onSelectPoint:(index:number)=>void}){
 const [depth,setDepth]=useState(3),root=focus??nodes.length-1,node=nodes[root];
 const layout=useMemo(()=>hierarchyFrontier(nodes,root,depth),[nodes,root,depth]);
 const positions=new Map(layout.visible.map((v:{id:number;y:number})=>[v.id,{x:100+740*nodes[v.id].distance/(node.distance||1),y:35+v.y*66}]));
 const frontier=new Set(layout.frontier),height=Math.max(150,layout.rows*66+70),ancestors:number[]=[];
 for(let id=root;id>=0;id=nodes[id].parent)ancestors.unshift(id);
 const representative=representatives?.[root];
 return <section className="au-hierarchy" aria-labelledby="au-hierarchy-title" data-testid="hierarchy-explorer">
  <div className="au-discovery-heading"><div><h3 id="au-hierarchy-title">Explore the hierarchy</h3><p>{points.length} source leaves · {points.length-1} stored merges · selected branch: <strong data-testid="branch-size">{node.members.length} passages</strong></p></div><div className="au-button-row"><button type="button" disabled={node.parent<0} onClick={()=>onFocus(node.parent===nodes.length-1?null:node.parent)}>Up one branch</button><button type="button" onClick={()=>onFocus(nodes[selectedIndex].parent)}>Trace selected passage</button><label>Visible levels<select aria-label="Hierarchy visible levels" value={depth} onChange={e=>setDepth(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div></div>
  <nav className="au-tree-breadcrumbs" aria-label="Hierarchy path"><button type="button" aria-current={root===nodes.length-1?'location':undefined} onClick={()=>onFocus(null)}>All {points.length}</button>{ancestors.length>5&&<span>…</span>}{ancestors.filter(id=>id!==nodes.length-1).slice(-4).map(id=><button type="button" key={id} aria-current={id===root?'location':undefined} onClick={()=>onFocus(id)}>{nodes[id].members.length} passages</button>)}</nav>
  <div className="au-tree-scroll"><div className="au-tree-canvas" style={{height}}>
   <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">{layout.edges.map(({from,to}:{from:number;to:number})=>{const a=positions.get(from)!,b=positions.get(to)!;return <path key={`${from}-${to}`} d={`M${a.x} ${a.y}V${b.y}H${b.x}`}/>;})}</svg>
   {layout.visible.map(({id}:{id:number})=>{const n=nodes[id],p=positions.get(id)!;return <button type="button" key={id} data-tree-node={id} className={`au-tree-node ${id===root?'is-root':''} ${frontier.has(id)?'is-frontier':''}`} style={{left:`${p.x/10}%`,top:p.y}} aria-label={n.children.length?`Inspect branch ${id} with ${n.members.length} passages`:`Select passage ${points[id].reference}`} onClick={()=>{onFocus(id===nodes.length-1?null:id);if(!n.children.length)onSelectPoint(id);}}>{n.children.length?<><strong>{n.members.length} passages</strong><small>{frontier.has(id)?'Expand branch':'Inspect branch'}</small></>:<strong>{points[id].reference}</strong>}</button>;})}
  </div></div>
  <p className="au-help">Horizontal position shows merge distance (cosine); this branch spans 0–{node.distance.toFixed(3)}. Collapsed branches retain all their passages. Click a branch to explore it; use Up or All to return. Map colors still show the global cut; passages outside this branch are dimmed.</p>
  {representative!==undefined&&<p className="au-help">Representative of this branch: <button type="button" onClick={()=>onSelectPoint(representative)}>{points[representative].reference} ↗</button> · the source with smallest mean cosine distance within the branch, not a reviewed teaching.</p>}
  <div className="au-tree-cut"><strong>Jump into a group from the global cut</strong><div className="au-button-row">{cut.map((id,i)=><button type="button" key={id} aria-label={`Explore group ${i+1} as a branch`} onClick={()=>onFocus(id)}>Group {i+1}<span>{nodes[id].members.length}</span></button>)}</div></div>
 </section>;
}
