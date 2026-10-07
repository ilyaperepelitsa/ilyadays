import type { FoodIndex, RecipeSummary } from "@/lib/content";
import { foodHref, getSvgDefs } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Html, HeroArt, SvgDefs } from "./parts";

export function Card({ lang, r, badge }: { lang: Lang; r: RecipeSummary; badge?: string }) {
  return (
    <a className="card" href={foodHref(lang, r.slug)}>
      <div className="card-art">
        <HeroArt hero={r.hero} />
      </div>
      <div className="card-text">
        <h3>{r.title}</h3>
        <Html as="p" html={r.blurb_html} />
        <div className="meta">
          {badge && <span className="chip added">{badge}</span>}
          {r.chips.map((c, i) => (
            <span key={i} className={c.kind ? `chip ${c.kind}` : "chip"}>{c.text}</span>
          ))}
        </div>
      </div>
    </a>
  );
}

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
