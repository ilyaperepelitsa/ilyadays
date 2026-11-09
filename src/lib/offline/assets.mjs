/** Pull same-origin picture, script, and stylesheet URLs out of a page or a CSS file. */

const ATTR = /\b(?:src|href)=["']([^"']+)["']/gi;
const SRCSET = /\bsrcset=["']([^"']+)["']/gi;
const CSS_URL = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g;
const NEXT_CHUNK = /\/_next\/static\/[A-Za-z0-9_./-]+/g;

/**
 * The `?v=` cache-buster of a reference, kept so a saved file sits under the URL pages ask for.
 *
 * @param {string} query
 * @returns {string}
 */
function versionOf(query) {
  const v = new URLSearchParams(query).get("v");
  return v && /^[0-9a-f]{6,40}$/.test(v) ? `?v=${v}` : "";
}

/**
 * A site path (with its `?v=`, if any), or "" when the reference points off this site.
 *
 * @param {string} raw
 * @returns {string}
 */
export function sameOriginPath(raw) {
  if (!raw || raw.startsWith("#") || raw.startsWith("data:") || raw.startsWith("blob:") || raw.startsWith("//")) return "";
  if (/^https?:/i.test(raw)) {
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, "");
      if (host !== "ilyadays.com" && host !== "localhost") return "";
      return url.pathname + versionOf(url.search);
    } catch {
      return "";
    }
  }
  const [path, query = ""] = raw.split("#")[0].split("?");
  if (!path.startsWith("/") || path.includes("..")) return "";
  return path + versionOf(query);
}

/**
 * @param {string} text HTML or CSS
 * @returns {string[]}
 */
export function extractAssetUrls(text) {
  const found = new Set();
  const take = (raw) => {
    const path = sameOriginPath(raw.trim());
    if (path) found.add(path);
  };
  for (const match of text.matchAll(ATTR)) take(match[1]);
  for (const match of text.matchAll(SRCSET)) {
    for (const part of match[1].split(",")) take(part.trim().split(/\s+/)[0]);
  }
  for (const match of text.matchAll(CSS_URL)) take(match[1]);
  for (const match of text.matchAll(NEXT_CHUNK)) take(match[0]);
  return [...found];
}
