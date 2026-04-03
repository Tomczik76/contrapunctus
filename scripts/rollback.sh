#!/usr/bin/env bash
set -euo pipefail

# Rolls back to the previous slot. The old frontend assets are still in S3
# and the old backend service should still be running (within grace period).

AWS_PROFILE="${AWS_PROFILE:-yield}"
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER="contrapunctus"
INFRA_DIR="${INFRA_DIR:-$(cd "$(dirname "$0")/../../aws-applications-infra/contrapunctus" && pwd)}"

ACTIVE_SLOT=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw active_slot)
if [ "$ACTIVE_SLOT" = "blue" ]; then
  ROLLBACK_SLOT="green"
else
  ROLLBACK_SLOT="blue"
fi

echo "==> Rolling back: $ACTIVE_SLOT → $ROLLBACK_SLOT"

# Ensure rollback slot service is running
ROLLBACK_SERVICE="backend-$ROLLBACK_SLOT"
CURRENT_COUNT=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$ROLLBACK_SERVICE" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'services[0].desiredCount' \
  --output text)

if [ "$CURRENT_COUNT" = "0" ]; then
  echo "==> Scaling up $ROLLBACK_SERVICE..."
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$ROLLBACK_SERVICE" \
    --desired-count 1 \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --output json > /dev/null

  echo "==> Waiting for $ROLLBACK_SERVICE to stabilize..."
  aws ecs wait services-stable \
    --cluster "$CLUSTER" \
    --services "$ROLLBACK_SERVICE" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE"
fi

# Flip traffic
AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" apply \
  -var="active_slot=$ROLLBACK_SLOT" \
  -auto-approve

echo "==> Rolled back. Live slot is now: $ROLLBACK_SLOT"
