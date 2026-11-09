// The fitness part of the offline catalog (src/lib/offline/catalog.mjs): what "Save on this phone" keeps for a gym with
// no signal must be every fitness page the site builds, in both languages, and nothing the site does not serve.
// Inputs mirror scripts/write-offline-catalog.mjs: exercise ids from the catalog, topics that have an English file.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { EXERCISES, exerciseById } from "../../src/lib/fitness/catalog.mjs";
import { scienceDir, topicFiles } from "../../src/lib/fitness/science-core.mjs";
import { buildCatalog, fitnessPages } from "../../src/lib/offline/catalog.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
/** Fitness routes under an App Router folder, as site paths without the language prefix ("/fitness/exercises/[id]"). @param {string} base */
function fitnessRoutes(base) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name === "page.tsx") out.push(`/${path.relative(base, dir).split(path.sep).join("/")}`);
    }
  };
  walk(path.join(base, "fitness"));
  return out.sort();
}
const EN = fitnessRoutes(path.join(ROOT, "src/app/(en)"));
const RU = fitnessRoutes(path.join(ROOT, "src/app/ru"));
const STATIC = EN.filter((r) => !r.includes("["));
const TOPICS = topicFiles(scienceDir(ROOT));
const catalog = buildCatalog([], [], new Map(), fitnessPages(EXERCISES.map((e) => e.id), [...TOPICS].filter(([, langs]) => langs.has("en")).map(([slug]) => slug)));
const fitness = catalog.pages.filter((p) => /^(\/ru)?\/fitness(\/|$)/.test(p));

/** Is there a built page behind this fitness path? @param {string} page */
function served(page) {
  const ru = page.startsWith("/ru/");
  const p = ru ? page.slice(3) : page;
  const lang = ru ? "ru" : "en";
  if ((ru ? RU : EN).includes(p)) return true;
  const ex = /^\/fitness\/exercises\/([^/]+)$/.exec(p);
  if (ex) return (ru ? RU : EN).includes("/fitness/exercises/[id]") && Boolean(exerciseById(ex[1]));
  const topic = /^\/fitness\/science\/([^/]+)$/.exec(p);
  if (topic) return (ru ? RU : EN).includes("/fitness/science/[topic]") && Boolean(TOPICS.get(topic[1])?.has(lang));
  return false;
}

describe("offline copy of the fitness section", () => {
  it("every fitness route exists in English and in Russian", () => {
    assert.deepEqual(RU, EN);
    for (const route of ["/fitness", "/fitness/train", "/fitness/program", "/fitness/gyms", "/fitness/progress", "/fitness/tools", "/fitness/exercises/[id]", "/fitness/science/[topic]"]) {
      assert.ok(EN.includes(route), route);
    }
  });

  it("keeps every static fitness page in both languages (a new route must join the list)", () => {
    for (const route of STATIC) {
      assert.ok(catalog.pages.includes(route), `${route} is not saved for offline use`);
      assert.ok(catalog.pages.includes(`/ru${route}`), `/ru${route} is not saved for offline use`);
    }
  });

  it("keeps every exercise page and every science topic, both languages, each once", () => {
    for (const e of EXERCISES) {
      assert.ok(fitness.includes(`/fitness/exercises/${e.id}`), e.id);
      assert.ok(fitness.includes(`/ru/fitness/exercises/${e.id}`), e.id);
    }
    for (const slug of TOPICS.keys()) {
      assert.ok(fitness.includes(`/fitness/science/${slug}`) && fitness.includes(`/ru/fitness/science/${slug}`), slug);
    }
    assert.equal(fitness.length, 2 * (STATIC.length + EXERCISES.length + TOPICS.size));
    assert.equal(new Set(fitness).size, fitness.length, "no page twice");
  });

  it("lists nothing the site does not build (a dead URL makes the save report a failure)", () => {
    for (const page of fitness) assert.ok(served(page), `${page} has no page behind it`);
  });
});
