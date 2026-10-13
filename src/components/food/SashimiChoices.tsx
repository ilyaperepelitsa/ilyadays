"use client";

import { RecipeText } from "./RecipeText";

import type { ReactNode } from 'react';
import type { Recipe } from '@/lib/content';
import { type Lang, localPath } from '@/lib/i18n';
import { foodHref } from '@/lib/paths';
import { useUrlChoice } from './useUrlChoice';
import { SASHIMI_SPECIES } from '@/lib/food/sashimi.mjs';
import { Html, HeroArt, Illo } from './parts';
import { Ingredients, Mise, Steps, NotesAndSources } from './RecipeSections';

export function SashimiChoices({base, variants, lang, ui, sourcing}: {
  base: Recipe; variants: Recipe[]; lang: Lang; ui: Record<string,string>; sourcing: ReactNode;
}) {
  const text=(en:string,ru:string)=>lang==='ru'?ru:en;
  const t=(key:string)=>ui[key]??key;
  const [id,setId]=useUrlChoice('seafood',SASHIMI_SPECIES,'tuna');
  const selected=variants.find(r=>r.slug===`sashimi-${id}`)!;
  return <article className="recipe sashimi-builder">
    <div className="recipe-hero">
      <div>
        <p className="eyebrow"><a href={`${foodHref(lang)}#${base.group.id}`}>{base.group.name}</a></p>
        <h1>{text('Sashimi: choose your seafood','Сашими: выберите морепродукт')}</h1>
        <p className="lede">{text('Nine complete preparations. Choose seafood to change the ingredients, preparation pictures and cutting method.','Девять полных вариантов. Выберите морепродукт: изменятся ингредиенты, иллюстрации подготовки и способ нарезки.')}</p>
        <p><a href={localPath(lang,'/travel/turkey-yacht-food#shopping')}>{text('Göcek · 24 October–7 November · shopping and suppliers','Гёчек · 24 октября–7 ноября · закупки и поставщики')}</a></p>
        <nav className="jump"><a href="#seafood-choices">{text('Choose seafood','Выбрать морепродукт')}</a><a href="#mise">{t('Mise en place')}</a><a href="#ingredients">{t('Ingredients')}</a><a href="#steps">{t('Steps')}</a><a href="#supplier-leads">{text('Supplier leads','Где искать')}</a></nav>
      </div>
      <figure className="hero-art"><HeroArt key={selected.slug} hero={selected.hero} eager/></figure>
    </div>
    <section className="block onigiri-controls sashimi-controls" aria-labelledby="seafood-choices">
      <h2 id="seafood-choices">{text('Choose seafood','Выберите морепродукт')}</h2>
      <fieldset className="sv-choice"><legend>{text('Seafood · the whole recipe changes below','Морепродукт · весь рецепт ниже изменится')}</legend>
        <div className="sv-buttons sashimi-buttons">{variants.map(r=>{
          const value=r.slug.replace('sashimi-','');
          return <button type="button" key={r.slug} data-seafood={value} aria-pressed={id===value} onClick={()=>setId(value)}>
            {r.mise[0]?.image&&<Illo src={r.mise[0].image} alt=""/>}
            <span>{r.title.replace(/ sashimi$| — сашими$/,'')}</span>
          </button>;
        })}</div>
      </fieldset>
      <p className="onigiri-selection" role="status" aria-live="polite" aria-atomic="true"><b>{selected.title}</b></p>
      <Html as="p" className="sv-help" html={selected.intro_html}/>
    </section>
    <RecipeText title={selected.title} yields={selected.yields} total={selected.total} lang={lang}/>
    <div className="recipe-body" key={selected.slug} data-sashimi-selection={id}>
      <Ingredients r={selected} t={t} lang={lang}/>
      <div className="recipe-main"><Mise r={selected} t={t}/><Steps r={selected} t={t}/><NotesAndSources r={selected} t={t}/>{sourcing}</div>
    </div>
  </article>;
}
