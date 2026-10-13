"use client";

import type { Recipe, OnigiriWrapping } from '@/lib/content';
import type { Lang } from '@/lib/i18n';
import { foodHref } from '@/lib/paths';
import { ONIGIRI_RECIPES, ONIGIRI_METHODS, ONIGIRI_WRAPPINGS, FIXED_ONIGIRI_FORMATS, onigiriSelection } from '@/lib/food/integrated-recipes.mjs';
import { composeOnigiriSelection, onigiriLabel } from '@/lib/food/onigiri-selection.mjs';
import { useUrlChoice } from './useUrlChoice';
import { HeroArt } from './parts';
import { Ingredients, Mise, Steps, NotesAndSources } from './RecipeSections';

export function OnigiriChoices({base,fillings,methods,wrappings,lang,ui}:{base:Recipe;fillings:Recipe[];methods:Recipe[];wrappings:OnigiriWrapping[];lang:Lang;ui:Record<string,string>}) {
 const text=(en:string,ru:string)=>lang==='ru'?ru:en,t=(key:string)=>ui[key]??key;
 const [recipeSlug,setRecipe]=useUrlChoice('filling',ONIGIRI_RECIPES,ONIGIRI_RECIPES[0]);
 const [methodQuery,setMethod]=useUrlChoice('method',['onigiri',...ONIGIRI_METHODS],'onigiri');
 const [wrapQuery,setWrap]=useUrlChoice('wrapping',ONIGIRI_WRAPPINGS,recipeSlug==='yaki-onigiri'?'none':'strip');
 const choice=onigiriSelection(recipeSlug,methodQuery,wrapQuery);
 const filling=fillings.find(r=>r.slug===choice.recipe)!;
 const method=methods.find(r=>r.slug===(choice.method==='recipe'?'onigiri':choice.method))!;
 const wrapping=wrappings.find(w=>w.id===(choice.wrapping==='pork'?'none':choice.wrapping==='sandwich'?'full':choice.wrapping==='band'?'strip':choice.wrapping))!;
 const selected=composeOnigiriSelection(base,filling,method,wrapping,lang) as Recipe;
 const fixed=FIXED_ONIGIRI_FORMATS.includes(recipeSlug);
 const fixedShape=recipeSlug==='onigirazu'?text('Layered rice sandwich','Слоёный рисовый сэндвич'):recipeSlug==='spam-musubi'?text('Pressed musubi block','Прессованный мусуби'):text('Rice barrels for pork wrapping','Рисовые бочонки для свинины');
 const fixedWrap=recipeSlug==='onigirazu'?text('Folded nori sheet + cling-film rest','Сложенный лист нори + отдых в плёнке'):recipeSlug==='spam-musubi'?text('Nori band around rice and Spam','Полоска нори вокруг риса и спама'):text('Pork wrap + optional shiso leaf','Обёртка из свинины + лист сисо по желанию');
 const methodLabel=choice.method==='onigiri'?text('By hand','Руками'):choice.method==='onigiri-mold'?text('With a mold','В форме'):choice.method==='recipe'?fixedShape:text('Through cling film','Через пищевую плёнку');
 return <article className="recipe onigiri-builder">
  <div className="recipe-hero"><div><p className="eyebrow"><a href={`${foodHref(lang)}#onigiri`}>{base.group.name}</a></p>
   <h1>{text('Onigiri: recipes, shaping & wrapping','Онигири: рецепты, лепка и обёртки')}</h1>
   <p className="lede">{text('All sixteen recipes in one place: shop-inspired fillings, mixed rice, grilled and pork-wrapped onigiri, rice sandwiches and musubi. Choose a recipe, then its shaping and wrapping.','Все шестнадцать рецептов здесь: начинки по мотивам японских лавок, смешанный рис, жареные онигири и варианты в свинине, рисовые сэндвичи и мусуби. Выберите рецепт, затем лепку и обёртку.')}</p>
   <nav className="jump"><a href="#onigiri-choices-title">{text('Choose recipe & methods','Выбрать рецепт и способы')}</a><a href="#ingredients">{t('Ingredients')}</a>{selected.mise.length>0&&<a href="#mise">{t('Mise en place')}</a>}<a href="#steps">{text('Steps','Шаги')}</a></nav></div>
   <figure className="hero-art"><HeroArt key={filling.slug} hero={filling.hero} eager/><figcaption>{text('Selected recipe · serving or filling preview','Выбранный рецепт · подача или начинка')}</figcaption></figure></div>
  <section className="block onigiri-controls" aria-labelledby="onigiri-choices-title"><h2 id="onigiri-choices-title">{text('Make it your way','Выберите свой вариант')}</h2>
   <fieldset className="sv-choice onigiri-fillings"><legend>{text('1. Recipe / filling','1. Рецепт / начинка')}</legend><div className="sv-buttons">{fillings.map(r=><button type="button" key={r.slug} data-filling={r.slug} aria-pressed={recipeSlug===r.slug} onClick={()=>setRecipe(r.slug)}>{onigiriLabel(r,lang)}</button>)}</div></fieldset>
   <fieldset className="sv-choice onigiri-methods"><legend>{text('2. Shaping','2. Лепка')}</legend><div className="sv-buttons">{fixed?<button type="button" aria-pressed="true" disabled>{fixedShape}</button>:[['onigiri',text('By hand','Руками')],['onigiri-mold',text('With a mold','В форме')],['onigiri-plastic-wrap',text('Through cling film','Через пищевую плёнку')]].map(([id,label])=><button type="button" key={id} data-method={id} aria-pressed={choice.method===id} onClick={()=>setMethod(id)}>{label}</button>)}</div></fieldset>
   <fieldset className="sv-choice onigiri-wrappings"><legend>{text('3. Wrapping','3. Обёртка')}</legend><div className="sv-buttons">{fixed?<button type="button" aria-pressed="true" disabled>{fixedWrap}</button>:wrappings.map(w=><button type="button" key={w.id} data-wrapping={w.id} aria-pressed={choice.wrapping===w.id} onClick={()=>setWrap(w.id)}>{w.title}</button>)}</div></fieldset>
   {fixed&&<p className="sv-help">{text('This recipe includes its own shaping and structural wrapping; follow its illustrated steps below.','В этом рецепте свои форма и обёртка, которые удерживают начинку; следуйте иллюстрированным шагам ниже.')}</p>}
   <p className="onigiri-selection" role="status" aria-live="polite" aria-atomic="true"><b>{onigiriLabel(filling,lang)}</b> · {methodLabel} · {fixed?fixedWrap:wrapping.title} · {filling.yields}</p>
  </section>
  <div className="recipe-body" key={`${choice.recipe}:${choice.method}:${choice.wrapping}`} data-onigiri-selection={`${choice.recipe}:${choice.method}:${choice.wrapping}`}>
   <Ingredients r={selected} t={t} lang={lang}/><div className="recipe-main"><Mise r={selected} t={t}/><Steps r={selected} t={t}/><NotesAndSources r={selected} t={t}/></div>
  </div>
 </article>;
}
