/** Generated trips and the API key live in this browser only. */
import { validateCommitments } from "./events.mjs";

const TRIPS = "ilyadays-trips-v1";
const AI_KEY = "cdays-ai-key";
const MODEL = "ilyadays-trip-model";
const EFFORT = "ilyadays-trip-effort";

/**
 * @param {string} key
 */
function read(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* A private window can refuse storage. The form still runs. */
  }
}

/**
 * @param {string} name
 */
function bump(name) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

/**
 * @param {string} name
 * @param {() => void} onChange
 */
function subscribe(name, onChange) {
  const notify = () => onChange();
  window.addEventListener(name, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(name, notify);
    window.removeEventListener("storage", notify);
  };
}

export function subscribeTrips(onChange) {
  return subscribe("ilyadays-trips", onChange);
}

export function subscribePrefs(onChange) {
  return subscribe("ilyadays-trip-prefs", onChange);
}

export function readAiKey() {
  return read(AI_KEY);
}

/**
 * @param {string} key
 */
export function writeAiKey(key) {
  write(AI_KEY, key.trim());
  bump("ilyadays-trip-prefs");
}

export function readModel() {
  return read(MODEL) || "gpt-6.1-sol";
}

/**
 * @param {string} model
 */
export function writeModel(model) {
  write(MODEL, model.trim());
  bump("ilyadays-trip-prefs");
}

export function readEffort() {
  const value = read(EFFORT);
  return ["low", "medium", "high", "xhigh"].includes(value) ? value : "medium";
}

/**
 * @param {string} effort
 */
export function writeEffort(effort) {
  write(EFFORT, effort);
  bump("ilyadays-trip-prefs");
}

let tripRaw = "";
/** @type {import("./types").SavedTrip[]} */
let tripList = [];

/** @param {unknown} value */
const isObject = (value) => typeof value === "object" && value !== null;

/**
 * A trip the pages can draw. Anything else in storage (an older format, a half-written value) is skipped: one bad
 * entry must not take down the travel pages, and reloading would not fix it.
 *
 * @param {any} value
 * @returns {value is import("./types").SavedTrip}
 */
export function isSavedTrip(value) {
  if (value?.commitments !== undefined) {
    try { validateCommitments(value.commitments, value.brief); } catch { return false; }
  }
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.city === "string" &&
    Array.isArray(value.routes) &&
    value.routes.every(
      (/** @type {any} */ route) =>
        isObject(route) &&
        isObject(route.theme) &&
        typeof route.theme.title === "string" &&
        (route.schedule === undefined || (Array.isArray(route.schedule) && route.schedule.every((s) => typeof s?.stopId === "string" && typeof s?.start === "string" && typeof s?.end === "string"))) &&
        Array.isArray(route.stops) &&
        route.stops.every((/** @type {any} */ stop) => isObject(stop) && typeof stop.id === "string"),
    )
  );
}

/** @returns {import("./types").SavedTrip[]} */
export function listTrips() {
  const raw = read(TRIPS) || "[]";
  if (raw === tripRaw) return tripList;
  tripRaw = raw;
  try {
    const parsed = JSON.parse(raw);
    tripList = Array.isArray(parsed) ? parsed.filter(isSavedTrip) : [];
  } catch {
    tripList = [];
  }
  return tripList;
}

/**
 * @param {string} id
 */
export function loadTrip(id) {
  return listTrips().find((trip) => trip.id === id) ?? null;
}

/**
 * @param {import("./types").SavedTrip} trip
 */
export function saveTrip(trip) {
  const rest = listTrips().filter((item) => item.id !== trip.id);
  const serialized = JSON.stringify([trip, ...rest].slice(0, 20));
  write(TRIPS, serialized);
  bump("ilyadays-trips");
  return read(TRIPS) === serialized;
}

/**
 * @param {string} id
 */
export function deleteTrip(id) {
  write(TRIPS, JSON.stringify(listTrips().filter((trip) => trip.id !== id)));
  bump("ilyadays-trips");
}
