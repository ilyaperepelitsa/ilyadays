'use client';
import { useEffect, useState, type RefObject } from 'react';
import type { EvidenceLink } from '@/lib/aurelius/types';
import { sourceColor } from './SourceText';

type Line={id:string;d:string;color:string};
export function EvidenceConnectors({root,links,target,mode,refresh}:{root:RefObject<HTMLDivElement|null>;links:EvidenceLink[];target:string;mode:string;refresh:string}){
  const [lines,setLines]=useState<Line[]>([]);
  useEffect(()=>{
    const host=root.current;if(!host)return;let frame=0;
    const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const rect=host.getBoundingClientRect(),to=host.querySelector<HTMLElement>(`[data-target-anchor="${CSS.escape(target)}"]`);
      if(!to){setLines([]);return;}const end=to.getBoundingClientRect();
      const visible=(el:Element,r:DOMRect)=>{const pane=el.closest('.au-pane-body')?.getBoundingClientRect();return !pane||(r.bottom>pane.top&&r.top<pane.bottom);};
      const next:Line[]=[];
      for(const link of links){const el=host.querySelector(`[data-source-anchor="${CSS.escape(link.source_span)}"]`);if(!el)continue;const start=el.getBoundingClientRect();if(!visible(el,start)||!visible(to,end))continue;
        const x1=Math.min(start.right,el.closest('.au-pane-body')!.getBoundingClientRect().right)-rect.left,y1=Math.max(el.closest('.au-pane-body')!.getBoundingClientRect().top+5,Math.min(el.closest('.au-pane-body')!.getBoundingClientRect().bottom-5,start.top+Math.min(12,start.height/2)))-rect.top,x2=end.left-rect.left,y2=end.top+Math.min(38,end.height/2)-rect.top;
        next.push({id:link.id,d:`M${x1},${y1} C${x1+35},${y1} ${x2-35},${y2} ${x2},${y2}`,color:mode==='source'?sourceColor(link.source_span):'var(--muted)'});
      }setLines(next);
    });};
    const observer=new ResizeObserver(update);observer.observe(host);host.querySelectorAll('.au-pane-body,.au-editor,[data-source-anchor]').forEach(el=>observer.observe(el));
    host.addEventListener('scroll',update,true);window.addEventListener('resize',update);update();void document.fonts.ready.then(update);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();host.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);};
  },[root,links,target,mode,refresh]);
  if(mode==='plain')return null;
  return <svg className="au-connectors" aria-hidden="true" data-testid="evidence-connectors"><defs><marker id="au-arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="context-stroke" /></marker></defs>{lines.map(l=><path key={l.id} d={l.d} stroke={l.color} markerEnd="url(#au-arrowhead)" data-evidence-link={l.id} />)}</svg>;
}
