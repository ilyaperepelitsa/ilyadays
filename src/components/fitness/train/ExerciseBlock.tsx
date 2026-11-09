/**
 * An exercise card, or a superset pair whose working rows alternate (A3·1, A4·1, A3·2 …), on the session screen
 * (stream 04). In a superset each exercise is still its own `exercise-card` element (display: contents + CSS order),
 * so its rows stay inside it for tests and screen readers while the eye reads them interleaved.
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Gym, Lang } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { pick, t2 } from "@/lib/fitness/i18n";
import { exerciseById } from "@/lib/fitness/catalog.mjs";
import {
  exerciseName, holdText, muscleTags, noteHasHold, stepsFor, techniqueOf, type BlockModel, type ExerciseModel, type Row,
} from "@/lib/fitness/tracker.mjs";
import { SetRow, type Draft, type RowActions } from "./SetRow";

export type BlockActions = RowActions & {
  skip: (slotId: string, skip: boolean) => void;
  addSet: (slotId: string) => void;
  openSwap: (slotId: string) => void;
  toggleWarmups: (slotId: string, open: boolean) => void;
  toggleTechnique: (slotId: string) => void;
};

export type BlockView = {
  currentKey: string | null;
  drafts: Record<string, Draft>;
  openRows: Record<string, boolean>;
  warmOpen: Record<string, boolean>;
  techOpen: Record<string, boolean>;
  firstSlotId: string | null;
  readOnly: boolean;
  gym: Gym | null;
  /** A set was logged a moment ago: the current set's Done waits (double-tap shield, SessionTracker) */
  arming: boolean;
  /** Weight holds (ExerciseState.holdUntil) of today's exercises, by exercise id */
  holds: Record<string, string>;
};

export function ExerciseBlock({ lang, block, view, actions }: { lang: Lang; block: BlockModel; view: BlockView; actions: BlockActions }) {
  if (!block.superset) return <ExerciseCard lang={lang} e={block.exercises[0]} idx={0} inSuperset={false} view={view} actions={actions} />;
  const slots = block.exercises.map((e) => e.planned.slotId).join(" + ");
  const rest = Math.max(...block.exercises.map((e) => e.planned.restSec));
  return (
    <section className="trk-superset" aria-label={pick(lang, `Superset ${slots}`, `Суперсет ${slots}`)}>
      <p className="trk-ss-label" style={{ order: -1 }}>
        <strong>{pick(lang, "Superset", "Суперсет")}</strong>{" "}
        {pick(lang, `· alternate ${slots}, about ${rest} s rest after each set`, `· чередуйте ${slots}, отдых около ${rest} с после каждого подхода`)}
      </p>
      {block.exercises.map((e, i) => (
        <ExerciseCard key={e.planned.slotId} lang={lang} e={e} idx={i} inSuperset view={view} actions={actions} />
      ))}
    </section>
  );
}

function rowLabel(lang: Lang, row: Row, slotId: string, inSuperset: boolean, warmIndex: number) {
  const base = row.history ? "·" : row.kind === "warmup" ? `${pick(lang, "W", "Р")}${warmIndex + 1}` : row.added ? "+" : String(row.round + 1);
  return inSuperset && !row.history ? `${slotId}·${base}` : base;
}

function ExerciseCard({ lang, e, idx, inSuperset, view, actions }: {
  lang: Lang;
  e: ExerciseModel;
  idx: number;
  inSuperset: boolean;
  view: BlockView;
  actions: BlockActions;
}) {
  const p = e.planned;
  const exercise = exerciseById(p.exerciseId);
  const steps = stepsFor(exercise, view.gym);
  const name = exerciseName(p.exerciseId, lang);
  const tags = muscleTags(p.exerciseId, lang);
  const swapped = p.exerciseId !== p.programExerciseId;
  const order = (n: number): CSSProperties | undefined => (inSuperset ? { order: n } : undefined);
  const warmOpen = view.warmOpen[p.slotId] ?? (p.slotId === view.firstSlotId || e.warmups.some((r) => r.key === view.currentKey));
  const techOpen = Boolean(view.techOpen[p.slotId]);
  const plannedWork = p.sets.filter((s) => s.kind !== "warmup").length;
  const doneWork = e.working.filter((r) => r.logged).length + e.history.filter((r) => r.kind !== "warmup").length;
  const warmDone = e.warmups.filter((r) => r.logged).length;
  const isOpen = (row: Row) => view.openRows[row.key] ?? row.key === view.currentKey;
  const row = (r: Row, label: string, style?: CSSProperties) => (
    <SetRow
      key={r.key}
      lang={lang}
      row={r}
      exercise={r.history ? exerciseById(r.exerciseId) : exercise}
      label={label}
      steps={steps}
      current={r.key === view.currentKey}
      arming={view.arming && r.key === view.currentKey}
      open={isOpen(r)}
      draft={view.drafts[r.key]}
      readOnly={view.readOnly}
      actions={actions}
      style={style}
    />
  );
  const tech = techOpen ? techniqueOf(p.exerciseId) : null;
  const hold = view.holds[p.exerciseId] ?? null;

  return (
    <article
      className={`trk-card${inSuperset ? " in-superset" : ""}${e.skipped ? " is-skipped" : ""}`}
      data-testid="exercise-card"
      data-exercise-id={p.exerciseId}
      data-slot-id={p.slotId}
      data-slot-exercise-id={p.programExerciseId}
      data-hold-until={hold ?? undefined}
    >
      <header className="trk-card-head" style={order(idx)}>
        <div className="trk-card-title">
          <span className="trk-slot fit-num">{p.slotId}</span>
          <h3>
            <Link prefetch={false} href={localPath(lang, `/fitness/exercises/${p.exerciseId}`)}>{name}</Link>
          </h3>
          <span className="trk-count fit-num" aria-label={pick(lang, `${doneWork} of ${plannedWork} working sets`, `${doneWork} из ${plannedWork} рабочих подходов`)}>
            {doneWork}/{plannedWork}
          </span>
        </div>
        {swapped ? (
          <p className="trk-swapped">{pick(lang, `Instead of ${exerciseName(p.programExerciseId, lang)}`, `Вместо: ${exerciseName(p.programExerciseId, lang)}`)}</p>
        ) : null}
        {tags.primary.length ? (
          <p className="trk-tags">
            {tags.primary.map((t) => <span key={t} className="trk-tag">{t}</span>)}
            {tags.secondary.map((t) => <span key={t} className="trk-tag soft">{t}</span>)}
          </p>
        ) : null}
        {p.calibration ? <details className="fit-note" data-testid="baseline-guide" open={doneWork === 0}>
          <summary>{pick(lang, "Find your starting load", "Подберите стартовый вес")}</summary>
          <p>{pick(lang, "Calibrate each exercise separately. The suggested weight is a starting estimate, not a strength test. Warm up light, then adjust the weight before logging your first working set.", "Подбирайте вес отдельно для каждого упражнения. Предложенный вес — ориентир, а не тест силы. Начните с лёгкой разминки, затем измените вес перед записью первого рабочего подхода.")}</p>
          <p>{pick(lang, "Aim for the bottom of the rep range with about 2–3 clean reps left. Too easy? Move up one small step after resting. Too hard? Move down. No maximum attempt is needed. Record actual reps and your reps-in-reserve estimate on the working sets.", "Ориентир — нижняя граница диапазона с запасом примерно 2–3 повторения с хорошей техникой. Слишком легко? После отдыха добавьте небольшой шаг. Тяжело? Уменьшите вес. Максимальная попытка не нужна. Записывайте фактические повторения и запас в рабочих подходах.")}</p>
          <p>{pick(lang, "The baseline stays provisional until you complete the planned work with repeated sets at one load and report your effort. It can take more than one visit.", "База остаётся предварительной, пока вы не выполните план с повторными подходами на одном весе и не укажете запас. На это может уйти несколько посещений.")}</p>
          <Link prefetch={false} href={localPath(lang, "/fitness/science")}>{pick(lang, "Evidence and how progression works →", "Исследования и правила прогрессии →")}</Link>
        </details> : null}
        {p.note ? <p className="trk-note">{t2(lang, p.note)}</p> : null}
        {hold && !noteHasHold(p.note, hold, lang) ? <p className="trk-note trk-hold">{holdText(hold, lang)}</p> : null}
        {e.skipped ? <p className="trk-note">{pick(lang, "Skipped today: the targets stay as they are.", "Пропущено сегодня: цели не меняются.")}</p> : null}
        <div className="trk-actions">
          <button type="button" className="trk-act" aria-expanded={techOpen} onClick={() => actions.toggleTechnique(p.slotId)}>
            {pick(lang, "Technique", "Техника")}
          </button>
          {!view.readOnly ? (
            <>
              <button type="button" className="trk-act" data-testid="swap-open" onClick={() => actions.openSwap(p.slotId)}>
                ⇄ {pick(lang, "Swap", "Замена")}
              </button>
              <button type="button" className="trk-act" aria-pressed={e.skipped} onClick={() => actions.skip(p.slotId, !e.skipped)}>
                {e.skipped ? pick(lang, "Unskip", "Вернуть") : pick(lang, "Skip", "Пропустить")}
              </button>
              {!e.skipped ? (
                <button type="button" className="trk-act" onClick={() => actions.addSet(p.slotId)}>
                  + {pick(lang, "Set", "Подход")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {tech ? (
          <div className="trk-tech">
            {tech.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- static webp with a ?v= hash, like the rest of the site */}
                <img src={tech.image.src} alt={t2(lang, tech.image.alt)} width={1200} height={800} loading="lazy" decoding="async" />
                <p className="trk-tech-note fit-muted">{pick(lang, "Generated illustration — follow the cues.", "Сгенерированная иллюстрация — ориентируйтесь на подсказки.")}</p>
              </>
            ) : null}
            {tech.cues.en.length ? (
              <ol className="trk-cues">
                {(lang === "ru" && tech.cues.ru.length ? tech.cues.ru : tech.cues.en).map((c) => <li key={c}>{c}</li>)}
              </ol>
            ) : (
              <p className="fit-muted">{pick(lang, "No technique notes for this exercise yet.", "Для этого упражнения пока нет подсказок по технике.")}</p>
            )}
            <Link prefetch={false} className="trk-more" href={localPath(lang, `/fitness/exercises/${p.exerciseId}`)}>
              {pick(lang, "Setup, all cues and common mistakes →", "Настройка, все подсказки и частые ошибки →")}
            </Link>
          </div>
        ) : null}
      </header>
      {e.history.length ? (
        <div className="trk-group" style={order(20 + idx)}>
          <p className="trk-group-label">{pick(lang, `Before the swap: ${exerciseName(e.history[0].exerciseId, lang)}`, `До замены: ${exerciseName(e.history[0].exerciseId, lang)}`)}</p>
          {e.history.map((r) => row(r, rowLabel(lang, r, p.slotId, inSuperset, 0)))}
        </div>
      ) : null}
      {e.warmups.length ? (
        <div className="trk-group" style={order(40 + idx)}>
          <button type="button" className="trk-warm-toggle" aria-expanded={warmOpen} onClick={() => actions.toggleWarmups(p.slotId, !warmOpen)}>
            <span>
              {inSuperset ? `${p.slotId} · ` : ""}
              {pick(lang, "Warm-up sets", "Разминочные подходы")}{" "}
              <span className="fit-num">({warmDone ? `${warmDone}/${e.warmups.length}` : e.warmups.length})</span>
            </span>
            <span aria-hidden="true">{warmOpen ? "▾" : "▸"}</span>
          </button>
          {warmOpen ? e.warmups.map((r, i) => row(r, rowLabel(lang, r, p.slotId, inSuperset, i))) : null}
        </div>
      ) : null}
      {e.working.map((r) => row(r, rowLabel(lang, r, p.slotId, inSuperset, 0), order(100 + r.round * 10 + idx)))}
    </article>
  );
}
