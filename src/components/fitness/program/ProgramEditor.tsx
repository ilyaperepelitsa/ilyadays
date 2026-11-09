"use client";
/**
 * /fitness/program (stream 10 — plans/fitness/10-ai-advisor.md): the program the owner trains with, its goal mode,
 * days per week, the days and their slots (with the engine's next targets), progression settings, templates, the
 * AI coach and the history of plan changes.
 *
 * Edits go to a local draft; the sticky bar saves it as a new program version (the old one is archived) or discards
 * it. Viewers and the loading state see the program read-only; in synced mode editing waits for the first pull.
 * A weight hold (master plan §16) is not a program edit: it writes the exercise state at once, plus a history line.
 */
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Lang, PlannedSession, Program, Text2 } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { pick, pluralRu, t2 } from "@/lib/fitness/i18n";
import { GROUPS, exerciseById } from "@/lib/fitness/catalog.mjs";
import { GOAL_MODES, newId } from "@/lib/fitness/templates.mjs";
import { deloadWeek, weeklySets, weeklySetsTarget } from "@/lib/fitness/progression.mjs";
import { nextDayKey, planSession } from "@/lib/fitness/session.mjs";
import {
  addLegs, commitProgram, defaultProgram, isDefaultProgram, programDiff, removeLegs, setDays, setGoal, setHold,
} from "@/lib/fitness/program-edit.mjs";
import { manualAdjustmentRow } from "@/lib/fitness/advisor.mjs";
import { holdText } from "@/lib/fitness/tracker.mjs";
import { useFitness } from "../Provider";
import { AdvisorPanel, PlanHistory } from "./AdvisorPanel";
import { DayCard } from "./DayCard";
import { DaysSwitch } from "./DaysSwitch";
import { ModeSwitch } from "./ModeSwitch";
import { ProgressionSettings } from "./ProgressionSettings";
import type { Edit } from "./SlotRow";
import { PlanConstructor } from "./PlanConstructor";
import { TemplatePicker } from "./TemplatePicker";
import { ActionIcon } from "../ActionIcon";

const EPOCH = "1970-01-01T00:00:00.000Z";

/* ------------------------------------------------------------------ clock (null during the server render) */

const subscribeMinute = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
};
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverNow = () => null;
const useClock = (): number | null => useSyncExternalStore(subscribeMinute, minuteNow, serverNow);

/* ------------------------------------------------------------------ the editor */

type Draft = { base: Program; program: Program };

function Volume({ lang, program }: { lang: Lang; program: Program }) {
  const sets = useMemo(() => weeklySets(program), [program]);
  const band = weeklySetsTarget(program.goal);
  const groups = GROUPS.filter((g: { id: string }) => (sets[g.id] ?? 0) > 0);
  if (!groups.length) return null;
  return (
    <details className="fpr-details">
      <summary>{pick(lang, "Weekly sets per muscle", "Подходов на мышцу в неделю")}</summary>
      <table className="fpr-table fpr-volume">
        <tbody>
          {groups.map((g: { id: string; name: { en: string; ru: string } }) => {
            const n = sets[g.id];
            const tone = n > band.max ? "high" : n < band.start ? "low" : "ok";
            return (
              <tr key={g.id} className={tone}>
                <th scope="row">{t2(lang, g.name)}</th>
                <td className="fit-num">{n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="fit-muted fpr-small">
        {pick(
          lang,
          `Direct work counts 1 set, helper muscles ½. This goal aims at ${band.start}–${band.max} a week per muscle (${band.target} as the block goes on).`,
          `Прямая работа — 1 подход, мышцы-помощники — ½. Цель режима: ${band.start}–${band.max} в неделю на мышцу (к концу блока ${band.target}).`,
        )}
      </p>
    </details>
  );
}

export function ProgramEditor({ lang }: { lang: Lang }) {
  const { snapshot, store, mode, canWrite } = useFitness();
  const now = useClock();
  const settings = snapshot.settings;
  const goalSetting = settings?.goal;
  const daysSetting = settings?.daysPerWeek;
  const fallback = useMemo(() => defaultProgram(goalSetting, daysSetting), [goalSetting, daysSetting]);
  const active = snapshot.activeProgramId ? snapshot.programs[snapshot.activeProgramId] : undefined;
  const saved = active && Array.isArray(active.days) && active.days.length ? active : fallback;
  const isSaved = saved !== fallback;
  // synced: never replace the real program with a default before the first pull has landed
  const settled = mode === "local" || (mode === "synced" && (isSaved || snapshot.syncedAt != null));
  const editable = canWrite && settled;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [flash, setFlash] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const program = draft?.program ?? saved;
  const lines = useMemo(() => (draft ? programDiff(draft.base, draft.program) : []), [draft]);
  const dirty = lines.length > 0;
  const emptyDays = program.days.filter((d) => d.slots.length === 0);
  const stale = draft != null && dirty && draft.base.id !== saved.id;

  const states = snapshot.exerciseState;
  const gymId = settings?.activeGymId ?? null;
  const gym = gymId ? (snapshot.gyms[gymId] ?? null) : null;

  const plans = useMemo(() => {
    if (now == null) return null;
    const out: Record<string, PlannedSession> = {};
    // the unsaved default has no real block calendar yet: never show it as a deload week
    const fresh = isDefaultProgram(program) || program.createdAt === EPOCH;
    for (const day of program.days) {
      try {
        out[day.key] = planSession({ program, dayKey: day.key, states, gym, settings, now, deload: fresh ? false : undefined });
      } catch {
        /* one broken row must not take the page down: the day shows without targets */
      }
    }
    return out;
  }, [program, states, gym, settings, now]);

  const nextKey = now == null ? null : nextDayKey(program, snapshot.sessions, now);
  const nextDay = nextKey ? program.days.find((d) => d.key === nextKey) : undefined;
  const block = now != null && !isDefaultProgram(program) && program.createdAt !== EPOCH ? deloadWeek(program, now) : null;

  const edit: Edit = (fn) => {
    if (!editable) return;
    const at = new Date().toISOString();
    setFlash("");
    setDraft((d) => {
      const base = d?.base ?? saved;
      const cur = d?.program ?? saved;
      const next = fn(cur, at);
      return next === cur ? d : { base, program: next };
    });
  };

  /** Write a program version: the new row, the archived old one, and the goal/days in settings. */
  const writeProgram = (next: Program, at: string) => {
    const { program: row, archived } = commitProgram(isSaved ? saved : null, next, at);
    store.upsert("programs", row);
    if (archived) store.upsert("programs", archived);
    if (settings) {
      store.upsert("settings", { ...settings, goal: row.goal, daysPerWeek: row.daysPerWeek, trainingPreferences: row.preferences, updatedAt: at });
    }
    return row;
  };

  const save = () => {
    if (!draft || !dirty || !editable || emptyDays.length > 0 || stale) return;
    const at = new Date().toISOString();
    const row = writeProgram(draft.program, at);
    store.upsert("adjustments", manualAdjustmentRow({ now: at, before: isSaved ? saved : null, after: row, lines: lines.map((l) => l.text) }));
    setDraft(null);
    setFlash(pick(lang, "Saved. Your next session uses this version.", "Сохранено. Следующая тренировка пойдёт по этой версии."));
  };

  /** Hold (weeks) or release (null) the weight of one exercise: its state now, and a line in the plan history. */
  const hold = (exerciseId: string, weeks: number | null) => {
    if (!editable) return;
    const at = new Date().toISOString();
    const current = store.getSnapshot().exerciseState[exerciseId];
    if (!current) return;
    const next = setHold(current, weeks, at);
    if (next === current) return;
    store.upsert("exercise_state", next);
    const name = exerciseById(exerciseId)?.name ?? { en: exerciseId, ru: exerciseId };
    const line: Text2 = next.holdUntil
      ? { en: `${name.en}: ${holdText(next.holdUntil, "en")}`, ru: `${name.ru || name.en}: ${holdText(next.holdUntil, "ru")}` }
      : { en: `${name.en}: weight hold cleared`, ru: `${name.ru || name.en}: фиксация веса снята` };
    store.upsert("adjustments", {
      id: newId(),
      at,
      source: "manual",
      input: { kind: "hold", exerciseId, weeks, holdUntil: next.holdUntil ?? null },
      output: { lines: [line] },
      applied: true,
      updatedAt: at,
    });
    setFlash(t2(lang, line));
  };

  const goal = GOAL_MODES[program.goal] ?? GOAL_MODES.recomp;
  const nextPlan = nextKey ? plans?.[nextKey] : undefined;

  return (
    <div className="fpr">
      <section
        className="fit-card fpr-summary"
        aria-labelledby="fpr-summary-h"
        data-testid="program-summary"
        data-program-id={program.id}
        data-version={program.version}
        data-saved={isSaved && !dirty}
        data-editable={editable}
      >
        <p className="fpr-eyebrow">{dirty ? pick(lang, "Unsaved draft", "Несохранённый черновик") : isSaved ? pick(lang, "Saved program", "Сохранённая программа") : editable ? pick(lang, "Starting program", "Стартовая программа") : pick(lang, "Example program", "Пример программы")}</p>
        <h2 id="fpr-summary-h" className="fpr-title">
          {t2(lang, program.name)}
        </h2>
        <p className="fpr-summary-meta">{t2(lang, goal.name)}</p>
        {nextDay ? (
          <p className="fpr-next">
            {!isSaved && !editable ? pick(lang, "First example day", "Первый день примера") : pick(lang, "Next workout", "Следующая тренировка")}: <strong>{t2(lang, nextDay.name, nextDay.key)}</strong>
            {nextPlan ? <span className="fit-num"> · ≈ {nextPlan.estimatedMinutes} {pick(lang, "min", "мин")}</span> : null}
            {" · "}
            <Link prefetch={false} href={localPath(lang, "/fitness/train")}>
              {pick(lang, "Train", "К тренировке")}
            </Link>
          </p>
        ) : null}
        {block?.due ? (
          <p className="fit-note editing">
            {pick(lang, "This is a deload week: fewer sets at your usual weights, more reps in reserve.", "Это разгрузочная неделя: меньше подходов с обычными весами и больший запас повторений.")}
          </p>
        ) : null}
        {!isSaved && editable ? (
          <p className="fit-muted fpr-small">
            {pick(lang, "This is your starting program. It is saved with your first change (or your first workout).", "Это стартовая программа. Она сохранится с первой правкой (или первой тренировкой).")}
          </p>
        ) : null}
        {canWrite && !settled ? (
          <p className="fit-note" data-testid="program-loading">{pick(lang, "Loading your program from your account…", "Загружаем программу из аккаунта…")}</p>
        ) : null}
      </section>
      <button type="button" className="fit-button quiet fpr-settings-toggle" data-testid="program-settings-toggle" aria-expanded={showSettings} aria-controls="fpr-settings" onClick={() => setShowSettings(!showSettings)}><ActionIcon name="edit" />{showSettings ? pick(lang, "Close plan settings", "Закрыть настройки плана") : pick(lang, "Plan settings", "Настройки плана")}</button>
      {emptyDays.length ? <p className="fit-note warn" role="status" data-testid="empty-plan-days">{pick(lang, `Add an exercise to each empty day before saving: ${emptyDays.map((d) => d.key).join(", ")}.`, `Добавьте упражнение в каждый пустой день перед сохранением: ${emptyDays.map((d) => d.key).join(", ")}.`)}</p> : null}
      <div className="fpr-workspace">
      <div className="fpr-settings" id="fpr-settings" data-open={showSettings}>
      <ModeSwitch lang={lang} goal={program.goal} editable={editable} onGoal={(g) => edit((p, at) => setGoal(p, g, states, at).program)} />
      <PlanConstructor lang={lang} program={program} editable={editable} onEdit={edit} />
      <DaysSwitch
        lang={lang}
        program={program}
        editable={editable}
        onDays={(n) => edit((p, at) => setDays(p, n, at))}
        onLegs={(as) => edit((p, at) => (as ? addLegs(p, at, { as }) : removeLegs(p, at)))}
      />
      <Volume lang={lang} program={program} />
      </div>
      <div className="fpr-days-list">
        {program.days.map((day) => (
          <DayCard
            key={day.key}
            lang={lang}
            program={program}
            day={day}
            plan={plans?.[day.key]}
            gym={gym}
            editable={editable}
            onEdit={edit}
            states={states}
            now={now}
            onHold={hold}
          />
        ))}
      </div>
      </div>

      <ProgressionSettings lang={lang} program={program} states={states} now={now} editable={editable} onEdit={edit} />
      <TemplatePicker lang={lang} goal={program.goal} current={program.templateId} editable={editable} onEdit={edit} />

      {editable ? (
        <AdvisorPanel
          lang={lang}
          program={saved}
          store={store}
          canWrite={canWrite}
          dirty={dirty}
          states={states}
          sessions={snapshot.sessions}
          sets={snapshot.sets}
          settings={settings}
          bodyweight={snapshot.bodyweight}
          adjustments={snapshot.adjustments}
          gym={gym}
          onProgram={(next, at) => {
            const row = writeProgram(next, at);
            setDraft(null);
            return row;
          }}
        />
      ) : null}
      <PlanHistory lang={lang} adjustments={snapshot.adjustments} />

      {flash && !dirty ? (
        <p className="fit-note editing fpr-flash" role="status" data-testid="program-saved">
          {flash}
        </p>
      ) : null}
      {dirty ? (
        <div className="fpr-savebar" role="region" aria-label={pick(lang, "Unsaved changes", "Несохранённые изменения")}>
          <details className="fpr-details fpr-savebar-lines">
            <summary>
              <strong className="fit-num">
                {lines.length} {lang === "ru" ? pluralRu(lines.length, ["изменение", "изменения", "изменений"]) : lines.length === 1 ? "change" : "changes"}
              </strong>
              {stale ? <span className="fpr-small"> · {pick(lang, "the program changed elsewhere meanwhile", "программа тем временем изменилась в другом месте")}</span> : null}
            </summary>
            <ul>
              {lines.map((l, i) => (
                <li key={i}>{t2(lang, l.text)}</li>
              ))}
            </ul>
          </details>
          <div className="fpr-savebar-actions">
            <button type="button" className="fit-button ghost" data-testid="program-discard" onClick={() => setDraft(null)}>
              {pick(lang, "Discard", "Отменить")}
            </button>
            <button type="button" className="fit-button" data-testid="program-save" disabled={emptyDays.length > 0 || stale} onClick={save}>
              {pick(lang, "Save", "Сохранить")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
