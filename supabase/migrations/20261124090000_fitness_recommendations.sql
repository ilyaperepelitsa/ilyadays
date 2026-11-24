-- Every recommendation the engine made, one row per exercise and session: a flat, queryable view over the engine rows of
-- fitness_adjustments (the app writes them; it works without this view). security_invoker keeps that table's Row Level
-- Security: your own rows, plus those of profiles that chose to be public. Safe to run again.
BEGIN;
CREATE OR REPLACE VIEW public.fitness_recommendations WITH (security_invoker = true) AS
SELECT a.user_id,
       a.id AS adjustment_id,
       s.id AS session_id,
       a.input ->> 'dayKey' AS day_key,
       coalesce((a.input ->> 'deload')::boolean, false) AS deload,
       r.item ->> 'exerciseId' AS exercise_id,
       r.item ->> 'slotId' AS slot_id,
       r.item ->> 'outcome' AS outcome,
       (r.item #>> '{from,kg}')::numeric AS from_kg,
       (r.item #>> '{from,reps}')::numeric AS from_reps,
       (r.item #>> '{to,kg}')::numeric AS to_kg,
       (r.item #>> '{to,reps}')::numeric AS to_reps,
       (r.item #>> '{to,rir}')::numeric AS to_rir,
       r.item #>> '{note,en}' AS reason_en,
       r.item #>> '{note,ru}' AS reason_ru,
       a.applied,
       a.created_at AS recommended_at
  FROM public.fitness_adjustments a
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.output -> 'recommendations') = 'array'
                                               THEN a.output -> 'recommendations' ELSE '[]'::jsonb END) AS r(item)
  LEFT JOIN public.fitness_sessions s ON s.id::text = a.input ->> 'sessionId' AND s.user_id = a.user_id
 WHERE a.source = 'engine' AND a.input ->> 'kind' = 'session';
COMMENT ON VIEW public.fitness_recommendations IS
  'What the engine recommended after each session, per exercise: targets before and after, outcome and reason.';
REVOKE ALL ON public.fitness_recommendations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fitness_recommendations TO anon, authenticated;
CREATE INDEX IF NOT EXISTS fitness_adjustments_session ON public.fitness_adjustments (user_id, (input ->> 'sessionId'))
 WHERE source = 'engine';
COMMIT;
