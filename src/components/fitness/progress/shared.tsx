"use client";
/** Small building blocks of the progress page (stream 06): sections, stat tiles, empty states, clock and targets. */
import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Lang } from "@/lib/fitness/types";
import { pick, t2 } from "@/lib/fitness/i18n";
import { humanize } from "./names";
import type { ProgressCatalog, ProgressGroup } from "./types";

export function Section({ id, title, lede, children }: { id: string; title: string; lede?: ReactNode; children?: ReactNode }) {
  return (
    <section id={id} className="fit-card fitp-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {lede ? <p className="fitp-lede">{lede}</p> : null}
      {children}
    </section>
  );
}

/** Honest empty state: what is missing and when the chart appears. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="fitp-empty">{children}</p>;
}

/** Stat tile: label · value (proportional figures) · optional sub-line and sparkline. */
export function Stat({ label, value, sub, children }: { label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="fitp-stat">
      <span className="fitp-stat-label">{label}</span>
      <span className="fitp-stat-value">{value}</span>
      {sub ? <span className="fitp-stat-sub">{sub}</span> : null}
      {children}
    </div>
  );
}

export function Caveat({ children }: { children: ReactNode }) {
  return <p className="fitp-caveat">{children}</p>;
}

/* ------------------------------------------------------------------ clock */

const subscribeMinute = (onChange: () => void) => {
  const id = window.setInterval(onChange, 60_000);
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
};
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverNow = () => null;

/** Current time at minute resolution; null during the server render and hydration (no impure calls in render). */
export const useNow = (): number | null => useSyncExternalStore(subscribeMinute, minuteNow, serverNow);

/* ------------------------------------------------------------------ per-viewer targets (localStorage) */

export const TARGETS_KEY = "ilyadays-fitness:targets";
const TARGETS_EVENT = "ilyadays-fitness:targets-change";
export type Targets = { targetWeightKg?: number };

let memoryTargets: string | null = null;

function readTargets(): string | null {
  try {
    return window.localStorage.getItem(TARGETS_KEY) ?? memoryTargets;
  } catch {
    return memoryTargets;
  }
}

function subscribeTargets(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(TARGETS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(TARGETS_EVENT, onChange);
  };
}

function parseTargets(raw: string | null): Targets {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as Targets;
    return v && typeof v === "object" && typeof v.targetWeightKg === "number" && v.targetWeightKg > 20 && v.targetWeightKg < 400 ? { targetWeightKg: v.targetWeightKg } : {};
  } catch {
    return {};
  }
}

/** Targets kept in this browser only (a viewer convenience, not training data). */
export function useTargets(): [Targets, (next: Targets) => void] {
  const raw = useSyncExternalStore(subscribeTargets, readTargets, () => null);
  const targets = useMemo(() => parseTargets(raw), [raw]);
  const save = useCallback((next: Targets) => {
    const value = JSON.stringify(next);
    memoryTargets = value;
    try {
      window.localStorage.setItem(TARGETS_KEY, value);
    } catch {
      // private mode / blocked storage: the in-memory copy keeps it for this tab
    }
    window.dispatchEvent(new Event(TARGETS_EVENT));
  }, []);
  return [targets, save];
}

/* ------------------------------------------------------------------ names and ids */

export const exerciseName = (catalog: ProgressCatalog, id: string, lang: Lang) => t2(lang, catalog[id]?.name, humanize(id));

export function groupName(groups: ProgressGroup[], id: string, lang: Lang): string {
  if (id === "other") return pick(lang, "Other", "Другое");
  return t2(lang, groups.find((g) => g.id === id)?.name, humanize(id));
}

/** Client-generated UUID (the store uploads only UUID ids); RFC 4122 v4 fallback for non-secure contexts. */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
