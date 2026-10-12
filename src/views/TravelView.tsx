import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";
import { SavedTrips } from "@/components/travel/SavedTrips";

export function TravelView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <AuthProvider>
      <SiteHeader lang={lang} path="/travel" section="travel" auth />
      <main>
        <section className="hello">
          <h1>{t.travelTitle}</h1>
          <p className="lede">{t.travelLede}</p>
        </section>
        <div className="tiles tiles-fill">
          <Link className="tile" href={localPath(lang, "/travel/turkey-yacht-food")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small static cover */}
            <img src="/media/travel/turkey-yacht-food/tuna-sashimi.webp" alt={lang==='ru'?'Сашими на столе яхты':'Sashimi on a yacht table'} width={600} height={400}/>
            <div className="tile-body">
              <h2>{lang==='ru'?'Турция · еда на яхте':'Turkey · yacht food'}</h2>
              <p>{lang==='ru'?'Гёчек, 24 октября — примерно 7 ноября. 12 идей блюд, покупки на берегу и гид по продуктам для сашими.':'Göcek, 24 October – around 7 November. Twelve meal ideas, shore shopping and a sashimi buying guide.'}</p>
              <span className="tile-go">{lang==='ru'?'Выбрать блюда':'Browse the shortlist'} →</span>
            </div>
          </Link>
          <Link className="tile" href={localPath(lang, "/travel/istanbul")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/travel.webp" alt={t.travelCardAlt} width={1200} height={800} />
            <div className="tile-body">
              <h2>{t.istanbulTitle}</h2>
              <p>{t.istanbulText}</p>
              <span className="tile-go">{t.istanbulGo}</span>
            </div>
          </Link>
          <Link className="tile tile-plain" href={localPath(lang, "/travel/new")}>
            <div className="tile-body">
              <h2>{t.makeTripTitle}</h2>
              <p>{t.makeTripCard}</p>
              <span className="tile-go">{t.makeTripGo}</span>
            </div>
          </Link>
        </div>
        <SavedTrips lang={lang} />
      </main>
      <SiteFooter>
        <Link href={localPath(lang, "/")}>{t.backHome}</Link>
      </SiteFooter>
    </AuthProvider>
  );
}
