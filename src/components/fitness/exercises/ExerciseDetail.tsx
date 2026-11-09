/**
 * One exercise page body (stream 02, plans/fitness/02-exercise-catalog-and-alternatives.md). Server component: the
 * pictures, muscle map, setup, cues, mistakes, warm-up example, facts and sources are static HTML; program status,
 * gym marks on the alternatives and the personal history are small client islands (ExerciseLive.tsx).
 * Never import this from a client component: it pulls the whole catalog and the progression engine.
 */
import Link from "next/link";
import { localPath } from "@/lib/i18n";
import type { Exercise, Lang, SetPrescription } from "@/lib/fitness/types";
import { fmtKg, kgLabel, pick, t2 } from "@/lib/fitness/i18n";
import {
  OWNER_TEMPLATE, equipmentLabel, exerciseById, exerciseClassLabel, machineImage, muscleNames, patternLabel, repRangeLabel,
} from "@/lib/fitness/catalog.mjs";
import { startingLoad, warmupRamp } from "@/lib/fitness/progression.mjs";
import { RULES, WARMUP } from "@/lib/fitness/templates.mjs";
import { MuscleMap } from "./MuscleMap";
import { AlternativesList, ExerciseHistory, ProgramStatus, type AltItem } from "./ExerciseLive";
import type { TemplateDays } from "./useActive";

const TEMPLATE = OWNER_TEMPLATE.days as unknown as TemplateDays;

const DIFFICULTY: Record<number, [string, string]> = {
  1: ["Beginner-friendly", "Для новичков"],
  2: ["Needs some technique", "Нужна техника"],
  3: ["Technical", "Сложная техника"],
};
const BACK_LOAD: Record<string, [string, string]> = {
  low: ["Low", "Низкая"],
  moderate: ["Moderate", "Умеренная"],
  high: ["High", "Высокая"],
};

/** "Title — outlet, year. https://…" → text with the URL as a link. */
function Source({ text }: { text: string }) {
  const match = text.match(/https?:\/\/\S+/);
  if (!match || match.index === undefined) return <>{text}</>;
  const url = match[0].replace(/[).,;]+$/, "");
  const before = text.slice(0, match.index).trim();
  return (
    <>
      {before}{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" className="fx-url">
        {url.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
    </>
  );
}

function caption(lang: Lang, angle: string) {
  if (angle === "sequence") return pick(lang, "Start → end: the arrow shows the working path.", "Начало → конец: стрелка показывает рабочую траекторию.");
  if (angle === "side") return pick(lang, "Side view at the hardest point of the rep.", "Вид сбоку в самой тяжёлой точке повтора.");
  return angle;
}

function WarmupExample({ lang, ex }: { lang: Lang; ex: Exercise }) {
  const bodyweightKg = RULES.bodyweightRefKg;
  const working = startingLoad(ex, { bodyweightKg });
  const ramp: SetPrescription[] = warmupRamp(working, ex, null, { bodyweightKg, targetReps: ex.repRange[0], rir: 2 });
  const unit = ex.repUnit ?? "reps";
  const assisted = ex.assistance === true || ex.equipment === "assisted";
  const kg = (v: number) => `${fmtKg(v, lang)} ${kgLabel(lang)}${assisted ? pick(lang, " assistance", " помощи") : ""}`;
  const general = t2(lang, WARMUP.general);
  if (!ramp.length) {
    const why =
      unit !== "reps" || ex.equipment === "bodyweight" || ex.equipment === "band"
        ? pick(lang, "No ramp sets: make the first set a little easier and build into it.", "Без разминочных подходов: сделайте первый подход чуть легче и войдите в ритм.")
        : pick(lang, "No ramp sets at a light working load: the first working set is the warm-up for this muscle.", "При лёгком рабочем весе разминочные подходы не нужны: первый рабочий подход и есть разминка.");
    return (
      <>
        <p>{why}</p>
        <p className="fx-small fit-muted">{general}</p>
      </>
    );
  }
  return (
    <>
      <div className="fx-table-wrap">
        <table className="fx-table">
          <thead>
            <tr>
              <th scope="col">{pick(lang, "Set", "Подход")}</th>
              <th scope="col">{pick(lang, "Load", "Вес")}</th>
              <th scope="col">{pick(lang, "Reps", "Повторы")}</th>
            </tr>
          </thead>
          <tbody>
            {ramp.map((s, i) => (
              <tr key={i}>
                <td>{pick(lang, `Warm-up ${i + 1}`, `Разминка ${i + 1}`)}</td>
                <td className="fit-num">{kg(s.weightKg)}</td>
                <td className="fit-num">{s.reps}</td>
              </tr>
            ))}
            <tr className="fx-working">
              <td>{pick(lang, "Working sets", "Рабочие подходы")}</td>
              <td className="fit-num">{kg(working)}</td>
              <td className="fit-num">{repRangeLabel(ex.repRange, unit, lang)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="fx-small fit-muted">
        {pick(
          lang,
          `Example for the planner's first working load (${kg(working)}, an ${bodyweightKg} kg beginner). The train page builds the same ramp from your own working weight. Before it: ${general}`,
          `Пример для стартового рабочего веса планировщика (${kg(working)}, новичок ${bodyweightKg} кг). На странице тренировки разминка считается от вашего рабочего веса. Перед ней: ${general}`,
        )}
      </p>
    </>
  );
}

export function ExerciseDetail({ lang, ex }: { lang: Lang; ex: Exercise }) {
  const names = muscleNames(lang);
  const images = ex.images ?? [];
  const machine = machineImage(ex.id);
  const unit = ex.repUnit ?? "reps";
  const alternatives: AltItem[] = ex.alternatives
    .map((id) => exerciseById(id))
    .filter((alt): alt is Exercise => Boolean(alt))
    .map((alt) => ({ id: alt.id, name: t2(lang, alt.name), className: exerciseClassLabel(alt.id, lang), equipment: equipmentLabel(alt.equipment, lang) }));
  const facts = { id: ex.id, equipment: ex.equipment, assistance: ex.assistance, repUnit: ex.repUnit };
  const list = (ids: string[]) => ids.map((id) => names[id] ?? id).join(", ");
  const map = (
    <section className="fit-card fx-section fx-muscles" aria-labelledby="fx-muscles">
      <h2 id="fx-muscles">{pick(lang, "Muscles", "Мышцы")}</h2>
      <MuscleMap primary={ex.primary} secondary={ex.secondary} lang={lang} names={names} />
      <ul className="fx-legend">
        <li>
          <span className="fx-swatch primary" aria-hidden="true" /> <strong>{pick(lang, "Main:", "Основные:")}</strong> {list(ex.primary)}
        </li>
        {ex.secondary.length ? (
          <li>
            <span className="fx-swatch secondary" aria-hidden="true" /> <strong>{pick(lang, "Helping:", "Помогают:")}</strong> {list(ex.secondary)}
          </li>
        ) : null}
      </ul>
    </section>
  );

  return (
    <div className="fx-detail">
      <p className="fx-back">
        <Link prefetch={false} href={localPath(lang, "/fitness/exercises")}>
          {pick(lang, "← All exercises", "← Все упражнения")}
        </Link>
      </p>
      <ul className="fx-facts-line" aria-label={pick(lang, "Key facts", "Главное")}>
        <li>{equipmentLabel(ex.equipment, lang)}</li>
        <li>{patternLabel(ex.pattern, lang)}</li>
        <li className="fit-num">{repRangeLabel(ex.repRange, unit, lang)}</li>
        <li>{pick(lang, ...DIFFICULTY[ex.difficulty])}</li>
      </ul>
      <ProgramStatus lang={lang} exerciseId={ex.id} template={TEMPLATE} alternatives={alternatives} />

      <div className="fx-columns">
        <div className="fx-col">
          {images.length ? (
            <section className="fx-figures" aria-label={pick(lang, "Technique pictures", "Схемы техники")}>
              {images.map((img, i) => (
                <figure key={img.angle} className="fx-figure">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static webp with a ?v= hash */}
                  <img src={img.src} alt={t2(lang, img.alt)} width={1200} height={800} loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : undefined} decoding="async" />
                  <figcaption>{caption(lang, img.angle)}</figcaption>
                </figure>
              ))}
              <p className="fx-small fit-muted">{pick(lang, "Generated illustration — follow the cues.", "Сгенерированная иллюстрация — ориентируйтесь на подсказки.")}</p>
            </section>
          ) : (
            map
          )}

          <section className="fit-card fx-section" aria-labelledby="fx-setup">
            <h2 id="fx-setup">{pick(lang, "Setup", "Настройка")}</h2>
            <p>{t2(lang, ex.setup)}</p>
            {machine ? (
              <figure className="fx-figure fx-machine">
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static webp with a ?v= hash */}
                <img src={machine.src} alt={t2(lang, machine.alt)} width={1200} height={800} loading="lazy" decoding="async" />
                <figcaption>{pick(lang, "The machine, set up for this exercise.", "Тренажёр, настроенный для этого упражнения.")}</figcaption>
              </figure>
            ) : null}
          </section>

          <section className="fit-card fx-section" aria-labelledby="fx-cues">
            <h2 id="fx-cues">{pick(lang, "Cues", "Подсказки")}</h2>
            <ol className="fx-cues">
              {(lang === "ru" ? ex.cues.ru : ex.cues.en).map((cue, i) => (
                <li key={i}>{cue}</li>
              ))}
            </ol>
          </section>

          <section className="fit-card fx-section" aria-labelledby="fx-mistakes">
            <h2 id="fx-mistakes">{pick(lang, "Common mistakes", "Частые ошибки")}</h2>
            <ul className="fx-mistakes">
              {(lang === "ru" ? ex.mistakes.ru : ex.mistakes.en).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="fx-col">
          {images.length ? map : null}

          <section className="fit-card fx-section" aria-labelledby="fx-alternatives">
            <h2 id="fx-alternatives">{pick(lang, "Alternatives", "Замены")}</h2>
            <p className="fx-small fit-muted">{pick(lang, "Machine busy or missing? Closest first.", "Тренажёр занят или его нет? Самые близкие — первыми.")}</p>
            <AlternativesList lang={lang} exerciseId={ex.id} items={alternatives} />
          </section>

          <section className="fit-card fx-section" aria-labelledby="fx-warmup">
            <h2 id="fx-warmup">{pick(lang, "Warm-up", "Разминка")}</h2>
            <WarmupExample lang={lang} ex={ex} />
          </section>

          <ExerciseHistory lang={lang} exercise={facts} />

          <section className="fit-card fx-section" aria-labelledby="fx-facts">
            <h2 id="fx-facts">{pick(lang, "Facts", "Характеристики")}</h2>
            <dl className="fit-kv">
              <dt>{pick(lang, "Equipment", "Снаряд")}</dt>
              <dd>{equipmentLabel(ex.equipment, lang)}</dd>
              <dt>{pick(lang, "Movement", "Движение")}</dt>
              <dd>{patternLabel(ex.pattern, lang)}</dd>
              <dt>{pick(lang, "Swap group", "Группа замен")}</dt>
              <dd>{exerciseClassLabel(ex.id, lang)}</dd>
              <dt>{pick(lang, "Load step", "Шаг веса")}</dt>
              <dd className="fit-num">{ex.increment > 0 ? `${fmtKg(ex.increment, lang)} ${kgLabel(lang)}` : pick(lang, "bodyweight", "свой вес")}</dd>
              <dt>{pick(lang, "Rep range", "Диапазон")}</dt>
              <dd className="fit-num">{repRangeLabel(ex.repRange, unit, lang)}</dd>
              <dt>{pick(lang, "Difficulty", "Сложность")}</dt>
              <dd>{pick(lang, ...DIFFICULTY[ex.difficulty])}</dd>
              <dt>{pick(lang, "Support", "Опора")}</dt>
              <dd>{ex.supported ? pick(lang, "Seat or pad supports the torso", "Сиденье или упор держат корпус") : pick(lang, "You stabilise yourself", "Корпус держите сами")}</dd>
              {ex.lowerBackLoad ? (
                <>
                  <dt>{pick(lang, "Lower-back load", "Нагрузка на поясницу")}</dt>
                  <dd>{pick(lang, ...BACK_LOAD[ex.lowerBackLoad])}</dd>
                </>
              ) : null}
              {ex.unilateral ? (
                <>
                  <dt>{pick(lang, "Sides", "Стороны")}</dt>
                  <dd>{pick(lang, "One side at a time", "По одной стороне")}</dd>
                </>
              ) : null}
              {ex.lengthenedBias ? (
                <>
                  <dt>{pick(lang, "Stretch", "Растяжение")}</dt>
                  <dd>{pick(lang, "Hardest where the muscle is long", "Тяжелее всего в растянутом положении мышцы")}</dd>
                </>
              ) : null}
              {ex.assistance || ex.equipment === "assisted" ? (
                <>
                  <dt>{pick(lang, "Load", "Вес")}</dt>
                  <dd>{pick(lang, "Counterweight: less assistance is harder", "Противовес: чем меньше помощь, тем тяжелее")}</dd>
                </>
              ) : null}
              {ex.startLoad && ex.startLoad.kg > 0 ? (
                <>
                  <dt>{pick(lang, "Typical start", "Типичный старт")}</dt>
                  <dd className="fit-num" title={ex.startLoad.source}>
                    {fmtKg(ex.startLoad.kg, lang)} {kgLabel(lang)}
                    <span className="fit-muted">{pick(lang, " (untrained 80 kg man)", " (нетренированный мужчина 80 кг)")}</span>
                  </dd>
                </>
              ) : null}
            </dl>
            {ex.aka?.length ? (
              <p className="fx-small fit-muted">
                {pick(lang, "Also called: ", "Другие названия: ")}
                {ex.aka.join(" · ")}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      {ex.sources?.length ? (
        <section className="fx-section fx-sources" aria-labelledby="fx-sources">
          <h2 id="fx-sources">{pick(lang, "Sources", "Источники")}</h2>
          <ol>
            {ex.sources.map((s, i) => (
              <li key={i}>
                <Source text={s} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
