import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  DEFAULTS_AT,
  ON_CONFLICT,
  REMOTE_TABLE,
  ROW_TABLES,
  SNAPSHOT_KEY,
  TABLES,
  adoptCopies,
  adoptLocalData,
  appendOutbox,
  applyRemove,
  applyUpsert,
  authStorageKey,
  clipText,
  closeStaleSessions,
  compactOutbox,
  defaultSettings,
  deriveActiveProgramId,
  emptySnapshot,
  fromRemote,
  hasLocalData,
  isOutboxEntry,
  isRow,
  makeRemove,
  makeUpsert,
  mergeRemote,
  normalizeIso,
  overlayOutbox,
  parseAuthSession,
  parseOutbox,
  parseSnapshot,
  remoteProblem,
  rowId,
  serializeOutbox,
  serializeSnapshot,
  storageKeys,
  storedProjects,
  toRemote,
} from "../../src/lib/fitness/store-core.mjs";
import {
  FRIEND,
  OWNER,
  ROWS,
  T0,
  T1,
  T2,
  adjustment,
  deepFreeze,
  gym,
  memoryStorage,
  program,
  session,
  set,
  settings,
  state,
  uuid,
  weighIn,
} from "./store-fixtures.mjs";

/** A snapshot with one row in every table. */
function fullSnapshot() {
  let s = emptySnapshot();
  for (const table of TABLES) s = applyUpsert(s, table, ROWS[table]());
  return s;
}

/** What the server adds to a record: its own updated_at (and created_at). */
const served = (record, at) => ({ created_at: at, ...record, updated_at: at });

describe("isRow", () => {
  it("accepts a valid row of every table", () => {
    for (const table of TABLES) assert.equal(isRow(table, ROWS[table]()), true, table);
  });

  it("rejects rows missing what pages read", () => {
    const broken = {
      programs: [program({ id: "" }), program({ days: "A" }), program({ days: [{ key: "A" }] }), program({ progression: null })],
      gyms: [gym({ available: null }), gym({ preferred: [] })],
      sessions: [session({ status: "paused" }), session({ startedAt: "yesterday" }), session({ dayKey: "" })],
      sets: [set({ reps: -1 }), set({ kg: Number.NaN }), set({ setIndex: 1.5 }), set({ kind: "drop" }), set({ rir: "2" })],
      exercise_state: [state({ exerciseId: "" }), state({ repRange: [8] }), state({ workingKg: "40" })],
      bodyweight: [weighIn({ kg: 0 }), weighIn({ at: "" })],
      adjustments: [adjustment({ source: "coach" }), adjustment({ applied: "yes" })],
      settings: [settings({ goal: "bulk" }), settings({ daysPerWeek: 5 }), settings({ unit: "lb" })],
    };
    for (const [table, rows] of Object.entries(broken)) for (const row of rows) assert.equal(isRow(table, row), false, table);
    for (const table of TABLES) {
      assert.equal(isRow(table, { ...ROWS[table](), updatedAt: "not a date" }), false, `${table} updatedAt`);
      assert.equal(isRow(table, null), false);
      assert.equal(isRow(table, []), false);
    }
    assert.equal(isRow("nope", program()), false);
  });

  it("keeps optional contract fields optional", () => {
    const { bodyweightKg, readiness, notes, ...bare } = session();
    assert.ok(bodyweightKg && readiness && notes);
    assert.equal(isRow("sessions", bare), true);
    const { bodyFatPct, note, ...plain } = weighIn();
    assert.ok(bodyFatPct && note);
    assert.equal(isRow("bodyweight", plain), true);
    assert.equal(isRow("exercise_state", { ...state(), note: undefined, lastAt: null }), true);
  });
});

describe("applyUpsert / applyRemove", () => {
  it("returns new snapshots, never mutates, keeps untouched tables' identity", () => {
    const before = deepFreeze(fullSnapshot());
    const next = applyUpsert(before, "sets", set({ id: uuid(40), setIndex: 1 }));
    assert.notEqual(next, before);
    assert.notEqual(next.sets, before.sets);
    assert.equal(Object.keys(next.sets).length, 2);
    for (const key of ["programs", "gyms", "sessions", "exerciseState", "bodyweight", "measurements", "adjustments"]) assert.equal(next[key], before[key]);
    assert.equal(next.settings, before.settings);
    const removed = applyRemove(next, "sets", uuid(40));
    assert.deepEqual(Object.keys(removed.sets), [uuid(4)]);
    assert.equal(removed.sessions, before.sessions);
  });

  it("stores settings as one object and exercise state by exercise id", () => {
    let s = applyUpsert(emptySnapshot(), "settings", settings());
    assert.deepEqual(s.settings, settings());
    s = applyUpsert(s, "settings", settings({ goal: "strength", updatedAt: T1 }));
    assert.equal(s.settings.goal, "strength");
    s = applyUpsert(s, "exercise_state", state());
    assert.deepEqual(Object.keys(s.exerciseState), ["machine-chest-press"]);
    assert.equal(rowId("exercise_state", state()), "machine-chest-press");
    assert.equal(rowId("settings", settings()), "settings");
  });

  it("makes an upserted program active unless it says active: false", () => {
    let s = applyUpsert(emptySnapshot(), "programs", program());
    assert.equal(s.activeProgramId, uuid(1));
    s = applyUpsert(s, "programs", program({ id: uuid(11), version: 2, updatedAt: T1 }));
    assert.equal(s.activeProgramId, uuid(11));
    s = applyUpsert(s, "programs", program({ id: uuid(12), updatedAt: T2, active: false }));
    assert.equal(s.activeProgramId, uuid(11), "an archived program does not become active");
    s = applyUpsert(s, "programs", { ...s.programs[uuid(11)], active: false, updatedAt: T2 });
    assert.equal(s.activeProgramId, uuid(1), "archiving the active program falls back to the newest other one");
    s = applyRemove(s, "programs", uuid(1));
    assert.equal(s.activeProgramId, null);
  });

  it("ignores invalid rows, missing ids and settings removal", () => {
    const s = deepFreeze(fullSnapshot());
    assert.equal(applyUpsert(s, "sets", { id: uuid(9) }), s);
    assert.equal(applyUpsert(s, "unknown", set()), s);
    assert.equal(applyRemove(s, "sets", "missing"), s);
    assert.equal(applyRemove(s, "settings", "settings"), s);
    assert.equal(applyRemove(s, "unknown", uuid(4)), s);
  });

  it("works on a frozen empty snapshot (like EMPTY_SNAPSHOT)", () => {
    const frozen = deepFreeze(emptySnapshot());
    const s = applyUpsert(frozen, "sessions", session());
    assert.equal(Object.keys(s.sessions).length, 1);
    assert.deepEqual(frozen.sessions, {});
  });

  it("derives the active program from the newest one not archived", () => {
    const programs = {
      [uuid(1)]: program({ updatedAt: T0 }),
      [uuid(2)]: program({ id: uuid(2), updatedAt: T2, active: false }),
      [uuid(3)]: program({ id: uuid(3), updatedAt: T1 }),
    };
    assert.equal(deriveActiveProgramId(programs), uuid(3));
    assert.equal(deriveActiveProgramId({}), null);
  });
});

describe("mergeRemote (last writer wins per row, union)", () => {
  it("takes the newer row per id and keeps rows that exist on one side only", () => {
    let local = emptySnapshot();
    local = applyUpsert(local, "sets", set({ id: uuid(41), reps: 8, updatedAt: T1 })); // local newer
    local = applyUpsert(local, "sets", set({ id: uuid(42), reps: 8, updatedAt: T0 })); // remote newer
    local = applyUpsert(local, "sets", set({ id: uuid(43), reps: 8, updatedAt: T1 })); // tie
    local = applyUpsert(local, "sets", set({ id: uuid(44) })); // local only
    deepFreeze(local);
    const remote = {
      sets: {
        [uuid(41)]: set({ id: uuid(41), reps: 12, updatedAt: T0 }),
        [uuid(42)]: set({ id: uuid(42), reps: 12, updatedAt: T1 }),
        [uuid(43)]: set({ id: uuid(43), reps: 12, updatedAt: T1 }),
        [uuid(45)]: set({ id: uuid(45), reps: 12 }), // remote only
      },
    };
    const merged = mergeRemote(local, remote);
    assert.equal(merged.sets[uuid(41)].reps, 8);
    assert.equal(merged.sets[uuid(42)].reps, 12);
    assert.equal(merged.sets[uuid(43)].reps, 8, "a tie keeps the local row");
    assert.ok(merged.sets[uuid(44)], "remote deletions are not tracked: local-only rows stay");
    assert.ok(merged.sets[uuid(45)]);
    assert.equal(merged.sessions, local.sessions, "tables absent from remote are untouched");
  });

  it("compares times numerically (Postgres +00:00 against Z)", () => {
    const local = applyUpsert(emptySnapshot(), "sessions", session({ status: "active", updatedAt: "2026-11-10T07:00:00.500Z" }));
    const remote = { sessions: { [uuid(3)]: session({ status: "finished", updatedAt: "2026-11-10T07:00:00.9+00:00" }) } };
    assert.equal(mergeRemote(local, remote).sessions[uuid(3)].status, "finished");
  });

  it("returns the same snapshot when nothing is newer", () => {
    const local = deepFreeze(fullSnapshot());
    assert.equal(mergeRemote(local, { sets: { ...local.sets }, settings: local.settings }), local);
    assert.equal(mergeRemote(local, {}), local);
  });

  it("protects pending rows and prunes only listed tables", () => {
    let local = emptySnapshot();
    local = applyUpsert(local, "sets", set({ id: uuid(41), reps: 8, updatedAt: T0 }));
    local = applyUpsert(local, "sets", set({ id: uuid(42) }));
    local = applyUpsert(local, "sets", set({ id: uuid(43) }));
    const remote = { sets: { [uuid(41)]: set({ id: uuid(41), reps: 12, updatedAt: T2 }) } };
    const merged = mergeRemote(local, remote, { protect: [`sets:${uuid(41)}`, `sets:${uuid(42)}`], prune: ["sets"] });
    assert.equal(merged.sets[uuid(41)].reps, 8, "pending local change wins over a newer server copy");
    assert.ok(merged.sets[uuid(42)], "pending row is not pruned");
    assert.equal(merged.sets[uuid(43)], undefined, "row absent remotely is pruned in a pruned table");
    const removedLocally = applyRemove(local, "sets", uuid(41));
    const again = mergeRemote(removedLocally, remote, { protect: [`sets:${uuid(41)}`] });
    assert.equal(again.sets[uuid(41)], undefined, "a pending remove is not resurrected");
  });

  it("merges settings last-writer-wins; never-edited defaults always lose", () => {
    const local = applyUpsert(emptySnapshot(), "settings", defaultSettings());
    const remote = { settings: settings({ goal: "strength", updatedAt: T0 }) };
    assert.equal(mergeRemote(local, remote).settings.goal, "strength");
    const edited = applyUpsert(emptySnapshot(), "settings", settings({ goal: "hypertrophy", updatedAt: T2 }));
    assert.equal(mergeRemote(edited, remote).settings.goal, "hypertrophy");
    assert.equal(mergeRemote(edited, { settings: null }).settings.goal, "hypertrophy");
    assert.equal(mergeRemote(edited, remote, { protect: ["settings:settings"] }).settings.goal, "hypertrophy");
  });

  it("skips invalid remote rows and re-derives the active program", () => {
    const local = applyUpsert(emptySnapshot(), "programs", program());
    const remote = {
      programs: { [uuid(13)]: program({ id: uuid(13), updatedAt: T2 }), junk: { id: "junk" } },
      sets: { bad: { id: "bad", reps: "many" } },
    };
    const merged = mergeRemote(local, remote);
    assert.deepEqual(Object.keys(merged.programs).sort(), [uuid(1), uuid(13)]);
    assert.equal(merged.activeProgramId, uuid(13));
    assert.equal(merged.sets, local.sets);
  });
});

describe("outbox", () => {
  const up = (row, at = T0, uid = OWNER) => makeUpsert("sets", row, uid, at);

  it("keeps one entry per table+id, latest wins", () => {
    let outbox = [];
    outbox = appendOutbox(outbox, up(set({ reps: 8 })));
    outbox = appendOutbox(outbox, up(set({ id: uuid(41) })));
    outbox = appendOutbox(outbox, up(set({ reps: 9, updatedAt: T1 }), T1));
    assert.equal(outbox.length, 2);
    assert.equal(outbox.at(-1).row.reps, 9, "the replaced entry moves to the end");
    outbox = appendOutbox(outbox, makeRemove("sets", uuid(4), OWNER, T2));
    assert.deepEqual(outbox.map((e) => [e.id, e.kind]), [[uuid(41), "upsert"], [uuid(4), "remove"]]);
    outbox = appendOutbox(outbox, up(set({ reps: 10, updatedAt: T2 }), T2));
    assert.deepEqual(outbox.map((e) => [e.id, e.kind]), [[uuid(41), "upsert"], [uuid(4), "upsert"]]);
    const sameIdOtherTable = appendOutbox(outbox, makeUpsert("sessions", session({ id: uuid(4) }), OWNER, T2));
    assert.equal(sameIdOtherTable.length, 3);
  });

  it("ignores invalid operations and fills a missing uid with null", () => {
    const outbox = [up(set())];
    assert.equal(appendOutbox(outbox, { table: "sets", id: uuid(9), kind: "upsert", row: { id: uuid(9) }, at: T0 }), outbox);
    assert.equal(appendOutbox(outbox, { table: "settings", id: "settings", kind: "remove", at: T0 }), outbox);
    assert.equal(appendOutbox(outbox, { table: "sets", id: uuid(9), kind: "upsert", row: set(), at: T0 }), outbox, "id must match the row");
    const anonymous = appendOutbox([], { table: "sets", id: uuid(4), kind: "upsert", row: set(), at: T0 });
    assert.equal(anonymous[0].uid, null);
  });

  it("round-trips through storage and drops malformed entries", () => {
    const outbox = [up(set()), makeRemove("gyms", uuid(2), OWNER, T1), makeUpsert("settings", settings(), null, T1)];
    assert.deepEqual(parseOutbox(serializeOutbox(outbox)), outbox);
    const raw = JSON.stringify([
      ...outbox,
      { table: "sets", id: uuid(4), kind: "upsert", row: set({ reps: 99, updatedAt: T2 }), at: T2, uid: OWNER }, // newer duplicate
      { table: "nope", id: "x", kind: "upsert", row: {}, at: T0, uid: null },
      { table: "sets", kind: "remove", at: T0 },
      { table: "sets", id: uuid(7), kind: "upsert", row: { id: uuid(7) }, at: T0, uid: null },
      { table: "settings", id: "settings", kind: "remove", at: T0, uid: null },
      { table: "sets", id: uuid(8), kind: "move", at: T0, uid: null },
      { table: "sets", id: uuid(4), kind: "remove", at: T0, uid: 42 },
      null,
      "garbage",
    ]);
    const parsed = parseOutbox(raw);
    assert.equal(parsed.length, 3);
    assert.equal(parsed.find((e) => e.table === "sets").row.reps, 99);
    assert.ok(parsed.every(isOutboxEntry));
    for (const bad of ["{", "", null, undefined, 42, "{}", JSON.stringify({ entries: "x" })]) assert.deepEqual(parseOutbox(bad), []);
    assert.equal(parseOutbox(JSON.stringify({ entries: outbox })).length, 3);
  });

  it("keeps a row's refusal count through storage and starts a new version of the row at zero", () => {
    const tried = { ...up(set()), tries: 3 };
    assert.ok(isOutboxEntry(tried));
    assert.equal(isOutboxEntry({ ...up(set()), tries: -1 }), false);
    assert.equal(isOutboxEntry({ ...up(set()), tries: 1.5 }), false);
    assert.deepEqual(parseOutbox(serializeOutbox([tried])), [tried], "survives a reload");
    const replaced = appendOutbox([tried], { ...up(set({ reps: 12, updatedAt: T1 }), T1), tries: 4 });
    assert.equal(replaced.length, 1);
    assert.equal(replaced[0].tries, undefined, "a new change to the row has no refusals yet");
  });

  it("compacts in order of last write", () => {
    const a = up(set(), T0);
    const b = up(set({ id: uuid(41) }), T0);
    const c = up(set({ reps: 3 }), T1);
    assert.deepEqual(compactOutbox([a, b, c]), [b, c]);
  });

  it("overlays pending changes onto a snapshot", () => {
    const base = applyUpsert(emptySnapshot(), "sets", set({ id: uuid(41) }));
    const overlaid = overlayOutbox(base, [up(set()), makeRemove("sets", uuid(41), OWNER, T1)]);
    assert.deepEqual(Object.keys(overlaid.sets), [uuid(4)]);
  });
});

describe("row mappers", () => {
  it("names every remote table and conflict key", () => {
    assert.deepEqual(TABLES.map((t) => REMOTE_TABLE[t]), [
      "fitness_profiles", "fitness_programs", "fitness_gyms", "fitness_sessions", "fitness_sets",
      "fitness_exercise_state", "fitness_bodyweight", "fitness_measurements", "fitness_adjustments",
    ]);
    assert.equal(ON_CONFLICT.exercise_state, "user_id,exercise_id");
    assert.equal(ON_CONFLICT.settings, "user_id");
    assert.deepEqual(ROW_TABLES.map((t) => SNAPSHOT_KEY[t]), ["programs", "gyms", "sessions", "sets", "exerciseState", "bodyweight", "measurements", "adjustments"]);
  });

  it("round-trips every table (column tables take the server's updated_at)", () => {
    for (const table of TABLES) {
      const row = ROWS[table]();
      const { table: remoteTable, record } = toRemote(table, row, { userId: OWNER });
      assert.equal(remoteTable, REMOTE_TABLE[table]);
      assert.equal(record.user_id, OWNER, table);
      const back = fromRemote(table, served(record, row.updatedAt));
      assert.deepEqual(back, row, table);
    }
  });

  it("keeps the plateau memory in the state's spec (master plan §16 rule 5) and never refuses a state over it", () => {
    const row = state({ plateau: { kg: 45, times: 2, streak: 1 } });
    assert.equal(isRow("exercise_state", row), true);
    const { record } = toRemote("exercise_state", row, { userId: OWNER });
    assert.deepEqual(record.spec.plateau, { kg: 45, times: 2, streak: 1 });
    assert.deepEqual(fromRemote("exercise_state", served(record, row.updatedAt)), row);
    const cleared = state({ plateau: null });
    assert.deepEqual(fromRemote("exercise_state", served(toRemote("exercise_state", cleared).record, cleared.updatedAt)), cleared);
    // a malformed value is the engine's to ignore, never a reason to drop the row
    for (const plateau of [undefined, null, "45", 45, [45, 2, 1], { kg: "45" }, {}]) {
      assert.equal(isRow("exercise_state", state({ plateau })), true, JSON.stringify(plateau));
      assert.equal(remoteProblem("exercise_state", state({ plateau })), null, JSON.stringify(plateau));
    }
  });

  it("round-trips rows without optional fields", () => {
    const bare = {
      sessions: { id: uuid(3), programId: uuid(1), dayKey: "B", gymId: null, startedAt: T0, endedAt: T1, status: "finished", updatedAt: T1 },
      bodyweight: { id: uuid(5), at: T0, kg: 80, updatedAt: T0 },
      sets: set({ rir: null, kind: "warmup" }),
    };
    for (const [table, row] of Object.entries(bare)) {
      const back = fromRemote(table, served(toRemote(table, row).record, row.updatedAt));
      assert.deepEqual(back, row, table);
    }
  });

  it("maps the columns the migration defines", () => {
    assert.deepEqual(toRemote("programs", program({ active: false })).record, {
      id: uuid(1),
      active: false,
      spec: program(),
    });
    assert.equal(toRemote("programs", program()).record.active, true);
    assert.deepEqual(toRemote("sessions", session()).record, {
      id: uuid(3),
      program_id: uuid(1),
      gym_id: uuid(2),
      day_key: "A",
      started_at: T0,
      ended_at: null,
      status: "active",
      bodyweight_kg: 84.2,
      readiness: { sleep: 4, energy: 3 },
      plan: null,
      notes: "felt good",
    });
    assert.deepEqual(toRemote("sets", set({ kg: 42.499999, rir: 1.46, reps: 11.2 })).record, {
      id: uuid(4),
      session_id: uuid(3),
      slot_id: "A1",
      exercise_id: "machine-chest-press",
      set_index: 0,
      kind: "working",
      planned_kg: 40,
      planned_reps: 10,
      prescription: null,
      kg: 42.5,
      reps: 11,
      rir: 1.5,
      done_at: T0,
    });
    assert.deepEqual(toRemote("exercise_state", state(), { userId: OWNER }).record, { user_id: OWNER, exercise_id: "machine-chest-press", spec: state() });
    assert.deepEqual(toRemote("bodyweight", weighIn()).record, { id: uuid(5), measured_at: T0, weight_kg: 84.2, body_fat_pct: 18.5, note: "morning" });
    assert.deepEqual(toRemote("adjustments", adjustment()).record, {
      id: uuid(6),
      source: "ai",
      input: { reason: "missed sessions" },
      output: { daysPerWeek: 2 },
      applied: false,
      created_at: T0,
    });
    assert.deepEqual(toRemote("settings", settings(), { userId: OWNER, displayName: "Ilya" }).record, {
      user_id: OWNER,
      settings: settings(),
      display_name: "Ilya",
    });
  });

  it("keeps uploads inside the database constraints", () => {
    const odd = toRemote("sessions", session({ programId: "owner-3day", gymId: "home", bodyweightKg: 5, readiness: undefined, notes: "x".repeat(2500) })).record;
    assert.equal(odd.program_id, null);
    assert.equal(odd.gym_id, null);
    assert.equal(odd.bodyweight_kg, null);
    assert.deepEqual(odd.readiness, {});
    assert.equal(odd.notes.length, 2000);
    assert.equal(toRemote("sessions", session({ notes: undefined })).record.notes, "");
    assert.equal(toRemote("bodyweight", weighIn({ note: undefined, bodyFatPct: null })).record.note, "");
    // CHECK (bodyweight_kg > 20 AND < 400) sees the rounded value: 399.996 would be stored as 400.00 and refused,
    // and with it the session and every set of that workout.
    assert.equal(toRemote("sessions", session({ bodyweightKg: 399.996 })).record.bodyweight_kg, null);
    assert.equal(toRemote("sessions", session({ bodyweightKg: 20.004 })).record.bodyweight_kg, null);
    assert.equal(toRemote("sessions", session({ bodyweightKg: 399.994 })).record.bodyweight_kg, 399.99);
    assert.equal(toRemote("sessions", session({ bodyweightKg: "84" })).record.bodyweight_kg, null);
    // char_length counts code points: a cut never leaves half an emoji (a lone surrogate) behind
    const notes = toRemote("sessions", session({ notes: `${"x".repeat(1999)}💪💪` })).record.notes;
    assert.equal(Array.from(notes).length, 2000);
    assert.ok(notes.endsWith("💪"));
    assert.equal(clipText("a💪b", 2), "a💪");
    assert.equal(clipText(42, 5), "");
    assert.equal(toRemote("settings", settings(), { userId: OWNER, displayName: `${"И".repeat(79)}🏋️` }).record.display_name, `${"И".repeat(79)}🏋`);
  });

  it("reads Postgres values: +00:00 times, numeric strings, empty settings", () => {
    const record = {
      id: uuid(4), session_id: uuid(3), slot_id: "A1", exercise_id: "machine-chest-press", set_index: 0, kind: "working",
      planned_kg: "40.00", planned_reps: 10, kg: "42.50", reps: 11, rir: "1.5", done_at: "2026-11-10T07:00:00.123456+00:00",
      updated_at: "2026-11-10T07:00:01+00:00",
    };
    const row = fromRemote("sets", record);
    assert.equal(row.kg, 42.5);
    assert.equal(row.plannedKg, 40);
    assert.equal(row.rir, 1.5);
    assert.equal(row.doneAt, "2026-11-10T07:00:00.123Z");
    assert.equal(row.updatedAt, "2026-11-10T07:00:01.000Z");
    assert.equal(fromRemote("settings", { user_id: OWNER, settings: {}, updated_at: T0 }), null);
    assert.equal(fromRemote("settings", { user_id: OWNER, settings: { goal: "recomp" }, updated_at: T0 }), null);
    assert.equal(normalizeIso("nonsense"), null);
  });

  it("returns null for records that cannot make a valid row", () => {
    assert.equal(fromRemote("sets", null), null);
    assert.equal(fromRemote("sets", { id: uuid(4) }), null);
    assert.equal(fromRemote("programs", { id: uuid(1), spec: "x" }), null);
    assert.equal(fromRemote("programs", { id: uuid(1), spec: { id: uuid(1) }, updated_at: T0 }), null);
    assert.equal(fromRemote("unknown", { id: uuid(1) }), null);
    const programRecord = served(toRemote("programs", program({ active: false })).record, T1);
    assert.equal(fromRemote("programs", programRecord).active, false);
    const gymWithoutTime = { id: uuid(2), spec: { ...gym(), updatedAt: undefined }, updated_at: T1 };
    assert.equal(fromRemote("gyms", gymWithoutTime).updatedAt, T1, "a spec without updatedAt takes the server time");
  });

  it("flags rows the server would reject", () => {
    for (const table of TABLES) assert.equal(remoteProblem(table, ROWS[table]()), null, table);
    assert.equal(remoteProblem("sets", set({ id: "set-1" })), "id");
    assert.equal(remoteProblem("sets", set({ sessionId: "s1" })), "sessionId");
    assert.equal(remoteProblem("sets", set({ exerciseId: "Chest Press" })), "exerciseId");
    assert.equal(remoteProblem("sets", set({ kg: 1000 })), "kg");
    assert.equal(remoteProblem("sets", set({ reps: 500 })), "reps");
    assert.equal(remoteProblem("sets", set({ rir: 11 })), "rir");
    assert.equal(remoteProblem("sets", set({ setIndex: 50 })), "setIndex");
    assert.equal(remoteProblem("sets", set({ slotId: "x".repeat(33) })), "slotId");
    assert.equal(remoteProblem("sessions", session({ dayKey: "day A" })), "dayKey");
    assert.equal(remoteProblem("sessions", session({ endedAt: "2026-11-10T06:00:00.000Z" })), "endedAt");
    assert.equal(remoteProblem("exercise_state", state({ exerciseId: "Bad Id" })), "exerciseId");
    assert.equal(remoteProblem("bodyweight", weighIn({ kg: 450 })), "kg");
    assert.equal(remoteProblem("bodyweight", weighIn({ bodyFatPct: 80 })), "bodyFatPct");
    assert.equal(remoteProblem("programs", program({ id: "owner-3day" })), "id");
    assert.equal(remoteProblem("sets", { id: uuid(4) }), "invalid");
  });
});

describe("closeStaleSessions", () => {
  const at = (h) => new Date(Date.parse(T0) + h * 3_600_000).toISOString();

  it("auto-closes active sessions older than 6 h at start + 6 h", () => {
    let s = emptySnapshot();
    s = applyUpsert(s, "sessions", session({ id: uuid(31), startedAt: at(0) }));
    s = applyUpsert(s, "sessions", session({ id: uuid(32), startedAt: at(3) }));
    s = applyUpsert(s, "sessions", session({ id: uuid(33), startedAt: at(-10), status: "finished", endedAt: at(-9) }));
    deepFreeze(s);
    const now = at(6.5);
    const { snapshot, closed } = closeStaleSessions(s, now);
    assert.deepEqual(closed.map((c) => c.id), [uuid(31)]);
    assert.equal(snapshot.sessions[uuid(31)].status, "auto_closed");
    assert.equal(snapshot.sessions[uuid(31)].endedAt, at(6));
    assert.equal(snapshot.sessions[uuid(31)].updatedAt, now);
    assert.equal(snapshot.sessions[uuid(32)], s.sessions[uuid(32)]);
    assert.equal(snapshot.sessions[uuid(33)], s.sessions[uuid(33)]);
    assert.equal(snapshot.sets, s.sets);
  });

  it("leaves the snapshot alone when nothing is stale, exactly at 6 h, or with a bad clock", () => {
    const s = applyUpsert(emptySnapshot(), "sessions", session({ startedAt: T0 }));
    assert.equal(closeStaleSessions(s, at(6)).snapshot, s, "older than 6 h, not at 6 h");
    assert.equal(closeStaleSessions(s, at(1)).snapshot, s);
    assert.equal(closeStaleSessions(s, "not a time").snapshot, s);
    assert.equal(closeStaleSessions(s, at(2.5), 2).closed.length, 1, "custom hours");
    assert.equal(closeStaleSessions(s, at(7), Number.NaN).closed[0].endedAt, at(6), "bad hours fall back to 6");
  });
});

describe("settings, snapshot storage and keys", () => {
  it("has the documented defaults", () => {
    assert.deepEqual(defaultSettings(T0), {
      goal: "recomp", daysPerWeek: 3, activeGymId: null, unit: "kg", restTimer: true, autoCloseHours: 6, updatedAt: T0,
    });
    assert.equal(defaultSettings().updatedAt, DEFAULTS_AT);
    assert.equal(isRow("settings", defaultSettings()), true);
  });

  it("round-trips a snapshot with its owner", () => {
    const s = { ...fullSnapshot(), syncedAt: T1 };
    const { snapshot, user } = parseSnapshot(serializeSnapshot(s, OWNER));
    assert.deepEqual(snapshot, { ...s, pending: 0 });
    assert.equal(user, OWNER);
  });

  it("loads malformed storage as an empty or filtered snapshot, never throwing", () => {
    for (const raw of [null, undefined, "", "{", "[]", "42", JSON.stringify({ v: 1, user: 7, snapshot: "x" })]) {
      const { snapshot, user } = parseSnapshot(raw);
      assert.deepEqual(snapshot, emptySnapshot());
      assert.equal(user, null);
    }
    const messy = {
      programs: { wrong: program(), broken: { id: "broken" } },
      sets: { [uuid(4)]: set(), [uuid(9)]: { ...set({ id: uuid(9) }), reps: "x" } },
      exerciseState: [state()],
      settings: { goal: "nope" },
      activeProgramId: "gone",
      syncedAt: "never",
      pending: 99,
    };
    const { snapshot } = parseSnapshot(JSON.stringify(messy));
    assert.deepEqual(Object.keys(snapshot.programs), [uuid(1)], "re-keyed by the row's own id");
    assert.deepEqual(Object.keys(snapshot.sets), [uuid(4)]);
    assert.deepEqual(snapshot.exerciseState, {});
    assert.equal(snapshot.settings, null);
    assert.equal(snapshot.activeProgramId, uuid(1), "repaired from the programs");
    assert.equal(snapshot.syncedAt, null);
    assert.equal(snapshot.pending, 0);
  });

  it("names storage keys per Supabase project", () => {
    assert.deepEqual(storageKeys("abc.supabase.co"), {
      snapshot: "ilyadays-fitness:abc.supabase.co:snapshot",
      outbox: "ilyadays-fitness:abc.supabase.co:outbox",
      writer: "ilyadays-fitness:abc.supabase.co:writer",
      cursor: "ilyadays-fitness:abc.supabase.co:cursor",
      adopted: "ilyadays-fitness:abc.supabase.co:adopted",
      backend: "ilyadays-fitness:abc.supabase.co:backend",
      backendAt: "ilyadays-fitness:abc.supabase.co:backend-at",
      dead: "ilyadays-fitness:abc.supabase.co:dead",
    });
    assert.equal(storageKeys("").snapshot, "ilyadays-fitness:unconfigured:snapshot");
  });

  it("names the supabase-js session key exactly as src/lib/supabase.ts stores it", async () => {
    const source = await readFile(new URL("../../src/lib/supabase.ts", import.meta.url), "utf8");
    assert.match(source, /storageKey: `ilyadays-auth:\$\{supabaseProject\}`/);
    assert.equal(authStorageKey("abc.supabase.co"), "ilyadays-auth:abc.supabase.co");
  });

  it("reads the account of a stored supabase-js session and nothing less", () => {
    const user = { id: OWNER, email: "ilya@example.com", user_metadata: { full_name: "Ilya" }, role: "authenticated" };
    const stored = { access_token: "a", token_type: "bearer", expires_in: 3600, expires_at: 1_800_000_000, refresh_token: "r", user };
    assert.deepEqual(parseAuthSession(JSON.stringify(stored)), {
      user: { id: OWNER, email: "ilya@example.com", user_metadata: { full_name: "Ilya" } },
      expiresAt: 1_800_000_000_000,
    });
    for (const broken of [
      null,
      "",
      "{",
      "null",
      JSON.stringify({ ...stored, refresh_token: "" }),
      JSON.stringify({ ...stored, access_token: undefined }),
      JSON.stringify({ ...stored, expires_at: "later" }),
      JSON.stringify({ ...stored, user: { email: "ilya@example.com" } }),
    ]) {
      assert.equal(parseAuthSession(broken), null, String(broken));
    }
  });
});

describe("adoptLocalData", () => {
  const PROJECT = "abc.supabase.co";
  const local = storageKeys("unconfigured");
  const target = storageKeys(PROJECT);

  function trainedOffline() {
    let s = emptySnapshot();
    for (const table of ROW_TABLES) s = applyUpsert(s, table, ROWS[table]());
    s = applyUpsert(s, "settings", settings({ updatedAt: T1 }));
    return s;
  }

  it("copies the unconfigured copy into the project and queues every row", () => {
    const storage = memoryStorage({ [local.snapshot]: serializeSnapshot(trainedOffline()) });
    assert.equal(hasLocalData(storage), true);
    const result = adoptLocalData(storage, "unconfigured", PROJECT, { uid: OWNER, nowIso: T2 });
    assert.deepEqual(result, { adopted: TABLES.length, rows: TABLES.length });
    const outbox = parseOutbox(storage.getItem(target.outbox));
    assert.deepEqual(outbox.map((e) => e.table).sort(), [...TABLES].sort());
    assert.ok(outbox.every((e) => e.kind === "upsert" && e.uid === OWNER && e.at === T2));
    const { snapshot } = parseSnapshot(storage.getItem(target.snapshot));
    assert.deepEqual(snapshot, trainedOffline(), "pending is recomputed from the outbox on load");
    assert.equal(JSON.parse(storage.getItem(target.snapshot)).snapshot.pending, TABLES.length);
    assert.equal(storage.getItem(local.snapshot), null, "the source is cleared…");
    assert.ok(JSON.parse(storage.getItem(local.adopted)).snapshot, "…and kept as a backup");
    assert.equal(hasLocalData(storage), false);
    assert.deepEqual(adoptLocalData(storage, "unconfigured", PROJECT, { uid: OWNER }), { adopted: 0, rows: 0 }, "second call: nothing left");
  });

  it("merges into an existing copy without queueing rows that lost", () => {
    const older = trainedOffline();
    let existing = applyUpsert(emptySnapshot(), "sets", set({ reps: 12, updatedAt: T2 })); // newer than the local set
    existing = applyUpsert(existing, "sessions", session({ id: uuid(30) }));
    const storage = memoryStorage({
      [local.snapshot]: serializeSnapshot(older),
      [target.snapshot]: serializeSnapshot(existing, OWNER),
      [target.outbox]: serializeOutbox([makeUpsert("sessions", session({ id: uuid(30) }), OWNER, T0)]),
    });
    const result = adoptLocalData(storage, "unconfigured", PROJECT, { uid: OWNER, nowIso: T2 });
    assert.equal(result.adopted, TABLES.length - 1);
    const { snapshot, user } = parseSnapshot(storage.getItem(target.snapshot));
    assert.equal(user, OWNER, "the copy keeps its owner");
    assert.equal(snapshot.sets[uuid(4)].reps, 12, "the newer row stays");
    assert.ok(snapshot.sessions[uuid(30)] && snapshot.sessions[uuid(3)]);
    const outbox = parseOutbox(storage.getItem(target.outbox));
    assert.equal(outbox.filter((e) => e.table === "sets").length, 0);
    assert.equal(outbox.length, TABLES.length - 1 + 1, "existing entries survive");
  });

  it("does not upload never-edited default settings", () => {
    const s = applyUpsert(applyUpsert(emptySnapshot(), "settings", defaultSettings()), "bodyweight", weighIn());
    const storage = memoryStorage({ [local.snapshot]: serializeSnapshot(s) });
    const result = adoptLocalData(storage, "unconfigured", PROJECT, { uid: OWNER, nowIso: T2 });
    assert.deepEqual(result, { adopted: 1, rows: 1 });
    assert.deepEqual(parseOutbox(storage.getItem(target.outbox)).map((e) => e.table), ["bodyweight"]);
    const defaultsOnly = memoryStorage({ [local.snapshot]: serializeSnapshot(applyUpsert(emptySnapshot(), "settings", defaultSettings())) });
    assert.equal(hasLocalData(defaultsOnly), false);
    assert.deepEqual(adoptLocalData(defaultsOnly, "unconfigured", PROJECT), { adopted: 0, rows: 0 });
  });

  it("leaves the source intact when the browser refuses to save", () => {
    const raw = serializeSnapshot(trainedOffline());
    const storage = memoryStorage({ [local.snapshot]: raw });
    storage.fail = true;
    const result = adoptLocalData(storage, "unconfigured", PROJECT, { uid: OWNER });
    assert.equal(result.adopted, 0);
    assert.match(result.error, /Quota/);
    assert.equal(storage.getItem(local.snapshot), raw);
  });

  it("carries what the source's outbox still waited to upload, and a rerun after a failed clear queues nothing", () => {
    const pending = set({ id: uuid(41), reps: 7, updatedAt: T2 });
    const storage = memoryStorage({
      [local.snapshot]: serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session())),
      [local.outbox]: serializeOutbox([makeUpsert("sets", pending, null, T2)]),
    });
    const result = adoptLocalData(storage, "unconfigured", PROJECT, { uid: OWNER, nowIso: T2 });
    assert.deepEqual(result, { adopted: 2, rows: 2 });
    const { snapshot } = parseSnapshot(storage.getItem(target.snapshot));
    assert.equal(snapshot.sets[uuid(41)].reps, 7, "the queued row is in the copy too");
    assert.deepEqual(parseOutbox(storage.getItem(target.outbox)).map((e) => `${e.table}:${e.id}:${e.uid}`).sort(), [`sessions:${uuid(3)}:${OWNER}`, `sets:${uuid(41)}:${OWNER}`]);
    assert.equal(storage.getItem(local.outbox), null);

    // The copy could not be cleared: adopting it again finds the same rows, which tie, so nothing is queued twice.
    const stuck = memoryStorage({ [local.snapshot]: serializeSnapshot(trainedOffline()) });
    stuck.removeItem = () => {
      throw new Error("SecurityError");
    };
    assert.equal(adoptLocalData(stuck, "unconfigured", PROJECT, { uid: OWNER, nowIso: T2 }).adopted, TABLES.length);
    const once = parseOutbox(stuck.getItem(target.outbox));
    assert.equal(adoptLocalData(stuck, "unconfigured", PROJECT, { uid: OWNER, nowIso: T2 }).adopted, 0);
    assert.deepEqual(parseOutbox(stuck.getItem(target.outbox)), once);
  });

  it("adopts an earlier project's copy of this device's writer there, once, and marks it adopted", () => {
    const OLD = storageKeys("old.supabase.co");
    const OLD_OWNER = uuid(900); // the same person has another user id in every project
    let copy = applyUpsert(emptySnapshot(), "sessions", session());
    copy = applyUpsert(copy, "sets", set());
    const waiting = weighIn({ id: uuid(51), kg: 83.1, updatedAt: T1 });
    const storage = memoryStorage({
      [OLD.snapshot]: serializeSnapshot(copy, OLD_OWNER),
      [OLD.writer]: OLD_OWNER,
      [OLD.outbox]: serializeOutbox([
        makeUpsert("bodyweight", waiting, OLD_OWNER, T1), // logged, not yet uploaded there
        makeRemove("sets", uuid(77), OLD_OWNER, T1), // a delete of that backend's row stays behind
        makeUpsert("bodyweight", weighIn({ id: uuid(52) }), uuid(901), T1), // another account on this browser
      ]),
    });
    assert.deepEqual(storedProjects(storage, PROJECT), ["unconfigured", "old.supabase.co"]);
    const result = adoptCopies(storage, PROJECT, { uid: OWNER, nowIso: T2 });
    assert.deepEqual(result, { adopted: 3, rows: 3 });
    const outbox = parseOutbox(storage.getItem(target.outbox));
    assert.deepEqual(outbox.map((e) => `${e.table}:${e.id}`).sort(), [`bodyweight:${uuid(51)}`, `sessions:${uuid(3)}`, `sets:${uuid(4)}`]);
    assert.ok(outbox.every((e) => e.uid === OWNER && e.kind === "upsert"), "queued under the account signed in here");
    assert.equal(parseSnapshot(storage.getItem(target.snapshot)).snapshot.bodyweight[uuid(51)].kg, 83.1);
    assert.equal(storage.getItem(OLD.snapshot), null, "moved…");
    assert.ok(JSON.parse(storage.getItem(OLD.adopted)).snapshot, "…with a backup");
    assert.deepEqual(parseOutbox(storage.getItem(OLD.outbox)).map((e) => e.id).sort(), [uuid(52), uuid(77)], "what was not adopted stays");
    assert.deepEqual(adoptCopies(storage, PROJECT, { uid: OWNER, nowIso: T2 }), { adopted: 0, rows: 0 }, "exactly once");
    assert.equal(parseOutbox(storage.getItem(target.outbox)).length, 3);
  });

  it("never adopts what a visitor saw (another account's mirror), only that writer's own queued changes", () => {
    const OLD = storageKeys("old.supabase.co");
    const mirror = serializeSnapshot(applyUpsert(emptySnapshot(), "sessions", session()), uuid(900)); // the owner's log
    const visitor = memoryStorage({ [OLD.snapshot]: mirror });
    assert.deepEqual(adoptCopies(visitor, PROJECT, { uid: FRIEND, nowIso: T2 }), { adopted: 0, rows: 0 });
    assert.equal(visitor.getItem(OLD.snapshot), mirror, "left alone");
    assert.equal(visitor.getItem(target.outbox), null);

    // A writer there whose copy was later replaced by the owner's mirror: only their queued change moves.
    const mine = weighIn({ id: uuid(53) });
    const friend = memoryStorage({
      [OLD.snapshot]: mirror,
      [OLD.writer]: uuid(902),
      [OLD.outbox]: serializeOutbox([makeUpsert("bodyweight", mine, uuid(902), T1)]),
    });
    assert.deepEqual(adoptCopies(friend, PROJECT, { uid: FRIEND, nowIso: T2 }), { adopted: 1, rows: 1 });
    assert.deepEqual(Object.keys(parseSnapshot(friend.getItem(target.snapshot)).snapshot.sessions), [], "none of the mirror");
    assert.equal(friend.getItem(OLD.snapshot), mirror);
    assert.equal(friend.getItem(OLD.outbox), null);
  });

  it("lists copies even where storage cannot list its keys", () => {
    const bare = { getItem: () => null, setItem() {}, removeItem() {} };
    assert.deepEqual(storedProjects(bare, PROJECT), ["unconfigured"]);
    assert.deepEqual(storedProjects(memoryStorage({ "ilyadays-fitness:targets": "{}", "ilyadays-fitness:x.co:cursor": "{}" }), "unconfigured"), []);
    assert.deepEqual(adoptCopies(memoryStorage(), "unconfigured"), { adopted: 0, rows: 0 });
  });

  it("is a no-op for the same project or without storage", () => {
    const storage = memoryStorage({ [local.snapshot]: serializeSnapshot(trainedOffline()) });
    assert.deepEqual(adoptLocalData(storage, "unconfigured", "unconfigured"), { adopted: 0, rows: 0 });
    assert.deepEqual(adoptLocalData(null, "unconfigured", PROJECT), { adopted: 0, rows: 0 });
    assert.equal(hasLocalData(storage), true);
    assert.equal(hasLocalData(null), false);
  });
});

describe('circumference-only measurement rows', () => {
  it('round-trips units without requiring a fabricated bodyweight', () => {
    const row = ROWS.measurements();
    const remote = toRemote('measurements', row, { userId: OWNER }).record;
    assert.deepEqual(remote.values, row.values);
    assert.equal('weight_kg' in remote, false);
    assert.deepEqual(fromRemote('measurements', { ...remote, updated_at: row.updatedAt }), row);
  });
  it('rejects unknown, empty, zero, nonnumeric and oversized circumference data', () => {
    for (const values of [{}, { waist: 0 }, { waist: -1 }, { waist: 301 }, { waist: '85' }, { unknown: 85 }, { waist: Infinity }]) {
      assert.equal(isRow('measurements', ROWS.measurements({ values })), false, JSON.stringify(values));
    }
    assert.equal(remoteProblem('measurements', ROWS.measurements({ values: { waist: 0.001 } })), 'values');
  });
});
