"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type Lang, strings } from "@/lib/i18n";
import { formatBytes, savedTripUrls } from "@/lib/offline/catalog.mjs";
import { listTrips } from "@/lib/trips/store.mjs";
import { ActionIcon } from "./ActionIcon";

const SAVED = "ilyadays-offline";

type Catalog = { id: string; bytes: number; pages: string[]; files: string[] };
type Progress = { done: number; total: number };

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function rememberLang(): Lang {
  return document.documentElement.lang === "ru" ? "ru" : "en";
}

/** Which copy this browser saved last, or "". A private window can refuse storage. */
function readSavedId() {
  try {
    return localStorage.getItem(SAVED) || "";
  } catch {
    return "";
  }
}

const subscribeNothing = () => () => {};
/** Fitness pages describe what the save adds for training (the gym pages already work offline on a training phone). */
const onFitness = () => /^\/(?:ru\/)?fitness(?:\/|$)/.test(location.pathname);
const canSave = () => "serviceWorker" in navigator;

/** Ask the service worker to store every page and picture, then remember which copy. */
async function runSave(catalog: Catalog, onProgress: (progress: Progress) => void) {
  await navigator.storage?.persist?.();
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) throw new Error("The offline worker did not start.");
  const ids = listTrips().map((trip) => trip.id);
  const pages = [...catalog.pages, ...savedTripUrls(ids)];
  const files = [...catalog.files, "/offline-catalog.json"];
  const result = await new Promise<{ id: string; failed: number }>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error("timed out")), 15 * 60 * 1000);
    channel.port1.onmessage = (event: MessageEvent<{ type: string; done: number; total: number; id: string; failed: number }>) => {
      if (event.data.type === "progress") onProgress(event.data);
      if (event.data.type === "done") {
        window.clearTimeout(timer);
        resolve(event.data);
      }
    };
    worker.postMessage({ type: "save", id: catalog.id, pages, files }, [channel.port2]);
  });
  if (result.failed > 12) throw new Error("too many misses");
  localStorage.setItem(SAVED, result.id);
}

let clicksInstalled = false;

function installOfflineClicks() {
  if (clicksInstalled) return;
  clicksInstalled = true;
  document.addEventListener("click", (event) => {
    if (navigator.onLine || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a") : null;
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    event.stopPropagation();
    location.assign(url.href);
  }, true);
}

export function OfflineSave() {
  // Browser-only facts: the static HTML renders nothing here, and the client fills them in after hydration.
  const lang = useSyncExternalStore(subscribeNothing, rememberLang, (): Lang => "en");
  const ready = useSyncExternalStore(subscribeNothing, canSave, () => false);
  const storedId = useSyncExternalStore(subscribeNothing, readSavedId, () => "");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [justSaved, setJustSaved] = useState("");
  const savedId = justSaved || storedId;
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failed, setFailed] = useState(false);
  const spot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    installOfflineClicks();
  }, []);

  // The list of files is only needed for this footer button, so it is fetched when the footer comes near the screen,
  // not on every page view.
  useEffect(() => {
    const el = spot.current;
    if (!ready || !el) return;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      fetch("/offline-catalog.json")
        .then((response) => response.json())
        .then((body: Catalog) => setCatalog(body))
        .catch(() => setCatalog(null));
    };
    if (!("IntersectionObserver" in window)) {
      load();
      return;
    }
    const watcher = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      watcher.disconnect();
      load();
    }, { rootMargin: "600px 0px" });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [ready]);

  if (!ready) return null;
  if (!catalog) return <div ref={spot} className="offline-save-spot" aria-hidden="true" />;
  const list = catalog;
  const t = strings(lang);
  const saved = savedId === list.id;
  const label = progress
    ? fill(t.offlineSaving, { done: String(progress.done), total: String(progress.total) })
    : saved
      ? t.offlineSaved
      : savedId
        ? t.offlineUpdate
        : t.offlineSave;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  async function onSave() {
    setFailed(false);
    setProgress({ done: 0, total: list.pages.length + list.files.length });
    try {
      await runSave(list, setProgress);
      setJustSaved(list.id);
    } catch {
      setFailed(true);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="offline-save">
      <div className="offline-actions"><button type="button" onClick={onSave} disabled={progress !== null}><ActionIcon name={saved ? "check" : "download"} />{label}</button><span className="offline-size">{formatBytes(list.bytes)}</span></div>
      {progress ? <span className="offline-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span> : null}
      {failed ? <p role="alert">{t.offlineFail}</p> : null}
      <details className="offline-help"><summary>{lang === "ru" ? "Как пользоваться без сети" : "How offline works"}</summary>
        <p>{fill(onFitness() ? t.offlineHintFitness : t.offlineHint, { size: formatBytes(list.bytes) })}</p>
        <p>{t.offlineIphone}</p>
      </details>
    </div>
  );
}
