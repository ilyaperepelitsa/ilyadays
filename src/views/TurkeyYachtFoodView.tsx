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
        <p className="lede">{text('Twelve ideas for a small galley: market seafood, lamb beyond kebabs, bright salads and easy pantry meals. Covers first; we’ll turn the favourites into full recipes.','Двенадцать идей для маленького камбуза: покупные морепродукты, баранина не только в виде шашлыка, яркие салаты и простые блюда из запасов. Пока обложки; понравившиеся варианты превратим в полные рецепты.')}</p>
        <nav className="jump" aria-label={text('On this page','На странице')}><a href="#meal-ideas">{text('12 meal ideas','12 идей блюд')}</a><a href="#shopping">{text('Markets & season','Рынки и сезон')}</a><a href="#sashimi-guide">{text('Buying for sashimi','Покупки для сашими')}</a><a href="#supplier-leads">{text('Scallop & tuna leads','Где искать гребешки и тунца')}</a></nav>
      </section>
      <p className="note yacht-plan-note">{text('Shopping, not fishing. Planned for a hob, one pan, one pot and limited fridge space; no oven, grill or sous vide needed. Raw dishes are conditional on a verified supplier and cold storage.','Закупки, без расчёта на рыбалку. Планируем плиту, одну сковороду, кастрюлю и небольшой холодильник; духовка, гриль и су-вид не нужны. Сырые блюда — только при подтверждённой поставке и холодном хранении.')}</p>
      <section className="group" id="meal-ideas" aria-labelledby="meal-ideas-title">
        <h2 id="meal-ideas-title">{text('The first shortlist','Первый список идей')}</h2>
        <div className="yacht-cards">{data.cards.map((card,i)=><article className="yacht-card" key={card.id} id={card.id}>
          {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized static artwork */}
          <img src={card.image} width={600} height={400} alt={card.title[lang]} loading={i<3?'eager':'lazy'} decoding="async"/>
          <div className="yacht-card-body"><p className="yacht-card-number">{String(i+1).padStart(2,'0')}</p><h3>{card.title[lang]}</h3>
            <div className="chips"><span className="chip">{card.method[lang]}</span>{card.raw?<a className="chip yacht-conditional" href="#sashimi-guide">{card.note[lang]}</a>:<span className="chip">{card.note[lang]}</span>}</div>
          </div>
        </article>)}</div>
      </section>
      <section className="group" id="shopping" aria-labelledby="shopping-title">
        <h2 id="shopping-title">{text('What to look for ashore','Что искать на берегу')}</h2>
        <p className="yacht-research-date">{text('Researched 13 October 2026. Listings show a starting point, not live branch stock.','Проверено 13 октября 2026. Страницы дают ориентир, а не наличие в конкретном магазине.')}</p>
        <div className="yacht-notes">{data.shopping.map(item=><article className="note" key={item.title.en}><h3>{item.title[lang]}</h3><p>{item.text[lang]}</p>{references(item.sources)}</article>)}</div>
      </section>
      <section className="group" id="sashimi-guide" aria-labelledby="sashimi-title">
        <h2 id="sashimi-title">{text('What can we actually buy for sashimi?','Что реально покупать для сашими?')}</h2>
        <p className="lede">{text('Göcek is on the Mediterranean coast. Season and sea tell us what may be sold; raw suitability depends on the exact product, parasite controls, handling and cold chain. No species gets an automatic green light.','Гёчек — на средиземноморском побережье. Сезон и море подсказывают ассортимент; возможность сырой подачи зависит от конкретного продукта, контроля паразитов, обработки и холодовой цепи. Ни один вид не получает автоматического разрешения.')}</p>
        <div className="yacht-notes">{data.sashimi.map(item=><article className="note" key={item.title.en}><h3>{item.title[lang]}</h3><p>{item.text[lang]}</p>{references(item.sources)}</article>)}</div>
        <aside className="note yacht-raw-note"><h3>{text('The yacht rule','Правило для яхты')}</h3>
          <p>{text('Buy small sealed lots confirmed for raw consumption, transport on ice and keep at 0–4°C with a fridge thermometer; plan raw seafood for the purchase day. A boat freezer is not a substitute for a documented commercial parasite-control process. Freezing does not remove all germs; lemon and a quick sear do not make an unsuitable raw product suitable. If raw-use controls are unverified, cook seafood only if it has been properly cold-held. Reject or discard seafood whose cold chain has failed; use a pantry meal instead. Thaw in the fridge following the label. Remove vacuum-packed fish labelled keep-frozen from its packaging before fridge thawing.','Покупайте небольшие запечатанные партии, подтверждённые для сырого употребления, перевозите со льдом и храните при 0–4 °C с термометром в холодильнике; сырые морепродукты планируйте на день покупки. Морозилка яхты не заменяет документированный промышленный контроль паразитов. Заморозка не убирает все микробы; лимон и быстрая обжарка не делают неподходящий сырой продукт подходящим. Если контроль для сырой подачи не подтверждён, готовьте рыбу только при соблюдённом холодном хранении. Не покупайте или выбрасывайте морепродукты с нарушенной холодовой цепью; используйте запасы. Размораживайте в холодильнике по инструкции. Рыбу в вакуумной упаковке с указанием хранить замороженной выньте из упаковки до размораживания в холодильнике.')}</p>
          {references(['fda','parasites','histamine'])}
        </aside>
        <details className="yacht-ask"><summary>{text('What to ask the fishmonger · Turkish phrases','Что спросить у продавца · фразы на турецком')}</summary>
          <p lang="tr">Bu ürünü çiğ, sashimi olarak yemek istiyoruz. Çiğ tüketime uygun mu? Balığın tam türü nedir? Yetiştirme ve yem bilgisi veya parazit kontrolü için dondurma kaydı var mı? Tedarikçi belgesini görebilir miyiz? Soğuk zincir nasıl korundu?</p>
          <p>{text('“We want to eat this raw as sashimi. Is it suitable for raw consumption? What is the exact species? Do you have farm/feed information or parasite-control freezing records? Can we see the supplier documentation? How was the cold chain maintained?”','«Хотим есть этот продукт сырым, как сашими. Подходит ли он для сырого употребления? Какой точный вид рыбы? Есть сведения о выращивании и корме или записи противопаразитарной заморозки? Можно увидеть документы поставщика? Как поддерживалась холодовая цепь?»')}</p>
        </details>
      </section>
      <section className="group" id="supplier-leads" aria-labelledby="leads-title"><h2 id="leads-title">{text('Actual leads to check before boarding','Конкретные зацепки до посадки')}</h2>
        <p>{text('Scallops are sold in Turkey; that does not establish stock in Göcek or delivery to the marina. These are enquiries to make, not confirmed orders.','Гребешки продаются в Турции, но это не подтверждает наличие в Гёчеке или доставку в марину. Это варианты для уточнения, не подтверждённые заказы.')}</p>
        <div className="yacht-notes">{data.leads.map(item=><article className="note" key={item.title.en}><h3>{item.title[lang]}</h3><p>{item.text[lang]}</p>{references(item.sources)}</article>)}</div>
      </section>
    </main>
    <SiteFooter><Link href={localPath(lang,'/travel')}>{text('Back to Travel','К путешествиям')}</Link></SiteFooter>
  </>;
}
