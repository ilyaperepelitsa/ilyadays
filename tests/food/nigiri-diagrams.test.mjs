import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const SHAPING_STEPS = [3, 4, 5, 6, 7, 8, 9];

/**
 * The exported nigiri page for one language.
 *
 * @param {string} lang
 * @returns {{ steps: { images: { diagram?: string | null } }[] }}
 */
function recipe(lang) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content", lang, "recipes/nigiri.json"), "utf8"));
}

/**
 * Step numbers (1-based) whose images carry a hand-position blueprint.
 *
 * @param {string} lang
 * @returns {number[]}
 */
function diagramSteps(lang) {
  return recipe(lang).steps.flatMap((step, i) => (step.images.diagram ? [i + 1] : []));
}

describe("nigiri hand-position blueprints", () => {
  it("are on exactly the seven shaping steps, in both languages", () => {
    assert.deepEqual(diagramSteps("en"), SHAPING_STEPS);
    assert.deepEqual(diagramSteps("ru"), SHAPING_STEPS);
  });

  it("show three projections, the cook's own view, the joint angles and the key", () => {
    const sideLock = recipe("en").steps[5].images.diagram ?? "";
    assert.equal((sideLock.match(/class="pose-view"/g) ?? []).length, 4);
    assert.equal(sideLock.includes("Your own view, looking down"), true);
    assert.equal(sideLock.includes('class="pose-angles"'), true);
    assert.equal(sideLock.includes('class="pose-legend"'), true);
  });

  it("give the second quarter turn its own phase", () => {
    const rotate = recipe("en").steps[7].images.diagram ?? "";
    assert.equal((rotate.match(/class="pose-phase"/g) ?? []).length, 4);
  });

  it("are labelled in Russian on the Russian page", () => {
    const sideLock = recipe("ru").steps[5].images.diagram ?? "";
    assert.equal(sideLock.includes("Сверху"), true);
    assert.equal(sideLock.includes("Top, looking down"), false);
  });
});
