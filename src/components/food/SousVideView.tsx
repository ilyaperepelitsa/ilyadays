import type { SousVide } from "@/lib/content";
import { foodHref, getSvgDefs, media } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Html, HeroArt, SvgDefs } from "./parts";

function plain(html: string) {
  return html.replace(/<[^>]+>/g, "").trim();
}

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
        {sv.tables.map((t) => (
          <section className="block sv" id={t.id} key={t.id}>
            <h2>{t.title}</h2>
            <div className="table-wrap">
              <table className="stack">
                <thead>
                  <tr>
                    {t.cols.map((c, i) => (
                      <th key={i} dangerouslySetInnerHTML={{ __html: c.label_html }} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={j} className={t.cols[j]?.numeric ? "num" : undefined} data-label={plain(t.cols[j]?.label_html ?? "")}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {t.after_html.length > 0 && (
              <div className="sv-after">
                {t.after_html.map((a, i) => (
                  <Html as="p" key={i} html={a} />
                ))}
              </div>
            )}
          </section>
        ))}
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
