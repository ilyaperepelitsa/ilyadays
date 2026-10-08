/** TripShapeError codes the form can show. Anything else uses the generic line. */

const KEYS = {
  city: "tripNeedCity",
  key: "tripNeedKey",
  themes: "tripNeedThemes",
  counts: "tripErrCounts",
  coords: "tripErrCoords",
  notes: "tripErrNotes",
  spine: "tripErrSpine",
  wishes: "tripErrWishes",
  preferences: "tripErrPreferences",
  routes: "tripErrRoutes",
  hours: "tripErrHours",
  places: "tripErrPlaces",
  food: "tripErrFood",
  pace: "tripErrPace",
  length: "tripErrLength",
  stops: "tripErrGeneric",
  minutes: "tripErrGeneric",
  brief: "tripErrGeneric",
};

/**
 * @param {string} code
 */
export function tripErrorKey(code) {
  return KEYS[code] || "tripErrGeneric";
}
