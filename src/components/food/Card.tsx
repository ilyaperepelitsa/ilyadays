import type { RecipeSummary } from "@/lib/content";
import { foodHref } from "@/lib/paths";
import type { Lang } from "@/lib/i18n";
import { Html, HeroArt } from "./parts";

/** `eager`: a card above the fold, whose picture is the page's largest paint. */
export function Card({ lang, r, badge, eager }: { lang: Lang; r: RecipeSummary; badge?: string; eager?: boolean }) {
  return (
    <a className="card" href={foodHref(lang, r.slug)}>
      <div className="card-art">
        <HeroArt hero={r.hero} card eager={eager} />
      </div>
      <div className="card-text">
        <h3>{r.title}</h3>
        <Html as="p" html={r.blurb_html} />
        <div className="meta">
          {badge ? <span className="when">{badge}</span> : null}
          {r.chips.map((c, i) => (
            <span key={i} className={c.kind ? `chip ${c.kind}` : "chip"}>{c.text}</span>
          ))}
        </div>
      </div>
    </a>
  );
}
