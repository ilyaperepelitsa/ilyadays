/**
 * "Machine taken or missing?" — the alternatives this gym has for one slot, with their muscles and the load they
 * would start at (the engine's substitute maths), and a toggle that remembers the choice for this gym from now on.
 * When the gym has none, the sheet says which ones are marked "not here" and offers to skip the exercise today or to
 * edit the gym. Stream 04. Test hooks: swap-option (+ data-exercise-id), swap-empty, swap-skip.
 */
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { ExerciseState, Gym, Lang, PlannedExercise, PlannedSession, Program, Settings } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { pick } from "@/lib/fitness/i18n";
import { equipmentLabel, exerciseById } from "@/lib/fitness/catalog.mjs";
import { exerciseName, muscleTags, prescriptionText, swapChoices, swapInSession } from "@/lib/fitness/tracker.mjs";
import { Sheet } from "./Sheet";

export type SwapContext = {
  plan: PlannedSession;
  program: Program;
  states: Record<string, ExerciseState>;
  /** the gym the session plans with (sessionGym); null = every machine counts as available */
  gym: Gym | null;
  settings: Settings;
  now: string;
  swaps: Record<string, string>;
};

export function SwapSheet({ lang, planned, ctx, onPick, onSkip, onClose }: {
  lang: Lang;
  /** The slot being swapped; null = closed */
  planned: PlannedExercise | null;
  ctx: SwapContext;
  onPick: (slotId: string, exerciseId: string, remember: boolean) => void;
  /** Skip the exercise today (offered when nothing here can replace it) */
  onSkip: (slotId: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [remember, setRemember] = useState(false);
  const choices = useMemo(() => (planned ? swapChoices(planned, ctx.gym) : { options: [], missing: [] }), [planned, ctx.gym]);
  const options = useMemo(() => {
    if (!planned) return [];
    return choices.options.map((id) => {
      const swapped = swapInSession(ctx.plan, planned.slotId, id, ctx.states, undefined, {
        program: ctx.program,
        dayKey: ctx.plan.dayKey,
        gym: ctx.gym,
        settings: ctx.settings,
        now: ctx.now,
        swaps: ctx.swaps,
      });
      const next = swapped.exercises.find((p) => p.slotId === planned.slotId);
      const ex = exerciseById(id);
      return {
        id,
        name: exerciseName(id, lang),
        equipment: ex ? equipmentLabel(ex.equipment, lang) : "",
        muscles: muscleTags(id, lang).primary.join(", "),
        start: next ? prescriptionText(next, ex, lang) : "",
        known: Boolean(ctx.states[id]),
        original: id === planned.programExerciseId,
      };
    });
  }, [planned, choices, ctx, lang]);
  const gymName = ctx.gym?.name || null;
  const missingNames = choices.missing.map((id) => exerciseName(id, lang));

  return (
    <Sheet open={planned != null} onClose={onClose} labelledBy={titleId} className="trk-swap">
      {planned ? (
        <>
          <h2 id={titleId} className="trk-sheet-title">
            {pick(lang, `Swap ${exerciseName(planned.exerciseId, lang)}`, `Замена: ${exerciseName(planned.exerciseId, lang)}`)}
          </h2>
          {options.length ? (
            <>
              <p className="fit-muted trk-sheet-lede">
                {gymName
                  ? pick(lang, `Same movement and muscles, available at ${gymName}, best match first.`, `То же движение и мышцы, есть в зале «${gymName}»; лучшие варианты сверху.`)
                  : pick(lang, "Same movement and muscles, best match first. No gym is chosen, so every machine counts as available.", "То же движение и мышцы; лучшие варианты сверху. Зал не выбран, поэтому все тренажёры считаются доступными.")}
              </p>
              <ul className="trk-options">
                {options.map((o) => (
                  <li key={o.id}>
                    <button type="button" className="trk-option" data-testid="swap-option" data-exercise-id={o.id} onClick={() => onPick(planned.slotId, o.id, remember)}>
                      <span className="trk-option-name">
                        {o.name}
                        {o.original ? <span className="trk-tag">{pick(lang, "in the plan", "по плану")}</span> : null}
                      </span>
                      <span className="trk-option-meta">{[o.equipment, o.muscles].filter(Boolean).join(" · ")}</span>
                      {o.start ? (
                        <span className="trk-option-start fit-num">
                          {o.known ? pick(lang, "Your target: ", "Ваша цель: ") : pick(lang, "Starts at ", "Старт: ")}
                          {o.start}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              <label className="trk-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>
                  {gymName
                    ? pick(lang, `Use this at ${gymName} from now on`, `Использовать в зале «${gymName}» и дальше`)
                    : pick(lang, "Use this at my gym from now on (creates a gym profile)", "Использовать в моём зале и дальше (создаст профиль зала)")}
                </span>
              </label>
            </>
          ) : (
            <div className="trk-sheet-lede" data-testid="swap-empty" data-missing={choices.missing.length}>
              <p>
                {missingNames.length
                  ? pick(
                      lang,
                      `Nothing here can replace it: ${missingNames.join(", ")} ${missingNames.length === 1 ? "is" : "are"} marked “not here”${gymName ? ` at ${gymName}` : ""}.`,
                      `Здесь нечем заменить: ${missingNames.join(", ")} — отмечено «нет в зале»${gymName ? ` («${gymName}»)` : ""}.`,
                    )
                  : pick(lang, "The catalog has no alternative for this exercise yet.", "Для этого упражнения в каталоге пока нет замен.")}
              </p>
              <p className="fit-muted">
                {pick(
                  lang,
                  "Skip it today (its targets stay as they are), or mark a machine as here on the gym page.",
                  "Пропустите его сегодня (цели не изменятся) или отметьте тренажёр как «есть» на странице зала.",
                )}
              </p>
            </div>
          )}
          <div className="trk-sheet-actions">
            {!options.length ? (
              <>
                <button type="button" className="fit-button" data-testid="swap-skip" onClick={() => onSkip(planned.slotId)}>
                  {pick(lang, "Skip it today", "Пропустить сегодня")}
                </button>
                <Link prefetch={false} className="fit-button quiet" href={localPath(lang, "/fitness/gyms")}>
                  {pick(lang, "Edit the gym's machines", "Изменить тренажёры зала")}
                </Link>
              </>
            ) : null}
            <button type="button" className="fit-button quiet" onClick={onClose}>
              {pick(lang, "Cancel", "Отмена")}
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}
