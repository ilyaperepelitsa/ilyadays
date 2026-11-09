// @ts-check
/**
 * Gym profiles with the full catalog bound (stream 05, plans/fitness/05-gym-profiles.md). Server views, the engine
 * and tests import this module; client components import ./gyms-core.mjs (this one bundles the exercises JSON).
 *
 * Re-exports every gyms-core function; the ones that need exercise data default `catalog` to GYM_CATALOG.
 * GYM_EXERCISES is the trimmed catalog the /fitness/gyms server view hands to the client (~60 KB instead of 576 KB).
 */
import registry from "../../../content/fitness/registry.json" with { type: "json" };
import { EXERCISES, groupsOf } from "./catalog.mjs";
import { buildProgram } from "./templates.mjs";
import * as core from "./gyms-core.mjs";

/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {import("./gyms-core.mjs").GymExercise} GymExercise */
/** @typedef {import("./gyms-core.mjs").GymCatalog} GymCatalog */
/** @typedef {import("./gyms-core.mjs").PlanLike} PlanLike */
/** @typedef {import("./gyms-core.mjs").PlanSlot} PlanSlot */
/** @typedef {import("./gyms-core.mjs").PlanDay} PlanDay */
/** @typedef {{ key: string, name: Text2, slots: PlanSlot[] }} PreviewDay */

export {
  INCREMENT_CHOICES, MARKS, QUICK_TYPES, STACK_EQUIPMENT, alternativesAt, baseIncrement, effectiveAvailability,
  effectiveIncrement, gymCatalog, hasStack, incrementChoices, isAvailableAt, isChecklist, newGym, newId, nextMark,
  preferForSlot, renameGym, setAvailability, setIncrement, setNotes, setPreferred,
} from "./gyms-core.mjs";

/** @type {Record<string, { classes?: string[] }>} */
const REGISTRY_EXERCISES = /** @type {any} */ (registry.exercises);

/**
 * Every catalog exercise, trimmed to what the gym screen needs (no cues, setup, sources or images).
 * @type {readonly GymExercise[]}
 */
export const GYM_EXERCISES = Object.freeze(EXERCISES.map((e) => {
  /** @type {GymExercise} */
  const row = {
    id: e.id,
    name: { en: e.name.en, ru: e.name.ru },
    equipment: e.equipment,
    group: groupsOf(e.id)[0] ?? "other",
    alternatives: [...e.alternatives],
    classes: [...(REGISTRY_EXERCISES[e.id]?.classes ?? (e.class ? [e.class] : []))],
    increment: e.increment,
  };
  if (e.aka?.length) row.aka = [...e.aka];
  return row;
}));

/** The full catalog in the gym engine's shape. */
export const GYM_CATALOG = core.gymCatalog(GYM_EXERCISES);

/** @param {Gym} gym @param {boolean} on @param {Date | string | number} [now] @param {GymCatalog} [catalog] */
export const setChecklist = (gym, on, now, catalog = GYM_CATALOG) => core.setChecklist(gym, on, now, catalog);

/** @param {Gym | null | undefined} gym @param {string} type @param {GymCatalog} [catalog] */
export const typePresent = (gym, type, catalog = GYM_CATALOG) => core.typePresent(gym, type, catalog);

/** @param {Gym | null | undefined} gym @param {GymCatalog} [catalog] */
export const presentTypes = (gym, catalog = GYM_CATALOG) => core.presentTypes(gym, catalog);

/** @param {Gym} gym @param {readonly string[]} types @param {Date | string | number} [now] @param {GymCatalog} [catalog] */
export const quickSetup = (gym, types, now, catalog = GYM_CATALOG) => core.quickSetup(gym, types, now, catalog);

/** @param {PlanSlot} slot @param {Gym | null | undefined} gym @param {GymCatalog} [catalog] */
export const resolveSlot = (slot, gym, catalog = GYM_CATALOG) => core.resolveSlot(slot, gym, catalog);

/** @param {PlanSlot} slot @param {Gym | null | undefined} gym @param {GymCatalog} [catalog] */
export const slotChoices = (slot, gym, catalog = GYM_CATALOG) => core.slotChoices(slot, gym, catalog);

/** @param {PlanLike | null | undefined} program @param {Gym | null | undefined} gym @param {GymCatalog} [catalog] */
export const planAtGym = (program, gym, catalog = GYM_CATALOG) => core.planAtGym(program, gym, catalog);

/** @param {PlanLike | null | undefined} program @param {Gym | null | undefined} gymA @param {Gym | null | undefined} gymB @param {GymCatalog} [catalog] */
export const planDiff = (program, gymA, gymB, catalog = GYM_CATALOG) => core.planDiff(program, gymA, gymB, catalog);

/** @param {Gym} gym @param {PlanLike | null | undefined} program @param {GymCatalog} [catalog] */
export const gymSummary = (gym, program, catalog = GYM_CATALOG) => core.gymSummary(gym, program, catalog);

/**
 * The days buildProgram makes for a day count (2, 3 or 4; the owner's A/B/C for 3), slots trimmed to ids. The gym
 * page previews these when no program is saved yet.
 * @param {number} [daysPerWeek] @returns {PreviewDay[]}
 */
export function previewDays(daysPerWeek = 3) {
  const program = buildProgram({ daysPerWeek, id: "preview", now: "2026-01-01T00:00:00.000Z" });
  return program.days.map((d) => ({
    key: d.key,
    name: { en: d.name.en, ru: d.name.ru },
    slots: d.slots.map((s) => ({ slotId: s.slotId, exerciseId: s.exerciseId })),
  }));
}
