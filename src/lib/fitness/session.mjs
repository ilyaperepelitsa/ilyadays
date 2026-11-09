// @ts-check
/**
 * Session planning and bookkeeping (stream 03, plans/fitness/03-program-engine-and-progression.md): the next day in
 * the rotation, which exercise a slot resolves to at a gym, the planned sets for a day, the 6 h status machine,
 * session summaries, and applying a finished session to the progression memory. Pure: no DOM, no fs.
 *
 * Every function that needs exercise data takes an optional `catalog` ({ exerciseById, alternativesFor,
 * isAvailable }); it defaults to src/lib/fitness/catalog.mjs. Ids the catalog does not know yet get a fallback
 * exercise built from the registry, so planning never crashes on an empty catalog.
 */
import registry from "../../../content/fitness/registry.json" with { type: "json" };
import {
  alternativesFor as catalogAlternativesFor,
  exerciseById as catalogExerciseById,
  isAvailable as catalogIsAvailable,
} from "./catalog.mjs";
import { enforcePlanPreferences, exerciseAllowed } from "./plan-preferences.mjs";
import { effectiveLoad } from "./analytics.mjs";
import { RULES, WARMUP, directGroups, finisherMinutes, slotParams, toIso, toMs, unitOf } from "./templates.mjs";
import {
  convertState, deloadSets, deloadWeek, e1rmOf, firstSessionTestProtocol, gapAdjust, holdActive, holdDay, incrementFor,
  initialState, isAssisted, isCompound, joinText, nextState, substituteState, warmupRamp,
} from "./progression.mjs";

/** @typedef {import("./types").Exercise} Exercise */
/** @typedef {import("./types").ExerciseSlot} ExerciseSlot */
/** @typedef {import("./types").ExerciseState} ExerciseState */
/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").LoggedSet} LoggedSet */
/** @typedef {import("./types").Outcome} Outcome */
/** @typedef {import("./types").PlannedExercise} PlannedExercise */
/** @typedef {import("./types").PlannedSession} PlannedSession */
/** @typedef {import("./types").Program} Program */
/** @typedef {import("./types").ProgramDay} ProgramDay */
/** @typedef {import("./types").Session} Session */
/** @typedef {import("./types").SessionStatus} SessionStatus */
/** @typedef {import("./types").SetPrescription} SetPrescription */
/** @typedef {import("./types").Settings} Settings */
/** @typedef {import("./types").Text2} Text2 */
/**
 * @typedef {object} Catalog
 * @property {(id: string) => Exercise | undefined} exerciseById
 * @property {(id: string, gym?: Gym | null) => string[]} alternativesFor
 * @property {(id: string, gym?: Gym | null) => boolean} isAvailable
 */
/** @typedef {{ exerciseId: string, slotId: string | null, outcome: Outcome, note: Text2 }} SlotOutcome */

/** Hours after which an active session counts as auto-closed (master plan §1, Settings.autoCloseHours). */
export const AUTO_CLOSE_HOURS = 6;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** @type {Record<string, { class: string, classes: string[], slice: string, pattern: string }>} */
const REGISTRY_EXERCISES = /** @type {any} */ (registry.exercises);

/** @type {Catalog} */
export const DEFAULT_CATALOG = {
  exerciseById: catalogExerciseById,
  alternativesFor: catalogAlternativesFor,
  isAvailable: catalogIsAvailable,
};

/**
 * A catalog over a list of exercises with the same semantics as catalog.mjs (tests, previews, other datasets).
 * @param {Exercise[]} exercises @returns {Catalog}
 */
export function catalogFrom(exercises) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  /** @param {string} id @param {Gym | null | undefined} [gym] */
  const isAvailable = (id, gym) => {
    if (!gym) return true;
    if (gym.missing?.includes(id)) return false;
    return gym.available.length === 0 || gym.available.includes(id);
  };
  return {
    exerciseById: (id) => byId.get(id),
    alternativesFor: (id, gym) => {
      const ex = byId.get(id);
      if (!ex) return [];
      return ex.alternatives.filter((alt) => alt !== id && byId.has(alt) && isAvailable(alt, gym));
    },
    isAvailable,
  };
}

/* ------------------------------------------------------------------ fallback exercise (catalog not merged yet) */

/** @type {[RegExp, Exercise["equipment"], number][]} */
const EQUIPMENT_GUESS = [
  [/^assisted-/, "assisted", 5],
  [/band/, "band", 0],
  [/smith/, "smith", 2.5],
  [/kettlebell/, "kettlebell", 4],
  [/dumbbell|hammer-curl|carry|goblet/, "dumbbell", 2],
  [/barbell|trap-bar|deadlift|skull-crusher|close-grip|ez-bar|landmine/, "barbell", 2.5],
  [/^(push-up|diamond-push-up|pull-up|chin-up|dip|plank|side-plank|dead-bug|bird-dog|dead-hang|inverted-row|nordic-hamstring-curl|reverse-crunch|hanging-leg-raise|captains-chair-knee-raise|decline-sit-up|bicycle-crunch|mcgill-curl-up|back-extension-45|copenhagen-adduction|neck-isometrics|ab-wheel-rollout|bulgarian-split-squat)$/, "bodyweight", 0],
  [/plate-loaded|t-bar|leg-press|hack-squat|v-squat|belt-squat/, "plate-loaded", 2.5],
  [/cable|pulldown|face-pull|pallof|pushdown|woodchop|pull-through/, "cable", 2.5],
];

/**
 * Minimal Exercise for an id the catalog does not know yet (registry pattern/class, guessed equipment).
 * @param {string} id @param {ExerciseSlot} [slot] @returns {Exercise}
 */
export function fallbackExercise(id, slot) {
  const reg = REGISTRY_EXERCISES[id];
  const hit = EQUIPMENT_GUESS.find(([re]) => re.test(id));
  /** @type {Exercise} */
  const ex = {
    id,
    name: { en: id, ru: id },
    equipment: hit ? hit[1] : "selectorized",
    pattern: /** @type {Exercise["pattern"]} */ (reg?.pattern ?? "horizontal-push"),
    primary: [],
    secondary: [],
    difficulty: 1,
    unilateral: false,
    supported: true,
    increment: hit ? hit[2] : 5,
    repRange: slot ? [slot.repRange[0], slot.repRange[1]] : [8, 12],
    class: reg?.class,
    alternatives: [],
    cues: { en: [], ru: [] },
    mistakes: { en: [], ru: [] },
  };
  if (/carry/.test(id)) ex.repUnit = "meters";
  else if (/plank|dead-hang|isometric/.test(id)) ex.repUnit = "seconds";
  if (ex.equipment === "assisted") ex.assistance = true;
  return ex;
}

/** @param {Catalog} catalog @param {string} id @param {ExerciseSlot} [slot] */
const lookup = (catalog, id, slot) => catalog.exerciseById(id) ?? fallbackExercise(id, slot);

/* ------------------------------------------------------------------ status and rotation */

/**
 * Effective status: an active session started ≥ 6 h ago is auto-closed (the server RPC does the same with
 * ended_at = started_at + 6 h). @param {Session} session @param {Date | string | number} [now] @param {number} [hours]
 * @returns {SessionStatus}
 */
export function sessionStatus(session, now, hours = AUTO_CLOSE_HOURS) {
  if (session.status !== "active") return session.status;
  const started = Date.parse(session.startedAt);
  if (Number.isNaN(started)) return "active";
  return toMs(now) - started >= hours * HOUR_MS ? "auto_closed" : "active";
}

/** @param {Record<string, Session> | Session[] | null | undefined} sessions @returns {Session[]} */
const sessionList = (sessions) => (Array.isArray(sessions) ? sessions : Object.values(sessions ?? {}));

/**
 * Next day in the sequential rotation (A → B → C → A) after the most recent finished or auto-closed session of any
 * program version; the first day when there is none, or when that day key is not in this program.
 * @param {Program} program @param {Record<string, Session> | Session[] | null | undefined} sessions
 * @param {Date | string | number} [now] @returns {string}
 */
export function nextDayKey(program, sessions, now) {
  const days = program.days;
  if (!days.length) return "";
  const done = sessionList(sessions).filter((s) => {
    const st = sessionStatus(s, now);
    return st === "finished" || st === "auto_closed";
  });
  if (!done.length) return days[0].key;
  done.sort((a, b) => toMs(b.startedAt) - toMs(a.startedAt) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const i = days.findIndex((d) => d.key === done[0].dayKey);
  return i < 0 ? days[0].key : days[(i + 1) % days.length].key;
}

/* ------------------------------------------------------------------ exercise resolution */

/** Same registry class, or listed as an alternative: safe to stand in for the slot's exercise. @param {string} a @param {string} b @param {Catalog} catalog */
function compatible(a, b, catalog) {
  if (a === b) return true;
  if (catalog.exerciseById(a)?.alternatives?.includes(b)) return true;
  const ca = REGISTRY_EXERCISES[a]?.classes ?? [];
  const cb = REGISTRY_EXERCISES[b]?.classes ?? [];
  return ca.some((c) => cb.includes(c));
}

/**
 * The exercise a slot uses at a gym: gym.preferred[slotId] → gym.preferred[exerciseId] → the slot's exercise if
 * available → the first available alternative → the slot's exercise. A preference only applies when that exercise
 * is available and is in the slot exercise's class or alternatives (a stale preference from another template is
 * ignored). @param {ExerciseSlot} slot @param {Gym | null | undefined} gym @param {Catalog} [catalog] @param {Program} [program] @returns {string}
 */
export function resolveExercise(slot, gym, catalog = DEFAULT_CATALOG, program) {
  /** @param {string | undefined} id */
  const fits = (id) => Boolean(id)
    && Boolean(catalog.exerciseById(/** @type {string} */ (id)) || REGISTRY_EXERCISES[/** @type {string} */ (id)])
    && catalog.isAvailable(/** @type {string} */ (id), gym)
    && (!program || exerciseAllowed(program, catalog.exerciseById(/** @type {string} */ (id))))
    && compatible(slot.exerciseId, /** @type {string} */ (id), catalog);
  const prefs = gym?.preferred ?? {};
  if (fits(prefs[slot.slotId])) return prefs[slot.slotId];
  if (fits(prefs[slot.exerciseId])) return prefs[slot.exerciseId];
  if (catalog.isAvailable(slot.exerciseId, gym)) return slot.exerciseId;
  return catalog.alternativesFor(slot.exerciseId, gym).find((id) => !program || exerciseAllowed(program, catalog.exerciseById(id))) ?? slot.exerciseId;
}

/* ------------------------------------------------------------------ planning */

/** @param {[number, number]} a @param {[number, number]} b */
const sameRange = (a, b) => a[0] === b[0] && a[1] === b[1];

/**
 * The state the planner starts from for a slot: own state → substitute seeded from the slot exercise's state → new.
 * Ranges/RIR are converted when the slot changed (goal switch; the first session runs 5 % lighter, one rounding),
 * gaps are applied.
 * @param {{ slot: ExerciseSlot, exercise: Exercise, programExercise: Exercise, range: [number, number], states: Record<string, ExerciseState>, gym: Gym | null, bodyweightKg: number | null, goal: Program["goal"], now: Date | string | number | undefined, at: number }} p
 */
function startingState({ slot, exercise, programExercise, range, states, gym, bodyweightKg, goal, now, at }) {
  /** @type {Text2[]} */
  const notes = [];
  const rir = slot.rir;
  let state = states[exercise.id];
  if (!state) {
    const from = exercise.id !== slot.exerciseId ? states[slot.exerciseId] : undefined;
    state = from && unitOf(exercise) === unitOf(programExercise)
      ? substituteState(from, programExercise, exercise, { bodyweightKg, goal, now, gym, repRange: range, rir })
      : initialState(exercise, { bodyweightKg, goal, now, repRange: range, rir, gym });
  }
  if (!sameRange(state.repRange, range) || state.rir !== rir) {
    state = convertState(state, state.repRange, range, { rir, exercise, gym, bodyweightKg, now, factor: RULES.conversion.firstSessionFactor });
  }
  let gap = false;
  let gapReset = false;
  if (state.lastAt) {
    const days = (at - toMs(state.lastAt)) / DAY_MS;
    const g = gapAdjust(state, days, now, { exercise, gym, bodyweightKg });
    if (g.outcome && g.note) {
      state = g.state;
      notes.push(g.note);
      gap = true;
      gapReset = g.outcome === "reset";
    }
  }
  return { state, notes, gap, gapReset };
}

/** @param {PlannedExercise[]} exercises @param {ProgramDay} day @param {Catalog} catalog */
function plannedMinutes(exercises, day, catalog) {
  let sec = WARMUP.minutes * 60;
  for (const p of exercises) {
    const unit = unitOf(catalog.exerciseById(p.exerciseId));
    const working = p.sets.filter((s) => s.kind !== "warmup");
    const warm = p.sets.length - working.length;
    const reps = working[0]?.reps ?? 10;
    const setSec = unit === "reps" ? RULES.minutes.setSec : unit === "meters" ? reps * 1.2 + 20 : reps + 15;
    sec += warm * RULES.minutes.rampSetSec + working.length * setSec + Math.max(0, working.length - 1) * p.restSec + RULES.minutes.transitionSec;
  }
  sec += finisherMinutes(day.finisher) * 60;
  return Math.round(sec / 60);
}

/** Effective kg for comparing load steps across variants (the 80 kg reference when no body weight is known). @param {number} kg @param {Exercise} e @param {number | null} bw */
function effectiveOf(kg, e, bw) {
  const b = bw && bw > 0 ? bw : RULES.bodyweightRefKg;
  if (isAssisted(e)) return Math.max(0, b - kg);
  return e.equipment === "bodyweight" ? b + kg : kg;
}
/** Harder variants: bodyweight first, then loaded, then assisted and bands. @param {Exercise} e */
const familyRank = (e) => (e.equipment === "bodyweight" ? 0 : isAssisted(e) || e.equipment === "band" ? 2 : 1);

/**
 * The exercise to suggest for a state flagged at the top of its range (`ExerciseState.variant`, master plan §16
 * rule 2), or null: "harder" → the easiest exercise that is harder than this one (catalog difficulty), registry
 * class-mates first, bodyweight before loaded before assisted; "smaller-steps" → the one whose load step is the
 * smallest fraction of its seeded working load (substituteState, the equipment ratios), when smaller than this one's.
 * Candidates: the alternatives of the exercise and of the slot's exercise and the registry class-mates, available at
 * this gym and counted in the same unit.
 * @param {ExerciseState} state @param {Exercise} exercise @param {Exercise} programExercise
 * @param {{ gym: Gym | null, catalog: Catalog, bodyweightKg: number | null, goal: Program["goal"], now: Date | string | number | undefined, range: [number, number], rir: number }} p
 * @returns {string | null}
 */
export function suggestVariant(state, exercise, programExercise, { gym, catalog, bodyweightKg, goal, now, range, rir }) {
  const unit = unitOf(exercise);
  const classes = new Set(REGISTRY_EXERCISES[exercise.id]?.classes ?? []);
  /** @param {string} id */
  const mate = (id) => (REGISTRY_EXERCISES[id]?.classes ?? []).some((c) => classes.has(c));
  const ids = new Set([...catalog.alternativesFor(exercise.id, gym), ...catalog.alternativesFor(programExercise.id, gym), programExercise.id]);
  for (const id of Object.keys(REGISTRY_EXERCISES)) if (mate(id)) ids.add(id);
  ids.delete(exercise.id);
  /** @type {Exercise[]} */
  const pool = [];
  for (const id of ids) {
    const e = catalog.exerciseById(id);
    if (e && catalog.isAvailable(id, gym) && unitOf(e) === unit) pool.push(e);
  }
  if (state.variant === "harder") {
    const level = exercise.difficulty ?? 1;
    const up = pool.filter((e) => (e.difficulty ?? 1) > level);
    up.sort((a, b) => Number(mate(b.id)) - Number(mate(a.id)) || familyRank(a) - familyRank(b)
      || (a.difficulty ?? 1) - (b.difficulty ?? 1) || a.id.localeCompare(b.id));
    return up[0]?.id ?? null;
  }
  if (state.variant !== "smaller-steps") return null;
  /** @param {Exercise} e @param {number} kg */
  const stepOf = (e, kg) => {
    const inc = incrementFor(e, gym);
    const eff = effectiveOf(kg, e, bodyweightKg);
    return inc > 0 && eff > 0 ? inc / eff : Number.POSITIVE_INFINITY;
  };
  let bestId = null;
  let best = stepOf(exercise, state.workingKg);
  for (const e of pool) {
    const seeded = substituteState(state, exercise, e, { bodyweightKg, goal, now, gym, repRange: range, rir });
    const s = stepOf(e, seeded.workingKg);
    if (s < best - 1e-9) {
      best = s;
      bestId = e.id;
    }
  }
  return bestId;
}

/** @param {string} until */
const holdOverLine = (until) => ({
  en: `The weight hold ended (${holdDay(until, "en")}): hit the target on every set and the weight can go up again.`,
  ru: `Фиксация веса закончилась (${holdDay(until, "ru")}): выполните цель во всех подходах, и вес снова может расти.`,
});
/** @param {string} until */
const holdLine = (until) => {
  const ru = holdDay(until, "ru");
  return { en: `Weight held until ${holdDay(until, "en")}.`, ru: `Вес зафиксирован до ${ru.endsWith(".") ? ru : `${ru}.`}` };
};

/**
 * Plan one session: for each slot of the day, the exercise at this gym, its warm-ups (compounds) and working sets
 * from the progression memory (or a first-session test start), the alternatives this gym has, and a note.
 * A deload week (`deload`, default: the program calendar) prescribes 40 % fewer sets at the same load with 2 more
 * reps in reserve, except for exercises coming back from a ≥ 14-day break (the break already unloaded them).
 * @param {{ program: Program, dayKey?: string, states?: Record<string, ExerciseState> | null, gym?: Gym | null, settings?: Settings | null, now?: Date | string | number, catalog?: Catalog, deload?: boolean }} p
 * @returns {PlannedSession}
 */
export function planSession({ program, dayKey, states, gym = null, settings = null, now, catalog, deload }) {
  const cat = catalog ?? DEFAULT_CATALOG;
  program = enforcePlanPreferences(program, cat);
  const day = program.days.find((d) => d.key === dayKey) ?? program.days[0];
  if (!day) return { dayKey: dayKey ?? "", dayName: { en: "", ru: "" }, exercises: [], estimatedMinutes: 0, warmup: WARMUP.general };
  const at = toMs(now);
  const bodyweightKg = settings?.bodyweightKg ?? null;
  const isDeload = deload ?? deloadWeek(program, at).due;
  const stateMap = states ?? {};
  const uStepOf = (/** @type {Exercise} */ e) => RULES.unitStep[unitOf(e)] ?? 1;
  /** groups already warmed by an earlier compound today: their ramp shrinks to one set */
  /** @type {Set<string>} */
  const warmed = new Set();

  /** @type {PlannedExercise[]} */
  const exercises = day.slots.map((slot) => {
    const exerciseId = resolveExercise(slot, gym, cat, program);
    const exercise = lookup(cat, exerciseId, slot);
    const programExercise = lookup(cat, slot.exerciseId, slot);
    const unitChanged = unitOf(exercise) !== unitOf(programExercise);
    /** @type {[number, number]} */
    const range = unitChanged ? [exercise.repRange[0], exercise.repRange[1]] : [slot.repRange[0], slot.repRange[1]];
    const { state, notes, gap, gapReset } = startingState({
      slot, exercise, programExercise, range, states: stateMap, gym, bodyweightKg, goal: program.goal, now, at,
    });
    const workingKg = state.workingKg;
    // a break already unloaded this exercise, and a first session is its test: no planned deload on top of either
    const deloadThis = isDeload && !gap && (state.sessions ?? 0) > 0;
    let sets = slot.sets;
    let reps = state.targetReps;
    let rir = slot.rir;
    if (deloadThis) {
      sets = deloadSets(sets);
      reps = Math.max(uStepOf(exercise), reps - RULES.deload.repsMinus * uStepOf(exercise));
      rir = Math.min(5, rir + RULES.deload.rirBonus);
    }
    let ramp = isCompound(exercise)
      ? warmupRamp(workingKg, exercise, state.e1rm, { gym, bodyweightKg, targetReps: reps, rir })
      : [];
    if (isCompound(exercise)) {
      const direct = directGroups(exerciseId, cat);
      if (ramp.length > 1 && direct.length > 0 && direct.every((g) => warmed.has(g))) ramp = ramp.slice(-1);
      direct.forEach((g) => warmed.add(g));
    }
    /** @type {SetPrescription[]} */
    const prescription = [
      ...ramp,
      ...Array.from({ length: sets }, () => /** @type {SetPrescription} */ ({ kind: "working", weightKg: workingKg, reps, rir })),
    ];
    const alternatives = cat.alternativesFor(slot.exerciseId, gym).filter((a) => a !== exerciseId && exerciseAllowed(program, cat.exerciseById(a)));
    if (exerciseId !== slot.exerciseId && cat.exerciseById(slot.exerciseId) && cat.isAvailable(slot.exerciseId, gym)) alternatives.unshift(slot.exerciseId);
    // stuck at the top of the range (rule 2): the variant to move to goes first, and the note names it
    const candidateVariant = state.variant
      ? suggestVariant(state, exercise, programExercise, { gym, catalog: cat, bodyweightKg, goal: program.goal, now, range, rir: slot.rir })
      : null;
    const variantId = candidateVariant && exerciseAllowed(program, cat.exerciseById(candidateVariant)) ? candidateVariant : null;
    const variantEx = variantId ? cat.exerciseById(variantId) : undefined;
    if (variantId) {
      const i = alternatives.indexOf(variantId);
      if (i >= 0) alternatives.splice(i, 1);
      alternatives.unshift(variantId);
    }
    /** @type {Text2[]} */
    const parts = [];
    if (deloadThis) parts.push({ en: "Deload week: fewer sets, same weight, more in reserve.", ru: "Разгрузочная неделя: меньше подходов, тот же вес, больше запас." });
    parts.push(...notes);
    // the state's own note: the test protocol (new), the swap note (seeded substitute), the conversion or the last
    // outcome; after a long break the test protocol again
    // a hold whose date has passed (cleared by the next session): the engine's "held until" note would be stale
    const passed = typeof state.holdUntil === "string" && !holdActive(state, at) ? state.holdUntil : null;
    const stale = Boolean(passed && state.note && (state.note.en.includes(holdDay(passed, "en")) || state.note.ru.includes(holdDay(passed, "ru"))));
    if (gapReset) parts.push(firstSessionTestProtocol(exercise, { repRange: range, gym }));
    else if (!notes.length && state.note) parts.push(stale && passed ? holdOverLine(passed) : state.note);
    // a weight hold still ahead (master plan §16): said once — the engine's note may already name its date
    const hold = holdActive(state, at) ? /** @type {string} */ (state.holdUntil) : null;
    if (hold && !parts.some((p) => p.en.includes(holdDay(hold, "en")) || p.ru.includes(holdDay(hold, "ru")))) parts.splice(deloadThis ? 1 : 0, 0, holdLine(hold));
    if (variantEx) {
      const n = variantEx.name;
      parts.push(state.variant === "harder"
        ? { en: `Harder variant: ${n.en}.`, ru: `Сложнее: ${n.ru || n.en}.` }
        : { en: `Smaller steps: ${n.en}.`, ru: `Меньше шаг: ${n.ru || n.en}.` });
    }
    /** @type {PlannedExercise} */
    const planned = {
      slotId: slot.slotId,
      exerciseId,
      programExerciseId: slot.exerciseId,
      sets: prescription,
      calibration: state.baseline?.status === "learning" || state.sessions === 0 || gapReset,
      repRange: range,
      loadStep: incrementFor(exercise, gym),
      restSec: slot.restSec,
      alternatives,
    };
    if (slot.superset) planned.superset = slot.superset;
    const note = joinText(parts);
    if (note) planned.note = note;
    return planned;
  });

  /** @type {PlannedSession} */
  const session = {
    dayKey: day.key,
    dayName: { en: day.name.en, ru: day.name.ru },
    exercises,
    estimatedMinutes: plannedMinutes(exercises, day, cat),
    warmup: { en: WARMUP.general.en, ru: WARMUP.general.ru },
  };
  if (day.finisher) session.finisher = { en: day.finisher.en, ru: day.finisher.ru };
  return session;
}

/* ------------------------------------------------------------------ summaries */

/** @param {LoggedSet[] | Record<string, LoggedSet> | null | undefined} sets @param {string} sessionId */
function setsOf(sets, sessionId) {
  const list = Array.isArray(sets) ? sets : Object.values(sets ?? {});
  return list
    .filter((s) => s.sessionId === sessionId)
    .sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? "") || (a.setIndex ?? 0) - (b.setIndex ?? 0));
}

/**
 * Summary of one session: per performed exercise (first-appearance order) its working-set count, top set and best
 * reliable e1RM — on analytics.effectiveLoad, the load the progress charts and the PR lines use (push-ups ≈ 64 % of
 * the body weight, no e1RM where the share of body weight is unknown); tonnage (kg × reps over non-warm-up rep sets,
 * assistance excluded); hard sets (non-warm-up, RIR ≤ 4 or unknown); minutes from start to the end (or the last set).
 * @param {Session} session @param {LoggedSet[] | Record<string, LoggedSet>} sets @param {Catalog} [catalog]
 * @returns {{ perExercise: { exerciseId: string, sets: number, topSet: { kg: number, reps: number, rir: number | null } | null, e1rm: number }[], tonnage: number, hardSets: number, minutes: number }}
 */
export function summarize(session, sets, catalog = DEFAULT_CATALOG) {
  const all = setsOf(sets, session.id);
  const work = all.filter((s) => s.kind !== "warmup");
  /** @type {Map<string, LoggedSet[]>} */
  const groups = new Map();
  for (const s of work) {
    const g = groups.get(s.exerciseId);
    if (g) g.push(s);
    else groups.set(s.exerciseId, [s]);
  }
  const bw = session.bodyweightKg ?? null;
  let tonnage = 0;
  const perExercise = [...groups.entries()].map(([exerciseId, list]) => {
    const ex = lookup(catalog, exerciseId);
    const unit = unitOf(ex);
    const assisted = isAssisted(ex);
    let top = list[0];
    for (const s of list) {
      const better = unit !== "reps"
        ? s.reps > top.reps || (s.reps === top.reps && s.kg > top.kg)
        : assisted
          ? s.kg < top.kg || (s.kg === top.kg && s.reps > top.reps)
          : s.kg > top.kg || (s.kg === top.kg && s.reps > top.reps);
      if (better) top = s;
    }
    let best = 0;
    if (unit === "reps") {
      for (const s of list) {
        if (!(s.reps >= 1)) continue;
        if (!assisted && s.kg > 0) tonnage += s.kg * s.reps;
        const eff = effectiveLoad(s, ex, bw).kg;
        if (!(eff > 0)) continue;
        const e = e1rmOf(eff, s.reps, s.rir);
        if (e.reliable && e.kg > best) best = e.kg;
      }
    }
    return { exerciseId, sets: list.length, topSet: top ? { kg: top.kg, reps: top.reps, rir: top.rir } : null, e1rm: best };
  });
  const hardSets = work.filter((s) => s.rir == null || s.rir <= 4).length;
  const last = all.map((s) => s.doneAt).filter(Boolean).sort().pop();
  const endIso = session.status === "finished" && session.endedAt ? session.endedAt : (last ?? session.endedAt ?? session.startedAt);
  const minutes = Math.max(0, Math.round((toMs(endIso) - toMs(session.startedAt)) / 60000));
  return { perExercise, tonnage: Math.round(tonnage * 10) / 10, hardSets, minutes };
}

/* ------------------------------------------------------------------ applying a session */

/** @param {Program} program @param {string} slotId @param {string} [dayKey] */
function findSlot(program, slotId, dayKey) {
  const preferred = program.days.find((d) => d.key === dayKey);
  return preferred?.slots.find((s) => s.slotId === slotId)
    ?? program.days.flatMap((d) => d.slots).find((s) => s.slotId === slotId);
}

/**
 * Feed a session's logged sets into the progression memory. Working/AMRAP/back-off sets are grouped by the
 * performed exercise (warm-ups ignored) and run through nextState with the slot's parameters; a substitute gets its
 * own state (seeded from the slot exercise's). Slots of the day with no sets (or only warm-ups) keep their state, with
 * a note. Re-applying the same session is a no-op for exercises already counted. In a deload week (default: the
 * program calendar at the session start) nothing progresses; a weight hold whose date has passed is still cleared, as
 * nextState clears it, and so is one on a slot left out (judged at the session start). The first session after a
 * ≥ 14-day break or a goal switch runs as a calibration: the best set re-anchors the load and misses do not count. An
 * exercise with fewer working sets logged than planned holds (master plan §16 rule 4): `plannedSets` maps a PERFORMED
 * exercise id to the working sets the screen planned for it; without an entry, the sets of the slots it was logged
 * under.
 * @param {{ program: Program, session: Session, sets: LoggedSet[] | Record<string, LoggedSet>, states?: Record<string, ExerciseState> | null, catalog?: Catalog, now?: Date | string | number, settings?: Settings | null, gym?: Gym | null, deload?: boolean, plannedSets?: Record<string, number>, prescription?: PlannedSession }} p
 * @returns {{ states: Record<string, ExerciseState>, changed: ExerciseState[], outcomes: SlotOutcome[] }}
 */
export function applySession({ program, session, sets, states, catalog, now, settings = null, gym = null, deload, plannedSets, prescription }) {
  program = session.plan?.program ?? program;
  gym = session.plan ? session.plan.gym : gym;
  const cat = catalog ?? DEFAULT_CATALOG;
  const updatedAt = toIso(now);
  const prevStates = states ?? {};
  /** @type {Record<string, ExerciseState>} */
  const next = { ...prevStates };
  /** @type {ExerciseState[]} */
  const changed = [];
  /** @type {SlotOutcome[]} */
  const outcomes = [];
  const bodyweightKg = session.plan ? session.bodyweightKg ?? null : session.bodyweightKg ?? settings?.bodyweightKg ?? null;
  const start = toMs(session.startedAt);
  const isDeload = deload ?? deloadWeek(program, start).due;
  const work = setsOf(sets, session.id).filter((s) => s.kind !== "warmup");

  /** @type {Map<string, { sets: LoggedSet[], slotId: string | null }>} */
  const groups = new Map();
  for (const s of work) {
    const g = groups.get(s.exerciseId);
    if (g) g.sets.push(s);
    else groups.set(s.exerciseId, { sets: [s], slotId: s.slotId ?? null });
  }

  for (const [exerciseId, group] of groups) {
    const slot = group.slotId ? findSlot(program, group.slotId, session.dayKey) : undefined;
    const exercise = lookup(cat, exerciseId, slot);
    const programExercise = slot ? lookup(cat, slot.exerciseId, slot) : exercise;
    let params = slot
      ? slotParams(program, slot)
      : { ...program.progression.double, repRange: /** @type {[number, number]} */ ([exercise.repRange[0], exercise.repRange[1]]) };
    if (slot && unitOf(exercise) !== unitOf(programExercise)) params = { ...params, repRange: [exercise.repRange[0], exercise.repRange[1]] };
    let prev = prevStates[exerciseId];
    if (prev?.lastAt && toMs(prev.lastAt) >= start) {
      outcomes.push({
        exerciseId,
        slotId: group.slotId,
        outcome: prev.lastOutcome,
        note: prev.note ?? { en: "Already counted.", ru: "Уже учтено." },
      });
      continue;
    }
    const live = prev;
    prev = session.plan ? session.plan.states[exerciseId] : prev;
    // An explicit hold set/cleared during the workout remains the owner's latest instruction.
    if (prev && live && "holdUntil" in live) prev = { ...prev, holdUntil: live.holdUntil };
    if (!prev) {
      const from = slot && exerciseId !== slot.exerciseId ? prevStates[slot.exerciseId] : undefined;
      prev = from && unitOf(exercise) === unitOf(programExercise)
        ? substituteState(from, programExercise, exercise, { bodyweightKg, goal: program.goal, now, gym, repRange: params.repRange, rir: params.rir })
        : initialState(exercise, { bodyweightKg, goal: program.goal, now, repRange: params.repRange, rir: params.rir, gym });
    }
    let converted = false;
    if (!sameRange(prev.repRange, params.repRange) || prev.rir !== params.rir) {
      prev = convertState(prev, prev.repRange, params.repRange, { rir: params.rir, exercise, gym, bodyweightKg, now });
      converted = true;
    }
    const gapDays = prev.lastAt ? (start - toMs(prev.lastAt)) / DAY_MS : 0;
    const gap = gapDays >= RULES.gap.keepBelowDays;
    // judge the session against what planSession prescribed after the break (the reduced load; after ≥ 28 days the
    // bottom of the range), not against the numbers from before it
    if (gap) prev = gapAdjust(prev, gapDays, now, { exercise, gym, bodyweightKg }).state;
    const times = group.sets.map((s) => s.doneAt).filter(Boolean).sort();
    const lastSet = times[times.length - 1];
    const at = lastSet && toMs(lastSet) >= start ? lastSet : toIso(start);
    if (isDeload && !gap && (prev.sessions ?? 0) > 0) {
      /** @type {Text2} */
      const note = { en: "Deload week: no progression change — same targets next week.", ru: "Разгрузочная неделя: прогрессия на паузе — те же цели на следующей неделе." };
      /** @type {ExerciseState} */
      const state = { ...prev, sessions: (prev.sessions ?? 0) + 1, lastAt: at, note, updatedAt };
      // a weight hold that has passed is cleared, as nextState clears it
      if (prev.holdUntil != null && !holdActive(prev, at)) state.holdUntil = null;
      next[exerciseId] = state;
      changed.push(state);
      outcomes.push({ exerciseId, slotId: group.slotId, outcome: "held", note });
      continue;
    }
    // rule 4: the working sets planned for this exercise — the screen's count, else what its slots prescribed
    const slotIds = [...new Set(group.sets.map((s) => s.slotId).filter(/** @returns {id is string} */ (id) => typeof id === "string" && id !== ""))];
    const prescribed = slotIds.reduce((n, id) => n + (findSlot(program, id, session.dayKey)?.sets ?? 0), 0);
    let planned = plannedSets?.[exerciseId] ?? prescribed;
    // With a frozen plan, added/backoff sets cannot conceal a skipped prescribed row.
    const expectedPlan = prescription ?? session.plan?.prescription;
    if (expectedPlan) {
      let frozen = expectedPlan.exercises.filter((p) => p.exerciseId === exerciseId);
      // A direct engine caller without an effective swap prescription gets the original slot as a conservative fallback.
      if (!frozen.length) frozen = expectedPlan.exercises.filter((p) => slotIds.includes(p.slotId));
      const expected = frozen.flatMap((p) => p.sets.flatMap((s, index) => s.kind === "warmup" ? [] : [{ slotId: p.slotId, index }]));
      const matched = expected.filter((r) => group.sets.some((s) => s.slotId === r.slotId && s.setIndex === r.index && (s.kind === "working" || s.kind === "amrap"))).length;
      if (!expected.length || matched < expected.length) planned = Math.max(planned, group.sets.length + 1);
    }
    // after a break or a goal switch the first session re-anchors the load, and misses do not count
    const r = nextState(prev, group.sets, params, exercise, now, { bodyweightKg, gym, calibration: gap || converted, at, plannedSets: planned > 0 ? planned : null });
    next[exerciseId] = r.state;
    changed.push(r.state);
    outcomes.push({ exerciseId, slotId: group.slotId, outcome: r.outcome, note: r.note });
  }

  const day = program.days.find((d) => d.key === session.dayKey);
  for (const slot of day?.slots ?? []) {
    if (work.some((s) => s.slotId === slot.slotId)) continue;
    /** @type {Text2} */
    const note = { en: "Skipped last time: targets unchanged.", ru: "В прошлый раз пропущено: цели без изменений." };
    outcomes.push({ exerciseId: slot.exerciseId, slotId: slot.slotId, outcome: "held", note });
    const kept = prevStates[slot.exerciseId];
    if (!kept || changed.some((s) => s.exerciseId === slot.exerciseId)) continue;
    // keep the numbers and the last advice, and mark the skip once (re-applying changes nothing). A weight hold whose
    // date has passed by the session start is cleared, as nextState clears it for a log with no working sets (a slot
    // with warm-ups only lands here too); advice that still names it gives way to the line planSession shows for it
    const passed = kept.holdUntil != null && !holdActive(kept, start) ? kept.holdUntil : null;
    const marked = Boolean(kept.note?.en.startsWith(note.en));
    if (marked && passed == null) continue;
    const stale = passed != null && kept.note != null && (kept.note.en.includes(holdDay(passed, "en")) || kept.note.ru.includes(holdDay(passed, "ru")));
    const advice = stale ? holdOverLine(passed) : marked ? null : kept.note;
    /** @type {ExerciseState} */
    const state = { ...kept, note: marked && !stale ? kept.note : (joinText(advice ? [note, advice] : [note]) ?? note), updatedAt };
    if (passed != null) state.holdUntil = null;
    next[slot.exerciseId] = state;
    changed.push(state);
  }
  return { states: next, changed, outcomes };
}
