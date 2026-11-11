/** Regression tests for the reviewed nutrition defects: a recommended pace that trips its own warnings, an intake
 * headline below the BMR, carbs silently shown as 0 g, and VO2max to 0.1 from a formula heart-rate maximum. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENERGY, GOALS, HR_MAX_FORMULA_SD, energyTarget, macroSplit, nutritionPlan, recommendedRate, recommendedRateFor, vo2maxUth, vo2maxUthRange } from "../../src/lib/fitness/nutrition.mjs";

const ok = (r) => {
  assert.ok(!("error" in r), `unexpected error ${JSON.stringify(r)}`);
  return r;
};
const MAN = { cm: 180, age: 35, sex: "male", activity: "light", goal: "recomp" };

describe("recommended pace is weight-aware", () => {
  it("tops out at the pace whose deficit is the goal's maximum (500 kcal), never above 0.75 %", () => {
    const rule = GOALS.recomp.energy;
    for (const kg of [50, 60, 70, 80, 95, 110, 140]) {
      const r = recommendedRate("recomp", kg);
      const cap = ((rule.maxDeficitKcal * 7) / ENERGY.kcalPerKgLoss / kg) * 100;
      assert.ok(Math.abs(r.max - Math.max(rule.rate.min, Math.min(0.75, cap))) < 1e-9, `${kg} kg: max ${r.max}`);
      assert.ok(r.min <= r.max && r.min >= rule.rate.min && r.min <= 0.5);
      assert.ok(r.default <= r.max + 1e-9 && r.default >= rule.rate.min, `${kg} kg: default ${r.default}`);
      assert.ok(Math.abs(r.default / rule.rate.step - Math.round(r.default / rule.rate.step)) < 1e-9, "the default sits on a slider step");
    }
    assert.ok(Math.abs(recommendedRate("recomp", 50).max - 0.75) < 1e-9, "light people keep the 0.75 % ceiling");
    assert.ok(Math.abs(recommendedRate("recomp", 80).max - 0.568) < 0.001);
    assert.equal(recommendedRate("recomp", 80).default, 0.5);
    assert.equal(recommendedRate("recomp", 95).default, 0.45);
    assert.deepEqual(recommendedRate("hypertrophy", 80), { min: 0.1, max: 0.25, default: 0.25 });
    assert.equal(recommendedRate("maintenance", 80), null);
    assert.deepEqual(recommendedRate("recomp", null), { min: 0.5, max: 0.75, default: 0.5 }, "no weight yet: the goal's own range");
  });

  it("no pace inside the recommended range warns about pace or the 500 kcal deficit", () => {
    for (const kg of [60, 70, 80, 95, 110]) {
      const r = recommendedRate("recomp", kg);
      for (const pace of [r.min, r.default, r.max]) {
        const plan = ok(nutritionPlan({ ...MAN, kg, ratePctPerWeek: pace }));
        assert.ok(!plan.warnings.includes("pace-above-recommended"), `${kg} kg at ${pace} %`);
        assert.ok(!plan.warnings.includes("deficit-over-max-kcal"), `${kg} kg at ${pace} %: ${plan.energy.deltaKcal}`);
      }
      const dflt = ok(nutritionPlan({ ...MAN, kg }));
      assert.equal(dflt.energy.ratePctPerWeek, r.default, "the default pace is the weight-aware one");
      assert.deepEqual(dflt.energy.warnings, []);
    }
  });

  it("for a small person the 25 % of maintenance limit caps the range too, and the default follows", () => {
    const small = { kg: 55, cm: 160, age: 45, sex: "female", activity: "sedentary", goal: "recomp" };
    const r = recommendedRateFor(small);
    assert.ok(r.max < recommendedRate("recomp", 55).max, "tighter than the weight-only range");
    for (const pace of [GOALS.recomp.energy.rate.min, r.default, r.max]) {
      if (pace > r.max) continue;
      const plan = ok(nutritionPlan({ ...small, ratePctPerWeek: pace }));
      assert.deepEqual(plan.energy.warnings.filter((w) => w !== "below-bmr"), [], `${pace} %: ${plan.energy.warnings}`);
    }
    assert.deepEqual(ok(nutritionPlan(small)).energy.recommended, r);
    assert.deepEqual(recommendedRateFor({ kg: 80, goal: "recomp" }), recommendedRate("recomp", 80), "incomplete body data: from the weight alone");
    assert.equal(recommendedRateFor({ ...small, goal: "maintenance" }), null);
  });

  it("a pace above the weight-aware maximum says so", () => {
    const e = ok(energyTarget({ tdee: 2413, goal: "recomp", kg: 95, ratePctPerWeek: 0.5 }));
    assert.deepEqual(e.warnings, ["pace-above-recommended", "deficit-over-max-kcal"]);
  });
});

describe("intake never goes below the BMR", () => {
  it("shows the floor and marks the pace as not feasible", () => {
    const p = ok(nutritionPlan({ kg: 45, cm: 150, age: 60, sex: "female", activity: "sedentary", goal: "recomp", ratePctPerWeek: 1 }));
    const floor = Math.ceil(p.bmr.kcal);
    assert.equal(p.energy.kcal, floor);
    assert.equal(p.energy.feasible, false);
    assert.equal(p.energy.floorKcal, floor);
    assert.equal(p.energy.requestedKcal, 617);
    assert.equal(p.energy.ratePctPerWeek, 1, "the pace asked for is kept for the message");
    assert.equal(p.energy.deltaKcal, floor - Math.round(p.tdee.kcal));
    assert.ok(Math.abs(p.energy.weeklyChangeKg - (p.energy.deltaKcal * 7) / ENERGY.kcalPerKgLoss) < 1e-9, "the weekly change is what the floor gives");
    assert.ok(p.energy.weeklyChangeKg > -0.45 && p.energy.weeklyChangeKg < 0);
    assert.ok(p.warnings.includes("below-bmr"));
    assert.ok(p.macros.protein.kcal + p.macros.fat.kcal + p.macros.carbs.kcal <= floor + 10, "macros are split from the floor");
  });

  it("a feasible plan is unchanged", () => {
    const p = ok(nutritionPlan({ ...MAN, kg: 80 }));
    assert.deepEqual([p.energy.kcal, p.energy.feasible, p.energy.floorKcal, p.energy.requestedKcal], [p.energy.requestedKcal, true, null, p.energy.kcal]);
    const e = ok(energyTarget({ tdee: 2413, goal: "recomp", kg: 80 }));
    assert.deepEqual([e.kcal, e.feasible, e.floorKcal], [1973, true, null], "no BMR given: nothing to floor at");
  });
});

describe("carbs are never a silent 0 g", () => {
  it("an over-budget split says by how many kcal protein and fat overshoot", () => {
    const m = ok(macroSplit({ kcal: 600, proteinG: 130, kg: 60, goal: "recomp" }));
    assert.equal(m.carbs.g, 0);
    assert.deepEqual(m.warnings, ["over-budget"]);
    assert.equal(m.overBudgetKcal, Math.round(130 * 4 + m.fat.g * 9 - 600));
    assert.ok(m.overBudgetKcal > 0);
    assert.equal(ok(macroSplit({ kcal: 2000, proteinG: 150, kg: 80, goal: "recomp" })).overBudgetKcal, 0);
  });
});

describe("VO2max from a formula heart-rate maximum is a range", () => {
  it("spans ± the formula's error and is in whole numbers", () => {
    const r = ok(vo2maxUthRange(183.5, 60));
    assert.equal(HR_MAX_FORMULA_SD, 10);
    assert.deepEqual([r.lo, r.hi], [Math.round((15.3 * 173.5) / 60), Math.round((15.3 * 193.5) / 60)]);
    assert.ok(Number.isInteger(r.lo) && Number.isInteger(r.hi) && r.lo < r.hi);
    assert.ok(Number.isInteger(r.metsLo) && Number.isInteger(r.metsHi));
    const point = ok(vo2maxUth(183.5, 60)).vo2max;
    assert.ok(r.lo < point && point < r.hi);
    assert.deepEqual(vo2maxUthRange(183.5, 25), { error: "hrRest" });
  });
});
