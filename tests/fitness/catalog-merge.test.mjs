// scripts/fitness-catalog-merge.mjs: merges content/fitness/exercises/<slice>.json into content/fitness/exercises.json
// and refuses (exit 1, nothing written) when any row breaks the registry or the type unions. The CLI runs on copies
// of the script inside throwaway checkouts, so the real catalog is never touched.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { EQUIPMENT, main, mergeCatalog, movementPatterns, serializeCatalog } from "../../scripts/fitness-catalog-merge.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCRIPT = path.join(ROOT, "scripts/fitness-catalog-merge.mjs");

/* ------------------------------------------------------------------ a tiny registry with two slices */

const REGISTRY = {
  version: "test",
  slices: ["push", "pull"],
  groups: [{ id: "chest", name: { en: "Chest", ru: "Грудь" }, region: "front", order: 0 }],
  muscles: [{ id: "pec-sternal", group: "chest" }, { id: "lats", group: "back" }, { id: "biceps", group: "arms" }],
  classes: [],
  exercises: {
    "press-a": { class: "horizontal-press", classes: ["horizontal-press"], slice: "push", pattern: "horizontal-push" },
    "press-b": { class: "horizontal-press", classes: ["horizontal-press"], slice: "push", pattern: "horizontal-push" },
    "row-a": { class: "horizontal-pull", classes: ["horizontal-pull"], slice: "pull", pattern: "horizontal-pull" },
  },
  ownerTemplate: { days: [{ key: "A", slots: [["A1", "press-a"], ["A2", "row-a"]] }] },
};
const TYPES = 'export type MovementPattern =\n  | "horizontal-push"\n  | "horizontal-pull"\n  | "chest-fly";\n';
const IDS = Object.keys(REGISTRY.exercises);
const OWNER_IDS = ["press-a", "row-a"];

/** A valid slice row; `over` replaces fields (undefined deletes one). @param {string} id @param {Record<string, unknown>} [over] */
function row(id, over = {}) {
  const reg = REGISTRY.exercises[/** @type {keyof typeof REGISTRY.exercises} */ (id)];
  /** @type {Record<string, unknown>} */
  const r = {
    id, class: reg?.class ?? "horizontal-press", pattern: reg?.pattern ?? "horizontal-push",
    name: { en: `Exercise ${id}`, ru: `Упражнение ${id}` }, equipment: "selectorized",
    primary: [reg?.pattern === "horizontal-pull" ? "lats" : "pec-sternal"], secondary: ["biceps"],
    difficulty: 1, unilateral: false, supported: true, increment: 5, repRange: [6, 10],
    alternatives: IDS.filter((x) => x !== id).slice(0, 2),
    setup: { en: "Sit tall, feet flat.", ru: "Сядьте ровно, стопы на полу." },
    cues: { en: ["Brace", "Press", "Pause", "Lower slowly"], ru: ["Напрягите пресс", "Жмите", "Пауза", "Опускайте медленно"] },
    mistakes: { en: ["Bouncing", "Shrugging", "Half reps"], ru: ["Отбив", "Плечи вверх", "Неполная амплитуда"] },
    tags: OWNER_IDS.includes(id) ? ["owner-primary"] : [],
  };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete r[k];
    else r[k] = v;
  }
  return r;
}
const goodSlices = () => ({ push: [row("press-a"), row("press-b")], pull: [row("row-a")] });

/** @type {string[]} */
const temps = [];
after(() => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A throwaway checkout with the script, the registry, the type unions and the slices (a string is written as-is;
 * a missing key means no file). @param {Record<string, unknown>} slices @param {string} [dirName]
 */
function checkout(slices, dirName = "checkout") {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "fitness-merge-"));
  temps.push(base);
  const root = path.join(base, dirName);
  for (const dir of ["scripts", "content/fitness/exercises", "src/lib/fitness"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, "scripts/fitness-catalog-merge.mjs"));
  fs.writeFileSync(path.join(root, "content/fitness/registry.json"), JSON.stringify(REGISTRY));
  fs.writeFileSync(path.join(root, "src/lib/fitness/types.ts"), TYPES);
  for (const [name, rows] of Object.entries(slices)) {
    fs.writeFileSync(path.join(root, `content/fitness/exercises/${name}.json`), typeof rows === "string" ? rows : JSON.stringify(rows));
  }
  return root;
}
/** @param {string} root @param {string[]} args */
const cli = (root, ...args) => spawnSync(process.execPath, [path.join(root, "scripts/fitness-catalog-merge.mjs"), ...args], { encoding: "utf8" });
/** @param {string} root */
const catalogFile = (root) => path.join(root, "content/fitness/exercises.json");

/* ------------------------------------------------------------------ the command line */

describe("fitness-catalog-merge command line", () => {
  it("passes --check on the real slices (the build's catalog)", () => {
    const run = spawnSync(process.execPath, [SCRIPT, "--check"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "fitness catalog: 138 exercises OK (check only)");
  });

  it("writes exercises.json in registry order, with images defaulted to [], only when every check passes", () => {
    const root = checkout({ push: [row("press-b"), row("press-a", { images: [{ angle: "side" }] })], pull: [row("row-a")] });
    const ok = cli(root);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout.trim(), "fitness catalog: 3 exercises OK → content/fitness/exercises.json");
    const text = fs.readFileSync(catalogFile(root), "utf8");
    const merged = JSON.parse(text);
    assert.deepEqual(merged.map((/** @type {{id: string}} */ e) => e.id), ["press-a", "press-b", "row-a"], "registry order, not slice order");
    assert.deepEqual(merged[0].images, [{ angle: "side" }]);
    assert.deepEqual(merged[1].images, []);
    assert.ok(text.endsWith("\n") && text.startsWith('[\n {\n  "id": "press-a"'), "one-space JSON with a final newline");

    fs.writeFileSync(path.join(root, "content/fitness/exercises/pull.json"), JSON.stringify([row("row-a", { equipment: "trx" })]));
    const bad = cli(root);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /^fitness catalog: 1 problem\(s\)\n - row-a: equipment "trx" not in the Equipment union\n$/);
    assert.equal(fs.readFileSync(catalogFile(root), "utf8"), text, "a failed merge leaves the last good catalog alone");
  });

  it("never writes with --check or --slice", () => {
    const root = checkout(goodSlices());
    const check = cli(root, "--check");
    assert.equal(check.status, 0, check.stderr);
    assert.equal(check.stdout.trim(), "fitness catalog: 3 exercises OK (check only)");
    const slice = cli(root, "--slice", "push");
    assert.equal(slice.status, 0, slice.stderr);
    assert.equal(slice.stdout.trim(), "fitness catalog: 2 exercises OK (slice push, check only)");
    assert.equal(fs.existsSync(catalogFile(root)), false);
  });

  it("refuses an unknown slice name with exit code 2", () => {
    const run = cli(checkout(goodSlices()), "--slice", "legs");
    assert.equal(run.status, 2);
    assert.equal(run.stderr.trim(), "unknown slice legs; one of push, pull");
  });

  it("works from a checkout whose path has spaces and Cyrillic letters", () => {
    const run = cli(checkout(goodSlices(), "мои проекты/ilya days"), "--check");
    assert.equal(run.status, 0, run.stderr.slice(0, 500));
    assert.equal(run.stdout.trim(), "fitness catalog: 3 exercises OK (check only)");
  });

  it("reports cue and mistake lists without a language as problems instead of crashing", () => {
    const root = checkout({
      push: [row("press-a", { cues: { en: ["Brace", "Press", "Pause", "Lower"] } }), row("press-b", { mistakes: { ru: ["Отбив", "Плечи", "Амплитуда"] } })],
      pull: [row("row-a")],
    });
    const run = cli(root);
    assert.equal(run.status, 1);
    assert.doesNotMatch(run.stderr, /TypeError|at file:/, "a stack trace instead of the report");
    assert.match(run.stderr, /press-a: cues need ≥ 4 in en and ru/);
    assert.match(run.stderr, /press-b: mistakes need ≥ 3 in en and ru/);
    assert.equal(fs.existsSync(catalogFile(root)), false);
  });
});

/* ------------------------------------------------------------------ the checks, in process */

const PATTERNS = movementPatterns(TYPES);
/** Slice texts as the command line reads them; null = no file. @param {Record<string, unknown>} slices */
const texts = (slices) => Object.fromEntries(Object.entries(slices).map(([k, v]) => [k, v === null || typeof v === "string" ? v : JSON.stringify(v)]));
/** @param {Record<string, unknown>} slices @param {string | null} [slice] @param {any} [registry] */
const merge = (slices, slice = null, registry = REGISTRY) => mergeCatalog({ registry, slices: texts(slices), patterns: PATTERNS, slice });
/** Problems when press-b (not in the owner template) carries `over`. @param {Record<string, unknown>} over */
const problemsOf = (over) => merge({ push: [row("press-a"), row("press-b", over)], pull: [row("row-a")] }).problems;

describe("mergeCatalog", () => {
  it("the shipped content/fitness/exercises.json is exactly the merge of the five slices", () => {
    const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "content/fitness/registry.json"), "utf8"));
    /** @type {Record<string, string>} */
    const slices = {};
    for (const name of registry.slices) slices[name] = fs.readFileSync(path.join(ROOT, `content/fitness/exercises/${name}.json`), "utf8");
    const patterns = movementPatterns(fs.readFileSync(path.join(ROOT, "src/lib/fitness/types.ts"), "utf8"));
    const { problems, merged } = mergeCatalog({ registry, slices, patterns });
    assert.deepEqual(problems, []);
    assert.equal(merged.length, Object.keys(registry.exercises).length);
    assert.equal(serializeCatalog(merged), fs.readFileSync(path.join(ROOT, "content/fitness/exercises.json"), "utf8"), "a slice changed without re-running the merge");
  });

  it("reads the MovementPattern union from types.ts and knows the Equipment union", () => {
    assert.deepEqual([...PATTERNS], ["horizontal-push", "horizontal-pull", "chest-fly"]);
    assert.throws(() => movementPatterns("export type Equipment = \"cable\";"), /no MovementPattern union/);
    assert.equal(EQUIPMENT.size, 10);
    assert.ok(EQUIPMENT.has("plate-loaded") && EQUIPMENT.has("assisted") && !EQUIPMENT.has("trx"));
  });

  it("merges valid rows in registry order and keeps or defaults images", () => {
    const { problems, merged } = merge({ push: [row("press-b", { images: [{ angle: "side" }] }), row("press-a")], pull: [row("row-a")] });
    assert.deepEqual(problems, []);
    assert.deepEqual(merged.map((e) => e.id), ["press-a", "press-b", "row-a"]);
    assert.deepEqual(merged.map((e) => e.images), [[], [{ angle: "side" }], []]);
  });

  it("names the row and the broken rule, one line per problem", () => {
    /** @type {[Record<string, unknown>, string[]][]} */
    const cases = [
      [{ name: { en: "", ru: "Жим" } }, ["name needs en + ru"]],
      [{ equipment: "trx" }, ['equipment "trx" not in the Equipment union']],
      [{ pattern: "lunge" }, ['pattern "lunge" not in the MovementPattern union', 'pattern "lunge" differs from registry "horizontal-push"']],
      [{ pattern: "chest-fly" }, ['pattern "chest-fly" differs from registry "horizontal-push"']],
      [{ class: "chest-fly" }, ['class "chest-fly" differs from registry "horizontal-press"']],
      [{ primary: "pec-sternal" }, ["primary must be an array"]],
      [{ primary: [] }, ["needs at least one primary muscle"]],
      [{ secondary: ["glutes", "biceps"] }, ['secondary muscle "glutes" not in registry']],
      [{ secondary: undefined }, ["secondary must be an array"]],
      [{ difficulty: 4 }, ["difficulty must be 1, 2 or 3"]],
      [{ unilateral: "no" }, ["unilateral and supported must be booleans"]],
      [{ supported: undefined }, ["unilateral and supported must be booleans"]],
      [{ increment: 25 }, ["increment must be a number 0–20 kg"]],
      [{ increment: "5" }, ["increment must be a number 0–20 kg"]],
      [{ repRange: [10, 6] }, ["repRange must be [lo, hi]"]],
      [{ repRange: [0, 6] }, ["repRange must be [lo, hi]"]],
      [{ repRange: [8] }, ["repRange must be [lo, hi]"]],
      [{ repUnit: "minutes" }, ["repUnit must be reps|seconds|meters"]],
      [{ repUnit: "seconds" }, []],
      [{ alternatives: ["press-a"] }, ["needs at least 2 alternatives"]],
      [{ alternatives: "press-a,row-a" }, ["needs at least 2 alternatives"]],
      [{ alternatives: ["press-b", "press-a"] }, ["lists itself as an alternative"]],
      [{ alternatives: ["press-a", "no-such"] }, ['alternative "no-such" is not a registry id']],
      [{ alternatives: ["press-a", "press-a"] }, ["duplicate alternatives"]],
      [{ setup: { en: "Sit tall." } }, ["setup needs en + ru"]],
      [{ cues: { en: ["a", "b", "c"], ru: ["а", "б", "в"] } }, ["cues need ≥ 4 in en and ru"]],
      [{ cues: { en: ["a", "b", "c", "d", "e"], ru: ["а", "б", "в", "г"] } }, ["cues en/ru counts differ"]],
      [{ cues: undefined }, ["cues need ≥ 4 in en and ru"]],
      [{ mistakes: { en: ["a", " ", "c"], ru: ["а", "б", "в"] } }, ["mistakes need ≥ 3 in en and ru"]],
      [{ mistakes: { en: ["a", "b", "c"], ru: ["а", "б", "в", "г"] } }, ["mistakes en/ru counts differ"]],
      [{ startLoad: { kg: -1, source: "a study" } }, ["startLoad must be {kg, source}"]],
      [{ startLoad: { kg: 20 } }, ["startLoad must be {kg, source}"]],
      [{ startLoad: { kg: 20, source: "label on the machine" } }, []],
      [{ lowerBackLoad: "extreme" }, ["lowerBackLoad must be low|moderate|high"]],
      [{ tags: undefined }, ["tags must be an array"]],
    ];
    for (const [over, messages] of cases) assert.deepEqual(problemsOf(over), messages.map((m) => `press-b: ${m}`), JSON.stringify(over));
  });

  it("requires the owner-primary tag on the owner's program exercises only", () => {
    const { problems } = merge({ push: [row("press-a", { tags: [] }), row("press-b", { tags: ["owner-primary"] })], pull: [row("row-a")] });
    assert.deepEqual(problems, ['press-a: owner template exercise must carry the "owner-primary" tag']);
  });

  it("refuses ids that are not kebab-case even when the registry lists them", () => {
    const registry = { ...REGISTRY, exercises: { ...REGISTRY.exercises, Bad_Id: { class: "horizontal-press", slice: "push", pattern: "horizontal-push" } } };
    const { problems } = merge({ push: [row("press-a"), row("press-b"), row("Bad_Id")], pull: [row("row-a")] }, null, registry);
    assert.deepEqual(problems, ["Bad_Id: id is not kebab-case"]);
  });

  it("reports missing, unreadable and malformed slice files, stray rows and duplicates", () => {
    assert.deepEqual(merge({ push: [row("press-a"), row("press-b")], pull: null }).problems, [
      "slice pull: missing content/fitness/exercises/pull.json", "row-a: missing from every slice",
    ]);
    const unreadable = merge({ push: [row("press-a"), row("press-b")], pull: "[{" }).problems;
    assert.equal(unreadable.length, 2);
    assert.match(unreadable[0], /^slice pull: invalid JSON \(.+\)$/);
    assert.deepEqual(merge({ push: [row("press-a"), row("press-b")], pull: { "row-a": row("row-a") } }).problems, [
      "slice pull: not an array", "row-a: missing from every slice",
    ]);
    assert.deepEqual(merge({ push: [row("press-a"), row("press-b")], pull: [null, { name: "no id" }, row("row-a")] }).problems, [
      "slice pull: row without id", "slice pull: row without id",
    ]);
    assert.deepEqual(merge({ push: [row("press-a"), row("press-b"), row("press-z")], pull: [row("row-a")] }).problems, ["press-z: not in registry.json"]);
    assert.deepEqual(merge({ push: [row("press-a"), row("press-b"), row("row-a")], pull: [row("row-a")] }).problems, [
      "row-a: belongs to slice pull, found in push", "row-a: duplicate (also in slice push)",
    ]);
    assert.deepEqual(merge({ push: [row("press-a"), row("press-b")], pull: [row("row-a"), row("row-a")] }).problems, ["row-a: listed twice in slice pull"]);
  });

  it("--slice checks one slice: its own missing rows and owner tags, alternatives against the whole registry", () => {
    const push = merge({ push: [row("press-a"), row("press-b")] }, "push");
    assert.deepEqual(push.problems, []);
    assert.deepEqual(push.merged.map((e) => e.id), ["press-a", "press-b"]);
    assert.deepEqual(merge({ pull: [] }, "pull").problems, ["row-a: missing from slice pull"]);
    assert.deepEqual(merge({ push: [row("press-a", { tags: [] }), row("press-b")] }, "push").problems, ['press-a: owner template exercise must carry the "owner-primary" tag']);
    assert.deepEqual(merge({ pull: [row("row-a", { tags: [] })] }, "push").problems, ["slice push: missing content/fitness/exercises/push.json", "press-a: missing from slice push", "press-b: missing from slice push"]);
  });
});

describe("main() in a checkout", () => {
  /** @returns {{ lines: { log: string[], error: string[] }, out: Pick<Console, "log" | "error"> }} */
  function printer() {
    /** @type {{ log: string[], error: string[] }} */
    const lines = { log: [], error: [] };
    return { lines, out: { log: (/** @type {string} */ m) => lines.log.push(m), error: (/** @type {string} */ m) => lines.error.push(m) } };
  }

  it("writes only a clean full merge and returns the exit code", () => {
    const root = checkout(goodSlices());
    const noName = printer();
    assert.equal(main(["--slice"], root, noName.out), 2);
    assert.deepEqual(noName.lines.error, ["--slice needs a name; one of push, pull"]);
    const check = printer();
    assert.equal(main(["--check"], root, check.out), 0);
    assert.deepEqual(check.lines.log, ["fitness catalog: 3 exercises OK (check only)"]);
    assert.equal(fs.existsSync(catalogFile(root)), false);
    const write = printer();
    assert.equal(main([], root, write.out), 0);
    assert.deepEqual(write.lines.log, ["fitness catalog: 3 exercises OK → content/fitness/exercises.json"]);
    const written = fs.readFileSync(catalogFile(root), "utf8");
    fs.writeFileSync(path.join(root, "content/fitness/exercises/push.json"), JSON.stringify([row("press-a", { difficulty: 0 })]));
    const broken = printer();
    assert.equal(main([], root, broken.out), 1);
    assert.deepEqual(broken.lines.error, ["fitness catalog: 2 problem(s)", " - press-b: missing from every slice", " - press-a: difficulty must be 1, 2 or 3"]);
    assert.equal(fs.readFileSync(catalogFile(root), "utf8"), written);
  });
});
