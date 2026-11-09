"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
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

type Filters = { query: string; selected: string[]; searchOpen: boolean; ingredientsOpen: boolean };

const NO_FILTERS: Filters = { query: "", selected: [], searchOpen: false, ingredientsOpen: false };
const subscribeNothing = () => () => {};

function filtersFromUrl(): Filters {
  const query = readParam("q");
  const selected = readParam("ing").split(",").map((id) => id.trim()).filter(Boolean);
  const open = openSearchPanels(query, selected);
  return { query, selected, searchOpen: open.search, ingredientsOpen: open.ingredients };
}

/** Query, ingredient selection, and which search panel is open. */
export function useRecipeFilters(recipes: FindableRecipe[]) {
  // The static page renders unfiltered; once hydrated, a shared ?q=&ing= link fills the filters. What the reader
  // changes after that wins over the link.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const fromUrl = useMemo(() => (hydrated ? filtersFromUrl() : NO_FILTERS), [hydrated]);
  const [edits, setEdits] = useState<Partial<Filters>>({});
  const query = edits.query ?? fromUrl.query;
  const selected = edits.selected ?? fromUrl.selected;
  const searchOpen = edits.searchOpen ?? fromUrl.searchOpen;
  const ingredientsOpen = edits.ingredientsOpen ?? fromUrl.ingredientsOpen;

  const needle = query.trim();
  const facets = useMemo(() => ingredientFacets(recipes, { query: needle, selected }), [recipes, needle, selected]);
  const visible = recipes.filter(
    (recipe) => (!needle || matchesQuery(needle, recipe.find)) && matchesIngredients(recipe, selected),
  );

  function onQuery(value: string) {
    setEdits((prev) => ({ ...prev, query: value }));
    writeParams(value, selected);
  }

  function onToggle(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setEdits((prev) => ({ ...prev, selected: next }));
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
    toggleSearch: () => setEdits((prev) => ({ ...prev, searchOpen: !searchOpen })),
    toggleIngredients: () => setEdits((prev) => ({ ...prev, ingredientsOpen: !ingredientsOpen })),
  };
}
