# Fitness: database setup and checks

The fitness section works before any database exists. Until the steps below are done, every set you log is kept in
the browser you log it in, and the page says so at the top:

> Saved in this browser only: the fitness database is not set up yet.

Use the same phone and the same browser (or the same Home Screen icon on an iPhone) until the database is ready.
Clearing the browser's site data before then deletes the log.

When the database exists and you sign in, that browser's log uploads to your account on the first visit, once.
After that the log is shared across your devices, visitors can watch it, and only you can change it.

## What the database holds

One migration, [`supabase/migrations/20261108120000_fitness.sql`](../supabase/migrations/20261108120000_fitness.sql),
creates the fitness tables. [`20261109135752_fitness_calibration.sql`](../supabase/migrations/20261109135752_fitness_calibration.sql) adds frozen session plans and set-suggestion provenance. Both can be run again safely.

| Table | Holds |
| --- | --- |
| `fitness_profiles` | Personal profiles: private by default, optional explicit sharing. Settings such as body weight and goal |
| `fitness_programs` | Programs: days, exercises in each slot, goal mode |
| `fitness_gyms` | Gym profiles: which machines exist, which are favourites, plate and stack increments |
| `fitness_sessions` | Workouts: day, gym, start and end, status (active, finished, auto-closed after 6 h, abandoned), frozen starting plan |
| `fitness_sets` | Every logged set: original target, actual kg/reps or seconds/metres, RIR, effective suggestion and its source |
| `fitness_exercise_state` | Current working weight, provisional/confirmed baseline evidence, and progression state per exercise |
| `fitness_bodyweight` | Dated bodyweight weigh-ins |
| `fitness_measurements` | Dated circumference observations in cm, with separate left/right sites |
| `fitness_adjustments` | Plan changes, including ones the AI adviser proposed and you accepted |

Access rules, enforced by Postgres Row Level Security:

- **Private by default:** each account reads its own rows. Other people can read rows only after that profile explicitly opts into public sharing. This includes settings, weigh-ins and circumferences. Existing public owner visibility is preserved.
- **Writing** needs a signed-in user who writes only their own rows and either is a site admin
  (`public.is_admin()`) or has a `fitness_profiles` row.
- A set can only belong to a workout of the same person.
- There can be only one owner profile, and nobody can promote themselves to owner.
- `public.fitness_close_stale_sessions()` closes your own workouts left open for more than 6 hours.
  The app also does this on its own when it opens.

## Set it up

Do this together with the Supabase move described in [the cutover guide](supabase-cutover.md). The fitness part
adds two steps.

1. **Create the dedicated Supabase project** and the Google sign-in, following sections 2 and 3 of the cutover guide.
2. **Run five migrations in the SQL Editor, in this order:**
   1. [`20261006110000_ilyadays_admin.sql`](../supabase/migrations/20261006110000_ilyadays_admin.sql)
   2. [`20261006120000_trip_state.sql`](../supabase/migrations/20261006120000_trip_state.sql)
   3. [`20261108120000_fitness.sql`](../supabase/migrations/20261108120000_fitness.sql)
   4. [`20261109135752_fitness_calibration.sql`](../supabase/migrations/20261109135752_fitness_calibration.sql)
   5. [`20261109142245_fitness_profiles_self_service.sql`](../supabase/migrations/20261109142245_fitness_profiles_self_service.sql)

   The fitness migration stops with an error, and creates nothing, if the admin migration has not run in that project.
   That keeps it out of a shared project whose `is_admin()` belongs to another app.
3. **Point the site at the new project.** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   in `.env.local` for local runs and in Vercel for the live site, then redeploy (cutover guide, sections 4 and 5).
4. **For a personal account:** sign in with Google, open `/fitness/profile`, enter a name, primary/supporting goals,
   training scope and days, and save. Registration creates a private non-owner profile without an invitation or
   SQL step. The profile page previews a first plan or a versioned pivot. The program constructor handles individual
   muscle exclusions, days and exercises. Weight/height are optional; dated weigh-ins and circumferences live on Progress.
5. **For site-owner administration only:** grant the intended verified Google account admin through the cutover
   guide, then use the existing admin bootstrap or explicitly set that account's `is_owner` in SQL. Ordinary profile
   registration never claims or transfers site ownership. The owner can explicitly enable public visibility.
6. **Check sync:** a signed-in personal profile shows “Editing — saved to your account”. New accounts never silently
   adopt an unrelated browser-only or public-owner log. Existing browser copies remain locally retained; account
   switches clear private UI and unsaved drafts. Pending entries upload when the signed-in account is online.

## In the gym without signal

- **Before the database exists** the log lives in the browser, so signal never matters.
- **After setup**, a phone you have signed in on before stays able to log with no signal, even when the sign-in token
  has expired. A phone you have just signed in on can log too while the check cannot reach the server. Sets wait on
  the phone, the top line shows how many are waiting, and they upload once when the signal returns. A page left open
  picks the connection up again by itself.
- If the server keeps refusing one change (five tries), that change is set aside in the browser and everything else
  keeps uploading.
- Signing out on purpose makes the page read-only on that phone, as for any visitor.
- **The gym pages work with no network at all** on a phone that has logged a workout (or where you are signed in):
  that phone keeps the hub, the log, the program, gyms, calculators, the exercise list and your program's exercise
  pages in the current language (a few MB, refreshed at most twice a day, never for visitors). Open `/fitness` once on
  wifi after the first workout so it is ready. **Save on this phone** in the footer is only needed for the whole site.

## The AI plan adviser

`/fitness/program` has an adviser that proposes changes in plain words, such as "skip the next increase on the chest
press" or "switch to two days a week for a month". It uses your own OpenAI key, kept in this browser only (the same key
as the trip planner) and sent straight to OpenAI, never to this site. The model must answer in a fixed format; the page
drops anything outside it (unknown exercises, jumps over 10 %, more than six changes) and changes nothing until you
tap **Apply**. Applied advice is logged in `fitness_adjustments`, and a held exercise shows when its hold ends.

## Check it worked

```sql
SELECT public.fitness_owner_id();                       -- your user id
SELECT day_key, status, started_at FROM public.fitness_sessions ORDER BY started_at DESC LIMIT 5;
SELECT count(*) FROM public.fitness_sets;
```

- In a private window, signed out, `/fitness/progress` shows your charts and the top line says only the owner can log.
- Signed in with another Google account, the buttons to log are absent.

## Local checks before touching Supabase

```bash
npm test                     # includes the database checks when Homebrew postgresql@17 is installed
npm run test:fitness:sql     # migrations (fitness and calibration twice), ownership and metadata checks on a throwaway local Postgres
npm run test:fitness:e2e     # phone-sized browser tests of the fitness pages and a full gym session
```

The database checks need Postgres 15 or newer. Set `PGBIN` to its `bin` folder if it is not Homebrew's
`postgresql@17`. The browser tests need Python with `pytest` and `playwright`; set `PY` to that Python.

## Personal plans and sharing

One primary goal controls prescriptions; up to two supporting goals record priorities and are included in adviser
context. Upper-body scope excludes quads, hamstrings, adductors, glutes, calves and lower-body patterns/carries.
These exclusions survive goal/template/day changes. Custom scope can preserve them and exclude other targets.
A saved pivot archives the previous program; exercise baselines, actual sets and frozen active sessions stay intact.
Empty days cannot be saved. Public profile-directory routes are a separate future feature; current visitors see only
the public site-owner log. Sharing is optional and profile-wide, as disclosed beside the checkbox.

See [profile implementation](../plans/fitness/11-profiles-and-multi-user.md) and the
[ten-pass review ledger](development-review-10-loops.md) for implementation and evidence.
