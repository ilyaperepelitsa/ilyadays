"use client";

import { useEffect, useMemo, useState } from "react";
import type { FoodIndex, Note } from "@/lib/content";
import { ingredientFacets, matchesIngredients } from "@/lib/food/ingredients.mjs";
import { matchesQuery } from "@/lib/food/search.mjs";
import type { FindableRecipe } from "@/lib/food/find-text";
import { type Lang, strings } from "@/lib/i18n";
import { Card } from "./Card";
import { IngredientBubbles } from "./IngredientBubbles";
import { Html } from "./parts";

function fill(template: string, n: number) {
  return template.replace("{n}", String(n));
}

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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setQuery(readParam("q"));
    setSelected(readParam("ing").split(",").map((id) => id.trim()).filter(Boolean));
  }, []);

  const needle = query.trim();
  const facets = useMemo(() => ingredientFacets(recipes, { query: needle, selected }), [recipes, needle, selected]);
  const visible = recipes.filter(
    (recipe) => (!needle || matchesQuery(needle, recipe.find)) && matchesIngredients(recipe, selected),
  );
  const filtering = Boolean(needle || selected.length);

  function onQuery(value: string) {
    setQuery(value);
    writeParams(value, selected);
  }

  function onToggle(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    writeParams(query, next);
  }

  return (
    <>
      <label className="recipe-search">
        <span>{t.searchLabel}</span>
        <input
          type="search"
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(event) => onQuery(event.target.value)}
          enterKeyHint="search"
        />
      </label>
      <IngredientBubbles label={t.ingredientFilters} facets={facets} onToggle={onToggle} />
      <FilteredIndex
        lang={lang}
        recipes={filtering ? visible : recipes}
        groups={groups}
        recent={recent}
        badges={badges}
        flat={Boolean(needle)}
        empty={filtering && !visible.length ? t.searchEmpty : ""}
        countLabel={needle && visible.length ? fill(t.searchCount, visible.length) : ""}
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
