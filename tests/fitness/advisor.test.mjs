// Stream 10 — AI advisor: call builder, strict schema, validation and apply (src/lib/fitness/advisor.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVISOR_SCHEMA, AdvisorError, CHANGE_TYPES, DEVELOPER_PROMPT, MAX_CHANGES, adjustCall, adjustmentRow, advisorContext,
  advisorSchema, applyAdjustment, applyProposal, asksForLegs, describeChange, manualAdjustmentRow, validateProposal,
} from '../../src/lib/fitness/advisor.mjs';
import { holdUntilFor, legsMode } from '../../src/lib/fitness/program-edit.mjs';
import { buildProgram } from '../../src/lib/fitness/templates.mjs';
import { exerciseById } from '../../src/lib/fitness/catalog.mjs';
import { holdDay, nextState, roundLoad } from '../../src/lib/fitness/progression.mjs';
import { isRow } from '../../src/lib/fitness/store-core.mjs';

const T0 = '2026-10-20T10:00:00.000Z';
const NOW = '2026-11-08T18:00:00.000Z';
const program = buildProgram({ now: T0, id: '11111111-1111-4111-8111-111111111111' });
const slot = (p, dayKey, slotId) => p.days.find((d) => d.key === dayKey)?.slots.find((s) => s.slotId === slotId);
const T = (en, ru = en) => ({ en, ru });

/** A complete change as the strict schema returns it. */
const change = (o) => ({ type: 'note', dayKey: '', slotId: '', exerciseId: '', newExerciseId: '', value: 0, value2: 0, text: T(''), reason: T('because'), ...o });
const proposal = (changes, extra = {}) => ({ summary: T('Summary.', 'Итог.'), changes, cautions: [], ...extra });

function state(exerciseId, o = {}) {
  const s = program.days.flatMap((d) => d.slots).find((x) => x.exerciseId === exerciseId);
  return {
    exerciseId, workingKg: 50, targetReps: s ? s.repRange[0] + 1 : 8, repRange: s ? [...s.repRange] : [8, 12], rir: s ? s.rir : 2,
    e1rm: 65, lastOutcome: 'progressed', fails: 0, sessions: 4, lastAt: '2026-11-06T18:30:00.000Z', updatedAt: '2026-11-06T19:00:00.000Z', ...o,
  };
}
const states = {
  'machine-chest-press': state('machine-chest-press'),
  'pec-deck': state('pec-deck', { workingKg: 35 }),
  'lat-pulldown': state('lat-pulldown', { workingKg: 55 }),
  'assisted-pull-up': state('assisted-pull-up', { workingKg: 30 }),
};

/** Walk every schema node: objects must forbid extra keys and require all of them (OpenAI strict mode). */
function strictProblems(node, path = '$') {
  const out = [];
  if (!node || typeof node !== 'object') return out;
  if (node.type === 'object') {
    if (node.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
    const keys = Object.keys(node.properties ?? {}).sort();
    const req = [...(node.required ?? [])].sort();
    if (JSON.stringify(keys) !== JSON.stringify(req)) out.push(`${path}: required ${req} ≠ properties ${keys}`);
    for (const [k, v] of Object.entries(node.properties ?? {})) out.push(...strictProblems(v, `${path}.${k}`));
  }
  if (node.type === 'array') out.push(...strictProblems(node.items, `${path}[]`));
  if (!node.type) out.push(`${path}: no type`);
  return out;
}

test('schema: strict everywhere (additionalProperties false, required = all keys) with the ten change types', () => {
  assert.deepEqual(strictProblems(ADVISOR_SCHEMA), []);
  assert.deepEqual(strictProblems(advisorSchema()), []);
  const item = ADVISOR_SCHEMA.properties.changes.items;
  assert.deepEqual(item.properties.type.enum, [...CHANGE_TYPES]);
  assert.deepEqual(new Set(CHANGE_TYPES), new Set(['set_days', 'swap_exercise', 'change_sets', 'change_reps', 'change_rir', 'change_load', 'deload', 'hold', 'add_legs', 'note']));
  assert.deepEqual(Object.keys(item.properties).sort(), ['dayKey', 'exerciseId', 'newExerciseId', 'reason', 'slotId', 'text', 'type', 'value', 'value2'].sort());
  assert.notEqual(advisorSchema(), advisorSchema(), 'a fresh object per call');
});

test('adjustCall: developer rules, the request and a compact JSON context', () => {
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const sessions = { [sessionId]: { id: sessionId, programId: program.id, dayKey: 'A', gymId: null, startedAt: '2026-11-06T18:00:00.000Z', endedAt: '2026-11-06T19:05:00.000Z', status: 'finished', updatedAt: '2026-11-06T19:05:00.000Z' } };
  const sets = Object.fromEntries([0, 1, 2].map((i) => {
    const id = `33333333-3333-4333-8333-33333333333${i}`;
    return [id, { id, sessionId, slotId: 'A1', exerciseId: 'machine-chest-press', setIndex: i, kind: 'working', plannedKg: 50, plannedReps: 8, kg: 50, reps: 9 - i, rir: 2, doneAt: `2026-11-06T18:1${i}:00.000Z`, updatedAt: NOW }];
  }));
  const call = adjustCall({ program, states, sessions, sets, settings: null, bodyweight: { b: { id: 'b', at: '2026-11-07T07:00:00.000Z', kg: 82.4, updatedAt: NOW } }, request: 'Pec deck hurts my left shoulder', lang: 'en', now: NOW });
  assert.equal(call.name, 'fitness_plan_adjustment');
  assert.equal(call.developer, DEVELOPER_PROMPT);
  for (const rule of ['No leg training unless he asks', 'Never raise a weight by more than 10 %', 'at most 6 changes', 'Pain is a stop signal', 'Machines and cables first', 'Keep his goals']) {
    assert.ok(call.developer.includes(rule), `prompt mentions: ${rule}`);
  }
  assert.ok(call.user.includes('Pec deck hurts my left shoulder'));
  assert.ok(call.user.includes('did not ask for legs'));
  const json = JSON.parse(call.user.slice(call.user.indexOf('Context (JSON):\n') + 'Context (JSON):\n'.length));
  assert.equal(json.program.days.length, 3);
  assert.equal(json.program.days[0].slots[0].slotId, 'A1');
  assert.equal(json.goalMode.id, 'recomp');
  assert.equal(json.recentSessions.length, 1);
  assert.equal(json.recentSessions[0].exercises[0].top, '50 kg x 9 @RIR 2');
  assert.equal(json.owner.bodyweight.latestKg, 82.4);
  assert.equal(json.adherence.daysPerWeek, 3);
  assert.ok(json.swapOptions['pec-deck'].some((o) => o.id === 'cable-fly'));
  for (const list of Object.values(json.swapOptions)) for (const o of list) assert.ok(exerciseById(o.id), `${o.id} is a catalog id`);
  assert.deepEqual(call.schema, advisorSchema());
  assert.ok(adjustCall({ program, request: 'Хочу добавить день ног', now: NOW }).user.includes('add_legs is allowed'));
  assert.ok(call.user.length < 40000, `compact (${call.user.length} chars)`);
});

test('advisorContext: last 8 sessions at most, newest first; empty history is fine', () => {
  const sessions = {};
  for (let i = 0; i < 12; i++) {
    const id = `44444444-4444-4444-8444-4444444444${String(i).padStart(2, '0')}`;
    const day = String(1 + i).padStart(2, '0');
    sessions[id] = { id, programId: program.id, dayKey: 'ABC'[i % 3], gymId: null, startedAt: `2026-10-${day}T18:00:00.000Z`, endedAt: `2026-10-${day}T19:00:00.000Z`, status: 'finished', updatedAt: NOW };
  }
  const ctx = advisorContext({ program, sessions, sets: {}, now: NOW });
  assert.equal(ctx.recentSessions.length, 8);
  assert.equal(ctx.recentSessions[0].date, '2026-10-12');
  const empty = advisorContext({ program, now: NOW });
  assert.deepEqual(empty.recentSessions, []);
  assert.deepEqual(empty.states, []);
  assert.equal(empty.adherence.daysSinceLastSession, null);
});

test('validateProposal keeps safe changes and drops unknown ids, bad swaps, out-of-range values and extras', () => {
  const raw = proposal([
    change({ type: 'swap_exercise', dayKey: 'A', slotId: 'A3', exerciseId: 'pec-deck', newExerciseId: 'cable-fly' }),
    change({ type: 'swap_exercise', dayKey: 'A', slotId: 'A3', exerciseId: 'pec-deck', newExerciseId: 'imaginary-machine' }),
    change({ type: 'swap_exercise', dayKey: 'A', slotId: 'A1', exerciseId: 'machine-chest-press', newExerciseId: 'leg-press-45' }),
    change({ type: 'change_sets', dayKey: 'A', slotId: 'Z9', value: 3 }),
    change({ type: 'change_sets', dayKey: 'A', slotId: 'A2', value: 9 }),
    change({ type: 'change_reps', dayKey: 'A', slotId: 'A1', value: 10, value2: 6 }),
    change({ type: 'change_rir', dayKey: 'A', slotId: 'A1', value: 7 }),
    change({ type: 'change_load', exerciseId: 'machine-chest-press', value: 70 }),
    change({ type: 'add_legs' }),
    change({ type: 'deload', exerciseId: '', value: 40 }),
    change({ type: 'teleport' }),
    change({ type: 'note', text: T('') }),
  ]);
  const v = validateProposal(raw, program, null, { states });
  assert.deepEqual(v.changes.map((c) => [c.type, c.newExerciseId]), [['swap_exercise', 'cable-fly']]);
  assert.equal(v.dropped.length, 11);
  const reasons = v.dropped.map((d) => d.reason.en);
  for (const r of ['Unknown exercise.', 'Not a like-for-like replacement for that exercise.', 'No such exercise slot in your program.', 'Outside the safe range for this goal.', 'More than a 10 % jump in weight at once.', 'Legs only when you ask for them.', 'Unknown change type.', 'Empty note.']) {
    assert.ok(reasons.includes(r), `dropped for: ${r}`);
  }
  for (const d of v.dropped) assert.ok(d.reason.en && d.reason.ru);
  assert.throws(() => validateProposal('nope', program), AdvisorError);
  assert.throws(() => validateProposal(null, program), (e) => e.code === 'shape');
});

test('validateProposal: fills the slot from the exercise, legs when asked, no slot edits next to a days change, ≤ 6 changes', () => {
  const byExercise = validateProposal(proposal([change({ type: 'change_sets', exerciseId: 'pec-deck', value: 2 })]), program);
  assert.deepEqual([byExercise.changes[0].dayKey, byExercise.changes[0].slotId], ['A', 'A3']);
  assert.equal(validateProposal(proposal([change({ type: 'add_legs' })]), program, null, { allowLegs: true }).changes.length, 1);

  const withDays = validateProposal(proposal([
    change({ type: 'set_days', value: 2 }),
    change({ type: 'change_sets', dayKey: 'A', slotId: 'A1', value: 3 }),
    change({ type: 'deload', exerciseId: '', value: 10 }),
  ]), program, null, { states });
  assert.deepEqual(withDays.changes.map((c) => c.type), ['set_days', 'deload']);
  assert.match(withDays.dropped[0].reason.en, /rebuilds the program/);

  const many = validateProposal(proposal([
    change({ type: 'change_sets', dayKey: 'A', slotId: 'A1', value: 3 }),
    change({ type: 'change_sets', dayKey: 'A', slotId: 'A1', value: 5 }),
    change({ type: 'change_sets', dayKey: 'A', slotId: 'A2', value: 4 }),
    change({ type: 'change_sets', dayKey: 'A', slotId: 'A3', value: 2 }),
    change({ type: 'change_rir', dayKey: 'A', slotId: 'A1', value: 3 }),
    change({ type: 'change_reps', dayKey: 'A', slotId: 'A1', value: 5, value2: 8 }),
    change({ type: 'hold', exerciseId: 'lat-pulldown' }),
    change({ type: 'note', text: T('Sleep 8 hours.', 'Спите 8 часов.') }),
  ]), program, null, { states });
  assert.equal(many.changes.length, MAX_CHANGES);
  assert.deepEqual(many.dropped.map((d) => d.reason.en), ['The same change twice.', 'More than 6 changes.']);
  assert.equal(validateProposal(proposal([change({ type: 'set_days', value: 3 })]), program).dropped[0].reason.en, 'Already the current value.');
  const gym = { id: 'g', name: 'G', available: [], missing: ['cable-fly'], preferred: {}, updatedAt: NOW };
  assert.equal(validateProposal(proposal([change({ type: 'swap_exercise', dayKey: 'A', slotId: 'A3', newExerciseId: 'cable-fly' })]), program, null, { gym }).dropped[0].reason.en, 'Not available at your gym.');
});

test('applyProposal: set_days rebuilds the program, a swap edits the slot, a deload lowers every working weight', () => {
  const p = proposal([
    change({ type: 'deload', exerciseId: '', value: 10 }),
    change({ type: 'set_days', value: 2 }),
    change({ type: 'note', text: T('Two hard sessions beat three rushed ones.') }),
  ]);
  const v = validateProposal(p, program, null, { states });
  const r = applyProposal({ program, states, proposal: v, now: NOW });
  assert.equal(r.program.daysPerWeek, 2);
  assert.equal(r.program.templateId, 'upper-2day');
  assert.equal(r.program.id, program.id);
  assert.deepEqual(r.applied.map((c) => c.type), ['set_days', 'deload', 'note'], 'program changes first, then states, then notes');
  assert.deepEqual(r.skipped, []);
  const chest = r.states['machine-chest-press'];
  assert.equal(chest.workingKg, roundLoad(50 * 0.9, exerciseById('machine-chest-press'), null, 'easier'));
  assert.equal(chest.lastOutcome, 'deloaded');
  assert.equal(chest.fails, 0);
  assert.ok(chest.note.en.includes('10 %') && chest.note.ru.includes('10 %'));
  assert.ok(r.states['assisted-pull-up'].workingKg > 30, 'assisted machine: a deload means MORE assistance');
  assert.equal(r.changedStates.length, 4);
  for (const s of r.changedStates) assert.ok(isRow('exercise_state', s));
  assert.equal(states['machine-chest-press'].workingKg, 50, 'input states untouched');

  assert.deepEqual(applyAdjustment(program, states, v, NOW), r, 'the master plan name gives the same result');
  const swap = applyProposal({ program, states, proposal: validateProposal(proposal([change({ type: 'swap_exercise', dayKey: 'A', slotId: 'A3', newExerciseId: 'cable-fly' })]), program), now: NOW });
  assert.equal(slot(swap.program, 'A', 'A3').exerciseId, 'cable-fly');
  assert.equal(slot(swap.program, 'A', 'A3').sets, slot(program, 'A', 'A3').sets);
  assert.deepEqual(swap.changedStates, []);

  const none = applyProposal({ program, states, proposal: proposal([change({ type: 'note', text: T('Keep going.') })]), now: NOW });
  assert.equal(none.program, program, 'a note changes nothing');
  const noHistory = applyProposal({ program, states: {}, proposal: proposal([change({ type: 'deload', exerciseId: '', value: 10 })]), now: NOW });
  assert.equal(noHistory.skipped[0].reason.en, 'No logged sessions for this exercise yet.');
});

test('applyProposal: load changes align the state with the slot, holds keep the numbers, legs and slot edits apply', () => {
  const v = validateProposal(proposal([
    change({ type: 'change_load', exerciseId: 'machine-chest-press', value: 53, value2: 7 }),
    change({ type: 'change_reps', dayKey: 'A', slotId: 'A1', value: 5, value2: 8 }),
    change({ type: 'hold', exerciseId: 'lat-pulldown', reason: T('Elbow is sore.', 'Болит локоть.') }),
    change({ type: 'add_legs' }),
  ]), program, null, { states, allowLegs: true });
  assert.equal(v.changes.length, 4);
  const r = applyProposal({ program, states, proposal: v, now: NOW });
  assert.deepEqual(slot(r.program, 'A', 'A1').repRange, [5, 8]);
  const chest = r.states['machine-chest-press'];
  assert.equal(chest.workingKg, roundLoad(53, exerciseById('machine-chest-press'), null, 'nearest'));
  assert.deepEqual(chest.repRange, [5, 8], 'aligned with the edited slot, so the engine does not convert it again');
  assert.equal(chest.targetReps, 7);
  const lat = r.states['lat-pulldown'];
  assert.deepEqual([lat.workingKg, lat.targetReps, lat.holdUntil], [55, states['lat-pulldown'].targetReps, holdUntilFor(NOW, 1)], 'value 0 = a one-week hold');
  assert.match(lat.note.en, /^Hold/);
  assert.ok(lat.note.en.includes(holdDay(lat.holdUntil, 'en')) && lat.note.ru.includes(holdDay(lat.holdUntil, 'ru')), 'the note names the date (the tracker shows it once)');
  assert.match(lat.note.ru, /Болит локоть/);
  assert.equal(legsMode(r.program), 'day');
  assert.equal(r.program.version, program.version + 2);
});

test('describeChange: lines built from the program, in both languages', () => {
  const swap = change({ type: 'swap_exercise', dayKey: 'A', slotId: 'A3', exerciseId: 'pec-deck', newExerciseId: 'cable-fly' });
  assert.match(describeChange(swap, program, states, 'en'), /^A3 · Pec deck .* → Cable/);
  assert.match(describeChange(change({ type: 'set_days', value: 2 }), program, states, 'ru'), /Дней в неделю: 3 → 2/);
  assert.match(describeChange(change({ type: 'change_sets', dayKey: 'A', slotId: 'A1', value: 3 }), program, states, 'en'), /4 → 3 sets/);
  assert.match(describeChange(change({ type: 'change_load', exerciseId: 'machine-chest-press', value: 55 }), program, states, 'en'), /50 kg → 55 kg/);
  assert.match(describeChange(change({ type: 'deload', value: 10 }), program, states, 'en'), /All exercises: 10 % lighter/);
  assert.equal(describeChange(change({ type: 'note', text: T('Rest well.', 'Отдыхайте.') }), program, states, 'ru'), 'Отдыхайте.');
  assert.equal(describeChange(change({ type: 'hold', exerciseId: 'lat-pulldown', value: 3 }), program, states, 'en'), 'Lat pulldown: weight held at 55 kg for 3 weeks');
  assert.match(describeChange(change({ type: 'hold', exerciseId: 'lat-pulldown', value: 1 }), program, states, 'ru'), /: вес 55 кг зафиксирован на 1 неделю$/);
  assert.match(describeChange(change({ type: 'hold', exerciseId: 'lat-pulldown', value: 5 }), program, states, 'ru'), /на 5 недель$/);
  // an assisted machine: "нагрузка (помощь 30 кг) зафиксирована", not "вес помощь 30 кг зафиксирован"
  assert.match(describeChange(change({ type: 'hold', exerciseId: 'assisted-pull-up', value: 3 }), program, states, 'en'), /: weight held at assistance 30 kg for 3 weeks$/);
  assert.match(describeChange(change({ type: 'hold', exerciseId: 'assisted-pull-up', value: 3 }), program, states, 'ru'), /: нагрузка \(помощь 30 кг\) зафиксирована на 3 недели$/);
  assert.match(describeChange(change({ type: 'hold', exerciseId: 'lat-pulldown' }), program, {}, 'en'), /no weight increase for 1 week$/, 'no state: the generic line');
});

test('adjustment rows pass the store validators and never carry the key', () => {
  const v = validateProposal(proposal([change({ type: 'note', text: T('ok') })]), program);
  const r = applyProposal({ program, states, proposal: v, now: NOW });
  const row = adjustmentRow({ now: NOW, request: 'More strength-focused', lang: 'en', model: 'gpt-x', effort: 'medium', program, proposal: v, dropped: v.dropped, result: r, applied: true });
  assert.ok(isRow('adjustments', row));
  assert.equal(row.source, 'ai');
  assert.equal(row.applied, true);
  assert.equal(row.input.request, 'More strength-focused');
  assert.ok(!JSON.stringify(row).includes('sk-'), 'no key');
  assert.equal(row.output.savedProgramId, null, 'nothing saved: a note only');
  const next = { ...program, id: '55555555-5555-4555-8555-555555555555', version: program.version + 1 };
  const saved = adjustmentRow({ now: NOW, request: 'x', lang: 'en', model: 'm', effort: 'low', program, proposal: v, result: r, applied: true, saved: next });
  assert.ok(isRow('adjustments', saved));
  assert.deepEqual([saved.output.savedProgramId, saved.output.savedVersion, saved.input.programId], [next.id, next.version, program.id]);
  const dismissed = adjustmentRow({ now: NOW, request: 'x', lang: 'ru', model: 'm', effort: 'low', program, proposal: v, applied: false });
  assert.ok(isRow('adjustments', dismissed));
  assert.equal(dismissed.applied, false);
  const manual = manualAdjustmentRow({ now: NOW, before: program, after: program, lines: [T('A3 · Pec deck → Cable fly')] });
  assert.ok(isRow('adjustments', manual));
  assert.equal(manual.source, 'manual');
});

test('asksForLegs: English and Russian, without false friends', () => {
  for (const t of ['Add a leg day', 'Can I squat?', 'Хочу добавить ноги', 'день ног', 'приседания', 'Ягодицы']) assert.ok(asksForLegs(t), t);
  for (const t of ['Pec deck hurts my left shoulder', 'много жимов', 'становится тяжело', 'микроциклы', 'More strength-focused']) assert.ok(!asksForLegs(t), t);
});

test('hold (master plan §16): value = weeks (1–8, 0 = 1) → ExerciseState.holdUntil; the engine adds no weight before it', () => {
  const v = validateProposal(proposal([
    change({ type: 'hold', exerciseId: 'lat-pulldown', value: 3 }),
    change({ type: 'hold', exerciseId: 'machine-chest-press', value: 0 }),
    change({ type: 'hold', exerciseId: 'pec-deck', value: 9 }),
    change({ type: 'hold', exerciseId: 'assisted-pull-up', value: 2.5 }),
    change({ type: 'hold', exerciseId: 'machine-row', value: -1 }),
    change({ type: 'hold', exerciseId: 'leg-press-45', value: 2 }),
    change({ type: 'hold', exerciseId: 'imaginary-machine', value: 2 }),
  ]), program, null, { states });
  assert.deepEqual(v.changes.map((c) => [c.exerciseId, c.value, c.value2]), [['lat-pulldown', 3, 0], ['machine-chest-press', 1, 0]]);
  assert.deepEqual(v.dropped.map((d) => d.reason.en), [
    'Outside the safe range for this goal.', 'Outside the safe range for this goal.', 'Outside the safe range for this goal.',
    'That exercise is not in your program.', 'Unknown exercise.',
  ]);
  const r = applyProposal({ program, states, proposal: v, now: NOW });
  const lat = r.states['lat-pulldown'];
  assert.equal(lat.holdUntil, holdUntilFor(NOW, 3));
  assert.equal(r.states['machine-chest-press'].holdUntil, holdUntilFor(NOW, 1));
  for (const s of r.changedStates) assert.ok(isRow('exercise_state', s), s.exerciseId);
  // the engine honours it: a session at the top before the date keeps the weight, the first one after it steps up
  const p = { rule: 'double', repRange: [6, 10], rir: 2, stepPct: 2.5, failsBeforeDeload: 2, deloadPct: 10, overshootReps: 2 };
  const top = (at) => [0, 1, 2].map((i) => ({ id: `h${i}`, sessionId: 'h', slotId: 'A2', exerciseId: 'lat-pulldown', setIndex: i, kind: 'working', plannedKg: 55, plannedReps: 10, kg: 55, reps: 10, rir: 2, doneAt: at, updatedAt: at }));
  const s = { ...lat, targetReps: 10 };
  const lastDay = new Date(Date.parse(lat.holdUntil) - 3_600_000).toISOString();
  assert.deepEqual([nextState(s, top(lastDay), p, exerciseById('lat-pulldown'), lastDay).state.workingKg], [55]);
  const after = nextState(s, top(lat.holdUntil), p, exerciseById('lat-pulldown'), lat.holdUntil).state;
  assert.ok(after.workingKg > 55 && after.holdUntil === null, `${after.workingKg} kg, hold ${after.holdUntil}`);
});

test('an active hold is in the context, and validation drops a heavier change_load for it (master plan §16)', () => {
  const HELD = 'The weight is on hold: nothing heavier before the hold ends.';
  const until = holdUntilFor(NOW, 2);
  const held = { ...states, 'lat-pulldown': { ...states['lat-pulldown'], holdUntil: until }, 'assisted-pull-up': { ...states['assisted-pull-up'], holdUntil: until } };
  const ctx = advisorContext({ program, states: held, now: NOW });
  const heldUntil = Object.fromEntries(ctx.states.map((x) => [x.exerciseId, x.heldUntil]));
  const d = new Date(until);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.deepEqual([heldUntil['lat-pulldown'], heldUntil['machine-chest-press']], [key, null]);
  assert.equal(advisorContext({ program, states: held, now: until }).states.find((x) => x.exerciseId === 'lat-pulldown')?.heldUntil, null, 'over on its date');
  assert.match(DEVELOPER_PROMPT, /heldUntil/);
  const v = validateProposal(proposal([
    change({ type: 'change_load', exerciseId: 'lat-pulldown', value: 60 }), // heavier than 55 kg during the hold
    change({ type: 'change_load', exerciseId: 'assisted-pull-up', value: 25 }), // less assistance is heavier
    change({ type: 'change_load', exerciseId: 'machine-chest-press', value: 52.5 }), // no hold
    change({ type: 'change_load', exerciseId: 'pec-deck', value: 37.5 }), // heavier, and held by the same proposal
    change({ type: 'hold', exerciseId: 'pec-deck', value: 2 }),
  ]), program, null, { states: held, now: NOW });
  assert.deepEqual(v.changes.map((c) => `${c.type}:${c.exerciseId}`), ['change_load:machine-chest-press', 'hold:pec-deck']);
  assert.deepEqual(v.dropped.map((x) => [x.change.exerciseId, x.reason.en]), [['lat-pulldown', HELD], ['assisted-pull-up', HELD], ['pec-deck', HELD]]);
  assert.match(v.dropped[0].reason.ru, /зафиксирован/);
  // lighter during a hold is how a hold goes back down; on its date heavier is fine again
  for (const [kg, at] of [[50, NOW], [60, until]]) {
    assert.equal(validateProposal(proposal([change({ type: 'change_load', exerciseId: 'lat-pulldown', value: kg })]), program, null, { states: held, now: at }).changes.length, 1, `${kg} kg at ${at}`);
  }
});

test('the plateau memory is in the context (the load that ended in a deload, and how often), and the rules explain it (§16 rule 5)', () => {
  const memo = { ...states, 'lat-pulldown': { ...states['lat-pulldown'], plateau: { kg: 60, times: 2, streak: 1 } }, 'pec-deck': { ...states['pec-deck'], plateau: 'junk' } };
  const ctx = advisorContext({ program, states: memo, now: NOW });
  const by = Object.fromEntries(ctx.states.map((x) => [x.exerciseId, x.plateau]));
  assert.deepEqual([by['lat-pulldown'], by['pec-deck'], by['machine-chest-press']], [{ failedKg: 60, times: 2 }, null, null]);
  assert.match(DEVELOPER_PROMPT, /states\[\]\.plateau/);
  assert.deepEqual(strictProblems(ADVISOR_SCHEMA), [], 'the answer schema is unchanged');
  // applying: another weight starts the streak over (it counts sessions at one weight), the same weight keeps it, a
  // deload by the adviser remembers nothing new, a new rep range forgets it, and states without one stay without
  const apply = (changes) => applyProposal({ program, states: memo, proposal: validateProposal(proposal(changes), program, null, { states: memo }), now: NOW }).states;
  assert.deepEqual(apply([change({ type: 'change_load', exerciseId: 'lat-pulldown', value: 50 })])['lat-pulldown'].plateau, { kg: 60, times: 2, streak: 0 });
  assert.deepEqual(apply([change({ type: 'change_load', exerciseId: 'lat-pulldown', value: 55, value2: 9 })])['lat-pulldown'].plateau, { kg: 60, times: 2, streak: 1 });
  const deloaded = apply([change({ type: 'deload', value: 10 })]);
  assert.deepEqual([deloaded['lat-pulldown'].workingKg, deloaded['lat-pulldown'].plateau], [45, { kg: 60, times: 2, streak: 0 }]);
  assert.equal(deloaded['pec-deck'].plateau, null, 'a malformed memory is cleared');
  assert.equal('plateau' in deloaded['machine-chest-press'], false);
  const lat = slot(program, 'A', 'A2');
  assert.equal(lat?.exerciseId, 'lat-pulldown');
  const ranged = apply([change({ type: 'change_reps', dayKey: 'A', slotId: 'A2', value: 8, value2: 12 }), change({ type: 'change_load', exerciseId: 'lat-pulldown', value: 50 })]);
  assert.deepEqual([ranged['lat-pulldown'].repRange, ranged['lat-pulldown'].plateau], [[8, 12], null]);
});

test('applyProposal is pure: deep-frozen inputs, new objects out, the same answer twice', () => {
  const deepFreeze = (o) => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      for (const v of Object.values(o)) deepFreeze(v);
    }
    return o;
  };
  const p0 = structuredClone(program);
  const s0 = structuredClone(states);
  const v = validateProposal(proposal([
    change({ type: 'set_days', value: 2 }),
    change({ type: 'change_load', exerciseId: 'machine-chest-press', value: 52.5, value2: 7 }),
    change({ type: 'deload', exerciseId: 'pec-deck', value: 10 }),
    change({ type: 'hold', exerciseId: 'lat-pulldown', value: 2 }),
    change({ type: 'note', text: T('Sleep.') }),
  ]), program, null, { states });
  const frozen = { program: deepFreeze(structuredClone(program)), states: deepFreeze(structuredClone(states)), proposal: deepFreeze(structuredClone(v)) };
  const a = applyProposal({ ...frozen, now: NOW });
  const b = applyProposal({ ...frozen, now: NOW });
  assert.deepEqual(a, b);
  assert.deepEqual(frozen.program, p0);
  assert.deepEqual(frozen.states, s0);
  assert.notEqual(a.program, frozen.program);
  assert.notEqual(a.states, frozen.states);
  assert.deepEqual(a.applied.map((c) => c.type), ['set_days', 'change_load', 'deload', 'hold', 'note']);
});
