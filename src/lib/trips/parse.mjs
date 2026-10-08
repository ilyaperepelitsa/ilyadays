/** Turn model JSON into a trip outline. Counts and coordinates are checked here, not trusted. */

import { TripShapeError, slugId } from "./brief.mjs";

const KINDS = new Set(["build", "events", "literature", "film", "keeps"]);

/**
 * @param {unknown} value
 */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {Record<string, unknown>} raw
 */
export function completeTheme(raw) {
  const title = text(raw.title);
  const description = text(raw.description);
  if (!title || !description || title.length > 80 || description.length > 600) throw new TripShapeError("themes");
  return {
    title,
    description,
    titleRu: text(raw.titleRu) || title,
    descriptionRu: text(raw.descriptionRu) || description,
  };
}

/**
 * @param {unknown} raw
 * @param {number} count
 */
export function parseThemes(raw, count) {
  const themes = raw && typeof raw === "object" ? /** @type {{ themes?: unknown }} */ (raw).themes : null;
  if (!Array.isArray(themes) || themes.length !== count) throw new TripShapeError("themes");
  return themes.map((item) => completeTheme(item && typeof item === "object" ? /** @type {Record<string, unknown>} */ (item) : {}));
}

/**
 * A repeated id is the shared sub-route: keep the first copy instead of minting a new slug.
 * @param {Record<string, unknown>} row
 * @param {Set<string>} used
 * @param {Map<string, import("./types").DraftStop>} known
 */
function parseStop(row, used, known) {
  const given = text(row.id);
  if (given && known.has(given)) {
    const prior = known.get(given);
    const wish = text(row.wish).slice(0, 80);
    if (wish && prior && !prior.wish) prior.wish = wish;
    return { ...prior };
  }
  const name = text(row.name);
  const why = text(row.why);
  const whyRu = text(row.whyRu) || why;
  const kind = row.kind === "food" ? "food" : row.kind === "sight" ? "sight" : "";
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  const minutes = Number(row.minutes);
  if (!name || !why || !kind) throw new TripShapeError("stops");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new TripShapeError("coords");
  if (lat === 0 && lon === 0) throw new TripShapeError("coords");
  if (!Number.isInteger(minutes) || minutes < 10 || minutes > 180) throw new TripShapeError("minutes");
  const id = /^[a-z0-9-]{2,48}$/.test(given) && !used.has(given) ? given : slugId(name, used);
  if (!used.has(id)) used.add(id);
  const stop = { id, name, local: text(row.local), lat, lon, minutes, kind, why, whyRu, wish: text(row.wish).slice(0, 80) };
  known.set(id, stop);
  return stop;
}

/**
 * @param {import("./types").DraftStop[]} stops
 */
function samePoint(a, b) {
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lon - b.lon) < 0.0001;
}

/**
 * @param {import("./types").DraftStop[]} stops
 */
function sharesAPoint(stops) {
  for (let i = 0; i < stops.length; i += 1) {
    for (let j = i + 1; j < stops.length; j += 1) {
      if (samePoint(stops[i], stops[j])) return true;
    }
  }
  return false;
}

/**
 * @param {unknown} raw
 * @param {import("./types").TripBrief} brief
 */
export function parseOutline(raw, brief) {
  const row = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const routesRaw = row.routes;
  if (!Array.isArray(routesRaw) || routesRaw.length !== brief.routes) throw new TripShapeError("counts");
  const used = new Set();
  const known = new Map();
  const routes = routesRaw.map((route) => {
    const stopsRaw = route && typeof route === "object" ? /** @type {{ stops?: unknown }} */ (route).stops : null;
    if (!Array.isArray(stopsRaw)) throw new TripShapeError("counts");
    const stops = stopsRaw.map((stop) => parseStop(/** @type {Record<string, unknown>} */ (stop ?? {}), used, known));
    const sights = stops.filter((stop) => stop.kind === "sight").length;
    const foods = stops.filter((stop) => stop.kind === "food").length;
    if (sights !== brief.placesPerRoute || foods !== brief.foodBreaks) throw new TripShapeError("counts");
    if (sharesAPoint(stops)) throw new TripShapeError("coords");
    const spent = stops.reduce((sum, stop) => sum + stop.minutes, 0);
    if (spent > brief.hours * 60) throw new TripShapeError("length");
    return stops;
  });
  const spine = parseSpine(row.spine, routes, brief.sharedSpine);
  checkWishes(routes, Array.isArray(brief.wishes) ? brief.wishes : []);
  return { spine, routes };
}

/**
 * Each wish sits on one stop. A shared sub-route may carry that same stop onto another day.
 * @param {import("./types").DraftStop[][]} routes
 * @param {string[]} wishes
 */
function checkWishes(routes, wishes) {
  const wanted = new Map(wishes.map((wish) => [wish.trim().toLocaleLowerCase(), wish]));
  /** @type {Map<string, string>} */
  const placed = new Map();
  for (const route of routes) {
    for (const stop of route) {
      const key = (stop.wish || "").trim().toLocaleLowerCase();
      if (!key) continue;
      if (!wanted.has(key)) throw new TripShapeError("wishes");
      const prior = placed.get(key);
      if (prior && prior !== stop.id) throw new TripShapeError("wishes");
      placed.set(key, stop.id);
    }
  }
  if (placed.size !== wanted.size) throw new TripShapeError("wishes");
}

/**
 * @param {unknown} raw
 * @param {import("./types").DraftStop[][]} routes
 * @param {boolean} shared
 */
function parseSpine(raw, routes, shared) {
  const row = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const name = text(row.name);
  const counts = new Map();
  for (const route of routes) {
    for (const id of new Set(route.map((stop) => stop.id))) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const repeated = [...counts.values()].some((n) => n >= 2);
  if (shared && (!name || !repeated)) throw new TripShapeError("spine");
  if (!shared && (name || repeated)) throw new TripShapeError("spine");
  if (!shared) return null;
  return { name, why: text(row.why), whyRu: text(row.whyRu) || text(row.why) };
}

/**
 * @param {Record<string, unknown>} row
 */
function parseFact(row) {
  const kind = text(row.kind);
  const en = text(row.en);
  const ru = text(row.ru) || en;
  if (!KINDS.has(kind) || !en) return null;
  return { kind, en, ru };
}

/**
 * @param {unknown} raw
 * @param {import("./types").DraftStop[]} stops
 */
export function parseNotes(raw, stops) {
  const places = raw && typeof raw === "object" ? /** @type {{ places?: unknown }} */ (raw).places : null;
  if (!Array.isArray(places)) throw new TripShapeError("notes");
  /** @type {Map<string, import("./types").PlaceFacts>} */
  const byId = new Map();
  for (const item of places) {
    const row = item && typeof item === "object" ? /** @type {Record<string, unknown>} */ (item) : {};
    const id = text(row.id);
    const notesRaw = Array.isArray(row.notes) ? row.notes : [];
    const notes = notesRaw.map((note) => parseFact(/** @type {Record<string, unknown>} */ (note ?? {}))).filter((note) => note != null);
    const spotSearch = text(row.spotSearch).replace(/^https?:\/\/\S+\s*/i, "").slice(0, 120);
    byId.set(id, {
      access: { en: text(row.accessEn), ru: text(row.accessRu) || text(row.accessEn) },
      days: { en: text(row.daysEn), ru: text(row.daysRu) || text(row.daysEn) },
      hours: text(row.hours),
      wikiTitle: text(row.wikiTitle).slice(0, 160),
      spotSearch,
      notes,
    });
  }
  for (const stop of stops) {
    const facts = byId.get(stop.id);
    const need = stop.kind === "sight" ? 2 : 1;
    const hasKeeps = facts?.notes.some((note) => note.kind === "keeps");
    if (!facts || !facts.access.en || !facts.days.en || facts.notes.length < need) throw new TripShapeError("notes");
    if (stop.kind === "sight" && !hasKeeps) throw new TripShapeError("notes");
    if (stop.kind === "food") facts.spotSearch = "";
  }
  return byId;
}

/**
 * @param {{ lat: number, lon: number }[]} stops
 */
export function mapsUrl(stops) {
  if (stops.length === 0) return "";
  const at = (stop) => `${stop.lat},${stop.lon}`;
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${at(stops[0])}`;
  const via = stops.slice(1, -1).map(at).join("|");
  const tail = via ? `&waypoints=${encodeURIComponent(via)}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${at(stops[0])}&destination=${at(stops[stops.length - 1])}${tail}`;
}
