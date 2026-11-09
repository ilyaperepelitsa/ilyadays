// Stream 03 — session planning and bookkeeping (src/lib/fitness/session.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import exercisesJson from '../../content/fitness/exercises.json' with { type: 'json' };
import {
  AUTO_CLOSE_HOURS, applySession, catalogFrom, fallbackExercise, nextDayKey, planSession, resolveExercise,
  sessionStatus, summarize,
} from '../../src/lib/fitness/session.mjs';
import { GOAL_IDS, TEMPLATES, buildProgram, convertProgram, withLegs } from '../../src/lib/fitness/templates.mjs';
import { holdDay, initialState, isAssisted, nextState, repCeiling, warmupRamp } from '../../src/lib/fitness/progression.mjs';
import { isRow } from '../../src/lib/fitness/store-core.mjs';
import { e1rmSeries, effectiveLoad } from '../../src/lib/fitness/analytics.mjs';
import { CATALOG, gym, set, sets, state } from './engine-fixtures.mjs';

const CREATED = '2026-11-03T08:00:00.000Z';
const NOW = '2026-11-10T17:00:00.000Z';
const LATER = '2026-11-10T19:00:00.000Z';
const H = 3_600_000;
const D = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const program = () => buildProgram({ now: CREATED, catalog: CATALOG, id: 'prog-1' });
const settings = { bodyweightKg: 80 };
/** @returns {import('../../src/lib/fitness/types').Session} */
const sess = (o = {}) => ({
  id: 's1', programId: 'prog-1', dayKey: 'A', gymId: null, startedAt: NOW, endedAt: '2026-11-10T18:10:00.000Z',
  status: 'finished', bodyweightKg: 80, updatedAt: '2026-11-10T18:10:00.000Z', ...o,
});
const working = (pe) => pe.sets.filter((s) => s.kind === 'working');
const warmups = (pe) => pe.sets.filter((s) => s.kind === 'warmup');
const byExercise = (plan, id) => {
  const pe = plan.exercises.find((e) => e.programExerciseId === id || e.exerciseId === id);
  assert.ok(pe, `planned ${id}`);
  return pe;
};
const recentStates = () => ({
  'machine-chest-press': state({ workingKg: 60, targetReps: 8, repRange: [6, 10], rir: 2, e1rm: 80, sessions: 5, lastAt: '2026-11-07T17:30:00.000Z' }),
  'lat-pulldown': state({ exerciseId: 'lat-pulldown', workingKg: 50, targetReps: 7, repRange: [6, 10], rir: 2, sessions: 5, lastAt: '2026-11-07T17:40:00.000Z' }),
  'machine-crunch': state({ exerciseId: 'machine-crunch', workingKg: 20, targetReps: 9, repRange: [8, 12], rir: 2, sessions: 5, lastAt: '2026-11-07T17:50:00.000Z', note: { en: '+2.5 kg soon.', ru: '+2,5 кг скоро.' } }),
});

/* ------------------------------------------------------------------ status and rotation */

test('sessionStatus: an active session auto-closes exactly 6 h after it started', () => {
  assert.equal(AUTO_CLOSE_HOURS, 6);
  const s = sess({ status: 'active', endedAt: null });
  const start = Date.parse(NOW);
  assert.equal(sessionStatus(s, start + 6 * H - 1), 'active');
  assert.equal(sessionStatus(s, start + 6 * H), 'auto_closed');
  assert.equal(sessionStatus(s, iso(start + 30 * H)), 'auto_closed');
  assert.equal(sessionStatus(s, new Date(start + 2 * H)), 'active');
  assert.equal(sessionStatus(s, start + 2 * H, 1), 'auto_closed', 'custom hours');
  assert.equal(sessionStatus(sess({ status: 'finished' }), start + 99 * H), 'finished');
  assert.equal(sessionStatus(sess({ status: 'abandoned' }), start), 'abandoned');
  assert.equal(sessionStatus(sess({ status: 'active', startedAt: 'garbage' }), start), 'active');
});

test('nextDayKey: sequential rotation A → B → C → A, counting finished and auto-closed sessions', () => {
  const p = program();
  assert.equal(nextDayKey(p, [], NOW), 'A');
  assert.equal(nextDayKey(p, null, NOW), 'A');
  /** @type {any[]} */
  const done = [];
  const order = [];
  for (let i = 0; i < 7; i++) {
    const key = nextDayKey(p, done, NOW);
    order.push(key);
    done.push(sess({ id: `s${i}`, dayKey: key, startedAt: iso(Date.parse(CREATED) + i * D) }));
  }
  assert.deepEqual(order, ['A', 'B', 'C', 'A', 'B', 'C', 'A']);
  // order of the list does not matter; a Record works too
  const a = sess({ id: 'a', dayKey: 'A', startedAt: '2026-11-05T17:00:00.000Z' });
  const b = sess({ id: 'b', dayKey: 'B', startedAt: '2026-11-07T17:00:00.000Z' });
  assert.equal(nextDayKey(p, [b, a], NOW), 'C');
  assert.equal(nextDayKey(p, { a, b }, NOW), 'C');
  // an active session in progress does not move the rotation; one left open ≥ 6 h does
  const open = sess({ id: 'c', dayKey: 'C', status: 'active', endedAt: null, startedAt: iso(Date.parse(NOW) - H) });
  assert.equal(nextDayKey(p, [a, b, open], NOW), 'C');
  const stale = { ...open, startedAt: iso(Date.parse(NOW) - 7 * H) };
  assert.equal(nextDayKey(p, [a, b, stale], NOW), 'A');
  assert.equal(nextDayKey(p, [a, b, { ...open, status: 'abandoned' }], NOW), 'C');
  // sessions of an earlier program version count; an unknown day key restarts at A
  assert.equal(nextDayKey(convertProgram(p, 'strength', NOW), [a, b], NOW), 'C');
  assert.equal(nextDayKey(p, [sess({ dayKey: 'D' })], NOW), 'A');
  // the legs day joins the rotation
  const legs = withLegs(p, NOW, { catalog: CATALOG });
  assert.equal(nextDayKey(legs, [sess({ dayKey: 'C' })], NOW), 'L');
  assert.equal(nextDayKey(legs, [sess({ dayKey: 'L' })], NOW), 'A');
});

test('nextDayKey: 2- and 4-day programs rotate their own keys; abandoned sessions never move the rotation', () => {
  for (const [daysPerWeek, keys] of [[2, ['A', 'B']], [4, ['A', 'B', 'C', 'D']]]) {
    const p = buildProgram({ daysPerWeek, now: CREATED, catalog: CATALOG, id: `prog-${daysPerWeek}` });
    assert.deepEqual(p.days.map((d) => d.key), keys);
    /** @type {any[]} */
    const done = [];
    const order = [];
    for (let i = 0; i < 2 * keys.length + 1; i++) {
      const key = nextDayKey(p, done, NOW);
      order.push(key);
      done.push(sess({ id: `s${i}`, dayKey: key, startedAt: iso(Date.parse(CREATED) + i * D) }));
      // every other day the next workout is started later and abandoned (no working set): it must not count
      const next = keys[(keys.indexOf(key) + 1) % keys.length];
      if (i % 2) done.push(sess({ id: `x${i}`, dayKey: next, status: 'abandoned', startedAt: iso(Date.parse(CREATED) + i * D + 3 * H) }));
    }
    assert.deepEqual(order, [...keys, ...keys, 'A'], `${daysPerWeek} days`);
    // the last finished day of a 3-day program that this one does not have (C, D) restarts at A
    assert.equal(nextDayKey(p, [sess({ dayKey: daysPerWeek === 2 ? 'C' : 'E' })], NOW), 'A');
  }
});

/* ------------------------------------------------------------------ resolution */

test('resolveExercise: slot preference → exercise preference → slot exercise → first available alternative', () => {
  const p = program();
  const a1 = p.days[0].slots[0];
  assert.equal(a1.exerciseId, 'machine-chest-press');
  assert.equal(resolveExercise(a1, null, CATALOG), 'machine-chest-press');
  assert.equal(resolveExercise(a1, gym(), CATALOG), 'machine-chest-press');
  assert.equal(resolveExercise(a1, gym({ preferred: { A1: 'converging-chest-press' } }), CATALOG), 'converging-chest-press');
  assert.equal(resolveExercise(a1, gym({ preferred: { 'machine-chest-press': 'plate-loaded-chest-press' } }), CATALOG), 'plate-loaded-chest-press');
  assert.equal(
    resolveExercise(a1, gym({ preferred: { A1: 'converging-chest-press', 'machine-chest-press': 'plate-loaded-chest-press' } }), CATALOG),
    'converging-chest-press', 'the slot preference wins',
  );
  assert.equal(
    resolveExercise(a1, gym({ preferred: { A1: 'converging-chest-press', 'machine-chest-press': 'plate-loaded-chest-press' }, missing: ['converging-chest-press'] }), CATALOG),
    'plate-loaded-chest-press', 'an unavailable preference is skipped',
  );
  assert.equal(resolveExercise(a1, gym({ preferred: { A1: 'lat-pulldown' } }), CATALOG), 'machine-chest-press', 'a stale preference from another slot is ignored');
  assert.equal(resolveExercise(a1, gym({ preferred: { A1: 'no-such-exercise' } }), CATALOG), 'machine-chest-press');
  // same registry class counts as compatible even when not listed as an alternative
  const conv = { ...a1, exerciseId: 'converging-chest-press' };
  assert.equal(resolveExercise(conv, gym({ preferred: { A1: 'smith-bench-press' } }), CATALOG), 'smith-bench-press');
  // the gym lacks the machine: first available alternative, in catalog order
  assert.equal(resolveExercise(a1, gym({ missing: ['machine-chest-press'] }), CATALOG), 'converging-chest-press');
  assert.equal(resolveExercise(a1, gym({ available: ['dumbbell-bench-press', 'plate-loaded-chest-press'] }), CATALOG), 'plate-loaded-chest-press');
  assert.equal(resolveExercise(a1, gym({ available: ['lat-pulldown'] }), CATALOG), 'machine-chest-press', 'nothing fits: keep the slot exercise');
});

/* ------------------------------------------------------------------ planning */

test('planSession: a first day with no history — start loads, ramps, test notes, supersets', () => {
  const plan = planSession({ program: program(), dayKey: 'A', states: {}, settings, now: NOW, catalog: CATALOG });
  assert.equal(plan.dayKey, 'A');
  assert.equal(plan.dayName.en, 'A · Chest focus');
  assert.ok(plan.warmup.en && plan.warmup.ru);
  assert.ok(plan.finisher?.en.includes('12 min'));
  assert.deepEqual(plan.exercises.map((e) => e.slotId), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
  assert.ok(plan.estimatedMinutes >= 45 && plan.estimatedMinutes <= 75, `${plan.estimatedMinutes} min`);
  const a1 = plan.exercises[0];
  assert.equal(a1.exerciseId, 'machine-chest-press');
  assert.equal(a1.programExerciseId, 'machine-chest-press');
  assert.equal(working(a1).length, 4);
  assert.deepEqual(working(a1)[0], { kind: 'working', weightKg: 20, reps: 6, rir: 2 });
  assert.ok(warmups(a1).length >= 1 && warmups(a1).every((w) => w.weightKg < 20));
  assert.equal(a1.restSec, 150);
  assert.match(a1.note?.en ?? '', /^First time on this exercise/);
  assert.equal(a1.alternatives[0], 'converging-chest-press');
  assert.deepEqual(plan.exercises.filter((e) => e.superset).map((e) => `${e.slotId}:${e.superset}:${e.restSec}`), ['A3:sA1:60', 'A4:sA1:75']);
  // isolation and trunk work gets no ramp; the second back compound only one ramp set (back already warm)
  assert.equal(warmups(plan.exercises[2]).length, 0);
  assert.equal(warmups(plan.exercises[5]).length, 0);
  assert.ok(warmups(plan.exercises[1]).length >= 2, 'lat pulldown ramps fully');
  assert.equal(warmups(plan.exercises[3]).length, 1, 'machine row: one ramp set');
});

test('planSession: holds, carries, bodyweight and assisted work', () => {
  const day = planSession({ program: program(), dayKey: 'C', states: {}, settings, now: NOW, catalog: CATALOG });
  const knee = byExercise(day, 'captains-chair-knee-raise');
  assert.deepEqual([warmups(knee).length, working(knee)[0].weightKg, working(knee)[0].reps], [0, 0, 8]);
  const carry = byExercise(day, 'farmers-carry');
  assert.deepEqual([warmups(carry).length, working(carry).length, working(carry)[0].weightKg, working(carry)[0].reps], [0, 2, 16, 20]);
  assert.match(carry.note?.en ?? '', /carry 20 m/);
  const b = planSession({ program: program(), dayKey: 'B', states: {}, settings, now: NOW, catalog: CATALOG });
  const pull = byExercise(b, 'assisted-pull-up');
  assert.equal(working(pull)[0].weightKg, 55, 'assistance');
  assert.ok(warmups(pull).every((w) => w.weightKg > 55), 'warm-ups use MORE assistance');
  assert.match(pull.note?.en ?? '', /take off 5 kg/);
});

test('planSession: progression memory, substitutes, goal switches, gaps', () => {
  const p = program();
  const states = recentStates();
  let plan = planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG });
  let a1 = plan.exercises[0];
  assert.deepEqual(working(a1), Array.from({ length: 4 }, () => ({ kind: 'working', weightKg: 60, reps: 8, rir: 2 })));
  assert.ok(warmups(a1).every((w) => w.weightKg < 60));
  assert.equal(byExercise(plan, 'machine-crunch').note?.en, '+2.5 kg soon.', "the state's last note");
  // a preferred machine at this gym: seeded at 85 % of the equivalent load, the program's machine first in the list
  plan = planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG, gym: gym({ preferred: { A1: 'converging-chest-press' } }) });
  a1 = plan.exercises[0];
  assert.deepEqual([a1.exerciseId, a1.programExerciseId, working(a1)[0].weightKg, working(a1)[0].reps], ['converging-chest-press', 'machine-chest-press', 50, 8]);
  assert.equal(a1.alternatives[0], 'machine-chest-press');
  assert.match(a1.note?.en ?? '', /^Swapped in/);
  // the machine is missing here: not offered as an alternative
  plan = planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG, gym: gym({ missing: ['machine-chest-press'] }) });
  assert.ok(!plan.exercises[0].alternatives.includes('machine-chest-press'));
  // goal switch: 60 × 8 @ 2 in 6–10 → strength 3–6 through the %1RM table, 5 % lighter, one rounding
  plan = planSession({ program: convertProgram(p, 'strength', NOW, { catalog: CATALOG }), dayKey: 'A', states, settings, now: NOW, catalog: CATALOG });
  a1 = plan.exercises[0];
  assert.deepEqual([working(a1).length, working(a1)[0].weightKg, working(a1)[0].reps, working(a1)[0].rir, a1.restSec], [5, 65, 3, 2, 180]);
  assert.match(a1.note?.en ?? '', /^New range 3–6: 65 kg × 3 reps \(converted through your 1RM, 5 % lighter/);
  // 20 days off: −7.1 %; 40 days off: −11 % (60 → 53.4 kg, the nearest pin 55 kg), reset to the bottom of the range with a test
  const at = (days) => ({ ...states, 'machine-chest-press': { ...states['machine-chest-press'], lastAt: iso(Date.parse(NOW) - days * D) } });
  a1 = planSession({ program: p, dayKey: 'A', states: at(20), settings, now: NOW, catalog: CATALOG }).exercises[0];
  assert.deepEqual([working(a1)[0].weightKg, working(a1)[0].reps], [55, 8]);
  assert.match(a1.note?.en ?? '', /^20 days since last time/);
  a1 = planSession({ program: p, dayKey: 'A', states: at(40), settings, now: NOW, catalog: CATALOG }).exercises[0];
  assert.deepEqual([working(a1)[0].weightKg, working(a1)[0].reps], [55, 6]);
  assert.match(a1.note?.en ?? '', /^40 days since you last did this.*First time on this exercise/);
  // an unknown day key plans the first day
  assert.equal(planSession({ program: p, dayKey: 'Z', states, now: NOW, catalog: CATALOG }).dayKey, 'A');
});

test('planSession: deload weeks cut sets 40 %, keep the load, add 2 RIR — not after a break', () => {
  const p = program();
  const states = recentStates();
  let a1 = planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG, deload: true }).exercises[0];
  assert.deepEqual(working(a1), [{ kind: 'working', weightKg: 60, reps: 6, rir: 4 }, { kind: 'working', weightKg: 60, reps: 6, rir: 4 }]);
  assert.match(a1.note?.en ?? '', /^Deload week/);
  // by the calendar: week 6 of the 5 + 1 block
  const wk6 = iso(Date.parse(CREATED) + 36 * D);
  const fresh = Object.fromEntries(Object.entries(states).map(([k, v]) => [k, { ...v, lastAt: iso(Date.parse(wk6) - 3 * D) }]));
  const plan = planSession({ program: p, dayKey: 'A', states: fresh, settings, now: wk6, catalog: CATALOG });
  assert.equal(working(plan.exercises[0]).length, 2);
  assert.equal(working(plan.exercises[1]).length, 2);
  // the chest press is back from a month off: the break was the deload
  const mixed = { ...fresh, 'machine-chest-press': { ...fresh['machine-chest-press'], lastAt: iso(Date.parse(wk6) - 31 * D) } };
  const plan2 = planSession({ program: p, dayKey: 'A', states: mixed, settings, now: wk6, catalog: CATALOG });
  assert.equal(working(plan2.exercises[0]).length, 4);
  assert.doesNotMatch(plan2.exercises[0].note?.en ?? '', /Deload week/);
  assert.equal(working(plan2.exercises[1]).length, 2);
  // not a deload week one week later
  assert.equal(working(planSession({ program: p, dayKey: 'A', states: fresh, settings, now: iso(Date.parse(wk6) + 7 * D), catalog: CATALOG }).exercises[1]).length, 3);
});

test('planSession works on an empty catalog (registry fallbacks)', () => {
  for (const daysPerWeek of [2, 3, 4]) {
    const p = withLegs(buildProgram({ daysPerWeek, now: CREATED }), CREATED);
    for (const day of p.days) {
      const plan = planSession({ program: p, dayKey: day.key, states: {}, settings: null, now: NOW, catalog: catalogFrom([]) });
      assert.equal(plan.exercises.length, day.slots.length);
      for (const pe of plan.exercises) {
        assert.ok(working(pe).length >= 1);
        assert.ok(pe.sets.every((s) => Number.isFinite(s.weightKg) && s.weightKg >= 0 && s.reps >= 1), `${day.key}/${pe.slotId}`);
      }
    }
  }
  assert.equal(fallbackExercise('farmers-carry').repUnit, 'meters');
  assert.equal(fallbackExercise('plank').repUnit, 'seconds');
  assert.deepEqual([fallbackExercise('assisted-pull-up').equipment, fallbackExercise('assisted-pull-up').assistance], ['assisted', true]);
  assert.equal(fallbackExercise('trap-bar-deadlift').equipment, 'barbell');
  assert.equal(fallbackExercise('machine-row').pattern, 'horizontal-pull');
});

/* ------------------------------------------------------------------ summaries */

test('summarize: per exercise, tonnage without warm-ups or assistance, hard sets, minutes', () => {
  const logged = [
    ...sets(30, [8], 2, { kind: 'warmup', slotId: 'A1', exerciseId: 'machine-chest-press' }),
    ...sets(60, [10, 10, 10, 10], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }),
    ...sets(50, [7, 6, 6], 2, { slotId: 'A2', exerciseId: 'lat-pulldown' }),
    ...sets(40, [12, 11], 5, { slotId: 'B1', exerciseId: 'assisted-pull-up' }),
    set({ sessionId: 'other', kg: 200, reps: 10 }),
  ];
  const s = summarize(sess(), logged, CATALOG);
  assert.deepEqual(s.perExercise.map((e) => [e.exerciseId, e.sets, e.topSet?.kg, e.topSet?.reps]), [
    ['machine-chest-press', 4, 60, 10], ['lat-pulldown', 3, 50, 7], ['assisted-pull-up', 2, 40, 12],
  ]);
  assert.equal(s.perExercise[0].e1rm, 85.2);
  assert.equal(s.perExercise[2].e1rm, 0, 'reps + RIR > 12: no reliable e1RM');
  assert.equal(s.tonnage, 60 * 40 + 50 * 19);
  assert.equal(s.hardSets, 7, 'RIR 5 sets are not hard');
  assert.equal(s.minutes, 70);
  assert.equal(summarize(sess({ status: 'active', endedAt: null }), logged, CATALOG).minutes, 6, 'open session: to the last set');
});

test('summarize: the e1RM on the summary is the one the progress charts and PR lines compute (same load, same formula)', () => {
  const logged = [
    ...sets(0, [10, 9], 2, { slotId: 'A1', exerciseId: 'push-up' }), // hands carry ≈ 64 % of 80 kg: 51.2 kg × 12 total reps
    ...sets(0, [10], 2, { slotId: 'B1', exerciseId: 'hanging-leg-raise' }), // share of body weight unknown: no e1RM
    ...sets(5, [10], 2, { slotId: 'B2', exerciseId: 'back-extension-45' }), // likewise, even with 5 kg added
    ...sets(40, [8, 8], 2, { slotId: 'A2', exerciseId: 'assisted-pull-up' }), // 80 − 40 = 40 kg moved
    ...sets(60, [10, 10], 2, { slotId: 'A3', exerciseId: 'machine-chest-press' }),
  ];
  const s = summarize(sess(), logged, CATALOG);
  /** @param {string} id */
  const chart = (id) => {
    const loadOf = (x) => { const e = effectiveLoad(x, CATALOG.exerciseById(id), 80); return e.kg > 0 ? e.kg : null; };
    const best = e1rmSeries(logged, id, { loadOf }).find((p) => p.reliable);
    return best ? best.kg : 0;
  };
  assert.equal(s.perExercise.length, 5);
  for (const pe of s.perExercise) assert.ok(Math.abs(pe.e1rm - chart(pe.exerciseId)) < 0.01, `${pe.exerciseId}: summary ${pe.e1rm}, charts ${chart(pe.exerciseId)}`);
  assert.deepEqual(s.perExercise.map((pe) => pe.e1rm), [72.7, 0, 0, 53.33, 85.2]);
  assert.equal(s.tonnage, 5 * 10 + 60 * 20, 'added load counts in the tonnage; assistance does not');
  assert.equal(summarize(sess({ bodyweightKg: null }), logged, CATALOG).perExercise[0].e1rm, 0, 'no body weight: no push-up e1RM');
});

/* ------------------------------------------------------------------ applying a session */

test('applySession: progress, hold, new exercise, skipped slots; pure and idempotent', () => {
  const p = program();
  const states = { ...recentStates(), 'machine-chest-press': state({ workingKg: 60, targetReps: 10, repRange: [6, 10], rir: 2, e1rm: 80, sessions: 5, lastAt: '2026-11-07T17:30:00.000Z' }) };
  const before = structuredClone(states);
  const logged = [
    ...sets(30, [8], 2, { kind: 'warmup', slotId: 'A1', exerciseId: 'machine-chest-press' }),
    ...sets(60, [10, 10, 10, 10], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }),
    ...sets(50, [7, 6, 6], 2, { slotId: 'A2', exerciseId: 'lat-pulldown' }),
    ...sets(20, [10, 10, 10], 1, { slotId: 'A3', exerciseId: 'pec-deck' }),
    ...sets(99, [1], 0, { sessionId: 'another', slotId: 'A4', exerciseId: 'machine-row' }),
  ];
  const r = applySession({ program: p, session: sess(), sets: logged, states, catalog: CATALOG, now: LATER });
  assert.deepEqual(states, before, 'input states untouched');
  assert.deepEqual(r.outcomes.map((o) => `${o.slotId}:${o.exerciseId}:${o.outcome}`), [
    'A1:machine-chest-press:progressed', 'A2:lat-pulldown:held', 'A3:pec-deck:progressed',
    'A4:machine-row:held', 'A5:machine-shoulder-press:held', 'A6:machine-crunch:held',
  ]);
  const mcp = r.states['machine-chest-press'];
  assert.deepEqual([mcp.workingKg, mcp.targetReps, mcp.sessions, mcp.updatedAt], [65, 6, 6, LATER]);
  assert.equal(mcp.lastAt, logged[4].doneAt, 'lastAt = the last working set');
  assert.deepEqual([r.states['lat-pulldown'].workingKg, r.states['lat-pulldown'].targetReps], [50, 7]);
  const pec = r.states['pec-deck'];
  assert.deepEqual([pec.workingKg, pec.targetReps, pec.repRange, pec.sessions], [20, 11, [10, 15], 1]);
  assert.match(r.outcomes[3].note.en, /^Skipped last time/);
  assert.equal(r.states['machine-row'], undefined, 'no state is invented for a skipped slot');
  const crunch = r.states['machine-crunch'];
  assert.deepEqual([crunch.workingKg, crunch.targetReps, crunch.sessions, crunch.lastAt], [20, 9, 5, '2026-11-07T17:50:00.000Z']);
  assert.equal(crunch.note?.en, 'Skipped last time: targets unchanged. +2.5 kg soon.');
  assert.deepEqual(r.changed.map((s) => s.exerciseId).sort(), ['lat-pulldown', 'machine-chest-press', 'machine-crunch', 'pec-deck']);
  // applying the same session again changes nothing
  const again = applySession({ program: p, session: sess(), sets: logged, states: r.states, catalog: CATALOG, now: '2026-11-11T08:00:00.000Z' });
  assert.deepEqual(again.changed, []);
  assert.deepEqual(again.states, r.states);
  assert.deepEqual(again.outcomes.map((o) => o.outcome), r.outcomes.map((o) => o.outcome));
});

test('applySession: substitutes get their own state; breaks and goal switches calibrate; deloads hold', () => {
  const p = program();
  const states = recentStates();
  // performed the converging press in slot A1: seeded from the machine press, which is left alone
  let r = applySession({ program: p, session: sess(), sets: sets(50, [8, 8, 8, 8], 2, { slotId: 'A1', exerciseId: 'converging-chest-press' }), states, catalog: CATALOG, now: LATER });
  const conv = r.states['converging-chest-press'];
  assert.deepEqual([conv.exerciseId, conv.workingKg, conv.sessions, conv.repRange], ['converging-chest-press', 50, 1, [6, 10]]);
  assert.equal(r.states['machine-chest-press'], states['machine-chest-press']);
  assert.equal(r.outcomes.find((o) => o.slotId === 'A1')?.exerciseId, 'converging-chest-press');
  // 20 days off and a bad day: calibration, not a failure
  const gapStates = { ...states, 'machine-chest-press': { ...states['machine-chest-press'], targetReps: 6, fails: 1, lastAt: '2026-10-20T17:00:00.000Z' } };
  r = applySession({ program: p, session: sess(), sets: sets(55, [4, 4, 3], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states: gapStates, catalog: CATALOG, now: LATER });
  assert.deepEqual([r.outcomes[0].outcome, r.states['machine-chest-press'].workingKg, r.states['machine-chest-press'].fails], ['held', 50, 0]);
  // the same bad day without a break: a failure, then the deload
  const failing = { ...states, 'machine-chest-press': { ...states['machine-chest-press'], targetReps: 6, fails: 1 } };
  r = applySession({ program: p, session: sess(), sets: sets(60, [4, 4, 3], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states: failing, catalog: CATALOG, now: LATER });
  assert.deepEqual([r.outcomes[0].outcome, r.states['machine-chest-press'].workingKg], ['deloaded', 50]);
  // deload week: nothing progresses, the session still counts
  const logged = [...sets(60, [10, 10], 4, { slotId: 'A1', exerciseId: 'machine-chest-press' }), ...sets(50, [6, 6], 4, { slotId: 'A2', exerciseId: 'lat-pulldown' })];
  r = applySession({ program: p, session: sess(), sets: logged, states, catalog: CATALOG, now: LATER, deload: true });
  const m = r.states['machine-chest-press'];
  assert.deepEqual([r.outcomes[0].outcome, m.workingKg, m.targetReps, m.sessions], ['held', 60, 8, 6]);
  assert.match(r.outcomes[0].note.en, /^Deload week/);
  // a deload week by the calendar, but this exercise is back from a break: it calibrates instead
  r = applySession({ program: p, session: sess(), sets: sets(55, [4, 4, 3], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states: gapStates, catalog: CATALOG, now: LATER, deload: true });
  assert.match(r.outcomes[0].note.en, /^Start lighter/);
  // first session after switching to strength: misses do not count as failures
  const strength = convertProgram(p, 'strength', '2026-11-09T00:00:00.000Z', { catalog: CATALOG });
  r = applySession({ program: strength, session: sess({ programId: strength.id }), sets: sets(65, [3, 3, 3, 2, 2], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states, catalog: CATALOG, now: LATER });
  const s = r.states['machine-chest-press'];
  assert.deepEqual([r.outcomes[0].outcome, s.fails, s.repRange, s.workingKg], ['held', 0, [3, 6], 60]);
  // only warm-ups logged for a slot = skipped
  r = applySession({ program: p, session: sess(), sets: sets(30, [8, 8], 2, { kind: 'warmup', slotId: 'A1', exerciseId: 'machine-chest-press' }), states, catalog: CATALOG, now: LATER });
  assert.match(r.outcomes.find((o) => o.slotId === 'A1')?.note.en ?? '', /^Skipped last time/);
});

test('applySession: a session done as planned after a break is judged against that plan', () => {
  // found by the simulation: 40 kg × 11 (the top of 6–10 widened for the 5 kg step), 20 days off → planned 35 kg × 11
  const p = program();
  let states = { 'machine-row': state({ exerciseId: 'machine-row', workingKg: 40, targetReps: 11, sessions: 6, lastAt: iso(Date.parse(NOW) - 20 * D) }) };
  let row = byExercise(planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG }), 'machine-row');
  assert.deepEqual([working(row)[0].weightKg, working(row)[0].reps], [35, 11]);
  // done exactly as planned: the widening goes on (12 reps; 40 kg is +14 % and 35 × 11 @ 2 allows +13 %), it does
  // not restart from the top of the range
  let r = applySession({ program: p, session: sess(), sets: sets(35, [11, 11, 11], 2, { slotId: 'A4', exerciseId: 'machine-row' }), states, catalog: CATALOG, now: LATER });
  let s = r.states['machine-row'];
  assert.deepEqual([r.outcomes.find((o) => o.slotId === 'A4')?.outcome, s.workingKg, s.targetReps], ['progressed', 35, 12]);
  // a step too coarse for the cut (25 kg: −7.1 % → the nearest pin is 25 kg): the plan is 2 fewer reps instead …
  states = { 'machine-row': state({ exerciseId: 'machine-row', workingKg: 25, targetReps: 11, sessions: 6, lastAt: iso(Date.parse(NOW) - 20 * D) }) };
  row = byExercise(planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG }), 'machine-row');
  assert.deepEqual([working(row)[0].weightKg, working(row)[0].reps], [25, 9]);
  assert.match(row.note?.en ?? '', /^20 days since last time: same 25 kg, 2 fewer reps \(9 reps\)/);
  // … and 25 kg × 9 done as planned is a made session (judged against 11 it would have been a hold), cut once
  r = applySession({ program: p, session: sess(), sets: sets(25, [9, 9, 9], 2, { slotId: 'A4', exerciseId: 'machine-row' }), states, catalog: CATALOG, now: LATER });
  s = r.states['machine-row'];
  assert.deepEqual([r.outcomes.find((o) => o.slotId === 'A4')?.outcome, s.workingKg, s.targetReps], ['progressed', 25, 10]);
  row = byExercise(planSession({ program: p, dayKey: 'A', states: r.states, settings, now: '2026-11-17T17:00:00.000Z', catalog: CATALOG }), 'machine-row');
  assert.deepEqual([working(row)[0].weightKg, working(row)[0].reps], [25, 10], 'the next plan is not cut again');
});

test('a first (test) session is never a deload: planned and judged as a test in a deload week too', () => {
  // found by the simulation: a new machine first used in a deload week was held as a deload and never calibrated
  const p = program();
  const a1 = byExercise(planSession({ program: p, dayKey: 'A', states: {}, settings, now: NOW, catalog: CATALOG, deload: true }), 'machine-chest-press');
  assert.deepEqual(working(a1), Array.from({ length: 4 }, () => ({ kind: 'working', weightKg: 20, reps: 6, rir: 2 })));
  assert.doesNotMatch(a1.note?.en ?? '', /Deload week/);
  // the test protocol: 20, 25, 30, then 35 kg × 6 with 3 in reserve → 35 kg is the working load, not the 20 kg start
  const logged = [20, 25, 30, 35].map((kg, i) => set({ kg, reps: 6, rir: 3, setIndex: i, slotId: 'A1', exerciseId: 'machine-chest-press' }));
  const r = applySession({ program: p, session: sess(), sets: logged, states: {}, catalog: CATALOG, now: LATER, deload: true });
  const s = r.states['machine-chest-press'];
  assert.doesNotMatch(r.outcomes[0].note.en, /^Deload week/);
  assert.deepEqual([r.outcomes[0].outcome, s.workingKg, s.targetReps, s.sessions], ['progressed', 35, 7, 1]);
});

test('engine rows pass the store validators (programs, exercise_state)', () => {
  const p = buildProgram({ now: CREATED, catalog: CATALOG });
  for (const row of [p, convertProgram(p, 'hypertrophy', NOW), withLegs(p, NOW), withLegs(p, NOW, { as: 'slots' })]) {
    assert.ok(isRow('programs', row), `program ${row.templateId} v${row.version}`);
    assert.match(row.id, /^[0-9a-f-]{36}$/);
  }
  const r = applySession({ program: p, session: sess(), sets: [
    ...sets(60, [10, 10, 10, 10], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }),
    ...sets(20, [10, 10, 10], 1, { slotId: 'A3', exerciseId: 'pec-deck' }),
  ], states: recentStates(), catalog: CATALOG, now: LATER });
  assert.ok(r.changed.length >= 2);
  for (const row of r.changed) assert.ok(isRow('exercise_state', row), row.exerciseId);
});

/* ------------------------------------------------------------------ the real catalog */

const root = fileURLToPath(new URL('../../', import.meta.url));
function realCatalog() {
  if (Array.isArray(exercisesJson) && exercisesJson.length > 0) return { source: 'exercises.json', list: exercisesJson };
  // not merged yet: whatever slice files are valid so far (missing ids fall back to the registry)
  const dir = `${root}content/fitness/exercises`;
  if (!existsSync(dir)) return null;
  const list = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    try {
      const data = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      const items = Array.isArray(data) ? data : data.exercises;
      if (Array.isArray(items)) list.push(...items.filter((e) => e && typeof e.id === 'string' && Array.isArray(e.repRange) && Array.isArray(e.alternatives)));
    } catch {
      /* another stream is still writing this slice */
    }
  }
  return list.length ? { source: 'slices', list } : null;
}
const real = realCatalog();

test(`buildProgram + planSession over the real catalog (${real?.source ?? 'none yet'})`, { skip: real ? false : 'no catalog data yet' }, () => {
  const catalog = catalogFrom(/** @type {any} */ (real?.list ?? []));
  for (const tpl of TEMPLATES.filter((t) => !t.addon)) {
    for (const goal of GOAL_IDS) {
      const p = withLegs(buildProgram({ templateId: tpl.id, goal, now: CREATED, catalog }), CREATED, { catalog });
      for (const day of p.days) {
        const plan = planSession({ program: p, dayKey: day.key, states: {}, settings, now: NOW, catalog, gym: gym() });
        assert.equal(plan.exercises.length, day.slots.length);
        assert.ok(plan.estimatedMinutes > 20 && plan.estimatedMinutes < 110, `${tpl.id}/${goal}/${day.key}: ${plan.estimatedMinutes} min`);
        for (const pe of plan.exercises) {
          const w = working(pe);
          assert.ok(w.length >= 1, `${tpl.id}/${goal}/${pe.slotId}`);
          for (const s of pe.sets) assert.ok(Number.isFinite(s.weightKg) && s.weightKg >= 0 && Number.isInteger(s.reps) && s.reps >= 1, `${tpl.id}/${goal}/${pe.slotId}: ${JSON.stringify(s)}`);
          for (const wu of warmups(pe)) assert.notEqual(wu.weightKg, w[0].weightKg, `${pe.slotId}: a warm-up equal to the working load`);
          assert.ok(pe.note?.en && pe.note.ru, `${pe.slotId}: note`);
        }
      }
    }
  }
});

test(`every exercise in the real catalog starts, progresses and warms up sanely (${real?.source ?? 'none yet'})`, { skip: real ? false : 'no catalog data yet' }, () => {
  const list = /** @type {any[]} */ (real?.list ?? []);
  for (const e of list) {
    let s = initialState(e, { bodyweightKg: 80, now: NOW });
    assert.ok(Number.isFinite(s.workingKg) && s.workingKg >= 0, `${e.id}: start ${s.workingKg}`);
    assert.ok(s.repRange[0] < s.repRange[1] && s.targetReps === s.repRange[0], `${e.id}: range`);
    assert.ok(s.note?.en && s.note.ru, `${e.id}: test protocol`);
    const step = e.repUnit === 'seconds' || e.repUnit === 'meters' ? 5 : 1;
    for (let i = 0; i < 5; i++) {
      // every set at the top of the range, at the target RIR
      const logged = Array.from({ length: 3 }, (_, k) => set({ exerciseId: e.id, kg: s.workingKg, reps: Math.max(s.targetReps, s.repRange[1]), rir: s.rir, setIndex: k }));
      const r = nextState(s, logged, { rule: 'double', repRange: s.repRange, rir: s.rir, stepPct: 2.5, failsBeforeDeload: 2, deloadPct: 10, overshootReps: 2 }, e, NOW, { bodyweightKg: 80 });
      assert.ok(['progressed', 'held'].includes(r.outcome), `${e.id}: ${r.outcome}`);
      assert.ok(Number.isFinite(r.state.workingKg) && r.state.workingKg >= 0, `${e.id}: ${r.state.workingKg}`);
      assert.ok(r.state.targetReps >= s.repRange[0] && r.state.targetReps <= repCeiling(e, s.repRange[1]), `${e.id}: target ${r.state.targetReps}`);
      if (e.repUnit === 'seconds' || e.repUnit === 'meters') assert.ok(r.state.targetReps <= s.repRange[1] + 2 * step, `${e.id}: hold/carry target ${r.state.targetReps}`);
      if (isAssisted(e)) assert.ok(r.state.workingKg <= s.workingKg, `${e.id}: assistance only goes down`);
      else assert.ok(r.state.workingKg >= s.workingKg, `${e.id}: load only goes up`);
      s = r.state;
    }
    for (const w of warmupRamp(s.workingKg, e, s.e1rm, { bodyweightKg: 80, targetReps: s.targetReps, rir: s.rir })) {
      assert.ok(isAssisted(e) ? w.weightKg > s.workingKg : w.weightKg < s.workingKg, `${e.id}: warm-up ${w.weightKg} vs ${s.workingKg}`);
    }
  }
});

/* ------------------------------------------------------------------ master plan §16 (2026-11-09) */

test('applySession (§16 rule 4): fewer working sets than planned hold; the screen count wins over the slot', () => {
  const p = program(); // A1 machine chest press: 4 × 6–10
  const states = recentStates(); // 60 kg × 8
  const two = sets(60, [8, 8], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' });
  // without a count: the slot's 4 sets → 2 of 4 hold, the target stays, the note says why
  let r = applySession({ program: p, session: sess(), sets: two, states, catalog: CATALOG, now: LATER });
  let s = r.states['machine-chest-press'];
  assert.deepEqual([r.outcomes[0].outcome, s.workingKg, s.targetReps, s.fails], ['held', 60, 8, 0]);
  assert.match(r.outcomes[0].note.en, /^Only 2 of 4 working sets logged/);
  // the screen planned 2 (e.g. sets removed on purpose): a complete session
  r = applySession({ program: p, session: sess(), sets: two, states, catalog: CATALOG, now: LATER, plannedSets: { 'machine-chest-press': 2 } });
  s = r.states['machine-chest-press'];
  assert.deepEqual([r.outcomes[0].outcome, s.targetReps], ['progressed', 9]);
  // every planned set: progression as usual
  r = applySession({ program: p, session: sess(), sets: sets(60, [8, 8, 8, 8], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states, catalog: CATALOG, now: LATER });
  assert.equal(r.states['machine-chest-press'].targetReps, 9);
  // a substitute counts against the rows it was given (keyed by the performed exercise)
  r = applySession({ program: p, session: sess(), sets: sets(50, [8, 8, 8], 2, { slotId: 'A1', exerciseId: 'converging-chest-press' }), states, catalog: CATALOG, now: LATER, plannedSets: { 'converging-chest-press': 3 } });
  assert.notEqual(r.outcomes[0].outcome, 'held');
  assert.doesNotMatch(r.outcomes[0].note.en, /working sets logged/);
});

test('planSession (§16): a weight hold is said once; it blocks the step but not the reps', () => {
  const p = program();
  const until = '2026-11-20T00:00:00.000Z';
  const day = new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const states = { ...recentStates(), 'machine-chest-press': { ...recentStates()['machine-chest-press'], holdUntil: until } };
  let a1 = planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG }).exercises[0];
  assert.equal(a1.note?.en.split(day).length, 2, `once: ${a1.note?.en}`);
  assert.match(a1.note?.en ?? '', new RegExp(`^Weight held until ${day}\\.`));
  assert.match(a1.note?.ru ?? '', /^Вес зафиксирован до \d+ \S+/);
  // a session at the top while held: the engine's note names the date, the plan does not repeat it
  const r = applySession({ program: p, session: sess(), sets: sets(60, [10, 10, 10, 10], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states: { 'machine-chest-press': { ...states['machine-chest-press'], targetReps: 10 } }, catalog: CATALOG, now: LATER });
  const s = r.states['machine-chest-press'];
  assert.deepEqual([r.outcomes[0].outcome, s.workingKg, s.targetReps, s.holdUntil], ['held', 60, 10, until]);
  a1 = planSession({ program: p, dayKey: 'A', states: r.states, settings, now: '2026-11-12T17:00:00.000Z', catalog: CATALOG }).exercises[0];
  assert.equal(a1.note?.en.split(day).length, 2, `once: ${a1.note?.en}`);
  assert.deepEqual([working(a1)[0].weightKg, working(a1)[0].reps], [60, 10]);
  // after the date: no line, and the next session steps up as usual
  a1 = planSession({ program: p, dayKey: 'A', states, settings, now: '2026-11-21T17:00:00.000Z', catalog: CATALOG }).exercises[0];
  assert.doesNotMatch(a1.note?.en ?? '', /held until/);
});

test('a weight hold survives a rep-range change: planned and applied at the same load, the date said once', () => {
  // states from 8–12 (an older program version, a goal switch or an edited slot) meet the 6–10 slots: 40 kg × 12 @ 2
  // would convert to 45 kg × 6; held until 1 Dec it stays 40 kg, at 10 reps (the same 14 reps in all)
  const p = program();
  const until = new Date(2026, 11, 1).toISOString(); // local midnight, so "1 Dec" in any time zone
  const states = { 'machine-chest-press': state({ workingKg: 40, targetReps: 12, repRange: [8, 12], sessions: 5, lastAt: '2026-11-07T17:30:00.000Z', holdUntil: until }) };
  const a1 = planSession({ program: p, dayKey: 'A', states, settings, now: NOW, catalog: CATALOG }).exercises[0];
  assert.deepEqual([a1.exerciseId, working(a1)[0].weightKg, working(a1)[0].reps], ['machine-chest-press', 40, 10]);
  assert.equal(a1.note?.en.split('1 Dec').length, 2, `the date once: ${a1.note?.en}`);
  assert.match(a1.note?.en ?? '', /New range 6–10: 40 kg × 10 reps \(the weight is held until 1 Dec\)/);
  // done as planned (and with a heavier last set the owner tried): no load increase before the date
  for (const logged of [sets(40, [10, 10, 10, 10], 2, { slotId: 'A1' }), [...sets(40, [10, 10, 10], 2, { slotId: 'A1' }), set({ slotId: 'A1', kg: 45, reps: 8, setIndex: 3 })]]) {
    const r = applySession({ program: p, session: sess(), sets: logged, states, catalog: CATALOG, now: LATER });
    const s = r.states['machine-chest-press'];
    assert.deepEqual([s.workingKg, s.repRange, s.holdUntil], [40, [6, 10], until], r.outcomes[0].note.en);
    assert.ok(s.targetReps <= 10, `target ${s.targetReps} stays in the range`);
  }
});

test('a weight hold whose date has passed is cleared by a deload-week session too; one still ahead stays', () => {
  const p = program();
  const passed = '2026-11-01T00:00:00.000Z'; // the session starts on 2026-11-10
  const ahead = '2026-11-20T00:00:00.000Z';
  const two = sets(60, [6, 6], 4, { slotId: 'A1', exerciseId: 'machine-chest-press' });
  for (const [until, expected] of [[passed, null], [ahead, ahead]]) {
    const states = { 'machine-chest-press': { ...recentStates()['machine-chest-press'], holdUntil: until } };
    const r = applySession({ program: p, session: sess(), sets: two, states, catalog: CATALOG, now: LATER, deload: true });
    const s = r.states['machine-chest-press'];
    assert.match(r.outcomes[0].note.en, /^Deload week/);
    assert.deepEqual([s.workingKg, s.targetReps, s.fails, s.sessions, s.holdUntil], [60, 8, 0, 6, expected], until);
    // the next plan: the deload week's note, no hold line either way it went
    const a1 = planSession({ program: p, dayKey: 'A', states: r.states, settings, now: '2026-11-21T17:00:00.000Z', catalog: CATALOG, deload: false }).exercises[0];
    assert.doesNotMatch(a1.note?.en ?? '', /held until|hold ended/, a1.note?.en);
  }
  // states without a hold do not grow the field
  const r = applySession({ program: p, session: sess(), sets: two, states: recentStates(), catalog: CATALOG, now: LATER, deload: true });
  assert.equal('holdUntil' in r.states['machine-chest-press'], false);
});

test('a weight hold whose date has passed is cleared when its slot is skipped or gets only warm-ups; one still ahead stays', () => {
  const p = program();
  const passed = '2026-11-01T00:00:00.000Z'; // the session starts on 2026-11-10
  const ahead = '2026-11-20T00:00:00.000Z';
  const a2 = sets(50, [7, 6, 6], 2, { slotId: 'A2', exerciseId: 'lat-pulldown' });
  const warmup = sets(30, [8], 2, { kind: 'warmup', slotId: 'A1', exerciseId: 'machine-chest-press' });
  const skippedBefore = { en: 'Skipped last time: targets unchanged. +5 kg soon.', ru: 'В прошлый раз пропущено: цели без изменений. +5 кг скоро.' };
  for (const deload of [false, true]) {
    for (const [what, logged] of [['skipped', a2], ['warm-up only', [...warmup, ...a2]]]) {
      for (const note of [undefined, skippedBefore]) {
        for (const [until, expected] of [[passed, null], [ahead, ahead]]) {
          const held = { ...recentStates()['machine-chest-press'], holdUntil: until, ...(note ? { note } : {}) };
          const states = { ...recentStates(), 'machine-chest-press': held };
          const at = `${what}, deload ${deload}, ${note ? 'skipped before' : 'first skip'}, hold ${until}`;
          const r = applySession({ program: p, session: sess(), sets: logged, states, catalog: CATALOG, now: LATER, deload });
          const s = r.states['machine-chest-press'];
          assert.match(r.outcomes.find((o) => o.slotId === 'A1')?.note.en ?? '', /^Skipped last time/, at);
          // the numbers stay; the skip is marked once; only a hold that has passed goes
          assert.deepEqual([s.workingKg, s.targetReps, s.sessions, s.lastAt, s.holdUntil], [60, 8, 5, held.lastAt, expected], at);
          assert.match(s.note?.en ?? '', /^Skipped last time: targets unchanged\./, at);
          assert.doesNotMatch(s.note?.en ?? '', /Skipped last time.*Skipped last time/, at);
          // written when anything changed, so the cleared hold reaches the store; re-applying changes nothing
          assert.equal(r.changed.some((x) => x.exerciseId === 'machine-chest-press'), !note || expected === null, at);
          const again = applySession({ program: p, session: sess(), sets: logged, states: r.states, catalog: CATALOG, now: LATER, deload });
          assert.deepEqual(again.states, r.states, at);
          assert.deepEqual(again.changed, [], at);
        }
      }
    }
  }
  // advice that still names the hold that ended gives way to the line the plan shows for it, as before the hold was cleared
  const top = { en: `Every set reached 10 reps, but the weight is held until ${holdDay(passed, 'en')}. Keep 60 kg × 10 reps.`, ru: `Все подходы дошли до 10 повторений, но вес зафиксирован до ${holdDay(passed, 'ru')}. Оставьте 60 кг × 10 повторений.` };
  const ended = { en: `The weight hold ended (${holdDay(passed, 'en')}): hit the target on every set and the weight can go up again.`, ru: `Фиксация веса закончилась (${holdDay(passed, 'ru')}): выполните цель во всех подходах, и вес снова может расти.` };
  for (const note of [top, { en: `Skipped last time: targets unchanged. ${top.en}`, ru: `В прошлый раз пропущено: цели без изменений. ${top.ru}` }]) {
    const states = { ...recentStates(), 'machine-chest-press': { ...recentStates()['machine-chest-press'], holdUntil: passed, note } };
    const r = applySession({ program: p, session: sess(), sets: a2, states, catalog: CATALOG, now: LATER });
    const s = r.states['machine-chest-press'];
    assert.deepEqual([s.holdUntil, s.note], [null, { en: `Skipped last time: targets unchanged. ${ended.en}`, ru: `В прошлый раз пропущено: цели без изменений. ${ended.ru}` }]);
    const a1 = planSession({ program: p, dayKey: 'A', states: r.states, settings, now: '2026-11-12T17:00:00.000Z', catalog: CATALOG }).exercises[0];
    assert.equal(a1.note?.en, s.note.en);
    assert.doesNotMatch(a1.note?.en ?? '', /held until/);
  }
  // states without a hold do not grow the field
  const r = applySession({ program: p, session: sess(), sets: a2, states: recentStates(), catalog: CATALOG, now: LATER });
  assert.equal('holdUntil' in r.states['machine-chest-press'], false);
});

test('planSession (§16 rule 2): a state stuck at the top names the variant to move to, first among the alternatives', () => {
  const p = program();
  const c = (o) => ({ ...recentStates(), ...o });
  // the knee raise at the top of 8–12 with no load to add → the harder class-mate (hanging leg raise)
  const knee = state({ exerciseId: 'captains-chair-knee-raise', workingKg: 0, targetReps: 12, repRange: [8, 12], rir: 2, sessions: 6, lastAt: '2026-11-07T17:30:00.000Z' });
  const r = applySession({ program: p, session: sess({ dayKey: 'C' }), sets: sets(0, [12, 12, 12], 2, { slotId: 'C6', exerciseId: knee.exerciseId }), states: { [knee.exerciseId]: knee }, catalog: CATALOG, now: LATER });
  assert.equal(r.states[knee.exerciseId].variant, 'harder');
  let pe = byExercise(planSession({ program: p, dayKey: 'C', states: c(r.states), settings, now: '2026-11-12T17:00:00.000Z', catalog: CATALOG }), knee.exerciseId);
  assert.equal(pe.alternatives[0], 'hanging-leg-raise');
  assert.match(pe.note?.en ?? '', /harder variant.*Harder variant: hanging-leg-raise\./);
  assert.match(pe.note?.ru ?? '', /Сложнее: hanging-leg-raise\./);
  // not available at this gym: no suggestion, no line
  pe = byExercise(planSession({ program: p, dayKey: 'C', states: c(r.states), settings, now: '2026-11-12T17:00:00.000Z', catalog: CATALOG, gym: gym({ missing: ['hanging-leg-raise'] }) }), knee.exerciseId);
  assert.doesNotMatch(pe.note?.en ?? '', /Harder variant/);
  // the hammer curl at 6 kg × 20 (the isolation ceiling) with 2 kg dumbbell steps (+33 %, too big for 20 @ 1) → the
  // variant whose step is the smallest part of its load: the reverse curl (2.5 kg on 12.5 kg), not the cable curl
  // (2.5 on 10)
  const hammer = state({ exerciseId: 'hammer-curl', workingKg: 6, targetReps: 20, repRange: [10, 15], rir: 1, sessions: 9, lastAt: '2026-11-07T17:30:00.000Z' });
  const h = applySession({ program: p, session: sess({ dayKey: 'C' }), sets: sets(6, [20, 20], 1, { slotId: 'C5', exerciseId: 'hammer-curl' }), states: { 'hammer-curl': hammer }, catalog: CATALOG, now: LATER });
  assert.deepEqual([h.states['hammer-curl'].lastOutcome, h.states['hammer-curl'].variant], ['held', 'smaller-steps']);
  pe = byExercise(planSession({ program: p, dayKey: 'C', states: c(h.states), settings, now: '2026-11-12T17:00:00.000Z', catalog: CATALOG }), 'hammer-curl');
  assert.equal(pe.alternatives[0], 'reverse-curl');
  assert.match(pe.note?.en ?? '', /too big.*Smaller steps: reverse-curl\./);
  assert.match(pe.note?.ru ?? '', /Меньше шаг: reverse-curl\./);
  // no flag, no line
  pe = byExercise(planSession({ program: p, dayKey: 'C', states: recentStates(), settings, now: NOW, catalog: CATALOG }), 'hammer-curl');
  assert.doesNotMatch(pe.note?.en ?? '', /Smaller steps|Harder variant/);
});

test('plateau memory (§16 rule 5) through applySession and planSession: deload weeks, short logs and breaks keep it; a new range forgets it', () => {
  const p = program(); // A1 machine chest press: 4 × 6–10 @ 2, 5 kg steps
  const memo = { kg: 65, times: 1, streak: 1 };
  const states = { 'machine-chest-press': state({ workingKg: 60, targetReps: 10, repRange: [6, 10], rir: 2, e1rm: 80, sessions: 5, lastAt: '2026-11-07T17:30:00.000Z', plateau: memo }) };
  const top = sets(60, [10, 10, 10, 10], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' });
  const a1 = (r) => r.states['machine-chest-press'];
  // a deload week evaluates nothing: the memory and its streak stay as they were; so does 1 of 4 sets (rule 4)
  let r = applySession({ program: p, session: sess(), sets: top, states, catalog: CATALOG, now: LATER, deload: true });
  assert.deepEqual([r.outcomes[0].outcome, a1(r).workingKg, a1(r).plateau], ['held', 60, memo]);
  r = applySession({ program: p, session: sess(), sets: top.slice(0, 1), states, catalog: CATALOG, now: LATER, deload: false });
  assert.deepEqual([r.outcomes[0].outcome, a1(r).workingKg, a1(r).plateau], ['held', 60, memo]);
  // the second top session in a row: 65 kg (+8.3 %), the streak back to 0
  r = applySession({ program: p, session: sess(), sets: top, states, catalog: CATALOG, now: LATER, deload: false });
  assert.deepEqual([r.outcomes[0].outcome, a1(r).workingKg, a1(r).targetReps, a1(r).plateau], ['progressed', 65, 6, { kg: 65, times: 1, streak: 0 }]);
  // the first one: held at the top, and the next plan says why
  const first = { 'machine-chest-press': { ...states['machine-chest-press'], plateau: { ...memo, streak: 0 } } };
  r = applySession({ program: p, session: sess(), sets: top, states: first, catalog: CATALOG, now: LATER, deload: false });
  assert.deepEqual([r.outcomes[0].outcome, a1(r).workingKg, a1(r).targetReps, a1(r).plateau], ['held', 60, 10, memo]);
  const pe = planSession({ program: p, dayKey: 'A', states: r.states, settings, now: '2026-11-12T17:00:00.000Z', catalog: CATALOG, deload: false }).exercises[0];
  assert.deepEqual([working(pe)[0].weightKg, working(pe)[0].reps], [60, 10]);
  assert.match(pe.note?.en ?? '', /the next step \(65 kg\) ended in a deload last time: keep 60 kg × 10 reps for 1 more session/);
  assert.match(pe.note?.ru ?? '', /следующий шаг \(65 кг\) в прошлый раз закончился разгрузкой/);
  // 20 days off: the first session back (55 kg after the cut) is a test; it keeps the memory, and the cut to another
  // load starts the streak over
  const away = { 'machine-chest-press': { ...states['machine-chest-press'], lastAt: '2026-10-21T17:00:00.000Z' } };
  r = applySession({ program: p, session: sess(), sets: sets(55, [8, 8, 8, 8], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states: away, catalog: CATALOG, now: LATER, deload: false });
  assert.deepEqual([a1(r).workingKg, a1(r).plateau], [55, { ...memo, streak: 0 }]);
  // a goal switch (a new rep range) converts the state and forgets it
  const strength = convertProgram(p, 'strength', '2026-11-09T00:00:00.000Z', { catalog: CATALOG });
  r = applySession({ program: strength, session: sess({ programId: strength.id }), sets: sets(65, [4, 4, 4, 4, 4], 2, { slotId: 'A1', exerciseId: 'machine-chest-press' }), states, catalog: CATALOG, now: LATER });
  assert.deepEqual([a1(r).repRange, a1(r).plateau], [[3, 6], null]);
  // a substitute starts its own state without it
  r = applySession({ program: p, session: sess(), sets: sets(50, [8, 8, 8, 8], 2, { slotId: 'A1', exerciseId: 'converging-chest-press' }), states, catalog: CATALOG, now: LATER });
  assert.equal('plateau' in r.states['converging-chest-press'], false);
  assert.ok(isRow('exercise_state', a1(applySession({ program: p, session: sess(), sets: top, states, catalog: CATALOG, now: LATER, deload: false }))));
});
