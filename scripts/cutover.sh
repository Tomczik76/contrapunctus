#!/usr/bin/env bash
set -euo pipefail

# Switches live traffic to the inactive slot. Both the CloudFront Function
# (frontend) and the ALB listener rule (backend) are updated atomically via
# a single tofu apply.

AWS_PROFILE="${AWS_PROFILE:-yield}"
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER="contrapunctus"
INFRA_DIR="${INFRA_DIR:-$(cd "$(dirname "$0")/../../aws-applications-infra/contrapunctus" && pwd)}"

ACTIVE_SLOT=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw active_slot)
if [ "$ACTIVE_SLOT" = "blue" ]; then
  TARGET_SLOT="green"
else
  TARGET_SLOT="blue"
fi

echo "==> Cutting over: $ACTIVE_SLOT → $TARGET_SLOT"

AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" apply \
  -var="active_slot=$TARGET_SLOT" \
  -auto-approve

echo "==> Live slot is now: $TARGET_SLOT"

echo "==> Scaling down old slot (backend-$ACTIVE_SLOT)..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "backend-$ACTIVE_SLOT" \
  --desired-count 0 \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json > /dev/null

echo "==> Done. To rollback: scripts/rollback.sh"
