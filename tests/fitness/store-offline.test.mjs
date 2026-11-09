/**
 * The offline gym (stream 01, plans/fitness/01-database-and-sync.md decisions 14 and 15): the per-device memory of a
 * missing fitness migration (`…:backend`) and the local fallbacks, one block per case of the mode decision; writing on
 * the session supabase-js still stores when its expired token cannot be refreshed; deciding again once online.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  applyUpsert,
  authStorageKey,
  emptySnapshot,
  parseOutbox,
  parseSnapshot,
  serializeSnapshot,
  storageKeys,
  toRemote,
} from "../../src/lib/fitness/store-core.mjs";
import { FRIEND, OWNER, authSession, memoryStorage, session, set, settings, uuid, weighIn } from "./store-fixtures.mjs";
import { fakeSupabase } from "./store-fake-supabase.mjs";

// store.ts runs through Node's type stripping; hide the one-time "module type not specified" notice it triggers.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const code = typeof rest[0] === "object" && rest[0] ? rest[0].code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  return emitWarning.call(this, warning, ...rest);
};
const { createFitnessStore } = await import("../../src/lib/fitness/store.ts");

const PROJECT = "abc.supabase.co";
const HOME = storageKeys(PROJECT);
const LOCAL = storageKeys("unconfigured");
const AUTH = authStorageKey(PROJECT);
const NOW = Date.parse("2026-11-10T10:00:00.000Z");
const DAY = 24 * 3_600_000;
const ownerUser = { id: OWNER, email: "ilya@example.com", user_metadata: { full_name: "Ilya Perepelitsa" } };
const friendUser = { id: FRIEND, email: "friend@example.com", user_metadata: {} };
const signedIn = (user, isAdmin = false) => ({ user, isAdmin, loading: false });
const signedOut = { user: null, isAdmin: false, loading: false };
const at = (minutes) => new Date(NOW + minutes * 60_000).toISOString();

/** Every rpc answers like a project without the fitness migration. */
const noMigration = (call) =>
  call.rpc ? { data: null, error: { code: "PGRST202", message: `Could not find the function public.${call.rpc}` }, status: 404 } : undefined;
/** A request lost on the way, as postgrest-js reports it. */
const lost = { data: null, error: { code: "", message: "TypeError: Failed to fetch" }, status: 0 };

/** One session and one set logged in this browser before the account could be confirmed. */
const loggedHere = () => serializeSnapshot(applyUpsert(applyUpsert(emptySnapshot(), "sessions", session()), "sets", set()));
/** A device that last found no fitness migration. */
const remembered = (initial = {}) => memoryStorage({ [HOME.backend]: "missing", ...initial });

const stores = [];
afterEach(() => {
  while (stores.length) stores.pop().dispose();
  delete globalThis.window;
  delete globalThis.document;
});

/** Window and document stand-ins, so `store.start()` listens: `fire("online")`, `fire("storage", event)`, … */
function browser() {
  const listeners = new Map();
  const target = () => ({
    addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
    removeEventListener: (name, fn) => listeners.set(name, (listeners.get(name) ?? []).filter((f) => f !== fn)),
  });
  globalThis.window = target();
  globalThis.document = { ...target(), visibilityState: "visible" };
  return {
    fire(name, event = {}) {
      for (const fn of listeners.get(name) ?? []) fn(event);
    },
  };
}

/** Longer than the store's re-check delay (300 ms). */
const RECHECK_WAIT_MS = 450;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `start` with setInterval captured: returns the store's 30 s tick, to call by hand. */
function captureTick(start) {
  const real = globalThis.setInterval;
  let tick = () => {};
  globalThis.setInterval = (fn) => {
    tick = fn;
    return real(() => {}, 2 ** 30);
  };
  try {
    start();
  } finally {
    globalThis.setInterval = real;
  }
  return () => tick();
}

/** Like `until`, in real time: re-checks wait for a timer. */
async function eventually(check, label, ms = 3000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(5)) if (check()) return;
  assert.fail(`timed out waiting for: ${label}`);
}

/** `modes` records every mode the store announces, so a loading flash would show. */
function setup({ configured = true, db = fakeSupabase(), storage = memoryStorage(), online = true } = {}) {
  const env = { db, storage, online, now: NOW, warnings: [], modes: [] };
  env.store = createFitnessStore({
    getSupabase: async () => env.db,
    configured,
    project: PROJECT,
    storage,
    now: () => env.now,
    isOnline: () => env.online,
    warn: (...args) => env.warnings.push(args.map(String).join(" ")),
  });
  env.store.subscribe(() => {
    if (env.modes.at(-1) !== env.store.mode()) env.modes.push(env.store.mode());
  });
  stores.push(env.store);
  return env;
}

async function until(check, label) {
  for (let i = 0; i < 500; i += 1) {
    if (check()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`timed out waiting for: ${label}`);
}

/** Let every pending promise chain finish. */
async function drain() {
  for (let i = 0; i < 50; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

function seedOwnerProfile(db, extra = {}) {
  db.seed("fitness_profiles", { user_id: OWNER, display_name: "Ilya", is_owner: true, is_public: true, settings: {}, ...extra });
}

function ownerData(db) {
  seedOwnerProfile(db, { settings: settings() });
  db.seed("fitness_sessions", toRemote("sessions", session(), { userId: OWNER }).record);
  db.seed("fitness_sets", toRemote("sets", set(), { userId: OWNER }).record);
}

const queued = (storage) => parseOutbox(storage.getItem(HOME.outbox)).map((e) => `${e.table}:${e.id}`).sort();

describe("1. a confirmed writer (unchanged)", () => {
  it("is synced at once and stays synced without signal, even where a missing migration was remembered", async () => {
    const storage = remembered({ [HOME.writer]: OWNER });
    const db = fakeSupabase();
    seedOwnerProfile(db);
    db.offline = true;
    const env = setup({ db, storage, online: false });
    env.store.attach(signedIn(ownerUser));
    assert.equal(env.store.mode(), "synced", "writable at once");
    await drain();
    assert.equal(env.store.mode(), "synced", "no answer does not demote a known writer");
    assert.equal(storage.getItem(HOME.backend), "missing", "nothing learned without an answer");
    db.offline = false;
    env.online = true;
    env.store.recheck();
    await until(() => storage.getItem(HOME.backend) === null, "the background check answered");
    assert.equal(env.store.mode(), "synced");
    assert.deepEqual(env.modes, ["synced"]);
  });
});

describe("1b. a confirmed writer, what never takes the account away", () => {
  it("stays synced with its rows on screen when the check reports a missing schema (PostgREST's cache after a migration)", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    db.interceptors.push((call) => (call.rpc === "fitness_can_write" ? { data: null, error: { code: "PGRST202", message: "Could not find the function" }, status: 404 } : undefined));
    const home = serializeSnapshot(applyUpsert(applyUpsert(emptySnapshot(), "sessions", session()), "sets", set()), OWNER);
    const { store, storage, modes } = setup({ db, storage: memoryStorage({ [HOME.writer]: OWNER, [HOME.snapshot]: home }) });
    store.attach(signedIn(ownerUser, true));
    await until(() => /^schema:/.test(store.getStatus().lastError ?? ""), "the check answered");
    assert.equal(store.mode(), "synced");
    assert.ok(store.getSnapshot().sets[uuid(4)], "the workout stays on screen");
    store.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.deepEqual(queued(storage), [`sets:${uuid(41)}`], "queued for the account");
    assert.equal(storage.getItem(HOME.backend), null, "not remembered as missing");
    assert.deepEqual(modes, ["synced"]);
  });

  it("keeps this device's writer when another account is refused on it", async () => {
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    seedOwnerProfile(db);
    const storage = memoryStorage({ [HOME.writer]: OWNER });
    const friend = setup({ db, storage });
    friend.store.attach(signedIn(friendUser));
    await until(() => friend.store.mode() === "viewer", "the friend reads");
    assert.equal(storage.getItem(HOME.writer), OWNER, "the owner's mark stays");
    friend.store.dispose();
    const gym = fakeSupabase();
    gym.offline = true;
    const owner = setup({ db: gym, storage, online: false });
    owner.store.attach(signedIn(ownerUser));
    assert.equal(owner.store.mode(), "synced", "the owner, back in the gym without signal, writes at once");
  });

  it("an explicit sign-out reads, even without signal", async () => {
    const home = serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session()), OWNER);
    const db = fakeSupabase({ uid: null });
    db.offline = true;
    const { store, storage } = setup({ db, storage: memoryStorage({ [HOME.writer]: OWNER, [HOME.snapshot]: home }), online: false });
    store.attach(signedOut); // the session was removed on sign-out
    await until(() => store.getStatus().lastError !== null, "no answer");
    await drain();
    assert.equal(store.mode(), "viewer");
    assert.equal(store.canWrite(), false);
    store.upsert("sets", set());
    assert.equal(storage.getItem(HOME.outbox), null);
    assert.equal(storage.getItem(LOCAL.snapshot), null);
  });
});

describe("2. signed in, not confirmed here, a missing migration remembered", () => {
  it("shows the sets logged earlier at once, with no loading step, and keeps logging when the check gets no answer", async () => {
    const db = fakeSupabase();
    db.offline = true;
    const { store, storage, modes } = setup({ db, storage: remembered({ [LOCAL.snapshot]: loggedHere() }), online: false });
    store.attach(signedIn(ownerUser, true));
    assert.equal(store.mode(), "local");
    assert.equal(store.getStatus().localReason, "backend-missing");
    assert.equal(store.getStatus().storageProject, "unconfigured");
    assert.equal(store.getSnapshot().sets[uuid(4)].reps, 11, "the set logged earlier is there at once");
    store.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.ok(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.sets[uuid(41)], "saved in this browser");
    await drain();
    assert.ok(db.calls.some((c) => c.rpc === "fitness_can_write"), "asked in the background");
    assert.equal(store.mode(), "local", "no answer: keeps logging here");
    assert.equal(store.getStatus().localReason, "backend-missing");
    assert.match(store.getStatus().lastError, /^offline:/);
    assert.equal(storage.getItem(HOME.backend), "missing");
    assert.equal(storage.getItem(HOME.outbox), null, "nothing queued for upload");
    assert.deepEqual(modes, ["local"], "never loading");
  });

  it("keeps logging on a device with nothing logged yet when the check gets no answer", async () => {
    const db = fakeSupabase();
    db.offline = true;
    const { store, storage, modes } = setup({ db, storage: remembered(), online: false });
    store.attach(signedIn(ownerUser));
    await drain();
    assert.equal(store.mode(), "local");
    assert.equal(store.getStatus().localReason, "backend-missing");
    store.upsert("sessions", session());
    assert.ok(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.sessions[uuid(3)]);
    assert.deepEqual(modes, ["local"]);
  });

  it("stays local when the migration is still missing", async () => {
    const db = fakeSupabase();
    db.interceptors.push(noMigration);
    const { store, storage, modes } = setup({ db, storage: remembered({ [LOCAL.snapshot]: loggedHere() }) });
    store.attach(signedIn(ownerUser));
    await until(() => /^schema:/.test(store.getStatus().lastError ?? ""), "the check answered");
    assert.equal(store.getStatus().localReason, "backend-missing");
    assert.equal(storage.getItem(HOME.backend), "missing");
    store.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.ok(store.getSnapshot().sets[uuid(41)]);
    assert.deepEqual(modes, ["local"]);
  });

  it("adopts the local rows into the outbox exactly once when the account turns out to be a writer", async () => {
    const storage = remembered({ [LOCAL.snapshot]: loggedHere() });
    const db = fakeSupabase();
    seedOwnerProfile(db);
    // The signal drops right after the check: uploads fail, so the queue stays visible.
    db.interceptors.push((call) => (call.op === "upsert" || call.op === "update" ? lost : undefined));
    const first = setup({ db, storage });
    first.store.attach(signedIn(ownerUser, true));
    assert.equal(first.store.mode(), "local");
    first.store.upsert("sets", set({ id: uuid(41), setIndex: 1 })); // logged while the check is on its way
    await until(() => first.store.mode() === "synced" && /^offline:/.test(first.store.getStatus().lastError ?? ""), "synced, upload pending");
    const expected = [`sessions:${uuid(3)}`, `sets:${uuid(4)}`, `sets:${uuid(41)}`];
    assert.deepEqual(queued(storage), expected, "one entry per row logged here");
    assert.equal(first.store.getSnapshot().pending, 3);
    assert.equal(storage.getItem(HOME.backend), null, "the yes clears the memory");
    assert.equal(storage.getItem(HOME.writer), OWNER);
    assert.equal(storage.getItem(LOCAL.snapshot), null, "moved out of the browser-only copy");
    assert.match(first.warnings.join("\n"), /adopted 3 change/);
    assert.deepEqual(first.modes, ["local", "synced"]);

    first.store.dispose(); // reload
    const second = setup({ db, storage });
    second.store.attach(signedIn(ownerUser, true));
    assert.equal(second.store.mode(), "synced", "a confirmed writer now");
    await until(() => /^offline:/.test(second.store.getStatus().lastError ?? ""), "second upload attempt");
    assert.deepEqual(queued(storage), expected, "no duplicates after a second attach");
    assert.doesNotMatch(second.warnings.join("\n"), /adopted/);

    db.interceptors.length = 0;
    await second.store.flush();
    assert.equal(db.tables.fitness_sessions.length, 1);
    assert.deepEqual(db.tables.fitness_sets.map((s) => s.id).sort(), [uuid(4), uuid(41)]);
    assert.deepEqual(queued(storage), []);
    assert.equal(second.store.getSnapshot().pending, 0);
  });

  it("becomes a viewer when the server says no and keeps the local rows for a later adoption", async () => {
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    seedOwnerProfile(db);
    db.interceptors.push((call) => (call.rpc === "fitness_owner_id" ? lost : undefined)); // the signal drops after the no
    const { store, storage, modes } = setup({ db, storage: remembered({ [LOCAL.snapshot]: loggedHere() }) });
    store.attach(signedIn(friendUser));
    assert.equal(store.mode(), "local");
    await until(() => store.mode() === "viewer" && store.getStatus().lastError !== null, "viewer");
    assert.equal(store.canWrite(), false);
    assert.equal(storage.getItem(HOME.backend), null, "a no is an answer too");
    assert.equal(storage.getItem(HOME.writer), null);
    assert.ok(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.sets[uuid(4)], "the rows wait in this browser");
    assert.deepEqual(modes, ["local", "viewer"]);
  });
});

describe("3. signed in, not confirmed here, nothing remembered", () => {
  it("logs in this browser at once when it has rows here, and says offline when the check gets no answer", async () => {
    const db = fakeSupabase();
    db.offline = true;
    const { store, storage, modes } = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }), online: false });
    store.attach(signedIn(ownerUser));
    assert.equal(store.mode(), "local", "logged here before: never read-only while the account is checked");
    assert.equal(store.getStatus().localReason, "checking");
    assert.equal(store.canWrite(), true);
    await until(() => store.getStatus().localReason === "offline", "offline");
    assert.equal(store.getStatus().storageProject, "unconfigured");
    assert.equal(store.getStatus().online, false);
    assert.ok(store.getSnapshot().sets[uuid(4)]);
    store.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.ok(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.sets[uuid(41)]);
    assert.equal(storage.getItem(HOME.backend), null, "no signal says nothing about the migration");
    assert.deepEqual(modes, ["local"]);
  });

  it("stays writable while the check hangs on a weak signal, and the late answer still decides", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    let answer;
    db.interceptors.push((call) => (call.rpc === "fitness_can_write" && !answer ? new Promise((resolve) => (answer = resolve)) : undefined));
    const { store, modes } = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }) });
    store.attach(signedIn(ownerUser, true));
    await until(() => answer !== undefined, "the check is out");
    assert.equal(store.mode(), "local");
    store.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.ok(store.getSnapshot().sets[uuid(41)], "logs while the check hangs");
    answer({ data: true, error: null, status: 200 });
    await until(() => store.mode() === "synced" && store.getSnapshot().pending === 0 && !store.getStatus().flushing, "adopted and uploaded");
    assert.deepEqual(db.tables.fitness_sets.map((s) => s.id).sort(), [uuid(4), uuid(41)]);
    assert.deepEqual(modes, ["local", "synced"]);
  });

  it("does the same when Supabase cannot load or the server fails", async () => {
    const failing = fakeSupabase();
    failing.interceptors.push((call) => (call.rpc ? { data: null, error: { code: "", message: "Service Unavailable" }, status: 503 } : undefined));
    for (const [label, db, kind] of [
      ["no client", null, /^offline:/],
      ["server error", failing, /^server:/],
    ]) {
      const { store } = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }) });
      store.attach(signedIn(ownerUser));
      await until(() => store.getStatus().localReason === "offline", `${label}: local (offline)`);
      assert.equal(store.mode(), "local", label);
      assert.match(store.getStatus().lastError, kind, label);
      assert.equal(store.canWrite(), true, label);
    }
  });

  it("logs in this browser without rows here too when the check gets no answer (the owner on a new phone)", async () => {
    const db = fakeSupabase();
    db.offline = true;
    const { store, storage, modes } = setup({ db, online: false });
    store.attach(signedIn(ownerUser));
    assert.equal(store.mode(), "loading", "nothing logged here: asks first");
    await until(() => store.mode() === "local", "local");
    await drain();
    assert.equal(store.getStatus().localReason, "offline");
    assert.equal(store.canWrite(), true);
    store.upsert("sets", set());
    assert.ok(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.sets[uuid(4)], "kept in this browser only");
    assert.equal(storage.getItem(HOME.outbox), null, "nothing queued for any account");
    assert.equal(storage.getItem(HOME.backend), null);
    assert.deepEqual(modes, ["loading", "local"]);
  });

  it("reads instead when this browser holds someone else's log, or the server already said no in this tab", async () => {
    const mirror = serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session()), OWNER);
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    db.offline = true;
    const first = setup({ db, storage: memoryStorage({ [HOME.snapshot]: mirror }), online: false });
    first.store.attach(signedIn(friendUser));
    await until(() => first.store.mode() === "viewer" && first.store.getStatus().lastError !== null, "viewer");
    await drain();
    assert.equal(first.store.mode(), "viewer");
    assert.equal(first.store.getSnapshot().sessions[uuid(3)], undefined, "another account cached log is cleared until public access is confirmed");

    const answering = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    seedOwnerProfile(answering);
    const second = setup({ db: answering });
    second.store.attach(signedIn(friendUser));
    await until(() => second.store.mode() === "viewer" && !second.store.getStatus().syncing, "viewer after the no");
    answering.offline = true;
    second.store.recheck();
    await until(() => /^offline:/.test(second.store.getStatus().lastError ?? ""), "the re-check got no answer");
    await drain();
    assert.equal(second.store.mode(), "viewer", "a no stands until the server says otherwise");
  });

  it("goes on without the answer when the check hangs, and the late answer still decides", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    let answer;
    db.interceptors.push((call) => (call.rpc === "fitness_can_write" && !answer ? new Promise((resolve) => (answer = resolve)) : undefined));
    const env = { db, storage: memoryStorage(), modes: [] };
    env.store = createFitnessStore({
      getSupabase: async () => db,
      configured: true,
      project: PROJECT,
      storage: env.storage,
      now: () => NOW,
      isOnline: () => true,
      warn: () => {},
      decideTimeoutMs: 40,
    });
    env.store.subscribe(() => {
      if (env.modes.at(-1) !== env.store.mode()) env.modes.push(env.store.mode());
    });
    stores.push(env.store);
    env.store.attach(signedIn(ownerUser, true));
    await eventually(() => env.store.getStatus().localReason === "offline", "local after the timeout");
    assert.match(env.store.getStatus().lastError, /^offline: no answer/);
    env.store.upsert("sessions", session());
    env.store.upsert("sets", set());
    answer({ data: true, error: null, status: 200 });
    await eventually(() => env.store.mode() === "synced" && env.store.getSnapshot().pending === 0, "synced; the set adopted and uploaded");
    assert.equal(db.tables.fitness_sets.length, 1);
    assert.deepEqual(env.modes, ["loading", "local", "synced"]);
  });

  it("remembers a missing migration and forgets it once the migration is applied", async () => {
    const db = fakeSupabase();
    db.interceptors.push(noMigration);
    const storage = memoryStorage();
    const first = setup({ db, storage });
    first.store.attach(signedIn(ownerUser, true));
    await until(() => first.store.mode() === "local", "local");
    assert.equal(first.store.getStatus().localReason, "backend-missing");
    assert.equal(storage.getItem(HOME.backend), "missing", "remembered on this device");
    assert.deepEqual(first.modes, ["loading", "local"]);
    first.store.dispose();

    db.interceptors.length = 0; // the migration is applied
    seedOwnerProfile(db);
    const second = setup({ db, storage });
    second.store.attach(signedIn(ownerUser, true));
    assert.equal(second.store.mode(), "local", "local at once on the next visit");
    await until(() => second.store.mode() === "synced", "synced");
    assert.equal(storage.getItem(HOME.backend), null, "forgotten after the answer");
    assert.equal(storage.getItem(HOME.writer), OWNER);
    assert.deepEqual(second.modes, ["local", "synced"]);
  });
});

describe("4. signed out", () => {
  it("with the memory: local at once, then the viewer once the backend answers", async () => {
    const db = fakeSupabase({ uid: null });
    ownerData(db);
    const { store, storage, modes } = setup({ db, storage: remembered() });
    store.attach(signedOut);
    assert.equal(store.mode(), "local");
    assert.equal(store.getStatus().localReason, "backend-missing");
    assert.equal(store.canWrite(), true);
    await until(() => store.mode() === "viewer" && Object.keys(store.getSnapshot().sets).length === 1, "the owner's rows");
    assert.equal(storage.getItem(HOME.backend), null);
    assert.equal(store.getStatus().ownerId, OWNER);
    assert.deepEqual(modes, ["local", "viewer"]);
  });

  it("with the memory and local rows: becomes signed-out local, never the viewer", async () => {
    const db = fakeSupabase({ uid: null });
    ownerData(db);
    const { store, storage, modes } = setup({ db, storage: remembered({ [LOCAL.snapshot]: loggedHere() }) });
    store.attach(signedOut);
    assert.equal(store.getStatus().localReason, "backend-missing");
    await until(() => store.getStatus().localReason === "signed-out", "signed-out local");
    assert.equal(storage.getItem(HOME.backend), null);
    assert.equal(store.mode(), "local");
    assert.equal(store.getStatus().lastError, null);
    assert.ok(store.getSnapshot().sets[uuid(4)]);
    assert.equal(db.calls.filter((c) => c.table).length, 0, "nothing pulled");
    assert.deepEqual(modes, ["local"]);
  });

  it("drops this tab's missing-migration warning once the backend answers", async () => {
    const db = fakeSupabase();
    db.interceptors.push(noMigration);
    const { store } = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }) });
    store.attach(signedIn(ownerUser));
    await until(() => /^schema:/.test(store.getStatus().lastError ?? ""), "migration missing");
    db.interceptors.length = 0; // applied meanwhile
    db.uid = null;
    seedOwnerProfile(db);
    store.attach(signedOut);
    await until(() => store.getStatus().localReason === "signed-out", "signed-out local");
    assert.equal(store.getStatus().lastError, null);
  });

  it("with the memory and no usable answer: stays local and keeps the memory", async () => {
    for (const [label, prepare] of [
      ["no signal", (db) => (db.offline = true)],
      ["migration still missing", (db) => db.interceptors.push(noMigration)],
    ]) {
      const db = fakeSupabase({ uid: null });
      prepare(db);
      const { store, storage, modes } = setup({ db, storage: remembered() });
      store.attach(signedOut);
      await until(() => store.getStatus().lastError !== null, `${label}: answered`);
      assert.equal(store.mode(), "local", label);
      assert.equal(store.getStatus().localReason, "backend-missing", label);
      assert.equal(storage.getItem(HOME.backend), "missing", label);
      assert.deepEqual(modes, ["local"], label);
    }
  });

  it("asks at most once an hour on page loads while the migration is missing; signing in or out asks at once", async () => {
    const db = fakeSupabase({ uid: null });
    db.interceptors.push(noMigration);
    const storage = memoryStorage();
    const asks = () => db.calls.filter((c) => c.rpc).length;
    const view = async (minutes, auth = signedOut) => {
      const env = setup({ db, storage });
      env.now = NOW + minutes * 60_000;
      env.store.attach(auth);
      await drain();
      env.store.dispose();
      return env.store;
    };
    const first = await view(0);
    assert.equal(first.getStatus().localReason, "backend-missing");
    assert.equal(asks(), 1);
    assert.equal(storage.getItem(HOME.backendAt), at(0), "when it was found missing");
    for (const minutes of [1, 30, 59]) {
      const store = await view(minutes);
      assert.equal(store.mode(), "local", `${minutes} min later`);
      assert.equal(store.getStatus().localReason, "backend-missing");
      assert.equal(store.canWrite(), true);
      assert.equal(asks(), 1, `${minutes} min later: nothing asked`);
    }
    await view(-5); // a clock set back: not "recently"
    assert.equal(asks(), 2);
    await view(10, signedIn(ownerUser));
    assert.equal(db.calls.at(-1).rpc, "fitness_can_write", "signing in asks at once");
    assert.equal(storage.getItem(HOME.backendAt), at(10));

    db.interceptors.length = 0; // the migration is applied
    ownerData(db);
    assert.equal((await view(69)).mode(), "local", "still within the hour of the last 404");
    const later = await view(71);
    assert.equal(later.mode(), "viewer", "an hour on: asked, and the owner's log");
    assert.equal(storage.getItem(HOME.backend), null);
    assert.equal(storage.getItem(HOME.backendAt), null);

    // A sign-out in an open tab is not a page load: it asks even right after a 404.
    const tab = fakeSupabase();
    tab.interceptors.push(noMigration);
    const env = setup({ db: tab, storage: memoryStorage() });
    env.store.attach(signedIn(ownerUser));
    await until(() => env.store.getStatus().localReason === "backend-missing", "found missing signed in");
    tab.interceptors.length = 0;
    tab.uid = null;
    ownerData(tab);
    env.store.attach(signedOut);
    await until(() => env.store.mode() === "viewer", "asked on the sign-out");
    assert.deepEqual(tab.calls.filter((c) => c.rpc).map((c) => c.rpc), ["fitness_can_write", "fitness_owner_id"]);
  });

  it("without the memory: rows here keep it local, else the viewer, and a missing migration is remembered", async () => {
    const withRows = setup({ storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }) });
    withRows.store.attach(signedOut);
    assert.equal(withRows.store.getStatus().localReason, "signed-out", "as before");
    await drain();
    assert.equal(withRows.db.calls.length, 0);

    const db = fakeSupabase({ uid: null });
    db.interceptors.push(noMigration);
    const { store, storage, modes } = setup({ db });
    store.attach(signedOut);
    assert.equal(store.mode(), "viewer");
    await until(() => store.mode() === "local", "local after the missing rpc");
    assert.equal(store.getStatus().localReason, "backend-missing");
    assert.equal(storage.getItem(HOME.backend), "missing");
    assert.deepEqual(modes, ["viewer", "local"]);
  });
});

describe("4b. while the sign-in loads (a weak signal can hold it for a minute)", () => {
  const loading = { user: null, isAdmin: false, loading: true };

  it("a device that remembers a missing migration logs at once", async () => {
    const db = fakeSupabase();
    const { store, modes } = setup({ db, storage: remembered({ [LOCAL.snapshot]: loggedHere() }) });
    store.attach(loading);
    assert.equal(store.mode(), "local");
    assert.equal(store.getStatus().localReason, "backend-missing");
    assert.equal(store.getStatus().provisional, true);
    store.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.ok(store.getSnapshot().sets[uuid(41)]);
    await drain();
    assert.equal(db.calls.length, 0, "nothing asked before auth settles");
    store.attach(signedOut);
    assert.equal(store.getStatus().provisional, false);
    assert.equal(store.mode(), "local");
    assert.deepEqual(modes, ["local"]);
  });

  it("rows logged here keep it writable; the settled sign-in then decides", async () => {
    const db = fakeSupabase({ uid: null });
    const { store, modes } = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }) });
    store.attach(loading);
    assert.equal(store.getStatus().localReason, "checking");
    assert.equal(store.canWrite(), true);
    store.attach(signedOut);
    assert.equal(store.getStatus().localReason, "signed-out");
    assert.deepEqual(modes, ["local"]);
  });

  it("this device's writer with a stored session writes at once and sends nothing until auth vouches for it", async () => {
    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: authSession(ownerUser, NOW + 3_600_000) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedOwnerProfile(db);
    const { store, modes } = setup({ db, storage });
    store.attach(loading);
    assert.equal(store.mode(), "synced");
    assert.equal(store.getStatus().provisional, true, "the note waits for auth");
    store.upsert("bodyweight", weighIn());
    await store.flush();
    await drain();
    assert.deepEqual(db.calls, [], "nothing sent yet");
    assert.deepEqual(queued(storage), [`bodyweight:${uuid(5)}`]);
    store.attach(signedIn(ownerUser, true));
    await until(() => db.tables.fitness_bodyweight.length === 1 && store.getSnapshot().pending === 0, "uploaded once auth settled");
    assert.equal(store.getStatus().provisional, false);
    assert.deepEqual(modes, ["synced"]);
  });

  it("anyone else waits, read-only, as before", () => {
    const { store } = setup({ storage: memoryStorage({ [HOME.writer]: OWNER }) }); // writer, but no stored session
    store.attach(loading);
    assert.equal(store.mode(), "loading");
    assert.equal(store.canWrite(), false);
    assert.equal(store.getStatus().provisional, false);
  });
});

describe("5. Supabase not configured (unchanged)", () => {
  it("stays local, never asks and never writes the memory", async () => {
    const { store, db, storage } = setup({ configured: false });
    assert.equal(store.getStatus().localReason, "unconfigured");
    store.attach(signedIn(ownerUser));
    store.attach(signedOut);
    store.upsert("sets", set());
    await drain();
    assert.equal(store.mode(), "local");
    assert.equal(store.getStatus().localReason, "unconfigured");
    assert.equal(db.calls.length, 0);
    assert.deepEqual([...storage.bag.keys()].filter((k) => k.endsWith(":backend")), []);
  });
});

describe("6. a failing browser storage", () => {
  it("means no memory, never an exception", async () => {
    const db = fakeSupabase();
    db.interceptors.push(noMigration);
    const full = memoryStorage({ [LOCAL.snapshot]: loggedHere() });
    full.fail = true; // setItem throws (quota exceeded)
    const first = setup({ db, storage: full });
    first.store.attach(signedIn(ownerUser));
    await until(() => first.store.getStatus().localReason === "backend-missing", "local (backend-missing)");
    assert.equal(first.store.mode(), "local");
    assert.equal(full.getItem(HOME.backend), null, "could not remember");
    first.store.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.ok(first.store.getSnapshot().sets[uuid(41)], "still logs, in memory");
    first.store.dispose();

    const second = setup({ db, storage: full });
    second.store.attach(signedIn(ownerUser));
    assert.equal(second.store.getStatus().localReason, "checking", "nothing remembered, but rows here: logging while it asks");
    await until(() => second.store.getStatus().localReason === "backend-missing", "local again");

    const refuse = () => {
      throw new Error("SecurityError");
    };
    const blocked = { getItem: refuse, setItem: refuse, removeItem: refuse };
    for (const auth of [signedIn(ownerUser), signedOut]) {
      const { store } = setup({ db, storage: blocked });
      assert.doesNotThrow(() => store.attach(auth));
      await until(() => store.mode() === "local", "local without storage");
      assert.equal(store.getStatus().localReason, "backend-missing");
    }
  });
});

describe("6-hour auto-close", () => {
  it("closes a session left open for more than 6 hours on entering local mode in each new branch", async () => {
    const stale = serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session({ startedAt: at(-7 * 60), updatedAt: at(-7 * 60) })));
    for (const [label, initial, auth] of [
      ["signed in, migration remembered missing", { [HOME.backend]: "missing" }, signedIn(ownerUser)],
      ["signed out, migration remembered missing", { [HOME.backend]: "missing" }, signedOut],
      ["signed in, no answer, rows here", {}, signedIn(ownerUser)],
    ]) {
      const db = fakeSupabase();
      db.offline = true;
      const { store, storage } = setup({ db, storage: memoryStorage({ ...initial, [LOCAL.snapshot]: stale }), online: false });
      store.attach(auth);
      await until(() => store.mode() === "local", `${label}: local`);
      const closed = store.getSnapshot().sessions[uuid(3)];
      assert.equal(closed.status, "auto_closed", label);
      assert.equal(closed.endedAt, at(-60), label);
      assert.equal(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.sessions[uuid(3)].status, "auto_closed", `${label}: saved`);
    }
  });
});

describe("7. a confirmed writer whose session expired, without signal", () => {
  /** Last opened days ago: the access token expired, the refresh token is still stored. */
  const expired = (user) => authSession(user, NOW - 2 * DAY);

  it("stays writable as that account, queues under it, and uploads exactly once after the session refreshes", async () => {
    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: expired(ownerUser) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedOwnerProfile(db);
    db.offline = true;
    const env = setup({ db, storage, online: false });
    const { fire } = browser();
    env.store.start();
    const { store } = env;
    store.attach(signedOut); // supabase-js could not refresh the token, so the site reports nobody
    assert.equal(store.mode(), "synced");
    assert.equal(store.canWrite(), true);
    assert.equal(store.getStatus().userId, OWNER);
    assert.equal(store.getStatus().awaitingSession, true, "the offline note");
    store.upsert("sessions", session());
    store.upsert("sets", set());
    assert.deepEqual(parseOutbox(storage.getItem(HOME.outbox)).map((e) => e.uid), [OWNER, OWNER], "queued under the owner");
    assert.equal(store.getSnapshot().pending, 2, "the pending count");
    env.online = true; // bars on the screen, nothing gets through yet
    await store.flush();
    await store.refresh();
    await drain();
    assert.deepEqual(db.calls, [], "nothing sent without a valid session");
    assert.equal(store.getStatus().lastError, null, "and no failed upload either: it waits");

    db.offline = false; // signal: supabase-js can refresh the token now
    fire("online");
    await eventually(() => store.getSnapshot().pending === 0 && db.tables.fitness_sets.length === 1, "uploaded");
    assert.equal(db.refreshes, 1);
    assert.equal(store.getStatus().awaitingSession, false);
    assert.equal(db.tables.fitness_sets[0].user_id, OWNER);
    store.attach(signedIn(ownerUser, true)); // the site notices the session later (tab shown again)
    await until(() => !store.getStatus().syncing && !store.getStatus().flushing, "settled");
    await drain();
    const uploads = db.calls.filter((c) => c.op === "upsert").flatMap((c) => c.records.map((r) => `${c.table}:${r.id}`));
    assert.deepEqual(uploads.sort(), [`fitness_sessions:${uuid(3)}`, `fitness_sets:${uuid(4)}`], "each row once");
  });

  it("uploads as soon as the site reports the account again", async () => {
    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: expired(ownerUser) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedOwnerProfile(db);
    db.offline = true;
    const { store } = setup({ db, storage });
    store.attach(signedOut);
    store.upsert("bodyweight", weighIn());
    await drain();
    assert.equal(store.getSnapshot().pending, 1);
    db.offline = false; // supabase-js refreshed the token on its own, and the site reports the owner (tab shown again)
    storage.setItem(AUTH, authSession(ownerUser, NOW + 3_600_000));
    store.attach(signedIn(ownerUser));
    await until(() => store.getSnapshot().pending === 0 && db.tables.fitness_bodyweight.length === 1, "uploaded");
    assert.equal(store.getStatus().awaitingSession, false);
  });

  it("picks up a session supabase-js refreshed on its own timer, without any browser event", async () => {
    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: expired(ownerUser) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedOwnerProfile(db);
    db.offline = true;
    const env = setup({ db, storage });
    browser();
    const tick = captureTick(() => env.store.start());
    env.store.attach(signedOut);
    env.store.upsert("bodyweight", weighIn());
    tick(); // the stored token is still expired: nothing to do
    await sleep(RECHECK_WAIT_MS);
    assert.deepEqual(db.calls, []);
    db.offline = false;
    storage.setItem(AUTH, authSession(ownerUser, NOW + 3_600_000)); // auth-js's own refresh timer got through
    tick();
    await eventually(() => db.tables.fitness_bodyweight.length === 1 && env.store.getSnapshot().pending === 0, "uploaded");
    assert.equal(db.refreshes, 0, "the store only read what supabase-js stored");
  });

  it("ends in viewer mode after a sign-out here or in another tab, keeping the queue for the next sign-in", async () => {
    const signedOutHere = memoryStorage({ [HOME.writer]: OWNER }); // auth-js removed the session on sign-out
    const db = fakeSupabase({ authStorage: signedOutHere, authKey: AUTH });
    ownerData(db);
    const first = setup({ db, storage: signedOutHere });
    first.store.attach(signedOut);
    await until(() => first.store.mode() === "viewer" && first.store.getStatus().ownerId === OWNER, "viewer");
    assert.equal(first.store.canWrite(), false);

    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: expired(ownerUser) });
    const offline = fakeSupabase({ authStorage: storage, authKey: AUTH });
    offline.offline = true;
    const env = setup({ db: offline, storage, online: false });
    const { fire } = browser();
    env.store.start();
    env.store.attach(signedOut);
    env.store.upsert("sets", set());
    storage.removeItem(AUTH); // signed out in another tab
    fire("storage", { key: AUTH, newValue: null });
    assert.equal(env.store.mode(), "viewer");
    assert.equal(env.store.canWrite(), false);
    assert.deepEqual(parseOutbox(storage.getItem(HOME.outbox)).map((e) => `${e.uid}:${e.id}`), [`${OWNER}:${uuid(4)}`], "kept for the next sign-in");

    // Signed out on another device: back in signal, the refresh token is refused and auth-js drops the session.
    const revoked = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: expired(ownerUser) });
    const elsewhere = fakeSupabase({ authStorage: revoked, authKey: AUTH });
    elsewhere.offline = true;
    const later = setup({ db: elsewhere, storage: revoked, online: false });
    const events = browser();
    later.store.start();
    later.store.attach(signedOut);
    later.store.upsert("sets", set());
    await drain(); // the first look found no signal: still waiting
    elsewhere.offline = false;
    elsewhere.refreshable = false;
    later.online = true;
    events.fire("online");
    await eventually(() => later.store.mode() === "viewer", "viewer");
    assert.equal(revoked.getItem(AUTH), null);
    assert.equal(parseOutbox(revoked.getItem(HOME.outbox)).length, 1, "kept for the next sign-in");
  });

  it("never lets another account's stored session, or one without a refresh token, write", async () => {
    const noRefresh = JSON.stringify({ ...JSON.parse(expired(ownerUser)), refresh_token: "" });
    for (const [label, initial] of [
      ["another account's session", { [HOME.writer]: OWNER, [AUTH]: expired(friendUser) }],
      ["never confirmed on this device", { [AUTH]: expired(ownerUser) }],
      ["no refresh token", { [HOME.writer]: OWNER, [AUTH]: noRefresh }],
    ]) {
      const storage = memoryStorage(initial);
      const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
      db.offline = true;
      const { store } = setup({ db, storage, online: false });
      store.attach(signedOut);
      assert.equal(store.mode(), "viewer", label);
      store.upsert("sets", set());
      assert.equal(storage.getItem(HOME.outbox), null, `${label}: nothing queued`);
    }
  });

  it("keeps queued rows, removes included, through an auth failure", async () => {
    const storage = memoryStorage({ [AUTH]: authSession(ownerUser, NOW + 3_600_000) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedOwnerProfile(db);
    db.seed("fitness_sets", toRemote("sets", set(), { userId: OWNER }).record);
    const { store } = setup({ db, storage });
    store.attach(signedIn(ownerUser));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing && store.getSnapshot().sets[uuid(4)], "synced");
    const before = db.calls.length;
    // The token expires while the page stays open, with no signal to refresh it (the browser still reports online).
    storage.setItem(AUTH, authSession(ownerUser, NOW - DAY));
    db.offline = true;
    store.upsert("bodyweight", weighIn());
    await store.flush();
    assert.match(store.getStatus().lastError, /^offline:/);
    // Then its refresh token is refused (signed out on another device): supabase-js would fall back to the anon key,
    // and RLS would "remove" nothing without an error.
    db.offline = false;
    db.refreshable = false;
    store.remove("sets", uuid(4));
    await store.flush();
    await store.refresh();
    assert.deepEqual(db.calls.slice(before), [], "nothing sent without the session, not even a pull");
    assert.deepEqual(queued(storage), [`bodyweight:${uuid(5)}`, `sets:${uuid(4)}`]);
    assert.match(store.getStatus().lastError, /^auth:/);
    store.attach(signedOut); // the site sees the session gone
    assert.equal(store.mode(), "viewer");
    await drain();
    assert.deepEqual(queued(storage), [`bodyweight:${uuid(5)}`, `sets:${uuid(4)}`], "kept while signed out");

    storage.setItem(AUTH, authSession(ownerUser, NOW + 3_600_000)); // signed in again
    db.refreshable = true;
    store.attach(signedIn(ownerUser));
    await until(() => store.getSnapshot().pending === 0 && !store.getStatus().flushing && !store.getStatus().syncing, "uploaded");
    assert.equal(db.tables.fitness_bodyweight.length, 1);
    assert.equal(db.tables.fitness_sets.length, 0, "the queued remove reached the server");
    assert.deepEqual(queued(storage), []);
  });
});

describe("8. the connection comes back", () => {
  it("asks again from local (offline) and adopts the rows once the account answers", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    db.offline = true;
    const env = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }), online: false });
    const { fire } = browser();
    env.store.start();
    env.store.attach(signedIn(ownerUser, true));
    await until(() => env.store.getStatus().localReason === "offline", "local (offline)");
    db.offline = false;
    env.online = true;
    fire("online");
    await eventually(() => env.store.getSnapshot().pending === 0 && db.tables.fitness_sets.length === 1, "synced and uploaded");
    assert.equal(env.store.mode(), "synced");
    assert.deepEqual(env.modes, ["local", "synced"], "never a loading step");
  });

  it("asks again from local (backend-missing) once the migration is applied, signed in or out", async () => {
    for (const [auth, settled] of [
      [signedIn(ownerUser), "synced"],
      [signedOut, "viewer"],
    ]) {
      const db = fakeSupabase(auth.user ? {} : { uid: null });
      db.interceptors.push(noMigration);
      const env = setup({ db });
      const { fire } = browser();
      env.store.start();
      env.store.attach(auth);
      await until(() => env.store.getStatus().localReason === "backend-missing", "local (backend-missing)");
      db.interceptors.length = 0; // the migration is applied
      seedOwnerProfile(db);
      fire("visibilitychange"); // the phone is unlocked again
      await eventually(() => env.store.mode() === settled, settled);
      assert.equal(env.modes.at(-2), "local", "straight from local");
    }
  });

  it("asks again from a mode decided without an answer, signed in or out", async () => {
    for (const [auth, answered, path] of [
      [signedIn(ownerUser), (store) => store.mode() === "synced", ["loading", "local", "synced"]],
      [signedOut, (store) => store.getStatus().ownerId === OWNER && Object.keys(store.getSnapshot().sets).length === 1, ["viewer", "local", "viewer"]],
    ]) {
      const db = fakeSupabase(auth.user ? {} : { uid: null });
      ownerData(db);
      db.offline = true;
      const env = setup({ db, online: false });
      const { fire } = browser();
      env.store.start();
      env.store.attach(auth);
      await until(() => env.store.getStatus().localReason === "offline" && env.store.getStatus().lastError !== null, "local without an answer");
      db.offline = false;
      env.online = true;
      fire("online");
      await eventually(() => answered(env.store), auth.user ? "synced" : "the owner's rows");
      assert.deepEqual(env.modes, path);
    }

    // A visitor with the owner's log cached: read-only without an answer, refreshed once it comes.
    const db = fakeSupabase({ uid: null });
    ownerData(db);
    db.offline = true;
    const cached = serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session()), OWNER);
    const env = setup({ db, storage: memoryStorage({ [HOME.snapshot]: cached }), online: false });
    const { fire } = browser();
    env.store.start();
    env.store.attach(signedOut);
    await until(() => env.store.mode() === "viewer" && env.store.getStatus().lastError !== null, "viewer without an answer");
    await drain();
    assert.equal(env.store.mode(), "viewer", "the cached log, read-only");
    db.offline = false;
    env.online = true;
    fire("online");
    await eventually(() => Object.keys(env.store.getSnapshot().sets).length === 1, "the owner's rows");
    assert.deepEqual(env.modes, ["viewer"]);

    // Only the account check got lost: still asked again.
    const lossy = fakeSupabase();
    ownerData(lossy);
    let drops = 1;
    lossy.interceptors.push((call) => (call.rpc === "fitness_can_write" && drops-- > 0 ? lost : undefined));
    const again = setup({ db: lossy });
    const events = browser();
    again.store.start();
    again.store.attach(signedIn(ownerUser));
    await until(() => again.store.getStatus().localReason === "offline", "local without an answer");
    events.fire("online");
    await eventually(() => again.store.mode() === "synced", "synced");
  });

  it("coalesces triggers, waits while the browser is offline, and never repeats on its own", async () => {
    const db = fakeSupabase();
    db.offline = true;
    const env = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }), online: false });
    const { fire } = browser();
    env.store.start();
    env.store.attach(signedIn(ownerUser));
    await until(() => env.store.getStatus().localReason === "offline", "local (offline)");
    const asks = () => db.calls.filter((c) => c.rpc === "fitness_can_write").length;
    fire("visibilitychange"); // the browser still reports offline: nothing
    await sleep(RECHECK_WAIT_MS);
    assert.equal(asks(), 1);
    env.online = true; // bars on the screen, still no data
    fire("online");
    fire("visibilitychange");
    fire("visibilitychange");
    await eventually(() => asks() === 2, "one re-check for the burst");
    await sleep(RECHECK_WAIT_MS);
    assert.equal(asks(), 2, "coalesced, and a failed re-check does not repeat by itself");
    fire("visibilitychange"); // within 10 s of the last re-check: waits for the gap
    await sleep(RECHECK_WAIT_MS);
    assert.equal(asks(), 2);
    assert.equal(env.store.getStatus().localReason, "offline", "still logging here");
  });

  it("never piles a re-check behind a request that is still out", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    db.offline = true;
    const env = setup({ db, storage: memoryStorage({ [LOCAL.snapshot]: loggedHere() }), online: false });
    const { fire } = browser();
    env.store.start();
    env.store.attach(signedIn(ownerUser));
    await until(() => env.store.getStatus().localReason === "offline", "local (offline)");
    let answer;
    // A weak signal: the next check hangs.
    db.interceptors.push((call) => (call.rpc === "fitness_can_write" ? new Promise((resolve) => (answer = resolve)) : undefined));
    env.online = true;
    fire("online");
    await eventually(() => answer !== undefined, "re-check sent");
    const asks = () => db.calls.filter((c) => c.rpc === "fitness_can_write").length;
    env.now += 60_000; // well past the 10 s gap
    fire("online");
    await sleep(RECHECK_WAIT_MS);
    assert.equal(asks(), 2, "no second request next to the hanging one");
    db.interceptors.length = 0;
    db.offline = false;
    answer({ data: true, error: null, status: 200 });
    await eventually(() => env.store.mode() === "synced", "synced once it answers");
  });
});
