// @ts-check
/**
 * Personal history of one exercise (stream 02): one row per session, newest first, with the session's best set and
 * its estimated 1RM from stream 06's analytics (effective load: assisted = bodyweight − assistance, bodyweight
 * exercises = bodyweight share + added load). Pure; analytics.mjs imports nothing, so this stays out of the catalog.
 */
import { bodyweightLookup, e1rmSeries, effectiveLoad, toMs } from "../../../lib/fitness/analytics.mjs";

/** @typedef {import("../../../lib/fitness/types").LoggedSet} LoggedSet */
/** @typedef {import("../../../lib/fitness/types").Snapshot} Snapshot */
/**
 * What the history needs to know about the exercise (a subset of `Exercise`).
 * @typedef {object} HistoryFacts
 * @property {string} id
 * @property {string} equipment
 * @property {boolean} [assistance]
 * @property {"reps" | "seconds" | "meters"} [repUnit]
 */
/**
 * @typedef {object} HistoryRow
 * @property {string} sessionId
 * @property {number} at  epoch ms (session start)
 * @property {LoggedSet} best  the session's best working set
 * @property {number} sets  working sets logged in the session
 * @property {number | null} e1rm  kg; null for holds and carries, or when the effective load is unknown
 * @property {boolean} reliable  false when the estimate rests on > 12 total reps or RIR > 4
 */

/** @param {HistoryFacts} ex */
const assisted = (ex) => ex.assistance === true || ex.equipment === "assisted";

/**
 * Fallback order when there is no e1RM: heavier first (less assistance on assisted machines), then more reps;
 * holds and carries: longer first, then heavier.
 * @param {LoggedSet} a @param {LoggedSet} b @param {HistoryFacts} ex
 */
function better(a, b, ex) {
  if ((ex.repUnit ?? "reps") !== "reps") return a.reps > b.reps || (a.reps === b.reps && a.kg > b.kg);
  const heavier = assisted(ex) ? a.kg < b.kg : a.kg > b.kg;
  return heavier || (a.kg === b.kg && a.reps > b.reps);
}

/**
 * @param {Pick<Snapshot, "sets" | "sessions" | "bodyweight" | "settings">} snapshot
 * @param {HistoryFacts} ex
 * @returns {HistoryRow[]}
 */
export function exerciseHistory(snapshot, ex) {
  const sets = Object.values(snapshot.sets).filter((s) => s.exerciseId === ex.id && s.kind !== "warmup" && s.reps > 0);
  if (!sets.length) return [];
  /** @param {LoggedSet} s */
  const timeOf = (s) => {
    const started = toMs(snapshot.sessions[s.sessionId]?.startedAt);
    return Number.isFinite(started) ? started : toMs(s.doneAt);
  };
  const weightAt = bodyweightLookup(Object.values(snapshot.bodyweight), snapshot.settings?.bodyweightKg ?? null);
  /** @param {LoggedSet} s */
  const loadOf = (s) => {
    const load = effectiveLoad(s, ex, weightAt(timeOf(s)));
    return load.kg > 0 ? load.kg : null;
  };
  const series = (ex.repUnit ?? "reps") === "reps" ? e1rmSeries(sets, ex.id, { loadOf, timeOf, unitOf: () => "reps" }) : [];
  const estimates = new Map(series.map((r) => [r.sessionId, r]));
  /** @type {Map<string, LoggedSet[]>} */
  const bySession = new Map();
  for (const s of sets) {
    const list = bySession.get(s.sessionId);
    if (list) list.push(s);
    else bySession.set(s.sessionId, [s]);
  }
  /** @type {HistoryRow[]} */
  const rows = [];
  for (const [sessionId, list] of bySession) {
    const est = estimates.get(sessionId);
    const best = (est && list.find((s) => s.id === est.setId)) || list.reduce((a, b) => (better(b, a, ex) ? b : a));
    const at = Math.min(...list.map(timeOf));
    rows.push({ sessionId, at, best, sets: list.length, e1rm: est ? est.kg : null, reliable: est ? est.reliable : false });
  }
  return rows.sort((a, b) => b.at - a.at);
}
