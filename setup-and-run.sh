#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Setting up backend"
cd "$ROOT_DIR/backend"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

source .venv/bin/activate

pip install -r requirements.txt

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo
    echo "Created backend/.env"
    echo "Please fill in GARMIN_EMAIL and GARMIN_PASSWORD, then rerun this script."
    exit 1
fi

echo "==> Fetching Garmin data"
python fetch_garmin.py --days 30

deactivate

echo "==> Starting frontend"
cd "$ROOT_DIR/frontend"

bun install
bun run src/index.tsx
