/** The list of URLs a phone stores so the site opens with no connection. */

const FIXED = ["/", "/food", "/food/sous-vide", "/travel", "/travel/istanbul", "/travel/new"];

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
 * `public/food` is a local duplicate and is left out.
 *
 * @param {string[]} slugs recipe slugs
 * @param {{ rel: string, bytes: number }[]} files
 * @returns {{ id: string, bytes: number, pages: string[], files: string[] }}
 */
export function buildCatalog(slugs, files) {
  const en = [...FIXED, ...slugs.map((slug) => `/food/${slug}`)];
  const pages = [...en, ...en.map((path) => (path === "/" ? "/ru" : `/ru${path}`))];
  const kept = files.filter((file) => !skipPublicFile(file.rel));
  const urls = kept.map((file) => `/${file.rel}`);
  const bytes = kept.reduce((sum, file) => sum + file.bytes, 0);
  const id = rev([...pages, ...kept.map((file) => `${file.rel}:${file.bytes}`)]);
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
