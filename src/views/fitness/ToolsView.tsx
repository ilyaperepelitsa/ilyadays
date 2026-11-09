import Link from "next/link";
import type { Lang } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { pick } from "@/lib/fitness/i18n";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { LoadCalculator, PlateCalculator } from "@/components/fitness/tools/LoadCalculator";

/** /fitness/tools: training calculators (master-owned). Nutrition and heart-rate calculators live on /fitness/nutrition. */
export function ToolsView({ lang }: { lang: Lang }) {
  return (
    <FitnessShell lang={lang} path="/fitness/tools">
      <section className="hello">
        <h1>{pick(lang, "Calculators", "Калькуляторы")}</h1>
        <p className="lede">
          {pick(
            lang,
            "One-rep max, the weight for any number of reps, a warm-up, and plates per side.",
            "Разовый максимум, вес на любое число повторений, разминка и блины на каждую сторону.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/tools" />
      <div className="fit-tools">
        <LoadCalculator lang={lang} />
        <PlateCalculator lang={lang} />
        <section className="fit-card fit-calc-more">
          <h2>{pick(lang, "More", "Ещё")}</h2>
          <ul>
            <li>
              <Link prefetch={false} href={localPath(lang, "/fitness/nutrition")}>
                {pick(lang, "Energy, protein and heart-rate zones", "Энергия, белок и пульсовые зоны")}
              </Link>
            </li>
            <li>
              <Link prefetch={false} href={localPath(lang, "/fitness/science")}>
                {pick(lang, "Why these numbers: loads by goal, progression, warm-ups", "Откуда эти числа: веса под цель, прогрессия, разминка")}
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </FitnessShell>
  );
}
