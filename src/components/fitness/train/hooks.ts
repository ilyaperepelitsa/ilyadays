/**
 * Client helpers for the train and home pages (stream 04 — plans/fitness/04-session-tracker-ui.md): a clock that is
 * null during the server render, the per-device UI state of a running session (localStorage), the end-of-session
 * summary (sessionStorage, survives a reload in this tab), the screen wake lock, the program bootstrap and the
 * close-out of auto-closed sessions. Every storage access is wrapped: private windows and blocked storage still work.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Program } from "@/lib/fitness/types";
import { EMPTY_SNAPSHOT } from "@/lib/fitness/empty";
import { closeOuts, ensureProgram, type SessionSummary, type SessionUi } from "@/lib/fitness/tracker.mjs";
import { useFitness } from "../Provider";
import { useStoreStatus } from "../ModeNote";

/* ------------------------------------------------------------------ clock */

const clocks = new Map<number, { subscribe: (cb: () => void) => () => void; get: () => number }>();

function clockFor(ms: number) {
  let clock = clocks.get(ms);
  if (!clock) {
    const poll = Math.max(250, Math.min(15_000, ms / 4));
    clock = {
      subscribe: (onChange) => {
        const id = window.setInterval(onChange, poll);
        const onVisible = () => {
          if (document.visibilityState === "visible") onChange();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
          window.clearInterval(id);
          document.removeEventListener("visibilitychange", onVisible);
        };
      },
      get: () => Math.floor(Date.now() / ms) * ms,
    };
    clocks.set(ms, clock);
  }
  return clock;
}
const serverClock = () => null;

/** Current time rounded down to `ms`; null during the server render and hydration (no impure calls in render). */
export function useClock(ms = 1000): number | null {
  const clock = clockFor(ms);
  return useSyncExternalStore(clock.subscribe, clock.get, serverClock);
}

/* ------------------------------------------------------------------ per-session UI state (localStorage) */

/** Rest-timer tweaks for the set it belongs to: ±30 s steps and "dismissed". */
export type RestUi = { setId: string; adjust: number; dismissed: boolean };
export type TrainUi = SessionUi & { rest?: RestUi; warm?: Record<string, boolean>; at?: number };
type UiFile = { v: 1; sessions: Record<string, TrainUi>; seen: string[] };

const UI_KEY = "ilyadays-fitness:train-ui";
const MAX_SESSIONS = 8;
const MAX_SEEN = 20;
const EMPTY_UI: TrainUi = Object.freeze({}) as TrainUi;
let uiCache: UiFile | null = null;
const uiListeners = new Set<() => void>();

function isUiFile(v: unknown): v is UiFile {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Partial<UiFile>;
  return f.v === 1 && typeof f.sessions === "object" && f.sessions !== null && Array.isArray(f.seen);
}

function readUi(): UiFile {
  if (uiCache) return uiCache;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(window.localStorage.getItem(UI_KEY) ?? "null");
  } catch {
    parsed = null;
  }
  uiCache = isUiFile(parsed) ? parsed : { v: 1, sessions: {}, seen: [] };
  return uiCache;
}

function writeUi(next: UiFile) {
  uiCache = next;
  try {
    window.localStorage.setItem(UI_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the state lives in memory for this page
  }
  for (const listener of uiListeners) listener();
}

function subscribeUi(onChange: () => void) {
  uiListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === UI_KEY) {
      uiCache = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    uiListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** This device's UI state of one session (swaps, skips, added sets, rest timer); an empty object when none. */
export function useSessionUi(sessionId: string | null): TrainUi {
  return useSyncExternalStore(
    subscribeUi,
    () => (sessionId ? readUi().sessions[sessionId] ?? EMPTY_UI : EMPTY_UI),
    () => EMPTY_UI,
  );
}

export function updateSessionUi(sessionId: string, change: (ui: TrainUi) => TrainUi) {
  const file = readUi();
  const sessions: Record<string, TrainUi> = { ...file.sessions, [sessionId]: { ...change(file.sessions[sessionId] ?? {}), at: Date.now() } };
  const keep = Object.keys(sessions)
    .sort((a, b) => (sessions[b].at ?? 0) - (sessions[a].at ?? 0))
    .slice(0, MAX_SESSIONS);
  writeUi({ ...file, sessions: Object.fromEntries(keep.map((id) => [id, sessions[id]])) });
}

/** "Shown once" flags (the auto-closed notice). */
export function useSeen(id: string | null): boolean {
  return useSyncExternalStore(subscribeUi, () => (id ? readUi().seen.includes(id) : false), () => true);
}

export function markSeen(id: string) {
  const file = readUi();
  if (file.seen.includes(id)) return;
  writeUi({ ...file, seen: [id, ...file.seen].slice(0, MAX_SEEN) });
}

/* ------------------------------------------------------------------ the end-of-session summary (sessionStorage) */

const SUMMARY_KEY = "ilyadays-fitness:train-summary";
/** The summary as saved: `at` = when End was tapped (ms), so a tab kept open until the next gym day starts fresh. */
export type SavedSummary = { at: number; summary: SessionSummary };
let summaryCache: SavedSummary | null | undefined;
const summaryListeners = new Set<() => void>();

function readSummary(): SavedSummary | null {
  if (summaryCache !== undefined) return summaryCache;
  try {
    const v = JSON.parse(window.sessionStorage.getItem(SUMMARY_KEY) ?? "null");
    const s = v?.summary;
    summaryCache = typeof v?.at === "number" && s && typeof s.sessionId === "string" && Array.isArray(s.exercises) ? (v as SavedSummary) : null;
  } catch {
    summaryCache = null;
  }
  return summaryCache;
}

function subscribeSummary(onChange: () => void) {
  summaryListeners.add(onChange);
  return () => {
    summaryListeners.delete(onChange);
  };
}

/** Save the summary of the session just ended (null = "Done"). Event handlers only: it reads the clock. */
export function setSummary(summary: SessionSummary | null) {
  summaryCache = summary ? { at: Date.now(), summary } : null;
  try {
    if (summaryCache) window.sessionStorage.setItem(SUMMARY_KEY, JSON.stringify(summaryCache));
    else window.sessionStorage.removeItem(SUMMARY_KEY);
  } catch {
    // kept in memory for this page
  }
  for (const listener of summaryListeners) listener();
}

/**
 * "Done" on the summary (a link to /fitness): forget the summary for reloads and later visits of this tab, but keep it
 * on screen until the train page is left (useSummaryUntilLeave clears it then). Clearing it at the tap would show the
 * next day's Start panel for as long as the navigation takes, its Start button under the thumb that tapped Done.
 */
export function leaveSummary() {
  try {
    window.sessionStorage.removeItem(SUMMARY_KEY);
  } catch {
    // only in memory: cleared when the page is left
  }
}

/** The summary of the session ended in this tab, until "Done" (the caller decides how long it stays fresh). */
export function useSummary(): SavedSummary | null {
  return useSyncExternalStore(subscribeSummary, readSummary, () => null);
}

let leaveTimer: number | undefined;

/**
 * The summary belongs to the visit that ended the session: leaving the train page by any link (the sub-navigation, an
 * exercise name, a Start link elsewhere) clears it, so coming back shows the next day's Start instead of the old
 * summary. A reload keeps it (unloading runs no effect cleanup). The clear waits a tick so React's development
 * double mount (mount → unmount → mount) cancels it.
 */
export function useSummaryUntilLeave() {
  useEffect(() => {
    window.clearTimeout(leaveTimer);
    return () => {
      leaveTimer = window.setTimeout(() => setSummary(null), 0);
    };
  }, []);
}

/* ------------------------------------------------------------------ device features */

/** Smooth scrolling unless the reader asked for reduced motion (the site's `html { scroll-behavior: smooth }` does not ask). */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

/**
 * Bring a row fully into view between the sticky site header and the sticky session bar (scrollIntoView's "nearest"
 * counts a row behind the bottom bar as visible). A row taller than the gap keeps its top in view.
 */
export function revealRow(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const header = document.querySelector(".site-header");
  const bar = document.querySelector(".trk-bar");
  const top = (header ? Math.max(0, header.getBoundingClientRect().bottom) : 0) + 12;
  const bottom = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 12;
  let dy = r.bottom > bottom ? r.bottom - bottom : 0;
  if (r.top - dy < top) dy = r.top - top;
  if (Math.abs(dy) >= 4) window.scrollBy({ top: dy, behavior: scrollBehavior() });
}

/** Keep the screen on while `active` (re-requested when the tab becomes visible again; silently unsupported). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const request = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) void next.release().catch(() => {});
        else lock = next;
      } catch {
        // denied (battery saver, iframe) or unsupported
      }
    };
    void request();
    const onVisible = () => void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}

/** A short vibration where the browser supports it (Android); nothing on iOS. */
export function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // not allowed without a user gesture, or unsupported
  }
}

/* ------------------------------------------------------------------ store guards, program, close-outs */

/** Errors that leave the snapshot complete (refused uploads, local storage); anything else may mean a partial pull. */
const HARMLESS_ERRORS = /^(rejected|invalid|storage|permission):/;

/**
 * True when the snapshot is complete enough to write derived rows (a new program, close-out states): always in local
 * mode; in synced mode after a clean pull (syncedAt set, not syncing, no pull error) so a half-pulled snapshot never
 * overwrites real rows.
 */
export function useSettled(): boolean {
  const { mode, canWrite, snapshot } = useFitness();
  const status = useStoreStatus();
  if (!canWrite) return false;
  if (mode === "local") return true;
  return mode === "synced" && Boolean(snapshot.syncedAt) && !status?.syncing && !(status?.lastError && !HARMLESS_ERRORS.test(status.lastError));
}

/** The program to train; the owner template is saved on the first visit once the store is settled. */
export function useProgram(now: number | null): { program: Program; created: boolean } {
  const { snapshot, store } = useFitness();
  const settled = useSettled();
  const { programs, activeProgramId, settings } = snapshot;
  // only the program rows and the settings matter (not every logged set)
  const result = useMemo(
    () => ensureProgram({ ...EMPTY_SNAPSHOT, programs, activeProgramId, settings }, now ?? undefined),
    [programs, activeProgramId, settings, now],
  );
  useEffect(() => {
    if (result.created && settled) store.upsert("programs", result.program);
  }, [result, settled, store]);
  return result;
}

/** Apply the progression of sessions the store closed after 6 h, and mark empty ones abandoned (writers only). */
export function useCloseOuts() {
  const { snapshot, store } = useFitness();
  const settled = useSettled();
  useEffect(() => {
    if (!settled) return;
    const r = closeOuts(snapshot, Date.now());
    for (const s of r.abandon) store.upsert("sessions", s);
    for (const a of r.apply) for (const st of a.changed) store.upsert("exercise_state", st);
  }, [settled, snapshot, store]);
}
