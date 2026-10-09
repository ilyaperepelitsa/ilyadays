# ilyadays.com

Ilya's homepage: **Food** (step-by-step recipes) and **Travel** (trip plans with the progress I've made), in English
and Russian. Next.js 16 (App Router, React 19, TypeScript, Tailwind 4), deployed on Vercel from `main`.

**No cookies anywhere.** Language, scroll position, ticked steps and the Supabase session all live in `localStorage`.
There is no middleware and no `@supabase/ssr`. Vercel Analytics and Speed Insights are cookieless.
`npm run check:cookies` audits a build for cookie use.

## Routes

| English | Russian | What |
| --- | --- | --- |
| `/` | `/ru` | Home: hello, Food / Travel, about me |
| `/food` | `/ru/food` | Recipe index. The search box matches titles and ingredient names (`bok choi` finds bok choy) |
| `/food/<slug>` | `/ru/food/<slug>` | A recipe |
| `/food/sous-vide` | `/ru/food/sous-vide` | Sous vide tables + PDF |
| `/travel` | `/ru/travel` | Trips |
| `/travel/new` | `/ru/travel/new` | Template for a new city: days, pace, meals, themes. A model fills the plan; Wikipedia and Commons add links and pictures. Saved in this browser |
| `/travel/made/<id>` | `/ru/travel/made/<id>` | A generated trip, on the browser that saved it |
| `/travel/istanbul` | `/ru/travel/istanbul` | The Istanbul planner. Everyone sees my progress; only I can edit it |

- Every content page is static (SSG). Each page has a canonical URL, EN/RU alternates, and a 1200×630 link-preview card (Open Graph + Twitter).
- **Save on this phone**, in the footer, stores the pages and pictures in this browser (about the size of `public/media`). After that the recipes open with no connection. On an iPhone, add the site to the Home Screen, open that icon, and tap Save there — that copy is separate from Safari. Making a new trip still needs the network. The list is `public/offline-catalog.json`, written by `scripts/write-offline-catalog.mjs` at the start of `npm run build`.
- The old static-site URLs answer with a 301 to the new routes (see `next.config.ts`):
  - `/food/<slug>.html`, `/food/index.html`
  - `/food/share/*.jpg`, `/food/illustrations/*`
- The EN · RU switch stores the choice in `localStorage["lang"]`. The Istanbul app uses the same key.
- `/travel/new` asks for a city, how many days, hours, sights, food breaks, linger or rapid pace, and whether days share a place. A preference note covers food and shops (secret bars, cafés, modern or traditional local food). Places to pass through are one per line and are not pinned to a day: one route walks through each. Each day has a short title and a longer description, in English and Russian. Suggest themes fills those first. Generate then asks for the stops, the visit notes, and names a Wikipedia article and a Commons search. Pictures come from those APIs. The model does not return image URLs. The key stays in `localStorage["cdays-ai-key"]` (the same key as the Istanbul re-plan) and saved trips stay in `localStorage["ilyadays-trips-v1"]`. Neither is sent to this site.
- A tiny script in `<head>` sends the reader to the same page in their language before the page paints.
  - On a first visit it picks Russian if the browser prefers Russian or the link was a `/ru` link.

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
3. It copies the recipe stylesheet and the site icons.
4. It copies `../istanbul_trip/dist/app.{js,css,d.ts}`.
5. It turns `art/covers/*.webp` into `public/covers` and the 1200×630 previews `public/share/{home,travel}.jpg`.

Commit the result. Vercel builds only from this repo and never sees the sibling repos.

In the exported HTML, links still point at `<slug>.html`. `src/lib/content.ts` rewrites them to `/food/<slug>` or `/ru/food/<slug>` at build time.

## Travel: who can edit

- The page reads the owner's progress from the Supabase table `public.trip_state` (one JSON value per trip and key).
- Anyone can read it.
- Writes are allowed by Row Level Security only when `public.is_admin()` is true. That is TypeKana's admin check.
- The client mounts the app read-only and switches to editing only when `rpc('is_admin')` returns `true`. Any error means read-only.
- Sign-in is Google through Supabase OAuth (PKCE), with the session in `localStorage`. Sign-in returns to the same page.

## Environment

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | TypeKana's Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | its anon / publishable key (public; RLS protects the data) |

Copy `.env.example` to `.env.local` for local runs, and set both variables in Vercel → Project → Settings → Environment Variables.
Without them the site still builds and works, but the Istanbul page shows the plan only, with no progress and no sign-in.

## Commands

```bash
npm install
npm run sync            # pull recipes, pictures, the Istanbul app, covers
npm run dev             # http://localhost:3000
npm run build && npm run start
npm test               # trip template: brief, prompts, notes, pictures, storage
npm run lint && npm run typecheck
npm run check:cookies   # after a build; add -- --live with `npm run start` running
```
