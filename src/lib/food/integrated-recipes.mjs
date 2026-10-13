export const ONIGIRI_FILLINGS = [
  'soy-cured-yolk-onigiri', 'soboro-onigiri', 'pork-kimchi-onigiri',
  'shiso-kombu-onigiri', 'takana-onigiri', 'peanut-miso-onigiri',
  'eggplant-tsukudani-onigiri', 'pepperoncino-onigiri', 'mentai-cream-cheese-onigiri',
];
export const ONIGIRI_METHODS = ['onigiri-mold', 'onigiri-plastic-wrap'];
export const ONIGIRI_SPECIALS = ['yaki-onigiri','nikumaki-onigiri','shrimp-karaage-onigiri','salmon-onigiri','baby-octopus-onigiri','onigirazu','spam-musubi'];
export const ONIGIRI_RECIPES = [...ONIGIRI_FILLINGS,...ONIGIRI_SPECIALS];
export const ONIGIRI_WRAPPINGS = ['strip','full','none'];
export const FIXED_ONIGIRI_FORMATS = ['nikumaki-onigiri','onigirazu','spam-musubi'];

export function onigiriSelection(filling, method, wrapping) {
  const recipe=ONIGIRI_RECIPES.includes(filling)?filling:ONIGIRI_RECIPES[0];
  if (FIXED_ONIGIRI_FORMATS.includes(recipe)) return {recipe,method:'recipe',wrapping:recipe==='nikumaki-onigiri'?'pork':recipe==='onigirazu'?'sandwich':'band'};
  return {recipe,method:['onigiri',...ONIGIRI_METHODS].includes(method)?method:'onigiri',wrapping:ONIGIRI_WRAPPINGS.includes(wrapping)?wrapping:recipe==='yaki-onigiri'?'none':'strip'};
}

/** The underlying recipe data remains available to the combined pages. */
export function integratedDestination(slug) {
  if (ONIGIRI_RECIPES.includes(slug)) return `/onigiri?filling=${slug}`;
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
