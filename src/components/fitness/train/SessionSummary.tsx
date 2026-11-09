/**
 * After "Finish" (stream 04): duration, sets, tonnage, records, and per exercise the top set, the e1RM and what the
 * engine changes next time (badge + its note); then the next session, and "Reopen" to fix a set while that is still
 * possible (the targets are worked out again on the next End). "Done" returns to /fitness. Plate-loaded machines say
 * "plates, both sides" (master plan §16); a weight hold still ahead says until when.
 * Test hooks: session-summary, session-reopen, summary-done.
 */
import Link from "next/link";
import type { Lang } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { fmtDate, fmtKg, kgLabel, pick, t2 } from "@/lib/fitness/i18n";
import { exerciseById } from "@/lib/fitness/catalog.mjs";
import {
  exerciseName, holdText, noteHasHold, setHint, setText, setsWord, type SessionSummary as Summary, type SummaryPr,
} from "@/lib/fitness/tracker.mjs";

const prText = (lang: Lang, pr: SummaryPr) => {
  const kg = `${fmtKg(pr.value, lang)} ${kgLabel(lang)}`;
  const was = `${fmtKg(pr.previous, lang)} ${kgLabel(lang)}`;
  if (pr.kind === "e1rm") return pick(lang, `estimated 1RM ${kg} (was ${was})`, `расчётный 1ПМ ${kg} (было ${was})`);
  if (pr.kind === "load") return pick(lang, `heaviest set ${kg} × ${pr.reps} (was ${was})`, `самый тяжёлый подход ${kg} × ${pr.reps} (было ${was})`);
  return pick(lang, `${pr.value} reps at ${fmtKg(pr.kg, lang)} ${kgLabel(lang)} (was ${pr.previous})`, `${pr.value} повт. с ${fmtKg(pr.kg, lang)} ${kgLabel(lang)} (было ${pr.previous})`);
};

export function SessionSummary({ lang, summary, onDone, onReopen }: {
  lang: Lang;
  summary: Summary;
  /** "Done" was tapped: its link leaves for /fitness (the summary stays up until it has) */
  onDone: () => void;
  /** Back to the session (states from before End restored); absent when that is no longer safe */
  onReopen?: () => void;
}) {
  const discarded = summary.status === "abandoned";
  return (
    <section className="trk-summary" data-testid="session-summary" data-session-id={summary.sessionId}>
      <div className="fit-card">
        <p className="trk-kicker">{fmtDate(summary.startedAt, lang, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h2>
          {discarded ? pick(lang, "Session discarded", "Тренировка отменена") : pick(lang, "Session done", "Тренировка закончена")}
          {" · "}
          {t2(lang, summary.dayName)}
        </h2>
        {discarded ? (
          <p className="fit-muted">{pick(lang, "Nothing was logged, so the plan and the rotation stay as they were.", "Ничего не записано, поэтому план и очередь дней не изменились.")}</p>
        ) : (
          <dl className="trk-stats">
            <div><dt>{pick(lang, "Time", "Время")}</dt><dd className="fit-num">{summary.minutes} {pick(lang, "min", "мин")}</dd></div>
            <div><dt>{pick(lang, "Working sets", "Рабочие подходы")}</dt><dd className="fit-num">{summary.working.done}/{summary.working.total}</dd></div>
            <div><dt>{pick(lang, "Tonnage", "Тоннаж")}</dt><dd className="fit-num">{fmtKg(Math.round(summary.tonnage), lang)} {kgLabel(lang)}</dd></div>
            <div><dt>{pick(lang, "Hard sets", "Тяжёлые подходы")}</dt><dd className="fit-num">{summary.hardSets}</dd></div>
          </dl>
        )}
      </div>

      {summary.prs.length ? (
        <div className="fit-card trk-prs">
          <h3>{pick(lang, "Personal records", "Личные рекорды")}</h3>
          <ul>
            {summary.prs.map((pr) => (
              <li key={`${pr.exerciseId}:${pr.kind}`}>
                <strong>{exerciseName(pr.exerciseId, lang)}</strong> — {prText(lang, pr)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.exercises.length ? (
        <div className="fit-card">
          <h3>{pick(lang, "What changes next time", "Что изменится в следующий раз")}</h3>
          <ol className="trk-sum-list">
            {summary.exercises.map((e) => {
              const ex = exerciseById(e.exerciseId);
              const hint = setHint(ex, lang);
              return (
                <li key={e.exerciseId} className="trk-sum-item">
                  <div className="trk-sum-head">
                    <Link prefetch={false} href={localPath(lang, `/fitness/exercises/${e.exerciseId}`)}>{exerciseName(e.exerciseId, lang)}</Link>
                    <span className={`trk-badge-out is-${e.badge.kind}`}>{t2(lang, e.badge.text)}</span>
                  </div>
                  <p className="trk-sum-meta fit-num">
                    {e.topSet ? `${pick(lang, "Top set", "Лучший подход")} ${setText(e.topSet, ex, lang)}` : null}
                    {e.e1rm > 0 ? ` · e1RM ${fmtKg(e.e1rm, lang)} ${kgLabel(lang)}` : ""}
                    {` · ${setsWord(e.sets, lang)}`}
                    {e.after ? ` · ${pick(lang, "next", "далее")} ${setText(e.after, ex, lang)}` : ""}
                    {hint && (e.topSet || e.after) ? ` · ${hint}` : ""}
                  </p>
                  {e.note ? <p className="trk-note">{t2(lang, e.note)}</p> : null}
                  {e.hold && !noteHasHold(e.note, e.hold, lang) ? <p className="trk-note trk-hold">{holdText(e.hold, lang)}</p> : null}
                </li>
              );
            })}
          </ol>
          {summary.skipped.length ? (
            <p className="fit-muted">
              {pick(lang, "Not done today (targets unchanged): ", "Не сделано сегодня (цели прежние): ")}
              {summary.skipped.map((s) => exerciseName(s.exerciseId, lang)).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {summary.next ? (
        <div className="fit-card trk-next">
          <h3>
            {pick(lang, "Next session", "Следующая тренировка")}: {t2(lang, summary.next.dayName)}
            <span className="fit-muted fit-num"> · ~{summary.next.estimatedMinutes} {pick(lang, "min", "мин")}</span>
          </h3>
          <ul className="trk-plan-list">
            {summary.next.exercises.map((p) => {
              const ex = exerciseById(p.exerciseId);
              return (
                <li key={p.slotId}>
                  <span className="trk-slot fit-num">{p.slotId}</span>
                  <span className="trk-plan-name">{exerciseName(p.exerciseId, lang)}</span>
                  <span className="trk-plan-target fit-num">
                    {setText({ kg: p.kg, reps: p.reps }, ex, lang)} · {setsWord(p.sets, lang)}
                    {setHint(ex, lang) ? ` · ${setHint(ex, lang)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {onReopen ? (
        <div className="fit-card trk-reopen">
          <p className="fit-muted">
            {discarded
              ? pick(lang, "Discarded by mistake? Go back to the session.", "Отменили по ошибке? Вернитесь к тренировке.")
              : pick(
                  lang,
                  "Forgot a set or logged one wrong? Reopen the session and fix it: next time's targets are worked out again when you finish.",
                  "Забыли подход или записали его неверно? Вернитесь к тренировке и исправьте: цели на следующий раз пересчитаются, когда вы её закончите.",
                )}
          </p>
          <button type="button" className="fit-button quiet" data-testid="session-reopen" onClick={onReopen}>
            {pick(lang, "Reopen the session", "Вернуться к тренировке")}
          </button>
        </div>
      ) : null}

      <div className="trk-bar">
        <Link prefetch={false} className="fit-button trk-wide" href={localPath(lang, "/fitness")} onClick={onDone} data-testid="summary-done">
          {pick(lang, "Done", "Готово")}
        </Link>
      </div>
    </section>
  );
}
