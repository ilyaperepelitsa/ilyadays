/**
 * Weight steps (stream 05): how much one hole on the weight stack adds here, for the stack equipment the plan uses
 * at this gym (pin-loaded machines, cable stations, the assisted pull-up machine) plus any existing override. The
 * engine rounds targets to `gym.increments[exerciseId]` (progression.incrementFor); picking the value the gym would
 * use anyway removes the override. Collapsed by default: it is set once per gym.
 */
import { useMemo, useState } from "react";
import { fmtKg, kgLabel } from "@/lib/fitness/i18n";
import { baseIncrement, effectiveIncrement, hasStack, incrementChoices, setIncrement, type GymExercise } from "@/lib/fitness/gyms-core.mjs";
import { type SectionProps, exerciseName, tr } from "./shared";

export function WeightSteps({ lang, gym, catalog, plan, canWrite, write }: SectionProps) {
  const T = tr(lang);
  const [open, setOpen] = useState(false);
  const overrides = gym.increments;
  const machines = useMemo(() => {
    const used = plan.days.flatMap((d) => d.slots.map((s) => s.exerciseId));
    const ids = [...new Set([...used, ...Object.keys(overrides ?? {})])];
    return ids.map((id) => catalog.exerciseById(id)).filter((e): e is GymExercise => hasStack(e));
  }, [plan, overrides, catalog]);
  if (!machines.length) return null;
  const changed = machines.filter((ex) => effectiveIncrement(gym, ex) !== (ex.increment ?? 0)).length;
  const kg = kgLabel(lang);
  return (
    <section className="fit-gym-block" aria-labelledby="fit-gym-steps">
      <div className="fit-gym-group-head">
        <h3 id="fit-gym-steps">{T("Weight steps", "Шаг веса")}</h3>
        <button
          type="button"
          className="fit-gym-more"
          aria-expanded={open}
          aria-controls="fit-gym-steps-list"
          data-testid="steps-toggle"
          onClick={() => setOpen(!open)}
        >
          {open ? T("Hide", "Скрыть") : T("Show", "Показать")}
        </button>
      </div>
      <p className="fit-gym-hint">
        {T(
          `Machines and cables with a weight stack in your plan (${machines.length}): how much one hole adds here. Targets round to this step.`,
          `Тренажёры и блоки со стеком из плана (${machines.length}): сколько добавляет одна позиция штифта в этом зале. Цели округляются до этого шага.`,
        )}{" "}
        {changed ? T(`Changed here: ${changed}.`, `Изменено здесь: ${changed}.`) : T("All at the usual step.", "Везде обычный шаг.")}
      </p>
      {open ? (
        <ul id="fit-gym-steps-list" className="fit-gym-steps">
          {machines.map((ex) => {
            const name = exerciseName(catalog, ex.id, lang);
            const current = effectiveIncrement(gym, ex);
            const base = baseIncrement(gym, ex);
            return (
              <li key={ex.id} className="fit-gym-step">
                <span className="fit-gym-row-name">{name}</span>
                <div className="fit-seg fit-gym-step-seg" role="group" aria-label={T(`${name}: weight step`, `${name}: шаг веса`)}>
                  {incrementChoices(gym, ex).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="fit-num"
                      aria-pressed={current === value}
                      data-testid="increment-option"
                      data-exercise-id={ex.id}
                      data-kg={value}
                      disabled={!canWrite}
                      onClick={() => write((g, now) => setIncrement(g, ex.id, value === baseIncrement(g, ex) ? null : value, now))}
                    >
                      {fmtKg(value, lang)} {kg}
                      {value === base ? <small>{T("usual", "обычно")}</small> : null}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
