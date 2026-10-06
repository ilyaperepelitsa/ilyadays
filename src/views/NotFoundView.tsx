import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export function NotFoundView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <>
      <SiteHeader lang={lang} path="/" section="home" />
      <main>
        <section className="missing">
          <h1>{t.notFoundTitle}</h1>
          <p className="lede">{t.notFoundText}</p>
          <p>
            <Link href={localPath(lang, "/")}>{t.backHome}</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
