#!/usr/bin/env bash
set -euo pipefail

# Full deploy: builds and deploys both backend and frontend to the inactive
# slot, then cuts over. Pass --skipTests to skip test suites.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  Deploying backend"
echo "========================================="
"$SCRIPT_DIR/deploy-backend.sh" "$@"

echo ""
echo "========================================="
echo "  Deploying frontend"
echo "========================================="
"$SCRIPT_DIR/deploy-frontend.sh" "$@"

echo ""
echo "========================================="
echo "  Cutting over"
echo "========================================="
"$SCRIPT_DIR/cutover.sh"
