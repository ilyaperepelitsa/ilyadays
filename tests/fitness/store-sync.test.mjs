import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULTS_AT,
  applyUpsert,
  emptySnapshot,
  parseOutbox,
  parseSnapshot,
  serializeSnapshot,
  storageKeys,
  toRemote,
} from "../../src/lib/fitness/store-core.mjs";
import { FRIEND, OWNER, memoryStorage, session, set, settings, uuid, weighIn } from "./store-fixtures.mjs";
import { fakeSupabase } from "./store-fake-supabase.mjs";

// store.ts runs through Node's type stripping; hide the one-time "module type not specified" notice it triggers.
const emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const code = typeof rest[0] === "object" && rest[0] ? rest[0].code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  return emitWarning.call(this, warning, ...rest);
};
const { createFitnessStore, ensureProfile, isSyncedStore } = await import("../../src/lib/fitness/store.ts");

const PROJECT = "abc.supabase.co";
const HOME = storageKeys(PROJECT);
const LOCAL = storageKeys("unconfigured");
const NOW = Date.parse("2026-11-10T10:00:00.000Z");
const ownerUser = { id: OWNER, email: "ilya@example.com", user_metadata: { full_name: "Ilya Perepelitsa" } };
const friendUser = { id: FRIEND, email: "friend@example.com", user_metadata: {} };
const signedIn = (user, isAdmin = false) => ({ user, isAdmin, loading: false });
const signedOut = { user: null, isAdmin: false, loading: false };
const at = (minutes) => new Date(NOW + minutes * 60_000).toISOString();

const stores = [];
afterEach(() => {
  while (stores.length) stores.pop().dispose();
});

function setup({ configured = true, db = fakeSupabase(), storage = memoryStorage(), online = true } = {}) {
  const env = { db, storage, online, now: NOW, warnings: [] };
  env.store = createFitnessStore({
    getSupabase: async () => env.db,
    configured,
    project: PROJECT,
    storage,
    now: () => env.now,
    isOnline: () => env.online,
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

/** Let every pending promise chain finish. */
async function drain() {
  for (let i = 0; i < 50; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

function seedOwnerProfile(db, extra = {}) {
  db.seed("fitness_profiles", { user_id: OWNER, display_name: "Ilya", is_owner: true, is_public: true, settings: {}, ...extra });
}

const writes = (db, table) => db.calls.filter((c) => c.table === table && c.op !== "select");

describe("local mode (no Supabase)", () => {
  it("works at once, saves to the unconfigured copy and queues nothing", async () => {
    const { store, db, storage } = setup({ configured: false });
    assert.ok(isSyncedStore(store));
    assert.equal(store.mode(), "local");
    assert.equal(store.canWrite(), true);
    assert.equal(store.getStatus().localReason, "unconfigured");
    assert.equal(store.getSnapshot().settings.updatedAt, DEFAULTS_AT, "default settings bootstrapped");
    store.attach(signedOut);
    store.upsert("sessions", session());
    store.upsert("sets", set());
    assert.equal(Object.keys(store.getSnapshot().sets).length, 1);
    assert.equal(store.getSnapshot().pending, 0);
    const saved = parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot;
    assert.ok(saved.sets[uuid(4)]);
    assert.equal(storage.getItem(LOCAL.outbox), null);
    await store.flush();
    await store.refresh();
    assert.equal(db.calls.length, 0, "never talks to Supabase");
  });

  it("notifies subscribers with a new snapshot object and keeps identity otherwise", () => {
    const { store } = setup({ configured: false });
    let calls = 0;
    const off = store.subscribe(() => (calls += 1));
    const before = store.getSnapshot();
    store.upsert("bodyweight", weighIn());
    assert.ok(calls > 0);
    assert.notEqual(store.getSnapshot(), before);
    assert.equal(store.getSnapshot().sets, before.sets);
    off();
    const n = calls;
    store.upsert("bodyweight", weighIn({ kg: 84, updatedAt: at(1) }));
    assert.equal(calls, n, "unsubscribed");
  });

  it("refuses invalid rows with a status instead of throwing", () => {
    const { store, warnings } = setup({ configured: false });
    store.upsert("sets", { id: "x" });
    store.remove("settings", "settings");
    assert.equal(Object.keys(store.getSnapshot().sets).length, 0);
    assert.match(store.getStatus().lastError, /^invalid:/);
    assert.ok(warnings.length >= 2);
  });
});

describe("mode decision", () => {
  it("is read-only while auth loads", () => {
    const { store, warnings } = setup();
    store.attach({ user: null, isAdmin: false, loading: true });
    assert.equal(store.mode(), "loading");
    assert.equal(store.canWrite(), false);
    store.upsert("sessions", session());
    assert.deepEqual(store.getSnapshot().sessions, {});
    assert.match(warnings.join("\n"), /read-only/);
  });

  it("lets the signed-out owner keep training on rows logged before sign-in", async () => {
    const storage = memoryStorage({ [LOCAL.snapshot]: serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session())) });
    const { store, db } = setup({ storage });
    store.attach(signedOut);
    assert.equal(store.mode(), "local");
    assert.equal(store.getStatus().localReason, "signed-out");
    assert.equal(store.getStatus().storageProject, "unconfigured");
    store.upsert("sets", set());
    assert.ok(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.sets[uuid(4)]);
    await drain();
    assert.equal(db.calls.length, 0);
  });

  it("falls back to local mode when the fitness migration is missing", async () => {
    const db = fakeSupabase();
    db.interceptors.push((call) =>
      call.rpc ? { data: null, error: { code: "PGRST202", message: "Could not find the function" }, status: 404 } : undefined,
    );
    const { store } = setup({ db });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "local", "local after a missing rpc");
    assert.equal(store.getStatus().localReason, "backend-missing");
    assert.match(store.getStatus().lastError, /^schema:/);
    store.attach(signedOut);
    await until(() => store.getStatus().localReason === "backend-missing" && store.mode() === "local", "signed out too");
  });

  it("keeps the tab's decision while the next page's auth provider re-initialises", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const { store } = setup({ db });
    store.attach({ user: null, isAdmin: false, loading: true });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing, "synced");
    const calls = db.calls.length;
    store.attach({ user: null, isAdmin: false, loading: true }); // client-side navigation: a new page mounts
    assert.equal(store.mode(), "synced");
    assert.equal(store.canWrite(), true);
    store.attach({ user: ownerUser, isAdmin: false, loading: true });
    store.attach(signedIn(ownerUser, true));
    await drain();
    assert.equal(db.calls.length, calls, "same account: no new rpc, no re-pull within a minute");
    store.attach(signedOut); // signed out in another tab
    await until(() => store.mode() === "viewer", "viewer after sign-out");
  });

  it("makes a signed-in non-writer a viewer", async () => {
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    seedOwnerProfile(db);
    const { store } = setup({ db });
    store.attach(signedIn(friendUser));
    await until(() => store.mode() === "viewer", "viewer");
    assert.equal(store.canWrite(), false);
    assert.equal(store.getStatus().ownerId, OWNER);
  });
});

describe("synced mode (the owner)", () => {
  it("queues writes and uploads sessions before sets with the owner's user_id", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const { store, storage } = setup({ db });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing, "synced");
    assert.equal(store.getStatus().profile, "present");
    store.upsert("sets", set());
    store.upsert("sessions", session());
    assert.equal(store.getSnapshot().pending, 2);
    assert.equal(parseOutbox(storage.getItem(HOME.outbox)).length, 2);
    await store.flush();
    const order = db.calls.filter((c) => c.op === "upsert").map((c) => c.table);
    assert.deepEqual(order, ["fitness_sessions", "fitness_sets"]);
    assert.equal(db.tables.fitness_sets[0].user_id, OWNER);
    assert.equal(db.tables.fitness_sets[0].kg, 42.5);
    assert.equal(store.getSnapshot().pending, 0);
    assert.deepEqual(parseOutbox(storage.getItem(HOME.outbox)), []);
    assert.equal(store.getStatus().lastError, null);
    assert.ok(store.getSnapshot().syncedAt);
    assert.equal(storage.getItem(HOME.writer), OWNER, "remembered as a writer on this device");
  });

  it("uploads removes after upserts, by id and for the signed-in user", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const { store } = setup({ db });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing, "synced");
    store.upsert("sessions", session());
    store.upsert("sets", set());
    await store.flush();
    store.remove("sets", uuid(4));
    store.upsert("bodyweight", weighIn());
    await store.flush();
    const ops = db.calls.filter((c) => c.op === "upsert" || c.op === "delete").map((c) => `${c.op}:${c.table}`);
    assert.deepEqual(ops.slice(-2), ["upsert:fitness_bodyweight", "delete:fitness_sets"]);
    assert.equal(db.tables.fitness_sets.length, 0);
    assert.equal(store.getSnapshot().pending, 0);
  });

  it("adopts what was logged before Supabase on the first signed-in visit", async () => {
    let local = emptySnapshot();
    local = applyUpsert(local, "sessions", session());
    local = applyUpsert(local, "sets", set());
    local = applyUpsert(local, "settings", settings({ goal: "strength", updatedAt: at(-60) }));
    const storage = memoryStorage({ [LOCAL.snapshot]: serializeSnapshot(local) });
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const { store, warnings } = setup({ db, storage });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && store.getSnapshot().pending === 0 && !store.getStatus().flushing, "adopted and flushed");
    assert.equal(db.tables.fitness_sessions.length, 1);
    assert.equal(db.tables.fitness_sets.length, 1);
    assert.equal(db.tables.fitness_profiles[0].settings.goal, "strength", "settings go to fitness_profiles.settings");
    assert.equal(writes(db, "fitness_profiles")[0].op, "update", "never an upsert that could create a non-owner profile");
    assert.equal(storage.getItem(LOCAL.snapshot), null, "the browser-only copy is cleared");
    assert.ok(storage.getItem(LOCAL.adopted), "and kept as a backup");
    assert.match(warnings.join("\n"), /adopted 3 change/);
    assert.equal(store.getSnapshot().sets[uuid(4)].reps, 11);
  });

  it("adopts every other copy once when the account is confirmed: the browser-only one and an earlier project's", async () => {
    const OLD = storageKeys("old.supabase.co");
    const oldOwner = uuid(900); // the same person, another user id in the earlier project
    let earlier = applyUpsert(emptySnapshot(), "sessions", session({ id: uuid(30), dayKey: "B" }));
    earlier = applyUpsert(earlier, "sets", set({ id: uuid(31), sessionId: uuid(30) }));
    const mirror = serializeSnapshot(applyUpsert(emptySnapshot(), "bodyweight", weighIn({ id: uuid(32) })), uuid(901));
    const storage = memoryStorage({
      [LOCAL.snapshot]: serializeSnapshot(applyUpsert(applyUpsert(emptySnapshot(), "sessions", session()), "sets", set())),
      [OLD.snapshot]: serializeSnapshot(earlier, oldOwner),
      [OLD.writer]: oldOwner,
      "ilyadays-fitness:visited.supabase.co:snapshot": mirror, // a visitor's copy of someone else's log
    });
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const first = setup({ db, storage });
    first.store.attach(signedIn(ownerUser, true));
    await until(() => first.store.mode() === "synced" && first.store.getSnapshot().pending === 0 && !first.store.getStatus().flushing, "adopted and uploaded");
    assert.deepEqual(db.tables.fitness_sessions.map((s) => s.id).sort(), [uuid(3), uuid(30)]);
    assert.deepEqual(db.tables.fitness_sets.map((s) => s.id).sort(), [uuid(31), uuid(4)].sort());
    assert.ok(db.tables.fitness_sets.every((s) => s.user_id === OWNER));
    assert.equal(db.tables.fitness_bodyweight.length, 0, "never a visitor's copy");
    assert.equal(storage.getItem(OLD.snapshot), null);
    assert.ok(storage.getItem(OLD.adopted));
    assert.equal(storage.getItem("ilyadays-fitness:visited.supabase.co:snapshot"), mirror);
    first.store.dispose();

    const second = setup({ db, storage }); // reload: nothing is queued or uploaded twice
    second.store.attach(signedIn(ownerUser, true));
    await until(() => second.store.mode() === "synced" && !second.store.getStatus().syncing && !second.store.getStatus().flushing, "synced");
    const uploads = db.calls.filter((c) => c.op === "upsert").flatMap((c) => c.records.map((r) => `${c.table}:${r.id}`));
    assert.equal(uploads.length, new Set(uploads).size, "each row uploaded once");
    assert.equal(second.warnings.join("\n").includes("adopted"), false);
  });

  it("creates the owner profile for the admin and uploads settings into it", async () => {
    const db = fakeSupabase();
    const { store } = setup({ db });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing, "synced");
    const profile = db.tables.fitness_profiles[0];
    assert.equal(profile.user_id, OWNER);
    assert.equal(profile.is_owner, true);
    assert.equal(profile.display_name, "Ilya Perepelitsa");
    assert.equal(store.getStatus().profile, "present");
    store.upsert("settings", settings({ goal: "hypertrophy", updatedAt: at(1) }));
    await store.flush();
    assert.equal(db.tables.fitness_profiles[0].settings.goal, "hypertrophy");
  });

  it("makes the admin the owner on a later try when the owner check failed on the first sign-in", async () => {
    const db = fakeSupabase();
    let once = 1;
    db.interceptors.push((call) =>
      call.rpc === "fitness_owner_id" && once-- > 0 ? { data: null, error: { code: "", message: "Service Unavailable" }, status: 503 } : undefined,
    );
    const { store } = setup({ db });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing, "synced");
    assert.equal(db.tables.fitness_profiles.length, 0, "no profile from a check without an answer");
    assert.equal(store.getStatus().profile, "missing", "the note offers to create it");
    store.upsert("settings", settings({ goal: "hypertrophy", updatedAt: at(1) }));
    await store.flush();
    assert.equal(db.tables.fitness_profiles.length, 1);
    assert.equal(db.tables.fitness_profiles[0].is_owner, true, "the owner, created with the settings");
    assert.equal(db.tables.fitness_profiles[0].settings.goal, "hypertrophy");
    assert.equal(store.getStatus().profile, "present");
  });

  it("bootstraps default settings without uploading them", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const { store } = setup({ db });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing, "synced");
    assert.equal(store.getSnapshot().settings.updatedAt, DEFAULTS_AT);
    assert.equal(store.getSnapshot().pending, 0);
    await store.flush();
    assert.equal(writes(db, "fitness_profiles").length, 0);
  });

  it("takes newer server rows and keeps pending local edits", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    db.seed("fitness_sessions", toRemote("sessions", session(), { userId: OWNER }).record);
    db.seed("fitness_sets", toRemote("sets", set({ id: uuid(41), reps: 10 }), { userId: OWNER }).record);
    db.seed("fitness_sets", toRemote("sets", set({ id: uuid(42), reps: 10 }), { userId: OWNER }).record);
    const { store } = setup({ db });
    store.attach(signedIn(ownerUser, true));
    await until(() => store.mode() === "synced" && Object.keys(store.getSnapshot().sets).length === 2, "pulled");
    // Offline edit of 41 while another device changed 42.
    const env = stores.at(-1);
    void env;
    db.offline = true;
    store.upsert("sets", { ...store.getSnapshot().sets[uuid(41)], reps: 12, updatedAt: at(5) });
    await store.flush();
    db.offline = false;
    db.tables.fitness_sets.find((s) => s.id === uuid(42)).reps = 9;
    db.tables.fitness_sets.find((s) => s.id === uuid(42)).updated_at = db.stamp();
    db.tables.fitness_sets.find((s) => s.id === uuid(41)).updated_at = db.stamp(); // newer server copy of a pending row
    await store.refresh();
    assert.equal(store.getSnapshot().sets[uuid(42)].reps, 9, "newer server row wins");
    assert.equal(db.tables.fitness_sets.find((s) => s.id === uuid(41)).reps, 12, "the pending edit was uploaded after the pull");
    assert.equal(store.getSnapshot().sets[uuid(41)].reps, 12);
    assert.equal(store.getSnapshot().pending, 0);
  });

  it("pulls incrementally after the first full pull", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const env = setup({ db });
    env.store.attach(signedIn(ownerUser, true));
    await until(() => env.store.mode() === "synced" && !env.store.getStatus().syncing, "synced");
    const firstSince = db.calls.filter((c) => c.table === "fitness_sets" && c.op === "select").map((c) => c.since);
    assert.deepEqual(firstSince, [undefined]);
    await env.store.refresh();
    const second = db.calls.filter((c) => c.table === "fitness_sets" && c.op === "select").at(-1);
    assert.ok(second.since, "second pull asks only for rows changed since the cursor");
    env.now += 25 * 3_600_000;
    await env.store.refresh();
    assert.equal(db.calls.filter((c) => c.table === "fitness_sets" && c.op === "select").at(-1).since, undefined, "full pull once a day");
  });

  it("auto-closes a session left open for more than 6 hours and uploads it", async () => {
    const db = fakeSupabase();
    seedOwnerProfile(db);
    const env = setup({ db });
    env.store.attach(signedIn(ownerUser, true));
    await until(() => env.store.mode() === "synced" && !env.store.getStatus().syncing, "synced");
    env.store.upsert("sessions", session({ startedAt: at(-7 * 60), updatedAt: at(-7 * 60) }));
    const closed = env.store.closeStaleSessions();
    assert.equal(closed.length, 1);
    const s = env.store.getSnapshot().sessions[uuid(3)];
    assert.equal(s.status, "auto_closed");
    assert.equal(s.endedAt, at(-60));
    await env.store.flush();
    assert.equal(db.tables.fitness_sessions[0].status, "auto_closed");
    assert.equal(db.tables.fitness_sessions[0].ended_at, at(-60));
    assert.deepEqual(env.store.closeStaleSessions(), []);
  });
});

describe("failures never lose data", () => {
  async function synced(db = fakeSupabase()) {
    seedOwnerProfile(db);
    const env = setup({ db });
    env.store.attach(signedIn(ownerUser, true));
    await until(() => env.store.mode() === "synced" && !env.store.getStatus().syncing, "synced");
    return env;
  }

  it("drops only the row the database refuses", async () => {
    const { store, db } = await synced();
    store.upsert("sessions", session());
    store.upsert("sets", set({ id: uuid(41) }));
    store.upsert("sets", set({ id: uuid(42), sessionId: uuid(99) })); // its session never existed: FK violation
    store.upsert("sets", set({ id: uuid(43) }));
    await store.flush();
    assert.deepEqual(db.tables.fitness_sets.map((s) => s.id).sort(), [uuid(41), uuid(43)]);
    assert.equal(store.getStatus().rejected, 1);
    assert.match(store.getStatus().lastError, /^rejected:/);
    assert.equal(store.getSnapshot().pending, 0);
    assert.ok(store.getSnapshot().sets[uuid(42)], "the refused row stays in this browser");
  });

  it("keeps rows with non-UUID ids local and says so", async () => {
    const { store, db, warnings } = await synced();
    store.upsert("gyms", { id: "home-gym", name: "Home", available: [], missing: [], preferred: {}, updatedAt: at(1) });
    await store.flush();
    assert.equal(db.tables.fitness_gyms.length, 0);
    assert.ok(store.getSnapshot().gyms["home-gym"]);
    assert.match(warnings.join("\n"), /not uploading gyms home-gym: id/);
  });

  it("keeps the queue on permission errors and backs off", async () => {
    const { store, db } = await synced();
    db.interceptors.push((call) =>
      call.op === "upsert" ? { data: null, error: { code: "42501", message: "new row violates row-level security policy" }, status: 403 } : undefined,
    );
    store.upsert("sessions", session());
    await store.flush();
    assert.equal(store.getSnapshot().pending, 1);
    assert.match(store.getStatus().lastError, /^permission:/);
    db.interceptors.length = 0;
    await store.flush();
    assert.equal(store.getSnapshot().pending, 0);
    assert.equal(store.getStatus().lastError, null);
  });

  it("logs offline for a known writer and uploads when the network returns", async () => {
    const storage = memoryStorage({ [HOME.writer]: OWNER });
    const db = fakeSupabase();
    seedOwnerProfile(db);
    db.offline = true;
    const env = setup({ db, storage, online: false });
    env.store.attach(signedIn(ownerUser, false));
    assert.equal(env.store.mode(), "synced", "writable at once on a device that was confirmed before");
    await drain();
    assert.equal(env.store.mode(), "synced", "an unreachable rpc does not demote a known writer");
    assert.equal(env.store.getStatus().online, false);
    env.store.upsert("sessions", session());
    env.store.upsert("sets", set());
    const calls = db.calls.length;
    await env.store.flush();
    assert.equal(db.calls.length, calls, "no request while the browser is offline");
    assert.equal(parseOutbox(storage.getItem(HOME.outbox)).length, 2, "the queue survives a reload");
    env.online = true;
    db.offline = false;
    await env.store.flush();
    assert.equal(db.tables.fitness_sets.length, 1);
    assert.equal(env.store.getSnapshot().pending, 0);
    assert.equal(env.store.getStatus().online, true);
  });

  it("demotes a remembered writer the server no longer accepts", async () => {
    const storage = memoryStorage({ [HOME.writer]: FRIEND });
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    seedOwnerProfile(db);
    const { store } = setup({ db, storage });
    store.attach(signedIn(friendUser));
    assert.equal(store.mode(), "synced");
    await until(() => store.mode() === "viewer", "viewer after the rpc said no");
    assert.equal(storage.getItem(HOME.writer), null);
  });

  it("does not show another account's cached rows as yours", async () => {
    const ownersCopy = applyUpsert(emptySnapshot(), "sessions", session());
    const storage = memoryStorage({ [HOME.snapshot]: serializeSnapshot(ownersCopy, OWNER) });
    const db = fakeSupabase({ uid: FRIEND, writers: [FRIEND], admins: [] });
    seedOwnerProfile(db);
    db.seed("fitness_profiles", { user_id: FRIEND, display_name: "Friend", is_owner: false, settings: {} });
    const { store } = setup({ db, storage });
    store.attach(signedIn(friendUser));
    await until(() => store.mode() === "synced" && !store.getStatus().syncing, "friend synced");
    assert.deepEqual(store.getSnapshot().sessions, {});
    assert.equal(parseSnapshot(storage.getItem(HOME.snapshot)).user, FRIEND);
  });
});

describe("viewer mode (visitors)", () => {
  function ownerData(db) {
    seedOwnerProfile(db, { settings: settings() });
    db.seed("fitness_sessions", toRemote("sessions", session(), { userId: OWNER }).record);
    db.seed("fitness_sets", toRemote("sets", set(), { userId: OWNER }).record);
  }

  it("mirrors the owner's rows read-only and follows live updates", async () => {
    const db = fakeSupabase({ uid: null });
    ownerData(db);
    const { store, storage, warnings } = setup({ db });
    store.attach(signedOut);
    await until(() => Object.keys(store.getSnapshot().sets).length === 1, "pulled the owner's set");
    assert.equal(store.mode(), "viewer");
    assert.equal(store.canWrite(), false);
    assert.equal(store.getSnapshot().settings.goal, "recomp");
    assert.equal(parseSnapshot(storage.getItem(HOME.snapshot)).user, OWNER, "cached for the next visit");
    store.upsert("sets", set({ id: uuid(49) }));
    assert.equal(store.getSnapshot().sets[uuid(49)], undefined);
    assert.match(warnings.join("\n"), /viewer mode is read-only/);
    const channel = db.channels.at(-1);
    assert.deepEqual(channel.bindings.map((b) => [b.filter.table, b.filter.filter]), [
      ["fitness_sessions", `user_id=eq.${OWNER}`],
      ["fitness_sets", `user_id=eq.${OWNER}`],
    ]);
    const live = { ...toRemote("sets", set({ id: uuid(48), setIndex: 1 }), { userId: OWNER }).record, updated_at: at(3) };
    db.emit("fitness_sets", "INSERT", live);
    assert.ok(store.getSnapshot().sets[uuid(48)], "live insert");
    db.emit("fitness_sets", "DELETE", {}, { id: uuid(48) });
    assert.equal(store.getSnapshot().sets[uuid(48)], undefined, "live delete");
    assert.equal(writes(db, "fitness_sets").length, 0, "a viewer never writes");
  });

  it("drops rows the owner deleted on the next full pull", async () => {
    const db = fakeSupabase({ uid: null });
    ownerData(db);
    const env = setup({ db });
    env.store.attach(signedOut);
    await until(() => Object.keys(env.store.getSnapshot().sets).length === 1, "pulled");
    db.tables.fitness_sets.length = 0;
    await env.store.refresh();
    assert.equal(Object.keys(env.store.getSnapshot().sets).length, 1, "an incremental pull cannot see deletions");
    env.now += 25 * 3_600_000;
    await env.store.refresh();
    assert.deepEqual(env.store.getSnapshot().sets, {});
  });

  it("shows nothing before the owner has a profile", async () => {
    const storage = memoryStorage({ [HOME.snapshot]: serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session()), OWNER) });
    const db = fakeSupabase({ uid: null, ownerId: null });
    const { store } = setup({ db, storage });
    store.attach(signedOut);
    await until(() => Object.keys(store.getSnapshot().sessions).length === 0, "emptied");
    assert.equal(store.getStatus().ownerId, null);
    assert.equal(store.mode(), "viewer");
  });

  it("lets the admin create the profile from viewer mode, then syncs", async () => {
    const db = fakeSupabase();
    db.interceptors.push((call) => (call.rpc === "fitness_can_write" && !db.tables.fitness_profiles.length ? { data: false, error: null, status: 200 } : undefined));
    const { store } = setup({ db });
    store.attach(signedIn(ownerUser, false));
    await until(() => store.mode() === "viewer", "viewer while can_write is false");
    const result = await ensureProfile(store, "Ilya");
    assert.deepEqual(result, { ok: true, created: true, isOwner: true });
    await until(() => store.mode() === "synced", "synced after the profile exists");
    assert.equal(db.tables.fitness_profiles[0].display_name, "Ilya");
  });
});

describe("ensureProfile with a client", () => {
  it("creates the owner profile once and reports existing ones", async () => {
    const db = fakeSupabase();
    assert.deepEqual(await ensureProfile(db, "Ilya"), { ok: true, created: true, isOwner: true });
    assert.deepEqual(await ensureProfile(db, "Ilya"), { ok: true, created: false, isOwner: true });
  });

  it("creates nothing while the owner check gets no answer, so the admin's first profile is never a non-owner", async () => {
    for (const answer of [
      { data: null, error: { code: "", message: "TypeError: Failed to fetch" }, status: 0 },
      { data: null, error: { code: "", message: "Service Unavailable" }, status: 503 },
    ]) {
      const db = fakeSupabase();
      let once = 1;
      db.interceptors.push((call) => (call.rpc === "fitness_owner_id" && once-- > 0 ? answer : undefined));
      const first = await ensureProfile(db, "Ilya");
      assert.equal(first.ok, false, answer.error.message);
      assert.match(first.error, answer.status ? /^server:/ : /^offline:/);
      assert.equal(db.tables.fitness_profiles.length, 0, "nothing created");
      assert.deepEqual(await ensureProfile(db, "Ilya"), { ok: true, created: true, isOwner: true }, "the next try makes the owner");
    }
  });

  it("joins as a non-owner when someone else owns the data, and fails closed for non-admins", async () => {
    const db = fakeSupabase({ uid: FRIEND, admins: [FRIEND] });
    seedOwnerProfile(db);
    assert.deepEqual(await ensureProfile(db, "Friend"), { ok: true, created: true, isOwner: false });
    const stranger = fakeSupabase({ uid: uuid(77), writers: [], admins: [] });
    const result = await ensureProfile(stranger, "Stranger");
    assert.equal(result.ok, false);
    assert.match(result.error, /^permission:/);
  });
});

describe("browser events", () => {
  it("reloads another tab's saved copy and removes its listeners on stop", async () => {
    const listeners = new Map();
    const target = () => ({
      addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
      removeEventListener: (name, fn) => listeners.set(name, (listeners.get(name) ?? []).filter((f) => f !== fn)),
    });
    globalThis.window = target();
    globalThis.document = { ...target(), visibilityState: "visible" };
    try {
      const { store } = setup({ configured: false });
      const stop = store.start();
      const stopAgain = store.start();
      assert.equal(listeners.get("storage").length, 1, "reference-counted: one set of listeners");
      const other = applyUpsert(store.getSnapshot(), "bodyweight", weighIn());
      for (const fn of listeners.get("storage")) fn({ key: LOCAL.snapshot, newValue: serializeSnapshot(other) });
      assert.ok(store.getSnapshot().bodyweight[uuid(5)]);
      for (const fn of listeners.get("offline")) fn();
      assert.equal(store.getStatus().online, false);
      for (const fn of listeners.get("online")) fn();
      assert.equal(store.getStatus().online, true);
      stop();
      assert.equal(listeners.get("storage").length, 1);
      stopAgain();
      assert.equal(listeners.get("storage").length, 0);
      assert.equal(listeners.get("visibilitychange").length, 0);
    } finally {
      delete globalThis.window;
      delete globalThis.document;
    }
  });
});


describe('self-service profiles and isolation', () => {
  it('registers a private own profile and awaits the private pull without adopting local or owner-viewer data', async () => {
    const local = applyUpsert(emptySnapshot(), 'bodyweight', weighIn({ id: uuid(90), kg: 90 }));
    const storage = memoryStorage({ [LOCAL.snapshot]: serializeSnapshot(local, null) });
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    seedOwnerProfile(db);
    db.seed('fitness_bodyweight', toRemote('bodyweight', weighIn(), { userId: OWNER }).record);
    const { store } = setup({ db, storage });
    store.attach(signedIn(friendUser));
    await until(() => store.mode() === 'viewer', 'profile missing');
    const result = await store.registerProfile('My own training');
    assert.equal(result.ok, true);
    assert.equal(result.created, true);
    assert.equal(result.isOwner, false);
    assert.equal(store.mode(), 'synced');
    assert.equal(store.getStatus().userId, FRIEND);
    assert.deepEqual(store.getStatus().profileDetails, { displayName: 'My own training', isPublic: false, isOwner: false });
    assert.deepEqual(store.getSnapshot().bodyweight, {});
    assert.deepEqual(store.getSnapshot().measurements, {});
    assert.ok(parseSnapshot(storage.getItem(LOCAL.snapshot)).snapshot.bodyweight[uuid(90)], 'original local log remains in its own copy');
    assert.equal(db.tables.fitness_bodyweight.filter((r) => r.user_id === FRIEND).length, 0);
    assert.equal(db.tables.fitness_profiles.find((p) => p.user_id === OWNER).is_owner, true);
    const measurement = { id: uuid(91), at: at(0), values: { waist: 84, 'left-biceps': 32 }, updatedAt: at(0) };
    store.upsert('measurements', measurement);
    await store.flush();
    assert.equal(db.tables.fitness_measurements[0].user_id, FRIEND);
    assert.deepEqual(db.tables.fitness_measurements[0].values, measurement.values);
    const update = await store.updateProfile({ displayName: 'My renamed training', isPublic: true });
    assert.equal(update.ok, true);
    assert.deepEqual(store.getStatus().profileDetails, { displayName: 'My renamed training', isPublic: true, isOwner: false });
  });

  it('rejects a registration result if another account signs in while it is pending', async () => {
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [OWNER] });
    seedOwnerProfile(db);
    const { store } = setup({ db });
    store.attach(signedIn(friendUser));
    await until(() => store.mode() === 'viewer', 'viewer');
    let release;
    db.interceptors.push((call) => call.rpc === 'fitness_register_profile' ? new Promise((resolve) => { release = resolve; }) : undefined);
    const pending = store.registerProfile('Friend');
    await until(() => Boolean(release), 'registration request');
    db.uid = OWNER;
    store.attach(signedIn(ownerUser, true));
    release({ data: { created: true, display_name: 'Friend', is_public: false, is_owner: false }, error: null, status: 200 });
    const result = await pending;
    assert.equal(result.ok, false);
    assert.match(result.error, /account changed/);
    await until(() => store.mode() === 'synced', 'owner account');
    assert.equal(store.getStatus().userId, OWNER);
    assert.notEqual(store.getStatus().profileDetails?.displayName, 'Friend');
  });

  it('clears private data immediately on sign-out and removes a revoked public owner mirror on refresh', async () => {
    const db = fakeSupabase({ uid: FRIEND, writers: [], admins: [] });
    seedOwnerProfile(db);
    db.seed('fitness_profiles', { user_id: FRIEND, display_name: 'Private', is_owner: false, is_public: false, settings: {} });
    db.seed('fitness_bodyweight', toRemote('bodyweight', weighIn({ id: uuid(92) }), { userId: FRIEND }).record);
    db.seed('fitness_bodyweight', toRemote('bodyweight', weighIn(), { userId: OWNER }).record);
    const { store } = setup({ db });
    store.attach(signedIn(friendUser));
    await until(() => Boolean(store.getSnapshot().bodyweight[uuid(92)]), 'private own rows');
    db.uid = null;
    store.attach(signedOut);
    assert.equal(store.getSnapshot().bodyweight[uuid(92)], undefined, 'private row cleared before network response');
    await until(() => Boolean(store.getSnapshot().bodyweight[uuid(5)]), 'public owner rows');
    db.tables.fitness_profiles.find((p) => p.user_id === OWNER).is_public = false;
    await store.refresh();
    assert.deepEqual(store.getSnapshot().bodyweight, {}, 'now-private public mirror is removed');
  });
});
