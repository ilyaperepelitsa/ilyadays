// @ts-check
/**
 * Progression engine (stream 03, plans/fitness/03-program-engine-and-progression.md): load rounding, warm-up ramps,
 * first loads, next-session targets (double progression + RIR autoregulation, deloads, coarse-step guard, plateau
 * memory, holds/carries, assisted machines), gaps, goal conversion, substitution, planned deloads and weekly volume.
 * Pure: no DOM, no fs. Research: plans/fitness/research/01 (goal modes, %1RM table), 02 (DP-RIR-4), 04 (§3.2, §3.8).
 *
 * Conventions: loads are kg as logged. Assisted machines log the ASSISTANCE (lower = harder); bodyweight exercises
 * log ADDED load (0 = bodyweight only); dumbbells and carries log kg per hand.
 */
import { exerciseById as catalogExerciseById } from "./catalog.mjs";
import {
  COMPOUND_PATTERNS, REP_MAX_PERCENT, RULES, WARMUP, WARMUP_RAMP,
  clamp, groupWeights, modeParams, rangeForUnit, roleParams, toIso, toMs, unitOf,
} from "./templates.mjs";

export { unitOf, groupWeights };

/** @typedef {import("./types").Exercise} Exercise */
/** @typedef {import("./types").ExerciseState} ExerciseState */
/** @typedef {NonNullable<ExerciseState["plateau"]>} Plateau */
/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").GoalMode} GoalMode */
/** @typedef {import("./types").LoggedSet} LoggedSet */
/** @typedef {import("./types").Outcome} Outcome */
/** @typedef {import("./types").Program} Program */
/** @typedef {import("./types").ProgressionParams} ProgressionParams */
/** @typedef {import("./types").SetPrescription} SetPrescription */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {import("./types").Lang} Lang */
/** @typedef {import("./templates.mjs").RepUnit} RepUnit */
/** @typedef {import("./templates.mjs").SlotRole} SlotRole */
/** @typedef {"nearest" | "down" | "up" | "easier" | "harder"} RoundDirection */
/** @typedef {{ exerciseById: (id: string) => Exercise | undefined }} ExerciseLookup */

const DAY_MS = 86_400_000;
/** @param {number} x */
const r2 = (x) => Math.round(x * 100) / 100;
/** @param {number} a @param {number} b */
const sameKg = (a, b) => Math.abs(a - b) < 0.005;

/* ------------------------------------------------------------------ exercise facts */

/** Load is assistance (assisted pull-up/dip): a LOWER number is harder. @param {Exercise | null | undefined} ex */
export const isAssisted = (ex) => Boolean(ex && (ex.assistance === true || ex.equipment === "assisted"));
/** @param {Exercise | null | undefined} ex */
const isBodyweight = (ex) => ex?.equipment === "bodyweight";
/** Multi-joint (warm-up ramps, compound rests). @param {Exercise | null | undefined} ex */
export const isCompound = (ex) => Boolean(ex && COMPOUND_PATTERNS.has(ex.pattern));
/** Equipment where 0 kg is a real load: bodyweight (no added load), bands, assistance 0 (= unassisted). */
const ZERO_OK = new Set(["bodyweight", "band", "assisted"]);

/**
 * Smallest load step: gym override by exercise id, then by equipment type, then the exercise's own increment.
 * @param {Exercise} exercise @param {Gym | null | undefined} [gym]
 */
export function incrementFor(exercise, gym) {
  const g = gym?.increments;
  const v = g ? (g[exercise.id] ?? g[exercise.equipment]) : undefined;
  const inc = typeof v === "number" && v > 0 ? v : exercise.increment;
  return typeof inc === "number" && Number.isFinite(inc) && inc > 0 ? inc : 0;
}

/** @param {number} a @param {number} b @param {Exercise} ex  a is harder than b */
const isHarder = (a, b, ex) => (isAssisted(ex) ? a < b - 0.005 : a > b + 0.005);
/** @param {number} kg @param {number} delta @param {Exercise} ex */
const harder = (kg, delta, ex) => (isAssisted(ex) ? kg - delta : kg + delta);
/** @param {number} kg @param {number} delta @param {Exercise} ex */
const easier = (kg, delta, ex) => (isAssisted(ex) ? kg + delta : kg - delta);

/**
 * Round a load to what the equipment can do. `easier` rounds down (up for assistance), `harder` the other way.
 * Never negative; 0 only for bodyweight, bands and assistance; any other positive load is at least one step.
 * @param {number} kg @param {Exercise} exercise @param {Gym | null} [gym] @param {RoundDirection} [direction]
 */
export function roundLoad(kg, exercise, gym, direction = "nearest") {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  const step = incrementFor(exercise, gym);
  if (!step) return r2(kg);
  const assisted = isAssisted(exercise);
  const dir = direction === "easier" ? (assisted ? "up" : "down") : direction === "harder" ? (assisted ? "down" : "up") : direction;
  const q = kg / step;
  const n = dir === "down" ? Math.floor(q + 1e-9) : dir === "up" ? Math.ceil(q - 1e-9) : Math.round(q);
  let out = n * step;
  if (out <= 0 && !assisted && !ZERO_OK.has(exercise.equipment)) out = step;
  return r2(Math.max(0, out));
}

/* ------------------------------------------------------------------ e1RM and the %1RM table */

/** @param {number} r */
const epley = (r) => 1 + r / 30;
/** @param {number} r */
const brzycki = (r) => 36 / (37 - r);

/**
 * Multiplier from a set of `r` total reps (reps + RIR) to its estimated 1RM: mean of Epley and Brzycki (the
 * definition stream 06 uses for analytics.e1rm), Epley alone above 35 reps. Internal helper so this module does not
 * depend on analytics.mjs being present. @param {number} r
 */
export function e1rmFactor(r) {
  if (!(r > 1)) return 1;
  return r < 36 ? (epley(r) + brzycki(r)) / 2 : epley(r);
}

/**
 * Estimated 1RM of a set; `reliable` when reps + RIR ≤ 12 (research/02 §A).
 * @param {number} kg @param {number} reps @param {number | null} [rir] @returns {{ kg: number, reliable: boolean }}
 */
export function e1rmOf(kg, reps, rir) {
  const r = reps + (rir ?? 0);
  return { kg: r2(kg * e1rmFactor(r)), reliable: r <= RULES.reliableTotalReps };
}

/** Load for `reps` at `rir` from an e1RM: the exact inverse of e1rmOf. @param {number} e1rm @param {number} reps @param {number} [rir] */
export const loadForE1rm = (e1rm, reps, rir = 0) => e1rm / e1rmFactor(reps + rir);

/**
 * % of 1RM for a set taken to failure after `total` reps (reps + RIR), from templates.json repMaxPercent (1–20,
 * interpolated); above 20 Epley with a factor fading to 0.9 at 30 reps (research/01 Table 10). @param {number} total
 */
export function pctOf1rm(total) {
  if (!(total > 1)) return 100;
  if (total <= 20) {
    const lo = Math.floor(total);
    const hi = Math.ceil(total);
    const a = REP_MAX_PERCENT[String(lo)];
    const b = REP_MAX_PERCENT[String(hi)];
    return a + (b - a) * (total - lo);
  }
  const fade = 1 - 0.1 * Math.min(1, (total - 20) / 10);
  return (100 / epley(total)) * fade;
}

/**
 * Fraction of the e1RM that allows `total` reps (reps + RIR): the inverse of the e1RM blend where it is reliable
 * (≤ 12 total reps), the %1RM table above it (monotonic; Brzycki explodes near 37 reps). Used to turn an e1RM into a
 * working load for high-rep targets (calibration, capacity guard, rpe rule, substitution). @param {number} total
 */
export function loadFraction(total) {
  return total <= RULES.reliableTotalReps ? 1 / e1rmFactor(total) : pctOf1rm(total) / 100;
}

/* ------------------------------------------------------------------ text helpers (bilingual notes) */

/** @param {number} n @param {[string, string, string]} forms */
function pluralRu(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (!Number.isInteger(n)) return forms[1];
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
/** One number format per language, made once: a new Intl.NumberFormat per call took 70 % of a simulated year. @type {Partial<Record<Lang, Intl.NumberFormat>>} */
const FORMATS = {};
/** @param {number} n @param {Lang} lang */
const num = (n, lang) => (FORMATS[lang] ??= new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-GB", { maximumFractionDigits: 2 })).format(r2(n));
/** "10 reps" / "35 s" / "30 m". @param {number} n @param {RepUnit} unit @param {Lang} lang */
function amount(n, unit, lang) {
  if (unit === "seconds") return `${num(n, lang)} ${lang === "ru" ? "с" : "s"}`;
  if (unit === "meters") return `${num(n, lang)} ${lang === "ru" ? "м" : "m"}`;
  return lang === "ru" ? `${num(n, lang)} ${pluralRu(n, ["повторение", "повторения", "повторений"])}` : `${num(n, lang)} ${n === 1 ? "rep" : "reps"}`;
}
/** How a load reads: "40 kg", "assistance 30 kg", "bodyweight", "bodyweight + 5 kg". @param {number} kg @param {Exercise} ex @param {Lang} lang */
function loadText(kg, ex, lang) {
  const k = `${num(kg, lang)} ${lang === "ru" ? "кг" : "kg"}`;
  if (isAssisted(ex)) return kg > 0 ? (lang === "ru" ? `помощь ${k}` : `assistance ${k}`) : (lang === "ru" ? "без помощи" : "no assistance");
  if (isBodyweight(ex)) return kg > 0 ? (lang === "ru" ? `свой вес + ${k}` : `bodyweight + ${k}`) : (lang === "ru" ? "свой вес" : "bodyweight");
  if (ex.equipment === "dumbbell" || ex.equipment === "kettlebell") return lang === "ru" ? `${k} на руку` : `${k} per hand`;
  return k;
}
/** RU after a number of reps: "с 50 кг", "с помощью 30 кг", "с отягощением 5 кг". @param {number} kg @param {Exercise} ex */
function withLoadRu(kg, ex) {
  if (isAssisted(ex)) return kg > 0 ? `с помощью ${num(kg, "ru")} кг` : "без помощи";
  if (isBodyweight(ex)) return kg > 0 ? `с отягощением ${num(kg, "ru")} кг` : "со своим весом";
  return `с ${loadText(kg, ex, "ru")}`;
}
/** RU after "легче, чем": "105 кг", but "с помощью 25 кг" (less assistance is harder; "чем помощь 25 кг" reads backwards). @param {number} kg @param {Exercise} ex */
const thanRu = (kg, ex) => (isAssisted(ex) ? withLoadRu(kg, ex) : loadText(kg, ex, "ru"));
/** RU after "Повторите": "60 кг", but "с помощью 40 кг" and "с отягощением 5 кг" (not "Повторите помощь 40 кг"). @param {number} kg @param {Exercise} ex */
const repeatRu = (kg, ex) => (isAssisted(ex) || isBodyweight(ex) ? withLoadRu(kg, ex) : loadText(kg, ex, "ru"));
/** RU "рабочий вес 50 кг", but "рабочая помощь 30 кг" and "рабочее отягощение 5 кг" (not "рабочий вес помощь 30 кг"). @param {number} kg @param {Exercise} ex */
function workingRu(kg, ex) {
  if (isAssisted(ex)) return kg > 0 ? `рабочая помощь ${num(kg, "ru")} кг` : "без помощи";
  if (isBodyweight(ex)) return kg > 0 ? `рабочее отягощение ${num(kg, "ru")} кг` : "свой вес";
  return `рабочий вес ${loadText(kg, ex, "ru")}`;
}
/** RU deload: "снизьте до 45 кг", but "увеличьте помощь до 45 кг" (a deload adds assistance) and "снизьте отягощение до 5 кг" / "уберите отягощение". @param {number} kg @param {Exercise} ex */
function dropRu(kg, ex) {
  if (isAssisted(ex)) return `увеличьте помощь до ${num(kg, "ru")} кг`;
  if (isBodyweight(ex)) return kg > 0 ? `снизьте отягощение до ${num(kg, "ru")} кг` : "уберите отягощение";
  return `снизьте до ${loadText(kg, ex, "ru")}`;
}
/** @param {(lang: Lang) => string} f @returns {Text2} */
const text2 = (f) => ({ en: f("en"), ru: f("ru") });
/** @param {Text2[]} parts @returns {Text2 | undefined} */
export const joinText = (parts) => (parts.length ? { en: parts.map((p) => p.en).join(" "), ru: parts.map((p) => p.ru).join(" ") } : undefined);

/* ------------------------------------------------------------------ effective loads (assisted / bodyweight) */

/**
 * The load the muscles actually move, for e1RM and % maths: assistance → bodyweight − assistance, bodyweight →
 * bodyweight + added load (both need the bodyweight), otherwise the logged kg. Null when unknown.
 * @param {number} kg @param {Exercise} ex @param {number | null | undefined} bw
 */
function effectiveKg(kg, ex, bw) {
  if (isAssisted(ex)) return bw && bw > 0 ? Math.max(0, bw - kg) : null;
  if (isBodyweight(ex)) return bw && bw > 0 ? bw + kg : null;
  if (ex.equipment === "band") return null;
  return kg > 0 ? kg : null;
}
/** Inverse of effectiveKg. @param {number} eff @param {Exercise} ex @param {number | null | undefined} bw */
function fromEffective(eff, ex, bw) {
  if (isAssisted(ex)) return Math.max(0, (bw ?? 0) - eff);
  if (isBodyweight(ex)) return Math.max(0, eff - (bw ?? 0));
  return eff;
}

/**
 * Scale a load by `factor` in effective terms (0.9 = 10 % easier), rounded in the given direction. Without a
 * bodyweight, assistance changes by the effective-load step proxy (one increment per 10 %).
 * @param {number} kg @param {number} factor @param {Exercise} ex @param {{ gym?: Gym | null, bodyweightKg?: number | null }} ctx
 * @param {RoundDirection} [direction]
 */
function scaleLoad(kg, factor, ex, { gym, bodyweightKg }, direction = "easier") {
  if (isAssisted(ex)) {
    const bw = bodyweightKg && bodyweightKg > 0 ? bodyweightKg : null;
    if (bw) return Math.min(bw, roundLoad(bw - (bw - kg) * factor, ex, gym, direction));
    const inc = incrementFor(ex, gym) || 5;
    const steps = Math.round(((1 - factor) * 100) / 10);
    return roundLoad(kg + steps * inc, ex, gym, direction);
  }
  return roundLoad(kg * factor, ex, gym, direction);
}

/* ------------------------------------------------------------------ warm-up ramp */

/**
 * Warm-up sets before the first working set. None for bodyweight, bands, holds (seconds) and carries (metres).
 * Compounds: 50 % × 8 always, plus 70 % × 4 and 85 % × 2 when the working load is heavy (≥ 80 % of e1RM, or
 * ≤ 8 total reps when no e1RM is known). Isolation: one 50 % feeler set, only when the load is not trivially light.
 * Loads are rounded, strictly lighter than the working load and increasing.
 * @param {number} workingKg @param {Exercise} exercise @param {number | null} [e1rm]
 * @param {{ gym?: Gym | null, bodyweightKg?: number | null, targetReps?: number, rir?: number }} [opts]
 * @returns {SetPrescription[]}
 */
export function warmupRamp(workingKg, exercise, e1rm, { gym, bodyweightKg, targetReps, rir } = {}) {
  if (!exercise || unitOf(exercise) !== "reps") return [];
  if (isBodyweight(exercise) || exercise.equipment === "band" || exercise.pattern === "carry") return [];
  const assisted = isAssisted(exercise);
  const compound = isCompound(exercise);
  const inc = incrementFor(exercise, gym) || 1;
  if (assisted && !(bodyweightKg && bodyweightKg > 0)) {
    // no bodyweight: one easier set with two more steps of assistance
    return compound ? [{ kind: "warmup", weightKg: roundLoad(workingKg + 2 * inc, exercise, gym, "nearest"), reps: WARMUP_RAMP[0].reps }] : [];
  }
  const eff = effectiveKg(workingKg, exercise, bodyweightKg);
  if (!eff || eff <= 0) return [];
  const heavy = e1rm && e1rm > 0
    ? eff / e1rm >= WARMUP.heavyPctE1rm / 100
    : targetReps != null && targetReps + (rir ?? 2) <= WARMUP.heavyTotalReps;
  let steps = WARMUP_RAMP.filter((s) => s.when === "always" || heavy);
  if (!compound) {
    if (eff < 4 * inc) return [];
    steps = steps.slice(0, 1);
  }
  /** @type {SetPrescription[]} */
  const out = [];
  for (const s of steps) {
    const kg = assisted
      ? roundLoad(fromEffective((eff * s.pct) / 100, exercise, bodyweightKg), exercise, gym, "nearest")
      : roundLoad((eff * s.pct) / 100, exercise, gym, "nearest");
    if (!isHarder(workingKg, kg, exercise)) continue;
    const prev = out[out.length - 1];
    if (prev && !isHarder(kg, prev.weightKg, exercise)) continue;
    out.push({ kind: "warmup", weightKg: kg, reps: s.reps });
  }
  return out;
}

/* ------------------------------------------------------------------ first loads */

/** Role of a bare exercise (no slot): pattern + unit. @param {Exercise} ex @returns {SlotRole} */
function exerciseRole(ex) {
  const unit = unitOf(ex);
  if (unit === "meters" || ex.pattern === "carry") return "carry";
  if (unit === "seconds" || ["anti-extension", "anti-rotation", "lateral-flexion"].includes(ex.pattern)) return "hold";
  if (["trunk-flexion", "hip-flexion", "rotation", "spinal-extension"].includes(ex.pattern)) return "trunk";
  if (["lateral-raise", "rear-delt", "external-rotation", "front-raise", "calf-raise", "forearm-flexion", "forearm-extension", "grip", "neck", "shrug"].includes(ex.pattern)) return "small";
  if (isCompound(ex)) return ex.repRange?.[0] <= 6 ? "primary" : "secondary";
  return "isolation";
}

/**
 * Conservative first working load: the catalog's novice start load × 0.85, scaled to the lifter's bodyweight with
 * the allometric 0.67 exponent (Jaric 2002), rounded to the easier side. Assisted: the assistance is derived from
 * the effective load (bodyweight − assistance), so a lighter or more cautious start means MORE assistance.
 * @param {Exercise} exercise @param {{ bodyweightKg?: number | null, gym?: Gym | null }} [opts]
 */
export function startingLoad(exercise, { bodyweightKg, gym } = {}) {
  const ref = RULES.bodyweightRefKg;
  const bw = bodyweightKg && bodyweightKg > 0 ? clamp(bodyweightKg, 35, 200) : null;
  const scale = bw ? Math.pow(bw / ref, RULES.bodyweightExponent) : 1;
  const f = RULES.startLoadFactor;
  const inc = incrementFor(exercise, gym);
  if (isAssisted(exercise)) {
    const body = bw ?? ref;
    const assist80 = exercise.startLoad?.kg ?? ref / 2;
    const eff = Math.max(0, ref - assist80) * scale * f;
    return Math.min(roundLoad(body, exercise, gym, "down") || body, roundLoad(Math.max(0, body - eff), exercise, gym, "easier"));
  }
  if (isBodyweight(exercise) || exercise.equipment === "band") return exercise.startLoad?.kg ? roundLoad(exercise.startLoad.kg * f, exercise, gym, "easier") : 0;
  if (exercise.startLoad && exercise.startLoad.kg > 0) return roundLoad(exercise.startLoad.kg * scale * f, exercise, gym, "easier");
  if (exercise.equipment === "barbell") return 20;
  return roundLoad(2 * (inc || 2.5), exercise, gym, "easier");
}

/**
 * First-session test protocol: ramp up until a set at the bottom of the range feels like 2–3 reps in reserve; that
 * load becomes the working load (research/02 §E).
 * @param {Exercise} exercise @param {{ repRange?: [number, number], gym?: Gym | null }} [opts] @returns {Text2}
 */
export function firstSessionTestProtocol(exercise, { repRange, gym } = {}) {
  const [lo, hi] = repRange ?? exercise.repRange ?? [8, 12];
  const unit = unitOf(exercise);
  const inc = incrementFor(exercise, gym);
  if (unit === "seconds") {
    return text2((l) => l === "ru"
      ? `Первый раз: держите ${amount(lo, unit, l)} с идеальной техникой. Если могли бы держать ещё 10+ секунд, в следующих подходах держите до ${amount(hi, unit, l)}. Это и будет ваша стартовая цель.`
      : `First time: hold for ${amount(lo, unit, l)} with perfect form. If you could have held 10+ seconds longer, go up to ${amount(hi, unit, l)} on the next sets. That becomes your starting target.`);
  }
  if (unit === "meters") {
    return text2((l) => l === "ru"
      ? `Первый раз: возьмите вес, с которым пройдёте ${amount(lo, unit, l)} с прямой спиной и надёжным хватом, и добавляйте ${inc ? `${num(inc, l)} кг` : "по шагу"} в каждом подходе, пока хват не начнёт сдавать к концу дистанции, но ещё держит с запасом. Этот вес — рабочий.`
      : `First time: pick a weight you can carry ${amount(lo, unit, l)} standing tall with a firm grip, and add ${inc ? `${num(inc, l)} kg` : "a step"} each set until your grip fades near the end but still holds with something to spare. That weight is your working weight.`);
  }
  if (isAssisted(exercise)) {
    return text2((l) => l === "ru"
      ? `Первый раз: начните с большой помощью и убирайте по ${num(inc || 5, l)} кг в каждом подходе по ${amount(lo, unit, l)}, отдых 1–2 минуты. Остановитесь, когда подход из ${amount(lo, unit, l)} ощущается так, будто в запасе ещё 2–3 повторения. Эта помощь станет рабочей; сделайте с ней оставшиеся подходы.`
      : `First time: start with plenty of assistance and take off ${num(inc || 5, l)} kg each set of ${amount(lo, unit, l)}, resting 1–2 min. Stop when a set of ${lo} feels like 2–3 more reps were possible. That assistance becomes your working load; do the remaining sets with it.`);
  }
  if (isBodyweight(exercise) || !inc) {
    return text2((l) => l === "ru"
      ? `Первый раз: сделайте подход с чистой техникой и остановитесь, когда в запасе останется 2–3 повторения. Если получается больше ${amount(hi, unit, l)}, добавьте отягощение или возьмите более сложный вариант; если меньше ${lo} — более лёгкий.`
      : `First time: do a set with clean technique and stop with 2–3 reps left in the tank. If you get more than ${amount(hi, unit, l)}, add load or pick a harder variant; fewer than ${lo}, pick an easier one.`);
  }
  return text2((l) => l === "ru"
    ? `Первый раз в этом упражнении: начните с лёгкого веса и делайте подходы по ${amount(lo, unit, l)}, добавляя ${num(inc, l)} кг каждый подход, отдых 1–2 минуты. Остановитесь, когда подход из ${amount(lo, unit, l)} ощущается так, будто в запасе ещё 2–3 повторения. Этот вес станет рабочим; сделайте с ним оставшиеся подходы.`
    : `First time on this exercise: start light and do sets of ${lo}, adding ${num(inc, l)} kg each set and resting 1–2 min. Stop when a set of ${lo} feels like 2–3 more reps were possible. That weight becomes your working weight; do the remaining sets with it.`);
}

/**
 * Progression memory for an exercise that has never been logged: conservative start load, target at the bottom of
 * the range, `sessions: 0` so the first logged session runs as a calibration (test) session.
 * `mode` is accepted as an alias of `goal` (master plan §7 wording).
 * @param {Exercise} exercise
 * @param {{ bodyweightKg?: number | null, goal?: GoalMode, mode?: GoalMode, now?: Date | string | number, repRange?: [number, number], rir?: number, gym?: Gym | null }} [opts]
 * @returns {ExerciseState}
 */
export function initialState(exercise, { bodyweightKg, goal, mode, now, repRange, rir, gym } = {}) {
  const role = roleParams(goal ?? mode ?? "recomp", exerciseRole(exercise));
  const range = repRange ?? rangeForUnit(role, unitOf(exercise), exercise);
  return {
    exerciseId: exercise.id,
    workingKg: startingLoad(exercise, { bodyweightKg, gym }),
    targetReps: range[0],
    repRange: [range[0], range[1]],
    rir: rir ?? role.rir,
    e1rm: 0,
    lastOutcome: "init",
    fails: 0,
    sessions: 0,
    baseline: { status: "learning" },
    lastAt: null,
    note: firstSessionTestProtocol(exercise, { repRange: range, gym }),
    updatedAt: toIso(now),
  };
}

/* ------------------------------------------------------------------ next session */

/**
 * Largest load step (fraction) that still lands inside the range at the same RIR, Epley-based (research/02 §D).
 * @param {number} lo @param {number} hi @param {number} rir
 */
export const maxStepFraction = (lo, hi, rir) => (30 + hi + rir) / (30 + lo + rir) - 1;

/** @param {unknown} x @returns {x is Exercise} */
const isExerciseObject = (x) => typeof x === "object" && x !== null && !(x instanceof Date) && typeof (/** @type {any} */ (x).id) === "string";

/**
 * The catalog entry for a state's exercise, or a neutral stand-in (selectorized, 2.5 kg steps) when the catalog does
 * not know the id. @param {ExerciseState} state @returns {Exercise}
 */
function exerciseFor(state) {
  return catalogExerciseById(state.exerciseId) ?? {
    id: state.exerciseId,
    name: { en: state.exerciseId, ru: state.exerciseId },
    equipment: "selectorized",
    pattern: "horizontal-push",
    primary: [],
    secondary: [],
    difficulty: 1,
    unilateral: false,
    supported: true,
    increment: 2.5,
    repRange: [state.repRange[0], state.repRange[1]],
    alternatives: [],
    cues: { en: [], ru: [] },
    mistakes: { en: [], ru: [] },
  };
}

/** The most common load among sets (ties → the harder one). @param {LoggedSet[]} sets @param {Exercise} ex */
function modeLoad(sets, ex) {
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const s of sets) counts.set(r2(s.kg), (counts.get(r2(s.kg)) ?? 0) + 1);
  let best = r2(sets[0].kg);
  for (const [kg, n] of counts) {
    const bn = counts.get(best) ?? 0;
    if (n > bn || (n === bn && isHarder(kg, best, ex))) best = kg;
  }
  return best;
}

/**
 * Highest rep target that rep work climbs to while the next load step is too big for the session's e1RM (master plan
 * §16 rule 2; templates.json rules.repCeiling): 15 for compounds, 20 for isolation and small muscles, never below the
 * top of the range. Holds and carries keep RULES.maxWidenReps steps past the top.
 * @param {Exercise} exercise @param {number} top
 */
export function repCeiling(exercise, top) {
  const unit = unitOf(exercise);
  if (unit !== "reps") return top + RULES.maxWidenReps * (RULES.unitStep[unit] ?? 1);
  return Math.max(top, isCompound(exercise) ? RULES.repCeiling.compound : RULES.repCeiling.isolation);
}

/**
 * True while a weight hold (`ExerciseState.holdUntil`, master plan §16) is still ahead of `at`: a session before that
 * time adds no load. @param {Pick<ExerciseState, "holdUntil"> | null | undefined} state @param {Date | string | number} [at]
 */
export function holdActive(state, at) {
  const until = typeof state?.holdUntil === "string" ? Date.parse(state.holdUntil) : Number.NaN;
  return Number.isFinite(until) && until > toMs(at);
}

/** "20 Nov" / "20 нояб." in the device's time zone, as the tracker shows a hold. @param {string} iso @param {Lang} lang */
export const holdDay = (iso, lang) => new Date(iso).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short" });
/** A sentence end after a date: "20 нояб." already has one, "20 мая" and "20 Nov" do not. @param {string} s */
const endSentence = (s) => (s.endsWith(".") ? s : `${s}.`);

/**
 * The plateau memory of a state (`ExerciseState.plateau`, master plan §16 rule 5), or null: none stored, or a malformed
 * value (not an object; `kg`, `times` or `streak` not a finite number, kg or streak below 0, times below 1).
 * @param {Pick<ExerciseState, "plateau"> | null | undefined} state @returns {Plateau | null}
 */
export function plateauOf(state) {
  const p = /** @type {unknown} */ (state?.plateau);
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const { kg, times, streak } = /** @type {Record<string, unknown>} */ (p);
  /** @param {unknown} v @param {number} min @returns {v is number} */
  const atLeast = (v, min) => typeof v === "number" && Number.isFinite(v) && v >= min;
  return atLeast(kg, 0) && atLeast(times, 1) && atLeast(streak, 0) ? { kg, times, streak } : null;
}

/**
 * Next session's targets from what was logged (DP-RIR-4, research/02 §C, master plan §16):
 * - a set is MADE when reps ≥ target and RIR ≥ target RIR − 1 (logged RIR is ±1); a missing RIR counts as planned;
 * - all made, below the top → target + 1, or more when the weakest set had reps in reserve beyond the target RIR
 *   (its reps + RIR − target RIR; rule 3: RIR is never ignored), at most the top;
 * - all made at the top → the hardest of: one load step (the increment, or stepPct if bigger), a double step after
 *   an overshoot (first set ≥ top + overshootReps with RIR ≥ target + 1), and — when every set was logged with
 *   RIR ≥ target + 1 — the load the weakest set implies for the bottom of the range (rule 3); jumps are capped at
 *   +doubleStepCapPct %. Each must pass the CAPACITY GUARD (rule 2): by Epley's equation the weakest set still allows
 *   the bottom of the range at the target RIR at the new load — new ÷ old ≤ (30 + reps + RIR) ÷ (30 + bottom + target
 *   RIR) in effective kg, maxStepFraction with what was logged.
 *   None passes → the target keeps rising past the top (repCeiling: 15 compounds, 20 isolation); at the ceiling the
 *   load stays and the state is flagged `variant: "smaller-steps"`; no load to add (bodyweight, band, no assistance
 *   left) → flagged `variant: "harder"`;
 * - fewer working sets than `opts.plannedSets` → hold, nothing else changes (rule 4); a set below the range still
 *   counts as a miss, and a test session still re-anchors;
 * - any set below target but within the range → hold (target follows the weakest set + 1);
 * - any set below the range → `failed`, fails + 1; at failsBeforeDeload → −deloadPct and fails reset (`deloaded`);
 *   with nothing lighter to go to (bodyweight with no added load, a machine's lightest setting) the load stays, and
 *   the note says so with no cut;
 * - a hold ahead of the session (`state.holdUntil`) → no load increase and no target past the top; reps still rise
 *   within the range, misses and deloads still apply; a hold that has passed is cleared (also with no working sets);
 * - holds/carries move by +5 s / +5 m to the top, then add load when loadable; assisted: progress = less assistance;
 * - rule `rpe`: the next load is the one the session's e1RM implies for the next target, within ±10 % (never lighter
 *   after a progressed session, never heavier during a hold); not in a test session (its re-anchor decides, as under
 *   every rule), and not where the note names the load to keep: a hold or a rule-5 wait at the top, reps to earn the
 *   step back, an incomplete log (rule 4), no assistance left. Where it moves the load off the one the note named, the
 *   note names the load it plans instead ("By effort: 55 kg × 6 reps next time (−5 kg)"), after the session's reason;
 * - plateau memory (rule 5, `state.plateau`): a deload that lowers the load remembers the load it came down from
 *   (`times` + 1 when it is that load again). A step from below that load to it or harder waits for min(3, 1 + times)
 *   sessions in a row at the planned load with every set at the top and the capacity guard passing for that load
 *   (`streak`, this session included): until then the hardest passing step below it, else the load holds at the top
 *   with a note. After a second deload from it the guard asks for 2 more reps in hand (`spareReps`), earned with reps
 *   first (not at the rep ceiling, where the guard alone decides, so the wait always ends). The `rpe` rule keeps the
 *   load of a wait and stops one step below that load otherwise. A test session counts like any other, from its
 *   planned load (its lighter sets are the ramp-up): its re-anchor, or a ramp that reached that load, stops one step
 *   below it. A load change, a session that does not count or a miss resets the streak; an incomplete log leaves it.
 *   The memory clears after a complete session past that load with no set below the range;
 * - first session (sessions 0), or `calibration`: the e1RM of the best set re-anchors the working load and misses do
 *   not count ("Start lighter" only for a lighter load: one that stays says "Keep"). Logging a load other than the
 *   planned one re-anchors on what was lifted.
 * The master-plan form `nextState(state, loggedSets, rules, now)` (no exercise) looks the exercise up in the catalog.
 * @param {ExerciseState} state @param {LoggedSet[]} loggedSets  this exercise's sets in one session (warm-ups ignored)
 * @param {ProgressionParams} params @param {Exercise | Date | string | number} [exercise]
 * @param {Date | string | number} [now]
 * @param {{ bodyweightKg?: number | null, gym?: Gym | null, calibration?: boolean, at?: string, plannedSets?: number | null }} [opts]
 *   `plannedSets`: working sets the session prescribed for this exercise (rule 4); omitted → not checked
 * @returns {{ state: ExerciseState, outcome: Outcome, note: Text2 }}
 */
export function nextState(state, loggedSets, params, exercise, now, opts = {}) {
  if (!isExerciseObject(exercise)) return nextState(state, loggedSets, params, exerciseFor(state), exercise, opts);
  const updatedAt = toIso(now);
  const unit = unitOf(exercise);
  const uStep = RULES.unitStep[unit] ?? 1;
  const R = params.rir;
  const tol = RULES.rirTolerance;
  const rule = params.rule ?? "double";
  const bw = opts.bodyweightKg ?? null;
  const gym = opts.gym ?? null;
  const ctx = { gym, bodyweightKg: bw };
  const assisted = isAssisted(exercise);
  const inc = incrementFor(exercise, gym);
  const loadable = inc > 0 && exercise.equipment !== "band" && rule !== "rep-target";
  const calibration = Boolean(opts.calibration) || (state.sessions ?? 0) === 0;
  let lo = params.repRange[0];
  const top = params.repRange[1];
  if (rule === "linear") lo = top;

  let sets = loggedSets.filter((s) => s.kind === "working" || s.kind === "amrap");
  if (!sets.length) sets = loggedSets.filter((s) => s.kind === "backoff");
  sets = sets.filter((s) => Number.isFinite(s.reps) && s.reps >= 0 && Number.isFinite(s.kg) && s.kg >= 0)
    .sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0) || (a.doneAt ?? "").localeCompare(b.doneAt ?? ""));
  if (!sets.length) {
    const note = text2((l) => (l === "ru" ? "Пропущено: цели без изменений." : "Skipped: targets unchanged."));
    /** @type {ExerciseState} */
    const kept = { ...state, note, updatedAt };
    // a hold that has passed is cleared here too
    if (state.holdUntil != null && !holdActive(state, opts.at ?? updatedAt)) kept.holdUntil = null;
    return { state: kept, outcome: "held", note };
  }
  const doneTimes = sets.map((s) => s.doneAt).filter((t) => typeof t === "string" && !Number.isNaN(Date.parse(t))).sort();
  const lastAt = opts.at ?? doneTimes[doneTimes.length - 1] ?? updatedAt;
  const holding = holdActive(state, lastAt);
  /** @param {LoggedSet} s */
  const rirOf = (s) => (s.rir == null ? R : s.rir);

  // e1RM: best reliable set of this session (effective load), kept as the best seen; unrounded here, because the
  // 0.01 kg display rounding can tip the calibration below onto the next plate down (51.714 → 51.71 → 39.997 kg)
  let best = 0;
  if (unit === "reps") {
    for (const s of sets) {
      const eff = effectiveKg(s.kg, exercise, bw);
      if (!eff || s.reps < 1) continue;
      const total = s.reps + (s.rir ?? R);
      if (total <= RULES.reliableTotalReps) best = Math.max(best, eff * e1rmFactor(total));
    }
  }
  const e1rm = Math.max(state.e1rm || 0, r2(best));

  const L = modeLoad(sets, exercise);
  const onPlan = sameKg(L, state.workingKg);
  const maxT = repCeiling(exercise, top);
  const T = clamp(state.targetReps ?? lo, lo, maxT);
  const Tref = onPlan ? T : lo;
  const topEff = Math.max(top, onPlan ? T : top);
  // sets at the most common load decide (ties → the harder load); lighter sets mean the weight had to come down
  // and count as misses — except in a test session, where they are the ramp-up; heavier one-off attempts only
  // feed the e1RM
  const atLoad = sets.filter((s) => sameKg(s.kg, L));
  const lighter = calibration ? [] : sets.filter((s) => isHarder(L, s.kg, exercise));
  /** @param {LoggedSet} s */
  const made = (s) => s.reps >= Tref && rirOf(s) >= R - tol;
  // A failed attempt at ANY working load matters. Warm-ups have already been excluded.
  const intendedMade = sets.every((s) => s.reps >= Math.max(lo, s.plannedReps || Tref) && rirOf(s) >= R - tol);
  const below = sets.some((s) => s.reps < lo);
  const effortKnown = unit !== "reps" || sets.every((s) => s.rir != null && s.prescription?.rirReported !== false);
  const learning = (state.sessions ?? 0) === 0 || state.baseline?.status === "learning";
  const allMade = atLoad.every(made) && lighter.length === 0 && intendedMade && (!learning || effortKnown);
  const allTop = allMade && atLoad.every((s) => s.reps >= topEff);
  const minR = Math.min(...atLoad.map((s) => s.reps));
  // rule 3: what the weakest set would have reached at the target RIR (6 reps with 5 in reserve at RIR 2 → 9)
  const atTarget = unit === "reps" ? Math.min(...atLoad.map((s) => s.reps + Math.max(0, rirOf(s) - R))) : 0;
  const N = params.failsBeforeDeload;
  const planned = opts.plannedSets ?? 0;
  const incomplete = planned > 0 && sets.length < planned;
  // rule 2: the weakest set at the working load (its reps + RIR). By Epley's equation — the one maxStepFraction uses —
  // a load × (30 + reps + RIR) / (30 + bottom + target RIR) still allows the bottom of the range at the target RIR;
  // for a set at the top at the target RIR that is exactly maxStepFraction. In effective kg: bodyweight and
  // assistance use the 80 kg reference when no body weight is known
  const bwRef = bw && bw > 0 ? bw : RULES.bodyweightRefKg;
  /** @param {number} kg */
  const effRef = (kg) => effectiveKg(kg, exercise, bwRef) ?? 0;
  const weakest = unit === "reps" ? Math.min(...atLoad.map((s) => s.reps + rirOf(s))) : 0;
  const reach = (30 + weakest) / (30 + lo + R);
  // rule 5: the load a deload came down from, until a complete session past it stays in the range (test sessions
  // too). The streak counts sessions in a row at the planned load with every set at the top whose sets carry that load
  // (the capacity guard below), this one included; an incomplete log leaves it, another load than planned starts it
  // over. A test session counts like any other; its step starts from the planned load, its lighter sets being the ramp-up
  const remembered = plateauOf(state);
  const plateau = remembered && (incomplete || below || !isHarder(L, remembered.kg, exercise)) ? remembered : null;
  const from = calibration ? state.workingKg : L;
  /** a step from below the load that ended in a deload to that load or harder @param {number} kg */
  const back = (kg) => plateau != null && isHarder(plateau.kg, from, exercise) && !isHarder(plateau.kg, kg, exercise);
  /** after a second deload from it, more reps in hand for the step back (not at the rep ceiling: the wait ends) @param {number} kg */
  const margin = (kg) => (plateau != null && plateau.times >= 2 && topEff < maxT && back(kg) ? RULES.plateau.spareReps : 0);
  /** rule 2: the weakest set still allows the bottom of the range at the target RIR at `kg` (whole reps, no rounding up) @param {number} kg */
  const carries = (kg) => unit !== "reps" || !(effRef(L) > 0) || effRef(kg) * (30 + lo + R + margin(kg)) <= effRef(L) * (30 + weakest) + 1e-9;
  const before = plateau && onPlan ? plateau.streak : 0;
  const streak = !plateau ? 0 : incomplete && !below ? before : allTop && carries(plateau.kg) ? before + 1 : 0;
  const need = plateau ? Math.min(RULES.plateau.maxSessions, 1 + plateau.times) : 0;
  /** a step back to the load that ended in a deload before enough sessions at the top @param {number} kg */
  const waits = (kg) => streak < need && back(kg);
  /** what a load that waits becomes: one step below the load that ended in a deload, never lighter than the start @param {number} kg */
  const underPlateau = (kg) => {
    if (!plateau || !waits(kg)) return kg;
    const under = roundLoad(easier(plateau.kg, inc, exercise), exercise, gym, "easier");
    return isHarder(under, from, exercise) ? under : from;
  };
  /** how often the load that waits ended in a deload: "в прошлый раз" / "уже 2 раза", "ended in a deload last time" / "… 2 times" @param {Plateau} p @param {Lang} l */
  const howOften = (p, l) => (l === "ru"
    ? (p.times >= 2 ? `уже ${num(p.times, l)} ${pluralRu(p.times, ["раз", "раза", "раз"])}` : "в прошлый раз")
    : (p.times >= 2 ? `has ended in a deload ${num(p.times, l)} times` : "ended in a deload last time"));
  /** why the next load stays below the one that ended in a deload (a note's last sentence) @param {Plateau | null} p @returns {Text2} */
  const easierThan = (p) => (p ? text2((l) => (l === "ru"
    ? (p.times >= 2
      ? ` Пока легче, чем ${thanRu(p.kg, exercise)}: эта нагрузка ${howOften(p, l)} заканчивалась разгрузкой.`
      : ` Пока легче, чем ${thanRu(p.kg, exercise)}: ${howOften(p, l)} эта нагрузка закончилась разгрузкой.`)
    : ` Easier than ${loadText(p.kg, exercise, l)} for now: it ${howOften(p, l)}.`)) : { en: "", ru: "" });
  // the rpe rule below keeps the load where the note names it: a hold or a rule-5 wait at the top, reps to earn the step
  // back (rule 5), a log with sets left out (rule 4), no assistance left
  let keeps = false;
  // RU: assistance and bodyweight are a load, not a weight ("Та же нагрузка (помощь 40 кг)", not "Тот же вес (помощь
  // 40 кг)"), as in the break notes
  const asLoad = assisted || isBodyweight(exercise);
  /** a test session that keeps the load it lifted: its misses do not count yet @param {Lang} l */
  const keepTested = (l) => (l === "ru"
    ? `Первые тренировки в этом упражнении: неудачи пока не считаются. Оставьте ${loadText(L, exercise, l)}, цель — ${amount(lo, unit, l)}.`
    : `First sessions on this exercise: misses do not count yet. Keep ${loadText(L, exercise, l)} and aim for ${amount(lo, unit, l)}.`);

  /** @type {Outcome} */
  let outcome = "held";
  let nextKg = L;
  let nextT = Tref;
  let fails = state.fails ?? 0;
  /** @type {ExerciseState["variant"]} */
  let variant;
  /** @type {Text2} */
  let note;

  const effL = effectiveKg(L, exercise, bw);
  // nothing to re-anchor without a load step (bodyweight, bands): the test session only sets the reps; it does not
  // jump back to a load that ended in a deload before the confirmation either (rule 5)
  const reanchor = calibration && best > 0 && loadable
    ? roundLoad(fromEffective(best * loadFraction(lo + R + RULES.calibrationExtraRir), exercise, bw), exercise, gym, "easier")
    : null;
  const calibrated = reanchor == null ? null : underPlateau(reanchor);

  if (calibrated != null && ((allMade && !incomplete && !holding && sets.every((s) => s.rir != null && s.prescription?.rirReported !== false) && carries(calibrated) && isHarder(calibrated, L, exercise)) || (!allMade && below))) {
    // test session: the best set re-anchors the working load (raise after an easy start, lower after a heavy one;
    // a hold blocks the raise)
    nextKg = allMade ? calibrated : (isHarder(calibrated, L, exercise) ? L : calibrated);
    nextT = lo;
    fails = 0;
    outcome = isHarder(nextKg, L, exercise) ? "progressed" : "held";
    const k = nextKg;
    // rule 5: a re-anchor that stopped below the load that ended in a deload says why
    const why = easierThan(allMade && reanchor != null && waits(reanchor) ? plateau : null);
    // "Start lighter" only names a lighter load: one that cannot get lighter (no assistance, the hardest setting), or a
    // best set that asks for more after a set below the range, keeps the load lifted
    note = text2((l) => (isHarder(k, L, exercise)
      ? (l === "ru" ? `Тест пройден: ${workingRu(k, exercise)} × ${amount(lo, unit, l)} по лучшему подходу.${why.ru}` : `Test done: working load ${loadText(k, exercise, l)} × ${amount(lo, unit, l)} from your best set.${why.en}`)
      : isHarder(L, k, exercise)
        ? (l === "ru" ? `Начните легче: ${loadText(k, exercise, l)} × ${amount(lo, unit, l)}, чтобы каждый подход укладывался в диапазон.` : `Start lighter: ${loadText(k, exercise, l)} × ${amount(lo, unit, l)}, so every set stays in the range.`)
        : keepTested(l)));
  } else if (calibration && loadable && waits(L)) {
    // rule 5: a test from below the load that ended in a deload whose ramp reached it (or went past it in a session
    // that keeps the memory): one step below it until the confirmation, from the bottom of the range
    nextKg = underPlateau(L);
    nextT = lo;
    fails = 0;
    outcome = "held";
    const k = nextKg;
    const why = easierThan(plateau);
    note = text2((l) => (l === "ru"
      ? `Тест пройден: ${workingRu(k, exercise)} × ${amount(lo, unit, l)}.${why.ru}`
      : `Test done: working load ${loadText(k, exercise, l)} × ${amount(lo, unit, l)}.${why.en}`));
  } else if (below) {
    nextT = lo;
    if (calibration) {
      outcome = "held";
      note = text2(keepTested);
    } else {
      fails += 1;
      if (fails >= N) {
        nextKg = scaleLoad(L, 1 - params.deloadPct / 100, exercise, ctx, "easier");
        if (!isHarder(L, nextKg, exercise) && inc) {
          const e = easier(L, inc, exercise);
          // already at the lightest setting of a machine: stay there
          if (e > 0 || assisted || ZERO_OK.has(exercise.equipment)) nextKg = roundLoad(e, exercise, gym, "easier");
        }
        fails = 0;
        outcome = "deloaded";
        const k = nextKg;
        // nothing lighter to go to (bodyweight with no added load, a machine at its lightest setting): the load stays,
        // and the note says so, with no cut
        const stays = !isHarder(L, k, exercise);
        note = text2((l) => (l === "ru"
          ? `${N} ${pluralRu(N, ["тренировка", "тренировки", "тренировок"])} подряд меньше ${amount(lo, unit, l)}: ${stays ? `оставайтесь ${withLoadRu(k, exercise)}` : `${dropRu(k, exercise)} (−${num(params.deloadPct, l)} %${assisted ? " нагрузки" : ""})`} и наберите заново.`
          : `${N} sessions in a row below ${amount(lo, unit, l)}: ${stays ? `stay at ${loadText(k, exercise, l)}` : `drop to ${loadText(k, exercise, l)} (−${num(params.deloadPct, l)} %)`} and build back up.`));
      } else {
        outcome = "failed";
        const f = fails;
        note = text2((l) => (l === "ru"
          ? `В подходе меньше ${amount(lo, unit, l)}: оставьте ${loadText(L, exercise, l)}, цель — ${amount(lo, unit, l)} (неудача ${f} из ${N}).`
          : `A set fell below ${amount(lo, unit, l)}: keep ${loadText(L, exercise, l)} and aim for ${amount(lo, unit, l)} (miss ${f} of ${N}).`));
      }
    }
  } else if (incomplete) {
    // rule 4: a session with sets left out says nothing about the next step; the target and the miss count stay
    outcome = "held";
    keeps = true;
    const k = sets.length;
    note = text2((l) => (l === "ru"
      ? `Записано ${k} из ${planned} рабочих подходов: в следующий раз снова ${loadText(L, exercise, l)} × ${amount(Tref, unit, l)}.`
      : `Only ${k} of ${planned} working sets logged: ${loadText(L, exercise, l)} × ${amount(Tref, unit, l)} again next time.`));
  } else if (allMade && allTop) {
    fails = 0;
    const cannotLoad = !loadable || (assisted && L <= 0);
    if (cannotLoad) {
      outcome = "held";
      nextT = topEff;
      keeps = true;
      if (rule !== "rep-target") variant = "harder";
      note = text2((l) => (assisted
        ? (l === "ru" ? "Помощь больше не нужна — можно переходить к варианту без помощи." : "No assistance left — you are ready for the bodyweight version.")
        : (l === "ru" ? "Верх диапазона, а вес добавить нельзя: возьмите более сложный вариант или отягощение." : "Top of the range with no load to add: move to a harder variant or add weight.")));
    } else if (holding) {
      outcome = "held";
      nextT = topEff;
      keeps = true;
      const until = /** @type {string} */ (state.holdUntil);
      note = text2((l) => (l === "ru"
        ? `Все подходы дошли до ${amount(topEff, unit, l)}, но вес зафиксирован до ${endSentence(holdDay(until, l))} Оставьте ${loadText(L, exercise, l)} × ${amount(topEff, unit, l)}.`
        : `Every set reached ${amount(topEff, unit, l)}, but the weight is held until ${endSentence(holdDay(until, l))} Keep ${loadText(L, exercise, l)} × ${amount(topEff, unit, l)}.`));
    } else {
      const base = effL ?? (assisted ? 0 : L);
      const step = Math.max(inc, (base * params.stepPct) / 100);
      const cap = Math.max(step, (base * RULES.doubleStepCapPct) / 100);
      let single = roundLoad(harder(L, step, exercise), exercise, gym, "nearest");
      if (!isHarder(single, L, exercise)) single = roundLoad(harder(L, inc, exercise), exercise, gym, "nearest");
      const first = atLoad[0];
      const overshoot = first.reps >= topEff + params.overshootReps * uStep && (first.rir == null || first.rir >= R + 1);
      /** @type {{ kg: number, why: "step" | "overshoot" | "easy" }[]} */
      const options = [{ kg: single, why: "step" }, { kg: roundLoad(harder(L, inc, exercise), exercise, gym, "nearest"), why: "step" }];
      // double steps and e1RM jumps round the easier way: the nearest plate could overshoot the cap (40 kg + 10 % → 45)
      if (overshoot) options.push({ kg: roundLoad(harder(L, Math.min(2 * step, cap), exercise), exercise, gym, "easier"), why: "overshoot" });
      const effNow = effRef(L);
      // rule 3: every set logged with RIR ≥ target + 1 → the load the weakest set implies for the bottom of the range
      if (unit === "reps" && effNow > 0 && atLoad.every((s) => s.rir != null && s.rir >= R + 1)) {
        const want = Math.min(effNow * reach, effNow + cap);
        options.push({ kg: roundLoad(fromEffective(want, exercise, bwRef), exercise, gym, "easier"), why: "easy" });
      }
      /** @type {{ kg: number, why: "step" | "overshoot" | "easy" } | null} */
      let pick = null;
      for (const o of options) if (isHarder(o.kg, L, exercise) && carries(o.kg) && (!pick || isHarder(o.kg, pick.kg, exercise))) pick = o;
      // rule 5: not back to the load that ended in a deload before enough sessions at the top: the hardest passing
      // option below it, else hold at the top
      const wait = pick != null && waits(pick.kg);
      if (wait) {
        pick = null;
        for (const o of options) if (isHarder(o.kg, L, exercise) && carries(o.kg) && !waits(o.kg) && (!pick || isHarder(o.kg, pick.kg, exercise))) pick = o;
      }
      // … nor, after a second deload from it, a step back that the guard passes only without the reps to spare
      const earn = options.some((o) => isHarder(o.kg, L, exercise) && margin(o.kg) > 0 && !carries(o.kg) && effRef(o.kg) <= effNow * reach + 1e-9);
      const d = Math.abs(single - L);
      if (pick) {
        outcome = "progressed";
        nextKg = pick.kg;
        nextT = lo;
        const target = pick.kg;
        const dd = Math.abs(target - L);
        const why = pick.why === "overshoot"
          ? text2((l) => (l === "ru" ? `большой шаг: первый подход — ${amount(first.reps, unit, l)} с запасом` : `big jump: the first set went ${amount(first.reps, unit, l)} with reps to spare`))
          : pick.why === "easy"
            ? text2((l) => (l === "ru" ? `все подходы дошли до ${amount(topEff, unit, l)} с запасом ${num(R + 1, l)}+` : `every set reached ${amount(topEff, unit, l)} with ${num(R + 1, l)}+ in reserve`))
            : text2((l) => (l === "ru" ? `все подходы дошли до ${amount(topEff, unit, l)}` : `every set reached ${amount(topEff, unit, l)}`));
        // rule 5: a smaller step than the sets carry, below the load that ended in a deload; or, after a second deload
        // from it, no bigger step back than the reps to spare allow
        const p = (wait || earn) && plateau ? plateau : null;
        const smaller = !p || !back(target) ? easierThan(p) : text2((l) => (l === "ru"
          ? ` Пока только этот шаг: эта нагрузка (${loadText(p.kg, exercise, l)}) ${howOften(p, l)} заканчивалась разгрузкой.`
          : ` Only this step for now: ${loadText(p.kg, exercise, l)} ${howOften(p, l)}.`));
        note = text2((l) => (assisted
          ? (l === "ru" ? `На ${num(dd, l)} кг меньше помощи (${loadText(target, exercise, l)} × ${amount(lo, unit, l)}): ${why.ru}.${smaller.ru}` : `${num(dd, l)} kg less assistance (${loadText(target, exercise, l)} × ${amount(lo, unit, l)}): ${why.en}.${smaller.en}`)
          : (l === "ru" ? `+${num(dd, l)} кг в следующий раз (${loadText(target, exercise, l)} × ${amount(lo, unit, l)}): ${why.ru}.${smaller.ru}` : `+${num(dd, l)} kg next time (${loadText(target, exercise, l)} × ${amount(lo, unit, l)}): ${why.en}.${smaller.en}`)));
      } else if (wait && plateau) {
        // rule 5: the next step is the load that ended in a deload: the same load at the top until enough sessions there
        // that count (the same load, every set at the top, the guard passing for that load)
        outcome = "held";
        nextT = topEff;
        keeps = true;
        const p = plateau;
        const left = need - streak;
        note = text2((l) => (l === "ru"
          ? `Все подходы дошли до ${amount(topEff, unit, l)}, но следующий шаг (${loadText(p.kg, exercise, l)}) ${howOften(p, l)} ${p.times >= 2 ? "заканчивался" : "закончился"} разгрузкой: оставьте ${loadText(L, exercise, l)} × ${amount(topEff, unit, l)} ещё на ${num(left, l)} ${pluralRu(left, ["такую же тренировку", "такие же тренировки", "таких же тренировок"])}, потом пробуйте снова.${p.times >= 2 ? " Шаг крупный: возьмите вариант с меньшим шагом или микроблины." : ""}`
          : `Every set reached ${amount(topEff, unit, l)}, but the next step (${loadText(p.kg, exercise, l)}) ${howOften(p, l)}: keep ${loadText(L, exercise, l)} × ${amount(topEff, unit, l)} for ${num(left, l)} more ${left === 1 ? "session" : "sessions"} like this one, then try it again.${p.times >= 2 ? " The step is big: switch to a variant with smaller steps or add micro-plates." : ""}`));
      } else if (topEff < maxT) {
        // rule 2: more reps first, as many as the sets' reps in reserve say (at least one), up to the ceiling
        outcome = "progressed";
        nextT = Math.min(maxT, Math.max(topEff + uStep, atTarget));
        const t = nextT;
        if (earn && plateau) {
          // rule 5: the guard passes the step back to the load that ended in a deload twice, but not with the reps to spare
          keeps = true;
          const p = plateau;
          note = text2((l) => (l === "ru"
            ? `Все подходы дошли до ${amount(topEff, unit, l)}, но следующий шаг (${loadText(p.kg, exercise, l)}) ${howOften(p, l)} заканчивался разгрузкой: сначала сделайте ${amount(t, unit, l)} ${withLoadRu(L, exercise)}. Шаг крупный: возьмите вариант с меньшим шагом или микроблины.`
            : `Every set reached ${amount(topEff, unit, l)}, but the next step (${loadText(p.kg, exercise, l)}) ${howOften(p, l)}: earn it with ${amount(t, unit, l)} at ${loadText(L, exercise, l)} first. The step is big: switch to a variant with smaller steps or add micro-plates.`));
        } else {
          note = text2((l) => (l === "ru"
            ? `Следующий шаг (${num(d, l)} кг) — большой скачок для ${asLoad ? "этой нагрузки" : "этого веса"}: сначала сделайте ${amount(t, unit, l)} ${withLoadRu(L, exercise)}.`
            : `The next step (${num(d, l)} kg) is a big jump at this weight: earn it with ${amount(t, unit, l)} at ${loadText(L, exercise, l)} first.`));
        }
      } else {
        // at the ceiling and still too big: stay, and let the planner suggest a variant with smaller steps
        outcome = "held";
        nextT = topEff;
        variant = "smaller-steps";
        note = text2((l) => (l === "ru"
          ? `Следующий шаг (${num(d, l)} кг) слишком велик даже после ${amount(topEff, unit, l)} ${withLoadRu(L, exercise)}: оставьте ${asLoad ? "эту нагрузку" : "этот вес"} и возьмите вариант с меньшим шагом или микроблины.`
          : `The next step (${num(d, l)} kg) is too big even after ${amount(topEff, unit, l)} at ${loadText(L, exercise, l)}: stay here and switch to a variant with smaller steps or add micro-plates.`));
      }
    }
  } else if (allMade) {
    fails = 0;
    outcome = "progressed";
    nextT = Math.min(topEff, Math.max(Tref + uStep, minR + uStep, atTarget));
    const t = nextT;
    note = text2((l) => (l === "ru"
      ? `${asLoad ? "Та же нагрузка" : "Тот же вес"} (${loadText(L, exercise, l)}), цель — ${amount(t, unit, l)} в каждом подходе: все подходы дошли до ${amount(Tref, unit, l)}.`
      : `Same load (${loadText(L, exercise, l)}), aim for ${amount(t, unit, l)} on every set: all sets reached ${amount(Tref, unit, l)}.`));
  } else {
    fails = 0;
    outcome = "held";
    nextT = clamp(Math.max(minR + uStep, atTarget), lo, Tref);
    const t = nextT;
    note = text2((l) => (l === "ru"
      ? `Повторите ${repeatRu(L, exercise)}, цель — ${amount(t, unit, l)}: не все подходы дошли до ${amount(Tref, unit, l)} с запасом ${num(R, l)}.`
      : `Repeat ${loadText(L, exercise, l)} and aim for ${amount(t, unit, l)}: not every set reached ${amount(Tref, unit, l)} with ${num(R, l)} in reserve.`));
  }

  // the rpe rule: not in a test session (the re-anchor above already turns its e1RM into the load, with one more rep in
  // reserve and rounded the easier way, under every rule) and not where the note names the load to keep
  if (rule === "rpe" && best > 0 && outcome !== "deloaded" && loadable && !calibration && !keeps) {
    // e1RM-driven load for the next target, within ±10 % of what was lifted; never lighter after a good session,
    // never heavier during a hold
    const raw = fromEffective(best * loadFraction(nextT + R), exercise, bw);
    const span = Math.max(inc, (effL ?? L) * 0.1);
    let k = roundLoad(clamp(raw, L - span, L + span), exercise, gym, "nearest");
    if (outcome === "progressed" && isHarder(L, k, exercise)) k = L;
    if ((holding || !allMade || incomplete) && isHarder(k, L, exercise)) k = L;
    // rule 5: no jump to the load that ended in a deload before enough sessions at the top, one step below it at most
    const named = nextKg;
    nextKg = underPlateau(k);
    if (!sameKg(nextKg, named)) {
      // the branch's note named another load: keep its reason, and name the load the e1RM plans (and, when rule 5
      // stopped it below the load that ended in a deload, why)
      const kk = nextKg;
      const t = nextT;
      const f = fails;
      const d = Math.abs(kk - L);
      const reached = allTop ? topEff : Tref;
      const why = text2((l) => (outcome === "failed"
        ? (l === "ru" ? `В подходе меньше ${amount(lo, unit, l)} (неудача ${f} из ${N}).` : `A set fell below ${amount(lo, unit, l)} (miss ${f} of ${N}).`)
        : allMade
          ? (l === "ru" ? `Все подходы дошли до ${amount(reached, unit, l)}.` : `Every set reached ${amount(reached, unit, l)}.`)
          : (l === "ru" ? `Не все подходы дошли до ${amount(Tref, unit, l)} с запасом ${num(R, l)}.` : `Not every set reached ${amount(Tref, unit, l)} with ${num(R, l)} in reserve.`)));
      /** the change from the load lifted: "+2.5 kg", "5 kg more assistance", "same load" @param {Lang} l */
      const change = (l) => {
        const kg = `${num(d, l)} ${l === "ru" ? "кг" : "kg"}`;
        if (isHarder(kk, L, exercise)) return assisted ? (l === "ru" ? `на ${kg} меньше помощи` : `${kg} less assistance`) : `+${kg}`;
        if (isHarder(L, kk, exercise)) return assisted ? (l === "ru" ? `на ${kg} больше помощи` : `${kg} more assistance`) : `−${kg}`;
        return l === "ru" ? (asLoad ? "та же нагрузка" : "тот же вес") : "same load";
      };
      const capped = easierThan(sameKg(kk, k) ? null : plateau);
      note = text2((l) => (l === "ru"
        ? `${why.ru} По усилию: ${loadText(kk, exercise, l)} × ${amount(t, unit, l)} в следующий раз (${change(l)}).${capped.ru}`
        : `${why.en} By effort: ${loadText(kk, exercise, l)} × ${amount(t, unit, l)} next time (${change(l)}).${capped.en}`));
    }
  }
  // An off-plan heavier attempt is evidence, not permission to raise next visit's original anchor after a miss.
  if ((!intendedMade || incomplete) && isHarder(nextKg, state.workingKg, exercise)) {
    nextKg = state.workingKg;
    if (outcome === "progressed") outcome = "held";
    const k = nextKg;
    note = text2((l) => l === "ru"
      ? `Исходный план не выполнен: в следующий раз ${loadText(k, exercise, l)} × ${amount(nextT, unit, l)}. Прибавки веса нет.`
      : `Original working targets were not completed: ${loadText(k, exercise, l)} × ${amount(nextT, unit, l)} next time. No load increase.`);
  }
  // a load step answers any earlier variant flag
  if (isHarder(nextKg, L, exercise)) variant = null;

  /** @type {ExerciseState} */
  const out = {
    ...state,
    exerciseId: exercise.id,
    workingKg: nextKg,
    targetReps: nextT,
    repRange: [params.repRange[0], params.repRange[1]],
    rir: R,
    e1rm,
    lastOutcome: outcome,
    fails,
    sessions: (state.sessions ?? 0) + 1,
    lastAt,
    note,
    updatedAt,
  };
  if (calibration || state.baseline?.status === "learning") {
    // Confirmation needs repeated performance, a complete prescription and explicitly reported effort.
    // Legacy logs without prescription metadata retain their explicitly stored RIR semantics.
    const observed = atLoad.filter((s) => s.reps >= lo && (unit !== "reps" || (s.rir != null && s.rir >= R - tol && s.prescription?.rirReported !== false)));
    out.baseline = !incomplete && !below && intendedMade && observed.length >= Math.min(2, planned || 2)
      ? { status: "established", kg: L, reps: Math.min(...observed.map((s) => s.reps)), rir: Math.min(...observed.map((s) => s.rir ?? R)), at: lastAt, sessionId: sets[0].sessionId, sets: observed.length }
      : { status: "learning" };
  }
  // a hold that has passed is cleared; states without one do not grow the field
  if (state.holdUntil != null) out.holdUntil = holding ? state.holdUntil : null;
  if (variant !== undefined) out.variant = variant;
  // rule 5: a deload that lowered the load remembers the load it came down from (times + 1 when it is that load again;
  // a machine already at its lightest setting has no step back to wait for); a load change starts the streak over; a
  // malformed or cleared memory becomes null, and states without one do not grow the field
  if (outcome === "deloaded" && isHarder(L, nextKg, exercise)) out.plateau = { kg: L, times: remembered && sameKg(remembered.kg, L) ? remembered.times + 1 : 1, streak: 0 };
  else if (state.plateau != null) out.plateau = plateau && { kg: plateau.kg, times: plateau.times, streak: sameKg(nextKg, L) ? streak : 0 };
  return { state: out, outcome, note };
}

/* ------------------------------------------------------------------ gaps, conversion, substitution */

/**
 * Load for the first session after a break (task spec, softer than research/02 §I; master plan §16 rule 1):
 * < 14 days unchanged; 14–27 days −5 → −10 % (linear); ≥ 28 days −10 → −15 % (linear to 90 days), target back to the
 * bottom of the range, outcome `reset` (the session then runs as a calibration). The cut is rounded to the NEAREST
 * step and applied once (to the state planned from; applySession judges the session against it). When the steps are
 * too coarse for it — the nearest step leaves the load as it was, or cuts more than gapCut.maxMultiple × the intended
 * % — the load stays and the rep target drops by gapCut.repsMinus steps instead (2 reps, 10 s, 10 m; never below the
 * bottom of the range). `pct` is the intended cut; the note quotes the cut applied. The plateau memory (rule 5)
 * stays, so a break does not forget the load that failed; a cut to another load starts its streak over (the streak
 * counts sessions at one load).
 * @param {ExerciseState} state @param {number} daysSince @param {Date | string | number} [now]
 * @param {{ exercise?: Exercise, gym?: Gym | null, bodyweightKg?: number | null }} [opts]
 * @returns {{ state: ExerciseState, outcome: Outcome | null, pct: number, note: Text2 | null }}
 */
export function gapAdjust(state, daysSince, now, { exercise, gym, bodyweightKg } = {}) {
  const g = RULES.gap;
  if (!(daysSince >= g.keepBelowDays)) return { state, outcome: null, pct: 0, note: null };
  const reset = daysSince >= g.longFromDays;
  const t = reset
    ? Math.min(1, (daysSince - g.longFromDays) / (g.longFullAtDays - g.longFromDays))
    : (daysSince - g.keepBelowDays) / (g.longFromDays - g.keepBelowDays);
  const [a, b] = reset ? g.longPct : g.shortPct;
  const pct = Math.round((a + (b - a) * t) * 10) / 10;
  const factor = 1 - pct / 100;
  const ex = exercise ?? catalogExerciseById(state.exerciseId);
  const L = state.workingKg;
  let workingKg = ex ? scaleLoad(L, factor, ex, { gym, bodyweightKg }, "nearest") : r2(L * factor);
  if (ex && isHarder(workingKg, L, ex)) workingKg = L;
  // the cut applied, as a fraction: effective terms for assistance (one step per 10 % without a body weight)
  const bw = bodyweightKg && bodyweightKg > 0 ? bodyweightKg : null;
  const cut = ex && isAssisted(ex)
    ? (bw ? (bw - L > 0 ? (workingKg - L) / (bw - L) : 0) : ((workingKg - L) / (incrementFor(ex, gym) || 5)) * 0.1)
    : (L > 0 ? (L - workingKg) / L : 0);
  const coarse = !(cut > 1e-9) || cut > (RULES.gapCut.maxMultiple * pct) / 100 + 1e-9;
  if (coarse) workingKg = L;
  const unit = ex ? unitOf(ex) : "reps";
  const lo = state.repRange[0];
  const less = RULES.gapCut.repsMinus * (RULES.unitStep[unit] ?? 1);
  const targetReps = reset ? lo : coarse ? Math.max(lo, state.targetReps - less) : state.targetReps;
  const cutPct = coarse ? 0 : Math.round(cut * 1000) / 10;
  const days = Math.floor(daysSince);
  const ex2 = ex ?? /** @type {Exercise} */ ({ equipment: "selectorized" });
  const note = text2((l) => {
    const d = l === "ru" ? `${days} ${pluralRu(days, ["день", "дня", "дней"])}` : `${days} days`;
    const load = loadText(workingKg, ex2, l);
    // RU: the cut is of the load, as on the deload note; after "с помощью 45 кг" a bare "−12,5 %" reads as less assistance
    const cut = `−${num(cutPct, l)} %${l === "ru" && isAssisted(ex2) ? " нагрузки" : ""}`;
    if (reset) {
      const off = cutPct ? ` (${cut})` : "";
      return l === "ru"
        ? `${d} без этого упражнения: начните заново ${withLoadRu(workingKg, ex2)}${off} от нижней границы диапазона; первая тренировка — тестовая.`
        : `${d} since you last did this: restart at ${load}${off} from the bottom of the range; the first session counts as a test.`;
    }
    if (!coarse) {
      return l === "ru"
        ? `${d} с прошлого раза: начните ${withLoadRu(workingKg, ex2)} (${cut}), чтобы вернуться в ритм.`
        : `${d} since last time: start at ${load} (${cut}) to find your groove again.`;
    }
    const same = l === "ru" ? (isAssisted(ex2) || isBodyweight(ex2) ? `нагрузка та же (${load})` : `те же ${load}`) : `same ${load}`;
    if (targetReps >= state.targetReps) {
      return l === "ru"
        ? `${d} с прошлого раза: ${same} и ${amount(targetReps, unit, l)}, чтобы вернуться в ритм.`
        : `${d} since last time: ${same} × ${amount(targetReps, unit, l)} to find your groove again.`;
    }
    const n = state.targetReps - targetReps;
    const fewer = unit === "reps"
      ? (l === "ru" ? `на ${amount(n, unit, l)} меньше` : `${num(n, l)} fewer ${n === 1 ? "rep" : "reps"}`)
      : (l === "ru" ? `на ${amount(n, unit, l)} короче` : `${amount(n, unit, l)} shorter`);
    return l === "ru"
      ? `${d} с прошлого раза: ${same}, ${fewer} (${amount(targetReps, unit, l)}), чтобы вернуться в ритм.`
      : `${d} since last time: ${same}, ${fewer} (${amount(targetReps, unit, l)}) to find your groove again.`;
  });
  /** @type {Outcome} */
  const outcome = reset ? "reset" : "deloaded";
  /** @type {ExerciseState} */
  const next = { ...state, workingKg, targetReps, fails: reset ? 0 : state.fails, lastOutcome: outcome, note, updatedAt: toIso(now) };
  // rule 5: another load starts the streak over (a malformed memory becomes null; states without one do not grow it)
  if (state.plateau != null && !sameKg(workingKg, L)) {
    const p = plateauOf(state);
    next.plateau = p && { ...p, streak: 0 };
  }
  return { state: next, outcome, pct, note };
}

/**
 * Carry a state to another rep range (goal switch) through the %1RM table: the implied 1RM is preserved and the
 * target moves to the bottom of the new range (research/01 Table 10). `opts.rir` changes the RIR target too;
 * `opts.factor` (e.g. 0.95 for the first session after a switch) scales the load before the single rounding, to the
 * NEAREST step (rounding down on a coarse stack lost 14–18 % of the implied 1RM on top of the factor), so the e1RM
 * stays within the factor ± half a step. Without an exercise the load is not rounded (exact round trips). While a
 * weight hold is ahead of `now` the load never gets heavier: it stays, at the reps it allows at the new RIR. The
 * plateau memory (rule 5) does not carry over: a new range starts fresh.
 * @param {ExerciseState} state @param {[number, number]} fromRange @param {[number, number]} toRange
 * @param {{ rir?: number, exercise?: Exercise, gym?: Gym | null, bodyweightKg?: number | null, now?: Date | string | number, factor?: number }} [opts]
 * @returns {ExerciseState}
 */
export function convertState(state, fromRange, toRange, { rir, exercise, gym, bodyweightKg, now, factor = 1 } = {}) {
  const fromRir = state.rir ?? 2;
  const toRir = rir ?? fromRir;
  // targets may sit past the top of the range (the capacity guard, up to repCeiling)
  const known = exercise ?? catalogExerciseById(state.exerciseId);
  const ceiling = known ? repCeiling(known, fromRange[1]) : Math.max(fromRange[1], RULES.repCeiling.isolation);
  const fromReps = clamp(state.targetReps ?? fromRange[0], fromRange[0], ceiling);
  const toReps = toRange[0];
  const same = pctOf1rm(toReps + toRir) / pctOf1rm(fromReps + fromRir);
  const unit = exercise ? unitOf(exercise) : "reps";
  const ctx = { gym, bodyweightKg: bodyweightKg ?? RULES.bodyweightRefKg };
  /** the nearest step: rounding the easier way on a 5 kg stack lost 14–18 % of the implied e1RM on top of the factor @param {number} k */
  const scaled = (k) => (unit !== "reps" ? state.workingKg : exercise ? scaleLoad(state.workingKg, k, exercise, ctx, "nearest") : r2(state.workingKg * k));
  let workingKg = scaled(same * factor);
  const ex2 = exercise ?? /** @type {Exercise} */ ({ equipment: "selectorized" });
  // a weight hold (master plan §16) outranks the conversion: when the same e1RM in the new range means a heavier load,
  // keep the load at the reps it allows at the new RIR (the same reps + RIR in all), within the new range. Judged
  // without the first-session factor too, so the plan (× 0.95) and applySession (× 1) take the same branch
  const heavier = isHarder(workingKg, state.workingKg, ex2) || isHarder(scaled(same), state.workingKg, ex2);
  const until = unit === "reps" && heavier && holdActive(state, now ?? state.updatedAt) ? state.holdUntil : null;
  let targetReps = toReps;
  if (until) {
    workingKg = state.workingKg;
    targetReps = clamp(fromReps + fromRir - toRir, toRange[0], toRange[1]);
  }
  const T = targetReps;
  const W = workingKg;
  /** @type {ExerciseState} */
  const out = {
    ...state,
    workingKg,
    targetReps,
    repRange: [toRange[0], toRange[1]],
    rir: toRir,
    fails: 0,
    lastOutcome: "converted",
    note: text2((l) => {
      const off = Math.round((1 - factor) * 100);
      const tail = until
        ? (l === "ru" ? `вес зафиксирован до ${holdDay(until, l)}` : `the weight is held until ${holdDay(until, l)}`)
        : off > 0
          ? (l === "ru" ? `пересчёт через 1ПМ, первая тренировка на ${off} % легче` : `converted through your 1RM, ${off} % lighter for the first session`)
          : (l === "ru" ? "пересчёт через 1ПМ" : "converted through your 1RM");
      return l === "ru"
        ? `Новый диапазон ${toRange[0]}–${toRange[1]}: ${loadText(W, ex2, l)} × ${amount(T, unit, l)} (${tail}).`
        : `New range ${toRange[0]}–${toRange[1]}: ${loadText(W, ex2, l)} × ${amount(T, unit, l)} (${tail}).`;
    }),
    updatedAt: toIso(now ?? state.updatedAt),
  };
  if (state.plateau != null) out.plateau = null;
  return out;
}

/**
 * Seed the state of a substitute exercise from the one it replaces: 85 % of the equivalent load at the same target
 * reps (60 % when the movement pattern differs), crossing equipment families by research/04 §3.8 ratios
 * (machine ≈ 0.8 × barbell, dumbbell per hand ≈ 0.42 × barbell, Smith ≈ 0.97 × barbell). Assisted, bodyweight, band
 * and hold/carry crossings fall back to initialState. The result has `sessions: 0`, so its first session calibrates,
 * and no plateau memory (rule 5): another exercise starts fresh.
 * @param {ExerciseState} fromState @param {Exercise} fromExercise @param {Exercise} toExercise
 * @param {{ bodyweightKg?: number | null, goal?: GoalMode, now?: Date | string | number, gym?: Gym | null, repRange?: [number, number], rir?: number }} [opts]
 * @returns {ExerciseState}
 */
export function substituteState(fromState, fromExercise, toExercise, opts = {}) {
  const range = opts.repRange ?? fromState.repRange;
  const rir = opts.rir ?? fromState.rir;
  const plain = (/** @type {Exercise} */ e) => !isAssisted(e) && !isBodyweight(e) && e.equipment !== "band" && unitOf(e) === "reps";
  const swapNote = text2((l) => (l === "ru"
    ? "Замена: старт с 85 % от эквивалентного веса, первая тренировка — тестовая."
    : "Swapped in: starts at 85 % of the equivalent load; the first session counts as a test."));
  if (!plain(fromExercise) || !plain(toExercise) || !(fromState.workingKg > 0)) {
    const s = initialState(toExercise, { bodyweightKg: opts.bodyweightKg, goal: opts.goal, now: opts.now, repRange: range, rir, gym: opts.gym });
    return { ...s, note: joinText([swapNote, ...(s.note ? [s.note] : [])]) };
  }
  const sub = RULES.substitution;
  let k = (fromExercise.pattern && toExercise.pattern && fromExercise.pattern !== toExercise.pattern) ? sub.differentPattern : sub.base;
  const famFrom = sub.families[fromExercise.equipment];
  const famTo = sub.families[toExercise.equipment];
  if (famFrom && famTo && famFrom !== famTo) k *= (sub.familyRatio[famTo] ?? 1) / (sub.familyRatio[famFrom] ?? 1);
  const target = clamp(fromState.targetReps, range[0], range[1]);
  // the current working load (not the best-ever e1RM) is the anchor; a different target/RIR moves along the table
  const ratio = loadFraction(target + rir) / loadFraction(fromState.targetReps + (fromState.rir ?? rir));
  const workingKg = roundLoad(k * fromState.workingKg * ratio, toExercise, opts.gym, "easier");
  return {
    exerciseId: toExercise.id,
    workingKg,
    targetReps: target,
    repRange: [range[0], range[1]],
    rir,
    e1rm: 0,
    lastOutcome: "init",
    fails: 0,
    sessions: 0,
    baseline: { status: "learning" },
    lastAt: null,
    note: swapNote,
    updatedAt: toIso(opts.now),
  };
}

/* ------------------------------------------------------------------ deloads and weekly volume */

/** Sets in a deload week: −40 %, at least 1. @param {number} sets */
export const deloadSets = (sets) => Math.max(1, Math.round(sets * RULES.deload.setsMultiplier));

/**
 * The planned deload week (task spec; research/02 §G): every slot 40 % fewer sets at the same load, RIR + 2 (so
 * 2 fewer reps per set), no progression evaluation. Returns the program as it should be shown that week.
 * @param {Program} program
 * @returns {{ program: Program, setsMultiplier: number, loadMultiplier: number, rirBonus: number, repsMinus: number, note: Text2 }}
 */
export function deloadPlan(program) {
  const d = RULES.deload;
  return {
    program: {
      ...program,
      days: program.days.map((day) => ({
        ...day,
        slots: day.slots.map((s) => ({ ...s, sets: deloadSets(s.sets), rir: Math.min(5, s.rir + d.rirBonus) })),
      })),
    },
    setsMultiplier: d.setsMultiplier,
    loadMultiplier: d.loadMultiplier,
    rirBonus: d.rirBonus,
    repsMinus: d.repsMinus,
    note: {
      en: "Deload week: 40 % fewer sets at your usual weights, 2 more reps in reserve (2 fewer reps per set). No progression this week — you come back fresher.",
      ru: "Разгрузочная неделя: на 40 % меньше подходов с обычными весами, на 2 повторения больше в запасе (на 2 повторения меньше в подходе). Без прогрессии на этой неделе — вернётесь свежее.",
    },
  };
}

/**
 * Where the calendar is in the block: `due` when this is the planned deload week (every `deloadEveryWeeks`
 * accumulation weeks since the program row was created). @param {Program} program @param {Date | string | number} [now]
 * @returns {{ due: boolean, week: number, cycle: number }}
 */
export function deloadWeek(program, now) {
  const every = program.deloadEveryWeeks ?? 0;
  const start = Date.parse(program.createdAt);
  const at = now == null ? Date.now() : now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.parse(now);
  const w = Number.isNaN(start) || Number.isNaN(at) ? 0 : Math.max(0, Math.floor((at - start) / (7 * DAY_MS)));
  if (!every) return { due: false, week: w + 1, cycle: 0 };
  const cycle = every + 1;
  const pos = w % cycle;
  return { due: pos === every, week: pos + 1, cycle };
}

/**
 * Weekly fractional hard sets per coarse group (direct 1, synergist 0.5), scaled by sessions per week ÷ days in the
 * rotation. @param {Program} program @param {ExerciseLookup} [lookup] @returns {Record<string, number>}
 */
export function weeklySets(program, lookup) {
  const perWeek = program.days.length ? program.daysPerWeek / program.days.length : 0;
  /** @type {Record<string, number>} */
  const out = {};
  for (const day of program.days) {
    for (const slot of day.slots) {
      for (const [g, w] of Object.entries(groupWeights(slot.exerciseId, lookup))) out[g] = (out[g] ?? 0) + slot.sets * w * perWeek;
    }
  }
  for (const g of Object.keys(out)) out[g] = Math.round(out[g] * 10) / 10;
  return out;
}

/** Target weekly sets band for a goal (for UI comparison). @param {GoalMode} goal */
export const weeklySetsTarget = (goal) => modeParams(goal).setsPerMuscleWeek;
