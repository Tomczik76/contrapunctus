#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

# Find container runtime (prefer podman, fall back to docker)
RUNTIME=""
for candidate in podman docker; do
  if command -v "$candidate" &>/dev/null; then
    RUNTIME="$candidate"
    break
  fi
done

if [ -z "$RUNTIME" ]; then
  echo "Error: neither podman nor docker found. Please install one and try again."
  exit 1
fi

echo "Using: $RUNTIME"

compose() {
  "$RUNTIME" compose "$@"
}

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  compose -f "$ROOT/docker-compose.yml" stop
}
trap cleanup EXIT INT TERM

echo "Starting PostgreSQL..."
compose -f "$ROOT/docker-compose.yml" down -v --remove-orphans 2>/dev/null || true
compose -f "$ROOT/docker-compose.yml" up -d

echo "Waiting for PostgreSQL to be ready..."
until compose -f "$ROOT/docker-compose.yml" exec -T db pg_isready -U contrapunctus -q; do
  sleep 1
done

# Build Scala.js
echo "Building Scala.js..."
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
