/**
 * The outbox flush under refusals (stream 01, plans/fitness/01-database-and-sync.md): a row the server keeps
 * refusing never holds the rest of the queue and leaves it after MAX_TRIES (dead letter, counted, logged); an outage or
 * a missing profile never costs data; sets wait for their session; a pull never takes back a row that was pending when
 * it started; storage trouble never throws; every upload carries the signed-in account's own user_id.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { parseOutbox, serializeOutbox, makeUpsert, storageKeys, toRemote } from "../../src/lib/fitness/store-core.mjs";
import { FRIEND, OWNER, T0, gym, memoryStorage, session, set, settings, uuid, weighIn } from "./store-fixtures.mjs";
import { fakeSupabase } from "./store-fake-supabase.mjs";

const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const code = typeof rest[0] === "object" && rest[0] ? rest[0].code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  return emitWarning.call(this, warning, ...rest);
};
const { createFitnessStore, MAX_TRIES } = await import("../../src/lib/fitness/store.ts");

const PROJECT = "abc.supabase.co";
const HOME = storageKeys(PROJECT);
const NOW = Date.parse("2026-11-10T10:00:00.000Z");
const ownerUser = { id: OWNER, email: "ilya@example.com", user_metadata: { full_name: "Ilya Perepelitsa" } };
const friendUser = { id: FRIEND, email: "friend@example.com", user_metadata: {} };
const signedIn = (user, isAdmin = false) => ({ user, isAdmin, loading: false });
const at = (minutes) => new Date(NOW + minutes * 60_000).toISOString();

const stores = [];
afterEach(() => {
  while (stores.length) stores.pop().dispose();
});

function setup({ db = fakeSupabase(), storage = memoryStorage() } = {}) {
  const env = { db, storage, now: NOW, warnings: [] };
  env.store = createFitnessStore({
    getSupabase: async () => env.db,
    configured: true,
    project: PROJECT,
    storage,
    now: () => env.now,
    isOnline: () => true,
    warn: (...args) => env.warnings.push(args.map(String).join(" ")),
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

function seedOwnerProfile(db) {
  db.seed("fitness_profiles", { user_id: OWNER, display_name: "Ilya", is_owner: true, is_public: true, settings: {} });
}

/** The owner, synced, with every background pull and flush settled. */
async function synced({ db = fakeSupabase(), storage = memoryStorage(), isAdmin = true, profile = true } = {}) {
  if (profile) seedOwnerProfile(db);
  const env = setup({ db, storage });
  env.store.attach(signedIn(ownerUser, isAdmin));
  await until(() => env.store.mode() === "synced" && !env.store.getStatus().syncing && !env.store.getStatus().flushing, "synced");
  return env;
}

/** Flush once more, with the backoff timer out of the way (the next attempt is what the test drives). */
async function flushNow(store) {
  await store.flush();
  await until(() => !store.getStatus().flushing, "flush done");
}

const queued = (storage) => parseOutbox(storage.getItem(HOME.outbox));
const tries = (storage, id) => queued(storage).find((e) => e.id === id)?.tries ?? 0;

/** A gym id another account already uses: the upsert hits that row, and RLS refuses it (42501) every time. */
function collidingGym(db) {
  db.seed("fitness_gyms", { id: uuid(2), user_id: FRIEND, spec: gym() });
}

describe("a row the server keeps refusing", () => {
  it("never holds the other tables, and leaves the outbox after MAX_TRIES refusals: counted, logged, kept here", async () => {
    const db = fakeSupabase();
    collidingGym(db);
    const { store, storage, warnings } = await synced({ db });
    store.upsert("gyms", gym({ updatedAt: at(1) }));
    store.upsert("sessions", session());
    store.upsert("sets", set());
    await flushNow(store);
    assert.equal(db.tables.fitness_sessions.length, 1, "the session went up past the refused gym");
    assert.equal(db.tables.fitness_sets.length, 1, "and its set");
    assert.deepEqual(queued(storage).map((e) => e.id), [uuid(2)], "only the refused row waits");
    assert.equal(tries(storage, uuid(2)), 0, "nothing else of its table went up: not counted (it may be the table)");
    assert.match(store.getStatus().lastError, /^permission:/);

    for (let i = 1; i <= MAX_TRIES; i += 1) {
      store.upsert("gyms", gym({ id: uuid(20 + i), name: `Gym ${i}`, updatedAt: at(1 + i) })); // a gym that goes up
      await flushNow(store);
      if (i < MAX_TRIES) assert.equal(tries(storage, uuid(2)), i, `refusal ${i} counted`);
    }
    assert.deepEqual(queued(storage), [], "dead-lettered: the queue is free");
    assert.equal(store.getSnapshot().pending, 0);
    assert.equal(store.getStatus().rejected, 1, "counted for the note");
    assert.match(store.getStatus().lastError, /^rejected: 1 change/);
    assert.ok(store.getSnapshot().gyms[uuid(2)], "the row stays in this browser");
    const dead = JSON.parse(storage.getItem(HOME.dead));
    assert.equal(dead.length, 1);
    assert.equal(dead[0].entry.id, uuid(2));
    assert.match(dead[0].reason, /refused repeatedly/);
    assert.match(warnings.join("\n"), /gave up uploading 1 change/);
    assert.equal(db.tables.fitness_gyms.filter((g) => g.user_id === OWNER).length, MAX_TRIES);
  });

  it("keeps its count through a reload", async () => {
    const db = fakeSupabase();
    collidingGym(db);
    const storage = memoryStorage();
    const first = await synced({ db, storage });
    first.store.upsert("gyms", gym({ updatedAt: at(1) }));
    for (let i = 1; i <= 2; i += 1) {
      first.store.upsert("gyms", gym({ id: uuid(20 + i), updatedAt: at(1 + i) }));
      await flushNow(first.store);
    }
    assert.equal(tries(storage, uuid(2)), 2);
    first.store.dispose();
    const second = setup({ db, storage });
    second.store.attach(signedIn(ownerUser, true));
    await until(() => second.store.mode() === "synced" && !second.store.getStatus().syncing && !second.store.getStatus().flushing, "synced again");
    for (let i = 3; i <= MAX_TRIES; i += 1) {
      second.store.upsert("gyms", gym({ id: uuid(20 + i), updatedAt: at(1 + i) }));
      await flushNow(second.store);
    }
    assert.deepEqual(queued(storage), []);
    assert.equal(second.store.getStatus().rejected, 1);
  });

  it("starts counting again when the row is changed", async () => {
    const db = fakeSupabase();
    collidingGym(db);
    const { store, storage } = await synced({ db });
    store.upsert("gyms", gym({ updatedAt: at(1) }));
    store.upsert("gyms", gym({ id: uuid(21), updatedAt: at(1) }));
    await flushNow(store);
    assert.equal(tries(storage, uuid(2)), 1);
    store.upsert("gyms", gym({ name: "Renamed", updatedAt: at(2) }));
    assert.equal(tries(storage, uuid(2)), 0, "a new version gets a clean record");
  });
});

describe("refusals that are not about one row", () => {
  it("an outage dead-letters nothing and loses nothing", async () => {
    const db = fakeSupabase();
    const { store, storage } = await synced({ db });
    const down = { data: null, error: { code: "", message: "Service Unavailable" }, status: 503 };
    db.interceptors.push((call) => (call.op === "upsert" ? down : undefined));
    for (let i = 0; i < 3; i += 1) store.upsert("bodyweight", weighIn({ id: uuid(60 + i), updatedAt: at(i) }));
    for (let i = 0; i < MAX_TRIES + 2; i += 1) await flushNow(store);
    assert.equal(queued(storage).length, 3, "all still queued");
    assert.ok(queued(storage).every((e) => !e.tries), "never counted: nothing went through");
    assert.equal(store.getStatus().rejected, 0);
    const upserts = db.calls.filter((c) => c.op === "upsert").length;
    assert.ok(upserts <= (MAX_TRIES + 2) * 4, `bounded probing while down (${upserts} requests)`);
    db.interceptors.length = 0;
    await flushNow(store);
    assert.equal(db.tables.fitness_bodyweight.length, 3);
    assert.deepEqual(queued(storage), []);
  });

  it("a server error on one row is retried, never counted against it", async () => {
    const db = fakeSupabase();
    const { store, storage } = await synced({ db });
    const busy = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" }, status: 500 };
    db.interceptors.push((call) => (call.op === "upsert" && call.records.some((r) => r.id === uuid(60)) ? busy : undefined));
    store.upsert("bodyweight", weighIn({ id: uuid(60) }));
    for (let i = 0; i < MAX_TRIES + 1; i += 1) {
      store.upsert("bodyweight", weighIn({ id: uuid(61 + i), updatedAt: at(i) })); // others go through each time
      await flushNow(store);
    }
    assert.deepEqual(queued(storage).map((e) => e.id), [uuid(60)], "still waiting");
    assert.equal(tries(storage, uuid(60)), 0, "a 5xx is the server's trouble, not the row's");
    db.interceptors.length = 0;
    await flushNow(store);
    assert.deepEqual(queued(storage), []);
  });

  it("a missing profile never holds the log: the profile is created when the database allows it", async () => {
    // The owner's first visit after setup, but is_admin failed in the browser (weak signal): no profile was created.
    const db = fakeSupabase();
    const { store } = await synced({ db, isAdmin: false, profile: false });
    store.upsert("settings", settings({ goal: "strength", updatedAt: at(1) }));
    store.upsert("sessions", session());
    store.upsert("sets", set());
    await flushNow(store);
    assert.equal(db.tables.fitness_sets.length, 1);
    assert.equal(db.tables.fitness_profiles.length, 1, "created on upload: the database decides who may");
    assert.equal(db.tables.fitness_profiles[0].settings.goal, "strength");
    assert.equal(store.getSnapshot().pending, 0);

    // Not an admin, no profile: the settings wait (refused), the rest goes up.
    const strict = fakeSupabase({ writers: [OWNER], admins: [] });
    const env = await synced({ db: strict, isAdmin: false, profile: false });
    env.store.upsert("settings", settings({ goal: "strength", updatedAt: at(1) }));
    env.store.upsert("bodyweight", weighIn());
    await flushNow(env.store);
    assert.equal(strict.tables.fitness_bodyweight.length, 1);
    assert.deepEqual(queued(env.storage).map((e) => e.table), ["settings"]);
    assert.match(env.store.getStatus().lastError, /^permission:/);
  });

  it("a session the server refuses holds its own sets back instead of getting them dropped", async () => {
    const db = fakeSupabase();
    db.seed("fitness_sessions", { ...toRemote("sessions", session(), { userId: FRIEND }).record, user_id: FRIEND });
    const { store, storage } = await synced({ db });
    store.upsert("sessions", session({ updatedAt: at(1) })); // its id is taken by another account: refused (42501)
    store.upsert("sets", set());
    store.upsert("sessions", session({ id: uuid(30) }));
    store.upsert("sets", set({ id: uuid(31), sessionId: uuid(30) }));
    await flushNow(store);
    assert.deepEqual(db.tables.fitness_sets.map((s) => s.id), [uuid(31)], "the other workout went up");
    assert.deepEqual(queued(storage).map((e) => `${e.table}:${e.id}`).sort(), [`sessions:${uuid(3)}`, `sets:${uuid(4)}`]);
    assert.equal(store.getStatus().rejected, 0, "the set was never sent, so never refused");
    assert.equal(db.calls.filter((c) => c.table === "fitness_sets" && c.records?.some((r) => r.id === uuid(4))).length, 0);
  });
});

describe("pending wins", () => {
  it("a pull never takes back a row that was pending when it started, even when it was uploaded meanwhile", async () => {
    const db = fakeSupabase();
    db.seed("fitness_sessions", toRemote("sessions", session(), { userId: OWNER }).record);
    db.seed("fitness_sets", toRemote("sets", set({ reps: 10 }), { userId: OWNER }).record);
    const { store } = await synced({ db });
    // The server's clock runs ahead of the phone's: its copy of the set is newer than the phone's edit.
    db.clock = Date.parse(at(30));
    db.tables.fitness_sets[0].updated_at = db.stamp();
    store.upsert("sets", { ...store.getSnapshot().sets[uuid(4)], reps: 12, updatedAt: at(5) });
    let release;
    const hold = new Promise((resolve) => (release = resolve));
    db.interceptors.push((call) => {
      if (call.table !== "fitness_sets" || call.op !== "select" || release === null) return undefined;
      const old = structuredClone(db.tables.fitness_sets); // what the pull reads before the upload lands
      return hold.then(() => ({ data: old, error: null, count: old.length, status: 200 }));
    });
    const pulling = store.refresh();
    await until(() => db.calls.some((c) => c.table === "fitness_sets" && c.op === "select" && c.since !== undefined), "the pull is out");
    db.interceptors.length = 0;
    await store.flush(); // the edit goes up while the pull is still out
    assert.equal(db.tables.fitness_sets[0].reps, 12);
    release();
    await pulling;
    assert.equal(store.getSnapshot().sets[uuid(4)].reps, 12, "the stale pulled copy did not win");
    await store.refresh();
    assert.equal(store.getSnapshot().sets[uuid(4)].reps, 12);
    assert.equal(store.getSnapshot().sets[uuid(4)].updatedAt, db.tables.fitness_sets[0].updated_at, "the next pull brings the server's copy");
  });
});

describe("storage trouble", () => {
  it("never throws into the page, whatever the row holds", async () => {
    const { store, storage } = await synced();
    const odd = weighIn({ id: uuid(70), extra: 10n }); // BigInt: JSON cannot store it
    assert.doesNotThrow(() => store.upsert("bodyweight", odd));
    assert.match(store.getStatus().lastError, /^storage:/);
    assert.ok(store.getSnapshot().bodyweight[uuid(70)], "still on screen");
    storage.fail = true; // quota exceeded
    assert.doesNotThrow(() => store.upsert("bodyweight", weighIn({ id: uuid(71) })));
    assert.match(store.getStatus().lastError, /^storage:/);
  });
});

describe("whose rows go up", () => {
  it("each account uploads only its own queue, with its own user_id, and never a set into another's session", async () => {
    // One shared browser: the owner's change and a friend's change wait side by side.
    const storage = memoryStorage({
      [HOME.writer]: OWNER,
      [HOME.outbox]: serializeOutbox([
        makeUpsert("sessions", session(), OWNER, T0),
        makeUpsert("bodyweight", weighIn({ id: uuid(80) }), FRIEND, T0),
        makeUpsert("sets", set({ id: uuid(81) }), FRIEND, T0), // the friend's set naming the owner's session
      ]),
    });
    const db = fakeSupabase({ writers: [OWNER, FRIEND] });
    const owner = await synced({ db, storage });
    await flushNow(owner.store);
    assert.deepEqual(db.tables.fitness_sessions.map((s) => s.user_id), [OWNER]);
    assert.equal(db.tables.fitness_bodyweight.length, 0, "the friend's change is not the owner's to send");
    owner.store.dispose();

    db.uid = FRIEND;
    db.seed("fitness_profiles", { user_id: FRIEND, display_name: "Friend", is_owner: false, settings: {} });
    const friend = setup({ db, storage });
    friend.store.attach(signedIn(friendUser));
    await until(() => friend.store.mode() === "synced" && !friend.store.getStatus().syncing && !friend.store.getStatus().flushing, "friend synced");
    await flushNow(friend.store);
    assert.deepEqual(db.tables.fitness_bodyweight.map((b) => b.user_id), [FRIEND]);
    assert.equal(db.tables.fitness_sets.length, 0, "a set cannot join the owner's session (session_id, user_id)");
    assert.equal(friend.store.getStatus().rejected, 1);
    assert.ok(db.calls.filter((c) => c.op === "upsert").every((c) => c.records.every((r) => r.user_id === (c.table === "fitness_sessions" ? OWNER : FRIEND))));
  });
});
