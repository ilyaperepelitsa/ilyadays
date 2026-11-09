#!/usr/bin/env bash
# Check the fitness migration against a throwaway local Postgres with a tiny Supabase stand-in:
# runs the admin, trip-state and fitness migrations (fitness twice: it must be idempotent), then the RLS checks.
#   bash scripts/fitness-sql-check.sh            # uses Homebrew postgresql@17 by default
#   PGBIN=/path/to/bin bash scripts/fitness-sql-check.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ilyadays-pg.XXXXXX")"
PORT="${PGPORT_CHECK:-54329}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=("$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/tests/fitness/sql/supabase-stub.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261006110000_ilyadays_admin.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261006120000_trip_state.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261108120000_fitness.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261108120000_fitness.sql"   # idempotent re-run
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261109135752_fitness_calibration.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261109135752_fitness_calibration.sql"
echo "migrations applied (fitness and calibration twice)"
"${PSQL[@]}" -f "$ROOT/tests/fitness/sql/fitness-rls.sql" 2>&1 | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p' -e '/FAIL/p'
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261109142245_fitness_profiles_self_service.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261109142245_fitness_profiles_self_service.sql"
"${PSQL[@]}" -f "$ROOT/tests/fitness/sql/fitness-profiles.sql" 2>&1 | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p' -e '/FAIL/p'
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261109172530_fitness_reference_catalog.sql"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261109172530_fitness_reference_catalog.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed/fitness-reference-catalog.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed/fitness-reference-catalog.sql"
"${PSQL[@]}" -f "$ROOT/tests/fitness/sql/fitness-catalog.sql" 2>&1 | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p' -e '/FAIL/p'
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261109174108_fitness_set_session_owner_index.sql"
echo "fitness SQL checks passed"
