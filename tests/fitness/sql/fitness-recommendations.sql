-- The recommendations view: own rows only, strangers and anon see nothing of a private profile, malformed rows are skipped.
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id) VALUES ('00000000-0000-4000-8000-0000000000a1'), ('00000000-0000-4000-8000-0000000000a2') ON CONFLICT DO NOTHING;
INSERT INTO public.fitness_profiles (user_id, is_public) VALUES
  ('00000000-0000-4000-8000-0000000000a1', false), ('00000000-0000-4000-8000-0000000000a2', false) ON CONFLICT DO NOTHING;
INSERT INTO public.fitness_sessions (id, user_id, day_key, started_at, status) VALUES
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'A', now() - interval '1 day', 'finished');
INSERT INTO public.fitness_adjustments (id, user_id, source, input, output, applied) VALUES
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 'engine',
   '{"kind":"session","sessionId":"00000000-0000-4000-8000-0000000000b1","dayKey":"A","deload":false}',
   '{"recommendations":[{"exerciseId":"lat-pulldown","slotId":"A2","outcome":"progressed","from":{"kg":30,"reps":8},"to":{"kg":35,"reps":6,"rir":2},"note":{"en":"x","ru":"y"}},{"exerciseId":"pec-deck","slotId":"A3","outcome":"held","from":null,"to":{"kg":20,"reps":10,"rir":1},"note":{"en":"x","ru":"y"}}]}', true),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', 'engine', '{"kind":"session","sessionId":"nonsense"}', '{"recommendations":"nonsense"}', true),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', 'manual', '{}', '{"lines":[]}', true);
CREATE FUNCTION pg_temp.seen(who text, uid text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', uid, true);
  EXECUTE format('SET LOCAL ROLE %I', who);
  SELECT count(*) INTO n FROM public.fitness_recommendations WHERE user_id = '00000000-0000-4000-8000-0000000000a1';
  RESET ROLE;
  RETURN n;
END $$;
DO $$ BEGIN
  IF pg_temp.seen('authenticated', '00000000-0000-4000-8000-0000000000a1') <> 2 THEN RAISE EXCEPTION 'FAIL the owner sees their own recommendations'; END IF;
  IF pg_temp.seen('authenticated', '00000000-0000-4000-8000-0000000000a2') <> 0 THEN RAISE EXCEPTION 'FAIL a stranger sees a private profile'; END IF;
  IF pg_temp.seen('anon', '') <> 0 THEN RAISE EXCEPTION 'FAIL anon sees a private profile'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fitness_recommendations WHERE exercise_id = 'lat-pulldown' AND from_kg = 30 AND to_kg = 35
                  AND session_id = '00000000-0000-4000-8000-0000000000b1') THEN RAISE EXCEPTION 'FAIL the values'; END IF;
  RAISE NOTICE 'ok   recommendations view: values, own rows, strangers and anon';
END $$;
ROLLBACK;
