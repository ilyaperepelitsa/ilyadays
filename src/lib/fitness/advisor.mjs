// @ts-check
/**
 * AI advisor (stream 10, plans/fitness/10-ai-advisor.md). Builds ONE OpenAI Responses call with a strict JSON schema
 * that proposes small plan changes from the owner's request and his data, validates what comes back against the
 * program and the catalog, and applies an accepted proposal through program-edit.mjs. Pure: no DOM, no fetch — the
 * caller runs src/lib/trips/openai.mjs completeJson with the owner's own key.
 */
import { adherence, dayKey } from "./analytics.mjs";
import { exerciseById as catalogExerciseById, isAvailable as catalogIsAvailable } from "./catalog.mjs";
import { deloadWeek, holdActive, holdDay, incrementFor, initialState, isAssisted, plateauOf, roundLoad } from "./progression.mjs";
import { DEFAULT_CATALOG, sessionStatus, summarize } from "./session.mjs";
import { GOAL_MODES, RULES, clamp, newId, slotRole, toIso, toMs, unitOf } from "./templates.mjs";
import {
  GOAL_BOUNDS, HOLD_WEEKS, UNIT_BOUNDS, addLegs, legsMode, likeForLike, setDays, setHold, setSlot, slotBounds, swapCandidates,
  swapSlot,
} from "./program-edit.mjs";

import { exerciseAllowed, trainingPreferences } from "./plan-preferences.mjs";

/** @typedef {import("./types").Adjustment} Adjustment */
/** @typedef {import("./types").BodyweightEntry} BodyweightEntry */
/** @typedef {import("./types").Exercise} Exercise */
/** @typedef {import("./types").ExerciseSlot} ExerciseSlot */
/** @typedef {import("./types").ExerciseState} ExerciseState */
/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").Lang} Lang */
/** @typedef {import("./types").LlmCall} LlmCall */
/** @typedef {import("./types").LoggedSet} LoggedSet */
/** @typedef {import("./types").Program} Program */
/** @typedef {import("./types").ProgramDay} ProgramDay */
/** @typedef {import("./types").Session} Session */
/** @typedef {import("./types").Settings} Settings */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {Date | string | number} TimeLike */
/** @typedef {"set_days" | "swap_exercise" | "change_sets" | "change_reps" | "change_rir" | "change_load" | "deload" | "hold" | "add_legs" | "note"} ChangeType */
/**
 * One proposed change, as the schema returns it (every field present; "" and 0 when a type does not use it).
 * @typedef {object} AdvisorChange
 * @property {ChangeType} type
 * @property {string} dayKey
 * @property {string} slotId
 * @property {string} exerciseId
 * @property {string} newExerciseId
 * @property {number} value
 * @property {number} value2
 * @property {Text2} text
 * @property {Text2} reason
 */
/** @typedef {{ summary: Text2, changes: AdvisorChange[], cautions: Text2[] }} Proposal */
/** @typedef {{ change: AdvisorChange, reason: Text2 }} Dropped */
/** @typedef {{ exerciseById: (id: string) => Exercise | undefined, isAvailable?: (id: string, gym?: Gym | null) => boolean }} AdvisorCatalog */

/** @type {AdvisorCatalog} */
const DEFAULT_LOOKUP = { exerciseById: catalogExerciseById, isAvailable: catalogIsAvailable };

/** @type {readonly ChangeType[]} */
export const CHANGE_TYPES = Object.freeze(["set_days", "swap_exercise", "change_sets", "change_reps", "change_rir", "change_load", "deload", "hold", "add_legs", "note"]);
/** The advisor proposes at most this many changes; more are dropped. */
export const MAX_CHANGES = 6;
/** A proposed working weight may rise at most 10 % (plus one machine step for rounding) over the current one. */
export const MAX_LOAD_JUMP = 0.1;
/** Advisor deloads: 5–20 % lighter (research/01 Table 7: load × 0.8–0.9). */
export const DELOAD_PCT = Object.freeze(/** @type {[number, number]} */ ([5, 20]));
/** Sessions summarised for the model. */
export const RECENT_SESSIONS = 8;
/** Longest request text accepted. */
export const MAX_REQUEST = 1000;

const SLOT_TYPES = new Set(["swap_exercise", "change_sets", "change_reps", "change_rir"]);
const STATE_TYPES = new Set(["change_load", "deload", "hold"]);
const LIMIT = { summary: 1500, text: 300, reason: 800, caution: 500 };
const ZERO_OK = new Set(["bodyweight", "band", "assisted"]);

/** A model or shape problem the advisor panel translates (`code`: key, shape). */
export class AdvisorError extends Error {
  /** @param {string} code */
  constructor(code) {
    super(code);
    this.name = "AdvisorError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ schema */

/** @returns {Record<string, unknown>} */
const text2Schema = () => ({
  type: "object",
  additionalProperties: false,
  required: ["en", "ru"],
  properties: { en: { type: "string" }, ru: { type: "string" } },
});

/**
 * The strict json_schema of an advisor answer. Strict mode demands `additionalProperties: false` on every object
 * and every property in `required`; unused fields come back as "" or 0.
 * @returns {Record<string, unknown>}
 */
export function advisorSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "changes", "cautions"],
    properties: {
      summary: text2Schema(),
      changes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "dayKey", "slotId", "exerciseId", "newExerciseId", "value", "value2", "text", "reason"],
          properties: {
            type: { type: "string", enum: [...CHANGE_TYPES] },
            dayKey: { type: "string" },
            slotId: { type: "string" },
            exerciseId: { type: "string" },
            newExerciseId: { type: "string" },
            value: { type: "number" },
            value2: { type: "number" },
            text: text2Schema(),
            reason: text2Schema(),
          },
        },
      },
      cautions: { type: "array", items: text2Schema() },
    },
  };
}

/** The schema as a value (tests, documentation). */
export const ADVISOR_SCHEMA = Object.freeze(advisorSchema());

/* ------------------------------------------------------------------ prompt */

export const DEVELOPER_PROMPT = `You are the strength coach inside the gym planner on ilyadays.com. One person (the owner) trains on machines in a commercial gym, phone in hand. You read his request and his data and propose small, safe changes to his program. The app's engine does all load maths; he reviews your proposal and applies it or not.

How the engine works (work with it, do not re-implement it):
- A goal mode sets sets x reps x RIR (reps in reserve) x rest for every slot from the slot's role (primary, secondary, isolation, small, trunk, hold, carry). The current mode and the bounds every value must stay inside are in context.goalMode.
- Double progression with RIR: a set is made when reps >= target and RIR >= target RIR - 1. All sets made below the top of the range -> +1 rep next time (more when the sets had reps in reserve beyond the target). All at the top -> weight + one step (the larger of the machine increment and stepPct) and back to the bottom of the range, but only when his weakest set says the new weight still allows the bottom of the range at the target RIR; until then the rep target keeps rising past the top (to 15 reps for compounds, 20 for isolation), and at that ceiling the exercise is flagged for a variant with smaller steps. Every set at the top with RIR >= target + 1, or a first set >= top + overshootReps -> a bigger jump (at most +10 %). Fewer working sets logged than planned -> hold. Missed target -> hold. Below the range -> failed; after failsBeforeDeload failed sessions in a row the weight drops deloadPct.
- Plateau memory: after such a deload the engine remembers the weight that failed; it goes back to that weight only after 2 sessions in a row with every set at the top of the range whose sets carry that weight (3 after the second deload from it, with 2 more reps in hand that he earns by adding reps first), and until then takes a smaller step below it or holds at the top; a calibration session counts like any other but does not jump back to it either. states[].plateau = { failedKg, times } while that is pending, else null: explain a long hold at the top with it, and suggest smaller steps or a variant when times >= 2.
- The first session of a new or swapped exercise, after a goal, rep-range or RIR change, and after a break of 14+ days is a calibration session: the best set re-anchors the working weight and misses do not count.
- Breaks are handled automatically: 14-27 days without an exercise -> 5-10 % lighter (to the nearest machine step; when the steps are too coarse for that, the same weight with 2 fewer reps); 28+ days -> 10-15 % lighter, back to the bottom of the range. Do not add a deload for a break unless he reports other problems.
- A planned deload week comes every deloadEveryWeeks weeks (40 % fewer sets, same weights, 2 more reps in reserve).
- Days rotate in order (A -> B -> C -> A) whatever the calendar, so a missed day never skips a workout.
- A swapped-in exercise starts at 85 % of the equivalent weight (60 % for another movement pattern) and calibrates.
- Loads are kg. Dumbbells and carries: kg per hand. Assisted machines: the number is the assistance, lower is harder. Bodyweight exercises: added load, 0 = bodyweight only.
- context.states[] is what the engine plans for his NEXT session of each exercise (workingKg x targetReps; his last session is already counted in it). context.recentSessions is what he actually lifted. states[].heldUntil = a weight hold already set (the day it ends), else null.

His goals and constraints (always respect them):
- Keep his goals: fat loss while keeping and building strength, pec development (the pec deck stays unless it hurts), a strong back, arm strength, ab strength, and longevity (the lower-back machine, carries, the cardio finishers).
- Machines and cables first (selectorized, plate-loaded, cable); he trains alone.
- No leg training unless he asks for legs; then use add_legs.
- Pain is a stop signal: swap the exercise that hurts for a pain-free option from swapOptions (never "push through"), and add a caution to see a doctor or physiotherapist if pain is sharp, lasts more than a week, or comes with swelling, numbness or weakness. Do not diagnose.
- Never raise a weight by more than 10 % at once. No sets to failure on free-weight compound lifts.
- Prefer the smallest change that solves the request: at most 6 changes, usually 1-3. If nothing should change, return a single note or hold.
- Use only ids from the context: dayKey and slotId from program.days, exerciseId from the program or the states, newExerciseId only from swapOptions of that exercise.

Change types (fill every field; "" for unused strings, 0 for unused numbers):
- set_days: value = 2, 3 or 4 days per week. The program is rebuilt from the matching template and keeps his swaps and tweaks. Do not combine it with swap_exercise, change_sets, change_reps or change_rir (he can ask again after applying); change_load, deload, hold, add_legs and note are fine with it.
- swap_exercise: dayKey, slotId, exerciseId = the current exercise, newExerciseId = from swapOptions[exerciseId].
- change_sets: dayKey, slotId, value = sets per session.
- change_reps: dayKey, slotId, value = bottom and value2 = top of the rep range (in the slot's unit: reps, seconds or meters).
- change_rir: dayKey, slotId, value = the reps-in-reserve target.
- change_load: exerciseId, value = the working weight for the next session, value2 = the target reps (0 = keep).
- deload: exerciseId, or "" for every exercise of the program; value = percent lighter (5-20).
- hold: exerciseId, value = weeks (1-8; 0 = 1): no weight increase in his sessions before then; reps still rise within the range, and misses and deloads still apply (say why in reason). To go back to a lighter weight, use change_load instead. While a hold is on (heldUntil, or a hold in the same answer) never propose a heavier change_load for that exercise.
- add_legs: add the legs day (only when he asked for legs).
- note: advice with no program change; the advice goes in text.
text = the change in one short line. reason = why, in one or two sentences, from his data where possible.
summary = two or three sentences that answer his request. cautions = safety points (may be empty).
Write every text twice: English (en) and natural Russian as Russian gym-goers speak (ru).`;

/* ------------------------------------------------------------------ context */

/** @param {number} x @param {number} [dp] */
const round = (x, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
/** @param {string | null | undefined} iso */
const dateOf = (iso) => (typeof iso === "string" ? iso.slice(0, 10) : null);
/** @param {unknown} v @returns {v is Record<string, any>} */
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** @template T @param {Record<string, T> | T[] | null | undefined} rows @returns {T[]} */
const listOf = (rows) => (Array.isArray(rows) ? rows : Object.values(rows ?? {}));

/** @param {Program} program @returns {string[]} */
const programExerciseIds = (program) => [...new Set(program.days.flatMap((d) => d.slots.map((s) => s.exerciseId)))];

/** @param {string} id @param {AdvisorCatalog} cat */
const enName = (id, cat) => cat.exerciseById(id)?.name.en ?? id;

/**
 * Latest weigh-in and the change over the 28 days before it.
 * @param {BodyweightEntry[]} entries @param {Settings | null | undefined} settings
 */
function bodyweightInfo(entries, settings) {
  const list = entries.filter((e) => Number.isFinite(e.kg) && e.kg > 0).sort((a, b) => toMs(a.at) - toMs(b.at));
  const last = list[list.length - 1];
  if (!last) return { latestKg: settings?.bodyweightKg ?? null, latestDate: null, change28dKg: null };
  const from = toMs(last.at) - 28 * 86_400_000;
  const base = list.find((e) => toMs(e.at) >= from);
  return {
    latestKg: last.kg,
    latestDate: dateOf(last.at),
    change28dKg: base && base !== last ? round(last.kg - base.kg) : null,
  };
}

/**
 * Everything the model sees besides the request, compact: the program (slots with role, unit, bounds), exercise
 * states, the last 8 sessions (session.mjs summarize), adherence (analytics.adherence), body weight, recent plan
 * changes and the swap options per program exercise at this gym. Exported so the page can show what it sends.
 * @param {{ program: Program, states?: Record<string, ExerciseState> | null, sessions?: Record<string, Session> | Session[] | null,
 *   sets?: Record<string, LoggedSet> | LoggedSet[] | null, settings?: Settings | null, bodyweight?: Record<string, BodyweightEntry> | BodyweightEntry[] | null,
 *   adjustments?: Record<string, Adjustment> | Adjustment[] | null, gym?: Gym | null, lang?: Lang, now?: TimeLike, catalog?: AdvisorCatalog }} input
 */
export function advisorContext({ program, states, sessions, sets, settings, bodyweight, adjustments, gym, lang = "en", now, catalog }) {
  const cat = catalog ?? DEFAULT_LOOKUP;
  const at = toMs(now);
  const goal = GOAL_MODES[program.goal] ?? GOAL_MODES.recomp;
  const stateMap = states ?? {};
  const sessionRows = listOf(sessions);
  const setRows = listOf(sets);
  const ids = programExerciseIds(program);
  const done = sessionRows
    .filter((s) => {
      const st = sessionStatus(s, at);
      return st === "finished" || st === "auto_closed";
    })
    .sort((a, b) => toMs(b.startedAt) - toMs(a.startedAt))
    .slice(0, RECENT_SESSIONS);
  const live = sessionRows.find((s) => sessionStatus(s, at) === "active");
  const adh = adherence(sessionRows, { weeks: 6, daysPerWeek: program.daysPerWeek, now: at });
  const birthYear = settings?.birthYear;
  const recentStates = Object.values(stateMap).filter((s) => ids.includes(s.exerciseId) || (s.lastAt && at - toMs(s.lastAt) < 60 * 86_400_000));
  const changes = listOf(adjustments)
    .filter((a) => isObj(a) && typeof a.at === "string")
    .sort((a, b) => toMs(b.at) - toMs(a.at))
    .slice(0, 5)
    .map((a) => {
      const out = /** @type {Record<string, any>} */ (a.output ?? {});
      const what = typeof out.summary?.en === "string" && out.summary.en
        ? out.summary.en
        : Array.isArray(out.lines) ? out.lines.map((/** @type {any} */ l) => l?.en).filter(Boolean).join("; ") : "";
      return { date: dateOf(a.at), source: a.source, applied: a.applied, what: String(what).slice(0, 300) };
    });
  /** @type {Record<string, { id: string, name: string, equipment: string }[]>} */
  const swapOptions = {};
  for (const id of ids) {
    swapOptions[id] = swapCandidates(id, gym)
      .filter((c) => c.available && exerciseAllowed(program, cat.exerciseById(c.id)))
      .slice(0, 6)
      .map((c) => ({ id: c.id, name: enName(c.id, cat), equipment: cat.exerciseById(c.id)?.equipment ?? "" }));
  }
  const block = deloadWeek(program, at);
  return {
    today: new Date(at).toISOString().slice(0, 10),
    pageLanguage: lang,
    owner: {
      bodyweight: bodyweightInfo(listOf(bodyweight), settings),
      heightCm: settings?.heightCm ?? null,
      age: typeof birthYear === "number" ? new Date(at).getUTCFullYear() - birthYear : null,
      sex: settings?.sex ?? null,
      gym: gym ? { name: gym.name, checklist: gym.available.length > 0, missing: gym.missing.length } : null,
    },
    goalMode: {
      id: program.goal,
      supportingGoals: trainingPreferences(program.preferences, program.goal).secondaryGoals,
      name: goal.name.en,
      summary: goal.summary.en,
      bounds: GOAL_BOUNDS[program.goal] ?? GOAL_BOUNDS.recomp,
      unitBounds: UNIT_BOUNDS,
      setsPerMuscleWeek: goal.setsPerMuscleWeek,
    },
    program: {
      templateId: program.templateId,
      trainingPreferences: program.preferences ?? null,
      name: program.name.en,
      daysPerWeek: program.daysPerWeek,
      legs: legsMode(program) ?? "none",
      deloadEveryWeeks: program.deloadEveryWeeks,
      blockWeek: block.week,
      deloadWeekNow: block.due,
      progression: (() => {
        const p = program.progression?.double;
        return p ? { stepPct: p.stepPct, failsBeforeDeload: p.failsBeforeDeload, deloadPct: p.deloadPct, overshootReps: p.overshootReps } : null;
      })(),
      days: program.days.map((d) => ({
        key: d.key,
        name: d.name.en,
        slots: d.slots.map((s) => ({
          slotId: s.slotId,
          exerciseId: s.exerciseId,
          name: enName(s.exerciseId, cat),
          equipment: cat.exerciseById(s.exerciseId)?.equipment ?? "",
          role: slotRole(program, s, cat),
          unit: unitOf(cat.exerciseById(s.exerciseId)),
          sets: s.sets,
          reps: [s.repRange[0], s.repRange[1]],
          rir: s.rir,
          restSec: s.restSec,
          superset: s.superset ?? "",
          priority: Boolean(s.priority),
        })),
      })),
    },
    states: recentStates.map((s) => ({
      exerciseId: s.exerciseId,
      workingKg: s.workingKg,
      targetReps: s.targetReps,
      repRange: [s.repRange[0], s.repRange[1]],
      rir: s.rir,
      e1rm: round(s.e1rm),
      lastOutcome: s.lastOutcome,
      fails: s.fails,
      sessions: s.sessions,
      lastDate: dateOf(s.lastAt),
      daysSince: s.lastAt ? Math.floor((at - toMs(s.lastAt)) / 86_400_000) : null,
      heldUntil: holdActive(s, at) ? dayKey(/** @type {string} */ (s.holdUntil)) : null,
      plateau: (() => {
        const p = plateauOf(s);
        return p ? { failedKg: p.kg, times: p.times } : null;
      })(),
    })),
    recentSessions: done.map((s) => {
      const sum = summarize(s, setRows, DEFAULT_CATALOG);
      return {
        date: dateOf(s.startedAt),
        dayKey: s.dayKey,
        status: sessionStatus(s, at),
        minutes: sum.minutes,
        hardSets: sum.hardSets,
        tonnageKg: sum.tonnage,
        readiness: s.readiness ?? null,
        notes: s.notes ? s.notes.slice(0, 200) : "",
        exercises: sum.perExercise.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets,
          top: e.topSet ? `${e.topSet.kg} kg x ${e.topSet.reps}${e.topSet.rir == null ? "" : ` @RIR ${e.topSet.rir}`}` : null,
          e1rm: round(e.e1rm),
        })),
      };
    }),
    sessionInProgress: live ? { dayKey: live.dayKey, startedAt: live.startedAt } : null,
    adherence: {
      daysPerWeek: program.daysPerWeek,
      thisWeek: adh.thisWeek.done,
      rate: adh.rate == null ? null : round(adh.rate, 2),
      streakWeeks: adh.streak,
      daysSinceLastSession: adh.daysSinceLast,
      weeks: adh.weeks.map((w) => ({ week: w.key, done: w.done, planned: w.planned })),
    },
    recentPlanChanges: changes,
    swapOptions,
  };
}

/**
 * Words that mean the owner asked for leg work (EN and RU). The engine never adds legs without it.
 * @param {string} request
 */
export function asksForLegs(request) {
  return /\b(legs?|squats?|squatting|lunges?|quads?|hamstrings?|glutes?|calf|calves|deadlifts?)\b/i.test(request)
    || /(?<![а-яё])(ног(а|и|у|е|ой|ам|ами|ах)?|присед\S*|выпад\S*|квадрицепс\S*|ягодиц\S*|икр(ы|ам|ах|оножн\S*)|станов(ая|ую|ой)|бицепс\S* бедра)(?![а-яё])/i.test(request);
}

/**
 * The advisor call: developer prompt (engine rules, the owner's constraints, change types), the request plus the
 * compact JSON context as the user message, and the strict schema.
 * @param {Parameters<typeof advisorContext>[0] & { request: string }} input
 * @returns {LlmCall}
 */
export function adjustCall(input) {
  const request = String(input.request ?? "").trim().slice(0, MAX_REQUEST);
  const context = advisorContext(input);
  const legs = asksForLegs(request) ? "He mentions legs: add_legs is allowed if it fits his request." : "He did not ask for legs: do not add leg training.";
  return {
    name: "fitness_plan_adjustment",
    developer: DEVELOPER_PROMPT,
    user: `His request, in his own words (English or Russian):\n"""\n${request}\n"""\n${legs}\n\nContext (JSON):\n${JSON.stringify(context)}`,
    schema: advisorSchema(),
  };
}

/* ------------------------------------------------------------------ validation */

/** @param {unknown} v @param {number} max @returns {Text2 | null} */
function cleanText(v, max) {
  if (!isObj(v)) return null;
  const en = typeof v.en === "string" ? v.en.trim().slice(0, max) : "";
  const ru = typeof v.ru === "string" ? v.ru.trim().slice(0, max) : "";
  if (!en && !ru) return null;
  return { en: en || ru, ru: ru || en };
}

/** @param {unknown} v */
const str = (v) => (typeof v === "string" ? v.trim().slice(0, 64) : "");
/** @param {unknown} v */
const numOr0 = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
/** @param {number} v */
const isWhole = (v) => Math.abs(v - Math.round(v)) < 1e-9;

const WHY = /** @type {const} */ ({
  type: { en: "Unknown change type.", ru: "Неизвестный тип изменения." },
  slot: { en: "No such exercise slot in your program.", ru: "В программе нет такого упражнения." },
  exercise: { en: "Unknown exercise.", ru: "Неизвестное упражнение." },
  notInProgram: { en: "That exercise is not in your program.", ru: "Этого упражнения нет в программе." },
  likeForLike: { en: "Not a like-for-like replacement for that exercise.", ru: "Не равноценная замена этому упражнению." },
  available: { en: "Not available at your gym.", ru: "Нет в вашем зале." },
  dayHasIt: { en: "That day already has this exercise.", ru: "В этот день это упражнение уже есть." },
  same: { en: "Already the current value.", ru: "Это уже текущее значение." },
  range: { en: "Outside the safe range for this goal.", ru: "Вне безопасного диапазона для этой цели." },
  jump: { en: "More than a 10 % jump in weight at once.", ru: "Скачок веса больше 10 % за раз." },
  legs: { en: "Legs only when you ask for them.", ru: "Ноги — только по вашей просьбе." },
  withDays: { en: "Changing the days rebuilds the program; ask again for this change afterwards.", ru: "Смена числа дней пересобирает программу; попросите это изменение ещё раз после неё." },
  tooMany: { en: "More than 6 changes.", ru: "Больше 6 изменений." },
  duplicate: { en: "The same change twice.", ru: "Одно и то же изменение дважды." },
  empty: { en: "Empty note.", ru: "Пустая заметка." },
  history: { en: "No logged sessions for this exercise yet.", ru: "По этому упражнению ещё нет тренировок." },
  held: { en: "The weight is on hold: nothing heavier before the hold ends.", ru: "Вес зафиксирован: тяжелее нельзя, пока не закончится фиксация." },
});

/**
 * The slot a change names: dayKey + slotId, else the slot id alone, else the exercise (unique in the program, or the
 * one on dayKey).
 * @param {Program} program @param {string} dayKey @param {string} slotId @param {string} exerciseId
 * @returns {{ day: ProgramDay, slot: ExerciseSlot } | null}
 */
function findSlot(program, dayKey, slotId, exerciseId) {
  if (slotId) {
    for (const day of program.days) {
      if (dayKey && day.key !== dayKey) continue;
      const slot = day.slots.find((s) => s.slotId === slotId);
      if (slot) return { day, slot };
    }
    for (const day of program.days) {
      const slot = day.slots.find((s) => s.slotId === slotId);
      if (slot) return { day, slot };
    }
  }
  if (!exerciseId) return null;
  const hits = program.days.flatMap((day) => day.slots.filter((s) => s.exerciseId === exerciseId).map((slot) => ({ day, slot })));
  if (hits.length === 1) return hits[0];
  return hits.find((h) => h.day.key === dayKey) ?? null;
}

/** The slot an exercise state belongs to (first slot that uses it). @param {Program} program @param {string} exerciseId */
const slotOfExercise = (program, exerciseId) => program.days.flatMap((d) => d.slots).find((s) => s.slotId && s.exerciseId === exerciseId);
/** `kg` is a heavier setting than `than` (assisted machines: less assistance). @param {number} kg @param {number} than @param {Exercise} ex */
const heavier = (kg, than, ex) => (isAssisted(ex) ? kg < than - 0.005 : kg > than + 0.005);

/**
 * Check one raw change. Returns the normalised change (slot fields filled from the program, unused fields "" / 0)
 * or the reason it is dropped.
 * @param {unknown} raw @param {Program} program @param {AdvisorCatalog} cat
 * @param {{ states: Record<string, ExerciseState>, gym: Gym | null, allowLegs: boolean, bodyweightKg: number | null, now: number }} ctx
 * @returns {{ ok: true, change: AdvisorChange } | { ok: false, change: AdvisorChange, reason: Text2 }}
 */
function checkChange(raw, program, cat, ctx) {
  const r = isObj(raw) ? raw : {};
  const type = /** @type {ChangeType} */ (CHANGE_TYPES.includes(/** @type {ChangeType} */ (r.type)) ? r.type : "note");
  /** @type {AdvisorChange} */
  const change = {
    type,
    dayKey: str(r.dayKey),
    slotId: str(r.slotId),
    exerciseId: str(r.exerciseId),
    newExerciseId: str(r.newExerciseId),
    value: numOr0(r.value),
    value2: numOr0(r.value2),
    text: cleanText(r.text, LIMIT.text) ?? { en: "", ru: "" },
    reason: cleanText(r.reason, LIMIT.reason) ?? { en: "", ru: "" },
  };
  const bad = (/** @type {Text2} */ reason) => ({ ok: /** @type {const} */ (false), change, reason });
  const good = () => ({ ok: /** @type {const} */ (true), change });
  if (!CHANGE_TYPES.includes(/** @type {ChangeType} */ (r.type))) return bad(WHY.type);

  if (SLOT_TYPES.has(type)) {
    const hit = findSlot(program, change.dayKey, change.slotId, change.exerciseId);
    if (!hit) return bad(WHY.slot);
    change.dayKey = hit.day.key;
    change.slotId = hit.slot.slotId;
    change.exerciseId = hit.slot.exerciseId;
    const unit = unitOf(cat.exerciseById(hit.slot.exerciseId));
    const b = slotBounds(program.goal, unit);
    if (type === "swap_exercise") {
      change.value = 0;
      change.value2 = 0;
      const to = cat.exerciseById(change.newExerciseId);
      if (!to) return bad(WHY.exercise);
      if (to.id === hit.slot.exerciseId) return bad(WHY.same);
      if (!likeForLike(hit.slot.exerciseId, to.id)) return bad(WHY.likeForLike);
      const available = cat.isAvailable ?? catalogIsAvailable;
      if (ctx.gym && !available(to.id, ctx.gym)) return bad(WHY.available);
      if (hit.day.slots.some((s) => s.exerciseId === to.id)) return bad(WHY.dayHasIt);
      return good();
    }
    change.newExerciseId = "";
    if (type === "change_sets") {
      change.value2 = 0;
      if (!isWhole(change.value) || change.value < b.sets[0] || change.value > b.sets[1]) return bad(WHY.range);
      change.value = Math.round(change.value);
      return change.value === hit.slot.sets ? bad(WHY.same) : good();
    }
    if (type === "change_reps") {
      const lo = change.value;
      const hi = change.value2;
      if (!isWhole(lo) || !isWhole(hi) || lo > hi || lo < b.reps[0] || hi > b.reps[1]) return bad(WHY.range);
      change.value = Math.round(lo);
      change.value2 = Math.round(hi);
      return change.value === hit.slot.repRange[0] && change.value2 === hit.slot.repRange[1] ? bad(WHY.same) : good();
    }
    // change_rir
    change.value2 = 0;
    if (!isWhole(change.value) || change.value < b.rir[0] || change.value > b.rir[1]) return bad(WHY.range);
    change.value = Math.round(change.value);
    return change.value === hit.slot.rir ? bad(WHY.same) : good();
  }

  if (STATE_TYPES.has(type)) {
    change.dayKey = "";
    change.slotId = "";
    change.newExerciseId = "";
    const ids = programExerciseIds(program);
    if (type === "deload" && !change.exerciseId) {
      change.value2 = 0;
      if (change.value < DELOAD_PCT[0] || change.value > DELOAD_PCT[1]) return bad(WHY.range);
      return good();
    }
    const exercise = cat.exerciseById(change.exerciseId);
    if (!exercise) return bad(WHY.exercise);
    if (!ids.includes(exercise.id) && !ctx.states[exercise.id]) return bad(WHY.notInProgram);
    if (type === "deload") {
      change.value2 = 0;
      if (change.value < DELOAD_PCT[0] || change.value > DELOAD_PCT[1]) return bad(WHY.range);
      return good();
    }
    if (type === "hold") {
      // value = weeks (master plan §16: ExerciseState.holdUntil); 0 = the shortest hold
      change.value2 = 0;
      const weeks = change.value === 0 ? HOLD_WEEKS[0] : change.value;
      if (!isWhole(weeks) || weeks < HOLD_WEEKS[0] || weeks > HOLD_WEEKS[1]) return bad(WHY.range);
      change.value = Math.round(weeks);
      return good();
    }
    // change_load
    const kg = change.value;
    const zeroOk = ZERO_OK.has(exercise.equipment) || isAssisted(exercise);
    if (!(kg >= 0) || kg > 500 || (!zeroOk && kg <= 0)) return bad(WHY.range);
    const prev = ctx.states[exercise.id];
    if (prev && prev.workingKg > 0) {
      const inc = incrementFor(exercise, ctx.gym) || 0;
      if (isAssisted(exercise)) {
        const bw = ctx.bodyweightKg && ctx.bodyweightKg > 0 ? ctx.bodyweightKg : RULES.bodyweightRefKg;
        const floor = bw - (1 + MAX_LOAD_JUMP) * Math.max(0, bw - prev.workingKg) - inc;
        if (kg < floor - 1e-9) return bad(WHY.jump);
      } else if (kg > prev.workingKg * (1 + MAX_LOAD_JUMP) + inc + 1e-9) {
        return bad(WHY.jump);
      }
      // a weight hold (master plan §16): nothing heavier before its date; lighter is how a hold goes back down
      if (heavier(kg, prev.workingKg, exercise) && holdActive(prev, ctx.now)) return bad(WHY.held);
    } else if (kg > 300) {
      return bad(WHY.range);
    }
    const reps = change.value2;
    if (reps !== 0) {
      const slot = slotOfExercise(program, exercise.id);
      const range = slot ? slot.repRange : prev?.repRange ?? exercise.repRange;
      if (!isWhole(reps) || reps < range[0] || reps > range[1]) return bad(WHY.range);
      change.value2 = Math.round(reps);
    }
    return Math.abs(kg - (prev?.workingKg ?? -1)) < 0.005 && (change.value2 === 0 || change.value2 === prev?.targetReps) ? bad(WHY.same) : good();
  }

  change.dayKey = "";
  change.slotId = "";
  change.exerciseId = "";
  change.newExerciseId = "";
  if (type === "set_days") {
    change.value2 = 0;
    if (![2, 3, 4].includes(change.value)) return bad(WHY.range);
    return change.value === program.daysPerWeek ? bad(WHY.same) : good();
  }
  change.value = 0;
  change.value2 = 0;
  if (type === "add_legs") {
    if (!ctx.allowLegs) return bad(WHY.legs);
    return legsMode(program) ? bad(WHY.same) : good();
  }
  // note
  return change.text.en || change.text.ru ? good() : bad(WHY.empty);
}

/** @param {AdvisorChange} a @param {AdvisorChange} b */
const sameTarget = (a, b) => a.type === b.type && (
  SLOT_TYPES.has(a.type) ? a.slotId === b.slotId
  : STATE_TYPES.has(a.type) ? a.exerciseId === b.exerciseId
  : a.type !== "note" || a.text.en === b.text.en
);

/**
 * Keep only what is safe to apply: known types, slots and exercises of this program, like-for-like swaps available
 * at the gym, values inside the goal's bounds, weight jumps ≤ 10 %, legs only when asked, no slot changes next to a
 * days change, no duplicates, at most MAX_CHANGES, no heavier change_load for an exercise whose weight is held (a
 * hold ahead of `opts.now`, default now, or a hold in the same answer). Everything dropped is listed with its
 * reason. Throws AdvisorError("shape") when the answer is not an object.
 * @param {unknown} raw @param {Program} program @param {AdvisorCatalog | null} [catalog]
 * @param {{ states?: Record<string, ExerciseState> | null, gym?: Gym | null, allowLegs?: boolean, bodyweightKg?: number | null, now?: Date | string | number }} [opts]
 * @returns {Proposal & { dropped: Dropped[] }}
 */
export function validateProposal(raw, program, catalog, opts = {}) {
  if (!isObj(raw)) throw new AdvisorError("shape");
  const cat = catalog ?? DEFAULT_LOOKUP;
  const ctx = { states: opts.states ?? {}, gym: opts.gym ?? null, allowLegs: Boolean(opts.allowLegs), bodyweightKg: opts.bodyweightKg ?? null, now: toMs(opts.now ?? Date.now()) };
  const summary = cleanText(raw.summary, LIMIT.summary) ?? { en: "", ru: "" };
  const cautions = (Array.isArray(raw.cautions) ? raw.cautions : [])
    .map((c) => cleanText(c, LIMIT.caution))
    .filter(/** @returns {c is Text2} */ (c) => Boolean(c))
    .slice(0, 6);
  const items = Array.isArray(raw.changes) ? raw.changes : [];
  const checked = items.map((item) => checkChange(item, program, cat, ctx));
  const daysChange = checked.some((c) => c.ok && c.change.type === "set_days");
  const holding = new Set(checked.filter((c) => c.ok && c.change.type === "hold").map((c) => c.change.exerciseId));
  /** a heavier change_load for an exercise this answer also holds @param {AdvisorChange} c */
  const raisesHeld = (c) => {
    if (c.type !== "change_load" || !holding.has(c.exerciseId)) return false;
    const prev = ctx.states[c.exerciseId];
    const ex = cat.exerciseById(c.exerciseId);
    return Boolean(prev && ex && heavier(c.value, prev.workingKg, ex));
  };
  /** @type {AdvisorChange[]} */
  const changes = [];
  /** @type {Dropped[]} */
  const dropped = [];
  for (const c of checked) {
    if (!c.ok) dropped.push({ change: c.change, reason: c.reason });
    else if (daysChange && SLOT_TYPES.has(c.change.type)) dropped.push({ change: c.change, reason: WHY.withDays });
    else if (raisesHeld(c.change)) dropped.push({ change: c.change, reason: WHY.held });
    else if (changes.some((x) => sameTarget(x, c.change))) dropped.push({ change: c.change, reason: WHY.duplicate });
    else if (changes.length >= MAX_CHANGES) dropped.push({ change: c.change, reason: WHY.tooMany });
    else changes.push(c.change);
  }
  return { summary, changes, cautions, dropped };
}

/* ------------------------------------------------------------------ applying */

/** @param {number} kg @param {Exercise} ex @param {Lang} lang */
function loadText(kg, ex, lang) {
  const n = new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-GB", { maximumFractionDigits: 2 }).format(round(kg, 2));
  const k = `${n} ${lang === "ru" ? "кг" : "kg"}`;
  if (isAssisted(ex)) return lang === "ru" ? `помощь ${k}` : `assistance ${k}`;
  if (ex.equipment === "bodyweight") return kg > 0 ? (lang === "ru" ? `свой вес + ${k}` : `bodyweight + ${k}`) : (lang === "ru" ? "свой вес" : "bodyweight");
  if (ex.equipment === "dumbbell" || ex.equipment === "kettlebell" || ex.pattern === "carry") return lang === "ru" ? `${k} на руку` : `${k} per hand`;
  return k;
}

/**
 * `pct` % easier in effective terms — the rule of progression.mjs's internal scaleLoad: assistance grows so that
 * bodyweight − assistance drops by pct (one increment per 10 % without a bodyweight); other loads scale down.
 * @param {number} kg @param {number} pct @param {Exercise} ex @param {Gym | null} gym @param {number | null} bw
 */
function easierBy(kg, pct, ex, gym, bw) {
  const factor = 1 - pct / 100;
  if (isAssisted(ex)) {
    if (bw && bw > 0) return Math.min(bw, roundLoad(bw - (bw - kg) * factor, ex, gym, "easier"));
    const inc = incrementFor(ex, gym) || 5;
    return roundLoad(kg + Math.max(1, Math.round(pct / 10)) * inc, ex, gym, "easier");
  }
  return roundLoad(kg * factor, ex, gym, "easier");
}

/**
 * The plateau memory (master plan §16 rule 5) of a state whose weight the adviser sets: kept, with its streak started
 * over when the weight changes (the streak counts sessions at one weight, as in the engine); forgotten with a new rep
 * range or RIR, as convertState does. A state without one does not grow the field.
 * @param {ExerciseState | undefined} prev @param {number} kg @param {[number, number]} range @param {number} rir
 * @returns {Pick<ExerciseState, "plateau">}
 */
function plateauAfter(prev, kg, range, rir) {
  if (prev?.plateau == null) return {};
  const memo = plateauOf(prev);
  if (!memo || prev.repRange[0] !== range[0] || prev.repRange[1] !== range[1] || prev.rir !== rir) return { plateau: null };
  return { plateau: Math.abs(kg - prev.workingKg) < 0.005 ? memo : { ...memo, streak: 0 } };
}

/**
 * Apply a validated proposal: program changes first (days, legs, then slot changes, through program-edit.mjs), then
 * exercise-state changes against the final program (change_load aligns the state with its slot's range and RIR so
 * the engine does not convert the advisor's weight again; deload lowers the working weight, resets fails and marks
 * `deloaded`; both start the plateau memory's streak over at a new weight; hold keeps the numbers, sets holdUntil
 * `value` weeks ahead and adds a note), notes last. Returns the
 * edited program (the same object when nothing in it changed), the full next states, what was applied and what was
 * skipped (with reasons), and the state rows to upsert. Pure: the inputs are never modified.
 * @param {{ program: Program, states?: Record<string, ExerciseState> | null, proposal: Proposal, now?: TimeLike,
 *   settings?: Settings | null, gym?: Gym | null, catalog?: AdvisorCatalog | null, bodyweightKg?: number | null }} input
 * @returns {{ program: Program, states: Record<string, ExerciseState>, applied: AdvisorChange[], skipped: Dropped[], changedStates: ExerciseState[] }}
 */
export function applyProposal({ program, states, proposal, now, settings = null, gym = null, catalog, bodyweightKg }) {
  const cat = catalog ?? DEFAULT_LOOKUP;
  const at = toIso(now);
  const bw = bodyweightKg ?? settings?.bodyweightKg ?? null;
  let p = program;
  /** @type {Record<string, ExerciseState>} */
  const st = { ...(states ?? {}) };
  /** @type {Set<string>} */
  const touched = new Set();
  /** @type {AdvisorChange[]} */
  const applied = [];
  /** @type {Dropped[]} */
  const skipped = [];
  const rank = (/** @type {AdvisorChange} */ c) => (c.type === "set_days" ? 0 : c.type === "add_legs" ? 1 : SLOT_TYPES.has(c.type) ? 2 : STATE_TYPES.has(c.type) ? 3 : 4);
  const ordered = proposal.changes.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c);
  /** @param {AdvisorChange} c @param {Program} next */
  const program1 = (c, next) => {
    if (next === p) skipped.push({ change: c, reason: WHY.same });
    else {
      p = next;
      applied.push(c);
    }
  };
  for (const c of ordered) {
    switch (c.type) {
      case "set_days":
        program1(c, setDays(p, c.value, at, { catalog: cat }));
        break;
      case "add_legs":
        program1(c, addLegs(p, at, { catalog: cat }));
        break;
      case "swap_exercise":
        program1(c, swapSlot(p, c.dayKey, c.slotId, c.newExerciseId, at, { catalog: cat }));
        break;
      case "change_sets":
        program1(c, setSlot(p, c.dayKey, c.slotId, { sets: c.value }, at, { catalog: cat }));
        break;
      case "change_reps":
        program1(c, setSlot(p, c.dayKey, c.slotId, { repRange: [c.value, c.value2] }, at, { catalog: cat }));
        break;
      case "change_rir":
        program1(c, setSlot(p, c.dayKey, c.slotId, { rir: c.value }, at, { catalog: cat }));
        break;
      case "change_load": {
        const ex = cat.exerciseById(c.exerciseId);
        if (!ex) {
          skipped.push({ change: c, reason: WHY.exercise });
          break;
        }
        const slot = slotOfExercise(p, ex.id);
        const prev = st[ex.id];
        /** @type {[number, number]} */
        const range = slot ? [slot.repRange[0], slot.repRange[1]] : prev ? [prev.repRange[0], prev.repRange[1]] : [ex.repRange[0], ex.repRange[1]];
        const rir = slot ? slot.rir : prev?.rir ?? 2;
        const base = prev ?? initialState(ex, { goal: p.goal, repRange: range, rir, gym, bodyweightKg: bw, now: at });
        const kg = roundLoad(c.value, ex, gym, "nearest");
        const reps = c.value2 > 0 ? clamp(Math.round(c.value2), range[0], range[1]) : clamp(base.targetReps, range[0], range[1]);
        st[ex.id] = {
          ...base,
          workingKg: kg,
          targetReps: reps,
          repRange: range,
          rir,
          fails: 0,
          ...plateauAfter(prev, kg, range, rir),
          note: {
            en: `Set by the advisor: ${loadText(kg, ex, "en")} × ${reps}.${c.reason.en ? ` ${c.reason.en}` : ""}`,
            ru: `Задано советником: ${loadText(kg, ex, "ru")} × ${reps}.${c.reason.ru ? ` ${c.reason.ru}` : ""}`,
          },
          updatedAt: at,
        };
        touched.add(ex.id);
        applied.push(c);
        break;
      }
      case "deload": {
        const ids = c.exerciseId ? [c.exerciseId] : programExerciseIds(p).filter((id) => st[id]);
        let any = false;
        for (const id of ids) {
          const ex = cat.exerciseById(id);
          const prev = st[id];
          if (!ex || !prev || !(prev.workingKg > 0 || isAssisted(ex))) continue;
          const kg = easierBy(prev.workingKg, c.value, ex, gym, bw);
          if (Math.abs(kg - prev.workingKg) < 0.005 && !isAssisted(ex)) continue;
          // not a failed weight: the adviser's deload remembers nothing new (rule 5 is for the engine's deload)
          st[id] = {
            ...prev,
            workingKg: kg,
            fails: 0,
            lastOutcome: "deloaded",
            ...plateauAfter(prev, kg, prev.repRange, prev.rir),
            note: {
              en: `Deload by the advisor: −${c.value} % (${loadText(prev.workingKg, ex, "en")} → ${loadText(kg, ex, "en")}).`,
              ru: `Разгрузка по совету: −${c.value} % (${loadText(prev.workingKg, ex, "ru")} → ${loadText(kg, ex, "ru")}).`,
            },
            updatedAt: at,
          };
          touched.add(id);
          any = true;
        }
        if (any) applied.push(c);
        else skipped.push({ change: c, reason: WHY.history });
        break;
      }
      case "hold": {
        const prev = st[c.exerciseId];
        const ex = cat.exerciseById(c.exerciseId);
        if (!prev || !ex) {
          skipped.push({ change: c, reason: WHY.history });
          break;
        }
        // the engine adds no weight before holdUntil (local midnight, `weeks` weeks from today; program-edit setHold)
        const held = setHold(prev, c.value || HOLD_WEEKS[0], at);
        const until = /** @type {string} */ (held.holdUntil);
        st[c.exerciseId] = {
          ...held,
          note: {
            en: `Hold: weight held until ${holdDay(until, "en")}; ${loadText(prev.workingKg, ex, "en")} × ${prev.targetReps} next time.${c.reason.en ? ` ${c.reason.en}` : ""}`,
            ru: `Пауза: вес зафиксирован до ${holdDay(until, "ru")}; в следующий раз ${loadText(prev.workingKg, ex, "ru")} × ${prev.targetReps}.${c.reason.ru ? ` ${c.reason.ru}` : ""}`,
          },
          updatedAt: at,
        };
        touched.add(c.exerciseId);
        applied.push(c);
        break;
      }
      default:
        applied.push(c);
    }
  }
  return { program: p, states: st, applied, skipped, changedStates: [...touched].map((id) => st[id]) };
}

/**
 * The master plan's name (§7) for applyProposal, positional: applyAdjustment(program, states, proposal, now).
 * @param {Program} program @param {Record<string, ExerciseState> | null | undefined} states @param {Proposal} proposal
 * @param {TimeLike} [now] @param {{ settings?: Settings | null, gym?: Gym | null, catalog?: AdvisorCatalog | null, bodyweightKg?: number | null }} [opts]
 */
export const applyAdjustment = (program, states, proposal, now, opts = {}) => applyProposal({ program, states, proposal, now, ...opts });

/* ------------------------------------------------------------------ display and rows */

/** @param {string} id @param {AdvisorCatalog} cat @param {Lang} lang */
const nameIn = (id, cat, lang) => {
  const n = cat.exerciseById(id)?.name;
  return n ? (lang === "ru" ? n.ru || n.en : n.en) : id;
};

/**
 * One readable diff line for a change, built from the program and the states (what will actually be applied).
 * @param {AdvisorChange} c @param {Program} program @param {Record<string, ExerciseState> | null | undefined} states
 * @param {Lang} lang @param {AdvisorCatalog | null} [catalog] @returns {string}
 */
export function describeChange(c, program, states, lang, catalog) {
  const cat = catalog ?? DEFAULT_LOOKUP;
  const ru = lang === "ru";
  const hit = c.slotId ? findSlot(program, c.dayKey, c.slotId, c.exerciseId) : null;
  const slot = hit?.slot;
  const tag = slot ? `${slot.slotId} · ${nameIn(slot.exerciseId, cat, lang)}` : nameIn(c.exerciseId, cat, lang);
  const unit = slot ? unitOf(cat.exerciseById(slot.exerciseId)) : "reps";
  const u = unit === "seconds" ? (ru ? " с" : " s") : unit === "meters" ? (ru ? " м" : " m") : ru ? " повт." : " reps";
  const st = states?.[c.exerciseId];
  const ex = cat.exerciseById(c.exerciseId);
  switch (c.type) {
    case "set_days":
      return ru ? `Дней в неделю: ${program.daysPerWeek} → ${c.value}` : `Days per week: ${program.daysPerWeek} → ${c.value}`;
    case "swap_exercise":
      return `${tag} → ${nameIn(c.newExerciseId, cat, lang)}`;
    case "change_sets":
      return ru ? `${tag}: подходов ${slot?.sets ?? "?"} → ${c.value}` : `${tag}: ${slot?.sets ?? "?"} → ${c.value} sets`;
    case "change_reps":
      return `${tag}: ${slot ? `${slot.repRange[0]}–${slot.repRange[1]}` : "?"} → ${c.value}–${c.value2}${u}`;
    case "change_rir":
      return ru ? `${tag}: запас ${slot?.rir ?? "?"} → ${c.value}` : `${tag}: RIR ${slot?.rir ?? "?"} → ${c.value}`;
    case "change_load": {
      if (!ex) return tag;
      const from = st ? `${loadText(st.workingKg, ex, lang)} → ` : "";
      return `${tag}: ${from}${loadText(c.value, ex, lang)}${c.value2 ? ` × ${c.value2}` : ""}`;
    }
    case "deload":
      return c.exerciseId
        ? (ru ? `${tag}: на ${c.value} % легче` : `${tag}: ${c.value} % lighter`)
        : (ru ? `Все упражнения: на ${c.value} % легче` : `All exercises: ${c.value} % lighter`);
    case "hold": {
      const w = c.value || HOLD_WEEKS[0];
      const n = w % 100;
      const weeks = ru
        ? `${w} ${n % 10 === 1 && n !== 11 ? "неделю" : n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14) ? "недели" : "недель"}`
        : `${w} ${w === 1 ? "week" : "weeks"}`;
      if (st && ex) {
        const load = loadText(st.workingKg, ex, lang);
        if (!ru) return `${tag}: weight held at ${load} for ${weeks}`;
        // "вес 55 кг зафиксирован", but "нагрузка (помощь 30 кг) зафиксирована" (not "вес помощь 30 кг зафиксирован")
        return isAssisted(ex) || ex.equipment === "bodyweight" ? `${tag}: нагрузка (${load}) зафиксирована на ${weeks}` : `${tag}: вес ${load} зафиксирован на ${weeks}`;
      }
      return ru ? `${tag}: без повышения веса ${weeks}` : `${tag}: no weight increase for ${weeks}`;
    }
    case "add_legs":
      return ru ? "Добавить день ног (L)" : "Add the legs day (L)";
    default:
      return (ru ? c.text.ru : c.text.en) || (ru ? "Совет" : "Advice");
  }
}

/**
 * The adjustments row for an advisor answer: the request (never the key), model and effort, the program version it
 * was made for, the validated proposal, what was dropped, applied and skipped, whether it was applied, and the program
 * version it saved (`saved`, when applying changed the program).
 * @param {{ id?: string, now?: TimeLike, request: string, lang: Lang, model: string, effort: string, program: Program,
 *   proposal: Proposal, dropped?: Dropped[], result?: { applied: AdvisorChange[], skipped: Dropped[] } | null, applied: boolean,
 *   saved?: Program | null }} input
 * @returns {Adjustment}
 */
export function adjustmentRow({ id, now, request, lang, model, effort, program, proposal, dropped = [], result = null, applied, saved = null }) {
  const at = toIso(now);
  return {
    id: id ?? newId(),
    at,
    source: "ai",
    input: { request: String(request).slice(0, MAX_REQUEST), lang, model, effort, programId: program.id, programVersion: program.version },
    output: {
      summary: proposal.summary,
      changes: proposal.changes,
      cautions: proposal.cautions,
      dropped: dropped.map((d) => ({ type: d.change.type, slotId: d.change.slotId, exerciseId: d.change.exerciseId, reason: d.reason })),
      applied: result ? result.applied.map((c) => ({ type: c.type, slotId: c.slotId, exerciseId: c.exerciseId })) : [],
      skipped: result ? result.skipped.map((d) => ({ type: d.change.type, slotId: d.change.slotId, exerciseId: d.change.exerciseId, reason: d.reason })) : [],
      savedProgramId: saved?.id ?? null,
      savedVersion: saved?.version ?? null,
    },
    applied,
    updatedAt: at,
  };
}

/**
 * The adjustments row for a manual save on the program page: the diff lines and the versions.
 * @param {{ id?: string, now?: TimeLike, before: Program | null, after: Program, lines: Text2[] }} input
 * @returns {Adjustment}
 */
export function manualAdjustmentRow({ id, now, before, after, lines }) {
  const at = toIso(now);
  return {
    id: id ?? newId(),
    at,
    source: "manual",
    input: { kind: "program-edit", fromProgramId: before?.id ?? null, toProgramId: after.id, version: after.version },
    output: { lines: lines.slice(0, 40) },
    applied: true,
    updatedAt: at,
  };
}
