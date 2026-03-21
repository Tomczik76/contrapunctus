#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  echo "Stopping Postgres..."
  cd "$ROOT" && podman compose down 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start Postgres
echo "Starting Postgres..."
cd "$ROOT"
podman compose up -d
echo "Waiting for Postgres..."
until podman compose exec db pg_isready -U postgres 2>/dev/null; do
  sleep 1
done

# Build Scala.js
echo "Building Scala.js..."
cd "$ROOT"
sbt coreJS/fastLinkJS

echo "Freeing port 8080..."
lsof -ti tcp:8080 | xargs kill -9 2>/dev/null || true

echo "Starting backend..."
cd "$ROOT"
sbt -Dconfig.file="$ROOT/dev.conf" backend/run 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

echo "Starting frontend..."
cd "$ROOT/frontend"
npm run dev 2>&1 | sed 's/^/[frontend] /' &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8080"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop."

wait
