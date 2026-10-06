# ilyadays.com — setup plan

Status as of 2026-10-07. The site is live (Next.js 16 on Vercel, repo `ilyaperepelitsa/ilyadays`, every push to
`main` deploys). What's left is account setup that needs logins on this Mac.

## Decisions (fixed)

- **Stack:** Next.js 16 / React 19 / Tailwind 4 / TypeScript, the same as TypeKana. Pages are static (SSG).
- **Food:** `../recipes` (Python) stays the source of truth: images, translations, the local editor at
  http://localhost:8000. `npm run sync` exports JSON + images into this app.
- **Travel:** `../istanbul_trip` builds `dist/app.js`, which is mounted at `/travel/istanbul` as a client component.
- **Languages:** English at `/`, Russian under `/ru/`. English is the default. Russian is used only after the reader
  presses RU (localStorage `site-lang`, shared with the Istanbul app). No browser-language guessing.
- **No cookies anywhere.** State lives in localStorage. supabase-js uses its default localStorage session (never
  `@supabase/ssr`). Vercel Web Analytics and Speed Insights are cookieless. `npm run check:cookies -- --live` checks.
- **Travel progress:** everyone can see it; only the owner can edit (TypeKana's `public.is_admin()`). It's stored in
  TypeKana's Supabase project, table `trip_state`.
- **Public content:** others' material is rewritten in my own words and credited ("Easy Korean Cooking", prdp.net
  friends, Momofuku). About me lists TypeKana and nothing about work.

## Remaining setup

### 0. Logins (the user runs these once)

```
! npx vercel login
! npx supabase login
```

### 1. Supabase: TypeKana's project `tbwzyxakskvgvoiqjrlb`

- [ ] Run `supabase/migrations/20261006120000_trip_state.sql` (Management API `POST /v1/projects/{ref}/database/query`,
      or the SQL editor). It creates `public.trip_state (trip, key, value jsonb, updated_at)` with RLS: anyone can
      select; insert/update/delete only `using/with check (public.is_admin())`. It also has an `updated_at` trigger and
      a realtime publication. Safe to re-run.
- [ ] Check: `is_admin()` exists and returns true only for the owner. An anon select works; an anon insert is refused.
- [ ] Auth → URL Configuration → Redirect URLs: add `https://ilyadays.com/**`, `https://www.ilyadays.com/**` and
      `http://localhost:3000/**` (Management API `PATCH /v1/projects/{ref}/config/auth`, `uri_allow_list`). Keep
      TypeKana's Site URL and existing entries.
- Google Cloud: no change; the OAuth callback stays Supabase's.

### 2. Vercel: project `ilyadays`

- [ ] Env vars (Production + Preview + Development): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
      Same values as TypeKana; they're public client values (`.env.local` has them, gitignored).
- [ ] Enable Web Analytics and Speed Insights. The components are already in the root layout.
- [ ] Domains: make `ilyadays.com` primary and redirect `www.ilyadays.com` → `ilyadays.com`. Canonical URLs and link
      previews use the apex domain.
- [ ] Redeploy production so the env vars are baked in.
- `vercel.json` pins `framework: nextjs`, so the project's "Other" preset doesn't matter.

### 3. Verify on the live site

- [ ] `/`, `/ru`, `/food/*`, `/ru/food/*` and `/travel/istanbul` return 200. Old `/food/<slug>.html` links return 301.
- [ ] No `Set-Cookie` headers; 0 cookies in the browser after browsing and after signing in.
- [ ] Signed out: the Istanbul app is read-only, shows the owner's ticks, and has a working "Sign in" button.
- [ ] Signed in as the owner: tick a stop → the `trip_state` row updates → a second, signed-out browser sees it live.
- [ ] Signed in as a non-admin Google account: still read-only ("only the owner can edit").
- [ ] Link previews (title, description, 1200×630 image) for `/`, `/food/ramen`, `/travel/istanbul` and a `/ru` page.
      Check with a preview debugger or by pasting into Telegram/iMessage.
- [ ] The language switch persists; a first visit is English even with a Russian browser.

## Day-to-day

- Edit recipes in `../recipes` (the local service rebuilds). Publish with `npm run sync`, then commit and push.
- Trip changes: rebuild `../istanbul_trip` (`python3 build/assemble.py`), then `npm run sync`, commit and push.
- Push as the `ilyaperepelitsa` account (the active gh account `perpetualabacus` only has read access):
  `git -c credential.helper= -c credential.helper='!f() { echo username=ilyaperepelitsa; echo "password=$(gh auth token -h github.com -u ilyaperepelitsa)"; }; f' push origin main`

## Ideas / later

- More trips under `/travel/<trip>/`, sharing the same `trip_state` table (keyed by `trip`).
- favicon.ico for old browsers (PNG icons and the manifest are already in place).
