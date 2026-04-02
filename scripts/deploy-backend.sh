#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-yield}"
AWS_REGION="${AWS_REGION:-us-west-2}"
CLUSTER="contrapunctus"
SERVICE="backend"
FAMILY="contrapunctus-backend"

SKIP_TESTS=false
for arg in "$@"; do
  case "$arg" in
    --skipTests) SKIP_TESTS=true ;;
  esac
done

cd "$(dirname "$0")/.."

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

echo "==> Updating service to new task definition..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$NEW_ARN" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json > /dev/null

echo "==> Waiting for service to stabilize..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE"

echo "==> Done. Deployed $FULL_IMAGE"
