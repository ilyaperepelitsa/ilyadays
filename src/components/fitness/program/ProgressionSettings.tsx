/**
 * How weights move: the progression parameters (step, misses before a deload, deload size, double step) for every
 * rule at once, the planned deload interval, and a plain-language preview computed by the engine itself
 * (research/08 §K: "If you hit 3 × 12 at 50 kg, next time: 3 × 8 at 52.5 kg). When that exercise's weight is held
 * (ExerciseState.holdUntil, master plan §16) the preview runs with the hold and says until when; with its plateau
 * memory (ExerciseState.plateau, §16 rule 5) too, so it never promises a step the engine holds back.
 */
import type { Exercise, ExerciseState, Lang, LoggedSet, Program } from "@/lib/fitness/types";
import { pick, t2 } from "@/lib/fitness/i18n";
import { exerciseById } from "@/lib/fitness/catalog.mjs";
import { PROGRESSION_RULE_IDS, slotParams } from "@/lib/fitness/templates.mjs";
import { nextState, roundLoad } from "@/lib/fitness/progression.mjs";
import { DELOAD_EVERY_BOUNDS, PROGRESSION_BOUNDS, setDeloadEvery, setProgressionParams } from "@/lib/fitness/program-edit.mjs";
import { holdOf, holdText, noteHasHold } from "@/lib/fitness/tracker.mjs";
import { fmtNum, loadText } from "./format";
import { Stepper } from "./Stepper";
import type { Edit } from "./SlotRow";

const EPOCH = "1970-01-01T00:00:00.000Z";

const plainLoad = (e: Exercise) =>
  (e.repUnit ?? "reps") === "reps" && e.equipment !== "assisted" && e.assistance !== true && e.equipment !== "bodyweight" && e.equipment !== "band";

/** The engine's own answer for "all sets at the top of the range" on the first plain-load slot of the program. */
function preview(program: Program, states: Record<string, ExerciseState>, lang: Lang, now: number | null): string | null {
  const slot = program.days.flatMap((d) => d.slots).find((s) => {
    const e = exerciseById(s.exerciseId);
    return Boolean(e && plainLoad(e));
  });
  const exercise = slot ? exerciseById(slot.exerciseId) : undefined;
  if (!slot || !exercise) return null;
  const params = slotParams(program, slot);
  const own = states[exercise.id];
  const hold = now == null ? null : holdOf(own, now);
  const kg = own && own.workingKg > 0 ? own.workingKg : roundLoad(exercise.startLoad?.kg ?? 40, exercise, null);
  const top = params.repRange[1];
  const base: ExerciseState = {
    exerciseId: exercise.id,
    workingKg: kg,
    targetReps: top,
    repRange: [params.repRange[0], params.repRange[1]],
    rir: params.rir,
    e1rm: 0,
    lastOutcome: "progressed",
    fails: 0,
    sessions: 3,
    lastAt: null,
    updatedAt: EPOCH,
  };
  if (hold) base.holdUntil = hold;
  if (own?.plateau != null) base.plateau = own.plateau;
  const sets: LoggedSet[] = Array.from({ length: slot.sets }, (_, i) => ({
    id: `preview-${i}`,
    sessionId: "preview",
    slotId: slot.slotId,
    exerciseId: exercise.id,
    setIndex: i,
    kind: "working",
    plannedKg: kg,
    plannedReps: top,
    kg,
    reps: top,
    rir: params.rir,
    doneAt: EPOCH,
    updatedAt: EPOCH,
  }));
  const result = nextState(base, sets, params, exercise, EPOCH);
  const next = result.state;
  const name = t2(lang, exercise.name);
  // at light weights a whole machine step is too big a jump: the engine asks for extra reps first and says why
  const why = next.workingKg === kg && result.note ? ` ${t2(lang, result.note)}` : "";
  // a hold the engine's note does not already name ("… 18 нояб." already ends a sentence)
  const holdLine = hold && !noteHasHold(result.note, hold, lang) ? holdText(hold, lang) : "";
  const held = holdLine ? ` ${holdLine.endsWith(".") ? holdLine : `${holdLine}.`}` : "";
  return pick(
    lang,
    `Example (${name}): if you make ${slot.sets} × ${top} at ${loadText(kg, exercise, lang)} with ${params.rir} in reserve, next time it is ${slot.sets} × ${next.targetReps} at ${loadText(next.workingKg, exercise, lang)}.${why}${held} If a set falls short of ${params.repRange[0]}, that session is a miss; after ${params.failsBeforeDeload} misses in a row the weight drops ${params.deloadPct} %.`,
    `Пример (${name}): если вы сделали ${slot.sets} × ${top} с ${loadText(kg, exercise, lang)} и запасом ${params.rir}, в следующий раз будет ${slot.sets} × ${next.targetReps} с ${loadText(next.workingKg, exercise, lang)}.${why}${held} Если в подходе меньше ${params.repRange[0]}, тренировка считается неудачной; после ${params.failsBeforeDeload} неудач подряд вес снижается на ${params.deloadPct} %.`,
  );
}

export function ProgressionSettings({
  lang,
  program,
  states,
  now,
  editable,
  onEdit,
}: {
  lang: Lang;
  program: Program;
  states: Record<string, ExerciseState>;
  /** the page clock (null while rendering on the server): a weight hold applies until its date */
  now: number | null;
  editable: boolean;
  onEdit: Edit;
}) {
  const p = program.progression?.double ?? program.progression?.[PROGRESSION_RULE_IDS[0]];
  if (!p) return null;
  const B = PROGRESSION_BOUNDS;
  const patch = (change: Parameters<typeof setProgressionParams>[2]) =>
    onEdit((prog, at) => PROGRESSION_RULE_IDS.reduce((acc: Program, rule) => setProgressionParams(acc, rule, change, at), prog));
  const every = program.deloadEveryWeeks;
  const everyText = every ? pick(lang, `every ${every} weeks`, `каждые ${every} нед.`) : pick(lang, "only when needed", "только по сигналам");
  const onEvery = (v: number) => {
    const next = v < DELOAD_EVERY_BOUNDS[0] ? (every > 0 && v < every ? 0 : DELOAD_EVERY_BOUNDS[0]) : v;
    onEdit((prog, at) => setDeloadEvery(prog, next, at));
  };
  const example = preview(program, states, lang, now);
  return (
    <section className="fit-card fpr-section fpr-progression" aria-labelledby="fpr-prog-h">
      <h2 id="fpr-prog-h">{pick(lang, "How weights go up", "Как растут веса")}</h2>
      <p className="fit-muted fpr-small">
        {pick(
          lang,
          "Double progression with reps in reserve: add reps up to the top of each range, then add weight and start again from the bottom. Every number on the training screen comes from these rules and your logged sets.",
          "Двойная прогрессия с запасом повторений: добавляйте повторения до верха диапазона, потом вес — и снова с низа. Все числа на экране тренировки следуют из этих правил и ваших подходов.",
        )}
      </p>
      {example ? <p className="fpr-example">{example}</p> : null}
      {editable ? (
        <div className="fpr-steppers">
          <Stepper testid="progression-step" label={pick(lang, "Weight step", "Шаг веса")} text={`${fmtNum(p.stepPct, lang)} %`} value={p.stepPct} min={B.stepPct[0]} max={B.stepPct[1]} step={0.5} onChange={(v) => patch({ stepPct: v })} />
          <Stepper testid="progression-fails" label={pick(lang, "Misses before a deload", "Неудач до разгрузки")} value={p.failsBeforeDeload} min={B.failsBeforeDeload[0]} max={B.failsBeforeDeload[1]} onChange={(v) => patch({ failsBeforeDeload: v })} />
          <Stepper testid="progression-deload" label={pick(lang, "Deload size", "Размер разгрузки")} text={`${p.deloadPct} %`} value={p.deloadPct} min={B.deloadPct[0]} max={B.deloadPct[1]} step={5} onChange={(v) => patch({ deloadPct: v })} />
          <Stepper testid="progression-overshoot" label={pick(lang, "Double step at top +", "Двойной шаг: верх +")} text={`+${p.overshootReps}`} value={p.overshootReps} min={B.overshootReps[0]} max={B.overshootReps[1]} onChange={(v) => patch({ overshootReps: v })} />
          <Stepper wide testid="deload-every" label={pick(lang, "Planned deload week", "Плановая разгрузка")} text={everyText} value={every} min={0} max={DELOAD_EVERY_BOUNDS[1]} onChange={onEvery} />
        </div>
      ) : (
        <dl className="fit-kv fpr-kv">
          <div className="fpr-kv-row">
            <dt>{pick(lang, "Weight step", "Шаг веса")}</dt>
            <dd className="fit-num">{fmtNum(p.stepPct, lang)} %</dd>
          </div>
          <div className="fpr-kv-row">
            <dt>{pick(lang, "Deload after misses", "Разгрузка после неудач")}</dt>
            <dd className="fit-num">
              {p.failsBeforeDeload} · −{p.deloadPct} %
            </dd>
          </div>
          <div className="fpr-kv-row">
            <dt>{pick(lang, "Planned deload week", "Плановая разгрузка")}</dt>
            <dd>{everyText}</dd>
          </div>
        </dl>
      )}
      <p className="fit-muted fpr-small">
        {pick(
          lang,
          "The weight step is the larger of this percentage and the machine's smallest step. A planned deload week has 40 % fewer sets at the same weights with 2 more reps in reserve.",
          "Шаг веса — большее из этого процента и минимального шага тренажёра. В плановую разгрузочную неделю на 40 % меньше подходов с теми же весами и на 2 повторения больше в запасе.",
        )}
      </p>
    </section>
  );
}
