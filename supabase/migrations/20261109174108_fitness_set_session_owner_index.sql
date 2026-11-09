-- Cover the existing ownership FK as well as session-local set reads.
create index if not exists fitness_sets_session_owner_idx on public.fitness_sets(session_id, user_id);
