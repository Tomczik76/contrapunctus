#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-yield}"
INFRA_DIR="${INFRA_DIR:-$(cd "$(dirname "$0")/../../aws-applications-infra/contrapunctus" && pwd)}"

cd "$(dirname "$0")/.."

echo "==> Building Scala.js (fullLinkJS)..."
sbt coreJS/fullLinkJS

echo "==> Building Vite frontend..."
npm run build --prefix frontend

echo "==> Fetching S3 bucket and CloudFront distribution from Tofu state..."
BUCKET=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw frontend_bucket)
DISTRIBUTION_ID=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw cloudfront_distribution_id)

echo "==> Syncing to s3://$BUCKET..."
aws s3 sync frontend/dist "s3://$BUCKET" \
  --delete \
  --profile "$AWS_PROFILE"

echo "==> Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --profile "$AWS_PROFILE" \
  --output json > /dev/null

FRONTEND_URL=$(AWS_PROFILE="$AWS_PROFILE" tofu -chdir="$INFRA_DIR" output -raw cloudfront_url)
echo "==> Done. Live at $FRONTEND_URL"
