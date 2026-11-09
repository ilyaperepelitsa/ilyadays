// @ts-check
/** Personal plan construction: one primary prescription plus ordered supporting goals and durable exclusions. */
import { buildProgram, GOAL_IDS, toIso, withLegs } from './templates.mjs';
import { enforcePlanPreferences, trainingPreferences } from './plan-preferences.mjs';

/** @typedef {import('./types').Program} Program */
/** @typedef {import('./types').GoalMode} GoalMode */
/** @typedef {import('./types').TrainingPreferences} TrainingPreferences */
/** @typedef {Date|string|number} TimeLike */

/** @param {{goal?:GoalMode,secondaryGoals?:GoalMode[],daysPerWeek?:2|3|4,bodyScope?:TrainingPreferences['bodyScope'],excludedGroups?:string[],title?:string,now?:TimeLike,templateId?:string,custom?:boolean}} [input] @returns {Program} */
export function buildPersonalProgram({ goal = 'recomp', secondaryGoals = [], daysPerWeek = 3, bodyScope = 'upper', excludedGroups = [], title = '', now, templateId, custom = false } = {}) {
  const program = buildProgram({ goal: GOAL_IDS.includes(goal) ? goal : 'recomp', daysPerWeek, templateId, now });
  const preferences = trainingPreferences({ secondaryGoals, bodyScope, excludedGroups }, program.goal);
  /** @type {Program} */
  let next = { ...program, preferences };
  if (bodyScope === 'full' && !custom) next = withLegs(next, now, { as: 'slots', id: next.id });
  if (custom) next = { ...next, templateId: 'custom', days: Array.from({ length: daysPerWeek }, (_, i) => ({ key: String.fromCharCode(65 + i), name: { en: `Day ${i + 1}`, ru: `День ${i + 1}` }, focus: [], slots: [] })) };
  const name = title.trim().slice(0, 80);
  next = { ...next, name: name ? { en: name, ru: name } : custom ? { en: 'My custom plan', ru: 'Мой план' } : bodyScope === 'full' ? { en: 'My full-body plan', ru: 'Мой план на всё тело' } : bodyScope === 'upper' ? { en: 'My upper-body plan', ru: 'Мой план на верх тела' } : { en: 'My training plan', ru: 'Мой тренировочный план' } };
  return enforcePlanPreferences(next);
}

/** Preferences change the scope of future work without resetting exercise baselines or deleting past programs.
 * @param {Program} program @param {Partial<TrainingPreferences> & {title?:string,pivotReason?:string}} input @param {TimeLike} [now] @returns {Program} */
export function setPlanPreferences(program, input, now) {
  const preferences = trainingPreferences({ ...(program.preferences ?? { bodyScope: 'custom', secondaryGoals: [], excludedGroups: [] }), ...input }, program.goal);
  const title = input.title?.trim().slice(0, 80);
  const name = title && title !== program.name.en && title !== program.name.ru ? { en: title, ru: title } : program.name;
  const pivotReason = input.pivotReason === undefined ? program.pivotReason : input.pivotReason.trim().slice(0, 500) || undefined;
  if (JSON.stringify(preferences) === JSON.stringify(trainingPreferences(program.preferences ?? { bodyScope: "custom" }, program.goal)) && name === program.name && pivotReason === program.pivotReason) return program;
  return enforcePlanPreferences({ ...program, preferences, name, pivotReason, version: program.version + 1, updatedAt: toIso(now) });
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
