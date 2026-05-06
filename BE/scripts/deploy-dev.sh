#!/usr/bin/env bash
set -euo pipefail

# Simple helper script to run on the develop server if you prefer server-side deploy flow.
# Place `.env.develop` in the same directory and set proper permissions (chmod 600 .env.develop).

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "Pulling latest changes..."
if [ -d .git ]; then
  git fetch --all
  git reset --hard origin/develop
fi

echo "Starting docker compose (develop)..."
if [ -f .env.develop ]; then
  chmod 600 .env.develop
fi

docker compose --env-file .env.develop pull --ignore-pull-failures || true
docker compose --env-file .env.develop up -d --build

echo "Running DB migrations (alembic)..."
docker compose --env-file .env.develop exec -T api alembic upgrade head || true

echo "Deploy complete."
