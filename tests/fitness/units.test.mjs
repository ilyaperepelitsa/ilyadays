// keepUnits (src/lib/fitness/i18n.ts): a no-break space between a number and its unit, so a 360 px phone never ends a
// line on "400" and starts the next with "mg" (phone review 2026-11-09, plans/fitness/09-nutrition.md), and a word
// joiner (U+2060) after the dash of a range and the slash of a compound unit, so it never ends one on "3–" or "г/"
// either. The nutrition page runs its copy through it: the strings of content/fitness/nutrition.json and the
// calculator's own sentences.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// i18n.ts runs through Node's type stripping; hide the one-time "module type not specified" notice it triggers.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const code = typeof rest[0] === "object" && rest[0] ? rest[0].code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  return emitWarning.call(this, warning, ...rest);
};
const { keepUnits } = await import("../../src/lib/fitness/i18n.ts");

const NB = "\u00a0";
const WJ = "\u2060";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nutrition = JSON.parse(fs.readFileSync(path.join(root, "content/fitness/nutrition.json"), "utf8"));

// The units the nutrition page prints. A unit ends where no letter, mark or digit follows: "3 meals" is not "3 m".
// No bare "с": it is also the preposition ("8 с RIR 2"), and the page spells out "секунд".
const UNITS = [
  "mg/kg", "g/kg", "g/day", "kcal", "bpm", "METs", "MET", "mg", "kg", "km", "ml", "cm", "min", "g", "l", "L", "h", "s", "m", "W", "%",
  "уд/мин", "ккал", "МЕТ", "мг", "кг", "км", "мл", "см", "мин", "Вт", "г", "л", "ч", "м",
  "tbsp", "cup", "cups", "тыс.", "ст. ложка", "ст. ложки", "ст. ложек", "чашка", "чашки", "чашек", "чашку", "стакан", "стакана", "стаканов",
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
// In keepUnits' output the slash of a unit carries a word joiner: "уд/\u2060мин".
const UNIT = `(?:${UNITS.map((u) => esc(u).replace("\\/", `\\/${WJ}?`)).join("|")})(?![\\p{L}\\p{M}\\d])`;
const PLAIN_PAIR = new RegExp(`\\d ${UNIT}`, "gu");
const UNIT_AHEAD = new RegExp(`^${UNIT}`, "u");
// The slash of a compound unit: the unit starts a word and a letter follows ("г/кг", "уд/мин"; not "шаг/мин").
const SLASH_UNIT = `(?:^|[^\\p{L}\\p{M}])(?:${[...UNITS.filter((u) => !u.includes("/")), "уд"].map(esc).join("|")})\\/`;
const BARE_SLASH = new RegExp(`${SLASH_UNIT}\\p{L}`, "gu");
const SLASH_BEHIND = new RegExp(`${SLASH_UNIT}$`, "u");
const BARE_DASH = /\d–\d/g;
const BARE_SIGN = /[≈±] \d/g;

/** [input, expected] with `~` for the no-break space and `^` for the word joiner keepUnits inserts. */
const cases = (rows) => rows.map(([input, expected]) => [input, expected.replaceAll("~", NB).replaceAll("^", WJ)]);

const EN = cases([
  ["at most 400 mg a day", "at most 400~mg a day"],
  [
    "Caffeine 3–6 mg/kg 45–60 minutes before training (start at 2–3 mg/kg), none within 9–13 hours of bedtime, at most 400 mg a day.",
    "Caffeine 3–^6~mg/^kg 45–^60 minutes before training (start at 2–^3~mg/^kg), none within 9–^13 hours of bedtime, at most 400~mg a day.",
  ],
  [
    "Water: about 35 ml/kg a day plus 0.5–1 L per training hour; sweating off more than 2 % of bodyweight costs performance.",
    "Water: about 35~ml/^kg a day plus 0.5–^1~L per training hour; sweating off more than 2~% of bodyweight costs performance.",
  ],
  ["Fibre 14 g per 1,000 kcal (at least 25 g)", "Fibre 14~g per 1,000~kcal (at least 25~g)"],
  ["BMR 1,755 × 1.375 = 2,413 kcal", "BMR 1,755 × 1.375 = 2,413~kcal"],
  [`1${NB}973 kcal a day`, "1~973~kcal a day"],
  ["Max ≈ 183.5 bpm; zone 2: 134–146 bpm", "Max ≈~183.5~bpm; zone 2: 134–^146~bpm"],
  ["+0.5 km/h or +2 % incline, +15–25 W on a bike", "+0.5~km/^h or +2~% incline, +15–^25~W on a bike"],
  ["≈ 42.4 ml/kg/min · 12.1 METs; 1 MET = 3.5 ml/kg/min", "≈~42.4~ml/^kg/^min · 12.1~METs; 1~MET = 3.5~ml/^kg/^min"],
  ["creatine 3–5 g/day, protein 1.6–2.2 g/kg", "creatine 3–^5~g/^day, protein 1.6–^2.2~g/^kg"],
  ["45–60 min, 9–13 h, rest 90 s, 2400 m in 12 minutes, 5 km, 1 l, 180 cm", "45–^60~min, 9–^13~h, rest 90~s, 2400~m in 12 minutes, 5~km, 1~l, 180~cm"],
  ["45–60 minutes", "45–^60 minutes"],
  // lines that still broke at 360 px after the first fix: after the dash of a range, after "±" and "≈"
  ["change intake by 100–150 kcal only after two off-target weeks", "change intake by 100–^150~kcal only after two off-target weeks"],
  ["lower fat cut testosterone 10–15 %", "lower fat cut testosterone 10–^15~%"],
  ["ACSM: moderate 40–59 %, vigorous 60–89 % of reserve (formula: 133–146).", "ACSM: moderate 40–^59~%, vigorous 60–^89~% of reserve (formula: 133–^146)."],
  ["Eat at maintenance (± 100 kcal)", "Eat at maintenance (±~100~kcal)"],
  ["150 g raw (≈ 110 g cooked)", "150~g raw (≈~110~g cooked)"],
  ["1 cup, 2 cups, 4 tbsp (≈ 60 g)", "1~cup, 2~cups, 4~tbsp (≈~60~g)"],
]);

const RU = cases([
  [
    "Кофеин 3–6 мг/кг за 45–60 минут до тренировки (начните с 2–3 мг/кг), не позже чем за 9–13 часов до сна, не больше 400 мг в день.",
    "Кофеин 3–^6~мг/^кг за 45–^60 минут до тренировки (начните с 2–^3~мг/^кг), не позже чем за 9–^13 часов до сна, не больше 400~мг в день.",
  ],
  [
    "Вода: около 35 мл/кг в день плюс 0,5–1 л на час тренировки; потеря с потом больше 2 % веса снижает работоспособность.",
    "Вода: около 35~мл/^кг в день плюс 0,5–^1~л на час тренировки; потеря с потом больше 2~% веса снижает работоспособность.",
  ],
  ["Клетчатка — 14 г на 1000 ккал (не меньше 25 г)", "Клетчатка — 14~г на 1000~ккал (не меньше 25~г)"],
  // ru-RU number formatting groups thousands with a no-break space already
  [`BMR 1${NB}771 × 1,375 = 2${NB}435 ккал`, "BMR 1~771 × 1,375 = 2~435~ккал"],
  [`1${NB}973 ккал в день`, "1~973~ккал в день"],
  ["Зона 2: 134–146 уд/мин", "Зона 2: 134–^146~уд/^мин"],
  ["+0,5 км/ч или +2 % наклона, +15–25 Вт на велотренажёре", "+0,5~км/^ч или +2~% наклона, +15–^25~Вт на велотренажёре"],
  ["≈ 42,4 мл/кг/мин · 12,1 МЕТ", "≈~42,4~мл/^кг/^мин · 12,1~МЕТ"],
  // "с" after a number keeps its plain space: it is also the preposition
  ["отдых 90 с, 2400 м за 12 минут, 5 км, 3 мин, за 2 ч до сна, 200 мл, 180 см", "отдых 90 с, 2400~м за 12 минут, 5~км, 3~мин, за 2~ч до сна, 200~мл, 180~см"],
  ["Жим от груди 60 кг × 8 с RIR 2", "Жим от груди 60~кг × 8 с RIR 2"],
  ["начинает зону 2 с 60–65 % резерва", "начинает зону 2 с 60–^65~% резерва"],
  // a Cyrillic unit before punctuation or at the very end: exactly where \b would fail
  ["Белок: 30 г.", "Белок: 30~г."],
  ["Вес 80 кг", "Вес 80~кг"],
  // lines that still broke at 360 px after the first fix: after the dash, after the slash, after "±" and "≈"
  ["3–5 приёмов пищи по 30–50 г (около 0,4 г/кг за раз).", "3–^5 приёмов пищи по 30–^50~г (около 0,4~г/^кг за раз)."],
  ["1–2 недели на поддержании", "1–^2 недели на поддержании"],
  ["Питание на поддержание (± 100 ккал)", "Питание на поддержание (±~100~ккал)"],
  ["150 г сырой (≈ 110 г готовой)", "150~г сырой (≈~110~г готовой)"],
  ["−0,40 кг/нед, темп 0,5 %/нед", "−0,40~кг/^нед, темп 0,5~%/^нед"],
  ["уд/мин", "уд/^мин"],
  ["4 ст. ложки (≈ 60 г), 1 ст. ложка, 5 ст. ложек", "4~ст.~ложки (≈~60~г), 1~ст.~ложка, 5~ст.~ложек"],
  ["1 чашка, 2 чашки, 5 чашек, 1 чашку; 1 стакан, 2 стакана, 5 стаканов", "1~чашка, 2~чашки, 5~чашек, 1~чашку; 1~стакан, 2~стакана, 5~стаканов"],
  ["5–8 тыс. шагов", "5–^8~тыс. шагов"],
]).concat([["До ~3 г/кг в течение года не вредили", `До ~3${NB}г/${WJ}кг в течение года не вредили`]]); // a real "~"

const WORDS = [
  "2 eggs", "3 meals", "3 sets of 8 reps", "4 hours before bed", "45 minutes", "2 large eggs", "1 glass", "2 scoops",
  "2 яйца", "3 часа", "5 минут", "3 млн", "12 месяцев", "2 ложки", "4 гостя",
  "2 cupboard shelves", "3 cupsworth", "2 чашкиного", "5 тысяч", "2 ст. ложкиного",
  "8 с RIR 2", "по 10 с RIR 2", "в 2 с половиной раза",
];

// Dashes, slashes and signs between words rather than numbers and units.
const BETWEEN_WORDS = ["Mifflin–St Jeor", "Katch–McArdle", "3 – 6 sets", "говядина/баранина", "beef/lamb", "и/или", "шаг/мин", "± SD", "≈ a third"];

// Only what the rules name: a plain space before a unit (not a tab, a thin space or a line break), an en dash between
// digits (not a hyphen or an em dash), a slash after a unit that starts a word (a letter outside the BMP is one letter
// too: two UTF-16 code units), "≈" and "±" (not "~").
const ONLY_THE_RULES = cases([
  ["5\tg", "5\tg"],
  ["5\u2009g", "5\u2009g"],
  ["5\ng", "5\ng"],
  ["2026-11-08", "2026-11-08"],
  ["3-6 g", "3-6~g"],
  ["3—6 g", "3—6~g"],
  ["𝐀г/кг", "𝐀г/кг"],
]).concat([["~ 3 г", `~ 3${NB}г`]]); // a real "~"

const MARKUP = cases([
  ['<abbr title="400 mg">400 mg</abbr>', '<abbr title="400 mg">400~mg</abbr>'],
  ['<abbr title="3–6 mg/kg">3–6 mg/kg</abbr>', '<abbr title="3–6 mg/kg">3–^6~mg/^kg</abbr>'],
  ['[3–5 g a day](https://example.org/creatine "3–5 g a day")', '[3–^5~g a day](https://example.org/creatine "3–5 g a day")'],
  ["[≈ 0,4 г/кг](https://example.org/г/кг)", "[≈~0,4~г/^кг](https://example.org/г/кг)"],
  ["under 5 g <b>or</b> 2 %", "under 5~g <b>or</b> 2~%"],
  ["https://example.org/doses/400 mg", "https://example.org/doses/400 mg"],
  ["https://example.org/doses/3–6/mg/kg", "https://example.org/doses/3–6/mg/kg"],
  ["www.example.org/zones/2 h", "www.example.org/zones/2 h"],
  ["www.example.org/zones/134–146 bpm", "www.example.org/zones/134–146 bpm"],
  ["a < 5 g, <5 g", "a < 5~g, <5~g"],
]);

describe("keepUnits", () => {
  it("joins numbers to their units, ranges and compound units in English", () => {
    for (const [input, expected] of EN) assert.equal(keepUnits(input), expected);
  });

  it("joins numbers to their units, ranges and compound units in Russian", () => {
    for (const [input, expected] of RU) assert.equal(keepUnits(input), expected);
  });

  it("never joins a number to a word, even one that starts like a unit", () => {
    for (const text of WORDS) assert.equal(keepUnits(text), text);
  });

  it("leaves dashes, slashes and signs between words alone", () => {
    for (const text of BETWEEN_WORDS) assert.equal(keepUnits(text), text);
  });

  it("joins only what its rules name: other spaces, hyphens, em dashes and \"~\" stay as they are", () => {
    for (const [input, expected] of ONLY_THE_RULES) assert.equal(keepUnits(input), expected, JSON.stringify(input));
  });

  it("leaves markup, link targets and URLs alone", () => {
    for (const [input, expected] of MARKUP) assert.equal(keepUnits(input), expected);
  });

  it("is idempotent and changes nothing but those spaces and joiners", () => {
    for (const [input] of [...EN, ...RU, ...MARKUP, ...ONLY_THE_RULES, ...[...WORDS, ...BETWEEN_WORDS].map((w) => [w])]) {
      const once = keepUnits(input);
      assert.equal(keepUnits(once), once, input);
      assert.equal(once.replaceAll(WJ, "").replaceAll(NB, " "), input.replaceAll(NB, " "), input);
    }
    assert.equal(keepUnits(""), "");
  });

  it("takes its own output inside a longer sentence", () => {
    // the components build sentences around units and ranges that already went through it (kcalU, bpm, band)
    assert.equal(keepUnits(`Зона 2: 134–146 ${keepUnits("уд/мин")}`), keepUnits("Зона 2: 134–146 уд/мин"));
    assert.equal(keepUnits(`${keepUnits("1,6–2,2")} г/кг`), keepUnits("1,6–2,2 г/кг"));
  });
});

describe("keepUnits over content/fitness/nutrition.json", () => {
  // Every en/ru string, plus the English-only food sources and reference texts the page shows as they are.
  const strings = [];
  const walk = (value, where) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${where}[${i}]`));
    else if (value && typeof value === "object")
      for (const [key, v] of Object.entries(value)) {
        if (typeof v === "string" && (key === "en" || key === "ru")) strings.push([`${where}.${key}`, v]);
        else walk(v, `${where}.${key}`);
      }
  };
  walk(nutrition, "nutrition");
  for (const f of nutrition.foods) strings.push([`food ${f.id} source`, f.source]);
  for (const s of nutrition.sources) strings.push([`source ${s.id}`, s.text]);

  it("leaves no plain space before a listed unit or after ≈ and ±, and no bare range dash or unit slash", () => {
    assert.ok(strings.length >= 4 * nutrition.foods.length, `only ${strings.length} strings found`); // names + servings
    for (const [where, text] of strings) {
      const out = keepUnits(text);
      for (const re of [PLAIN_PAIR, BARE_DASH, BARE_SLASH, BARE_SIGN]) assert.deepEqual(out.match(re), null, where);
    }
  });

  it("puts every no-break space and joiner where it belongs, never before a word", () => {
    for (const [where, text] of strings) {
      const out = keepUnits(text);
      let i = 0; // the same place in `text`
      for (let j = 0; j < out.length; j++) {
        const at = `${where}: …${text.slice(Math.max(0, i - 10), i + 12)}…`;
        const before = text.slice(0, i);
        if (out[j] === WJ && text[i] !== WJ) {
          const range = /\d–$/.test(before) && /^\d/.test(text.slice(i));
          const compound = SLASH_BEHIND.test(before) && /^\p{L}/u.test(text.slice(i));
          assert.ok(range || compound, at);
          continue;
        }
        if (out[j] !== text[i]) {
          assert.equal(`${text[i]}${out[j]}`, ` ${NB}`, at);
          const unit = /\d$/.test(before) && UNIT_AHEAD.test(text.slice(i + 1));
          const sign = /[≈±]$/.test(before) && /^\d/.test(text.slice(i + 1));
          const spoon = /ст\.$/.test(before) && /^лож(?:ка|ки|ек)(?![\p{L}\p{M}\d])/u.test(text.slice(i + 1));
          assert.ok(unit || sign || spoon, at);
        }
        i++;
      }
      assert.equal(i, text.length, where);
    }
  });
});

describe("grouped thousands in the nutrition copy", () => {
  // Intl groups ru-RU thousands with a no-break space ("1 973"). A plain one lets a phone end a line inside the
  // number ("1 | 973 ккал"), and keepUnits leaves it alone, so copy typed by hand groups the way Intl does.
  const PLAIN_GROUP = /\d \d{3}(?!\d)/;

  it("has no plain-space groups in content/fitness/nutrition.json", () => {
    const all = [];
    const walk = (value, where) => {
      if (typeof value === "string") all.push([where, value]);
      else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${where}[${i}]`));
      else if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) walk(v, `${where}.${key}`);
    };
    walk(nutrition, "nutrition");
    assert.ok(all.length > 4 * nutrition.foods.length, `only ${all.length} strings found`);
    for (const [where, text] of all) assert.doesNotMatch(text, PLAIN_GROUP, where);
  });

  it("has no plain-space groups in the copy of the nutrition components", () => {
    // String and template literal text and JSX text, read with the TypeScript parser: no code, no comments.
    const dir = "src/components/fitness/nutrition";
    const files = [...fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".tsx")).map((f) => `${dir}/${f}`), "src/views/fitness/NutritionView.tsx"];
    assert.ok(files.length >= 5, files.join(", "));
    for (const file of files) {
      const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const copy = [];
      const visit = (node) => {
        if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) copy.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(source);
      assert.ok(copy.length > 10, `${file}: only ${copy.length} texts found`);
      for (const text of copy) assert.doesNotMatch(text, PLAIN_GROUP, `${file}: ${JSON.stringify(text)}`);
    }
  });
});
