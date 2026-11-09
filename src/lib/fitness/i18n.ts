/** Fitness strings live next to the components: `pick(lang, "Start session", "Начать тренировку")`. */
import type { Lang, Text2 } from "./types";

export const pick = (lang: Lang, en: string, ru: string) => (lang === "ru" ? ru : en);
export const t2 = (lang: Lang, text: Text2 | undefined | null, fallback = "") => (text ? (lang === "ru" ? text.ru || text.en : text.en) : fallback);

/** 62.5 → "62.5", 60 → "60"; kg values never show trailing zeros, and a value that rounds to zero is "0", never "-0". */
export const fmtKg = (kg: number, lang: Lang = "en") => {
  const rounded = Math.round(kg * 100) / 100;
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-GB", { maximumFractionDigits: 2 }).format(rounded === 0 ? 0 : rounded);
};

export const kgLabel = (lang: Lang) => pick(lang, "kg", "кг");

/** "12 × 60 kg" */
export const fmtSet = (reps: number, kg: number, lang: Lang) => `${reps} × ${fmtKg(kg, lang)} ${kgLabel(lang)}`;

export const fmtDate = (iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", opts);
};

export const fmtTime = (iso: string, lang: Lang) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit" });
};

/** 95 → "1:35"; a missing (non-finite) value → "—". */
export const fmtClock = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Russian plural forms: plural(n, ["подход", "подхода", "подходов"]) */
export const pluralRu = (n: number, forms: [string, string, string]) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
};

/**
 * The units keepUnits knows. A unit ends where no letter, mark or digit follows: one after it makes a word ("3 meals",
 * "2 яйца"). Compound units ride on their first part (g/kg, mg/kg, g/day, ml/kg/min, km/h); "уд/мин" is listed whole,
 * as "уд" alone is no unit. No bare "с" for seconds: it is also the preposition ("8 с RIR 2", "зону 2 с 60–65 %"),
 * and the nutrition page spells out "секунд". Serving measures include cups, tablespoons and their Russian forms;
 * the two words of "ст. ложки" stay together too.
 */
const UNITS = String.raw`kcal|bpm|METs?|mg|kg|km|ml|cm|min|g|l|L|h|s|m|W|%|tbsp|cups?|ккал|МЕТ|мг|кг|км|мл|см|мин|Вт|г|л|ч|м|тыс\.|ст\.[ \u00a0]лож(?:ка|ки|ек)|чаш(?:ка|ки|ек|ку)|стакан(?:а|ов)?`;

/**
 * Tags, markdown link targets and URLs match first and pass through untouched. Then: a digit, a plain space and a
 * unit that ends there ("400 mg"); an en dash between digits ("3–6"), which UAX #14 lets a line break after; a unit
 * and its slash before a letter ("г/кг"), where Blink and WebKit break Cyrillic text; "≈" or "±", a plain space and a
 * digit ("≈ 120 g"). Lookaheads, not \b, which treats Cyrillic letters as non-word characters, and no lookbehind,
 * which Safari before 16.4 rejects.
 */
const NUMBER_UNIT = new RegExp(
  String.raw`<\/?[A-Za-z][^<>]*>|\]\([^)]*\)|(?:https?:\/\/|www\.)[^\s<>]*` +
    String.raw`|(\d) (?=(?:${UNITS}|уд\/\u2060?мин)(?![\p{L}\p{M}\d]))` +
    String.raw`|(\d–)(?=\d)|((?:${UNITS}|уд)\/)(?=\p{L})|([≈±]) (?=\d)` +
    String.raw`|(ст\.) (?=лож(?:ка|ки|ек)(?![\p{L}\p{M}\d]))`,
  "gu",
);

/**
 * "400 mg" → "400\u00a0mg", so a phone never ends a line on the number and starts the next with its unit. Decimals
 * (0,4 г/кг) and grouped numbers (1,973 kcal; Intl groups ru-RU with a no-break space) count; "2 eggs" keeps its
 * space. A word joiner (U+2060) after the dash of a range and the slash of a compound unit keeps "3–6 mg/kg" and
 * "0,4 г/кг" whole, and a no-break space keeps "≈" and "±" with their number. A slash counts only after a unit that
 * starts a word ("шаг/мин" and "говядина/баранина" keep theirs). Serving measures ("4 tbsp", "2 чашки") and
 * "8 тыс." also stay with their number. Nothing else changes; a second pass changes nothing.
 */
export const keepUnits = (text: string) =>
  text.replace(NUMBER_UNIT, (match, digit?: string, dash?: string, slash?: string, sign?: string, spoon?: string, at = 0) => {
    if (digit || sign || spoon) return `${digit ?? sign ?? spoon}\u00a0`;
    if (dash) return `${dash}\u2060`;
    if (slash && !/[\p{L}\p{M}]$/u.test(text.slice(Math.max(0, at - 2), at))) return `${slash}\u2060`;
    return match;
  });
