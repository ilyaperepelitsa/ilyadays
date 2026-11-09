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

\set owner '11111111-1111-1111-1111-111111111111'
\set friend '22222222-2222-2222-2222-222222222222'
\set stranger '33333333-3333-3333-3333-333333333333'
-- Runs after legacy RLS checks, so existing owner/friend rows demonstrate upgrade compatibility.
\set ON_ERROR_STOP 1
BEGIN;
SELECT pg_temp.denied('anon cannot register a profile', 'anon', NULL,
  $q$SELECT public.fitness_register_profile('Anonymous')$q$);
SELECT pg_temp.ok('signed-in stranger explicitly registers own private profile', 'authenticated', :'stranger',
  $q$SELECT public.fitness_register_profile('New lifter')$q$, 1);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.fitness_profiles WHERE user_id='33333333-3333-3333-3333-333333333333' AND NOT is_owner AND NOT is_public)
    THEN RAISE EXCEPTION 'FAIL registration did not create private non-owner'; END IF;
  RAISE NOTICE 'ok   self-registration is private and cannot claim site ownership';
END $$;
SELECT pg_temp.denied('registration cannot target the other active account during a token race', 'authenticated', :'stranger',
  $q$SELECT public.fitness_register_profile('Wrong account','22222222-2222-2222-2222-222222222222')$q$);
SELECT pg_temp.denied('profile update cannot follow a token race to another account', 'authenticated', :'stranger',
  $q$SELECT public.fitness_update_profile('Wrong account',true,'22222222-2222-2222-2222-222222222222')$q$);
SELECT pg_temp.ok('repeat registration is idempotent', 'authenticated', :'stranger',
  $q$SELECT public.fitness_register_profile('Another name')$q$, 1);
SELECT pg_temp.denied('profile owner flag cannot be changed by its user', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_profiles SET is_owner=true WHERE user_id='33333333-3333-3333-3333-333333333333'$q$);
SELECT pg_temp.denied('profile cannot transfer user_id', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_profiles SET user_id='11111111-1111-1111-1111-111111111111'$q$);
SELECT pg_temp.denied('direct profile metadata update must use the narrow RPC', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_profiles SET is_public=true$q$);
SELECT pg_temp.ok('own settings remain writable', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_profiles SET settings='{"goal":"strength"}'::jsonb WHERE user_id='33333333-3333-3333-3333-333333333333'$q$, 1);
SELECT pg_temp.ok('new profile logs own private session', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_sessions (id,day_key,started_at) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','A',now())$q$, 1);
SELECT pg_temp.ok('new profile logs own private set', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_sets (id,session_id,slot_id,exercise_id,set_index,kg,reps,done_at)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','A1','machine-chest-press',0,20,8,now())$q$, 1);
SELECT pg_temp.ok('private profile seeds program', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_programs (id,spec) VALUES ('bbbbbbbb-0000-0000-0000-000000000003','{}')$q$, 1);
SELECT pg_temp.ok('private profile seeds gym', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_gyms (id,spec) VALUES ('bbbbbbbb-0000-0000-0000-000000000004','{}')$q$, 1);
SELECT pg_temp.ok('private profile seeds state', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_exercise_state (exercise_id,spec) VALUES ('machine-chest-press','{}')$q$, 1);
SELECT pg_temp.ok('private profile seeds weigh-in', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_bodyweight (id,measured_at,weight_kg) VALUES ('bbbbbbbb-0000-0000-0000-000000000005',now(),80)$q$, 1);
SELECT pg_temp.ok('private profile seeds adjustment', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_adjustments (id,source) VALUES ('bbbbbbbb-0000-0000-0000-000000000006','manual')$q$, 1);
SELECT pg_temp.ok('private circumference without any weigh-in', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_measurements (id,measured_at,"values") VALUES ('bbbbbbbb-0000-0000-0000-000000000007',now(),'{"waist":85,"left-biceps":33}')$q$, 1);
SELECT pg_temp.ok('own circumference update works', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_measurements SET "values"='{"waist":84}' WHERE id='bbbbbbbb-0000-0000-0000-000000000007'$q$, 1);
SELECT pg_temp.ok('another account cannot update private circumference', 'authenticated', :'friend',
  $q$UPDATE public.fitness_measurements SET "values"='{"waist":10}' WHERE id='bbbbbbbb-0000-0000-0000-000000000007'$q$, 0);
SELECT pg_temp.ok('another account cannot delete private circumference', 'authenticated', :'friend',
  $q$DELETE FROM public.fitness_measurements WHERE id='bbbbbbbb-0000-0000-0000-000000000007'$q$, 0);
SELECT pg_temp.denied('circumference insert cannot spoof another user', 'authenticated', :'friend',
  $q$INSERT INTO public.fitness_measurements (id,user_id,measured_at,"values") VALUES (gen_random_uuid(),'33333333-3333-3333-3333-333333333333',now(),'{"waist":80}')$q$);
SELECT pg_temp.denied('circumference cannot transfer ownership', 'authenticated', :'stranger',
  $q$UPDATE public.fitness_measurements SET user_id='22222222-2222-2222-2222-222222222222' WHERE id='bbbbbbbb-0000-0000-0000-000000000007'$q$);
SELECT pg_temp.denied('zero circumference rejected', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_measurements (id,measured_at,"values") VALUES (gen_random_uuid(),now(),'{"waist":0}')$q$);
SELECT pg_temp.denied('implausible circumference rejected', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_measurements (id,measured_at,"values") VALUES (gen_random_uuid(),now(),'{"waist":301}')$q$);
SELECT pg_temp.denied('unknown measurement key rejected', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_measurements (id,measured_at,"values") VALUES (gen_random_uuid(),now(),'{"password":20}')$q$);
SELECT pg_temp.denied('empty measurements rejected', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_measurements (id,measured_at,"values") VALUES (gen_random_uuid(),now(),'{}')$q$);
SELECT pg_temp.denied('text measurement rejected', 'authenticated', :'stranger',
  $q$INSERT INTO public.fitness_measurements (id,measured_at,"values") VALUES (gen_random_uuid(),now(),'{"waist":"85"}')$q$);
DO $$ DECLARE t text; uid text := '33333333-3333-3333-3333-333333333333'; n text; BEGIN
  FOREACH t IN ARRAY ARRAY['fitness_profiles','fitness_programs','fitness_gyms','fitness_sessions','fitness_sets','fitness_exercise_state','fitness_bodyweight','fitness_measurements','fitness_adjustments'] LOOP
    n := pg_temp.scalar('anon',NULL,format('SELECT count(*) FROM public.%I WHERE user_id=%L',t,uid));
    IF n <> '0' THEN RAISE EXCEPTION 'FAIL anon reads private %',t; END IF;
    n := pg_temp.scalar('authenticated','22222222-2222-2222-2222-222222222222',format('SELECT count(*) FROM public.%I WHERE user_id=%L',t,uid));
    IF n <> '0' THEN RAISE EXCEPTION 'FAIL friend reads private %',t; END IF;
    n := pg_temp.scalar('authenticated',uid,format('SELECT count(*) FROM public.%I WHERE user_id=%L',t,uid));
    IF n <> '1' THEN RAISE EXCEPTION 'FAIL private owner cannot read own %',t; END IF;
    RAISE NOTICE 'ok   %: private owner reads own, anon and other account see zero', t;
  END LOOP;
END $$;
SELECT pg_temp.ok('explicit profile sharing affects only own profile', 'authenticated', :'stranger',
  $q$SELECT public.fitness_update_profile('New name',true)$q$, 1);
DO $$ BEGIN
  IF pg_temp.scalar('anon',NULL,'SELECT count(*) FROM public.fitness_sets WHERE user_id=''33333333-3333-3333-3333-333333333333''') <> '1'
    THEN RAISE EXCEPTION 'FAIL explicit sharing not visible'; END IF;
  RAISE NOTICE 'ok   explicit sharing makes the selected profile visible';
END $$;
SELECT pg_temp.ok('sharing can be revoked', 'authenticated', :'stranger',
  $q$SELECT public.fitness_update_profile('New name',false)$q$, 1);
DO $$ BEGIN
  IF pg_temp.scalar('anon',NULL,'SELECT count(*) FROM public.fitness_sets WHERE user_id=''33333333-3333-3333-3333-333333333333''') <> '0'
    THEN RAISE EXCEPTION 'FAIL visibility revocation'; END IF;
  IF pg_temp.scalar('anon',NULL,'SELECT public.fitness_owner_id()::text') <> '11111111-1111-1111-1111-111111111111'
    THEN RAISE EXCEPTION 'FAIL existing public owner hidden by migration'; END IF;
  RAISE NOTICE 'ok   revocation hides private data and preserves existing public owner';
END $$;
SELECT pg_temp.ok('site owner can make their log private', 'authenticated', :'owner',
  $q$SELECT public.fitness_update_profile('Owner',false)$q$, 1);
DO $$ BEGIN
  IF pg_temp.scalar('anon',NULL,'SELECT public.fitness_owner_id()::text') IS NOT NULL
    THEN RAISE EXCEPTION 'FAIL private owner exposed by lookup'; END IF;
  RAISE NOTICE 'ok   private owner lookup returns null to visitors';
END $$;
ROLLBACK;
