import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { groupFacets, ingredientFacets, ingredientName, ingredientSection, matchesIngredients, recipeIngredients } from "../../src/lib/food/ingredients.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

function recipe(find, ...names) {
  return { find, ingredients: recipeIngredients(names) };
}

function load(lang) {
  const dir = path.join(ROOT, "content", lang, "recipes");
  return fs.readdirSync(dir).filter((file) => file.endsWith(".json")).map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const names = (data.ingredients ?? []).flatMap((group) => group.items.map((item) => item.name_html));
    return recipe([data.title, ...names].join(" "), ...names);
  });
}

describe("ingredient bubbles", () => {
  it("drops the cut and the parenthetical from a name", () => {
    const named = ingredientName("Garlic, grated (optional)");
    assert.deepEqual(named, { id: "garlic", label: "Garlic" });
    assert.equal(ingredientName("<a href=\"x\">Soy sauce</a>").id, "soy-sauce");
    assert.equal(ingredientName("  "), null);
  });

  it("counts an ingredient once per recipe and hides pantry staples and one-offs", () => {
    const recipes = [
      recipe("soy ramen", "Soy sauce", "Water", "Garlic, grated"),
      recipe("soy eggs", "Soy sauce", "Garlic"),
      recipe("plain", "Water", "Salt"),
      recipe("rare", "Ikura"),
    ];
    const facets = ingredientFacets(recipes);
    assert.deepEqual(facets.map((facet) => [facet.id, facet.count]), [
      ["garlic", 2],
      ["soy-sauce", 2],
    ]);
    assert.equal(facets.some((facet) => facet.id === "water" || facet.id === "ikura"), false);
  });

  it("narrows the other counts when an ingredient is selected", () => {
    const recipes = [
      recipe("a", "Soy sauce", "Garlic"),
      recipe("b", "Soy sauce", "Ginger"),
      recipe("c", "Soy sauce", "Garlic", "Ginger"),
    ];
    const facets = ingredientFacets(recipes, { selected: ["soy-sauce"] });
    const garlic = facets.find((facet) => facet.id === "garlic");
    const ginger = facets.find((facet) => facet.id === "ginger");
    assert.equal(garlic.count, 2);
    assert.equal(ginger.count, 2);
    assert.equal(facets.find((facet) => facet.id === "soy-sauce").pressed, true);
    const both = ingredientFacets(recipes, { selected: ["soy-sauce", "garlic"] });
    assert.equal(both.find((facet) => facet.id === "ginger").count, 1);
  });

  it("keeps a selected ingredient that only one recipe uses", () => {
    const recipes = [recipe("ikura don", "Ikura", "Soy sauce"), recipe("miso", "Soy sauce")];
    const facets = ingredientFacets(recipes, { selected: ["ikura"] });
    const ikura = facets.find((facet) => facet.id === "ikura");
    assert.equal(ikura.pressed, true);
    assert.equal(ikura.count, 1);
    assert.equal(matchesIngredients(recipes[0], ["ikura", "soy-sauce"]), true);
    assert.equal(matchesIngredients(recipes[1], ["ikura"]), false);
  });

  it("puts proteins, greens and aromatics in their own sections", () => {
    assert.equal(ingredientSection("chicken-thigh"), "proteins");
    assert.equal(ingredientSection("яица"), "proteins");
    assert.equal(ingredientSection("японскии-маионез"), "sauces");
    assert.equal(ingredientSection("green-onions"), "greens");
    assert.equal(ingredientSection("зеленыи-лук"), "greens");
    assert.equal(ingredientSection("garlic"), "aromatics");
    assert.equal(ingredientSection("имбирь"), "aromatics");
    assert.equal(ingredientSection("soy-sauce"), "sauces");
    assert.equal(ingredientSection("рисовыи-уксус"), "sauces");
    assert.equal(ingredientSection("cooked-short-grain-rice"), "rice");
    assert.equal(ingredientSection("neutral-oil"), "pantry");
    const groups = groupFacets([{ id: "garlic" }, { id: "chicken" }, { id: "oil" }]);
    assert.deepEqual(groups.map((group) => group.section), ["proteins", "aromatics", "pantry"]);
  });

  it("lists soy sauce on the real index and leaves water off", () => {
    for (const lang of ["en", "ru"]) {
      const facets = ingredientFacets(load(lang));
      const soy = facets.find((facet) => facet.label.toLowerCase().includes(lang === "en" ? "soy sauce" : "соевый соус"));
      assert.ok(soy && soy.count >= 2, lang);
      assert.equal(facets.some((facet) => facet.id === "water" || facet.id === "вода"), false, lang);
    }
  });
});
