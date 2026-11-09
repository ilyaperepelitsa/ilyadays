"use client";
/**
 * /fitness/tools calculators (master-owned): one-rep max and a load table from any set, a warm-up ramp, and plates
 * per side. Pure maths lives in src/lib/fitness/tools.mjs (the engine's e1RM definition); this file is inputs + output.
 */
import { useId, useMemo, useState } from "react";
import type { Exercise, Lang } from "@/lib/fitness/types";
import { fmtKg, kgLabel, pick, t2 } from "@/lib/fitness/i18n";
import { EXERCISES, OWNER_TEMPLATE, exerciseById } from "@/lib/fitness/catalog.mjs";
import { BARS_KG, PLATES_KG, TABLE_RIR, calculable, lastWorkingSet, loadTable, platesPerSide, warmupFor } from "@/lib/fitness/tools.mjs";
import { useFitness } from "../Provider";

const DEFAULT_EXERCISE = "machine-chest-press";

type Stepper = { label: string; value: number; step: number; min: number; max: number; unit?: string; onChange: (v: number) => void; testid: string };

function NumberStepper({ label, value, step, min, max, unit, onChange, testid }: Stepper) {
  const clampTo = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const id = useId();
  // a div with a for-label, not a wrapping <label>: a label forwards its taps to the first control inside it, the − button
  // (a tap on "Weight" lowered the weight)
  return (
    <div className="fit-calc-field">
      <label className="fit-calc-label" htmlFor={id}>{label}</label>
      <span className="fit-calc-stepper">
        <button type="button" className="fit-calc-step" aria-label={`${label} −`} data-testid={`${testid}-minus`} onClick={() => onChange(clampTo(value - step))}>−</button>
        <input
          id={id}
          className="fit-calc-input fit-num"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          data-testid={testid}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
          onBlur={() => onChange(Number.isFinite(value) ? clampTo(value) : min)}
        />
        <button type="button" className="fit-calc-step" aria-label={`${label} +`} data-testid={`${testid}-plus`} onClick={() => onChange(clampTo((Number.isFinite(value) ? value : min) + step))}>+</button>
        {unit ? <span className="fit-calc-unit">{unit}</span> : null}
      </span>
    </div>
  );
}

/** Exercise ids of the active program (else the owner template), in program order, without duplicates. */
function programIds(program: { days: { slots: { exerciseId: string }[] }[] } | null): string[] {
  const ids = program
    ? program.days.flatMap((d) => d.slots.map((s) => s.exerciseId))
    : OWNER_TEMPLATE.days.flatMap((d: { slots: string[][] }) => d.slots.map((slot) => slot[1]));
  return [...new Set(ids)];
}

export function LoadCalculator({ lang }: { lang: Lang }) {
  const { snapshot } = useFitness();
  const program = snapshot.activeProgramId ? snapshot.programs[snapshot.activeProgramId] ?? null : null;
  const gym = snapshot.settings?.activeGymId ? snapshot.gyms[snapshot.settings.activeGymId] ?? null : null;
  const weighIns = Object.values(snapshot.bodyweight).sort((a, b) => (a.at < b.at ? 1 : -1));
  const knownBodyweight = weighIns[0]?.kg ?? snapshot.settings?.bodyweightKg ?? null;

  const options = useMemo(() => {
    const all = (EXERCISES as Exercise[]).filter(calculable);
    const mine = programIds(program).map((id) => exerciseById(id) as Exercise | undefined).filter((e): e is Exercise => Boolean(e && calculable(e)));
    const mineIds = new Set(mine.map((e) => e.id));
    const rest = all.filter((e) => !mineIds.has(e.id)).sort((a, b) => t2(lang, a.name).localeCompare(t2(lang, b.name), lang));
    return { mine, rest };
  }, [program, lang]);

  const [exerciseId, setExerciseId] = useState(DEFAULT_EXERCISE);
  const exercise = (exerciseById(exerciseId) as Exercise | undefined) ?? (exerciseById(DEFAULT_EXERCISE) as Exercise);
  const step = exercise.increment > 0 ? exercise.increment : 2.5;
  const [kg, setKg] = useState<number>(exercise.startLoad?.kg ?? 40);
  const [reps, setReps] = useState(8);
  const [rir, setRir] = useState(2);
  const [bodyweightInput, setBodyweightInput] = useState<number>(knownBodyweight ?? 80);
  const bodyweightKg = knownBodyweight ?? bodyweightInput;
  const last = lastWorkingSet(Object.values(snapshot.sets), exercise.id);

  const choose = (id: string) => {
    setExerciseId(id);
    const next = exerciseById(id) as Exercise | undefined;
    const prev = lastWorkingSet(Object.values(snapshot.sets), id);
    if (prev) {
      setKg(prev.kg);
      setReps(prev.reps);
      setRir(prev.rir ?? 2);
    } else if (next) {
      setKg(next.startLoad?.kg ?? 40);
      setReps(Math.min(12, Math.max(1, next.repRange?.[0] ?? 8)));
      setRir(2);
    }
  };

  const table = loadTable({ kg, reps, rir }, { exercise, gym, bodyweightKg });
  const assisted = table.ok ? table.assisted : exercise.equipment === "assisted" || exercise.assistance === true;
  const [lo, hi] = exercise.repRange ?? [0, 0];
  const ramp = table.ok ? warmupFor(kg, exercise, { gym, bodyweightKg, e1rm: table.e1rm, targetReps: reps, rir }) : [];
  const kgWord = kgLabel(lang);

  return (
    <section className="fit-card fit-calc" aria-labelledby="calc-load">
      <h2 id="calc-load">{pick(lang, "One-rep max and loads", "Разовый максимум и веса")}</h2>
      <p className="fit-muted">
        {pick(
          lang,
          "Enter a set you did. The table shows what to load for other rep targets, rounded to this machine's step. The same formula drives your plan and your progress charts.",
          "Введите сделанный подход. Таблица показывает вес для других повторений, округлённый до шага тренажёра. Та же формула ведёт ваш план и графики прогресса.",
        )}
      </p>

      <label className="fit-calc-field">
        <span className="fit-calc-label">{pick(lang, "Exercise", "Упражнение")}</span>
        <select className="fit-calc-select" value={exercise.id} onChange={(e) => choose(e.target.value)} data-testid="calc-exercise">
          <optgroup label={pick(lang, "My program", "Моя программа")}>
            {options.mine.map((e) => <option key={e.id} value={e.id}>{t2(lang, e.name)}</option>)}
          </optgroup>
          <optgroup label={pick(lang, "All exercises", "Все упражнения")}>
            {options.rest.map((e) => <option key={e.id} value={e.id}>{t2(lang, e.name)}</option>)}
          </optgroup>
        </select>
      </label>

      {last ? (
        <button type="button" className="fit-button quiet fit-calc-last" onClick={() => { setKg(last.kg); setReps(last.reps); setRir(last.rir ?? 2); }}>
          {pick(lang, `Use my last set: ${fmtKg(last.kg, lang)} ${kgWord} × ${last.reps}`, `Мой последний подход: ${fmtKg(last.kg, lang)} ${kgWord} × ${last.reps}`)}
        </button>
      ) : null}

      <div className="fit-calc-inputs">
        <NumberStepper
          label={assisted ? pick(lang, "Assistance", "Помощь") : pick(lang, "Weight", "Вес")}
          value={kg}
          step={step}
          min={0}
          max={500}
          unit={kgWord}
          onChange={setKg}
          testid="calc-kg"
        />
        <NumberStepper label={pick(lang, "Reps", "Повторения")} value={reps} step={1} min={1} max={30} onChange={(v) => setReps(Math.round(v))} testid="calc-reps" />
        {assisted && knownBodyweight == null ? (
          <NumberStepper label={pick(lang, "Body weight", "Вес тела")} value={bodyweightInput} step={0.5} min={30} max={250} unit={kgWord} onChange={setBodyweightInput} testid="calc-bodyweight" />
        ) : null}
      </div>

      <div className="fit-calc-field">
        <span className="fit-calc-label" id="calc-rir-label">
          {pick(lang, "Reps left in the tank (RIR)", "Сколько ещё могли сделать (RIR)")}
        </span>
        <div className="fit-seg fit-calc-rir" role="group" aria-labelledby="calc-rir-label">
          {[0, 1, 2, 3, 4].map((q) => (
            <button key={q} type="button" aria-pressed={rir === q} data-value={q} onClick={() => setRir(q)}>
              {q === 0 ? pick(lang, "0 · failure", "0 · отказ") : q}
            </button>
          ))}
        </div>
      </div>

      {table.ok ? (
        <>
          <p className="fit-calc-result" data-testid="calc-e1rm" data-kg={table.e1rm}>
            <span className="fit-calc-big fit-num">≈ {fmtKg(table.e1rm, lang)} {kgWord}</span>
            <span className="fit-muted">
              {assisted
                ? pick(lang, ` one-rep max of the part you lift (body weight ${fmtKg(bodyweightKg, lang)} ${kgWord} − assistance)`, ` разовый максимум поднимаемой части (вес тела ${fmtKg(bodyweightKg, lang)} ${kgWord} − помощь)`)
                : pick(lang, " estimated one-rep max", " расчётный разовый максимум")}
            </span>
          </p>
          {!table.reliable ? (
            <p className="fit-note warn">
              {pick(lang, "More than 12 reps to failure: the estimate is rough. A heavier set of 3–10 reps gives a better one.", "Больше 12 повторений до отказа: оценка грубая. Подход потяжелее, на 3–10 повторений, даст точнее.")}
            </p>
          ) : null}
          <div className="fit-calc-scroll">
            <table className="fit-calc-table fit-num" data-testid="calc-table">
              <caption className="fit-muted">
                {assisted
                  ? pick(lang, `Assistance in ${kgWord}: less assistance is harder. Rows inside your rep range are marked.`, `Помощь, ${kgWord}: меньше помощи — тяжелее. Строки в вашем диапазоне повторений отмечены.`)
                  : pick(lang, `Load in ${kgWord}, rounded to the ${fmtKg(table.step || step, lang)} ${kgWord} step. Rows inside your rep range are marked.`, `Вес, ${kgWord}, округлён до шага ${fmtKg(table.step || step, lang)} ${kgWord}. Строки в вашем диапазоне повторений отмечены.`)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{pick(lang, "Reps · % 1RM", "Повт. · % 1ПМ")}</th>
                  {TABLE_RIR.map((q) => (
                    <th key={q} scope="col">{q === 0 ? pick(lang, "to failure", "до отказа") : `RIR ${q}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.reps} className={row.reps >= lo && row.reps <= hi ? "in-range" : undefined}>
                    <th scope="row">{row.reps}<span className="fit-calc-pct">{row.pct}%</span></th>
                    {row.cells.map((c) => (
                      <td key={c.rir} className={c.reliable ? undefined : "rough"} title={`${fmtKg(c.exactKg, lang)} ${kgWord}`}>
                        {c.unassisted ? pick(lang, "none", "без") : c.kg == null ? "—" : fmtKg(c.kg, lang)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ramp.length ? (
            <div className="fit-calc-ramp">
              <h3>{pick(lang, `Warm-up before ${fmtKg(kg, lang)} ${kgWord} × ${reps}`, `Разминка перед ${fmtKg(kg, lang)} ${kgWord} × ${reps}`)}</h3>
              <ol>
                {ramp.map((s, i) => (
                  <li key={i} className="fit-num">{fmtKg(s.weightKg, lang)} {kgWord} × {s.reps}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      ) : (
        <p className="fit-note warn" data-testid="calc-error">
          {table.reason === "bodyweight"
            ? pick(lang, "Enter your body weight: assisted machines subtract the assistance from it.", "Введите вес тела: в гравитроне помощь вычитается из него.")
            : assisted
              ? pick(lang, "The assistance has to be lighter than your body weight, with at least one rep.", "Помощь должна быть меньше веса тела, хотя бы одно повторение.")
              : pick(lang, "Enter a weight above zero and 1–30 reps.", "Введите вес больше нуля и от 1 до 30 повторений.")}
        </p>
      )}
    </section>
  );
}

export function PlateCalculator({ lang }: { lang: Lang }) {
  const [total, setTotal] = useState(60);
  const [bar, setBar] = useState(20);
  const [have, setHave] = useState<number[]>([...PLATES_KG]);
  const result = platesPerSide(total, { barKg: bar, plates: have });
  const kgWord = kgLabel(lang);
  const toggle = (p: number) => setHave((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p].sort((a, b) => b - a)));
  return (
    <section className="fit-card fit-calc" aria-labelledby="calc-plates">
      <h2 id="calc-plates">{pick(lang, "Plates per side", "Блины на каждую сторону")}</h2>
      <p className="fit-muted">
        {pick(lang, "For barbells and plate-loaded machines such as the 45° leg press. Untick the plates your gym does not have.", "Для штанги и рычажных тренажёров, например жима ногами под 45°. Снимите отметку с блинов, которых нет в зале.")}
      </p>
      <div className="fit-calc-inputs">
        <NumberStepper label={pick(lang, "Total", "Всего")} value={total} step={2.5} min={0} max={500} unit={kgWord} onChange={setTotal} testid="plates-total" />
      </div>
      <div className="fit-calc-field">
        <span className="fit-calc-label" id="calc-bar-label">{pick(lang, "Bar", "Гриф")}</span>
        <div className="fit-seg" role="group" aria-labelledby="calc-bar-label">
          {BARS_KG.map((b) => (
            <button key={b} type="button" aria-pressed={bar === b} data-value={b} onClick={() => setBar(b)}>
              {b === 0 ? pick(lang, "machine (no bar)", "тренажёр (без грифа)") : `${fmtKg(b, lang)} ${kgWord}`}
            </button>
          ))}
        </div>
      </div>
      <div className="fit-calc-field">
        <span className="fit-calc-label" id="calc-have-label">{pick(lang, "Plates in this gym", "Блины в зале")}</span>
        <div className="fit-seg" role="group" aria-labelledby="calc-have-label">
          {PLATES_KG.map((p) => (
            <button key={p} type="button" aria-pressed={have.includes(p)} data-value={p} onClick={() => toggle(p)}>
              {fmtKg(p, lang)}
            </button>
          ))}
        </div>
      </div>
      {result.ok ? (
        <div className="fit-calc-plates" data-testid="plates-result" data-loaded={result.loadedKg}>
          {result.perSide.length ? (
            <ul aria-label={pick(lang, "Each side", "С каждой стороны")}>
              {result.perSide.map((p, i) => (
                <li key={i} className="fit-plate fit-num" style={{ ["--plate" as string]: String(Math.max(0.45, Math.min(1, 0.4 + p / 40))) }}>{fmtKg(p, lang)}</li>
              ))}
            </ul>
          ) : (
            <p>{pick(lang, "Just the bar.", "Только гриф.")}</p>
          )}
          <p className="fit-muted">
            {result.exact
              ? pick(lang, `Each side, ${fmtKg(total, lang)} ${kgWord} in total.`, `С каждой стороны, всего ${fmtKg(total, lang)} ${kgWord}.`)
              : pick(lang, `These plates cannot make it exactly: ${fmtKg(result.loadedKg, lang)} ${kgWord}, ${fmtKg(result.missingKg, lang)} ${kgWord} short.`, `Точно не собрать: ${fmtKg(result.loadedKg, lang)} ${kgWord}, не хватает ${fmtKg(result.missingKg, lang)} ${kgWord}.`)}
          </p>
        </div>
      ) : (
        <p className="fit-note warn">
          {result.reason === "below-bar"
            ? pick(lang, "The total is lighter than the bar.", "Вес меньше веса грифа.")
            : pick(lang, "Enter a total above zero.", "Введите вес больше нуля.")}
        </p>
      )}
    </section>
  );
}
