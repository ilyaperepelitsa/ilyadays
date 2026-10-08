import assert from "node:assert/strict";
import test from "node:test";
import { TripShapeError } from "../../src/lib/trips/brief.mjs";
import { buildTrip, suggestThemes } from "../../src/lib/trips/generate.mjs";
import { brief, facts, outline } from "./fixtures.mjs";

const themes = [
  { title: "River", description: "Cross and look back at the hills.", titleRu: "Река", descriptionRu: "Перейти и оглянуться на холмы." },
  { title: "Shore", description: "The west end of the city.", titleRu: "Берег", descriptionRu: "Западный край города." },
];

function client(names, hoursFor) {
  return async (call) => {
    names.push(call.name);
    if (call.name === "trip_outline") return outline();
    const body = JSON.parse(call.user);
    return {
      places: body.stops.map((stop) => ({ ...facts(stop.id, stop.kind), hours: hoursFor(stop.id, names.length) })),
    };
  };
}

test("buildTrip asks for routes, then each day's notes, then one picture pass per place", async () => {
  const names = [];
  const enriched = [];
  const progress = [];
  const pauses = [];
  const trip = await buildTrip({
    brief,
    themes,
    id: "lisbon-1",
    created: "2026-10-08T00:00:00.000Z",
    pauseMs: 0,
    wait: async (ms) => { pauses.push(ms); },
    onProgress: (event) => progress.push(`${event.stage}:${event.done}/${event.total}`),
    client: client(names, (id, step) => `${id}-${step}`),
    enrich: async (stop, row) => {
      enriched.push(stop.id);
      return { ...stop, hours: row.hours, access: row.access, days: row.days, wiki: { en: `https://en.wikipedia.org/wiki/${stop.id}` }, notes: row.notes };
    },
  });
  assert.deepEqual(pauses, []);
  assert.deepEqual(names, ["trip_outline", "trip_notes", "trip_notes"]);
  assert.deepEqual(progress, ["routes:0/1", "notes:0/2", "notes:1/2", "pictures:0/5", "pictures:1/5", "pictures:2/5", "pictures:3/5", "pictures:4/5"]);
  assert.deepEqual(enriched, ["castle", "ferry", "lunch", "belem", "cafe"]);
  assert.equal(trip.routes[0].stops[1].hours, "ferry-2");
  assert.equal(trip.routes[1].stops[0].hours, "ferry-2");
  assert.match(trip.routes[0].stops[1].wiki.en, /ferry/);
  assert.equal(trip.city, "Lisbon");
});

test("the wrong number of themes never calls the model", async () => {
  let calls = 0;
  await assert.rejects(
    () => buildTrip({
      brief,
      themes: themes.slice(0, 1),
      id: "x",
      created: "2026-10-08T00:00:00.000Z",
      pauseMs: 0,
      client: async () => { calls += 1; return {}; },
      enrich: async (stop) => stop,
    }),
    (error) => error instanceof TripShapeError && error.code === "themes",
  );
  assert.equal(calls, 0);
});

test("picture lookups pause once per place", async () => {
  const one = { ...brief, routes: 1, sharedSpine: false, placesPerRoute: 2, foodBreaks: 0, wishes: [] };
  const pauses = [];
  await buildTrip({
    brief: one,
    themes: [themes[0]],
    id: "x",
    created: "2026-10-08T00:00:00.000Z",
    pauseMs: 40,
    wait: async (ms) => { pauses.push(ms); },
    client: async (call) => {
      if (call.name === "trip_outline") {
        const raw = outline();
        return { spine: { name: "", why: "", whyRu: "" }, routes: [{ stops: raw.routes[0].stops.slice(0, 2) }] };
      }
      const body = JSON.parse(call.user);
      return { places: body.stops.map((stop) => facts(stop.id, stop.kind)) };
    },
    enrich: async (stop) => stop,
  });
  assert.deepEqual(pauses, [40, 40]);
});

test("suggestThemes returns the edited titles", async () => {
  const suggested = await suggestThemes(brief, async () => ({ themes }));
  assert.equal(suggested[0].title, "River");
  assert.equal(suggested[1].titleRu, "Берег");
  await assert.rejects(() => suggestThemes(brief, async () => ({ themes: [] })), /themes/);
});
