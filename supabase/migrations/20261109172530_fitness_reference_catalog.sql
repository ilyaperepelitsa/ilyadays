-- Additive, versioned public reference catalog. Private workout snapshots remain independent.
create schema if not exists fitness_internal;
revoke all on schema fitness_internal from public, anon, authenticated;
grant usage on schema fitness_internal to service_role;

create table if not exists public.fitness_catalog_versions (
  id text primary key,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  counts jsonb not null check (jsonb_typeof(counts) = 'object'),
  created_at timestamptz not null default now()
);
create table if not exists public.fitness_muscle_groups (
  catalog_version text not null references public.fitness_catalog_versions(id),
  id text not null,
  name jsonb not null,
  region text not null,
  sort_order integer not null,
  primary key (catalog_version, id)
);
create table if not exists public.fitness_muscles (
  catalog_version text not null,
  id text not null,
  group_id text not null,
  name jsonb not null,
  region text not null,
  function_description jsonb not null,
  primary key (catalog_version, id),
  foreign key (catalog_version, group_id) references public.fitness_muscle_groups(catalog_version, id)
);
create index if not exists fitness_muscles_group_idx on public.fitness_muscles(catalog_version, group_id);
create table if not exists public.fitness_equipment_types (
  catalog_version text not null references public.fitness_catalog_versions(id),
  id text not null,
  name jsonb not null,
  is_machine boolean not null,
  primary key (catalog_version, id)
);
create table if not exists public.fitness_goal_modes (
  catalog_version text not null references public.fitness_catalog_versions(id),
  id text not null,
  name jsonb not null,
  prescription jsonb not null,
  primary key (catalog_version, id)
);
create table if not exists public.fitness_machines (
  catalog_version text not null,
  id text not null,
  equipment_id text not null,
  name jsonb not null,
  geometry text not null,
  generic_variant boolean not null default true,
  primary key (catalog_version, id),
  foreign key (catalog_version, equipment_id) references public.fitness_equipment_types(catalog_version, id)
);
create index if not exists fitness_machines_equipment_idx on public.fitness_machines(catalog_version, equipment_id);
create table if not exists public.fitness_exercises (
  catalog_version text not null,
  id text not null,
  equipment_id text not null,
  name jsonb not null,
  pattern text not null,
  details jsonb not null,
  primary key (catalog_version, id),
  foreign key (catalog_version, equipment_id) references public.fitness_equipment_types(catalog_version, id)
);
create index if not exists fitness_exercises_equipment_pattern_idx on public.fitness_exercises(catalog_version, equipment_id, pattern);
create index if not exists fitness_exercises_pattern_idx on public.fitness_exercises(catalog_version, pattern);
create index if not exists fitness_exercises_name_search_idx on public.fitness_exercises using gin
  (to_tsvector('simple'::regconfig, coalesce(name->>'en', '') || ' ' || coalesce(name->>'ru', '')));
create table if not exists public.fitness_exercise_muscles (
  catalog_version text not null,
  exercise_id text not null,
  muscle_id text not null,
  role text not null check (role in ('primary', 'secondary')),
  primary key (catalog_version, exercise_id, muscle_id),
  foreign key (catalog_version, exercise_id) references public.fitness_exercises(catalog_version, id),
  foreign key (catalog_version, muscle_id) references public.fitness_muscles(catalog_version, id)
);
create index if not exists fitness_exercise_muscles_reverse_idx on public.fitness_exercise_muscles(catalog_version, muscle_id, role, exercise_id);
create table if not exists public.fitness_exercise_machines (
  catalog_version text not null,
  exercise_id text not null,
  machine_id text not null,
  configuration jsonb not null,
  primary key (catalog_version, exercise_id, machine_id),
  foreign key (catalog_version, exercise_id) references public.fitness_exercises(catalog_version, id),
  foreign key (catalog_version, machine_id) references public.fitness_machines(catalog_version, id)
);
create index if not exists fitness_exercise_machines_reverse_idx on public.fitness_exercise_machines(catalog_version, machine_id, exercise_id);

-- Generation/review specs are backend-only. Nothing here grants end-user administrative rights.
create table if not exists fitness_internal.image_specs (
  catalog_version text not null,
  exercise_id text not null,
  machine_id text not null,
  spec_version text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  spec jsonb not null check (jsonb_typeof(spec) = 'object'),
  primary key (catalog_version, exercise_id),
  foreign key (catalog_version, exercise_id) references public.fitness_exercises(catalog_version, id),
  foreign key (catalog_version, machine_id) references public.fitness_machines(catalog_version, id)
);
create index if not exists fitness_image_specs_machine_idx on fitness_internal.image_specs(catalog_version, machine_id);
create table if not exists fitness_internal.image_generations (
  id uuid primary key default gen_random_uuid(),
  catalog_version text not null,
  exercise_id text not null,
  view_key text not null check (view_key in ('identity', 'adjustment', 'setup', 'start', 'end', 'alignment')),
  prompt_sha256 text not null check (prompt_sha256 ~ '^[a-f0-9]{64}$'),
  actual_model text not null,
  request_id text not null,
  image_sha256 text not null check (image_sha256 ~ '^[a-f0-9]{64}$'),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'rejected', 'approved')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (catalog_version, exercise_id) references fitness_internal.image_specs(catalog_version, exercise_id),
  unique (id, catalog_version, exercise_id),
  check (review_status <> 'approved' or (evidence ?& array['reviewer','reviewedAt','checkpoints','referenceAssetHashes']))
);
create index if not exists fitness_image_generations_spec_idx on fitness_internal.image_generations(catalog_version, exercise_id, view_key);
create table if not exists public.fitness_image_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null,
  catalog_version text not null,
  exercise_id text not null,
  view_key text not null check (view_key in ('identity', 'adjustment', 'setup', 'start', 'end', 'alignment')),
  src text not null check (src like '/media/fitness/%' and src not like '%..%'),
  image_sha256 text not null check (image_sha256 ~ '^[a-f0-9]{64}$'),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'rejected', 'approved')),
  review jsonb not null default '{}'::jsonb,
  foreign key (generation_id, catalog_version, exercise_id) references fitness_internal.image_generations(id, catalog_version, exercise_id),
  foreign key (catalog_version, exercise_id) references public.fitness_exercises(catalog_version, id),
  unique (catalog_version, exercise_id, view_key, image_sha256),
  check (review_status <> 'approved' or (review ?& array['reviewer','reviewedAt','checkpoints','referenceAssetHashes']))
);
create index if not exists fitness_image_assets_generation_idx on public.fitness_image_assets(generation_id, catalog_version, exercise_id);

-- Supabase may provision broad default table grants: revoke first, then explicitly grant only intended access.
do $policies$
declare relation text;
begin
  foreach relation in array array['fitness_catalog_versions','fitness_muscle_groups','fitness_muscles','fitness_equipment_types','fitness_goal_modes','fitness_machines','fitness_exercises','fitness_exercise_muscles','fitness_exercise_machines'] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on table public.%I from public, anon, authenticated', relation);
    execute format('grant select on table public.%I to anon, authenticated', relation);
    execute format('grant all on table public.%I to service_role', relation);
    execute format('drop policy if exists catalog_public_read on public.%I', relation);
    execute format('create policy catalog_public_read on public.%I for select to anon, authenticated using (true)', relation);
  end loop;
  foreach relation in array array['image_specs','image_generations'] loop
    execute format('alter table fitness_internal.%I enable row level security', relation);
    execute format('revoke all on table fitness_internal.%I from public, anon, authenticated', relation);
    execute format('grant all on table fitness_internal.%I to service_role', relation);
    execute format('drop policy if exists catalog_service_only on fitness_internal.%I', relation);
    execute format('create policy catalog_service_only on fitness_internal.%I for all to service_role using (true) with check (true)', relation);
  end loop;
end
$policies$;
alter table public.fitness_image_assets enable row level security;
revoke all on table public.fitness_image_assets from public, anon, authenticated;
grant select on table public.fitness_image_assets to anon, authenticated;
grant all on table public.fitness_image_assets to service_role;
drop policy if exists approved_image_read on public.fitness_image_assets;
create policy approved_image_read on public.fitness_image_assets for select to anon, authenticated using (review_status = 'approved');
comment on table public.fitness_exercises is 'Versioned reference snapshot; historical user program/session JSON intentionally has no FK to this mutable deployment catalog.';
comment on table fitness_internal.image_specs is 'Per-exercise image language, six-view plan, checkpoint evidence and prompt hashes. Unreviewed assets are never automatically published.';

-- Publication checks the reviewed generation, not just a caller-supplied 'approved' label.
create or replace function fitness_internal.check_image_publication() returns trigger
language plpgsql security invoker set search_path = '' as $function$
declare generated fitness_internal.image_generations;
begin
  if new.review_status = 'approved' then
    select * into generated from fitness_internal.image_generations where id = new.generation_id;
    if not found or generated.review_status <> 'approved' or generated.image_sha256 <> new.image_sha256
       or generated.view_key <> new.view_key or generated.evidence <> new.review then
      raise exception 'Image publication requires the matching approved generation and evidence';
    end if;
  end if;
  return new;
end
$function$;
revoke all on function fitness_internal.check_image_publication() from public, anon, authenticated;
grant execute on function fitness_internal.check_image_publication() to service_role;
drop trigger if exists fitness_image_publication_check on public.fitness_image_assets;
create trigger fitness_image_publication_check before insert or update on public.fitness_image_assets
for each row execute function fitness_internal.check_image_publication();

create or replace function fitness_internal.keep_approved_generation() returns trigger
language plpgsql security invoker set search_path = '' as $function$
begin
  if old.review_status = 'approved' and new is distinct from old then
    raise exception 'Approved generations are immutable; create a new generation and review';
  end if;
  return new;
end
$function$;
revoke all on function fitness_internal.keep_approved_generation() from public, anon, authenticated;
grant execute on function fitness_internal.keep_approved_generation() to service_role;
drop trigger if exists fitness_approved_generation_lock on fitness_internal.image_generations;
create trigger fitness_approved_generation_lock before update on fitness_internal.image_generations
for each row execute function fitness_internal.keep_approved_generation();
