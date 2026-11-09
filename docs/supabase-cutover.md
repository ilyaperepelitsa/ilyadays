# Separate ilyadays from Typekana

Use a dedicated Supabase project and a dedicated Google OAuth app for ilyadays. Keep the existing Vercel project and domain. There is no server-side database secret or Google secret to add to Next.js: the browser uses a public Supabase key, PKCE, and localStorage; SQL Row Level Security protects writes.

**Prepared in this repo:** independent admin schema, trip schema, public-progress export, project-scoped browser auth and offline caches, and the map controls. **Hosted database ready:** the dedicated free [ilyadays Supabase project](https://supabase.com/dashboard/project/mnqfdfxyodkakthxuwkw) exists, and all five migrations (admin, trip state, fitness, calibration, private self-service profiles/measurements) are installed. Both Typekana and ilyadays are active and healthy. Vercel access works after the owner's team grant. Google OAuth is enabled and the local `.env.local` now uses the new backend. Personal fitness self-registration is implemented and private by default. Real owner administration and a live Google sign-in/sync acceptance check remain pending. Production still uses its previous configuration; no deployment was made.

The new URL and active publishable key are retained in git-ignored `output/supabase-cutover/ilyadays.env` and applied
to `.env.local`. The old file was backed up outside Git under `~/.local/share/ilyadays/backups/` with mode 0600.
The new Google callback is
`https://mnqfdfxyodkakthxuwkw.supabase.co/auth/v1/callback`.

## 1. Save the existing progress

Before changing `.env.local`, run from the repo root:

```sh
node --env-file=.env.local scripts/export-trip-state.mjs
```

This reads only the old project's public `trip_state` table and writes `output/supabase-cutover/trip-state.sql`. It never modifies the source. Check the reported row count and keep the file locally. Avoid ticking or rearranging stops between the final export and the switch. If edits continue during setup, repeat the export just before importing and deploying. Generated trips under `/travel/made/...` remain in each browser; they are not Supabase data.

### If the old table is missing: recover a browser copy

During preparation, the configured old API returned `PGRST205`: `public.trip_state` was missing from the schema cache. A read-only `pg_catalog` query on 2026-11-09 now confirms there is no table or view named `trip_state` in any schema of that Typekana project. That does **not** prove the owner has no local progress. Browser recovery is the remaining source to check. No remote progress export was produced during this task.

On the browser/device where the progress was edited, open the old site before cutover. In its developer console, evaluate only the progress keys:

```js
const keys = ["visited", "ideas", "dayOrder", "days", "tripStart"];
const saved = JSON.parse(localStorage.getItem("ilyadays-trip-istanbul") || "null")
  || JSON.parse(localStorage.getItem("cdays-state-v1") || "null")
  || Object.fromEntries(keys.flatMap(key => {
    const value = localStorage.getItem("cdays:" + key);
    return value === null ? [] : [[key, JSON.parse(value)]];
  }));
JSON.stringify(Object.fromEntries(keys.filter(key => saved[key] != null).map(key => [key, saved[key]])), null, 2);
```

Copy that result to `output/supabase-cutover/browser-progress.json` and run:

```sh
node scripts/export-trip-state.mjs --snapshot output/supabase-cutover/browser-progress.json
```

This exports only the five progress fields and excludes the saved AI key and UI preferences. Review the visited stops/date before importing; a local copy can be stale. An empty object is rejected. If neither the database nor any device has saved progress, skip importing and start from the plan's defaults.

Only public trip progress needs to move. Do not copy Typekana's users, admin tables, auth settings, or the rest of its database. The owner signs in anew and receives a new Supabase user ID.

## 2. Create the Supabase project and database

1. Open [Supabase Dashboard](https://supabase.com/dashboard), choose the intended personal organization, and create a project named `ilyadays`. Save the generated database password in your password manager. Choose the region you want; review the account's available plan/project allowance before creating it.
2. In the **new** project's SQL Editor, run these files in this order:
   - [`20261006110000_ilyadays_admin.sql`](../supabase/migrations/20261006110000_ilyadays_admin.sql)
   - [`20261006120000_trip_state.sql`](../supabase/migrations/20261006120000_trip_state.sql)
   - The exported `output/supabase-cutover/trip-state.sql`, if preserving progress.
3. The first migration defines `public.is_admin()` against `public.ilyadays_admins`; that table starts empty. It refuses to replace another application's existing `is_admin()` when the ilyadays admin table is absent. Run these migrations only in the fresh project. The second creates `trip_state`, its public SELECT/admin-only write policies, update trigger, and Realtime publication membership.
4. Under the project's **Connect / API Keys** settings, copy the Project URL and **publishable** key. The legacy `anon` key also works. Do not use a secret key or `service_role` key in a `NEXT_PUBLIC_...` variable.
5. Keep the Data API enabled for `public`. Realtime is optional, but the migration enables the table in `supabase_realtime` when that publication exists.

The earlier timestamp on the new admin migration makes a clean install run in dependency order. Do not push this migration history into the old shared project.

## 3. Give Google OAuth its own identity

A separate OAuth client isolates credentials and callback URLs. A separate Google Cloud project also gives ilyadays its own consent-screen name and branding; use that for a full separation from Typekana.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create/select a dedicated `ilyadays` project, and open **Google Auth Platform**.
2. Complete **Branding** with app name `ilyadays`, your support/contact email, homepage `https://ilyadays.com`, and authorized domain `ilyadays.com`. Add privacy/terms URLs if Google requires them for your chosen publishing flow, using actual published policies.
3. In **Audience**, use External for personal Google accounts. While the app is in Testing, add the owner's Google account to Test users. Publish to Production when ready for other users, completing any requirements Google displays.
4. In **Clients**, create an OAuth client of type **Web application**, named `ilyadays web`.
5. Authorized JavaScript origins:

   ```text
   https://ilyadays.com
   http://localhost:3000
   ```

6. Authorized redirect URI (replace `<new-project-ref>`):

   ```text
   https://<new-project-ref>.supabase.co/auth/v1/callback
   ```

   This is Google's callback to Supabase. The site itself handles the later PKCE return; there is no Next.js `/auth/callback` route to configure.
7. In the **new Supabase project → Authentication → Sign In / Providers → Google**, enable Google, paste the new Client ID and Client Secret, and save. Leave nonce validation enabled. The Client Secret belongs in Supabase, never in Vercel's public environment or this repo.
8. In **Authentication → URL Configuration**, set Site URL to `https://ilyadays.com`. Add these Redirect URLs, because sign-in returns to whichever page initiated it:

   ```text
   https://ilyadays.com/**
   http://localhost:3000/**
   ```

   Add `https://www.ilyadays.com/**` only if that host actually serves the app without first redirecting. For preview sign-in, add the specific trusted preview origin plus `/**`; avoid allowing every Vercel project or an untrusted deployment.

Leave Typekana's Google client, consent screen, callback and Supabase settings intact. Its existing users should not notice this migration.

Official references: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [redirect URL matching](https://supabase.com/docs/guides/auth/redirect-urls).

## 4. Test locally and grant owner access

1. Save a local backup of the old `.env.local` outside Git. Replace its Supabase values with:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<new-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<new-public-key>
   ```

   Remove the old `NEXT_PUBLIC_SUPABASE_ANON_KEY` so there is one unambiguous public key. The app prefers `PUBLISHABLE_KEY` and falls back to `ANON_KEY` for older installations.
2. Restart `npm run dev`, open `http://localhost:3000/travel/istanbul`, and sign in with your Google account. A first sign-in creates the account in the new project's **Authentication → Users**. It will initially be read-only.
3. Copy that account's new user UUID from the dashboard. In the **new** project's SQL Editor, grant access explicitly:

   ```sql
   INSERT INTO public.ilyadays_admins (user_id)
   VALUES ('REPLACE_WITH_NEW_AUTH_USER_UUID'::uuid)
   ON CONFLICT (user_id) DO NOTHING;
   ```

   Do not use the old Typekana UUID. There is no automatic first-user-admin or editable profile field that grants admin.
4. Refresh the page. Your account should now show editing enabled. In a signed-out/private browser, the same progress must remain visible and read-only. A different signed-in account must also remain read-only.
5. Verify the imported rows in SQL Editor:

   ```sql
   SELECT trip, key, updated_at FROM public.trip_state ORDER BY trip, key;
   SELECT count(*) FROM public.ilyadays_admins;
   ```

   Calling `is_admin()` from SQL Editor does not impersonate the browser's authenticated user. Verify the true/false result through the site's signed-in state.

No users means no admins. If Google login fails, inspect the Supabase auth logs and verify both distinct redirect layers above. A new project and the new auth storage namespace require signing in again; old sessions and cached progress are deliberately not reused for the new project.

## 5. Change Vercel and deploy once

1. Open **Vercel → ilyadays → Settings → Environment Variables**. Edit the ilyadays project only.
2. Set the new `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production, Preview and Development as appropriate. Delete the old `NEXT_PUBLIC_SUPABASE_ANON_KEY` entries, including branch-specific overrides. A separate preview backend is preferable when testing database changes; otherwise preview writes reach the same owner data.
3. Do not add Google Client Secret, Supabase database password, secret key, or service-role key to this browser-only app. No Vercel/Supabase integration is needed for these two manual variables. If an existing integration manages them, update/remove its ilyadays binding so it cannot restore the old values; keep Typekana's binding intact.
4. These values are compiled into the client bundle. Update them **before** the next production build. Publish the reviewed code through this repo's normal GitHub → Vercel integration. If that commit is already deployed, use **Redeploy** for it after changing the variables. Do not also create a duplicate CLI production deployment.
5. Verify the deployment's commit and `ilyadays.com` alias. Sign in again on production, confirm the editing badge, make a reversible progress change, and verify that only the **new** project's `trip_state` changes. Restore the progress change. Check signed-out reads and Typekana login separately.
6. For an installed/offline copy, open the live site online, allow its service worker to update, and save the site on the phone again. Confirm the new backend in a fresh online tab before testing offline.

[Vercel's environment-variable guide](https://vercel.com/docs/environment-variables/managing-environment-variables) explains why changing a setting requires a new deployment.

## 6. Map controls check

- Desktop: Hide map gives the plan the full width; Show map restores it. The preference stays in this browser.
- Phone: Plan/Map tabs switch panes. Full screen opens a viewport overlay and uses native fullscreen when available; Exit full screen or Escape restores the page. The day picker remains usable with the plan hidden.
- Use my location triggers permission only on tap. Allowing it shows a position marker and accuracy circle; dragging stops camera following. The next unvisited stop in the chosen day offers walking navigation in Google, Yandex and Apple Maps. Those apps supply directions/turn-by-turn guidance. The embedded map itself shows the location and planned route.
- Denying permission, a timeout, or unsupported geolocation produces a readable status and leaves the map usable. HTTPS is required outside localhost. The response policy permits geolocation for this origin.
- Stop location, Hide map, the phone's Plan tab, leaving the page and putting the page in the background stop the watcher. Location is never saved in Supabase or localStorage. Choosing a maps link shares the route origin with that maps service.

## Rollback and later cleanup

Keep the old project and both sets of environment values until production sign-in, admin writes, public reads and progress match. To roll back, restore the old ilyadays Vercel variables, remove the new publishable-key variable so it cannot override the legacy key, and rebuild/redeploy. The Google client and backend must match. Changes made only on the new backend after switching are not automatically copied back; export/reconcile them before reverting if needed.

After a stable cutover, remove only ilyadays-specific redirect entries or old table data if you explicitly choose to retire them. Do not delete Typekana's project, users, admin function or OAuth app. No old database rows or cloud resources are removed by this change.
