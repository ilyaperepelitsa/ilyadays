import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextState } from '../../src/lib/fitness/progression.mjs';
import { fx, state, params, sets, set } from './engine-fixtures.mjs';

const NOW = '2026-11-10T18:00:00.000Z';
const ex = fx('plate-loaded-chest-press', { equipment: 'plate-loaded', increment: 2.5 });
const before = (o = {}) => state({ exerciseId: ex.id, workingKg: 60, targetReps: 10, ...o });
const work = (kg, reps, rir = 2) => sets(kg, reps, rir, { exerciseId: ex.id, plannedKg: 60, plannedReps: 10 });

test('an incomplete first calibration cannot earn a heavier next visit', () => {
  const r = nextState(before({ sessions: 0, targetReps: 6 }), work(60, [10]), params(), ex, NOW, { plannedSets: 4 });
  assert.equal(r.state.workingKg, 60);
  assert.equal(r.outcome, 'held');
});

test('missed intended reps cannot increase load under any progression rule', () => {
  for (const rule of ['double', 'linear', 'rpe', 'rep-target']) {
    const log = work(60, [10, 8, 8]);
    log[1].rir = 0;
    log[2].rir = 0;
    const r = nextState(before(), log, params({ rule }), ex, NOW, { plannedSets: 3 });
    assert.ok(r.state.workingKg <= 60, rule);
  }
});

test('a failed heavier working attempt cannot be hidden by the modal load', () => {
  for (const rule of ['double', 'rpe']) {
    const log = [...work(60, [10, 10]), set({ exerciseId: ex.id, kg: 65, reps: 3, rir: 0, plannedKg: 60, plannedReps: 10, setIndex: 2 })];
    const r = nextState(before(), log, params({ rule }), ex, NOW, { plannedSets: 3 });
    assert.ok(r.state.workingKg <= 60, rule);
  }
});

test('a lighter failed working set during calibration is not a warm-up', () => {
  const log = [...work(60, [10, 10]), set({ exerciseId: ex.id, kg: 50, reps: 3, rir: 0, plannedKg: 60, plannedReps: 10, setIndex: 2 })];
  const r = nextState(before({ sessions: 0 }), log, params(), ex, NOW, { plannedSets: 3 });
  assert.ok(r.state.workingKg <= 60);
  assert.notEqual(r.outcome, 'progressed');
});

import { activePlan, adjustSet, buildRows, endSession, ensureProgram, logPlannedSet, nextSetAdvice, startSession } from '../../src/lib/fitness/tracker.mjs';
import { emptySnapshot, fromRemote, toRemote } from '../../src/lib/fitness/store-core.mjs';
import { planSession, applySession } from '../../src/lib/fitness/session.mjs';

const exerciseId = 'machine-chest-press';
const prescription = { slotId: 'A1', exerciseId, programExerciseId: exerciseId, sets: Array.from({ length: 3 }, () => ({ kind: 'working', weightKg: 20, reps: 10, rir: 2 })), restSec: 120, alternatives: [], repRange: [6, 10], loadStep: 5 };

test('20 kg × 8 is saved against 20 kg × 10; next suggestion is manageable and completed rows never change', () => {
  const actual = logPlannedSet({ session: { id: 'session-1' }, planned: prescription.sets[0], exerciseId, slotId: 'A1', index: 0, now: NOW, overrides: { reps: 8 } });
  assert.deepEqual([actual.plannedKg, actual.plannedReps, actual.kg, actual.reps], [20, 10, 20, 8]);
  const rows = buildRows(prescription, [actual]);
  assert.equal(rows.working[0].state, 'failed');
  assert.deepEqual(rows.working[1].suggest, { kg: 20, reps: 8, rir: 2 });
  assert.equal(rows.working[1].adaptation, 'repeat');
  assert.equal(rows.working[1].basedOnSetId, actual.id);
  assert.deepEqual(rows.working[0].logged, actual);
  const recovered = buildRows(prescription, [actual, { ...actual, id: 'second', setIndex: 1, reps: 10, doneAt: '2026-11-10T18:03:00.000Z' }]);
  assert.equal(recovered.working[2].suggest.reps, 10, 'a recovered set can return to the original rep target');
});

test('below-range or excessive-effort sets suggest one easier step, including assistance in the correct direction', () => {
  const target = prescription.sets[0];
  assert.deepEqual(nextSetAdvice(prescription, { kg: 20, reps: 4, rir: 0 }, target), { suggest: { kg: 15, reps: 6, rir: 2 }, reason: 'reduce' });
  const assisted = { ...prescription, exerciseId: 'assisted-pull-up' };
  assert.equal(nextSetAdvice(assisted, { kg: 40, reps: 3, rir: 0 }, target).suggest.kg, 45);
  assert.equal(nextSetAdvice(prescription, { kg: 5, reps: 3, rir: 0 }, target).suggest.kg, 5, 'no nonexistent zero stack');
  assert.equal(nextSetAdvice(prescription, { kg: 20, reps: 10, rir: 4 }, target).suggest.kg, 20, 'no automatic intra-session increase');
});

test('baseline confirmation needs complete work and reported effort; partial and unrated sessions remain provisional', () => {
  const initial = before({ sessions: 0, baseline: { status: 'learning' } });
  const complete = work(60, [10, 10, 10]);
  let r = nextState(initial, complete, params(), ex, NOW, { plannedSets: 3 });
  assert.equal(r.state.baseline.status, 'established');
  assert.equal(r.state.baseline.kg, 60);
  assert.equal(r.state.baseline.sessionId, complete[0].sessionId);
  r = nextState(initial, complete.slice(0, 1), params(), ex, NOW, { plannedSets: 3 });
  assert.equal(r.state.baseline.status, 'learning');
  assert.equal(r.state.sessions, 1);
  const unreported = complete.map((s) => ({ ...s, prescription: { version: 1, targetRir: 2, rirReported: false, suggestedKg: 60, suggestedReps: 10 } }));
  r = nextState(initial, unreported, params(), ex, NOW, { plannedSets: 3 });
  assert.equal(r.state.baseline.status, 'learning');
  assert.ok(r.state.workingKg <= 60, 'assumed effort cannot earn a heavier calibration');
});

test('frozen workout context and prescription provenance survive remote mappings and reloads', () => {
  const snapshot = emptySnapshot();
  const { program } = ensureProgram(snapshot, NOW);
  const plan = planSession({ program, dayKey: 'A', states: {}, now: NOW });
  const session = startSession({ program, dayKey: 'A', now: NOW, plan: { version: 1, program, gym: null, states: {}, prescription: plan } });
  const remote = toRemote('sessions', session).record;
  const restored = fromRemote('sessions', { ...remote, updated_at: NOW });
  assert.deepEqual(restored.plan, session.plan);
  const altered = { ...program, days: program.days.map((d) => ({ ...d, slots: [] })) };
  assert.deepEqual(activePlan({ snapshot, session: restored, program: altered }), plan);
  const p = plan.exercises[0];
  const index = p.sets.findIndex((s) => s.kind === 'working');
  const set = logPlannedSet({ session, planned: p.sets[index], exerciseId: p.exerciseId, slotId: p.slotId, index, now: NOW, prescription: { version: 1, targetRir: 2, rirReported: false, suggestedKg: p.sets[index].weightKg, suggestedReps: p.sets[index].reps, reason: 'repeat', basedOnSetId: 'previous' } });
  assert.deepEqual(fromRemote('sets', { ...toRemote('sets', set).record, updated_at: NOW }).prescription, set.prescription);
  assert.equal(adjustSet(set, { rir: 1 }).prescription.rirReported, true);
  assert.equal(set.prescription.rirReported, false, 'editing does not mutate the original');
});

test('extra sets cannot substitute for a missing frozen prescribed row and changed program cannot remove that requirement', () => {
  const snapshot = emptySnapshot();
  const { program } = ensureProgram(snapshot, NOW);
  const plan = planSession({ program, dayKey: 'A', states: {}, now: NOW });
  const p = plan.exercises[0];
  const working = p.sets.flatMap((s, index) => s.kind === 'working' ? [{ s, index }] : []);
  const session = startSession({ program, dayKey: 'A', now: NOW, plan: { version: 1, program, gym: null, states: {}, prescription: plan } });
  const log = working.slice(0, -1).map(({ s, index }) => logPlannedSet({ session, planned: s, exerciseId: p.exerciseId, slotId: p.slotId, index, now: NOW, overrides: { reps: 20, rir: 4 } }));
  log.push({ ...log[0], id: 'extra', setIndex: 40 });
  const altered = { ...program, days: program.days.map((d) => ({ ...d, slots: [] })) };
  const result = applySession({ program: altered, session, sets: log, states: {}, now: NOW });
  assert.equal(result.states[p.exerciseId].workingKg, p.sets[working[0].index].weightKg);
  assert.equal(result.states[p.exerciseId].lastOutcome, 'held');
  assert.equal(result.states[p.exerciseId].baseline.status, 'learning');
  const replay = applySession({ program: altered, session, sets: log, states: result.states, now: NOW });
  assert.equal(replay.changed.length, 0, 'freezing does not break idempotence');
});

test('failed heavier off-plan work cannot raise the original next-visit anchor', () => {
  for (const rule of ['double', 'rpe', 'linear']) {
    const result = nextState(before(), work(65, [8, 8, 8], 0), params({ rule }), ex, NOW, { plannedSets: 3 });
    assert.ok(result.state.workingKg <= 60, rule);
    assert.match(result.note.en, /No load increase/);
  }
});

test('a frozen same-unit swap preserves the original slot range for both display and evaluation', () => {
  const snapshot = emptySnapshot();
  const { program } = ensureProgram(snapshot, NOW);
  const plan = planSession({ program, dayKey: 'A', states: {}, now: NOW });
  const original = plan.exercises.find((p) => p.exerciseId === 'pec-deck');
  assert.ok(original);
  const session = startSession({ program, dayKey: 'A', now: NOW, plan: { version: 1, program, gym: null, states: {}, prescription: plan } });
  const swapped = activePlan({ snapshot, session, program, swaps: { [original.slotId]: 'cable-fly' } }).exercises.find((p) => p.slotId === original.slotId);
  assert.deepEqual(swapped.repRange, original.repRange);
  const log = swapped.sets.flatMap((s, index) => s.kind !== 'working' ? [] : [logPlannedSet({ session, planned: s, exerciseId: swapped.exerciseId, slotId: swapped.slotId, index, now: NOW })]);
  const result = applySession({ program, session, sets: log, states: {}, now: NOW });
  assert.deepEqual(result.states[swapped.exerciseId].repRange, swapped.repRange);
  assert.notEqual(result.states[swapped.exerciseId].lastOutcome, 'failed');
});

test('calibration cannot raise from one easy set when the weakest set cannot carry the step', () => {
  const initial = before({ targetReps: 6, sessions: 0 });
  const log = work(60, [10, 6, 6]).map((s, i) => ({ ...s, plannedReps: 6, rir: i ? 1 : 2 }));
  const result = nextState(initial, log, params(), ex, NOW, { plannedSets: 3 });
  assert.equal(result.state.workingKg, 60);
});

test('a swapped exercise cannot earn a load step by replacing its missing prescribed row with an extra', () => {
  const snapshot = emptySnapshot();
  const { program } = ensureProgram(snapshot, NOW);
  const exerciseState = { 'converging-chest-press': state({ exerciseId: 'converging-chest-press', workingKg: 60, targetReps: 10 }) };
  const plan = planSession({ program, dayKey: 'A', states: exerciseState, now: NOW });
  const original = plan.exercises[0];
  const session = startSession({ program, dayKey: 'A', now: NOW, plan: { version: 1, program, gym: null, states: exerciseState, prescription: plan } });
  const swapped = activePlan({ snapshot: { ...snapshot, exerciseState }, session, program, swaps: { [original.slotId]: 'converging-chest-press' } }).exercises[0];
  const working = swapped.sets.flatMap((s, index) => s.kind !== 'working' ? [] : [{ s, index }]);
  const log = working.slice(0, -1).map(({ s, index }) => logPlannedSet({ session, planned: s, exerciseId: swapped.exerciseId, slotId: swapped.slotId, index, now: NOW }));
  log.push({ ...log[0], id: 'added', setIndex: 40 });
  const result = endSession({ snapshot: { ...snapshot, exerciseState }, session, program, sets: log, now: NOW });
  assert.equal(result.states[swapped.exerciseId].workingKg, 60);
  assert.equal(result.states[swapped.exerciseId].lastOutcome, 'held');
});

test('explicit mid-workout equipment changes are respected while the load step stays frozen', () => {
  const snapshot = emptySnapshot();
  const { program } = ensureProgram(snapshot, NOW);
  const gym = { id: 'gym', name: 'Gym', available: [], missing: ['pec-deck'], preferred: {}, increments: { 'cable-fly': 2.5 }, updatedAt: NOW };
  const plan = planSession({ program, dayKey: 'A', states: {}, gym, now: NOW });
  const session = startSession({ program, dayKey: 'A', gymId: gym.id, now: NOW, plan: { version: 1, program, gym, states: {}, prescription: plan } });
  const currentGym = { ...gym, increments: { 'cable-fly': 10 }, missing: ['pec-deck', 'cable-fly', 'dumbbell-fly', 'high-to-low-cable-fly', 'low-to-high-cable-fly'] };
  const changed = activePlan({ snapshot: { ...snapshot, gyms: { gym: currentGym } }, session, program });
  assert.equal(changed.exercises.find((p) => p.slotId === 'A3').exerciseId, 'pec-deck');
  const stillAvailable = activePlan({ snapshot: { ...snapshot, gyms: { gym: { ...currentGym, missing: ['pec-deck'] } } }, session, program });
  assert.equal(stillAvailable.exercises.find((p) => p.slotId === 'A3').loadStep, 2.5);
});

test('a hold explicitly set after session start still prevents a load increase', () => {
  const snapshot = emptySnapshot();
  const { program } = ensureProgram(snapshot, NOW);
  const states = { 'machine-chest-press': state({ exerciseId: 'machine-chest-press', workingKg: 60, targetReps: 10 }) };
  const plan = planSession({ program, dayKey: 'A', states, now: NOW });
  const p = plan.exercises[0];
  const session = startSession({ program, dayKey: 'A', now: NOW, plan: { version: 1, program, gym: null, states, prescription: plan } });
  const log = p.sets.flatMap((s, index) => s.kind === 'working' ? [logPlannedSet({ session, planned: s, exerciseId: p.exerciseId, slotId: p.slotId, index, now: NOW })] : []);
  const live = { ...states, [p.exerciseId]: { ...states[p.exerciseId], holdUntil: '2026-12-01T00:00:00.000Z' } };
  const result = applySession({ program, session, sets: log, states: live, now: NOW });
  assert.equal(result.states[p.exerciseId].workingKg, 60);
  assert.equal(result.states[p.exerciseId].holdUntil, live[p.exerciseId].holdUntil);
});
