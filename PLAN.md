# ilyadays: independent Supabase, OAuth, and travel controls

Updated: 2026-11-09.

The implementation is prepared locally. The dedicated free Supabase project and all three database migrations are
installed. Google OAuth is enabled and the local app uses the new project. Owner sign-in/sync, progress recovery,
Vercel environment cutover and deployment remain pending; production still uses the existing configuration.

Detailed SQL, account settings, callback URLs, commands, recovery, and rollback: [Supabase / Google OAuth / Vercel cutover guide](docs/supabase-cutover.md).

## Target

- Give ilyadays its own Supabase project, admin membership, Google Cloud project, and Google OAuth client.
- Keep the existing ilyadays Vercel project and domain.
- Preserve available Istanbul progress. Everyone can read it; only the explicitly granted owner can edit.
- Add map visibility, fullscreen, location, and walking-navigation controls in English and Russian.
- Retain localStorage sessions and the site's no-cookie behavior.
- Preserve Typekana's database, users, admin function, OAuth credentials, and deployment configuration.

## Completed locally

- [x] Add independent `ilyadays_admins` membership and `is_admin()`; reject an unrelated existing admin function during setup.
- [x] Prepare trip-state schema, public reads, owner-only writes, and Realtime publication membership.
- [x] Support a publishable key with a legacy anon-key fallback; scope sessions and offline caches to the configured project.
- [x] Add public-progress export and browser-snapshot recovery tools.
- [x] Add desktop Hide/Show map controls and preserve phone Plan/Map tabs.
- [x] Add native fullscreen with a viewport fallback, exit/Escape support, and a day picker.
- [x] Request location permission on tap; show live position and accuracy above stop markers.
- [x] Follow location until the map is dragged, including when a day-fit animation is still finishing.
- [x] Offer walking navigation to the next unvisited stop through Google, Yandex, and Apple Maps.
- [x] Stop tracking on explicit stop, map hiding, the phone Plan tab, page backgrounding, and unmount.
- [x] Permit same-origin geolocation through the response policy.
- [x] Update canonical source in `../istanbul_trip` and rebuild the copied app bundle.

Navigation guidance runs in the selected maps app. The embedded map shows the planned route and current position.

## 1. Restore account access

- [x] Establish authenticated access to Supabase and the existing ilyadays Vercel project.
- [ ] Establish access to the dedicated Google Cloud OAuth configuration.
- [x] Confirm the project placement and create a dedicated free `ilyadays` Supabase project.

Current account check (2026-11-09): Supabase and Vercel tools load in the CLI. After the owner's team-access approval,
Vercel reads succeed for team `team_WIaaOlgeSjCwOu531IfYiTOc` and project `prj_RixiWFfDS6JfFAvm0VzLlYQat4Lg`.
Supabase quoted $0/month and created `ilyadays` (`mnqfdfxyodkakthxuwkw`) in the free personal `ilyaperepelitsa`
organization, region `eu-north-1`. Both `typekana` and `ilyadays` are `ACTIVE_HEALTHY`; Typekana was not changed.

## 2. Preserve progress

- [x] Inspect the old project's `trip_state` table and Data API visibility. Its API returned `PGRST205`; a read-only
  query against `pg_catalog` now confirms no table/view named `trip_state` exists in any schema of the configured
  Typekana project. There is no database copy to export from that project; browser recovery remains pending.
- [x] Check remote-export availability: the old table is absent, so there is no database copy to export. The export
  command remains available for another source, if one is identified, before changing `.env.local`:

  ```sh
  node --env-file=.env.local scripts/export-trip-state.mjs
  ```

- [ ] If remote progress is unavailable, recover a local copy from the device where progress was edited, following the cutover guide.
- [ ] Review the recovered stops and date. If no saved copy exists, explicitly choose to start from defaults.
- [x] Back up the old environment values outside Git: `~/.local/share/ilyadays/backups/env.local.pre-cutover.20261109T133324466628Z` (mode 0600).
- [ ] Pause progress edits between the final export and cutover.

Generated trips under `/travel/made/...` remain in their original browsers and do not require Supabase migration.

## 3. Set up independent Supabase

- [x] Create the dedicated project and retain its URL and active publishable key in git-ignored
  `output/supabase-cutover/ilyadays.env`. The local environment now uses it; production has not been switched.
- [x] Apply [the admin migration](supabase/migrations/20261006110000_ilyadays_admin.sql), then [the trip-state migration](supabase/migrations/20261006120000_trip_state.sql), then [the fitness migration](supabase/migrations/20261108120000_fitness.sql) to the new project through MCP. Hosted migration versions are `20261109131046` (`ilyadays_admin`), `20261109131047` (`trip_state`), `20261109131048` (`fitness`); do not blindly push the local timestamp history over them.
- [x] Local verification: `bash scripts/fitness-sql-check.sh` replayed all three migrations and 30 access checks on a throwaway local Postgres.
- [ ] Import the reviewed progress export, if available.
- [x] Verify public reads and Realtime configuration. All ten tables have RLS, anonymous writes are denied, the admin
  membership table has no browser privileges, and Realtime includes trip state plus four fitness tables. The owner
  profile is still absent, as expected before sign-in.

## 4. Separate Google OAuth

- [x] Create/select the dedicated Google Cloud project `ilyadays` and its Web application OAuth client. The downloaded
  client JSON confirms both production origins and `http://localhost:3000`.
- [x] Add the new callback: `https://mnqfdfxyodkakthxuwkw.supabase.co/auth/v1/callback` (verified in the client JSON).
- [x] Enable Google in the new Supabase project using the new client ID and secret. `/auth/v1/settings` confirms it;
  the PKCE authorization request redirects to that Google client with the correct callback.
- [x] Owner saved Site URL and production/local return URLs from the guide; verify the return through the first real sign-in.
- [ ] Verify consent branding and the owner's test-user access/production audience during the real sign-in.

## 5. Test locally and grant owner access

- [x] Point `.env.local` at the new project using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; remove the old anon-key value. Other variables were preserved.
- [x] Rebuild and start the local app at `http://localhost:3000/fitness`; rendered browser scripts use the new host.
- [ ] Owner signs in through the new Google OAuth client. The owner has been given the local link and asked which email to authorize.
- [ ] Add the owner's **new** Supabase user UUID to `public.ilyadays_admins` through SQL Editor.
- [ ] Open `/fitness` signed in and tap **Create my fitness profile** (or run the profile SQL in the fitness migration's footer). Workouts logged in this browser before the database existed upload on that visit.
- [ ] Confirm owner editing, signed-out reads, and non-owner read-only access.
- [ ] Confirm imported progress matches the reviewed source.

## 6. Switch Vercel and deploy

- [ ] Update only the ilyadays project's environment variables and applicable branch overrides.
- [ ] Remove obsolete anon-key entries; check whether an integration could restore the old values.
- [ ] Keep Google secrets and Supabase secret/service-role keys out of browser environment variables.
- [ ] Review changes and publish through GitHub → Vercel. If the reviewed commit is already deployed, rebuild/redeploy after updating the environment.
- [ ] Verify the production commit and `ilyadays.com` alias. Avoid a duplicate CLI production deployment.

## 7. Production acceptance

- [ ] Owner Google sign-in returns to the initiating page and enables editing.
- [ ] A reversible progress change reaches only the new backend; restore it after checking.
- [ ] A signed-out browser sees progress; another signed-in user cannot edit.
- [ ] Typekana login and behavior remain intact.
- [ ] Desktop hide/show and phone Plan/Map switching work in EN and RU.
- [ ] Fullscreen, exit, day selection, location success/denial/retry, and tracking cleanup work on target devices, including an iPhone.
- [ ] Navigation opens the selected maps app with the intended origin and destination.
- [ ] Browsing and sign-in create no cookies or `Set-Cookie` headers.
- [ ] Refresh installed/offline copies online and save the updated site on the phone again.
- [ ] Check existing Analytics, Speed Insights, and apex/www domain settings.

## Verification already completed

- [x] 113 repository tests and 4 Istanbul source tests passed.
- [x] TypeScript, production build, targeted ESLint, whitespace checks, and cookie audit passed.
- [x] Isolated PostgreSQL checks passed for migration reruns, public reads, owner writes, rejected non-owner writes/self-promotion, and the shared-project guard.
- [x] Desktop and 390 × 844 phone browser checks passed for controls, fullscreen/fallback, location, navigation links, denied permission, and Russian labels.
- [x] Verified that a pending day-fit animation cannot override location following.

Local checks do not replace production acceptance.

## Rollback and maintenance

- Keep the old backend and environment values until production acceptance is complete.
- To roll back, restore the old ilyadays values, remove the new publishable-key override, and rebuild. Reconcile progress written only to the new backend first.
- Retire old ilyadays-specific configuration after the new deployment is stable; retain Typekana's resources.
- Continue authoring Food in `../recipes` and the Istanbul planner in `../istanbul_trip`. Rebuild, sync, and publish reviewed changes through GitHub.

Fitness calibration expansion (2026-11-09): per-exercise provisional/confirmed baselines, actual-versus-planned set
records, conservative next-set advice, frozen session context and strict next-visit load guards are implemented.
The additive calibration migration is applied to the new ilyadays project; see master §17 and HANDOVER.md for
schema, science sources and validation. Owner sign-in/sync and production cutover still need completion.

Personal-plans/travel/UI expansion (2026-11-09): ten critique passes complete; private self-service profiles,
prioritized goals, persistent exclusions/custom constructor/pivots, dated circumference records and easy-set
coaching are implemented. Dated trips have explicitly accepted source-confirmed event commitments and conflict-aware
schedules. Navigation/home make Fitness prominent. 1,015 automated tests, 113 unique browser checks, 40 visual
views, native SQL, typecheck, lint, build and first-party cookie audits verified. Details and honest test-retry
notes: `docs/development-review-10-loops.md`. Local preview running; publishing still needs owner's go-ahead.

Production publishing approved (2026-11-09): the owner requested UI polish and a production push. Target verified
as existing `main` → Vercel ilyadays → `ilyadays.com`; production URL/publishable-key variables are configured.
Additional Fitness entry/form polish is included. Final commit/deployment identity and live checks are recorded
in the release result and ignored `output/production-release/` artifacts. Earlier go-ahead gates are satisfied.
