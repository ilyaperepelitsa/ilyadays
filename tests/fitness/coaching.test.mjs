import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exerciseById } from '../../src/lib/fitness/catalog.mjs';
import { buildRows, logPlannedSet, nextSetAdvice, setEffortCoaching } from '../../src/lib/fitness/tracker.mjs';
import { nextState } from '../../src/lib/fitness/progression.mjs';
import { params, state } from './engine-fixtures.mjs';

const NOW = '2026-11-10T18:00:00.000Z';
const exercise = exerciseById('plate-loaded-chest-press');
const target = { kind: 'working', weightKg: 60, reps: 10, rir: 2 };
const plan = { slotId: 'A1', exerciseId: exercise.id, programExerciseId: exercise.id, sets: [target, target, target], repRange: [6, 15], loadStep: 2.5, restSec: 120, alternatives: [] };
const logged = (index, reps, rir, reported = true) => logPlannedSet({ session: { id: 'coaching-session' }, planned: target, exerciseId: exercise.id, slotId: plan.slotId, index, now: NOW, overrides: { reps, rir }, prescription: { version: 1, targetRir: 2, rirReported: reported, suggestedKg: 60, suggestedReps: 10 } });

test('15 as an absolute maximum differs from 15 completed with the target reserve', () => {
  const maximum = setEffortCoaching(target, exercise, { reps: 15, rir: 0, rirReported: true });
  const extraReserve = setEffortCoaching(target, exercise, { reps: 10, rir: 5, rirReported: true });
  const comfortable = setEffortCoaching(target, exercise, { reps: 15, rir: 2, rirReported: true });
  assert.equal(maximum.estimatedRepsAtTarget, 13);
  assert.equal(extraReserve.estimatedRepsAtTarget, 13);
  assert.equal(comfortable.estimatedRepsAtTarget, 15);
  assert.match(maximum.example.en, /absolute maximum.*13/);
  assert.match(maximum.example.ru, /абсолютный максимум.*13/);
  assert.match(maximum.guidance.en, /do not need to train to failure/);
});

test('15 actual reps retain the original target of 10 and completed rows stay intact', () => {
  const actual = logged(0, 15, 2);
  const rows = buildRows(plan, [actual]);
  assert.equal(actual.reps, 15);
  assert.equal(actual.plannedReps, 10);
  assert.equal(rows.working[0].planned.reps, 10);
  assert.deepEqual(rows.working[0].logged, actual);
  assert.equal(setEffortCoaching(target, exercise, actual).estimatedRepsAtTarget, 15);
});

test('only explicitly reported easy work earns a modest same-weight rep suggestion', () => {
  const easy = nextSetAdvice(plan, logged(0, 10, 5), target);
  assert.deepEqual(easy, { suggest: { kg: 60, reps: 11, rir: 2 }, reason: 'easy' });
  for (const actual of [logged(0, 10, 5, false), { ...logged(0, 10, 5), prescription: undefined }, logged(0, 10, 2)]) {
    const advice = nextSetAdvice(plan, actual, target);
    assert.deepEqual(advice.suggest, { kg: 60, reps: 10, rir: 2 });
    assert.notEqual(advice.reason, 'easy');
  }
  assert.equal(setEffortCoaching(target, exercise, logged(0, 10, 5, false)).estimatedRepsAtTarget, null);
  const capped = nextSetAdvice({ ...plan, repRange: [6, 10] }, logged(0, 15, 5), target);
  assert.equal(capped.suggest.reps, 10, 'already at the range ceiling: no arbitrary extra rep target');
  assert.equal(capped.suggest.kg, 60);
});

test('a later easy set cannot erase earlier missed work or earn a heavier next visit', () => {
  const missed = logged(0, 8, 0);
  const easy = logged(1, 10, 5);
  const rows = buildRows(plan, [missed, easy]);
  assert.equal(rows.working[2].suggest.reps, 10);
  assert.notEqual(rows.working[2].adaptation, 'easy');
  const complete = [...[missed, easy], logged(2, 15, 2)];
  for (const rule of ['double', 'rpe', 'linear']) {
    const next = nextState(state({ exerciseId: exercise.id, workingKg: 60, targetReps: 10, repRange: [6, 15] }), complete, params({ repRange: [6, 15], rule }), exercise, NOW, { plannedSets: 3 });
    assert.ok(next.state.workingKg <= 60, rule);
  }
});

test('warm-ups, holds and carries do not receive rep-capacity arithmetic or easy rep boosts', () => {
  const warm = { ...target, kind: 'warmup' };
  const warmCoaching = setEffortCoaching(warm, exercise, { reps: 10, rir: 5, rirReported: true });
  assert.equal(warmCoaching.estimatedRepsAtTarget, null);
  assert.equal(warmCoaching.example, undefined);
  assert.notEqual(nextSetAdvice(plan, { ...logged(0, 10, 5), kind: 'warmup' }, warm).reason, 'easy');
  for (const id of ['plank', 'farmers-carry']) {
    const timed = exerciseById(id);
    const prescription = { ...target, reps: 30 };
    const actual = { ...logged(0, 30, 5), plannedReps: 30 };
    const guidance = setEffortCoaching(prescription, timed, actual);
    assert.equal(guidance.estimatedRepsAtTarget, null);
    assert.equal(guidance.example, undefined);
    assert.match(guidance.guidance.en, id === 'plank' ? /seconds/ : /distance/);
    assert.notEqual(nextSetAdvice({ ...plan, exerciseId: id, repRange: [20, 45] }, actual, prescription).reason, 'easy');
  }
});
