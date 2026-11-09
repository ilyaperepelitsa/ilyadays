/**
 * Sticky bottom bar of a running session (stream 04): the rest countdown after each set (from the set's doneAt, so it
 * survives a reload; −30 s / +30 s / dismiss; one vibration at zero where supported; counts on past zero for up to
 * 10 min), the elapsed time, sets done and the End button. Test hooks: rest-timer (+ data-ends-at), rest-adjust
 * (+ data-delta, seconds), end-session.
 */
import { useEffect, useRef } from "react";
import type { Lang, Session } from "@/lib/fitness/types";
import { fmtClock, pick } from "@/lib/fitness/i18n";
import { REST_OVERRUN_SEC, elapsed, restWindow, type SessionModel } from "@/lib/fitness/tracker.mjs";
import { buzz, useClock, type RestUi } from "./hooks";

export function SessionBar({ lang, session, model, rest, restTimer, readOnly, onAdjust, onDismiss, onEnd }: {
  lang: Lang;
  session: Session;
  model: SessionModel;
  /** This device's ±30 s / dismiss for the last set (ignored when it belongs to another set) */
  rest: RestUi | undefined;
  /** settings.restTimer */
  restTimer: boolean;
  readOnly: boolean;
  onAdjust: (setId: string, deltaSec: number) => void;
  onDismiss: (setId: string) => void;
  onEnd: () => void;
}) {
  const now = useClock(1000);
  const last = model.lastSet;
  const mine = rest && last && rest.setId === last.id ? rest : null;
  const win = restTimer && !readOnly ? restWindow({ model, adjustSec: mine?.adjust ?? 0 }) : null;
  const visible = Boolean(win && now != null && !mine?.dismissed && now < win.endsAt + REST_OVERRUN_SEC * 1000);
  const remaining = win && now != null ? Math.ceil((win.endsAt - now) / 1000) : 0;
  const expired = visible && remaining <= 0;
  const setId = win?.setId ?? null;
  const endsAt = win?.endsAt ?? 0;

  // one vibration when the countdown reaches zero (not for a timer that ran out long ago, e.g. after a reload)
  const buzzed = useRef<string | null>(null);
  useEffect(() => {
    if (!expired || !setId || now == null || buzzed.current === setId) return;
    buzzed.current = setId;
    if (now - endsAt < 60_000) buzz([100, 60, 100]);
  }, [expired, setId, endsAt, now]);

  const total = model.completion.total;
  const done = model.completion.done;
  const secs = now == null ? 0 : elapsed(session, now);

  return (
    <div className="trk-bar" role="region" aria-label={pick(lang, "Session controls", "Управление тренировкой")}>
      {visible && win ? (
        <div className={`trk-rest${expired ? " is-over" : ""}`} data-testid="rest-timer" data-ends-at={new Date(win.endsAt).toISOString()}>
          <button type="button" className="trk-rest-adj" data-testid="rest-adjust" data-delta={-30} onClick={() => onAdjust(win.setId, -30)} aria-label={pick(lang, "30 seconds less rest", "Отдых на 30 секунд меньше")}>
            −30 s
          </button>
          <div className="trk-rest-time" role="timer" aria-live="off">
            <span className="trk-rest-label">{expired ? pick(lang, "Rest over", "Отдых окончен") : pick(lang, "Rest", "Отдых")}</span>
            <span className="trk-rest-clock fit-num">{expired ? `+${fmtClock(-remaining)}` : fmtClock(remaining)}</span>
          </div>
          <button type="button" className="trk-rest-adj" data-testid="rest-adjust" data-delta={30} onClick={() => onAdjust(win.setId, 30)} aria-label={pick(lang, "30 seconds more rest", "Отдых на 30 секунд больше")}>
            +30 s
          </button>
          <button type="button" className="trk-rest-close" onClick={() => onDismiss(win.setId)} aria-label={pick(lang, "Hide the rest timer", "Скрыть таймер отдыха")}>
            ×
          </button>
          <span className="sr-only" aria-live="polite">{expired ? pick(lang, "Rest over: next set.", "Отдых окончен: следующий подход.") : ""}</span>
        </div>
      ) : null}
      <div className="trk-bar-main">
        <span className="trk-bar-stat fit-num" aria-label={pick(lang, "Time since the start", "Время с начала")}>
          {fmtClock(secs)}
        </span>
        <span className="trk-bar-stat fit-num" aria-label={pick(lang, `${done} of ${total} working sets`, `${done} из ${total} рабочих подходов`)}>
          {done}/{total} {pick(lang, "sets", "подх.")}
        </span>
        {!readOnly ? (
          <button type="button" className={`fit-button trk-end-button${model.complete ? "" : " quiet"}`} data-testid="end-session" onClick={onEnd}>
            {model.complete ? pick(lang, "Finish", "Закончить") : pick(lang, "End", "Завершить")}
          </button>
        ) : (
          <span className="trk-live" aria-live="polite">{pick(lang, "Live", "В эфире")}</span>
        )}
      </div>
    </div>
  );
}
