"use client";

/** Two buttons that open the text search or the ingredient bubbles. */
export function SearchDisclosure({
  searchLabel,
  ingredientsLabel,
  searchOpen,
  ingredientsOpen,
  queryActive,
  ingredientCount,
  onToggleSearch,
  onToggleIngredients,
}: {
  searchLabel: string;
  ingredientsLabel: string;
  searchOpen: boolean;
  ingredientsOpen: boolean;
  queryActive: boolean;
  ingredientCount: number;
  onToggleSearch: () => void;
  onToggleIngredients: () => void;
}) {
  return (
    <div className="search-disclosure">
      <button
        type="button"
        aria-expanded={searchOpen}
        aria-controls="recipe-search-panel"
        data-active={queryActive || undefined}
        onClick={onToggleSearch}
      >
        {searchLabel}
      </button>
      <button
        type="button"
        aria-expanded={ingredientsOpen}
        aria-controls="ingredient-search-panel"
        data-active={ingredientCount > 0 || undefined}
        onClick={onToggleIngredients}
      >
        {ingredientsLabel}
        {ingredientCount > 0 && <span className="count">{ingredientCount}</span>}
      </button>
    </div>
  );
}
