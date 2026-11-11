import { integratedDestination } from './integrated-recipes.mjs';

/** Legacy export dates have no zone; interpret them consistently as UTC. */
function publishedAt(value) {
  if (!value) return 0;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}:00Z` : value;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid recipe publication date: ${value}`);
  return timestamp;
}

/** Build the server catalog from recipe records, retaining editorial group order and reference pages.
 * @param {import('../content').FoodIndex} index
 * @param {import('../content').Recipe[]} records
 * @returns {import('../content').FoodIndex}
 */
export function recipeCatalog(index, records) {
  const old = new Map(index.recipes.map(recipe => [recipe.slug, recipe]));
  const discovered = new Map(records.map(recipe => [recipe.slug, {
    slug: recipe.slug, kind: 'recipe', title: recipe.title,
    group: recipe.group.name, group_id: recipe.group.id,
    blurb_html: recipe.blurb_html, description: recipe.description,
    yields: recipe.yields, total: recipe.total, chips: recipe.chips,
    hero: recipe.hero, share_image: recipe.share_image,
    added: recipe.added ?? old.get(recipe.slug)?.added ?? null,
  }]));
  // Preserve the existing reading order; files absent from the export index still appear.
  const recipes = index.recipes.flatMap(recipe => {
    const record = discovered.get(recipe.slug);
    discovered.delete(recipe.slug);
    return record ? [record] : recipe.kind === 'reference' ? [recipe] : [];
  }).concat([...discovered.values()]);
  const groups = index.groups.map(group => ({ ...group, items: [] }));
  for (const recipe of recipes) {
    let group = groups.find(group => group.id === recipe.group_id);
    if (!group) {
      group = { id: recipe.group_id, name: recipe.group, items: [], notes: [] };
      groups.push(group);
    }
    group.items.push(recipe.slug);
  }
  const recent = recipes
    .filter(recipe => recipe.added && !integratedDestination(recipe.slug))
    .map(recipe => ({ slug: recipe.slug, at: publishedAt(recipe.added) }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 12).map(recipe => recipe.slug);
  return { ...index, recipes, groups, recent };
}
