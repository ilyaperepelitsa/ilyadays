"use client";
/**
 * The data cards of /fitness (stream 04): the next session (day, focus, exercises with today's targets, minutes,
 * Start) or the running one (Resume), this week against the plan with the streak, the last session and what the
 * progression did, and body weight with its EWMA trend. A held weight (master plan §16) says until when.
 * Test hooks: next-session (+ data-day-key), start-session.
 */
import Link from "next/link";
import { useMemo } from "react";
import type { Lang } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { fmtDate, fmtKg, fmtTime, kgLabel, pick, t2 } from "@/lib/fitness/i18n";
import { exerciseById } from "@/lib/fitness/catalog.mjs";
import {
  activePlan, activeSession, blocksOf, bodyweightTrend, completion, dayOf, exerciseName, focusText, holdOf, holdText,
  lastSessionInfo, nextAfter, prescriptionText, programOf, setsOfSession, weekStatus,
} from "@/lib/fitness/tracker.mjs";
import { useFitness } from "../Provider";
import { useStoreStatus } from "../ModeNote";
import { useClock, useCloseOuts, useProgram } from "../train/hooks";

export function HomePanel({ lang }: { lang: Lang }) {
  const { snapshot, mode, canWrite } = useFitness();
  const status = useStoreStatus();
  const minute = useClock(60_000);
  const { program } = useProgram(minute);
  useCloseOuts();

  const data = useMemo(() => {
    if (minute == null) return null;
    const active = activeSession(snapshot, minute);
    const activeProgram = active ? programOf(snapshot, active, program) : program;
    const progress = active ? completion(activePlan({ snapshot, session: active, program: activeProgram }), setsOfSession(snapshot.sets, active.id)) : null;
    return {
      active,
      activeDay: active ? dayOf(activeProgram, active.dayKey) : undefined,
      progress,
      next: nextAfter(snapshot, program, minute),
      week: weekStatus(snapshot, program.daysPerWeek, minute),
      last: lastSessionInfo(snapshot, minute),
      body: bodyweightTrend(snapshot),
    };
  }, [snapshot, program, minute]);

  if (mode === "loading" || !data) {
    return (
      <div className="fh-panel" aria-busy="true">
        <div className="fit-card trk-skeleton" />
      </div>
    );
  }
  const { active, activeDay, progress, next, week, last, body } = data;
  const day = dayOf(program, next.dayKey);
  const trainHref = localPath(lang, "/fitness/train");

  if (!canWrite && !status?.ownerId) {
    return (
      <section className="fit-card fh-welcome" data-testid="fitness-welcome">
        <div className="fh-welcome-heading"><p className="fh-eyebrow">{pick(lang, "Start with you", "Начните с себя")}</p><h2>{pick(lang, "A plan you can make your own", "Программа под ваши задачи")}</h2><p>{pick(lang, "Your goals and starting weights are personal. Create your profile, choose what to train and build from there.", "Цели и стартовые веса у каждого свои. Создайте профиль, выберите, что тренировать, и соберите свою программу.")}</p></div>
        <div className="fh-welcome-actions"><Link prefetch={false} className="fit-button" href={localPath(lang, "/fitness/profile")}>{pick(lang, "Create your profile", "Создать свой профиль")} <span aria-hidden="true">→</span></Link><Link prefetch={false} className="fit-button quiet" href={localPath(lang, "/fitness/program")}>{pick(lang, "Explore the constructor", "Посмотреть конструктор")}</Link></div>
        <p className="fit-muted fh-private-note">{pick(lang, "Private by default. No cookies. Sharing is your choice.", "Приватно по умолчанию. Без cookies. Делитесь только по желанию.")}</p>
        <ol className="fh-steps">
          <li><span aria-hidden="true">01</span><div><strong>{pick(lang, "Choose your priorities", "Выберите приоритеты")}</strong><p>{pick(lang, "Strength, muscle, maintenance—and the muscle groups you want to train.", "Сила, мышцы, поддержание формы — и нужные группы мышц.")}</p></div></li>
          <li><span aria-hidden="true">02</span><div><strong>{pick(lang, "Find a comfortable start", "Подберите посильный старт")}</strong><p>{pick(lang, "Calibrate each exercise separately. No maximum attempt needed.", "Подберите вес отдельно для каждого упражнения, без максимальных попыток.")}</p></div></li>
          <li><span aria-hidden="true">03</span><div><strong>{pick(lang, "Build on what you do", "Двигайтесь от реального результата")}</strong><p>{pick(lang, "Actual reps, working weights, weigh-ins and body measurements.", "Фактические повторы, рабочие веса, взвешивания и замеры.")}</p></div></li>
        </ol>
      </section>
    );
  }

  return (
    <div className="fh-panel">
      {canWrite && !snapshot.activeProgramId ? <section className="fh-setup"><div><strong>{pick(lang, "Make this plan yours", "Настройте программу под себя")}</strong><p>{pick(lang, "Choose your goals and muscle groups before your first session.", "Выберите цели и группы мышц перед первой тренировкой.")}</p></div><Link prefetch={false} className="fit-button quiet" href={localPath(lang, "/fitness/profile")}>{pick(lang, "Set up your profile", "Настроить профиль")} <span aria-hidden="true">→</span></Link></section> : null}
      {active ? (
        <section className="fit-card fh-next is-live">
          <p className="trk-kicker">{canWrite ? pick(lang, "Session in progress", "Идёт тренировка") : pick(lang, "Ilya is training now", "Илья сейчас тренируется")}</p>
          <h2>{activeDay ? t2(lang, activeDay.name) : active.dayKey}</h2>
          <p className="fit-muted fit-num">
            {pick(lang, `Started ${fmtTime(active.startedAt, lang)}`, `Начало ${fmtTime(active.startedAt, lang)}`)}
            {progress ? ` · ${progress.done}/${progress.total} ${pick(lang, "working sets", "рабочих подходов")}` : ""}
          </p>
          <Link prefetch={false} className="fit-button trk-wide" href={trainHref} data-testid={canWrite ? "start-session" : undefined}>
            {canWrite ? pick(lang, "Resume", "Продолжить") : pick(lang, "Watch live", "Смотреть")}
          </Link>
        </section>
      ) : (
        <section className="fit-card fh-next" data-testid="next-session" data-day-key={next.dayKey}>
          <p className="trk-kicker">{canWrite ? pick(lang, "Next session", "Следующая тренировка") : pick(lang, "Ilya's next session", "Следующая тренировка Ильи")}</p>
          <h2>{t2(lang, next.plan.dayName)}</h2>
          <p className="fit-muted">
            {day ? focusText(day.focus, lang) : null}
            <span className="fit-num"> · ~{next.plan.estimatedMinutes}{"\u00a0"}{pick(lang, "min", "мин")}</span>
          </p>
          <ol className="trk-plan-list">
            {blocksOf(next.plan.exercises).flatMap((b) =>
              b.items.map((p, i) => {
                const hold = minute == null ? null : holdOf(snapshot.exerciseState[p.exerciseId], minute);
                return (
                  <li key={p.slotId} className={b.superset ? "is-superset" : undefined}>
                    <span className="trk-slot fit-num">{p.slotId}</span>
                    <span className="trk-plan-name">
                      {exerciseName(p.exerciseId, lang)}
                      {b.superset && i > 0 ? <span className="trk-tag soft">{pick(lang, "superset", "суперсет")}</span> : null}
                    </span>
                    <span className="trk-plan-target fit-num">{prescriptionText(p, exerciseById(p.exerciseId), lang)}</span>
                    {hold ? <span className="trk-plan-hold">{holdText(hold, lang)}</span> : null}
                  </li>
                );
              }),
            )}
          </ol>
          {canWrite ? (
            <Link prefetch={false} className="fit-button trk-wide" href={trainHref} data-testid="start-session">
              {pick(lang, "Start", "Начать")} · {t2(lang, next.plan.dayName)}
            </Link>
          ) : (
            <Link prefetch={false} className="fit-button ghost trk-wide" href={trainHref}>
              {pick(lang, "See the plan", "Посмотреть план")}
            </Link>
          )}
        </section>
      )}

      <div className="fh-cards">
        <section className="fit-card fh-card">
          <h3>{pick(lang, "This week", "Эта неделя")}</h3>
          <p className="fh-dots" role="img" aria-label={pick(lang, `${week.done} of ${week.planned} sessions`, `${week.done} из ${week.planned} тренировок`)}>
            {Array.from({ length: Math.max(week.planned, week.done) }, (_, i) => (
              <span key={i} className={`fh-dot${i < week.done ? " is-on" : ""}`} />
            ))}
          </p>
          <p className="fit-num">
            {pick(lang, `${week.done} of ${week.planned} sessions`, `${week.done} из ${week.planned} тренировок`)}
            {week.streak > 0 ? (
              <span className="fit-muted">
                {" · "}
                {pick(lang, `${week.streak}-week streak`, `серия ${week.streak} нед.`)}
              </span>
            ) : null}
          </p>
        </section>

        <section className="fit-card fh-card">
          <h3>{pick(lang, "Last session", "Последняя тренировка")}</h3>
          {last ? (
            <>
              <p>
                <strong>{last.dayName ? t2(lang, last.dayName) : last.session.dayKey}</strong>
                <span className="fit-muted fit-num">
                  {" · "}
                  {fmtDate(last.session.startedAt, lang, { weekday: "short", day: "numeric", month: "short" })} · {last.minutes}{"\u00a0"}{pick(lang, "min", "мин")}
                </span>
              </p>
              <p className="fit-muted fit-num">
                {[
                  last.outcomes.up ? pick(lang, `${last.outcomes.up} up`, `${last.outcomes.up} вверх`) : "",
                  last.outcomes.hold ? pick(lang, `${last.outcomes.hold} same`, `${last.outcomes.hold} без изменений`) : "",
                  last.outcomes.missed ? pick(lang, `${last.outcomes.missed} missed`, `${last.outcomes.missed} не добрано`) : "",
                  last.outcomes.down ? pick(lang, `${last.outcomes.down} lighter`, `${last.outcomes.down} легче`) : "",
                ].filter(Boolean).join(" · ") || pick(lang, `${last.workingSets} working sets`, `${last.workingSets} рабочих подходов`)}
                {last.autoClosed ? ` · ${pick(lang, "closed automatically", "закрыта автоматически")}` : ""}
              </p>
            </>
          ) : (
            <p className="fit-muted">{pick(lang, "No sessions yet: the first one sets your starting weights.", "Тренировок ещё не было: первая определит стартовые веса.")}</p>
          )}
        </section>

        <section className="fit-card fh-card">
          <h3>{pick(lang, "Body weight", "Вес тела")}</h3>
          {body ? (
            <>
              <p className="fh-big fit-num">
                {fmtKg(body.kg, lang)} {kgLabel(lang)}
                {body.arrow ? (
                  <span
                    className={`fh-arrow is-${body.arrow}`}
                    role="img"
                    aria-label={body.arrow === "up" ? pick(lang, "trending up", "растёт") : body.arrow === "down" ? pick(lang, "trending down", "снижается") : pick(lang, "steady", "стабильно")}
                  >
                    {body.arrow === "up" ? "↑" : body.arrow === "down" ? "↓" : "→"}
                  </span>
                ) : null}
              </p>
              <p className="fit-muted fit-num">
                {fmtDate(body.at, lang)}
                {body.points > 1 ? ` · ${pick(lang, "trend", "тренд")} ${fmtKg(body.trend, lang)} ${kgLabel(lang)}` : ""}
                {body.kgPerWeek != null ? ` · ${body.kgPerWeek > 0 ? "+" : ""}${fmtKg(body.kgPerWeek, lang)} ${pick(lang, "kg/week", "кг/нед")}` : ""}
              </p>
            </>
          ) : (
            <p className="fit-muted">{pick(lang, "No weigh-ins yet. Enter one before your next session or on Progress.", "Взвешиваний пока нет. Введите вес перед тренировкой или на странице прогресса.")}</p>
          )}
          <Link prefetch={false} className="fh-link" href={localPath(lang, "/fitness/progress")}>
            {pick(lang, "Progress →", "Прогресс →")}
          </Link>
        </section>
      </div>
    </div>
  );
}
