// @ts-check
/**
 * Progress analytics (stream 06 — plans/fitness/06-progress-analytics.md). Formulas, defaults and sources:
 * plans/fitness/research/07-analytics-and-models.md, cited below as "R07 §section [ref]".
 *
 * Pure and import-free: no DOM, no storage and no catalog JSON — callers pass the exercise facts they have — so the
 * progress page does not bundle the exercise catalog. Times are epoch ms, ISO strings or Dates; "days" are local
 * calendar days; weeks start on Monday.
 */

/** @typedef {import("./types").LoggedSet} LoggedSet */
/** @typedef {import("./types").Session} Session */
/** @typedef {number | string | Date} TimeLike */
/** @typedef {{ x: number, y: number }} XY */
/**
 * What analytics needs to know about an exercise: a structural subset of `Exercise`, so a catalog entry works too.
 * @typedef {object} ExerciseFacts
 * @property {string} [id]
 * @property {string} [equipment]
 * @property {boolean} [assistance]
 * @property {string} [pattern]
 * @property {string} [repUnit]  "reps" (default) | "seconds" | "meters"
 * @property {string[]} [primary]  muscle ids
 * @property {string[]} [secondary]
 * @property {Record<string, number>} [groups]  pre-weighted coarse groups (1 direct, 0.5 indirect); wins over muscles
 */
/** @typedef {(set: LoggedSet) => number | null} LoadOf  effective kg of a set, null when unknown */
/** @typedef {(set: LoggedSet) => number} TimeOf  epoch ms a set belongs to (session start, or the set time) */
/** @typedef {(exerciseId: string) => string} UnitOf  "reps" | "seconds" | "meters" */

export const DAY_MS = 86_400_000;
/** A hard set stops at most this many reps short of failure (R07 §B, Pelland et al. 2025 [14]). */
export const HARD_SET_RIR_MAX = 4;
/** e1RM equations lose validity beyond 10–12 total reps (R07 §A rule E1, Reynolds et al. 2006 [2]). */
export const RELIABLE_TOTAL_REPS = 12;
/** Weekly fractional hard sets per muscle group, hypertrophy range for priority muscles (R07 §B [14][15]). */
export const TARGET_SETS_PER_WEEK = /** @type {const} */ ([10, 20]);
/** EWMA smoothing of the body-weight trend, per day (Hacker's Diet, R07 §E [38]). */
export const WEIGHT_ALPHA = 0.1;
/** ACWR zones (R07 §D): heuristics from team sports, no causal evidence [36][37]. */
export const ACWR_ZONES = /** @type {const} */ ({ dip: 0.8, steady: 1.3, ramping: 1.5 });

const HARD_KINDS = new Set(["working", "backoff", "amrap"]);

/* ------------------------------------------------------------------ time */

/** @param {TimeLike | null | undefined} t @returns {number} epoch ms, NaN when invalid */
export function toMs(t) {
  if (t == null) return NaN;
  if (t instanceof Date) return t.getTime();
  if (typeof t === "number") return t;
  return Date.parse(t);
}

/** @param {number} n */
const pad2 = (n) => String(n).padStart(2, "0");

/** Local calendar day "YYYY-MM-DD". @param {TimeLike} t */
export function dayKey(t) {
  const d = new Date(toMs(t));
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local midnight (ms) of the day containing `t`. @param {TimeLike} t */
export function dayStart(t) {
  const d = new Date(toMs(t));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight of a "YYYY-MM-DD" key. @param {string} key */
export function fromDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** `t` plus `n` calendar days (DST-safe). @param {TimeLike} t @param {number} n */
export function addDays(t, n) {
  const d = new Date(toMs(t));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/**
 * Monday 00:00 (local) of the week containing `t`. Midnight again after the step back: where DST starts at midnight
 * (Cuba, Chile, Egypt, Lebanon) that day begins at 01:00, and its Monday must not inherit the hour. @param {TimeLike} t
 */
export function startOfWeek(t) {
  const d = new Date(dayStart(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days from `a` to `b`. @param {TimeLike} a @param {TimeLike} b */
export const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY_MS);

/**
 * The last `weeks` Monday-weeks, oldest first; the last one contains `now`.
 * @param {number} weeks @param {TimeLike} now @returns {{ start: number, end: number, key: string }[]}
 */
export function weekGrid(weeks, now) {
  const current = startOfWeek(now);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = dayStart(addDays(current, -7 * i));
    out.push({ start, end: dayStart(addDays(start, 7)), key: dayKey(start) });
  }
  return out;
}

/** @param {{ start: number, end: number }[]} grid @param {number} t */
const weekIndexOf = (grid, t) => grid.findIndex((w) => t >= w.start && t < w.end);

/* ------------------------------------------------------------------ small statistics */

/** @param {number[]} sorted ascending */
function medianSorted(sorted) {
  const n = sorted.length;
  if (!n) return NaN;
  const h = n >> 1;
  return n % 2 ? sorted[h] : (sorted[h - 1] + sorted[h]) / 2;
}

/** @param {number[]} xs */
export const median = (xs) => medianSorted([...xs].sort((a, b) => a - b));

/** Value at a fractional 0-based index of a sorted array (linear interpolation). @param {number[]} s @param {number} i */
function atRank(s, i) {
  const lo = Math.max(0, Math.min(s.length - 1, Math.floor(i)));
  const hi = Math.max(0, Math.min(s.length - 1, Math.ceil(i)));
  return s[lo] + (s[hi] - s[lo]) * (i - Math.floor(i));
}

/**
 * Inverse standard normal CDF (Acklam's rational approximation, |relative error| < 1.2e-9).
 * @param {number} p
 */
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  /** @param {number} q */
  const tail = (q) => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Student-t quantile: exact for 1 and 2 degrees of freedom, Cornish–Fisher expansion above (Abramowitz & Stegun
 * 26.7.5; within 0.1 % of the table from 3 df at the 97.5 % point).
 * @param {number} p @param {number} df
 */
export function tQuantile(p, df) {
  if (!(df > 0)) return NaN;
  if (df === 1) return Math.tan(Math.PI * (p - 0.5));
  if (df === 2) return (2 * p - 1) / Math.sqrt(2 * p * (1 - p));
  const z = normalQuantile(p);
  const z2 = z * z;
  const z3 = z2 * z;
  const z5 = z3 * z2;
  const z7 = z5 * z2;
  const z9 = z7 * z2;
  return (
    z +
    (z3 + z) / (4 * df) +
    (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2) +
    (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3) +
    (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * df ** 4)
  );
}

/* ------------------------------------------------------------------ A. estimated 1RM */

/**
 * @typedef {object} E1rm
 * @property {number} kg  estimated one-repetition maximum
 * @property {boolean} reliable  total reps ≤ 12 and (when logged) RIR ≤ 4
 * @property {number} reps  effective (total) reps = reps + RIR
 * @property {number} sigmaRel  1-σ measurement noise as a fraction of `kg`
 * @property {string} formula
 */

/**
 * Estimated 1RM from one set (R07 §A). Effective reps T = reps + RIR (a set of r reps with RIR left is a set of
 * r + RIR reps to failure, the RIR-based RPE construction [7][12]); T ≤ 1 → the load itself. Epley `kg(1 + T/30)`,
 * Brzycki `36·kg/(37 − T)`, "blend" = their mean (they coincide at 10 reps and bracket the classic equations from 3
 * to 10 [1]); Epley alone from T ≥ 36 where Brzycki diverges — the same definition as stream 03's `e1rmOf`.
 * `reliable`: T ≤ 12 (linear equations lose validity past 10–12 reps [2]) and RIR ≤ 4 when logged (effort guesses
 * are off by more than a rep further from failure [8][11]). `sigmaRel` (rule E4): 1RM test–retest CV 3.3 % [4] ⊕ an
 * RIR error of 0.8 rep (each rep moves Epley by kg/30) [10]; +2 % above 10 reps, +3 % at RIR ≥ 4.
 * @param {number} kg load lifted (use the effective load for assisted / bodyweight exercises)
 * @param {number} reps
 * @param {number | null} [rir] reps in reserve; null/undefined = taken to failure (conservative)
 * @param {"blend" | "epley" | "brzycki"} [formula]
 * @returns {E1rm | null} null for kg ≤ 0 or reps < 1
 */
export function e1rm(kg, reps, rir = null, formula = "blend") {
  if (!(Number.isFinite(kg) && kg > 0) || !(Number.isFinite(reps) && reps >= 1)) return null;
  const extra = typeof rir === "number" && Number.isFinite(rir) && rir > 0 ? rir : 0;
  const t = reps + extra;
  const epley = kg * (1 + t / 30);
  const brzycki = t < 36 ? (kg * 36) / (37 - t) : epley;
  const value = t <= 1 ? kg : formula === "epley" ? epley : formula === "brzycki" ? brzycki : (epley + brzycki) / 2;
  const v = Math.max(value, kg);
  let sigmaRel = Math.hypot(0.033, (0.8 * kg) / 30 / v);
  if (t > 10) sigmaRel = Math.hypot(sigmaRel, 0.02);
  if (extra >= 4) sigmaRel = Math.hypot(sigmaRel, 0.03);
  return { kg: v, reliable: t <= RELIABLE_TOTAL_REPS && !(extra > HARD_SET_RIR_MAX), reps: t, sigmaRel, formula };
}

/* ------------------------------------------------------------------ effective loads */

/**
 * Share of body mass a bodyweight exercise moves; the logged kg of a bodyweight exercise is ADDED load. Pull-up,
 * chin-up and dip lift (almost) the whole body: 1.0, the convention stream 03's `effectiveKg` and Liftosaur's
 * bodyweight logic use (research/08 [21]). Push-ups: ≈ 64 % of body mass on the hands (Ebben WP, et al. Kinetic
 * analysis of several variations of push-ups. J Strength Cond Res 2011;25(10):2891–2894). Other bodyweight
 * exercises (core, inverted row, back extension …) are unknown: no e1RM rather than an invented number.
 * @type {Readonly<Record<string, number>>}
 */
export const BODYWEIGHT_FRACTION = Object.freeze({ "pull-up": 1, "chin-up": 1, dip: 1, "push-up": 0.64, "diamond-push-up": 0.64 });

/** Load is assistance (assisted pull-up/dip machines): a LOWER number is harder. @param {ExerciseFacts | null | undefined} ex */
export const isAssisted = (ex) => Boolean(ex && (ex.assistance === true || ex.equipment === "assisted"));

/**
 * @typedef {object} EffectiveLoad
 * @property {number} kg  the load the muscles move (0 when unknown)
 * @property {"external" | "assisted" | "bodyweight"} kind
 * @property {null | "no-bodyweight" | "unknown-fraction"} flag  why `kg` is 0, if it is unknown
 */

/**
 * The load the muscles actually move, for e1RM and tonnage. Assisted machines log the ASSISTANCE → body weight −
 * assistance (never below 0). Bodyweight exercises log ADDED load → fraction × body weight + added kg, with the
 * fraction from `BODYWEIGHT_FRACTION`, else 0 with `flag: "unknown-fraction"`. Without a body weight both give 0 with
 * `flag: "no-bodyweight"`. Anything else: the logged kg.
 * @param {{ kg: number }} set
 * @param {ExerciseFacts | null | undefined} exercise
 * @param {number | null | undefined} bodyweightKg
 * @returns {EffectiveLoad}
 */
export function effectiveLoad(set, exercise, bodyweightKg) {
  const logged = Number.isFinite(set?.kg) && set.kg > 0 ? set.kg : 0;
  const bw = typeof bodyweightKg === "number" && bodyweightKg > 0 ? bodyweightKg : null;
  if (isAssisted(exercise)) {
    return bw ? { kg: Math.max(0, bw - logged), kind: "assisted", flag: null } : { kg: 0, kind: "assisted", flag: "no-bodyweight" };
  }
  if (exercise?.equipment === "bodyweight") {
    const fraction = exercise.id ? BODYWEIGHT_FRACTION[exercise.id] : undefined;
    if (fraction == null) return { kg: 0, kind: "bodyweight", flag: "unknown-fraction" };
    if (!bw) return { kg: 0, kind: "bodyweight", flag: "no-bodyweight" };
    return { kg: fraction * bw + logged, kind: "bodyweight", flag: null };
  }
  return { kg: logged, kind: "external", flag: null };
}

/**
 * Body weight at a time: the latest weigh-in on or before it, else the earliest one after it, else `fallbackKg`.
 * @param {{ at: TimeLike, kg: number }[]} entries
 * @param {number | null} [fallbackKg]
 * @returns {(t: TimeLike) => number | null}
 */
export function bodyweightLookup(entries, fallbackKg = null) {
  const pts = entries
    .map((e) => ({ at: toMs(e.at), kg: e.kg }))
    .filter((p) => Number.isFinite(p.at) && p.kg > 0)
    .sort((a, b) => a.at - b.at);
  const fallback = typeof fallbackKg === "number" && fallbackKg > 0 ? fallbackKg : null;
  return (t) => {
    if (!pts.length) return fallback;
    const ms = toMs(t);
    if (!Number.isFinite(ms)) return pts[pts.length - 1].kg;
    let lo = 0;
    let hi = pts.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].at <= ms) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found >= 0 ? pts[found].kg : pts[0].kg;
  };
}

/** @type {LoadOf} */
const loggedLoad = (s) => (Number.isFinite(s.kg) && s.kg > 0 ? s.kg : null);
/** @type {TimeOf} */
const setTime = (s) => toMs(s.doneAt);
/** @type {UnitOf} */
const repsUnit = () => "reps";

/* ------------------------------------------------------------------ e1RM series */

/**
 * @typedef {object} SessionE1rm
 * @property {string} sessionId
 * @property {string} exerciseId
 * @property {number} at  epoch ms (earliest `timeOf` of the session's sets)
 * @property {number} kg  estimated 1RM
 * @property {boolean} reliable  false when only unreliable sets (> 12 total reps, RIR > 4) were available
 * @property {number} reps  effective reps of the best set
 * @property {number} weightKg  effective load of the best set
 * @property {string} setId
 * @property {number} sigmaRel
 * @property {number} sets  qualifying sets in the session
 */

/**
 * @typedef {object} SeriesOptions
 * @property {LoadOf} [loadOf]  effective load (default: the logged kg)
 * @property {TimeOf} [timeOf]  default: the set's doneAt
 * @property {UnitOf} [unitOf]  only "reps" exercises get an e1RM (holds and carries do not)
 * @property {"blend" | "epley" | "brzycki"} [formula]
 * @property {"best" | "mean"} [aggregate]  "best" set (default) or the precision-weighted mean of reliable sets (R07 E6)
 */

/**
 * One estimated 1RM per (session, exercise) from its non-warm-up sets: the best *reliable* set, falling back to the
 * best unreliable one (flagged) so a 20-rep set never inflates a session that also has a set of ≤ 12 reps.
 * @param {LoggedSet[]} sets @param {SeriesOptions} [opts] @returns {SessionE1rm[]} sorted by time
 */
export function sessionBestE1rm(sets, opts = {}) {
  const { loadOf = loggedLoad, timeOf = setTime, unitOf = repsUnit, formula = "blend", aggregate = "best" } = opts;
  /** @type {Map<string, { sessionId: string, exerciseId: string, at: number, est: { e: E1rm, set: LoggedSet, load: number }[] }>} */
  const groups = new Map();
  for (const s of sets) {
    if (s.kind === "warmup" || !(s.reps >= 1) || unitOf(s.exerciseId) !== "reps") continue;
    const load = loadOf(s);
    if (load == null || !(load > 0)) continue;
    const e = e1rm(load, s.reps, s.rir, formula);
    const at = timeOf(s);
    if (!e || !Number.isFinite(at)) continue;
    const key = `${s.sessionId}\u0000${s.exerciseId}`;
    let g = groups.get(key);
    if (!g) {
      g = { sessionId: s.sessionId, exerciseId: s.exerciseId, at, est: [] };
      groups.set(key, g);
    }
    if (at < g.at) g.at = at;
    g.est.push({ e, set: s, load });
  }
  /** @type {SessionE1rm[]} */
  const out = [];
  for (const g of groups.values()) {
    const reliable = g.est.filter((x) => x.e.reliable);
    const pool = reliable.length ? reliable : g.est;
    const best = pool.reduce((a, b) => (b.e.kg > a.e.kg ? b : a));
    let kg = best.e.kg;
    let sigmaRel = best.e.sigmaRel;
    if (aggregate === "mean" && pool.length > 1) {
      let w = 0;
      let sum = 0;
      for (const x of pool) {
        const sd = x.e.sigmaRel * x.e.kg;
        w += 1 / (sd * sd);
        sum += x.e.kg / (sd * sd);
      }
      kg = sum / w;
      sigmaRel = Math.sqrt(1 / w) / kg;
    }
    out.push({
      sessionId: g.sessionId,
      exerciseId: g.exerciseId,
      at: g.at,
      kg,
      reliable: best.e.reliable,
      reps: best.e.reps,
      weightKg: best.load,
      setId: best.set.id,
      sigmaRel,
      sets: g.est.length,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** @param {LoggedSet[]} sets @param {string} exerciseId @param {SeriesOptions} [opts] */
export const e1rmSeries = (sets, exerciseId, opts = {}) => sessionBestE1rm(sets.filter((s) => s.exerciseId === exerciseId), opts);

/* ------------------------------------------------------------------ B. volume */

/** Working, back-off or AMRAP set with ≥ 1 rep stopped ≤ `rirMax` reps short of failure (unknown RIR counts). @param {LoggedSet} s @param {number} [rirMax] */
export const isHardSet = (s, rirMax = HARD_SET_RIR_MAX) => HARD_KINDS.has(s.kind) && s.reps >= 1 && (s.rir == null || s.rir <= rirMax);

/** @param {LoggedSet[]} sets @param {{ rirMax?: number }} [opts] */
export const hardSets = (sets, { rirMax = HARD_SET_RIR_MAX } = {}) => sets.filter((s) => isHardSet(s, rirMax));

/**
 * Volume load Σ kg × reps over non-warm-up sets of rep-counted exercises (holds and carries excluded: kg × seconds is
 * not a load). Comparable within an exercise only (R07 §B); dumbbells count per hand, as logged.
 * @param {LoggedSet[]} sets @param {{ loadOf?: LoadOf, unitOf?: UnitOf }} [opts]
 */
export function tonnage(sets, { loadOf = loggedLoad, unitOf = repsUnit } = {}) {
  let total = 0;
  for (const s of sets) {
    if (s.kind === "warmup" || !(s.reps > 0) || unitOf(s.exerciseId) !== "reps") continue;
    const kg = loadOf(s);
    if (kg != null && kg > 0) total += kg * s.reps;
  }
  return total;
}

/**
 * Tonnage per local day (only days with load), oldest first.
 * @param {LoggedSet[]} sets @param {{ loadOf?: LoadOf, unitOf?: UnitOf, timeOf?: TimeOf }} [opts]
 * @returns {{ date: string, at: number, load: number }[]}
 */
export function dailyLoads(sets, { loadOf = loggedLoad, unitOf = repsUnit, timeOf = setTime } = {}) {
  /** @type {Map<string, number>} */
  const byDay = new Map();
  for (const s of sets) {
    const t = timeOf(s);
    if (!Number.isFinite(t)) continue;
    const load = tonnage([s], { loadOf, unitOf });
    if (load > 0) byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + load);
  }
  return [...byDay].map(([date, load]) => ({ date, at: fromDayKey(date), load })).sort((a, b) => a.at - b.at);
}

/**
 * Tonnage per Monday-week for the last `weeks` weeks (oldest first).
 * @param {LoggedSet[]} sets
 * @param {{ weeks?: number, now?: TimeLike, loadOf?: LoadOf, unitOf?: UnitOf, timeOf?: TimeOf }} [opts]
 */
export function weeklyTonnage(sets, { weeks = 8, now = Date.now(), loadOf = loggedLoad, unitOf = repsUnit, timeOf = setTime } = {}) {
  const grid = weekGrid(weeks, now);
  const values = grid.map(() => 0);
  for (const s of sets) {
    const i = weekIndexOf(grid, timeOf(s));
    if (i >= 0) values[i] += tonnage([s], { loadOf, unitOf });
  }
  return { weeks: grid, values };
}

/**
 * Coarse-group weights of one exercise: `info.groups` when given (clamped to ≤ 1); otherwise 1 for every distinct
 * primary group and 0.5 for every secondary group that is not also primary; unknown exercises → `{ other: 1 }`.
 * @param {ExerciseFacts | null | undefined} info
 * @param {(muscleId: string) => string | null | undefined} groupOf
 * @returns {Record<string, number>}
 */
export function groupWeightsOf(info, groupOf) {
  /** @type {Record<string, number>} */
  const out = {};
  if (info?.groups) {
    for (const [g, w] of Object.entries(info.groups)) if (w > 0) out[g] = Math.min(1, w);
    if (Object.keys(out).length) return out;
  }
  for (const m of info?.primary ?? []) out[groupOf(m) || "other"] = 1;
  for (const m of info?.secondary ?? []) {
    const g = groupOf(m) || "other";
    if (!(g in out)) out[g] = 0.5;
  }
  return Object.keys(out).length ? out : { other: 1 };
}

/** Groups in `order` first, then the rest alphabetically, "other" last. @param {string[]} groups @param {string[]} order */
function sortGroups(groups, order) {
  /** @param {string} g */
  const rank = (g) => (g === "other" ? 1e9 : order.includes(g) ? order.indexOf(g) : 1e6);
  return [...groups].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * @typedef {object} WeeklyVolume
 * @property {{ start: number, end: number, key: string }[]} weeks  oldest first; the last contains `now`
 * @property {string[]} groups  groups with any volume, ordered by `order`, "other" last
 * @property {Record<string, number[]>} sets  fractional hard sets per group per week (direct 1 + indirect 0.5)
 * @property {Record<string, number[]>} direct  hard sets that train the group directly (weight 1); a row for every group
 * @property {Record<string, number[]>} primary  each set split evenly over its primary groups (sums to `hard`); every group
 * @property {number[]} hard  hard sets per week
 */

/**
 * Weekly hard sets per coarse muscle group (R07 §B). Each hard set counts 1 for every distinct primary (direct) group
 * of its exercise and 0.5 for every secondary group that is not also primary — the "fractional" quantification that
 * predicted hypertrophy and strength gains best in the 2025 dose–response meta-regression (Pelland et al. [14]); a row
 * counts 1 for back and 0.5 for biceps. Warm-ups and sets > 4 RIR are not hard sets.
 * @param {LoggedSet[]} sets
 * @param {(exerciseId: string) => ExerciseFacts | null | undefined} lookup
 * @param {(muscleId: string) => string | null | undefined} groupOf
 * @param {{ weeks?: number, now?: TimeLike, timeOf?: TimeOf, order?: string[], rirMax?: number }} [opts]
 * @returns {WeeklyVolume}
 */
export function weeklyVolumeByGroup(sets, lookup, groupOf, opts = {}) {
  const { weeks = 8, now = Date.now(), timeOf = setTime, order = [], rirMax = HARD_SET_RIR_MAX } = opts;
  const grid = weekGrid(weeks, now);
  /** @type {Record<string, number[]>} */
  const frac = {};
  /** @type {Record<string, number[]>} */
  const direct = {};
  /** @type {Record<string, number[]>} */
  const primary = {};
  const hard = grid.map(() => 0);
  /** @param {Record<string, number[]>} rec @param {string} g */
  const row = (rec, g) => (rec[g] ??= grid.map(() => 0));
  /** @type {Map<string, Record<string, number>>} */
  const cache = new Map();
  for (const s of sets) {
    if (!isHardSet(s, rirMax)) continue;
    const w = weekIndexOf(grid, timeOf(s));
    if (w < 0) continue;
    let weights = cache.get(s.exerciseId);
    if (!weights) {
      weights = groupWeightsOf(lookup(s.exerciseId), groupOf);
      cache.set(s.exerciseId, weights);
    }
    hard[w] += 1;
    const prim = Object.keys(weights).filter((g) => weights[g] >= 1);
    for (const [g, v] of Object.entries(weights)) {
      row(frac, g)[w] += v;
      if (v >= 1) row(direct, g)[w] += 1;
    }
    for (const g of prim) row(primary, g)[w] += 1 / prim.length;
  }
  const groups = sortGroups(Object.keys(frac), order);
  for (const g of groups) {
    row(direct, g);
    row(primary, g);
  }
  return { weeks: grid, groups, sets: frac, direct, primary, hard };
}

/* ------------------------------------------------------------------ C. body weight */

/**
 * Mean per local day (several weigh-ins on one day count once, at the day's first time).
 * @param {{ at: TimeLike, value: number }[]} points @returns {{ at: number, value: number, n: number }[]}
 */
export function dailyMean(points) {
  /** @type {Map<string, { at: number, sum: number, n: number }>} */
  const byDay = new Map();
  for (const p of points) {
    const at = toMs(p.at);
    if (!Number.isFinite(at) || !Number.isFinite(p.value)) continue;
    const key = dayKey(at);
    const d = byDay.get(key);
    if (d) {
      d.at = Math.min(d.at, at);
      d.sum += p.value;
      d.n += 1;
    } else byDay.set(key, { at, sum: p.value, n: 1 });
  }
  return [...byDay.values()].map((d) => ({ at: d.at, value: d.sum / d.n, n: d.n })).sort((a, b) => a.at - b.at);
}

/**
 * Exponentially weighted moving average of an irregular series — the Hacker's Diet trend `T += α(W − T)` [38] with
 * α per DAY: over a gap of Δ days the new point gets weight 1 − (1 − α)^Δ, so the time constant stays ≈ (1 − α)/α
 * = 9 days whether you weigh in daily or twice a week. Starts at the first value. Aggregate same-day points first
 * (`dailyMean`).
 * @param {{ at: TimeLike, value: number }[]} points
 * @param {number} [alpha]
 * @returns {{ at: number, value: number, trend: number }[]}
 */
export function ewma(points, alpha = WEIGHT_ALPHA) {
  const pts = points
    .map((p) => ({ at: toMs(p.at), value: p.value }))
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.value))
    .sort((a, b) => a.at - b.at);
  /** @type {{ at: number, value: number, trend: number }[]} */
  const out = [];
  let trend = 0;
  let prev = 0;
  for (const p of pts) {
    if (!out.length) trend = p.value;
    else trend += (1 - (1 - alpha) ** Math.max(0, (p.at - prev) / DAY_MS)) * (p.value - trend);
    prev = p.at;
    out.push({ at: p.at, value: p.value, trend });
  }
  return out;
}

/**
 * Residual scatter around a line, in x order: σ (n − 2 df), lag-1 autocorrelation ρ (clamped to [0, 0.9]) and the
 * variance inflation √((1 + ρ)/(1 − ρ)) that an AR(1) error process implies for a regression slope.
 * @param {XY[]} xy @param {number} slope @param {number} intercept
 */
function residualStats(xy, slope, intercept) {
  const n = xy.length;
  if (n < 3) return null;
  const xbar = xy.reduce((a, p) => a + p.x, 0) / n;
  const sxx = xy.reduce((a, p) => a + (p.x - xbar) ** 2, 0);
  if (!(sxx > 0)) return null;
  const r = xy.map((p) => p.y - (intercept + slope * p.x));
  const ss = r.reduce((a, v) => a + v * v, 0);
  const sigma = Math.sqrt(ss / (n - 2));
  let lag = 0;
  for (let i = 1; i < n; i++) lag += r[i] * r[i - 1];
  const rho = ss > 0 ? Math.min(0.9, Math.max(0, lag / ss)) : 0;
  const inflation = Math.sqrt((1 + rho) / (1 - rho));
  return { n, xbar, sxx, sigma, rho, inflation, seSlope: (sigma / Math.sqrt(sxx)) * inflation };
}

/**
 * @typedef {object} WeeklyRate
 * @property {number} kgPerWeek  Theil–Sen slope of the raw weigh-ins in the window × 7
 * @property {[number, number]} band  `confidence` band of the slope (kg/week)
 * @property {number} pctPerWeek  kgPerWeek as % of the current trend level
 * @property {[number, number]} pctBand
 * @property {number} n  weigh-ins in the window
 * @property {number} spanDays
 * @property {number} sigma  residual SD (kg)
 * @property {number} rho  lag-1 autocorrelation of the residuals
 * @property {number} confidence
 * @property {boolean} reliable  ≥ `minDays` of data and ≥ 8 weigh-ins (R07 §E: 14 days minimum, 28 preferred)
 */

/**
 * Weekly rate of body-weight change with a residual band (R07 §E). The slope is Theil–Sen on the RAW weigh-ins of
 * the last `days` days (robust to a salty-dinner spike; the EWMA trend is for reading, not for slopes). Band =
 * slope ± t(n − 2) · σ_res/√Sxx, widened by √((1+ρ)/(1−ρ)) for lag-1 autocorrelated residuals (water retention
 * comes in spells, so independent-error bands are too narrow).
 * @param {{ at: number, value: number, trend?: number }[]} trend  ewma() output (or any sorted weigh-in series)
 * @param {{ days?: number, minDays?: number, confidence?: number }} [opts]
 * @returns {WeeklyRate | null} null with fewer than 3 weigh-ins in the window
 */
export function weeklyRate(trend, opts = {}) {
  const { days = 28, minDays = 14, confidence = 0.95 } = opts;
  if (!trend.length) return null;
  const last = trend[trend.length - 1];
  const win = trend.filter((p) => p.at >= last.at - days * DAY_MS);
  if (win.length < 3) return null;
  const x0 = win[0].at;
  const xy = win.map((p) => ({ x: (p.at - x0) / DAY_MS, y: p.value }));
  const fit = theilSen(xy);
  const rs = fit && residualStats(xy, fit.slope, fit.intercept);
  if (!fit || !rs) return null;
  const half = tQuantile(1 - (1 - confidence) / 2, xy.length - 2) * rs.seSlope;
  const current = Number.isFinite(last.trend) ? /** @type {number} */ (last.trend) : last.value;
  const kgPerWeek = fit.slope * 7;
  /** @type {[number, number]} */
  const band = [(fit.slope - half) * 7, (fit.slope + half) * 7];
  /** @param {number} v */
  const pct = (v) => (current > 0 ? (v / current) * 100 : NaN);
  const spanDays = xy[xy.length - 1].x;
  return {
    kgPerWeek,
    band,
    pctPerWeek: pct(kgPerWeek),
    pctBand: [pct(band[0]), pct(band[1])],
    n: xy.length,
    spanDays,
    sigma: rs.sigma,
    rho: rs.rho,
    confidence,
    reliable: spanDays >= minDays && xy.length >= 8,
  };
}

/* ------------------------------------------------------------------ D. Theil–Sen */

/** @type {Map<number, number[]>} */
const inversionCache = new Map();

/**
 * Null distribution of the number of discordant pairs (inversions) of a random permutation of n items: the
 * Mahonian numbers / n!, by the recursion p_m(k) = (1/m) Σ_{j<m} p_{m−1}(k − j). Memoized.
 * @param {number} n
 */
function inversionPmf(n) {
  const hit = inversionCache.get(n);
  if (hit) return hit;
  let dist = [1];
  for (let m = 2; m <= n; m++) {
    const next = new Array(dist.length + m - 1).fill(0);
    let window = 0;
    for (let k = 0; k < next.length; k++) {
      if (k < dist.length) window += dist[k];
      if (k - m >= 0 && k - m < dist.length) window -= dist[k - m];
      next[k] = window / m;
    }
    dist = next;
  }
  inversionCache.set(n, dist);
  return dist;
}

/**
 * @typedef {object} TheilSen
 * @property {number} slope  median of the pairwise slopes
 * @property {number} intercept  median of y − slope·x
 * @property {[number, number] | null} slopeCI  null when `n` is too small to bound it at `confidence`
 * @property {number} coverage  exact coverage of `slopeCI` (exact method) or the nominal level (normal method)
 * @property {"exact" | "normal"} method
 * @property {number} n
 * @property {number} pairs  pairwise slopes used (pairs with equal x are skipped)
 */

/**
 * Theil–Sen line (R07 §D [45][46]): slope = median of all pairwise slopes (tolerates ≈ 29 % outliers), intercept =
 * median(y − slope·x). Slope confidence interval by Sen (1968): the order statistics of the sorted pairwise slopes
 * at the critical value of Kendall's S. For n ≤ 40 without tied x the critical value comes from the EXACT null
 * distribution of S (Mahonian numbers; slightly conservative when y has ties); above that from the normal
 * approximation Var(S) = [n(n−1)(2n+5) − Σ t(t−1)(2t+5)]/18 with tie correction, ranks (N ∓ C)/2 interpolated
 * (Gilbert 1987). Small samples cannot reach high confidence: at 95 % the interval needs n ≥ 5 (otherwise null).
 * @param {XY[]} points
 * @param {{ confidence?: number }} [opts]
 * @returns {TheilSen | null} null with fewer than 2 distinct x
 */
export function theilSen(points, opts = {}) {
  const { confidence = 0.95 } = opts;
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  /** @type {number[]} */
  const slopes = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = pts[j].x - pts[i].x;
      if (dx !== 0) slopes.push((pts[j].y - pts[i].y) / dx);
    }
  }
  if (!slopes.length) return null;
  slopes.sort((a, b) => a - b);
  const slope = medianSorted(slopes);
  const intercept = median(pts.map((p) => p.y - slope * p.x));
  const N = slopes.length;
  const alpha = 1 - confidence;
  if (n <= 40 && N === (n * (n - 1)) / 2) {
    const pmf = inversionPmf(n);
    let cdf = 0;
    let m = -1;
    for (let k = 0; k <= N && cdf + pmf[k] <= alpha / 2 + 1e-12; k++) {
      cdf += pmf[k];
      m = k;
    }
    const slopeCI = m < 0 ? null : /** @type {[number, number]} */ ([slopes[m], slopes[N - m - 1]]);
    return { slope, intercept, slopeCI, coverage: m < 0 ? 0 : 1 - 2 * cdf, method: "exact", n, pairs: N };
  }
  /** @type {Map<number, number>} */
  const ties = new Map();
  for (const p of pts) ties.set(p.y, (ties.get(p.y) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of ties.values()) tieTerm += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  const C = normalQuantile(1 - alpha / 2) * Math.sqrt(Math.max(0, varS));
  const lowerRank = (N - C) / 2; // 1-based
  const upperRank = (N + C) / 2 + 1;
  const slopeCI = lowerRank < 1 || upperRank > N ? null : /** @type {[number, number]} */ ([atRank(slopes, lowerRank - 1), atRank(slopes, upperRank - 1)]);
  return { slope, intercept, slopeCI, coverage: slopeCI ? confidence : 0, method: "normal", n, pairs: N };
}

/* ------------------------------------------------------------------ forecast (body weight) */

/**
 * @typedef {object} Forecast
 * @property {{ at: number, value: number }[]} line  from the last observation to the horizon
 * @property {{ at: number, lo: number, hi: number }[]} band  `confidence` band of the TREND (not of one weigh-in)
 * @property {{ at: number, value: number }[]} fitted  the fitted line over the observed window (2 points)
 * @property {number} slope  per day
 * @property {[number, number]} slopeCI  per day
 * @property {number} start  fitted value at the window start
 * @property {number} current  fitted value at the last observation
 * @property {number} lastAt
 * @property {number} n
 * @property {number} spanDays
 * @property {number} horizonDays  after the caps
 * @property {number} capDays  min(2 × span, 182)
 * @property {number} confidence
 */

/**
 * Straight-line forecast with an honest band (R07 §H). Theil–Sen line through the last `windowDays` of points; the
 * band is a cone from the last observation: the slope's residual band (as in `weeklyRate`, AR(1)-widened) times the
 * horizon, plus the uncertainty of the current level, t·σ·√(1/n + (x_L − x̄)²/Sxx). The horizon is capped at twice
 * the data span and 26 weeks — progress is not linear for long.
 * @param {{ at: TimeLike, value: number }[]} points
 * @param {number} horizonDays
 * @param {{ confidence?: number, windowDays?: number, maxMultiple?: number, maxDays?: number, steps?: number }} [opts]
 * @returns {Forecast | null} null with fewer than 4 points (or no time span)
 */
export function forecast(points, horizonDays, opts = {}) {
  const { confidence = 0.9, windowDays = Infinity, maxMultiple = 2, maxDays = 182, steps = 24 } = opts;
  const all = points
    .map((p) => ({ at: toMs(p.at), value: p.value }))
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.value))
    .sort((a, b) => a.at - b.at);
  if (!all.length) return null;
  const lastAt = all[all.length - 1].at;
  const pts = all.filter((p) => p.at >= lastAt - windowDays * DAY_MS);
  if (pts.length < 4) return null;
  const at0 = pts[0].at;
  const xy = pts.map((p) => ({ x: (p.at - at0) / DAY_MS, y: p.value }));
  const span = xy[xy.length - 1].x;
  const fit = span > 0 ? theilSen(xy) : null;
  const rs = fit && residualStats(xy, fit.slope, fit.intercept);
  if (!fit || !rs) return null;
  const tq = tQuantile(1 - (1 - confidence) / 2, xy.length - 2);
  /** @type {[number, number]} */
  const slopeCI = [fit.slope - tq * rs.seSlope, fit.slope + tq * rs.seSlope];
  const current = fit.intercept + fit.slope * span;
  const seLevel = rs.sigma * rs.inflation * Math.sqrt(1 / xy.length + (span - rs.xbar) ** 2 / rs.sxx);
  const capDays = Math.min(maxMultiple * span, maxDays);
  const H = Math.max(0, Math.min(horizonDays, capDays));
  const line = [];
  const band = [];
  for (let i = 0; i <= steps; i++) {
    const h = (H * i) / steps;
    const at = lastAt + h * DAY_MS;
    const a = current + slopeCI[0] * h;
    const b = current + slopeCI[1] * h;
    line.push({ at, value: current + fit.slope * h });
    band.push({ at, lo: Math.min(a, b) - tq * seLevel, hi: Math.max(a, b) + tq * seLevel });
  }
  return {
    line,
    band,
    fitted: [
      { at: at0, value: fit.intercept },
      { at: lastAt, value: current },
    ],
    slope: fit.slope,
    slopeCI,
    start: fit.intercept,
    current,
    lastAt,
    n: xy.length,
    spanDays: span,
    horizonDays: H,
    capDays,
    confidence,
  };
}

/**
 * @typedef {object} TimeToTarget
 * @property {"reached" | "on-track" | "beyond" | "away"} status  beyond = estimable only past the forecast cap
 * @property {number | null} days  at the point slope (null when moving away)
 * @property {number | null} earliestDays  at the fast end of the slope band
 * @property {number | null} latestDays  at the slow end; Infinity when the band includes "no progress"
 * @property {number} capDays
 */

/**
 * Days until the trend line reaches `target` (R07 §H): distance / speed, with the range from the slope band; the
 * latest date is "not estimable" (Infinity) when the band includes zero progress.
 * @param {Forecast | null} fc @param {number} target @returns {TimeToTarget | null}
 */
export function timeToTarget(fc, target) {
  if (!fc || !Number.isFinite(target)) return null;
  const want = Math.sign(target - fc.start) || Math.sign(target - fc.current);
  const gap = target - fc.current;
  if (want === 0 || gap * want <= 0) return { status: "reached", days: 0, earliestDays: 0, latestDays: 0, capDays: fc.capDays };
  const dist = Math.abs(gap);
  const speed = fc.slope * want;
  const fast = Math.max(fc.slopeCI[0] * want, fc.slopeCI[1] * want);
  const slow = Math.min(fc.slopeCI[0] * want, fc.slopeCI[1] * want);
  if (!(speed > 0)) return { status: "away", days: null, earliestDays: fast > 0 ? dist / fast : null, latestDays: null, capDays: fc.capDays };
  const days = dist / speed;
  return {
    status: days <= fc.capDays ? "on-track" : "beyond",
    days,
    earliestDays: dist / fast,
    latestDays: slow > 0 ? dist / slow : Infinity,
    capDays: fc.capDays,
  };
}

/* ------------------------------------------------------------------ F. strength trend */

/**
 * @typedef {object} TrendCollecting
 * @property {"collecting"} status
 * @property {number} n  reliable sessions so far
 * @property {number} spanDays
 * @property {number} needPoints
 * @property {number} needDays
 */
/**
 * @typedef {object} TrendOk
 * @property {"ok"} status
 * @property {number} pctPerWeek  (e^{7·slope} − 1) × 100
 * @property {[number, number] | null} ci  % per week, null below `ciPoints` points or when unbounded
 * @property {number} ciCoverage
 * @property {{ at: number, kg: number }[]} line
 * @property {{ at: number, lo: number, hi: number }[]} band  ±z·σ: where one session's e1RM falls if nothing changed
 * @property {number} n
 * @property {number} spanDays
 * @property {number} sigma  log units (≈ relative)
 */
/** @typedef {TrendCollecting | TrendOk} E1rmTrend */

/**
 * Trend of strength (R07 §F): Theil–Sen on (days, ln e1RM) of the reliable sessions, so the slope is a percent per
 * week comparable across exercises, with Sen's rank CI once there are `ciPoints` points. No line under `minPoints`
 * points over `minDays` days (R07 §K: a curve through 3 points is noise). The band is the measurement noise around
 * the line, σ = max(4 % (rule E4), residual RMS).
 * @param {{ at: number, kg: number, reliable: boolean }[]} series  sessionBestE1rm / e1rmSeries output
 * @param {{ minPoints?: number, minDays?: number, ciPoints?: number, sigmaRel?: number, z?: number, confidence?: number, steps?: number }} [opts]
 * @returns {E1rmTrend}
 */
export function e1rmTrend(series, opts = {}) {
  const { minPoints = 5, minDays = 21, ciPoints = 8, sigmaRel = 0.04, z = 1.96, confidence = 0.95, steps = 16 } = opts;
  const pts = series.filter((p) => p.reliable && p.kg > 0 && Number.isFinite(p.at)).sort((a, b) => a.at - b.at);
  const n = pts.length;
  const spanDays = n ? (pts[n - 1].at - pts[0].at) / DAY_MS : 0;
  /** @type {TrendCollecting} */
  const collecting = { status: "collecting", n, spanDays, needPoints: minPoints, needDays: minDays };
  if (n < minPoints || spanDays < minDays) return collecting;
  const at0 = pts[0].at;
  const xy = pts.map((p) => ({ x: (p.at - at0) / DAY_MS, y: Math.log(p.kg) }));
  const fit = theilSen(xy, { confidence });
  if (!fit) return collecting;
  const rs = residualStats(xy, fit.slope, fit.intercept);
  const sigma = Math.max(sigmaRel, rs ? rs.sigma : 0);
  /** @param {number} s */
  const pct = (s) => (Math.exp(7 * s) - 1) * 100;
  const line = [];
  const band = [];
  for (let i = 0; i <= steps; i++) {
    const x = (spanDays * i) / steps;
    const kg = Math.exp(fit.intercept + fit.slope * x);
    const at = at0 + x * DAY_MS;
    line.push({ at, kg });
    band.push({ at, lo: kg * Math.exp(-z * sigma), hi: kg * Math.exp(z * sigma) });
  }
  return {
    status: "ok",
    pctPerWeek: pct(fit.slope),
    ci: n >= ciPoints && fit.slopeCI ? [pct(fit.slopeCI[0]), pct(fit.slopeCI[1])] : null,
    ciCoverage: fit.coverage,
    line,
    band,
    n,
    spanDays,
    sigma,
  };
}

/* ------------------------------------------------------------------ PRs and plateaus */

/**
 * @typedef {object} PrEvent
 * @property {string} exerciseId
 * @property {"e1rm" | "load" | "reps"} kind
 * @property {number} value  new e1RM (kg), new heaviest load (kg) or new reps
 * @property {number} previous  the record it beat
 * @property {number} at
 * @property {string} sessionId
 * @property {string} setId
 * @property {number} kg  effective load of the set
 * @property {number} reps
 */

/**
 * @typedef {object} PrOptions
 * @property {LoadOf} [loadOf]
 * @property {TimeOf} [timeOf]
 * @property {UnitOf} [unitOf]
 * @property {number} [minGain]  relative margin an e1RM must beat the record by (default 0: any improvement)
 */

/**
 * Personal-record events per exercise, oldest first. The first session of an exercise only sets baselines. Kinds:
 * `e1rm` (best reliable session e1RM), `load` (heaviest load lifted for ≥ 1 rep), `reps` (more reps than ever at
 * this load or any heavier one — a real rep PR, not one dominated by an earlier heavier set). At most one event of
 * each kind per exercise and session.
 * @param {LoggedSet[]} sets @param {PrOptions} [opts] @returns {PrEvent[]}
 */
export function prs(sets, opts = {}) {
  const { loadOf = loggedLoad, timeOf = setTime, unitOf = repsUnit, minGain = 0 } = opts;
  /** @type {Map<string, Map<string, { at: number, rows: { set: LoggedSet, kg: number, e: E1rm | null }[] }>>} */
  const byExercise = new Map();
  for (const s of sets) {
    if (s.kind === "warmup" || !(s.reps >= 1) || unitOf(s.exerciseId) !== "reps") continue;
    const kg = loadOf(s);
    const at = timeOf(s);
    if (kg == null || !(kg > 0) || !Number.isFinite(at)) continue;
    let sessions = byExercise.get(s.exerciseId);
    if (!sessions) byExercise.set(s.exerciseId, (sessions = new Map()));
    let g = sessions.get(s.sessionId);
    if (!g) sessions.set(s.sessionId, (g = { at, rows: [] }));
    g.at = Math.min(g.at, at);
    g.rows.push({ set: s, kg, e: e1rm(kg, s.reps, s.rir) });
  }
  /** @type {PrEvent[]} */
  const events = [];
  for (const [exerciseId, sessions] of byExercise) {
    const ordered = [...sessions.entries()].sort((a, b) => a[1].at - b[1].at);
    let bestE = -Infinity;
    let bestLoad = -Infinity;
    /** @type {{ kg: number, reps: number }[]} */
    const history = [];
    ordered.forEach(([sessionId, g], index) => {
      const reliable = g.rows.filter((r) => r.e?.reliable);
      const topE = reliable.length ? reliable.reduce((a, b) => (/** @type {E1rm} */ (b.e).kg > /** @type {E1rm} */ (a.e).kg ? b : a)) : null;
      const topLoad = g.rows.reduce((a, b) => (b.kg > a.kg || (b.kg === a.kg && b.set.reps > a.set.reps) ? b : a));
      if (index > 0) {
        const topEkg = topE?.e?.kg ?? -Infinity;
        if (topE && bestE > 0 && topEkg > bestE * (1 + minGain) + 1e-9) {
          events.push({ exerciseId, kind: "e1rm", value: topEkg, previous: bestE, at: g.at, sessionId, setId: topE.set.id, kg: topE.kg, reps: topE.set.reps });
        }
        if (bestLoad > 0 && topLoad.kg > bestLoad + 1e-9) {
          events.push({ exerciseId, kind: "load", value: topLoad.kg, previous: bestLoad, at: g.at, sessionId, setId: topLoad.set.id, kg: topLoad.kg, reps: topLoad.set.reps });
        }
        /** @type {PrEvent | null} */
        let repPr = null;
        for (const r of g.rows) {
          const before = history.filter((h) => h.kg >= r.kg - 1e-9);
          if (!before.length) continue;
          const prev = Math.max(...before.map((h) => h.reps));
          if (r.set.reps > prev && (!repPr || r.kg > repPr.kg)) {
            repPr = { exerciseId, kind: "reps", value: r.set.reps, previous: prev, at: g.at, sessionId, setId: r.set.id, kg: r.kg, reps: r.set.reps };
          }
        }
        if (repPr) events.push(repPr);
      }
      if (topE?.e && topE.e.kg > bestE) bestE = topE.e.kg;
      if (topLoad.kg > bestLoad) bestLoad = topLoad.kg;
      for (const r of g.rows) history.push({ kg: r.kg, reps: r.set.reps });
    });
  }
  return events.sort((a, b) => a.at - b.at);
}

/**
 * @typedef {object} BestRecord
 * @property {string} exerciseId
 * @property {SessionE1rm | null} e1rm  best reliable session e1RM
 * @property {{ kg: number, reps: number, at: number, setId: string } | null} heaviest
 * @property {number} sessions
 * @property {number} lastAt
 */

/**
 * Current bests per exercise.
 * @param {LoggedSet[]} sets @param {SeriesOptions} [opts] @returns {BestRecord[]} by most recent session first
 */
export function bestRecords(sets, opts = {}) {
  const series = sessionBestE1rm(sets, opts);
  const { loadOf = loggedLoad, timeOf = setTime, unitOf = repsUnit } = opts;
  /** @type {Map<string, BestRecord>} */
  const out = new Map();
  for (const s of series) {
    const r = out.get(s.exerciseId) ?? { exerciseId: s.exerciseId, e1rm: null, heaviest: null, sessions: 0, lastAt: 0 };
    r.sessions += 1;
    r.lastAt = Math.max(r.lastAt, s.at);
    if (s.reliable && (!r.e1rm || s.kg > r.e1rm.kg)) r.e1rm = s;
    out.set(s.exerciseId, r);
  }
  for (const s of sets) {
    const r = out.get(s.exerciseId);
    if (!r || s.kind === "warmup" || !(s.reps >= 1) || unitOf(s.exerciseId) !== "reps") continue;
    const kg = loadOf(s);
    if (kg != null && kg > 0 && (!r.heaviest || kg > r.heaviest.kg || (kg === r.heaviest.kg && s.reps > r.heaviest.reps))) {
      r.heaviest = { kg, reps: s.reps, at: timeOf(s), setId: s.id };
    }
  }
  return [...out.values()].sort((a, b) => b.lastAt - a.lastAt);
}

/**
 * @typedef {object} Plateau
 * @property {boolean} flag  `since` ≥ `sessions`
 * @property {number} since  sessions since the last confirmed best
 * @property {number} best  the confirmed best (kg)
 * @property {number} bestAt
 * @property {number} sessions  the threshold used
 * @property {number} falseAlarm  P(a dry spell this long | still progressing) = (1 − pProgress)^since
 */

/**
 * Plateau flag by the no-PR rule (R07 §G): count the reliable sessions since the last CONFIRMED best — at least
 * `minGain` (2.5 % ≈ 0.6σ) above the previous best, or two sessions in a row above it — so noise rarely resets it.
 * `falseAlarm` says how often such a dry spell happens by chance while still progressing (PR chance 0.35 per
 * session: 6 sessions → 7.5 %, 4 → 18 %).
 * @param {{ at: number, kg: number, reliable?: boolean }[]} series
 * @param {{ sessions?: number, minGain?: number, pProgress?: number }} [opts]
 * @returns {Plateau | null} null with fewer than 2 reliable sessions
 */
export function plateau(series, opts = {}) {
  const { sessions = 4, minGain = 0.025, pProgress = 0.35 } = opts;
  const pts = series.filter((p) => p.reliable !== false && p.kg > 0).sort((a, b) => a.at - b.at);
  if (pts.length < 2) return null;
  let best = pts[0].kg;
  let bestAt = pts[0].at;
  let since = 0;
  /** @type {number | null} */
  let prevAbove = null;
  for (const p of pts.slice(1)) {
    if (p.kg >= best * (1 + minGain)) {
      best = p.kg;
      bestAt = p.at;
      since = 0;
      prevAbove = null;
    } else if (p.kg > best && prevAbove != null) {
      best = Math.min(prevAbove, p.kg);
      bestAt = p.at;
      since = 0;
      prevAbove = null;
    } else {
      since += 1;
      prevAbove = p.kg > best ? p.kg : null;
    }
  }
  return { flag: since >= sessions, since, best, bestAt, sessions, falseAlarm: (1 - pProgress) ** since };
}

/* ------------------------------------------------------------------ E. fitness–fatigue and ACWR */

/**
 * Contiguous daily grid of summed loads from the first load day (or `from`) to the last (or `until`).
 * @param {{ date?: string, at?: TimeLike, load: number }[]} loads @param {TimeLike} [from] @param {TimeLike} [until]
 * @returns {{ date: string, at: number, load: number }[]}
 */
export function dailyGrid(loads, from, until) {
  /** @type {Map<string, number>} */
  const byDay = new Map();
  for (const l of loads) {
    const key = l.date ?? (l.at != null ? dayKey(l.at) : null);
    if (!key || !Number.isFinite(l.load)) continue;
    byDay.set(key, (byDay.get(key) ?? 0) + Math.max(0, l.load));
  }
  const keys = [...byDay.keys()].map(fromDayKey).sort((a, b) => a - b);
  const startCandidates = [...keys.slice(0, 1), ...(from != null && Number.isFinite(toMs(from)) ? [dayStart(from)] : [])];
  const endCandidates = [...keys.slice(-1), ...(until != null && Number.isFinite(toMs(until)) ? [dayStart(until)] : [])];
  if (!startCandidates.length || !endCandidates.length) return [];
  const start = Math.min(...startCandidates);
  const end = Math.max(...endCandidates);
  const out = [];
  for (let t = start, i = 0; t <= end && i < 3700; t = dayStart(addDays(start, ++i))) {
    const date = dayKey(t);
    out.push({ date, at: t, load: byDay.get(date) ?? 0 });
  }
  return out;
}

/**
 * @typedef {object} BanisterDay
 * @property {string} date
 * @property {number} at
 * @property {number} load  that day's training impulse
 * @property {number} fitness  k₁·F_{t−1}: the fitness trace on the morning of the day
 * @property {number} fatigue  k₂·G_{t−1}
 * @property {number} performance  p₀ + fitness − fatigue
 */

/**
 * Banister impulse–response (fitness–fatigue) model (R07 §C [25][26][30]) on a daily grid:
 * F_t = F_{t−1}e^{−1/τ₁} + w_t, G_t = G_{t−1}e^{−1/τ₂} + w_t, P_t = p₀ + k₁F_{t−1} − k₂G_{t−1} (a day's load acts
 * from the next day). Defaults are textbook constants (k₁ 1, k₂ 2, τ₁ 42 d, τ₂ 7 d), NOT fitted: with ~2 strength
 * observations a week the four parameters are not identifiable [21][27], so read it as a picture of the load
 * pattern. Units are those of the loads (here daily tonnage).
 * @param {{ date?: string, at?: TimeLike, load: number }[]} dailyLoadsInput
 * @param {{ k1?: number, k2?: number, tau1?: number, tau2?: number, p0?: number, from?: TimeLike, until?: TimeLike }} [params]
 * @returns {BanisterDay[]}
 */
export function banister(dailyLoadsInput, params = {}) {
  const { k1 = 1, k2 = 2, tau1 = 42, tau2 = 7, p0 = 0, from, until } = params;
  const d1 = Math.exp(-1 / tau1);
  const d2 = Math.exp(-1 / tau2);
  let F = 0;
  let G = 0;
  return dailyGrid(dailyLoadsInput, from, until).map(({ date, at, load }) => {
    const fitness = k1 * F;
    const fatigue = k2 * G;
    F = F * d1 + load;
    G = G * d2 + load;
    return { date, at, load, fitness, fatigue, performance: p0 + fitness - fatigue };
  });
}

/**
 * When one session's net effect turns positive (t_n) and when it peaks (t_g) (Fitz-Clarke et al. 1991 [24]):
 * t_n = τ₁τ₂/(τ₁−τ₂)·ln(k₂/k₁), t_g = τ₁τ₂/(τ₁−τ₂)·ln(k₂τ₁/(k₁τ₂)); 42/7 d and k₂/k₁ = 2 → 5.8 and 20.9 days.
 * @param {{ k1?: number, k2?: number, tau1?: number, tau2?: number }} [params]
 */
export function banisterTiming({ k1 = 1, k2 = 2, tau1 = 42, tau2 = 7 } = {}) {
  const f = (tau1 * tau2) / (tau1 - tau2);
  return { tn: f * Math.log(k2 / k1), tg: f * Math.log((k2 * tau1) / (k1 * tau2)) };
}

/** @typedef {"warmup" | "dip" | "steady" | "ramping" | "spike"} AcwrZone */

/** @param {number} ratio @returns {AcwrZone} */
export const acwrZone = (ratio) => (ratio < ACWR_ZONES.dip ? "dip" : ratio <= ACWR_ZONES.steady ? "steady" : ratio < ACWR_ZONES.ramping ? "ramping" : "spike");

/**
 * Acute:chronic workload ratio with EWMAs (R07 §D): λ = 2/(N + 1) (acute 7 d → 0.25, chronic 28 d → 0.069)
 * [31][33]. `uncoupled` (default) feeds the chronic EWMA the loads lagged by the acute window, so this week is not
 * divided by itself (the coupling that manufactures correlation [34]). The ratio is null for the first `warmup` days
 * (the EWMA needs ≈ 50 days to forget its start [33]). Descriptive only: no study shows that steering this ratio
 * prevents injuries [36]; the zones (< 0.8 dip, 0.8–1.3 steady, 1.3–1.5 ramping, ≥ 1.5 spike) are team-sport
 * heuristics [37].
 * @param {{ date?: string, at?: TimeLike, load: number }[]} dailyLoadsInput
 * @param {{ acute?: number, chronic?: number, uncoupled?: boolean, warmup?: number, from?: TimeLike, until?: TimeLike }} [opts]
 */
export function acwrEwma(dailyLoadsInput, opts = {}) {
  const { acute = 7, chronic = 28, uncoupled = true, warmup = 50, from, until } = opts;
  const grid = dailyGrid(dailyLoadsInput, from, until);
  const la = 2 / (acute + 1);
  const lc = 2 / (chronic + 1);
  let a = 0;
  let c = 0;
  return grid.map((d, i) => {
    a = la * d.load + (1 - la) * a;
    const fed = uncoupled ? (i >= acute ? grid[i - acute].load : 0) : d.load;
    c = lc * fed + (1 - lc) * c;
    const ratio = i >= warmup && c > 0 ? a / c : null;
    return { date: d.date, at: d.at, load: d.load, acute: a, chronic: c, ratio, zone: ratio == null ? /** @type {AcwrZone} */ ("warmup") : acwrZone(ratio) };
  });
}

/* ------------------------------------------------------------------ adherence */

/**
 * @typedef {object} AdherenceWeek
 * @property {number} start
 * @property {number} end
 * @property {string} key  Monday "YYYY-MM-DD"
 * @property {number} planned  0 before the first session's week
 * @property {number} done  sessions started this week
 * @property {boolean} met  done ≥ daysPerWeek
 * @property {boolean} current
 * @property {boolean} beforeStart
 * @property {number} missed  planned − done for completed weeks (0 for the current week)
 * @property {{ date: string, at: number, count: number, future: boolean, today: boolean }[]} days  Monday first
 */

/**
 * Sessions per week against the plan, 12 weeks by default (counted: active, finished, auto_closed — not abandoned).
 * Weeks before the first session are not "missed". Streak = consecutive met weeks counted back from the last
 * complete week, over the whole history; the current week adds one once it is met and never breaks it. `rate` =
 * Σ min(done, planned) / Σ planned over the completed weeks in the window.
 * @param {Pick<Session, "startedAt" | "status">[]} sessions
 * @param {{ weeks?: number, daysPerWeek?: number, now?: TimeLike }} [opts]
 */
export function adherence(sessions, opts = {}) {
  const { weeks = 12, daysPerWeek = 3, now = Date.now() } = opts;
  const nowMs = toMs(now);
  const times = sessions
    .filter((s) => s.status !== "abandoned")
    .map((s) => toMs(s.startedAt))
    .filter((t) => Number.isFinite(t) && t <= nowMs + DAY_MS)
    .sort((a, b) => a - b);
  const firstWeek = times.length ? startOfWeek(times[0]) : null;
  /** @type {Map<string, number>} */
  const perDay = new Map();
  /** @type {Map<string, number>} */
  const perWeek = new Map();
  for (const t of times) {
    perDay.set(dayKey(t), (perDay.get(dayKey(t)) ?? 0) + 1);
    perWeek.set(dayKey(startOfWeek(t)), (perWeek.get(dayKey(startOfWeek(t))) ?? 0) + 1);
  }
  const today = dayStart(nowMs);
  /** @type {AdherenceWeek[]} */
  const grid = weekGrid(weeks, nowMs).map((w) => {
    const days = [];
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const at = dayStart(addDays(w.start, i));
      const date = dayKey(at);
      const count = perDay.get(date) ?? 0;
      done += count;
      days.push({ date, at, count, future: at > today, today: at === today });
    }
    const current = nowMs >= w.start && nowMs < w.end;
    const beforeStart = firstWeek == null || w.start < firstWeek;
    const met = done >= daysPerWeek;
    return {
      start: w.start,
      end: w.end,
      key: w.key,
      planned: beforeStart ? 0 : daysPerWeek,
      done,
      met,
      current,
      beforeStart,
      missed: beforeStart || current ? 0 : Math.max(0, daysPerWeek - done),
      days,
    };
  });
  let streak = 0;
  if (firstWeek != null) {
    const thisWeek = startOfWeek(nowMs);
    for (let w = addDays(thisWeek, -7); w >= firstWeek; w = addDays(w, -7)) {
      if ((perWeek.get(dayKey(w)) ?? 0) >= daysPerWeek) streak += 1;
      else break;
    }
    if ((perWeek.get(dayKey(thisWeek)) ?? 0) >= daysPerWeek) streak += 1;
  }
  const completed = grid.filter((w) => !w.current && !w.beforeStart);
  const totalPlanned = completed.reduce((a, w) => a + w.planned, 0);
  const totalDone = completed.reduce((a, w) => a + Math.min(w.done, w.planned), 0);
  const currentWeek = grid[grid.length - 1];
  const lastAt = times.length ? times[times.length - 1] : null;
  return {
    weeks: grid,
    streak,
    totalDone,
    totalPlanned,
    rate: totalPlanned > 0 ? totalDone / totalPlanned : null,
    thisWeek: { done: currentWeek.done, planned: daysPerWeek },
    lastAt,
    daysSinceLast: lastAt == null ? null : daysBetween(lastAt, nowMs),
    daysPerWeek,
  };
}
