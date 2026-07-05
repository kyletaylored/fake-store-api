#!/usr/bin/env bash
# Builds the app image once and deploys both Cloud Run services from it:
#   - fake-store-api (cloud-run/service.yaml)   - the main app + db + datadog-agent
#   - fake-store-mcp (cloud-run/mcp-service.yaml) - the MCP server, for Agent Studio
#
# See docs/cloud-run-deploy.md for the full explanation and prerequisites.
#
# Usage:
#   PROJECT_ID=my-project REGION=us-west1 ./cloud-run/deploy.sh
#
# ANTHROPIC_API_KEY and DD_API_KEY are left blank in cloud-run/service.yaml
# and cloud-run/mcp-service.yaml (plain env vars, not Secret Manager - fine
# for this demo). Fill in real values either by editing those files before
# running this script, or afterward with:
#   gcloud run services update fake-store-api --region "$REGION" \
#     --update-env-vars=ANTHROPIC_API_KEY=...
#   gcloud run services update fake-store-api --region "$REGION" \
#     --update-env-vars=DD_API_KEY=...

set -euo pipefail
cd "$(dirname "$0")/.."

: "${PROJECT_ID:?Set PROJECT_ID, e.g. PROJECT_ID=my-project ./cloud-run/deploy.sh}"
: "${REGION:=us-west1}"

REPO=fake-store-api
# A unique tag per run, not :latest - Cloud Run's `services replace` skips
# creating a new revision when the submitted YAML text is unchanged, and
# "app:latest" is the same string every run even though the tag moves to a
# new digest each time. Falls back to a timestamp outside a git checkout.
TAG=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/app:${TAG}"

echo "==> Enabling required APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com --project "$PROJECT_ID"

echo "==> Ensuring Artifact Registry repo exists"
if ! gcloud artifacts repositories describe "$REPO" --location="$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO" --repository-format=docker \
    --location="$REGION" --project "$PROJECT_ID"
fi

echo "==> Building and pushing the image ($IMAGE)"
gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID" .

echo "==> Deploying fake-store-api (app + db + datadog-agent)"
sed "s|REGION-docker.pkg.dev/PROJECT_ID/fake-store-api/app:latest|${IMAGE}|" \
  cloud-run/service.yaml > /tmp/fake-store-api-service.yaml
gcloud run services replace /tmp/fake-store-api-service.yaml --region "$REGION" --project "$PROJECT_ID"
gcloud run services add-iam-policy-binding fake-store-api --region "$REGION" --project "$PROJECT_ID" \
  --member=allUsers --role=roles/run.invoker >/dev/null

echo "==> Deploying fake-store-mcp (mcp + db)"
sed "s|REGION-docker.pkg.dev/PROJECT_ID/fake-store-api/app:latest|${IMAGE}|" \
  cloud-run/mcp-service.yaml > /tmp/fake-store-mcp-service.yaml
gcloud run services replace /tmp/fake-store-mcp-service.yaml --region "$REGION" --project "$PROJECT_ID"
gcloud run services add-iam-policy-binding fake-store-mcp --region "$REGION" --project "$PROJECT_ID" \
  --member=allUsers --role=roles/run.invoker >/dev/null

APP_URL=$(gcloud run services describe fake-store-api --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
MCP_URL=$(gcloud run services describe fake-store-mcp --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')

echo
echo "==> Done"
echo "App:  $APP_URL"
echo "MCP:  $MCP_URL/mcp   <- use this as the Endpoint URL in Agent Studio's MCP connector"
