"use client";
/**
 * Keeps the gym pages usable with no signal on a phone that trains (master-owned, plans/fitness/12): when this device
 * has logged a workout, or the owner is signed in, it registers the site's service worker (public/sw.js) and, at most
 * every 12 hours, warms the "gym copy": the hub, the log, the program, gyms, calculators, the exercise list and the
 * program's exercise pages in the current language, with the files they load (a few MB). Pages stay network-first,
 * so the copy only answers when the network does not. Visitors download nothing extra. Renders nothing.
 */
import { useEffect } from "react";
import type { Lang } from "@/lib/fitness/types";
import { localPath } from "@/lib/i18n";
import { OWNER_TEMPLATE } from "@/lib/fitness/catalog.mjs";
import { useFitness } from "./Provider";

const WARM_KEY = "ilyadays-fitness-warm";
const EVERY_MS = 12 * 60 * 60 * 1000;
const CORE = ["/fitness", "/fitness/train", "/fitness/program", "/fitness/gyms", "/fitness/tools", "/fitness/exercises"];

/** The gym pages to keep, in this language: the core pages and every exercise page of the active program. */
export function gymPages(lang: Lang, exerciseIds: string[]): string[] {
  return [...CORE, ...exerciseIds.map((id) => `/fitness/exercises/${id}`)].map((p) => localPath(lang, p));
}

function readStamp(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeStamp(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // private window or full storage: warm again next time
  }
}

async function warm(pages: string[]): Promise<boolean> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) return false;
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(false), 5 * 60 * 1000);
    channel.port1.onmessage = (event: MessageEvent<{ type?: string; failed?: number }>) => {
      if (event.data?.type !== "done") return;
      window.clearTimeout(timer);
      resolve((event.data.failed ?? 0) < 5);
    };
    worker.postMessage({ type: "warm", pages }, [channel.port2]);
  });
}

export function GymOffline({ lang }: { lang: Lang }) {
  const { mode, snapshot } = useFitness();
  const trains = mode === "synced" || (mode === "local" && Object.keys(snapshot.sessions).length > 0);
  const program = snapshot.activeProgramId ? snapshot.programs[snapshot.activeProgramId] ?? null : null;
  const ids = program
    ? program.days.flatMap((d) => d.slots.map((s) => s.exerciseId))
    : OWNER_TEMPLATE.days.flatMap((d: { slots: string[][] }) => d.slots.map((slot) => slot[1]));
  const idsKey = [...new Set(ids)].join(",");

  useEffect(() => {
    // Production only: under `next dev` chunk URLs keep their names while the code changes, so a worker would serve stale code.
    if (process.env.NODE_ENV !== "production") return;
    if (!trains || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const key = `${WARM_KEY}:${lang}`;
    if (!navigator.onLine || Date.now() - readStamp(key) < EVERY_MS) {
      // Already warm (or no signal now): just make sure the worker is in place for the next page load.
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      return;
    }
    let cancelled = false;
    warm(gymPages(lang, idsKey ? idsKey.split(",") : []))
      .then((ok) => {
        if (ok && !cancelled) writeStamp(key, Date.now());
      })
      .catch(() => undefined); // no service worker here (private window, old browser): the open page still logs
    return () => {
      cancelled = true;
    };
  }, [trains, lang, idsKey]);

  return null;
}
