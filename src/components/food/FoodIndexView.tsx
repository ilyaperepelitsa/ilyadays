import type { FoodIndex } from "@/lib/content";
import { getSvgDefs } from "@/lib/content";
import { findableRecipes } from "@/lib/food/find-text";
import type { Lang } from "@/lib/i18n";
import { Html, SvgDefs } from "./parts";
import { addedLabel } from "./RecentlyAdded";
import { RecipeSearch } from "./RecipeSearch";

export function FoodIndexView({ lang, index }: { lang: Lang; index: FoodIndex }) {
  const bySlug = new Map(index.recipes.map((recipe) => [recipe.slug, recipe]));
  const badges = Object.fromEntries(
    index.recent.map((slug) => {
      const added = bySlug.get(slug)?.added;
      return [slug, added ? addedLabel(lang, added) : ""];
    }),
  );
  const hasSvg = index.recipes.some((recipe) => !recipe.hero.image && recipe.hero.svg_fallback);
  return (
    <>
      {hasSvg && <SvgDefs svg={getSvgDefs()} />}
      <div className="intro">
        <h1>{index.title}</h1>
        <Html as="p" className="lede" html={index.lede_html} />
      </div>
      <RecipeSearch lang={lang} recipes={findableRecipes(lang, index)} groups={index.groups} recent={index.recent} badges={badges} />
    </>
  );
}
