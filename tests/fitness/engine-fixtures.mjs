// Stream 03 — fixture exercises for the engine tests (templates, progression, session). Not a test file.
// Built from content/fitness/registry.json (pattern, class) with hand-set equipment, increments, ranges and
// start loads that mirror the catalog slices, so the tests do not depend on content/fitness/exercises.json.
import registry from '../../content/fitness/registry.json' with { type: 'json' };
import { catalogFrom } from '../../src/lib/fitness/session.mjs';

/**
 * @param {string} id
 * @param {Partial<import('../../src/lib/fitness/types').Exercise>} [o]
 * @returns {import('../../src/lib/fitness/types').Exercise}
 */
export function fx(id, o = {}) {
  const reg = registry.exercises[id];
  if (!reg) throw new Error(`fixture id ${id} is not in the registry`);
  return {
    id,
    name: { en: id, ru: id },
    equipment: 'selectorized',
    pattern: /** @type {any} */ (reg.pattern),
    class: reg.class,
    primary: [],
    secondary: [],
    difficulty: 1,
    unilateral: false,
    supported: true,
    increment: 5,
    repRange: [8, 12],
    alternatives: [],
    cues: { en: [], ru: [] },
    mistakes: { en: [], ru: [] },
    ...o,
  };
}

export const FIXTURES = [
  fx('machine-chest-press', { primary: ['pec-sternal'], secondary: ['pec-clavicular', 'delt-front', 'triceps-lateral'], repRange: [6, 12], startLoad: { kg: 25, source: 'fixture' }, alternatives: ['converging-chest-press', 'plate-loaded-chest-press', 'smith-bench-press', 'dumbbell-bench-press', 'barbell-bench-press', 'push-up'] }),
  fx('converging-chest-press', { primary: ['pec-sternal'], secondary: ['delt-front', 'triceps-lateral'], repRange: [6, 12], startLoad: { kg: 25, source: 'fixture' }, alternatives: ['machine-chest-press', 'plate-loaded-chest-press', 'dumbbell-bench-press'] }),
  fx('plate-loaded-chest-press', { equipment: 'plate-loaded', increment: 2.5, primary: ['pec-sternal'], secondary: ['delt-front', 'triceps-lateral'], repRange: [6, 12], startLoad: { kg: 20, source: 'fixture' }, alternatives: ['machine-chest-press', 'converging-chest-press'] }),
  fx('smith-bench-press', { equipment: 'smith', increment: 2.5, primary: ['pec-sternal'], secondary: ['delt-front', 'triceps-lateral'], repRange: [5, 10], alternatives: ['barbell-bench-press', 'machine-chest-press'] }),
  fx('dumbbell-bench-press', { equipment: 'dumbbell', increment: 2, primary: ['pec-sternal'], secondary: ['delt-front', 'triceps-lateral'], repRange: [6, 12], startLoad: { kg: 12, source: 'fixture' }, alternatives: ['machine-chest-press', 'barbell-bench-press'] }),
  fx('barbell-bench-press', { equipment: 'barbell', increment: 2.5, primary: ['pec-sternal'], secondary: ['delt-front', 'triceps-lateral'], repRange: [4, 8], startLoad: { kg: 40, source: 'fixture' }, alternatives: ['smith-bench-press', 'dumbbell-bench-press', 'machine-chest-press'] }),
  fx('push-up', { equipment: 'bodyweight', increment: 0, primary: ['pec-sternal'], secondary: ['triceps-lateral', 'delt-front'], repRange: [8, 20], alternatives: ['machine-chest-press', 'dumbbell-bench-press'] }),
  fx('lat-pulldown', { primary: ['lats', 'teres-major'], secondary: ['biceps', 'rhomboids'], repRange: [6, 12], startLoad: { kg: 30, source: 'fixture' }, alternatives: ['assisted-pull-up', 'neutral-grip-pulldown', 'vertical-traction'] }),
  fx('neutral-grip-pulldown', { primary: ['lats'], secondary: ['biceps', 'brachialis'], repRange: [6, 12], startLoad: { kg: 30, source: 'fixture' }, alternatives: ['lat-pulldown', 'assisted-pull-up'] }),
  fx('vertical-traction', { primary: ['lats'], secondary: ['biceps'], repRange: [6, 12], startLoad: { kg: 30, source: 'fixture' }, alternatives: ['lat-pulldown'] }),
  fx('assisted-pull-up', { equipment: 'assisted', assistance: true, primary: ['lats', 'teres-major'], secondary: ['biceps', 'rhomboids'], repRange: [6, 12], startLoad: { kg: 45, source: 'fixture' }, alternatives: ['lat-pulldown', 'neutral-grip-pulldown'] }),
  fx('pec-deck', { primary: ['pec-sternal'], secondary: ['pec-clavicular', 'delt-front'], repRange: [10, 15], startLoad: { kg: 25, source: 'fixture' }, alternatives: ['cable-fly', 'dumbbell-fly'] }),
  fx('cable-fly', { equipment: 'cable', increment: 2.5, primary: ['pec-sternal'], secondary: ['pec-clavicular'], repRange: [10, 15], startLoad: { kg: 7.5, source: 'fixture' }, alternatives: ['pec-deck', 'dumbbell-fly'] }),
  fx('dumbbell-fly', { equipment: 'dumbbell', increment: 2, primary: ['pec-sternal'], repRange: [10, 15], alternatives: ['pec-deck', 'cable-fly'] }),
  fx('machine-row', { primary: ['lats', 'traps-mid', 'rhomboids'], secondary: ['delt-rear', 'biceps'], repRange: [6, 12], startLoad: { kg: 30, source: 'fixture' }, alternatives: ['seated-cable-row', 'chest-supported-dumbbell-row'] }),
  fx('seated-cable-row', { equipment: 'cable', primary: ['lats', 'traps-mid', 'rhomboids'], secondary: ['delt-rear', 'biceps'], repRange: [6, 12], startLoad: { kg: 30, source: 'fixture' }, alternatives: ['machine-row', 'chest-supported-dumbbell-row'] }),
  fx('chest-supported-dumbbell-row', { equipment: 'dumbbell', increment: 2, primary: ['lats', 'traps-mid', 'rhomboids'], secondary: ['delt-rear', 'biceps'], repRange: [8, 12], alternatives: ['machine-row', 'seated-cable-row'] }),
  fx('machine-shoulder-press', { primary: ['delt-front'], secondary: ['delt-side', 'triceps-lateral'], repRange: [6, 12], startLoad: { kg: 20, source: 'fixture' }, alternatives: ['seated-dumbbell-shoulder-press'] }),
  fx('seated-dumbbell-shoulder-press', { equipment: 'dumbbell', increment: 2, primary: ['delt-front'], secondary: ['delt-side', 'triceps-lateral'], repRange: [6, 12], alternatives: ['machine-shoulder-press'] }),
  fx('machine-crunch', { increment: 2.5, primary: ['rectus-abdominis'], secondary: ['obliques'], repRange: [8, 15], startLoad: { kg: 15, source: 'fixture' }, alternatives: ['cable-crunch'] }),
  fx('cable-crunch', { equipment: 'cable', increment: 2.5, primary: ['rectus-abdominis'], repRange: [8, 15], alternatives: ['machine-crunch'] }),
  fx('machine-incline-press', { primary: ['pec-clavicular'], secondary: ['delt-front', 'triceps-lateral'], repRange: [6, 12], startLoad: { kg: 20, source: 'fixture' }, alternatives: ['incline-dumbbell-press'] }),
  fx('incline-dumbbell-press', { equipment: 'dumbbell', increment: 2, primary: ['pec-clavicular'], secondary: ['delt-front'], repRange: [6, 12], alternatives: ['machine-incline-press'] }),
  fx('face-pull', { equipment: 'cable', increment: 2.5, primary: ['delt-rear', 'rotator-cuff'], secondary: ['traps-mid', 'rhomboids'], repRange: [12, 20], startLoad: { kg: 10, source: 'fixture' }, alternatives: ['reverse-pec-deck'] }),
  fx('reverse-pec-deck', { primary: ['delt-rear'], secondary: ['traps-mid'], repRange: [12, 20], alternatives: ['face-pull'] }),
  fx('lower-back-machine', { primary: ['erectors'], secondary: ['glute-max'], repRange: [8, 15], startLoad: { kg: 25, source: 'fixture' }, alternatives: ['back-extension-45'] }),
  fx('back-extension-45', { equipment: 'bodyweight', increment: 2.5, primary: ['erectors'], secondary: ['glute-max', 'hamstrings'], repRange: [8, 15], alternatives: ['lower-back-machine'] }),
  fx('pallof-press', { equipment: 'cable', increment: 2.5, primary: ['obliques'], secondary: ['transverse-abdominis'], repRange: [8, 12], startLoad: { kg: 5, source: 'fixture' }, alternatives: ['plank', 'bird-dog'] }),
  fx('plank', { equipment: 'bodyweight', increment: 0, repUnit: 'seconds', primary: ['rectus-abdominis', 'transverse-abdominis'], repRange: [20, 60], alternatives: ['dead-bug'] }),
  fx('triceps-press-machine', { primary: ['triceps-lateral', 'triceps-long'], secondary: ['pec-costal', 'delt-front'], repRange: [8, 12], startLoad: { kg: 30, source: 'fixture' }, alternatives: ['assisted-dip', 'dip'] }),
  fx('machine-preacher-curl', { increment: 2.5, primary: ['biceps'], secondary: ['brachialis'], repRange: [8, 15], startLoad: { kg: 15, source: 'fixture' }, alternatives: ['bayesian-cable-curl'] }),
  fx('bayesian-cable-curl', { equipment: 'cable', increment: 2.5, primary: ['biceps'], repRange: [8, 15], alternatives: ['machine-preacher-curl'] }),
  fx('cable-pushdown', { equipment: 'cable', increment: 2.5, primary: ['triceps-lateral', 'triceps-long'], repRange: [8, 15], startLoad: { kg: 12.5, source: 'fixture' }, alternatives: ['overhead-cable-triceps-extension'] }),
  fx('overhead-cable-triceps-extension', { equipment: 'cable', increment: 2.5, primary: ['triceps-long'], repRange: [8, 15], alternatives: ['cable-pushdown'] }),
  fx('machine-lateral-raise', { increment: 2.5, primary: ['delt-side'], repRange: [12, 20], startLoad: { kg: 10, source: 'fixture' }, alternatives: ['cable-lateral-raise'] }),
  fx('cable-lateral-raise', { equipment: 'cable', increment: 2.5, primary: ['delt-side'], repRange: [12, 20], alternatives: ['machine-lateral-raise'] }),
  fx('hammer-curl', { equipment: 'dumbbell', increment: 2, difficulty: 2, primary: ['brachialis', 'brachioradialis'], secondary: ['biceps'], repRange: [8, 15], startLoad: { kg: 6, source: 'fixture' }, alternatives: ['reverse-curl', 'cable-curl'] }),
  fx('captains-chair-knee-raise', { equipment: 'bodyweight', increment: 0, primary: ['rectus-abdominis'], secondary: ['hip-flexors', 'obliques'], repRange: [8, 15], alternatives: ['reverse-crunch'] }),
  fx('reverse-crunch', { equipment: 'bodyweight', increment: 0, primary: ['rectus-abdominis'], repRange: [8, 15], alternatives: ['captains-chair-knee-raise'] }),
  fx('hanging-leg-raise', { equipment: 'bodyweight', increment: 0, difficulty: 3, primary: ['rectus-abdominis'], secondary: ['hip-flexors'], repRange: [6, 12], alternatives: ['captains-chair-knee-raise'] }),
  fx('cable-curl', { equipment: 'cable', increment: 2.5, primary: ['biceps'], secondary: ['brachialis'], repRange: [8, 15], alternatives: ['hammer-curl'] }),
  fx('reverse-curl', { equipment: 'barbell', increment: 2.5, difficulty: 2, primary: ['brachioradialis', 'brachialis'], repRange: [8, 15], alternatives: ['hammer-curl'] }),
  fx('farmers-carry', { equipment: 'dumbbell', increment: 2, repUnit: 'meters', primary: ['forearm-flexors', 'traps-upper'], secondary: ['obliques'], repRange: [20, 40], startLoad: { kg: 20, source: 'fixture' }, alternatives: ['suitcase-carry', 'dead-hang'] }),
  fx('suitcase-carry', { equipment: 'dumbbell', increment: 2, repUnit: 'meters', primary: ['forearm-flexors', 'obliques'], repRange: [20, 40], alternatives: ['farmers-carry'] }),
  fx('dead-hang', { equipment: 'bodyweight', increment: 0, repUnit: 'seconds', primary: ['forearm-flexors'], repRange: [20, 60], alternatives: ['farmers-carry'] }),
  fx('leg-press-45', { equipment: 'plate-loaded', increment: 2.5, primary: ['quads', 'glute-max'], secondary: ['adductors'], repRange: [6, 12], startLoad: { kg: 65, source: 'fixture' }, alternatives: ['hack-squat'] }),
  fx('seated-leg-curl', { primary: ['hamstrings'], repRange: [8, 15], startLoad: { kg: 25, source: 'fixture' }, alternatives: ['lying-leg-curl'] }),
  fx('leg-extension', { primary: ['quads'], repRange: [8, 15], startLoad: { kg: 30, source: 'fixture' }, alternatives: [] }),
  fx('standing-calf-raise-machine', { primary: ['gastrocnemius', 'soleus'], repRange: [10, 20], startLoad: { kg: 30, source: 'fixture' }, alternatives: ['leg-press-calf-raise'] }),
  fx('trap-bar-deadlift', { equipment: 'barbell', increment: 2.5, primary: ['glute-max', 'quads'], secondary: ['hamstrings', 'erectors'], repRange: [4, 8], startLoad: { kg: 60, source: 'fixture' }, alternatives: ['dumbbell-rdl'] }),
];

export const CATALOG = catalogFrom(FIXTURES);
/** @param {string} id */
export const ex = (id) => {
  const e = CATALOG.exerciseById(id);
  if (!e) throw new Error(`no fixture ${id}`);
  return e;
};

/** A gym: everything available unless `available` is listed. */
export const gym = (o = {}) => ({ id: 'gym-1', name: 'Test gym', available: [], missing: [], preferred: {}, updatedAt: '2026-11-01T00:00:00.000Z', ...o });

let seq = 0;
/**
 * A logged set. @param {Partial<import('../../src/lib/fitness/types').LoggedSet>} o
 * @returns {import('../../src/lib/fitness/types').LoggedSet}
 */
export function set(o) {
  seq += 1;
  const idx = o.setIndex ?? seq;
  return {
    id: `set-${seq}`,
    sessionId: 's1',
    slotId: 'A1',
    exerciseId: 'machine-chest-press',
    setIndex: idx,
    kind: 'working',
    plannedKg: o.kg ?? 0,
    plannedReps: o.reps ?? 0,
    kg: 0,
    reps: 0,
    rir: 2,
    doneAt: new Date(Date.parse('2026-11-10T17:00:00.000Z') + idx * 120000).toISOString(),
    updatedAt: '2026-11-10T18:00:00.000Z',
    ...o,
  };
}

/** Sets of `reps[i]` at `kg` with RIR `rir`. */
export const sets = (kg, reps, rir = 2, o = {}) => reps.map((r, i) => set({ kg, reps: r, rir, setIndex: i, ...o }));

/**
 * An exercise state. @param {Partial<import('../../src/lib/fitness/types').ExerciseState>} o
 * @returns {import('../../src/lib/fitness/types').ExerciseState}
 */
export const state = (o = {}) => ({
  exerciseId: 'machine-chest-press',
  workingKg: 50,
  targetReps: 6,
  repRange: [6, 10],
  rir: 2,
  e1rm: 0,
  lastOutcome: 'progressed',
  fails: 0,
  sessions: 3,
  lastAt: '2026-11-07T17:00:00.000Z',
  updatedAt: '2026-11-07T18:00:00.000Z',
  ...o,
});

/** ProgressionParams. */
export const params = (o = {}) => ({ rule: 'double', repRange: [6, 10], rir: 2, stepPct: 2.5, failsBeforeDeload: 2, deloadPct: 10, overshootReps: 2, ...o });
