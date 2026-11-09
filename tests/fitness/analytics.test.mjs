/** Stream 06 analytics (plans/fitness/06-progress-analytics.md). Dates are built in LOCAL time so the tests do not
 * depend on the machine's time zone. 2026-11-09 is a Monday. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import {
  DAY_MS,
  acwrEwma,
  adherence,
  banister,
  banisterTiming,
  bestRecords,
  bodyweightLookup,
  dailyGrid,
  dailyLoads,
  dailyMean,
  dayKey,
  e1rm,
  e1rmSeries,
  e1rmTrend,
  effectiveLoad,
  ewma,
  forecast,
  groupWeightsOf,
  hardSets,
  plateau,
  prs,
  sessionBestE1rm,
  startOfWeek,
  tQuantile,
  theilSen,
  timeToTarget,
  tonnage,
  weekGrid,
  weeklyRate,
  weeklyTonnage,
  weeklyVolumeByGroup,
} from "../../src/lib/fitness/analytics.mjs";

const near = (actual, expected, tol = 0.05, msg) => assert.ok(Math.abs(actual - expected) <= tol, msg ?? `${actual} ≉ ${expected} (±${tol})`);
const local = (y, m, d, h = 18, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const MON = local(2026, 11, 9, 0); // Monday 9 Nov 2026, 00:00

let seq = 0;
/** A logged set; `at` is epoch ms. */
const set = (over = {}) => {
  seq += 1;
  const at = over.at ?? MON;
  return {
    id: `set-${seq}`,
    sessionId: over.sessionId ?? "s1",
    slotId: "A1",
    exerciseId: over.exerciseId ?? "machine-chest-press",
    setIndex: 0,
    kind: over.kind ?? "working",
    plannedKg: over.kg ?? 50,
    plannedReps: over.reps ?? 10,
    kg: over.kg ?? 50,
    reps: over.reps ?? 10,
    rir: over.rir === undefined ? 2 : over.rir,
    doneAt: new Date(at).toISOString(),
    updatedAt: new Date(at).toISOString(),
  };
};

describe("e1rm", () => {
  it("100 kg × 10 is 133.3 kg by Epley, Brzycki and their blend", () => {
    near(e1rm(100, 10, null, "epley").kg, 133.33, 0.01);
    near(e1rm(100, 10, null, "brzycki").kg, 133.33, 0.01);
    near(e1rm(100, 10).kg, 133.33, 0.01);
    assert.equal(e1rm(100, 10).reliable, true);
  });

  it("reps in reserve add to the reps: 8 reps @ 2 RIR = 10 reps to failure", () => {
    assert.equal(e1rm(100, 8, 2).kg, e1rm(100, 10).kg);
    assert.equal(e1rm(100, 8, 2).reps, 10);
    assert.ok(e1rm(100, 8, 2).kg > e1rm(100, 8).kg);
    assert.equal(e1rm(100, 8, null).kg, e1rm(100, 8, 0).kg, "unknown RIR = to failure");
  });

  it("a single to failure is the load itself; the blend sits between the two formulas", () => {
    assert.equal(e1rm(120, 1).kg, 120);
    assert.equal(e1rm(120, 1, 0).kg, 120);
    const b = e1rm(80, 5);
    assert.ok(b.kg > e1rm(80, 5, null, "brzycki").kg && b.kg < e1rm(80, 5, null, "epley").kg);
  });

  it("is reliable up to 12 effective reps and RIR ≤ 4, Epley-only far above", () => {
    assert.equal(e1rm(50, 12).reliable, true);
    assert.equal(e1rm(50, 13).reliable, false);
    assert.equal(e1rm(50, 10, 3).reliable, false, "10 reps + 3 RIR = 13");
    assert.equal(e1rm(50, 5, 5).reliable, false, "RIR 5 is too far from failure");
    assert.equal(e1rm(50, 5, 4).reliable, true);
    near(e1rm(10, 40).kg, 10 * (1 + 40 / 30), 1e-9);
  });

  it("carries ≈ 4 % noise at 5 reps and more far from failure", () => {
    near(e1rm(100, 5).sigmaRel, 0.0404, 0.001);
    assert.ok(e1rm(100, 11).sigmaRel > e1rm(100, 9).sigmaRel);
    assert.ok(e1rm(100, 5, 4).sigmaRel > e1rm(100, 5, 3).sigmaRel);
  });

  it("rejects impossible input", () => {
    assert.equal(e1rm(0, 5), null);
    assert.equal(e1rm(50, 0), null);
    assert.equal(e1rm(Number.NaN, 5), null);
  });
});

describe("effective load", () => {
  const assisted = { id: "assisted-pull-up", equipment: "assisted", assistance: true };
  it("assisted machines: body weight − assistance", () => {
    assert.deepEqual(effectiveLoad({ kg: 30 }, assisted, 80), { kg: 50, kind: "assisted", flag: null });
    assert.deepEqual(effectiveLoad({ kg: 90 }, assisted, 80), { kg: 0, kind: "assisted", flag: null });
    assert.deepEqual(effectiveLoad({ kg: 30 }, assisted, null), { kg: 0, kind: "assisted", flag: "no-bodyweight" });
    near(e1rm(effectiveLoad({ kg: 30 }, assisted, 80).kg, 8).kg, e1rm(50, 8).kg, 1e-9);
    assert.equal(effectiveLoad({ kg: 30 }, { equipment: "assisted" }, 80).kg, 50, "equipment alone marks assistance");
  });

  it("bodyweight exercises: known fraction × body weight + added load, else 0 with a flag", () => {
    assert.equal(effectiveLoad({ kg: 10 }, { id: "pull-up", equipment: "bodyweight" }, 80).kg, 90);
    near(effectiveLoad({ kg: 0 }, { id: "push-up", equipment: "bodyweight" }, 80).kg, 51.2, 1e-9);
    assert.deepEqual(effectiveLoad({ kg: 0 }, { id: "plank", equipment: "bodyweight" }, 80), { kg: 0, kind: "bodyweight", flag: "unknown-fraction" });
    assert.equal(effectiveLoad({ kg: 0 }, { id: "pull-up", equipment: "bodyweight" }, undefined).flag, "no-bodyweight");
  });

  it("everything else: the logged kg", () => {
    assert.deepEqual(effectiveLoad({ kg: 42.5 }, { equipment: "selectorized" }, 80), { kg: 42.5, kind: "external", flag: null });
    assert.equal(effectiveLoad({ kg: 42.5 }, undefined, null).kg, 42.5);
  });

  it("body weight at a time: last weigh-in before, else the first after, else the fallback", () => {
    const lookup = bodyweightLookup([{ at: local(2026, 11, 5, 7), kg: 79 }, { at: local(2026, 11, 1, 7), kg: 80 }], 85);
    assert.equal(lookup(local(2026, 11, 3)), 80);
    assert.equal(lookup(local(2026, 10, 20)), 80);
    assert.equal(lookup(local(2026, 11, 5, 18)), 79);
    assert.equal(bodyweightLookup([], 85)(MON), 85);
    assert.equal(bodyweightLookup([], null)(MON), null);
  });
});

describe("e1RM series", () => {
  it("one point per session: the best reliable set wins over a heavier-looking unreliable one", () => {
    const sets = [
      set({ sessionId: "a", at: local(2026, 11, 9), kg: 60, reps: 8, rir: 2 }),
      set({ sessionId: "a", at: local(2026, 11, 9), kg: 40, reps: 25, rir: 0 }), // e1RM 73 but unreliable
      set({ sessionId: "a", at: local(2026, 11, 9), kg: 70, reps: 3, kind: "warmup" }),
      set({ sessionId: "b", at: local(2026, 11, 16), kg: 62.5, reps: 8, rir: 2 }),
      set({ sessionId: "b", exerciseId: "plank", at: local(2026, 11, 16), kg: 0, reps: 45 }),
    ];
    const all = sessionBestE1rm(sets);
    assert.equal(all.length, 2, "plank has no load → no e1RM");
    const series = e1rmSeries(sets, "machine-chest-press");
    assert.deepEqual(series.map((p) => p.sessionId), ["a", "b"]);
    near(series[0].kg, e1rm(60, 10).kg, 1e-9);
    assert.equal(series[0].reliable, true);
    assert.equal(series[0].sets, 2, "warm-up excluded");
    const onlyUnreliable = e1rmSeries([set({ sessionId: "c", kg: 40, reps: 25, rir: 0 })], "machine-chest-press");
    assert.equal(onlyUnreliable[0].reliable, false);
  });

  it("holds and carries never get an e1RM; loadOf can veto a set", () => {
    const sets = [set({ exerciseId: "farmers-carry", kg: 24, reps: 40 }), set({ kg: 50, reps: 10 })];
    const unitOf = (id) => (id === "farmers-carry" ? "meters" : "reps");
    assert.deepEqual(sessionBestE1rm(sets, { unitOf }).map((p) => p.exerciseId), ["machine-chest-press"]);
    assert.equal(sessionBestE1rm(sets, { unitOf, loadOf: () => null }).length, 0);
  });

  it("the precision-weighted mean sits between the session's sets", () => {
    const sets = [set({ kg: 60, reps: 8 }), set({ kg: 60, reps: 6 }), set({ kg: 60, reps: 5 })];
    const best = sessionBestE1rm(sets)[0].kg;
    const mean = sessionBestE1rm(sets, { aggregate: "mean" })[0].kg;
    assert.ok(mean < best && mean > e1rm(60, 7).kg);
  });
});

describe("volume", () => {
  const catalog = {
    "machine-chest-press": { primary: ["pec-sternal"], secondary: ["delt-front", "triceps-lateral"] },
    "machine-row": { primary: ["lats", "traps-mid"], secondary: ["biceps", "delt-rear"] },
    "farmers-carry": { groups: { forearms: 1, back: 0.5, abs: 0.5 } },
  };
  const muscles = { "pec-sternal": "chest", "delt-front": "shoulders", "delt-rear": "shoulders", "triceps-lateral": "triceps", lats: "back", "traps-mid": "back", biceps: "biceps" };
  const lookup = (id) => catalog[id];
  const groupOf = (m) => muscles[m];

  it("hard sets: working/back-off/AMRAP with ≥ 1 rep and RIR ≤ 4 (unknown RIR counts)", () => {
    const sets = [set(), set({ kind: "warmup" }), set({ rir: 5 }), set({ rir: null }), set({ reps: 0 }), set({ kind: "amrap", rir: 0 })];
    assert.equal(hardSets(sets).length, 3);
  });

  it("tonnage: kg × reps of rep-counted, non-warm-up sets", () => {
    const sets = [set({ kg: 50, reps: 10 }), set({ kg: 20, reps: 10, kind: "warmup" }), set({ exerciseId: "farmers-carry", kg: 24, reps: 40 })];
    assert.equal(tonnage(sets, { unitOf: (id) => (id === "farmers-carry" ? "meters" : "reps") }), 500);
    assert.equal(tonnage(sets), 500 + 960, "without unitOf everything counts as reps");
  });

  it("fractional sets: 1 per primary group, 0.5 per secondary-only group; unknown → other", () => {
    assert.deepEqual(groupWeightsOf(lookup("machine-chest-press"), groupOf), { chest: 1, shoulders: 0.5, triceps: 0.5 });
    assert.deepEqual(groupWeightsOf(lookup("machine-row"), groupOf), { back: 1, biceps: 0.5, shoulders: 0.5 });
    assert.deepEqual(groupWeightsOf(undefined, groupOf), { other: 1 });
    assert.deepEqual(groupWeightsOf({ groups: { abs: 2, back: 0.5 } }, groupOf), { abs: 1, back: 0.5 });
  });

  it("buckets by Monday-week over the last N weeks", () => {
    const now = local(2026, 11, 12); // Thursday of the 9 Nov week
    const sets = [
      ...[1, 2, 3].map(() => set({ at: local(2026, 11, 10) })), // chest press this week
      ...[1, 2].map(() => set({ exerciseId: "machine-row", at: local(2026, 11, 11) })),
      set({ exerciseId: "mystery", at: local(2026, 11, 11) }),
      set({ at: local(2026, 11, 3) }), // last week
      set({ at: local(2026, 9, 1) }), // outside the 8-week window
      set({ at: local(2026, 11, 10), kind: "warmup" }),
    ];
    const v = weeklyVolumeByGroup(sets, lookup, groupOf, { weeks: 8, now, order: ["chest", "back", "shoulders"] });
    assert.equal(v.weeks.length, 8);
    assert.equal(v.weeks[7].start, startOfWeek(now));
    assert.equal(v.weeks[7].key, "2026-11-09");
    assert.deepEqual(v.groups, ["chest", "back", "shoulders", "biceps", "triceps", "other"]);
    assert.equal(v.sets.chest[7], 3);
    assert.equal(v.sets.chest[6], 1);
    assert.equal(v.sets.shoulders[7], 3 * 0.5 + 2 * 0.5);
    assert.equal(v.sets.back[7], 2);
    assert.equal(v.direct.shoulders[7], 0);
    assert.equal(v.hard[7], 6);
    const stack = v.groups.reduce((a, g) => a + (v.primary[g]?.[7] ?? 0), 0);
    near(stack, v.hard[7], 1e-9, "primary split sums to the hard-set count");
  });

  it("weekly and daily tonnage", () => {
    const now = local(2026, 11, 12);
    const sets = [set({ at: local(2026, 11, 10), kg: 50, reps: 10 }), set({ at: local(2026, 11, 10, 19), kg: 50, reps: 10 }), set({ at: local(2026, 11, 3), kg: 40, reps: 10 })];
    const w = weeklyTonnage(sets, { weeks: 4, now });
    assert.deepEqual(w.values, [0, 0, 400, 1000]);
    assert.deepEqual(dailyLoads(sets).map((d) => [d.date, d.load]), [["2026-11-03", 400], ["2026-11-10", 1000]]);
  });
});

describe("body weight: EWMA, weekly rate, forecast", () => {
  it("EWMA starts at the first value, moves α of the gap per day and is gap-aware", () => {
    const flat = ewma([0, 1, 2, 3].map((d) => ({ at: MON + d * DAY_MS, value: 80 })));
    assert.ok(flat.every((p) => p.trend === 80));
    const step = ewma([{ at: MON, value: 80 }, { at: MON + DAY_MS, value: 80 }, { at: MON + 2 * DAY_MS, value: 81 }]);
    near(step[2].trend, 80.1, 1e-9);
    const gap = ewma([{ at: MON, value: 80 }, { at: MON + 7 * DAY_MS, value: 81 }]);
    near(gap[1].trend, 80 + (1 - 0.9 ** 7), 1e-9);
    assert.deepEqual(dailyMean([{ at: MON + 3600e3, value: 80 }, { at: MON + 7200e3, value: 81 }]).map((p) => [p.value, p.n]), [[80.5, 2]]);
  });

  it("weekly rate: Theil–Sen on the raw weigh-ins with a residual band", () => {
    const line = Array.from({ length: 28 }, (_, d) => ({ at: MON + d * DAY_MS, value: 90 - 0.1 * d }));
    const exact = weeklyRate(ewma(line));
    near(exact.kgPerWeek, -0.7, 1e-9);
    near(exact.band[0], -0.7, 1e-9);
    near(exact.band[1], -0.7, 1e-9);
    assert.equal(exact.reliable, true);
    // ±0.4 kg day-to-day noise (deterministic pattern), one +2 kg spike
    const noise = [0.3, -0.4, 0.1, 0.4, -0.2, -0.3, 0.2, 0.0, -0.4, 0.3, 0.1, -0.1, 0.4, -0.3];
    const noisy = line.map((p, d) => ({ ...p, value: p.value + noise[d % noise.length] + (d === 20 ? 2 : 0) }));
    const r = weeklyRate(ewma(noisy));
    assert.ok(r.band[0] < r.kgPerWeek && r.kgPerWeek < r.band[1]);
    assert.ok(r.band[0] < -0.7 && -0.7 < r.band[1], `band ${r.band} should contain the true −0.7`);
    near(r.pctPerWeek, (r.kgPerWeek / ewma(noisy).at(-1).trend) * 100, 1e-9);
    assert.equal(weeklyRate(ewma(line.slice(0, 2))), null);
    assert.equal(weeklyRate(ewma(line.slice(0, 5))).reliable, false, "5 days is not enough");
  });

  it("forecast: null under 4 points; the band brackets the line and widens; horizon capped at 2 × span", () => {
    assert.equal(forecast([1, 2, 3].map((d) => ({ at: MON + d * DAY_MS, value: 80 })), 30), null);
    assert.equal(forecast([0, 1, 2, 3].map((d) => ({ at: MON + d * DAY_MS, value: 80 - 0.1 * d + (d % 2 ? 0.2 : -0.2) })), 30)?.n, 4, "4 points are enough");
    const ten = Array.from({ length: 10 }, (_, d) => ({ at: MON + d * DAY_MS, value: 80 - 0.1 * d }));
    assert.equal(forecast(ten, 30, { windowDays: 2.5 }), null, "3 points inside the window");
    assert.equal(forecast([...ten.slice(0, 3), { at: Number.NaN, value: 80 }, { at: MON + 5 * DAY_MS, value: Number.NaN }], 30), null, "invalid points do not count");
    const noise = [0.3, -0.4, 0.1, 0.4, -0.2, -0.3, 0.2, 0.0, -0.4, 0.3];
    const pts = Array.from({ length: 21 }, (_, d) => ({ at: MON + d * DAY_MS, value: 90 - 0.08 * d + noise[d % 10] }));
    const fc = forecast(pts, 120);
    assert.ok(fc);
    assert.equal(fc.horizonDays, 40, "2 × 20 days of data");
    for (let i = 0; i < fc.line.length; i++) assert.ok(fc.band[i].lo <= fc.line[i].value && fc.line[i].value <= fc.band[i].hi);
    const width = (b) => b.hi - b.lo;
    assert.ok(width(fc.band.at(-1)) > width(fc.band[0]) * 2);
    assert.ok(fc.slopeCI[0] < fc.slope && fc.slope < fc.slopeCI[1]);
    const ttt = timeToTarget(fc, 88);
    assert.equal(ttt.status, "on-track");
    assert.ok(ttt.earliestDays < ttt.days && ttt.days < ttt.latestDays);
    assert.equal(timeToTarget(fc, 89).status, "reached", "already below a target under the start");
    assert.equal(timeToTarget(fc, 95).status, "away", "target above the start while losing");
    assert.equal(timeToTarget(fc, 70).status, "beyond");
    const rising = forecast(pts.map((p, d) => ({ ...p, value: 80 + 0.08 * d + noise[d % 10] })), 30);
    assert.equal(timeToTarget(rising, 75).status, "away");
  });
});

describe("Theil–Sen", () => {
  it("ignores outliers that drag least squares", () => {
    const pts = Array.from({ length: 10 }, (_, x) => ({ x, y: 2 * x + 1 + (x === 3 ? 50 : x === 7 ? -40 : 0) }));
    const ts = theilSen(pts);
    assert.equal(ts.slope, 2);
    assert.equal(ts.intercept, 1);
    assert.equal(ts.method, "exact");
    assert.ok(ts.slopeCI[0] <= 2 && 2 <= ts.slopeCI[1]);
    assert.ok(ts.coverage >= 0.95);
    // least squares for comparison
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p.x, 0) / n;
    const my = pts.reduce((a, p) => a + p.y, 0) / n;
    const ols = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
    assert.ok(Math.abs(ols - 2) > 1, `OLS slope ${ols} is dragged`);
  });

  it("exact Kendall critical values: n = 6 → ranks 2 and 14 of 15 (98.3 %); n = 4 cannot reach 95 %", () => {
    const pts = [0, 1, 2, 3, 4, 5].map((x) => ({ x, y: x * x }));
    const ts = theilSen(pts);
    const slopes = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) slopes.push((pts[j].y - pts[i].y) / (pts[j].x - pts[i].x));
    slopes.sort((a, b) => a - b);
    assert.deepEqual(ts.slopeCI, [slopes[1], slopes[13]]);
    near(ts.coverage, 1 - 2 * (6 / 720), 1e-12);
    assert.equal(theilSen(pts.slice(0, 4)).slopeCI, null);
    const ninety = theilSen(pts.slice(0, 4), { confidence: 0.9 });
    near(ninety.coverage, 1 - 2 / 24, 1e-12);
    assert.equal(theilSen([{ x: 1, y: 1 }, { x: 1, y: 2 }]), null);
  });

  it("switches to the normal approximation above 40 points and still covers the truth", () => {
    const noise = [0.3, -0.4, 0.1, 0.4, -0.2, -0.3, 0.2, 0.0, -0.4, 0.3, 0.1];
    const pts = Array.from({ length: 60 }, (_, x) => ({ x, y: 0.5 * x + noise[x % 11] }));
    const ts = theilSen(pts);
    assert.equal(ts.method, "normal");
    assert.ok(ts.slopeCI[0] < 0.5 && 0.5 < ts.slopeCI[1]);
  });

  it("t quantiles match the table", () => {
    near(tQuantile(0.975, 1), 12.706, 0.001);
    near(tQuantile(0.975, 2), 4.303, 0.001);
    near(tQuantile(0.975, 5), 2.571, 0.003);
    near(tQuantile(0.975, 30), 2.042, 0.001);
  });
});

describe("strength trend, PRs, plateau", () => {
  const weekly = (n, pct) => Array.from({ length: n }, (_, i) => ({ at: MON + i * 7 * DAY_MS, kg: 60 * (1 + pct / 100) ** i, reliable: true }));

  it("collects until 5 sessions over 3 weeks, then gives %/week with a band", () => {
    assert.equal(e1rmTrend(weekly(4, 1)).status, "collecting");
    const t = e1rmTrend(weekly(8, 1));
    assert.equal(t.status, "ok");
    near(t.pctPerWeek, 1, 1e-9);
    assert.ok(t.ci && t.ci[0] <= 1 && 1 <= t.ci[1]);
    assert.ok(t.band.every((b, i) => b.lo < t.line[i].kg && t.line[i].kg < b.hi));
    near(t.band[0].hi / t.line[0].kg, Math.exp(1.96 * 0.04), 1e-9, "the 4 % noise floor");
    assert.equal(e1rmTrend(weekly(6, 1)).ci, null, "no CI below 8 points");
  });

  it("PRs: baselines first, then e1RM, load and real rep records", () => {
    const sets = [
      set({ sessionId: "w1", at: local(2026, 11, 9), kg: 50, reps: 10, rir: 0 }),
      set({ sessionId: "w1", at: local(2026, 11, 9), kg: 55, reps: 6, rir: 0 }),
      set({ sessionId: "w2", at: local(2026, 11, 16), kg: 50, reps: 12, rir: 0 }), // rep PR at 50 (and e1RM PR)
      set({ sessionId: "w3", at: local(2026, 11, 23), kg: 57.5, reps: 5, rir: 0 }), // load PR
      set({ sessionId: "w4", at: local(2026, 11, 30), kg: 45, reps: 12, rir: 0 }), // dominated by 50 × 12: no rep PR
    ];
    assert.equal(prs(sets.slice(0, 2)).length, 0, "the first session only sets baselines");
    const ev = prs(sets);
    const kinds = ev.map((e) => `${e.kind}@${dayKey(e.at)}`);
    assert.ok(kinds.includes("reps@2026-11-16"));
    assert.ok(kinds.includes("e1rm@2026-11-16"));
    assert.ok(kinds.includes("load@2026-11-23"));
    assert.ok(!kinds.some((k) => k.endsWith("2026-11-30")));
    const rep = ev.find((e) => e.kind === "reps");
    assert.deepEqual([rep.value, rep.previous, rep.kg], [12, 10, 50]);
    const best = bestRecords(sets)[0];
    assert.equal(best.heaviest.kg, 57.5);
    assert.equal(best.sessions, 4);
  });

  it("plateau: counts sessions since the last confirmed best (+2.5 % or two above)", () => {
    const s = (kgs) => kgs.map((kg, i) => ({ at: MON + i * 7 * DAY_MS, kg, reliable: true }));
    const p = plateau(s([60, 62, 64, 64.5, 64, 64.2, 63.9]));
    assert.equal(p.best, 64);
    assert.equal(p.since, 4);
    assert.equal(p.flag, true);
    near(p.falseAlarm, 0.65 ** 4, 1e-12);
    assert.equal(plateau(s([60, 62, 64, 64.5, 64.6])).since, 0, "two sessions above the best confirm it");
    assert.equal(plateau(s([60])), null);
    assert.equal(plateau(s([60, 61, 62, 63, 64]), { sessions: 4 }).flag, false);
  });
});

describe("fitness–fatigue and ACWR", () => {
  it("Banister: one session makes you worse for ~6 days, better after, best at ~21 days", () => {
    const days = banister([{ date: "2026-11-09", load: 100 }], { until: local(2026, 12, 31) });
    assert.equal(days[0].performance, 0);
    near(days[1].performance, 100 - 200, 1e-9);
    const firstPositive = days.findIndex((d, i) => i > 0 && d.performance > 0);
    assert.equal(firstPositive, 7, "net effect turns positive after 5.8 days");
    const peak = days.reduce((best, d, i) => (d.performance > days[best].performance ? i : best), 0);
    assert.equal(peak, 22, "peak 20.9 days after the day it acts");
    for (let i = peak + 1; i < days.length; i++) assert.ok(days[i].performance < days[i - 1].performance);
    near(days[10].fitness / days[9].fitness, Math.exp(-1 / 42), 1e-12);
    const { tn, tg } = banisterTiming();
    near(tn, 5.82, 0.01);
    near(tg, 20.87, 0.01);
  });

  it("daily grid fills rest days with zero", () => {
    const g = dailyGrid([{ date: "2026-11-09", load: 5 }, { date: "2026-11-12", load: 7 }]);
    assert.deepEqual(g.map((d) => d.load), [5, 0, 0, 7]);
    assert.deepEqual(dailyGrid([]), []);
  });

  it("ACWR: hidden during warm-up, → 1 under a steady load, flags a spike", () => {
    const steady = Array.from({ length: 120 }, (_, i) => ({ date: dayKey(MON + i * DAY_MS), load: 100 }));
    const r = acwrEwma(steady);
    assert.equal(r[49].ratio, null);
    assert.ok(r[50].ratio != null);
    near(r[119].ratio, 1, 0.01);
    assert.equal(r[119].zone, "steady");
    const spike = [...steady, ...Array.from({ length: 7 }, (_, i) => ({ date: dayKey(MON + (120 + i) * DAY_MS), load: 300 }))];
    const s = acwrEwma(spike);
    assert.ok(s.at(-1).ratio >= 1.5);
    assert.equal(s.at(-1).zone, "spike");
    const coupled = acwrEwma(spike, { uncoupled: false });
    assert.ok(coupled.at(-1).ratio < s.at(-1).ratio, "coupling hides part of the ramp");
  });
});

describe("adherence", () => {
  const sess = (t, status = "finished") => ({ startedAt: new Date(t).toISOString(), status });

  it("planned vs done per week, no 'missed' before the first session, streak from the last complete week", () => {
    const now = local(2026, 11, 25, 12); // Wednesday, week of 23 Nov
    const sessions = [
      // week of 2 Nov: 3 sessions (met)
      sess(local(2026, 11, 2)), sess(local(2026, 11, 4)), sess(local(2026, 11, 6)),
      // week of 9 Nov: 3 (one auto-closed) + 1 abandoned
      sess(local(2026, 11, 9)), sess(local(2026, 11, 11), "auto_closed"), sess(local(2026, 11, 13)), sess(local(2026, 11, 14), "abandoned"),
      // week of 16 Nov: 2 (missed one)
      sess(local(2026, 11, 16)), sess(local(2026, 11, 18)),
      // this week: 1 so far
      sess(local(2026, 11, 23)),
    ];
    const a = adherence(sessions, { weeks: 12, daysPerWeek: 3, now });
    assert.equal(a.weeks.length, 12);
    const byKey = Object.fromEntries(a.weeks.map((w) => [w.key, w]));
    assert.equal(byKey["2026-10-26"].beforeStart, true);
    assert.equal(byKey["2026-10-26"].planned, 0);
    assert.equal(byKey["2026-11-09"].done, 3, "abandoned does not count");
    assert.equal(byKey["2026-11-16"].missed, 1);
    assert.equal(byKey["2026-11-23"].current, true);
    assert.equal(byKey["2026-11-23"].missed, 0, "the current week is not missed yet");
    assert.equal(a.streak, 0, "last complete week (16 Nov) was not met");
    assert.equal(a.totalPlanned, 9);
    assert.equal(a.totalDone, 8);
    near(a.rate, 8 / 9, 1e-12);
    assert.deepEqual(a.thisWeek, { done: 1, planned: 3 });
    assert.equal(a.daysSinceLast, 2);
    const today = byKey["2026-11-23"].days.find((d) => d.today);
    assert.equal(today.date, "2026-11-25");
    assert.equal(byKey["2026-11-23"].days[6].future, true);
  });

  it("the streak counts met weeks back and the current week extends it once met", () => {
    const now = local(2026, 11, 26, 20);
    const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"];
    const sessions = weeks.flatMap((k) => [0, 2, 3].map((d) => sess(new Date(...k.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))).getTime() + d * DAY_MS + 18 * 3600e3)));
    assert.equal(adherence(sessions, { now }).streak, 4);
    assert.equal(adherence(sessions.slice(0, -1), { now }).streak, 3, "an unfinished current week does not break it");
    assert.equal(adherence([], { now }).streak, 0);
    assert.equal(adherence([], { now }).rate, null);
  });

  it("week grid: 8 Monday-weeks ending with the current one", () => {
    const g = weekGrid(8, local(2026, 11, 8, 23)); // Sunday
    assert.equal(g.at(-1).key, "2026-11-02");
    assert.equal(g[0].key, "2026-09-14");
  });

  it("weeks and days start at local midnight even where DST starts at midnight (Cuba, Chile, Egypt, Lebanon)", () => {
    // Havana skips 00:00–01:00 on Sunday 8 March 2026: that day starts at 01:00, its Monday still at 00:00
    const code = `
      import { adherence, dailyGrid, startOfWeek, weekGrid, weeklyVolumeByGroup } from ${JSON.stringify(new URL("../../src/lib/fitness/analytics.mjs", import.meta.url).href)};
      const sun = new Date(2026, 2, 8, 12).getTime();
      const monday = new Date(startOfWeek(sun));
      const early = new Date(2026, 2, 2, 0, 30).getTime();
      const set = { id: "x", sessionId: "s", slotId: "A1", exerciseId: "e", setIndex: 0, kind: "working", plannedKg: 50, plannedReps: 10, kg: 50, reps: 10, rir: 2, doneAt: new Date(early).toISOString(), updatedAt: "" };
      const g = weekGrid(2, sun);
      const a = adherence([{ startedAt: new Date(early).toISOString(), status: "finished" }], { weeks: 2, now: sun });
      console.log(JSON.stringify({
        monday: [monday.getDay(), monday.getHours(), monday.getMinutes()],
        contiguous: g[0].end === g[1].start,
        hard: weeklyVolumeByGroup([set], () => ({ primary: ["m"] }), () => "chest", { weeks: 2, now: sun }).hard,
        days: dailyGrid([{ date: "2026-03-08", load: 5 }, { date: "2026-03-10", load: 7 }]).map((d) => d.load),
        today: a.weeks[1].days.filter((d) => d.today).map((d) => d.date),
        done: a.weeks.map((w) => w.done),
      }));`;
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, TZ: "America/Havana" }, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), {
      monday: [1, 0, 0],
      contiguous: true,
      hard: [0, 1], // a set at 00:30 on Monday belongs to that Monday's week
      days: [5, 0, 7], // a grid that starts on the short day keeps its last day
      today: ["2026-03-08"],
      done: [0, 1],
    });
  });
});
