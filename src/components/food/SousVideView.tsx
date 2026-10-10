import type { SousVide } from "@/lib/content";
import { foodHref, getSvgDefs, media } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Html, HeroArt, SvgDefs } from "./parts";
import { SousVideCalculator } from "./SousVideCalculator";
import { SousVideTables } from "./SousVideTables";

export function SousVideView({ lang, sv }: { lang: Lang; sv: SousVide }) {
  const pdf = media(sv.pdf.src);
  return (
    <>
      {sv.hero.svg_fallback && !sv.hero.image && <SvgDefs svg={getSvgDefs()} />}
      <article className="recipe">
        <div className="recipe-hero">
          <div>
            <p className="eyebrow">
              <a href={`${foodHref(lang)}#${sv.group.id}`}>{sv.group.name}</a>
            </p>
            <h1>{sv.title}</h1>
            <Html as="p" className="lede" html={sv.intro_html} />
            <nav className="jump">
              <a href="#thickness">{lang === "ru" ? "По толщине" : "Thickness calculator"}</a>
              {sv.tables.map((t) => (
                <a key={t.id} href={`#${t.id}`}>{t.title}</a>
              ))}
              <a href="#pdf">{sv.pdf.title}</a>
            </nav>
          </div>
          <figure className="hero-art">
            <HeroArt hero={sv.hero} eager />
          </figure>
        </div>
        <SousVideCalculator lang={lang} />
        <SousVideTables lang={lang} tables={sv.tables} />
        <section className="block" id="pdf">
          <h2>
            {sv.pdf.title} <small>{sv.pdf.subtitle}</small>
          </h2>
          <p>
            <a className="button" href={pdf} target="_blank" rel="noopener">{sv.pdf.open}</a>{" "}
            <a className="button ghost" href={pdf} download>{sv.pdf.download}</a>
          </p>
          <object className="pdf" data={pdf} type="application/pdf">
            <p>{sv.pdf.fallback}</p>
          </object>
        </section>
      </article>
    </>
  );
}
