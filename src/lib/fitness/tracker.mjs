// @ts-check
/**
 * Session tracker logic (stream 04, plans/fitness/04-session-tracker-ui.md): the program to train, the session in
 * progress, the plan of a running session (stable across reloads), rows per set (planned / done / failed / skipped),
 * the current set, logging and adjusting sets, the rest timer, ending a session (progression through the engine),
 * closing out auto-closed sessions, the home-page cards and the bilingual set texts.
 * Pure: no DOM, no storage, no React. The caller writes the rows returned here (store.upsert) when it can write.
 */
import safety from "../../../content/fitness/safety.json" with { type: "json" };
import { groupById, muscleById } from "./catalog.mjs";
import { DEFAULT_TEMPLATE_ID, RULES, buildProgram, newId, toIso, toMs, unitOf } from "./templates.mjs";
import { incrementFor, initialState, isAssisted, isCompound, substituteState, warmupRamp } from "./progression.mjs";
import {
  AUTO_CLOSE_HOURS, DEFAULT_CATALOG, applySession, fallbackExercise, nextDayKey, planSession, resolveExercise, sessionStatus, summarize,
} from "./session.mjs";
import { adherence, bodyweightLookup, dailyMean, effectiveLoad, ewma, prs } from "./analytics.mjs";

/** @typedef {import("./types").BodyweightEntry} BodyweightEntry */
/** @typedef {import("./types").Exercise} Exercise */
/** @typedef {import("./types").ExerciseState} ExerciseState */
/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").Lang} Lang */
/** @typedef {import("./types").LoggedSet} LoggedSet */
/** @typedef {import("./types").Outcome} Outcome */
/** @typedef {import("./types").PlannedExercise} PlannedExercise */
/** @typedef {import("./types").PlannedSession} PlannedSession */
/** @typedef {import("./types").Program} Program */
/** @typedef {import("./types").ProgramDay} ProgramDay */
/** @typedef {import("./types").Readiness} Readiness */
/** @typedef {import("./types").Session} Session */
/** @typedef {import("./types").SetKind} SetKind */
/** @typedef {import("./types").SetPrescription} SetPrescription */
/** @typedef {import("./types").Settings} Settings */
/** @typedef {import("./types").Snapshot} Snapshot */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {import("./session.mjs").Catalog} Catalog */
/** @typedef {Date | string | number} TimeLike */
/**
 * Per-device state of one running session (localStorage in the UI; never synced): today-only swaps, skipped
 * exercises and added sets, by slot id.
 * @typedef {{ swaps?: Record<string, string>, skipped?: Record<string, boolean>, extra?: Record<string, number> }} SessionUi
 */
/**
 * One set row on the session screen.
 * @typedef {object} Row
 * @property {string} key  stable React key (`slot:exercise:index`, plus the set id for rows outside the plan)
 * @property {string} slotId
 * @property {string} exerciseId  the exercise this row logs (or logged, for rows before a swap)
 * @property {number} index  setIndex it logs to: 0-based within the exercise, warm-ups included
 * @property {SetKind} kind
 * @property {SetPrescription} planned  the engine's prescription (logged sets keep it as plannedKg / plannedReps)
 * @property {{ kg: number, reps: number, rir: number | null }} suggest  what one tap logs: the plan, with the load of
 *   the exercise's latest logged working set carried forward to pending working rows (first-session ramp-up, a
 *   heavier or lighter day)
 * @property {"repeat" | "reduce" | "easy"} [adaptation]
 * @property {string} [basedOnSetId]
 * @property {LoggedSet | null} logged
 * @property {"planned" | "done" | "failed" | "skipped"} state  failed = a working set below its target
 * @property {boolean} added  a set beyond the plan (added by the user, or logged beyond it)
 * @property {number} round  position among the exercise's working rows (superset interleaving); -1 for warm-ups
 * @property {boolean} history  logged on another exercise in this slot (before a swap)
 */
/**
 * @typedef {object} ExerciseModel
 * @property {PlannedExercise} planned
 * @property {Row[]} warmups
 * @property {Row[]} working  the plan's working sets, then added sets
 * @property {Row[]} history  rows logged on another exercise in this slot before a swap
 * @property {number} addedLogged  sets logged beyond the plan (what "Add set" counts from)
 * @property {boolean} skipped
 * @property {number} order  position in the day
 */
/**
 * @typedef {object} BlockModel
 * @property {string} key
 * @property {string | null} superset  superset id when two or more exercises alternate
 * @property {ExerciseModel[]} exercises
 * @property {Row[]} sequence  the order sets are done in: warm-ups, then working rows interleaved by round
 */
/**
 * @typedef {object} SessionModel
 * @property {BlockModel[]} blocks
 * @property {Row | null} current  the set to do next
 * @property {{ done: number, total: number, extra: number, pct: number }} completion  working sets
 * @property {boolean} complete  no planned working set is left (done, failed or skipped)
 * @property {LoggedSet | null} lastSet  the most recently logged set
 * @property {LoggedSet[]} orphans  sets of this session whose slot is not in today's plan
 */
/** @typedef {{ kind: "up" | "down" | "hold" | "deload" | "skipped", text: Text2 }} Badge */
/**
 * @typedef {object} SummaryExercise
 * @property {string} exerciseId
 * @property {string | null} slotId
 * @property {number} sets  working sets logged
 * @property {{ kg: number, reps: number, rir: number | null } | null} topSet
 * @property {number} e1rm  0 when no set was reliable
 * @property {Outcome} outcome
 * @property {Text2 | null} note  the engine's explanation
 * @property {{ kg: number, reps: number } | null} before  what today's working sets lifted (see referenceOf)
 * @property {{ kg: number, reps: number } | null} after  next time's target
 * @property {Badge} badge
 * @property {string | null} [hold]  the weight hold (holdUntil) still ahead after this session, if any
 */
/** @typedef {{ exerciseId: string, kind: "e1rm" | "load" | "reps", value: number, previous: number, kg: number, reps: number }} SummaryPr */
/** @typedef {{ slotId: string, exerciseId: string, sets: number, kg: number, reps: number }} PreviewExercise */
/** @typedef {{ dayKey: string, dayName: Text2, estimatedMinutes: number, exercises: PreviewExercise[] }} SessionPreview */
/**
 * What End changed, so the summary's "Reopen" can undo it exactly (see reopenSession): the session as it was before
 * End, when End closed it, and every exercise state End wrote — the state before (null: End created it) and a stamp
 * of what End wrote, to notice a later change. Plain JSON.
 * @typedef {{ session: Session, endedAt: string, states: { exerciseId: string, before: ExerciseState | null, wrote: string }[] }} EndUndo
 */
/**
 * What the end-of-session screen shows (plain JSON: the UI keeps it in sessionStorage across a reload).
 * @typedef {object} SessionSummary
 * @property {string} sessionId
 * @property {string} dayKey
 * @property {Text2} dayName
 * @property {"finished" | "abandoned"} status
 * @property {string} startedAt
 * @property {string} endedAt
 * @property {number} minutes
 * @property {number} tonnage  kg × reps over working rep sets (assistance excluded)
 * @property {number} hardSets
 * @property {{ done: number, total: number }} working
 * @property {SummaryExercise[]} exercises
 * @property {{ slotId: string, exerciseId: string }[]} skipped
 * @property {SummaryPr[]} prs
 * @property {SessionPreview | null} next
 * @property {EndUndo} [reopen]  what End changed (absent in summaries saved before this field existed)
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DEFAULT_AT = "1970-01-01T00:00:00.000Z";
/** RIR chips on a working set: 0 1 2 3 4+ ("4+" logs 4). */
export const RIR_CHOICES = Object.freeze([0, 1, 2, 3, 4]);
/** The rest timer keeps counting past zero this long, then hides (research 08 §E). */
export const REST_OVERRUN_SEC = 600;
/** End tapped more than this after the last set: the session ends at the last set + END_GRACE_MS (a forgotten End). */
const FORGOT_END_MS = 30 * 60_000;
const END_GRACE_MS = 5 * 60_000;
/** Auto-closed sessions older than this are not re-evaluated. */
const CLOSE_OUT_DAYS = 30;
/** A session can be reopened from its summary until this long before the 6 h auto-close (else it closes again at once). */
const REOPEN_MARGIN_MS = 10 * 60_000;

/* ------------------------------------------------------------------ small helpers */

/** @param {number} x */
const r2 = (x) => Math.round(x * 100) / 100;
/** @param {string | null | undefined} iso */
const timeOf = (iso) => {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? 0 : t;
};
/** @template T @param {Record<string, T> | T[] | null | undefined} rows @returns {T[]} */
const listOf = (rows) => (Array.isArray(rows) ? rows : Object.values(rows ?? {}));
/** Sets in the order they were logged. @param {LoggedSet[]} sets */
const byDone = (sets) => [...sets].sort((a, b) => timeOf(a.doneAt) - timeOf(b.doneAt) || a.setIndex - b.setIndex);
/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** @param {number} kg */
const clampKg = (kg) => (Number.isFinite(kg) ? clamp(r2(kg), 0, 999.99) : 0);
/** @param {number} reps */
const clampReps = (reps) => (Number.isFinite(reps) ? clamp(Math.round(reps), 0, 499) : 0);
/** @param {number} rir */
const clampRir = (rir) => (Number.isFinite(rir) ? clamp(Math.round(rir * 10) / 10, 0, 10) : 0);
/** Body weight the database accepts. @param {unknown} kg @returns {kg is number} */
export const validBodyweight = (kg) => typeof kg === "number" && Number.isFinite(kg) && kg > 20 && kg < 400;
/** @param {Catalog} cat @param {string} id @returns {Exercise} */
const exerciseOf = (cat, id) => cat.exerciseById(id) ?? fallbackExercise(id);
/** @param {unknown} v @returns {v is Text2} */
const isText2 = (v) => typeof v === "object" && v !== null && typeof (/** @type {any} */ (v).en) === "string" && typeof (/** @type {any} */ (v).ru) === "string";

/** This session's sets. @param {Record<string, LoggedSet> | LoggedSet[] | null | undefined} sets @param {string} sessionId */
export const setsOfSession = (sets, sessionId) => byDone(listOf(sets).filter((s) => s.sessionId === sessionId));

/** @param {Snapshot} snapshot @param {string | null | undefined} id @returns {Gym | null} */
export const gymOf = (snapshot, id) => (id ? snapshot.gyms[id] ?? null : null);

/** The gym the plan uses: settings.activeGymId (null = every machine counts as available). @param {Snapshot} snapshot */
export const activeGym = (snapshot) => gymOf(snapshot, snapshot.settings?.activeGymId);

/**
 * The gym a running session plans with: its own gym, else (a session started before any gym existed, or whose gym was
 * deleted) the active gym, so marking a machine missing on the gyms page swaps it in the running session at once.
 * @param {Snapshot} snapshot @param {Pick<Session, "gymId">} session @returns {Gym | null}
 */
export const sessionGym = (snapshot, session) => gymOf(snapshot, session.gymId) ?? activeGym(snapshot);

/** @param {Program | null | undefined} program @param {string} key @returns {ProgramDay | undefined} */
export const dayOf = (program, key) => program?.days.find((d) => d.key === key);

/* ------------------------------------------------------------------ program, sessions */

/**
 * The program to train: the active one, else the owner template ("owner-3day-upper", or the 2-/4-day template for
 * another day count) with the saved goal and days per week. The caller persists it when `created` (first visit).
 * @param {Snapshot} snapshot @param {TimeLike} [now] @returns {{ program: Program, created: boolean }}
 */
export function ensureProgram(snapshot, now) {
  const active = snapshot.activeProgramId ? snapshot.programs[snapshot.activeProgramId] : undefined;
  if (active && Array.isArray(active.days) && active.days.length) return { program: active, created: false };
  const goal = snapshot.settings?.goal;
  const daysPerWeek = snapshot.settings?.daysPerWeek;
  /** @type {Program} */
  let program;
  try {
    program = buildProgram({ templateId: DEFAULT_TEMPLATE_ID, goal, daysPerWeek, now });
  } catch {
    program = buildProgram({ templateId: DEFAULT_TEMPLATE_ID, now });
  }
  return { program, created: true };
}

/** The program a session was planned with (falls back to the given one). @param {Snapshot} snapshot @param {Session} session @param {Program} fallback */
export const programOf = (snapshot, session, fallback) => {
  const p = snapshot.programs[session.programId];
  return p && dayOf(p, session.dayKey) ? p : fallback;
};

/** @param {Snapshot} snapshot */
const hoursOf = (snapshot) => snapshot.settings?.autoCloseHours ?? AUTO_CLOSE_HOURS;

/**
 * The session in progress: the newest session that is still active under the 6 h rule; null when none.
 * @param {Snapshot} snapshot @param {TimeLike} [now] @returns {Session | null}
 */
export function activeSession(snapshot, now) {
  const hours = hoursOf(snapshot);
  /** @type {Session | null} */
  let best = null;
  for (const s of Object.values(snapshot.sessions)) {
    if (sessionStatus(s, now, hours) !== "active") continue;
    if (!best || timeOf(s.startedAt) > timeOf(best.startedAt)) best = s;
  }
  return best;
}

/**
 * The newest session that counts as trained (finished or auto-closed). @param {Snapshot} snapshot @param {TimeLike} [now]
 * @returns {Session | null}
 */
export function lastSession(snapshot, now) {
  const hours = hoursOf(snapshot);
  /** @type {Session | null} */
  let best = null;
  for (const s of Object.values(snapshot.sessions)) {
    const st = sessionStatus(s, now, hours);
    if (st !== "finished" && st !== "auto_closed") continue;
    if (!best || timeOf(s.startedAt) > timeOf(best.startedAt)) best = s;
  }
  return best;
}

/**
 * The newest session, when it was closed automatically (6 h after its start): the train page says so once.
 * @param {Snapshot} snapshot @param {TimeLike} [now] @returns {Session | null}
 */
export function autoClosedNotice(snapshot, now) {
  const hours = hoursOf(snapshot);
  /** @type {Session | null} */
  let newest = null;
  for (const s of Object.values(snapshot.sessions)) if (!newest || timeOf(s.startedAt) > timeOf(newest.startedAt)) newest = s;
  return newest && sessionStatus(newest, now, hours) === "auto_closed" ? newest : null;
}

/** @param {Readiness | null | undefined} r @returns {Readiness | null} */
function cleanReadiness(r) {
  if (!r) return null;
  /** @type {Record<string, number>} */
  const out = {};
  for (const k of ["sleep", "energy", "soreness"]) {
    const v = /** @type {Record<string, unknown>} */ (r)[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) out[k] = v;
  }
  return Object.keys(out).length ? /** @type {Readiness} */ (out) : null;
}

/**
 * A new active session. @param {{ program: Program, dayKey: string, gymId?: string | null, now?: TimeLike,
 * readiness?: Readiness | null, bodyweightKg?: number | null, id?: string, plan?: Session["plan"] }} p @returns {Session}
 */
export function startSession({ program, dayKey, gymId = null, now, readiness, bodyweightKg, id, plan }) {
  const at = toIso(now);
  const key = dayOf(program, dayKey) ? dayKey : program.days[0]?.key ?? dayKey;
  /** @type {Session} */
  const session = { id: id ?? newId(), programId: program.id, dayKey: key, gymId: gymId ?? null, startedAt: at, endedAt: null, status: "active", updatedAt: at };
  if (plan) session.plan = structuredClone(plan);
  const r = cleanReadiness(readiness);
  if (r) session.readiness = r;
  if (validBodyweight(bodyweightKg)) session.bodyweightKg = r2(bodyweightKg);
  return session;
}

/* ------------------------------------------------------------------ logging */

/**
 * The id of the set logged on one planned row: a UUID derived from the session, slot, exercise and set index, so the
 * same row always gets the same id. Logging a row twice — a fast double tap, a retried tap, two phones offline —
 * replaces one row instead of adding a duplicate. (cyrb128 hash; RFC 9562 version 8 layout, which Postgres accepts.)
 * @param {string} sessionId @param {string} slotId @param {string} exerciseId @param {number} index @returns {string}
 */
export function setIdFor(sessionId, slotId, exerciseId, index) {
  const key = `ilyadays-fitness:set:${sessionId}:${slotId}:${exerciseId}:${index}`;
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The set for one planned row, exactly as planned unless `overrides` say otherwise. Warm-ups log no RIR. The id is the
 * row's own (setIdFor) unless `id` says otherwise, so logging the same row again updates it.
 * @param {{ session: Session, planned: SetPrescription, exerciseId: string, slotId: string, index: number,
 *   now?: TimeLike, overrides?: { kg?: number, reps?: number, rir?: number | null }, id?: string, prescription?: LoggedSet["prescription"] }} p
 * @returns {LoggedSet}
 */
export function logPlannedSet({ session, planned, exerciseId, slotId, index, now, overrides = {}, id, prescription }) {
  const at = toIso(now);
  const kind = planned.kind;
  const rir = kind === "warmup" ? null : overrides.rir !== undefined ? overrides.rir : planned.rir ?? null;
  const setIndex = clamp(Math.round(index), 0, 49);
  return {
    id: id ?? setIdFor(session.id, slotId, exerciseId, setIndex),
    sessionId: session.id,
    slotId,
    exerciseId,
    setIndex,
    kind,
    plannedKg: clampKg(planned.weightKg),
    plannedReps: clampReps(planned.reps),
    ...(prescription ? { prescription } : {}),
    kg: clampKg(overrides.kg ?? planned.weightKg),
    reps: clampReps(overrides.reps ?? planned.reps),
    rir: rir == null ? null : clampRir(rir),
    doneAt: at,
    updatedAt: at,
  };
}

/**
 * Stepper steps: reps (1, or 5 s / 5 m) and kg (the gym's or exercise's increment; 2.5 kg of added load on bodyweight
 * rep exercises; 0 = the exercise has no load to change: bands, unloaded holds).
 * @param {Exercise | null | undefined} exercise @param {Gym | null} [gym] @returns {{ reps: number, kg: number }}
 */
export function stepsFor(exercise, gym) {
  const unit = unitOf(exercise);
  const reps = RULES.unitStep[unit] ?? 1;
  if (!exercise || exercise.equipment === "band") return { reps, kg: 0 };
  const inc = incrementFor(exercise, gym);
  if (inc > 0) return { reps, kg: inc };
  return { reps, kg: exercise.equipment === "bodyweight" && unit === "reps" ? 2.5 : 0 };
}

/**
 * A logged set or a draft with reps / kg moved and the RIR replaced; never negative. Loads do not change on
 * exercises without a load (bands). @template {{ kg: number, reps: number, rir: number | null }} S
 * @param {S} set @param {{ repsDelta?: number, kgDelta?: number, rir?: number | null }} [change]
 * @param {Exercise | null} [exercise] @returns {S}
 */
export function adjustSet(set, { repsDelta = 0, kgDelta = 0, rir } = {}, exercise) {
  const loadable = !exercise || exercise.equipment !== "band";
  /** @type {S} */
  const next = { ...set, reps: clampReps(set.reps + repsDelta), kg: loadable ? clampKg(set.kg + kgDelta) : set.kg };
  if (rir !== undefined) {
    next.rir = rir == null ? null : clampRir(rir);
    if ("prescription" in next && next.prescription) next.prescription = { ...next.prescription, rirReported: rir != null };
  }
  return next;
}

/* ------------------------------------------------------------------ the running session's plan */

/** A slot's latest logged exercise, per slot (a swap made on another device still shows). @param {LoggedSet[]} sets */
export function inferSwaps(sets) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const s of byDone(sets)) out[s.slotId] = s.exerciseId;
  return out;
}

/**
 * A gym (or none) with extra slot preferences: how today's swaps reach planSession (gym.preferred[slotId] wins when
 * the exercise is available and compatible). @param {Gym | null | undefined} gym @param {Record<string, string> | null | undefined} prefs
 * @returns {Gym | null}
 */
export function withPreferences(gym, prefs) {
  if (!prefs || !Object.keys(prefs).length) return gym ?? null;
  /** @type {Gym} */
  const base = gym ?? { id: "", name: "", available: [], missing: [], preferred: {}, updatedAt: DEFAULT_AT };
  return { ...base, preferred: { ...(base.preferred ?? {}), ...prefs } };
}

/**
 * Settings for planning: the saved ones (defaults when there are none) with the body weight of the session, else the
 * latest weigh-in, else the saved one. @param {Snapshot} snapshot @param {number | null} [bodyweightKg] @returns {Settings}
 */
export function planSettings(snapshot, bodyweightKg) {
  /** @type {Settings} */
  const base = snapshot.settings ?? { goal: "recomp", daysPerWeek: 3, activeGymId: null, unit: "kg", restTimer: true, autoCloseHours: 6, updatedAt: DEFAULT_AT };
  const bw = validBodyweight(bodyweightKg) ? bodyweightKg : latestBodyweight(snapshot)?.kg ?? base.bodyweightKg;
  return validBodyweight(bw) ? { ...base, bodyweightKg: bw } : base;
}

/**
 * The plan of a running session, as it was at its start (planned at `startedAt`, so a reload shows the same
 * numbers). Today's swaps — this device's (`swaps`) over the ones implied by logged sets — go in as gym
 * preferences, so substitute loads, warm-ups and deload rules are the engine's.
 * @param {{ snapshot: Snapshot, session: Session, program: Program, swaps?: Record<string, string> | null, catalog?: Catalog }} p
 * @returns {PlannedSession}
 */
export function activePlan({ snapshot, session, program, swaps, catalog }) {
  const prefs = { ...inferSwaps(setsOfSession(snapshot.sets, session.id)), ...(swaps ?? {}) };
  if (session.plan) {
    let frozen = session.plan.prescription;
    const currentGym = sessionGym(snapshot, session);
    // Explicit equipment availability/preferences may change during training; load increments stay frozen.
    const baseGym = session.plan.gym ?? { id: "", name: "", available: [], missing: [], preferred: {}, updatedAt: DEFAULT_AT };
    const gym = withPreferences(currentGym ? { ...baseGym, available: currentGym.available, missing: currentGym.missing, preferred: currentGym.preferred } : baseGym, prefs);
    for (const p of frozen.exercises) {
      const slot = dayOf(session.plan.program, session.dayKey)?.slots.find((s) => s.slotId === p.slotId);
      const toId = slot ? resolveExercise(slot, gym, catalog ?? DEFAULT_CATALOG, session.plan.program) : prefs[p.slotId];
      if (toId && p.exerciseId !== toId) frozen = swapInSession(frozen, p.slotId, toId, session.plan.states, catalog ?? DEFAULT_CATALOG, { gym, settings: { ...planSettings(snapshot, session.bodyweightKg), bodyweightKg: session.bodyweightKg ?? undefined }, now: session.startedAt });
    }
    return frozen;
  }
  return planSession({
    program,
    dayKey: session.dayKey,
    states: snapshot.exerciseState,
    gym: withPreferences(sessionGym(snapshot, session), prefs),
    settings: planSettings(snapshot, session.bodyweightKg),
    now: session.startedAt,
    catalog: catalog ?? DEFAULT_CATALOG,
  });
}

/**
 * Re-prescribe one planned exercise for another exercise without the program: its own state, or the slot
 * exercise's state converted with substituteState, or a first-time start; warm-ups for compounds.
 * @param {PlannedExercise} current @param {string} toId @param {Record<string, ExerciseState>} states @param {Catalog} cat
 * @param {{ gym?: Gym | null, settings?: Settings | null, now?: TimeLike }} ctx @returns {PlannedExercise}
 */
function convertPlanned(current, toId, states, cat, { gym = null, settings = null, now } = {}) {
  const to = exerciseOf(cat, toId);
  const slotEx = exerciseOf(cat, current.programExerciseId);
  const working = current.sets.filter((s) => s.kind !== "warmup");
  const first = working[0];
  const rir = first?.rir ?? 2;
  const bodyweightKg = settings?.bodyweightKg ?? null;
  const sameUnit = unitOf(to) === unitOf(slotEx);
  const slotState = states[current.programExerciseId];
  /** @type {[number, number]} */
  const range = sameUnit ? current.repRange ?? (slotState ? [slotState.repRange[0], slotState.repRange[1]] : [to.repRange[0], to.repRange[1]]) : [to.repRange[0], to.repRange[1]];
  let state = states[toId];
  if (!state) {
    state = slotState && sameUnit && toId !== current.programExerciseId
      ? substituteState(slotState, slotEx, to, { bodyweightKg, now, gym, repRange: range, rir })
      : initialState(to, { bodyweightKg, now, repRange: range, rir, gym });
  }
  const kg = state.workingKg;
  const reps = state.targetReps;
  const ramp = isCompound(to) ? warmupRamp(kg, to, state.e1rm, { gym, bodyweightKg, targetReps: reps, rir }) : [];
  /** @type {SetPrescription[]} */
  const base = working.length ? working : [{ kind: "working", weightKg: kg, reps, rir }];
  /** @type {SetPrescription[]} */
  const work = base.map((s) => ({ kind: s.kind, weightKg: kg, reps, rir: s.rir ?? rir }));
  /** @type {PlannedExercise} */
  const out = {
    ...current,
    exerciseId: toId,
    calibration: state.baseline?.status === "learning" || state.sessions === 0,
    repRange: range,
    loadStep: incrementFor(to, gym),
    sets: [...ramp, ...work],
    alternatives: [current.exerciseId, ...current.alternatives.filter((a) => a !== toId && a !== current.exerciseId)],
  };
  if (state.note) out.note = state.note;
  else delete out.note;
  return out;
}

/**
 * The plan with one slot swapped to another exercise. With `ctx.program` the engine re-plans the day with that
 * choice as a gym preference (the same numbers the next session would get); without it (or when the engine rejects
 * the choice) the working sets are re-prescribed from the exercise's state or progression.substituteState.
 * @template {PlannedSession | PlannedExercise[]} P
 * @param {P} planned @param {string} slotId @param {string} toExerciseId
 * @param {Record<string, ExerciseState> | null | undefined} states @param {Catalog} [catalog]
 * @param {{ program?: Program, dayKey?: string, gym?: Gym | null, settings?: Settings | null, now?: TimeLike, swaps?: Record<string, string> }} [ctx]
 * @returns {P}
 */
export function swapInSession(planned, slotId, toExerciseId, states, catalog, ctx = {}) {
  const cat = catalog ?? DEFAULT_CATALOG;
  /** @type {PlannedExercise[]} */
  const list = Array.isArray(planned) ? planned : /** @type {PlannedSession} */ (planned).exercises;
  const i = list.findIndex((p) => p.slotId === slotId);
  if (i < 0 || list[i].exerciseId === toExerciseId) return planned;
  /** @type {PlannedExercise | null} */
  let next = null;
  if (ctx.program) {
    const dayKey = ctx.dayKey ?? (Array.isArray(planned) ? undefined : /** @type {PlannedSession} */ (planned).dayKey);
    const gym = withPreferences(ctx.gym ?? null, { ...(ctx.swaps ?? {}), [slotId]: toExerciseId });
    const plan = planSession({ program: ctx.program, dayKey, states, gym, settings: ctx.settings ?? null, now: ctx.now, catalog: cat });
    const hit = plan.exercises.find((p) => p.slotId === slotId);
    if (hit && hit.exerciseId === toExerciseId) next = hit;
  }
  const swapped = next ?? convertPlanned(list[i], toExerciseId, states ?? {}, cat, ctx);
  const out = list.map((p, j) => (j === i ? swapped : p));
  return /** @type {P} */ (Array.isArray(planned) ? out : { ...planned, exercises: out });
}

/* ------------------------------------------------------------------ rows, blocks, the current set */

/**
 * @param {PlannedExercise} planned @param {SetPrescription} prescription @param {number} index
 * @param {LoggedSet | null} logged @param {boolean} skipped @param {boolean} added @param {string} [suffix]
 * @returns {Row}
 */
function makeRow(planned, prescription, index, logged, skipped, added, suffix) {
  const exerciseId = logged?.exerciseId ?? planned.exerciseId;
  const state = logged
    ? logged.kind !== "warmup" && logged.reps < logged.plannedReps ? "failed" : "done"
    : skipped ? "skipped" : "planned";
  const kind = logged?.kind ?? prescription.kind;
  return {
    key: `${planned.slotId}:${exerciseId}:${index}${suffix ? `:${suffix}` : ""}`,
    slotId: planned.slotId,
    exerciseId,
    index,
    kind,
    planned: prescription,
    suggest: { kg: prescription.weightKg, reps: prescription.reps, rir: kind === "warmup" ? null : prescription.rir ?? null },
    logged,
    state,
    added,
    round: -1,
    history: false,
  };
}

/** @param {LoggedSet} s @returns {SetPrescription} */
const prescriptionOf = (s) => ({ kind: s.kind, weightKg: s.plannedKg, reps: s.plannedReps, ...((s.prescription?.targetRir ?? s.rir) != null ? { rir: s.prescription?.targetRir ?? s.rir ?? undefined } : {}) });

/**
 * Rows of one planned exercise: warm-ups, working sets (the plan, then added sets) and rows logged on another
 * exercise in this slot before a swap. Logged sets map to rows by setIndex; anything logged beyond the plan (or twice
 * on one row) is still shown. After a swap the substitute gets the working sets that are left (at least one).
 * @param {PlannedExercise} planned @param {LoggedSet[]} slotSets  this slot's sets in this session
 * @param {{ extra?: number, skipped?: boolean }} [opts]  added sets (pending + logged), skipped today
 * @returns {{ warmups: Row[], working: Row[], history: Row[], addedLogged: number }}
 */
export function buildRows(planned, slotSets, { extra = 0, skipped = false } = {}) {
  const sets = byDone(slotSets);
  const mine = sets.filter((s) => s.exerciseId === planned.exerciseId);
  const others = sets.filter((s) => s.exerciseId !== planned.exerciseId);
  const warm = planned.sets.filter((s) => s.kind === "warmup");
  const work = planned.sets.filter((s) => s.kind !== "warmup");
  const doneElsewhere = others.filter((s) => s.kind !== "warmup").length;
  const keep = work.length ? Math.max(1, work.length - doneElsewhere) : 0;
  const base = [...warm, ...work.slice(0, keep)];
  /** @type {Map<number, LoggedSet>} */
  const onRow = new Map();
  /** @type {LoggedSet[]} */
  const loose = [];
  for (const s of mine) {
    if (s.setIndex >= base.length) loose.push(s);
    else {
      const prev = onRow.get(s.setIndex);
      if (prev) loose.push(prev);
      onRow.set(s.setIndex, s);
    }
  }
  const rows = base.map((p, i) => { const logged = onRow.get(i) ?? null; return makeRow(planned, logged ? prescriptionOf(logged) : p, i, logged, skipped, false); });
  for (const s of byDone(loose)) rows.push(makeRow(planned, prescriptionOf(s), s.setIndex, s, skipped, true, s.id.slice(0, 8)));
  const addedLogged = loose.filter((s) => s.setIndex >= base.length).length;
  const pending = Math.max(0, Math.floor(extra) - addedLogged);
  const lastDone = [...mine].reverse().find((s) => s.kind !== "warmup");
  const template = lastDone ? prescriptionOf(lastDone) : work[work.length - 1];
  if (pending && template) {
    let next = Math.max(base.length, ...mine.map((s) => s.setIndex + 1));
    for (let k = 0; k < pending; k++) {
      /** @type {SetPrescription} */
      const p = { kind: "backoff", weightKg: lastDone ? lastDone.kg : template.weightKg, reps: lastDone ? lastDone.reps : template.reps };
      if (template.rir != null) p.rir = template.rir;
      rows.push(makeRow(planned, p, next++, null, skipped, true));
    }
  }
  const warmups = rows.filter((r) => r.kind === "warmup");
  // the latest logged working load carries forward to the pending working rows of this exercise
  const lastWork = [...mine].reverse().find((s) => s.kind === "working" || s.kind === "amrap");
  const working = rows
    .filter((r) => r.kind !== "warmup")
    .map((r, i) => {
      const row = { ...r, round: i };
      if (r.logged || !lastWork || r.kind === "backoff" || r.index <= lastWork.setIndex) return row;
      const advice = nextSetAdvice(planned, lastWork, r.planned, mine);
      return { ...row, suggest: advice.suggest, adaptation: advice.reason, basedOnSetId: lastWork.id };
    });
  const history = others.map((s) => ({ ...makeRow(planned, prescriptionOf(s), s.setIndex, s, false, false, s.id.slice(0, 8)), history: true }));
  return { warmups, working, history, addedLogged };
}

/** Conservative, reversible coaching for the next set; not a tested physiological formula.
 * @param {PlannedExercise} planned @param {LoggedSet} last @param {SetPrescription} target
 * @param {LoggedSet[]} [earlierSets]
 * @returns {{ suggest: { kg: number, reps: number, rir: number | null }, reason?: "repeat" | "reduce" | "easy" }}
 */
export function nextSetAdvice(planned, last, target, earlierSets = []) {
  const ex = DEFAULT_CATALOG.exerciseById(planned.exerciseId);
  const lo = planned.repRange?.[0] ?? ex?.repRange?.[0] ?? target.reps;
  const R = target.rir ?? 2;
  const step = planned.loadStep ?? (ex ? incrementFor(ex) : 0);
  const tooHeavy = last.reps < lo || (last.rir != null && last.rir < Math.max(0, R - 1));
  if (tooHeavy && ex && step > 0 && ex.equipment !== "band") {
    const raw = isAssisted(ex) ? last.kg + step : Math.max(0, last.kg - step);
    // A stack's minimum is one step; bodyweight zero means no added load.
    const kg = raw === 0 && ex.equipment !== "bodyweight" && !isAssisted(ex) ? step : r2((isAssisted(ex) ? Math.ceil(raw / step) : Math.floor(raw / step)) * step);
    return { suggest: { kg, reps: lo, rir: R }, reason: "reduce" };
  }
  const missed = last.reps < last.plannedReps || tooHeavy;
  const priorMiss = earlierSets.some((s) => (s.kind === "working" || s.kind === "amrap") && (s.reps < s.plannedReps || (s.prescription?.rirReported === true && s.rir != null && s.rir < Math.max(0, R - 1))));
  // A reported reserve is evidence; a pre-filled target is not. Add only one rep within the prescribed range,
  // leave the weight alone, and do not turn a later easy set into progression after earlier missed work.
  const ceiling = Math.max(target.reps, planned.repRange?.[1] ?? ex?.repRange?.[1] ?? target.reps);
  if (!missed && !priorMiss && target.kind !== "warmup" && last.kind !== "warmup" && ex && unitOf(ex) === "reps"
    && last.prescription?.rirReported === true && last.rir != null && last.rir >= R + 2
    && last.reps >= Math.max(target.reps, last.plannedReps ?? target.reps) && target.reps < ceiling) {
    return { suggest: { kg: last.kg, reps: Math.min(ceiling, target.reps + 1), rir: target.rir ?? null }, reason: "easy" };
  }
  return { suggest: { kg: last.kg, reps: missed ? Math.max(lo, Math.min(target.reps, last.reps)) : target.reps, rir: target.rir ?? null }, ...(missed ? { reason: "repeat" } : {}) };
}

/** Plain-language set guidance. Reserve arithmetic is an illustration, never a promise about the next set.
 * @param {SetPrescription} planned
 * @param {Exercise | null | undefined} exercise
 * @param {{reps:number, rir:number|null, rirReported?:boolean, prescription?:{rirReported?:boolean}} | null} [actual]
 * @returns {{title:Text2, guidance:Text2, example?:Text2, feedback?:Text2, reported:boolean, estimatedRepsAtTarget:number|null}}
 */
export function setEffortCoaching(planned, exercise, actual = null) {
  const title = { en: "When should I stop?", ru: "Когда закончить подход?" };
  if (planned.kind === "warmup") return { title, guidance: { en: "Keep warm-ups easy and controlled. Follow the warm-up target; save your effort for the working sets and log what you actually did.", ru: "Разминайтесь легко и подконтрольно. Ориентируйтесь на цель разминки, берегите силы для рабочих подходов и записывайте фактический результат." }, reported: false, estimatedRepsAtTarget: null };
  const unit = unitOf(exercise);
  if (unit !== "reps") return { title, guidance: { en: `Aim for ${amountText(planned.reps, exercise, "en")} with steady posture and control. Stop earlier if you lose form or grip. Log the actual ${unit === "seconds" ? "seconds" : "distance"}; reps-in-reserve arithmetic does not translate directly to this exercise.`, ru: `Ориентир — ${amountText(planned.reps, exercise, "ru")} с устойчивой позой и контролем. Завершите раньше при потере техники или хвата. Запишите фактические ${unit === "seconds" ? "секунды" : "метры"}; запас повторений нельзя напрямую пересчитать для этого упражнения.` }, reported: false, estimatedRepsAtTarget: null };
  const R = planned.rir ?? 2;
  const reported = Boolean(actual && Number.isFinite(actual.rir) && (actual.rirReported === true || actual.prescription?.rirReported === true));
  const estimatedRepsAtTarget = reported && actual && actual.reps > 0 ? Math.max(0, Math.floor(actual.reps + (actual.rir ?? 0) - R)) : null;
  const guidance = { en: `The ${planned.reps}-rep target is a guide. Aim to finish with about ${R} more clean reps in reserve (RIR ${R}); stop earlier if your technique breaks down or you feel pain. You do not need to train to failure. Log your actual reps, even above the plan.`, ru: `Цель ${planned.reps} повторений — ориентир. В конце должно оставаться примерно ${R} чистых повторений в запасе (RIR ${R}); завершите раньше при нарушении техники или боли. До отказа доходить не нужно. Запишите фактические повторения, даже если их больше плана.` };
  const example = R > 0 && R < 15 ? { en: `If 15 reps is your absolute maximum, stopping around ${15 - R} would leave roughly ${R} in reserve. If 15 still leaves ${R} clean reps in reserve, you can log 15. These are estimates: keep the weight the same and use your effort and form to decide.`, ru: `Если 15 повторений — ваш абсолютный максимум, примерно ${15 - R} оставят около ${R} в запасе. Если после 15 остаётся ещё ${R} чистых повторений, можно записать 15. Это приблизительная оценка: оставьте тот же вес и ориентируйтесь на усилие и технику.` } : undefined;
  const feedback = estimatedRepsAtTarget != null && actual ? { en: `You reported ${actual.reps} reps with ${actual.rir} in reserve: roughly ${estimatedRepsAtTarget} reps at the target effort. Rest before the next set; this estimate does not account for fatigue.`, ru: `Вы указали ${actual.reps} повторений с запасом ${actual.rir}: примерно ${estimatedRepsAtTarget} повторений при целевом усилии. Отдохните перед следующим подходом; эта оценка не учитывает усталость.` } : { en: "Report how many more clean reps you could have done to help choose the next set. Until then, the displayed RIR is only the target.", ru: "Укажите, сколько ещё чистых повторений вы могли бы сделать: это поможет выбрать следующую цель. До этого показанный запас — лишь ориентир." };
  return { title, guidance, ...(example ? { example } : {}), feedback, reported, estimatedRepsAtTarget };
}

/**
 * Exercises grouped for the screen: superset partners (same `superset` id) form one block at the first partner's
 * place; a lone superset member is a plain block. @param {PlannedExercise[]} exercises
 * @returns {{ key: string, superset: string | null, items: PlannedExercise[] }[]}
 */
export function blocksOf(exercises) {
  /** @type {{ key: string, superset: string | null, items: PlannedExercise[] }[]} */
  const out = [];
  /** @type {Map<string, { key: string, superset: string | null, items: PlannedExercise[] }>} */
  const bySuperset = new Map();
  for (const p of exercises) {
    const known = p.superset ? bySuperset.get(p.superset) : undefined;
    if (known) known.items.push(p);
    else {
      const block = { key: p.superset ? `ss:${p.superset}:${p.slotId}` : `ex:${p.slotId}`, superset: p.superset ?? null, items: [p] };
      if (p.superset) bySuperset.set(p.superset, block);
      out.push(block);
    }
  }
  return out.map((b) => (b.superset && b.items.length < 2 ? { key: `ex:${b.items[0].slotId}`, superset: null, items: b.items } : b));
}

/** Round-robin: A1 B1 A2 B2 … @param {Row[][]} lists */
function interleave(lists) {
  /** @type {Row[]} */
  const out = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let r = 0; r < longest; r++) for (const l of lists) if (l[r]) out.push(l[r]);
  return out;
}

/**
 * The set to do next: in the block logged last, the next pending row after its last logged row; else the first
 * block with such a row; else any pending working row that was passed over. Skipped exercises never count.
 * @param {BlockModel[]} blocks @param {LoggedSet | null} lastSet @returns {Row | null}
 */
function findCurrent(blocks, lastSet) {
  /** @param {BlockModel} b */
  const after = (b) => {
    let last = -1;
    b.sequence.forEach((r, i) => {
      if (r.logged) last = i;
    });
    return b.sequence.slice(last + 1).find((r) => r.state === "planned") ?? null;
  };
  const home = lastSet ? blocks.find((b) => b.exercises.some((e) => e.planned.slotId === lastSet.slotId)) : undefined;
  const fromHome = home ? after(home) : null;
  if (fromHome) return fromHome;
  for (const b of blocks) {
    const r = after(b);
    if (r) return r;
  }
  for (const b of blocks) {
    const r = b.sequence.find((x) => x.state === "planned" && x.kind !== "warmup");
    if (r) return r;
  }
  return null;
}

/**
 * Everything the running-session screen draws: blocks in plan order (superset partners in one block with rows
 * interleaved by round), the rows of every exercise, the current set, completion and the last logged set.
 * @param {{ plan: PlannedSession, sets: LoggedSet[] | Record<string, LoggedSet>, ui?: SessionUi | null }} p
 * @returns {SessionModel}
 */
export function sessionModel({ plan, sets, ui }) {
  const list = byDone(listOf(sets));
  /** @type {Map<string, LoggedSet[]>} */
  const bySlot = new Map();
  for (const s of list) {
    const g = bySlot.get(s.slotId);
    if (g) g.push(s);
    else bySlot.set(s.slotId, [s]);
  }
  let order = 0;
  let done = 0;
  let total = 0;
  let extra = 0;
  let complete = true;
  const blocks = blocksOf(plan.exercises).map((b) => {
    const exercises = b.items.map((p) => {
      const skipped = Boolean(ui?.skipped?.[p.slotId]);
      const slotSets = bySlot.get(p.slotId) ?? [];
      const rows = buildRows(p, slotSets, { extra: ui?.extra?.[p.slotId] ?? 0, skipped });
      const want = p.sets.filter((s) => s.kind !== "warmup").length;
      const got = slotSets.filter((s) => s.kind !== "warmup").length;
      done += Math.min(want, got);
      total += skipped ? Math.min(want, got) : want;
      extra += Math.max(0, got - want);
      if (rows.working.some((r) => r.state === "planned")) complete = false;
      return { planned: p, ...rows, skipped, order: order++ };
    });
    const sequence = [...exercises.flatMap((e) => e.warmups), ...interleave(exercises.map((e) => e.working))];
    return { key: b.key, superset: b.superset, exercises, sequence };
  });
  const slots = new Set(plan.exercises.map((p) => p.slotId));
  const lastSet = list.length ? list[list.length - 1] : null;
  return {
    blocks,
    current: findCurrent(blocks, lastSet),
    completion: { done, total, extra, pct: total ? done / total : 0 },
    complete,
    lastSet,
    orphans: list.filter((s) => !slots.has(s.slotId)),
  };
}

/**
 * Working sets the screen planned for each performed exercise this session, keyed by exercise id (summed when two
 * slots use the same exercise): the exercise's planned rows in its slot (deload-week counts as planned; a substitute
 * swapped in mid-exercise counts the rows it was given; skipped rows count, so a half-skipped exercise is incomplete),
 * and the slot's full prescription for an exercise swapped out after some sets. Sets added with "+ Set" never count.
 * applySession uses it to tell an incomplete log from a complete one (master plan §16, rule 4).
 * @param {SessionModel} model @returns {Record<string, number>}
 */
export function plannedCounts(model) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const b of model.blocks) {
    for (const e of b.exercises) {
      const id = e.planned.exerciseId;
      out[id] = (out[id] ?? 0) + e.working.filter((r) => !r.added).length;
      const full = e.planned.sets.filter((s) => s.kind !== "warmup").length;
      for (const other of new Set(e.history.filter((r) => r.kind !== "warmup").map((r) => r.exerciseId))) {
        if (other !== id) out[other] = (out[other] ?? 0) + full;
      }
    }
  }
  return out;
}

/**
 * Working sets done against the plan (warm-ups not counted; sets beyond the plan are `extra`).
 * @param {PlannedSession | PlannedExercise[] | PlannedExercise} planned @param {LoggedSet[] | Record<string, LoggedSet>} sets  this session's sets
 */
export function completion(planned, sets) {
  const exercises = Array.isArray(planned) ? planned : "exercises" in planned ? planned.exercises : [planned];
  const list = listOf(sets);
  let done = 0;
  let total = 0;
  let extra = 0;
  for (const p of exercises) {
    const want = p.sets.filter((s) => s.kind !== "warmup").length;
    const got = list.filter((s) => s.slotId === p.slotId && s.kind !== "warmup").length;
    total += want;
    done += Math.min(want, got);
    extra += Math.max(0, got - want);
  }
  return { done, total, extra, pct: total ? done / total : 0 };
}

/* ------------------------------------------------------------------ rest timer, elapsed time */

/**
 * Rest after a set, seconds: warm-ups at most 60 s, otherwise the slot's rest (superset members already carry the
 * halved rest of their pair), 90 s when unknown. @param {PlannedExercise | null | undefined} planned
 * @param {Pick<LoggedSet, "kind"> | null | undefined} set @returns {number}
 */
export function restFor(planned, set) {
  const base = planned && planned.restSec > 0 ? planned.restSec : 90;
  const sec = set?.kind === "warmup" ? Math.min(60, base) : base;
  return clamp(Math.round(sec), 15, 600);
}

/**
 * The rest timer after the last logged set (null when nothing is logged or no working set is left): it runs from
 * the set's doneAt, so a reload shows the same countdown. @param {{ model: SessionModel, adjustSec?: number }} p
 * @returns {{ setId: string, startsAt: number, endsAt: number, seconds: number } | null}
 */
export function restWindow({ model, adjustSec = 0 }) {
  const last = model.lastSet;
  if (!last || model.complete) return null;
  const planned = model.blocks.flatMap((b) => b.exercises).find((e) => e.planned.slotId === last.slotId)?.planned ?? null;
  const seconds = Math.max(0, restFor(planned, last) + adjustSec);
  const startsAt = timeOf(last.doneAt);
  return { setId: last.id, startsAt, endsAt: startsAt + seconds * 1000, seconds };
}

/** Seconds since the session started (until it ended). @param {Session} session @param {TimeLike} [now] */
export function elapsed(session, now) {
  const start = timeOf(session.startedAt);
  const at = toMs(now);
  const end = session.endedAt ? Math.min(timeOf(session.endedAt), at) : at;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/* ------------------------------------------------------------------ ending */

/**
 * What identifies a state's progression numbers (not `updatedAt`: the server re-stamps it on upload).
 * @param {ExerciseState} s
 */
const stateStamp = (s) => [s.lastAt ?? "", s.sessions, s.workingKg, s.targetReps, s.lastOutcome, s.fails, s.note?.en ?? ""].join("|");

/** End time: now, or the last set + 5 min when End comes more than 30 min after it. @param {Session} session @param {LoggedSet[]} sets @param {TimeLike} [now] */
function endTime(session, sets, now) {
  const at = toMs(now);
  const last = Math.max(0, ...sets.map((s) => timeOf(s.doneAt)));
  const end = last && at - last > FORGOT_END_MS ? last + END_GRACE_MS : at;
  return new Date(Math.max(end, timeOf(session.startedAt))).toISOString();
}

/** @param {number} n @param {Lang} lang */
const signedKg = (n, lang) => `${num(Math.abs(n), lang)} ${lang === "ru" ? "кг" : "kg"}`;

/**
 * What a summary badge compares next time's target with: the load today's working sets were done at (the most common
 * one, ties → the harder; the engine re-anchors on it too) and the rep target at that load — today's target when it
 * was the planned load, otherwise the weakest set at it. So 15 kg × 7 lifted instead of the planned 20 kg × 6, with
 * 15 kg × 8 next, reads "+1 rep", not "−5 kg".
 * @param {LoggedSet[]} sets  one exercise's sets in one session @param {Exercise | null | undefined} exercise
 * @returns {{ kg: number, reps: number } | null}
 */
export function referenceOf(sets, exercise) {
  let work = sets.filter((s) => s.kind === "working" || s.kind === "amrap");
  if (!work.length) work = sets.filter((s) => s.kind === "backoff");
  if (!work.length) return null;
  const assisted = isAssisted(exercise);
  /** @type {Map<number, LoggedSet[]>} */
  const byKg = new Map();
  for (const s of work) {
    const k = r2(s.kg);
    byKg.set(k, [...(byKg.get(k) ?? []), s]);
  }
  let kg = NaN;
  let count = 0;
  for (const [k, list] of byKg) {
    const harder = Number.isNaN(kg) || (assisted ? k < kg : k > kg);
    if (list.length > count || (list.length === count && harder)) {
      kg = k;
      count = list.length;
    }
  }
  const atKg = byKg.get(kg) ?? [];
  const onPlan = atKg.find((s) => Math.abs(r2(s.plannedKg) - kg) < 0.005);
  const reps = onPlan ? onPlan.plannedReps : Math.min(...atKg.map((s) => s.reps));
  return { kg, reps };
}

/**
 * The badge next to an exercise on the summary: next time vs what was lifted today (harder load, more reps, same,
 * lighter, deload). Assisted machines: less assistance is harder. A failed session never shows as "up" (going back to
 * the target is not progress).
 * @param {{ kg: number, reps: number } | null} before @param {{ kg: number, reps: number } | null} after
 * @param {Outcome | null | undefined} outcome @param {Exercise | null | undefined} exercise @returns {Badge}
 */
export function badgeFor(before, after, outcome, exercise) {
  if (outcome === "deloaded") {
    return { kind: "deload", text: { en: after ? `Deload: ${setText(after, exercise, "en")} next time` : "Deload", ru: after ? `Разгрузка: ${setText(after, exercise, "ru")} в следующий раз` : "Разгрузка" } };
  }
  if (!before || !after) return { kind: "hold", text: { en: "Same targets", ru: "Те же цели" } };
  const assisted = isAssisted(exercise);
  const dKg = r2(after.kg - before.kg);
  const harder = assisted ? dKg < 0 : dKg > 0;
  const easier = assisted ? dKg > 0 : dKg < 0;
  if (harder || easier) {
    const sign = harder ? (assisted ? "−" : "+") : assisted ? "+" : "−";
    const en = assisted ? `${sign}${signedKg(dKg, "en")} assistance next time` : `${sign}${signedKg(dKg, "en")} next time`;
    const ru = assisted ? `${sign}${signedKg(dKg, "ru")} помощи в следующий раз` : `${sign}${signedKg(dKg, "ru")} в следующий раз`;
    return { kind: harder ? (outcome === "failed" ? "hold" : "up") : "down", text: { en, ru } };
  }
  const dReps = after.reps - before.reps;
  if (dReps !== 0) {
    const unit = unitOf(exercise);
    const n = Math.abs(dReps);
    const sign = dReps > 0 ? "+" : "−";
    const en = unit === "seconds" ? `${sign}${n} s next time` : unit === "meters" ? `${sign}${n} m next time` : `${sign}${n} ${n === 1 ? "rep" : "reps"} next time`;
    const ru = unit === "seconds" ? `${sign}${n} с в следующий раз` : unit === "meters" ? `${sign}${n} м в следующий раз` : `${sign}${n} ${pluralRu(n, ["повторение", "повторения", "повторений"])} в следующий раз`;
    return { kind: dReps > 0 ? (outcome === "failed" ? "hold" : "up") : "down", text: { en, ru } };
  }
  return { kind: "hold", text: { en: "Same targets next time", ru: "Те же цели в следующий раз" } };
}

/**
 * Personal records set in this session (first sessions of an exercise only set baselines): best e1RM, heaviest load,
 * more reps at a load. Loads are effective (assistance and body weight accounted for).
 * @param {Snapshot} snapshot @param {Session} session @param {LoggedSet[]} sets  this session's sets @param {Catalog} [catalog]
 * @returns {SummaryPr[]}
 */
export function sessionPrs(snapshot, session, sets, catalog) {
  const cat = catalog ?? DEFAULT_CATALOG;
  /** @type {Record<string, LoggedSet>} */
  const all = { ...snapshot.sets };
  for (const s of sets) all[s.id] = s;
  const bwAt = bodyweightLookup(listOf(snapshot.bodyweight), snapshot.settings?.bodyweightKg ?? null);
  /** @type {Record<string, Session>} */
  const sessions = { ...snapshot.sessions, [session.id]: session };
  /** @param {LoggedSet} s */
  const loadOf = (s) => {
    const bw = sessions[s.sessionId]?.bodyweightKg ?? bwAt(s.doneAt);
    const e = effectiveLoad(s, cat.exerciseById(s.exerciseId), bw);
    return e.kg > 0 ? e.kg : null;
  };
  /** @param {string} id */
  const unit = (id) => unitOf(cat.exerciseById(id));
  return prs(Object.values(all), { loadOf, unitOf: unit })
    .filter((e) => e.sessionId === session.id)
    .map((e) => ({ exerciseId: e.exerciseId, kind: e.kind, value: r2(e.value), previous: r2(e.previous), kg: r2(e.kg), reps: e.reps }));
}

/** @param {{ dayKey: string, plan: PlannedSession }} next @returns {SessionPreview} */
const previewOf = ({ dayKey, plan }) => ({
  dayKey,
  dayName: { en: plan.dayName.en, ru: plan.dayName.ru },
  estimatedMinutes: plan.estimatedMinutes,
  exercises: plan.exercises.map((p) => {
    const w = p.sets.filter((s) => s.kind !== "warmup");
    return { slotId: p.slotId, exerciseId: p.exerciseId, sets: w.length, kg: w[0]?.weightKg ?? 0, reps: w[0]?.reps ?? 0 };
  }),
});

/**
 * plannedCounts of a session's plan as planned at its start, for callers without the screen (an auto-closed session,
 * an End without counts): today's swaps are inferred from the logged sets; the logging phone's added sets and skips are
 * unknown here. Empty when the day is not in the program.
 * @param {Snapshot} snapshot @param {Session} session @param {Program} program @param {LoggedSet[]} sets  this session's sets
 * @param {Catalog} [cat] @returns {Record<string, number>}
 */
export function plannedOf(snapshot, session, program, sets, cat = DEFAULT_CATALOG) {
  if (!dayOf(program, session.dayKey)) return {};
  /** @type {Record<string, LoggedSet>} */
  const all = { ...snapshot.sets };
  for (const s of sets) all[s.id] = s;
  const plan = activePlan({ snapshot: { ...snapshot, sets: all }, session, program, catalog: cat });
  return plannedCounts(sessionModel({ plan, sets, ui: null }));
}

/**
 * The applySession arguments with the working sets the screen planned per exercise (`plannedSets`, master plan §16
 * rule 4: fewer logged than planned holds), added only when there are any. Built as a variable, so the call
 * type-checks whether or not the engine's JSDoc names the field yet.
 * @param {Parameters<typeof applySession>[0]} args @param {Record<string, number> | null | undefined} planned
 * @returns {Parameters<typeof applySession>[0] & { plannedSets?: Record<string, number> }}
 */
export function withPlannedSets(args, planned) {
  /** @type {Parameters<typeof applySession>[0] & { plannedSets?: Record<string, number> }} */
  const full = { ...args };
  if (planned && Object.keys(planned).length) full.plannedSets = { ...planned };
  return full;
}

/** applySession with the planned working sets (withPlannedSets). @param {Parameters<typeof applySession>[0]} args @param {Record<string, number> | null | undefined} planned */
export const applyWithPlan = (args, planned) => applySession(withPlannedSets(args, planned));

/**
 * End a session: `finished` with the progression applied (applySession → states for the next session), or
 * `abandoned` when no working set was logged (the rotation does not advance). The caller upserts `session` and every
 * row of `changed`. `summary` is what the end screen shows. `plannedSets` = plannedCounts of the screen (without it,
 * the counts of the session's plan as planned at its start).
 * @param {{ snapshot: Snapshot, session: Session, sets: LoggedSet[] | Record<string, LoggedSet>, program: Program, now?: TimeLike, catalog?: Catalog, plannedSets?: Record<string, number> | null }} p
 * @returns {{ session: Session, states: Record<string, ExerciseState>, changed: ExerciseState[], outcomes: { exerciseId: string, slotId: string | null, outcome: Outcome, note: Text2 }[], summary: SessionSummary }}
 */
export function endSession({ snapshot, session, sets, program, now, catalog, plannedSets }) {
  program = session.plan?.program ?? program;
  const cat = catalog ?? DEFAULT_CATALOG;
  const mine = setsOfSession(sets, session.id);
  const work = mine.filter((s) => s.kind !== "warmup");
  const at = toIso(now);
  /** @type {Session} */
  const finished = { ...session, status: work.length ? "finished" : "abandoned", endedAt: endTime(session, mine, now), updatedAt: at };
  const day = dayOf(program, session.dayKey);
  /** @type {Text2} */
  const dayName = day ? { en: day.name.en, ru: day.name.ru } : { en: session.dayKey, ru: session.dayKey };
  const planned = day ? day.slots.reduce((n, s) => n + s.sets, 0) : 0;
  /** @type {SessionSummary} */
  const summary = {
    sessionId: session.id,
    dayKey: session.dayKey,
    dayName,
    status: work.length ? "finished" : "abandoned",
    startedAt: session.startedAt,
    endedAt: /** @type {string} */ (finished.endedAt),
    minutes: 0,
    tonnage: 0,
    hardSets: 0,
    working: { done: work.length, total: planned },
    exercises: [],
    skipped: [],
    prs: [],
    next: null,
    reopen: { session, endedAt: /** @type {string} */ (finished.endedAt), states: [] },
  };
  if (!work.length) return { session: finished, states: snapshot.exerciseState, changed: [], outcomes: [], summary };

  const gym = sessionGym(snapshot, session);
  const settings = planSettings(snapshot, session.bodyweightKg);
  const counts = plannedSets ?? plannedOf(snapshot, session, program, mine, cat);
  const prescription = activePlan({ snapshot: { ...snapshot, sets: { ...snapshot.sets, ...Object.fromEntries(mine.map((s) => [s.id, s])) } }, session, program, catalog: cat });
  const applied = applyWithPlan({ program, session: finished, sets: mine, states: snapshot.exerciseState, catalog: cat, now: at, settings, gym, prescription }, counts);
  summary.reopen = {
    session,
    endedAt: /** @type {string} */ (finished.endedAt),
    states: applied.changed.map((c) => ({ exerciseId: c.exerciseId, before: snapshot.exerciseState[c.exerciseId] ?? null, wrote: stateStamp(c) })),
  };
  const sum = summarize(finished, mine, cat);
  summary.minutes = sum.minutes;
  summary.tonnage = sum.tonnage;
  summary.hardSets = sum.hardSets;
  summary.exercises = sum.perExercise.map((pe) => {
    const first = work.find((s) => s.exerciseId === pe.exerciseId);
    const o = applied.outcomes.find((x) => x.exerciseId === pe.exerciseId);
    const st = applied.states[pe.exerciseId];
    const before = referenceOf(work.filter((s) => s.exerciseId === pe.exerciseId), cat.exerciseById(pe.exerciseId));
    const after = st ? { kg: st.workingKg, reps: st.targetReps } : null;
    return {
      exerciseId: pe.exerciseId,
      slotId: first?.slotId ?? o?.slotId ?? null,
      sets: pe.sets,
      topSet: pe.topSet,
      e1rm: pe.e1rm,
      outcome: o?.outcome ?? "held",
      note: o?.note ?? null,
      before,
      after,
      badge: badgeFor(before, after, o?.outcome, cat.exerciseById(pe.exerciseId)),
      hold: holdOf(st, at),
    };
  });
  const trained = new Set(work.map((s) => s.slotId));
  summary.skipped = (day?.slots ?? []).filter((s) => !trained.has(s.slotId)).map((s) => ({ slotId: s.slotId, exerciseId: s.exerciseId }));
  summary.prs = sessionPrs(snapshot, finished, mine, cat);
  /** @type {Record<string, LoggedSet>} */
  const allSets = { ...snapshot.sets };
  for (const s of mine) allSets[s.id] = s;
  /** @type {Snapshot} */
  const after = { ...snapshot, sessions: { ...snapshot.sessions, [finished.id]: finished }, sets: allSets, exerciseState: applied.states };
  summary.next = previewOf(nextAfter(after, program, at));
  return { session: finished, states: applied.states, changed: applied.changed, outcomes: applied.outcomes, summary };
}

/**
 * Reopen a session from its end summary, to log a forgotten set or fix a wrong one (master plan §16: next time's
 * targets must never stay based on sets corrected after End): the session active again, and the exercise states as
 * they were before End (`states` to upsert; `remove`: states End created), keeping a weight hold changed since End.
 * Ending again re-applies the progression from the corrected sets. Null when that is no longer safe: the session is
 * gone or changed since End, a later session exists, a state End wrote has changed since, or the 6 h auto-close is
 * less than 10 min away.
 * @param {{ snapshot: Snapshot, undo: EndUndo | null | undefined, now?: TimeLike }} p
 * @returns {{ session: Session, states: ExerciseState[], remove: string[] } | null}
 */
export function reopenSession({ snapshot, undo, now }) {
  const id = undo?.session?.id;
  if (!undo || !id || !Array.isArray(undo.states)) return null;
  const current = snapshot.sessions[id];
  if (!current || (current.status !== "finished" && current.status !== "abandoned")) return null;
  if (timeOf(current.endedAt) !== timeOf(undo.endedAt)) return null;
  const start = timeOf(current.startedAt);
  if (!start || toMs(now) - start > hoursOf(snapshot) * HOUR_MS - REOPEN_MARGIN_MS) return null;
  if (Object.values(snapshot.sessions).some((s) => s.id !== id && timeOf(s.startedAt) > start)) return null;
  for (const st of undo.states) {
    const live = snapshot.exerciseState[st.exerciseId];
    if (!live || stateStamp(live) !== st.wrote) return null;
  }
  const iso = toIso(now);
  /** @type {ExerciseState[]} */
  const states = [];
  /** @type {string[]} */
  const remove = [];
  for (const st of undo.states) {
    if (!st.before) {
      remove.push(st.exerciseId);
      continue;
    }
    // a weight hold set or cleared on the program page since End is the owner's latest word: it stays
    const live = snapshot.exerciseState[st.exerciseId];
    const hold = "holdUntil" in live ? { holdUntil: live.holdUntil } : {};
    states.push({ ...st.before, ...hold, updatedAt: iso });
  }
  return { session: { ...current, status: "active", endedAt: null, updatedAt: iso }, states, remove };
}

/**
 * The next session in the rotation with today's targets (the active gym, the latest body weight). `dayKey` plans
 * another day instead (the start panel's day chips), `bodyweightKg` the body weight entered before starting.
 * @param {Snapshot} snapshot @param {Program} program @param {TimeLike} [now]
 * @param {{ dayKey?: string | null, bodyweightKg?: number | null }} [opts]
 * @returns {{ dayKey: string, rotationKey: string, plan: PlannedSession, gym: Gym | null }}
 */
export function nextAfter(snapshot, program, now, opts = {}) {
  const rotationKey = nextDayKey(program, snapshot.sessions, now);
  const dayKey = opts.dayKey && dayOf(program, opts.dayKey) ? opts.dayKey : rotationKey;
  const gym = activeGym(snapshot);
  const plan = planSession({ program, dayKey, states: snapshot.exerciseState, gym, settings: planSettings(snapshot, opts.bodyweightKg), now });
  return { dayKey, rotationKey, plan, gym };
}

/**
 * Sessions the store closed automatically (6 h) that still need work, oldest first: empty ones become `abandoned`;
 * the others get their progression applied once (an exercise whose state already has `lastAt` ≥ the session start
 * counts as applied, and newer states are never overwritten). Sessions older than 30 days are left alone.
 * @param {Snapshot} snapshot @param {TimeLike} [now] @param {{ catalog?: Catalog }} [opts]
 * @returns {{ abandon: Session[], apply: { session: Session, changed: ExerciseState[] }[], states: Record<string, ExerciseState> }}
 */
export function closeOuts(snapshot, now, opts = {}) {
  const cat = opts.catalog ?? DEFAULT_CATALOG;
  const at = toMs(now);
  const iso = toIso(now);
  const candidates = Object.values(snapshot.sessions)
    .filter((s) => s.status === "auto_closed" && timeOf(s.startedAt) >= at - CLOSE_OUT_DAYS * DAY_MS)
    .sort((a, b) => timeOf(a.startedAt) - timeOf(b.startedAt));
  let states = snapshot.exerciseState;
  /** @type {Session[]} */
  const abandon = [];
  /** @type {{ session: Session, changed: ExerciseState[] }[]} */
  const apply = [];
  for (const s of candidates) {
    const sets = setsOfSession(snapshot.sets, s.id);
    const work = sets.filter((x) => x.kind !== "warmup");
    if (!work.length) {
      abandon.push({ ...s, status: "abandoned", updatedAt: iso });
      continue;
    }
    const start = timeOf(s.startedAt);
    /** @param {string} id */
    const newer = (id) => {
      const st = states[id];
      return Boolean(st?.lastAt) && timeOf(st.lastAt) >= start;
    };
    if (work.some((x) => newer(x.exerciseId))) continue;
    const program = snapshot.programs[s.programId] ?? (snapshot.activeProgramId ? snapshot.programs[snapshot.activeProgramId] : undefined);
    if (!program) continue;
    const planned = plannedOf({ ...snapshot, exerciseState: states }, s, program, sets, cat);
    const r = applyWithPlan({ program, session: s, sets, states, catalog: cat, now: iso, settings: planSettings(snapshot, s.bodyweightKg), gym: sessionGym(snapshot, s) }, planned);
    const changed = r.changed.filter((c) => !newer(c.exerciseId));
    if (!changed.length) continue;
    const next = { ...states };
    for (const c of changed) next[c.exerciseId] = c;
    states = next;
    apply.push({ session: s, changed });
  }
  return { abandon, apply, states };
}

/* ------------------------------------------------------------------ weight holds (master plan §16) */

/**
 * The end of an exercise's weight hold (`ExerciseState.holdUntil`: no load increase before it) while it is still
 * ahead of `now`; null otherwise. @param {Pick<ExerciseState, "holdUntil"> | null | undefined} state @param {TimeLike} [now]
 * @returns {string | null}
 */
export function holdOf(state, now) {
  const until = state?.holdUntil;
  if (typeof until !== "string" || !until) return null;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > toMs(now) ? until : null;
}

/** "16 Nov" / "16 нояб." in the device's time zone. @param {string} iso @param {Lang} lang */
export const holdDay = (iso, lang) => new Date(iso).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short" });

/**
 * "Weight held until 16 Nov" / "Вес зафиксирован до 16 нояб." — the same words the engine puts in the planned note, so
 * a screen that shows both can tell (noteHasHold) and show it once. Setting and clearing a hold: program-edit.mjs.
 * @param {string} until @param {Lang} lang
 */
export function holdText(until, lang) {
  const day = Number.isNaN(Date.parse(until)) ? until : holdDay(until, lang);
  return lang === "ru" ? `Вес зафиксирован до ${day}` : `Weight held until ${day}`;
}

/** True when an engine note already names this hold (its date in the note's language). @param {Text2 | null | undefined} note @param {string} until @param {Lang} lang */
export const noteHasHold = (note, until, lang) => {
  const text = note ? (lang === "ru" ? note.ru || note.en : note.en) : "";
  return Boolean(text) && text.includes(holdDay(until, lang));
};

/* ------------------------------------------------------------------ the swap sheet */

/**
 * What the swap sheet shows for one planned slot: `options` = exercises it may switch to here (the plan's
 * alternatives: available at the gym, best first), `missing` = the slot exercise and its catalog alternatives that this
 * gym marks as not here (to explain an empty list). @param {PlannedExercise} planned @param {Gym | null} gym
 * @param {Catalog} [catalog] @returns {{ options: string[], missing: string[] }}
 */
export function swapChoices(planned, gym, catalog) {
  const cat = catalog ?? DEFAULT_CATALOG;
  const options = planned.alternatives.filter((id, i, a) => id !== planned.exerciseId && a.indexOf(id) === i && cat.isAvailable(id, gym));
  const known = [planned.programExerciseId, ...(cat.exerciseById(planned.programExerciseId)?.alternatives ?? [])];
  const missing = known.filter((id, i, a) => a.indexOf(id) === i && id !== planned.exerciseId && !options.includes(id)
    && Boolean(cat.exerciseById(id)) && !cat.isAvailable(id, gym));
  return { options, missing };
}

/* ------------------------------------------------------------------ body weight */

/** The newest weigh-in. @param {Snapshot} snapshot @returns {BodyweightEntry | null} */
export function latestBodyweight(snapshot) {
  /** @type {BodyweightEntry | null} */
  let best = null;
  for (const e of Object.values(snapshot.bodyweight)) {
    if (!validBodyweight(e.kg)) continue;
    if (!best || timeOf(e.at) > timeOf(best.at)) best = e;
  }
  return best;
}

/** @param {TimeLike} a @param {TimeLike} b */
const sameLocalDay = (a, b) => new Date(toMs(a)).toDateString() === new Date(toMs(b)).toDateString();

/**
 * The weigh-in to save when the body weight entered before a session differs from the latest one: today's entry
 * updated, or a new one. Null when nothing changed (or the value is not a plausible weight).
 * @param {{ snapshot: Snapshot, kg: number, now?: TimeLike, id?: string }} p @returns {BodyweightEntry | null}
 */
export function bodyweightRow({ snapshot, kg, now, id }) {
  if (!validBodyweight(kg)) return null;
  const at = toIso(now);
  const value = r2(kg);
  const latest = latestBodyweight(snapshot);
  if (latest && Math.abs(latest.kg - value) < 0.05) return null;
  if (latest && sameLocalDay(latest.at, at)) return { ...latest, kg: value, updatedAt: at };
  return { id: id ?? newId(), at, kg: value, updatedAt: at };
}

/**
 * Body weight for the home card: the latest weigh-in, the EWMA trend (α 0.1 per day) and its change per week over
 * up to the last 14 days (null with less than 3 days of span). Arrow: up / down beyond ±0.1 kg a week, else flat.
 * @param {Snapshot} snapshot
 * @returns {{ kg: number, at: string, trend: number, kgPerWeek: number | null, arrow: "up" | "down" | "flat" | null, points: number } | null}
 */
export function bodyweightTrend(snapshot) {
  const latest = latestBodyweight(snapshot);
  if (!latest) return null;
  const pts = dailyMean(Object.values(snapshot.bodyweight).filter((e) => validBodyweight(e.kg)).map((e) => ({ at: e.at, value: e.kg })));
  const tr = ewma(pts);
  const last = tr[tr.length - 1];
  const from = last.at - 14 * DAY_MS;
  const ref = tr.find((p) => p.at >= from) ?? tr[0];
  const spanDays = (last.at - ref.at) / DAY_MS;
  const kgPerWeek = spanDays >= 3 ? ((last.trend - ref.trend) / spanDays) * 7 : null;
  const arrow = kgPerWeek == null ? null : kgPerWeek > 0.1 ? "up" : kgPerWeek < -0.1 ? "down" : "flat";
  return { kg: latest.kg, at: latest.at, trend: r2(last.trend), kgPerWeek: kgPerWeek == null ? null : r2(kgPerWeek), arrow, points: tr.length };
}

/* ------------------------------------------------------------------ home cards */

/**
 * This week against the plan (Monday weeks; abandoned sessions do not count) and the streak of met weeks.
 * @param {Snapshot} snapshot @param {number} daysPerWeek @param {TimeLike} [now]
 */
export function weekStatus(snapshot, daysPerWeek, now) {
  const a = adherence(Object.values(snapshot.sessions), { weeks: 1, daysPerWeek, now: toMs(now) });
  return { done: a.thisWeek.done, planned: a.thisWeek.planned, streak: a.streak };
}

/**
 * The last trained session for the home card: day, minutes, working sets and what the progression did
 * (counted from the exercise states it updated). @param {Snapshot} snapshot @param {TimeLike} [now] @param {Catalog} [catalog]
 */
export function lastSessionInfo(snapshot, now, catalog) {
  const s = lastSession(snapshot, now);
  if (!s) return null;
  const program = snapshot.programs[s.programId] ?? (snapshot.activeProgramId ? snapshot.programs[snapshot.activeProgramId] : undefined);
  const day = dayOf(program, s.dayKey);
  const sets = setsOfSession(snapshot.sets, s.id);
  const work = sets.filter((x) => x.kind !== "warmup");
  const start = timeOf(s.startedAt);
  const outcomes = { up: 0, hold: 0, missed: 0, down: 0 };
  for (const id of new Set(work.map((x) => x.exerciseId))) {
    const st = snapshot.exerciseState[id];
    if (!st?.lastAt || timeOf(st.lastAt) < start) continue;
    if (st.lastOutcome === "progressed") outcomes.up += 1;
    else if (st.lastOutcome === "failed") outcomes.missed += 1;
    else if (st.lastOutcome === "deloaded" || st.lastOutcome === "reset") outcomes.down += 1;
    else outcomes.hold += 1;
  }
  return {
    session: s,
    dayName: day ? { en: day.name.en, ru: day.name.ru } : null,
    minutes: summarize(s, sets, catalog ?? DEFAULT_CATALOG).minutes,
    workingSets: work.length,
    outcomes,
    autoClosed: sessionStatus(s, now, hoursOf(snapshot)) === "auto_closed",
  };
}

/* ------------------------------------------------------------------ content: safety, technique */

/**
 * Warm-up text and pain rules from content/fitness/safety.json (shape-guarded: stream 08 rewrites the file).
 * @returns {{ warmup: Text2 | null, pain: { level: string, action: Text2 }[], redFlags: Text2[] }}
 */
export function safetyInfo() {
  /** @type {any} */
  const s = safety;
  const warm = s?.warmup?.general;
  return {
    warmup: isText2(warm) ? warm : null,
    pain: Array.isArray(s?.pain) ? s.pain.filter((/** @type {any} */ p) => isText2(p?.action)).map((/** @type {any} */ p) => ({ level: String(p.level ?? ""), action: p.action })) : [],
    redFlags: Array.isArray(s?.redFlags) ? s.redFlags.filter(isText2) : [],
  };
}

/**
 * What the Technique toggle shows: the sequence picture (when one exists) and the first three cues.
 * @param {string} exerciseId @param {Catalog} [catalog]
 * @returns {{ image: { src: string, alt: Text2 } | null, cues: { en: string[], ru: string[] }, setup: Text2 | null }}
 */
export function techniqueOf(exerciseId, catalog) {
  const ex = (catalog ?? DEFAULT_CATALOG).exerciseById(exerciseId);
  const images = Array.isArray(ex?.images) ? ex.images : [];
  const pic = images.find((i) => i.angle === "sequence") ?? images[0] ?? null;
  return {
    image: pic && typeof pic.src === "string" ? { src: pic.src, alt: isText2(pic.alt) ? pic.alt : { en: "", ru: "" } } : null,
    cues: { en: (ex?.cues?.en ?? []).slice(0, 3), ru: (ex?.cues?.ru ?? []).slice(0, 3) },
    setup: isText2(ex?.setup) ? ex.setup : null,
  };
}

/* ------------------------------------------------------------------ texts */

const NF = { en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }), ru: new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }) };
/** @param {number} n @param {Lang} lang */
const num = (n, lang) => NF[lang === "ru" ? "ru" : "en"].format(r2(n));

/** @param {number} n @param {[string, string, string]} forms */
function pluralRu(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** @param {Exercise | null | undefined} ex */
const perHand = (ex) => Boolean(ex && !ex.unilateral && (ex.equipment === "dumbbell" || ex.equipment === "kettlebell"));

/**
 * How a set reads on its row: "40 kg × 12", "40 s", "10 kg · 40 s", "2 × 24 kg · 30 m", "assist −25 kg × 8",
 * "Bodyweight × 8", "BW + 5 kg × 8". @param {{ kg: number, reps: number }} set @param {Exercise | null | undefined} exercise
 * @param {Lang} lang @returns {string}
 */
export function setText({ kg, reps }, exercise, lang) {
  const ru = lang === "ru";
  const unit = unitOf(exercise);
  const k = `${num(kg, lang)} ${ru ? "кг" : "kg"}`;
  if (unit === "seconds") return kg > 0 ? `${k} · ${num(reps, lang)} ${ru ? "с" : "s"}` : `${num(reps, lang)} ${ru ? "с" : "s"}`;
  if (unit === "meters") {
    const load = kg > 0 ? (perHand(exercise) ? `2 × ${k}` : k) : ru ? "Без веса" : "No load";
    return `${load} · ${num(reps, lang)} ${ru ? "м" : "m"}`;
  }
  if (isAssisted(exercise)) return kg > 0 ? `${ru ? "помощь" : "assist"} −${k} × ${reps}` : `${ru ? "Без помощи" : "No assist"} × ${reps}`;
  if (exercise?.equipment === "bodyweight") return kg > 0 ? `${ru ? "Свой вес" : "BW"} + ${k} × ${reps}` : `${ru ? "Свой вес" : "Bodyweight"} × ${reps}`;
  if (exercise?.equipment === "band") return `${ru ? "Резина" : "Band"} × ${reps}`;
  return `${k} × ${reps}`;
}

/**
 * A short hint under the load: "per hand" for pairs of dumbbells (not carries, which say 2 ×), "each side" for
 * one-sided exercises, "plates, both sides" for plate-loaded machines (the number is the plates on both sides
 * together, without the sled or carriage: master plan §16); "" otherwise.
 * @param {Exercise | null | undefined} exercise @param {Lang} lang
 */
export function setHint(exercise, lang) {
  if (!exercise) return "";
  if (exercise.unilateral) return lang === "ru" ? "на каждую сторону" : "each side";
  if (exercise.equipment === "plate-loaded") return lang === "ru" ? "блины с обеих сторон" : "plates, both sides";
  if (perHand(exercise) && unitOf(exercise) !== "meters") return lang === "ru" ? "на руку" : "per hand";
  return "";
}

/**
 * A rep target with its unit: "8" (reps), "30 s", "20 m" — for "target …" on a missed set.
 * @param {number} reps @param {Exercise | null | undefined} exercise @param {Lang} lang
 */
export function amountText(reps, exercise, lang) {
  const unit = unitOf(exercise);
  if (unit === "seconds") return `${num(reps, lang)} ${lang === "ru" ? "с" : "s"}`;
  if (unit === "meters") return `${num(reps, lang)} ${lang === "ru" ? "м" : "m"}`;
  return `${reps}`;
}

/** "3 sets" / "3 подхода". @param {number} n @param {Lang} lang */
export const setsWord = (n, lang) => (lang === "ru" ? `${n} ${pluralRu(n, ["подход", "подхода", "подходов"])}` : `${n} ${n === 1 ? "set" : "sets"}`);

/**
 * One line for a planned exercise: "40 kg × 12 · 3 sets" (first working set), plus the load hint when there is one
 * ("12 kg × 10 · 2 sets · per hand", "… · plates, both sides").
 * @param {Pick<PlannedExercise, "sets">} planned @param {Exercise | null | undefined} exercise @param {Lang} lang
 */
export function prescriptionText(planned, exercise, lang) {
  const work = planned.sets.filter((s) => s.kind !== "warmup");
  const first = work[0];
  if (!first) return "";
  const hint = setHint(exercise, lang);
  return `${setText({ kg: first.weightKg, reps: first.reps }, exercise, lang)} · ${setsWord(work.length, lang)}${hint ? ` · ${hint}` : ""}`;
}

/** Unit label for the reps stepper. @param {Exercise | null | undefined} exercise @param {Lang} lang */
export function repsLabel(exercise, lang) {
  const unit = unitOf(exercise);
  if (unit === "seconds") return lang === "ru" ? "секунды" : "seconds";
  if (unit === "meters") return lang === "ru" ? "метры" : "metres";
  return lang === "ru" ? "повторы" : "reps";
}

/** Load label for the kg stepper ("assist kg" on assisted machines). @param {Exercise | null | undefined} exercise @param {Lang} lang */
export function kgStepLabel(exercise, lang) {
  if (isAssisted(exercise)) return lang === "ru" ? "помощь, кг" : "assist kg";
  if (exercise?.equipment === "bodyweight") return lang === "ru" ? "доп. вес, кг" : "added kg";
  if (exercise?.equipment === "plate-loaded") return lang === "ru" ? "кг блинов, обе стороны" : "kg plates, both sides";
  return perHand(exercise) ? (lang === "ru" ? "кг на руку" : "kg per hand") : lang === "ru" ? "кг" : "kg";
}

/** The exercise's name in a language (a readable id when the catalog does not know it). @param {string} id @param {Lang} lang @param {Catalog} [catalog] */
export function exerciseName(id, lang, catalog) {
  const ex = (catalog ?? DEFAULT_CATALOG).exerciseById(id);
  if (ex) return lang === "ru" ? ex.name.ru || ex.name.en : ex.name.en;
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Coarse group names of a day's focus ("Chest, Back, Shoulders"). @param {string[]} groups @param {Lang} lang */
export function focusText(groups, lang) {
  return groups.map((g) => {
    const info = groupById(g);
    return info ? (lang === "ru" ? info.name.ru : info.name.en) : g;
  }).join(", ");
}

/**
 * Short muscle names for the exercise card ("Mid chest", "Lats"): primary muscles, then up to three secondary.
 * @param {string} exerciseId @param {Lang} lang @param {Catalog} [catalog] @returns {{ primary: string[], secondary: string[] }}
 */
export function muscleTags(exerciseId, lang, catalog) {
  const ex = (catalog ?? DEFAULT_CATALOG).exerciseById(exerciseId);
  /** @param {string} id */
  const short = (id) => {
    const m = muscleById(id);
    const name = m ? (lang === "ru" ? m.name.ru : m.name.en) : id;
    return name.replace(/\s*\(.*\)\s*$/, "");
  };
  return { primary: (ex?.primary ?? []).map(short), secondary: (ex?.secondary ?? []).slice(0, 3).map(short) };
}
