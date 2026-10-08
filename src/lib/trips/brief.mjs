/** Validate the trip template before any model call. */

export class TripShapeError extends Error {
  /**
   * @param {string} code Stable id the form translates.
   */
  constructor(code) {
    super(code);
    this.name = "TripShapeError";
    this.code = code;
  }
}

export const LIMITS = {
  routes: [1, 6],
  hours: [4, 12],
  places: [2, 8],
  food: [0, 3],
};

export const DEFAULT_BRIEF = {
  city: "",
  routes: 3,
  hours: 8,
  placesPerRoute: 4,
  foodBreaks: 1,
  pace: "linger",
  sharedSpine: false,
  preferences: "",
  wishes: [],
};

const MAX_WISHES = 12;

/**
 * @param {unknown} value
 */
function parsePreferences(value) {
  const text = String(value ?? "").trim();
  if (text.length > 600) throw new TripShapeError("preferences");
  return text;
}

/**
 * One place per line. Blank lines and repeated phrases drop out.
 * @param {unknown} value
 */
function parseWishes(value) {
  const lines = Array.isArray(value) ? value : String(value ?? "").split("\n");
  const seen = new Set();
  /** @type {string[]} */
  const wishes = [];
  for (const line of lines) {
    const wish = String(line ?? "").trim();
    if (!wish) continue;
    if (wish.length < 2 || wish.length > 80) throw new TripShapeError("wishes");
    const key = wish.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    wishes.push(wish);
    if (wishes.length > MAX_WISHES) throw new TripShapeError("wishes");
  }
  return wishes;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {string} code
 */
function intIn(value, min, max, code) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new TripShapeError(code);
  return n;
}

/**
 * @param {unknown} input
 */
export function parseBrief(input) {
  if (input == null || typeof input !== "object" || Array.isArray(input)) throw new TripShapeError("brief");
  const row = /** @type {Record<string, unknown>} */ (input);
  const city = String(row.city ?? "").trim();
  if (city.length < 2 || city.length > 80) throw new TripShapeError("city");
  const routes = intIn(row.routes, 1, 6, "routes");
  const hours = intIn(row.hours, 4, 12, "hours");
  const placesPerRoute = intIn(row.placesPerRoute, 2, 8, "places");
  const foodBreaks = intIn(row.foodBreaks, 0, 3, "food");
  const pace = row.pace === "linger" || row.pace === "rapid" ? row.pace : null;
  if (!pace) throw new TripShapeError("pace");
  const sharedSpine = Boolean(row.sharedSpine);
  if (sharedSpine && routes < 2) throw new TripShapeError("spine");
  const preferences = parsePreferences(row.preferences);
  const wishes = parseWishes(row.wishes);
  const slots = routes * (placesPerRoute + foodBreaks);
  if (wishes.length > slots) throw new TripShapeError("wishes");
  return { city, routes, hours, placesPerRoute, foodBreaks, pace, sharedSpine, preferences, wishes };
}

/**
 * @param {string} name
 * @param {Set<string>} used
 */
export function slugId(name, used) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "stop";
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}
