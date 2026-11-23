/** The list of URLs a phone stores so the site opens with no connection. */

const FIXED = ["/", "/food", "/food/sous-vide", "/travel", "/travel/turkey-yacht-food", "/travel/istanbul", "/travel/new", "/fitness", "/fitness/train", "/fitness/program", "/fitness/profile", "/fitness/exercises", "/fitness/gyms", "/fitness/progress", "/fitness/science", "/fitness/nutrition", "/fitness/tools"];

/**
 * @param {string[]} parts
 * @returns {string}
 */
function rev(parts) {
  let hash = 5381;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) hash = ((hash << 5) + hash) ^ part.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * @param {string} rel path under public/
 * @returns {boolean}
 */
export function skipPublicFile(rel) {
  return rel.startsWith("food/") || rel === "offline-catalog.json" || rel === "offline-assets.js" || rel.endsWith(".DS_Store") || rel.includes("/.DS_Store");
}

/**
 * Pages in both languages, plus the files the site actually serves.
 * Legacy `public/food` copies are excluded if present during migration.
 * A file the pages ask for as `?v=<hash>` is listed under that exact URL, so the saved copy is the one they request.
 *
 * @param {string[]} slugs recipe slugs
 * @param {{ rel: string, bytes: number }[]} files
 * @param {Map<string, string>} [versions] path under public/ → its `?v=`
 * @param {string[]} [extra] more English page paths (fitness exercises and science topics); Russian copies are added
 * @returns {{ id: string, bytes: number, pages: string[], files: string[] }}
 */
export function buildCatalog(slugs, files, versions = new Map(), extra = []) {
  const en = [...FIXED, ...slugs.map((slug) => `/food/${slug}`), ...extra.filter((path) => /^\/[a-z0-9/-]+$/.test(path) && !FIXED.includes(path))];
  const pages = [...en, ...en.map((path) => (path === "/" ? "/ru" : `/ru${path}`))];
  const kept = files.filter((file) => !skipPublicFile(file.rel));
  const urls = kept.map((file) => (versions.has(file.rel) ? `/${file.rel}?v=${versions.get(file.rel)}` : `/${file.rel}`));
  const bytes = kept.reduce((sum, file) => sum + file.bytes, 0);
  const id = rev([...pages, ...urls, ...kept.map((file) => `${file.rel}:${file.bytes}`)]);
  return { id, bytes, pages, files: urls };
}

/**
 * Saved trips live only in this browser, so their pages are added at save time.
 *
 * @param {string[]} ids
 * @returns {string[]}
 */
export function savedTripUrls(ids) {
  return ids
    .filter((id) => /^[A-Za-z0-9_-]{1,80}$/.test(id))
    .flatMap((id) => [`/travel/made/${id}`, `/ru/travel/made/${id}`]);
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  const mb = bytes / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/**
 * Fitness pages a phone should keep for a gym with no signal: every exercise (alternatives included) and every
 * science topic that has an English file.
 *
 * @param {string[]} exerciseIds
 * @param {string[]} topics
 * @returns {string[]}
 */
export function fitnessPages(exerciseIds, topics) {
  const ok = (/** @type {string} */ id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
  return [...exerciseIds.filter(ok).map((id) => `/fitness/exercises/${id}`), ...topics.filter(ok).map((slug) => `/fitness/science/${slug}`)];
}
