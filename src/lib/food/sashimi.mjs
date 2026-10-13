/** Shared URL and cooking-session identity for the single sashimi page. */
export const SASHIMI_SPECIES = ['tuna','salmon','scallops','sea-bass','dorada','mackerel','bonito','squid','shrimp'];

export function sashimiSelection(value) {
  return SASHIMI_SPECIES.includes(value) ? value : 'tuna';
}
