// Stream 09 — nutrition calculators, heart-rate zones, VO2max estimators and the nutrition.json content.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ACTIVITY,
  ACTIVITY_KEYS,
  CUISINES,
  DAILY,
  FOODS,
  FOOD_GROUPS,
  GOALS,
  GOAL_KEYS,
  NUTRITION,
  RULES,
  SOURCES,
  ZONES,
  ageFromBirthYear,
  bmrKatch,
  bmrMifflin,
  dailyExtras,
  energyTarget,
  fibreTarget,
  foldText,
  goalRule,
  hrMaxTanaka,
  hrZones,
  macroSplit,
  matchesFood,
  nutritionPlan,
  proteinTarget,
  sortFoods,
  sourceNumber,
  tdee,
  vo2maxCooper,
  vo2maxUth,
  weeksToGoal,
  zone2Range,
  zoneOf,
} from "../../src/lib/fitness/nutrition.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const close = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ""} expected ${expected} ± ${tol}, got ${actual}`);
/** Unwraps a successful result (fails the test on { error }). */
const ok = (r) => {
  assert.ok(r && !("error" in r), `unexpected error: ${JSON.stringify(r)}`);
  return r;
};
const MAN = { kg: 80, cm: 180, age: 35, sex: "male" };

describe("BMR", () => {
  it("Mifflin–St Jeor as published: 80 kg / 180 cm / 35 y male = 1755 kcal (1780 is the age-30 value)", () => {
    assert.equal(ok(bmrMifflin(MAN)).kcal, 1755);
    assert.equal(ok(bmrMifflin({ ...MAN, age: 30 })).kcal, 1780);
    assert.equal(ok(bmrMifflin({ kg: 60, cm: 165, age: 30, sex: "female" })).kcal, 1320.25);
  });

  it("Katch–McArdle from fat-free mass", () => {
    const r = ok(bmrKatch({ kg: 80, bodyFatPct: 20 }));
    assert.equal(r.ffmKg, 64);
    close(r.kcal, 1752.4, 1e-9);
  });

  it("rejects missing, non-numeric and out-of-range inputs", () => {
    for (const kg of [undefined, null, NaN, Infinity, "80", 29.9, 250.1]) assert.deepEqual(bmrMifflin({ ...MAN, kg }), { error: "kg" });
    for (const cm of [undefined, 119, 231]) assert.deepEqual(bmrMifflin({ ...MAN, cm }), { error: "cm" });
    for (const age of [undefined, 14, 91]) assert.deepEqual(bmrMifflin({ ...MAN, age }), { error: "age" });
    for (const sex of [undefined, "", "other", "M"]) assert.deepEqual(bmrMifflin({ ...MAN, sex }), { error: "sex" });
    assert.deepEqual(bmrMifflin(), { error: "kg" });
    for (const bodyFatPct of [undefined, 2, 61, NaN]) assert.deepEqual(bmrKatch({ kg: 80, bodyFatPct }), { error: "bodyFatPct" });
  });
});

describe("TDEE", () => {
  it("multiplies BMR by the activity level and accepts a BMR result object", () => {
    assert.deepEqual(ACTIVITY_KEYS, ["sedentary", "light", "moderate", "active", "very"]);
    assert.deepEqual(ACTIVITY.map((a) => a.factor), [1.2, 1.375, 1.55, 1.725, 1.9]);
    close(ok(tdee(1755, "moderate")).kcal, 2720.25, 1e-9);
    assert.equal(ok(tdee({ kcal: 1755 }, "light")).factor, 1.375);
  });

  it("rejects a bad BMR or an unknown activity", () => {
    assert.deepEqual(tdee({ error: "kg" }, "light"), { error: "bmr" });
    assert.deepEqual(tdee(NaN, "light"), { error: "bmr" });
    assert.deepEqual(tdee(1755, "couch"), { error: "activity" });
  });
});

describe("protein", () => {
  it("recomp 80 kg without body fat: 128–176 g (1.6–2.2 g/kg), target at the top", () => {
    const p = ok(proteinTarget({ kg: 80, goal: "recomp" }));
    assert.deepEqual([p.min, p.max, p.target], [128, 176, 176]);
    assert.deepEqual(p.perKg, { min: 1.6, max: 2.2, target: 2.2 });
    assert.equal(p.basis, "bodyweight");
    assert.equal(p.ffmKg, null);
  });

  it("splits per meal and flags meals under the 0.4 g/kg (≥ 30 g) floor", () => {
    const p = ok(proteinTarget({ kg: 80, goal: "recomp" }));
    assert.deepEqual(ok(p.perMeal(4)), { meals: 4, min: 32, max: 44, target: 44, floor: 32, short: false });
    assert.equal(ok(p.perMeal(3)).target, 59);
    assert.equal(ok(p.perMeal(6)).short, true);
    assert.equal(ok(ok(proteinTarget({ kg: 60, goal: "recomp" })).perMeal(4)).floor, 30, "minimum 30 g per meal");
    for (const meals of [1, 7, 2.5, NaN, undefined]) assert.deepEqual(p.perMeal(meals), { error: "meals" });
  });

  it("switches to the lean-mass basis when body fat is known, capped at 2.6 g/kg bodyweight", () => {
    const lean = ok(proteinTarget({ kg: 80, bodyFatPct: 20, goal: "recomp" }));
    assert.equal(lean.basis, "lean-mass");
    assert.equal(lean.ffmKg, 64);
    assert.deepEqual([lean.min, lean.max, lean.target], [160, 198, 179]);
    assert.equal(lean.perKgLean?.target, 2.8);
    const veryLean = ok(proteinTarget({ kg: 80, bodyFatPct: 5, goal: "recomp" }));
    assert.equal(veryLean.max, 208);
    assert.equal(veryLean.capped, true);
    const heavy = ok(proteinTarget({ kg: 120, bodyFatPct: 35, goal: "recomp" }));
    assert.ok(heavy.target < 2.2 * 120, "lean-mass basis avoids overshooting at high body fat");
  });

  it("uses each goal's band; endurance stays on bodyweight even with body fat", () => {
    const end = ok(proteinTarget({ kg: 80, bodyFatPct: 15, goal: "endurance" }));
    assert.equal(end.basis, "bodyweight");
    assert.deepEqual([end.min, end.max, end.target], [112, 160, 128]);
    assert.deepEqual([ok(proteinTarget({ kg: 80, goal: "maintenance" })).min, ok(proteinTarget({ kg: 80, goal: "maintenance" })).target], [144, 160]);
    assert.equal(ok(proteinTarget({ kg: 80, goal: "hypertrophy" })).target, 144);
    assert.equal(ok(proteinTarget({ kg: 80, goal: "strength" })).target, 144);
  });

  it("rejects bad inputs", () => {
    assert.deepEqual(proteinTarget({ kg: 80, goal: "bulk" }), { error: "goal" });
    assert.deepEqual(proteinTarget({ goal: "recomp" }), { error: "kg" });
    assert.deepEqual(proteinTarget({ kg: 80, goal: "recomp", bodyFatPct: 70 }), { error: "bodyFatPct" });
  });
});

describe("energy target", () => {
  const T = 2413.125; // 1755 × 1.375

  it("recomp: the pace slider sets the deficit (7,700 kcal per kg lost)", () => {
    const e = ok(energyTarget({ tdee: T, goal: "recomp", kg: 80 }));
    assert.equal(e.ratePctPerWeek, 0.5, "default pace");
    assert.equal(e.deltaKcal, -440);
    assert.equal(e.kcal, 1973);
    assert.equal(e.weeklyChangeKg, -0.4);
    assert.equal(e.weeklyChangePct, -0.5);
    assert.equal(e.direction, "loss");
    assert.deepEqual(e.warnings, []);
    close(e.deltaPctTdee, -18.23, 0.01);
  });

  it("warns instead of clamping: fast pace, deficit over 500 kcal and over 25 % of TDEE, below BMR", () => {
    const fast = ok(energyTarget({ tdee: T, goal: "recomp", kg: 80, ratePctPerWeek: 1 }));
    assert.equal(fast.deltaKcal, -880);
    assert.deepEqual(fast.warnings, ["pace-above-recommended", "deficit-over-max-kcal", "deficit-over-max-pct"]);
    const small = ok(energyTarget({ tdee: 1600, goal: "recomp", kg: 60, ratePctPerWeek: 1, bmr: 1300 }));
    assert.ok(small.warnings.includes("below-bmr"));
    assert.deepEqual(ok(energyTarget({ tdee: T, goal: "recomp", kg: 80, ratePctPerWeek: 0.6 })).warnings, ["deficit-over-max-kcal"], "528 kcal: over 500, under 25 %");
    assert.deepEqual(ok(energyTarget({ tdee: T, goal: "recomp", kg: 80, ratePctPerWeek: 0.75 })).warnings, ["deficit-over-max-kcal", "deficit-over-max-pct"]);
  });

  it("gain goals use 5,500 kcal per kg; maintenance goals eat at TDEE", () => {
    const hyp = ok(energyTarget({ tdee: T, goal: "hypertrophy", kg: 80 }));
    assert.deepEqual([hyp.ratePctPerWeek, hyp.weeklyChangeKg, hyp.deltaKcal, hyp.kcal], [0.25, 0.2, 157, 2570]);
    const str = ok(energyTarget({ tdee: T, goal: "strength", kg: 80 }));
    assert.deepEqual([str.ratePctPerWeek, str.deltaKcal], [0.1, 63]);
    assert.deepEqual(ok(energyTarget({ tdee: T, goal: "hypertrophy", kg: 80, ratePctPerWeek: 0.4 })).warnings, ["pace-above-recommended"]);
    for (const goal of ["maintenance", "endurance"]) {
      const m = ok(energyTarget({ tdee: T, goal, kg: 80, ratePctPerWeek: 0.5 }));
      assert.deepEqual([m.kcal, m.deltaKcal, m.weeklyChangeKg, m.direction], [2413, 0, 0, "maintain"]);
    }
  });

  it("rejects paces outside the goal's slider and other bad inputs", () => {
    for (const ratePctPerWeek of [0.2, 1.05, NaN, "0.5"]) assert.deepEqual(energyTarget({ tdee: T, goal: "recomp", kg: 80, ratePctPerWeek }), { error: "ratePctPerWeek" });
    assert.deepEqual(energyTarget({ tdee: T, goal: "hypertrophy", kg: 80, ratePctPerWeek: 0.55 }), { error: "ratePctPerWeek" });
    assert.deepEqual(energyTarget({ tdee: T, goal: "cut", kg: 80 }), { error: "goal" });
    assert.deepEqual(energyTarget({ tdee: T, goal: "recomp" }), { error: "kg" });
    assert.deepEqual(energyTarget({ tdee: { error: "bmr" }, goal: "recomp", kg: 80 }), { error: "tdee" });
  });
});

describe("weeks to goal", () => {
  it("research 06 worked example: 85 → 78 kg at −0.47 kg/week ≈ 15 weeks static, ≈ 18.4 with adaptation and 2 breaks", () => {
    const t = ok(weeksToGoal({ kg: 85, targetKg: 78, weeklyChangeKg: -0.47 }));
    close(t.weeks, 14.89, 0.01);
    close(t.dietWeeks, 16.38, 0.01);
    assert.equal(t.breakWeeks, 2);
    close(t.totalWeeks, 18.38, 0.01);
    assert.equal(t.direction, "loss");
  });

  it("gaining has no adaptation factor or breaks; same weight is zero weeks", () => {
    assert.deepEqual(ok(weeksToGoal({ kg: 80, targetKg: 82, weeklyChangeKg: 0.2 })), { weeks: 10, dietWeeks: 10, breakWeeks: 0, totalWeeks: 10, direction: "gain" });
    assert.equal(ok(weeksToGoal({ kg: 80, targetKg: 80, weeklyChangeKg: -0.4 })).weeks, 0);
  });

  it("refuses a plan that moves away from the target or does not move", () => {
    assert.deepEqual(weeksToGoal({ kg: 80, targetKg: 85, weeklyChangeKg: -0.4 }), { error: "direction" });
    assert.deepEqual(weeksToGoal({ kg: 80, targetKg: 75, weeklyChangeKg: 0 }), { error: "weeklyChangeKg" });
    assert.deepEqual(weeksToGoal({ kg: 80, targetKg: 20, weeklyChangeKg: -0.4 }), { error: "targetKg" });
    assert.deepEqual(weeksToGoal({ kg: 80, targetKg: 75 }), { error: "weeklyChangeKg" });
  });
});

describe("macro split", () => {
  it("research 06 worked example: 2,077 kcal, 187 g protein, 85 kg → fat 68 g, carbs 179 g", () => {
    const m = ok(macroSplit({ kcal: 2077, proteinG: 187, kg: 85, goal: "recomp" }));
    assert.deepEqual([m.protein.g, m.fat.g, m.carbs.g], [187, 68, 179]);
    assert.equal(m.fatLowered, false);
    assert.deepEqual(m.warnings, []);
    assert.equal(m.fibreG, 29);
    close(m.protein.kcal + m.fat.kcal + m.carbs.kcal, 2077, 3);
  });

  it("keeps fat at or above its floor: max(0.5 g/kg, 20 % of kcal)", () => {
    const hi = ok(macroSplit({ kcal: 4000, proteinG: 160, kg: 80, goal: "hypertrophy" }));
    assert.equal(hi.fatFloorG, 89, "20 % of 4,000 kcal");
    assert.ok(hi.fat.g >= hi.fatFloorG);
    assert.ok(hi.fat.pct <= 40);
  });

  it("lowers fat toward 0.6 g/kg before giving up carbs, then warns", () => {
    const m = ok(macroSplit({ kcal: 1800, proteinG: 180, kg: 80, goal: "hypertrophy" }));
    assert.equal(m.fatLowered, true);
    assert.equal(m.fat.g, 48);
    assert.equal(m.carbs.g, 162);
    assert.deepEqual(m.warnings, ["carbs-below-floor"]);
    const enough = ok(macroSplit({ kcal: 2600, proteinG: 160, kg: 80, goal: "recomp" }));
    assert.equal(enough.fatLowered, false);
    const partial = ok(macroSplit({ kcal: 2050, proteinG: 176, kg: 80, goal: "strength" }));
    assert.equal(partial.fatLowered, true);
    assert.ok(partial.fat.g >= 48 && partial.fat.g < 64);
  });

  it("ignores a shortfall of a gram or so under the carb floor (no fat trim, no warning)", () => {
    const m = ok(macroSplit({ kcal: 2015, proteinG: 185, kg: 84, goal: "recomp" }));
    assert.equal(m.fatLowered, false);
    assert.deepEqual(m.warnings, []);
    assert.equal(m.fat.g, 67);
  });

  it("over budget: protein and the fat floor exceed the calories → carbs 0", () => {
    const m = ok(macroSplit({ kcal: 1000, proteinG: 250, kg: 80, goal: "recomp" }));
    assert.equal(m.carbs.g, 0);
    assert.deepEqual(m.warnings, ["over-budget"]);
  });

  it("fibre: 14 g per 1,000 kcal within 25–50 g; bad inputs rejected", () => {
    assert.deepEqual([fibreTarget(1500), fibreTarget(2000), fibreTarget(4000)], [25, 28, 50]);
    assert.deepEqual(macroSplit({ kcal: 499, proteinG: 100, kg: 80, goal: "recomp" }), { error: "kcal" });
    assert.deepEqual(macroSplit({ kcal: 3000, proteinG: 701, kg: 250, goal: "recomp" }), { error: "proteinG" });
    assert.equal(ok(macroSplit({ kcal: 4500, proteinG: 550, kg: 250, goal: "recomp" })).protein.g, 550, "250 kg on a bodyweight basis still splits");
    assert.deepEqual(macroSplit({ kcal: 2000, proteinG: 0, kg: 80, goal: "recomp" }), { error: "proteinG" });
    assert.deepEqual(macroSplit({ kcal: 2000, proteinG: 150, kg: 80, goal: "?" }), { error: "goal" });
  });
});

describe("daily extras and the full plan", () => {
  it("creatine, caffeine (capped at 400 mg) and water for a bodyweight", () => {
    const x = dailyExtras(80);
    assert.deepEqual(x.creatineG, [3, 5]);
    assert.deepEqual(x.caffeineMg, [240, 400]);
    assert.deepEqual(x.caffeineStartMg, [160, 240]);
    assert.equal(x.waterL, 2.8);
    assert.deepEqual(dailyExtras(95).creatineG, [5, 5]);
  });

  it("nutritionPlan combines every step; body fat averages Mifflin and Katch–McArdle", () => {
    const plan = ok(nutritionPlan({ ...MAN, activity: "light", goal: "recomp", targetKg: 75 }));
    assert.equal(plan.bmr.kcal, 1755);
    assert.equal(plan.energy.kcal, 1973);
    assert.equal(plan.protein.target, 176);
    assert.equal(plan.perMeal.target, 44);
    assert.deepEqual([plan.macros.protein.g, plan.macros.fat.g, plan.macros.carbs.g], [176, 64, 173]);
    assert.equal(ok(plan.timeline).weeks, 12.5);
    const withFat = ok(nutritionPlan({ ...MAN, bodyFatPct: 20, activity: "light", goal: "recomp" }));
    close(withFat.bmr.kcal, (1755 + 1752.4) / 2, 1e-9);
    assert.equal(withFat.protein.basis, "lean-mass");
    assert.equal(withFat.timeline, null);
  });

  it("an aggressive plan for a small person still computes, with warnings instead of an error", () => {
    const small = ok(nutritionPlan({ kg: 42, cm: 150, age: 70, sex: "female", activity: "sedentary", goal: "recomp", ratePctPerWeek: 1 }));
    assert.ok(small.energy.kcal < 800);
    assert.ok(small.warnings.includes("below-bmr"));
  });

  it("nutritionPlan passes the first error through", () => {
    assert.deepEqual(nutritionPlan({ ...MAN, sex: undefined, activity: "light", goal: "recomp" }), { error: "sex" });
    assert.deepEqual(nutritionPlan({ ...MAN, activity: "?", goal: "recomp" }), { error: "activity" });
    assert.deepEqual(nutritionPlan({ ...MAN, activity: "light", goal: "recomp", meals: 9 }), { error: "meals" });
    assert.deepEqual(nutritionPlan({ ...MAN, bodyFatPct: 80, activity: "light", goal: "recomp" }), { error: "bodyFatPct" });
    assert.deepEqual(ok(nutritionPlan({ ...MAN, activity: "light", goal: "recomp", targetKg: 90 })).timeline, { error: "direction" });
  });
});

describe("heart rate and VO2max", () => {
  it("Tanaka: 208 − 0.7 × age (35 y = 183.5)", () => {
    assert.deepEqual(hrMaxTanaka(35), { hrMax: 183.5 });
    assert.deepEqual(hrMaxTanaka(14), { error: "age" });
  });

  it("Karvonen zones: contiguous 50/60/70/80/90–100 % of heart-rate reserve", () => {
    const z = ok(hrZones({ age: 35, hrRest: 60 }));
    assert.equal(z.reserve, 123.5);
    assert.equal(z.measured, false);
    assert.deepEqual(z.zones.map((x) => [x.zone, x.from, x.to]), [[1, 122, 134], [2, 134, 146], [3, 146, 159], [4, 159, 171], [5, 171, 184]]);
    for (let i = 1; i < z.zones.length; i++) assert.equal(z.zones[i].from, z.zones[i - 1].to);
    const measured = ok(hrZones({ age: 35, hrRest: 50, hrMax: 190 }));
    assert.equal(measured.measured, true);
    assert.equal(measured.zones[1].from, 134);
    assert.equal(measured.zones[1].to, 148);
  });

  it("zoneOf: 0 below zone 1, the higher zone on a boundary, 5 above the top", () => {
    const z = ok(hrZones({ age: 35, hrRest: 60 }));
    assert.deepEqual([zoneOf(100, z), zoneOf(122, z), zoneOf(134, z), zoneOf(140, z.zones), zoneOf(200, z)].map((r) => ok(r).zone), [0, 1, 2, 2, 5]);
    assert.deepEqual(zoneOf("140", z), { error: "hr" });
    assert.deepEqual(zoneOf(140, { error: "age" }), { error: "zones" });
  });

  it("zone 2 to train in: 60–65 % of reserve until a talk test, then ceiling − 10 bpm to the ceiling (research 05)", () => {
    const z = ok(hrZones({ age: 35, hrRest: 60 }));
    assert.deepEqual(zone2Range(z), { from: 134, to: 140, basis: "start" }, "60.0 % → 134.1, 65 % → 140.3");
    assert.deepEqual(zone2Range(z, 150), { from: 140, to: 150, basis: "talk-test" });
    assert.deepEqual(zone2Range(z, 149.6), { from: 140, to: 150, basis: "talk-test" }, "rounded ceiling");
    assert.deepEqual(zone2Range(z, 71), { from: 61, to: 71, basis: "talk-test" }, "lowest ceiling: band stays above resting");
    assert.deepEqual(zone2Range(z, 183), { from: 173, to: 183, basis: "talk-test" }, "below the 183.5 maximum");
    for (const bad of [70, 184, 300, "150", Number.NaN]) assert.deepEqual(zone2Range(z, bad), { error: "ceiling" }, String(bad));
    assert.deepEqual(zone2Range({ error: "age" }, 150), { error: "zones" });
    assert.deepEqual(zone2Range(null), { error: "zones" });
  });

  it("hrZones rejects bad inputs", () => {
    assert.deepEqual(hrZones({ age: 35 }), { error: "hrRest" });
    assert.deepEqual(hrZones({ hrRest: 60 }), { error: "age" });
    assert.deepEqual(hrZones({ age: 35, hrRest: 60, hrMax: 80 }), { error: "hrMax" });
    assert.deepEqual(hrZones({ age: 35, hrRest: 100, hrMax: 120 }), { error: "hrMax" }, "reserve under 30 bpm");
  });

  it("Cooper 12-minute run: 2,800 m ≈ 51.3 ml/kg/min", () => {
    const c = ok(vo2maxCooper(2800));
    close(c.vo2max, 51.3, 0.05);
    close(c.mets, 14.66, 0.01);
    for (const m of [999, 5001, NaN, "2800", undefined]) assert.deepEqual(vo2maxCooper(m), { error: "metres" });
  });

  it("Uth heart-rate ratio: 15.3 × HRmax / HRrest", () => {
    close(ok(vo2maxUth(183.5, 60)).vo2max, 46.79, 0.01);
    assert.deepEqual(vo2maxUth(183.5, 25), { error: "hrRest" });
    assert.deepEqual(vo2maxUth(99, 60), { error: "hrMax" });
  });
});

describe("helpers", () => {
  it("age from birth year, source numbers, goal fallback", () => {
    assert.equal(ageFromBirthYear(1990, 2026), 36);
    assert.equal(ageFromBirthYear(undefined, 2026), null);
    assert.equal(ageFromBirthYear(2030, 2026), null);
    assert.equal(sourceNumber(SOURCES[0].id), 1);
    assert.equal(sourceNumber("nope"), 0);
    assert.equal(goalRule("nope"), GOALS.recomp);
  });

  it("search folds Turkish/Latin diacritics and case in both languages", () => {
    assert.equal(foldText("Köfte ÇORBASI ılık İyi"), "kofte corbasi ilik iyi");
    assert.equal(foldText("Ёжик и йогурт"), "ежик и йогурт");
    const find = (q) => FOODS.filter((f) => matchesFood(f, q)).map((f) => f.id);
    assert.ok(find("kofte").includes("kofte"));
    assert.ok(find("levrek").includes("sea-bass-grilled"));
    assert.ok(find("ТВОРОГ").includes("tvorog-5"));
    assert.ok(find("mercimek corbasi").includes("mercimek"));
    assert.deepEqual(find("chicken breast").sort(), ["chicken-breast", "chicken-breast-cooked"]);
    assert.equal(find("  ").length, FOODS.length);
  });

  it("sortFoods orders by the chosen protein metric, highest first, without mutating", () => {
    const before = FOODS.map((f) => f.id);
    for (const [key, metric] of [["per100kcal", (f) => f.proteinPer100kcal], ["per100g", (f) => f.per100.protein], ["perServing", (f) => f.serving.protein]]) {
      const sorted = sortFoods(FOODS, key);
      for (let i = 1; i < sorted.length; i++) assert.ok(metric(sorted[i - 1]) >= metric(sorted[i]), key);
    }
    assert.equal(sortFoods(FOODS, "per100g")[0].id, "whey");
    assert.deepEqual(FOODS.map((f) => f.id), before);
  });
});

describe("content/fitness/nutrition.json", () => {
  const sourceIds = new Set(SOURCES.map((s) => s.id));
  const cyrillic = /[А-Яа-яЁё]/;

  it("goal keys are exactly the GoalMode union from types.ts", () => {
    const types = fs.readFileSync(path.join(root, "src/lib/fitness/types.ts"), "utf8");
    const union = types.match(/export type GoalMode =([^;]+);/)?.[1].match(/"([a-z]+)"/g)?.map((s) => s.slice(1, -1));
    assert.deepEqual([...GOAL_KEYS].sort(), [...union].sort());
    assert.deepEqual(Object.keys(GOALS).sort(), [...GOAL_KEYS].sort());
  });

  it("every goal rule is internally consistent and sourced", () => {
    for (const key of GOAL_KEYS) {
      const g = GOALS[key];
      assert.ok(g.name.en && cyrillic.test(g.name.ru) && g.short.en && cyrillic.test(g.short.ru) && g.summary.en && cyrillic.test(g.summary.ru), key);
      const [lo, hi] = g.protein.gPerKg;
      assert.ok(lo < hi && g.protein.target >= lo && g.protein.target <= hi, `${key} protein`);
      if (g.protein.ffm) assert.ok(g.protein.ffm.gPerKg[0] <= g.protein.ffm.target && g.protein.ffm.target <= g.protein.ffm.gPerKg[1], `${key} ffm`);
      assert.ok(["loss", "gain", "maintain"].includes(g.energy.direction), key);
      if (g.energy.direction === "maintain") assert.equal(g.energy.rate, null, key);
      else {
        const r = g.energy.rate;
        assert.ok(r.min < r.max && r.default >= r.min && r.default <= r.max && r.recommended[0] >= r.min && r.recommended[1] <= r.max, `${key} rate`);
      }
      assert.ok(g.fatFloorGPerKg > 0 && g.carbFloorGPerKg > 0, key);
      for (const ids of [g.protein.source, g.energy.source, g.floorSource]) assert.ok(ids.length && ids.every((id) => sourceIds.has(id)), `${key} sources`);
    }
    assert.deepEqual(GOALS.recomp.protein.gPerKg, [1.6, 2.2]);
    assert.deepEqual([GOALS.recomp.energy.rate.min, GOALS.recomp.energy.rate.max], [0.25, 1]);
    assert.deepEqual([GOALS.hypertrophy.energy.rate.min, GOALS.hypertrophy.energy.rate.max], [0.1, 0.5]);
  });

  it("daily rules carry the brief's numbers and sources", () => {
    assert.deepEqual(DAILY.creatine.gPerDay, [3, 5]);
    assert.deepEqual(DAILY.caffeine.mgPerKg, [3, 6]);
    assert.equal(DAILY.fibre.gPer1000Kcal, 14);
    assert.equal(DAILY.hydration.mlPerKgPerDay, 35);
    for (const block of ["perMeal", "fat", "fibre", "creatine", "caffeine", "hydration"]) assert.ok(DAILY[block].source.every((id) => sourceIds.has(id)), block);
  });

  it("every source id referenced anywhere resolves; source ids are unique; URLs are https or null", () => {
    assert.equal(sourceIds.size, SOURCES.length, "unique source ids");
    const referenced = new Set();
    const walk = (v, key) => {
      if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
      else if (typeof v === "string" && (key === "ref" || /source$/i.test(key ?? ""))) referenced.add(v);
    };
    const { sources, foods, ...rest } = NUTRITION;
    walk(rest);
    for (const f of foods) referenced.add(f.ref);
    for (const id of referenced) assert.ok(sourceIds.has(id), `unknown source id ${id}`);
    for (const s of sources) assert.ok(s.text.length > 20 && (s.url === null || /^https:\/\//.test(s.url)), s.id);
    for (const rule of RULES) assert.ok(rule.en && cyrillic.test(rule.ru) && rule.source.length, rule.en);
  });

  it("heart-rate zones are five contiguous bands with bilingual labels", () => {
    assert.deepEqual(ZONES.map((z) => z.pct), [[50, 60], [60, 70], [70, 80], [80, 90], [90, 100]]);
    for (const z of ZONES) assert.ok(z.name.en && cyrillic.test(z.name.ru) && z.feel.en && cyrillic.test(z.feel.ru));
    const z2 = NUTRITION.heartRate.zone2;
    const [lo, hi] = ZONES[1].pct;
    assert.ok(z2.startPctHrr[0] === lo && z2.startPctHrr[1] > lo && z2.startPctHrr[1] < hi, "start band is the lower part of zone 2");
    assert.equal(z2.bandBelowCeilingBpm, 10);
    assert.ok(z2.source.includes("persinger-2004") && z2.source.includes("iannetta-2020"));
  });

  it("food table: at least 45 foods with bilingual names, numeric macros, a serving and a source", () => {
    assert.ok(FOODS.length >= 45, `only ${FOODS.length} foods`);
    const ids = new Set(FOODS.map((f) => f.id));
    assert.equal(ids.size, FOODS.length, "unique ids");
    const groups = new Set(FOOD_GROUPS.map((g) => g.id));
    const cuisines = new Set(CUISINES.map((c) => c.id));
    for (const f of FOODS) {
      assert.match(f.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, f.id);
      assert.ok(f.name.en.trim() && cyrillic.test(f.name.ru), `${f.id} names`);
      assert.ok(groups.has(f.group), `${f.id} group`);
      assert.ok(f.cuisine === null || cuisines.has(f.cuisine), `${f.id} cuisine`);
      assert.ok(f.unit === "g" || f.unit === "ml", `${f.id} unit`);
      const { kcal, protein, fat, carbs, fibre } = f.per100;
      for (const v of [kcal, protein, fat, carbs]) assert.ok(typeof v === "number" && Number.isFinite(v) && v >= 0, `${f.id} macros`);
      assert.ok(kcal > 0 && protein > 0, `${f.id} kcal/protein`);
      assert.ok(fibre === null || (typeof fibre === "number" && fibre >= 0), `${f.id} fibre`);
      assert.ok(protein + fat + carbs <= 101, `${f.id} grams per 100 (carbs by difference include fibre)`);
      assert.ok(fibre === null || fibre <= carbs + 0.05, `${f.id} fibre is part of carbs`);
      const atwater = 4 * protein + 9 * fat + 4 * carbs;
      assert.ok(Math.abs(atwater - kcal) / kcal <= 0.15, `${f.id}: ${kcal} kcal vs 4P+9F+4C = ${atwater.toFixed(0)}`);
      close(f.proteinPer100kcal, (protein / kcal) * 100, 0.051, `${f.id} protein per 100 kcal`);
      const s = f.serving;
      assert.ok(Number.isFinite(s.grams) && s.grams > 0 && s.label.en.trim() && cyrillic.test(s.label.ru), `${f.id} serving`);
      close(s.kcal, (kcal * s.grams) / 100, 0.51, `${f.id} serving kcal`);
      close(s.protein, (protein * s.grams) / 100, 0.051, `${f.id} serving protein`);
      assert.ok(f.source.length > 10 && sourceIds.has(f.ref), `${f.id} source`);
    }
  });

  it("food table covers the requested staples", () => {
    const ids = new Set(FOODS.map((f) => f.id));
    const required = [
      "mercimek", "ayran", "beyaz-peynir", "lor", "kofte", "sea-bass-grilled", "menemen", "natto", "tofu", "mackerel", "edamame",
      "chicken-breast", "turkey-breast", "beef-sirloin", "beef-mince-90", "pork-tenderloin", "salmon", "tuna-canned", "shrimp", "egg",
      "egg-white", "greek-yogurt-0", "skyr", "cottage-cheese", "milk", "kefir", "whey", "tempeh", "lentils", "chickpeas", "black-beans",
      "seitan", "oats", "rice", "bread-wholewheat",
    ];
    for (const id of required) assert.ok(ids.has(id), `missing ${id}`);
    for (const c of ["tr", "jp", "ru"]) assert.ok(FOODS.some((f) => f.cuisine === c), `no ${c} foods`);
  });
});

describe("calculator inputs (inputs-core.mjs)", async () => {
  const { FIELDS, parseStamps, pickValue, profileStamps, stampEdits, toNum } = await import("../../src/components/fitness/nutrition/inputs-core.mjs");
  const settingsAt = "2026-11-01T10:00:00.000Z";
  const settings = { goal: "strength", daysPerWeek: 3, bodyweightKg: 84, heightCm: 181, birthYear: 1990, sex: "male", activeGymId: null, unit: "kg", restTimer: true, autoCloseHours: 6, updatedAt: settingsAt };
  const snapshot = (extra = {}) => ({ programs: {}, activeProgramId: null, gyms: {}, sessions: {}, sets: {}, exerciseState: {}, bodyweight: {}, adjustments: {}, settings, syncedAt: null, pending: 0, ...extra });

  it("parses decimal commas and rejects junk", () => {
    assert.equal(toNum("80,5"), 80.5);
    assert.equal(toNum(" 72 "), 72);
    assert.equal(toNum(""), undefined);
    assert.equal(toNum("8o"), undefined);
  });

  it("keeps only known fields with string values, short text and real times", () => {
    const raw = JSON.stringify({
      kg: { v: "82", at: "2026-11-08T09:00:00.000Z" },
      cm: { v: 180, at: "2026-11-08T09:00:00.000Z" },
      age: { v: "x".repeat(41), at: "2026-11-08T09:00:00.000Z" },
      sex: { v: "male", at: "yesterday" },
      evil: { v: "1", at: "2026-11-08T09:00:00.000Z" },
    });
    assert.deepEqual(Object.keys(parseStamps(raw)), ["kg"]);
    for (const bad of [null, "", "{", "[]", "42"]) assert.deepEqual(parseStamps(bad), {});
    assert.ok(FIELDS.includes("rate-recomp") && FIELDS.includes("hrRest"));
  });

  it("stamps edits, ignoring unknown fields and cutting long text", () => {
    const next = stampEdits({ kg: { v: "80", at: "2026-11-01T00:00:00.000Z" } }, { kg: "81", nope: "1", cm: "1".repeat(50) }, "2026-11-08T00:00:00.000Z");
    assert.deepEqual(next.kg, { v: "81", at: "2026-11-08T00:00:00.000Z" });
    assert.equal(next.cm.v.length, 40);
    assert.equal("nope" in next, false);
  });

  it("reads the profile: settings, age from birth year, newer weigh-ins and body fat", () => {
    const p = profileStamps(snapshot(), 2026);
    assert.deepEqual([p.kg.v, p.cm.v, p.age.v, p.sex.v, p.goal.v], ["84", "181", "36", "male", "strength"]);
    assert.equal(profileStamps(snapshot(), 0).age, undefined, "no age while the year is unknown (server render)");
    const newer = profileStamps(snapshot({ bodyweight: { a: { id: "a", at: "2026-11-07T07:00:00.000Z", kg: 83.2, bodyFatPct: 21, updatedAt: "x" }, b: { id: "b", at: "2026-10-01T07:00:00.000Z", kg: 86, updatedAt: "x" } } }), 2026);
    assert.deepEqual([newer.kg.v, newer.bodyFat.v], ["83.2", "21"]);
    const older = profileStamps(snapshot({ bodyweight: { b: { id: "b", at: "2026-10-01T07:00:00.000Z", kg: 86, updatedAt: "x" } } }), 2026);
    assert.equal(older.kg.v, "84", "settings newer than the last weigh-in");
    assert.deepEqual(profileStamps(snapshot({ settings: null }), 2026), {});
  });

  it("picks the newer of this browser's edit and the profile, else the fallback", () => {
    const profile = profileStamps(snapshot(), 2026);
    assert.deepEqual(pickValue("kg", { kg: { v: "82", at: "2026-11-08T09:00:00.000Z" } }, profile, "80"), { value: "82", source: "edit" });
    assert.deepEqual(pickValue("kg", { kg: { v: "82", at: "2026-10-08T09:00:00.000Z" } }, profile, "80"), { value: "84", source: "profile" });
    assert.deepEqual(pickValue("hrRest", {}, profile, "60"), { value: "60", source: "default" });
    assert.deepEqual(pickValue("bodyFat", { bodyFat: { v: "", at: "2026-11-08T09:00:00.000Z" } }, profile, ""), { value: "", source: "edit" }, "a cleared field stays cleared");
  });
});

describe("edge cases the calculator page meets", () => {
  it("a pace that leaves under 500 kcal is an error the page explains ('slow it down'); a gentler pace computes", () => {
    const small = { kg: 30, cm: 120, age: 42, sex: "female", activity: "sedentary", goal: "recomp" };
    assert.equal(ok(bmrMifflin(small)).kcal, 679);
    assert.deepEqual(nutritionPlan({ ...small, ratePctPerWeek: 1 }), { error: "kcal" });
    const gentle = ok(nutritionPlan({ ...small, ratePctPerWeek: 0.5 }));
    assert.equal(gentle.energy.kcal, 650);
    assert.deepEqual(gentle.warnings, ["below-bmr", "carbs-below-floor"]);
    assert.deepEqual(nutritionPlan({ ...MAN, activity: "light", goal: "recomp", ratePctPerWeek: 2 }), { error: "ratePctPerWeek" });
  });

  it("maintenance goals still warn when TDEE is under the BMR (a wrong activity level)", () => {
    const m = ok(energyTarget({ tdee: 1500, goal: "maintenance", kg: 60, bmr: 1600 }));
    assert.deepEqual([m.kcal, m.direction, m.warnings], [1500, "maintain", ["below-bmr"]]);
    assert.deepEqual(ok(energyTarget({ tdee: 1500, goal: "maintenance", kg: 60, bmr: { kcal: 1400 } })).warnings, []);
  });

  it("an empty field (null) means 'not given': default pace, bodyweight protein basis", () => {
    assert.equal(ok(energyTarget({ tdee: 2413.125, goal: "recomp", kg: 80, ratePctPerWeek: null })).kcal, 1973);
    const p = ok(proteinTarget({ kg: 80, bodyFatPct: null, goal: "recomp" }));
    assert.deepEqual([p.basis, p.target], ["bodyweight", 176]);
  });

  it("every calculator checks the body weight it is given", () => {
    assert.deepEqual(bmrKatch({ kg: 20, bodyFatPct: 15 }), { error: "kg" });
    assert.deepEqual(weeksToGoal({ kg: 300, targetKg: 80, weeklyChangeKg: -0.5 }), { error: "kg" });
    assert.deepEqual(macroSplit({ kcal: 2000, proteinG: 150, kg: 20, goal: "recomp" }), { error: "kg" });
  });

  it("TDEE needs a plausible BMR (500–5,000 kcal)", () => {
    assert.deepEqual(tdee(400, "light"), { error: "bmr" });
    assert.deepEqual(tdee(5001, "light"), { error: "bmr" });
    assert.equal(ok(tdee(500, "sedentary")).kcal, 600);
  });

  it("heart rate: a measured maximum must be plausible, and a resting rate must sit below the maximum", () => {
    assert.deepEqual(hrZones({ hrRest: 60, hrMax: 250 }), { error: "hrMax" });
    assert.deepEqual(vo2maxUth(105, 110), { error: "hrMax" });
    assert.deepEqual(zoneOf(140, []), { error: "zones" });
    assert.deepEqual(zoneOf(140, { zones: [] }), { error: "zones" });
  });

  it("age from birth year needs whole years within 0–120", () => {
    assert.equal(ageFromBirthYear(1990, 2026.5), null);
    assert.equal(ageFromBirthYear(1800, 2026), null);
    assert.equal(ageFromBirthYear("1990", 2026), null);
    assert.equal(ageFromBirthYear(2026, 2026), 0);
  });

  it("an unknown sort key falls back to protein per 100 kcal", () => {
    assert.deepEqual(sortFoods(FOODS, /** @type {any} */ ("nope")).map((f) => f.id), sortFoods(FOODS).map((f) => f.id));
  });
});
