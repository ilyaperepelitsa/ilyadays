// @ts-check
/**
 * Program edits for /fitness/program (stream 10, plans/fitness/10-ai-advisor.md): goal mode, days per week, slot
 * swaps and prescriptions, order, added/removed exercises, the legs add-on, templates and progression parameters,
 * plus the bounds every edit is clamped to, a readable diff and the row to save. Pure: no DOM, no storage.
 *
 * Every edit returns a NEW program (`version + 1`, `updatedAt = now`, same id) or the SAME object when nothing
 * changes, so callers can test `next === program`. Saving (commitProgram) turns the edited draft into a new program
 * version row and archives the old one; the engine (stream 03) re-derives numbers and converts exercise states lazily.
 */
import {
  DEFAULT_TEMPLATE_ID, GOAL_IDS, GOAL_MODES, LEGS_TEMPLATE_ID, PROGRESSION_RULE_IDS, RULES, buildProgram, clamp,
  convertProgram, deriveSlot, newId, progressionRecord, rangeForUnit, roleParams, slotRole, templateById, toIso, toMs,
  unitOf, withLegs,
} from "./templates.mjs";
import { enforcePlanPreferences, exerciseAllowed } from "./plan-preferences.mjs";
import { classMates, exerciseById as catalogExerciseById, isAvailable as catalogIsAvailable } from "./catalog.mjs";

/** @typedef {import("./types").Exercise} Exercise */
/** @typedef {import("./types").ExerciseSlot} ExerciseSlot */
/** @typedef {import("./types").ExerciseState} ExerciseState */
/** @typedef {import("./types").GoalMode} GoalMode */
/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").Program} Program */
/** @typedef {import("./types").ProgramDay} ProgramDay */
/** @typedef {import("./types").ProgressionParams} ProgressionParams */
/** @typedef {import("./types").ProgressionRuleId} ProgressionRuleId */
/** @typedef {import("./types").Snapshot} Snapshot */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {import("./templates.mjs").RepUnit} RepUnit */
/** @typedef {import("./templates.mjs").TemplateSlot} TemplateSlot */
/** @typedef {import("./templates.mjs").Template} Template */
/** @typedef {{ exerciseById: (id: string) => Exercise | undefined }} ExerciseLookup */
/** @typedef {Date | string | number} TimeLike */
/** @typedef {{ sets: [number, number], reps: [number, number], rir: [number, number], restSec: [number, number] }} GoalBounds */
/** @typedef {{ sets?: number, repRange?: [number, number], rir?: number, restSec?: number, progression?: ProgressionRuleId }} SlotPatch */
/** @typedef {{ stepPct?: number, failsBeforeDeload?: number, deloadPct?: number, overshootReps?: number }} ProgressionPatch */
/**
 * One readable line of a program diff.
 * @typedef {{ kind: "goal" | "days" | "template" | "legs" | "deload" | "progression" | "swap" | "sets" | "reps" | "rir" | "rest" | "rule" | "added" | "removed" | "moved", dayKey?: string, slotId?: string, text: Text2 }} DiffLine
 */

/** @type {ExerciseLookup} */
const DEFAULT_LOOKUP = { exerciseById: catalogExerciseById };

/* ------------------------------------------------------------------ bounds */

/**
 * Edit windows per goal mode, wide enough for every role of that mode (research/01 Table 1 rep ranges and RIR
 * targets, Table 4 rest, Table 5 failure policy; sets per slot 1–5 as deriveSlot clamps). Holds and carries use
 * UNIT_BOUNDS instead of `reps`.
 * @type {Readonly<Record<GoalMode, GoalBounds>>}
 */
export const GOAL_BOUNDS = Object.freeze({
  strength: { sets: [1, 5], reps: [3, 15], rir: [1, 4], restSec: [60, 300] },
  hypertrophy: { sets: [1, 5], reps: [5, 30], rir: [0, 4], restSec: [45, 240] },
  recomp: { sets: [1, 5], reps: [4, 20], rir: [1, 4], restSec: [45, 240] },
  endurance: { sets: [1, 5], reps: [10, 30], rir: [0, 3], restSec: [30, 120] },
  maintenance: { sets: [1, 5], reps: [4, 20], rir: [1, 4], restSec: [45, 240] },
});

/** Holds (seconds) and carries (metres): research/04 §3.5 holds 20–60 s and carries 20–40 m, with room either side. */
export const UNIT_BOUNDS = Object.freeze({ seconds: /** @type {[number, number]} */ ([10, 120]), meters: /** @type {[number, number]} */ ([10, 100]) });

/** Progression parameter windows: steps 1–10 % (research/01 Table 6: +2.5–5 % upper, 5–10 % lower body), 1–5 failed
 *  sessions before a deload, deloads of 5–20 % (Table 7: load × 0.8–0.9), overshoot 1–5 reps. */
export const PROGRESSION_BOUNDS = Object.freeze({
  stepPct: /** @type {[number, number]} */ ([1, 10]),
  failsBeforeDeload: /** @type {[number, number]} */ ([1, 5]),
  deloadPct: /** @type {[number, number]} */ ([5, 20]),
  overshootReps: /** @type {[number, number]} */ ([1, 5]),
});

/** Weeks between planned deloads: 0 (reactive only) or 3–12 (research/01 Table 7: 4–6, 6–8 or 8–12 by goal). */
export const DELOAD_EVERY_BOUNDS = Object.freeze(/** @type {[number, number]} */ ([3, 12]));

/** Rest is edited in 15 s steps and stored rounded to 5 s. */
export const REST_STEP_SEC = 15;

/**
 * The windows a slot of this goal and unit may take: sets, rep range (in the exercise's unit), RIR, rest, and the
 * stepper step for the range (1 rep, 5 s, 5 m).
 * @param {GoalMode | string} goal @param {RepUnit} [unit]
 * @returns {GoalBounds & { unit: RepUnit, step: number }}
 */
export function slotBounds(goal, unit = "reps") {
  const g = GOAL_BOUNDS[/** @type {GoalMode} */ (goal)] ?? GOAL_BOUNDS.recomp;
  const reps = unit === "reps" ? g.reps : (UNIT_BOUNDS[unit] ?? g.reps);
  return { sets: g.sets, reps, rir: g.rir, restSec: g.restSec, unit, step: RULES.unitStep[unit] ?? 1 };
}

/** @param {number} x @param {readonly [number, number]} range */
const clampInt = (x, range) => clamp(Math.round(x), range[0], range[1]);

/** @param {readonly [number, number]} r @param {readonly [number, number]} bounds @param {number} step @returns {[number, number]} */
function clampRange(r, bounds, step = 1) {
  const snap = (/** @type {number} */ x) => clamp(Math.round(x / step) * step, bounds[0], bounds[1]);
  const a = snap(r[0]);
  const b = snap(r[1]);
  return a <= b ? [a, b] : [b, a];
}

/** @param {unknown} n @returns {n is 2 | 3 | 4} */
const isDays = (n) => n === 2 || n === 3 || n === 4;

/* ------------------------------------------------------------------ lookups */

/** @param {string} id @param {ExerciseLookup} lookup @returns {RepUnit} */
const unitFor = (id, lookup) => unitOf(lookup.exerciseById(id));

/** @param {Template | undefined} tpl @param {string} slotId @returns {TemplateSlot | undefined} */
function slotIn(tpl, slotId) {
  for (const day of tpl?.days ?? []) {
    const hit = day.slots.find((s) => s.slotId === slotId);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The template slot behind a program slot id: the program's own template first, then the legs add-on (the same
 * lookup the engine uses for roles). Undefined for slots the owner added.
 * @param {Program} program @param {string} slotId @returns {TemplateSlot | undefined}
 */
export function templateSlotOf(program, slotId) {
  return slotIn(templateById(program.templateId), slotId) ?? slotIn(templateById(LEGS_TEMPLATE_ID), slotId);
}

const LEGS = templateById(LEGS_TEMPLATE_ID);
/** Slot ids of the legs add-on (L1–L5). */
const LEGS_SLOT_IDS = new Set((LEGS?.days ?? []).flatMap((d) => d.slots.map((s) => s.slotId)));
/** Coarse groups the legs day adds to a day's focus. */
const LEGS_FOCUS = new Set((LEGS?.days ?? []).flatMap((d) => d.focus));

/** Exercise ids of the legs add-on. */
export const LEGS_EXERCISE_IDS = Object.freeze([...new Set((LEGS?.days ?? []).flatMap((d) => d.slots.map((s) => s.exerciseId)))]);

/**
 * How the legs add-on is in the program: its own day "L", spread over the days as slots, or not at all.
 * @param {Program} program @returns {"day" | "slots" | null}
 */
export function legsMode(program) {
  if (program.days.some((d) => d.key === "L")) return "day";
  if (program.days.some((d) => d.slots.some((s) => LEGS_SLOT_IDS.has(s.slotId)))) return "slots";
  return null;
}

/** @param {Program} program @param {string} dayKey @param {string} slotId @returns {[number, number] | null} */
function locate(program, dayKey, slotId) {
  const di = program.days.findIndex((d) => d.key === dayKey);
  if (di < 0) return null;
  const si = program.days[di].slots.findIndex((s) => s.slotId === slotId);
  return si < 0 ? null : [di, si];
}

/** A new program row with `days` replaced, version + 1 and updatedAt = now. @param {Program} program @param {ProgramDay[]} days @param {TimeLike | undefined} now */
const bump = (program, days, now) => enforcePlanPreferences({ ...program, days, version: (program.version ?? 1) + 1, updatedAt: toIso(now) });

/** @param {Program} program @param {number} di @param {ProgramDay} day @param {TimeLike | undefined} now */
const withDay = (program, di, day, now) => bump(program, program.days.map((d, i) => (i === di ? day : d)), now);

/** @param {Program} program @param {number} di @param {number} si @param {ExerciseSlot} slot @param {TimeLike | undefined} now */
const withSlot = (program, di, si, slot, now) => {
  const day = program.days[di];
  return withDay(program, di, { ...day, slots: day.slots.map((s, i) => (i === si ? slot : s)) }, now);
};

/** @param {[number, number]} a @param {[number, number]} b */
const sameRange = (a, b) => a[0] === b[0] && a[1] === b[1];

/** @param {ExerciseSlot} a @param {ExerciseSlot} b */
const sameSlot = (a, b) =>
  a.exerciseId === b.exerciseId && a.sets === b.sets && sameRange(a.repRange, b.repRange) && a.rir === b.rir &&
  a.restSec === b.restSec && a.progression === b.progression && a.increment === b.increment;

/** A copy of a slot with its own arrays (so edits never share a repRange with the input). @param {ExerciseSlot} s @returns {ExerciseSlot} */
const copySlot = (s) => {
  /** @type {ExerciseSlot} */
  const out = { ...s, repRange: [s.repRange[0], s.repRange[1]] };
  if (s.why) out.why = { en: s.why.en, ru: s.why.ru };
  return out;
};

/**
 * Slot id for an exercise the owner adds to a day: the day key and the next number after every number the day's
 * template or the program uses (A7 after A1–A6), so it never collides with a template slot id (roles and gym
 * preferences are keyed by slot id).
 * @param {Program} program @param {string} dayKey @param {string[]} [extra] ids to treat as used
 */
export function nextSlotId(program, dayKey, extra = []) {
  const used = new Set([...program.days.flatMap((d) => d.slots.map((s) => s.slotId)), ...extra]);
  const known = [...used, ...(templateById(program.templateId)?.days ?? []).flatMap((d) => d.slots.map((s) => s.slotId)), ...LEGS_SLOT_IDS];
  let max = 0;
  for (const id of known) {
    if (!id.startsWith(dayKey)) continue;
    const rest = id.slice(dayKey.length);
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest));
  }
  let n = max + 1;
  while (used.has(`${dayKey}${n}`)) n += 1;
  return `${dayKey}${n}`;
}

/* ------------------------------------------------------------------ the program to show */

/** Id of the in-memory default program shown before anything is saved. Never written: commitProgram assigns a UUID. */
export const DEFAULT_PROGRAM_ID = "default";
const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * The owner template for a goal and day count, deterministic (fixed id and time) so server and client render the
 * same thing before the store loads.
 * @param {GoalMode | string | null | undefined} [goal] @param {number | null | undefined} [days]
 * @returns {Program}
 */
export function defaultProgram(goal, days) {
  const g = GOAL_IDS.includes(/** @type {GoalMode} */ (goal)) ? /** @type {GoalMode} */ (goal) : undefined;
  return buildProgram({ templateId: DEFAULT_TEMPLATE_ID, goal: g, daysPerWeek: isDays(days) ? days : undefined, now: EPOCH, id: DEFAULT_PROGRAM_ID });
}

/** True for the in-memory default (not yet saved). @param {Program | null | undefined} program */
export const isDefaultProgram = (program) => !program || program.id === DEFAULT_PROGRAM_ID;

/**
 * The program the page shows: the active one, else the owner template with the saved goal and days per week (the
 * same rule as stream 04's ensureProgram, but not written until the owner saves an edit).
 * @param {Pick<Snapshot, "programs" | "activeProgramId" | "settings">} snapshot
 * @returns {{ program: Program, saved: boolean }}
 */
export function currentProgram(snapshot) {
  const active = snapshot.activeProgramId ? snapshot.programs[snapshot.activeProgramId] : undefined;
  if (active && Array.isArray(active.days) && active.days.length) return { program: active, saved: true };
  return { program: defaultProgram(snapshot.settings?.goal, snapshot.settings?.daysPerWeek), saved: false };
}

/**
 * The rows to write when the owner saves a draft: the draft as a NEW program version (fresh UUID, version after the
 * saved one, active) and the saved row marked `active: false` (kept as history). A draft of the unsaved default starts
 * its block calendar now.
 * @param {Program | null | undefined} saved @param {Program} draft @param {TimeLike} [now]
 * @returns {{ program: Program, archived: Program | null }}
 */
export function commitProgram(saved, draft, now) {
  const at = toIso(now);
  const fresh = isDefaultProgram(saved);
  /** @type {Program} */
  const program = {
    ...enforcePlanPreferences(draft),
    id: newId(),
    version: (fresh ? 0 : (saved?.version ?? 1)) + 1,
    createdAt: fresh || isDefaultProgram(draft) || draft.createdAt === EPOCH ? at : draft.createdAt,
    updatedAt: at,
    active: true,
  };
  const archived = !fresh && saved ? { ...saved, active: false, updatedAt: at } : null;
  return { program, archived };
}

/* ------------------------------------------------------------------ goal and days */

/**
 * Switch the goal mode: every slot is re-derived for the new goal (convertProgram: same exercises, new sets × reps ×
 * RIR × rest, the goal's progression rules and deload interval, the block calendar restarts). Exercise states are
 * returned unchanged ON PURPOSE: the engine converts a state whose range or RIR differs from its slot when it plans
 * the next session (first session × 0.95) and treats that session as a calibration when it applies it; converting
 * them here would skip the calibration. Show the converted targets with planSession.
 * @param {Program} program @param {GoalMode} goal @param {Record<string, ExerciseState> | null | undefined} states
 * @param {TimeLike} [now] @param {{ catalog?: ExerciseLookup }} [opts]
 * @returns {{ program: Program, states: Record<string, ExerciseState> }}
 */
export function setGoal(program, goal, states, now, { catalog } = {}) {
  const st = states ?? {};
  if (!GOAL_IDS.includes(goal) || goal === program.goal) return { program, states: st };
  return { program: convertProgram(program, goal, now, { id: program.id, catalog }), states: st };
}

/**
 * What the owner changed against the program's template, keyed by the TEMPLATE exercise id of each slot: swaps
 * (template exercise → exercise used), overrides (fields that differ from the derived prescription), removed
 * template exercises, added slots, and the legs mode.
 * @param {Program} program @param {ExerciseLookup} lookup
 */
function customizations(program, lookup) {
  const tpl = templateById(program.templateId);
  /** @type {Map<string, string>} */
  const swaps = new Map();
  /** @type {Map<string, SlotPatch & { increment?: number }>} */
  const overrides = new Map();
  /** @type {Set<string>} */
  const removed = new Set();
  /** @type {{ dayKey: string, slot: ExerciseSlot }[]} */
  const added = [];
  const present = new Set(program.days.flatMap((d) => d.slots.map((s) => s.slotId)));
  for (const day of program.days) {
    if (day.key === "L") continue; // the legs day is rebuilt by withLegs
    for (const slot of day.slots) {
      const tslot = slotIn(tpl, slot.slotId);
      if (!tslot) {
        if (!LEGS_SLOT_IDS.has(slot.slotId)) added.push({ dayKey: day.key, slot });
        continue;
      }
      const key = tslot.exerciseId;
      if (slot.exerciseId !== key) swaps.set(key, slot.exerciseId);
      const exercise = lookup.exerciseById(slot.exerciseId) ?? null;
      const unit = exercise ? unitOf(exercise) : (tslot.unit ?? "reps");
      const derived = deriveSlot(tslot, program.goal, unit, exercise);
      /** @type {SlotPatch & { increment?: number }} */
      const diff = {};
      if (slot.sets !== derived.sets) diff.sets = slot.sets;
      if (!sameRange(slot.repRange, derived.repRange)) diff.repRange = [slot.repRange[0], slot.repRange[1]];
      if (slot.rir !== derived.rir) diff.rir = slot.rir;
      if (slot.restSec !== derived.restSec) diff.restSec = slot.restSec;
      if (slot.progression !== derived.progression) diff.progression = slot.progression;
      if (slot.increment !== derived.increment && typeof slot.increment === "number") diff.increment = slot.increment;
      if (Object.keys(diff).length && !overrides.has(key)) overrides.set(key, diff);
    }
  }
  for (const tday of tpl?.days ?? []) for (const ts of tday.slots) if (!present.has(ts.slotId)) removed.add(ts.exerciseId);
  return { swaps, overrides, removed, added, legs: legsMode(program) };
}

/**
 * Change the days per week: rebuild from the template for that day count (2 → upper-2day, 3 → the owner's A/B/C,
 * 4 → upper-4day) and carry the owner's edits where exercise ids match: swaps, overrides (sets, reps, RIR, rest,
 * rule, increment, clamped to the goal's bounds), removals, added slots (same day key or the last day, new ids),
 * the legs add-on, the progression parameters and the block calendar (`createdAt`).
 * @param {Program} program @param {number} days @param {TimeLike} [now] @param {{ catalog?: ExerciseLookup }} [opts]
 * @returns {Program}
 */
export function setDays(program, days, now, { catalog } = {}) {
  if (!isDays(days)) return program;
  const lookup = catalog ?? DEFAULT_LOOKUP;
  if (program.preferences || program.templateId === "custom") {
    if (days === program.daysPerWeek && program.days.length === days) return program;
    const slots = program.days.flatMap((d) => d.slots).map(copySlot);
    const nextDays = Array.from({ length: days }, (_, i) => {
      const key = String.fromCharCode(65 + i);
      const old = program.days.find((d) => d.key === key);
      return { key, name: old?.name ?? { en: `Day ${i + 1}`, ru: `День ${i + 1}` }, focus: old?.focus ?? [], slots: slots.filter((_, j) => j % days === i).map((slot) => { const out = { ...slot }; delete out.superset; return out; }) };
    });
    return enforcePlanPreferences({ ...program, daysPerWeek: days, days: nextDays, version: program.version + 1, updatedAt: toIso(now) }, lookup);
  }
  const fresh = buildProgram({ templateId: DEFAULT_TEMPLATE_ID, goal: program.goal, daysPerWeek: days, now, id: program.id, catalog: lookup });
  if (days === program.daysPerWeek && fresh.templateId === program.templateId) return program;
  const custom = customizations(program, lookup);
  /** @type {ProgramDay[]} */
  const rebuilt = fresh.days.map((day) => {
    /** @type {ExerciseSlot[]} */
    const slots = [];
    for (const tslot of day.slots) {
      const key = tslot.exerciseId;
      if (custom.removed.has(key)) continue;
      let slot = copySlot(tslot);
      const to = custom.swaps.get(key);
      const toExercise = to ? lookup.exerciseById(to) : undefined;
      const taken = (/** @type {string} */ id) => day.slots.some((o) => o.exerciseId === id) || slots.some((o) => o.exerciseId === id);
      if (to && toExercise && !taken(to)) slot = swappedSlot(fresh, slot, toExercise, lookup);
      const ov = custom.overrides.get(key);
      if (ov) slot = patched(slot, ov, fresh.goal, unitFor(slot.exerciseId, lookup));
      slots.push(slot);
    }
    return { ...day, focus: [...day.focus], slots: slots.length ? slots : day.slots.map(copySlot) };
  });
  /** @type {Program} */
  let next = { ...program, name: fresh.name, templateId: fresh.templateId, daysPerWeek: days, days: rebuilt };
  for (const { dayKey, slot } of custom.added) {
    const di = Math.max(0, next.days.findIndex((d) => d.key === dayKey) >= 0 ? next.days.findIndex((d) => d.key === dayKey) : next.days.length - 1);
    const day = next.days[di];
    if (!day || day.slots.some((s) => s.exerciseId === slot.exerciseId)) continue;
    const moved = { ...copySlot(slot), slotId: nextSlotId(next, day.key) };
    delete moved.superset;
    next = { ...next, days: next.days.map((d, i) => (i === di ? { ...d, slots: [...d.slots, moved] } : d)) };
  }
  if (custom.legs) next = withLegs(next, now, { as: custom.legs, id: program.id, catalog: lookup });
  return {
    ...enforcePlanPreferences(next, lookup),
    id: program.id,
    progression: copyProgression(program),
    deloadEveryWeeks: program.deloadEveryWeeks,
    createdAt: program.createdAt,
    version: (program.version ?? 1) + 1,
    updatedAt: toIso(now),
  };
}

/** @param {Program} program @returns {Record<ProgressionRuleId, ProgressionParams>} */
function copyProgression(program) {
  const base = progressionRecord(program.goal);
  /** @type {Record<ProgressionRuleId, ProgressionParams>} */
  const out = /** @type {any} */ ({});
  for (const rule of PROGRESSION_RULE_IDS) {
    const p = program.progression?.[rule] ?? base[rule];
    out[rule] = { ...p, repRange: [p.repRange[0], p.repRange[1]] };
  }
  return out;
}

/* ------------------------------------------------------------------ slots */

/**
 * A slot with another exercise: same prescription; a slot-level increment is dropped (it belonged to the old
 * machine); when the rep unit changes (a carry for a hold) the range is re-derived for the new unit.
 * @param {Program} program @param {ExerciseSlot} slot @param {Exercise} to @param {ExerciseLookup} lookup
 * @returns {ExerciseSlot}
 */
function swappedSlot(program, slot, to, lookup) {
  const from = lookup.exerciseById(slot.exerciseId);
  const next = { ...copySlot(slot), exerciseId: to.id };
  delete next.increment;
  if (unitOf(from) !== unitOf(to)) {
    const role = slotRole(program, slot, lookup);
    const b = slotBounds(program.goal, unitOf(to));
    next.repRange = clampRange(rangeForUnit(roleParams(program.goal, role), unitOf(to), to), b.reps, b.step);
  }
  return next;
}

/**
 * A slot with a patch applied and clamped to the goal's bounds for its unit.
 * @param {ExerciseSlot} slot @param {SlotPatch & { increment?: number }} patch @param {GoalMode} goal @param {RepUnit} unit
 * @returns {ExerciseSlot}
 */
function patched(slot, patch, goal, unit) {
  const b = slotBounds(goal, unit);
  const next = copySlot(slot);
  if (typeof patch.sets === "number" && Number.isFinite(patch.sets)) next.sets = clampInt(patch.sets, b.sets);
  if (Array.isArray(patch.repRange) && patch.repRange.every(Number.isFinite)) next.repRange = clampRange(patch.repRange, b.reps, b.step);
  if (typeof patch.rir === "number" && Number.isFinite(patch.rir)) next.rir = clampInt(patch.rir, b.rir);
  if (typeof patch.restSec === "number" && Number.isFinite(patch.restSec)) next.restSec = clamp(Math.round(patch.restSec / 5) * 5, b.restSec[0], b.restSec[1]);
  if (patch.progression && PROGRESSION_RULE_IDS.includes(patch.progression)) next.progression = patch.progression;
  if (typeof patch.increment === "number" && patch.increment > 0) next.increment = patch.increment;
  return next;
}

/**
 * Put another exercise in a slot (the slot keeps its prescription and "why"; see swappedSlot). Unknown exercise,
 * unknown slot or the same exercise → unchanged.
 * @param {Program} program @param {string} dayKey @param {string} slotId @param {string} exerciseId @param {TimeLike} [now]
 * @param {{ catalog?: ExerciseLookup }} [opts] @returns {Program}
 */
export function swapSlot(program, dayKey, slotId, exerciseId, now, { catalog } = {}) {
  const lookup = catalog ?? DEFAULT_LOOKUP;
  const at = locate(program, dayKey, slotId);
  if (!at) return program;
  const [di, si] = at;
  const slot = program.days[di].slots[si];
  const to = lookup.exerciseById(exerciseId);
  if (!to || !exerciseAllowed(program, to) || slot.exerciseId === exerciseId) return program;
  return withSlot(program, di, si, swappedSlot(program, slot, to, lookup), now);
}

/**
 * Change a slot's sets, rep range, RIR, rest or progression rule, clamped to the goal mode's bounds for the slot's
 * unit (slotBounds). A rep range given low > high is sorted. No effective change → unchanged.
 * @param {Program} program @param {string} dayKey @param {string} slotId @param {SlotPatch} patch @param {TimeLike} [now]
 * @param {{ catalog?: ExerciseLookup }} [opts] @returns {Program}
 */
export function setSlot(program, dayKey, slotId, patch, now, { catalog } = {}) {
  const lookup = catalog ?? DEFAULT_LOOKUP;
  const at = locate(program, dayKey, slotId);
  if (!at || !patch) return program;
  const [di, si] = at;
  const slot = program.days[di].slots[si];
  const next = patched(slot, patch, program.goal, unitFor(slot.exerciseId, lookup));
  return sameSlot(next, slot) ? program : withSlot(program, di, si, next, now);
}

/**
 * Consecutive slots sharing a superset id form one block (they are done alternately).
 * @param {ExerciseSlot[]} slots @returns {ExerciseSlot[][]}
 */
export function slotBlocks(slots) {
  /** @type {ExerciseSlot[][]} */
  const blocks = [];
  for (const s of slots) {
    const last = blocks[blocks.length - 1];
    if (last && s.superset && last[0].superset === s.superset) last.push(s);
    else blocks.push([s]);
  }
  return blocks;
}

/**
 * Move a slot `delta` places up (negative) or down within its day. A superset pair moves as one block, so its
 * members stay together. Out of range → unchanged.
 * @param {Program} program @param {string} dayKey @param {string} slotId @param {number} delta @param {TimeLike} [now]
 * @returns {Program}
 */
export function moveSlot(program, dayKey, slotId, delta, now) {
  const at = locate(program, dayKey, slotId);
  if (!at || !Number.isFinite(delta) || !delta) return program;
  const [di] = at;
  const day = program.days[di];
  const blocks = slotBlocks(day.slots);
  const from = blocks.findIndex((b) => b.some((s) => s.slotId === slotId));
  const to = clamp(from + Math.trunc(delta), 0, blocks.length - 1);
  if (from < 0 || to === from) return program;
  const [block] = blocks.splice(from, 1);
  blocks.splice(to, 0, block);
  return withDay(program, di, { ...day, slots: blocks.flat() }, now);
}

/**
 * Add an exercise at the end of a day with the goal's prescription for its inferred role (compounds as secondary
 * lifts, then isolation, small muscles, trunk, holds, carries). Already in that day, unknown exercise or day →
 * unchanged.
 * @param {Program} program @param {string} dayKey @param {string} exerciseId @param {TimeLike} [now]
 * @param {{ catalog?: ExerciseLookup }} [opts] @returns {Program}
 */
export function addSlot(program, dayKey, exerciseId, now, { catalog } = {}) {
  const lookup = catalog ?? DEFAULT_LOOKUP;
  const di = program.days.findIndex((d) => d.key === dayKey);
  const exercise = lookup.exerciseById(exerciseId);
  if (di < 0 || !exercise || !exerciseAllowed(program, exercise)) return program;
  const day = program.days[di];
  if (day.slots.some((s) => s.exerciseId === exerciseId)) return program;
  const slotId = nextSlotId(program, dayKey);
  const secondary = roleParams(program.goal, "secondary").repRange;
  /** @type {ExerciseSlot} */
  const probe = { slotId, exerciseId, sets: 0, repRange: [secondary[0], secondary[1]], rir: 0, restSec: 0, progression: "double" };
  const role = slotRole(program, probe, lookup);
  const unit = unitOf(exercise);
  const slot = patched(deriveSlot({ slotId, exerciseId, role }, program.goal, unit, exercise), {}, program.goal, unit);
  const b = slotBounds(program.goal, unit);
  slot.repRange = clampRange(slot.repRange, b.reps, b.step);
  return withDay(program, di, { ...day, slots: [...day.slots, slot] }, now);
}

/**
 * Remove a slot. Never empties a day (the last slot stays). A superset partner left alone becomes a straight set
 * with its role's normal rest.
 * @param {Program} program @param {string} dayKey @param {string} slotId @param {TimeLike} [now]
 * @param {{ catalog?: ExerciseLookup }} [opts] @returns {Program}
 */
export function removeSlot(program, dayKey, slotId, now, { catalog } = {}) {
  const lookup = catalog ?? DEFAULT_LOOKUP;
  const at = locate(program, dayKey, slotId);
  if (!at) return program;
  const [di, si] = at;
  const day = program.days[di];
  if (day.slots.length <= 1) return program;
  const gone = day.slots[si];
  let slots = day.slots.filter((_, i) => i !== si);
  if (gone.superset) {
    const mates = slots.filter((s) => s.superset === gone.superset);
    if (mates.length === 1) {
      const mate = mates[0];
      const single = copySlot(mate);
      delete single.superset;
      single.restSec = roleParams(program.goal, slotRole(program, mate, lookup)).restSec;
      slots = slots.map((s) => (s === mate ? single : s));
    }
  }
  return withDay(program, di, { ...day, slots }, now);
}

/* ------------------------------------------------------------------ legs, templates, progression */

/**
 * Add the legs add-on: its own day "L" in the rotation (default) or its five slots spread over the days
 * (`as: "slots"`). Already there → unchanged.
 * @param {Program} program @param {TimeLike} [now] @param {{ as?: "day" | "slots", catalog?: ExerciseLookup }} [opts]
 * @returns {Program}
 */
export function addLegs(program, now, { as = "day", catalog } = {}) {
  if (legsMode(program)) return program;
  const next = withLegs(program, now, { as, id: program.id, catalog });
  return next === program ? program : { ...next, version: (program.version ?? 1) + 1, updatedAt: toIso(now) };
}

/**
 * Remove the legs add-on (the "L" day and the L1–L5 slots, with the leg groups they added to the days' focus).
 * No legs → unchanged.
 * @param {Program} program @param {TimeLike} [now] @returns {Program}
 */
export function removeLegs(program, now) {
  if (!legsMode(program)) return program;
  const days = program.days
    .filter((d) => d.key !== "L")
    .map((d) => {
      const slots = d.slots.filter((s) => !LEGS_SLOT_IDS.has(s.slotId));
      if (slots.length === d.slots.length) return d;
      return { ...d, focus: d.focus.filter((g) => !LEGS_FOCUS.has(g)), slots };
    });
  return bump(program, days, now);
}

/**
 * Start over from a template (the owner's edits are dropped): a fresh program under the goal and day count, with a
 * new block calendar. A day count that does not match the template picks the 2-/3-/4-day template (buildProgram).
 * With `from` (the program being replaced) the result keeps its id and takes the next version, like every edit.
 * @param {string} templateId @param {GoalMode} goal @param {number} days @param {TimeLike} [now]
 * @param {{ catalog?: ExerciseLookup, id?: string, from?: Program | null }} [opts] @returns {Program}
 */
export function resetToTemplate(templateId, goal, days, now, { catalog, id, from } = {}) {
  const fresh = buildProgram({ templateId, goal, daysPerWeek: days, now, catalog, id: id ?? from?.id });
  return from ? enforcePlanPreferences({ ...fresh, ...(from.preferences ? { preferences: from.preferences } : {}), pivotReason: from.pivotReason, version: (from.version ?? 1) + 1 }, catalog) : fresh;
}

/**
 * Change one progression rule's parameters (step %, fails before a deload, deload %, overshoot reps), clamped to
 * PROGRESSION_BOUNDS (steps of 0.5 % for the step). The slot's own rep range and RIR still win (slotParams).
 * @param {Program} program @param {ProgressionRuleId} ruleId @param {ProgressionPatch} patch @param {TimeLike} [now]
 * @returns {Program}
 */
export function setProgressionParams(program, ruleId, patch, now) {
  if (!PROGRESSION_RULE_IDS.includes(ruleId) || !patch) return program;
  const progression = copyProgression(program);
  const cur = progression[ruleId];
  const next = { ...cur };
  const B = PROGRESSION_BOUNDS;
  if (typeof patch.stepPct === "number" && Number.isFinite(patch.stepPct)) next.stepPct = clamp(Math.round(patch.stepPct * 2) / 2, B.stepPct[0], B.stepPct[1]);
  if (typeof patch.failsBeforeDeload === "number" && Number.isFinite(patch.failsBeforeDeload)) next.failsBeforeDeload = clampInt(patch.failsBeforeDeload, B.failsBeforeDeload);
  if (typeof patch.deloadPct === "number" && Number.isFinite(patch.deloadPct)) next.deloadPct = clampInt(patch.deloadPct, B.deloadPct);
  if (typeof patch.overshootReps === "number" && Number.isFinite(patch.overshootReps)) next.overshootReps = clampInt(patch.overshootReps, B.overshootReps);
  const same = next.stepPct === cur.stepPct && next.failsBeforeDeload === cur.failsBeforeDeload && next.deloadPct === cur.deloadPct && next.overshootReps === cur.overshootReps;
  if (same) return program;
  progression[ruleId] = next;
  return { ...program, progression, version: (program.version ?? 1) + 1, updatedAt: toIso(now) };
}

/**
 * Weeks between planned deload weeks: 0 = reactive deloads only, otherwise 3–12.
 * @param {Program} program @param {number} weeks @param {TimeLike} [now] @returns {Program}
 */
export function setDeloadEvery(program, weeks, now) {
  if (!Number.isFinite(weeks)) return program;
  const w = weeks <= 0 ? 0 : clampInt(weeks, DELOAD_EVERY_BOUNDS);
  if (w === program.deloadEveryWeeks) return program;
  return { ...program, deloadEveryWeeks: w, version: (program.version ?? 1) + 1, updatedAt: toIso(now) };
}

/* ------------------------------------------------------------------ holds (master plan §16) */

/** A hold lasts 1–8 weeks. */
export const HOLD_WEEKS = Object.freeze(/** @type {[number, number]} */ ([1, 8]));

/**
 * When a hold of `weeks` weeks set at `now` ends (ExerciseState.holdUntil): the local midnight that starts the day
 * AFTER the day `weeks` weeks ahead. A 3-day A/B/C rotation brings an exercise back on the same weekday, so the
 * session on that weekday `weeks` weeks later is still held. Weeks are clamped to HOLD_WEEKS.
 * @param {TimeLike} now @param {number} weeks @returns {string} ISO date-time
 */
export function holdUntilFor(now, weeks) {
  const w = clamp(Math.round(Number.isFinite(weeks) ? weeks : HOLD_WEEKS[0]), HOLD_WEEKS[0], HOLD_WEEKS[1]);
  const d = new Date(toMs(now));
  d.setDate(d.getDate() + 7 * w + 1);
  d.setHours(0, 0, 0, 0); // after the step, so a day that starts at 01:00 (DST at midnight) does not shift the target
  return d.toISOString();
}

/**
 * Set or clear an exercise's hold: no load increase in a session before `holdUntil`; reps may still rise within the
 * range, and deloads, break cuts and misses still apply (progression.mjs nextState). `weeks` null or ≤ 0 clears it.
 * Returns the SAME state when nothing changes.
 * @param {ExerciseState} state @param {number | null | undefined} weeks @param {TimeLike} [now] @returns {ExerciseState}
 */
export function setHold(state, weeks, now) {
  if (weeks == null || !(weeks > 0)) return state.holdUntil == null ? state : { ...state, holdUntil: null, updatedAt: toIso(now) };
  const until = holdUntilFor(now ?? Date.now(), weeks);
  return state.holdUntil === until ? state : { ...state, holdUntil: until, updatedAt: toIso(now) };
}

/* ------------------------------------------------------------------ swap candidates */

/**
 * Exercises that may replace `exerciseId`: its catalog alternatives (best first), then the other members of its
 * classes; each marked available or not at the gym.
 * @param {string} exerciseId @param {Gym | null | undefined} [gym]
 * @returns {{ id: string, available: boolean }[]}
 */
export function swapCandidates(exerciseId, gym) {
  /** @type {string[]} */
  const ids = [];
  const add = (/** @type {string} */ id) => {
    if (id !== exerciseId && !ids.includes(id) && catalogExerciseById(id)) ids.push(id);
  };
  for (const id of catalogExerciseById(exerciseId)?.alternatives ?? []) add(id);
  for (const id of classMates(exerciseId)) add(id);
  return ids.map((id) => ({ id, available: catalogIsAvailable(id, gym) }));
}

/**
 * True when `b` can stand in for `a`: listed as an alternative either way, or a member of one of `a`'s classes.
 * @param {string} a @param {string} b
 */
export function likeForLike(a, b) {
  if (a === b) return true;
  if (catalogExerciseById(a)?.alternatives?.includes(b)) return true;
  if (catalogExerciseById(b)?.alternatives?.includes(a)) return true;
  return classMates(a).includes(b);
}

/* ------------------------------------------------------------------ diff */

/** @param {string} id @param {ExerciseLookup} lookup @returns {Text2} */
const nameOf = (id, lookup) => {
  const n = lookup.exerciseById(id)?.name;
  return n ? { en: n.en, ru: n.ru || n.en } : { en: id, ru: id };
};
/** @param {number} sec */
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
/** @param {[number, number]} r @param {RepUnit} unit @param {"en" | "ru"} lang */
function rangeText(r, unit, lang) {
  const span = r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`;
  if (unit === "seconds") return `${span} ${lang === "ru" ? "с" : "s"}`;
  if (unit === "meters") return `${span} ${lang === "ru" ? "м" : "m"}`;
  return `${span} ${lang === "ru" ? "повт." : "reps"}`;
}
/** @param {number} n */
const setsRu = (n) => {
  const a = n % 100;
  const b = n % 10;
  return a > 10 && a < 20 ? "подходов" : b === 1 ? "подход" : b > 1 && b < 5 ? "подхода" : "подходов";
};
/** @param {(lang: "en" | "ru") => string} f @returns {Text2} */
const both = (f) => ({ en: f("en"), ru: f("ru") });
/** 2.5 → "2,5": the Russian decimal comma. @param {number} n */
const ruNum = (n) => String(n).replace(".", ",");
/** @param {Record<string, ProgressionParams> | undefined} p @param {ProgressionRuleId} rule */
const ruleOf = (p, rule) => p?.[rule];

const RULE_NAMES = /** @type {Record<ProgressionRuleId, Text2>} */ ({
  double: { en: "double progression", ru: "двойная прогрессия" },
  linear: { en: "linear", ru: "линейная" },
  rpe: { en: "by effort (RIR)", ru: "по усилию (RIR)" },
  "rep-target": { en: "reps only", ru: "только повторения" },
});

/**
 * Readable differences between two versions of a program: goal, days, template, legs, deload interval, progression
 * parameters, and per slot (when the template is the same) swaps, sets, reps, RIR, rest, rule, added, removed and
 * reordered slots. With a goal change the re-derived numbers are summed up by the goal line.
 * @param {Program} before @param {Program} after @param {{ catalog?: ExerciseLookup }} [opts] @returns {DiffLine[]}
 */
export function programDiff(before, after, { catalog } = {}) {
  const lookup = catalog ?? DEFAULT_LOOKUP;
  /** @type {DiffLine[]} */
  const out = [];
  if (before.templateId === after.templateId && before.daysPerWeek === after.daysPerWeek && (before.name.en !== after.name.en || before.name.ru !== after.name.ru)) out.push({ kind: "template", text: { en: `Plan name: ${after.name.en}`, ru: `Название плана: ${after.name.ru}` } });
  if (JSON.stringify(before.preferences) !== JSON.stringify(after.preferences)) out.push({ kind: "goal", text: { en: `Training preferences: ${after.preferences?.bodyScope ?? 'custom'}; supporting goals: ${(after.preferences?.secondaryGoals ?? []).join(', ') || 'none'}; exclusions: ${(after.preferences?.excludedGroups ?? []).join(', ') || 'none'}`, ru: `Настройки плана: ${after.preferences?.bodyScope ?? 'custom'}; дополнительные цели: ${(after.preferences?.secondaryGoals ?? []).join(', ') || 'нет'}; исключения: ${(after.preferences?.excludedGroups ?? []).join(', ') || 'нет'}` } });
  if (before.pivotReason !== after.pivotReason) out.push({ kind: "goal", text: { en: `Reason for change: ${after.pivotReason || 'not specified'}`, ru: `Причина изменения: ${after.pivotReason || 'не указана'}` } });
  for (const day of after.days) {
    const old = before.days.find((d) => d.key === day.key);
    if (before.templateId === after.templateId && before.daysPerWeek === after.daysPerWeek && old && (old.name.en !== day.name.en || old.name.ru !== day.name.ru)) out.push({ kind: "moved", dayKey: day.key, text: { en: `Day ${day.key}: ${day.name.en}`, ru: `День ${day.key}: ${day.name.ru}` } });
  }
  if (before.days.length === after.days.length && before.days.every((d) => after.days.some((x) => x.key === d.key)) && before.days.map((d) => d.key).join() !== after.days.map((d) => d.key).join()) out.push({ kind: "moved", text: { en: "Workout day order changed", ru: "Порядок тренировочных дней изменён" } });
  const goalChanged = before.goal !== after.goal;
  if (goalChanged) {
    const a = GOAL_MODES[before.goal]?.name ?? { en: before.goal, ru: before.goal };
    const b = GOAL_MODES[after.goal]?.name ?? { en: after.goal, ru: after.goal };
    out.push({ kind: "goal", text: { en: `Goal: ${a.en} → ${b.en} (sets, reps, effort and rest re-derived)`, ru: `Цель: ${a.ru} → ${b.ru} (подходы, повторения, усилие и отдых пересчитаны)` } });
  }
  if (before.daysPerWeek !== after.daysPerWeek) {
    out.push({ kind: "days", text: { en: `Days per week: ${before.daysPerWeek} → ${after.daysPerWeek}`, ru: `Дней в неделю: ${before.daysPerWeek} → ${after.daysPerWeek}` } });
  } else if (before.templateId !== after.templateId) {
    out.push({ kind: "template", text: { en: `Template: ${after.name.en}`, ru: `Шаблон: ${after.name.ru}` } });
  }
  const legsA = legsMode(before);
  const legsB = legsMode(after);
  if (!legsA && legsB) out.push({ kind: "legs", text: legsB === "day" ? { en: "Legs day added (L)", ru: "Добавлен день ног (L)" } : { en: "Leg exercises added to the days", ru: "Упражнения на ноги добавлены в дни" } });
  if (legsA && !legsB) out.push({ kind: "legs", text: { en: "Legs removed", ru: "Ноги убраны" } });
  if (before.deloadEveryWeeks !== after.deloadEveryWeeks && !goalChanged) {
    const w = (/** @type {number} */ n, /** @type {"en" | "ru"} */ l) => (n ? (l === "ru" ? `каждые ${n} нед.` : `every ${n} weeks`) : (l === "ru" ? "только по сигналам" : "only when needed"));
    out.push({ kind: "deload", text: both((l) => `${l === "ru" ? "Разгрузка" : "Deload"}: ${w(before.deloadEveryWeeks, l)} → ${w(after.deloadEveryWeeks, l)}`) });
  }
  if (!goalChanged) {
    for (const rule of PROGRESSION_RULE_IDS) {
      const a = ruleOf(before.progression, rule);
      const b = ruleOf(after.progression, rule);
      if (!a || !b) continue;
      /** @type {string[][]} */
      const parts = [];
      if (a.stepPct !== b.stepPct) parts.push([`step ${a.stepPct} → ${b.stepPct} %`, `шаг ${ruNum(a.stepPct)} → ${ruNum(b.stepPct)} %`]);
      if (a.failsBeforeDeload !== b.failsBeforeDeload) parts.push([`deload after ${a.failsBeforeDeload} → ${b.failsBeforeDeload} misses`, `разгрузка после ${a.failsBeforeDeload} → ${b.failsBeforeDeload} неудач`]);
      if (a.deloadPct !== b.deloadPct) parts.push([`deload ${a.deloadPct} → ${b.deloadPct} %`, `разгрузка ${a.deloadPct} → ${b.deloadPct} %`]);
      if (a.overshootReps !== b.overshootReps) parts.push([`double step at +${a.overshootReps} → +${b.overshootReps} reps`, `двойной шаг при +${a.overshootReps} → +${b.overshootReps} повт.`]);
      if (parts.length) out.push({ kind: "progression", text: { en: `Progression (${RULE_NAMES[rule].en}): ${parts.map((p) => p[0]).join(", ")}`, ru: `Прогрессия (${RULE_NAMES[rule].ru}): ${parts.map((p) => p[1]).join(", ")}` } });
    }
  }
  if (before.templateId !== after.templateId || before.daysPerWeek !== after.daysPerWeek) return out;

  /** @type {Map<string, { day: string, slot: ExerciseSlot, index: number }>} */
  const old = new Map();
  for (const d of before.days) d.slots.forEach((s, index) => old.set(s.slotId, { day: d.key, slot: s, index }));
  /** @type {Set<string>} */
  const seen = new Set();
  for (const d of after.days) {
    const prevDay = before.days.find((x) => x.key === d.key);
    const prevOrder = (prevDay?.slots ?? []).map((s) => s.slotId).filter((id) => d.slots.some((s) => s.slotId === id));
    const nextOrder = d.slots.map((s) => s.slotId).filter((id) => prevOrder.includes(id));
    if (prevDay && prevOrder.join() !== nextOrder.join()) out.push({ kind: "moved", dayKey: d.key, text: { en: `Day ${d.key}: order changed`, ru: `День ${d.key}: изменён порядок` } });
    for (const s of d.slots) {
      seen.add(s.slotId);
      const prev = old.get(s.slotId);
      const unit = unitFor(s.exerciseId, lookup);
      const n = nameOf(s.exerciseId, lookup);
      const tag = (/** @type {"en" | "ru"} */ l) => `${s.slotId} · ${l === "ru" ? n.ru : n.en}`;
      if (!prev) {
        out.push({ kind: "added", dayKey: d.key, slotId: s.slotId, text: both((l) => `${tag(l)} ${l === "ru" ? "добавлено" : "added"}`) });
        continue;
      }
      const p = prev.slot;
      if (p.exerciseId !== s.exerciseId) {
        const a = nameOf(p.exerciseId, lookup);
        out.push({ kind: "swap", dayKey: d.key, slotId: s.slotId, text: { en: `${s.slotId} · ${a.en} → ${n.en}`, ru: `${s.slotId} · ${a.ru} → ${n.ru}` } });
      }
      if (goalChanged) continue;
      if (p.sets !== s.sets) out.push({ kind: "sets", dayKey: d.key, slotId: s.slotId, text: both((l) => `${tag(l)}: ${p.sets} → ${s.sets} ${l === "ru" ? setsRu(s.sets) : s.sets === 1 ? "set" : "sets"}`) });
      if (!sameRange(p.repRange, s.repRange)) out.push({ kind: "reps", dayKey: d.key, slotId: s.slotId, text: both((l) => `${tag(l)}: ${rangeText(p.repRange, unit, l)} → ${rangeText(s.repRange, unit, l)}`) });
      if (p.rir !== s.rir) out.push({ kind: "rir", dayKey: d.key, slotId: s.slotId, text: both((l) => `${tag(l)}: ${l === "ru" ? "запас" : "RIR"} ${p.rir} → ${s.rir}`) });
      if (p.restSec !== s.restSec) out.push({ kind: "rest", dayKey: d.key, slotId: s.slotId, text: both((l) => `${tag(l)}: ${l === "ru" ? "отдых" : "rest"} ${clock(p.restSec)} → ${clock(s.restSec)}`) });
      if (p.progression !== s.progression) out.push({ kind: "rule", dayKey: d.key, slotId: s.slotId, text: both((l) => `${tag(l)}: ${RULE_NAMES[p.progression]?.[l] ?? p.progression} → ${RULE_NAMES[s.progression]?.[l] ?? s.progression}`) });
    }
  }
  for (const [id, prev] of old) {
    if (seen.has(id)) continue;
    const n = nameOf(prev.slot.exerciseId, lookup);
    out.push({ kind: "removed", dayKey: prev.day, slotId: id, text: { en: `${id} · ${n.en} removed`, ru: `${id} · ${n.ru} убрано` } });
  }
  return out;
}
