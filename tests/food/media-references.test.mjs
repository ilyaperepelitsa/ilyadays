import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { it } from "node:test";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

it("keeps all exported media references and cache hashes valid after optimization", () => {
  let checked = 0;
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === "object") return Object.values(value).forEach(visit);
    if (typeof value !== "string" || !/^(illustrations|share|photos|assets)\//.test(value)) return;
    const [relative, query] = value.split("?");
    const file = path.join(ROOT, "public/media", relative);
    assert.ok(fs.existsSync(file), relative);
    const hash = createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
    assert.equal(query, `v=${hash}`, relative);
    checked++;
  }
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".json")) visit(JSON.parse(fs.readFileSync(file, "utf8")));
    }
  }
  walk(path.join(ROOT, "content"));
  assert.ok(checked > 2000, "cover recipe pages and indexes in both languages");
});

it("retains redirect destinations for deduplicated image URLs", () => {
  const aliases = JSON.parse(fs.readFileSync(path.join(ROOT, "art/media/aliases.json"), "utf8"));
  for (const [from, to] of Object.entries(aliases)) {
    assert.notEqual(from, to);
    assert.ok(!aliases[to], `avoid redirect chains for ${from}`);
    assert.ok(fs.existsSync(path.join(ROOT, "public/media", to)), to);
    assert.ok(!fs.existsSync(path.join(ROOT, "public/media", from)), from);
  }
});
