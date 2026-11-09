"use client";
/**
 * Nutrition calculator (stream 09 — plans/fitness/09-nutrition.md). Results first (intake, protein per day and per
 * meal, fat / carbs / fibre, weekly change, weeks to a target weight), then the inputs (body, goal, activity, pace),
 * then creatine, caffeine and water. Inputs start from the fitness profile and this browser's last edits
 * (inputs.ts); the owner can save the body numbers to the profile. A sticky summary follows while the results are
 * scrolled away. All arithmetic lives in src/lib/fitness/nutrition.mjs.
 */
import { useEffect, useRef, useState } from "react";
import type { GoalMode, Lang, Settings } from "@/lib/fitness/types";
import { fmtDate, keepUnits, pick, pluralRu, t2 } from "@/lib/fitness/i18n";
import { defaultSettings } from "@/lib/fitness/store-core.mjs";
import {
  ACTIVITY,
  DAILY,
  ENERGY,
  GOALS,
  GOAL_KEYS,
  LIMITS,
  nutritionPlan,
  type ActivityKey,
  type NutritionPlan,
} from "@/lib/fitness/nutrition.mjs";
import { useFitness } from "@/components/fitness/Provider";
import { toNum, useNutritionInputs, useToday, type Field } from "./inputs";
import { NumberField, Refs, Seg, fmt, fmtSigned, fmtUpTo } from "./ui";

const MEALS = [3, 4, 5] as const;
const BODY: Field[] = ["kg", "cm", "age", "sex"];

const inRange = (n: number | undefined, [lo, hi]: readonly [number, number]) => n != null && n >= lo && n <= hi;

function errorText(lang: Lang, error: string) {
  switch (error) {
    case "kg":
      return pick(lang, "Enter a weight between 30 and 250 kg.", "Введите вес от 30 до 250 кг.");
    case "cm":
      return pick(lang, "Enter a height between 120 and 230 cm.", "Введите рост от 120 до 230 см.");
    case "age":
      return pick(lang, "Enter an age between 15 and 90.", "Введите возраст от 15 до 90 лет.");
    case "sex":
      return pick(lang, "Choose a sex: the BMR formula differs.", "Выберите пол: формула основного обмена отличается.");
    case "bodyFatPct":
      return pick(lang, "Body fat must be 3–60 %, or leave it empty.", "Процент жира — от 3 до 60 %, или оставьте поле пустым.");
    case "kcal":
      return pick(lang, "This pace leaves too few calories to plan a day: slow it down.", "При таком темпе калорий слишком мало, чтобы составить день: уменьшите темп.");
    default:
      return pick(lang, "Check the inputs below.", "Проверьте данные ниже.");
  }
}

function weeksText(lang: Lang, weeks: number) {
  const n = Math.max(1, Math.ceil(weeks));
  return pick(lang, `${n} ${n === 1 ? "week" : "weeks"}`, `${n} ${pluralRu(n, ["неделя", "недели", "недель"])}`);
}

function addDays(isoDay: string, days: number) {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString();
}

export function NutritionCalc({ lang }: { lang: Lang }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const { snapshot, store, canWrite, mode } = useFitness();
  const { get, set, year } = useNutritionInputs(snapshot);
  const today = useToday();
  const [saved, setSaved] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(true);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = resultsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setResultsVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ---------------------------------------------------------------- inputs */
  const kg = get("kg", "80");
  const cm = get("cm", "180");
  const age = get("age", "35");
  const sexV = get("sex", "male");
  const sex = sexV.value === "female" ? "female" : "male";
  const bodyFat = get("bodyFat", "");
  const goalV = get("goal", "recomp").value as GoalMode;
  const goal: GoalMode = GOAL_KEYS.includes(goalV) ? goalV : "recomp";
  const rule = GOALS[goal];
  const activityV = get("activity", "light").value;
  const activity = (ACTIVITY.some((a) => a.key === activityV) ? activityV : "light") as ActivityKey;
  const rateRule = rule.energy.rate;
  const rateField = rateRule ? (`rate-${goal}` as Field) : null;
  const rateTyped = rateField && rateRule ? toNum(get(rateField, String(rateRule.default)).value) : undefined;
  const rate = rateRule ? (rateTyped != null && rateTyped >= rateRule.min && rateTyped <= rateRule.max ? rateTyped : rateRule.default) : undefined;
  const mealsTyped = toNum(get("meals", String(DAILY.perMeal.defaultMeals)).value);
  const meals = MEALS.find((m) => m === mealsTyped) ?? 4;
  const target = get("targetKg", "");

  const kgN = toNum(kg.value);
  const cmN = toNum(cm.value);
  const ageN = toNum(age.value);
  const bodyFatN = toNum(bodyFat.value);
  const targetN = toNum(target.value);

  const plan = nutritionPlan({
    kg: kgN,
    cm: cmN,
    age: ageN,
    sex,
    bodyFatPct: bodyFatN ?? null,
    activity,
    goal,
    ratePctPerWeek: rate,
    meals,
    targetKg: targetN ?? null,
  });
  const ok: NutritionPlan | null = "error" in plan ? null : plan;

  /* ---------------------------------------------------------------- profile */
  const bodyValid = inRange(kgN, LIMITS.kg) && inRange(cmN, LIMITS.cm) && inRange(ageN, LIMITS.age);
  const edited = BODY.some((f) => get(f, "").source === "edit");
  const s = snapshot.settings;
  const differs =
    !s ||
    s.bodyweightKg !== kgN ||
    s.heightCm !== (cmN == null ? undefined : Math.round(cmN)) ||
    s.birthYear !== (ageN == null || !year ? undefined : year - Math.round(ageN)) ||
    s.sex !== sex;
  const canSave = canWrite && edited && bodyValid && differs && year > 0;
  const showsDefaults = mode !== "loading" && BODY.some((f) => get(f, "").source === "default");
  const showsOwner = mode === "viewer" && BODY.some((f) => get(f, "").source === "profile");

  const edit = (patch: Partial<Record<Field, string>>) => {
    setSaved(false);
    set(patch);
  };

  const save = () => {
    if (!canSave || kgN == null || cmN == null || ageN == null) return;
    const now = new Date().toISOString();
    const base: Settings = snapshot.settings ?? (defaultSettings(now) as Settings);
    store.upsert("settings", {
      ...base,
      bodyweightKg: Math.round(kgN * 10) / 10,
      heightCm: Math.round(cmN),
      birthYear: year - Math.round(ageN),
      sex,
      updatedAt: now,
    });
    setSaved(true);
  };

  const scrollToResults = () => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  /* ---------------------------------------------------------------- render */
  const kgU = T("kg", "кг");
  const kcalU = T("kcal", "ккал");
  const perWeek = T("a week", "в неделю");

  return (
    <section className="nut-calc" aria-labelledby="nut-calc-title">
      <h2 id="nut-calc-title">{T("Your daily targets", "Ваша норма на день")}</h2>

      <div className="nut-col">
        <div ref={resultsRef} className="fit-card nut-results">
          {showsDefaults ? (
            <p className="fit-note">
              <a href="#nut-about">{T("Calculated for example values: enter yours below.", "Расчёт для примера: введите свои данные ниже.")}</a>
            </p>
          ) : null}
          {ok ? (
            <Results lang={lang} plan={ok} goal={goal} meals={meals} onMeals={(m) => edit({ meals: String(m) })} />
          ) : (
            <p className="fit-note warn" role="status">{keepUnits(errorText(lang, "error" in plan ? plan.error : ""))}</p>
          )}

          <div className="nut-target">
            <NumberField
              id="nut-target"
              label={T("Target weight", "Целевой вес")}
              unit={kgU}
              value={target.value}
              placeholder={T("optional", "необязательно")}
              invalid={target.value !== "" && !inRange(targetN, LIMITS.kg)}
              onChange={(v) => edit({ targetKg: v })}
            />
            <TimelineText lang={lang} plan={ok} hasTarget={target.value.trim() !== ""} today={today} />
          </div>
        </div>

        {ok ? <Extras lang={lang} plan={ok} /> : null}
      </div>

      <div className="nut-col">
        <div className="fit-card nut-inputs">
          <h3 id="nut-about">{T("About you", "О вас")}</h3>
          {showsOwner ? (
            <p className="fit-note">
              {T(
                "These are Ilya's numbers. Type yours to calculate: they stay in this browser.",
                "Это данные Ильи. Введите свои, чтобы посчитать: они останутся только в этом браузере.",
              )}
            </p>
          ) : null}
          <div className="nut-fields">
            <NumberField id="nut-kg" label={T("Weight", "Вес")} unit={kgU} value={kg.value} invalid={!inRange(kgN, LIMITS.kg)} onChange={(v) => edit({ kg: v })} />
            <NumberField id="nut-cm" label={T("Height", "Рост")} unit={T("cm", "см")} value={cm.value} invalid={!inRange(cmN, LIMITS.cm)} onChange={(v) => edit({ cm: v })} />
            <NumberField id="nut-age" label={T("Age", "Возраст")} unit={T("years", "лет")} value={age.value} invalid={!inRange(ageN, LIMITS.age)} onChange={(v) => edit({ age: v })} />
            <NumberField
              id="nut-bf"
              label={T("Body fat", "Процент жира")}
              unit="%"
              value={bodyFat.value}
              placeholder={T("optional", "необязательно")}
              invalid={bodyFat.value !== "" && !inRange(bodyFatN, LIMITS.bodyFatPct)}
              hint={T("Sets protein by lean mass", "Белок считается от сухой массы")}
              onChange={(v) => edit({ bodyFat: v })}
            />
          </div>
          <Seg
            legend={T("Sex", "Пол")}
            className="nut-seg-2"
            options={[
              { value: "male", label: T("Male", "Мужской") },
              { value: "female", label: T("Female", "Женский") },
            ]}
            value={sex}
            onChange={(v) => edit({ sex: v })}
          />
          {canWrite ? (
            <div className="nut-save">
              {canSave ? (
                <button type="button" className="fit-button" onClick={save}>
                  {T("Save to my profile", "Сохранить в профиль")}
                </button>
              ) : null}
              {saved ? (
                <span className="nut-saved" role="status">
                  {T("Saved to your profile.", "Сохранено в профиле.")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="fit-card nut-inputs">
          <Seg
            legend={T("Goal", "Цель")}
            className="nut-seg-goal"
            options={GOAL_KEYS.map((k) => ({ value: k, label: t2(lang, GOALS[k].short) }))}
            value={goal}
            onChange={(v) => edit({ goal: v })}
          />
          <p className="nut-goal-summary">
            <b>{t2(lang, rule.name)}.</b> {keepUnits(t2(lang, rule.summary))} <Refs ids={rule.energy.source} lang={lang} />
          </p>
          {rateRule && rateField && rate != null ? (
            <div className="nut-slider">
              <div className="nut-slider-head">
                <label htmlFor="nut-rate">
                  {rule.energy.direction === "loss" ? T("Weight-loss pace", "Темп снижения веса") : T("Weight-gain pace", "Темп набора веса")}
                </label>
                <output htmlFor="nut-rate" className="fit-num">
                  {fmtUpTo(rate, lang, 2)}{"\u00a0"}% {perWeek}
                  {kgN != null && inRange(kgN, LIMITS.kg) ? ` · ${fmt((rate * kgN) / 100, lang, 2)}\u00a0${kgU}` : ""}
                </output>
              </div>
              <input
                id="nut-rate"
                type="range"
                min={rateRule.min}
                max={rateRule.max}
                step={rateRule.step}
                value={rate}
                aria-valuetext={`${fmtUpTo(rate, lang, 2)} % ${perWeek}`}
                onChange={(e) => edit({ [rateField]: e.target.value })}
              />
              <div className="nut-range-ends fit-num">
                <span>{fmtUpTo(rateRule.min, lang, 2)}{"\u00a0"}%</span>
                <span>
                  {T(
                    `recommended ${fmtUpTo(rateRule.recommended[0], lang, 2)}–${fmtUpTo(rateRule.recommended[1], lang, 2)} %`,
                    `рекомендуется ${fmtUpTo(rateRule.recommended[0], lang, 2)}–${fmtUpTo(rateRule.recommended[1], lang, 2)} %`,
                  )}
                </span>
                <span>{fmtUpTo(rateRule.max, lang, 2)}{"\u00a0"}%</span>
              </div>
            </div>
          ) : (
            <p className="fit-muted nut-maintain">{T("This goal eats at maintenance: the weight stays where it is.", "При этой цели питание на поддержание: вес не меняется.")}</p>
          )}
          <Seg
            legend={T("Activity", "Активность")}
            className="nut-seg-list"
            options={ACTIVITY.map((a) => ({ value: a.key, label: `${t2(lang, a.name)} · ×${fmtUpTo(a.factor, lang, 3)}`, hint: keepUnits(t2(lang, a.hint)) }))}
            value={activity}
            onChange={(v) => edit({ activity: v })}
          />
          <p className="fit-muted nut-small">
            {keepUnits(t2(lang, ENERGY.activityNote))} <Refs ids={ENERGY.activitySource} lang={lang} />
          </p>
        </div>

      </div>

      <div className="nut-sticky" data-show={!resultsVisible && ok ? "true" : "false"} aria-hidden={resultsVisible || !ok}>
        {ok ? (
          <button type="button" className="nut-sticky-bar fit-num" onClick={scrollToResults} tabIndex={resultsVisible ? -1 : 0}>
            <b>
              {fmt(ok.energy.kcal, lang)}{"\u00a0"}{kcalU}
            </b>
            <span>
              {T("protein", "белок")} {fmt(ok.protein.target, lang)}{"\u00a0"}{T("g", "г")}
            </span>
            {ok.energy.weeklyChangeKg !== 0 ? (
              <span>
                {T(`${fmtSigned(ok.energy.weeklyChangeKg, lang, 2)} kg/wk`, `${fmtSigned(ok.energy.weeklyChangeKg, lang, 2)} кг/нед`)}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ results */

function Results({ lang, plan, goal, meals, onMeals }: { lang: Lang; plan: NutritionPlan; goal: GoalMode; meals: number; onMeals: (m: number) => void }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const { energy, protein, perMeal, macros, bmr, tdee } = plan;
  const rule = GOALS[goal];
  const g = T("g", "г");
  const kcalU = T("kcal", "ккал");
  const maintain = energy.direction === "maintain";
  const kg = protein.perKg;
  const band =
    protein.basis === "lean-mass" && protein.perKgLean && protein.ffmKg
      ? T(
          `${fmtUpTo(protein.perKgLean.min, lang, 1)}–${fmtUpTo(protein.perKgLean.max, lang, 1)} g per kg of lean mass (${fmt(protein.ffmKg, lang)} kg)`,
          `${fmtUpTo(protein.perKgLean.min, lang, 1)}–${fmtUpTo(protein.perKgLean.max, lang, 1)} г на кг сухой массы (${fmt(protein.ffmKg, lang)} кг)`,
        )
      : T(`${fmtUpTo(kg.min, lang, 1)}–${fmtUpTo(kg.max, lang, 1)} g/kg`, `${fmtUpTo(kg.min, lang, 1)}–${fmtUpTo(kg.max, lang, 1)} г/кг`);

  return (
    <>
      <p className="nut-summary" role="status">
        <span className="nut-big fit-num">
          {fmt(energy.kcal, lang)}{"\u00a0"}<small>{T("kcal a day", "ккал в день")}</small>
        </span>
        <span className="nut-sub fit-num">
          {maintain
            ? T(`maintenance (TDEE ${fmt(tdee.kcal, lang)} ${kcalU})`, `поддержание (расход ${fmt(tdee.kcal, lang)} ${kcalU})`)
            : T(
                `${fmtSigned(energy.deltaKcal, lang)} ${kcalU} vs maintenance ${fmt(tdee.kcal, lang)} (${fmtSigned(energy.deltaPctTdee, lang)} %)`,
                `${fmtSigned(energy.deltaKcal, lang)} ${kcalU} к поддержанию ${fmt(tdee.kcal, lang)} (${fmtSigned(energy.deltaPctTdee, lang)} %)`,
              )}
        </span>
      </p>

      <div className="nut-protein">
        <p className="nut-line">
          <span className="nut-label">{T("Protein", "Белок")}</span>
          <span className="nut-value fit-num">
            {fmt(protein.target, lang)}{"\u00a0"}{g}
            <small> · {T(`range ${protein.min}–${protein.max} g`, `диапазон ${protein.min}–${protein.max} г`)}</small>
          </span>
        </p>
        <p className="nut-small fit-muted">
          {band}.{energy.direction === "loss" ? ` ${T("In a deficit aim for the top.", "В дефиците — ближе к верхней границе.")}` : ""}{" "}
          <Refs ids={rule.protein.source} lang={lang} />
        </p>
        <div className="nut-meals">
          <div className="fit-seg" role="group" aria-label={T("Meals a day", "Приёмов пищи в день")}>
            {MEALS.map((m) => (
              <button key={m} type="button" aria-pressed={m === meals} onClick={() => onMeals(m)}>
                {T(`${m} meals`, `${m} ${pluralRu(m, ["приём", "приёма", "приёмов"])}`)}
              </button>
            ))}
          </div>
          <p className="nut-line">
            <span className="nut-label">{T("Per meal", "За приём")}</span>
            <span className="nut-value fit-num">
              {fmt(perMeal.target, lang)}{"\u00a0"}{g}
            </span>
          </p>
          <p className={`nut-small ${perMeal.short ? "nut-warn-text" : "fit-muted"}`}>
            {perMeal.short
              ? T(
                  `Below ${perMeal.floor} g a meal (0.4 g/kg): fewer, larger meals work better.`,
                  `Меньше ${perMeal.floor} г за приём (0,4 г/кг): лучше реже, но больше.`,
                )
              : T(`At least ${perMeal.floor} g a meal (0.4 g/kg); larger meals are fine.`, `Не меньше ${perMeal.floor} г за приём (0,4 г/кг); больше — тоже нормально.`)}{" "}
            <Refs ids={DAILY.perMeal.source} lang={lang} />
          </p>
        </div>
      </div>

      <MacroBar lang={lang} plan={plan} />

      <dl className="fit-kv nut-kv fit-num">
        <dt>{T("Fat", "Жиры")}</dt>
        <dd>
          {fmt(macros.fat.g, lang)}{"\u00a0"}{g} <small>· {T(`at least ${macros.fatFloorG} g`, `не меньше ${macros.fatFloorG} г`)}</small>
        </dd>
        <dt>{T("Carbs", "Углеводы")}</dt>
        <dd>
          {fmt(macros.carbs.g, lang)}{"\u00a0"}{g}
        </dd>
        <dt>{T("Fibre", "Клетчатка")}</dt>
        <dd>
          {T(`at least ${macros.fibreG} g`, `не меньше ${macros.fibreG} г`)} <Refs ids={DAILY.fibre.source} lang={lang} />
        </dd>
        <dt>{T("Weight change", "Изменение веса")}</dt>
        <dd>
          {maintain
            ? T("steady", "без изменений")
            : `${fmtSigned(energy.weeklyChangeKg, lang, 2)}\u00a0${T("kg a week", "кг в неделю")} (${fmtSigned(energy.weeklyChangePct, lang, 2, true)}\u00a0%)`}
        </dd>
        <dt>{T("Maintenance", "Поддержание")}</dt>
        <dd>
          {T(`BMR ${fmt(bmr.kcal, lang)} × ${fmtUpTo(tdee.factor, lang, 3)} = ${fmt(tdee.kcal, lang)} ${kcalU}`, `BMR ${fmt(bmr.kcal, lang)} × ${fmtUpTo(tdee.factor, lang, 3)} = ${fmt(tdee.kcal, lang)} ${kcalU}`)}{" "}
          <Refs ids={bmr.katch != null ? ["mifflin-1990", "cunningham-1980"] : ["mifflin-1990", "frankenfield-2005"]} lang={lang} />
        </dd>
      </dl>

      <Warnings lang={lang} plan={plan} goal={goal} />
      <HowItWorks lang={lang} plan={plan} goal={goal} />
    </>
  );
}

function MacroBar({ lang, plan }: { lang: Lang; plan: NutritionPlan }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const { protein, fat, carbs } = plan.macros;
  const total = Math.max(1, protein.kcal + fat.kcal + carbs.kcal);
  const parts = [
    { key: "protein", label: T("Protein", "Белок"), part: protein },
    { key: "fat", label: T("Fat", "Жиры"), part: fat },
    { key: "carbs", label: T("Carbs", "Углеводы"), part: carbs },
  ];
  return (
    <figure className="nut-macros">
      <div className="nut-bar" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.key} className={`nut-bar-${p.key}`} style={{ width: `${(p.part.kcal / total) * 100}%` }} />
        ))}
      </div>
      <figcaption className="nut-legend fit-num">
        {parts.map((p) => (
          <span key={p.key}>
            <i className={`nut-dot nut-bar-${p.key}`} aria-hidden="true" />
            {p.label} {fmt(p.part.g, lang)}{"\u00a0"}{T("g", "г")} · {p.part.pct}{"\u00a0"}%
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function Warnings({ lang, plan, goal }: { lang: Lang; plan: NutritionPlan; goal: GoalMode }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const rate = GOALS[goal].energy.rate;
  const loss = plan.energy.direction === "loss";
  const items: { key: string; text: string; refs: string[] }[] = [];
  for (const w of plan.warnings) {
    if (w === "pace-above-recommended" && rate)
      items.push(
        loss
          ? {
              key: w,
              text: T(
                `Faster than ${fmtUpTo(rate.recommended[1], lang, 2)} % a week puts muscle at risk unless body fat is above about 25 %.`,
                `Быстрее ${fmtUpTo(rate.recommended[1], lang, 2)} % в неделю — риск потерять мышцы, если жира меньше ~25 %.`,
              ),
              refs: ["garthe-2011", "helms-2014"],
            }
          : {
              key: w,
              text:
                goal === "strength"
                  ? T(
                      `Faster than ${fmtUpTo(rate.recommended[1], lang, 2)} % a week mostly adds fat, not strength.`,
                      `Быстрее ${fmtUpTo(rate.recommended[1], lang, 2)} % в неделю добавляет в основном жир, а не силу.`,
                    )
                  : T(
                      `Faster than ${fmtUpTo(rate.recommended[1], lang, 2)} % a week is mostly fat; only beginners gain well up to 0.5 %.`,
                      `Быстрее ${fmtUpTo(rate.recommended[1], lang, 2)} % в неделю — в основном жир; до 0,5 % оправдано только для новичков.`,
                    ),
              refs: ["helms-2023", "iraki-2019"],
            },
      );
    if (w === "deficit-over-max-kcal")
      items.push({ key: w, text: T("A deficit over 500 kcal a day stopped lean-mass gains in the meta-analysis.", "При дефиците больше 500 ккал в день прирост мышц в метаанализе прекращался."), refs: ["murphy-koehler-2022"] });
    if (w === "deficit-over-max-pct")
      items.push({ key: w, text: T("The deficit is over 25 % of maintenance: hard to sustain and to train on.", "Дефицит больше 25 % от поддержания: трудно выдержать и тренироваться."), refs: ["garthe-2011"] });
    if (w === "below-bmr")
      items.push({ key: w, text: T("Intake is below your resting expenditure (BMR): slow the pace.", "Калорийность ниже основного обмена (BMR): уменьшите темп."), refs: [] });
    if (w === "carbs-below-floor")
      items.push({
        key: w,
        text: T(
          `Carbohydrate is under ${GOALS[goal].carbFloorGPerKg} g/kg${plan.macros.fatLowered ? " even with fat trimmed" : ""}: fine for a cut, but if sessions suffer, move 100–200 kcal from fat to carbs on training days or slow the pace.`,
          `Углеводов меньше ${GOALS[goal].carbFloorGPerKg} г/кг${plan.macros.fatLowered ? " даже после снижения жиров" : ""}: для дефицита допустимо, но если тренировки страдают, в дни тренировок перенесите 100–200 ккал из жиров в углеводы или уменьшите темп.`,
        ),
        refs: ["henselmans-2022", "iraki-2019"],
      });
    if (w === "over-budget")
      items.push({ key: w, text: T("Protein and the minimum fat already use up these calories: slow the pace.", "Белок и минимум жиров уже съедают всю калорийность: уменьшите темп."), refs: [] });
  }
  if (plan.macros.fatLowered && !plan.warnings.includes("carbs-below-floor"))
    items.push({ key: "fat-lowered", text: T("Fat is trimmed toward 0.6 g/kg to keep carbohydrate up for training.", "Жиры снижены к 0,6 г/кг, чтобы оставить углеводы для тренировок."), refs: ["iraki-2019"] });
  if (!items.length) return null;
  return (
    <ul className="nut-warnings">
      {items.map((i) => (
        <li key={i.key} className="fit-note warn">
          {i.text} <Refs ids={i.refs} lang={lang} />
        </li>
      ))}
    </ul>
  );
}

function TimelineText({ lang, plan, hasTarget, today }: { lang: Lang; plan: NutritionPlan | null; hasTarget: boolean; today: string }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  if (!hasTarget || !plan) return <p className="nut-small fit-muted">{T("Add a target to see how long it takes.", "Укажите цель, чтобы увидеть срок.")}</p>;
  const t = plan.timeline;
  if (!t) return null;
  if ("error" in t) {
    const text =
      t.error === "direction"
        ? T("This goal moves your weight the other way.", "Эта цель меняет вес в другую сторону.")
        : t.error === "weeklyChangeKg"
          ? T("This goal keeps your weight steady: pick fat loss or a gain goal to reach a target.", "При этой цели вес не меняется: для цели выберите похудение или набор.")
          : T("Enter a target between 30 and 250 kg.", "Введите цель от 30 до 250 кг.");
    return <p className="nut-small nut-warn-text">{text}</p>;
  }
  if (t.weeks === 0) return <p className="nut-small fit-muted">{T("You are there.", "Вы уже у цели.")}</p>;
  const date = today ? fmtDate(addDays(today, t.totalWeeks * 7), lang, { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <p className="nut-small fit-num">
      <b>{weeksText(lang, t.totalWeeks)}</b>
      {date ? T(` · around ${date}`, ` · примерно к ${date}`) : ""}
      <br />
      <span className="fit-muted">
        {t.direction === "loss"
          ? T(
              `${weeksText(lang, t.weeks)} on paper, +10 % for metabolic adaptation${t.breakWeeks ? ` and ${t.breakWeeks} maintenance ${t.breakWeeks === 1 ? "week" : "weeks"}` : ""}.`,
              `${weeksText(lang, t.weeks)} по расчёту, +10 % на адаптацию обмена${t.breakWeeks ? ` и ${t.breakWeeks} ${pluralRu(t.breakWeeks, ["неделя", "недели", "недель"])} на поддержании` : ""}.`,
            )
          : T("Straight from the pace; gains slow down as you get closer.", "Прямо по темпу; ближе к цели набор замедляется.")}{" "}
        <Refs ids={ENERGY.timelineSource} lang={lang} />
      </span>
    </p>
  );
}

function HowItWorks({ lang, plan, goal }: { lang: Lang; plan: NutritionPlan; goal: GoalMode }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const rule = GOALS[goal];
  return (
    <details className="nut-how">
      <summary>{T("How this is calculated", "Как это считается")}</summary>
      <ul>
        <li>
          {T(
            "Resting expenditure (BMR): Mifflin–St Jeor, 10 × kg + 6.25 × cm − 5 × age + 5 (men) or − 161 (women). With body fat entered, the average of Mifflin–St Jeor and Katch–McArdle (370 + 21.6 × lean mass).",
            "Основной обмен (BMR): Миффлин — Сан Жеор, 10 × кг + 6,25 × см − 5 × возраст + 5 (мужчины) или − 161 (женщины). С процентом жира — среднее Миффлина и Кэтча — МакАрдла (370 + 21,6 × сухая масса).",
          )}{" "}
          <Refs ids={["mifflin-1990", "frankenfield-2005", "cunningham-1980"]} lang={lang} />
        </li>
        <li>
          {T(
            "Maintenance (TDEE) = BMR × activity factor. It is an estimate: after 2–3 weeks of weighing daily, your trend weight tells the truth.",
            "Поддержание (TDEE) = BMR × коэффициент активности. Это оценка: через 2–3 недели ежедневных взвешиваний правду покажет тренд веса.",
          )}{" "}
          <Refs ids={ENERGY.activitySource} lang={lang} />
        </li>
        <li>
          {T(
            `Pace → calories: about ${fmt(ENERGY.kcalPerKgLoss, lang)} kcal per kg lost and ${fmt(ENERGY.kcalPerKgGain, lang)} kcal per kg gained (half of a gain is lean tissue). Real loss slows as the body adapts.`,
            `Темп → калории: около ${fmt(ENERGY.kcalPerKgLoss, lang)} ккал на кг сброшенного веса и ${fmt(ENERGY.kcalPerKgGain, lang)} ккал на кг набранного (половина набора — сухая ткань). Реальное снижение замедляется по мере адаптации.`,
          )}{" "}
          <Refs ids={[...ENERGY.energyDensitySource, "rosenbaum-2010"]} lang={lang} />
        </li>
        <li>
          {T(
            `Protein: ${fmtUpTo(rule.protein.gPerKg[0], lang, 1)}–${fmtUpTo(rule.protein.gPerKg[1], lang, 1)} g per kg of bodyweight for this goal${rule.protein.ffm ? `, or ${fmtUpTo(rule.protein.ffm.gPerKg[0], lang, 1)}–${fmtUpTo(rule.protein.ffm.gPerKg[1], lang, 1)} g per kg of lean mass when body fat is known (capped at ${fmtUpTo(DAILY.proteinCapGPerKg, lang, 1)} g/kg)` : ""}. Intakes up to about 3 g/kg were harmless for a year in healthy trained men.`,
            `Белок: ${fmtUpTo(rule.protein.gPerKg[0], lang, 1)}–${fmtUpTo(rule.protein.gPerKg[1], lang, 1)} г на кг веса для этой цели${rule.protein.ffm ? `, или ${fmtUpTo(rule.protein.ffm.gPerKg[0], lang, 1)}–${fmtUpTo(rule.protein.ffm.gPerKg[1], lang, 1)} г на кг сухой массы, если известен процент жира (не больше ${fmtUpTo(DAILY.proteinCapGPerKg, lang, 1)} г/кг веса)` : ""}. До ~3 г/кг в течение года не вредили здоровым тренированным мужчинам.`,
          )}{" "}
          <Refs ids={[...rule.protein.source, "antonio-2016"]} lang={lang} />
        </li>
        <li>
          {T(
            `Fat ${fmtUpTo(DAILY.fat.defaultGPerKg, lang, 1)} g/kg, never under ${fmtUpTo(DAILY.fat.floorGPerKg, lang, 1)} g/kg or ${DAILY.fat.floorPctKcal} % of calories (lower fat cut testosterone 10–15 %); carbohydrate fills the rest, floor ${rule.carbFloorGPerKg} g/kg for this goal.`,
            `Жиры ${fmtUpTo(DAILY.fat.defaultGPerKg, lang, 1)} г/кг, не меньше ${fmtUpTo(DAILY.fat.floorGPerKg, lang, 1)} г/кг и ${DAILY.fat.floorPctKcal} % калорий (меньше жира снижало тестостерон на 10–15 %); остальное — углеводы, минимум ${rule.carbFloorGPerKg} г/кг для этой цели.`,
          )}{" "}
          <Refs ids={rule.floorSource} lang={lang} />
        </li>
        <li className="fit-num">
          {plan.bmr.katch != null
            ? T(
                `Your numbers: Mifflin ${fmt(plan.bmr.mifflin, lang)}, Katch–McArdle ${fmt(plan.bmr.katch, lang)} → BMR ${fmt(plan.bmr.kcal, lang)} kcal.`,
                `Ваши числа: Миффлин ${fmt(plan.bmr.mifflin, lang)}, Кэтч — МакАрдл ${fmt(plan.bmr.katch, lang)} → BMR ${fmt(plan.bmr.kcal, lang)} ккал.`,
              )
            : T(`Your numbers: BMR ${fmt(plan.bmr.kcal, lang)} kcal (Mifflin–St Jeor).`, `Ваши числа: BMR ${fmt(plan.bmr.kcal, lang)} ккал (Миффлин — Сан Жеор).`)}
        </li>
      </ul>
    </details>
  );
}

/* ------------------------------------------------------------------ creatine, caffeine, water */

function Extras({ lang, plan }: { lang: Lang; plan: NutritionPlan }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const x = plan.extras;
  const cups = (mg: number) => fmtUpTo(Math.round((mg / DAILY.caffeine.coffeeMgPer240ml) * 2) / 2, lang, 1);
  // "3–5", or one number when both ends are equal: 5 g of creatine above 90 kg, caffeine at the 400 mg cap from 132 kg
  // ("400 mg", not "400–400 mg"; 390–400 mg is "≈ 4 cups", not "4–4")
  const span = (a: number | string, b: number | string) => (`${a}` === `${b}` ? `${a}` : `${a}–${b}`);
  const creatine = span(x.creatineG[0], x.creatineG[1]);
  const caffeine = span(x.caffeineMg[0], x.caffeineMg[1]);
  const coffee = span(cups(x.caffeineMg[0]), cups(x.caffeineMg[1]));
  const firstDose = span(x.caffeineStartMg[0], x.caffeineStartMg[1]);
  const [cut1, cut2] = DAILY.caffeine.cutoffHoursBeforeBed;
  return (
    <div className="fit-card nut-extras">
      <h3>{T("Creatine, caffeine, water", "Креатин, кофеин, вода")}</h3>
      <dl className="fit-kv nut-kv fit-num">
        <dt>{T("Creatine", "Креатин")}</dt>
        <dd>
          {T(`${creatine} g a day, any time`, `${creatine} г в день, в любое время`)}{" "}
          <Refs ids={DAILY.creatine.source} lang={lang} />
        </dd>
        <dt>{T("Caffeine", "Кофеин")}</dt>
        <dd>
          {T(
            `${caffeine} mg 45–60 min before training (≈ ${coffee} cups of coffee); start with ${firstDose} mg; at most ${x.caffeineMaxMg} mg a day; none within ${cut1}–${cut2} h of bedtime`,
            `${caffeine} мг за 45–60 минут до тренировки (≈ ${coffee} чашки кофе); начните с ${firstDose} мг; не больше ${x.caffeineMaxMg} мг в день; не позже чем за ${cut1}–${cut2} ч до сна`,
          )}{" "}
          <Refs ids={DAILY.caffeine.source} lang={lang} />
        </dd>
        <dt>{T("Water", "Вода")}</dt>
        <dd>
          {T(
            `≈ ${fmtUpTo(x.waterL, lang, 1)} L a day from drinks and food, plus ${fmtUpTo(x.extraWaterPerHourL[0], lang, 1)}–${fmtUpTo(x.extraWaterPerHourL[1], lang, 1)} L per training hour`,
            `≈ ${fmtUpTo(x.waterL, lang, 1)} л в день с напитками и едой, плюс ${fmtUpTo(x.extraWaterPerHourL[0], lang, 1)}–${fmtUpTo(x.extraWaterPerHourL[1], lang, 1)} л на час тренировки`,
          )}{" "}
          <Refs ids={DAILY.hydration.source} lang={lang} />
        </dd>
      </dl>
    </div>
  );
}
