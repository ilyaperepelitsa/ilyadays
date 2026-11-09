// Stream 10 — program edits for /fitness/program (src/lib/fitness/program-edit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROGRAM_ID, GOAL_BOUNDS, HOLD_WEEKS, LEGS_EXERCISE_IDS, PROGRESSION_BOUNDS, addLegs, addSlot, commitProgram,
  currentProgram, defaultProgram, holdUntilFor, isDefaultProgram, legsMode, likeForLike, moveSlot, nextSlotId, programDiff,
  removeLegs, removeSlot, resetToTemplate, setDays, setDeloadEvery, setGoal, setHold, setProgressionParams, setSlot,
  slotBlocks, slotBounds, swapCandidates, swapSlot, templateSlotOf,
} from '../../src/lib/fitness/program-edit.mjs';
import { GOAL_IDS, TEMPLATES, buildProgram, roleParams, unitOf, withLegs } from '../../src/lib/fitness/templates.mjs';
import { exerciseById } from '../../src/lib/fitness/catalog.mjs';
import { isRow } from '../../src/lib/fitness/store-core.mjs';

const T0 = '2026-11-01T10:00:00.000Z';
const NOW = '2026-11-08T18:00:00.000Z';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The owner's 3-day program, as saved a week ago. */
const owner = (goal = 'recomp') => buildProgram({ goal, now: T0 });
const slot = (p, dayKey, slotId) => p.days.find((d) => d.key === dayKey)?.slots.find((s) => s.slotId === slotId);
const ids = (p, dayKey) => p.days.find((d) => d.key === dayKey).slots.map((s) => s.slotId);
const allSlots = (p) => p.days.flatMap((d) => d.slots);

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Every slot inside the goal's bounds for its unit. */
function assertInBounds(p, label) {
  for (const s of allSlots(p)) {
    const b = slotBounds(p.goal, unitOf(exerciseById(s.exerciseId)));
    const where = `${label} ${s.slotId} ${s.exerciseId}`;
    assert.ok(s.sets >= b.sets[0] && s.sets <= b.sets[1], `${where} sets ${s.sets}`);
    assert.ok(s.repRange[0] >= b.reps[0] && s.repRange[1] <= b.reps[1] && s.repRange[0] <= s.repRange[1], `${where} reps ${s.repRange}`);
    assert.ok(s.rir >= b.rir[0] && s.rir <= b.rir[1], `${where} rir ${s.rir}`);
    assert.ok(s.restSec >= b.restSec[0] && s.restSec <= b.restSec[1], `${where} rest ${s.restSec}`);
  }
}

test('bounds: every template slot of every goal (legs included) fits the goal bounds', () => {
  for (const tpl of TEMPLATES.filter((t) => !t.addon)) {
    for (const goal of GOAL_IDS) {
      const p = buildProgram({ templateId: tpl.id, goal, now: T0 });
      assertInBounds(p, `${tpl.id}/${goal}`);
      assertInBounds(withLegs(p, T0), `${tpl.id}/${goal}+legs`);
      assertInBounds(withLegs(p, T0, { as: 'slots' }), `${tpl.id}/${goal}+leg slots`);
    }
  }
  assert.deepEqual(slotBounds('strength', 'seconds').reps, [10, 120]);
  assert.deepEqual(slotBounds('recomp', 'meters').step, 5);
  assert.deepEqual(slotBounds('nonsense').reps, GOAL_BOUNDS.recomp.reps);
});

test('edits never mutate their input (frozen program)', () => {
  const p = deepFreeze(owner());
  assert.doesNotThrow(() => {
    setGoal(p, 'strength', {}, NOW);
    setDays(p, 2, NOW);
    setDays(p, 4, NOW);
    swapSlot(p, 'A', 'A3', 'cable-fly', NOW);
    setSlot(p, 'A', 'A1', { sets: 5, repRange: [5, 8], rir: 3, restSec: 180 }, NOW);
    moveSlot(p, 'A', 'A1', 1, NOW);
    addSlot(p, 'C', 'dumbbell-shrug', NOW);
    removeSlot(p, 'A', 'A3', NOW);
    removeLegs(addLegs(p, NOW), NOW);
    setProgressionParams(p, 'double', { stepPct: 5 }, NOW);
    setDeloadEvery(p, 6, NOW);
    programDiff(p, setDays(p, 2, NOW));
  });
});

test('setGoal: slots re-derived for the new goal, same id and exercises, states untouched (lazy conversion)', () => {
  const p = owner();
  const states = { 'machine-chest-press': { exerciseId: 'machine-chest-press', workingKg: 60 } };
  const r = setGoal(p, 'strength', states, NOW);
  assert.equal(r.program.goal, 'strength');
  assert.equal(r.program.id, p.id);
  assert.equal(r.program.version, p.version + 1);
  assert.equal(r.program.updatedAt, NOW);
  assert.equal(r.program.createdAt, NOW, 'the block calendar restarts');
  assert.deepEqual(allSlots(r.program).map((s) => s.exerciseId), allSlots(p).map((s) => s.exerciseId));
  assert.deepEqual(slot(r.program, 'A', 'A1').repRange, roleParams('strength', 'primary').repRange);
  assert.equal(r.states, states, 'states come back as the same object: the engine converts them lazily');
  assertInBounds(r.program, 'strength');
  assert.equal(setGoal(p, 'recomp', states, NOW).program, p, 'same goal → unchanged');
  assert.equal(setGoal(p, 'yoga', states, NOW).program, p, 'unknown goal → unchanged');
});

test('setDays: rebuilds from the 2-/4-day template and carries swaps, overrides, removals, additions, legs and parameters', () => {
  let p = owner();
  p = swapSlot(p, 'A', 'A3', 'cable-fly', NOW); // pec deck hurts → cable fly (2-day A3 is the pec deck too)
  p = setSlot(p, 'A', 'A1', { sets: 5 }, NOW); // one more chest press set (derived: 4)
  p = removeSlot(p, 'C', 'C7', NOW); // no farmers carry (4-day B6)
  p = addSlot(p, 'C', 'dumbbell-shrug', NOW); // an extra: day C does not exist in the 2-day split
  p = addLegs(p, NOW);
  p = setProgressionParams(p, 'double', { stepPct: 5 }, NOW);

  const two = setDays(p, 2, NOW);
  assert.equal(two.templateId, 'upper-2day');
  assert.equal(two.daysPerWeek, 2);
  assert.equal(two.id, p.id);
  assert.equal(two.version, p.version + 1);
  assert.equal(two.createdAt, p.createdAt, 'the block calendar continues');
  assert.equal(slot(two, 'A', 'A3').exerciseId, 'cable-fly', 'swap carried by template exercise id');
  assert.equal(slot(two, 'A', 'A1').sets, 5, 'override carried');
  assert.ok(!allSlots(two).some((s) => s.exerciseId === 'farmers-carry'), 'removal carried');
  const shrug = allSlots(two).find((s) => s.exerciseId === 'dumbbell-shrug');
  assert.ok(shrug, 'added exercise carried to the last day');
  assert.ok(ids(two, 'B').includes(shrug.slotId) && shrug.slotId === 'B9', `added slot gets a fresh id after the template's (got ${shrug.slotId})`);
  assert.equal(legsMode(two), 'day');
  assert.equal(two.progression.double.stepPct, 5);
  assertInBounds(two, '2-day');

  const four = setDays(p, 4, NOW);
  assert.equal(four.templateId, 'upper-4day');
  assert.equal(four.days.filter((d) => d.key !== 'L').length, 4);
  assert.ok(!allSlots(four).some((s) => s.exerciseId === 'farmers-carry'));
  assert.equal(slot(four, 'A', 'A3').exerciseId, 'cable-fly');
  assert.ok(!slot(four, 'C', 'C2') || slot(four, 'C', 'C2').exerciseId === 'cable-fly', 'C2 stays the cable fly');

  const back = setDays(two, 3, NOW);
  assert.equal(back.templateId, 'owner-3day-upper');
  assert.equal(slot(back, 'A', 'A3').exerciseId, 'cable-fly');
  assert.equal(setDays(p, 3, NOW), p, 'same day count → unchanged');
  assert.equal(setDays(p, 5, NOW), p, 'invalid day count → unchanged');
});

test('swapSlot: keeps the prescription and the why, drops the slot increment, re-derives the range across units', () => {
  const p = owner();
  const s = swapSlot(p, 'A', 'A3', 'cable-fly', NOW);
  assert.equal(slot(s, 'A', 'A3').exerciseId, 'cable-fly');
  assert.deepEqual(slot(s, 'A', 'A3'), { ...slot(p, 'A', 'A3'), exerciseId: 'cable-fly' }, 'only the exercise changes');
  assert.equal(s.version, p.version + 1);
  assert.equal(s.updatedAt, NOW);

  const withInc = { ...p, days: p.days.map((d) => (d.key === 'A' ? { ...d, slots: d.slots.map((x) => (x.slotId === 'A1' ? { ...x, increment: 2.5 } : x)) } : d)) };
  assert.equal(slot(swapSlot(withInc, 'A', 'A1', 'converging-chest-press', NOW), 'A', 'A1').increment, undefined);

  // a carry (metres) replaced by a reps exercise: range re-derived for reps
  const carryAlt = swapCandidates('farmers-carry').map((c) => c.id).find((id) => unitOf(exerciseById(id)) !== 'meters');
  if (carryAlt) {
    const c = swapSlot(p, 'C', 'C7', carryAlt, NOW);
    const unit = unitOf(exerciseById(carryAlt));
    const b = slotBounds(p.goal, unit);
    const r = slot(c, 'C', 'C7').repRange;
    assert.ok(r[0] >= b.reps[0] && r[1] <= b.reps[1], `${carryAlt} range ${r} in ${unit}`);
  }
  assert.equal(swapSlot(p, 'A', 'A3', 'no-such-machine', NOW), p);
  assert.equal(swapSlot(p, 'A', 'A3', 'pec-deck', NOW), p);
  assert.equal(swapSlot(p, 'A', 'Z9', 'cable-fly', NOW), p);
  assert.equal(swapSlot(p, 'Q', 'A3', 'cable-fly', NOW), p);
});

test('setSlot: clamps to the goal bounds, sorts a reversed range, rounds rest, ignores unknown rules', () => {
  const p = owner();
  const b = GOAL_BOUNDS.recomp;
  const s = slot(setSlot(p, 'A', 'A1', { sets: 9, repRange: [1, 50], rir: 7, restSec: 999 }, NOW), 'A', 'A1');
  assert.equal(s.sets, b.sets[1]);
  assert.deepEqual(s.repRange, b.reps);
  assert.equal(s.rir, b.rir[1]);
  assert.equal(s.restSec, b.restSec[1]);
  assert.equal(setSlot(p, 'A', 'A1', { repRange: [10, 6] }, NOW), p, 'a reversed copy of the current range is no change');
  assert.deepEqual(slot(setSlot(p, 'A', 'A1', { repRange: [12, 8] }, NOW), 'A', 'A1').repRange, [8, 12]);
  assert.equal(slot(setSlot(p, 'A', 'A1', { restSec: 133 }, NOW), 'A', 'A1').restSec, 135);
  assert.equal(slot(setSlot(p, 'A', 'A1', { progression: 'linear' }, NOW), 'A', 'A1').progression, 'linear');
  assert.equal(setSlot(p, 'A', 'A1', { progression: 'magic' }, NOW), p);
  assert.equal(setSlot(p, 'A', 'A1', { sets: slot(p, 'A', 'A1').sets }, NOW), p, 'no effective change → unchanged');
  assert.equal(setSlot(p, 'A', 'A1', { sets: Number.NaN }, NOW), p);
  // holds: seconds bounds
  const hold = setSlot(p, 'B', 'B7', { repRange: [1, 500] }, NOW);
  const unit = unitOf(exerciseById('pallof-press'));
  assert.deepEqual(slot(hold, 'B', 'B7').repRange, slotBounds('recomp', unit).reps);
});

test('moveSlot: one place at a time, superset pairs move as one block', () => {
  const p = owner();
  assert.deepEqual(ids(p, 'A'), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
  assert.deepEqual(slotBlocks(p.days[0].slots).map((b) => b.map((s) => s.slotId)), [['A1'], ['A2'], ['A3', 'A4'], ['A5'], ['A6']]);
  assert.deepEqual(ids(moveSlot(p, 'A', 'A1', 1, NOW), 'A'), ['A2', 'A1', 'A3', 'A4', 'A5', 'A6']);
  assert.deepEqual(ids(moveSlot(p, 'A', 'A2', 1, NOW), 'A'), ['A1', 'A3', 'A4', 'A2', 'A5', 'A6'], 'jumps over the pair');
  assert.deepEqual(ids(moveSlot(p, 'A', 'A4', -1, NOW), 'A'), ['A1', 'A3', 'A4', 'A2', 'A5', 'A6'], 'the pair moves up together');
  assert.equal(moveSlot(p, 'A', 'A1', -1, NOW), p, 'already first');
  assert.equal(moveSlot(p, 'A', 'A6', 1, NOW), p, 'already last');
  assert.equal(moveSlot(p, 'A', 'A1', 0, NOW), p);
});

test('addSlot: fresh slot id after the template ids, role-based prescription, no duplicates', () => {
  const p = owner();
  const a = addSlot(p, 'A', 'dumbbell-shrug', NOW);
  const added = slot(a, 'A', 'A7');
  assert.ok(added, `got ${ids(a, 'A')}`);
  assert.equal(added.exerciseId, 'dumbbell-shrug');
  assert.equal(templateSlotOf(a, 'A7'), undefined, 'not a template slot');
  assertInBounds(a, 'added');
  assert.equal(addSlot(a, 'A', 'dumbbell-shrug', NOW), a, 'already in that day');
  assert.equal(addSlot(p, 'A', 'no-such-machine', NOW), p);
  assert.equal(addSlot(p, 'Q', 'dumbbell-shrug', NOW), p);
  // a removed template slot id is never reused
  const r = addSlot(removeSlot(p, 'A', 'A6', NOW), 'A', 'cable-crunch', NOW);
  assert.ok(!slot(r, 'A', 'A6'), 'A6 stays retired');
  assert.ok(slot(r, 'A', 'A7'));
  assert.equal(nextSlotId(p, 'L'), 'L6', 'legs add-on ids are reserved');
  // a compound added mid-program is a secondary lift
  const press = slot(addSlot(p, 'C', 'machine-chest-press', NOW), 'C', 'C8');
  assert.deepEqual(press.repRange, roleParams('recomp', 'secondary').repRange);
});

test('removeSlot: a lone superset partner gets its straight-set rest back; a day is never emptied', () => {
  const p = owner();
  const r = removeSlot(p, 'A', 'A3', NOW);
  assert.deepEqual(ids(r, 'A'), ['A1', 'A2', 'A4', 'A5', 'A6']);
  const row = slot(r, 'A', 'A4');
  assert.equal(row.superset, undefined);
  assert.equal(row.restSec, roleParams('recomp', 'primary').restSec);
  let one = p;
  for (const id of ids(p, 'A').slice(1)) one = removeSlot(one, 'A', id, NOW);
  assert.deepEqual(ids(one, 'A'), ['A1']);
  assert.equal(removeSlot(one, 'A', 'A1', NOW), one);
  assert.equal(removeSlot(p, 'A', 'Z1', NOW), p);
});

test('legs: add as a day or as slots, idempotent, removable', () => {
  const p = owner();
  assert.equal(legsMode(p), null);
  const day = addLegs(p, NOW);
  assert.equal(legsMode(day), 'day');
  assert.equal(day.id, p.id);
  assert.equal(day.version, p.version + 1);
  assert.deepEqual(day.days.at(-1).slots.map((s) => s.exerciseId).sort(), [...LEGS_EXERCISE_IDS].sort());
  assert.equal(addLegs(day, NOW), day, 'already there');
  const slots = addLegs(p, NOW, { as: 'slots' });
  assert.equal(legsMode(slots), 'slots');
  assert.equal(slots.days.length, 3);
  const off = removeLegs(slots, NOW);
  assert.equal(legsMode(off), null);
  assert.deepEqual(off.days.map((d) => d.focus), p.days.map((d) => d.focus), 'leg groups leave the focus');
  assert.deepEqual(allSlots(off).map((s) => s.slotId), allSlots(p).map((s) => s.slotId));
  assert.equal(removeLegs(day, NOW).days.length, 3);
  assert.equal(removeLegs(p, NOW), p);
});

test('resetToTemplate, progression parameters and deload interval', () => {
  const four = resetToTemplate('upper-4day', 'strength', 4, NOW);
  assert.equal(four.templateId, 'upper-4day');
  assert.equal(four.goal, 'strength');
  assert.equal(four.daysPerWeek, 4);
  assert.equal(resetToTemplate('owner-3day-upper', 'recomp', 2, NOW).templateId, 'upper-2day', 'day count picks the template');
  const edited = swapSlot(owner(), 'A', 'A3', 'cable-fly', NOW);
  const reset = resetToTemplate('owner-3day-upper', 'recomp', 3, NOW, { from: edited });
  assert.deepEqual([reset.id, reset.version, reset.updatedAt, reset.createdAt], [edited.id, edited.version + 1, NOW, NOW], 'same id, next version, new block');
  assert.equal(slot(reset, 'A', 'A3').exerciseId, 'pec-deck', 'the edits are gone');

  const p = owner();
  const q = setProgressionParams(p, 'double', { stepPct: 30, failsBeforeDeload: 0, deloadPct: 50, overshootReps: 2.4 }, NOW);
  assert.deepEqual(
    [q.progression.double.stepPct, q.progression.double.failsBeforeDeload, q.progression.double.deloadPct, q.progression.double.overshootReps],
    [PROGRESSION_BOUNDS.stepPct[1], PROGRESSION_BOUNDS.failsBeforeDeload[0], PROGRESSION_BOUNDS.deloadPct[1], 2],
  );
  assert.equal(setProgressionParams(p, 'double', { stepPct: 2.7 }, NOW).progression.double.stepPct, 2.5);
  assert.equal(q.progression.linear.stepPct, p.progression.linear.stepPct, 'other rules untouched');
  assert.equal(setProgressionParams(p, 'double', { stepPct: p.progression.double.stepPct }, NOW), p);
  assert.equal(setProgressionParams(p, 'nope', { stepPct: 5 }, NOW), p);

  assert.equal(setDeloadEvery(p, 0, NOW).deloadEveryWeeks, 0);
  assert.equal(setDeloadEvery(p, 2, NOW).deloadEveryWeeks, 3);
  assert.equal(setDeloadEvery(p, 20, NOW).deloadEveryWeeks, 12);
  assert.equal(setDeloadEvery(p, p.deloadEveryWeeks, NOW), p);
});

test('currentProgram and defaultProgram: the active program, else a deterministic owner template', () => {
  const empty = { programs: {}, activeProgramId: null, settings: null };
  const a = currentProgram(empty);
  const b = currentProgram(empty);
  assert.equal(a.saved, false);
  assert.equal(a.program.id, DEFAULT_PROGRAM_ID);
  assert.deepEqual(a.program, b.program, 'same on server and client');
  assert.ok(isDefaultProgram(a.program));
  const two = currentProgram({ ...empty, settings: { goal: 'strength', daysPerWeek: 2 } });
  assert.equal(two.program.goal, 'strength');
  assert.equal(two.program.daysPerWeek, 2);
  const p = owner();
  const saved = currentProgram({ programs: { [p.id]: p }, activeProgramId: p.id, settings: null });
  assert.equal(saved.saved, true);
  assert.equal(saved.program, p);
  assert.equal(defaultProgram('nonsense', 7).daysPerWeek, 3);
});

test('commitProgram: a new version row (UUID, version + 1, active) and the archived old row', () => {
  const p = owner();
  const draft = setSlot(p, 'A', 'A1', { sets: 5 }, NOW);
  const { program, archived } = commitProgram(p, draft, NOW);
  assert.match(program.id, UUID);
  assert.notEqual(program.id, p.id);
  assert.equal(program.version, p.version + 1);
  assert.equal(program.active, true);
  assert.equal(program.createdAt, p.createdAt);
  assert.equal(program.updatedAt, NOW);
  assert.equal(archived.id, p.id);
  assert.equal(archived.active, false);
  assert.equal(archived.updatedAt, NOW);
  assert.ok(isRow('programs', program) && isRow('programs', archived), 'rows pass the store validators');

  const def = defaultProgram();
  const first = commitProgram(def, setGoal(def, 'strength', {}, NOW).program, NOW);
  assert.match(first.program.id, UUID);
  assert.equal(first.program.version, 1);
  assert.equal(first.program.createdAt, NOW, 'the default starts its block calendar on the first save');
  assert.equal(first.archived, null, 'the in-memory default is never written');
  assert.equal(commitProgram(def, swapSlot(def, 'A', 'A3', 'cable-fly', NOW), NOW).program.createdAt, NOW);
});

test('programDiff: readable lines for goal, days, legs and slot edits (EN + RU)', () => {
  const p = owner();
  let d = swapSlot(p, 'A', 'A3', 'cable-fly', NOW);
  d = setSlot(d, 'A', 'A1', { sets: 5, repRange: [5, 8], rir: 3, restSec: 180 }, NOW);
  d = removeSlot(d, 'C', 'C7', NOW);
  d = addSlot(d, 'C', 'dumbbell-shrug', NOW);
  d = moveSlot(d, 'B', 'B1', 1, NOW);
  d = setProgressionParams(d, 'double', { stepPct: 5 }, NOW);
  const lines = programDiff(p, d);
  const kinds = lines.map((l) => l.kind);
  for (const k of ['swap', 'sets', 'reps', 'rir', 'rest', 'removed', 'added', 'moved', 'progression']) assert.ok(kinds.includes(k), `${k} in ${kinds}`);
  for (const l of lines) assert.ok(l.text.en && l.text.ru, 'bilingual');
  assert.match(lines.find((l) => l.kind === 'swap').text.en, /A3 · Pec deck.* → Cable/);
  assert.deepEqual(programDiff(p, p), []);
  const g = programDiff(p, setGoal(p, 'strength', {}, NOW).program);
  assert.deepEqual(g.map((l) => l.kind), ['goal'], 'a goal switch is one line, not a line per slot');
  const days = programDiff(p, setDays(p, 2, NOW));
  assert.equal(days[0].kind, 'days');
  assert.ok(programDiff(p, addLegs(p, NOW)).some((l) => l.kind === 'legs'));
  const step = programDiff(p, setProgressionParams(p, 'double', { stepPct: 3.5 }, NOW)).find((l) => l.kind === 'progression');
  assert.match(step.text.en, /step 2\.5 → 3\.5 %/);
  assert.match(step.text.ru, /шаг 2,5 → 3,5 %/, 'Russian decimal comma');
});

test('swap candidates and like-for-like checks', () => {
  const c = swapCandidates('pec-deck');
  assert.ok(c.length > 0 && c.every((x) => exerciseById(x.id) && x.available));
  assert.ok(c.some((x) => x.id === 'cable-fly'));
  assert.ok(!c.some((x) => x.id === 'pec-deck'));
  const gym = { id: 'g', name: 'G', available: ['pec-deck'], missing: [], preferred: {}, updatedAt: NOW };
  assert.ok(swapCandidates('pec-deck', gym).every((x) => !x.available), 'a checklist gym without them');
  assert.ok(likeForLike('pec-deck', 'cable-fly'));
  assert.ok(!likeForLike('pec-deck', 'leg-press-45'));
});

test('holds (master plan §16): N weeks end at the local midnight after the same weekday N weeks on; set and clear', () => {
  // Tuesday evening after day A: the next A on the same weekday one week later is still held, the day after is not
  const tue = new Date(2026, 10, 10, 19, 30).getTime();
  const until = holdUntilFor(tue, 1);
  assert.equal(until, new Date(2026, 10, 18, 0, 0, 0, 0).toISOString());
  assert.ok(Date.parse(until) > new Date(2026, 10, 17, 23, 59).getTime());
  assert.equal(holdUntilFor(tue, 3), new Date(2026, 11, 2).toISOString());
  assert.deepEqual(HOLD_WEEKS, [1, 8]);
  assert.equal(holdUntilFor(tue, 0.4), holdUntilFor(tue, 1), 'at least one week');
  assert.equal(holdUntilFor(tue, 99), holdUntilFor(tue, 8), 'at most eight');
  const st = deepFreeze({
    exerciseId: 'lat-pulldown', workingKg: 50, targetReps: 8, repRange: [6, 10], rir: 2, e1rm: 66, lastOutcome: 'progressed',
    fails: 0, sessions: 4, lastAt: NOW, updatedAt: NOW,
  });
  const held = setHold(st, 2, tue);
  assert.notEqual(held, st);
  assert.deepEqual({ ...held, holdUntil: undefined, updatedAt: undefined }, { ...st, holdUntil: undefined, updatedAt: undefined }, 'only the hold changes');
  assert.equal(held.holdUntil, holdUntilFor(tue, 2));
  assert.equal(held.updatedAt, new Date(tue).toISOString());
  assert.ok(isRow('exercise_state', held));
  assert.equal(setHold(held, 2, tue), held, 'the same hold again: the same object');
  const cleared = setHold(held, null, tue + 1000);
  assert.equal(cleared.holdUntil, null);
  assert.ok(isRow('exercise_state', cleared));
  assert.equal(setHold(st, null, tue), st, 'nothing to clear');
  assert.equal(setHold(st, 0, tue), st, '0 weeks clears');
});
