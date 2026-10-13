import type { Lang } from '@/lib/i18n';
import data from '../../../content/travel/turkey-yacht-food.json';

/** Shared sourcing, cold-storage guidance and supplier leads for every seafood selection. */
export function SashimiOptions({lang}:{lang:Lang}) {
  const text=(en:string,ru:string)=>lang==='ru'?ru:en;
  const references=(ids:string[])=><span className="yacht-references">{ids.map(id=>{
    const source=data.sources.find(s=>s.id===id)!;
    return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>;
  })}</span>;
  return <>
    <section className="block" id="sashimi-guide" aria-label={text('Sourcing and cold storage','Закупки и холодное хранение')}>
        <aside className="note yacht-raw-note"><h3>{text('The yacht rule','Правило для яхты')}</h3>
          <p>{text('Buy small sealed lots confirmed for raw consumption, transport on ice and keep at 0–4°C with a fridge thermometer; plan raw seafood for the purchase day. A boat freezer is not a substitute for a documented commercial parasite-control process. Freezing does not remove all germs; lemon and a quick sear do not make an unsuitable raw product suitable. If raw-use controls are unverified, cook seafood only if it has been properly cold-held. Reject or discard seafood whose cold chain has failed; use a pantry meal instead. Thaw in the fridge following the label. Remove vacuum-packed fish labelled keep-frozen from its packaging before fridge thawing.','Покупайте небольшие запечатанные партии, подтверждённые для сырого употребления, перевозите со льдом и храните при 0–4 °C с термометром в холодильнике; сырые морепродукты планируйте на день покупки. Морозилка яхты не заменяет документированный промышленный контроль паразитов. Заморозка не убирает все микробы; лимон и быстрая обжарка не делают неподходящий сырой продукт подходящим. Если контроль для сырой подачи не подтверждён, готовьте рыбу только при соблюдённом холодном хранении. Не покупайте или выбрасывайте морепродукты с нарушенной холодовой цепью; используйте запасы. Размораживайте в холодильнике по инструкции. Рыбу в вакуумной упаковке с указанием хранить замороженной выньте из упаковки до размораживания в холодильнике.')}</p>
          {references(['fda','parasites','histamine'])}
        </aside>
        <details className="yacht-ask"><summary>{text('What to ask the fishmonger · Turkish phrases','Что спросить у продавца · фразы на турецком')}</summary>
          <p lang="tr">Bu ürünü çiğ, sashimi olarak yemek istiyoruz. Çiğ tüketime uygun mu? Balığın tam türü nedir? Yetiştirme ve yem bilgisi veya parazit kontrolü için dondurma kaydı var mı? Tedarikçi belgesini görebilir miyiz? Soğuk zincir nasıl korundu?</p>
          <p>{text('“We want to eat this raw as sashimi. Is it suitable for raw consumption? What is the exact species? Do you have farm/feed information or parasite-control freezing records? Can we see the supplier documentation? How was the cold chain maintained?”','«Хотим есть этот продукт сырым, как сашими. Подходит ли он для сырого употребления? Какой точный вид рыбы? Есть сведения о выращивании и корме или записи противопаразитарной заморозки? Можно увидеть документы поставщика? Как поддерживалась холодовая цепь?»')}</p>
        </details>
      </section>
      <section className="block" id="supplier-leads" aria-labelledby="leads-title"><h2 id="leads-title">{text('Actual leads to check before boarding','Конкретные зацепки до посадки')}</h2>
        <p>{text('Scallops are sold in Turkey; that does not establish stock in Göcek or delivery to the marina. These are enquiries to make, not confirmed orders.','Гребешки продаются в Турции, но это не подтверждает наличие в Гёчеке или доставку в марину. Это варианты для уточнения, не подтверждённые заказы.')}</p>
        <div className="yacht-notes">{data.leads.map(item=><article className="note" key={item.title.en}><h3>{item.title[lang]}</h3><p>{item.text[lang]}</p>{references(item.sources)}</article>)}</div>
      </section>
  </>;
}
