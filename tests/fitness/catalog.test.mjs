// Stream 02 — exercise catalog: data integrity against the registry and the type unions, the picture index, the
// lookups other streams use (search, alternatives at a gym, images, classes, program slots, facets), the muscle map
// geometry and the personal history rows. plans/fitness/02-exercise-catalog-and-alternatives.md
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CLASSES, CLASS_NAMES, EQUIPMENT, EXERCISES, GROUPS, MACHINE_EQUIPMENT, MUSCLES, OWNER_TEMPLATE, PATTERNS, REGISTRY_VERSION,
  alternativesFor, classLabel, classMates, classOf, equipmentLabel, equipmentShort, exerciseById, exerciseClassLabel,
  exerciseImages, exercisesForGroup, exercisesForMuscle, facetCounts, filterItems, foldText, groupById, groupOfMuscle,
  groupsOf, isAvailable, isMachine, machineImage, machinesFirst, muscleById, muscleImage, muscleNames, ownerPrimary,
  patternLabel, patternShort, programSlots, repRangeLabel, searchExercises, searchItems,
} from "../../src/lib/fitness/catalog.mjs";
import { BACK, BODY, FRONT, SHAPE_GROUPS, VIEW_H, VIEW_W, compactCrop } from "../../src/components/fitness/exercises/shapes.mjs";
import { exerciseHistory } from "../../src/components/fitness/exercises/history.mjs";

const root = path.resolve(import.meta.dirname, "../..");
/** @param {string} file */
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const registry = readJson("content/fitness/registry.json");
const raw = readJson("content/fitness/exercises.json");
const images = readJson("content/fitness/images.json");
const types = fs.readFileSync(path.join(root, "src/lib/fitness/types.ts"), "utf8");
/** @param {string} name */
const union = (name) => /** @type {string[]} */ ((types.match(new RegExp(`export type ${name} =([\\s\\S]*?);`))?.[1] ?? "").match(/"([a-z-]+)"/g) ?? []).map((s) => s.slice(1, -1));
const MOVEMENT_PATTERNS = union("MovementPattern");
const EQUIPMENT_UNION = union("Equipment");
const MUSCLE_IDS = new Set(registry.muscles.map((/** @type {{id: string}} */ m) => m.id));
const GROUP_IDS = registry.groups.map((/** @type {{id: string}} */ g) => g.id);
const OWNER_IDS = registry.ownerTemplate.days.flatMap((/** @type {{slots: [string, string][]}} */ d) => d.slots.map(([, id]) => id));
const ids = (/** @type {{id: string}[]} */ list) => list.map((e) => e.id);
/** @type {import("../../src/lib/fitness/types").Gym} */
const baseGym = { id: "g", name: "Test gym", available: [], missing: [], preferred: {}, updatedAt: "2026-11-08T00:00:00.000Z" };

describe("catalog data", () => {
  it("has every registry id once, in registry order, and nothing else", () => {
    assert.equal(EXERCISES.length, 138);
    assert.deepEqual(ids(EXERCISES), Object.keys(registry.exercises));
    assert.equal(new Set(ids(EXERCISES)).size, EXERCISES.length);
    for (const e of EXERCISES) assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.id);
  });

  it("is content/fitness/exercises.json with only `images` filled in from the picture index", () => {
    assert.equal(raw.length, EXERCISES.length);
    EXERCISES.forEach((e, i) => assert.deepEqual({ ...e, images: [] }, { ...raw[i], images: [] }, e.id));
  });

  it("matches the registry's class and pattern and the type unions", () => {
    for (const e of EXERCISES) {
      const reg = registry.exercises[e.id];
      assert.equal(e.class, reg.class, `${e.id} class`);
      assert.equal(e.pattern, reg.pattern, `${e.id} pattern`);
      assert.ok(MOVEMENT_PATTERNS.includes(e.pattern), `${e.id} pattern ${e.pattern} not in MovementPattern`);
      assert.ok(EQUIPMENT_UNION.includes(e.equipment), `${e.id} equipment ${e.equipment} not in Equipment`);
      assert.ok([1, 2, 3].includes(e.difficulty), `${e.id} difficulty`);
      assert.ok(e.name.en.trim() && e.name.ru.trim() && e.setup?.en.trim() && e.setup?.ru.trim(), `${e.id} bilingual name and setup`);
    }
  });

  it("lists valid alternatives: registry ids, not itself, no duplicates, at least two", () => {
    for (const e of EXERCISES) {
      assert.ok(e.alternatives.length >= 2, `${e.id} has ${e.alternatives.length} alternatives`);
      assert.equal(new Set(e.alternatives).size, e.alternatives.length, `${e.id} duplicate alternatives`);
      for (const alt of e.alternatives) {
        assert.notEqual(alt, e.id, `${e.id} lists itself`);
        assert.ok(exerciseById(alt), `${e.id} → unknown alternative ${alt}`);
      }
    }
  });

  it("uses only registry muscles, at least one primary, never a muscle as both primary and secondary", () => {
    for (const e of EXERCISES) {
      assert.ok(e.primary.length > 0, `${e.id} primary`);
      for (const m of [...e.primary, ...e.secondary]) assert.ok(MUSCLE_IDS.has(m), `${e.id} muscle ${m}`);
      assert.ok(!e.primary.some((m) => e.secondary.includes(m)), `${e.id} primary ∩ secondary`);
    }
  });

  it("has load steps that fit the equipment", () => {
    const allowed = new Set([0, 1, 1.25, 2, 2.5, 4, 5]);
    for (const e of EXERCISES) {
      assert.ok(allowed.has(e.increment), `${e.id} increment ${e.increment}`);
      const unloaded = e.equipment === "bodyweight" || e.equipment === "band";
      assert.equal(e.increment > 0, !unloaded, `${e.id}: ${e.equipment} with increment ${e.increment}`);
    }
  });

  it("has rep ranges that make sense for their unit", () => {
    for (const e of EXERCISES) {
      const [lo, hi] = e.repRange;
      assert.ok(Number.isInteger(lo) && Number.isInteger(hi) && lo > 0 && lo <= hi, `${e.id} range ${lo}–${hi}`);
      const unit = e.repUnit ?? "reps";
      assert.ok(["reps", "seconds", "meters"].includes(unit), `${e.id} unit ${unit}`);
      if (unit === "reps") assert.ok(lo >= 3 && hi <= 20, `${e.id} ${lo}–${hi} reps`);
      else assert.ok(lo >= 10 && hi <= 60, `${e.id} ${lo}–${hi} ${unit}`);
    }
  });

  it("has at least four cues and three mistakes per exercise, with as many in Russian as in English", () => {
    for (const e of EXERCISES) {
      assert.ok(e.cues.en.length >= 4, `${e.id} cues`);
      assert.equal(e.cues.ru.length, e.cues.en.length, `${e.id} cue counts`);
      assert.ok(e.mistakes.en.length >= 3, `${e.id} mistakes`);
      assert.equal(e.mistakes.ru.length, e.mistakes.en.length, `${e.id} mistake counts`);
      for (const line of [...e.cues.en, ...e.cues.ru, ...e.mistakes.en, ...e.mistakes.ru]) assert.ok(line.trim().length > 8, `${e.id}: "${line}"`);
      assert.ok(e.cues.ru.some((line) => /[а-яё]/i.test(line)), `${e.id} Russian cues are Russian`);
    }
  });

  it("gives every coarse muscle group at least two exercises", () => {
    for (const g of GROUP_IDS) assert.ok(EXERCISES.filter((e) => groupsOf(e.id).includes(g)).length >= 2, g);
  });

  it("tags exactly the owner's program as owner-primary, and ownerPrimary() follows the slot order", () => {
    const tagged = EXERCISES.filter((e) => e.tags?.includes("owner-primary")).map((e) => e.id);
    assert.deepEqual([...tagged].sort(), [...new Set(OWNER_IDS)].sort());
    assert.deepEqual(ids(ownerPrimary()), [...new Set(OWNER_IDS)]);
    assert.equal(OWNER_TEMPLATE.days.length, 3);
  });

  it("cites a source for every exercise and keeps start loads sane", () => {
    for (const e of EXERCISES) {
      assert.ok(e.sources?.length, `${e.id} sources`);
      for (const s of e.sources ?? []) assert.match(s, /https?:\/\//, `${e.id} source without a URL: ${s}`);
      if (e.startLoad) assert.ok(e.startLoad.kg >= 0 && e.startLoad.kg < 200 && e.startLoad.source.length > 5, `${e.id} startLoad`);
    }
  });
});

describe("content/fitness/images.json", () => {
  it("has the contract's shape, registry keys only, and every file exists", () => {
    assert.deepEqual(Object.keys(images).sort(), ["exercises", "machines", "muscles"]);
    for (const [id, shots] of Object.entries(images.exercises)) {
      assert.ok(registry.exercises[id], `exercises.${id}`);
      const angles = shots.map((/** @type {{angle: string}} */ s) => s.angle);
      assert.equal(new Set(angles).size, angles.length, `${id} duplicate angle`);
      if (angles.includes("sequence")) assert.equal(angles[0], "sequence", `${id}: sequence first`);
      for (const shot of shots) {
        assert.deepEqual(Object.keys(shot).sort(), ["angle", "src", "v"]);
        assert.equal(shot.src, `fitness/exercises/${id}/${shot.angle}.webp`);
        assert.match(shot.v, /^[0-9a-f]{8}$/);
        assert.ok(fs.existsSync(path.join(root, "public/media", shot.src)), shot.src);
      }
    }
    for (const [id, file] of Object.entries(images.machines)) {
      assert.ok(registry.exercises[id], `machines.${id}`);
      assert.equal(file.src, `fitness/machines/${id}.webp`);
      assert.ok(fs.existsSync(path.join(root, "public/media", file.src)), file.src);
    }
    for (const [group, file] of Object.entries(images.muscles)) {
      assert.ok(GROUP_IDS.includes(group), `muscles.${group}`);
      assert.equal(file.src, `fitness/muscles/${group}.webp`);
      assert.ok(fs.existsSync(path.join(root, "public/media", file.src)), file.src);
    }
  });
});

describe("pictures", () => {
  it("exerciseImages(): /media URLs with the ?v= hash, sequence first, bilingual alt", () => {
    for (const [id, shots] of Object.entries(images.exercises)) {
      const pics = exerciseImages(id);
      assert.equal(pics.length, shots.length, id);
      pics.forEach((pic, i) => {
        assert.equal(pic.angle, shots[i].angle);
        assert.equal(pic.src, `/media/${shots[i].src}?v=${shots[i].v}`);
        assert.ok(pic.alt.en.startsWith(exerciseById(id)?.name.en ?? "?"), `${id} alt en`);
        assert.ok(pic.alt.ru.startsWith(exerciseById(id)?.name.ru ?? "?"), `${id} alt ru`);
      });
      assert.deepEqual(exerciseById(id)?.images, pics, `${id}: EXERCISES carry the same images`);
    }
    const without = EXERCISES.find((e) => !images.exercises[e.id]);
    if (without) assert.deepEqual(exerciseImages(without.id), []);
    assert.deepEqual(exerciseImages("no-such-exercise"), []);
  });

  it("machineImage() and muscleImage() follow the index and return null when there is no picture", () => {
    for (const [id, file] of Object.entries(images.machines)) {
      const pic = machineImage(id);
      assert.equal(pic?.src, `/media/${file.src}?v=${file.v}`);
      assert.ok(pic?.alt.en && pic.alt.ru);
    }
    for (const [group, file] of Object.entries(images.muscles)) assert.equal(muscleImage(group)?.src, `/media/${file.src}?v=${file.v}`);
    assert.equal(machineImage("no-such-exercise"), null);
    assert.equal(muscleImage("no-such-group"), null);
    const noMachine = EXERCISES.find((e) => !images.machines[e.id]);
    if (noMachine) assert.equal(machineImage(noMachine.id), null);
  });
});

describe("search", () => {
  it("folds case, diacritics, ё and punctuation", () => {
    assert.equal(foldText("Жим ЛЁЖА — Pull-Up Ä"), "жим лежа pull up a");
    assert.equal(foldText("  "), "");
    assert.equal(foldText(null), "");
  });

  it("finds by name in either language, ranks the current language's name prefix first", () => {
    assert.equal(searchExercises("pec deck", "en")[0]?.id, "pec-deck");
    assert.equal(searchExercises("бабочка", "ru")[0]?.id, "pec-deck");
    assert.ok(ids(searchExercises("бабочка", "en")).includes("pec-deck"), "Russian name from the English page");
    const press = searchExercises("chest press", "en");
    assert.equal(press[0]?.id, "machine-chest-press");
    assert.ok(press.length >= 3);
  });

  it("is insensitive to hyphens and spaces: pullup, pull up and pull-up agree", () => {
    const a = ids(searchExercises("pullup", "en"));
    assert.ok(a.includes("pull-up") && a.includes("assisted-pull-up"), a.join(","));
    assert.deepEqual(ids(searchExercises("pull up", "en")).slice(0, 3), ids(searchExercises("pull-up", "en")).slice(0, 3));
  });

  it("searches machine model names (aka) and ANDs the words", () => {
    const technogym = ids(searchExercises("technogym", "ru"));
    assert.ok(technogym.includes("machine-chest-press"), "Technogym chest press by its aka");
    assert.ok(technogym.length > 1);
    const both = ids(searchExercises("technogym chest press", "en"));
    assert.equal(both[0], "machine-chest-press");
    assert.deepEqual(searchExercises("zzzz qqqq", "en"), []);
  });

  it("returns everything in catalog order for an empty query", () => {
    assert.deepEqual(ids(searchExercises("", "en")), ids(EXERCISES));
    assert.deepEqual(ids(searchExercises("   ", "ru")), ids(EXERCISES));
  });

  it("searchItems works on trimmed rows (the client's list) exactly like searchExercises", () => {
    const rows = EXERCISES.map((e) => ({ id: e.id, name: e.name, aka: e.aka }));
    for (const q of ["curl", "тяга", "hammer", "row"]) assert.deepEqual(ids(searchItems(rows, q, "en")), ids(searchExercises(q, "en")), q);
  });
});

describe("alternatives and gyms", () => {
  it("returns the catalog order without a gym, or with a gym that has everything", () => {
    const all = exerciseById("machine-chest-press")?.alternatives;
    assert.deepEqual(alternativesFor("machine-chest-press"), all);
    assert.deepEqual(alternativesFor("machine-chest-press", baseGym), all);
    assert.deepEqual(alternativesFor("no-such-exercise"), []);
  });

  it("drops what the gym is missing and keeps only what a gym with a list has", () => {
    const missing = { ...baseGym, missing: ["converging-chest-press", "push-up"] };
    assert.deepEqual(alternativesFor("machine-chest-press", missing), ["plate-loaded-chest-press", "dumbbell-bench-press", "smith-bench-press"]);
    const listed = { ...baseGym, available: ["pec-deck", "dumbbell-bench-press", "machine-chest-press"] };
    assert.deepEqual(alternativesFor("machine-chest-press", listed), ["dumbbell-bench-press"]);
    assert.equal(isAvailable("pec-deck", listed), true);
    assert.equal(isAvailable("cable-fly", listed), false);
    assert.equal(isAvailable("pec-deck", { ...listed, missing: ["pec-deck"] }), false, "missing wins over available");
    assert.equal(isAvailable("pec-deck", null), true);
  });

  it("finds an available swap for every owner exercise at a gym without that machine", () => {
    for (const id of OWNER_IDS) {
      const gym = { ...baseGym, missing: [id] };
      assert.ok(alternativesFor(id, gym).length >= 1, id);
    }
  });

  it("programSlots maps exercises to slots, from program days or the template, with the gym's swaps", () => {
    const slots = programSlots(OWNER_TEMPLATE.days);
    assert.deepEqual(slots["machine-chest-press"], ["A1"]);
    assert.deepEqual(slots["cable-fly"], ["B4"]);
    assert.equal(slots["push-up"], undefined);
    const days = [{ slots: [{ slotId: "A1", exerciseId: "machine-chest-press" }, { slotId: "A3", exerciseId: "pec-deck" }] }];
    const gym = { ...baseGym, preferred: { A1: "converging-chest-press", "pec-deck": "cable-fly" } };
    const withGym = programSlots(days, gym);
    assert.deepEqual(withGym["converging-chest-press"], ["A1"]);
    assert.deepEqual(withGym["cable-fly"], ["A3"]);
    assert.deepEqual(withGym["machine-chest-press"], ["A1"]);
    assert.deepEqual(programSlots(null), {});
  });
});

describe("classes and labels", () => {
  it("classOf() is the registry class; classMates() spans every class without self or duplicates", () => {
    assert.equal(classOf("face-pull")?.id, "rear-delt");
    const mates = classMates("face-pull");
    assert.ok(mates.includes("reverse-pec-deck") && mates.includes("cable-external-rotation"), mates.join(","));
    assert.ok(!mates.includes("face-pull"));
    assert.equal(new Set(mates).size, mates.length);
    for (const e of EXERCISES) {
      assert.equal(classOf(e.id)?.id, e.class, e.id);
      assert.ok(classOf(e.id)?.members.includes(e.id), `${e.id} is a member of its class`);
    }
    assert.equal(classOf("no-such-exercise"), undefined);
    assert.deepEqual(classMates("no-such-exercise"), []);
  });

  it("names every class, pattern and equipment type in both languages", () => {
    assert.deepEqual(Object.keys(CLASS_NAMES).sort(), CLASSES.map((c) => c.id).sort());
    assert.deepEqual(PATTERNS.map((p) => p.id).sort(), [...MOVEMENT_PATTERNS].sort());
    assert.deepEqual(EQUIPMENT.map((e) => e.id).sort(), [...EQUIPMENT_UNION].sort());
    for (const p of PATTERNS) assert.ok(p.name.en && /[а-яё]/i.test(p.name.ru) && p.short.en && p.short.ru, p.id);
    for (const e of EQUIPMENT) assert.ok(e.name.en && /[а-яё]/i.test(e.name.ru), e.id);
    assert.equal(patternLabel("horizontal-push", "en"), "Horizontal press");
    assert.equal(patternLabel("vertical-pull", "ru"), "Вертикальная тяга");
    assert.equal(equipmentLabel("selectorized", "en"), "Pin-loaded machine");
    assert.equal(equipmentLabel("assisted", "ru"), "Гравитрон");
    assert.equal(classLabel("horizontal-press", "ru"), "Горизонтальные жимы");
    assert.equal(classLabel(undefined, "en"), "");
    assert.deepEqual([...MACHINE_EQUIPMENT].sort(), ["assisted", "cable", "plate-loaded", "selectorized", "smith"]);
  });

  it("formats rep ranges in their unit", () => {
    assert.equal(repRangeLabel([6, 12], undefined, "en"), "6–12 reps");
    assert.equal(repRangeLabel([20, 60], "seconds", "ru"), "20–60 с");
    assert.equal(repRangeLabel([20, 40], "meters", "en"), "20–40 m");
  });

  it("has a name for every muscle in both languages", () => {
    const en = muscleNames("en");
    const ru = muscleNames("ru");
    for (const m of MUSCLES) assert.ok(en[m.id] && /[а-яё]/i.test(ru[m.id]), m.id);
  });
});

describe("labels and lookups the screens use", () => {
  it("short chip labels for equipment and movement patterns, in both languages", () => {
    assert.equal(equipmentShort("selectorized", "en"), "Pin-loaded");
    assert.equal(equipmentShort("plate-loaded", "ru"), "С дисками");
    assert.equal(equipmentShort("cable", "ru"), "Блок");
    assert.equal(patternShort("chest-fly", "en"), "Fly");
    assert.equal(patternShort("horizontal-pull", "ru"), "Тяга к поясу");
    for (const e of EQUIPMENT) assert.ok(equipmentShort(e.id, "en").length <= equipmentLabel(e.id, "en").length, `${e.id}: short is not longer`);
  });

  it("an unknown id comes back as it is (a newer row on an older page), never undefined", () => {
    assert.equal(equipmentLabel("trx", "en"), "trx");
    assert.equal(equipmentShort("trx", "ru"), "trx");
    assert.equal(patternLabel("lunge-jump", "ru"), "lunge-jump");
    assert.equal(patternShort("lunge-jump", "en"), "lunge-jump");
    assert.equal(classLabel("mystery-class", "ru"), "mystery-class");
    assert.equal(exerciseClassLabel("no-such-exercise", "en"), "");
  });

  it("isMachine: machines and cable stations, not free weights or unknown kinds", () => {
    for (const eq of ["selectorized", "plate-loaded", "cable", "assisted", "smith"]) assert.equal(isMachine(eq), true, eq);
    for (const eq of ["dumbbell", "barbell", "kettlebell", "bodyweight", "band", "trx", "", null, undefined]) assert.equal(isMachine(eq), false, String(eq));
  });

  it("exerciseClassLabel names the substitution class an exercise belongs to", () => {
    assert.equal(exerciseClassLabel("pec-deck", "en"), "Chest flies");
    assert.equal(exerciseClassLabel("pec-deck", "ru"), "Сведения на грудь");
    assert.equal(exerciseClassLabel("machine-chest-press", "ru"), "Горизонтальные жимы");
  });

  it("muscle and group lookups: registry rows by id, groups in display order, 'other' for an unknown muscle", () => {
    assert.equal(REGISTRY_VERSION, registry.version);
    assert.deepEqual(GROUPS.map((g) => g.id), GROUP_IDS);
    assert.deepEqual(GROUPS.map((g) => g.order), [...GROUPS.map((g) => g.order)].sort((a, b) => a - b), "display order");
    assert.deepEqual(groupById("chest")?.name, { en: "Chest", ru: "Грудь" });
    assert.equal(groupById("no-such-group"), undefined);
    assert.equal(muscleById("lats")?.group, "back");
    assert.equal(muscleById("lats")?.name.ru, "Широчайшие");
    assert.equal(muscleById("no-such-muscle"), undefined);
    assert.equal(groupOfMuscle("pec-sternal"), "chest");
    assert.equal(groupOfMuscle("no-such-muscle"), "other");
    assert.deepEqual(groupsOf("farmers-carry"), ["forearms", "back"], "each group once, primary muscles only");
    assert.deepEqual(groupsOf("no-such-exercise"), []);
  });

  it("exercisesForMuscle (master plan §7) and exercisesForGroup: exercises that work it as a primary mover", () => {
    const lats = ids(exercisesForMuscle("lats"));
    for (const id of ["lat-pulldown", "assisted-pull-up", "machine-row", "seated-cable-row"]) assert.ok(lats.includes(id), id);
    assert.ok(!lats.includes("pec-deck") && !lats.includes("face-pull"));
    assert.ok(exercisesForMuscle("lats").every((e) => e.primary.includes("lats")));
    assert.deepEqual(exercisesForMuscle("no-such-muscle"), []);
    const chest = exercisesForGroup("chest");
    assert.ok(chest.length >= 10 && ids(chest).includes("pec-deck") && ids(chest).includes("machine-chest-press"));
    assert.ok(chest.every((e) => groupsOf(e.id).includes("chest")));
    assert.ok(!ids(chest).includes("lat-pulldown"));
    assert.deepEqual(exercisesForGroup("no-such-group"), []);
  });

  it("repRangeLabel: a single target, and the Russian units", () => {
    assert.equal(repRangeLabel([8, 8], undefined, "en"), "8 reps");
    assert.equal(repRangeLabel([6, 12], "reps", "ru"), "6–12 повт.");
    assert.equal(repRangeLabel([30, 30], "seconds", "en"), "30 s");
    assert.equal(repRangeLabel([20, 40], "meters", "ru"), "20–40 м");
  });

  it("searchItems ranks the documented tiers: name prefix, word start, inside a word, other language, aka, id, spread", () => {
    const items = [
      { id: "butterfly-press", name: { en: "Press", ru: "Жим" } }, // id only → 30
      { id: "w", name: { en: "Peck deck", ru: "Пек-дек" }, aka: ["Butterfly 2000"] }, // aka → 40
      { id: "z", name: { en: "Rear delt", ru: "Задняя дельта, reverse fly" } }, // other language, inside → 50
      { id: "y", name: { en: "Rope pull", ru: "Fly-тренажёр" } }, // other language prefix → 55
      { id: "x", name: { en: "Butterfly stretch", ru: "Растяжка" } }, // inside a word of the own name → 60
      { id: "cable-fly", name: { en: "Cable fly", ru: "Сведение в кроссовере" } }, // a word starts with it → 80
      { id: "fly-machine", name: { en: "Fly machine", ru: "Бабочка" }, aka: ["Pec Fly 3000"] }, // name prefix → 100
    ];
    assert.deepEqual(ids(searchItems(items, "fly", "en")), ["fly-machine", "cable-fly", "x", "y", "z", "w", "butterfly-press"]);
    assert.deepEqual(ids(searchItems(items, "peck 2000", "en")), ["w"], "words spread over the name and an aka");
    assert.deepEqual(ids(searchItems(items, "БАБОЧКА", "ru")), ["fly-machine"]);
    assert.deepEqual(ids(searchItems(items, "тренажер", "ru")), ["y"], "ё folds to е");
    assert.deepEqual(searchItems(items, "rowing", "en"), []);
  });

  it("programSlots skips days without slots, slots without an exercise and empty preferences", () => {
    assert.deepEqual(programSlots(/** @type {any} */ ([{ key: "A" }, { slots: [{ slotId: "A9" }] }])), {});
    const gym = { ...baseGym, preferred: { A1: "", "machine-chest-press": "converging-chest-press" } };
    assert.deepEqual(programSlots([{ slots: [["A1", "machine-chest-press"], ["A1", "machine-chest-press"]] }], gym), {
      "machine-chest-press": ["A1"], "converging-chest-press": ["A1"],
    });
  });
});

describe("list filters", () => {
  const rows = EXERCISES.map((e) => ({ id: e.id, equipment: e.equipment, pattern: e.pattern, groups: groupsOf(e.id) }));

  it("filters by group, equipment and pattern together", () => {
    const chestMachines = filterItems(rows, { group: "chest", equipment: "selectorized" });
    assert.ok(chestMachines.length >= 3);
    assert.ok(chestMachines.every((r) => r.groups.includes("chest") && r.equipment === "selectorized"));
    assert.deepEqual(filterItems(rows, {}), rows);
    assert.deepEqual(ids(filterItems(rows, { pattern: "chest-fly", equipment: "selectorized" })), ["pec-deck"]);
  });

  it("counts each facet under the other active filters only", () => {
    const counts = facetCounts(rows, { group: "chest", equipment: "cable" });
    assert.equal(counts.equipment.get("cable"), filterItems(rows, { group: "chest", equipment: "cable" }).length);
    assert.equal(counts.equipment.get("selectorized"), filterItems(rows, { group: "chest", equipment: "selectorized" }).length);
    assert.equal(counts.group.get("back"), filterItems(rows, { group: "back", equipment: "cable" }).length);
    for (const [pattern, n] of counts.pattern) assert.equal(n, filterItems(rows, { group: "chest", equipment: "cable", pattern }).length, pattern);
  });

  it("puts machines first and keeps the catalog order inside each block", () => {
    const sorted = machinesFirst(rows);
    const firstFree = sorted.findIndex((r) => !MACHINE_EQUIPMENT.includes(/** @type {any} */ (r.equipment)));
    assert.ok(firstFree > 0);
    assert.ok(sorted.slice(firstFree).every((r) => !MACHINE_EQUIPMENT.includes(/** @type {any} */ (r.equipment))));
    const order = new Map(rows.map((r, i) => [r.id, i]));
    for (const block of [sorted.slice(0, firstFree), sorted.slice(firstFree)]) {
      for (let i = 1; i < block.length; i++) assert.ok((order.get(block[i - 1].id) ?? 0) < (order.get(block[i].id) ?? 0));
    }
  });
});

describe("muscle map geometry", () => {
  it("draws every registry muscle, with the registry's group", () => {
    const drawn = new Set([...FRONT, ...BACK].map((m) => m.muscle));
    assert.deepEqual([...drawn].sort(), [...MUSCLE_IDS].sort());
    for (const m of [...FRONT, ...BACK]) assert.equal(m.group, registry.muscles.find((/** @type {{id: string}} */ r) => r.id === m.muscle).group, m.muscle);
    assert.deepEqual(Object.keys(SHAPE_GROUPS).sort(), [...MUSCLE_IDS].sort());
  });

  it("has one path per muscle and view, inside the 200 × 420 view box, both halves mirrored", () => {
    for (const view of [FRONT, BACK]) {
      const names = view.map((m) => m.muscle);
      assert.equal(new Set(names).size, names.length);
      assert.ok(view.length >= 18);
      for (const m of view) {
        assert.match(m.d, /^M [\d.]+ [\d.]+ /, m.muscle);
        const [x0, y0, x1, y1] = m.box;
        assert.ok(x0 >= 0 && y0 >= 0 && x1 <= VIEW_W && y1 <= VIEW_H, `${m.muscle} box ${m.box}`);
        assert.ok(Math.abs(x0 + x1 - VIEW_W) < 0.5, `${m.muscle} is symmetric about x = 100 (${x0}, ${x1})`);
      }
    }
    assert.ok(BODY.endsWith("Z") && BODY.length > 1000);
  });

  it("marks only the transverse abdominis as deep", () => {
    assert.deepEqual([...FRONT, ...BACK].filter((m) => m.deep).map((m) => m.muscle), ["transverse-abdominis"]);
  });

  it("crops thumbnails to the view and region of the worked muscles", () => {
    /** @param {string[]} primary @param {string[]} [secondary] */
    const level = (primary, secondary = []) => (/** @type {string} */ id) => (primary.includes(id) ? "primary" : secondary.includes(id) ? "secondary" : "none");
    const chest = compactCrop(level(["pec-sternal"], ["delt-front", "triceps-lateral"]));
    assert.equal(chest.view, "front");
    const [, y, w, h] = chest.viewBox.split(" ").map(Number);
    assert.ok(Math.abs(w / h - 1.5) < 0.01 && y < 100 && y + h > 120, chest.viewBox);
    assert.equal(compactCrop(level(["lats"], ["biceps"])).view, "back");
    const calves = compactCrop(level(["gastrocnemius", "soleus"]));
    assert.equal(calves.view, "back");
    assert.ok(Number(calves.viewBox.split(" ")[1]) > 250, calves.viewBox);
    assert.deepEqual(compactCrop(level([])), { view: "front", viewBox: "0 0 200 420" });
  });
});

describe("personal history", () => {
  const sessions = {
    s1: { id: "s1", programId: "p", dayKey: "A", gymId: null, startedAt: "2026-11-01T09:00:00.000Z", endedAt: null, status: "finished", updatedAt: "x" },
    s2: { id: "s2", programId: "p", dayKey: "A", gymId: null, startedAt: "2026-11-04T09:00:00.000Z", endedAt: null, status: "finished", updatedAt: "x" },
  };
  /** @param {string} id @param {string} sessionId @param {string} exerciseId @param {number} kg @param {number} reps @param {"warmup" | "working"} [kind] */
  const set = (id, sessionId, exerciseId, kg, reps, kind = "working") => ({
    id, sessionId, slotId: "A1", exerciseId, setIndex: 0, kind, plannedKg: kg, plannedReps: reps, kg, reps, rir: 2,
    doneAt: sessions[/** @type {"s1" | "s2"} */ (sessionId)].startedAt, updatedAt: "x",
  });
  const base = { sessions, bodyweight: {}, settings: null };

  it("gives one row per session, newest first, with the best set and its e1RM; warm-ups never count", () => {
    const sets = Object.fromEntries([
      set("a", "s1", "machine-chest-press", 40, 10), set("b", "s1", "machine-chest-press", 45, 6),
      set("w", "s2", "machine-chest-press", 60, 3, "warmup"), set("c", "s2", "machine-chest-press", 45, 10),
      set("x", "s2", "pec-deck", 30, 12),
    ].map((s) => [s.id, s]));
    const rows = exerciseHistory(/** @type {any} */ ({ ...base, sets }), { id: "machine-chest-press", equipment: "selectorized" });
    assert.deepEqual(rows.map((r) => r.sessionId), ["s2", "s1"]);
    assert.equal(rows[0].best.id, "c");
    assert.equal(rows[0].sets, 1);
    assert.ok(rows[0].e1rm && rows[0].e1rm > 45 && rows[0].reliable);
    assert.equal(rows[1].sets, 2);
    assert.ok(rows[0].e1rm > (rows[1].e1rm ?? Infinity));
  });

  it("needs a body weight for assisted machines and keeps holds and carries without an e1RM", () => {
    const sets = { a: set("a", "s1", "assisted-pull-up", 30, 8), b: set("b", "s1", "assisted-pull-up", 25, 6) };
    const facts = { id: "assisted-pull-up", equipment: "assisted", assistance: true };
    const noWeight = exerciseHistory(/** @type {any} */ ({ ...base, sets }), facts);
    assert.equal(noWeight[0].e1rm, null);
    assert.equal(noWeight[0].best.id, "b", "less assistance is the better set");
    const withWeight = exerciseHistory(/** @type {any} */ ({ ...base, sets, settings: { bodyweightKg: 80 } }), facts);
    assert.ok(withWeight[0].e1rm && withWeight[0].e1rm > 50);
    const carry = exerciseHistory(/** @type {any} */ ({ ...base, sets: { c: set("c", "s2", "farmers-carry", 24, 40) } }), { id: "farmers-carry", equipment: "dumbbell", repUnit: "meters" });
    assert.equal(carry[0].e1rm, null);
    assert.equal(exerciseHistory(/** @type {any} */ ({ ...base, sets: {} }), facts).length, 0);
  });
});
