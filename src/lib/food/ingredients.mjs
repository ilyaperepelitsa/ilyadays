/** Ingredient bubbles for the recipe index. Water, salt and sugar are left off. */

import { matchesQuery, normalize, stripHtml } from "./search.mjs";

const PANTRY = new Set([
  "water",
  "cold-water",
  "salt",
  "sugar",
  "вода",
  "холодная-вода",
  "соль",
  "крупная-соль",
  "сахар",
]);

/**
 * Short name and id for one ingredient line. The part after a comma is a cut, not a new ingredient.
 *
 * @param {string} nameHtml
 * @returns {{ id: string, label: string } | null}
 */
export function ingredientName(nameHtml) {
  const plain = stripHtml(nameHtml).replace(/\([^)]*\)/g, " ").split(",")[0].replace(/\s+/g, " ").trim();
  const id = normalize(plain).replace(/ /g, "-");
  if (!plain || !id) return null;
  return { id, label: plain };
}

/**
 * One entry per ingredient id on a recipe.
 *
 * @param {string[]} nameHtmls
 * @returns {{ id: string, label: string }[]}
 */
export function recipeIngredients(nameHtmls) {
  const byId = new Map();
  for (const html of nameHtmls) {
    const item = ingredientName(html);
    if (!item || byId.has(item.id)) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

/**
 * @param {{ ingredients: { id: string }[] }} recipe
 * @param {string} id
 * @returns {boolean}
 */
function hasIngredient(recipe, id) {
  return recipe.ingredients.some((item) => item.id === id);
}

/**
 * @param {Map<string, number>} votes
 * @returns {string}
 */
function bestLabel(votes) {
  return [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0][0];
}

/**
 * @param {{ ingredients: { id: string, label: string }[] }[]} recipes
 * @returns {Map<string, { id: string, global: number, votes: Map<string, number> }>}
 */
function catalog(recipes) {
  const rows = new Map();
  for (const recipe of recipes) {
    for (const item of recipe.ingredients) {
      if (PANTRY.has(item.id)) continue;
      const row = rows.get(item.id) ?? { id: item.id, global: 0, votes: new Map() };
      row.global += 1;
      row.votes.set(item.label, (row.votes.get(item.label) ?? 0) + 1);
      rows.set(item.id, row);
    }
  }
  return rows;
}

/**
 * Bubbles for ingredients used in at least two recipes. The count is how many of the
 * current search and the other selected ingredients also use this one.
 *
 * @param {{ find: string, ingredients: { id: string, label: string }[] }[]} recipes
 * @param {{ query?: string, selected?: string[] }} [options]
 * @returns {{ id: string, label: string, count: number, pressed: boolean }[]}
 */
export function ingredientFacets(recipes, options = {}) {
  const query = options.query ?? "";
  const chosen = new Set(options.selected ?? []);
  const rows = catalog(recipes);
  for (const id of chosen) {
    if (!rows.has(id)) rows.set(id, { id, global: 0, votes: new Map([[id, 1]]) });
  }
  const facets = [];
  for (const row of rows.values()) {
    if (row.global < 2 && !chosen.has(row.id)) continue;
    const count = countWith(recipes, query, chosen, row.id);
    if (count === 0 && !chosen.has(row.id)) continue;
    facets.push({
      id: row.id,
      label: bestLabel(row.votes),
      count,
      pressed: chosen.has(row.id),
      global: row.global,
    });
  }
  facets.sort((a, b) => b.global - a.global || a.label.localeCompare(b.label));
  return facets.map(({ global, ...facet }) => facet);
}

/**
 * @param {{ find: string, ingredients: { id: string }[] }[]} recipes
 * @param {string} query
 * @param {Set<string>} chosen
 * @param {string} id
 * @returns {number}
 */
function countWith(recipes, query, chosen, id) {
  const others = [...chosen].filter((selected) => selected !== id);
  return recipes.filter(
    (recipe) =>
      matchesQuery(query, recipe.find) && others.every((selected) => hasIngredient(recipe, selected)) && hasIngredient(recipe, id),
  ).length;
}

/**
 * A recipe stays when it contains every selected ingredient.
 *
 * @param {{ ingredients: { id: string }[] }} recipe
 * @param {string[]} selected
 * @returns {boolean}
 */
export function matchesIngredients(recipe, selected) {
  return selected.every((id) => hasIngredient(recipe, id));
}
