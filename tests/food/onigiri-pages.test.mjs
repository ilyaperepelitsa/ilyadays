import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const FILLINGS = ["soy-cured-yolk-onigiri", "soboro-onigiri", "pork-kimchi-onigiri",
  "shiso-kombu-onigiri", "takana-onigiri", "peanut-miso-onigiri",
  "eggplant-tsukudani-onigiri", "pepperoncino-onigiri", "mentai-cream-cheese-onigiri"];
const SUPERSEDED = ["salted-salmon-onigiri", "okaka-onigiri", "tuna-mayo-onigiri",
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
        assert.ok(r.ingredients.length >= 2, "each page has filling and shaping ingredients");
        assert.match(r.intro_html, /onigiri\.html/, "each choice links back to the main page");
        assert.equal(r.steps.at(-1).part, lang === "en" ? "Finish" : "Подача");
        for (const { images: im } of r.steps) {
          assert.equal(im.svg_fallback, null, "do not introduce geometric fallback illustrations");
          assert.equal(im.diagram, null);
          assert.equal(im.photo, null);
          for (const src of [im.illustration, im.result, ...im.how.map((h) => h.src)].filter(Boolean)) {
            assert.ok(fs.existsSync(path.join(ROOT, "public/media", src.split("?")[0])), src);
          }
        }
      }
      for (const slug of FILLINGS) {
        const r = read(lang, slug);
        assert.equal(r.steps.length, 3, "one filling, shaping and serving");
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
      assert.equal(group.items.length, 19);
      for (const slug of ["onigiri", ...FILLINGS, ...METHODS, "yaki-onigiri", "onigirazu", "spam-musubi"]) {
        assert.ok(group.items.includes(slug), slug);
        assert.equal(read(lang, slug).group.id, "onigiri");
      }
      assert.ok(!index.recipes.some((r) => r.slug === "onigiri-shop-fillings"));
      assert.ok(!fs.existsSync(path.join(ROOT, "content", lang, "recipes/onigiri-shop-fillings.json")));
      for (const slug of SUPERSEDED) {
        assert.ok(!index.recipes.some((r) => r.slug === slug), "basic replacements must leave the shop section");
        assert.ok(!fs.existsSync(path.join(ROOT, "content", lang, "recipes", `${slug}.json`)));
      }
      for (const entry of index.recipes.filter((r) => r.kind === "recipe")) {
        assert.ok(!JSON.stringify(read(lang, entry.slug)).includes("onigiri-shop-fillings"));
      }
    }
  });

  it("shows a reviewed, distinct filling cutaway in each filling recipe and its finishing step", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "art/onigiri/shop-cutaway-prompts.json"), "utf8"));
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
      assert.equal(images.size, 9, "every original shop recipe needs its own image");
    }
  });

  it("preserves all nine original shop ingredient lists, cooking times and source links", () => {
    const original = JSON.parse(fs.readFileSync(path.join(ROOT, "art/onigiri/shop-recipes-source.json"), "utf8"));
    const plain = (s) => s.replace(/<[^>]+>/g, "");
    assert.equal(original.recipes.length, 9);
    assert.deepEqual(original.recipes.map((r) => r.slug), FILLINGS);
    for (const entry of original.recipes) {
      const r = read("en", entry.slug);
      assert.equal(r.ingredients[0].name, entry.original_group);
      assert.deepEqual(r.ingredients[0].items.map((i) => [plain(i.name_html), plain(i.amount_html)]), entry.ingredients);
      assert.equal(r.steps[0].time, entry.original_time);
      for (const paragraph of entry.original_body) {
        const preserved = entry.slug === "shiso-kombu-onigiri"
          ? paragraph.replace(" It keeps a week in the fridge.", "") : paragraph;
        assert.ok(plain(r.steps[0].body_html).includes(plain(preserved)), `${entry.slug}: original preparation instruction`);
      }
      assert.deepEqual(r.sources.map((s) => [s.label, s.url]), original.original_sources);
      assert.match(r.intro_html, /shops do not publish their recipes/);
    }
    const main = JSON.stringify(read("en", "onigiri"));
    for (const retained of ["sujiko", "negitoro", "tarako", "kazunoko", "ami tsukudani", "Fuki miso"]) {
      assert.ok(main.includes(retained), retained);
    }
    assert.match(JSON.stringify(read("en", "eggplant-tsukudani-onigiri")), /Marizuke/);
    assert.match(read("en", "soboro-onigiri").steps[0].body_html, /soy-cured-yolk-onigiri/);
    assert.match(JSON.stringify(read("en", "mentai-cream-cheese-onigiri")), /takana-onigiri/);
  });

  it("keeps mixed rice distinct from pocket fillings and doses the extra oil", () => {
    for (const slug of ["eggplant-tsukudani-onigiri", "pepperoncino-onigiri"]) {
      const r = read("en", slug);
      assert.match(r.steps[1].body_html, /no separate filling pocket/);
      assert.doesNotMatch(r.steps[1].body_html, /make a well|heaped tablespoon/);
      assert.doesNotMatch(r.steps[2].body_html, /same filling on top/);
    }
    assert.match(read("en", "pepperoncino-onigiri").steps[1].body_html, /makes more than you need/);
    assert.equal(read("en", "soy-cured-yolk-onigiri").yields, "4 onigiri");
    for (const slug of ["onigiri", ...METHODS]) {
      assert.match(read("en", slug).steps.find((s) => s.body_html.includes("skip the separate filling"))?.body_html ?? "", /eggplant or pepperoncino/);
    }
  });
});
