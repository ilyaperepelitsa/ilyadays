import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { type RecipeSummary, getFoodIndex, getSvgDefs } from "@/lib/content";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Card } from "@/components/food/FoodIndexView";
import { SvgDefs } from "@/components/food/parts";

/** "2026-10-07 12:00" → "Oct 7" / "7 окт." (UTC, so the build machine's zone doesn't shift the day). */
const addedLabel = (lang: Lang, added: string) =>
  new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${added.slice(0, 10)}T00:00:00Z`),
  );

function RecentlyAdded({ lang }: { lang: Lang }) {
  const t = strings(lang);
  const index = getFoodIndex(lang);
  const bySlug = new Map(index.recipes.map((r) => [r.slug, r]));
  const recent = index.recent.map((s) => bySlug.get(s)).filter((r): r is RecipeSummary => !!r);
  if (!recent.length) return null;
  return (
    <section className="recent" aria-labelledby="recent-title">
      {recent.some((r) => !r.hero.image && r.hero.svg_fallback) && <SvgDefs svg={getSvgDefs()} />}
      <div className="recent-head">
        <h2 id="recent-title">{t.recentTitle}</h2>
        <Link href={localPath(lang, "/food")}>{t.recentAll}</Link>
      </div>
      <div className="cards">
        {recent.map((r) => (
          <Card key={r.slug} lang={lang} r={r} badge={r.added ? addedLabel(lang, r.added) : undefined} />
        ))}
      </div>
    </section>
  );
}

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
        <RecentlyAdded lang={lang} />
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
