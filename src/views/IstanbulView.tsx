import { type Lang, strings } from "@/lib/i18n";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";
import { IstanbulApp } from "@/components/travel/IstanbulApp";

export function IstanbulView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <AuthProvider>
      <SiteHeader lang={lang} path="/travel/istanbul" section="travel" auth />
      <main className="trip-page">
        <h1 className="sr-only">{t.istanbulPageTitle}</h1>
        <IstanbulApp
          lang={lang}
          text={{
            loading: t.istanbulLoading,
            failed: t.istanbulFailed,
            readOnlySignedIn: t.readOnlySignedIn,
            editing: t.editing,
          }}
        />
      </main>
    </AuthProvider>
  );
}
