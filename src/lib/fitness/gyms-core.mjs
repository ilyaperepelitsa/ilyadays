// @ts-check
/**
 * Gym profiles, pure and import-free (stream 05, plans/fitness/05-gym-profiles.md): which exercises a gym has,
 * quick setup by equipment type, preferred substitutes, weight-step overrides, and how the planner resolves every
 * program slot at a gym. Client components import THIS module; src/lib/fitness/gyms.mjs re-exports it with the
 * full catalog bound as the default (that one pulls the 576 KB exercises JSON, so it stays on the server).
 *
 * Every update returns a NEW gym stamped `updatedAt = now`, or the SAME object when nothing changed, so a caller can
 * skip the write. Availability follows catalog.isAvailable: `missing` wins; an empty `available` list means
 * "everything is here"; a non-empty one is a checklist (only listed exercises count).
 */

/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").Equipment} Equipment */
/** @typedef {import("./types").Text2} Text2 */

/**
 * The slice of a catalog Exercise the gym screen needs (server views pass these to client components).
 * @typedef {object} GymExercise
 * @property {string} id
 * @property {Text2} name
 * @property {readonly string[]} [aka]
 * @property {string} equipment
 * @property {string} [group]  coarse group of the first primary muscle ("chest", …; "other" when there is none)
 * @property {readonly string[]} alternatives  ordered by similarity (catalog)
 * @property {readonly string[]} [classes]  registry substitution classes
 * @property {string} [class]  main class (full Exercise objects carry only this one)
 * @property {number} [increment]  catalog load step, kg
 */
/**
 * @typedef {object} GymCatalog
 * @property {readonly GymExercise[]} exercises
 * @property {(id: string) => GymExercise | undefined} exerciseById
 */
/** @typedef {"has" | "missing" | "unknown"} Mark */
/**
 * @typedef {object} Availability
 * @property {Mark} mark  what is stored for this exercise
 * @property {boolean} available  whether the planner may use it here
 * @property {boolean} assumed  unmarked and counted as here (the gym is not a checklist)
 */
/** @typedef {{ slotId: string, exerciseId: string }} PlanSlot */
/** @typedef {{ key: string, name?: Text2, slots: readonly PlanSlot[] }} PlanDay */
/** @typedef {{ days: readonly PlanDay[] }} PlanLike */
/** @typedef {"plan" | "preferred" | "swapped" | "stuck"} SlotStatus */
/**
 * One program slot at a gym.
 * @typedef {object} SlotAtGym
 * @property {string} dayKey
 * @property {string} slotId
 * @property {string} programExerciseId  what the program slot names
 * @property {string} exerciseId  what the planner uses here (session.mjs resolveExercise)
 * @property {SlotStatus} status  plan = as written; preferred = a gym preference; swapped = the program exercise is
 *   not here, first available alternative; stuck = not here and no alternative is (kept as written)
 * @property {boolean} programAvailable
 * @property {string | null} preference  the preference that applies, else the stored one (slot key first)
 * @property {boolean} preferenceIgnored  a preference is stored but is not here or does not fit the slot
 * @property {string[]} choices  what a preference may name here (available, same class or listed alternative),
 *   the program exercise first when it is here
 */
/** @typedef {{ key: string, name: Text2, slots: SlotAtGym[] }} DayAtGym */
/** @typedef {{ days: DayAtGym[], changed: number, stuck: number }} GymPlan */
/** @typedef {{ dayKey: string, slotId: string, programExerciseId: string, from: string, to: string }} PlanChange */
/**
 * @typedef {object} GymSummary
 * @property {boolean} checklist
 * @property {number} here  catalog exercises the planner may use here
 * @property {number} missing  catalog exercises marked missing
 * @property {number} unknown  checklist only: neither ticked nor missing (not used)
 * @property {number} changed  program slots that use another exercise here
 * @property {number} stuck  program slots whose exercise is not here and has no alternative here
 */

/** @type {readonly Mark[]} */
export const MARKS = Object.freeze(["has", "missing", "unknown"]);

/** Equipment types for quick setup, in display order (`short` fits a chip). Bodyweight needs no equipment: no chip. */
/** @type {readonly { id: Equipment, name: Text2, short: Text2 }[]} */
export const QUICK_TYPES = Object.freeze([
  { id: "selectorized", name: { en: "Pin-loaded machines", ru: "Блочные тренажёры" }, short: { en: "Pin-loaded", ru: "Блочные" } },
  { id: "plate-loaded", name: { en: "Plate-loaded machines", ru: "Тренажёры с дисками" }, short: { en: "Plate-loaded", ru: "С дисками" } },
  { id: "cable", name: { en: "Cables", ru: "Блоки и кроссовер" }, short: { en: "Cables", ru: "Блоки" } },
  { id: "dumbbell", name: { en: "Dumbbells", ru: "Гантели" }, short: { en: "Dumbbells", ru: "Гантели" } },
  { id: "barbell", name: { en: "Barbells", ru: "Штанги" }, short: { en: "Barbells", ru: "Штанги" } },
  { id: "smith", name: { en: "Smith machine", ru: "Машина Смита" }, short: { en: "Smith", ru: "Смит" } },
  { id: "assisted", name: { en: "Assisted pull-up / dip machine", ru: "Гравитрон" }, short: { en: "Assisted", ru: "Гравитрон" } },
  { id: "kettlebell", name: { en: "Kettlebells", ru: "Гири" }, short: { en: "Kettlebells", ru: "Гири" } },
  { id: "band", name: { en: "Resistance bands", ru: "Резиновые петли" }, short: { en: "Bands", ru: "Резинки" } },
]);

/** Weight-step chips offered for weight-stack equipment (kg). */
export const INCREMENT_CHOICES = Object.freeze([2.5, 5]);

/** Equipment moved by a pin in a weight stack: pin-loaded machines, cable stations, assisted pull-up / dip machines. */
export const STACK_EQUIPMENT = Object.freeze(["selectorized", "cable", "assisted"]);

/** @param {{ equipment: string } | null | undefined} exercise */
export const hasStack = (exercise) => Boolean(exercise && STACK_EQUIPMENT.includes(exercise.equipment));

const NAME_MAX = 60;
const NOTES_MAX = 2000;

/* ------------------------------------------------------------------ small helpers */

/** ISO string for a Date | ISO string | epoch ms | undefined (= now). @param {Date | string | number | null} [now] */
function toIso(now) {
  if (now == null) return new Date().toISOString();
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** @param {object} obj @param {string} key */
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** @param {unknown} v @returns {string | null} */
const idOrNull = (v) => (typeof v === "string" && v ? v : null);

/** @param {readonly string[]} a @param {readonly string[]} b */
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** @param {unknown} name */
const cleanName = (name) => String(name ?? "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

/** Client-generated UUID v4 (the store keeps rows with other ids local-only). Works outside secure contexts too. */
export function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ------------------------------------------------------------------ the gym row */

/**
 * A new gym: everything counts as here until it is marked missing.
 * @param {string} name @param {Date | string | number} [now] @param {string} [id] @returns {Gym}
 */
export function newGym(name, now, id) {
  return { id: id ?? newId(), name: cleanName(name) || "Gym", available: [], missing: [], preferred: {}, updatedAt: toIso(now) };
}

/** Whitespace is collapsed; an empty name is refused (same gym back). @param {Gym} gym @param {string} name @param {Date | string | number} [now] @returns {Gym} */
export function renameGym(gym, name, now) {
  const next = cleanName(name);
  if (!next || next === gym.name) return gym;
  return { ...gym, name: next, updatedAt: toIso(now) };
}

/** Free text (opening hours, busy machines …), at most 2000 characters; blank removes it. @param {Gym} gym @param {string} notes @param {Date | string | number} [now] @returns {Gym} */
export function setNotes(gym, notes, now) {
  const text = String(notes ?? "").slice(0, NOTES_MAX);
  const clean = text.trim() ? text : "";
  if ((gym.notes ?? "") === clean) return gym;
  /** @type {Gym} */
  const next = { ...gym, updatedAt: toIso(now) };
  if (clean) next.notes = clean;
  else delete next.notes;
  return next;
}

/* ------------------------------------------------------------------ availability */

/** Same semantics as catalog.isAvailable. @param {Gym | null | undefined} gym @param {string} id */
export function isAvailableAt(gym, id) {
  if (!gym) return true;
  if (gym.missing?.includes(id)) return false;
  return !gym.available?.length || gym.available.includes(id);
}

/** A checklist gym uses only the exercises listed in `available`. @param {Gym | null | undefined} gym */
export const isChecklist = (gym) => Boolean(gym?.available?.length);

/**
 * What the chip shows for an exercise: the stored mark, whether the planner may use it, and whether that is only
 * assumed (unmarked in a gym that is not a checklist). No gym = everything assumed.
 * @param {Gym | null | undefined} gym @param {string} id @returns {Availability}
 */
export function effectiveAvailability(gym, id) {
  if (gym?.missing?.includes(id)) return { mark: "missing", available: false, assumed: false };
  if (gym?.available?.includes(id)) return { mark: "has", available: true, assumed: false };
  const assumed = !isChecklist(gym);
  return { mark: "unknown", available: assumed, assumed };
}

/** @param {Set<string>} available @param {Set<string>} missing @param {string} id @param {Mark} mark @param {boolean} checklist */
function applyMark(available, missing, id, mark, checklist) {
  if (mark === "missing") {
    missing.add(id);
    available.delete(id);
  } else if (mark === "has") {
    missing.delete(id);
    if (checklist) available.add(id);
  } else {
    missing.delete(id);
    available.delete(id);
  }
}

/**
 * New lists → the same gym when nothing changed. A checklist never becomes empty, because `available: []` means
 * "everything is here": the ids this change removed stay listed and are marked missing (missing wins), so
 * "nothing ticked" still means "nothing available".
 * @param {Gym} gym @param {Set<string>} availableSet @param {Set<string>} missingSet @param {Date | string | number | undefined} now
 * @returns {Gym}
 */
function commitLists(gym, availableSet, missingSet, now) {
  let available = [...availableSet];
  const missing = [...missingSet];
  if (gym.available.length > 0 && available.length === 0) {
    available = [...new Set(gym.available)];
    for (const id of available) if (!missingSet.has(id)) missing.push(id);
  }
  if (sameList(available, gym.available) && sameList(missing, gym.missing)) return gym;
  return { ...gym, available, missing, updatedAt: toIso(now) };
}

/**
 * Mark one exercise: `missing` adds it to `missing`; `has` removes it from `missing` and, in a checklist, ticks it
 * (an empty `available` list stays empty: everything is assumed anyway); `unknown` removes it from both lists.
 * @param {Gym} gym @param {string} exerciseId @param {Mark} mark @param {Date | string | number} [now] @returns {Gym}
 */
export function setAvailability(gym, exerciseId, mark, now) {
  if (typeof exerciseId !== "string" || !exerciseId) throw new TypeError("setAvailability: exerciseId must be a non-empty string");
  if (!MARKS.includes(mark)) throw new TypeError(`setAvailability: unknown mark "${String(mark)}"`);
  const available = new Set(gym.available);
  const missing = new Set(gym.missing);
  applyMark(available, missing, exerciseId, mark, isChecklist(gym));
  return commitLists(gym, available, missing, now);
}

/**
 * The mark one tap on the chip sets. Not a checklist: here ⇄ missing. Checklist: has → missing → unknown → has
 * (straight back to has when unmarking would empty the checklist).
 * @param {Gym | null | undefined} gym @param {string} id @returns {Mark}
 */
export function nextMark(gym, id) {
  const { mark, available } = effectiveAvailability(gym, id);
  if (!gym || !isChecklist(gym)) return available ? "missing" : "has";
  if (mark === "has") return "missing";
  if (mark === "missing") return gym.available.every((x) => x === id) ? "has" : "unknown";
  return "has";
}

/**
 * Switch between "unmarked counts as here" (off: `available: []`) and a checklist (on). Turning it on ticks every
 * catalog exercise that is not missing, so the plan does not change at the switch; afterwards unmarked exercises
 * (new catalog entries, "not sure") are skipped. Turning it off keeps the missing marks.
 * @param {Gym} gym @param {boolean} on @param {Date | string | number | undefined} now @param {GymCatalog} catalog @returns {Gym}
 */
export function setChecklist(gym, on, now, catalog) {
  if (on === isChecklist(gym)) return gym;
  if (!on) return { ...gym, available: [], updatedAt: toIso(now) };
  const ids = catalog.exercises.map((e) => e.id);
  const missing = new Set(gym.missing);
  const kept = ids.filter((id) => !missing.has(id));
  // everything missing: list it all anyway (all of it stays missing), so the meaning "nothing here" survives
  const available = kept.length ? kept : ids;
  if (!available.length) return gym;
  return { ...gym, available, updatedAt: toIso(now) };
}

/* ------------------------------------------------------------------ quick setup by equipment type */

/** @param {GymCatalog} catalog @param {string} type */
const exercisesOfType = (catalog, type) => catalog.exercises.filter((e) => e.equipment === type);

/**
 * A type counts as present while any of its exercises is available here (a type with no exercises always does).
 * @param {Gym | null | undefined} gym @param {string} type @param {GymCatalog} catalog
 */
export function typePresent(gym, type, catalog) {
  const list = exercisesOfType(catalog, type);
  return list.length === 0 || list.some((e) => isAvailableAt(gym, e.id));
}

/** The quick-setup types present at a gym, in QUICK_TYPES order. @param {Gym | null | undefined} gym @param {GymCatalog} catalog @returns {Equipment[]} */
export const presentTypes = (gym, catalog) => QUICK_TYPES.map((t) => t.id).filter((type) => typePresent(gym, type, catalog));

/**
 * Quick setup: `types` are the equipment types this gym has. Every exercise of an unticked type is marked missing;
 * a ticked type that was absent (none of its exercises available) is restored (`has`); a ticked type that is already
 * present keeps its individual marks. Bodyweight exercises are never touched. Idempotent.
 * @param {Gym} gym @param {readonly string[]} types @param {Date | string | number | undefined} now @param {GymCatalog} catalog
 * @returns {Gym}
 */
export function quickSetup(gym, types, now, catalog) {
  const want = new Set(types);
  const checklist = isChecklist(gym);
  const available = new Set(gym.available);
  const missing = new Set(gym.missing);
  for (const { id: type } of QUICK_TYPES) {
    const list = exercisesOfType(catalog, type);
    if (!list.length) continue;
    if (!want.has(type)) for (const e of list) applyMark(available, missing, e.id, "missing", checklist);
    else if (!typePresent(gym, type, catalog)) for (const e of list) applyMark(available, missing, e.id, "has", checklist);
  }
  return commitLists(gym, available, missing, now);
}

/* ------------------------------------------------------------------ preferences and weight steps */

/**
 * `preferred[key] = exerciseId` (key: a slot id or an exercise id); null or "" removes the key.
 * @param {Gym} gym @param {string} key @param {string | null | undefined} exerciseId @param {Date | string | number} [now] @returns {Gym}
 */
export function setPreferred(gym, key, exerciseId, now) {
  if (typeof key !== "string" || !key) throw new TypeError("setPreferred: key must be a non-empty string");
  const prefs = gym.preferred ?? {};
  if (exerciseId == null || exerciseId === "") {
    if (!hasOwn(prefs, key)) return gym;
    const rest = { ...prefs };
    delete rest[key];
    return { ...gym, preferred: rest, updatedAt: toIso(now) };
  }
  if (prefs[key] === exerciseId) return gym;
  return { ...gym, preferred: { ...prefs, [key]: exerciseId }, updatedAt: toIso(now) };
}

/**
 * The user's choice for one slot at this gym, stored under the slot's EXERCISE id (slot ids differ between the 2-,
 * 3- and 4-day templates; exercise ids do not). The slot-id key is cleared because it would shadow the choice.
 * null (or the slot's own exercise) = automatic.
 * @param {Gym} gym @param {PlanSlot} slot @param {string | null | undefined} exerciseId @param {Date | string | number} [now] @returns {Gym}
 */
export function preferForSlot(gym, slot, exerciseId, now) {
  const cleared = setPreferred(gym, slot.slotId, null, now);
  return exerciseId && exerciseId !== slot.exerciseId
    ? setPreferred(cleared, slot.exerciseId, exerciseId, now)
    : setPreferred(cleared, slot.exerciseId, null, now);
}

/**
 * Weight-step override at this gym (`increments[key]`, key: an exercise id or an equipment type, as
 * progression.incrementFor reads it). null, 0, a negative or a non-finite number removes it.
 * @param {Gym} gym @param {string} key @param {number | null | undefined} kg @param {Date | string | number} [now] @returns {Gym}
 */
export function setIncrement(gym, key, kg, now) {
  if (typeof key !== "string" || !key) throw new TypeError("setIncrement: key must be a non-empty string");
  const inc = gym.increments ?? {};
  const value = typeof kg === "number" && Number.isFinite(kg) && kg > 0 ? Math.round(kg * 100) / 100 : null;
  if (value == null) {
    if (!hasOwn(inc, key)) return gym;
    const rest = { ...inc };
    delete rest[key];
    /** @type {Gym} */
    const next = { ...gym, updatedAt: toIso(now) };
    if (Object.keys(rest).length) next.increments = rest;
    else delete next.increments;
    return next;
  }
  if (inc[key] === value) return gym;
  return { ...gym, increments: { ...inc, [key]: value }, updatedAt: toIso(now) };
}

/** @param {unknown} v @param {unknown} fallback */
const positiveOr = (v, fallback) => {
  const inc = typeof v === "number" && v > 0 ? v : fallback;
  return typeof inc === "number" && Number.isFinite(inc) && inc > 0 ? inc : 0;
};

/**
 * The load step the engine rounds to here: override by exercise id → by equipment type → catalog (mirrors
 * progression.incrementFor). @param {Gym | null | undefined} gym @param {{ id: string, equipment: string, increment?: number }} exercise
 */
export function effectiveIncrement(gym, exercise) {
  const g = gym?.increments;
  return positiveOr(g ? (g[exercise.id] ?? g[exercise.equipment]) : undefined, exercise.increment);
}

/** The step without this exercise's own override (equipment-type override, else the catalog). @param {Gym | null | undefined} gym @param {{ id: string, equipment: string, increment?: number }} exercise */
export const baseIncrement = (gym, exercise) => positiveOr(gym?.increments?.[exercise.equipment], exercise.increment);

/** Chips for one machine: 2.5, 5, the default and the current value, ascending. @param {Gym | null | undefined} gym @param {{ id: string, equipment: string, increment?: number }} exercise @returns {number[]} */
export function incrementChoices(gym, exercise) {
  const all = [...INCREMENT_CHOICES, baseIncrement(gym, exercise), effectiveIncrement(gym, exercise)].filter((v) => v > 0);
  return [...new Set(all)].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ the plan at a gym */

/** @param {readonly GymExercise[]} exercises @returns {GymCatalog} */
export function gymCatalog(exercises) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return { exercises, exerciseById: (id) => byId.get(id) };
}

/** @param {GymExercise | undefined} e @returns {readonly string[]} */
const classesOf = (e) => e?.classes ?? (e?.class ? [e.class] : []);

/** Same class, or listed as an alternative of `a`: `b` may stand in for `a` (session.mjs compatible). @param {string} a @param {string} b @param {GymCatalog} catalog */
function compatible(a, b, catalog) {
  if (a === b) return true;
  const ea = catalog.exerciseById(a);
  if (ea?.alternatives?.includes(b)) return true;
  const cb = classesOf(catalog.exerciseById(b));
  return classesOf(ea).some((c) => cb.includes(c));
}

/** Catalog alternatives of an exercise that this gym has, best first (catalog.alternativesFor). @param {string} id @param {Gym | null | undefined} gym @param {GymCatalog} catalog @returns {string[]} */
export function alternativesAt(id, gym, catalog) {
  const ex = catalog.exerciseById(id);
  if (!ex) return [];
  return ex.alternatives.filter((alt) => alt !== id && Boolean(catalog.exerciseById(alt)) && isAvailableAt(gym, alt));
}

/** @param {PlanSlot} slot @param {Gym | null | undefined} gym @param {GymCatalog} catalog */
function resolveDetail(slot, gym, catalog) {
  /** @param {unknown} id @returns {id is string} */
  const fits = (id) => typeof id === "string" && id !== "" && Boolean(catalog.exerciseById(id))
    && isAvailableAt(gym, id) && compatible(slot.exerciseId, id, catalog);
  const prefs = gym?.preferred ?? {};
  const bySlot = hasOwn(prefs, slot.slotId) ? prefs[slot.slotId] : undefined;
  const byExercise = hasOwn(prefs, slot.exerciseId) ? prefs[slot.exerciseId] : undefined;
  const applied = fits(bySlot) ? bySlot : fits(byExercise) ? byExercise : null;
  const stored = idOrNull(bySlot) ?? idOrNull(byExercise);
  const programAvailable = isAvailableAt(gym, slot.exerciseId);
  const exerciseId = applied
    ?? (programAvailable ? slot.exerciseId : (alternativesAt(slot.exerciseId, gym, catalog)[0] ?? slot.exerciseId));
  return { exerciseId, applied, stored, programAvailable };
}

/**
 * The exercise the planner uses for a slot at this gym — the same rule as session.mjs resolveExercise:
 * preferred[slotId] → preferred[exerciseId] (each only when it is here and in the slot exercise's class or
 * alternatives) → the slot's exercise when it is here → its first alternative that is here → the slot's exercise.
 * @param {PlanSlot} slot @param {Gym | null | undefined} gym @param {GymCatalog} catalog @returns {string}
 */
export const resolveSlot = (slot, gym, catalog) => resolveDetail(slot, gym, catalog).exerciseId;

/**
 * Exercises a preference for this slot may name here (exactly those resolveSlot would accept): the slot's exercise
 * when it is here, then its alternatives in catalog order, then other members of its classes.
 * @param {PlanSlot} slot @param {Gym | null | undefined} gym @param {GymCatalog} catalog @returns {string[]}
 */
export function slotChoices(slot, gym, catalog) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} id */
  const add = (id) => {
    if (!out.includes(id) && catalog.exerciseById(id) && isAvailableAt(gym, id) && compatible(slot.exerciseId, id, catalog)) out.push(id);
  };
  add(slot.exerciseId);
  const ex = catalog.exerciseById(slot.exerciseId);
  for (const alt of ex?.alternatives ?? []) add(alt);
  const own = classesOf(ex);
  if (own.length) for (const e of catalog.exercises) if (classesOf(e).some((c) => own.includes(c))) add(e.id);
  return out;
}

/**
 * Every slot of a program (or template days) at a gym: the exercise used, why, and the preference choices.
 * `changed` counts slots that use another exercise here; `stuck` counts slots with nothing available.
 * @param {PlanLike | null | undefined} program @param {Gym | null | undefined} gym @param {GymCatalog} catalog @returns {GymPlan}
 */
export function planAtGym(program, gym, catalog) {
  const days = (program?.days ?? []).map((day) => ({
    key: day.key,
    name: day.name ? { en: day.name.en, ru: day.name.ru } : { en: day.key, ru: day.key },
    slots: day.slots.map((slot) => {
      const { exerciseId, applied, stored, programAvailable } = resolveDetail(slot, gym, catalog);
      /** @type {SlotStatus} */
      const status = applied && applied !== slot.exerciseId
        ? "preferred"
        : exerciseId !== slot.exerciseId ? "swapped" : programAvailable ? "plan" : "stuck";
      /** @type {SlotAtGym} */
      const row = {
        dayKey: day.key,
        slotId: slot.slotId,
        programExerciseId: slot.exerciseId,
        exerciseId,
        status,
        programAvailable,
        preference: applied ?? stored,
        preferenceIgnored: Boolean(stored) && !applied,
        choices: slotChoices(slot, gym, catalog),
      };
      return row;
    }),
  }));
  const all = days.flatMap((d) => d.slots);
  return {
    days,
    changed: all.filter((s) => s.exerciseId !== s.programExerciseId).length,
    stuck: all.filter((s) => s.status === "stuck").length,
  };
}

/**
 * Slots whose exercise differs between two gyms (null = no gym: the program as written).
 * @param {PlanLike | null | undefined} program @param {Gym | null | undefined} gymA @param {Gym | null | undefined} gymB @param {GymCatalog} catalog
 * @returns {PlanChange[]}
 */
export function planDiff(program, gymA, gymB, catalog) {
  /** @type {PlanChange[]} */
  const out = [];
  for (const day of program?.days ?? []) {
    for (const slot of day.slots) {
      const from = resolveSlot(slot, gymA, catalog);
      const to = resolveSlot(slot, gymB, catalog);
      if (from !== to) out.push({ dayKey: day.key, slotId: slot.slotId, programExerciseId: slot.exerciseId, from, to });
    }
  }
  return out;
}

/**
 * Counts for a gym card. @param {Gym} gym @param {PlanLike | null | undefined} program @param {GymCatalog} catalog @returns {GymSummary}
 */
export function gymSummary(gym, program, catalog) {
  const ids = catalog.exercises.map((e) => e.id);
  const marked = new Set(gym.missing);
  const missing = ids.filter((id) => marked.has(id)).length;
  const here = ids.filter((id) => isAvailableAt(gym, id)).length;
  const checklist = isChecklist(gym);
  let changed = 0;
  let stuck = 0;
  for (const day of program?.days ?? []) {
    for (const slot of day.slots) {
      const id = resolveSlot(slot, gym, catalog);
      if (id !== slot.exerciseId) changed += 1;
      else if (!isAvailableAt(gym, id)) stuck += 1;
    }
  }
  return { checklist, here, missing, unknown: checklist ? Math.max(0, ids.length - here - missing) : 0, changed, stuck };
}
