// Fitness formatting helpers (src/lib/fitness/i18n.ts): the words, weights, clocks, dates and Russian plurals every
// fitness screen shows. Dates and times follow the phone's time zone; this file pins Istanbul (UTC+3 all year, where
// the owner trains), so a set logged at 21:30 UTC belongs to the next day.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.TZ = "Europe/Istanbul";
// i18n.ts runs through Node's type stripping; hide the one-time "module type not specified" notice it triggers.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const code = typeof rest[0] === "object" && rest[0] ? rest[0].code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  return emitWarning.call(this, warning, ...rest);
};
const { fmtClock, fmtDate, fmtKg, fmtSet, fmtTime, kgLabel, pick, pluralRu, t2 } = await import("../../src/lib/fitness/i18n.ts");

const NBSP = " "; // ru-RU groups thousands with a no-break space

describe("pick and t2", () => {
  it("pick returns the string of the page language", () => {
    assert.equal(pick("en", "Start session", "Начать тренировку"), "Start session");
    assert.equal(pick("ru", "Start session", "Начать тренировку"), "Начать тренировку");
  });

  it("t2 reads a bilingual text, falls back to English for a missing translation, and to the fallback for no text", () => {
    const text = { en: "Chest focus", ru: "Акцент на грудь" };
    assert.equal(t2("en", text), "Chest focus");
    assert.equal(t2("ru", text), "Акцент на грудь");
    assert.equal(t2("ru", { en: "Chest focus", ru: "" }), "Chest focus", "untranslated content shows in English");
    assert.equal(t2("en", { en: "", ru: "Только по-русски" }), "", "English pages never show Russian");
    assert.equal(t2("ru", null, "—"), "—");
    assert.equal(t2("en", undefined), "");
  });
});

describe("weights", () => {
  it("fmtKg drops trailing zeros, keeps at most two decimals and uses the page's decimal mark", () => {
    assert.equal(fmtKg(60), "60");
    assert.equal(fmtKg(62.5), "62.5");
    assert.equal(fmtKg(62.5, "ru"), "62,5");
    assert.equal(fmtKg(1.25, "en"), "1.25");
    assert.equal(fmtKg(61.257, "en"), "61.26");
    assert.equal(fmtKg(0.1 + 0.2, "en"), "0.3", "binary noise never shows");
    assert.equal(fmtKg(-2.5, "ru"), "-2,5");
  });

  it("fmtKg groups thousands (session tonnage) the way each language writes them", () => {
    assert.equal(fmtKg(12345, "en"), "12,345");
    assert.equal(fmtKg(12345, "ru"), `12${NBSP}345`);
    assert.equal(fmtKg(1234.5, "ru"), `1${NBSP}234,5`);
  });

  it("fmtKg never shows a minus zero (a flat body-weight trend rounds to −0.00 kg/week)", () => {
    assert.equal(fmtKg(-0), "0");
    assert.equal(fmtKg(-0.003, "en"), "0");
    assert.equal(fmtKg(-0.004, "ru"), "0");
    assert.equal(fmtKg(0.004, "en"), "0");
    assert.equal(fmtKg(-0.006, "en"), "-0.01", "a real negative stays negative");
  });

  it("kgLabel and fmtSet: '12 × 60 kg' / '8 × 62,5 кг'", () => {
    assert.equal(kgLabel("en"), "kg");
    assert.equal(kgLabel("ru"), "кг");
    assert.equal(fmtSet(12, 60, "en"), "12 × 60 kg");
    assert.equal(fmtSet(8, 62.5, "ru"), "8 × 62,5 кг");
  });
});

describe("dates and times", () => {
  const lateEvening = "2026-11-10T21:30:00.000Z"; // 00:30 on Wednesday 11 November in Istanbul

  it("fmtDate shows the local day, short by default, and takes other formats", () => {
    assert.equal(fmtDate(lateEvening, "en"), "11 Nov");
    assert.equal(fmtDate(lateEvening, "ru"), "11 нояб.");
    assert.equal(fmtDate(lateEvening, "en", { weekday: "short", day: "numeric", month: "long" }), "Wed 11 November");
    assert.equal(fmtDate(lateEvening, "ru", { weekday: "short", day: "numeric", month: "long" }), "ср, 11 ноября");
  });

  it("fmtTime shows the local 24-hour time in both languages", () => {
    assert.equal(fmtTime(lateEvening, "en"), "00:30");
    assert.equal(fmtTime(lateEvening, "ru"), "00:30");
    assert.equal(fmtTime("2026-11-10T06:05:00Z", "en"), "09:05");
  });

  it("an unreadable time is an empty string, never 'Invalid Date'", () => {
    for (const bad of ["", "yesterday", "2026-13-45T99:00:00Z"]) {
      assert.equal(fmtDate(bad, "en"), "", bad);
      assert.equal(fmtTime(bad, "ru"), "", bad);
    }
  });
});

describe("fmtClock", () => {
  it("formats seconds as m:ss: rest timers, rest prescriptions and the session clock", () => {
    assert.equal(fmtClock(95), "1:35");
    assert.equal(fmtClock(0), "0:00");
    assert.equal(fmtClock(150), "2:30");
    assert.equal(fmtClock(59.4), "0:59");
    assert.equal(fmtClock(59.5), "1:00", "rounds to the nearest second");
    assert.equal(fmtClock(3725), "62:05", "a long session keeps counting minutes");
  });

  it("never goes below zero", () => {
    assert.equal(fmtClock(-12), "0:00");
    assert.equal(fmtClock(-0.4), "0:00");
  });

  it("shows a dash for a missing value instead of 'NaN:NaN' (a program slot synced without its rest)", () => {
    assert.equal(fmtClock(Number.NaN), "—");
    assert.equal(fmtClock(/** @type {any} */ (undefined)), "—");
    assert.equal(fmtClock(Number.POSITIVE_INFINITY), "—");
  });
});

describe("pluralRu", () => {
  const SETS = /** @type {[string, string, string]} */ (["подход", "подхода", "подходов"]);

  it("picks the Russian form by the last two digits: 1, 21 → подход; 2–4, 22 → подхода; 0, 5–20, 25 → подходов", () => {
    /** @type {[number, string][]} */
    const table = [
      [0, "подходов"], [1, "подход"], [2, "подхода"], [3, "подхода"], [4, "подхода"], [5, "подходов"], [9, "подходов"],
      [10, "подходов"], [11, "подходов"], [12, "подходов"], [14, "подходов"], [15, "подходов"], [19, "подходов"],
      [20, "подходов"], [21, "подход"], [22, "подхода"], [24, "подхода"], [25, "подходов"], [100, "подходов"],
      [101, "подход"], [104, "подхода"], [111, "подходов"], [112, "подходов"], [114, "подходов"], [121, "подход"],
      [1004, "подхода"],
    ];
    for (const [n, form] of table) assert.equal(pluralRu(n, SETS), form, String(n));
  });

  it("uses the absolute value, so a negative change reads the same", () => {
    assert.equal(pluralRu(-1, SETS), "подход");
    assert.equal(pluralRu(-3, SETS), "подхода");
    assert.equal(pluralRu(-11, SETS), "подходов");
  });
});
