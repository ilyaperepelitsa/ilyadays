import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { type FoodIndex, type RecipeSummary, getFoodIndex, getSvgDefs } from "@/lib/content";
import { Card } from "./Card";
import { SvgDefs } from "./parts";

/** "2026-10-07 12:00" → "Oct 7" / "7 окт." (UTC, so the build machine's zone doesn't shift the day). */
export const addedLabel = (lang: Lang, added: string) =>
  new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${added.slice(0, 10)}T00:00:00Z`),
  );

export function recentRecipes(index: FoodIndex): RecipeSummary[] {
  const bySlug = new Map(index.recipes.map((r) => [r.slug, r]));
  return index.recent.map((slug) => bySlug.get(slug)).filter((r): r is RecipeSummary => !!r);
}

export function RecentlyAdded({ lang, linked }: { lang: Lang; linked?: boolean }) {
  const t = strings(lang);
  const index = getFoodIndex(lang);
  const recent = recentRecipes(index);
  if (!recent.length) return null;
  return (
    <section className="recent group" aria-labelledby="recent-title">
      {recent.some((r) => !r.hero.image && r.hero.svg_fallback) && <SvgDefs svg={getSvgDefs()} />}
      <div className="recent-head">
        <h2 id="recent-title">{t.recentTitle}</h2>
        {linked ? <Link href={localPath(lang, "/food")}>{t.recentAll}</Link> : null}
      </div>
      <div className="cards">
        {recent.map((r) => (
          <Card key={r.slug} lang={lang} r={r} badge={r.added ? addedLabel(lang, r.added) : undefined} />
        ))}
      </div>
    </section>
  );
}
