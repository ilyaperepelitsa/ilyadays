/** Wikipedia articles and Commons pictures. The model names a search; it does not supply URLs. */

const FREE = /public domain|cc0|cc by|cc-by|\bfal\b|free art/i;

/** Wikimedia serves thumbnails only at standard widths (others are rounded up, or refused when hotlinked).
 *  The main photo is at most ~420 CSS px and a fact thumbnail 96 px, so these keep phones off 960 px files. */
export const PHOTO_WIDTH = 500;
export const SPOT_WIDTH = 250;

/**
 * A Commons thumbnail at a smaller standard width. URLs that are not thumbnails, or already small enough, stay.
 * @param {string} url
 * @param {number} width
 */
export function commonsWidth(url, width) {
  const match = /^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)(\d+)px-([^/?]+)$/.exec(String(url || ""));
  if (!match || Number(match[2]) <= width) return url;
  return `${match[1]}${width}px-${match[3]}`;
}

/**
 * @param {string} license
 */
export function isFreeLicense(license) {
  const text = String(license || "").toLowerCase();
  if (/by-nc|non-?commercial/.test(text)) return false;
  return FREE.test(text);
}

/**
 * @param {string} raw
 */
export function shortAuthor(raw) {
  let text = String(raw || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/\s*derivative work:.*$/i, "");
  text = text.replace(/^(?:file:)?[^:]+\.(?:jpe?g|png|webp)\s*:\s*/i, "");
  text = text.replace(/^(?:User:|Photograph:\s*|Photo:\s*)/i, "");
  const name = (text.split(" This ")[0] || "").trim();
  return name || "Unknown author";
}

/**
 * @param {number} a1
 * @param {number} o1
 * @param {number} a2
 * @param {number} o2
 */
function km(a1, o1, a2, o2) {
  const r = Math.PI / 180;
  const x = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

/**
 * @param {string} base
 * @param {Record<string, string>} params
 */
function api(base, params) {
  const q = new URLSearchParams({ ...params, format: "json", formatversion: "2", origin: "*" });
  return `${base}?${q}`;
}

/**
 * @param {string} url
 */
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {Record<string, unknown>} meta
 * @param {string} key
 */
function metaValue(meta, key) {
  const row = meta[key];
  const value = row && typeof row === "object" ? /** @type {{ value?: string }} */ (row).value : "";
  return shortAuthor(String(value || ""));
}

/**
 * @param {string} title
 * @param {number} [width]
 */
async function imageOf(title, width = PHOTO_WIDTH) {
  const data = await getJson(api("https://commons.wikimedia.org/w/api.php", {
    action: "query",
    titles: title.startsWith("File:") ? title : `File:${title}`,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: String(width),
  }));
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!info || String(info.mime || "").includes("svg")) return null;
  const meta = info.extmetadata || {};
  const license = String(meta.LicenseShortName?.value || "");
  if (!isFreeLicense(license)) return null;
  const thumb = String(info.thumburl || "").split("?")[0];
  const filePage = String(info.descriptionurl || "");
  if (!thumb.startsWith("https://") || !filePage.startsWith("https://commons.wikimedia.org/")) return null;
  return { thumb, page: filePage, author: metaValue(meta, "Artist"), license };
}

/**
 * @param {string} query
 */
async function commonsFile(query) {
  const data = await getJson(api("https://commons.wikimedia.org/w/api.php", {
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6",
    srlimit: "5",
  }));
  const hits = (data?.query?.search || [])
    .map((hit) => String(hit.title || ""))
    .filter((title) => /\.(jpe?g|png|webp)$/i.test(title) && !/logo/i.test(title));
  for (const title of hits.slice(0, 3)) {
    const image = await imageOf(title, SPOT_WIDTH);
    if (image) return image;
  }
  return null;
}

/** A named article this close to the model's point is the same place, and its coordinates are surveyed ones. */
const SNAP_KM = 1;

/**
 * @param {string} title
 * @param {string} fallback
 * @param {boolean} [named] false once the article came from a search instead of the title the model gave
 */
async function wikiPage(title, fallback, named = true) {
  const lookup = title || "";
  const data = await getJson(api("https://en.wikipedia.org/w/api.php", {
    action: "query",
    titles: lookup,
    redirects: "1",
    prop: "langlinks|pageimages|coordinates",
    lllang: "ru",
    piprop: "name",
    pilicense: "free",
  }));
  const page = data?.query?.pages?.[0];
  if (!lookup || page?.missing) {
    if (!fallback) return null;
    const found = await getJson(api("https://en.wikipedia.org/w/api.php", {
      action: "query",
      list: "search",
      srsearch: fallback,
      srlimit: "1",
    }));
    const hit = found?.query?.search?.[0]?.title;
    if (!hit) return null;
    return wikiPage(String(hit), "", false);
  }
  const ru = (page.langlinks || []).find((link) => link.lang === "ru");
  const article = page.title || lookup;
  return {
    en: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, "_"))}`,
    ru: ru ? `https://ru.wikipedia.org/wiki/${encodeURIComponent(String(ru.title).replace(/ /g, "_"))}` : "",
    image: page.pageimage ? String(page.pageimage) : "",
    lat: page.coordinates?.[0]?.lat,
    lon: page.coordinates?.[0]?.lon,
    named,
  };
}

/**
 * @param {import("./types").DraftStop} stop
 * @param {import("./types").PlaceFacts} facts
 * @param {string} city
 */
export async function enrichStop(stop, facts, city) {
  const notes = facts.notes.map((note) => ({ kind: note.kind, en: note.en, ru: note.ru }));
  const place = {
    ...stop,
    hours: facts.hours,
    access: facts.access,
    days: facts.days,
    wiki: { en: "" },
    notes,
  };
  try {
    const wiki = await wikiPage(facts.wikiTitle, `${stop.name} ${city}`);
    if (wiki?.en) place.wiki = { en: wiki.en, ...(wiki.ru ? { ru: wiki.ru } : {}) };
    const away = wiki && wiki.lat != null ? km(stop.lat, stop.lon, Number(wiki.lat), Number(wiki.lon)) : null;
    const near = wiki && (away == null || away <= 5);
    // Model coordinates drift by a street or two; map links and routes should land on the door, not near it.
    // Only for the article the model named for this sight: a search hit may be a neighbour with a similar name.
    if (wiki?.named && stop.kind === "sight" && away != null && away <= SNAP_KM) {
      place.lat = Number(wiki.lat);
      place.lon = Number(wiki.lon);
    }
    if (wiki?.image && near) place.photo = await imageOf(wiki.image) || undefined;
  } catch {
    /* A missing article leaves the facts without a picture. */
  }
  if (facts.spotSearch && stop.kind === "sight") {
    try {
      const query = facts.spotSearch.toLowerCase().includes(city.toLowerCase()) ? facts.spotSearch : `${facts.spotSearch} ${city}`;
      const shot = await commonsFile(query);
      const keeps = place.notes.find((note) => note.kind === "keeps");
      if (shot && keeps && shot.page !== place.photo?.page) keeps.image = shot;
    } catch {
      /* The sentence stays; the thumbnail is optional. */
    }
  }
  return place;
}
