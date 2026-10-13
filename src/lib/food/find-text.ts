import { getRecipe, getSashimi, type FoodIndex, type RecipeSummary } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { recipeIngredients } from "./ingredients.mjs";
import { stripHtml } from "./search.mjs";
import { ONIGIRI_RECIPES } from "./integrated-recipes.mjs";

export type IngredientRef = { id: string; label: string };
export type FindableRecipe = RecipeSummary & { find: string; ingredients: IngredientRef[] };

type Named = { ingredients?: { items?: { name_html?: string }[] }[] };

function ingredientHtml(full: Named | null): string[] {
  return (full?.ingredients ?? []).flatMap((group) => group.items ?? []).map((item) => item.name_html ?? "");
}

/** Ingredient names plus the title and blurb, as plain text the search box matches. */
export function findText(recipe: RecipeSummary, full: Named | null): string {
  const names = (full?.ingredients ?? [])
    .flatMap((group) => group.items ?? [])
    .map((item) => stripHtml(item.name_html ?? ""));
  return [recipe.title, stripHtml(recipe.blurb_html), recipe.group, ...names].join(" ");
}

/** Index cards with the text a search walks. Full recipes are read once and cached. */
export function findableRecipes(lang: Lang, index: FoodIndex): FindableRecipe[] {
  return index.recipes.map((recipe) => {
    const full = recipe.kind === "recipe" ? getRecipe(lang, recipe.slug) : null;
    const choices=recipe.slug==='onigiri'?ONIGIRI_RECIPES.map(slug=>getRecipe(lang,slug)):recipe.slug==='yacht-sashimi'?getSashimi(lang):[];
    const combined=choices.length?{ingredients:[...(full?.ingredients??[]),...choices.flatMap(f=>f?.ingredients??[])]}:full;
    return { ...recipe, find: [findText(recipe, combined),...choices.map(f=>f?.title??'')].join(' '), ingredients: recipeIngredients(ingredientHtml(combined)) };
  });
}
