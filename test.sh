#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Python syntax checks"
python3 -m py_compile "$ROOT_DIR/backend/fetch_garmin.py" "$ROOT_DIR/backend/test_fetch_garmin.py"

echo "==> Backend tests"
python3 -m unittest "$ROOT_DIR/backend/test_fetch_garmin.py"

echo "==> Frontend typecheck"
cd "$ROOT_DIR/frontend"
bun x tsc --noEmit

echo "==> Frontend tests"
bun test
