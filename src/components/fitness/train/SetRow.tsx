/**
 * One set on the session screen (stream 04): the planned (or logged) set on the left, a 56 px Done button on the
 * right that logs exactly what the row shows. Tapping the row opens steppers (reps, kg) and RIR chips; the current
 * set has them open. A logged row edits in place or is undone. Test hooks: set-row, set-done, reps-/kg-minus/plus.
 * Right after a set is logged the next set's Done waits ("arming", under a second) so a double tap cannot log it.
 */
import type { CSSProperties } from "react";
import type { Exercise, Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { RIR_CHOICES, amountText, kgStepLabel, repsLabel, setEffortCoaching, setHint, setText, type Row } from "@/lib/fitness/tracker.mjs";
import { Stepper } from "./Stepper";

export type Draft = { kg: number; reps: number; rir: number | null; rirReported?: boolean };
export type SetChange = { repsDelta?: number; kgDelta?: number; rir?: number | null };
export type RowActions = {
  done: (row: Row) => void;
  adjust: (row: Row, change: SetChange) => void;
  undo: (row: Row) => void;
  toggle: (row: Row) => void;
  removeAdded: (slotId: string) => void;
};

const rirText = (lang: Lang, rir: number | null) =>
  rir == null ? "" : pick(lang, `RIR ${rir >= 4 ? "4+" : rir}`, `в запасе ${rir >= 4 ? "4+" : rir}`);

export function SetRow({ lang, row, exercise, label, steps, current, arming = false, open, draft, readOnly, actions, style }: {
  lang: Lang;
  row: Row;
  exercise: Exercise | undefined;
  label: string;
  steps: { reps: number; kg: number };
  current: boolean;
  /** the previous set was logged a moment ago: Done waits (double-tap shield) */
  arming?: boolean;
  open: boolean;
  draft: Draft | undefined;
  readOnly: boolean;
  actions: RowActions;
  style?: CSSProperties;
}) {
  const logged = row.logged;
  const values: Draft = logged ? { kg: logged.kg, reps: logged.reps, rir: logged.rir } : draft ?? row.suggest;
  const text = setText(values, exercise, lang);
  const planText = setText({ kg: row.planned.weightKg, reps: row.planned.reps }, exercise, lang);
  const offPlan = values.kg !== row.planned.weightKg || values.reps !== row.planned.reps;
  const hint = setHint(exercise, lang);
  const warm = row.kind === "warmup";
  const coaching = setEffortCoaching(row.planned, exercise, logged ?? draft ?? null);
  const parts: string[] = [];
  if (row.history) parts.push(pick(lang, "before the swap", "до замены"));
  if (row.state === "skipped") parts.push(pick(lang, "skipped", "пропущено"));
  else if (warm) parts.push(pick(lang, "warm-up", "разминка"));
  else if (values.rir != null) parts.push(rirText(lang, values.rir));
  if (row.state === "failed") {
    const target = amountText(row.planned.reps, exercise, lang);
    parts.push(pick(lang, `target ${target}`, `цель ${target}`));
  }
  else if (offPlan && row.state !== "skipped") parts.push(pick(lang, `plan ${planText}`, `план ${planText}`));
  if (hint && !row.history) parts.push(hint);
  const editable = !readOnly && !row.history && row.state !== "skipped";
  const className = [
    "trk-row",
    `is-${row.state}`,
    warm ? "is-warmup" : "",
    current ? "is-current" : "",
    open && editable ? "is-open" : "",
  ].filter(Boolean).join(" ");

  const body = (
    <>
      <span className="trk-badge fit-num" aria-hidden="true">{label}</span>
      <span className="trk-row-text">
        <span className="trk-row-load fit-num">{text}</span>
        {parts.length ? <span className="trk-row-sub">{parts.join(" · ")}</span> : null}
      </span>
    </>
  );

  return (
    <div
      className={className}
      style={style}
      data-testid="set-row"
      data-kind={row.kind}
      data-index={row.index}
      data-row-key={row.key}
      data-state={row.state}
      data-kg={values.kg}
      data-reps={values.reps}
      data-target-rir={row.planned.rir ?? ""}
    >
      <div className="trk-row-line">
        {editable ? (
          <button
            type="button"
            className="trk-row-body"
            onClick={() => actions.toggle(row)}
            aria-expanded={open}
            aria-label={`${label}: ${text}. ${pick(lang, "Adjust", "Изменить")}`}
          >
            {body}
          </button>
        ) : (
          <div className="trk-row-body">{body}</div>
        )}
        {logged ? (
          <span className={`trk-check${row.state === "failed" ? " is-miss" : ""}`} role="img" aria-label={pick(lang, "logged", "записано")}>
            ✓
          </span>
        ) : editable ? (
          <button
            type="button"
            className="trk-done"
            onClick={() => actions.done(row)}
            disabled={arming}
            data-testid={current ? "set-done" : "set-row-done"}
            aria-label={`${pick(lang, "Done", "Готово")}: ${text}`}
          >
            <span aria-hidden="true">✓</span>
            <span className="trk-done-text">{pick(lang, "Done", "Готово")}</span>
          </button>
        ) : null}
      </div>
      {!logged && row.adaptation ? <p className="trk-note" data-testid="set-advice">{row.adaptation === "reduce"
        ? pick(lang, "Try one lighter step after your full rest. Stop if your form breaks down; you can change this suggestion.", "После полного отдыха попробуйте на один шаг легче. Если техника нарушается, остановитесь; рекомендацию можно изменить.")
        : row.adaptation === "easy"
        ? pick(lang, "You reported a comfortable set with extra reserve. After a full rest, try one more rep at the same weight, keeping the target reserve. You can change this suggestion.", "Вы указали лёгкий подход с дополнительным запасом. После полного отдыха попробуйте на одно повторение больше с тем же весом, сохраняя целевой запас. Рекомендацию можно изменить.")
        : pick(lang, "Fewer reps last set: rest fully and try this manageable target. Adjust to what you actually do.", "В прошлом подходе было меньше повторений: полностью отдохните и попробуйте эту цель. Запишите фактический результат.")}</p> : null}
      {!warm && !row.history ? <details className="trk-note" data-testid="set-effort-guide">
        <summary>{pick(lang, coaching.title.en, coaching.title.ru)}</summary>
        <p>{pick(lang, coaching.guidance.en, coaching.guidance.ru)}</p>
        {coaching.example ? <p>{pick(lang, coaching.example.en, coaching.example.ru)}</p> : null}
        {coaching.feedback ? <p data-testid="set-effort-feedback">{pick(lang, coaching.feedback.en, coaching.feedback.ru)}</p> : null}
      </details> : null}
      {open && editable ? (
        <div className="trk-edit">
          <div className="trk-steppers">
            <Stepper
              lang={lang}
              label={repsLabel(exercise, lang)}
              value={values.reps}
              step={steps.reps}
              onStep={(d) => actions.adjust(row, { repsDelta: d })}
              testid={current ? "reps" : undefined}
            />
            {steps.kg > 0 ? (
              <Stepper
                lang={lang}
                label={kgStepLabel(exercise, lang)}
                value={values.kg}
                step={steps.kg}
                onStep={(d) => actions.adjust(row, { kgDelta: d })}
                testid={current ? "kg" : undefined}
              />
            ) : null}
          </div>
          {!warm ? <p className="trk-note">{pick(lang, "How many more clean reps could you have done? Tap your estimate after the set. The displayed RIR is a target until you report it.", "Сколько ещё повторений с хорошей техникой вы могли бы сделать? Укажите оценку после подхода. До этого запас — лишь цель.")}</p> : null}
          {!warm ? (
            <div className="trk-rir" role="group" aria-label={pick(lang, "Reps in reserve", "Повторов в запасе")}>
              <span className="trk-rir-label">{pick(lang, "RIR", "В запасе")}</span>
              {RIR_CHOICES.map((v) => (
                <button
                  key={v}
                  data-testid="rir-choice"
                  data-value={v}
                  type="button"
                  className="trk-chip fit-num"
                  aria-pressed={(logged ? logged.prescription?.rirReported !== false : draft?.rirReported === true) && values.rir != null && (v === 4 ? values.rir >= 4 : values.rir === v)}
                  onClick={() => actions.adjust(row, { rir: v })}
                >
                  {v === 4 ? "4+" : v}
                </button>
              ))}
            </div>
          ) : null}
          {logged || row.added ? (
            <div className="trk-edit-actions">
              {logged ? (
                <button type="button" className="fit-button quiet" onClick={() => actions.undo(row)}>
                  {pick(lang, "Undo this set", "Отменить подход")}
                </button>
              ) : (
                <button type="button" className="fit-button quiet" onClick={() => actions.removeAdded(row.slotId)}>
                  {pick(lang, "Remove this set", "Убрать подход")}
                </button>
              )}
              <button type="button" className="fit-button ghost" onClick={() => actions.toggle(row)}>
                {pick(lang, "Close", "Закрыть")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
