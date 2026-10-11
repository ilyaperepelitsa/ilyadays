import type { Recipe } from "@/lib/content";
import { foodHref, getSvgDefs, getUi } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Html, HeroArt, SvgDefs } from "./parts";
import { BatchCalc } from "./BatchCalc";
import { VinegarPicker } from "./VinegarPicker";
import { Ingredients, Mise, TimelineChart, Steps, NotesAndSources } from "./RecipeSections";

export function RecipeView({ lang, r }: { lang: Lang; r: Recipe }) {
  const t = getUi(lang);
  const hasSvg = !!r.hero.svg_fallback || r.mise.some((m) => m.svg_fallback) || r.steps.some((s) => s.images.svg_fallback || s.images.diagram);
  return (
    <>
      {hasSvg && <SvgDefs svg={getSvgDefs()} />}
      <article className="recipe">
        <div className="recipe-hero">
          <div>
            <p className="eyebrow">
              <a href={`${foodHref(lang)}#${r.group.id}`}>{r.group.name}</a>
            </p>
            <h1>{r.title}</h1>
            <Html as="p" className="lede" html={r.intro_html} />
            <div className="meta">
              {r.chips.map((c, i) => (
                <Html key={i} className={c.kind ? `chip ${c.kind}` : "chip"} html={c.html ?? c.text} />
              ))}
            </div>
            <nav className="jump">
              <a href="#ingredients">{t("Ingredients")}</a>
              {r.mise.length > 0 && <a href="#mise">{t("Mise en place")}</a>}
              {r.timeline && <a href="#timeline">{t("Prep order")}</a>}
              <a href="#steps">{t("Steps")}</a>
              {r.parts.map((p) => (
                <a key={p.id} href={`#${p.id}`}>{p.title}</a>
              ))}
              {r.batch && <a href="#batch">{r.batch.text.title}</a>}
            </nav>
          </div>
          <figure className="hero-art">
            <HeroArt hero={r.hero} eager />
          </figure>
        </div>
        <div className="recipe-body">
          <Ingredients r={r} t={t} lang={lang} />
          <div className="recipe-main">
            <Mise r={r} t={t} />
            {r.timeline && <TimelineChart tl={r.timeline} t={t} />}
            <Steps r={r} t={t} />
            {r.batch && r.vinegar_options && <BatchCalc batch={r.batch} options={r.vinegar_options} lang={lang} />}
            <NotesAndSources r={r} t={t} />
            {r.siblings.length > 0 && (
              <nav className="more">
                <span>{r.more_label}</span>
                {r.siblings.map((x) => (
                  <a key={x.slug} href={foodHref(lang, x.slug)}>{x.title}</a>
                ))}
              </nav>
            )}
          </div>
        </div>
      </article>
      {r.vinegar_options && <VinegarPicker options={r.vinegar_options} />}
    </>
  );
}
