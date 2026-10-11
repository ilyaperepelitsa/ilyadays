"use client";

import type { Recipe } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { foodHref } from "@/lib/paths";
import { ONIGIRI_FILLINGS, ONIGIRI_METHODS } from "@/lib/food/integrated-recipes.mjs";
import { composeOnigiri } from "@/lib/food/onigiri-builder.mjs";
import { useUrlChoice } from "./useUrlChoice";
import { Html, HeroArt } from "./parts";
import { Ingredients, Steps, NotesAndSources } from "./RecipeSections";

export function OnigiriChoices({base,fillings,methods,lang,ui}:{base:Recipe;fillings:Recipe[];methods:Recipe[];lang:Lang;ui:Record<string,string>}) {
  const ru=lang==='ru',text=(en:string,r:string)=>ru?r:en;
  const t=(key:string)=>ui[key]??key;
  const [fillingSlug,setFilling]=useUrlChoice('filling',ONIGIRI_FILLINGS,ONIGIRI_FILLINGS[0]);
  const [methodSlug,setMethod]=useUrlChoice('method',['onigiri',...ONIGIRI_METHODS],'onigiri');
  const filling=fillings.find(r=>r.slug===fillingSlug)!;
  const method=methods.find(r=>r.slug===methodSlug)!;
  const selected=composeOnigiri(base,filling,method,lang) as Recipe;
  const methodName=methodSlug==='onigiri'?text('By hand','Руками'):methodSlug==='onigiri-mold'?text('With a mold','В форме'):text('Through plastic wrap','Через плёнку');
  return <article className="recipe onigiri-builder">
    <div className="recipe-hero">
      <div>
        <p className="eyebrow"><a href={`${foodHref(lang)}#onigiri`}>{base.group.name}</a></p>
        <h1>{text('Onigiri: fillings & shaping','Онигири: начинки и лепка')}</h1>
        <Html as="p" className="lede" html={base.intro_html}/>
        <nav className="jump"><a href="#onigiri-choices-title">{text('Choose filling & method','Начинка и способ лепки')}</a><a href="#ingredients">{t('Ingredients')}</a><a href="#steps">{text('Steps','Шаги')}</a></nav>
      </div>
      <figure className="hero-art"><HeroArt key={filling.slug} hero={filling.hero} eager/></figure>
    </div>
    <section className="block onigiri-controls" aria-labelledby="onigiri-choices-title">
      <h2 id="onigiri-choices-title">{text('Make it your way','Выберите свой вариант')}</h2>
      <fieldset className="sv-choice onigiri-fillings"><legend>{text('1. Filling','1. Начинка')}</legend>
        <div className="sv-buttons">{fillings.map(r=><button type="button" key={r.slug} data-filling={r.slug} aria-pressed={fillingSlug===r.slug} onClick={()=>setFilling(r.slug)}>{r.ingredients[0].name.replace(/\s+\((?:after|по мотивам)\s[^)]*\)$/,'')}</button>)}</div>
      </fieldset>
      <fieldset className="sv-choice onigiri-methods"><legend>{text('2. Shaping method','2. Способ лепки')}</legend><div className="sv-buttons">
        {[["onigiri",text('By hand','Руками')],["onigiri-mold",text('With a mold','В форме')],["onigiri-plastic-wrap",text('Through plastic wrap','Через плёнку')]].map(([slug,label])=><button type="button" key={slug} aria-pressed={methodSlug===slug} onClick={()=>setMethod(slug)}>{label}</button>)}
      </div></fieldset>
      <p className="onigiri-selection" role="status" aria-live="polite" aria-atomic="true"><b>{filling.ingredients[0].name}</b> · {methodName} · {filling.yields}</p>
      <p className="sv-help">{text('Filling preparation: ','Подготовка начинки: ')}{filling.steps[0].time}. {text('Rice cooking is a separate step; skip it if your rice is ready.','Варка риса — отдельный шаг; пропустите его, если рис уже готов.')}</p>
    </section>
    <div className="recipe-body" key={`${fillingSlug}:${methodSlug}`} data-onigiri-selection={`${fillingSlug}:${methodSlug}`}>
      <Ingredients r={selected} t={t} lang={lang}/>
      <div className="recipe-main"><Steps r={selected} t={t}/><NotesAndSources r={selected} t={t}/></div>
    </div>
  </article>;
}
