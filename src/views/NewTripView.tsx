import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";
import { TripComposer } from "@/components/travel/TripComposer";
import { TripReader } from "@/components/travel/TripReader";

export function NewTripView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <AuthProvider>
      <SiteHeader lang={lang} path="/travel/new" section="travel" auth />
      <main>
        <section className="hello">
          <h1>{t.makeTripTitle}</h1>
          <p className="lede">{t.makeTripLede}</p>
        </section>
        <TripComposer lang={lang} />
      </main>
      <SiteFooter>
        <Link href={localPath(lang, "/travel")}>{t.tripBack}</Link>
      </SiteFooter>
    </AuthProvider>
  );
}

export function MadeTripView({ lang, id }: { lang: Lang; id: string }) {
  const t = strings(lang);
  return (
    <AuthProvider>
      <SiteHeader lang={lang} path="/travel" section="travel" auth />
      <main>
        <TripReader lang={lang} id={id} />
      </main>
      <SiteFooter>
        <Link href={localPath(lang, "/travel")}>{t.tripBack}</Link>
      </SiteFooter>
    </AuthProvider>
  );
}
