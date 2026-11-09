#!/usr/bin/env node
/** Write public/offline-catalog.json and the asset helper the service worker loads. */
import fs from "node:fs";
import path from "node:path";
import { buildCatalog, fitnessPages } from "../src/lib/offline/catalog.mjs";
import { integratedDestination } from "../src/lib/food/integrated-recipes.mjs";
import { contentMediaVersions, fileVersion } from "./file-version.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIC = path.join(ROOT, "public");

/**
 * @param {string} dir
 * @returns {{ rel: string, bytes: number }[]}
 */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!entry.isFile()) return [];
    return [{ rel: path.relative(PUBLIC, full).split(path.sep).join("/"), bytes: fs.statSync(full).size }];
  });
}

const slugs = fs
  .readdirSync(path.join(ROOT, "content/en/recipes"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.slice(0, -5))
  .filter(slug=>!integratedDestination(slug))
  .sort();

// The URLs pages really request: media with the `?v=` from the content (card thumbnails share their picture's),
// and the Istanbul app with the version src/components/travel/IstanbulApp.tsx gets from next.config.ts.
const files = walk(PUBLIC);
const media = contentMediaVersions(path.join(ROOT, "content"));
/** @type {Map<string, string>} */
const versions = new Map();
for (const { rel } of files) {
  const under = rel.replace(/^media\//, "");
  const original = under.replace(/^thumbs\//, "");
  if (rel.startsWith("media/") && media.has(under)) versions.set(rel, media.get(under));
  else if (rel.startsWith("media/thumbs/") && media.has(original)) versions.set(rel, media.get(original));
  else if (rel.startsWith("apps/istanbul/")) versions.set(rel, fileVersion(path.join(PUBLIC, rel)));
}
// Fitness: every exercise page and science topic, and the diagrams under the `?v=` the pages request.
const readJson = (rel, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return fallback;
  }
};
const exerciseIds = readJson("content/fitness/exercises.json", []).map((exercise) => exercise.id).filter(Boolean);
const scienceDir = path.join(ROOT, "content/fitness/science");
const topics = fs.existsSync(scienceDir)
  ? fs.readdirSync(scienceDir).filter((name) => name.endsWith(".en.md")).map((name) => name.slice(0, -6)).sort()
  : [];
const images = readJson("content/fitness/images.json", {});
const fitnessImages = [
  ...Object.values(images.exercises ?? {}).flat(),
  ...Object.values(images.machines ?? {}),
  ...Object.values(images.muscles ?? {}),
];
for (const image of fitnessImages) {
  if (image && typeof image.src === "string" && typeof image.v === "string") {
    const rel = image.src.replace(/^\/?(media\/)?/, "");
    versions.set(`media/${rel}`, image.v);
    // card thumbnails (scripts/fitness-thumbs.py) are requested with their picture's ?v=
    const thumb = rel.replace(/^fitness\/exercises\//, "fitness/thumbs/exercises/");
    if (thumb !== rel && fs.existsSync(path.join(PUBLIC, "media", thumb))) versions.set(`media/${thumb}`, image.v);
  }
}
const catalog = buildCatalog(slugs, files, versions, fitnessPages(exerciseIds, topics));
fs.writeFileSync(path.join(PUBLIC, "offline-catalog.json"), JSON.stringify(catalog));

const helper = fs.readFileSync(path.join(ROOT, "src/lib/offline/assets.mjs"), "utf8").replace(/^export /gm, "");
fs.writeFileSync(path.join(PUBLIC, "offline-assets.js"), `${helper}\nself.extractAssetUrls = extractAssetUrls;\nself.sameOriginPath = sameOriginPath;\n`);

console.log(`offline catalog: ${catalog.pages.length} pages, ${catalog.files.length} files, ${catalog.bytes} bytes`);
