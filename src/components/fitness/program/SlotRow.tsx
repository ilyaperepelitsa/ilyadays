/**
 * One program slot: exercise, prescription, next-session target (and a weight hold, master plan §16), the slot's
 * "why"; tap to open its editor (sets, reps, reps in reserve, rest, progression rule, hold the weight, swap, order,
 * remove). Read-only when the store cannot write. A hold is not a program edit: it writes the exercise state at once.
 */
import { useState } from "react";
import Link from "next/link";
import type { ExerciseSlot, ExerciseState, Gym, Lang, PlannedExercise, Program, ProgramDay, ProgressionRuleId } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { pick, t2 } from "@/lib/fitness/i18n";
import { equipmentLabel, exerciseById } from "@/lib/fitness/catalog.mjs";
import {
  REST_STEP_SEC, moveSlot, removeSlot, setSlot, slotBounds, swapCandidates, swapSlot, templateSlotOf,
} from "@/lib/fitness/program-edit.mjs";
import { exerciseAllowed } from "@/lib/fitness/plan-preferences.mjs";
import { holdOf, holdText, noteHasHold } from "@/lib/fitness/tracker.mjs";
import { prescriptionText, rangeLabels, restText, targetText, unitOfExercise } from "./format";
import { Stepper } from "./Stepper";
import { ExerciseThumbnail } from "../ExerciseThumbnail";
import { ActionIcon } from "../ActionIcon";

export type Edit = (fn: (program: Program, at: string) => Program) => void;
/** Set (weeks) or clear (null) the weight hold of an exercise: written to its exercise state at once. */
export type Hold = (exerciseId: string, weeks: number | null) => void;

/** Hold lengths offered on the slot editor, in weeks (program-edit.mjs HOLD_WEEKS bounds them). */
const HOLD_CHOICES = [1, 2, 4] as const;
/** "… 18 Nov" → "… 18 Nov."; "… 18 нояб." stays as it is. */
const sentence = (s: string) => (s.endsWith(".") ? s : `${s}.`);

const RULES: [ProgressionRuleId, string, string, string, string][] = [
  ["double", "Reps, then weight", "Повторения, потом вес", "Add reps up to the top of the range, then add weight and start again from the bottom.", "Добавляйте повторения до верха диапазона, потом вес — и снова с низа."],
  ["linear", "Weight each time", "Вес каждый раз", "Fixed reps at the top of the range; weight goes up whenever every set is made.", "Повторения на верху диапазона; вес растёт, как только все подходы выполнены."],
  ["rpe", "By effort", "По усилию", "The weight follows your estimated one-rep max and how many reps you had left.", "Вес следует за расчётным 1ПМ и запасом повторений."],
  ["rep-target", "Reps only", "Только повторения", "Never adds weight: for holds, bands and bodyweight moves.", "Вес не растёт: для удержаний, резины и упражнений с весом тела."],
];

const name = (id: string, lang: Lang) => t2(lang, exerciseById(id)?.name, id);

export function SlotRow({
  lang,
  program,
  day,
  slot,
  planned,
  gym,
  editable,
  canUp,
  canDown,
  canRemove,
  onEdit,
  state,
  now,
  onHold,
}: {
  lang: Lang;
  program: Program;
  day: ProgramDay;
  slot: ExerciseSlot;
  planned: PlannedExercise | undefined;
  gym: Gym | null;
  editable: boolean;
  canUp: boolean;
  canDown: boolean;
  canRemove: boolean;
  onEdit: Edit;
  /** progression memory of the exercise this slot uses here (the planned one), when it has been trained */
  state?: ExerciseState;
  /** the page clock (null while rendering on the server) */
  now: number | null;
  onHold?: Hold;
}) {
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const exercise = exerciseById(slot.exerciseId);
  const unit = unitOfExercise(exercise);
  const b = slotBounds(program.goal, unit);
  const used = planned && planned.exerciseId !== slot.exerciseId ? exerciseById(planned.exerciseId) : undefined;
  const target = targetText(planned, used ?? exercise, lang);
  const original = templateSlotOf(program, slot.slotId);
  const replaced = original && original.exerciseId !== slot.exerciseId ? original.exerciseId : null;
  const partner = slot.superset ? day.slots.find((s) => s.superset === slot.superset && s.slotId !== slot.slotId) : undefined;
  const bodyId = `fpr-slot-${day.key}-${slot.slotId}`;
  const set = (patch: Parameters<typeof setSlot>[3]) => onEdit((p, at) => setSlot(p, day.key, slot.slotId, patch, at));
  const candidates = swapping ? swapCandidates(slot.exerciseId, gym).filter((c) => exerciseAllowed(program, exerciseById(c.id))).sort((x, y) => Number(y.available) - Number(x.available)) : [];
  const rule = RULES.find((r) => r[0] === slot.progression) ?? RULES[0];
  const heldId = planned?.exerciseId ?? slot.exerciseId;
  const hold = now == null ? null : holdOf(state, now);

  return (
    <li className="fpr-slot" data-testid="slot-row" data-slot-id={slot.slotId} data-exercise-id={slot.exerciseId} data-hold-until={hold ?? undefined}>
      <button type="button" className="fpr-slot-head" aria-expanded={open} aria-controls={bodyId} data-testid="slot-edit" onClick={() => setOpen(!open)}>
        <span className="fpr-slot-visual"><ExerciseThumbnail id={slot.exerciseId} /><span className="fpr-slot-id" aria-hidden="true">{slot.slotId}</span></span>
        <span className="fpr-slot-main">
          <span className="fpr-slot-name">{name(slot.exerciseId, lang)}</span>
          <span className="fpr-slot-rx fit-num">{prescriptionText(slot, unit, lang)}</span>
          {target ? (
            <span className="fpr-slot-next fit-num">
              {planned?.calibration ? pick(lang, "Calibrate first", "Сначала калибровка") : <>{pick(lang, "Next", "Дальше")}: {target}</>}
            </span>
          ) : null}
          {hold && !(open && noteHasHold(planned?.note, hold, lang)) ? <span className="fpr-slot-hold fit-num">{holdText(hold, lang)}</span> : null}
          {used ? (
            <span className="fpr-slot-sub">
              {pick(lang, "At your gym", "В вашем зале")}: {name(used.id, lang)}
            </span>
          ) : null}
          <span className="fpr-tags">
            {slot.priority ? <span className="fpr-tag">{pick(lang, "Priority", "Приоритет")}</span> : null}
            {partner ? <span className="fpr-tag cool">{pick(lang, `Superset with ${partner.slotId}`, `Суперсет с ${partner.slotId}`)}</span> : null}
          </span>
        </span>
        <span className="fpr-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div id={bodyId} className="fpr-slot-body">
          <p className="fpr-why">{t2(lang, slot.why) || pick(lang, "Added by you.", "Добавлено вами.")}</p>
          {replaced ? (
            <p className="fit-muted fpr-small">
              {pick(lang, "Instead of", "Вместо")}: {name(replaced, lang)}
            </p>
          ) : null}
          {planned?.note ? <p className="fpr-engine-note">{t2(lang, planned.note)}</p> : null}
          <p className="fpr-small">
            <Link prefetch={false} href={localPath(lang, `/fitness/exercises/${slot.exerciseId}`)}>
              {pick(lang, "Technique, muscles and alternatives →", "Техника, мышцы и замены →")}
            </Link>
          </p>

          {editable ? (
            <>
              <div className="fpr-steppers">
                <Stepper testid="slot-sets" label={pick(lang, "Sets", "Подходы")} value={slot.sets} min={b.sets[0]} max={b.sets[1]} onChange={(v) => set({ sets: v })} />
                <Stepper testid="slot-rest" label={pick(lang, "Rest", "Отдых")} text={restText(slot.restSec)} value={slot.restSec} min={b.restSec[0]} max={b.restSec[1]} step={REST_STEP_SEC} onChange={(v) => set({ restSec: v })} />
                <Stepper
                  testid="slot-reps-from"
                  label={rangeLabels(unit, lang)[0]}
                  value={slot.repRange[0]}
                  min={b.reps[0]}
                  max={slot.repRange[1]}
                  step={b.step}
                  onChange={(v) => set({ repRange: [v, slot.repRange[1]] })}
                />
                <Stepper
                  testid="slot-reps-to"
                  label={rangeLabels(unit, lang)[1]}
                  value={slot.repRange[1]}
                  min={slot.repRange[0]}
                  max={b.reps[1]}
                  step={b.step}
                  onChange={(v) => set({ repRange: [slot.repRange[0], v] })}
                />
              </div>

              <div className="fpr-field">
                <span className="fpr-stepper-label">{pick(lang, "Reps in reserve (RIR)", "Запас повторений (RIR)")}</span>
                <div className="fit-seg fpr-chips" role="group" aria-label={pick(lang, "Reps in reserve", "Запас повторений")} data-testid="slot-rir" data-value={slot.rir}>
                  {Array.from({ length: b.rir[1] - b.rir[0] + 1 }, (_, i) => b.rir[0] + i).map((r) => (
                    <button key={r} type="button" aria-pressed={slot.rir === r} data-value={r} onClick={() => set({ rir: r })}>
                      {r}
                    </button>
                  ))}
                </div>
                <span className="fit-muted fpr-small">
                  {pick(lang, "How many more reps you could still do when you stop a set.", "Сколько повторений ещё осталось бы в запасе, когда вы заканчиваете подход.")}
                </span>
              </div>

              <div className="fpr-field">
                <span className="fpr-stepper-label">{pick(lang, "Progression", "Прогрессия")}</span>
                <div className="fit-seg fpr-chips" role="group" aria-label={pick(lang, "Progression rule", "Правило прогрессии")} data-testid="slot-rule" data-value={slot.progression}>
                  {RULES.map(([id, en, ru]) => (
                    <button key={id} type="button" aria-pressed={slot.progression === id} data-value={id} onClick={() => set({ progression: id })}>
                      {pick(lang, en, ru)}
                    </button>
                  ))}
                </div>
                <span className="fit-muted fpr-small">{pick(lang, rule[3], rule[4])}</span>
              </div>

              {onHold ? (
                <div className="fpr-field">
                  <span className="fpr-stepper-label">{pick(lang, "Hold the weight", "Зафиксировать вес")}</span>
                  {state ? (
                    <>
                      <div className="fit-seg fpr-chips" role="group" aria-label={pick(lang, "Hold the weight for", "Зафиксировать вес на")} data-testid="slot-hold" data-value={hold ?? ""}>
                        {HOLD_CHOICES.map((w) => (
                          <button key={w} type="button" data-value={w} onClick={() => onHold(heldId, w)}>
                            {pick(lang, `${w} wk`, `${w} нед.`)}
                          </button>
                        ))}
                        {hold ? (
                          <button type="button" data-value={0} onClick={() => onHold(heldId, null)}>
                            {pick(lang, "Clear", "Снять")}
                          </button>
                        ) : null}
                      </div>
                      <span className="fit-muted fpr-small">
                        {hold ? <strong>{sentence(holdText(hold, lang))} </strong> : null}
                        {pick(
                          lang,
                          "No weight increase until then: reps can still go up, and a missed session still counts. Saved at once.",
                          "До этой даты вес не растёт: повторения могут расти, а неудачная тренировка всё равно учитывается. Сохраняется сразу.",
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="fit-muted fpr-small">
                      {pick(lang, "Possible after the first session of this exercise.", "Можно после первой тренировки с этим упражнением.")}
                    </span>
                  )}
                </div>
              ) : null}

              <div className="fpr-slot-actions">
                <button type="button" className="fit-button quiet fpr-swap-toggle" aria-expanded={swapping} data-testid="slot-swap-open" onClick={() => setSwapping(!swapping)}>
                  <ActionIcon name="swap" />{pick(lang, "Swap exercise", "Заменить упражнение")}
                </button>
                <button type="button" className="fit-button quiet fpr-icon" disabled={!canUp} data-testid="slot-up" aria-label={pick(lang, "Move up", "Выше")} onClick={() => onEdit((p, at) => moveSlot(p, day.key, slot.slotId, -1, at))}>
                  <ActionIcon name="up" />
                </button>
                <button type="button" className="fit-button quiet fpr-icon" disabled={!canDown} data-testid="slot-down" aria-label={pick(lang, "Move down", "Ниже")} onClick={() => onEdit((p, at) => moveSlot(p, day.key, slot.slotId, 1, at))}>
                  <ActionIcon name="down" />
                </button>
                <button type="button" className="fit-button quiet fpr-remove" disabled={!canRemove} data-testid="slot-remove" onClick={() => onEdit((p, at) => removeSlot(p, day.key, slot.slotId, at))}>
                  {pick(lang, "Remove", "Убрать")}
                </button>
              </div>

              {swapping ? (
                <ul className="fpr-swaps" aria-label={pick(lang, "Replacements", "Замены")}>
                  {candidates.length === 0 ? <li className="fit-muted">{pick(lang, "No alternatives in the catalog.", "В каталоге нет замен.")}</li> : null}
                  {candidates.map((c) => {
                    const ex = exerciseById(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="fpr-swap"
                          data-testid="slot-swap-option"
                          data-exercise-id={c.id}
                          onClick={() => {
                            onEdit((p, at) => swapSlot(p, day.key, slot.slotId, c.id, at));
                            setSwapping(false);
                          }}
                        >
                          <ExerciseThumbnail id={c.id} />
                          <span className="fpr-swap-name">{name(c.id, lang)}</span>
                          <span className="fit-muted fpr-small">
                            {ex ? equipmentLabel(ex.equipment, lang) : ""}
                            {c.available ? "" : ` · ${pick(lang, "not at your gym", "нет в вашем зале")}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
