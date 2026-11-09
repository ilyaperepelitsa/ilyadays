// @ts-check
/**
 * Exercise and muscle catalog (owner: stream 02, plans/fitness/02-exercise-catalog-and-alternatives.md).
 * Data: content/fitness/exercises.json (merged by scripts/fitness-catalog-merge.mjs from content/fitness/exercises/<slice>.json),
 * content/fitness/registry.json (groups, muscles, classes, owner template ids) and content/fitness/images.json (the
 * picture index written by scripts/fitness-image-index.mjs). Pure: no DOM, no fs.
 * Server code, the engine and tests import this; client components import ./catalog-core.mjs (no JSON) instead.
 * Stream 02 may ADD exports here; existing exports keep their signatures.
 */
import exercisesData from "../../../content/fitness/exercises.json" with { type: "json" };
import registry from "../../../content/fitness/registry.json" with { type: "json" };
import imagesData from "../../../content/fitness/images.json" with { type: "json" };
import { classLabel, equipmentLabel as coreEquipmentLabel, isAvailable as coreIsAvailable, searchItems } from "./catalog-core.mjs";

export {
  CLASS_NAMES, EQUIPMENT, MACHINE_EQUIPMENT, PATTERNS, classLabel, equipmentShort, facetCounts, filterItems, foldText,
  isMachine, machinesFirst, patternLabel, patternShort, programSlots, repRangeLabel, searchItems,
} from "./catalog-core.mjs";

/** @typedef {import("./types").Exercise} Exercise */
/** @typedef {import("./types").MuscleGroup} MuscleGroup */
/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").Lang} Lang */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {{ id: string, name: Text2, region: string, order: number }} Group */
/** @typedef {{ id: string, pattern: string, slice: string, members: string[] }} ExerciseClass */
/** @typedef {{ angle: string, src: string, alt: Text2 }} ExerciseImage */
/** @typedef {{ src: string, alt: Text2 }} Picture */
/** @typedef {{ src: string, v: string }} IndexedFile */
/**
 * content/fitness/images.json: `src` is relative to /media/, `v` = first 8 hex digits of the file's SHA-1.
 * @typedef {{ exercises: Record<string, (IndexedFile & { angle: string })[]>, machines: Record<string, IndexedFile>, muscles: Record<string, IndexedFile> }} ImageIndex
 */

/** @type {ImageIndex} */
const IMAGES = /** @type {any} */ (imagesData);
/** @type {Record<string, { class: string, classes: string[], slice: string, pattern: string }>} */
const REGISTRY_EXERCISES = /** @type {any} */ (registry.exercises);

/** @param {IndexedFile} file */
const mediaUrl = (file) => `/media/${file.src}?v=${file.v}`;

/** @param {string} angle @param {Text2} name @returns {Text2} */
function angleAlt(angle, name) {
  if (angle === "sequence") return { en: `${name.en}: start and end position`, ru: `${name.ru}: начало и конец движения` };
  if (angle === "side") return { en: `${name.en} at the hardest point, side view`, ru: `${name.ru}: самая тяжёлая точка, вид сбоку` };
  return { en: `${name.en}: ${angle} view`, ru: `${name.ru}: ракурс «${angle}»` };
}

/** @param {string} id @param {Text2} name @returns {ExerciseImage[]} */
const imagesOf = (id, name) => (IMAGES.exercises[id] ?? []).map((f) => ({ angle: f.angle, src: mediaUrl(f), alt: angleAlt(f.angle, name) }));

/** Every exercise, in registry order; `images` filled from content/fitness/images.json. */
/** @type {Exercise[]} */
export const EXERCISES = /** @type {Exercise[]} */ (/** @type {any[]} */ (exercisesData)).map((e) => ({ ...e, images: imagesOf(e.id, e.name) }));
/** @type {MuscleGroup[]} */
export const MUSCLES = /** @type {any} */ (registry.muscles);
/** Coarse groups in display order: { id, name: {en, ru}, region, order } */
/** @type {Group[]} */
export const GROUPS = registry.groups;
/** Equivalence classes: { id, pattern, slice, members } */
/** @type {ExerciseClass[]} */
export const CLASSES = registry.classes;
/** The owner's program ids (slot id → exercise id) */
export const OWNER_TEMPLATE = registry.ownerTemplate;
export const REGISTRY_VERSION = registry.version;

/** @type {Map<string, Exercise>} */
const byId = new Map(EXERCISES.map((e) => [e.id, e]));
/** @type {Map<string, MuscleGroup>} */
const muscleIndex = new Map(MUSCLES.map((m) => [m.id, m]));
/** @type {Map<string, ExerciseClass>} */
const classIndex = new Map(CLASSES.map((c) => [c.id, c]));

/** @param {string} id @returns {Exercise | undefined} */
export const exerciseById = (id) => byId.get(id);

/** @param {string} id @returns {MuscleGroup | undefined} */
export const muscleById = (id) => muscleIndex.get(id);

/** @param {string} id */
export const groupById = (id) => GROUPS.find((g) => g.id === id);

/** @param {string} id @param {Gym | null | undefined} [gym] */
export function isAvailable(id, gym) {
  return coreIsAvailable(id, gym);
}

/**
 * Alternatives for an exercise, best first, filtered by what a gym has (empty `available` = everything).
 * @param {string} id @param {Gym | null | undefined} [gym] @returns {string[]}
 */
export function alternativesFor(id, gym) {
  const ex = byId.get(id);
  if (!ex) return [];
  return ex.alternatives.filter((alt) => alt !== id && byId.has(alt) && isAvailable(alt, gym));
}

/** @param {string} muscleId @returns {Exercise[]} */
export const exercisesForMuscle = (muscleId) => EXERCISES.filter((e) => e.primary.includes(muscleId));

/** Coarse groups ("chest", "back", …) of an exercise's primary muscles. @param {string} id @returns {string[]} */
export function groupsOf(id) {
  const ex = byId.get(id);
  if (!ex) return [];
  return [...new Set(ex.primary.map((m) => muscleIndex.get(m)?.group).filter(/** @returns {g is string} */ (g) => Boolean(g)))];
}

/** Coarse group of one muscle id. @param {string} muscleId @returns {string} */
export const groupOfMuscle = (muscleId) => muscleIndex.get(muscleId)?.group ?? "other";

/** @param {string} group @returns {Exercise[]} */
export const exercisesForGroup = (group) => EXERCISES.filter((e) => groupsOf(e.id).includes(group));

/** @param {import("./types").Equipment} eq @param {Lang} lang */
export function equipmentLabel(eq, lang) {
  return coreEquipmentLabel(eq, lang);
}

/* ------------------------------------------------------------------ added by stream 02 (relaunch) */

/**
 * Technique pictures of an exercise, display order (sequence, side, then any other angle):
 * `[{ angle, src: "/media/fitness/exercises/<id>/<angle>.webp?v=<hash>", alt }]`. Empty = no picture yet.
 * @param {string} id @returns {ExerciseImage[]}
 */
export const exerciseImages = (id) => byId.get(id)?.images ?? [];

/**
 * The 360 px card thumbnail of an exercise picture URL (scripts/fitness-thumbs.py), keeping the original's `?v=`:
 * "/media/fitness/exercises/<id>/<angle>.webp?v=…" → "/media/fitness/thumbs/exercises/<id>/<angle>.webp?v=…".
 * Other URLs come back unchanged. @param {string} src @returns {string}
 */
export const thumbUrl = (src) => src.replace(/^\/media\/fitness\/exercises\//, "/media/fitness/thumbs/exercises/");

/** The machine an exercise is done on, pictured alone and set up for it. @param {string} id @returns {Picture | null} */
export function machineImage(id) {
  const file = IMAGES.machines[id];
  const ex = byId.get(id);
  if (!file || !ex) return null;
  return { src: mediaUrl(file), alt: { en: `${ex.name.en}: the machine, set up for this exercise`, ru: `${ex.name.ru}: тренажёр, настроенный для упражнения` } };
}

/** A coarse group highlighted on a front and back figure. @param {string} group @returns {Picture | null} */
export function muscleImage(group) {
  const file = IMAGES.muscles[group];
  const g = groupById(group);
  if (!file || !g) return null;
  return { src: mediaUrl(file), alt: { en: `${g.name.en}: muscles highlighted on a front and back figure`, ru: `${g.name.ru}: мышцы на фигуре спереди и сзади` } };
}

/**
 * Exercises matching a free-text query, best first: names in both languages and `aka` (machine model names),
 * case-, diacritic- and punctuation-insensitive; the current language ranks first. Empty query → all.
 * @param {string} query @param {Lang} lang @returns {Exercise[]}
 */
export const searchExercises = (query, lang) => searchItems(EXERCISES, query, lang);

/** The owner's A/B/C program exercises (registry owner template), slot order, each once. @returns {Exercise[]} */
export function ownerPrimary() {
  const ids = [...new Set(OWNER_TEMPLATE.days.flatMap((d) => d.slots.map((s) => s[1])))];
  return ids.map((id) => byId.get(id)).filter(/** @returns {e is Exercise} */ (e) => Boolean(e));
}

/** The exercise's main substitution class. @param {string} id @returns {ExerciseClass | undefined} */
export function classOf(id) {
  const cls = REGISTRY_EXERCISES[id]?.class;
  return cls ? classIndex.get(cls) : undefined;
}

/**
 * Other members of every class the exercise belongs to (face pull: rear-delt and external-rotation classes), in
 * member order, without duplicates or the exercise itself.
 * @param {string} id @returns {string[]}
 */
export function classMates(id) {
  const classes = REGISTRY_EXERCISES[id]?.classes ?? [];
  const out = new Set(classes.flatMap((c) => classIndex.get(c)?.members ?? []));
  out.delete(id);
  return [...out].filter((m) => byId.has(m));
}

/** Class name of an exercise ("Horizontal presses"). @param {string} id @param {Lang} lang */
export const exerciseClassLabel = (id, lang) => classLabel(REGISTRY_EXERCISES[id]?.class, lang);

/** Muscle id → name in a language (muscle map titles, cards). @param {Lang} lang @returns {Record<string, string>} */
export const muscleNames = (lang) => Object.fromEntries(MUSCLES.map((m) => [m.id, lang === "ru" ? m.name.ru : m.name.en]));
