-- Preserve the original workout context and the provenance of effective set suggestions.
-- Nullable additions keep existing sessions/sets readable without fabricated history.
begin;
alter table public.fitness_sessions add column if not exists plan jsonb;
alter table public.fitness_sets add column if not exists prescription jsonb;
comment on column public.fitness_sessions.plan is
  'Versioned starting program, gym increments, exercise states and prescription; frozen for replay/evaluation.';
comment on column public.fitness_sets.prescription is
  'Versioned target RIR, whether effort was reported, effective suggested kg/reps, adaptation reason and source set id. planned_kg/reps retain original row targets; kg/reps retain actual performance.';
-- Exercise baselines live in fitness_exercise_state.spec; existing row ownership, grants and RLS apply.
commit;
