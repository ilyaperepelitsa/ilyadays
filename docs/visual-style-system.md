# Site visual system

The screen theme uses cool mineral surfaces, graphite actions, a restrained persimmon accent and Manrope variable type. The homepage has a dark typographic masthead; food, travel and fitness share the same navigation, form geometry, panels and light/dark tokens. Existing illustrations remain part of the site. Print retains the authored recipe styles.

`src/styles/theme.css` is the site-owned visual layer after domain styles. Keep shared colors, typography and action states there; domain layout stays in its existing stylesheet. `src/styles/cooking-tables.css` follows it. Avoid blanket resets that break recipes or the embedded travel guide.

Manrope (weights 200–800, Latin and Cyrillic) is served from `public/fonts/manrope/manrope-variable.woff2`, preloaded in RootShell and included in the offline asset catalog. The official google/fonts source and SIL Open Font License accompany the font. It makes no browser requests to Google Fonts. Root theme-color metadata and the PWA manifest use the new light background.

## Cooking references

Recipe comparison tables use bordered scroll regions, pinned identifying columns on wide tables, tabular right-aligned numbers, neutral headers and quiet alternating rows. A localized scroll hint appears on narrow screens. Two-column references stay fluid. `cookingTablesHtml` decorates trusted authored recipe HTML without rewriting cell contents or the quantity/scaling attributes.

Sous-vide references default to native tables at every width, with sticky headers and first columns, compact section images, schedule counts and starting-state filters. Cards provide an alternate phone layout: the food name leads, temperature and time sit beside each other, and long state labels wrap. All source rows and notes remain available. Hash links still open the reference section and reveal the requested table.

Fixed reference ratios keep `data-s="0"`: changing recipe portions scales ingredients while leaving comparison ratios fixed. Unit conversion continues to apply. Published cooking temperatures, times, quantities and advice are unchanged.

## Verification

The style pass checks English/Russian, light/dark and phone/tablet/desktop layouts, including the embedded itinerary. Automated browser coverage compares every sous-vide row against its source for each filter and both layouts; recipe checks exercise portions, unit conversion, keyboard table scrolling and mobile overflow. TypeScript, lint, production build, unit tests and the no-cookie audit remain release checks. Screenshot evidence belongs in ignored `output/style-redesign/`.
