#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python="$repo_root/apps/aurelius/.venv/bin/python"
if [[ ! -x "$python" ]]; then
  echo "Create the locked Aurelius environment first (npm run aurelius:dev)." >&2
  exit 1
fi
exec "$python" "$repo_root/apps/aurelius/aurelius/batch_runner.py" "$@"
