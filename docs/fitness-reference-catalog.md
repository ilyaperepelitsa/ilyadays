# Fitness reference data

The dedicated ilyadays Supabase project has a versioned catalog seeded from this repository. Typekana is not modified. Current catalog: `fitness-v2-915b27fc7429a034`.

| Reference | Rows | Purpose |
| --- | ---: | --- |
| fitness_muscle_groups | 14 | Coarse focus and filter IDs |
| fitness_muscles | 36 | Individual muscles, group, bilingual names and functions |
| fitness_equipment_types | 10 | Equipment taxonomy and machine flag |
| fitness_goal_modes | 5 | One primary prescription plus supporting priority IDs |
| fitness_machines | 47 | Shared generic physical machine identities |
| fitness_exercises | 138 | Bilingual exercise snapshot, equipment, movement and authored details |
| fitness_exercise_muscles | relationships | Primary/secondary muscle links |
| fitness_exercise_machines | 70 | Exercise-specific setup on a physical machine |
| fitness_internal.image_specs | 70 | Backend-only six-view configs, checkpoints, source and prompt hashes |

`fitness_catalog_versions` binds each snapshot to its source hash and expected counts. Every relationship includes the catalog version. The compiler reads the same authored IDs as the offline app; it does not introduce a second hand-maintained taxonomy. The site keeps the static snapshot for fast and offline browsing, rather than requiring a database fetch to render a filter.

Public reference tables have RLS and explicit read grants for anonymous/signed-in visitors. Client write grants are revoked. Generation specs and reviews live in a private schema, with no client usage/read grants. The service role manages catalog data. Private profiles and programs retain validated focus/goal preferences in their existing JSON snapshots; no new public user-preference table is created.

Historical programs/sessions keep their original snapshots and exercise IDs. They do not acquire foreign keys to a newer deployment's reference data. An update creates a new catalog version; the seed uses `ON CONFLICT DO NOTHING`, leaving existing versions intact. Do not delete historical catalog versions to reset an active user plan.

## Rebuild and validate

```sh
node scripts/fitness-machine-specs.mjs check
node scripts/fitness-catalog-seed.mjs
npm run check:fitness:catalog
npm run test:fitness:sql
```

The generated seed is `supabase/seed/fitness-reference-catalog.sql`. It has bounded inserts and can be rerun. Apply the reference migration before seeding; apply only new migrations to the dedicated project, since the pre-existing hosted/local migration timestamps differ. Never blindly push local migration history to Typekana or replay old migrations against another project.

Indexes cover muscle→group, exercises→equipment/movement, reverse muscle/exercise links, machine/exercise links, image spec/generation links and bilingual name tokens. The existing workout-set ownership foreign key now also has a covering `(session_id, user_id)` index. Small reference tables may reasonably use sequential scans; newly created unused indexes are not evidence to remove the relationships' supporting indexes.

For a multi-muscle search, select distinct exercise IDs joining `fitness_exercise_muscles` to `fitness_muscles`, with `role = 'primary'` and `group_id IN (...)`, then intersect equipment/movement predicates. Goals are plan priorities, not a fabricated exercise compatibility filter. See `tests/fitness/sql/fitness-catalog.sql` for the checked query and public/private access assertions.

Native Postgres verification applies migrations and seed twice, checks all reference counts, foreign keys and multi-muscle joins, and tests anonymous, authenticated and service access. It also proves pending/mismatched image publication is blocked and approved generation records cannot be edited. Hosted checks confirmed catalog counts and read-only client grants. Security advisors introduced no new warnings; existing explicit owner/profile RPC warnings remain unchanged. Their access is intentional and covered by the prior RLS/profile tests. [Supabase security-definer advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
