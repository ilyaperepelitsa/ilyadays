import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const FILLINGS = ["salted-salmon-onigiri", "okaka-onigiri", "tuna-mayo-onigiri",
  "umeboshi-onigiri", "spicy-tuna-mayo-onigiri", "kimchi-cheese-onigiri"];
const METHODS = ["onigiri-mold", "onigiri-plastic-wrap"];
const read = (lang, slug) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", lang, "recipes", `${slug}.json`), "utf8"));

describe("standalone onigiri recipes", () => {
  it("publishes each choice in both languages and links every choice from the hand-shaping page", () => {
    for (const lang of ["en", "ru"]) {
      const main = read(lang, "onigiri");
      assert.equal(main.steps.length, 5, "the main page contains only rice, hand shaping and serving");
      for (const slug of [...FILLINGS, ...METHODS]) {
        const r = read(lang, slug);
        assert.equal(r.slug, slug);
        assert.ok(main.siblings.some((s) => s.slug === slug), "choice navigation needs every destination");
        assert.ok(r.ingredients.length >= 3, "each page has its own ingredient list");
        assert.match(r.intro_html, /onigiri\.html/, "each choice links back to the main page");
        assert.equal(r.steps.at(-1).part, lang === "en" ? "Finish" : "Подача");
        for (const { images: im } of r.steps) {
          assert.equal(im.svg_fallback, null, "do not introduce geometric fallback illustrations");
          for (const src of [im.illustration, im.result, ...im.how.map((h) => h.src)].filter(Boolean)) {
            assert.ok(fs.existsSync(path.join(ROOT, "public/media", src.split("?")[0])), src);
          }
        }
      }
      for (const slug of FILLINGS) {
        const r = read(lang, slug);
        assert.equal(r.steps.length, 6);
        assert.equal(r.steps.filter((s) => s.part === (lang === "en" ? "Filling" : "Начинка")).length, 1);
      }
    }
  });

  it("keeps alternative methods separate and removes the bare-hand picture from wrap preparation", () => {
    for (const lang of ["en", "ru"]) {
      const mold = read(lang, "onigiri-mold");
      const wrap = read(lang, "onigiri-plastic-wrap");
      assert.equal(mold.steps.length, 4);
      assert.equal(wrap.steps.length, 4);
      const im = wrap.steps[1].images;
      assert.equal(im.illustration, null);
      assert.deepEqual(im.how, []);
      assert.equal(im.result, null);
      assert.doesNotMatch(mold.steps.map((s) => s.title).join(" "), /plastic wrap|плёнку/i);
      assert.doesNotMatch(wrap.steps.map((s) => s.title).join(" "), /mold|(?:^|\s)форму(?:\s|$)/i);
    }
  });

  it("gives onigiri its own section and retires the combined shop-fillings page", () => {
    for (const lang of ["en", "ru"]) {
      const index = JSON.parse(fs.readFileSync(path.join(ROOT, "content", lang, "index.json"), "utf8"));
      const group = index.groups.find((g) => g.id === "onigiri");
      assert.equal(group.name, lang === "en" ? "Onigiri" : "Онигири");
      assert.equal(group.items.length, 16);
      for (const slug of ["onigiri", ...FILLINGS, ...METHODS, "yaki-onigiri", "onigirazu", "spam-musubi"]) {
        assert.ok(group.items.includes(slug), slug);
        assert.equal(read(lang, slug).group.id, "onigiri");
      }
      assert.ok(!index.recipes.some((r) => r.slug === "onigiri-shop-fillings"));
      assert.ok(!fs.existsSync(path.join(ROOT, "content", lang, "recipes/onigiri-shop-fillings.json")));
      for (const entry of index.recipes.filter((r) => r.kind === "recipe")) {
        assert.ok(!JSON.stringify(read(lang, entry.slug)).includes("onigiri-shop-fillings"));
      }
    }
  });

  it("shows a reviewed, distinct filling cutaway in each filling recipe and its finishing step", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "art/onigiri/cutaway-prompts.json"), "utf8"));
    for (const lang of ["en", "ru"]) {
      const images = new Set();
      for (const slug of FILLINGS) {
        const r = read(lang, slug);
        const im = r.steps.at(-1).images;
        assert.equal(r.hero.image, im.illustration);
        images.add(r.hero.image);
        const record = manifest.assets.find((a) => a.slug === slug);
        assert.ok(record?.reviewed, slug);
        assert.equal(record.published_path, `public/media/${r.hero.image.split("?")[0]}`);
        assert.equal(record.sha256, createHash("sha256").update(fs.readFileSync(path.join(ROOT, record.published_path))).digest("hex"));
      }
      assert.equal(images.size, 6, "every recipe needs its own filling image");
    }
  });
});
