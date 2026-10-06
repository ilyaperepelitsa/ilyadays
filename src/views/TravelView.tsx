import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";

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
          <Link className="tile" href={localPath(lang, "/travel/istanbul")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/travel.webp" alt={t.travelCardAlt} width={1200} height={800} />
            <div className="tile-body">
              <h2>{t.istanbulTitle}</h2>
              <p>{t.istanbulText}</p>
              <span className="tile-go">{t.istanbulGo}</span>
            </div>
          </Link>
        </div>
      </main>
      <SiteFooter>
        <Link href={localPath(lang, "/")}>{t.backHome}</Link>
      </SiteFooter>
    </AuthProvider>
  );
}
