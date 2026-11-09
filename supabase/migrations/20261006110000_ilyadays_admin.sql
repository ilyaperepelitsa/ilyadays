-- Dedicated ilyadays project only. Run before 20261006120000_trip_state.sql.
-- Do not install into Typekana: its existing is_admin() must remain untouched.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NOT NULL
     AND to_regclass('public.ilyadays_admins') IS NULL THEN
    RAISE EXCEPTION 'Existing is_admin() belongs to another app. Use a fresh ilyadays Supabase project.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ilyadays_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.ilyadays_admins IS 'ilyadays editors. Grant membership through SQL Editor only.';
ALTER TABLE public.ilyadays_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ilyadays_admins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ilyadays_admins WHERE user_id = (SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMIT;
