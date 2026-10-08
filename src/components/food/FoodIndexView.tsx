import type { FoodIndex } from "@/lib/content";
import { getSvgDefs } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Card } from "./Card";
import { Html, SvgDefs } from "./parts";
import { RecentlyAdded } from "./RecentlyAdded";

export function FoodIndexView({ lang, index }: { lang: Lang; index: FoodIndex }) {
  const bySlug = new Map(index.recipes.map((r) => [r.slug, r]));
  const hasSvg = index.recipes.some((r) => !r.hero.image && r.hero.svg_fallback);
  return (
    <>
      {hasSvg && <SvgDefs svg={getSvgDefs()} />}
      <div className="intro">
        <h1>{index.title}</h1>
        <Html as="p" className="lede" html={index.lede_html} />
      </div>
      <RecentlyAdded lang={lang} />
      {index.groups.map((g) => (
        <section className="group" id={g.id} key={g.id}>
          <h2>{g.name}</h2>
          <div className="cards">
            {g.items.map((slug) => {
              const r = bySlug.get(slug);
              return r ? <Card key={slug} lang={lang} r={r} /> : null;
            })}
          </div>
          {g.notes.length > 0 && (
            <div className="group-notes">
              {g.notes.map((n, i) => (
                <aside className="note" key={i}>
                  <Html as="h3" html={n.title_html} />
                  <Html as="div" html={n.html} />
                </aside>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
