/**
 * Goal mode switch with the evidence-based parameter table (GOAL_MODES, research/01 Table 1). The buttons carry
 * `data-value`; the group carries `data-testid="goal-select"` and the current value (master plan §15).
 */
import type { GoalMode, Lang } from "@/lib/fitness/types";
import { fmtClock, pick, t2 } from "@/lib/fitness/i18n";
import { GOAL_IDS, GOAL_MODES } from "@/lib/fitness/templates.mjs";
import { fmtNum } from "./format";
import { GoalPicker } from "../GoalPicker";

type Mode = (typeof GOAL_MODES)[GoalMode];

const span = (r: readonly number[]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`);

/** Rows of the parameter table: label + value per mode. */
function rows(lang: Lang): [string, (m: Mode) => string][] {
  return [
    [pick(lang, "Reps, main lifts", "Повторения, основные"), (m) => span(m.repRange)],
    [pick(lang, "Reps in reserve", "Запас повторений"), (m) => `${m.rir}`],
    [pick(lang, "Sets per muscle a week", "Подходов на мышцу в неделю"), (m) => `${m.setsPerMuscleWeek.start} → ${m.setsPerMuscleWeek.target} → ${m.setsPerMuscleWeek.max}`],
    [pick(lang, "Rest, compound / isolation", "Отдых, базовые / изолирующие"), (m) => `${fmtClock(m.restSec.compound)} / ${fmtClock(m.restSec.isolation)}`],
    [pick(lang, "Sessions per muscle a week", "Тренировок на мышцу в неделю"), (m) => span(m.frequency)],
    [pick(lang, "Block", "Блок"), (m) => pick(lang, `${m.blockWeeks} weeks + deload week`, `${m.blockWeeks} нед. + разгрузочная`)],
    [pick(lang, "Weight step", "Шаг веса"), (m) => `+${fmtNum(m.progression.stepPct, lang)} %`],
    [pick(lang, "After missed sessions", "После неудачных тренировок"), (m) => pick(lang, `−${m.progression.deloadPct} % after ${m.progression.failsBeforeDeload}`, `−${m.progression.deloadPct} % после ${m.progression.failsBeforeDeload}`)],
  ];
}

/** A citation with its URL as a link. */
export function SourceText({ text }: { text: string }) {
  const m = /https?:\/\/\S+/.exec(text);
  if (!m) return <>{text}</>;
  const url = m[0].replace(/[.,;)]+$/, "");
  return (
    <>
      {text.slice(0, m.index)}
      <a href={url} rel="noreferrer" target="_blank">
        {url.replace(/^https?:\/\//, "")}
      </a>
      {text.slice(m.index + url.length)}
    </>
  );
}

export function ModeSwitch({ lang, goal, editable, onGoal }: { lang: Lang; goal: GoalMode; editable: boolean; onGoal: (goal: GoalMode) => void }) {
  const mode = GOAL_MODES[goal] ?? GOAL_MODES.recomp;
  const table = rows(lang);
  return (
    <section className="fit-card fpr-section fpr-mode" aria-labelledby="fpr-mode-h">
      <h2 id="fpr-mode-h">{pick(lang, "Goal", "Цель")}</h2>
      <GoalPicker lang={lang} value={goal} testId="goal-select" disabled={!editable} onChange={onGoal} />
      <dl className="fit-kv fpr-kv">
        {table.slice(0, 6).map(([label, value]) => (
          <div key={label} className="fpr-kv-row">
            <dt>{label}</dt>
            <dd className="fit-num">{value(mode)}</dd>
          </div>
        ))}
      </dl>
      <details className="fpr-details">
      <summary>{pick(lang, "Why these numbers", "Почему такие числа")}</summary>
      <p className="fpr-mode-summary">{t2(lang, mode.summary)}</p>
      <dl className="fit-kv fpr-kv">{table.slice(6).map(([label, value]) => <div key={label} className="fpr-kv-row"><dt>{label}</dt><dd className="fit-num">{value(mode)}</dd></div>)}</dl>
      <p className="fit-muted fpr-small">{t2(lang, mode.deloadRule)}</p>
      {editable ? (
        <p className="fit-muted fpr-small">
          {pick(
            lang,
            "Switching re-derives sets, reps, effort and rest for every exercise; your exercises stay. Working weights convert through your one-rep max on the next session, which runs 5 % lighter and re-calibrates.",
            "При смене цели подходы, повторения, усилие и отдых пересчитываются для каждого упражнения, а сами упражнения остаются. Рабочие веса пересчитываются через ваш 1ПМ на следующей тренировке: она на 5 % легче и служит калибровкой.",
          )}
        </p>
      ) : null}
      </details>
      <details className="fpr-details">
        <summary>{pick(lang, "Compare all goals", "Сравнить все цели")}</summary>
        <div className="fpr-scroll">
          <table className="fpr-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="fpr-visually-hidden">{pick(lang, "Parameter", "Параметр")}</span>
                </th>
                {GOAL_IDS.map((id: GoalMode) => (
                  <th key={id} scope="col" className={id === goal ? "on" : undefined}>
                    {t2(lang, GOAL_MODES[id].name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {GOAL_IDS.map((id: GoalMode) => (
                    <td key={id} className={id === goal ? "on fit-num" : "fit-num"}>
                      {value(GOAL_MODES[id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fit-muted fpr-small">
          {pick(
            lang,
            "Sets per muscle count direct work as 1 and helper muscles as ½ (strength mode counts direct sets per main lift).",
            "Подходы на мышцу: прямая работа — 1, мышцы-помощники — ½ (в силовом режиме — прямые подходы на основное упражнение).",
          )}
        </p>
        <ol className="fpr-sources">
          {mode.sources
            .filter((s: string) => !s.startsWith("research/"))
            .map((s: string) => (
              <li key={s}>
                <SourceText text={s} />
              </li>
            ))}
        </ol>
      </details>
    </section>
  );
}
