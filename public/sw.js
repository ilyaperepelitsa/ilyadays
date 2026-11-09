/* Stores the site on the phone after "Save on this phone", then serves it with no connection. On a phone that trains,
   the fitness pages also work without that save: they are kept as they are used and warmed once in a while
   (src/components/fitness/GymOffline.tsx). */
importScripts("/offline-assets.js");

const PREFIX = "ilyadays-";
/** The gym copy: fitness pages and the files they load, kept without "Save on this phone". Not a PREFIX cache. */
const RUNTIME = "gym-runtime-v1";
const FITNESS_PAGE = /^\/(?:ru\/)?fitness(?:\/|$)/;
let activeName = "";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "save") event.waitUntil(saveSite(event.data, event.ports[0]));
  else if (event.data?.type === "warm") event.waitUntil(warmGym(event.data, event.ports[0]));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_vercel/")) return; // analytics: never cached or answered here
  event.respondWith(serve(event));
});

/** How long a page may take on a weak connection before the saved copy is shown instead. */
const PAGE_WAIT_MS = 3500;

/** Files whose URL changes when they change (`?v=`, hashed Next chunks), or that the save stores as they are. */
function isAsset(pathname) {
  return /^\/(?:_next\/static|media|icons|covers|apps)\//.test(pathname);
}

/**
 * Only after "Save on this phone": pages come from the network when it answers in time and the saved copy otherwise;
 * files come from the saved copy first. Without a saved copy the worker stays out of the way.
 * @param {FetchEvent} event
 */
async function serve(event) {
  const request = event.request;
  const cache = await openActive();
  if (!cache) return gym(event);
  const url = new URL(request.url);
  if (request.mode === "navigate") return page(event, cache, url);

  const asset = isAsset(url.pathname);
  if (asset) {
    // Exact URL first: a versioned file is only ever this version.
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  try {
    const fresh = await fetch(request);
    if (fresh.ok && asset) event.waitUntil(cache.put(request, fresh.clone()));
    return fresh;
  } catch (error) {
    // No connection: any saved version of the file beats a broken picture.
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw error;
  }
}

/**
 * @param {FetchEvent} event
 * @param {Cache} cache
 * @param {URL} url
 */
async function page(event, cache, url) {
  const saved = await cache.match(url.pathname, { ignoreSearch: true });
  const network = fetch(event.request).then((fresh) => {
    if (fresh.ok) event.waitUntil(cache.put(url.pathname, fresh.clone()));
    return fresh;
  });
  if (!saved) {
    return network.catch(() => new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } }));
  }
  // Keep refreshing the saved page in the background even when the saved copy answers first.
  event.waitUntil(network.catch(() => undefined));
  const timer = new Promise((resolve) => setTimeout(() => resolve(null), PAGE_WAIT_MS));
  const fresh = await Promise.race([network.catch(() => null), timer]);
  return fresh || saved;
}

/**
 * Without "Save on this phone": fitness pages come from the network when it answers in time and from the gym copy
 * otherwise, and the files fitness pages load are kept (exact versioned URL first). Everything else goes to the
 * network exactly as without a worker.
 * @param {FetchEvent} event
 */
async function gym(event) {
  const request = event.request;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    if (!FITNESS_PAGE.test(url.pathname)) return fetch(request);
    return page(event, await caches.open(RUNTIME), url);
  }
  if (!isAsset(url.pathname)) return fetch(request);
  const client = event.clientId ? await self.clients.get(event.clientId) : null;
  const fromGym = Boolean(client && FITNESS_PAGE.test(new URL(client.url).pathname));
  const cache = await caches.open(RUNTIME);
  // Hashed chunks and `?v=` media never change under one URL: the kept copy answers first. Unversioned files
  // (icons, covers) go to the network first so they never go stale; the kept copy is only the no-signal fallback.
  if (url.pathname.startsWith("/_next/static/") || url.searchParams.has("v")) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fromGym) event.waitUntil(cache.put(request, fresh.clone()));
    return fresh;
  } catch (error) {
    const any = await cache.match(request, { ignoreSearch: true });
    if (any) return any;
    throw error;
  }
}

/**
 * Fetch the gym pages the phone asked for (only fitness pages) and every file they reference into the gym copy.
 * @param {{ pages?: unknown[] }} data
 * @param {MessagePort | undefined} port
 */
async function warmGym(data, port) {
  const cache = await caches.open(RUNTIME);
  const list = Array.isArray(data.pages) ? data.pages : [];
  const pages = new Set(list.filter((p) => typeof p === "string" && FITNESS_PAGE.test(p)).slice(0, 80));
  const queue = [...pages];
  const seen = new Set(queue);
  const stats = { done: 0, bytes: 0, failed: 0 };
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
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, Math.max(queue.length, 1)) }, () => worker()));
  port?.postMessage({ type: "done", ...stats, total: queue.length });
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
