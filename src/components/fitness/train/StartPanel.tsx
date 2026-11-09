/**
 * Before a session (stream 04): the next day in the rotation (or another day), its exercises with today's targets and
 * minutes, the gym (saved as settings.activeGymId), an optional readiness check, today's body weight (a changed value
 * is saved as a weigh-in), the warm-up and pain rules, and the Start button in the thumb zone. Viewers see the plan.
 * An exercise whose weight is held (master plan §16) says until when.
 * Test hooks: next-session (+ data-day-key), start-session, day-pick (+ data-value), auto-closed (+ data-session-id).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lang, Program, Readiness } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { fmtDate, fmtTime, pick, t2 } from "@/lib/fitness/i18n";
import { exerciseById } from "@/lib/fitness/catalog.mjs";
import {
  autoClosedNotice, blocksOf, bodyweightRow, dayOf, exerciseName, focusText, holdOf, holdText, latestBodyweight, nextAfter,
  prescriptionText, safetyInfo, startSession, validBodyweight,
} from "@/lib/fitness/tracker.mjs";
import { useFitness } from "../Provider";
import { useStoreStatus } from "../ModeNote";
import { markSeen, scrollBehavior, useSeen } from "./hooks";

type Scale = "sleep" | "energy" | "soreness";
const SCALES: [Scale, string, string, string, string][] = [
  ["sleep", "Sleep", "Сон", "1 = very poor, 5 = great", "1 = очень плохо, 5 = отлично"],
  ["energy", "Energy", "Энергия", "1 = drained, 5 = full of energy", "1 = нет сил, 5 = полон сил"],
  ["soreness", "Soreness", "Крепатура", "1 = none, 5 = very sore", "1 = нет, 5 = сильная"],
];

const parseKg = (text: string) => {
  const v = Number(text.replace(",", ".").trim());
  return text.trim() && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
};

export function StartPanel({ lang, program, created, readOnly, now }: {
  lang: Lang;
  program: Program;
  /** The program is the owner template and is not saved yet (it is saved on Start) */
  created: boolean;
  readOnly: boolean;
  now: number;
}) {
  const { snapshot, store, mode } = useFitness();
  const status = useStoreStatus();
  const [dayChoice, setDayChoice] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness>({});
  const [bwText, setBwText] = useState<string | null>(null);

  const latest = latestBodyweight(snapshot);
  const defaultBw = latest?.kg ?? snapshot.settings?.bodyweightKg ?? null;
  const bwShown = bwText ?? (defaultBw != null ? String(defaultBw) : "");
  const bwKg = parseKg(bwShown);
  const bwValid = bwKg != null && validBodyweight(bwKg);

  const next = useMemo(
    () => nextAfter(snapshot, program, now, { dayKey: dayChoice, bodyweightKg: bwValid ? bwKg : null }),
    [snapshot, program, now, dayChoice, bwValid, bwKg],
  );
  const plan = next.plan;
  const day = dayOf(program, next.dayKey);
  const gyms = Object.values(snapshot.gyms).sort((a, b) => a.name.localeCompare(b.name));
  const activeGymId = snapshot.settings?.activeGymId ?? null;
  const gymId = activeGymId && snapshot.gyms[activeGymId] ? activeGymId : null;
  const notice = autoClosedNotice(snapshot, now);
  const seen = useSeen(notice?.id ?? null);
  const safety = safetyInfo();
  const waitForPull = created && mode === "synced" && Boolean(status?.syncing);

  const pickGym = (id: string | null) => {
    const settings = snapshot.settings;
    if (readOnly || !settings || settings.activeGymId === id) return;
    store.upsert("settings", { ...settings, activeGymId: id, updatedAt: new Date().toISOString() });
  };

  const rate = (scale: Scale, value: number) =>
    setReadiness((r) => {
      const next = { ...r };
      if (r[scale] === value) delete next[scale];
      else next[scale] = value as 1 | 2 | 3 | 4 | 5;
      return next;
    });

  const stepBw = (delta: number) => {
    const base = bwKg ?? defaultBw ?? 80;
    setBwText(String(Math.round((base + delta) * 10) / 10));
  };

  const start = () => {
    if (readOnly || !plan.exercises.length) return;
    const at = new Date();
    if (created) store.upsert("programs", program);
    const weighIn = bwValid ? bodyweightRow({ snapshot, kg: bwKg, now: at }) : null;
    if (weighIn) store.upsert("bodyweight", weighIn);
    const session = startSession({ program, dayKey: next.dayKey, gymId, now: at, readiness, bodyweightKg: bwValid ? bwKg : null, plan: { version: 1, program, gym: gymId ? snapshot.gyms[gymId] : null, states: snapshot.exerciseState, prescription: plan } });
    store.upsert("sessions", session);
    if (notice) markSeen(notice.id);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };

  if (!program.days.length) {
    return (
      <div className="fit-note warn" role="status">
        {pick(lang, "This program has no training days. ", "В этой программе нет тренировочных дней. ")}
        <Link prefetch={false} href={localPath(lang, "/fitness/program")}>{pick(lang, "Choose a program", "Выбрать программу")}</Link>
      </div>
    );
  }

  return (
    <div className="trk-start">
      {notice && !seen && !readOnly ? (
        <div className="fit-note warn trk-notice" role="status" data-testid="auto-closed" data-session-id={notice.id}>
          <span>
            {pick(
              lang,
              `Your session of ${fmtDate(notice.startedAt, lang)} (${fmtTime(notice.startedAt, lang)}) was closed automatically after 6 hours. The sets you logged count for next time.`,
              `Тренировка ${fmtDate(notice.startedAt, lang)} (${fmtTime(notice.startedAt, lang)}) закрылась автоматически через 6 часов. Записанные подходы учтены на следующий раз.`,
            )}
          </span>
          <button type="button" className="fit-button quiet" onClick={() => markSeen(notice.id)}>
            {pick(lang, "OK", "Понятно")}
          </button>
        </div>
      ) : null}

      <section className="fit-card trk-plan" data-testid="next-session" data-day-key={next.dayKey}>
        <p className="trk-kicker">
          {readOnly
            ? pick(lang, "Ilya's next session", "Следующая тренировка Ильи")
            : next.dayKey === next.rotationKey
              ? pick(lang, "Next in the rotation", "Следующая по очереди")
              : pick(lang, "Chosen day", "Выбранный день")}
        </p>
        <h2>{t2(lang, plan.dayName)}</h2>
        <p className="fit-muted">
          {day ? focusText(day.focus, lang) : null}
          <span className="fit-num"> · ~{plan.estimatedMinutes}{"\u00a0"}{pick(lang, "min", "мин")}</span>
        </p>
        {program.days.length > 1 && !readOnly ? (
          <div className="fit-seg trk-days" role="group" aria-label={pick(lang, "Training day", "Тренировочный день")}>
            {program.days.map((d) => (
              <button key={d.key} type="button" aria-pressed={d.key === next.dayKey} data-testid="day-pick" data-value={d.key} onClick={() => setDayChoice(d.key)} title={t2(lang, d.name)}>
                {d.key}
                {d.key === next.rotationKey ? <span className="trk-day-next">{pick(lang, " · next", " · по очереди")}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        <ol className="trk-plan-list">
          {blocksOf(plan.exercises).flatMap((b) =>
            b.items.map((p, i) => {
              const ex = exerciseById(p.exerciseId);
              const hold = holdOf(snapshot.exerciseState[p.exerciseId], now);
              return (
                <li key={p.slotId} className={b.superset ? "is-superset" : undefined}>
                  <span className="trk-slot fit-num">{p.slotId}</span>
                  <span className="trk-plan-name">
                    {exerciseName(p.exerciseId, lang)}
                    {b.superset && i > 0 ? <span className="trk-tag soft">{pick(lang, "superset", "суперсет")}</span> : null}
                  </span>
                  <span className="trk-plan-target fit-num">{prescriptionText(p, ex, lang)}</span>
                  {hold ? <span className="trk-plan-hold">{holdText(hold, lang)}</span> : null}
                </li>
              );
            }),
          )}
        </ol>
        {plan.finisher ? <p className="trk-note">{t2(lang, plan.finisher)}</p> : null}
      </section>

      {!readOnly ? (
        <section className="fit-card trk-setup" aria-label={pick(lang, "Before you start", "Перед началом")}>
          <h3>{pick(lang, "Gym", "Зал")}</h3>
          {gyms.length ? (
            <div className="fit-seg" role="group" aria-label={pick(lang, "Gym", "Зал")}>
              {gyms.map((g) => (
                <button key={g.id} type="button" aria-pressed={g.id === gymId} onClick={() => pickGym(g.id)}>
                  {g.name || pick(lang, "Unnamed gym", "Зал без названия")}
                </button>
              ))}
              <button type="button" aria-pressed={gymId == null} onClick={() => pickGym(null)}>
                {pick(lang, "Any gym", "Любой зал")}
              </button>
            </div>
          ) : (
            <p className="fit-muted">
              {pick(lang, "No gym profile yet: every machine counts as available. ", "Профиля зала пока нет: считаем, что все тренажёры есть. ")}
              <Link prefetch={false} href={localPath(lang, "/fitness/gyms")}>{pick(lang, "Set up your gym", "Настроить зал")}</Link>
            </p>
          )}

          <h3>{pick(lang, "Body weight", "Вес тела")}</h3>
          <div className="trk-bw">
            <button type="button" className="trk-step" onClick={() => stepBw(-0.1)} aria-label={pick(lang, "Body weight −0.1 kg", "Вес −0,1 кг")}>−</button>
            <label className="trk-bw-field">
              <span className="sr-only">{pick(lang, "Body weight, kg", "Вес тела, кг")}</span>
              <input
                className="fit-num"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={bwShown}
                placeholder="80"
                onChange={(e) => setBwText(e.target.value)}
                aria-invalid={bwShown !== "" && !bwValid}
              />
              <span aria-hidden="true">{pick(lang, "kg", "кг")}</span>
            </label>
            <button type="button" className="trk-step" onClick={() => stepBw(0.1)} aria-label={pick(lang, "Body weight +0.1 kg", "Вес +0,1 кг")}>+</button>
          </div>
          <p className="fit-muted trk-small">
            {latest
              ? pick(lang, `Last weigh-in ${fmtDate(latest.at, lang)}. A new value is saved when you start.`, `Последнее взвешивание ${fmtDate(latest.at, lang)}. Новое значение сохранится при старте.`)
              : pick(lang, "Used for assisted machines and saved as today's weigh-in when you start.", "Нужен для гравитрона; сохранится как взвешивание при старте.")}
          </p>

          <details className="trk-readiness">
            <summary>{pick(lang, "How do you feel? (optional)", "Как самочувствие? (необязательно)")}</summary>
            {SCALES.map(([key, en, ru, helpEn, helpRu]) => (
              <div key={key} className="trk-scale" role="group" aria-label={pick(lang, en, ru)}>
                <span className="trk-scale-label">
                  {pick(lang, en, ru)} <span className="fit-muted trk-small">{pick(lang, helpEn, helpRu)}</span>
                </span>
                <span className="trk-dots">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`trk-dot${(readiness[key] ?? 0) >= v ? " is-on" : ""}`}
                      aria-pressed={readiness[key] === v}
                      aria-label={pick(lang, `${en} ${v} of 5`, `${ru}: ${v} из 5`)}
                      onClick={() => rate(key, v)}
                    />
                  ))}
                </span>
              </div>
            ))}
          </details>
        </section>
      ) : null}

      <section className="fit-card trk-warmup">
        <h3>{pick(lang, "Warm-up", "Разминка")}</h3>
        <p>{t2(lang, safety.warmup ?? plan.warmup)}</p>
        {safety.pain.length ? (
          <details>
            <summary>{pick(lang, "If something hurts", "Если что-то болит")}</summary>
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
      </section>

      {!readOnly ? (
        <div className="trk-bar">
          <button type="button" className="fit-button trk-wide" data-testid="start-session" onClick={start} disabled={!plan.exercises.length || waitForPull}>
            {waitForPull ? pick(lang, "Loading your plan…", "Загружаем план…") : pick(lang, `Start ${t2(lang, plan.dayName)}`, `Начать: ${t2(lang, plan.dayName)}`)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
