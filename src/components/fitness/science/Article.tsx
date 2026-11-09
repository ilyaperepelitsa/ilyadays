import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { fmtDate, pick, pluralRu } from "@/lib/fitness/i18n";
import type { ScienceSource, Topic, TocItem } from "@/lib/fitness/science";

/** "doi:10.1519/…" for DOIs, the bare host for everything else. */
function sourceLabel(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "doi.org" || u.hostname === "dx.doi.org") return `doi:${decodeURIComponent(u.pathname.slice(1))}`;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "23 sources" / "23 источника". */
export const sourcesText = (n: number, lang: Lang) =>
  pick(lang, `${n} ${n === 1 ? "source" : "sources"}`, `${n} ${pluralRu(n, ["источник", "источника", "источников"])}`);

/** "8 min read" / "8 мин чтения". */
export const minutesText = (n: number, lang: Lang) => pick(lang, `${n} min read`, `${n} мин чтения`);

/** "8 November 2026" / "8 ноября 2026 г." — in UTC, so a build machine west of Greenwich does not print the 7th. */
export const updatedText = (iso: string, lang: Lang) =>
  fmtDate(iso, lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type Entry = { id: string; text: string; subs: TocItem[] };

/** h2 entries with their h3 children. */
function outline(toc: TocItem[]): Entry[] {
  const out: Entry[] = [];
  for (const item of toc) {
    const last = out[out.length - 1];
    if (item.level === 3 && last) last.subs.push(item);
    else out.push({ id: item.id, text: item.text, subs: [] });
  }
  return out;
}

function TocList({ entries }: { entries: Entry[] }) {
  return (
    <ol className="fit-toc-list">
      {entries.map((e) => (
        <li key={e.id}>
          <a href={`#${e.id}`}>{e.text}</a>
          {e.subs.length ? (
            <ol>
              {e.subs.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.text}</a>
                </li>
              ))}
            </ol>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function SourceItem({ s, lang }: { s: ScienceSource; lang: Lang }) {
  // source titles stay in their original language (English): tell screen readers on the Russian page
  const english = lang === "ru" && !/[А-Яа-яЁё]/.test(s.text);
  return (
    <li id={`src-${s.n}`} value={s.n} lang={english ? "en" : undefined}>
      <span className="fit-src-title">{s.title || s.text}</span>
      {s.outlet ? (
        <>
          {" — "}
          <i>{s.outlet}</i>
        </>
      ) : null}
      {s.year ? `, ${s.year}` : null}.
      {s.url ? (
        <>
          {" "}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {sourceLabel(s.url)}
          </a>
        </>
      ) : null}
    </li>
  );
}

/**
 * One science explainer (stream 08), server-rendered: header (title, lede, updated date, reading time, source count),
 * the `nav` slot (the fitness sub-navigation goes right under the title, as on every fitness page), then the table
 * of contents (a closed <details> on phones, a sticky list beside the text on wide screens), the body (`.fit-article`,
 * HTML from our own escaping markdown renderer) and the numbered sources with `id="src-n"` for the [n] links.
 */
export function Article({ lang, topic, nav }: { lang: Lang; topic: Topic; nav?: ReactNode }) {
  const sourcesTitle = pick(lang, "Sources", "Источники");
  const contents = pick(lang, "Contents", "Содержание");
  const entries = outline(topic.sources.length ? [...topic.toc, { id: "sources", text: sourcesTitle, level: 2 }] : topic.toc);
  const updated = updatedText(topic.updated, lang);
  return (
    <>
      <header className="hello fit-sci-head">
        <p className="fit-sci-kicker">
          <Link prefetch={false} href={localPath(lang, "/fitness/science")}>
            {pick(lang, "Science", "Наука")}
          </Link>
        </p>
        <h1>{topic.title}</h1>
        {topic.description ? <p className="lede">{topic.description}</p> : null}
        <p className="fit-sci-meta">
          {updated ? (
            <>
              {pick(lang, "Updated", "Обновлено")} <time dateTime={topic.updated}>{updated}</time>
              {" · "}
            </>
          ) : null}
          {minutesText(topic.minutes, lang)}
          {topic.sources.length ? ` · ${sourcesText(topic.sources.length, lang)}` : null}
        </p>
      </header>
      {nav}
      <div className="fit-sci">
        {entries.length > 1 ? (
          <>
            <details className="fit-toc fit-toc-phone">
              <summary>
                {contents} <span className="fit-sci-count fit-num">{entries.length}</span>
              </summary>
              <nav aria-label={contents}>
                <TocList entries={entries} />
              </nav>
            </details>
            <nav className="fit-toc fit-toc-wide" aria-label={contents}>
              <p className="fit-toc-title">{contents}</p>
              <TocList entries={entries} />
            </nav>
          </>
        ) : null}
        <article className="fit-sci-main">
          <div className="fit-article" dangerouslySetInnerHTML={{ __html: topic.html }} />
          {topic.sources.length ? (
            <section className="fit-sources" aria-labelledby="sources">
              <h2 id="sources">{sourcesTitle}</h2>
              <ol>
                {topic.sources.map((s) => (
                  <SourceItem key={s.n} s={s} lang={lang} />
                ))}
              </ol>
            </section>
          ) : null}
        </article>
      </div>
    </>
  );
}
