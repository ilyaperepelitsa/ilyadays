# ilyadays.com

Ilya's homepage: **Food** (step-by-step recipes), **Travel** (trip plans with the progress I've made) and **Fitness**
(a machine-first strength program with a one-tap gym log), in English and Russian. Next.js 16 (App Router, React 19, TypeScript, Tailwind 4), deployed on Vercel from `main`.

**This site sets no cookies.** Language, scroll position, ticked steps and the Supabase session all live in `localStorage`.
There is no middleware and no `@supabase/ssr`. Vercel Analytics and Speed Insights are cookieless.
`npm run check:cookies` audits the production build; add `-- --live` to check served response headers too. Google can use cookies on its own sign-in pages; the ilyadays session stays in browser storage.

## Routes

| English | Russian | What |
| --- | --- | --- |
| `/` | `/ru` | Home: hello, Food / Travel, about me |
| `/food` | `/ru/food` | Recipe index. Search and ingredient bubbles stay behind two buttons until you open them. Search matches titles and ingredient names (`bok choi` finds bok choy); ingredient bubbles wrap in sections and filter the list |
| `/food/<slug>` | `/ru/food/<slug>` | A recipe |
| `/food/onigiri` | `/ru/food/onigiri` | Nine original shop-inspired fillings and three shaping methods, selected on one illustrated page |
| `/food/sous-vide` | `/ru/food/sous-vide` | Cooking calculator, including salmon, with chilled/frozen controls, thickness sliders, recipe presets, reference tables and PDF |
| `/travel` | `/ru/travel` | Trips |
| `/travel/turkey-yacht-food` | `/ru/travel/turkey-yacht-food` | Twelve Turkish-inspired yacht meal proposals, seasonal shopping, and the shops on Google, Yandex and Apple Maps |
| `/food/yacht-sashimi` | `/ru/food/yacht-sashimi` | One full sashimi recipe with nine seafood variations and sourced buying/holding guidance; old Travel sashimi URLs redirect here |
| `/travel/new` | `/ru/travel/new` | Create a trip with optional stay dates and source-checked events; explicitly accepted events remain fixed through rebuilds. Saved in this browser |
| `/travel/made/<id>` | `/ru/travel/made/<id>` | A generated trip, on the browser that saved it. Each stop opens in Google, Yandex or Apple Maps by name; each day opens as a walking route in all three |
| `/travel/istanbul` | `/ru/travel/istanbul` | The Istanbul planner. Everyone sees my progress; only I can edit it |
| `/fitness` | `/ru/fitness` | Fitness hub: the next workout, Start, this week |
| `/fitness/train` | `/ru/fitness/train` | The gym log. One tap per set; weights progress on their own; a workout closes itself after 6 hours |
| `/fitness/program` | `/ru/fitness/program` | Personal plan constructor: primary/supporting goals, muscle exclusions, custom days/exercises, versioned pivots and adviser |
| `/fitness/profile` | `/ru/fitness/profile` | Private self-service profiles, optional sharing, personal goals and first-plan setup |
| `/fitness/exercises` | `/ru/fitness/exercises` | 138 exercises with generated technique diagrams, muscle maps, cues, mistakes and interchangeable machines |
| `/fitness/exercises/<id>` | `/ru/fitness/exercises/<id>` | One exercise |
| `/fitness/gyms` | `/ru/fitness/gyms` | Gym profiles: which machines a gym has; missing ones swap to an equivalent |
| `/fitness/progress` | `/ru/fitness/progress` | Strength, volume, dated weigh-ins, waist/arm/body measurements and consistency; private unless explicitly shared |
| `/fitness/nutrition` | `/ru/fitness/nutrition` | Protein and energy calculators and a protein food table |
| `/fitness/tools` | `/ru/fitness/tools` | One-rep max and the weight for any reps from a set you did, rounded to the machine; warm-up; plates per side |
| `/fitness/science`, `/fitness/science/<topic>` | `/ru/fitness/science/…` | Sourced explainers: goals and loads, progression, injury prevention, longevity, nutrition, the analytics |

- Every content page is static (SSG). Each page has a canonical URL, EN/RU alternates, and a 1200×630 link-preview card (Open Graph + Twitter).
- **Save on this phone**, in the footer, stores the pages and pictures in this browser (about the size of `public/media`). After that the recipes open with no connection. On an iPhone, add the site to the Home Screen, open that icon, and tap Save there — that copy is separate from Safari. Making a new trip still needs the network. The list is `public/offline-catalog.json`, written by `scripts/write-offline-catalog.mjs` at the start of `npm run build`.
- The old static-site URLs answer with a 301 to the new routes (see `next.config.ts`):
  - `/food/<slug>.html`, `/food/index.html`
  - `/food/share/*.jpg`, `/food/illustrations/*`
- The EN · RU switch stores the choice in `localStorage["site-lang"]`.
- `/travel/new` asks for a city, how many days, hours, sights, food breaks, linger or rapid pace, and whether days share a place. A preference note covers food and shops (secret bars, cafés, modern or traditional local food). Places to pass through are one per line and are not pinned to a day: one route walks through each. Each day has a short title and a longer description, in English and Russian. Suggest themes fills those first. Generate then asks for the stops, the visit notes, and names a Wikipedia article and a Commons search. Pictures come from those APIs. The model does not return image URLs. The key stays in `localStorage["cdays-ai-key"]` (the same key as the Istanbul re-plan) and saved trips stay in `localStorage["ilyadays-trips-v1"]`. Neither is sent to this site.
- Map links come from `src/lib/maps.mjs` (`placeLinks`, `routeLinks`, `walkLinks`) and render through `src/components/travel/MapLinks.tsx`. A pin only says "somewhere here", so a place opens by search: Google gets the search text, and Yandex and Apple search around the place's point. Generated stops carry the model's own `search` ("name, street, city"). Turkey shops search inside their town. Yandex uses `yandex.ru` for Russian pages. A phone browser keeps only three Google waypoints, so a longer walk becomes Google pieces of five stops ("Google Maps 1–5", "5–9"). Yandex and Apple take the whole day as one route. The Istanbul app does the same with its own `q`/`near` fields in `../istanbul_trip/data/catalog.json`.
- Generating a trip retries one busy or failed OpenAI request (not a bad key or a spent quota). The timeout grows with effort (1–6 minutes). A sight whose named Wikipedia article lies within 1 km takes the article's coordinates, so pins land on the place.
- A tiny script in `<head>` sends the reader to the same page in their language before the page paints.
  - Without a saved choice, the linked language stays in place: English at the root and Russian under `/ru`.

## Layout

```
src/app/(en)/…          English routes (root layout with <html lang="en">)
src/app/ru/…            Russian routes (root layout with <html lang="ru">)
src/app/global-not-found.tsx, manifest.ts, robots.ts, sitemap.ts
src/views/              page bodies shared by both languages + per-page metadata (meta.ts)
src/components/food/    recipe markup — mirrors ../recipes/build.py so food.css renders it exactly as before
src/components/site/    header, EN·RU switch, Google sign-in, page memory (scroll + ticks), root shell
src/components/travel/  Istanbul app, plus the trip template (form, reader, saved list)
src/lib/                content loader, i18n, metadata, Supabase client, trip storage adapter
src/styles/food.css     copy of ../recipes/static/style.css (synced — don't edit here)
src/styles/site.css     home / travel / shell styles
src/types/istanbul.d.ts the Istanbul app's types (synced)
content/                recipe JSON, en + ru (synced)
public/media/           recipe pictures + the sous vide PDF (synced)
public/apps/istanbul/   the Istanbul app bundle (synced)
public/covers, share, icons   home covers, link-preview images, site icon (synced)
art/covers/             cover originals (scripts/make_covers.py)
supabase/migrations/    SQL for the trip_state table (run by hand in Supabase)
```

## Content flow

The recipes and the Istanbul app are edited in their own repos (`../recipes`, `../istanbul_trip`).
`npm run sync` (`scripts/sync-content.sh`) pulls them in:

1. It generates any missing recipe illustrations: `python3 ../recipes/imagegen/auto.py` (needs `OPENAI_API_KEY`;
   `SKIP_IMAGES=1 npm run sync` skips it). A new recipe always gets its pictures this way — from its hand-written
   spec in `../recipes/imagegen/recipes/`, or from a drafted one if it has none.
2. It runs `python3 ../recipes/export_json.py --out content --images-out public/media`.
   - This writes `content/{en,ru}/…json` and `content/svg-defs.svg`.
   - It copies every referenced picture.
   - `scripts/optimize-media.py` then resizes ingredient thumbnails to 600 px, shares byte-identical images,
     losslessly optimizes preview JPEGs, and refreshes image cache hashes. Install libwebp (`cwebp` and `webpinfo`)
     and libjpeg-turbo (`jpegtran`) before syncing.
     Detailed technique images retain their resolution. Legacy `public/food` asset copies are removed;
     their URLs already redirect to `/media` in `next.config.ts`.
3. It copies the recipe stylesheet and the site icons.
4. It copies `../istanbul_trip/dist/app.{js,css,d.ts}` and `mapdata.json`. `app.js` fetches the map data by its own
   `?v=` hash, so the two files must come from the same build (`tests/site/istanbul-bundle.test.mjs` checks).
5. It turns `art/covers/*.webp` into `public/covers` and the 1200×630 previews `public/share/{home,travel}.jpg`.

The Turkey seasonal shopping guide is authored here in `content/travel/turkey-yacht-food.json`. Its twelve cards link to full Food recipes, sourced from `../recipes/src/turkish_recipes.{py,json}` with bilingual translations and per-step art. The reusable Food collection is separate from the dated Travel provisioning notes. Source snapshots are retained in `art/turkey-recipes/source/` because the sibling currently has no Git repository.

All future generated art follows the shared [image requirements](art/IMAGE_REQUIREMENTS.md), owned by `art/image-requirements.json`. Sync refreshes the recipe generator's policy mirror before any generation; built-in workflows use `scripts/recipe-image-prompts.py` and `SKIP_IMAGES=1 npm run sync`.

Commit the result. Vercel builds only from this repo and never sees the sibling repos.

The onigiri filling and method JSON files remain source data for the combined page. Their old routes redirect
to `/food/onigiri?filling=…` or `?method=…`; salmon redirects to `/food/sous-vide?food=salmon`.
Integrated recipes are excluded from index cards, the sitemap, prerendered routes and the offline page list.

## Publishing and deployment storage

Push `main` and let Vercel's GitHub integration deploy it. Verify that deployment's commit and production alias.
Do not also run a CLI production deployment for the same commit: the 2026-10-11 storage audit found both a GitHub
and a CLI build of `eb33d70`, retaining duplicate output. Use a manual deployment only when the Git integration
is disabled or a specific Git deployment has failed and its cause is understood.

Vercel Deployment Storage includes retained build output and static assets, and the allowance is team-wide.
Check Usage → Deployment Storage → Projects before attributing the entire team total to this site. Current
public assets are approximately 119 MB; the 67 preview JPEGs were losslessly reduced by 864,054 bytes.
The audit could list three active deployments for each of `ilyadays`, `typekana` and `ratiocin`; it could not
read the dashboard's project-level storage totals. Preserve the production deployment and a working rollback
before cleaning deployment history. See [Vercel's optimization guide](https://vercel.com/docs/deployment-storage/optimize).

In the exported HTML, links still point at `<slug>.html`. `src/lib/content.ts` rewrites them to `/food/<slug>` or `/ru/food/<slug>` at build time.

The server discovers recipe JSON files directly and builds the Food catalog, groups, and “Recently added”
from those records. New recipes own an `added` publication timestamp (ISO 8601 with a timezone) in their
canonical source; the exporter carries it into each language's recipe JSON. Historical recipes fall back
to their exported summary dates. The server ignores the export's separate `recent` list, excludes redirected
recipes before taking the twelve newest, and caches the catalog for the build. No client-side recipe list is maintained.

## Travel: who can edit

- The page reads the owner's progress from the Supabase table `public.trip_state` (one JSON value per trip and key).
- Anyone can read it.
- Writes are allowed by Row Level Security only when `public.is_admin()` is true. The dedicated project defines this against its own `ilyadays_admins` membership table.
- The client mounts the app read-only and switches to editing only when `rpc('is_admin')` returns `true`. Any error means read-only.
- Sign-in is Google through Supabase OAuth (PKCE), with the session in `localStorage`. Sign-in returns to the same page. Auth and offline progress caches are namespaced by the backend project; users sign in again after cutover.

The Istanbul map has Hide/Show map controls on desktop, Plan/Map tabs on phones, and a Full screen button with an iPhone-compatible fallback. Fullscreen keeps a day picker available; Escape exits it. **Use my location** requests browser permission, shows a live position and accuracy circle, and links to walking navigation to the next unvisited stop in the selected day in Google, Yandex or Apple Maps. Dragging stops camera following. Stopping location, hiding the map, switching to the phone plan, leaving the page or moving the app to the background clears location tracking. Location is never written to Supabase or localStorage.

## Fitness: who can log

- Everything under `/fitness` reads and writes through a local-first store (`src/lib/fitness/store.ts`). A logged set lands in this browser at once and uploads when the account and the network allow.
- With no fitness tables in Supabase (today), the log stays in the browser it was made in, and the page says so. On the first signed-in visit after setup, that log uploads once.
- A phone that logs keeps the gym pages working with no network at all (the "gym copy": `src/components/fitness/GymOffline.tsx` + `public/sw.js`, production builds only); visitors get no service worker. **Save on this phone** is still the way to take the whole site offline.
- Anyone can read the log. Only the owner (a `fitness_profiles` row, or `public.is_admin()`) writes, and only their own rows. Set-up steps and checks: [fitness setup](docs/fitness-setup.md).
- Plans, research notes and the decisions behind the section live in [`plans/fitness/`](plans/fitness/README.md). The exercise catalog is `content/fitness/exercises/<slice>.json`, merged into `content/fitness/exercises.json` by `node scripts/fitness-catalog-merge.mjs`; ids come from `content/fitness/registry.json`.
- Diagrams are generated by `scripts/fitness-images.py` (OpenAI Images, a hard spend cap in `art/fitness/spend.json`). After a run, `python scripts/fitness-thumbs.py` makes the list thumbnails and `node scripts/fitness-image-index.mjs` indexes everything (the build re-runs the index).

## Environment

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The dedicated ilyadays Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | its public `sb_publishable_` key (RLS protects the data) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | legacy fallback when no publishable key is set |

Use [the Supabase, Google OAuth and Vercel cutover guide](docs/supabase-cutover.md) to move off the previously shared Typekana backend, preserve progress, and grant owner access. Run the three SQL migrations in order in the new project (admin, trip state, fitness).

Copy `.env.example` to `.env.local` for local runs, and set the URL and public key in Vercel → Project → Settings → Environment Variables.
Without them the site still builds and works, but the Istanbul page shows the plan only, with no progress and no sign-in.

## Commands

```bash
npm install
npm run sync            # pull recipes, pictures, the Istanbul app, covers
npm run dev             # http://localhost:3000
npm run build && npm run start
npm test               # trip template, offline catalog, recipe search and diagrams, site header, fitness (+ SQL checks if Postgres is installed)
npm run test:fitness:sql   # fitness migrations + 30 access checks on a throwaway local Postgres
npm run test:fitness:e2e   # phone-sized browser tests of the fitness pages and a gym session (Python Playwright)
npm run lint && npm run typecheck
npm run check:cookies   # after a build; add -- --live with `npm run start` running
```

The sashimi page uses `SashimiChoices` with nine complete recipe variants exported together as `content/{en,ru}/sashimi.json`. Author variants in `../recipes/src/sashimi_variants.json` and `sashimi_recipes.py`; they are not registered as separate Food routes. Shared cold-storage/dip art is deduplicated, while each seafood has a distinct raw preview, technique and plated picture. The `seafood` query parameter survives EN/RU switching and isolates cooking checkmarks. Turkish recipes use the standard mise and per-step ingredients; `Step.amounts` supports measured ingredients split between steps. Source snapshots live under `art/turkey-recipes/source/`.

## Aurelius / Stoicism

`/stoicism` is a provenance-first editorial workbench for Meditations. The public page uses original synthetic fixtures; private SQLite development runs with `npm run aurelius:dev` on loopback. See [setup, scope and tests](apps/aurelius/README.md) and the [implementation log](docs/aurelius/implementation-log.md). Real translation import and external processing require separate approvals.
