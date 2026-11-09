/**
 * Calculator inputs (stream 09 — plans/fitness/09-nutrition.md). Each field merges two sources by time, last writer
 * wins: the fitness profile (settings at `settings.updatedAt`, the latest weigh-in at its `at`) and what was typed in
 * this browser (localStorage, a per-viewer convenience, never shared). Nothing typed here leaves the browser until the
 * owner presses "Save to my profile". Values stay strings so a half-typed "80," is not lost; parse with `toNum`.
 * The pure parts (parsing, profile values, the merge) live in inputs-core.mjs.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Snapshot } from "@/lib/fitness/types";
import { parseStamps, pickValue, profileStamps, stampEdits, type Field, type Value } from "./inputs-core.mjs";

export { toNum, type Field, type Value } from "./inputs-core.mjs";

const KEY = "ilyadays-fitness:nutrition";
const EVENT = "ilyadays-fitness:nutrition";

/** Last raw value in this tab: keeps the calculator working when storage is blocked (private mode, previews). */
let memory: string | null | undefined;

function readRaw(): string | null {
  if (memory !== undefined) return memory;
  try {
    memory = localStorage.getItem(KEY);
  } catch {
    memory = null;
  }
  return memory;
}

function writeRaw(raw: string) {
  memory = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // storage full or blocked: the in-memory copy still drives this tab
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    memory = e.newValue;
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const serverRaw = () => null;
const noSubscribe = () => () => {};
const thisYear = () => new Date().getFullYear();
const noYear = () => 0;
const thisDay = () => new Date().toISOString().slice(0, 10);
const noDay = () => "";

/** Today as "YYYY-MM-DD" in the browser ("" during the server render), for dates such as "around 14 Feb". */
export const useToday = () => useSyncExternalStore(noSubscribe, thisDay, noDay);

/**
 * The merged calculator inputs. `get(field, fallback)` returns the newest of this browser's edit and the profile
 * value, else the fallback; `set({ field: "text" })` records edits (stamped now) for every subscriber on the page.
 */
export function useNutritionInputs(snapshot: Snapshot) {
  const raw = useSyncExternalStore(subscribe, readRaw, serverRaw);
  const year = useSyncExternalStore(noSubscribe, thisYear, noYear);
  const edits = useMemo(() => parseStamps(raw), [raw]);
  const profile = useMemo(() => profileStamps(snapshot, year), [snapshot, year]);

  const get = useCallback((field: Field, fallback: string): Value => pickValue(field, edits, profile, fallback), [edits, profile]);

  const set = useCallback((patch: Partial<Record<Field, string>>) => {
    writeRaw(JSON.stringify(stampEdits(parseStamps(readRaw()), patch, new Date().toISOString())));
  }, []);

  return { get, set, profile, year };
}
