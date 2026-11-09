-- All assertions run against the disposable native Postgres, never a production user record.
begin;
do $test$
declare version text; matches integer;
begin
  select id into strict version from public.fitness_catalog_versions;
  if (select count(*) from public.fitness_exercises where catalog_version=version) <> 138 then raise exception 'exercise seed mismatch'; end if;
  if (select count(*) from public.fitness_muscles where catalog_version=version) <> 36 then raise exception 'muscle seed mismatch'; end if;
  if (select count(*) from public.fitness_muscle_groups where catalog_version=version) <> 14 then raise exception 'group seed mismatch'; end if;
  if (select count(*) from public.fitness_machines where catalog_version=version) <> 47 then raise exception 'machine seed mismatch'; end if;
  if (select count(*) from public.fitness_exercise_machines where catalog_version=version) <> 70 then raise exception 'machine relationship mismatch'; end if;
  if (select count(*) from fitness_internal.image_specs where catalog_version=version) <> 70 then raise exception 'image specs missing'; end if;
  if (select count(*) from public.fitness_goal_modes where catalog_version=version) <> 5 then raise exception 'goal lookup missing'; end if;
  select count(distinct e.id) into matches from public.fitness_exercises e
    join public.fitness_exercise_muscles em on (em.catalog_version,em.exercise_id)=(e.catalog_version,e.id)
    join public.fitness_muscles m on (m.catalog_version,m.id)=(em.catalog_version,em.muscle_id)
    where e.catalog_version=version and e.equipment_id='cable' and em.role='primary' and m.group_id in ('shoulders','biceps');
  if matches < 2 then raise exception 'multi muscle/equipment join failed'; end if;
  begin
    insert into public.fitness_exercise_muscles values(version,'machine-row','not-a-muscle','primary');
    raise exception 'invalid muscle accepted';
  exception when foreign_key_violation then null;
  end;
  if exists(select 1 from pg_tables where schemaname in ('public','fitness_internal') and tablename in ('fitness_exercises','fitness_muscles','image_specs','image_generations','fitness_image_assets') and not rowsecurity) then raise exception 'RLS missing'; end if;
  raise notice 'PASS reference data, machine sharing, indexed joins and foreign keys';
end
$test$;

set local role anon;
do $test$
begin
  if (select count(*) from public.fitness_exercises) <> 138 then raise exception 'public catalog unreadable'; end if;
  if exists(select 1 from public.fitness_image_assets) then raise exception 'unreviewed image exposed'; end if;
  begin
    update public.fitness_exercises set name='{}';
    raise exception 'anon could edit reference data';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from fitness_internal.image_specs;
    raise exception 'anon could read private specs';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS anonymous reference read, no writes/private specs';
end
$test$;
reset role;
set local role authenticated;
do $test$
begin
  if (select count(*) from public.fitness_machines) <> 47 then raise exception 'signed in catalog unreadable'; end if;
  begin
    delete from public.fitness_muscles;
    raise exception 'authenticated could delete lookup';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from fitness_internal.image_generations;
    raise exception 'authenticated could read generations';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS signed-in reference read, no writes/private generations';
end
$test$;
reset role;

-- A service cannot publish a pending/rejected generation or substitute bytes/view/evidence.
set local role service_role;
do $test$
declare version text; generated uuid; asset uuid; reviewed_evidence jsonb;
begin
  select id into strict version from public.fitness_catalog_versions;
  reviewed_evidence := '{"reviewer":"Native SQL test","reviewedAt":"2026-11-09T17:00:00Z","checkpoints":{"frame":{"pass":true}},"referenceAssetHashes":{}}'::jsonb;
  insert into fitness_internal.image_generations(catalog_version,exercise_id,view_key,prompt_sha256,actual_model,request_id,image_sha256)
    values(version,'machine-chest-press','start',repeat('a',64),'gpt-image-2-2026-04-21','test-request',repeat('b',64)) returning id into generated;
  insert into public.fitness_image_assets(generation_id,catalog_version,exercise_id,view_key,src,image_sha256)
    values(generated,version,'machine-chest-press','start','/media/fitness/test.png',repeat('b',64)) returning id into asset;
  begin
    update public.fitness_image_assets set review_status='approved', review=reviewed_evidence where id=asset;
    raise exception 'pending generation was published';
  exception when raise_exception then
    if sqlerrm = 'pending generation was published' then raise; end if;
  end;
  update fitness_internal.image_generations set review_status='approved', evidence=reviewed_evidence where id=generated;
  begin
    update public.fitness_image_assets set review_status='approved', review=reviewed_evidence, image_sha256=repeat('c',64) where id=asset;
    raise exception 'changed bytes accepted';
  exception when raise_exception then
    if sqlerrm = 'changed bytes accepted' then raise; end if;
  end;
  update public.fitness_image_assets set review_status='approved', review=reviewed_evidence where id=asset;
  begin
    update fitness_internal.image_generations set review_status='unreviewed' where id=generated;
    raise exception 'approved generation changed';
  exception when raise_exception then
    if sqlerrm = 'approved generation changed' then raise; end if;
  end;
  raise notice 'PASS pending and mismatched publication blocked; approved generations immutable';
end
$test$;
set local role anon;
do $test$
begin
  if (select count(*) from public.fitness_image_assets) <> 1 then raise exception 'approved asset not visible'; end if;
  raise notice 'PASS only approved assets visible';
end
$test$;
reset role;
rollback;
