import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

/**
 * Every nigiri ingredient must be named on a mise card, in both languages.
 *
 * @param {string} lang
 * @returns {{ ingredients: { items: { name_html: string }[] }[], mise: { name: string, items_html: string }[] }}
 */
function recipe(lang) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "content", lang, "recipes/nigiri.json"), "utf8"));
}

describe("nigiri mise lists every ingredient", () => {
  it("names each English ingredient on a card", () => {
    const data = recipe("en");
    const listed = data.mise.map((card) => `${card.name} ${card.items_html}`).join(" ");
    for (const name of ["Sushi rice", "tuna or salmon", "Wasabi", "Water (tezu)", "Rice vinegar (tezu)", "Soy sauce", "Pickled ginger (gari)"]) {
      assert.equal(listed.includes(name), true, name);
    }
  });

  it("names each Russian ingredient on a card", () => {
    const data = recipe("ru");
    const listed = data.mise.map((card) => `${card.name} ${card.items_html}`).join(" ");
    for (const name of ["Рис для суши", "Тунец или лосось", "Васаби", "Вода (тэдзу)", "Рисовый уксус (тэдзу)", "Соевый соус", "Маринованный имбирь (гари)"]) {
      assert.equal(listed.includes(name), true, name);
    }
  });
});
