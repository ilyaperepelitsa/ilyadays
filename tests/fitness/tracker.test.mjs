// Stream 04 — session tracker logic (src/lib/fitness/tracker.mjs): program bootstrap, the running session's plan and
// rows, the current set, logging, rest timer, ending, close-outs of auto-closed sessions, home cards and set texts.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as T from '../../src/lib/fitness/tracker.mjs';
import { applyUpsert, emptySnapshot, isRow } from '../../src/lib/fitness/store-core.mjs';
import { applySession, catalogFrom, planSession } from '../../src/lib/fitness/session.mjs';
import { exerciseById } from '../../src/lib/fitness/catalog.mjs';
import { deloadWeek, roundLoad } from '../../src/lib/fitness/progression.mjs';
import { setHold } from '../../src/lib/fitness/program-edit.mjs';
import safety from '../../content/fitness/safety.json' with { type: 'json' };

const START = '2026-11-10T17:00:00.000Z';
const settings = (o = {}) => ({ goal: 'recomp', daysPerWeek: 3, activeGymId: null, unit: 'kg', restTimer: true, autoCloseHours: 6, updatedAt: '1970-01-01T00:00:00.000Z', ...o });
const at = (min, base = START) => new Date(Date.parse(base) + min * 60_000).toISOString();

/** A snapshot with settings, the owner program and (optionally) more rows; every row must pass the store validator. */
function world(rows = {}, settingsPatch = {}) {
  let snap = applyUpsert(emptySnapshot(), 'settings', settings(settingsPatch));
  const { program } = T.ensureProgram(snap, '2026-11-01T10:00:00.000Z');
  snap = applyUpsert(snap, 'programs', program);
  for (const [table, list] of Object.entries(rows)) {
    for (const row of list) {
      assert.ok(isRow(table, row), `${table} row is valid: ${JSON.stringify(row).slice(0, 120)}`);
      snap = applyUpsert(snap, table, row);
    }
  }
  return { snap, program };
}
const add = (snap, table, row) => {
  assert.ok(isRow(table, row), `${table} row is valid`);
  return applyUpsert(snap, table, row);
};

/** Log the current set (as suggested, or with overrides) and return the new snapshot. */
function logCurrent(snap, session, model, now, overrides) {
  const r = model.current;
  assert.ok(r, 'there is a current set');
  const ex = model.blocks.flatMap((b) => b.exercises).find((e) => e.planned.slotId === r.slotId);
  const set = T.logPlannedSet({ session, planned: r.planned, exerciseId: ex.planned.exerciseId, slotId: r.slotId, index: r.index, now, overrides: overrides ?? r.suggest });
  return add(snap, 'sets', set);
}
function run(snap, session, program, ui = {}) {
  const plan = T.activePlan({ snapshot: snap, session, program, swaps: ui.swaps });
  return { plan, model: T.sessionModel({ plan, sets: T.setsOfSession(snap.sets, session.id), ui }) };
}

describe('program and session bootstrap', () => {
  it('builds the owner template from settings on the first visit and keeps the active program afterwards', () => {
    const empty = applyUpsert(emptySnapshot(), 'settings', settings({ goal: 'strength' }));
    const first = T.ensureProgram(empty, START);
    assert.equal(first.created, true);
    assert.equal(first.program.templateId, 'owner-3day-upper');
    assert.equal(first.program.goal, 'strength');
    assert.ok(isRow('programs', first.program));
    const two = T.ensureProgram(applyUpsert(emptySnapshot(), 'settings', settings({ daysPerWeek: 2 })), START);
    assert.equal(two.program.daysPerWeek, 2);
    assert.equal(two.program.days.length, 2);
    const saved = applyUpsert(empty, 'programs', first.program);
    const again = T.ensureProgram(saved, START);
    assert.equal(again.created, false);
    assert.equal(again.program.id, first.program.id);
    assert.equal(T.ensureProgram(emptySnapshot(), START).program.goal, 'recomp', 'no settings: the template goal');
  });

  it('starts a valid session with cleaned readiness and a plausible body weight only', () => {
    const { program } = world();
    const s = T.startSession({ program, dayKey: 'B', gymId: null, now: START, readiness: { sleep: 4, energy: 9, soreness: 2, mood: 3 }, bodyweightKg: 86.456 });
    assert.ok(isRow('sessions', s));
    assert.equal(s.status, 'active');
    assert.equal(s.dayKey, 'B');
    assert.deepEqual(s.readiness, { sleep: 4, soreness: 2 });
    assert.equal(s.bodyweightKg, 86.46);
    const t = T.startSession({ program, dayKey: 'Z', now: START, bodyweightKg: 5 });
    assert.equal(t.dayKey, 'A', 'an unknown day starts the first day');
    assert.equal(t.bodyweightKg, undefined);
    assert.equal(t.readiness, undefined);
  });

  it('finds the active session under the 6 h rule, the last trained one and the auto-close notice', () => {
    const { snap: base, program } = world();
    const old = { ...T.startSession({ program, dayKey: 'A', now: '2026-11-08T10:00:00.000Z' }), status: 'finished', endedAt: '2026-11-08T11:00:00.000Z' };
    const live = T.startSession({ program, dayKey: 'B', now: START });
    let snap = add(add(base, 'sessions', old), 'sessions', live);
    assert.equal(T.activeSession(snap, at(30))?.id, live.id);
    assert.equal(T.activeSession(snap, at(6 * 60)), null, 'six hours after the start it is no longer active');
    assert.equal(T.lastSession(snap, at(30))?.id, old.id);
    assert.equal(T.lastSession(snap, at(6 * 60))?.id, live.id, 'an auto-closed session counts as trained');
    assert.equal(T.autoClosedNotice(snap, at(30)), null);
    assert.equal(T.autoClosedNotice(snap, at(7 * 60))?.id, live.id);
    snap = add(snap, 'sessions', { ...live, status: 'abandoned', updatedAt: at(400) });
    assert.equal(T.autoClosedNotice(snap, at(7 * 60)), null);
  });
});

describe('logging and adjusting sets', () => {
  const { program } = world();
  const session = T.startSession({ program, dayKey: 'A', now: START, id: '11111111-1111-4111-8111-111111111111' });

  it('logs exactly the plan with one call; warm-ups carry no RIR; overrides and clamps apply', () => {
    const w = T.logPlannedSet({ session, planned: { kind: 'working', weightKg: 40, reps: 12, rir: 2 }, exerciseId: 'machine-chest-press', slotId: 'A1', index: 2, now: at(5) });
    assert.ok(isRow('sets', w));
    assert.deepEqual([w.kg, w.reps, w.rir, w.plannedKg, w.plannedReps, w.setIndex, w.kind, w.doneAt], [40, 12, 2, 40, 12, 2, 'working', at(5)]);
    const u = T.logPlannedSet({ session, planned: { kind: 'warmup', weightKg: 20, reps: 8 }, exerciseId: 'machine-chest-press', slotId: 'A1', index: 0, now: at(1), overrides: { rir: 3 } });
    assert.equal(u.rir, null);
    const o = T.logPlannedSet({ session, planned: { kind: 'working', weightKg: 40, reps: 12, rir: 2 }, exerciseId: 'machine-chest-press', slotId: 'A1', index: 99, now: at(6), overrides: { kg: -5, reps: 10.6, rir: 0 } });
    assert.deepEqual([o.kg, o.reps, o.rir, o.setIndex, o.plannedKg], [0, 11, 0, 49, 40]);
  });

  it('gives every planned row its own stable set id, so a row logged twice (a double tap) is still one set', () => {
    const id = T.setIdFor(session.id, 'A1', 'machine-chest-press', 2);
    assert.equal(id, 'd3d3aade-9268-8c77-a0c3-381a48cdd14b', 'pinned: another hash would duplicate the sets of a session that runs across an update');
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'RFC 9562 version 8 layout');
    assert.equal(T.setIdFor(session.id, 'A1', 'machine-chest-press', 2), id, 'deterministic');
    const others = [
      T.setIdFor(session.id, 'A1', 'machine-chest-press', 3),
      T.setIdFor(session.id, 'A2', 'machine-chest-press', 2),
      T.setIdFor(session.id, 'A1', 'converging-chest-press', 2),
      T.setIdFor('22222222-2222-4222-8222-222222222222', 'A1', 'machine-chest-press', 2),
    ];
    assert.equal(new Set([id, ...others]).size, 5, 'another set, slot, exercise or session: another id');
    const planned = { kind: 'working', weightKg: 40, reps: 8, rir: 2 };
    const first = T.logPlannedSet({ session, planned, exerciseId: 'machine-chest-press', slotId: 'A1', index: 2, now: at(5) });
    const second = T.logPlannedSet({ session, planned, exerciseId: 'machine-chest-press', slotId: 'A1', index: 2, now: at(5.005) });
    assert.deepEqual([first.id, second.id], [id, id]);
    const snap = add(add(add(emptySnapshot(), 'sessions', session), 'sets', first), 'sets', second);
    assert.deepEqual(T.setsOfSession(snap.sets, session.id).map((s) => [s.id, s.doneAt]), [[id, at(5.005)]], 'one set, the later tap');
    assert.equal(T.logPlannedSet({ session, planned, exerciseId: 'machine-chest-press', slotId: 'A1', index: 2, id: 'given' }).id, 'given', 'an explicit id wins');
  });

  it('adjusts by deltas without going negative, and keeps band loads', () => {
    const s = { kg: 5, reps: 1, rir: 2 };
    assert.deepEqual(T.adjustSet(s, { repsDelta: -2, kgDelta: -7.5 }), { kg: 0, reps: 0, rir: 2 });
    assert.deepEqual(T.adjustSet(s, { repsDelta: 1, kgDelta: 2.5, rir: 4 }), { kg: 7.5, reps: 2, rir: 4 });
    assert.deepEqual(T.adjustSet(s, { rir: null }), { kg: 5, reps: 1, rir: null });
    assert.equal(T.adjustSet(s, { kgDelta: 5 }, exerciseById('band-pull-apart')).kg, 5);
  });

  it('steps follow the unit and the gym increments', () => {
    assert.deepEqual(T.stepsFor(exerciseById('machine-chest-press')), { reps: 1, kg: 5 });
    assert.deepEqual(T.stepsFor(exerciseById('machine-chest-press'), { id: 'g', name: 'g', available: [], missing: [], preferred: {}, increments: { selectorized: 2.5 }, updatedAt: START }), { reps: 1, kg: 2.5 });
    assert.deepEqual(T.stepsFor(exerciseById('captains-chair-knee-raise')), { reps: 1, kg: 2.5 }, 'added load on bodyweight reps');
    assert.deepEqual(T.stepsFor(exerciseById('plank')), { reps: 5, kg: 0 }, 'unloaded hold: seconds only');
    assert.deepEqual(T.stepsFor(exerciseById('farmers-carry')), { reps: 5, kg: 2 });
    assert.deepEqual(T.stepsFor(exerciseById('band-pull-apart')), { reps: 1, kg: 0 });
  });
});

describe('rows, supersets and the current set', () => {
  it('groups superset partners into one block and interleaves their working rows by round', () => {
    const { snap, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    const { plan, model } = run(add(snap, 'sessions', session), session, program);
    const blocks = T.blocksOf(plan.exercises);
    assert.deepEqual(blocks.map((b) => b.items.map((p) => p.slotId).join('+')), ['A1', 'A2', 'A3+A4', 'A5', 'A6']);
    const ss = model.blocks[2];
    assert.equal(ss.superset, 'sA1');
    const work = ss.sequence.filter((r) => r.kind !== 'warmup').map((r) => `${r.slotId}#${r.round}`);
    assert.deepEqual(work.slice(0, 4), ['A3#0', 'A4#0', 'A3#1', 'A4#1']);
    assert.ok(ss.sequence.findIndex((r) => r.kind === 'warmup') < ss.sequence.findIndex((r) => r.kind !== 'warmup'), 'warm-ups first');
    assert.deepEqual(T.blocksOf([{ ...plan.exercises[0], superset: 'lonely' }]).map((b) => b.superset), [null]);
  });

  it('walks the whole day with one tap per set, and the current set follows the logging order', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    let { model } = run(snap, session, program);
    assert.equal(model.current.key, model.blocks[0].sequence[0].key, 'first warm-up of the first exercise');
    assert.equal(model.completion.done, 0);
    const total = model.completion.total;
    let n = 0;
    while (model.current && n < 100) {
      snap = logCurrent(snap, session, model, at(5 + n));
      ({ model } = run(snap, session, program));
      n += 1;
    }
    assert.equal(model.complete, true);
    assert.equal(model.completion.done, total);
    assert.equal(model.completion.pct, 1);
    const sets = T.setsOfSession(snap.sets, session.id);
    const ss = sets.filter((s) => s.slotId === 'A3' || s.slotId === 'A4').filter((s) => s.kind === 'working').map((s) => s.slotId);
    assert.deepEqual(ss.slice(0, 4), ['A3', 'A4', 'A3', 'A4'], 'superset sets alternate');
    for (const b of model.blocks) for (const e of b.exercises) for (const r of [...e.warmups, ...e.working]) assert.notEqual(r.state, 'planned');
  });

  it('skips passed-over warm-ups, stays in the block logged last, and comes back to unfinished blocks', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    let { model } = run(snap, session, program);
    const a1 = model.blocks[0].exercises[0];
    // log A1's first working set directly (warm-ups passed over)
    const w1 = a1.working[0];
    snap = add(snap, 'sets', T.logPlannedSet({ session, planned: w1.planned, exerciseId: a1.planned.exerciseId, slotId: 'A1', index: w1.index, now: at(3) }));
    ({ model } = run(snap, session, program));
    assert.equal(model.current.key, a1.working[1].key);
    // machine busy: one set of A5 now → the current set stays in A5's block
    const a5 = model.blocks[3].exercises[0];
    const a5w = a5.working[0];
    snap = add(snap, 'sets', T.logPlannedSet({ session, planned: a5w.planned, exerciseId: a5.planned.exerciseId, slotId: 'A5', index: a5w.index, now: at(6) }));
    ({ model } = run(snap, session, program));
    assert.equal(model.current.slotId, 'A5');
    assert.equal(model.current.index, a5.working[1].index);
    // finish A5, then the current set returns to A1 (the first unfinished block)
    for (const r of model.blocks[3].exercises[0].working.slice(1)) {
      snap = add(snap, 'sets', T.logPlannedSet({ session, planned: r.planned, exerciseId: a5.planned.exerciseId, slotId: 'A5', index: r.index, now: at(8 + r.index) }));
    }
    ({ model } = run(snap, session, program));
    assert.equal(model.current.slotId, 'A1');
    assert.equal(model.current.kind, 'working', 'the passed-over warm-ups are not current again');
  });

  it('maps logged sets back to rows, marks misses as failed, and shows skipped, added and extra rows', () => {
    const p = { slotId: 'X1', exerciseId: 'machine-chest-press', programExerciseId: 'machine-chest-press', restSec: 120, alternatives: [],
      sets: [{ kind: 'warmup', weightKg: 20, reps: 8 }, { kind: 'working', weightKg: 40, reps: 8, rir: 2 }, { kind: 'working', weightKg: 40, reps: 8, rir: 2 }] };
    const session = { id: 'sess' };
    const log = (index, o = {}, min = index) => T.logPlannedSet({ session, planned: p.sets[Math.min(index, 2)], exerciseId: 'machine-chest-press', slotId: 'X1', index, now: at(min), overrides: o });
    const none = T.buildRows(p, []);
    assert.deepEqual([none.warmups.length, none.working.length, none.history.length, none.addedLogged], [1, 2, 0, 0]);
    assert.deepEqual(none.working.map((r) => r.state), ['planned', 'planned']);
    const r = T.buildRows(p, [log(0), log(1, { reps: 6 })], { extra: 1 });
    assert.equal(r.warmups[0].state, 'done');
    assert.equal(r.working[0].state, 'failed', '6 of 8 reps');
    assert.equal(r.working[1].state, 'planned');
    assert.equal(r.working.length, 3, 'one added set');
    assert.equal(r.working[2].added, true);
    assert.equal(r.working[2].kind, 'backoff');
    assert.equal(r.working[2].index, 3);
    assert.deepEqual([r.working[2].suggest.kg, r.working[2].suggest.reps], [40, 6], 'an added set copies the last logged set');
    const skipped = T.buildRows(p, [log(0)], { skipped: true });
    assert.deepEqual(skipped.working.map((x) => x.state), ['skipped', 'skipped']);
    assert.equal(skipped.warmups[0].state, 'done');
    // a set logged beyond the plan and a duplicate on one row are both shown
    const extra = T.buildRows(p, [log(1, {}, 1), log(1, { kg: 45 }, 2), log(5, {}, 3)]);
    assert.equal(extra.working.length, 4);
    assert.equal(extra.working[0].logged.kg, 45, 'the latest set stays on its row');
    assert.equal(extra.working.filter((x) => x.added).length, 2);
    assert.equal(extra.addedLogged, 1, 'only the set beyond the plan counts as added');
    assert.equal(new Set(extra.working.map((x) => x.key)).size, 4, 'keys are unique');
  });

  it('carries the latest logged working load to the pending working rows', () => {
    const p = { slotId: 'X1', exerciseId: 'machine-chest-press', programExerciseId: 'machine-chest-press', restSec: 120, alternatives: [],
      sets: [{ kind: 'warmup', weightKg: 10, reps: 8 }, ...Array.from({ length: 3 }, () => ({ kind: 'working', weightKg: 20, reps: 6, rir: 2 }))] };
    const first = T.logPlannedSet({ session: { id: 's' }, planned: p.sets[1], exerciseId: p.exerciseId, slotId: 'X1', index: 1, now: at(1), overrides: { kg: 35 } });
    const rows = T.buildRows(p, [first]);
    assert.deepEqual(rows.working.map((r) => r.suggest.kg), [20, 35, 35], 'the logged row keeps its plan; pending rows carry 35 kg');
    assert.deepEqual(rows.working.map((r) => r.planned.weightKg), [20, 20, 20], 'the prescription is untouched');
    assert.equal(rows.warmups[0].suggest.kg, 10);
    assert.equal(rows.warmups[0].suggest.rir, null);
  });

  it('after a swap the rows of the old exercise move to history and the substitute gets the sets left', () => {
    const p = { slotId: 'X1', exerciseId: 'converging-chest-press', programExerciseId: 'machine-chest-press', restSec: 120, alternatives: [],
      sets: [{ kind: 'warmup', weightKg: 20, reps: 8 }, ...Array.from({ length: 4 }, () => ({ kind: 'working', weightKg: 40, reps: 8, rir: 2 }))] };
    const old = [1, 2].map((i) => T.logPlannedSet({ session: { id: 's' }, planned: p.sets[i], exerciseId: 'machine-chest-press', slotId: 'X1', index: i, now: at(i) }));
    const rows = T.buildRows(p, old);
    assert.equal(rows.history.length, 2);
    assert.ok(rows.history.every((r) => r.history && r.exerciseId === 'machine-chest-press' && r.state === 'done'));
    assert.equal(rows.working.length, 2, '4 planned − 2 done before the swap');
    assert.ok(rows.working.every((r) => r.exerciseId === 'converging-chest-press' && r.state === 'planned'));
  });

  it('counts completion over working sets only and reports sets outside the plan', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    let { plan, model } = run(snap, session, program);
    const total = model.completion.total;
    assert.equal(T.completion(plan, []).total, total);
    snap = logCurrent(snap, session, model, at(1)); // a warm-up
    ({ plan, model } = run(snap, session, program));
    assert.equal(model.completion.done, 0);
    const stray = T.logPlannedSet({ session, planned: { kind: 'working', weightKg: 10, reps: 10, rir: 2 }, exerciseId: 'leg-press-45', slotId: 'L1', index: 0, now: at(2) });
    snap = add(snap, 'sets', stray);
    ({ plan, model } = run(snap, session, program));
    assert.deepEqual(model.orphans.map((s) => s.id), [stray.id]);
    const skippedA1 = T.sessionModel({ plan, sets: T.setsOfSession(snap.sets, session.id), ui: { skipped: { A1: true } } });
    assert.equal(skippedA1.completion.total, total - plan.exercises[0].sets.filter((s) => s.kind !== 'warmup').length);
  });
});

describe('the running plan: stable, swaps through the engine', () => {
  it('is planned at the session start, so a reload days later shows the same numbers', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'B', now: START });
    const snap = add(base, 'sessions', session);
    const a = T.activePlan({ snapshot: snap, session, program });
    const direct = planSession({ program, dayKey: 'B', states: snap.exerciseState, gym: null, settings: T.planSettings(snap), now: START });
    assert.deepEqual(a, direct);
  });

  it('applies today-only swaps as preferences, infers swaps from logged sets, and lets the device swap win', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    const plain = T.activePlan({ snapshot: snap, session, program });
    const a1 = plain.exercises[0];
    const alt = a1.alternatives[0];
    assert.ok(alt, 'machine chest press has alternatives');
    const swapped = T.activePlan({ snapshot: snap, session, program, swaps: { A1: alt } });
    assert.equal(swapped.exercises[0].exerciseId, alt);
    assert.equal(swapped.exercises[0].programExerciseId, 'machine-chest-press');
    assert.ok(swapped.exercises[0].alternatives.includes('machine-chest-press'), 'the slot exercise is offered back');
    const viaHelper = T.swapInSession(plain, 'A1', alt, snap.exerciseState, undefined, { program, gym: null, settings: T.planSettings(snap), now: START });
    assert.deepEqual(viaHelper.exercises[0], swapped.exercises[0], 'swapInSession with the program = the engine plan');
    assert.equal(viaHelper.exercises[1], plain.exercises[1], 'other slots untouched');
    // a set logged on the alternative (another device) keeps the swap without local state
    const row = swapped.exercises[0].sets[0];
    snap = add(snap, 'sets', T.logPlannedSet({ session, planned: row, exerciseId: alt, slotId: 'A1', index: 0, now: at(2) }));
    assert.equal(T.activePlan({ snapshot: snap, session, program }).exercises[0].exerciseId, alt);
    assert.equal(T.activePlan({ snapshot: snap, session, program, swaps: { A1: 'machine-chest-press' } }).exercises[0].exerciseId, 'machine-chest-press');
  });

  it('without the program, swapInSession converts the slot state with substituteState', () => {
    const cat = catalogFrom([exerciseById('machine-chest-press'), exerciseById('converging-chest-press'), exerciseById('dumbbell-bench-press')]);
    const state = { exerciseId: 'machine-chest-press', workingKg: 50, targetReps: 8, repRange: [6, 10], rir: 2, e1rm: 65, lastOutcome: 'progressed', fails: 0, sessions: 4, lastAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-07T10:00:00.000Z' };
    const planned = [{ slotId: 'A1', exerciseId: 'machine-chest-press', programExerciseId: 'machine-chest-press', restSec: 150, alternatives: ['converging-chest-press', 'dumbbell-bench-press'],
      sets: [{ kind: 'warmup', weightKg: 25, reps: 8 }, ...Array.from({ length: 3 }, () => ({ kind: 'working', weightKg: 50, reps: 8, rir: 2 }))] }];
    const out = T.swapInSession(planned, 'A1', 'converging-chest-press', { 'machine-chest-press': state }, cat);
    const p = out[0];
    assert.equal(p.exerciseId, 'converging-chest-press');
    const work = p.sets.filter((s) => s.kind !== 'warmup');
    assert.equal(work.length, 3);
    const ex = exerciseById('converging-chest-press');
    assert.equal(work[0].weightKg, roundLoad(50 * 0.85, ex, null, 'easier'), 'same family, same pattern: 85 %');
    assert.equal(work[0].reps, 8);
    assert.deepEqual(p.alternatives, ['machine-chest-press', 'dumbbell-bench-press']);
    assert.equal(T.swapInSession(planned, 'A1', 'machine-chest-press', {}, cat), planned, 'no-op swap');
    assert.equal(T.swapInSession(planned, 'Z9', 'converging-chest-press', {}, cat), planned, 'unknown slot');
  });
});

describe('rest timer and elapsed time', () => {
  it('rests 60 s at most after warm-ups, the slot rest otherwise, from the last set’s time', () => {
    const p = { restSec: 150 };
    assert.equal(T.restFor(p, { kind: 'warmup' }), 60);
    assert.equal(T.restFor(p, { kind: 'working' }), 150);
    assert.equal(T.restFor({ restSec: 45 }, { kind: 'warmup' }), 45);
    assert.equal(T.restFor(null, { kind: 'working' }), 90);
    assert.equal(T.restFor({ restSec: 5000 }, { kind: 'working' }), 600);
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    let { model } = run(snap, session, program);
    assert.equal(T.restWindow({ model }), null, 'nothing logged yet');
    // skip to A1's first working set
    const w = model.blocks[0].exercises[0].working[0];
    snap = add(snap, 'sets', T.logPlannedSet({ session, planned: w.planned, exerciseId: 'machine-chest-press', slotId: 'A1', index: w.index, now: at(4) }));
    ({ model } = run(snap, session, program));
    const rest = T.restWindow({ model, adjustSec: 30 });
    const slotRest = model.blocks[0].exercises[0].planned.restSec;
    assert.equal(rest.seconds, slotRest + 30);
    assert.equal(rest.startsAt, Date.parse(at(4)));
    assert.equal(rest.endsAt, Date.parse(at(4)) + (slotRest + 30) * 1000);
    assert.equal(T.restWindow({ model, adjustSec: -9999 }).seconds, 0);
    assert.equal(T.elapsed(session, at(42)), 42 * 60);
    assert.equal(T.elapsed({ ...session, endedAt: at(50) }, at(90)), 50 * 60);
    assert.equal(T.elapsed(session, at(-5)), 0);
  });
});

describe('ending a session', () => {
  it('finishes with the engine’s progression, a summary with badges and the next day', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START, bodyweightKg: 85 });
    let snap = add(base, 'sessions', session);
    let { model } = run(snap, session, program);
    let n = 0;
    while (model.current && n < 100) {
      // every working set of A1 at the top of its range → the load goes up next time
      const top = model.current.slotId === 'A1' && model.current.kind === 'working' ? { ...model.current.suggest, reps: 10 } : undefined;
      snap = logCurrent(snap, session, model, at(5 + 2 * n), top);
      ({ model } = run(snap, session, program));
      n += 1;
    }
    const end = T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(5 + 2 * n) });
    assert.equal(end.session.status, 'finished');
    assert.ok(isRow('sessions', end.session));
    for (const s of end.changed) assert.ok(isRow('exercise_state', s), `state ${s.exerciseId} is valid`);
    const direct = applySession({ program, session: end.session, sets: T.setsOfSession(snap.sets, session.id), states: snap.exerciseState, now: at(5 + 2 * n), settings: T.planSettings(snap, 85), gym: null });
    assert.deepEqual(end.states, direct.states, 'exactly applySession');
    const s = end.summary;
    assert.equal(s.status, 'finished');
    assert.equal(s.dayKey, 'A');
    assert.ok(s.minutes > 0 && s.tonnage > 0 && s.hardSets > 0);
    assert.equal(s.exercises.length, program.days[0].slots.length);
    const a1 = s.exercises.find((e) => e.slotId === 'A1');
    assert.equal(a1.topSet.reps, 10);
    assert.ok(a1.e1rm > 0);
    assert.ok(a1.note && a1.note.en && a1.note.ru, 'the engine’s note');
    assert.equal(a1.before.kg, model.blocks[0].exercises[0].working[0].planned.weightKg);
    assert.equal(a1.after.kg, end.states['machine-chest-press'].workingKg);
    assert.ok(['up', 'hold', 'down', 'deload'].includes(a1.badge.kind));
    assert.equal(s.next.dayKey, 'B', 'the rotation moves on');
    assert.ok(s.next.exercises.length > 0);
    assert.deepEqual(s.skipped, []);
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'plain JSON');
  });

  it('abandons a session without working sets and ends a forgotten one shortly after the last set', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    const empty = T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(20) });
    assert.equal(empty.session.status, 'abandoned');
    assert.deepEqual(empty.changed, []);
    assert.equal(empty.summary.status, 'abandoned');
    const { model } = run(snap, session, program);
    const w = model.blocks[0].exercises[0].working[0];
    snap = add(snap, 'sets', T.logPlannedSet({ session, planned: w.planned, exerciseId: 'machine-chest-press', slotId: 'A1', index: w.index, now: at(10) }));
    assert.equal(T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(25) }).session.endedAt, at(25));
    assert.equal(T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(200) }).session.endedAt, at(15), 'last set + 5 min');
    const partial = T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(30) });
    assert.ok(partial.summary.skipped.some((x) => x.slotId === 'A2'), 'untrained slots are listed');
  });

  it('a lighter load than planned reads as reps to add, not as a load cut (the browser case)', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    let model = run(snap, session, program).model;
    while (model.current && model.current.kind === 'warmup') {
      snap = logCurrent(snap, session, model, at(2));
      model = run(snap, session, program).model;
    }
    const w = model.current;
    assert.equal(w.slotId, 'A1');
    const kg = roundLoad(w.planned.weightKg - 5, exerciseById('machine-chest-press'), null, 'nearest');
    assert.ok(kg < w.planned.weightKg, `${kg} kg is lighter than the planned ${w.planned.weightKg} kg`);
    // every working set of A1 at the lighter load and one rep over the target: a complete log of the exercise
    for (let n = 0; model.current?.slotId === 'A1' && n < 10; n += 1) {
      snap = logCurrent(snap, session, model, at(5 + n), { kg, reps: w.planned.reps + 1, rir: 2 });
      model = run(snap, session, program).model;
    }
    const end = T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(20), plannedSets: T.plannedCounts(model) });
    const a1 = end.summary.exercises.find((e) => e.slotId === 'A1');
    assert.equal(a1.sets, 4);
    assert.deepEqual(a1.before, { kg, reps: w.planned.reps + 1 }, 'compared with what was lifted');
    assert.deepEqual(a1.after, { kg, reps: w.planned.reps + 2 }, 'next time: the same lighter load, one rep more');
    assert.equal(a1.outcome, 'progressed');
    assert.deepEqual(a1.badge, { kind: 'up', text: { en: '+1 rep next time', ru: '+1 повторение в следующий раз' } }, 'reps to add, never a load cut');
  });

  it('references the most common working load (ties → harder) and its rep target', () => {
    const chest = exerciseById('machine-chest-press');
    const mk = (kg, reps, plannedKg, plannedReps, kind = 'working') => ({ kind, kg, reps, plannedKg, plannedReps });
    assert.deepEqual(T.referenceOf([mk(15, 7, 20, 6)], chest), { kg: 15, reps: 7 });
    assert.deepEqual(T.referenceOf([mk(20, 6, 20, 6), mk(20, 5, 20, 6), mk(15, 8, 20, 6)], chest), { kg: 20, reps: 6 }, 'the planned load: its target');
    assert.deepEqual(T.referenceOf([mk(15, 8, 20, 6), mk(15, 7, 20, 6)], chest), { kg: 15, reps: 7 }, 'off plan: the weakest set');
    assert.deepEqual(T.referenceOf([mk(15, 8, 20, 6), mk(20, 6, 20, 6)], chest), { kg: 20, reps: 6 }, 'a tie goes to the harder load');
    const assisted = exerciseById('assisted-pull-up');
    assert.deepEqual(T.referenceOf([mk(50, 8, 50, 8), mk(45, 6, 50, 8)], assisted), { kg: 45, reps: 6 }, 'assisted: less assistance is harder');
    assert.deepEqual(T.referenceOf([mk(20, 8, 20, 8, 'backoff')], chest), { kg: 20, reps: 8 }, 'only added sets: they count');
    assert.equal(T.referenceOf([mk(10, 8, 10, 8, 'warmup')], chest), null);
    assert.equal(T.badgeFor({ kg: 15, reps: 8 }, { kg: 20, reps: 8 }, 'failed', chest).kind, 'hold', 'a miss never shows as up');
  });

  it('badges compare next time with what was lifted', () => {
    const chest = exerciseById('machine-chest-press');
    assert.deepEqual(T.badgeFor({ kg: 40, reps: 10 }, { kg: 45, reps: 6 }, 'progressed', chest), { kind: 'up', text: { en: '+5 kg next time', ru: '+5 кг в следующий раз' } });
    assert.equal(T.badgeFor({ kg: 40, reps: 8 }, { kg: 40, reps: 9 }, 'progressed', chest).text.en, '+1 rep next time');
    assert.equal(T.badgeFor({ kg: 40, reps: 8 }, { kg: 40, reps: 10 }, 'progressed', chest).text.ru, '+2 повторения в следующий раз');
    assert.equal(T.badgeFor({ kg: 40, reps: 8 }, { kg: 40, reps: 8 }, 'held', chest).kind, 'hold');
    assert.equal(T.badgeFor({ kg: 40, reps: 8 }, { kg: 35, reps: 8 }, 'deloaded', chest).kind, 'deload');
    const assisted = exerciseById('assisted-pull-up');
    const up = T.badgeFor({ kg: 50, reps: 12 }, { kg: 45, reps: 6 }, 'progressed', assisted);
    assert.deepEqual(up, { kind: 'up', text: { en: '−5 kg assistance next time', ru: '−5 кг помощи в следующий раз' } });
    assert.equal(T.badgeFor({ kg: 0, reps: 30 }, { kg: 0, reps: 35 }, 'progressed', exerciseById('plank')).text.en, '+5 s next time');
    assert.equal(T.badgeFor(null, null, 'held', chest).kind, 'hold');
  });

  it('reports personal records from the second session of an exercise on', () => {
    const { snap: base, program } = world();
    const s1 = { ...T.startSession({ program, dayKey: 'A', now: '2026-11-03T17:00:00.000Z' }), status: 'finished', endedAt: '2026-11-03T18:00:00.000Z' };
    const s2 = T.startSession({ program, dayKey: 'A', now: START });
    const w = (session, kg, reps, min, i) => T.logPlannedSet({ session, planned: { kind: 'working', weightKg: kg, reps, rir: 2 }, exerciseId: 'machine-chest-press', slotId: 'A1', index: i, now: at(min, session.startedAt) });
    let snap = add(add(base, 'sessions', s1), 'sessions', s2);
    snap = add(snap, 'sets', w(s1, 40, 8, 5, 2));
    const mine = [w(s2, 45, 8, 5, 2)];
    const events = T.sessionPrs(snap, s2, mine);
    assert.ok(events.some((e) => e.kind === 'load' && e.value === 45 && e.previous === 40));
    assert.ok(events.some((e) => e.kind === 'e1rm' && e.value > e.previous));
    assert.deepEqual(T.sessionPrs(base, s1, [w(s1, 40, 8, 5, 2)]), [], 'a first session only sets baselines');
  });
});

describe('reopening a session from its summary (master plan §16)', () => {
  /** Log the whole day as suggested (A1 at the top of its range) and end it. */
  function endedDay(base, program, startAt = START) {
    const session = T.startSession({ program, dayKey: 'A', now: startAt, bodyweightKg: 85 });
    let snap = add(base, 'sessions', session);
    let { model } = run(snap, session, program);
    let n = 0;
    while (model.current && n < 100) {
      const top = model.current.slotId === 'A1' && model.current.kind === 'working' ? { ...model.current.suggest, reps: 10 } : undefined;
      snap = logCurrent(snap, session, model, at(5 + 2 * n, startAt), top);
      ({ model } = run(snap, session, program));
      n += 1;
    }
    const endAt = at(5 + 2 * n, startAt);
    const end = T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: endAt });
    const before = snap;
    snap = add(snap, 'sessions', end.session);
    for (const s of end.changed) snap = add(snap, 'exercise_state', s);
    return { session, before, snap, end, endAt };
  }
  const removeState = (snap, id) => {
    const exerciseState = { ...snap.exerciseState };
    delete exerciseState[id];
    return { ...snap, exerciseState };
  };

  it('makes the session active again and removes the states End created (a first session)', () => {
    const { snap: base, program } = world();
    const { session, before, snap, end, endAt } = endedDay(base, program);
    const undo = end.summary.reopen;
    assert.ok(undo, 'End keeps what it changed');
    assert.deepEqual(JSON.parse(JSON.stringify(undo)), undo, 'plain JSON for sessionStorage');
    assert.equal(undo.states.length, end.changed.length);
    const r = T.reopenSession({ snapshot: snap, undo, now: at(10, endAt) });
    assert.ok(r);
    assert.equal(r.session.status, 'active');
    assert.equal(r.session.endedAt, null);
    assert.ok(isRow('sessions', r.session));
    // a first session: every state was created by End, so reopening removes them all
    assert.deepEqual(r.states, []);
    assert.deepEqual([...r.remove].sort(), end.changed.map((s) => s.exerciseId).sort());
    let reopened = add(snap, 'sessions', r.session);
    for (const id of r.remove) reopened = removeState(reopened, id);
    assert.deepEqual(reopened.exerciseState, before.exerciseState, 'exactly the states before End');
    assert.equal(T.activeSession(reopened, at(11, endAt))?.id, session.id, 'the session runs again');
  });

  it('restores an existing state with a fresh time; ending again follows the corrected set; a discarded session reopens too', () => {
    const { snap: base0, program } = world();
    const prior = { exerciseId: 'machine-chest-press', workingKg: 40, targetReps: 8, repRange: [6, 10], rir: 2, e1rm: 52, lastOutcome: 'held', fails: 0, sessions: 2, lastAt: '2026-11-07T17:30:00.000Z', updatedAt: '2026-11-07T18:00:00.000Z' };
    const base = add(base0, 'exercise_state', prior);
    const { session, snap, end, endAt } = endedDay(base, program);
    assert.equal(end.states['machine-chest-press'].lastOutcome, 'progressed', 'every A1 set at 10 reps');
    const r = T.reopenSession({ snapshot: snap, undo: end.summary.reopen, now: at(5, endAt) });
    const restored = r.states.find((s) => s.exerciseId === 'machine-chest-press');
    assert.deepEqual({ ...restored, updatedAt: prior.updatedAt }, prior);
    assert.equal(restored.updatedAt, at(5, endAt), 'newer than what End wrote (last writer wins)');
    assert.ok(!r.remove.includes('machine-chest-press'));
    // the last A1 set was really 6 reps (below the target of 8): ending again holds the load instead of progressing
    let reopened = add(snap, 'sessions', r.session);
    for (const s of r.states) reopened = add(reopened, 'exercise_state', s);
    for (const id of r.remove) reopened = removeState(reopened, id);
    const a1 = T.setsOfSession(reopened.sets, session.id).filter((s) => s.slotId === 'A1' && s.kind === 'working');
    reopened = add(reopened, 'sets', { ...a1[a1.length - 1], reps: 6, updatedAt: at(6, endAt) });
    const again = T.endSession({ snapshot: reopened, session: r.session, sets: reopened.sets, program, now: at(7, endAt) });
    assert.equal(again.session.status, 'finished');
    const fixed = again.states['machine-chest-press'];
    assert.equal(fixed.lastOutcome, 'held', 'the corrected set decides next time');
    assert.equal(fixed.workingKg, 40);
    // discarded (nothing logged): reopening only makes it active again
    const { snap: b2, program: p2 } = world();
    const s = T.startSession({ program: p2, dayKey: 'B', now: START });
    const gone = T.endSession({ snapshot: add(b2, 'sessions', s), session: s, sets: {}, program: p2, now: at(3) });
    const after = add(add(b2, 'sessions', s), 'sessions', gone.session);
    const back = T.reopenSession({ snapshot: after, undo: gone.summary.reopen, now: at(4) });
    assert.deepEqual([back.session.status, back.states.length, back.remove.length], ['active', 0, 0]);
  });

  it('refuses when it is no longer safe: near the 6 h close, after a later session, or when a state changed since', () => {
    const { snap: base, program } = world();
    const { snap, end, endAt } = endedDay(base, program);
    const undo = end.summary.reopen;
    assert.equal(T.reopenSession({ snapshot: snap, undo, now: at(6 * 60 - 5) }), null, 'the 6 h auto-close is minutes away');
    assert.ok(T.reopenSession({ snapshot: snap, undo, now: at(6 * 60 - 15) }), 'still fine 15 min before');
    const later = T.startSession({ program, dayKey: 'B', now: at(30, endAt) });
    assert.equal(T.reopenSession({ snapshot: add(snap, 'sessions', later), undo, now: at(31, endAt) }), null, 'a later session exists');
    const st = snap.exerciseState['machine-chest-press'];
    const edited = add(snap, 'exercise_state', { ...st, workingKg: st.workingKg + 5, updatedAt: at(20, endAt) });
    assert.equal(T.reopenSession({ snapshot: edited, undo, now: at(21, endAt) }), null, 'a state End wrote changed since');
    const synced = add(snap, 'exercise_state', { ...st, updatedAt: at(20, endAt) });
    assert.ok(T.reopenSession({ snapshot: synced, undo, now: at(21, endAt) }), 'a server re-stamp of updatedAt alone is not a change');
    const reEnded = add(snap, 'sessions', { ...snap.sessions[undo.session.id], endedAt: at(40, endAt), updatedAt: at(40, endAt) });
    assert.equal(T.reopenSession({ snapshot: reEnded, undo, now: at(41, endAt) }), null, 'ended again elsewhere');
    assert.equal(T.reopenSession({ snapshot: snap, undo: null, now: at(1, endAt) }), null);
    assert.equal(T.reopenSession({ snapshot: base, undo, now: at(1, endAt) }), null, 'the session is gone');
  });

  it('keeps a weight hold set or cleared since End (program page) when it restores the states from before End', () => {
    const { snap: base0, program } = world();
    const prior = { exerciseId: 'machine-chest-press', workingKg: 40, targetReps: 8, repRange: [6, 10], rir: 2, e1rm: 52, lastOutcome: 'held', fails: 0, sessions: 2, lastAt: '2026-11-07T17:30:00.000Z', updatedAt: '2026-11-07T18:00:00.000Z' };
    const day = endedDay(add(base0, 'exercise_state', prior), program);
    const held = add(day.snap, 'exercise_state', setHold(day.snap.exerciseState['machine-chest-press'], 2, at(3, day.endAt)));
    const until = held.exerciseState['machine-chest-press'].holdUntil;
    assert.ok(Date.parse(until) > Date.parse(day.endAt));
    const r = T.reopenSession({ snapshot: held, undo: day.end.summary.reopen, now: at(5, day.endAt) });
    assert.ok(r, 'a new hold alone does not block reopening');
    const restored = r.states.find((s) => s.exerciseId === 'machine-chest-press');
    assert.deepEqual({ ...restored, updatedAt: prior.updatedAt }, { ...prior, holdUntil: until }, 'the state before End, with the new hold');

    const was = { ...prior, holdUntil: '2026-11-30T21:00:00.000Z' };
    const day2 = endedDay(add(base0, 'exercise_state', was), program);
    const chest = (res) => res.states.find((s) => s.exerciseId === 'machine-chest-press');
    const cleared = add(day2.snap, 'exercise_state', setHold(day2.snap.exerciseState['machine-chest-press'], null, at(3, day2.endAt)));
    assert.equal(chest(T.reopenSession({ snapshot: cleared, undo: day2.end.summary.reopen, now: at(5, day2.endAt) })).holdUntil, null, 'a hold cleared since End stays cleared');
    assert.deepEqual({ ...chest(T.reopenSession({ snapshot: day2.snap, undo: day2.end.summary.reopen, now: at(5, day2.endAt) })), updatedAt: was.updatedAt }, was, 'untouched: exactly the state before End');
  });
});

describe('planned working sets per exercise (plannedCounts, plannedOf; master plan §16 rule 4)', () => {
  /** Day A of the owner template with every machine: what End tells the engine was planned. */
  const DAY_A = { 'machine-chest-press': 4, 'lat-pulldown': 3, 'pec-deck': 3, 'machine-row': 3, 'machine-shoulder-press': 3, 'machine-crunch': 3 };
  const GYM_ID = '33333333-3333-4333-8333-333333333333';

  it('counts the planned working rows of each exercise; added sets never count, skipped or removed ones change nothing', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    assert.deepEqual(T.plannedCounts(run(snap, session, program).model), DAY_A, 'no gym: every slot as in the program');
    assert.deepEqual(T.plannedOf(snap, session, program, []), DAY_A, 'plannedOf: the same without the screen');
    assert.deepEqual(T.plannedCounts(run(snap, session, program, { extra: { A1: 2 } }).model), DAY_A, '“+ Set” rows are beyond the plan');
    assert.deepEqual(T.plannedCounts(run(snap, session, program, { extra: { A1: 0 } }).model), DAY_A, 'an added set removed again, today only');
    assert.deepEqual(T.plannedCounts(run(snap, session, program, { skipped: { A2: true } }).model), DAY_A, 'an exercise skipped today stays planned: its log is incomplete');
    const ui = { extra: { A1: 1 } };
    let { model } = run(snap, session, program, ui);
    for (let n = 0; model.current?.slotId === 'A1' && n < 20; n += 1) {
      snap = logCurrent(snap, session, model, at(2 + n));
      ({ model } = run(snap, session, program, ui));
    }
    assert.equal(model.completion.extra, 1, 'every A1 set and one beyond the plan were logged');
    assert.deepEqual(T.plannedCounts(model), DAY_A);
    assert.deepEqual(T.plannedOf(snap, { ...session, dayKey: 'Z' }, program, []), {}, 'a day the program does not have');
  });

  it('counts a deload week’s fewer sets as planned: an exercise with history deloads, a first-time one is tested', () => {
    const { snap: base0, program: p0 } = world();
    const program = { ...p0, createdAt: '2026-10-05T10:00:00.000Z' };
    assert.equal(deloadWeek(program, START).due, true, 'week 6 of a 5 + 1 week block');
    const prior = { exerciseId: 'machine-chest-press', workingKg: 40, targetReps: 8, repRange: [6, 10], rir: 2, e1rm: 52, lastOutcome: 'held', fails: 0, sessions: 3, lastAt: '2026-11-07T17:30:00.000Z', updatedAt: '2026-11-07T18:00:00.000Z' };
    let snap = add(add(base0, 'programs', program), 'exercise_state', prior);
    const session = T.startSession({ program, dayKey: 'A', now: START });
    snap = add(snap, 'sessions', session);
    const { plan, model } = run(snap, session, program);
    assert.equal(plan.exercises[0].sets.filter((s) => s.kind !== 'warmup').length, 2, '4 sets − 40 %');
    assert.deepEqual(T.plannedCounts(model), { ...DAY_A, 'machine-chest-press': 2 });
    assert.deepEqual(T.plannedOf(snap, session, program, []), { ...DAY_A, 'machine-chest-press': 2 });
  });

  it('keys the counts by the exercise done: a gym without a machine, and a swap after some sets', () => {
    const { snap: base, program } = world();
    const gym = { id: GYM_ID, name: 'Home', available: [], missing: ['pec-deck'], preferred: {}, updatedAt: START };
    const s1 = T.startSession({ program, dayKey: 'A', gymId: GYM_ID, now: START });
    const atGym = add(add(add(base, 'gyms', gym), 'settings', settings({ activeGymId: GYM_ID })), 'sessions', s1);
    const here = { ...DAY_A, 'cable-fly': 3 };
    delete here['pec-deck'];
    assert.deepEqual(T.plannedCounts(run(atGym, s1, program).model), here, 'A3 is the cable fly at this gym');
    assert.deepEqual(T.plannedOf(atGym, s1, program, []), here);

    // two working sets on the chest press, then its machine is taken: the converging press for the rest of A1
    const s2 = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', s2);
    let { model } = run(snap, s2, program);
    for (let n = 0, work = 0; work < 2 && n < 20; n += 1) {
      if (model.current.kind === 'working') work += 1;
      snap = logCurrent(snap, s2, model, at(2 + n));
      ({ model } = run(snap, s2, program));
    }
    const ui = { swaps: { A1: 'converging-chest-press' } };
    ({ model } = run(snap, s2, program, ui));
    const a1 = model.blocks[0].exercises[0];
    assert.deepEqual([a1.planned.exerciseId, a1.working.length, a1.history.filter((r) => r.kind === 'working').length], ['converging-chest-press', 2, 2]);
    const counts = { ...DAY_A, 'converging-chest-press': 2 };
    assert.deepEqual(T.plannedCounts(model), counts, 'the substitute: the 2 rows it got; the chest press: all 4 (2 logged, so incomplete)');
    snap = logCurrent(snap, s2, model, at(30));
    assert.deepEqual(T.plannedOf(snap, s2, program, T.setsOfSession(snap.sets, s2.id)), counts, 'without the screen the swap shows from the logged sets');
  });

  it('hands the counts to the engine only when there are any (withPlannedSets, applyWithPlan, endSession)', () => {
    const { snap: base, program } = world();
    const session = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', session);
    let { model } = run(snap, session, program);
    for (let n = 0; model.current?.slotId === 'A1' && n < 20; n += 1) {
      snap = logCurrent(snap, session, model, at(2 + n));
      ({ model } = run(snap, session, program));
    }
    const args = { program, session, sets: T.setsOfSession(snap.sets, session.id), states: snap.exerciseState, now: at(40), settings: T.planSettings(snap), gym: null };
    const counts = T.plannedCounts(model);
    const full = T.withPlannedSets(args, counts);
    assert.deepEqual(full, { ...args, plannedSets: DAY_A });
    assert.notEqual(full.plannedSets, counts, 'a copy');
    assert.equal('plannedSets' in args, false, 'the arguments are left alone');
    assert.equal('plannedSets' in T.withPlannedSets(args, {}), false, 'no counts: no field');
    assert.equal('plannedSets' in T.withPlannedSets(args, null), false);
    const end = T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(40), plannedSets: counts });
    const direct = applySession({ ...args, session: end.session, plannedSets: DAY_A });
    assert.deepEqual(end.states, direct.states, 'End = applySession with the screen’s counts');
    assert.deepEqual(T.applyWithPlan({ ...args, session: end.session }, counts).states, direct.states);
    assert.deepEqual(T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(40) }).states, direct.states, 'no counts given: the start plan’s, the same here');
  });
});

describe('weight holds (ExerciseState.holdUntil, master plan §16)', () => {
  // midday UTC: 16 Nov in every time zone from UTC−11 to UTC+11, so the dates do not depend on the test machine
  const UNTIL = new Date(2026, 10, 16, 12).toISOString(); // local noon, so "16 Nov" in any time zone

  it('holdOf: the hold while it is still ahead, else null (expired, over at that instant, missing or bad)', () => {
    assert.equal(T.holdOf({ holdUntil: UNTIL }, START), UNTIL);
    assert.equal(T.holdOf({ holdUntil: UNTIL }, new Date(START)), UNTIL);
    assert.equal(T.holdOf({ holdUntil: UNTIL }, Date.parse(START)), UNTIL);
    assert.equal(T.holdOf({ holdUntil: '2026-11-09T21:00:00.000Z' }, START), null, 'expired the night before');
    assert.equal(T.holdOf({ holdUntil: UNTIL }, UNTIL), null, 'over at that instant');
    for (const state of [{ holdUntil: null }, { holdUntil: '' }, { holdUntil: 'next week' }, {}, null, undefined]) {
      assert.equal(T.holdOf(state, START), null, JSON.stringify(state));
    }
  });

  it('says until when in both languages, and tells when the engine’s note already says it', () => {
    assert.equal(T.holdDay(UNTIL, 'en'), '16 Nov');
    assert.equal(T.holdDay(UNTIL, 'ru'), '16 нояб.');
    assert.equal(T.holdText(UNTIL, 'en'), 'Weight held until 16 Nov');
    assert.equal(T.holdText(UNTIL, 'ru'), 'Вес зафиксирован до 16 нояб.');
    assert.equal(T.holdText('next week', 'en'), 'Weight held until next week', 'not a date: shown as it is');
    const note = { en: 'Weight held until 16 Nov: same load, aim for 9 reps.', ru: 'Вес зафиксирован до 16 нояб.: тот же вес, 9 повторений.' };
    assert.equal(T.noteHasHold(note, UNTIL, 'en'), true);
    assert.equal(T.noteHasHold(note, UNTIL, 'ru'), true);
    assert.equal(T.noteHasHold(note, '2026-11-23T12:00:00.000Z', 'en'), false, 'another date');
    assert.equal(T.noteHasHold({ en: 'Same load, aim for 9 reps.', ru: 'Тот же вес, 9 повторений.' }, UNTIL, 'ru'), false);
    assert.equal(T.noteHasHold({ en: note.en, ru: '' }, UNTIL, 'ru'), false, 'an English-only note does not name the Russian date: both lines show');
    assert.equal(T.noteHasHold(null, UNTIL, 'en'), false);
  });

  it('the summary says until when for a hold still running after End, and nothing for an expired one', () => {
    const { snap: base0, program } = world();
    const st = (exerciseId, holdUntil) => ({ exerciseId, workingKg: 40, targetReps: 8, repRange: [6, 10], rir: 2, e1rm: 52, lastOutcome: 'held', fails: 0, sessions: 2, lastAt: '2026-11-07T17:30:00.000Z', updatedAt: '2026-11-07T18:00:00.000Z', holdUntil });
    let snap = add(add(base0, 'exercise_state', st('machine-chest-press', '2026-11-23T21:00:00.000Z')), 'exercise_state', st('lat-pulldown', '2026-11-09T21:00:00.000Z'));
    const session = T.startSession({ program, dayKey: 'A', now: START });
    snap = add(snap, 'sessions', session);
    let { model } = run(snap, session, program);
    for (let n = 0; model.current && n < 100; n += 1) {
      snap = logCurrent(snap, session, model, at(3 + n));
      ({ model } = run(snap, session, program));
    }
    const end = T.endSession({ snapshot: snap, session, sets: snap.sets, program, now: at(90), plannedSets: T.plannedCounts(model) });
    const holds = Object.fromEntries(end.summary.exercises.map((e) => [e.exerciseId, e.hold]));
    assert.deepEqual(holds, { 'machine-chest-press': '2026-11-23T21:00:00.000Z', 'lat-pulldown': null, 'pec-deck': null, 'machine-row': null, 'machine-shoulder-press': null, 'machine-crunch': null });
    assert.equal(end.states['machine-chest-press'].holdUntil, '2026-11-23T21:00:00.000Z', 'End keeps the hold');
  });
});

describe('the swap sheet (swapChoices) and the gym of a session (sessionGym)', () => {
  const GYM_ID = '33333333-3333-4333-8333-333333333333';
  const FLIES = ['cable-fly', 'dumbbell-fly', 'high-to-low-cable-fly', 'low-to-high-cable-fly'];
  const gymWithout = (missing) => ({ id: GYM_ID, name: 'Home', available: [], missing, preferred: {}, updatedAt: START });
  /** A3 (the pec deck slot) of day A as planned at `gym` (null: every machine counts), with today's `swaps`. */
  function a3At(gym, swaps) {
    const { snap: base, program } = world();
    const snap0 = gym ? add(add(base, 'gyms', gym), 'settings', settings({ activeGymId: gym.id })) : base;
    const session = T.startSession({ program, dayKey: 'A', gymId: gym?.id ?? null, now: START });
    const snap = add(snap0, 'sessions', session);
    return T.activePlan({ snapshot: snap, session, program, swaps }).exercises.find((p) => p.slotId === 'A3');
  }

  it('no gym: every alternative, best first, and nothing missing', () => {
    const a3 = a3At(null);
    assert.equal(a3.exerciseId, 'pec-deck');
    assert.deepEqual(T.swapChoices(a3, null), { options: FLIES, missing: [] });
  });

  it('a gym without some machines: only what it has; the ones marked not here explain the rest', () => {
    const gym = gymWithout(['pec-deck', 'dumbbell-fly']);
    const a3 = a3At(gym);
    assert.equal(a3.exerciseId, 'cable-fly', 'the plan already swapped the missing pec deck');
    assert.deepEqual(T.swapChoices(a3, gym), { options: ['high-to-low-cable-fly', 'low-to-high-cable-fly'], missing: ['pec-deck', 'dumbbell-fly'] });
    assert.deepEqual(T.swapChoices(a3At(null), gym), { options: ['cable-fly', 'high-to-low-cable-fly', 'low-to-high-cable-fly'], missing: ['dumbbell-fly'] }, 'a plan made before the gym said so is filtered too');
  });

  it('nothing here can replace it: no options, and every alternative listed as not here', () => {
    const gym = gymWithout(['pec-deck', ...FLIES]);
    const a3 = a3At(gym);
    assert.equal(a3.exerciseId, 'pec-deck', 'kept as planned');
    assert.deepEqual(T.swapChoices(a3, gym), { options: [], missing: FLIES });
  });

  it('after a swap today the slot’s own exercise is offered back first, when the gym has it', () => {
    const a3 = a3At(null, { A3: 'dumbbell-fly' });
    assert.deepEqual([a3.exerciseId, a3.programExerciseId], ['dumbbell-fly', 'pec-deck']);
    assert.deepEqual(T.swapChoices(a3, null), { options: ['pec-deck', 'cable-fly', 'high-to-low-cable-fly', 'low-to-high-cable-fly'], missing: [] });
    const gym = gymWithout(['pec-deck']);
    assert.deepEqual(T.swapChoices(a3At(gym, { A3: 'dumbbell-fly' }), gym), { options: ['cable-fly', 'high-to-low-cable-fly', 'low-to-high-cable-fly'], missing: ['pec-deck'] });
  });

  it('sessionGym: the session’s own gym, else the active one (none chosen, or deleted), else none', () => {
    const { snap: base } = world();
    const home = gymWithout(['pec-deck']);
    const office = { ...gymWithout([]), id: '44444444-4444-4444-8444-444444444444', name: 'Office' };
    const snap = add(add(add(base, 'gyms', home), 'gyms', office), 'settings', settings({ activeGymId: GYM_ID }));
    assert.equal(T.sessionGym(snap, { gymId: office.id })?.id, office.id);
    assert.equal(T.sessionGym(snap, { gymId: null })?.id, GYM_ID, 'started before any gym existed');
    assert.equal(T.sessionGym(snap, { gymId: '55555555-5555-4555-8555-555555555555' })?.id, GYM_ID, 'its gym was deleted');
    assert.equal(T.sessionGym(base, { gymId: null }), null, 'no gym at all: every machine counts');
    assert.equal(T.sessionGym(base, { gymId: GYM_ID }), null);
  });
});

describe('closing out auto-closed sessions', () => {
  it('applies the progression of an auto-closed session once, abandons empty ones, and ignores old ones', () => {
    const { snap: base, program } = world();
    const live = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', live);
    const { model } = run(snap, live, program);
    const w = model.blocks[0].exercises[0].working;
    for (const r of w) snap = add(snap, 'sets', T.logPlannedSet({ session: live, planned: r.planned, exerciseId: 'machine-chest-press', slotId: 'A1', index: r.index, now: at(5 + r.index) }));
    const closed = { ...live, status: 'auto_closed', endedAt: at(360), updatedAt: at(400) };
    const empty = { ...T.startSession({ program, dayKey: 'B', now: at(-2 * 1440) }), status: 'auto_closed', endedAt: at(-2 * 1440 + 360), updatedAt: at(400) };
    const ancient = { ...T.startSession({ program, dayKey: 'C', now: '2026-08-01T10:00:00.000Z' }), status: 'auto_closed', endedAt: '2026-08-01T16:00:00.000Z', updatedAt: at(400) };
    snap = add(add(add(snap, 'sessions', closed), 'sessions', empty), 'sessions', ancient);
    const r = T.closeOuts(snap, at(24 * 60));
    assert.deepEqual(r.abandon.map((s) => [s.id, s.status]), [[empty.id, 'abandoned']]);
    assert.equal(r.apply.length, 1);
    assert.equal(r.apply[0].session.id, live.id);
    const changed = r.apply[0].changed;
    assert.ok(changed.some((s) => s.exerciseId === 'machine-chest-press'));
    for (const s of changed) assert.ok(isRow('exercise_state', s));
    // after writing the results nothing is left to do
    for (const s of r.abandon) snap = add(snap, 'sessions', s);
    for (const s of changed) snap = add(snap, 'exercise_state', s);
    const again = T.closeOuts(snap, at(24 * 60 + 5));
    assert.deepEqual([again.abandon.length, again.apply.length], [0, 0]);
  });

  it('never overwrites a state that a newer session already updated', () => {
    const { snap: base, program } = world();
    const old = T.startSession({ program, dayKey: 'A', now: START });
    let snap = add(base, 'sessions', { ...old, status: 'auto_closed', endedAt: at(360), updatedAt: at(400) });
    snap = add(snap, 'sets', T.logPlannedSet({ session: old, planned: { kind: 'working', weightKg: 40, reps: 8, rir: 2 }, exerciseId: 'machine-chest-press', slotId: 'A1', index: 2, now: at(5) }));
    const newer = { exerciseId: 'machine-chest-press', workingKg: 60, targetReps: 7, repRange: [6, 10], rir: 2, e1rm: 80, lastOutcome: 'progressed', fails: 0, sessions: 3, lastAt: at(2 * 1440), updatedAt: at(2 * 1440) };
    snap = add(snap, 'exercise_state', newer);
    const r = T.closeOuts(snap, at(3 * 1440));
    assert.equal(r.apply.length, 0);
    assert.equal(r.states['machine-chest-press'], newer);
  });
});

describe('body weight and home cards', () => {
  it('saves a weigh-in only when the value changed: today’s entry is updated, otherwise a new one', () => {
    // local times, so "the same day" holds in any time zone
    const morning = new Date(2026, 10, 5, 7).toISOString();
    const e = { id: '22222222-2222-4222-8222-222222222222', at: morning, kg: 86, updatedAt: morning };
    const { snap } = world({ bodyweight: [e] });
    assert.equal(T.latestBodyweight(snap).kg, 86);
    assert.equal(T.bodyweightRow({ snapshot: snap, kg: 86.02, now: START }), null);
    assert.equal(T.bodyweightRow({ snapshot: snap, kg: 12, now: START }), null);
    const fresh = T.bodyweightRow({ snapshot: snap, kg: 85.4, now: START });
    assert.ok(isRow('bodyweight', fresh));
    assert.notEqual(fresh.id, e.id);
    const sameDay = T.bodyweightRow({ snapshot: snap, kg: 85.4, now: new Date(2026, 10, 5, 19).toISOString() });
    assert.equal(sameDay.id, e.id);
    assert.equal(sameDay.kg, 85.4);
    assert.equal(T.planSettings(snap).bodyweightKg, 86, 'planning uses the latest weigh-in');
    assert.equal(T.planSettings(snap, 90).bodyweightKg, 90, 'the session’s own body weight wins');
  });

  it('shows the EWMA trend with an arrow once there are a few days of data', () => {
    const days = Array.from({ length: 10 }, (_, i) => ({ id: `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`, at: at(i * 1440, '2026-11-01T07:00:00.000Z'), kg: 88 - i * 0.2, updatedAt: START }));
    const { snap } = world({ bodyweight: days });
    const t = T.bodyweightTrend(snap);
    assert.equal(t.kg, days[9].kg);
    assert.equal(t.arrow, 'down');
    assert.ok(t.kgPerWeek < 0);
    const { snap: one } = world({ bodyweight: days.slice(0, 1) });
    assert.deepEqual([T.bodyweightTrend(one).arrow, T.bodyweightTrend(one).kgPerWeek], [null, null]);
    assert.equal(T.bodyweightTrend(world().snap), null);
  });

  it('counts this week and summarises the last session’s outcomes', () => {
    const { snap: base, program } = world();
    const mon = { ...T.startSession({ program, dayKey: 'A', now: '2026-11-09T17:00:00.000Z' }), status: 'finished', endedAt: '2026-11-09T18:00:00.000Z' };
    const gone = { ...T.startSession({ program, dayKey: 'B', now: '2026-11-10T09:00:00.000Z' }), status: 'abandoned', endedAt: '2026-11-10T09:05:00.000Z' };
    let snap = add(add(base, 'sessions', mon), 'sessions', gone);
    snap = add(snap, 'sets', T.logPlannedSet({ session: mon, planned: { kind: 'working', weightKg: 40, reps: 8, rir: 2 }, exerciseId: 'machine-chest-press', slotId: 'A1', index: 2, now: '2026-11-09T17:10:00.000Z' }));
    snap = add(snap, 'exercise_state', { exerciseId: 'machine-chest-press', workingKg: 40, targetReps: 9, repRange: [6, 10], rir: 2, e1rm: 50, lastOutcome: 'progressed', fails: 0, sessions: 1, lastAt: '2026-11-09T17:10:00.000Z', updatedAt: '2026-11-09T18:00:00.000Z' });
    const week = T.weekStatus(snap, 3, '2026-11-11T12:00:00.000Z');
    assert.deepEqual([week.done, week.planned], [1, 3]);
    const last = T.lastSessionInfo(snap, '2026-11-11T12:00:00.000Z');
    assert.equal(last.session.id, mon.id);
    assert.equal(last.dayName.en, program.days[0].name.en);
    assert.equal(last.workingSets, 1);
    assert.deepEqual(last.outcomes, { up: 1, hold: 0, missed: 0, down: 0 });
    assert.equal(last.minutes, 60);
    assert.equal(T.lastSessionInfo(world().snap, START), null);
  });
});

describe('texts and content', () => {
  const ex = (id) => exerciseById(id);
  it('reads every kind of set in both languages', () => {
    assert.equal(T.setText({ kg: 40, reps: 12 }, ex('machine-chest-press'), 'en'), '40 kg × 12');
    assert.equal(T.setText({ kg: 62.5, reps: 8 }, ex('machine-chest-press'), 'ru'), '62,5 кг × 8');
    assert.equal(T.setText({ kg: 0, reps: 40 }, ex('plank'), 'en'), '40 s');
    assert.equal(T.setText({ kg: 10, reps: 40 }, ex('plank'), 'ru'), '10 кг · 40 с');
    assert.equal(T.setText({ kg: 24, reps: 30 }, ex('farmers-carry'), 'en'), '2 × 24 kg · 30 m');
    assert.equal(T.setText({ kg: 16, reps: 20 }, ex('suitcase-carry'), 'ru'), '16 кг · 20 м');
    assert.equal(T.setText({ kg: 25, reps: 8 }, ex('assisted-pull-up'), 'en'), 'assist −25 kg × 8');
    assert.equal(T.setText({ kg: 25, reps: 8 }, ex('assisted-pull-up'), 'ru'), 'помощь −25 кг × 8');
    assert.equal(T.setText({ kg: 0, reps: 8 }, ex('captains-chair-knee-raise'), 'en'), 'Bodyweight × 8');
    assert.equal(T.setText({ kg: 5, reps: 8 }, ex('captains-chair-knee-raise'), 'ru'), 'Свой вес + 5 кг × 8');
    assert.equal(T.setText({ kg: 0, reps: 15 }, ex('band-pull-apart'), 'en'), 'Band × 15');
    assert.equal(T.setHint(ex('hammer-curl'), 'en'), 'per hand');
    assert.equal(T.setHint(ex('pallof-press'), 'ru'), 'на каждую сторону');
    assert.equal(T.setHint(ex('farmers-carry'), 'en'), '', 'carries already say 2 ×');
    assert.equal(T.setHint(ex('machine-chest-press'), 'en'), '');
    // plate-loaded machines log the plates on both sides together (master plan §16)
    assert.equal(T.setText({ kg: 40, reps: 10 }, ex('plate-loaded-chest-press'), 'en'), '40 kg × 10');
    assert.equal(T.setHint(ex('plate-loaded-chest-press'), 'en'), 'plates, both sides');
    assert.equal(T.setHint(ex('leg-press-45'), 'ru'), 'блины с обеих сторон');
    assert.equal(T.kgStepLabel(ex('plate-loaded-row'), 'en'), 'kg plates, both sides');
    assert.equal(T.kgStepLabel(ex('machine-chest-press'), 'en'), 'kg');
    const planned ={ sets: [{ kind: 'warmup', weightKg: 20, reps: 8 }, { kind: 'working', weightKg: 40, reps: 8, rir: 2 }, { kind: 'working', weightKg: 40, reps: 8, rir: 2 }] };
    assert.equal(T.prescriptionText(planned, ex('machine-chest-press'), 'en'), '40 kg × 8 · 2 sets');
    assert.equal(T.prescriptionText(planned, ex('machine-chest-press'), 'ru'), '40 кг × 8 · 2 подхода');
    assert.equal(T.prescriptionText(planned, ex('plate-loaded-chest-press'), 'en'), '40 kg × 8 · 2 sets · plates, both sides');
    assert.equal(T.prescriptionText(planned, ex('hammer-curl'), 'ru'), '40 кг × 8 · 2 подхода · на руку');
    assert.equal(T.setsWord(5, 'ru'), '5 подходов');
    assert.equal(T.setsWord(1, 'en'), '1 set');
    assert.equal(T.repsLabel(ex('plank'), 'en'), 'seconds');
    assert.equal(T.kgStepLabel(ex('assisted-pull-up'), 'en'), 'assist kg');
    // a missed set's target, with its unit
    assert.equal(T.amountText(8, ex('machine-chest-press'), 'en'), '8');
    assert.equal(T.amountText(30, ex('plank'), 'en'), '30 s');
    assert.equal(T.amountText(30, ex('plank'), 'ru'), '30 с');
    assert.equal(T.amountText(20, ex('farmers-carry'), 'ru'), '20 м');
    assert.equal(T.exerciseName('no-such-machine', 'en'), 'No such machine');
    assert.equal(T.exerciseName('machine-chest-press', 'ru'), ex('machine-chest-press').name.ru);
    assert.equal(T.focusText(['chest', 'back'], 'en'), 'Chest, Back');
  });

  it('reads the warm-up and pain rules from content/fitness/safety.json (shape-guarded), and the technique panel from the catalog', () => {
    const s = T.safetyInfo();
    assert.deepEqual(s.warmup, safety.warmup.general, 'the general warm-up, as written');
    assert.match(s.warmup.en, /cardio/);
    assert.match(s.warmup.ru, /кардио/);
    assert.deepEqual(s.pain.map((p) => p.level), ['green', 'amber', 'red']);
    assert.deepEqual(s.pain.map((p) => p.action), safety.pain.map((p) => p.action));
    assert.deepEqual(s.redFlags, safety.redFlags, 'every red flag');
    assert.ok(s.redFlags.length >= 3);
    for (const f of s.redFlags) assert.ok(f.en.length > 20 && f.ru.length > 20, f.en);
    const chest = exerciseById('machine-chest-press');
    const t = T.techniqueOf('machine-chest-press');
    assert.deepEqual(t.cues, { en: chest.cues.en.slice(0, 3), ru: chest.cues.ru.slice(0, 3) });
    assert.equal(t.cues.en.length, 3, 'the first three cues');
    assert.match(t.image.src, /^\/media\/fitness\/exercises\/machine-chest-press\/sequence\.webp\?v=[0-9a-f]{8}$/, 'the sequence picture');
    assert.ok(t.image.alt.en && t.image.alt.ru);
    assert.deepEqual(t.setup, chest.setup);
    assert.deepEqual(T.techniqueOf('no-such-machine'), { image: null, cues: { en: [], ru: [] }, setup: null });
    assert.deepEqual(T.muscleTags('machine-chest-press', 'en'), { primary: ['Mid chest'], secondary: ['Upper chest', 'Front delts', 'Triceps lateral & medial heads'] });
    assert.deepEqual(T.muscleTags('machine-chest-press', 'ru').primary, ['Середина груди']);
  });
});
