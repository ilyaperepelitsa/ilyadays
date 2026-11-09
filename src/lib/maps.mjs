/** Links that open a place or a walk in Google, Yandex or Apple Maps: the app when it is installed, the web map
 *  otherwise. No keys and nothing sent to this site.
 *
 *  A pin at a coordinate only says "somewhere here", so places are found by search: a named venue opens its place
 *  card, and a vague stop ("lunch in Cağaloğlu") is a category search ("esnaf lokantası Cağaloğlu") that lists
 *  the venues there. The point, when known, keeps that search in the right part of town. Routes use points. */

/**
 * @typedef {{ lat?: number, lon?: number, query?: string, name?: string, zoom?: number, googlePlaceId?: string }} MapPlace
 * `query` is what a person would type into the map's search box. `lat`/`lon` narrow that search (or become a pin when
 * there is no query); `zoom` says how wide: 17 is a few streets, 14 a small town. `name` labels a bare pin.
 * `googlePlaceId` (a checked "ChIJ…" id) opens that exact Google place card; Google uses `query` only if it fails.
 * @typedef {"google" | "yandex" | "apple"} MapService
 * @typedef {{ service: MapService, href: string, from?: number, to?: number }} MapLink
 * `from`/`to` (1-based stop numbers) mark one piece of a route that had to be split.
 */

/** Docs: https://developers.google.com/maps/documentation/urls/get-started — a phone browser keeps only three
 *  waypoints (nine elsewhere), so a longer walk becomes several Google links that share their end stops. */
export const GOOGLE_WAYPOINTS = 3;

/**
 * @param {{ lat?: number, lon?: number }} place
 */
function hasPoint(place) {
  const { lat, lon } = place;
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
}

/**
 * @param {number} value
 */
const fixed = (value) => Number(value).toFixed(6).replace(/\.?0+$/, "");

/** "lat,lon" — Google, Apple and Yandex routes. Yandex map parameters (ll, pt) are "lon,lat". */
const latLon = (/** @type {{ lat: number, lon: number }} */ p) => `${fixed(p.lat)},${fixed(p.lon)}`;
const lonLat = (/** @type {{ lat: number, lon: number }} */ p) => `${fixed(p.lon)},${fixed(p.lat)}`;

/**
 * Yandex keeps its interface in the reader's language when the host matches it.
 * @param {string} lang
 */
const yandexHost = (lang) => (lang === "ru" ? "https://yandex.ru/maps/" : "https://yandex.com/maps/");

/**
 * Apple's search area is a span in degrees; zoom 17 ≈ 0.01° (about a kilometre), each step out doubles it.
 * @param {number} zoom
 */
const appleSpan = (zoom) => {
  const span = fixed(Math.min(0.01 * 2 ** (17 - zoom), 2));
  return `${span},${span}`;
};

/**
 * Open one place. Docs: Google (above), Yandex https://yandex.com/dev/yandex-apps-launch-maps/doc/en/concepts/yandexmaps-web
 * (text needs ll and z), Apple https://developer.apple.com/documentation/mapkit/unified-map-urls.
 * @param {MapPlace} place
 * @param {string} [lang]
 * @returns {MapLink[]}
 */
export function placeLinks(place, lang = "en") {
  const point = hasPoint(place);
  const query = String(place.query || "").trim();
  if (!point && !query) return [];
  const zoom = Math.round(Math.min(Math.max(Number(place.zoom) || 17, 3), 19));
  const at = point ? { lat: Number(place.lat), lon: Number(place.lon) } : null;

  const google = new URLSearchParams({ api: "1", query: query || latLon(/** @type {any} */ (at)) });
  if (query && /^ChIJ[\w-]{20,}$/.test(String(place.googlePlaceId || ""))) google.set("query_place_id", String(place.googlePlaceId));

  const yandex = new URLSearchParams();
  if (query) yandex.set("text", query);
  if (at) {
    yandex.set("ll", lonLat(at));
    yandex.set("z", String(zoom));
    if (!query) yandex.set("pt", lonLat(at));
  }

  let apple;
  if (query) {
    const search = new URLSearchParams({ query });
    if (at) {
      search.set("center", latLon(at));
      search.set("span", appleSpan(zoom));
    }
    apple = `https://maps.apple.com/search?${search}`;
  } else {
    const pin = new URLSearchParams({ coordinate: latLon(/** @type {any} */ (at)) });
    const name = String(place.name || "").trim();
    if (name) pin.set("name", name);
    apple = `https://maps.apple.com/place?${pin}`;
  }

  return [
    { service: "google", href: `https://www.google.com/maps/search/?${google}` },
    { service: "yandex", href: `${yandexHost(lang)}?${yandex}` },
    { service: "apple", href: apple },
  ];
}

/**
 * Split stop indexes into Google-sized pieces; each piece starts where the previous one ended.
 * @param {number} count
 * @returns {[number, number][]} inclusive [first, last] index pairs
 */
export function googlePieces(count) {
  const size = GOOGLE_WAYPOINTS + 2;
  if (count <= size) return [[0, count - 1]];
  /** @type {[number, number][]} */
  const pieces = [];
  for (let first = 0; first < count - 1; first += size - 1) pieces.push([first, Math.min(first + size - 1, count - 1)]);
  return pieces;
}

/**
 * A walk through the points in order: Google (split when it would drop stops), Yandex and Apple each as one route.
 * @param {{ lat: number, lon: number }[]} points
 * @param {string} [lang]
 * @returns {MapLink[]}
 */
export function routeLinks(points, lang = "en") {
  const stops = points.filter(hasPoint);
  if (stops.length < 2) return stops.length ? walkLinks(stops[0], lang) : [];

  const pieces = googlePieces(stops.length);
  /** @type {MapLink[]} */
  const google = pieces.map(([first, last]) => {
    const part = stops.slice(first, last + 1);
    const q = new URLSearchParams({ api: "1", origin: latLon(part[0]), destination: latLon(part[part.length - 1]), travelmode: "walking" });
    const via = part.slice(1, -1).map(latLon);
    if (via.length) q.set("waypoints", via.join("|"));
    const link = { service: /** @type {MapService} */ ("google"), href: `https://www.google.com/maps/dir/?${q}` };
    return pieces.length > 1 ? { ...link, from: first + 1, to: last + 1 } : link;
  });

  const yandex = new URLSearchParams({ rtext: stops.map(latLon).join("~"), rtt: "pd" });

  const apple = new URLSearchParams({ source: latLon(stops[0]) });
  for (const stop of stops.slice(1, -1)) apple.append("waypoint", latLon(stop));
  apple.set("destination", latLon(stops[stops.length - 1]));
  apple.set("mode", "walking");

  return [
    ...google,
    { service: "yandex", href: `${yandexHost(lang)}?${yandex}` },
    { service: "apple", href: `https://maps.apple.com/directions?${apple}` },
  ];
}

/**
 * Walking directions from wherever the reader is now. A named place is the destination by name, so the route ends at
 * its entrance; a category search has no single destination, so it walks to the point.
 * @param {MapPlace & { browse?: boolean }} place
 * @param {string} [lang]
 * @returns {MapLink[]}
 */
export function walkLinks(place, lang = "en") {
  const point = hasPoint(place);
  const query = place.browse ? "" : String(place.query || "").trim();
  if (!point && !query) return [];
  const to = query || latLon(/** @type {any} */ (place));
  const google = new URLSearchParams({ api: "1", destination: to, travelmode: "walking" });
  const apple = new URLSearchParams({ destination: to, mode: "walking" });
  /** @type {MapLink[]} */
  const links = [{ service: "google", href: `https://www.google.com/maps/dir/?${google}` }];
  // Yandex routes take points only.
  if (point) links.push({ service: "yandex", href: `${yandexHost(lang)}?${new URLSearchParams({ rtext: `~${latLon(/** @type {any} */ (place))}`, rtt: "pd" })}` });
  links.push({ service: "apple", href: `https://maps.apple.com/directions?${apple}` });
  return links;
}
