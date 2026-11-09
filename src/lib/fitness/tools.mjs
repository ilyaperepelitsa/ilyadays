/**
 * Load calculator for /fitness/tools (master-owned). Pure: no DOM, no store.
 * One-rep max from a set you did, the load for any other reps × reps-in-reserve rounded to what the machine can do,
 * and plates per side. It uses the engine's e1RM definition (progression.mjs: mean of Epley and Brzycki) and the
 * planner's load fraction (the same equations up to 12 total reps, the %1RM table above), so the plan, the progress
 * charts and this calculator always give the same numbers.
 * @typedef {import("./types").Exercise} Exercise
 * @typedef {import("./types").Gym} Gym
 * @typedef {import("./types").LoggedSet} LoggedSet
 */
import { e1rmOf, incrementFor, isAssisted, loadFraction, roundLoad, warmupRamp } from "./progression.mjs";

/** Rep targets shown in the table. */
export const TABLE_REPS = Object.freeze([1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20]);
/** Reps-in-reserve columns: 0 = to failure. */
export const TABLE_RIR = Object.freeze([0, 1, 2, 3]);
/** A common gym plate set (kg). */
export const PLATES_KG = Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25]);
/** Bar choices: Olympic, women's, technique/EZ bar, and 0 for plate-loaded machines (plates only). */
export const BARS_KG = Object.freeze([20, 15, 10, 0]);
/** Linear e1RM equations lose validity past ~12 total reps (research/02 §A). */
export const RELIABLE_TOTAL_REPS = 12;

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Whether the calculator applies: counted in reps, with an external load or machine assistance.
 * Bodyweight-only, band, timed and distance exercises are left out.
 * @param {Exercise | null | undefined} exercise
 */
export function calculable(exercise) {
  if (!exercise) return false;
  if ((exercise.repUnit ?? "reps") !== "reps") return false;
  return exercise.equipment !== "bodyweight" && exercise.equipment !== "band";
}

/**
 * @typedef {{ rir: number, kg: number | null, exactKg: number, reliable: boolean, unassisted?: boolean }} LoadCell
 *   kg: rounded to the exercise's step (assistance for assisted machines); null when the load would be ≤ 0.
 *   unassisted: an assisted exercise whose target needs no assistance at all (add weight instead).
 * @typedef {{ reps: number, pct: number, cells: LoadCell[] }} LoadRow  pct: % of 1RM for that many reps to failure (loadFraction)
 * @typedef {{ ok: true, e1rm: number, reliable: boolean, assisted: boolean, step: number, effectiveKg: number, rows: LoadRow[] }
 *   | { ok: false, reason: "invalid" | "bodyweight" }} LoadTable
 */

/**
 * One-rep max from a set and the loads for other targets.
 * @param {{ kg: number, reps: number, rir?: number | null }} set the set you did (kg = assistance on assisted machines)
 * @param {{ exercise?: Exercise | null, gym?: Gym | null, bodyweightKg?: number | null,
 *           reps?: readonly number[], rirs?: readonly number[] }} [opts]
 * @returns {LoadTable}
 */
export function loadTable(set, { exercise = null, gym = null, bodyweightKg = null, reps = TABLE_REPS, rirs = TABLE_RIR } = {}) {
  const kg = Number(set?.kg);
  const done = Number(set?.reps);
  const rir = set?.rir == null ? 0 : Number(set.rir);
  if (!Number.isFinite(kg) || kg < 0 || !Number.isInteger(done) || done < 1 || done > 50) return { ok: false, reason: "invalid" };
  if (!Number.isFinite(rir) || rir < 0 || rir > 10) return { ok: false, reason: "invalid" };
  const assisted = exercise ? isAssisted(exercise) : false;
  const bw = typeof bodyweightKg === "number" && bodyweightKg > 0 ? bodyweightKg : null;
  if (assisted && !bw) return { ok: false, reason: "bodyweight" };
  const effective = assisted && bw ? bw - kg : kg;
  if (!(effective > 0)) return { ok: false, reason: "invalid" };
  const { kg: e1rm, reliable } = e1rmOf(effective, done, rir);
  const step = exercise ? incrementFor(exercise, gym) : 0;
  /** @param {number} x */
  const round = (x) => (exercise ? roundLoad(x, exercise, gym, "nearest") : Math.round(x * 2) / 2);
  const rows = reps.map((n) => ({
    reps: n,
    pct: Math.round(1000 * loadFraction(n)) / 10,
    cells: rirs.map((q) => {
      const needed = e1rm * loadFraction(n + q); // effective load for n reps at q in reserve, as the planner computes it
      const reliableCell = n + q <= RELIABLE_TOTAL_REPS;
      if (assisted && bw) {
        const assistance = bw - needed;
        if (assistance <= 0) return { rir: q, kg: 0, exactKg: 0, reliable: reliableCell, unassisted: true };
        return { rir: q, kg: round(assistance), exactKg: r2(assistance), reliable: reliableCell };
      }
      return { rir: q, kg: needed > 0 ? round(needed) : null, exactKg: r2(Math.max(0, needed)), reliable: reliableCell };
    }),
  }));
  return { ok: true, e1rm: r2(e1rm), reliable, assisted, step, effectiveKg: r2(effective), rows };
}

/**
 * Plates for each side of a bar or a plate-loaded machine: the exact load with the fewest plates when the plate set
 * allows it, otherwise the heaviest load below the target.
 * @param {number} totalKg target total, bar included
 * @param {{ barKg?: number, plates?: readonly number[] }} [opts]
 * @returns {{ ok: true, perSide: number[], loadedKg: number, exact: boolean, missingKg: number }
 *   | { ok: false, reason: "invalid" | "below-bar" }}
 */
export function platesPerSide(totalKg, { barKg = 20, plates = PLATES_KG } = {}) {
  const total = Number(totalKg);
  if (!Number.isFinite(total) || total <= 0 || !(Number.isFinite(barKg) && barKg >= 0) || total > 1000) return { ok: false, reason: "invalid" };
  if (total < barKg) return { ok: false, reason: "below-bar" };
  const UNIT = 0.05; // kg; every common plate is a multiple
  const sizes = [...new Set(plates.filter((p) => Number.isFinite(p) && p > 0).map((p) => Math.round(p / UNIT)))].sort((a, b) => b - a);
  const side = Math.floor((total - barKg) / 2 / UNIT + 1e-6);
  // fewest[n]: fewest plates that make exactly n units (-1: impossible); last[n]: the plate added last
  const fewest = new Int32Array(side + 1).fill(-1);
  const last = new Int32Array(side + 1);
  fewest[0] = 0;
  for (let n = 1; n <= side; n += 1) {
    for (const s of sizes) {
      if (s > n || fewest[n - s] < 0) continue;
      if (fewest[n] < 0 || fewest[n - s] + 1 < fewest[n]) {
        fewest[n] = fewest[n - s] + 1;
        last[n] = s;
      }
    }
  }
  let n = side;
  while (n > 0 && fewest[n] < 0) n -= 1;
  /** @type {number[]} */
  const perSide = [];
  for (let m = n; m > 0; m -= last[m]) perSide.push(r2(last[m] * UNIT));
  perSide.sort((a, b) => b - a);
  const loadedKg = r2(barKg + 2 * n * UNIT);
  return { ok: true, perSide, loadedKg, exact: Math.abs(loadedKg - total) < 1e-6, missingKg: r2(total - loadedKg) };
}

/**
 * Warm-up sets before a working set (the engine's ramp: none for bodyweight, holds and carries).
 * @param {number} workingKg @param {Exercise} exercise
 * @param {{ gym?: Gym | null, bodyweightKg?: number | null, e1rm?: number | null, targetReps?: number, rir?: number }} [opts]
 */
export function warmupFor(workingKg, exercise, { gym = null, bodyweightKg = null, e1rm = null, targetReps, rir } = {}) {
  if (!exercise || !(workingKg >= 0)) return [];
  return warmupRamp(workingKg, exercise, e1rm, { gym, bodyweightKg, targetReps, rir });
}

/**
 * The most recent completed working (or AMRAP / back-off) set of an exercise: what "use my last set" fills in.
 * @param {readonly LoggedSet[]} sets @param {string} exerciseId
 * @returns {LoggedSet | null}
 */
export function lastWorkingSet(sets, exerciseId) {
  let best = null;
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.kind === "warmup" || !(s.reps >= 1)) continue;
    if (!best || s.doneAt > best.doneAt) best = s;
  }
  return best;
}
