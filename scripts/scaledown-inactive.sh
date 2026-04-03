#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-yield}"
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER="contrapunctus"
INFRA_DIR="${INFRA_DIR:-$(cd "$(dirname "$0")/../../aws-applications-infra/contrapunctus" && pwd)}"

ACTIVE_SLOT=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw active_slot)
if [ "$ACTIVE_SLOT" = "blue" ]; then
  INACTIVE_SLOT="green"
else
  INACTIVE_SLOT="blue"
fi

INACTIVE_SERVICE="backend-$INACTIVE_SLOT"

echo "==> Active slot: $ACTIVE_SLOT — scaling down $INACTIVE_SERVICE..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$INACTIVE_SERVICE" \
  --desired-count 0 \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json > /dev/null

echo "==> Done. $INACTIVE_SERVICE scaled to 0."
