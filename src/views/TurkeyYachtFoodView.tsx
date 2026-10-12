import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { type Lang, localPath } from '@/lib/i18n';
import data from '../../content/travel/turkey-yacht-food.json';

export const YACHT_FOOD_PATH='/travel/turkey-yacht-food';

export function TurkeyYachtFoodView({lang}:{lang:Lang}) {
  const text=(en:string,ru:string)=>lang==='ru'?ru:en;
  const references=(ids:string[])=><span className="yacht-references">{ids.map(id=>{
    const source=data.sources.find(s=>s.id===id)!;
    return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>;
  })}</span>;
  return <>
    <SiteHeader lang={lang} path={YACHT_FOOD_PATH} section="travel"/>
    <main className="yacht-food">
      <section className="hello">
        <p className="eyebrow"><Link href={localPath(lang,'/travel')}>{text('Travel','Путешествия')}</Link> / {text('Yacht food','Еда на яхте')} / {text('Turkey','Турция')}</p>
        <h1>{text('Turkey: food for two weeks afloat','Турция: две недели еды на яхте')}</h1>
        <p className="yacht-dates">Göcek · {text('24 October – around 7 November 2026','24 октября — примерно 7 ноября 2026')}</p>
        <p className="lede">{text('A seasonal shopping guide for a small galley, with twelve full recipes in Food: Turkish dishes, modern variations and seafood. Each recipe has core ingredients, optional additions and a simpler version, ready to use at home too.','Сезонные закупки для маленького камбуза и двенадцать полных рецептов в разделе «Еда»: турецкие блюда, современные вариации и морепродукты. В каждом — основные ингредиенты, необязательные добавки и упрощённая версия; дома тоже пригодятся.')}</p>
        <nav className="jump" aria-label={text('On this page','На странице')}><a href="#meal-ideas">{text('12 recipes','12 рецептов')}</a><a href="#shopping">{text('Markets & season','Рынки и сезон')}</a><Link href={localPath(lang,'/food/yacht-sashimi')}>{text('All sashimi options','Все варианты сашими')}</Link></nav>
      </section>
      <p className="note yacht-plan-note">{text('Shopping, not fishing. Planned for a hob, one pan, one pot and limited fridge space; no oven, grill or sous vide needed. Raw dishes are conditional on a verified supplier and cold storage.','Закупки, без расчёта на рыбалку. Планируем плиту, одну сковороду, кастрюлю и небольшой холодильник; духовка, гриль и су-вид не нужны. Сырые блюда — только при подтверждённой поставке и холодном хранении.')}</p>
      <section className="group" id="meal-ideas" aria-labelledby="meal-ideas-title">
        <h2 id="meal-ideas-title">{text('Recipes for the trip · and home','Рецепты для поездки и дома')}</h2>
        <div className="yacht-cards">{data.cards.map((card,i)=>{
          const body=<>
            {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized static artwork */}
            <img src={card.image} width={600} height={400} alt={card.title[lang]} loading={i<3?'eager':'lazy'} decoding="async"/>
            <div className="yacht-card-body"><p className="yacht-card-number">{String(i+1).padStart(2,'0')}</p><h3>{card.title[lang]}</h3>
              <div className="chips"><span className="chip">{card.method[lang]}</span><span className={'chip'+(card.raw?' yacht-conditional':'')}>{card.note[lang]}</span></div>
              <p className="yacht-card-go">{card.raw?text('All sashimi options →','Все варианты сашими →'):text('Open full recipe →','Открыть полный рецепт →')}</p>
            </div>
          </>;
          return <Link className="yacht-card yacht-card-link" href={localPath(lang,`/food/${card.recipe_slug}`)} key={card.id} id={card.id}>{body}</Link>;
        })}</div>
        <p className="yacht-research-date">{text('Turkish classics with practical galley adaptations.','Турецкая классика с адаптацией для камбуза.')} {references(['gocek-cuisine','mugla-cuisine'])}</p>
      </section>
      <section className="group" id="shopping" aria-labelledby="shopping-title">
        <h2 id="shopping-title">{text('What to look for ashore','Что искать на берегу')}</h2>
        <p className="yacht-research-date">{text('Researched 13 October 2026. Listings show a starting point, not live branch stock.','Проверено 13 октября 2026. Страницы дают ориентир, а не наличие в конкретном магазине.')}</p>
        <div className="yacht-notes">{data.shopping.map(item=><article className="note" key={item.title.en}><h3>{item.title[lang]}</h3><p>{item.text[lang]}</p>{references(item.sources)}</article>)}</div>
      </section>
      <aside className="note" id="sashimi-guide"><span id="supplier-leads"/>
        <h2>{text('All sashimi on one page','Все сашими на одной странице')}</h2>
        <p>{text('Tuna, salmon, scallops and specialist alternatives: compare all nine options, serving ideas, buying questions and supplier leads together.','Тунец, лосось, гребешки и варианты для специальной поставки: все девять вариантов, идеи подачи, вопросы при покупке и зацепки по поставщикам вместе.')}</p>
        <Link href={localPath(lang,'/food/yacht-sashimi')}>{text('Explore all sashimi options →','Все варианты сашими →')}</Link>
      </aside>
    </main>
    <SiteFooter><Link href={localPath(lang,'/travel')}>{text('Back to Travel','К путешествиям')}</Link></SiteFooter>
  </>;
}
