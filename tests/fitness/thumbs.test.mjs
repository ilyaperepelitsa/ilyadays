// Exercise thumbnails (scripts/fitness-thumbs.py): every exercise has a small, current, square thumb of one panel.
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

const SIZE = 216;
const thumbFile = (id) => path.join(ROOT, "public/media/fitness/thumbs/exercises", id, "sequence.webp");

describe("fitness exercise thumbnails", () => {
  // One thumb per exercise, cut from its technique picture; the side views are never shown small.
  const sequences = Object.entries(images.exercises).flatMap(([id, list]) => list.filter((img) => img.angle === "sequence").map((img) => ({ id, ...img })));

  it("exist for every technique picture, made from its current version", () => {
    assert.ok(sequences.length > 100, `only ${sequences.length} technique pictures indexed`);
    assert.equal(new Set(sequences.map((s) => s.id)).size, sequences.length);
    for (const img of sequences) {
      assert.ok(fs.existsSync(thumbFile(img.id)), `missing thumb for ${img.src}: run python3 scripts/fitness-thumbs.py`);
      assert.equal(manifest.thumbs[img.id]?.v, img.v, `thumb of ${img.src} was made from an older picture: run python3 scripts/fitness-thumbs.py`);
      assert.match(manifest.thumbs[img.id].key, /^[0-9a-f]{8}$/);
    }
  });

  it("have no leftovers: every thumb file, manifest entry and override belongs to a pictured exercise", () => {
    const ids = new Set(sequences.map((s) => s.id));
    const dir = path.join(ROOT, "public/media/fitness/thumbs/exercises");
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => fs.readdirSync(path.join(dir, d.name)).map((f) => `${d.name}/${f}`));
    assert.deepEqual(files.sort(), [...ids].map((id) => `${id}/sequence.webp`).sort());
    assert.deepEqual(Object.keys(manifest.thumbs).sort(), [...ids].sort());
    for (const [id, o] of Object.entries(manifest.overrides)) {
      assert.ok(ids.has(id), `override for an unknown exercise: ${id}`);
      for (const key of Object.keys(o)) assert.ok(["panel", "box", "zoom", "whole"].includes(key), `${id}: unknown override ${key}`);
      if ("panel" in o) assert.ok(["start", "end"].includes(o.panel), `${id}: panel ${o.panel}`);
      if ("box" in o) assert.ok(o.box.length === 4 && o.box[0] < o.box[2] && o.box[1] < o.box[3], `${id}: box ${o.box}`);
      if ("zoom" in o) assert.ok(o.zoom >= 1 && o.zoom <= 4, `${id}: zoom ${o.zoom}`);
    }
  });

  it(`are ${SIZE} px squares (3x the 72 px list thumb) and stay small`, () => {
    let total = 0;
    for (const img of sequences) {
      const thumb = fs.readFileSync(thumbFile(img.id));
      assert.deepEqual(webpSize(thumb), { width: SIZE, height: SIZE }, img.src);
      assert.ok(thumb.length > 800, `${img.src} thumb is ${thumb.length} bytes: an empty crop?`);
      assert.ok(thumb.length < 12_000, `${img.src} thumb is ${thumb.length} bytes`);
      total += thumb.length;
    }
    assert.ok(total / sequences.length < 6_500, `thumbs average ${Math.round(total / sequences.length)} bytes`);
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
