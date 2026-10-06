import { Fragment } from "react";
import type { Recipe, Step, Timeline } from "@/lib/content";
import { foodHref, getSvgDefs, getUi, media } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { Html, HeroArt, Illo, Svg, SvgDefs } from "./parts";
import { BatchCalc } from "./BatchCalc";
import { Portions } from "./Portions";
import { VinegarPicker } from "./VinegarPicker";

type T = (key: string) => string;

function Ingredients({ r, t, lang }: { r: Recipe; t: T; lang: Lang }) {
  return (
    <aside className="ingredients-panel" id="ingredients">
      <h2>{t("Ingredients")}</h2>
      <Portions scale={r.scale} slug={r.slug} lang={lang} />
      {r.before_ingredients_html && <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: r.before_ingredients_html }} />}
      {r.ingredients.map((g, i) => (
        <Fragment key={i}>
          <Html as="h3" html={g.name} />
          <ul className="ingredients">
            {g.items.map((it, j) => (
              <li key={j}>
                <Html className="ing-name" html={it.name_html} />
                <Html className="ing-amt" html={it.amount_html} />
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
      {r.equipment_html.length > 0 && (
        <>
          <h3>{t("Equipment")}</h3>
          <ul className="equipment">
            {r.equipment_html.map((e, i) => (
              <Html as="li" key={i} html={e} />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function Mise({ r, t }: { r: Recipe; t: T }) {
  if (!r.mise.length) return null;
  return (
    <section className="block" id="mise">
      <h2>
        {t("Mise en place")} <small>{t("— set out in the order it goes in")}</small>
      </h2>
      <ol className="mise">
        {r.mise.map((b, i) => (
          <li key={i}>
            <figure>{b.image ? <Illo src={b.image} alt={b.name} /> : b.svg_fallback ? <Svg svg={b.svg_fallback} /> : null}</figure>
            <div>
              <Html as="b" html={b.name} />
              {b.as_list ? (
                <ul className="ing mini">
                  {b.items.map((x, j) => (
                    <Html as="li" key={j} html={x} />
                  ))}
                </ul>
              ) : b.items_html ? (
                <Html as="small" html={b.items_html} />
              ) : null}
              <Html className="goes-in" html={b.goes_in} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TimelineChart({ tl, t }: { tl: Timeline; t: T }) {
  const pct = (n: number) => `${n.toFixed(2)}%`;
  return (
    <section className="block" id="timeline">
      <h2>
        {t("Prep order")} <small>{t("— what happens when, and what overlaps")}</small>
      </h2>
      <div className="tl">
        <div className="tl-row tl-axis-row">
          <div className="tl-label tl-unit">{tl.unit}</div>
          <div className="tl-axis">
            {tl.ticks.map((k) => (
              <span key={k.at} style={{ left: pct((100 * k.at) / tl.end) }}>{k.label}</span>
            ))}
          </div>
        </div>
        {tl.tasks.map((task, i) => {
          const left = (100 * task.start) / tl.end;
          const width = Math.max((100 * task.dur) / tl.end, 0.8);
          return (
            <div className="tl-row" key={i}>
              <div className="tl-label">
                <Html html={task.label_html} /> <em>{task.dur_label}</em>
              </div>
              <div className="tl-track">
                <div
                  className={`tl-bar w-${task.kind}`}
                  style={{ left: pct(left), width: pct(width) }}
                  title={`${task.label}: ${task.dur_label}`}
                >
                  {width >= 1.6 * task.dur_label.length ? <span>{task.dur_label}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="tl-legend">
        {tl.legend.map((l) => (
          <span key={l.kind}>
            <i className={`w-${l.kind}`} />
            {l.label}
          </span>
        ))}
      </div>
      {tl.note_html && <Html as="p" className="tl-note" html={tl.note_html} />}
    </section>
  );
}

function StepCard({ s, t }: { s: Step; t: T }) {
  const im = s.images;
  return (
    <li className="step" id={s.id}>
      <figure className={`step-art${im.photo ? " has-photo" : ""}`}>
        {im.photo && (
          // eslint-disable-next-line @next/next/no-img-element -- static photo
          <img className="photo" src={media(im.photo)} alt={s.title} loading="lazy" decoding="async" />
        )}
        {im.how.length > 0 ? (
          <div className="how">
            {im.how.map((h, i) => (
              <figure key={i}>
                <Illo src={h.src} alt={h.caption} />
                <figcaption>{h.caption}</figcaption>
              </figure>
            ))}
          </div>
        ) : im.illustration ? (
          <Illo src={im.illustration} alt={s.title} />
        ) : im.svg_fallback ? (
          <Svg svg={im.svg_fallback} />
        ) : null}
      </figure>
      <div className="step-text">
        <h3>
          <span className="step-n">{s.n}</span>
          {s.title}
        </h3>
        <div className="chips">
          {s.heat && <Html className={`chip ${s.heat.off ? "heat-off" : "heat"}`} html={s.heat.label_html} />}
          {s.time_html && <Html className="chip time" html={s.time_html} />}
        </div>
        {s.uses_rows.length > 0 && (
          <div className="uses">
            <h4>{t("For this step")}</h4>
            <ul>
              {s.uses_rows.map((u, i) => (
                <li key={i}>
                  <Html html={u.name_html} />
                  <Html className="amt" html={u.amount_html} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <Html as="div" className="step-body" html={s.body_html} />
        {im.how.length > 0 && im.result && (
          <figure className="result">
            <Illo src={im.result} alt={s.title} />
            <figcaption>{t("Should look like this")}</figcaption>
          </figure>
        )}
      </div>
    </li>
  );
}

function Steps({ r, t }: { r: Recipe; t: T }) {
  const cards: React.ReactNode[] = [];
  let part: string | null = null;
  for (const s of r.steps) {
    if (s.part && s.part !== part) {
      part = s.part;
      cards.push(
        <li className="part" id={s.part_id ?? undefined} key={`part-${s.part_id}`}>
          <h3>{s.part}</h3>
        </li>,
      );
    }
    cards.push(<StepCard key={s.id} s={s} t={t} />);
  }
  return (
    <section className="block" id="steps">
      <h2>{t("Step by step")}</h2>
      <ol className="steps">{cards}</ol>
    </section>
  );
}

function NotesAndSources({ r, t }: { r: Recipe; t: T }) {
  return (
    <>
      {r.notes.length > 0 && (
        <section className="block notes">
          {r.notes.map((n, i) => (
            <aside className="note" key={i}>
              <Html as="h3" html={n.title_html} />
              <Html as="div" html={n.html} />
            </aside>
          ))}
        </section>
      )}
      {r.sources.length > 0 && (
        <p className="sources">
          {t("Based on:")}{" "}
          {r.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noopener">{s.label}</a>
            </span>
          ))}
        </p>
      )}
      {r.original && (
        <details className="block original">
          <summary>{r.original.label}</summary>
          <pre lang="ru">{r.original.text}</pre>
        </details>
      )}
    </>
  );
}

export function RecipeView({ lang, r }: { lang: Lang; r: Recipe }) {
  const t = getUi(lang);
  const hasSvg = !!r.hero.svg_fallback || r.mise.some((m) => m.svg_fallback) || r.steps.some((s) => s.images.svg_fallback);
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
