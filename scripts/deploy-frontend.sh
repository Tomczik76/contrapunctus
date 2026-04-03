#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-yield}"
INFRA_DIR="${INFRA_DIR:-$(cd "$(dirname "$0")/../../aws-applications-infra/contrapunctus" && pwd)}"

SKIP_TESTS=false
for arg in "$@"; do
  case "$arg" in
    --skipTests) SKIP_TESTS=true ;;
  esac
done

cd "$(dirname "$0")/.."

# ── Determine inactive slot ─────────────────────────────────────────────────

ACTIVE_SLOT=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw active_slot)
if [ "$ACTIVE_SLOT" = "blue" ]; then
  TARGET_SLOT="green"
else
  TARGET_SLOT="blue"
fi

echo "==> Active slot: $ACTIVE_SLOT → deploying frontend to: $TARGET_SLOT"

# ── Build ───────────────────────────────────────────────────────────────────

if [ "$SKIP_TESTS" = false ]; then
  echo "==> Running Scala.js tests (shared module)..."
  sbt coreJS/test
fi

echo "==> Building Scala.js (fullLinkJS)..."
sbt coreJS/fullLinkJS

if [ "$SKIP_TESTS" = false ]; then
  echo "==> Running frontend tests..."
  npm run test --prefix frontend
else
  echo "==> Skipping tests (--skipTests)"
fi

echo "==> Building Vite frontend..."
npm run build --prefix frontend

# ── Upload to inactive slot prefix ──────────────────────────────────────────

BUCKET=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw frontend_bucket)

echo "==> Syncing to s3://$BUCKET/$TARGET_SLOT/..."
aws s3 sync frontend/dist "s3://$BUCKET/$TARGET_SLOT/" \
  --delete \
  --profile "$AWS_PROFILE"

echo "==> Frontend deployed to $TARGET_SLOT slot. Run 'scripts/cutover.sh' to go live."
