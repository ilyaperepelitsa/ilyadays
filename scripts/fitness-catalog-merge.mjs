#!/usr/bin/env node
/**
 * Merge content/fitness/exercises/<slice>.json into content/fitness/exercises.json and validate it against
 * content/fitness/registry.json. Exit code 1 (and nothing written) when any check fails, so a broken reference
 * never reaches the site.
 *
 *   node scripts/fitness-catalog-merge.mjs                  # merge + validate + write
 *   node scripts/fitness-catalog-merge.mjs --check          # validate only
 *   node scripts/fitness-catalog-merge.mjs --slice <name>   # validate one slice's rows only (never writes)
 *
 * The checks live in `mergeCatalog` (registry, slice texts and MovementPattern ids in; problems and merged rows out),
 * so tests run them without touching the real catalog (tests/fitness/catalog-merge.test.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The Equipment union of src/lib/fitness/types.ts. */
export const EQUIPMENT = new Set(["selectorized", "plate-loaded", "cable", "barbell", "dumbbell", "bodyweight", "assisted", "smith", "kettlebell", "band"]);

/** MovementPattern ids from the text of src/lib/fitness/types.ts. @param {string} typesText @returns {Set<string>} */
export function movementPatterns(typesText) {
  const union = /export type MovementPattern =([\s\S]*?);/.exec(typesText);
  if (!union) throw new Error("src/lib/fitness/types.ts has no MovementPattern union");
  return new Set((union[1].match(/"([a-z-]+)"/g) ?? []).map((s) => s.slice(1, -1)));
}

/** @param {any} v */
const text2 = (v) => v && typeof v.en === "string" && v.en.trim() && typeof v.ru === "string" && v.ru.trim();
/** @param {any} v @param {number} min */
const list2 = (v, min) => v && Array.isArray(v.en) && Array.isArray(v.ru) && v.en.length >= min && v.ru.length >= min
  && v.en.every((/** @type {unknown} */ s) => typeof s === "string" && s.trim()) && v.ru.every((/** @type {unknown} */ s) => typeof s === "string" && s.trim());
/** Both lists exist and have different lengths. @param {any} v */
const countsDiffer = (v) => Array.isArray(v?.en) && Array.isArray(v?.ru) && v.en.length !== v.ru.length;

/**
 * Validate the slice rows and merge them in registry order.
 * @param {{ registry: any, slices: Record<string, string | null | undefined>, patterns: Set<string>, slice?: string | null }} input
 *   `slices`: each slice's file text (null or missing = no file); `slice`: check only that slice's rows (alternatives
 *   still resolve against the whole registry).
 * @returns {{ problems: string[], merged: any[] }} `merged` is only meant to be written when `problems` is empty.
 */
export function mergeCatalog({ registry, slices, patterns, slice = null }) {
  const muscles = new Set(registry.muscles.map((/** @type {{ id: string }} */ m) => m.id));
  const order = Object.keys(registry.exercises);
  /** @type {string[]} */
  const problems = [];
  /** @param {string} id @param {string} msg */
  const bad = (id, msg) => problems.push(`${id}: ${msg}`);

  /** @type {Map<string, any>} */
  const all = new Map();
  /** @type {Map<string, string>} id → the slice it was first found in */
  const seen = new Map();
  for (const name of slice ? [slice] : registry.slices) {
    const text = slices[name];
    if (text == null) { problems.push(`slice ${name}: missing content/fitness/exercises/${name}.json`); continue; }
    let rows;
    try { rows = JSON.parse(text); } catch (e) { problems.push(`slice ${name}: invalid JSON (${/** @type {Error} */ (e).message})`); continue; }
    if (!Array.isArray(rows)) { problems.push(`slice ${name}: not an array`); continue; }
    for (const row of rows) {
      if (!row || typeof row.id !== "string") { problems.push(`slice ${name}: row without id`); continue; }
      const first = seen.get(row.id);
      if (first) bad(row.id, first === name ? `listed twice in slice ${name}` : `duplicate (also in slice ${first})`);
      else seen.set(row.id, name);
      const reg = registry.exercises[row.id];
      if (!reg) { bad(row.id, "not in registry.json"); continue; }
      if (reg.slice !== name) bad(row.id, `belongs to slice ${reg.slice}, found in ${name}`);
      all.set(row.id, row);
    }
  }
  for (const id of order) if (!all.has(id) && (!slice || registry.exercises[id].slice === slice)) bad(id, slice ? `missing from slice ${slice}` : "missing from every slice");

  for (const [id, e] of all) {
    const reg = registry.exercises[id];
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) bad(id, "id is not kebab-case");
    if (!text2(e.name)) bad(id, "name needs en + ru");
    if (!EQUIPMENT.has(e.equipment)) bad(id, `equipment "${e.equipment}" not in the Equipment union`);
    if (!patterns.has(e.pattern)) bad(id, `pattern "${e.pattern}" not in the MovementPattern union`);
    if (reg && e.pattern !== reg.pattern) bad(id, `pattern "${e.pattern}" differs from registry "${reg.pattern}"`);
    if (reg && e.class !== reg.class) bad(id, `class "${e.class}" differs from registry "${reg.class}"`);
    for (const key of ["primary", "secondary"]) {
      if (!Array.isArray(e[key])) { bad(id, `${key} must be an array`); continue; }
      for (const m of e[key]) if (!muscles.has(m)) bad(id, `${key} muscle "${m}" not in registry`);
    }
    if (!e.primary?.length) bad(id, "needs at least one primary muscle");
    if (![1, 2, 3].includes(e.difficulty)) bad(id, "difficulty must be 1, 2 or 3");
    if (typeof e.unilateral !== "boolean" || typeof e.supported !== "boolean") bad(id, "unilateral and supported must be booleans");
    if (!(typeof e.increment === "number" && e.increment >= 0 && e.increment <= 20)) bad(id, "increment must be a number 0–20 kg");
    if (!(Array.isArray(e.repRange) && e.repRange.length === 2 && e.repRange[0] > 0 && e.repRange[0] <= e.repRange[1])) bad(id, "repRange must be [lo, hi]");
    if (e.repUnit && !["reps", "seconds", "meters"].includes(e.repUnit)) bad(id, "repUnit must be reps|seconds|meters");
    const alternatives = Array.isArray(e.alternatives) ? e.alternatives : [];
    if (alternatives.length < 2) bad(id, "needs at least 2 alternatives");
    for (const alt of alternatives) {
      if (alt === id) bad(id, "lists itself as an alternative");
      else if (!registry.exercises[alt]) bad(id, `alternative "${alt}" is not a registry id`);
    }
    if (new Set(alternatives).size !== alternatives.length) bad(id, "duplicate alternatives");
    if (!text2(e.setup)) bad(id, "setup needs en + ru");
    if (!list2(e.cues, 4)) bad(id, "cues need ≥ 4 in en and ru");
    if (!list2(e.mistakes, 3)) bad(id, "mistakes need ≥ 3 in en and ru");
    if (countsDiffer(e.cues)) bad(id, "cues en/ru counts differ");
    if (countsDiffer(e.mistakes)) bad(id, "mistakes en/ru counts differ");
    if (e.startLoad && !(typeof e.startLoad.kg === "number" && e.startLoad.kg >= 0 && typeof e.startLoad.source === "string")) bad(id, "startLoad must be {kg, source}");
    if (e.lowerBackLoad && !["low", "moderate", "high"].includes(e.lowerBackLoad)) bad(id, "lowerBackLoad must be low|moderate|high");
    if (!Array.isArray(e.tags)) bad(id, "tags must be an array");
  }

  const ownerIds = registry.ownerTemplate.days
    .flatMap((/** @type {{ slots: [string, string][] }} */ d) => d.slots.map((s) => s[1]))
    .filter((/** @type {string} */ id) => !slice || registry.exercises[id]?.slice === slice);
  for (const id of ownerIds) {
    const e = all.get(id);
    if (e && !e.tags?.includes("owner-primary")) bad(id, 'owner template exercise must carry the "owner-primary" tag');
  }

  const merged = order.filter((id) => all.has(id)).map((id) => {
    const e = all.get(id);
    return { ...e, images: Array.isArray(e.images) ? e.images : [] };
  });
  return { problems, merged };
}

/** content/fitness/exercises.json as the script writes it. @param {unknown[]} merged */
export const serializeCatalog = (merged) => `${JSON.stringify(merged, null, 1)}\n`;

/**
 * The command line under `root`: returns the exit code (0 ok, 1 problems, 2 bad arguments) and writes exercises.json
 * only for a full merge without problems.
 * @param {string[]} argv @param {string} [root] @param {Pick<Console, "log" | "error">} [out]
 */
export function main(argv, root = ROOT, out = console) {
  const dir = path.join(root, "content/fitness");
  const registry = JSON.parse(fs.readFileSync(path.join(dir, "registry.json"), "utf8"));
  const check = argv.includes("--check");
  const at = argv.indexOf("--slice");
  const slice = at >= 0 ? argv[at + 1] ?? "" : null;
  if (slice !== null && !registry.slices.includes(slice)) {
    out.error(`${slice ? `unknown slice ${slice}` : "--slice needs a name"}; one of ${registry.slices.join(", ")}`);
    return 2;
  }
  /** @type {Record<string, string | null>} */
  const slices = {};
  for (const name of slice ? [slice] : registry.slices) {
    const file = path.join(dir, "exercises", `${name}.json`);
    slices[name] = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  }
  const patterns = movementPatterns(fs.readFileSync(path.join(root, "src/lib/fitness/types.ts"), "utf8"));
  const { problems, merged } = mergeCatalog({ registry, slices, patterns, slice });
  if (problems.length) {
    out.error(`fitness catalog: ${problems.length} problem(s)`);
    for (const p of problems.slice(0, 200)) out.error(` - ${p}`);
    return 1;
  }
  if (!check && !slice) fs.writeFileSync(path.join(dir, "exercises.json"), serializeCatalog(merged));
  out.log(`fitness catalog: ${merged.length} exercises OK${slice ? ` (slice ${slice}, check only)` : check ? " (check only)" : " → content/fitness/exercises.json"}`);
  return 0;
}

/** Node was started on this file, also through a symlinked folder (macOS /var is /private/var, a linked checkout). */
function startedAsScript() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (startedAsScript()) process.exitCode = main(process.argv.slice(2));
