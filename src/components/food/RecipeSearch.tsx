"use client";

import type { FoodIndex, Note } from "@/lib/content";
import type { FindableRecipe } from "@/lib/food/find-text";
import { type Lang, strings } from "@/lib/i18n";
import { Card } from "./Card";
import { IngredientBubbles } from "./IngredientBubbles";
import { Html } from "./parts";
import { SearchDisclosure } from "./SearchDisclosure";
import { useRecipeFilters } from "./useRecipeFilters";

function fill(template: string, n: number) {
  return template.replace("{n}", String(n));
}

/** Search box plus ingredient bubbles. Either one narrows the index underneath. */
export function RecipeSearch({
  lang,
  recipes,
  groups,
  recent,
  badges,
}: {
  lang: Lang;
  recipes: FindableRecipe[];
  groups: FoodIndex["groups"];
  recent: string[];
  badges: Record<string, string>;
}) {
  const t = strings(lang);
  const filters = useRecipeFilters(recipes);

  return (
    <>
      <div className="search-tools">
        <SearchDisclosure
          searchLabel={t.searchLabel}
          ingredientsLabel={t.ingredientSearch}
          searchOpen={filters.searchOpen}
          ingredientsOpen={filters.ingredientsOpen}
          queryActive={Boolean(filters.needle)}
          ingredientCount={filters.selected.length}
          onToggleSearch={filters.toggleSearch}
          onToggleIngredients={filters.toggleIngredients}
        />
        {filters.searchOpen && (
          <label className="recipe-search" id="recipe-search-panel">
            <span className="sr-only">{t.searchLabel}</span>
            <input
              type="search"
              value={filters.query}
              placeholder={t.searchPlaceholder}
              onChange={(event) => filters.onQuery(event.target.value)}
              enterKeyHint="search"
            />
          </label>
        )}
        {filters.ingredientsOpen && (
          <div id="ingredient-search-panel">
            <IngredientBubbles labels={t} facets={filters.facets} onToggle={filters.onToggle} />
          </div>
        )}
      </div>
      <FilteredIndex
        lang={lang}
        recipes={filters.filtering ? filters.visible : recipes}
        groups={groups}
        recent={recent}
        badges={badges}
        flat={Boolean(filters.needle)}
        empty={filters.filtering && !filters.visible.length ? t.searchEmpty : ""}
        countLabel={filters.needle && filters.visible.length ? fill(t.searchCount, filters.visible.length) : ""}
      />
    </>
  );
}

function FilteredIndex({
  lang,
  recipes,
  groups,
  recent,
  badges,
  flat,
  empty,
  countLabel,
}: {
  lang: Lang;
  recipes: FindableRecipe[];
  groups: FoodIndex["groups"];
  recent: string[];
  badges: Record<string, string>;
  flat: boolean;
  empty: string;
  countLabel: string;
}) {
  const t = strings(lang);
  const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));
  if (empty) {
    return (
      <section className="group" aria-live="polite">
        <h2>{empty}</h2>
      </section>
    );
  }
  if (flat) {
    return (
      <section className="group" aria-live="polite">
        <h2>{countLabel}</h2>
        <div className="cards">
          {recipes.map((recipe) => (
            <Card key={recipe.slug} lang={lang} r={recipe} />
          ))}
        </div>
      </section>
    );
  }
  const recentCards = recent.map((slug) => bySlug.get(slug)).filter((recipe) => !!recipe);
  return (
    <>
      {recentCards.length > 0 && (
        <section className="recent group" aria-labelledby="recent-title">
          <div className="recent-head">
            <h2 id="recent-title">{t.recentTitle}</h2>
          </div>
          <div className="cards">
            {recentCards.map((recipe) => (
              <Card key={recipe.slug} lang={lang} r={recipe} badge={badges[recipe.slug] || undefined} />
            ))}
          </div>
        </section>
      )}
      {groups.map((group) => (
        <Group key={group.id} lang={lang} group={group} bySlug={bySlug} />
      ))}
    </>
  );
}

function Group({
  lang,
  group,
  bySlug,
}: {
  lang: Lang;
  group: FoodIndex["groups"][number];
  bySlug: Map<string, FindableRecipe>;
}) {
  const items = group.items.map((slug) => bySlug.get(slug)).filter((recipe) => !!recipe);
  if (!items.length) return null;
  return (
    <section className="group" id={group.id}>
      <h2>{group.name}</h2>
      <div className="cards">
        {items.map((recipe) => (
          <Card key={recipe.slug} lang={lang} r={recipe} />
        ))}
      </div>
      {group.notes.length > 0 && <GroupNotes notes={group.notes} />}
    </section>
  );
}

function GroupNotes({ notes }: { notes: Note[] }) {
  return (
    <div className="group-notes">
      {notes.map((note, i) => (
        <aside className="note" key={i}>
          <Html as="h3" html={note.title_html} />
          <Html as="div" html={note.html} />
        </aside>
      ))}
    </div>
  );
}
