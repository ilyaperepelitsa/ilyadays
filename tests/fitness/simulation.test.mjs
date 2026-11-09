// Stream 03 — seeded end-to-end simulation of the training engine (src/lib/fitness/templates.mjs, session.mjs,
// progression.mjs), driven the way the tracker drives it: buildProgram (owner default: recomp, 3 days, A/B/C, no
// legs) → nextDayKey → planSession → logged sets → finish or auto-close → applySession → the next workout 2–3 days
// later. Deterministic: mulberry32 seeds and a fixed calendar from Tue 2026-11-10 10:00 Istanbul (07:00 UTC); no
// Date.now, no Math.random. The calendar draws from the run's seed, each slot of each workout from its own stream
// (seed, workout, slot): an engine change that alters one exercise's sets (an extra rep, a longer test ramp) leaves the
// calendar and every other exercise's draws as they were, so runs before and after a change compare like for like.
//
// The lifter (80 kg, untrained) has a hidden true strength per exercise that grows with diminishing returns
// (responder ≈ +1.5 %/week at first, average ≈ +1 %, stalled: flat after week 6), a ±4 % daily form and ≈ 1 %
// fatigue per working set. He stops every set at the planned RIR, capped at the planned reps (now and then a first
// set at the top of the range runs on when it feels easy), and logs the true reserve ±1 rep on the tracker's
// 0 1 2 3 4+ chips ("4+" logs 4; no RIR for holds and carries). Test sessions (first time, a substitute, ≥ 28 days off) follow the plan's note: one
// increment per set at the planned reps until a set leaves 2–3 in reserve, then the remaining sets. Workouts are
// skipped at random, late slots dropped now and then, now and then only the first working set of a slot is logged
// (rule 4 of master plan §16: an incomplete log holds), a few sessions left open (auto-closed after 6 h), and there
// is one 3-week holiday in the middle. In the 52-week runs the owner holds the weights of A1, A2 and A4 for 3 weeks
// from week 30 (ExerciseState.holdUntil). Besides the owner's gym: a small gym without a Pallof station or carry
// implements (pure bodyweight holds), and a new machine first used in a deload week. The stalled lifter, flat right at
// a coarse step, is what master plan §16 rule 5 (plateau memory, ExerciseState.plateau) is for: after a deload the step
// back to the load that failed waits for 2 sessions in a row at the top whose sets carry it (3 after the second deload,
// with two more reps in hand), so one good day (± 4 % form) no longer starts a fail → deload → retry cycle; 20 more
// stalled seeds check that across lifters, not just on one. FITNESS_SIM_REPORT=1 prints the trajectories.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, buildProgram, slotParams } from '../../src/lib/fitness/templates.mjs';
import { DEFAULT_CATALOG, applySession, nextDayKey, planSession } from '../../src/lib/fitness/session.mjs';
import {
  deloadSets, e1rmFactor, holdActive, holdDay, incrementFor, isAssisted, isCompound, maxStepFraction, pctOf1rm,
  repCeiling, roundLoad, unitOf,
} from '../../src/lib/fitness/progression.mjs';
import { setHold } from '../../src/lib/fitness/program-edit.mjs';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const ISTANBUL = 3 * HOUR; // Europe/Istanbul is UTC+3 all year (no DST since 2016)
const START = Date.parse('2026-11-10T07:00:00.000Z'); // Tuesday 10:00 in Istanbul: the first workout
const CREATED = START - 2 * DAY; // the program is built on the Sunday before
const BODYWEIGHT = 80;
const FORM = 0.04; // daily form ±4 %
const FATIGUE = 0.01; // capacity lost per working set already done on the exercise
const SKIP = 0.08; // a planned workout does not happen
const DROP = 0.03; // a late slot (the 4th onwards) is left out
const CUT = 0.03; // only the first working set of a slot is logged (the rest forgotten or skipped)
const RIR_MAX = 4; // the tracker's chips: 0 1 2 3 4+ ("4+" logs 4)
const HOLD = { week: 30, weeks: 3, slots: ['A1', 'A2', 'A4'] }; // the owner holds these slots' weights (52-week runs)
const OPEN = 0.05; // the session is never ended: it auto-closes after 6 h
const TEST_RAMP_MAX = 8; // ramp sets at most in a test session
const REPORT = Boolean(process.env.FITNESS_SIM_REPORT);

const iso = (ms) => new Date(ms).toISOString();
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** mulberry32: a tiny seeded PRNG, uniform in [0, 1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a: seeds each exercise's hidden strength independently of the order the exercises are met. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** True strength grows by `rate` per trained week at first, flattening with time constant `tau` weeks. */
const PROFILES = {
  responder: { rate: 0.015, tau: 40, stallWeek: Infinity, overshoot: 0.25 },
  average: { rate: 0.01, tau: 35, stallWeek: Infinity, overshoot: 0.1 },
  stalled: { rate: 0.01, tau: 35, stallWeek: 6, overshoot: 0.05 },
};

/** No Pallof station and no carry implements: B7 → side plank, C7 → dead hang (pure bodyweight holds, in seconds). */
const SMALL_GYM = {
  id: 'gym-small', name: 'Small gym', available: [], preferred: {}, updatedAt: iso(CREATED),
  missing: ['pallof-press', 'single-arm-cable-row', 'bird-dog', 'cable-woodchop', 'farmers-carry', 'suitcase-carry', 'plate-pinch'],
};

/** The gym gets a converging chest press and the owner prefers it for A1 (first used in the week-12 deload week). */
const SWAP_GYM = { id: 'gym-main', name: 'Main gym', available: [], missing: [], preferred: { A1: 'converging-chest-press' }, updatedAt: iso(CREATED) };

/* ------------------------------------------------------------------ exercise facts */

function exerciseOf(id) {
  const ex = DEFAULT_CATALOG.exerciseById(id);
  assert.ok(ex, `${id} is in the catalog`);
  return ex;
}
/** The load the muscles move: assisted = bodyweight − assistance, bodyweight = bodyweight + added load. */
const effective = (ex, kg) => (isAssisted(ex) ? BODYWEIGHT - kg : ex.equipment === 'bodyweight' ? BODYWEIGHT + kg : kg);
/** `a` is harder than `b` (assistance: less is harder). */
const harder = (ex, a, b) => effective(ex, a) > effective(ex, b) + 1e-9;
const onGrid = (kg, inc) => (inc > 0 ? Math.abs(kg / inc - Math.round(kg / inc)) < 1e-6 : kg === 0);
const unitStep = (ex) => RULES.unitStep[unitOf(ex)];
/** The most common load of a set list (ties → the harder one), as the engine reads a session. */
function modeLoad(ex, sets) {
  const n = new Map();
  for (const s of sets) n.set(s.kg, (n.get(s.kg) ?? 0) + 1);
  let best = sets[0].kg;
  for (const [kg, c] of n) if (c > (n.get(best) ?? 0) || (c === n.get(best) && harder(ex, kg, best))) best = kg;
  return best;
}

/* ------------------------------------------------------------------ the hidden lifter */

/**
 * Starting capacity per exercise: e1RM in effective kg for rep work (1.0–1.3 × the Strength Level beginner 1RM the
 * catalog's start loads are seeded from), seconds to failure for holds, kg per hand carried 30 m to failure for
 * carries.
 */
function makeLifter(profile, seed, holiday) {
  const p = PROFILES[profile];
  const start = (ex) => {
    const j = 1 + 0.3 * mulberry32(seed ^ hash(ex.id))();
    const unit = unitOf(ex);
    if (unit === 'seconds') return 40 * j;
    if (unit === 'meters') return 26 * j;
    if (isAssisted(ex)) return (BODYWEIGHT - (ex.startLoad?.kg ?? 40)) * (1 + 10 / 30) * j; // the catalog's start assistance ≈ 10 reps to failure
    if (ex.equipment === 'bodyweight') return BODYWEIGHT * (1 + 14 / 30) * j; // ≈ 14 reps at bodyweight
    return ((ex.startLoad?.kg ?? 20) / 0.6) * j;
  };
  /** weeks trained by `t` (the clock stops during the holiday) */
  const trained = (t) => (t - START - clamp(t - holiday.start, 0, holiday.end - holiday.start)) / (7 * DAY);
  /** true capacity at `t`, before today's form and fatigue */
  const capacity = (ex, t) => {
    const w = Math.min(Math.max(0, trained(t)), p.stallWeek);
    const gain = p.rate * p.tau * (1 - Math.exp(-w / p.tau));
    const back = t - holiday.end;
    const detrained = back >= 0 && back < 21 * DAY ? 0.02 * (1 - back / (21 * DAY)) : 0; // −2 % after the holiday, regained in 3 weeks
    return start(ex) * Math.exp(unitOf(ex) === 'seconds' ? 2 * gain : gain) * (1 - detrained);
  };
  return { start, capacity, p };
}

/** What the lifter can do at `kg` with capacity `cap`: reps to failure (Epley's curve; the engine blends Epley and Brzycki), seconds or metres. */
function maxUnits(ex, kg, cap) {
  const unit = unitOf(ex);
  if (unit === 'seconds') return cap;
  if (unit === 'meters') return 30 * (cap / Math.max(kg, 1)) ** 3;
  const eff = effective(ex, kg);
  return eff > 0 ? Math.max(0, 30 * (cap / eff - 1)) : 60;
}

/* ------------------------------------------------------------------ the simulation */

/** One run: `gym` for the whole run (null = everything available), `swap` = the gym from the week-12 deload week on. */
function simulate({ name, profile, weeks, seed, gym: firstGym = null, swap = null, plateauMemory = true }) {
  const rng = mulberry32(seed);
  let gym = firstGym;
  const end = START + weeks * 7 * DAY;
  const from = START + Math.round((weeks / 2 - 1.5) * 7) * DAY;
  const holiday = { start: from, end: from + 21 * DAY };
  const lifter = makeLifter(profile, seed, holiday);
  const program = buildProgram({ goal: 'recomp', daysPerWeek: 3, now: iso(CREATED), id: `sim-${name}` });
  const settings = { goal: 'recomp', daysPerWeek: 3, bodyweightKg: BODYWEIGHT, activeGymId: gym?.id ?? null, unit: 'kg', restTimer: true, autoCloseHours: 6, updatedAt: iso(CREATED) };
  // the documented calendar: blockWeeks accumulation weeks from program.createdAt, then one deload week
  const deloadDue = (t) => Math.floor((t - Date.parse(program.createdAt)) / (7 * DAY)) % (program.deloadEveryWeeks + 1) === program.deloadEveryWeeks;
  let states = {};
  const sessions = [];
  const plans = [];
  const entries = [];
  const sim = { name, profile, weeks, gym, program, holiday, lifter, sessions, plans, entries, keys: [], skipped: 0, notIdempotent: [], swappedAt: 0, holdSetAt: 0, holdUntil: null, holdIds: [] };

  /** A workout time on the Istanbul calendar day of `ms`: mornings 07–10 h or evenings 18–21 h local. */
  const workoutTime = (ms) => {
    const midnight = Math.floor((ms + ISTANBUL) / DAY) * DAY - ISTANBUL;
    const hour = rng() < 0.5 ? 7 + Math.floor(rng() * 4) : 18 + Math.floor(rng() * 4);
    return midnight + hour * HOUR + Math.floor(rng() * 4) * 15 * 60_000;
  };

  const runSession = (now) => {
    const dayKey = nextDayKey(program, sessions, iso(now));
    sim.keys.push(dayKey);
    if (swap && !sim.swappedAt && dayKey === 'A' && deloadDue(now) && now >= START + 10 * 7 * DAY) {
      gym = swap;
      sim.swappedAt = now;
    }
    if (weeks >= 52 && !sim.holdSetAt && now >= START + HOLD.week * 7 * DAY) {
      // the owner holds three weights for 3 weeks (the program editor's hold chips → program-edit setHold)
      sim.holdIds = HOLD.slots.map((slotId) => entries.findLast((e) => e.pe.slotId === slotId)?.pe.exerciseId).filter((id) => id && states[id]);
      for (const id of sim.holdIds) states = { ...states, [id]: setHold(states[id], HOLD.weeks, iso(now)) };
      sim.holdSetAt = now;
      sim.holdUntil = states[sim.holdIds[0]]?.holdUntil ?? null;
    }
    const plan = planSession({ program, dayKey, states, gym, settings, now: iso(now) });
    const day = program.days.find((d) => d.key === dayKey);
    assert.ok(day, `${name}: day ${dayKey}`);
    const sessionId = `${name}-s${sessions.length + 1}`;
    const settling = now >= holiday.end && now < holiday.end + 21 * DAY; // no drops right after the holiday
    const deload = deloadDue(now);
    const logged = [];
    const done = [];
    let clock = now + 5 * 60_000; // the general warm-up
    plan.exercises.forEach((pe, i) => {
      // this slot's own stream (see the header): the day's form, drops, cuts, overshoots and logged RIR
      const rng = mulberry32((seed ^ hash(`${sessions.length}/${pe.slotId}`)) >>> 0);
      const ex = exerciseOf(pe.exerciseId);
      const slot = day.slots.find((s) => s.slotId === pe.slotId);
      assert.ok(slot, `${name}: slot ${pe.slotId}`);
      const base = slotParams(program, slot);
      const params = unitOf(ex) !== unitOf(exerciseOf(slot.exerciseId)) ? { ...base, repRange: [ex.repRange[0], ex.repRange[1]] } : base;
      const before = states[pe.exerciseId] ?? null;
      const daysSince = before?.lastAt ? (now - Date.parse(before.lastAt)) / DAY : null;
      const test = !before || before.sessions === 0 || (daysSince ?? 0) >= RULES.gap.longFromDays;
      // slotState: the slot exercise's memory, which a substitute is seeded from
      const slotState = pe.exerciseId !== slot.exerciseId ? states[slot.exerciseId] ?? null : null;
      const record = { n: sessions.length, now, dayKey, pe, ex, slot, params, gym, before, slotState, daysSince, test, deload, dropped: i >= 3 && !settling && rng() < DROP, cut: false };
      plans.push(record);
      if (record.dropped) return;
      // now and then only the first working set gets logged (not in a test session: the ramp is the test)
      record.cut = !test && !deload && !settling && rng() < CUT;

      const unit = unitOf(ex);
      const u = unitStep(ex);
      const [lo, hi] = params.repRange;
      const inc = incrementFor(ex, gym);
      const work = pe.sets.filter((s) => s.kind === 'working');
      const R = work[0].rir ?? params.rir;
      const today = lifter.capacity(ex, now) * (1 + (rng() * 2 - 1) * FORM);
      let index = 0;
      let tired = 0;
      const mine = [];
      const log = (kind, planned, kg, reps, rir, restSec) => {
        clock += 40_000;
        const doneAt = iso(clock);
        mine.push({ id: `${sessionId}-${pe.slotId}-${index}`, sessionId, slotId: pe.slotId, exerciseId: pe.exerciseId, setIndex: index, kind, plannedKg: planned.weightKg, plannedReps: planned.reps, kg, reps, rir, doneAt, updatedAt: doneAt });
        index += 1;
        clock += restSec * 1000;
      };
      for (const w of pe.sets.filter((s) => s.kind === 'warmup')) log('warmup', w, w.weightKg, w.reps, null, 60);
      const cap = (kg) => maxUnits(ex, kg, today * (1 - FATIGUE * tired));
      // stop with `rir` in reserve, at most `target`
      const stop = (c, target, rir) => Math.max(0, Math.min(target, Math.floor((c - rir * u) / u + 1e-9) * u));
      const rirOf = (c, reps) => (unit === 'reps' ? clamp(Math.round(c - reps + (rng() * 2 - 1)), 0, RIR_MAX) : null);
      const set = (kg, target, overshoot = false) => {
        const c = cap(kg);
        let reps = stop(c, target, R);
        if (overshoot) {
          const more = stop(c, target + 3 * u, R + 1);
          if (more >= target + 2 * u) reps = more;
        }
        log('working', work[0], kg, reps, rirOf(c, reps), pe.restSec);
        tired += 1;
      };
      if (test && inc > 0) {
        // the note's test protocol: one step per set at the planned reps until a set leaves 2–3 in reserve
        const reps = work[0].reps;
        const step = (kg) => (isAssisted(ex) ? kg - inc : kg + inc);
        let kg = work[0].weightKg;
        let ramp = 0;
        while (ramp < TEST_RAMP_MAX && cap(kg) - reps > (R + 1) * u && step(kg) >= 0 && cap(step(kg)) - reps >= (R - 1) * u) {
          set(kg, reps);
          kg = step(kg);
          ramp += 1;
        }
        for (let k = Math.max(1, work.length - ramp); k > 0; k--) set(kg, reps);
      } else if (test) {
        // bodyweight: stop with 2–3 left, at most the top; holds: the bottom first, then the top if 10+ s were left
        const fresh = cap(0);
        work.forEach((w, k) => {
          const c = cap(w.weightKg);
          const reps = unit === 'seconds' && (k === 0 || fresh - lo < 10) ? stop(c, lo, 0) : stop(c, hi, R);
          log('working', w, w.weightKg, reps, rirOf(c, reps), pe.restSec);
          tired += 1;
        });
      } else {
        (record.cut ? work.slice(0, 1) : work).forEach((w, k) => set(w.weightKg, w.reps, k === 0 && w.reps >= hi && rng() < lifter.p.overshoot));
      }
      clock += 60_000;
      logged.push(...mine);
      done.push({ record, sets: mine.filter((s) => s.kind === 'working') });
    });

    const endMs = clock + 12 * 60_000; // the finisher
    const open = sessions.length === 4 || rng() < OPEN; // the fifth session is always left open
    const session = {
      id: sessionId, programId: program.id, dayKey, gymId: gym?.id ?? null, startedAt: iso(now), endedAt: open ? null : iso(endMs),
      status: open ? 'active' : 'finished', bodyweightKg: BODYWEIGHT, updatedAt: iso(open ? now : endMs),
    };
    sessions.push(session);
    // the tracker applies a session when it is ended, or when it auto-closes 6 h after the start
    const appliedAt = open ? now + 6 * HOUR : endMs;
    const r = applySession({ program, session, sets: logged, states, now: iso(appliedAt), settings, gym });
    const again = applySession({ program, session, sets: logged, states: r.states, now: iso(appliedAt + HOUR), settings, gym });
    if (again.changed.length) sim.notIdempotent.push(sessionId);
    for (const { record, sets } of done) {
      const o = r.outcomes.find((x) => x.slotId === record.pe.slotId && x.exerciseId === record.pe.exerciseId);
      entries.push({ ...record, sets, outcome: o?.outcome, note: o?.note, after: r.states[record.pe.exerciseId], used: modeLoad(record.ex, sets) });
    }
    states = plateauMemory ? r.states : Object.fromEntries(Object.entries(r.states).map(([id, st]) => [id, { ...st, plateau: null }]));
  };

  let t = START;
  while (t < end) {
    if (t >= holiday.start && t < holiday.end) {
      t = workoutTime(holiday.end + DAY);
      continue;
    }
    const settling = t >= holiday.end && t < holiday.end + 21 * DAY; // no skips right after the holiday
    if (t > START && !settling && (sessions.length === 3 && !sim.skipped ? true : rng() < SKIP)) {
      sim.skipped += 1;
      t = workoutTime(t + DAY);
      continue;
    }
    runSession(t);
    t = workoutTime(t + (rng() < 2 / 3 ? 2 : 3) * DAY);
  }
  return sim;
}

/* ------------------------------------------------------------------ helpers for the checks */

const working = (pe) => pe.sets.filter((s) => s.kind === 'working');
const warmups = (pe) => pe.sets.filter((s) => s.kind === 'warmup');
const where = (sim, r) => `${sim.name} ${iso(r.now).slice(0, 16)} ${r.dayKey}/${r.pe.slotId} ${r.pe.exerciseId}`;
/** The smallest load step of a record's exercise at the gym it was done at. */
const incOf = (r) => incrementFor(r.ex, r.gym);
/** ≥ 14 days since the exercise was last done. */
const gapped = (r) => (r.daysSince ?? 0) >= RULES.gap.keepBelowDays;
/** A deload-week session the rules hold (no evaluation): not back from a break, not a first (test) session. */
const held = (e) => e.deload && !gapped(e) && Boolean(e.before?.sessions);
/** A calibration session (documented): the first time on the exercise, or back from a ≥ 14-day break. */
const calibrating = (e) => !e.before || e.before.sessions === 0 || gapped(e);
/** When an entry's last working set was done (the engine judges a hold against it); the session start for plans. */
const lastSet = (e) => Math.max(e.now, ...(e.sets ?? []).map((s) => Date.parse(s.doneAt)));
/** Entries per exercise, in time order. */
function byExercise(list) {
  const m = new Map();
  for (const e of list) {
    if (!m.has(e.pe.exerciseId)) m.set(e.pe.exerciseId, []);
    m.get(e.pe.exerciseId).push(e);
  }
  return m;
}

/**
 * The documented plan after a break (master plan §16 rule 1): −5 → −10 % from 14 days, −10 → −15 % from 28 to 90 days,
 * rounded to the NEAREST step; a step too coarse for it (no cut, or more than gapCut.maxMultiple × the intended %)
 * keeps the load and plans gapCut.repsMinus steps fewer reps instead (never below the bottom); ≥ 28 days restarts at
 * the bottom of the range. Returns the intended % too.
 */
function gapPlan(ex, before, days, gym) {
  const g = RULES.gap;
  const long = days >= g.longFromDays;
  const t = long ? Math.min(1, (days - g.longFromDays) / (g.longFullAtDays - g.longFromDays)) : (days - g.keepBelowDays) / (g.longFromDays - g.keepBelowDays);
  const [a, b] = long ? g.longPct : g.shortPct;
  const pct = Math.round((a + (b - a) * t) * 10) / 10;
  const kg = before.workingKg;
  let next = isAssisted(ex)
    ? Math.min(BODYWEIGHT, roundLoad(BODYWEIGHT - (BODYWEIGHT - kg) * (1 - pct / 100), ex, gym, 'nearest'))
    : roundLoad(kg * (1 - pct / 100), ex, gym, 'nearest');
  if (harder(ex, next, kg)) next = kg;
  const cut = cutOf(ex, kg, next);
  const coarse = !(cut > 1e-9) || cut > (RULES.gapCut.maxMultiple * pct) / 100 + 1e-9;
  const lo = before.repRange[0];
  const reps = long ? lo : coarse ? Math.max(lo, before.targetReps - RULES.gapCut.repsMinus * unitStep(ex)) : before.targetReps;
  return { pct, kg: coarse ? kg : next, reps };
}
/** The cut from `from` to `to` kg as a fraction of the effective load (assistance: more assistance = a cut). */
const cutOf = (ex, from, to) => {
  const e = effective(ex, from);
  return e > 0 ? (e - effective(ex, to)) / e : 0;
};

/* ------------------------------------------------------------------ the checks */

function checkRotation(sim) {
  const order = sim.program.days.map((d) => d.key);
  assert.deepEqual(order, ['A', 'B', 'C']);
  sim.keys.forEach((k, i) => assert.equal(k, order[i % order.length], `${sim.name}: workout ${i + 1} is ${k}`));
  assert.ok(sim.skipped > 0, `${sim.name}: no workout was skipped`);
  assert.ok(sim.sessions.some((s) => s.status === 'active'), `${sim.name}: no session was left open`);
}

function checkLoads(sim) {
  const limit = (ex) => 2.5 * sim.lifter.start(ex);
  const sane = (r, kg, what) => {
    const at = `${where(sim, r)}: ${what} ${kg} kg`;
    const inc = incOf(r);
    assert.ok(Number.isFinite(kg) && kg >= 0, at);
    assert.ok(onGrid(kg, inc), `${at} is off the ${inc} kg grid`);
    if (unitOf(r.ex) === 'meters') assert.ok(kg <= limit(r.ex), `${at} per hand > 2.5 × the starting capacity`);
    else if (unitOf(r.ex) === 'reps') {
      if (isAssisted(r.ex)) assert.ok(kg <= BODYWEIGHT, `${at}: more assistance than bodyweight`);
      assert.ok(effective(r.ex, kg) <= limit(r.ex), `${at} > 2.5 × the starting e1RM ${limit(r.ex) / 2.5}`);
    }
  };
  for (const r of sim.plans) {
    for (const s of r.pe.sets) {
      sane(r, s.weightKg, `planned ${s.kind}`);
      assert.ok(Number.isInteger(s.reps) && s.reps >= 1, `${where(sim, r)}: planned reps ${s.reps}`);
    }
  }
  for (const e of sim.entries) {
    const s = e.after;
    sane(e, s.workingKg, 'next working load');
    const [lo, hi] = e.params.repRange;
    // rep work may climb past the top while the next step is too big (§16 rule 2): up to 15 (compounds) or 20 reps
    assert.ok(s.targetReps >= lo && s.targetReps <= repCeiling(e.ex, hi), `${where(sim, e)}: target ${s.targetReps} outside ${lo}–${repCeiling(e.ex, hi)}`);
    assert.ok(Number.isFinite(s.e1rm) && s.e1rm >= 0, `${where(sim, e)}: e1RM ${s.e1rm}`);
    if (unitOf(e.ex) === 'reps') assert.ok(s.e1rm <= limit(e.ex), `${where(sim, e)}: e1RM ${s.e1rm} > 2.5 × the true one`);
  }
}

function checkPlans(sim) {
  for (const r of sim.plans) {
    const at = where(sim, r);
    const w = working(r.pe);
    const note = r.pe.note?.en ?? '';
    const u = unitStep(r.ex);
    const [lo] = r.params.repRange;
    // a test session (first time, a substitute, or ≥ 28 days off) says so
    assert.equal(/First time|counts as a test/.test(note), r.test, `${at}: test session ${r.test}, note "${note}"`);
    if (!r.before) {
      // the first session is a test, not a deload (like a break, it replaces one): every set, at the bottom of the
      // range — or, for a substitute seeded from the slot's exercise, at its target and 85 % of its load
      const seeded = r.slotState && unitOf(r.ex) === unitOf(exerciseOf(r.slot.exerciseId)) ? r.slotState : null;
      assert.deepEqual([w.length, w[0].reps, w[0].rir], [r.slot.sets, seeded ? clamp(seeded.targetReps, lo, r.params.repRange[1]) : lo, r.slot.rir], `${at}: first plan${r.deload ? ' in a deload week' : ''}`);
      if (seeded && seeded.targetReps === w[0].reps && seeded.rir === r.slot.rir && exerciseOf(r.slot.exerciseId).equipment === r.ex.equipment) {
        assert.equal(w[0].weightKg, roundLoad(RULES.substitution.base * seeded.workingKg, r.ex, r.gym, 'easier'), `${at}: substitute load from ${seeded.workingKg} kg`);
      }
      continue;
    }
    if (gapped(r)) {
      // the break is the deload: full sets, the documented tier, the bottom of the range after ≥ 28 days
      const g = gapPlan(r.ex, r.before, r.daysSince, r.gym);
      const off = `${at}: ${r.daysSince.toFixed(1)} days off from ${r.before.workingKg} kg × ${r.before.targetReps}`;
      // the break's sentence opens the note; a weight hold still ahead is said first (planSession puts it before the
      // other parts when no deload week line leads, and a break skips the deload week)
      const lead = holdActive(r.before, r.now) ? `Weight held until ${holdDay(r.before.holdUntil, 'en')}. ` : '';
      assert.ok(note.startsWith(lead) && /^\d+ days since/.test(note.slice(lead.length)), `${off}: note "${note}"`);
      assert.deepEqual([w[0].weightKg, w[0].reps], [g.kg, g.reps], off);
      assert.equal(w.length, r.slot.sets, `${at}: sets after a break`);
      // §16 rule 1: the cut applied is never more than twice the intended one, and never a heavier load
      const cut = cutOf(r.ex, r.before.workingKg, w[0].weightKg);
      assert.ok(cut >= -1e-9 && cut <= (RULES.gapCut.maxMultiple * g.pct) / 100 + 1e-9, `${off}: −${(100 * cut).toFixed(1)} % for −${g.pct} %`);
    } else {
      assert.doesNotMatch(note, /days since/, `${at}: ${r.daysSince.toFixed(1)} days off, note "${note}"`);
      assert.equal(w[0].weightKg, r.before.workingKg, `${at}: planned ${w[0].weightKg} kg, the memory says ${r.before.workingKg}`);
      assert.equal(w[0].reps, r.deload ? Math.max(u, r.before.targetReps - RULES.deload.repsMinus * u) : r.before.targetReps, `${at}: reps`);
      assert.equal(w.length, r.deload ? deloadSets(r.slot.sets) : r.slot.sets, `${at}: sets (deload week ${r.deload})`);
      assert.equal(w[0].rir, r.deload ? Math.min(5, r.slot.rir + RULES.deload.rirBonus) : r.slot.rir, `${at}: RIR`);
    }
    // a weight hold ahead is said in the plan (once: the engine's note may already name the date)
    if (holdActive(r.before, r.now)) {
      assert.match(note, /held until/, `${at}: a hold until ${r.before.holdUntil}, note "${note}"`);
      assert.equal(note.split('held until').length, 2, `${at}: the hold said twice: "${note}"`);
    } else assert.doesNotMatch(note, /held until/, `${at}: no hold, note "${note}"`);
  }
  // the holiday: the first session back of every exercise is reduced, the following ones are not
  const settled = sim.holiday.end + 21 * DAY;
  const ids = (f) => new Set(sim.entries.filter(f).map((e) => e.pe.exerciseId));
  const after = ids((e) => e.now >= sim.holiday.end);
  const known = [...ids((e) => e.now < sim.holiday.start)].filter((id) => after.has(id));
  assert.ok(known.length >= 15, `${sim.name}: ${known.length} exercises on both sides of the holiday`);
  for (const id of known) {
    const back = sim.entries.filter((e) => e.pe.exerciseId === id && e.now >= sim.holiday.end && e.now < settled);
    assert.ok(back.length >= 2, `${sim.name} ${id}: ${back.length} sessions in the 3 weeks after the holiday`);
    assert.ok(gapped(back[0]), `${sim.name} ${id}: the first session back is ${back[0].daysSince.toFixed(1)} days after the last`);
    assert.ok(!harder(back[0].ex, working(back[0].pe)[0].weightKg, back[0].before.workingKg), `${where(sim, back[0])}: heavier after the holiday`);
    assert.equal(back.filter(gapped).length, 1, `${sim.name} ${id}: reduced ${back.filter(gapped).length} times after the holiday`);
  }
}

function checkSteps(sim) {
  for (const list of byExercise(sim.entries).values()) {
    const up = list.map((e) => harder(e.ex, e.after.workingKg, e.used));
    list.forEach((e, k) => {
      const at = where(sim, e);
      if (e.outcome === 'failed') assert.ok(!up[k], `${at}: a failed session raised the load`);
      if ((e.outcome === 'failed' || e.outcome === 'deloaded') && up[k + 1] && up[k + 2]) assert.fail(`${at}: the load went up twice in a row right after a failed session`);
      if (held(e)) {
        assert.deepEqual([e.after.workingKg, e.after.targetReps, e.after.fails], [e.before.workingKg, e.before.targetReps, e.before.fails], `${at}: a deload week changed the targets`);
      }
      // a weight hold: no load increase before its date, test sessions included
      if (up[k] && holdActive(e.before, lastSet(e))) assert.fail(`${at}: the load went up during a hold until ${e.before.holdUntil}`);
      if (!up[k] || calibrating(e)) return;
      const ex = e.ex;
      const inc = incrementFor(ex, e.gym);
      const [lo, hi] = e.params.repRange;
      const R = e.params.rir;
      const top = Math.max(hi, e.before.targetReps);
      const base = effective(ex, e.used);
      const delta = Math.abs(e.after.workingKg - e.used);
      // double progression: more load only after every working set reached the top (or the widened target)
      assert.ok(e.sets.every((s) => s.kg === e.used && s.reps >= top && (s.rir == null || s.rir >= R - RULES.rirTolerance)), `${at}: load up without every set at ${top}`);
      // the documented maximum: one increment, or +doubleStepCapPct % (the big-jump cap)
      assert.ok(delta <= Math.max(inc, (base * RULES.doubleStepCapPct) / 100) + 1e-9, `${at}: +${delta} kg on ${base} kg is more than one ${inc} kg step and more than +${RULES.doubleStepCapPct} %`);
      // the capacity guard (§16 rule 2): by Epley the weakest set still allows the bottom of the range at the target RIR
      // at the new load — new ÷ old ≤ (30 + reps + RIR) ÷ (30 + bottom + target RIR), maxStepFraction with what was logged
      if (unitOf(ex) === 'reps') {
        const weakest = Math.min(...e.sets.filter((s) => s.kg === e.used).map((s) => s.reps + (s.rir ?? R)));
        const ratio = effective(ex, e.after.workingKg) / base;
        assert.ok(ratio <= (30 + weakest) / (30 + lo + R) + 1e-9, `${at}: +${(100 * (ratio - 1)).toFixed(1)} % with the weakest set at ${weakest} reps + RIR (range ${lo}–${hi} at RIR ${R})`);
      }
      // every planned working set was logged (§16 rule 4)
      assert.ok(e.sets.length >= working(e.pe).length, `${at}: load up after ${e.sets.length} of ${working(e.pe).length} sets`);
    });
  }
}

function checkFailures(sim) {
  const N = sim.program.progression.double.failsBeforeDeload;
  for (const [id, list] of byExercise(sim.entries)) {
    let failed = 0;
    let below = 0;
    let worst = 0;
    for (const e of list) {
      if (held(e)) continue; // deload weeks are not evaluated
      const at = where(sim, e);
      const [lo] = e.params.repRange;
      const miss = e.sets.some((s) => s.reps < lo);
      if (miss && !calibrating(e)) assert.ok(e.outcome === 'failed' || e.outcome === 'deloaded', `${at}: a set below ${lo} gave '${e.outcome}'`);
      if (!miss) assert.ok(e.outcome !== 'failed' && e.outcome !== 'deloaded', `${at}: '${e.outcome}' with every set in the range`);
      failed = e.outcome === 'failed' ? failed + 1 : 0;
      assert.ok(failed <= N - 1, `${at}: ${failed} failed sessions in a row without a deload (failsBeforeDeload ${N})`);
      if (e.outcome === 'deloaded') {
        assert.equal(e.before.fails, N - 1, `${at}: deloaded on miss ${e.before.fails + 1}, not ${N}`);
        const lightest = !isAssisted(e.ex) && e.used <= incOf(e);
        assert.ok(harder(e.ex, e.used, e.after.workingKg) || lightest, `${at}: the deload kept ${e.used} → ${e.after.workingKg} kg`);
      }
      below = miss ? below + 1 : 0;
      worst = Math.max(worst, below);
    }
    assert.ok(worst <= 2 * N, `${sim.name} ${id}: ${worst} sessions in a row below the range`);
  }
}

function checkAssisted(sim) {
  const list = sim.entries.filter((e) => isAssisted(e.ex));
  assert.ok(list.length > 0, `${sim.name}: no assisted sessions`);
  for (const e of list) {
    const at = where(sim, e);
    const [lo, hi] = e.params.repRange;
    const to = e.after.workingKg;
    assert.ok(to >= 0, `${at}: assistance ${to}`);
    if (to < e.used) {
      const target = calibrating(e) ? lo : Math.max(hi, e.before.targetReps);
      const hit = e.sets.filter((s) => s.kg === e.used).every((s) => s.reps >= target && (s.rir == null || s.rir >= e.params.rir - RULES.rirTolerance));
      assert.ok(hit, `${at}: assistance ${e.used} → ${to} kg without hitting ${target} on every set`);
    }
    if (e.outcome === 'deloaded') assert.ok(to > e.used, `${at}: the deload must add assistance (${e.used} → ${to} kg)`);
    if (held(e)) assert.equal(to, e.before.workingKg, `${at}: assistance changed in a deload week`);
  }
  for (const r of sim.plans.filter((p) => isAssisted(p.ex))) {
    for (const s of r.pe.sets) assert.ok(s.weightKg >= 0 && s.weightKg <= BODYWEIGHT, `${where(sim, r)}: assistance ${s.weightKg}`);
    if (gapped(r)) assert.ok(working(r.pe)[0].weightKg >= r.before.workingKg, `${where(sim, r)}: a break must not take assistance off`);
  }
}

function checkHoldsAndCarries(sim) {
  const list = sim.entries.filter((e) => unitOf(e.ex) !== 'reps');
  assert.ok(list.length > 0, `${sim.name}: no holds or carries`);
  for (const [id, xs] of byExercise(list)) {
    const ex = xs[0].ex;
    const u = unitStep(ex);
    const [lo, hi] = xs[0].params.repRange;
    const inc = incOf(xs[0]);
    const pureHold = unitOf(ex) === 'seconds' && inc === 0;
    let longer = 0;
    for (const e of xs) {
      const at = where(sim, e);
      const s = e.after;
      assert.equal(s.e1rm, 0, `${at}: an e1RM for ${unitOf(ex)}`);
      assert.equal(s.targetReps % u, 0, `${at}: target ${s.targetReps}`);
      if (pureHold) {
        const loads = [...e.sets.map((x) => x.kg), ...e.pe.sets.map((x) => x.weightKg), s.workingKg];
        assert.ok(loads.every((kg) => kg === 0), `${at}: kg on a bodyweight hold (${loads.join(', ')})`);
        // (a log with sets left out holds first: rule 4)
        if (!calibrating(e) && e.sets.length >= working(e.pe).length && e.sets.every((x) => x.reps >= Math.max(hi, e.before.targetReps))) {
          assert.equal(e.outcome, 'held', `${at}: at the top of a hold`);
          assert.match(e.note.en, /harder variant/, `${at}: at the top of a hold`);
        }
      }
      if (harder(ex, s.workingKg, e.used)) {
        assert.ok(!pureHold, `${at}: a bodyweight hold got heavier`);
        assert.equal(s.targetReps, lo, `${at}: load and ${unitOf(ex)} went up together`);
        if (!calibrating(e)) {
          const top = Math.max(hi, e.before.targetReps);
          assert.ok(e.sets.every((x) => x.reps >= top), `${at}: load up before the top of ${lo}–${hi}`);
          // one step per hand; a bigger (capped) one only after a first set past the top by overshootReps
          if (e.sets[0].reps < top + e.params.overshootReps * u) assert.equal(s.workingKg - e.used, inc, `${at}: one step per hand`);
        }
      } else if (e.before && s.workingKg === e.used && s.targetReps > e.before.targetReps) longer += 1;
    }
    assert.ok(longer > 0, `${sim.name} ${id}: never went longer`);
  }
}

function checkWarmups(sim) {
  for (const r of sim.plans) {
    const at = where(sim, r);
    const ws = warmups(r.pe);
    const w = working(r.pe)[0];
    const ramps = isCompound(r.ex) && unitOf(r.ex) === 'reps' && r.ex.equipment !== 'bodyweight' && r.ex.equipment !== 'band';
    if (!ramps) assert.equal(ws.length, 0, `${at}: warm-ups for a non-compound, hold, carry or bodyweight exercise`);
    assert.ok(r.pe.sets.slice(0, ws.length).every((s) => s.kind === 'warmup'), `${at}: warm-ups first`);
    ws.forEach((s, i) => {
      assert.ok(harder(r.ex, w.weightKg, s.weightKg), `${at}: warm-up ${s.weightKg} kg is not lighter than ${w.weightKg} kg`);
      if (i > 0) assert.ok(harder(r.ex, s.weightKg, ws[i - 1].weightKg), `${at}: warm-ups ${ws.map((x) => x.weightKg).join(', ')} do not climb`);
    });
  }
}

function checkAsPlanned(sim) {
  assert.deepEqual(sim.notIdempotent, [], `${sim.name}: re-applying a session changed the memory`);
  for (const e of sim.entries) {
    if (held(e)) continue; // a deload week keeps the targets
    const plan = working(e.pe);
    const w = plan[0];
    const asPlanned = e.sets.length === plan.length && e.sets.every((s) => s.kg === w.weightKg && s.reps >= w.reps && (s.rir == null || s.rir >= e.params.rir - RULES.rirTolerance));
    if (!asPlanned) continue;
    // every set made at the planned load: + reps, + load, or a wider top first (documented double progression);
    // only an exercise with nothing to add (no load step, or no assistance left) stays at the top
    const [, hi] = e.params.repRange;
    const next = e.after;
    // … or the next step is too big even at the rep ceiling (flagged for a variant), or a hold keeps the weight, or
    // the next step is a load that ended in a deload and waits for more sessions at the top (rule 5, checkPlateau)
    const stuck = ((incOf(e) === 0 || (isAssisted(e.ex) && w.weightKg <= 0)) && w.reps >= hi)
      || (next.variant === 'smaller-steps' && w.reps >= repCeiling(e.ex, hi))
      || (holdActive(e.before, lastSet(e)) && w.reps >= Math.max(hi, e.before?.targetReps ?? hi))
      || (e.outcome === 'held' && PLATEAU_HOLD.test(e.note?.en ?? '') && w.reps >= hi);
    const more = harder(e.ex, next.workingKg, w.weightKg) || (next.workingKg === w.weightKg && next.targetReps > w.reps);
    assert.ok(more || (stuck && next.workingKg === w.weightKg && next.targetReps === w.reps), `${where(sim, e)}: done as planned (${w.weightKg} kg × ${w.reps}${gapped(e) ? `, ${e.daysSince.toFixed(1)} days off` : ''}) → next ${next.workingKg} kg × ${next.targetReps} (${e.outcome})`);
  }
}

/** §16 rule 4: an exercise with fewer working sets logged than planned holds (a set below the range is still a miss). */
function checkIncomplete(sim) {
  let n = 0;
  for (const e of sim.entries) {
    if (e.sets.length >= working(e.pe).length || held(e) || calibrating(e)) continue;
    n += 1;
    const at = `${where(sim, e)}: ${e.sets.length} of ${working(e.pe).length} sets`;
    const [lo] = e.params.repRange;
    if (e.sets.some((s) => s.reps < lo)) {
      assert.ok(e.outcome === 'failed' || e.outcome === 'deloaded', `${at}: a set below ${lo} gave '${e.outcome}'`);
      continue;
    }
    assert.equal(e.outcome, 'held', at);
    assert.deepEqual([e.after.workingKg, e.after.targetReps, e.after.fails], [e.before.workingKg, e.before.targetReps, e.before.fails], at);
    assert.match(e.note?.en ?? '', /^Only \d+ of \d+ working sets logged/, at);
  }
  if (sim.weeks >= 52) assert.ok(n > 0, `${sim.name}: no incomplete log`);
}

/** The owner's hold (52-week runs): no load increase and no target past the top before the date; then cleared. */
function checkHolds(sim) {
  if (sim.weeks < 52) return;
  assert.ok(sim.holdSetAt > 0 && sim.holdUntil, `${sim.name}: the hold was set`);
  const until = Date.parse(sim.holdUntil);
  assert.equal(until - sim.holdSetAt > 20 * DAY && until - sim.holdSetAt <= 22 * DAY, true, `${sim.name}: 3 weeks from ${iso(sim.holdSetAt)} → ${sim.holdUntil}`);
  assert.equal(sim.holdIds.length, HOLD.slots.length, `${sim.name}: held ${sim.holdIds.join(', ')}`);
  for (const id of sim.holdIds) {
    const xs = sim.entries.filter((e) => e.pe.exerciseId === id && e.now >= sim.holdSetAt);
    const during = xs.filter((e) => lastSet(e) < until);
    const afterIt = xs.filter((e) => lastSet(e) >= until);
    assert.ok(during.length >= 2 && afterIt.length > 0, `${sim.name} ${id}: ${during.length} sessions during the hold, ${afterIt.length} after`);
    for (const e of during) {
      const at = where(sim, e);
      const [, hi] = e.params.repRange;
      assert.ok(!harder(e.ex, e.after.workingKg, e.before.workingKg), `${at}: heavier during the hold (${e.before.workingKg} → ${e.after.workingKg})`);
      assert.ok(e.after.targetReps <= Math.max(hi, e.before.targetReps), `${at}: the target went past the top during the hold`);
      assert.equal(e.after.holdUntil, sim.holdUntil, `${at}: the hold was dropped early`);
    }
    assert.equal(afterIt[0].after.holdUntil, null, `${where(sim, afterIt[0])}: the hold was not cleared after its date`);
  }
}

/**
 * No fail → deload cycles. The simulation found the hammer curl stepping 8 → 10 kg per hand (+25 %), failing,
 * deloading and stepping again, over and over: a step too big for the range at any strength. The capacity guard and
 * the rep ceiling end that: in these runs the hammer curl is never deloaded twice from the same load (a stalled year
 * can still deload it twice from 10 kg: 20 of 400 random ones, plan 03). A lifter whose strength is flat
 * right at a coarse step still retried it on every good day (± 4 % form: before rule 5 the stalled run deloaded the
 * assisted pull-up 40 → 45 kg four times and the crunch 22.5 → 20 kg three times); plateau memory (rule 5) asks for
 * 2, then 3 sessions in a row at the top that carry it first, so in these runs no exercise of any profile is deloaded
 * from the same load more than twice a year (a retry later is normal training; across lifters a third stays rare,
 * see the 20 more stalled lifters below).
 */
function checkCycles(sim) {
  for (const [id, list] of byExercise(sim.entries)) {
    /** @type {Map<string, number[]>} */
    const seen = new Map();
    for (const e of list.filter((x) => x.outcome === 'deloaded')) {
      const key = `${e.used} → ${e.after.workingKg}`;
      seen.set(key, [...(seen.get(key) ?? []), e.now]);
    }
    for (const [key, when] of seen) {
      const at = `${sim.name} ${id}: deloaded ${key} kg ${when.length} times (${when.map((ms) => iso(ms).slice(0, 10)).join(', ')})`;
      if (id === 'hammer-curl') assert.equal(when.length, 1, at);
      else assert.ok(when.length <= 2, at);
    }
  }
}

/** The engine's note when a session at the top waits before a load that ended in a deload (rule 5). */
const PLATEAU_HOLD = /but the next step \(.+\) (ended in a deload last time|has ended in a deload \d+ times): keep /;
/** The engine's note when the step back to a load that ended in a deload twice is earned with reps first (rule 5). */
const PLATEAU_EARN = /but the next step \(.+\) has ended in a deload \d+ times: earn it with /;
/** The engine's note when a smaller step is taken instead, or a test session stops below that load (rule 5). */
const PLATEAU_BELOW = /Easier than .+ for now: it (ended in a deload last time|has ended in a deload \d+ times)/;

/**
 * Master plan §16 rule 5 (plateau memory), against a record of the run kept here: a reactive deload that lowers the
 * load remembers the load it came down from (times + 1 when it is the same load again); a complete session past that
 * load with no set below the range forgets it. The streak counts sessions in a row at the planned load with every set
 * at the top whose weakest set carries the remembered load by the capacity guard (Epley: the bottom of the range at
 * the target RIR there, RULES.plateau.spareReps more reps in hand after the second deload while reps can still rise);
 * a load change (a break's cut too), a session that does not count or a miss starts it over, an incomplete log
 * (rule 4) and a deload week leave it alone, and a test session (first time, back from a break) counts like any
 * other. Every step from below the remembered load — from the planned load in a test session, whose lighter sets are
 * its ramp — to it (or past it) comes after min(3, 1 + times) such sessions; a session that has to wait says so, and
 * the engine's ExerciseState.plateau equals the record.
 */
function checkPlateau(sim) {
  for (const list of byExercise(sim.entries).values()) {
    let memo = null;
    for (const e of list) {
      const at = where(sim, e);
      if (held(e)) {
        assert.deepEqual(e.after.plateau ?? null, e.before.plateau ?? null, `${at}: a deload week changed the plateau memory`);
        continue;
      }
      const ex = e.ex;
      const [lo, hi] = e.params.repRange;
      const R = e.params.rir;
      const plan = working(e.pe)[0];
      const test = calibrating(e);
      const below = e.sets.some((s) => s.reps < lo);
      const complete = e.sets.length >= working(e.pe).length;
      // the top the engine judges against: the planned target (past the top of the range too) at the planned load; the
      // top of the range after a test ramp, whose lighter sets are its warm-up
      const top = e.used === plan.weightKg ? Math.max(hi, plan.reps) : hi;
      const atUsed = e.sets.filter((s) => s.kg === e.used);
      const allTop = (test || e.sets.every((s) => s.kg === e.used))
        && atUsed.every((s) => s.reps >= top && (s.rir == null || s.rir >= R - RULES.rirTolerance));
      const note = e.note?.en ?? '';
      if (memo && gapped(e) && plan.weightKg !== e.before.workingKg) memo.streak = 0;
      if (memo && complete && !below && harder(ex, e.used, memo.kg)) memo = null;
      else if (memo) {
        const from = test ? plan.weightKg : e.used;
        /** from below the remembered load to it or past it */
        const back = (kg) => harder(ex, memo.kg, from) && !harder(ex, memo.kg, kg);
        const spare = memo.times >= 2 && top < repCeiling(ex, hi) && back(memo.kg) ? RULES.plateau.spareReps : 0;
        const weakest = Math.min(...atUsed.map((s) => s.reps + (s.rir ?? R)));
        const carries = unitOf(ex) !== 'reps' || !(effective(ex, e.used) > 0)
          || effective(ex, memo.kg) * (30 + lo + R + spare) <= effective(ex, e.used) * (30 + weakest) + 1e-9;
        const before = e.used === plan.weightKg ? memo.streak : 0;
        if (complete || below) memo.streak = allTop && complete && carries ? before + 1 : 0;
        const need = Math.min(3, 1 + memo.times);
        if (back(e.after.workingKg)) assert.ok(memo.streak >= need, `${at}: back to ${memo.kg} kg (deloaded from it ${memo.times}×) after ${memo.streak} sessions at the top, ${need} needed${test ? ' (a test session)' : ''}`);
        if (PLATEAU_HOLD.test(note) || PLATEAU_EARN.test(note) || PLATEAU_BELOW.test(note)) {
          assert.ok(note.includes(`${memo.kg} kg`) && harder(ex, memo.kg, e.after.workingKg), `${at}: "${note}" (${memo.kg} kg remembered)`);
          if (test && /^Test done/.test(note)) {
            // a test session stopped below it: its re-anchor, or a ramp that reached it
            assert.ok(PLATEAU_BELOW.test(note) && memo.streak < need, `${at}: "${note}" after ${memo.streak} of ${need} sessions at the top`);
          } else {
            assert.ok(complete && allTop, `${at}: "${note}" after a session short of the top`);
            if (PLATEAU_HOLD.test(note)) {
              assert.ok(carries && memo.streak < need, `${at}: "${note}" after ${memo.streak} of ${need} sessions at the top (carries ${carries})`);
              assert.deepEqual([e.outcome, e.after.workingKg, e.after.targetReps], ['held', e.used, top], `${at}: a wait at the top`);
              assert.equal(/smaller steps or add micro-plates/.test(note), memo.times >= 2, `${at}: "${note}" after ${memo.times} deloads`);
            } else if (PLATEAU_EARN.test(note)) {
              assert.ok(spare > 0 && !carries, `${at}: "${note}" (reps to spare asked: ${spare}, carried: ${carries})`);
              assert.ok(e.outcome === 'progressed' && e.after.workingKg === e.used && e.after.targetReps > top, `${at}: reps to earn the step`);
            } else {
              assert.ok(memo.streak < need || memo.times >= 2, `${at}: "${note}" after ${memo.streak} of ${need} sessions at the top`);
              assert.ok(e.outcome === 'progressed' && harder(ex, e.after.workingKg, e.used), `${at}: a smaller step`);
            }
          }
        }
        if (e.after.workingKg !== e.used) memo.streak = 0;
      }
      // a machine already at its lightest setting: the deload cannot lower the load, so there is no step back to wait for
      if (e.outcome === 'deloaded' && harder(ex, e.used, e.after.workingKg)) memo = { kg: e.used, times: memo && memo.kg === e.used ? memo.times + 1 : 1, streak: 0 };
      const p = e.after.plateau ?? null;
      assert.deepEqual(p && { kg: p.kg, times: p.times, streak: p.streak }, memo && { ...memo }, `${at}: the plateau memory (${e.outcome})`);
    }
  }
}

/** Load fraction for `total` reps to failure (the documented e1RM inverse ≤ 12 reps, the %1RM table above). */
const loadFraction = (total) => (total <= RULES.reliableTotalReps ? 1 / e1rmFactor(total) : pctOf1rm(total) / 100);

function checkTests(sim) {
  let n = 0;
  for (const e of sim.entries) {
    if (!e.test || unitOf(e.ex) !== 'reps' || incOf(e) === 0) continue;
    n += 1;
    const at = where(sim, e);
    const [lo, hi] = e.params.repRange;
    const R = e.params.rir;
    const X = e.used;
    const target = working(e.pe)[0].reps;
    const atX = e.sets.filter((s) => s.kg === X);
    const below = atX.some((s) => s.reps < lo);
    const made = atX.every((s) => s.reps >= target && (s.rir == null || s.rir >= R - RULES.rirTolerance));
    if (target >= hi || (!below && !made)) continue;
    // the documented calibration, in exact arithmetic: the best reliable e1RM of the session → the load for the
    // bottom of the range with one extra RIR, rounded the easier way; it raises a made test, lowers a missed one
    let best = 0;
    for (const s of e.sets) {
      const eff = effective(e.ex, s.kg);
      const total = s.reps + (s.rir ?? R);
      if (eff > 0 && s.reps >= 1 && total <= RULES.reliableTotalReps) best = Math.max(best, eff * e1rmFactor(total));
    }
    const load = best * loadFraction(lo + R + RULES.calibrationExtraRir);
    let implied = best > 0 ? roundLoad(isAssisted(e.ex) ? Math.max(0, BODYWEIGHT - load) : load, e.ex, e.gym, 'easier') : X;
    // rule 5: a test from below a load that ended in a deload (and below the top: it does not confirm) stops one step
    // below it, never below the planned load: its re-anchor, and a ramp that reached it in a session that keeps the memory
    const memo = e.before?.plateau;
    const planned = working(e.pe)[0].weightKg;
    const kept = memo && !(e.sets.length >= working(e.pe).length && !below && harder(e.ex, X, memo.kg));
    let reached = null;
    if (kept && harder(e.ex, memo.kg, planned)) {
      const under = roundLoad(isAssisted(e.ex) ? memo.kg + incOf(e) : memo.kg - incOf(e), e.ex, e.gym, 'easier');
      const floor = harder(e.ex, under, planned) ? under : planned;
      if (!harder(e.ex, memo.kg, implied)) implied = floor;
      if (!harder(e.ex, memo.kg, X)) reached = floor;
    }
    const weakest = Math.min(...atX.map((s) => s.reps + (s.rir ?? R)));
    const carries = effective(e.ex, implied) * (30 + lo + R) <= effective(e.ex, X) * (30 + weakest) + 1e-9;
    let expected = below ? (harder(e.ex, implied, X) ? X : implied) : harder(e.ex, implied, X) && carries ? implied : reached ?? X;
    const missed = e.sets.some((s) => s.reps < Math.max(lo, s.plannedReps || target) || (s.rir ?? R) < R - RULES.rirTolerance);
    const incomplete = e.sets.length < working(e.pe).length;
    if ((missed || incomplete) && harder(e.ex, expected, planned)) expected = planned;
    assert.equal(e.after.workingKg, expected, `${at}: test session ${e.sets.map((s) => `${s.kg}×${s.reps}@${s.rir}`).join(' ')} (e1RM ${best.toFixed(3)} → ${implied} kg) → next ${e.after.workingKg} kg (${e.outcome}${e.deload ? ', deload week' : ''})`);
    assert.doesNotMatch(e.note?.en ?? '', /^Deload week/, `${at}: a test session held as a deload week`);
  }
  assert.ok(n > 0, `${sim.name}: no test sessions`);
}

/* ------------------------------------------------------------------ coverage and reporting (FITNESS_SIM_REPORT=1) */

/** How often the run went through each engine path (keeps the checks above from passing vacuously). */
function coverage(sim) {
  const c = { firstInDeloadWeek: 0, loadUps: 0, overshootUps: 0, repJumps: 0, coarseUps: 0, widened: 0, pastTop: 0, flagged: 0, failed: 0, deloaded: 0, deloadWeekHolds: 0, gapShort: 0, gapLong: 0, gapRepsOnly: 0, testRamps: 0, asPlanned: 0, incomplete: 0, heldByHold: 0, assistOff: 0, assistOn: 0, longer: 0, holdTops: 0, plateauWaits: 0, plateauEarns: 0, plateauBelow: 0, plateauTests: 0, plateauBack: 0 };
  for (const e of sim.entries) {
    if (PLATEAU_HOLD.test(e.note?.en ?? '')) c.plateauWaits += 1;
    if (PLATEAU_EARN.test(e.note?.en ?? '')) c.plateauEarns += 1;
    if (PLATEAU_BELOW.test(e.note?.en ?? '')) c[/^Test done/.test(e.note?.en ?? '') ? 'plateauTests' : 'plateauBelow'] += 1;
    // a step from below the load a deload came down from back to it (the engine's memory before the session)
    const memo = e.before?.plateau;
    if (memo && !held(e) && harder(e.ex, memo.kg, e.used) && harder(e.ex, e.after.workingKg, e.used) && !harder(e.ex, memo.kg, e.after.workingKg)) c.plateauBack += 1;
    const [lo, hi] = e.params.repRange;
    const u = unitStep(e.ex);
    const R = e.params.rir;
    if (e.outcome === 'failed') c.failed += 1;
    if (e.outcome === 'deloaded') c.deloaded += 1;
    if (held(e)) c.deloadWeekHolds += 1;
    if (e.deload && !e.before) c.firstInDeloadWeek += 1;
    if (e.test && e.sets.some((s) => s.kg !== e.sets[0].kg)) c.testRamps += 1;
    if (isAssisted(e.ex) && e.after.workingKg < e.used) c.assistOff += 1;
    if (isAssisted(e.ex) && e.after.workingKg > e.used) c.assistOn += 1;
    if (unitOf(e.ex) !== 'reps' && e.before && e.after.workingKg === e.used && e.after.targetReps > e.before.targetReps) c.longer += 1;
    if (unitOf(e.ex) === 'seconds' && e.outcome === 'held' && /harder variant/.test(e.note?.en ?? '')) c.holdTops += 1;
    if (e.after.variant === 'smaller-steps' && e.before?.variant !== 'smaller-steps') c.flagged += 1;
    if (e.sets.length < working(e.pe).length && !held(e) && !calibrating(e)) c.incomplete += 1;
    if (holdActive(e.before, lastSet(e)) && e.outcome === 'held' && /held until/.test(e.note?.en ?? '')) c.heldByHold += 1;
    if (!held(e) && e.sets.length === working(e.pe).length && e.sets.every((s) => s.kg === working(e.pe)[0].weightKg && s.reps >= working(e.pe)[0].reps)) c.asPlanned += 1;
    if (!e.before || calibrating(e)) continue;
    const top = Math.max(hi, e.before.targetReps);
    if (e.after.workingKg === e.used && e.after.targetReps > hi && e.after.targetReps > e.before.targetReps && e.sets.every((s) => s.reps >= top)) c.widened += 1;
    if (e.after.targetReps > hi + RULES.maxWidenReps * u) c.pastTop += 1;
    // rule 3 below the top: reps in reserve beyond the target move the target by more than one rep
    if (unitOf(e.ex) === 'reps' && e.after.workingKg === e.used && e.before.targetReps < hi && e.after.targetReps - e.before.targetReps >= 2) c.repJumps += 1;
    if (!harder(e.ex, e.after.workingKg, e.used)) continue;
    c.loadUps += 1;
    const first = e.sets[0];
    if (first.reps >= top + e.params.overshootReps * u && (first.rir == null || first.rir >= R + 1)) c.overshootUps += 1;
    if (unitOf(e.ex) === 'reps' && Math.abs(e.after.workingKg - e.used) / effective(e.ex, e.used) > maxStepFraction(lo, hi, R) + 1e-9) c.coarseUps += 1;
  }
  for (const r of sim.plans) {
    if (!r.before || !gapped(r)) continue;
    c[r.daysSince >= RULES.gap.longFromDays ? 'gapLong' : 'gapShort'] += 1;
    if (/, \d+ fewer reps|s shorter|m shorter/.test(r.pe.note?.en ?? '')) c.gapRepsOnly += 1;
  }
  return c;
}

function report(sim) {
  const track = (id) => {
    const xs = sim.entries.filter((e) => e.pe.exerciseId === id);
    if (!xs.length) return null;
    const at = (weeks) => xs.filter((e) => e.now < START + weeks * 7 * DAY).at(-1)?.after.workingKg ?? null;
    return { planned: working(xs[0].pe)[0].weightKg, afterTest: xs[0].after.workingKg, w12: at(12), w26: sim.weeks >= 26 ? at(26) : null, w52: sim.weeks >= 52 ? at(52) : null };
  };
  const count = (o) => sim.entries.filter((e) => e.outcome === o).length;
  return {
    run: sim.name,
    sessions: sim.sessions.length,
    skipped: sim.skipped,
    chestPress: track('machine-chest-press'),
    latPulldown: track('lat-pulldown'),
    assistedPullUp: track('assisted-pull-up'),
    reactiveDeloads: count('deloaded'),
    failed: count('failed'),
    deloadWeekSessions: new Set(sim.plans.filter((p) => p.deload).map((p) => p.n)).size,
    gapReductions: sim.plans.filter((p) => p.before && gapped(p)).length,
    repeatedDeloads: Object.fromEntries([...byExercise(sim.entries)].map(([id, xs]) => [id, xs.filter((e) => e.outcome === 'deloaded').map((e) => `${e.used}→${e.after.workingKg}`)]).filter(([, d]) => d.length > new Set(d).size)),
    coverage: coverage(sim),
  };
}

/* ------------------------------------------------------------------ the runs */

const RUNS = [
  { name: 'responder-12w', profile: 'responder', weeks: 12, seed: 1201 },
  { name: 'average-12w', profile: 'average', weeks: 12, seed: 1202 },
  { name: 'stalled-12w', profile: 'stalled', weeks: 12, seed: 1203 },
  { name: 'responder-52w', profile: 'responder', weeks: 52, seed: 5201 },
  { name: 'average-52w', profile: 'average', weeks: 52, seed: 5202 },
  { name: 'stalled-52w', profile: 'stalled', weeks: 52, seed: 5203 },
  { name: 'average-12w-small-gym', profile: 'average', weeks: 12, seed: 1204, gym: SMALL_GYM },
  { name: 'average-52w-small-gym', profile: 'average', weeks: 52, seed: 5204, gym: SMALL_GYM },
  { name: 'average-52w-new-machine', profile: 'average', weeks: 52, seed: 5205, swap: SWAP_GYM },
];

/** Same-policy counterfactual runs: plateau memory must not add deloads or cost more than one load step. */
const PLATEAU_COMPARISON_RUNS = new Set([
  'responder-12w', 'average-12w', 'responder-52w', 'average-52w',
  'average-12w-small-gym', 'average-52w-small-gym', 'average-52w-new-machine',
]);

/** 20 more stalled lifters, a year each (seeds 5303 … 7203, the stalled-52w seed + 100 k): rule 5 across lifters. */
const STALLED = Array.from({ length: 20 }, (_, k) => ({ name: `stalled-52w-${5303 + 100 * k}`, profile: 'stalled', weeks: 52, seed: 5303 + 100 * k }));

/**
 * What each run took to simulate, in ms: CPU time and wall time; the runs above and the stalled lifters, every
 * simulation in this file. The engine must stay fast enough for a phone: all of them in under 2 s together, counted
 * in the CPU time of the thread that runs them, because `node --test` runs the files in parallel and a busy machine
 * stretches the wall clock: 727–766 ms alone, 1237–2513 ms in the suite with other work running, while the thread's
 * CPU time stayed at 709–1051 ms. Where Node has no process.threadCpuUsage (before 23.9) the process's CPU time
 * counts, which adds V8's GC and compiler threads (1151–1661 ms in the same runs).
 */
const timings = [];
/** @param {NodeJS.CpuUsage} [since] */
const cpuUsage = (since) => (typeof process.threadCpuUsage === 'function' ? process.threadCpuUsage(since) : process.cpuUsage(since));
/** Simulate a run and time it. */
function timed(run) {
  const wall = performance.now();
  const cpu = cpuUsage();
  const sim = simulate(run);
  const used = cpuUsage(cpu);
  timings.push({ cpu: (used.user + used.system) / 1000, wall: performance.now() - wall });
  return sim;
}

for (const run of RUNS) {
  describe(`simulation: ${run.name}`, () => {
    const sim = timed(run);
    if (REPORT) console.log(JSON.stringify(report(sim)));
    it('rotation stays A → B → C → A through skipped days, auto-closed sessions and the holiday', () => checkRotation(sim));
    it('loads stay finite, ≥ 0, on the increment grid and below 2.5 × the starting e1RM', () => checkLoads(sim));
    it('plans follow the memory: deload weeks, gap tiers, one reduction per break', () => checkPlans(sim));
    it('steps: double progression, at most one step or +10 %, the capacity guard, no double rise after a miss, none in a hold', () => checkSteps(sim));
    it('misses: a deload by the documented miss, and runs of misses stay bounded', () => checkFailures(sim));
    it('assisted pull-up: assistance comes off only after hitting the targets, goes back on in a deload, never < 0', () => checkAssisted(sim));
    it('holds and carries progress by time and distance; never kg on a pure bodyweight hold', () => checkHoldsAndCarries(sim));
    it('warm-up ramps climb and stay lighter than the working sets', () => checkWarmups(sim));
    it('a session done as planned never makes the next one easier; re-applying a session changes nothing', () => checkAsPlanned(sim));
    it('test sessions (first time, substitutes, ≥ 28 days off) re-anchor on what was lifted, even in a deload week', () => checkTests(sim));
    it('incomplete logs hold (§16 rule 4): 1 of 4 sets is no progress, and no miss unless a set fell below the range', () => checkIncomplete(sim));
    it('weight holds: no heavier load and no target past the top before the date, cleared after it', () => checkHolds(sim));
    it('no fail → deload cycles in this run: the hammer curl never repeats a deload; others at most twice a year, the stalled lifter too', () => checkCycles(sim));
    it('plateau memory (§16 rule 5): back to a load that failed only after 2 (then 3) sessions in a row at the top', () => checkPlateau(sim));
    if (PLATEAU_COMPARISON_RUNS.has(run.name)) {
      it('plateau memory costs a responding or average lifter nothing: no more deloads, week-52 loads within one step', () => {
        // Re-run the same lifter under today's calibration policy without plateau memory.
        // Historical pre-calibration golden loads no longer isolate the effect of rule 5.
        const comparison = report(simulate({ ...run, plateauMemory: false }));
        const before = { deloads: comparison.reactiveDeloads, w52: { 'machine-chest-press': comparison.chestPress?.w52, 'lat-pulldown': comparison.latPulldown?.w52, 'assisted-pull-up': comparison.assistedPullUp?.w52 } };
        const r = report(sim);
        assert.ok(r.reactiveDeloads <= before.deloads, `${run.name}: ${r.reactiveDeloads} reactive deloads, ${before.deloads} before rule 5`);
        for (const [id, kg] of Object.entries(before.w52 ?? {}).filter(([, kg]) => kg != null)) {
          const ex = exerciseOf(id);
          const now = { 'machine-chest-press': r.chestPress, 'lat-pulldown': r.latPulldown, 'assisted-pull-up': r.assistedPullUp }[id]?.w52;
          assert.ok(now != null && effective(ex, now) >= effective(ex, kg) - incrementFor(ex, sim.gym) - 1e-9, `${run.name} ${id}: ${now} kg at week 52, ${kg} kg before rule 5`);
        }
      });
    }
    it('the run goes through the paths the checks above are about', () => {
      const c = coverage(sim);
      const at = `${run.name}: ${JSON.stringify(c)}`;
      assert.ok(c.asPlanned > 0 && c.testRamps > 0 && c.deloadWeekHolds > 0 && c.gapShort + c.gapLong >= 15, at);
      if (run.weeks >= 52) assert.ok(c.loadUps >= 20 && c.widened >= 20 && c.coarseUps >= 10 && c.failed + c.deloaded > 0 && c.assistOff > 0 && c.incomplete > 0 && c.heldByHold > 0 && c.repJumps > 0 && c.pastTop > 0 && c.flagged > 0, at);
      if (run.profile === 'stalled' && run.weeks >= 52) assert.ok(c.deloaded > 0 && c.plateauWaits > 0 && c.plateauEarns > 0 && c.plateauBack > 0, `${at}: the stalled lifter never needed a deload, never waited at the top or never earned a step back`);
      if (run.profile === 'responder' && run.weeks >= 52) assert.ok(c.overshootUps > 0, `${at}: no big jump`);
      if (run.gym === SMALL_GYM && run.weeks >= 52) assert.ok(c.holdTops > 0, `${at}: no hold reached the top`);
      if (run.swap) assert.equal(c.firstInDeloadWeek, 1, at);
    });
    if (run.swap) {
      it('a new machine first used in a deload week: its test session counts', () => {
        assert.ok(sim.swappedAt > 0, 'the swap happened');
        const first = sim.entries.find((e) => e.pe.exerciseId === 'converging-chest-press');
        assert.ok(first && first.deload && !first.before, 'the first converging-press session fell in the deload week');
        assert.doesNotMatch(first.note?.en ?? '', /^Deload week/, `${where(sim, first)}: the test session was held as a deload week (${first.outcome}, sessions ${first.after.sessions})`);
      });
    }
    if (run.name === 'average-52w') {
      it('a year of the average lifter: the chest-press working load rises, and stays within 2 × the confirmed start', () => {
        const xs = sim.entries.filter((e) => e.pe.exerciseId === 'machine-chest-press');
        const start = (xs.find((e) => e.after.baseline?.status === "established") ?? xs[0]).after.workingKg; // first confirmed baseline, not the provisional catalog seed
        const end = xs.at(-1).after.workingKg;
        assert.ok(end >= start + incrementFor(xs[0].ex, null), `chest press ${start} → ${end} kg in a year`);
        assert.ok(end <= 2 * start, `chest press ${start} → ${end} kg in a year`);
      });
      it('a year of the average lifter: the chest-press e1RM (best reliable set per session) rises, and stays below 2 × the start', () => {
        const e1rmOf = (e) => Math.max(0, ...e.sets.filter((s) => s.reps >= 1 && s.reps + (s.rir ?? e.params.rir) <= RULES.reliableTotalReps)
          .map((s) => effective(e.ex, s.kg) * e1rmFactor(s.reps + (s.rir ?? e.params.rir))));
        // sessions with a reliable set: 10 reps with 4 in reserve (14 > reliableTotalReps) estimates no 1RM, not 0 kg
        const xs = sim.entries.filter((e) => e.pe.exerciseId === 'machine-chest-press' && !e.test && e1rmOf(e) > 0);
        const mean = (list) => list.reduce((a, e) => a + e1rmOf(e), 0) / list.length;
        const first = mean(xs.slice(0, 4));
        const last = mean(xs.slice(-4));
        assert.ok(first > 0 && last > first * 1.05 && last < 2 * first, `chest press e1RM ${first.toFixed(1)} → ${last.toFixed(1)} kg in a year`);
      });
    }
  });
}

/**
 * Rule 5 across lifters, not one seed: the 20 more stalled lifters (STALLED). The record check holds for each, and an
 * exercise deloaded 3 times from one load stays rare: at most 2 of the 20 (10 %; 1 of them on 2026-11-09, against 14
 * before rule 5 and 11 with its first version), none of them 4 times. That is these seeds, not a bound: the wait always
 * ends (no permanent stall), so on 400 other stalled years (plan 03) 19 have an exercise deloaded 3 or more times from
 * one load (4.75 %) and 1 a fourth time (0.25 %: a face pull whose range top is the rep ceiling, so no reps to spare).
 */
describe('simulation: 20 more stalled lifters, 52 weeks', () => {
  const sims = STALLED.map((run) => timed(run));
  it('plateau memory (§16 rule 5) holds for each of them', () => {
    for (const sim of sims) checkPlateau(sim);
  });
  it('an exercise deloaded 3 times from one load: at most 2 of the 20 lifters, none of them 4 times', () => {
    const worst = sims.map((sim) => {
      let most = { n: 0, at: sim.name };
      for (const [id, list] of byExercise(sim.entries)) {
        const from = new Map();
        for (const e of list.filter((x) => x.outcome === 'deloaded')) from.set(e.used, (from.get(e.used) ?? 0) + 1);
        for (const [kg, n] of from) if (n > most.n) most = { n, at: `${sim.name} ${id} ${kg} kg` };
      }
      return most;
    });
    const three = worst.filter((w) => w.n >= 3).map((w) => `${w.at} × ${w.n}`);
    assert.ok(three.length <= 2, three.join(', '));
    assert.ok(worst.every((w) => w.n <= 3), three.join(', '));
  });
});

describe('simulation runtime', () => {
  it(`all ${RUNS.length + STALLED.length} simulations (the ${RUNS.length} runs: 12 and 52 weeks, three lifter profiles, three gyms; the ${STALLED.length} stalled lifters) take under 2 s of CPU together`, (t) => {
    const cpu = timings.reduce((a, x) => a + x.cpu, 0);
    const wall = timings.reduce((a, x) => a + x.wall, 0);
    const measured = `${cpu.toFixed(0)} ms of CPU, ${wall.toFixed(0)} ms wall (CPU per run: ${timings.map((x) => x.cpu.toFixed(0)).join(', ')})`;
    t.diagnostic(measured);
    assert.equal(timings.length, RUNS.length + STALLED.length);
    assert.ok(cpu < 2000, measured);
  });
});

/* ------------------------------------------------------------------ master plan §16 in the loop */

describe('master plan §16 in the loop: planSession → logged sets → applySession', () => {
  const program = buildProgram({ goal: 'recomp', daysPerWeek: 3, now: iso(CREATED), id: 'sim-16' });
  const settings = { goal: 'recomp', daysPerWeek: 3, bodyweightKg: BODYWEIGHT, activeGymId: null, unit: 'kg', restTimer: true, autoCloseHours: 6, updatedAt: iso(CREATED) };
  /** The chest press (A1, 4 × 6–10 at RIR 2, 5 kg steps) last done a week before `START`. */
  const chest = (o = {}) => ({
    'machine-chest-press': {
      exerciseId: 'machine-chest-press', workingKg: 40, targetReps: 6, repRange: [6, 10], rir: 2, e1rm: 0, lastOutcome: 'progressed',
      fails: 0, sessions: 3, lastAt: iso(START - 7 * DAY), updatedAt: iso(START - 7 * DAY), ...o,
    },
  });
  /** Day A at `now`: A1 as `logOf(planned set, i)` says (null = not logged; fields default to the plan), then applied. */
  const dayA = (states, now, logOf, extra = {}) => {
    const plan = planSession({ program, dayKey: 'A', states, settings, now: iso(now), deload: false });
    const pe = plan.exercises.find((e) => e.slotId === 'A1');
    assert.ok(pe);
    const id = `s16-${now}`;
    const sets = [];
    working(pe).forEach((w, i) => {
      const s = logOf(w, i);
      if (!s) return;
      const doneAt = iso(now + (i + 1) * 180_000);
      sets.push({ id: `${id}-${i}`, sessionId: id, slotId: 'A1', exerciseId: pe.exerciseId, setIndex: i, kind: 'working', plannedKg: w.weightKg, plannedReps: w.reps, kg: s.kg ?? w.weightKg, reps: s.reps ?? w.reps, rir: s.rir ?? w.rir, doneAt, updatedAt: doneAt });
    });
    const session = { id, programId: program.id, dayKey: 'A', gymId: null, startedAt: iso(now), endedAt: iso(now + HOUR), status: 'finished', bodyweightKg: BODYWEIGHT, updatedAt: iso(now + HOUR) };
    const r = applySession({ program, session, sets, states, now: iso(now + HOUR), settings, deload: false, ...extra });
    return { pe, r, state: r.states['machine-chest-press'], outcome: r.outcomes.find((o) => o.slotId === 'A1') };
  };

  it('RIR 5 against a target of 2 climbs faster than a rep per session, then the load jumps (rule 3)', () => {
    for (const [rir, expected] of [[5, ['40x6', '40x9', '40x10', '45x6']], [4, ['40x6', '40x8', '40x10', '45x6']], [2, ['40x6', '40x7', '40x8', '40x9']]]) {
      let states = chest();
      const seen = [];
      for (let k = 0; k < 4; k++) {
        const { pe, r } = dayA(states, START + k * 7 * DAY, () => ({ rir }));
        seen.push(`${working(pe)[0].weightKg}x${working(pe)[0].reps}`);
        states = r.states;
      }
      // RIR 5 (and the tracker's "4+"): the top in two sessions instead of four, then the next pin
      assert.deepEqual(seen, expected, `logged RIR ${rir}`);
    }
  });

  it('after a deload the step back to the load that failed waits for 2 sessions in a row at the top, 3 after the second with 2 reps more (rule 5)', () => {
    let states = chest({ workingKg: 55, targetReps: 6 });
    const seen = [];
    const outcomes = [];
    let k = 0;
    /** `n` weekly A days, each set logged as `logOf` says (fields default to the plan) */
    const days = (n, logOf) => {
      for (let i = 0; i < n; i++, k++) {
        const { pe, r, outcome } = dayA(states, START + k * 7 * DAY, logOf);
        seen.push(`${working(pe)[0].weightKg}x${working(pe)[0].reps}`);
        outcomes.push(outcome);
        states = r.states;
      }
    };
    const miss = () => ({ reps: 5 }); // below 6–10
    const asPlanned = () => ({});
    days(2, miss);
    days(12, asPlanned);
    days(2, miss);
    days(16, asPlanned);
    // 55 kg fails twice → 45 kg (−10 % on a 5 kg stack); reps climb, 45 × 11 carries 50 kg; 50 × 10 carries 55 kg but
    // waits one session; after the second deload from 55 kg the step asks for 2 reps more in hand (50 × 11, 50 × 12),
    // then two more sessions like that
    const climb = ['45x6', '45x7', '45x8', '45x9', '45x10', '45x11', '50x6', '50x7', '50x8', '50x9', '50x10'];
    assert.deepEqual(seen, ['55x6', '55x6', ...climb, '50x10', '55x6', '55x6', ...climb, '50x11', '50x12', '50x12', '50x12', '55x6']);
    assert.deepEqual([outcomes[1]?.outcome, outcomes[15]?.outcome], ['deloaded', 'deloaded']);
    assert.deepEqual([12, 13, 26, 27, 28, 29, 30].map((i) => outcomes[i]?.outcome), ['held', 'progressed', 'progressed', 'progressed', 'held', 'held', 'progressed']);
    assert.match(outcomes[12]?.note.en ?? '', /the next step \(55 kg\) ended in a deload last time: keep 50 kg × 10 reps for 1 more session like this one/);
    assert.match(outcomes[26]?.note.en ?? '', /has ended in a deload 2 times: earn it with 11 reps at 50 kg first\..*micro-plates/);
    assert.match(outcomes[27]?.note.en ?? '', /has ended in a deload 2 times: earn it with 12 reps at 50 kg first\..*micro-plates/);
    assert.match(outcomes[28]?.note.en ?? '', /has ended in a deload 2 times: keep 50 kg × 12 reps for 2 more sessions like this one.*micro-plates/);
    assert.match(outcomes[29]?.note.ru ?? '', /уже 2 раза заканчивался разгрузкой: оставьте 50 кг × 12 повторений ещё на 1 такую же тренировку/);
    assert.deepEqual(states['machine-chest-press'].plateau, { kg: 55, times: 2, streak: 0 });
  });

  it('1 of 4 sets logged holds: the same weight and target next time, and no miss (rule 4)', () => {
    const states = chest({ targetReps: 8 });
    for (const extra of [{}, { plannedSets: { 'machine-chest-press': 4 } }]) {
      const { state, outcome } = dayA(states, START, (w, i) => (i === 0 ? {} : null), extra);
      assert.deepEqual([outcome?.outcome, state.workingKg, state.targetReps, state.fails], ['held', 40, 8, 0], JSON.stringify(extra));
      assert.match(outcome?.note.en ?? '', /^Only 1 of 4 working sets logged/);
    }
    // all four: + 1 rep; and a single set below the range is still a miss
    assert.equal(dayA(states, START, () => ({})).state.targetReps, 9);
    const miss = dayA(states, START, (w, i) => (i === 0 ? { reps: 4 } : null));
    assert.deepEqual([miss.outcome?.outcome, miss.state.fails], ['failed', 1]);
  });

  it('a break never cuts more than twice the intended % for any exercise and load of the program; too coarse → 2 fewer reps', () => {
    let n = 0;
    let repsOnly = 0;
    for (const day of program.days) {
      // every loadable slot of the day at its i-th load on its own grid, all planned together
      const slots = day.slots.map((slot) => ({ slot, ex: exerciseOf(slot.exerciseId) })).filter(({ ex }) => incrementFor(ex, null) > 0);
      for (let i = 0; i < 24; i++) {
        for (const days of [14, 17, 21, 27]) {
          /** @type {Record<string, any>} */
          const states = {};
          for (const { slot, ex } of slots) {
            const [lo, hi] = slot.repRange;
            const kg = isAssisted(ex) ? 5 * (i % 13) : (i + 1) * incrementFor(ex, null);
            states[ex.id] = { exerciseId: ex.id, workingKg: kg, targetReps: Math.min(hi, lo + 2 * unitStep(ex)), repRange: [lo, hi], rir: slot.rir, e1rm: 0, lastOutcome: 'progressed', fails: 0, sessions: 6, lastAt: iso(START - days * DAY), updatedAt: iso(START - days * DAY) };
          }
          const plan = planSession({ program, dayKey: day.key, states, settings, now: iso(START), deload: false });
          for (const { slot, ex } of slots) {
            const before = states[ex.id];
            const w = working(plan.exercises.find((e) => e.slotId === slot.slotId))[0];
            const intended = 5 + (5 * (days - 14)) / 14;
            const cut = cutOf(ex, before.workingKg, w.weightKg);
            const at = `${ex.id} ${before.workingKg} kg × ${before.targetReps}, ${days} days: ${w.weightKg} kg × ${w.reps}`;
            assert.ok(cut >= -1e-9 && cut <= (2 * intended + 0.1) / 100 + 1e-9, `${at} (−${(100 * cut).toFixed(1)} % for −${intended.toFixed(1)} %)`);
            if (w.weightKg === before.workingKg) {
              assert.equal(w.reps, Math.max(before.repRange[0], before.targetReps - RULES.gapCut.repsMinus * unitStep(ex)), `${at}: reps instead of the cut`);
              repsOnly += 1;
            } else assert.equal(w.reps, before.targetReps, at);
            n += 1;
          }
        }
      }
    }
    assert.ok(n > 1000 && repsOnly > 50, `${n} plans, ${repsOnly} with 2 fewer reps instead of a cut`);
  });
});
