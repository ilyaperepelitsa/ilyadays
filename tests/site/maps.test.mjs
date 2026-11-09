import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { googlePieces, placeLinks, routeLinks, walkLinks } from "../../src/lib/maps.mjs";

const byService = (links) => Object.fromEntries(links.map((link) => [link.service, new URL(link.href)]));

test("a named place is a search in all three maps, kept to the streets around its point", () => {
  const links = byService(placeLinks({ lat: 38.7139, lon: -9.1334, name: "Castle", query: "Castelo de São Jorge, Lisbon" }));
  assert.deepEqual(Object.keys(links), ["google", "yandex", "apple"]);
  assert.equal(links.google.origin + links.google.pathname, "https://www.google.com/maps/search/");
  assert.equal(links.google.searchParams.get("api"), "1");
  assert.equal(links.google.searchParams.get("query"), "Castelo de São Jorge, Lisbon");
  assert.equal(links.yandex.host, "yandex.com");
  assert.equal(links.yandex.searchParams.get("text"), "Castelo de São Jorge, Lisbon");
  assert.equal(links.yandex.searchParams.get("ll"), "-9.1334,38.7139");
  assert.equal(links.yandex.searchParams.get("z"), "17");
  assert.equal(links.yandex.searchParams.get("pt"), null);
  assert.equal(links.apple.origin + links.apple.pathname, "https://maps.apple.com/search");
  assert.equal(links.apple.searchParams.get("query"), "Castelo de São Jorge, Lisbon");
  assert.equal(links.apple.searchParams.get("center"), "38.7139,-9.1334");
  assert.equal(links.apple.searchParams.get("span"), "0.01,0.01");
});

test("a town-wide search widens the area; a bare point drops a named pin", () => {
  const town = byService(placeLinks({ query: "Balık Pazarı, Fethiye", lat: 36.6217, lon: 29.1164, zoom: 14 }, "ru"));
  assert.equal(town.yandex.host, "yandex.ru");
  assert.equal(town.yandex.searchParams.get("z"), "14");
  assert.equal(town.apple.searchParams.get("span"), "0.08,0.08");
  const pin = byService(placeLinks({ lat: 36.75, lon: 28.94, name: "Mooring" }));
  assert.equal(pin.google.searchParams.get("query"), "36.75,28.94");
  assert.equal(pin.yandex.searchParams.get("pt"), "28.94,36.75");
  assert.equal(pin.apple.pathname, "/place");
  assert.equal(pin.apple.searchParams.get("coordinate"), "36.75,28.94");
  assert.equal(pin.apple.searchParams.get("name"), "Mooring");
  const exact = byService(placeLinks({ query: "Pandeli, Eminönü, İstanbul", googlePlaceId: "ChIJMRDAOo25yhQR7c9XIQT1zIo" }));
  assert.equal(exact.google.searchParams.get("query_place_id"), "ChIJMRDAOo25yhQR7c9XIQT1zIo");
  assert.equal(byService(placeLinks({ query: "x", googlePlaceId: "nope" })).google.searchParams.get("query_place_id"), null);
  assert.deepEqual(placeLinks({}), []);
  assert.deepEqual(placeLinks({ lat: Number.NaN, lon: 1 }), []);
});

test("a route walks every stop in order in Google, Yandex and Apple", () => {
  const stops = [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 }];
  const links = byService(routeLinks(stops));
  assert.deepEqual(Object.keys(links), ["google", "yandex", "apple"]);
  assert.equal(links.google.pathname, "/maps/dir/");
  assert.equal(links.google.searchParams.get("origin"), "1,2");
  assert.equal(links.google.searchParams.get("destination"), "5,6");
  assert.equal(links.google.searchParams.get("waypoints"), "3,4");
  assert.equal(links.google.searchParams.get("travelmode"), "walking");
  assert.equal(links.yandex.searchParams.get("rtext"), "1,2~3,4~5,6");
  assert.equal(links.yandex.searchParams.get("rtt"), "pd");
  assert.equal(links.apple.pathname, "/directions");
  assert.equal(links.apple.searchParams.get("source"), "1,2");
  assert.deepEqual(links.apple.searchParams.getAll("waypoint"), ["3,4"]);
  assert.equal(links.apple.searchParams.get("destination"), "5,6");
  assert.equal(links.apple.searchParams.get("mode"), "walking");
  assert.deepEqual(routeLinks([]), []);
});

test("Google gets pieces of five stops that share their ends, so a phone browser drops none", () => {
  assert.deepEqual(googlePieces(5), [[0, 4]]);
  assert.deepEqual(googlePieces(6), [[0, 4], [4, 5]]);
  assert.deepEqual(googlePieces(11), [[0, 4], [4, 8], [8, 10]]);
  const stops = Array.from({ length: 11 }, (_, i) => ({ lat: 40 + i / 100, lon: 29 }));
  const links = routeLinks(stops);
  const google = links.filter((link) => link.service === "google");
  assert.deepEqual(google.map((link) => [link.from, link.to]), [[1, 5], [5, 9], [9, 11]]);
  for (const link of google) assert.ok(new URL(link.href).searchParams.get("waypoints").split("|").length <= 3);
  assert.equal(new URL(google[1].href).searchParams.get("origin"), "40.04,29");
  const yandex = links.find((link) => link.service === "yandex");
  assert.equal(new URL(yandex.href).searchParams.get("rtext").split("~").length, 11);
  assert.equal(links.filter((link) => link.service !== "google").every((link) => link.from == null), true);
});

test("walking to a named place ends at it by name; a food search walks to its point", () => {
  const named = byService(walkLinks({ lat: 41.0087, lon: 28.9713, query: "Çemberlitaş Sütunu, Fatih, İstanbul" }));
  assert.equal(named.google.searchParams.get("destination"), "Çemberlitaş Sütunu, Fatih, İstanbul");
  assert.equal(named.apple.searchParams.get("destination"), "Çemberlitaş Sütunu, Fatih, İstanbul");
  assert.equal(named.yandex.searchParams.get("rtext"), "~41.0087,28.9713");
  const food = byService(walkLinks({ lat: 41.0101, lon: 28.9735, query: "esnaf lokantası", browse: true }));
  assert.equal(food.google.searchParams.get("destination"), "41.0101,28.9735");
});

test("every Turkey shop has a bilingual card, a search inside its town and known sources", () => {
  const data = JSON.parse(readFileSync(new URL("../../content/travel/turkey-yacht-food.json", import.meta.url), "utf8"));
  const sources = new Set(data.sources.map((source) => source.id));
  assert.ok(data.places.length >= 3);
  for (const place of data.places) {
    assert.ok(place.title.en && place.title.ru && place.text.en && place.text.ru, place.id);
    const links = byService(placeLinks({ query: place.query, ...place.area }));
    assert.equal(links.yandex.searchParams.get("text"), place.query, place.id);
    assert.ok(links.yandex.searchParams.get("ll"), `${place.id} needs a search area for Yandex`);
    for (const id of place.sources) assert.ok(sources.has(id), `${place.id}: ${id}`);
  }
});
