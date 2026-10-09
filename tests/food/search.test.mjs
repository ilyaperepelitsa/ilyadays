import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { matchesQuery, oneEditApart } from "../../src/lib/food/search.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

function haystack(slug) {
  const recipe = JSON.parse(fs.readFileSync(path.join(ROOT, "content/en/recipes", `${slug}.json`), "utf8"));
  const names = recipe.ingredients.flatMap((group) => group.items.map((item) => item.name_html)).join(" ");
  return `${recipe.title} ${recipe.blurb_html} ${names}`;
}

describe("recipe search", () => {
  it("treats bok choi and bok choy as the same ingredient", () => {
    const noodles = haystack("garlic-ginger-chicken-noodles");
    const seeEw = haystack("chicken-pad-see-ew");
    for (const query of ["bok choy", "bok choi", "bokchoy"]) {
      assert.equal(matchesQuery(query, noodles), true, query);
      assert.equal(matchesQuery(query, seeEw), true, query);
    }
    assert.equal(matchesQuery("чеддер", haystack("grilled-cheese")), false);
  });

  it("matches cheddar in the cheese recipes and ignores a near miss", () => {
    assert.equal(matchesQuery("cheddar", haystack("mac-and-cheese")), true);
    assert.equal(matchesQuery("cheddar", haystack("grilled-cheese")), true);
    assert.equal(matchesQuery("soy", "sorry, no soy sauce here".replace("soy sauce", "sauce")), false);
    assert.equal(matchesQuery("soy", "soy sauce"), true);
    assert.equal(oneEditApart("choi", "choy"), true);
    assert.equal(oneEditApart("soy", "sorry"), false);
  });

  it("matches the Russian name", () => {
    const recipe = JSON.parse(fs.readFileSync(path.join(ROOT, "content/ru/recipes/garlic-ginger-chicken-noodles.json"), "utf8"));
    const names = recipe.ingredients.flatMap((group) => group.items.map((item) => item.name_html)).join(" ");
    assert.equal(matchesQuery("бок чой", `${recipe.title} ${names}`), true);
    assert.equal(matchesQuery("бок-чой", `${recipe.title} ${names}`), true);
  });
});
