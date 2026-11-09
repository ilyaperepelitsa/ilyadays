// @ts-check
/**
 * Import-free part of the exercise catalog (stream 02, plans/fitness/02-exercise-catalog-and-alternatives.md):
 * equipment, movement-pattern and class labels, text folding and search, faceted filters, gym availability and
 * program-slot lookups. Client components import THIS module, never catalog.mjs: that one bundles the 576 KB
 * exercises.json. catalog.mjs re-exports everything here, so server code and the engine can use either.
 */

/** @typedef {import("./types").Equipment} Equipment */
/** @typedef {import("./types").MovementPattern} MovementPattern */
/** @typedef {import("./types").Gym} Gym */
/** @typedef {import("./types").Lang} Lang */
/** @typedef {import("./types").Text2} Text2 */
/** @typedef {{ id: Equipment, name: Text2, short: Text2, machine: boolean }} EquipmentInfo */
/** @typedef {{ id: MovementPattern, name: Text2, short: Text2 }} PatternInfo */
/** @typedef {{ id: string, name: Text2, aka?: readonly string[] }} Searchable */
/** @typedef {{ id: string, equipment: string, pattern: string, groups: readonly string[] }} Facetable */
/** @typedef {{ group?: string | readonly string[] | null, equipment?: string | null, pattern?: string | null }} Filters */
/** @typedef {{ slots: readonly ({ slotId: string, exerciseId: string } | readonly [string, string])[] }} SlotDay */

/** @param {string} en @param {string} ru @returns {Text2} */
const t = (en, ru) => ({ en, ru });

/** Equipment in display order: machines first (the owner trains on machines), then free weights. */
/** @type {readonly EquipmentInfo[]} */
export const EQUIPMENT = Object.freeze([
  { id: "selectorized", name: t("Pin-loaded machine", "Блочный тренажёр"), short: t("Pin-loaded", "Блочные"), machine: true },
  { id: "plate-loaded", name: t("Plate-loaded machine", "Тренажёр с дисками"), short: t("Plate-loaded", "С дисками"), machine: true },
  { id: "cable", name: t("Cable", "Блок / кроссовер"), short: t("Cable", "Блок"), machine: true },
  { id: "assisted", name: t("Assisted machine", "Гравитрон"), short: t("Assisted", "Гравитрон"), machine: true },
  { id: "smith", name: t("Smith machine", "Машина Смита"), short: t("Smith", "Смит"), machine: true },
  { id: "dumbbell", name: t("Dumbbells", "Гантели"), short: t("Dumbbells", "Гантели"), machine: false },
  { id: "barbell", name: t("Barbell", "Штанга"), short: t("Barbell", "Штанга"), machine: false },
  { id: "kettlebell", name: t("Kettlebell", "Гиря"), short: t("Kettlebell", "Гиря"), machine: false },
  { id: "bodyweight", name: t("Bodyweight", "Своё тело"), short: t("Bodyweight", "Своё тело"), machine: false },
  { id: "band", name: t("Band", "Резина"), short: t("Band", "Резина"), machine: false },
]);

/** Equipment that is a machine or a cable station (sorted first by "machines first"). */
export const MACHINE_EQUIPMENT = Object.freeze(EQUIPMENT.filter((e) => e.machine).map((e) => e.id));

/** Movement patterns in display order (push, pull, shoulders, arms, core, legs, neck). */
/** @type {readonly PatternInfo[]} */
export const PATTERNS = Object.freeze([
  { id: "horizontal-push", name: t("Horizontal press", "Горизонтальный жим"), short: t("Press", "Жим") },
  { id: "incline-push", name: t("Incline press", "Жим под углом вверх"), short: t("Incline press", "Жим под углом") },
  { id: "decline-push", name: t("Decline press & dips", "Жим вниз и брусья"), short: t("Decline & dips", "Жим вниз") },
  { id: "chest-fly", name: t("Chest fly", "Сведения на грудь"), short: t("Fly", "Сведения") },
  { id: "vertical-push", name: t("Overhead press", "Жим вверх"), short: t("Overhead", "Жим вверх") },
  { id: "vertical-pull", name: t("Vertical pull", "Вертикальная тяга"), short: t("Pulldown", "Тяга сверху") },
  { id: "horizontal-pull", name: t("Row", "Горизонтальная тяга"), short: t("Row", "Тяга к поясу") },
  { id: "pullover", name: t("Pullover", "Пуловер"), short: t("Pullover", "Пуловер") },
  { id: "lateral-raise", name: t("Lateral raise", "Махи в стороны"), short: t("Lateral raise", "Махи в стороны") },
  { id: "front-raise", name: t("Front raise", "Подъём перед собой"), short: t("Front raise", "Перед собой") },
  { id: "rear-delt", name: t("Rear-delt fly", "Разведения на заднюю дельту"), short: t("Rear delts", "Задняя дельта") },
  { id: "external-rotation", name: t("External rotation", "Наружная ротация плеча"), short: t("Rotation", "Ротация плеча") },
  { id: "shrug", name: t("Shrug", "Шраги"), short: t("Shrug", "Шраги") },
  { id: "elbow-flexion", name: t("Curl", "Сгибание рук"), short: t("Curl", "Сгибание рук") },
  { id: "elbow-extension", name: t("Triceps extension", "Разгибание рук"), short: t("Extension", "Разгибание рук") },
  { id: "forearm-flexion", name: t("Wrist curl", "Сгибание кистей"), short: t("Wrist curl", "Сгибание кистей") },
  { id: "forearm-extension", name: t("Reverse wrist curl", "Разгибание кистей"), short: t("Reverse wrist", "Разгибание кистей") },
  { id: "grip", name: t("Grip", "Хват"), short: t("Grip", "Хват") },
  { id: "carry", name: t("Carry", "Переноска"), short: t("Carry", "Переноска") },
  { id: "trunk-flexion", name: t("Crunch", "Скручивания"), short: t("Crunch", "Скручивания") },
  { id: "hip-flexion", name: t("Leg raise", "Подъём ног"), short: t("Leg raise", "Подъём ног") },
  { id: "anti-extension", name: t("Anti-extension", "Антиразгибание"), short: t("Anti-extension", "Антиразгибание") },
  { id: "anti-rotation", name: t("Anti-rotation", "Антиротация"), short: t("Anti-rotation", "Антиротация") },
  { id: "rotation", name: t("Trunk rotation", "Повороты корпуса"), short: t("Rotation", "Повороты") },
  { id: "lateral-flexion", name: t("Side stability", "Боковая стабилизация"), short: t("Side stability", "Боковая стабилизация") },
  { id: "spinal-extension", name: t("Back extension", "Разгибание спины"), short: t("Back extension", "Разгибание спины") },
  { id: "squat", name: t("Squat & leg press", "Присед и жим ногами"), short: t("Squat", "Присед") },
  { id: "lunge", name: t("Lunge", "Выпады"), short: t("Lunge", "Выпады") },
  { id: "hip-hinge", name: t("Hip hinge", "Тяга с наклоном в тазу"), short: t("Hinge", "Наклон в тазу") },
  { id: "hip-extension", name: t("Hip thrust & kickback", "Ягодичный мост и отведение назад"), short: t("Hip thrust", "Ягодичный мост") },
  { id: "knee-extension", name: t("Leg extension", "Разгибание ног"), short: t("Leg extension", "Разгибание ног") },
  { id: "knee-flexion", name: t("Leg curl", "Сгибание ног"), short: t("Leg curl", "Сгибание ног") },
  { id: "hip-abduction", name: t("Hip abduction", "Отведение бедра"), short: t("Abduction", "Отведение") },
  { id: "hip-adduction", name: t("Hip adduction", "Сведение ног"), short: t("Adduction", "Сведение ног") },
  { id: "calf-raise", name: t("Calf raise", "Подъём на носки"), short: t("Calf raise", "На носки") },
  { id: "neck", name: t("Neck", "Шея"), short: t("Neck", "Шея") },
]);

/** Names of the substitution classes (content/fitness/registry.json `classes`). */
/** @type {Readonly<Record<string, Text2>>} */
export const CLASS_NAMES = Object.freeze({
  "horizontal-press": t("Horizontal presses", "Горизонтальные жимы"),
  "incline-press": t("Incline presses", "Жимы под углом вверх"),
  "decline-press": t("Decline presses & dips", "Жимы вниз и брусья"),
  "chest-fly": t("Chest flies", "Сведения на грудь"),
  "vertical-press": t("Overhead presses", "Жимы вверх"),
  "lateral-raise": t("Lateral raises", "Махи в стороны"),
  "rear-delt": t("Rear-delt work", "Задняя дельта"),
  "external-rotation": t("External rotation", "Наружная ротация плеча"),
  shrug: t("Shrugs", "Шраги"),
  "vertical-pull": t("Vertical pulls", "Вертикальные тяги"),
  "lat-isolation": t("Lat isolation (pullovers)", "Изоляция широчайших (пуловеры)"),
  "horizontal-pull": t("Rows", "Горизонтальные тяги"),
  "spinal-extension": t("Back extensions", "Разгибания спины"),
  neck: t("Neck", "Шея"),
  "biceps-curl": t("Biceps curls", "Сгибания на бицепс"),
  "brachialis-curl": t("Hammer & reverse curls", "Молотки и обратные сгибания"),
  "triceps-extension": t("Triceps extensions", "Разгибания на трицепс"),
  "triceps-press": t("Triceps presses & dips", "Жимы на трицепс и брусья"),
  wrist: t("Wrist curls", "Сгибания кистей"),
  grip: t("Grip & carries", "Хват и переноски"),
  "spine-stability": t("Spine stability", "Стабилизация позвоночника"),
  "trunk-flexion": t("Crunches", "Скручивания"),
  "lower-ab-flexion": t("Knee & leg raises", "Подъёмы коленей и ног"),
  "anti-extension": t("Anti-extension", "Антиразгибание"),
  "anti-rotation": t("Anti-rotation", "Антиротация"),
  rotation: t("Trunk rotation", "Повороты корпуса"),
  "anti-lateral-flexion": t("Side stability", "Боковая стабилизация"),
  squat: t("Squats & leg presses", "Приседания и жимы ногами"),
  "knee-extension": t("Leg extension", "Разгибание ног"),
  "knee-flexion": t("Leg curls", "Сгибания ног"),
  "hip-hinge": t("Hip hinges", "Тяги с наклоном в тазу"),
  "hip-thrust": t("Hip thrusts & kickbacks", "Ягодичные мосты и отведения назад"),
  "hip-abduction": t("Hip abduction", "Отведение бедра"),
  "hip-adduction": t("Hip adduction", "Сведение ног"),
  "calf-straight": t("Calf raises, straight knee", "Подъёмы на носки с прямыми ногами"),
  "calf-bent": t("Calf raises, bent knee", "Подъёмы на носки сидя"),
});

const equipmentIndex = new Map(EQUIPMENT.map((e) => [/** @type {string} */ (e.id), e]));
const patternIndex = new Map(PATTERNS.map((p) => [/** @type {string} */ (p.id), p]));

/** @param {Lang} lang @param {Text2} text */
const tr = (lang, text) => (lang === "ru" ? text.ru : text.en);

/** Long equipment name ("Pin-loaded machine"). @param {Equipment | string} eq @param {Lang} lang */
export function equipmentLabel(eq, lang) {
  const info = equipmentIndex.get(eq);
  return info ? tr(lang, info.name) : eq;
}

/** Short equipment name for chips ("Pin-loaded"). @param {Equipment | string} eq @param {Lang} lang */
export function equipmentShort(eq, lang) {
  const info = equipmentIndex.get(eq);
  return info ? tr(lang, info.short) : eq;
}

/** @param {Equipment | string | null | undefined} eq */
export const isMachine = (eq) => Boolean(eq && equipmentIndex.get(eq)?.machine);

/** Movement pattern name ("Horizontal press"). @param {MovementPattern | string} p @param {Lang} lang */
export function patternLabel(p, lang) {
  const info = patternIndex.get(p);
  return info ? tr(lang, info.name) : p;
}

/** Short pattern name for chips. @param {MovementPattern | string} p @param {Lang} lang */
export function patternShort(p, lang) {
  const info = patternIndex.get(p);
  return info ? tr(lang, info.short) : p;
}

/** Substitution class name ("Horizontal presses"). @param {string | null | undefined} classId @param {Lang} lang */
export function classLabel(classId, lang) {
  if (!classId) return "";
  const name = CLASS_NAMES[classId];
  return name ? tr(lang, name) : classId;
}

/* ------------------------------------------------------------------ availability and program slots */

/** Whether a gym has an exercise: not in `missing`, and in `available` unless that list is empty (= everything). */
/** @param {string} id @param {Gym | null | undefined} [gym] */
export function isAvailable(id, gym) {
  if (!gym) return true;
  if (gym.missing?.includes(id)) return false;
  return !gym.available?.length || gym.available.includes(id);
}

/**
 * Exercise id → slot ids where it is used: the slot's own exercise, plus the gym's preferred swap for that slot
 * (`gym.preferred[slotId]`) or for the slot's exercise (`gym.preferred[exerciseId]`). Accepts program days
 * (`{ slotId, exerciseId }` slots) and the registry owner template (`[slotId, exerciseId]` pairs).
 * @param {readonly SlotDay[] | null | undefined} days @param {Gym | null | undefined} [gym]
 * @returns {Record<string, string[]>}
 */
export function programSlots(days, gym) {
  /** @type {Record<string, string[]>} */
  const out = {};
  /** @param {string | undefined} id @param {string} slotId */
  const add = (id, slotId) => {
    if (!id) return;
    const list = (out[id] ??= []);
    if (!list.includes(slotId)) list.push(slotId);
  };
  for (const day of days ?? []) {
    for (const slot of day.slots ?? []) {
      const [slotId, exerciseId] = Array.isArray(slot) ? slot : [/** @type {any} */ (slot).slotId, /** @type {any} */ (slot).exerciseId];
      add(exerciseId, slotId);
      add(gym?.preferred?.[slotId], slotId);
      add(gym?.preferred?.[exerciseId], slotId);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ search */

/**
 * Lower-case, accents and diacritics removed (NFD; ё → е, й → и), punctuation → single spaces.
 * @param {string | null | undefined} text
 */
export function foldText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Every token occurs in `field` (or in it with the spaces removed, so "pullup" finds "pull up"). */
/** @param {string} field @param {string[]} tokens */
const hasAll = (field, tokens) => {
  if (!field) return false;
  const compact = field.replaceAll(" ", "");
  return tokens.every((tok) => field.includes(tok) || compact.includes(tok));
};

/**
 * Relevance of one item for a folded query (0 = no match): current-language name prefix 100, a word of it starting
 * with the first token 80, all tokens in it 60; other-language name prefix 55 / all tokens 50; an aka 40; the id 30;
 * tokens spread over all of them 20.
 * @param {Searchable} item @param {string} q @param {string[]} tokens @param {Lang} lang
 */
function score(item, q, tokens, lang) {
  const own = foldText(lang === "ru" ? item.name.ru : item.name.en);
  const other = foldText(lang === "ru" ? item.name.en : item.name.ru);
  const aka = (item.aka ?? []).map(foldText);
  const id = foldText(item.id);
  if (own.startsWith(q)) return 100;
  if (hasAll(own, tokens)) return own.split(" ").some((w) => w.startsWith(tokens[0])) ? 80 : 60;
  if (other.startsWith(q)) return 55;
  if (hasAll(other, tokens)) return 50;
  if (aka.some((a) => hasAll(a, tokens))) return 40;
  if (hasAll(id, tokens)) return 30;
  if (hasAll([own, other, ...aka, id].join(" "), tokens)) return 20;
  return 0;
}

/**
 * Items matching a free-text query, best first (ties keep the input order). Case-, diacritic- and
 * punctuation-insensitive; both languages and the `aka` names are searched, the current language ranks first.
 * An empty query returns every item in order.
 * @template {Searchable} T
 * @param {readonly T[]} items @param {string | null | undefined} query @param {Lang} lang @returns {T[]}
 */
export function searchItems(items, query, lang) {
  const q = foldText(query);
  if (!q) return [...items];
  const tokens = q.split(" ");
  /** @type {{ item: T, index: number, score: number }[]} */
  const hits = [];
  items.forEach((item, index) => {
    const s = score(item, q, tokens, lang);
    if (s > 0) hits.push({ item, index, score: s });
  });
  hits.sort((a, b) => b.score - a.score || a.index - b.index);
  return hits.map((h) => h.item);
}

/* ------------------------------------------------------------------ filters */

/** @param {Facetable} item @param {Filters} f @param {"group" | "equipment" | "pattern" | null} [skip] */
function passes(item, f, skip = null) {
  const groups = typeof f.group === "string" ? [f.group] : f.group ?? [];
  if (skip !== "group" && groups.length && !groups.some((group) => item.groups.includes(group))) return false;
  if (skip !== "equipment" && f.equipment && item.equipment !== f.equipment) return false;
  if (skip !== "pattern" && f.pattern && item.pattern !== f.pattern) return false;
  return true;
}

/**
 * Items passing every active filter (null/empty = no filter). Order is kept.
 * @template {Facetable} T @param {readonly T[]} items @param {Filters} filters @returns {T[]}
 */
export const filterItems = (items, filters) => items.filter((item) => passes(item, filters));

/**
 * Faceted counts: for each filter row, how many items each value would leave given the OTHER active filters, so a
 * row never offers a dead end.
 * @param {readonly Facetable[]} items @param {Filters} filters
 * @returns {{ group: Map<string, number>, equipment: Map<string, number>, pattern: Map<string, number> }}
 */
export function facetCounts(items, filters) {
  const group = new Map();
  const equipment = new Map();
  const pattern = new Map();
  for (const item of items) {
    if (passes(item, filters, "group")) for (const g of item.groups) group.set(g, (group.get(g) ?? 0) + 1);
    if (passes(item, filters, "equipment")) equipment.set(item.equipment, (equipment.get(item.equipment) ?? 0) + 1);
    if (passes(item, filters, "pattern")) pattern.set(item.pattern, (pattern.get(item.pattern) ?? 0) + 1);
  }
  return { group, equipment, pattern };
}

/**
 * Machines and cable stations first, keeping the catalog's preference order inside each block (stable).
 * @template {{ equipment: string }} T @param {readonly T[]} items @returns {T[]}
 */
export function machinesFirst(items) {
  return items
    .map((item, index) => ({ item, index, m: isMachine(item.equipment) ? 0 : 1 }))
    .sort((a, b) => a.m - b.m || a.index - b.index)
    .map((x) => x.item);
}

/* ------------------------------------------------------------------ display helpers */

/**
 * "6–12 reps" / "20–60 s" / "20–40 m" for a rep range in its unit.
 * @param {readonly [number, number] | number[]} range @param {string | undefined} unit @param {Lang} lang
 */
export function repRangeLabel(range, unit, lang) {
  const [lo, hi] = range;
  const span = lo === hi ? `${lo}` : `${lo}–${hi}`;
  if (unit === "seconds") return `${span} ${lang === "ru" ? "с" : "s"}`;
  if (unit === "meters") return `${span} ${lang === "ru" ? "м" : "m"}`;
  return `${span} ${lang === "ru" ? "повт." : "reps"}`;
}
