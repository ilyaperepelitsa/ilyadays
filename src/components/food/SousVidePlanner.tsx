"use client";

import { useState } from "react";
import type { SousVide } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { cookingPresets } from "@/lib/sous-vide-presets.mjs";
import { SousVideCalculator } from "./SousVideCalculator";
import { Html } from "./parts";
import { useUrlChoice } from "./useUrlChoice";

export function SousVidePlanner({lang,tables}:{lang:Lang;tables:SousVide['tables']}) {
  const ru=lang==='ru';
  const t=(en:string,r:string)=>ru?r:en;
  const [food,setFood]=useUrlChoice('food',['meat','salmon','salmon-pasteurized','lean-fish','chicken-breast','drumsticks','beef','pork-ribs','lamb','lamb-slices','vegetables'],'meat');
  const [state,setState]=useState('chilled');
  const [choice,setChoice]=useState('');
  const foods=[
    ['meat',t('Meat · by thickness','Мясо · по толщине')],
    ['salmon',t('Salmon · soft','Лосось · нежный')],
    ['salmon-pasteurized',t('Salmon · pasteurized','Лосось · пастеризация')],
    ['lean-fish',t('Lean fish','Нежирная рыба')],
    ['chicken-breast',t('Chicken breast','Куриная грудка')],
    ['drumsticks',t('Drumsticks','Куриные голени')],
    ['beef',t('Ribeye · recipe','Рибай · по рецепту')],
    ['pork-ribs',t('Pork ribs','Свиные рёбра')],
    ['lamb',t('Lamb shank','Баранья голяшка')],
    ['lamb-slices',t('Lamb slices','Баранина ломтиками')],
    ['vegetables',t('Vegetables','Овощи')],
  ];
  const calculated=['meat','salmon','salmon-pasteurized','lean-fish'].includes(food);
  const table=tables.find(table=>table.id===food);
  const presets=table?cookingPresets(table,state):[];
  const selected=presets.find(p=>p.id===choice)??presets[0];
  return <section className="block sv-planner" id="thickness">
    <h2>{t('Choose your cook','Выберите режим')}</h2>
    <fieldset className="sv-choice"><legend>{t('1. Food & cut','1. Продукт и отруб')}</legend>
      <div className="sv-buttons sv-foods">{foods.map(([id,label])=><button type="button" key={id} aria-pressed={food===id} onClick={()=>{setFood(id);setChoice('');}}>{label}</button>)}</div>
    </fieldset>
    <fieldset className="sv-choice"><legend>{t('2. Starting state','2. Начальное состояние')}</legend>
      <div className="sv-buttons">{[['chilled',t('Chilled / thawed · 5°C','Охлаждённое / размороженное · 5 °C')],['frozen',t('Frozen · −18°C','Замороженное · −18 °C')]].map(([id,label])=><button type="button" key={id} aria-pressed={state===id} onClick={()=>setState(id)}>{label}</button>)}</div>
    </fieldset>
    {calculated?<SousVideCalculator key={food} lang={lang} food={food} state={state}/>:<>
      <fieldset className="sv-choice"><legend>{t('3. Size & texture preset','3. Размер и желаемая текстура')}</legend>
        <div className="sv-buttons">{presets.map(p=><button type="button" key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>setChoice(p.id)}>{p.label}<span className="sv-preset-temp">{p.temperature}</span></button>)}</div>
      </fieldset>
      <p className="sv-help">{t('Choose the listed size and texture. These recipe windows include tenderizing where needed; use the full schedule for your cut.','Выберите указанный размер и текстуру. Режимы учитывают размягчение там, где оно нужно; используйте полное время для выбранного отруба.')}</p>
      {selected?<div className="sv-answer" role="status" aria-live="polite" aria-atomic="true">
        <p className="sv-result-label">{selected.label} · {state==='frozen'?t('From frozen','Из замороженного'):t('Chilled / thawed','Охлаждённое / размороженное')}</p>
        <div className="sv-preset-result"><p className="sv-time">{selected.temperature}</p><span> / </span><p className="sv-time">{selected.time}</p></div>
        <p>{selected.note}</p>
      </div>:<p role="status">{t('No published preset for this combination.','Для этого сочетания нет опубликованного режима.')}</p>}
      {table&&<div className="sv-help sv-preset-notes">{table.after_html.map((html,i)=><Html key={i} as="p" html={html}/>)}</div>}
    </>}
  </section>;
}
