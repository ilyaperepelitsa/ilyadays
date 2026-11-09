/** Valid rows for every fitness table (stream 01 tests). */

export const T0 = "2026-11-10T07:00:00.000Z";
export const T1 = "2026-11-10T08:00:00.000Z";
export const T2 = "2026-11-10T09:00:00.000Z";
export const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const OWNER = "11111111-1111-4111-8111-111111111111";
export const FRIEND = "22222222-2222-4222-8222-222222222222";

const params = { rule: "double", repRange: [8, 12], rir: 2, stepPct: 2.5, failsBeforeDeload: 2, deloadPct: 10, overshootReps: 3 };

export const program = (over = {}) => ({
  id: uuid(1),
  templateId: "owner-3day",
  name: { en: "Upper body 3 days", ru: "Верх тела, 3 дня" },
  goal: "recomp",
  daysPerWeek: 3,
  days: [
    {
      key: "A",
      name: { en: "Chest focus", ru: "Акцент на грудь" },
      focus: ["chest"],
      slots: [{ slotId: "A1", exerciseId: "machine-chest-press", sets: 3, repRange: [8, 12], rir: 2, restSec: 120, progression: "double" }],
    },
  ],
  rotation: "sequential",
  progression: { double: params, linear: params, rpe: params, "rep-target": params },
  deloadEveryWeeks: 0,
  version: 1,
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

export const gym = (over = {}) => ({
  id: uuid(2),
  name: "Home gym",
  available: [],
  missing: ["pec-deck"],
  preferred: { A3: "cable-fly" },
  increments: { "lat-pulldown": 2.5 },
  notes: "Basement",
  updatedAt: T0,
  ...over,
});

export const session = (over = {}) => ({
  id: uuid(3),
  programId: uuid(1),
  dayKey: "A",
  gymId: uuid(2),
  startedAt: T0,
  endedAt: null,
  status: "active",
  bodyweightKg: 84.2,
  readiness: { sleep: 4, energy: 3 },
  notes: "felt good",
  updatedAt: T0,
  ...over,
});

export const set = (over = {}) => ({
  id: uuid(4),
  sessionId: uuid(3),
  slotId: "A1",
  exerciseId: "machine-chest-press",
  setIndex: 0,
  kind: "working",
  plannedKg: 40,
  plannedReps: 10,
  kg: 42.5,
  reps: 11,
  rir: 1.5,
  doneAt: T0,
  updatedAt: T0,
  ...over,
});

export const state = (over = {}) => ({
  exerciseId: "machine-chest-press",
  workingKg: 42.5,
  targetReps: 10,
  repRange: [8, 12],
  rir: 2,
  e1rm: 58.1,
  lastOutcome: "progressed",
  fails: 0,
  sessions: 3,
  lastAt: T0,
  note: { en: "+2.5 kg", ru: "+2,5 кг" },
  updatedAt: T0,
  ...over,
});

export const weighIn = (over = {}) => ({ id: uuid(5), at: T0, kg: 84.2, bodyFatPct: 18.5, note: "morning", updatedAt: T0, ...over });

export const adjustment = (over = {}) => ({
  id: uuid(6),
  at: T0,
  source: "ai",
  input: { reason: "missed sessions" },
  output: { daysPerWeek: 2 },
  applied: false,
  updatedAt: T0,
  ...over,
});

export const settings = (over = {}) => ({
  goal: "recomp",
  daysPerWeek: 3,
  bodyweightKg: 84,
  activeGymId: uuid(2),
  unit: "kg",
  restTimer: true,
  autoCloseHours: 6,
  updatedAt: T0,
  ...over,
});

/** table → a valid row */
export const measurement = (over = {}) => ({ id: uuid(7), at: T0, values: { waist: 85, 'left-biceps': 33 }, note: 'Morning', updatedAt: T0, ...over });

export const ROWS = {
  measurements: measurement,
  programs: program,
  gyms: gym,
  sessions: session,
  sets: set,
  exercise_state: state,
  bodyweight: weighIn,
  adjustments: adjustment,
  settings,
};

/** A supabase-js session as auth-js stores it under `ilyadays-auth:<project>`; `expiresAt` (ms) is the access token's. */
export const authSession = (user, expiresAt) =>
  JSON.stringify({
    access_token: `access-${user.id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(expiresAt / 1000),
    refresh_token: `refresh-${user.id}`,
    user,
  });

/** A Map-backed localStorage stand-in (listable like localStorage: length, key(i)); `fail` makes setItem throw (quota exceeded). */
export function memoryStorage(initial = {}) {
  const bag = new Map(Object.entries(initial));
  return {
    bag,
    fail: false,
    get length() {
      return bag.size;
    },
    key(i) {
      return [...bag.keys()][i] ?? null;
    },
    getItem(key) {
      return bag.has(key) ? bag.get(key) : null;
    },
    setItem(key, value) {
      if (this.fail) throw new Error("QuotaExceededError");
      bag.set(key, String(value));
    },
    removeItem(key) {
      bag.delete(key);
    },
  };
}

/** Freeze deeply so a reducer that mutates its input throws in strict mode. */
export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
