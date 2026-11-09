// Stream 05 — gym profiles (src/lib/fitness/gyms-core.mjs and src/lib/fitness/gyms.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import registry from '../../content/fitness/registry.json' with { type: 'json' };
import * as core from '../../src/lib/fitness/gyms-core.mjs';
import {
  GYM_CATALOG, GYM_EXERCISES, INCREMENT_CHOICES, QUICK_TYPES, STACK_EQUIPMENT, baseIncrement, effectiveAvailability,
  effectiveIncrement, gymSummary, hasStack, incrementChoices, isAvailableAt, isChecklist, newGym, nextMark, planAtGym,
  planDiff, preferForSlot, presentTypes, previewDays, quickSetup, renameGym, resolveSlot, setAvailability, setChecklist,
  setIncrement, setNotes, setPreferred, slotChoices, typePresent,
} from '../../src/lib/fitness/gyms.mjs';
import { planSession, resolveExercise } from '../../src/lib/fitness/session.mjs';
import { buildProgram, withLegs } from '../../src/lib/fitness/templates.mjs';
import { incrementFor } from '../../src/lib/fitness/progression.mjs';
import { EXERCISES, exerciseById, groupsOf, isAvailable } from '../../src/lib/fitness/catalog.mjs';
import { EQUIPMENT } from '../../src/lib/fitness/catalog-core.mjs';
import { isRow, isUuid, remoteProblem } from '../../src/lib/fitness/store-core.mjs';

const T0 = '2026-11-08T10:00:00.000Z';
const T1 = '2026-11-08T10:01:00.000Z';
const T2 = '2026-11-08T10:02:00.000Z';
const T3 = '2026-11-08T10:03:00.000Z';
const IDS = EXERCISES.map((e) => e.id);
const PROGRAM = buildProgram({ id: 'p3', now: T0 });
const PROGRAMS = [
  buildProgram({ id: 'p2', daysPerWeek: 2, now: T0 }),
  PROGRAM,
  buildProgram({ id: 'p4', daysPerWeek: 4, now: T0 }),
  withLegs(buildProgram({ id: 'p3l', now: T0 }), T0, { id: 'p3l2' }),
];
const slotsOf = (program) => program.days.flatMap((d) => d.slots);
const slot = (id) => slotsOf(PROGRAM).find((s) => s.slotId === id);
const gym = (o = {}) => ({ id: '0b6f3c1e-2d4a-4c8b-9e1f-5a6b7c8d9e0f', name: 'Test gym', available: [], missing: [], preferred: {}, updatedAt: T0, ...o });
const byType = (type) => EXERCISES.filter((e) => e.equipment === type).map((e) => e.id);

/** Freeze deeply so any mutation of an input throws (ES modules are strict). */
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) frozen(v);
    Object.freeze(value);
  }
  return value;
}

/** Small seeded PRNG (mulberry32) so random gyms are reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random gym: everything-assumed or checklist, random missing marks and preferences (some stale or bogus). */
function randomGym(rand, program = PROGRAM) {
  const pickFrom = (list) => list[Math.floor(rand() * list.length)];
  const checklist = rand() < 0.4;
  const available = checklist ? IDS.filter(() => rand() < 0.7) : [];
  const missing = IDS.filter(() => rand() < 0.25);
  const preferred = {};
  const slots = slotsOf(program);
  const n = Math.floor(rand() * 6);
  for (let i = 0; i < n; i += 1) {
    const s = pickFrom(slots);
    const key = rand() < 0.5 ? s.slotId : s.exerciseId;
    const roll = rand();
    preferred[key] = roll < 0.6 ? pickFrom(exerciseById(s.exerciseId)?.alternatives ?? IDS) : roll < 0.9 ? pickFrom(IDS) : pickFrom(['', 'not-an-exercise']);
  }
  const increments = {};
  if (rand() < 0.5) increments[pickFrom(IDS)] = pickFrom([1.25, 2.5, 5]);
  if (rand() < 0.3) increments[pickFrom(EQUIPMENT.map((e) => e.id))] = pickFrom([2.5, 4, 5]);
  return gym({ available, missing, preferred, increments });
}

/* ------------------------------------------------------------------ rows */

test('newGym makes a row the store accepts and uploads', () => {
  const g = newGym('  Gym   near home ', T0);
  assert.ok(isUuid(g.id));
  assert.equal(g.name, 'Gym near home');
  assert.deepEqual([g.available, g.missing, g.preferred, g.updatedAt], [[], [], {}, T0]);
  assert.ok(isRow('gyms', g));
  assert.equal(remoteProblem('gyms', g), null);
  assert.equal(newGym('   ', T0).name, 'Gym');
  assert.equal(newGym('x'.repeat(200), T0).name.length, 60);
  assert.equal(newGym('Hotel', T0, 'fixed-id').id, 'fixed-id');
  assert.notEqual(newGym('a').id, newGym('a').id);
});

test('renameGym and setNotes clean the text and return the same gym when nothing changes', () => {
  const g = frozen(gym());
  const r = renameGym(g, ' Hotel   gym ', T1);
  assert.deepEqual([r.name, r.updatedAt], ['Hotel gym', T1]);
  assert.equal(renameGym(g, 'Test gym', T1), g);
  assert.equal(renameGym(g, '   ', T1), g, 'an empty name is refused');
  const n = setNotes(g, 'Open 6–23. Pec deck often busy.', T1);
  assert.equal(n.notes, 'Open 6–23. Pec deck often busy.');
  assert.equal(setNotes(n, 'Open 6–23. Pec deck often busy.', T2), n);
  const cleared = setNotes(n, '  \n ', T2);
  assert.equal('notes' in cleared, false);
  assert.equal(cleared.updatedAt, T2);
  assert.equal(setNotes(g, '', T1), g);
  assert.equal(setNotes(g, 'x'.repeat(5000), T1).notes.length, 2000);
});

/* ------------------------------------------------------------------ availability */

test('without a checklist, missing ⇄ here; "has" and "unknown" are the same stored state', () => {
  const g0 = frozen(gym());
  const g1 = setAvailability(g0, 'pec-deck', 'missing', T1);
  assert.deepEqual([g1.missing, g1.available, g1.updatedAt], [['pec-deck'], [], T1]);
  assert.equal(setAvailability(g1, 'pec-deck', 'missing', T2), g1, 'same mark → same object');
  assert.deepEqual(effectiveAvailability(g1, 'pec-deck'), { mark: 'missing', available: false, assumed: false });
  assert.deepEqual(effectiveAvailability(g1, 'cable-fly'), { mark: 'unknown', available: true, assumed: true });
  const has = setAvailability(frozen(g1), 'pec-deck', 'has', T2);
  assert.deepEqual([has.missing, has.available], [[], []], 'an empty available list stays empty (everything assumed)');
  assert.deepEqual(setAvailability(frozen(g1), 'pec-deck', 'unknown', T2), has);
  assert.equal(setAvailability(g0, 'pec-deck', 'has', T1), g0);
  assert.equal(nextMark(g0, 'pec-deck'), 'missing');
  assert.equal(nextMark(g1, 'pec-deck'), 'has');
  assert.equal(nextMark(null, 'pec-deck'), 'missing');
  assert.throws(() => setAvailability(g0, 'pec-deck', 'maybe', T1), TypeError);
  assert.throws(() => setAvailability(g0, '', 'missing', T1), TypeError);
});

test('a checklist has three distinct states, and the list never empties (empty would mean everything)', () => {
  const g0 = frozen(gym({ available: ['pec-deck', 'cable-fly'] }));
  assert.ok(isChecklist(g0));
  const g1 = setAvailability(g0, 'lat-pulldown', 'has', T1);
  assert.deepEqual(g1.available, ['pec-deck', 'cable-fly', 'lat-pulldown']);
  assert.deepEqual(effectiveAvailability(g1, 'lat-pulldown'), { mark: 'has', available: true, assumed: false });
  assert.deepEqual(effectiveAvailability(g1, 'machine-row'), { mark: 'unknown', available: false, assumed: false });
  const g2 = setAvailability(g1, 'pec-deck', 'missing', T2);
  assert.deepEqual([g2.available, g2.missing], [['cable-fly', 'lat-pulldown'], ['pec-deck']]);
  const g3 = setAvailability(setAvailability(g2, 'cable-fly', 'unknown', T3), 'pec-deck', 'unknown', T3);
  assert.deepEqual([g3.available, g3.missing], [['lat-pulldown'], []]);
  // the last ticked exercise: unticking keeps it listed and marks it missing, so nothing counts as available
  const last = setAvailability(g3, 'lat-pulldown', 'missing', T3);
  assert.deepEqual([last.available, last.missing], [['lat-pulldown'], ['lat-pulldown']]);
  assert.equal(isAvailableAt(last, 'lat-pulldown'), false);
  assert.equal(IDS.some((id) => isAvailableAt(last, id)), false);
  assert.deepEqual(setAvailability(g3, 'lat-pulldown', 'unknown', T3).available, ['lat-pulldown']);
  assert.equal(isAvailableAt(setAvailability(g3, 'lat-pulldown', 'unknown', T3), 'lat-pulldown'), false);
  // chip cycle: has → missing → unknown → has; the last listed one goes straight back to has
  assert.equal(nextMark(g1, 'lat-pulldown'), 'missing');
  assert.equal(nextMark(g2, 'pec-deck'), 'unknown');
  assert.equal(nextMark(g1, 'machine-row'), 'has');
  assert.equal(nextMark(last, 'lat-pulldown'), 'has');
  assert.equal(effectiveAvailability(setAvailability(last, 'lat-pulldown', 'has', T3), 'lat-pulldown').mark, 'has');
});

test('isAvailableAt and effectiveAvailability agree with catalog.isAvailable on random gyms', () => {
  const rand = rng(7);
  for (let i = 0; i < 60; i += 1) {
    const g = randomGym(rand);
    for (const id of IDS) {
      assert.equal(isAvailableAt(g, id), isAvailable(id, g), `${id}`);
      assert.equal(effectiveAvailability(g, id).available, isAvailable(id, g), `${id}`);
    }
  }
  assert.equal(isAvailableAt(null, 'pec-deck'), true);
});

test('setChecklist on keeps the plan as it was; off counts unmarked machines as here again and keeps missing', () => {
  const g0 = frozen(setAvailability(setAvailability(gym(), 'pec-deck', 'missing', T1), 'lat-pulldown', 'missing', T1));
  const on = setChecklist(g0, true, T2);
  assert.ok(isChecklist(on));
  assert.equal(on.available.length, IDS.length - 2);
  const ids = (g) => slotsOf(PROGRAM).map((s) => resolveSlot(s, g));
  assert.deepEqual(ids(on), ids(g0));
  for (const id of IDS) assert.equal(isAvailableAt(on, id), isAvailableAt(g0, id), id);
  assert.equal(setChecklist(on, true, T3), on);
  const unsure = setAvailability(on, 'cable-fly', 'unknown', T3);
  assert.equal(isAvailableAt(unsure, 'cable-fly'), false);
  const off = setChecklist(unsure, false, T3);
  assert.deepEqual([off.available, off.missing], [[], ['pec-deck', 'lat-pulldown']]);
  assert.equal(isAvailableAt(off, 'cable-fly'), true);
  assert.equal(setChecklist(off, false, T3), off);
  const allMissing = setChecklist(gym({ missing: [...IDS] }), true, T1);
  assert.equal(allMissing.available.length, IDS.length);
  assert.equal(IDS.some((id) => isAvailableAt(allMissing, id)), false, 'everything missing stays nothing here');
  assert.equal(core.setChecklist(g0, true, T1, core.gymCatalog([])), g0, 'empty catalog: no change');
});

/* ------------------------------------------------------------------ quick setup */

test('QUICK_TYPES covers every equipment type except bodyweight, in catalog-core order', () => {
  const ids = QUICK_TYPES.map((t) => t.id);
  assert.deepEqual([...ids].sort(), EQUIPMENT.map((e) => e.id).filter((id) => id !== 'bodyweight').sort());
  for (const type of new Set(EXERCISES.map((e) => e.equipment))) {
    if (type !== 'bodyweight') assert.ok(ids.includes(type), type);
  }
  for (const t of QUICK_TYPES) assert.ok(t.name.en && t.name.ru, t.id);
});

test('quickSetup marks unticked types missing, restores a re-ticked type and never touches bodyweight', () => {
  const g0 = frozen(gym());
  assert.deepEqual(presentTypes(g0), QUICK_TYPES.map((t) => t.id));
  const q1 = quickSetup(g0, ['dumbbell', 'cable'], T1);
  for (const e of EXERCISES) {
    const expected = e.equipment === 'dumbbell' || e.equipment === 'cable' || e.equipment === 'bodyweight';
    assert.equal(isAvailableAt(q1, e.id), expected, e.id);
  }
  assert.deepEqual(presentTypes(q1), ['cable', 'dumbbell']);
  assert.equal(quickSetup(q1, ['cable', 'dumbbell'], T2), q1, 'idempotent');
  // individual marks of a type that stays ticked are kept
  const q2 = setAvailability(q1, 'cable-fly', 'missing', T2);
  const q3 = quickSetup(q2, ['dumbbell', 'cable', 'selectorized'], T3);
  for (const id of byType('selectorized')) assert.equal(isAvailableAt(q3, id), true, id);
  assert.equal(isAvailableAt(q3, 'cable-fly'), false);
  // a type ticked again after being absent comes back whole
  const q4 = quickSetup(quickSetup(q3, ['dumbbell', 'selectorized'], T3), ['dumbbell', 'selectorized', 'cable'], T3);
  for (const id of byType('cable')) assert.equal(isAvailableAt(q4, id), true, id);
  // nothing ticked: only bodyweight exercises remain
  const none = quickSetup(g0, [], T1);
  for (const e of EXERCISES) assert.equal(isAvailableAt(none, e.id), e.equipment === 'bodyweight', e.id);
  assert.equal(typePresent(none, 'bodyweight'), true);
  assert.equal(core.typePresent(none, 'dumbbell', core.gymCatalog([])), true, 'a type with no exercises counts as present');
});

test('quickSetup in a checklist ticks the exercises of a restored type', () => {
  const g0 = frozen(gym({ available: ['pec-deck', 'lat-pulldown'] }));
  assert.equal(typePresent(g0, 'dumbbell'), false);
  const q = quickSetup(g0, ['selectorized', 'dumbbell'], T1);
  for (const id of byType('dumbbell')) assert.ok(q.available.includes(id), id);
  assert.ok(q.available.includes('pec-deck'));
  assert.equal(isAvailableAt(q, 'cable-fly'), false, 'cables were unticked');
  assert.ok(q.missing.includes('cable-fly'));
  // unticking everything that is listed keeps the checklist non-empty and nothing available
  const empty = quickSetup(gym({ available: byType('dumbbell') }), [], T1);
  assert.ok(empty.available.length > 0);
  assert.equal(IDS.some((id) => isAvailableAt(empty, id)), false);
});

/* ------------------------------------------------------------------ preferences and increments */

test('setPreferred and preferForSlot store the choice under the slot exercise and clear a shadowing slot key', () => {
  const g0 = frozen(gym({ preferred: { A1: 'plate-loaded-chest-press' } }));
  const a1 = slot('A1');
  const g1 = preferForSlot(g0, a1, 'converging-chest-press', T1);
  assert.deepEqual(g1.preferred, { 'machine-chest-press': 'converging-chest-press' });
  assert.equal(resolveExercise(a1, g1), 'converging-chest-press');
  assert.equal(preferForSlot(g1, a1, 'converging-chest-press', T2), g1);
  const auto = preferForSlot(g1, a1, null, T2);
  assert.deepEqual([auto.preferred, auto.updatedAt], [{}, T2]);
  assert.deepEqual(preferForSlot(g1, a1, 'machine-chest-press', T2).preferred, {}, 'the slot exercise itself = automatic');
  const g2 = setPreferred(g0, 'lat-pulldown', 'neutral-grip-pulldown', T1);
  assert.deepEqual(g2.preferred, { A1: 'plate-loaded-chest-press', 'lat-pulldown': 'neutral-grip-pulldown' });
  assert.equal(setPreferred(g2, 'lat-pulldown', 'neutral-grip-pulldown', T2), g2);
  assert.deepEqual(setPreferred(g2, 'A1', '', T2).preferred, { 'lat-pulldown': 'neutral-grip-pulldown' });
  assert.equal(setPreferred(g0, 'B1', null, T1), g0);
  assert.throws(() => setPreferred(g0, '', 'x', T1), TypeError);
});

test('setIncrement and effectiveIncrement mirror progression.incrementFor', () => {
  const g0 = frozen(gym());
  const g1 = setIncrement(g0, 'lat-pulldown', 2.499, T1);
  assert.deepEqual([g1.increments, g1.updatedAt], [{ 'lat-pulldown': 2.5 }, T1]);
  assert.equal(setIncrement(g1, 'lat-pulldown', 2.5, T2), g1);
  for (const bad of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const cleared = setIncrement(g1, 'lat-pulldown', bad, T2);
    assert.equal('increments' in cleared, false, String(bad));
  }
  assert.equal(setIncrement(g0, 'lat-pulldown', null, T1), g0);
  const two = setIncrement(setIncrement(g1, 'pec-deck', 5, T2), 'lat-pulldown', null, T3);
  assert.deepEqual(two.increments, { 'pec-deck': 5 });
  assert.throws(() => setIncrement(g0, '', 5, T1), TypeError);
  const rand = rng(11);
  for (let i = 0; i < 40; i += 1) {
    const g = randomGym(rand);
    for (const e of EXERCISES) assert.equal(effectiveIncrement(g, e), incrementFor(e, g), `${e.id}`);
  }
  assert.equal(effectiveIncrement(null, exerciseById('lat-pulldown')), 5);
  const lat = exerciseById('lat-pulldown');
  assert.deepEqual(incrementChoices(null, lat), [2.5, 5]);
  const typeWide = gym({ increments: { selectorized: 4 } });
  assert.equal(baseIncrement(typeWide, lat), 4);
  assert.deepEqual(incrementChoices(typeWide, lat), [2.5, 4, 5]);
  assert.deepEqual([...INCREMENT_CHOICES], [2.5, 5]);
});

test('weight steps cover every weight-stack exercise the owner program uses', () => {
  assert.deepEqual([...STACK_EQUIPMENT], ['selectorized', 'cable', 'assisted']);
  const stacked = [...new Set(slotsOf(PROGRAM).map((s) => s.exerciseId))].filter((id) => hasStack(exerciseById(id)));
  for (const id of ['machine-chest-press', 'lat-pulldown', 'seated-cable-row', 'cable-fly', 'assisted-pull-up']) assert.ok(stacked.includes(id), id);
  for (const id of ['hammer-curl', 'farmers-carry', 'captains-chair-knee-raise']) assert.equal(hasStack(exerciseById(id)), false, id);
  assert.equal(hasStack(undefined), false);
  for (const id of stacked) {
    const ex = exerciseById(id);
    const choices = incrementChoices(null, ex);
    assert.ok(choices.includes(ex.increment) && choices.includes(2.5) && choices.includes(5), `${id}: ${choices}`);
  }
});

/* ------------------------------------------------------------------ the plan at a gym */

test('resolveSlot is session.resolveExercise for every template slot at 300 random gyms', () => {
  const rand = rng(2026);
  let compared = 0;
  for (let i = 0; i < 300; i += 1) {
    const program = PROGRAMS[i % PROGRAMS.length];
    const g = randomGym(rand, program);
    for (const s of slotsOf(program)) {
      assert.equal(resolveSlot(s, g), resolveExercise(s, g), `${program.id} ${s.slotId} gym #${i}`);
      compared += 1;
    }
  }
  assert.ok(compared > 5000);
  for (const s of slotsOf(PROGRAM)) assert.equal(resolveSlot(s, null), s.exerciseId);
});

test('every slot choice is a preference the planner accepts; anything else is ignored', () => {
  const rand = rng(99);
  for (let i = 0; i < 40; i += 1) {
    const g = randomGym(rand);
    for (const s of slotsOf(PROGRAM)) {
      const choices = slotChoices(s, g);
      if (isAvailableAt(g, s.exerciseId)) assert.equal(choices[0], s.exerciseId);
      for (const c of choices) {
        assert.ok(isAvailableAt(g, c));
        assert.equal(resolveExercise(s, preferForSlot(g, s, c, T1)), c, `${s.slotId} → ${c}`);
      }
    }
  }
  const a1 = slot('A1');
  const choices = slotChoices(a1, null);
  assert.ok(choices.includes('barbell-bench-press'), 'class mates count, not only listed alternatives');
  assert.equal(choices.includes('lat-pulldown'), false);
  assert.equal(resolveExercise(a1, preferForSlot(gym(), a1, 'lat-pulldown', T1)), 'machine-chest-press', 'an unfitting preference is ignored');
});

test('planAtGym marks plan, swapped, preferred and stuck slots and counts them', () => {
  const plain = planAtGym(PROGRAM, null);
  assert.ok(plain.days.length === 3 && plain.days.every((d) => d.slots.every((s) => s.status === 'plan')));
  assert.deepEqual([plain.changed, plain.stuck], [0, 0]);
  assert.deepEqual(plain.days[0].name, PROGRAM.days[0].name);

  const noPecDeck = setAvailability(gym(), 'pec-deck', 'missing', T1);
  const swapped = planAtGym(PROGRAM, noPecDeck).days[0].slots.find((s) => s.slotId === 'A3');
  assert.deepEqual([swapped.exerciseId, swapped.status, swapped.programAvailable], ['cable-fly', 'swapped', false]);

  const preferred = preferForSlot(noPecDeck, slot('A1'), 'converging-chest-press', T2);
  const p = planAtGym(PROGRAM, preferred);
  const a1 = p.days[0].slots[0];
  assert.deepEqual([a1.exerciseId, a1.status, a1.preference, a1.preferenceIgnored], ['converging-chest-press', 'preferred', 'converging-chest-press', false]);
  assert.equal(p.changed, 2);

  let stuckGym = noPecDeck;
  for (const id of exerciseById('pec-deck').alternatives) stuckGym = setAvailability(stuckGym, id, 'missing', T2);
  const stuck = planAtGym(PROGRAM, stuckGym);
  const a3 = stuck.days[0].slots.find((s) => s.slotId === 'A3');
  assert.deepEqual([a3.exerciseId, a3.status, a3.choices], ['pec-deck', 'stuck', []]);
  // cable fly (B4) is one of those alternatives, and its own alternatives are the same flies: stuck too
  const b4 = stuck.days[1].slots.find((s) => s.slotId === 'B4');
  assert.deepEqual([b4.exerciseId, b4.status], ['cable-fly', 'stuck']);
  assert.equal(stuck.stuck, 2);

  const stale = planAtGym(PROGRAM, gym({ preferred: { 'machine-chest-press': 'lat-pulldown' } })).days[0].slots[0];
  assert.deepEqual([stale.status, stale.preference, stale.preferenceIgnored], ['plan', 'lat-pulldown', true]);
  const gone = planAtGym(PROGRAM, gym({ preferred: { A1: 'converging-chest-press' }, missing: ['converging-chest-press'] })).days[0].slots[0];
  assert.deepEqual([gone.status, gone.preferenceIgnored], ['plan', true]);
  assert.deepEqual(planAtGym(null, null), { days: [], changed: 0, stuck: 0 });
});

test('planAtGym shows what planSession plans at the same gym', () => {
  const rand = rng(5);
  for (let i = 0; i < 12; i += 1) {
    const g = randomGym(rand);
    const plan = planAtGym(PROGRAM, g);
    for (const day of PROGRAM.days) {
      const planned = planSession({ program: PROGRAM, dayKey: day.key, gym: g, now: T1 }).exercises.map((e) => e.exerciseId);
      assert.deepEqual(plan.days.find((d) => d.key === day.key).slots.map((s) => s.exerciseId), planned, `day ${day.key} gym #${i}`);
    }
  }
});

test('planDiff lists exactly the slots that change between two gyms', () => {
  const noPecDeck = setAvailability(gym(), 'pec-deck', 'missing', T1);
  assert.deepEqual(planDiff(PROGRAM, null, noPecDeck), [{ dayKey: 'A', slotId: 'A3', programExerciseId: 'pec-deck', from: 'pec-deck', to: 'cable-fly' }]);
  assert.deepEqual(planDiff(PROGRAM, noPecDeck, null), [{ dayKey: 'A', slotId: 'A3', programExerciseId: 'pec-deck', from: 'cable-fly', to: 'pec-deck' }]);
  assert.deepEqual(planDiff(PROGRAM, noPecDeck, noPecDeck), []);
  const rand = rng(3);
  for (let i = 0; i < 30; i += 1) {
    const a = randomGym(rand);
    const b = randomGym(rand);
    const diff = planDiff(PROGRAM, a, b);
    const expected = slotsOf(PROGRAM).filter((s) => resolveExercise(s, a) !== resolveExercise(s, b)).map((s) => s.slotId);
    assert.deepEqual(diff.map((d) => d.slotId), expected);
  }
  assert.deepEqual(planDiff(undefined, null, noPecDeck), []);
});

test('gymSummary counts marks and plan changes for the gym cards', () => {
  const noPecDeck = setAvailability(gym(), 'pec-deck', 'missing', T1);
  assert.deepEqual(gymSummary(noPecDeck, PROGRAM), { checklist: false, here: IDS.length - 1, missing: 1, unknown: 0, changed: 1, stuck: 0 });
  const list = gym({ available: ['pec-deck', 'cable-fly', 'lat-pulldown'], missing: ['cable-fly', 'not-in-catalog'] });
  const s = gymSummary(list, PROGRAM);
  assert.deepEqual([s.checklist, s.here, s.missing, s.unknown], [true, 2, 1, IDS.length - 3]);
  assert.ok(s.changed > 0);
  assert.deepEqual(gymSummary(gym(), null), { checklist: false, here: IDS.length, missing: 0, unknown: 0, changed: 0, stuck: 0 });
});

/* ------------------------------------------------------------------ data for the client */

test('GYM_EXERCISES is a trimmed copy of the catalog with registry classes and coarse groups', () => {
  assert.equal(GYM_EXERCISES.length, EXERCISES.length);
  const groups = new Set([...registry.groups.map((g) => g.id), 'other']);
  for (const row of GYM_EXERCISES) {
    const ex = exerciseById(row.id);
    assert.ok(ex, row.id);
    assert.deepEqual(row.name, { en: ex.name.en, ru: ex.name.ru });
    assert.equal(row.equipment, ex.equipment);
    assert.equal(row.increment, ex.increment);
    assert.deepEqual(row.alternatives, ex.alternatives);
    assert.deepEqual(row.classes, registry.exercises[row.id].classes);
    assert.equal(row.group, groupsOf(row.id)[0] ?? 'other');
    assert.ok(groups.has(row.group), `${row.id} group ${row.group}`);
    for (const heavy of ['cues', 'mistakes', 'setup', 'sources', 'images', 'startLoad']) assert.equal(heavy in row, false, `${row.id}.${heavy}`);
  }
  assert.ok(JSON.stringify(GYM_EXERCISES).length < 80_000, 'small enough to hand to the client');
  assert.equal(GYM_CATALOG.exerciseById('pec-deck')?.equipment, 'selectorized');
});

test('previewDays are the slots buildProgram makes for 2, 3 and 4 days', () => {
  for (const days of [2, 3, 4]) {
    const program = buildProgram({ daysPerWeek: days, id: 'x', now: T0 });
    assert.deepEqual(previewDays(days), program.days.map((d) => ({ key: d.key, name: d.name, slots: d.slots.map((s) => ({ slotId: s.slotId, exerciseId: s.exerciseId })) })));
  }
  assert.deepEqual(previewDays().map((d) => d.key), ['A', 'B', 'C']);
});

test('every operation keeps a valid, uploadable row and never mutates its input', () => {
  let g = frozen(newGym('Flow', T0));
  const steps = [
    (x) => quickSetup(x, ['selectorized', 'cable', 'dumbbell'], T1),
    (x) => setAvailability(x, 'pec-deck', 'missing', T1),
    (x) => preferForSlot(x, slot('A1'), 'converging-chest-press', T1),
    (x) => setIncrement(x, 'machine-lateral-raise', 2.5, T1),
    (x) => setNotes(x, 'Busy after 18:00', T1),
    (x) => setChecklist(x, true, T2),
    (x) => setAvailability(x, 'cable-fly', 'unknown', T2),
    (x) => setChecklist(x, false, T3),
    (x) => renameGym(x, 'Flow gym', T3),
  ];
  for (const step of steps) {
    g = frozen(step(g));
    assert.ok(isRow('gyms', g));
    assert.equal(remoteProblem('gyms', g), null);
  }
  assert.equal(g.name, 'Flow gym');
  assert.equal(g.updatedAt, T3);
  assert.deepEqual(JSON.parse(JSON.stringify(g)), g, 'JSON round trip (jsonb spec column)');
});
