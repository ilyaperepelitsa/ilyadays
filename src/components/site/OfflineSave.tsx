"use client";

import { useEffect, useState } from "react";
import { type Lang, strings } from "@/lib/i18n";
import { formatBytes, savedTripUrls } from "@/lib/offline/catalog.mjs";
import { listTrips } from "@/lib/trips/store.mjs";

const SAVED = "ilyadays-offline";

type Catalog = { id: string; bytes: number; pages: string[]; files: string[] };
type Progress = { done: number; total: number };

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function rememberLang(): Lang {
  return document.documentElement.lang === "ru" ? "ru" : "en";
}

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
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [savedId, setSavedId] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLang(rememberLang());
    setReady("serviceWorker" in navigator);
    setSavedId(localStorage.getItem(SAVED) || "");
    installOfflineClicks();
    fetch("/offline-catalog.json")
      .then((response) => response.json())
      .then((body: Catalog) => setCatalog(body))
      .catch(() => setCatalog(null));
  }, []);

  if (!ready || !catalog) return null;
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
      setSavedId(list.id);
    } catch {
      setFailed(true);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="offline-save">
      <button type="button" onClick={onSave} disabled={progress !== null}>{label}</button>
      {progress ? <span className="offline-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span> : null}
      <p>{failed ? t.offlineFail : fill(t.offlineHint, { size: formatBytes(list.bytes) })}</p>
      <p>{t.offlineIphone}</p>
    </div>
  );
}
