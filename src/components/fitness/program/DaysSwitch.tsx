/**
 * Days per week (2 / 3 / 4 → the matching template; the owner's swaps and tweaks carry over) and the legs add-on.
 * The day buttons carry `data-value`; the group carries `data-testid="days-select"` (master plan §15).
 */
import type { Lang, Program } from "@/lib/fitness/types";
import { pick, t2 } from "@/lib/fitness/i18n";
import { LOWER_BODY_GROUPS, trainingPreferences } from "@/lib/fitness/plan-preferences.mjs";
import { TEMPLATES } from "@/lib/fitness/templates.mjs";
import { LEGS_EXERCISE_IDS, legsMode } from "@/lib/fitness/program-edit.mjs";
import { exerciseById } from "@/lib/fitness/catalog.mjs";

const DAY_TEMPLATE: Record<2 | 3 | 4, string> = { 2: "upper-2day", 3: "owner-3day-upper", 4: "upper-4day" };

/** The legs add-on: off at first; on as its own day L in the rotation, or spread over the other days. */
export function LegsToggle({
  lang,
  program,
  editable,
  onLegs,
}: {
  lang: Lang;
  program: Program;
  editable: boolean;
  onLegs: (as: "day" | "slots" | null) => void;
}) {
  const legs = legsMode(program);
  const excludesLegs = program.preferences != null && (program.preferences.bodyScope === "upper" || LOWER_BODY_GROUPS.every((g) => trainingPreferences(program.preferences, program.goal).excludedGroups.includes(g)));
  const legNames = LEGS_EXERCISE_IDS.map((id) => t2(lang, exerciseById(id)?.name, id)).join(", ");
  return (
    <div className="fpr-legs">
      <h3>{pick(lang, "Legs", "Ноги")}</h3>
      <p className="fit-muted fpr-small">
        {legs
          ? legs === "day"
            ? pick(lang, "On, as their own day L in the rotation.", "Включены отдельным днём L в ротации.")
            : pick(lang, "On, spread over your training days.", "Включены и распределены по тренировочным дням.")
          : pick(lang, `Off for now. The add-on: ${legNames}.`, `Пока выключены. Дополнение: ${legNames}.`)}
      </p>
      {excludesLegs ? <p className="fit-muted fpr-small">{pick(lang, "Legs are excluded by your training preferences. Change Training scope above to include them.", "Ноги исключены настройками плана. Чтобы включить их, измените раздел «Что тренировать» выше.")}</p> : null}
      {editable && !excludesLegs ? (
        legs ? (
          <button type="button" className="fit-button quiet" data-testid="legs-toggle" aria-pressed="true" onClick={() => onLegs(null)}>
            {pick(lang, "Remove legs", "Убрать ноги")}
          </button>
        ) : (
          <div className="fpr-legs-actions">
            <button type="button" className="fit-button quiet" data-testid="legs-toggle" aria-pressed="false" onClick={() => onLegs("day")}>
              {pick(lang, "Add a legs day", "Добавить день ног")}
            </button>
            <button type="button" className="fit-button quiet" data-testid="legs-slots" onClick={() => onLegs("slots")}>
              {pick(lang, "Spread over the days", "Распределить по дням")}
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}

export function DaysSwitch({
  lang,
  program,
  editable,
  onDays,
  onLegs,
}: {
  lang: Lang;
  program: Program;
  editable: boolean;
  onDays: (days: 2 | 3 | 4) => void;
  onLegs: (as: "day" | "slots" | null) => void;
}) {
  return (
    <section className="fit-card fpr-section fpr-days" aria-labelledby="fpr-days-h">
      <h2 id="fpr-days-h">{pick(lang, "Days per week", "Дней в неделю")}</h2>
      <div className="fit-seg fpr-day-count" role="group" aria-label={pick(lang, "Days per week", "Дней в неделю")} data-testid="days-select" data-value={program.daysPerWeek}>
        {([2, 3, 4] as const).map((n) => {
          const tpl = TEMPLATES.find((t) => t.id === DAY_TEMPLATE[n]);
          return (
            <button key={n} type="button" aria-pressed={program.daysPerWeek === n} data-value={n} disabled={!editable} onClick={() => editable && program.daysPerWeek !== n && onDays(n)}>
              <strong className="fit-num">{n}</strong>
              <span>{tpl ? (/\(([^)]+)\)/.exec(t2(lang, tpl.name))?.[1] ?? "") : ""}</span>
            </button>
          );
        })}
      </div>
      <p className="fit-muted fpr-small">
        {pick(
          lang,
          "Days rotate in order (A → B → C → A) whatever the calendar, so a missed day never skips a workout. Switching keeps your swaps, set and rep tweaks, added and removed exercises.",
          "Дни идут по кругу (A → B → C → A) независимо от календаря, поэтому пропуск не съедает тренировку. При смене числа дней ваши замены, правки подходов и повторений, добавленные и убранные упражнения сохраняются.",
        )}
      </p>

      <LegsToggle lang={lang} program={program} editable={editable} onLegs={onLegs} />
    </section>
  );
}
