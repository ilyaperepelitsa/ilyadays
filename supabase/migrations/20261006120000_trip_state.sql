-- ============================================================================
-- ilyadays.com travel progress: public.trip_state
-- Date: 2026-10-06 · Project: TypeKana's Supabase project (shared)
-- ============================================================================
--
-- One row per (trip, key): the Istanbul app saves each top-level piece of the owner's progress separately
-- (visited, ideas, dayOrder, days, tripStart) as JSON. Everyone — signed in or not — can READ it, so visitors
-- see the progress. Only `public.is_admin()` (TypeKana's admin check, backed by `admin_users`) can WRITE it.
--
-- Requires: public.is_admin() from TypeKana's admin-hardening migration (SECURITY DEFINER, reads admin_users).
-- Safe to re-run: every statement is idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.trip_state (
  trip        text        NOT NULL CHECK (trip ~ '^[a-z0-9-]{1,64}$'),
  key         text        NOT NULL CHECK (key ~ '^[A-Za-z0-9_-]{1,64}$'),
  value       jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip, key)
);

COMMENT ON TABLE public.trip_state IS
  'ilyadays.com trip progress (owner-edited, world-readable). One JSON value per (trip, key).';

-- updated_at on every write
CREATE OR REPLACE FUNCTION public.trip_state_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trip_state_touch ON public.trip_state;
CREATE TRIGGER trip_state_touch
  BEFORE INSERT OR UPDATE ON public.trip_state
  FOR EACH ROW EXECUTE FUNCTION public.trip_state_touch();

-- Row Level Security: read for everyone, write for the admin only.
ALTER TABLE public.trip_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_state readable by everyone" ON public.trip_state;
CREATE POLICY "trip_state readable by everyone" ON public.trip_state
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "trip_state insert by admin" ON public.trip_state;
CREATE POLICY "trip_state insert by admin" ON public.trip_state
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "trip_state update by admin" ON public.trip_state;
CREATE POLICY "trip_state update by admin" ON public.trip_state
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "trip_state delete by admin" ON public.trip_state;
CREATE POLICY "trip_state delete by admin" ON public.trip_state
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Table privileges (RLS still applies on top of these).
REVOKE ALL ON public.trip_state FROM anon, authenticated;
GRANT SELECT ON public.trip_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_state TO authenticated;
REVOKE ALL ON FUNCTION public.trip_state_touch() FROM PUBLIC, anon, authenticated;

-- Live updates for visitors (optional; the site works without it). Realtime respects the SELECT policy above.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_state;
  END IF;
END;
$$;

COMMIT;

-- Check afterwards (as anon via the API, or here):
--   SELECT trip, key, updated_at FROM public.trip_state ORDER BY trip, key;
--   SELECT public.is_admin();   -- true only for the owner's session
