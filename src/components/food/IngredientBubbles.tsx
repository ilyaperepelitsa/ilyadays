"use client";

import { groupFacets } from "@/lib/food/ingredients.mjs";

type Facet = { id: string; label: string; count: number; pressed: boolean };

const SECTION_LABEL = {
  proteins: "sectionProteins",
  greens: "sectionGreens",
  vegetables: "sectionVegetables",
  aromatics: "sectionAromatics",
  sauces: "sectionSauces",
  rice: "sectionRice",
  pantry: "sectionPantry",
} as const;

/** Wrapped bubbles, one row of sections: proteins, greens, aromatics, and the rest. */
export function IngredientBubbles({
  labels,
  facets,
  onToggle,
}: {
  labels: Record<(typeof SECTION_LABEL)[keyof typeof SECTION_LABEL], string>;
  facets: Facet[];
  onToggle: (id: string) => void;
}) {
  const groups = groupFacets(facets);
  if (!groups.length) return null;
  return (
    <div className="ingredient-filters">
      {groups.map((group) => {
        const title = labels[SECTION_LABEL[group.section as keyof typeof SECTION_LABEL]];
        const headingId = `ingredient-${group.section}`;
        return (
          <section key={group.section} className="ingredient-section" aria-labelledby={headingId}>
            <h3 id={headingId}>{title}</h3>
            <div className="ingredient-bubbles" role="group" aria-labelledby={headingId}>
              {group.facets.map((facet: Facet) => (
                <button key={facet.id} type="button" aria-pressed={facet.pressed} onClick={() => onToggle(facet.id)}>
                  {facet.label}
                  <span className="count">{facet.count}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
