/**
 * In-memory stand-in for the parts of supabase-js the fitness store uses (stream 01 tests): query builders for
 * select / upsert / insert / update / delete with eq, gt, in, order, range, maybeSingle; rpc; realtime channels.
 * Mimics the migration: the server stamps updated_at, RLS lets only writers write their own rows, CHECK and FK
 * violations fail the whole statement with Postgres codes, and a network outage answers like postgrest-js (status 0).
 * With `authStorage` the session decides who requests run as, as in supabase-js: the stored session's user while its
 * token is valid or can be refreshed (auth-js 2.117: kept on a network failure, removed when the refresh token is
 * refused), otherwise the anon key, so RLS turns writes into 42501 and quietly matches removes and updates to no rows.
 */
import { OWNER } from "./store-fixtures.mjs";

const TABLE_NAMES = [
  "fitness_profiles", "fitness_programs", "fitness_gyms", "fitness_sessions", "fitness_sets",
  "fitness_exercise_state", "fitness_bodyweight", "fitness_measurements", "fitness_adjustments",
];
const KEYS = { fitness_profiles: ["user_id"], fitness_exercise_state: ["user_id", "exercise_id"] };
const keyOf = (table) => KEYS[table] ?? ["id"];
const offlineError = { message: "TypeError: Failed to fetch", details: "", hint: "", code: "" };
const EXPIRY_MARGIN_MS = 90_000;

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.op = "select";
    this.filters = [];
    this.options = {};
    this.returning = false;
  }
  select(columns, options = {}) {
    if (this.op === "select") this.options = { ...this.options, ...options };
    else this.returning = true;
    return this;
  }
  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  gt(column, value) {
    this.filters.push((row) => Date.parse(row[column]) > Date.parse(value));
    this.since = value;
    return this;
  }
  in(column, values) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  order(column) {
    this.orderBy = column;
    return this;
  }
  range(from, to) {
    this.window = [from, to];
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  upsert(records, options = {}) {
    this.op = "upsert";
    this.records = records;
    this.onConflict = options.onConflict;
    return this;
  }
  insert(records) {
    this.op = "insert";
    this.records = Array.isArray(records) ? records : [records];
    return this;
  }
  update(values) {
    this.op = "update";
    this.values = values;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this.db.execute(this))
      .then(resolve, reject);
  }
}

export function fakeSupabase({ uid = OWNER, writers = [OWNER], admins = [OWNER], ownerId, authStorage = null, authKey = null } = {}) {
  const db = {
    /** Who requests run as without an `authStorage` */
    uid,
    authStorage,
    authKey,
    /** false: the refresh token is refused (revoked), and the next refresh of an expired token signs out */
    refreshable: true,
    refreshes: 0,
    writers: new Set(writers),
    admins: new Set(admins),
    /** null → derived from the is_owner profile, like fitness_owner_id() */
    ownerId,
    offline: false,
    clock: Date.parse("2026-11-10T10:00:00.000Z"),
    tables: Object.fromEntries(TABLE_NAMES.map((name) => [name, []])),
    calls: [],
    /** (call) => response | undefined — the first one that answers wins */
    interceptors: [],
    channels: [],
    from(table) {
      return new Query(db, table);
    },
    async rpc(name, args = {}) {
      db.calls.push({ rpc: name, args });
      for (const intercept of db.interceptors) {
        const answer = intercept({ rpc: name, args });
        if (answer) return answer;
      }
      if (db.offline) return { data: null, error: offlineError, status: 0 };
      const uid = db.actor();
      if (name === "fitness_can_write") return { data: db.writers.has(uid) || db.admins.has(uid) || db.tables.fitness_profiles.some((p) => p.user_id === uid), error: null, status: 200 };
      if (name === "fitness_owner_id") {
        const owner = db.ownerId !== undefined ? db.ownerId : db.tables.fitness_profiles.find((p) => p.is_owner && (p.is_public !== false || p.user_id === uid))?.user_id ?? null;
        return { data: owner, error: null, status: 200 };
      }
      if (name === "fitness_register_profile" || name === "fitness_update_profile") {
        if (!uid || (args.expected_user_id && args.expected_user_id !== uid)) return { data: null, error: { code: "42501", message: "Sign in with expected account" }, status: 403 };
        const displayName = String(args.display_name ?? "").trim();
        if (!displayName || displayName.length > 80) return { data: null, error: { code: "22023", message: "Display name must be 1–80 characters" }, status: 400 };
        let p = db.tables.fitness_profiles.find((r) => r.user_id === uid);
        let created = false;
        if (!p && name === "fitness_register_profile") {
          db.seed("fitness_profiles", { user_id: uid, display_name: displayName, is_owner: false, is_public: false, settings: {} });
          p = db.tables.fitness_profiles.find((r) => r.user_id === uid);
          created = true;
        }
        if (!p) return { data: null, error: { code: "42501", message: "Create your profile first" }, status: 403 };
        if (name === "fitness_update_profile") { p.display_name = displayName; p.is_public = args.is_public; }
        return { data: { created, display_name: p.display_name, is_owner: p.is_owner, is_public: p.is_public }, error: null, status: 200 };
      }
      if (name === "fitness_close_stale_sessions") {
        let n = 0;
        for (const s of db.tables.fitness_sessions) {
          if (s.user_id === uid && s.status === "active" && Date.parse(s.started_at) < db.clock - 6 * 3_600_000) {
            s.status = "auto_closed";
            s.ended_at = new Date(Date.parse(s.started_at) + 6 * 3_600_000).toISOString();
            s.updated_at = db.stamp();
            n += 1;
          }
        }
        return { data: n, error: null, status: 200 };
      }
      return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` }, status: 404 };
    },
    channel(name) {
      const channel = {
        name,
        bindings: [],
        on(type, filter, callback) {
          channel.bindings.push({ type, filter, callback });
          return channel;
        },
        subscribe() {
          channel.subscribed = true;
          return channel;
        },
      };
      db.channels.push(channel);
      return channel;
    },
    async removeChannel(channel) {
      channel.removed = true;
      return "ok";
    },
    auth: {
      async getSession() {
        if (!db.authStorage) return { data: { session: db.uid ? { user: { id: db.uid, email: "ilya@example.com" } } : null }, error: null };
        const { session, error } = db.session();
        return { data: { session }, error };
      },
    },
    /** auth-js getSession over the auth storage: a valid token as is, an expired one refreshed when there is signal. */
    session() {
      let stored = null;
      try {
        stored = JSON.parse(db.authStorage.getItem(db.authKey) ?? "null");
      } catch {
        stored = null;
      }
      if (!stored?.access_token || !stored.refresh_token || !stored.expires_at) return { session: null, error: null };
      if (stored.expires_at * 1000 - db.clock > EXPIRY_MARGIN_MS) return { session: stored, error: null };
      if (db.offline) return { session: null, error: { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 } };
      if (!db.refreshable) {
        db.authStorage.removeItem(db.authKey);
        return { session: null, error: { name: "AuthApiError", message: "Invalid Refresh Token: Refresh Token Not Found", status: 400 } };
      }
      db.refreshes += 1;
      const fresh = { ...stored, access_token: `${stored.access_token}.${db.refreshes}`, expires_at: Math.floor(db.clock / 1000) + 3600 };
      db.authStorage.setItem(db.authKey, JSON.stringify(fresh));
      return { session: fresh, error: null };
    },
    /** Who a request runs as (supabase-js refreshes the session first); null is the anon key. */
    actor() {
      return db.authStorage ? (db.session().session?.user?.id ?? null) : db.uid;
    },
    /** Server time for updated_at: one second per write statement, so the order of uploads is visible. */
    stamp() {
      db.clock += 1000;
      return new Date(db.clock).toISOString();
    },
    /** Deliver a realtime change to live subscribers. */
    emit(table, eventType, record, old = {}) {
      for (const channel of db.channels) {
        if (channel.removed) continue;
        for (const b of channel.bindings) {
          if (b.filter.table !== table) continue;
          b.callback({ eventType, new: eventType === "DELETE" ? {} : record, old, table, schema: "public" });
        }
      }
    },
    /** Rows as the server stores them. */
    seed(table, record) {
      const at = record.updated_at ?? db.stamp();
      db.tables[table].push({ user_id: OWNER, created_at: at, ...record, updated_at: at });
    },
    execute(q) {
      const call = { table: q.table, op: q.op, records: q.records, values: q.values, since: q.since };
      db.calls.push(call);
      for (const intercept of db.interceptors) {
        const answer = intercept(call);
        if (answer) return answer;
      }
      if (db.offline) return { data: null, error: offlineError, count: null, status: 0 };
      const uid = db.actor();
      const rows = db.tables[q.table];
      if (!rows) return { data: null, error: { code: "PGRST205", message: `Could not find the table public.${q.table}` }, status: 404 };
      const match = (row) => q.filters.every((f) => f(row));
      const canWrite = db.writers.has(uid) || db.admins.has(uid) || db.tables.fitness_profiles.some((p) => p.user_id === uid);
      const denied = { data: null, error: { code: "42501", message: `new row violates row-level security policy for table "${q.table}"` }, status: 403 };

      if (q.op === "select") {
        let found = rows.filter((r) => match(r) && (r.user_id === uid || db.tables.fitness_profiles.some((p) => p.user_id === r.user_id && p.is_public !== false)));
        if (q.orderBy) found = [...found].sort((a, b) => String(a[q.orderBy]).localeCompare(String(b[q.orderBy])));
        const count = found.length;
        if (q.window) found = found.slice(q.window[0], q.window[1] + 1);
        const copy = found.map((r) => structuredClone(r));
        if (q.single) return { data: copy[0] ?? null, error: null, status: 200 };
        return { data: copy, error: null, count: q.options.count ? count : null, status: 200 };
      }

      if (q.op === "upsert" || q.op === "insert") {
        if (q.table === "fitness_profiles" ? !db.admins.has(uid) : !canWrite) return denied;
        const key = keyOf(q.table);
        // One statement: every record is checked before any is written (Postgres fails the whole statement).
        for (const record of q.records) {
          const row = { user_id: uid, ...record };
          if (row.user_id !== uid) return denied;
          const problem = db.check(q.table, row);
          if (problem) return { data: null, error: problem, status: 400 };
          const existing = rows.find((r) => key.every((k) => r[k] === row[k]));
          if (existing && q.op === "insert") return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" }, status: 409 };
          if (q.table === "fitness_profiles" && row.is_owner && rows.some((r) => r.is_owner && r.user_id !== row.user_id)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"fitness_profiles_one_owner\"" }, status: 409 };
          }
          // ON CONFLICT DO UPDATE on another user's row fails the UPDATE policy's USING check
          if (existing && existing.user_id !== uid) return denied;
        }
        for (const record of q.records) {
          const row = { user_id: uid, ...record };
          const existing = rows.find((r) => key.every((k) => r[k] === row[k]));
          const at = db.stamp();
          if (existing) Object.assign(existing, structuredClone(row), { updated_at: at });
          else rows.push({ created_at: at, display_name: "", settings: {}, ...structuredClone(row), updated_at: at });
        }
        return { data: null, error: null, status: 201 };
      }

      if (q.op === "update") {
        const targets = rows.filter((r) => match(r) && r.user_id === uid);
        const at = db.stamp();
        for (const r of targets) Object.assign(r, structuredClone(q.values), { updated_at: at });
        return { data: q.returning ? targets.map((r) => ({ user_id: r.user_id })) : null, error: null, status: 200 };
      }

      if (q.op === "delete") {
        if (!canWrite) return { data: null, error: null, status: 204 };
        const keep = rows.filter((r) => !(match(r) && r.user_id === uid));
        rows.splice(0, rows.length, ...keep);
        if (q.table === "fitness_sessions") {
          const ids = new Set(rows.map((r) => r.id));
          const sets = db.tables.fitness_sets.filter((s) => ids.has(s.session_id));
          db.tables.fitness_sets.splice(0, db.tables.fitness_sets.length, ...sets);
        }
        return { data: null, error: null, status: 204 };
      }
      throw new Error(`unsupported op ${q.op}`);
    },
    /** A few of the migration's CHECK and FK constraints (sets reference (session_id, user_id), as in the migration). */
    check(table, row) {
      if (table === "fitness_sets") {
        if (!db.tables.fitness_sessions.some((s) => s.id === row.session_id && s.user_id === row.user_id)) {
          return { code: "23503", message: "insert or update on table \"fitness_sets\" violates foreign key constraint \"fitness_sets_session_owner\"" };
        }
        if (!(row.reps >= 0 && row.reps < 500)) return { code: "23514", message: "new row violates check constraint" };
      }
      if (table === "fitness_sessions" && !/^[A-Za-z0-9_-]{1,16}$/.test(row.day_key)) {
        return { code: "23514", message: "new row violates check constraint" };
      }
      return null;
    },
  };
  return db;
}
