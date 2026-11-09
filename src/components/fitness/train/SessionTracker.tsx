"use client";
/**
 * The gym screen (stream 04 — plans/fitness/04-session-tracker-ui.md). States: loading (skeleton, no hydration
 * mismatch) → start panel → running session (one tap per set, steppers, rest timer, swaps) → summary. A session left
 * open resumes exactly (planned at its start, every action saved at once); one older than 6 h is closed and its
 * progression applied once. Visitors see the plan, and the owner's running session live, read-only.
 *
 * Double taps: logging a set moves the screen (the next row opens, the rest timer appears, the view scrolls), so the
 * second tap of a double tap would land on whatever slid under the thumb. For SHIELD_MS after a set is logged a tap on
 * the same spot is dropped and the next set's Done waits; set ids are per row (setIdFor), so a row logged twice is still
 * one set.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Lang, Program, Session } from "@/lib/fitness/types";
import { fmtTime, pick, t2 } from "@/lib/fitness/i18n";
import { exerciseById } from "@/lib/fitness/catalog.mjs";
import { newGym, preferForSlot, setPreferred } from "@/lib/fitness/gyms-core.mjs";
import {
  activePlan, activeSession, adjustSet, dayOf, endSession, exerciseName, holdOf, inferSwaps, logPlannedSet, planSettings,
  plannedCounts, programOf, reopenSession, safetyInfo, sessionGym, sessionModel, setText, setsOfSession, type Row,
} from "@/lib/fitness/tracker.mjs";
import { useFitness } from "../Provider";
import { ExerciseBlock, type BlockActions, type BlockView } from "./ExerciseBlock";
import { EndSheet } from "./EndSheet";
import { SessionBar } from "./RestTimer";
import { SessionSummary } from "./SessionSummary";
import { StartPanel } from "./StartPanel";
import { SwapSheet, type SwapContext } from "./SwapSheet";
import type { Draft } from "./SetRow";
import {
  buzz, leaveSummary, revealRow, scrollBehavior, setSummary, updateSessionUi, useClock, useCloseOuts, useProgram, useSessionUi,
  useSummary, useSummaryUntilLeave, useWakeLock,
} from "./hooks";

/** How long the summary stays up in this tab when "Done" is not tapped (a tab kept open until the next gym day). */
const SUMMARY_KEEP_MS = 3 * 3600_000;
/**
 * After a set is logged, a tap on the same spot of the screen is dropped for this long: the second tap of a double tap
 * must not log the next set, change its weight or shorten the rest timer that slid under the thumb (the rehearsal's
 * probe: 7 of 18 double taps 80–300 ms apart logged two sets).
 */
const SHIELD_MS = 700;
/** "The same spot": a thumb's second tap lands within this many px of the first. */
const SHIELD_PX = 48;
/** The next set's Done waits a little longer than the shield, so the tap that finds it enabled is never dropped. */
const ARM_MS = SHIELD_MS + 60;

export function SessionTracker({ lang }: { lang: Lang }) {
  const { snapshot, store, mode, canWrite } = useFitness();
  const minute = useClock(60_000);
  const saved = useSummary();
  const { program, created } = useProgram(minute);
  useCloseOuts();
  useSummaryUntilLeave();

  if (mode === "loading" || minute == null) {
    return (
      <div className="trk-loading" aria-busy="true">
        <div className="fit-card trk-skeleton" />
        <p className="fit-muted">{pick(lang, "Loading your plan…", "Загружаем план…")}</p>
      </div>
    );
  }
  const readOnly = !canWrite;
  const active = activeSession(snapshot, minute);
  const summary = saved && minute - saved.at < SUMMARY_KEEP_MS ? saved.summary : null;
  if (summary && !readOnly && (!active || active.id === summary.sessionId)) {
    // "Reopen" (master plan §16): back to the session with the exercise states from before End, so ending again
    // re-applies the progression from the corrected sets. Offered only while that is still safe.
    const reopen = () => {
      const r = reopenSession({ snapshot, undo: summary.reopen, now: new Date() });
      if (!r) return;
      store.upsert("sessions", r.session);
      for (const state of r.states) store.upsert("exercise_state", state);
      for (const id of r.remove) store.remove("exercise_state", id);
      setSummary(null);
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    };
    const canReopen = reopenSession({ snapshot, undo: summary.reopen, now: minute }) != null;
    return <SessionSummary lang={lang} summary={summary} onDone={leaveSummary} onReopen={canReopen ? reopen : undefined} />;
  }
  if (active) {
    return <ActiveSession key={active.id} lang={lang} session={active} program={programOf(snapshot, active, program)} readOnly={readOnly} />;
  }
  return <StartPanel lang={lang} program={program} created={created} readOnly={readOnly} now={minute} />;
}

const omit = <T,>(map: Record<string, T>, key: string) => {
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
};

function ActiveSession({ lang, session, program, readOnly }: { lang: Lang; session: Session; program: Program; readOnly: boolean }) {
  const { snapshot, store } = useFitness();
  const ui = useSessionUi(session.id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [techOpen, setTechOpen] = useState<Record<string, boolean>>({});
  const [swapSlot, setSwapSlot] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  // the double-tap shield: the last tap's spot, the spot and time a set was logged, and the next Done waiting meanwhile
  const lastTap = useRef<{ x: number; y: number } | null>(null);
  const shield = useRef<{ t: number; x: number; y: number } | null>(null);
  const [arming, setArming] = useState<number | null>(null);
  useWakeLock(!readOnly);

  useEffect(() => {
    if (arming == null) return;
    const id = window.setTimeout(() => setArming((a) => (a === arming ? null : a)), ARM_MS);
    return () => window.clearTimeout(id);
  }, [arming]);

  const plan = useMemo(() => activePlan({ snapshot, session, program, swaps: ui.swaps }), [snapshot, session, program, ui.swaps]);
  const sets = useMemo(() => setsOfSession(snapshot.sets, session.id), [snapshot.sets, session.id]);
  const model = useMemo(() => sessionModel({ plan, sets, ui }), [plan, sets, ui]);
  const gym = sessionGym(snapshot, session);
  const currentKey = model.current?.key ?? null;
  const day = dayOf(program, session.dayKey);
  const safety = safetyInfo();
  // weight holds (master plan §16) of the exercises planned today, as of the session start
  const holds = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of plan.exercises) {
      const until = holdOf(snapshot.exerciseState[p.exerciseId], session.startedAt);
      if (until) out[p.exerciseId] = until;
    }
    return out;
  }, [plan, snapshot.exerciseState, session.startedAt]);

  // keep the next set in view after each logged set (and when a session resumes)
  useEffect(() => {
    if (!currentKey || readOnly) return;
    const el = document.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(currentKey)}"]`);
    if (!el) return;
    // next frame: the rest timer that appears with the same tap has grown the bottom bar by then
    const frame = requestAnimationFrame(() => revealRow(el));
    return () => cancelAnimationFrame(frame);
  }, [currentKey, readOnly]);

  /** Capture phase of every tap in the session (bottom bar and sheets included): drop the second tap of a double tap. */
  const onClickCapture = (e: MouseEvent) => {
    const s = shield.current;
    if (s && e.detail > 0 && performance.now() - s.t < SHIELD_MS && Math.hypot(e.clientX - s.x, e.clientY - s.y) < SHIELD_PX) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    lastTap.current = e.detail > 0 ? { x: e.clientX, y: e.clientY } : null;
  };

  const exerciseOfSlot = (slotId: string) => model.blocks.flatMap((b) => b.exercises).find((e) => e.planned.slotId === slotId);
  const nowIso = () => new Date().toISOString();

  const actions: BlockActions = {
    done(row: Row) {
      if (readOnly) return;
      const draft = drafts[row.key] ?? row.suggest;
      const set = logPlannedSet({ session, planned: row.planned, exerciseId: row.exerciseId, slotId: row.slotId, index: row.index, now: new Date(), overrides: draft, prescription: { version: 1, targetRir: row.planned.rir ?? null, rirReported: draft.rirReported === true, suggestedKg: row.suggest.kg, suggestedReps: row.suggest.reps, reason: row.adaptation, basedOnSetId: row.basedOnSetId } });
      store.upsert("sets", set);
      const t = performance.now();
      shield.current = { t, x: lastTap.current?.x ?? Number.NaN, y: lastTap.current?.y ?? Number.NaN };
      setArming(t);
      buzz(15);
      setDrafts((d) => omit(d, row.key));
      setOpenRows((o) => omit(o, row.key));
    },
    adjust(row, change) {
      if (readOnly) return;
      const ex = exerciseById(row.exerciseId) ?? null;
      if (row.logged) {
        store.upsert("sets", { ...adjustSet(row.logged, change, ex), updatedAt: nowIso() });
        return;
      }
      setDrafts((d) => ({ ...d, [row.key]: ({ ...adjustSet(d[row.key] ?? row.suggest, change, ex), rirReported: change.rir !== undefined ? change.rir != null : d[row.key]?.rirReported ?? false }) }));
    },
    undo(row) {
      if (readOnly || !row.logged) return;
      store.remove("sets", row.logged.id);
      setOpenRows((o) => omit(o, row.key));
    },
    toggle(row) {
      setOpenRows((o) => ({ ...o, [row.key]: !(o[row.key] ?? row.key === currentKey) }));
    },
    removeAdded(slotId) {
      const floor = exerciseOfSlot(slotId)?.addedLogged ?? 0;
      updateSessionUi(session.id, (u) => ({ ...u, extra: { ...u.extra, [slotId]: Math.max(floor, (u.extra?.[slotId] ?? 0) - 1) } }));
    },
    skip(slotId, skip) {
      updateSessionUi(session.id, (u) => ({ ...u, skipped: { ...u.skipped, [slotId]: skip } }));
    },
    addSet(slotId) {
      const floor = exerciseOfSlot(slotId)?.addedLogged ?? 0;
      updateSessionUi(session.id, (u) => ({ ...u, extra: { ...u.extra, [slotId]: Math.max(u.extra?.[slotId] ?? 0, floor) + 1 } }));
    },
    openSwap(slotId) {
      setSwapSlot(slotId);
    },
    toggleWarmups(slotId, open) {
      updateSessionUi(session.id, (u) => ({ ...u, warm: { ...u.warm, [slotId]: open } }));
    },
    toggleTechnique(slotId) {
      setTechOpen((t) => ({ ...t, [slotId]: !t[slotId] }));
    },
  };

  /**
   * "Use this at this gym from now on": the gym page's own preference (preferForSlot: keyed by the slot's exercise, so
   * it survives a 2-/3-/4-day switch). A gym is created and made active when there is none.
   */
  const rememberSwap = (slotId: string, exerciseId: string) => {
    const at = nowIso();
    let target = gym;
    if (!target) {
      target = newGym(pick(lang, "My gym", "Мой зал"), at);
      if (snapshot.settings) store.upsert("settings", { ...snapshot.settings, activeGymId: target.id, updatedAt: at });
    }
    const slotExercise = day?.slots.find((s) => s.slotId === slotId)?.exerciseId;
    const next = slotExercise ? preferForSlot(target, { slotId, exerciseId: slotExercise }, exerciseId, at) : setPreferred(target, slotId, exerciseId, at);
    if (next !== target || !snapshot.gyms[target.id]) store.upsert("gyms", next);
    if (session.gymId !== target.id) store.upsert("sessions", { ...session, gymId: target.id, updatedAt: at });
  };

  const pickSwap = (slotId: string, exerciseId: string, remember: boolean) => {
    setSwapSlot(null);
    if (readOnly) return;
    updateSessionUi(session.id, (u) => ({ ...u, swaps: { ...u.swaps, [slotId]: exerciseId } }));
    setDrafts({});
    if (remember) rememberSwap(slotId, exerciseId);
  };

  const finish = () => {
    setEnding(false);
    if (readOnly) return;
    // the working sets this screen planned per exercise: fewer logged than planned holds (master plan §16, rule 4)
    const result = endSession({ snapshot, session, sets: snapshot.sets, program, now: new Date(), plannedSets: plannedCounts(model) });
    setSummary(result.summary);
    store.upsert("sessions", result.session);
    for (const state of result.changed) store.upsert("exercise_state", state);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };

  const swapCtx: SwapContext = useMemo(
    () => ({
      plan,
      program,
      states: snapshot.exerciseState,
      gym,
      settings: planSettings(snapshot, session.bodyweightKg),
      now: session.startedAt,
      swaps: { ...inferSwaps(sets), ...(ui.swaps ?? {}) },
    }),
    [plan, program, snapshot, gym, session.bodyweightKg, session.startedAt, sets, ui.swaps],
  );
  const swapPlanned = swapSlot ? plan.exercises.find((p) => p.slotId === swapSlot) ?? null : null;

  const view: BlockView = {
    currentKey,
    drafts,
    openRows,
    warmOpen: ui.warm ?? {},
    techOpen,
    firstSlotId: plan.exercises[0]?.slotId ?? null,
    readOnly,
    gym,
    arming: arming != null,
    holds,
  };
  const minutes = Math.max(0, Math.round((Date.parse(model.lastSet?.doneAt ?? session.startedAt) - Date.parse(session.startedAt)) / 60_000));

  return (
    <section className="trk-session" data-testid="session" data-session-id={session.id} data-status={session.status} onClickCapture={onClickCapture}>
      <header className="trk-session-head">
        <p className="trk-kicker">
          {readOnly ? pick(lang, "Ilya is training now", "Илья сейчас тренируется") : pick(lang, "Session in progress", "Идёт тренировка")}
        </p>
        <h2>{t2(lang, plan.dayName) || session.dayKey}</h2>
        <p className="fit-muted fit-num">
          {pick(lang, `Started ${fmtTime(session.startedAt, lang)}`, `Начало ${fmtTime(session.startedAt, lang)}`)}
          {" · "}
          {gym?.name || pick(lang, "any gym", "любой зал")}
        </p>
        {!plan.exercises.length ? (
          <p className="fit-note warn">{pick(lang, "This day has no exercises in the program.", "В программе для этого дня нет упражнений.")}</p>
        ) : null}
      </header>

      {!readOnly ? (
        <details className="trk-safety">
          <summary>{pick(lang, "Warm-up and pain rules", "Разминка и правила при боли")}</summary>
          <p>{t2(lang, safety.warmup ?? plan.warmup)}</p>
          <ul className="trk-pain">
            {safety.pain.map((p) => (
              <li key={p.level} className={`is-${p.level}`}>{t2(lang, p.action)}</li>
            ))}
            {safety.redFlags.map((f) => (
              <li key={f.en} className="is-red">{t2(lang, f)}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {model.blocks.map((b) => (
        <ExerciseBlock key={b.key} lang={lang} block={b} view={view} actions={actions} />
      ))}

      {model.orphans.length ? (
        <div className="fit-card trk-orphans">
          <h3>{pick(lang, "Other sets in this session", "Другие подходы этой тренировки")}</h3>
          <ul>
            {model.orphans.map((s) => (
              <li key={s.id} className="fit-num">
                {exerciseName(s.exerciseId, lang)} · {setText(s, exerciseById(s.exerciseId), lang)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.finisher ? (
        <div className="fit-card trk-finisher">
          <h3>{pick(lang, "Finisher", "Финишер")}</h3>
          <p>{t2(lang, plan.finisher)}</p>
        </div>
      ) : null}

      <SessionBar
        lang={lang}
        session={session}
        model={model}
        rest={ui.rest}
        restTimer={snapshot.settings?.restTimer !== false}
        readOnly={readOnly}
        onAdjust={(setId, delta) =>
          updateSessionUi(session.id, (u) => ({ ...u, rest: { setId, adjust: (u.rest?.setId === setId ? u.rest.adjust : 0) + delta, dismissed: false } }))
        }
        onDismiss={(setId) =>
          updateSessionUi(session.id, (u) => ({ ...u, rest: { setId, adjust: u.rest?.setId === setId ? u.rest.adjust : 0, dismissed: true } }))
        }
        onEnd={() => setEnding(true)}
      />

      {!readOnly ? (
        <>
          <SwapSheet
            key={swapSlot ?? "closed"}
            lang={lang}
            planned={swapPlanned}
            ctx={swapCtx}
            onPick={pickSwap}
            onSkip={(slotId) => {
              setSwapSlot(null);
              actions.skip(slotId, true);
            }}
            onClose={() => setSwapSlot(null)}
          />
          <EndSheet
            lang={lang}
            open={ending}
            done={model.completion.done}
            total={model.completion.total}
            minutes={minutes}
            onConfirm={finish}
            onClose={() => setEnding(false)}
          />
        </>
      ) : null}
    </section>
  );
}
