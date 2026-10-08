import assert from "node:assert/strict";
import test from "node:test";
import { mapsUrl, parseNotes } from "../../src/lib/trips/parse.mjs";
import { stop } from "./fixtures.mjs";

function row(id, kind, spotSearch) {
  const notes = kind === "sight"
    ? [
      { kind: "build", en: "A fort.", ru: "" },
      { kind: "keeps", en: "The door.", ru: "Дверь." },
      { kind: "nope", en: "Dropped.", ru: "Нет." },
    ]
    : [{ kind: "keeps", en: "Ask for the fish.", ru: "" }];
  return {
    id,
    accessEn: "Yes.",
    accessRu: "",
    daysEn: "Daily.",
    daysRu: "",
    hours: "Daytime.",
    wikiTitle: id,
    spotSearch,
    notes,
  };
}

test("notes keep a search, drop a url, and clear a meal", () => {
  const stops = [stop("castle", "sight", 38.71), stop("lunch", "food", 38.72)];
  const facts = parseNotes({
    places: [
      row("castle", "sight", "https://evil.example/x.jpg castle door Lisbon"),
      row("lunch", "food", "secret kitchen"),
    ],
  }, stops);
  assert.equal(facts.get("castle").spotSearch, "castle door Lisbon");
  assert.equal(facts.get("castle").notes.length, 2);
  assert.equal(facts.get("castle").notes[0].ru, "A fort.");
  assert.equal(facts.get("castle").access.ru, "Yes.");
  assert.equal(facts.get("lunch").spotSearch, "");
  assert.equal(facts.get("lunch").days.ru, "Daily.");
});

test("a sight needs two facts and a meal needs one", () => {
  const stops = [stop("castle", "sight", 38.71)];
  const thin = row("castle", "sight", "door");
  thin.notes = [{ kind: "keeps", en: "The door.", ru: "Дверь." }];
  assert.throws(() => parseNotes({ places: [thin] }, stops), /notes/);
  assert.throws(() => parseNotes({ places: [] }, [stop("lunch", "food", 1)]), /notes/);
  const closed = row("castle", "sight", "https://evil.example/only.jpg");
  const facts = parseNotes({ places: [closed] }, stops);
  assert.equal(facts.get("castle").spotSearch, "");
  assert.throws(() => parseNotes(null, stops), /notes/);
  const blank = row("castle", "sight", "door");
  blank.accessEn = "";
  assert.throws(() => parseNotes({ places: [blank] }, stops), /notes/);
  const noKeeps = row("castle", "sight", "door");
  noKeeps.notes = [
    { kind: "build", en: "A fort.", ru: "Форт." },
    { kind: "events", en: "A siege.", ru: "Осада." },
  ];
  assert.throws(() => parseNotes({ places: [noKeeps] }, stops), /notes/);
});

test("the map link is a search for one stop and a route for several", () => {
  assert.equal(mapsUrl([]), "");
  assert.match(mapsUrl([{ lat: 1, lon: 2 }]), /search\/\?api=1&query=1,2/);
  const url = mapsUrl([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 }]);
  assert.match(url, /origin=1,2/);
  assert.match(url, /destination=5,6/);
  assert.match(url, /3%2C4/);
});
