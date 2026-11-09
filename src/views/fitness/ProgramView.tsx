import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { ProgramEditor } from "@/components/fitness/program/ProgramEditor";

/** /fitness/program (stream 10): goal mode, days per week, the days and their exercises, progression, the AI coach. */
export function ProgramView({ lang }: { lang: Lang }) {
  return (
    <FitnessShell lang={lang} path="/fitness/program">
      <section className="hello">
        <h1>{pick(lang, "Program", "Программа")}</h1>
        <p className="lede">
          {pick(
            lang,
            "What you train each day, how hard, and how the weights go up. Change the goal or the number of days and the numbers follow; the AI coach proposes changes you review first.",
            "Что вы тренируете в каждый день, насколько тяжело и как растут веса. Смените цель или число дней — числа пересчитаются; ИИ-тренер предлагает изменения, которые вы сначала проверяете.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/program" />
      <ProgramEditor lang={lang} />
    </FitnessShell>
  );
}
