"use client";

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@/lib/i18n';
import { recipeTextFromPage } from '@/lib/food/recipe-text.mjs';

export function RecipeText({title,yields='',total='',lang}:{title:string;yields?:string;total?:string;lang:Lang}) {
 const details=useRef<HTMLDetailsElement>(null),textarea=useRef<HTMLTextAreaElement>(null);
 const [open,setOpen]=useState(false),[text,setText]=useState(''),[status,setStatus]=useState('');
 const t=(en:string,ru:string)=>lang==='ru'?ru:en;
 useEffect(()=>{
  if(!open)return;
  const root=details.current?.closest('article');
  if(!root)return;
  const refresh=()=>{setText(recipeTextFromPage(root,{title,yields,total,lang}));setStatus('');};
  let frame=requestAnimationFrame(refresh);
  const observer=new MutationObserver(records=>{
   if(records.every(r=>details.current?.contains(r.target)))return;
   cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh);
  });
  observer.observe(root,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-pressed','value']});
  root.addEventListener('input',refresh);root.addEventListener('change',refresh);
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();root.removeEventListener('input',refresh);root.removeEventListener('change',refresh);};
 },[open,title,yields,total,lang]);
 const copy=async()=>{
  const root=details.current?.closest('article');
  const current=root?recipeTextFromPage(root,{title,yields,total,lang}):text;
  setText(current);
  try{await navigator.clipboard.writeText(current);setStatus(t('Copied','Скопировано'));}
  catch{textarea.current?.focus();textarea.current?.select();setStatus(t('Text selected — copy it with your device’s Copy command.','Текст выделен — используйте команду «Копировать» на устройстве.'));}
 };
 return <details className="recipe-text block" ref={details} onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary>{t('Plain-text recipe · expand & copy','Рецепт текстом · раскрыть и скопировать')}</summary>
  {open&&<div className="recipe-text-content">
   <p>{t('Ready to paste into a Reddit post. Uses your selected recipe, portions and units.','Можно вставить в пост на Reddit. Учитывает выбранный рецепт, порции и единицы.')}</p>
   <div className="recipe-text-actions"><button type="button" className="button" onClick={copy}>{t('Copy recipe','Скопировать рецепт')}</button><span role="status" aria-live="polite">{status}</span></div>
   <textarea ref={textarea} value={text} readOnly rows={20} spellCheck={false} aria-label={t('Plain-text recipe','Рецепт текстом')}/>
  </div>}
 </details>;
}
