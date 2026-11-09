# Sitewide design pass — November 2026

The Food and Travel surfaces now use the same product hierarchy as Fitness, with the existing warm palette, illustrated artwork and serif recipe titles retained. The official Claude `frontend-design` skill was consulted using current screenshots before implementation.

- The shared header uses one wordmark and one current-section treatment. Food category navigation stays on the catalog; recipe details retain their own group and section links.
- Food search is immediately visible. Ingredient filtering, shareable query URLs, serving scales, units, cooking checkmarks and recipe variations retain their behavior. Phones have compact illustrated recipe rows and a browsable recent-recipe rail.
- Recipe artwork moves ahead of the introduction on phones. Technique illustrations retain their full aspect ratio. Ingredients and steps use quieter panels and consistent working controls; print styling is preserved through screen-only host overrides.
- Travel creation is the first action. Illustrated field guides use compact cards; the yacht guide has a collage of existing Turkish dishes. Saved trips show their actual stay dates and no longer look like empty “new trip” cards. Generated itineraries share the type and spacing system.
- Istanbul uses the site's typography and surface/accent tokens through a host-owned override. Day and map-category colors remain distinct. Its wrapper no longer requests Google Fonts.

## Third-party images

The deeper Istanbul browser check found Wikimedia image cookies, despite the site's own cookie audit being clean. Photo requests now set anonymous CORS **before** their source URL, and generated-trip photos use the same mode. Credits and file-page links remain intact. A real browser check confirmed that a Commons thumbnail loads in this mode without storing cookies.

The canonical embedded source is `../istanbul_trip/src/app.js` (a local source folder without Git). Its element helper applies anonymous CORS and no-referrer handling to photos; the optional tile probe, raster tiles and fallback Leaflet script also use anonymous CORS. The source was assembled with `python3 build/assemble.py`, syntax-checked, and its four tests passed. Only the resulting `dist/app.js` was copied into `public/apps/istanbul/app.js`; the map-data hash was verified unchanged. Future `npm run sync` retains this fix because the canonical source was updated.

Presentation lives in site-owned `src/styles/modern.css` and `src/styles/trip-appearance.css`, so a recipe or embedded-app content sync cannot overwrite it. Screenshots and Claude consultation artifacts are under ignored `output/sitewide-review/`.

Validation: 1,015 automated tests, TypeScript, build and lint; eight Food/header/cooking browser cases; seven trip-creation scenarios; 128 responsive views plus 24 targeted refinements; eight fresh Istanbul contexts in EN/RU, light/dark and phone/desktop. Istanbul's fonts and surfaces match the host, map switching works, there are no Google requests or new cookies, and Commons photos decoded on desktop with anonymous CORS. External lazy photos can still depend on the publisher's response time. Native date controls follow the reader's browser/OS format; their value remains an ISO calendar date. Claude's final bounded screenshot review returned PASS after the duplicate embedded controls and metadata clipping were addressed.
