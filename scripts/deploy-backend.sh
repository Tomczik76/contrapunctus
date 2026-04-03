#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-yield}"
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER="contrapunctus"
FAMILY="contrapunctus-backend"
INFRA_DIR="${INFRA_DIR:-$(cd "$(dirname "$0")/../../aws-applications-infra/contrapunctus" && pwd)}"

SKIP_TESTS=false
for arg in "$@"; do
  case "$arg" in
    --skipTests) SKIP_TESTS=true ;;
  esac
done

cd "$(dirname "$0")/.."

# ── Determine active/inactive slot ──────────────────────────────────────────

ACTIVE_SLOT=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw active_slot)
if [ "$ACTIVE_SLOT" = "blue" ]; then
  TARGET_SLOT="green"
else
  TARGET_SLOT="blue"
fi
TARGET_SERVICE="backend-$TARGET_SLOT"

echo "==> Active slot: $ACTIVE_SLOT → deploying to: $TARGET_SLOT"

# ── Build ───────────────────────────────────────────────────────────────────

if [ "$SKIP_TESTS" = false ]; then
  echo "==> Running Scala.js tests (shared module)..."
  sbt coreJVM/test

  echo "==> Running backend tests..."
  sbt backend/test
else
  echo "==> Skipping tests (--skipTests)"
fi

DOCKER=$(command -v docker || command -v podman)
echo "==> Using container runtime: $DOCKER"

echo "==> Fetching ECR repository URL..."
ECR_URL=$(aws ecr describe-repositories \
  --repository-names contrapunctus/backend \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "==> Building image (linux/arm64 for Fargate Graviton)..."
"$DOCKER" build --platform linux/arm64 -f backend/Dockerfile -t backend .

echo "==> Authenticating with ECR..."
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" \
  | "$DOCKER" login --username AWS --password-stdin "$ECR_URL"

IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
FULL_IMAGE="$ECR_URL:$IMAGE_TAG"

echo "==> Tagging and pushing image ($IMAGE_TAG)..."
"$DOCKER" tag backend:latest "$FULL_IMAGE"
"$DOCKER" tag backend:latest "$ECR_URL:latest"
"$DOCKER" push "$FULL_IMAGE"
"$DOCKER" push "$ECR_URL:latest"

# ── Deploy to inactive slot ─────────────────────────────────────────────────

echo "==> Registering new task definition revision with image $IMAGE_TAG..."
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition "$FAMILY" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'taskDefinition' \
  --output json)

NEW_TASK_DEF=$(echo "$CURRENT_TASK_DEF" \
  | python3 -c "
import sys, json
td = json.load(sys.stdin)
td['containerDefinitions'][0]['image'] = '$FULL_IMAGE'
for key in ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy']:
    td.pop(key, None)
print(json.dumps(td))
")

NEW_ARN=$(aws ecs register-task-definition \
  --cli-input-json "$NEW_TASK_DEF" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "==> New task definition: $NEW_ARN"

echo "==> Scaling up $TARGET_SERVICE with new task definition..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$TARGET_SERVICE" \
  --task-definition "$NEW_ARN" \
  --desired-count 1 \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json > /dev/null

echo "==> Waiting for $TARGET_SERVICE to stabilize..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$TARGET_SERVICE" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE"

echo "==> Backend deployed to $TARGET_SLOT slot. Run 'scripts/cutover.sh' to go live."
