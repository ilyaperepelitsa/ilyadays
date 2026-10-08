import assert from "node:assert/strict";
import test from "node:test";
import { notesCall, outlineCall, themeCall } from "../../src/lib/trips/prompts.mjs";
import { brief, stop } from "./fixtures.mjs";

const themes = [
  { title: "River", description: "Cross and look back.", titleRu: "Река", descriptionRu: "Перейти и оглянуться." },
  { title: "Shore", description: "The west end.", titleRu: "Берег", descriptionRu: "Западный край." },
];

test("theme and outline prompts carry the counts, pace and spine", () => {
  const named = themeCall(brief);
  assert.equal(named.schema.properties.themes.minItems, 2);
  assert.equal(named.schema.properties.themes.maxItems, 2);
  assert.match(named.developer, /linger/);
  assert.match(named.user, /Lisbon/);
  const rapid = themeCall({ ...brief, pace: "rapid", sharedSpine: false });
  assert.match(rapid.developer, /rapid/);
  assert.match(rapid.developer, /one route only/);
  assert.match(rapid.developer, /empty string/);
  const plan = outlineCall(brief, themes);
  assert.match(plan.developer, /exactly 2 sights/);
  assert.match(plan.developer, /exactly 1 food/);
  assert.match(plan.developer, /at most 480/);
  assert.match(plan.developer, /do not share a coordinate/);
  const stopSchema = plan.schema.properties.routes.items.properties.stops;
  assert.equal(stopSchema.minItems, 3);
  assert.equal(stopSchema.maxItems, 3);
  assert.ok(stopSchema.items.required.includes("wish"));
});

test("preferences and wishes are copied into both calls", () => {
  const asked = {
    ...brief,
    preferences: "secret bars and traditional local food",
    wishes: ["a tea shop", "a local pottery store"],
  };
  const named = themeCall(asked);
  assert.match(named.developer, /secret bars/);
  assert.match(named.developer, /exactly one route/);
  assert.match(named.developer, /food slot/);
  assert.deepEqual(JSON.parse(named.user).wishes, asked.wishes);
  const plan = outlineCall(asked, themes);
  assert.match(plan.developer, /a tea shop/);
  assert.match(plan.user, /pottery store/);
  const notes = notesCall(asked, [stop("tea", "food", 38.7)]);
  assert.match(notes.developer, /Do not write image URLs/);
  assert.match(notes.developer, /wish/);
  assert.equal(JSON.parse(notes.user).stops[0].wish, "");
  assert.equal(notes.schema.properties.places.minItems, 1);
  assert.equal(notes.schema.properties.places.maxItems, 1);
});
