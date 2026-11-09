import type { Snapshot } from "./types";

/** The snapshot before anything is loaded (server render, first client frame). Frozen so nobody mutates it. */
export const EMPTY_SNAPSHOT: Snapshot = Object.freeze({
  programs: {},
  activeProgramId: null,
  gyms: {},
  sessions: {},
  sets: {},
  exerciseState: {},
  bodyweight: {},
  measurements: {},
  adjustments: {},
  settings: null,
  syncedAt: null,
  pending: 0,
}) as Snapshot;
