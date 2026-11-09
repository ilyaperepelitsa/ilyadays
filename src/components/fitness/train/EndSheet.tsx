/** Confirm ending the session (stream 04): finish and see what changes next time, or discard when nothing was logged. */
import { useId } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { Sheet } from "./Sheet";

export function EndSheet({ lang, open, done, total, minutes, onConfirm, onClose }: {
  lang: Lang;
  open: boolean;
  done: number;
  total: number;
  minutes: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const nothing = done === 0;
  const left = Math.max(0, total - done);
  return (
    <Sheet open={open} onClose={onClose} labelledBy={titleId} className="trk-end">
      <h2 id={titleId} className="trk-sheet-title">
        {nothing ? pick(lang, "Discard this session?", "Отменить тренировку?") : pick(lang, "End the session?", "Закончить тренировку?")}
      </h2>
      <p className="trk-sheet-lede fit-num">
        {nothing
          ? pick(lang, "No working set is logged yet. Discarding keeps the plan as it is; the rotation does not move on.", "Ещё не записано ни одного рабочего подхода. План не изменится, и очередь дней не сдвинется.")
          : pick(
              lang,
              `${done} of ${total} working sets in ${minutes} min.${left ? ` The ${left} left keep their targets.` : ""} Next time's weights and reps are set from what you logged.`,
              `${done} из ${total} рабочих подходов за ${minutes} мин.${left ? ` Оставшиеся (${left}) сохранят свои цели.` : ""} Веса и повторения на следующий раз рассчитаются по записанному.`,
            )}
      </p>
      <div className="trk-sheet-actions">
        <button type="button" className="fit-button" data-testid="end-confirm" onClick={onConfirm}>
          {nothing ? pick(lang, "Discard session", "Отменить тренировку") : pick(lang, "Finish session", "Закончить тренировку")}
        </button>
        <button type="button" className="fit-button quiet" onClick={onClose}>
          {pick(lang, "Keep training", "Продолжить")}
        </button>
      </div>
    </Sheet>
  );
}
