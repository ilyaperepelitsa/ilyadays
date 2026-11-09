/**
 * Fitness store core (stream 01 — plans/fitness/01-database-and-sync.md). Pure: no DOM, no network, no clock (callers
 * pass ISO times). Every function returns NEW objects and never mutates its input; tables that did not change keep
 * their identity, so React re-renders only what changed. `src/lib/fitness/store.ts` wires this to localStorage and
 * Supabase.
 */

/** @typedef {import("./types").Snapshot} Snapshot */
/** @typedef {import("./types").Table} Table */
/** @typedef {Exclude<Table, "settings">} RowTable */
/** @typedef {import("./types").Settings} Settings */
/** @typedef {import("./types").Session} Session */
/** @typedef {import("./types").Program} Program */
/**
 * @template {Table} T
 * @typedef {import("./types").RowOf<T>} RowOf
 */
/** @typedef {"programs" | "gyms" | "sessions" | "sets" | "exerciseState" | "bodyweight" | "measurements" | "adjustments"} SnapshotTableKey */
/**
 * One pending change. `row` is stored in Snapshot shape and mapped to the remote record at flush time; `uid` is the
 * account that made the change (null: made without an account, uploaded by whoever signs in first — the owner);
 * `tries` counts uploads the server refused for this row alone (dead-lettered at MAX_TRIES, see store.ts).
 * @typedef {{ table: Table, id: string, kind: "upsert" | "remove", row?: any, at: string, uid: string | null, tries?: number }} OutboxEntry
 */
/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void, removeItem(key: string): void }} StorageLike */

/** @type {Table[]} */
export const TABLES = ["settings", "programs", "gyms", "sessions", "sets", "exercise_state", "bodyweight", "measurements", "adjustments"];
/** @type {RowTable[]} */
export const ROW_TABLES = ["programs", "gyms", "sessions", "sets", "exercise_state", "bodyweight", "measurements", "adjustments"];
/** Upload order: sets after the sessions they reference. Removes run in reverse. @type {Table[]} */
export const FLUSH_ORDER = ["settings", "programs", "gyms", "sessions", "sets", "exercise_state", "bodyweight", "measurements", "adjustments"];

/** @type {Record<RowTable, SnapshotTableKey>} */
export const SNAPSHOT_KEY = {
  programs: "programs",
  gyms: "gyms",
  sessions: "sessions",
  sets: "sets",
  exercise_state: "exerciseState",
  bodyweight: "bodyweight",
  measurements: "measurements",
  adjustments: "adjustments",
};

/** @type {Record<Table, string>} */
export const REMOTE_TABLE = {
  programs: "fitness_programs",
  gyms: "fitness_gyms",
  sessions: "fitness_sessions",
  sets: "fitness_sets",
  exercise_state: "fitness_exercise_state",
  bodyweight: "fitness_bodyweight",
  measurements: "fitness_measurements",
  adjustments: "fitness_adjustments",
  settings: "fitness_profiles",
};

/** Primary keys, for `upsert(…, { onConflict })`. @type {Record<Table, string>} */
export const ON_CONFLICT = {
  programs: "id",
  gyms: "id",
  sessions: "id",
  sets: "id",
  exercise_state: "user_id,exercise_id",
  bodyweight: "id",
  measurements: "id",
  adjustments: "id",
  settings: "user_id",
};

/** The local copy used when Supabase is not configured (and before it is). */
export const UNCONFIGURED = "unconfigured";
/** Never-edited default settings carry this time, so they lose every last-writer-wins comparison and are never uploaded. */
export const DEFAULTS_AT = "1970-01-01T00:00:00.000Z";

/* ------------------------------------------------------------------ small value checks */

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/** @param {unknown} v @returns {v is string} */
const isStr = (v) => typeof v === "string" && v.length > 0;
/** @param {unknown} v @returns {v is number} */
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** @param {unknown} v */
const isTime = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXERCISE_ID = /^[a-z0-9-]{1,64}$/;
const DAY_KEY = /^[A-Za-z0-9_-]{1,16}$/;
const has = Object.prototype.hasOwnProperty;

/** @param {unknown} v @returns {v is string} */
export const isUuid = (v) => typeof v === "string" && UUID.test(v);

/** Milliseconds of an ISO time; -Infinity when missing or unparseable (it loses every comparison). @param {unknown} iso */
export const timeOf = (iso) => {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
};

/** "2026-11-08T15:17:32.123456+00:00" → "2026-11-08T15:17:32.123Z"; null when unparseable. @param {unknown} v @returns {string | null} */
export const normalizeIso = (v) => {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** The later of two ISO times (either may be null). @param {string | null} a @param {unknown} b @returns {string | null} */
export const maxIso = (a, b) => {
  const nb = normalizeIso(b);
  if (!nb) return a;
  return !a || timeOf(nb) > timeOf(a) ? nb : a;
};

/** @param {number} n @param {number} dp */
const round = (n, dp) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
/** Postgres numerics may arrive as strings. @param {unknown} v */
const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/**
 * At most `max` characters, counted like Postgres `char_length` (code points): never cuts an emoji in half, which
 * would leave a lone surrogate the database refuses.
 * @param {unknown} v @param {number} max @returns {string}
 */
export const clipText = (v, max) => {
  if (typeof v !== "string") return "";
  if (v.length <= max) return v;
  return Array.from(v).slice(0, max).join("");
};

/* ------------------------------------------------------------------ row validation */

const SET_KINDS = ["warmup", "working", "backoff", "amrap"];
const SESSION_STATUSES = ["active", "finished", "auto_closed", "abandoned"];
const GOALS = ["strength", "hypertrophy", "recomp", "endurance", "maintenance"];
const SOURCES = ["ai", "engine", "manual"];

/** What pages read without checking. Optional fields of the contract stay optional here. @type {Record<Table, (v: Record<string, any>) => boolean>} */
const VALIDATORS = {
  programs: (v) =>
    isStr(v.id) && isObj(v.name) && isObj(v.progression) &&
    Array.isArray(v.days) && v.days.every((d) => isObj(d) && typeof d.key === "string" && Array.isArray(d.slots)),
  gyms: (v) => isStr(v.id) && typeof v.name === "string" && Array.isArray(v.available) && Array.isArray(v.missing) && isObj(v.preferred),
  sessions: (v) =>
    isStr(v.id) && typeof v.programId === "string" && isStr(v.dayKey) && (v.gymId == null || typeof v.gymId === "string") &&
    isTime(v.startedAt) && (v.endedAt == null || isTime(v.endedAt)) && SESSION_STATUSES.includes(v.status),
  sets: (v) =>
    isStr(v.id) && isStr(v.sessionId) && typeof v.slotId === "string" && isStr(v.exerciseId) &&
    Number.isInteger(v.setIndex) && v.setIndex >= 0 && SET_KINDS.includes(v.kind) &&
    isNum(v.plannedKg) && isNum(v.plannedReps) && isNum(v.kg) && v.kg >= 0 && isNum(v.reps) && v.reps >= 0 &&
    (v.rir === null || isNum(v.rir)) && isTime(v.doneAt),
  exercise_state: (v) =>
    isStr(v.exerciseId) && isNum(v.workingKg) && isNum(v.targetReps) && Array.isArray(v.repRange) && v.repRange.length === 2 &&
    v.repRange.every(isNum) && isNum(v.rir) && isNum(v.e1rm) && typeof v.lastOutcome === "string" && isNum(v.fails) &&
    isNum(v.sessions) && (v.lastAt == null || typeof v.lastAt === "string") && (v.holdUntil == null || isTime(v.holdUntil)),
  measurements: (v) => isStr(v.id) && isTime(v.at) && measurementValuesValid(v.values) && (v.note == null || typeof v.note === "string"),
  bodyweight: (v) => isStr(v.id) && isTime(v.at) && isNum(v.kg) && v.kg > 0 && (v.bodyFatPct == null || isNum(v.bodyFatPct)),
  adjustments: (v) => isStr(v.id) && isTime(v.at) && SOURCES.includes(v.source) && isObj(v.input) && isObj(v.output) && typeof v.applied === "boolean",
  settings: (v) =>
    GOALS.includes(v.goal) && [2, 3, 4].includes(v.daysPerWeek) && (v.activeGymId == null || typeof v.activeGymId === "string") &&
    v.unit === "kg" && typeof v.restTimer === "boolean" && isNum(v.autoCloseHours),
};

/**
 * True when `value` is a usable row of `table` (the fields pages read are present and typed, `updatedAt` parses).
 * One bad row — an old app version, hand-edited storage, a partial server record — is dropped instead of breaking a page.
 * @template {Table} T
 * @param {T} table
 * @param {unknown} value
 * @returns {value is RowOf<T>}
 */
export function isRow(table, value) {
  const check = VALIDATORS[table];
  return Boolean(check) && isObj(value) && isTime(value.updatedAt) && check(value);
}

/** The key a row lives under in the snapshot: `exerciseId` for exercise_state, "settings" for settings, else `id`.
 *  @param {Table} table @param {any} row @returns {string} */
export const rowId = (table, row) => (table === "settings" ? "settings" : table === "exercise_state" ? row?.exerciseId : row?.id);

/** @type {ReadonlySet<string>} */
const MEASUREMENT_SITES = new Set(["waist", "chest", "hips", "neck", "left-biceps", "right-biceps", "left-forearm", "right-forearm", "left-thigh", "right-thigh", "left-calf", "right-calf"]);
/** @param {unknown} values */
const measurementValuesValid = (values) => isObj(values) && Object.keys(values).length > 0 && Object.entries(values).every(([key, value]) => MEASUREMENT_SITES.has(key) && isNum(value) && value > 0 && value <= 300);

/* ------------------------------------------------------------------ snapshot reducers */

/** A fresh, mutable empty snapshot (EMPTY_SNAPSHOT in empty.ts is the frozen one). @returns {Snapshot} */
export function emptySnapshot() {
  return {
    programs: {},
    activeProgramId: null,
    gyms: {},
    sessions: {},
    sets: {},
    exerciseState: {},
    bodyweight: {},
    measurements: {},
    adjustments: {},
    settings: null,
    syncedAt: null,
    pending: 0,
  };
}

/** @param {Program} a @param {Program} b */
const compareProgram = (a, b) =>
  timeOf(a.updatedAt) - timeOf(b.updatedAt) || (a.version ?? 0) - (b.version ?? 0) || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);

/**
 * The active program when nothing says otherwise: the most recently updated one not marked `active: false`.
 * @param {Record<string, Program>} programs
 * @returns {string | null}
 */
export function deriveActiveProgramId(programs) {
  /** @type {Program | null} */
  let best = null;
  for (const p of Object.values(programs)) {
    if (/** @type {any} */ (p).active === false) continue;
    if (!best || compareProgram(p, best) > 0) best = p;
  }
  return best ? best.id : null;
}

/**
 * Insert or replace one row. Settings is a single object; exercise_state is keyed by `exerciseId`; a program that is
 * not marked `active: false` becomes `activeProgramId`. An invalid row returns the snapshot unchanged.
 * @template {Table} T
 * @param {Snapshot} snapshot
 * @param {T} table
 * @param {RowOf<T>} row
 * @returns {Snapshot}
 */
export function applyUpsert(snapshot, table, row) {
  if (!isRow(table, row)) return snapshot;
  if (table === "settings") return { ...snapshot, settings: /** @type {Settings} */ (row) };
  const key = SNAPSHOT_KEY[/** @type {RowTable} */ (table)];
  if (!key) return snapshot;
  const id = rowId(table, row);
  /** @type {Snapshot} */
  const next = { ...snapshot, [key]: { ...snapshot[key], [id]: row } };
  if (table === "programs") {
    if (/** @type {any} */ (row).active !== false) next.activeProgramId = id;
    else if (snapshot.activeProgramId === id) next.activeProgramId = deriveActiveProgramId(next.programs);
  }
  return next;
}

/**
 * Remove one row. Settings cannot be removed (the contract excludes it). A missing row returns the same snapshot.
 * @param {Snapshot} snapshot
 * @param {Table} table
 * @param {string} id
 * @returns {Snapshot}
 */
export function applyRemove(snapshot, table, id) {
  if (table === "settings") return snapshot;
  const key = SNAPSHOT_KEY[table];
  const rows = key ? snapshot[key] : null;
  if (!rows || !has.call(rows, id)) return snapshot;
  const rest = { ...rows };
  delete rest[id];
  /** @type {Snapshot} */
  const next = { ...snapshot, [key]: rest };
  if (table === "programs" && snapshot.activeProgramId === id) next.activeProgramId = deriveActiveProgramId(next.programs);
  return next;
}

/**
 * Merge rows pulled from Supabase (or another copy) into `local`. Per row the newer `updatedAt` wins (ties keep the
 * local row); rows only on one side are kept (union). Remote deletions are NOT tracked: a row deleted elsewhere stays
 * here unless `prune` names its table.
 * - `protect`: "table:id" keys whose local state must win (pending in the outbox: about to be uploaded, or removed).
 * - `prune`: tables pulled completely; local rows absent from `remote` and not protected are dropped (viewer mirror).
 * Tables absent from `remote` are untouched. Settings is never pruned.
 * @param {Snapshot} local
 * @param {Partial<Snapshot>} remote rows keyed like the snapshot (exerciseState by exerciseId)
 * @param {{ protect?: Iterable<string>, prune?: Iterable<Table> }} [opts]
 * @returns {Snapshot}
 */
export function mergeRemote(local, remote, opts = {}) {
  const protect = new Set(opts.protect ?? []);
  const prune = new Set(opts.prune ?? []);
  /** @type {Snapshot} */
  let next = local;
  for (const table of ROW_TABLES) {
    const key = SNAPSHOT_KEY[table];
    const incoming = remote?.[key];
    if (!isObj(incoming)) continue;
    /** @type {Record<string, any>} */
    const current = local[key] ?? {};
    /** @type {Record<string, any>} */
    let rows = current;
    const seen = new Set();
    for (const row of Object.values(incoming)) {
      if (!isRow(table, row)) continue;
      const id = rowId(table, row);
      seen.add(id);
      if (protect.has(`${table}:${id}`)) continue;
      const mine = current[id];
      if (mine && timeOf(row.updatedAt) <= timeOf(mine.updatedAt)) continue;
      if (rows === current) rows = { ...current };
      rows[id] = row;
    }
    if (prune.has(table)) {
      for (const id of Object.keys(current)) {
        if (seen.has(id) || protect.has(`${table}:${id}`)) continue;
        if (rows === current) rows = { ...current };
        delete rows[id];
      }
    }
    if (rows !== current) next = { ...next, [key]: rows };
  }
  const theirs = remote?.settings;
  if (theirs && isRow("settings", theirs) && !protect.has("settings:settings") &&
      (!local.settings || timeOf(theirs.updatedAt) > timeOf(local.settings.updatedAt))) {
    next = { ...next, settings: theirs };
  }
  if (next.programs !== local.programs) {
    // Writes stamp updatedAt, so the newest active program is the one activated last on any device.
    const active = deriveActiveProgramId(next.programs);
    if (active !== next.activeProgramId) next = { ...next, activeProgramId: active };
  }
  return next;
}

/**
 * Every row of a snapshot as `{ table, id, row }` (settings included when present).
 * @param {Snapshot} snapshot
 * @returns {{ table: Table, id: string, row: any }[]}
 */
export function listRows(snapshot) {
  /** @type {{ table: Table, id: string, row: any }[]} */
  const out = [];
  if (snapshot.settings) out.push({ table: "settings", id: "settings", row: snapshot.settings });
  for (const table of ROW_TABLES) {
    for (const row of Object.values(snapshot[SNAPSHOT_KEY[table]] ?? {})) out.push({ table, id: rowId(table, row), row });
  }
  return out;
}

/** Default settings never edited by anyone (stamped DEFAULTS_AT or earlier). @param {unknown} settings */
export const isDefaultSettings = (settings) => isObj(settings) && timeOf(settings.updatedAt) <= timeOf(DEFAULTS_AT);

/**
 * Re-apply pending changes on top of a snapshot (after a reset or a pull), so pending rows stay visible.
 * @param {Snapshot} snapshot
 * @param {OutboxEntry[]} entries
 * @returns {Snapshot}
 */
export function overlayOutbox(snapshot, entries) {
  let next = snapshot;
  for (const e of entries) next = e.kind === "remove" ? applyRemove(next, e.table, e.id) : applyUpsert(next, e.table, e.row);
  return next;
}

/** Same snapshot when the count is unchanged. @param {Snapshot} snapshot @param {number} pending @returns {Snapshot} */
export const withPending = (snapshot, pending) => (snapshot.pending === pending ? snapshot : { ...snapshot, pending });

/* ------------------------------------------------------------------ sessions & settings */

/**
 * Mark active sessions that started more than `hours` ago as auto-closed, ended at start + `hours` (same rule as
 * `public.fitness_close_stale_sessions()`).
 * @param {Snapshot} snapshot
 * @param {string} nowIso
 * @param {number} [hours]
 * @returns {{ snapshot: Snapshot, closed: Session[] }}
 */
export function closeStaleSessions(snapshot, nowIso, hours = 6) {
  const now = timeOf(nowIso);
  const limit = (isNum(hours) && hours > 0 ? hours : 6) * 3_600_000;
  /** @type {Session[]} */
  const closed = [];
  if (!Number.isFinite(now)) return { snapshot, closed };
  let sessions = snapshot.sessions;
  for (const s of Object.values(snapshot.sessions)) {
    if (s.status !== "active") continue;
    const start = timeOf(s.startedAt);
    if (!Number.isFinite(start) || !(now - start > limit)) continue;
    /** @type {Session} */
    const next = { ...s, status: "auto_closed", endedAt: new Date(start + limit).toISOString(), updatedAt: nowIso };
    if (sessions === snapshot.sessions) sessions = { ...sessions };
    sessions[s.id] = next;
    closed.push(next);
  }
  return closed.length ? { snapshot: { ...snapshot, sessions }, closed } : { snapshot, closed };
}

/**
 * Settings for a new user. Pass the real time when the user saves them; the store bootstraps with DEFAULTS_AT so
 * untouched defaults never overwrite settings saved on another device.
 * @param {string} [nowIso]
 * @returns {Settings}
 */
export const defaultSettings = (nowIso = DEFAULTS_AT) => ({
  goal: "recomp",
  daysPerWeek: 3,
  activeGymId: null,
  unit: "kg",
  restTimer: true,
  autoCloseHours: 6,
  updatedAt: nowIso,
});

/* ------------------------------------------------------------------ outbox */

/** @param {{ table: string, id: string }} e */
export const outboxKey = (e) => `${e.table}:${e.id}`;

/** @param {unknown} e @returns {e is OutboxEntry} */
export function isOutboxEntry(e) {
  if (!isObj(e) || !TABLES.includes(e.table) || !isStr(e.id) || typeof e.at !== "string") return false;
  if (e.uid != null && typeof e.uid !== "string") return false;
  if (e.tries !== undefined && !(Number.isInteger(e.tries) && e.tries >= 0)) return false;
  if (e.kind === "remove") return e.table !== "settings";
  return e.kind === "upsert" && isRow(e.table, e.row) && rowId(e.table, e.row) === e.id;
}

/** @template {Table} T @param {T} table @param {RowOf<T>} row @param {string | null} uid @param {string} at @returns {OutboxEntry} */
export const makeUpsert = (table, row, uid, at) => ({ table, id: rowId(table, row), kind: "upsert", row, at, uid });

/** @param {Table} table @param {string} id @param {string | null} uid @param {string} at @returns {OutboxEntry} */
export const makeRemove = (table, id, uid, at) => ({ table, id, kind: "remove", at, uid });

/**
 * Append a change, keeping one entry per table+id: the latest wins (a remove after an upsert leaves only the remove,
 * an upsert after a remove only the upsert). Invalid entries are ignored.
 * @param {OutboxEntry[]} outbox
 * @param {OutboxEntry} op
 * @returns {OutboxEntry[]}
 */
export function appendOutbox(outbox, op) {
  if (!isOutboxEntry(op)) return outbox;
  /** @type {OutboxEntry} */
  const entry = { ...op, uid: op.uid ?? null };
  delete entry.tries; // a new version of the row starts with a clean record
  const key = outboxKey(entry);
  return [...outbox.filter((e) => outboxKey(e) !== key), entry];
}

/** One entry per table+id, later entries winning, order of last write kept. @param {OutboxEntry[]} entries @returns {OutboxEntry[]} */
export function compactOutbox(entries) {
  /** @type {Map<string, OutboxEntry>} */
  const byKey = new Map();
  for (const e of entries) {
    const key = outboxKey(e);
    byKey.delete(key);
    byKey.set(key, e);
  }
  return [...byKey.values()];
}

/** @param {OutboxEntry[]} outbox */
export const serializeOutbox = (outbox) => JSON.stringify(outbox);

/**
 * Read a stored outbox. Malformed JSON gives []; malformed entries are dropped; duplicates are compacted.
 * @param {unknown} raw
 * @returns {OutboxEntry[]}
 */
export function parseOutbox(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.entries) ? data.entries : [];
  return compactOutbox(list.filter(isOutboxEntry).map((e) => (e.uid === undefined ? { ...e, uid: null } : e)));
}

/* ------------------------------------------------------------------ snapshot storage */

/**
 * @param {Snapshot} snapshot
 * @param {string | null} [user] whose rows these are (null: made without an account)
 */
export const serializeSnapshot = (snapshot, user = null) => JSON.stringify({ v: 1, user, snapshot });

/**
 * Read a stored snapshot (envelope `{ v, user, snapshot }` or a bare snapshot). Never throws: bad JSON gives an empty
 * snapshot, invalid rows are dropped, rows are re-keyed by their own id, `activeProgramId` is repaired.
 * @param {unknown} raw
 * @returns {{ snapshot: Snapshot, user: string | null }}
 */
export function parseSnapshot(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const envelope = isObj(data) && isObj(data.snapshot) ? data : { user: null, snapshot: data };
  /** @type {Record<string, any>} */
  const src = isObj(envelope.snapshot) ? envelope.snapshot : {};
  const out = emptySnapshot();
  for (const table of ROW_TABLES) {
    const key = SNAPSHOT_KEY[table];
    const rows = src[key];
    if (!isObj(rows)) continue;
    /** @type {Record<string, any>} */
    const target = out[key];
    for (const row of Object.values(rows)) if (isRow(table, row)) target[rowId(table, row)] = row;
  }
  out.settings = isRow("settings", src.settings) ? src.settings : null;
  const stored = src.activeProgramId;
  out.activeProgramId =
    typeof stored === "string" && out.programs[stored] && /** @type {any} */ (out.programs[stored]).active !== false
      ? stored
      : deriveActiveProgramId(out.programs);
  out.syncedAt = isTime(src.syncedAt) ? src.syncedAt : null;
  return { snapshot: out, user: isStr(envelope.user) ? envelope.user : null };
}

/**
 * localStorage keys of one Supabase project's copy ("unconfigured" when Supabase is not set up).
 * @param {string} project
 */
export function storageKeys(project) {
  const base = `ilyadays-fitness:${project || UNCONFIGURED}`;
  return {
    snapshot: `${base}:snapshot`,
    outbox: `${base}:outbox`,
    /** last account confirmed by rpc('fitness_can_write') on this device (offline gym) */
    writer: `${base}:writer`,
    /** incremental pull position `{ user, at, fullAt }` (server time) */
    cursor: `${base}:cursor`,
    /** the copy that was adopted into a configured project, kept as a backup */
    adopted: `${base}:adopted`,
    /** "missing" while the last mode-decision rpc on this device found no fitness migration (any answer clears it) */
    backend: `${base}:backend`,
    /** when this device last found the migration missing (ISO): a signed-out page load within the hour does not ask */
    backendAt: `${base}:backend-at`,
    /** changes taken out of the outbox for good (refused by the database, or refused MAX_TRIES times): a capped log */
    dead: `${base}:dead`,
  };
}

/** `ilyadays-fitness:<project>:snapshot|outbox`: a project's copy (the project names never contain ":"). */
const COPY_KEY = /^ilyadays-fitness:([^:]+):(?:snapshot|outbox)$/;

/**
 * localStorage key of the supabase-js session: `storageKey` in src/lib/supabase.ts (a test keeps the two in step).
 * @param {string} project
 */
export const authStorageKey = (project) => `ilyadays-auth:${project || UNCONFIGURED}`;

/**
 * The account of the session supabase-js stores under `authStorageKey`. auth-js (2.117) keeps it when a refresh fails
 * for lack of signal and removes it on sign-out, or once its refresh token is refused after the access token expired.
 * Null unless both tokens, the expiry and a user id are there; `expiresAt` is the access token's expiry in ms.
 * @param {string | null} raw
 * @returns {{ user: { id: string, email: string | null, user_metadata: Record<string, unknown> | null }, expiresAt: number } | null}
 */
export function parseAuthSession(raw) {
  try {
    const s = JSON.parse(raw ?? "null");
    if (!isObj(s) || !isStr(s.access_token) || !isStr(s.refresh_token) || !isNum(s.expires_at)) return null;
    if (!isObj(s.user) || !isStr(s.user.id)) return null;
    const { id, email, user_metadata: meta } = s.user;
    return { user: { id, email: isStr(email) ? email : null, user_metadata: isObj(meta) ? meta : null }, expiresAt: s.expires_at * 1000 };
  } catch {
    return null;
  }
}

/** @param {StorageLike | null | undefined} storage @param {string} key @returns {string | null} */
const safeGet = (storage, key) => {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
};

/** Rows that matter: anything but untouched default settings. @param {Snapshot} snapshot */
const meaningfulRows = (snapshot) => listRows(snapshot).filter(({ table, row }) => table !== "settings" || !isDefaultSettings(row));

/**
 * True when this browser holds rows under `project` (default settings alone do not count).
 * @param {StorageLike | null | undefined} storage
 * @param {string} [project]
 */
export function hasLocalData(storage, project = UNCONFIGURED) {
  const raw = safeGet(storage, storageKeys(project).snapshot);
  return raw ? meaningfulRows(parseSnapshot(raw).snapshot).length > 0 : false;
}

/**
 * Projects whose fitness copy this browser holds (a snapshot or an outbox key), other than `except`: "unconfigured"
 * first (when present), then other Supabase projects (an earlier backend of this site). Storage that cannot list its
 * keys still yields "unconfigured".
 * @param {StorageLike | null | undefined} storage
 * @param {string} except
 * @returns {string[]}
 */
export function storedProjects(storage, except) {
  const found = new Set();
  if (UNCONFIGURED !== except) found.add(UNCONFIGURED);
  /** @type {any} */
  const listing = storage;
  let count = 0;
  try {
    count = listing && typeof listing.key === "function" && typeof listing.length === "number" ? listing.length : 0;
  } catch {
    count = 0;
  }
  const others = [];
  for (let i = 0; i < count; i += 1) {
    let key = null;
    try {
      key = listing.key(i);
    } catch {
      key = null;
    }
    const match = typeof key === "string" ? COPY_KEY.exec(key) : null;
    if (match && match[1] !== except && match[1] !== UNCONFIGURED) others.push(match[1]);
  }
  return [...found, ...[...new Set(others)].sort()];
}

/**
 * Move a copy logged elsewhere into a configured project's copy, so it uploads on the first signed-in visit:
 * `fromProject` "unconfigured" (logged without Supabase, before signing in, or while the migration was missing), or
 * another Supabase project this site used before. Its rows — and the rows its outbox still waited to upload — are
 * merged last-writer-wins into the target, every row that won is queued once as an upsert (never-edited default
 * settings are not), the source is kept under `…:adopted` as a backup and then cleared, so the next call finds nothing.
 * A configured project's copy may hold what a visitor saw (the owner's rows), so from there only the rows of the
 * account this device confirmed as a writer in that project (`…:writer`) move, and only that account's queued
 * changes; its queued removes stay behind (they name that backend's rows). Nothing is cleared when a write fails.
 * @param {StorageLike} storage
 * @param {string} fromProject
 * @param {string} toProject
 * @param {{ uid?: string | null, nowIso?: string }} [opts]
 * @returns {{ adopted: number, rows: number, error?: string }}
 */
export function adoptLocalData(storage, fromProject, toProject, opts = {}) {
  if (!storage || !fromProject || !toProject || fromProject === toProject) return { adopted: 0, rows: 0 };
  const from = storageKeys(fromProject);
  const to = storageKeys(toProject);
  const rawSource = safeGet(storage, from.snapshot);
  const rawOutbox = safeGet(storage, from.outbox);
  if (!rawSource && !rawOutbox) return { adopted: 0, rows: 0 };
  const local = fromProject === UNCONFIGURED;
  const writer = local ? null : safeGet(storage, from.writer);
  const parsed = parseSnapshot(rawSource);
  const takeCopy = local || parsed.user === null || (writer !== null && parsed.user === writer);
  const queued = parseOutbox(rawOutbox);
  /** @param {OutboxEntry} e */
  const ours = (e) => local || e.uid === null || (writer !== null && e.uid === writer);
  const carried = queued.filter((e) => ours(e) && (e.kind === "upsert" || local));
  const left = queued.filter((e) => !carried.includes(e));
  // A queued upsert holds the newest local version of its row (the copy may have been reset since it was made).
  let source = takeCopy ? parsed.snapshot : emptySnapshot();
  for (const e of carried) {
    if (e.kind !== "upsert") continue;
    const current = e.table === "settings" ? source.settings : /** @type {Record<string, any>} */ (source[SNAPSHOT_KEY[/** @type {RowTable} */ (e.table)]])[e.id];
    if (!current || timeOf(e.row.updatedAt) >= timeOf(current.updatedAt)) source = applyUpsert(source, e.table, e.row);
  }
  const rows = meaningfulRows(source);
  const removes = carried.filter((e) => e.kind === "remove");
  if (!rows.length && !removes.length) return { adopted: 0, rows: 0 };
  const uid = opts.uid ?? null;
  const at = opts.nowIso ?? new Date().toISOString();
  const target = parseSnapshot(safeGet(storage, to.snapshot));
  let outbox = parseOutbox(safeGet(storage, to.outbox));
  for (const e of removes) outbox = appendOutbox(outbox, { ...e, uid: e.uid ?? uid });
  const merged = mergeRemote(target.snapshot, source);
  let adopted = 0;
  for (const { table, id, row } of rows) {
    const winner = table === "settings" ? merged.settings : /** @type {Record<string, any>} */ (merged[SNAPSHOT_KEY[/** @type {RowTable} */ (table)]])[id];
    if (winner !== row) continue; // the target already holds a newer version
    outbox = appendOutbox(outbox, makeUpsert(table, row, uid, at));
    adopted += 1;
  }
  try {
    storage.setItem(to.snapshot, serializeSnapshot(withPending(merged, outbox.length), target.user));
    storage.setItem(to.outbox, serializeOutbox(outbox));
  } catch (error) {
    return { adopted: 0, rows: rows.length, error: error instanceof Error ? error.message : String(error) };
  }
  try {
    storage.setItem(from.adopted, JSON.stringify({ to: toProject, at, snapshot: takeCopy ? rawSource : null, outbox: rawOutbox }));
  } catch {
    /* The backup is a courtesy; the rows are safe in the target copy. */
  }
  try {
    if (takeCopy) storage.removeItem(from.snapshot);
    if (left.length) storage.setItem(from.outbox, serializeOutbox(left));
    else storage.removeItem(from.outbox);
  } catch {
    /* A source that cannot be cleared is adopted again next time: rows that tie or lose are not queued again. */
  }
  return { adopted, rows: rows.length };
}

/**
 * Adopt every other copy this browser holds into `toProject` (see adoptLocalData): what was logged without the
 * database, and what an earlier Supabase project of this site still held for this device's writer there.
 * @param {StorageLike} storage
 * @param {string} toProject
 * @param {{ uid?: string | null, nowIso?: string }} [opts]
 * @returns {{ adopted: number, rows: number, error?: string }}
 */
export function adoptCopies(storage, toProject, opts = {}) {
  let adopted = 0;
  let rows = 0;
  /** @type {string | undefined} */
  let error;
  if (!storage || !toProject || toProject === UNCONFIGURED) return { adopted, rows };
  for (const project of storedProjects(storage, toProject)) {
    const result = adoptLocalData(storage, project, toProject, opts);
    adopted += result.adopted;
    rows += result.rows;
    error ??= result.error;
  }
  return error ? { adopted, rows, error } : { adopted, rows };
}

/* ------------------------------------------------------------------ Supabase row mapping */

/** @param {unknown} v @returns {Record<string, any>} */
const objOrEmpty = (v) => (isObj(v) ? v : {});
/** @param {unknown} v */
const bodyweightOk = (v) => isNum(v) && v > 20 && v < 400;

/**
 * Snapshot row → Supabase record. `userId` is written when known: PostgREST bulk upserts need identical keys on every
 * record, and RLS checks `user_id = auth.uid()`.
 * @template {Table} T
 * @param {T} table
 * @param {RowOf<T>} row
 * @param {{ userId?: string | null, displayName?: string | null }} [opts]
 * @returns {{ table: string, record: Record<string, any> }}
 */
export function toRemote(table, row, opts = {}) {
  /** @type {Record<string, any>} */
  const r = /** @type {any} */ (row);
  const owner = opts.userId ? { user_id: opts.userId } : {};
  const name = REMOTE_TABLE[table];
  switch (table) {
    case "programs": {
      const { active, ...spec } = r;
      return { table: name, record: { id: r.id, ...owner, active: active !== false, spec } };
    }
    case "gyms":
      return { table: name, record: { id: r.id, ...owner, spec: r } };
    case "sessions":
      return {
        table: name,
        record: {
          id: r.id,
          ...owner,
          program_id: isUuid(r.programId) ? r.programId : null,
          gym_id: isUuid(r.gymId) ? r.gymId : null,
          day_key: r.dayKey,
          started_at: normalizeIso(r.startedAt),
          ended_at: r.endedAt == null ? null : normalizeIso(r.endedAt),
          status: r.status,
          bodyweight_kg: isNum(r.bodyweightKg) && bodyweightOk(round(r.bodyweightKg, 2)) ? round(r.bodyweightKg, 2) : null,
          readiness: objOrEmpty(r.readiness),
          plan: r.plan ?? null,
          notes: clipText(r.notes, 2000),
        },
      };
    case "sets":
      return {
        table: name,
        record: {
          id: r.id,
          ...owner,
          session_id: r.sessionId,
          slot_id: r.slotId,
          exercise_id: r.exerciseId,
          set_index: Math.round(r.setIndex),
          kind: r.kind,
          planned_kg: round(r.plannedKg, 2),
          planned_reps: Math.round(r.plannedReps),
          prescription: r.prescription ?? null,
          kg: round(r.kg, 2),
          reps: Math.round(r.reps),
          rir: r.rir == null ? null : round(r.rir, 1),
          done_at: normalizeIso(r.doneAt),
        },
      };
    case "exercise_state":
      return { table: name, record: { ...owner, exercise_id: r.exerciseId, spec: r } };
    case "measurements":
      return { table: name, record: { id: r.id, ...owner, measured_at: normalizeIso(r.at), values: Object.fromEntries(Object.entries(r.values).map(([key, value]) => [key, round(Number(value), 2)])), note: clipText(r.note, 500) } };
    case "bodyweight":
      return {
        table: name,
        record: {
          id: r.id,
          ...owner,
          measured_at: normalizeIso(r.at),
          weight_kg: round(r.kg, 2),
          body_fat_pct: isNum(r.bodyFatPct) ? round(r.bodyFatPct, 1) : null,
          note: clipText(r.note, 500),
        },
      };
    case "adjustments":
      return {
        table: name,
        record: {
          id: r.id,
          ...owner,
          source: r.source,
          input: objOrEmpty(r.input),
          output: objOrEmpty(r.output),
          applied: r.applied === true,
          created_at: normalizeIso(r.at),
        },
      };
    case "settings":
      return {
        table: name,
        record: { ...owner, settings: r, ...(opts.displayName ? { display_name: clipText(String(opts.displayName), 80) } : {}) },
      };
    default:
      throw new Error(`unknown fitness table: ${String(table)}`);
  }
}

/**
 * Supabase record → Snapshot row, or null when the record cannot make a valid row. jsonb tables keep the spec's own
 * `updatedAt` (edit time); column tables take the server's `updated_at` (upload time). Optional fields are present
 * only when they carry a value.
 * @template {Table} T
 * @param {T} table
 * @param {unknown} record
 * @returns {RowOf<T> | null}
 */
export function fromRemote(table, record) {
  if (!isObj(record)) return null;
  const rec = record;
  const serverAt = normalizeIso(rec.updated_at);
  /** @type {Record<string, any>} */
  let row;
  switch (table) {
    case "programs":
    case "gyms": {
      if (!isObj(rec.spec)) return null;
      row = { ...rec.spec, id: rec.id ?? rec.spec.id };
      if (table === "programs") {
        if (rec.active === false) row.active = false;
        else delete row.active;
      }
      if (!isTime(row.updatedAt) && serverAt) row.updatedAt = serverAt;
      break;
    }
    case "exercise_state": {
      if (!isObj(rec.spec)) return null;
      row = { ...rec.spec, exerciseId: rec.exercise_id ?? rec.spec.exerciseId };
      if (!isTime(row.updatedAt) && serverAt) row.updatedAt = serverAt;
      break;
    }
    case "sessions":
      row = {
        id: rec.id,
        programId: typeof rec.program_id === "string" ? rec.program_id : "",
        dayKey: rec.day_key,
        gymId: typeof rec.gym_id === "string" ? rec.gym_id : null,
        startedAt: normalizeIso(rec.started_at),
        endedAt: rec.ended_at == null ? null : normalizeIso(rec.ended_at),
        status: rec.status,
        updatedAt: serverAt,
      };
      if (isObj(rec.plan) && rec.plan.version === 1) row.plan = rec.plan;
      if (rec.bodyweight_kg != null) row.bodyweightKg = num(rec.bodyweight_kg);
      if (isObj(rec.readiness) && Object.keys(rec.readiness).length) row.readiness = rec.readiness;
      if (typeof rec.notes === "string" && rec.notes) row.notes = rec.notes;
      break;
    case "sets":
      row = {
        id: rec.id,
        sessionId: rec.session_id,
        slotId: rec.slot_id,
        exerciseId: rec.exercise_id,
        setIndex: num(rec.set_index),
        kind: rec.kind,
        plannedKg: num(rec.planned_kg),
        plannedReps: num(rec.planned_reps),
        ...(isObj(rec.prescription) && rec.prescription.version === 1 ? { prescription: rec.prescription } : {}),
        kg: num(rec.kg),
        reps: num(rec.reps),
        rir: rec.rir == null ? null : num(rec.rir),
        doneAt: normalizeIso(rec.done_at),
        updatedAt: serverAt,
      };
      break;
    case "measurements":
      row = { id: rec.id, at: normalizeIso(rec.measured_at), values: rec.values, updatedAt: serverAt };
      if (typeof rec.note === "string" && rec.note) row.note = rec.note;
      break;
    case "bodyweight":
      row = { id: rec.id, at: normalizeIso(rec.measured_at), kg: num(rec.weight_kg), updatedAt: serverAt };
      if (rec.body_fat_pct != null) row.bodyFatPct = num(rec.body_fat_pct);
      if (typeof rec.note === "string" && rec.note) row.note = rec.note;
      break;
    case "adjustments":
      row = {
        id: rec.id,
        at: normalizeIso(rec.created_at),
        source: rec.source,
        input: objOrEmpty(rec.input),
        output: objOrEmpty(rec.output),
        applied: rec.applied === true,
        updatedAt: serverAt,
      };
      break;
    case "settings": {
      if (!isObj(rec.settings) || !Object.keys(rec.settings).length) return null;
      row = { ...rec.settings };
      if (!isTime(row.updatedAt) && serverAt) row.updatedAt = serverAt;
      break;
    }
    default:
      return null;
  }
  return isRow(table, row) ? /** @type {RowOf<T>} */ (/** @type {any} */ (row)) : null;
}

/**
 * Why the server would reject this row (its CHECK constraints and uuid columns), or null. Checked before upload so
 * one bad row cannot block a batch; such rows stay in the local snapshot only.
 * @param {Table} table
 * @param {unknown} row
 * @returns {string | null}
 */
export function remoteProblem(table, row) {
  if (!isRow(table, row)) return "invalid";
  /** @type {Record<string, any>} */
  const r = /** @type {any} */ (row);
  if (table !== "settings" && table !== "exercise_state" && !isUuid(r.id)) return "id";
  switch (table) {
    case "sessions":
      if (!DAY_KEY.test(r.dayKey)) return "dayKey";
      if (r.endedAt != null && timeOf(r.endedAt) < timeOf(r.startedAt)) return "endedAt";
      return null;
    case "sets": {
      if (!isUuid(r.sessionId)) return "sessionId";
      if (r.slotId.length > 32) return "slotId";
      if (!EXERCISE_ID.test(r.exerciseId)) return "exerciseId";
      if (r.setIndex >= 50) return "setIndex";
      const kgOk = (/** @type {number} */ v) => round(v, 2) >= 0 && round(v, 2) < 1000;
      const repsOk = (/** @type {number} */ v) => Math.round(v) >= 0 && Math.round(v) < 500;
      if (!kgOk(r.kg) || !kgOk(r.plannedKg)) return "kg";
      if (!repsOk(r.reps) || !repsOk(r.plannedReps)) return "reps";
      if (r.rir != null && (round(r.rir, 1) < 0 || round(r.rir, 1) > 10)) return "rir";
      return null;
    }
    case "exercise_state":
      return EXERCISE_ID.test(r.exerciseId) ? null : "exerciseId";
    case "measurements":
      return Object.values(r.values).every((v) => round(Number(v), 2) > 0 && round(Number(v), 2) <= 300) ? null : "values";
    case "bodyweight":
      if (!bodyweightOk(round(r.kg, 2))) return "kg";
      if (r.bodyFatPct != null && !(round(r.bodyFatPct, 1) > 1 && round(r.bodyFatPct, 1) < 70)) return "bodyFatPct";
      return null;
    default:
      return null;
  }
}
