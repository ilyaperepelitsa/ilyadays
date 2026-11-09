// scripts/fitness-image-index.mjs: content/fitness/images.json is written from the pictures on disk — angle order,
// ?v= hashes, files that match no registry id — and `--check` fails while it is stale. Fixtures live in throwaway
// checkouts; the real index is only read.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { ANGLES, INDEX_FILE, buildImageIndex, imageVersion, main, serializeIndex } from "../../scripts/fitness-image-index.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCRIPT = path.join(ROOT, "scripts/fitness-image-index.mjs");
const REGISTRY = {
  exercises: { "pec-deck": { slice: "chest-shoulders" }, "lat-pulldown": { slice: "back-neck" } },
  groups: [{ id: "chest" }, { id: "back" }],
};
/** @param {string} text */
const v8 = (text) => createHash("sha1").update(text).digest("hex").slice(0, 8);
/** The pictures of the fixture checkout (bytes are short texts; only their hash matters). */
const PICTURES = {
  "exercises/pec-deck/side.webp": "pec side",
  "exercises/pec-deck/sequence.webp": "pec sequence",
  "exercises/pec-deck/front.webp": "pec front",
  "exercises/pec-deck/back.webp": "pec back",
  "exercises/pec-deck/notes.txt": "not a picture",
  "exercises/ghost-machine/sequence.webp": "no such exercise",
  "machines/pec-deck.webp": "pec machine",
  "machines/old-press.webp": "retired machine",
  "machines/readme.md": "not a picture",
  "muscles/chest.webp": "chest map",
  "muscles/legs.webp": "not a registry group",
};

/** @type {string[]} */
const temps = [];
after(() => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

/** A checkout with the registry, the script and the given pictures; `empty` lists empty exercise folders. */
function checkout(pictures = PICTURES, empty = ["lat-pulldown"]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fitness-images-"));
  temps.push(root);
  fs.mkdirSync(path.join(root, "content/fitness"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"));
  fs.writeFileSync(path.join(root, "content/fitness/registry.json"), JSON.stringify(REGISTRY));
  fs.copyFileSync(SCRIPT, path.join(root, "scripts/fitness-image-index.mjs"));
  const media = path.join(root, "public/media/fitness");
  for (const [rel, text] of Object.entries(pictures)) {
    fs.mkdirSync(path.dirname(path.join(media, rel)), { recursive: true });
    fs.writeFileSync(path.join(media, rel), text);
  }
  for (const id of empty) fs.mkdirSync(path.join(media, "exercises", id), { recursive: true });
  return root;
}
const shot = (/** @type {string} */ angle) => ({ angle, src: `fitness/exercises/pec-deck/${angle}.webp`, v: v8(`pec ${angle}`) });
const EXPECTED = {
  exercises: { "pec-deck": [shot("sequence"), shot("side"), shot("back"), shot("front")] },
  machines: { "pec-deck": { src: "fitness/machines/pec-deck.webp", v: v8("pec machine") } },
  muscles: { chest: { src: "fitness/muscles/chest.webp", v: v8("chest map") } },
};

describe("buildImageIndex", () => {
  it("indexes registry pictures: sequence, side, then other angles alphabetically, each with its ?v= hash", () => {
    assert.deepEqual(ANGLES, ["sequence", "side"]);
    const { index, stray } = buildImageIndex(checkout());
    assert.deepEqual(index, EXPECTED);
    assert.equal("lat-pulldown" in index.exercises, false, "an empty folder is no entry");
    assert.deepEqual(stray, ["exercises/ghost-machine/sequence.webp", "machines/old-press.webp", "muscles/legs.webp"]);
  });

  it("is empty, not an error, before any picture exists", () => {
    assert.deepEqual(buildImageIndex(checkout({}, [])), { index: { exercises: {}, machines: {}, muscles: {} }, stray: [] });
  });

  it("hashes the bytes: first 8 hex digits of the SHA-1, new when the picture changes", () => {
    const root = checkout({ "machines/pec-deck.webp": "v1" }, []);
    const file = path.join(root, "public/media/fitness/machines/pec-deck.webp");
    assert.equal(imageVersion(file), v8("v1"));
    fs.writeFileSync(file, "v2");
    assert.equal(imageVersion(file), v8("v2"));
    assert.equal(buildImageIndex(root).index.machines["pec-deck"].v, v8("v2"));
  });

  it("serializes with one-space indentation and a final newline (the committed file's format)", () => {
    assert.equal(serializeIndex({ machines: { a: { src: "x", v: "1" } } }), '{\n "machines": {\n  "a": {\n   "src": "x",\n   "v": "1"\n  }\n }\n}\n');
    assert.equal(INDEX_FILE, "content/fitness/images.json");
  });
});

/** Collects what the command line prints. */
function printer() {
  /** @type {{ log: string[], warn: string[], error: string[] }} */
  const lines = { log: [], warn: [], error: [] };
  const out = { log: (/** @type {string} */ m) => lines.log.push(m), warn: (/** @type {string} */ m) => lines.warn.push(m), error: (/** @type {string} */ m) => lines.error.push(m) };
  return { lines, out };
}

describe("fitness-image-index main()", () => {
  it("--check fails while the index is missing or stale, warns about strays, and never writes", () => {
    const root = checkout();
    const { lines, out } = printer();
    assert.equal(main(["--check"], root, out), 1);
    assert.deepEqual(lines.error, ["content/fitness/images.json is out of date: run node scripts/fitness-image-index.mjs"]);
    assert.deepEqual(lines.warn, [
      "warning: public/media/fitness/exercises/ghost-machine/sequence.webp matches no registry id or group (not indexed)",
      "warning: public/media/fitness/machines/old-press.webp matches no registry id or group (not indexed)",
      "warning: public/media/fitness/muscles/legs.webp matches no registry id or group (not indexed)",
    ]);
    assert.equal(fs.existsSync(path.join(root, INDEX_FILE)), false);
  });

  it("writes the index, then --check passes until a picture is regenerated", () => {
    const root = checkout();
    const write = printer();
    assert.equal(main([], root, write.out), 0);
    assert.deepEqual(write.lines.log, ["wrote content/fitness/images.json: 6 pictures"]);
    assert.equal(fs.readFileSync(path.join(root, INDEX_FILE), "utf8"), serializeIndex(EXPECTED));
    const check = printer();
    assert.equal(main(["--check"], root, check.out), 0);
    assert.deepEqual(check.lines.log, ["content/fitness/images.json is up to date (6 pictures)"]);
    fs.writeFileSync(path.join(root, "public/media/fitness/muscles/chest.webp"), "a regenerated map");
    assert.equal(main(["--check"], root, printer().out), 1, "a regenerated picture needs a new ?v=");
  });
});

describe("fitness-image-index command line", () => {
  /** @param {string} script @param {string[]} args */
  const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

  it("exits 1 on a stale index and 0 after writing it", () => {
    const root = checkout();
    const script = path.join(root, "scripts/fitness-image-index.mjs");
    const stale = run(script, "--check");
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /content\/fitness\/images\.json is out of date/);
    const wrote = run(script);
    assert.equal(wrote.status, 0, wrote.stderr);
    assert.equal(wrote.stdout.trim(), "wrote content/fitness/images.json: 6 pictures");
    assert.equal(run(script, "--check").status, 0);
  });

  it("runs when started through a symlinked folder (macOS /var, a linked checkout) instead of silently doing nothing", () => {
    const root = checkout();
    const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fitness-images-link-")), "linked");
    temps.push(path.dirname(link));
    fs.symlinkSync(root, link);
    const r = run(path.join(link, "scripts/fitness-image-index.mjs"), "--check");
    assert.equal(r.status, 1, `stale index must fail --check; stdout ${JSON.stringify(r.stdout)}`);
    assert.match(r.stderr, /is out of date/);
  });
});
