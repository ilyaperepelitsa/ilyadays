import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export function HomeView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <>
      <SiteHeader lang={lang} path="/" section="home" />
      <main>
        <section className="hello">
          <h1>{t.homeTitle}</h1>
          <p className="lede">{t.homeLede}</p>
        </section>
        <div className="tiles">
          <Link className="tile" href={localPath(lang, "/food")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/food.webp" alt={t.foodCardAlt} width={1200} height={800} />
            <div className="tile-body">
              <h2>{t.food}</h2>
              <p>{t.foodCardText}</p>
              <span className="tile-go">{t.foodCardGo}</span>
            </div>
          </Link>
          <Link className="tile" href={localPath(lang, "/travel")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/travel.webp" alt={t.travelCardAlt} width={1200} height={800} />
            <div className="tile-body">
              <h2>{t.travel}</h2>
              <p>{t.travelCardText}</p>
              <span className="tile-go">{t.travelCardGo}</span>
            </div>
          </Link>
        </div>
        <section className="about" id="about">
          <h2>{t.aboutTitle}</h2>
          <p>{t.aboutText}</p>
          <h3>{t.madeTitle}</h3>
          <ul className="projects">
            <li>
              <a href="https://typekana.com">TypeKana</a> — {t.typekana}
            </li>
            <li>
              <Link href={localPath(lang, "/food")}>{t.recipesProject}</Link> — {t.recipesProjectText}
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
