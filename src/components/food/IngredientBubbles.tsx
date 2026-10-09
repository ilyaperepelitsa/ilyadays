"use client";

type Facet = { id: string; label: string; count: number; pressed: boolean };

/** One bubble per ingredient. The number is how many recipes on the page use it. */
export function IngredientBubbles({
  label,
  facets,
  onToggle,
}: {
  label: string;
  facets: Facet[];
  onToggle: (id: string) => void;
}) {
  if (!facets.length) return null;
  return (
    <div className="ingredient-filters">
      <span id="ingredient-filters">{label}</span>
      <div className="ingredient-bubbles" role="group" aria-labelledby="ingredient-filters">
        {facets.map((facet) => (
          <button
            key={facet.id}
            type="button"
            aria-pressed={facet.pressed}
            onClick={() => onToggle(facet.id)}
          >
            {facet.label}
            <span className="count">{facet.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
