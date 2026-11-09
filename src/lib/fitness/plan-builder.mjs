// @ts-check
/** Personal plan construction: one primary prescription plus ordered supporting goals and durable exclusions. */
import { buildProgram, GOAL_IDS, groupWeights, toIso, withLegs } from './templates.mjs';
import { enforcePlanPreferences, exerciseAllowed, prioritizeFocus, trainingPreferences } from './plan-preferences.mjs';
import { EXERCISES, exerciseById, groupOfMuscle, isMachine } from './catalog.mjs';
import { addSlot } from './program-edit.mjs';
import { weeklySets, weeklySetsTarget } from './progression.mjs';

/** @typedef {import('./types').Program} Program */
/** @typedef {import('./types').GoalMode} GoalMode */
/** @typedef {import('./types').TrainingPreferences} TrainingPreferences */
/** @typedef {Date|string|number} TimeLike */

/** @param {{goal?:GoalMode,secondaryGoals?:GoalMode[],focusGroups?:string[],daysPerWeek?:2|3|4,bodyScope?:TrainingPreferences['bodyScope'],excludedGroups?:string[],title?:string,now?:TimeLike,templateId?:string,custom?:boolean}} [input] @returns {Program} */
export function buildPersonalProgram({ goal = 'recomp', secondaryGoals = [], focusGroups = [], daysPerWeek = 3, bodyScope = 'upper', excludedGroups = [], title = '', now, templateId, custom = false } = {}) {
  const program = buildProgram({ goal: GOAL_IDS.includes(goal) ? goal : 'recomp', daysPerWeek, templateId, now });
  const preferences = trainingPreferences({ secondaryGoals, focusGroups, bodyScope, excludedGroups }, program.goal);
  /** @type {Program} */
  let next = { ...program, preferences };
  if (bodyScope === 'full' && !custom) next = withLegs(next, now, { as: 'slots', id: next.id });
  if (custom) next = { ...next, templateId: 'custom', days: Array.from({ length: daysPerWeek }, (_, i) => ({ key: String.fromCharCode(65 + i), name: { en: `Day ${i + 1}`, ru: `День ${i + 1}` }, focus: [], slots: [] })) };
  const name = title.trim().slice(0, 80);
  next = { ...next, name: name ? { en: name, ru: name } : custom ? { en: 'My custom plan', ru: 'Мой план' } : bodyScope === 'full' ? { en: 'My full-body plan', ru: 'Мой план на всё тело' } : bodyScope === 'upper' ? { en: 'My upper-body plan', ru: 'Мой план на верх тела' } : { en: 'My training plan', ru: 'Мой тренировочный план' } };
  // A personal focus changes exercise order; neutral labels avoid promising the starting template's old day emphasis.
  if (!custom && preferences.focusGroups?.length) next = { ...next, days: next.days.map((day, i) => ({ ...day, name: { en: `Day ${i + 1}`, ru: `День ${i + 1}` } })) };
  next = enforcePlanPreferences(next);
  return custom ? next : ensureFocusCoverage(next, now);
}

/** Add a missing chosen target to a reviewable draft, never beyond the goal's existing weekly volume ceiling.
 * @param {Program} program @param {TimeLike} [now] @returns {Program} */
export function ensureFocusCoverage(program, now) {
  let next = program;
  for (const group of next.preferences?.focusGroups ?? []) {
    if (next.days.some((d) => d.slots.some((s) => (exerciseById(s.exerciseId)?.primary ?? []).some((m) => groupOfMuscle(m) === group)))) continue;
    const totals = weeklySets(next);
    const ceiling = weeklySetsTarget(next.goal).max;
    const frequency = next.days.length ? next.daysPerWeek / next.days.length : 1;
    const headroom = (/** @type {string} */ id) => Math.floor(Math.min(...Object.entries(groupWeights(id))
      .map(([g, weight]) => (ceiling - (totals[g] ?? 0)) / (weight * frequency))));
    const candidate = EXERCISES.filter((e) => exerciseAllowed(next, e) && e.primary.some((m) => groupOfMuscle(m) === group) && headroom(e.id) >= 1)
      .sort((a, b) => Number(isMachine(b.equipment)) - Number(isMachine(a.equipment)))[0];
    if (!candidate || !next.days.length) continue;
    const remaining = headroom(candidate.id);
    const day = [...next.days].sort((a, b) => a.slots.reduce((n, s) => n + s.sets, 0) - b.slots.reduce((n, s) => n + s.sets, 0))[0];
    const before = next;
    next = addSlot(next, day.key, candidate.id, now);
    if (next === before) continue;
    next = { ...next, days: next.days.map((d) => d.key !== day.key ? d : { ...d, slots: d.slots.map((s) => s.exerciseId !== candidate.id ? s : { ...s, sets: Math.min(s.sets, remaining) }) }) };
  }
  return prioritizeFocus(next);
}

/** Preferences change the scope of future work without resetting exercise baselines or deleting past programs.
 * @param {Program} program @param {Partial<TrainingPreferences> & {title?:string,pivotReason?:string}} input @param {TimeLike} [now] @returns {Program} */
export function setPlanPreferences(program, input, now) {
  const preferences = trainingPreferences({ ...(program.preferences ?? { bodyScope: 'custom', secondaryGoals: [], excludedGroups: [] }), ...input }, program.goal);
  const title = input.title?.trim().slice(0, 80);
  const name = title && title !== program.name.en && title !== program.name.ru ? { en: title, ru: title } : program.name;
  const pivotReason = input.pivotReason === undefined ? program.pivotReason : input.pivotReason.trim().slice(0, 500) || undefined;
  if (JSON.stringify(preferences) === JSON.stringify(trainingPreferences(program.preferences ?? { bodyScope: "custom" }, program.goal)) && name === program.name && pivotReason === program.pivotReason) return program;
  const next = enforcePlanPreferences({ ...program, preferences, name, pivotReason, version: program.version + 1, updatedAt: toIso(now) });
  return input.focusGroups === undefined ? next : prioritizeFocus(next);
}

/** @param {Program} program @param {string} key @param {string} title @param {TimeLike} [now] @returns {Program} */
export function renameDay(program, key, title, now) {
  const text = title.trim().slice(0, 80);
  const day = program.days.find((d) => d.key === key);
  if (!text || !day || (day.name.en === text && day.name.ru === text)) return program;
  return { ...program, days: program.days.map((d) => d.key === key ? { ...d, name: { en: text, ru: text } } : d), version: program.version + 1, updatedAt: toIso(now) };
}

/** @param {Program} program @param {string} key @param {number} delta @param {TimeLike} [now] @returns {Program} */
export function moveDay(program, key, delta, now) {
  const index = program.days.findIndex((d) => d.key === key);
  const target = Math.max(0, Math.min(program.days.length - 1, index + delta));
  if (index < 0 || index === target) return program;
  const days = [...program.days]; const [day] = days.splice(index, 1); days.splice(target, 0, day);
  return { ...program, days, version: program.version + 1, updatedAt: toIso(now) };
}
