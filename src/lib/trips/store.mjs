/** Generated trips and the API key live in this browser only. */

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

/** @returns {import("./types").SavedTrip[]} */
export function listTrips() {
  const raw = read(TRIPS) || "[]";
  if (raw === tripRaw) return tripList;
  tripRaw = raw;
  try {
    const parsed = JSON.parse(raw);
    tripList = Array.isArray(parsed) ? parsed : [];
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
  write(TRIPS, JSON.stringify([trip, ...rest].slice(0, 20)));
  bump("ilyadays-trips");
}

/**
 * @param {string} id
 */
export function deleteTrip(id) {
  write(TRIPS, JSON.stringify(listTrips().filter((trip) => trip.id !== id)));
  bump("ilyadays-trips");
}
