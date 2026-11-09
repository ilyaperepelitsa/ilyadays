/**
 * Nutrition calculators and field-test estimators (owner: stream 09, plans/fitness/09-nutrition.md).
 * Pure: no DOM, no storage, no clock unless passed in. The numbers (goal rules, constants, zones, foods, sources)
 * live in content/fitness/nutrition.json, each with `source` ids; this module validates and does the arithmetic.
 * Every function returns an object; invalid input returns `{ error: "<field>" }` instead of throwing.
 */
import data from "../../../content/fitness/nutrition.json" with { type: "json" };

/** @typedef {import("./types").GoalMode} GoalMode */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {{ error: string }} Invalid */
/** @typedef {"male" | "female"} Sex */
/** @typedef {"sedentary" | "light" | "moderate" | "active" | "very"} ActivityKey */
/** @typedef {"loss" | "gain" | "maintain"} Direction */
/** @typedef {{ key: ActivityKey, factor: number, name: Text2, hint: Text2 }} ActivityLevel */
/** @typedef {{ min: number, max: number, step: number, default: number, recommended: [number, number] }} RateRule */
/**
 * @typedef {{
 *   name: Text2, short: Text2, summary: Text2,
 *   protein: { gPerKg: [number, number], target: number, ffm: { gPerKg: [number, number], target: number } | null, source: string[] },
 *   energy: { direction: Direction, rate: RateRule | null, typicalDeltaPctTdee: [number, number], maxDeficitKcal?: number, maxDeficitPctTdee?: number, toleranceKcal?: number, source: string[] },
 *   fatFloorGPerKg: number, carbFloorGPerKg: number, floorSource: string[]
 * }} GoalRule
 */
/** @typedef {{ kcal: number, protein: number, fat: number, carbs: number, fibre: number | null }} Per100 */
/**
 * @typedef {{
 *   id: string, name: Text2, group: string, cuisine: string | null, unit: "g" | "ml", per100: Per100,
 *   proteinPer100kcal: number, serving: { grams: number, label: Text2, kcal: number, protein: number },
 *   source: string, ref: string
 * }} Food
 */
/** @typedef {{ id: string, name: Text2 }} Facet */
/** @typedef {{ id: string, text: string, url: string | null }} Source */
/** @typedef {{ en: string, ru: string, source: string[] }} Rule */
/** @typedef {{ zone: number, pct: [number, number], name: Text2, feel: Text2 }} ZoneInfo */
/** @typedef {{ zone: number, pct: [number, number], from: number, to: number }} Zone */
/** @typedef {{ hrMax: number, hrRest: number, reserve: number, measured: boolean, zones: Zone[] }} HrZones */
/** @typedef {"per100kcal" | "per100g" | "perServing"} FoodSort */

/* ------------------------------------------------------------------ data */

/** The whole JSON document (typed loosely; prefer the typed exports below). */
export const NUTRITION = /** @type {any} */ (data);
/** @type {GoalMode[]} */
export const GOAL_KEYS = ["recomp", "strength", "hypertrophy", "endurance", "maintenance"];
/** @type {Record<GoalMode, GoalRule>} */
export const GOALS = NUTRITION.goals;
/** @type {ActivityLevel[]} */
export const ACTIVITY = NUTRITION.energy.activity;
/** @type {ActivityKey[]} */
export const ACTIVITY_KEYS = ACTIVITY.map((a) => a.key);
/** Energy constants: kcal per kg of weight lost / gained, adaptation factor, diet-break cadence, notes, sources. */
export const ENERGY = data.energy;
/** Daily rules shared by every goal: protein cap, per meal, fat, fibre, creatine, caffeine, hydration. */
export const DAILY = data.daily;
/** Heart-rate and VO2max constants. */
export const HEART = data.heartRate;
/** @type {ZoneInfo[]} */
export const ZONES = NUTRITION.heartRate.zones;
/** @type {Food[]} */
export const FOODS = NUTRITION.foods;
/** @type {Facet[]} */
export const FOOD_GROUPS = NUTRITION.foodGroups;
/** @type {Facet[]} */
export const CUISINES = NUTRITION.cuisines;
/** @type {Rule[]} */
export const RULES = NUTRITION.rules;
/** @type {Source[]} */
export const SOURCES = NUTRITION.sources;

const SOURCE_INDEX = new Map(SOURCES.map((s, i) => [s.id, i + 1]));
/** 1-based position of a source id in SOURCES (0 when unknown), for "[n]" references. @param {string} id */
export const sourceNumber = (id) => SOURCE_INDEX.get(id) ?? 0;

/** Accepted input ranges (inclusive). */
export const LIMITS = Object.freeze({
  kg: /** @type {[number, number]} */ ([30, 250]),
  cm: /** @type {[number, number]} */ ([120, 230]),
  age: /** @type {[number, number]} */ ([15, 90]),
  bodyFatPct: /** @type {[number, number]} */ ([3, 60]),
  meals: /** @type {[number, number]} */ ([2, 6]),
  hrRest: /** @type {[number, number]} */ ([30, 110]),
  hrMax: /** @type {[number, number]} */ ([100, 230]),
  hr: /** @type {[number, number]} */ ([30, 240]),
  kcal: /** @type {[number, number]} */ ([800, 7000]),
  /** A day's intake to split into macros (an aggressive plan for a small person can go under 800). */
  intakeKcal: /** @type {[number, number]} */ ([500, 7000]),
  proteinG: /** @type {[number, number]} */ ([20, 700]),
});

/* ------------------------------------------------------------------ helpers */

/** @param {unknown} v @returns {v is number} */
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** @param {unknown} v @param {[number, number]} range @returns {v is number} */
const within = (v, [lo, hi]) => isNum(v) && v >= lo && v <= hi;
/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** A number, or the `kcal` of a result object. @param {unknown} v */
const kcalOf = (v) => (typeof v === "object" && v !== null ? /** @type {{ kcal?: unknown }} */ (v).kcal : v);
/** @param {unknown} goal @returns {GoalRule | undefined} */
const ruleOf = (goal) => (typeof goal === "string" && GOAL_KEYS.includes(/** @type {GoalMode} */ (goal)) ? GOALS[/** @type {GoalMode} */ (goal)] : undefined);

/** The goal's rules (unknown goals fall back to recomp, the default mode). @param {GoalMode | string | null | undefined} goal */
export const goalRule = (goal) => ruleOf(goal) ?? GOALS.recomp;

/** Whole years from a birth year; null when the year is missing or implausible. @param {unknown} year @param {number} [nowYear] */
export function ageFromBirthYear(year, nowYear = new Date().getFullYear()) {
  if (!Number.isInteger(year) || !Number.isInteger(nowYear)) return null;
  const age = nowYear - /** @type {number} */ (year);
  return age >= 0 && age <= 120 ? age : null;
}

/* ------------------------------------------------------------------ energy */

/**
 * Resting energy expenditure, Mifflin–St Jeor (1990): 10·kg + 6.25·cm − 5·age + 5 (male) / −161 (female).
 * @param {{ kg?: unknown, cm?: unknown, age?: unknown, sex?: unknown }} [input]
 * @returns {{ kcal: number } | Invalid}
 */
export function bmrMifflin({ kg, cm, age, sex } = {}) {
  if (!within(kg, LIMITS.kg)) return { error: "kg" };
  if (!within(cm, LIMITS.cm)) return { error: "cm" };
  if (!within(age, LIMITS.age)) return { error: "age" };
  if (sex !== "male" && sex !== "female") return { error: "sex" };
  return { kcal: 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161) };
}

/**
 * Resting energy from fat-free mass, Katch–McArdle (Cunningham 1980 form): 370 + 21.6·FFM.
 * @param {{ kg?: unknown, bodyFatPct?: unknown }} [input]
 * @returns {{ kcal: number, ffmKg: number } | Invalid}
 */
export function bmrKatch({ kg, bodyFatPct } = {}) {
  if (!within(kg, LIMITS.kg)) return { error: "kg" };
  if (!within(bodyFatPct, LIMITS.bodyFatPct)) return { error: "bodyFatPct" };
  const ffmKg = kg * (1 - bodyFatPct / 100);
  return { kcal: 370 + 21.6 * ffmKg, ffmKg };
}

/**
 * Total daily energy expenditure: BMR × activity multiplier.
 * @param {number | { kcal: number } | Invalid | null | undefined} bmr
 * @param {ActivityKey | string | null | undefined} activity
 * @returns {{ kcal: number, factor: number } | Invalid}
 */
export function tdee(bmr, activity) {
  const kcal = kcalOf(bmr);
  if (!within(kcal, [500, 5000])) return { error: "bmr" };
  const level = ACTIVITY.find((a) => a.key === activity);
  if (!level) return { error: "activity" };
  return { kcal: kcal * level.factor, factor: level.factor };
}

/**
 * @typedef {{ meals: number, min: number, max: number, target: number, floor: number, short: boolean }} PerMeal
 * @typedef {{
 *   min: number, max: number, target: number,
 *   perKg: { min: number, max: number, target: number },
 *   perKgLean: { min: number, max: number, target: number } | null,
 *   basis: "bodyweight" | "lean-mass", ffmKg: number | null, capped: boolean,
 *   perMeal: (meals: number) => PerMeal | Invalid
 * }} ProteinTarget
 */

/**
 * Daily protein (g) for a goal: the goal's g/kg bodyweight band and target, or — when body fat is known and the goal
 * has one — the g/kg fat-free-mass band (higher for lean people), capped at 2.6 g/kg bodyweight.
 * `perMeal(n)` splits the day into n meals and flags meals under the 0.4 g/kg (≥ 30 g) per-meal floor.
 * @param {{ kg?: unknown, bodyFatPct?: unknown, goal?: unknown }} [input]
 * @returns {ProteinTarget | Invalid}
 */
export function proteinTarget({ kg, bodyFatPct, goal } = {}) {
  if (!within(kg, LIMITS.kg)) return { error: "kg" };
  const rule = ruleOf(goal);
  if (!rule) return { error: "goal" };
  if (bodyFatPct != null && !within(bodyFatPct, LIMITS.bodyFatPct)) return { error: "bodyFatPct" };
  const p = rule.protein;
  const lean = isNum(bodyFatPct) && p.ffm ? p.ffm : null;
  const ffmKg = isNum(bodyFatPct) ? kg * (1 - bodyFatPct / 100) : null;
  const cap = DAILY.proteinCapGPerKg * kg;
  /** @param {number} gPerKg */
  const grams = (gPerKg) => Math.round(lean && ffmKg ? Math.min(gPerKg * ffmKg, cap) : gPerKg * kg);
  const [lo, hi] = lean ? lean.gPerKg : p.gPerKg;
  const min = grams(lo);
  const max = grams(hi);
  const target = grams(lean ? lean.target : p.target);
  /** @param {number} g */
  const perKg = (g) => Math.round((g / kg) * 100) / 100;
  /** @param {number} g */
  const perLean = (g) => Math.round((g / /** @type {number} */ (ffmKg)) * 100) / 100;
  const floor = Math.max(DAILY.perMeal.minG, Math.round(DAILY.perMeal.gPerKg * kg));
  return {
    min,
    max,
    target,
    perKg: { min: perKg(min), max: perKg(max), target: perKg(target) },
    perKgLean: lean && ffmKg ? { min: perLean(min), max: perLean(max), target: perLean(target) } : null,
    basis: lean ? "lean-mass" : "bodyweight",
    ffmKg: lean ? ffmKg : null,
    capped: Boolean(lean && ffmKg && hi * ffmKg > cap),
    perMeal(meals) {
      if (!Number.isInteger(meals) || !within(meals, LIMITS.meals)) return { error: "meals" };
      /** @param {number} g */
      const each = (g) => Math.round(g / meals);
      return { meals, min: each(min), max: each(max), target: each(target), floor, short: target / meals < floor };
    },
  };
}

/**
 * @typedef {"pace-above-recommended" | "deficit-over-max-kcal" | "deficit-over-max-pct" | "below-bmr"} EnergyWarning
 * @typedef {{
 *   kcal: number, deltaKcal: number, deltaPctTdee: number, weeklyChangeKg: number, weeklyChangePct: number,
 *   ratePctPerWeek: number, direction: Direction, warnings: EnergyWarning[]
 * }} EnergyTarget
 */

/**
 * Daily intake for a goal. Loss/gain goals take a pace in % of bodyweight per week (the goal's slider range; default
 * from the goal) and convert it with 7,700 kcal/kg lost or 5,500 kcal/kg gained (Hall 2008). Maintenance goals eat
 * at TDEE. Limits produce warnings, never silent clamps.
 * @param {{ tdee?: number | { kcal: number } | Invalid | null, goal?: unknown, kg?: unknown, ratePctPerWeek?: unknown, bmr?: number | { kcal: number } | null }} [input]
 * @returns {EnergyTarget | Invalid}
 */
export function energyTarget({ tdee: total, goal, kg, ratePctPerWeek, bmr } = {}) {
  const tdeeKcal = kcalOf(total);
  if (!within(tdeeKcal, LIMITS.kcal)) return { error: "tdee" };
  const rule = ruleOf(goal);
  if (!rule) return { error: "goal" };
  if (!within(kg, LIMITS.kg)) return { error: "kg" };
  const { direction, rate } = rule.energy;
  const bmrKcal = kcalOf(bmr);
  if (direction === "maintain" || !rate) {
    const kcal = Math.round(tdeeKcal);
    /** @type {EnergyWarning[]} */
    const warnings = isNum(bmrKcal) && kcal < bmrKcal ? ["below-bmr"] : [];
    return { kcal, deltaKcal: 0, deltaPctTdee: 0, weeklyChangeKg: 0, weeklyChangePct: 0, ratePctPerWeek: 0, direction: "maintain", warnings };
  }
  const pace = ratePctPerWeek ?? rate.default;
  if (!within(pace, [rate.min, rate.max])) return { error: "ratePctPerWeek" };
  const sign = direction === "loss" ? -1 : 1;
  const weeklyChangeKg = (sign * pace * kg) / 100;
  const kcalPerKg = direction === "loss" ? ENERGY.kcalPerKgLoss : ENERGY.kcalPerKgGain;
  const deltaKcal = Math.round((weeklyChangeKg * kcalPerKg) / 7);
  const kcal = Math.round(tdeeKcal) + deltaKcal;
  /** @type {EnergyWarning[]} */
  const warnings = [];
  if (pace > rate.recommended[1] + 1e-9) warnings.push("pace-above-recommended");
  if (direction === "loss" && isNum(rule.energy.maxDeficitKcal) && -deltaKcal > rule.energy.maxDeficitKcal) warnings.push("deficit-over-max-kcal");
  if (direction === "loss" && isNum(rule.energy.maxDeficitPctTdee) && -deltaKcal > (tdeeKcal * rule.energy.maxDeficitPctTdee) / 100) warnings.push("deficit-over-max-pct");
  if (isNum(bmrKcal) && kcal < bmrKcal) warnings.push("below-bmr");
  return {
    kcal,
    deltaKcal,
    deltaPctTdee: (deltaKcal / tdeeKcal) * 100,
    weeklyChangeKg,
    weeklyChangePct: sign * pace,
    ratePctPerWeek: pace,
    direction,
    warnings,
  };
}

/**
 * @typedef {{ weeks: number, dietWeeks: number, breakWeeks: number, totalWeeks: number, direction: Direction }} Timeline
 */

/**
 * Weeks from `kg` to `targetKg` at `weeklyChangeKg` (signed). `weeks` is the straight division; for weight loss
 * `dietWeeks` adds 10 % for adaptive thermogenesis and `breakWeeks` one maintenance week per 7 diet weeks
 * (research 06 §3.8/3.10), `totalWeeks` = both. Errors: "weeklyChangeKg" (no change planned), "direction" (the plan
 * moves away from the target).
 * @param {{ kg?: unknown, targetKg?: unknown, weeklyChangeKg?: unknown }} [input]
 * @returns {Timeline | Invalid}
 */
export function weeksToGoal({ kg, targetKg, weeklyChangeKg } = {}) {
  if (!within(kg, LIMITS.kg)) return { error: "kg" };
  if (!within(targetKg, LIMITS.kg)) return { error: "targetKg" };
  if (!isNum(weeklyChangeKg)) return { error: "weeklyChangeKg" };
  const diff = targetKg - kg;
  if (Math.abs(diff) < 0.05) return { weeks: 0, dietWeeks: 0, breakWeeks: 0, totalWeeks: 0, direction: "maintain" };
  if (weeklyChangeKg === 0) return { error: "weeklyChangeKg" };
  if (Math.sign(diff) !== Math.sign(weeklyChangeKg)) return { error: "direction" };
  const weeks = diff / weeklyChangeKg;
  if (diff > 0) return { weeks, dietWeeks: weeks, breakWeeks: 0, totalWeeks: weeks, direction: "gain" };
  const dietWeeks = weeks * ENERGY.adaptationFactor;
  const breakWeeks = Math.floor(dietWeeks / ENERGY.dietBreakEveryWeeks);
  return { weeks, dietWeeks, breakWeeks, totalWeeks: dietWeeks + breakWeeks, direction: "loss" };
}

/** Fibre target (g): 14 g per 1,000 kcal, at least 25 g, at most 50 g. @param {number} kcal */
export const fibreTarget = (kcal) => clamp(Math.round((DAILY.fibre.gPer1000Kcal * kcal) / 1000), DAILY.fibre.minG, DAILY.fibre.maxG);

/**
 * @typedef {{ g: number, kcal: number, pct: number }} MacroPart
 * @typedef {"carbs-below-floor" | "over-budget"} MacroWarning
 * @typedef {{
 *   protein: MacroPart, fat: MacroPart, carbs: MacroPart, fatFloorG: number, carbFloorG: number, fibreG: number,
 *   fatLowered: boolean, warnings: MacroWarning[]
 * }} Macros
 */

/**
 * Splits a day's kcal: protein first (as given), fat 0.8 g/kg within [max(0.5 g/kg, 20 % kcal), 40 % kcal],
 * carbohydrate fills the rest. When carbs fall under the goal's floor, fat is lowered toward 0.6 g/kg (never under its
 * floor) just enough to restore them; if that is not enough the result warns ("carbs-below-floor"), and if protein +
 * fat floor exceed the kcal, carbs are 0 with "over-budget".
 * @param {{ kcal?: unknown, proteinG?: unknown, kg?: unknown, goal?: unknown }} [input]
 * @returns {Macros | Invalid}
 */
export function macroSplit({ kcal, proteinG, kg, goal } = {}) {
  if (!within(kcal, LIMITS.intakeKcal)) return { error: "kcal" };
  if (!within(proteinG, LIMITS.proteinG)) return { error: "proteinG" };
  if (!within(kg, LIMITS.kg)) return { error: "kg" };
  const rule = ruleOf(goal);
  if (!rule) return { error: "goal" };
  const { fat: F, kcalPerG: K } = DAILY;
  const fatFloorG = Math.max(rule.fatFloorGPerKg * kg, ((F.floorPctKcal / 100) * kcal) / K.fat);
  const fatCeilG = Math.max(fatFloorG, ((F.ceilingPctKcal / 100) * kcal) / K.fat);
  const carbFloorG = rule.carbFloorGPerKg * kg;
  /** @param {number} fatG */
  const carbsFor = (fatG) => (kcal - K.protein * proteinG - K.fat * fatG) / K.carbs;
  const defaultFatG = clamp(F.defaultGPerKg * kg, fatFloorG, fatCeilG);
  let fatG = defaultFatG;
  let carbsG = carbsFor(fatG);
  // A gram or two under the floor is noise: act (and warn) only on a real shortfall.
  if (carbsG < carbFloorG - 1) {
    const lowest = Math.max(fatFloorG, F.lowerToGPerKg * kg);
    if (lowest < fatG) {
      const fatForFloor = (kcal - K.protein * proteinG - K.carbs * carbFloorG) / K.fat;
      fatG = Math.max(lowest, Math.min(fatG, fatForFloor));
      carbsG = carbsFor(fatG);
    }
  }
  const fatLowered = fatG < defaultFatG - 0.5;
  /** @type {MacroWarning[]} */
  const warnings = [];
  if (carbsG < 0) {
    warnings.push("over-budget");
    carbsG = 0;
  } else if (carbsG < carbFloorG - 1) warnings.push("carbs-below-floor");
  /** @param {number} g @param {number} perG @returns {MacroPart} */
  const part = (g, perG) => ({ g: Math.round(g), kcal: Math.round(g * perG), pct: Math.round(((g * perG) / kcal) * 100) });
  return {
    protein: part(proteinG, K.protein),
    fat: part(fatG, K.fat),
    carbs: part(carbsG, K.carbs),
    fatFloorG: Math.round(fatFloorG),
    carbFloorG: Math.round(carbFloorG),
    fibreG: fibreTarget(kcal),
    fatLowered,
    warnings,
  };
}

/**
 * Creatine, caffeine and water for a bodyweight (kg). Caffeine is rounded to 10 mg and capped at 400 mg/day.
 * @param {number} kg
 */
export function dailyExtras(kg) {
  const { creatine, caffeine, hydration } = DAILY;
  /** @param {number} mg */
  const mg10 = (mg) => Math.min(caffeine.maxMgPerDay, Math.round(mg / 10) * 10);
  return {
    creatineG: /** @type {[number, number]} */ (kg > 90 ? [creatine.gPerDayAbove90Kg, creatine.gPerDayAbove90Kg] : creatine.gPerDay),
    caffeineMg: /** @type {[number, number]} */ ([mg10(caffeine.mgPerKg[0] * kg), mg10(caffeine.mgPerKg[1] * kg)]),
    caffeineStartMg: /** @type {[number, number]} */ ([mg10(caffeine.startMgPerKg[0] * kg), mg10(caffeine.startMgPerKg[1] * kg)]),
    caffeineMaxMg: caffeine.maxMgPerDay,
    waterL: Math.round((hydration.mlPerKgPerDay * kg) / 100) / 10,
    extraWaterPerHourL: /** @type {[number, number]} */ (hydration.extraMlPerTrainingHour.map((ml) => ml / 1000)),
  };
}

/**
 * @typedef {{
 *   kg?: unknown, cm?: unknown, age?: unknown, sex?: unknown, bodyFatPct?: unknown, activity?: unknown, goal?: unknown,
 *   ratePctPerWeek?: unknown, meals?: unknown, targetKg?: unknown
 * }} PlanInput
 * @typedef {{
 *   bmr: { mifflin: number, katch: number | null, kcal: number, ffmKg: number | null },
 *   tdee: { kcal: number, factor: number }, energy: EnergyTarget, protein: ProteinTarget, perMeal: PerMeal,
 *   macros: Macros, timeline: Timeline | Invalid | null, extras: ReturnType<typeof dailyExtras>,
 *   warnings: (EnergyWarning | MacroWarning)[]
 * }} NutritionPlan
 */

/**
 * Everything the calculator shows, from one input object. BMR is Mifflin–St Jeor, or the mean of Mifflin and
 * Katch–McArdle when body fat is given (research 06 §3.10). `targetKg` is optional (timeline null without it).
 * @param {PlanInput} [input]
 * @returns {NutritionPlan | Invalid}
 */
export function nutritionPlan(input = {}) {
  const { kg, cm, age, sex, activity, goal } = input;
  const bodyFatPct = input.bodyFatPct ?? null;
  const mifflin = bmrMifflin({ kg, cm, age, sex });
  if ("error" in mifflin) return mifflin;
  const katch = bodyFatPct == null ? null : bmrKatch({ kg, bodyFatPct });
  if (katch && "error" in katch) return katch;
  const bmrKcal = katch ? (mifflin.kcal + katch.kcal) / 2 : mifflin.kcal;
  const total = tdee(bmrKcal, /** @type {string} */ (activity));
  if ("error" in total) return total;
  const energy = energyTarget({ tdee: total, goal, kg, ratePctPerWeek: input.ratePctPerWeek, bmr: bmrKcal });
  if ("error" in energy) return energy;
  const protein = proteinTarget({ kg, bodyFatPct, goal });
  if ("error" in protein) return protein;
  const perMeal = protein.perMeal(/** @type {number} */ (input.meals ?? DAILY.perMeal.defaultMeals));
  if ("error" in perMeal) return perMeal;
  const macros = macroSplit({ kcal: energy.kcal, proteinG: protein.target, kg, goal });
  if ("error" in macros) return macros;
  const timeline = input.targetKg == null ? null : weeksToGoal({ kg, targetKg: input.targetKg, weeklyChangeKg: energy.weeklyChangeKg });
  const weight = /** @type {number} */ (kg);
  return {
    bmr: { mifflin: mifflin.kcal, katch: katch ? katch.kcal : null, kcal: bmrKcal, ffmKg: katch ? katch.ffmKg : null },
    tdee: total,
    energy,
    protein,
    perMeal,
    macros,
    timeline,
    extras: dailyExtras(weight),
    warnings: [...energy.warnings, ...macros.warnings],
  };
}

/* ------------------------------------------------------------------ heart rate and VO2max */

/** Age-predicted maximum heart rate, Tanaka 2001: 208 − 0.7 × age. @param {unknown} age @returns {{ hrMax: number } | Invalid} */
export function hrMaxTanaka(age) {
  if (!within(age, LIMITS.age)) return { error: "age" };
  return { hrMax: 208 - 0.7 * age };
}

/**
 * Five Karvonen zones (% of heart-rate reserve: 50/60/70/80/90–100), bpm rounded. Uses a measured `hrMax` when given,
 * else Tanaka from `age`. A reserve under 30 bpm cannot be split into zones ("hrMax").
 * @param {{ age?: unknown, hrRest?: unknown, hrMax?: unknown }} [input]
 * @returns {HrZones | Invalid}
 */
export function hrZones({ age, hrRest, hrMax } = {}) {
  let max;
  const measured = hrMax != null;
  if (measured) {
    if (!within(hrMax, LIMITS.hrMax)) return { error: "hrMax" };
    max = hrMax;
  } else {
    const predicted = hrMaxTanaka(age);
    if ("error" in predicted) return predicted;
    max = predicted.hrMax;
  }
  if (!within(hrRest, LIMITS.hrRest)) return { error: "hrRest" };
  const reserve = max - hrRest;
  if (reserve < 30) return { error: "hrMax" };
  /** @param {number} pct */
  const at = (pct) => Math.round(hrRest + (pct / 100) * reserve);
  return { hrMax: max, hrRest, reserve, measured, zones: ZONES.map((z) => ({ zone: z.zone, pct: z.pct, from: at(z.pct[0]), to: at(z.pct[1]) })) };
}

/**
 * The zone-2 range to train in (research 05, Table 3). With a talk-test ceiling (the heart rate of the last stage
 * where speaking was still comfortable): ceiling − 10 bpm to the ceiling. Without one: the lower part of Karvonen
 * zone 2 (60–65 % of reserve), because the first threshold sits anywhere from 60 to 90 % of HRmax between people.
 * A ceiling must leave the range above resting HR and stay below the maximum ("ceiling").
 * @param {HrZones | Invalid | null | undefined} zones result of `hrZones`
 * @param {unknown} [ceiling] bpm
 * @returns {{ from: number, to: number, basis: "talk-test" | "start" } | Invalid}
 */
export function zone2Range(zones, ceiling) {
  if (!zones || "error" in zones) return { error: "zones" };
  const Z = HEART.zone2;
  if (ceiling != null) {
    if (!within(ceiling, LIMITS.hr)) return { error: "ceiling" };
    const top = Math.round(ceiling);
    if (top - Z.bandBelowCeilingBpm <= zones.hrRest || top >= zones.hrMax) return { error: "ceiling" };
    return { from: top - Z.bandBelowCeilingBpm, to: top, basis: "talk-test" };
  }
  /** @param {number} pct */
  const at = (pct) => Math.round(zones.hrRest + (pct / 100) * zones.reserve);
  return { from: at(Z.startPctHrr[0]), to: at(Z.startPctHrr[1]), basis: "start" };
}

/**
 * The zone a heart rate falls in: 0 below zone 1, the higher zone on a shared boundary, 5 at or above the top.
 * @param {unknown} hr
 * @param {Zone[] | { zones: Zone[] } | Invalid | null | undefined} zones
 * @returns {{ zone: number } | Invalid}
 */
export function zoneOf(hr, zones) {
  const list = Array.isArray(zones) ? zones : zones && "zones" in zones ? zones.zones : null;
  if (!list || !list.length) return { error: "zones" };
  if (!within(hr, LIMITS.hr)) return { error: "hr" };
  let zone = 0;
  for (const z of list) if (hr >= z.from) zone = z.zone;
  return { zone };
}

/**
 * VO2max (ml/kg/min) from the distance covered in a 12-minute run, Cooper 1968: (d − 504.9) / 44.73.
 * @param {unknown} metres
 * @returns {{ vo2max: number, mets: number } | Invalid}
 */
export function vo2maxCooper(metres) {
  if (!within(metres, [HEART.cooper.minMetres, HEART.cooper.maxMetres])) return { error: "metres" };
  const vo2max = (metres - 504.9) / 44.73;
  return { vo2max, mets: vo2max / HEART.mlPerMet };
}

/**
 * VO2max (ml/kg/min) from the heart-rate ratio, Uth 2004: 15.3 × HRmax / HRrest (derived in well-trained men).
 * @param {unknown} hrMax
 * @param {unknown} hrRest
 * @returns {{ vo2max: number, mets: number } | Invalid}
 */
export function vo2maxUth(hrMax, hrRest) {
  if (!within(hrMax, LIMITS.hrMax)) return { error: "hrMax" };
  if (!within(hrRest, LIMITS.hrRest)) return { error: "hrRest" };
  if (hrMax <= hrRest) return { error: "hrMax" };
  const vo2max = (15.3 * hrMax) / hrRest;
  return { vo2max, mets: vo2max / HEART.mlPerMet };
}

/* ------------------------------------------------------------------ food table */

/** Lower case, Latin diacritics removed (köfte → kofte, çorbası → corbasi), ё → е; Cyrillic й kept. @param {string} s */
export const foldText = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/([a-z])[̀-ͯ]+/g, "$1")
    .normalize("NFC")
    .replace(/ı/g, "i")
    .replace(/ё/g, "е");

/** True when every word of `query` appears in the food's English or Russian name or id. @param {Food} food @param {string} query */
export function matchesFood(food, query) {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = foldText(`${food.name.en} ${food.name.ru} ${food.id}`);
  return words.every((w) => hay.includes(w));
}

/** @type {Record<FoodSort, (f: Food) => number>} */
const FOOD_METRIC = {
  per100kcal: (f) => f.proteinPer100kcal,
  per100g: (f) => f.per100.protein,
  perServing: (f) => f.serving.protein,
};

/** Foods by protein, highest first (per 100 kcal, per 100 g or per serving); a new array. @param {Food[]} foods @param {FoodSort} [key] */
export function sortFoods(foods, key = "per100kcal") {
  const metric = FOOD_METRIC[key] ?? FOOD_METRIC.per100kcal;
  return [...foods].sort((a, b) => metric(b) - metric(a) || a.id.localeCompare(b.id));
}
