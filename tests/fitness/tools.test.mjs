// Load calculator (src/lib/fitness/tools.mjs): e1RM table, rounding to the machine, assisted machines, plates.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exerciseById } from "../../src/lib/fitness/catalog.mjs";
import { e1rmOf, loadForE1rm, loadFraction } from "../../src/lib/fitness/progression.mjs";
import { e1rm as analyticsE1rm } from "../../src/lib/fitness/analytics.mjs";
import { calculable, lastWorkingSet, loadTable, platesPerSide, warmupFor, TABLE_REPS } from "../../src/lib/fitness/tools.mjs";

const chestPress = exerciseById("machine-chest-press");
const assisted = exerciseById("assisted-pull-up");

const cell = (table, reps, rir) => {
  assert.equal(table.ok, true);
  return table.rows.find((r) => r.reps === reps).cells.find((c) => c.rir === rir);
};

describe("loadTable", () => {
  it("gives back the set itself and agrees with the engine and the charts", () => {
    const t = loadTable({ kg: 100, reps: 5, rir: 0 });
    assert.equal(t.ok, true);
    assert.equal(t.e1rm, e1rmOf(100, 5, 0).kg);
    assert.ok(Math.abs(t.e1rm - analyticsE1rm(100, 5, 0).kg) < 0.01, "same e1RM as the progress charts");
    assert.equal(cell(t, 5, 0).exactKg, 100);
    assert.equal(cell(t, 5, 0).kg, 100);
  });

  it("treats reps in reserve as extra reps: 5 reps at RIR 2 is the load for 7 reps to failure", () => {
    const t = loadTable({ kg: 80, reps: 8, rir: 1 }, { reps: [7, 5], rirs: [0, 2] });
    assert.equal(cell(t, 5, 2).exactKg, cell(t, 7, 0).exactKg);
    assert.equal(cell(t, 7, 0).exactKg, Math.round(loadForE1rm(e1rmOf(80, 8, 1).kg, 7, 0) * 100) / 100);
  });

  it("is monotonic: more reps or more reserve means less weight", () => {
    const t = loadTable({ kg: 60, reps: 10, rir: 2 });
    for (const row of t.rows) for (let i = 1; i < row.cells.length; i += 1) assert.ok(row.cells[i].exactKg < row.cells[i - 1].exactKg);
    for (let i = 1; i < t.rows.length; i += 1) assert.ok(t.rows[i].cells[0].exactKg < t.rows[i - 1].cells[0].exactKg);
    assert.equal(t.rows[0].pct, 100);
    assert.ok(t.rows.every((r, i) => i === 0 || r.pct < t.rows[i - 1].pct));
  });

  it("rounds every load to the machine's step", () => {
    assert.equal(chestPress.increment, 5);
    const t = loadTable({ kg: 42.5, reps: 9, rir: 1 }, { exercise: chestPress });
    assert.equal(t.step, 5);
    for (const row of t.rows) for (const c of row.cells) assert.equal(c.kg % 5, 0, `${row.reps}×RIR${c.rir} → ${c.kg}`);
  });

  it("uses a gym's own increment when the gym overrides it", () => {
    const gym = { id: "g", name: "G", increments: { "machine-chest-press": 2.5 } };
    const t = loadTable({ kg: 50, reps: 8, rir: 2 }, { exercise: chestPress, gym });
    assert.equal(t.step, 2.5);
    for (const row of t.rows) for (const c of row.cells) assert.equal((c.kg * 2) % 5, 0);
  });

  it("marks estimates past 12 total reps as rough", () => {
    assert.equal(loadTable({ kg: 50, reps: 10, rir: 2 }).reliable, true);
    assert.equal(loadTable({ kg: 50, reps: 12, rir: 1 }).reliable, false);
    const t = loadTable({ kg: 50, reps: 8, rir: 0 });
    assert.equal(cell(t, 12, 0).reliable, true);
    assert.equal(cell(t, 12, 1).reliable, false);
    assert.equal(cell(t, 20, 0).reliable, false);
  });

  it("works on the lifted part for assisted machines: harder targets need less assistance", () => {
    const t = loadTable({ kg: 30, reps: 8, rir: 1 }, { exercise: assisted, bodyweightKg: 80 });
    assert.equal(t.ok, true);
    assert.equal(t.assisted, true);
    assert.equal(t.effectiveKg, 50);
    assert.equal(t.e1rm, e1rmOf(50, 8, 1).kg);
    assert.equal(cell(t, 8, 1).exactKg, 30);
    assert.ok(cell(t, 3, 0).exactKg < cell(t, 8, 1).exactKg, "fewer reps → less assistance");
    assert.ok(cell(t, 15, 2).exactKg > cell(t, 8, 1).exactKg, "more reps → more assistance");
    for (const row of t.rows) for (const c of row.cells) assert.equal(c.kg % 5, 0);
  });

  it("says when an assisted target needs no assistance at all", () => {
    const t = loadTable({ kg: 5, reps: 10, rir: 0 }, { exercise: assisted, bodyweightKg: 80 });
    const single = cell(t, 1, 0);
    assert.equal(single.unassisted, true);
    assert.equal(single.kg, 0);
  });

  it("asks for body weight on assisted machines and rejects nonsense", () => {
    assert.deepEqual(loadTable({ kg: 30, reps: 8 }, { exercise: assisted }), { ok: false, reason: "bodyweight" });
    assert.deepEqual(loadTable({ kg: 90, reps: 8 }, { exercise: assisted, bodyweightKg: 80 }), { ok: false, reason: "invalid" });
    for (const set of [{ kg: 0, reps: 5 }, { kg: -5, reps: 5 }, { kg: 50, reps: 0 }, { kg: 50, reps: 2.5 }, { kg: Number.NaN, reps: 5 }, { kg: 50, reps: 5, rir: -1 }]) {
      assert.equal(loadTable(set).ok, false, JSON.stringify(set));
    }
  });

  it("inverts exactly: the table gives back the set's own load at its own reps", () => {
    for (const reps of [1, 3, 6, 10, 12]) {
      const t = loadTable({ kg: 70, reps, rir: 0 }, { reps: TABLE_REPS });
      assert.ok(Math.abs(cell(t, reps, 0).exactKg - 70) < 0.02, `${reps} reps: ${cell(t, reps, 0).exactKg}`);
      const back = e1rmOf(loadForE1rm(t.e1rm, reps, 0), reps, 0).kg;
      assert.ok(Math.abs(back - t.e1rm) < 0.02);
    }
  });

  it("uses the planner's %1RM table above 12 total reps, not the equations", () => {
    const t = loadTable({ kg: 50, reps: 8, rir: 1 });
    const e1rm = e1rmOf(50, 8, 1).kg;
    assert.equal(t.e1rm, e1rm);
    // 15 reps at RIR 2 = 17 total: 63.0 % from the table, against 59.4 % from the Epley/Brzycki inverse
    assert.equal(cell(t, 15, 2).exactKg, Math.round(e1rm * loadFraction(17) * 100) / 100);
    assert.ok(cell(t, 15, 2).exactKg - loadForE1rm(e1rm, 15, 2) > 1.5);
    // up to 12 total reps both agree
    assert.equal(cell(t, 10, 2).exactKg, Math.round(loadForE1rm(e1rm, 10, 2) * 100) / 100);
    assert.equal(t.rows.find((r) => r.reps === 20).pct, 60);
    assert.equal(t.rows.find((r) => r.reps === 12).pct, 70.4);
  });
});

describe("platesPerSide", () => {
  it("loads 100 kg on an Olympic bar as 25 + 15 per side", () => {
    assert.deepEqual(platesPerSide(100), { ok: true, perSide: [25, 15], loadedKg: 100, exact: true, missingKg: 0 });
  });

  it("uses the fewest plates and handles small plates", () => {
    assert.deepEqual(platesPerSide(142.5).perSide, [25, 25, 10, 1.25]);
    assert.deepEqual(platesPerSide(20).perSide, []);
    assert.equal(platesPerSide(20).exact, true);
  });

  it("finds exact loads a greedy choice would miss", () => {
    const r = platesPerSide(60, { plates: [25, 20] });
    assert.deepEqual(r.perSide, [20]);
    assert.equal(r.exact, true);
    const s = platesPerSide(100, { plates: [25, 20] });
    assert.deepEqual(s.perSide, [20, 20]);
    assert.equal(s.exact, true);
  });

  it("falls back to the heaviest load below the target", () => {
    const r = platesPerSide(61.25);
    assert.equal(r.exact, false);
    assert.equal(r.loadedKg, 60);
    assert.equal(r.missingKg, 1.25);
  });

  it("supports plate-loaded machines (no bar) and lighter bars", () => {
    assert.deepEqual(platesPerSide(90, { barKg: 0 }).perSide, [25, 20]);
    assert.deepEqual(platesPerSide(35, { barKg: 15 }).perSide, [10]);
  });

  it("rejects loads below the bar and nonsense", () => {
    assert.deepEqual(platesPerSide(15), { ok: false, reason: "below-bar" });
    for (const x of [0, -10, Number.NaN, 5000]) assert.equal(platesPerSide(x).ok, false);
    assert.equal(platesPerSide(50, { barKg: -1 }).ok, false);
  });
});

describe("calculable, warmupFor and lastWorkingSet", () => {
  it("covers loaded rep exercises only", () => {
    assert.equal(calculable(chestPress), true);
    assert.equal(calculable(assisted), true);
    assert.equal(calculable(exerciseById("farmers-carry")), false, "metres");
    assert.equal(calculable(exerciseById("captains-chair-knee-raise")), false, "bodyweight");
    assert.equal(calculable(null), false);
  });

  it("returns the engine's warm-up ramp: lighter, increasing, rounded", () => {
    const ramp = warmupFor(60, chestPress, { e1rm: 70 });
    assert.ok(ramp.length >= 1);
    for (let i = 0; i < ramp.length; i += 1) {
      assert.equal(ramp[i].kind, "warmup");
      assert.ok(ramp[i].weightKg < 60);
      assert.equal(ramp[i].weightKg % 5, 0);
      if (i) assert.ok(ramp[i].weightKg > ramp[i - 1].weightKg);
    }
    assert.deepEqual(warmupFor(60, null), []);
  });

  it("picks the latest non-warm-up set of the exercise", () => {
    const base = { sessionId: "s", slotId: "A1", setIndex: 0, plannedKg: 40, plannedReps: 8, rir: 2, updatedAt: "2026-11-10T10:00:00Z" };
    const sets = [
      { ...base, id: "1", exerciseId: "machine-chest-press", kind: "working", kg: 40, reps: 8, doneAt: "2026-11-10T10:00:00Z" },
      { ...base, id: "2", exerciseId: "machine-chest-press", kind: "warmup", kg: 20, reps: 8, doneAt: "2026-11-12T10:00:00Z" },
      { ...base, id: "3", exerciseId: "machine-chest-press", kind: "working", kg: 45, reps: 7, doneAt: "2026-11-12T10:05:00Z" },
      { ...base, id: "4", exerciseId: "pec-deck", kind: "working", kg: 30, reps: 12, doneAt: "2026-11-13T10:00:00Z" },
    ];
    assert.equal(lastWorkingSet(sets, "machine-chest-press").id, "3");
    assert.equal(lastWorkingSet(sets, "lat-pulldown"), null);
  });
});
