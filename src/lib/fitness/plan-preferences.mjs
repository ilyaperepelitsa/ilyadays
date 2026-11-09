// @ts-check
/** Durable training preferences shared by construction, edits and template conversion. */
import { GROUPS, exerciseById, groupOfMuscle } from './catalog.mjs';

/** @typedef {import('./types').Program} Program */
/** @typedef {import('./types').TrainingPreferences} TrainingPreferences */
/** @typedef {import('./types').Exercise} Exercise */
/** @typedef {import('./types').GoalMode} GoalMode */
const GOALS = new Set(['strength', 'hypertrophy', 'recomp', 'endurance', 'maintenance']);
const GROUP_IDS = new Set(GROUPS.map((g) => g.id));
export const LOWER_BODY_GROUPS = Object.freeze(['quads', 'hamstrings', 'adductors', 'glutes', 'calves']);
const LOWER = new Set(LOWER_BODY_GROUPS);
// Loaded carries load the lower body even when grip is the main catalog muscle.
const LOWER_PATTERNS = new Set(['squat', 'lunge', 'hip-hinge', 'knee-flexion', 'knee-extension', 'hip-abduction', 'hip-adduction', 'hip-extension', 'calf-raise', 'carry']);

/** @param {Partial<TrainingPreferences> | null | undefined} input @param {GoalMode} [primary] @returns {TrainingPreferences} */
export function trainingPreferences(input, primary = 'recomp') {
  const bodyScope = input?.bodyScope === 'full' || input?.bodyScope === 'custom' ? input.bodyScope : 'upper';
  const secondaryGoals = [...new Set(input?.secondaryGoals ?? [])].filter((g) => GOALS.has(g) && g !== primary);
  // Older callers used the broad 'legs' label; persist actual catalog groups instead.
  const excludedGroups = [...new Set((input?.excludedGroups ?? []).flatMap((g) => g === 'legs' ? [...LOWER_BODY_GROUPS] : [g]))].filter((g) => GROUP_IDS.has(g));
  if (bodyScope === 'upper') for (const g of LOWER) if (!excludedGroups.includes(g)) excludedGroups.push(g);
  const focusGroups = [...new Set(input?.focusGroups ?? [])].filter((g) => GROUP_IDS.has(g) && !excludedGroups.includes(g));
  return { secondaryGoals, bodyScope, excludedGroups, focusGroups };
}

/** Put chosen muscles first without adding sets or splitting supersets. Explicit manual reordering stays possible.
 * @param {Program} program @param {{exerciseById:(id:string)=>Exercise|undefined}} [catalog] @returns {Program} */
export function prioritizeFocus(program, catalog = { exerciseById }) {
  const selected = program.preferences?.focusGroups ?? [];
  if (!selected.length) return program;
  const score = (/** @type {import('./types').ExerciseSlot[]} */ slots) => Math.min(1000, ...slots.flatMap((slot) =>
    (catalog.exerciseById(slot.exerciseId)?.primary ?? []).map((m) => {
      const i = selected.indexOf(groupOfMuscle(m)); return i < 0 ? 1000 : i;
    })));
  return { ...program, days: program.days.map((day) => {
    const seen = new Set();
    const blocks = day.slots.flatMap((slot) => {
      if (!slot.superset) return [[slot]];
      if (seen.has(slot.superset)) return [];
      seen.add(slot.superset); return [day.slots.filter((s) => s.superset === slot.superset)];
    });
    return { ...day, slots: blocks.sort((a, b) => score(a) - score(b)).flat() };
  }) };
}

/** Surface a requested target that the current draft does not train directly (for example after a manual removal).
 * @param {Program} program @param {{exerciseById:(id:string)=>Exercise|undefined}} [catalog] */
export function uncoveredFocus(program, catalog = { exerciseById }) {
  const direct = new Set(program.days.flatMap((day) => day.slots.flatMap((slot) =>
    (catalog.exerciseById(slot.exerciseId)?.primary ?? []).map(groupOfMuscle))));
  return (program.preferences?.focusGroups ?? []).filter((group) => !direct.has(group));
}

/** Explicit exclusions concern target muscles, rather than every stabilizer involved in a movement.
 * @param {Program} program @param {Exercise | null | undefined} exercise */
export function exerciseAllowed(program, exercise) {
  if (!program.preferences) return true; // legacy programs retain their documented behavior
  if (!exercise) return false;
  const p = trainingPreferences(program.preferences, program.goal);
  const excludesLowerBody = p.bodyScope === 'upper' || LOWER_BODY_GROUPS.every((g) => p.excludedGroups.includes(g));
  if (excludesLowerBody && LOWER_PATTERNS.has(exercise.pattern)) return false;
  return !exercise.primary.some((m) => p.excludedGroups.includes(groupOfMuscle(m) ?? m));
}

/** Apply exclusions without inserting replacement exercises or changing the user's day order.
 * @param {Program} program @param {{exerciseById:(id:string)=>Exercise|undefined}} [catalog] @returns {Program} */
export function enforcePlanPreferences(program, catalog = { exerciseById }) {
  if (!program.preferences) return program;
  const preferences = trainingPreferences(program.preferences, program.goal);
  const scoped = { ...program, preferences };
  return { ...scoped, days: program.days.map((day) => {
    const slots = day.slots.filter((s) => exerciseAllowed(scoped, catalog.exerciseById(s.exerciseId)));
    const pairs = slots.reduce((map, s) => { if (s.superset) map.set(s.superset, (map.get(s.superset) ?? 0) + 1); return map; }, new Map());
    const focus = [...new Set(slots.flatMap((s) => (catalog.exerciseById(s.exerciseId)?.primary ?? []).map(groupOfMuscle)))].filter((g) => g !== "other" && !preferences.excludedGroups.includes(g));
    return { ...day, focus, slots: slots.map((s) => {
      if (!s.superset || (pairs.get(s.superset) ?? 0) > 1) return s;
      const out = { ...s }; delete out.superset; return out;
    }) };
  }).filter((day) => day.key !== "L" || day.slots.length > 0) };
}
