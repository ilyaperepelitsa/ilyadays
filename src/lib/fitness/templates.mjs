// @ts-check
/**
 * Goal modes, split templates and program building (stream 03, plans/fitness/03-program-engine-and-progression.md).
 * Data: content/fitness/templates.json; ids: content/fitness/registry.json. Pure: no DOM, no fs.
 *
 * A template slot names a ROLE (primary, secondary, isolation, small, trunk, hold, carry); every goal mode defines
 * sets × reps × RIR × rest per role. buildProgram() applies the goal's role prescription to every slot and keeps the
 * template's exercises, so switching goals never changes what you train, only how.
 */
import { enforcePlanPreferences, exerciseAllowed } from "./plan-preferences.mjs";
import data from "../../../content/fitness/templates.json" with { type: "json" };
import registry from "../../../content/fitness/registry.json" with { type: "json" };
import { exerciseById as catalogExerciseById, groupOfMuscle } from "./catalog.mjs";

/** @typedef {import("./types").GoalMode} GoalMode */
/** @typedef {import("./types").Program} Program */
/** @typedef {import("./types").ProgramDay} ProgramDay */
/** @typedef {import("./types").ExerciseSlot} ExerciseSlot */
/** @typedef {import("./types").ProgressionParams} ProgressionParams */
/** @typedef {import("./types").ProgressionRuleId} ProgressionRuleId */
/** @typedef {import("./types").MovementPattern} MovementPattern */
/** @typedef {import("./types").Exercise} Exercise */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {"primary" | "secondary" | "isolation" | "small" | "trunk" | "hold" | "carry"} SlotRole */
/** @typedef {"reps" | "seconds" | "meters"} RepUnit */
/**
 * @typedef {object} RolePrescription
 * @property {number} sets
 * @property {[number, number]} repRange  in `unit`
 * @property {number} rir
 * @property {number} restSec
 * @property {RepUnit} [unit]  default "reps"
 * @property {Partial<Record<RepUnit, [number, number]>>} [byUnit]  ranges when the exercise counts another unit
 */
/**
 * @typedef {object} GoalModeParams
 * @property {Text2} name
 * @property {Text2} summary
 * @property {[number, number]} repRange  main-lift range
 * @property {number} rir
 * @property {{ start: number, target: number, max: number, unit?: string }} setsPerMuscleWeek
 * @property {{ compound: number, isolation: number }} restSec
 * @property {[number, number]} frequency  sessions per muscle per week
 * @property {number} blockWeeks  accumulation weeks before a planned deload week
 * @property {Text2} deloadRule
 * @property {ProgressionParams} progression
 * @property {Record<SlotRole, RolePrescription>} roles
 * @property {string[]} sources
 */
/**
 * @typedef {object} TemplateSlot
 * @property {string} slotId
 * @property {string} exerciseId
 * @property {SlotRole} role
 * @property {RepUnit} [unit]  unit hint when the catalog has no entry yet
 * @property {boolean} [priority]  +1 set, first in the day
 * @property {string} [superset]
 * @property {number} [setsAdj]
 * @property {number} [rirAdj]
 * @property {number} sets
 * @property {[number, number]} repRange
 * @property {number} rir
 * @property {number} restSec
 * @property {ProgressionRuleId} progression
 * @property {Text2} why
 * @property {number} [increment]  slot-level override of the exercise's increment
 */
/** @typedef {{ key: string, name: Text2, focus: string[], finisher?: Text2, slots: TemplateSlot[] }} TemplateDay */
/**
 * @typedef {object} Template
 * @property {string} id
 * @property {Text2} name
 * @property {Text2} description
 * @property {number} daysPerWeek
 * @property {GoalMode} goal
 * @property {boolean} [addon]
 * @property {Record<string, string[]>} [distribution]  add-on slot ids per day key for withLegs({ as: "slots" })
 * @property {TemplateDay[]} days
 * @property {string[]} sources
 */
/** @typedef {{ exerciseById: (id: string) => Exercise | undefined }} ExerciseLookup */

/** @type {any} */
const raw = data;

/** @type {GoalMode[]} */
export const GOAL_IDS = ["strength", "hypertrophy", "recomp", "endurance", "maintenance"];
/** @type {ProgressionRuleId[]} */
export const PROGRESSION_RULE_IDS = ["double", "linear", "rpe", "rep-target"];
/** @type {SlotRole[]} */
export const SLOT_ROLES = ["primary", "secondary", "isolation", "small", "trunk", "hold", "carry"];
export const DEFAULT_TEMPLATE_ID = "owner-3day-upper";
export const LEGS_TEMPLATE_ID = "legs-addon";
export const TEMPLATES_VERSION = /** @type {string} */ (raw.version);

/** @type {Record<GoalMode, GoalModeParams>} */
export const GOAL_MODES = raw.goalModes;
/** @type {Template[]} */
export const TEMPLATES = raw.templates;
/** Load as % of 1RM for a set taken to failure, keyed "1".."20" (reps + RIR). */
/** @type {Record<string, number>} */
export const REP_MAX_PERCENT = raw.repMaxPercent;
export const REP_MAX_PERCENT_SOURCE = /** @type {string} */ (raw.repMaxPercentSource);
/** @type {{ general: Text2, minutes: number, heavyPctE1rm: number, heavyTotalReps: number, sources: string[] }} */
export const WARMUP = raw.warmup;
/** @type {{ pct: number, reps: number, when: "always" | "heavy" }[]} */
export const WARMUP_RAMP = raw.warmupRamp;
/**
 * Engine constants (sources in templates.json → rules.sources).
 * @type {{
 *   rirTolerance: number, reliableTotalReps: number, unitStep: Record<RepUnit, number>, maxWidenReps: number,
 *   repCeiling: { compound: number, isolation: number }, gapCut: { maxMultiple: number, repsMinus: number },
 *   plateau: { maxSessions: number, spareReps: number },
 *   doubleStepCapPct: number, calibrationExtraRir: number, startLoadFactor: number, bodyweightRefKg: number,
 *   bodyweightExponent: number, prioritySetsBonus: number, superset: { restDivisor: number, minRestSec: number },
 *   gap: { keepBelowDays: number, shortPct: [number, number], longFromDays: number, longPct: [number, number], longFullAtDays: number },
 *   conversion: { firstSessionFactor: number },
 *   deload: { setsMultiplier: number, loadMultiplier: number, rirBonus: number, repsMinus: number },
 *   substitution: { base: number, differentPattern: number, families: Record<string, string>, familyRatio: Record<string, number> },
 *   minutes: { setSec: number, transitionSec: number, rampSetSec: number, finisherDefaultMin: number },
 *   sources: Record<string, string>
 * }}
 */
export const RULES = raw.rules;
/** Coarse muscle groups worked per movement pattern (direct 1, synergist 0.5), used when the catalog lacks muscles. */
/** @type {Record<string, Record<string, number>>} */
export const PATTERN_GROUPS = raw.patternGroups;

/** Multi-joint patterns: they get warm-up ramps and the compound rest. */
/** @type {ReadonlySet<string>} */
export const COMPOUND_PATTERNS = new Set([
  "horizontal-push", "incline-push", "decline-push", "vertical-push", "vertical-pull", "horizontal-pull",
  "squat", "lunge", "hip-hinge", "hip-extension",
]);

/** @type {Record<string, { class: string, classes: string[], slice: string, pattern: string }>} */
const REGISTRY_EXERCISES = /** @type {any} */ (registry.exercises);

/** @type {ExerciseLookup} */
const DEFAULT_LOOKUP = { exerciseById: catalogExerciseById };

/* ------------------------------------------------------------------ small shared helpers */

/** ISO string for a Date | ISO string | epoch ms | undefined (= now). @param {Date | string | number | undefined | null} [now] */
export function toIso(now) {
  if (now == null) return new Date().toISOString();
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Epoch ms for a Date | ISO string | epoch ms | undefined (= now). @param {Date | string | number | undefined | null} [now] */
export function toMs(now) {
  if (now == null) return Date.now();
  const ms = now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.parse(now);
  return Number.isNaN(ms) ? Date.now() : ms;
}

/** Client-generated UUID (the store drops rows whose id is not a UUID). */
export function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // RFC 4122 v4 fallback for very old browsers
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** @param {number} x @param {number} lo @param {number} hi */
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** @param {number} x */
const round5 = (x) => Math.round(x / 5) * 5;

/** What a "rep" counts for an exercise (reps by default). @param {Exercise | null | undefined} exercise @returns {RepUnit} */
export const unitOf = (exercise) => exercise?.repUnit ?? "reps";

/** Registry facts for an id (always available, even before the catalog is merged). @param {string} id */
export const registryEntry = (id) => REGISTRY_EXERCISES[id];

/** Movement pattern of an exercise: catalog first, then the registry. @param {string} id @param {ExerciseLookup} [lookup] */
export function patternOf(id, lookup = DEFAULT_LOOKUP) {
  return lookup.exerciseById(id)?.pattern ?? REGISTRY_EXERCISES[id]?.pattern ?? null;
}

/**
 * Coarse groups an exercise works: catalog muscles (primary groups 1, secondary-only groups 0.5), else the pattern
 * map in templates.json. @param {string} id @param {ExerciseLookup} [lookup] @returns {Record<string, number>}
 */
export function groupWeights(id, lookup = DEFAULT_LOOKUP) {
  const ex = lookup.exerciseById(id);
  if (ex?.primary?.length) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const m of ex.primary) out[groupOfMuscle(m)] = 1;
    for (const m of ex.secondary ?? []) {
      const g = groupOfMuscle(m);
      if (!(g in out)) out[g] = 0.5;
    }
    return out;
  }
  const pattern = patternOf(id, lookup);
  return { ...(pattern ? PATTERN_GROUPS[pattern] ?? {} : {}) };
}

/** Groups an exercise trains directly (weight 1). @param {string} id @param {ExerciseLookup} [lookup] */
export const directGroups = (id, lookup = DEFAULT_LOOKUP) =>
  Object.entries(groupWeights(id, lookup)).filter(([, w]) => w >= 1).map(([g]) => g);

/* ------------------------------------------------------------------ lookups */

/** @param {string} id @returns {Template | undefined} */
export const templateById = (id) => TEMPLATES.find((t) => t.id === id);

/** Goal mode parameters; unknown goals fall back to recomp. @param {GoalMode | string | null | undefined} goal @returns {GoalModeParams} */
export function modeParams(goal) {
  return GOAL_MODES[/** @type {GoalMode} */ (goal)] ?? GOAL_MODES.recomp;
}

/** @param {GoalMode | string} goal @param {SlotRole | string} role @returns {RolePrescription} */
export function roleParams(goal, role) {
  const roles = modeParams(goal).roles;
  return roles[/** @type {SlotRole} */ (role)] ?? roles.isolation;
}

/**
 * Rep range of a role for a unit: the role's own range in its unit, its `byUnit` range otherwise, else the
 * exercise's catalog range. @param {RolePrescription} role @param {RepUnit} unit @param {Exercise | null | undefined} [exercise]
 * @returns {[number, number]}
 */
export function rangeForUnit(role, unit, exercise) {
  if (unit === (role.unit ?? "reps")) return [role.repRange[0], role.repRange[1]];
  const byUnit = role.byUnit?.[unit];
  if (byUnit) return [byUnit[0], byUnit[1]];
  if (exercise?.repRange && unitOf(exercise) === unit) return [exercise.repRange[0], exercise.repRange[1]];
  return unit === "reps" ? [8, 12] : [20, 40];
}

/** All four progression rules for a goal (slots use "double"; the others share its numbers). @param {GoalMode} goal */
export function progressionRecord(goal) {
  const base = modeParams(goal).progression;
  /** @type {Record<ProgressionRuleId, ProgressionParams>} */
  const out = /** @type {any} */ ({});
  for (const rule of PROGRESSION_RULE_IDS) out[rule] = { ...base, rule, repRange: [base.repRange[0], base.repRange[1]] };
  return out;
}

/**
 * One program slot from a template slot under a goal: role prescription, +1 set when priority, setsAdj / rirAdj,
 * superset members rest max(60, rest ÷ 2).
 * @param {Pick<TemplateSlot, "slotId" | "exerciseId" | "role"> & Partial<TemplateSlot>} tslot
 * @param {GoalMode} goal
 * @param {RepUnit} [unit]
 * @param {Exercise | null} [exercise]
 * @returns {ExerciseSlot}
 */
export function deriveSlot(tslot, goal, unit, exercise) {
  const role = roleParams(goal, tslot.role);
  const u = unit ?? tslot.unit ?? role.unit ?? "reps";
  const sets = clamp(role.sets + (tslot.priority ? RULES.prioritySetsBonus : 0) + (tslot.setsAdj ?? 0), 1, 5);
  const restSec = tslot.superset
    ? Math.max(RULES.superset.minRestSec, round5(role.restSec / RULES.superset.restDivisor))
    : role.restSec;
  /** @type {ExerciseSlot} */
  const slot = {
    slotId: tslot.slotId,
    exerciseId: tslot.exerciseId,
    sets,
    repRange: rangeForUnit(role, u, exercise),
    rir: clamp(role.rir + (tslot.rirAdj ?? 0), 0, 5),
    restSec,
    progression: tslot.progression ?? "double",
  };
  if (tslot.priority) slot.priority = true;
  if (tslot.superset) slot.superset = tslot.superset;
  if (tslot.why) slot.why = { en: tslot.why.en, ru: tslot.why.ru };
  if (typeof tslot.increment === "number") slot.increment = tslot.increment;
  return slot;
}

/** @param {TemplateDay} tday @param {GoalMode} goal @param {ExerciseLookup} lookup @returns {ProgramDay} */
function buildDay(tday, goal, lookup) {
  /** @type {ProgramDay} */
  const day = {
    key: tday.key,
    name: { en: tday.name.en, ru: tday.name.ru },
    focus: [...tday.focus],
    slots: tday.slots.map((s) => {
      const exercise = lookup.exerciseById(s.exerciseId) ?? null;
      const unit = exercise ? unitOf(exercise) : (s.unit ?? roleParams(goal, s.role).unit ?? "reps");
      return deriveSlot(s, goal, unit, exercise);
    }),
  };
  if (tday.finisher) day.finisher = { en: tday.finisher.en, ru: tday.finisher.ru };
  return day;
}

/** @param {unknown} n @returns {n is 2 | 3 | 4} */
const isDays = (n) => n === 2 || n === 3 || n === 4;

/**
 * Build a program from a template under a goal mode.
 * A day count different from the template's uses the 2-day or 4-day template (3 → the owner's A/B/C).
 * `gym` and `bodyweightKg` (master plan §7) are accepted and not needed: programs are gym-independent (planSession
 * resolves exercises per gym) and start loads come from the progression memory.
 * @param {{ templateId?: string, goal?: GoalMode, daysPerWeek?: number, now?: Date | string | number, id?: string, catalog?: ExerciseLookup, gym?: import("./types").Gym | null, bodyweightKg?: number | null }} [opts]
 * @returns {Program}
 */
export function buildProgram({ templateId = DEFAULT_TEMPLATE_ID, goal, daysPerWeek, now, id, catalog } = {}) {
  let tpl = templateById(templateId);
  if (!tpl) throw new Error(`Unknown fitness template "${templateId}"`);
  if (tpl.addon) throw new Error(`"${tpl.id}" is an add-on: build a program first, then call withLegs(program)`);
  const days = daysPerWeek ?? tpl.daysPerWeek;
  if (!isDays(days)) throw new Error(`daysPerWeek must be 2, 3 or 4 (got ${daysPerWeek})`);
  if (days !== tpl.daysPerWeek) {
    const preferred = days === 2 ? "upper-2day" : days === 4 ? "upper-4day" : DEFAULT_TEMPLATE_ID;
    tpl = templateById(preferred) ?? TEMPLATES.find((t) => !t.addon && t.daysPerWeek === days) ?? tpl;
  }
  const g = goal ?? tpl.goal;
  if (!GOAL_IDS.includes(g)) throw new Error(`Unknown goal mode "${goal}"`);
  const lookup = catalog ?? DEFAULT_LOOKUP;
  const at = toIso(now);
  return {
    id: id ?? newId(),
    templateId: tpl.id,
    name: { en: tpl.name.en, ru: tpl.name.ru },
    goal: g,
    daysPerWeek: days,
    days: tpl.days.map((d) => buildDay(d, g, lookup)),
    rotation: "sequential",
    progression: progressionRecord(g),
    deloadEveryWeeks: modeParams(g).blockWeeks,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
}

/** The template slot behind a program slot (same slot id in the program's template or the legs add-on). @param {Program} program @param {string} slotId */
function templateSlotFor(program, slotId) {
  for (const id of [program.templateId, LEGS_TEMPLATE_ID]) {
    const tpl = templateById(id);
    for (const day of tpl?.days ?? []) {
      const hit = day.slots.find((s) => s.slotId === slotId);
      if (hit) return hit;
    }
  }
  return undefined;
}

const HOLD_PATTERNS = new Set(["anti-extension", "anti-rotation", "lateral-flexion"]);
const TRUNK_PATTERNS = new Set(["trunk-flexion", "hip-flexion", "rotation", "spinal-extension"]);
const SMALL_PATTERNS = new Set([
  "lateral-raise", "rear-delt", "external-rotation", "front-raise", "calf-raise", "forearm-flexion",
  "forearm-extension", "grip", "neck", "shrug",
]);

/**
 * Role of a program slot: from its template (by slot id), otherwise inferred from the exercise and the slot's
 * current rep range. @param {Program} program @param {ExerciseSlot} slot @param {ExerciseLookup} [lookup] @returns {SlotRole}
 */
export function slotRole(program, slot, lookup = DEFAULT_LOOKUP) {
  const tslot = templateSlotFor(program, slot.slotId);
  if (tslot) return tslot.role;
  const exercise = lookup.exerciseById(slot.exerciseId);
  const unit = unitOf(exercise);
  const pattern = patternOf(slot.exerciseId, lookup);
  if (unit === "meters" || pattern === "carry") return "carry";
  if (unit === "seconds" || (pattern && HOLD_PATTERNS.has(pattern))) return "hold";
  if (pattern && TRUNK_PATTERNS.has(pattern)) return "trunk";
  if (pattern && SMALL_PATTERNS.has(pattern)) return "small";
  if (pattern && COMPOUND_PATTERNS.has(pattern)) {
    const roles = modeParams(program.goal).roles;
    const same = (/** @type {[number, number]} */ r) => r[0] === slot.repRange[0] && r[1] === slot.repRange[1];
    return same(roles.primary.repRange) && !same(roles.secondary.repRange) ? "primary" : "secondary";
  }
  return "isolation";
}

/**
 * Progression parameters for nextState(): the program's rule with the slot's own rep range and RIR.
 * @param {Program} program @param {ExerciseSlot} slot @returns {ProgressionParams}
 */
export function slotParams(program, slot) {
  const base = program.progression?.[slot.progression] ?? program.progression?.double ?? modeParams(program.goal).progression;
  return { ...base, rule: slot.progression ?? base.rule, repRange: [slot.repRange[0], slot.repRange[1]], rir: slot.rir };
}

/**
 * Switch the goal mode: same days and exercises, re-derived sets × reps × RIR × rest, all four rules, the goal's
 * deload interval. Returns a NEW program row (`version + 1`, new id unless given, `createdAt = now` so the block and
 * deload counters restart, research/01 Table 10). States convert lazily in planSession (convertState).
 * @param {Program} program @param {GoalMode} newGoal @param {Date | string | number} [now]
 * @param {{ id?: string, catalog?: ExerciseLookup }} [opts]
 * @returns {Program}
 */
export function convertProgram(program, newGoal, now, { id, catalog } = {}) {
  if (!GOAL_IDS.includes(newGoal)) throw new Error(`Unknown goal mode "${newGoal}"`);
  const lookup = catalog ?? DEFAULT_LOOKUP;
  const at = toIso(now);
  return enforcePlanPreferences({
    ...program,
    id: id ?? newId(),
    goal: newGoal,
    days: program.days.map((day) => ({
      ...day,
      focus: [...day.focus],
      slots: day.slots.map((slot) => {
        const tslot = templateSlotFor(program, slot.slotId);
        const exercise = lookup.exerciseById(slot.exerciseId) ?? null;
        const role = tslot?.role ?? slotRole(program, slot, lookup);
        const unit = exercise ? unitOf(exercise) : (tslot?.unit ?? roleParams(newGoal, role).unit ?? "reps");
        const next = deriveSlot({
          slotId: slot.slotId,
          exerciseId: slot.exerciseId,
          role,
          priority: slot.priority,
          superset: slot.superset,
          setsAdj: tslot?.setsAdj,
          rirAdj: tslot?.rirAdj,
          progression: slot.progression,
          why: slot.why,
          increment: slot.increment,
        }, newGoal, unit, exercise);
        return next;
      }),
    })),
    progression: progressionRecord(newGoal),
    deloadEveryWeeks: modeParams(newGoal).blockWeeks,
    version: (program.version ?? 1) + 1,
    createdAt: at,
    updatedAt: at,
  }, lookup);
}

/**
 * Add the legs add-on (registry legsAddon): a new day "L" in the rotation (default), or the five slots spread over
 * the existing days (`as: "slots"`, A: L1 L4 · B: L2 L3 · C: L5). Idempotent: a program that already has the legs
 * exercises is returned unchanged. Returns a new program row (version + 1).
 * @param {Program} program @param {Date | string | number} [now]
 * @param {{ as?: "day" | "slots", id?: string, catalog?: ExerciseLookup }} [opts]
 * @returns {Program}
 */
export function withLegs(program, now, { as = "day", id, catalog } = {}) {
  const legs = templateById(LEGS_TEMPLATE_ID);
  if (!legs) return program;
  const legIds = new Set(legs.days.flatMap((d) => d.slots.map((s) => s.exerciseId)));
  if (program.days.some((d) => d.key === "L" || d.slots.some((s) => legIds.has(s.exerciseId)))) return program;
  const lookup = catalog ?? DEFAULT_LOOKUP;
  const built = buildDay(legs.days[0], program.goal, lookup);
  const legDay = { ...built, slots: built.slots.filter((slot) => exerciseAllowed(program, lookup.exerciseById(slot.exerciseId))) };
  if (!legDay.slots.length) return program;
  /** @type {ProgramDay[]} */
  let days;
  if (as === "slots" && program.days.length > 0) {
    const dist = legs.distribution ?? {};
    const placed = new Set();
    days = program.days.map((d) => {
      const extra = legDay.slots.filter((s) => (dist[d.key] ?? []).includes(s.slotId));
      extra.forEach((s) => placed.add(s.slotId));
      return { ...d, focus: [...new Set([...d.focus, ...(extra.length ? legDay.focus : [])])], slots: [...d.slots, ...extra] };
    });
    legDay.slots.filter((s) => !placed.has(s.slotId)).forEach((s, i) => {
      const d = days[i % days.length];
      days[i % days.length] = { ...d, focus: [...new Set([...d.focus, ...legDay.focus])], slots: [...d.slots, s] };
    });
  } else {
    days = [...program.days, legDay];
  }
  return { ...program, id: id ?? newId(), days, version: (program.version ?? 1) + 1, updatedAt: toIso(now) };
}

/** Minutes a finisher text announces ("Finisher · 12 min …"). @param {Text2 | undefined} finisher */
export function finisherMinutes(finisher) {
  if (!finisher) return 0;
  const m = /(\d+)\s*min/.exec(finisher.en);
  return m ? Number(m[1]) : RULES.minutes.finisherDefaultMin;
}

/**
 * Rough session length for a program day: general warm-up, ramp sets on compounds (one set when an earlier compound
 * already warmed the same muscles), working sets with their rests, one minute per exercise change, and the
 * finisher. Supersets are already priced in through their halved rests.
 * @param {ProgramDay} day @param {{ catalog?: ExerciseLookup, finisher?: boolean }} [opts] @returns {number}
 */
export function estimateMinutes(day, { catalog, finisher = true } = {}) {
  const lookup = catalog ?? DEFAULT_LOOKUP;
  let sec = WARMUP.minutes * 60;
  /** @type {Set<string>} */
  const warmed = new Set();
  for (const slot of day.slots) {
    const exercise = lookup.exerciseById(slot.exerciseId);
    const unit = exercise ? unitOf(exercise) : slot.repRange[1] > 25 ? "meters" : "reps";
    const mid = (slot.repRange[0] + slot.repRange[1]) / 2;
    const setSec = unit === "reps" ? RULES.minutes.setSec : unit === "meters" ? mid * 1.2 + 20 : mid + 15;
    sec += slot.sets * setSec + Math.max(0, slot.sets - 1) * slot.restSec + RULES.minutes.transitionSec;
    const pattern = patternOf(slot.exerciseId, lookup);
    if (pattern && COMPOUND_PATTERNS.has(pattern) && exercise?.equipment !== "bodyweight") {
      const heavy = slot.repRange[0] + slot.rir <= WARMUP.heavyTotalReps;
      const n = heavy ? WARMUP_RAMP.length : WARMUP_RAMP.filter((r) => r.when === "always").length;
      const direct = directGroups(slot.exerciseId, lookup);
      const warm = direct.length > 0 && direct.every((g) => warmed.has(g));
      sec += (warm ? Math.min(1, n) : n) * RULES.minutes.rampSetSec;
      direct.forEach((g) => warmed.add(g));
    }
  }
  if (finisher) sec += finisherMinutes(day.finisher) * 60;
  return Math.round(sec / 60);
}
