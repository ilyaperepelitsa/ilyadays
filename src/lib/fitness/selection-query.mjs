// @ts-check
import { GOAL_IDS } from './goal-ids.mjs';

/** Ordered, bounded and allowlisted values for shareable explorer/profile links.
 * @template {string} T @param {string|null} value @param {readonly T[]} allowed @returns {T[]} */
export function selectionIds(value, allowed) {
  const selected = (value ?? '').slice(0, 512).split(',');
  return [...new Set(selected)].filter((id) => allowed.includes(/** @type {T} */ (id))).map((id) => /** @type {T} */ (id));
}

/** An explicit handoff previews choices; opening this URL never saves a plan.
 * @param {string} search @param {readonly string[]} groupIds */
export function profileSelection(search, groupIds) {
  const params = new URLSearchParams(search);
  if (params.get('from') !== 'explorer') return null;
  return { goals: selectionIds(params.get('goals'), GOAL_IDS), focusGroups: selectionIds(params.get('focus'), groupIds) };
}

/** @param {readonly string[]} goals @param {readonly string[]} focus */
export function profileSelectionQuery(goals, focus) {
  return new URLSearchParams({ from: 'explorer', goals: goals.join(','), focus: focus.join(',') }).toString();
}
