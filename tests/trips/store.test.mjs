import "./storage-shim.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deleteTrip, listTrips, loadTrip, readAiKey, readEffort, readModel, saveTrip, subscribePrefs, subscribeTrips, writeAiKey, writeEffort, writeModel } from "../../src/lib/trips/store.mjs";
import { denyReads, denyWrites, resetStorage } from "./storage-shim.mjs";

function empty() {
  resetStorage();
  listTrips();
  localStorage.removeItem("ilyadays-trips-v1");
  return listTrips();
}

function trip(id) {
  return { id, created: "2026-10-08T00:00:00.000Z", city: id, brief: {}, spine: null, routes: [] };
}

describe("browser store", { concurrency: false }, () => {
test("saved trips stay on this browser, newest first, twenty at most", () => {
  assert.deepEqual(empty(), []);
  saveTrip(trip("a"));
  saveTrip(trip("b"));
  assert.deepEqual(listTrips().map((item) => item.id), ["b", "a"]);
  assert.equal(loadTrip("a").city, "a");
  assert.equal(loadTrip("missing"), null);
  saveTrip({ ...trip("a"), city: "Lisbon" });
  assert.deepEqual(listTrips().map((item) => item.id), ["a", "b"]);
  assert.equal(loadTrip("a").city, "Lisbon");
  deleteTrip("a");
  assert.deepEqual(listTrips().map((item) => item.id), ["b"]);
  empty();
  for (let i = 0; i < 21; i += 1) saveTrip(trip(`t${i}`));
  const ids = listTrips().map((item) => item.id);
  assert.equal(ids.length, 20);
  assert.equal(ids[0], "t20");
  assert.equal(ids.includes("t0"), false);
});

test("a broken store reads as empty and a refused write does not throw", () => {
  empty();
  localStorage.setItem("ilyadays-trips-v1", "{");
  assert.deepEqual(listTrips(), []);
  saveTrip(trip("kept"));
  denyReads();
  assert.deepEqual(listTrips(), []);
  empty();
  saveTrip(trip("kept"));
  denyWrites();
  assert.doesNotThrow(() => saveTrip(trip("lost")));
  bagWriteOff();
  assert.deepEqual(listTrips().map((item) => item.id), ["kept"]);
});

function bagWriteOff() {
  localStorage.removeItem("__throwWrite");
  localStorage.removeItem("__throwRead");
}

test("the key, model and effort stay in this browser", () => {
  empty();
  assert.equal(readAiKey(), "");
  assert.equal(readModel(), "gpt-6.1-sol");
  assert.equal(readEffort(), "medium");
  writeAiKey("  sk-test  ");
  writeModel("gpt-test");
  writeEffort("high");
  assert.equal(readAiKey(), "sk-test");
  assert.equal(readModel(), "gpt-test");
  assert.equal(readEffort(), "high");
  writeModel("");
  writeEffort("nope");
  assert.equal(readModel(), "gpt-6.1-sol");
  assert.equal(readEffort(), "medium");
});

test("a save tells subscribers and an unsubscribe stops that", () => {
  empty();
  let trips = 0;
  let prefs = 0;
  const stopTrips = subscribeTrips(() => { trips += 1; });
  const stopPrefs = subscribePrefs(() => { prefs += 1; });
  saveTrip(trip("a"));
  writeAiKey("sk-test");
  assert.equal(trips, 1);
  assert.equal(prefs, 1);
  stopTrips();
  stopPrefs();
  saveTrip(trip("b"));
  writeEffort("low");
  assert.equal(trips, 1);
  assert.equal(prefs, 1);
});
});
