// Card thumbnails (scripts/fitness-thumbs.py): every exercise picture has a small, current thumb the list can load.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { EXERCISES, thumbUrl } from "../../src/lib/fitness/catalog.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const images = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fitness/images.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "art/fitness/thumbs.json"), "utf8"));

/** Width and height of a WebP file (lossy VP8, lossless VP8L or extended VP8X). @param {Buffer} b */
function webpSize(b) {
  assert.equal(b.toString("ascii", 0, 4), "RIFF");
  assert.equal(b.toString("ascii", 8, 12), "WEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  throw new Error(`unknown WebP chunk ${chunk}`);
}

describe("fitness card thumbnails", () => {
  const entries = Object.entries(images.exercises).flatMap(([id, list]) => list.map((img) => ({ id, ...img })));

  it("exist for every exercise picture, made from its current version", () => {
    assert.ok(entries.length > 100, `only ${entries.length} pictures indexed`);
    for (const img of entries) {
      const rel = img.src.replace(/^fitness\/exercises\//, "");
      const file = path.join(ROOT, "public/media/fitness/thumbs/exercises", rel);
      assert.ok(fs.existsSync(file), `missing thumb for ${img.src}: run python scripts/fitness-thumbs.py`);
      assert.equal(manifest[rel], img.v, `thumb of ${img.src} was made from an older picture: run python scripts/fitness-thumbs.py`);
    }
    assert.equal(Object.keys(manifest).length, entries.length, "the manifest lists thumbs of pictures that no longer exist");
  });

  it("are 360 px wide, keep the picture's shape and stay small", () => {
    for (const img of entries) {
      const rel = img.src.replace(/^fitness\/exercises\//, "");
      const thumb = fs.readFileSync(path.join(ROOT, "public/media/fitness/thumbs/exercises", rel));
      const full = fs.readFileSync(path.join(ROOT, "public/media", img.src));
      const t = webpSize(thumb);
      const f = webpSize(full);
      assert.equal(t.width, 360, img.src);
      assert.ok(Math.abs(t.height / t.width - f.height / f.width) < 0.01, `${img.src}: ${t.width}×${t.height} vs ${f.width}×${f.height}`);
      assert.ok(thumb.length < 40_000, `${img.src} thumb is ${thumb.length} bytes`);
      assert.ok(thumb.length < full.length, `${img.src} thumb is not smaller than the picture`);
    }
  });

  it("are what the list asks for, with the picture's ?v=", () => {
    const ex = EXERCISES.find((e) => e.images?.length);
    const src = ex.images[0].src;
    assert.match(src, /^\/media\/fitness\/exercises\/[a-z0-9-]+\/[a-z]+\.webp\?v=[0-9a-f]{8}$/);
    const url = thumbUrl(src);
    assert.equal(url, src.replace("/media/fitness/exercises/", "/media/fitness/thumbs/exercises/"));
    assert.equal(thumbUrl("/media/fitness/machines/pec-deck.webp?v=1"), "/media/fitness/machines/pec-deck.webp?v=1");
  });
});
