export const ONIGIRI_FILLINGS = [
  'soy-cured-yolk-onigiri', 'soboro-onigiri', 'pork-kimchi-onigiri',
  'shiso-kombu-onigiri', 'takana-onigiri', 'peanut-miso-onigiri',
  'eggplant-tsukudani-onigiri', 'pepperoncino-onigiri', 'mentai-cream-cheese-onigiri',
];
export const ONIGIRI_METHODS = ['onigiri-mold', 'onigiri-plastic-wrap'];

/** The underlying recipe data remains available to the combined pages. */
export function integratedDestination(slug) {
  if (ONIGIRI_FILLINGS.includes(slug)) return `/onigiri?filling=${slug}`;
  if (ONIGIRI_METHODS.includes(slug)) return `/onigiri?method=${slug}`;
  if (slug === 'sous-vide-salmon') return '/sous-vide?food=salmon';
  return null;
}

/** @template {{recipes:{slug:string}[],groups:{items:string[]}[],recent:string[]}} T @param {T} index @returns {T} */
export function consolidatedIndex(index) {
  const keep=slug=>!integratedDestination(slug);
  return {...index,recipes:index.recipes.filter(r=>keep(r.slug)),
    groups:index.groups.map(g=>({...g,items:g.items.filter(keep)})),recent:index.recent.filter(keep)};
}
