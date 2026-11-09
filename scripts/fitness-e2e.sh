#!/usr/bin/env bash
# Browser end-to-end tests for the fitness section (Python Playwright + pytest, tests/fitness/e2e).
#   bash scripts/fitness-e2e.sh            # uses the existing production build (.next); builds first if there is none
#   bash scripts/fitness-e2e.sh --build    # rebuild first
#   bash scripts/fitness-e2e.sh -k session # extra args go to pytest
# The build reads .env.local. Pointing at a backend WITHOUT the fitness tables (today's production) exercises the
# local-first fallback: logging must still work in the browser. PY overrides the Python with Playwright installed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="${PY:-/Users/ilyaperepelitsa/miniforge3/bin/python}"
PORT="${FITNESS_E2E_PORT:-3130}"
if [[ "${1:-}" == "--build" || ! -f .next/BUILD_ID ]]; then
  [[ "${1:-}" == "--build" ]] && shift
  npm run build >/dev/null
fi
npx next start -p "$PORT" >"${TMPDIR:-/tmp}/ilyadays-e2e-server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:$PORT/fitness" && break
  sleep 1
done
curl -sf -o /dev/null "http://localhost:$PORT/fitness" || { echo "server did not start"; cat "${TMPDIR:-/tmp}/ilyadays-e2e-server.log"; exit 1; }
FITNESS_E2E_BASE="http://localhost:$PORT" "$PY" -m pytest "$ROOT/tests/fitness/e2e" -q "$@"
