#!/usr/bin/env node
/** Write public/offline-catalog.json and the asset helper the service worker loads. */
import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "../src/lib/offline/catalog.mjs";

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
  .sort();

const catalog = buildCatalog(slugs, walk(PUBLIC));
fs.writeFileSync(path.join(PUBLIC, "offline-catalog.json"), JSON.stringify(catalog));

const helper = fs.readFileSync(path.join(ROOT, "src/lib/offline/assets.mjs"), "utf8").replace(/^export /gm, "");
fs.writeFileSync(path.join(PUBLIC, "offline-assets.js"), `${helper}\nself.extractAssetUrls = extractAssetUrls;\nself.sameOriginPath = sameOriginPath;\n`);

console.log(`offline catalog: ${catalog.pages.length} pages, ${catalog.files.length} files, ${catalog.bytes} bytes`);
