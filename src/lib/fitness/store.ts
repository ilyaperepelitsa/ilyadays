/**
 * Fitness store (stream 01 — plans/fitness/01-database-and-sync.md).
 *
 * Local-first: every write lands synchronously in a snapshot persisted to localStorage. When the signed-in account
 * may write (`synced`), changes also go to an outbox replayed to Supabase; visitors get a read-only mirror of the
 * owner's rows (`viewer`, live updates for sessions and sets); without Supabase everything stays in this browser
 * (`local`). Nothing here throws into React: failures become `getStatus().lastError` and the outbox keeps the data.
 *
 * Only erasable TypeScript (no enums, namespaces, parameter properties): `node --test` imports this file directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FitnessStore, RowOf, Session, Settings, Snapshot, StoreMode, Table } from "./types";
import type { OutboxEntry, StorageLike } from "./store-core.mjs";
import {
  DEFAULTS_AT,
  FLUSH_ORDER,
  ON_CONFLICT,
  REMOTE_TABLE,
  SNAPSHOT_KEY,
  TABLES,
  UNCONFIGURED,
  adoptCopies,
  appendOutbox,
  applyRemove,
  applyUpsert,
  authStorageKey,
  clipText,
  closeStaleSessions,
  defaultSettings,
  emptySnapshot,
  fromRemote,
  hasLocalData,
  isRow,
  isUuid,
  listRows,
  makeRemove,
  makeUpsert,
  maxIso,
  mergeRemote,
  normalizeIso,
  outboxKey,
  overlayOutbox,
  parseAuthSession,
  parseOutbox,
  parseSnapshot,
  remoteProblem,
  rowId,
  serializeOutbox,
  serializeSnapshot,
  storageKeys,
  timeOf,
  toRemote,
  withPending,
} from "./store-core.mjs";

/* ------------------------------------------------------------------ public types */

export type StoreUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };
export type StoreAuth = { user: StoreUser | null; isAdmin: boolean; loading: boolean };
/**
 * Why the store is in local mode: no Supabase; signed out with rows logged before sign-in; migration not applied (or
 * not applied when this device last asked); rows already logged in this browser while the signed-in account is being
 * checked; no answer from the server to decide with (no signal, a hanging check).
 */
export type LocalReason = "unconfigured" | "signed-out" | "backend-missing" | "checking" | "offline";

export type StoreStatus = {
  mode: StoreMode;
  localReason: LocalReason | null;
  /**
   * Synced on the session supabase-js still stores for this device's confirmed writer while the site reports signed
   * out (expired token, no signal to refresh it): changes queue here, nothing is sent until the session is valid.
   */
  awaitingSession: boolean;
  /**
   * Chosen from this device's memory while the sign-in was still loading (a stored writer session, a missing
   * migration, rows logged here): writable at once; decided again when auth settles.
   */
  provisional: boolean;
  /** Which local copy is in use: the Supabase project host, or "unconfigured" */
  storageProject: string;
  online: boolean;
  /** Outbox entries of the signed-in account (synced mode) */
  pending: number;
  flushing: boolean;
  syncing: boolean;
  /** "kind: detail" — kind is offline | permission | auth | schema | data | profile | server | storage | rejected | invalid */
  lastError: string | null;
  /** Changes taken out of the outbox this session (refused as data, or MAX_TRIES times otherwise); the rows stay in this browser */
  rejected: number;
  /** The signed-in account's fitness_profiles row */
  profile: "unknown" | "missing" | "present";
  profileDetails: { displayName: string; isPublic: boolean; isOwner: boolean } | null;
  /** Whose rows a viewer sees (the owner) */
  ownerId: string | null;
  userId: string | null;
  lastSyncAt: string | null;
};

export type EnsureProfileResult = { ok: boolean; created: boolean; isOwner: boolean; error?: string };

export interface SyncedFitnessStore extends FitnessStore {
  /** Window listeners (online, offline, visibility, storage) + the 30 s tick. Returns stop. Reference-counted. */
  start(): () => void;
  /** Decide the mode for this auth state; call on every auth change (cheap when nothing changed). */
  attach(auth: StoreAuth): void;
  /** Re-run the mode decision with the last auth (after creating a profile). */
  recheck(): void;
  getStatus(): StoreStatus;
  /** Auto-close sessions active for more than settings.autoCloseHours (6). Writable modes only. */
  closeStaleSessions(): Session[];
  /** Default settings (stamped 1970, never uploaded) when the writable copy has none. */
  bootstrapSettings(): void;
  /** Create the signed-in account's fitness profile (owner when there is none; admins only by RLS). */
  ensureProfile(displayName?: string): Promise<EnsureProfileResult>;
  registerProfile(displayName: string): Promise<EnsureProfileResult>;
  updateProfile(input: { displayName: string; isPublic: boolean }): Promise<EnsureProfileResult>;
  /** Stop timers, listeners and live updates (tests, hot reload). */
  dispose(): void;
}

export type CreateFitnessStoreOptions = {
  getSupabase: () => Promise<SupabaseClient | null>;
  configured: boolean;
  /** `supabaseProject` from src/lib/supabase.ts */
  project: string;
  /** Defaults to window.localStorage (null: memory only) */
  storage?: StorageLike | null;
  now?: () => number;
  isOnline?: () => boolean;
  warn?: (...args: unknown[]) => void;
  /** How long a mode-decision request may hang before the device goes on without its answer (tests). */
  decideTimeoutMs?: number;
};

export const INITIAL_STATUS: StoreStatus = Object.freeze({
  mode: "loading",
  localReason: null,
  awaitingSession: false,
  provisional: false,
  storageProject: UNCONFIGURED,
  online: true,
  pending: 0,
  flushing: false,
  syncing: false,
  lastError: null,
  rejected: 0,
  profile: "unknown",
  profileDetails: null,
  ownerId: null,
  userId: null,
  lastSyncAt: null,
}) as StoreStatus;

/* ------------------------------------------------------------------ internals */

const WRITE_DEBOUNCE_MS = 300;
const TICK_MS = 30_000;
const STALE_PULL_MS = 60_000;
const FULL_PULL_MS = 24 * 3_600_000;
const OVERLAP_MS = 2 * 60_000;
const PAGE = 1000;
const MAX_PAGES = 200;
const UPSERT_CHUNK = 500;
const DELETE_CHUNK = 100;
const MAX_BACKOFF_MS = 60_000;
const REDECIDE_DELAY_MS = 300;
const REDECIDE_GAP_MS = 10_000;
/** A decision request on a weak signal can hang for a minute; past this the device goes on as if it got no answer. */
const DECIDE_TIMEOUT_MS = 10_000;
/** Signed out, a page load this soon after this device found the migration missing trusts that (no 404 per page view). */
const BACKEND_RECHECK_MS = 3_600_000;
/** A row refused this many times (with other rows of its table going through) leaves the outbox: it cannot hold the queue. */
export const MAX_TRIES = 5;
/** One-by-one attempts after a failed batch: this many misses with nothing through means it is not about the rows. */
const PROBE = 3;
/** Dead letters kept in `…:dead`. */
const DEAD_LOG = 200;
const LIVE_TABLES = ["sessions", "sets"] as const;
const SCHEMA_CODES = new Set(["PGRST202", "PGRST204", "PGRST205", "42883", "42P01", "42703"]);

type PgError = { code?: string | null; message?: string | null; status?: number };
type ErrorKind = "offline" | "permission" | "auth" | "schema" | "data" | "profile" | "server";
type Timer = ReturnType<typeof setTimeout>;
/**
 * `done` uploaded; `dropped` refused for good (data); `failed` not uploaded, waiting; `refused` those of them the server
 * turned down for themselves (a 4xx: permission, profile, payload) — counted towards MAX_TRIES when `countable` (other
 * rows of the table went through); `systemic`: the connection, sign-in or schema — stop the flush.
 */
type PushResult = {
  done: OutboxEntry[];
  dropped: OutboxEntry[];
  failed: OutboxEntry[];
  refused: OutboxEntry[];
  countable: boolean;
  error?: PgError;
  systemic?: boolean;
};
type Answer = { data: unknown; error: PgError | null; status?: number };
type PullResult = { table: Table; rows: unknown[]; maxAt: string | null; found: boolean; profileDetails?: StoreStatus["profileDetails"]; error: PgError | null };
type Cursor = { user: string; at: string | null; fullAt: string };

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Map a PostgREST / network error to what the store does about it. */
function classify(error: PgError | null | undefined, status?: number): ErrorKind {
  const code = String(error?.code ?? "");
  const httpStatus = status ?? error?.status;
  if (/^2[23]/.test(code)) return "data"; // data exception / integrity violation: this row will never pass
  if (code === "42501") return "permission"; // RLS: not allowed (yet) — keep the data
  if (code === "no-profile") return "profile";
  if (SCHEMA_CODES.has(code) || httpStatus === 404) return "schema"; // migration not applied
  if (code.startsWith("PGRST3") || httpStatus === 401 || httpStatus === 403) return "auth";
  if (httpStatus === 0 || (!code && /fetch|network|load failed|offline|timeout|abort/i.test(String(error?.message ?? "")))) return "offline";
  return "server";
}

const describe = (kind: ErrorKind | string, error?: PgError | null) =>
  `${kind}: ${String(error?.message || error?.code || kind).slice(0, 160)}`;

/** Errors about the connection, the sign-in or the schema: every row would fail the same way. */
const systemic = (kind: ErrorKind) => kind === "offline" || kind === "auth" || kind === "schema";

/** The server turned this request down for what it carries (a 4xx), not because it is busy or broken (5xx). */
function refusal(error: PgError): boolean {
  const kind = classify(error, error.status);
  const code = error.status ?? 0;
  return kind === "permission" || kind === "profile" || (code >= 400 && code < 500);
}

const NOTHING: Omit<PushResult, "done" | "dropped" | "failed" | "refused"> = { countable: false };

/** "kind: detail" (ensureProfileWith) back to an error that classifies the same. */
function errorOf(detail: string): PgError {
  const kind = detail.slice(0, Math.max(0, detail.indexOf(":")));
  if (kind === "offline") return { code: "", message: detail, status: 0 };
  if (kind === "auth") return { code: "PGRST301", message: detail };
  if (kind === "schema") return { code: "PGRST205", message: detail };
  if (kind === "permission") return { code: "42501", message: detail };
  if (kind === "server") return { code: "", message: detail, status: 500 };
  return { code: "no-profile", message: detail };
}

/** The same rows starting at `offset` (mod length): a retry probes a different row first. */
const rotate = <T>(rows: T[], offset: number): T[] => {
  const k = rows.length ? offset % rows.length : 0;
  return [...rows.slice(k), ...rows.slice(0, k)];
};

const rejectedText = (rejected: number) => `rejected: ${rejected} change(s) could not be uploaded and stay in this browser only`;

/** A timer that never keeps Node alive (tests); browsers ignore the unref. */
function later(fn: () => void, ms: number): Timer {
  const timer = setTimeout(fn, ms);
  (timer as unknown as { unref?: () => void }).unref?.();
  return timer;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null; // storage blocked: memory only
  }
}

/** Google full name, else the e-mail's local part. */
export function displayNameOf(user: StoreUser | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  const name = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  return clipText((name ?? user?.email?.split("@")[0] ?? "").trim(), 80);
}

/** Select the profile; insert it when missing (as owner when nobody owns the fitness data yet). */
async function ensureProfileWith(
  db: SupabaseClient,
  uid: string,
  displayName: string,
  settings?: Record<string, unknown>,
): Promise<EnsureProfileResult> {
  const failed = (error: PgError, status?: number): EnsureProfileResult => ({
    ok: false,
    created: false,
    isOwner: false,
    error: describe(classify(error, status), error),
  });
  try {
    const found = await db.from("fitness_profiles").select("user_id, is_owner").eq("user_id", uid).maybeSingle();
    if (found.error) return failed(found.error, found.status);
    if (found.data) return { ok: true, created: false, isOwner: found.data.is_owner === true };
    // Without an answer nobody can tell whether the data has an owner yet: create nothing (the next try decides), or
    // the site admin's first profile would stay a non-owner for good and visitors would see nothing.
    const owner = await db.rpc("fitness_owner_id");
    if (owner.error) return failed(owner.error, owner.status);
    const makeOwner = !owner.data;
    const record = { user_id: uid, display_name: clipText(displayName, 80), is_owner: makeOwner, is_public: makeOwner, ...(settings ? { settings } : {}) };
    let inserted = await db.from("fitness_profiles").insert(record);
    if (inserted.error?.code === "23505") {
      // Created meanwhile (another tab), or someone else became the owner first.
      const again = await db.from("fitness_profiles").select("user_id, is_owner").eq("user_id", uid).maybeSingle();
      if (again.data) return { ok: true, created: false, isOwner: again.data.is_owner === true };
      if (makeOwner) inserted = await db.from("fitness_profiles").insert({ ...record, is_owner: false, is_public: false });
    }
    if (inserted.error) return failed(inserted.error, inserted.status);
    return { ok: true, created: true, isOwner: makeOwner };
  } catch (error) {
    return { ok: false, created: false, isOwner: false, error: `server: ${errorMessage(error)}` };
  }
}

export function isSyncedStore(store: unknown): store is SyncedFitnessStore {
  return (
    typeof store === "object" &&
    store !== null &&
    typeof (store as SyncedFitnessStore).attach === "function" &&
    typeof (store as SyncedFitnessStore).getStatus === "function"
  );
}

/**
 * Admin bootstrap ("Create my fitness profile"): with a store, creates the profile and re-checks write access; with a
 * Supabase client, creates the profile of the signed-in account.
 */
export async function ensureProfile(target: SyncedFitnessStore | SupabaseClient, displayName?: string): Promise<EnsureProfileResult> {
  if (isSyncedStore(target)) return target.ensureProfile(displayName);
  try {
    const { data } = await target.auth.getSession();
    const user = data.session?.user;
    if (!user) return { ok: false, created: false, isOwner: false, error: "auth: not signed in" };
    return ensureProfileWith(target, user.id, displayName?.trim() || displayNameOf(user));
  } catch (error) {
    return { ok: false, created: false, isOwner: false, error: `server: ${errorMessage(error)}` };
  }
}

/* ------------------------------------------------------------------ the store */

export function createFitnessStore(options: CreateFitnessStoreOptions): SyncedFitnessStore {
  const configured = options.configured;
  const home = configured && options.project ? options.project : UNCONFIGURED;
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => Date.now());
  const isOnline = options.isOnline ?? (() => typeof navigator === "undefined" || navigator.onLine !== false);
  const warn = options.warn ?? ((...args: unknown[]) => console.warn("[fitness]", ...args));
  const decideTimeoutMs = options.decideTimeoutMs ?? DECIDE_TIMEOUT_MS;
  const nowIso = () => new Date(now()).toISOString();

  let storageProject = home;
  let snapshot: Snapshot = emptySnapshot();
  /** Whose rows the snapshot holds (null: made without an account) */
  let snapshotUser: string | null = null;
  let outbox: OutboxEntry[] = [];
  let mode: StoreMode = configured ? "loading" : "local";
  /** The signed-in account (any mode) */
  let user: StoreUser | null = null;
  /** Whose rows are pulled: the signed-in writer, or the owner for a viewer */
  let viewed: string | null = null;
  let status: StoreStatus = { ...INITIAL_STATUS, mode, storageProject, online: isOnline() };
  let generation = 0;
  let attachedKey: string | null = null;
  let lastAuth: StoreAuth | null = null;
  let lastPullAt = 0;
  let flushing: Promise<void> | null = null;
  let flushAgain = false;
  let attempt = 0;
  let debounceTimer: Timer | null = null;
  let retryTimer: Timer | null = null;
  let redecideTimer: Timer | null = null;
  let redecidedAt = -Infinity;
  /** The last mode decision got no answer from the server (offline, server error): asked again once online */
  let unanswered = false;
  /** Decision requests still out */
  let asking = 0;
  /** The account the server refused in this tab (it reads, even when a later check gets no answer) */
  let denied: string | null = null;
  /** A decision for a settled sign-in was made in this tab: later ones follow an auth change, not the page load */
  let settledOnce = false;
  let stopLiveUpdates: (() => void) | null = null;
  let starts = 0;
  let unlisten: (() => void) | null = null;
  const listeners = new Set<() => void>();

  /* ---------- storage */

  const read = (key: string): string | null => {
    try {
      return storage ? storage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const writeQuiet = (key: string, value: string | null): boolean => {
    if (!storage) return false;
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };
  const writeKey = (key: string, value: string) => {
    if (!writeQuiet(key, value) && storage) setStatus({ lastError: "storage: this browser refused to save (full or blocked)" });
  };
  const keys = () => storageKeys(storageProject);
  /** Serialise and save; a row that cannot be serialised becomes a status, never an exception in a click handler. */
  const persist = (key: string, serialize: () => string) => {
    let raw: string;
    try {
      raw = serialize();
    } catch (error) {
      setStatus({ lastError: `storage: ${errorMessage(error)}` });
      return;
    }
    writeKey(key, raw);
  };
  const persistSnapshot = () => persist(keys().snapshot, () => serializeSnapshot(snapshot, snapshotUser));
  const persistOutbox = () => persist(keys().outbox, () => serializeOutbox(outbox));

  function load(project: string) {
    storageProject = project;
    const parsed = parseSnapshot(read(storageKeys(project).snapshot));
    snapshot = parsed.snapshot;
    snapshotUser = parsed.user;
    outbox = parseOutbox(read(storageKeys(project).outbox));
    status = { ...status, storageProject: project };
  }
  const switchCopy = (project: string) => {
    if (project !== storageProject) load(project);
  };

  const homeKeys = storageKeys(home);
  const writerKey = homeKeys.writer;
  const cursorKey = homeKeys.cursor;
  const backendKey = homeKeys.backend;
  const backendAtKey = homeKeys.backendAt;
  /** The migration was missing when this device last asked (a storage that fails reads as "no"). */
  const backendMissing = () => read(backendKey) === "missing";
  const rememberBackend = (missing: boolean) => {
    writeQuiet(backendKey, missing ? "missing" : null);
    writeQuiet(backendAtKey, missing ? nowIso() : null);
  };
  /** Found missing within the hour, by this device's clock (no time, or one in the future: not recently). */
  const missingRecently = () => {
    const age = now() - Date.parse(read(backendAtKey) ?? "");
    return backendMissing() && age >= 0 && age < BACKEND_RECHECK_MS;
  };
  const authKey = authStorageKey(home);
  /**
   * This device's confirmed writer, when supabase-js still stores their session: the site reports them signed out when
   * the expired token could not be refreshed, while a sign-out would have removed it.
   */
  function storedWriter(): StoreUser | null {
    const stored = parseAuthSession(read(authKey));
    return stored && stored.user.id === read(writerKey) ? stored.user : null;
  }
  /**
   * The project's copy holds another account's rows: a visitor's mirror of the owner's log from an earlier visit (or
   * the owner's own, after signing out on purpose). Without an answer it stays on screen, read-only.
   */
  function holdsMirror(account: string | null): boolean {
    let cached: unknown = null;
    try {
      cached = (JSON.parse(read(homeKeys.snapshot) ?? "null") as { user?: unknown } | null)?.user;
    } catch {
      cached = null;
    }
    return typeof cached === "string" && cached !== "" && cached !== account;
  }
  /** Keep what leaves the outbox for good in a capped log (`…:dead`): diagnosis and recovery; the rows stay in the snapshot. */
  function bury(entries: OutboxEntry[], reason: string) {
    if (!entries.length) return;
    let log: unknown[] = [];
    try {
      const parsed: unknown = JSON.parse(read(homeKeys.dead) ?? "[]");
      if (Array.isArray(parsed)) log = parsed;
    } catch {
      log = [];
    }
    const at = nowIso();
    try {
      writeQuiet(homeKeys.dead, JSON.stringify([...log, ...entries.map((entry) => ({ at, reason, entry }))].slice(-DEAD_LOG)));
    } catch {
      /* nothing serialisable to keep */
    }
  }
  function readCursor(): Cursor | null {
    try {
      const c = JSON.parse(read(cursorKey) ?? "null");
      return c && typeof c.user === "string" && typeof c.fullAt === "string" ? (c as Cursor) : null;
    } catch {
      return null;
    }
  }

  /* ---------- change notification */

  function emit() {
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch (error) {
        warn(error);
      }
    }
  }

  function setStatus(patch: Partial<StoreStatus>) {
    const changed = (Object.keys(patch) as (keyof StoreStatus)[]).some((k) => status[k] !== patch[k]);
    if (!changed) return;
    status = { ...status, ...patch };
    emit();
  }

  const mine = (e: OutboxEntry) => e.uid === user?.id || (e.uid === null && lastAuth?.isAdmin === true);
  const pendingCount = () => (mode === "synced" ? outbox.filter(mine).length : 0);

  /** Replace the snapshot (pending count refreshed), persist when it changed, notify. */
  function commit(next: Snapshot, persist = true) {
    const pending = pendingCount();
    const final = withPending(next, pending);
    const changed = final !== snapshot;
    snapshot = final;
    if (changed && persist) persistSnapshot();
    if (status.pending !== pending) status = { ...status, pending };
    emit();
  }

  /* ---------- writes */

  const canWrite = () => mode === "local" || mode === "synced";

  function queue(entry: OutboxEntry) {
    outbox = appendOutbox(outbox, entry);
    persistOutbox();
    scheduleFlush(WRITE_DEBOUNCE_MS);
  }

  function upsert<T extends Table>(table: T, row: RowOf<T>) {
    if (!canWrite()) {
      warn(`${mode} mode is read-only; ${table} write ignored`);
      return;
    }
    if (!isRow(table, row)) {
      warn(`invalid ${table} row ignored`, row);
      setStatus({ lastError: `invalid: a ${table} row was not saved` });
      return;
    }
    if (mode === "synced" && user) queue(makeUpsert(table, row, user.id, nowIso()));
    commit(applyUpsert(snapshot, table, row));
  }

  function remove(table: Exclude<Table, "settings">, id: string) {
    if (!canWrite()) {
      warn(`${mode} mode is read-only; ${table} removal ignored`);
      return;
    }
    if (!(table in SNAPSHOT_KEY) || typeof id !== "string" || !id) {
      warn(`cannot remove ${String(table)} ${String(id)}`);
      return;
    }
    if (mode === "synced" && user) queue(makeRemove(table, id, user.id, nowIso()));
    commit(applyRemove(snapshot, table, id));
  }

  function closeStale(): Session[] {
    if (!canWrite()) return [];
    const at = nowIso();
    const { snapshot: next, closed } = closeStaleSessions(snapshot, at, snapshot.settings?.autoCloseHours ?? 6);
    if (!closed.length) return closed;
    if (mode === "synced" && user) for (const session of closed) queue(makeUpsert("sessions", session, user.id, at));
    commit(next);
    return closed;
  }

  function bootstrapSettings() {
    if (canWrite() && !snapshot.settings) commit(applyUpsert(snapshot, "settings", defaultSettings(DEFAULTS_AT)));
  }

  /* ---------- modes */

  function stopLive() {
    stopLiveUpdates?.();
    stopLiveUpdates = null;
  }

  function enterLocal(reason: LocalReason) {
    if (mode === "local" && status.localReason) {
      // Already logging in this browser (settings and stale sessions were handled on entry): only the reason changes.
      setStatus({ localReason: reason, userId: user?.id ?? null });
      return;
    }
    stopLive();
    switchCopy(UNCONFIGURED);
    viewed = null;
    mode = "local";
    status = { ...status, mode, localReason: reason, awaitingSession: false, ownerId: null, userId: user?.id ?? null, storageProject };
    bootstrapSettings();
    closeStale();
    commit(snapshot, false);
  }

  function enterSynced(account: StoreUser) {
    stopLive();
    switchCopy(home);
    if (storage && lastAuth?.isAdmin === true) {
      // Only the existing site admin may adopt the legacy browser log. New people start with their own data.
      // What was logged before Supabase existed, before signing in, or under an earlier project of this site uploads now.
      const adoption = adoptCopies(storage, home, { uid: account.id, nowIso: nowIso() });
      if (adoption.error) status = { ...status, lastError: `storage: ${adoption.error}` };
      else if (adoption.rows) {
        load(home);
        if (adoption.adopted) warn(`adopted ${adoption.adopted} change(s) made in this browser before signing in`);
      }
    }
    if (snapshotUser !== account.id && (snapshotUser !== null || lastAuth?.isAdmin !== true)) {
      // Another account's rows were cached here: start clean. Their queued changes stay queued under their uid.
      snapshot = emptySnapshot();
      writeQuiet(cursorKey, null);
    }
    snapshotUser = account.id;
    viewed = account.id;
    mode = "synced";
    snapshot = overlayOutbox(snapshot, outbox.filter((e) => e.uid === account.id || (e.uid === null && lastAuth?.isAdmin === true)));
    status = { ...status, mode, localReason: null, awaitingSession: false, userId: account.id, storageProject };
    bootstrapSettings();
    closeStale();
    commit(snapshot);
    persistSnapshot();
  }

  function enterViewer(gen: number) {
    showViewer();
    void followOwner(gen);
  }

  function showViewer() {
    stopLive();
    switchCopy(home);
    viewed = null;
    mode = "viewer";
    // Identity switches must remove a private account's UI immediately, before the owner lookup returns.
    snapshotUser = null;
    snapshot = emptySnapshot();
    status = { ...status, mode, localReason: null, awaitingSession: false, userId: user?.id ?? null, storageProject, profileDetails: null };
    commit(snapshot, false);
  }

  /**
   * Ask whose rows a visitor sees, then pull them and follow live updates. Also runs in local mode, signed out on a
   * device that last found no migration: any answer means the backend exists now.
   */
  async function followOwner(gen: number) {
    const { db, res } = await ask(gen, "fitness_owner_id", () => noOwnerAnswer("offline", { message: "no answer from the server yet" }));
    if (gen !== generation) return;
    if (!db) return noOwnerAnswer("offline", res.error);
    if (res.error) {
      const kind = classify(res.error, res.status);
      if (kind === "schema") {
        rememberBackend(true);
        enterLocal("backend-missing");
        setStatus({ lastError: describe(kind, res.error) });
      } else noOwnerAnswer(kind, res.error);
      return;
    }
    rememberBackend(false);
    if (mode === "local") {
      // As attach decides: rows logged before sign-in keep this browser writable, otherwise the viewer takes over.
      if (hasLocalData(storage, UNCONFIGURED)) {
        enterLocal("signed-out");
        setStatus({ lastError: null });
        return;
      }
      showViewer();
    }
    const ownerId = typeof res.data === "string" && res.data ? res.data : null;
    setStatus({ ownerId });
    if (!ownerId) {
      viewed = null;
      stopLive();
      // Nobody owns the fitness data yet: nothing to show (queued changes, if any, stay in the outbox).
      if (snapshotUser !== null || snapshot.settings || listRows(snapshot).length) {
        snapshotUser = null;
        commit(emptySnapshot());
      }
      return;
    }
    if (snapshotUser !== ownerId) {
      snapshotUser = ownerId;
      writeQuiet(cursorKey, null);
      commit(emptySnapshot());
    }
    viewed = ownerId;
    await pull(gen, ownerId, "viewer");
    if (gen === generation && mode === "viewer") startLive(db, ownerId, gen);
  }

  /**
   * A visitor's check got no answer. A copy of someone's log cached here stays on screen, read-only; with nothing
   * cached this may be the owner's phone, never signed in here, in a gym without signal: it logs in this browser until
   * an answer comes (the rows wait in `unconfigured`, adopted only by a confirmed writer).
   */
  function noOwnerAnswer(kind: ErrorKind, error: PgError | null) {
    unanswered = true;
    if (!user && mode === "viewer" && !holdsMirror(null)) enterLocal("offline");
    setStatus({ lastError: describe(kind, error), online: kind === "offline" ? false : status.online });
  }

  function setLoading() {
    stopLive();
    mode = "loading";
    status = { ...status, mode, localReason: null, awaitingSession: false };
    commit(snapshot, false);
  }

  async function client(): Promise<SupabaseClient | null> {
    try {
      return await options.getSupabase();
    } catch {
      return null;
    }
  }

  function attach(auth: StoreAuth) {
    lastAuth = auth;
    // Every page mounts its own AuthProvider, so client-side navigation passes through `loading` again: keep what this
    // tab already decided instead of flickering to read-only; the settled auth state that follows is compared below.
    if (auth.loading && configured && attachedKey?.startsWith("ready|")) return;
    const key = `${auth.loading ? "loading" : "ready"}|${auth.user?.id ?? ""}|${auth.isAdmin ? "admin" : ""}`;
    if (key === attachedKey) {
      if ((mode === "synced" || mode === "viewer") && now() - lastPullAt > STALE_PULL_MS) void refresh();
      return;
    }
    attachedKey = key;
    decide(auth, false);
  }

  /** The mode for this auth state. `quiet` (asking again once online): the current mode stays on screen until the answer. */
  function decide(auth: StoreAuth, quiet: boolean) {
    const gen = ++generation;
    unanswered = false;
    if (!configured) {
      user = null;
      if (mode !== "local") enterLocal("unconfigured");
      return;
    }
    if (auth.loading) {
      // The sign-in settles over the network (the auth library, a token refresh, is_admin): on a weak signal that takes
      // a minute. A device that has logged here does not wait for it; the decision runs again once auth settles.
      if (!decideFromMemory()) setLoading();
      setStatus({ provisional: mode !== "loading" });
      return;
    }
    setStatus({ provisional: false });
    const pageLoad = !settledOnce;
    settledOnce = true;
    const previousUser = user?.id ?? null;
    user = auth.user;
    if ((previousUser !== (user?.id ?? null) && snapshotUser !== user?.id) || (mode !== "viewer" && snapshotUser !== null && snapshotUser !== user?.id)) {
      stopLive();
      snapshot = emptySnapshot();
      snapshotUser = null;
      viewed = null;
      setStatus({ profileDetails: null, profile: "unknown" });
    }
    if (user) {
      const account = user;
      const known = read(writerKey) === account.id;
      if (known) {
        // Confirmed a writer on this device before: writable at once (the gym may have no signal); re-check below.
        if (!(mode === "synced" && viewed === account.id)) enterSynced(account);
        setStatus({ awaitingSession: false }); // the site vouches for the session again
      } else if (backendMissing()) {
        // The migration was missing when this device last asked: log here at once, no loading flash. A yes below
        // adopts these rows; a no makes a viewer and keeps them in this browser for a later adoption.
        enterLocal("backend-missing");
      } else if (hasLocalData(storage, UNCONFIGURED)) {
        // Logged in this browser before (not adopted yet): keep logging while the account is checked; a yes adopts it.
        enterLocal(quiet && mode === "local" && status.localReason ? status.localReason : "checking");
      } else if (!quiet) setLoading();
      void decideSignedIn(account, auth.isAdmin, gen, known);
      return;
    }
    const stored = storedWriter();
    if (stored) {
      // Signed out only because the expired token could not be refreshed (no signal): keep writing as this device's
      // confirmed writer. Nothing is sent until supabase-js holds a valid session for them again.
      user = stored;
      if (!(mode === "synced" && viewed === stored.id)) enterSynced(stored);
      setStatus({ awaitingSession: true });
      void resume(stored, gen);
      return;
    }
    if (backendMissing()) {
      // Signed out on such a device: the same until the backend answers, then as below. A page load within the hour of
      // finding it missing does not ask again (a visitor's every page view would 404); the connection or the tab coming
      // back, a sign-out in this tab and signing in still ask at once.
      enterLocal("backend-missing");
      if (!pageLoad || !missingRecently()) void followOwner(gen);
      return;
    }
    if (hasLocalData(storage, UNCONFIGURED)) {
      // Signed out with rows logged before sign-in: keep training here; they upload on the first signed-in visit.
      enterLocal("signed-out");
      return;
    }
    // Asking again: what is on screen (a read-only mirror, or logging here without an answer) stays until the answer.
    if (quiet && (mode === "viewer" || (mode === "local" && status.localReason === "offline"))) void followOwner(gen);
    else enterViewer(gen);
  }

  /**
   * While auth loads: this device's writer with a stored session writes as that account (nothing is sent before auth
   * vouches for the session); a missing migration or rows logged here keep this browser logging. Else wait (false).
   */
  function decideFromMemory(): boolean {
    const stored = storedWriter();
    if (stored) {
      user = stored;
      if (!(mode === "synced" && viewed === stored.id)) enterSynced(stored);
      setStatus({ awaitingSession: true });
      return true;
    }
    if (backendMissing()) {
      enterLocal("backend-missing");
      return true;
    }
    if (hasLocalData(storage, UNCONFIGURED)) {
      enterLocal(mode === "local" && status.localReason ? status.localReason : "checking");
      return true;
    }
    return false;
  }

  async function decideSignedIn(account: StoreUser, isAdmin: boolean, gen: number, known: boolean) {
    const slow = () => noAnswer(gen, account, known, "offline", { message: "no answer from the server yet" });
    const { db, res } = await ask(gen, "fitness_can_write", slow);
    if (gen !== generation) return;
    if (!db) return noAnswer(gen, account, known, "offline", res.error);
    if (!res.error && res.data === true) {
      denied = null;
      rememberBackend(false);
      writeQuiet(writerKey, account.id);
      if (isAdmin) {
        const profile = await ensureProfileWith(db, account.id, displayNameOf(account));
        if (gen !== generation) return;
        setStatus(profile.ok ? { profile: "present" } : { profile: "missing", lastError: profile.error ?? "profile: not created" });
      }
      if (!(mode === "synced" && viewed === account.id)) enterSynced(account);
      await refresh();
      return;
    }
    const kind = res.error ? classify(res.error, res.status) : null;
    if (kind === "schema" && !known) {
      rememberBackend(true);
      enterLocal("backend-missing");
      setStatus({ lastError: describe(kind, res.error) });
      return;
    }
    // A confirmed writer keeps writing to the account on anything short of a no (a schema error right after a migration
    // is usually PostgREST's schema cache): the queue waits, nothing logged moves to another copy mid-session.
    if (kind) return noAnswer(gen, account, known, kind, res.error);
    // The server said no. Only this account's writer mark goes: another account confirmed on this device keeps its own.
    denied = account.id;
    rememberBackend(false);
    if (read(writerKey) === account.id) writeQuiet(writerKey, null);
    enterViewer(gen);
  }

  /**
   * No answer to decide with (no signal, a server hiccup, a check still hanging); asked again once online. A known
   * writer keeps writing (RLS still guards the server); a browser already logging here keeps logging; an account the
   * server refused in this tab, or a browser holding someone else's log, reads it; anyone else logs in this browser
   * until an answer comes (adopted only once the account is confirmed).
   */
  function noAnswer(gen: number, account: StoreUser, known: boolean, kind: ErrorKind, error: PgError | null) {
    unanswered = true;
    if (!known) {
      if (mode === "local") {
        if (status.localReason === "checking") enterLocal("offline");
      } else if (denied === account.id || holdsMirror(account.id)) {
        if (mode !== "viewer") enterViewer(gen);
      } else enterLocal("offline");
    }
    setStatus({ lastError: describe(kind, error), online: kind === "offline" ? false : status.online });
  }

  /**
   * Ask a mode-decision question. A weak signal can leave it hanging for a minute: after `decideTimeoutMs` `onSlow` runs
   * (the device goes on as if there were no answer) while the answer, when it comes, still decides.
   */
  async function ask(gen: number, name: "fitness_can_write" | "fitness_owner_id", onSlow: () => void): Promise<{ db: SupabaseClient | null; res: Answer }> {
    let waiting = true;
    const timer = later(() => {
      if (waiting && gen === generation) onSlow();
    }, decideTimeoutMs);
    try {
      const db = await client();
      if (!db) return { db, res: { data: null, error: { code: "", message: "Supabase is not reachable" }, status: 0 } };
      try {
        return { db, res: await asked(db.rpc(name)) };
      } catch (error) {
        return { db, res: { data: null, error: { code: "", message: errorMessage(error) }, status: 0 } };
      }
    } finally {
      waiting = false;
      clearTimeout(timer);
    }
  }

  /**
   * Writing on the stored session: ask supabase-js for it, which refreshes the expired token when there is signal.
   * Valid for this account → the normal check (pull, then upload); gone → decide again as signed out.
   */
  async function resume(account: StoreUser, gen: number) {
    const db = await client();
    if (gen !== generation || !db) return;
    const session = await asked(sessionOf(db));
    if (gen !== generation) return;
    if (session.id === account.id) {
      setStatus({ awaitingSession: false });
      await decideSignedIn(account, false, gen, true);
    } else if (!storedWriter() && lastAuth) decide(lastAuth, true);
  }

  /** Whose valid session supabase-js holds (it refreshes an expired token when it can); `offline`: that refresh had no signal. */
  async function sessionOf(db: SupabaseClient): Promise<{ id: string | null; offline: boolean }> {
    try {
      const { data, error } = await db.auth.getSession();
      const code = error?.status ?? 0;
      return { id: data.session?.user.id ?? null, offline: Boolean(error) && (code === 0 || code >= 500) };
    } catch {
      return { id: null, offline: true };
    }
  }

  /** Count a decision request while it is out, so a re-check never piles up behind one hanging on a weak signal. */
  async function asked<T>(request: PromiseLike<T>): Promise<T> {
    asking += 1;
    try {
      return await request;
    } finally {
      asking -= 1;
    }
  }

  /** The mode rests on no answer from the server, a missing migration or a stored session: worth asking again online. */
  function redecidable(): boolean {
    if (!configured || !lastAuth || lastAuth.loading) return false;
    if (mode === "local") return status.localReason === "offline" || status.localReason === "backend-missing" || status.localReason === "checking";
    if (mode === "viewer") return unanswered;
    return mode === "synced" && status.awaitingSession;
  }

  /**
   * The connection may be back (online, tab shown, a refreshed session): decide again where that can change the mode.
   * Coalesced, at most once per 10 s and never while a decision request is still out; nothing while the browser reports
   * offline, and nothing repeats on its own.
   */
  function scheduleRedecide() {
    if (redecideTimer || !redecidable() || !isOnline()) return;
    redecideTimer = later(() => {
      redecideTimer = null;
      if (!lastAuth || asking > 0 || !redecidable() || !isOnline()) return;
      redecidedAt = now();
      decide(lastAuth, true);
    }, Math.max(REDECIDE_DELAY_MS, redecidedAt + REDECIDE_GAP_MS - now()));
  }

  function recheck() {
    attachedKey = null;
    if (lastAuth) attach(lastAuth);
  }

  /* ---------- pull */

  async function pullTable(db: SupabaseClient, table: Table, target: string, since: string | null): Promise<PullResult> {
    try {
      if (table === "settings") {
        const r = await db
          .from(REMOTE_TABLE.settings)
          .select("user_id, display_name, is_owner, is_public, settings, updated_at")
          .eq("user_id", target)
          .maybeSingle();
        if (r.error) return { table, rows: [], maxAt: null, found: false, error: { ...r.error, status: r.status } };
        const row = r.data ? fromRemote("settings", r.data) : null;
        return { table, rows: row ? [row] : [], maxAt: r.data ? normalizeIso(r.data.updated_at) : null, found: Boolean(r.data), profileDetails: r.data ? { displayName: String(r.data.display_name ?? ""), isPublic: r.data.is_public === true, isOwner: r.data.is_owner === true } : null, error: null };
      }
      const order = table === "exercise_state" ? "exercise_id" : "id";
      const rows: unknown[] = [];
      let maxAt: string | null = null;
      let from = 0;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        let query = db.from(REMOTE_TABLE[table]).select("*", { count: "exact" }).eq("user_id", target);
        if (since) query = query.gt("updated_at", since);
        const r = await query.order(order).range(from, from + PAGE - 1);
        if (r.error) return { table, rows: [], maxAt: null, found: false, error: { ...r.error, status: r.status } };
        const data = (r.data ?? []) as Record<string, unknown>[];
        for (const record of data) {
          const row = fromRemote(table, record);
          if (row) rows.push(row);
          else warn(`skipped a malformed ${table} row`, record.id ?? record.exercise_id);
          maxAt = maxIso(maxAt, record.updated_at);
        }
        from += data.length;
        // `count` guards against a server max-rows lower than PAGE silently truncating the pull.
        if (!data.length || r.count == null || from >= r.count) break;
      }
      return { table, rows, maxAt, found: true, error: null };
    } catch (error) {
      return { table, rows: [], maxAt: null, found: false, error: { code: "", message: errorMessage(error), status: 0 } };
    }
  }

  /** Pull `target`'s rows (incremental by the server's updated_at; full when there is no cursor or once a day). */
  async function pull(gen: number, target: string, kind: "synced" | "viewer"): Promise<void> {
    const db = await client();
    if (!db || gen !== generation) return;
    if (kind === "synced") {
      // An account's own pull needs its own session (supabase-js would otherwise ask with the anon key).
      const session = await sessionOf(db);
      if (gen !== generation) return;
      if (session.id !== target) {
        setStatus(session.offline ? { lastError: "offline: the sign-in cannot be refreshed without a connection", online: false } : { lastError: "auth: no valid sign-in for this account" });
        return;
      }
    }
    // A row pending now may be uploaded while the pull runs, so what the pull read can predate that upload: it stays
    // protected for this merge too (the next pull brings the server's copy).
    const pendingAtStart = outbox.filter(mine).map(outboxKey);
    setStatus({ syncing: true });
    try {
      if (kind === "synced") {
        const closed = await db.rpc("fitness_close_stale_sessions");
        if (closed.error && classify(closed.error, closed.status) !== "offline") warn("fitness_close_stale_sessions:", closed.error.message);
        if (gen !== generation) return;
      }
      const cursor = readCursor();
      const full = !cursor || cursor.user !== target || !cursor.at || now() - timeOf(cursor.fullAt) > FULL_PULL_MS;
      const since = full || !cursor?.at ? null : new Date(timeOf(cursor.at) - OVERLAP_MS).toISOString();
      const results = await Promise.all(TABLES.map((table) => pullTable(db, table, target, since)));
      if (gen !== generation) return;
      const remote: Partial<Snapshot> = {};
      const complete: Table[] = [];
      let at: string | null = full ? null : cursor?.at ?? null;
      let failure: PgError | null = null;
      for (const r of results) {
        if (r.error) {
          failure ??= r.error;
          continue;
        }
        complete.push(r.table);
        at = maxIso(at, r.maxAt);
        if (r.table === "settings") {
          remote.settings = (r.rows[0] as Settings | undefined) ?? null;
          if (kind === "synced") status = { ...status, profile: r.found ? "present" : "missing", profileDetails: r.profileDetails ?? null };
        } else {
          (remote as Record<string, unknown>)[SNAPSHOT_KEY[r.table]] = Object.fromEntries(r.rows.map((row) => [rowId(r.table, row), row]));
        }
      }
      const protect = new Set([...pendingAtStart, ...outbox.filter(mine).map(outboxKey)]);
      const merged = mergeRemote(snapshot, remote, { protect, prune: kind === "viewer" && full ? complete : [] });
      lastPullAt = now();
      if (failure) {
        commit(merged);
        const failedKind = classify(failure, failure.status);
        setStatus({ lastError: describe(failedKind, failure), online: failedKind === "offline" ? false : status.online });
        return;
      }
      writeQuiet(cursorKey, JSON.stringify({ user: target, at, fullAt: full || !cursor ? nowIso() : cursor.fullAt } satisfies Cursor));
      const syncedAt = nowIso();
      commit({ ...merged, syncedAt });
      setStatus({ lastError: null, lastSyncAt: syncedAt, online: true });
    } catch (error) {
      setStatus({ lastError: `server: ${errorMessage(error)}` });
    } finally {
      setStatus({ syncing: false });
    }
  }

  async function refresh(): Promise<void> {
    const gen = generation;
    if (mode === "synced" && user) {
      if (status.awaitingSession) return; // nothing goes out before the stored session is valid again
      await pull(gen, user.id, "synced");
      if (gen === generation) await flush();
    } else if (mode === "viewer") {
      // Visibility may have been revoked since the previous pull; do not retain a now-private mirror.
      await followOwner(gen);
    }
  }

  /* ---------- flush */

  function scheduleFlush(ms: number) {
    if (mode !== "synced") return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = later(() => {
      debounceTimer = null;
      void flush();
    }, ms);
  }

  const entryTag = (e: OutboxEntry) => `${outboxKey(e)}@${e.at}@${e.kind}`;

  /** Drop uploaded (and permanently refused) entries — unless a newer change to the same row arrived meanwhile. */
  function settle(done: OutboxEntry[], dropped: OutboxEntry[], reason = "refused") {
    if (!done.length && !dropped.length) return;
    const gone = new Set([...done, ...dropped].map(entryTag));
    outbox = outbox.filter((e) => !gone.has(entryTag(e)));
    persistOutbox();
    if (dropped.length) {
      bury(dropped, reason);
      const rejected = status.rejected + dropped.length;
      status = { ...status, rejected, lastError: rejectedText(rejected) };
    }
    commit(snapshot, false);
  }

  /**
   * Count a refusal against each row. A row refused MAX_TRIES times while other rows of its table went through leaves
   * the outbox (dead letter, kept in `…:dead`; the row stays in this browser), so it can never hold the queue.
   */
  function countRefusals(entries: OutboxEntry[]) {
    if (!entries.length) return;
    const tags = new Set(entries.map(entryTag));
    const dead: OutboxEntry[] = [];
    outbox = outbox.map((e) => {
      if (!tags.has(entryTag(e))) return e;
      const next = { ...e, tries: (e.tries ?? 0) + 1 };
      if (next.tries >= MAX_TRIES) dead.push(next);
      return next;
    });
    persistOutbox();
    if (!dead.length) return;
    warn(`gave up uploading ${dead.length} change(s) after ${MAX_TRIES} refusals (kept in this browser)`);
    settle([], dead, "refused repeatedly");
  }

  function fail(error: PgError) {
    const kind = classify(error, error.status);
    attempt += 1;
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt - 1));
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = later(() => {
      retryTimer = null;
      void flush();
    }, Math.round(base * (0.8 + Math.random() * 0.4)));
    setStatus({ lastError: describe(kind, error), online: kind === "offline" ? false : status.online });
  }

  async function pushUpserts(db: SupabaseClient, table: Table, batch: OutboxEntry[], uid: string): Promise<PushResult> {
    const result: PushResult = { ...NOTHING, done: [], dropped: [], failed: [], refused: [] };
    const valid: OutboxEntry[] = [];
    for (const e of batch) {
      const problem = remoteProblem(table, e.row);
      if (problem) {
        warn(`not uploading ${table} ${e.id}: ${problem} (kept in this browser)`);
        result.dropped.push(e);
      } else valid.push(e);
    }
    const name = REMOTE_TABLE[table];
    const onConflict = ON_CONFLICT[table];
    const record = (e: OutboxEntry) => toRemote(table, e.row, { userId: uid }).record;
    /** Rows of this table the server judged one way or the other: proof that the problem is a row, not the table. */
    let answered = 0;
    for (let i = 0; i < valid.length; i += UPSERT_CHUNK) {
      const chunk = valid.slice(i, i + UPSERT_CHUNK);
      const res = await db.from(name).upsert(chunk.map(record), { onConflict });
      if (!res.error) {
        result.done.push(...chunk);
        answered += chunk.length;
        continue;
      }
      const error: PgError = { ...res.error, status: res.status };
      if (systemic(classify(error, error.status))) return { ...result, error, systemic: true };
      // One row can fail the whole statement: send them one by one. What the database refuses as data is dropped;
      // what it keeps refusing otherwise waits (and is counted). Misses with nothing through: not about the rows.
      let misses = 0;
      for (const e of rotate(chunk, attempt)) {
        if (!answered && misses >= PROBE) break;
        const one = await db.from(name).upsert([record(e)], { onConflict });
        if (!one.error) {
          result.done.push(e);
          answered += 1;
          continue;
        }
        const err: PgError = { ...one.error, status: one.status };
        const kind = classify(err, err.status);
        if (kind === "data") {
          warn(`database refused ${table} ${e.id}: ${one.error.message} (kept in this browser)`);
          result.dropped.push(e);
          answered += 1;
        } else if (systemic(kind)) return { ...result, error: err, systemic: true };
        else {
          result.failed.push(e);
          if (refusal(err)) result.refused.push(e);
          result.error = err;
          misses += 1;
        }
      }
    }
    // Rows left untried after the misses wait as well.
    if (result.done.length + result.dropped.length + result.failed.length < batch.length) result.error ??= { code: "", message: "upload incomplete" };
    result.countable = answered > 0;
    return result;
  }

  /** Settings live in fitness_profiles.settings: UPDATE (never creates a non-owner profile); a missing profile is created
   *  with them, which the database allows only for an admin. A refusal waits without holding the other tables. */
  async function pushSettings(db: SupabaseClient, batch: OutboxEntry[], uid: string): Promise<PushResult> {
    const none: PushResult = { ...NOTHING, done: [], dropped: [], failed: [], refused: [] };
    const outcome = (error: PgError): PushResult => {
      const kind = classify(error, error.status);
      if (kind === "data") return { ...none, dropped: batch };
      if (systemic(kind)) return { ...none, error, systemic: true };
      return { ...none, failed: batch, refused: refusal(error) ? batch : [], error };
    };
    const settings = toRemote("settings", batch[batch.length - 1].row, { userId: uid }).record.settings;
    const update = () => db.from(REMOTE_TABLE.settings).update({ settings }).eq("user_id", uid).select("user_id");
    const res = await update();
    if (res.error) return outcome({ ...res.error, status: res.status });
    if (res.data?.length) return { ...none, done: batch };
    const created = await ensureProfileWith(db, uid, displayNameOf(user), settings);
    if (!created.ok) return outcome(errorOf(created.error ?? "profile: not created"));
    status = { ...status, profile: "present" };
    if (created.created) return { ...none, done: batch };
    const again = await update();
    return again.error ? outcome({ ...again.error, status: again.status }) : { ...none, done: batch };
  }

  async function pushRemoves(db: SupabaseClient, table: Table, batch: OutboxEntry[], uid: string): Promise<PushResult> {
    const none: PushResult = { ...NOTHING, done: [], dropped: [], failed: [], refused: [] };
    const column = table === "exercise_state" ? "exercise_id" : "id";
    // A non-UUID id was never uploaded, so there is nothing to delete remotely.
    const ids = batch.map((e) => e.id).filter((id) => table === "exercise_state" || isUuid(id));
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
      const res = await db.from(REMOTE_TABLE[table]).delete().eq("user_id", uid).in(column, ids.slice(i, i + DELETE_CHUNK));
      if (res.error) {
        const error: PgError = { ...res.error, status: res.status };
        return systemic(classify(error, error.status)) ? { ...none, error, systemic: true } : { ...none, failed: batch, error };
      }
    }
    return { ...none, done: batch };
  }

  async function flushOnce(): Promise<void> {
    const account = user;
    if (!account || mode !== "synced" || status.awaitingSession || !outbox.some(mine)) return;
    const gen = generation;
    if (!isOnline()) {
      setStatus({ online: false });
      return;
    }
    const db = await client();
    if (!db || gen !== generation) return;
    // Upload only on this account's own session: without one supabase-js sends the anon key, and a remove or a settings
    // update that RLS quietly matches to no rows would leave the queue as if uploaded.
    const session = await sessionOf(db);
    if (gen !== generation) return;
    if (session.id !== account.id) {
      return fail(
        session.offline
          ? { code: "", message: "the sign-in cannot be refreshed without a connection", status: 0 }
          : { code: "PGRST301", message: "no valid sign-in for this account; changes stay queued" },
      );
    }
    setStatus({ flushing: true });
    const rejectedBefore = status.rejected;
    /** The first refusal that left something waiting (retried with backoff) */
    let waiting: PgError | null = null;
    const refused: OutboxEntry[] = [];
    // Sessions that did not go up: their sets wait too (the (session_id, user_id) key would refuse them, and a set
    // refused as data is dropped for good).
    const held = new Set<string>();
    const take = (result: PushResult) => {
      settle(result.done, result.dropped);
      if (result.error) waiting ??= result.error;
      if (result.countable) refused.push(...result.refused);
    };
    for (const table of FLUSH_ORDER) {
      let batch = outbox.filter((e) => mine(e) && e.table === table && e.kind === "upsert");
      if (table === "sets" && held.size) batch = batch.filter((e) => !held.has(e.row?.sessionId));
      if (!batch.length) continue;
      const result = table === "settings" ? await pushSettings(db, batch, account.id) : await pushUpserts(db, table, batch, account.id);
      if (gen !== generation) return;
      if (result.systemic) {
        settle(result.done, result.dropped);
        return fail(result.error ?? { code: "", message: "upload failed", status: 0 });
      }
      take(result);
      if (table === "sessions") for (const e of batch) if (!result.done.includes(e) && !result.dropped.includes(e)) held.add(e.id);
    }
    for (const table of [...FLUSH_ORDER].reverse()) {
      if (table === "settings") continue;
      const batch = outbox.filter((e) => mine(e) && e.table === table && e.kind === "remove");
      if (!batch.length) continue;
      const result = await pushRemoves(db, table, batch, account.id);
      if (gen !== generation) return;
      if (result.systemic) return fail(result.error ?? { code: "", message: "upload failed", status: 0 });
      take(result);
    }
    if (waiting) {
      countRefusals(refused);
      fail(waiting);
      if (status.rejected > rejectedBefore) setStatus({ lastError: rejectedText(status.rejected) });
      return;
    }
    attempt = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    const syncedAt = nowIso();
    commit({ ...snapshot, syncedAt }, true);
    setStatus({ lastError: status.rejected > rejectedBefore ? status.lastError : null, lastSyncAt: syncedAt, online: true });
  }

  function flush(): Promise<void> {
    if (mode !== "synced" || !user) return Promise.resolve();
    if (flushing) {
      flushAgain = true;
      return flushing;
    }
    flushing = (async () => {
      try {
        do {
          flushAgain = false;
          await flushOnce();
        } while (flushAgain && mode === "synced" && !retryTimer);
      } catch (error) {
        setStatus({ lastError: `server: ${errorMessage(error)}` });
      } finally {
        flushing = null;
        setStatus({ flushing: false });
      }
    })();
    return flushing;
  }

  /* ---------- live updates for visitors */

  function onLive(table: (typeof LIVE_TABLES)[number], payload: { eventType: string; new: unknown; old: unknown }, gen: number) {
    if (gen !== generation || mode !== "viewer") return;
    if (payload.eventType === "DELETE") {
      const id = (payload.old as { id?: unknown } | null)?.id;
      if (typeof id === "string") commit(applyRemove(snapshot, table, id));
      return;
    }
    const owner = (payload.new as { user_id?: unknown } | null)?.user_id;
    if (typeof owner === "string" && owner !== viewed) return;
    const row = fromRemote(table, payload.new);
    if (row) commit(mergeRemote(snapshot, { [SNAPSHOT_KEY[table]]: { [rowId(table, row)]: row } } as Partial<Snapshot>));
  }

  function startLive(db: SupabaseClient, ownerId: string, gen: number) {
    stopLive();
    try {
      const channel = db.channel(`fitness-live:${ownerId}`);
      for (const table of LIVE_TABLES) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: REMOTE_TABLE[table], filter: `user_id=eq.${ownerId}` },
          (payload) => onLive(table, payload, gen),
        );
      }
      channel.subscribe();
      stopLiveUpdates = () => {
        void db.removeChannel(channel).catch(() => {});
      };
    } catch (error) {
      warn("live updates unavailable", error);
    }
  }

  /* ---------- browser events */

  /** Another tab saved: take its copy (every tab saves on every change, so the stored copy is the latest). */
  function fromOtherTab(key: string | null, value: string | null) {
    const k = keys();
    if (key === k.snapshot && value) {
      const other = parseSnapshot(value);
      if (other.user === snapshotUser) commit(other.snapshot, false);
    } else if (key === k.outbox) {
      outbox = parseOutbox(value);
      commit(snapshot, false);
    } else if ((key === authKey || key === null) && mode === "synced" && lastAuth && !lastAuth.loading && !lastAuth.user) {
      // Writing on the stored session while another tab signed out, refreshed it or signed someone else in.
      decide(lastAuth, true);
    }
  }

  function onTick() {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    closeStale();
    // supabase-js refreshed the stored session on its own timer (a storage read, no request): pick it up.
    if (status.awaitingSession && (parseAuthSession(read(authKey))?.expiresAt ?? 0) > now()) scheduleRedecide();
    if (!Object.values(snapshot.sessions).some((s) => s.status === "active")) return;
    if (mode === "synced" && pendingCount() > 0) void flush();
    else if (mode === "viewer") void refresh();
  }

  function start(): () => void {
    starts += 1;
    if (starts === 1 && typeof window !== "undefined" && typeof document !== "undefined") {
      const onOnline = () => {
        attempt = 0;
        setStatus({ online: true });
        if (redecidable()) scheduleRedecide(); // decided without an answer: ask again
        else void refresh(); // synced: pull, then flush the queue; viewer: catch up
      };
      const onOffline = () => setStatus({ online: false });
      const onVisibility = () => {
        if (document.visibilityState !== "visible") return;
        closeStale();
        if (redecidable()) scheduleRedecide();
        else if (now() - lastPullAt > STALE_PULL_MS) void refresh();
        else void flush();
      };
      const onStorage = (event: StorageEvent) => fromOtherTab(event.key, event.newValue);
      const tick = setInterval(onTick, TICK_MS);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      window.addEventListener("storage", onStorage);
      document.addEventListener("visibilitychange", onVisibility);
      unlisten = () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
        window.removeEventListener("storage", onStorage);
        document.removeEventListener("visibilitychange", onVisibility);
        clearInterval(tick);
      };
    }
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      starts = Math.max(0, starts - 1);
      if (starts === 0) {
        unlisten?.();
        unlisten = null;
      }
    };
  }

  function dispose() {
    generation += 1;
    stopLive();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (redecideTimer) clearTimeout(redecideTimer);
    debounceTimer = retryTimer = redecideTimer = null;
    unlisten?.();
    unlisten = null;
    starts = 0;
    listeners.clear();
  }

  async function profileMutation(name: string, args: Record<string, unknown>): Promise<EnsureProfileResult> {
    const account = user;
    const gen = generation;
    if (!account) return { ok: false, created: false, isOwner: false, error: "auth: not signed in" };
    const db = await client();
    if (!db) return { ok: false, created: false, isOwner: false, error: "offline: Supabase is not reachable" };
    try {
      const session = await sessionOf(db);
      if (session.id !== account.id || gen !== generation) return { ok: false, created: false, isOwner: false, error: "auth: account changed" };
      const result = await db.rpc(name, { ...args, expected_user_id: account.id });
      if (gen !== generation || user?.id !== account.id) return { ok: false, created: false, isOwner: false, error: "auth: account changed" };
      if (result.error) {
        const error = describe(classify(result.error, result.status), result.error);
        setStatus({ lastError: error });
        return { ok: false, created: false, isOwner: false, error };
      }
      const data = result.data as { created?: boolean; display_name?: string; is_public?: boolean; is_owner?: boolean } | null;
      setStatus({ profile: "present", profileDetails: { displayName: data?.display_name ?? String(args.display_name), isPublic: data?.is_public === true, isOwner: data?.is_owner === true }, lastError: null });
      if (mode !== "synced") {
        // Registration is a confirmed authorization decision. Invalidate a pending public-owner pull before switching.
        generation += 1;
        const ownGeneration = generation;
        denied = null;
        writeQuiet(writerKey, account.id);
        enterSynced(account);
        await refresh();
        if (generation !== ownGeneration || user?.id !== account.id || viewed !== account.id)
          return { ok: false, created: false, isOwner: false, error: "auth: account changed" };
      }
      return { ok: true, created: data?.created === true, isOwner: data?.is_owner === true };
    } catch (error) {
      return { ok: false, created: false, isOwner: false, error: `server: ${errorMessage(error)}` };
    }
  }

  /* ---------- boot */

  load(home);
  if (!configured) enterLocal("unconfigured");

  return {
    getSnapshot: () => snapshot,
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    upsert,
    remove,
    refresh,
    flush,
    mode: () => mode,
    canWrite,
    start,
    attach,
    recheck,
    getStatus: () => status,
    closeStaleSessions: closeStale,
    bootstrapSettings,
    async ensureProfile(displayName?: string) {
      const account = user;
      if (!account) return { ok: false, created: false, isOwner: false, error: "auth: not signed in" };
      const db = await client();
      if (!db) return { ok: false, created: false, isOwner: false, error: "offline: Supabase is not reachable" };
      const result = await ensureProfileWith(db, account.id, displayName?.trim() || displayNameOf(account));
      setStatus(result.ok ? { profile: "present", lastError: null } : { lastError: result.error ?? "profile: not created" });
      if (result.ok) recheck();
      return result;
    },
    async registerProfile(displayName: string) {
      return profileMutation("fitness_register_profile", { display_name: displayName.trim() });
    },
    async updateProfile(input: { displayName: string; isPublic: boolean }) {
      return profileMutation("fitness_update_profile", { display_name: input.displayName.trim(), is_public: input.isPublic });
    },
    dispose,
  };
}
