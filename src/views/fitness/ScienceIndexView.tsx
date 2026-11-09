// /fitness/science (stream 08): a card per explainer, ordered by the topics' `order`. Static; works with whatever
// topic files exist in content/fitness/science.
import Link from "next/link";
import type { Lang } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { pick } from "@/lib/fitness/i18n";
import { listTopics } from "@/lib/fitness/science";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { minutesText, sourcesText } from "@/components/fitness/science/Article";

export function ScienceIndexView({ lang }: { lang: Lang }) {
  const topics = listTopics(lang);
  return (
    <FitnessShell lang={lang} path="/fitness/science">
      <section className="hello">
        <h1>{pick(lang, "Science", "Наука")}</h1>
        <p className="lede">
          {pick(
            lang,
            "The reasoning behind the plan: how the weights move, how to stay injury-free, what to eat and how to read the charts. Every claim cites its sources.",
            "Логика плана: как растут веса, как тренироваться без травм, что есть и как читать графики. У каждого утверждения есть источник.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/science" />
      {topics.length ? (
        <ol className="fit-tiles fit-sci-list">
          {topics.map((t) => (
            <li key={t.slug}>
              <Link prefetch={false} className="fit-tile fit-sci-card" href={localPath(lang, `/fitness/science/${t.slug}`)}>
                <h2>{t.title}</h2>
                {t.description ? <p>{t.description}</p> : null}
                <p className="fit-sci-card-meta fit-num">
                  {minutesText(t.minutes, lang)}
                  {t.sources ? ` · ${sourcesText(t.sources, lang)}` : null}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="fit-note">{pick(lang, "The explainers are on their way.", "Статьи скоро появятся.")}</p>
      )}
      <p className="fit-note fit-sci-disclaimer">
        {pick(
          lang,
          "Numbers in superscript link to the sources at the end of each page. These pages explain training; they are not medical advice.",
          "Надстрочные цифры ведут к источникам в конце каждой страницы. Эти страницы объясняют тренировки и не заменяют консультацию врача.",
        )}
      </p>
    </FitnessShell>
  );
}
