"use client";
import { useEffect, useRef, useState } from "react";
import type { SousVide } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Html, Illo } from "./parts";

const plain=(html:string)=>html.replace(/<[^>]+>/g," ").trim();
export function SousVideTables({lang,tables}:{lang:Lang;tables:SousVide['tables']}) {
  const [state,setState]=useState('all');
  const ru=lang==='ru';
  const reference=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const reveal=()=>{
      const id=window.location.hash.slice(1);
      if (id==='reference'||tables.some(t=>t.id===id)) {
        if (reference.current) reference.current.open=true;
        requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView());
      }
    };
    reveal();
    window.addEventListener('hashchange',reveal);
    return ()=>window.removeEventListener('hashchange',reveal);
  },[tables]);
  return <details className="block sv-reference" id="reference" ref={reference}>
    <summary>{ru?'Полные таблицы и примечания':'Full reference tables & notes'}</summary>
    <fieldset className="sv-filter">
      <legend>{ru?'Показать режимы':'Show schedules'}</legend>
      {[['all',ru?'Оба состояния':'Both states'],['chilled',ru?'Охлаждённое / размороженное':'Chilled / thawed'],['frozen',ru?'Из морозилки':'From frozen']].map(([value,label])=><label key={value}><input type="radio" name="sv-state" value={value} checked={state===value} onChange={()=>setState(value)}/>{label}</label>)}
    </fieldset>
    {tables.map(t=><section className="block sv" id={t.id} key={t.id}>
      <h2>{t.title}</h2>
      {t.image&&<figure className="sv-art"><Illo src={t.image} alt={t.title}/></figure>}
      <div className="table-wrap"><table className="stack">
        <thead><tr>{t.cols.map((c,i)=><th key={i} scope="col" dangerouslySetInnerHTML={{__html:c.label_html}}/>)}</tr></thead>
        <tbody>{t.rows.map((row,i)=>(state==='all'||!t.states||t.states[i]===state||t.states[i]==='both')&&<tr key={i}>{row.map((v,j)=><td key={j} className={t.cols[j]?.numeric?'num':undefined} data-label={plain(t.cols[j]?.label_html??'')}>{v}</td>)}</tr>)}</tbody>
      </table></div>
      {!!t.after_html.length&&<div className="sv-after">{t.after_html.map((a,i)=><Html as="p" key={i} html={a}/>)}</div>}
    </section>)}
  </details>;
}
