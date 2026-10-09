/* Stores the site on the phone after "Save on this phone", then serves it with no connection. */
importScripts("/offline-assets.js");

const PREFIX = "ilyadays-";
let activeName = "";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "save") return;
  event.waitUntil(saveSite(event.data, event.ports[0]));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(serve(event.request));
});

/**
 * @param {Request} request
 */
async function serve(request) {
  const cache = await openActive();
  if (!cache) return fetch(request);
  const url = new URL(request.url);
  const navigation = request.mode === "navigate";
  const immutable = url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/icons/");
  if (!navigation && immutable) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  try {
    const fresh = await fetch(request);
    if (fresh.ok && (navigation || immutable)) cache.put(navigation ? url.pathname : request, fresh.clone());
    return fresh;
  } catch (error) {
    const hit = await cache.match(navigation ? url.pathname : request, navigation ? { ignoreSearch: true } : undefined);
    if (hit) return hit;
    if (navigation) return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    throw error;
  }
}

async function openActive() {
  if (activeName) return caches.open(activeName);
  const keys = await caches.keys();
  activeName = keys.find((key) => key.startsWith(PREFIX)) || "";
  return activeName ? caches.open(activeName) : null;
}

/**
 * @param {string} url
 * @param {Set<string>} pages
 */
function shouldRead(url, pages) {
  return pages.has(url) || /\.(css|js|mjs)$/.test(url);
}

/**
 * @param {{ id: string, pages: string[], files: string[] }} data
 * @param {MessagePort | undefined} port
 */
async function saveSite(data, port) {
  const name = PREFIX + data.id;
  const cache = await caches.open(name);
  const pages = new Set(data.pages);
  const queue = [...data.pages, ...data.files];
  const seen = new Set(queue);
  const stats = { done: 0, bytes: 0, failed: 0 };
  const report = () => port?.postMessage({ type: "progress", ...stats, total: queue.length });
  let cursor = 0;
  let inflight = 0;

  async function worker() {
    for (;;) {
      if (cursor >= queue.length) {
        if (inflight === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 8));
        continue;
      }
      const url = queue[cursor];
      cursor += 1;
      inflight += 1;
      await storeOne(cache, url, shouldRead(url, pages), seen, queue, stats);
      inflight -= 1;
      if (stats.done % 20 === 0) report();
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, Math.max(queue.length, 1)) }, () => worker()));
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== name).map((key) => caches.delete(key)));
  activeName = name;
  port?.postMessage({ type: "done", ...stats, total: queue.length, id: data.id });
}

/**
 * @param {Cache} cache
 * @param {string} url
 * @param {boolean} readBody
 * @param {Set<string>} seen
 * @param {string[]} queue
 * @param {{ done: number, bytes: number, failed: number }} stats
 */
async function storeOne(cache, url, readBody, seen, queue, stats) {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(String(response.status));
    const copy = response.clone();
    if (readBody) {
      for (const asset of self.extractAssetUrls(await response.text())) {
        if (seen.has(asset)) continue;
        seen.add(asset);
        queue.push(asset);
      }
    } else {
      await response.body?.cancel();
    }
    await cache.put(url, copy);
    stats.bytes += Number(copy.headers.get("content-length")) || 0;
  } catch {
    stats.failed += 1;
  }
  stats.done += 1;
}
