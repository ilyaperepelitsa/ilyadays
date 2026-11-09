import type { Lang } from "@/lib/fitness/types";
import { keepUnits, pick } from "@/lib/fitness/i18n";
import { RULES, SOURCES } from "@/lib/fitness/nutrition.mjs";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { NutritionCalc } from "@/components/fitness/nutrition/NutritionCalc";
import { HeartCard } from "@/components/fitness/nutrition/HeartCard";
import { FoodTable } from "@/components/fitness/nutrition/FoodTable";
import { Refs, sourceAnchor } from "@/components/fitness/nutrition/ui";

/** "pubmed.ncbi.nlm.nih.gov" from a URL, for a compact link label. */
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * /fitness/nutrition (stream 09 — plans/fitness/09-nutrition.md): energy and protein calculator, heart-rate zones and
 * VO2max estimates, the protein food table, then the rules and numbered sources (static HTML).
 */
export function NutritionView({ lang }: { lang: Lang }) {
  return (
    <FitnessShell lang={lang} path="/fitness/nutrition">
      <section className="hello">
        <h1>{pick(lang, "Nutrition", "Питание")}</h1>
        <p className="lede">
          {pick(
            lang,
            "How much to eat for your goal, how much protein and how to split it, heart-rate zones for cardio, and which foods give the most protein for the calories.",
            "Сколько есть под вашу цель, сколько белка и как его распределить, пульсовые зоны для кардио и какие продукты дают больше всего белка на калорию.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/nutrition" />
      <div className="nut">
        <NutritionCalc lang={lang} />
        <HeartCard lang={lang} />
        <FoodTable lang={lang} />

        <section className="nut-rules" aria-labelledby="nut-rules-title">
          <h2 id="nut-rules-title">{pick(lang, "The short version", "Коротко")}</h2>
          <ol>
            {RULES.map((rule) => (
              <li key={rule.en}>
                {keepUnits(pick(lang, rule.en, rule.ru))} <Refs ids={rule.source} lang={lang} />
              </li>
            ))}
          </ol>
        </section>

        <section className="nut-sources" aria-labelledby="nut-sources-title">
          <h2 id="nut-sources-title">{pick(lang, "Sources", "Источники")}</h2>
          <ol>
            {SOURCES.map((s) => (
              <li key={s.id} id={sourceAnchor(s.id)}>
                {keepUnits(s.text)}{" "}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {host(s.url)}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </FitnessShell>
  );
}
