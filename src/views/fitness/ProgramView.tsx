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
            "Choose what to train, edit each day and review your changes before saving.",
            "Выбирайте, что тренировать, редактируйте дни и проверяйте изменения перед сохранением.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/program" />
      <ProgramEditor lang={lang} />
    </FitnessShell>
  );
}
