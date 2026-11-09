#!/usr/bin/env node
/**
 * Index the generated fitness pictures into content/fitness/images.json (stream 07,
 * plans/fitness/07-diagrams-and-image-generation.md). Written from the files on disk, never by hand:
 *
 *   public/media/fitness/exercises/<id>/<angle>.webp  →  exercises[id] = [{ angle, src, v }, …]  (sequence, side, …)
 *   public/media/fitness/machines/<id>.webp           →  machines[id]  = { src, v }
 *   public/media/fitness/muscles/<group>.webp         →  muscles[group] = { src, v }
 *
 * `src` is relative to /media/ (the page requests `/media/<src>?v=<v>`); `v` is the first 8 hex digits of the
 * file's SHA-1, so a regenerated picture gets a new URL. Only registry ids and groups are indexed.
 *
 *   node scripts/fitness-image-index.mjs           # write content/fitness/images.json
 *   node scripts/fitness-image-index.mjs --check   # exit 1 when the file on disk is out of date
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Angles in display order; any other angle found on disk follows alphabetically. */
export const ANGLES = ["sequence", "side"];
export const INDEX_FILE = "content/fitness/images.json";

/** @param {string} file */
export const imageVersion = (file) => createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 8);

/** @param {string} dir */
const webps = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".webp")).sort() : []);

/**
 * The index for the pictures under `root`/public/media/fitness, plus files that match no registry id.
 * @param {string} [root]
 */
export function buildImageIndex(root = ROOT) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, "content/fitness/registry.json"), "utf8"));
  const media = path.join(root, "public/media/fitness");
  const ids = new Set(Object.keys(registry.exercises));
  const groups = new Set(registry.groups.map((/** @type {{id: string}} */ g) => g.id));
  /** @type {{ exercises: Record<string, {angle: string, src: string, v: string}[]>, machines: Record<string, {src: string, v: string}>, muscles: Record<string, {src: string, v: string}> }} */
  const index = { exercises: {}, machines: {}, muscles: {} };
  /** @type {string[]} */
  const stray = [];
  const exerciseDir = path.join(media, "exercises");
  const dirs = fs.existsSync(exerciseDir) ? fs.readdirSync(exerciseDir).filter((d) => fs.statSync(path.join(exerciseDir, d)).isDirectory()).sort() : [];
  for (const id of dirs) {
    const files = webps(path.join(exerciseDir, id));
    if (!ids.has(id)) {
      stray.push(...files.map((f) => `exercises/${id}/${f}`));
      continue;
    }
    const angles = files.map((f) => f.slice(0, -5));
    angles.sort((a, b) => {
      const ia = ANGLES.indexOf(a), ib = ANGLES.indexOf(b);
      return (ia < 0 ? ANGLES.length : ia) - (ib < 0 ? ANGLES.length : ib) || a.localeCompare(b);
    });
    if (angles.length) {
      index.exercises[id] = angles.map((angle) => ({
        angle,
        src: `fitness/exercises/${id}/${angle}.webp`,
        v: imageVersion(path.join(exerciseDir, id, `${angle}.webp`)),
      }));
    }
  }
  for (const file of webps(path.join(media, "machines"))) {
    const id = file.slice(0, -5);
    if (ids.has(id)) index.machines[id] = { src: `fitness/machines/${file}`, v: imageVersion(path.join(media, "machines", file)) };
    else stray.push(`machines/${file}`);
  }
  for (const file of webps(path.join(media, "muscles"))) {
    const group = file.slice(0, -5);
    if (groups.has(group)) index.muscles[group] = { src: `fitness/muscles/${file}`, v: imageVersion(path.join(media, "muscles", file)) };
    else stray.push(`muscles/${file}`);
  }
  return { index, stray };
}

/** @param {unknown} index */
export const serializeIndex = (index) => `${JSON.stringify(index, null, 1)}\n`;

/**
 * The command line: writes the index under `root` (with `--check`: compares it instead) and returns the exit code,
 * 1 when `--check` finds the file out of date.
 * @param {string[]} argv @param {string} [root] @param {Pick<Console, "log" | "warn" | "error">} [out]
 */
export function main(argv, root = ROOT, out = console) {
  const { index, stray } = buildImageIndex(root);
  const file = path.join(root, INDEX_FILE);
  const text = serializeIndex(index);
  const count = Object.values(index.exercises).flat().length + Object.keys(index.machines).length + Object.keys(index.muscles).length;
  for (const s of stray) out.warn(`warning: public/media/fitness/${s} matches no registry id or group (not indexed)`);
  if (argv.includes("--check")) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (current !== text) {
      out.error(`${INDEX_FILE} is out of date: run node scripts/fitness-image-index.mjs`);
      return 1;
    }
    out.log(`${INDEX_FILE} is up to date (${count} pictures)`);
    return 0;
  }
  fs.writeFileSync(file, text);
  out.log(`wrote ${INDEX_FILE}: ${count} pictures`);
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
