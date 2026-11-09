// Stream 07 — image pipeline artefacts: pricing table, style blocks, drawing scenes, manifest, spend cap, prompt log,
// the picture index the site reads (content/fitness/images.json) and the section cover. Pictures are checked by header.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildImageIndex, serializeIndex } from "../../scripts/fitness-image-index.mjs";

const root = path.resolve(import.meta.dirname, "../..");
/** @param {string} file */
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
/** @param {string} file @param {number} n */
const sha1 = (file, n) => createHash("sha1").update(fs.readFileSync(path.join(root, file))).digest("hex").slice(0, n);

const registry = readJson("content/fitness/registry.json");
const QUALITIES = ["low", "medium", "high"];
const SIZES = ["1024x1024", "1024x1536", "1536x1024"];
const BUDGET_USD = 20;
const KINDS = ["sequence", "side", "machine", "muscle-map", "cover"];
const STYLE_BLOCKS = ["base", "mannequin", "sequence", "sequence-pair", "side", "machine", "muscle-map", "negative", "reference",
  "cover"];
const EQUIPMENT = ["selectorized", "plate-loaded", "cable", "barbell", "dumbbell", "bodyweight", "assisted", "smith", "kettlebell", "band"];
const MACHINE_EQUIPMENT = new Set(["selectorized", "plate-loaded", "cable", "assisted", "smith"]);
const IDS = Object.keys(registry.exercises);
const MUSCLE_IDS = new Set(registry.muscles.map((/** @type {{id: string}} */ m) => m.id));
const GROUP_IDS = registry.groups.map((/** @type {{id: string}} */ g) => g.id);
/** The owner's A/B/C program: these get a side view and priority 1. */
const OWNER = registry.ownerTemplate.days.flatMap((/** @type {{slots: [string, string][]}} */ d) => d.slots.map(([, id]) => id));
const KEY_LIKE = /sk-[A-Za-z0-9_-]{16,}/;

/** Width × height of a WebP (VP8 lossy, VP8L lossless or VP8X extended) from its header. @param {Buffer} buf */
function webpSize(buf) {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  return assert.fail(`unknown WebP chunk ${chunk}`);
}

/** Width × height of a JPEG from its first SOF marker. @param {Buffer} buf */
function jpegSize(buf) {
  assert.equal(buf.readUInt16BE(0), 0xffd8, "JPEG SOI");
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = buf.readUInt16BE(i + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return assert.fail("no SOF marker");
}

describe("art/fitness/pricing.json", () => {
  const pricing = readJson("art/fitness/pricing.json");
  const model = pricing.models[pricing.model];

  it("names a current model with a positive price for every quality and size", () => {
    assert.equal(typeof pricing.model, "string");
    assert.ok(model, `models.${pricing.model}`);
    for (const quality of QUALITIES) {
      for (const size of SIZES) {
        const price = model.perImage[quality][size];
        assert.equal(typeof price, "number", `${quality} ${size}`);
        assert.ok(price > 0 && price < 1, `${quality} ${size} = ${price}`);
      }
    }
    assert.ok(model.perImage.low["1536x1024"] < model.perImage.medium["1536x1024"]);
    assert.ok(model.perImage.medium["1536x1024"] < model.perImage.high["1536x1024"]);
  });

  it("carries the token rates the cost estimate needs, consistent with the per-image table", () => {
    for (const rate of ["textInput", "imageInput", "imageOutput"]) assert.ok(model.perMillionTokens[rate] > 0, rate);
    assert.ok(model.inputTokensPerReferenceImage > 0);
    const observed = model.observedOutputImageTokens.medium["1536x1024"];
    const derived = (observed * model.perMillionTokens.imageOutput) / 1e6;
    assert.ok(Math.abs(derived - model.perImage.medium["1536x1024"]) < 0.002, `${derived} vs table`);
  });

  it("has a priced fallback model and cites official sources with a check date", () => {
    assert.ok(pricing.models[pricing.fallbackModel]?.perImage.medium["1536x1024"] > 0, pricing.fallbackModel);
    assert.match(pricing.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(pricing.sources) && pricing.sources.length >= 2);
    for (const source of pricing.sources) {
      assert.match(source.url, /^https:\/\/(developers\.openai\.com|platform\.openai\.com|openai\.com)\//);
      assert.match(source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("art/fitness/STYLE.md", () => {
  const style = fs.readFileSync(path.join(root, "art/fitness/STYLE.md"), "utf8");
  /** @type {Record<string, string>} */
  const blocks = Object.fromEntries([...style.matchAll(/```prompt ([\w-]+)\n([\s\S]*?)\n```/g)].map((m) => [m[1], m[2]]));

  it("defines every prompt block the generator assembles", () => {
    for (const name of STYLE_BLOCKS) assert.ok(blocks[name]?.length > 80, name);
  });

  it("keeps the site colours, the no-text rule, the two panels and the profile view in the prompts", () => {
    assert.match(blocks.base, /#faf6ef/i);
    assert.match(blocks.base, /#b83d0b/i);
    assert.match(blocks.negative, /no text/i);
    assert.match(blocks.cover, /no text/i);
    assert.match(blocks.sequence, /LEFT panel/);
    assert.match(blocks.sequence, /RIGHT panel/);
    assert.match(blocks.sequence, /move with/);
    assert.match(blocks.side, /PROFILE/);
    assert.match(blocks.machine, /No person/i);
  });

  it("keeps the review rules: grey bands, one arrow or one mirrored pair of single-headed arrows", () => {
    assert.match(blocks.base, /band is never orange/);
    assert.match(blocks["sequence-pair"], /exactly TWO curved orange arrows/);
    assert.match(blocks["sequence-pair"], /never a double-headed arrow/);
    assert.match(blocks.negative, /No arrows except the motion arrow or arrows the layout describes/);
  });
});

describe("art/fitness/scenes.json", () => {
  const scenes = readJson("art/fitness/scenes.json");

  it("has drawing directions for every registry exercise and nothing else", () => {
    assert.deepEqual(Object.keys(scenes.exercises).sort(), [...IDS].sort());
    for (const [id, scene] of Object.entries(scenes.exercises)) {
      assert.ok(EQUIPMENT.includes(scene.eq), `${id} equipment ${scene.eq}`);
      for (const field of ["name", "setup", "start", "end", "path"]) {
        assert.ok(typeof scene[field] === "string" && scene[field].length > 3, `${id}.${field}`);
        assert.doesNotMatch(scene[field], /\.\s*$/, `${id}.${field} ends without a full stop`);
      }
      assert.ok(scene.primary.length > 0, `${id} primary`);
      for (const m of [...scene.primary, ...scene.secondary]) assert.ok(MUSCLE_IDS.has(m), `${id} muscle ${m}`);
      if (MACHINE_EQUIPMENT.has(scene.eq) || scene.station) assert.ok(scene.machine?.length > 40, `${id} machine text`);
      if (scene.camera) assert.ok(scenes.cameras[scene.camera], `${id} camera ${scene.camera}`);
      if ("pair" in scene) assert.equal(typeof scene.pair, "boolean", `${id}.pair`);
      for (const kind of scene.fresh ?? []) assert.ok(KINDS.includes(kind), `${id}.fresh ${kind}`);
    }
  });

  it("gives every owner exercise a hardest point for its side view", () => {
    assert.ok(OWNER.length >= 20);
    for (const id of OWNER) assert.ok(scenes.exercises[id]?.hard?.length > 20, `${id}.hard`);
  });

  it("locates every muscle and covers every movement pattern", () => {
    for (const id of MUSCLE_IDS) assert.ok(scenes.muscles[id]?.length > 10, `muscle ${id}`);
    for (const { pattern } of Object.values(registry.exercises)) assert.ok(scenes.patterns[pattern], `pattern ${pattern}`);
    assert.match(scenes.cover, /No people/);
  });
});

describe("art/fitness/manifest.json", () => {
  const manifest = readJson("art/fitness/manifest.json");
  const scenes = readJson("art/fitness/scenes.json");
  /** @type {any[]} */
  const entries = manifest.entries;
  /** @param {string} kind */
  const ofKind = (kind) => entries.filter((e) => e.kind === kind);

  it("lists pictures with key, out, size, quality, prompt, refs, priority and cost", () => {
    const keys = new Set();
    for (const entry of entries) {
      assert.match(entry.key, /^[a-z0-9-]+(\/[a-z0-9-]+)?$/, entry.key);
      assert.ok(!keys.has(entry.key), `duplicate ${entry.key}`);
      keys.add(entry.key);
      assert.ok(KINDS.includes(entry.kind), `${entry.key} kind ${entry.kind}`);
      assert.ok(entry.out.endsWith(".webp"), entry.out);
      assert.ok(SIZES.includes(entry.size), entry.size);
      assert.ok(QUALITIES.includes(entry.quality), entry.quality);
      assert.ok([1, 2, 3, 4, 9].includes(entry.priority), `${entry.key} priority ${entry.priority}`);
      assert.ok(entry.cost > 0 && entry.cost < 0.5, `${entry.key} cost ${entry.cost}`);
      assert.ok(Array.isArray(entry.refs) && entry.refs.every((/** @type {unknown} */ r) => typeof r === "string"), `${entry.key} refs`);
      assert.ok(typeof entry.prompt === "string" && entry.prompt.length > 300, `${entry.key} prompt`);
      assert.match(entry.prompt, /no text/i, `${entry.key} prompt forbids text`);
      assert.match(entry.prompt, /Scene: /, `${entry.key} prompt has a scene`);
    }
  });

  it("follows the file naming contract for every kind", () => {
    for (const e of entries) {
      if (e.kind === "sequence" || e.kind === "side") {
        assert.equal(e.key, `${e.exercise}/${e.kind}`);
        assert.equal(e.out, `public/media/fitness/exercises/${e.exercise}/${e.kind}.webp`);
        assert.equal(e.size, "1536x1024");
        assert.equal(e.width, 1200);
      } else if (e.kind === "machine") {
        assert.equal(e.key, `machines/${e.exercise}`);
        assert.equal(e.out, `public/media/fitness/machines/${e.exercise}.webp`);
        assert.equal(e.width, 1200);
      } else if (e.kind === "muscle-map") {
        assert.equal(e.out, `public/media/fitness/muscles/${e.group}.webp`);
        assert.equal(e.size, "1024x1024");
        assert.equal(e.width, 800);
        assert.equal(e.priority, 4);
      } else {
        assert.equal(e.out, "art/covers/fitness.webp");
        assert.equal(e.priority, 9);
        assert.deepEqual(e.refs, ["art/covers/travel.webp", "art/covers/food.webp"]);
      }
    }
  });

  it("covers every exercise, the owner's side views and machines, and the 14 muscle groups", () => {
    assert.deepEqual(ofKind("sequence").map((e) => e.exercise).sort(), [...IDS].sort());
    const sides = ofKind("side");
    for (const id of OWNER) assert.ok(sides.some((e) => e.exercise === id), `${id}/side`);
    assert.ok(sides.every((e) => e.priority === 1));
    const machines = new Set(ofKind("machine").map((e) => e.exercise));
    for (const id of machines) assert.ok(IDS.includes(id), `machines/${id} is a registry id`);
    for (const id of OWNER) {
      const scene = scenes.exercises[id];
      if (MACHINE_EQUIPMENT.has(scene.eq) || scene.station) assert.ok(machines.has(id), `machines/${id}`);
    }
    assert.deepEqual(ofKind("muscle-map").map((e) => e.group).sort(), [...GROUP_IDS].sort());
    assert.equal(ofKind("cover").length, 1);
    for (const id of OWNER) assert.equal(entries.find((e) => e.key === `${id}/sequence`).priority, 1, id);
  });

  it("is sorted by priority with each tier's sequences first, and matches the current STYLE.md and scenes", () => {
    const priorities = entries.map((e) => e.priority);
    assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b));
    assert.equal(entries[0].key, "machine-chest-press/sequence");
    assert.equal(manifest.styleSha1, sha1("art/fitness/STYLE.md", 10), "STYLE.md changed: run fitness-images.py plan");
    assert.equal(manifest.scenesSha1, sha1("art/fitness/scenes.json", 10), "scenes.json changed: run fitness-images.py plan");
    assert.ok(manifest.estimatedCost < BUDGET_USD, `the whole manifest fits the cap (≈ $${manifest.estimatedCost})`);
  });

  it("draws a symmetric movement (`pair`) with the mirrored pair of arrows and every other sequence with one", () => {
    for (const e of ofKind("sequence")) {
      const pair = scenes.exercises[e.exercise].pair === true;
      assert.equal(e.prompt.includes("The two mirrored orange arrows"), pair, `${e.key} pair arrows`);
      assert.equal(e.prompt.includes("The single orange arrow"), !pair, `${e.key} single arrow`);
    }
  });
});

describe("art/fitness/spend.json and prompts.json", () => {
  const spend = readJson("art/fitness/spend.json");
  const log = readJson("art/fitness/prompts.json");

  it(`stays within the USD ${BUDGET_USD} cap and adds up`, () => {
    assert.equal(spend.currency, "USD");
    assert.ok(spend.total >= 0 && spend.total <= BUDGET_USD, `total ${spend.total}`);
    const sum = spend.images.reduce((/** @type {number} */ acc, /** @type {{cost: number}} */ image) => acc + image.cost, 0);
    assert.ok(Math.abs(sum - spend.total) < 0.001, `${sum} vs ${spend.total}`);
    for (const image of spend.images) {
      assert.ok(image.key && image.cost > 0 && image.at, image.key);
      assert.ok(QUALITIES.includes(image.quality), image.quality);
      assert.ok(["ok", "uncertain"].includes(image.status), `${image.key} status ${image.status}`);
    }
  });

  it("logged the exact prompt of every paid request", () => {
    for (const image of spend.images) {
      const history = log[image.key];
      assert.ok(Array.isArray(history) && history.some((/** @type {{status: string}} */ h) => h.status === image.status), image.key);
      for (const h of history.filter((/** @type {{status: string}} */ h) => h.status === "ok")) {
        assert.ok(h.prompt.length > 300 && h.model && h.size && h.quality && h.out && Array.isArray(h.refs), image.key);
      }
    }
  });

  it("never stores anything that looks like an API key", () => {
    for (const file of ["art/fitness/prompts.json", "art/fitness/spend.json", "art/fitness/manifest.json"]) {
      assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), KEY_LIKE, file);
    }
  });
});

describe("content/fitness/images.json", () => {
  const index = readJson("content/fitness/images.json");

  it("has exactly the contract's shape", () => {
    assert.deepEqual(Object.keys(index).sort(), ["exercises", "machines", "muscles"]);
    for (const [id, shots] of Object.entries(index.exercises)) {
      assert.ok(IDS.includes(id), id);
      assert.ok(Array.isArray(shots) && shots.length > 0, id);
      for (const shot of shots) {
        assert.deepEqual(Object.keys(shot).sort(), ["angle", "src", "v"]);
        assert.equal(shot.src, `fitness/exercises/${id}/${shot.angle}.webp`);
      }
    }
    for (const [id, image] of Object.entries(index.machines)) {
      assert.ok(IDS.includes(id), id);
      assert.equal(image.src, `fitness/machines/${id}.webp`);
    }
    for (const [group, image] of Object.entries(index.muscles)) {
      assert.ok(GROUP_IDS.includes(group), group);
      assert.equal(image.src, `fitness/muscles/${group}.webp`);
    }
  });

  it("is up to date with the pictures on disk (node scripts/fitness-image-index.mjs)", () => {
    const { index: fresh, stray } = buildImageIndex(root);
    assert.deepEqual(stray, []);
    assert.equal(fs.readFileSync(path.join(root, "content/fitness/images.json"), "utf8"), serializeIndex(fresh));
  });

  it("points at existing pictures of the right size whose hash is the ?v=", () => {
    const all = [
      ...Object.values(index.exercises).flat().map((/** @type {any} */ i) => ({ ...i, w: 1200, h: 800 })),
      ...Object.values(index.machines).map((/** @type {any} */ i) => ({ ...i, w: 1200, h: 800 })),
      ...Object.values(index.muscles).map((/** @type {any} */ i) => ({ ...i, w: 800, h: 800 })),
    ];
    assert.ok(all.length >= 3, "the style-test pictures are indexed");
    for (const image of all) {
      const file = `public/media/${image.src}`;
      const buf = fs.readFileSync(path.join(root, file));
      assert.match(image.v, /^[0-9a-f]{8}$/);
      assert.equal(image.v, sha1(file, 8), file);
      assert.deepEqual(webpSize(buf), { w: image.w, h: image.h }, file);
      assert.ok(buf.length > 5 * 1024 && buf.length < 300 * 1024, `${file} ${buf.length} bytes`);
    }
  });
});

describe("fitness cover", () => {
  const cover = path.join(root, "public/covers/fitness.webp");
  const share = path.join(root, "public/share/fitness.jpg");
  const original = path.join(root, "art/covers/fitness.webp");

  it("exists as an 800 px webp tile between 10 KB and 400 KB", () => {
    const buf = fs.readFileSync(cover);
    assert.ok(buf.length > 10 * 1024 && buf.length < 400 * 1024, `${buf.length} bytes`);
    const { w, h } = webpSize(buf);
    assert.equal(w, 800);
    assert.ok(h === 533 || h === 534, `height ${h}`);
  });

  it("has a 1200×630 JPEG link preview between 10 KB and 400 KB", () => {
    const buf = fs.readFileSync(share);
    assert.ok(buf.length > 10 * 1024 && buf.length < 400 * 1024, `${buf.length} bytes`);
    assert.deepEqual(jpegSize(buf), { w: 1200, h: 630 });
  });

  it("keeps the full-size original next to the other covers and is no placeholder copy", () => {
    assert.deepEqual(webpSize(fs.readFileSync(original)), { w: 1536, h: 1024 });
    const travel = fs.readFileSync(path.join(root, "public/share/travel.jpg"));
    assert.ok(!travel.equals(fs.readFileSync(share)), "share image still equals travel.jpg");
  });

  it("has its style-test verdicts recorded", () => {
    const review = fs.readFileSync(path.join(root, "art/fitness/style-review.md"), "utf8");
    for (const key of ["machine-chest-press/sequence", "lat-pulldown/sequence", "machines/pec-deck", "cover"]) {
      assert.ok(review.includes(key), key);
    }
  });
});
