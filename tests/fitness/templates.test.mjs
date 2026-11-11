// Stream 03 — goal modes, split templates and program building (src/lib/fitness/templates.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import registry from '../../content/fitness/registry.json' with { type: 'json' };
import {
  DEFAULT_TEMPLATE_ID, GOAL_IDS, GOAL_MODES, LEGS_TEMPLATE_ID, PROGRESSION_RULE_IDS, REP_MAX_PERCENT,
  REP_MAX_PERCENT_SOURCE, RULES, SLOT_ROLES, TEMPLATES, WARMUP, WARMUP_RAMP, buildProgram, convertProgram,
  deriveSlot, estimateMinutes, finisherMinutes, modeParams, roleParams, slotParams, slotRole, templateById, withLegs,
} from '../../src/lib/fitness/templates.mjs';
import { groupWeights, weeklySets, weeklySetsTarget } from '../../src/lib/fitness/progression.mjs';
import { CATALOG } from './engine-fixtures.mjs';

const NOW = '2026-11-10T18:00:00.000Z';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REG = /** @type {Record<string, { pattern: string, classes: string[] }>} */ (/** @type {any} */ (registry.exercises));
const hasText2 = (t) => Boolean(t && typeof t.en === 'string' && t.en.trim() && typeof t.ru === 'string' && t.ru.trim());
const isRange = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] > 0 && r[0] < r[1];

/* antagonist pairs for supersets: push ↔ pull, curl ↔ triceps, trunk flexion ↔ extension, knee flexion ↔ extension */
const PUSH = new Set(['horizontal-push', 'incline-push', 'decline-push', 'vertical-push', 'chest-fly']);
const PULL = new Set(['horizontal-pull', 'vertical-pull', 'pullover', 'rear-delt']);
const PAIRS = [
  ['elbow-flexion', 'elbow-extension'], ['elbow-flexion', 'decline-push'], ['trunk-flexion', 'spinal-extension'],
  ['hip-flexion', 'spinal-extension'], ['knee-flexion', 'knee-extension'],
];
function antagonists(a, b) {
  if ((PUSH.has(a) && PULL.has(b)) || (PULL.has(a) && PUSH.has(b))) return true;
  return PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

test('every goal mode is complete and sourced', () => {
  assert.deepEqual(Object.keys(GOAL_MODES).sort(), [...GOAL_IDS].sort());
  for (const id of GOAL_IDS) {
    const m = GOAL_MODES[id];
    assert.ok(hasText2(m.name) && hasText2(m.summary) && hasText2(m.deloadRule), `${id}: texts`);
    assert.ok(isRange(m.repRange), `${id}: repRange`);
    assert.ok(m.rir >= 0 && m.rir <= 5, `${id}: rir`);
    const w = m.setsPerMuscleWeek;
    assert.ok(w.start > 0 && w.start <= w.target && w.target <= w.max, `${id}: setsPerMuscleWeek`);
    assert.ok(m.restSec.compound >= m.restSec.isolation && m.restSec.isolation > 0, `${id}: restSec`);
    assert.ok(m.frequency[0] >= 1 && m.frequency[0] <= m.frequency[1], `${id}: frequency`);
    assert.ok(Number.isInteger(m.blockWeeks) && m.blockWeeks >= 3, `${id}: blockWeeks`);
    assert.ok(m.sources.length >= 2 && m.sources.every((s) => typeof s === 'string' && s.length > 10), `${id}: sources`);
    const p = m.progression;
    assert.equal(p.rule, 'double');
    assert.deepEqual(p.repRange, m.repRange, `${id}: progression range = main-lift range`);
    assert.ok(p.stepPct > 0 && p.failsBeforeDeload >= 2 && p.deloadPct > 0 && p.overshootReps > 0, `${id}: progression params`);
    for (const role of SLOT_ROLES) {
      const r = m.roles[role];
      assert.ok(r, `${id}: role ${role}`);
      assert.ok(Number.isInteger(r.sets) && r.sets >= 1 && r.sets <= 5, `${id}/${role}: sets`);
      assert.ok(isRange(r.repRange) && r.rir >= 0 && r.rir <= 5 && r.restSec >= 30, `${id}/${role}: prescription`);
    }
    assert.equal(m.roles.hold.byUnit?.seconds?.length, 2, `${id}: holds have a seconds range`);
    assert.equal(m.roles.carry.unit, 'meters', `${id}: carries count metres`);
  }
  // the modes differ where they should
  assert.ok(GOAL_MODES.strength.repRange[1] <= 6 && GOAL_MODES.endurance.repRange[0] >= 15);
  assert.ok(GOAL_MODES.hypertrophy.setsPerMuscleWeek.target > GOAL_MODES.maintenance.setsPerMuscleWeek.target);
  assert.equal(modeParams('nope'), GOAL_MODES.recomp, 'unknown goal falls back to recomp');
  assert.equal(roleParams('recomp', 'nope'), GOAL_MODES.recomp.roles.isolation);
});

test('%1RM table, warm-up ramp and rules are sane', () => {
  assert.deepEqual(Object.keys(REP_MAX_PERCENT).map(Number), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(REP_MAX_PERCENT['1'], 100);
  for (let r = 2; r <= 20; r++) assert.ok(REP_MAX_PERCENT[String(r)] < REP_MAX_PERCENT[String(r - 1)], `strictly decreasing at ${r}`);
  assert.ok(REP_MAX_PERCENT_SOURCE.length > 10);
  assert.equal(WARMUP.minutes, 5);
  assert.ok(hasText2(WARMUP.general) && /5/.test(WARMUP.general.en));
  assert.equal(WARMUP_RAMP[0].when, 'always');
  for (let i = 1; i < WARMUP_RAMP.length; i++) {
    assert.ok(WARMUP_RAMP[i].pct > WARMUP_RAMP[i - 1].pct && WARMUP_RAMP[i].reps < WARMUP_RAMP[i - 1].reps);
  }
  assert.ok(WARMUP_RAMP.every((s) => s.pct < 100));
  assert.deepEqual(RULES.gap.shortPct, [5, 10]);
  // research/02 §I: one missed week (14 days) is no break; 29–90 days restart at 80 %, beyond 90 days at 70 % as new
  assert.deepEqual(RULES.gap.longPct, [20, 20]);
  assert.equal(RULES.gap.keepBelowDays, 15);
  assert.equal(RULES.gap.longFromDays, 29);
  assert.deepEqual([RULES.gap.newFromDays, RULES.gap.newPct], [91, 30]);
  assert.deepEqual(RULES.bigStep, { sessionsAtCeiling: 2, maxSessions: 8, maxKg: 5, maxPct: 25 });
  assert.equal(RULES.deload.setsMultiplier, 0.6);
  assert.equal(RULES.deload.loadMultiplier, 1);
  for (const key of ['rirTolerance', 'gap', 'deload', 'substitution', 'startLoadFactor', 'bodyweightExponent', 'conversion']) assert.ok(RULES.sources[key], `rules source ${key}`);
});

test('owner template matches registry.ownerTemplate exactly; the legs add-on matches legsAddon', () => {
  const owner = templateById(DEFAULT_TEMPLATE_ID);
  assert.ok(owner);
  assert.equal(owner.daysPerWeek, 3);
  assert.equal(owner.goal, 'recomp');
  assert.deepEqual(owner.days.map((d) => d.key), registry.ownerTemplate.days.map((d) => d.key));
  owner.days.forEach((d, i) => {
    const reg = registry.ownerTemplate.days[i];
    assert.deepEqual(d.slots.map((s) => [s.slotId, s.exerciseId]), reg.slots, `day ${d.key} slots`);
    assert.deepEqual(d.name, reg.name, `day ${d.key} name`);
  });
  const legs = templateById(LEGS_TEMPLATE_ID);
  assert.ok(legs?.addon);
  const legPairs = legs.days.flatMap((d) => d.slots.map((s) => [s.slotId, s.exerciseId]));
  const sortPairs = (/** @type {string[][]} */ a) => [...a].sort((x, y) => x[0].localeCompare(y[0]));
  assert.deepEqual(sortPairs(legPairs), sortPairs(registry.ownerTemplate.legsAddon));
  // the pec priority lifts and the back-focus opener carry the priority flag
  const pri = owner.days.flatMap((d) => d.slots.filter((s) => s.priority).map((s) => s.slotId));
  assert.deepEqual(pri, ['A1', 'A3', 'B1']);
});

test('every template slot is well formed, from the registry, with a reason', () => {
  for (const tpl of TEMPLATES) {
    assert.ok(hasText2(tpl.name) && hasText2(tpl.description), `${tpl.id}: texts`);
    assert.ok(tpl.sources.length >= 2, `${tpl.id}: sources`);
    const ids = new Set();
    for (const day of tpl.days) {
      assert.ok(hasText2(day.name) && day.focus.length > 0, `${tpl.id}/${day.key}`);
      assert.ok(hasText2(day.finisher), `${tpl.id}/${day.key}: finisher`);
      const fm = finisherMinutes(day.finisher);
      assert.ok(fm >= 10 && fm <= 15, `${tpl.id}/${day.key}: finisher ${fm} min`);
      for (const s of day.slots) {
        assert.ok(!ids.has(s.slotId), `${tpl.id}: duplicate slot ${s.slotId}`);
        ids.add(s.slotId);
        assert.ok(REG[s.exerciseId], `${tpl.id}/${s.slotId}: ${s.exerciseId} not in the registry`);
        assert.ok(SLOT_ROLES.includes(s.role), `${tpl.id}/${s.slotId}: role`);
        // (1 set: a small-muscle slot trimmed so the goal's weekly volume band holds, see the bands test below)
        assert.ok(s.sets >= 1 && s.sets <= 4, `${tpl.id}/${s.slotId}: sets ${s.sets}`);
        assert.ok(isRange(s.repRange) && s.rir >= 0 && s.rir <= 5 && s.restSec >= 45, `${tpl.id}/${s.slotId}: prescription`);
        assert.ok(PROGRESSION_RULE_IDS.includes(s.progression), `${tpl.id}/${s.slotId}: progression`);
        assert.ok(hasText2(s.why), `${tpl.id}/${s.slotId}: why`);
      }
    }
  }
});

test('stored slot numbers equal the role derivation (goal modes stay the single source of truth)', () => {
  for (const tpl of TEMPLATES) {
    for (const day of tpl.days) {
      for (const s of day.slots) {
        const role = roleParams(tpl.goal, s.role);
        const d = deriveSlot(s, tpl.goal, s.unit ?? role.unit ?? 'reps');
        assert.deepEqual([s.sets, s.repRange, s.rir, s.restSec], [d.sets, d.repRange, d.rir, d.restSec], `${tpl.id}/${s.slotId}`);
      }
    }
  }
});

test('supersets pair two antagonists on the same day and keep at least 60 s rest', () => {
  let count = 0;
  for (const tpl of TEMPLATES) {
    for (const day of tpl.days) {
      /** @type {Record<string, any[]>} */
      const groups = {};
      for (const s of day.slots) if (s.superset) (groups[s.superset] ??= []).push(s);
      for (const [id, members] of Object.entries(groups)) {
        count += 1;
        assert.equal(members.length, 2, `${tpl.id}/${day.key}/${id}: a pair`);
        const [a, b] = members.map((m) => REG[m.exerciseId].pattern);
        assert.ok(antagonists(a, b), `${tpl.id}/${day.key}/${id}: ${a} + ${b} are not antagonists`);
        assert.ok(members.every((m) => m.restSec >= 60), `${tpl.id}/${day.key}/${id}: rest`);
      }
    }
  }
  assert.ok(count >= 6);
});

test('buildProgram: the owner default, contract fields, all goals', () => {
  const p = buildProgram({ now: NOW, catalog: CATALOG });
  assert.match(p.id, UUID);
  assert.equal(p.templateId, DEFAULT_TEMPLATE_ID);
  assert.equal(p.goal, 'recomp');
  assert.equal(p.daysPerWeek, 3);
  assert.equal(p.rotation, 'sequential');
  assert.equal(p.version, 1);
  assert.equal(p.createdAt, NOW);
  assert.equal(p.updatedAt, NOW);
  assert.equal(p.deloadEveryWeeks, GOAL_MODES.recomp.blockWeeks);
  assert.deepEqual(Object.keys(p.progression).sort(), [...PROGRESSION_RULE_IDS].sort());
  for (const rule of PROGRESSION_RULE_IDS) assert.equal(p.progression[rule].rule, rule);
  assert.deepEqual(p.days.map((d) => d.key), ['A', 'B', 'C']);
  const a1 = p.days[0].slots[0];
  assert.deepEqual(
    { slotId: a1.slotId, exerciseId: a1.exerciseId, sets: a1.sets, repRange: a1.repRange, rir: a1.rir, restSec: a1.restSec, priority: a1.priority },
    { slotId: 'A1', exerciseId: 'machine-chest-press', sets: 4, repRange: [6, 10], rir: 2, restSec: 150, priority: true },
  );
  assert.ok(hasText2(a1.why));
  // units come from the catalog: the carry counts metres, the anti-rotation press counts reps
  const c7 = p.days[2].slots.find((s) => s.slotId === 'C7');
  assert.deepEqual(c7?.repRange, [20, 40]);
  const b7 = p.days[1].slots.find((s) => s.slotId === 'B7');
  assert.deepEqual(b7?.repRange, [8, 12]);
  // a hold that counts seconds gets the seconds range of its role
  assert.deepEqual(deriveSlot({ slotId: 'X1', exerciseId: 'plank', role: 'hold' }, 'recomp', 'seconds').repRange, [20, 40]);

  for (const goal of GOAL_IDS) {
    const g = buildProgram({ goal, now: NOW, catalog: CATALOG });
    assert.equal(g.goal, goal);
    assert.equal(g.deloadEveryWeeks, GOAL_MODES[goal].blockWeeks);
    for (const s of g.days.flatMap((d) => d.slots)) {
      assert.ok(s.sets >= 1 && s.sets <= 5 && isRange(s.repRange), `${goal}/${s.slotId}`);
      assert.deepEqual(slotParams(g, s).repRange, s.repRange);
      assert.equal(slotParams(g, s).rir, s.rir);
    }
  }
  const strength = buildProgram({ goal: 'strength', now: NOW, catalog: CATALOG });
  const s1 = strength.days[0].slots[0];
  // strength: no priority bonus (a main lift is 2–4 sets), full rests
  assert.deepEqual([s1.sets, s1.repRange, s1.rir, s1.restSec], [4, [3, 6], 2, 180]);
});

test('buildProgram: day counts pick the 2- and 4-day templates; bad input throws', () => {
  assert.equal(buildProgram({ daysPerWeek: 2, now: NOW }).templateId, 'upper-2day');
  assert.equal(buildProgram({ daysPerWeek: 4, now: NOW }).templateId, 'upper-4day');
  assert.deepEqual(buildProgram({ daysPerWeek: 4, now: NOW }).days.map((d) => d.key), ['A', 'B', 'C', 'D']);
  assert.equal(buildProgram({ templateId: 'upper-2day', daysPerWeek: 3, now: NOW }).templateId, DEFAULT_TEMPLATE_ID);
  assert.throws(() => buildProgram({ templateId: 'nope' }), /Unknown fitness template/);
  assert.throws(() => buildProgram({ templateId: LEGS_TEMPLATE_ID }), /add-on/);
  assert.throws(() => buildProgram({ daysPerWeek: 5 }), /daysPerWeek/);
  assert.throws(() => buildProgram({ goal: /** @type {any} */ ('bulk') }), /Unknown goal/);
  const a = buildProgram({ now: NOW });
  const b = buildProgram({ now: NOW });
  assert.notEqual(a.id, b.id, 'fresh UUID per program row');
  assert.equal(buildProgram({ now: NOW, id: 'fixed' }).id, 'fixed');
});

test('convertProgram: same exercises, re-derived prescription, new row with version + 1', () => {
  const p = buildProgram({ now: NOW, catalog: CATALOG });
  const before = structuredClone(p);
  const later = '2026-12-01T10:00:00.000Z';
  const s = convertProgram(p, 'strength', later, { catalog: CATALOG });
  assert.deepEqual(p, before, 'input untouched');
  assert.notEqual(s.id, p.id);
  assert.match(s.id, UUID);
  assert.equal(s.version, 2);
  assert.equal(s.goal, 'strength');
  assert.equal(s.createdAt, later);
  assert.equal(s.deloadEveryWeeks, GOAL_MODES.strength.blockWeeks);
  assert.equal(s.progression.double.failsBeforeDeload, GOAL_MODES.strength.progression.failsBeforeDeload);
  const ids = (/** @type {any} */ q) => q.days.map((d) => d.slots.map((x) => `${x.slotId}:${x.exerciseId}:${x.priority ?? ''}`));
  assert.deepEqual(ids(s), ids(p));
  assert.deepEqual(s.days[0].slots[0].repRange, [3, 6]);
  assert.equal(s.days[0].slots[0].sets, 4);
  // a heavy 3–6-rep slot is never supersetted: the pairs with a strength primary (A3 + A4, B2 + B3) rest in full,
  // the others stay; going back to recomp pairs them again (asserted below: back.days equals p.days)
  const pairs = (/** @type {any} */ q) => q.days.flatMap((d) => d.slots.filter((x) => x.superset).map((x) => `${x.slotId}:${x.superset}:${x.restSec}`));
  assert.deepEqual(pairs(p), ['A3:sA1:60', 'A4:sA1:75', 'B2:sB1:60', 'B3:sB1:75', 'B4:sB2:60', 'B5:sB2:60', 'C1:sC1:60', 'C2:sC1:60']);
  assert.deepEqual(pairs(s), ['B4:sB2:60', 'B5:sB2:60', 'C1:sC1:75', 'C2:sC1:60']);
  const rest = (/** @type {string} */ id) => s.days.flatMap((d) => d.slots).find((x) => x.slotId === id)?.restSec;
  assert.deepEqual([rest('A3'), rest('A4'), rest('B2'), rest('B3')], [90, 180, 150, 180]);
  // the strength rebuild equals a fresh strength program (same derivation)
  const fresh = buildProgram({ goal: 'strength', now: later, catalog: CATALOG });
  assert.deepEqual(s.days, fresh.days);
  // and back again
  const back = convertProgram(s, 'recomp', later, { catalog: CATALOG });
  assert.equal(back.version, 3);
  assert.deepEqual(back.days, p.days);
  assert.throws(() => convertProgram(p, /** @type {any} */ ('cut')), /Unknown goal/);
});

test('withLegs: a new day L by default, or the slots spread over A/B/C; idempotent', () => {
  const p = buildProgram({ now: NOW, catalog: CATALOG });
  const d = withLegs(p, NOW, { catalog: CATALOG });
  assert.notEqual(d.id, p.id);
  assert.equal(d.version, 2);
  assert.deepEqual(d.days.map((x) => x.key), ['A', 'B', 'C', 'L']);
  assert.deepEqual(d.days[3].slots.map((x) => x.slotId), ['L5', 'L1', 'L2', 'L3', 'L4']);
  assert.equal(d.days[3].slots[0].rir, 3, 'the deadlift keeps an extra rep in reserve');
  assert.equal(withLegs(d, NOW), d, 'idempotent');
  assert.equal(p.days.length, 3, 'input untouched');

  const s = withLegs(p, NOW, { as: 'slots', catalog: CATALOG });
  assert.deepEqual(s.days.map((x) => x.key), ['A', 'B', 'C']);
  const added = (key) => s.days.find((x) => x.key === key)?.slots.filter((x) => x.slotId.startsWith('L')).map((x) => x.slotId);
  assert.deepEqual(added('A'), ['L1', 'L4']);
  assert.deepEqual(added('B'), ['L2', 'L3']);
  assert.deepEqual(added('C'), ['L5']);
  assert.equal(withLegs(s, NOW, { as: 'slots' }), s, 'idempotent');
  // a 4-day program has no C → nothing lost: the leftover slots go round-robin
  const four = withLegs(buildProgram({ daysPerWeek: 4, now: NOW }), NOW, { as: 'slots' });
  assert.equal(four.days.flatMap((x) => x.slots).filter((x) => x.slotId.startsWith('L')).length, 5);
  // slot roles resolve through the add-on template
  assert.equal(slotRole(d, d.days[3].slots[0], CATALOG), 'primary');
});

test('session length estimates stay within 75 min, and the finisher counts', () => {
  for (const tpl of TEMPLATES.filter((t) => !t.addon)) {
    for (const catalog of [CATALOG, undefined]) {
      const p = buildProgram({ templateId: tpl.id, now: NOW, catalog });
      for (const day of p.days) {
        const m = estimateMinutes(day, { catalog });
        assert.ok(m >= 35 && m <= 75, `${tpl.id}/${day.key}: ${m} min`);
        assert.equal(estimateMinutes(day, { catalog, finisher: false }), m - finisherMinutes(day.finisher));
      }
    }
  }
  assert.equal(finisherMinutes(undefined), 0);
  assert.equal(finisherMinutes({ en: 'Finisher · 12 min zone 2', ru: '' }), 12);
  assert.equal(finisherMinutes({ en: 'Easy cool-down', ru: '' }), RULES.minutes.finisherDefaultMin);
});

test('weekly volume of the owner program: inside the recomp band, priority muscles at or above the target', () => {
  const p = buildProgram({ now: NOW, catalog: CATALOG });
  const band = weeklySetsTarget('recomp');
  // fixture muscles and the merged catalog (fractional sets: direct 1, synergist 0.5)
  for (const lookup of [CATALOG, undefined]) {
    const w = weeklySets(p, lookup);
    // shoulders may pass the band by one set: their count is mostly half-sets from presses and rows, which train the
    // front and rear of the shoulder; the side has only the lateral raise, and one set a week is too little for it
    for (const [g, v] of Object.entries(w)) assert.ok(v <= band.max + (g === 'shoulders' ? 1 : 0), `${g}: ${v} sets/week, the band ends at ${band.max}`);
    for (const g of ['chest', 'back']) assert.ok(w[g] >= band.start, `${g}: ${w[g]}`);
    // arms: mostly indirect work from the presses and pulls, which went from 3 to 2 sets for the band's sake
    assert.ok(w.biceps >= 8 && w.triceps >= 8, `arms: ${w.biceps} / ${w.triceps}`);
  }
  const w = weeklySets(p);
  assert.ok(w.chest >= band.target && w.back >= band.target, `priority muscles: chest ${w.chest}, back ${w.back}`);
  assert.equal(p.days.reduce((n, d) => n + d.slots.reduce((k, x) => k + x.sets, 0), 0), 47);
});

test('every goal × days program the builder offers stays inside its own volume band', () => {
  const sum = (/** @type {{ sets: number }[]} */ slots) => slots.reduce((n, x) => n + x.sets, 0);
  for (const goal of GOAL_IDS) {
    const mode = GOAL_MODES[goal];
    const band = mode.setsPerMuscleWeek;
    for (const daysPerWeek of [2, 3, 4]) {
      for (const p of [buildProgram({ goal, daysPerWeek, now: NOW }), convertProgram(buildProgram({ daysPerWeek, now: NOW }), goal, NOW)]) {
        const at = `${goal} × ${daysPerWeek} days`;
        const slots = p.days.flatMap((d) => d.slots);
        const w = weeklySets(p);
        // the owner's mandatory chest lifts are never trimmed away, and nobody gets legs unasked
        for (const id of ['machine-chest-press', 'pec-deck']) assert.ok(slots.some((x) => x.exerciseId === id && x.sets >= 2), `${at}: ${id}`);
        assert.ok(!p.days.some((d) => d.key === 'L') && (w.quads ?? 0) < 3 && (w.hamstrings ?? 0) < 3, `${at}: no legs`);
        // no 3–6-rep slot in a superset, under any goal
        for (const x of slots) assert.ok(!(x.superset && x.repRange[1] <= 6), `${at}: ${x.slotId} ${x.repRange} is supersetted`);
        for (const d of p.days) {
          const groups = new Map();
          for (const x of d.slots) if (x.superset) groups.set(x.superset, (groups.get(x.superset) ?? 0) + 1);
          for (const [id, n] of groups) assert.equal(n, 2, `${at}: superset ${id} on day ${d.key} has ${n} member(s)`);
        }
        if (goal === 'strength') {
          // the band counts direct sets per main lift (the unit says so): 4 → 12 a week, 2–4 sets a session; accessories
          // at most 10 direct sets per muscle; and no session beyond 75 min
          assert.match(band.unit ?? '', /direct sets per main lift/);
          const role = (/** @type {any} */ x) => slotRole(p, x);
          const main = new Map();
          for (const x of slots.filter((y) => role(y) === 'primary')) {
            assert.ok(x.sets >= 2 && x.sets <= 4, `${at}: ${x.slotId} ${x.sets} sets`);
            main.set(x.exerciseId, (main.get(x.exerciseId) ?? 0) + x.sets);
          }
          for (const [id, n] of main) assert.ok(n >= band.start && n <= band.max, `${at}: ${id} ${n} direct sets a week`);
          /** @type {Record<string, number>} */
          const accessory = {};
          for (const x of slots.filter((y) => role(y) !== 'primary')) {
            for (const [g, weight] of Object.entries(groupWeights(x.exerciseId))) if (weight === 1) accessory[g] = (accessory[g] ?? 0) + x.sets;
          }
          for (const [g, n] of Object.entries(accessory)) assert.ok(n <= 10, `${at}: ${n} accessory sets for ${g}`);
          for (const d of p.days) assert.ok(estimateMinutes(d) <= 75, `${at}: day ${d.key} takes ${estimateMinutes(d)} min`);
          // "fewer sets" than the same days of muscle growth, and A1 is not 5 × 3–6
          assert.ok(sum(slots) <= sum(buildProgram({ goal: 'hypertrophy', daysPerWeek, now: NOW }).days.flatMap((d) => d.slots)), `${at}: ${sum(slots)} sets a week`);
        } else {
          // fractional sets per muscle (direct 1, synergist 0.5): nothing above the band, chest and back inside it
          for (const [g, v] of Object.entries(w)) assert.ok(v <= band.max + (g === 'shoulders' && goal === 'recomp' ? 1 : 0), `${at}: ${g} ${v} sets/week, the band ends at ${band.max}`);
          for (const g of ['chest', 'back']) assert.ok(w[g] >= band.start, `${at}: ${g} ${w[g]} sets/week, the band starts at ${band.start}`);
        }
      }
    }
  }
});
