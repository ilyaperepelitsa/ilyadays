# 01 — Database & sync: the local-first FitnessStore and FitnessProvider

Status: **done** (see "Status" at the end). Contract: `plans/fitness/00-master-plan.md` §5–§6.

## Scope

Everything between the UI and persistence: the pure store core (reducers, last-writer-wins merge, outbox, row
mappers, validators, adoption of pre-Supabase data), the browser sync layer (localStorage + Supabase + realtime),
the React provider that exposes the snapshot through `useSyncExternalStore`, and the one-line mode note at the top of
fitness pages. Not in scope: engine logic (progression, planning), pages, the SQL checks under `tests/fitness/sql/`.

## Files (owned)

| File | What |
| --- | --- |
| `supabase/migrations/20261108120000_fitness.sql` | written by the master plan; unchanged here (setup steps below) |
| `src/lib/fitness/store-core.mjs` | pure, tested: `applyUpsert`, `applyRemove`, `mergeRemote`, outbox, `toRemote`/`fromRemote`, `isRow`, `remoteProblem`, `closeStaleSessions`, `defaultSettings`, `storageKeys`, `adoptLocalData`, (de)serialisation |
| `src/lib/fitness/store.ts` | `createFitnessStore()` implementing `FitnessStore` + sync extras; standalone `ensureProfile()` |
| `src/components/fitness/Provider.tsx` | `FitnessProvider`, `useFitness`, `FitnessContextValue` (stub API kept; fields appended) |
| `src/components/fitness/ModeNote.tsx` | `<ModeNote lang />` status line + admin "Create my fitness profile" button; `useStoreStatus()` |
| `src/styles/fitness/store.css` | mode-note layout (shared `fit-note` classes do the colours) |
| `tests/fitness/store-core.test.mjs` | node:test for the core |
| `tests/fitness/store-sync.test.mjs` | node:test for `store.ts` with a fake Supabase client (Node strips the types) |
| `tests/fitness/store-fixtures.mjs`, `tests/fitness/store-fake-supabase.mjs` | test helpers: valid rows per table, memory storage; in-memory supabase-js stand-in (RLS-style checks, CHECK/FK codes, server `updated_at`, rpc, realtime, outage) |

## Contract / API

- `store.getSnapshot()` synchronous, identity-stable between changes; `store.subscribe(fn)` returns the remover.
- `store.upsert(table, row)` / `store.remove(table, id)`: validated with `isRow`, applied at once, persisted to
  `localStorage["ilyadays-fitness:<project>:snapshot"]`; in **synced** mode also queued in
  `localStorage["ilyadays-fitness:<project>:outbox"]` (flush 300 ms later). **viewer**/**loading**: no-op + `console.warn`.
  `project` = `supabaseProject` from `src/lib/supabase.ts` (`"unconfigured"` without env vars).
- `snapshot.pending` = outbox entries of the signed-in user; `snapshot.syncedAt` = last successful pull or flush.
- Context (`useFitness()`): `{ snapshot, store, mode, canWrite, auth }` + appended `online`, `pending`, `lastError`,
  `ensureProfile(): Promise<void>`.
- Extras on the browser store (`SyncedFitnessStore`): `start()` (listeners + 30 s tick; returns stop), `attach(auth)`,
  `recheck()`, `getStatus()` (`StoreStatus`: mode, localReason, online, pending, flushing, syncing, lastError,
  rejected, profile, ownerId, userId, storageProject), `closeStaleSessions()`, `bootstrapSettings()`,
  `ensureProfile(displayName?)`, `dispose()`. `isSyncedStore(store)`; `ensureProfile(storeOrClient, displayName?)`.
- Ids: every `id` column is `uuid`. Streams 03/05/04/06/10 must create programs, gyms, sessions, sets, weigh-ins and
  adjustments with `crypto.randomUUID()`. A row with a non-UUID id stays local and is not uploaded (warning +
  `lastError`); a non-UUID `programId`/`gymId` on a session is uploaded as `null`.

### Mode decision (`attach({ user, isAdmin, loading })`)

| Condition | Mode | Local copy used |
| --- | --- | --- |
| Supabase not configured | `local` | `unconfigured` |
| auth loading, before this tab decided (later page navigations keep the decision) | `loading` (cached copy shown read-only) | project |
| signed in, `rpc('fitness_can_write')` = true | `synced` (admin: `ensureProfile` first; then adopt local data, pull, flush) | project |
| signed in, this user was confirmed a writer on this device before (`…:writer`) | `synced` at once; the rpc re-checks in the background (offline gym) | project |
| configured, nobody signed in, un-adopted rows under `unconfigured` | `local` (owner keeps training before signing in) | `unconfigured` |
| rpc fails with "function/table not found" (migration not applied) | `local` | `unconfigured` |
| anything else | `viewer` (`rpc('fitness_owner_id')`, read the owner's rows, realtime on sessions + sets) | project |

### Row mapping (`toRemote(table, row, { userId?, displayName? })` → `{ table: "fitness_…", record }`; `fromRemote(table, record)` → row | null)

| Table | Remote | Notes |
| --- | --- | --- |
| programs | `fitness_programs {id, user_id, active, spec}` | `active = row.active !== false` (untyped optional flag); spec without `active` |
| gyms | `fitness_gyms {id, user_id, spec}` | |
| sessions | columns | `program_id`/`gym_id` only when UUIDs; `bodyweight_kg` only in (20, 400); `readiness` `{}`; `notes` `''`, cut to 2000 |
| sets | columns | kg 2 dp, rir 1 dp, reps/index integers |
| exercise_state | `{user_id, exercise_id, spec}` | `onConflict: "user_id,exercise_id"` |
| bodyweight | `measured_at, weight_kg, body_fat_pct, note` | |
| adjustments | columns, `created_at = row.at` | |
| settings | `fitness_profiles {user_id, settings, display_name?}` | flushed with UPDATE (never creates a non-owner profile); empty jsonb → `null` |

`updatedAt`: jsonb tables keep the spec's own `updatedAt` (edit time); column tables take the server's `updated_at`
(upload time). Timestamps are normalised to `toISOString()`; comparisons use `Date.parse` (Postgres sends `+00:00`).

### Outbox

`{ table, id, kind: "upsert" | "remove", row?, at, uid }`, one entry per `table:id`, latest wins (a remove after an
upsert keeps only the remove). Rows are stored in Snapshot shape and mapped at flush time. Entries of another
`uid` (shared browser) are kept but not flushed. Malformed entries are dropped on parse.

### Flush

Upserts in `settings → programs → gyms → sessions → sets → exercise_state → bodyweight → adjustments` (sets after their
sessions), then removes in reverse order. `remoteProblem()` drops rows the server would reject anyway; a batch failing
with a Postgres data/integrity error (`22xxx`/`23xxx`) is retried row by row and only the rejected rows are dropped
(they stay in the local snapshot). Network, RLS (`42501`), auth and schema errors keep the queue and back off
(1 s … 60 s, jitter). Triggers: 300 ms after a write, `online`, tab visible, every 30 s while a session is active,
after each pull.

### Pull / merge

`mergeRemote(local, remote, { protect?, prune? })`: per row the newer `updatedAt` wins; union of rows; rows pending in
the outbox are protected. **Remote deletions are not tracked** in synced mode (another device's delete stays in this
device's copy). The viewer prunes rows absent remotely after a full pull (its copy is a mirror). Synced pulls are
incremental by the server's `updated_at` (2 min overlap; full pull when no cursor, after 24 h or on a user change);
paginated by 1000 with `count: "exact"`. Synced refresh first calls `rpc('fitness_close_stale_sessions')`.

## Design decisions (with reasons)

1. **Union merge, no tombstones** (as specified): simple and safe — nothing local is lost by a pull. Cost: deletes do
   not propagate between devices in synced mode; the viewer prunes after full pulls, so visitors stay faithful.
2. **Pending rows win over pulled rows** — column tables carry the server's upload time, which is always newer than
   the edit; without protection a pull between a write and its flush would flicker the old value back.
3. **Local mode when the owner is signed out but has un-adopted data, or when the migration is missing** — the
   owner can train on Tuesday whatever state Supabase is in; everything is adopted on the first signed-in visit.
4. **Adoption moves, with a backup** — `adoptLocalData` merges `unconfigured` into the project copy (LWW), queues every
   row that won, keeps the source under `…:unconfigured:adopted` and clears it, so "un-adopted data exists" is simply
   "the `unconfigured` copy has rows". Since 2026-11-09 it takes every other stored copy once the account is confirmed,
   including copies kept under an earlier Supabase project (the planned cutover) with their queued upserts; a viewer's
   mirror is never adopted, and a rerun after a partly failed clear does not queue rows twice.
5. **Default settings are stamped 1970-01-01** — they lose every LWW comparison and are never queued or adopted, so a
   fresh device can never overwrite real settings, even offline before its first pull.
6. **Offline writer cache** (`…:writer`): the phone in a basement gym cannot call the rpc; the owner must still log.
   RLS stays the real gate.
7. **Permanent vs. retryable errors**: only data/integrity errors drop a row; configuration problems keep the queue and
   show in the mode note. Since 2026-11-09 a row the server refuses for itself (a 4xx such as an RLS refusal) counts a
   try only while other rows of its table go through; at `MAX_TRIES` (5) it moves to the capped `…:dead` log and stays
   in this browser, so one stuck row never holds the queue. Outages and 5xx answers never count. Sets wait while their
   session has not uploaded, because the `(session_id, user_id)` FK would refuse them.
8. **One store per tab** (module singleton in the provider): page navigations do not re-pull; a pull runs on attach
   when the last one is older than 60 s, and on tab focus.
9. **Cross-tab**: `storage` events merge the other tab's snapshot and outbox (union, latest wins) instead of overwriting.
10. **`store.ts` uses only erasable TypeScript** so `node --test` can import it through type stripping.
11. **Page navigation keeps the decision**: each page mounts its own `AuthProvider`, so auth passes through `loading`
    on every client-side navigation; `attach` ignores that once the tab has decided and compares the settled state, so
    the tracker never flickers to read-only and no extra rpc/pull runs within a minute.
12. **Gym offline**: a known writer is writable at once and stays writable when the rpc cannot be reached; the queue
    survives reloads. A full *reload* offline still needs the auth library chunk: keep the train page open, or use
    "Save on this phone" (the service worker then caches the chunks).
13. **Trade-off of the signed-out local rule**: anyone (not only the owner) who logged sets while the migration was
    missing keeps a local planner when signed out, instead of the viewer page, until that data is adopted (owner signs
    in) or site data is cleared. The window is short and the fitness section is new.
14. **Offline gym, backend memory** (2026-11-08; `tests/fitness/store-offline.test.mjs`). `…:backend` = `missing`
    after a mode-decision rpc (`fitness_can_write`, `fitness_owner_id`) fails with a schema error; any answer from
    either removes it; a storage that throws just means no memory. With it, an unconfirmed signed-in account and a
    signed-out visit start `local` (`backend-missing`) at once, no loading step, and re-check in the background: schema
    error or no answer → stay local; `can_write` true → `synced` (adopts once), false → `viewer` (rows wait in
    `unconfigured`); signed out, an owner answer → `viewer`, or `local` (`signed-out`) with un-adopted rows. Without
    it, an unconfirmed account whose check gets no answer logs locally (`offline`: "Saved in this browser only for
    now…"), since 2026-11-09 even with no rows here (the owner on a new phone in a gym with no signal), unless the
    browser holds someone else's log or the account was refused in this tab. Signed-out page loads ask again at most
    once an hour while `backend=missing` (`…:backend-at`); signing in or out asks at once. Confirmed writers are unchanged. Every branch enters
    through `enterLocal` (settings bootstrap + 6 h auto-close once on entry). Its two open items (an expired token
    offline; deciding again on reconnect) are closed by decision 15.
15. **Offline gym, expired session; deciding again online** (2026-11-08). With an expired access token and no signal,
    supabase-js (auth-js 2.117) keeps its session in `localStorage["ilyadays-auth:<project>"]` and the site reports
    nobody signed in; a sign-out, or a refused refresh token once the access token expired, removes it. The site also
    ignores `TOKEN_REFRESHED`, so it reports the account again only after the next `SIGNED_IN` (tab shown) or a
    reload. When the stored session belongs to this device's confirmed writer (`…:writer`) and has a refresh token, a
    signed-out visit is `synced` as that account with `status.awaitingSession` ("Editing offline — …"): writes queue
    under the account, nothing is sent. `getSession()` is asked on entry, on `online`/tab shown, when another tab
    changes the session, and on the 30 s tick once supabase-js stored a fresh token; a valid session for the account
    resumes the normal check (pull, then one upload). A missing, foreign or refresh-less session is the usual
    signed-out decision. Every synced pull and flush first checks that supabase-js holds the account's valid session:
    without one it sends the anon key, and RLS quietly matches a remove or settings update to no rows, which used to
    clear it from the outbox as uploaded; now it stays queued (`offline:` / `auth:`). On `online` and tab shown, a mode
    that rests on no answer (`local` `offline` / `backend-missing`, a viewer whose check got none, the awaiting
    session) is decided again with the current mode kept on screen: coalesced over 300 ms, at most once per 10 s, never
    while the browser reports offline or a decision request is still out, and never on its own.

16. **Store and security review** (2026-11-09; `tests/fitness/store-flush.test.mjs`, `store-sql-guard.test.mjs`).
    - While auth loads, the device's writer session, a remembered missing migration or rows logged here decide the mode
      at once, marked `status.provisional` and confirmed when auth settles. Without any of them the note says
      `checking`. A decision gets 10 s (`DECIDE_TIMEOUT_MS`), then counts as no answer; a late answer still decides.
    - A confirmed writer stays `synced` on a schema error, because PostgREST's schema cache can return one right after
      a migration; switching to the local copy would hide the session's rows mid-workout.
    - The writer key is cleared only for the account the server refused, so another account signing in on the owner's
      phone cannot take away its offline logging.
    - A pull protects every row that was pending when it started, even if it uploaded while the pull ran.
    - The owner's first profile is created only after `fitness_owner_id` answers, so a failed check can never make the
      site admin a non-owner.
    - The fitness migration refuses to install where `public.ilyadays_admins` is missing: in a shared project another
      app's `is_admin()` would let its admins write and become the owner. The 30th SQL check confirms writes go
      through the ilyadays admin table.
    - Mapper edges: the bodyweight is checked against the CHECK range after rounding to 2 decimals (a session sends
      it empty rather than failing as a whole), and text is clipped by code point, never inside an emoji.
    - Remaining risks: signing in as the owner on someone else's browser adopts that browser's local rows (rows do not
      record who logged them); dead-lettered rows are listed in `…:dead` but not shown again after a reload; a
      signed-out visitor may take up to an hour (or until the tab is shown again) to notice a newly applied migration.

## Supabase setup for the owner (exact steps)

1. **Admin migration** (skip if `public.ilyadays_admins` exists — it does if the Istanbul map lets you edit): SQL Editor
   → run `supabase/migrations/20261006110000_ilyadays_admin.sql`. Make sure your account is an admin
   (`INSERT INTO public.ilyadays_admins (user_id) VALUES ('<your auth uuid>');`, see `docs/supabase-cutover.md`).
2. **Fitness migration**: SQL Editor → run `supabase/migrations/20261108120000_fitness.sql` (idempotent). It creates
   the profile table and seven data tables, RLS, triggers, `fitness_can_write()`, `fitness_owner_id()`,
   `fitness_close_stale_sessions()`, and adds sessions/sets/exercise_state/bodyweight to `supabase_realtime`.
3. **Sign in once** on the live site (header → Sign in) on the phone you train with.
4. **Owner profile**: created automatically on the first signed-in fitness page view (admin only). Fallbacks: the
   "Create my fitness profile" button in the note at the top of fitness pages, or SQL Editor:
   ```sql
   INSERT INTO public.fitness_profiles (user_id, display_name, is_owner)
   VALUES ('<your auth user uuid>'::uuid, 'Ilya', true)
   ON CONFLICT (user_id) DO UPDATE SET is_owner = true;
   ```
5. **Verify** in SQL Editor (SQL Editor does not impersonate your browser user, so `fitness_can_write()` is only
   meaningful through the site's note; `fitness_owner_id()` works anywhere):
   ```sql
   SELECT public.fitness_owner_id();                                  -- your uuid, not null
   SELECT user_id, display_name, is_owner, settings FROM public.fitness_profiles;
   SELECT id, day_key, status, started_at, ended_at FROM public.fitness_sessions ORDER BY started_at DESC LIMIT 5;
   SELECT count(*) FROM public.fitness_sets;
   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'fitness_%';
   ```
   In the browser: signed in, the note reads "Editing — saved to your account" and the pending count drains to 0; a
   private window reads "You are viewing Ilya's plan and log". Anything logged earlier ("Saved in this browser only")
   is adopted and uploaded on the first signed-in visit.
6. **Friends later**: `INSERT INTO public.fitness_profiles (user_id, display_name) VALUES ('<uuid>', 'Name');`.

## Acceptance checks

- `node --test tests/fitness/store-core.test.mjs tests/fitness/store-sync.test.mjs` passes.
- `npx tsc --noEmit` passes for the whole repo; `npx eslint` clean on the owned files.
- Reducers never mutate input; untouched tables keep identity.
- `fromRemote(toRemote(row))` equals the row for every table (column tables up to the server's `updatedAt`).
- Malformed storage (bad JSON, rows missing ids, unknown tables in the outbox) loads filtered, never throws.
- Local data under `unconfigured` is adopted into the project copy with one outbox entry per row.

## Status

Done (2026-11-08). Delivered A–E plus `tests/fitness/store-sync.test.mjs`: 39 core + 29 sync tests pass
(`node --test tests/fitness/store-core.test.mjs tests/fitness/store-sync.test.mjs`); `npx eslint` clean on every owned
file; `npx tsc --noEmit` clean for these files (the only repo error is a stale `.next/types/validator.ts` reference to a
removed `src/app/(en)/fitness/zz-probe/page.js`, not this stream). Verified against stream 03's `buildProgram()` for
2/3/4 days: rows pass `isRow`, carry UUIDs, and round-trip through `toRemote`/`fromRemote` exactly.
Not done (later streams): a "reset local copy" action, unit toggle, per-user viewer selection (stream 11).

Review 2026-11-09 (decision 16 and the updates to decisions 4, 7 and 14): 15 findings fixed, two of them blockers
(read-only while auth loaded; one refused row stalling the whole queue). Store tests: store-core 46, store-sync 32,
store-offline 40, store-flush 10, store-sql-guard 1, plus `bash scripts/fitness-sql-check.sh` with 30 checks. A
288-case probe (owner, stranger, signed out, expired stored session × writer key × backend memory × local rows ×
mirror × network up, down or schema-missing) found no broken invariant.

## Open questions

1. Resolved: `Program.active?: boolean` is declared in `types.ts` and maps to `fitness_programs.active`. To archive a
   program, upsert `{ ...program, active: false }`; omitted `active` keeps legacy programs active.
2. All ids must be UUIDs (see Contract). Stream 03's `buildProgram` already uses `newId()` (UUID); stream 05 (gyms),
   04 (sessions, sets), 06 (weigh-ins) and 10 (adjustments) must too — a slug id keeps that row local-only.
3. `Adjustment.at` maps to `created_at` (no separate column).
4. Visitors can read the owner's `settings` jsonb (bodyweight, height, birth year, sex) because `fitness_profiles` is
   world-readable. If that is too much, move personal fields to a private column; the mapper change is local here.
5. Resolved: `FitnessShell` renders `<ModeNote>` once under the nav; views must not render it themselves.
