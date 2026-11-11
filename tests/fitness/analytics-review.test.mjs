/** Regression tests for the reviewed analytics defects (windowed strength trend, autocorrelated bands, stale
 * weigh-ins, target direction, high-rep e1RM, scale-noise PRs, unreported RIR, weekly ACWR, gyms, partial first
 * week). Dates are LOCAL; 2026-01-05 is a Monday. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAY_MS,
  acwr,
  adherence,
  bodyweightTrendLookup,
  e1rm,
  e1rmTrend,
  effectiveLoad,
  firstActiveWeek,
  forecast,
  ewma,
  plateau,
  prs,
  sessionBestE1rm,
  setEffort,
  tQuantile,
  timeToTarget,
  weekGrid,
  weeklyRate,
  weighInAge,
} from "../../src/lib/fitness/analytics.mjs";
import { e1rmFactor, loadFraction } from "../../src/lib/fitness/progression.mjs";
import { lastSetInputs, loadTable } from "../../src/lib/fitness/tools.mjs";

const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, msg ?? `${actual} ≉ ${expected} (±${tol})`);
const local = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const MON = local(2026, 1, 5, 0);

/** Seeded generator (LCG) + Box–Muller, so simulations are reproducible. */
function rng(seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const gauss = () => {
    let u = 0;
    while (!u) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };
  return { rnd, gauss };
}

let seq = 0;
const set = (over = {}) => {
  seq += 1;
  const at = over.at ?? MON;
  return {
    id: `r-${seq}`,
    sessionId: over.sessionId ?? "s1",
    slotId: "A1",
    exerciseId: over.exerciseId ?? "machine-chest-press",
    setIndex: 0,
    kind: "working",
    plannedKg: over.kg ?? 50,
    plannedReps: over.plannedReps ?? over.reps ?? 10,
    kg: over.kg ?? 50,
    reps: over.reps ?? 10,
    rir: over.rir === undefined ? 2 : over.rir,
    doneAt: new Date(at).toISOString(),
    updatedAt: new Date(at).toISOString(),
    ...(over.prescription ? { prescription: over.prescription } : {}),
  };
};

describe("1 · strength trend window", () => {
  it("fits the last 12 weeks once there are 24 weeks of data, so an old climb cannot mask a plateau", () => {
    const { gauss } = rng(4242);
    const s = [];
    for (let w = 0; w < 52; w++) {
      const kg = w < 36 ? 60 * Math.exp(0.01 * w) : 60 * Math.exp(0.36) * (1 - 0.002 * (w - 36));
      s.push({ at: MON + w * 7 * DAY_MS, kg: kg * (1 + 0.01 * gauss()), reliable: true });
    }
    const t = e1rmTrend(s);
    assert.equal(t.status, "ok");
    assert.equal(t.windowed, true);
    assert.equal(t.windowWeeks, 12);
    assert.ok(t.pctPerWeek < 0.3, `windowed slope ${t.pctPerWeek} should not show the old +1 %/week`);
    assert.ok(t.spanDays <= 12 * 7 + 1e-9);
    assert.ok(t.line[0].at >= s.at(-1).at - 12 * 7 * DAY_MS - 1, "the line starts inside the window");
    assert.ok(t.band[0].at >= s.at(-1).at - 12 * 7 * DAY_MS - 1, "and so does the band");
    assert.equal(t.n, 13);
  });

  it("uses the whole history under 24 weeks", () => {
    const s = Array.from({ length: 20 }, (_, w) => ({ at: MON + w * 7 * DAY_MS, kg: 60 * 1.01 ** w, reliable: true }));
    const t = e1rmTrend(s);
    assert.equal(t.windowed, false);
    assert.equal(t.n, 20);
    near(t.pctPerWeek, 1, 1e-9);
  });
});

describe("2 · bands under autocorrelated noise", () => {
  /** @param {{ n: number, rho: number, trials: number, seed: number }} c */
  function cover({ n, rho, trials, seed }) {
    const { gauss } = rng(seed);
    const slope = -0.07;
    const t0 = local(2026, 1, 5, 8);
    let rate = 0;
    let fc = 0;
    for (let k = 0; k < trials; k++) {
      const pts = [];
      let e = 0;
      for (let i = 0; i < n; i++) {
        e = rho * e + Math.sqrt(1 - rho * rho) * 0.5 * gauss();
        pts.push({ at: t0 + i * DAY_MS, value: 80 + slope * i + e });
      }
      const r = weeklyRate(ewma(pts), { days: 28 });
      if (r.band[0] <= slope * 7 && slope * 7 <= r.band[1]) rate += 1;
      const f = forecast(pts, 28, { windowDays: 28, confidence: 0.9 });
      const b = f.band.at(-1);
      const truth = 80 + (slope * (b.at - t0)) / DAY_MS;
      if (b.lo <= truth && truth <= b.hi) fc += 1;
    }
    return { rate: rate / trials, fc: fc / trials };
  }

  it("the 95 % rate band and the 90 % forecast band keep their coverage at ρ = 0.5 (n = 28)", () => {
    const c = cover({ n: 28, rho: 0.5, trials: 2000, seed: 12345 });
    assert.ok(c.rate >= 0.9, `rate band coverage ${c.rate}`);
    assert.ok(c.fc >= 0.86, `forecast band coverage ${c.fc}`);
  });

  it("white noise stays near the nominal level (not blown up by the correction)", () => {
    const c = cover({ n: 28, rho: 0, trials: 2000, seed: 777 });
    assert.ok(c.rate >= 0.935 && c.rate <= 0.985, `rate band coverage ${c.rate}`);
    assert.ok(c.fc >= 0.88 && c.fc <= 0.96, `forecast band coverage ${c.fc}`);
  });

  it("t quantile accepts fractional degrees of freedom and decreases with them", () => {
    near(tQuantile(0.975, 10), 2.2281, 0.003);
    assert.ok(tQuantile(0.975, 1.5) < tQuantile(0.975, 1) && tQuantile(0.975, 1.5) > tQuantile(0.975, 2));
    assert.ok(tQuantile(0.975, 2.5) < tQuantile(0.975, 2) && tQuantile(0.975, 2.5) > tQuantile(0.975, 3));
    assert.ok(tQuantile(0.975, 7.3) < tQuantile(0.975, 7) && tQuantile(0.975, 7.3) > tQuantile(0.975, 8));
  });

  it("ρ is per day: the same residual pattern at 2-day gaps is a weaker day-to-day carry-over", () => {
    const noise = [0.3, 0.4, 0.2, -0.1, -0.4, -0.3, 0.1, 0.3, 0.2, -0.2, -0.3, -0.1];
    const series = (gap) => noise.map((e, i) => ({ at: MON + i * gap * DAY_MS, value: 80 - 0.07 * i * gap + e }));
    const daily = weeklyRate(series(1), { days: 400 });
    const sparse = weeklyRate(series(2), { days: 400 });
    assert.ok(daily.rho > 0.2, `the pattern is autocorrelated: ${daily.rho}`);
    near(sparse.rho, daily.rho ** 0.5, 0.02, "ρ is per day: a lag-1 of r over 2-day gaps is √r per day");
  });
});

describe("3 · stale weigh-ins", () => {
  const t0 = local(2026, 1, 5, 8);
  const pts = Array.from({ length: 20 }, (_, i) => ({ at: t0 + i * DAY_MS, value: 85 - 0.1 * i + 0.2 * Math.sin(i) }));

  it("target dates count from the last weigh-in, not from today", () => {
    const fc = forecast(pts, 182, { windowDays: 28 });
    const ttt = timeToTarget(fc, 81);
    assert.equal(ttt.status, "on-track");
    near(ttt.at, fc.lastAt + ttt.days * DAY_MS, 1);
    near(ttt.earliestAt, fc.lastAt + ttt.earliestDays * DAY_MS, 1);
    near(ttt.latestAt, fc.lastAt + ttt.latestDays * DAY_MS, 1);
  });

  it("a last weigh-in more than 10 days old is stale", () => {
    const last = pts.at(-1).at;
    assert.deepEqual(weighInAge(last, last + 90 * DAY_MS), { days: 90, stale: true });
    assert.deepEqual(weighInAge(last, last + 10 * DAY_MS), { days: 10, stale: false });
    assert.deepEqual(weighInAge(last, last + 11 * DAY_MS), { days: 11, stale: true });
    assert.deepEqual(weighInAge(last, last + 3600e3), { days: 0, stale: false });
  });
});

describe("4 · time to target", () => {
  it("is not 'reached' when the trend has rebounded above a loss target", () => {
    const fc = { start: 74.8, current: 76, slope: 0.04, slopeCI: [0.01, 0.07], capDays: 56, lastAt: MON };
    assert.equal(timeToTarget(fc, 75).status, "away");
  });

  it("'reached' only within 0.15 kg or the level's standard error, whichever is larger", () => {
    const fc = { start: 80, current: 76, slope: -0.05, slopeCI: [-0.08, -0.02], capDays: 56, lastAt: MON, seLevel: 0.05 };
    assert.equal(timeToTarget(fc, 76.1).status, "reached");
    assert.equal(timeToTarget(fc, 75.9).status, "reached");
    assert.equal(timeToTarget(fc, 75.8).status, "on-track");
    assert.equal(timeToTarget(fc, 76.3).status, "away", "already below the target and still falling");
    assert.equal(timeToTarget({ ...fc, seLevel: 0.4 }, 75.7).status, "reached", "a noisy level widens the tolerance");
    const t = timeToTarget(fc, 75);
    near(t.days, 20, 1e-9);
    near(t.earliestDays, 12.5, 1e-9);
    near(t.latestDays, 50, 1e-9);
  });

  it("forecast reports the standard error of its current level", () => {
    const pts = Array.from({ length: 21 }, (_, d) => ({ at: MON + d * DAY_MS, value: 90 - 0.08 * d + [0.3, -0.4, 0.1, 0.4, -0.2][d % 5] }));
    const fc = forecast(pts, 30);
    assert.ok(fc.seLevel > 0 && fc.seLevel < 1);
  });
});

describe("5 · e1RM above 12 total reps", () => {
  it("the factor is monotonic and bounded for 1–60 total reps, unchanged up to 12 and continuous at the joint", () => {
    for (let t = 1; t <= 12; t++) near(e1rmFactor(t), t > 1 ? (1 + t / 30 + 36 / (37 - t)) / 2 : 1, 1e-12, `blend at ${t}`);
    for (let t = 1.25; t <= 60; t += 0.25) assert.ok(e1rmFactor(t) > e1rmFactor(t - 0.25), `monotonic at ${t}`);
    for (let t = 13; t <= 60; t++) assert.ok(e1rmFactor(t) <= (1 + t / 30) / 0.9 + 1e-9, `bounded at ${t}: ${e1rmFactor(t)}`);
    near(e1rmFactor(12.001), e1rmFactor(12), 1e-3);
    near(e1rmFactor(12.999), e1rmFactor(13), 1e-3);
    assert.ok(e1rmFactor(35) < 2.5, "no explosion near 37 reps");
  });

  it("round trip with the calculator's load table for every whole rep count", () => {
    for (let t = 1; t <= 60; t++) near(e1rmFactor(t) * loadFraction(t), 1, 1e-12, `round trip at ${t}`);
    for (const reps of [15, 20]) {
      const table = loadTable({ kg: 60, reps, rir: 0 });
      near(table.rows.find((r) => r.reps === reps).cells[0].exactKg, 60, 0.011, `60 × ${reps} maps back to 60`);
    }
  });

  it("the progress charts use the same factor at every rep count", () => {
    for (let t = 1; t <= 60; t++) near(e1rm(100, t).kg, 100 * e1rmFactor(t), 1e-9, `chart vs engine at ${t}`);
    near(e1rm(100, 10, 2.5).kg, 100 * e1rmFactor(12.5), 1e-9);
    assert.ok(e1rm(100, 30, 4).kg < 300);
  });
});

describe("6 · scale noise is not a record", () => {
  it("identical pull-ups against noisy weigh-ins give no PRs", () => {
    const { gauss } = rng(12345);
    const entries = [];
    for (let d = 0; d < 84; d++) entries.push({ at: MON + d * DAY_MS + 8 * 3600e3, kg: 80 + 0.6 * gauss() });
    const lookup = bodyweightTrendLookup(entries);
    const sets = [];
    for (let w = 0; w < 12; w++) sets.push(set({ sessionId: `S${w}`, exerciseId: "pull-up", kg: 0, reps: 8, rir: 1, at: MON + (w * 7 + 1) * DAY_MS + 18 * 3600e3 }));
    const ex = { id: "pull-up", equipment: "bodyweight" };
    const loadOf = (s) => effectiveLoad(s, ex, lookup(s.doneAt)).kg || null;
    const minGainOf = (id) => (effectiveLoad({ kg: 0 }, id === "pull-up" ? ex : null, 80).kind === "external" ? 0 : 0.01);
    assert.deepEqual(prs(sets, { loadOf, minGainOf }), []);
  });

  it("the trend lookup follows the smoothed weight, not single weigh-ins", () => {
    const entries = [80, 80, 80, 83, 80, 80].map((kg, d) => ({ at: MON + d * DAY_MS, kg }));
    const lookup = bodyweightTrendLookup(entries);
    near(lookup(MON + 3 * DAY_MS + 1), 80.3, 1e-9, "a +3 kg spike moves the trend by α = 0.1");
    assert.equal(lookup(MON - DAY_MS), 80, "before the first weigh-in: the first trend value");
    assert.equal(bodyweightTrendLookup([], 77)(MON), 77);
  });

  it("a real gain on a bodyweight exercise is still a record, and external loads keep the old rule", () => {
    const ex = { id: "pull-up", equipment: "bodyweight" };
    const loadOf = (s) => effectiveLoad(s, ex, 80).kg;
    const sets = [
      set({ sessionId: "a", exerciseId: "pull-up", kg: 0, reps: 8, rir: 0, at: MON }),
      set({ sessionId: "b", exerciseId: "pull-up", kg: 5, reps: 8, rir: 0, at: MON + 7 * DAY_MS }),
    ];
    assert.deepEqual(prs(sets, { loadOf, minGainOf: () => 0.01 }).map((e) => e.kind).sort(), ["e1rm", "load"]);
    const ext = [set({ sessionId: "a", kg: 100, reps: 5, rir: 0, at: MON }), set({ sessionId: "b", kg: 100.5, reps: 5, rir: 0, at: MON + 7 * DAY_MS })];
    assert.deepEqual(prs(ext, { minGainOf: () => 0 }).map((e) => e.kind).sort(), ["e1rm", "load"]);
  });
});

describe("7 · unreported RIR", () => {
  const rx = { version: 1, targetRir: 2, rirReported: false, suggestedKg: 100, suggestedReps: 8 };

  it("missed reps with no reported RIR count as a set to failure", () => {
    const missed = set({ sessionId: "b", kg: 100, reps: 6, plannedReps: 8, rir: 2, prescription: rx, at: MON + 7 * DAY_MS });
    assert.deepEqual(setEffort(missed), { rir: 0, rirSigmaReps: 0.8 });
    near(sessionBestE1rm([missed])[0].kg, e1rm(100, 6, 0).kg, 1e-9);
  });

  it("planned reps made with no reported RIR keep the planned RIR, with a wider error", () => {
    const made = set({ sessionId: "a", kg: 100, reps: 8, plannedReps: 8, rir: 2, prescription: rx });
    const reported = set({ sessionId: "a2", kg: 100, reps: 8, plannedReps: 8, rir: 2, prescription: { ...rx, rirReported: true } });
    const [a] = sessionBestE1rm([made]);
    const [b] = sessionBestE1rm([reported]);
    near(a.kg, b.kg, 1e-9);
    assert.ok(a.sigmaRel > b.sigmaRel * 1.2, `${a.sigmaRel} vs ${b.sigmaRel}`);
    near(a.sigmaRel, Math.hypot(0.033, (Math.hypot(0.8, 1.5) * 100) / 30 / a.kg), 1e-9);
    assert.deepEqual(setEffort(reported), { rir: 2, rirSigmaReps: 0.8 });
    assert.deepEqual(setEffort(set({ rir: null })), { rir: 0, rirSigmaReps: 0.8 }, "no RIR at all: taken to failure");
  });

  it("a missed, unreported set is not an e1RM record", () => {
    const first = set({ sessionId: "a", kg: 100, reps: 8, plannedReps: 8, rir: 0, at: MON });
    const missed = set({ sessionId: "b", kg: 100, reps: 7, plannedReps: 10, rir: 3, prescription: rx, at: MON + 7 * DAY_MS });
    assert.deepEqual(prs([first, missed]).filter((e) => e.kind === "e1rm"), []);
  });

  it("'use my last set' in the calculator gives the chart's e1RM", () => {
    for (const s of [
      set({ kg: 100, reps: 6, plannedReps: 8, rir: 2, prescription: rx }),
      set({ kg: 100, reps: 8, plannedReps: 8, rir: 2, prescription: rx }),
      set({ kg: 100, reps: 8, rir: null }),
      set({ kg: 100, reps: 8, rir: 3 }),
    ]) {
      const table = loadTable(lastSetInputs(s));
      near(table.e1rm, sessionBestE1rm([s])[0].kg, 0.006, `calculator ${table.e1rm} vs chart`);
    }
  });
});

describe("9 · weekly ACWR", () => {
  it("20 identical Mon/Wed/Fri weeks read 1.0 every day after the warm-up", () => {
    const loads = [];
    for (let d = 0; d < 140; d++) if ([1, 3, 5].includes(new Date(MON + d * DAY_MS).getDay())) loads.push({ at: MON + d * DAY_MS + 12 * 3600e3, load: 10000 });
    const r = acwr(loads, { until: MON + 139 * DAY_MS });
    assert.equal(r.length, 140);
    assert.equal(r[33].ratio, null, "needs 5 full weeks");
    for (const d of r.slice(34)) {
      assert.ok(d.ratio >= 0.95 && d.ratio <= 1.05, `${d.date}: ${d.ratio}`);
      assert.equal(d.zone, "steady");
    }
  });

  it("flags a doubled week as a spike and a skipped week as a dip", () => {
    const base = Array.from({ length: 56 }, (_, d) => ({ at: MON + d * DAY_MS, load: 100 }));
    const spike = acwr([...base, ...Array.from({ length: 7 }, (_, d) => ({ at: MON + (56 + d) * DAY_MS, load: 200 }))]);
    near(spike.at(-1).ratio, 2, 1e-9);
    assert.equal(spike.at(-1).zone, "spike");
    const dip = acwr(base, { until: MON + 62 * DAY_MS });
    assert.equal(dip.at(-1).ratio, 0);
    assert.equal(dip.at(-1).zone, "dip");
  });
});

describe("10 · gyms", () => {
  const A = (sessionId, kg, at) => set({ sessionId, kg, reps: 8, rir: 0, at });
  const sets = [A("a1", 100, MON), A("a2", 102.5, MON + 7 * DAY_MS), A("b1", 60, MON + 14 * DAY_MS), A("b2", 62.5, MON + 21 * DAY_MS), A("a3", 107.5, MON + 28 * DAY_MS)];
  const gymOf = (s) => (s.sessionId.startsWith("a") ? "gym-a" : "gym-b");

  it("records are compared only with earlier sessions at the same gym", () => {
    const ev = prs(sets, { gymOf }).filter((e) => e.kind === "load");
    assert.deepEqual(ev.map((e) => [e.sessionId, e.previous]), [["a2", 100], ["b2", 60], ["a3", 102.5]]);
  });

  it("without gyms nothing changes", () => {
    assert.deepEqual(prs(sets, { gymOf: () => null }), prs(sets));
    assert.deepEqual(prs(sets).filter((e) => e.kind === "load").map((e) => e.sessionId), ["a2", "a3"]);
  });

  it("the plateau flag can be computed on one gym's sessions", () => {
    const series = sessionBestE1rm(sets);
    const last = gymOf({ sessionId: series.at(-1).sessionId });
    const own = series.filter((p) => gymOf({ sessionId: p.sessionId }) === last);
    assert.equal(own.length, 3);
    assert.equal(plateau(own).since, 0);
    assert.equal(plateau(series).best, own.at(-1).kg, "pooled, the lighter gym's sessions only look like a dry spell");
    assert.equal(plateau(series.slice(0, 4)).since, 2);
  });
});

describe("11 · partial first week", () => {
  const sess = (t) => ({ startedAt: new Date(t).toISOString(), status: "finished" });

  it("a first session on Saturday plans at most the two days left in that week", () => {
    const now = local(2026, 11, 12);
    const ss = [sess(local(2026, 10, 31, 10)), ...[2, 4, 6].map((d) => sess(local(2026, 11, d, 10)))];
    const a = adherence(ss, { now });
    const byKey = Object.fromEntries(a.weeks.map((w) => [w.key, w]));
    assert.deepEqual([byKey["2026-10-26"].planned, byKey["2026-10-26"].done, byKey["2026-10-26"].missed], [2, 1, 1]);
    assert.deepEqual([byKey["2026-11-02"].planned, byKey["2026-11-02"].missed], [3, 0]);
    assert.equal(a.totalPlanned, 5);
    assert.equal(a.totalDone, 4);
  });

  it("a first session on Sunday that is done meets its week and starts the streak", () => {
    const now = local(2026, 11, 12);
    const ss = [sess(local(2026, 11, 1, 10)), ...[2, 4, 6].map((d) => sess(local(2026, 11, d, 10)))];
    const a = adherence(ss, { now });
    const first = a.weeks.find((w) => w.key === "2026-10-26");
    assert.deepEqual([first.planned, first.done, first.missed, first.met], [1, 1, 0, true]);
    assert.equal(a.rate, 1);
    assert.equal(a.streak, 2);
  });

  it("a first week that is also the current week plans only what is left", () => {
    const now = local(2026, 11, 14);
    const a = adherence([sess(local(2026, 11, 13, 10))], { now });
    assert.deepEqual(a.thisWeek, { done: 1, planned: 3 }, "Friday start: three days left");
    assert.deepEqual(adherence([sess(local(2026, 11, 14, 10))], { now }).thisWeek, { done: 1, planned: 2 });
  });

  it("volume averages start at the first session's week", () => {
    const now = local(2026, 11, 12);
    const grid = weekGrid(8, now);
    assert.equal(firstActiveWeek(grid, local(2026, 10, 31, 10)), 5, "the week of 26 Oct");
    assert.equal(firstActiveWeek(grid, local(2026, 1, 1)), 0, "older than the window");
    assert.equal(firstActiveWeek(grid, null), grid.length, "no sessions: no active weeks");
  });
});
