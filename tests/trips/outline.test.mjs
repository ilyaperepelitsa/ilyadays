import assert from "node:assert/strict";
import test from "node:test";
import { completeTheme, parseOutline, parseThemes } from "../../src/lib/trips/parse.mjs";
import { brief, outline, stop } from "./fixtures.mjs";

test("a theme needs both languages and the exact count", () => {
  const theme = completeTheme({ title: "River", description: "Cross and look back at the hills." });
  assert.equal(theme.titleRu, "River");
  assert.equal(theme.descriptionRu, theme.description);
  assert.throws(() => completeTheme({ title: "", description: "Long enough." }), /themes/);
  assert.throws(() => completeTheme({ title: "x".repeat(81), description: "Long enough." }), /themes/);
  assert.throws(() => parseThemes({ themes: [] }, 2), /themes/);
  assert.throws(() => parseThemes(null, 1), /themes/);
});

test("outline keeps a repeated sub-route and the first coordinates", () => {
  const raw = outline();
  raw.routes[1].stops[0].lat = 1;
  const parsed = parseOutline(raw, brief);
  assert.equal(parsed.spine?.name, "The ferry");
  assert.equal(parsed.routes[1][0].id, "ferry");
  assert.equal(parsed.routes[1][0].lat, parsed.routes[0][1].lat);
});

test("outline rejects a bad shape", () => {
  assert.throws(() => parseOutline({ routes: [] }, brief), /counts/);
  const hungry = outline();
  hungry.routes[0].stops[2].kind = "sight";
  assert.throws(() => parseOutline(hungry, brief), /counts/);
  const piled = outline();
  for (const route of piled.routes) route.stops.forEach((item) => { item.lat = 38.7; item.lon = -9.1; });
  assert.throws(() => parseOutline(piled, brief), /coords/);
  const origin = outline();
  origin.routes[0].stops[0].lat = 0;
  origin.routes[0].stops[0].lon = 0;
  assert.throws(() => parseOutline(origin, brief), /coords/);
  const north = outline();
  north.routes[0].stops[0].lat = 91;
  assert.throws(() => parseOutline(north, brief), /coords/);
  const rushed = outline();
  rushed.routes[0].stops[0].minutes = 9;
  assert.throws(() => parseOutline(rushed, brief), /minutes/);
  const nameless = outline();
  nameless.routes[0].stops[0].name = "";
  assert.throws(() => parseOutline(nameless, brief), /stops/);
  const pair = outline();
  pair.routes[0].stops[1].lat = pair.routes[0].stops[0].lat;
  pair.routes[0].stops[1].lon = pair.routes[0].stops[0].lon;
  assert.throws(() => parseOutline(pair, brief), /coords/);
  const long = outline();
  long.routes.forEach((route) => route.stops.forEach((item) => { item.minutes = 170; }));
  assert.throws(() => parseOutline(long, brief), /length/);
  const full = outline();
  full.routes.forEach((route) => route.stops.forEach((item) => { item.minutes = 160; }));
  assert.equal(parseOutline(full, brief).routes[0].reduce((sum, stop) => sum + stop.minutes, 0), 480);
});

test("a shared sub-route is required only when the form asks for one", () => {
  assert.throws(() => parseOutline(outline(), { ...brief, sharedSpine: false }), /spine/);
  const alone = outline();
  alone.spine = { name: "", why: "", whyRu: "" };
  alone.routes[1].stops[0] = stop("tower", "sight", 38.68);
  assert.equal(parseOutline(alone, { ...brief, sharedSpine: false }).spine, null);
  const unnamed = outline();
  unnamed.spine.name = "";
  assert.throws(() => parseOutline(unnamed, brief), /spine/);
});

test("each wish is one stop, and a later copy can name the shared one", () => {
  const asked = { ...brief, wishes: ["a tea shop", "a local pottery store"] };
  const plan = outline();
  plan.routes[0].stops[2].wish = "A Tea Shop";
  plan.routes[1].stops[1].wish = "a local pottery store";
  const parsed = parseOutline(plan, asked);
  assert.equal(parsed.routes[0][2].wish, "A Tea Shop");
  assert.equal(parsed.routes[1][1].wish, "a local pottery store");
  const missed = outline();
  missed.routes[0].stops[2].wish = "a tea shop";
  assert.throws(() => parseOutline(missed, asked), /wishes/);
  const doubled = outline();
  doubled.routes[0].stops[2].wish = "a tea shop";
  doubled.routes[1].stops[1].wish = "a tea shop";
  doubled.routes[1].stops[2].wish = "a local pottery store";
  assert.throws(() => parseOutline(doubled, asked), /wishes/);
  const extra = outline();
  extra.routes[0].stops[0].wish = "a bookshop";
  assert.throws(() => parseOutline(extra, brief), /wishes/);
  const shared = outline();
  shared.routes[1].stops[0].wish = "a tea shop";
  const once = parseOutline(shared, { ...brief, wishes: ["a tea shop"] });
  assert.equal(once.routes[0][1].wish, "a tea shop");
  assert.equal(once.routes[1][0].id, once.routes[0][1].id);
});

test("an unusable id is replaced by a slug of the name", () => {
  const raw = outline();
  raw.routes[0].stops[0].id = "Castle!";
  raw.routes[0].stops[0].name = "São Jorge";
  const parsed = parseOutline(raw, brief);
  assert.equal(parsed.routes[0][0].id, "sao-jorge");
});
