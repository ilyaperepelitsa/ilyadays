import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalProgram, moveDay, renameDay, setPlanPreferences } from '../../src/lib/fitness/plan-builder.mjs';
import { exerciseAllowed, enforcePlanPreferences } from '../../src/lib/fitness/plan-preferences.mjs';
import { addLegs, addSlot, commitProgram, programDiff, resetToTemplate, setDays, setGoal, swapSlot } from '../../src/lib/fitness/program-edit.mjs';
import { convertProgram, withLegs } from '../../src/lib/fitness/templates.mjs';
import { exerciseById } from '../../src/lib/fitness/catalog.mjs';

const NOW = '2026-11-10T10:00:00.000Z';
const later = '2026-11-11T10:00:00.000Z';
const slots = (p) => p.days.flatMap((d) => d.slots);
const assertScope = (p) => { for (const s of slots(p)) assert.equal(exerciseAllowed(p, exerciseById(s.exerciseId)), true, s.exerciseId); };

test('one primary goal controls prescriptions; secondary priorities are ordered, unique and distinct', () => {
  const p = buildPersonalProgram({ goal: 'strength', secondaryGoals: ['strength', 'hypertrophy', 'hypertrophy', 'maintenance', 'endurance'], now: NOW });
  assert.equal(p.goal, 'strength');
  assert.deepEqual(p.preferences.secondaryGoals, ['hypertrophy', 'maintenance', 'endurance']);
  const primaryOnly = buildPersonalProgram({ goal: 'strength', now: NOW });
  assert.deepEqual(p.days, primaryOnly.days, 'supporting goals do not silently apply contradictory prescriptions');
  const switched = setGoal(p, 'hypertrophy', {}, later).program;
  assert.deepEqual(switched.preferences.secondaryGoals, ['maintenance', 'endurance']);
});

test('upper-body preference really excludes all lower-body movements including loaded carries', () => {
  const p = buildPersonalProgram({ bodyScope: 'upper', now: NOW });
  assertScope(p);
  for (const id of ['leg-press-45', 'leg-extension', 'standing-calf-raise-machine', 'dumbbell-rdl', 'farmers-carry']) assert.equal(exerciseAllowed(p, exerciseById(id)), false, id);
  assert.ok(!slots(p).some((s) => s.exerciseId === 'farmers-carry'));
  assert.ok(p.days.every((d) => d.slots.length > 0));
  assert.equal(exerciseAllowed(p, exerciseById('machine-row')), true);
});

test('exclusions survive primary goal, day-count, template reset and legs add-on edits', () => {
  let p = buildPersonalProgram({ bodyScope: 'upper', excludedGroups: ['biceps'], now: NOW });
  p = setGoal(p, 'endurance', {}, later).program; assertScope(p);
  p = setDays(p, 4, later); assertScope(p);
  assert.equal(addLegs(p, later), p);
  assert.equal(withLegs(p, later), p);
  p = resetToTemplate('owner-3day-upper', 'strength', 3, later, { from: p }); assertScope(p);
  assert.ok(p.preferences.excludedGroups.includes('biceps'));
  assert.ok(slots(p).every((s) => !exerciseById(s.exerciseId)?.primary.includes('biceps')));
  p = convertProgram(p, 'recomp', later); assertScope(p);
});

test('manual additions and swaps cannot bypass exclusions', () => {
  const p = buildPersonalProgram({ bodyScope: 'upper', now: NOW });
  assert.equal(addSlot(p, 'A', 'leg-press-45', later), p);
  assert.equal(swapSlot(p, 'A', p.days[0].slots[0].slotId, 'dumbbell-rdl', later), p);
  const corrupted = { ...p, days: p.days.map((d, i) => i ? d : { ...d, slots: [...d.slots, { ...d.slots[0], slotId: 'illegal', exerciseId: 'leg-press-45' }] }) };
  assertScope(enforcePlanPreferences(corrupted));
  assertScope(commitProgram(p, corrupted, later).program);
});

test('full-body construction includes lower-body work but custom construction starts genuinely empty', () => {
  const p = buildPersonalProgram({ bodyScope: 'full', now: NOW });
  assert.ok(slots(p).some((s) => ['leg-press-45', 'leg-extension', 'seated-leg-curl'].includes(s.exerciseId)));
  assert.match(p.name.en, /full-body/);
  const blank = buildPersonalProgram({ custom: true, daysPerWeek: 2, now: NOW });
  assert.equal(blank.days.length, 2);
  assert.equal(slots(blank).length, 0);
  assert.equal(blank.templateId, 'custom');
  const added = addSlot(blank, 'A', 'machine-row', later);
  const grown = setDays(added, 4, later);
  assert.deepEqual(slots(grown).map((s) => s.exerciseId), ['machine-row'], 'changing custom day count never refills owner defaults');
});

test('a pivot is reviewable, archives the old plan and never mutates its history or exercise state', () => {
  const old = buildPersonalProgram({ title: 'My shoulders', now: NOW });
  const before = structuredClone(old);
  let draft = setPlanPreferences(old, { title: 'My strength block', secondaryGoals: ['maintenance'], pivotReason: 'Less time at the gym' }, later);
  draft = renameDay(draft, 'A', 'Push and arms', later);
  draft = moveDay(draft, 'A', 1, later);
  const lines = programDiff(old, draft);
  assert.ok(lines.some((l) => l.text.en.includes('Reason for change')));
  assert.ok(lines.some((l) => l.text.en.includes('Push and arms')));
  assert.ok(lines.some((l) => l.text.en.includes('day order')));
  const saved = commitProgram(old, draft, later);
  assert.equal(saved.archived.active, false);
  assert.notEqual(saved.program.id, old.id);
  assert.equal(saved.program.pivotReason, 'Less time at the gym');
  assert.deepEqual(old, before);
});

test('canonical lower-body exclusions survive upper-to-custom and legacy legs aliases', () => {
  let p = buildPersonalProgram({ bodyScope: 'upper', excludedGroups: ['biceps'], now: NOW });
  for (const g of ['quads', 'hamstrings', 'adductors', 'glutes', 'calves']) assert.ok(p.preferences.excludedGroups.includes(g), g);
  assert.equal(p.preferences.excludedGroups.includes('legs'), false, 'persist actual catalog ids');
  p = setPlanPreferences(p, { bodyScope: 'custom' }, later);
  for (const id of ['leg-press-45', 'seated-leg-curl', 'hip-adduction-machine', 'farmers-carry']) {
    const ex = exerciseById(id);
    assert.ok(ex, `catalog fixture exists: ${id}`);
    assert.equal(exerciseAllowed(p, ex), false, id);
    assert.equal(addSlot(p, 'A', id, later), p, id);
  }
  p = resetToTemplate('owner-3day-upper', 'strength', 3, later, { from: p });
  assertScope(p);
  assert.ok(!slots(p).some((s) => s.exerciseId === 'farmers-carry'));
  const legacy = buildPersonalProgram({ bodyScope: 'custom', excludedGroups: ['legs'], now: NOW });
  assert.equal(exerciseAllowed(legacy, exerciseById('leg-press-45')), false);
  assert.equal(exerciseAllowed(legacy, exerciseById('farmers-carry')), false);
  assert.ok(legacy.preferences.excludedGroups.includes('quads'));
});

test('explicit full transition releases every canonical lower-body exclusion; partial exclusions remain selective', () => {
  const lower = ['quads', 'hamstrings', 'adductors', 'glutes', 'calves'];
  let p = buildPersonalProgram({ bodyScope: 'upper', excludedGroups: ['biceps'], now: NOW });
  p = setPlanPreferences(p, { bodyScope: 'full', excludedGroups: p.preferences.excludedGroups.filter((g) => !lower.includes(g)) }, later);
  assert.equal(exerciseAllowed(p, exerciseById('leg-press-45')), true);
  assert.ok(p.preferences.excludedGroups.includes('biceps'));
  const partial = buildPersonalProgram({ bodyScope: 'custom', excludedGroups: ['quads'], now: NOW });
  assert.equal(exerciseAllowed(partial, exerciseById('leg-press-45')), false);
  assert.equal(exerciseAllowed(partial, exerciseById('seated-leg-curl')), true);
});
