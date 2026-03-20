#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="/Users/ryantomczik/Dev/aws-applications-infra/contrapunctus"

# Get tofu outputs
cd "$INFRA_DIR"
BUCKET=$(tofu output -raw frontend_bucket)
DISTRIBUTION_ID=$(tofu output -raw cloudfront_distribution_id)

# Build Scala.js (production / fullLinkJS)
cd "$SCRIPT_DIR"
sbt fullLinkJS

# Build Vite frontend
cd "$SCRIPT_DIR/frontend"
npx vite build

# Sync to S3
aws s3 sync "$SCRIPT_DIR/frontend/dist" "s3://$BUCKET" --delete

# Invalidate index.html so CloudFront picks up the new deploy
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html" > /dev/null

echo "Deployed! Site will be available at:"
echo "https://$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query 'Distribution.DomainName' --output text)"
