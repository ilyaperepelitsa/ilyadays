import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { enrichStop, isFreeLicense, shortAuthor } from "../../src/lib/trips/enrich.mjs";
import { stop } from "./fixtures.mjs";

describe("wikipedia and commons", { concurrency: false }, () => {
test("a free license is public domain, CC BY, CC0 or FAL", () => {
  for (const license of ["CC BY-SA 4.0", "CC-BY-4.0", "Public domain", "CC0", "FAL", "Free Art License"]) {
    assert.equal(isFreeLicense(license), true, license);
  }
  for (const license of ["", "All rights reserved", "No restrictions", "CC BY-NC 4.0", "CC BY-NC-SA 4.0", "noncommercial"]) {
    assert.equal(isFreeLicense(license), false, license);
  }
});

test("a credit keeps the person and drops the file boilerplate", () => {
  assert.equal(shortAuthor("File:Door.jpg: Photograph: Ada Lovelace derivative work: x"), "Ada Lovelace");
  assert.equal(shortAuthor("<a href=\"https://commons.wikimedia.org\">Ada</a> This is a panorama."), "Ada");
  assert.equal(shortAuthor("User:Ada"), "Ada");
  assert.equal(shortAuthor(""), "Unknown author");
});

/**
 * @param {(url: URL) => unknown} handler
 */
function wiki(handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const body = handler(new URL(String(url)));
    if (!body) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
  return () => { globalThis.fetch = previous; };
}

function image(title, { license = "CC BY-SA 4.0", mime = "image/jpeg", author = "Ada" } = {}) {
  const file = title.startsWith("File:") ? title : `File:${title}`;
  return {
    query: {
      pages: [{
        imageinfo: [{
          mime,
          thumburl: `https://thumb.wikimedia.org/${encodeURIComponent(file)}.jpg?utm=1`,
          descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(file)}`,
          extmetadata: { LicenseShortName: { value: license }, Artist: { value: author } },
        }],
      }],
    },
  };
}

function article(title, { lat = 38.713, lon = -9.14, imageName = "Castle.jpg", missing = false } = {}) {
  return {
    query: {
      pages: [{
        title,
        missing: missing || undefined,
        langlinks: [{ lang: "ru", title: "Замок" }],
        pageimage: imageName,
        coordinates: [{ lat, lon }],
      }],
    },
  };
}

function sightFacts(spotSearch = "castle door") {
  return {
    access: { en: "Yes.", ru: "Да." },
    days: { en: "Daily.", ru: "Ежедневно." },
    hours: "Daytime.",
    wikiTitle: "Castle",
    spotSearch,
    notes: [
      { kind: "build", en: "Old.", ru: "Старое." },
      { kind: "keeps", en: "The door.", ru: "Дверь." },
    ],
  };
}

test("a nearby free picture is kept and the locator is a different file", async () => {
  const seen = [];
  const restore = wiki((url) => {
    seen.push(url.searchParams.get("titles") || url.searchParams.get("srsearch"));
    if (url.hostname.startsWith("en.")) return article("Castle");
    if (url.searchParams.get("list") === "search") return { query: { search: [{ title: "File:Door.jpg" }, { title: "File:Logo.jpg" }] } };
    if (url.searchParams.get("titles") === "File:Castle.jpg") return image("Castle.jpg");
    if (url.searchParams.get("titles") === "File:Door.jpg") return image("Door.jpg", { author: "Photograph: Bea" });
    return null;
  });
  try {
    const place = await enrichStop(stop("castle", "sight", 38.71), sightFacts("door"), "Lisbon");
    assert.match(place.wiki.en, /Castle$/);
    assert.match(place.wiki.ru, /%D0%97%D0%B0%D0%BC%D0%BE%D0%BA/);
    assert.equal(place.photo.license, "CC BY-SA 4.0");
    assert.equal(place.photo.thumb.includes("?"), false);
    assert.match(place.notes[1].image.page, /Door\.jpg/);
    assert.equal(place.notes[1].image.author, "Bea");
    assert.ok(seen.some((item) => item === "door Lisbon"));
  } finally {
    restore();
  }
});

test("five kilometres is the edge, and a picture with no coordinates stays", async () => {
  const near = wiki((url) => (url.hostname.startsWith("en.") ? article("Castle", { lat: 38.74, imageName: "Castle.jpg" }) : image("Castle.jpg")));
  try {
    const place = await enrichStop(stop("castle", "sight", 38.71), sightFacts(""), "Lisbon");
    assert.match(place.photo.page, /Castle\.jpg/);
  } finally {
    near();
  }
  const far = wiki((url) => (url.hostname.startsWith("en.") ? article("Castle", { lat: 38.76, imageName: "Castle.jpg" }) : image("Castle.jpg")));
  try {
    const place = await enrichStop(stop("castle", "sight", 38.71), sightFacts(""), "Lisbon");
    assert.equal(place.photo, undefined);
  } finally {
    far();
  }
  const unpinned = wiki((url) => {
    if (!url.hostname.startsWith("en.")) return image("Castle.jpg");
    const page = article("Castle", { imageName: "Castle.jpg" });
    delete page.query.pages[0].coordinates;
    return page;
  });
  try {
    const place = await enrichStop(stop("castle", "sight", 38.71), sightFacts(""), "Lisbon");
    assert.match(place.photo.page, /Castle\.jpg/);
  } finally {
    unpinned();
  }
});

test("a meal does not search Commons", async () => {
  const seen = [];
  const restore = wiki((url) => {
    seen.push(url.searchParams.get("list") || "page");
    if (url.hostname.startsWith("en.")) return article("Lunch", { imageName: "" });
    return { query: { search: [{ title: "File:Kitchen.jpg" }] } };
  });
  try {
    const facts = sightFacts("secret kitchen");
    facts.wikiTitle = "Lunch";
    await enrichStop(stop("lunch", "food", 38.72), facts, "Lisbon");
    assert.equal(seen.includes("search"), false);
  } finally {
    restore();
  }
});

test("a picture more than five kilometres away is left off", async () => {
  const restore = wiki((url) => {
    if (url.hostname.startsWith("en.")) return article("Castle", { lat: 41.1, imageName: "Castle.jpg" });
    if (url.searchParams.get("titles") === "File:Castle.jpg") return image("Castle.jpg");
    return { query: { search: [] } };
  });
  try {
    const place = await enrichStop(stop("castle", "sight", 38.71), sightFacts(""), "Lisbon");
    assert.equal(place.photo, undefined);
    assert.match(place.wiki.en, /Castle$/);
    assert.equal(place.notes[1].image, undefined);
  } finally {
    restore();
  }
});

test("a non-free, svg, logo or duplicate file is skipped", async () => {
  const restore = wiki((url) => {
    if (url.hostname.startsWith("en.")) return article("Castle", { imageName: "Castle.svg" });
    if (url.searchParams.get("list") === "search") {
      return { query: { search: [{ title: "File:Logo mark.jpg" }, { title: "File:Castle.jpg" }, { title: "File:Door.jpg" }] } };
    }
    const title = url.searchParams.get("titles");
    if (title === "File:Castle.svg") return image("Castle.svg", { mime: "image/svg+xml" });
    if (title === "File:Castle.jpg") return image("Castle.jpg", { license: "CC BY-NC 4.0" });
    if (title === "File:Door.jpg") return image("Door.jpg");
    return null;
  });
  try {
    const place = await enrichStop(stop("castle", "sight", 38.71), sightFacts("door"), "Lisbon");
    assert.equal(place.photo, undefined);
    assert.match(place.notes[1].image.page, /Door\.jpg/);
  } finally {
    restore();
  }
});

test("the same file is not used as both the place and the locator", async () => {
  const restore = wiki((url) => {
    if (url.hostname.startsWith("en.")) return article("Castle", { imageName: "Door.jpg" });
    if (url.searchParams.get("list") === "search") return { query: { search: [{ title: "File:Door.jpg" }] } };
    return image("Door.jpg");
  });
  try {
    const place = await enrichStop(stop("castle", "sight", 38.71), sightFacts("door Lisbon"), "Lisbon");
    assert.match(place.photo.page, /Door\.jpg/);
    assert.equal(place.notes[1].image, undefined);
  } finally {
    restore();
  }
});

test("a missing article is searched, and a failed lookup still returns the stop", async () => {
  let searches = 0;
  const restore = wiki((url) => {
    if (url.searchParams.get("list") === "search") {
      searches += 1;
      return { query: { search: [{ title: "Castle of Lisbon" }] } };
    }
    if (url.hostname.startsWith("en.") && url.searchParams.get("titles") === "Castle of Lisbon") {
      return article("Castle of Lisbon", { imageName: "" });
    }
    if (url.hostname.startsWith("en.")) return { query: { pages: [{ missing: true }] } };
    return { query: { search: [] } };
  });
  try {
    const facts = sightFacts("");
    facts.wikiTitle = "";
    const place = await enrichStop(stop("castle", "sight", 38.71), facts, "Lisbon");
    assert.equal(searches, 1);
    assert.match(place.wiki.en, /Castle_of_Lisbon/);
  } finally {
    restore();
  }
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const offline = await enrichStop(stop("lunch", "food", 38.72), { ...sightFacts("secret"), wikiTitle: "Lunch" }, "Lisbon");
    assert.equal(offline.wiki.en, "");
    assert.equal(offline.notes[0].image, undefined);
  } finally {
    globalThis.fetch = previous;
  }
});
});
