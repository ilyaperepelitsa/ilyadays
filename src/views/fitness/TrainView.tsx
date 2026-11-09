import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { FitnessNav, FitnessShell } from "@/components/fitness/Shell";
import { SessionTracker } from "@/components/fitness/train/SessionTracker";
import { ErrorGuard } from "@/components/fitness/train/ErrorGuard";

/** /fitness/train: the session tracker (stream 04 — plans/fitness/04-session-tracker-ui.md). */
export function TrainView({ lang }: { lang: Lang }) {
  return (
    <FitnessShell lang={lang} path="/fitness/train">
      <section className="hello">
        <h1>{pick(lang, "Train", "Тренировка")}</h1>
        <p className="lede">
          {pick(
            lang,
            "One tap logs a set as planned; next time's weights follow from what you log.",
            "Одно касание записывает подход по плану; веса на следующий раз считаются по записанному.",
          )}
        </p>
      </section>
      <FitnessNav lang={lang} current="/fitness/train" />
      <ErrorGuard lang={lang}>
        <SessionTracker lang={lang} />
      </ErrorGuard>
    </FitnessShell>
  );
}
