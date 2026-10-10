import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
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
 * Step numbers (1-based) whose images carry a technical contact guide.
 *
 * @param {string} lang
 * @returns {number[]}
 */
function diagramSteps(lang) {
  return recipe(lang).steps.flatMap((step, i) => (step.images.diagram ? [i + 1] : []));
}

describe("nigiri photographic technique plates", () => {
  it("are on exactly the seven shaping steps, in both languages", () => {
    assert.deepEqual(diagramSteps("en"), SHAPING_STEPS);
    assert.deepEqual(diagramSteps("ru"), SHAPING_STEPS);
  });

  it("replace every shaping illustration and blueprint with a shipped picture and contact guide", () => {
    for (const lang of ["en", "ru"]) {
      for (const n of SHAPING_STEPS) {
        const { images } = recipe(lang).steps[n - 1];
        assert.match(images.illustration, new RegExp(`^illustrations/nigiri/technique-${n}\\.webp\\?v=[a-f0-9]{10}$`));
        const asset = fs.readFileSync(path.join(ROOT, "public/media", images.illustration.split("?")[0]));
        assert.equal(asset.toString("ascii", 0, 4), "RIFF");
        assert.equal(asset.toString("ascii", 8, 12), "WEBP");
        assert.ok(asset.length > 20_000, "picture is a full photographic asset");
        assert.deepEqual(images.how, [], "old pictures do not compete with the plate");
        assert.equal(images.result, null);
        assert.equal(images.zoomable, true, "contact details can be opened at full size on phones");
        assert.match(images.diagram, /class="technique-guide"/);
        assert.doesNotMatch(images.diagram, /<svg|pose-view|pose-angles|pose-phase/);
        assert.equal((images.diagram.match(/<dt>/g) ?? []).length, 3);
        assert.ok(images.alt.length > 60, "describe the hand contacts for nonvisual readers");
      }
    }
  });

  it("give the second quarter turn its own phase", () => {
    const rotate = recipe("en").steps[7].images.diagram ?? "";
    assert.equal((rotate.match(/<li>/g) ?? []).length, 4);
    assert.match(rotate, /90° \+ release and regrip \+ 90° = 180°/);
    assert.match(rotate, /set down and release/);
  });

  it("are labelled in Russian on the Russian page", () => {
    const sideLock = recipe("ru").steps[5].images.diagram ?? "";
    assert.match(sideLock, /Подушечка правого большого пальца/);
    assert.doesNotMatch(sideLock, /Support|Contact|Checkpoint|Main view|Inset/);
    assert.equal(recipe("ru").steps[5].images.diagram_title, "Контакты и движение");
    assert.match(recipe("ru").steps[5].images.alt, /указательный поднят/);
  });

  it("distinguish the side lock from the index-only top press", () => {
    const steps = recipe("en").steps;
    assert.match(steps[5].images.diagram, /middle pad opposite, below the fish/);
    assert.match(steps[5].images.diagram, /Index lifted/);
    assert.match(steps[6].images.diagram, /Right index pad alone/);
    assert.match(steps[8].images.diagram, /then stop/);
    assert.match(steps[3].images.diagram, /About 5 mm deep/);
  });

  it("keeps the manual anatomy review matched to every shipped nigiri image", () => {
    // This checks review coverage/freshness; anatomy itself is reviewed visually.
    const review = JSON.parse(fs.readFileSync(path.join(ROOT, "art/nigiri/anatomy-review.json"), "utf8"));
    const reviewed = review.assets.map((a) => a.path).sort();
    for (const lang of ["en", "ru"]) {
      const r = recipe(lang);
      const paths = [r.hero.image, ...r.mise.map((m) => m.image),
        ...r.steps.flatMap(({ images: im }) => [im.photo, im.illustration, im.result, ...im.how.map((h) => h.src)])];
      const shipped = [...new Set(paths.filter(Boolean).map((p) => `public/media/${p.split("?")[0]}`))].sort();
      assert.deepEqual(reviewed, shipped, "new or replaced images need a visual review");
    }
    for (const asset of review.assets) {
      const hash = createHash("sha256").update(fs.readFileSync(path.join(ROOT, asset.path))).digest("hex");
      assert.equal(hash, asset.sha256, `${asset.path} has changed since its anatomy review`);
    }
  });
});
