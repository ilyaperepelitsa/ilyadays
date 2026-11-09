/**
 * Pure helpers behind the nutrition calculator's inputs (stream 09 — plans/fitness/09-nutrition.md): parsing the
 * per-browser edits, reading start values from the fitness profile, and picking the newer of the two per field
 * (last writer wins). No storage, no React; the hook lives in inputs.ts. Tested in tests/fitness/nutrition.test.mjs.
 */
import { GOAL_KEYS, ageFromBirthYear } from "../../../lib/fitness/nutrition.mjs";

/** @typedef {import("../../../lib/fitness/types").Snapshot} Snapshot */
/**
 * @typedef {"kg" | "cm" | "age" | "sex" | "bodyFat" | "goal" | "activity" | "meals" | "targetKg"
 *   | "rate-recomp" | "rate-strength" | "rate-hypertrophy" | "hrRest" | "hrMax" | "cooperM" | "hrNow" | "z2Ceiling"} Field
 */
/** @typedef {{ v: string, at: string }} Stamped */
/** @typedef {Partial<Record<Field, Stamped>>} Stamps */
/** @typedef {"edit" | "profile" | "default"} ValueSource */
/** @typedef {{ value: string, source: ValueSource }} Value */

/** @type {readonly Field[]} */
export const FIELDS = Object.freeze([
  "kg", "cm", "age", "sex", "bodyFat", "goal", "activity", "meals", "targetKg",
  "rate-recomp", "rate-strength", "rate-hypertrophy", "hrRest", "hrMax", "cooperM", "hrNow", "z2Ceiling",
]);
const FIELD_SET = new Set(/** @type {readonly string[]} */ (FIELDS));
/** Longest stored text per field (inputs are short numbers or keys). */
export const MAX_TEXT = 40;

/** @param {unknown} v @returns {v is number} */
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** @param {string} iso */
export const timeOf = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** "80,5" → 80.5 (Russian decimal comma); "" or junk → undefined. @param {string} s */
export function toNum(s) {
  const t = String(s).trim().replace(",", ".");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Stored edits from their JSON text; unknown fields, non-string values, over-long text and unparseable times are
 * dropped (hand-edited or old storage never breaks the page).
 * @param {string | null | undefined} raw
 * @returns {Stamps}
 */
export function parseStamps(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    /** @type {Stamps} */
    const out = {};
    for (const [k, e] of Object.entries(obj)) {
      if (!FIELD_SET.has(k) || !e || typeof e !== "object") continue;
      const { v, at } = /** @type {{ v?: unknown, at?: unknown }} */ (e);
      if (typeof v === "string" && v.length <= MAX_TEXT && typeof at === "string" && timeOf(at) > 0) out[/** @type {Field} */ (k)] = { v, at };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * New edits: `prev` plus every string in `patch`, stamped `at` (text cut to MAX_TEXT).
 * @param {Stamps} prev
 * @param {Partial<Record<Field, string>>} patch
 * @param {string} at
 * @returns {Stamps}
 */
export function stampEdits(prev, patch, at) {
  /** @type {Stamps} */
  const next = { ...prev };
  for (const [k, v] of Object.entries(patch)) if (FIELD_SET.has(k) && typeof v === "string") next[/** @type {Field} */ (k)] = { v: v.slice(0, MAX_TEXT), at };
  return next;
}

/**
 * Start values from the fitness profile: settings fields at `settings.updatedAt` (age from the birth year when the
 * current year is known), the latest weigh-in's weight when it is newer than the settings, and the latest body-fat
 * reading.
 * @param {Snapshot} snapshot
 * @param {number} year current year, 0 when unknown (server render)
 * @returns {Stamps}
 */
export function profileStamps(snapshot, year) {
  /** @type {Stamps} */
  const out = {};
  const s = snapshot.settings;
  if (s) {
    const at = s.updatedAt;
    if (isNum(s.bodyweightKg)) out.kg = { v: String(s.bodyweightKg), at };
    if (isNum(s.heightCm)) out.cm = { v: String(s.heightCm), at };
    const age = year ? ageFromBirthYear(s.birthYear, year) : null;
    if (age != null) out.age = { v: String(age), at };
    if (s.sex === "male" || s.sex === "female") out.sex = { v: s.sex, at };
    if (GOAL_KEYS.includes(s.goal)) out.goal = { v: s.goal, at };
  }
  const entries = Object.values(snapshot.bodyweight ?? {})
    .filter((e) => e && isNum(e.kg) && e.kg > 0 && typeof e.at === "string")
    .sort((a, b) => timeOf(b.at) - timeOf(a.at));
  const latest = entries[0];
  if (latest && (!out.kg || timeOf(latest.at) > timeOf(out.kg.at))) out.kg = { v: String(latest.kg), at: latest.at };
  const withFat = entries.find((e) => isNum(e.bodyFatPct));
  if (withFat && isNum(withFat.bodyFatPct)) out.bodyFat = { v: String(withFat.bodyFatPct), at: withFat.at };
  return out;
}

/**
 * The value a field shows: this browser's edit when it is at least as new as the profile value, else the profile
 * value, else the fallback.
 * @param {Field} field
 * @param {Stamps} edits
 * @param {Stamps} profile
 * @param {string} fallback
 * @returns {Value}
 */
export function pickValue(field, edits, profile, fallback) {
  const e = edits[field];
  const p = profile[field];
  if (e && (!p || timeOf(e.at) >= timeOf(p.at))) return { value: e.v, source: "edit" };
  if (p) return { value: p.v, source: "profile" };
  return { value: fallback, source: "default" };
}
