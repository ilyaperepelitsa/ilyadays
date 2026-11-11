/**
 * Ways the browser log used to be lost (review of 2026-11-12), one test per case: the offline gym when the sign-in
 * settles as signed out, a tab that missed another tab's save, a stored log that cannot be read, a session finished on
 * another device, and an adoption cut short by a full storage.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adoptCopies,
  applyUpsert,
  authStorageKey,
  emptySnapshot,
  isUnreadableSnapshot,
  parseOutbox,
  parseSnapshot,
  serializeSnapshot,
  storageKeys,
  toRemote,
} from "../../src/lib/fitness/store-core.mjs";
import { OWNER, authSession, memoryStorage, program, session, set, uuid, weighIn } from "./store-fixtures.mjs";
import { fakeSupabase } from "./store-fake-supabase.mjs";

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
const at = (minutes) => new Date(NOW + minutes * 60_000).toISOString();
const ownerUser = { id: OWNER, email: "o@example.com", user_metadata: {} };
const drain = async () => {
  for (let i = 0; i < 300; i += 1) await new Promise((r) => setImmediate(r));
};
const counts = (s) => Object.fromEntries(["programs", "sessions", "sets", "bodyweight"].map((k) => [k, Object.keys(s[k]).length]));
const stored = (storage, keys) => counts(parseSnapshot(storage.getItem(keys.snapshot)).snapshot);
const seedProfile = (db) => db.seed("fitness_profiles", { user_id: OWNER, display_name: "O", is_owner: true, is_public: true, settings: {} });
const history = () => {
  let snap = applyUpsert(emptySnapshot(), "programs", program());
  snap = applyUpsert(snap, "sessions", session({ status: "finished", endedAt: at(-100) }));
  return applyUpsert(snap, "sets", set());
};
const KEPT = { programs: 1, sessions: 1, sets: 1, bodyweight: 0 };

function synced({ db, storage, online = true }) {
  const store = createFitnessStore({ getSupabase: async () => db, configured: true, project: PROJECT, storage, now: () => NOW, isOnline: () => online, warn: () => {} });
  return store;
}
const local = (storage) => createFitnessStore({ getSupabase: async () => null, configured: false, project: "", storage, now: () => NOW, isOnline: () => true, warn: () => {} });

describe("the offline gym keeps the cached log", () => {
  it("when the sign-in settles from loading to signed out (expired token, no signal)", async () => {
    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: authSession(ownerUser, NOW - 2 * 86_400_000), [HOME.snapshot]: serializeSnapshot(history(), OWNER) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedProfile(db);
    db.offline = true;
    const store = synced({ db, storage, online: false });
    store.attach({ user: null, isAdmin: false, loading: true });
    assert.deepEqual(counts(store.getSnapshot()), KEPT);
    store.attach({ user: null, isAdmin: false, loading: false });
    await drain();
    assert.equal(store.mode(), "synced");
    assert.deepEqual(counts(store.getSnapshot()), KEPT);
    assert.deepEqual(stored(storage, HOME), KEPT);
    store.dispose();
  });

  it("when the site reports signed out in the middle of a workout", async () => {
    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: authSession(ownerUser, NOW + 3_600_000), [HOME.snapshot]: serializeSnapshot(history(), OWNER) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedProfile(db);
    db.offline = true;
    const store = synced({ db, storage, online: false });
    store.attach({ user: ownerUser, isAdmin: true, loading: false });
    await drain();
    storage.setItem(AUTH, authSession(ownerUser, NOW - 1000));
    store.attach({ user: null, isAdmin: false, loading: false });
    await drain();
    assert.equal(store.getStatus().awaitingSession, true);
    assert.deepEqual(counts(store.getSnapshot()), KEPT);
    assert.deepEqual(stored(storage, HOME), KEPT);
    store.dispose();
  });
});

describe("two tabs", () => {
  it("a tab that never got the other tab's storage event does not erase its rows", () => {
    const storage = memoryStorage();
    const a = local(storage);
    const b = local(storage);
    a.upsert("sessions", session());
    a.upsert("sets", set());
    a.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    b.upsert("bodyweight", weighIn());
    assert.deepEqual(stored(storage, LOCAL), { programs: 0, sessions: 1, sets: 2, bodyweight: 1 });
    assert.deepEqual(counts(b.getSnapshot()), { programs: 0, sessions: 1, sets: 2, bodyweight: 1 });
    a.upsert("sets", set({ id: uuid(42), setIndex: 2 }));
    assert.deepEqual(stored(storage, LOCAL), { programs: 0, sessions: 1, sets: 3, bodyweight: 1 });
    a.dispose();
    b.dispose();
  });

  it("a save the browser refused leaves this tab's rows in memory", () => {
    const storage = memoryStorage();
    const a = local(storage);
    a.upsert("sessions", session());
    const real = storage.setItem.bind(storage);
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    a.upsert("sets", set());
    a.upsert("sets", set({ id: uuid(41), setIndex: 1 }));
    assert.equal(Object.keys(a.getSnapshot().sets).length, 2);
    storage.setItem = real;
    a.upsert("bodyweight", weighIn());
    assert.deepEqual(stored(storage, LOCAL), { programs: 0, sessions: 1, sets: 2, bodyweight: 1 });
    a.dispose();
  });
});

describe("a stored log that cannot be read", () => {
  it("is recognised", () => {
    const good = serializeSnapshot(history());
    assert.equal(isUnreadableSnapshot(good), false);
    assert.equal(isUnreadableSnapshot(null), false);
    assert.equal(isUnreadableSnapshot(""), false);
    assert.equal(isUnreadableSnapshot(good.slice(0, -5)), true);
    assert.equal(isUnreadableSnapshot("12"), true);
  });

  it("is kept aside and reported before anything overwrites it", () => {
    const damaged = serializeSnapshot(history()).slice(0, -5);
    const storage = memoryStorage({ [LOCAL.snapshot]: damaged });
    const store = local(storage);
    assert.equal(storage.getItem(LOCAL.corrupt), damaged);
    assert.match(store.getStatus().lastError ?? "", /could not be read/);
    store.dispose();
  });
});

describe("a session finished on another device", () => {
  it("is not overwritten by this device's stale auto-close", async () => {
    const started = at(-7 * 60);
    const cached = session({ startedAt: started, updatedAt: started });
    const storage = memoryStorage({ [HOME.writer]: OWNER, [HOME.snapshot]: serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", cached), OWNER) });
    const db = fakeSupabase();
    seedProfile(db);
    const finished = session({ startedAt: started, status: "finished", endedAt: at(-6 * 60) });
    db.seed("fitness_sessions", { ...toRemote("sessions", finished, { userId: OWNER }).record });
    const store = synced({ db, storage });
    store.attach({ user: ownerUser, isAdmin: true, loading: false });
    await drain();
    await store.flush();
    await drain();
    assert.deepEqual(db.tables.fitness_sessions.map((s) => [s.status, s.ended_at]), [["finished", at(-6 * 60)]]);
    assert.equal(store.getSnapshot().sessions[cached.id].status, "finished");
    store.dispose();
  });

  it("still closes here when the server cannot be asked", async () => {
    const started = at(-7 * 60);
    const cached = session({ startedAt: started, updatedAt: started });
    const storage = memoryStorage({ [HOME.writer]: OWNER, [AUTH]: authSession(ownerUser, NOW + 3_600_000), [HOME.snapshot]: serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", cached), OWNER) });
    const db = fakeSupabase({ authStorage: storage, authKey: AUTH });
    seedProfile(db);
    db.offline = true;
    const store = synced({ db, storage, online: false });
    store.attach({ user: ownerUser, isAdmin: true, loading: false });
    await drain();
    assert.equal(store.getSnapshot().sessions[cached.id].status, "auto_closed");
    store.dispose();
  });
});

describe("adoption cut short by a full storage", () => {
  it("queues the rows on the retry instead of stranding them unsent", () => {
    let snap = applyUpsert(emptySnapshot(), "sessions", session({ status: "finished", endedAt: at(-100) }));
    snap = applyUpsert(snap, "sets", set());
    const storage = memoryStorage({ [LOCAL.snapshot]: serializeSnapshot(snap) });
    const real = storage.setItem.bind(storage);
    let full = true;
    storage.setItem = (k, v) => {
      if (full && k === HOME.snapshot) throw new Error("QuotaExceededError");
      real(k, v);
    };
    const first = adoptCopies(storage, PROJECT, { uid: OWNER, nowIso: at(0) });
    assert.equal(first.error, "QuotaExceededError");
    assert.notEqual(storage.getItem(LOCAL.snapshot), null);
    full = false;
    const retry = adoptCopies(storage, PROJECT, { uid: OWNER, nowIso: at(1) });
    assert.equal(retry.adopted, 2);
    assert.equal(parseOutbox(storage.getItem(HOME.outbox)).length, 2);
    assert.deepEqual(stored(storage, HOME), { programs: 0, sessions: 1, sets: 1, bodyweight: 0 });
  });
});
