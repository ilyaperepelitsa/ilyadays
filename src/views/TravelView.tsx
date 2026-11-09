import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";
import { SavedTrips } from "@/components/travel/SavedTrips";
import { ActionIcon } from "@/components/site/ActionIcon";

export function TravelView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <AuthProvider>
      <SiteHeader lang={lang} path="/travel" section="travel" auth />
      <main className="travel-main">
        <section className="hello travel-intro">
          <div><h1>{t.travelTitle}</h1>
          <p className="lede">{lang === "ru" ? "Спланируйте следующую поездку или выберите готовый путеводитель с маршрутами, местами и едой." : "Plan your next trip or explore a guide with walking routes, places and food."}</p></div>
          <Link prefetch={false} className="button travel-create-action" href={localPath(lang, "/travel/new")}><ActionIcon name="plus" />{t.makeTripTitle}</Link>
        </section>
        <SavedTrips lang={lang} />
        <section className="travel-guides"><h2>{lang === "ru" ? "Путеводители" : "Field guides"}</h2>
        <div className="tiles travel-guide-grid">
          <Link prefetch={false} className="tile" href={localPath(lang, "/travel/turkey-yacht-food")}>
            <div className="travel-guide-collage" role="img" aria-label={lang === "ru" ? "Турецкие блюда для камбуза" : "Turkish dishes for the galley"}>
              {['menemen', 'kabak-mucver', 'palamut-tava'].map((dish) => (
                // eslint-disable-next-line @next/next/no-img-element -- existing illustrated dishes in a small guide collage
                <img key={dish} src={`/media/travel/turkey-yacht-food/${dish}.webp`} alt="" width={600} height={400} loading="lazy" />
              ))}
            </div>
            <div className="tile-body">
              <h2>{t.yachtTileTitle}</h2>
              <p>{t.yachtTileText}</p>
              <span className="tile-go">{t.yachtTileGo}</span>
            </div>
          </Link>
          <Link prefetch={false} className="tile" href={localPath(lang, "/travel/istanbul")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/travel.webp" alt={t.travelCardAlt} width={800} height={534} />
            <div className="tile-body">
              <h2>{t.istanbulTitle}</h2>
              <p>{t.istanbulText}</p>
              <span className="tile-go">{t.istanbulGo}</span>
            </div>
          </Link>
        </div>
        </section>
      </main>
      <SiteFooter>
        <Link prefetch={false} href={localPath(lang, "/")}>{t.backHome}</Link>
      </SiteFooter>
    </AuthProvider>
  );
}
