// Regression tests for the reviewed engine defects (shared slots, one-sided substitutes, adviser caps, program swaps,
// pin grids, test-session ramps, calendar-day breaks, assisted deloads). One scenario per finding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySession, planSession, resolveExercise } from '../../src/lib/fitness/session.mjs';
import { buildProgram } from '../../src/lib/fitness/templates.mjs';
import { nextState, startingLoad, substituteState } from '../../src/lib/fitness/progression.mjs';
import { swapSlot } from '../../src/lib/fitness/program-edit.mjs';
import { validateProposal } from '../../src/lib/fitness/advisor.mjs';
import { nextSetAdvice } from '../../src/lib/fitness/tracker.mjs';
import { CATALOG, ex, gym, params, set, sets, state } from './engine-fixtures.mjs';

const CREATED = '2026-11-03T08:00:00.000Z';
const NOW = '2026-11-10T17:00:00.000Z';
const LATER = '2026-11-10T19:00:00.000Z';
const settings = { bodyweightKg: 80 };
const program = () => buildProgram({ now: CREATED, catalog: CATALOG, id: 'prog-1' });
const slot = (p, day, i) => p.days.find((d) => d.key === day).slots[i];
const working = (pe) => pe.sets.filter((s) => s.kind === 'working');
const bilingual = (note) => assert.ok(note?.en && note?.ru && note.en !== note.ru, 'a note in both languages');

test('finding 3: a substitute already used by another slot at another range is passed over when one is free', () => {
  const p = program();
  const b1 = slot(p, 'B', 0);
  assert.equal(b1.exerciseId, 'assisted-pull-up');
  assert.equal(resolveExercise(b1, gym({ missing: ['assisted-pull-up'] }), CATALOG, p), 'neutral-grip-pulldown', 'lat-pulldown is day A at 6–10');
  assert.equal(resolveExercise(b1, gym({ missing: ['assisted-pull-up'] }), CATALOG), 'lat-pulldown', 'without the program: the first alternative, as before');
  assert.equal(resolveExercise(b1, gym({ missing: ['assisted-pull-up', 'neutral-grip-pulldown'] }), CATALOG, p), 'lat-pulldown', 'nothing else fits: shared');
});

test('finding 3: an unavoidable shared exercise follows its own slot; the guest slot never rewrites its progression', () => {
  const p = program();
  const g = gym({ missing: ['assisted-pull-up', 'neutral-grip-pulldown'] });
  const lat = state({ exerciseId: 'lat-pulldown', workingKg: 50, targetReps: 7, repRange: [6, 10], rir: 2, sessions: 5, baseline: { status: 'established', kg: 50 } });
  const plan = planSession({ program: p, dayKey: 'B', states: { 'lat-pulldown': lat }, gym: g, settings, now: NOW, catalog: CATALOG });
  const b1 = plan.exercises[0];
  assert.equal(b1.exerciseId, 'lat-pulldown');
  assert.equal(b1.calibration, false, 'no test session every other day');
  assert.ok(working(b1).every((s) => s.weightKg === 50), 'the load the owner slot reached');
  assert.match(b1.note.en, /another slot of the plan \(6–10\)/);
  bilingual(b1.note);
  const session = { id: 's1', programId: 'prog-1', dayKey: 'B', gymId: 'gym-1', startedAt: NOW, endedAt: LATER, status: 'finished', bodyweightKg: 80, updatedAt: LATER };
  const logged = sets(50, working(b1).map((s) => s.reps), 2, { slotId: b1.slotId, exerciseId: 'lat-pulldown' });
  for (const deload of [false, true]) {
    const r = applySession({ program: p, session, sets: logged, states: { 'lat-pulldown': lat }, catalog: CATALOG, now: LATER, gym: g, settings, deload });
    const after = r.states['lat-pulldown'];
    assert.deepEqual([after.workingKg, after.targetReps, after.repRange, after.fails], [50, 7, [6, 10], 0], `deload ${deload}: the stored progression is untouched`);
    assert.equal(after.baseline.status, 'established');
  }
});

test('finding 4: a one-sided substitute for a two-sided exercise starts from half the load, capped near its own start', () => {
  const from = state({ exerciseId: 'machine-row', workingKg: 60, targetReps: 8 });
  const oneArm = { ...ex('seated-cable-row'), id: 'single-arm-cable-row', unilateral: true, startLoad: { kg: 10, source: 'fixture' } };
  const both = substituteState(from, ex('machine-row'), ex('seated-cable-row'), { now: NOW });
  const one = substituteState(from, ex('machine-row'), oneArm, { now: NOW });
  assert.equal(both.workingKg, 50);
  assert.ok(one.workingKg <= both.workingKg / 2 && one.workingKg <= 2 * startingLoad(oneArm), `one arm starts at ${one.workingKg} kg`);
  assert.equal(one.sessions, 0, 'and its first session is a test');
  assert.match(one.note.en, /one side at a time/);
  bilingual(one.note);
});

test('finding 5: the adviser load cap is checked on the load the machine can be set to', () => {
  const p = program();
  const load = (exerciseId, value) => ({ type: 'change_load', dayKey: '', slotId: '', exerciseId, newExerciseId: '', value, value2: 0, text: { en: '', ru: '' }, reason: { en: 'because', ru: 'потому что' } });
  const check = (changes, states) => validateProposal({ summary: { en: 's', ru: 'с' }, cautions: [], changes }, p, CATALOG, { states });
  const states = { 'machine-chest-press': state({ workingKg: 45, targetReps: 7 }) };
  // 49 kg is within +10 % of 45 as typed, but a 5 kg stack makes it 50: the value kept is the one applied
  assert.deepEqual(check([load('machine-chest-press', 49)], states).changes.map((c) => c.value), [50]);
  assert.equal(check([load('machine-chest-press', 57)], states).changes.length, 0, '+12 kg on 45 is refused');
  // no history: one step above the starting weight at most
  const start = startingLoad(ex('machine-row'));
  assert.deepEqual(check([load('machine-row', start + 5)], {}).changes.map((c) => c.value), [start + 5]);
  const far = check([load('machine-row', 250)], {});
  assert.equal(far.changes.length, 0);
  assert.match(far.dropped[0].reason.en, /No history/);
  bilingual(far.dropped[0].reason);
});

test('finding 6: a swap made in the program editor carries the history, like a swap made in the gym', () => {
  const p = program();
  const a3 = slot(p, 'A', 2);
  assert.equal(a3.exerciseId, 'pec-deck');
  const swapped = swapSlot(p, 'A', a3.slotId, 'cable-fly', NOW, { catalog: CATALOG });
  const history = { 'pec-deck': state({ exerciseId: 'pec-deck', workingKg: 40, targetReps: 12, repRange: [10, 15], rir: 1, sessions: 6 }) };
  const pe = planSession({ program: swapped, dayKey: 'A', states: history, settings, now: NOW, catalog: CATALOG }).exercises.find((e) => e.exerciseId === 'cable-fly');
  const expected = substituteState(history['pec-deck'], ex('pec-deck'), ex('cable-fly'), { now: NOW, repRange: a3.repRange, rir: a3.rir }).workingKg;
  assert.ok(expected > startingLoad(ex('cable-fly')));
  assert.equal(working(pe)[0].weightKg, expected, 'not back to the catalog start load');
  assert.equal(pe.calibration, true);
});

test('finding 7: a stored load off this gym’s pin grid is planned on the grid, the easier way', () => {
  const p = program();
  const g = gym({ increments: { 'machine-crunch': 5 } });
  const states = { 'machine-crunch': state({ exerciseId: 'machine-crunch', workingKg: 22.5, targetReps: 9, repRange: [8, 12], sessions: 5 }) };
  const pe = planSession({ program: p, dayKey: 'A', states, gym: g, settings, now: NOW, catalog: CATALOG }).exercises.find((e) => e.exerciseId === 'machine-crunch');
  assert.ok(working(pe).every((s) => s.weightKg === 20), '22.5 kg does not exist on a 5 kg stack');
});

test('an easy set never raises the weight in the middle of a session, test session or not (a person training alone)', () => {
  const planned = { exerciseId: 'machine-chest-press', repRange: [6, 10], loadStep: 5, calibration: true };
  const target = { kg: 20, reps: 6, rir: 2 };
  const last = (rir, rirReported) => ({ kg: 20, reps: 6, rir, plannedReps: 6, kind: 'working', prescription: { rirReported } });
  assert.equal(nextSetAdvice(planned, last(4, true), target).suggest.kg, 20, 'a reported easy set keeps the load; the raise comes at the end of the session');
  assert.equal(nextSetAdvice(planned, last(3, true), target).suggest.kg, 20, 'one rep more in reserve is not far too light');
  assert.equal(nextSetAdvice(planned, last(4, false), target).suggest.kg, 20, 'a pre-filled reserve is not evidence');
  assert.equal(nextSetAdvice({ ...planned, calibration: false }, last(4, true), target).suggest.kg, 20, 'ordinary sessions keep the load');
});

test('finding 8: a test done as a ramp lands on the hardest load that was made, and the failed top attempt is no miss', () => {
  const ramp = [[25, 6, 4], [30, 6, 4], [35, 6, 3], [40, 6, 2]].map(([kg, reps, rir], i) => set({ kg, reps, rir, setIndex: i, plannedReps: 6 }));
  const made = nextState(state({ workingKg: 25, targetReps: 6, sessions: 0 }), ramp, params(), ex('machine-chest-press'), NOW, { plannedSets: 4 });
  assert.equal(made.state.workingKg, 40);
  assert.equal(made.state.fails, 0);
  const over = [...ramp.slice(0, 3), set({ kg: 40, reps: 4, rir: 0, setIndex: 3, plannedReps: 6 })];
  const r = nextState(state({ workingKg: 25, targetReps: 6, sessions: 0 }), over, params(), ex('machine-chest-press'), NOW, { plannedSets: 4 });
  assert.ok(r.state.workingKg >= 30 && r.state.workingKg <= 35, `next ${r.state.workingKg} kg`);
  assert.equal(r.state.fails, 0);
  assert.notEqual(r.outcome, 'failed');
  bilingual(r.note);
});

test('finding 8: while the baseline is still being learned, the same ramp in a later session is progress, not a miss', () => {
  const learning = state({ workingKg: 55, targetReps: 6, sessions: 7, baseline: { status: 'learning' } });
  const logged = [set({ kg: 55, reps: 6, rir: 4, setIndex: 0, plannedReps: 6 }), set({ kg: 60, reps: 6, rir: 3, setIndex: 1, plannedReps: 6 })];
  const r = nextState(learning, logged, params(), ex('machine-chest-press'), NOW, { plannedSets: 2 });
  assert.equal(r.outcome, 'progressed');
  assert.deepEqual([r.state.workingKg, r.state.targetReps], [60, 7]);
  assert.doesNotMatch(r.note.en, /not every set/);
  // an established baseline reads the lighter first set as the weight having come down, as before
  const est = nextState({ ...learning, baseline: { status: 'established', kg: 55 } }, logged, params(), ex('machine-chest-press'), NOW, { plannedSets: 2 });
  assert.equal(est.outcome, 'held');
});

test('finding 9: 14 days off is no break at any hour of the day; the break rule counts calendar days', () => {
  const p = program();
  const states = { 'machine-chest-press': state({ workingKg: 50, targetReps: 7, sessions: 5, lastAt: '2026-10-27T19:30:00.000Z', baseline: { status: 'established', kg: 50 } }) };
  for (const now of ['2026-11-10T06:00:00.000Z', '2026-11-10T21:00:00.000Z']) {
    const pe = planSession({ program: p, dayKey: 'A', states, settings, now, catalog: CATALOG }).exercises[0];
    assert.deepEqual([working(pe)[0].weightKg, pe.calibration], [50, false], now);
  }
});

test('finding 15: an assisted deload lands on the pin grid and never asks for more help than the body weighs', () => {
  const run = (kg) => nextState(state({ exerciseId: 'assisted-pull-up', workingKg: kg, targetReps: 8, repRange: [8, 12], fails: 1 }),
    sets(kg, [6, 6, 5], 1, { exerciseId: 'assisted-pull-up' }), params({ repRange: [8, 12] }), ex('assisted-pull-up'), NOW, { bodyweightKg: 82.3, plannedSets: 3 });
  const a = run(40);
  assert.equal(a.state.workingKg, 45);
  assert.match(a.note.en, /assistance 45 kg \(−11\.8 %\)/, 'the percentage quoted is the one applied: (82.3 − 45) / (82.3 − 40)');
  const b = run(80);
  assert.equal(b.state.workingKg, 80, '85 kg of help on an 82.3 kg body lifts nothing');
  assert.match(b.note.en, /stay at assistance 80 kg/);
  bilingual(b.note);
});

test('finding 15: a session done lighter than planned whose step only returns to the plan is not announced as a gain', () => {
  const r = nextState(state({ workingKg: 50, targetReps: 8 }), sets(45, [10, 10, 10], 3), params(), ex('machine-chest-press'), NOW, { plannedSets: 3 });
  assert.equal(r.outcome, 'held');
  assert.equal(r.state.workingKg, 50);
  assert.match(r.note.en, /Today was 45 kg, lighter than planned \(50 kg\)/);
  bilingual(r.note);
});
