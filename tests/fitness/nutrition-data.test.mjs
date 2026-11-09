// Content accuracy — the food table against USDA FoodData Central, and the recomposition protein number that every page
// quotes (master plan §16: the calculator's 2.2 g/kg target; template summaries say "about 2.2 g/kg").
// The USDA reference values below were read from the SR Legacy CSV (FoodData Central, April 2018 release — frozen, so
// they never drift) on 2026-11-09. nutrition.test.mjs already checks the per-serving and per-100-kcal arithmetic.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const nutrition = readJson("content/fitness/nutrition.json");
const templates = readJson("content/fitness/templates.json");
const foods = new Map(nutrition.foods.map((f) => [f.id, f]));

// fdc id → per 100 g: energy (kcal), protein, total fat, carbohydrate by difference (g)
const USDA_SR_LEGACY = {
  "chicken-breast": [171077, 120, 22.5, 2.62, 0],
  "chicken-breast-cooked": [171477, 165, 31.02, 3.57, 0],
  "turkey-breast": [171098, 114, 23.66, 1.48, 0.14],
  "beef-mince-90": [174030, 176, 20, 10, 0],
  salmon: [175167, 208, 20.42, 13.42, 0],
  "tuna-canned": [173709, 86, 19.44, 0.96, 0],
  cod: [171955, 82, 17.81, 0.67, 0],
  egg: [171287, 143, 12.56, 9.51, 0.72],
  "greek-yogurt-0": [170894, 59, 10.19, 0.39, 3.6],
  "cottage-cheese": [172182, 81, 10.45, 2.27, 4.76],
  lentils: [172421, 116, 9.02, 0.38, 20.13],
  oats: [173904, 379, 13.15, 6.52, 67.7],
  rice: [168878, 130, 2.69, 0.28, 28.17],
  almonds: [170567, 579, 21.15, 49.93, 21.55],
};

describe("food table vs USDA FoodData Central (SR Legacy)", () => {
  for (const [id, [fdc, kcal, protein, fat, carbs]] of Object.entries(USDA_SR_LEGACY)) {
    it(`${id}: SR Legacy ${fdc}`, () => {
      const f = foods.get(id);
      assert.ok(f, `${id} missing from nutrition.json`);
      assert.equal(f.ref, "usda-fdc");
      assert.match(f.source, new RegExp(`SR Legacy ${fdc}:`), `${id} must name its FDC id`);
      const p = f.per100;
      assert.ok(Math.abs(p.kcal - kcal) <= 1, `${id} kcal ${p.kcal} vs USDA ${kcal}`);
      for (const [k, usda] of [["protein", protein], ["fat", fat], ["carbs", carbs]]) {
        assert.ok(Math.abs(p[k] - usda) <= 0.051, `${id} ${k} ${p[k]} vs USDA ${usda}`);
      }
    });
  }

  it("every USDA single-food row names a 6-digit SR Legacy id and its description", () => {
    for (const f of nutrition.foods) {
      if (f.ref !== "usda-fdc" || /^Recipe estimate/.test(f.source)) continue;
      assert.match(f.source, /SR Legacy \d{6}: \S/, `${f.id}: ${f.source}`);
    }
  });
});

describe("recomposition protein: one number everywhere", () => {
  const recomp = nutrition.goals.recomp;
  const target = recomp.protein.target;
  const en = target.toFixed(1);
  const ru = en.replace(".", ",");

  it("the calculator's recomp target is 2.2 g/kg body weight", () => {
    assert.equal(target, 2.2);
  });

  it("templates.json: the recomp summary quotes about the calculator's target, and no summary quotes another protein band", () => {
    const s = templates.goalModes.recomp.summary;
    assert.ok(s.en.includes(`about ${en} g of protein per kg`), s.en);
    assert.ok(s.ru.includes(`около ${ru} г белка на кг`), s.ru);
    for (const [mode, m] of Object.entries(templates.goalModes)) {
      for (const text of [m.summary.en, m.summary.ru]) {
        for (const hit of text.matchAll(/(\d+[.,]\d+)(?:\s*[–-]\s*(\d+[.,]\d+))?\s*(?:g|г)\b/g)) {
          assert.equal(mode, "recomp", `${mode} quotes protein: ${hit[0]}`);
          assert.ok(hit[2] === undefined && hit[1].replace(",", ".") === en, `${mode}: ${hit[0]} differs from ${en} g/kg`);
        }
      }
    }
  });

  it("the nutrition explainer leads with the same number and its table follows it", () => {
    const fat = recomp.fatFloorGPerKg;
    for (const [lang, num, kg, g] of [["en", en, "kg", "g"], ["ru", ru, "кг", "г"]]) {
      const text = fs.readFileSync(path.join(root, `content/fitness/science/nutrition.${lang}.md`), "utf8");
      const lead = text.split("\n").find((l) => l.startsWith("> **"));
      assert.ok(lead && lead.includes(lang === "en" ? `about ${num} g of protein per kg` : `около ${num} г белка на кг`), `${lang} lead: ${lead}`);
      const row = new RegExp(`^\\| (\\d+) ${kg} \\| (\\d+) ${g} \\| (\\d+) ${g} \\| (\\d+) ${g} \\|$`);
      const rows = text.split("\n").map((l) => l.match(row)).filter(Boolean);
      assert.ok(rows.length >= 3, `${lang}: protein table not found`);
      for (const [, bw, day, meal, floor] of rows) {
        const daily = Math.round(target * Number(bw));
        assert.equal(Number(day), daily, `${lang} ${bw} kg: protein a day`);
        assert.equal(Number(meal), Math.round(daily / 4), `${lang} ${bw} kg: per meal`);
        assert.equal(Number(floor), Math.round(fat * Number(bw)), `${lang} ${bw} kg: fat floor`);
      }
    }
  });
});
