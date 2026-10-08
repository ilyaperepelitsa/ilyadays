import assert from "node:assert/strict";
import test from "node:test";
import { parseBrief, slugId } from "../../src/lib/trips/brief.mjs";
import { brief } from "./fixtures.mjs";

const ok = { ...brief, sharedSpine: false, routes: 1 };

test("accepts the edges of every count", () => {
  const parsed = parseBrief({ ...ok, routes: "1", hours: 12, placesPerRoute: 8, foodBreaks: 0, pace: "rapid" });
  assert.equal(parsed.routes, 1);
  assert.equal(parsed.hours, 12);
  assert.equal(parsed.placesPerRoute, 8);
  assert.equal(parsed.foodBreaks, 0);
  assert.equal(parsed.pace, "rapid");
  assert.equal(parsed.preferences, "");
  assert.deepEqual(parsed.wishes, []);
  assert.equal(parseBrief({ ...brief, city: `  ${"a".repeat(80)} ` }).city.length, 80);
});

test("rejects a brief outside the template", () => {
  assert.throws(() => parseBrief(null), /brief/);
  assert.throws(() => parseBrief([]), /brief/);
  assert.throws(() => parseBrief({ ...ok, city: "A" }), /city/);
  assert.throws(() => parseBrief({ ...ok, city: "a".repeat(81) }), /city/);
  assert.throws(() => parseBrief({ ...ok, routes: 0 }), /routes/);
  assert.throws(() => parseBrief({ ...ok, routes: 7 }), /routes/);
  assert.throws(() => parseBrief({ ...ok, routes: 1.5 }), /routes/);
  assert.throws(() => parseBrief({ ...ok, hours: 3 }), /hours/);
  assert.throws(() => parseBrief({ ...ok, hours: 13 }), /hours/);
  assert.throws(() => parseBrief({ ...ok, placesPerRoute: 1 }), /places/);
  assert.throws(() => parseBrief({ ...ok, placesPerRoute: 9 }), /places/);
  assert.throws(() => parseBrief({ ...ok, foodBreaks: 4 }), /food/);
  assert.throws(() => parseBrief({ ...ok, pace: "sprint" }), /pace/);
  assert.throws(() => parseBrief({ ...ok, routes: 1, sharedSpine: true }), /spine/);
});

test("keeps a preference note and one line per place", () => {
  const parsed = parseBrief({
    ...brief,
    preferences: "  secret bars, modern local food, traditional local food  ",
    wishes: "a tea shop\n\nA Tea Shop\na local pottery store",
  });
  assert.equal(parsed.preferences, "secret bars, modern local food, traditional local food");
  assert.deepEqual(parsed.wishes, ["a tea shop", "a local pottery store"]);
  assert.throws(() => parseBrief({ ...ok, preferences: "x".repeat(601) }), /preferences/);
  assert.throws(() => parseBrief({ ...ok, wishes: ["x"] }), /wishes/);
  assert.throws(() => parseBrief({ ...ok, wishes: ["x".repeat(81)] }), /wishes/);
  assert.throws(() => parseBrief({ ...brief, wishes: Array.from({ length: 13 }, (_, i) => `place ${i} here`) }), /wishes/);
  assert.throws(
    () => parseBrief({ ...ok, placesPerRoute: 2, foodBreaks: 0, wishes: ["tea shop", "pottery store", "bookshop"] }),
    /wishes/,
  );
  const full = parseBrief({ ...ok, placesPerRoute: 2, foodBreaks: 0, wishes: ["tea shop", "pottery"] });
  assert.equal(full.wishes.length, 2);
});

test("slug of a local name stays ascii and unique", () => {
  const used = new Set();
  assert.equal(slugId("São Jorge", used), "sao-jorge");
  assert.equal(slugId("São Jorge", used), "sao-jorge-2");
  assert.equal(slugId("!!!", new Set()), "stop");
});
