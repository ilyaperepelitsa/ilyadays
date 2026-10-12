import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site/SiteHeader';
import { type Lang, localPath } from '@/lib/i18n';
import data from '../../content/travel/turkey-yacht-food.json';

export const YACHT_SASHIMI_PATH='/travel/turkey-yacht-food/sashimi';

export function TurkeyYachtSashimiView({lang}:{lang:Lang}) {
  const text=(en:string,ru:string)=>lang==='ru'?ru:en;
  const references=(ids:string[])=><span className="yacht-references">{ids.map(id=>{
    const source=data.sources.find(s=>s.id===id)!;
    return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>;
  })}</span>;
  return <>
    <SiteHeader lang={lang} path={YACHT_SASHIMI_PATH} section="travel"/>
    <main className="yacht-food">
      <section className="hello">
        <p className="eyebrow"><Link href={localPath(lang,'/travel')}>{text('Travel','Путешествия')}</Link> / <Link href={localPath(lang,'/travel/turkey-yacht-food')}>{text('Turkey · yacht food','Турция · еда на яхте')}</Link> / {text('Sashimi','Сашими')}</p>
        <h1>{text('Sashimi · all seafood options','Сашими · все варианты')}</h1>
        <p className="lede">{text('Nine options to explore with suppliers, with serving ideas, buying questions and cold-storage guidance in one place. Local stock and suitability for raw eating still need confirmation.','Девять вариантов для обсуждения с поставщиками: идеи подачи, вопросы при покупке и холодное хранение на одной странице. Наличие на месте и пригодность для сырого употребления ещё нужно подтвердить.')}</p>
        <nav className="jump" aria-label={text('Seafood options','Варианты морепродуктов')}>{data.sashimi.map(item=><a href={'#'+item.id} key={item.id}>{item.title[lang]}</a>)}<a href="#supplier-leads">{text('Supplier leads','Где искать')}</a></nav>
      </section>
      <div className="yacht-sashimi-covers">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- existing compressed cover */}
          <img src="/media/travel/turkey-yacht-food/tuna-sashimi.webp" width={600} height={400} alt={text('Tuna sashimi with lemon–soy dip','Сашими из тунца с лимонно-соевым соусом')}/>
          <figcaption>{text('Tuna · lemon–soy, cucumber & sumac onion','Тунец · лимон и соя, огурец и лук с сумахом')}</figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- existing compressed cover */}
          <img src="/media/travel/turkey-yacht-food/scallop-sashimi.webp" width={600} height={400} alt={text('Scallop sashimi with mandarin and chilli','Сашими из гребешка с мандарином и чили')}/>
          <figcaption>{text('Scallop · mandarin & chilli · special-order idea','Гребешок · мандарин и чили · вариант под спецзаказ')}</figcaption>
        </figure>
      </div>
      <section className="group" id="sashimi-guide" aria-labelledby="sashimi-title">
        <h2 id="sashimi-title">{text('What can we actually buy for sashimi?','Что реально покупать для сашими?')}</h2>
        <p className="lede">{text('Göcek is on the Mediterranean coast. Season and sea tell us what may be sold; raw suitability depends on the exact product, parasite controls, handling and cold chain. No species gets an automatic green light.','Гёчек — на средиземноморском побережье. Сезон и море подсказывают ассортимент; возможность сырой подачи зависит от конкретного продукта, контроля паразитов, обработки и холодовой цепи. Ни один вид не получает автоматического разрешения.')}</p>
        <div className="yacht-notes">{data.sashimi.map(item=><article className="note yacht-sashimi-option" key={item.id} id={item.id}>
          <p className="yacht-option-status">{item.specialist?text('Specialist raw-use supply only','Только специальная поставка для сырой подачи'):text('Ask a raw-use supplier first','Сначала уточнить у поставщика для сырой подачи')}</p>
          <h3>{item.title[lang]}</h3><p>{item.text[lang]}</p>
          <p className="yacht-serving"><strong>{text('Serving idea, once sourcing is verified: ','Идея подачи, если поставка подтверждена: ')}</strong>{item.serving[lang]}</p>
          {references(item.sources)}</article>)}</div>
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
    <SiteFooter><Link href={localPath(lang,'/travel/turkey-yacht-food')}>{text('Back to the yacht shortlist','К списку блюд для яхты')}</Link></SiteFooter>
  </>;
}
