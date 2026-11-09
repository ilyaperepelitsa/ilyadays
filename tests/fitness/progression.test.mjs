// Stream 03 — progression engine (src/lib/fitness/progression.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertState, deloadPlan, deloadSets, deloadWeek, e1rmFactor, e1rmOf, firstSessionTestProtocol, gapAdjust,
  initialState, loadForE1rm, loadFraction, maxStepFraction, nextState, pctOf1rm, repCeiling, roundLoad, startingLoad,
  substituteState, warmupRamp,
} from '../../src/lib/fitness/progression.mjs';
import { e1rm as analyticsE1rm } from '../../src/lib/fitness/analytics.mjs';
import { RULES, buildProgram } from '../../src/lib/fitness/templates.mjs';
import { CATALOG, ex, fx, gym, params, set, sets, state } from './engine-fixtures.mjs';

const NOW = '2026-11-10T18:00:00.000Z';
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const mcp = ex('machine-chest-press'); // selectorized, +5 kg
const plate = ex('plate-loaded-chest-press'); // +2.5 kg
const assisted = ex('assisted-pull-up'); // assistance, +5 kg
const dumbbell = ex('dumbbell-bench-press'); // +2 kg per hand
const plank = ex('plank'); // seconds
const carry = ex('farmers-carry'); // metres, +2 kg per hand
const bwEx = ex('captains-chair-knee-raise'); // bodyweight, no increment

/* ------------------------------------------------------------------ rounding */

test('roundLoad: equipment steps, directions, gym overrides', () => {
  assert.equal(roundLoad(62, mcp), 60);
  assert.equal(roundLoad(63, mcp), 65);
  assert.equal(roundLoad(61, mcp, null, 'up'), 65);
  assert.equal(roundLoad(64, mcp, null, 'down'), 60);
  assert.equal(roundLoad(64, mcp, null, 'easier'), 60);
  assert.equal(roundLoad(61, mcp, null, 'harder'), 65);
  // microplates at this gym, by exercise id or by equipment type
  assert.equal(roundLoad(61.25, mcp, gym({ increments: { 'machine-chest-press': 1.25 } })), 61.25);
  assert.equal(roundLoad(61.3, mcp, gym({ increments: { selectorized: 2.5 } })), 62.5);
  // never negative; a positive load on a machine is at least one step
  assert.equal(roundLoad(0, mcp), 0);
  assert.equal(roundLoad(-3, mcp), 0);
  assert.equal(roundLoad(1, mcp), 5);
  assert.equal(roundLoad(Number.NaN, mcp), 0);
});

test('roundLoad: assisted machines (lower = harder) and dumbbells (per hand)', () => {
  assert.equal(roundLoad(32, assisted, null, 'easier'), 35, 'easier = more assistance');
  assert.equal(roundLoad(32, assisted, null, 'harder'), 30, 'harder = less assistance');
  assert.equal(roundLoad(2, assisted), 0, 'zero assistance is a real setting');
  assert.equal(roundLoad(13, dumbbell), 14);
  assert.equal(roundLoad(13, dumbbell, null, 'easier'), 12);
  assert.equal(roundLoad(13, dumbbell, null, 'harder'), 14);
  assert.equal(roundLoad(0.5, dumbbell), 2, 'the lightest dumbbell, not 0');
  assert.equal(roundLoad(7.5, bwEx), 7.5, 'no increment: kept as logged');
});

/* ------------------------------------------------------------------ e1RM and %1RM */

test('e1RM: Epley/Brzycki blend, reliability cut-off, exact inverse, %1RM table', () => {
  assert.deepEqual(e1rmOf(60, 10, 2), { kg: 85.2, reliable: true });
  assert.equal(e1rmOf(100, 10, 3).reliable, false, 'reps + RIR > 12 is unreliable');
  assert.equal(e1rmOf(100, 1, 0).kg, 100);
  close(loadForE1rm(e1rmOf(80, 8, 2).kg, 8, 2), 80);
  for (let r = 2; r <= 35; r++) assert.ok(e1rmFactor(r) > e1rmFactor(r - 1), `monotonic at ${r}`);
  close(e1rmFactor(36), 1 + 36 / 30, 1e-9); // Epley alone from 36 (Brzycki explodes near 37), as analytics defines it
  assert.equal(pctOf1rm(1), 100);
  assert.equal(pctOf1rm(10), 75);
  assert.equal(pctOf1rm(10.5), 73.75);
  assert.ok(pctOf1rm(25) < pctOf1rm(20) && pctOf1rm(21) < pctOf1rm(20));
  close(maxStepFraction(6, 10, 2), 42 / 38 - 1, 1e-9);
});

/* ------------------------------------------------------------------ warm-up ramps */

test('warm-up ramp: compounds ramp 50/70/85 % when heavy, one set when light', () => {
  assert.deepEqual(warmupRamp(85, mcp, 100), [
    { kind: 'warmup', weightKg: 45, reps: 8 },
    { kind: 'warmup', weightKg: 60, reps: 4 },
    { kind: 'warmup', weightKg: 70, reps: 2 },
  ]);
  assert.deepEqual(warmupRamp(60, mcp, 100), [{ kind: 'warmup', weightKg: 30, reps: 8 }]);
  // no e1RM yet: heavy when target reps + RIR ≤ 8
  assert.equal(warmupRamp(60, mcp, 0, { targetReps: 6, rir: 2 }).length, 3);
  assert.equal(warmupRamp(60, mcp, 0, { targetReps: 10, rir: 2 }).length, 1);
  // every ramp set is lighter than the working load and the ramp climbs
  for (const kg of [10, 15, 20, 35, 50, 85, 120]) {
    const r = warmupRamp(kg, mcp, kg * 1.15);
    r.forEach((s, i) => {
      assert.ok(s.weightKg < kg, `${kg}: ${s.weightKg} lighter`);
      if (i) assert.ok(s.weightKg > r[i - 1].weightKg, `${kg}: climbing`);
    });
  }
});

test('warm-up ramp: isolation feeler set, none for holds/carries/bodyweight, assisted adds assistance', () => {
  const pec = ex('pec-deck');
  assert.deepEqual(warmupRamp(30, pec, 0, { targetReps: 10, rir: 1 }), [{ kind: 'warmup', weightKg: 15, reps: 8 }]);
  assert.deepEqual(warmupRamp(15, pec, 0, { targetReps: 10, rir: 1 }), [], 'too light to bother');
  assert.deepEqual(warmupRamp(0, plank, 0), []);
  assert.deepEqual(warmupRamp(20, carry, 0), []);
  assert.deepEqual(warmupRamp(0, bwEx, 0), []);
  assert.deepEqual(warmupRamp(40, assisted, 0, { targetReps: 8, rir: 2 }), [{ kind: 'warmup', weightKg: 50, reps: 8 }]);
  assert.deepEqual(warmupRamp(40, assisted, 0, { targetReps: 8, rir: 2, bodyweightKg: 80 }), [{ kind: 'warmup', weightKg: 60, reps: 8 }]);
});

/* ------------------------------------------------------------------ first loads */

test('starting loads: conservative, bodyweight-scaled, rounded to the easier side', () => {
  const m50 = fx('machine-chest-press', { startLoad: { kg: 50, source: 'test' } });
  assert.equal(startingLoad(m50), 40, '50 × 0.85 → 40');
  assert.equal(startingLoad(m50, { bodyweightKg: 100 }), 45);
  assert.equal(startingLoad(m50, { bodyweightKg: 60 }), 35);
  // assisted: more assistance for a heavier or lighter lifter as needed; never above bodyweight
  assert.equal(startingLoad(assisted), 55);
  assert.equal(startingLoad(assisted, { bodyweightKg: 85 }), 55);
  assert.equal(startingLoad(assisted, { bodyweightKg: 110 }), 75);
  assert.ok(startingLoad(assisted, { bodyweightKg: 60 }) <= 60);
  assert.equal(startingLoad(carry), 16, '20 kg per hand × 0.85 → 16');
  assert.equal(startingLoad(fx('barbell-bench-press', { equipment: 'barbell', increment: 2.5 })), 20, 'the empty bar');
  assert.equal(startingLoad(bwEx), 0);
});

test('initialState: bottom of the range, sessions 0, test protocol note', () => {
  const s = initialState(mcp, { now: NOW, repRange: [6, 10], rir: 2 });
  assert.deepEqual(
    { ...s, note: undefined },
    { exerciseId: 'machine-chest-press', workingKg: 20, targetReps: 6, repRange: [6, 10], rir: 2, e1rm: 0, lastOutcome: 'init', fails: 0, sessions: 0, baseline: { status: 'learning' }, lastAt: null, note: undefined, updatedAt: NOW },
  );
  assert.match(s.note?.en ?? '', /^First time on this exercise/);
  assert.match(s.note?.ru ?? '', /^Первый раз/);
  // role ranges by unit when no range is given
  assert.deepEqual(initialState(plank, { now: NOW }).repRange, [20, 40]);
  const c = initialState(carry, { now: NOW });
  assert.deepEqual([c.repRange, c.workingKg, c.targetReps], [[20, 40], 16, 20]);
  assert.match(firstSessionTestProtocol(plank).en, /hold for 20 s/);
  assert.match(firstSessionTestProtocol(carry).en, /carry 20 m/);
  assert.match(firstSessionTestProtocol(assisted).en, /take off 5 kg/);
  assert.match(firstSessionTestProtocol(bwEx).en, /reps left in the tank/);
});

/* ------------------------------------------------------------------ double progression */

test('double progression: + reps until the top, then + load back at the bottom', () => {
  let r = nextState(state({ workingKg: 60, targetReps: 9 }), sets(60, [9, 9, 9]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 60, 10]);
  assert.equal(r.state.e1rm, e1rmOf(60, 9, 2).kg);
  assert.equal(r.state.sessions, 4);
  assert.equal(r.state.lastAt, sets(60, [9, 9, 9]).at(-1)?.doneAt);
  assert.match(r.note.en, /aim for 10 reps/);
  r = nextState(r.state, sets(60, [10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.fails], ['progressed', 65, 6, 0]);
  assert.match(r.note.en, /^\+5 kg next time \(65 kg × 6 reps\)/);
  assert.equal(r.state.e1rm, 85.2, 'best e1RM kept');
  // the weakest set leads: 9, 8, 9 at target 8 → next target 9
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [9, 8, 9]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.targetReps], ['progressed', 9]);
});

test("capacity guard (§16 rule 2): load goes up only when the weakest set still carries the floor at the target RIR", () => {
  // Epley on the weakest set: the new load may be (30 + reps + RIR) / (30 + bottom + target RIR) × the old one.
  // 40 kg × 10 @ 2 allows +10.5 % (42 / 38), the next pin is +12.5 % → 11 reps first; 40 × 11 @ 2 allows +13.2 % → 45 × 6
  let r = nextState(state({ workingKg: 40, targetReps: 10 }), sets(40, [10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 40, 11]);
  r = nextState(r.state, sets(40, [11, 11, 11]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 45, 6]);
  // the weakest set decides: one set at 11 with 1 in reserve (12 in all) is a set at 10 @ 2
  r = nextState(state({ workingKg: 40, targetReps: 11 }), [set({ kg: 40, reps: 11, rir: 2, setIndex: 0 }), set({ kg: 40, reps: 11, rir: 1, setIndex: 1 })], params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 40, 12]);
  // 25 kg × 10 @ 2: 30 kg (+20 %) needs 14 reps at RIR 2 (46 / 38 = 1.21) → more reps first, one at a time
  const seen = [];
  let s = state({ workingKg: 25, targetReps: 10 });
  for (let i = 0; i < 6; i++) {
    r = nextState(s, sets(s.workingKg, [s.targetReps, s.targetReps, s.targetReps]), params(), mcp, NOW);
    seen.push(`${r.outcome}:${r.state.workingKg}x${r.state.targetReps}`);
    s = r.state;
  }
  assert.deepEqual(seen, ['progressed:25x11', 'progressed:25x12', 'progressed:25x13', 'progressed:25x14', 'progressed:30x6', 'progressed:30x7']);
  // reps in reserve count: 25 kg × 12 with 4 in reserve (16 in all) carries 30 kg at once
  r = nextState(state({ workingKg: 25, targetReps: 12 }), sets(25, [12, 12, 12], 4), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 30, 6]);
  // the note says why the weight stays
  r = nextState(state({ workingKg: 25, targetReps: 10 }), sets(25, [10, 10, 10]), params(), mcp, NOW);
  assert.match(r.note.en, /big jump at this weight: earn it with 11 reps at 25 kg first/);
  assert.equal(r.state.variant, undefined, 'no flag while reps can still grow');
});

test('capacity guard: isolation reps go up to 20 (compounds 15), then a flag for a variant with smaller steps', () => {
  assert.deepEqual([repCeiling(mcp, 10), repCeiling(ex('hammer-curl'), 15), repCeiling(ex('face-pull'), 20), repCeiling(ex('leg-press-45'), 12)], [15, 20, 20, 15]);
  // hammer curl 8 → 10 kg per hand is +25 %: at RIR 1 that needs 21.25 reps in all (41 × 1.25 − 30), so 16 … 20
  // reps do not carry it; at the ceiling the weight stays and the state is flagged
  const hammer = ex('hammer-curl');
  const P = params({ repRange: [10, 15], rir: 1 });
  let s = state({ exerciseId: hammer.id, workingKg: 8, targetReps: 15, repRange: [10, 15], rir: 1 });
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const r = nextState(s, sets(s.workingKg, [s.targetReps, s.targetReps], 1), P, hammer, NOW);
    seen.push(`${r.outcome}:${r.state.workingKg}x${r.state.targetReps}:${r.state.variant}`);
    s = r.state;
  }
  assert.deepEqual(seen, ['progressed:8x16:undefined', 'progressed:8x17:undefined', 'progressed:8x18:undefined', 'progressed:8x19:undefined', 'progressed:8x20:undefined', 'held:8x20:smaller-steps']);
  // 20 reps with one more in reserve (22 in all) carry 10 kg: the step, the flag cleared
  const up = nextState(s, sets(8, [20, 20], 2), P, hammer, NOW);
  assert.deepEqual([up.outcome, up.state.workingKg, up.state.targetReps, up.state.variant], ['progressed', 10, 10, null]);
  // face pull 7.5 → 10 kg is +33 %: at 20 reps (its top and the ceiling) still too big → held, flagged, said
  const fp = ex('face-pull');
  const Q = params({ repRange: [12, 20], rir: 1 });
  let r = nextState(state({ exerciseId: fp.id, workingKg: 7.5, targetReps: 20, repRange: [12, 20], rir: 1 }), sets(7.5, [20, 20], 1), Q, fp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant, r.state.fails], ['held', 7.5, 20, 'smaller-steps', 0]);
  assert.match(r.note.en, /too big/);
  assert.match(r.note.ru, /слишком/);
  // even "4+" in reserve (the most the tracker logs) does not carry +33 %: still flagged
  const flagged = r.state;
  r = nextState(flagged, sets(7.5, [20, 20], 4), Q, fp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant], ['held', 7.5, 20, 'smaller-steps']);
  // micro-plates at this gym make the step small enough; the flag clears with the step
  r = nextState(flagged, sets(7.5, [20, 20], 1), Q, fp, NOW, { gym: gym({ increments: { 'face-pull': 1.25 } }) });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant], ['progressed', 8.75, 12, null]);
  // at 10 kg the next pin is +25 %: flagged at RIR 1, carried when every set had 4 in reserve (RIR is never ignored)
  r = nextState(state({ exerciseId: fp.id, workingKg: 10, targetReps: 20, repRange: [12, 20], rir: 1 }), sets(10, [20, 20], 1), Q, fp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.variant], ['held', 10, 'smaller-steps']);
  r = nextState(r.state, sets(10, [20, 20], 4), Q, fp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant], ['progressed', 12.5, 12, null]);
});

test('hold: a missed target keeps the load; RIR within 1 of the target still counts', () => {
  let r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 7, 8]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.fails], ['held', 60, 8, 0]);
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8], 0), params(), mcp, NOW);
  assert.equal(r.outcome, 'held', 'RIR 0 against a target of 2 is too hard');
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8], 1), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.targetReps], ['progressed', 9]);
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8], null), params(), mcp, NOW);
  assert.equal(r.outcome, 'progressed', 'missing RIR counts as on target');
  // a set that had to go lighter is a miss; a failed heavier working attempt blocks progress too
  r = nextState(state({ workingKg: 60, targetReps: 9 }), [set({ kg: 60, reps: 9, setIndex: 0 }), set({ kg: 60, reps: 9, setIndex: 1 }), set({ kg: 55, reps: 9, setIndex: 2 })], params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 60, 9]);
  r = nextState(state({ workingKg: 60, targetReps: 9 }), [set({ kg: 60, reps: 9, setIndex: 0 }), set({ kg: 60, reps: 9, setIndex: 1 }), set({ kg: 65, reps: 5, setIndex: 2 })], params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['failed', 60, 6]);
  // warm-ups never count; no working sets → held with a note
  r = nextState(state({ workingKg: 60, targetReps: 9 }), [...sets(30, [8], 2, { kind: 'warmup' }), ...sets(60, [9, 9, 9])], params(), mcp, NOW);
  assert.equal(r.outcome, 'progressed');
  r = nextState(state({ workingKg: 60, targetReps: 9 }), sets(30, [8, 4], 2, { kind: 'warmup' }), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.sessions], ['held', 60, 9, 3]);
});

test('fails below the range: failed, then a deload after failsBeforeDeload sessions', () => {
  let r = nextState(state({ exerciseId: plate.id, workingKg: 60, targetReps: 6 }), sets(60, [5, 5, 4]), params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.fails, r.state.targetReps], ['failed', 60, 1, 6]);
  assert.match(r.note.en, /miss 1 of 2/);
  r = nextState(r.state, sets(60, [5, 4, 4]), params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.fails], ['deloaded', 52.5, 0]);
  assert.match(r.note.en, /−10 %/);
  // strength mode waits for three
  let s = state({ exerciseId: plate.id, workingKg: 60, targetReps: 3, repRange: [3, 6] });
  const out = [];
  for (let i = 0; i < 3; i++) {
    const q = nextState(s, sets(60, [2, 2, 2]), params({ repRange: [3, 6], failsBeforeDeload: 3 }), plate, NOW);
    out.push(`${q.outcome}:${q.state.workingKg}`);
    s = q.state;
  }
  assert.deepEqual(out, ['failed:60', 'failed:60', 'deloaded:52.5']);
  // a good session in between resets the count
  r = nextState(state({ workingKg: 60, targetReps: 6, fails: 1 }), sets(60, [6, 6, 6]), params(), mcp, NOW);
  assert.equal(r.state.fails, 0);
  // at the lightest setting of a machine the deload cannot go lower, and the note says so: no "drop to", no percentage
  r = nextState(state({ workingKg: 5, targetReps: 6, fails: 1 }), sets(5, [3, 3, 3]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg], ['deloaded', 5]);
  assert.equal(r.note.en, '2 sessions in a row below 6 reps: stay at 5 kg and build back up.');
  assert.equal(r.note.ru, '2 тренировки подряд меньше 6 повторений: оставайтесь с 5 кг и наберите заново.');
});

test('overshoot: first set ≥ top + 2 with reps to spare → double step, capped at +10 %', () => {
  const first = [set({ kg: 100, reps: 12, rir: 3, setIndex: 0 }), set({ kg: 100, reps: 10, rir: 2, setIndex: 1 }), set({ kg: 100, reps: 10, rir: 2, setIndex: 2 })];
  let r = nextState(state({ exerciseId: plate.id, workingKg: 100, targetReps: 10 }), first, params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 105, 6]);
  assert.match(r.note.en, /big jump: the first set went 12 reps/);
  r = nextState(state({ exerciseId: plate.id, workingKg: 100, targetReps: 10 }), sets(100, [10, 10, 10]), params(), plate, NOW);
  assert.equal(r.state.workingKg, 102.5, 'a normal single step');
  // the double step never exceeds +10 %
  r = nextState(state({ exerciseId: plate.id, workingKg: 20, targetReps: 10 }), [set({ kg: 20, reps: 14, rir: 4, setIndex: 0 }), set({ kg: 20, reps: 10, setIndex: 1 })], params(), plate, NOW);
  assert.ok(r.state.workingKg <= 25, `${r.state.workingKg}`);
  // … also after rounding (found by the simulation): +10 % of 40 kg is 44 kg, off the 2.5 kg grid → 42.5, not 45 (+12.5 %)
  r = nextState(state({ exerciseId: plate.id, workingKg: 40, targetReps: 10 }), [set({ kg: 40, reps: 12, rir: 3, setIndex: 0 }), set({ kg: 40, reps: 10, rir: 2, setIndex: 1 }), set({ kg: 40, reps: 10, rir: 2, setIndex: 2 })], params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 42.5, 6]);
});

test('first session (calibration): the best set re-anchors the load; misses do not count', () => {
  // started too heavy: 4, 4, 3 at 40 kg against 6–10 → lighter start, no failure recorded
  let r = nextState(state({ workingKg: 40, targetReps: 6, sessions: 0 }), sets(40, [4, 4, 3]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.fails, r.state.sessions], ['held', 35, 6, 0, 1]);
  assert.match(r.note.en, /^Start lighter/);
  // started too light: 9 reps at 40 kg on a +2.5 kg machine → a heavier working load
  r = nextState(state({ exerciseId: plate.id, workingKg: 40, targetReps: 6, sessions: 0 }), sets(40, [9, 9, 9]), params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 42.5, 6]);
  assert.match(r.note.en, /^Test done/);
  // ramp-up sets in a test session are not misses; the load lifted most becomes the plan
  r = nextState(state({ workingKg: 30, targetReps: 6, sessions: 0 }), [set({ kg: 30, reps: 6, setIndex: 0 }), set({ kg: 40, reps: 6, setIndex: 1 }), set({ kg: 50, reps: 6, setIndex: 2 })], params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 50, 7]);
  // an explicit calibration (after a long gap) behaves the same
  r = nextState(state({ workingKg: 60, targetReps: 8, sessions: 4, fails: 1 }), sets(60, [3, 3]), params(), mcp, NOW, { calibration: true });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.fails], ['held', 50, 0]);
  // a set with reps + RIR = bottom + RIR + 1 implies exactly its own load (found by the simulation): the e1RM's
  // 0.01 kg rounding (51.714 → 51.71) must not cost a whole plate — 40 kg × 5 @ 4 keeps 40 kg, not 35
  r = nextState(state({ workingKg: 40, targetReps: 6, sessions: 0 }), [set({ kg: 40, reps: 6, rir: 2, setIndex: 0 }), set({ kg: 40, reps: 5, rir: 4, setIndex: 1 })], params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.e1rm], ['held', 40, 6, 51.71]);
  // … and its note keeps it: "Start lighter" only names a lighter load
  assert.equal(r.note.en, 'First sessions on this exercise: misses do not count yet. Keep 40 kg and aim for 6 reps.');
  // no assistance is the hardest setting, and the best set does not ask for any: a set below the range keeps it
  r = nextState(state({ exerciseId: assisted.id, workingKg: 0, targetReps: 6, repRange: [6, 12], sessions: 0 }), [...sets(0, [8, 8], 2), set({ kg: 0, reps: 4, rir: 0, setIndex: 2 })], params({ repRange: [6, 12] }), assisted, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.fails], ['held', 0, 6, 0]);
  assert.equal(r.note.en, 'First sessions on this exercise: misses do not count yet. Keep no assistance and aim for 6 reps.');
  assert.equal(r.note.ru, 'Первые тренировки в этом упражнении: неудачи пока не считаются. Оставьте без помощи, цель — 6 повторений.');
  // a lighter plan still starts lighter (more assistance is lighter)
  r = nextState(state({ exerciseId: assisted.id, workingKg: 10, targetReps: 6, repRange: [6, 12], sessions: 0 }), sets(10, [8, 5, 4], 0), params({ repRange: [6, 12] }), assisted, NOW, { bodyweightKg: 80 });
  assert.equal(r.note.en, 'Start lighter: assistance 15 kg × 6 reps, so every set stays in the range.');
  assert.equal(r.note.ru, 'Начните легче: помощь 15 кг × 6 повторений, чтобы каждый подход укладывался в диапазон.');
  // a bodyweight exercise with no load step (found by the simulation): the test sets the reps, never an invented
  // "bodyweight + 2.58 kg" from the e1RM
  r = nextState(state({ exerciseId: bwEx.id, workingKg: 0, targetReps: 8, repRange: [8, 12], sessions: 0 }), sets(0, [11, 11, 11], 1), params({ repRange: [8, 12] }), bwEx, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 0, 12]);
});

test('holds progress by +5 s and stop at the top; carries add metres, then load', () => {
  const hold = params({ repRange: [20, 40] });
  let r = nextState(state({ exerciseId: 'plank', workingKg: 0, targetReps: 30, repRange: [20, 40] }), sets(0, [30, 30]), hold, plank, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 0, 35]);
  assert.match(r.note.en, /35 s/);
  assert.equal(r.state.e1rm, 0, 'no e1RM for holds');
  r = nextState({ ...r.state, targetReps: 40 }, sets(0, [40, 40]), hold, plank, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 0, 40]);
  assert.match(r.note.en, /harder variant/);

  r = nextState(state({ exerciseId: 'farmers-carry', workingKg: 20, targetReps: 30, repRange: [20, 40] }), sets(20, [30, 30]), hold, carry, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 20, 35]);
  r = nextState({ ...r.state, targetReps: 40 }, sets(20, [40, 40]), hold, carry, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 22, 20]);
  assert.match(r.note.en, /22 kg per hand × 20 m/);
});

test('assisted machines progress by taking assistance OFF', () => {
  const p = params({ repRange: [8, 12] });
  let r = nextState(state({ exerciseId: assisted.id, workingKg: 40, targetReps: 13, repRange: [8, 12] }), sets(40, [13, 13, 13]), p, assisted, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 35, 8]);
  assert.match(r.note.en, /^5 kg less assistance/);
  // the capacity guard works on the effective load (bodyweight − assistance): 12 reps with 40 kg moved carry +10 %
  // (44 / 40), 45 kg moved is +12.5 % → 13 reps first; with 25 kg moved (55 kg assistance) the next step is +20 %
  r = nextState(state({ exerciseId: assisted.id, workingKg: 40, targetReps: 12, repRange: [8, 12] }), sets(40, [12, 12, 12]), p, assisted, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 40, 13]);
  assert.match(r.note.en, /earn it with 13 reps at assistance 40 kg first/);
  r = nextState(r.state, sets(40, [13, 13, 13]), p, assisted, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 35, 8]);
  r = nextState(state({ exerciseId: assisted.id, workingKg: 55, targetReps: 12, repRange: [8, 12] }), sets(55, [12, 12, 12]), p, assisted, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 55, 13]);
  // assistance only comes off when every set hit the target: one set short holds
  r = nextState(state({ exerciseId: assisted.id, workingKg: 40, targetReps: 13, repRange: [8, 12] }), sets(40, [13, 12, 13]), p, assisted, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 40, 13]);
  // without a body weight the guard assumes the 80 kg reference: the same answers
  r = nextState(state({ exerciseId: assisted.id, workingKg: 55, targetReps: 12, repRange: [8, 12] }), sets(55, [12, 12, 12]), p, assisted, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 55, 13]);
  // a deload ADDS assistance
  r = nextState(state({ exerciseId: assisted.id, workingKg: 40, targetReps: 8, fails: 1, repRange: [8, 12] }), sets(40, [6, 5, 5]), p, assisted, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg], ['deloaded', 45]);
  r = nextState(state({ exerciseId: assisted.id, workingKg: 40, targetReps: 8, fails: 1, repRange: [8, 12] }), sets(40, [6, 5, 5]), p, assisted, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg], ['deloaded', 45]);
  // no assistance left: ready for the bodyweight version (flagged: planSession names the harder class-mate)
  r = nextState(state({ exerciseId: assisted.id, workingKg: 0, targetReps: 12, repRange: [8, 12] }), sets(0, [12, 12, 12]), p, assisted, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.variant], ['held', 0, 'harder']);
  assert.match(r.note.en, /No assistance left/);
  // e1RM uses the effective load (bodyweight − assistance)
  r = nextState(state({ exerciseId: assisted.id, workingKg: 40, targetReps: 8, repRange: [8, 12], e1rm: 0 }), sets(40, [8, 8, 8]), p, assisted, NOW, { bodyweightKg: 80 });
  assert.equal(r.state.e1rm, e1rmOf(40, 8, 2).kg);
});

test('other rules: linear (top only), rep-target (never adds load), rpe (load from the e1RM)', () => {
  let r = nextState(state({ workingKg: 60, targetReps: 10 }), sets(60, [10, 10, 10]), params({ rule: 'rep-target' }), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 60, 10]);
  r = nextState(state({ workingKg: 60, targetReps: 10 }), sets(60, [10, 10, 10]), params({ rule: 'linear' }), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg], ['progressed', 60]);
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8]), params({ rule: 'rpe' }), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 60, 9], 'never lighter after a good session');
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 7, 7], 0), params({ rule: 'rpe' }), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg], ['held', 55], 'grinding at RIR 0 → the e1RM says lighter');
});

test('rpe rule: the plan is the load the note names during a hold at the top, after a short log and in a test session', () => {
  const rpe = params({ rule: 'rpe' });
  const until = '2026-11-20T00:00:00.000Z'; // the sets are logged on 2026-11-10
  // a hold at the top says "Keep 100 kg × 10 reps": 100 kg, not the 97.5 kg the e1RM of 100 × 10 @ 1 plans
  let r = nextState(state({ exerciseId: plate.id, workingKg: 100, targetReps: 10, holdUntil: until }), sets(100, [10, 10, 10, 10], 1), rpe, plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.holdUntil], ['held', 100, 10, until]);
  assert.match(r.note.en, /Keep 100 kg × 10 reps\.$/);
  // 1 of 4 sets (rule 4) says "100 kg × 8 reps again next time": 100 kg, not the 107.5 kg of its e1RM
  r = nextState(state({ exerciseId: plate.id, workingKg: 100, targetReps: 8 }), sets(100, [10]), rpe, plate, NOW, { plannedSets: 4 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 100, 8]);
  assert.match(r.note.en, /: 100 kg × 8 reps again next time\.$/);
  // a test session re-anchors as under every other rule (one extra rep in reserve, rounded the easier way) and its note
  // names that load: 40 kg × 6 @ 5 → 42.5 kg (the e1RM without that margin planned 45 kg), a heavy start → 52.5 kg (was
  // 57.5 kg), and a ramp that reached a load that ended in a deload stops below it (rule 5)
  const ramp = [...sets(50, [6], 3), ...sets(55, [6, 6], 4)].map((x, i) => ({ ...x, setIndex: i }));
  /** @type {[import('../../src/lib/fitness/types').ExerciseState, import('../../src/lib/fitness/types').LoggedSet[], import('../../src/lib/fitness/types').Exercise, number, RegExp][]} */
  const tests = [
    [state({ exerciseId: plate.id, workingKg: 40, targetReps: 6, sessions: 0 }), sets(40, [6, 6, 6, 6], 5), plate, 42.5, /^Test done: working load 42\.5 kg × 6 reps from your best set\.$/],
    [state({ exerciseId: plate.id, workingKg: 60, targetReps: 6, sessions: 0 }), sets(60, [5, 4, 4, 4], 1), plate, 52.5, /^Start lighter: 52\.5 kg × 6 reps/],
    [state({ workingKg: 50, targetReps: 6, plateau: { kg: 55, times: 1, streak: 0 } }), ramp, mcp, 50, /^Test done: working load 50 kg × 6 reps\. Easier than 55 kg/],
  ];
  for (const [s, logged, x, kg, note] of tests) {
    const d = nextState(s, logged, params(), x, NOW, { calibration: true });
    r = nextState(s, logged, rpe, x, NOW, { calibration: true });
    assert.deepEqual([r.outcome, r.state, r.note], [d.outcome, d.state, d.note], `${x.id} ${s.workingKg} kg: as under double progression`);
    assert.equal(r.state.workingKg, kg);
    assert.match(r.note.en, note);
  }
});

test('rpe rule: where the e1RM moves the load away from the one the branch named, the note names the planned load', () => {
  const rpe = params({ rule: 'rpe', repRange: [6, 12] });
  const bw = { bodyweightKg: 80 };
  /** [what, state, sets, exercise, params, outcome, kg, target, EN, RU, EN under double progression] */
  const rows = [
    ['a miss at RIR 0', state({ workingKg: 60, targetReps: 8, repRange: [6, 12] }), sets(60, [5, 5, 5], 0), mcp, rpe, 'failed', 55, 6,
      'A set fell below 6 reps (miss 1 of 2). By effort: 55 kg × 6 reps next time (−5 kg).',
      'В подходе меньше 6 повторений (неудача 1 из 2). По усилию: 55 кг × 6 повторений в следующий раз (−5 кг).',
      'A set fell below 6 reps: keep 60 kg and aim for 6 reps (miss 1 of 2).'],
    ['a grind at RIR 0', state({ workingKg: 60, targetReps: 8, repRange: [6, 12] }), sets(60, [8, 7, 7], 0), mcp, rpe, 'held', 55, 8,
      'Not every set reached 8 reps with 2 in reserve. By effort: 55 kg × 8 reps next time (−5 kg).',
      'Не все подходы дошли до 8 повторений с запасом 2. По усилию: 55 кг × 8 повторений в следующий раз (−5 кг).',
      'Repeat 60 kg and aim for 8 reps: not every set reached 8 reps with 2 in reserve.'],
    ['the top of the range', state({ exerciseId: plate.id, workingKg: 100, targetReps: 10 }), sets(100, [10, 10, 10]), plate, params({ rule: 'rpe' }), 'progressed', 110, 6,
      'Every set reached 10 reps. By effort: 110 kg × 6 reps next time (+10 kg).',
      'Все подходы дошли до 10 повторений. По усилию: 110 кг × 6 повторений в следующий раз (+10 кг).',
      '+2.5 kg next time (102.5 kg × 6 reps): every set reached 10 reps.'],
    ['an easy set below the top', state({ exerciseId: plate.id, workingKg: 60, targetReps: 8, repRange: [6, 12] }), [set({ kg: 60, reps: 8, rir: 4, setIndex: 0 }), ...sets(60, [8, 8]).map((x, i) => ({ ...x, setIndex: i + 1 }))], plate, rpe, 'progressed', 62.5, 9,
      'Every set reached 8 reps. By effort: 62.5 kg × 9 reps next time (+2.5 kg).',
      'Все подходы дошли до 8 повторений. По усилию: 62,5 кг × 9 повторений в следующий раз (+2,5 кг).',
      'Same load (60 kg), aim for 9 reps on every set: all sets reached 8 reps.'],
    ['a miss on an assisted machine', state({ exerciseId: assisted.id, workingKg: 40, targetReps: 8, repRange: [6, 12] }), sets(40, [5, 5, 5], 0), assisted, rpe, 'failed', 45, 6,
      'A set fell below 6 reps (miss 1 of 2). By effort: assistance 45 kg × 6 reps next time (5 kg more assistance).',
      'В подходе меньше 6 повторений (неудача 1 из 2). По усилию: помощь 45 кг × 6 повторений в следующий раз (на 5 кг больше помощи).',
      'A set fell below 6 reps: keep assistance 40 kg and aim for 6 reps (miss 1 of 2).'],
  ];
  for (const [what, s, logged, x, P, outcome, kg, target, en, ru, double] of rows) {
    const r = nextState(s, logged, P, x, NOW, bw);
    assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], [outcome, kg, target], what);
    assert.equal(r.note.en, en, what);
    assert.equal(r.note.ru, ru, what);
    assert.deepEqual(r.state.note, r.note, what);
    // the same session under double progression keeps the load its note names, as before
    const d = nextState(s, logged, { ...P, rule: 'double' }, x, NOW, bw);
    assert.equal(d.note.en, double, `${what}, double`);
  }
  // where the e1RM lands on the load the branch named, the branch's note stays (60 kg × 9 after 60 kg × 8, 8, 8 @ 2)
  const r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8]), params({ rule: 'rpe' }), mcp, NOW);
  assert.deepEqual([r.state.workingKg, r.note.en], [60, 'Same load (60 kg), aim for 9 reps on every set: all sets reached 8 reps.']);
});

test('notes on assisted machines and bodyweight with added load read naturally in RU (EN unchanged)', () => {
  const p8 = params({ repRange: [8, 12] });
  const bw = { bodyweightKg: 80 };
  /** @param {import('../../src/lib/fitness/types').ExerciseState} s @param {import('../../src/lib/fitness/types').LoggedSet[]} logged @param {import('../../src/lib/fitness/types').Exercise} x @param {object} [o] @param {ReturnType<typeof params>} [P] */
  const run = (s, logged, x, o = bw, P = p8) => nextState(s, logged, P, x, NOW, o);
  const a = (o) => state({ exerciseId: assisted.id, repRange: [8, 12], ...o });
  const g25 = { ...bw, gym: gym({ increments: { [assisted.id]: 2.5 } }) };
  const reached = (kg, n) => [...sets(kg + 5, [8], 3), ...sets(kg, Array(n).fill(8), 4)].map((x, i) => ({ ...x, setIndex: i }));
  // a test session: "рабочая помощь", not "рабочий вес помощь"
  let r = run(a({ workingKg: 40, targetReps: 6, repRange: [6, 10], sessions: 0 }), sets(40, [8, 8, 8, 8], 4), assisted, g25, params());
  assert.equal(r.note.en, 'Test done: working load assistance 37.5 kg × 6 reps from your best set.');
  assert.equal(r.note.ru, 'Тест пройден: рабочая помощь 37,5 кг × 6 повторений по лучшему подходу.');
  r = run(a({ workingKg: 45, targetReps: 8, plateau: { kg: 40, times: 1, streak: 0 } }), reached(40, 2), assisted, { ...bw, calibration: true });
  assert.equal(r.note.ru, 'Тест пройден: рабочая помощь 45 кг × 8 повторений. Пока легче, чем с помощью 40 кг: в прошлый раз эта нагрузка закончилась разгрузкой.');
  // a deload adds assistance: "увеличьте помощь до", not "снизьте до помощь"
  r = run(a({ workingKg: 40, targetReps: 8, fails: 1 }), sets(40, [6, 5, 5]), assisted);
  assert.equal(r.note.en, '2 sessions in a row below 8 reps: drop to assistance 45 kg (−10 %) and build back up.');
  assert.equal(r.note.ru, '2 тренировки подряд меньше 8 повторений: увеличьте помощь до 45 кг (−10 % нагрузки) и наберите заново.');
  // reps before a step too big (rule 2), and at the rep ceiling: "с помощью", not "с помощь"
  r = run(a({ workingKg: 40, targetReps: 12 }), sets(40, [12, 12, 12]), assisted);
  assert.equal(r.note.en, 'The next step (5 kg) is a big jump at this weight: earn it with 13 reps at assistance 40 kg first.');
  assert.equal(r.note.ru, 'Следующий шаг (5 кг) — большой скачок для этой нагрузки: сначала сделайте 13 повторений с помощью 40 кг.');
  r = run(a({ workingKg: 60, targetReps: 15 }), sets(60, [15, 15, 15]), assisted);
  assert.deepEqual([r.outcome, r.state.variant], ['held', 'smaller-steps']);
  assert.equal(r.note.ru, 'Следующий шаг (5 кг) слишком велик даже после 15 повторений с помощью 60 кг: оставьте эту нагрузку и возьмите вариант с меньшим шагом или микроблины.');
  // more reps at the same setting: "Та же нагрузка (помощь 40 кг)", not "Тот же вес (помощь 40 кг)"
  r = run(a({ workingKg: 40, targetReps: 8 }), sets(40, [8, 8, 8]), assisted);
  assert.equal(r.note.en, 'Same load (assistance 40 kg), aim for 9 reps on every set: all sets reached 8 reps.');
  assert.equal(r.note.ru, 'Та же нагрузка (помощь 40 кг), цель — 9 повторений в каждом подходе: все подходы дошли до 8 повторений.');
  r = run(a({ workingKg: 0, targetReps: 8 }), sets(0, [8, 8, 8]), assisted);
  assert.equal(r.note.ru, 'Та же нагрузка (без помощи), цель — 9 повторений в каждом подходе: все подходы дошли до 8 повторений.');
  // a missed target: "Повторите с помощью 40 кг", not "Повторите помощь 40 кг"
  r = run(a({ workingKg: 40, targetReps: 10 }), sets(40, [10, 9, 9]), assisted);
  assert.equal(r.note.en, 'Repeat assistance 40 kg and aim for 10 reps: not every set reached 10 reps with 2 in reserve.');
  assert.equal(r.note.ru, 'Повторите с помощью 40 кг, цель — 10 повторений: не все подходы дошли до 10 повторений с запасом 2.');
  // after a break: "начните с помощью", not "начните с помощь"; the cut is of the load, as more assistance is lighter
  let g = gapAdjust(a({ workingKg: 40, targetReps: 8 }), 20, NOW, { exercise: assisted, ...bw });
  assert.equal(g.note?.en, '20 days since last time: start at assistance 45 kg (−12.5 %) to find your groove again.');
  assert.equal(g.note?.ru, '20 дней с прошлого раза: начните с помощью 45 кг (−12,5 % нагрузки), чтобы вернуться в ритм.');
  g = gapAdjust(a({ workingKg: 40, targetReps: 8 }), 40, NOW, { exercise: assisted, ...bw });
  assert.equal(g.note?.ru, '40 дней без этого упражнения: начните заново с помощью 45 кг (−12,5 % нагрузки) от нижней границы диапазона; первая тренировка — тестовая.');
  // bodyweight + added load (45° back extension): "рабочее отягощение", "снизьте отягощение до", "с отягощением",
  // "со своим весом", not "рабочий вес свой вес", "снизьте до свой вес" or "с свой вес"
  const be = ex('back-extension-45');
  const b = (o) => state({ exerciseId: be.id, repRange: [8, 12], ...o });
  const g40 = { ...bw, gym: gym({ increments: { [be.id]: 40 } }) };
  r = run(b({ workingKg: 10, targetReps: 8, sessions: 0 }), sets(10, [8, 8, 8], 4), be);
  assert.equal(r.note.en, 'Test done: working load bodyweight + 12.5 kg × 8 reps from your best set.');
  assert.equal(r.note.ru, 'Тест пройден: рабочее отягощение 12,5 кг × 8 повторений по лучшему подходу.');
  r = run(b({ workingKg: 10, targetReps: 8, fails: 1 }), sets(10, [6, 5, 5]), be);
  assert.equal(r.note.ru, '2 тренировки подряд меньше 8 повторений: снизьте отягощение до 7,5 кг (−10 %) и наберите заново.');
  r = run(b({ workingKg: 2.5, targetReps: 8, fails: 1 }), sets(2.5, [6, 5, 5]), be);
  assert.equal(r.note.en, '2 sessions in a row below 8 reps: drop to bodyweight (−10 %) and build back up.');
  assert.equal(r.note.ru, '2 тренировки подряд меньше 8 повторений: уберите отягощение (−10 %) и наберите заново.');
  r = run(b({ workingKg: 40, targetReps: 12 }), sets(40, [12, 12, 12]), be, g40);
  assert.equal(r.note.ru, 'Следующий шаг (40 кг) — большой скачок для этой нагрузки: сначала сделайте 13 повторений с отягощением 40 кг.');
  r = run(b({ workingKg: 0, targetReps: 20 }), sets(0, [20, 20, 20]), be, g40);
  assert.equal(r.note.ru, 'Следующий шаг (40 кг) слишком велик даже после 20 повторений со своим весом: оставьте эту нагрузку и возьмите вариант с меньшим шагом или микроблины.');
  r = run(b({ workingKg: 0, targetReps: 8 }), sets(0, [8, 8, 8]), be);
  assert.equal(r.note.en, 'Same load (bodyweight), aim for 9 reps on every set: all sets reached 8 reps.');
  assert.equal(r.note.ru, 'Та же нагрузка (свой вес), цель — 9 повторений в каждом подходе: все подходы дошли до 8 повторений.');
  r = run(b({ workingKg: 10, targetReps: 8 }), sets(10, [8, 8, 8]), be);
  assert.equal(r.note.ru, 'Та же нагрузка (свой вес + 10 кг), цель — 9 повторений в каждом подходе: все подходы дошли до 8 повторений.');
  r = run(b({ workingKg: 10, targetReps: 10 }), sets(10, [10, 9, 9]), be);
  assert.equal(r.note.ru, 'Повторите с отягощением 10 кг, цель — 10 повторений: не все подходы дошли до 10 повторений с запасом 2.');
  g = gapAdjust(b({ workingKg: 20, targetReps: 10 }), 20, NOW, { exercise: be, ...bw });
  assert.equal(g.note?.ru, '20 дней с прошлого раза: начните с отягощением 17,5 кг (−12,5 %), чтобы вернуться в ритм.');
  g = gapAdjust(b({ workingKg: 0, targetReps: 10 }), 40, NOW, { exercise: be, ...bw });
  assert.equal(g.note?.ru, '40 дней без этого упражнения: начните заново со своим весом от нижней границы диапазона; первая тренировка — тестовая.');
  // plain loads read as before: "рабочий вес 42,5 кг", "снизьте до 45 кг", "с 50 кг", "Повторите 60 кг", "начните с 55 кг"
  r = run(state({ exerciseId: plate.id, workingKg: 40, targetReps: 6, sessions: 0 }), sets(40, [6, 6, 6, 6], 5), plate, {}, params());
  assert.equal(r.note.ru, 'Тест пройден: рабочий вес 42,5 кг × 6 повторений по лучшему подходу.');
  r = run(state({ workingKg: 50, targetReps: 6, fails: 1 }), sets(50, [5, 5, 5]), mcp, {}, params());
  assert.equal(r.note.ru, '2 тренировки подряд меньше 6 повторений: снизьте до 45 кг (−10 %) и наберите заново.');
  r = run(state({ workingKg: 25, targetReps: 10 }), sets(25, [10, 10, 10]), mcp, {}, params());
  assert.equal(r.note.ru, 'Следующий шаг (5 кг) — большой скачок для этого веса: сначала сделайте 11 повторений с 25 кг.');
  const fp = ex('face-pull');
  r = run(state({ exerciseId: fp.id, workingKg: 7.5, targetReps: 20, repRange: [12, 20], rir: 1 }), sets(7.5, [20, 20], 1), fp, {}, params({ repRange: [12, 20], rir: 1 }));
  assert.equal(r.note.ru, 'Следующий шаг (2,5 кг) слишком велик даже после 20 повторений с 7,5 кг: оставьте этот вес и возьмите вариант с меньшим шагом или микроблины.');
  r = run(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8]), mcp, {}, params());
  assert.equal(r.note.ru, 'Тот же вес (60 кг), цель — 9 повторений в каждом подходе: все подходы дошли до 8 повторений.');
  r = run(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 7, 7]), mcp, {}, params());
  assert.match(r.note.ru, /^Повторите 60 кг, цель — 8 повторений/);
});

test('a deload with no lighter load to go to (bodyweight only) keeps the load and says so, with no percentage', () => {
  // the captain's chair knee raise (C6 of the default program, no load step) at bodyweight, a second session below 8 reps
  for (const rule of ['double', 'rep-target']) {
    const r = nextState(state({ exerciseId: bwEx.id, workingKg: 0, targetReps: 8, repRange: [8, 12], fails: 1 }), sets(0, [6, 6, 6], 0), params({ rule, repRange: [8, 12] }), bwEx, NOW, { bodyweightKg: 80 });
    assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.fails], ['deloaded', 0, 8, 0], rule);
    assert.equal(r.note.en, '2 sessions in a row below 8 reps: stay at bodyweight and build back up.', rule);
    assert.equal(r.note.ru, '2 тренировки подряд меньше 8 повторений: оставайтесь со своим весом и наберите заново.', rule);
  }
  // with a load step too (the 45° back extension), when there is no added load to take off
  const be = ex('back-extension-45');
  let r = nextState(state({ exerciseId: be.id, workingKg: 0, targetReps: 8, repRange: [8, 12], fails: 1 }), sets(0, [6, 5, 5]), params({ repRange: [8, 12] }), be, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg], ['deloaded', 0]);
  assert.equal(r.note.ru, '2 тренировки подряд меньше 8 повторений: оставайтесь со своим весом и наберите заново.');
  // added load still comes off: "уберите отягощение (−10 %)" is right at 2.5 kg
  r = nextState(state({ exerciseId: be.id, workingKg: 2.5, targetReps: 8, repRange: [8, 12], fails: 1 }), sets(2.5, [6, 5, 5]), params({ repRange: [8, 12] }), be, NOW, { bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.note.ru], ['deloaded', 0, '2 тренировки подряд меньше 8 повторений: уберите отягощение (−10 %) и наберите заново.']);
});

/* ------------------------------------------------------------------ gaps */

test('gap rules: < 14 days keep, 14–27 days −5→−10 %, ≥ 28 days −10→−15 % and reset', () => {
  // an id the catalog does not know: the load is scaled exactly (no equipment rounding)
  const s = state({ exerciseId: 'not-in-the-catalog', workingKg: 60, targetReps: 8, fails: 1 });
  const g = (d, o) => gapAdjust(s, d, NOW, o);
  assert.deepEqual([g(13.9).outcome, g(13.9).pct, g(13.9).state], [null, 0, s]);
  assert.deepEqual([g(14).outcome, g(14).pct, g(14).state.workingKg, g(14).state.targetReps, g(14).state.fails], ['deloaded', 5, 57, 8, 1]);
  assert.equal(g(21).pct, 7.5);
  assert.equal(g(27).pct, 9.6);
  assert.deepEqual([g(28).outcome, g(28).pct, g(28).state.workingKg, g(28).state.targetReps, g(28).state.fails], ['reset', 10, 54, 6, 0]);
  assert.equal(g(59).pct, 12.5);
  assert.equal(g(90).pct, 15);
  assert.equal(g(400).pct, 15);
  assert.match(g(21).note?.en ?? '', /^21 days since last time/);
  assert.match(g(30).note?.en ?? '', /first session counts as a test/);
  // rounded to the NEAREST step (§16 rule 1)
  assert.equal(g(14, { exercise: mcp }).state.workingKg, 55);
  assert.equal(gapAdjust(state({ exerciseId: assisted.id, workingKg: 40 }), 30, NOW, { exercise: assisted }).state.workingKg, 45, 'more assistance');
  assert.equal(gapAdjust(state({ exerciseId: assisted.id, workingKg: 40 }), 30, NOW, { exercise: assisted, bodyweightKg: 80 }).state.workingKg, 45);
});

/* ------------------------------------------------------------------ conversion and substitution */

test('convertState: through the %1RM table, round trip, rounding and units', () => {
  const s = state({ workingKg: 100, targetReps: 5, repRange: [3, 6], rir: 2 });
  const c = convertState(s, [3, 6], [8, 12], { now: NOW });
  assert.deepEqual([c.workingKg, c.targetReps, c.repRange, c.rir, c.lastOutcome, c.fails], [90.36, 8, [8, 12], 2, 'converted', 0]);
  assert.match(c.note?.en ?? '', /^New range 8–12/);
  // strength ↔ hypertrophy and back from the bottom of the range returns the same load
  const b = state({ workingKg: 100, targetReps: 3, repRange: [3, 6], rir: 2 });
  const there = convertState(b, [3, 6], [8, 12]);
  const back = convertState(there, [8, 12], [3, 6]);
  close(back.workingKg, 100, 0.02);
  assert.deepEqual([back.targetReps, back.repRange], [3, [3, 6]]);
  // with an exercise the load is rounded down to the stack; a lower RIR target means a heavier load
  assert.equal(convertState(s, [3, 6], [8, 12], { exercise: mcp }).workingKg, 90);
  assert.ok(convertState(s, [3, 6], [8, 12], { rir: 1 }).workingKg > c.workingKg);
  // holds keep their load, only the range moves
  const h = convertState(state({ exerciseId: 'plank', workingKg: 0, targetReps: 30, repRange: [20, 40] }), [20, 40], [30, 45], { exercise: plank });
  assert.deepEqual([h.workingKg, h.targetReps, h.repRange], [0, 30, [30, 45]]);
});

test('substituteState: 85 % of the equivalent load, equipment ratios, fresh calibration', () => {
  const from = state({ workingKg: 50, targetReps: 8, rir: 2, e1rm: 0 });
  const sub = (id) => substituteState(from, mcp, ex(id), { now: NOW });
  assert.equal(sub('converging-chest-press').workingKg, 40, 'same family: 85 %');
  assert.equal(sub('barbell-bench-press').workingKg, 52.5, 'machine → barbell: ÷ 0.8');
  assert.equal(sub('dumbbell-bench-press').workingKg, 22, 'machine → dumbbells per hand: × 0.42 / 0.8');
  assert.equal(sub('smith-bench-press').workingKg, 50);
  assert.equal(sub('pec-deck').workingKg, 30, 'another pattern: 60 %');
  for (const id of ['converging-chest-press', 'pec-deck']) {
    const s = sub(id);
    assert.deepEqual([s.exerciseId, s.sessions, s.lastOutcome, s.targetReps, s.lastAt], [id, 0, 'init', 8, null]);
    assert.match(s.note?.en ?? '', /^Swapped in/);
  }
  // bodyweight / assisted crossings start from scratch
  const pu = sub('push-up');
  assert.deepEqual([pu.workingKg, pu.sessions, pu.targetReps], [0, 0, 6]);
  const ap = substituteState(state({ exerciseId: 'lat-pulldown', workingKg: 50, targetReps: 8, repRange: [8, 12] }), ex('lat-pulldown'), assisted, { now: NOW, bodyweightKg: 85 });
  assert.equal(ap.workingKg, 55);
  // high-rep crossings move along the %1RM table (25 → 20 reps at RIR 1 is ≈ +16 %, not the blend's +30 %)
  const calf = ex('standing-calf-raise-machine');
  const lpc = fx('leg-press-calf-raise', { equipment: 'plate-loaded', increment: 2.5, primary: ['gastrocnemius'], repRange: [12, 20] });
  const hc = substituteState(state({ exerciseId: calf.id, workingKg: 40, targetReps: 25, rir: 1, repRange: [20, 30] }), calf, lpc, { now: NOW, repRange: [12, 20], rir: 1 });
  assert.equal(hc.targetReps, 20);
  assert.ok(hc.workingKg >= 0.85 * 40 && hc.workingKg <= 0.85 * 40 * 1.2, `${hc.workingKg}`);
});

/* ------------------------------------------------------------------ deload week and volume */

test('planned deload: −40 % sets at the same load, RIR + 2, every blockWeeks + 1 week', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(deloadSets), [1, 1, 2, 2, 3]);
  const p = buildProgram({ now: '2026-11-10T00:00:00.000Z', catalog: CATALOG });
  const before = structuredClone(p);
  const d = deloadPlan(p);
  assert.deepEqual(p, before, 'input untouched');
  assert.equal(d.loadMultiplier, 1);
  assert.equal(d.repsMinus, 2);
  assert.deepEqual(d.program.days[0].slots.map((s) => s.sets), [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(d.program.days[0].slots.map((s) => s.rir), p.days[0].slots.map((s) => Math.min(5, s.rir + 2)));
  assert.ok(d.note.en.startsWith('Deload week'));
  const at = (days) => deloadWeek(p, Date.parse(p.createdAt) + days * 86_400_000);
  assert.deepEqual(at(0), { due: false, week: 1, cycle: 6 });
  assert.equal(at(34).due, false);
  assert.deepEqual(at(35), { due: true, week: 6, cycle: 6 });
  assert.equal(at(41).due, true);
  assert.deepEqual(at(42), { due: false, week: 1, cycle: 6 });
  assert.equal(at(77).due, true);
  assert.equal(deloadWeek({ ...p, deloadEveryWeeks: 0 }, '2027-06-01T00:00:00.000Z').due, false);
});

/* ------------------------------------------------------------------ master-plan call shapes (§7) */

test('master-plan call shapes: nextState(state, sets, rules, now), initialState(ex, { mode })', () => {
  // no exercise argument: looked up in the catalog; an unknown id gets a neutral 2.5 kg-step stand-in
  const r = nextState(state({ exerciseId: 'not-in-the-catalog', workingKg: 60, targetReps: 10 }), sets(60, [10, 10, 10]), params(), NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.updatedAt], ['progressed', 62.5, 6, NOW]);
  const same = nextState(state({ workingKg: 60, targetReps: 9 }), sets(60, [9, 9, 9]), params(), NOW);
  assert.deepEqual([same.outcome, same.state.targetReps], ['progressed', 10]);
  assert.deepEqual(initialState(mcp, { mode: 'strength', now: NOW }).repRange, [3, 6]);
  assert.deepEqual(initialState(mcp, { goal: 'endurance', now: NOW }).repRange, [15, 20]);
  assert.deepEqual(initialState(mcp, { now: NOW }).repRange, [6, 10], 'recomp by default');
});

/* ------------------------------------------------------------------ master plan §16 (2026-11-09) */

test('incomplete logs hold (§16 rule 4): progression needs every planned working set; the failure ladder still applies', () => {
  const four = { plannedSets: 4 };
  // 1 of 4 sets at 20 kg × 6: no rep step, no failure
  let r = nextState(state({ workingKg: 20, targetReps: 6, fails: 1 }), sets(20, [6]), params(), mcp, NOW, four);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.fails, r.state.sessions], ['held', 20, 6, 1, 4]);
  assert.match(r.note.en, /1 of 4/);
  assert.match(r.note.ru, /1 из 4/);
  assert.doesNotMatch(r.note.en, /all sets reached/);
  // 2 of 4 at the top: no load step
  r = nextState(state({ workingKg: 60, targetReps: 10 }), sets(60, [10, 10]), params(), mcp, NOW, four);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 60, 10]);
  // a logged set below the floor still counts as a miss (here the second: the deload)
  r = nextState(state({ workingKg: 60, targetReps: 6, fails: 1 }), sets(60, [4]), params(), mcp, NOW, four);
  assert.deepEqual([r.outcome, r.state.workingKg], ['deloaded', 50]);
  // every planned set (or more): as usual; without plannedSets nothing changes for direct callers
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8, 8, 8]), params(), mcp, NOW, four);
  assert.deepEqual([r.outcome, r.state.targetReps], ['progressed', 9]);
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8]), params(), mcp, NOW);
  assert.equal(r.outcome, 'progressed');
  // an incomplete test session cannot raise the load from its best set
  r = nextState(state({ exerciseId: plate.id, workingKg: 40, targetReps: 6, sessions: 0 }), sets(40, [9]), params(), plate, NOW, four);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 40, 6]);
  r = nextState(state({ workingKg: 40, targetReps: 6, sessions: 0 }), sets(40, [6]), params(), mcp, NOW, four);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 40, 6]);
});

test('easy sets count (§16 rule 3): RIR above the target speeds up reps, and at the top jumps to the e1RM load (≤ +10 %)', () => {
  // 6 reps with 5 in reserve against RIR 2: the sets would have reached 9 → target 9, not 7
  let r = nextState(state({ workingKg: 60, targetReps: 6 }), sets(60, [6, 6, 6], 5), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 60, 9]);
  assert.match(r.note.en, /aim for 9 reps/);
  // the weakest set decides
  r = nextState(state({ workingKg: 60, targetReps: 6 }), [set({ kg: 60, reps: 6, rir: 5, setIndex: 0 }), set({ kg: 60, reps: 6, rir: 2, setIndex: 1 })], params(), mcp, NOW);
  assert.equal(r.state.targetReps, 7);
  // never past the top of the range that way
  r = nextState(state({ workingKg: 60, targetReps: 9 }), sets(60, [9, 9, 9], 5), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 60, 10]);
  // every set at the top with RIR ≥ target + 1: the load the sets imply for 6 @ 2 (Epley: 113 kg at RIR 3, 118 kg at
  // RIR 5), capped at +10 %
  for (const rir of [3, 4, 5]) {
    r = nextState(state({ exerciseId: plate.id, workingKg: 100, targetReps: 10 }), sets(100, [10, 10, 10], rir), params(), plate, NOW);
    assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 110, 6], `RIR ${rir}`);
  }
  // one set on target: a normal step
  r = nextState(state({ exerciseId: plate.id, workingKg: 100, targetReps: 10 }), [set({ kg: 100, reps: 10, rir: 4, setIndex: 0 }), set({ kg: 100, reps: 10, rir: 2, setIndex: 1 })], params(), plate, NOW);
  assert.equal(r.state.workingKg, 102.5);
  // on a 5 kg stack +10 % of 40 kg is less than a pin: the single step, still checked by the capacity guard
  r = nextState(state({ workingKg: 40, targetReps: 10 }), sets(40, [10, 10, 10], 3), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 45, 6]);
});

test('holdUntil (§16): no load increase before the date; reps may still rise; misses and deloads still apply', () => {
  const until = '2026-11-20T00:00:00.000Z'; // the sets are logged on 2026-11-10
  // at the top of the range: the same load and target, the hold kept
  let r = nextState(state({ workingKg: 60, targetReps: 10, holdUntil: until }), sets(60, [10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.holdUntil], ['held', 60, 10, until]);
  assert.match(r.note.en, /held until/);
  assert.match(r.note.ru, /зафиксирован/);
  // below the top the reps still go up
  r = nextState(state({ workingKg: 60, targetReps: 8, holdUntil: until }), sets(60, [8, 8, 8]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 60, 9]);
  // no widening past the top while held (25 kg would otherwise ask for 11 reps)
  r = nextState(state({ workingKg: 25, targetReps: 10, holdUntil: until }), sets(25, [10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 25, 10]);
  // no big jumps, no rpe-rule raise, no test-session raise
  r = nextState(state({ exerciseId: plate.id, workingKg: 100, targetReps: 10, holdUntil: until }), sets(100, [12, 10, 10], 4), params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg], ['held', 100]);
  r = nextState(state({ workingKg: 60, targetReps: 8, holdUntil: until }), sets(60, [10, 10, 10], 4), params({ rule: 'rpe' }), mcp, NOW);
  assert.equal(r.state.workingKg, 60);
  r = nextState(state({ exerciseId: plate.id, workingKg: 40, targetReps: 6, sessions: 0, holdUntil: until }), sets(40, [9, 9, 9]), params(), plate, NOW);
  assert.equal(r.state.workingKg, 40, 'the test session does not raise it');
  // misses and the deload still apply; a test session may still lower the load
  r = nextState(state({ workingKg: 60, targetReps: 6, fails: 1, holdUntil: until }), sets(60, [4, 4, 4]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.holdUntil], ['deloaded', 50, until]);
  r = nextState(state({ workingKg: 40, targetReps: 6, sessions: 0, holdUntil: until }), sets(40, [4, 4, 3]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg], ['held', 35]);
  // a session on or after the date: progression as usual, the hold cleared
  r = nextState(state({ workingKg: 60, targetReps: 10, holdUntil: '2026-11-10T00:00:00.000Z' }), sets(60, [10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.holdUntil], ['progressed', 65, null]);
  // … also when there is nothing to evaluate (no working sets: "Skipped"); a hold still ahead stays
  for (const [logged, opts] of [[[], {}], [sets(30, [8, 8], 2, { kind: 'warmup' }), {}], [[], { at: '2026-11-19T18:00:00.000Z' }]]) {
    r = nextState(state({ workingKg: 60, targetReps: 10, holdUntil: '2026-11-10T00:00:00.000Z' }), logged, params(), mcp, NOW, opts);
    assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.holdUntil], ['held', 60, 10, null]);
    assert.match(r.note.en, /^Skipped/);
    r = nextState(state({ workingKg: 60, targetReps: 10, holdUntil: until }), logged, params(), mcp, NOW, opts);
    assert.equal(r.state.holdUntil, until);
  }
  r = nextState(state({ workingKg: 60, targetReps: 10, holdUntil: until }), [], params(), mcp, NOW, { at: '2026-11-21T09:00:00.000Z' });
  assert.equal(r.state.holdUntil, null, 'judged at the time the session was logged');
  // states without a hold do not grow the field
  r = nextState(state({ workingKg: 60, targetReps: 8 }), sets(60, [8, 8, 8]), params(), mcp, NOW);
  assert.equal('holdUntil' in r.state, false);
  assert.equal('holdUntil' in nextState(state({ workingKg: 60, targetReps: 8 }), [], params(), mcp, NOW).state, false);
});

test('bodyweight reps with no load step: at the top the state is flagged for a harder variant, never a silent stall', () => {
  const P = params({ repRange: [8, 12] });
  let r = nextState(state({ exerciseId: bwEx.id, workingKg: 0, targetReps: 11, repRange: [8, 12] }), sets(0, [11, 11, 11]), P, bwEx, NOW);
  assert.deepEqual([r.outcome, r.state.targetReps, r.state.variant], ['progressed', 12, undefined]);
  r = nextState(r.state, sets(0, [12, 12, 12]), P, bwEx, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant], ['held', 0, 12, 'harder']);
  assert.match(r.note.en, /harder variant/);
  // a gym that sets a load step for it: bodyweight + load
  r = nextState(state({ exerciseId: bwEx.id, workingKg: 0, targetReps: 12, repRange: [8, 12] }), sets(0, [12, 12, 12]), P, bwEx, NOW, { gym: gym({ increments: { [bwEx.id]: 2 } }), bodyweightKg: 80 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant], ['progressed', 2, 8, null]);
  assert.match(r.note.en, /bodyweight \+ 2 kg/);
  // a pure bodyweight hold at the top: never kg, flagged too
  r = nextState(state({ exerciseId: 'plank', workingKg: 0, targetReps: 40, repRange: [20, 40] }), sets(0, [40, 40]), params({ repRange: [20, 40] }), plank, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant], ['held', 0, 40, 'harder']);
});

test('breaks (§16 rule 1): the cut goes to the NEAREST step, once; a step too coarse for it costs 2 reps instead', () => {
  const fly = ex('cable-fly');
  const cf = state({ exerciseId: fly.id, workingKg: 7.5, targetReps: 12, repRange: [10, 15], rir: 1 });
  // 14 days: −5 % of 7.5 kg is 0.4 kg; the next pin down is −33 % → keep 7.5 kg, 10 reps instead of 12
  let g = gapAdjust(cf, 14, NOW, { exercise: fly });
  assert.deepEqual([g.outcome, g.state.workingKg, g.state.targetReps], ['deloaded', 7.5, 10]);
  assert.match(g.note?.en ?? '', /^14 days since last time: same 7\.5 kg, 2 fewer reps/);
  assert.match(g.note?.ru ?? '', /^14 дней с прошлого раза: те же 7,5 кг, на 2 повторения меньше/);
  // ≥ 28 days: back to the bottom of the range (a test session); the load stays when it cannot be cut sensibly
  g = gapAdjust(cf, 35, NOW, { exercise: fly });
  assert.deepEqual([g.outcome, g.state.workingKg, g.state.targetReps], ['reset', 7.5, 10]);
  // a step that fits: 40 kg, 21 days, −7.5 % → 37 kg → the nearest pin is 35 kg (−12.5 % ≤ 2 × 7.5 %)
  const cp = state({ workingKg: 40, targetReps: 8 });
  g = gapAdjust(cp, 21, NOW, { exercise: mcp });
  assert.deepEqual([g.state.workingKg, g.state.targetReps], [35, 8]);
  assert.match(g.note?.en ?? '', /^21 days since last time: start at 35 kg \(−12\.5 %\)/);
  // 14 days on the same machine: 38 kg → the nearest pin is 40 kg → 2 fewer reps
  g = gapAdjust(cp, 14, NOW, { exercise: mcp });
  assert.deepEqual([g.state.workingKg, g.state.targetReps], [40, 6]);
  g = gapAdjust(state({ workingKg: 40, targetReps: 7 }), 14, NOW, { exercise: mcp });
  assert.equal(g.state.targetReps, 6, 'never below the bottom of the range');
  // assisted: in effective terms (bodyweight − assistance), more assistance
  g = gapAdjust(state({ exerciseId: assisted.id, workingKg: 40, targetReps: 10, repRange: [8, 12] }), 21, NOW, { exercise: assisted, bodyweightKg: 80 });
  assert.deepEqual([g.state.workingKg, g.state.targetReps], [45, 10]);
  // never more than twice the intended cut, at any load, step and break length; never heavier
  for (const inc of [1, 2, 2.5, 5]) {
    const e = fx('machine-chest-press', { increment: inc });
    for (let kg = inc; kg <= 120; kg += inc) {
      for (const days of [14, 17, 21, 27, 28, 45, 90, 200]) {
        const r = gapAdjust(state({ workingKg: kg, targetReps: 9 }), days, NOW, { exercise: e });
        const cut = (kg - r.state.workingKg) / kg;
        assert.ok(cut >= -1e-9 && cut <= (2 * r.pct) / 100 + 1e-9, `${kg} kg (+${inc}), ${days} d: −${(100 * cut).toFixed(1)} % for −${r.pct} %`);
        if (cut < 1e-9 && days < RULES.gap.longFromDays) assert.equal(r.state.targetReps, 7, `${kg} kg, ${days} d: reps instead`);
      }
    }
  }
});

test('goal conversion keeps the implied e1RM within a few percent (nearest step, 5 % lighter first session)', () => {
  // 40 kg × 8 @ 2 (e1RM-equivalent 53.3 kg) → strength 3–6 @ 2: 44.1 kg → 45 kg (≈ 51.7 kg, −3 %), not 40 (−14 %)
  const c = convertState(state({ workingKg: 40, targetReps: 8 }), [6, 10], [3, 6], { exercise: mcp, factor: 0.95 });
  assert.deepEqual([c.workingKg, c.targetReps], [45, 3]);
  const implied = (kg, reps, rir) => kg / (pctOf1rm(reps + rir) / 100);
  for (const kg of [20, 30, 40, 50, 60, 80, 100, 140]) {
    for (const [from, to] of [[[6, 10], [3, 6]], [[3, 6], [8, 12]], [[6, 10], [15, 20]], [[8, 12], [6, 10]]]) {
      const before = state({ workingKg: kg, targetReps: from[0] + 1, repRange: from });
      const fine = fx('machine-chest-press', { increment: 1.25 });
      const after = convertState(before, from, to, { exercise: fine, factor: 0.95 });
      const ratio = implied(after.workingKg, after.targetReps, 2) / implied(kg, before.targetReps, 2);
      // 5 % lighter by design, ± half a 1.25 kg step of rounding (≤ 2 % from 40 kg up)
      const slack = (0.95 * 0.625) / (after.workingKg - 0.625);
      assert.ok(Math.abs(ratio - 0.95) <= slack + 1e-9 && (after.workingKg < 40 || Math.abs(ratio - 0.95) < 0.02), `${kg} kg ${from} → ${to}: e1RM × ${ratio.toFixed(3)}`);
    }
  }
});

test('goal conversion under a weight hold: never heavier before the date; the same load at the reps it allows', () => {
  // 40 kg × 12 @ 2 in 8–12 → 6–10 is 45 kg × 6 (−5 % first session); with a hold until 1 Dec it stays 40 kg, and 14 reps
  // in all at RIR 2 → 12, the top of the new range: 10
  const held = state({ workingKg: 40, targetReps: 12, repRange: [8, 12], holdUntil: new Date(2026, 11, 1).toISOString() }); // local midnight
  const free = convertState({ ...held, holdUntil: null }, [8, 12], [6, 10], { exercise: mcp, factor: 0.95, now: NOW });
  assert.deepEqual([free.workingKg, free.targetReps], [45, 6]);
  let c = convertState(held, [8, 12], [6, 10], { exercise: mcp, factor: 0.95, now: NOW });
  assert.deepEqual([c.workingKg, c.targetReps, c.repRange, c.holdUntil], [40, 10, [6, 10], held.holdUntil]);
  assert.match(c.note.en, /^New range 6–10: 40 kg × 10 reps \(the weight is held until 1 Dec\)\.$/);
  assert.match(c.note.ru, /вес зафиксирован до 1 дек/);
  // a lower RIR target at the same load means more reps: 8 @ 2 → RIR 1 in 8–12 → 9
  c = convertState(state({ workingKg: 40, targetReps: 8, repRange: [6, 10], holdUntil: held.holdUntil }), [6, 10], [8, 12], { rir: 1, exercise: mcp, factor: 1.2, now: NOW });
  assert.deepEqual([c.workingKg, c.targetReps], [40, 9]);
  // after the date, or when the conversion makes the load lighter anyway, the hold changes nothing
  c = convertState(held, [8, 12], [6, 10], { exercise: mcp, factor: 0.95, now: '2026-12-02T08:00:00.000Z' });
  assert.deepEqual([c.workingKg, c.targetReps], [45, 6]);
  const lighter = convertState(state({ workingKg: 40, targetReps: 8, repRange: [6, 10], holdUntil: held.holdUntil }), [6, 10], [15, 20], { exercise: mcp, factor: 0.95, now: NOW });
  const lighterFree = convertState(state({ workingKg: 40, targetReps: 8, repRange: [6, 10] }), [6, 10], [15, 20], { exercise: mcp, factor: 0.95, now: NOW });
  assert.deepEqual([lighter.workingKg, lighter.targetReps], [lighterFree.workingKg, lighterFree.targetReps]);
  assert.ok(lighter.workingKg < 40);
});

test('one e1RM everywhere: the engine and the progress charts agree within 0.1 % for 1–20 reps × RIR 0–4', () => {
  for (let reps = 1; reps <= 20; reps++) {
    for (let rir = 0; rir <= 4; rir++) {
      for (const kg of [7.5, 42.5, 100]) {
        const chart = analyticsE1rm(kg, reps, rir);
        const engine = e1rmOf(kg, reps, rir);
        assert.ok(chart, `${kg} × ${reps} @ ${rir}`);
        assert.ok(Math.abs(engine.kg - chart.kg) / chart.kg < 0.001, `${kg} × ${reps} @ ${rir}: engine ${engine.kg}, charts ${chart.kg}`);
        assert.equal(engine.reliable, chart.reliable, `${kg} × ${reps} @ ${rir}: reliability`);
        assert.ok(Math.abs(kg * e1rmFactor(reps + rir) - chart.kg) / chart.kg < 1e-9, 'the factor is the same blend');
        assert.ok(Math.abs(loadForE1rm(chart.kg, reps, rir) - kg) / kg < 0.001, `${kg} × ${reps} @ ${rir}: inverse`);
      }
    }
  }
});

test('the %1RM table agrees with the e1RM inverse within a point up to 12 total reps; the planner switches to it above', () => {
  for (let t = 1; t <= 12; t++) {
    assert.ok(Math.abs(pctOf1rm(t) / 100 - loadForE1rm(1, t, 0)) <= 0.01, `${t} total reps: table ${pctOf1rm(t)} % vs ${(100 * loadForE1rm(1, t, 0)).toFixed(2)} %`);
    assert.equal(loadFraction(t), loadForE1rm(1, t, 0));
  }
  for (let t = 13; t <= 30; t++) assert.equal(loadFraction(t), pctOf1rm(t) / 100);
  for (let t = 1.5; t <= 30; t += 0.5) assert.ok(loadFraction(t) < loadFraction(t - 0.5), `the planner's load fraction falls at ${t}`);
});

/* ------------------------------------------------------------------ master plan §16 rule 5: plateau memory (2026-11-09) */

/** The memory of a load that ended in a deload: 55 kg once, no top session since unless said. */
const at55 = (o = {}) => ({ kg: 55, times: 1, streak: 0, ...o });

test('plateau memory (§16 rule 5): a reactive deload remembers the load it came from; times count at that load only', () => {
  // two misses at 40 kg: −10 % → 35 kg, and 40 kg is remembered
  let r = nextState(state({ workingKg: 40, targetReps: 6, fails: 1 }), sets(40, [5, 4, 4]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['deloaded', 35, { kg: 40, times: 1, streak: 0 }]);
  // deloaded from the same load again: times + 1, the streak back to 0
  r = nextState(state({ workingKg: 40, targetReps: 6, fails: 1, plateau: { kg: 40, times: 1, streak: 2 } }), sets(40, [5, 4, 4]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['deloaded', 35, { kg: 40, times: 2, streak: 0 }]);
  r = nextState({ ...r.state, workingKg: 40, fails: 1 }, sets(40, [4, 4, 4]), params(), mcp, NOW);
  assert.deepEqual(r.state.plateau, { kg: 40, times: 3, streak: 0 });
  // from another load: a new memory
  r = nextState(state({ workingKg: 35, targetReps: 6, fails: 1, plateau: { kg: 40, times: 2, streak: 1 } }), sets(35, [5, 4, 4]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['deloaded', 30, { kg: 35, times: 1, streak: 0 }]);
  // an incomplete log with a set below the range still deloads (rule 4), and remembers
  r = nextState(state({ workingKg: 60, targetReps: 6, fails: 1 }), sets(60, [4]), params(), mcp, NOW, { plannedSets: 4 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['deloaded', 50, { kg: 60, times: 1, streak: 0 }]);
  // the first miss remembers nothing yet, and neither does a deload that cannot lower the load (no step back to wait for)
  r = nextState(state({ workingKg: 40, targetReps: 6 }), sets(40, [5, 4, 4]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, 'plateau' in r.state], ['failed', false]);
  r = nextState(state({ workingKg: 5, targetReps: 6, fails: 1 }), sets(5, [3, 3, 3]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, 'plateau' in r.state], ['deloaded', 5, false]);
  r = nextState(state({ workingKg: 5, targetReps: 6, fails: 1, plateau: { kg: 10, times: 1, streak: 1 } }), sets(5, [3, 3, 3]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.plateau], ['deloaded', { kg: 10, times: 1, streak: 0 }]);
});

test('plateau memory: the step back to that load needs min(3, 1 + times) top sessions in a row; the hold says why in EN and RU', () => {
  // 50 kg × 10 × 4 @ 2 carries 55 kg (+10 %; the guard allows 10.5 %), but 55 kg ended in a deload: one more such session
  let r = nextState(state({ workingKg: 50, targetReps: 10, plateau: at55() }), sets(50, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.fails, r.state.plateau], ['held', 50, 10, 0, at55({ streak: 1 })]);
  assert.equal(r.note.en, 'Every set reached 10 reps, but the next step (55 kg) ended in a deload last time: keep 50 kg × 10 reps for 1 more session like this one, then try it again.');
  assert.equal(r.note.ru, 'Все подходы дошли до 10 повторений, но следующий шаг (55 кг) в прошлый раз закончился разгрузкой: оставьте 50 кг × 10 повторений ещё на 1 такую же тренировку, потом пробуйте снова.');
  assert.deepEqual(r.state.note, r.note);
  // the second top session in a row: the step, exactly as without the memory; the streak starts over at the new load
  r = nextState(r.state, sets(50, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 55, 6, at55()]);
  assert.match(r.note.en, /^\+5 kg next time \(55 kg × 6 reps\): every set reached 10 reps\.$/);
  // after the second deload from 55 kg: three top sessions in a row, and the note suggests smaller steps (50 × 12 carries
  // 55 kg with the 2 reps to spare a second deload asks for: 44 ÷ 40 = 1.1)
  let s = state({ workingKg: 50, targetReps: 12, plateau: at55({ times: 2 }) });
  const seen = [];
  for (let i = 0; i < 3; i++) {
    r = nextState(s, sets(50, [12, 12, 12, 12]), params(), mcp, NOW);
    seen.push(`${r.outcome}:${r.state.workingKg}x${r.state.targetReps}:${r.state.plateau?.streak}`);
    if (i === 0) {
      assert.equal(r.note.en, 'Every set reached 12 reps, but the next step (55 kg) has ended in a deload 2 times: keep 50 kg × 12 reps for 2 more sessions like this one, then try it again. The step is big: switch to a variant with smaller steps or add micro-plates.');
      assert.equal(r.note.ru, 'Все подходы дошли до 12 повторений, но следующий шаг (55 кг) уже 2 раза заканчивался разгрузкой: оставьте 50 кг × 12 повторений ещё на 2 такие же тренировки, потом пробуйте снова. Шаг крупный: возьмите вариант с меньшим шагом или микроблины.');
    }
    s = r.state;
  }
  assert.deepEqual(seen, ['held:50x12:1', 'held:50x12:2', 'progressed:55x6:0']);
  // never a permanent stall: a lifter who makes the target every session gets the step within min(3, 1 + times) sessions,
  // after a second deload from it the reps to spare first (here two: 50 × 10 → 11 → 12)
  for (const [times, sessions] of [[1, 2], [2, 5], [3, 5], [7, 5]]) {
    s = state({ workingKg: 50, targetReps: 10, plateau: at55({ times }) });
    let n = 0;
    while (s.workingKg === 50 && n < 10) {
      s = nextState(s, sets(50, Array(4).fill(s.targetReps)), params(), mcp, NOW).state;
      n += 1;
    }
    assert.deepEqual([s.workingKg, n], [55, sessions], `times ${times}`);
  }
  // the 2 reps to spare are counted at the failed load, so the current one can need ceil(2 × 15 ÷ 12.5) = 3 more: the
  // machine crunch at 12.5 kg × 16 carries 15 kg by the guard alone, with the spare reps only at 19 (6 sessions in all)
  const crunch = ex('machine-crunch');
  s = state({ exerciseId: crunch.id, workingKg: 12.5, targetReps: 16, repRange: [8, 12], plateau: { kg: 15, times: 2, streak: 0 } });
  const steps = [];
  while (s.workingKg === 12.5 && steps.length < 10) {
    s = nextState(s, sets(12.5, Array(3).fill(s.targetReps)), params({ repRange: [8, 12] }), crunch, NOW).state;
    steps.push(`${s.workingKg}x${s.targetReps}`);
  }
  assert.deepEqual(steps, ['12.5x17', '12.5x18', '12.5x19', '12.5x19', '12.5x19', '15x8']);
});

test('plateau memory: only top sessions whose sets carry the load that failed count; rep work the guard holds back does not', () => {
  // 25 → 30 kg is +20 %: the guard asks for 14 reps at RIR 2 (16 in hand) first. The sessions at 12 and 13 reps do not
  // count (before, they did, and the first good day at 14 took the step back at once)
  let s = state({ workingKg: 25, targetReps: 12, plateau: { kg: 30, times: 1, streak: 0 } });
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const r = nextState(s, sets(25, Array(4).fill(s.targetReps)), params(), mcp, NOW);
    seen.push(`${r.outcome}:${r.state.workingKg}x${r.state.targetReps}:${r.state.plateau?.streak}`);
    s = r.state;
  }
  assert.deepEqual(seen, ['progressed:25x13:0', 'progressed:25x14:0', 'held:25x14:1', 'progressed:30x6:0']);
  // a session at the top with less in reserve does not carry it either, and starts the streak over
  const r = nextState(state({ workingKg: 25, targetReps: 14, plateau: { kg: 30, times: 1, streak: 1 } }), sets(25, [14, 14, 14, 14], 1), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 25, 15, { kg: 30, times: 1, streak: 0 }]);
});

test('plateau memory: after a second deload from a load, the step back asks for two more reps in hand, earned with reps first', () => {
  // 50 × 10 @ 2 carries 55 kg by the guard (42 ÷ 38 ≥ 1.1) but not with 2 reps to spare (42 ÷ 40): 11, then 12 reps first
  let r = nextState(state({ workingKg: 50, targetReps: 10, plateau: at55({ times: 2 }) }), sets(50, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 50, 11, at55({ times: 2 })]);
  assert.equal(r.note.en, 'Every set reached 10 reps, but the next step (55 kg) has ended in a deload 2 times: earn it with 11 reps at 50 kg first. The step is big: switch to a variant with smaller steps or add micro-plates.');
  assert.equal(r.note.ru, 'Все подходы дошли до 10 повторений, но следующий шаг (55 кг) уже 2 раза заканчивался разгрузкой: сначала сделайте 11 повторений с 50 кг. Шаг крупный: возьмите вариант с меньшим шагом или микроблины.');
  // without the memory, or after one deload from it, the same session steps or waits as before
  assert.equal(nextState(state({ workingKg: 50, targetReps: 10 }), sets(50, [10, 10, 10, 10]), params(), mcp, NOW).state.workingKg, 55);
  assert.deepEqual(nextState(state({ workingKg: 50, targetReps: 10, plateau: at55() }), sets(50, [10, 10, 10, 10]), params(), mcp, NOW).state.plateau, at55({ streak: 1 }));
  r = nextState(r.state, sets(50, [11, 11, 11, 11]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 50, 12, at55({ times: 2 })]);
  assert.match(r.note.en, /: earn it with 12 reps at 50 kg first\./);
  // at the rep ceiling (15 for the chest press) the guard alone decides, so the wait always ends: 25 → 30 kg (+20 %)
  // with 16 in hand passes the guard (46 ÷ 38) but not with the reps to spare (46 ÷ 40)
  const p30 = { kg: 30, times: 2, streak: 0 };
  r = nextState(state({ workingKg: 25, targetReps: 14, plateau: p30 }), sets(25, [14, 14, 14, 14]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 25, 15, p30]);
  let s = r.state;
  const seen = [];
  for (let i = 0; i < 3; i++) {
    r = nextState(s, sets(25, [15, 15, 15, 15], 1), params(), mcp, NOW);
    seen.push(`${r.outcome}:${r.state.workingKg}x${r.state.targetReps}:${r.state.plateau?.streak}`);
    s = r.state;
  }
  assert.deepEqual(seen, ['held:25x15:1', 'held:25x15:2', 'progressed:30x6:0']);
  // a step past it needs the spare reps too: 112.5 × 5 @ 2 on a 3–5 range carries 115 kg (× 1.022) with them (37 ÷ 36),
  // not the 5 % step to 117.5 kg (× 1.044) or the easy jump to 120 kg (× 1.067) that the guard alone allows (37 ÷ 34),
  // so the step back stops at 115 kg and says why
  const s3 = state({ exerciseId: plate.id, workingKg: 112.5, targetReps: 5, repRange: [3, 5], rir: 1, plateau: { kg: 115, times: 3, streak: 3 } });
  const P5 = params({ repRange: [3, 5], rir: 1, stepPct: 5 });
  assert.equal(nextState({ ...s3, plateau: null }, sets(112.5, [5, 5, 5, 5, 5], 2), P5, plate, NOW).state.workingKg, 120);
  r = nextState(s3, sets(112.5, [5, 5, 5, 5, 5], 2), P5, plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 115, 3, { kg: 115, times: 3, streak: 0 }]);
  assert.equal(r.note.en, '+2.5 kg next time (115 kg × 3 reps): every set reached 5 reps. Only this step for now: 115 kg has ended in a deload 3 times.');
  assert.equal(r.note.ru, '+2,5 кг в следующий раз (115 кг × 3 повторения): все подходы дошли до 5 повторений. Пока только этот шаг: эта нагрузка (115 кг) уже 3 раза заканчивалась разгрузкой.');
});

test('plateau memory: the streak counts top sessions at the planned load; a short set, another load or a load change starts it over', () => {
  // not every set at the top: back to 0
  let r = nextState(state({ workingKg: 50, targetReps: 10, plateau: at55({ streak: 1 }) }), sets(50, [10, 10, 9, 9]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['held', 50, 10, at55()]);
  // below the top, reps climb as usual and nothing counts
  r = nextState(state({ workingKg: 50, targetReps: 8, plateau: at55({ streak: 1 }) }), sets(50, [8, 8, 8, 8]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 50, 9, at55()]);
  // reps climbing past the top while the step is too big do not count: 45 × 10 @ 2 does not carry 55 kg (+22 %)
  r = nextState(state({ workingKg: 45, targetReps: 10, plateau: at55({ streak: 1 }) }), sets(45, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 45, 11, at55()]);
  // a step that stays below 55 kg needs no confirmation, and the streak starts over at the new load
  r = nextState(r.state, sets(45, [11, 11, 11, 11]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 50, 6, at55()]);
  // a session at another load than planned (50 kg instead of 45) does not continue the streak: held at 50 kg
  r = nextState(state({ workingKg: 45, targetReps: 10, plateau: at55({ streak: 1 }) }), sets(50, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['held', 50, 10, at55({ streak: 1 })]);
  // an incomplete log (rule 4) leaves it alone, at the top or not
  r = nextState(state({ workingKg: 50, targetReps: 10, plateau: at55({ streak: 1 }) }), sets(50, [10, 10]), params(), mcp, NOW, { plannedSets: 4 });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['held', 50, 10, at55({ streak: 1 })]);
  r = nextState(state({ workingKg: 50, targetReps: 10, plateau: at55({ streak: 1 }) }), sets(50, [9, 8]), params(), mcp, NOW, { plannedSets: 4 });
  assert.deepEqual([r.outcome, r.state.plateau], ['held', at55({ streak: 1 })]);
  // a miss at the load below starts it over (and two of them deload from there: a new memory)
  r = nextState(state({ workingKg: 50, targetReps: 10, plateau: at55({ streak: 1 }) }), sets(50, [10, 10, 5, 5]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.plateau], ['failed', at55()]);
  // a test session (the first one; after a break or a goal switch applySession passes calibration) keeps the memory
  // and counts like any other: at the top it is one of the sessions in a row, so a run of them gets the step too
  let s = state({ workingKg: 50, targetReps: 10, plateau: at55() });
  const seen = [];
  for (let i = 0; i < 2; i++) {
    r = nextState(s, sets(50, [10, 10, 10, 10]), params(), mcp, NOW, { calibration: true });
    seen.push(`${r.outcome}:${r.state.workingKg}x${r.state.targetReps}:${r.state.plateau?.streak}`);
    if (i === 0) assert.match(r.note.en, /keep 50 kg × 10 reps for 1 more session like this one/);
    s = r.state;
  }
  assert.deepEqual(seen, ['held:50x10:1', 'progressed:55x6:0']);
  r = nextState(state({ workingKg: 50, targetReps: 8, sessions: 0, plateau: at55({ streak: 1 }) }), sets(50, [8, 8, 8, 8]), params(), mcp, NOW);
  assert.deepEqual([r.state.workingKg, r.state.plateau], [50, at55()]);
  // its re-anchor does not jump back before the confirmation: 100 kg × 10 @ 2 implies 107.5 kg, but 105 kg ended in a
  // deload → 102.5 kg, and the note says why; as the second top session in a row, the re-anchor as without the memory
  const p100 = state({ exerciseId: plate.id, workingKg: 100, targetReps: 10, plateau: { kg: 105, times: 1, streak: 0 } });
  assert.equal(nextState({ ...p100, plateau: null }, sets(100, [10, 10, 10, 10]), params(), plate, NOW, { calibration: true }).state.workingKg, 107.5);
  r = nextState(p100, sets(100, [10, 10, 10, 10]), params(), plate, NOW, { calibration: true });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 102.5, 6, { kg: 105, times: 1, streak: 0 }]);
  assert.equal(r.note.en, 'Test done: working load 102.5 kg × 6 reps from your best set. Easier than 105 kg for now: it ended in a deload last time.');
  assert.equal(r.note.ru, 'Тест пройден: рабочий вес 102,5 кг × 6 повторений по лучшему подходу. Пока легче, чем 105 кг: в прошлый раз эта нагрузка закончилась разгрузкой.');
  r = nextState({ ...p100, plateau: { kg: 105, times: 1, streak: 1 } }, sets(100, [10, 10, 10, 10]), params(), plate, NOW, { calibration: true });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['progressed', 107.5, { kg: 105, times: 1, streak: 0 }]);
  // nor does a test ramp from below that reached that load end there: 50 kg planned, 55 kg × 6 @ 4 twice → 55 kg × 8
  // without the memory (rule 3); with it, one step below 55 kg until the confirmation
  const ramp = [...sets(50, [6], 3), ...sets(55, [6, 6], 4)].map((x, i) => ({ ...x, setIndex: i }));
  const r50 = state({ workingKg: 50, targetReps: 6 });
  r = nextState(r50, ramp, params(), mcp, NOW, { calibration: true });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 55, 8]);
  r = nextState({ ...r50, plateau: at55() }, ramp, params(), mcp, NOW, { calibration: true });
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['held', 50, 6, at55()]);
  assert.equal(r.note.en, 'Test done: working load 50 kg × 6 reps. Easier than 55 kg for now: it ended in a deload last time.');
  assert.equal(r.note.ru, 'Тест пройден: рабочий вес 50 кг × 6 повторений. Пока легче, чем 55 кг: в прошлый раз эта нагрузка закончилась разгрузкой.');
  // (a ramp is not a session at the planned load, so it never confirms; a streak from before is no exception)
  r = nextState({ ...r50, plateau: at55({ streak: 1 }) }, ramp, params(), mcp, NOW, { calibration: true });
  assert.deepEqual([r.state.workingKg, r.state.plateau], [50, at55()]);
  // past that load, a complete test in the range clears it, and nothing caps the result: 60 kg × 7
  const past = [...sets(50, [6], 3), ...sets(55, [6], 3), ...sets(60, [6, 6], 2)].map((x, i) => ({ ...x, setIndex: i }));
  r = nextState({ ...r50, plateau: at55() }, past, params(), mcp, NOW, { calibration: true });
  assert.deepEqual([r.state.workingKg, r.state.targetReps, r.state.plateau], [60, 7, null]);
});

test('plateau memory: the hardest passing option below that load is taken instead; the rpe rule is capped the same way', () => {
  // 100 kg × 10 × 3 with 4 in reserve implies 110 kg (+10 %), but 105 kg ended in a deload: 102.5 kg, one plate step
  const s = state({ exerciseId: plate.id, workingKg: 100, targetReps: 10, plateau: { kg: 105, times: 1, streak: 0 } });
  let r = nextState(s, sets(100, [10, 10, 10], 4), params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 102.5, 6, { kg: 105, times: 1, streak: 0 }]);
  assert.equal(r.note.en, '+2.5 kg next time (102.5 kg × 6 reps): every set reached 10 reps. Easier than 105 kg for now: it ended in a deload last time.');
  assert.equal(r.note.ru, '+2,5 кг в следующий раз (102,5 кг × 6 повторений): все подходы дошли до 10 повторений. Пока легче, чем 105 кг: в прошлый раз эта нагрузка закончилась разгрузкой.');
  // the second top session in a row: the jump the sets imply, as without the memory
  r = nextState({ ...s, plateau: { kg: 105, times: 1, streak: 1 } }, sets(100, [10, 10, 10], 4), params(), plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['progressed', 110, { kg: 105, times: 1, streak: 0 }]);
  assert.equal(nextState({ ...s, plateau: null }, sets(100, [10, 10, 10], 4), params(), plate, NOW).state.workingKg, 110);
  // rpe: the e1RM of 100 kg × 10 @ 2 asks for 110 kg; before the confirmation it stops one step below 105 kg
  const rpe = params({ rule: 'rpe' });
  assert.equal(nextState({ ...s, plateau: null }, sets(100, [10, 10, 10]), rpe, plate, NOW).state.workingKg, 110);
  r = nextState(s, sets(100, [10, 10, 10]), rpe, plate, NOW);
  assert.deepEqual([r.state.workingKg, r.state.plateau], [102.5, { kg: 105, times: 1, streak: 0 }]);
  assert.equal(nextState({ ...s, plateau: { kg: 105, times: 1, streak: 1 } }, sets(100, [10, 10, 10]), rpe, plate, NOW).state.workingKg, 110);
  // … also when the session was not at the top (no streak at all)
  r = nextState({ ...s, workingKg: 100, targetReps: 8 }, sets(100, [8, 8, 8], 4), rpe, plate, NOW);
  assert.ok(r.state.workingKg < 105, `${r.state.workingKg}`);
  // a wait at the top keeps the load its note names, also when the e1RM would plan less (RIR 1 logged: 97.5 kg before)
  r = nextState({ ...s, plateau: { kg: 102.5, times: 1, streak: 0 } }, sets(100, [10, 10, 10, 10], 1), rpe, plate, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 100, 10]);
  assert.match(r.note.en, /: keep 100 kg × 10 reps for 1 more session like this one, then try it again\.$/);
});

test('plateau memory: cleared once a complete session past that load stays in the range; at that load it stays', () => {
  // past 55 kg: a complete session in the range clears it (also when not every set reached the target)
  let r = nextState(state({ workingKg: 60, targetReps: 6, plateau: at55() }), sets(60, [6, 6, 6, 6]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.targetReps, r.state.plateau], ['progressed', 7, null]);
  r = nextState(state({ workingKg: 60, targetReps: 7, plateau: at55() }), sets(60, [7, 6, 6, 6]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.plateau], ['held', null]);
  // back at 55 kg it stays (a second deload from there counts), and the steps from 55 kg on need no confirmation
  r = nextState(state({ workingKg: 55, targetReps: 6, plateau: at55() }), sets(55, [6, 6, 6, 6]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.targetReps, r.state.plateau], ['progressed', 7, at55()]);
  r = nextState(state({ workingKg: 55, targetReps: 10, plateau: at55({ times: 2 }) }), sets(55, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['progressed', 60, at55({ times: 2 })]);
  // past it, a set below the range or an incomplete log keeps it; so does a complete session below it
  r = nextState(state({ workingKg: 60, targetReps: 6, plateau: at55() }), sets(60, [6, 6, 5, 5]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.plateau], ['failed', at55()]);
  r = nextState(state({ workingKg: 60, targetReps: 6, plateau: at55() }), sets(60, [6, 6]), params(), mcp, NOW, { plannedSets: 4 });
  assert.deepEqual([r.outcome, r.state.plateau], ['held', at55()]);
  r = nextState(state({ workingKg: 50, targetReps: 8, plateau: at55() }), sets(50, [8, 8, 8, 8]), params(), mcp, NOW);
  assert.deepEqual(r.state.plateau, at55());
  // a test session past it clears it like any other session
  r = nextState(state({ workingKg: 60, targetReps: 6, sessions: 0, plateau: at55() }), sets(60, [6, 6, 6, 6]), params(), mcp, NOW);
  assert.equal(r.state.plateau, null);
});

test('plateau memory: a new rep range and a swap start fresh; a break keeps it (a cut to another load starts the streak over)', () => {
  const s = state({ workingKg: 50, targetReps: 10, plateau: at55({ streak: 1 }) });
  for (const days of [5, 13]) assert.deepEqual(gapAdjust(s, days, NOW, { exercise: mcp }).state.plateau, at55({ streak: 1 }), `${days} days`);
  // 50 → 45 kg after 20, 30 and 120 days: the streak counts sessions at one load, so it starts over
  for (const days of [20, 30, 120]) {
    const g = gapAdjust(s, days, NOW, { exercise: mcp }).state;
    assert.deepEqual([g.workingKg < 50, g.plateau], [true, at55()], `${days} days`);
  }
  // a step too coarse for the cut (20 kg − 5 % is still 20 kg): the load stays, 2 reps fewer, and so does the streak
  const c = gapAdjust(state({ workingKg: 20, targetReps: 10, plateau: { kg: 25, times: 1, streak: 1 } }), 14, NOW, { exercise: mcp }).state;
  assert.deepEqual([c.workingKg, c.targetReps, c.plateau], [20, 8, { kg: 25, times: 1, streak: 1 }]);
  assert.equal(gapAdjust({ ...s, plateau: /** @type {any} */ ({ kg: '55' }) }, 20, NOW, { exercise: mcp }).state.plateau, null);
  assert.equal('plateau' in gapAdjust(state({ workingKg: 50 }), 30, NOW, { exercise: mcp }).state, false);
  assert.equal(convertState(s, [6, 10], [8, 12], { exercise: mcp, now: NOW }).plateau, null);
  assert.equal('plateau' in convertState(state({ workingKg: 50 }), [6, 10], [8, 12], { exercise: mcp, now: NOW }), false);
  for (const id of ['converging-chest-press', 'pec-deck', 'push-up']) assert.equal('plateau' in substituteState(s, mcp, ex(id), { now: NOW }), false, id);
});

test('plateau memory never outranks the other rules: weight holds, misses, the rep ceiling and its flag', () => {
  const until = '2026-11-20T00:00:00.000Z'; // the sets are logged on 2026-11-10
  // a weight hold blocks the step even with the streak reached; top sessions still count
  let r = nextState(state({ workingKg: 50, targetReps: 10, holdUntil: until, plateau: at55({ streak: 1 }) }), sets(50, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.holdUntil, r.state.plateau], ['held', 50, 10, until, at55({ streak: 2 })]);
  assert.match(r.note.en, /held until/);
  // the hold over: the step at once
  r = nextState({ ...r.state, holdUntil: '2026-11-10T00:00:00.000Z' }, sets(50, [10, 10, 10, 10]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.holdUntil], ['progressed', 55, null]);
  // misses and the deload as before
  r = nextState(state({ workingKg: 50, targetReps: 6, plateau: at55({ streak: 2 }) }), sets(50, [5, 5, 5, 5]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.fails], ['failed', 50, 1]);
  r = nextState(r.state, sets(50, [5, 5, 5, 5]), params(), mcp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.fails, r.state.plateau], ['deloaded', 45, 0, { kg: 50, times: 1, streak: 0 }]);
  // a step too big for the range: reps up to the ceiling, then the smaller-steps flag, the memory changes nothing
  const fp = ex('face-pull');
  const Q = params({ repRange: [12, 20], rir: 1 });
  r = nextState(state({ exerciseId: fp.id, workingKg: 7.5, targetReps: 20, repRange: [12, 20], rir: 1, plateau: { kg: 10, times: 2, streak: 0 } }), sets(7.5, [20, 20], 1), Q, fp, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.variant], ['held', 7.5, 20, 'smaller-steps']);
  assert.match(r.note.en, /too big/);
  // nothing to add (bodyweight, no step): the harder-variant flag as before
  const bp = params({ repRange: [8, 12] });
  r = nextState(state({ exerciseId: bwEx.id, workingKg: 0, targetReps: 12, repRange: [8, 12], plateau: { kg: 0, times: 1, streak: 0 } }), sets(0, [12, 12, 12]), bp, bwEx, NOW);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.variant], ['held', 0, 'harder']);
});

test('plateau memory on an assisted machine (less assistance is harder) and on a bodyweight exercise with added load', () => {
  const p = params({ repRange: [8, 12] });
  const bw = { bodyweightKg: 80 };
  // a deload adds assistance and remembers the assistance that failed
  let r = nextState(state({ exerciseId: assisted.id, workingKg: 35, targetReps: 8, fails: 1, repRange: [8, 12] }), sets(35, [6, 5, 5]), p, assisted, NOW, bw);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['deloaded', 40, { kg: 35, times: 1, streak: 0 }]);
  // 13 reps at 40 kg of assistance carry 35 kg, which failed before: one more such session first
  r = nextState({ ...r.state, targetReps: 13 }, sets(40, [13, 13, 13]), p, assisted, NOW, bw);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['held', 40, 13, { kg: 35, times: 1, streak: 1 }]);
  assert.match(r.note.en, /the next step \(assistance 35 kg\) ended in a deload last time: keep assistance 40 kg × 13 reps for 1 more session/);
  assert.match(r.note.ru, /следующий шаг \(помощь 35 кг\) в прошлый раз закончился разгрузкой: оставьте помощь 40 кг × 13 повторений/);
  r = nextState(r.state, sets(40, [13, 13, 13]), p, assisted, NOW, bw);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps, r.state.plateau], ['progressed', 35, 8, { kg: 35, times: 1, streak: 0 }]);
  // at 35 kg it stays; past it (30 kg of assistance) a complete session in the range clears it
  assert.deepEqual(nextState(r.state, sets(35, [8, 8, 8]), p, assisted, NOW, bw).state.plateau, { kg: 35, times: 1, streak: 0 });
  assert.equal(nextState({ ...r.state, workingKg: 30 }, sets(30, [8, 8, 8]), p, assisted, NOW, bw).state.plateau, null);
  // 2.5 kg steps: the double step to 25 kg of assistance waits, the single one is taken; in RU "с помощью 25 кг" (less
  // assistance is harder: "легче, чем помощь 25 кг" read backwards)
  const g25 = { ...bw, gym: gym({ increments: { [assisted.id]: 2.5 } }) };
  r = nextState(state({ exerciseId: assisted.id, workingKg: 30, targetReps: 10, plateau: { kg: 25, times: 1, streak: 0 } }), [...sets(30, [12], 3), ...sets(30, [10, 10, 10])].map((x, i) => ({ ...x, setIndex: i })), params(), assisted, NOW, g25);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['progressed', 27.5, { kg: 25, times: 1, streak: 0 }]);
  assert.equal(r.note.en, '2.5 kg less assistance (assistance 27.5 kg × 6 reps): every set reached 10 reps. Easier than assistance 25 kg for now: it ended in a deload last time.');
  assert.equal(r.note.ru, 'На 2,5 кг меньше помощи (помощь 27,5 кг × 6 повторений): все подходы дошли до 10 повторений. Пока легче, чем с помощью 25 кг: в прошлый раз эта нагрузка закончилась разгрузкой.');
  // bodyweight + added load (45° back extension, 2.5 kg steps): 10 → 12.5 kg waits for the confirmation too
  const be = ex('back-extension-45');
  r = nextState(state({ exerciseId: be.id, workingKg: 12.5, targetReps: 8, fails: 1, repRange: [8, 12] }), sets(12.5, [6, 6, 6]), p, be, NOW, bw);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.plateau], ['deloaded', 10, { kg: 12.5, times: 1, streak: 0 }]);
  r = nextState({ ...r.state, targetReps: 12 }, sets(10, [12, 12, 12]), p, be, NOW, bw);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['held', 10, 12]);
  assert.match(r.note.en, /the next step \(bodyweight \+ 12\.5 kg\) ended in a deload last time: keep bodyweight \+ 10 kg × 12 reps/);
  assert.match(r.note.ru, /следующий шаг \(свой вес \+ 12,5 кг\)/);
  r = nextState(r.state, sets(10, [12, 12, 12]), p, be, NOW, bw);
  assert.deepEqual([r.outcome, r.state.workingKg, r.state.targetReps], ['progressed', 12.5, 8]);
});

test('plateau memory: a malformed stored value counts as none (and is cleared); states without one never grow the field', () => {
  /** @type {[import('../../src/lib/fitness/types').ExerciseState, import('../../src/lib/fitness/types').LoggedSet[]][]} */
  const runs = [
    [state({ workingKg: 50, targetReps: 10 }), sets(50, [10, 10, 10, 10])],
    [state({ workingKg: 50, targetReps: 8 }), sets(50, [8, 8, 8, 8])],
    [state({ workingKg: 50, targetReps: 8 }), sets(50, [8, 7, 7, 7])],
    [state({ workingKg: 50, targetReps: 6 }), sets(50, [5, 5, 5, 5])],
    [state({ workingKg: 45, targetReps: 10 }), sets(45, [10, 10, 10, 10])],
    [state({ workingKg: 50, targetReps: 10 }), sets(50, [10, 10, 10, 10]), { calibration: true }],
  ];
  const bad = ['55', 55, [55, 1, 0], { kg: '55', times: 1, streak: 0 }, { kg: 55, times: Number.NaN, streak: 0 }, { kg: 55, times: 1 },
    { kg: Number.POSITIVE_INFINITY, times: 1, streak: 0 }, { kg: 55, times: 0, streak: 0 }, { kg: -5, times: 1, streak: 0 }, { kg: 55, times: 1, streak: -1 }];
  for (const [s, logged, opts] of runs) {
    const plain = nextState(s, logged, params(), mcp, NOW, opts);
    assert.equal('plateau' in plain.state, false, 'no field grows on a state without the memory');
    for (const b of bad) {
      const odd = nextState({ ...s, plateau: /** @type {any} */ (b) }, logged, params(), mcp, NOW, opts);
      assert.deepEqual([odd.outcome, odd.note, { ...odd.state, plateau: undefined }], [plain.outcome, plain.note, { ...plain.state, plateau: undefined }], JSON.stringify(b));
      assert.equal(odd.state.plateau, null, `${JSON.stringify(b)} is cleared`);
    }
  }
  // a deload with a malformed memory starts a fresh one
  for (const b of bad) {
    const d = nextState(state({ workingKg: 55, targetReps: 6, fails: 1, plateau: /** @type {any} */ (b) }), sets(55, [5, 4, 4]), params(), mcp, NOW);
    assert.deepEqual(d.state.plateau, at55(), JSON.stringify(b));
  }
});
