import { useCallback, useEffect, useRef, useState } from 'react';
// Unsaved-draft safety net over localStorage. Every access is guarded: storage may be blocked or full.
const PREFIX = 'aurelius-draft:';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type StoredDraft<T> = { value: T; base: string; savedAt: number };

/** Namespaced key: aurelius-draft:<edition id>:<kind>:<revision id>. */
export function draftKey(editionId: string, kind: string, revisionId: string) {
  return `${PREFIX}${editionId}:${kind}:${revisionId}`;
}

export function saveDraft<T>(key: string, value: T, base = '') {
  try {
    const entry: StoredDraft<T> = { value, base, savedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* storage unavailable or full: the draft simply stays in memory */
  }
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredDraft<T>;
    if (!entry || typeof entry.savedAt !== 'number' || !('value' in entry) || Date.now() - entry.savedAt > MAX_AGE_MS) {
      clearDraft(key);
      return null;
    }
    return { value: entry.value, base: typeof entry.base === 'string' ? entry.base : '', savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const SAVE_DELAY_MS = 500;

/**
 * Debounced autosave plus restore-on-mount for one editable surface.
 * `key` should name the stable entity (not the revision); `base` is the revision the draft started from.
 * `value` must be referentially stable between edits (memoise it). A draft whose base differs from the
 * current revision is never applied: `stale` becomes true and the caller offers `discardStale`.
 */
export function useDraft<T>({ key, base, value, dirty, onRestore }: { key: string; base: string; value: T; dirty: boolean; onRestore: (value: T) => void }) {
  const [restored, setRestored] = useState(false);
  const [stale, setStale] = useState(false);
  const restoreRef = useRef(onRestore);
  const baseRef = useRef(base);
  useEffect(() => {
    restoreRef.current = onRestore;
    baseRef.current = base;
  });
  useEffect(() => {
    const entry = loadDraft<T>(key);
    if (!entry) return;
    if (entry.base === baseRef.current) {
      restoreRef.current(entry.value);
      setRestored(true);
    } else setStale(true);
  }, [key]);
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => saveDraft(key, value, base), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, key, base, value]);
  const clear = useCallback(() => {
    clearDraft(key);
    setRestored(false);
    setStale(false);
  }, [key]);
  return { restored, stale, clear };
}
