import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, GROUPS, exerciseById, facetCounts, filterItems, groupOfMuscle, groupsOf } from '../../src/lib/fitness/catalog.mjs';
import { profileSelection, profileSelectionQuery, selectionIds } from '../../src/lib/fitness/selection-query.mjs';
import { buildPersonalProgram, ensureFocusCoverage, setPlanPreferences } from '../../src/lib/fitness/plan-builder.mjs';
import { prioritizeFocus, trainingPreferences, uncoveredFocus } from '../../src/lib/fitness/plan-preferences.mjs';
import { profilePlanDraft, profilePreferences } from '../../src/lib/fitness/profile-core.mjs';
import { addSlot, commitProgram, moveSlot, setDays, setGoal } from '../../src/lib/fitness/program-edit.mjs';
import { weeklySets, weeklySetsTarget } from '../../src/lib/fitness/progression.mjs';

const at = '2026-11-10T12:00:00.000Z';
const all = (program) => program.days.flatMap((d) => d.slots);
const targets = (program, group) => all(program).some((s) => exerciseById(s.exerciseId)?.primary.some((m) => groupOfMuscle(m) === group));

test('multiple muscle filters are an OR, while equipment and movement remain intersections', () => {
  const rows = EXERCISES.map((e) => ({ ...e, groups: groupsOf(e.id) }));
  const filter = { group: ['shoulders', 'biceps'], equipment: 'cable' };
  const found = filterItems(rows, filter);
  const expected = rows.filter((e) => e.equipment === 'cable' && e.groups.some((g) => filter.group.includes(g)));
  assert.deepEqual(found, expected);
  assert.ok(found.some((e) => e.groups.includes('shoulders')));
  assert.ok(found.some((e) => e.groups.includes('biceps')));
  assert.deepEqual(filterItems(rows, { group: ['chest'] }), filterItems(rows, { group: 'chest' }), 'old URLs stay equivalent');
  const counts = facetCounts(rows, filter);
  assert.equal(counts.group.get('back'), rows.filter((e) => e.equipment === 'cable' && e.groups.includes('back')).length);
  assert.equal(counts.equipment.get('dumbbell'), filterItems(rows, { ...filter, equipment: 'dumbbell' }).length);
});

test('profile handoff preserves order, ignores invalid IDs and never applies unrelated query parameters', () => {
  const ids = GROUPS.map((g) => g.id);
  const query = profileSelectionQuery(['strength', 'hypertrophy', 'maintenance'], ['shoulders', 'biceps']);
  assert.deepEqual(profileSelection(query, ids), { goals: ['strength', 'hypertrophy', 'maintenance'], focusGroups: ['shoulders', 'biceps'] });
  assert.equal(profileSelection('goals=strength&focus=quads', ids), null);
  assert.deepEqual(profileSelection('from=explorer&goals=strength,strength,nope,endurance&focus=quads,nope,quads', ids), { goals: ['strength', 'endurance'], focusGroups: ['quads'] });
  assert.deepEqual(selectionIds('x'.repeat(2000) + ',biceps', ids), [], 'bounded input');
});

test('explicit exclusions beat focus requests, including aliases, while raw form choices can expose a conflict', () => {
  const preferences = trainingPreferences({ bodyScope: 'upper', excludedGroups: ['biceps'], focusGroups: ['quads', 'biceps', 'shoulders', 'shoulders', 'missing'] });
  assert.deepEqual(preferences.focusGroups, ['shoulders']);
  const raw = ['quads', 'shoulders'];
  const scoped = profilePreferences(preferences, 'upper', [], 'strength', raw);
  assert.deepEqual(raw.filter((g) => scoped.excludedGroups.includes(g)), ['quads']);
  const full = profilePreferences(preferences, 'full', [], 'strength', raw);
  assert.deepEqual(full.focusGroups, raw);
  assert.ok(full.excludedGroups.includes('biceps'));
});

test('focus covers missing targets in a draft without exceeding any affected group volume range', () => {
  for (const goal of ['strength', 'hypertrophy', 'maintenance', 'endurance', 'recomp']) {
    for (const group of GROUPS) {
      const blank = buildPersonalProgram({ custom: true, bodyScope: 'full', goal, daysPerWeek: 2, focusGroups: [group.id], now: at });
      assert.equal(all(blank).length, 0, 'custom construction remains empty');
      const next = ensureFocusCoverage(blank, at);
      assert.ok(targets(next, group.id), `${goal}: ${group.id}`);
      assert.ok(Object.values(weeklySets(next)).every((n) => n <= weeklySetsTarget(goal).max));
      assert.deepEqual(ensureFocusCoverage(next, at), next, 'no repeated volume bonus');
    }
  }
});

test('focus sorting keeps superset blocks intact and allows a later manual reorder', () => {
  const built = buildPersonalProgram({ now: at });
  const make = (id, superset) => ({ ...built.days[0].slots[0], slotId: id, exerciseId: id, superset });
  const day = { ...built.days[0], slots: [make('machine-chest-press'), make('machine-row', 'pair'), make('machine-lateral-raise', 'pair'), make('cable-curl')] };
  const p = { ...built, preferences: { ...built.preferences, focusGroups: ['shoulders', 'biceps'] }, days: [day] };
  const sorted = prioritizeFocus(p);
  assert.deepEqual(sorted.days[0].slots.map((s) => s.exerciseId), ['machine-row', 'machine-lateral-raise', 'cable-curl', 'machine-chest-press']);
  assert.deepEqual(p.days[0].slots, day.slots, 'old snapshot untouched');
  const manual = moveSlot(sorted, day.key, 'cable-curl', -1, at);
  assert.notDeepEqual(manual.days[0].slots, sorted.days[0].slots, 'manual edit wins after automatic ordering');
});

test('profile preview and saved pivots retain focus through goal/day changes without altering old programs', () => {
  const old = buildPersonalProgram({ goal: 'strength', focusGroups: ['shoulders', 'forearms'], secondaryGoals: ['hypertrophy', 'maintenance', 'endurance'], now: at });
  const original = structuredClone(old);
  const preferences = profilePreferences(old.preferences, 'upper', old.preferences.secondaryGoals, 'recomp');
  const draft = profilePlanDraft(old, { goal: 'recomp', days: 4, preferences }, {}, at);
  const saved = commitProgram(old, draft, at);
  assert.deepEqual(saved.program.preferences.focusGroups, ['shoulders', 'forearms']);
  assert.deepEqual(setDays(setGoal(saved.program, 'hypertrophy', {}, at).program, 2, at).preferences.focusGroups, ['shoulders', 'forearms']);
  assert.deepEqual(old, original);
  assert.notEqual(saved.program.id, old.id);
});

test('new focus skips additions when a synergist is already at its volume ceiling', () => {
  let p = buildPersonalProgram({ custom: true, bodyScope: 'full', goal: 'maintenance', focusGroups: ['chest'], now: at });
  p = addSlot(p, 'A', 'cable-pushdown', at);
  p = { ...p, days: p.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s, sets: weeklySetsTarget(p.goal).max * 2 })) })) };
  const before = weeklySets(p).triceps;
  const next = ensureFocusCoverage(p, at);
  assert.ok(targets(next, 'chest'), 'can select a chest isolation without triceps contribution');
  assert.equal(weeklySets(next).triceps, before, 'no extra overloaded synergist work');
  const withoutFocus = setPlanPreferences(next, { focusGroups: [] }, at);
  assert.equal(all(withoutFocus).length, all(next).length, 'deselecting focus does not delete manually reviewable work');
});


test('manual removal leaves focus preferences visible as an uncovered target instead of silently claiming coverage', () => {
  const program = buildPersonalProgram({ custom: true, focusGroups: ['shoulders'], now: at });
  assert.deepEqual(uncoveredFocus(program), ['shoulders']);
  const added = addSlot(program, 'A', 'machine-lateral-raise', at);
  assert.deepEqual(uncoveredFocus(added), []);
  assert.deepEqual(program.preferences.focusGroups, ['shoulders']);
});
