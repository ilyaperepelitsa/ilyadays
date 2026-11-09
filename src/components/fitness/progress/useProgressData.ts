"use client";
/** Everything the progress sections derive from the snapshot, memoized once per snapshot change (stream 06). */
import { useMemo } from "react";
import type { BodyweightEntry, LoggedSet, Session, Snapshot } from "@/lib/fitness/types";
import { bodyweightLookup, effectiveLoad, toMs } from "@/lib/fitness/analytics.mjs";
import type { ProgressCatalog } from "./types";

export type LoadFlag = "no-bodyweight" | "unknown-fraction" | null;

export type ProgressData = {
  /** Sessions that count (not abandoned), oldest first */
  sessions: Session[];
  /** Sets of those sessions (and sets whose session row has not arrived yet) */
  sets: LoggedSet[];
  /** Weigh-ins, oldest first */
  entries: BodyweightEntry[];
  /** A set's time: its session's start, else the set time */
  timeOf: (s: LoggedSet) => number;
  /** Effective load for e1RM (bodyweight − assistance, bodyweight fraction …), null when unknown */
  loadOf: (s: LoggedSet) => number | null;
  /** Load counted in tonnage: the effective load, or the added kg of a bodyweight set with an unknown fraction */
  tonnageOf: (s: LoggedSet) => number | null;
  flagOf: (s: LoggedSet) => LoadFlag;
  unitOf: (exerciseId: string) => string;
  daysPerWeek: number;
};

export function useProgressData(snapshot: Snapshot, catalog: ProgressCatalog): ProgressData {
  const { sessions: sessionRows, sets: setRows, bodyweight, settings } = snapshot;
  return useMemo(() => {
    const byId = new Map(Object.values(sessionRows).map((s) => [s.id, s]));
    const sessions = [...byId.values()].filter((s) => s.status !== "abandoned").sort((a, b) => toMs(a.startedAt) - toMs(b.startedAt));
    const sets = Object.values(setRows).filter((s) => byId.get(s.sessionId)?.status !== "abandoned");
    const entries = Object.values(bodyweight).sort((a, b) => toMs(a.at) - toMs(b.at));
    const fallbackKg = settings?.bodyweightKg ?? null;
    const lookup = bodyweightLookup(entries, fallbackKg);
    const timeOf = (s: LoggedSet) => {
      const t = toMs(byId.get(s.sessionId)?.startedAt ?? s.doneAt);
      return Number.isFinite(t) ? t : toMs(s.doneAt);
    };
    const bodyweightAt = (s: LoggedSet) => (entries.length ? lookup(timeOf(s)) : (byId.get(s.sessionId)?.bodyweightKg ?? fallbackKg));
    const facts = (id: string) => {
      const e = catalog[id];
      return e ? { id, equipment: e.equipment, assistance: e.assistance, pattern: e.pattern, repUnit: e.unit } : { id };
    };
    const load = (s: LoggedSet) => effectiveLoad(s, facts(s.exerciseId), bodyweightAt(s));
    return {
      sessions,
      sets,
      entries,
      timeOf,
      loadOf: (s) => {
        const l = load(s);
        return l.flag || !(l.kg > 0) ? null : l.kg;
      },
      tonnageOf: (s) => {
        const l = load(s);
        if (!l.flag) return l.kg > 0 ? l.kg : null;
        return l.kind === "bodyweight" && s.kg > 0 ? s.kg : null;
      },
      flagOf: (s) => load(s).flag,
      unitOf: (id) => catalog[id]?.unit ?? "reps",
      daysPerWeek: settings?.daysPerWeek ?? 3,
    };
  }, [sessionRows, setRows, bodyweight, settings, catalog]);
}
