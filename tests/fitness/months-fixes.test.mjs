/** The seven findings of the simulated months (2026-11-24): each case is a set log the simulated lifter produced. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deloadDue, gapAdjust, nextState } from '../../src/lib/fitness/progression.mjs';
import { closeOuts, endSession, ensureProgram, isRecommendation, logPlannedSet, recommendationRow, startSession, buildRows, nextSetAdvice } from '../../src/lib/fitness/tracker.mjs';
import { applySession, planSession } from '../../src/lib/fitness/session.mjs';
import { emptySnapshot, fromRemote, isRow, toRemote } from '../../src/lib/fitness/store-core.mjs';
import { advisorContext } from '../../src/lib/fitness/advisor.mjs';
import { buildProgram } from '../../src/lib/fitness/templates.mjs';
import { fx, params, set, state } from './engine-fixtures.mjs';

const NOW = '2026-11-24T18:00:00.000Z';
const D = 86_400_000;
const log = (rows, plannedReps, extra = {}) => rows.map(([kg, reps, rir, o = {}], i) => set({ kg, reps, rir, setIndex: i, plannedReps, ...extra, ...o }));
const told = { prescription: { version: 1, targetRir: 1, rirReported: true } };
const silent = { prescription: { version: 1, targetRir: 1, rirReported: false } };
const press = fx('machine-chest-press', { increment: 5 });
const fine = fx('machine-chest-press', { increment: 2.5 });

test('1: the load found on a first visit survives a small miss', () => {
  const p = params({ repRange: [10, 15], rir: 1 });
  const first = (kg) => state({ workingKg: kg, targetReps: 10, repRange: [10, 15], rir: 1, sessions: 0, baseline: { status: 'learning' } });
  let r = nextState(first(15), log([[22.5, 10, 0], [22.5, 9, 0], [20, 10, 2]], 10), p, fine, NOW, { plannedSets: 3 });
  assert.equal(r.state.workingKg, 20);
  r = nextState(first(30), log([[45, 10, 1], [45, 10, 0], [45, 9, 0]], 10), p, press, NOW, { plannedSets: 3 });
  assert.equal(r.state.workingKg, 40);
  assert.match(r.note.ru, /удавш/);
  // an incomplete log, a hold and an established baseline keep the plan
  r = nextState(first(15), log([[22.5, 10, 0], [22.5, 9, 0]], 10), p, fine, NOW, { plannedSets: 3 });
  assert.equal(r.state.workingKg, 15);
  r = nextState({ ...first(15), holdUntil: '2026-12-24' }, log([[22.5, 10, 0], [22.5, 9, 0], [20, 10, 2]], 10), p, fine, NOW, { plannedSets: 3 });
  assert.equal(r.state.workingKg, 15);
});

test('2: one hard set does not move the baseline, and the screen takes reps off before a 25 % cut', () => {
  const planned = { exerciseId: 'machine-chest-press', repRange: [3, 6], loadStep: 5 };
  const target = { kind: 'working', weightKg: 20, reps: 6, rir: 2 };
  assert.deepEqual(nextSetAdvice(planned, { kg: 20, reps: 6, plannedReps: 6, rir: 0 }, target), { suggest: { kg: 20, reps: 4, rir: 2 }, reason: 'repeat' });
  assert.equal(nextSetAdvice(planned, { kg: 20, reps: 2, plannedReps: 6, rir: 0 }, target).suggest.kg, 15, 'below the range still reduces');
  const st = state({ workingKg: 20, targetReps: 6, repRange: [3, 6], baseline: { status: 'established', kg: 20 } });
  const eased = { prescription: { version: 1, reason: 'reduce', targetRir: 2, rirReported: true } };
  const r = nextState(st, log([[20, 6, 0], [15, 3, 8, eased], [15, 3, 8, eased], [15, 3, 8, eased]], 6), params({ repRange: [3, 6] }), press, NOW, { plannedSets: 4 });
  assert.deepEqual([r.state.workingKg, r.state.targetReps, r.state.fails], [20, 5, 0]);
  const miss = nextState(st, log([[20, 2, 0], [15, 3, 8, eased]], 6), params({ repRange: [3, 6] }), press, NOW, { plannedSets: 2 });
  assert.ok(miss.state.fails > 0 || miss.outcome === 'deloaded', 'a set below the range is still a miss');
  const p = buildProgram({ goal: 'strength', now: NOW });
  const low = { 'machine-chest-press': state({ workingKg: 15, targetReps: 3, repRange: [3, 6], lastAt: NOW }) };
  const x = planSession({ program: p, dayKey: 'A', states: low, now: NOW, deload: true }).exercises.find((e) => e.exerciseId === 'machine-chest-press');
  for (const s of x.sets.filter((q) => q.kind === 'working')) assert.ok(s.reps >= 3, `${s.reps} reps`);
});

test('3: reported reserve speeds things up; silence does not', () => {
  const p = params({ repRange: [10, 15], rir: 1 });
  const st = state({ workingKg: 15, targetReps: 10, repRange: [10, 15], rir: 1, baseline: { status: 'established', kg: 15 } });
  const easyLog = (reps) => log([[15, reps, 4], [15, reps, 4], [15, reps, 4]], reps, told);
  const r1 = nextState(st, easyLog(10), p, fine, NOW, { plannedSets: 3 });
  assert.deepEqual([r1.state.workingKg, r1.state.bigStep?.easy], [15, 1]);
  const r2 = nextState(r1.state, easyLog(r1.state.targetReps), p, fine, NOW, { plannedSets: 3 });
  // the capacity guard still decides: 13 + 4 does not carry 17.5 kg, 15 + 4 does
  assert.equal(r2.state.workingKg, 15);
  const r3 = nextState(r2.state, easyLog(r2.state.targetReps), p, fine, NOW, { plannedSets: 3 });
  assert.deepEqual([r3.state.workingKg, r3.state.targetReps], [17.5, 10], 'three visits, not eleven');
  // a finer step is carried sooner: two sessions, without reaching the top of the range
  const small = fx('machine-chest-press', { increment: 1 });
  const s1 = nextState(st, easyLog(10), p, small, NOW, { plannedSets: 3 });
  const s2 = nextState(s1.state, easyLog(s1.state.targetReps), p, small, NOW, { plannedSets: 3 });
  assert.deepEqual([s2.state.workingKg, s2.state.targetReps], [16, 10]);
  // one report on the last set speaks for the fresher sets before it
  const last = log([[15, 10, 1, silent], [15, 10, 1, silent], [15, 10, 4, told]], 10);
  assert.equal(nextState(st, last, p, fine, NOW, { plannedSets: 3 }).state.targetReps, 13);
  const none = log([[15, 10, 1], [15, 10, 1], [15, 10, 1]], 10, silent);
  const n = nextState(st, none, p, fine, NOW, { plannedSets: 3 });
  assert.deepEqual([n.state.workingKg, n.state.targetReps, n.state.bigStep?.easy], [15, 11, undefined]);
  // a target reserve of 4 is not "too easy" at 4; a short log or a hold does not count towards the streak
  const r4 = nextState({ ...st, rir: 4, bigStep: { easy: 1 } }, easyLog(10), { ...p, rir: 4 }, fx('machine-chest-press', { increment: 1 }), NOW, { plannedSets: 3 });
  assert.equal(r4.state.workingKg, 15);
  assert.equal(nextState(r1.state, easyLog(13).slice(0, 2), p, fine, NOW, { plannedSets: 3 }).state.bigStep, null);
  assert.equal(nextState({ ...r1.state, holdUntil: '2026-12-24' }, easyLog(13), p, fine, NOW, { plannedSets: 3 }).state.workingKg, 15);
  // never an unsafe jump: 2.5 → 5 kg doubles the load
  const tiny = { ...st, workingKg: 2.5, bigStep: { easy: 5 } };
  assert.equal(nextState(tiny, log([[2.5, 10, 4], [2.5, 10, 4], [2.5, 10, 4]], 10, told), p, fine, NOW, { plannedSets: 3 }).state.workingKg, 2.5);
});

test('4: a fortnightly cadence is cut once, and a long break is climbed back from', () => {
  const st = state({ workingKg: 40, targetReps: 8 });
  assert.equal(gapAdjust(st, 17, NOW, { exercise: press }).outcome, 'deloaded');
  assert.equal(gapAdjust({ ...st, afterGap: 17 }, 17, NOW, { exercise: press }).outcome, null);
  assert.equal(gapAdjust({ ...st, afterGap: 17 }, 27, NOW, { exercise: press }).outcome, 'deloaded', 'four weeks is a break');
  assert.equal(gapAdjust({ ...st, afterGap: 34 }, 40, NOW, { exercise: press }).outcome, 'reset', 'a long break is never waved through');
  const back = gapAdjust(st, 40, NOW, { exercise: press }).state;
  assert.equal(back.workingKg, 30);
  assert.deepEqual(back.regain, { kg: 40 });
  let s = { ...back, baseline: { status: 'established', kg: 40 } };
  const seen = [];
  // 30 → 35 is +17 %: earned by reps, not handed out (15 → 20 after two months off gave 0 reps)
  for (let i = 0; i < 4; i++) {
    s = nextState(s, log([0, 1, 2].map(() => [s.workingKg, s.targetReps, 4]), s.targetReps, told), params(), press, NOW, { plannedSets: 3 }).state;
    seen.push(s.workingKg);
  }
  assert.deepEqual(seen.slice(0, 1), [30]);
  assert.ok(seen.includes(35), `${seen}`);
  assert.ok(Math.max(...seen) <= 40);
  // a second long break is cut from the load before the first one, so three weeks on and six off does not ratchet down
  assert.equal(gapAdjust({ ...st, workingKg: 35, regain: { kg: 40 } }, 41, NOW, { exercise: press }).state.workingKg, 30);
  assert.equal(gapAdjust({ ...st, workingKg: 30, regain: { kg: 40 } }, 41, NOW, { exercise: press }).state.workingKg, 30);
  assert.deepEqual(gapAdjust({ ...st, workingKg: 30, regain: { kg: 40 } }, 41, NOW, { exercise: press }).state.regain, { kg: 40 });
  const quiet = (from, to, ex) => {
    let q = { ...state({ workingKg: from, targetReps: 6 }), regain: { kg: to }, baseline: { status: 'established', kg: to } };
    return [0, 1].map(() => (q = nextState(q, log([0, 1, 2].map(() => [q.workingKg, q.targetReps, 2]), q.targetReps, silent), params(), ex, NOW, { plannedSets: 3 }).state).workingKg);
  };
  assert.deepEqual(quiet(30, 40, press), [30, 30], '+17 % needs a report');
  assert.deepEqual(quiet(30, 40, fine), [30, 32.5], '+8 % does not');
  assert.equal(s.regain, null);
  const miss = nextState({ ...back, baseline: { status: 'established', kg: 40 } }, log([[30, 4, 0], [30, 4, 0], [30, 4, 0]], 6), params(), press, NOW, { plannedSets: 3 });
  assert.equal(miss.state.regain, null);
  const held = nextState({ ...back, targetReps: 8, regain: { kg: 40, made: 1 }, baseline: { status: 'established', kg: 40 } }, log([[30, 8, 2], [30, 7, 2], [30, 8, 2]], 8), params(), press, NOW, { plannedSets: 3 });
  assert.deepEqual([held.outcome, held.state.regain], ['held', null], 'a missed target ends the way back too');
  assert.ok(gapAdjust(st, 120, NOW, { exercise: press }).state.regain == null);
});

test('after four months the load is rounded down, never up', () => {
  assert.equal(gapAdjust(state({ workingKg: 25, targetReps: 6 }), 133, NOW, { exercise: press }).state.workingKg, 15);
  assert.equal(gapAdjust(state({ workingKg: 100, targetReps: 6 }), 133, NOW, { exercise: press }).state.workingKg, 70);
});

test('5: a deload week needs the training it follows', () => {
  const p = { ...buildProgram({ now: new Date(2026, 10, 23, 9).toISOString() }), deloadEveryWeeks: 5 };
  const monday = new Date(2026, 10, 23 + 35, 12);
  const at = (d, status = 'finished') => ({ id: `s${d}`, status, startedAt: new Date(2026, 10, 23 + d, 12).toISOString() });
  const all = Array.from({ length: 15 }, (_, i) => at(Math.floor(i / 3) * 7 + (i % 3) * 2));
  assert.equal(deloadDue(p, all, monday).due, true);
  assert.equal(deloadDue(p, [...all, at(35, 'active')], monday).due, true);
  assert.equal(deloadDue(p, all.slice(0, 8), monday).due, false, 'half the block missed');
  assert.equal(deloadDue(p, all.filter((s) => s.startedAt < new Date(2026, 10, 23 + 24).toISOString()), monday).due, false, 'ten days off already');
  assert.equal(deloadDue(p, [], monday).due, false);
});

test('7: after a long break the card says one thing', () => {
  const p = buildProgram({ now: NOW });
  const states = { 'machine-chest-press': state({ workingKg: 40, targetReps: 8, lastAt: new Date(Date.parse(NOW) - 32 * D).toISOString() }) };
  const x = planSession({ program: p, dayKey: 'A', states, now: NOW }).exercises.find((e) => e.exerciseId === 'machine-chest-press');
  assert.match(x.note.en, /^32 days since/);
  assert.doesNotMatch(x.note.en, /First time/);
  assert.doesNotMatch(x.note.ru, /Первый раз/);
});

test('the plan records whether it was a deload, and the session is judged the same way', () => {
  const p = buildProgram({ now: NOW });
  const states = { 'machine-chest-press': state({ workingKg: 40, targetReps: 8, lastAt: NOW }) };
  const prescription = planSession({ program: p, dayKey: 'A', states, now: NOW, deload: true });
  assert.equal(prescription.deload, true);
  const x = prescription.exercises.find((e) => e.exerciseId === 'machine-chest-press');
  const later = new Date(Date.parse(NOW) + 2 * D).toISOString();
  const session = { id: 'sess', programId: p.id, dayKey: 'A', gymId: null, startedAt: later, endedAt: later, status: 'finished', updatedAt: later, plan: { version: 1, program: p, gym: null, states, prescription } };
  const sets = x.sets.filter((s) => s.kind === 'working').map((s, i) => set({ kg: s.weightKg, reps: s.reps, rir: s.rir, setIndex: i, plannedReps: s.reps, sessionId: 'sess', slotId: x.slotId, exerciseId: x.exerciseId, doneAt: later }));
  const r = applySession({ program: p, session, sets, states, now: later, deload: false });
  assert.match(r.outcomes[0].note.en, /^Deload week/);
  const after = applySession({ program: p, session: { ...session, plan: { ...session.plan, states: { 'machine-chest-press': { ...states['machine-chest-press'], afterGap: 20 } } } }, sets, states, now: later });
  assert.equal(after.states['machine-chest-press'].afterGap, null, 'a deload session ends the cadence memory');
  assert.ok(buildRows(x, sets).working.length > 0);
});

test('a weak beginner is not cut below a load already shown to be easy', () => {
  const p = params({ repRange: [3, 6] });
  const first = state({ workingKg: 20, targetReps: 3, repRange: [3, 6], sessions: 0, baseline: { status: 'learning' } });
  const r = nextState(first, log([[20, 0, 0], [15, 2, 0], [10, 3, 4], [10, 3, 4]], 3, told), p, press, NOW, { plannedSets: 4 });
  assert.equal(r.state.workingKg, 10);
});

test('8+ on every set catches up at once, within what the weakest set carries; 4–7 does not', () => {
  const p = params({ repRange: [8, 12] });
  const st = (kg, o = {}) => state({ workingKg: kg, targetReps: 8, repRange: [8, 12], baseline: { status: 'established', kg }, ...o });
  const three = (kg, rir) => log([0, 1, 2].map(() => [kg, 8, rir]), 8, told);
  assert.deepEqual([nextState(st(40), three(40, 8), p, press, NOW, { plannedSets: 3 }).state.workingKg, nextState(st(40), three(40, 4), p, press, NOW, { plannedSets: 3 }).state.workingKg], [45, 40]);
  assert.equal(nextState(st(40, { holdUntil: '2026-12-24' }), three(40, 8), p, press, NOW, { plannedSets: 3 }).state.workingKg, 40);
  assert.equal(nextState(st(40), three(40, 8).slice(0, 2), p, press, NOW, { plannedSets: 3 }).state.workingKg, 40);
  const mixed = three(40, 8); mixed[2].rir = 3;
  assert.equal(nextState(st(40), mixed, p, press, NOW, { plannedSets: 3 }).state.workingKg, 40, 'the weakest set decides');
  // a machine step too big for what the reports show: only the lifter can tell
  const r = nextState(st(10, { bigStep: { easy: 1 } }), three(10, 8), p, press, NOW, { plannedSets: 3 });
  assert.equal(r.state.workingKg, 10);
  assert.match(r.note.en, /raise the weight yourself/);
  assert.match(r.note.ru, /прибавьте вес сами/);
});

test('a second long break of any length is cut from the load before the first', () => {
  const st = state({ workingKg: 80, targetReps: 8, regain: { kg: 100 } });
  assert.equal(gapAdjust(st, 100, NOW, { exercise: press }).state.workingKg, 70);
  assert.equal(gapAdjust({ ...st, workingKg: 60 }, 100, NOW, { exercise: press }).state.workingKg, 60, 'never heavier than now');
});

test('every recommendation is recorded: what it was, what it became and why, once per session', () => {
  const snapshot = emptySnapshot();
  const { program } = ensureProgram(snapshot, NOW);
  const plan = planSession({ program, dayKey: 'A', states: {}, now: NOW });
  const session = startSession({ program, dayKey: 'A', now: NOW, plan: { version: 1, program, gym: null, states: {}, prescription: plan } });
  const sets = plan.exercises.flatMap((x) => x.sets.flatMap((s, index) => (s.kind === 'warmup' ? [] : [logPlannedSet({ session, planned: s, exerciseId: x.exerciseId, slotId: x.slotId, index, now: NOW })])));
  const end = endSession({ snapshot: { ...snapshot, sessions: { [session.id]: session } }, session, program, sets, now: NOW });
  const row = end.recommendation;
  assert.ok(isRow('adjustments', row) && isRecommendation(row));
  assert.equal(row.output.recommendations.length, plan.exercises.length);
  for (const item of row.output.recommendations) {
    const s = end.states[item.exerciseId];
    assert.deepEqual([item.from, item.to.kg, item.to.reps, item.note], [null, s.workingKg, s.targetReps, s.note]);
  }
  assert.equal(recommendationRow({ session, outcomes: [], before: {}, after: {}, changed: [], now: NOW }).id, row.id, 'ending again replaces it');
  // to the database and back
  const { table, record } = toRemote('adjustments', row, { userId: '33333333-3333-4333-8333-333333333333' });
  assert.equal(table, 'fitness_adjustments');
  const back = fromRemote('adjustments', { ...record, created_at: row.at, updated_at: row.updatedAt });
  assert.deepEqual([back.source, back.input, back.output, back.applied], [row.source, row.input, row.output, true]);
  assert.ok(JSON.stringify(row).length < 8000, `${JSON.stringify(row).length} bytes`);
  // the coach's list of plan changes stays a list of plan changes
  const ctx = advisorContext({ program, states: end.states, sessions: {}, sets: {}, settings: null, bodyweight: {}, adjustments: { [row.id]: row }, gym: null, now: NOW });
  assert.ok(!JSON.stringify(ctx).includes(row.id) && !Object.values(ctx).some((v) => Array.isArray(v) && v.some((x) => x?.source === 'engine')));
  // a forgotten session is recorded when it is closed
  const later = new Date(Date.parse(NOW) + 8 * 3_600_000).toISOString();
  const closed = { ...session, status: 'auto_closed', endedAt: later };
  const out = closeOuts({ ...snapshot, programs: { [program.id]: program }, sessions: { [session.id]: closed }, sets: Object.fromEntries(sets.map((s) => [s.id, s])) }, later);
  assert.equal(out.apply.length, 1);
  assert.equal(out.apply[0].recommendation.id, row.id);
});
