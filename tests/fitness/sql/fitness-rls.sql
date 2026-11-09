-- Row Level Security checks for supabase/migrations/20261108120000_fitness.sql.
-- Run by scripts/fitness-sql-check.sh after the stub and the three migrations. Any failed check raises.
\set ON_ERROR_STOP 1

CREATE OR REPLACE FUNCTION pg_temp.as_user(role_name text, uid text, stmt text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', role_name);
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.ok(label text, role_name text, uid text, stmt text, expect_rows bigint DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  n := pg_temp.as_user(role_name, uid, stmt);
  IF expect_rows IS NOT NULL AND n <> expect_rows THEN
    RAISE EXCEPTION 'FAIL % — expected % row(s), got %', label, expect_rows, n;
  END IF;
  RAISE NOTICE 'ok   %', label;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.denied(label text, role_name text, uid text, stmt text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM pg_temp.as_user(role_name, uid, stmt);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR unique_violation OR foreign_key_violation OR raise_exception THEN
    RESET ROLE;
    RAISE NOTICE 'ok   % (denied: %)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL % — statement was allowed', label;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.scalar(role_name text, uid text, q text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', role_name);
  EXECUTE q INTO v;
  RESET ROLE;
  RETURN v;
END $$;

-- three people: the owner (site admin), a friend (enabled later), a stranger
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'friend@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'stranger@example.com');
INSERT INTO public.ilyadays_admins (user_id) VALUES ('11111111-1111-1111-1111-111111111111');

\set owner '11111111-1111-1111-1111-111111111111'
\set friend '22222222-2222-2222-2222-222222222222'
\set stranger '33333333-3333-3333-3333-333333333333'

BEGIN;
-- visitors read, never write
SELECT pg_temp.ok('anon reads sessions', 'anon', NULL, 'SELECT * FROM public.fitness_sessions');
SELECT pg_temp.denied('anon cannot insert a session', 'anon', NULL,
  $q$INSERT INTO public.fitness_sessions (id, user_id, day_key, started_at) VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'A', now())$q$);
SELECT pg_temp.denied('anon cannot call fitness_can_write', 'anon', NULL, 'SELECT public.fitness_can_write()');
-- a stranger with an account cannot write anything
SELECT pg_temp.denied('stranger cannot insert a session', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_sessions (id, day_key, started_at) VALUES (gen_random_uuid(), 'A', now())$q$);
SELECT pg_temp.denied('stranger cannot create a profile', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_profiles (user_id, display_name) VALUES ('33333333-3333-3333-3333-333333333333', 'me')$q$);
DO $$ BEGIN IF pg_temp.scalar('authenticated', '33333333-3333-3333-3333-333333333333', 'SELECT public.fitness_can_write()::text') <> 'false' THEN RAISE EXCEPTION 'FAIL stranger can write'; END IF; RAISE NOTICE 'ok   stranger fitness_can_write() = false'; END $$;
-- the owner bootstraps a profile and logs
DO $$ BEGIN IF pg_temp.scalar('authenticated', '11111111-1111-1111-1111-111111111111', 'SELECT public.fitness_can_write()::text') <> 'true' THEN RAISE EXCEPTION 'FAIL owner cannot write'; END IF; RAISE NOTICE 'ok   owner fitness_can_write() = true'; END $$;
SELECT pg_temp.ok('owner creates own owner profile', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_profiles (user_id, display_name, is_owner) VALUES ('11111111-1111-1111-1111-111111111111', 'Ilya', true)$q$, 1);
SELECT pg_temp.ok('owner inserts a session (user_id defaults to auth.uid())', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_sessions (id, day_key, started_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'A', now() - interval '1 hour')$q$, 1);
SELECT pg_temp.denied('owner cannot insert a row for someone else', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_sessions (id, user_id, day_key, started_at) VALUES (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'A', now())$q$);
SELECT pg_temp.ok('owner inserts a set', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_sets (id, session_id, slot_id, exercise_id, set_index, kind, planned_kg, planned_reps, kg, reps, rir, done_at)
     VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A1', 'machine-chest-press', 0, 'working', 40, 10, 40, 10, 2, now())$q$, 1);
SELECT pg_temp.ok('owner upserts a set (offline outbox replay is idempotent)', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_sets (id, session_id, slot_id, exercise_id, set_index, kind, planned_kg, planned_reps, kg, reps, rir, done_at)
     VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A1', 'machine-chest-press', 0, 'working', 40, 10, 40, 11, 1, now())
     ON CONFLICT (id) DO UPDATE SET reps = excluded.reps, rir = excluded.rir$q$, 1);
SELECT pg_temp.ok('owner inserts program, gym, state, weigh-in, adjustment', 'authenticated', :'owner',
  $q$WITH p AS (INSERT INTO public.fitness_programs (id, spec) VALUES (gen_random_uuid(), '{}'::jsonb) RETURNING 1),
          g AS (INSERT INTO public.fitness_gyms (id, spec) VALUES (gen_random_uuid(), '{}'::jsonb) RETURNING 1),
          s AS (INSERT INTO public.fitness_exercise_state (exercise_id, spec) VALUES ('machine-chest-press', '{}'::jsonb) RETURNING 1),
          b AS (INSERT INTO public.fitness_bodyweight (id, measured_at, weight_kg) VALUES (gen_random_uuid(), now(), 84.2) RETURNING 1),
          a AS (INSERT INTO public.fitness_adjustments (id, source) VALUES (gen_random_uuid(), 'manual') RETURNING 1)
     SELECT 1 FROM p, g, s, b, a$q$);
SELECT pg_temp.denied('check constraint rejects negative reps', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_sets (id, session_id, slot_id, exercise_id, set_index, kg, reps, done_at)
     VALUES (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'A1', 'machine-chest-press', 1, 40, -1, now())$q$);
SELECT pg_temp.denied('exercise id must be kebab-case', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_exercise_state (exercise_id, spec) VALUES ('Bad Id', '{}'::jsonb)$q$);
-- visitors see the owner's data
DO $$ BEGIN IF pg_temp.scalar('anon', NULL, 'SELECT public.fitness_owner_id()::text') <> '11111111-1111-1111-1111-111111111111' THEN RAISE EXCEPTION 'FAIL fitness_owner_id'; END IF; RAISE NOTICE 'ok   anon fitness_owner_id() = owner'; END $$;
DO $$ BEGIN IF pg_temp.scalar('anon', NULL, 'SELECT count(*)::text FROM public.fitness_sets') <> '1' THEN RAISE EXCEPTION 'FAIL anon cannot see the set'; END IF; RAISE NOTICE 'ok   anon sees the owner''s set'; END $$;
-- a stranger cannot change the owner's rows (RLS hides them from UPDATE/DELETE: 0 rows)
SELECT pg_temp.ok('stranger update of owner session touches 0 rows', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_sessions SET notes = 'hacked'$q$, 0);
SELECT pg_temp.ok('stranger delete of owner set touches 0 rows', 'authenticated', :'stranger',
  $q$DELETE FROM public.fitness_sets$q$, 0);
SELECT pg_temp.ok('stranger update of owner profile touches 0 rows', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_profiles SET display_name = 'x'$q$, 0);
-- the owner enables a friend in SQL Editor (superuser here)
RESET ROLE;
INSERT INTO public.fitness_profiles (user_id, display_name) VALUES ('22222222-2222-2222-2222-222222222222', 'Friend');
SELECT pg_temp.ok('friend inserts own session', 'authenticated', :'friend',
  $q$INSERT INTO public.fitness_sessions (id, day_key, started_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'A', now() - interval '7 hours')$q$, 1);
SELECT pg_temp.ok('friend cannot touch owner sessions (0 rows)', 'authenticated', :'friend',
  $q$UPDATE public.fitness_sessions SET notes = 'x' WHERE user_id = '11111111-1111-1111-1111-111111111111'$q$, 0);
SELECT pg_temp.denied('friend cannot make themselves the owner', 'authenticated', :'friend',
  $q$UPDATE public.fitness_profiles SET is_owner = true WHERE user_id = '22222222-2222-2222-2222-222222222222'$q$);
SELECT pg_temp.denied('friend cannot attach a set to the owner''s session', 'authenticated', :'friend',
  $q$INSERT INTO public.fitness_sets (id, session_id, slot_id, exercise_id, set_index, kg, reps, done_at)
     VALUES (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'A1', 'machine-chest-press', 5, 40, 10, now())$q$);
-- auto-close after 6 hours, own sessions only
SELECT pg_temp.ok('owner stale session for the close test', 'authenticated', :'owner',
  $q$INSERT INTO public.fitness_sessions (id, day_key, started_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'B', now() - interval '8 hours')$q$, 1);
DO $$ BEGIN IF pg_temp.scalar('authenticated', '11111111-1111-1111-1111-111111111111', 'SELECT public.fitness_close_stale_sessions()::text') <> '1' THEN RAISE EXCEPTION 'FAIL close_stale did not close exactly 1'; END IF; RAISE NOTICE 'ok   owner close_stale closed 1 (own stale session only)'; END $$;
DO $$ DECLARE st text; en timestamptz; sa timestamptz; BEGIN
  SELECT status, ended_at, started_at INTO st, en, sa FROM public.fitness_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000003';
  IF st <> 'auto_closed' OR en <> sa + interval '6 hours' THEN RAISE EXCEPTION 'FAIL auto-close fields: % %', st, en - sa; END IF;
  SELECT status INTO st FROM public.fitness_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';
  IF st <> 'active' THEN RAISE EXCEPTION 'FAIL friend session was closed by the owner'; END IF;
  SELECT status INTO st FROM public.fitness_sessions WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF st <> 'active' THEN RAISE EXCEPTION 'FAIL a fresh session was closed'; END IF;
  RAISE NOTICE 'ok   auto_closed with ended_at = started_at + 6 h; others untouched'; END $$;
-- New metadata uses the same ownership policies as existing session and set fields.
SELECT pg_temp.ok('owner saves frozen workout context', 'authenticated', :'owner',
  $q$UPDATE public.fitness_sessions SET plan = '{"version":1,"prescription":{"exercises":[]}}'::jsonb
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 1);
SELECT pg_temp.ok('owner saves set suggestion provenance', 'authenticated', :'owner',
  $q$UPDATE public.fitness_sets SET prescription = '{"version":1,"targetRir":2,"rirReported":true,"suggestedKg":20,"suggestedReps":8}'::jsonb$q$, 1);
SELECT pg_temp.ok('stranger cannot change frozen plan', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_sessions SET plan = '{}'::jsonb$q$, 0);
SELECT pg_temp.ok('stranger cannot change suggestion provenance', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_sets SET prescription = '{}'::jsonb$q$, 0);
DO $$ BEGIN
  IF pg_temp.scalar('anon', NULL, 'SELECT prescription->>''suggestedReps'' FROM public.fitness_sets LIMIT 1') <> '8'
    THEN RAISE EXCEPTION 'FAIL suggestion metadata round trip'; END IF;
  RAISE NOTICE 'ok   public suggestion metadata retains effective target';
END $$;
-- only one owner
SELECT pg_temp.denied('a second owner is rejected', 'postgres', NULL,
  $q$UPDATE public.fitness_profiles SET is_owner = true WHERE user_id = '22222222-2222-2222-2222-222222222222'$q$);
COMMIT;

-- realtime publication membership
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('fitness_sessions', 'fitness_sets', 'fitness_exercise_state', 'fitness_bodyweight')) <> 4 THEN
    RAISE EXCEPTION 'FAIL realtime publication is missing fitness tables'; END IF;
  RAISE NOTICE 'ok   realtime publication includes sessions, sets, state, bodyweight'; END $$;
-- the install guard's premise (the migration refuses a project without public.ilyadays_admins, where is_admin() would be
-- another app's; tests/fitness/store-sql-guard.test.mjs runs that refusal on a fresh database): writes go through ilyadays' own admin list
DO $$ BEGIN
  IF to_regclass('public.ilyadays_admins') IS NULL
     OR pg_get_functiondef('public.is_admin()'::regprocedure) NOT LIKE '%public.ilyadays_admins%'
     OR pg_get_functiondef('public.fitness_can_write()'::regprocedure) NOT LIKE '%public.is_admin()%' THEN
    RAISE EXCEPTION 'FAIL fitness writes are not gated by ilyadays_admins'; END IF;
  RAISE NOTICE 'ok   fitness writes are gated by ilyadays'' own is_admin() (ilyadays_admins)'; END $$;
