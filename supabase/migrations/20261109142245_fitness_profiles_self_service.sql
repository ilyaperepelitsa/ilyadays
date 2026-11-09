-- Self-service accounts are private by default. Existing owner visibility is preserved.
BEGIN;
ALTER TABLE public.fitness_profiles ALTER COLUMN is_public SET DEFAULT false;

DROP POLICY IF EXISTS "fitness_profiles readable by everyone" ON public.fitness_profiles;
DROP POLICY IF EXISTS "fitness_profiles visible profiles" ON public.fitness_profiles;
CREATE POLICY "fitness_profiles visible profiles" ON public.fitness_profiles
  FOR SELECT TO anon, authenticated USING (user_id = (SELECT auth.uid()) OR is_public);

-- Direct client updates are for settings only. Ownership is never a profile preference.
REVOKE UPDATE ON public.fitness_profiles FROM authenticated;
GRANT UPDATE (settings) ON public.fitness_profiles TO authenticated;
DROP POLICY IF EXISTS "fitness_profiles update own" ON public.fitness_profiles;
CREATE POLICY "fitness_profiles update own" ON public.fitness_profiles
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- This intentionally exposed operation creates only the authenticated caller's non-owner PRIVATE row.
-- The optional expected identity only detects client account races; auth.uid() is always the write target.
-- No role, visibility, settings or SQL is accepted from the caller.
CREATE OR REPLACE FUNCTION public.fitness_register_profile(display_name text, expected_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); p public.fitness_profiles; made boolean := false;
BEGIN
  IF uid IS NULL OR (expected_user_id IS NOT NULL AND uid <> expected_user_id) THEN RAISE EXCEPTION 'Sign in with the expected account to create a profile' USING ERRCODE = '42501'; END IF;
  IF display_name IS NULL OR char_length(btrim(display_name)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Display name must be 1–80 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fitness_profiles (user_id, display_name, is_owner, is_public)
    VALUES (uid, btrim(display_name), false, false) ON CONFLICT (user_id) DO NOTHING;
  made := FOUND;
  SELECT * INTO p FROM public.fitness_profiles WHERE user_id = uid;
  RETURN jsonb_build_object('created', made, 'display_name', p.display_name, 'is_owner', p.is_owner, 'is_public', p.is_public);
END $$;
REVOKE ALL ON FUNCTION public.fitness_register_profile(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fitness_register_profile(text, uuid) TO authenticated;

-- Explicit own-account visibility/name changes. Cannot transfer a row or alter its ownership role.
CREATE OR REPLACE FUNCTION public.fitness_update_profile(display_name text, is_public boolean, expected_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); p public.fitness_profiles;
BEGIN
  IF uid IS NULL OR (expected_user_id IS NOT NULL AND uid <> expected_user_id) THEN RAISE EXCEPTION 'Sign in with the expected account to edit a profile' USING ERRCODE = '42501'; END IF;
  IF display_name IS NULL OR char_length(btrim(display_name)) NOT BETWEEN 1 AND 80 OR is_public IS NULL THEN
    RAISE EXCEPTION 'A name and explicit visibility are required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.fitness_profiles AS fp SET display_name = btrim(fitness_update_profile.display_name),
    is_public = fitness_update_profile.is_public WHERE fp.user_id = uid RETURNING * INTO p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your profile first' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('display_name', p.display_name, 'is_owner', p.is_owner, 'is_public', p.is_public);
END $$;
REVOKE ALL ON FUNCTION public.fitness_update_profile(text, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fitness_update_profile(text, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fitness_owner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT user_id FROM public.fitness_profiles
  WHERE is_owner AND (is_public OR user_id = (SELECT auth.uid())) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fitness_owner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fitness_owner_id() TO anon, authenticated;


-- Circumference observations are independent of weigh-ins and belong to the same private account.
CREATE OR REPLACE FUNCTION public.fitness_measurement_values_valid(payload jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(payload) = 'object' AND payload <> '{}'::jsonb
    AND NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(payload)='object' THEN payload ELSE '{}'::jsonb END) AS v
      WHERE v.key NOT IN ('waist','chest','hips','neck','left-biceps','right-biceps','left-forearm','right-forearm','left-thigh','right-thigh','left-calf','right-calf')
        OR CASE WHEN jsonb_typeof(v.value) = 'number' THEN v.value::numeric <= 0 OR v.value::numeric > 300 ELSE true END);
$$;
REVOKE ALL ON FUNCTION public.fitness_measurement_values_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fitness_measurement_values_valid(jsonb) TO authenticated;
CREATE TABLE IF NOT EXISTS public.fitness_measurements (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  "values" jsonb NOT NULL CHECK (public.fitness_measurement_values_valid("values")),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fitness_measurements_user_at ON public.fitness_measurements (user_id, measured_at DESC);
ALTER TABLE public.fitness_measurements ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS fitness_measurements_touch ON public.fitness_measurements;
CREATE TRIGGER fitness_measurements_touch BEFORE INSERT OR UPDATE ON public.fitness_measurements
  FOR EACH ROW EXECUTE FUNCTION public.fitness_touch();
DROP POLICY IF EXISTS "fitness_measurements insert own" ON public.fitness_measurements;
CREATE POLICY "fitness_measurements insert own" ON public.fitness_measurements FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()) AND (SELECT public.fitness_can_write()));
DROP POLICY IF EXISTS "fitness_measurements update own" ON public.fitness_measurements;
CREATE POLICY "fitness_measurements update own" ON public.fitness_measurements FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid()) AND (SELECT public.fitness_can_write()))
  WITH CHECK (user_id=(SELECT auth.uid()) AND (SELECT public.fitness_can_write()));
DROP POLICY IF EXISTS "fitness_measurements delete own" ON public.fitness_measurements;
CREATE POLICY "fitness_measurements delete own" ON public.fitness_measurements FOR DELETE TO authenticated
  USING (user_id=(SELECT auth.uid()) AND (SELECT public.fitness_can_write()));
REVOKE ALL ON public.fitness_measurements FROM anon, authenticated;
GRANT SELECT ON public.fitness_measurements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_measurements TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fitness_programs', 'fitness_gyms', 'fitness_sessions', 'fitness_sets',
    'fitness_exercise_state', 'fitness_bodyweight', 'fitness_measurements', 'fitness_adjustments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' readable by everyone', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' visible profiles', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING
      (user_id = (SELECT auth.uid()) OR user_id IN (SELECT p.user_id FROM public.fitness_profiles p WHERE p.is_public))',
      t || ' visible profiles', t);
  END LOOP;
END $$;
COMMIT;
