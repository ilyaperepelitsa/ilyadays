// @ts-check
/** Validation for self-service profile forms. Authorization stays in database policies and RPCs. */
/** @param {unknown} value */
export function profileName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 80) : '';
}
/** @param {string} name @param {number | null} weight @param {number | null} height */
export function profileErrors(name, weight, height) {
  /** @type {('name'|'weight'|'height')[]} */
  const errors = [];
  if (!profileName(name)) errors.push('name');
  if (weight != null && (!Number.isFinite(weight) || weight <= 20 || weight >= 400)) errors.push('weight');
  if (height != null && (!Number.isFinite(height) || height < 100 || height > 250)) errors.push('height');
  return errors;
}

import { trainingPreferences } from './plan-preferences.mjs';
import { buildPersonalProgram, ensureFocusCoverage, setPlanPreferences } from './plan-builder.mjs';
import { addLegs, setDays, setGoal } from './program-edit.mjs';
/** Profile edits preserve explicit exclusions; only an explicit switch to full-body releases lower-body exclusions.
 * @param {import('./types').TrainingPreferences|undefined} existing @param {import('./types').TrainingPreferences['bodyScope']} scope
 * @param {import('./types').GoalMode[]} secondary @param {import('./types').GoalMode} goal @param {string[]} [focusGroups] */
export function profilePreferences(existing, scope, secondary, goal, focusGroups = existing?.focusGroups ?? []) {
  let excludedGroups = [...(existing?.excludedGroups ?? [])];
  if (scope === 'full' && existing?.bodyScope !== 'full') excludedGroups = excludedGroups.filter((g) => !['legs','glutes','calves','quads','hamstrings','adductors'].includes(g));
  return trainingPreferences({ bodyScope:scope, secondaryGoals:secondary, excludedGroups, focusGroups },goal);
}
/** @param {import('./types').Program|null} saved
 * @param {{goal:import('./types').GoalMode,days:2|3|4,preferences:import('./types').TrainingPreferences,title?:string}} input
 * @param {Record<string,import('./types').ExerciseState>} states @param {string} at */
export function profilePlanDraft(saved,{goal,days,preferences,title},states,at) {
  if (!saved) return buildPersonalProgram({goal,daysPerWeek:days,...preferences,title,now:at});
  let next = setPlanPreferences(setDays(setGoal(saved,goal,states,at).program,days,at),{...preferences,pivotReason:'Profile training preferences'},at);
  if (preferences.bodyScope === 'full' && saved.preferences?.bodyScope !== 'full') next=addLegs(next,at,{as:'slots'});
  return ensureFocusCoverage(next, at);
}
