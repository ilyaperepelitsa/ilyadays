import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileVersion } from "../../scripts/file-version.mjs";

const APP = path.resolve("public/apps/istanbul");

test("the Istanbul app asks for the map data that sits next to it", () => {
  // app.js fetches mapdata.json?v=<hash> itself; a stale copy of either file would load the wrong graph or 404 offline.
  const wanted = readFileSync(path.join(APP, "app.js"), "utf8").match(/mapdata\.json\?v=([0-9a-f]{10})/);
  assert.ok(wanted, "app.js no longer fetches mapdata.json?v=…");
  assert.equal(wanted[1], fileVersion(path.join(APP, "mapdata.json")));
  assert.doesNotThrow(() => JSON.parse(readFileSync(path.join(APP, "mapdata.json"), "utf8")));
});
