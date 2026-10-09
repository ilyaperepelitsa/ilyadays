/**
 * Which recipe-index panels start open.
 *
 * A plain visit stays collapsed. A shared link with `?q=` or `?ing=` opens
 * the panel that filter belongs to.
 *
 * @example
 * openSearchPanels("ikura", ["soy-sauce"]);
 * // { search: true, ingredients: true }
 */

/**
 * @param {string} query
 * @param {string[]} selected
 * @returns {{ search: boolean, ingredients: boolean }}
 */
export function openSearchPanels(query, selected) {
  if (typeof query !== "string" || !Array.isArray(selected)) {
    throw new TypeError("openSearchPanels expects a query string and a list of ingredient ids");
  }
  return { search: query.trim().length > 0, ingredients: selected.length > 0 };
}
