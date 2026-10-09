"use client";

import { useEffect, useMemo, useState } from "react";
import type { FindableRecipe } from "@/lib/food/find-text";
import { ingredientFacets, matchesIngredients } from "@/lib/food/ingredients.mjs";
import { matchesQuery } from "@/lib/food/search.mjs";
import { openSearchPanels } from "@/lib/food/search-panels.mjs";

function readParam(name: string) {
  return new URLSearchParams(location.search).get(name) ?? "";
}

function writeParams(query: string, selected: string[]) {
  const url = new URL(location.href);
  if (query.trim()) url.searchParams.set("q", query.trim());
  else url.searchParams.delete("q");
  if (selected.length) url.searchParams.set("ing", selected.join(","));
  else url.searchParams.delete("ing");
  history.replaceState(null, "", `${url.pathname}${url.search}`);
}

/** Query, ingredient selection, and which search panel is open. */
export function useRecipeFilters(recipes: FindableRecipe[]) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);

  useEffect(() => {
    const nextQuery = readParam("q");
    const nextSelected = readParam("ing").split(",").map((id) => id.trim()).filter(Boolean);
    const open = openSearchPanels(nextQuery, nextSelected);
    setQuery(nextQuery);
    setSelected(nextSelected);
    setSearchOpen(open.search);
    setIngredientsOpen(open.ingredients);
  }, []);

  const needle = query.trim();
  const facets = useMemo(() => ingredientFacets(recipes, { query: needle, selected }), [recipes, needle, selected]);
  const visible = recipes.filter(
    (recipe) => (!needle || matchesQuery(needle, recipe.find)) && matchesIngredients(recipe, selected),
  );

  function onQuery(value: string) {
    setQuery(value);
    writeParams(value, selected);
  }

  function onToggle(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    writeParams(query, next);
  }

  return {
    query,
    needle,
    selected,
    facets,
    visible,
    filtering: Boolean(needle || selected.length),
    searchOpen,
    ingredientsOpen,
    onQuery,
    onToggle,
    toggleSearch: () => setSearchOpen((open) => !open),
    toggleIngredients: () => setIngredientsOpen((open) => !open),
  };
}
