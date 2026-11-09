import type { Lang } from '@/lib/i18n';
import { cookingTablesHtml } from '@/lib/food/table-markup.mjs';
import { Html } from './parts';

/** The recipe's exact HTML/quantity spans remain intact inside keyboard-scrollable table frames. */
export function CookingHtml({ html, lang, className }: { html: string; lang: Lang; className?: string }) {
  return <Html as="div" className={className} html={cookingTablesHtml(html, lang)} />;
}
